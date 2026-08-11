// registro.ts — registro C2.5 del doble etiquetado (D-133-C2.5, plan 133-b-05) + validación
// determinista de las salidas de los anotadores A/B.
//
// La validación es la puerta: cobertura 154/154 por anotador, etiqueta legal, justificación
// ≤200 chars y `cita` presente como SUBCADENA LITERAL de la entrada del caso (C2.2 hecha
// verificable por código, no por lectura). Un lote parcial o inválido NO se maquilla: se
// re-corre o se registra como parse_fallido (insumo de T2).
//
// `etiqueta` final NO existe aquí: los acuerdos la reciben en el registro, los desacuerdos
// quedan `resuelto_por: "pendiente"` hasta el arbitraje de 133-b-07. La etiqueta de
// calibración de Fable NO entra a este artefacto (vive aparte; se une recién en el cómputo
// de κ de 133-b-06 — ningún anotador pudo verla).

import { z } from "zod";
import { ETIQUETAS_LEGALES, type EntradaAnotacion } from "./anotacion.js";

export const MODELO_A = "claude-sonnet-5";
export const MODELO_B = "claude-opus-5";

export const SalidaAnotadorItemSchema = z
  .object({
    id: z.string().min(1),
    etiqueta: z.string(),
    justificacion: z.string(),
    cita: z.string(),
  })
  .strict();

export type SalidaAnotadorItem = z.infer<typeof SalidaAnotadorItemSchema>;

export interface ProblemaValidacion {
  id: string;
  problema: string;
}

/**
 * Valida la salida completa de UN anotador contra sus entradas. Devuelve la lista de
 * problemas (vacía = válido). Reglas: cobertura exacta (todos los ids, sin extras ni
 * duplicados), etiqueta ∈ las 6, justificación ≤200, `cita` subcadena literal de
 * `titulo`/`descripcion` del caso (comparación exacta de caracteres, sin normalizar — una
 * cita que hubo que normalizar no es literal).
 */
export function validarSalidaAnotador(
  salida: readonly SalidaAnotadorItem[],
  entradas: readonly EntradaAnotacion[],
): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];
  const porId = new Map(entradas.map((e) => [e.id, e]));
  const legales = new Set(ETIQUETAS_LEGALES);
  const vistos = new Set<string>();

  for (const item of salida) {
    if (vistos.has(item.id)) {
      problemas.push({ id: item.id, problema: "id duplicado en la salida" });
      continue;
    }
    vistos.add(item.id);
    const entrada = porId.get(item.id);
    if (!entrada) {
      problemas.push({ id: item.id, problema: "id no existe en las entradas" });
      continue;
    }
    if (!legales.has(item.etiqueta)) {
      problemas.push({ id: item.id, problema: `etiqueta ilegal: "${item.etiqueta}"` });
    }
    if (item.justificacion.length > 200) {
      problemas.push({
        id: item.id,
        problema: `justificacion de ${item.justificacion.length} chars (> 200)`,
      });
    }
    if (item.cita.length === 0) {
      problemas.push({ id: item.id, problema: "cita vacía" });
    } else if (!entrada.titulo.includes(item.cita) && !entrada.descripcion.includes(item.cita)) {
      problemas.push({ id: item.id, problema: "cita NO es subcadena literal de titulo/descripcion" });
    }
  }

  for (const e of entradas) {
    if (!vistos.has(e.id)) {
      problemas.push({ id: e.id, problema: "caso sin etiquetar (cobertura incompleta)" });
    }
  }
  return problemas;
}

export const FilaRegistroSchema = z
  .object({
    caso_id: z.string().min(1),
    etiqueta: z.string().nullable(),
    etiqueta_a: z.string(),
    etiqueta_b: z.string(),
    justificacion_a: z.string(),
    justificacion_b: z.string(),
    cita_a: z.string(),
    cita_b: z.string(),
    acuerdo: z.boolean(),
    resuelto_por: z.enum(["acuerdo", "pendiente", "operador_proxy", "no_arbitrado"]),
    modelo_a: z.literal(MODELO_A),
    modelo_b: z.literal(MODELO_B),
    en_calibracion: z.boolean(),
    revisado_en: z.string(),
  })
  .strict();

export type FilaRegistro = z.infer<typeof FilaRegistroSchema>;

/**
 * Construye el registro C2.5 uniendo las salidas VALIDADAS de A y B. LANZA si alguna
 * validación falla — el registro no puede existir sobre salidas inválidas. `acuerdo` es
 * igualdad exacta de etiquetas; los acuerdos reciben `etiqueta` final de inmediato
 * (`resuelto_por: "acuerdo"`), los desacuerdos quedan `etiqueta: null` +
 * `resuelto_por: "pendiente"` para 133-b-07.
 */
export function construirRegistro(input: {
  salidaA: readonly SalidaAnotadorItem[];
  salidaB: readonly SalidaAnotadorItem[];
  entradas: readonly EntradaAnotacion[];
  idsCalibracion: ReadonlySet<string>;
  revisadoEn: string;
}): FilaRegistro[] {
  const { salidaA, salidaB, entradas, idsCalibracion, revisadoEn } = input;
  const problemasA = validarSalidaAnotador(salidaA, entradas);
  const problemasB = validarSalidaAnotador(salidaB, entradas);
  if (problemasA.length > 0 || problemasB.length > 0) {
    const detalle = [...problemasA.map((p) => `A/${p.id}: ${p.problema}`), ...problemasB.map((p) => `B/${p.id}: ${p.problema}`)];
    throw new Error(`construirRegistro: salidas inválidas (${detalle.length}):\n${detalle.join("\n")}`);
  }
  const porIdA = new Map(salidaA.map((s) => [s.id, s]));
  const porIdB = new Map(salidaB.map((s) => [s.id, s]));

  return entradas.map((e) => {
    const a = porIdA.get(e.id)!;
    const b = porIdB.get(e.id)!;
    const acuerdo = a.etiqueta === b.etiqueta;
    return FilaRegistroSchema.parse({
      caso_id: e.id,
      etiqueta: acuerdo ? a.etiqueta : null,
      etiqueta_a: a.etiqueta,
      etiqueta_b: b.etiqueta,
      justificacion_a: a.justificacion,
      justificacion_b: b.justificacion,
      cita_a: a.cita,
      cita_b: b.cita,
      acuerdo,
      resuelto_por: acuerdo ? "acuerdo" : "pendiente",
      modelo_a: MODELO_A,
      modelo_b: MODELO_B,
      en_calibracion: idsCalibracion.has(e.id),
      revisado_en: revisadoEn,
    });
  });
}
