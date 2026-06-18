/**
 * parse-senado — XML del catálogo de senadores vigentes → modelo `Parlamentario`.
 *
 * Fuente: https://tramitacion.senado.cl/wspublico/senadores_vigentes.php (XML).
 * Forma real (capturada live 2026-06-18): `<senadores><senador>...</senador></senadores>`
 * con PARLID, PARLAPELLIDOPATERNO, PARLAPELLIDOMATERNO, PARLNOMBRE, REGION,
 * CIRCUNSCRIPCION, PARTIDO, FONO, EMAIL, CURRICULUM.
 *
 * Decisiones:
 *  - `periodo` = "senado-vigente-2026" (Open Question 2 / A2): los senadores vigentes
 *    son un único conjunto "vigentes hoy"; la clave (cámara, periodo) sólo necesita ser
 *    consistente DENTRO de la cámara. NO se infiere el periodo senatorial escalonado.
 *  - `rut`/`distrito`/`id_diputado_camara` quedan null (el catálogo no los trae; Pitfall 4).
 *  - `estado` inicial = "no_confirmado": la promoción a `confirmado` es revisión humana
 *    (compuerta ID-01); el parser NUNCA auto-confirma.
 *  - `nombre_normalizado` vía `normalizarNombre` (clave de comparación; display = campos
 *    originales).
 *  - El shape parseado se valida con `ParlamentarioSeedSchema` (zod) antes de devolver.
 */

import { XMLParser } from "fast-xml-parser";
import {
  type Parlamentario,
  ParlamentarioSeedSchema,
  normalizarNombre,
} from "@obs/core";

export const SENADO_URL =
  "https://tramitacion.senado.cl/wspublico/senadores_vigentes.php";

/** Etiqueta de periodo consistente para senadores vigentes (A2). */
export const SENADO_PERIODO = "senado-vigente-2026";

const ORIGEN = "senado";

/** `parseTagValue:false` mantiene todo como string (PARLID, CIRCUNSCRIPCION). */
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

/** Normaliza a string-no-vacío o null (los nodos vacíos llegan como "" o {}). */
function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null; // nodo self-closing -> {}
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

interface SenadorRaw {
  PARLID?: unknown;
  PARLAPELLIDOPATERNO?: unknown;
  PARLAPELLIDOMATERNO?: unknown;
  PARLNOMBRE?: unknown;
  REGION?: unknown;
  CIRCUNSCRIPCION?: unknown;
  PARTIDO?: unknown;
  EMAIL?: unknown;
}

/**
 * Parsea el XML del Senado a un array de `Parlamentario`. Cada fila se valida con
 * `ParlamentarioSeedSchema`; un shape inválido lanza (compuerta de contrato, T-03-09).
 */
export function parseSenado(
  xml: string,
  opts: { fechaCaptura?: string } = {},
): Parlamentario[] {
  const doc = parser.parse(xml) as {
    senadores?: { senador?: SenadorRaw | SenadorRaw[] };
  };
  const senadores: SenadorRaw[] = ([] as SenadorRaw[]).concat(
    doc.senadores?.senador ?? [],
  );
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();

  return senadores.map((s) => {
    const apellidoPaterno = str(s.PARLAPELLIDOPATERNO) ?? "";
    const apellidoMaterno = str(s.PARLAPELLIDOMATERNO) ?? "";
    const nombres = str(s.PARLNOMBRE) ?? "";
    const { nombre_normalizado } = normalizarNombre({
      nombres,
      apellidoPaterno,
      apellidoMaterno,
    });

    const row: Parlamentario = {
      id: `S${str(s.PARLID) ?? "?"}`,
      nombre_normalizado,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      camara: "senado",
      periodo: SENADO_PERIODO,
      region: str(s.REGION),
      distrito: null,
      circunscripcion: str(s.CIRCUNSCRIPCION),
      partido: str(s.PARTIDO),
      rut: null,
      parlid_senado: str(s.PARLID),
      id_diputado_camara: null,
      estado: "no_confirmado",
      email: str(s.EMAIL),
      origen: ORIGEN,
      fecha_captura: fechaCaptura,
      enlace: SENADO_URL,
    };
    return ParlamentarioSeedSchema.parse(row);
  });
}
