// muestreo.ts — PRNG determinista sembrado + orden total + estratificación disjunta del
// golden set de 133-b (D-133b-2, D-133b-3).
//
// La semilla `133-b-golden-2026` vive AQUÍ, escrita, no en la cabeza de quien corrió el
// script — y se vuelca al artefacto (`muestra-133b.json`) para que el muestreo sea
// reproducible por cualquiera que lea el repo. El PRNG NO es criptografía: el requisito es
// determinismo (misma semilla ⇒ misma secuencia) y sensibilidad a la semilla (semilla
// distinta ⇒ secuencia distinta), no uniformidad estadística perfecta — el generador nativo
// no sembrado del lenguaje NO sirve porque no es reproducible entre corridas.
//
// El orden total sobre `url_hash` se aplica EN CÓDIGO, con un comparador explícito de
// strings — NUNCA con un `ORDER BY` de Postgres (la colación de la DB no es parte del
// contrato de reproducibilidad del golden) y NUNCA con un método de comparación sensible a
// locale/ICU (gotcha rector v6.1/v12.0).

import { fold } from "../prefiltro-lexico.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";
import type { PoolCaso } from "./pool-r2.js";

/** Semilla LOCKED (D-133b-2): valor auditable, escrito en el módulo y en el artefacto. */
export const SEMILLA = "133-b-golden-2026";

/**
 * PRNG determinista sembrado por cadena: deriva un estado de 32 bits de `sha256(semilla)`
 * (primeros 8 hex) y avanza con mulberry32 (entero puro, auto-contenido, cero dependencia
 * nueva). NO es criptografía — el contrato es determinismo + sensibilidad a la semilla.
 * Dos instancias con la misma cadena producen la misma secuencia; con cadenas distintas,
 * secuencias distintas.
 */
export function prngDeSemilla(semilla: string): () => number {
  const hex = sha256(semilla).slice(0, 8);
  let estado = parseInt(hex, 16) >>> 0;
  return function mulberry32(): number {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Orden total ascendente por `url_hash`, comparador EXPLÍCITO de strings — PROHIBIDO un
 * método de comparación sensible a locale. No muta la entrada. El orden se aplica aquí,
 * jamás en un `ORDER BY` de Postgres.
 */
export function ordenarPorHash<T extends { url_hash: string }>(casos: readonly T[]): T[] {
  return [...casos].sort((a, b) => (a.url_hash < b.url_hash ? -1 : a.url_hash > b.url_hash ? 1 : 0));
}

/**
 * Fisher-Yates COMPLETO consumiendo el PRNG — PROHIBIDO ordenar con un comparador que
 * devuelve un signo aleatorio en cada llamada: eso no es un barajado uniforme y depende del
 * algoritmo de ordenamiento del runtime. Opera sobre una copia.
 */
function barajar<T>(lista: readonly T[], prng: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = copia[i]!;
    copia[i] = copia[j]!;
    copia[j] = tmp;
  }
  return copia;
}

/**
 * Los 8 tokens institucionales de D-133-B2.1, ya foldeados y congelados (`Object.freeze`).
 * `subsecretari` es un STEM truncado A PROPÓSITO (cubre subsecretario/a/ía) — ampliarlos o
 * podarlos exige un nuevo plan, misma disciplina que `VOCABULARIO_LEGISLATIVO`.
 */
export const TOKENS_INSTITUCIONALES: readonly string[] = Object.freeze(
  [
    "ministro",
    "gobierno",
    "la moneda",
    "contraloria",
    "presidente",
    "subsecretari",
    "oficialismo",
    "oposicion",
  ].map(fold),
);

/** Frontera de palabra sobre texto foldeado (misma clase que `prefiltro-lexico.ts:53`). */
const FRONTERA = "[^a-z0-9]";

function escaparRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * RÉPLICA deliberada del patrón de `prefiltro-lexico.ts:65-70` con la frontera derecha
 * ELIMINADA. No es reutilización porque `escaparRegExp`/`FRONTERA` son privados en ambos
 * módulos, y el helper de frontera COMPLETA de `entrada-llm.ts` (el que exige también
 * frontera derecha) haría desaparecer el token stem `subsecretari` (0 matches con frontera
 * completa, 4 con prefijo — P-03) — por eso NO se importa esa función aquí, se replica el
 * patrón sin su mitad derecha. `String.includes` sigue PROHIBIDO
 * (`prefiltro-lexico.ts:167-168`): replicar el patrón jamás significa relajarlo.
 *
 * Casa por PREFIJO de palabra: frontera izquierda obligatoria (`(^|[^a-z0-9])<token>`), sin
 * frontera derecha — así `subsecretari` casa `subsecretaria`/`subsecretario`/`subsecretaría`
 * (ya foldeada). La frontera izquierda es la que impide que `administrador` cuente para
 * `ministro` (el token no empieza en un límite de palabra dentro de "administrador").
 */
export function contieneTokenPrefijo(textoFoldeado: string, tokenFoldeado: string): boolean {
  const re = new RegExp(`(^|${FRONTERA})${escaparRegExp(tokenFoldeado)}`);
  return re.test(textoFoldeado);
}

/** Subconjunto de `PoolCaso` que necesita el muestreo (estado + texto). */
type CasoMuestreable = Pick<PoolCaso, "caso_id" | "url_hash" | "outlet" | "estado" | "titulo" | "descripcion">;

/**
 * Casos con `estado` de DESCARTE (nunca `pasa`) cuyo `titulo + descripcion` foldeado
 * contiene al menos uno de los 8 `TOKENS_INSTITUCIONALES` por prefijo de palabra. Sobre los
 * 505 descartes reales de la ventana 133-b, esta función devuelve 60 — verificado por test
 * sobre el pool congelado (133-b-01).
 */
export function elegiblesSonda<T extends CasoMuestreable>(casos: readonly T[]): T[] {
  return casos.filter((c) => {
    if (c.estado === "pasa") return false;
    const texto = fold(`${c.titulo} ${c.descripcion ?? ""}`);
    return TOKENS_INSTITUCIONALES.some((t) => contieneTokenPrefijo(texto, t));
  });
}

/** Desglose por token: cuántos descartes aporta cada uno de los 8 (hace auditable el 60). */
function porToken<T extends CasoMuestreable>(descartes: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const token of TOKENS_INSTITUCIONALES) {
    out[token] = descartes.filter((c) => {
      const texto = fold(`${c.titulo} ${c.descripcion ?? ""}`);
      return contieneTokenPrefijo(texto, token);
    }).length;
  }
  return out;
}

function tasaSinDescripcion<T extends { descripcion: string | null }>(casos: readonly T[]): number {
  if (casos.length === 0) return 0;
  const sin = casos.filter((c) => (c.descripcion ?? "").trim().length === 0).length;
  return sin / casos.length;
}

export interface MuestreoOpts<T extends CasoMuestreable> {
  pool: readonly T[];
  semilla: string;
  nSonda: number;
  nAlea: number;
}

export interface MuestreoStats {
  poblacion: number;
  nP: number;
  nDescartes: number;
  elegiblesSonda: number;
  restoTrasSonda: number;
  porToken: Record<string, number>;
  tasa_sin_descripcion: number;
  tasa_sin_descripcion_por_estrato: { P: number; sonda: number; alea: number };
  porOutletP: Record<string, number>;
}

export interface MuestreoResultado<T extends CasoMuestreable> {
  P: T[];
  sonda: T[];
  alea: T[];
  stats: MuestreoStats;
}

/**
 * Estratificación disjunta por construcción (D-133b-2, orden LOCKED):
 *   1. Partir el pool en `pasa` (censo P) / descarte por `estado` de la DB.
 *   2. `P` = TODOS los `pasa`, ordenados por `url_hash` — censo, jamás sorteado.
 *   3. `elegiblesSonda(descartes)` → ordenar por hash → barajar con PRNG re-sembrado
 *      `` `${semilla}:sonda` `` → tomar `nSonda`, PRIMERO.
 *   4. `resto = descartes − sonda` (SOLO los `nSonda` casos efectivamente sorteados en el paso
 *      3 — D-133b-2: *"`N-alea` se sortea sobre la población menos los YA TOMADOS"*, y "los ya
 *      tomados" son los sorteados, no el pool elegible completo) → ordenar por hash → barajar
 *      con PRNG re-sembrado `` `${semilla}:alea` `` → tomar `nAlea`.
 *
 * CORREGIDO (hallazgo del coordinador, post-cierre de 133-b-02): una versión anterior excluía
 * el pool COMPLETO de 60 elegibles de `alea` (505−60=445), no solo los 30 sorteados. Es
 * INCORRECTO y no es cosmético: vaciaba `N-alea` de exactamente los casos con mayor
 * probabilidad de ser falso negativo del pre-filtro (los que llevan token institucional pero
 * no fueron elegidos como sonda) — el estrato que existe para ESTIMAR esa tasa de falso
 * negativo quedaba sistemáticamente sesgado hacia casos sin token, dando una tasa optimista
 * por construcción, sin que ningún test fallara. La cifra correcta es 505−30=475, y `alea`
 * SÍ puede (y en la práctica debe) contener casos elegibles-no-sorteados con token
 * institucional — verificado por test: `N-alea` contiene al menos un caso así.
 *
 * El PRNG se re-siembra POR ESTRATO para que cambiar `nSonda` no desplace la secuencia de
 * `alea` completa. `sonda ∩ alea = ∅` por construcción (se excluyen los IDs de `sonda`, no los
 * de `elegibles`) y `P ∩ (sonda ∪ alea) = ∅` porque ambos se sortean solo sobre `descartes`.
 * LANZA si algún estrato tiene menos elegibles que el `n` pedido — jamás rellena en silencio
 * ni baja el `n`. No filtra por descripción: los casos sin bajada entran como cualquier otro
 * (P-04).
 */
export function muestrear<T extends CasoMuestreable>(opts: MuestreoOpts<T>): MuestreoResultado<T> {
  const { pool, semilla, nSonda, nAlea } = opts;

  const pasa = pool.filter((c) => c.estado === "pasa");
  const descartes = pool.filter((c) => c.estado !== "pasa");

  const P = ordenarPorHash(pasa);

  const elegibles = elegiblesSonda(descartes);
  if (elegibles.length < nSonda) {
    throw new Error(
      `muestrear: elegibles de sonda (${elegibles.length}) < nSonda pedido (${nSonda})`,
    );
  }
  const sondaBarajada = barajar(ordenarPorHash(elegibles), prngDeSemilla(`${semilla}:sonda`));
  const sonda = sondaBarajada.slice(0, nSonda);

  // D-133b-2: `alea` excluye SOLO los `nSonda` casos efectivamente sorteados como `sonda` —
  // NUNCA el pool elegible completo. Los elegibles-no-sorteados (30 de los 60) permanecen
  // disponibles para `alea`: es lo que hace que el estrato "aleatorio puro" pueda seguir
  // conteniendo casos con token institucional (necesario para estimar el falso negativo del
  // pre-filtro fuera del criterio de sonda). Cifra congelada: 505 descartes − 30 sorteados =
  // 475 (133-b-PREMORTEM.md §P-03, corregido).
  const idsSonda = new Set(sonda.map((c) => c.url_hash));
  const resto = descartes.filter((c) => !idsSonda.has(c.url_hash));
  if (resto.length < nAlea) {
    throw new Error(`muestrear: resto tras sonda (${resto.length}) < nAlea pedido (${nAlea})`);
  }
  const aleaBarajada = barajar(ordenarPorHash(resto), prngDeSemilla(`${semilla}:alea`));
  const alea = aleaBarajada.slice(0, nAlea);

  const stats: MuestreoStats = {
    poblacion: pool.length,
    nP: P.length,
    nDescartes: descartes.length,
    elegiblesSonda: elegibles.length,
    restoTrasSonda: resto.length,
    porToken: porToken(descartes),
    tasa_sin_descripcion: tasaSinDescripcion(pool),
    tasa_sin_descripcion_por_estrato: {
      P: tasaSinDescripcion(P),
      sonda: tasaSinDescripcion(sonda),
      alea: tasaSinDescripcion(alea),
    },
    porOutletP: P.reduce<Record<string, number>>((acc, c) => {
      acc[c.outlet] = (acc[c.outlet] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return { P, sonda, alea, stats };
}

/**
 * Hash de COMPOSICIÓN de la muestra (D-133b-3) — cambia si cambia cualquier `caso_id` o su
 * estrato; NO cambia si solo cambia el orden de la entrada (la canonicalización lo absorbe).
 *
 * Este NO es el hash del `golden-set.json`. Ese se emite una sola vez, al final, en el plan
 * 133-b-07. Este hash congela QUÉ CASOS componen la muestra, antes de que exista una sola
 * etiqueta.
 */
export function hashComposicion(entradas: readonly { caso_id: string; estrato: string }[]): string {
  const ordenadas = [...entradas].sort((a, b) =>
    a.caso_id < b.caso_id ? -1 : a.caso_id > b.caso_id ? 1 : 0,
  );
  return sha256(canonicalizar(ordenadas));
}
