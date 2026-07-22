// writer — BioWriter inyectable (upsert idempotente por CLAVE NATURAL) + fake in-memory.
//
// Persiste el modelo de bio (migración 0059) de forma IDEMPOTENTE por clave natural:
//   * parlamentario_bio        → onConflict parlamentario_id
//   * parlamentario_militancia → onConflict parlamentario_id, partido_alias, desde
//   * comision                 → onConflict nombre, camara
//   * comision_membresia       → onConflict comision_id, parlamentario_id
//   * parlamentario.partido    → UPDATE desde la militancia ACTUAL (+ fecha_captura)
//
// Correr la ingesta 2× con el mismo input NO duplica filas (upsert por clave, Map en el fake).
// La impl real (SupabaseBioWriter) vive en writer-supabase.ts; aquí van la interfaz y un fake
// in-memory (Map por clave natural) para tests sin red ni DB.

import type { BioParlamentario, Militancia, Comision, ComisionMembresia } from "./model";

/** Actualización de `parlamentario.partido` desde la militancia vigente (fail-loud si ambiguo). */
export interface PartidoUpdate {
  parlamentarioId: string;
  partido: string;
  fechaCaptura: string;
}

/** Writer idempotente inyectable. Cada método upserta por la clave natural de su entidad. */
export interface BioWriter {
  /** Upserta la bio 1:1 (onConflict parlamentario_id). */
  upsertBio(filas: BioParlamentario[]): Promise<void>;
  /** Upserta militancias (onConflict parlamentario_id, partido_alias, desde). */
  upsertMilitancias(filas: Militancia[]): Promise<void>;
  /**
   * Upserta el catálogo de comisiones (onConflict nombre, camara) y devuelve el mapeo
   * (nombre|camara) → comisionId asignado, para que el caller enlace la membresía.
   */
  upsertComisiones(filas: Comision[]): Promise<Map<string, string>>;
  /** Upserta membresías (onConflict comision_id, parlamentario_id). */
  upsertMembresias(filas: ComisionMembresia[]): Promise<void>;
  /** UPDATE parlamentario.partido + fecha_captura desde la militancia ACTUAL. */
  actualizarPartidoParlamentario(updates: PartidoUpdate[]): Promise<void>;
}

/** Clave natural de una comisión (nombre + camara). */
export function comisionKey(nombre: string, camara: string): string {
  return `${nombre}${camara}`;
}

/** Clave natural de una militancia (parlamentario + alias + desde). */
export function militanciaKey(parlamentarioId: string, partidoAlias: string, desde: string): string {
  return `${parlamentarioId}${partidoAlias}${desde}`;
}

/** Clave natural de una membresía (comisión + parlamentario). */
export function membresiaKey(comisionId: string, parlamentarioId: string): string {
  return `${comisionId}${parlamentarioId}`;
}

/**
 * Writer fake in-memory: Map por clave natural → upsert idempotente verificable en tests.
 * Re-correr con el mismo input deja los mismos conteos (no duplica).
 */
export class InMemoryBioWriter implements BioWriter {
  readonly bio = new Map<string, BioParlamentario>();
  readonly militancias = new Map<string, Militancia>();
  readonly comisiones = new Map<string, Comision & { comisionId: string }>();
  readonly membresias = new Map<string, ComisionMembresia>();
  readonly partidos = new Map<string, PartidoUpdate>();

  async upsertBio(filas: BioParlamentario[]): Promise<void> {
    for (const f of filas) this.bio.set(f.parlamentarioId, f);
  }

  async upsertMilitancias(filas: Militancia[]): Promise<void> {
    for (const f of filas) {
      this.militancias.set(militanciaKey(f.parlamentarioId, f.partidoAlias, f.desde), f);
    }
  }

  async upsertComisiones(filas: Comision[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const f of filas) {
      const key = comisionKey(f.nombre, f.camara);
      // Id sintético estable derivado de la clave natural (idempotente entre corridas).
      const comisionId = this.comisiones.get(key)?.comisionId ?? `C:${key}`;
      this.comisiones.set(key, { ...f, comisionId });
      map.set(key, comisionId);
    }
    return map;
  }

  async upsertMembresias(filas: ComisionMembresia[]): Promise<void> {
    for (const f of filas) {
      this.membresias.set(membresiaKey(f.comisionId, f.parlamentarioId), f);
    }
  }

  async actualizarPartidoParlamentario(updates: PartidoUpdate[]): Promise<void> {
    for (const u of updates) this.partidos.set(u.parlamentarioId, u);
  }
}
