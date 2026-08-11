// Guard de NO-DIVERGENCIA (134-01, D-133-H): `packages/news/src/resolver/boletin-en-materia.ts`
// es una COPIA VERBATIM de `app/lib/boletin-en-materia.ts`. No se movió el símbolo porque
// `app/` no tiene dependencias workspace y añadir `@obs/news` al build OpenNext/Docker es un
// riesgo de deploy que 134 no puede verificar localmente. La deuda de la constante replicada
// (ICS) se neutraliza AQUÍ: si cualquiera de los dos archivos cambia sin el otro, este test
// cae en CI. Un cambio legítimo se hace en AMBOS archivos en el mismo commit.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extraerBoletines } from "./boletin-en-materia";

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIA_PKG = join(AQUI, "boletin-en-materia.ts");
const ORIGINAL_APP = join(AQUI, "..", "..", "..", "..", "app", "lib", "boletin-en-materia.ts");

describe("resolver/boletin-en-materia — equivalencia con app/lib (134-01)", () => {
  it("(a) byte-identidad: la copia del package es EXACTAMENTE el archivo de app/lib", () => {
    const pkg = readFileSync(COPIA_PKG, "utf8");
    const app = readFileSync(ORIGINAL_APP, "utf8");
    expect(pkg.length).toBeGreaterThan(1000); // anti cero-vacuo: no comparar dos vacíos
    expect(pkg).toBe(app);
  });

  it("(b) humo de comportamiento: reglas LOCKED intactas en la copia", () => {
    expect(extraerBoletines("Boletines 14309-04 y 12.345-06")).toEqual(["12345-06", "14309-04"]);
    expect(extraerBoletines("el boletín 14309.")).toEqual(["14309"]);
    expect(extraerBoletines("Ley 20.730")).toEqual([]);
    expect(extraerBoletines("20730")).toEqual([]);
    expect(extraerBoletines(null)).toEqual([]);
  });
});
