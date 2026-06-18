// reconciliar-camara — cruce DETERMINISTA del voto-a-voto de la Cámara por Diputado/Id.
//
// Decisión ADDENDUM del usuario: el voto individual de la Cámara se vincula a la persona
// cruzando el `Diputado/Id` del WS de la Cámara contra `parlamentario.id_diputado_camara`.
// Este cruce es por IDENTIFICADOR OFICIAL (no por nombre): es determinista, de bajo riesgo,
// NO requiere LLM ni `correrPipeline`, y es MÁS fuerte que el match por nombre.
//
// Guarda de identidad (T-05-07, fail-closed): si un `Diputado/Id` NO está en la maestra
// vigente (p.ej. un diputado de un periodo anterior), NO se fabrica un vínculo: el voto queda
// `parlamentario_id=null`, `estado_vinculo='no_confirmado'`, conservando el nombre crudo en
// `mencion_nombre` para display con marca "identidad no verificada". Nunca se afirma un id dudoso.
//
// Función PURA: recibe la maestra ya cargada (sin red ni DB). Cada `Voto` se valida con
// `VotoSchema` antes de devolver.

import type { Parlamentario } from "@obs/core";
import { type Voto, VotoSchema } from "./model";
import type { CamaraVotoDetalle } from "./parse-camara-votacion";

/**
 * Reconcilia el voto-a-voto crudo de la Cámara (`parseCamaraVotoDetalle`) contra la maestra,
 * vinculando `parlamentario_id` de forma determinista por `Diputado/Id`.
 *
 * @param votosCrudos  Votos crudos `{ diputadoId, opcion, nombreCrudo }` de la ola 2.
 * @param votacionId   Id de la votación (FK a `votacion.id`, p.ej. "camara:89178").
 * @param maestra      Tabla maestra de parlamentarios ya cargada.
 * @returns            `Voto[]` listos para persistir (parlamentario_id solo si Id presente).
 */
export function reconciliarVotosCamara(
  votosCrudos: CamaraVotoDetalle[],
  votacionId: string,
  maestra: Parlamentario[],
): Voto[] {
  // Índice por id_diputado_camara, construido UNA vez (saltando los null/vacíos).
  const idx = new Map<string, Parlamentario>();
  for (const p of maestra) {
    const id = p.id_diputado_camara;
    if (id != null && id.length > 0) idx.set(String(id), p);
  }

  return votosCrudos.map((v) => {
    const key = String(v.diputadoId ?? "");
    const p = key.length > 0 ? idx.get(key) : undefined;

    const voto: Voto =
      p !== undefined
        ? {
            // Cruce por Id: el más fuerte (identificador oficial), sin LLM, sin riesgo.
            votacion_id: votacionId,
            mencion_nombre: v.nombreCrudo,
            parlamentario_id: p.id,
            seleccion: v.opcion,
            metodo: "determinista",
            estado_vinculo: "confirmado",
          }
        : {
            // Id ausente en la maestra vigente → fail-closed: no se afirma identidad.
            votacion_id: votacionId,
            mencion_nombre: v.nombreCrudo,
            parlamentario_id: null,
            seleccion: v.opcion,
            metodo: null,
            estado_vinculo: "no_confirmado",
          };

    return VotoSchema.parse(voto) as Voto;
  });
}
