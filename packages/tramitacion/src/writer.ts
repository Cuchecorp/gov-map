// writer — TramitacionWriter inyectable (upsert idempotente por CLAVE NATURAL) + fake in-memory.
//
// El writer persiste el modelo común (proyecto/votacion/voto/tramitacion_evento) de forma
// IDEMPOTENTE por clave natural (migración 0008):
//   * proyecto            → PK `boletin`
//   * votacion            → PK `id`
//   * voto                → unique (votacion_id, fuente_voter_id)  (CR-02)
//   * tramitacion_evento  → unique (boletin, fecha, camara, tipo, descripcion)
//
// Correr la ingesta 2× con el mismo input NO duplica filas (upsert, no insert). La impl real
// (SupabaseTramitacionWriter) vive en writer-supabase.ts; aquí van la interfaz y un fake
// in-memory (Map por clave natural) para los tests sin red ni DB.

import type { EnlaceConfirmado } from "@obs/identity";
import type {
  Proyecto,
  Votacion,
  Voto,
  TramitacionEvento,
  ProyectoAutor,
  AutorParaEscribir,
} from "./model";
import { aplanarAutor } from "./model";

/**
 * Entrada del writer del voto (IDENT-12). Espeja `Voto` EXCEPTO el FK: en lugar de un
 * `parlamentario_id: string | null` crudo, lleva `enlace: EnlaceConfirmado | null`, un
 * tipo branded que SOLO la reconciliación puede mintear (vía `confirmar()` de @obs/identity).
 *
 * Esto sube la guarda LOCKED de v1.0 (TRAM-06) de convención a INVARIANTE TIPADO: un writer
 * nuevo (Phase 11+) que intente `enlace: "P00042"` (string) NO compila. El writer deriva
 * internamente `parlamentario_id = enlace?.parlamentarioId ?? null` antes de persistir, de modo
 * que la forma DB persistida (`Voto`) sigue plana (`string | null`) — Anti-Pattern A4 del research:
 * input branded, storage plano.
 */
export interface VotoParaEscribir {
  votacion_id: string;
  fuente_voter_id: string;
  mencion_nombre: string;
  /** FK de atribución — branded. Sólo `EnlaceConfirmado` (determinista/confirmado) o null. */
  enlace: EnlaceConfirmado | null;
  seleccion: Voto["seleccion"];
  metodo: Voto["metodo"];
  estado_vinculo: Voto["estado_vinculo"];
}

/**
 * Aplana una entrada branded a la fila `Voto` persistida: el FK se fija SOLO si hay
 * `EnlaceConfirmado`; en otro caso `null` (guarda LOCKED). Único sitio donde el branded type
 * se convierte en el `string | null` de la DB.
 */
export function aplanarVoto(row: VotoParaEscribir): Voto {
  return {
    votacion_id: row.votacion_id,
    fuente_voter_id: row.fuente_voter_id,
    mencion_nombre: row.mencion_nombre,
    parlamentario_id: row.enlace?.parlamentarioId ?? null,
    seleccion: row.seleccion,
    metodo: row.metodo,
    estado_vinculo: row.estado_vinculo,
  };
}

/** Writer idempotente inyectable. Cada método upserta por la clave natural de su entidad. */
export interface TramitacionWriter {
  upsertProyecto(proyecto: Proyecto): Promise<void>;
  upsertVotacion(votaciones: Votacion[]): Promise<void>;
  /**
   * Upsert idempotente de votos. El FK se tipa como `EnlaceConfirmado | null` (IDENT-12):
   * un `parlamentario_id` string crudo en esta posición es un ERROR DE COMPILACIÓN.
   */
  upsertVotos(votos: VotoParaEscribir[]): Promise<void>;
  upsertEventos(eventos: TramitacionEvento[]): Promise<void>;
  /**
   * Upsert idempotente de autores de proyecto (AUTOR-01). El FK `parlamentario_id` se tipa
   * como `EnlaceConfirmado | null` dentro de `AutorParaEscribir` — idéntica guarda LOCKED
   * que votos. Un string crudo NO compila en esa posición.
   */
  upsertAutores(autores: AutorParaEscribir[]): Promise<void>;
}

/** Clave natural del voto (CR-02: votacion + discriminador NO colisionante del votante). */
function votoKey(v: Voto): string {
  return `${v.votacion_id} ${v.fuente_voter_id}`;
}

/** Clave natural del evento de tramitación (timeline materializado). */
function eventoKey(e: TramitacionEvento): string {
  return [e.boletin, e.fecha, e.camara, e.tipo, e.descripcion].join(" ");
}

/**
 * Writer fake in-memory: Map por clave natural → upsert idempotente verificable en tests.
 * Re-correr con el mismo input deja los mismos conteos (no duplica).
 */
export class InMemoryTramitacionWriter implements TramitacionWriter {
  readonly proyectos = new Map<string, Proyecto>();
  readonly votaciones = new Map<string, Votacion>();
  readonly votos = new Map<string, Voto>();
  readonly eventos = new Map<string, TramitacionEvento>();
  readonly autores = new Map<string, Omit<ProyectoAutor, "id">>();

  async upsertProyecto(proyecto: Proyecto): Promise<void> {
    this.proyectos.set(proyecto.boletin, proyecto);
  }

  async upsertVotacion(votaciones: Votacion[]): Promise<void> {
    for (const v of votaciones) this.votaciones.set(v.id, v);
  }

  async upsertVotos(votos: VotoParaEscribir[]): Promise<void> {
    for (const row of votos) {
      const v = aplanarVoto(row);
      this.votos.set(votoKey(v), v);
    }
  }

  async upsertEventos(eventos: TramitacionEvento[]): Promise<void> {
    for (const e of eventos) this.eventos.set(eventoKey(e), e);
  }

  async upsertAutores(autores: AutorParaEscribir[]): Promise<void> {
    for (const row of autores) {
      const plano = aplanarAutor(row);
      this.autores.set(`${plano.boletin}\x00${plano.autor_crudo_norm}`, plano);
    }
  }
}
