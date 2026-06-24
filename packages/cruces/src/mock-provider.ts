/**
 * Mock determinista de LLMProvider para los tests de clasificación de sector (sin red, sin
 * cuota, sin key — CI SIEMPRE mockeado). Espeja el `MockDeepSeekProvider` de @obs/fichas.
 *
 * Recibe una `ClasificacionSector` fija (o un mapa case-id → ClasificacionSector keyed por una
 * subcadena del prompt `user`) y la devuelve por `complete`, validándola ANTES contra el
 * `schema` recibido (igual que el adapter real: la salida del modelo es untrusted hasta pasar
 * por la compuerta zod). Expone `id` y `trainsOnInputs=false` para que `assertSensitivityAllowed`
 * lo acepte. NUNCA toca red.
 *
 * Registra cada request entregado en `requests` (y `callCount`) para que los tests asierten el
 * routing/sensibilidad y que NO se invocó al LLM cuando el gate de RUT debió abortar.
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import type { ClasificacionSector } from "./model";

/** Respuesta fija o un mapa keyed por una subcadena contenida en el prompt `user`. */
export type RespuestaMockSector =
  | ClasificacionSector
  | Map<string, ClasificacionSector>;

export class MockClasificadorProvider implements LLMProvider {
  readonly id: string;
  readonly trainsOnInputs = false;

  /** Cuántas veces se llamó a `complete`. */
  callCount = 0;
  /** Cada request entregado a `complete` (para asertar routing/sensibilidad en tests). */
  readonly requests: CompletionRequest[] = [];

  constructor(
    private readonly respuesta: RespuestaMockSector,
    id = "clasificador-mock",
  ) {
    this.id = id;
  }

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    this.callCount += 1;
    this.requests.push(req);

    let fijada: ClasificacionSector;
    if (this.respuesta instanceof Map) {
      const clave = [...this.respuesta.keys()].find((k) => req.user.includes(k));
      if (clave === undefined) {
        throw new Error(
          "MockClasificadorProvider: sin respuesta fijada para el prompt",
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
