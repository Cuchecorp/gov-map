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
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  sha256Hex,
  type ConnectorDeps,
  type RequestSpec,
} from "@obs/ingest";
import type { AllowlistOptions } from "@obs/ingest";
import { FEEDS } from "./feeds";
import { allowlistNews } from "./allowlist-news";

/** Forma cruda del RSS: el XML como string (shape-guard SUAVE, sin zod). */
export type RssRaw = { xml: string };

export class NewsConnector extends BaseConnector<RssRaw> {
  protected sourceId = "news";

  /** Un endpoint por feed, cada uno con `resource` ÚNICO (Pattern 2). */
  protected endpoints(): RequestSpec[] {
    return FEEDS.map((f) => ({
      url: f.url,
      resource: `rss-${f.slug}`,
      key: f.slug,
      ext: "xml",
    }));
  }

  /**
   * Shape-guard SUAVE sobre string. `decodeJson` (BaseConnector) entrega un
   * string cuando el body no es JSON — que es siempre el caso para RSS/XML.
   * El zod ESTRICTO vive en Etapa 2 (D-10); aquí solo se descarta lo que
   * claramente no es un feed RSS/Atom con items.
   */
  protected validateShape(body: unknown): RssRaw {
    if (typeof body !== "string") {
      throw new Error("news: body no es string (se esperaba XML crudo)");
    }
    if (!/<rss[\s>]|<feed[\s>]/i.test(body)) {
      throw new Error("news: no parece RSS/Atom (falta <rss> o <feed>)");
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
};

/**
 * Fábrica de `ConnectorDeps` para `NewsConnector`. Construye `Fetcher` y
 * `RobotsGuard` AMBOS con la misma allowlist scoped de prensa y el mismo
 * `fetchFn` inyectable — sin esto, la mutación 3 del Task 2 (RobotsGuard con
 * `{ allowlist: {} }`) solo sería testeable con red real.
 */
export function buildNewsDeps(opts: BuildNewsDepsOptions = {}): ConnectorDeps {
  const { allowlist = allowlistNews(), fetchFn, minIntervalMs = 2500, ...overrides } = opts;

  const fetcher = new Fetcher({ fetchFn, allowlist });
  const robots = new RobotsGuard({ fetchFn, allowlist });
  const rateLimiter = new HostRateLimiter({ minDelayMs: minIntervalMs });

  const base: ConnectorDeps = {
    cache: overrides.cache ?? {
      dailyKey: async () => "",
      hasToday: async () => false,
    },
    robots: overrides.robots ?? robots,
    rateLimiter: overrides.rateLimiter ?? rateLimiter,
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
