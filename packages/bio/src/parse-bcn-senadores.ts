// parse-bcn-senadores — militancia de senadores desde BCN (SPARQL) → modelo, SIN PII.
//
// Fuente (research VERDICT 2 + mini-spike de vocabulario EN VIVO 2026-07-22):
//   GET https://datos.bcn.cl/sparql  (Accept: application/sparql-results+json)
//   Ontología `bcn-biographies#`. Los predicados de `Militancy` DESCUBIERTOS por el spike
//   (`SELECT DISTINCT ?pred WHERE { ?m a bio:Militancy ; ?pred ?obj }`):
//     - bio:hasPoliticalParty  → URI del partido (rdfs:label = nombre display)
//     - bio:hasBeginning       → recurso Evento con bio:originalDate "YYYY-MM-DD"
//     - bio:hasEnd             → ídem (ausente = militancia vigente)
//   La persona enlaza vía `?person bio:hasMilitancy ?m` (rdfs:label = nombre de la persona).
//   NOTA (research A3): BCN NO expone parlid_senado → el join a la maestra es por NOMBRE
//   determinista (matchDeterminista), fail-closed ante homónimo.
//
// El cliente SPARQL es `fetch` + `JSON.parse` (CERO librería RDF). La query se construye con
// `URLSearchParams` (no interpolación cruda → sin inyección, T-90-INJ). Este parser recibe el
// JSON de sparql-results (o el fixture en tests) y lo mapea; el CLI (90-03) hace el fetch real.
//
// ALLOWLIST: se leen SOLO partido + fechas + nombre (para el match). Ninguna PII (BCN no expone
// RUT/nacimiento en esta consulta; el modelo tampoco los declara → imposible persistirlos).

import { normalizarNombre, type Parlamentario } from "@obs/core";
import { matchDeterminista, confirmar, type EnlaceConfirmado, type MaestraRow } from "@obs/identity";
import type { Militancia } from "./model";

export const BCN_SPARQL_URL = "https://datos.bcn.cl/sparql";

export const BCN_UA = "ObservatorioCongreso360/1.0 (contacto: sanchez.rossi@gmail.com)";

/**
 * Query SPARQL de militancia de senadores. `?person a bio:Senador` acota a la cámara alta;
 * cada militancia expone partido (label), inicio y fin (originalDate). Construida como string
 * y ENVIADA vía URLSearchParams (parse-bcn-senadores no interpola valores de usuario → no hay
 * superficie de inyección; los PREFIX/patrones son constantes).
 */
// CORRECCIÓN LIVE (90-03): NO existe la clase `bio:Senador` — la query original devolvía 0
// bindings. El grafo BCN tipa a las personas como `foaf:Person`; un SENADOR se distingue por
// exponer el predicado `bio:idSenado` (id del portal del Senado = parlid_senado de la maestra).
// Ese id es un JOIN DETERMINISTA a la maestra (más fuerte que el name-match del research A3, que
// queda como fallback). La query filtra `?person bio:idSenado ?idSenado` y lo SELECCIONA.
export const BCN_MILITANCY_QUERY = `PREFIX bio:<http://datos.bcn.cl/ontologies/bcn-biographies#>
PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person ?personLabel ?idSenado ?party ?partyLabel ?beginDate ?endDate WHERE {
  ?person bio:idSenado ?idSenado ; rdfs:label ?personLabel ; bio:hasMilitancy ?m .
  ?m bio:hasPoliticalParty ?party .
  OPTIONAL { ?party rdfs:label ?partyLabel }
  OPTIONAL { ?m bio:hasBeginning ?b . ?b bio:originalDate ?beginDate }
  OPTIONAL { ?m bio:hasEnd ?e . ?e bio:originalDate ?endDate }
}`;

/** Construye la URL de la consulta SPARQL con URLSearchParams (sin inyección — T-90-INJ). */
export function buildSparqlUrl(query: string = BCN_MILITANCY_QUERY, base: string = BCN_SPARQL_URL): string {
  const params = new URLSearchParams({ query, format: "json" });
  return `${base}?${params.toString()}`;
}

// ── Forma mínima de sparql-results JSON que consumimos ─────────────────────────
interface SparqlValue {
  type: string;
  value: string;
}
interface SparqlBinding {
  person?: SparqlValue;
  personLabel?: SparqlValue;
  idSenado?: SparqlValue;
  party?: SparqlValue;
  partyLabel?: SparqlValue;
  beginDate?: SparqlValue;
  endDate?: SparqlValue;
}
export interface SparqlResults {
  results?: { bindings?: SparqlBinding[] };
}

/**
 * Mapa determinista URI→label de partido de BCN (FAIL-CLOSED, Phase 105 / BCN-01).
 *
 * PROBLEMA (caso testigo S1344, Matías Walker): la query BCN pide `?party rdfs:label ?partyLabel`
 * como OPTIONAL; cuando el recurso del partido NO expone `rdfs:label` (ni ningún literal), el
 * parser caía al URI crudo como valor de `partido` → un URI llegaba a PROD como partido.
 *
 * EVIDENCIA (Task 1, 2026-07-26): del crudo R2 `bio/envelope/2026-07-22/1fab3cb0…json`
 * (`senadoresSparql`, el MISMO envelope que 105-02 re-parsea) se enumeraron 27 URIs de partido
 * DISTINCT, corroboradas 1:1 por SPARQL en vivo (`datos.bcn.cl/sparql`). 7 de ellas NO exponen
 * `rdfs:label` en BCN (verificado consultando literales del recurso: cero) — son las que disparaban
 * el bug. Este mapa las cubre con su nombre OFICIAL (registro SERVEL), NO derivado del slug.
 *
 * REGLA LOCKED ("ante la duda, calidad"): una URI que NO esté en este mapa Y sin `rdfs:label` →
 * FAIL-CLOSED: se OMITE la militancia y se REPORTA la URI (`partidosDesconocidos`). El parser
 * JAMÁS deriva el partido del slug del URI (eso es fabricar). Extender este mapa es la vía
 * auditable de cubrir URIs nuevas (con evidencia).
 *
 * Las URIs CON `rdfs:label` en BCN también se incluyen (defensa en profundidad: si BCN dejara de
 * exponer su label en el futuro, el mapa mantiene el dato limpio). El label del mapa NO pisa al
 * `rdfs:label` presente — el happy path usa el label verbatim de la fuente.
 */
export const PARTIDO_URI_A_LABEL: Readonly<Record<string, string>> = Object.freeze({
  // ── 7 URIs SIN rdfs:label en BCN (las que disparaban el bug URI-como-partido) ──
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/movimiento-amarillos-por-chile":
    "Amarillos por Chile",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-convergencia-social":
    "Convergencia Social",
  // Caso testigo S1344 (Matías Walker): el partido "Demócratas".
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-democratas-chile":
    "Partido Demócratas de Chile",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-frente-amplio":
    "Frente Amplio",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-nacional-libertario":
    "Partido Nacional Libertario",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-republicano-de-chile":
    "Partido Republicano de Chile",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-social-cristiano":
    "Partido Social Cristiano",
  // ── URIs CON rdfs:label en BCN (defensa en profundidad; label verbatim = happy path) ──
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/amplitud": "Amplitud",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/evopoli": "Partido Evolución Política",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/federacion-regionalista-verde-social":
    "Federación Regionalista Verde Social",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/independiente": "Independiente",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/movimiento-amplio-social":
    "Movimiento Amplio Social",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-amplio-de-izquierda-socialista":
    "Partido Amplio de Izquierda Socialista",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-comunista-de-chile":
    "Partido Comunista de Chile",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-democrata-cristiano":
    "Partido Demócrata Cristiano",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-humanista": "Partido Humanista",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-liberal-de-chile":
    "Partido Liberal de Chile",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-pais-progresista":
    "País Progresista",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-por-la-democracia":
    "Partido Por la Democracia",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-radical-socialdemocrata":
    "Partido Radical Socialdemócrata",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-regionalista-de-los-independientes":
    "Partido Regionalista de los Independientes",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-renovacion-nacional":
    "Partido Renovación Nacional",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-socialista-de-chile":
    "Partido Socialista de Chile",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-union-democrata-independiente":
    "Partido Unión Demócrata Independiente",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/revolucion-democratica":
    "Revolución Democrática",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/union-de-centro-centro":
    "Unión de Centro-Centro",
  "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/union-de-centro-centro-progresista":
    "Unión de Centro-Centro Progresista",
});

/**
 * Resuelve el partido de un binding FAIL-CLOSED (Phase 105 / BCN-01):
 *  (1) `rdfs:label` presente y no vacío → ese label VERBATIM (happy path — el dato de la fuente).
 *  (2) label ausente → busca el URI (`party.value`) en el mapa determinista → su label legible.
 *  (3) URI ausente del mapa (o `party.value` vacío) → `null` = NO resoluble: el caller OMITE la
 *      militancia y ACUMULA la URI en el reporte. JAMÁS deriva del slug ni emite el URI crudo.
 * Devuelve `{ label }` cuando resuelve, o `{ uriDesconocida }` cuando NO (para el reporte).
 */
export function resolverPartido(
  b: SparqlBinding,
): { label: string; uriDesconocida?: undefined } | { label: null; uriDesconocida: string | null } {
  const label = b.partyLabel?.value?.trim();
  if (label) return { label }; // (1) happy path: label verbatim de la fuente
  const uri = b.party?.value?.trim() ?? "";
  if (uri === "") return { label: null, uriDesconocida: null }; // sin URI → no resoluble
  const mapeado = PARTIDO_URI_A_LABEL[uri];
  if (mapeado) return { label: mapeado }; // (2) URI conocida → label del mapa
  return { label: null, uriDesconocida: uri }; // (3) fail-closed: reportar la URI, jamás fabricar
}

/** Alias corto del partido a partir del label (últimas iniciales significativas, fallback label). */
function aliasDePartido(label: string): string {
  const stop = new Set(["de", "la", "el", "los", "las", "por", "y", "del", "chile"]);
  const iniciales = label
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stop.has(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return iniciales.length >= 2 ? iniciales : label;
}

/** Militancia mapeada + persona (nombre BCN) para el join por nombre. */
export interface SenadorMilitancia {
  /** Nombre de la persona según BCN (rdfs:label) — para el match determinista por nombre. */
  personaNombre: string;
  /** nombre_normalizado (materno-less) derivado del label — clave del match. */
  nombreNormalizado: string;
  /** URI de persona de BCN (trazabilidad; NO se persiste como identidad). */
  personaUri: string;
  /** id del portal del Senado (= parlid_senado de la maestra). JOIN determinista si presente. */
  parlidSenado: string | null;
  partido: string;
  partidoAlias: string;
  desde: string;
  hasta: string | null;
}

/** Resultado del mapeo con el reporte de URIs de partido NO resolubles (fail-closed). */
export interface ParseSenadoresResult {
  militancias: SenadorMilitancia[];
  /** URIs de partido SIN `rdfs:label` y AUSENTES del mapa determinista → omitidas (jamás fabricadas). */
  partidosDesconocidos: string[];
}

/**
 * Mapea el JSON de sparql-results a militancias de senadores + REPORTA las URIs de partido no
 * resolubles (Phase 105 / BCN-01). Allowlist: partido + fechas + nombre. Una militancia sin
 * `beginDate` se salta (CR-01); sin `endDate` = vigente (hasta null). NO toca PII.
 *
 * RESOLUCIÓN DE PARTIDO FAIL-CLOSED (`resolverPartido`): `rdfs:label` presente → verbatim; ausente
 * pero URI en el mapa determinista → label legible; URI desconocida → se OMITE la militancia y la
 * URI se acumula en `partidosDesconocidos`. JAMÁS emite un URI como partido ni deriva del slug.
 */
export function parseBcnSenadoresConReporte(json: SparqlResults): ParseSenadoresResult {
  const bindings = json.results?.bindings ?? [];
  const out: SenadorMilitancia[] = [];
  const desconocidos = new Set<string>();
  for (const b of bindings) {
    const personLabel = b.personLabel?.value?.trim();
    if (!personLabel) continue; // sin nombre → no mapeable
    // Resolución de partido fail-closed: sin label + URI fuera del mapa → omite + reporta la URI.
    const resuelto = resolverPartido(b);
    if (resuelto.label == null) {
      if (resuelto.uriDesconocida) desconocidos.add(resuelto.uriDesconocida);
      continue; // fail-closed: JAMÁS emite el URI ni deriva del slug
    }
    const partido = resuelto.label;
    // CR-01 (fail-loud): `desde` alimenta `date NOT NULL` (0059) y es parte de la clave natural. Una
    // Militancy BCN sin `bio:hasBeginning` → `desde` vacío → NO persistible (abortaría el upsert del
    // lote). Se SALTA (contrato explícito): la degradación se declara, no se defaultea a "".
    const desde = b.beginDate?.value?.trim();
    if (!desde) continue; // BCN Militancy sin hasBeginning → sin desde → no persistible
    const { nombre_normalizado } = normalizarNombre({ libre: personLabel });
    out.push({
      personaNombre: personLabel,
      nombreNormalizado: nombre_normalizado,
      personaUri: b.person?.value ?? "",
      parlidSenado: b.idSenado?.value?.trim() || null,
      partido,
      partidoAlias: aliasDePartido(partido),
      desde,
      hasta: b.endDate?.value?.trim() ? b.endDate.value.trim() : null,
    });
  }
  return { militancias: out, partidosDesconocidos: [...desconocidos] };
}

/**
 * Mapea el JSON de sparql-results a militancias de senadores (allowlist: partido + fechas +
 * nombre). Forma delgada que DELEGA en `parseBcnSenadoresConReporte` y devuelve solo el array
 * (contrato retro-compatible con `run-bio.ts`/`enlazarSenadoresPorParlid` y tests existentes). El
 * reporte de URIs desconocidas se consume vía `parseBcnSenadoresConReporte`.
 */
export function parseBcnSenadores(json: SparqlResults): SenadorMilitancia[] {
  return parseBcnSenadoresConReporte(json).militancias;
}

/** Resultado del enlace: militancias con FK confirmado + los nombres sin match (para reporte). */
export interface EnlaceSenadoresResult {
  militancias: Militancia[];
  /** FKs confirmados por nombre (para actualizar parlamentario.partido). */
  confirmados: EnlaceConfirmado[];
  /** Nombres BCN sin match único (fail-closed): quedan sin enlazar. */
  sinMatch: string[];
}

/**
 * Enlaza las militancias de BCN a la maestra por NOMBRE determinista (research A3: BCN no
 * expone parlid_senado). FAIL-CLOSED: matchDeterminista confirma SOLO con nombre único en
 * (cámara, periodo); homónimo/sin-candidato → skip + sinMatch, JAMÁS fabrica FK.
 *
 * La cámara del Senado en la maestra es "senado" (@obs/core Camara).
 */
export function enlazarSenadores(
  senMilitancias: SenadorMilitancia[],
  maestra: MaestraRow[],
  opts: { periodo: string; origen: string; fechaCaptura: string; enlace: string },
): EnlaceSenadoresResult {
  const militancias: Militancia[] = [];
  const confirmados: EnlaceConfirmado[] = [];
  const confirmadoPorNombre = new Map<string, EnlaceConfirmado>();
  const sinMatch = new Set<string>();

  for (const m of senMilitancias) {
    let enlace = confirmadoPorNombre.get(m.nombreNormalizado) ?? null;
    if (enlace == null) {
      const res = matchDeterminista(
        { nombreNormalizado: m.nombreNormalizado, camara: "senado", periodo: opts.periodo },
        maestra,
      );
      if (res.estado === "confirmado") {
        enlace = confirmar(res.id);
        confirmadoPorNombre.set(m.nombreNormalizado, enlace);
        confirmados.push(enlace);
      } else {
        sinMatch.add(m.personaNombre);
        continue; // fail-closed: sin match único → no se persiste militancia
      }
    }
    militancias.push({
      parlamentarioId: enlace.parlamentarioId,
      partido: m.partido,
      partidoAlias: m.partidoAlias,
      desde: m.desde,
      hasta: m.hasta,
      // BCN no da un "corte" limpio; `esActual` = militancia sin fin (hasta null). El runner
      // refina la actual por el partido vigente si aplica; aquí honest-state por FechaTermino.
      esActual: m.hasta == null,
      origen: opts.origen,
      fechaCaptura: opts.fechaCaptura,
      enlace: opts.enlace,
    });
  }

  return { militancias, confirmados, sinMatch: [...sinMatch] };
}

/**
 * Enlaza las militancias de BCN a la maestra por `parlid_senado` DETERMINISTA (corrección LIVE
 * 90-03: BCN SÍ expone `bio:idSenado` en esta consulta → join exacto, más fuerte que el
 * name-match). FAIL-CLOSED: confirma SOLO si el parlid empata con EXACTAMENTE una fila de la
 * maestra; 0 o 2+ → skip + sinMatch (JAMÁS fabrica FK). Las militancias sin `parlidSenado` (BCN
 * no lo trajo para esa persona) caen al `sinMatch` — la degradación se DECLARA, no se defaultea.
 */
export function enlazarSenadoresPorParlid(
  senMilitancias: SenadorMilitancia[],
  maestra: MaestraRow[],
  opts: { origen: string; fechaCaptura: string; enlace: string },
): EnlaceSenadoresResult {
  const militancias: Militancia[] = [];
  const confirmados: EnlaceConfirmado[] = [];
  const confirmadoPorParlid = new Map<string, EnlaceConfirmado>();
  const sinMatch = new Set<string>();

  // Índice parlid_senado → id de la maestra (ambiguo si dos filas lo comparten).
  const porParlid = new Map<string, string>();
  for (const p of maestra) {
    if (p.parlid_senado != null && p.parlid_senado !== "") {
      porParlid.set(p.parlid_senado, porParlid.has(p.parlid_senado) ? "__AMBIGUO__" : p.id);
    }
  }

  for (const m of senMilitancias) {
    if (m.parlidSenado == null) {
      sinMatch.add(m.personaNombre); // BCN no trajo idSenado → no enlazable por parlid
      continue;
    }
    let enlace = confirmadoPorParlid.get(m.parlidSenado) ?? null;
    if (enlace == null) {
      const id = porParlid.get(m.parlidSenado);
      if (id == null || id === "__AMBIGUO__") {
        sinMatch.add(`SEN:${m.parlidSenado}`); // 0 o 2+ → fail-closed
        continue;
      }
      enlace = confirmar(id);
      confirmadoPorParlid.set(m.parlidSenado, enlace);
      confirmados.push(enlace);
    }
    militancias.push({
      parlamentarioId: enlace.parlamentarioId,
      partido: m.partido,
      partidoAlias: m.partidoAlias,
      desde: m.desde,
      hasta: m.hasta,
      esActual: m.hasta == null,
      origen: opts.origen,
      fechaCaptura: opts.fechaCaptura,
      enlace: opts.enlace,
    });
  }

  return { militancias, confirmados, sinMatch: [...sinMatch] };
}

/** Reexport util para el runner: normaliza el nombre de una fila de maestra (por conveniencia). */
export function nombreMaestra(p: Parlamentario): string {
  return normalizarNombre({
    libre: [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" "),
  }).nombre_normalizado;
}
