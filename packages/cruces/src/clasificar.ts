/**
 * clasificarFicha / clasificarContraparte — el SERVICIO de clasificación de sector (CRUCE-02),
 * SEPARADO de la extracción literal (SEM-02 vive en @obs/fichas).
 *
 * DOS rutas con routing y sensibilidad distintos (D-12):
 *
 *   clasificarFicha (PÚBLICA, bulk → DeepSeek por el router):
 *     - dato público (materia de un proyecto de ley): `sensitivity:"public"` + `criticality:"bulk"`.
 *     - arma el prompt y llama `provider.complete(req, ClasificacionSectorSchema)`.
 *
 *   clasificarContraparte (SENSIBLE, critical → MiniMax por el router):
 *     - nombre crudo de contraparte de lobby (dato personal, Ley 21.719):
 *       `sensitivity:"personal"` + `criticality:"critical"`.
 *     - ORDEN DE GATES LOAD-BEARING (espejo de pipeline-entidad.ts:185-186):
 *         1. `assertNoRutInLlmInput(system + "\n" + user)` PRIMERO — sobre el payload EXACTO.
 *            Si un RUT se cuela, lanza con CERO llamadas al LLM y nada se clasifica (T-36-06).
 *         2. `assertSensitivityAllowed({sensitivity:"personal"}, provider)` — nunca dato
 *            personal a un provider que entrena con inputs (T-36-07).
 *         3. recién entonces `provider.complete(req, ClasificacionSectorSchema)`.
 *
 * Los gates se REUSAN verbatim de @obs/llm (NO se re-implementa el regex de RUT ni el gate de
 * sensibilidad). El zod gate cerrado (`ClasificacionSectorSchema`, T-36-08) rechaza cualquier
 * salida del LLM fuera de la taxonomía. `null` (abstención) se propaga sin error (D-05/D-08).
 */

import type { LLMProvider } from "@obs/llm";
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";
import { ClasificacionSectorSchema, type ClasificacionSector } from "./model";
import { SYSTEM_CLASIFICACION_FICHA, construirPromptFicha } from "./prompt";
import {
  SYSTEM_CLASIFICACION_CONTRAPARTE,
  construirPromptContraparte,
} from "./prompt-lobby";

/** Contexto público de un proyecto de ley a clasificar (todos los campos opcionales). */
export interface ClasificarFichaInput {
  idea_matriz?: string | null;
  titulo?: string | null;
  materia?: string | null;
}

/** Contexto de una contraparte de lobby a clasificar (nombre crudo + materia opcional). */
export interface ClasificarContraparteInput {
  /** Nombre de la contraparte tal como aparece en la fuente. NUNCA debe contener un RUT. */
  nombre: string;
  /** Materia pública de la audiencia (opcional). */
  materia?: string | null;
}

/**
 * Clasifica el sector de un PROYECTO de ley (ruta PÚBLICA). Dato público → `sensitivity:"public"`
 * + `criticality:"bulk"` → el router lo dirige a DeepSeek. La salida pasa por el zod gate cerrado.
 */
export async function clasificarFicha(
  input: ClasificarFichaInput,
  provider: LLMProvider,
): Promise<ClasificacionSector> {
  const user = construirPromptFicha(input);
  return provider.complete(
    {
      system: SYSTEM_CLASIFICACION_FICHA,
      user,
      criticality: "bulk",
      sensitivity: "public",
      temperature: 0,
    },
    ClasificacionSectorSchema,
  );
}

/**
 * Clasifica el sector de una CONTRAPARTE de lobby (ruta SENSIBLE). El nombre crudo es dato
 * personal → `sensitivity:"personal"` + `criticality:"critical"` → el router lo dirige a MiniMax.
 *
 * Los DOS gates corren ANTES de tocar el LLM, en este orden (load-bearing):
 *   1. assertNoRutInLlmInput(payload EXACTO) — un RUT lanza con 0 llamadas (T-36-06).
 *   2. assertSensitivityAllowed({sensitivity:"personal"}, provider) — fail-closed (T-36-07).
 */
export async function clasificarContraparte(
  input: ClasificarContraparteInput,
  provider: LLMProvider,
): Promise<ClasificacionSector> {
  const user = construirPromptContraparte(input.nombre, input.materia);

  // Gate de RUT sobre el payload EXACTO (system + user) ANTES de cualquier llamada LLM.
  // Si un RUT se cuela (dato sucio en la fuente), lanza con 0 llamadas y nada se clasifica.
  assertNoRutInLlmInput(`${SYSTEM_CLASIFICACION_CONTRAPARTE}\n${user}`);
  assertSensitivityAllowed({ sensitivity: "personal" }, provider);

  return provider.complete(
    {
      system: SYSTEM_CLASIFICACION_CONTRAPARTE,
      user,
      criticality: "critical",
      sensitivity: "personal",
      temperature: 0,
    },
    ClasificacionSectorSchema,
  );
}
