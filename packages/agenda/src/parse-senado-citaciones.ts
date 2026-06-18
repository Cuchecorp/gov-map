// @obs/agenda — parser de citaciones de comisiones del Senado (JSON real de
// `web-back.senado.cl/api/commissions_citations`).
//
// Forma validada LIVE (06-RESEARCH): `{ data: [ { FECHA:"18/06/2026", CITACIONES:[ {
//   ID_CITACION, ID_COMISION, COMINOMBRE, LUGAR, FECHA, HORARIO, MATERIA, SIN_EFECTO,
//   PUNTOS_PROPUESTOS:[{ NUMERO_BOLETIN, ID_PROYECTO, MATERIA, TIPO_TRAMITE }] } ] } ] }`.
//
// Cruce por boletín: `PUNTOS_PROPUESTOS[].NUMERO_BOLETIN` (nullable) → proyecto.boletin
// (Fase 5). La API NO expone invitados → `invitados:[]`. Ventana forward-only (sin
// histórico por esta vía). zod por fila: una citación que no valida se descarta (T-06-04).

import {
  CitacionSchema,
  type Citacion,
  type CitacionPunto,
} from "./model";
import { isoWeekOf, semanaIsoKey } from "./semana-iso";

const ORIGEN = "senado-commissions-citations";
const ENLACE = "https://web-back.senado.cl/api/commissions_citations?limit=100";

/** Parsea "DD/MM/YYYY" → "YYYY-MM-DD" (sin `new Date(str)` ambiguo). null si no casa. */
export function parseFechaDmy(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = String(Number(m[1])).padStart(2, "0");
  const mm = String(Number(m[2])).padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

/** Semana ISO "YYYY-Www" desde una fecha ISO "YYYY-MM-DD"; "" si la fecha no es válida. */
function semanaIsoDeFechaIso(fechaIso: string): string {
  const m = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const { year, week } = isoWeekOf(d);
  return semanaIsoKey(year, week);
}

function asStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function asIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/**
 * Hash corto y estable (djb2 → base36) de un texto. Determinista entre corridas:
 * se usa para disambiguar la clave natural de fallback cuando falta ID_CITACION
 * (WR-02), evitando que dos citaciones distintas del mismo slot colapsen en una.
 */
function hashCorto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Parsea el JSON (string u objeto ya parseado) de `commissions_citations` a `Citacion[]`.
 */
export function parseSenadoCitaciones(
  input: string | unknown,
  opciones: { fechaCaptura?: string } = {},
): Citacion[] {
  const root = typeof input === "string" ? JSON.parse(input) : input;
  const data: unknown[] = Array.isArray((root as { data?: unknown }).data)
    ? ((root as { data: unknown[] }).data)
    : [];
  const fechaCaptura = opciones.fechaCaptura ?? new Date().toISOString();

  const citaciones: Citacion[] = [];

  for (const diaRaw of data) {
    const dia = diaRaw as { FECHA?: unknown; CITACIONES?: unknown };
    const fechaDia = parseFechaDmy(dia.FECHA);
    const citacionesDia: unknown[] = Array.isArray(dia.CITACIONES) ? dia.CITACIONES : [];

    for (const cRaw of citacionesDia) {
      const c = cRaw as Record<string, unknown>;
      // Preferir la FECHA de la citación; caer a la del día.
      const fecha = parseFechaDmy(c.FECHA) ?? fechaDia;
      if (!fecha) continue; // sin fecha confiable → descarta (no fabrica)

      const comision = asStringOrNull(c.COMINOMBRE);
      const horario = asStringOrNull(c.HORARIO);
      if (!comision || !horario) continue;

      const sinEfecto = Number(c.SIN_EFECTO) === 1;

      const puntosRaw: unknown[] = Array.isArray(c.PUNTOS_PROPUESTOS)
        ? c.PUNTOS_PROPUESTOS
        : [];
      const puntos: CitacionPunto[] = puntosRaw.map((pRaw) => {
        const p = pRaw as Record<string, unknown>;
        return {
          boletin: asStringOrNull(p.NUMERO_BOLETIN),
          id_proyecto: asIntOrNull(p.ID_PROYECTO),
          materia: asStringOrNull(p.MATERIA),
          tipo_tramite: asStringOrNull(p.TIPO_TRAMITE),
        };
      });

      const lugar = asStringOrNull(c.LUGAR);
      const materia = asStringOrNull(c.MATERIA);
      const idCitacion = asStringOrNull(c.ID_CITACION);
      // WR-02: sin ID_CITACION, la clave de fallback incorpora un disambiguador
      // de campos intrínsecos (lugar + hash de materia) para que dos citaciones
      // distintas del mismo slot (comisión+fecha+horario) NO colapsen en una sola
      // (el writer es last-write-wins por id). El hash es estable entre corridas.
      const discLugar = lugar ? `:${lugar}` : "";
      const discMateria = materia ? `:${hashCorto(materia)}` : "";
      const id = idCitacion
        ? `senado:citacion:${idCitacion}`
        : `senado:citacion:${comision}:${fecha}:${horario}${discLugar}${discMateria}`;

      const candidata: Citacion = {
        id,
        camara: "senado",
        comision,
        fecha,
        horario,
        sala: lugar,
        materia,
        estado: sinEfecto ? "Sin efecto" : null,
        semana_iso: semanaIsoDeFechaIso(fecha),
        invitados: [], // la API de citaciones del Senado no expone invitados (T-06-02)
        puntos,
        origen: ORIGEN,
        fecha_captura: fechaCaptura,
        enlace: ENLACE,
      };

      const parsed = CitacionSchema.safeParse(candidata);
      if (!parsed.success) {
        console.warn(
          `[parse-senado-citaciones] citación descartada (drift): ${comision} ${fecha}`,
          parsed.error.issues,
        );
        continue;
      }
      citaciones.push(parsed.data as Citacion);
    }
  }

  return citaciones;
}
