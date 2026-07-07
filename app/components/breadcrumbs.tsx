import Link from "next/link";

/**
 * Breadcrumbs — migaja de ruta ligera para las fichas (53-UI-SPEC §(b) /
 * §Component Inventory). Server Component presentacional PURO: sin "use client",
 * sin usePathname — cada página pasa sus crumbs LITERALES (el remedio contratado
 * para el gap "no sé dónde estoy": en `/proyecto/*` y `/contraparte/*` ningún ítem
 * del nav queda activo). Cero JS, cero dependencia nueva (separador = glifo Unicode
 * `/` inline, aria-hidden; NO el bloque breadcrumb de shadcn ni lucide).
 *
 * Contrato: `items` es la ruta ordenada; el ÚLTIMO ítem va SIN `href` = segmento
 * actual (texto plano con aria-current="page", nunca un link). `mono:true` pone el
 * segmento en Geist Mono (p.ej. "Boletín 14309-04"). N ítems → N-1 separadores.
 *
 * Anti-insinuación / privacidad: renderiza SOLO labels de ruta + el nombre público
 * shipped que ya vive en el h1 — cero PII/partido/foto (53-UI-SPEC Invariant 5). Es
 * un <nav> arriba del h1, NUNCA un heading: no re-nivela h1–h3 ni mueve el carril
 * mt-12 (Invariant 1).
 */

interface Crumb {
  /** Texto visible del segmento. */
  label: string;
  /** Ruta destino; ausente = segmento actual (texto plano, aria-current). */
  href?: string;
  /** true → segmento en Geist Mono (boletín, IDs). */
  mono?: boolean;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground mb-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-x-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-md underline-offset-4 hover:underline hover:text-accent-product focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className={item.mono ? "font-mono text-foreground" : "text-foreground"}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
