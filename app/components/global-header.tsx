import Link from "next/link";

import { HeaderNav } from "@/components/header-nav";

/**
 * GlobalHeader — header global persistente del sitio (UI-SPEC §11.0, LOCKED).
 * Aparece en TODAS las rutas (montado en `app/layout.tsx`, dentro de `<body>`).
 *
 * Server Component (SIN `"use client"`): no necesita JS de cliente. El único
 * sub-árbol cliente es `<HeaderNav />`, aislado porque el subrayado del ítem
 * activo depende de `usePathname()` (Next 16 sólo lo expone en Client Components).
 * Mismo split server-page + island que el repo ya usa (cf. `search-box.tsx`).
 *
 * Diseño (UI-SPEC §11.0): fondo crema (`bg-background`), borde inferior sutil
 * (`border-border`), altura ~56px, padding `px-4 md:px-8`. A la izquierda el
 * wordmark → home; a la derecha la nav (Buscar · Parlamentarios · Agenda ·
 * Sobre / Metodología). Sin auth/login, sin theme toggle obligatorio.
 *
 * Anti-insinuación: cero foto, cero partido — sólo navegación textual.
 */
export function GlobalHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-base font-semibold leading-tight tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          Observatorio del Congreso 360
        </Link>

        <HeaderNav />
      </div>
    </header>
  );
}
