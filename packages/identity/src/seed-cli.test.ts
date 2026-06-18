import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findWorkspaceRoot,
  readEstadoSnapshot,
  firmaIdentidad,
  buildR2Target,
} from "./seed-cli";

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
