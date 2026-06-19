// writer-servel — ServelWriter inyectable (upsert VERSIONADO por (fuente_id, fecha_corte)) + fake
// in-memory. Espeja writer.ts de ChileCompra.
//
// Persiste el modelo SERVEL (migracion 0024) de forma IDEMPOTENTE Y VERSIONADA:
//   * aporte                  -> PK compuesta (fuente_id, fecha_corte) — las versiones ACUMULAN
//   * donante                 -> sub-maestra keyed por donante_id (last-write-wins)
//   * aportes_ingesta_estado  -> PK parlamentario_id (marcador para los 3 estados honestos)
//
// CLAVE DE VERSION: dos cortes del MISMO aporte -> DOS filas; un re-run de la MISMA version NO duplica
// NI sobreescribe. STORAGE PLANO: el FK del candidato entra branded (`EnlaceConfirmado | null`) via
// `enlaceCandidato` y se persiste como `parlamentario_id: string | null`.

import type { AporteParaEscribir } from "./reconciliar-aporte";
import type { Donante } from "./model-servel";

/** Writer idempotente+versionado inyectable. */
export interface ServelWriter {
  /** Upserta aportes VERSIONADOS por (fuente_id, fecha_corte) — idempotente. */
  upsertAportes(filas: AporteParaEscribir[]): Promise<void>;
  /** Upserta la sub-maestra `donante` keyed por donante_id (last-write-wins). */
  upsertDonantes(filas: Donante[]): Promise<void>;
  /**
   * Marca a los parlamentarios tocados (un row por id en `aportes_ingesta_estado`), para distinguir
   * "no ingestado" de "ingestado sin aportes" en la ficha.
   */
  marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void>;
}

/** Clave de VERSION de un aporte (fuente_id + fecha_corte). */
export function versionKeyServel(fuenteId: string, fechaCorte: string): string {
  return `${fuenteId}∥${fechaCorte}`;
}

/**
 * Writer fake in-memory: Maps por clave de version / donante_id -> upsert idempotente verificable.
 * Re-correr con el mismo input deja los mismos conteos (no duplica); un nuevo corte es una fila nueva;
 * la sub-maestra es last-write-wins por donante_id.
 */
export class InMemoryServelWriter implements ServelWriter {
  /** versionKey -> fila raiz de aporte. */
  readonly aportes = new Map<string, Record<string, unknown>>();
  /** donante_id -> fila de la sub-maestra donante (last-write-wins). */
  readonly donantes = new Map<string, Record<string, unknown>>();
  /** parlamentario_id -> marcador de ingesta. */
  readonly ingestaEstado = new Map<string, { parlamentario_id: string; ingestado_hasta: string }>();

  async upsertAportes(filas: AporteParaEscribir[]): Promise<void> {
    for (const f of filas) {
      const vk = versionKeyServel(f.fuenteId, f.fechaCorte);
      this.aportes.set(vk, {
        fuente_id: f.fuenteId,
        fecha_corte: f.fechaCorte,
        eleccion: f.eleccion,
        // Storage PLANO: el FK branded (EnlaceConfirmado) del candidato se aplana a string|null.
        parlamentario_id: f.enlaceCandidato?.parlamentarioId ?? null,
        estado_vinculo: f.estadoVinculo,
        candidato_nombre_verbatim: f.candidatoNombreVerbatim,
        donante_nombre: f.donanteNombre,
        tipo_persona: f.tipoPersona,
        monto: f.monto,
        fecha_aporte: f.fechaAporte,
        tipo_aporte: f.tipoAporte,
        territorio: f.territorio,
        pacto: f.pacto,
        partido: f.partido,
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace,
        licencia: f.licencia,
      });
    }
  }

  async upsertDonantes(filas: Donante[]): Promise<void> {
    for (const d of filas) {
      // Sub-maestra keyed por donante_id: last-write-wins. El donante NUNCA es llave de enlace.
      this.donantes.set(d.donanteId, {
        donante_id: d.donanteId,
        rut_donante: d.rutDonante,
        nombre: d.nombre,
        tipo_persona: d.tipoPersona,
        origen: d.origen,
        fecha_captura: d.fecha_captura,
        enlace: d.enlace,
        licencia: d.licencia,
      });
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    for (const id of parlamentarioIds) {
      this.ingestaEstado.set(id, { parlamentario_id: id, ingestado_hasta: hasta });
    }
  }
}
