/**
 * Mock determinista de `LLMProvider` para los tests del pipeline de TERCEROS (sin red, sin cuota).
 * ESPEJO de `mock-provider.ts` adaptado a `AdjudicacionEntidad` y al formato de prompt de
 * `construirPromptEntidad` (línea `- nombre: <nombreOriginal>`).
 *
 * Expone `id="minimax-mock"` y `trainsOnInputs=false` para que `assertSensitivityAllowed` lo
 * acepte. `callCount` permite asertar 0 llamadas en los casos fail-closed (jurídica salta el LLM;
 * RUT colado al prompt). NUNCA toca red.
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import type { AdjudicacionEntidad } from "./prompt-entidad";

/** Respuesta fijada por mención (clave = nombreOriginal) o una respuesta única. */
export type RespuestaMockEntidad =
  | AdjudicacionEntidad
  | Record<string, AdjudicacionEntidad>;

export class MockMiniMaxProviderEntidad implements LLMProvider {
  readonly id = "minimax-mock";
  readonly trainsOnInputs = false;

  /** Cuántas veces se llamó a `complete` (assert 0 en jurídica/RUT colado). */
  callCount = 0;

  constructor(private readonly respuesta: RespuestaMockEntidad) {}

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    this.callCount += 1;

    let fijada: AdjudicacionEntidad;
    if (this.esMapa(this.respuesta)) {
      const nombreDelPrompt = MockMiniMaxProviderEntidad.extraerNombre(req.user);
      const clave =
        nombreDelPrompt != null && nombreDelPrompt in this.respuesta
          ? nombreDelPrompt
          : undefined;
      if (clave === undefined) {
        throw new Error(
          `MockMiniMaxProviderEntidad: sin respuesta fijada para la mención ${
            nombreDelPrompt != null ? `"${nombreDelPrompt}"` : "(nombre no hallado en el prompt)"
          }`,
        );
      }
      fijada = this.respuesta[clave]!;
    } else {
      fijada = this.respuesta;
    }

    // Valida la respuesta fijada contra el schema (compuerta zod externa, como el real).
    return schema.parse(fijada);
  }

  private esMapa(r: RespuestaMockEntidad): r is Record<string, AdjudicacionEntidad> {
    return !("decision" in r);
  }

  /** Extrae el `nombreOriginal` de la línea `- nombre: <...>` de construirPromptEntidad. */
  static extraerNombre(user: string): string | null {
    for (const linea of user.split("\n")) {
      const m = /^- nombre:\s*(.+)$/.exec(linea);
      if (m) return m[1]!.trim();
    }
    return null;
  }
}
