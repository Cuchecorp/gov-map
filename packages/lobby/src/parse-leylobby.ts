// @obs/lobby — parser cheerio del HTML de audiencias de la Ley del Lobby (leylobby.gob.cl).
//
// Estructura validada LIVE 2026-06-19 (ver test/fixtures/audiencias-congreso.html):
// una `<table class="table">` con columnas fijas
//   Fecha | Identificador | Asistentes(rol, nombre) | Representados | Materia | Detalle
// Cada AUDIENCIA es un grupo de `<tr>`: la PRIMERA fila del grupo lleva las celdas con
// `rowspan` (Fecha, Identificador, Representados, Materia, Detalle) + el primer asistente
// (rol, nombre); las filas siguientes del grupo llevan SOLO (rol, nombre). Un nuevo grupo se
// detecta porque la fila trae una celda `Identificador` (`{INST}AW{N}`).
//
// CLAVE NATURAL (Pitfall 1): la audiencia se keya por el cell `Identificador`, NUNCA por el
// número de URL del listado. NO se fabrica nada: una audiencia que no valida con
// `LobbyAudienciaSchema` (p.ej. sin Identificador) se descarta y se registra (drift).
//
// Column-agnostic respecto al rol (Assumption A2): guarda `rol` crudo; el caller decide quién es
// el sujeto pasivo (`rol === "Sujeto Pasivo"`) y quién es contraparte.

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import {
  LobbyAudienciaSchema,
  type LobbyAudiencia,
  type LobbyAsistente,
} from "./model";

const ORIGEN = "leylobby-audiencias";

/** `{INST}AW{N}` — p.ej. `AA001AW1639516`. El cell Identificador encaja esto. */
const IDENTIFICADOR_RE = /^[A-Z0-9]+AW\d+$/;

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Parsea la fecha de leylobby (`2024-06-24 12:30:00-04`) a ISO 8601. Si no parsea, devuelve
 * null (el caller preserva `fechaRaw` — NUNCA se fabrica una fecha).
 */
export function parseFechaLeylobby(raw: string): string | null {
  const t = normWs(raw);
  if (!t) return null;
  // leylobby emite `2024-06-24 12:30:00-04` (offset SIN minutos). `Date` requiere `-04:00`:
  // se normaliza un offset de 2 dígitos al final a `±HH:00` antes de parsear. NUNCA fabrica:
  // si tras normalizar no parsea, devuelve null.
  let iso = t.replace(" ", "T");
  iso = iso.replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ¿El texto de la celda es un Identificador de leylobby (`{INST}AW{N}`)? */
function esIdentificador(texto: string): boolean {
  return IDENTIFICADOR_RE.test(normWs(texto));
}

/** Deriva el código de institución de un Identificador (`AA001AW123` → `AA001`). */
export function institucionDeIdentificador(identificador: string): string {
  const m = normWs(identificador).match(/^([A-Z0-9]+)AW\d+$/);
  return m ? m[1]! : "";
}

/** Acumulador mutable de una audiencia en construcción (un grupo de `<tr>`). */
interface AudienciaEnConstruccion {
  identificador: string;
  fechaRaw: string | null;
  representado: string | null;
  materia: string | null;
  enlaceDetalle: string | null;
  asistentes: LobbyAsistente[];
}

/**
 * Parsea el HTML de un listado de audiencias de leylobby a `LobbyAudiencia[]`.
 *
 * @param html        HTML crudo de `/instituciones/{CODE}/audiencias/{year}[/{rowId}]`.
 * @param opciones    `institucionCodigo` (fallback si el Identificador no lo trae), `enlace`,
 *                    `fechaCaptura` (para procedencia determinista en tests).
 */
export function parseLobbyAudiencias(
  html: string,
  opciones: {
    institucionCodigo?: string;
    enlace?: string;
    fechaCaptura?: string;
  } = {},
): LobbyAudiencia[] {
  const $ = cheerio.load(html);
  const fechaCaptura = opciones.fechaCaptura ?? new Date().toISOString();
  const enlace = opciones.enlace ?? "https://www.leylobby.gob.cl/instituciones";

  const grupos: AudienciaEnConstruccion[] = [];
  let actual: AudienciaEnConstruccion | null = null;

  $("table.table > tbody > tr").each((_i, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length === 0) return;

    // ¿Esta fila ABRE una nueva audiencia? Lo hace si alguna celda es un Identificador.
    let idxIdentificador = -1;
    tds.each((j, td) => {
      if (idxIdentificador === -1 && esIdentificador($(td).text())) idxIdentificador = j;
    });

    if (idxIdentificador >= 0) {
      // Fila de apertura: cierra el grupo previo y abre uno nuevo.
      if (actual) grupos.push(actual);

      const identificador = normWs($(tds[idxIdentificador]).text());
      // La Fecha es la celda anterior al Identificador (col 0); si no, busca una celda
      // con `data-toggle="moment"`.
      const fechaCell = leerFechaCell($, tds);
      // Tras el Identificador vienen: rol, nombre (del primer asistente), luego
      // Representados, Materia, Detalle (con rowspan). Se leen por posición relativa.
      const rol = idxIdentificador + 1 < tds.length ? normWs($(tds[idxIdentificador + 1]).text()) : "";
      const nombre = idxIdentificador + 2 < tds.length ? normWs($(tds[idxIdentificador + 2]).text()) : "";
      const representado = leerCeldaRowspan($, tds, idxIdentificador + 3);
      const materia = leerCeldaRowspan($, tds, idxIdentificador + 4);
      const enlaceDetalle = leerEnlaceDetalle($, tds, idxIdentificador + 5);

      actual = {
        identificador,
        fechaRaw: fechaCell,
        representado: representado || null,
        materia: materia || null,
        enlaceDetalle: enlaceDetalle || null,
        asistentes: [],
      };
      if (nombre) {
        actual.asistentes.push({ rol, nombre, representado: representado || null });
      }
      return;
    }

    // Fila de CONTINUACIÓN: EXACTAMENTE 2 celdas (rol, nombre) de un asistente adicional del
    // grupo abierto. Una fila con ≠2 celdas y sin Identificador NO es una continuación válida
    // (p.ej. una fila con Fecha pero sin Identificador es drift): se descarta, NUNCA se anexa
    // a la audiencia previa (evita contaminar una audiencia con un asistente fabricado).
    if (!actual) return;
    if (tds.length !== 2) {
      console.warn(
        `[parse-leylobby] fila descartada (drift: ${tds.length} celdas, sin Identificador)`,
      );
      return;
    }
    const rol = normWs($(tds[0]).text());
    const nombre = normWs($(tds[1]).text());
    if (nombre) {
      // Las filas de continuación no repiten Representados (viene por rowspan en la 1.ª fila):
      // las contrapartes adicionales comparten el representado del grupo si lo hubo.
      (actual as AudienciaEnConstruccion).asistentes.push({
        rol,
        nombre,
        representado: (actual as AudienciaEnConstruccion).representado,
      });
    }
  });
  if (actual) grupos.push(actual);

  // Construye + valida. Una audiencia sin Identificador NUNCA llega aquí (el grupo solo se
  // abre con un Identificador); el caso malformado de fixture (fila sin Identificador) se
  // descarta como fila de continuación huérfana o falla el schema.
  const audiencias: LobbyAudiencia[] = [];
  for (const g of grupos) {
    const candidata: LobbyAudiencia = {
      identificador: g.identificador,
      institucionCodigo:
        institucionDeIdentificador(g.identificador) || (opciones.institucionCodigo ?? ""),
      fecha: g.fechaRaw ? parseFechaLeylobby(g.fechaRaw) : null,
      fechaRaw: g.fechaRaw,
      materia: g.materia,
      enlaceDetalle: g.enlaceDetalle,
      asistentes: g.asistentes,
      origen: ORIGEN,
      fecha_captura: fechaCaptura,
      enlace,
    };
    const parsed = LobbyAudienciaSchema.safeParse(candidata);
    if (!parsed.success) {
      console.warn(
        `[parse-leylobby] audiencia descartada (drift): "${g.identificador}"`,
        parsed.error.issues,
      );
      continue;
    }
    audiencias.push(parsed.data as LobbyAudiencia);
  }
  return audiencias;
}

type Celdas = ReturnType<CheerioAPI>;

/** Lee la celda Fecha de la fila de apertura (celda `data-toggle="moment"` o la col 0). */
function leerFechaCell($: CheerioAPI, tds: Celdas): string | null {
  const moment = tds.filter("[data-toggle='moment']").first();
  const raw = moment.length ? moment.text() : $(tds[0]).text();
  const t = normWs(raw);
  return t || null;
}

/** Lee la celda en `idx` (con rowspan en la fila de apertura). '' si fuera de rango. */
function leerCeldaRowspan($: CheerioAPI, tds: Celdas, idx: number): string {
  if (idx >= tds.length) return "";
  return normWs($(tds[idx]).text());
}

/** Lee el href del "Ver Detalle" de la celda Detalle (idx), o '' si no hay. */
function leerEnlaceDetalle($: CheerioAPI, tds: Celdas, idx: number): string {
  if (idx >= tds.length) return "";
  const a = $(tds[idx]).find("a").first();
  return a.length ? normWs(a.attr("href") ?? "") : "";
}
