// @obs/agenda — modelo común de Agenda legislativa (TRAM-07 / TRAM-08).
//
// Cubre las citaciones de comisiones (Cámara HTML + Senado JSON) y la tabla semanal
// de sala (orden del día del Senado). La LLAVE DE CRUCE hacia la ficha de proyecto
// (Fase 5) es el número de boletín (`CitacionPunto.boletin` / `SesionTablaItem.boletin`
// → `proyecto.boletin`, formato `NNNNN-NN`).
//
// Cada entidad raíz (Citacion, SesionSala) lleva procedencia inline
// (`origen`/`fecha_captura`/`enlace`, TRAM-09) — mismo contrato de frescura que el
// resto del proyecto. La forma conceptual es la `Provenance` de @obs/core; aquí se
// persiste con los nombres de columna de la migración 0010.
//
// GUARDA DE IDENTIDAD (T-06-02): los invitados son gestores de interés / terceros,
// NO parlamentarios. `CitacionInvitado` NO tiene `parlamentario_id` ni reconciliación
// contra la maestra: nombre + calidad como texto crudo de la fuente.

import { z } from "zod";

// ── Enums del dominio ────────────────────────────────────────────────────────
export type Camara = "camara" | "senado";
/** Estado crudo de la citación: "Suspendida" / "Sin efecto" / null. */
export type CitacionEstado = string | null;

// ── Procedencia inline (TRAM-09) ─────────────────────────────────────────────
const ProvenanceInline = {
  /** Id de la fuente, p.ej. "camara-citaciones-semana" / "senado-commissions-citations". */
  origen: z.string(),
  /** ISO 8601 del momento de captura. */
  fecha_captura: z.string(),
  /** Enlace original consultado. */
  enlace: z.string(),
} as const;

// ── CitacionInvitado (tercero / gestor de interés — NO parlamentario) ─────────
export interface CitacionInvitado {
  /** Nombre crudo tal cual viene de la fuente. */
  nombre: string;
  /** Rol/calidad cruda (subsecretario, gremio, etc.) o null. Sin reconciliación. */
  calidad: string | null;
}

export const CitacionInvitadoSchema = z.object({
  nombre: z.string(),
  calidad: z.string().nullable(),
});

// ── CitacionPunto (orden de la citación; boletín = cruce con la ficha) ────────
export interface CitacionPunto {
  /** Boletín en formato "NNNNN-NN" → cruce con proyecto.boletin (Fase 5). Nullable. */
  boletin: string | null;
  /** Id de proyecto de la fuente (Senado PUNTOS_PROPUESTOS[].ID_PROYECTO) o null. */
  id_proyecto: number | null;
  materia: string | null;
  tipo_tramite: string | null;
}

export const CitacionPuntoSchema = z.object({
  boletin: z.string().nullable(),
  id_proyecto: z.number().int().nullable(),
  materia: z.string().nullable(),
  tipo_tramite: z.string().nullable(),
});

// ── Citacion (raíz: una comisión convocada un día) ────────────────────────────
export interface Citacion {
  /** Id sintético estable (clave natural), p.ej. "camara:2026-W25:<comision>:<fecha>". */
  id: string;
  camara: Camara;
  comision: string;
  /** Fecha de la citación en ISO 8601 (o texto fecha de la fuente normalizado). */
  fecha: string;
  /** Horario crudo de la fuente ("10:00 a 12:00"). */
  horario: string;
  sala: string | null;
  materia: string | null;
  /** Estado crudo: "Suspendida" / "Sin efecto" / null. */
  estado: CitacionEstado;
  /** Semana ISO "YYYY-Www" (clave de navegación de la /agenda). */
  semana_iso: string;
  invitados: CitacionInvitado[];
  puntos: CitacionPunto[];
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export const CitacionSchema = z.object({
  id: z.string(),
  camara: z.enum(["camara", "senado"]),
  comision: z.string(),
  fecha: z.string(),
  horario: z.string(),
  sala: z.string().nullable(),
  materia: z.string().nullable(),
  estado: z.string().nullable(),
  semana_iso: z.string(),
  invitados: z.array(CitacionInvitadoSchema),
  puntos: z.array(CitacionPuntoSchema),
  ...ProvenanceInline,
});

// ── SesionTablaItem (ítem del orden del día) ──────────────────────────────────
export interface SesionTablaItem {
  /** Posición del ítem en la tabla (entero). */
  posicion: number;
  /** "ORDEN DEL DÍA" | "TIEMPO DE VOTACIONES" | texto crudo de la fuente. */
  parte_sesion: string;
  materia: string | null;
  /** Boletín "NNNNN-NN" → cruce con proyecto.boletin (Fase 5). Nullable. */
  boletin: string | null;
  id_proyecto: number | null;
  alias: string | null;
  quorum: string | null;
}

export const SesionTablaItemSchema = z.object({
  posicion: z.number().int(),
  parte_sesion: z.string(),
  materia: z.string().nullable(),
  boletin: z.string().nullable(),
  id_proyecto: z.number().int().nullable(),
  alias: z.string().nullable(),
  quorum: z.string().nullable(),
});

// ── SesionSala (raíz: una sesión de sala con su tabla) ────────────────────────
export interface SesionSala {
  /** = ID_SESION del Senado (clave natural / PK). */
  id: string;
  camara: Camara;
  fecha: string;
  numero: string | null;
  hora_inicio: string | null;
  tipo: string | null;
  items: SesionTablaItem[];
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export const SesionSalaSchema = z.object({
  id: z.string(),
  camara: z.enum(["camara", "senado"]),
  fecha: z.string(),
  numero: z.string().nullable(),
  hora_inicio: z.string().nullable(),
  tipo: z.string().nullable(),
  items: z.array(SesionTablaItemSchema),
  ...ProvenanceInline,
});
