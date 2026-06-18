/**
 * Formas de fila tal cual las devuelve Supabase para las tablas públicas de la
 * agenda (migración 0010). Columnas snake_case. Espejan el modelo común de
 * `@obs/agenda` sin acoplar el frontend al paquete del backend (mismo patrón
 * que `lib/types.ts` para tramitación en Fase 5).
 */

/** citacion — raíz de una citación de comisión (provenance inline). */
export interface CitacionRow {
  id: string;
  camara: "camara" | "senado";
  comision: string;
  fecha: string | null;
  horario: string | null;
  sala: string | null;
  materia: string | null;
  estado: string | null;
  semana_iso: string;
  origen: string;
  fecha_captura: string;
  enlace: string;
  /** Embeds de Supabase: citacion.select("*, citacion_invitado(*), citacion_punto(*)"). */
  citacion_invitado?: CitacionInvitadoRow[];
  citacion_punto?: CitacionPuntoRow[];
}

/** citacion_invitado — gestor de interés / tercero (NUNCA parlamentario). */
export interface CitacionInvitadoRow {
  citacion_id: string;
  nombre: string;
  calidad: string | null;
}

/** citacion_punto — punto del orden de la citación; boletín = cruce con la ficha. */
export interface CitacionPuntoRow {
  citacion_id: string;
  posicion: number;
  boletin: string | null;
  id_proyecto: number | null;
  materia: string | null;
  tipo_tramite: string | null;
}

/** sesion_sala — raíz de una sesión de sala con su tabla (provenance inline). */
export interface SesionSalaRow {
  id: string;
  camara: "camara" | "senado";
  fecha: string | null;
  numero: string | null;
  hora_inicio: string | null;
  tipo: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
  /** Embed de Supabase: sesion_sala.select("*, sesion_tabla_item(*)"). */
  sesion_tabla_item?: SesionTablaItemRow[];
}

/** sesion_tabla_item — ítem del orden del día de sala; boletín = cruce con la ficha. */
export interface SesionTablaItemRow {
  sesion_id: string;
  posicion: number;
  parte_sesion: string;
  materia: string | null;
  boletin: string | null;
  id_proyecto: number | null;
  alias: string | null;
  quorum: string | null;
}
