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

function intOf(v: unknown): number {
  const s = txt(v);
  const n = s == null ? 0 : Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
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
 * Parsea el voto-a-voto de `retornarVotacionDetalle` (ns v1). La ola 3 lo consume para
 * vincular `parlamentario_id` por `diputadoId` (cruce determinista, sin reconciliación por
 * nombre). `OpcionVoto Valor`: 1=Afirmativo→si, 0=En Contra→no.
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
      const diputadoId = txt(dip.Id) ?? txt(dip.ID);
      if (diputadoId == null) continue;
      const opcionRaw = voto.OpcionVoto as Record<string, unknown> | string;
      const valor =
        typeof opcionRaw === "object"
          ? String(opcionRaw["@_Valor"] ?? "")
          : "";
      const nombreCrudo = [
        txt(dip.Nombre),
        txt(dip.ApellidoPaterno),
        txt(dip.ApellidoMaterno),
      ]
        .filter(Boolean)
        .join(" ");
      out.push({
        diputadoId,
        opcion: valor === "1" ? "si" : "no",
        nombreCrudo,
      });
    }
  }
  return out;
}
