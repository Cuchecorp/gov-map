// PLACEHOLDER — implementacion real en Task 2 (02-01). Exports estables.
/**
 * Router fail-closed: selectProvider por criticidad + gate de sensibilidad.
 * (Implementacion real en Task 2.)
 */
import type { Criticality, LLMProvider, Sensitivity } from "./types";
import type { RouterConfig } from "./config";

export class RouterError extends Error {}
export class SensitiveRoutingError extends Error {}

export function selectProvider(
  _task: { criticality: Criticality; sensitivity: Sensitivity },
  _registry: Record<string, LLMProvider>,
  _config: RouterConfig,
): LLMProvider {
  throw new Error("not implemented (02-01 Task 2)");
}
