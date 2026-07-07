"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * HeaderNav — la nav del `GlobalHeader` (UI-SPEC §11.0). Es la ÚNICA parte que
 * necesita cliente: el subrayado del ítem activo se deriva de `usePathname()`,
 * que Next 16 sólo expone en Client Components (leer la URL en un Server Component
 * NO está soportado, ver node_modules/next/dist/docs/.../use-pathname.md). El
 * `<header>` padre se mantiene server-only; sólo este sub-árbol es `"use client"`,
 * mismo split que el repo usa (página server + SearchBox island).
 *
 * Anti-insinuación / seguridad (T-21-01-01): islote sin props sensibles — sólo
 * `<Link>`s estáticos y estado de UI local; no recibe env/keys. `showRed` es un
 * boolean NO sensible: sólo espeja lo que la ruta `/red` ya revela (404 con gate
 * OFF); el flag crudo `NET_PUBLIC_ENABLED` jamás llega a este islote (WR-01 F53).
 *
 * Sin JavaScript la nav igual funciona (links siempre visibles, colapso por CSS):
 * el active-underline es una mejora progresiva, no un requisito de navegación.
 */

interface NavItem {
  href: string;
  label: string;
}

// LOCKED (53-UI-SPEC §(a), re-open autorizado de §11.0 por CONTEXT F53): orden por
// journey Buscar · Parlamentarios · Agenda · Red · Sobre. `/red` (LIVE 2026-07-02)
// entra en pos 4 — deja de ser huérfana del header (F-01); label = nombre de ruta
// factual, NUNCA "Red de influencia"/"Conexiones" (banned-vocab). "Sobre" acortado
// para que 5 ítems quepan en 1 fila a 390px (Metodología sigue en /sobre + footer).
// El ítem Red se emite SOLO con `showRed` (Candado B NET espejado server-side en
// GlobalHeader vía `netPublicEnabled`, WR-01 F53): con el gate OFF el nodo está
// AUSENTE del DOM — el chrome nunca nombra una superficie que el gate niega.
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/buscar", label: "Buscar" },
  { href: "/parlamentarios", label: "Parlamentarios" },
  { href: "/agenda", label: "Agenda" },
  { href: "/red", label: "Red" },
  { href: "/sobre", label: "Sobre" },
];

function esActivo(pathname: string, href: string): boolean {
  // Activo si la ruta es exacta o un subárbol de la sección (p.ej. /parlamentarios/D123).
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface HeaderNavProps {
  /**
   * Espejo EXACTO del Candado B NET (`netPublicEnabled`), computado server-side
   * por `GlobalHeader` y pasado como boolean no-sensible. `true` → 5 ítems (con
   * Red); `false` → el ítem Red se filtra ENTERO del DOM (mismo patrón que el
   * enlace B21b de la ficha), nunca un link a un 404.
   */
  showRed: boolean;
}

export function HeaderNav({ showRed }: HeaderNavProps) {
  const pathname = usePathname() ?? "";
  const items = showRed
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.href !== "/red");

  return (
    <nav aria-label="Navegación principal">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2">
        {items.map((item) => {
          const activo = esActivo(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={[
                  // Touch target ≥44px (UI-SPEC §11.0): min-h-11 = 44px.
                  "inline-flex min-h-11 items-center px-3 text-sm font-medium",
                  "rounded-md transition-colors hover:text-accent-product",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  // Ítem activo subrayado en petróleo (--accent-product).
                  activo
                    ? "text-accent-product underline decoration-2 decoration-accent-product underline-offset-8"
                    : "text-foreground/80",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
