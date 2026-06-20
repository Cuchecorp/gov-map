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
 * `<Link>`s estáticos y estado de UI local; no recibe env/keys.
 *
 * Sin JavaScript la nav igual funciona (links siempre visibles, colapso por CSS):
 * el active-underline es una mejora progresiva, no un requisito de navegación.
 */

interface NavItem {
  href: string;
  label: string;
}

// LOCKED (UI-SPEC §11.0): Buscar · Parlamentarios · Agenda · Sobre / Metodología.
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/buscar", label: "Buscar" },
  { href: "/parlamentarios", label: "Parlamentarios" },
  { href: "/agenda", label: "Agenda" },
  { href: "/sobre", label: "Sobre / Metodología" },
];

function esActivo(pathname: string, href: string): boolean {
  // Activo si la ruta es exacta o un subárbol de la sección (p.ej. /parlamentarios/D123).
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Navegación principal">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2">
        {NAV_ITEMS.map((item) => {
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
