/**
 * Tipos de dominio de la tabla maestra de identidad (`parlamentario`) + zod.
 *
 * Cubre ID-01/ID-02 (Fase 3): el modelo normalizado de un parlamentario vigente
 * sembrado desde los catálogos oficiales de Cámara y Senado, más el `estado` de
 * reconciliación determinista que decide `matchDeterminista`.
 *
 * Sin dependencias de runtime más allá de zod (compuerta de contrato): @obs/core
 * permanece como contrato puro consumible desde cualquier paquete.
 *
 * PRIVACIDAD (Ley 21.719 / T-03-03): `rut` es campo INTERNO nullable. Los catálogos
 * NO lo traen (default null); jamás se fabrica un RUT ni se expone en una capa pública.
 */

import { z } from "zod";

/** Cámara de origen del parlamentario. */
export type Camara = "diputados" | "senado";

/**
 * Estado de reconciliación de identidad.
 * Único escritor: `matchDeterminista` (fail-closed). `confirmado` solo por RUT exacto
 * o nombre único en (cámara, periodo); ante cualquier ambigüedad → `no_confirmado`.
 * `probable` queda reservado para la adjudicación LLM + revisión humana de Fase 4.
 */
export type EstadoIdentidad = "confirmado" | "probable" | "no_confirmado";

/**
 * Parlamentario de la tabla maestra. `nombre_normalizado` es la CLAVE de comparación
 * (producida por `normalizarNombre`); el DISPLAY usa los campos originales
 * (`nombres`, `apellido_paterno`, `apellido_materno`), NUNCA el normalizado.
 */
export interface Parlamentario {
  /** Id interno estable (p.ej. "P00001"). */
  id: string;
  /** Clave de comparación normalizada (tokens ordenados, sin acentos, ñ→n). */
  nombre_normalizado: string;
  /** Nombres de pila (display). */
  nombres: string;
  /** Apellido paterno (display). */
  apellido_paterno: string;
  /** Apellido materno (display). */
  apellido_materno: string;
  /** Cámara de origen. */
  camara: Camara;
  /** Periodo/legislatura vigente (clave de blocking del matcher junto a `camara`). */
  periodo: string;
  /** Región (nullable: no siempre presente según fuente). */
  region: string | null;
  /** Distrito (diputados; nullable — el WS de Cámara no lo trae, Pitfall 4). */
  distrito: string | null;
  /** Circunscripción (senadores; nullable). */
  circunscripcion: string | null;
  /** Partido/bancada vigente (nullable). */
  partido: string | null;
  /** RUT interno (Ley 21.719): nullable, jamás fabricado ni público. */
  rut: string | null;
  /** PARLID del Senado (nullable). */
  parlid_senado: string | null;
  /** Id del diputado en el WS de la Cámara (nullable). */
  id_diputado_camara: string | null;
  /** Estado de reconciliación determinista. */
  estado: EstadoIdentidad;
  /** Email de contacto (nullable). */
  email: string | null;
  /** Provenance: fuente de origen ("senado" | "diputados"). */
  origen: string;
  /** Provenance: ISO 8601 del momento de captura. */
  fecha_captura: string;
  /** Provenance: enlace original consultado. */
  enlace: string;
}

const CAMARA_VALUES = ["diputados", "senado"] as const;
const ESTADO_VALUES = ["confirmado", "probable", "no_confirmado"] as const;

/**
 * Cotas de longitud y forma para los campos libres (WR-06). La compuerta de contrato no solo
 * valida nullability: rechaza contenido implausible (un CURRICULUM mal mapeado en `nombres`, un
 * EMAIL basura) antes de que aterrice en el snapshot/DB. No es defensa contra inyección
 * (PostgREST parametriza; JSON.stringify escapa), sino integridad del dato en la frontera.
 */
const MAX_NOMBRE = 120;
const MAX_NORMALIZADO = 240;
const MAX_CAMPO = 160;
const MAX_EMAIL = 254; // longitud máxima de email (RFC 5321)
const MAX_ENLACE = 2048;

/** Validación de forma de email, agnóstica a la versión de zod. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida el shape de UNA fila normalizada antes del upsert a la maestra.
 * `rut`/`distrito`/`circunscripcion`/`region`/`partido`/`email` son nullable
 * (Pitfall 4: los catálogos no traen RUT ni la Cámara trae distrito).
 */
export const ParlamentarioSeedSchema = z.object({
  id: z.string().min(1).max(MAX_CAMPO),
  nombre_normalizado: z.string().min(1).max(MAX_NORMALIZADO),
  nombres: z.string().max(MAX_NOMBRE),
  apellido_paterno: z.string().max(MAX_NOMBRE),
  apellido_materno: z.string().max(MAX_NOMBRE),
  camara: z.enum(CAMARA_VALUES),
  periodo: z.string().min(1).max(MAX_CAMPO),
  region: z.string().max(MAX_CAMPO).nullable(),
  distrito: z.string().max(MAX_CAMPO).nullable(),
  circunscripcion: z.string().max(MAX_CAMPO).nullable(),
  partido: z.string().max(MAX_CAMPO).nullable(),
  rut: z.string().max(MAX_CAMPO).nullable(),
  parlid_senado: z.string().max(MAX_CAMPO).nullable(),
  id_diputado_camara: z.string().max(MAX_CAMPO).nullable(),
  estado: z.enum(ESTADO_VALUES),
  // WR-06: un string no vacío DEBE tener forma de email; "" (nodo vacío del catálogo) o null
  // son aceptables. Rechaza un EMAIL basura/mal mapeado en la frontera.
  email: z
    .string()
    .max(MAX_EMAIL)
    .refine((v) => v === "" || EMAIL_RE.test(v), {
      message: "email con formato inválido",
    })
    .nullable(),
  origen: z.string().min(1).max(MAX_CAMPO),
  fecha_captura: z.string().min(1).max(MAX_CAMPO),
  enlace: z.string().min(1).max(MAX_ENLACE),
});

/** Tipo inferido del schema de seed (debe ser asignable a `Parlamentario`). */
export type ParlamentarioSeed = z.infer<typeof ParlamentarioSeedSchema>;
