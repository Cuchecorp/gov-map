/**
 * Extracción literal de una Ficha desde el texto fuente de un proyecto de ley (SEM-02).
 *
 * `extraer` llama a `provider.complete({ system: SYSTEM_EXTRACCION, user: ... }, FichaSchema)`.
 * La compuerta zod (FichaSchema) + el repair loop + los gates de cumplimiento
 * (assertNoRutInLlmInput, assertSensitivityAllowed) viven DENTRO del provider — aquí NO se
 * hace safeParse propio (SEM-02). `sensitivity: "public"` + `criticality: "bulk"`: el texto
 * fuente es público (mensaje/moción), sin RUT/PII, y la extracción es de alto volumen →
 * tier DeepSeek; el provider lo verifica fail-closed antes de la red.
 *
 * La FIDELIDAD LITERAL (idea_matriz substring del texto; cuerpos citados, no inventados) NO
 * la puede garantizar zod —un modelo puede alucinar una frase fluida válida—; la verifica el
 * GATE GOLDEN (golden/golden-set.ts) sobre un set anotado a mano.
 */

import type { LLMProvider } from "@obs/llm";
import type { Proyecto } from "@obs/tramitacion";
import { FichaSchema, type Ficha } from "./model";
import { SYSTEM_EXTRACCION, construirPromptExtraccion } from "./prompt";

/**
 * Extrae la Ficha literal del `textoFuente` para `proyecto` usando `provider` (DeepSeek real
 * en producción; MockDeepSeekProvider en tests/golden CI). La salida pasa por FichaSchema
 * dentro del provider (compuerta única + repair). `sensitivity: "public"`, `criticality: "bulk"`.
 */
export async function extraer(
  textoFuente: string,
  proyecto: Pick<Proyecto, "boletin" | "titulo">,
  provider: LLMProvider,
): Promise<Ficha> {
  return provider.complete(
    {
      system: SYSTEM_EXTRACCION,
      user: construirPromptExtraccion(textoFuente, proyecto),
      criticality: "bulk",
      sensitivity: "public",
    },
    FichaSchema,
  );
}
