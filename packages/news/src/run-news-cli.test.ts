// run-news-cli.test.ts — flags, R2 obligatorio (tri-estado), [skip] derivado, barrel.
//
// Cero red OBLIGATORIA (warning ronda 3): AMBOS casos del par apareado del fallo duro corren
// `main()` con `dryRun: false`, es decir por el camino de Etapa 1 — si no se inyecta un
// CONECTOR DOBLE, ese camino construiría un `NewsConnector` real (fetch global) y golpearía los
// 5 feeds vivos en cada `pnpm test`. Por eso: (a) el fetch global se stubea a nivel de archivo y
// EXPLOTA si se le llama, (b) ningún test construye el Fetcher real de @obs/ingest, (c) todos los casos que
// corren por Etapa 1 inyectan `conector`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectorDeps, RequestSpec } from "@obs/ingest";
import {
  main,
  parseArgs,
  findWorkspaceRoot,
  NewsCliArgsError,
  NewsR2RequeridoError,
} from "./run-news-cli";
import { NewsConnector, buildNewsDeps } from "./connector-news";
import { InMemoryNewsWriter } from "./writer";
import { FEEDS } from "./feeds";
import * as index from "./index";

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("red prohibida en tests");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("control positivo del stub de fetch", () => {
  it("explota si algo lo llama", () => {
    expect(() => fetch("https://example.com")).toThrow("red prohibida en tests");
  });
});

describe("parseArgs", () => {
  it("--from-r2 sin argumento lanza NewsCliArgsError", () => {
    expect(() => parseArgs(["--from-r2"])).toThrow(NewsCliArgsError);
  });

  it("flag desconocido lanza NewsCliArgsError con el nombre del flag", () => {
    expect(() => parseArgs(["--flag-inexistente"])).toThrow(/--flag-inexistente/);
  });

  it("--feeds latercera,exante produce 2 endpoints", () => {
    const opts = parseArgs(["--feeds", "latercera,exante"]);
    expect(opts.feeds).toEqual(["latercera", "exante"]);
    expect(opts.feeds).toHaveLength(2);
  });

  it("--dry-run, --etapa1, --etapa2 setean sus flags", () => {
    expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
    expect(parseArgs(["--etapa1"]).soloEtapa1).toBe(true);
    expect(parseArgs(["--etapa2"]).soloEtapa2).toBe(true);
  });
});

describe("findWorkspaceRoot", () => {
  it("resuelve subiendo hasta pnpm-workspace.yaml", () => {
    const root = findWorkspaceRoot(process.cwd());
    expect(root.length).toBeGreaterThan(0);
  });
});

const NOW = () => new Date("2026-08-05T12:00:00Z");
const MIN_RSS =
  "<rss><channel><item><title>t</title><link>http://x.example/1</link></item></channel></rss>";

/**
 * Doble ESTRUCTURAL del cliente supabase-js (espejo de snapshot-lookup-supabase.test.ts):
 * registra los `eq(col,val)` de cada invocación como una fila `{source,resource,dateBucket}`,
 * para poder assertar los argumentos exactos que llegan a `hasSnapshot`. Este doble se inyecta
 * vía `supabase.client` — ejercita el camino REAL de `buildNewsDeps` (`supabase` ⇒
 * `new DailyCache(new SupabaseSnapshotLookup(...))`), no un `cache` override directo. Así la
 * mutación que restaura el default no-op SÍ puede hacer caer este test (WIRING real, no un
 * atajo que ignore el default).
 */
function makeSupabaseClientDouble(result: boolean) {
  const calls: { source: string; resource: string; dateBucket: string }[] = [];
  const client = {
    from(table: string) {
      if (table !== "source_snapshot") throw new Error(`tabla inesperada: ${table}`);
      return {
        select() {
          const row: Partial<{ source: string; resource: string; dateBucket: string }> = {};
          return {
            eq(col: string, val: unknown) {
              if (col === "source") row.source = val as string;
              if (col === "resource") row.resource = val as string;
              if (col === "date_bucket") row.dateBucket = val as string;
              return this;
            },
            limit() {
              return this;
            },
            async maybeSingle() {
              calls.push(row as { source: string; resource: string; dateBucket: string });
              return result ? { data: { id: 1 }, error: null } : { data: null, error: null };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as import("@supabase/supabase-js").SupabaseClient, calls };
}

/**
 * Construye un `NewsConnector` REAL vía `buildNewsDeps({ supabase })` — el camino de
 * PRODUCCIÓN (CR-01): mide el WIRING, no un conector doble ni un `cache` override directo.
 * `fetcher`, `robots`, `r2`, `snapshot` y `now` van inyectados como overrides, igual que la
 * instrucción del plan (132-08 Task 2).
 */
function makeWiredConnector(lookupResult: boolean) {
  const { client, calls } = makeSupabaseClientDouble(lookupResult);
  const fetcherCalls: string[] = [];
  const deps: ConnectorDeps = buildNewsDeps({
    supabase: { url: "http://127.0.0.1:0", serviceKey: "test-key", client },
    robots: { isAllowed: vi.fn(async () => true) },
    rateLimiter: { wait: vi.fn(async () => {}) },
    fetcher: {
      get: vi.fn(async (spec: RequestSpec) => {
        fetcherCalls.push(spec.resource);
        return new TextEncoder().encode(MIN_RSS);
      }),
    },
    drift: {
      check: vi.fn(async (_s: string, _r: string, fp: string) => ({ changed: false, newFingerprint: fp })),
      alert: vi.fn(async () => {}),
    },
    r2: {
      putImmutable: vi.fn(
        async (source: string, resource: string, date: string, sha: string, ext: string) => ({
          r2Path: `${source}/${resource}/${date}/${sha}.${ext}`,
          existed: false,
        }),
      ),
    },
    snapshot: {
      write: vi.fn(async (input) => ({
        snapshotId: 1,
        r2Path: input.r2Path,
        contentHash: input.contentHash,
      })),
    },
    log: { skip: vi.fn(async () => {}) },
    now: NOW,
  });
  const conector = new NewsConnector(deps);
  return { conector, fetcherCalls, lookupCalls: calls };
}

describe("[CR-01/132-08] early-exit real con DailyCache real (wiring de buildNewsDeps)", () => {
  it("lookup=true para los 5 recursos ⇒ fetcher.get 0 veces, CLI emite 5 [skip], descargados=0 skips=5", async () => {
    const { conector, fetcherCalls, lookupCalls } = makeWiredConnector(true);
    const logs: string[] = [];
    const res = await main({
      dryRun: true,
      soloEtapa1: true,
      conector,
      writer: new InMemoryNewsWriter(),
      log: (m) => logs.push(m),
    });

    expect(fetcherCalls).toHaveLength(0);
    expect(res.descargados).toBe(0);
    expect(res.skips).toHaveLength(5);
    expect(logs.filter((l) => l.startsWith("[skip]"))).toHaveLength(5);
    expect(logs.some((l) => l.includes("descargados=0") && l.includes("skips=5"))).toBe(true);

    // El lookup recibe los argumentos correctos: source="news", resource="rss-<slug>" por cada
    // uno de los 5 slugs, y el dateBucket derivado del `now` inyectado (no calculado a otra hora).
    expect(lookupCalls).toHaveLength(5);
    for (const c of lookupCalls) {
      expect(c.source).toBe("news");
      expect(c.resource).toMatch(/^rss-[a-z]+$/);
      expect(c.dateBucket).toBe("2026-08-05");
    }
    expect(new Set(lookupCalls.map((c) => c.resource)).size).toBe(5);
  });

  it("control positivo apareado: lookup=false (MISMO montaje, difiere solo hasSnapshot) ⇒ fetcher.get 5 veces, descargados=5 skips=0", async () => {
    const { conector, fetcherCalls } = makeWiredConnector(false);
    const logs: string[] = [];
    const res = await main({
      dryRun: true,
      soloEtapa1: true,
      conector,
      writer: new InMemoryNewsWriter(),
      log: (m) => logs.push(m),
    });

    expect(fetcherCalls).toHaveLength(5);
    expect(res.descargados).toBe(5);
    expect(res.skips).toHaveLength(0);
    expect(logs.filter((l) => l.startsWith("[skip]"))).toHaveLength(0);
  });
});

describe("[SC2] [skip] derivado — sin tocar @obs/ingest", () => {
  it("conector doble devuelve refs de solo 2/5 feeds ⇒ 3 líneas [skip] y resumen descargados=2 skips=3", async () => {
    const logs: string[] = [];
    const dosSlugs = [FEEDS[0]!.slug, FEEDS[1]!.slug];
    const conector = {
      run: vi.fn(async () =>
        dosSlugs.map((slug) => ({
          r2Path: `news/rss-${slug}/2026-08-05/${"a".repeat(64)}.xml`,
          contentHash: "a".repeat(64),
        })),
      ),
    };

    const res = await main({
      dryRun: true,
      soloEtapa1: true,
      conector,
      writer: new InMemoryNewsWriter(),
      log: (m) => logs.push(m),
    });

    expect(res.descargados).toBe(2);
    expect(res.skips).toHaveLength(3);
    const skipLines = logs.filter((l) => l.startsWith("[skip]"));
    expect(skipLines).toHaveLength(3);
    const faltantes = FEEDS.map((f) => f.slug).filter((s) => !dosSlugs.includes(s));
    for (const slug of faltantes) {
      expect(skipLines.some((l) => l.includes(`rss-${slug}`))).toBe(true);
    }
    expect(logs.some((l) => l.includes("descargados=2") && l.includes("skips=3"))).toBe(true);
  });

  it("Etapa 1 con caché llena (conector doble devuelve []) ⇒ 0 refs y 5 líneas [skip]", async () => {
    const logs: string[] = [];
    const conector = { run: vi.fn(async () => []) };

    const res = await main({
      dryRun: true,
      soloEtapa1: true,
      conector,
      writer: new InMemoryNewsWriter(),
      log: (m) => logs.push(m),
    });

    expect(res.descargados).toBe(0);
    expect(res.skips).toHaveLength(5);
    expect(logs.filter((l) => l.startsWith("[skip]"))).toHaveLength(5);
  });
});

describe("[T-132-17] fallo duro sin R2 — tri-estado, control positivo apareado (difiere SOLO en r2Store)", () => {
  it("r2Store: null, dryRun: false ⇒ falla duro con NewsR2RequeridoError (tipo + mensaje contiene R2), sin [WARN]", async () => {
    const logs: string[] = [];
    const conector = { run: vi.fn(async () => []) };
    const writer = new InMemoryNewsWriter();

    let thrown: unknown;
    try {
      await main({
        r2Store: null,
        dryRun: false,
        conector,
        writer,
        url: "http://127.0.0.1:0",
        serviceKey: "test-key",
        log: (m) => logs.push(m),
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(NewsR2RequeridoError);
    expect(thrown).not.toBeInstanceOf(NewsCliArgsError);
    expect((thrown as Error).message).toMatch(/R2/);
    expect(logs.some((l) => l.includes("[WARN]"))).toBe(false);
  });

  it("caso positivo apareado: r2Store: fake, dryRun: false (idéntico salvo r2Store) ⇒ completa sin lanzar, sin [WARN]", async () => {
    const logs: string[] = [];
    const conector = { run: vi.fn(async () => []) };
    const writer = new InMemoryNewsWriter();
    const fakeR2 = {
      getObject: vi.fn(async () => new TextEncoder().encode("")),
      putImmutable: vi.fn(async (source: string, resource: string, date: string, sha: string, ext: string) => ({
        r2Path: `${source}/${resource}/${date}/${sha}.${ext}`,
        existed: false,
      })),
    };

    const res = await main({
      r2Store: fakeR2 as unknown as import("@obs/ingest").R2Store,
      dryRun: false,
      conector,
      writer,
      url: "http://127.0.0.1:0",
      serviceKey: "test-key",
      log: (m) => logs.push(m),
    });

    expect(res).toBeDefined();
    expect(res.dryRun).toBe(false);
    expect(logs.some((l) => l.includes("[WARN]"))).toBe(false);
  });
});

describe("Barrel — packages/news/src/index.ts exporta la superficie del paquete", () => {
  it("≥ 8 símbolos importados, ninguno undefined", () => {
    const simbolos = [
      "FEEDS",
      "NEWS_HOSTS",
      "allowlistNews",
      "NewsConnector",
      "buildNewsDeps",
      "parseRss",
      "canonicalizarUrl",
      "urlHash",
      "esLegislativo",
      "VOCABULARIO_LEGISLATIVO",
      "InMemoryNewsWriter",
      "SupabaseNewsWriter",
      "cargar",
      "parseArgs",
      "NewsCliArgsError",
    ] as const;
    expect(simbolos.length).toBeGreaterThanOrEqual(8);
    for (const s of simbolos) {
      expect((index as Record<string, unknown>)[s]).toBeDefined();
    }
  });
});
