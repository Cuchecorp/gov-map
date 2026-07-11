// seed-fichas-cli.test — validación de flags del entrypoint del seed (pura, sin red/DB).
//
// Foco: `parseArgs` fail-fast y `decidirDryRun`. En particular WR-05: `--service-key`
// NUNCA debe tragarse un flag siguiente como su valor (`--service-key --dry-run` → LIVE con
// key basura). Un flag no es una key: se rechaza explícitamente ANTES de tocar la DB.

import { describe, it, expect } from "vitest";
import { parseArgs, decidirDryRun, SeedCliArgsError } from "./seed-fichas-cli";

describe("parseArgs — validación de flags (fail-fast)", () => {
  it("--dry-run setea dryRun=true", () => {
    expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
  });

  it("--service-key K toma la key siguiente", () => {
    expect(parseArgs(["--service-key", "sb_secret_abc"]).serviceKey).toBe("sb_secret_abc");
  });

  it("WR-05: --service-key seguido de un flag (--dry-run) LANZA, no traga el flag como key", () => {
    // El operador olvidó la key: sin este guard, serviceKey="--dry-run" y la corrida iría LIVE.
    expect(() => parseArgs(["--service-key", "--dry-run"])).toThrow(SeedCliArgsError);
    expect(() => parseArgs(["--service-key", "--dry-run"])).toThrow(/flag|key/i);
  });

  it("WR-05: --service-key al final (sin valor) LANZA", () => {
    expect(() => parseArgs(["--service-key"])).toThrow(SeedCliArgsError);
  });

  it("WR-05: --service-key con valor vacío/espacios LANZA", () => {
    expect(() => parseArgs(["--service-key", "   "])).toThrow(SeedCliArgsError);
  });

  it("flag desconocido LANZA", () => {
    expect(() => parseArgs(["--nope"])).toThrow(SeedCliArgsError);
  });
});

describe("decidirDryRun", () => {
  it("es dry-run si el operador lo pidió", () => {
    expect(decidirDryRun({ dryRun: true, serviceKey: "k" })).toBe(true);
  });

  it("es dry-run si NO hay service key (no toca DB sin key)", () => {
    expect(decidirDryRun({ serviceKey: "" })).toBe(true);
    expect(decidirDryRun({})).toBe(true);
  });

  it("es LIVE si hay key y no se pidió dry-run", () => {
    expect(decidirDryRun({ serviceKey: "sb_secret_x" })).toBe(false);
  });
});
