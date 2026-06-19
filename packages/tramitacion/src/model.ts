// @obs/tramitacion — modelo común normalizado (TRAM-03).
//
// La LLAVE DE CRUCE entre ambas cámaras es el número de boletín. Cada entidad lleva
// procedencia inline (`origen`/`fecha_captura`/`enlace`, TRAM-09) — mismo contrato de
// frescura que la maestra `parlamentario` (FND-08). La forma conceptual de procedencia
// es la `Provenance` de @obs/core (source/sourceUrl/fetchedAt); aquí se persiste con los
// nombres de columna de la migración 0008 (`origen`/`fecha_captura`/`enlace`).

import { z } from "zod";

// ── Enums del dominio ────────────────────────────────────────────────────────
export type Iniciativa = "Mensaje" | "Moción";
export type Camara = "diputados" | "senado";
// 5 opciones del roll-call (VOTE-03): las 4 nominales + `ausente` (asistencia).
// `ausente` se deriva del ROSTER de la votación (el diputado aparece en <Votos> con
// código de no-asistencia, p.ej. "No Vota"), NUNCA de la ausencia de fila en la DB.
export type Seleccion = "si" | "no" | "abstencion" | "pareo" | "ausente";
export type MetodoVinculo = "determinista" | "llm" | "humano";
export type EstadoVinculo = "confirmado" | "probable" | "no_confirmado";
export type TipoEvento = "tramite" | "urgencia" | "informe" | "oficio" | "votacion";

// ── Procedencia inline (TRAM-09 / FND-08) ────────────────────────────────────
const ProvenanceInline = {
  /** Id de la fuente, p.ej. "senado-wspublico" / "camara-opendata". */
  origen: z.string(),
  /** ISO 8601 del momento de captura. */
  fecha_captura: z.string(),
  /** Enlace original consultado. */
  enlace: z.string(),
} as const;

// ── Proyecto (PK = boletín completo) ─────────────────────────────────────────
export interface Proyecto {
  /** Boletín completo con sufijo de comisión, p.ej. "18296-05" (PK, display). */
  boletin: string;
  /** Boletín base sin sufijo, p.ej. "18296" — el Senado se consulta con éste (Pitfall 1). */
  boletin_num: string;
  titulo: string;
  iniciativa: Iniciativa | null;
  camara_origen: string | null;
  autores: string[];
  materia: string | null;
  estado: string | null;
  etapa: string | null;
  subetapa: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export const ProyectoSchema = z.object({
  boletin: z.string(),
  boletin_num: z.string(),
  titulo: z.string(),
  iniciativa: z.enum(["Mensaje", "Moción"]).nullable(),
  camara_origen: z.string().nullable(),
  autores: z.array(z.string()),
  materia: z.string().nullable(),
  estado: z.string().nullable(),
  etapa: z.string().nullable(),
  subetapa: z.string().nullable(),
  ...ProvenanceInline,
});

// ── Votacion ─────────────────────────────────────────────────────────────────
export interface Votacion {
  /** Id sintético estable, p.ej. "camara:89178" / "senado:<sesion>:<fecha>". */
  id: string;
  /** FK a proyecto.boletin (boletín completo). */
  boletin: string;
  /** Fecha de la votación en ISO 8601. */
  fecha: string;
  etapa: string | null;
  tipo: string | null;
  quorum: string | null;
  resultado: string | null;
  total_si: number;
  total_no: number;
  total_abstencion: number;
  total_pareo: number;
  camara: Camara;
  origen: string;
  fecha_captura: string;
  enlace: string;
}

const intTotal = z.number().int().nonnegative();

export const VotacionSchema = z.object({
  id: z.string(),
  boletin: z.string(),
  fecha: z.string(),
  etapa: z.string().nullable(),
  tipo: z.string().nullable(),
  quorum: z.string().nullable(),
  resultado: z.string().nullable(),
  total_si: intTotal,
  total_no: intTotal,
  total_abstencion: intTotal,
  total_pareo: intTotal,
  camara: z.enum(["diputados", "senado"]),
  ...ProvenanceInline,
});

// ── Voto (desglose voto-a-voto) ──────────────────────────────────────────────
export interface Voto {
  /** FK a votacion.id. */
  votacion_id: string;
  /**
   * Discriminador NO colisionante del votante dentro de su votación (CR-02): NUNCA derivado del
   * nombre. Cámara → el `Diputado/Id` (DIPID) oficial; Senado (solo nombre) → el índice posicional
   * del voto en la fuente, prefijado (`seq:<n>`). Es la clave natural del upsert idempotente
   * `(votacion_id, fuente_voter_id)`: dos votantes distintos jamás colapsan, y re-ingerir el mismo
   * detalle produce las MISMAS filas.
   */
  fuente_voter_id: string;
  /** Nombre crudo tal cual viene de la fuente ("Coloma C., Juan Antonio"). */
  mencion_nombre: string;
  /** Solo poblado si el vínculo es determinista/confirmado; null en otro caso. */
  parlamentario_id: string | null;
  seleccion: Seleccion;
  metodo: MetodoVinculo | null;
  estado_vinculo: EstadoVinculo | null;
}

export const VotoSchema = z.object({
  votacion_id: z.string(),
  fuente_voter_id: z.string(),
  mencion_nombre: z.string(),
  parlamentario_id: z.string().nullable(),
  seleccion: z.enum(["si", "no", "abstencion", "pareo", "ausente"]),
  metodo: z.enum(["determinista", "llm", "humano"]).nullable(),
  estado_vinculo: z.enum(["confirmado", "probable", "no_confirmado"]).nullable(),
});

// ── TramitacionEvento (timeline materializado) ───────────────────────────────
export interface TramitacionEvento {
  /** FK a proyecto.boletin. */
  boletin: string;
  /** Fecha del evento en ISO 8601 (parsear dd/mm/yyyy ANTES — Pitfall 3). */
  fecha: string;
  camara: string;
  tipo: TipoEvento;
  descripcion: string;
  /** Enlace al documento del evento (LINK_INFORME/LINK_OFICIO) o null. */
  enlace: string | null;
  origen: string;
  fecha_captura: string;
}

// El `enlace` propio del evento (link al documento) es nullable y distinto de la
// procedencia: ProvenanceInline aporta `origen`/`fecha_captura`/`enlace` (fuente).
// Para el evento el `enlace` del documento manda; se deja como nullable explícito y
// el spread de ProvenanceInline define la fuente de captura.
export const TramitacionEventoSchema = z
  .object({
    boletin: z.string(),
    fecha: z.string(),
    camara: z.string(),
    tipo: z.enum(["tramite", "urgencia", "informe", "oficio", "votacion"]),
    descripcion: z.string(),
    enlace: z.string().nullable(),
    origen: z.string(),
    fecha_captura: z.string(),
  });
