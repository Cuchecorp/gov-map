// kappa.ts — κ de Cohen, acuerdo bruto e IC95 para el golden set 133-b (D-133-C2, plan
// 133-b-06). Matemática pura, determinista, sin IO.
//
// Bajo `133-b-ENMIENDA-PROXY.md` (2026-08-10) la calibración humana fue sustituida por un
// proxy Fable: lo que este módulo computa contra esas 20 etiquetas se llama
// κ(fable↔máquina) — JAMÁS κ(humano↔máquina), que queda NO MEDIDO. La regla de
// interpretabilidad C2.1.3 se aplica igual (Δκ > 0,15 ⇒ el κ de máquina no es interpretable
// como acuerdo inter-anotador) pero su veredicto lleva adjunta la limitación intra-familia:
// Fable, Sonnet y Opus comparten linaje Anthropic.

export interface ParEtiquetas {
  a: string;
  b: string;
}

export interface ResultadoKappa {
  kappa: number;
  acuerdoBruto: number;
  n: number;
  /** IC95 normal-aproximado del κ (Cohen 1960/Fleiss): κ ± 1,96·SE. A n chico el intervalo
   * es ancho — eso es información, no un defecto. */
  ic95: { inf: number; sup: number };
}

/**
 * κ de Cohen para dos anotadores sobre etiquetas nominales. LANZA sobre lista vacía (cero
 * vacuo). Caso degenerado: si pe = 1 (ambos anotadores usan una sola etiqueta idéntica), κ
 * se define 1 si el acuerdo es total — y no puede no serlo si pe = 1 con una sola etiqueta.
 */
export function cohenKappa(pares: readonly ParEtiquetas[]): ResultadoKappa {
  const n = pares.length;
  if (n === 0) {
    throw new Error("cohenKappa: lista vacía — κ no definido (cero vacuo)");
  }
  const etiquetas = new Set<string>();
  for (const p of pares) {
    etiquetas.add(p.a);
    etiquetas.add(p.b);
  }
  const acuerdos = pares.filter((p) => p.a === p.b).length;
  const po = acuerdos / n;

  let pe = 0;
  for (const etiqueta of etiquetas) {
    const pa = pares.filter((p) => p.a === etiqueta).length / n;
    const pb = pares.filter((p) => p.b === etiqueta).length / n;
    pe += pa * pb;
  }

  const kappa = pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);

  // SE aproximado (Cohen 1960): sqrt(po(1-po)/n)/(1-pe). Suficiente para declarar la zona
  // de ruido; no se usa para vetar (los vetos van sobre la estimación puntual, D-133-D2).
  const se = pe === 1 ? 0 : Math.sqrt((po * (1 - po)) / n) / (1 - pe);
  const inf = Math.max(-1, kappa - 1.96 * se);
  const sup = Math.min(1, kappa + 1.96 * se);

  return { kappa, acuerdoBruto: po, n, ic95: { inf, sup } };
}

/** IC95 de Wilson para una proporción — para reportar acuerdo bruto y tasas con intervalo. */
export function ic95Proporcion(exitos: number, n: number): { inf: number; sup: number } {
  if (n === 0) {
    throw new Error("ic95Proporcion: n=0 — intervalo no definido (cero vacuo)");
  }
  const z = 1.96;
  const p = exitos / n;
  const denom = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / denom;
  const margen = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { inf: Math.max(0, centro - margen), sup: Math.min(1, centro + margen) };
}

export interface VeredictoInterpretabilidad {
  kappaMaquina: number;
  kappaFable: number;
  delta: number;
  /** true ⇒ el κ de máquina NO es interpretable como acuerdo inter-anotador (C2.1.3). */
  gatillada: boolean;
  limitacion: string;
}

/**
 * Regla de interpretabilidad C2.1.3 bajo la enmienda proxy: se gatilla si
 * κ(fable↔máquina) < κ(máquina↔máquina) − 0,15. `kappaFable` es la MEDIA de κ(fable↔A) y
 * κ(fable↔B) — decisión de plan 133-b-06, documentada: la regla original no fijaba contra
 * cuál de los dos anotadores se compara, y la media es la lectura simétrica.
 */
export function reglaInterpretabilidad(
  kappaMaquina: number,
  kappaFableA: number,
  kappaFableB: number,
): VeredictoInterpretabilidad {
  const kappaFable = (kappaFableA + kappaFableB) / 2;
  const delta = kappaMaquina - kappaFable;
  // Tolerancia de época flotante: 0.8 − 0.65 = 0.15000000000000002 en IEEE 754, y el borde
  // exacto (Δ = 0,15) NO gatilla por definición de C2.1.3 ("< κ − 0,15", desigualdad estricta).
  return {
    kappaMaquina,
    kappaFable,
    delta,
    gatillada: delta > 0.15 + 1e-9,
    limitacion:
      "k(fable-maquina), NO k(humano-maquina): calibracion por proxy Fable (133-b-ENMIENDA-PROXY.md); Fable/Sonnet/Opus comparten linaje Anthropic, el control externo humano queda NO MEDIDO",
  };
}

/** Conteo de n por etiqueta sobre una lista de etiquetas finales. LANZA sobre lista vacía. */
export function nPorClase(etiquetas: readonly string[]): Record<string, number> {
  if (etiquetas.length === 0) {
    throw new Error("nPorClase: lista vacía (cero vacuo)");
  }
  const conteo: Record<string, number> = {};
  for (const e of etiquetas) conteo[e] = (conteo[e] ?? 0) + 1;
  return conteo;
}
