// sparql — query builders puros + mapeo SPARQL-JSON → filas planas para @obs/probidad.
//
// El endpoint `https://datos.cplt.cl/sparql` responde GET con `application/sparql-results+json`
// (Virtuoso). Los builders construyen el SPARQL desde un NOMBRE NORMALIZADO escapado (sin input
// crudo de usuario en el string → sin inyección SPARQL, T-12-07). `bindingsToRows` mapea
// `results.bindings` a filas planas leyendo `?.value` de cada binding (NO una lib RDF — JSON.parse
// nativo lo entrega ya como objeto).

// ── Prefijos de la ontología InfoProbidad (verificados LIVE 2026-06-19) ─────────
const PREFIXES = `PREFIX ip: <http://datos.cplt.cl/ontologias/infoprobidad/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

/**
 * Escapa un literal para incrustarlo en un string SPARQL entre comillas dobles. Quita los
 * caracteres de control y escapa `\` y `"` (defensa contra inyección SPARQL — T-12-07). El caller
 * pasa un nombre YA normalizado (minúsculas, sin tildes) — esto es la barrera final.
 */
export function escaparLiteralSparql(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    // quita saltos de línea / tabs / retornos que romperían el string SPARQL
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}

/**
 * Query por NOMBRE (apellido normalizado): trae las declaraciones de los `Persona` cuyo
 * `rdfs:label` CONTIENE el fragmento (candidate fetch coarse; el cruce AUTORITATIVO es
 * `correrPipeline`). Devuelve por fila: la URI del nodo `Declaracion`, la fecha, el nombre crudo
 * del declarante, el label del tipo (resuelto, OQ3) y cargo/organismo crudos.
 */
export function queryDeclaracionesPorNombre(fragmentoNormalizado: string): string {
  const frag = escaparLiteralSparql(fragmentoNormalizado);
  return `${PREFIXES}
SELECT ?decl ?fecha ?declaranteLabel ?tipoLabel ?cargo ?cargoLabel ?organismo ?organismoLabel WHERE {
  ?p a ip:Persona ; rdfs:label ?declaranteLabel ; ip:declara ?decl .
  ?decl ip:fechaDeclaracion ?fecha .
  OPTIONAL { ?decl ip:tipoDeclaracion ?tipo . ?tipo rdfs:label ?tipoLabel }
  OPTIONAL { ?decl ip:poseeCargo ?cargo . OPTIONAL { ?cargo rdfs:label ?cargoLabel } }
  OPTIONAL { ?decl ip:organismoFuente ?organismo . OPTIONAL { ?organismo rdfs:label ?organismoLabel } }
  FILTER( CONTAINS(LCASE(STR(?declaranteLabel)), "${frag}") )
}
ORDER BY DESC(?fecha)`;
}

/** Query de los `BienInmueble` de una declaración (por su URI). Predicados literales de OQ2. */
export function queryBienesInmuebles(declUri: string): string {
  const uri = escaparLiteralSparql(declUri);
  return `${PREFIXES}
SELECT ?bien ?ubicadoEn ?rolAvaluo ?numInscripcion ?fojasInmueble ?anioInmueble ?esSuDomicilio WHERE {
  <${uri}> ip:tieneBien ?bien . ?bien a ip:BienInmueble .
  OPTIONAL { ?bien ip:ubicadoEn ?ubicadoEn }
  OPTIONAL { ?bien ip:rolAvaluo ?rolAvaluo }
  OPTIONAL { ?bien ip:numInscripcion ?numInscripcion }
  OPTIONAL { ?bien ip:fojasInmueble ?fojasInmueble }
  OPTIONAL { ?bien ip:anioInmueble ?anioInmueble }
  OPTIONAL { ?bien ip:esSuDomicilio ?esSuDomicilio }
}`;
}

/** Query de las `Actividad` de una declaración. */
export function queryActividades(declUri: string): string {
  const uri = escaparLiteralSparql(declUri);
  return `${PREFIXES}
SELECT ?act ?objeto ?vinculo ?remunerado ?haceDoceMeses WHERE {
  <${uri}> ip:tieneActividad ?act . ?act a ip:Actividad .
  OPTIONAL { ?act ip:objeto ?objeto }
  OPTIONAL { ?act ip:vinculo ?vinculo }
  OPTIONAL { ?act ip:remunerado ?remunerado }
  OPTIONAL { ?act ip:haceDoceMeses ?haceDoceMeses }
}`;
}

// ── BATCH builders (Phase bienes): N declaraciones por query vía VALUES ?d {…} ──
// Cada builder proyecta `?d` (la URI de la declaración) y `?x` (el nodo del bien) como las DOS
// primeras vars, seguidas de los predicados literales de OQ2 del tipo. El parser agrupa por `?x`
// (un bien) y colecciona cada bien bajo su `?d`. Las URIs se escapan (escaparLiteralSparql) y se
// envuelven en `<>` — sin input crudo de usuario en el string (T-12-07). Los builders single-URI
// de arriba se conservan tal cual.

/** Arma el bloque `VALUES ?d { <uri1> <uri2> … }` con cada URI escapada + envuelta en `<>`. */
function valuesDeclUris(declUris: string[]): string {
  return declUris.map((u) => `<${escaparLiteralSparql(u)}>`).join(" ");
}

/** BATCH de los `BienInmueble` de N declaraciones. `?d` + `?x` primero. */
export function queryBienesInmueblesBatch(declUris: string[]): string {
  const values = valuesDeclUris(declUris);
  return `${PREFIXES}
SELECT ?d ?x ?ubicadoEn ?rolAvaluo ?numInscripcion ?fojasInmueble ?anioInmueble ?esSuDomicilio WHERE {
  VALUES ?d { ${values} }
  ?d ip:tieneBien ?x . ?x a ip:BienInmueble .
  OPTIONAL { ?x ip:ubicadoEn ?ubicadoEn } OPTIONAL { ?x ip:rolAvaluo ?rolAvaluo }
  OPTIONAL { ?x ip:numInscripcion ?numInscripcion } OPTIONAL { ?x ip:fojasInmueble ?fojasInmueble }
  OPTIONAL { ?x ip:anioInmueble ?anioInmueble } OPTIONAL { ?x ip:esSuDomicilio ?esSuDomicilio }
}`;
}

/** BATCH de los `BienMueble` de N declaraciones. `?d` + `?x` primero. */
export function queryBienesMueblesBatch(declUris: string[]): string {
  const values = valuesDeclUris(declUris);
  return `${PREFIXES}
SELECT ?d ?x ?nombreMueble ?descripcion ?modelo ?anioFabricacion ?matricula ?numeroInscripcion ?anioInscripcion ?tonelaje WHERE {
  VALUES ?d { ${values} }
  ?d ip:tieneBien ?x . ?x a ip:BienMueble .
  OPTIONAL { ?x ip:nombreMueble ?nombreMueble } OPTIONAL { ?x ip:descripcion ?descripcion }
  OPTIONAL { ?x ip:modelo ?modelo } OPTIONAL { ?x ip:anioFabricacion ?anioFabricacion }
  OPTIONAL { ?x ip:matricula ?matricula } OPTIONAL { ?x ip:numeroInscripcion ?numeroInscripcion }
  OPTIONAL { ?x ip:anioInscripcion ?anioInscripcion } OPTIONAL { ?x ip:tonelaje ?tonelaje }
}`;
}

/** BATCH de las `Actividad` de N declaraciones. `?d` + `?x` primero. */
export function queryActividadesBatch(declUris: string[]): string {
  const values = valuesDeclUris(declUris);
  return `${PREFIXES}
SELECT ?d ?x ?objeto ?vinculo ?remunerado ?haceDoceMeses WHERE {
  VALUES ?d { ${values} }
  ?d ip:tieneActividad ?x .
  OPTIONAL { ?x ip:objeto ?objeto } OPTIONAL { ?x ip:vinculo ?vinculo }
  OPTIONAL { ?x ip:remunerado ?remunerado } OPTIONAL { ?x ip:haceDoceMeses ?haceDoceMeses }
}`;
}

/** BATCH de los `Pasivo` de N declaraciones. `?d` + `?x` primero. */
export function queryPasivosBatch(declUris: string[]): string {
  const values = valuesDeclUris(declUris);
  return `${PREFIXES}
SELECT ?d ?x ?tipoObligacion ?acreedor ?montoDeuda WHERE {
  VALUES ?d { ${values} }
  ?d ip:tienePasivo ?x .
  OPTIONAL { ?x ip:tipoObligacion ?tipoObligacion } OPTIONAL { ?x ip:acreedor ?acreedor }
  OPTIONAL { ?x ip:montoDeuda ?montoDeuda }
}`;
}

/** BATCH de las `AccionDerecho` de N declaraciones. `?d` + `?x` primero. */
export function queryAccionesDerechosBatch(declUris: string[]): string {
  const values = valuesDeclUris(declUris);
  return `${PREFIXES}
SELECT ?d ?x ?rutJuridica ?cantidadAcciones ?fechaAdquisicion ?esControlador ?gravamenes WHERE {
  VALUES ?d { ${values} }
  ?d ip:tieneAccionDerecho ?x .
  OPTIONAL { ?x ip:rutJuridica ?rutJuridica } OPTIONAL { ?x ip:cantidadAcciones ?cantidadAcciones }
  OPTIONAL { ?x ip:fechaAdquisicion ?fechaAdquisicion } OPTIONAL { ?x ip:esControlador ?esControlador }
  OPTIONAL { ?x ip:gravamenes ?gravamenes }
}`;
}

/** BATCH de los `Valor` de N declaraciones. `?d` + `?x` primero. */
export function queryValoresBatch(declUris: string[]): string {
  const values = valuesDeclUris(declUris);
  return `${PREFIXES}
SELECT ?d ?x ?entidadEmisora ?tipoAccionDerecho ?cantidadRepresenta ?valorPlaza ?paisQueEmite ?fechaAdquisicion ?tipoGravamen WHERE {
  VALUES ?d { ${values} }
  ?d ip:tieneValor ?x .
  OPTIONAL { ?x ip:entidadEmisora ?entidadEmisora } OPTIONAL { ?x ip:tipoAccionDerecho ?tipoAccionDerecho }
  OPTIONAL { ?x ip:cantidadRepresenta ?cantidadRepresenta } OPTIONAL { ?x ip:valorPlaza ?valorPlaza }
  OPTIONAL { ?x ip:paisQueEmite ?paisQueEmite } OPTIONAL { ?x ip:fechaAdquisicion ?fechaAdquisicion }
  OPTIONAL { ?x ip:tipoGravamen ?tipoGravamen }
}`;
}

/** Una fila plana de bindings: var → valor string (o undefined si el binding no estaba). */
export type FilaSparql = Record<string, string | undefined>;

/**
 * Forma mínima de un documento SPARQL-JSON (Virtuoso/SPARQL 1.1 results). `JSON.parse` nativo lo
 * entrega así; no se requiere una librería RDF.
 */
export interface SparqlJson {
  head?: { vars?: string[] };
  results?: {
    bindings?: Array<Record<string, { type?: string; value?: string; datatype?: string }>>;
  };
}

/**
 * Mapea `results.bindings` a filas planas (`var → value`). Una variable ausente en una fila queda
 * `undefined` (la fuente la omitió — NUNCA se fabrica). Puro: no muta la entrada, no hace red.
 * Lanza si la forma no es un documento SPARQL-results (la detección de drift estructural lo usa).
 */
export function bindingsToRows(json: unknown): FilaSparql[] {
  const doc = json as SparqlJson;
  const bindings = doc?.results?.bindings;
  if (!Array.isArray(bindings)) {
    throw new Error(
      "bindingsToRows: la respuesta no tiene results.bindings (forma SPARQL-JSON inesperada — posible drift)",
    );
  }
  return bindings.map((b) => {
    const fila: FilaSparql = {};
    for (const [k, v] of Object.entries(b)) {
      fila[k] = v && typeof v.value === "string" ? v.value : undefined;
    }
    return fila;
  });
}

/**
 * Normaliza una fecha de InfoProbidad (`2026-03-30T00:00:00` dateTime, o `2026-03-30`) a una date
 * ISO `YYYY-MM-DD`. Devuelve null si no parsea (NUNCA fabrica una fecha).
 */
export function fechaPresentacionDe(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  // Toma la parte de fecha de un dateTime; valida con Date.
  const soloFecha = t.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) return null;
  const d = new Date(`${soloFecha}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return soloFecha;
}
