/**
 * Formas de fila tal cual las devuelve Supabase para las tablas públicas de
 * tramitación (migración 0008). Columnas snake_case. Espejan el modelo común
 * de `@obs/tramitacion` sin acoplar el frontend al paquete del backend.
 */

// 5 opciones del roll-call (VOTE-03): las 4 nominales + `ausente` (asistencia).
// EXTENDIDO con "ausente" para la ficha del parlamentario (UI-SPEC §3.2/§10);
// el chip `ausente` se añade a SELECCION_STYLE en voto-row.tsx.
export type Seleccion = "si" | "no" | "abstencion" | "pareo" | "ausente";
export type EstadoVinculo = "confirmado" | "probable" | "no_confirmado";

export interface ProyectoRow {
  boletin: string;
  boletin_num: string;
  titulo: string;
  iniciativa: string | null;
  camara_origen: string | null;
  autores: string[] | null;
  materia: string | null;
  estado: string | null;
  etapa: string | null;
  subetapa: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
}

export interface TramitacionEventoRow {
  boletin: string;
  fecha: string;
  camara: string;
  tipo: string;
  descripcion: string;
  enlace: string | null;
  origen: string;
  fecha_captura: string;
}

export interface VotoRow {
  votacion_id: string;
  mencion_nombre: string;
  parlamentario_id: string | null;
  seleccion: Seleccion;
  metodo: string | null;
  estado_vinculo: EstadoVinculo | null;
}

export interface VotacionRow {
  id: string;
  boletin: string;
  fecha: string;
  etapa: string | null;
  tipo: string | null;
  quorum: string | null;
  resultado: string | null;
  total_si: number;
  total_no: number;
  total_abstencion: number;
  total_pareo: number;
  camara: "diputados" | "senado";
  origen: string;
  fecha_captura: string;
  enlace: string;
  /** Embed de Supabase: votacion.select("*, voto(*)"). */
  voto?: VotoRow[];
}

/** Un cuerpo legal afectado (norma + artículos), tal como lo serializa la ficha. */
export interface CuerpoLegalRow {
  norma: string;
  articulos: string[];
}

/**
 * Fila de `proyecto_ficha` (migración 0011). 1:1 con proyecto por boletín.
 * `idea_matriz` null = degradación honesta first-class (texto íntegro no
 * disponible), NUNCA un resumen fabricado. `cuerpos_legales` es jsonb.
 */
export interface ProyectoFichaRow {
  boletin: string;
  idea_matriz: string | null;
  cuerpos_legales: CuerpoLegalRow[];
  texto_r2_path: string | null;
  estado: string;
  origen: string;
  fecha_captura: string;
}

/**
 * Fila del RPC `match_proyectos` (migración 0011). El RPC retorna SOLO
 * (boletin, similarity) — nunca columnas no públicas (T-07-03). `similarity`
 * se usa server-side para el orden; NUNCA se muestra al usuario (UI-SPEC §5).
 */
export interface MatchProyectoRow {
  boletin: string;
  similarity: number;
}

/**
 * Cabecera pública del parlamentario (RPC `parlamentario_publico`, migración 0020).
 *
 * `parlamentario` es deny-by-default (RLS on, cero policies, 0005/0018): anon NO
 * lee NINGUNA columna directamente. Este RPC `security definer` emite SOLO los
 * campos públicos-seguros de la cabecera — NUNCA `partido` (afiliación política,
 * dato sensible Ley 21.719), `rut` ni `email` (LEGAL-03). El chip de bancada/
 * partido de UI-SPEC §3.1 queda OMITIDO en consecuencia (no anon-readable).
 */
export interface ParlamentarioPublicoRow {
  id: string;
  nombre: string;
  camara: "diputados" | "senado";
  region: string | null;
  distrito: string | null;
  circunscripcion: string | null;
  periodo: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string | null;
}

/**
 * Fila del RPC `votos_de_parlamentario` (migración 0019). El RPC devuelve SOLO
 * filas confirmadas (`estado_vinculo='confirmado'`), por eso no trae
 * `mencion_nombre`/`parlamentario_id`/`estado_vinculo`: la identidad ya está
 * confirmada y la subjetividad de la ficha es el propio parlamentario. El
 * `boletin` es el COMPLETO con sufijo → enlaza a `/proyecto/[boletin]`.
 */
export interface VotoFichaRow {
  votacion_id: string;
  boletin: string;
  fecha: string;
  seleccion: Seleccion;
  etapa: string | null;
  camara: "diputados" | "senado";
  origen: string;
  fecha_captura: string;
  enlace: string | null;
}

/**
 * Fila CRUDA orientada a la guarda de identidad de la ficha (estado (b),
 * UI-SPEC §3.6). El RPC confirmado no la emite (no hay menciones no verificadas
 * confirmadas), pero el componente `VotoFichaRow` la soporta para que una
 * mención `probable`/`no_confirmado` se renderice con `IdentityMarker` y NUNCA
 * como enlace al parlamentario. La usan los fixtures de test de los 3 estados.
 */
export interface VotoFichaMencion {
  votacion_id: string;
  boletin: string;
  fecha: string;
  seleccion: Seleccion;
  camara: "diputados" | "senado";
  origen: string;
  fecha_captura: string;
  enlace: string | null;
  /** Nombre crudo de la fuente (estado (b)). */
  mencion_nombre: string;
  parlamentario_id: string | null;
  estado_vinculo: EstadoVinculo | null;
}

/**
 * Fila del RPC `rebeldias_de_parlamentario` (migración 0019, security definer).
 * Derivado público: votación + boletín + selección propia + opción mayoritaria
 * de la bancada en ESA misma votación. CERO score, CERO etiqueta de juicio; la
 * bancada cruda nunca se expone.
 */
export interface RebeldiaRow {
  votacion_id: string;
  boletin: string;
  fecha: string;
  seleccion_propia: Seleccion;
  mayoria_bancada: Seleccion;
}

/**
 * Fila del RPC `lobby_de_parlamentario` (migración 0021, security definer) — la
 * forma del payload PÚBLICO de una reunión de lobby (UI-SPEC §10). El RPC hace
 * left join `lobby_audiencia ← lobby_contraparte`, así que devuelve UNA fila por
 * contraparte (una audiencia con N contrapartes ⇒ N filas con el mismo
 * `identificador`). El Server Component las agrupa por `identificador`.
 *
 * El RPC SOLO proyecta campos que la fuente ya publica: NUNCA emite
 * `contraparte_id` ni RUT de tercero (deny-by-default, LEGAL-03). En P11 la
 * contraparte por lo tanto NUNCA se enlaza (no hay sub-maestra ni id confirmado)
 * → siempre TEXTO CRUDO + `IdentityMarker`.
 *
 * NOTA de aliasing (UI-SPEC §10): el RPC nombra la columna del rol crudo de la
 * contraparte como `contraparte_rol`; aquí se expone como `contraparte_tipo`
 * (etiqueta literal de la fuente, sin editorializar). El alias se hace al leer
 * el RPC en el Server Component.
 */
export interface LobbyAudienciaRpcRow {
  identificador: string;
  fecha: string | null;
  fecha_raw: string | null;
  materia: string | null;
  enlace_detalle: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string | null;
  /** Nombre crudo del tercero, verbatim de la fuente. `null` si la audiencia no trae contraparte. */
  contraparte_nombre: string | null;
  /** Rol crudo de la contraparte (lobbista/gestor/...). Alias UI: `contraparte_tipo`. */
  contraparte_rol: string | null;
  representado: string | null;
}

/**
 * Una contraparte cruda de una audiencia (UI-SPEC §3.2). TEXTO CRUDO siempre;
 * `contraparte_id` y `estado_vinculo` NO son parte del payload público (el RPC
 * nunca los emite) → en P11 NUNCA se enlaza, siempre lleva `IdentityMarker`.
 */
export interface LobbyContraparteRow {
  /** Nombre crudo del tercero, verbatim de la fuente. */
  contraparte_nombre: string;
  /** Rol/tipo crudo de la fuente, si existe ("gestor de intereses"…). Sin editorializar. */
  contraparte_tipo: string | null;
  /** Entidad representada (raw), si la fuente la publica. */
  representado: string | null;
}

/**
 * Una audiencia de lobby ya agrupada (1 audiencia con sus N contrapartes crudas),
 * la forma que consume `LobbyView`. La contraparte es SIEMPRE texto crudo; el
 * `ProvenanceBadge` por fila es obligatorio.
 */
export interface LobbyAudienciaRow {
  identificador: string;
  /** ISO; fecha de la audiencia → `DD MMM YYYY`. `null` si la fuente no la publica. */
  fecha: string | null;
  /** String fuente de la fecha, conservado si el parseo falló (nunca fabricado). */
  fecha_raw: string | null;
  /** Asunto/materia verbatim de la fuente, si existe. */
  materia: string | null;
  /** Contrapartes crudas de la audiencia (puede ir vacío si la fuente no lista ninguna). */
  contrapartes: LobbyContraparteRow[];
  /** → `sourceLabel(origen)` → `ProvenanceBadge.sourceName`. */
  origen: string;
  /** → `ProvenanceBadge.capturedAt`. */
  fecha_captura: string;
  /** → `ProvenanceBadge.sourceUrl` (enlace por-audiencia). */
  enlace: string | null;
}

/**
 * Fila CRUDA del RPC `declaraciones_de_parlamentario` (migración 0022, security
 * definer). El RPC proyecta SOLO los campos escalares publicados de la versión —
 * NUNCA `parlamentario_id` interno, NUNCA un familiar, NUNCA un RUT de persona
 * natural (deny-by-default, LEGAL-03). `fuente_id` es la URI del nodo Declaración
 * (clave de versión única). El Server Component la modela como `DeclaracionVersionRow`.
 */
export interface DeclaracionRpcRow {
  fuente_id: string;
  fecha_presentacion: string; // date ISO
  tipo: string; // label literal de la fuente (rdfs:label resuelto o URI cruda)
  cargo: string | null;
  organismo: string | null;
  origen: string;
  fecha_captura: string;
  enlace: string | null;
  licencia: string;
}

/**
 * Fila CRUDA del RPC `comparar_declaraciones` (migración 0022, security definer).
 * El RPC devuelve los campos declarados LITERALES en FILAS (etiqueta/valor), una
 * por (versión × campo). CERO columna de delta/variación/enriquecimiento/veredicto
 * (PROJECT.md hard anti-feature, LOCKED). El UI las dispone lado-a-lado SIN computar
 * nada; un campo ausente lo rotula el UI ("No declarado en esta versión"), no el RPC.
 */
export interface CompararDeclaracionRpcRow {
  fecha_presentacion: string; // date ISO → identidad de columna
  etiqueta: string; // NOUN label del campo declarado
  valor: string | null; // literal verbatim de la fuente
  origen: string;
  fecha_captura: string;
  enlace: string | null;
  licencia: string;
}

/**
 * Payload PÚBLICO de UNA versión de declaración (UI-SPEC §10). La forma que
 * consume `PatrimonioView`. La `fecha_presentacion` es PROMINENTE (mono, labeled
 * "Presentada el …") — una vieja NUNCA se lee como estado actual (INT-04). Cada
 * campo declarado es un par `{ etiqueta NOUN, valor literal }` — NUNCA prosa
 * conectiva autorada (lección `representado` de Phase 11). El UI NO computa nada.
 *
 * PROHIBIDO en este payload (LEGAL-03 deny-by-default; el RPC no los proyecta):
 * el RUT del parlamentario, nombres/RUT de familiares, cualquier clave interna.
 */
export interface DeclaracionVersionRow {
  /** URI del nodo Declaración (clave de versión única). */
  declaracion_id: string;
  /** Idéntico a `declaracion_id` (cada versión es su propio nodo). Identidad estable para el selector de comparación. */
  version_id: string;
  /** Categoría literal de la fuente (label, sin editorializar). */
  tipo: string;
  /** ISO; PROMINENTE → "Presentada el DD MMM YYYY". */
  fecha_presentacion: string;
  /** Identidad del declarante — guarda §3.4: set SOLO si confirmado. */
  parlamentario_id: string | null;
  parlamentario_estado_vinculo:
    | "confirmado"
    | "probable"
    | "revision"
    | "no_confirmado"
    | null;
  /** Nombre crudo del declarante (solo caso no confirmado). */
  parlamentario_mencion: string;
  /** Campos declarados LITERALES: etiqueta NOUN muted + valor verbatim. */
  campos: Array<{ etiqueta: string; valor: string }>;
  /** → `sourceLabel(origen)` → `ProvenanceBadge.sourceName` ("InfoProbidad"). */
  origen: string;
  /** → `ProvenanceBadge.capturedAt` (frescura ámbar vía `esStale`). */
  fecha_captura: string;
  /** → `ProvenanceBadge.sourceUrl` (registro de la fuente por declaración). */
  enlace: string | null;
  /** → atribución visible (intro + caption de comparación). */
  licencia: "CC BY 4.0";
  /** `true` → declaración vieja: badge ámbar + caveat §6.4; NUNCA "actual". */
  es_historica: boolean;
}

/**
 * Una columna de la vista de comparación (UI-SPEC §3.5): una versión fechada con
 * sus pares etiqueta/valor literales. El UI dispone N columnas lado-a-lado; un
 * campo ausente en una columna se rotula "No declarado en esta versión". CERO
 * delta/veredicto — el RPC no computa nada y el UI tampoco.
 */
export interface DeclaracionComparacionColumna {
  fecha_presentacion: string; // ISO → "Presentada el …" (identidad de columna, mono)
  origen: string;
  fecha_captura: string;
  enlace: string | null;
  licencia: string;
  /** Map etiqueta → valor literal (un campo declarado por entrada). */
  valores: Record<string, string>;
}

/** Etiqueta legible de la fuente para el ProvenanceBadge. */
export function sourceLabel(origen: string | null): string {
  const o = (origen ?? "").toLowerCase();
  if (o.includes("probidad") || o.includes("cplt") || o.includes("transparencia"))
    return "InfoProbidad";
  if (o.includes("lobby")) return "Ley del Lobby";
  if (o.includes("senado")) return "Senado";
  if (o.includes("camara") || o.includes("cámara")) return "Cámara";
  if (o.includes("bcn")) return "BCN";
  return "fuente desconocida";
}
