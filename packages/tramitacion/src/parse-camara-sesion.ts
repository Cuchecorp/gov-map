// parse-camara-sesion — XML de `retornarSesionesXLegislatura` (ns ...camaradiputados/v1) →
// lista de sesiones. La ola 4 lo usa para DESCUBRIR las sesiones de la Legislatura 58 y, por
// cada una, traer sus votaciones. Forma real: `<SesionesSalaColeccion><Sesion><Id>/<Numero>/
// <FechaInicio>/<FechaTermino>/<Tipo Valor>/<Estado Valor></Sesion></SesionesSalaColeccion>`.

import { XMLParser } from "fast-xml-parser";
import { parseFechaCL, toIso } from "./fecha";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

export interface SesionCamara {
  id: string;
  numero: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  tipo: string | null;
  estado: string | null;
}

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

function fechaIso(v: unknown): string | null {
  const d = parseFechaCL(txt(v));
  return d ? toIso(d) : txt(v);
}

/** Parsea el XML de sesiones de una legislatura → `SesionCamara[]`. */
export function parseCamaraSesion(xml: string): SesionCamara[] {
  const doc = parser.parse(xml);
  const lista = asArray<Record<string, unknown>>(
    (doc?.SesionesSalaColeccion?.Sesion ?? doc?.Sesion) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );
  const out: SesionCamara[] = [];
  for (const s of lista) {
    const id = txt(s.Id) ?? txt(s.ID);
    if (id == null) continue;
    out.push({
      id,
      numero: txt(s.Numero),
      fechaInicio: fechaIso(s.FechaInicio),
      fechaTermino: fechaIso(s.FechaTermino),
      tipo: txt(s.Tipo),
      estado: txt(s.Estado),
    });
  }
  return out;
}
