// parse-senado-votacion — XML de `wspublico/votaciones.php` → Votacion[] + voto-a-voto crudo.
//
// `<votaciones><votacion>`: totales SI/NO/ABSTENCION/PAREO + quorum/tipo/etapa, y por cada
// `<DETALLE_VOTACION><VOTO>` el `<PARLAMENTARIO>` crudo (con whitespace final → trim, Pitfall 3)
// + `<SELECCION>` mapeada a si|no|abstencion|pareo|ausente. NO se reconcilia identidad aquí (eso
// es la ola 3): solo se devuelve `mencionNombre` crudo. La llave de boletín es el PARÁMETRO
// recibido, NO el `<TEMA>` (trae puntos de millar). Votaciones vacías → [] sin lanzar (Pitfall 2).
//
// WR-02 (manejo de token desconocido — NO "espeja la Cámara"): la Cámara mapea por código y
// OMITE en silencio una opción ilegible (`opcionDeVoto` → null → el caller hace `continue`). El
// Senado NO omite en silencio: un `<SELECCION>` presente pero desconocido se CAPTURA PER-VOTO en
// `tokensDesconocidos` (diagnóstico ruidoso con la mención y el token crudo) mientras los demás
// votos del roll-call sobreviven (ex-WR-01: antes lanzaba y borraba el boletín entero). Es una
// divergencia DELIBERADA con la Cámara: el vocabulario de tokens del Senado LIVE está sin
// confirmar (Plan 02), así que un token novedoso debe ser VISIBLE, no tragado. NO fabrica una
// clasificación (WR-03) ni borra votos válidos.

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

/** Error tipado que porta el token crudo desconocido (WR-01: se captura PER-VOTO, no se propaga). */
export class SeleccionDesconocidaError extends Error {
  readonly token: string;
  constructor(token: string) {
    super(
      `<SELECCION> con token desconocido "${token}" — voto NO omitido en silencio (D-A4); ` +
        `confirmar el token real del Senado (Plan 02) antes de mapearlo`,
    );
    this.name = "SeleccionDesconocidaError";
    this.token = token;
  }
}

/**
 * Mapea el `SELECCION` crudo a una opción nominal. Casos (D-A4, P67):
 *   (a) VACÍO/ausente (`null`/"") → devuelve `null` → el caller OMITE el voto (no es un voto
 *       clasificable; no hay persona-que-votó que perder).
 *   (b) token conocido → la `Seleccion` correspondiente (IN-03: por token normalizado/anclado,
 *       con las variantes de ausencia resueltas antes de la rama contra).
 *   (c) token PRESENTE pero DESCONOCIDO ("A FAVOR", "AF", un código numérico) → LANZA
 *       `SeleccionDesconocidaError` con el token crudo. NO se omite en silencio. WR-01: el caller
 *       (`parseSenadoVotaciones`) captura este throw PER-VOTO y lo registra en `tokensDesconocidos`
 *       — los demás votos del roll-call SOBREVIVEN; un token novedoso ya NO borra el boletín entero
 *       (antes el throw desenrollaba todo el parse → se perdían N-1 votos válidos del boletín).
 *
 * WR-03 se preserva: NUNCA se coacciona un token a 'abstencion' (eso fabricaría una clasificación
 * contada). El desconocido no se traga en silencio: se marca ruidoso (diagnóstico per-persona).
 *
 * NOTA (riesgo residual gated, Plan 02): los tokens reales de `<SELECCION>` del Senado LIVE no
 * están confirmados en esta fase; el diagnóstico per-voto hace que un token real distinto del
 * esperado sea RUIDOSO (aparece en `errores` con la mención) sin ser silencioso ni destructivo,
 * hasta fijarlos con un SPIKE LIVE (operador).
 */
function mapSeleccion(s: string | null): Seleccion | null {
  const raw = (s ?? "").trim();
  if (raw.length === 0) return null; // (a) vacío/ausente → se omite (no lanza)
  // IN-03: emparejamiento por TOKEN NORMALIZADO/ANCLADO (no prefijo greedy). Normaliza a
  // minúsculas + colapsa whitespace interno.
  const v = raw.toLowerCase().replace(/\s+/g, " ");
  // AUSENCIA primero (más específico) — antes de la rama contra, para que "no vota"/"no votó"
  // NO caiga en `no` (una atribución FALSA de voto en contra a quien NO votó). Simetría con la
  // Cámara: No Vota → `ausente`.
  if (/^(no vot|sin voto|ausente)/.test(v)) return "ausente";
  // Tokens nominales anclados a TOKEN completo (o token seguido de espacio), NO prefijo greedy.
  // Nota: `\b` no es fiable tras letras acentuadas ("sí") en JS regex → anclamos a fin/espacio.
  if (/^(si|sí)( |$)/.test(v)) return "si";
  if (/^no( |$)/.test(v)) return "no";
  if (/^abst/.test(v)) return "abstencion";
  if (/^pareo/.test(v)) return "pareo";
  // (c) token presente pero desconocido → FALLA RUIDOSO (capturado per-voto por el caller).
  throw new SeleccionDesconocidaError(raw);
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

/**
 * Diagnóstico de un `<SELECCION>` PRESENTE pero desconocido (WR-01). Se colecta PER-VOTO en
 * vez de lanzar a través de todo el parse: el token novedoso queda VISIBLE (con la mención y el
 * token crudo) pero los demás votos del roll-call SOBREVIVEN. El caller (`runIngest`) lo sube a
 * `errores` por persona.
 */
export interface TokenDesconocido {
  mencionNombre: string;
  token: string;
  votoSeq: number;
}

export interface VotacionSenado {
  votacion: Votacion;
  votos: VotoSenadoCrudo[];
  /**
   * Tokens `<SELECCION>` desconocidos hallados en esta votación (WR-01). Vacío en el caso normal.
   * Cada entrada es un voto que NO se pudo clasificar y NO se contó — se reporta ruidoso, sin
   * borrar el resto de la votación ni fabricar una clasificación.
   */
  tokensDesconocidos: TokenDesconocido[];
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
    const tokensDesconocidos: TokenDesconocido[] = [];
    // CR-02: `votoSeq` es el índice posicional EN LA FUENTE (antes de filtrar) → estable e
    // idempotente. D-A4: un `<SELECCION>` VACÍO/ausente se OMITE (mapSeleccion → null); un token
    // PRESENTE pero desconocido se CAPTURA PER-VOTO en `tokensDesconocidos` (WR-01) — no se traga
    // en silencio pero TAMPOCO borra el resto del roll-call. WR-03 se mantiene: nunca se coacciona
    // un token a 'abstencion'.
    asArray<Record<string, unknown>>(
      detalle.VOTO as Record<string, unknown> | Record<string, unknown>[],
    ).forEach((voto, idx) => {
      const mencionNombre = txt(voto.PARLAMENTARIO) ?? "";
      if (mencionNombre.length === 0) return;
      let seleccion: Seleccion | null;
      try {
        seleccion = mapSeleccion(txt(voto.SELECCION));
      } catch (err) {
        if (err instanceof SeleccionDesconocidaError) {
          // WR-01: token desconocido → se marca ruidoso PER-VOTO; los votos hermanos sobreviven.
          // El voto NO se registra (no se le atribuye ninguna clasificación real).
          tokensDesconocidos.push({ mencionNombre, token: err.token, votoSeq: idx });
          return;
        }
        throw err;
      }
      if (seleccion == null) return; // D-A4 caso (a): <SELECCION> vacío/ausente → se omite
      votos.push({ mencionNombre, seleccion, votoSeq: idx });
    });

    out.push({ votacion, votos, tokensDesconocidos });
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
