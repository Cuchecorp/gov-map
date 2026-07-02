import Link from "next/link";

import { SearchBox, type ExampleChip } from "@/components/search-box";

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

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-4 py-16 text-center md:px-8 md:py-24">
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
    </main>
  );
}
