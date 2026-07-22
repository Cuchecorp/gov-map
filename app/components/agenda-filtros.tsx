"use client";

/**
 * AgendaFiltros — island client de FILTROS DE PERIODISTA para /agenda (CIT-04,
 * 94-UI-SPEC §2). Espejo estructural de `parlamentarios-filtro.tsx`.
 *
 * DECISIÓN del orquestador (plan-checker): este island es el ÚNICO renderer del
 * listado por día POST-HIDRATACIÓN. Renderiza la MISMA `CitacionCard` que el SSR
 * (cero divergencia visual), reagrupada por `dayKey` (día-calendario-Chile que el
 * SERVER ya calculó en tz America/Santiago — el island NO recalcula tz). El server
 * arma el slice plano completo (estado + provenance + invitados); el island solo
 * FILTRA y AGRUPA en memoria.
 *
 * CONTRATO FichaRail DURO (LOCKED): JAMÁS importa `@/lib/supabase` ni usa
 * `.rpc`/`.from`. Recibe el slice serializado por props y filtra EN MEMORIA (React
 * state) — cero red. El guard PII (lockdown-guard) escanea `.from`/`.rpc` en `app/`.
 *
 * FILT: counts honestos "de estas N" (sobre el SLICE COMPLETO, no el resultado
 * filtrado), facetas vacías deshabilitadas, bucket "Sin dato" visible. Cuatro
 * facetas: cámara (chips), comisión (facetas + Sin dato), rango de fechas (inputs
 * date acotados a lo cargado), boletín mencionado (`detectarBoletin`).
 *
 * ANTI-INSINUACIÓN: ningún copy usa vocabulario de afinidad/relación/causalidad.
 * Una citación es un HECHO declarado por fuente oficial; el filtro NUNCA agrupa por
 * afinidad inferida. El estado de cancelación es sobrio (sin color de alarma).
 */

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { CitacionCard } from "@/components/citacion-card";
import { CarrilAccordion } from "@/components/carril-accordion";
import { detectarBoletin } from "@/lib/boletin-detector";
import type { CitacionSliceRow } from "@/lib/agenda-types";

// ---------------------------------------------------------------------------
// Copy LOCKED (94-UI-SPEC §Copywriting / §Component Contract 2)
// ---------------------------------------------------------------------------
const leyendaCounts = (n: number) =>
  `Conteos sobre estas ${n} citaciones cargadas de esta semana, no sobre toda la agenda.`;
const EMPTY_HEADING = "Sin citaciones para este filtro";
const EMPTY_BODY = "Ajusta o quita filtros para ver más.";

/** Comisión null/vacía → bucket "Sin dato" (espejo PARTIDO_SIN_DATO). */
const COMISION_SIN_DATO = "sin_dato";

function getComisionKey(row: CitacionSliceRow): string {
  return row.comision != null && row.comision !== ""
    ? row.comision
    : COMISION_SIN_DATO;
}

const CAMARA_LABEL: Record<"camara" | "senado", string> = {
  camara: "Cámara",
  senado: "Senado",
};

// ---------------------------------------------------------------------------
// Chip de faceta reutilizable (espejo VERBATIM de FacetChip)
// ---------------------------------------------------------------------------
interface FacetChipProps {
  label: string;
  count: number;
  engaged: boolean;
  onToggle: () => void;
}

function FacetChip({ label, count, engaged, onToggle }: FacetChipProps) {
  const disabled = count === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled ? "true" : "false"}
      aria-pressed={engaged ? "true" : "false"}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-muted px-4 py-1.5 text-sm font-medium",
        "transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product",
        disabled && "cursor-default opacity-40",
        engaged &&
          !disabled &&
          "border-accent-product bg-accent-product-soft font-semibold text-accent-product",
      )}
    >
      <span>{label}</span>
      <span className="text-xs font-normal text-muted-foreground">· {count}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export interface AgendaFiltrosProps {
  /**
   * Slice PLANO serializado por el server (semana cargada, filas ya en tz Chile).
   * El island NUNCA re-consulta — filtra en memoria (contrato FichaRail LOCKED).
   */
  slice: CitacionSliceRow[];
}

export function AgendaFiltros({ slice }: AgendaFiltrosProps) {
  const [camarasActivas, setCamarasActivas] = useState<Set<string>>(new Set());
  const [comisionesActivas, setComisionesActivas] = useState<Set<string>>(
    new Set(),
  );
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [boletinInput, setBoletinInput] = useState<string>("");

  // ------------------------------------------------------------------
  // Extremos de fecha del slice (acotan los inputs date). Se computan sobre el
  // dayKey (día-Chile YYYY-MM-DD ya calculado por el server), no sobre fecha UTC.
  // ------------------------------------------------------------------
  const { minDay, maxDay } = useMemo(() => {
    const dias = slice
      .map((r) => r.dayKey)
      .filter((d) => d !== "sin-fecha")
      .sort();
    return { minDay: dias[0] ?? "", maxDay: dias[dias.length - 1] ?? "" };
  }, [slice]);

  // ------------------------------------------------------------------
  // Counts "de estas N" — sobre el SLICE COMPLETO (honesto)
  // ------------------------------------------------------------------
  const camaraCounts = useMemo(() => {
    const c: Record<string, number> = { camara: 0, senado: 0 };
    for (const r of slice) c[r.camara] = (c[r.camara] ?? 0) + 1;
    return c;
  }, [slice]);

  const comisionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of slice) {
      const k = getComisionKey(r);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [slice]);

  // Comisiones ordenadas por frecuencia (desc), luego alfabético; "Sin dato" al final.
  const todasLasComisiones = useMemo(() => {
    return Object.keys(comisionCounts).sort((a, b) => {
      if (a === COMISION_SIN_DATO) return 1;
      if (b === COMISION_SIN_DATO) return -1;
      const diff = (comisionCounts[b] ?? 0) - (comisionCounts[a] ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b, "es");
    });
  }, [comisionCounts]);

  // ------------------------------------------------------------------
  // Boletín detectado (base) — filtro por citacion_punto.boletin
  // ------------------------------------------------------------------
  const boletinBase = useMemo(() => {
    const det = detectarBoletin(boletinInput);
    return det?.base ?? null;
  }, [boletinInput]);

  // ------------------------------------------------------------------
  // Filas visibles (filtrado en memoria — 4 facetas componibles)
  // ------------------------------------------------------------------
  const filasVisibles = useMemo(() => {
    return slice.filter((r) => {
      if (camarasActivas.size > 0 && !camarasActivas.has(r.camara)) return false;
      if (
        comisionesActivas.size > 0 &&
        !comisionesActivas.has(getComisionKey(r))
      )
        return false;
      // Rango de fechas: se compara contra el dayKey (día-Chile YYYY-MM-DD).
      if (desde && (r.dayKey === "sin-fecha" || r.dayKey < desde)) return false;
      if (hasta && (r.dayKey === "sin-fecha" || r.dayKey > hasta)) return false;
      // Boletín: filtra por base del número; texto libre no-boletín no aplica.
      if (boletinBase !== null) {
        const matchBoletin = r.boletines.some((b) => {
          const det = detectarBoletin(b);
          return det?.base === boletinBase;
        });
        if (!matchBoletin) return false;
      }
      return true;
    });
  }, [slice, camarasActivas, comisionesActivas, desde, hasta, boletinBase]);

  // ------------------------------------------------------------------
  // Reagrupación por día (dayKey Chile ya calculado por el server) sobre lo visible
  // ------------------------------------------------------------------
  const dias = useMemo(() => {
    const grupos = new Map<
      string,
      { dayLabel: string; rows: CitacionSliceRow[] }
    >();
    for (const r of filasVisibles) {
      const g = grupos.get(r.dayKey) ?? { dayLabel: r.dayLabel, rows: [] };
      g.rows.push(r);
      grupos.set(r.dayKey, g);
    }
    return Array.from(grupos.entries());
  }, [filasVisibles]);

  // ------------------------------------------------------------------
  // Toggles
  // ------------------------------------------------------------------
  const toggleCamara = useCallback((key: string) => {
    setCamarasActivas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleComision = useCallback((key: string) => {
    setComisionesActivas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const resetFiltros = useCallback(() => {
    setCamarasActivas(new Set());
    setComisionesActivas(new Set());
    setDesde("");
    setHasta("");
    setBoletinInput("");
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Panel de filtros (island FichaRail) ── */}
      <section
        aria-label="Filtrar la agenda de esta semana"
        className="space-y-4"
      >
        <p className="text-xs text-muted-foreground">
          {leyendaCounts(slice.length)}
        </p>

        {/* Faceta cámara */}
        <fieldset>
          <legend className="text-sm font-medium">Cámara</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["camara", "senado"] as const).map((cam) => (
              <FacetChip
                key={cam}
                label={CAMARA_LABEL[cam]}
                count={camaraCounts[cam] ?? 0}
                engaged={camarasActivas.has(cam)}
                onToggle={() => toggleCamara(cam)}
              />
            ))}
          </div>
        </fieldset>

        {/* Faceta comisión */}
        {todasLasComisiones.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">Comisión</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {todasLasComisiones.map((key) => {
                const label = key === COMISION_SIN_DATO ? "Sin dato" : key;
                return (
                  <FacetChip
                    key={key}
                    label={label}
                    count={comisionCounts[key] ?? 0}
                    engaged={comisionesActivas.has(key)}
                    onToggle={() => toggleComision(key)}
                  />
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Faceta rango de fechas (inputs date acotados a lo cargado) */}
        <fieldset>
          <legend className="text-sm font-medium">Rango de fechas</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>Desde</span>
              <input
                type="date"
                value={desde}
                min={minDay || undefined}
                max={maxDay || undefined}
                onChange={(e) => setDesde(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-base font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Hasta</span>
              <input
                type="date"
                value={hasta}
                min={minDay || undefined}
                max={maxDay || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-base font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
        </fieldset>

        {/* Faceta boletín (detectarBoletin; no navega — filtro local) */}
        <fieldset>
          <legend className="text-sm font-medium">Boletín</legend>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span>Número de boletín</span>
            <input
              type="text"
              inputMode="numeric"
              value={boletinInput}
              onChange={(e) => setBoletinInput(e.target.value)}
              placeholder="14309-04"
              className="min-h-11 max-w-xs rounded-md border border-input bg-background px-3 text-base font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </fieldset>

        {/* Reset — vuelve al slice completo de la semana */}
        <button
          type="button"
          onClick={resetFiltros}
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-muted px-4 text-sm font-medium transition-colors hover:border-accent-product/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product"
        >
          Esta semana
        </button>
      </section>

      {/* ── Listado por día (el island ES el renderer post-hidratación) ── */}
      {dias.length === 0 ? (
        <div className="rounded-[var(--radius-tile)] border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
          <h3 className="text-base font-semibold text-foreground">
            {EMPTY_HEADING}
          </h3>
          <p className="mt-1">{EMPTY_BODY}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dias.map(([dayKey, { dayLabel, rows }], index) => (
            <CarrilAccordion
              key={dayKey}
              titulo={dayLabel}
              conteo={`${rows.length} ${rows.length === 1 ? "citación" : "citaciones"}`}
              defaultOpen={index === 0}
              headingLevel="h3"
              headingClassName="text-base font-semibold"
            >
              <div className="space-y-4">
                {rows.map((c) => (
                  <CitacionCard
                    key={c.id}
                    comision={c.comision}
                    fecha={c.fecha ? new Date(c.fecha) : null}
                    horario={c.horario}
                    sala={c.sala}
                    materia={c.materia}
                    camara={c.camara}
                    estado={c.estado}
                    invitados={c.invitados}
                    boletin={c.boletin}
                    provenance={{
                      capturedAt: c.provenance.capturedAt
                        ? new Date(c.provenance.capturedAt)
                        : null,
                      sourceName: c.provenance.sourceName,
                      sourceUrl: c.provenance.sourceUrl,
                    }}
                  />
                ))}
              </div>
            </CarrilAccordion>
          ))}
        </div>
      )}
    </div>
  );
}
