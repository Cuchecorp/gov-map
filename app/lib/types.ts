/**
 * Formas de fila tal cual las devuelve Supabase para las tablas públicas de
 * tramitación (migración 0008). Columnas snake_case. Espejan el modelo común
 * de `@obs/tramitacion` sin acoplar el frontend al paquete del backend.
 */

// 5 opciones del roll-call (VOTE-03): las 4 nominales + `ausente` (asistencia).
// EXTENDIDO con "ausente" para la ficha del parlamentario (UI-SPEC §3.2/§10);
// el chip `ausente` se añade a SELECCION_STYLE en voto-row.tsx.
export type Seleccion = "si" | "no" | "abstencion" | "pareo" | "ausente";
export type EstadoVinculo = "confirmado" | "probable" | "no_confirmado";

export interface ProyectoRow {
  boletin: string;
  boletin_num: string;
  titulo: string;
  iniciativa: string | null;
  camara_origen: string | null;
  autores: string[] | null;
  materia: string | null;
  estado: string | null;
  etapa: string | null;
  subetapa: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export interface TramitacionEventoRow {
  boletin: string;
  fecha: string;
  camara: string;
  tipo: string;
  descripcion: string;
  enlace: string | null;
  origen: string;
  fecha_captura: string;
}

export interface VotoRow {
  votacion_id: string;
  mencion_nombre: string;
  parlamentario_id: string | null;
  seleccion: Seleccion;
  metodo: string | null;
  estado_vinculo: EstadoVinculo | null;
}

export interface VotacionRow {
  id: string;
  boletin: string;
  fecha: string;
  etapa: string | null;
  tipo: string | null;
  quorum: string | null;
  resultado: string | null;
  total_si: number;
  total_no: number;
  total_abstencion: number;
  total_pareo: number;
  camara: "diputados" | "senado";
  origen: string;
  fecha_captura: string;
  enlace: string;
  /** Embed de Supabase: votacion.select("*, voto(*)"). */
  voto?: VotoRow[];
}

/** Un cuerpo legal afectado (norma + artículos), tal como lo serializa la ficha. */
export interface CuerpoLegalRow {
  norma: string;
  articulos: string[];
}

/**
 * Fila de `proyecto_ficha` (migración 0011). 1:1 con proyecto por boletín.
 * `idea_matriz` null = degradación honesta first-class (texto íntegro no
 * disponible), NUNCA un resumen fabricado. `cuerpos_legales` es jsonb.
 */
export interface ProyectoFichaRow {
  boletin: string;
  idea_matriz: string | null;
  cuerpos_legales: CuerpoLegalRow[];
  texto_r2_path: string | null;
  estado: string;
  origen: string;
  fecha_captura: string;
}

/**
 * Fila del RPC `match_proyectos` (migración 0011). El RPC retorna SOLO
 * (boletin, similarity) — nunca columnas no públicas (T-07-03). `similarity`
 * se usa server-side para el orden; NUNCA se muestra al usuario (UI-SPEC §5).
 */
export interface MatchProyectoRow {
  boletin: string;
  similarity: number;
}

/** Etiqueta legible de la fuente para el ProvenanceBadge. */
export function sourceLabel(origen: string | null): string {
  const o = (origen ?? "").toLowerCase();
  if (o.includes("senado")) return "Senado";
  if (o.includes("camara") || o.includes("cámara")) return "Cámara";
  if (o.includes("bcn")) return "BCN";
  return "fuente desconocida";
}
