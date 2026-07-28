import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findWorkspaceRoot,
  readEstadoSnapshot,
  firmaIdentidad,
  buildR2Target,
  buildSnapshotWriter,
  main,
} from "./seed-cli";
import type { Parlamentario } from "@obs/core";

describe("findWorkspaceRoot (IN-02)", () => {
  it("LANZA si no halla pnpm-workspace.yaml (no devuelve un path plausible pero equivocado)", () => {
    const dir = mkdtempSync(join(tmpdir(), "seedcli-noroot-"));
    try {
      expect(() => findWorkspaceRoot(dir)).toThrow(/pnpm-workspace\.yaml/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("devuelve el directorio que contiene pnpm-workspace.yaml", () => {
    const root = mkdtempSync(join(tmpdir(), "seedcli-root-"));
    try {
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
      expect(findWorkspaceRoot(root)).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("readEstadoSnapshot (IN-03 + WR-03)", () => {
  const tmpFiles: string[] = [];
  afterEach(() => {
    for (const f of tmpFiles.splice(0)) rmSync(f, { recursive: true, force: true });
  });
  function snapFile(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), "seedcli-snap-"));
    tmpFiles.push(dir);
    const path = join(dir, "parlamentario.seed.json");
    writeFileSync(path, content);
    return path;
  }

  it("indexa estado por id Y por firma de identidad estable (WR-03)", () => {
    const path = snapFile(
      JSON.stringify([
        {
          id: "S1",
          estado: "confirmado",
          camara: "senado",
          periodo: "senado-vigente-2026",
          nombre_normalizado: "araya pedro",
        },
      ]),
    );
    const idx = readEstadoSnapshot(path, () => {});
    expect(idx.porId.get("S1")).toBe("confirmado");
    expect(
      idx.porFirma.get(firmaIdentidad({
        camara: "senado",
        periodo: "senado-vigente-2026",
        nombre_normalizado: "araya pedro",
      })),
    ).toBe("confirmado");
  });

  it("IN-03: un snapshot corrupto se REGISTRA (no se traga en silencio) y no preserva nada", () => {
    const path = snapFile("{ esto no es json valido ]");
    const logs: string[] = [];
    const idx = readEstadoSnapshot(path, (m) => logs.push(m));
    expect(idx.porId.size).toBe(0);
    expect(idx.porFirma.size).toBe(0);
    expect(logs.some((l) => l.includes("IN-03") && l.toLowerCase().includes("corrupt"))).toBe(true);
  });

  it("snapshot ausente devuelve índices vacíos sin warning", () => {
    const logs: string[] = [];
    const idx = readEstadoSnapshot(join(tmpdir(), "no-existe-xyz.json"), (m) => logs.push(m));
    expect(idx.porId.size).toBe(0);
    expect(logs).toHaveLength(0);
  });
});

describe("buildR2Target (WR-02: gateado por credenciales)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("devuelve null si falta cualquier credencial R2 (no-op explícito)", () => {
    delete process.env.R2_ENDPOINT_URL;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    expect(buildR2Target()).toBeNull();

    process.env.R2_ENDPOINT_URL = "https://x.r2.cloudflarestorage.com";
    // faltan las otras 3 → sigue null
    expect(buildR2Target()).toBeNull();
  });

  it("construye un target cuando las 4 credenciales están presentes", () => {
    process.env.R2_ENDPOINT_URL = "https://x.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "ak";
    process.env.R2_SECRET_ACCESS_KEY = "sk";
    process.env.R2_BUCKET = "observatorio";
    const target = buildR2Target();
    expect(target).not.toBeNull();
    expect(typeof target!.put).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G6 (119-03): `existed` (412) ⇒ skip de la CARGA a DB, jamás del snapshot git.
// El snapshot committeado es el artefacto AUTORITATIVO (ID-09 / backup-parlamentario.yml:60):
// un skip de R2 NO puede dejarlo sin actualizar.
// ─────────────────────────────────────────────────────────────────────────────
describe("main — G6: existed:true ⇒ skip de la carga, no del snapshot", () => {
  const MAESTRA = [
    {
      id: "S1",
      camara: "senado",
      periodo: "senado-vigente-2026",
      nombre_normalizado: "araya pedro",
      estado: "no_confirmado",
    },
  ] as unknown as Parlamentario[];

  /** Deps de test: seeder fake, writer de DB espía, writer de archivo espía. */
  function deps(existed: boolean | null) {
    const escrituras: { path: string; content: string }[] = [];
    const upserts: Parlamentario[][] = [];
    const logs: string[] = [];
    return {
      escrituras,
      upserts,
      logs,
      opts: {
        cwd: tmpdir(),
        serviceKey: "fake-service-key", // habilita la rama de carga a DB
        log: (m: string) => logs.push(m),
        seeder: async () => MAESTRA.map((r) => ({ ...r })),
        dbWriter: {
          upsert: async (rows: Parlamentario[]) => {
            upserts.push(rows);
          },
          promoteToConfirmado: async () => ({ promovidos: 0 }),
        },
        fileWriter: {
          write: async (path: string, content: string) => {
            escrituras.push({ path, content });
          },
        },
        r2Target:
          existed == null
            ? null
            : { put: async () => ({ r2Path: "identity/parlamentario-seed/x/y.json", existed }) },
        // G5: sin writer inyectado, `main` construiría uno real contra el Supabase local.
        // Estos casos son de G6 → se apaga explícitamente.
        snapshotWriter: null,
      },
    };
  }

  it("(1) existed:true ⇒ la carga a DB NO se invoca y el log dice `[skip] sin novedades`", async () => {
    const d = deps(true);
    const res = await main(d.opts as never);
    expect(d.upserts).toHaveLength(0);
    expect(res.dbLoaded).toBe(false);
    expect(
      d.logs.some((l) => l.includes("[skip] sin novedades — identity parlamentario-seed")),
    ).toBe(true);
  });

  it("(2) existed:true ⇒ el snapshot al filesystem SÍ se escribe (el commit del bot es autoritativo)", async () => {
    const d = deps(true);
    const res = await main(d.opts as never);
    expect(d.escrituras).toHaveLength(1);
    expect(d.escrituras[0]!.path).toContain("parlamentario.seed.json");
    expect(res.snapshotBytes).toBeGreaterThan(0);
  });

  it("(3) existed:false ⇒ comportamiento actual intacto (carga a DB + snapshot)", async () => {
    const d = deps(false);
    const res = await main(d.opts as never);
    expect(d.upserts).toHaveLength(1);
    expect(res.dbLoaded).toBe(true);
    expect(d.escrituras).toHaveLength(1);
    expect(d.logs.some((l) => l.includes("[skip] sin novedades"))).toBe(false);
  });

  it("(4) sin credenciales R2 (target null) ⇒ NO hay skip: todo procede (no-op explícito)", async () => {
    const d = deps(null);
    const res = await main(d.opts as never);
    expect(d.upserts).toHaveLength(1);
    expect(res.dbLoaded).toBe(true);
    expect(res.r2Ok).toBe(false);
    expect(d.logs.some((l) => l.includes("[skip] sin novedades"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G5 (119-04): provenance en `source_snapshot`. Gateado por credenciales Supabase:
// en GitHub Actions (backup-parlamentario.yml mapea SOLO los R2_*) queda apagado, y
// eso se DICE en el log en vez de fingirse.
// ─────────────────────────────────────────────────────────────────────────────
describe("main — G5: SnapshotWriter (source_snapshot)", () => {
  const MAESTRA = [
    {
      id: "S1",
      camara: "senado",
      periodo: "senado-vigente-2026",
      nombre_normalizado: "araya pedro",
      estado: "no_confirmado",
    },
  ] as unknown as Parlamentario[];

  function opts(extra: Record<string, unknown>, logs: string[]) {
    return {
      cwd: tmpdir(),
      serviceKey: "fake-service-key",
      log: (m: string) => logs.push(m),
      seeder: async () => MAESTRA.map((r) => ({ ...r })),
      dbWriter: {
        upsert: async () => {},
        promoteToConfirmado: async () => ({ promovidos: 0 }),
      },
      fileWriter: { write: async () => {} },
      r2Target: {
        put: async () => ({ r2Path: "identity/parlamentario-seed/2026-07-28/abc.json", existed: false }),
      },
      ...extra,
    };
  }

  it("buildSnapshotWriter devuelve null sin credenciales (CI de backup-parlamentario)", () => {
    expect(buildSnapshotWriter("", "")).toBeNull();
    expect(buildSnapshotWriter("http://x", "")).toBeNull();
    expect(buildSnapshotWriter("", "k")).toBeNull();
  });

  it("sin credenciales Supabase: writer undefined, corrida OK y el log declara que NO hay snapshot", async () => {
    const logs: string[] = [];
    const res = await main(opts({ snapshotWriter: null }, logs) as never);
    expect(res.r2Ok).toBe(true);
    expect(logs.some((l) => l.includes("NO se registra fila en source_snapshot"))).toBe(true);
    // Ningún log fantasma de escritura.
    expect(logs.some((l) => l.includes("fila source_snapshot escrita"))).toBe(false);
  });

  it("con stub: `write` se invoca una vez con los 4 campos no vacíos", async () => {
    const logs: string[] = [];
    const escrituras: Record<string, unknown>[] = [];
    await main(
      opts(
        {
          snapshotWriter: {
            write: async (w: Record<string, unknown>) => {
              escrituras.push(w);
              return { r2Path: String(w.r2Path), contentHash: String(w.contentHash) };
            },
          },
        },
        logs,
      ) as never,
    );
    expect(escrituras).toHaveLength(1);
    const w = escrituras[0]!;
    expect(w.source).toBe("identity");
    expect(w.resource).toBe("parlamentario-seed");
    expect(String(w.r2Path)).not.toBe("");
    expect(String(w.contentHash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(w.cacheKey)).toMatch(/^identity:parlamentario-seed:\d{4}-\d{2}-\d{2}$/);
  });

  it("existed:true ⇒ CERO escrituras (nunca una fila sin objeto recién creado)", async () => {
    const logs: string[] = [];
    const escrituras: unknown[] = [];
    await main(
      opts(
        {
          r2Target: {
            put: async () => ({ r2Path: "identity/parlamentario-seed/x/y.json", existed: true }),
          },
          snapshotWriter: {
            write: async (w: unknown) => {
              escrituras.push(w);
              return { r2Path: "x", contentHash: "y" };
            },
          },
        },
        logs,
      ) as never,
    );
    expect(escrituras).toHaveLength(0);
  });

  it("best-effort: si `write` lanza, la corrida termina OK (r2Ok true, snapshot escrito)", async () => {
    const logs: string[] = [];
    const res = await main(
      opts(
        {
          snapshotWriter: {
            write: async () => {
              throw new Error("source_snapshot caído");
            },
          },
        },
        logs,
      ) as never,
    );
    expect(res.r2Ok).toBe(true);
    expect(res.total).toBe(1);
    expect(logs.some((l) => l.includes("source_snapshot falló (no fatal)"))).toBe(true);
  });
});
