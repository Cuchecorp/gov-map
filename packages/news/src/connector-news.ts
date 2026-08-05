/**
 * NewsConnector — Etapa 1 de la ingesta de RSS de prensa (D-132-A/B/C).
 *
 * Extiende `BaseConnector<RssRaw>` e implementa EXCLUSIVAMENTE los tres hooks
 * (`endpoints`, `validateShape`, `fingerprint`). El orden LOCKED
 * (cache -> robots -> rate-limit -> fetch -> drift -> R2 -> snapshot) vive
 * ENTERO en `BaseConnector.run()` y NO se sobreescribe aquí (D-08):
 * reimplementar rate-limit/robots/R2 en este archivo sería una regresión de
 * régimen. Si en algún momento hiciera falta tocar `run()` o `@obs/ingest`,
 * la orden es PARAR y escalar (D-132-B ya adjudicó que el framework no se
 * toca en esta fase).
 *
 * `fingerprint` es ESTRUCTURAL (D-132-C): el set ordenado y deduplicado de
 * nombres de tag del XML, NUNCA los bytes crudos. Los 5 feeds emiten
 * `<lastBuildDate>` (y similares) que cambian en cada corrida; un
 * fingerprint sobre el contenido dispararía `drift.alert` en cada corrida
 * (ruido puro) sin detectar lo que el drift existe para detectar: un cambio
 * de FORMA de la fuente (tags que aparecen/desaparecen).
 *
 * `buildNewsDeps` es la fábrica que ensambla `ConnectorDeps` con la
 * allowlist scoped de prensa (`allowlistNews()`) inyectada TANTO en
 * `Fetcher` como en `RobotsGuard` — sin la allowlist en el guard,
 * `RobotsGuard` gatea su propio GET de `robots.txt` contra `{}` (vacía) y
 * los 5 feeds saldrían `[skip]` silenciosamente (Pitfall 1, 132-RESEARCH.md).
 * `fetchFn` es inyectable EXCLUSIVAMENTE para testabilidad sin red: en
 * producción se omite y se usa el fetch global. PROHIBIDO usarlo para
 * inyectar headers de navegador o para saltarse el guard.
 */
import {
  BaseConnector,
  DailyCache,
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  sha256Hex,
  type ConnectorDeps,
  type RequestSpec,
} from "@obs/ingest";
import type { AllowlistOptions } from "@obs/ingest";
import { FEEDS, type FeedDef } from "./feeds";
import { allowlistNews, assertFeedUrl } from "./allowlist-news";
import { SupabaseSnapshotLookup } from "./snapshot-lookup-supabase";

/** Forma cruda del RSS: el XML como string (shape-guard SUAVE, sin zod). */
export type RssRaw = { xml: string };

export class NewsConnector extends BaseConnector<RssRaw> {
  protected sourceId = "news";

  /**
   * `feeds` inyectable (WR-01): permite `--feeds <slug>` pedir un subconjunto SIN filtrar
   * después los `refs` resultantes (el subconjunto viaja al conector, no se filtra después).
   * Default: los 5 feeds congelados (`FEEDS`).
   */
  constructor(
    deps: ConnectorDeps,
    private readonly feeds: readonly FeedDef[] = FEEDS,
  ) {
    super(deps);
  }

  /**
   * Un endpoint por feed, cada uno con `resource` ÚNICO (Pattern 2).
   * `assertFeedUrl` (WR-07) vive en el camino REAL, no solo en su propio test: un feed
   * `http://` (o fuera de la allowlist scoped) lanza ANTES de que exista un `RequestSpec`.
   */
  protected endpoints(): RequestSpec[] {
    return this.feeds.map((f) => {
      assertFeedUrl(f.url);
      return {
        url: f.url,
        resource: `rss-${f.slug}`,
        key: f.slug,
        ext: "xml",
      };
    });
  }

  /**
   * Shape-guard SUAVE sobre string. `decodeJson` (BaseConnector) entrega un
   * string cuando el body no es JSON — que es siempre el caso para RSS/XML.
   * El zod ESTRICTO vive en Etapa 2 (D-10); aquí solo se descarta lo que
   * claramente no es un feed RSS 2.0 con items.
   *
   * WR-14: Atom (`<feed>`) YA NO se acepta — el parser de Etapa 2 (`parse-rss.ts`) solo
   * entiende `rss.channel.item`; aceptar Atom acá era un contrato contradictorio que solo se
   * descubría más tarde, en el parseo. Alcance acotado (ver cabecera del archivo): un feed que
   * no valida sigue abortando la corrida completa vía `BaseConnector.run()` — eso exigiría
   * tocar `@obs/ingest`, prohibido por D-132-B.
   */
  protected validateShape(body: unknown): RssRaw {
    if (typeof body !== "string") {
      throw new Error("news: body no es string (se esperaba XML crudo)");
    }
    if (!/<rss[\s>]/i.test(body)) {
      throw new Error(
        "news: no es RSS 2.0 (se esperaba <rss>; Atom y otros formatos no se aceptan)",
      );
    }
    if (!/<item[\s>]/i.test(body)) {
      throw new Error("news: RSS sin <item> (feed vacío o malformado)");
    }
    return { xml: body };
  }

  /**
   * Fingerprint ESTRUCTURAL (D-132-C): set ordenado y deduplicado de nombres
   * de tag presentes en el XML. Jamás sobre los bytes crudos — ver cabecera.
   */
  protected fingerprint(raw: RssRaw): Promise<string> {
    const tags = [
      ...new Set([...raw.xml.matchAll(/<([a-zA-Z0-9:_-]+)[\s>/]/g)].map((m) => m[1]!)),
    ]
      .sort()
      .join(",");
    return sha256Hex(new TextEncoder().encode(tags));
  }
}

/** Opciones de `buildNewsDeps`: overrides parciales de `ConnectorDeps` + config propia. */
export type BuildNewsDepsOptions = Partial<ConnectorDeps> & {
  /** Allowlist para Fetcher Y RobotsGuard. Default: `allowlistNews()`. */
  allowlist?: AllowlistOptions;
  /** fetch inyectable para tests sin red. Default: el fetch global. */
  fetchFn?: typeof fetch;
  /** Intervalo mínimo del rate-limiter en ms. Default 2500 (régimen 2-3s). */
  minIntervalMs?: number;
  /**
   * `sleepFn`/`nowFn` (WR-03, test-only): inyectables para que el test del gate cross-host sea
   * determinista y rápido (sin esperar `minIntervalMs` real). Default: `setTimeout`/`Date.now`
   * reales — PROHIBIDO inyectar otra cosa en producción.
   */
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
  /**
   * Credenciales para construir el `DailyCache` real de producción (CR-01) cuando no se
   * inyecta `cache` explícitamente. Ver `SupabaseSnapshotLookup`. `client` es SOLO para tests
   * que necesitan ejercitar este camino de construcción sin red (doble estructural).
   */
  supabase?: { url: string; serviceKey: string; client?: ConstructorParameters<typeof SupabaseSnapshotLookup>[0]["client"] };
};

/**
 * Gate global cross-host (WR-03, D-132-B): envuelve el `rateLimiter` (construido o inyectado
 * por `overrides`) con un piso de `minIntervalMs` COMPARTIDO entre hosts — `HostRateLimiter`
 * solo serializa POR host, así que con 5 hosts distintos ninguno paga el delay por sí solo
 * (ese es justo el hueco que este gate cierra). Vive acá y no en `@obs/ingest` porque el
 * framework compartido está LOCKED en esta fase (D-132-B): el 2-3 s/host del framework sigue
 * siendo la autoridad por host, este gate agrega el piso cross-host que pide el SC1. Replica el
 * patrón `sleep(3000)` explícito de `probe-feeds.ts`, que ya resolvió el mismo problema fuera
 * del framework.
 */
function gateRateLimiter(
  rl: ConnectorDeps["rateLimiter"],
  minIntervalMs: number,
  sleepFn: (ms: number) => Promise<void>,
  nowFn: () => number,
): ConnectorDeps["rateLimiter"] {
  let lastStart: number | null = null;
  return {
    wait: async (host: string) => {
      if (minIntervalMs > 0) {
        const now = nowFn();
        if (lastStart !== null) {
          const remaining = minIntervalMs - (now - lastStart);
          if (remaining > 0) {
            await sleepFn(remaining);
          }
        }
        lastStart = nowFn();
      }
      await rl.wait(host);
    },
  };
}

/**
 * GAP-SC2/CR-01 (132-08): sin `cache` ni `supabase` no hay forma de construir un `DailyCache`
 * real, y el default de producción NO puede volver a ser el doble no-op (`hasToday` siempre
 * `false`) — ese default garantizaba re-descargar los 5 medios en cada corrida, exactamente el
 * hueco #4 de Is Chile Safe que esta fase declara cerrado. `buildNewsDeps` LANZA en vez de
 * degradar silenciosamente.
 */
export class NewsCacheRequeridaError extends Error {
  constructor() {
    super(
      "buildNewsDeps: falta `cache` (override) o `supabase: { url, serviceKey }` — sin un " +
        "DailyCache real respaldado en source_snapshot la Etapa 1 re-descargaría los 5 medios " +
        "en cada corrida (CR-01). Pasa `overrides.cache` en tests, o `supabase.url` + " +
        "`supabase.serviceKey` en producción.",
    );
    this.name = "NewsCacheRequeridaError";
  }
}

/**
 * Fábrica de `ConnectorDeps` para `NewsConnector`. Construye `Fetcher` y
 * `RobotsGuard` AMBOS con la misma allowlist scoped de prensa y el mismo
 * `fetchFn` inyectable — sin esto, la mutación 3 del Task 2 (RobotsGuard con
 * `{ allowlist: {} }`) solo sería testeable con red real.
 */
export function buildNewsDeps(opts: BuildNewsDepsOptions = {}): ConnectorDeps {
  const {
    allowlist = allowlistNews(),
    fetchFn,
    minIntervalMs = 2500,
    sleepFn = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    nowFn = () => Date.now(),
    supabase,
    ...overrides
  } = opts;

  const fetcher = new Fetcher({ fetchFn, allowlist });
  const robots = new RobotsGuard({ fetchFn, allowlist });
  const rateLimiter = new HostRateLimiter({ minDelayMs: minIntervalMs });
  const gatedRateLimiter = gateRateLimiter(
    overrides.rateLimiter ?? rateLimiter,
    minIntervalMs,
    sleepFn,
    nowFn,
  );

  let cache: ConnectorDeps["cache"];
  if (overrides.cache) {
    cache = overrides.cache;
  } else if (supabase) {
    cache = new DailyCache(new SupabaseSnapshotLookup(supabase));
  } else {
    throw new NewsCacheRequeridaError();
  }

  const base: ConnectorDeps = {
    cache,
    robots: overrides.robots ?? robots,
    rateLimiter: gatedRateLimiter,
    hostThrottle: overrides.hostThrottle,
    fetcher: overrides.fetcher ?? fetcher,
    drift: overrides.drift ?? {
      check: async () => ({ changed: false, newFingerprint: "" }),
      alert: async () => {},
    },
    r2: overrides.r2 ?? {
      putImmutable: async (source, resource, date, sha, ext) => ({
        r2Path: `${source}/${resource}/${date}/${sha}.${ext}`,
        existed: false,
      }),
    },
    snapshot: overrides.snapshot ?? {
      write: async (input) => ({
        snapshotId: 0,
        r2Path: input.r2Path,
        contentHash: input.contentHash,
      }),
    },
    log: overrides.log ?? { skip: async () => {} },
    now: overrides.now,
  };

  return base;
}
