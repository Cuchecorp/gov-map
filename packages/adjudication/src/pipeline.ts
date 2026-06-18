/**
 * correrPipeline — orquestación de las cuatro etapas del subsistema de identidad
 * asistida (riesgo existencial #1). Compone las piezas PURAS de 04-01 contra la
 * persistencia de 04-02, escribiendo una fila de `identidad_audit` por decisión.
 *
 * Etapas:
 *   0. DETERMINISTA (reuse de @obs/identity, Etapa 0): si `matchDeterminista`
 *      devuelve `confirmado` (RUT exacto o nombre único en cámara+periodo) → vínculo
 *      `confirmado` metodo='determinista' + audit, y RETORNA. NO toca el LLM.
 *   1. BLOCKING (`generarCandidatos`, fail-open): si 0 candidatos → vínculo
 *      `no_confirmado` + audit, RETORNA. NO toca el LLM.
 *   2. LLM (MiniMax-M3, temp 0): `construirPromptAdjudicacion` →
 *      `assertNoRutInLlmInput(prompt)` (sobre el string EXACTO; T-04-09) +
 *      `assertSensitivityAllowed` → `provider.complete(..., AdjudicacionSchema)`.
 *   3. COMPUERTA (`aplicarCompuerta`, fail-closed): `auto-aceptar` → vínculo
 *      `probable` metodo='llm' + audit (NUNCA `confirmado`, A4); `revision` →
 *      `enqueueRevision` (pendiente) con candidatos+salida_modelo + audit.
 *
 * El RUT NUNCA cruza al LLM: la mención no lo transporta por diseño y el gate corre
 * sobre el prompt final ANTES de `complete` — si se colara, lanza con 0 llamadas y
 * nada se escribe como confirmado.
 */

import type { Parlamentario } from "@obs/core";
import type { LLMProvider } from "@obs/llm";
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";
import { matchDeterminista, type Mention } from "@obs/identity";
import { generarCandidatos } from "./candidatos";
import {
  AdjudicacionSchema,
  construirPromptAdjudicacion,
  SYSTEM_ADJUDICACION,
  type Adjudicacion,
} from "./prompt";
import { aplicarCompuerta } from "./compuerta";
import type { MencionForanea } from "./tipos";
import type {
  CasoRevision,
  FilaAudit,
  FilaVinculo,
} from "./writer-revision";

/** Subconjunto del RevisionWriter que el pipeline necesita (inyectable/espía en tests). */
export interface PipelineWriter {
  upsertVinculo(v: FilaVinculo): Promise<void>;
  appendAudit(row: FilaAudit): Promise<void>;
  enqueueRevision(caso: CasoRevision): Promise<void>;
}

/** Resultado discriminado del pipeline (lo evalúa el caller/golden). */
export type ResultadoPipeline =
  | { tipo: "determinista"; parlamentarioId: string }
  | { tipo: "no_confirmado"; razon: string }
  | { tipo: "probable"; parlamentarioId: string }
  | { tipo: "revision"; razones: string[] };

/** Provenance por defecto del vínculo (la mención foránea aún no la trae en esta fase). */
function provenance(mencion: MencionForanea): Pick<
  FilaVinculo,
  "origen" | "fecha_captura" | "enlace"
> {
  return {
    origen: mencion.camara,
    fecha_captura: new Date().toISOString(),
    enlace: "",
  };
}

function baseVinculo(mencion: MencionForanea): Omit<
  FilaVinculo,
  "parlamentario_id" | "estado" | "metodo"
> {
  return {
    mencion_nombre: mencion.nombreOriginal,
    mencion_normalizada: mencion.nombreNormalizado,
    camara: mencion.camara,
    periodo: mencion.periodo,
    ...provenance(mencion),
  };
}

/**
 * Orquesta las etapas 0-3 para una mención foránea contra la maestra, usando
 * `provider` (mock en tests/golden, MiniMax real en LIVE) y escribiendo el estado
 * durable vía `writer`. Devuelve un resultado discriminado.
 */
export async function correrPipeline(
  mencion: MencionForanea,
  maestra: Parlamentario[],
  provider: LLMProvider,
  writer: PipelineWriter,
): Promise<ResultadoPipeline> {
  // ── Etapa 0: determinista (reuse de @obs/identity). NO toca el LLM. ──
  const mention: Mention = {
    nombreNormalizado: mencion.nombreNormalizado,
    camara: mencion.camara,
    periodo: mencion.periodo,
  };
  const det = matchDeterminista(mention, maestra);
  if (det.estado === "confirmado") {
    await writer.upsertVinculo({
      ...baseVinculo(mencion),
      parlamentario_id: det.id,
      estado: "confirmado",
      metodo: "determinista",
    });
    await writer.appendAudit({
      vinculo_id: null,
      metodo: "determinista",
      decision: "confirmado",
      confidence: null,
      modelo_version: null,
      revisor_id: null,
      evidence: [`match determinista por ${det.metodo}`],
      conflicts: [],
    });
    return { tipo: "determinista", parlamentarioId: det.id };
  }

  // ── Etapa 1: blocking. Sin candidatos → no_confirmado. NO toca el LLM. ──
  const candidatos = generarCandidatos(mencion, maestra);
  if (candidatos.length === 0) {
    await writer.upsertVinculo({
      ...baseVinculo(mencion),
      parlamentario_id: null,
      estado: "no_confirmado",
      metodo: "llm",
    });
    await writer.appendAudit({
      vinculo_id: null,
      metodo: "llm",
      decision: "no_confirmado",
      confidence: null,
      modelo_version: null,
      revisor_id: null,
      evidence: [],
      conflicts: ["sin candidatos tras blocking"],
    });
    return { tipo: "no_confirmado", razon: "sin-candidatos" };
  }

  // ── Etapa 2: LLM. Gate fail-closed de RUT sobre el prompt EXACTO ANTES de complete. ──
  const userPrompt = construirPromptAdjudicacion(mencion, candidatos);
  assertNoRutInLlmInput(userPrompt);
  assertSensitivityAllowed({ sensitivity: "personal" }, provider);

  const llm: Adjudicacion = await provider.complete(
    {
      system: SYSTEM_ADJUDICACION,
      user: userPrompt,
      criticality: "critical",
      sensitivity: "personal",
      temperature: 0,
    },
    AdjudicacionSchema,
  );

  // ── Etapa 3: compuerta fail-closed. ──
  const decision = aplicarCompuerta(llm, mencion, candidatos);
  if (decision.ruta === "auto-aceptar") {
    // A4: auto-aceptar NUNCA produce 'confirmado'; lo máximo es 'probable'.
    await writer.upsertVinculo({
      ...baseVinculo(mencion),
      parlamentario_id: decision.chosenId,
      estado: "probable",
      metodo: "llm",
    });
    await writer.appendAudit({
      vinculo_id: null,
      metodo: "llm",
      decision: "probable",
      confidence: llm.confidence,
      modelo_version: provider.id,
      revisor_id: null,
      evidence: llm.evidence,
      conflicts: llm.conflicts,
    });
    return { tipo: "probable", parlamentarioId: decision.chosenId };
  }

  // revision → cola humana (pendiente) con candidatos + salida_modelo.
  await writer.enqueueRevision({
    mencion_nombre: mencion.nombreOriginal,
    mencion_normalizada: mencion.nombreNormalizado,
    camara: mencion.camara,
    periodo: mencion.periodo,
    region: mencion.region,
    candidatos: candidatos.map((c) => ({
      id: c.id,
      nombre: `${c.nombres} ${c.apellido_paterno} ${c.apellido_materno}`.trim(),
    })),
    salida_modelo: llm,
    modelo_version: provider.id,
    estado: "pendiente",
    motivo: decision.razones.join("; "),
  });
  await writer.appendAudit({
    vinculo_id: null,
    metodo: "llm",
    decision: "revision",
    confidence: llm.confidence,
    modelo_version: provider.id,
    revisor_id: null,
    evidence: llm.evidence,
    conflicts: decision.razones,
  });
  return { tipo: "revision", razones: decision.razones };
}
