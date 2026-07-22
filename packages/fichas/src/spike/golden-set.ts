/**
 * GOLDEN SET DE RETRIEVAL — CONGELADO al cierre del plan 86-03 (ajuste LIVE).
 * Cambios requieren decisión registrada, no ediciones silenciosas.
 *
 * AJUSTE LIVE (plan 86-03, 2026-07-22):
 *   Los boletines originales eran hipótesis de plan 86-01 ("validar contra PROD").
 *   Este ajuste corrige los expected[] según la búsqueda LIVE en PROD.
 *   Criterio de ajuste: ilike sobre titulo, o lookup por cuerpos_legales, o por boletin_num.
 *   Casos con múltiples candidatos: se elige el más representativo del query.
 *   Ver 86-SCORING.md sección "Ajuste LIVE del golden set".
 *
 * Contiene ≥30 queries anotadas cubriendo las 6 categorías mandatadas:
 *   titulo-literal   — palabras textuales del título (el bug estrella: solo-semántico falla)
 *   parafrasis-nl    — paráfrasis natural (el semántico debe seguir ganando)
 *   normas           — cuerpos legales / normas citadas
 *   boletin          — 3 formatos: 14309-04 / 14309 / 14.309-04 (hit@1 obligatorio)
 *   acentos-toponimos — Ñuñoa / Aysén / medio ambiente
 *   similares        — proyectos similares (match_proyectos SEM-05, no regresionar)
 */

export type CategoriaRetrieval =
  | "titulo-literal"
  | "parafrasis-nl"
  | "normas"
  | "boletin"
  | "acentos-toponimos"
  | "similares";

export interface CasoRetrieval {
  id: string;
  category: CategoriaRetrieval;
  query: string;
  expected: string[]; // boletín/es esperados en formato canónico (dígitos + guion)
  nota: string;
}

/**
 * Normaliza para comparación accent-insensitive: NFD + strip diacríticos + lowercase
 * + whitespace colapsado. Copiado verbatim de packages/fichas/src/golden/golden-set.ts.
 */
export function normalizarLiteral(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// CONGELADO al cierre del plan 86-03 — cambios requieren decisión registrada, no ediciones silenciosas
export const GOLDEN_SET: CasoRetrieval[] = [
  // ── titulo-literal (8 casos) ─────────────────────────────────────────────────
  // El bug estrella: búsqueda solo-semántica falla en títulos textuales
  {
    id: "tl-01",
    category: "titulo-literal",
    query: "proyecto de ley sobre protección de datos personales",
    expected: ["18060-07", "18118-07"],
    nota: "AJUSTE LIVE 86-03: boletines reales PROD para ley de datos personales (ley 21.719)",
  },
  {
    id: "tl-02",
    category: "titulo-literal",
    query: "modifica el código del trabajo en materia de jornada laboral",
    expected: ["18171-13"],
    nota: "AJUSTE LIVE 86-03: boletín real PROD para jornada laboral Código del Trabajo",
  },
  {
    id: "tl-03",
    category: "titulo-literal",
    query: "ley de migraciones y extranjería",
    expected: ["18040-06", "18377-06", "18422-06"],
    nota: "AJUSTE LIVE 86-03: boletines PROD de ley de Migración y Extranjería (21.325)",
  },
  {
    id: "tl-04",
    category: "titulo-literal",
    query: "derecho a la desconexión digital",
    expected: ["16349-13"],
    nota: "AJUSTE LIVE 86-03: único proyecto con 'desconex' en título en PROD",
  },
  {
    id: "tl-05",
    category: "titulo-literal",
    query: "regula el teletrabajo y trabajo a distancia",
    expected: ["18376-13", "17986-13"],
    nota: "AJUSTE LIVE 86-03: proyectos de teletrabajo real en PROD",
  },
  {
    id: "tl-06",
    category: "titulo-literal",
    query: "modifica la ley general de urbanismo y construcciones",
    expected: ["18309-14", "17591-14"],
    nota: "AJUSTE LIVE 86-03: proyectos de Ley General de Urbanismo y Construcciones en PROD",
  },
  {
    id: "tl-07",
    category: "titulo-literal",
    query: "sobre el sistema de garantías y protección integral de los derechos de la niñez",
    expected: ["16286-07"],
    nota: "AJUSTE LIVE 86-03: proyecto de garantías niñez en PROD",
  },
  {
    id: "tl-08",
    category: "titulo-literal",
    query: "crea el ministerio de ciencia tecnología conocimiento e innovación",
    expected: ["16441-19"],
    nota: "AJUSTE LIVE 86-03: único proyecto con 'Ministerio de Ciencia' en título en PROD",
  },

  // ── parafrasis-nl (5 casos) ───────────────────────────────────────────────────
  // El semántico debe seguir ganando (baseline SEM-05)
  {
    id: "nl-01",
    category: "parafrasis-nl",
    query: "legislación que protege la privacidad de las personas en internet",
    expected: ["18060-07", "18118-07", "15766-03"],
    nota: "AJUSTE LIVE 86-03: proyectos de privacidad/datos personales en PROD",
  },
  {
    id: "nl-02",
    category: "parafrasis-nl",
    query: "normas para regular el trabajo desde casa",
    expected: ["18376-13", "17986-13", "16349-13"],
    nota: "AJUSTE LIVE 86-03: proyectos de teletrabajo/trabajo remoto en PROD",
  },
  {
    id: "nl-03",
    category: "parafrasis-nl",
    query: "derechos de los trabajadores a descanso digital fuera del horario",
    expected: ["16349-13"],
    nota: "AJUSTE LIVE 86-03: proyecto de desconexión digital en PROD",
  },
  {
    id: "nl-04",
    category: "parafrasis-nl",
    query: "regulación de personas que llegan al país desde el extranjero",
    expected: ["18040-06", "17474-06"],
    nota: "AJUSTE LIVE 86-03: proyectos de migración en PROD",
  },
  {
    id: "nl-05",
    category: "parafrasis-nl",
    query: "investigación científica y desarrollo tecnológico en Chile",
    expected: ["16441-19"],
    nota: "AJUSTE LIVE 86-03: ministerio ciencia/tecnología en PROD",
  },

  // ── normas (5 casos) ──────────────────────────────────────────────────────────
  // Búsqueda por cuerpos legales citados
  {
    id: "nr-01",
    category: "normas",
    query: "modifica ley 19628 datos personales",
    expected: ["18060-07", "15766-03"],
    nota: "AJUSTE LIVE 86-03: proyectos que citan ley 19628 en cuerpos_legales PROD; ley 19628 = protección de datos (antigua)",
  },
  {
    id: "nr-02",
    category: "normas",
    query: "reforma código del trabajo artículo 22 jornada",
    expected: ["18171-13", "17987-13"],
    nota: "AJUSTE LIVE 86-03: proyectos modificando Código del Trabajo jornada en PROD",
  },
  {
    id: "nr-03",
    category: "normas",
    query: "modifica ley 21325 migración extranjeros",
    expected: ["18040-06", "18377-06", "17474-06"],
    nota: "AJUSTE LIVE 86-03: proyectos que modifican ley 21.325 (Migración) en PROD",
  },
  {
    id: "nr-04",
    category: "normas",
    query: "cambio climático medio ambiente ley",
    expected: ["17446-17", "16553-12"],
    nota: "AJUSTE LIVE 86-03: proyectos sobre cambio climático y medio ambiente en PROD",
  },
  {
    id: "nr-05",
    category: "normas",
    query: "modifica ley municipalidades servicios comunales",
    expected: ["16553-12"],
    nota: "AJUSTE LIVE 86-03: proyectos modificando ley de municipalidades en PROD",
  },

  // ── boletin (4 casos) — hit@1 obligatorio, 3 formatos ────────────────────────
  // El detector hace short-circuit antes del RRF — lookup exacto
  {
    id: "bo-01",
    category: "boletin",
    query: "14309-04",
    expected: ["14309-04"],
    nota: "formato canónico sin punto — hit@1 obligatorio; PROD: 14309-04 existe",
  },
  {
    id: "bo-02",
    category: "boletin",
    query: "14309",
    expected: ["14309-04"],
    nota: "AJUSTE LIVE 86-03: boletin_num='14309' → boletin='14309-04' en PROD; expected corregido al boletin canónico",
  },
  {
    id: "bo-03",
    category: "boletin",
    query: "14.309-04",
    expected: ["14309-04"],
    nota: "formato punteado — el caso que hoy falla (Pitfall #5); hit@1 obligatorio",
  },
  {
    id: "bo-04",
    category: "boletin",
    query: "18060-07",
    expected: ["18060-07"],
    nota: "AJUSTE LIVE 86-03: boletin canónico de ley datos personales (existe en PROD); reemplaza 11144-07 inexistente",
  },

  // ── acentos-toponimos (5 casos) ───────────────────────────────────────────────
  // Búsqueda con acentos, ñ y topónimos regionales
  {
    id: "at-01",
    category: "acentos-toponimos",
    query: "Ñuñoa",
    expected: ["14309-04"],
    nota: "PENDIENTE: ningún proyecto con Ñuñoa en título encontrado en PROD (ILIKE vacío); 14309-04 es placeholder — ver nota. unaccent=false en PROD puede ser el problema.",
  },
  {
    id: "at-02",
    category: "acentos-toponimos",
    query: "Aysén",
    expected: ["18009-02", "16485-21"],
    nota: "AJUSTE LIVE 86-03: proyectos con Aysén en título en PROD",
  },
  {
    id: "at-03",
    category: "acentos-toponimos",
    query: "medio ambiente",
    expected: ["16553-12", "17228-07", "17446-17"],
    nota: "AJUSTE LIVE 86-03: proyectos con 'medio ambiente' en título en PROD",
  },
  {
    id: "at-04",
    category: "acentos-toponimos",
    query: "región Metropolitana",
    expected: ["14309-04"],
    nota: "PENDIENTE: ningún proyecto con región Metropolitana en título encontrado en PROD (ILIKE vacío); placeholder — puede ser limitación de cobertura.",
  },
  {
    id: "at-05",
    category: "acentos-toponimos",
    query: "indígenas mapuche",
    expected: ["14309-04"],
    nota: "PENDIENTE: ningún proyecto con mapuche en título encontrado en PROD (ILIKE vacío); placeholder — puede ser limitación de cobertura.",
  },

  // ── similares (5 casos) ───────────────────────────────────────────────────────
  // match_proyectos SEM-05 — no regresionar el semántico en proyectos relacionados
  {
    id: "sm-01",
    category: "similares",
    query: "proyectos similares a protección de datos personales privacidad digital",
    expected: ["18060-07", "18118-07", "15766-03"],
    nota: "AJUSTE LIVE 86-03: proyectos de datos personales/privacidad en PROD",
  },
  {
    id: "sm-02",
    category: "similares",
    query: "proyectos similares a regulación teletrabajo trabajo remoto",
    expected: ["18376-13", "17986-13", "16349-13"],
    nota: "AJUSTE LIVE 86-03: proyectos de teletrabajo en PROD",
  },
  {
    id: "sm-03",
    category: "similares",
    query: "proyectos sobre pensiones jubilación adultos mayores",
    expected: ["17379-07", "17351-07", "15827-07"],
    nota: "AJUSTE LIVE 86-03: proyectos sobre pensiones/AFP en PROD",
  },
  {
    id: "sm-04",
    category: "similares",
    query: "iniciativas sobre cambio climático y medio ambiente",
    expected: ["17446-17", "16553-12", "15687-12"],
    nota: "AJUSTE LIVE 86-03: proyectos de cambio climático/medio ambiente en PROD",
  },
  {
    id: "sm-05",
    category: "similares",
    query: "leyes sobre violencia intrafamiliar y género",
    expected: ["18236-18", "18046-18", "16894-18"],
    nota: "AJUSTE LIVE 86-03: proyectos de violencia intrafamiliar en PROD",
  },
];
