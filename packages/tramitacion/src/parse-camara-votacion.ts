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
import { type Votacion, VotacionSchema } from "./model";
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
  /** 'si' (Afirmativo, Valor=1) | 'no' (En Contra, Valor=0). */
  opcion: "si" | "no";
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
 *       `Opcion Codigo` (0=En Contra→no, 1=A Favor→si, otros [No Vota/Abstención/dispensado]
 *       NO afirman un sí/no nominal → se omiten para no fabricar un voto), apellidos
 *       `Apellido_Paterno`/`Apellido_Materno`.
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
    const votos = asArray<Record<string, unknown>>(
      (v?.Votos as Record<string, unknown> | undefined)?.Voto as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined,
    );
    for (const voto of votos) {
      const dip = (voto.Diputado ?? {}) as Record<string, unknown>;
      // (a) v1 usa Id; (b) real usa DIPID.
      const diputadoId = txt(dip.Id) ?? txt(dip.ID) ?? txt(dip.DIPID);
      if (diputadoId == null) continue;

      // Opción: (a) <OpcionVoto Valor="1|0">; (b) <Opcion Codigo="1|0">texto.
      const opcion = opcionDeVoto(voto);
      if (opcion == null) continue; // No Vota / Abstención / dispensado → no afirma sí/no nominal

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
 * Deriva 'si'|'no' del nodo de opción de voto, soportando ambos shapes. Devuelve null cuando
 * la opción NO es un sí/no nominal (No Vota/Abstención/dispensado) — el caller la omite para
 * no fabricar un voto afirmativo/negativo inexistente (T-05-06, fail-closed sobre el sentido).
 */
function opcionDeVoto(voto: Record<string, unknown>): "si" | "no" | null {
  // (a) v1: <OpcionVoto Valor="1|0">.
  const opcionVoto = voto.OpcionVoto as Record<string, unknown> | string | undefined;
  if (opcionVoto != null) {
    const valor =
      typeof opcionVoto === "object" ? String(opcionVoto["@_Valor"] ?? "") : "";
    if (valor === "1") return "si";
    if (valor === "0") return "no";
    return null;
  }
  // (b) real: <Opcion Codigo="1|0">A Favor|En Contra|No Vota|Abstención.
  const opcion = voto.Opcion as Record<string, unknown> | string | undefined;
  if (opcion != null) {
    const codigo =
      typeof opcion === "object" ? String(opcion["@_Codigo"] ?? "") : "";
    const texto =
      typeof opcion === "object" ? String(opcion["#text"] ?? "") : String(opcion);
    if (codigo === "1" || /a favor|afirmativ/i.test(texto)) return "si";
    if (codigo === "0" || /en contra|negativ/i.test(texto)) return "no";
    return null; // No Vota (4) / Abstención / dispensado → no nominal
  }
  return null;
}
