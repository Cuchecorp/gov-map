// connector-senado — fetch de la actividad legislativa del Senado (`web-back.senado.cl`)
// REUSANDO @obs/ingest. Análogo al CamaraConnector pero SIN header-set anti-Cloudflare:
// `web-back.senado.cl` es la API backend limpia (JSON, sin bot-management).
//
// ORDEN LOCKED (NO BaseConnector.run):
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host) → fetcher.get({url})
//
// Vía PREFERIDA (confirmada LIVE 06-CONTEXT):
//   citaciones: web-back.senado.cl/api/commissions_citations?limit=100  (ventana FORWARD-ONLY)
//   tabla sala: web-back.senado.cl/api/weekly_table?limit=100
// `web-back.senado.cl` es subdominio de `senado.cl` → cubierto por la allowlist SSRF (el test
// de este módulo lo afirma explícitamente, cerrando T-06-08 sin tocar @obs/ingest).
//
// FALLBACK documentado (NO se ejecuta por defecto): el portal SSR Next.js expone los mismos
// datos en `https://www.senado.cl/_next/data/{buildId}/...json`, con el `buildId` autodetectado
// del `<script id="__NEXT_DATA__">` (cambia por deploy → cachear ≤1 día). `fetchVia_NextData`
// queda como ruta explícita de respaldo si la API backend cae; el default usa la API.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  type AllowlistOptions,
} from "@obs/ingest";
import { RobotsDisallowError } from "./connector-camara";

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface SenadoActividadConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  allowlist?: AllowlistOptions;
}

const API_BASE = "https://web-back.senado.cl/api";
const PORTAL_BASE = "https://www.senado.cl";

/**
 * Conector de actividad del Senado: fetchea las citaciones de comisiones y la tabla semanal de
 * sala desde la API backend `web-back.senado.cl`, reusando @obs/ingest en el ORDEN LOCKED.
 */
export class SenadoActividadConnector {
  constructor(private readonly deps: SenadoActividadConnectorDeps) {}

  private async fetch(url: string): Promise<string> {
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (T-06-08)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (T-06-07)
    const body = await this.deps.fetcher.get({ url });
    return new TextDecoder().decode(body);
  }

  /** Fetch del JSON de citaciones de comisiones (ventana FORWARD-ONLY — sin histórico). */
  async fetchCitaciones(limit = 100): Promise<string> {
    return this.fetch(`${API_BASE}/commissions_citations?limit=${encodeURIComponent(limit)}`);
  }

  /** Fetch del JSON de la tabla semanal de sala (orden del día estructurado). */
  async fetchTablaSala(limit = 100): Promise<string> {
    return this.fetch(`${API_BASE}/weekly_table?limit=${encodeURIComponent(limit)}`);
  }

  /**
   * FALLBACK (NO usado por defecto): fetch del JSON `_next/data` del portal SSR. El `buildId`
   * cambia por deploy — el caller debe autodetectarlo del `<script id="__NEXT_DATA__">` de la
   * página (NO hardcodear) y cachearlo ≤1 día. Solo se invoca explícitamente si la API backend
   * cae; documentado para no perder la ruta de respaldo del RESEARCH.
   */
  async fetchVia_NextData(buildId: string, ruta: string): Promise<string> {
    // #27: defensa en profundidad (path traversal) — el allowlist es host-level, no
    // path-level. Rechaza `..` y exige que la URL final caiga bajo `${PORTAL_BASE}/_next/data/`.
    if (ruta.includes("..")) {
      throw new Error(`fetchVia_NextData: ruta inválida (path traversal): ${ruta}`);
    }
    const url = `${PORTAL_BASE}/_next/data/${encodeURIComponent(buildId)}/${ruta.replace(/^\//, "")}`;
    if (!url.startsWith(`${PORTAL_BASE}/_next/data/`)) {
      throw new Error(`fetchVia_NextData: URL fuera del prefijo permitido`);
    }
    return this.fetch(url);
  }
}
