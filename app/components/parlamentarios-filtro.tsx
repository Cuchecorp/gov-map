"use client";

/**
 * ParlamentariosFiltro — island client de filtro por PARTIDO sobre el slice
 * serializado por el server (FILT-01 para personas, 91-UI-SPEC §5).
 *
 * Recibe `ParlamentarioListadoRow[]` YA obtenido por el server (que aplicó el filtro
 * grueso SSR cámara/q vía form GET) y filtra EN MEMORIA por partido con React state —
 * cero red, cero Supabase (contrato FichaRail LOCKED). El filtro SSR (cámara/nombre)
 * y este filtro client (partido) son ORTOGONALES y componibles: el server filtra
 * grueso, el island afina por partido.
 *
 * FILT-02: counts honestos "de estos N", facetas vacías deshabilitadas, bucket
 * "Sin dato" visible (nunca oculta filas sin partido).
 *
 * ANTI-INSINUACIÓN: NINGÚN copy usa "afinidad", "aliado", "cercano a", "bloque de",
 * "afín", "coordina con", "alineado". El partido es un HECHO declarado por fuente
 * oficial; el filtro NUNCA agrupa por bancada/afinidad inferida.
 *
 * CONTRATO DURO (FichaRail): NUNCA importa @/lib/supabase ni re-consulta la red.
 * El guard PII (lockdown-guard) escanea `.from`/`.rpc` en todo app/.
 */

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { ParlamentarioListadoRow } from "@/lib/types";
import { ParlamentarioDirectoryRow } from "@/components/parlamentario-directory-row";

// ---------------------------------------------------------------------------
// Copy LOCKED (91-UI-SPEC §Copywriting)
// ---------------------------------------------------------------------------
const leyendaCounts = (n: number) =>
  `Conteos sobre estos ${n} parlamentarios cargados, no sobre todo el Congreso.`;
const EMPTY_HEADING = "Sin parlamentarios para este partido";
const EMPTY_BODY = "Ajusta o quita filtros para ver más.";

/** Partido null → bucket "Sin dato" (espejo ANIO_SIN_DATO de buscar-filtros). */
const PARTIDO_SIN_DATO = "sin_dato";

function getPartidoKey(row: ParlamentarioListadoRow): string {
  return row.partido != null && row.partido !== ""
    ? row.partido
    : PARTIDO_SIN_DATO;
}

// ---------------------------------------------------------------------------
// Chip de faceta reutilizable (espejo VERBATIM de buscar-filtros.tsx FacetChip)
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
      <span className="text-xs font-normal text-muted-foreground">
        · {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export interface ParlamentariosFiltroProps {
  /**
   * Slice serializado YA obtenido por el server (filtrado grueso cámara/q). El island
   * NUNCA re-consulta — filtra por partido en memoria (contrato FichaRail LOCKED).
   */
  slice: ParlamentarioListadoRow[];
}

export function ParlamentariosFiltro({ slice }: ParlamentariosFiltroProps) {
  const [partidosActivos, setPartidosActivos] = useState<Set<string>>(
    new Set(),
  );

  // ------------------------------------------------------------------
  // Counts "de estos N" — sobre el SLICE COMPLETO (FILT-02 honesto)
  // ------------------------------------------------------------------
  const partidoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of slice) {
      const k = getPartidoKey(r);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [slice]);

  // Valores ordenados por frecuencia (desc), luego alfabético; "Sin dato" al final.
  const todosLosPartidos = useMemo(() => {
    return Object.keys(partidoCounts).sort((a, b) => {
      if (a === PARTIDO_SIN_DATO) return 1;
      if (b === PARTIDO_SIN_DATO) return -1;
      const diff = (partidoCounts[b] ?? 0) - (partidoCounts[a] ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b, "es");
    });
  }, [partidoCounts]);

  // ------------------------------------------------------------------
  // Lista visible (filtrado en memoria — FILT-01)
  // ------------------------------------------------------------------
  const listaVisible = useMemo(() => {
    if (partidosActivos.size === 0) return slice;
    return slice.filter((r) => partidosActivos.has(getPartidoKey(r)));
  }, [slice, partidosActivos]);

  const togglePartido = useCallback((key: string) => {
    setPartidosActivos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Faceta Partido (FILT-01 / FILT-02) ── */}
      {todosLosPartidos.length > 0 && (
        <section aria-label="Filtrar por partido">
          <p className="w-full text-xs text-muted-foreground">
            {leyendaCounts(slice.length)}
          </p>
          <fieldset className="mt-2">
            <legend className="text-sm font-medium">Partido</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {todosLosPartidos.map((key) => {
                const label =
                  key === PARTIDO_SIN_DATO ? "Sin dato" : key;
                const count = partidoCounts[key] ?? 0;
                return (
                  <FacetChip
                    key={key}
                    label={label}
                    count={count}
                    engaged={partidosActivos.has(key)}
                    onToggle={() => togglePartido(key)}
                  />
                );
              })}
            </div>
          </fieldset>
        </section>
      )}

      {/* ── Lista filtrada ── */}
      {listaVisible.length === 0 ? (
        <div className="rounded-[var(--radius-tile)] border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">
            {EMPTY_HEADING}
          </h2>
          <p className="mt-1">{EMPTY_BODY}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {listaVisible.length === 1
              ? "1 parlamentario"
              : `${listaVisible.length} parlamentarios`}
          </p>
          <ul className="space-y-3">
            {listaVisible.map((r) => (
              <li key={r.id}>
                <ParlamentarioDirectoryRow parlamentario={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
