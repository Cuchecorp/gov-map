/**
 * Router fail-closed de la capa de providers (@obs/llm).
 *
 * Selecciona el provider por la CRITICIDAD de la tarea (no por volumen) y aplica
 * un gate de cumplimiento de datos: si la tarea es `personal` y el provider
 * candidato entrena con sus inputs, ABORTA (SensitiveRoutingError) — nunca degrada
 * ni sustituye por otro provider (T-02-01, politica dato->proveedor de CONTEXT.md).
 */
import type { Criticality, LLMProvider, Sensitivity } from "./types";
import type { RouterConfig } from "./config";

/** No hay provider en el registry para la criticidad pedida. */
export class RouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouterError";
  }
}

/**
 * Gate fail-closed: una tarea con dato personal se enruto a un provider que
 * entrena con inputs. Se aborta — el dato NUNCA debe salir a ese tier.
 */
export class SensitiveRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SensitiveRoutingError";
  }
}

/**
 * Devuelve el provider adecuado para la tarea o lanza fail-closed.
 *
 * 1. `providerId = config.byCriticality[criticality]`.
 * 2. `provider = registry[providerId]`; si no existe -> RouterError.
 * 3. GATE: `personal && provider.trainsOnInputs` -> SensitiveRoutingError.
 * 4. Devuelve el provider.
 *
 * NO hay branch catch/`||` que sustituya un provider sensible por otro.
 */
export function selectProvider(
  task: { criticality: Criticality; sensitivity: Sensitivity },
  registry: Record<string, LLMProvider>,
  config: RouterConfig,
): LLMProvider {
  const providerId = config.byCriticality[task.criticality];
  const provider = registry[providerId];
  if (!provider) {
    throw new RouterError(
      `no provider registered for criticality "${task.criticality}" (expected id "${providerId}")`,
    );
  }
  if (task.sensitivity === "personal" && provider.trainsOnInputs) {
    throw new SensitiveRoutingError(
      `refusing to route personal data to provider "${provider.id}" which trains on inputs`,
    );
  }
  return provider;
}
