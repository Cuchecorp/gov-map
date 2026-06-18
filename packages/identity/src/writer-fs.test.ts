import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsSeedFileWriter } from "./writer-fs";

describe("FsSeedFileWriter", () => {
  it("escribe el contenido a disco creando el directorio padre", async () => {
    const dir = await mkdtemp(join(tmpdir(), "obs-seed-"));
    try {
      const w = new FsSeedFileWriter({ cwd: dir });
      // ruta anidada inexistente -> debe crear supabase/seeds/.
      await w.write("supabase/seeds/parlamentario.seed.json", "[]\n");
      const out = await readFile(
        join(dir, "supabase/seeds/parlamentario.seed.json"),
        "utf8",
      );
      expect(out).toBe("[]\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("sobrescribe en una segunda corrida (idempotente: mismo input -> mismo archivo)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "obs-seed-"));
    try {
      const w = new FsSeedFileWriter({ cwd: dir });
      const content = '[{"id":"D1"}]\n';
      await w.write("out.json", content);
      await w.write("out.json", content);
      const out = await readFile(join(dir, "out.json"), "utf8");
      expect(out).toBe(content);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
