"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { cn } from "@/lib/utils";

/**
 * Isla cliente delgada (LEG-01). Envuelve UN carril de dominio en un acordeón
 * Radix (`type="single"` + `collapsible`, un solo item) cuyo `<h2>` vive en el
 * header SIEMPRE visible (preserva `h1→h2→h3` aunque el cuerpo esté cerrado) y
 * cuyo cuerpo colapsable conserva el contenido SSR en el HTML vía `forceMount`.
 *
 * CONTRATO DURO (no-leak SSR, T-45-01): este archivo NUNCA importa una sección
 * de dominio ni el cliente Supabase server-only. Recibe los Server Components
 * como `children` — la PÁGINA (server) los importa y los pasa como hijos; así no
 * entran al module graph cliente y el `service_role` (Camino A) jamás llega al
 * navegador. Asertado por el grep-test (behavior 5).
 */
export function CarrilAccordion({
  titulo,
  conteo,
  defaultOpen,
  children,
}: {
  titulo: string;
  /** Nodo 3-estado YA formateado ("9" | "—" | "sin registros"); el wrapper NO lo computa. */
  conteo: React.ReactNode;
  defaultOpen: boolean;
  /** <Suspense><…/></Suspense> — Server Component de sección pasado como CHILD, nunca importado aquí. */
  children: React.ReactNode;
}) {
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? "c" : undefined}
    >
      <AccordionPrimitive.Item value="c">
        {/* asChild → el <h2> ES el header; siempre visible, nunca colapsa. */}
        <AccordionPrimitive.Header asChild>
          <h2 className="text-xl font-semibold">
            <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-4 min-h-11 text-left">
              <span>{titulo}</span>
              <span className="flex items-center gap-2 text-muted-foreground font-normal text-sm">
                <span className="font-mono">{conteo}</span>
                <span
                  aria-hidden="true"
                  className="transition-transform group-data-[state=open]:rotate-180"
                >
                  ▾
                </span>
              </span>
            </AccordionPrimitive.Trigger>
          </h2>
        </AccordionPrimitive.Header>
        {/* forceMount → el contenido SSR queda en el HTML aunque el carril esté
            colapsado; el CSS lo oculta/anima cuando data-state=closed. */}
        <AccordionPrimitive.Content
          forceMount
          className={cn(
            "accordion-content overflow-hidden data-[state=closed]:hidden pt-4",
          )}
        >
          {children}
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
