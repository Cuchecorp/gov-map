/**
 * correrPipelineEntidad — orquestación de las etapas 0→3 del subsistema de identidad de TERCEROS
 * (ENT-02/ENT-04). ESPEJO de `correrPipeline` (pipeline.ts) contra la maestra `entidad_tercero`,
 * con la pieza nueva crítica Δ2: una entidad `tipo_entidad === 'juridica'` SALTA la Etapa 2 LLM
 * por completo (no_confirmado directo, 0 llamadas al modelo).
 *
 * Etapas:
 *   0. DETERMINISTA (`matchDeterministaEntidad` de @obs/identity): `confirmado` (RUT exacto o
 *      nombre único por tipo) → vínculo `confirmado` metodo='determinista' + audit, RETORNA. NO LLM.
 *   Δ2 JURÍDICA (LOCKED, antes de Etapa 1/2): si `tipoEntidad === 'juridica'` → `no_confirmado`
 *      directo + audit, RETORNA. Una jurídica NUNCA alcanza construirPromptEntidad ni el LLM.
 *   1. BLOCKING: 0 candidatos (natural) → `no_confirmado` + audit (metodo='determinista'), RETORNA. NO LLM.
 *   2. LLM (solo persona natural homónima): `construirPromptEntidad` →
 *      `assertNoRutInLlmInput(system+user EXACTO)` (ENT-02; lanza con 0 llamadas si un RUT se cuela) +
 *      `assertSensitivityAllowed` → `provider.complete(..., AdjudicacionEntidadSchema)`.
 *   3. COMPUERTA (`aplicarCompuertaEntidad`, reusa el UMBRAL 0.90 estricto): `auto-aceptar` →
 *      `probable` metodo='llm' (NUNCA `confirmado`, A4); `revision` → `enqueueRevision` (pendiente)
 *      + audit con `vinculo_id: null` (la promoción a confirmado es exclusiva del humano vía RPC).
 *
 * El RUT NUNCA cruza al LLM: la mención no lo transporta por diseño y el gate corre sobre el prompt
 * final ANTES de `complete`. La promoción a `confirmado` por LLM es IMPOSIBLE (A4).
 */

import type { LLMProvider } from "@obs/llm";
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";
import {
  matchDeterministaEntidad,
  type EntidadTerceroRow,
  type MentionEntidad,
} from "@obs/identity";
import {
  AdjudicacionEntidadSchema,
  construirPromptEntidad,
  SYSTEM_ADJUDICACION_ENTIDAD,
  type AdjudicacionEntidad,
} from "./prompt-entidad";
import { aplicarCompuertaEntidad } from "./compuerta-entidad";
import type { MencionEntidadForanea } from "./tipos-entidad";
import type {
  CasoRevisionEntidad,
  FilaAuditEntidad,
  FilaVinculoEntidad,
} from "./writer-revision-entidad";

/** Subconjunto del RevisionEntidadWriter que el pipeline necesita (inyectable/espía en tests). */
export interface PipelineEntidadWriter {
  /** Devuelve el `id` del vínculo escrito (o null) para enlazarlo en el audit. */
  upsertVinculoEntidad(v: FilaVinculoEntidad): Promise<number | null>;
  appendAudit(row: FilaAuditEntidad): Promise<void>;
  enqueueRevision(caso: CasoRevisionEntidad): Promise<void>;
}

/** Resultado discriminado del pipeline de terceros (lo evalúa el caller). */
export type ResultadoPipelineEntidad =
  | { tipo: "determinista"; entidadTerceroId: string }
  | { tipo: "no_confirmado"; razon: string }
  | { tipo: "probable"; entidadTerceroId: string }
  | { tipo: "revision"; razones: string[] };

/** Provenance por defecto del vínculo (la mención foránea aún no la trae en esta fase). */
function provenance(): Pick<FilaVinculoEntidad, "origen" | "fecha_captura" | "enlace"> {
  return {
    origen: "reconciliacion",
    fecha_captura: new Date().toISOString(),
    enlace: "",
  };
}

function baseVinculo(
  mencion: MencionEntidadForanea,
): Omit<FilaVinculoEntidad, "entidad_tercero_id" | "estado" | "metodo"> {
  return {
    mencion_nombre: mencion.nombreOriginal,
    mencion_normalizada: mencion.nombreNormalizado,
    tipo_entidad: mencion.tipoEntidad,
    ...provenance(),
  };
}

/**
 * BLOCKING de terceros (Etapa 1): candidatos homónimos del MISMO tipo. La maestra ya viene
 * normalizada; la lista corta son las filas del tipo de la mención con el mismo nombre normalizado
 * (el conjunto de homónimos que el LLM debe desempatar). Sólo se invoca para persona natural.
 */
export function generarCandidatosEntidad(
  mencion: MencionEntidadForanea,
  maestra: EntidadTerceroRow[],
): EntidadTerceroRow[] {
  return maestra.filter(
    (e) =>
      e.tipo_entidad === mencion.tipoEntidad &&
      e.nombre_normalizado === mencion.nombreNormalizado,
  );
}

/**
 * Orquesta las etapas 0-3 para una mención de tercero contra la maestra, usando `provider`
 * (mock en tests, MiniMax real en LIVE) y escribiendo el estado durable vía `writer`.
 */
export async function correrPipelineEntidad(
  mencion: MencionEntidadForanea,
  maestra: EntidadTerceroRow[],
  provider: LLMProvider,
  writer: PipelineEntidadWriter,
): Promise<ResultadoPipelineEntidad> {
  // ── Etapa 0: determinista (reuse de @obs/identity). NO toca el LLM. ──
  const mention: MentionEntidad = {
    nombreNormalizado: mencion.nombreNormalizado,
    tipoEntidad: mencion.tipoEntidad,
  };
  const det = matchDeterministaEntidad(mention, maestra);
  if (det.estado === "confirmado") {
    const vinculoId = await writer.upsertVinculoEntidad({
      ...baseVinculo(mencion),
      entidad_tercero_id: det.id,
      estado: "confirmado",
      metodo: "determinista",
    });
    await writer.appendAudit({
      vinculo_id: vinculoId,
      metodo: "determinista",
      decision: "confirmado",
      confidence: null,
      modelo_version: null,
      revisor_id: null,
      evidence: [`match determinista por ${det.metodo}`],
      conflicts: [],
      tipo_entidad: mencion.tipoEntidad,
    });
    return { tipo: "determinista", entidadTerceroId: det.id };
  }

  // ── Δ2: JURÍDICA (LOCKED). Una jurídica NUNCA alcanza el LLM. ──
  // El matcher devolvió 'no_confirmado' (razon 'juridica-sin-rut' o RUT no único). Saltamos la
  // Etapa 1/2 por completo: no se construye prompt ni se llama al modelo. Degradación honesta.
  if (mencion.tipoEntidad === "juridica") {
    const vinculoId = await writer.upsertVinculoEntidad({
      ...baseVinculo(mencion),
      entidad_tercero_id: null,
      estado: "no_confirmado",
      metodo: "determinista",
    });
    await writer.appendAudit({
      vinculo_id: vinculoId,
      metodo: "determinista",
      decision: "no_confirmado",
      confidence: null,
      modelo_version: null,
      revisor_id: null,
      evidence: [],
      conflicts: ["jurídica sin RUT único: no se adjudica por LLM (regla LOCKED)"],
      tipo_entidad: mencion.tipoEntidad,
    });
    return { tipo: "no_confirmado", razon: "juridica-sin-rut" };
  }

  // ── Etapa 1: blocking (solo natural). Sin candidatos → no_confirmado. NO toca el LLM. ──
  const candidatos = generarCandidatosEntidad(mencion, maestra);
  if (candidatos.length === 0) {
    // Decisión 100% DETERMINISTA (no se invocó al LLM) → metodo='determinista', no 'llm'.
    const vinculoId = await writer.upsertVinculoEntidad({
      ...baseVinculo(mencion),
      entidad_tercero_id: null,
      estado: "no_confirmado",
      metodo: "determinista",
    });
    await writer.appendAudit({
      vinculo_id: vinculoId,
      metodo: "determinista",
      decision: "no_confirmado",
      confidence: null,
      modelo_version: null,
      revisor_id: null,
      evidence: [],
      conflicts: ["sin candidatos tras blocking"],
      tipo_entidad: mencion.tipoEntidad,
    });
    return { tipo: "no_confirmado", razon: "sin-candidatos" };
  }

  // ── Etapa 2: LLM. Gate fail-closed de RUT sobre el payload EXACTO ANTES de complete. ──
  // Corre sobre TODO lo enviado (system + user). Si un RUT se cuela (dato sucio en la maestra),
  // lanza con 0 llamadas y nada se escribe como confirmado (ENT-02).
  const userPrompt = construirPromptEntidad(mencion, candidatos);
  assertNoRutInLlmInput(`${SYSTEM_ADJUDICACION_ENTIDAD}\n${userPrompt}`);
  assertSensitivityAllowed({ sensitivity: "personal" }, provider);

  const llm: AdjudicacionEntidad = await provider.complete(
    {
      system: SYSTEM_ADJUDICACION_ENTIDAD,
      user: userPrompt,
      criticality: "critical",
      sensitivity: "personal",
      temperature: 0,
    },
    AdjudicacionEntidadSchema,
  );

  // ── Etapa 3: compuerta fail-closed (UMBRAL 0.90 estricto, reusado de compuerta.ts). ──
  const decision = aplicarCompuertaEntidad(llm, mencion, candidatos);
  if (decision.ruta === "auto-aceptar") {
    // A4: auto-aceptar NUNCA produce 'confirmado'; lo máximo es 'probable'.
    const vinculoId = await writer.upsertVinculoEntidad({
      ...baseVinculo(mencion),
      entidad_tercero_id: decision.chosenId,
      estado: "probable",
      metodo: "llm",
    });
    await writer.appendAudit({
      vinculo_id: vinculoId,
      metodo: "llm",
      decision: "probable",
      confidence: llm.confidence,
      modelo_version: provider.id,
      revisor_id: null,
      evidence: llm.evidence,
      conflicts: llm.conflicts,
      tipo_entidad: mencion.tipoEntidad,
    });
    return { tipo: "probable", entidadTerceroId: decision.chosenId };
  }

  // revision → cola humana (pendiente) con candidatos + salida_modelo.
  await writer.enqueueRevision({
    mencion_nombre: mencion.nombreOriginal,
    mencion_normalizada: mencion.nombreNormalizado,
    tipo_entidad: mencion.tipoEntidad,
    candidatos: candidatos.map((c) => ({ id: c.id, nombre: c.nombre_normalizado })),
    salida_modelo: llm,
    modelo_version: provider.id,
    estado: "pendiente",
    motivo: decision.razones.join("; "),
  });
  await writer.appendAudit({
    // La rama de revisión NO crea un vínculo (la promoción a confirmado es exclusiva del humano
    // vía revisor-entidad-cli / RPC resolver_entidad). `vinculo_id` null por diseño explícito.
    vinculo_id: null,
    metodo: "llm",
    decision: "revision",
    confidence: llm.confidence,
    modelo_version: provider.id,
    revisor_id: null,
    evidence: llm.evidence,
    conflicts: decision.razones,
    tipo_entidad: mencion.tipoEntidad,
  });
  return { tipo: "revision", razones: decision.razones };
}
