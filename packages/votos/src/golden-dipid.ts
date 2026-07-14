// golden-dipid — GOLDEN SET DIPID→id_maestra (VOTO-03) — GATE FAIL-CLOSED pre-backfill.
//
// El "golden set" DIPID→id_maestra que blinda el cruce de votos NO se construye aquí desde
// cero: ya vive como DATO autoritativo en `supabase/seeds/parlamentario.seed.json` (los ~155
// diputados vigentes, cada uno con `id_diputado_camara` poblado). `cargarMaestra()` lee ese
// seed → la maestra ES la tabla de mapeo. Este módulo DERIVA el golden de esa maestra y lo
// VALIDA con invariantes duras que fallan RUIDOSO, para congelar el mapeo ANTES del backfill
// masivo (Phase 66). NO recrea `reconciliarVotosCamara` ni `EnlaceConfirmado` (ya existen,
// puros, probados): el gate corre ALREDEDOR de ellos (ver golden-dipid.test.ts).
//
// DECISIÓN A1 (estado==='confirmado' como INVARIANTE, no como suerte): hoy los 155 diputados
// del seed son `estado='confirmado'`, así que asertar "todos confirmado" es un no-op benigno.
// Pero hacerlo un invariante EXPLÍCITO significa que un futuro diputado que caiga a
// `probable`/`no_confirmado` en el seed ROMPE el gate RUIDOSO en vez de linkear su voto en
// silencio. IMPORTANTE: el reconciliador `reconciliarVotosCamara` NO lee `estado` — linkea por
// PRESENCIA en el índice (camara+periodo+DIPID); `estado` es metadato de DISPLAY. Por eso este
// invariante vive en el GOLDEN GATE, no en el reconciliador (que NO se toca en esta fase).
//
// TRAMPA DEL DIPID RECICLADO (recycle-trap): los DIPID no son globalmente únicos en el tiempo
// (un DIPID de 2018-2022 puede reasignarse en 2026-2030). El seed actual tiene UN SOLO periodo,
// así que hoy no hay colisión posible — pero el invariante "un solo periodo" hace que un FUTURO
// seed multi-periodo ROMPA el gate ruidoso en vez de arriesgar una atribución cruzada de voto.
// El scoping cross-periodo del cruce en sí ya lo hace `reconciliarVotosCamara({periodo})`.

import type { Parlamentario } from "@obs/core";

/** Periodo legislativo vigente de los diputados en el seed (llave del scoping DIPID→persona). */
export const PERIODO_VIGENTE = "2026-2030";

// Banda de conteo RAZONADA (Pitfall 4): NO se asierta `=== 155` exacto porque un reemplazo
// legítimo (renuncia/subrogancia/vacancia) cambiaría el conteo a 154/156 y rompería el gate
// por una razón VÁLIDA. La banda [150, 160] tolera esa rotación normal pero sigue detectando
// una degradación real (seed truncado o inflado). El piso es el `MIN_DIPUTADOS`-style de
// plausibilidad de `parse-camara.ts`.
export const N_MIN = 150;
export const N_MAX = 160;

/** Una fila del golden set: el mapeo mínimo DIPID→id de la maestra. */
export interface GoldenDipidRow {
  /** El `id_diputado_camara` (DIPID) — la llave natural del votante en el WS de la Cámara. */
  dipid: string;
  /** El `id` interno de la maestra (p.ej. "P00001") al que resuelve ese DIPID. */
  idMaestra: string;
}

/**
 * Deriva el golden set DIPID→id_maestra del seed autoritativo (read-only, sin DB, sin red).
 * NO hardcodea los DIPID (Pitfall 3: una lista congelada a mano se pudre): filtra la maestra
 * pasada por `camara==='diputados' && periodo===PERIODO_VIGENTE && id_diputado_camara no-vacío`
 * y mapea a `{ dipid, idMaestra }`. Para el seed real → ~155 filas.
 */
export function derivarGoldenDipid(maestra: Parlamentario[]): GoldenDipidRow[] {
  return maestra
    .filter(
      (p) =>
        p.camara === "diputados" &&
        p.periodo === PERIODO_VIGENTE &&
        p.id_diputado_camara != null &&
        p.id_diputado_camara.length > 0,
    )
    .map((p) => ({ dipid: p.id_diputado_camara!, idMaestra: p.id }));
}

/**
 * Valida el golden set derivado contra invariantes DURAS que fallan RUIDOSO (lanza `Error` con
 * mensaje específico ante la PRIMERA rota). Recibe la `maestra` original para poder asertar los
 * invariantes que `GoldenDipidRow` no transporta (estado, periodo — decisión (i) del plan:
 * `GoldenDipidRow` se mantiene mínimo {dipid, idMaestra}).
 *
 * Invariantes:
 *  (a) conteo en la banda razonada [N_MIN, N_MAX] (rotación legítima tolerada; degradación no).
 *  (b) DIPIDs únicos (0 duplicados) — un DIPID duplicado atribuiría el voto ambiguamente.
 *  (c) un SOLO periodo entre los diputados sourced (recycle-trap: multi-periodo → fail loud).
 *  (d) todo `idMaestra` no-vacío — un mapeo a "" es un FK vacío inaceptable.
 *  (A1) todo diputado sourced tiene `estado==='confirmado'` — un diputado dudoso NO debe linkear.
 *
 * @param golden  filas derivadas por `derivarGoldenDipid`.
 * @param maestra la maestra original (para los checks de estado + periodo por-fila).
 * @returns       las mismas filas validadas (para encadenar) si todos los invariantes pasan.
 */
export function validarGoldenDipid(
  golden: GoldenDipidRow[],
  maestra: Parlamentario[],
): GoldenDipidRow[] {
  // (a) conteo en banda.
  if (golden.length < N_MIN || golden.length > N_MAX) {
    throw new Error(
      `golden-dipid: conteo fuera de banda: ${golden.length} no está en [${N_MIN}, ${N_MAX}] ` +
        `(rotación legítima tolerada; una degradación real del seed rompe este gate)`,
    );
  }

  // (b) DIPIDs únicos.
  const dipids = new Set<string>();
  for (const row of golden) {
    if (dipids.has(row.dipid)) {
      throw new Error(`golden-dipid: DIPID duplicado '${row.dipid}' — un DIPID debe resolver a UNA persona`);
    }
    dipids.add(row.dipid);
    // (d) idMaestra no-vacío.
    if (row.idMaestra.length === 0) {
      throw new Error(`golden-dipid: idMaestra vacío para DIPID '${row.dipid}' — FK vacío inaceptable`);
    }
  }

  // Los diputados vigentes de la maestra que sostienen el golden (para (c) y (A1)).
  const diputadosVigentes = maestra.filter(
    (p) =>
      p.camara === "diputados" &&
      p.id_diputado_camara != null &&
      p.id_diputado_camara.length > 0,
  );

  // (c) un solo periodo (recycle-trap): un futuro seed multi-periodo rompe RUIDOSO.
  const periodos = new Set(diputadosVigentes.map((p) => p.periodo));
  if (periodos.size !== 1) {
    throw new Error(
      `golden-dipid: se esperaba UN SOLO periodo entre los diputados; se hallaron ${periodos.size} ` +
        `[${[...periodos].join(", ")}] — la trampa del DIPID reciclado exige mono-periodo (fail loud)`,
    );
  }
  const [periodoUnico] = periodos;
  if (periodoUnico !== PERIODO_VIGENTE) {
    throw new Error(
      `golden-dipid: periodo único '${periodoUnico}' ≠ PERIODO_VIGENTE '${PERIODO_VIGENTE}'`,
    );
  }

  // (A1) todos confirmado: un diputado que caiga a probable/no_confirmado rompe el gate.
  const noConfirmados = diputadosVigentes.filter((p) => p.estado !== "confirmado");
  if (noConfirmados.length > 0) {
    throw new Error(
      `golden-dipid: ${noConfirmados.length} diputado(s) con estado≠'confirmado' ` +
        `(p.ej. id='${noConfirmados[0]!.id}' estado='${noConfirmados[0]!.estado}') — ` +
        `A1: un diputado dudoso NO debe linkear su voto (estado es invariante del gate, no del reconciliador)`,
    );
  }

  return golden;
}
