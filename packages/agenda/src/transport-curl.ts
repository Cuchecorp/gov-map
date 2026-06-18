// transport-curl — transporte HTTP que delega en el binario `curl` para PASAR el
// bot-management de Cloudflare de `www.camara.cl` (WR-03).
//
// PROBLEMA (06-CONTEXT / WR-03): el `fetch` de Deno/Node recibe HTTP 403 de
// Cloudflare aunque envíe el header-set de navegador correcto — CF hace
// fingerprinting de TLS/JA3 + HTTP/2, no sólo de headers. `curl` (con
// --compressed y el header-set de navegador) SÍ pasó en la captura de 06-01.
//
// SOLUCIÓN: un transporte con la MISMA forma que `fetch` (subconjunto que el
// `Fetcher` de @obs/ingest consume: `.ok`, `.status`, `.arrayBuffer()`), que
// shellea a `curl`. Se inyecta detrás de la interfaz `Fetcher` (vía `fetchFn`)
// SÓLO para el conector de Cámara; el resto de hosts sigue usando el fetch
// nativo. Si `curl` no está disponible, lanza `CurlUnavailableError` para que el
// caller degrade con gracia (browseros como ruta de operador — ver backlog).

import { spawn } from "node:child_process";

/** `curl` no está en el PATH (o no es ejecutable): el caller debe degradar. */
export class CurlUnavailableError extends Error {
  constructor(readonly cause?: unknown) {
    super("curl no está disponible en el entorno de ejecución");
    this.name = "CurlUnavailableError";
  }
}

/** Respuesta mínima compatible con lo que el `Fetcher` consume de `fetch`. */
interface CurlResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CurlTransportOptions {
  /** Ruta/binario de curl. Default: "curl". */
  curlBin?: string;
  /** Timeout total por request (segundos) que se pasa a `--max-time`. Default 30. */
  maxTimeSec?: number;
  /** spawn inyectable (tests). Default: node:child_process spawn. */
  spawnFn?: typeof spawn;
}

/**
 * Construye un transporte `fetch`-compatible respaldado por `curl`. Sólo soporta
 * lo que el `Fetcher` necesita: método GET con headers, body crudo, status.
 *
 * - `--compressed`: acepta gzip/br (como un navegador real).
 * - `-L`: sigue redirecciones (Cloudflare puede 301/302).
 * - `-sS`: silencioso pero muestra errores.
 * - `-w "\n%{http_code}"`: emite el status al final de stdout para parsearlo sin
 *   depender del exit code de curl (que es 0 incluso en 403/404).
 * - El body se devuelve como bytes crudos (no se asume texto).
 */
export function createCurlTransport(
  opts: CurlTransportOptions = {},
): (url: string, init?: RequestInit) => Promise<CurlResponse> {
  const curlBin = opts.curlBin ?? "curl";
  const maxTime = String(opts.maxTimeSec ?? 30);
  const spawnFn = opts.spawnFn ?? spawn;

  // Marcador improbable en HTML; separa el body del status que `-w` añade.
  const STATUS_MARKER = "\n__CURL_HTTP_STATUS__:";

  return function curlFetch(url: string, init: RequestInit = {}): Promise<CurlResponse> {
    const headers: string[] = [];
    const h = init.headers as Record<string, string> | undefined;
    if (h) {
      for (const [k, v] of Object.entries(h)) {
        headers.push("-H", `${k}: ${v}`);
      }
    }
    const args = [
      "-sS",
      "--compressed",
      "-L",
      "--max-time",
      maxTime,
      "-w",
      `${STATUS_MARKER}%{http_code}`,
      ...headers,
      url,
    ];

    return new Promise<CurlResponse>((resolve, reject) => {
      let child;
      try {
        child = spawnFn(curlBin, args);
      } catch (err) {
        reject(new CurlUnavailableError(err));
        return;
      }

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      child.stdout?.on("data", (d: Buffer) => chunks.push(d));
      child.stderr?.on("data", (d: Buffer) => errChunks.push(d));

      child.on("error", (err: NodeJS.ErrnoException) => {
        // ENOENT = curl no existe → el caller degrada (browseros/backlog).
        if (err.code === "ENOENT") {
          reject(new CurlUnavailableError(err));
        } else {
          reject(err);
        }
      });

      child.on("close", (code: number | null) => {
        const out = Buffer.concat(chunks);
        // Localiza el marcador de status al final del stdout.
        const markerBytes = Buffer.from(STATUS_MARKER, "utf8");
        const idx = out.lastIndexOf(markerBytes);
        if (idx === -1) {
          // Sin status → fallo de transporte (curl no produjo la salida esperada).
          const stderr = Buffer.concat(errChunks).toString("utf8").trim();
          reject(
            new Error(
              `curl no devolvió status (exit ${code})${stderr ? `: ${stderr}` : ""}`,
            ),
          );
          return;
        }
        const body = out.subarray(0, idx);
        const statusStr = out.subarray(idx + markerBytes.length).toString("utf8").trim();
        const status = Number.parseInt(statusStr, 10);
        if (!Number.isFinite(status) || status === 0) {
          reject(new Error(`curl status inválido: "${statusStr}" (exit ${code})`));
          return;
        }
        resolve({
          ok: status >= 200 && status < 300,
          status,
          arrayBuffer: async () =>
            body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
  };
}
