// @obs/dinero — modelo de los contratos del Estado (ChileCompra / Mercado Publico,
// api.mercadopublico.cl). Espeja la forma de @obs/probidad model.ts: cada fila lleva su
// procedencia inline NOT NULL + licencia, y el contenido literal (montos/organismo/fechas) se
// preserva VERBATIM como string, sin computo.
//
// DIFERENCIA LOAD-BEARING vs probidad:
//   - La licencia es "mencion de la fuente" (NO 'CC BY 4.0'). ChileCompra no publica bajo CC BY.
//   - El sujeto del contrato es la ENTIDAD PROVEEDORA (sub-maestra `Contratista` keyed por RUT
//     del proveedor), distinta de cualquier enlace al parlamentario. Un contrato a persona
//     juridica NUNCA se colapsa en una atribucion personal.
//   - El enlace contrato->parlamentario se fija SOLO por RUT-exacto (ver reconciliar-contrato.ts);
//     mientras el RUT interno de la maestra este vacio (IDENT-10) todo enlace es null.
//
// CLAVE DE VERSION: el contrato se keya por (`fuenteId` = codigo unico de la orden de compra,
// `fechaCorte`). Dos cortes distintos de la misma orden son DOS versiones; nunca se colapsan ni se
// sobreescribe una vieja (mismo patron de acumulacion que la declaracion de probidad).

import { z } from "zod";

// ── Procedencia inline (FND-08) ───────────────────────────────────────────────
const ProvenanceInline = {
  /** Id de la fuente, p.ej. "chilecompra". */
  origen: z.string(),
  /** ISO 8601 del momento de captura. */
  fecha_captura: z.string(),
  /** Enlace original consultado (la URL de la orden/consulta en la fuente). */
  enlace: z.string(),
  /** Atribucion que VIAJA con la fila: "mencion de la fuente" (NO CC BY 4.0). */
  licencia: z.string(),
} as const;

// ── Respuestas crudas de ChileCompra (compuerta de contrato — Zod) ─────────────
// La forma EXACTA esta derivada de docs oficiales (A2 del research); el probe LIVE del operador la
// confirma. Una forma inesperada (sin `Listado`/`Cantidad`) hace THROW aguas arriba (cuarentena),
// NUNCA 0 filas silenciosas. Los campos opcionales se modelan permisivos para no romper ante
// columnas extra de la fuente; lo OBLIGATORIO para reconocer la forma es lo que se valida duro.

/** Paso 1: respuesta de `BuscarProveedor` (RUT -> CodigoEmpresa). */
export const BuscarProveedorResponseSchema = z.object({
  CodigoEmpresa: z.union([z.string(), z.number()]),
  NombreEmpresa: z.string().nullable().optional(),
});
export type BuscarProveedorResponse = z.infer<typeof BuscarProveedorResponseSchema>;

/** Una orden de compra cruda dentro de `Listado`. Literal; campos opcionales/nullables. */
export const OrdenCompraRawSchema = z.object({
  Codigo: z.string(),
  Nombre: z.string().nullable().optional(),
  CodigoEstado: z.union([z.string(), z.number()]).nullable().optional(),
  FechaEnvio: z.string().nullable().optional(),
  Comprador: z
    .object({
      CodigoOrganismo: z.union([z.string(), z.number()]).nullable().optional(),
      NombreOrganismo: z.string().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
});
export type OrdenCompraRaw = z.infer<typeof OrdenCompraRawSchema>;

/** Paso 2: respuesta de `ordenesdecompra.json` (Cantidad + Listado). */
export const OrdenesResponseSchema = z.object({
  Cantidad: z.union([z.string(), z.number()]),
  Listado: z.array(OrdenCompraRawSchema),
});
export type OrdenesResponse = z.infer<typeof OrdenesResponseSchema>;

// ── Tipo de persona del proveedor (natural vs juridica) ────────────────────────
export type TipoPersona = "natural" | "juridica";

// ── Contratista (sub-maestra: la entidad proveedora, keyed por RUT) ─────────────
/**
 * Sub-maestra de contratistas (NUEVO vs probidad). El sujeto del contrato. Keyed por el RUT del
 * proveedor (el que se consulto, ya DV-validado). PII potencial → la tabla nace deny-by-default a
 * `anon`. La agregacion por contraparte vive en Phase 16.
 */
export interface Contratista {
  /** RUT del proveedor normalizado (clave de la sub-maestra). */
  rutProveedor: string;
  /** Nombre del proveedor crudo de la fuente, o null. */
  nombre: string | null;
  /** Codigo de empresa de ChileCompra (CodigoEmpresa), crudo. */
  codigoEmpresa: string | null;
  /** Persona natural (cuerpo < 50M) vs juridica (>= 50M); fallback por umbral. */
  tipoPersona: TipoPersona;
  /**
   * FK (plano) del proveedor → entidad_tercero (Δ3, ENT-03, columna nueva de 0036). Poblado SOLO
   * con un match confirmado contra la maestra de TERCEROS (lo resuelve `reconciliarContrato` y lo
   * aplana el writer desde el `EnlaceEntidadConfirmado` branded). null si no confirma. Storage plano.
   */
  entidadId?: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
  licencia: string;
}

export const ContratistaSchema = z.object({
  rutProveedor: z.string().min(1),
  nombre: z.string().nullable(),
  codigoEmpresa: z.string().nullable(),
  tipoPersona: z.enum(["natural", "juridica"]),
  entidadId: z.string().nullable().optional(),
  ...ProvenanceInline,
});

// ── Contrato (raiz: una orden de compra, una version) ──────────────────────────
/**
 * Una orden de compra del Estado asociada a un proveedor. Keyed por (`fuenteId` = codigo de la
 * orden, `fechaCorte`). Lleva su procedencia inline + el RUT del proveedor (el sujeto) + el tipo de
 * persona. El enlace al parlamentario lo decide la reconciliacion RUT-exacta; aqui solo viajan los
 * campos crudos VERBATIM (el `monto` como string, sin computo).
 */
export interface Contrato {
  /** Codigo unico de la orden de compra (clave de version). */
  fuenteId: string;
  /** Fecha de corte de la ingesta (ancla de version + frescura). */
  fechaCorte: string;
  /** Codigo de la orden (== fuenteId, expuesto literal para la ficha). */
  codigoOrden: string;
  /** RUT del proveedor consultado (ya DV-validado), keyea la sub-maestra. */
  rutProveedor: string;
  /** Nombre del proveedor crudo, o null. */
  proveedorNombre: string | null;
  /** Persona natural vs juridica (umbral 50M; fallback). */
  tipoPersona: TipoPersona;
  /** Organismo comprador crudo, o null. */
  organismo: string | null;
  /** Nombre/descripcion crudo de la orden de compra (texto libre de la fuente), o null. */
  nombreOrden: string | null;
  /**
   * Monto VERBATIM como string crudo, o null. CR-02: el listado `ordenesdecompra.json` NO
   * trae un campo monetario fijo garantizado -> hoy SIEMPRE null (nunca se etiqueta un
   * no-monto como "Monto"). Si una fuente futura expone un total numerico real, se mapea aqui.
   */
  monto: string | null;
  /** Fecha de la orden de compra cruda (date string de la fuente), o null. */
  fechaOc: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
  licencia: string;
}

export const ContratoSchema = z.object({
  fuenteId: z.string().min(1),
  fechaCorte: z.string().min(1),
  codigoOrden: z.string().min(1),
  rutProveedor: z.string().min(1),
  proveedorNombre: z.string().nullable(),
  tipoPersona: z.enum(["natural", "juridica"]),
  organismo: z.string().nullable(),
  nombreOrden: z.string().nullable(),
  monto: z.string().nullable(),
  fechaOc: z.string().nullable(),
  ...ProvenanceInline,
});

/** Origen canonico de la fuente. */
export const ORIGEN_DINERO = "chilecompra";
/** Licencia que viaja con cada fila (CONTEXT: "mencion de la fuente", NO CC BY 4.0). */
export const LICENCIA_DINERO = "mencion de la fuente";
