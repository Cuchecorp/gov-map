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
  /** Sink de logs (inyectable en tests). Default: noop. */
  log?: (m: string) => void;
}

export interface RunCamaraLobbyResult {
  /** Audiencias parseadas + escritas. */
  audiencias: number;
  /** Suma de contrapartes (terceros) escritas. */
  contrapartes: number;
  /** Parlamentarios marcados como ingestados (= confirmados en esta corrida). */
  parlamentariosMarcados: number;
  /** Parlamentarios con FK confirmado en esta corrida. */
  confirmados: number;
  /** Key del crudo en R2, o null (Etapa 1 omitida o fallida — no fatal). */
  r2Path: string | null;
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

  // Fecha de captura → la misma para R2 (date) y para el marcado de ingesta.
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const date = fechaCaptura.slice(0, 10);

  // Etapa 1 (R2, best-effort): persiste el crudo content-addressed. NO fatal — la carga a Supabase
  // procede aunque R2 falle (el crudo es la verdad versionada, pero no debe bloquear el derivado).
  let r2Path: string | null = null;
  if (opts.r2Store) {
    try {
      const bytes = new TextEncoder().encode(html);
      const sha = await sha256Hex(bytes);
      r2Path = await opts.r2Store.putImmutable(
        "camara-lobby",
        "listadodeaudiencias",
        date,
        sha,
        "html",
        bytes,
      );
      log(`camara-lobby: crudo en R2 → ${r2Path}`);
    } catch (err) {
      r2Path = null;
      log(`camara-lobby: Etapa 1 R2 falló (no fatal): ${(err as Error).message}`);
    }
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
  if (parlamentariosConfirmados.length > 0) {
    await opts.writer.marcarIngestado(parlamentariosConfirmados, date);
  }

  const contrapartes = filas.reduce((acc, f) => acc + f.contrapartes.length, 0);
  log(
    `camara-lobby: OK → ${filas.length} audiencias / ${contrapartes} contrapartes / ` +
      `${parlamentariosConfirmados.length} confirmados (r2Path=${r2Path ?? "none"})`,
  );

  return {
    audiencias: filas.length,
    contrapartes,
    parlamentariosMarcados: parlamentariosConfirmados.length,
    confirmados: parlamentariosConfirmados.length,
    r2Path,
  };
}
