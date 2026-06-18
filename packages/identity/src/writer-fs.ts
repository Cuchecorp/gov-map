/**
 * writer-fs — impl REAL del `SeedFileWriter` inyectable (Plan 03 lo dejó como interfaz).
 *
 * Escribe el snapshot de `exportMaestra` a disco (autoritativo en git = ID-09). Crea el
 * directorio padre si falta (`supabase/seeds/`) y escribe UTF-8 sin BOM. Determinismo y
 * orden de claves los garantiza `serializeMaestra` (backup.ts); este writer solo toca disco.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { SeedFileWriter } from "./backup";

export interface FsSeedFileWriterOptions {
  /** Raíz desde la que se resuelven rutas relativas (default: process.cwd()). */
  cwd?: string;
}

/** Writer que persiste el snapshot a disco real, creando el directorio padre si falta. */
export class FsSeedFileWriter implements SeedFileWriter {
  private readonly cwd: string;

  constructor(opts: FsSeedFileWriterOptions = {}) {
    this.cwd = opts.cwd ?? process.cwd();
  }

  async write(path: string, content: string): Promise<void> {
    const abs = resolve(this.cwd, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, { encoding: "utf8" });
  }
}
