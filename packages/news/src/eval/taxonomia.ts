// taxonomia.ts — SSoT ejecutable de la taxonomía de clasificación de noticias (D-133-A2).
//
// LA PRECEDENCIA VIVE EN EL ORDEN DEL ARRAY, no en un campo numérico separado. Gana la
// primera clase de `TAXONOMIA` que aplique al texto (titular + bajada). Reordenar este array
// ES cambiar la taxonomía — y por tanto el hash de la proyección canónica congelada en el
// plan 03 (`packages/news/src/eval/taxonomia.json`). `ambiguo` va último y es un ESCAPE, no
// un nivel de precedencia: significa que titular+bajada no alcanzan para decidir entre dos
// clases, jamás "no sé".
//
// Regla de decidibilidad textual (D-133-A2.1, LOCKED): una clase de esta taxonomía es legal
// si y solo si se decide leyendo únicamente titular + bajada. El clasificador de la fase 135
// por diseño no consulta el corpus — el cruce con boletines y personas es del resolver
// determinista de la Phase 134. La sexta clase ejecutiva propuesta originalmente murió por
// esta regla (indecidible: "aún no ha ingresado al Congreso" es un estado del corpus) y su
// contenido se fusionó en `politica_no_legislativa`.
//
// La taxonomía NO nombra sujetos (D-133-H): ningún nombre propio de persona, partido,
// ministerio ni número de boletín en ningún string de este archivo. El vínculo a boletines y
// parlamentarios es de la Phase 134, bajo su propio SC1 LOCKED (ROADMAP.md:232).

/** Las 6 etiquetas posibles, en el orden de precedencia LOCKED (D-133-A2.2). */
export type Etiqueta =
  | "tramitacion_legislativa"
  | "actividad_parlamentaria"
  | "ley_vigente"
  | "politica_no_legislativa"
  | "no_legislativa"
  | "ambiguo";

/** Ficha a la que puede colgar una noticia con esta etiqueta, o ninguna. */
export type EnrutaA = "proyecto" | "persona" | "ninguna";

/** Una clase de la taxonomía: definición operativa, marca decisoria, frontera y enrutamiento. */
export interface ClaseTaxonomia {
  readonly etiqueta: Etiqueta;
  readonly definicion: string;
  readonly marca_decisoria: string;
  readonly frontera: string;
  readonly enruta_a: EnrutaA;
}

/**
 * Congelación profunda (`Object.freeze` a secas es shallow, D-133-A2 lo exige explícito):
 * cada objeto del array se congela y luego el array se congela. En strict mode (ESM) mutar
 * una propiedad de un objeto congelado LANZA `TypeError` — es lo que el test de mutación
 * demuestra en runtime, no solo en tipos (una anotación de tipo puramente compile-time
 * no basta: no impide la mutación en runtime, que es exactamente lo que exige el comportamiento).
 */
function congelarProfundo<T extends object>(arr: readonly T[]): readonly T[] {
  for (const item of arr) Object.freeze(item);
  return Object.freeze(arr);
}

/**
 * La taxonomía congelada: 5 clases sustantivas + `ambiguo` (D-133-A2.2), firmada por el
 * operador el 2026-08-06. Precedencia `1 > 2 > 3 > 4 > 5`; `ambiguo` es escape.
 */
export const TAXONOMIA: readonly ClaseTaxonomia[] = congelarProfundo([
  {
    etiqueta: "tramitacion_legislativa",
    definicion:
      "El texto informa un hecho ocurrido en la tramitación de una iniciativa en el Congreso.",
    marca_decisoria:
      "Menciona explícitamente un acto de tramitación: ingreso, comisión, sala, votación, " +
      "indicación, urgencia, veto, despacho, requerimiento al Tribunal Constitucional, o el " +
      "número de boletín.",
    frontera:
      "Si el texto no nombra un acto de tramitación, no cae aquí — aunque el lector sepa que " +
      "el proyecto existe.",
    enruta_a: "proyecto",
  },
  {
    etiqueta: "actividad_parlamentaria",
    definicion:
      "El texto trata la actuación pública de un parlamentario en ejercicio, nombrado en el " +
      "texto.",
    marca_decisoria:
      "Nombra a la persona y un acto suyo: declaración, comisión investigadora, lobby o " +
      "audiencia, patrimonio e intereses, ética y sanciones, asistencia.",
    frontera:
      "Un parlamentario citado de pasada como fuente sobre otro tema cae en la clase del tema. " +
      "Candidatos que no ejercen caen en politica_no_legislativa. Si además hay acto de " +
      "tramitación, gana tramitacion_legislativa.",
    enruta_a: "persona",
  },
  {
    etiqueta: "ley_vigente",
    definicion:
      "El texto trata una norma ya promulgada o publicada, su reglamento, su entrada en " +
      "vigencia o sus efectos.",
    marca_decisoria:
      'Marca textual: "ley N.º…", "entra en vigencia", "publicada en el Diario Oficial", ' +
      '"el reglamento de la ley", "desde hoy rige".',
    frontera:
      "Si el mismo texto nombra un acto de tramitación, gana tramitacion_legislativa — y eso " +
      "también es textual.",
    enruta_a: "proyecto",
  },
  {
    etiqueta: "politica_no_legislativa",
    definicion:
      "Política contingente sin acto de tramitación ni actuación parlamentaria: elecciones, " +
      "partidos, gabinete, encuestas, municipios, tribunales no constitucionales, y los " +
      "anuncios o compromisos del Ejecutivo que el texto no vincula a un acto de tramitación.",
    marca_decisoria: "Contenido político contingente sin marca textual de acto de tramitación.",
    frontera:
      "Si el texto informa el ingreso o cualquier otro acto de tramitación, gana " +
      "tramitacion_legislativa.",
    enruta_a: "ninguna",
  },
  {
    etiqueta: "no_legislativa",
    definicion:
      "Todo lo demás: farándula, deportes, policial, internacional, economía, servicio. Se " +
      "espera que sea la mayoría.",
    marca_decisoria: "Ausencia de cualquier marca de las clases anteriores.",
    frontera: "Cualquier marca de una clase anterior saca el texto de aquí.",
    enruta_a: "ninguna",
  },
  {
    etiqueta: "ambiguo",
    definicion:
      "Titular y bajada no alcanzan para decidir entre dos clases. No es 'no sé': es 'la " +
      "evidencia disponible no basta'.",
    marca_decisoria: "Dos o más clases compiten sin que el texto resuelva cuál gana.",
    frontera: "Si una lectura razonable resuelve entre las clases en competencia, no es ambiguo.",
    enruta_a: "ninguna",
  },
]);

/** `ETIQUETAS` se deriva de `TAXONOMIA`, jamás se re-tipea a mano. */
export const ETIQUETAS: readonly Etiqueta[] = Object.freeze(TAXONOMIA.map((c) => c.etiqueta));
