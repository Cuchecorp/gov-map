import Link from "next/link";

import { SearchBox, type ExampleChip } from "@/components/search-box";
import { ActualidadModule } from "@/components/actualidad-module";

// FORCE-DYNAMIC (load-bearing, gotcha F50 — espejo de /red): el módulo de
// actualidad lee datos vivos (votacion/tramitacion_evento/proyecto/…) en cada
// request. Sin esto, Next hornea `/` como estática (○) durante el build y sirve
// una portada con datos congelados/500 en runtime. El home deja de ser una ruta
// prerenderable en cuanto muestra frescura → debe ser dinámica por request.
export const dynamic = "force-dynamic";

/**
 * Landing `/` — search-as-hero (UI-SPEC §11.1, mockup `mockup/landing.html`,
 * diseño CERRADO en Fase 19). Server Component shell centrado sobre crema que
 * embebe la isla `SearchBox` (variante héroe). El header global vive en
 * `layout.tsx`; esta página es sólo el héroe.
 *
 * Paridad con el mockup (verbatim): titular display sobrio con EXACTAMENTE una
 * cláusula en cursiva petróleo ("Con la fuente a la vista."), subtítulo, caja de
 * búsqueda protagonista con CTA petróleo "Buscar proyectos", 4 pills LOCKED (3
 * ideas + 1 boletín en Mono), trust line LOCKED y el micro-afordance inline
 * "¿Cómo leer esto?".
 *
 * Anti-insinuación / honestidad (UI-SPEC §6/§8/§11.1): SIN stats fabricadas
 * (no "N proyectos indexados" salvo count(*) real — aquí ninguno), SIN claims de
 * marketing, SIN foto/partido. La cursiva petróleo usa `--accent-product`.
 */

// Pills LOCKED (UI-SPEC §6, copy fijo): 3 ideas semánticas + 1 boletín en Mono.
const EXAMPLE_CHIPS: readonly ExampleChip[] = [
  { query: "protección de datos personales" },
  { query: "delitos económicos y medio ambiente" },
  { query: "40 horas / jornada laboral" },
  { query: "14309-04", mono: true },
];

// Tarjetas de entrada (54-UI-SPEC Contract 2). Títulos LOCKED por CONTEXT;
// líneas de valor prescritas verbatim. Server-rendered, cero JS: cada tarjeta es
// un <Link> full-card. Copy vetado por banned-vocab (sin virtud/causal/score).
const ENTRY_CARDS: readonly {
  title: string;
  href: string;
  value: string;
}[] = [
  {
    title: "Proyectos de ley",
    href: "/buscar",
    value:
      "En qué etapa está cada proyecto y cómo se ha votado, con cada fuente enlazada.",
  },
  {
    title: "Parlamentarios 360",
    href: "/parlamentarios",
    value:
      "Votaciones, lobby y patrimonio de cada parlamentario, según los registros públicos.",
  },
  {
    title: "Agenda de la semana",
    href: "/agenda",
    value:
      "Citaciones de comisiones y tabla de sala, enlazadas a cada proyecto.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-4 pt-16 pb-8 text-center md:px-8 md:pt-24 md:pb-10">
        {/* Titular display: sobrio + EXACTAMENTE una cláusula cursiva petróleo. */}
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
          Qué pasó con cada proyecto de ley y cada parlamentario.
          <em className="mt-2 block italic text-accent-product">
            Con la fuente a la vista.
          </em>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Busca por una idea o por un número de boletín. Cada dato que verás
          lleva su fuente, su fecha y el enlace al documento oficial.
        </p>

        {/* La caja de búsqueda es la protagonista (héroe): CTA petróleo + pills. */}
        <div className="mx-auto mt-10 max-w-2xl">
          <SearchBox autoFocus variant="hero" exampleChips={EXAMPLE_CHIPS} />
        </div>

        {/* Trust line LOCKED (UI-SPEC §6) — muted, separada por bullet. */}
        <p className="mt-8 text-sm text-muted-foreground">
          Fuente, fecha y enlace en cada dato · Sin afirmar intención ni
          causalidad.
        </p>

        {/* Onboarding inline (UI-SPEC §11.1): link-styled, sin modal ni tour. */}
        <p className="mt-4 text-sm">
          <Link
            href="/sobre"
            className="text-accent-product underline-offset-4 hover:underline"
          >
            ¿Cómo leer esto?
          </Link>
        </p>
      </section>

      {/*
        Tarjetas de entrada (54-UI-SPEC Contract 2) — ENTRE el hero y actualidad.
        <nav> con 3 <Link> full-card server-rendered; SIN heading (se ubica entre
        el h1 del hero y los h2 de actualidad). Cero JS cliente. Los títulos son
        <span>; el glyph → va con pl-1 (nunca whitespace text node, lección F53).
      */}
      <nav
        aria-label="Secciones del sitio"
        className="mx-auto max-w-5xl px-4 pb-12 md:px-8 md:pb-16"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {ENTRY_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent-product/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-base font-semibold leading-snug">
                {card.title}
                <span aria-hidden="true" className="pl-1">
                  →
                </span>
              </span>
              <p className="mt-1 text-sm text-muted-foreground">{card.value}</p>
            </Link>
          ))}
        </div>
      </nav>

      {/*
        Módulo de actualidad (SC4, 52-UI-SPEC §SC4) — BAJO el hero, dentro de
        <main>. Tres bloques server-rendered que degradan honesto e independiente;
        el hero (pills/copy) queda LOCKED e intacto. Cero JS cliente nuevo.
      */}
      <ActualidadModule />
    </main>
  );
}
