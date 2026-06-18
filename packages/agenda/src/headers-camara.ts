// headers-camara — header-set de navegador COMPLETO para pasar el bot-management de
// Cloudflare que protege `www.camara.cl` (T-06-07).
//
// CONFIRMADO LIVE (06-CONTEXT / 06-01): un User-Agent simple (curl/fetch) recibe HTTP 403
// de Cloudflare; la petición pasa SOLO con el header-set de navegador completo
// (`Sec-Ch-Ua*`, `Sec-Fetch-*`, `Accept-Language`, `Upgrade-Insecure-Requests`). El UA
// mantiene el sufijo identificatorio `Bot-Ciudadano/1.0` (ingesta respetuosa, PROJECT.md)
// sin romper el fingerprint (Cloudflare admite el UA Chrome + comentario).
//
// El conector de Cámara los envía verbatim a `fetcher.get({ url, headers })`. El header-set
// vive en UN solo lugar (este módulo) para no duplicarlo entre conector y tests.

/** Header-set de navegador anti-Cloudflare para `www.camara.cl` (verbatim del RESEARCH). */
export const BROWSER_HEADERS_CAMARA: Readonly<Record<string, string>> = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
});
