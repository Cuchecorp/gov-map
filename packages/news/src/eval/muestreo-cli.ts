// muestreo-cli.ts — congela la muestra 133-b (P censo + N-sonda + N-alea) desde
// `pool-133b.json` (cero red, cero DB) y su hash de COMPOSICIÓN (D-133b-3).
//
// Este NO es el hash del `golden-set.json`. Ese se emite una sola vez, al final, en el
// plan 133-b-07. Este hash congela QUÉ CASOS componen la muestra, antes de que exista una
// sola etiqueta.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { muestrear, hashComposicion, contieneTokenPrefijo, TOKENS_INSTITUCIONALES, SEMILLA } from "./muestreo.js";
import { canonicalizar } from "./canonicalizar-json.js";
import type { PoolCaso } from "./pool-r2.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const POOL_PATH = join(AQUI, "pool-133b.json");
const MUESTRA_PATH = join(AQUI, "muestra-133b.json");

const N_SONDA = 30;
const N_ALEA = 50;

/** Descripción textual de la regla de matching, escrita en el artefacto (P-03: 68 prohibida
 * por `String.includes` / 60 LA REGLA con prefijo-frontera-izquierda / 57 anula `subsecretari`
 * con frontera completa). */
const GLOSA_REGLA =
  "Prefijo de palabra con frontera IZQUIERDA obligatoria (sin frontera derecha) sobre " +
  "titulo+descripcion foldeados: permite que el stem truncado 'subsecretari' case " +
  "subsecretaria/subsecretario/subsecretaria. String.includes esta PROHIBIDO por regimen.";

export function generarMuestra(): {
  path: string;
  hashComposicion: string;
  stats: ReturnType<typeof muestrear>["stats"];
} {
  const pool = JSON.parse(readFileSync(POOL_PATH, "utf8")) as PoolCaso[];
  const resultado = muestrear({ pool, semilla: SEMILLA, nSonda: N_SONDA, nAlea: N_ALEA });

  const entradas = [
    ...resultado.P.map((c) => ({ caso_id: c.caso_id, url_hash: c.url_hash, outlet: c.outlet, estrato: "P" })),
    ...resultado.sonda.map((c) => ({
      caso_id: c.caso_id,
      url_hash: c.url_hash,
      outlet: c.outlet,
      estrato: "N-sonda",
    })),
    ...resultado.alea.map((c) => ({
      caso_id: c.caso_id,
      url_hash: c.url_hash,
      outlet: c.outlet,
      estrato: "N-alea",
    })),
  ];

  const hash = hashComposicion(entradas.map((e) => ({ caso_id: e.caso_id, estrato: e.estrato })));

  const artefacto = {
    semilla: SEMILLA,
    ventana: "2026-08-05..2026-08-07",
    regla_matching_sonda: "prefijo-frontera-izquierda",
    regla_matching_sonda_glosa: GLOSA_REGLA,
    n: { P: resultado.P.length, sonda: resultado.sonda.length, alea: resultado.alea.length },
    casos: entradas,
    porToken: resultado.stats.porToken,
    tasa_sin_descripcion: resultado.stats.tasa_sin_descripcion,
    tasa_sin_descripcion_por_estrato: resultado.stats.tasa_sin_descripcion_por_estrato,
    porOutletP: resultado.stats.porOutletP,
    hash_composicion: hash,
  };

  writeFileSync(MUESTRA_PATH, canonicalizar(artefacto), "utf8");

  return { path: MUESTRA_PATH, hashComposicion: hash, stats: resultado.stats };
}

/** Línea de una sola pieza, gates numéricos incluidos (nombres de campo sin dígitos).
 * `sinDescripcion` es un CONTEO de casos (entero, anti-cero-vacuo `-gt 0` en el gate), no la
 * tasa fraccionaria (que sí queda en el JSON como `tasa_sin_descripcion`).
 * `aleaConToken` (hallazgo del coordinador, post-cierre): cuántos casos de `N-alea` llevan un
 * token institucional — con la exclusión CORRECTA (solo los sorteados como sonda, no el pool
 * elegible completo) debe ser >=1; un 0 aquí es la señal exacta del bug que corrigió esto. */
function lineaResumen(resultado: ReturnType<typeof muestrear>, hash: string): string {
  const todos = [...resultado.P, ...resultado.sonda, ...resultado.alea];
  const total = todos.length;
  const sinDescripcionCount = todos.filter((c) => (c.descripcion ?? "").trim().length === 0).length;
  const tokenSubsecretari = resultado.stats.porToken["subsecretari"] ?? 0;
  const aleaConToken = resultado.alea.filter((c) => {
    const texto = `${c.titulo} ${c.descripcion ?? ""}`
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    return TOKENS_INSTITUCIONALES.some((t) => contieneTokenPrefijo(texto, t));
  }).length;
  return (
    `muestra: P=${resultado.P.length} sonda=${resultado.sonda.length} alea=${resultado.alea.length} ` +
    `total=${total} elegiblesSonda=${resultado.stats.elegiblesSonda} ` +
    `restoTrasSonda=${resultado.stats.restoTrasSonda} sinDescripcion=${sinDescripcionCount} ` +
    `tokenSubsecretari=${tokenSubsecretari} aleaConToken=${aleaConToken} hash=${hash}`
  );
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  const pool = JSON.parse(readFileSync(POOL_PATH, "utf8")) as PoolCaso[];
  const resultado = muestrear({ pool, semilla: SEMILLA, nSonda: N_SONDA, nAlea: N_ALEA });
  const { hashComposicion: hash } = generarMuestra();
  console.log(lineaResumen(resultado, hash));
}
