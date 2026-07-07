"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useScrollspy } from "@/lib/use-scrollspy";

/**
 * Rail sticky GENÉRICO de la ficha (UXCOG 55-01, variante B "Informe con rail").
 * Lo consumen parlamentario (55-02/55-03) y proyecto (55-04). Renderiza:
 *  - un slot `header` (ReactNode) server arriba,
 *  - UNA entrada de nav por carril PRESENTE (link `#id`) con su conteo YA
 *    serializado 3-estado — la isla NUNCA deriva ni fabrica un dígito,
 *  - el marcador diamante `◆` en la entrada de cruces,
 *  - el caveat anti-causal (texto LOCKED, pasado como prop) EXACTAMENTE 1×.
 *
 * La entrada activa (id == `useScrollspy(ids)`) recibe el estado "actual":
 * `bg-accent-product-soft` (token plano de 55-01) + borde izq. petróleo 2px +
 * texto petróleo/600. Petróleo queda RESERVADO a este highlight y al diamante.
 *
 * Responsive: en `< md` el aside es una barra superior con nav horizontal
 * scrolleable (`overflow-x-auto`) que conserva labels + conteos.
 *
 * CONTRATO DURO (no-leak SSR, T-55-01): NUNCA importa una sección de dominio ni
 * el cliente Supabase server-only. El `header` llega como ReactNode server.
 */
export interface RailEntry {
  id: string;
  label: string;
  /** Conteo/estado YA formateado por el server (3-estado honesto); la isla NO lo deriva. */
  count?: React.ReactNode;
  /** Marcador visual sobrio para el carril de cruces. */
  marker?: "diamante";
}

export function FichaRail({
  header,
  navEntries,
  caveat,
}: {
  header: React.ReactNode;
  navEntries: RailEntry[];
  caveat: string;
}) {
  const activeId = useScrollspy(navEntries.map((e) => e.id));

  return (
    <aside className="md:sticky md:top-6 md:self-start">
      {header}
      <nav
        aria-label="Índice de secciones"
        className="mt-4 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
      >
        {navEntries.map((e) => {
          const activa = e.id === activeId;
          return (
            <a
              key={e.id}
              href={"#" + e.id}
              aria-current={activa ? "true" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm no-underline",
                "text-foreground/80 hover:text-[color:var(--accent-product)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-product)]",
                activa &&
                  "bg-accent-product-soft border-[color:var(--accent-product)] font-semibold text-[color:var(--accent-product)]",
              )}
            >
              <span>
                {e.marker === "diamante" && (
                  <span aria-hidden="true" className="mr-1">
                    ◆
                  </span>
                )}
                {e.label}
              </span>
              {e.count != null && (
                <span className="ml-auto text-muted-foreground">
                  {e.count}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <p className="mt-4 text-xs text-muted-foreground">{caveat}</p>
    </aside>
  );
}
