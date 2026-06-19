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
// WR-02 — precondición de periodo/cámara HECHA EXPLÍCITA: la determinación por `Diputado/Id`
// es sólida SOLO si la maestra indexada está acotada a la cámara de diputados (y, opcionalmente,
// al periodo de la votación). Si la maestra trajera diputados históricos, o un DIPID se reusara
// entre periodos, el cruce podría vincular el voto a una persona que NO fue la votante. Por eso:
//   1) SOLO se indexan filas `camara === 'diputados'` (un PARLID del Senado jamás contamina el
//      índice de DIPID).
//   2) Si el caller pasa `periodo`, SOLO se indexan filas de ese periodo; un DIPID que resuelva
//      a una persona de otro periodo NO se vincula (fail-closed → parlamentario_id=null).
// Sin `periodo`, se documenta que la maestra DEBE estar acotada al periodo vigente (como la
// sembrada en Fase 3); el filtro por cámara se aplica siempre.
//
// Función PURA: recibe la maestra ya cargada (sin red ni DB). Cada `Voto` se valida con
// `VotoSchema` antes de devolver.

import type { Parlamentario } from "@obs/core";
import { confirmar } from "@obs/identity";
import { VotoSchema } from "./model";
import type { VotoParaEscribir } from "./writer";
import { aplanarVoto } from "./writer";
import type { CamaraVotoDetalle } from "./parse-camara-votacion";

/** Opciones de scoping del cruce (WR-02). */
export interface ReconciliarCamaraOpts {
  /**
   * Periodo de la votación. Si se pasa, SOLO se vinculan DIPIDs cuya fila de maestra es de ese
   * periodo (fail-closed cruzando periodos). Si se omite, se asume —y se documenta— que la
   * maestra ya está acotada al periodo vigente; el filtro por cámara='diputados' se aplica igual.
   */
  periodo?: string;
}

/**
 * Reconcilia el voto-a-voto crudo de la Cámara (`parseCamaraVotoDetalle`) contra la maestra,
 * vinculando `parlamentario_id` de forma determinista por `Diputado/Id`.
 *
 * @param votosCrudos  Votos crudos `{ diputadoId, opcion, nombreCrudo }` de la ola 2.
 * @param votacionId   Id de la votación (FK a `votacion.id`, p.ej. "camara:89178").
 * @param maestra      Tabla maestra de parlamentarios ya cargada.
 * @param opts         Scoping de periodo (WR-02); el filtro por cámara='diputados' es implícito.
 * @returns            `VotoParaEscribir[]` listos para el writer; el FK es un `EnlaceConfirmado`
 *                     minteado (IDENT-12) SÓLO cuando el DIPID resuelve en la maestra vigente.
 */
export function reconciliarVotosCamara(
  votosCrudos: CamaraVotoDetalle[],
  votacionId: string,
  maestra: Parlamentario[],
  opts: ReconciliarCamaraOpts = {},
): VotoParaEscribir[] {
  // WR-02: índice por id_diputado_camara acotado a cámara='diputados' (y periodo si se pasó),
  // construido UNA vez (saltando null/vacíos). Esto impide que un DIPID resuelva a una persona
  // fuera del periodo/cámara de la votación y se afirme un vínculo falso.
  const idx = new Map<string, Parlamentario>();
  for (const p of maestra) {
    if (p.camara !== "diputados") continue; // solo diputados pueden tener un DIPID válido
    if (opts.periodo != null && p.periodo !== opts.periodo) continue; // fail-closed cross-periodo
    const id = p.id_diputado_camara;
    if (id != null && id.length > 0) idx.set(String(id), p);
  }

  return votosCrudos.map((v, i) => {
    const key = String(v.diputadoId ?? "");
    const p = key.length > 0 ? idx.get(key) : undefined;

    const voto: VotoParaEscribir =
      p !== undefined
        ? {
            // Cruce por Id: el más fuerte (identificador oficial), sin LLM, sin riesgo.
            // IDENT-12: el match por DIPID oficial ES un confirmado determinista → mintea el
            // EnlaceConfirmado vía la ÚNICA factory (no se fija un string crudo en el FK).
            votacion_id: votacionId,
            // CR-02: la clave natural del votante es el DIPID oficial, NO el nombre.
            fuente_voter_id: key,
            mencion_nombre: v.nombreCrudo,
            enlace: confirmar(p.id, "determinista"),
            seleccion: v.opcion,
            metodo: "determinista",
            estado_vinculo: "confirmado",
          }
        : {
            // Id ausente en la maestra vigente → fail-closed: no se afirma identidad.
            votacion_id: votacionId,
            // CR-02: aun sin vínculo, el DIPID crudo discrimina al votante (si vino vacío, se
            // usa el índice posicional como respaldo para no colapsar dos votos sin id).
            fuente_voter_id: key.length > 0 ? key : `seq:${i}`,
            mencion_nombre: v.nombreCrudo,
            enlace: null,
            seleccion: v.opcion,
            metodo: null,
            estado_vinculo: "no_confirmado",
          };

    // Defensa-en-profundidad: la forma DB persistida (plana) sigue validando con zod.
    VotoSchema.parse(aplanarVoto(voto));
    return voto;
  });
}
