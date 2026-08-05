// parse-rss.ts — XML crudo de un feed RSS 2.0 → RssItem[] (Etapa 2, PURO, 132-04).
//
// Analog directo de packages/tramitacion/src/parse-senado-tramitacion.ts: mismo
// `txt()` defensivo, mismo patrón `[].concat` para forzar array de nodo único
// (fast-xml-parser 5.x colapsa `<channel><item>...</item></channel>` con UN solo
// `<item>` a un objeto, no a un array de 1).
//
// Pureza (T-132-10 / criterio de pureza ejecutable en 132-04-PLAN.md): este módulo
// NO importa `fetch` ni hace red. La documentación de URLs de ejemplo va únicamente
// en JSDoc de cabecera, nunca en el cuerpo ejecutable del archivo.
//
// Ejemplos de URL de feeds reales que este parser consume (solo documentación,
// ver packages/news/src/feeds.ts para el set congelado):
//   - https://www.biobiochile.cl/static/feed-rss
//   - https://www.cooperativa.cl/noticias/site/tax/port/all/rss_3_158__1.xml

import { XMLParser } from "fast-xml-parser";
import { RssItemSchema, type RssItem } from "./model";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

/** Copia literal del helper del analog (parse-senado-tramitacion.ts): soporta
 * string, `{ "#text": ... }`, y devuelve null en vacío. NO modificar para casos
 * especiales — ver `leerFuente`/`leerCreator` para eso. */
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (t == null) return null;
    const s = String(t).trim();
    return s.length === 0 ? null : s;
  }
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return ([] as T[]).concat(v as T | T[]);
}

const MESES: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Zonas nombradas de RFC 822 → offset numérico fijo (RFC 822 §5, sin horario de
 * verano: cada nombre mapea a un offset constante, no al offset "actual" de esa
 * zona). WR-12 (132-11): ampliación pura de vocabulario aceptado, ninguna pieza
 * pasa por conversión de tz.
 */
const ZONAS_NOMBRADAS: Record<string, string> = {
  EST: "-0500",
  EDT: "-0400",
  CST: "-0600",
  CDT: "-0500",
  MST: "-0700",
  MDT: "-0600",
  PST: "-0800",
  PDT: "-0700",
};

/**
 * Parsea un `pubDate` RFC 822 ("Wed, 05 Aug 2026 00:41:06 -0400") a ISO 8601
 * preservando el offset ORIGINAL del feed ("2026-08-05T00:41:06-04:00").
 *
 * Deliberadamente NO pasa por `new Date(...).toISOString()`: ese camino SIEMPRE
 * convierte a UTC (sufijo "Z"), lo que descarta el offset original — exactamente
 * el gotcha rector v9.0/v12.0 (normalizar tz fabrica días que no ocurrieron según
 * la fuente). Aquí solo se REFORMATEA el mismo instante con las mismas piezas.
 * LOCKED (WR-12, 132-11): esta función NUNCA debe ganar un `new Date(...).toISOString()`
 * en su camino de construcción del ISO — cualquier ampliación futura de variantes
 * RFC 822 debe seguir el mismo patrón de reformateo literal pieza-por-pieza.
 * Segundos son OPCIONALES (RFC 822 permite `HH:MM` sin segundos → default "00");
 * la hora acepta 1 o 2 dígitos (se normaliza con `padStart` al construir el ISO).
 */
function parsePubDate(raw: string | null): string | null {
  if (raw == null) return null;
  const m = raw.match(
    /^(?:\w+,\s+)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(GMT|UT|Z|[+-]\d{4}|[A-Za-z]{2,3})$/,
  );
  if (!m) return null;
  const [, dd, mesTxt, yyyy, hh, mi, ssRaw, offRaw] = m;
  if (dd == null || mesTxt == null || yyyy == null || hh == null || mi == null || offRaw == null) {
    return null;
  }
  const ss = ssRaw ?? "00";
  const mes = MESES[mesTxt.toLowerCase()];
  if (mes == null) return null;
  let offset: string;
  if (offRaw === "GMT" || offRaw === "UT" || offRaw === "Z") {
    offset = "+00:00";
  } else if (/^[+-]\d{4}$/.test(offRaw)) {
    offset = `${offRaw.slice(0, 3)}:${offRaw.slice(3)}`;
  } else {
    const nombrada = ZONAS_NOMBRADAS[offRaw.toUpperCase()];
    if (nombrada == null) return null;
    offset = `${nombrada.slice(0, 3)}:${nombrada.slice(3)}`;
  }
  const iso = `${yyyy}-${mes}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:${ss}${offset}`;
  // Validar que el instante resultante es un instante real (rechaza fechas imposibles).
  if (Number.isNaN(new Date(iso).getTime())) return null;
  return iso;
}

/** Error tipado del parseo de un feed (XML mal formado). */
export class ParseRssError extends Error {
  constructor(outlet: string, cause: unknown) {
    super(`parseRss: XML mal formado para outlet "${outlet}": ${String(cause)}`);
    this.name = "ParseRssError";
  }
}

/**
 * XML crudo de un feed RSS 2.0 → `RssItem[]` (puro, sin red, sin DB).
 *
 * Los ítems que no validan contra `RssItemSchema` se OMITEN (degradación honesta):
 * un feed con un ítem mal formado no debe tumbar los demás ítems válidos del
 * mismo feed. Los errores de validación se devuelven en `errores[]`.
 */
export function parseRss(
  xml: string,
  outlet: string,
): { items: RssItem[]; errores: string[] } {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (cause) {
    throw new ParseRssError(outlet, cause);
  }

  const raiz = doc as Record<string, unknown>;
  const rss = raiz?.["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  const itemsCrudos = asArray(channel?.["item"] as unknown | unknown[]);

  const items: RssItem[] = [];
  const errores: string[] = [];

  for (const raw of itemsCrudos) {
    const it = raw as Record<string, unknown>;
    const titulo = txt(it["title"]);
    const link = txt(it["link"]);
    const guid = txt(it["guid"]);
    const pubDateRaw = txt(it["pubDate"]);
    const fechaPub = parsePubDate(pubDateRaw);
    const descripcion = txt(it["description"]);

    // WR-12 (132-11): `pubDate` presente pero que NO parsea deja rastro en `errores[]`
    // (hoy se perdía en silencio como `fechaPub: null`, indistinguible del caso "el
    // feed no trae pubDate"). Ausente ⇒ ningún error (no es una anomalía del feed).
    if (pubDateRaw != null && fechaPub == null) {
      errores.push(`pubDate no parseable: "${pubDateRaw}" (outlet=${outlet})`);
    }

    const candidato = {
      titulo: titulo ?? "",
      link: link ?? "",
      guid,
      fechaPub,
      descripcion,
      outlet,
    };

    const parsed = RssItemSchema.safeParse(candidato);
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      errores.push(
        `ítem inválido (outlet=${outlet}, titulo=${JSON.stringify(titulo)}): ${parsed.error.message}`,
      );
    }
  }

  return { items, errores };
}
