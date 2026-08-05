// replay.test.ts — [SC3] `--from-r2` reproduce la carga completa con la red PROHIBIDA.
//
// La red está PROHIBIDA en este archivo: `globalThis.fetch` se reemplaza por una función que
// LANZA (instalada a nivel de archivo, restaurada en `afterEach`). Un "test de replay" que
// nunca toca `r2Store.getObject` certificaría una omisión (Pitfall 10, 132-RESEARCH.md
// §Pattern 3): por eso el doble de R2Store registra las llamadas y se assertan explícitamente.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main, NewsCliArgsError } from "./run-news-cli";
import { InMemoryNewsWriter } from "./writer";
import { cargar } from "./carga-run";
import { parseRss } from "./parse-rss";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "__fixtures__");

function fixtureXml(slug: string): string {
  return readFileSync(join(FIXTURES_DIR, `${slug}.xml`), "utf-8");
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("red prohibida en tests");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("control positivo del stub de fetch (prueba de que el stub está instalado)", () => {
  it("el fetch global instalado explota si alguien lo llama", () => {
    expect(() => fetch("https://example.com")).toThrow("red prohibida en tests");
  });
});

// 132-10/WR-09: `main()` valida `--from-r2` contra `R2_PATH_RE` (derivado de FEEDS), que exige
// un sha256 hex de 64 caracteres — "deadbeef" ya no matchea.
const R2_PATH = `news/rss-latercera/2026-08-05/${"deadbeef".repeat(8)}.xml`;

function fakeR2Store(bytes: Uint8Array) {
  const calls: string[] = [];
  return {
    calls,
    store: {
      async getObject(r2Path: string) {
        calls.push(r2Path);
        return bytes;
      },
    } as unknown as import("@obs/ingest").R2Store,
  };
}

describe("SC3 — replay --from-r2 (fetch LANZA, dato viene EXCLUSIVAMENTE de R2)", () => {
  it("reproduce la carga completa (mismos conteos que cargar() directo) y getObject se llama exactamente 1 vez", async () => {
    const xml = fixtureXml("latercera");
    const bytes = new TextEncoder().encode(xml);
    const { calls, store } = fakeR2Store(bytes);
    const writer = new InMemoryNewsWriter();

    const res = await main({
      fromR2: R2_PATH,
      dryRun: true,
      r2Store: store,
      writer,
      log: () => {},
    });

    // Prueba anti-Pitfall-10: el dato vino de getObject, no de un fixture local en memoria.
    expect(calls).toEqual([R2_PATH]);
    expect(res.carga).toBeDefined();

    const { items } = parseRss(xml, "La Tercera");
    const directo = await cargar({
      items,
      r2Path: R2_PATH,
      contenidoHash: "",
      writer: new InMemoryNewsWriter(),
      log: () => {},
    });

    expect(res.carga!.vistos).toBe(directo.vistos);
    expect(res.carga!.nuevos).toBe(directo.nuevos);
    expect(res.carga!.cargados).toBe(directo.cargados);
    expect(res.carga!.descartados).toBe(directo.descartados);
    expect(directo.vistos).toBeGreaterThan(0);
  });

  it("el replay NO escribe source_snapshot — 0 escrituras (F-2: único modo repetible sin consumir la caché diaria)", async () => {
    const xml = fixtureXml("latercera");
    const bytes = new TextEncoder().encode(xml);
    const { store } = fakeR2Store(bytes);
    const writeSpy = vi.fn(async () => ({ snapshotId: 1, r2Path: "x", contentHash: "x" }));

    await main({
      fromR2: R2_PATH,
      dryRun: true,
      r2Store: store,
      writer: new InMemoryNewsWriter(),
      snapshotWriter: { write: writeSpy },
      log: () => {},
    });

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("--from-r2 sin R2 configurado (r2Store: null) lanza NewsCliArgsError", async () => {
    await expect(
      main({ fromR2: R2_PATH, dryRun: true, r2Store: null, writer: new InMemoryNewsWriter(), log: () => {} }),
    ).rejects.toThrow(NewsCliArgsError);
  });
});
