// parse-diputados — XML de `retornarDiputadosPeriodoActual` (opendata.camara.cl) → bio de
// diputados con MILITANCIA histórica + vigente, SIN PII (allowlist por construcción).
//
// Fuente (research VERDICT 1, live 2026-07-22, 155 <DiputadoPeriodo>):
//   https://opendata.camara.cl/.../WSDiputado.asmx/retornarDiputadosPeriodoActual
//   <DiputadosPeriodoColeccion><DiputadoPeriodo><Diputado>
//     <Id> (= id_diputado_camara = DIPID, clave de match) · Nombre/Nombre2/ApellidoPaterno/
//     ApellidoMaterno · <Militancias><Militancia><FechaInicio><FechaTermino><Partido>{Id,Nombre,Alias}
//   El XML SÍ trae PII: <FechaNacimiento>, <RUT>/<RUTDV>, <Sexo>.
//
// ALLOWLIST POR CONSTRUCCIÓN (research Pattern 2, Ley 21.719): este parser lee SOLO <Id>,
// nombres/apellidos (para el nombre normalizado del match) y <Militancias>. Los nodos
// <FechaNacimiento>/<RUT>/<RUTDV>/<Sexo> NO se leen ni se mapean — no existen en el objeto
// emitido. La defensa es AUSENCIA estructural, no un `null` defensivo. Un test que MUERDE
// (parse-diputados.test.ts) prueba que el JSON del modelo no contiene la PII del fixture.
//
// Militancia vigente ("actual"): copia la lógica de partidoVigente de
// @obs/identity/parse-camara — entre las militancias cuyo rango [FechaInicio, FechaTermino-nil]
// cubre el corte, elige la de FechaInicio MÁS RECIENTE (WR-04: el orden del XML no garantiza
// recencia). Fail-loud (FechaInvalidaError) ante fecha malformada — NUNCA un Invalid Date
// silencioso que descartaría la militancia correcta y asignaría un partido stale (T-90-STALE).

import { XMLParser } from "fast-xml-parser";
import { normalizarNombre } from "@obs/core";

export const DIPUTADOS_BIO_URL =
  "https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual";

/** Fecha de corte de vigencia = inicio del periodo 2026-2030 (espeja parse-camara). */
export const CORTE_VIGENCIA = new Date("2026-03-11T12:00:00");

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

/** Militancia mapeada (SIN PII), forma consumida por el runner (mapea a `Militancia` del modelo). */
export interface MilitanciaBio {
  /** Nombre crudo del partido (o Alias si no hay Nombre). */
  partido: string;
  /** Alias/forma normalizada del partido (parte de la clave natural). */
  partidoAlias: string;
  /** ISO date de inicio de la militancia (string crudo de la fuente). */
  desde: string;
  /** ISO date de término, o null si vigente (FechaTermino xsi:nil). */
  hasta: string | null;
  /** true si es la militancia vigente al corte. */
  esActual: boolean;
}

/** Bio de un diputado tras el allowlist: DIPID + nombre normalizado + militancias (SIN PII). */
export interface DiputadoBio {
  /** <Id> del <Diputado> = id_diputado_camara (clave de match exacto contra la maestra). */
  dipid: string;
  /** nombre_normalizado (materno-less) para el match / display; NUNCA PII. */
  nombreNormalizado: string;
  /** Militancias mapeadas (histórico + actual). */
  militancias: MilitanciaBio[];
}

/**
 * Error de fecha de militancia malformada (fail-closed). Se lanza ante un string de fecha que
 * NO parsea, en vez de dejar pasar un `Invalid Date` (que haría toda comparación `false` y
 * asignaría un partido stale sin error — riesgo T-90-STALE).
 */
export class FechaInvalidaError extends Error {
  constructor(readonly valor: string) {
    super(`militancia: fecha inválida "${valor}"`);
    this.name = "FechaInvalidaError";
  }
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null; // nodo self-closing / atributos → no es texto
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * WR-04: el `<Id>` (DIPID) es la ÚNICA clave de match. `str()` colapsa "ausente" y
 * "presente-pero-no-escalar" al mismo `null` → un `<Id>` que llega como objeto (atributos, nesting
 * inesperado por deriva del markup) se trataría como "sin Id" y el diputado se saltaría en silencio,
 * reduciendo cobertura sin error. Aquí distinguimos: ausente/vacío → `null` (skip legítimo);
 * presente-pero-no-escalar → LANZA (misma rigurosidad fail-loud que las fechas), para que un cambio
 * de formato de la fuente SURJA en vez de encoger la corrida calladamente.
 */
export class IdNoEscalarError extends Error {
  constructor(readonly valor: unknown) {
    super(`parseDiputadosBio: <Id> presente pero no escalar (${JSON.stringify(valor)}) — posible deriva de formato de la fuente`);
    this.name = "IdNoEscalarError";
  }
}

function strMatchKey(v: unknown): string | null {
  if (v == null) return null; // ausente → skip legítimo
  if (typeof v === "object") throw new IdNoEscalarError(v); // presente pero no escalar → fail-loud
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * Parsea una fecha FAIL-CLOSED: `null` si ausente/vacía (semántica legítima: vigente sin fin),
 * un `Date` válido si parsea, y LANZA `FechaInvalidaError` si el string no es parseable.
 * NUNCA devuelve un `Invalid Date`.
 */
function parseFecha(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === "object") return null; // <FechaTermino xsi:nil> llega como objeto/""
  const s = String(v).trim();
  if (s.length === 0) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new FechaInvalidaError(s);
  }
  return d;
}

interface PartidoRaw {
  Id?: unknown;
  Nombre?: unknown;
  Alias?: unknown;
}
interface MilitanciaRaw {
  FechaInicio?: unknown;
  FechaTermino?: unknown;
  Partido?: PartidoRaw;
}
interface DiputadoRaw {
  Id?: unknown;
  Nombre?: unknown;
  Nombre2?: unknown;
  ApellidoPaterno?: unknown;
  ApellidoMaterno?: unknown;
  // NOTA (allowlist): FechaNacimiento/RUT/RUTDV/Sexo NO se declaran aquí — no se leen ni mapean.
  Militancias?: { Militancia?: MilitanciaRaw | MilitanciaRaw[] };
}
interface DiputadoPeriodoRaw {
  Diputado?: DiputadoRaw;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return ([] as T[]).concat(v ?? []);
}

/**
 * Índice de la militancia VIGENTE al `corte` dentro de `militancias`. FechaTermino nil/ausente =
 * vigente (sin fin). Entre TODAS las militancias cuyo rango cubre `corte`, elige la de
 * `FechaInicio` MÁS RECIENTE (WR-04). Devuelve -1 si ninguna cubre. Lanza `FechaInvalidaError`
 * ante fecha malformada (fail-closed).
 */
function indiceVigente(militancias: MilitanciaRaw[], corte: Date): number {
  let mejorIdx = -1;
  let mejorIni = -Infinity;
  for (let i = 0; i < militancias.length; i++) {
    const m = militancias[i]!;
    const ini = parseFecha(m.FechaInicio);
    const fin = parseFecha(m.FechaTermino);
    const tras = ini == null || ini <= corte;
    const antes = fin == null || fin >= corte;
    if (!(tras && antes)) continue;
    const iniT = ini?.getTime() ?? -Infinity;
    if (iniT > mejorIni) {
      mejorIni = iniT;
      mejorIdx = i;
    }
  }
  return mejorIdx;
}

function partidoDe(p: PartidoRaw | undefined): { partido: string; alias: string } | null {
  if (!p) return null;
  const nombre = str(p.Nombre);
  const alias = str(p.Alias);
  const partido = nombre ?? alias;
  if (partido == null) return null;
  return { partido, alias: alias ?? partido };
}

/**
 * Parsea el XML de la Cámara a `DiputadoBio[]` con allowlist por construcción. Cada diputado
 * emite DIPID + nombre normalizado + militancias mapeadas; la PII de la fuente jamás se lee.
 *
 * Fail-loud: una fecha de militancia malformada LANZA `FechaInvalidaError` (no un partido stale
 * silencioso). Un <Diputado> sin <Id> se salta (sin clave de match no hay bio enlazable).
 */
export function parseDiputadosBio(
  xml: string,
  opts: { fechaCaptura?: string; corte?: Date; log?: (msg: string) => void } = {},
): DiputadoBio[] {
  const doc = parser.parse(xml) as {
    DiputadosPeriodoColeccion?: {
      DiputadoPeriodo?: DiputadoPeriodoRaw | DiputadoPeriodoRaw[];
    };
  };
  const periodos = asArray(doc.DiputadosPeriodoColeccion?.DiputadoPeriodo);
  const corte = opts.corte ?? CORTE_VIGENCIA;
  const log = opts.log ?? (() => {});

  const out: DiputadoBio[] = [];
  for (const per of periodos) {
    const d = per.Diputado;
    if (!d) continue;

    const dipid = strMatchKey(d.Id); // WR-04: fail-loud si <Id> presente pero no escalar
    if (dipid == null) {
      log("parseDiputadosBio: <Diputado> sin <Id> — se salta (sin clave de match)");
      continue;
    }

    const nombre2 = str(d.Nombre2);
    const nombres = [str(d.Nombre), nombre2].filter((x): x is string => x != null).join(" ");
    const apellidoPaterno = str(d.ApellidoPaterno) ?? "";
    const apellidoMaterno = str(d.ApellidoMaterno) ?? "";
    const { nombre_normalizado } = normalizarNombre({
      nombres,
      apellidoPaterno,
      apellidoMaterno,
    });

    const rawMilitancias = asArray(d.Militancias?.Militancia);
    const vigenteIdx = indiceVigente(rawMilitancias, corte); // fail-loud propaga la excepción

    const militancias: MilitanciaBio[] = [];
    for (let i = 0; i < rawMilitancias.length; i++) {
      const m = rawMilitancias[i]!;
      const p = partidoDe(m.Partido);
      if (p == null) continue;
      // Fechas: crudas al modelo (string), pero validadas fail-closed arriba (indiceVigente ya
      // habría lanzado). `hasta` null si vigente.
      // CR-01 (fail-loud): `desde` alimenta una columna `date NOT NULL` (0059) y forma parte de la
      // clave natural (parlamentario_id, partido_alias, desde). Una militancia sin FechaInicio NO es
      // persistible: emitir `""` abortaría el upsert del lote entero (`''::date` inválido) o
      // degradaría la clave (WR-03). Se SALTA con conteo en el log (contrato explícito, no silencioso).
      const desdeRaw = str(m.FechaInicio);
      if (desdeRaw == null) {
        log(`parseDiputadosBio: DIP:${dipid} militancia "${p.partido}" sin FechaInicio → se salta (desde es NOT NULL)`);
        continue;
      }
      const hastaRaw = str(m.FechaTermino);
      militancias.push({
        partido: p.partido,
        partidoAlias: p.alias,
        desde: desdeRaw,
        hasta: hastaRaw,
        esActual: i === vigenteIdx,
      });
    }

    out.push({ dipid, nombreNormalizado: nombre_normalizado, militancias });
  }

  return out;
}
