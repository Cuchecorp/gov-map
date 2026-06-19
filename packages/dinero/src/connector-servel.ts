// connector-servel — fetch del .xlsx de SERVEL (Azure Blob repodocgastoelectoral.blob.core.windows.net)
// REUSANDO @obs/ingest en el ORDEN LOCKED — NO `BaseConnector.run` (su cache diaria saltaria re-corridas):
//
//   assertAllowedUrl(url, {extraHosts:[SERVEL_HOST]}) -> assercion https explicita
//     -> robots.isAllowed(url) -> rateLimiter.wait(host) -> fetcher.get({ url, headers: HEADERS_SERVEL })
//
// El host SERVEL va como `extraHosts` EXACTO scoped al conector (allowlist.ts:116-123). NUNCA se agrega a
// DEFAULT_ALLOWED_SUFFIXES (ampliaria SSRF a TODO tenant Azure). CAVEAT: extraHosts admite TAMBIEN http;
// SERVEL es https-only -> se agrega una assercion `u.protocol === "https:"` para ese host.
//
// La fuente es publica (GET anonimo): NO hay ticket/secreto por request (a diferencia de ChileCompra).
// Anclas de drift/idempotencia: ETag, Content-MD5 (base64), Last-Modified, Content-Length (byte-length)
// se capturan de un HEAD opcional + el byte-length REAL se mide sobre los bytes recibidos.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  FetchError,
  RetryableError,
  HostNotAllowedError,
  type AllowlistOptions,
} from "@obs/ingest";

/** Host EXACTO del repositorio de gasto electoral de SERVEL (Azure Blob, GET anonimo). */
export const SERVEL_HOST = "repodocgastoelectoral.blob.core.windows.net";

/** Error de robots.txt que prohibe el fetch (el caller decide; no se reintenta aca). */
export class RobotsDisallowError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt prohibe ${url}`);
    this.name = "RobotsDisallowError";
  }
}

/**
 * Error de bloqueo de SERVEL (HTTP 403/503/429 — rate-limit o indisponibilidad del blob). `ingest-run`
 * lo reconoce para degradar honestamente ESA eleccion sin abortar la corrida (espejo de
 * `ChileCompraBloqueadaError`). NUNCA incluye secretos (la fuente no tiene ticket).
 */
export class ServelBloqueadaError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`SERVEL bloqueo el fetch (HTTP ${status})`);
    this.name = "ServelBloqueadaError";
  }
}

/**
 * Anclas capturadas de la respuesta/HEAD del .xlsx: para idempotencia (key versionada) y la
 * reconciliacion de completitud (Content-MD5 + byte-length).
 */
export interface AnclasDescarga {
  /** ETag declarado por el blob, o null. */
  etag: string | null;
  /** Content-MD5 declarado (base64), o null si el HEAD no lo expone. */
  contentMd5: string | null;
  /** Last-Modified declarado, o null. */
  lastModified: string | null;
  /** Content-Length declarado (byte-length), o null. */
  contentLength: number | null;
}

/** Resultado de la descarga: los BYTES del .xlsx + las anclas + el byte-length REAL medido. */
export interface DescargaServel {
  bytes: Uint8Array;
  /** byte-length REAL de lo recibido (medido sobre los bytes). */
  byteLength: number;
  anclas: AnclasDescarga;
}

/**
 * `headFn` inyectable: hace un HEAD al .xlsx para capturar ETag/Content-MD5/Last-Modified/Content-Length.
 * El `Fetcher` de @obs/ingest devuelve solo `Uint8Array` (sin headers), por eso el HEAD va aparte. En
 * tests se inyecta un fake; en LIVE el default usa `fetch` global con method HEAD.
 */
export type HeadFn = (url: string) => Promise<AnclasDescarga>;

/** HEAD real (LIVE): captura las anclas de los headers de respuesta. NUNCA descarga el body. */
async function headReal(url: string): Promise<AnclasDescarga> {
  const res = await fetch(url, { method: "HEAD", headers: { ...HEADERS_SERVEL } });
  if (!res.ok) {
    // Un HEAD que falla NO aborta: devolvemos anclas nulas (la completitud usara lo que haya).
    return { etag: null, contentMd5: null, lastModified: null, contentLength: null };
  }
  const cl = res.headers.get("content-length");
  return {
    etag: res.headers.get("etag"),
    contentMd5: res.headers.get("content-md5"),
    lastModified: res.headers.get("last-modified"),
    contentLength: cl != null && cl !== "" ? Number(cl) : null,
  };
}

/** Colaboradores inyectables (reuso de la politica de @obs/ingest). */
export interface ServelConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist base para la validacion SSRF. El host SERVEL se agrega como extraHosts en `descargar`. */
  allowlist?: AllowlistOptions;
  /** HEAD inyectable (tests). Default: HEAD real via fetch global. */
  headFn?: HeadFn;
}

/**
 * Header-set para el blob de SERVEL. UA identificatorio `Bot-Ciudadano/1.0` (ingesta respetuosa).
 * `Accept` del content-type de spreadsheet.
 */
export const HEADERS_SERVEL: Readonly<Record<string, string>> = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
  Accept:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream;q=0.9",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
});

/**
 * Conector del .xlsx de SERVEL. Fetchea los BYTES crudos reusando @obs/ingest en el ORDEN LOCKED.
 * NUNCA `BaseConnector.run`. El host es EXACTO via extraHosts; https forzado.
 */
export class ServelConnector {
  private readonly headFn: HeadFn;

  constructor(private readonly deps: ServelConnectorDeps) {
    this.headFn = deps.headFn ?? headReal;
  }

  /** Allowlist efectiva: la base del caller + el host SERVEL como extraHost EXACTO. */
  private allowlistConServel(): AllowlistOptions {
    const base = this.deps.allowlist ?? {};
    const extra = new Set([...(base.extraHosts ?? []), SERVEL_HOST]);
    return { ...base, extraHosts: [...extra] };
  }

  /**
   * Descarga el .xlsx de UNA eleccion en el ORDEN LOCKED EXACTO. Devuelve los bytes + las anclas. Un
   * 403/503/429 se relanza como `ServelBloqueadaError` (degradacion honesta).
   */
  async descargar(url: string): Promise<DescargaServel> {
    // 1. SSRF + allowlist (host SERVEL EXACTO via extraHosts). assertAllowedUrl lanza con la URL cruda;
    //    se captura para sanear (la fuente no tiene secreto, pero no se filtra la URL cruda en errores).
    let parsed: URL;
    try {
      parsed = assertAllowedUrl(url, this.allowlistConServel());
    } catch (err) {
      if (err instanceof HostNotAllowedError) {
        throw new Error(`SERVEL host no permitido: ${urlSinQuery(url)}`);
      }
      throw err;
    }

    // 2. ASSERCION https EXPLICITA para SERVEL_HOST: extraHosts admite http; SERVEL es https-only.
    if (parsed.protocol !== "https:") {
      throw new Error(`SERVEL requiere https (recibido ${parsed.protocol}): ${urlSinQuery(url)}`);
    }

    // 3. robots.txt.
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(urlSinQuery(url));

    // 4. rate-limit 2-3s serial por host (LOCKED).
    await this.deps.rateLimiter.wait(parsed.host);

    // 5. HEAD para anclas (best-effort; no aborta si falla) + GET de los bytes.
    let anclas: AnclasDescarga;
    try {
      anclas = await this.headFn(url);
    } catch {
      anclas = { etag: null, contentMd5: null, lastModified: null, contentLength: null };
    }

    try {
      const bytes = await this.deps.fetcher.get({ url, headers: { ...HEADERS_SERVEL } });
      return { bytes, byteLength: bytes.byteLength, anclas };
    } catch (err) {
      // 403 -> FetchError; 429/503 -> RetryableError. Degradacion honesta sin filtrar la URL cruda.
      if (err instanceof FetchError) {
        throw new ServelBloqueadaError(urlSinQuery(url), err.status);
      }
      if (err instanceof RetryableError) {
        throw new ServelBloqueadaError(urlSinQuery(url), err.status);
      }
      throw err;
    }
  }
}

/** Saneo del URL para los mensajes de error: corta la querystring (SAS tokens del blob, etc.). */
function urlSinQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}
