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

/** Regex del boletín en texto libre (`Boletín N° 14309-04`). */
const RE_BOLETIN = /Bolet[íi]n N°\s*(\d+-\d+)/g;
/** Regex del boletín en nodo estructurado (`<Boletin>14309-04</Boletin>`). */
const RE_BOLETIN_NODO = /<Boletin>\s*(\d+-\d+)\s*<\/Boletin>/g;

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
   * Descubre boletines (con sufijo, p.ej. "14309-04") de una legislatura, recorriendo sus
   * sesiones (`getSesiones?prmLegislaturaId={leg}`) y, por cada sesión, las votaciones de su
   * detalle (`getSesionDetalle`/`getSesionBoletinXML`) en busca de nodos `<Boletin>` o del
   * texto libre `Boletín N° …`. Dedup, orden de aparición; `maxSesiones` acota el recorrido.
   *
   * NOTA (verificado LIVE 2026-06-18): el método `retornarVotacionesXAnno` que asumía RESEARCH
   * NO existe en este `.asmx` (500 "nombre de método no válido"). El descubrimiento por sesiones
   * es best-effort: si el WS no expone boletines por esa vía, devuelve []. La corrida acotada
   * soportada de forma robusta es vía `--boletines` explícitos (cross-cámara garantizado).
   */
  async descubrirBoletines(legislaturaId: number, maxSesiones = 10): Promise<string[]> {
    const vistos = new Set<string>();
    const out: string[] = [];
    const recolectar = (xml: string) => {
      for (const re of [RE_BOLETIN_NODO, RE_BOLETIN]) {
        for (const m of xml.matchAll(re)) {
          const bol = m[1];
          if (bol != null && !vistos.has(bol)) {
            vistos.add(bol);
            out.push(bol);
          }
        }
      }
    };

    const sesionesXml = await this.fetch(
      `${BASE}/getSesiones?prmLegislaturaId=${encodeURIComponent(String(legislaturaId))}`,
    );
    const sesionIds = [...sesionesXml.matchAll(/<ID>(\d+)<\/ID>/g)]
      .map((m) => m[1])
      .filter((x): x is string => x != null)
      .slice(0, maxSesiones);

    for (const sid of sesionIds) {
      try {
        const det = await this.fetch(
          `${BASE}/getSesionDetalle?prmSesionId=${encodeURIComponent(sid)}`,
        );
        recolectar(det);
      } catch {
        // sesión sin detalle accesible → se omite (best-effort, no aborta el descubrimiento).
      }
    }
    return out;
  }

  /** Fetch del XML de votaciones por boletín base (`getVotaciones_Boletin`). */
  async fetchVotacionesBoletin(boletinBase: string): Promise<string> {
    const url = `${BASE}/getVotaciones_Boletin?prmBoletin=${encodeURIComponent(boletinBase)}`;
    return this.fetch(url);
  }

  /**
   * Fetch del XML de detalle voto-a-voto por id de votación. El método REAL del WS es
   * `getVotacion_Detalle?prmVotacionId={id}` (ns tempuri.org) — verificado LIVE 2026-06-18.
   * (El `retornarVotacionDetalle` del fixture v1 de 05-02 NO existe en este .asmx: devuelve
   * 500 "nombre de método no válido"; `parseCamaraVotoDetalle` parsea AMBAS formas.)
   */
  async fetchVotacionDetalle(votacionId: string): Promise<string> {
    const url = `${BASE}/getVotacion_Detalle?prmVotacionId=${encodeURIComponent(votacionId)}`;
    return this.fetch(url);
  }
}
