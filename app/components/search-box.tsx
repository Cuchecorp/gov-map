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
 */

export interface SearchBoxProps {
  /** Valor inicial (persiste la consulta en `/buscar`). */
  initialQuery?: string;
  /** Autofocus en la landing (la caja es el hero). */
  autoFocus?: boolean;
}

export function SearchBox({ initialQuery = "", autoFocus = false }: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const q = value.trim();
    // Guard de submit vacío: jamás navegar a /buscar?q=.
    if (q.length === 0) {
      e.preventDefault();
      return;
    }
    // Transición ágil con JS; el form GET es el fallback sin JS.
    e.preventDefault();
    router.push(`/buscar?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      action="/buscar"
      method="get"
      onSubmit={handleSubmit}
      className="flex gap-2"
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
          placeholder="Busca por idea o número de boletín…"
          aria-label="Buscar proyectos de ley"
          className="h-12 pl-9 text-base"
          autoFocus={autoFocus}
        />
      </div>
      <Button type="submit" className="h-12">
        Buscar
      </Button>
    </form>
  );
}
