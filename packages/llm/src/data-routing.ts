// STUB — rellenado por 02-02; no agregar tests aqui.
/**
 * Politica dato->proveedor (FND-06): el RUT nunca viaja a un LLM; dato personal
 * solo a tiers que NO entrenan con inputs. El router/adapter consume estos
 * asserts como gate de cumplimiento.
 */
import type { Sensitivity } from "./types";

export class RutInLlmInputError extends Error {}

export function assertNoRutInLlmInput(_text: string): void {
  throw new Error("not implemented (02-02)");
}

export function assertSensitivityAllowed(
  _task: { sensitivity: Sensitivity },
  _provider: { id: string; trainsOnInputs: boolean },
): void {
  throw new Error("not implemented (02-02)");
}
