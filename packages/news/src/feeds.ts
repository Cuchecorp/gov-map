// feeds.ts — set de feeds RSS de prensa CONGELADO (D-132-A, 132-CONTEXT.md).
//
// D-132-A: Google News RSS Search fue ADJUDICADO y DESCARTADO: `news.google.com/robots.txt`
// prohíbe `/rss/` para todo User-Agent (Disallow: / sin Allow). El set final son los 5 medios
// DIRECTOS con RSS 2.0 verificado vivo (HTTP 200) por 132-RESEARCH.md (2026-08-05):
//   biobiochile, cooperativa, latercera, lacuarta (los 4 de ICS) + ex-ante.
//
// Agregar un feed nuevo exige verificar robots.txt (allow) + RSS vivo (HTTP 200) PRIMERO —
// jamás agregar por analogía. JAMÁS agregar un host `google.com`/`news.google.com`: la
// aserción anti-Google de feeds.test.ts y NEWS_HOSTS lo prueban por comportamiento.

export interface FeedDef {
  readonly slug: string;
  /**
   * Nombre DISPLAY del medio ("La Tercera") — SOLO para logs/mensajes humanos. JAMÁS pasarlo a
   * `noticia.outlet`: `model.ts` y `0084_noticia.sql` declaran esa columna como SLUG (WR-04). El
   * nombre `display` (no `outlet`) existe para que ningún call-site pueda confundir ambos.
   */
  readonly display: string;
  readonly url: string;
}

/** Los 5 feeds directos congelados (D-132-A). Object.freeze — mutarlos exige un nuevo plan. */
export const FEEDS: readonly FeedDef[] = Object.freeze([
  Object.freeze({
    slug: "biobiochile",
    display: "BioBioChile",
    url: "https://www.biobiochile.cl/static/feed-rss",
  }),
  Object.freeze({
    slug: "cooperativa",
    display: "Cooperativa",
    url: "https://www.cooperativa.cl/noticias/site/tax/port/all/rss_3_158__1.xml",
  }),
  Object.freeze({
    slug: "latercera",
    display: "La Tercera",
    url: "https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml",
  }),
  Object.freeze({
    slug: "lacuarta",
    display: "La Cuarta",
    url: "https://www.lacuarta.com/arc/outboundfeeds/rss/?outputType=xml",
  }),
  Object.freeze({
    slug: "exante",
    display: "Ex-Ante",
    url: "https://www.ex-ante.cl/feed/",
  }),
]);

/** Hosts exactos de los 5 feeds — congelados en el mismo orden que FEEDS. */
export const NEWS_HOSTS: readonly string[] = Object.freeze(
  FEEDS.map((f) => new URL(f.url).host),
);
