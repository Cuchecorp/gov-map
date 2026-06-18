// @obs/agenda — parser de citaciones de comisiones de la Cámara (cheerio sobre el HTML
// real de `citaciones_semana.aspx?prmSemana={AÑO}-{SEMANA_ISO}`).
//
// Estructura validada LIVE (06-RESEARCH): un `<article class="grid-12 citaciones">` por
// día → `<p class="fecha">` (día es-CL) → `<table class="tabla"> > tbody > tr` con columnas
// fijas **Comisión | Horario | Sala | Citación | Invitados**. La última columna suele venir
// como `<td colspan="2">` con una TABLA ANIDADA de celdas `.w40` (materia) / `.w30`
// (invitados); el parser también soporta la forma de 2 `<td>` hermanos.
//
// Cruce por boletín: la materia contiene `N°NNNNN-NN` → `CitacionPunto.boletin`
// (→ proyecto.boletin de Fase 5). NO se fabrica nada: una fila que no valida con
// `CitacionSchema` se descarta y se registra (drift, T-06-04).

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import {
  CitacionSchema,
  type Citacion,
  type CitacionInvitado,
  type CitacionPunto,
} from "./model";

const ORIGEN = "camara-citaciones-semana";

/** Regex de boletín en la materia: `N°18296-05`, `N° 18.296-05`, `18296-05`. */
const BOLETIN_RE = /\bN?[°ºo]?\s?(\d{3,5})[.\s]?-?(\d{1,2})\b/gi;

const MESES_ES: Record<string, number> = {
  ENERO: 0,
  FEBRERO: 1,
  MARZO: 2,
  ABRIL: 3,
  MAYO: 4,
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
  SETIEMBRE: 8,
  OCTUBRE: 9,
  NOVIEMBRE: 10,
  DICIEMBRE: 11,
};

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Hash corto y estable (djb2 → base36) de un texto, para disambiguar claves
 * naturales SIN depender del orden de aparición (WR-01). Determinista entre
 * corridas: dos filas idénticas producen el mismo hash; dos filas distintas en
 * el mismo slot (comisión+fecha+horario+sala) producen hashes distintos.
 */
function hashCorto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Parsea "LUNES, 15 DE JUNIO DE 2026" → "2026-06-15" (ISO date). Devuelve el texto
 * normalizado tal cual si no casa (no fabrica una fecha falsa).
 */
export function parseFechaEsCl(texto: string): string {
  const t = normWs(texto).toUpperCase();
  const m = t.match(/(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚÜÑ]+)\s+DE\s+(\d{4})/);
  if (!m) return normWs(texto);
  const dia = Number(m[1]);
  const mes = MESES_ES[m[2]!];
  const anio = Number(m[3]);
  if (mes === undefined || !Number.isFinite(dia) || !Number.isFinite(anio)) {
    return normWs(texto);
  }
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes + 1).padStart(2, "0");
  return `${anio}-${mm}-${dd}`;
}

/** Extrae boletines `NNNNN-NN` del texto de la materia (dedup, en orden de aparición). */
function extraerBoletines(materia: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  BOLETIN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOLETIN_RE.exec(materia)) !== null) {
    const boletin = `${m[1]}-${m[2]}`;
    if (!seen.has(boletin)) {
      seen.add(boletin);
      out.push(boletin);
    }
  }
  return out;
}

/**
 * De la última columna (Citación + Invitados) devuelve los pares materia/invitados.
 * Forma A (la real del fixture): `<td colspan="2"><table>` con N filas, cada una con
 * `.w40` (materia) y `.w30` (invitados). Forma B: 2 `<td>` hermanos (materia, invitados).
 */
function leerCitacionInvitados(
  $: CheerioAPI,
  tds: ReturnType<CheerioAPI>,
): Array<{ materia: string; invitados: string }> {
  const last = $(tds[tds.length - 1]);
  const nested = last.find("table").first();
  const pares: Array<{ materia: string; invitados: string }> = [];

  if (nested.length > 0) {
    // Forma A: tabla anidada → cada <tr> aporta un par .w40 / .w30.
    nested.find("> tbody > tr, > tr").each((_i, tr) => {
      const cells = $(tr).find("> td");
      const w40 = cells.filter(".w40").first();
      const w30 = cells.filter(".w30").first();
      const materia = normWs((w40.length ? w40 : $(cells[0])).text());
      const invitados = normWs((w30.length ? w30 : $(cells[1])).text());
      if (materia || invitados) pares.push({ materia, invitados });
    });
    if (pares.length > 0) return pares;
  }

  // Forma B: la columna 4 es materia y la columna 5 (hermana) es invitados.
  const materia = normWs(last.text());
  const invitados = tds.length >= 5 ? normWs($(tds[4]).text()) : "";
  pares.push({ materia, invitados });
  return pares;
}

/**
 * Parsea el HTML de `citaciones_semana.aspx` a `Citacion[]` (Cámara). `semanaIso` es la
 * clave `YYYY-Www` de navegación; `enlace` permite registrar la procedencia exacta.
 */
export function parseCamaraCitaciones(
  html: string,
  semanaIso: string,
  opciones: { enlace?: string; fechaCaptura?: string } = {},
): Citacion[] {
  const $ = cheerio.load(html);
  const fechaCaptura = opciones.fechaCaptura ?? new Date().toISOString();
  const enlace =
    opciones.enlace ??
    "https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx";

  // Candidatas SIN id final: se acumulan con su `baseId` (clave natural intrínseca)
  // y se les asigna el id en un post-pase determinista e INDEPENDIENTE DEL ORDEN
  // (WR-01): dentro de un mismo baseId, los empates se disambiguan por el hash de
  // la materia ordenado, no por el orden de aparición en el HTML.
  type Candidata = { baseId: string; materia: string | null; row: Omit<Citacion, "id"> };
  const candidatas: Candidata[] = [];

  $("article.citaciones").each((_ai, art) => {
    const diaTexto = $(art).find("p.fecha").first().text();
    const fecha = parseFechaEsCl(diaTexto);

    $(art)
      .find("table.tabla > tbody > tr")
      .each((_ri, tr) => {
        const tds = $(tr).find("> td");
        if (tds.length < 4) return; // fila de cabecera/espaciado → ignora

        // Col 1: Comisión + estado (en <p style*="color:red">).
        const comisionCell = $(tds[0]);
        const estado =
          normWs(comisionCell.find('p[style*="color:red"]').text()) || null;
        const comisionClone = comisionCell.clone();
        comisionClone.find("p, br").remove();
        const comision = normWs(comisionClone.text());

        const horario = normWs($(tds[1]).text());
        const sala = normWs($(tds[2]).text()) || null;

        const pares = leerCitacionInvitados($, tds);
        const materia = normWs(pares.map((p) => p.materia).join(" — ")) || null;

        // Invitados: texto crudo de cada .w30 (sin reconciliar identidad — T-06-02).
        const invitados: CitacionInvitado[] = [];
        for (const par of pares) {
          if (par.invitados) {
            invitados.push({ nombre: par.invitados, calidad: null });
          }
        }

        // Puntos: un CitacionPunto por boletín hallado en la materia de cada par.
        const puntos: CitacionPunto[] = [];
        const boletinesVistos = new Set<string>();
        for (const par of pares) {
          for (const boletin of extraerBoletines(par.materia)) {
            if (boletinesVistos.has(boletin)) continue;
            boletinesVistos.add(boletin);
            puntos.push({
              boletin,
              id_proyecto: null,
              materia: par.materia || null,
              tipo_tramite: null,
            });
          }
        }

        if (!comision || !horario) return; // sin clave mínima → descarta (no fabrica)

        // Clave natural INTRÍNSECA (semana|comisión|fecha|horario|sala) — sin el
        // discriminador de empate aún. El id final se asigna en el post-pase.
        const discSala = sala ? `:${sala}` : "";
        const baseId = `camara:${semanaIso}:${comision}:${fecha}:${horario}${discSala}`;
        candidatas.push({
          baseId,
          materia,
          row: {
            camara: "camara",
            comision,
            fecha,
            horario,
            sala,
            materia,
            estado,
            semana_iso: semanaIso,
            invitados,
            puntos,
            origen: ORIGEN,
            fecha_captura: fechaCaptura,
            enlace,
          },
        });
      });
  });

  // Post-pase WR-01: agrupa por baseId; si un baseId tiene >1 candidata, TODAS
  // reciben el sufijo `#<hash(materia)>` (orden-independiente). Empates exactos de
  // materia se rompen con un índice estable sobre el orden ya determinista del hash.
  const porBase = new Map<string, Candidata[]>();
  for (const cand of candidatas) {
    const arr = porBase.get(cand.baseId) ?? [];
    arr.push(cand);
    porBase.set(cand.baseId, arr);
  }

  const citaciones: Citacion[] = [];
  const idsUsados = new Set<string>();
  for (const cand of candidatas) {
    const grupo = porBase.get(cand.baseId)!;
    let id = cand.baseId;
    if (grupo.length > 1) {
      id = `${cand.baseId}#${hashCorto(cand.materia ?? "")}`;
      // Empate exacto (misma materia) → índice incremental determinista.
      let n = 2;
      while (idsUsados.has(id)) {
        id = `${cand.baseId}#${hashCorto(`${cand.materia ?? ""}|${n}`)}`;
        n++;
      }
    }

    const candidata: Citacion = { id, ...cand.row };
    const parsed = CitacionSchema.safeParse(candidata);
    if (!parsed.success) {
      // Drift (T-06-04): no fabricar — registrar y descartar.
      console.warn(
        `[parse-camara-citaciones] fila descartada (drift): ${cand.row.comision} ${cand.row.fecha} ${cand.row.horario}`,
        parsed.error.issues,
      );
      continue;
    }
    idsUsados.add(id);
    citaciones.push(parsed.data as Citacion);
  }

  return citaciones;
}
