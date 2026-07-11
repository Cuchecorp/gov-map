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
import { parseCamaraLegislativo } from "./parse-camara-legislativo";

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

/**
 * WS de LEGISLATIVO (enumeración histórica de proyectos por año). Verificado LIVE 2026-07-10:
 * `retornarMocionesXAnno?prmAnno={año}` + `retornarMensajesXAnno?prmAnno={año}` devuelven
 * `<ProyectosLeyColeccion><ProyectoLey><NumeroBoletin>`. NOTA: el WS de VOTACIONES devuelve [] al
 * enumerar por año (anti-patrón conocido) — WSLegislativo es la fuente correcta para el histórico.
 */
const BASE_LEG =
  "https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx";

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
      } catch (e) {
        // sesión sin detalle accesible → se omite (best-effort, no aborta el descubrimiento).
        // #20: se loguea — antes el catch vacío tragaba también RobotsDisallow/SSRF/red sin
        // rastro; los fatales ya abortan el fetch, pero el evento debe ser observable.
        console.warn(
          `[connector-camara] getSesionDetalle ${sid} omitido:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    return out;
  }

  /**
   * Enumera los `NumeroBoletin` (mociones + mensajes) INGRESADOS en un año vía WSLegislativo.asmx.
   * Reusa la política LOCKED de @obs/ingest (`this.fetch`: SSRF allowlist → robots → rate-limit
   * 2-3s → fetcher) — NO hand-roll. El año se valida (V5, no basura al WS gob) y se
   * `encodeURIComponent`. Best-effort por op: un fallo de una op NO aborta la otra (se loguea).
   * El XML se pasa a `parseCamaraLegislativo` (zod-validado). Devuelve los boletines deduplicados.
   *
   * La lista resultante alimenta el camino existente `run-tramitacion-prod-cli --boletines`
   * (P03). Este método NO ingiere: solo enumera.
   */
  async enumerarProyectosXAnno(anno: number): Promise<string[]> {
    if (!Number.isInteger(anno) || anno < 1990 || anno > 2100) {
      throw new Error(`anno inválido: ${anno} (esperado entero 1990..2100)`); // V5 / T-63-06
    }
    const out = new Set<string>();
    const ops = ["retornarMocionesXAnno", "retornarMensajesXAnno"] as const;
    let fallos = 0;
    for (const op of ops) {
      const url = `${BASE_LEG}/${op}?prmAnno=${encodeURIComponent(String(anno))}`;
      try {
        const xml = await this.fetch(url); // política LOCKED (T-63-04/T-63-05)
        for (const b of parseCamaraLegislativo(xml)) out.add(b); // zod-validado (T-63-07)
      } catch (e) {
        // Best-effort POR OP: la otra op sigue. Se LOGUEA (nunca catch mudo → observable).
        fallos++;
        console.warn(
          `[connector-camara] enumerarProyectosXAnno ${op} ${anno} omitido:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    // WR-04: si AMBAS ops fallaron (red caída / WAF / robots fail-closed) el año NO es
    // "vacío": es un fallo TOTAL. Lanzar hace la señal AUDIBLE — el CLI lo cuenta en
    // `errores` y sale con exit 1, en vez de imprimir "0 boletines" y salir 0 (lo que un
    // operador leería como "no hay proyectos" y se saltaría el backfill). Best-effort por op
    // sí; best-effort por año con señal muerta no.
    if (fallos === ops.length) {
      throw new Error(`enumerarProyectosXAnno ${anno}: ambas ops fallaron`);
    }
    return [...out];
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
