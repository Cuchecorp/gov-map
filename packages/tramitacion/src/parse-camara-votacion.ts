// parse-camara-votacion — XML de votaciones de la Cámara (opendata.camara.cl) → modelo común.
//
// DOS shapes / DOS namespaces distintos (Pitfall 4):
//  1. getVotaciones_Boletin (ns http://tempuri.org/): boletín ESTRUCTURADO (<Boletin>), usa
//     <ID>, <Resultado Codigo>, totales <TotalAfirmativos>/<TotalNegativos>/<TotalAbstenciones>/
//     <TotalDispensados>. Es la fuente de la lista de Votacion[].
//  2. retornarVotacionDetalle (ns ...camaradiputados/v1): voto-a-voto. Usa <Id>, totales
//     <TotalSi>/<TotalNo>/<TotalAbstencion>/<TotalDispensado>, y <Votos><Voto><Diputado><Id>
//     + <OpcionVoto Valor> (Valor 1=Afirmativo→si, 0=En Contra→no).
//
// El boletín se toma del nodo <Boletin> estructurado, NUNCA por regex sobre texto libre
// (Pitfall / T-05-05). Cada Votacion lleva provenance inline (TRAM-09) y se valida con
// VotacionSchema antes de devolver.

import { XMLParser } from "fast-xml-parser";
import { makeProvenance } from "@obs/core";
import { type Seleccion, type Votacion, VotacionSchema } from "./model";
import { parseFechaCL, toIso } from "./fecha";

const ORIGEN = "camara-opendata";
const URL_BOLETIN =
  "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

/** Texto de un nodo: string-no-vacío o null (self-closing → {} / ""). */
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    // fast-xml-parser con atributos: el texto vive en "#text".
    const t = (v as Record<string, unknown>)["#text"];
    if (t == null) return null;
    const s = String(t).trim();
    return s.length === 0 ? null : s;
  }
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * Entero NO negativo de un nodo, distinguiendo "ausente" de "presente pero ilegible" (WR-04).
 *  - nodo ausente/"" → 0 (caso legítimo: la fuente no trae el total).
 *  - entero válido `[0-9]+` → su valor.
 *  - presente PERO no es un entero limpio (p.ej. "1.234" con separador de millar, o un token
 *    no numérico) → `null`: NO se fabrica un "1" silencioso a partir de `Number("1.234")`.
 * El caller decide: hoy mapea null→0 pero conserva la señal para no afirmar un total falso.
 */
function intParse(v: unknown): number | null {
  const s = txt(v);
  if (s == null) return 0; // ausente → 0 legítimo
  if (!/^\d+$/.test(s)) return null; // presente pero ilegible → señal, no un 0/1 fabricado
  return Number(s);
}

/** Entero NO negativo tolerante (mantiene el contrato previo: ilegible→0). */
function intOf(v: unknown): number {
  return intParse(v) ?? 0;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return ([] as T[]).concat(v as T | T[]);
}

/** Voto-a-voto crudo de la Cámara (cruce determinista por Diputado/Id). */
export interface CamaraVotoDetalle {
  /** Id del diputado en la maestra de la Cámara (cruce determinista). */
  diputadoId: string;
  /**
   * Opción del roll-call: las 5 (si/no/abstencion/pareo/ausente). VOTE-03.
   * `ausente` proviene del roster (el diputado aparece en <Votos> con código de
   * no-asistencia, p.ej. "No Vota"), NUNCA de la ausencia de fila. Una opción no-nominal
   * JAMÁS se colapsa a sí/no: el roll-call se emite con fidelidad.
   */
  opcion: Seleccion;
  /** Nombre crudo armado (Nombre + apellidos) para display/debug. */
  nombreCrudo: string;
}

interface ProvCols {
  origen: string;
  fecha_captura: string;
  enlace: string;
}

function prov(enlace: string): ProvCols {
  const p = makeProvenance(ORIGEN, enlace);
  return { origen: p.source, fecha_captura: p.fetchedAt, enlace: p.sourceUrl };
}

/**
 * Parsea la respuesta de `getVotaciones_Boletin` (ns tempuri.org) a `Votacion[]`.
 *
 * @param opts.detalleXml  XML de `retornarVotacionDetalle` (ns v1): si se pasa, sus
 *   totales SI/NO/Abst pisan los de boletín para la votación coincidente, y el voto-a-voto
 *   se expone vía `parseCamaraVotoDetalle`.
 * @param opts.enlace      Enlace original consultado (provenance). Por defecto, la URL del WS.
 */
export function parseCamaraVotacion(
  xml: string,
  opts: { detalleXml?: string; enlace?: string } = {},
): Votacion[] {
  const doc = parser.parse(xml);
  const lista = asArray<Record<string, unknown>>(
    (doc?.Votaciones?.Votacion ?? doc?.Votacion) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );

  const enlace = opts.enlace ?? URL_BOLETIN;

  // Totales del detalle (ns v1), si se aportó, indexados por id de votación.
  const detalleTotales = opts.detalleXml
    ? totalesDesdeDetalle(opts.detalleXml)
    : null;

  const out: Votacion[] = [];
  for (const v of lista) {
    const idRaw = txt(v.ID) ?? txt(v.Id);
    if (idRaw == null) continue;
    const boletin = txt(v.Boletin);
    if (boletin == null) continue; // sin boletín no es proyecto de ley cruzable

    const fechaDate = parseFechaCL(txt(v.Fecha));
    const fecha = fechaDate ? toIso(fechaDate) : (txt(v.Fecha) ?? "");

    // Totales: del detalle si coincide el id; si no, del boletín (TotalAfirmativos...).
    const t = detalleTotales?.get(idRaw);
    const total_si = t ? t.si : intOf(v.TotalAfirmativos ?? v.TotalSi);
    const total_no = t ? t.no : intOf(v.TotalNegativos ?? v.TotalNo);
    const total_abstencion = t
      ? t.abstencion
      : intOf(v.TotalAbstenciones ?? v.TotalAbstencion);
    const total_pareo = t ? t.pareo : intOf(v.TotalPareo);

    const votacion: Votacion = {
      id: "camara:" + idRaw,
      boletin,
      fecha,
      etapa: txt(v.Tramite),
      tipo: txt(v.Tipo),
      quorum: txt(v.Quorum),
      resultado: txt(v.Resultado),
      total_si,
      total_no,
      total_abstencion,
      total_pareo,
      camara: "diputados",
      ...prov(enlace),
    };

    out.push(VotacionSchema.parse(votacion) as Votacion);
  }
  return out;
}

interface Totales {
  si: number;
  no: number;
  abstencion: number;
  pareo: number;
}

/** Extrae los totales por id de votación del XML de detalle (ns v1). */
function totalesDesdeDetalle(detalleXml: string): Map<string, Totales> {
  const doc = parser.parse(detalleXml);
  const lista = asArray<Record<string, unknown>>(
    (doc?.Votacion ?? doc?.Votaciones?.Votacion) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );
  const map = new Map<string, Totales>();
  for (const v of lista) {
    const id = txt(v.Id) ?? txt(v.ID);
    if (id == null) continue;
    map.set(id, {
      si: intOf(v.TotalSi),
      no: intOf(v.TotalNo),
      abstencion: intOf(v.TotalAbstencion),
      pareo: intOf(v.TotalPareo),
    });
  }
  return map;
}

/**
 * Parsea el voto-a-voto del detalle de votación. La ola 3 lo consume para vincular
 * `parlamentario_id` por `diputadoId` (cruce determinista por identificador oficial).
 *
 * Soporta DOS shapes del WS (ambos verificados):
 *   (a) v1 (fixture 05-02): `Diputado/Id` + `OpcionVoto Valor` (1=Afirmativo→si, 0→no),
 *       apellidos `ApellidoPaterno`/`ApellidoMaterno`.
 *   (b) REAL `getVotacion_Detalle` (ns tempuri.org, LIVE 2026-06-18): `Diputado/DIPID` +
 *       `Opcion Codigo` (0=En Contra→no, 1=A Favor→si, 4=No Vota→ausente — confirmados LIVE),
 *       apellidos `Apellido_Paterno`/`Apellido_Materno`.
 *
 * VOTE-03: emite el ROSTER COMPLETO con las 5 opciones (no solo sí/no). `abstencion` se
 * mapea por CÓDIGO (2, confirmado LIVE 2026-07-13). `ausente` se deriva del roster (código de
 * no-asistencia), nunca de la ausencia de fila. NUNCA se fabrica un sí/no.
 *
 * PAREO (A1b RESUELTO — hallazgo LIVE 2026-07-13): el pareo NO es un `Opcion Codigo=3` en el
 * roster (tal código NO se observó live). Vive en un bloque HERMANO top-level
 * `<Pareos><Pareo><Diputado1><DIPID>…<Diputado2><DIPID>`, y los diputados pareados figuran en
 * `<Votos>` como "No Vota" (código 4). Este parser recolecta el set de DIPID pareados de
 * `<Pareos>` y RE-ETIQUETA a "pareo" las filas del roster que ya existen para esos DIPID
 * (sobrescribiendo el "ausente" que el código 4 habría dado). No fabrica filas nuevas: solo
 * corrige la atribución de filas presentes (pareo ≠ ausente, VOTO-04). Un No Vota que NO está
 * en `<Pareos>` sigue siendo "ausente".
 *
 * El cruce es por id (DIPID/Id), no por nombre; el `nombreCrudo` es para display/fallback.
 */
export function parseCamaraVotoDetalle(detalleXml: string): CamaraVotoDetalle[] {
  const doc = parser.parse(detalleXml);
  const lista = asArray<Record<string, unknown>>(
    (doc?.Votacion ?? doc?.Votaciones?.Votacion) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );
  const out: CamaraVotoDetalle[] = [];
  for (const v of lista) {
    // Set de DIPID pareados desde el bloque hermano <Pareos> (A1b resuelto LIVE): cada <Pareo>
    // empareja Diputado1↔Diputado2; ambos DIPID se marcan como pareo, aunque en <Votos>
    // aparezcan como "No Vota" (código 4). Sin bloque/vacío → set vacío → nadie se re-etiqueta.
    const pareados = new Set<string>();
    const pareos = asArray<Record<string, unknown>>(
      (v?.Pareos as Record<string, unknown> | undefined)?.Pareo as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined,
    );
    for (const p of pareos) {
      const d1 = txt((p.Diputado1 as Record<string, unknown> | undefined)?.DIPID);
      const d2 = txt((p.Diputado2 as Record<string, unknown> | undefined)?.DIPID);
      if (d1 != null) pareados.add(d1);
      if (d2 != null) pareados.add(d2);
    }

    const votos = asArray<Record<string, unknown>>(
      (v?.Votos as Record<string, unknown> | undefined)?.Voto as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined,
    );
    // Uniqueness de DIPID dentro de UNA votación (WR-01): si la fuente emite el mismo diputado
    // dos veces (p.ej. una fila de corrección), el roster produciría dos filas para una persona,
    // inflando un bucket del cross-check y creando una doble atribución silenciosa. Para un
    // roster defamation-critical eso NO se fusiona en silencio: se falla RUIDOSO, consistente
    // con la guarda de pareo (CR-01) y el cross-check.
    const vistos = new Set<string>();
    for (const voto of votos) {
      const dip = (voto.Diputado ?? {}) as Record<string, unknown>;
      // (a) v1 usa Id; (b) real usa DIPID.
      const diputadoId = txt(dip.Id) ?? txt(dip.ID) ?? txt(dip.DIPID);
      if (diputadoId == null) continue;
      if (vistos.has(diputadoId)) {
        throw new Error(
          `DIPID duplicado=${diputadoId} en <Votos> de una misma votación — fila repetida no se ` +
            `fusiona en silencio (WR-01, defamation-critical: doble atribución)`,
        );
      }
      vistos.add(diputadoId);

      // Opción: (a) <OpcionVoto Valor="1|0">; (b) <Opcion Codigo>texto. Las 5 opciones del
      // roll-call (VOTE-03): ninguna se descarta. Solo un nodo de opción ILEGIBLE (sin valor
      // ni texto reconocible) devuelve null → ahí sí se omite, para no fabricar un dato falso.
      let opcion = opcionDeVoto(voto);
      if (opcion == null) continue; // opción ilegible/desconocida → fail-closed, no fabrica

      // Pareo derivado de <Pareos>: re-etiqueta la fila (que el roster dio como "ausente" por
      // código 4) a "pareo". Solo sobre filas YA presentes; nunca inventa una fila (VOTO-04).
      // GUARDA (defamation-critical): SOLO se re-etiqueta cuando el roster dio "ausente".
      // Si un DIPID figura en <Pareos> Y ADEMÁS trae un voto nominal (si/no/abstencion por
      // código 0/1/2), es una contradicción de integridad de la fuente → se falla RUIDOSO
      // (throw, consistente con el cross-check), NUNCA se sobrescribe el voto real con "pareo".
      // "voted YES" jamás se reescribe a "was paired" en silencio.
      if (pareados.has(diputadoId)) {
        if (opcion === "ausente") {
          opcion = "pareo";
        } else {
          throw new Error(
            `pareo/voto conflict DIPID=${diputadoId}: en <Pareos> pero roster dio "${opcion}" ` +
              `(no "ausente") — no se re-etiqueta a pareo (VOTO-04, defamation-critical)`,
          );
        }
      }

      const nombreCrudo = [
        txt(dip.Nombre),
        txt(dip.ApellidoPaterno) ?? txt(dip.Apellido_Paterno),
        txt(dip.ApellidoMaterno) ?? txt(dip.Apellido_Materno),
      ]
        .filter(Boolean)
        .join(" ");
      out.push({ diputadoId, opcion, nombreCrudo });
    }
  }
  return out;
}

/**
 * Totales del header + DIPID pareados de la respuesta LIVE `getVotacion_Detalle` (ns tempuri.org),
 * extraídos con el MISMO parser XML del módulo (fast-xml-parser, NUNCA regex sobre el cuerpo del
 * voto — CLAUDE.md). Lo consume el SPIKE LIVE (Phase 64) para el cross-check Σ(roster)==Total*
 * contra la MISMA respuesta cruda y para cazar Pareo/Dispensado por observación. `dispensados`
 * expone `TotalDispensados` (bucket a confirmar LIVE, Open Question 2). Lee el PRIMER nodo
 * `<Votacion>` (el detalle trae uno).
 */
export interface CamaraDetalleHeader {
  afirmativos: number;
  negativos: number;
  abstenciones: number;
  dispensados: number;
  /** DIPID del bloque hermano <Pareos> (ambos diputados de cada <Pareo>). */
  pareados: string[];
}

export function caracterizarVotacionDetalle(detalleXml: string): CamaraDetalleHeader {
  const doc = parser.parse(detalleXml);
  const v = asArray<Record<string, unknown>>(
    (doc?.Votacion ?? doc?.Votaciones?.Votacion) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  )[0];
  const pareados = new Set<string>();
  const pareos = asArray<Record<string, unknown>>(
    (v?.Pareos as Record<string, unknown> | undefined)?.Pareo as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );
  for (const p of pareos) {
    const d1 = txt((p.Diputado1 as Record<string, unknown> | undefined)?.DIPID);
    const d2 = txt((p.Diputado2 as Record<string, unknown> | undefined)?.DIPID);
    if (d1 != null) pareados.add(d1);
    if (d2 != null) pareados.add(d2);
  }
  return {
    afirmativos: intOf(v?.TotalAfirmativos),
    negativos: intOf(v?.TotalNegativos),
    abstenciones: intOf(v?.TotalAbstenciones),
    dispensados: intOf(v?.TotalDispensados),
    pareados: [...pareados],
  };
}

/**
 * Deriva la `Seleccion` del roll-call (las 5 opciones) del nodo de opción, soportando ambos
 * shapes. VOTE-03: ya NO descarta No Vota/Abstención/Pareo — los emite como `ausente`/
 * `abstencion`/`pareo`. Devuelve `null` SOLO cuando el nodo de opción es ilegible (sin valor
 * ni texto reconocible) → el caller lo omite, para no fabricar un dato falso (fail-closed).
 *
 * Mapeo por CÓDIGO cuando es conocido: 1→si, 0→no, 2→abstencion (CONFIRMADO LIVE 2026-07-13),
 * 4→ausente. El `pareo` NO se resuelve aquí: el roster real NUNCA trae un `Opcion Codigo=3`
 * ni el texto "Pareo" (A1b resuelto LIVE — código 3 no observado); el pareo lo deriva
 * `parseCamaraVotoDetalle` cruzando los DIPID del bloque hermano `<Pareos>`. El fallback por
 * texto `/pareo/` se conserva por robustez, pero no es el camino real de la Cámara.
 */
function opcionDeVoto(voto: Record<string, unknown>): Seleccion | null {
  // (a) v1: <OpcionVoto Valor="1|0"> (solo trae sí/no nominal en ese shape histórico).
  const opcionVoto = voto.OpcionVoto as Record<string, unknown> | string | undefined;
  if (opcionVoto != null) {
    const valor =
      typeof opcionVoto === "object" ? String(opcionVoto["@_Valor"] ?? "") : "";
    if (valor === "1") return "si";
    if (valor === "0") return "no";
    return null; // valor desconocido en el shape v1 → ilegible
  }
  // (b) real: <Opcion Codigo>A Favor|En Contra|No Vota|Abstención|Pareo|...
  const opcion = voto.Opcion as Record<string, unknown> | string | undefined;
  if (opcion != null) {
    const codigo =
      typeof opcion === "object" ? String(opcion["@_Codigo"] ?? "") : "";
    const texto =
      typeof opcion === "object" ? String(opcion["#text"] ?? "") : String(opcion);
    // Nominales (código confirmado LIVE o texto inequívoco).
    if (codigo === "1" || /a favor|afirmativ/i.test(texto)) return "si";
    if (codigo === "0" || /en contra|negativ/i.test(texto)) return "no";
    // Abstención: código 2 CONFIRMADO LIVE 2026-07-13 (dejó de ser sintético A1 → hecho
    // verificado por cross-check de totales en 5 votaciones). Se mapea por CÓDIGO,
    // independientemente del #text. El fallback por texto (/abstenci/) se conserva por si
    // otra fuente/legislatura trae solo el texto y no el código.
    if (codigo === "2" || /abstenci/i.test(texto)) return "abstencion";
    // Pareo por TEXTO solo como fallback robusto: el roster REAL de la Cámara NO trae este
    // texto ni un código 3 (A1b resuelto LIVE 2026-07-13). El pareo real se deriva del bloque
    // hermano <Pareos> en parseCamaraVotoDetalle, NO aquí. NO se añade una rama `codigo === "3"`.
    if (/pareo/i.test(texto)) return "pareo";
    // Ausente: No Vota (código 4 confirmado LIVE) o dispensado/inasistencia por texto.
    if (codigo === "4" || /no vota|dispensad|inasist|ausen/i.test(texto)) return "ausente";
    return null; // opción presente pero ilegible/desconocida → no fabrica un dato
  }
  return null;
}
