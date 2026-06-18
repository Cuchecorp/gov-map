/**
 * seeder — orquesta la siembra idempotente de la maestra `parlamentario`.
 *
 * Flujo: fetch (REUSANDO `@obs/ingest`: assertAllowedUrl → robots → rate-limit → fetcher)
 *   → parseSenado/parseCamara → matchDeterminista → upsert por clave natural.
 *
 * NO usa `BaseConnector.run`: su caché diaria saltaría re-siembras del mismo día
 * (anti-pattern de 03-RESEARCH). La idempotencia vive en la clave natural del upsert
 * (`parlid_senado` / `id_diputado_camara`), no en una caché de día.
 *
 * El `estado` inicial es `no_confirmado`: `matchDeterminista` corre sobre la propia maestra
 * combinada, pero la promoción a `confirmado` es revisión humana (compuerta ID-01). Como los
 * catálogos no traen RUT y un nombre puede repetirse, fail-closed deja casi todo en
 * `no_confirmado`; el seeder NUNCA auto-confirma un lote sembrado.
 *
 * Política de fetch (rate-limit 2-3s, robots, UA, SSRF) NO se reimplementa: se reusa
 * `@obs/ingest` (T-03-07/T-03-08).
 */

import { type Parlamentario, normalizarNombre } from "@obs/core";
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  type AllowlistOptions,
} from "@obs/ingest";
import { matchDeterminista, type MaestraRow, type Resolution } from "./deterministic";
import { parseSenado, SENADO_URL } from "./parse-senado";
import { parseCamara, CAMARA_URL } from "./parse-camara";

/** Colaboradores inyectables (reuso de la política de `@obs/ingest`). */
export interface SeederDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validación SSRF (default: sufijos gubernamentales). */
  allowlist?: AllowlistOptions;
  /** ISO de captura (default: now). Inyectable para tests deterministas. */
  fechaCaptura?: string;
}

/** Writer inyectable: upsert por clave natural. El writer real (Supabase) lo cablea Plan 04. */
export interface MaestraWriter {
  upsert(rows: Parlamentario[]): Promise<void>;
}

/** Error de robots.txt que prohíbe el fetch (no se reintenta acá). */
export class RobotsDisallowError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt prohíbe ${url}`);
    this.name = "RobotsDisallowError";
  }
}

/**
 * Fetch de UN catálogo reusando la política de `@obs/ingest`:
 * assertAllowedUrl (SSRF deny-by-default) → robots → rate-limit serial por host → fetcher.
 */
async function fetchCatalogo(url: string, deps: SeederDeps): Promise<string> {
  const parsed = assertAllowedUrl(url, deps.allowlist); // SSRF + allowlist (T-03-07)
  if (!(await deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
  await deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (T-03-08)
  const body = await deps.fetcher.get({ url });
  return new TextDecoder().decode(body);
}

/**
 * Deriva la `clave_estricta` (paterno + materno + nombres, vía `normalizarNombre`) de una
 * fila de la maestra. A diferencia de `nombre_normalizado`, INCLUYE el materno → permite el
 * desempate de homónimos del self-match del catálogo (WR-01).
 */
export function derivarClaveEstricta(row: Parlamentario): string {
  return normalizarNombre({
    nombres: row.nombres,
    apellidoPaterno: row.apellido_paterno,
    apellidoMaterno: row.apellido_materno,
  }).clave_estricta;
}

/** Maestra ampliada con la `clave_estricta` por fila (entrada del matcher para WR-01). */
export function conClaveEstricta(maestra: Parlamentario[]): MaestraRow[] {
  return maestra.map((row) => ({ ...row, clave_estricta: derivarClaveEstricta(row) }));
}

/**
 * Reconciliación determinista de la maestra contra SÍ MISMA (self-match del catálogo).
 * PURA. Corre `matchDeterminista` por fila con la clave estricta (WR-01) y devuelve la
 * Resolution por `id` (IN-01: NO se descarta — es la fuente que GATEA la promoción de
 * registros que no provienen directamente del catálogo de vigentes). NO muta `estado`.
 */
export function reconciliarMaestra(
  maestra: Parlamentario[],
): Map<string, Resolution> {
  const conClave = conClaveEstricta(maestra);
  const audit = new Map<string, Resolution>();
  for (const row of conClave) {
    const res = matchDeterminista(
      {
        nombreNormalizado: row.nombre_normalizado,
        claveEstricta: row.clave_estricta,
        camara: row.camara,
        periodo: row.periodo,
      },
      conClave,
    );
    audit.set(row.id, res);
  }
  return audit;
}

/**
 * REGLA EXPLÍCITA "seed-from-authoritative-vigentes-catalog" (CR-01, fuente de confirmación (a)).
 *
 * Una fila que proviene DIRECTAMENTE del catálogo oficial de miembros vigentes
 * (Senado `senadores_vigentes` / Cámara `retornarDiputadosPeriodoActual`) es, POR DEFINICIÓN,
 * un miembro ACTUAL confirmado: el catálogo autoritativo del propio órgano es la prueba de
 * vigencia. Esta es la única confirmación masiva legítima, y se encoda como una regla AUDITABLE
 * (predicado por `origen`), NO como un `for (row) estado="confirmado"` ciego.
 *
 * Devuelve el conjunto de `id` confirmables por esta regla. NO confirma identidades de
 * registros FORÁNEOS (votación/InfoProbidad) — esos pasan por `reconciliarMaestra` + revisión
 * humana (Fase 4). Que un nombre sea homónimo dentro del catálogo NO invalida la vigencia del
 * miembro (sigue siendo un miembro actual real); solo afecta la reconciliación de menciones
 * externas, que es un problema distinto y diferido.
 */
const ORIGENES_VIGENTES = new Set(["senado", "diputados"]);

export function vigentesDeCatalogo(maestra: Parlamentario[]): Set<string> {
  const ids = new Set<string>();
  for (const row of maestra) {
    if (ORIGENES_VIGENTES.has(row.origen)) ids.add(row.id);
  }
  return ids;
}

/**
 * Corre la siembra: fetch ambos catálogos, parsea, combina. Devuelve la maestra con
 * `estado` inicial `no_confirmado` (el seeder NUNCA auto-confirma un lote — ID-01). La
 * reconciliación (`reconciliarMaestra`) y la confirmación de vigentes (`vigentesDeCatalogo`)
 * son pasos EXPLÍCITOS y separados que el operador/CLI invoca con intención, no efectos
 * laterales de la siembra. No persiste: la persistencia es `upsertMaestra`.
 */
export async function runSeeder(deps: SeederDeps): Promise<Parlamentario[]> {
  const fechaCaptura = deps.fechaCaptura ?? new Date().toISOString();

  const senadoXml = await fetchCatalogo(SENADO_URL, deps);
  const camaraXml = await fetchCatalogo(CAMARA_URL, deps);

  const maestra: Parlamentario[] = [
    ...parseSenado(senadoXml, { fechaCaptura }),
    ...parseCamara(camaraXml, { fechaCaptura }),
  ];

  // Estado inicial NO auto-confirmado (ID-01): la promoción es un paso explícito posterior.
  for (const row of maestra) row.estado = "no_confirmado";

  return maestra;
}

/**
 * Upsert idempotente por clave natural. Correr 2× con el mismo input deja el mismo
 * estado (el writer hace upsert por `parlid_senado`/`id_diputado_camara`, no insert).
 */
export async function upsertMaestra(
  rows: Parlamentario[],
  writer: MaestraWriter,
): Promise<void> {
  await writer.upsert(rows);
}
