// parse-senado-ficha — fallback LOCKED (research VERDICT 2 caveat) para militancia/partido de
// senadores desde la ficha HTML de senado.cl, cheerio, cruzando por `parlid_senado` que la
// maestra YA tiene (a diferencia de BCN, que no lo expone — research A3).
//
// Se usa SOLO si el spike de vocabulario/join de BCN no cierra en la corrida LIVE (90-03). En
// ese caso, la degradación es HONESTA: partido vigente por ficha, sin histórico completo. Aquí
// va el parser puro (HTML → { partido, parlidSenado }); el fetch real y la decisión BCN-vs-ficha
// viven en el runner/CLI.
//
// ALLOWLIST: se lee SOLO el partido y el parlid del enlace; la ficha puede traer PII de contacto
// (teléfono/email de oficina) que NO se mapea. El modelo tampoco la declara.

import * as cheerio from "cheerio";

export interface FichaSenadorBio {
  /** PARLID del Senado (clave de cruce con la maestra). */
  parlidSenado: string;
  /** Partido vigente según la ficha, o null (no fabricar). */
  partido: string | null;
}

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Parsea la ficha HTML de un senador (senado.cl) al partido vigente. `parlidSenado` se pasa
 * explícito (el caller lo conoce de la maestra / de la URL); esta función extrae el partido del
 * cuerpo. Devuelve `partido: null` si no encuentra el campo (honest-state; NO fabrica).
 *
 * La estructura de senado.cl varía; se buscan etiquetas comunes ("Partido", "Militancia").
 * Fallback deliberadamente conservador: ante ambigüedad, null.
 */
export function parseSenadoFicha(html: string, parlidSenado: string): FichaSenadorBio {
  const $ = cheerio.load(html);
  let partido: string | null = null;

  // Patrón 1: pares etiqueta/valor ("Partido: X" o <dt>Partido</dt><dd>X</dd>).
  $("dt, th, strong, b, span, label").each((_, el) => {
    if (partido != null) return;
    const etiqueta = normWs($(el).text()).toLowerCase();
    if (/^partido/.test(etiqueta) || /militancia/.test(etiqueta)) {
      // valor = siguiente celda/sibling con texto.
      const sib = $(el).next();
      const val = normWs(sib.text());
      if (val.length > 0 && val.length < 120) partido = val;
    }
  });

  return { parlidSenado, partido };
}
