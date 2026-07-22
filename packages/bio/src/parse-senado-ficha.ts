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
/** ¿La etiqueta es un rótulo de partido/militancia? (normalizada, sin ":" ni espacios de sobra). */
function esEtiquetaPartido(etiqueta: string): boolean {
  const e = etiqueta.replace(/[:\s]+$/, "");
  return /^partido( pol[ií]tico)?$/.test(e) || /^militancia$/.test(e);
}

/**
 * ¿El texto parece un NOMBRE de partido y no otro rótulo/decoy?
 * WR-05: rechaza vacíos, valores demasiado largos, y strings que a su vez lucen como etiquetas
 * ("(sin especificar)", "Partido político", cadenas que terminan en ":") — prefiere null antes que
 * un best-guess del sibling arbitrario.
 */
function pareceNombrePartido(val: string): boolean {
  if (val.length === 0 || val.length >= 120) return false;
  if (/[:]$/.test(val)) return false; // otro rótulo, no un valor
  const bajo = val.toLowerCase();
  if (/(sin especificar|no especificad|independiente\b.*sin)/.test(bajo)) return false;
  if (esEtiquetaPartido(bajo)) return false; // el sibling es OTRA etiqueta "Partido", no el valor
  return true;
}

export function parseSenadoFicha(html: string, parlidSenado: string): FichaSenadorBio {
  const $ = cheerio.load(html);
  let partido: string | null = null;

  // WR-05: SOLO pares estructurados etiqueta/valor — <dt>Partido</dt><dd>X</dd> y
  // <th>Partido</th><td>X</td>. Se abandonan strong/b/span/label sueltos (un "Partido…" decoy en un
  // heading o menú capturaba el sibling arbitrario y fabricaba un partido). El valor debe LUCIR como
  // nombre de partido (pareceNombrePartido); ante cualquier duda → null (honest-state, no fabrica).
  $("dt, th").each((_, el) => {
    if (partido != null) return;
    const etiqueta = normWs($(el).text()).toLowerCase();
    if (!esEtiquetaPartido(etiqueta)) return;
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    // El valor es el par estructural: dd para dt, td para th (mismo nivel, hermano siguiente).
    const sib = tag === "dt" ? $(el).nextAll("dd").first() : $(el).nextAll("td").first();
    if (sib.length === 0) return;
    const val = normWs(sib.text());
    if (pareceNombrePartido(val)) partido = val;
  });

  return { parlidSenado, partido };
}
