// canonicalizar-cli.ts — genera las dos proyecciones canónicas congeladas de 133-a
// (D-133-E2): taxonomia.json y thresholds.json. Importa TAXONOMIA/THRESHOLDS por RUTA
// RELATIVA (prohibido tocar ./index.ts, propiedad exclusiva del plan 133-01). Escribe con
// writeFileSync(path, str, "utf8") — Node nunca traduce newlines ni escribe BOM al construir
// un string en memoria, así que los bytes escritos son exactamente los de `canonicalizar()`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TAXONOMIA } from "./taxonomia.js";
import { THRESHOLDS } from "./thresholds.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Genera y escribe los dos JSON canónicos; devuelve sus rutas y sha256 para el CLI/tests. */
export function generarProyecciones(): {
  taxonomia: { path: string; sha256: string };
  thresholds: { path: string; sha256: string };
} {
  const taxonomiaPath = join(AQUI, "taxonomia.json");
  const thresholdsPath = join(AQUI, "thresholds.json");

  const taxonomiaRaw = canonicalizar(TAXONOMIA);
  const thresholdsRaw = canonicalizar(THRESHOLDS);

  writeFileSync(taxonomiaPath, taxonomiaRaw, "utf8");
  writeFileSync(thresholdsPath, thresholdsRaw, "utf8");

  return {
    taxonomia: { path: taxonomiaPath, sha256: sha256(taxonomiaRaw) },
    thresholds: { path: thresholdsPath, sha256: sha256(thresholdsRaw) },
  };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";

if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  const resultado = generarProyecciones();
  console.log(`taxonomia.json sha256: ${resultado.taxonomia.sha256}`);
  console.log(`thresholds.json sha256: ${resultado.thresholds.sha256}`);
}
