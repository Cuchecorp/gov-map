/**
 * Mock determinista de `DeepSeekProvider` para los tests de extracción y el golden de CI
 * (sin red, sin cuota, sin key — Pitfall 5: CI SIEMPRE mockeado).
 *
 * Recibe una `Ficha` fijada (o un mapa textoFuente→Ficha) y la devuelve por `complete`,
 * validándola antes contra el `schema` recibido (igual que el adapter real: la salida del
 * modelo es untrusted hasta pasar por la compuerta zod). Expone `id="deepseek-mock"` y
 * `trainsOnInputs=false` para que `assertSensitivityAllowed` lo acepte (espeja el DeepSeek
 * real). NUNCA toca red.
 *
 * El keying por texto fuente RECHAZA claves duplicadas (CR-02): si dos casos comparten
 * `textoFuente`, una sobrescribiría a la otra en silencio y el gate mediría el fixture
 * equivocado. La construcción del mapa revienta ante un choque.
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import type { Ficha } from "./model";

/** Respuesta fijada por texto fuente (clave = textoFuente) o una respuesta única. */
export type RespuestaMockFicha = Ficha | Map<string, Ficha>;

export class MockDeepSeekProvider implements LLMProvider {
  readonly id = "deepseek-mock";
  readonly trainsOnInputs = false;

  /** Cuántas veces se llamó a `complete`. */
  callCount = 0;

  constructor(private readonly respuesta: RespuestaMockFicha) {}

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    this.callCount += 1;

    let fijada: Ficha;
    if (this.respuesta instanceof Map) {
      // Keying por el TEXTO FUENTE embebido en el prompt entre triple-comilla. Matchea por
      // contención del texto exacto (no por substring laxo de otro campo): el prompt incluye
      // el textoFuente verbatim, así que `req.user.includes(clave)` es exacto por construcción.
      const clave = [...this.respuesta.keys()].find((k) => req.user.includes(k));
      if (clave === undefined) {
        throw new Error(
          "MockDeepSeekProvider: sin respuesta fijada para el texto fuente del prompt",
        );
      }
      fijada = this.respuesta.get(clave)!;
    } else {
      fijada = this.respuesta;
    }

    // Valida la respuesta fijada contra el schema (compuerta zod externa, como el real).
    return schema.parse(fijada);
  }
}
