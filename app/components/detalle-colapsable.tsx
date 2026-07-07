"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { cn } from "@/lib/utils";

/**
 * Isla cliente delgada (UXCOG 55-01). Disclosure INVERSO al `CarrilAccordion`:
 * la capa-1 (el `<h2>` + el resumen legible) vive FUERA de esta isla, en la
 * página server; esta isla envuelve SOLO el DETALLE (las filas completas), que
 * arranca CERRADO por defecto (`defaultOpen=false`, invierte la heurística F45
 * `abrePorDefecto`). El trigger alterna "Ver detalle (N)" ↔ "Ocultar detalle".
 *
 * CONTRATO DURO (no-leak SSR, T-55-01): este archivo NUNCA importa una sección
 * de dominio ni el cliente Supabase server-only. Recibe los Server Components
 * como `children` — la PÁGINA (server) los importa y los pasa como hijos; así no
 * entran al module graph cliente y el `service_role` (Camino A) jamás llega al
 * navegador. Asertado por el source-scan test (Test 4).
 *
 * `forceMount` mantiene el detalle SSR en el HTML aunque esté colapsado
 * (traceability + no lazy-fetch: el contenido ya vino del server).
 */
export function DetalleColapsable({
  n,
  children,
  defaultOpen = false,
  triggerVariant = "default",
  triggerLabel,
}: {
  /** Conteo YA formateado por el server; la isla NO lo deriva. */
  n: number;
  /** <Suspense><…/></Suspense> — Server Component de detalle pasado como CHILD, nunca importado aquí. */
  children: React.ReactNode;
  /** Detalle arranca CERRADO por defecto (disclosure inverso). */
  defaultOpen?: boolean;
  /**
   * `"primary"` estiliza el trigger como el CTA petróleo de la página (bg petróleo,
   * texto sobre fondo) — un ÚNICO control que expande el detalle, sin un anchor
   * separado que sólo hace scroll. Usado SÓLO en la sección de cruces (55-03).
   */
  triggerVariant?: "default" | "primary";
  /** Sobrescribe la etiqueta de estado CERRADO (p.ej. "Explorar los N cruces"). */
  triggerLabel?: string;
}) {
  const isPrimary = triggerVariant === "primary";
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? "d" : undefined}
    >
      <AccordionPrimitive.Item value="d">
        <AccordionPrimitive.Header asChild>
          <AccordionPrimitive.Trigger
            className={cn(
              "group flex min-h-11 items-center gap-2 text-left font-semibold",
              isPrimary
                ? "justify-center rounded-lg bg-accent-product px-6 text-background no-underline hover:bg-accent-product/90"
                : "text-sm text-accent-product",
            )}
          >
            {/* label data-state driven: dos spans, uno por estado (patrón carril-accordion). */}
            <span className="group-data-[state=open]:hidden">
              {triggerLabel ?? `Ver detalle (${n})`}
            </span>
            <span className="hidden group-data-[state=open]:inline">
              Ocultar detalle
            </span>
            <span
              aria-hidden="true"
              className="transition-transform group-data-[state=open]:rotate-180"
            >
              ▾
            </span>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        {/* forceMount → el detalle SSR queda en el HTML aunque esté colapsado;
            el CSS lo oculta cuando data-state=closed. */}
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
