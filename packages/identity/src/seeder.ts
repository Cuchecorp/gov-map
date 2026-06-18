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

import type { Parlamentario } from "@obs/core";
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  type AllowlistOptions,
} from "@obs/ingest";
import { matchDeterminista } from "./deterministic";
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
 * Corre la siembra: fetch ambos catálogos, parsea, combina, y corre
 * `matchDeterminista` por fila contra la maestra combinada. Devuelve la maestra
 * (no persiste: la persistencia es `upsertMaestra`, separable y testeable).
 */
export async function runSeeder(deps: SeederDeps): Promise<Parlamentario[]> {
  const fechaCaptura = deps.fechaCaptura ?? new Date().toISOString();

  const senadoXml = await fetchCatalogo(SENADO_URL, deps);
  const camaraXml = await fetchCatalogo(CAMARA_URL, deps);

  const maestra: Parlamentario[] = [
    ...parseSenado(senadoXml, { fechaCaptura }),
    ...parseCamara(camaraXml, { fechaCaptura }),
  ];

  // Corre el matcher determinista sobre cada fila contra la propia maestra.
  // Fail-closed: sólo confirmaría un nombre ÚNICO en (cámara, periodo); aún así
  // la promoción a `confirmado` es compuerta humana, por lo que el seeder NO la
  // aplica al lote — deja `no_confirmado` y registra el resultado para auditoría.
  for (const row of maestra) {
    matchDeterminista(
      {
        nombreNormalizado: row.nombre_normalizado,
        camara: row.camara,
        periodo: row.periodo,
      },
      maestra,
    );
    // Estado inicial NO auto-confirmado (ID-01): la promoción la hace el operador.
    row.estado = "no_confirmado";
  }

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
