/**
 * RECURSO NO-HUMANO (115-03, acciones A-3/A-4/A-5 de `115-VEREDICTO.md`).
 *
 * Módulo COMPARTIDO — single-source de la leyenda y del predicado. Vive en `lib/` y no
 * en `components/provenance-badge.tsx` por una razón dura: `timeline-event.tsx` debe
 * consumirlos, y el source-scan SC7 (`timeline-view.test.tsx:250-253`) PROHÍBE que el
 * evento del timeline importe nada de `provenance-badge` (invariante "0 badges por
 * evento"). Un módulo neutro satisface a ambos sin duplicar el string ni el predicado
 * — que duplicados derivarían en silencio (CR-01/WR-02 de la review de fase).
 *
 * `provenance-badge.tsx` los RE-EXPORTA para no romper los imports existentes.
 *
 * Hay destinos oficiales para los que NO existe una página de consulta derivable con
 * los datos en mano: `opendata.camara.cl/...getVotaciones_Boletin` exige un `prmID`
 * que no acompaña a `tramitacion_evento` ni a `votacion` (A-3, 3.797 filas — la
 * población MAYOR de la fase, y vive en el timeline); `web-back.senado.cl/api/*` y los
 * `/wspublico/*` sin parámetro de fila entregan JSON/XML a una máquina, y su
 * `?limit=100` es paginación, no identidad (A-4); `datos.cplt.cl/sparql` recibe una
 * consulta persistida por la INGESTA, deuda registrada aparte (A-5). En vez de fabricar
 * una URL humana o de callar, se DECLARA la limitación.
 *
 * El copy describe el FORMATO en que la fuente publica el dato. JAMÁS su intención: que
 * un organismo publique un servicio de datos no significa que oculte, esconda ni se
 * niegue a publicar nada (el carril LINK-EXT de `anti-insinuacion-guard.test.ts` caza
 * ese vocabulario, y verifica que ESTA leyenda esté limpia importándola de AQUÍ).
 */
export const LEYENDA_RECURSO_NO_HUMANO =
  "La fuente oficial publica este dato como servicio de datos, no como página de consulta.";

/**
 * `true` si el destino es un servicio de datos oficial sin página humana derivable.
 *
 * Lista CERRADA derivada de la muestra live de `115-MUESTRA.json` (§2 del veredicto),
 * decidida SIEMPRE por host + path, NUNCA por substring suelto del string completo: el
 * literal "wspublico" en el query de otro host no debe declarar nada. Si la URL no
 * parsea, se devuelve `false` — se declara sólo lo que se puede probar.
 *
 * IN-05: los paths se comparan por SEGMENTO (`=== "/api"` o `startsWith("/api/")`), no
 * por `includes`, para que `/docs/sparql-manual` no case y `…/api?x=1` sí.
 */
export function esServicioDeDatos(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const bajo = (seg: string) => path === seg || path.startsWith(`${seg}/`);
    // A-3: los web services de la Cámara (`*.asmx`) — el host entero es de datos.
    if (host === "opendata.camara.cl") return true;
    // A-4: la API del portal del Senado (paginación, sin identidad de fila).
    if (host === "web-back.senado.cl" && bajo("/api")) return true;
    // A-4: los endpoints WS del Senado que no son la ficha humana.
    if (host === "tramitacion.senado.cl" && bajo("/wspublico")) return true;
    // A-5: el endpoint SPARQL del Consejo para la Transparencia.
    if (host === "datos.cplt.cl" && bajo("/sparql")) return true;
  } catch {
    // URL malformada → no se afirma nada sobre ella.
  }
  return false;
}
