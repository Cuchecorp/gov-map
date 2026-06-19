// parse-chilecompra — parser zod del JSON de ChileCompra -> `Contrato[]` VERBATIM.
//
// LITERAL, SIN modelo de lenguaje: cada campo se copia tal cual (el `monto` como string crudo, sin
// computo). Una respuesta cuya forma NO valida con `OrdenesResponseSchema` (p.ej. sin
// `Listado`/`Cantidad`) hace THROW -> `ingest-run` lo trata como drift estructural y CUARENTENA la
// tarea (0 filas), NUNCA emite 0 filas silenciosas que se lean como "sin contratos" (Pitfall 6).
//
// La clave de version del contrato es (`fuenteId` = codigo de la orden, `fechaCorte`).

import { normRut } from "@obs/identity";
import {
  OrdenesResponseSchema,
  ORIGEN_DINERO,
  LICENCIA_DINERO,
  type Contrato,
  type TipoPersona,
} from "./model";

const orNull = (v: string | undefined | null): string | null =>
  v != null && v !== "" ? v : null;

/**
 * Umbral persona natural vs juridica por el cuerpo del RUT (sin DV).
 * FALLBACK (MEDIUM, convencion SII — Assumption A1 del research): cuerpo >= 50.000.000 -> juridica.
 * Preferir un campo `tipoProveedor` de la fuente si estuviera presente; el umbral es el respaldo.
 */
export function tipoPersona(rut: string): TipoPersona {
  const norm = normRut(rut);
  const cuerpo = Number(norm.slice(0, -1));
  if (Number.isNaN(cuerpo)) return "natural";
  return cuerpo >= 50_000_000 ? "juridica" : "natural";
}

export interface ParseContratosOpts {
  /** RUT del proveedor consultado (ya DV-validado); keyea la sub-maestra y etiqueta tipo persona. */
  rutProveedor: string;
  /** Nombre del proveedor (de BuscarProveedor), fallback al nombre de la orden si falta. */
  proveedorNombre?: string | null;
  /** Fecha de corte de la ingesta (ancla de version). Default: hoy (ISO date). */
  fechaCorte?: string;
  /** Enlace base de la fuente (procedencia); si falta, la URL de la consulta. */
  enlace?: string;
  /** Momento de captura ISO (procedencia determinista en tests). */
  fechaCaptura?: string;
}

/**
 * Parsea una respuesta `ordenesdecompra.json` de ChileCompra -> `Contrato[]` VERBATIM. Valida la
 * forma con Zod; una forma inesperada LANZA (cuarentena aguas arriba). NUNCA fabrica.
 */
export function parseContratos(json: unknown, opts: ParseContratosOpts): Contrato[] {
  const fechaCorte = opts.fechaCorte ?? new Date().toISOString().slice(0, 10);
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const enlace = opts.enlace ?? "";
  const rutProveedor = opts.rutProveedor;
  const tp = tipoPersona(rutProveedor);

  // Compuerta de forma: una respuesta sin `Listado`/`Cantidad` (drift) LANZA -> cuarentena.
  const parsed = OrdenesResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `forma de respuesta ChileCompra inesperada (drift estructural): ${parsed.error.issues
        .map((i) => i.path.join(".") || "<root>")
        .join(", ")}`,
    );
  }

  const out: Contrato[] = [];
  for (const orden of parsed.data.Listado) {
    const codigo = orden.Codigo;
    if (!codigo || codigo === "") continue; // sin codigo no es una orden valida (no fabrica)
    const organismo =
      orNull(orden.Comprador?.NombreOrganismo) ??
      (orden.Comprador?.CodigoOrganismo != null ? String(orden.Comprador.CodigoOrganismo) : null);
    out.push({
      fuenteId: codigo,
      fechaCorte,
      codigoOrden: codigo,
      rutProveedor,
      proveedorNombre: orNull(opts.proveedorNombre) ?? orNull(orden.Nombre),
      tipoPersona: tp,
      organismo,
      // El "monto" del listado de ChileCompra no es un campo numerico fijo aqui; se preserva el
      // estado/nombre crudo de la orden como contenido VERBATIM. No se computa ningun total.
      monto: orNull(orden.Nombre),
      fechaOc: orNull(orden.FechaEnvio),
      origen: ORIGEN_DINERO,
      fecha_captura: fechaCaptura,
      enlace,
      licencia: LICENCIA_DINERO,
    });
  }

  // Orden estable por codigo de orden (determinista para tests/idempotencia).
  out.sort((a, b) => a.codigoOrden.localeCompare(b.codigoOrden));
  return out;
}
