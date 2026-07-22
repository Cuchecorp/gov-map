"use client";

/**
 * BuscarFiltros — island client de filtros/orden sobre el slice serializado.
 *
 * Recibe `BuscarSliceRow[]` ya obtenido por el server component y filtra/reordena
 * EN MEMORIA con React state — cero red, cero Supabase (contrato FichaRail LOCKED).
 *
 * FILT-01: facetas año · iniciativa · estado · cámara filtran sin re-buscar.
 * FILT-02: counts honestos "de estos N", facetas vacías deshabilitadas, sin_dato visible.
 * RANK-01: orden explicable mensaje>moción + recencia, nunca ML ni score.
 *
 * ANTI-INSINUACIÓN (LOCKED): NINGÚN copy usa "ranking", "score", "puntaje",
 * "índice" ni "afinidad". El orden es determinista y explicado por reglas visibles.
 *
 * CONTRATO DURO: NUNCA importa @/lib/supabase ni re-consulta la red.
 * El guard PII (lockdown-guard) escanea `.from`/`.rpc` en todo app/.
 */

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { ETIQUETA_BUCKET, type EstadoBucket } from "@/lib/estado-bucket";
import type { BuscarSliceRow } from "@/lib/types";
import { sourceLabel } from "@/lib/types";
import { SearchResultCard } from "@/components/search-result-card";

// ---------------------------------------------------------------------------
// Constantes de copy LOCKED (UI-SPEC §Copywriting)
// ---------------------------------------------------------------------------
const LEYENDA_COUNTS =
  "Conteos sobre estos N resultados, no sobre todo el corpus.";
const LEYENDA_ORDEN =
  "Orden por relevancia de la búsqueda. Opciones: más recientes primero · mensajes del Ejecutivo primero.";
const EMPTY_HEADING = "Ningún resultado con estos filtros";
const EMPTY_BODY = "Ajusta o quita filtros para ver más proyectos.";

// ---------------------------------------------------------------------------
// Tipos de orden (RANK-01)
// ---------------------------------------------------------------------------
type OrderMode = "relevancia" | "recientes" | "mensajes";

const ORDER_LABELS: Record<OrderMode, string> = {
  relevancia: "Relevancia (por defecto)",
  recientes: "Más recientes",
  mensajes: "Mensajes primero",
};

// ---------------------------------------------------------------------------
// Helpers de filtrado y ordenamiento
// ---------------------------------------------------------------------------

/** Año null → "Sin dato" para la faceta año */
const ANIO_SIN_DATO = "sin_dato";

function getAnioKey(row: BuscarSliceRow): string {
  return row.anio != null ? String(row.anio) : ANIO_SIN_DATO;
}

function applyOrder(rows: BuscarSliceRow[], mode: OrderMode): BuscarSliceRow[] {
  if (mode === "relevancia") {
    // RANK-01: el orden de entrada YA encoda el rank del retrieval semántico.
    // No hay campo `rank` numérico en el slice — el índice posicional es único
    // por fila, así que JS stable-sort preserva el orden original sin modificarlo.
    // Las sub-ramas Mensaje>Moción y recencia se eliminaron: el índice posicional
    // nunca produce empates y las ramas eran código muerto (fix: 88-UI-REVIEW #1).
    return [...rows];
  }
  if (mode === "recientes") {
    // anio desc; null al final (RANK-01: nunca fabricado)
    return [...rows].sort((a, b) => {
      if (a.anio == null && b.anio == null) return 0;
      if (a.anio == null) return 1;
      if (b.anio == null) return -1;
      return b.anio - a.anio;
    });
  }
  if (mode === "mensajes") {
    // Mensaje antes que Moción; rank interno preservado dentro de cada grupo
    return [...rows].sort((a, b) => {
      const rankA = a.iniciativa === "Mensaje" ? 0 : 1;
      const rankB = b.iniciativa === "Mensaje" ? 0 : 1;
      return rankA - rankB;
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Chip de faceta reutilizable
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
        // Base chip (search-box.tsx pattern)
        "inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-muted px-4 py-1.5 text-sm font-medium",
        "transition-colors",
        // Focus ring (LOCKED)
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product",
        // Disabled (FichaRail / .net-b-pager__btn:disabled)
        disabled && "cursor-default opacity-40",
        // Active / petróleo (ficha-rail.tsx:60-67 idiom, LOCKED)
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
// Chip de toggle de orden
// ---------------------------------------------------------------------------
interface OrderChipProps {
  label: string;
  engaged: boolean;
  onSelect: () => void;
}

function OrderChip({ label, engaged, onSelect }: OrderChipProps) {
  return (
    <button
      type="button"
      aria-pressed={engaged ? "true" : "false"}
      onClick={onSelect}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border border-border bg-muted px-4 py-1.5 text-sm font-medium",
        "transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product",
        engaged &&
          "border-accent-product bg-accent-product-soft font-semibold text-accent-product",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export interface BuscarFiltrosProps {
  /**
   * Slice serializado YA obtenido por el server. El island NUNCA re-consulta.
   * Partido es opcional — BIO-03/P2 forward-compat; ausente → no renderiza faceta.
   * Card data (materia, estado, fecha_captura, origen, enlace) embebido en cada fila
   * (CR-01 fix: renderRow eliminado — función no serializable en RSC streaming).
   */
  slice: BuscarSliceRow[];
}

export function BuscarFiltros({ slice }: BuscarFiltrosProps) {
  // ------------------------------------------------------------------
  // Estado de facetas (cada dimensión es un Set de valores activos)
  // ------------------------------------------------------------------
  const [estadosActivos, setEstadosActivos] = useState<Set<string>>(new Set());
  const [aniosActivos, setAniosActivos] = useState<Set<string>>(new Set());
  const [iniciativasActivas, setIniciativasActivas] = useState<Set<string>>(
    new Set(),
  );
  const [camarasActivas, setCamarasActivas] = useState<Set<string>>(new Set());
  const [orderMode, setOrderMode] = useState<OrderMode>("relevancia");

  // ------------------------------------------------------------------
  // ¿Tiene alguna fila partido? — faceta partido solo si hay datos
  // ------------------------------------------------------------------
  const tienePartido = useMemo(
    () => slice.some((r) => r.partido != null && r.partido !== ""),
    [slice],
  );

  // ------------------------------------------------------------------
  // Lista visible (filtrado + orden) — derivada en memoria (FILT-01)
  // ------------------------------------------------------------------
  const listaVisible = useMemo(() => {
    let rows = slice;

    if (estadosActivos.size > 0) {
      rows = rows.filter((r) => estadosActivos.has(r.estadoBucket));
    }
    if (aniosActivos.size > 0) {
      rows = rows.filter((r) => aniosActivos.has(getAnioKey(r)));
    }
    if (iniciativasActivas.size > 0) {
      rows = rows.filter(
        (r) => r.iniciativa != null && iniciativasActivas.has(r.iniciativa),
      );
    }
    if (camarasActivas.size > 0) {
      rows = rows.filter(
        (r) =>
          r.camaraOrigen != null && camarasActivas.has(r.camaraOrigen),
      );
    }

    return applyOrder(rows, orderMode);
  }, [
    slice,
    estadosActivos,
    aniosActivos,
    iniciativasActivas,
    camarasActivas,
    orderMode,
  ]);

  // ------------------------------------------------------------------
  // Counts "de estos N" — sobre el SLICE COMPLETO (FILT-02 honesto)
  // ------------------------------------------------------------------
  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of slice) {
      counts[r.estadoBucket] = (counts[r.estadoBucket] ?? 0) + 1;
    }
    return counts;
  }, [slice]);

  const anioCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of slice) {
      const k = getAnioKey(r);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [slice]);

  const iniciativaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of slice) {
      if (r.iniciativa != null) {
        counts[r.iniciativa] = (counts[r.iniciativa] ?? 0) + 1;
      }
    }
    return counts;
  }, [slice]);

  const camaraCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of slice) {
      if (r.camaraOrigen != null) {
        counts[r.camaraOrigen] = (counts[r.camaraOrigen] ?? 0) + 1;
      }
    }
    return counts;
  }, [slice]);

  // ------------------------------------------------------------------
  // Valores únicos ordenados por frecuencia (desc), luego alfabético
  // ------------------------------------------------------------------
  const todosLosEstados = useMemo<EstadoBucket[]>(() => {
    const keys = Object.keys(estadoCounts) as EstadoBucket[];
    return keys.sort(
      (a, b) => (estadoCounts[b] ?? 0) - (estadoCounts[a] ?? 0) || a.localeCompare(b, "es"),
    );
  }, [estadoCounts]);

  const todosLosAnios = useMemo(() => {
    return Object.keys(anioCounts).sort((a, b) => {
      // Sin dato al final
      if (a === ANIO_SIN_DATO) return 1;
      if (b === ANIO_SIN_DATO) return -1;
      return Number(b) - Number(a); // desc
    });
  }, [anioCounts]);

  const todasLasIniciativas = useMemo(() => {
    return Object.keys(iniciativaCounts).sort(
      (a, b) => (iniciativaCounts[b] ?? 0) - (iniciativaCounts[a] ?? 0),
    );
  }, [iniciativaCounts]);

  const todasLasCamaras = useMemo(() => {
    return Object.keys(camaraCounts).sort(
      (a, b) => (camaraCounts[b] ?? 0) - (camaraCounts[a] ?? 0),
    );
  }, [camaraCounts]);

  // ------------------------------------------------------------------
  // Callbacks de toggle de faceta
  // ------------------------------------------------------------------
  const toggleEstado = useCallback((bucket: string) => {
    setEstadosActivos((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }, []);

  const toggleAnio = useCallback((anio: string) => {
    setAniosActivos((prev) => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio);
      else next.add(anio);
      return next;
    });
  }, []);

  const toggleIniciativa = useCallback((ini: string) => {
    setIniciativasActivas((prev) => {
      const next = new Set(prev);
      if (next.has(ini)) next.delete(ini);
      else next.add(ini);
      return next;
    });
  }, []);

  const toggleCamara = useCallback((cam: string) => {
    setCamarasActivas((prev) => {
      const next = new Set(prev);
      if (next.has(cam)) next.delete(cam);
      else next.add(cam);
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ── Panel de filtros (FILT-01 / FILT-02) ── */}
      <section aria-label="Filtrar resultados">
        <div className="net-filtros">
          {/* Leyenda honesta de counts (FILT-02, LOCKED) */}
          <p className="w-full text-xs text-muted-foreground">
            {LEYENDA_COUNTS}
          </p>

          {/* Faceta: Estado */}
          {todosLosEstados.length > 0 && (
            <fieldset className="net-filtros__tipos">
              <legend className="net-filtros__legend">Estado</legend>
              <div className="flex flex-wrap gap-2">
                {todosLosEstados.map((bucket) => {
                  const label = ETIQUETA_BUCKET[bucket];
                  const count = estadoCounts[bucket] ?? 0;
                  return (
                    <FacetChip
                      key={bucket}
                      label={label}
                      count={count}
                      engaged={estadosActivos.has(bucket)}
                      onToggle={() => toggleEstado(bucket)}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Faceta: Iniciativa */}
          {todasLasIniciativas.length > 0 && (
            <fieldset className="net-filtros__tipos">
              <legend className="net-filtros__legend">Iniciativa</legend>
              <div className="flex flex-wrap gap-2">
                {todasLasIniciativas.map((ini) => {
                  const count = iniciativaCounts[ini] ?? 0;
                  return (
                    <FacetChip
                      key={ini}
                      label={ini}
                      count={count}
                      engaged={iniciativasActivas.has(ini)}
                      onToggle={() => toggleIniciativa(ini)}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Faceta: Año */}
          {todosLosAnios.length > 0 && (
            <fieldset className="net-filtros__tipos">
              <legend className="net-filtros__legend">Año</legend>
              <div className="flex flex-wrap gap-2">
                {todosLosAnios.map((anio) => {
                  const label = anio === ANIO_SIN_DATO ? "Sin dato" : anio;
                  const count = anioCounts[anio] ?? 0;
                  return (
                    <FacetChip
                      key={anio}
                      label={label}
                      count={count}
                      engaged={aniosActivos.has(anio)}
                      onToggle={() => toggleAnio(anio)}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Faceta: Cámara de origen
              COLOR DECISION (fix: 88-UI-REVIEW #3):
              El CONTROL de faceta cámara usa FacetChip genérico → petróleo en engaged.
              Esto aplica la regla 2 de color (facet-active = petróleo) al CONTROL DE FILTRO,
              lo cual es coherente con todos los demás controles de faceta.
              La prohibición "cámara nunca petróleo" aplica a los chips DATO en cards de
              resultado (renderRow → CamaraChip con tokens cívicos), no a los controles de filtro.
              CamaraChip (con tokens cívicos) se usa solo para el DATO en result-cards.
              Decisión registrada en 88-UI-SPEC.md §Color. */}
          {todasLasCamaras.length > 0 && (
            <fieldset className="net-filtros__tipos">
              <legend className="net-filtros__legend">Cámara de origen</legend>
              <div className="flex flex-wrap gap-2">
                {todasLasCamaras.map((cam) => {
                  const count = camaraCounts[cam] ?? 0;
                  return (
                    <div key={cam} className="net-filtros__tipo">
                      <FacetChip
                        label={cam}
                        count={count}
                        engaged={camarasActivas.has(cam)}
                        onToggle={() => toggleCamara(cam)}
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Faceta partido: SOLO si hay filas con partido (BIO-03/P2 forward-compat).
              Cuando tienePartido=true se renderizarán chips funcionales (P2).
              Hasta entonces el grupo no aparece — nunca un placeholder "próximamente"
              (fix: 88-UI-REVIEW #2; contrato SPEC §Facets rendered LOCKED). */}
          {/* partido chips placeholder ELIMINADO — renderizar chips reales en P2/BIO-03 */}
        </div>

        {/* ── Toggle de orden (RANK-01) ── */}
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">{LEYENDA_ORDEN}</p>
          <div
            role="group"
            aria-label="Ordenar resultados"
            className="flex flex-wrap gap-2"
          >
            {(Object.keys(ORDER_LABELS) as OrderMode[]).map((mode) => (
              <OrderChip
                key={mode}
                label={ORDER_LABELS[mode]}
                engaged={orderMode === mode}
                onSelect={() => setOrderMode(mode)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Lista de resultados filtrados ── */}
      {listaVisible.length === 0 ? (
        <div className="rounded-md border border-border bg-muted p-6 text-center">
          <h2 className="text-base font-semibold text-foreground">
            {EMPTY_HEADING}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{EMPTY_BODY}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {listaVisible.map((row) => (
            <SearchResultCard
              key={row.boletin}
              boletin={row.boletin}
              titulo={row.titulo}
              materia={row.materia ?? null}
              estado={row.estado ?? null}
              camaraOrigen={row.camaraOrigen}
              iniciativa={row.iniciativa}
              anio={row.anio}
              provenance={{
                capturedAt: row.fecha_captura ? new Date(row.fecha_captura) : null,
                sourceName: sourceLabel(row.origen ?? null),
                sourceUrl: row.enlace ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
