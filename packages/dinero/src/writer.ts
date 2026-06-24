// writer — DineroWriter inyectable (upsert VERSIONADO por (fuente_id, fecha_corte)) + fake
// in-memory.
//
// Persiste el modelo de dinero (migracion 0023) de forma IDEMPOTENTE Y VERSIONADA:
//   * contrato                  -> PK compuesta (fuente_id, fecha_corte) — las versiones ACUMULAN
//   * contratista               -> sub-maestra keyed por rut_proveedor (last-write-wins)
//   * contratos_ingesta_estado  -> PK parlamentario_id (marcador para los 3 estados honestos)
//
// CLAVE DE VERSION: dos cortes del MISMO contrato -> DOS filas; un re-run de la MISMA version NO
// duplica NI sobreescribe. Correr 2x con el mismo input deja los mismos conteos.

import type { ContratoParaEscribir } from "./reconciliar-contrato";
import type { Contratista } from "./model";

/** Writer idempotente+versionado inyectable. */
export interface DineroWriter {
  /** Upserta contratos VERSIONADOS por (fuente_id, fecha_corte) — idempotente. */
  upsertContratos(filas: ContratoParaEscribir[]): Promise<void>;
  /** Upserta la sub-maestra `contratista` keyed por rut_proveedor (last-write-wins). */
  upsertContratistas(filas: Contratista[]): Promise<void>;
  /**
   * Marca a los parlamentarios tocados (un row por id en `contratos_ingesta_estado`), para
   * distinguir "no consultado" de "consultado sin contratos" en la ficha.
   */
  marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void>;
}

/** Clave de VERSION de un contrato (fuente_id + fecha_corte). */
export function versionKey(fuenteId: string, fechaCorte: string): string {
  return `${fuenteId}∥${fechaCorte}`;
}

/**
 * Writer fake in-memory: Maps por clave de version / RUT -> upsert idempotente verificable.
 * Re-correr con el mismo input deja los mismos conteos (no duplica); un nuevo corte es una fila
 * nueva; la sub-maestra es last-write-wins por RUT.
 */
export class InMemoryDineroWriter implements DineroWriter {
  /** versionKey -> fila raiz de contrato. */
  readonly contratos = new Map<
    string,
    {
      fuente_id: string;
      fecha_corte: string;
      codigo_orden: string;
      parlamentario_id: string | null;
      rut_proveedor: string;
      proveedor_nombre: string | null;
      mencion_proveedor: string | null;
      tipo_persona: string;
      estado_vinculo: string;
      organismo: string | null;
      nombre_orden: string | null;
      monto: string | null;
      fecha_oc: string | null;
      origen: string;
      fecha_captura: string;
      enlace: string;
      licencia: string;
    }
  >();
  /** rut_proveedor -> fila de la sub-maestra contratista (last-write-wins). */
  readonly contratistas = new Map<string, Record<string, unknown>>();
  /** parlamentario_id -> marcador de ingesta. */
  readonly ingestaEstado = new Map<string, { parlamentario_id: string; ingestado_hasta: string }>();

  async upsertContratos(filas: ContratoParaEscribir[]): Promise<void> {
    for (const f of filas) {
      const vk = versionKey(f.fuenteId, f.fechaCorte);
      // Raiz: upsert por la clave de VERSION -> re-run de la misma version NO duplica; un nuevo
      // corte es una clave nueva (fila nueva). NUNCA se borra una version vieja.
      this.contratos.set(vk, {
        fuente_id: f.fuenteId,
        fecha_corte: f.fechaCorte,
        codigo_orden: f.codigoOrden,
        // Storage PLANO: el FK branded (EnlaceConfirmado) se aplana a string|null.
        parlamentario_id: f.enlace?.parlamentarioId ?? null,
        rut_proveedor: f.rutProveedor,
        proveedor_nombre: f.mencionProveedor,
        mencion_proveedor: f.mencionProveedor,
        tipo_persona: f.tipoPersona,
        estado_vinculo: f.estadoVinculo,
        organismo: f.organismo,
        nombre_orden: f.nombreOrden,
        monto: f.monto,
        fecha_oc: f.fechaOc,
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace_url,
        licencia: f.licencia,
      });
    }
  }

  async upsertContratistas(filas: Contratista[]): Promise<void> {
    for (const c of filas) {
      // Sub-maestra keyed por RUT del proveedor: last-write-wins.
      this.contratistas.set(c.rutProveedor, {
        rut_proveedor: c.rutProveedor,
        nombre: c.nombre,
        codigo_empresa: c.codigoEmpresa,
        tipo_persona: c.tipoPersona,
        // Δ3 (ENT-03): FK plano a entidad_tercero (columna nueva de 0036); null si no confirma.
        entidad_id: c.entidadId ?? null,
        origen: c.origen,
        fecha_captura: c.fecha_captura,
        enlace: c.enlace,
        licencia: c.licencia,
      });
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    for (const id of parlamentarioIds) {
      this.ingestaEstado.set(id, { parlamentario_id: id, ingestado_hasta: hasta });
    }
  }
}
