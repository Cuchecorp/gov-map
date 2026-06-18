/**
 * Mock determinista de `MiniMaxProvider` para los tests del slice (sin red, sin cuota).
 *
 * Recibe una `Adjudicacion` fijada (o un mapa nombreOriginal→Adjudicacion) y un
 * contador de llamadas. Su `complete` valida la respuesta fijada contra el `schema`
 * recibido (igual que el adapter real: la salida del modelo es untrusted hasta
 * pasar por la compuerta zod) y la devuelve. Expone `id="minimax-mock"` y
 * `trainsOnInputs=false` para que `assertSensitivityAllowed` lo acepte (espeja el
 * MiniMax real). NUNCA toca red.
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import type { Adjudicacion } from "./prompt";

/** Respuesta fijada por mención (clave = nombreOriginal) o una respuesta única. */
export type RespuestaMock = Adjudicacion | Record<string, Adjudicacion>;

export class MockMiniMaxProvider implements LLMProvider {
  readonly id = "minimax-mock";
  readonly trainsOnInputs = false;

  /** Cuántas veces se llamó a `complete` (assert 0 en el caso fail-closed de RUT). */
  callCount = 0;

  constructor(private readonly respuesta: RespuestaMock) {}

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    this.callCount += 1;

    // Selección de la respuesta fijada: mapa por mención o respuesta única.
    let fijada: Adjudicacion;
    if (this.esMapa(this.respuesta)) {
      // Keying ROBUSTO (CR-02): el prompt embebe el nombre en una línea exacta
      // `- nombre: <nombreOriginal>`; matcheamos por IGUALDAD de esa línea, no por
      // substring. El substring (`req.user.includes(k)`) era order- y prefijo-frágil:
      // un nombre substring de otro devolvía el fixture equivocado en silencio.
      const nombreDelPrompt = MockMiniMaxProvider.extraerNombre(req.user);
      const clave =
        nombreDelPrompt != null && nombreDelPrompt in this.respuesta
          ? nombreDelPrompt
          : undefined;
      if (clave === undefined) {
        throw new Error(
          `MockMiniMaxProvider: sin respuesta fijada para la mención ${
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

  private esMapa(r: RespuestaMock): r is Record<string, Adjudicacion> {
    // Una Adjudicacion tiene la propiedad `decision`; un mapa no.
    return !("decision" in r);
  }

  /**
   * Extrae el `nombreOriginal` de la línea `- nombre: <...>` que
   * `construirPromptAdjudicacion` emite en el bloque REGISTRO. Devuelve null si no
   * existe (prompt con otro formato). El matcheo por igualdad de esta línea hace el
   * keying del mock robusto a substrings/prefijos (CR-02).
   */
  static extraerNombre(user: string): string | null {
    for (const linea of user.split("\n")) {
      const m = /^- nombre:\s*(.+)$/.exec(linea);
      if (m) return m[1]!.trim();
    }
    return null;
  }
}
