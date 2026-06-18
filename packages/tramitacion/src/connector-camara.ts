// connector-camara — fetch de la Cámara (opendata.camara.cl) REUSANDO @obs/ingest.
//
// REUSA la política de @obs/ingest (rate-limit 2-3s + robots + UA identificatorio + SSRF
// allowlist) — NO `BaseConnector.run` (su caché diaria saltaría re-corridas LIVE del mismo
// día; anti-pattern de RESEARCH). El patrón de fetch es el LOCKED del seeder de Fase 3:
//
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host) → fetcher.get({url})
//
// El conector NO reimplementa la política: solo arma las URLs y ensambla los colaboradores.
//
// Descubrimiento de boletines (Leg 58): `retornarVotacionesXAnno?prmAnno={anno}` trae las
// votaciones del año; el boletín viene en texto libre dentro de `<Descripcion>` SOLO para
// proyectos de ley (regex `/Bolet[íi]n N°\s*(\d+-\d+)/`). Resoluciones/acuerdos no lo traen.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  type AllowlistOptions,
} from "@obs/ingest";

/** Error de robots.txt que prohíbe el fetch (no se reintenta acá; el caller decide). */
export class RobotsDisallowError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt prohíbe ${url}`);
    this.name = "RobotsDisallowError";
  }
}

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface CamaraConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validación SSRF (default: sufijos gubernamentales). */
  allowlist?: AllowlistOptions;
}

const BASE = "https://opendata.camara.cl/wscamaradiputados.asmx";

/** Regex del boletín en el texto libre de `<Descripcion>` (solo proyectos de ley lo traen). */
const RE_BOLETIN = /Bolet[íi]n N°\s*(\d+-\d+)/g;

/**
 * Conector de la Cámara: descubre boletines de una legislatura/año y fetchea las votaciones
 * por boletín + su detalle voto-a-voto. Reusa @obs/ingest en el ORDEN LOCKED.
 */
export class CamaraConnector {
  constructor(private readonly deps: CamaraConnectorDeps) {}

  /**
   * Fetch de UN recurso reusando la política de @obs/ingest:
   * assertAllowedUrl (SSRF + allowlist) → robots → rate-limit serial por host → fetcher.
   * Devuelve el body como string (XML). NUNCA `BaseConnector.run`.
   */
  private async fetch(url: string): Promise<string> {
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (T-05-12)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (T-05-11)
    const body = await this.deps.fetcher.get({ url });
    return new TextDecoder().decode(body);
  }

  /**
   * Descubre los boletines (base con sufijo, p.ej. "14309-04") votados en `anno`, extrayéndolos
   * del texto libre de `<Descripcion>` de `retornarVotacionesXAnno`. Dedup, orden de aparición.
   * Solo proyectos de ley traen boletín; resoluciones/acuerdos se ignoran naturalmente.
   */
  async descubrirBoletines(anno: number): Promise<string[]> {
    const url = `${BASE}/retornarVotacionesXAnno?prmAnno=${encodeURIComponent(String(anno))}`;
    const xml = await this.fetch(url);
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const m of xml.matchAll(RE_BOLETIN)) {
      const bol = m[1];
      if (bol != null && !vistos.has(bol)) {
        vistos.add(bol);
        out.push(bol);
      }
    }
    return out;
  }

  /** Fetch del XML de votaciones por boletín base (`getVotaciones_Boletin`). */
  async fetchVotacionesBoletin(boletinBase: string): Promise<string> {
    const url = `${BASE}/getVotaciones_Boletin?prmBoletin=${encodeURIComponent(boletinBase)}`;
    return this.fetch(url);
  }

  /** Fetch del XML de detalle voto-a-voto por id de votación (`retornarVotacionDetalle`). */
  async fetchVotacionDetalle(votacionId: string): Promise<string> {
    const url = `${BASE}/retornarVotacionDetalle?prmVotacionID=${encodeURIComponent(votacionId)}`;
    return this.fetch(url);
  }
}
