// @obs/bio — modelo común de la bio oficial del parlamentario (profesión, militancia) y de la
// membresía de comisiones. Espeja la forma de @obs/lobby: interface + zod schema por entidad,
// con procedencia inline NOT NULL en cada hecho (`origen`/`fechaCaptura`/`enlace`, FND-08).
//
// PATRÓN CLAVE — ALLOWLIST POR CONSTRUCCIÓN (minimización Ley 21.719, research Pattern 2):
//   El modelo tipado ES el allowlist. Los campos PII que el XML/HTML de la fuente SÍ trae
//   (research VERDICT 1: `FechaNacimiento`, `RUT`, `RUTDV`, `Sexo`, y cualquier dato de
//   terceros/familiares) NO SE DECLARAN aquí. No es un `null` defensivo: es una AUSENCIA
//   estructural — un objeto con `rut` no compila (TypeScript) y no valida (zod `.strict()`
//   muerde con un campo extra). Imposible persistir PII por construcción, no por disciplina.
//
// CLAVE NATURAL (onConflict) que la migración 0059 y el writer de 90-02 respetan:
//   - parlamentario_bio        → parlamentario_id
//   - parlamentario_militancia → parlamentario_id, partido_alias, desde
//   - comision                 → nombre, camara
//   - comision_membresia       → comision_id, parlamentario_id

import { z } from "zod";

// ── Procedencia inline (FND-08) ───────────────────────────────────────────────
// Cada hecho lleva fuente, fecha y enlace original. Copiado del patrón de @obs/lobby.
const ProvenanceInline = {
  /** Id de la fuente, p.ej. "camara-bio-diputados" / "bcn-senadores". */
  origen: z.string(),
  /** ISO 8601 del momento de captura. */
  fechaCaptura: z.string(),
  /** Enlace original consultado. */
  enlace: z.string(),
} as const;

// ── BioParlamentario (raíz: la bio 1:1 del parlamentario, SIN PII) ─────────────
/**
 * La bio oficial del parlamentario. Declara SOLO datos públicos no sensibles: `profesion`.
 * Los campos PII que la fuente sí trae quedan EXCLUIDOS del modelo (ver el header del
 * archivo) — no existen en el objeto que verá el writer (allowlist por construcción). El FK
 * `parlamentarioId` viene de un enlace confirmado/determinista (DIPID exacto o nombre único
 * fail-closed), nunca de un name-match libre.
 */
export interface BioParlamentario {
  /** FK a la maestra (parlamentario.id), poblado SOLO por enlace confirmado. */
  parlamentarioId: string;
  /** Profesión declarada por la fuente oficial, o null (no fabricar). */
  profesion: string | null;
  origen: string;
  fechaCaptura: string;
  enlace: string;
}

export const BioParlamentarioSchema = z
  .object({
    parlamentarioId: z.string().min(1),
    profesion: z.string().nullable(),
    ...ProvenanceInline,
  })
  .strict();

// ── Militancia (militancia partidaria vigente/histórica) ───────────────────────
/**
 * Una militancia partidaria del parlamentario. `esActual` marca la vigente (la de rango
 * `[desde, hasta-nil]` que cubre el corte, `FechaInicio` más reciente — research WR-04).
 * `partidoAlias` es la forma normalizada usada como parte de la clave natural.
 */
export interface Militancia {
  /** FK a la maestra, enlace confirmado. */
  parlamentarioId: string;
  /** Nombre del partido tal cual la fuente. */
  partido: string;
  /** Alias/forma normalizada del partido (parte de la clave natural). */
  partidoAlias: string;
  /** ISO date de inicio de la militancia. */
  desde: string;
  /** ISO date de término, o null si vigente (FechaTermino xsi:nil). */
  hasta: string | null;
  /** true si es la militancia vigente al corte. */
  esActual: boolean;
  origen: string;
  fechaCaptura: string;
  enlace: string;
}

export const MilitanciaSchema = z
  .object({
    parlamentarioId: z.string().min(1),
    partido: z.string(),
    partidoAlias: z.string(),
    desde: z.string(),
    hasta: z.string().nullable(),
    esActual: z.boolean(),
    ...ProvenanceInline,
  })
  .strict();

// ── Comision (catálogo de comisiones) ──────────────────────────────────────────
/**
 * Una comisión del Congreso. Clave natural `(nombre, camara)`. `tipo` es la clasificación
 * cruda de la fuente (permanente/especial/investigadora/...); '' si ausente.
 */
export interface Comision {
  /** Nombre crudo de la comisión. */
  nombre: string;
  /** Cámara a la que pertenece. */
  camara: "diputados" | "senadores";
  /** Tipo crudo de la comisión (permanente/especial/...); '' si ausente. */
  tipo: string;
  origen: string;
  fechaCaptura: string;
  enlace: string;
}

export const ComisionSchema = z
  .object({
    nombre: z.string().min(1),
    camara: z.enum(["diputados", "senadores"]),
    tipo: z.string(),
    ...ProvenanceInline,
  })
  .strict();

// ── ComisionMembresia (membresía: comisión × parlamentario) ────────────────────
/**
 * Una membresía de un parlamentario en una comisión. Clave natural
 * `(comisionId, parlamentarioId)`. `cargo` es el rol crudo (presidente/integrante/...),
 * o null. El `parlamentarioId` SIEMPRE viene de un enlace confirmado (fail-closed) — nunca
 * se inventa membresía por adivinanza de nombre.
 */
export interface ComisionMembresia {
  /** FK a comision.id. */
  comisionId: string;
  /** FK a la maestra, enlace confirmado. */
  parlamentarioId: string;
  /** Cargo crudo en la comisión (presidente/integrante/...), o null. */
  cargo: string | null;
  origen: string;
  fechaCaptura: string;
  enlace: string;
}

export const ComisionMembresiaSchema = z
  .object({
    comisionId: z.string().min(1),
    parlamentarioId: z.string().min(1),
    cargo: z.string().nullable(),
    ...ProvenanceInline,
  })
  .strict();
