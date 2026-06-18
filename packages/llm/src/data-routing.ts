/**
 * Politica dato->proveedor (FND-06), documentada en codigo.
 *
 * REGLAS (de 02-CONTEXT.md):
 *   1. El RUT (identificador personal duro) se matchea de forma DETERMINISTA y
 *      NUNCA se envia a ningun LLM. El RUT se cruza por separado, fuera del prompt.
 *      `assertNoRutInLlmInput` aborta ANTES de cualquier llamada LLM si detecta uno.
 *   2. Dato personal (nombres en contexto de identidad, etc.) SOLO puede dirigirse
 *      a un tier que NO entrena con sus inputs (`trainsOnInputs === false`:
 *      MiniMax/DeepSeek vias pagas / DPA). Fail-closed compartido con el router
 *      (reutiliza `SensitiveRoutingError`, no se duplica).
 *   3. NUNCA dato personal por el free tier de Gemini (entrena con inputs) — Gemini
 *      se usa SOLO para embeddings de texto publico.
 *
 * Logica pura (sin red); Web APIs estandar (corre en Deno/edge).
 */
import type { Sensitivity } from "./types";
import { SensitiveRoutingError } from "./router";

/**
 * Un input destinado a un LLM contiene un RUT. El RUT jamas debe cruzar a un
 * prompt — se matchea aparte. El mensaje NUNCA incluye el RUT ni el texto.
 */
export class RutInLlmInputError extends Error {
  constructor() {
    super("input contains a RUT; RUT must never be sent to an LLM");
    this.name = "RutInLlmInputError";
  }
}

/**
 * RUT chileno: cuerpo de 1-8 digitos (con o sin separadores de miles `.`),
 * guion (con o sin espacios alrededor), y digito verificador (0-9 o K/k).
 * Deteccion DETERMINISTA y deliberadamente AMPLIA: para una compuerta fail-closed
 * de identificador duro, sobre-bloquear es la direccion segura (preferir un falso
 * positivo a filtrar un RUT real).
 *
 * Matchea cuerpos cortos (personas/empresas antiguas) que la version anterior
 * dejaba pasar: `1.234-5`, `12345-6`, `123.456-7`, ademas de los clasicos
 * `12.345.678-9`, `12345678-9`, `9.876.543-K`, y la forma OCR con espacios
 * alrededor del guion `12.345.678 - 9`, `7.654.321 - K`.
 *
 * Estructura: 1-3 digitos iniciales, luego cero o mas grupos de 3 digitos con
 * punto opcional, espacios opcionales, guion, espacios opcionales, DV [0-9Kk].
 */
const RUT_REGEX = /\b\d{1,3}(?:\.?\d{3})*\s*-\s*[\dkK]\b/i;

/**
 * Lanza `RutInLlmInputError` si `text` contiene un RUT chileno. Sin RUT, no hace
 * nada. El error NO expone el RUT ni el texto (T-02-05).
 */
export function assertNoRutInLlmInput(text: string): void {
  if (RUT_REGEX.test(text)) {
    throw new RutInLlmInputError();
  }
}

/**
 * Gate de cumplimiento dato->proveedor (fail-closed, espeja la regla del router):
 * dato `personal` NUNCA a un provider que entrena con inputs. Reutiliza
 * `SensitiveRoutingError` (no se duplica). Texto `public` puede ir a cualquier tier.
 */
export function assertSensitivityAllowed(
  task: { sensitivity: Sensitivity },
  provider: { id: string; trainsOnInputs: boolean },
): void {
  if (task.sensitivity === "personal" && provider.trainsOnInputs) {
    throw new SensitiveRoutingError(
      `refusing to route personal data to provider "${provider.id}" which trains on inputs`,
    );
  }
}
