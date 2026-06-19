// @obs/probidad — modelo de las declaraciones de patrimonio e intereses de InfoProbidad
// (CPLT/Contraloría, datos.cplt.cl, CC BY 4.0). Espeja la forma de @obs/lobby: la entidad raíz
// (`Declaracion`) lleva sus bienes + familiares ANIDADOS; el writer (writer-supabase) los aplana
// a las sub-tablas de la migración 0022.
//
// CLAVE DE VERSIÓN (Pitfall 1, INT-04): la declaración se keya por (`fuenteId`, `fechaPresentacion`)
// donde `fuenteId` = la URI del nodo `Declaracion` (única — OQ1) y `fechaPresentacion` = la fecha
// de `ip:fechaDeclaracion`. Dos declaraciones del MISMO declarante con distinta fecha son DOS
// versiones; NUNCA se colapsan ni se sobreescribe una vieja.
//
// GUARDA DE IDENTIDAD:
//   - El declarante (el oficial) cruza contra la maestra vía `correrPipeline` (name-only — la
//     fuente NO tiene RUT); SOLO un match determinista puebla `parlamentarioId` (Phase 9, IDENT-12).
//     `parlamentarioId` viaja como `EnlaceConfirmado | null` (branded) en la forma para-escribir;
//     el storage es plano (`parlamentario_id: string | null`).
//   - Los familiares son TERCEROS: filas crudas `{relacion, nombre}`, SIN reconciliación, NUNCA
//     enlazados a una persona del padrón (deny-by-default). NO existe campo RUT de persona natural.
//
// CONTENIDO LITERAL (sin LLM): cada bien guarda los predicados de OQ2 VERBATIM como string; ningún
// monto se computa/normaliza-con-juicio. Cada entidad lleva procedencia inline NOT NULL + licencia.

import { z } from "zod";

// ── Procedencia inline (FND-08) ───────────────────────────────────────────────
const ProvenanceInline = {
  /** Id de la fuente, p.ej. "infoprobidad-sparql". */
  origen: z.string(),
  /** ISO 8601 del momento de captura. */
  fecha_captura: z.string(),
  /** Enlace original consultado (la URL/URI de la declaración en la fuente). */
  enlace: z.string(),
  /** Atribución CC BY 4.0 que VIAJA con la fila (visible incluso en vistas derivadas). */
  licencia: z.string(),
} as const;

// ── Sub-entidades de bienes (LITERALES, predicados pineados de OQ2) ─────────────
// Cada propiedad es opcional + nullable (la fuente puede omitir cualquiera). Todo se guarda como
// string crudo (`z.string()`): un monto/avalúo/año se preserva VERBATIM como lo da la fuente.

/** BienInmueble (OQ2): ubicadoEn, rolAvaluo, numInscripcion, fojasInmueble, anioInmueble, esSuDomicilio. */
export const BienInmuebleSchema = z.object({
  ubicadoEn: z.string().nullable(),
  rolAvaluo: z.string().nullable(),
  numInscripcion: z.string().nullable(),
  fojas: z.string().nullable(),
  anio: z.string().nullable(),
  esSuDomicilio: z.string().nullable(),
});
export type BienInmueble = z.infer<typeof BienInmuebleSchema>;

/** BienMueble (OQ2). */
export const BienMuebleSchema = z.object({
  nombre: z.string().nullable(),
  descripcion: z.string().nullable(),
  modelo: z.string().nullable(),
  anioFabricacion: z.string().nullable(),
  matricula: z.string().nullable(),
  numeroInscripcion: z.string().nullable(),
  anioInscripcion: z.string().nullable(),
  tonelaje: z.string().nullable(),
});
export type BienMueble = z.infer<typeof BienMuebleSchema>;

/** Actividad (OQ2): objeto, vinculo, remunerado, haceDoceMeses. */
export const ActividadSchema = z.object({
  objeto: z.string().nullable(),
  vinculo: z.string().nullable(),
  remunerado: z.string().nullable(),
  haceDoceMeses: z.string().nullable(),
});
export type Actividad = z.infer<typeof ActividadSchema>;

/** Pasivo (OQ2): tipoObligacion, acreedor, montoDeuda (VERBATIM). */
export const PasivoSchema = z.object({
  tipoObligacion: z.string().nullable(),
  acreedor: z.string().nullable(),
  montoDeuda: z.string().nullable(),
});
export type Pasivo = z.infer<typeof PasivoSchema>;

/**
 * AccionDerecho (OQ2). `rutJuridica` = RUT de la PERSONA JURÍDICA (empresa) declarada — contenido
 * del bien, NO un RUT de persona natural (la fuente no expone RUT de persona natural — research).
 */
export const AccionDerechoSchema = z.object({
  rutJuridica: z.string().nullable(),
  cantidadAcciones: z.string().nullable(),
  fechaAdquisicion: z.string().nullable(),
  esControlador: z.string().nullable(),
  gravamenes: z.string().nullable(),
});
export type AccionDerecho = z.infer<typeof AccionDerechoSchema>;

/** Valores (OQ2). */
export const ValorSchema = z.object({
  entidadEmisora: z.string().nullable(),
  tipoAccionDerecho: z.string().nullable(),
  cantidadRepresenta: z.string().nullable(),
  valorPlaza: z.string().nullable(),
  paisQueEmite: z.string().nullable(),
  fechaAdquisicion: z.string().nullable(),
  tipoGravamen: z.string().nullable(),
});
export type Valor = z.infer<typeof ValorSchema>;

/**
 * Contenedor de los bienes de UNA versión de declaración, agrupados por sub-clase. Cada lista
 * es literal; vacía si la fuente no declara ese tipo (NUNCA se fabrica).
 */
export const BienesSchema = z.object({
  inmuebles: z.array(BienInmuebleSchema),
  muebles: z.array(BienMuebleSchema),
  actividades: z.array(ActividadSchema),
  pasivos: z.array(PasivoSchema),
  accionesDerechos: z.array(AccionDerechoSchema),
  valores: z.array(ValorSchema),
});
export type Bienes = z.infer<typeof BienesSchema>;

// ── DeclaracionFamiliar (TERCERO: texto crudo, NUNCA enlazado a una persona) ────
/** Familiar declarado (cónyuge, hijo, …): tercero PII, deny-by-default. SIN campo RUT. */
export interface DeclaracionFamiliar {
  /** Relación cruda (`esConyugeDe` / `esHijoDe` / …), o null. */
  relacion: string | null;
  /** Nombre crudo del tercero, o null. */
  nombre: string | null;
}

export const DeclaracionFamiliarSchema = z.object({
  relacion: z.string().nullable(),
  nombre: z.string().nullable(),
});

// ── Declaracion (raíz: una versión de declaración) ─────────────────────────────
/**
 * Una versión de declaración de patrimonio/intereses. Keyed por (`fuenteId`, `fechaPresentacion`).
 * Lleva sus bienes + familiares ANIDADOS (el writer los aplana). El `declaranteNombre` es el nombre
 * crudo del declarante (con `\t`+dobles-espacios que `normalizarNombre` limpiará); la reconciliación
 * posterior decide si se puebla el FK.
 */
export interface Declaracion {
  /** URI del nodo `Declaracion` (clave de versión, única — OQ1). */
  fuenteId: string;
  /** Fecha de presentación ISO (date) — `ip:fechaDeclaracion`, el ancla de versión + frescura. */
  fechaPresentacion: string;
  /** Tipo (rdfs:label resuelto, o URI cruda si falta — OQ3; NUNCA fabricado). */
  tipo: string | null;
  /** Cargo (raw, publicado; URI cruda si no hay label). */
  cargo: string | null;
  /** Organismo/institución (raw, publicado; URI cruda si no hay label). */
  organismo: string | null;
  /** Nombre crudo del declarante tal cual la fuente (sin normalizar). */
  declaranteNombre: string;
  /** Bienes literales de esta versión (agrupados por sub-clase). */
  bienes: Bienes;
  /** Familiares crudos (terceros, deny-by-default). */
  familiares: DeclaracionFamiliar[];
  origen: string;
  fecha_captura: string;
  enlace: string;
  licencia: string;
}

export const DeclaracionSchema = z.object({
  fuenteId: z.string().min(1),
  // Fecha de presentación: ISO date (YYYY-MM-DD). Una declaración SIN fecha no es una versión
  // válida → se descarta (drift), nunca se fabrica.
  fechaPresentacion: z.string().min(1),
  tipo: z.string().nullable(),
  cargo: z.string().nullable(),
  organismo: z.string().nullable(),
  declaranteNombre: z.string().min(1),
  bienes: BienesSchema,
  familiares: z.array(DeclaracionFamiliarSchema),
  ...ProvenanceInline,
});

/** Origen canónico de la fuente. */
export const ORIGEN_PROBIDAD = "infoprobidad-sparql";
/** Licencia que viaja con cada fila (CONTEXT: visible incluso en vistas derivadas). */
export const LICENCIA_PROBIDAD = "CC BY 4.0";
