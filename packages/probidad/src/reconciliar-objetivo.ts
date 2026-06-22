// reconciliar-objetivo — cruce DIRIGIDO (targeted) del declarante de cada declaración contra UN
// parlamentario CONOCIDO (`objetivo`) vía un test de SUPERCONJUNTO de tokens. Es la contraparte de
// reconciliar-declarante.ts (que cruza name-only contra TODA la maestra vía `correrPipeline`); aquí
// la corrida ya sabe a QUIÉN está consultando (Phase 26: ingesta LIVE por parlamentario, una query
// por objetivo) y sólo debe quedarse con las declaraciones que le pertenecen.
//
// DISEÑO VERIFICADO (LIVE 2026-06-22, el núcleo de la fase):
//   InfoProbidad devuelve el nombre COMPLETO del declarante CON segundos nombres
//   (p.ej. "BORIS ANTHONY BARRERA MORENO") y los HERMANOS comparten paterno+materno
//   (p.ej. "JORGE ALESSANDRI VERGARA" y "FELIPE ALESSANDRI VERGARA" son ambos diputados). La
//   maestra sólo tiene `nombres` (a menudo el primer nombre) + paterno + materno.
//
//   El match es un test de SUPERCONJUNTO DE TOKENS dirigido: para un `objetivo` conocido, una
//   declaración le pertenece SII CADA token del nombre del objetivo está presente en los tokens
//   del declarante:
//       need = tokens( objetivo.nombres + paterno + materno )
//       have = tokens( decl.declaranteNombre )
//       match  ⟺  need.size > 0 && [...need].every(t => have.has(t))
//   Esto:
//     - tolera segundos nombres del declarante (el declarante es SUPERCONJUNTO del objetivo);
//     - tolera apellidos compuestos (todos sus tokens están en need y en have);
//     - DISTINGUE hermanos por el primer nombre (Felipe no contiene el token "jorge" → excluido).
//   VERIFICADO LIVE: D1009 Jorge → sólo "JORGE ALESSANDRI VERGARA" (excluye Felipe); D1012 →
//   "BORIS ANTHONY BARRERA MORENO"; hermanos correctamente separados.
//
// GUARDA DE IDENTIDAD (IDENT-12): el test de superconjunto ES DETERMINISTA — no hay LLM, no hay
// fuzzy/probabilístico. Por eso (y SÓLO por eso) se mintea un `EnlaceConfirmado` vía
// `confirmar(objetivo.id, "determinista")` y se puebla el FK + `estado_vinculo = "confirmado"`. Las
// declaraciones que NO pasan el test pertenecen a OTRA persona (un hermano, un homónimo parcial) y
// se DESCARTAN aquí: serán confirmadas por la query dirigida de SU propio objetivo. NUNCA se escribe
// una declaración a un objetivo que no la supere — fail-closed, jamás fabrica un enlace.
//
// FAMILIARES (deny-by-default): pasan crudos `{relacion, nombre}`, SIN reconciliación, igual que en
// reconciliar-declarante.ts.

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { confirmar } from "@obs/identity";

import type { Declaracion } from "./model";
import type { DeclaracionParaEscribir } from "./reconciliar-declarante";

/** Tokens (sin partículas) del nombre completo de un parlamentario objetivo. */
function tokensObjetivo(objetivo: Parlamentario): string[] {
  const libre = [objetivo.nombres, objetivo.apellido_paterno, objetivo.apellido_materno]
    .filter(Boolean)
    .join(" ");
  return normalizarNombre({ libre }).tokens;
}

/**
 * Reconciliación DIRIGIDA: devuelve SÓLO las declaraciones cuyo declarante es un SUPERCONJUNTO de
 * tokens del `objetivo` (que por tanto le pertenecen), ya listas para el writer con el FK del
 * objetivo confirmado (determinista). Las no-coincidentes se DESCARTAN (pertenecen a otra persona;
 * las confirmará su propia query dirigida). Pura e idempotente.
 */
export function reconciliarDeclaracionesObjetivo(
  declaraciones: Declaracion[],
  objetivo: Parlamentario,
): DeclaracionParaEscribir[] {
  const need = new Set(tokensObjetivo(objetivo));
  // Sin tokens en el objetivo (nombre vacío) no hay con qué cruzar → 0 filas (fail-closed).
  if (need.size === 0) return [];

  // El FK confirmado se mintea UNA vez: todas las filas de este objetivo comparten el mismo enlace.
  const enlace = confirmar(objetivo.id, "determinista");

  const out: DeclaracionParaEscribir[] = [];
  for (const decl of declaraciones) {
    const have = new Set(normalizarNombre({ libre: decl.declaranteNombre }).tokens);
    // Test de SUPERCONJUNTO: cada token del objetivo debe estar en el declarante.
    const pertenece = [...need].every((t) => have.has(t));
    if (!pertenece) continue;

    out.push({
      fuenteId: decl.fuenteId,
      fechaPresentacion: decl.fechaPresentacion,
      enlace,
      mencionDeclarante: decl.declaranteNombre.trim(),
      estadoVinculo: "confirmado",
      tipo: decl.tipo,
      cargo: decl.cargo,
      organismo: decl.organismo,
      // Bienes y familiares pasan crudos (los familiares SIN enlace — deny-by-default).
      bienes: decl.bienes,
      familiares: decl.familiares,
      origen: decl.origen,
      fecha_captura: decl.fecha_captura,
      enlace_url: decl.enlace,
      licencia: decl.licencia,
    });
  }
  return out;
}
