/**
 * Helpers de test para @obs/ingest: mock fetch configurable y utilidades
 * para los tests unitarios sin red. Los fake timers se manejan via la API
 * `vi.useFakeTimers()` de vitest directamente en cada test.
 */

/** Respuesta minima que el mockFetch devuelve. */
export interface MockResponseSpec {
  status: number;
  /** Cuerpo crudo (string -> se codifica a Uint8Array, o bytes directos). */
  body?: string | Uint8Array;
  /** Headers de respuesta opcionales (p.ej. ETag). */
  headers?: Record<string, string>;
}

/** Registro de cada llamada capturada por el mockFetch. */
export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
}

export interface MockFetch {
  /** Implementacion compatible con `fetch` para inyectar en colaboradores. */
  fn: typeof fetch;
  /** Todas las requests capturadas, en orden. */
  calls: CapturedRequest[];
}

function normalizeHeaders(init?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  const h = new Headers(init);
  h.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function toBytes(body?: string | Uint8Array): Uint8Array {
  if (body === undefined) return new Uint8Array();
  if (typeof body === "string") return new TextEncoder().encode(body);
  return body;
}

/**
 * Crea un fetch mock dirigido por un mapa `url -> MockResponseSpec`.
 * URLs no mapeadas devuelven 404. Captura cada request para asserts de orden.
 */
export function makeMockFetch(routes: Record<string, MockResponseSpec>): MockFetch {
  const calls: CapturedRequest[] = [];

  const fn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const isRequest = typeof Request !== "undefined" && input instanceof Request;
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    // Cuando se pasa un Request firmado (aws4fetch), method/headers viven en el
    // Request, no en `init`. Soportar ambos.
    const method = (init?.method ?? (isRequest ? input.method : "GET")).toUpperCase();
    const headers = isRequest
      ? normalizeHeaders(input.headers)
      : normalizeHeaders(init?.headers);
    calls.push({ url, method, headers, body: init?.body ?? null });

    const spec = routes[url];
    if (!spec) {
      return new Response("not found", { status: 404 });
    }
    const bytes = toBytes(spec.body);
    return new Response(bytes, { status: spec.status, headers: spec.headers });
  }) as typeof fetch;

  return { fn, calls };
}
