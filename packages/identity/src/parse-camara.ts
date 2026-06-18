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

/** Lee FechaTermino tolerando el nodo self-closing `xsi:nil` (llega como objeto/""). */
function fechaTerminoOf(m: MilitanciaRaw): Date | null {
  const v = m.FechaTermino;
  if (v == null) return null;
  if (typeof v === "object") return null; // <FechaTermino xsi:nil="true" /> -> {}
  const s = String(v).trim();
  return s.length === 0 ? null : new Date(s);
}

/**
 * Elige el partido de la militancia cuyo rango cubre `corte`. FechaTermino nil/ausente
 * = vigente (sin fin). Devuelve el Alias (o Nombre) del partido, o null si ninguna cubre.
 */
export function partidoVigente(
  militancias: MilitanciaRaw[],
  corte: Date,
): string | null {
  const activa = militancias.find((m) => {
    const ini = m.FechaInicio != null ? new Date(String(m.FechaInicio)) : null;
    const fin = fechaTerminoOf(m);
    const tras = ini == null || ini <= corte;
    const antes = fin == null || fin >= corte;
    return tras && antes;
  });
  if (!activa?.Partido) return null;
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

/**
 * Parsea el XML de la Cámara a un array de `Parlamentario` (155 vigentes). Cada fila se
 * valida con `ParlamentarioSeedSchema`; un shape inválido lanza (compuerta de contrato).
 */
export function parseCamara(
  xml: string,
  opts: { fechaCaptura?: string; corte?: Date } = {},
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

  const out: Parlamentario[] = [];
  for (const per of periodos) {
    const d = per.Diputado;
    if (!d) continue;
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

    const row: Parlamentario = {
      id: `D${str(d.Id) ?? "?"}`,
      nombre_normalizado,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      camara: "diputados",
      periodo: CAMARA_PERIODO,
      region: null,
      distrito: null,
      circunscripcion: null,
      partido: partidoVigente(militancias, corte),
      rut: null,
      parlid_senado: null,
      id_diputado_camara: str(d.Id),
      estado: "no_confirmado",
      email: null,
      origen: ORIGEN,
      fecha_captura: fechaCaptura,
      enlace: CAMARA_URL,
    };
    out.push(ParlamentarioSeedSchema.parse(row));
  }
  return out;
}
