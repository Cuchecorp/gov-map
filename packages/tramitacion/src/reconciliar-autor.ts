// reconciliar-autor — reconciliación determinista de autores de proyectos de ley (AUTOR-01).
//
// A diferencia de votos (que tienen DIPID para Cámara o nombre para Senado), los autores
// vienen SOLO como nombres en el XML de Senado. La reconciliación prueba ambas cámaras
// (diputados y senado) con matchDeterminista — fail-closed puro. CERO LLM. CERO RUT.
//
// Guarda de identidad LOCKED (espejo voto Senado):
//   SOLO matchDeterminista con resultado "confirmado" puebla parlamentario_id.
//   Sin match (homónimo, sin candidato, cross-cámara) → no_confirmado + autor_crudo + null.
//
// `autor_crudo_norm`: normalización SIMPLE (lower+trim+collapse-spaces) para la clave de
// upsert idempotente. NO usa normalizarNombre — esa es la clave de matching, no de dedup
// (RESEARCH Pitfall 3).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { matchDeterminista, confirmar } from "@obs/identity";
import type { AutorParaEscribir } from "./model";

/** Periodo del Senado (espejo de PERIODO_SENADO_DEFAULT en reconciliar-senado). */
const PERIODO_SENADO = "senado-vigente-2026";
/** Periodo de diputados (espejo de CAMARA_PERIODO en @obs/identity/parse-camara). */
const PERIODO_DIPUTADOS = "2026-2030";

/**
 * Normalización de clave de dedup (autor_crudo_norm): lowercase + trim + colapso de espacios.
 * NO es la misma que normalizarNombre (que sirve al matching); esta es la clave de upsert.
 */
function normClave(nombre: string): string {
  return nombre.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Reconcilia una lista de nombres de autores contra la maestra de parlamentarios.
 *
 * Para cada nombre:
 *   1. Obtiene nombre_normalizado vía normalizarNombre (para matchDeterminista).
 *   2. Prueba cámara "diputados" (periodo 2026-2030), luego "senado" (senado-vigente-2026).
 *   3. Si alguno retorna "confirmado" → enlace_confirmado minteado, metodo "determinista".
 *   4. Si ninguno → enlace_confirmado null, metodo null, estado_vinculo "no_confirmado".
 *
 * Autores de moción pueden ser de cualquier cámara (co-autoría cross-chamber es común);
 * el nombre del XML no indica cámara.
 *
 * @param autores     Nombres crudos del parser (Proyecto.autores).
 * @param maestra     Maestra de parlamentarios vigentes (ya cargada en memoria).
 * @param boletin     FK a proyecto.boletin.
 * @param provenance  Procedencia de la ingesta (origen, fecha_captura, enlace).
 */
export function reconciliarAutores(
  autores: string[],
  maestra: Parlamentario[],
  boletin: string,
  provenance: { origen: string; fecha_captura: string; enlace: string },
): AutorParaEscribir[] {
  return autores.map((nombre) => {
    const autor_crudo_norm = normClave(nombre);

    // Obtener la clave de matching usando el formato `libre` (nombre completo plano).
    // `libre` es la forma libre de normalizarNombre — misma que usa reconciliar-senado.ts
    // para los nombres de votación ("Apellido P., Nombre"). Para autores el XML da el nombre
    // completo directo (p.ej. "Karim Bianchi Retamales"), por lo que `libre` es la forma
    // correcta: extrae apellido+nombre y genera nombre_normalizado con fold+tokens.
    const { nombre_normalizado } = normalizarNombre({ libre: nombre });

    // Probar ambas cámaras: diputados primero, luego senado.
    // Un parlamentario no puede aparecer en ambas en el mismo periodo → sin conflicto.
    const camaras: Array<{ camara: Parlamentario["camara"]; periodo: string }> = [
      { camara: "diputados", periodo: PERIODO_DIPUTADOS },
      { camara: "senado", periodo: PERIODO_SENADO },
    ];

    let enlace_confirmado: ReturnType<typeof confirmar> | null = null;
    let metodo: "determinista" | null = null;
    let estado_vinculo: "confirmado" | "no_confirmado" = "no_confirmado";

    for (const { camara, periodo } of camaras) {
      const r = matchDeterminista(
        { nombreNormalizado: nombre_normalizado, camara, periodo },
        maestra,
      );
      if (r.estado === "confirmado") {
        enlace_confirmado = confirmar(r.id, "determinista");
        metodo = "determinista";
        estado_vinculo = "confirmado";
        break;
      }
    }

    return {
      boletin,
      autor_crudo: nombre,
      autor_crudo_norm,
      enlace_confirmado,
      metodo,
      estado_vinculo,
      origen: provenance.origen,
      fecha_captura: provenance.fecha_captura,
      enlace_provenance: provenance.enlace,
    };
  });
}
