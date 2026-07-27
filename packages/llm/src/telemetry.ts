/**
 * Contrato de telemetría PAYLOAD-FREE de la capa escalonada (@obs/llm).
 *
 * `TelemetryEvent` captura SOLO campos estructurales/numéricos sobre cada llamada LLM:
 * latencia, costo, desenlace de validación, veredicto del juez y si hubo escalación.
 * NUNCA declara campos de texto del dominio (user/system/answer/prompt/reason) — el
 * `reason` del Verdict es opinión del juez que puede filtrar contenido de tarea y NO
 * debe cruzar a ningún log. Solo `ok`/`confidence` del Verdict son seguros (TIER-04,
 * T-108-01: "PII in telemetry logs").
 *
 * `TelemetrySink` es la interfaz de escritura: una función pura que recibe un evento y
 * no devuelve nada. `noopSink` descarta silenciosamente; `jsonlSink` serializa a JSONL
 * en un target inyectado (p.ej. un WriteStream o un buffer de test).
 */
import type { ValidationOutcome } from "./validate";
import type { Verdict } from "./judge";

/**
 * Evento de telemetría PAYLOAD-FREE. Campos prohibidos: user, system, answer, prompt,
 * reason. Todos los campos son estructurales o numéricos excepto `providerId`/`task`/`ts`
 * que son identificadores — NUNCA contenido del dominio.
 */
export interface TelemetryEvent {
  /** Identificador estable del provider que atendió la llamada (p.ej. "deepseek"). */
  providerId: string;
  /**
   * Etiqueta de la tarea lógica, si el caller la incluyó en `CompletionRequest.task`.
   * Identificador de tarea — NUNCA contenido del prompt ni de la respuesta.
   */
  task?: string;
  /** Latencia de extremo a extremo de la llamada al provider, en milisegundos. */
  latencyMs: number;
  /**
   * Costo estimado en USD según el pricing del provider (null si no se conocen los
   * tokens o el pricing del tier). Nunca contiene texto.
   */
  costUsd: number | null;
  /**
   * Desenlace estructural del repair loop (clean/zod-repaired/structured-output-fail/
   * zod-terminal). Null si no se ejecutó el repair loop (p.ej. llamada al juez).
   */
  validationOutcome: ValidationOutcome | null;
  /**
   * Veredicto resumido del juez: solo `ok` (bool) y `confidence` (number|undefined).
   * EXPLÍCITAMENTE excluye `reason` (texto de opinión del juez — TIER-04).
   */
  judgeVerdict?: Pick<Verdict, "ok" | "confidence">;
  /** `true` si la llamada fue escalada al tier secundario. */
  escalated: boolean;
  /** Timestamp ISO-8601 UTC del momento en que se emitió el evento. */
  ts: string;
}

/**
 * Sink de telemetría. Función pura: recibe un `TelemetryEvent` y no devuelve nada.
 * El sink NUNCA recibe payload del dominio (regla en el shape de `TelemetryEvent`).
 */
export type TelemetrySink = (event: TelemetryEvent) => void;

/**
 * Sink nulo — descarta todos los eventos silenciosamente. Es el default cuando el
 * caller no inyecta un sink (cero overhead de configuración).
 */
export const noopSink: TelemetrySink = (_event: TelemetryEvent): void => {
  // descarta — intencional
};

/**
 * Fábrica que produce un `TelemetrySink` que serializa cada evento como una línea
 * JSON terminada en `\n` y lo pasa a `target.write`.
 *
 * @param target — cualquier objeto con un método `write(line: string): void`, p.ej.
 *   un `fs.WriteStream`, un `Writable`, o un buffer de test.
 * @returns Un `TelemetrySink` que escribe JSONL al target. El target NO recibe
 *   payload del dominio: el shape de `TelemetryEvent` lo garantiza.
 */
export function jsonlSink(target: {
  write: (line: string) => void;
}): TelemetrySink {
  return (event: TelemetryEvent): void => {
    target.write(JSON.stringify(event) + "\n");
  };
}
