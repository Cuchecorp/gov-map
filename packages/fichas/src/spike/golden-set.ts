/**
 * GOLDEN SET DE RETRIEVAL — CONGELADO al cierre del plan 86-01.
 * Cambios requieren decisión registrada, no ediciones silenciosas.
 *
 * Contiene ≥30 queries anotadas cubriendo las 6 categorías mandatadas:
 *   titulo-literal   — palabras textuales del título (el bug estrella: solo-semántico falla)
 *   parafrasis-nl    — paráfrasis natural (el semántico debe seguir ganando)
 *   normas           — cuerpos legales / normas citadas
 *   boletin          — 3 formatos: 14309-04 / 14309 / 14.309-04 (hit@1 obligatorio)
 *   acentos-toponimos — Ñuñoa / Aysén / medio ambiente
 *   similares        — proyectos similares (match_proyectos SEM-05, no regresionar)
 *
 * Los `expected[]` son boletines plausibles del dominio real (hipótesis).
 * Se validan LIVE contra PROD en el plan 86-03 (Task de derivación live).
 * El plan 86-03 puede ajustar boletines dentro de la disciplina "decisión registrada".
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

// CONGELADO al cierre del plan 86-01 — cambios requieren decisión registrada, no ediciones silenciosas
export const GOLDEN_SET: CasoRetrieval[] = [
  // ── titulo-literal (8 casos) ─────────────────────────────────────────────────
  // El bug estrella: búsqueda solo-semántica falla en títulos textuales
  {
    id: "tl-01",
    category: "titulo-literal",
    query: "proyecto de ley sobre protección de datos personales",
    expected: ["11144-07"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-02",
    category: "titulo-literal",
    query: "modifica el código del trabajo en materia de jornada laboral",
    expected: ["13261-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-03",
    category: "titulo-literal",
    query: "ley de migraciones y extranjería",
    expected: ["8970-06"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-04",
    category: "titulo-literal",
    query: "establecer el derecho a la desconexión digital",
    expected: ["12127-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-05",
    category: "titulo-literal",
    query: "regula el teletrabajo y trabajo a distancia",
    expected: ["12871-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-06",
    category: "titulo-literal",
    query: "modifica la ley general de urbanismo y construcciones",
    expected: ["9443-14"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-07",
    category: "titulo-literal",
    query: "sobre el sistema de garantías de los derechos de la niñez",
    expected: ["10315-18"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "tl-08",
    category: "titulo-literal",
    query: "crea el ministerio de ciencia tecnología conocimiento e innovación",
    expected: ["11101-19"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },

  // ── parafrasis-nl (5 casos) ───────────────────────────────────────────────────
  // El semántico debe seguir ganando (baseline SEM-05)
  {
    id: "nl-01",
    category: "parafrasis-nl",
    query: "legislación que protege la privacidad de las personas en internet",
    expected: ["11144-07"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nl-02",
    category: "parafrasis-nl",
    query: "normas para regular el trabajo desde casa",
    expected: ["12871-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nl-03",
    category: "parafrasis-nl",
    query: "derechos de los trabajadores a descanso digital fuera del horario",
    expected: ["12127-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nl-04",
    category: "parafrasis-nl",
    query: "regulación de personas que llegan al país desde el extranjero",
    expected: ["8970-06"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nl-05",
    category: "parafrasis-nl",
    query: "investigación científica y desarrollo tecnológico en Chile",
    expected: ["11101-19"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },

  // ── normas (5 casos) ──────────────────────────────────────────────────────────
  // Búsqueda por cuerpos legales citados
  {
    id: "nr-01",
    category: "normas",
    query: "modifica ley 19628",
    expected: ["11144-07"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nr-02",
    category: "normas",
    query: "reforma código del trabajo artículo 22",
    expected: ["13261-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nr-03",
    category: "normas",
    query: "modifica decreto ley 1094 extranjeros en Chile",
    expected: ["8970-06"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nr-04",
    category: "normas",
    query: "ley 20936 transmisión de energía eléctrica",
    expected: ["10140-08"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "nr-05",
    category: "normas",
    query: "modifica ley 18695 municipalidades",
    expected: ["9279-06"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },

  // ── boletin (4 casos) — hit@1 obligatorio, 3 formatos ────────────────────────
  // El detector hace short-circuit antes del RRF — lookup exacto
  {
    id: "bo-01",
    category: "boletin",
    query: "14309-04",
    expected: ["14309-04"],
    nota: "formato canónico sin punto — hit@1 obligatorio",
  },
  {
    id: "bo-02",
    category: "boletin",
    query: "14309",
    expected: ["14309"],
    nota: "formato sin sufijo — hit@1 obligatorio",
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
    query: "11144-07",
    expected: ["11144-07"],
    nota: "boletin canónico adicional — hit@1 obligatorio",
  },

  // ── acentos-toponimos (5 casos) ───────────────────────────────────────────────
  // Búsqueda con acentos, ñ y topónimos regionales
  {
    id: "at-01",
    category: "acentos-toponimos",
    query: "Ñuñoa",
    expected: ["14309-04"],
    nota: "topónimo con Ñ — hipótesis; validar contra PROD en plan 86-03",
  },
  {
    id: "at-02",
    category: "acentos-toponimos",
    query: "Aysén",
    expected: ["9810-15"],
    nota: "topónimo con tilde — hipótesis; validar contra PROD en plan 86-03",
  },
  {
    id: "at-03",
    category: "acentos-toponimos",
    query: "medio ambiente",
    expected: ["9780-12"],
    nota: "sin acentos explícitos pero importante para cobertura — hipótesis",
  },
  {
    id: "at-04",
    category: "acentos-toponimos",
    query: "región Metropolitana",
    expected: ["10512-06"],
    nota: "topónimo con tilde — hipótesis; validar contra PROD en plan 86-03",
  },
  {
    id: "at-05",
    category: "acentos-toponimos",
    query: "indígenas mapuche",
    expected: ["9784-01"],
    nota: "búsqueda con diacrítico implícito — hipótesis",
  },

  // ── similares (5 casos) ───────────────────────────────────────────────────────
  // match_proyectos SEM-05 — no regresionar el semántico en proyectos relacionados
  {
    id: "sm-01",
    category: "similares",
    query: "proyectos similares a protección de datos personales privacidad digital",
    expected: ["11144-07", "13155-07"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "sm-02",
    category: "similares",
    query: "proyectos similares a regulación teletrabajo trabajo remoto",
    expected: ["12871-13", "12127-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "sm-03",
    category: "similares",
    query: "proyectos sobre pensiones jubilación adultos mayores",
    expected: ["12212-13"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "sm-04",
    category: "similares",
    query: "iniciativas sobre cambio climático y medio ambiente",
    expected: ["9780-12", "13312-12"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
  {
    id: "sm-05",
    category: "similares",
    query: "leyes sobre violencia intrafamiliar y género",
    expected: ["14540-07"],
    nota: "hipótesis — validar contra PROD en plan 86-03",
  },
];
