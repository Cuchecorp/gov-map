/**
 * EnlaceConfirmado — el INVARIANTE TIPADO del enlace confirmado (IDENT-12).
 *
 * Sube la guarda LOCKED de v1.0 (TRAM-06) de CONVENCIÓN a TIPO. En v1.0,
 * `reconciliar-senado.ts` mapeaba a mano un `ResultadoPipeline` a un
 * `parlamentario_id: string | null`; cualquier writer nuevo podía pasar un string
 * crudo y publicar un match equivocado como hecho (riesgo existencial #1, T-09-01).
 *
 * Aquí ese error pasa a ser un ERROR DE COMPILACIÓN: un `*Writer` que tipa su FK
 * como `EnlaceConfirmado | null` NO puede aceptar un `string` desnudo, y el único
 * constructor del tipo branded es `confirmar()`.
 *
 * DISEÑO (RESEARCH §Pattern 1, Pitfall 2):
 *  - `ENLACE_CONFIRMADO` es un `unique symbol` PRIVADO al módulo. NUNCA se exporta
 *    (ni desde aquí ni desde el barrel `index.ts`). Exportarlo —o permitir un cast
 *    `as EnlaceConfirmado` en código de conector— rompería el invariante, porque
 *    cualquiera podría fabricar un valor del tipo sin pasar por la reconciliación.
 *  - `confirmar()` es la ÚNICA factory legítima. La invocan SOLO:
 *      (1) la reconciliación, tras un resultado `determinista`/`confirmado`, y
 *      (2) `revisor-cli`, tras una promoción humana (`metodo: "humano"`,
 *          Open Question 2 del research).
 *    Un grep gate (ver 09-01-PLAN §verification) prueba que `confirmar(` no aparece
 *    en ningún writer ni parser.
 */

declare const ENLACE_CONFIRMADO: unique symbol;

/**
 * Prueba estructural de que un `parlamentarioId` provino de un match
 * determinista/confirmado (o de una promoción humana). NO se puede construir un
 * valor de este tipo fuera de `confirmar()`: el `unique symbol` privado lo hace
 * nominal (branded). Un writer que tipa su FK como `EnlaceConfirmado | null`
 * RECHAZA estructuralmente un string crudo en esa posición.
 */
export interface EnlaceConfirmado {
  /** El id de parlamentario de la maestra al que apunta el enlace confirmado. */
  readonly parlamentarioId: string;
  /** Cómo se confirmó el enlace: por match determinista de máquina o por humano. */
  readonly metodo: "determinista" | "humano";
  /** Marca nominal privada — imposible de fijar fuera de este módulo. */
  readonly [ENLACE_CONFIRMADO]: true;
}

/**
 * ÚNICA factory de `EnlaceConfirmado`. Mintea el enlace SOLO cuando el llamador ya
 * resolvió un match legítimo:
 *  - la reconciliación, en la rama `determinista` (`metodo = "determinista"`), o
 *  - `revisor-cli`, tras una promoción humana (`metodo = "humano"`).
 *
 * `probable`/`revision`/`no_confirmado` NUNCA llaman a `confirmar()` — dejan el FK
 * en `null` + la mención cruda (guarda LOCKED de v1.0 preservada).
 *
 * @param parlamentarioId  Id de la maestra confirmado por el match.
 * @param metodo           Origen de la confirmación (default `"determinista"`).
 * @returns                Un `EnlaceConfirmado` branded — el único valor aceptable
 *                         por el FK tipado de un writer.
 */
export function confirmar(
  parlamentarioId: string,
  metodo: "determinista" | "humano" = "determinista",
): EnlaceConfirmado {
  // La marca nominal `[ENLACE_CONFIRMADO]` existe SOLO en el espacio de tipos
  // (`declare const ... : unique symbol` no produce valor en runtime). El valor real
  // es un objeto plano `{ parlamentarioId, metodo }`; la marca se asienta vía un
  // único `satisfies`/widening controlado AQUÍ, el único sitio de construcción.
  // Se evita el literal `as EnlaceConfirmado` (prohibido por Pitfall 2: el grep gate
  // rechaza cualquier `as EnlaceConfirmado` fuera de tests) usando un alias local.
  type Branded = EnlaceConfirmado;
  return { parlamentarioId, metodo } as unknown as Branded;
}
