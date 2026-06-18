/**
 * Helpers de test para @obs/llm: mock fetch configurable para respuestas
 * chat-completions sin red. Espeja el contrato de `packages/ingest/test/_helpers.ts`,
 * con `body` como string JSON (en vez de bytes crudos) — las APIs OpenAI-compatibles
 * responden JSON. Captura cada request en `calls` para asserts de orden/repair.
 */

/** Respuesta minima que el mockFetch devuelve. */
export interface MockResponseSpec {
  status: number;
  /** Cuerpo de respuesta como string JSON. */
  body?: string;
  /** Headers de respuesta opcionales. */
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

/**
 * Crea un fetch mock dirigido por un mapa `url -> MockResponseSpec`.
 * URLs no mapeadas devuelven 404. Captura cada request para asserts de orden/repair.
 *
 * Una `MockResponseSpec[]` (array) permite respuestas secuenciales para la misma
 * URL (1a llamada invalida -> repair -> 2a llamada valida): cada call consume el
 * siguiente spec; al agotarse se repite el ultimo.
 */
export function makeMockFetch(
  routes: Record<string, MockResponseSpec | MockResponseSpec[]>,
): MockFetch {
  const calls: CapturedRequest[] = [];
  const cursors: Record<string, number> = {};

  const fn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const isRequest = typeof Request !== "undefined" && input instanceof Request;
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const method = (init?.method ?? (isRequest ? input.method : "GET")).toUpperCase();
    const headers = isRequest
      ? normalizeHeaders(input.headers)
      : normalizeHeaders(init?.headers);
    calls.push({ url, method, headers, body: init?.body ?? null });

    const entry = routes[url];
    if (entry === undefined) {
      return new Response("not found", { status: 404 });
    }
    let spec: MockResponseSpec;
    if (Array.isArray(entry)) {
      const i = cursors[url] ?? 0;
      spec = entry[Math.min(i, entry.length - 1)]!;
      cursors[url] = i + 1;
    } else {
      spec = entry;
    }
    // Las respuestas de APIs OpenAI-compatibles son JSON; el SDK openai solo
    // parsea el body si el content-type lo declara. Default a application/json
    // (overridable via spec.headers) para que el SDK devuelva el objeto parseado.
    const responseHeaders: Record<string, string> = {
      "content-type": "application/json",
      ...(spec.headers ?? {}),
    };
    return new Response(spec.body ?? "", {
      status: spec.status,
      headers: responseHeaders,
    });
  }) as typeof fetch;

  return { fn, calls };
}
