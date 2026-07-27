/**
 * Config declarativa tarea→escalera para la capa escalonada (@obs/llm).
 *
 * Este módulo expone el vocabulario de configuración del `TieredProvider`: cómo declarar
 * los tiers (primario + escalación), el juez opcional y el budget máximo, y cómo
 * componer ese vocabulario en un mapa tarea→escalera (`TaskLadder`).
 *
 * `buildTieredProvider` es la fábrica que traduce un `LadderConfig` a un `TieredProvider`
 * listo para usar — desacopla la declaración de la construcción (Plan 108, Decision D
 * "task-ladder desacopla config de cascada").
 *
 * NOTA DE COMPILACIÓN (Wave 1): este módulo importa `TieredProvider`/`TieredProviderOptions`
 * de `./tiered`, que es escrito por Plan 02 (Wave 2). La referencia es FORWARD y tsc -b
 * reportará módulo faltante hasta que Plan 02 exista. La verificación de tsc de este
 * módulo es responsabilidad del merge de Wave 2.
 */
import type { LLMProvider } from "./types";
import type { JudgeProvider } from "./judge";
import type { TelemetrySink } from "./telemetry";
import { TieredProvider, type TieredProviderOptions } from "./tiered"; // implementado por Plan 02

/**
 * Especificación de un tier individual dentro de una escalera. Combina un provider
 * concreto con su costo-por-token declarativo (para budget tracking).
 */
export interface TierSpec {
  /** El provider LLM que atiende este tier. */
  provider: LLMProvider;
  /**
   * Costo declarativo por token de output en USD (p.ej. 0.00000014 para DeepSeek V4 Flash).
   * `undefined` → `costUsd=null` en el evento de telemetría (precio desconocido).
   */
  costPerToken?: number;
}

/**
 * Configuración declarativa de una escalera de providers para una tarea.
 *
 * Ejemplo mínimo (sin escalación, sin juez):
 * ```ts
 * const config: LadderConfig = { primary: { provider: deepseek } };
 * ```
 *
 * Ejemplo con escalación y juez:
 * ```ts
 * const config: LadderConfig = {
 *   primary: { provider: deepseek, costPerToken: 0.00000014 },
 *   escalation: { provider: minimax, costPerToken: 0.0000011 },
 *   judge: phiJudge,
 *   maxBudgetUsd: 0.05,
 * };
 * ```
 */
export interface LadderConfig {
  /** Tier primario — siempre presente. */
  primary: TierSpec;
  /** Tier de escalación — opcional. Si omitido, no hay fallback automático. */
  escalation?: TierSpec;
  /**
   * Juez opcional. Si presente, `TieredProvider` invoca al juez tras el primario
   * y escala si el veredicto es negativo (`ok=false`).
   */
  judge?: JudgeProvider;
  /** Contexto extra para el prompt del juez (rubrica, instrucciones). */
  judgeContext?: string;
  /**
   * Budget máximo en USD para la llamada completa (primario + escalación).
   * Si se supera antes de la escalación, `TieredProvider` aborta con error.
   */
  maxBudgetUsd?: number;
}

/**
 * Mapa tarea→escalera. La clave es el valor de `CompletionRequest.task`; el valor es
 * la `LadderConfig` que `TieredProvider` usa cuando esa tarea llega.
 *
 * `undefined` como clave no está permitido (Record<string, ...> lo excluye); para
 * requests sin `task`, `TieredProvider` usa la escalera `"default"` si existe o la
 * escalera única si solo hay una.
 */
export type TaskLadder = Record<string, LadderConfig>;

/**
 * Fábrica que traduce un `LadderConfig` a un `TieredProvider` listo para usar.
 *
 * Convierte el vocabulario declarativo (`TierSpec[]`, `judge`, `maxBudgetUsd`) a las
 * `TieredProviderOptions` que `TieredProvider` espera, e inyecta el sink de telemetría.
 *
 * @param config — la escalera declarativa (primario + escalación opcional + juez).
 * @param telemetrySink — sink de telemetría a inyectar en el provider (default: noop).
 * @returns Un `TieredProvider` configurado y listo para `complete<T>()`.
 *
 * NOTA: `TieredProvider` es implementado por Plan 02 (Wave 2). Esta función compila
 * y enlaza cuando `./tiered` exista.
 */
export function buildTieredProvider(
  config: LadderConfig,
  telemetrySink?: TelemetrySink,
): TieredProvider {
  const tiers: LLMProvider[] = [
    config.primary.provider,
    ...(config.escalation ? [config.escalation.provider] : []),
  ];

  const opts: TieredProviderOptions = {
    tiers,
    judge: config.judge,
    judgeContext: config.judgeContext,
    maxBudgetUsd: config.maxBudgetUsd,
    telemetrySink,
    costPerToken: config.primary.costPerToken,
    escalationCostPerToken: config.escalation?.costPerToken,
  };

  return new TieredProvider(opts);
}
