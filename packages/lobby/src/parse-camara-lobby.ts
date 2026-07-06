// @obs/lobby — parser cheerio del HTML de audiencias de lobby del portal propio de la Cámara
// de Diputados (`camara.cl/transparencia/listadodeaudiencias.aspx`). Fuente DISTINTA de
// leylobby.gob.cl (el Ejecutivo): la Cámara publica su lobby en su propio portal de
// transparencia (PROJECT.md / Phase 24).
//
// Estructura validada LIVE (spike Phase 24): UNA `<table>` (~17.776 filas, ~12 MB, sin
// paginación) con 5 columnas reales por fila de datos:
//   [0] Sujeto Pasivo (diputado) | [1] Fecha | [2] Lobbista representado | [3] Lugar | [4] Materia
// La columna "Detalles" existe en el markup pero está HTML-COMENTADA (no es un <td>): NO hay id
// ni link de detalle utilizable. La fila de cabecera se repite DENTRO de la tabla como
// `<tr id="mytr">` con celdas `<th>` — se salta detectando cualquier `<th>`.
//
// CLAVE NATURAL (Pitfall 1): la fuente NO trae id. Se SINTETIZA una clave determinista
// (`CAMARA-<sha256(...).slice(0,16)>`) sobre el join normalizado de las 5 celdas → escrituras
// idempotentes; ~37 filas verdaderamente duplicadas colapsan en el dedup por `identificador`.
//
// Sujeto Pasivo puede ser un ASESOR (p.ej. "... (Asesor(a) H.D. Cristian Mella Andaur)"): el
// diputado real es el `H.D. <nombre>` entre paréntesis. NO se parsea aquí — se PRESERVA el
// nombre RAW verbatim (la adjudicación de identidad es una fase posterior).
//
// NOTA: la columna `Lugar` NO se persiste — el modelo `LobbyAudiencia` / schema 0021 no tiene
// campo `lugar` (diferido; fuera de alcance de Phase 24 para no abrir una migración).

import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import {
  LobbyAudienciaSchema,
  ROL_SUJETO_PASIVO,
  type LobbyAudiencia,
  type LobbyAsistente,
} from "./model";

const ORIGEN = "camara-transparencia-lobby";
const URL_LISTADO = "https://www.camara.cl/transparencia/listadodeaudiencias.aspx";

/** Meses abreviados en español (DD mmm. YYYY → índice 0-based). */
const MESES: Readonly<Record<string, number>> = Object.freeze({
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
});

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const TZ_CHILE = "America/Santiago";

/** Partes wall-clock en Chile (DST-safe; h23 evita "24:00"). Formatter cacheado. */
const PARTES_CHILE = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_CHILE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock de Chile del instante `t` (ms UTC), re-expresado como ms UTC (para restar). */
function wallChileComoUtc(t: number): number {
  const p: Record<string, number> = {};
  for (const parte of PARTES_CHILE.formatToParts(t)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

/**
 * Instante UTC (ms) de la MEDIANOCHE de Chile del día calendario pedido. El offset real
 * (-04 invierno / -03 verano) se DERIVA vía Intl (tzdb), nunca se hardcodea (CR-02).
 * Si la medianoche no existe (el salto DST chileno ocurre a las 24:00 → el día del
 * cambio arranca a la 01:00), devuelve el primer instante existente de ese día.
 */
function instanteMedianocheChile(anio: number, mes: number, dia: number): number {
  const objetivo = Date.UTC(anio, mes, dia);
  let t = objetivo;
  // Dos pasadas de corrección por offset (con offset estable converge en la primera).
  for (let i = 0; i < 2; i++) t = objetivo - (wallChileComoUtc(t) - t);
  // Medianoche inexistente (salto DST): el wall queda en el día anterior — avanza de a
  // 1 h hasta caer dentro del día pedido (a lo más 2 h; guard acotado).
  for (let guard = 0; guard < 3 && wallChileComoUtc(t) < objetivo; guard++) {
    t += 3_600_000;
  }
  return t;
}

/**
 * Parsea la fecha de la Cámara (`26 jun. 2026` — DD mmm. YYYY, mes abreviado con punto) a
 * ISO 8601. La fuente imprime un DÍA CALENDARIO de CHILE: se ancla a la MEDIANOCHE de
 * `America/Santiago` (p.ej. `2026-06-26T04:00:00.000Z` ≡ `2026-06-26T00:00:00-04:00`),
 * NO a la medianoche UTC — así `fecha at time zone 'America/Santiago'` (RPC 0048)
 * recupera el día calendario impreso y la semana ISO del cruce no se corre (CR-02: con
 * medianoche UTC, toda audiencia de LUNES caía en la semana ISO anterior).
 * Si no parsea, devuelve null (el caller preserva `fechaRaw` — NUNCA fabrica).
 */
export function parseFechaCamara(raw: string): string | null {
  const t = normWs(raw);
  if (!t) return null;
  // `26 jun. 2026` → ["26", "jun.", "2026"]. El mes puede traer punto: se quita.
  const m = t.match(/^(\d{1,2})\s+([a-záéíóúñ]+)\.?\s+(\d{4})$/i);
  if (!m) return null;
  const dia = Number(m[1]);
  const mesKey = m[2]!.toLowerCase().replace(/\.$/, "").slice(0, 3);
  const anio = Number(m[3]);
  const mes = MESES[mesKey];
  if (mes === undefined || !Number.isFinite(dia) || !Number.isFinite(anio)) return null;
  if (dia < 1 || dia > 31) return null;
  // Verifica que la fecha no haya "rebalsado" (p.ej. 31 feb → mar) sobre una fecha UTC
  // neutra: si el día/mes cambió, drift.
  const chequeo = new Date(Date.UTC(anio, mes, dia));
  if (Number.isNaN(chequeo.getTime())) return null;
  if (chequeo.getUTCDate() !== dia || chequeo.getUTCMonth() !== mes) return null;
  return new Date(instanteMedianocheChile(anio, mes, dia)).toISOString();
}

/** Clave natural determinista sintetizada (la fuente no trae id). `CAMARA-<sha256 16 hex>`. */
function sintetizarIdentificador(
  sujeto: string,
  fechaRaw: string,
  lobbista: string,
  lugar: string,
  materia: string,
): string {
  const base = `${sujeto}|${fechaRaw}|${lobbista}|${lugar}|${materia}`;
  const hex = createHash("sha256").update(base, "utf8").digest("hex");
  return `CAMARA-${hex.slice(0, 16)}`;
}

/**
 * Parsea el HTML del listado de audiencias de la Cámara a `LobbyAudiencia[]`.
 *
 * Itera las filas de la tabla; salta filas con cualquier `<th>` (cabecera) y filas con menos de
 * 5 `<td>`. Por cada fila de datos lee las 5 celdas (whitespace normalizado), sintetiza la clave
 * natural, valida con `LobbyAudienciaSchema.safeParse` (drift → warn + skip, NUNCA fabrica) y
 * deduplica por `identificador` (primera ocurrencia gana → idempotencia).
 *
 * @param opciones `enlace`, `fechaCaptura` (procedencia determinista en tests).
 */
export function parseCamaraLobbyAudiencias(
  html: string,
  opciones: { enlace?: string; fechaCaptura?: string } = {},
): LobbyAudiencia[] {
  const $ = cheerio.load(html);
  const fechaCaptura = opciones.fechaCaptura ?? new Date().toISOString();
  const enlace = opciones.enlace ?? URL_LISTADO;

  const audiencias: LobbyAudiencia[] = [];
  const vistos = new Set<string>();

  $("table tr").each((_i, tr) => {
    const $tr = $(tr);
    // La cabecera se repite dentro de la tabla como `<tr id="mytr">` con `<th>`: se salta.
    if ($tr.find("> th").length > 0) return;
    const tds = $tr.find("> td");
    if (tds.length < 5) return;

    const sujetoRaw = normWs($(tds[0]).text());
    const fechaRaw = normWs($(tds[1]).text());
    const lobbistaRaw = normWs($(tds[2]).text());
    const lugarRaw = normWs($(tds[3]).text());
    const materiaRaw = normWs($(tds[4]).text());

    const identificador = sintetizarIdentificador(
      sujetoRaw,
      fechaRaw,
      lobbistaRaw,
      lugarRaw,
      materiaRaw,
    );

    const asistentes: LobbyAsistente[] = [
      { rol: ROL_SUJETO_PASIVO, nombre: sujetoRaw, representado: null },
    ];
    if (lobbistaRaw) {
      asistentes.push({ rol: "Lobbista", nombre: lobbistaRaw, representado: null });
    }

    const candidata: LobbyAudiencia = {
      identificador,
      institucionCodigo: "CAMARA",
      fecha: parseFechaCamara(fechaRaw),
      fechaRaw: fechaRaw || null,
      materia: materiaRaw || null,
      enlaceDetalle: null,
      asistentes,
      origen: ORIGEN,
      fecha_captura: fechaCaptura,
      enlace,
    };

    const parsed = LobbyAudienciaSchema.safeParse(candidata);
    if (!parsed.success) {
      console.warn(
        `[parse-camara-lobby] audiencia descartada (drift): "${identificador}"`,
        parsed.error.issues,
      );
      return;
    }

    // Dedup por clave natural sintetizada (primera ocurrencia gana): ~37 filas verdaderamente
    // duplicadas colapsan → escrituras idempotentes.
    if (vistos.has(identificador)) return;
    vistos.add(identificador);
    audiencias.push(parsed.data as LobbyAudiencia);
  });

  return audiencias;
}
