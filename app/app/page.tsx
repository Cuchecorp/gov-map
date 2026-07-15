import Link from "next/link";

import { SearchBox, type ExampleChip } from "@/components/search-box";
import { ActualidadModule } from "@/components/actualidad-module";
import { BentoGrid } from "@/components/bento/bento-grid";
import { BentoTile } from "@/components/bento/bento-tile";
import { BrandIcon } from "@/components/brand-icon";

// FORCE-DYNAMIC (load-bearing, gotcha F50 — espejo de /red): el módulo de
// actualidad lee datos vivos (votacion/tramitacion_evento/proyecto/…) en cada
// request. Sin esto, Next hornea `/` como estática (○) durante el build y sirve
// una portada con datos congelados/500 en runtime. El home deja de ser una ruta
// prerenderable en cuanto muestra frescura → debe ser dinámica por request.
export const dynamic = "force-dynamic";

/**
 * Landing `/` — Bento composition (Phase 77-02, UI-SPEC §11.1, BENTO-02).
 *
 * Fila 1-2: BentoGrid 6 col con 5 tiles:
 *   - Hero span-4: kicker + LOCKED h1/cursiva/subtítulo/SearchBox/trust
 *   - Accent tile span-2: /sobre con fórmula "El principio" (no mockup)
 *   - 3 entry tiles span-2: /buscar, /parlamentarios, /agenda (LOCKED copy)
 *
 * Anti-insinuación / honestidad (UI-SPEC §6/§8/§11.1): SIN stats fabricadas,
 * SIN claims de marketing, SIN foto/partido. La cursiva petróleo usa `--accent-product`.
 * Accent tile cuerpo = fórmula /sobre "El principio"; NUNCA el mockup de correlaciones.
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
      {/* Bento container — mirrors layout.tsx footer max-w idiom */}
      <div className="max-w-[1120px] mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-8">
        <BentoGrid>
          {/* ── Hero tile: span-4 ─────────────────────────────────────────── */}
          <BentoTile variant="default" span={4} asChild>
            <section className="p-8 flex flex-col justify-center">
              {/* Kicker (net-new, Phase 77-02) */}
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                OBSERVATORIO DEL CONGRESO
              </p>

              {/* Titular display: sobrio + EXACTAMENTE una cláusula cursiva petróleo. */}
              <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
                Qué pasó con cada proyecto de ley y cada parlamentario.
                <em className="mt-2 block italic text-accent-product">
                  Con la fuente a la vista.
                </em>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
                Busca por una idea o por un número de boletín. Cada dato que verás
                lleva su fuente, su fecha y el enlace al documento oficial.
              </p>

              {/* La caja de búsqueda es la protagonista (héroe): CTA petróleo + pills. */}
              <div className="mt-10">
                <SearchBox autoFocus variant="hero" exampleChips={EXAMPLE_CHIPS} />
              </div>

              {/* Trust line LOCKED (UI-SPEC §6) — muted, separada por bullet. */}
              <p className="mt-8 text-sm text-muted-foreground">
                Fuente, fecha y enlace en cada dato · Sin afirmar intención ni
                causalidad.
              </p>
            </section>
          </BentoTile>

          {/* ── Accent tile: span-2 → /sobre ─────────────────────────────── */}
          {/* Body copy = fórmula /sobre "El principio" (T-77-03 mitigado).   */}
          {/* NUNCA el mockup "correlaciones/irregularidades" (anti-insinuación). */}
          <BentoTile variant="accent" span={2} asChild>
            <Link href="/sobre" className="p-6 flex flex-col justify-between">
              <BrandIcon color="currentColor" size={30} />
              <div>
                <h2 className="text-xl font-semibold text-accent-product-foreground">
                  ¿Cómo leer esto?
                </h2>
                <p className="mt-2 text-sm text-accent-product-foreground">
                  Cada dato lleva su fuente, su fecha y el enlace al documento
                  oficial. Cuando un dato no está disponible, se dice de forma
                  explícita; nunca se inventa.
                </p>
              </div>
              <span className="mt-6 text-sm font-semibold text-accent-product-foreground">
                Ver metodología{" "}
                <span aria-hidden="true" className="pl-1">
                  →
                </span>
              </span>
            </Link>
          </BentoTile>

          {/* ── 3 Entry tiles: span-2 cada una ───────────────────────────── */}
          {ENTRY_CARDS.map((card) => (
            <BentoTile key={card.href} variant="default" span={2} asChild>
              <Link href={card.href} className="p-6 flex flex-col">
                <div className="flex items-center justify-between">
                  {/* Single-diamond marker (petróleo via currentColor, aria-hidden) */}
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="text-accent-product"
                  >
                    <path
                      d="M8 2 L14 8 L8 14 L2 8 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 5.5 L10.5 8 L8 10.5 L5.5 8 Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span aria-hidden="true" className="pl-1 text-muted-foreground">
                    →
                  </span>
                </div>
                <span className="mt-3 text-lg font-semibold">{card.title}</span>
                <p className="mt-1 text-sm text-muted-foreground">{card.value}</p>
              </Link>
            </BentoTile>
          ))}
        </BentoGrid>
      </div>

      {/*
        Módulo de actualidad (SC4, 52-UI-SPEC §SC4) — BAJO el bento grid, dentro de
        <main>. Tres bloques server-rendered que degradan honesto e independiente;
        el hero (pills/copy) queda LOCKED e intacto. Cero JS cliente nuevo.
      */}
      <ActualidadModule />
    </main>
  );
}
