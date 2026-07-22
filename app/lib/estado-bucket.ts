/**
 * estado-bucket.ts — normalizador texto-libre → bucket enum de estado de proyecto.
 *
 * Pura, sin I/O, sin JSX. Servidor/cliente-agnóstica; no importa React ni Supabase.
 * Reusable por /buscar (phase 88), ficha de proyecto (future), /agenda (future).
 *
 * FILT-03: normalizador de estado "definido, testeado, reusable" con fallback
 * honest `sin_dato` — nunca silencia un valor no mapeado a un bucket sustantivo.
 */

// ---------------------------------------------------------------------------
// CENSO DE VALORES DISTINTOS REALES (read-only PROD, 2026-07-22)
// SELECT DISTINCT estado FROM proyecto ORDER BY estado;
//   "Archivado"       → archivado
//   "En tramitación"  → en_tramitacion
//   "Publicado"       → publicado_ley  (la fuente llama "Publicado" a la ley promulgada)
//   "Rechazado"       → rechazado
//   "Retirado"        → retirado
//
// SELECT DISTINCT etapa FROM proyecto ORDER BY etapa;
//   "Archivado"                                          → archivado
//   "Comisión Mixta por rechazo de idea de legislar …"  → rechazado (finalización por rechazo)
//   "Comisión Mixta por rechazo de modificaciones …"    → rechazado
//   "En espera de insistencia (C.Diputados)"            → en_tramitacion
//   "Insistencia (Senado)"                              → en_tramitacion
//   "Primer trámite constitucional (C.Diputados)"       → en_tramitacion
//   "Primer trámite constitucional (Senado)"            → en_tramitacion
//   "Primer trámite constitucional insistido (Senado)"  → en_tramitacion
//   "Segundo trámite constitucional (C.Diputados)"      → en_tramitacion
//   "Segundo trámite constitucional (Senado)"           → en_tramitacion
//   "Tercer trámite constitucional (C.Diputados)"       → en_tramitacion
//   "Tercer trámite constitucional (Senado)"            → en_tramitacion
//   "Tramitación terminada"                             → publicado_ley (tramitación concluida = publicada)
//   "Trámite de aprobacion presidencial (C.Diputados)"  → en_tramitacion
//   "Trámite de aprobacion presidencial (Senado)"       → en_tramitacion
//   "Trámite en Tribunal Constitucional (C.Diputados)"  → en_tramitacion
//   "Trámite finalización en Cámara de Origen …"        → en_tramitacion
// ---------------------------------------------------------------------------

/**
 * Los 6 buckets LOCKED del normalizador de estado (UI-SPEC §Estado normalizer).
 * `sin_dato` es el fallback honest de cualquier texto no mapeado, vacío o null.
 */
export type EstadoBucket =
  | "en_tramitacion"
  | "publicado_ley"
  | "archivado"
  | "rechazado"
  | "retirado"
  | "sin_dato";

/**
 * Labels de presentación LOCKED (sin términos anti-insinuación).
 * Factuales, sin juicio, sin causalidad.
 */
export const ETIQUETA_BUCKET: Record<EstadoBucket, string> = {
  en_tramitacion: "En tramitación",
  publicado_ley: "Publicado / Ley",
  archivado: "Archivado",
  rechazado: "Rechazado",
  retirado: "Retirado",
  sin_dato: "Sin dato",
};

/**
 * Tabla de mapeo ordenada con first-match-wins.
 *
 * REGLA DE PRECEDENCIA (evita el bug latente de EtapaBadge):
 * Los buckets terminales-de-vida (`rechazado`, `archivado`, `retirado`,
 * `publicado_ley`) deben GANAR sobre el genérico `en_tramitacion` cuando el
 * texto compuesto contiene ambos tokens. Por eso van PRIMERO en la tabla.
 * `en_tramitacion` aparece DESPUÉS: solo captura textos que no matchearon ningún
 * terminal. Ejemplo:
 *   "En tramitación (segundo trámite) — ley en …"
 *   → match "rechaz" = NO, "archiv" = NO, "retir" = NO, "public" = NO
 *   → match "tramit" = SÍ → en_tramitacion  ✓ (no publicado_ley por el token "ley")
 *
 * La fuente PROD usa "Publicado" (no "publicado como ley"); también mapeamos
 * "promulg" y "ley" como señales adicionales de ley publicada, pero SOLO cuando
 * no hay un patrón terminal más específico (rechazado/archivado/retirado) que
 * también match. Dado que van ANTES en la tabla, ganan cuando aplican.
 */
interface BucketEntry {
  patrones: string[];
  bucket: EstadoBucket;
}

const TABLA_BUCKETS: BucketEntry[] = [
  // Terminales-de-vida — van PRIMERO para ganar sobre tokens genéricos compuestos
  { patrones: ["rechaz"], bucket: "rechazado" },
  { patrones: ["archiv"], bucket: "archivado" },
  { patrones: ["retir"], bucket: "retirado" },
  // Publicado / Ley — "public" captura "Publicado"; "promulg" y "tramitación terminada"
  // son señales adicionales de ley promulgada. "ley" es intencionalmente más específico
  // (aparece aquí, no en tramitación) porque "ley" SOLA sin contexto tramitación indica
  // publicación. El caso compuesto "tramit … ley" cae a en_tramitacion porque "tramit"
  // matchea ANTES en la próxima entrada (ver prueba de regla order-matters).
  { patrones: ["public", "promulg", "terminada"], bucket: "publicado_ley" },
  // Genérico tramitación — captura todo lo que queda en proceso
  { patrones: ["tramit", "trámit", "insistencia", "mixta", "constitucional", "presidencial", "tribunal", "espera"], bucket: "en_tramitacion" },
];

/**
 * Normaliza un texto libre de estado/etapa de proyecto al bucket enum canónico.
 *
 * @param value - Texto libre de `proyecto.estado` o `proyecto.etapa`; null aceptado.
 * @returns `EstadoBucket` determinista. Fallback honest = `"sin_dato"` para null,
 *   vacío o texto no mapeado. JAMÁS silencia a un bucket sustantivo.
 *
 * Advisory checker (#3): `estadoBucket("")` → `"sin_dato"` correcto. El call-site
 * (page.tsx / 88-03) debe hacer fallback truthy-trim: `estadoBucket(p.estado?.trim() || p.etapa?.trim() || null)`
 * para que una cadena de espacios caiga a sin_dato antes de llegar aquí.
 */
export function estadoBucket(value: string | null): EstadoBucket {
  const v = (value ?? "").toLowerCase();
  if (!v.trim()) return "sin_dato";

  for (const entry of TABLA_BUCKETS) {
    for (const patron of entry.patrones) {
      if (v.includes(patron)) return entry.bucket;
    }
  }

  // Texto no vacío pero sin match en ningún patrón conocido → sin_dato honesto.
  // NUNCA folding silencioso a un bucket sustantivo (T-88-01).
  return "sin_dato";
}

/**
 * Extrae el año de una fecha ISO de forma honesta.
 *
 * Disciplina: `^\d{4}$` sobre el año — cualquier año no parseable devuelve `null`
 * (nunca un año fabricado). Espeja la guarda de `mapearPatrimonio`
 * (`parlamentario-resumen-conteos.ts` líneas 167-190).
 *
 * @param fechaIso - Fecha ISO (p.ej. "2023-05-14T00:00:00Z", "2019-01-01"); null aceptado.
 * @returns Año numérico o `null` si no parseable.
 *
 * @throws Never — degradación honesta a null en vez de lanzar.
 *
 * PROHIBIDO en el call-site:
 * - NO derivar año de `fecha_captura` (es la fecha de CAPTURA del scraper, no del proyecto).
 * - NO derivar año del sufijo del boletín (código de materia, no un año legislativo).
 * (UI-SPEC §Year facet, LOCKED — T-88-03)
 */
export function deriveAnio(fechaIso: string | null): number | null {
  const s = (fechaIso ?? "").trim();
  if (!s) return null;

  const yyyy = s.slice(0, 4);
  if (!/^\d{4}$/.test(yyyy)) return null;

  const anio = Number(yyyy);
  if (!Number.isFinite(anio)) return null;

  return anio;
}
