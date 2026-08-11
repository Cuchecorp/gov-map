// anotacion-cli.ts — congela los DOS artefactos de entradas de anotación (A y B, órdenes
// descorrelacionados) + el prompt único compartido, desde `muestra-133b.json` +
// `pool-133b.json` (cero red, cero DB) — D-133b-4, plan 133-b-05.
//
// Este CLI NO etiqueta. Los anotadores corren después, cada uno con su artefacto y el mismo
// prompt. El CLI corre `verificarCeguera` sobre cada artefacto ANTES de escribirlo.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  construirEntradasAnotacion,
  armarArtefactoAnotacion,
  derivarPromptAnotacion,
} from "./anotacion.js";
import { SEMILLA, type CasoMuestraCalib } from "./calibracion.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";
import type { PoolCaso } from "./pool-r2.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const MUESTRA_PATH = join(AQUI, "muestra-133b.json");
const POOL_PATH = join(AQUI, "pool-133b.json");
const ENTRADAS_A_PATH = join(AQUI, "anotacion-entradas-a.json");
const ENTRADAS_B_PATH = join(AQUI, "anotacion-entradas-b.json");
const PROMPT_PATH = join(AQUI, "anotacion-prompt.txt");
const VENTANA = "2026-08-05..2026-08-07";

interface MuestraArchivo {
  semilla: string;
  casos: CasoMuestraCalib[];
}

export function generarEntradasAnotacion(): {
  n: number;
  shaA: string;
  shaB: string;
  shaPrompt: string;
  ordenesDistintos: boolean;
} {
  const muestra = JSON.parse(readFileSync(MUESTRA_PATH, "utf8")) as MuestraArchivo;
  if (muestra.semilla !== SEMILLA) {
    throw new Error(
      `anotacion-cli: la semilla de muestra-133b.json ("${muestra.semilla}") no coincide con la SEMILLA oficial ("${SEMILLA}") — la muestra se movió, escalar`,
    );
  }
  const pool = JSON.parse(readFileSync(POOL_PATH, "utf8")) as PoolCaso[];

  const entradas = construirEntradasAnotacion(muestra.casos, pool);
  const artefactoA = armarArtefactoAnotacion({ semilla: SEMILLA, ventana: VENTANA, anotador: "a", entradas });
  const artefactoB = armarArtefactoAnotacion({ semilla: SEMILLA, ventana: VENTANA, anotador: "b", entradas });

  const idsA = artefactoA.casos.map((c) => c.id).join("|");
  const idsB = artefactoB.casos.map((c) => c.id).join("|");
  const idsBase = entradas.map((c) => c.id).join("|");
  const ordenesDistintos = idsA !== idsB && idsA !== idsBase && idsB !== idsBase;
  if (!ordenesDistintos) {
    throw new Error(
      "anotacion-cli: los órdenes de A y B deben diferir entre sí y del orden base — orden correlacionado detectado (D-133b-4)",
    );
  }

  const rawA = canonicalizar(artefactoA);
  const rawB = canonicalizar(artefactoB);
  const prompt = derivarPromptAnotacion();
  writeFileSync(ENTRADAS_A_PATH, rawA, "utf8");
  writeFileSync(ENTRADAS_B_PATH, rawB, "utf8");
  writeFileSync(PROMPT_PATH, prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8");

  return {
    n: entradas.length,
    shaA: sha256(rawA),
    shaB: sha256(rawB),
    shaPrompt: sha256(prompt.endsWith("\n") ? prompt : `${prompt}\n`),
    ordenesDistintos,
  };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  try {
    const r = generarEntradasAnotacion();
    console.log(
      `anotacion: casos=${r.n} ordenesDistintos=${r.ordenesDistintos} cegueraA=OK cegueraB=OK`,
    );
    console.log(`anotacion-cli: sha_a=${r.shaA}`);
    console.log(`anotacion-cli: sha_b=${r.shaB}`);
    console.log(`anotacion-cli: sha_prompt=${r.shaPrompt}`);
  } catch (err) {
    console.error("anotacion-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
