// pipeline-cli.test — validación de flags ANTES de red/DB + degradación dry-run sin key.
//
// Sin red, sin DB, sin keys. Verifica:
//   - parseArgs acepta --limite/--boletines/--reembed/--dry-run/--service-key.
//   - flags inválidos lanzan FichasCliArgsError (exit 2), no tocan red/DB.
//   - sin service key → degrada a dry-run (nunca toca DB).
//   - el módulo NO ejecuta el run al ser importado (isMain guard).

import { describe, it, expect } from "vitest";
import { parseArgs, FichasCliArgsError, decidirDryRun } from "./pipeline-cli";

describe("pipeline-cli: parseArgs — validación fail-fast", () => {
  it("acepta --limite N, --boletines a,b, --reembed, --dry-run, --service-key K", () => {
    const o = parseArgs([
      "--limite", "10",
      "--boletines", "18296-05,14309-04",
      "--reembed",
      "--dry-run",
      "--service-key", "sb_secret_x",
    ]);
    expect(o.limite).toBe(10);
    expect(o.boletines).toEqual(["18296-05", "14309-04"]);
    expect(o.reembed).toBe(true);
    expect(o.dryRun).toBe(true);
    expect(o.serviceKey).toBe("sb_secret_x");
  });

  it("--limite no-numérico → FichasCliArgsError (exit 2)", () => {
    expect(() => parseArgs(["--limite", "abc"])).toThrow(FichasCliArgsError);
  });

  it("--limite <= 0 → FichasCliArgsError", () => {
    expect(() => parseArgs(["--limite", "0"])).toThrow(FichasCliArgsError);
  });

  it("--boletines vacío → FichasCliArgsError", () => {
    expect(() => parseArgs(["--boletines", "  "])).toThrow(FichasCliArgsError);
  });

  it("flag desconocido → FichasCliArgsError", () => {
    expect(() => parseArgs(["--no-existe"])).toThrow(FichasCliArgsError);
  });

  it("--service-key sin valor (último token) → FichasCliArgsError, no dry-run silencioso (WR-05)", () => {
    expect(() => parseArgs(["--service-key"])).toThrow(FichasCliArgsError);
  });

  it("--service-key con valor vacío → FichasCliArgsError", () => {
    expect(() => parseArgs(["--service-key", "   "])).toThrow(FichasCliArgsError);
  });

  it("sin flags → objeto vacío (defaults aplicados aguas abajo)", () => {
    expect(parseArgs([])).toEqual({});
  });
});

describe("pipeline-cli: decidirDryRun — degradación sin service key", () => {
  it("sin service key → dry-run (nunca toca DB)", () => {
    expect(decidirDryRun({ serviceKey: "" })).toBe(true);
    expect(decidirDryRun({})).toBe(true);
  });

  it("con service key y sin --dry-run → run real (NO dry-run)", () => {
    expect(decidirDryRun({ serviceKey: "sb_secret_x" })).toBe(false);
  });

  it("--dry-run explícito siempre dry-run, aún con service key", () => {
    expect(decidirDryRun({ serviceKey: "sb_secret_x", dryRun: true })).toBe(true);
  });
});

describe("pipeline-cli: isMain guard — no ejecuta al importar", () => {
  it("importar el módulo NO dispara el run (sin side-effects de red/DB)", async () => {
    // Si el import disparara main(), este import habría intentado red/DB y/o lanzado.
    const mod = await import("./pipeline-cli");
    expect(typeof mod.parseArgs).toBe("function");
    expect(typeof mod.main).toBe("function");
  });
});
