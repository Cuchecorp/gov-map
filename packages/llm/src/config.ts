/**
 * Config de routing de la capa de providers (@obs/llm).
 *
 * El config es la PIEZA SWAPPABLE (FND-06 criterio 2): cambiar de modelo =
 * cambiar config, cero codigo aguas arriba. Las API keys se leen SOLO de env;
 * nunca se hardcodean ni se loguean.
 */
import type { Criticality } from "./types";

/** Config de un provider concreto (lo swappable). */
export interface ProviderConfig {
  /** Model id exacto (p.ej. "deepseek-v4-flash", "MiniMax-M3"). */
  model: string;
  /** Base URL OpenAI-compatible del provider. */
  baseURL: string;
  /** `true` si el provider entrena con inputs (gate fail-closed). */
  trainsOnInputs: boolean;
}

/** Config del router: mapeo criticidad -> provider + registry de providers. */
export interface RouterConfig {
  /** Que provider (por id) atiende cada criticidad. */
  byCriticality: Record<Criticality, string>;
  /** Config de cada provider conocido, indexado por id. */
  providers: Record<string, ProviderConfig>;
}

/**
 * Arma la RouterConfig desde el entorno (FND-06 criterio 2: "cambiar de modelo =
 * cambiar config"). Mapea `critical -> "minimax"` y `bulk -> "deepseek"`. Cada
 * model/baseURL es SWAPPABLE via env con el literal como default; asi se cambia de
 * modelo o endpoint sin tocar codigo aguas arriba. Las API keys NO viven aqui (las
 * leen los adapters al instanciarse): el config solo declara model/baseURL/trainsOnInputs.
 *
 * Vars reconocidas (todas opcionales; default = literal verificado en CONTEXT.md):
 *   DEEPSEEK_MODEL, DEEPSEEK_BASE_URL
 *   MINIMAX_MODEL,  MINIMAX_BASE_URL
 *   LLM_CRITICAL_PROVIDER, LLM_BULK_PROVIDER (id del provider por criticidad)
 *
 * `trainsOnInputs` NO es configurable por env a proposito: es una propiedad de
 * cumplimiento del tier, no un parametro operacional (evita relajar el gate
 * fail-closed por una var de entorno mal puesta).
 *
 * Recibe `env` explicito (no lee `process.env` global) para ser testeable y
 * correr en Deno/edge sin acoplarse al runtime.
 */
export function loadRouterConfigFromEnv(
  env: Record<string, string | undefined>,
): RouterConfig {
  return {
    byCriticality: {
      critical: env.LLM_CRITICAL_PROVIDER ?? "minimax",
      bulk: env.LLM_BULK_PROVIDER ?? "deepseek",
    },
    providers: {
      deepseek: {
        model: env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
        baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        trainsOnInputs: false,
      },
      minimax: {
        model: env.MINIMAX_MODEL ?? "MiniMax-M3",
        baseURL: env.MINIMAX_BASE_URL ?? "https://api.minimax.io/v1",
        trainsOnInputs: false,
      },
    },
  };
}
