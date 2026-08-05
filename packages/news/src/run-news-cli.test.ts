// run-news-cli.test.ts — flags, R2 obligatorio (tri-estado), [skip] derivado, barrel.
//
// Cero red OBLIGATORIA (warning ronda 3): AMBOS casos del par apareado del fallo duro corren
// `main()` con `dryRun: false`, es decir por el camino de Etapa 1 — si no se inyecta un
// CONECTOR DOBLE, ese camino construiría un `NewsConnector` real (fetch global) y golpearía los
// 5 feeds vivos en cada `pnpm test`. Por eso: (a) el fetch global se stubea a nivel de archivo y
// EXPLOTA si se le llama, (b) ningún test construye el Fetcher real de @obs/ingest, (c) todos los casos que
// corren por Etapa 1 inyectan `conector`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  main,
  parseArgs,
  findWorkspaceRoot,
  NewsCliArgsError,
  NewsR2RequeridoError,
} from "./run-news-cli";
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
