// gate.ts — compuerta all-or-nothing por lote (Phase 134, SC4).
//
// "Un lote fallido jamás corrompe el estado publicado": el gate valida TODOS los ítems del
// lote ANTES de aplicar NADA. Un solo ítem inválido ⇒ cero escrituras y el lote entero va a
// dead-letter con `rejection_stage: 'lote_invalido'` (decisión del llamador). El "último
// estado bueno" se preserva por construcción: `aplicar` no corre ni parcialmente.

export interface ResultadoGate<T> {
  aplicado: boolean;
  /** Ítems inválidos con su razón — vacío cuando `aplicado`. */
  invalidos: Array<{ item: T; razon: string }>;
}

/**
 * Valida cada ítem con `validar` (null = válido; string = razón de invalidez). Si TODOS
 * pasan, corre `aplicar` UNA vez con el lote completo. Si CUALQUIERA falla, `aplicar` no se
 * invoca jamás. Lote vacío ⇒ throw (cero vacuo: un gate que "aplica" cero ítems no probó
 * nada y esconde un pipeline seco).
 *
 * PRECONDICIÓN (hallazgo LOW de la verificación 134): la atomicidad DENTRO de `aplicar` es
 * responsabilidad del llamador — este gate garantiza "no aplicar nada si algo es inválido",
 * no "rollback si aplicar explota a mitad". El writer de 135 debe aplicar con una operación
 * atómica (upsert único / transacción); si `aplicar` lanza, la excepción se propaga tal cual.
 */
export async function procesarLoteAllOrNothing<T>(
  lote: readonly T[],
  validar: (item: T) => string | null,
  aplicar: (lote: readonly T[]) => Promise<void>,
): Promise<ResultadoGate<T>> {
  if (lote.length === 0) {
    throw new Error("gate: lote vacío — nada que validar (cero vacuo)");
  }
  const invalidos: Array<{ item: T; razon: string }> = [];
  for (const item of lote) {
    const razon = validar(item);
    if (razon !== null) invalidos.push({ item, razon });
  }
  if (invalidos.length > 0) {
    return { aplicado: false, invalidos };
  }
  await aplicar(lote);
  return { aplicado: true, invalidos: [] };
}
