// prefiltro-lexico.ts — pre-filtro léxico legislativo determinista, recall-first (D-05/D-06, 132-04).
//
// PURO: cero red, cero DB, cero modelo de lenguaje (T-132-11/T-132-24). Recall-first
// (D-06): ante ambigüedad, PASA — un falso negativo pierde la noticia PARA SIEMPRE (nadie
// vuelve a scrapear el feed del día pasado); un falso positivo lo filtra el clasificador
// de la fase 135, que sí tiene presupuesto de cómputo IA. PROHIBIDO podar el vocabulario para ajustar
// ninguna métrica (tasa de paso, recall medido, lo que sea): si una tasa no cuadra, se
// corrige el MATCHING (p.ej. un bug de subcadena) o se documenta la tasa tal cual — jamás
// se quitan términos del vocabulario para forzarla a bajar.

/**
 * Vocabulario legislativo congelado (D-05). Términos ya foldeados (sin tildes,
 * minúsculas) porque el matching ocurre sobre texto foldeado — ver `fold()`.
 * Mutar esta lista exige un nuevo plan (recall-first: solo se AMPLÍA, nunca se poda).
 */
export const VOCABULARIO_LEGISLATIVO: readonly string[] = Object.freeze([
  "proyecto de ley",
  "boletin",
  "sala",
  "comision",
  "votacion",
  "indicacion",
  "veto",
  "urgencia",
  "mocion",
  "mensaje",
  "tribunal constitucional",
  "tramitacion",
  "promulgacion",
  "senado",
  "senador",
  "senadora",
  "camara de diputados",
  "diputado",
  "diputada",
  "congreso",
  "ley",
  "parlamentario",
  "parlamentaria",
  "legislativo",
  "legislativa",
  "quorum",
  "reforma",
  "constitucional",
  "despacha a ley",
  "promulga",
]);

/** Límite de truncado de la descripción antes del matching (chars, post-despojo/fold). */
const LIMITE_DESCRIPCION = 600;

/** Frontera de palabra: el texto ya viene foldeado a ascii+lower. */
const FRONTERA = "[^a-z0-9]";

function escaparRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Patrones de frontera de palabra compilados UNA SOLA VEZ a nivel de módulo (uno por
 * término de `VOCABULARIO_LEGISLATIVO`), para que el filtro siga siendo barato sobre
 * cientos de ítems por corrida. Los términos multipalabra (`proyecto de ley`) usan el
 * mismo patrón: el espacio interno es literal.
 */
const PATRONES: readonly { termino: string; re: RegExp }[] = Object.freeze(
  VOCABULARIO_LEGISLATIVO.map((termino) => ({
    termino,
    re: new RegExp(`(^|${FRONTERA})${escaparRegExp(termino)}(${FRONTERA}|$)`),
  })),
);

/**
 * Elimina `<script>...</script>` y `<style>...</style>` CON su contenido (T-132-11:
 * un término legislativo dentro de un script/estilo NUNCA debe contar), luego el resto
 * de tags, decodifica entidades básicas y colapsa espacios.
 */
export function despojarHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fold: NFD → strip diacríticos → lower → colapsar espacios (misma forma que packages/core/src/nombre.ts). */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Longitud del término más largo del vocabulario (en chars, ya foldeado) — el margen
 * de corte se DERIVA de esto (WR-13), nunca de un número mágico, para que ampliar el
 * vocabulario más adelante no reintroduzca el bug de truncado a mitad de palabra.
 */
const MARGEN_TRUNCADO = Math.max(...VOCABULARIO_LEGISLATIVO.map((t) => t.length));

/**
 * Trunca `texto` a `LIMITE_DESCRIPCION + MARGEN_TRUNCADO` chars y limpia la cola parcial
 * (`\S*$`) para no dejar un fragmento de palabra colgando en la frontera de corte real
 * (WR-13, 132-11, D-06 recall-first). Cortar en seco a `LIMITE_DESCRIPCION` puede partir
 * un término del vocabulario a la mitad y fabricar un falso negativo — pérdida permanente
 * de la noticia. El margen se deriva de `VOCABULARIO_LEGISLATIVO` (nunca un número mágico),
 * así que ampliar el vocabulario no reintroduce el bug de truncado a mitad de palabra.
 * Texto más corto que el límite se devuelve intacto (`slice`/`replace` son no-op).
 *
 * D-133-J1: compartida entre este pre-filtro y `eval/entrada-llm.ts` (plan 133-04) — para
 * que el golden set nunca cite un término que quedó fuera del input real del clasificador,
 * las dos etapas truncan con la MISMA función, no con una constante replicada.
 *
 * 133-04 / Rule 1 (auto-fix): la extracción reveló que el `.replace(/\S*$/, "")` corría
 * de forma incondicional incluso cuando `texto` no excedía el límite — arrancando la
 * última palabra de CUALQUIER descripción corta (el input real, ya despojado/foldeado,
 * nunca termina en espacio, así que el bug afectaba el 100% de las descripciones bajo el
 * límite en producción). Se guarda: el `.replace` solo corre cuando el `slice` realmente
 * truncó. Diff-cero preservado para el caso de truncado real (el único que la suite
 * preexistente ejercita); el caso corto ahora se devuelve intacto, tal como exige
 * `<behavior>` de 133-04-PLAN.md Task 1.
 */
export function truncarDescripcion(texto: string): string {
  const limite = LIMITE_DESCRIPCION + MARGEN_TRUNCADO;
  if (texto.length <= limite) return texto;
  return texto.slice(0, limite).replace(/\S*$/, "");
}

/**
 * Helper de solo lectura para tests: el índice de corte real (`LIMITE_DESCRIPCION +
 * MARGEN_TRUNCADO`), derivado en runtime del vocabulario vigente. Las constantes siguen
 * privadas del módulo — esto expone únicamente el valor derivado, nunca los nombres, para
 * que un fixture de test jamás hardcodee 615/23/623.
 */
export function limiteTruncadoParaTests(): number {
  return LIMITE_DESCRIPCION + MARGEN_TRUNCADO;
}

function construirTexto(titulo: string, descripcion?: string | null): string {
  const t = fold(despojarHtml(titulo));
  const dFold = fold(despojarHtml(descripcion ?? ""));
  const d = truncarDescripcion(dFold);
  return `${t} ${d}`;
}

/**
 * `true` si el título/descripción contiene AL MENOS UN término del vocabulario
 * legislativo con frontera de palabra completa (nunca por subcadena — `String.includes`
 * está PROHIBIDO en este matching, ver PATRONES). Recall-first (D-06): un titular
 * ambiguo que solo menciona un término genérico ("ministro") pasa igual; lo filtra el
 * clasificador de la fase 135.
 */
export function esLegislativo(titulo: string, descripcion?: string | null): boolean {
  const texto = construirTexto(titulo, descripcion);
  return PATRONES.some(({ re }) => re.test(texto));
}

/**
 * Qué términos del vocabulario dispararon el match — hace depurable la tasa de paso;
 * `carga-run.ts` (plan 05) es quien registra el descarte (D-07), este módulo solo expone
 * el dato.
 */
export function terminosQueMatchean(titulo: string, descripcion?: string | null): string[] {
  const texto = construirTexto(titulo, descripcion);
  return PATRONES.filter(({ re }) => re.test(texto)).map(({ termino }) => termino);
}
