/**
 * API publica de @obs/llm — barrel COMPLETO de la fase 02.
 *
 * Re-exporta todos los modulos de la capa de providers: contratos, config,
 * compuerta zod, router, derivacion de schema, politica de datos y los adapters
 * (DeepSeek real; MiniMax + Gemini embeddings como contrato que rellenan 02-02/03).
 *
 * Este archivo es 100% propiedad del plan 02-01; las rebanadas 02-02 y 02-03
 * rellenan sus stubs SIN tocar este barrel (cero colision de archivo compartido).
 */
export * from "./types";
export * from "./config";
export * from "./validate";
export * from "./router";
export * from "./json-schema";
export * from "./data-routing";
export * from "./providers/deepseek";
export * from "./providers/minimax";
export * from "./providers/gemini-embeddings";
