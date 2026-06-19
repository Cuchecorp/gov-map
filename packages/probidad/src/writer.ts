// writer — ProbidadWriter inyectable (upsert VERSIONADO por (fuente_id, fecha_presentacion)) +
// fake in-memory.
//
// Persiste el modelo de probidad (migración 0022) de forma IDEMPOTENTE Y VERSIONADA:
//   * declaracion              → PK compuesta (fuente_id, fecha_presentacion) — las versiones ACUMULAN
//   * declaracion_bien_*/…      → unique por la clave natural del bien (FK a la versión)
//   * declaracion_familiar      → deny-by-default (tercero PII; sin enlace a persona)
//   * probidad_ingesta_estado   → PK parlamentario_id (marcador para los 3 estados honestos)
//
// CLAVE DE VERSIÓN (Pitfall 1 / INT-04): dos declaraciones del MISMO declarante con distinta
// `fechaPresentacion` → DOS filas; un re-run de la MISMA versión NO duplica NI sobreescribe; una
// versión vieja NUNCA se borra. Correr 2× con el mismo input deja los mismos conteos.
//
// Los bienes/familiares viven ANIDADOS en la declaración para-escribir; el writer los aplana.

import type { DeclaracionParaEscribir } from "./reconciliar-declarante";

/** Writer idempotente+versionado inyectable. */
export interface ProbidadWriter {
  /** Upserta declaraciones VERSIONADAS + sus bienes + familiares (cascada por clave de versión). */
  upsertDeclaraciones(filas: DeclaracionParaEscribir[]): Promise<void>;
  /**
   * Marca a los parlamentarios tocados (un row por id en `probidad_ingesta_estado`), para
   * distinguir "no ingestado" de "ingestado, cero confirmadas" en la ficha.
   */
  marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void>;
}

/** Clave de VERSIÓN de una declaración (fuente_id + fecha_presentacion). */
export function versionKey(fuenteId: string, fechaPresentacion: string): string {
  return `${fuenteId}∥${fechaPresentacion}`;
}

/** Clave natural de un bien dentro de una versión (deja deduplicar entre re-runs). */
function bienKey(version: string, partes: Array<string | null>): string {
  return `${version}∥${partes.map((p) => p ?? "∅").join("∣")}`;
}

/**
 * Writer fake in-memory: Maps por clave de versión / clave natural → upsert idempotente verificable.
 * Re-correr con el mismo input deja los mismos conteos (no duplica); una nueva fecha es una fila nueva.
 */
export class InMemoryProbidadWriter implements ProbidadWriter {
  /** versionKey → fila raíz de declaracion (sin los hijos anidados). */
  readonly declaraciones = new Map<
    string,
    {
      fuente_id: string;
      fecha_presentacion: string;
      parlamentario_id: string | null;
      mencion_declarante: string;
      estado_vinculo: string | null;
      tipo: string | null;
      cargo: string | null;
      organismo: string | null;
      origen: string;
      fecha_captura: string;
      enlace: string;
      licencia: string;
    }
  >();
  readonly bienesInmuebles = new Map<string, Record<string, unknown>>();
  readonly bienesMuebles = new Map<string, Record<string, unknown>>();
  readonly actividades = new Map<string, Record<string, unknown>>();
  readonly pasivos = new Map<string, Record<string, unknown>>();
  readonly accionesDerechos = new Map<string, Record<string, unknown>>();
  readonly valores = new Map<string, Record<string, unknown>>();
  /** familiares (deny-by-default): clave natural por versión → fila cruda. */
  readonly familiares = new Map<string, Record<string, unknown>>();
  /** parlamentario_id → marcador de ingesta. */
  readonly ingestaEstado = new Map<string, { parlamentario_id: string; ingestado_hasta: string }>();

  async upsertDeclaraciones(filas: DeclaracionParaEscribir[]): Promise<void> {
    for (const f of filas) {
      const vk = versionKey(f.fuenteId, f.fechaPresentacion);
      // Raíz: upsert por la clave de VERSIÓN → re-run de la misma versión NO duplica; una nueva
      // fecha es una clave nueva (fila nueva). NUNCA se borra una versión vieja.
      this.declaraciones.set(vk, {
        fuente_id: f.fuenteId,
        fecha_presentacion: f.fechaPresentacion,
        // Storage PLANO: el FK branded (EnlaceConfirmado) se aplana a string|null.
        parlamentario_id: f.enlace?.parlamentarioId ?? null,
        mencion_declarante: f.mencionDeclarante,
        estado_vinculo: f.estadoVinculo,
        tipo: f.tipo,
        cargo: f.cargo,
        organismo: f.organismo,
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace_url,
        licencia: f.licencia,
      });
      const prov = { origen: f.origen, fecha_captura: f.fecha_captura, enlace: f.enlace_url, licencia: f.licencia };
      for (const b of f.bienes.inmuebles) {
        this.bienesInmuebles.set(
          bienKey(vk, [b.ubicadoEn, b.rolAvaluo, b.numInscripcion]),
          { fuente_id: f.fuenteId, fecha_presentacion: f.fechaPresentacion, ...b, ...prov },
        );
      }
      for (const b of f.bienes.muebles) {
        this.bienesMuebles.set(
          bienKey(vk, [b.nombre, b.modelo, b.matricula, b.numeroInscripcion]),
          { fuente_id: f.fuenteId, fecha_presentacion: f.fechaPresentacion, ...b, ...prov },
        );
      }
      for (const a of f.bienes.actividades) {
        this.actividades.set(
          bienKey(vk, [a.objeto, a.vinculo]),
          { fuente_id: f.fuenteId, fecha_presentacion: f.fechaPresentacion, ...a, ...prov },
        );
      }
      for (const p of f.bienes.pasivos) {
        this.pasivos.set(
          bienKey(vk, [p.tipoObligacion, p.acreedor, p.montoDeuda]),
          { fuente_id: f.fuenteId, fecha_presentacion: f.fechaPresentacion, ...p, ...prov },
        );
      }
      for (const a of f.bienes.accionesDerechos) {
        this.accionesDerechos.set(
          bienKey(vk, [a.rutJuridica, a.fechaAdquisicion, a.cantidadAcciones]),
          { fuente_id: f.fuenteId, fecha_presentacion: f.fechaPresentacion, ...a, ...prov },
        );
      }
      for (const v of f.bienes.valores) {
        this.valores.set(
          bienKey(vk, [v.entidadEmisora, v.tipoAccionDerecho, v.fechaAdquisicion]),
          { fuente_id: f.fuenteId, fecha_presentacion: f.fechaPresentacion, ...v, ...prov },
        );
      }
      // Familiares: deny-by-default, crudos, SIN enlace a persona.
      for (const fam of f.familiares) {
        this.familiares.set(
          bienKey(vk, [fam.relacion, fam.nombre]),
          {
            fuente_id: f.fuenteId,
            fecha_presentacion: f.fechaPresentacion,
            relacion: fam.relacion,
            nombre: fam.nombre,
            origen: f.origen,
            fecha_captura: f.fecha_captura,
            enlace: f.enlace_url,
          },
        );
      }
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    for (const id of parlamentarioIds) {
      this.ingestaEstado.set(id, { parlamentario_id: id, ingestado_hasta: hasta });
    }
  }
}
