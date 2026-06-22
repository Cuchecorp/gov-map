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

/**
 * Parsea la fecha de la Cámara (`26 jun. 2026` — DD mmm. YYYY, mes abreviado con punto) a
 * ISO 8601 (UTC). Si no parsea, devuelve null (el caller preserva `fechaRaw` — NUNCA fabrica).
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
  const d = new Date(Date.UTC(anio, mes, dia));
  if (Number.isNaN(d.getTime())) return null;
  // Verifica que la fecha no haya "rebalsado" (p.ej. 31 feb → mar): si el día/mes cambió, drift.
  if (d.getUTCDate() !== dia || d.getUTCMonth() !== mes) return null;
  return d.toISOString();
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
