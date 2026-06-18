// parse-senado-votacion — XML de `wspublico/votaciones.php` → Votacion[] + voto-a-voto crudo.
//
// `<votaciones><votacion>`: totales SI/NO/ABSTENCION/PAREO + quorum/tipo/etapa, y por cada
// `<DETALLE_VOTACION><VOTO>` el `<PARLAMENTARIO>` crudo (con whitespace final → trim, Pitfall 3)
// + `<SELECCION>` mapeada a si|no|abstencion|pareo. NO se reconcilia identidad aquí (eso es la
// ola 3): solo se devuelve `mencionNombre` crudo. La llave de boletín es el PARÁMETRO recibido,
// NO el `<TEMA>` (trae puntos de millar). Votaciones vacías → [] sin lanzar (Pitfall 2).

import { XMLParser } from "fast-xml-parser";
import { makeProvenance } from "@obs/core";
import {
  type Votacion,
  type Seleccion,
  VotacionSchema,
} from "./model";
import { parseFechaCL, toIso } from "./fecha";

const ORIGEN = "senado-wspublico";
const URL_VOTACIONES = "https://tramitacion.senado.cl/wspublico/votaciones.php";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

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

function intOf(v: unknown): number {
  const s = txt(v);
  const n = s == null ? 0 : Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return ([] as T[]).concat(v as T | T[]);
}

function mapSeleccion(s: string | null): Seleccion {
  const v = (s ?? "").toLowerCase();
  if (v.startsWith("si") || v.startsWith("sí")) return "si";
  if (v.startsWith("no")) return "no";
  if (v.startsWith("abst")) return "abstencion";
  if (v.startsWith("pareo")) return "pareo";
  return "abstencion"; // desconocido → conservador (no afirma un voto)
}

export interface VotoSenadoCrudo {
  mencionNombre: string;
  seleccion: Seleccion;
}

export interface VotacionSenado {
  votacion: Votacion;
  votos: VotoSenadoCrudo[];
}

/**
 * Parsea TODAS las votaciones de `votaciones.php` → `VotacionSenado[]`.
 * Si el boletín está en primer trámite Cámara, `<votaciones>` viene vacío → `[]` (Pitfall 2).
 * El `boletin` se usa como llave (NO el `<TEMA>`, que trae puntos de millar); si no se pasa,
 * se intenta derivar del primer `<TEMA>` como último recurso.
 */
export function parseSenadoVotaciones(
  xml: string,
  boletin?: string,
  enlace?: string,
): VotacionSenado[] {
  const doc = parser.parse(xml);
  const lista = asArray<Record<string, unknown>>(
    (doc?.votaciones?.votacion ?? doc?.votacion) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );

  const link = enlace ?? URL_VOTACIONES;
  const p = makeProvenance(ORIGEN, link);
  const provCols = {
    origen: p.source,
    fecha_captura: p.fetchedAt,
    enlace: p.sourceUrl,
  };

  const out: VotacionSenado[] = [];
  for (const v of lista) {
    const fechaRaw = txt(v.FECHA);
    const fechaDate = parseFechaCL(fechaRaw);
    const fecha = fechaDate ? toIso(fechaDate) : (fechaRaw ?? "");

    // Llave de boletín: el param recibido; si falta, derivar del <TEMA> (con puntos → limpiar).
    const boletinKey =
      boletin ??
      (txt(v.TEMA)?.match(/Bolet[íi]n N°\s*([\d.]+-\d+)/)?.[1]?.replace(/\./g, "") ??
        "");

    const votacion: Votacion = VotacionSchema.parse({
      id: "senado:" + boletinKey + ":" + (fechaRaw ?? ""),
      boletin: boletinKey,
      fecha,
      etapa: txt(v.ETAPA),
      tipo: txt(v.TIPOVOTACION),
      quorum: txt(v.QUORUM),
      resultado: null,
      total_si: intOf(v.SI),
      total_no: intOf(v.NO),
      total_abstencion: intOf(v.ABSTENCION),
      total_pareo: intOf(v.PAREO),
      camara: "senado",
      ...provCols,
    }) as Votacion;

    const detalle = (v.DETALLE_VOTACION ?? {}) as Record<string, unknown>;
    const votos: VotoSenadoCrudo[] = asArray<Record<string, unknown>>(
      detalle.VOTO as Record<string, unknown> | Record<string, unknown>[],
    )
      .map((voto) => ({
        mencionNombre: txt(voto.PARLAMENTARIO) ?? "",
        seleccion: mapSeleccion(txt(voto.SELECCION)),
      }))
      .filter((voto) => voto.mencionNombre.length > 0);

    out.push({ votacion, votos });
  }
  return out;
}

/**
 * Conveniencia: parsea y devuelve la PRIMERA votación de `votaciones.php`
 * (contrato del slice E2E). Lanza si el XML no trae ninguna votación — para iterar todas
 * o manejar el caso vacío (Pitfall 2) usar `parseSenadoVotaciones`.
 */
export function parseSenadoVotacion(
  xml: string,
  boletin?: string,
  enlace?: string,
): VotacionSenado {
  const todas = parseSenadoVotaciones(xml, boletin, enlace);
  const primera = todas[0];
  if (primera === undefined) {
    throw new Error("parseSenadoVotacion: el XML no contiene votaciones");
  }
  return primera;
}
