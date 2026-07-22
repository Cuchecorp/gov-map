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

/**
 * URL canónica del PDF de la tabla semanal de sala de la Cámara (CR-01).
 *
 * Es la MISMA URL que la ingesta registra como `degradaciones[].enlace` para la
 * fuente `camara-tabla-sala` (ver `CAMARA_TABLA_PDF_URL` en
 * `packages/agenda/src/connector-camara.ts`). Se mantiene como fuente única aquí
 * — espejando el patrón de tipos del frontend, que no acopla con `@obs/agenda` —
 * para que el enlace que ve el usuario sea exactamente el que el sistema validó/
 * registró (trazabilidad a la fuente). NO usar la página genérica de sesiones
 * (`trabajamos/sala_sesion.aspx`): no es la TABLASEMANAL.
 *
 * INVARIANTE: debe coincidir verbatim con `CAMARA_TABLA_PDF_URL` del conector.
 */
export const CAMARA_TABLA_PDF_URL =
  "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL";

/**
 * Fila PLANA serializada por el Server Component hacia el island de filtros
 * (`agenda-filtros.tsx`, contrato FichaRail). Cruza la frontera server→client, así
 * que TODOS los campos son primitivos JSON-serializables (fechas como ISO string,
 * NUNCA `Date`; el island reconstruye `Date` al renderizar la `CitacionCard`).
 *
 * DECISIÓN del orquestador (plan-checker): el island es el ÚNICO renderer del
 * listado por día post-hidratación y renderiza la MISMA `CitacionCard` que el SSR
 * (cero divergencia visual). Por eso el slice incluye TODO lo que la card muestra:
 * `estado`, `provenance` (trazabilidad — principio rector, NUNCA se pierde al
 * hidratar) e `invitados` (dato PÚBLICO ya renderizado SSR en la misma página;
 * serializarlo al island NO es exposición adicional).
 *
 * `dayKey` (día-calendario-Chile YYYY-MM-DD) y `dayLabel` los calcula el SERVER en
 * tz America/Santiago — el island NO recalcula tz (no duplica tzdb en cliente).
 *
 * Trust boundary (T-94-03): campos NO-PII (citacion/citacion_punto/citacion_invitado
 * son públicas por 0010). El island NUNCA importa `@/lib/supabase` ni usa `.rpc`/`.from`.
 */
export interface CitacionSliceRow {
  id: string;
  camara: "camara" | "senado";
  comision: string;
  /** Fecha ISO (o null). El island reconstruye `new Date(fecha)` para la card. */
  fecha: string | null;
  /** Día-calendario-Chile YYYY-MM-DD calculado por el server (tz Chile), o "sin-fecha". */
  dayKey: string;
  /** Rótulo del día ya formateado por el server en tz Chile ("Lunes 22 de julio"). */
  dayLabel: string;
  horario: string | null;
  sala: string | null;
  materia: string | null;
  estado: string | null;
  /** Boletines mencionados en los puntos de la citación (para el filtro de boletín). */
  boletines: string[];
  /** Primer boletín (cruce a la ficha), o null. */
  boletin: string | null;
  invitados: { nombre: string; calidad: string | null }[];
  provenance: {
    /** ISO string de captura, o null. El island reconstruye `Date`. */
    capturedAt: string | null;
    sourceName: string;
    sourceUrl: string | null;
  };
}
