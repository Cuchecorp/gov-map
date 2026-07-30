/**
 * Helper central de links internos del panel (Phase 128, PANEL-02, D-08). Módulo
 * PURO: cero I/O, cero JSX, cero strings visibles al usuario — solo construye
 * hrefs. NO entra a `SUPERFICIES_PANEL` del guard anti-insinuación (no renderiza
 * copy); si algún día emitiera labels visibles, debe darse de alta ahí.
 *
 * Pitfall P1 (research 128): el orden correcto es SIEMPRE `?query#hash` (el `?`
 * va ANTES del `#`) — invertirlo produce un href que el navegador interpreta con
 * el fragmento como parte del query string, degradando en silencio (sin error de
 * runtime). Precedente existente ya correcto: `components/capa1/tramitacion-stepper.tsx:137`
 * (`/proyecto/${boletin}?${qs.toString()}#timeline`).
 *
 * Deuda declarada (NO trabajo de esta fase): los 14 call-sites existentes de
 * `/proyecto/…` no se migran a este helper en la Phase 128 — el alcance es
 * exclusivamente el panel nuevo.
 */
import { isoWeekOf, parseISOWeek, semanaIsoKey } from "@/lib/week-utils";

export type AnclaProyecto = "estado" | "timeline" | "votaciones";
export type AnclaAgenda = "resultados" | "citaciones" | "tabla-sala";

const SEMANA_RE = /^(\d{4})-W(\d{2})$/;

/** Href a una ficha de proyecto, ancla incondicional (`estado`|`timeline`|`votaciones`). */
export function hrefProyecto(boletin: string, ancla: AnclaProyecto): string {
  return `/proyecto/${encodeURIComponent(boletin)}#${ancla}`;
}

/**
 * Href a la agenda, opcionalmente con semana ISO. Orden SIEMPRE `?query#hash`
 * (P1). Si `semanaIso` es null/undefined/malformada, se omite el query — nunca
 * se emite un `semana=` inválido.
 */
export function hrefAgenda(ancla: AnclaAgenda, semanaIso?: string | null): string {
  if (typeof semanaIso === "string" && SEMANA_RE.test(semanaIso.trim())) {
    // parseISOWeek valida rango real (año, semanas del año); si no valida, cae
    // al fallback de "semana actual" — pero eso fabricaría una semana que el
    // caller no pidió, así que revalidamos el match crudo con el regex de
    // forma ANTES y solo entonces confiamos en el string original tal cual.
    const parsed = parseISOWeek(semanaIso.trim());
    const key = semanaIsoKey(parsed.year, parsed.week);
    if (key === semanaIso.trim()) {
      const qs = new URLSearchParams({ semana: semanaIso.trim() });
      return `/agenda?${qs.toString()}#${ancla}`;
    }
  }
  return `/agenda#${ancla}`;
}

/**
 * Semana ISO de una fecha date-only (`"2026-08-04"`). `new Date(fechaIso)` la
 * parsea como medianoche UTC — que es lo que `isoWeekOf` espera. JAMÁS
 * convertir a zona de Chile (gotcha rector v9.0/v12.0: date-only disfrazado de
 * timestamptz).
 */
export function semanaIsoDeFecha(fechaIso: string | null | undefined): string | null {
  if (typeof fechaIso !== "string" || fechaIso.trim() === "") return null;
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return null;
  const { year, week } = isoWeekOf(d);
  return semanaIsoKey(year, week);
}
