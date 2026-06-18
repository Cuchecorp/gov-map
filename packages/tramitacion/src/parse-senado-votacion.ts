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

/**
 * Entero NO negativo de un nodo, distinguiendo "ausente" de "presente pero ilegible" (WR-04).
 *  - nodo ausente/"" → 0 (la fuente no trae el total).
 *  - entero válido `[0-9]+` → su valor.
 *  - presente PERO no es un entero limpio (separador de millar / token no numérico) → `null`:
 *    NO se fabrica un valor silencioso a partir de `Number("1.234")`.
 */
function intParse(v: unknown): number | null {
  const s = txt(v);
  if (s == null) return 0;
  if (!/^\d+$/.test(s)) return null;
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

/**
 * Mapea el `SELECCION` crudo a una opción nominal, o `null` si el token es desconocido/garbled.
 *
 * WR-03: un token que NO sea si/no/abst/pareo NO se coacciona a 'abstencion' — eso fabricaría
 * una clasificación afirmativa ("Abstención" se cuenta y se muestra en el roll-call) atribuida a
 * una persona nombrada, presentando interpretación como hecho. Espeja la Cámara
 * (`opcionDeVoto` devuelve null y el caller OMITE el voto) en lugar de inventar un voto contado.
 */
function mapSeleccion(s: string | null): Seleccion | null {
  const v = (s ?? "").toLowerCase();
  if (v.startsWith("si") || v.startsWith("sí")) return "si";
  if (v.startsWith("no")) return "no";
  if (v.startsWith("abst")) return "abstencion";
  if (v.startsWith("pareo")) return "pareo";
  return null; // desconocido/garbled → se OMITE el voto (no se fabrica una clasificación)
}

/**
 * Discriminador estable por votación dentro de un mismo (boletín, fecha).
 * CR-01: el Senado realiza varias votaciones nominales el mismo día para el mismo boletín
 * (en general + en particular, varios artículos). Combinamos los identificadores que trae la
 * fuente (SESION + TIPOVOTACION + ETAPA + QUORUM) y, como último recurso para garantizar
 * unicidad incluso con metadata idéntica, un índice posicional dentro del grupo
 * (boletín, fecha). El orden del XML de la fuente es determinista → el índice es estable
 * entre re-ingestas (idempotencia), y dos `<votacion>` distintos NUNCA colapsan al mismo id.
 */
function discriminadorVotacion(
  v: Record<string, unknown>,
  seqEnGrupo: number,
): string {
  return [
    txt(v.SESION),
    txt(v.TIPOVOTACION),
    txt(v.ETAPA),
    txt(v.QUORUM),
    String(seqEnGrupo),
  ]
    .map((p) => (p ?? "").replace(/[:|\s]+/g, "_"))
    .join("|");
}

export interface VotoSenadoCrudo {
  mencionNombre: string;
  seleccion: Seleccion;
  /**
   * Índice posicional del voto dentro de su votación (CR-02): discriminador estable para
   * que dos votantes con `mencionNombre` idéntico/vacío NO colapsen en la misma clave de
   * upsert `(votacion_id, mencion_nombre, voto_seq)`. El orden del XML es determinista → el
   * índice es idempotente entre re-ingestas.
   */
  votoSeq: number;
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

  // CR-01: secuencia por (boletín, fecha) para desambiguar votaciones del mismo día.
  const seqPorGrupo = new Map<string, number>();

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

    // CR-01: índice posicional dentro del grupo (boletín, fecha) — último recurso de unicidad.
    const grupoKey = boletinKey + "|" + (fechaRaw ?? "");
    const seqEnGrupo = seqPorGrupo.get(grupoKey) ?? 0;
    seqPorGrupo.set(grupoKey, seqEnGrupo + 1);

    const disc = discriminadorVotacion(v, seqEnGrupo);

    const votacion: Votacion = VotacionSchema.parse({
      // CR-01: el id incorpora un discriminador estable por votación (SESION/TIPO/ETAPA/QUORUM
      // + índice posicional) → dos votaciones del mismo día NO colapsan, y re-ingerir es idempotente.
      id: "senado:" + boletinKey + ":" + (fechaRaw ?? "") + ":" + disc,
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
    const votos: VotoSenadoCrudo[] = [];
    // CR-02: `votoSeq` es el índice posicional EN LA FUENTE (antes de filtrar) → estable e
    // idempotente. WR-03: las selecciones desconocidas se OMITEN (mapSeleccion → null) en vez de
    // fabricar 'abstencion'.
    asArray<Record<string, unknown>>(
      detalle.VOTO as Record<string, unknown> | Record<string, unknown>[],
    ).forEach((voto, idx) => {
      const mencionNombre = txt(voto.PARLAMENTARIO) ?? "";
      if (mencionNombre.length === 0) return;
      const seleccion = mapSeleccion(txt(voto.SELECCION));
      if (seleccion == null) return; // WR-03: token garbled/desconocido → se omite el voto
      votos.push({ mencionNombre, seleccion, votoSeq: idx });
    });

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
