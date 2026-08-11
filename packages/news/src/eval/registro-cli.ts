// registro-cli.ts — fusiona las salidas de los anotadores A/B (16 lotes en un directorio
// externo al repo) y congela `registro-anotacion.json` (C2.5) — plan 133-b-05 T4.
//
// La validación es bloqueante: si alguna salida es inválida (cobertura, etiqueta ilegal,
// cita no literal, justificación >200) el CLI imprime la lista de problemas y sale ≠0 SIN
// escribir el registro. Los lotes inválidos se re-corren; jamás se maquillan.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { construirEntradasAnotacion } from "./anotacion.js";
import { construirRegistro, validarSalidaAnotador, type SalidaAnotadorItem } from "./registro.js";
import { SEMILLA, type CasoMuestraCalib } from "./calibracion.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";
import type { PoolCaso } from "./pool-r2.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const REGISTRO_PATH = join(AQUI, "registro-anotacion.json");
const REVISADO_EN = "2026-08-10";

interface LoteArchivo {
  anotador: "a" | "b";
  lote: number;
  etiquetas: SalidaAnotadorItem[];
}

export function fusionarYCongelar(dirLotes: string): {
  n: number;
  acuerdos: number;
  desacuerdos: number;
  sha: string;
} {
  const muestra = JSON.parse(readFileSync(join(AQUI, "muestra-133b.json"), "utf8")) as {
    semilla: string;
    casos: CasoMuestraCalib[];
  };
  if (muestra.semilla !== SEMILLA) {
    throw new Error("registro-cli: semilla de muestra-133b.json no coincide con la oficial");
  }
  const pool = JSON.parse(readFileSync(join(AQUI, "pool-133b.json"), "utf8")) as PoolCaso[];
  const entradas = construirEntradasAnotacion(muestra.casos, pool);

  const archivos = readdirSync(dirLotes).filter((f) => /^anot-[ab]-\d\d\.json$/.test(f));
  if (archivos.length === 0) {
    throw new Error(`registro-cli: cero lotes en ${dirLotes} (cero vacuo)`);
  }
  const salidaA: SalidaAnotadorItem[] = [];
  const salidaB: SalidaAnotadorItem[] = [];
  for (const archivo of archivos.sort()) {
    const lote = JSON.parse(readFileSync(join(dirLotes, archivo), "utf8")) as LoteArchivo;
    (lote.anotador === "a" ? salidaA : salidaB).push(...lote.etiquetas);
  }

  // Diagnóstico legible ANTES del throw de construirRegistro (misma validación, dos usos).
  const problemas = [
    ...validarSalidaAnotador(salidaA, entradas).map((p) => ({ ...p, anotador: "a" })),
    ...validarSalidaAnotador(salidaB, entradas).map((p) => ({ ...p, anotador: "b" })),
  ];
  if (problemas.length > 0) {
    for (const p of problemas) console.error(`INVALIDO ${p.anotador}/${p.id}: ${p.problema}`);
    throw new Error(`registro-cli: ${problemas.length} problemas de validación — registro NO escrito`);
  }

  const calibracion = JSON.parse(readFileSync(join(AQUI, "calibracion-20.json"), "utf8")) as {
    casos: Array<{ id: string }>;
  };
  const idsCalibracion = new Set(calibracion.casos.map((c) => c.id));

  const filas = construirRegistro({ salidaA, salidaB, entradas, idsCalibracion, revisadoEn: REVISADO_EN });
  // Ronda de anotación: 1 = prompt original; 2 = re-instrucción C2.1.3 (133-b-06). El sha
  // del prompt usado viaja en el artefacto para que el κ sea auditable contra su instrucción.
  const promptRaw = readFileSync(join(AQUI, "anotacion-prompt.txt"), "utf8");
  const artefacto = {
    semilla: SEMILLA,
    ventana: "2026-08-05..2026-08-07",
    ronda: 2,
    sha_prompt: sha256(promptRaw),
    revisado_en: REVISADO_EN,
    filas,
  };
  const raw = canonicalizar(artefacto);
  writeFileSync(REGISTRO_PATH, raw, "utf8");

  const acuerdos = filas.filter((f) => f.acuerdo).length;
  return { n: filas.length, acuerdos, desacuerdos: filas.length - acuerdos, sha: sha256(raw) };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  const dirLotes = process.argv[2];
  if (!dirLotes) {
    console.error("uso: registro-cli.ts <dir-con-lotes anot-[ab]-NN.json>");
    process.exit(2);
  }
  try {
    const r = fusionarYCongelar(dirLotes);
    console.log(
      `registro: casos=${r.n} acuerdos=${r.acuerdos} desacuerdos=${r.desacuerdos} acuerdoBruto=${(r.acuerdos / r.n).toFixed(4)}`,
    );
    console.log(`registro-cli: sha256=${r.sha} (NO es el hash del golden-set.json)`);
  } catch (err) {
    console.error("registro-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
