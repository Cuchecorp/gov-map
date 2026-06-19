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
SELECT ?decl ?fecha ?declaranteLabel ?tipoLabel ?cargo ?organismo WHERE {
  ?p a ip:Persona ; rdfs:label ?declaranteLabel ; ip:declara ?decl .
  ?decl ip:fechaDeclaracion ?fecha .
  OPTIONAL { ?decl ip:tipoDeclaracion ?tipo . ?tipo rdfs:label ?tipoLabel }
  OPTIONAL { ?decl ip:poseeCargo ?cargo }
  OPTIONAL { ?decl ip:organismoFuente ?organismo }
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
