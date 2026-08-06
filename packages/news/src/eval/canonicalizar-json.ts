// canonicalizar-json.ts — canonicalización recursiva + sha256 para los JSON congelados de
// packages/news/src/eval/ (D-133-E2).
//
// Los arrays NO se reordenan porque en `taxonomia.ts` la precedencia vive en el orden del
// array, y en `thresholds.json` el orden LOCKED de los umbrales es T1..T5, T9, T6, T7, T8:
// reordenar un array cambiaría semántica, no solo formato. Solo las claves de los objetos
// planos se reordenan (ascendente por code unit UTF-16 — `Object.keys().sort()` sin
// comparador; jamás un comparador sensible al locale de la máquina, que rompería la
// reproducibilidad del hash entre entornos distintos).
import { createHash } from "node:crypto";

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor) &&
    Object.getPrototypeOf(valor) === Object.prototype
  );
}

/**
 * Recorrido recursivo: reordena las claves de cada objeto plano ascendentemente por code
 * unit UTF-16, preserva el orden de los arrays tal cual (solo canonicaliza sus elementos), y
 * deja los primitivos intactos. No muta el valor de entrada.
 */
function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenar);
  }
  if (esObjetoPlano(valor)) {
    const claves = Object.keys(valor).sort();
    const salida: Record<string, unknown> = {};
    for (const clave of claves) salida[clave] = ordenar(valor[clave]);
    return salida;
  }
  return valor;
}

/**
 * Canonicaliza `valor` a un string determinista: claves ordenadas recursivamente, arrays
 * intactos, indentación de 2 espacios, sin `\r`, sin BOM, terminado en `\n`. Node nunca
 * traduce newlines ni escribe BOM al construir un string en memoria, así que basta con
 * `JSON.stringify` sobre la estructura ya reordenada.
 */
export function canonicalizar(valor: unknown): string {
  return `${JSON.stringify(ordenar(valor), null, 2)}\n`;
}

/**
 * sha256 (hex) de los bytes de `raw`. NUNCA hash artesanal — patrón de
 * `packages/llm-bench/src/guards/freeze.ts` (`hashCasos`), copiado sin depender de
 * `@obs/llm-bench` para no arrastrar su grafo de dependencias.
 */
export function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
