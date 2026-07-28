// run-camara-lobby — runner de la ingesta del lobby del portal propio de la Cámara de Diputados
// (`camara.cl/transparencia/listadodeaudiencias.aspx`, Phase 24) con adjudicación de identidad.
//
// Flujo en el ORDEN LOCKED de dos etapas (CLAUDE.md):
//   1. Conector → HTML crudo (un único fetch, todo el dataset).
//   2. Etapa 1 (best-effort): persiste el HTML crudo content-addressed en R2 (NO fatal: si falla
//      o no hay store, se sigue a Supabase — el crudo es la verdad versionada, pero no debe
//      bloquear la carga del derivado).
//   3. Parser cheerio → `LobbyAudiencia[]`.
//   4. Reconciliación del sujeto pasivo contra la maestra cruzando por el DIPUTADO REAL (extrae el
//      honorable cuando el sujeto pasivo es un asesor) con `camara:"diputados"` + `periodo` para
//      que el blocking DURO (apellido+cámara+periodo) encuentre a los 155 diputados de la maestra.
//      GUARDA LOCKED: SOLO determinista mintea el FK; el resto → no_confirmado, mención cruda.
//   5. Writer idempotente: upsert de audiencias + marcado de los parlamentarios confirmados.
//
// Mención ALMACENADA = nombre RAW del sujeto pasivo (asesor incluido) → trazabilidad / honest-state.
// Nombre de CRUCE = el honorable extraído del paréntesis. Son independientes (Phase 25).

import { R2Store, sha256Hex } from "@obs/ingest";
import { normalizarNombre, type Parlamentario } from "@obs/core";
import { CamaraLobbyConnector } from "./connector-camara-lobby";
import { parseCamaraLobbyAudiencias } from "./parse-camara-lobby";
import { reconciliarSujeto, type ReconciliarSujetoOpts } from "./reconciliar-sujeto";
import { extraerNombreSujetoCamara } from "./extraer-sujeto-camara";
import { ROL_SUJETO_PASIVO } from "./model";
import type { LobbyWriter } from "./writer";

/** Provider LLM, tipado igual que en `reconciliarSujeto` (no se invoca para deterministas). */
type LLMProvider = ReconciliarSujetoOpts["provider"];

/** Periodo + cámara del blocking de la Cámara (filtros DUROS — los 155 diputados de la maestra). */
const PERIODO_CAMARA_DEFAULT = "2026-2030";
const CAMARA_DEFAULT = "diputados";

export interface RunCamaraLobbyOpts {
  /** Conector del listado de la Cámara (un único fetch). Inyectable en tests. */
  conector: CamaraLobbyConnector;
  /** Writer idempotente (in-memory en tests, Supabase en LIVE). */
  writer: LobbyWriter;
  /** Maestra de parlamentarios (cruce DURO por apellido+cámara+periodo). */
  maestra: Parlamentario[];
  /** Store R2 para la Etapa 1 (crudo). Si se omite, no se persiste crudo (r2Path = null). */
  r2Store?: R2Store;
  /** ISO 8601 de captura (procedencia determinista en tests). Default: now. */
  fechaCaptura?: string;
  /** Periodo del blocking. Default `"2026-2030"`. */
  periodo?: string;
  /** Cámara del blocking. Default `"diputados"`. */
  camara?: string;
  /** Provider LLM; no se invoca para los sujetos pasivos que resuelven determinísticamente. */
  provider?: LLMProvider;
  /**
   * true = el crudo YA está versionado en R2 y esta corrida es un REPLAY (`--from-r2`): la
   * Etapa 1 se omite A PROPÓSITO, así que NO se emite el `[WARN]` de "sin crudo versionado"
   * (sería una alarma falsa). Sin este flag, la ausencia de `r2Store` SÍ es una degradación.
   */
  omitirEtapa1?: boolean;
  /** Sink de logs (inyectable en tests). Default: noop. */
  log?: (m: string) => void;
}

export interface RunCamaraLobbyResult {
  /** Audiencias parseadas + escritas. */
  audiencias: number;
  /** Suma de contrapartes (terceros) escritas. */
  contrapartes: number;
  /**
   * Parlamentarios marcados como ingestados. CR-03: es un SUBCONJUNTO de `confirmados` — sólo
   * los que traen al menos una audiencia con fecha parseable pueden empujar la cobertura.
   */
  parlamentariosMarcados: number;
  /** Parlamentarios con FK confirmado en esta corrida. */
  confirmados: number;
  /**
   * CR-03 — cobertura marcada por parlamentario (`parlamentarioId → ingestado_hasta`, `YYYY-MM-DD`),
   * derivada de la fecha máxima de SUS audiencias. Vacío ⇒ no se marcó a nadie.
   */
  marcadoHasta: Record<string, string>;
  /** Key del crudo en R2, o null (Etapa 1 omitida o fallida — no fatal). */
  r2Path: string | null;
  /**
   * WR-01 — true cuando el hash-check de la Etapa 1 dio 412 (`existed`): el crudo NO cambió, así
   * que la Etapa 2 se omitió A PROPÓSITO. Es una corrida SANA con `audiencias: 0`, y quien la
   * inspeccione (el guard del workflow) debe poder distinguirla de un fallo real.
   */
  sinNovedades: boolean;
}

/**
 * Corre la ingesta del lobby de la Cámara con adjudicación de identidad. Idempotente; provenance
 * por fila; fail-closed (un sujeto pasivo fuera de la maestra queda no_confirmado, NUNCA fabrica
 * un FK). NO realiza ráfagas (el conector reusa la política LOCKED de @obs/ingest).
 */
export async function runCamaraLobby(opts: RunCamaraLobbyOpts): Promise<RunCamaraLobbyResult> {
  const log = opts.log ?? (() => {});

  // Conector → HTML crudo (un único fetch trae todo el dataset).
  const html = await opts.conector.fetchListado();
  log(`camara-lobby: HTML recibido (${html.length} chars)`);

  // Fecha de captura → provenance de fila y partición de la key de R2. CR-03: ya NO alimenta el
  // marcado de cobertura (`ingestado_hasta`), que sale de la fecha de las audiencias.
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const date = fechaCaptura.slice(0, 10);

  // Etapa 1 (R2, best-effort): persiste el crudo content-addressed. NO fatal — la carga a Supabase
  // procede aunque R2 falle (el crudo es la verdad versionada, pero no debe bloquear el derivado).
  let r2Path: string | null = null;
  if (opts.r2Store) {
    try {
      const bytes = new TextEncoder().encode(html);
      const sha = await sha256Hex(bytes);
      const { r2Path: newPath, existed } = await opts.r2Store.putImmutable(
        "camara-lobby",
        "listadodeaudiencias",
        date,
        sha,
        "html",
        bytes,
      );
      r2Path = newPath;
      if (existed) {
        log("[skip] sin novedades — camara-lobby listadodeaudiencias");
        return {
          audiencias: 0,
          contrapartes: 0,
          parlamentariosMarcados: 0,
          confirmados: 0,
          marcadoHasta: {},
          r2Path,
          sinNovedades: true,
        };
      }
      log(`camara-lobby: crudo en R2 → ${r2Path}`);
    } catch (err) {
      r2Path = null;
      log(`camara-lobby: Etapa 1 R2 falló (no fatal): ${(err as Error).message}`);
    }
  } else if (opts.omitirEtapa1) {
    // Replay (`--from-r2`): el crudo ya está content-addressed en R2 — re-escribirlo daría
    // 412 y saltaría la Etapa 2 entera, que es justo lo que el operador quiere correr.
    log("camara-lobby: replay desde R2 — Etapa 1 ya cumplida (el crudo ya está versionado)");
  } else {
    // IN-02/W-9: sin store, el dos-etapas LOCKED degrada a una-etapa. Se DICE (no se finge):
    // el derivado se carga igual, pero esta corrida NO dejó crudo re-procesable.
    log("[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)");
  }

  // Parser cheerio → LobbyAudiencia[].
  const aud = parseCamaraLobbyAudiencias(html, { fechaCaptura });
  log(`camara-lobby: ${aud.length} audiencias parseadas`);

  // MAESTRA DE CLAVE COMPLETA (token-set CON materno) — clave del match determinista de esta fuente.
  // El `nombre_normalizado` de la maestra es materno-LESS por diseño (catálogos cuyas menciones
  // pueden no traer materno). PERO el lobby de la Cámara publica el NOMBRE COMPLETO del sujeto
  // pasivo (nombres + paterno + materno), que `normalizarNombre({libre})` normaliza al token-set
  // COMPLETO. Cruzar contra una maestra materno-LESS nunca casaría (3-4 tokens vs 2). Se recomputa
  // el `nombre_normalizado` de la maestra al token-set COMPLETO (incl. materno): el match resultante
  // es MÁS ESTRICTO que el materno-less (nunca menos), único en (cámara,periodo) y fail-closed ante
  // colisión — sin tocar el núcleo de identidad (matchDeterminista/correrPipeline corren igual).
  const maestraClaveCompleta: Parlamentario[] = opts.maestra.map((p) => ({
    ...p,
    nombre_normalizado: normalizarNombre({
      libre: [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" "),
    }).nombre_normalizado,
  }));

  // Reconciliación: cruza por el DIPUTADO REAL (extrae el honorable de un asesor); el mencionSujeto
  // almacenado sigue siendo el RAW. Blocking DURO por cámara "diputados" + periodo "2026-2030".
  const { audiencias: filas, parlamentariosConfirmados } = await reconciliarSujeto(
    aud,
    maestraClaveCompleta,
    {
      periodo: opts.periodo ?? PERIODO_CAMARA_DEFAULT,
      camara: opts.camara ?? CAMARA_DEFAULT,
      nombreParaCruce: (a) => {
        const sp = a.asistentes.find((x) => x.rol === ROL_SUJETO_PASIVO);
        return sp ? extraerNombreSujetoCamara(sp.nombre) : null;
      },
      ...(opts.provider !== undefined ? { provider: opts.provider } : {}),
    },
  );

  // Writer idempotente: upsert de audiencias + marcado de los confirmados.
  await opts.writer.upsertAudiencias(filas);

  // CR-03 (119-REVIEW) — la cobertura de cada parlamentario confirmado sale de la fecha MÁXIMA
  // de SUS audiencias en este lote, NUNCA de `fechaCaptura` (wall-clock de la corrida).
  //
  // POR QUÉ IMPORTA: este conector es el que escribe las 136 filas vigentes de
  // `lobby_ingesta_estado`. Marcando con el reloj, `ingestado_hasta` afirmaba cobertura hasta HOY
  // aunque el listado sólo llegara a junio — y la guarda monotónica de `writer-supabase.ts` no lo
  // podía detectar, porque el reloj siempre avanza: el mecanismo nuevo lo SELLABA en vez de
  // frenarlo. `fechaCaptura` se queda sólo como provenance de fila y partición de la key de R2.
  //
  // Una fila sin fecha parseable no empuja nada (mismo criterio que CR-02 en el conector
  // leylobby); un confirmado sin ninguna fila fechada NO se marca.
  const confirmados = new Set(parlamentariosConfirmados);
  const marcados = new Map<string, string>();
  for (const f of filas) {
    const id = f.enlace?.parlamentarioId;
    if (id == null || !confirmados.has(id)) continue;
    if (f.fecha == null) continue;
    const fechaDato = f.fecha.slice(0, 10);
    const prev = marcados.get(id);
    if (prev === undefined || fechaDato > prev) marcados.set(id, fechaDato);
  }
  // Se agrupa por fecha porque `marcarIngestado` toma un solo `hasta` por lote y distintos
  // parlamentarios tienen distinta fecha máxima ingerida. El writer es COMPARTIDO con el conector
  // leylobby: la firma `(ids, hasta)` no cambia — sólo cambia de dónde sale `hasta`.
  const porHasta = new Map<string, string[]>();
  for (const [id, h] of marcados) {
    const lote = porHasta.get(h);
    if (lote) lote.push(id);
    else porHasta.set(h, [id]);
  }
  for (const [h, ids] of porHasta) {
    await opts.writer.marcarIngestado(ids, h);
  }

  const contrapartes = filas.reduce((acc, f) => acc + f.contrapartes.length, 0);
  log(
    `camara-lobby: OK → ${filas.length} audiencias / ${contrapartes} contrapartes / ` +
      `${parlamentariosConfirmados.length} confirmados / ${marcados.size} marcados ` +
      `(r2Path=${r2Path ?? "none"})`,
  );

  return {
    audiencias: filas.length,
    contrapartes,
    parlamentariosMarcados: marcados.size,
    confirmados: parlamentariosConfirmados.length,
    marcadoHasta: Object.fromEntries(marcados),
    sinNovedades: false,
    r2Path,
  };
}
