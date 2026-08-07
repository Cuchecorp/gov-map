// cobertura-cli.ts — confirmación reproducible de la cobertura de `prefiltro.terminos` sobre
// el censo P (D-133-F2.2, D-133b-3 paso 1).
//
// Este chequeo es CONFIRMACIÓN, no remediación: la cobertura ya se midió en 100,00 %
// (133-b-PREMORTEM §P-02). Corre ANTES de etiquetar porque subir el límite de truncado
// después mueve el hash del `golden-set.json` y obliga a re-etiquetar todo el golden.
//
// Cero red, cero DB: lee `pool-133b.json` y `muestra-133b.json`, ambos congelados por
// 133-b-01/02. No se escribe ningún artefacto JSON nuevo — la confirmación vive en el
// SUMMARY y en los tests; un segundo artefacto congelado sería una segunda fuente de verdad
// que se puede desincronizar.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verificarCobertura, medirCobertura, UMBRAL_COBERTURA, type CasoCobertura } from "./cobertura.js";
import type { PoolCaso } from "./pool-r2.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const POOL_PATH = join(AQUI, "pool-133b.json");
const MUESTRA_PATH = join(AQUI, "muestra-133b.json");

interface MuestraCaso {
  caso_id: string;
  estrato: string;
}

export interface ConfirmarCoberturaResultado {
  total: number;
  cubiertos: number;
  sinTerminos: number;
  cobertura: number;
  gradiente: { t200: number; t80: number; t0: number; tvacio: number };
  gate: "PASA" | "FALLA";
}

/**
 * Confirma la cobertura sobre el censo P del pool congelado, con el gradiente completo
 * (200/80/0/vacío chars) como parte del reporte. Antes de medir, asserta que los `caso_id`
 * `estado='pasa'` del pool y el estrato `P` de la muestra son el MISMO conjunto de 74 — si
 * difieren, el censo dejó de ser censo y hay que escalar.
 */
export function confirmarCobertura(): ConfirmarCoberturaResultado {
  const pool = JSON.parse(readFileSync(POOL_PATH, "utf8")) as PoolCaso[];
  const muestra = JSON.parse(readFileSync(MUESTRA_PATH, "utf8")) as { casos: MuestraCaso[] };

  const censoPPool = pool.filter((c) => c.estado === "pasa");
  const censoPMuestra = muestra.casos.filter((c) => c.estrato === "P");

  const idsPool = new Set(censoPPool.map((c) => c.caso_id));
  const idsMuestra = new Set(censoPMuestra.map((c) => c.caso_id));
  const soloEnPool = [...idsPool].filter((id) => !idsMuestra.has(id));
  const soloEnMuestra = [...idsMuestra].filter((id) => !idsPool.has(id));
  if (soloEnPool.length > 0 || soloEnMuestra.length > 0) {
    throw new Error(
      `cobertura-cli: el censo P del pool y el estrato P de la muestra DIVERGEN — ` +
        `soloEnPool=[${soloEnPool.join(", ")}] soloEnMuestra=[${soloEnMuestra.join(", ")}]`,
    );
  }

  const casos: CasoCobertura[] = censoPPool.map((c) => ({
    caso_id: c.caso_id,
    titulo: c.titulo,
    descripcion: c.descripcion,
  }));

  let resultado;
  let gate: "PASA" | "FALLA" = "PASA";
  try {
    resultado = verificarCobertura(casos);
  } catch (err) {
    gate = "FALLA";
    throw err;
  }

  // Gradiente completo — SOLO para el reporte, truncadores triviales inyectados en la
  // medición (jamás mutan `prefiltro-lexico.ts`).
  const t200 = medirCobertura(casos, { truncador: (s) => s.slice(0, 200) }).cubiertos;
  const t80 = medirCobertura(casos, { truncador: (s) => s.slice(0, 80) }).cubiertos;
  const t0 = medirCobertura(casos, { truncador: () => "" }).cubiertos;
  const tvacio = medirCobertura(
    casos.map((c) => ({ ...c, titulo: "" })),
    { truncador: () => "" },
  ).cubiertos;

  return {
    total: resultado.total,
    cubiertos: resultado.cubiertos,
    sinTerminos: resultado.sinTerminos,
    cobertura: resultado.cobertura,
    gradiente: { t200, t80, t0, tvacio },
    gate,
  };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  try {
    const r = confirmarCobertura();
    console.log(
      `cobertura: total=${r.total} cubiertos=${r.cubiertos} sinTerminos=${r.sinTerminos} ` +
        `pct=${r.cobertura.toFixed(4)} t200=${r.gradiente.t200} t80=${r.gradiente.t80} ` +
        `t0=${r.gradiente.t0} tvacio=${r.gradiente.tvacio} umbral=${UMBRAL_COBERTURA} gate=${r.gate}`,
    );
  } catch (err) {
    console.error("cobertura-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
