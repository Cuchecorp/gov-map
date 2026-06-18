/**
 * parse-camara — XML del catálogo de diputados vigentes → modelo `Parlamentario`.
 *
 * Fuente: https://opendata.camara.cl/.../WSDiputado.asmx/retornarDiputadosPeriodoActual.
 * Forma real (capturada live 2026-06-18, 155 `<Diputado>`):
 *   `<DiputadosPeriodoColeccion><DiputadoPeriodo><Diputado>...` con Id, Nombre, Nombre2,
 *   ApellidoPaterno, ApellidoMaterno, RUT(vacío), Sexo, Militancias.Militancia[]→Partido.
 *
 * Decisiones / Pitfalls:
 *  - PARTIDO = militancia VIGENTE (`partidoVigente`): la `<Militancia>` cuyo rango
 *    [FechaInicio, FechaTermino] cubre la fecha de corte (2026-03-11, inicio del periodo),
 *    NO el nodo `<DiputadoPeriodo>` (Pitfall 5: su FechaInicio es 2030-03-10, contraintuitivo).
 *  - `rut` y `distrito` quedan null (el WS no los trae; Pitfall 4 — NO fabricar).
 *  - `periodo` = "2026-2030" (Id 11 / Leg 374·58, confirmado live; A2).
 *  - `estado` inicial = "no_confirmado" (compuerta humana ID-01); nunca auto-confirma.
 *  - `nombre_normalizado` vía `normalizarNombre`; shape validado con zod antes de devolver.
 */

import { XMLParser } from "fast-xml-parser";
import {
  type Parlamentario,
  ParlamentarioSeedSchema,
  normalizarNombre,
} from "@obs/core";

export const CAMARA_URL =
  "https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual";

/** Periodo legislativo vigente (Id 11, Leg 374·58) confirmado live (A2). */
export const CAMARA_PERIODO = "2026-2030";

/** Fecha de corte de vigencia = inicio del periodo 2026-2030 (Pitfall 5). */
export const CORTE_VIGENCIA = new Date("2026-03-11T12:00:00");

const ORIGEN = "diputados";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/** Partido de una militancia: Alias preferido, luego Nombre. */
interface PartidoRaw {
  Id?: unknown;
  Nombre?: unknown;
  Alias?: unknown;
}
export interface MilitanciaRaw {
  FechaInicio?: string | null;
  FechaTermino?: string | null | { [k: string]: unknown };
  Partido?: PartidoRaw;
}

/**
 * Error de fecha de militancia malformada (CR-02). Se lanza ante un string de fecha que
 * NO parsea (`Invalid Date`), en vez de dejarlo pasar silenciosamente.
 */
export class FechaInvalidaError extends Error {
  constructor(readonly valor: string) {
    super(`militancia: fecha inválida "${valor}"`);
    this.name = "FechaInvalidaError";
  }
}

/**
 * Parsea una fecha de militancia FAIL-CLOSED (CR-02). Devuelve `null` si está ausente/vacía
 * (semántica legítima: sin inicio o sin término = vigente), un `Date` válido si parsea, y
 * LANZA `FechaInvalidaError` si el string no es parseable.
 *
 * Crucial: NUNCA devuelve un `Invalid Date`. Un `Invalid Date` hace que toda comparación
 * (`<=`, `>=`) sea `false`, lo que descartaría en silencio la militancia correcta y dejaría
 * que la selección caiga a un partido ANTERIOR — una asignación de partido equivocada sin
 * error (riesgo T-03). Fallar cerrado evita la adivinanza silenciosa.
 */
function parseFecha(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === "object") return null; // nodo self-closing xsi:nil -> {}
  const s = String(v).trim();
  if (s.length === 0) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new FechaInvalidaError(s); // fail-closed: nunca un Invalid Date silencioso
  }
  return d;
}

/** Lee FechaTermino tolerando el nodo self-closing `xsi:nil` (llega como objeto/""). */
function fechaTerminoOf(m: MilitanciaRaw): Date | null {
  return parseFecha(m.FechaTermino);
}

/** Lee FechaInicio (fail-closed ante fecha malformada). */
function fechaInicioOf(m: MilitanciaRaw): Date | null {
  return parseFecha(m.FechaInicio);
}

/**
 * Elige el partido de la militancia VIGENTE al `corte`. FechaTermino nil/ausente = vigente
 * (sin fin). Entre TODAS las militancias cuyo rango cubre `corte`, elige la de `FechaInicio`
 * MÁS RECIENTE (WR-04: el orden del XML no garantiza recencia; con militancias solapadas la
 * primera encontrada podía ser la obsoleta). Una FechaInicio ausente se trata como la más
 * antigua para no desplazar a una militancia fechada. Devuelve el Alias (o Nombre) del
 * partido, o null si ninguna cubre. Lanza `FechaInvalidaError` si una fecha es malformada
 * (CR-02, fail-closed).
 */
export function partidoVigente(
  militancias: MilitanciaRaw[],
  corte: Date,
): string | null {
  const candidatas = militancias.filter((m) => {
    const ini = fechaInicioOf(m);
    const fin = fechaTerminoOf(m);
    const tras = ini == null || ini <= corte;
    const antes = fin == null || fin >= corte;
    return tras && antes;
  });
  if (candidatas.length === 0) return null;

  // Selecciona por recencia (FechaInicio más reciente), no por orden de aparición en el XML.
  const activa = candidatas.reduce((mejor, m) => {
    const iniM = fechaInicioOf(m)?.getTime() ?? -Infinity;
    const iniMejor = fechaInicioOf(mejor)?.getTime() ?? -Infinity;
    return iniM > iniMejor ? m : mejor;
  });

  if (!activa.Partido) return null;
  return str(activa.Partido.Alias) ?? str(activa.Partido.Nombre);
}

interface DiputadoRaw {
  Id?: unknown;
  Nombre?: unknown;
  Nombre2?: unknown;
  ApellidoPaterno?: unknown;
  ApellidoMaterno?: unknown;
  Militancias?: { Militancia?: MilitanciaRaw | MilitanciaRaw[] };
}
interface DiputadoPeriodoRaw {
  Diputado?: DiputadoRaw;
}

/** Piso de plausibilidad: el catálogo vigente trae ~155 diputados (WR-05). */
const MIN_DIPUTADOS = 10;

/**
 * Parsea el XML de la Cámara a un array de `Parlamentario` (155 vigentes). Cada fila se
 * valida con `ParlamentarioSeedSchema`; un shape inválido lanza (compuerta de contrato).
 *
 * Robustez:
 *  - CR-03: un `<Diputado>` sin `Id` no tiene clave natural estable → se LANZA (no se fabrica
 *    un id `"D?"` que colisionaría en el upsert por PK).
 *  - CR-02: una fecha de militancia malformada NO produce un partido equivocado en silencio;
 *    se captura por diputado, se deja `partido=null` y se registra vía `opts.log`.
 *  - WR-05: si el conteo final es implausiblemente bajo (`< MIN_DIPUTADOS`), se LANZA — una
 *    respuesta malformada (HTML de error con 200, wrapper renombrado) no debe producir un
 *    snapshot vacío/recortado que borre la maestra en el commit de backup.
 */
export function parseCamara(
  xml: string,
  opts: { fechaCaptura?: string; corte?: Date; log?: (msg: string) => void } = {},
): Parlamentario[] {
  const doc = parser.parse(xml) as {
    DiputadosPeriodoColeccion?: {
      DiputadoPeriodo?: DiputadoPeriodoRaw | DiputadoPeriodoRaw[];
    };
  };
  const periodos: DiputadoPeriodoRaw[] = ([] as DiputadoPeriodoRaw[]).concat(
    doc.DiputadosPeriodoColeccion?.DiputadoPeriodo ?? [],
  );
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const corte = opts.corte ?? CORTE_VIGENCIA;
  const log = opts.log ?? (() => {});

  const out: Parlamentario[] = [];
  for (const per of periodos) {
    const d = per.Diputado;
    if (!d) continue;

    // CR-03: sin Id no hay clave natural estable; jamás fabricar un id colisionable `"D?"`.
    const idDiputado = str(d.Id);
    if (idDiputado == null) {
      throw new Error("diputado sin Id — no se puede derivar un id estable (CR-03)");
    }

    const nombre2 = str(d.Nombre2);
    const nombres = [str(d.Nombre), nombre2].filter((x): x is string => x != null).join(" ");
    const apellidoPaterno = str(d.ApellidoPaterno) ?? "";
    const apellidoMaterno = str(d.ApellidoMaterno) ?? "";
    const militancias: MilitanciaRaw[] = ([] as MilitanciaRaw[]).concat(
      d.Militancias?.Militancia ?? [],
    );
    const { nombre_normalizado } = normalizarNombre({
      nombres,
      apellidoPaterno,
      apellidoMaterno,
    });

    // CR-02: ante una fecha malformada NO adivinamos un partido anterior. Dejamos null + log.
    let partido: string | null = null;
    try {
      partido = partidoVigente(militancias, corte);
    } catch (err) {
      if (err instanceof FechaInvalidaError) {
        log(
          `parseCamara: diputado Id=${idDiputado} con ${err.message} -> partido=null (CR-02)`,
        );
        partido = null;
      } else {
        throw err;
      }
    }

    const row: Parlamentario = {
      id: `D${idDiputado}`,
      nombre_normalizado,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      camara: "diputados",
      periodo: CAMARA_PERIODO,
      region: null,
      distrito: null,
      circunscripcion: null,
      partido,
      rut: null,
      parlid_senado: null,
      id_diputado_camara: idDiputado,
      estado: "no_confirmado",
      email: null,
      origen: ORIGEN,
      fecha_captura: fechaCaptura,
      enlace: CAMARA_URL,
    };
    out.push(ParlamentarioSeedSchema.parse(row));
  }

  // WR-05: piso de plausibilidad. Una respuesta inesperada (HTML de error 200, wrapper
  // renombrado) produciría 0/pocos diputados; fallar evita committear un snapshot vacío.
  if (out.length < MIN_DIPUTADOS) {
    throw new Error(
      `parseCamara: ${out.length} diputados (< ${MIN_DIPUTADOS}) — XML inesperado (WR-05)`,
    );
  }
  return out;
}
