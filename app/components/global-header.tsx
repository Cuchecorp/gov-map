import Link from "next/link";

import { BrandIcon } from "@/components/brand-icon";
import { HeaderNav } from "@/components/header-nav";
import { netPublicEnabled } from "@/lib/net-gate";

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
 * wordmark → home; a la derecha la nav de 5 ítems en orden por journey
 * (53-UI-SPEC §a): Buscar · Parlamentarios · Agenda · Red · Sobre — el ítem Red
 * espeja el Candado B NET (ausente con gate OFF). Sin auth/login, sin theme
 * toggle obligatorio.
 *
 * Anti-insinuación: cero foto, cero partido — sólo navegación textual.
 */
export function GlobalHeader() {
  // WR-01 (F53): el ítem Red de la nav espeja el Candado B NET. El flag se lee
  // AQUÍ (Server Component, chokepoint `netPublicEnabled`, nunca el env crudo) y
  // baja como boolean no-sensible — con gate OFF el nodo Red está AUSENTE del
  // DOM, igual que toda superficie NET/MONEY/CRUCES gated del repo.
  const showRed = netPublicEnabled(process.env);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex min-h-14 max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-base font-semibold leading-tight tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <BrandIcon size={26} color="#2A5859" aria-hidden="true" />
          gov-map
        </Link>

        <HeaderNav showRed={showRed} />
      </div>
    </header>
  );
}
