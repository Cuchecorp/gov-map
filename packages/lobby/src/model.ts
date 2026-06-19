// @obs/lobby — modelo común de las audiencias de la Ley del Lobby (Ley 20.730) y su
// sub-maestra de contrapartes (INT-01/INT-02). Espeja la forma de @obs/agenda: la entidad
// raíz (`LobbyAudiencia`) lleva sus contrapartes ANIDADAS; el writer las aplana a filas de
// `lobby_contraparte` (migración 0021).
//
// CLAVE NATURAL (Pitfall 1): la audiencia se keya por el cell `Identificador` de leylobby
// (`{INST}AW{N}`, p.ej. `AA001AW1639516`), NUNCA por el número de URL del listado.
//
// GUARDA DE IDENTIDAD:
//   - El sujeto pasivo (el funcionario, `rol === "Sujeto Pasivo"`) cruza contra la maestra vía
//     `correrPipeline`; SOLO un match determinista puebla `parlamentario_id` (Phase 9, IDENT-12).
//     `parlamentarioId` viaja como `EnlaceConfirmado | null` (branded) en la forma para-escribir;
//     el storage es plano (`parlamentario_id: string | null`).
//   - Las contrapartes (lobistas/gestores de interés) son TERCEROS: texto crudo, SIN reconciliación,
//     `contraparteId` SIEMPRE null (Pitfall 4 — un tercero nunca se enlaza a una persona).
//
// Cada entidad lleva procedencia inline NOT NULL (`origen`/`fecha_captura`/`enlace`, FND-08).

import { z } from "zod";

// ── Procedencia inline (FND-08) ───────────────────────────────────────────────
const ProvenanceInline = {
  /** Id de la fuente, p.ej. "leylobby-audiencias". */
  origen: z.string(),
  /** ISO 8601 del momento de captura. */
  fecha_captura: z.string(),
  /** Enlace original consultado (la URL del listado de audiencias). */
  enlace: z.string(),
} as const;

// ── Asistente crudo (tal cual viene del parser, antes de reconciliar) ──────────
/**
 * Un asistente de la audiencia tal cual lo emite el parser: `rol` + `nombre` crudos, más el
 * `representado` (la firma/entidad que representa, si la fuente la trae). El `rol === "Sujeto
 * Pasivo"` marca al funcionario; cualquier otro rol es una contraparte. Column-agnostic respecto
 * a la taxonomía exacta del rol (Assumption A2).
 */
export interface LobbyAsistente {
  /** Rol crudo de la fuente: "Sujeto Pasivo" (funcionario) | "Gestor de intereses" | ... */
  rol: string;
  /** Nombre crudo tal cual lo publica la fuente. */
  nombre: string;
  /** Entidad/firma representada (raw), o null. */
  representado: string | null;
}

export const LobbyAsistenteSchema = z.object({
  rol: z.string(),
  nombre: z.string(),
  representado: z.string().nullable(),
});

// ── LobbyContraparte (sub-maestra: tercero, texto crudo, NUNCA enlazado a una persona) ──
/** Fila plana de la sub-maestra de contrapartes (migración 0021 `lobby_contraparte`). */
export interface LobbyContraparte {
  /** FK a la audiencia (clave natural `Identificador`). */
  identificador: string;
  /** Nombre crudo de la contraparte (tercero). */
  nombre: string;
  /** Rol crudo (lobbista/gestor/asesor/...); '' si ausente. */
  rol: string;
  /** Entidad/firma representada (raw), o null. */
  representadoText: string | null;
  /** Enlace a una identidad SOLO por id exacto de un registro autoritativo. En P11 SIEMPRE null. */
  contraparteId: string | null;
}

export const LobbyContraparteSchema = z.object({
  identificador: z.string(),
  nombre: z.string(),
  rol: z.string(),
  representadoText: z.string().nullable(),
  contraparteId: z.string().nullable(),
});

// ── LobbyAudiencia (raíz: una reunión de lobby) ────────────────────────────────
/**
 * Una audiencia de la Ley del Lobby. Keyed por `identificador` (clave natural estable). Lleva
 * los asistentes ANIDADOS (el writer aplana al sujeto pasivo en la raíz + las contrapartes a
 * `lobby_contraparte`). El `mencionSujeto` es el nombre crudo del sujeto pasivo (el funcionario);
 * la reconciliación posterior decide si se puebla el FK.
 */
export interface LobbyAudiencia {
  /** Clave natural estable de leylobby (`{INST}AW{N}`), NUNCA el número de URL del listado. */
  identificador: string;
  /** Código de la institución en leylobby (`AA001`, o el código del congreso). */
  institucionCodigo: string;
  /** Fecha parseada a ISO 8601 (o null si no parsea — `fechaRaw` se preserva). */
  fecha: string | null;
  /** String de fecha tal cual la fuente (`2024-06-24 12:30:00-04`). Nunca se fabrica. */
  fechaRaw: string | null;
  /** Materia/asunto crudo de la audiencia. */
  materia: string | null;
  /** Enlace "Ver Detalle" al acta (raw; NO se scrapea en P11). */
  enlaceDetalle: string | null;
  /** Asistentes crudos: el sujeto pasivo + las contrapartes (el writer/reconciliación los separa). */
  asistentes: LobbyAsistente[];
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export const LobbyAudienciaSchema = z.object({
  identificador: z.string().min(1),
  institucionCodigo: z.string(),
  fecha: z.string().nullable(),
  fechaRaw: z.string().nullable(),
  materia: z.string().nullable(),
  enlaceDetalle: z.string().nullable(),
  asistentes: z.array(LobbyAsistenteSchema),
  ...ProvenanceInline,
});

// ── Rol del sujeto pasivo (el funcionario) ─────────────────────────────────────
/** Rol que identifica al funcionario (el que cruza contra la maestra). */
export const ROL_SUJETO_PASIVO = "Sujeto Pasivo";
