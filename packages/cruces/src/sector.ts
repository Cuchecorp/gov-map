/**
 * @obs/cruces — TAXONOMÍA DE SECTORES (fuente ÚNICA en TS).
 *
 * Espeja BYTE-A-BYTE el seed de `supabase/migrations/0038_sector.sql` (operador LOCKED,
 * Task 1 de Plan 36-01, Decisión A1). Los 13 macro-sectores anclados en las comisiones
 * permanentes del Congreso, legibles para ciudadano/prensa.
 *
 * Invariantes (D-04/D-05):
 *   - `codigo` es CLAVE ESTABLE: JAMÁS se renombra ni borra. Coincide verbatim con el FK
 *     `references sector(codigo)` de 0038 y con el catálogo de la DB.
 *   - CERO catch-all 'otros' (D-05): la ausencia de sector se modela con `null` en la fila
 *     clasificada (`ClasificacionSectorSchema.sector_codigo === null`), nunca con una
 *     fila-paraguas que invente cobertura.
 *
 * `SECTOR_CODIGOS` (tupla `as const`) alimenta `z.enum(...)` en model.ts → el zod gate
 * rechaza cualquier código fuera de esta lista (salida del LLM untrusted, T-36-08).
 */

/**
 * Catálogo de la taxonomía: `{ codigo, etiqueta }` por sector. Las etiquetas son los
 * rótulos legibles del seed de 0038; los códigos son las claves estables (D-04).
 */
export const SECTOR_CATALOGO = [
  { codigo: "salud", etiqueta: "Salud y farmacéutica" },
  { codigo: "educacion", etiqueta: "Educación" },
  { codigo: "mineria_energia", etiqueta: "Minería y energía" },
  { codigo: "medio_ambiente", etiqueta: "Medio ambiente y recursos hídricos" },
  { codigo: "trabajo_prevision", etiqueta: "Trabajo y previsión social" },
  { codigo: "vivienda_urbanismo", etiqueta: "Vivienda, urbanismo y obras públicas" },
  { codigo: "transporte", etiqueta: "Transporte y telecomunicaciones" },
  { codigo: "agricultura_pesca", etiqueta: "Agricultura, pesca y alimentos" },
  { codigo: "banca_finanzas", etiqueta: "Banca, finanzas y seguros" },
  { codigo: "comercio_industria", etiqueta: "Comercio, industria y retail" },
  { codigo: "tecnologia", etiqueta: "Tecnología y economía digital" },
  { codigo: "seguridad_justicia", etiqueta: "Seguridad, justicia y defensa" },
  { codigo: "gremios_trabajadores", etiqueta: "Gremios, sindicatos y asociaciones" },
] as const;

/**
 * Tupla `as const` SOLO de los códigos (para `z.enum`). Derivada del catálogo para que el
 * orden y el contenido nunca puedan divergir de `SECTOR_CATALOGO`. SIN 'otros' (D-05).
 */
export const SECTOR_CODIGOS = [
  "salud",
  "educacion",
  "mineria_energia",
  "medio_ambiente",
  "trabajo_prevision",
  "vivienda_urbanismo",
  "transporte",
  "agricultura_pesca",
  "banca_finanzas",
  "comercio_industria",
  "tecnologia",
  "seguridad_justicia",
  "gremios_trabajadores",
] as const;

/** Un código de sector válido (clave estable). */
export type SectorCodigo = (typeof SECTOR_CODIGOS)[number];
