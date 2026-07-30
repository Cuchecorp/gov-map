// ════════════════════════════════════════════════════════════════════════════
// Contrato TS del jsonb `actualidad_senal.evidencia` (Phase 128, PANEL-03/05/07).
//
// El contrato NO es homogéneo entre señales (verificado contra PROD,
// 128-RESEARCH.md §"Contrato REAL del jsonb en PROD"). Tres asimetrías que este
// módulo ya paga para que los tiles (03/04/06) no tengan que redescubrirlas:
//
//   P2 — `velocity` NO trae `descripcion` (urgencias/archivados sí, es el GRADO
//        verbatim de fuente tras 0081 `grado`→`descripcion`).
//   P3 — `agenda_sala` NO trae `semana_iso` (solo `agenda_citacion` la trae).
//   P4 — `quorum` es POLISÉMICO por cámara: numérico en Senado ("1","5"),
//        literal de urgencia en Cámara ("SUMA (04.08.2026)", "DISCUSIÓN
//        INMEDIATA", null). El parser NUNCA interpreta `quorum`; lo conserva
//        verbatim — la interpretación es responsabilidad del tile (P4/R7).
//
// Prohibido `as` sobre el jsonb: cada clave se lee con narrowing por tipo
// (`typeof x === "string" ? x : null`), de forma que un shape parcial degrada
// a `null`/`[]` en vez de fabricar `undefined` renderizado (anti-pattern #1
// del research) o lanzar (T-128-05 — una señal mal formada no tumba la
// portada).
// ════════════════════════════════════════════════════════════════════════════

export interface FuenteEvidencia {
  origen: string | null;
  dataset: string | null;
}

/** velocity | urgencias | archivados — `descripcion` NO existe en velocity (P2) */
export interface ItemProyecto {
  fecha: string | null; // date-only "2026-07-28"
  enlace: string | null;
  titulo: string | null;
  boletin: string | null;
  en_corpus: boolean;
  descripcion: string | null; // urgencias: el GRADO verbatim; velocity: siempre null
  enlace_evento: string | null;
}

export interface PuntoCitacion {
  boletin: string | null;
  titulo: string | null;
  enlace: string | null;
  materia: string | null;
  posicion: number | null;
  en_corpus: boolean;
}

export interface ItemCitacion {
  fecha: string | null;
  enlace: string | null;
  comision: string | null;
  horario: string | null;
  semana_iso: string | null; // presente SOLO en agenda_citacion
  puntos_total: number | null;
  puntos: PuntoCitacion[];
}

export interface ItemTablaSala {
  boletin: string | null;
  titulo: string | null;
  enlace: string | null;
  materia: string | null;
  posicion: number | null;
  quorum: string | null; // POLISÉMICO por cámara (P4) — el tile decide
  en_corpus: boolean;
  parte_sesion: string | null;
}

export interface ItemSesionSala {
  fecha: string | null;
  tipo: string | null;
  numero: string | null;
  hora_inicio: string | null;
  enlace: string | null;
  tabla_total: number | null;
  tabla: ItemTablaSala[];
}

export interface Evidencia<T> {
  items: T[];
  total: number | null;
  consultado_al: string | null;
  fuente: FuenteEvidencia;
}

// ── Narrowing helpers (cero `as` sobre el jsonb) ────────────────────────────

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(v: unknown): boolean {
  return v === true;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function fuenteVacia(): FuenteEvidencia {
  return { origen: null, dataset: null };
}

function parseFuente(v: unknown): FuenteEvidencia {
  if (!esObjeto(v)) return fuenteVacia();
  return { origen: str(v.origen), dataset: str(v.dataset) };
}

/** Envoltorio de nivel superior común a las tres señales (items/total/consultado_al/fuente). */
function parseEnvoltorio(raw: unknown): {
  items: unknown[];
  total: number | null;
  consultado_al: string | null;
  fuente: FuenteEvidencia;
} {
  if (!esObjeto(raw)) {
    return { items: [], total: null, consultado_al: null, fuente: fuenteVacia() };
  }
  return {
    items: arr(raw.items),
    total: num(raw.total),
    consultado_al: str(raw.consultado_al),
    fuente: parseFuente(raw.fuente),
  };
}

function parseItemProyecto(v: unknown): ItemProyecto | null {
  if (!esObjeto(v)) return null;
  return {
    fecha: str(v.fecha),
    enlace: str(v.enlace),
    titulo: str(v.titulo),
    boletin: str(v.boletin),
    en_corpus: bool(v.en_corpus),
    descripcion: str(v.descripcion),
    enlace_evento: str(v.enlace_evento),
  };
}

export function parseEvidenciaProyectos(raw: unknown): Evidencia<ItemProyecto> {
  const { items, total, consultado_al, fuente } = parseEnvoltorio(raw);
  const parsed: ItemProyecto[] = [];
  for (const it of items) {
    const p = parseItemProyecto(it);
    if (p) parsed.push(p);
  }
  return { items: parsed, total, consultado_al, fuente };
}

function parsePuntoCitacion(v: unknown): PuntoCitacion | null {
  if (!esObjeto(v)) return null;
  return {
    boletin: str(v.boletin),
    titulo: str(v.titulo),
    enlace: str(v.enlace),
    materia: str(v.materia),
    posicion: num(v.posicion),
    en_corpus: bool(v.en_corpus),
  };
}

function parseItemCitacion(v: unknown): ItemCitacion | null {
  if (!esObjeto(v)) return null;
  const puntos: PuntoCitacion[] = [];
  for (const p of arr(v.puntos)) {
    const parsed = parsePuntoCitacion(p);
    if (parsed) puntos.push(parsed);
  }
  return {
    fecha: str(v.fecha),
    enlace: str(v.enlace),
    comision: str(v.comision),
    horario: str(v.horario),
    semana_iso: str(v.semana_iso),
    puntos_total: num(v.puntos_total),
    puntos,
  };
}

export function parseEvidenciaCitaciones(raw: unknown): Evidencia<ItemCitacion> {
  const { items, total, consultado_al, fuente } = parseEnvoltorio(raw);
  const parsed: ItemCitacion[] = [];
  for (const it of items) {
    const p = parseItemCitacion(it);
    if (p) parsed.push(p);
  }
  return { items: parsed, total, consultado_al, fuente };
}

function parseItemTablaSala(v: unknown): ItemTablaSala | null {
  if (!esObjeto(v)) return null;
  return {
    boletin: str(v.boletin),
    titulo: str(v.titulo),
    enlace: str(v.enlace),
    materia: str(v.materia),
    posicion: num(v.posicion),
    quorum: str(v.quorum), // verbatim — jamás interpretado aquí (P4)
    en_corpus: bool(v.en_corpus),
    parte_sesion: str(v.parte_sesion),
  };
}

function parseItemSesionSala(v: unknown): ItemSesionSala | null {
  if (!esObjeto(v)) return null;
  const tabla: ItemTablaSala[] = [];
  for (const t of arr(v.tabla)) {
    const parsed = parseItemTablaSala(t);
    if (parsed) tabla.push(parsed);
  }
  return {
    fecha: str(v.fecha),
    tipo: str(v.tipo),
    numero: str(v.numero),
    hora_inicio: str(v.hora_inicio),
    enlace: str(v.enlace),
    tabla_total: num(v.tabla_total),
    tabla,
  };
}

export function parseEvidenciaSala(raw: unknown): Evidencia<ItemSesionSala> {
  const { items, total, consultado_al, fuente } = parseEnvoltorio(raw);
  const parsed: ItemSesionSala[] = [];
  for (const it of items) {
    const p = parseItemSesionSala(it);
    if (p) parsed.push(p);
  }
  return { items: parsed, total, consultado_al, fuente };
}

// ── Derivaciones puras ───────────────────────────────────────────────────────

/**
 * Etiqueta ciudadana de la fuente DESDE EL DATO (D-02) — jamás un mapa por
 * `tipo_senal`. La tabla de conversión es ÚNICAMENTE de legibilidad (tilde +
 * nombre ciudadano de los 2 datasets que PROD emite hoy); cualquier dataset
 * fuera de la tabla se devuelve verbatim. Esto NO es un mapa semántico por
 * tipo de señal — solo restaura legibilidad sobre el `dataset` real.
 */
const ETIQUETAS_DATASET: Record<string, string> = {
  tramitacion: "Tramitación",
  agenda: "Agenda del Congreso",
};

export function etiquetaFuente(f: FuenteEvidencia): string | null {
  if (!f.dataset) return null;
  return ETIQUETAS_DATASET[f.dataset] ?? f.dataset;
}

/**
 * Normaliza el literal de `descripcion` (o del `quorum` de Cámara) a uno de
 * los 3 grados conocidos (`Suma` | `Simple` | `Discusión inmediata`) por
 * comparación case-insensitive sobre el prefijo alfabético, ignorando
 * cualquier paréntesis adjunto. El `(dd.mm.aaaa)` tiene semántica NO
 * verificada (R7) ⇒ se DESCARTA, jamás se renderiza como fecha. Fallback =
 * literal completo tal como vino (honesto, nunca null si hay literal).
 */
const GRADOS_CONOCIDOS: Array<{ prefijo: string; grado: string }> = [
  { prefijo: "suma", grado: "Suma" },
  { prefijo: "simple", grado: "Simple" },
  { prefijo: "discusion inmediata", grado: "Discusión inmediata" },
  { prefijo: "discusión inmediata", grado: "Discusión inmediata" },
];

export function gradoUrgencia(descripcion: string | null): string | null {
  if (descripcion === null) return null;
  const sinParentesis = descripcion.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const normalizado = sinParentesis.toLowerCase();
  for (const { prefijo, grado } of GRADOS_CONOCIDOS) {
    if (normalizado.startsWith(prefijo)) return grado;
  }
  // WR-17: el fallback devolvía `descripcion` COMPLETO, es decir CON el
  // paréntesis que R7 declara de semántica no verificada — un literal no
  // reconocido ("URGENCIA X (04.08.2026)") llegaba al chip incluyendo esa fecha.
  // El fallback honesto es el literal SIN el paréntesis; si el literal era solo
  // un paréntesis (queda ""), se devuelve el original antes que un vacío.
  return sinParentesis || descripcion;
}

/**
 * Cruce L5: por boletín, la urgencia MÁS RECIENTE por `fecha` (P7). Ordenar
 * por GRADO sería un ranking implícito y además fabricaría un hecho —
 * prohibido explícitamente. Desempate en fechas iguales: por orden de
 * aparición en el array de entrada (determinista, NUNCA aleatorio) — el
 * último ítem visto con la fecha máxima gana.
 */
export function urgenciaVigentePorBoletin(
  items: ItemProyecto[],
): Map<string, { grado: string; fecha: string }> {
  const resultado = new Map<string, { grado: string; fecha: string }>();
  for (const it of items) {
    if (!it.boletin || !it.fecha) continue;
    const actual = resultado.get(it.boletin);
    const grado = gradoUrgencia(it.descripcion) ?? it.descripcion ?? "";
    if (!actual || it.fecha >= actual.fecha) {
      resultado.set(it.boletin, { grado, fecha: it.fecha });
    }
  }
  return resultado;
}
