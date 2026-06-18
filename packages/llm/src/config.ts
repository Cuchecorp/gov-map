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
 * Arma la RouterConfig desde el entorno. Mapea `critical -> "minimax"` y
 * `bulk -> "deepseek"`. Las keys NO viven aqui (las leen los adapters al
 * instanciarse): el config solo declara model/baseURL/trainsOnInputs.
 *
 * Recibe `env` explicito (no lee `process.env` global) para ser testeable y
 * correr en Deno/edge sin acoplarse al runtime.
 */
export function loadRouterConfigFromEnv(
  _env: Record<string, string | undefined>,
): RouterConfig {
  return {
    byCriticality: {
      critical: "minimax",
      bulk: "deepseek",
    },
    providers: {
      deepseek: {
        model: "deepseek-v4-flash",
        baseURL: "https://api.deepseek.com",
        trainsOnInputs: false,
      },
      minimax: {
        model: "MiniMax-M3",
        baseURL: "https://api.minimax.io/v1",
        trainsOnInputs: false,
      },
    },
  };
}
