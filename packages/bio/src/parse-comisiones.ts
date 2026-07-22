// parse-comisiones — catálogo de comisiones + membresía, fail-closed por DIPID.
//
// VEREDICTO DEL SPIKE (Open Question 1, curl-first EN VIVO 2026-07-22, rate-limit 2-3s, UA
// identificatorio):
//   ✗ opendata WSComisiones (camara.cl y congreso.cl) → 302 /mantencion.html (confirmado caído).
//   ✗ citaciones_semana.aspx → 200 pero SOLO lista sesiones/comisiones, SIN integrantes.
//   ✓ ELEGIDA: www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx (200, catálogo)
//     → cada comisión enlaza a `integrantes.aspx?prmID=<N>` (200), que SÍ lista los integrantes,
//       cada uno con `<a href=".../diputados/detalle/mociones.aspx?prmID=<DIPID>">Sr. Nombre</a>`
//       seguido de `<strong>Cargo</strong>`. El DIPID = id_diputado_camara de la maestra → la
//       membresía se enlaza FAIL-CLOSED por DIPID exacto (no name-match). El "Abogado Secretario"
//       (staff) NO trae DIPID → se excluye por construcción (solo se mapean anclas con DIPID).
//   www.camara.cl tiene WAF → el fetch va por curl-first (--html-file) en el CLI (research
//   Pitfall 5). Este parser es puro: recibe el HTML crudo y extrae catálogo + membresía.
//
// DEGRADACIÓN HONESTA: si en la corrida LIVE `integrantes.aspx` no trajera integrantes con
// DIPID (fuente cambió), el runner pasa `integrantesPorComision` vacío → se emite SOLO el
// catálogo, `comision_membresia` queda vacía (NUNCA se inventa membresía).

import * as cheerio from "cheerio";

export const COMISIONES_CATALOGO_URL =
  "https://www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx";

export function integrantesUrl(prmId: string): string {
  return `https://www.camara.cl/legislacion/comisiones/integrantes.aspx?prmID=${prmId}`;
}

/** Una comisión del catálogo (nombre + su prmID para pedir integrantes). */
export interface ComisionCatalogo {
  /** Nombre crudo de la comisión. */
  nombre: string;
  /** prmID de la comisión en camara.cl (para `integrantes.aspx?prmID=`). */
  prmId: string;
  /** Cámara (este parser cubre la Cámara de Diputados). */
  camara: "diputados";
  /** Tipo crudo (permanente por defecto en este catálogo). */
  tipo: string;
}

/** Un integrante de una comisión, SIEMPRE con DIPID (clave de match fail-closed). */
export interface IntegranteComision {
  /** DIPID = id_diputado_camara (única clave de enlace; jamás name-match). */
  dipid: string;
  /** Cargo crudo (Presidente/Integrante/...), o null. */
  cargo: string | null;
}

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Parsea el catálogo `comisiones_permanentes.aspx` a `ComisionCatalogo[]`. Cada fila trae un
 * `<a href="integrantes.aspx?prmID=N">Nombre</a>` — el nombre y el prmID salen de ahí. Filas de
 * la misma comisión (link "ver") se dedupean por prmID.
 */
export function parseComisionesCatalogo(html: string, tipo = "permanente"): ComisionCatalogo[] {
  const $ = cheerio.load(html);
  const porPrmId = new Map<string, ComisionCatalogo>();
  $('a[href*="integrantes.aspx?prmID="]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = /integrantes\.aspx\?prmID=(\d+)/i.exec(href);
    if (!m) return;
    const prmId = m[1]!;
    const nombre = normWs($(el).text());
    // El link "ver" (ícono) no trae nombre → solo registramos filas con nombre textual.
    if (nombre.length < 3) return;
    if (!porPrmId.has(prmId)) {
      porPrmId.set(prmId, { nombre, prmId, camara: "diputados", tipo });
    }
  });
  return [...porPrmId.values()];
}

/**
 * Parsea `integrantes.aspx?prmID=N` a `IntegranteComision[]` FAIL-CLOSED: SOLO extrae anclas
 * `mociones.aspx?prmID=<DIPID>` (los diputados). El staff (Abogado Secretario) no trae DIPID →
 * se excluye por construcción. El cargo es el `<strong>` que sigue al nombre en el bloque
 * `.integrante`. Dedupe por DIPID.
 */
export function parseIntegrantes(html: string): IntegranteComision[] {
  const $ = cheerio.load(html);
  const porDipid = new Map<string, IntegranteComision>();

  // Acota a la sección de integrantes (evita capturar links de "mociones" de la navegación).
  $("article.integrante, .integrante").each((_, art) => {
    const $art = $(art);
    const a = $art.find('a[href*="mociones.aspx?prmID="]').first();
    const href = a.attr("href") ?? "";
    const m = /mociones\.aspx\?prmID=(\d+)/i.exec(href);
    if (!m) return; // sin DIPID → no es diputado (staff) → excluido
    const dipid = m[1]!;
    const cargoRaw = normWs($art.find("strong").first().text());
    const cargo = cargoRaw.length > 0 && cargoRaw.length < 60 ? cargoRaw : null;
    if (!porDipid.has(dipid)) {
      porDipid.set(dipid, { dipid, cargo });
    }
  });

  return [...porDipid.values()];
}
