/**
 * Etapa 1 del pipeline de adjudicación (ID-03): generación de candidatos por
 * BLOCKING. Reduce la maestra a una lista corta de candidatos plausibles que el
 * adjudicador LLM evalúa, filtrando por apellido + cámara + periodo + región.
 *
 * FAIL-OPEN por DISEÑO (Pitfall 2): cámara y periodo son filtros DUROS (un voto
 * del Senado del periodo X no puede ser un diputado de otro periodo), pero la
 * REGIÓN es BLANDA. Si la mención no trae región, o si alguno de los dos lados no
 * la trae, NO se filtra por región. Perder al candidato real sería un FALSO
 * NEGATIVO SILENCIOSO (no genera error, simplemente nunca se reconcilia); preferimos
 * sobre-incluir y dejar que la compuerta + revisión humana descarte de más.
 */

import type { Parlamentario } from "@obs/core";
import type { MencionForanea } from "./tipos";

/**
 * Genera la lista corta de candidatos de la maestra para una mención foránea.
 *
 * Filtros:
 *  - apellido (DURO): `m.tokens[0]` (token de apellido paterno) debe estar entre los
 *    tokens de `p.nombre_normalizado` (la maestra YA viene normalizada).
 *  - cámara (DURO): `p.camara === m.camara`.
 *  - periodo (DURO): `p.periodo === m.periodo`.
 *  - región (BLANDA / fail-open): solo descarta si AMBOS lados traen región y difieren.
 */
export function generarCandidatos(
  m: MencionForanea,
  maestra: Parlamentario[],
): Parlamentario[] {
  const apellido = m.tokens[0];
  if (apellido === undefined) return [];

  return maestra.filter((p) => {
    // Filtros DUROS: cámara y periodo.
    if (p.camara !== m.camara) return false;
    if (p.periodo !== m.periodo) return false;

    // Apellido paterno (token) compartido con el nombre normalizado del candidato.
    const tokensP = p.nombre_normalizado.split(" ").filter(Boolean);
    if (!tokensP.includes(apellido)) return false;

    // Filtro BLANDO de región (fail-open): solo descarta si ambos lados la traen
    // y difieren. Si cualquiera es null, no se filtra.
    if (m.region != null && p.region != null && p.region !== m.region) {
      return false;
    }

    return true;
  });
}
