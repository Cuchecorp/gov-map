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
 * Fila del RPC `parlamentarios_publico()` (migración 0026) — el DIRECTORIO.
 *
 * Espejo de `ParlamentarioPublicoRow` MENOS los campos de provenance
 * (`origen`/`fecha_captura`/`enlace`): el listado no los renderiza por fila
 * (los muestra la ficha individual). Son EXACTAMENTE las 7 columnas seguras que
 * el RPC `security definer` emite. NUNCA `partido`/`rut`/`email` (LEGAL-03);
 * la fila del directorio tampoco trae foto. `camara` es NOT NULL en la maestra;
 * `region`/`distrito`/`circunscripcion`/`periodo` son NULLABLE (0005, Pitfall 5).
 */
export interface ParlamentarioListadoRow {
  id: string;
  nombre: string;
  camara: "diputados" | "senado";
  region: string | null;
  distrito: string | null;
  circunscripcion: string | null;
  periodo: string | null;
}

/**
 * Fila del RPC `votos_de_parlamentario` (migración 0019, EXTENDIDO por 0028). El RPC
 * devuelve SOLO filas confirmadas (`estado_vinculo='confirmado'`), por eso no trae
 * `mencion_nombre`/`parlamentario_id`/`estado_vinculo`: la identidad ya está
 * confirmada y la subjetividad de la ficha es el propio parlamentario. El
 * `boletin` es el COMPLETO con sufijo → enlaza a `/proyecto/[boletin]`.
 *
 * Phase 22 (0028): la fila ahora trae además su SUSTANCIA (`titulo` del proyecto +
 * `idea_matriz` COMPLETA — el UI la trunca con `extractoIdea`, la DB la proyecta
 * entera) y su DESENLACE (`resultado`/`total_si`/`total_no`/
 * `total_abstencion`/`total_pareo`/`quorum` de la votación) para evitar N+1 joins en
 * el server component. `titulo`/`idea_matriz` pueden ser `null` (LEFT JOIN: un proyecto
 * sin idea matriz devuelve null — honest-state, NUNCA fabricado). Sigue siendo SOLO
 * filas confirmadas.
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
  // Sustancia (0028) — null honesto si el proyecto/ficha no la tiene (LEFT JOIN).
  titulo: string | null;
  idea_matriz: string | null;
  // Desenlace de la votación (0028) — null si la votación no lo publica.
  resultado: string | null;
  total_si: number | null;
  total_no: number | null;
  total_abstencion: number | null;
  total_pareo: number | null;
  quorum: string | null;
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
  // Sustancia/desenlace (Phase 22) — OPCIONALES: una mención cruda los muestra
  // igual que la fila confirmada cuando la fuente los trae, conservando su
  // IdentityMarker. Todos `null` cuando no aplican (honest-state, NUNCA fabricado).
  titulo?: string | null;
  idea_matriz?: string | null;
  resultado?: string | null;
  total_si?: number | null;
  total_no?: number | null;
  total_abstencion?: number | null;
  total_pareo?: number | null;
  quorum?: string | null;
}

/**
 * Fila del RPC `rebeldias_de_parlamentario` (migración 0047 — extiende 0019,
 * security definer). Derivado público: votación + boletín + TÍTULO/ETAPA del
 * proyecto (left join → null honesto pre-apply) + selección propia + opción
 * mayoritaria de la bancada en ESA misma votación. CERO score, CERO etiqueta de
 * juicio; la bancada cruda nunca se expone. El orden de los campos espeja el
 * `returns table` de 0047 (votacion_id, boletin, titulo, etapa, fecha,
 * seleccion_propia, mayoria_bancada). `titulo`/`etapa` pueden ser null; el
 * consumidor degrada honesto (fallback al boletín) mientras 0047 no esté aplicada.
 */
export interface RebeldiaRow {
  votacion_id: string;
  boletin: string;
  titulo: string | null;
  etapa: string | null;
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
 * Fila CRUDA del RPC `cruces_de_parlamentario` (migración 0040, security definer,
 * deny-by-default — sin grant a anon hasta firma legal Phase 39). Espejo de
 * `LobbyAudienciaRpcRow` en disciplina PII-safe. El RPC proyecta SOLO el catálogo
 * público de sector (`sector_id`/`sector_etiqueta`) + `tipo_senal` + `conteo` + la
 * `evidencia` jsonb; NUNCA `rut`, `donante_id` ni `partido`. La evidencia nace
 * PII-safe en el materializador (0039): nombre CRUDO de contraparte, sin RUT.
 * `tipo_senal` hoy solo toma `'lobby_sector'`; el UI degrada honesto ante otros.
 */
export interface CruceSenalRpcRow {
  sector_id: string;
  sector_etiqueta: string;
  /** Hoy SOLO `'lobby_sector'`; degradar honesto a cualquier otro valor futuro. */
  tipo_senal: string;
  /** Conteo NEUTRO (único agregado permitido §9.1) — sin score/ranking/afinidad. */
  conteo: number;
  evidencia: CruceEvidencia;
  /**
   * Fecha de materialización del cruce (cuándo corrió `materializar_cruces()`).
   * Nivel SEÑAL: todos los items comparten esta fecha. Proyectada por 0041
   * (CRUCEN-01). ISO string del timestamptz → `ProvenanceBadge.capturedAt`.
   */
  fecha_captura: string;
}

/**
 * Forma del jsonb `evidencia` (0039): conteo + items[] crudos con su enlace de
 * fuente (trazabilidad por dato, FND-08).
 */
export interface CruceEvidencia {
  conteo: number;
  items: CruceEvidenciaItem[];
}

/**
 * Un item de evidencia de cruce (forma EXACTA del jsonb de 0039). La FRESCURA del
 * dato (capturedAt del `ProvenanceBadge`) viene de `CruceSenalRpcRow.fecha_captura`
 * (nivel señal, proyectada por 0041 — CRUCEN-01), NO de este item. `item.fecha` es
 * solo texto FACTUAL de la fecha de la reunión (§9.1-safe), nunca frescura.
 */
export interface CruceEvidenciaItem {
  /** `'reunion'` hoy; etiqueta cruda del tipo de hecho. */
  tipo: string;
  /** ISO date de la audiencia (fecha de la REUNIÓN). `null` si la fuente no la publica → texto factual plano, no frescura. */
  fecha: string | null;
  /** Nombre CRUDO de la contraparte (D-10), nunca normalizado/inferido → siempre con `IdentityMarker`. */
  contraparte_nombre_crudo: string;
  /** Identificador crudo de la audiencia (clave de fila, nunca un RUT). */
  audiencia_id: string;
  /** Enlace a la fuente original → `ProvenanceBadge.sourceUrl`. `null` → sin enlace. */
  enlace_fuente: string | null;
}

/**
 * Fila del RPC `cruces_de_proyecto` (migración 0049, security definer — Phase 38,
 * SURF-02). Proyección PÚBLICA PII-safe: yuxtapone, en la ficha de un proyecto, un
 * parlamentario que votó A FAVOR del boletín (`voto.seleccion='si'` confirmado) con sus
 * reuniones de lobby EN EL SECTOR del proyecto (`cruce_senal.sector_id` =
 * `proyecto_ficha.sector_id`). El RPC lee `parlamentario`/`cruce_senal` (deny-by-default)
 * INTERNAMENTE y emite SOLO el derivado público: NUNCA `rut`, `partido` ni `email`.
 * A diferencia de `CruceSenalRpcRow` (perfil del parlamentario), esta fila incluye
 * `parlamentario_id` + `nombre_normalizado` porque el SUJETO se enlaza a
 * `/parlamentario/[id]` (52-03 aplica texto-plano a CONTRAPARTES, no a parlamentarios).
 * Reutiliza `CruceEvidencia` (misma forma jsonb de 0039).
 */
export interface CruceProyectoRow {
  /** `p.id` (ej. `D1133`) → link `/parlamentario/[id]`. Nunca un RUT. */
  parlamentario_id: string;
  /** Proyección pública del nombre; se renderiza con `formatNombre` (F54). NUNCA partido/rut/email. */
  nombre_normalizado: string;
  sector_id: string;
  /** Rótulo público del catálogo `sector.etiqueta`. */
  sector_etiqueta: string;
  /** Hoy SOLO `'lobby_sector'`; degradar honesto a cualquier otro valor futuro. */
  tipo_senal: string;
  /** Conteo NEUTRO de reuniones (único agregado permitido §9.1) — sin score/ranking/afinidad. */
  conteo: number;
  evidencia: CruceEvidencia;
  /**
   * Fecha de materialización del cruce (rebuild diario cron `23 3 * * *`). Nivel SEÑAL:
   * todos los items comparten esta fecha. ISO string del timestamptz →
   * `ProvenanceBadge.capturedAt` (frescura del rebuild, NO de la reunión — WR-02/F41).
   */
  fecha_captura: string;
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
 * Fila CRUDA del RPC `contratos_de_parlamentario` (Plan 14-01, security definer).
 * El RPC proyecta SOLO los campos publicados por ChileCompra (Mercado Público) del
 * contrato — el SUJETO es la entidad proveedora (`proveedor_nombre`), distinta de
 * cualquier enlace al parlamentario. El enlace contrato→parlamentario se fija ÚNICA-
 * mente por RUT-exacto (Plan 14-02). Campos de dinero LITERALES (string verbatim);
 * el UI NO computa nada. `licencia` = "mención de la fuente" (NO CC BY 4.0).
 * `fecha_corte` (fecha de la consulta por RUT) es distinta de `fecha_captura`.
 */
export interface ContratoRpcRow {
  codigo_orden: string;
  // WR-01: estas columnas son NULLABLE en `contrato` (0023_dinero.sql) y el RPC las proyecta
  // verbatim → el tipo DEBE reflejar `string | null` o el UI crashea al hacer `.toLowerCase()`.
  proveedor_nombre: string | null;
  tipo_persona: string | null; // "natural" | "jurídica" (label literal de la fuente)
  organismo: string | null;
  // CR-02: nombre/descripción de la orden (texto libre de la fuente). NO es un monto.
  nombre_orden: string | null;
  monto: string | null; // CR-02: hoy SIEMPRE null (la fuente no trae monto fijo); nunca un no-monto
  fecha_oc: string | null; // ISO; fecha de la orden de compra
  origen: string;
  fecha_captura: string;
  fecha_corte: string; // ISO; fecha de corte de la consulta por RUT
  enlace: string;
  licencia: string; // "mención de la fuente" (NO CC BY 4.0)
}

/**
 * Fila CRUDA del RPC `aportes_de_parlamentario` (Plan 15-01, security definer).
 * El RPC proyecta SOLO los campos publicados por SERVEL del aporte de campaña — el
 * SUJETO es el donante (`donante_nombre`), distinto del candidato/parlamentario. El
 * enlace aporte→parlamentario se fija por NOMBRE CONFIRMADO del candidato (auditado
 * por el pipeline de identidad, Plan 15-02) — la fuente SERVEL NO trae RUT, así que
 * la asociación NUNCA es "por RUT". El RUT del donante NUNCA se proyecta (Ley 21.719,
 * un aporte puede revelar afiliación política). `eleccion` es NON-NULL (load-bearing:
 * la ficha agrupa por periodo). Campos de dinero LITERALES (string verbatim); el UI NO
 * computa nada. `licencia` = "términos por verificar" (NO CC BY 4.0). `fecha_corte`
 * (fecha de la consulta) es distinta de `fecha_captura`.
 */
export interface AporteRpcRow {
  // load-bearing: la ficha agrupa por elección/periodo; NON-NULL en la DB (0024).
  eleccion: string;
  // El RPC puede devolver null en estas columnas (nullable en la DB) → el UI usa
  // fallbacks honestos ("Donante no publicado"/"No publicado") en vez de crashear.
  donante_nombre: string | null;
  tipo_persona: string | null; // "natural" | "jurídica" (label literal de la fuente)
  monto: string | null; // string verbatim, NUNCA numérico → "No publicado" si null
  fecha_aporte: string | null; // ISO; "Fecha no publicada" si null
  tipo_aporte: string | null;
  // Nombre del candidato verbatim (la llave del enlace por NOMBRE, Plan 15-02).
  candidato_nombre_verbatim: string | null;
  origen: string;
  fecha_captura: string;
  fecha_corte: string; // ISO; fecha de corte de la consulta
  enlace: string;
  licencia: string; // "términos por verificar" (NO CC BY 4.0)
}

/**
 * Fila CRUDA del RPC `agregado_por_contraparte` (Plan 16-01, security definer,
 * jurídica-only). El RPC es prefix-dispatched por el id ('c:<rut_proveedor>' →
 * faceta contratos; 'd:<donante_nombre>' → faceta aportes) y devuelve UNA fila por
 * contraparte jurídica matcheada. `facet` discrimina la faceta; `contraparte_nombre`
 * es el nombre PÚBLICO de la jurídica (NUNCA el de una persona natural, NUNCA un
 * RUT/llave de donante); `conteo` es el agregado NEUTRAL (count, jamás una suma de
 * montos); `filas` son las filas de hecho verbatim, cada una con su provenance —
 * `ContratoRpcRow[]` cuando `facet === 'contrato'`, `AporteRpcRow[]` cuando
 * `facet === 'aporte'`. El UI despacha por `facet` y NUNCA compone una contraparte
 * de dinero junto a un voto (regla rectora dura anti-insinuación, 16-CONTEXT.md).
 */
export interface AgregadoContraparteRpcRow {
  facet: "contrato" | "aporte";
  // Nombre público de la jurídica; null-safe (el UI cae a un fallback honesto).
  contraparte_nombre: string | null;
  // Siempre 'juridica' (el RPC filtra); el UI lo re-verifica como defensa en profundidad.
  tipo_persona: string | null;
  // Agregado NEUTRAL: cantidad de filas. NUNCA una suma de montos.
  conteo: number;
  // Filas de hecho verbatim de la faceta, con provenance por fila. La unión refleja
  // el discriminante `facet`; el consumidor estrecha por faceta antes de renderizar.
  filas: ContratoRpcRow[] | AporteRpcRow[];
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
  /**
   * Bienes declarados de ESTA versión (RPC `bienes_de_parlamentario`, agrupados
   * por `fuente_id`). Default `[]`. El UI los agrupa por `tipo_bien` y dispone
   * cada `contenido` como pares etiqueta NOUN → valor LITERAL, sin computar nada.
   */
  bienes: BienRpcRow[];
}

/**
 * Tipo de bien declarado en una versión de declaración de patrimonio/intereses.
 * Discrimina la forma de `BienRpcRow.contenido` (jsonb con claves camelCase, solo
 * las presentes-no-nulas). El UI lo agrupa en un orden fijo y mapea cada clave a
 * una etiqueta NOUN en español.
 */
export type TipoBien =
  | "inmueble"
  | "mueble"
  | "actividad"
  | "pasivo"
  | "accion_derecho"
  | "valor";

/**
 * Fila CRUDA del RPC `bienes_de_parlamentario` (security definer). Una fila por
 * bien declarado en una versión. El RPC proyecta SOLO los campos publicados del
 * bien — NUNCA RUT del parlamentario, NUNCA un familiar, NUNCA clave interna
 * (deny-by-default, LEGAL-03). `fuente_id` agrupa los bienes con su versión de
 * declaración (espeja `DeclaracionRpcRow.fuente_id`). `contenido` es un jsonb
 * cuyas claves camelCase (solo presentes-no-nulas) dependen de `tipo_bien`; el UI
 * las dispone como pares etiqueta NOUN → valor LITERAL verbatim, sin computar nada
 * (CERO suma de montos, CERO delta, CERO veredicto — PROJECT.md hard anti-feature).
 */
export interface BienRpcRow {
  fuente_id: string;
  fecha_presentacion: string; // date ISO
  tipo_bien: TipoBien;
  /** jsonb: claves camelCase presentes-no-nulas según `tipo_bien`. Valores verbatim. */
  contenido: Record<string, unknown>;
  origen: string;
  fecha_captura: string;
  enlace: string | null;
  licencia: string;
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
  // `lobby` ANTES que `transparencia`: el origen de lobby de la Cámara es
  // "camara-transparencia-lobby" (PROV-01/Phase 25) — contiene "transparencia", así que
  // el chequeo de InfoProbidad lo capturaba por error. Lobby gana primero.
  if (o.includes("lobby")) return "Ley del Lobby";
  if (o.includes("probidad") || o.includes("cplt") || o.includes("transparencia"))
    return "InfoProbidad";
  if (o.includes("senado")) return "Senado";
  // `diputados` es el `origen` CANÓNICO de la maestra de la Cámara (parse-camara/seeder),
  // no "camara" — sin este mapeo el header de la ficha del diputado mostraba "fuente
  // desconocida" pese a tener provenance completa (origen/fecha_captura/enlace). (PROV-01)
  if (o.includes("camara") || o.includes("cámara") || o.includes("diputad")) return "Cámara";
  if (o.includes("bcn")) return "BCN";
  if (o.includes("chilecompra") || o.includes("mercado")) return "ChileCompra";
  if (o.includes("servel")) return "SERVEL";
  return "fuente desconocida";
}
