// calibracion-cli.ts — congela el artefacto de calibración a ciegas (20 casos + glosa) desde
// `muestra-133b.json` + `pool-133b.json` (cero red, cero DB) — D-133-C2.1.2, D-133b-5.
//
// Este CLI NO etiqueta y NO corre anotadores. Si aparece la tentación de "pre-etiquetar para
// ayudar al operador", eso destruiría κ(humano↔máquina): PARAR.
//
// El CLI corre `verificarCeguera` sobre lo que acaba de escribir y falla si no pasa: el
// artefacto no puede quedar en disco sin haber pasado el guard.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { seleccionarCalibracion, verificarCeguera, derivarGlosa, SEMILLA, type CasoMuestraCalib } from "./calibracion.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";
import type { PoolCaso } from "./pool-r2.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const MUESTRA_PATH = join(AQUI, "muestra-133b.json");
const POOL_PATH = join(AQUI, "pool-133b.json");
const CALIBRACION_PATH = join(AQUI, "calibracion-20.json");

interface MuestraArchivo {
  semilla: string;
  casos: CasoMuestraCalib[];
}

export function generarCalibracion(): {
  path: string;
  sha256: string;
  ids: string[];
  porEstrato: { P: number; alea: number; sonda: number };
} {
  const muestra = JSON.parse(readFileSync(MUESTRA_PATH, "utf8")) as MuestraArchivo;
  if (muestra.semilla !== SEMILLA) {
    throw new Error(
      `calibracion-cli: la semilla de muestra-133b.json ("${muestra.semilla}") no coincide con la SEMILLA oficial ("${SEMILLA}") — la muestra se movió, escalar`,
    );
  }

  const pool = JSON.parse(readFileSync(POOL_PATH, "utf8")) as PoolCaso[];
  const poolPorHash = new Map(pool.map((c) => [c.url_hash, c]));

  const ids = seleccionarCalibracion({ muestra: muestra.casos, semilla: SEMILLA });

  const porCasoId = new Map(muestra.casos.map((c) => [c.caso_id, c]));
  const casosCiegos = ids.map((id) => {
    const casoMuestra = porCasoId.get(id);
    if (!casoMuestra) {
      throw new Error(`calibracion-cli: id "${id}" de la selección no existe en muestra-133b.json`);
    }
    const casoPool = poolPorHash.get(casoMuestra.url_hash);
    if (!casoPool) {
      throw new Error(`calibracion-cli: url_hash "${casoMuestra.url_hash}" no existe en pool-133b.json`);
    }
    return {
      id: casoMuestra.caso_id,
      titulo: casoPool.titulo,
      descripcion: casoPool.descripcion ?? "",
      outlet: casoPool.outlet,
      // `fecha_pub` se copia TAL CUAL (ISO con el offset original del feed) — jamás pasar por
      // un constructor de fecha nativo que normalice a UTC (gotcha rector de tz,
      // parse-rss.ts:74-87). null si el feed no traía pubDate.
      fecha: casoPool.fecha_pub,
    };
  });

  const artefacto = {
    semilla: SEMILLA,
    ventana: "2026-08-05..2026-08-07",
    glosa: derivarGlosa(),
    casos: casosCiegos,
  };

  // El CLI corre el guard sobre lo que va a escribir ANTES de escribirlo: el artefacto nunca
  // queda en disco sin haber pasado la ceguera.
  verificarCeguera(artefacto);

  const raw = canonicalizar(artefacto);
  writeFileSync(CALIBRACION_PATH, raw, "utf8");

  const porEstrato = { P: 0, alea: 0, sonda: 0 };
  for (const id of ids) {
    const estrato = porCasoId.get(id)!.estrato;
    if (estrato === "P") porEstrato.P += 1;
    else if (estrato === "N-alea") porEstrato.alea += 1;
    else porEstrato.sonda += 1;
  }

  return { path: CALIBRACION_PATH, sha256: sha256(raw), ids, porEstrato };
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  try {
    const { sha256: sha, ids, porEstrato } = generarCalibracion();
    const artefacto = JSON.parse(readFileSync(CALIBRACION_PATH, "utf8"));
    const r = verificarCeguera(artefacto);
    const outlets = new Set(artefacto.casos.map((c: { outlet: string }) => c.outlet));
    const sinDescripcion = artefacto.casos.filter((c: { descripcion: string }) => c.descripcion.trim().length === 0)
      .length;
    console.log(
      `calibracion: casos=${ids.length} P=${porEstrato.P} alea=${porEstrato.alea} sonda=${porEstrato.sonda} ` +
        `outlets=${outlets.size} sinDescripcion=${sinDescripcion} clavesEscaneadas=${r.clavesEscaneadas} ceguera=OK`,
    );
    console.log(`calibracion-cli: sha256=${sha} (NO es el hash del golden-set.json)`);
  } catch (err) {
    console.error("calibracion-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
