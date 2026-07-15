"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * SearchBox — captura una consulta en lenguaje natural y navega a
 * `/buscar?q={query}` (UI-SPEC §3). Única isla `"use client"` de la fase.
 *
 * NO llama a Gemini ni a pgvector: el embed + kNN corren server-only en
 * `/buscar` (la key nunca cruza al cliente, T-07-11). El handler `router.push`
 * solo da una transición ágil; el `<form method="get" action="/buscar">` real
 * funciona SIN JavaScript (progressive enhancement, principio SSR-first).
 *
 * Guard de submit vacío: con input vacío/whitespace no navega — nunca enruta a
 * `/buscar?q=`.
 *
 * Variantes (Fase 21 SC1 — paridad con el mockup de la landing, UI-SPEC §11.1):
 *  - `variant="hero"`: CTA petróleo "Buscar proyectos", input 52px +
 *    `rounded-[var(--radius-control)]` (sizing introducido en Phase 77-01).
 *    `variant="default"`: barra persistente "Buscar", h-12 + `rounded-md`.
 *  - `exampleChips`: las 4 pills LOCKED bajo la caja; al clicar prefijan + envían
 *    la consulta reutilizando el MISMO camino de navegación (no hay router.push
 *    paralelo). La pill de boletín se renderiza en Mono (UI-SPEC §6).
 */

export interface ExampleChip {
  /** Texto de la query que la pill inyecta y envía (es la consulta misma). */
  query: string;
  /** Render en Geist Mono (la pill de boletín, UI-SPEC §6). */
  mono?: boolean;
}

export interface SearchBoxProps {
  /** Valor inicial (persiste la consulta en `/buscar`). */
  initialQuery?: string;
  /** Autofocus en la landing (la caja es el hero). */
  autoFocus?: boolean;
  /**
   * `"hero"` = landing (CTA petróleo "Buscar proyectos"); `"default"` = barra
   * persistente de `/buscar` ("Buscar"). Por defecto `"default"`.
   */
  variant?: "default" | "hero";
  /** Pills de ejemplo bajo la caja; al clicar prefijan + envían (UI-SPEC §11.1). */
  exampleChips?: readonly ExampleChip[];
}

export function SearchBox({
  initialQuery = "",
  autoFocus = false,
  variant = "default",
  exampleChips,
}: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const isHero = variant === "hero";

  /** Camino único de navegación: trim + guard de vacío + push. */
  function navigate(q: string) {
    const trimmed = q.trim();
    // Guard de submit vacío: jamás navegar a /buscar?q=.
    if (trimmed.length === 0) return;
    // Transición ágil con JS; el form GET es el fallback sin JS.
    router.push(`/buscar?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (value.trim().length === 0) {
      // Sin query válida: cancelar el GET nativo y no navegar.
      e.preventDefault();
      return;
    }
    e.preventDefault();
    navigate(value);
  }

  function handleChipClick(query: string) {
    // La pill ES la consulta: prefija la caja y reutiliza el mismo navigate().
    setValue(query);
    navigate(query);
  }

  return (
    <div>
      <form
        role="search"
        action="/buscar"
        method="get"
        onSubmit={handleSubmit}
        className={
          isHero
            ? "flex flex-col gap-3 sm:flex-row"
            : "flex gap-2"
        }
      >
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              isHero
                ? "Escribe una idea (p. ej. protección de datos personales) o un boletín…"
                : "Busca por idea o número de boletín…"
            }
            aria-label="Buscar proyectos de ley"
            className={
              isHero
                ? "h-[52px] rounded-[var(--radius-control)] pl-9 text-base"
                : "h-12 pl-9 text-base"
            }
            autoFocus={autoFocus}
          />
        </div>
        <Button
          type="submit"
          className={
            isHero
              ? "h-[52px] rounded-[var(--radius-control)] whitespace-nowrap bg-accent-product px-6 font-semibold text-background hover:bg-accent-product/90"
              : "h-12 bg-accent-product text-background hover:bg-accent-product/90"
          }
        >
          {isHero ? "Buscar proyectos" : "Buscar"}
        </Button>
      </form>

      {exampleChips && exampleChips.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {exampleChips.map((chip) => (
            <button
              key={chip.query}
              type="button"
              onClick={() => handleChipClick(chip.query)}
              className={[
                // Touch target ≥44px (UI-SPEC §11.1): min-h-11 = 44px.
                "inline-flex min-h-11 items-center rounded-full border border-border bg-muted px-4 py-2 text-sm",
                "transition-colors hover:border-accent-product/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                chip.mono ? "font-mono" : "",
              ].join(" ")}
            >
              {chip.query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
