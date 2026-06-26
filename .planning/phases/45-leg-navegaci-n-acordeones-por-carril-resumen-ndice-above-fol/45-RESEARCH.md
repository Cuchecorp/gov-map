# Phase 45: LEG — Navegación (acordeones por carril + resumen above-fold) - Research

**Researched:** 2026-06-26
**Domain:** Next.js 16 App Router UI re-layout — Radix Accordion as a thin client island wrapping Server Components, honest 3-state above-fold index. Data-independent.
**Confidence:** HIGH

## Summary

Esta es una fase de **re-layout puramente de presentación** sobre `app/app/parlamentario/[id]/page.tsx`. El contenido de las secciones (VotosSection, LobbySection, PatrimonioSection, CrucesSection, MONEY/honest-state) **no se toca**; cada una se sigue ejecutando como Server Component que lee su RPC server-side. El cambio es: (1) envolver el `<h2>` + Suspense + sección de cada carril en un **acordeón Radix independiente** cuyo header (con el `<h2>` y un conteo honesto) queda siempre visible y cuyo cuerpo colapsa; y (2) insertar, entre la cabecera y el primer carril, un **resumen + índice** de chips con conteo/estado honesto por carril y anclas de salto.

El patrón técnico clave está **confirmado por la doc de Next.js 16 instalada** (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, §Interleaving): un Client Component recibe Server Components **como `children`/props** y los renderiza en un "slot"; esos Server Components NO entran al module graph del cliente, se renderizan en el server y se pasan como output ya renderizado (RSC payload). Por tanto el `CarrilAccordion` `"use client"` (solo el toggle) puede envolver `<Suspense><VotosSection/></Suspense>` sin convertir la sección en cliente — **siempre que la página (server) sea quien importe las secciones y las pase como children, y el wrapper NO las importe**. Ese es el único landmine real de la fase.

La única dependencia nueva es **`@radix-ui/react-accordion@1.2.14`** (familia Radix ya instalada: separator/slot/tooltip; React 19 soportado; sin postinstall; slopcheck [OK]). La frontera anti-insinuación `mt-12` se preserva trivialmente porque cada acordeón vive en su propia `<section className="mt-12">` hermana — **un acordeón por dominio, nunca una lista de items multi-dominio**.

**Primary recommendation:** Crear `app/components/carril-accordion.tsx` (`"use client"`, un `Accordion.Root type="single" collapsible` con un solo `Item` por carril, `Accordion.Header asChild` con el `<h2>`, `Accordion.Content forceMount` + CSS para que el contenido SSR quede en el HTML aunque el carril esté colapsado) y `app/components/parlamentario-resumen.tsx` (Server Component que arma los chips). Los conteos los provee un módulo server `app/lib/parlamentario-resumen-conteos.ts` que llama SOLO RPCs ya allowlisted, envuelto en `React.cache()`. La página orquesta: importa las secciones (server) y las pasa como `children` al `CarrilAccordion`.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Componente: `@radix-ui/react-accordion`** — única dependencia nueva. PROHIBIDO solución custom o `<details>` crudo.
- **Uno por carril de dominio.** PROHIBIDO un acordeón que agrupe dos dominios en una misma unidad (anti-insinuación §8.2).
- **Header siempre visible (no colapsable):** el `<h2>` del carril vive en el header → conserva `h1→h2→h3` aunque el cuerpo esté cerrado.
- **Conteo/estado en el header** (`(9)`, `(6 años)`, `(—)`): respeta los 3 estados honestos (dato / vacío-honesto / no-ingerido); nunca aparenta densidad.
- **Patrón técnico:** ficha sigue **server-rendered**; solo el toggle es **thin client wrapper** (`"use client"`) que envuelve los Server Components de sección como children. Suspense + skeletons existentes se conservan.
- **Frontera de carril `mt-12` entre carriles hermanos NUNCA se colapsa**, ni con un carril vacío. Los acordeones son hermanos separados por `mt-12`, no items dentro de un solo acordeón. Una reunión/declaración/contrato/voto JAMÁS comparten `<article>/<Card>/<li>/<tr>`.
- **Resumen + índice above-fold (§1.1):** se renderiza **después de `ParlamentarioHeader`, antes del primer carril**. Un chip por carril con (a) etiqueta, (b) conteo/estado honesto 3-estado, (c) ancla (`href="#votos"`). Conteo derivado **server-side**, reutilizando los conteos de las secciones o vía RPCs ya allowlisted. NUNCA inventa un número.
- **Sin `.from('parlamentario')`** ni tabla PII directa; **sin RPC fuera del `PUBLIC_RPC_ALLOWLIST`**. Guard CI verde.
- **SSR intacto:** solo el toggle es cliente. No mover lectura de datos al cliente.
- **Gates MONEY/CRUCES intactos:** el gate sigue envolviendo la `<section>` ENTERA (heading incluido); con OFF el nodo entero está AUSENTE del HTML. El resumen solo lista carriles efectivamente presentes.
- **Orden de carriles LOCKED:** `#votos` → `#lobby` → `#patrimonio` → `#cruces` (gated, hoy ON) → MONEY gated (`#dinero`/`#financiamiento`, hoy OFF) o `#financiamiento-pendiente` (honest-state cuando MONEY OFF).

### Claude's Discretion
- Heurística exacta de qué carriles abren por default (conservador = colapsar vacíos/ralos, abrir el primero con datos sustantivos).
- Estilado/markup del chip y del header (dentro del DESIGN-SYSTEM: crema/petróleo, escala 8-pt, sin foto/partido).
- Ubicación de los nuevos componentes (`app/components/parlamentario-resumen.tsx`, `app/components/carril-accordion.tsx`).
- Animación del acordeón (respetar `prefers-reduced-motion`).
- Cómo obtener los conteos sin duplicar queries (preferir reutilización; aceptable un RPC ya allowlisted).

### Deferred Ideas (OUT OF SCOPE)
- Gráficos/charts (patrimonio-conteo, votos, etc.) → Phase 46+. Esta fase NO instala Recharts ni dibuja nada.
- Cualquier RPC nueva o cambio de datos → fases de la pista de ingesta (F47/F48/F49, gated).
- Encender flags `*_PUBLIC_ENABLED` → exclusivo humano, nunca en esta fase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEG-01 | Cada carril (`#votos`, `#lobby`, `#patrimonio`, `#cruces`, MONEY gated) = acordeón independiente; `<h2>` en header siempre visible (preserva `h1→h2→h3`); cuerpo colapsable; frontera `mt-12` nunca colapsa; `@radix-ui/react-accordion`, SSR + thin client wrapper | Architecture Pattern 1 (CarrilAccordion) + Pattern 2 (slot children) + Code Examples; `Accordion.Header asChild` → `<h2>`; un `Accordion.Root` por carril dentro de su `<section className="mt-12">` |
| LEG-02 | Resumen + índice above-fold: chip por carril con conteo/estado honesto 3-estado + ancla de salto | Architecture Pattern 3 (ParlamentarioResumen) + "Don't Hand-Roll" (conteos vía RPC allowlisted con `cache()`); mapa RPC→carril; 3-state chip |
| LEG-03 | Comportamiento-preservante: no toca contenido de secciones; sin `.from('parlamentario')` ni RPC fuera de allowlist (guard verde); SSR intacto (solo toggle cliente); default colapsa vacíos/ralos; suite `app/` verde + `tsc -b` limpio; build Docker Linux | Pitfalls (client-leak, guard, forceMount); Validation Architecture; Common Pitfalls 1–4 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lectura de datos de cada carril (RPC) | API/Backend (Supabase RPC) vía Server Component | — | Ya server-only (security definer, allowlist). NO se mueve al cliente. |
| Render del contenido de cada sección | Frontend Server (RSC) | — | Server Components ejecutan en server, se pasan como children al wrapper cliente (RSC payload). |
| Toggle abrir/cerrar acordeón | Browser/Client (`"use client"`) | — | Único estado interactivo; Radix maneja teclado/ARIA. Thin island. |
| Conteo/estado honesto del resumen | Frontend Server (RSC) | API/Backend (RPC allowlisted) | Derivado server-side vía RPCs PII-safe; nunca en el cliente, nunca un número inventado. |
| Anclas de salto (`#votos`) | Browser (navegación nativa de fragmento) | — | `<a href="#id">` puro; el `id` vive en la `<section>` server-rendered. Sin JS. |
| Gates MONEY/CRUCES | Frontend Server (server-only flag) | — | `moneyPublicEnabled`/`crucesPublicEnabled` envuelven la `<section>` entera; OFF = nodo ausente del HTML. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-accordion` | 1.2.14 | Acordeón accesible por carril (header + cuerpo colapsable) | Familia Radix ya instalada (separator/slot/tooltip); teclado/ARIA correctos; SSR-friendly; `asChild` permite `<h2>` semántico; CSS vars para animación. Único componente nuevo. `[VERIFIED: npm registry]` v1.2.14 publicada 2026-06-15, peer `react ^19.0` ✓, sin postinstall. |

### Supporting (ya instalados — sin cambios)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next` | 16.2.9 | App Router, Server/Client Components, Suspense | El patrón "Server Component como children de un Client Component" es el núcleo de la fase `[CITED: node_modules/next/dist/docs/.../05-server-and-client-components.md]` |
| `react` | 19.2.4 | `cache()` para dedupe de conteos server-side; estado del toggle | `React.cache()` memoiza el conteo por `id` dentro del request |
| `@radix-ui/react-slot` | 1.3.0 | `asChild` (ya presente como dep transitiva de Radix) | Soporta el `Accordion.Header asChild` |
| `tailwindcss` + `tailwindcss-animate` | 4.3.1 / 1.0.7 | Animación del `Accordion.Content` vía `--radix-accordion-content-height` | `tailwindcss-animate` ya instalado; define keyframes accordion-down/up |
| `clsx` / `tailwind-merge` (`cn`) | — | Clases condicionales del header/chip | Patrón `cn()` ya usado en todo `app/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@radix-ui/react-accordion` | `<details>/<summary>` nativo | LOCKED contra: estilado inconsistente entre navegadores, ARIA/teclado más débil, animación más difícil. |
| `@radix-ui/react-accordion` | Toggle custom con `useState` | Reinventa ARIA `aria-expanded`/`region`, focus management, teclado. Radix ya lo resuelve. |
| Un `Accordion.Root` por carril | Un solo `Accordion.Root type="multiple"` con N items | PROHIBIDO: agruparía dominios en una sola unidad de acordeón → viola anti-insinuación §8.2 y arriesga colapsar la frontera `mt-12`. Cada carril DEBE ser su propio root en su propia `<section mt-12>`. |

**Installation:**
```bash
cd app && pnpm add @radix-ui/react-accordion@1.2.14
```
(El repo usa **pnpm** — ver memoria "pnpm no npm". El build de producción se valida en **Docker Linux**, nunca build Windows.)

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@radix-ui/react-accordion` | npm | familia Radix ~4 yrs; v1.2.14 patch 2026-06-15 | ~5M+/wk (familia Radix) | github.com/radix-ui/primitives | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 corrió y reportó `[OK] @radix-ui/react-accordion (npm) — 1 OK`. Verificación de registro: `npm view @radix-ui/react-accordion version` → 1.2.14; peerDependencies incluye `react ^19.0`; `scripts.postinstall` vacío (sin script de postinstall — sin vector de ejecución en install). Es la misma org `@radix-ui` de los 3 paquetes Radix ya en `package.json`. Confianza HIGH.

## Architecture Patterns

### System Architecture Diagram

```
  Request /parlamentario/[id]
        │
        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ ParlamentarioPage  (Server Component, async)                 │
 │  • valida id (PARLAMENTARIO_ID_RE) → notFound()              │
 │  • lee gates: crucesPublicEnabled(env), moneyPublicEnabled(env)│
 │                                                              │
 │  1. <ParlamentarioHeader>  (sin cambios)                     │
 │                                                              │
 │  2. <ParlamentarioResumen id ...>   ◄── NUEVO (Server Comp.) │
 │        └─ contarCarriles(id)  [React.cache(), RPCs allowlist] │
 │        └─ emite 1 chip por carril PRESENTE (respeta gates):  │
 │             [Votaciones N] [Lobby N] [Patrimonio N] ...       │
 │             cada chip = <a href="#votos"> + conteo 3-estado   │
 │                                                              │
 │  ── mt-12 (frontera LOCKED) ──                               │
 │  3. <section id="votos" className="mt-12">                   │
 │       <CarrilAccordion titulo="Votaciones" conteo defaultOpen>│  ◄ "use client" (solo toggle)
 │          {children}=  <Suspense><VotosSection/></Suspense>   │  ◄ Server Comp pasado como CHILD
 │       </CarrilAccordion>                                     │     (ejecuta en server; RSC payload)
 │     </section>                                               │
 │  ── mt-12 ──  <section id="lobby">   … idéntico patrón       │
 │  ── mt-12 ──  <section id="patrimonio"> …                    │
 │  ── mt-12 ──  {crucesPublicEnabled && <section id="cruces">} │
 │  ── mt-12 ──  {moneyPublicEnabled  && <section id="dinero">} │
 │  ── mt-12 ──  {!moneyPublicEnabled && <section              │
 │                  id="financiamiento-pendiente"> honest-state}│
 └─────────────────────────────────────────────────────────────┘
        │
        ▼  (en el navegador)
  Radix Accordion.Trigger (button) → toggla aria-expanded / data-state
  Contenido SSR ya presente (forceMount) → CSS muestra/oculta + anima
```

Data flow: las secciones leen sus RPCs en el server (igual que hoy). El cliente solo recibe el toggle hidratado; los datos NUNCA viajan como fetch de cliente.

### Recommended Project Structure
```
app/
├── app/parlamentario/[id]/page.tsx     # MODIFICAR: orquesta resumen + envuelve cada section en CarrilAccordion
├── components/
│   ├── carril-accordion.tsx            # NUEVO "use client": Accordion.Root single+collapsible, 1 item, h2 en header
│   ├── carril-accordion.test.tsx       # NUEVO: header visible, toggle, conteo en header
│   ├── parlamentario-resumen.tsx       # NUEVO Server Component: chips (label + 3-estado + ancla)
│   ├── parlamentario-resumen.test.tsx  # NUEVO: chip por carril presente, anclas, 3-estado, money-off honest
│   └── (secciones existentes SIN CAMBIOS de contenido interno)
└── lib/
    ├── parlamentario-resumen-conteos.ts       # NUEVO server: contarCarriles(id) con React.cache() + RPCs allowlisted
    └── parlamentario-resumen-conteos.test.ts  # NUEVO (opcional): mapeo conteo→estado 3-estado puro
```

### Pattern 1: Acordeón por carril (un Root por dominio, `<h2>` en header)
**What:** Cada carril es UN `Accordion.Root type="single" collapsible` con UN solo `Accordion.Item`. El `Accordion.Header` usa `asChild` para renderizar el `<h2>` (siempre visible). El `Accordion.Content` usa `forceMount` para que el contenido SSR quede en el HTML aunque el carril esté colapsado.
**When to use:** Todos los carriles de dominio de la ficha.
**Example:**
```tsx
// app/components/carril-accordion.tsx
"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";

export function CarrilAccordion({
  titulo,
  conteo,            // nodo ya formateado (3-estado): "9" | "—" | "sin registros" | etc.
  defaultOpen,
  children,          // <Suspense><XSection/></Suspense>  — Server Component pasado como child
}: {
  titulo: string;
  conteo: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Root type="single" collapsible defaultValue={defaultOpen ? "c" : undefined}>
      <Accordion.Item value="c">
        {/* asChild → el <h2> ES el header; SIEMPRE visible, nunca colapsa (preserva h1→h2→h3) */}
        <Accordion.Header asChild>
          <h2 className="text-xl font-semibold">
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 min-h-11 text-left">
              <span>{titulo}</span>
              <span className="flex items-center gap-2 text-muted-foreground font-normal text-sm">
                <span className="font-mono">{conteo}</span>
                <ChevronGlyph /> {/* rota con [data-state=open]; glifo unicode, sin nuevo icon dep */}
              </span>
            </Accordion.Trigger>
          </h2>
        </Accordion.Header>
        {/* forceMount → contenido SSR siempre en el HTML; CSS lo oculta/anima cuando data-state=closed */}
        <Accordion.Content forceMount className="overflow-hidden data-[state=closed]:hidden pt-4">
          {children}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
```
Nota: `lucide-react@1.20.0` está instalado, pero el DESIGN-SYSTEM (§5.2) prefiere glifos Unicode inline; usar un `<span>` con `▾` rotando vía `group-data-[state=open]:rotate-180` evita lógica extra. Discreción de estilado.

### Pattern 2: La página pasa las secciones como `children` (no las importa el wrapper)
**What:** La página (Server Component) importa las secciones y las pasa como `children` al `CarrilAccordion`. El wrapper cliente NUNCA importa una sección.
**When to use:** Cada carril en `page.tsx`.
**Example:**
```tsx
// app/app/parlamentario/[id]/page.tsx  (la página SIGUE importando las secciones — el wrapper NO)
<section id="votos" className="mt-12">
  <CarrilAccordion titulo="Votaciones" conteo={conteos.votos.label} defaultOpen={conteos.votos.abrir}>
    <Suspense fallback={<VotosSkeleton />}>
      <VotosSection id={id} searchParams={sp} />
    </Suspense>
  </CarrilAccordion>
</section>
```
**Por qué funciona (CITED):** "It does not apply to Server Components passed as children or other props. Those components are not imported into the Client Component's module graph. They are rendered on the server and passed to the Client Component as rendered output." — `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` (líneas 178, 297–345).

### Pattern 3: Resumen above-fold (Server Component) con conteo 3-estado
**What:** `ParlamentarioResumen` (server) llama `contarCarriles(id)` y emite un chip `<a>` por carril PRESENTE (respetando los mismos gates que la página). Cada chip lleva label + conteo 3-estado + `href="#<carril>"`.
**When to use:** Una vez, entre `ParlamentarioHeader` y el primer carril.
**Example:**
```tsx
// app/components/parlamentario-resumen.tsx  (Server Component — sin "use client")
import { contarCarriles } from "@/lib/parlamentario-resumen-conteos";
import { crucesPublicEnabled } from "@/lib/cruces-gate";
import { moneyPublicEnabled } from "@/lib/money-gate";

export async function ParlamentarioResumen({ id }: { id: string }) {
  const c = await contarCarriles(id);
  const chips = [
    { href: "#votos", label: "Votaciones", estado: c.votos },
    { href: "#lobby", label: "Reuniones de lobby", estado: c.lobby },
    { href: "#patrimonio", label: "Declaraciones de patrimonio", estado: c.patrimonio },
    ...(crucesPublicEnabled(process.env) ? [{ href: "#cruces", label: "Cruces con sectores", estado: c.cruces }] : []),
    ...(moneyPublicEnabled(process.env)
      ? [{ href: "#dinero", label: "Contratos y financiamiento", estado: c.dinero }]
      : [{ href: "#financiamiento-pendiente", label: "Financiamiento y contratos", estado: { tipo: "pendiente" as const } }]),
  ];
  return (
    <nav aria-label="Índice de secciones" className="mt-6 flex flex-wrap gap-2">
      {chips.map((ch) => (
        <a key={ch.href} href={ch.href} className="inline-flex items-center gap-2 min-h-11 ...">
          <span>{ch.label}</span>
          <ChipConteo estado={ch.estado} />  {/* 3-estado: dato → "9"; vacío-honesto → "0"/"sin registros"; no-ingerido → "—" */}
        </a>
      ))}
    </nav>
  );
}
```
El `ChipConteo` mapea los 3 estados a render textual distinto (NUNCA un vacío que se lea como densidad). Mantener PURO/testeable.

### Anti-Patterns to Avoid
- **`import { VotosSection } from …` dentro de `carril-accordion.tsx`:** convertiría la sección en parte del módulo cliente → la arrastraría al bundle y rompería el SSR/data-fetching server-only. El wrapper SOLO recibe `children`.
- **Un único `Accordion.Root` con varios `Item` (uno por dominio):** agrupa dominios en una unidad de acordeón → viola anti-insinuación §8.2; además los items quedarían visualmente como una lista sin la frontera `mt-12`. PROHIBIDO.
- **Mover el conteo al cliente / `useEffect` que fetchea:** rompe SSR y arriesga llamar RPCs desde el cliente. Los conteos son server-only.
- **Colapsar la `<section className="mt-12">` cuando el carril está vacío:** la frontera `mt-12` es LOCKED y existe **independiente del contenido**; un carril vacío conserva su acordeón (cerrado) y su `mt-12`.
- **Inventar un número en el chip:** si no hay dato, el chip muestra el estado honesto correcto (vacío-honesto o no-ingerido), nunca "0 actividad" disfrazado de limpieza.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle accesible (ARIA, teclado, focus, `region`) | `useState` + `aria-*` a mano | `@radix-ui/react-accordion` | Radix ya implementa `aria-expanded`, `aria-controls`, roving focus, Enter/Space/flechas. |
| Heading semántico en el trigger | `<div role="heading">` | `Accordion.Header asChild` + `<h2>` | Conserva `h1→h2→h3` real; el `asChild` deja el `<h2>` como elemento del header. |
| Conteo del resumen sin duplicar/inventar | Query propia ad-hoc por chip | `contarCarriles(id)` con `React.cache()` llamando SOLO RPCs allowlisted | `cache()` deduplica dentro del request; el guard exige RPC allowlisted; cero número fabricado. |
| Animación de altura colapsable | Medir `scrollHeight` con JS | CSS `--radix-accordion-content-height` + keyframes (tailwindcss-animate) | Radix expone la altura como CSS var; sin medición manual; degrada a sin-animación con `prefers-reduced-motion`. |
| Anclas de salto | Scroll programático con JS | `<a href="#votos">` nativo + `id` en la `<section>` | Funciona sin JS, SSR puro. |

**Key insight:** la fase casi no escribe lógica nueva — escribe **composición**. El riesgo no es complejidad sino dos fugas: (1) que un Server Component se vuelva cliente por importarlo en el wrapper, y (2) que el conteo del resumen llame algo fuera del allowlist o invente densidad.

## Runtime State Inventory

> Fase puramente de presentación (re-layout de UI). No hay rename/refactor de strings, ni migración de datos, ni cambio de estado en runtime/servicios externos.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — la fase no escribe ni renombra datos; lee RPCs ya existentes. | none |
| Live service config | None — sin n8n/Datadog/Tailscale tocados. | none |
| OS-registered state | None — sin tasks/cron nuevos. | none |
| Secrets/env vars | Reusa `CRUCES_PUBLIC_ENABLED` / `MONEY_PUBLIC_ENABLED` (lectura server-only vía gates existentes). NO se crean ni renombran. | none |
| Build artifacts | `@radix-ui/react-accordion` se agrega a `pnpm-lock.yaml` / `node_modules`; build OpenNext se re-genera en Docker Linux. | `pnpm add` + rebuild Docker Linux (checkpoint operador para deploy). |

## Common Pitfalls

### Pitfall 1: Convertir una sección en Client Component (fuga de SSR)
**What goes wrong:** Si `carril-accordion.tsx` (con `"use client"`) importa `VotosSection`/`LobbySection`, esas secciones entran al module graph del cliente; sus llamadas a `createServerSupabase()`/RPC fallan o se filtran al bundle, y el `service_role` jamás debe llegar al cliente.
**Why it happens:** Reflejo de "el wrapper usa la sección, entonces la importo".
**How to avoid:** El wrapper recibe `children: React.ReactNode` y NO importa ninguna sección. La PÁGINA (server) importa las secciones y las pasa como children. Verificación: `grep` en `carril-accordion.tsx` no debe contener `Section`/`createServerSupabase`/`@/lib/supabase`.
**Warning signs:** error de build "You're importing a component that needs `server-only`…", o `next build` marca la sección como client.

### Pitfall 2: Romper el guard de lockdown con un RPC/`.from()` del resumen
**What goes wrong:** `contarCarriles(id)` llama un RPC que no está en `PUBLIC_RPC_ALLOWLIST`, o hace `.from('parlamentario')` → `lockdown-guard.test.ts` (Block B) falla.
**Why it happens:** Tentación de un RPC de conteo "nuevo" o de leer la tabla maestra directo.
**How to avoid:** Conteos SOLO vía RPCs ya en el allowlist: `votos_de_parlamentario`, `lobby_de_parlamentario`, `declaraciones_de_parlamentario`, `cruces_de_parlamentario`. Para no-ingerido, `.from('lobby_ingesta_estado')` / `.from('probidad_ingesta_estado')` son tablas NO-PII (no están en `PII_TABLES`) → permitido. NO crear RPCs nuevos (eso es F46+).
**Warning signs:** `pnpm test` falla en `(B) Guard — … no toca tablas PII` o `… RPC fuera del allowlist`.

### Pitfall 3: Contenido colapsado ausente del HTML inicial (SSR + anclas)
**What goes wrong:** `Accordion.Content` por defecto desmonta el contenido cuando está cerrado; un carril colapsado no aparece en el HTML inicial → un ancla `#patrimonio` salta a un header sin cuerpo, y el contenido server-rendered no está presente sin JS.
**Why it happens:** Comportamiento default de Radix (`Presence` desmonta cuando `data-state=closed`).
**How to avoid:** Usar `Accordion.Content forceMount` + ocultar con CSS (`data-[state=closed]:hidden`). Así el contenido SSR siempre está en el HTML (RSC payload renderizado), el toggle solo cambia visibilidad, y "SSR intacto: solo el toggle es cliente" se cumple literalmente. **Decisión para el planner:** `forceMount` (recomendado) vs default-unmount — ver Open Questions Q1.
**Warning signs:** "View source" del carril colapsado no contiene el texto de la sección; el ancla salta pero no hay cuerpo bajo el header.

### Pitfall 4: Colapsar la frontera `mt-12`
**What goes wrong:** Al reorganizar, mover el `mt-12` al wrapper interno o quitarlo de carriles vacíos → dos carriles se leen como un bloque (insinuación).
**Why it happens:** Refactor que centraliza spacing en el componente acordeón.
**How to avoid:** El `mt-12` se queda en la `<section>` hermana en `page.tsx`, EXACTAMENTE como hoy. El `CarrilAccordion` NO controla el margen entre carriles. Test estructural: cada `<section>` de carril conserva `mt-12`.
**Warning signs:** Test de frontera falla; inspección visual muestra carriles pegados.

### Pitfall 5: Animación que ignora `prefers-reduced-motion`
**What goes wrong:** Keyframes de altura corren siempre → molesto/accesibilidad.
**How to avoid:** Envolver los keyframes accordion-down/up en `@media (prefers-reduced-motion: no-preference)`; sin esa media query la transición no corre (el toggle sigue funcionando, solo sin animación).
**Warning signs:** Movimiento con reduce-motion activado en el SO.

## Code Examples

### Conteo 3-estado server-side, dedupe con `cache()`, solo RPCs allowlisted
```tsx
// app/lib/parlamentario-resumen-conteos.ts
import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase";

export type CarrilEstado =
  | { tipo: "dato"; n: number }          // chip muestra n
  | { tipo: "vacio" }                    // ingestado, 0 → "sin registros"
  | { tipo: "no_ingerido" }              // no ingestado → "—"
  | { tipo: "pendiente" };               // MONEY OFF honest-state

// cache() deduplica si la misma función se llama 2× en el request (resumen + futura reutilización).
export const contarCarriles = cache(async (id: string) => {
  const sb = createServerSupabase();
  // Cada RPC ∈ PUBLIC_RPC_ALLOWLIST. Solo .length / agrupación; nunca un número inventado.
  const votos = await sb.rpc("votos_de_parlamentario", { p_id: id, p_limit: 1000, p_offset: 0 });
  const lobby = await sb.rpc("lobby_de_parlamentario", { p_id: id });
  const patr  = await sb.rpc("declaraciones_de_parlamentario", { p_id: id });
  // no-ingerido: tablas *_ingesta_estado NO son PII → .from() permitido por el guard.
  const lobbyEstado = await sb.from("lobby_ingesta_estado").select("parlamentario_id").eq("parlamentario_id", id).maybeSingle();
  const probEstado  = await sb.from("probidad_ingesta_estado").select("parlamentario_id").eq("parlamentario_id", id).maybeSingle();
  // … derivar 3-estado por carril (errores reales: lanzar, nunca degradar a vacío — patrón #34) …
  return { votos: /*…*/, lobby: /*…*/, patrimonio: /*…*/, cruces: /*…*/, dinero: /*…*/ };
});
```
Nota de honestidad: replica EXACTAMENTE la regla de cada sección (votos/lobby/patrimonio: `noIngestado = estado === null && total === 0`). El conteo de patrimonio de la sección es **versiones**; el label "(6 años)" del UI-SPEC es discreción de presentación (años distintos de `fecha_presentacion`) — ver Open Questions Q2.

### CSS de animación (globals.css o tailwind) con reduce-motion
```css
@media (prefers-reduced-motion: no-preference) {
  [data-state="open"]  > .accordion-content { animation: accordion-down 200ms ease-out; }
  [data-state="closed"] > .accordion-content { animation: accordion-up 200ms ease-out; }
}
@keyframes accordion-down { from { height: 0 } to { height: var(--radix-accordion-content-height) } }
@keyframes accordion-up   { from { height: var(--radix-accordion-content-height) } to { height: 0 } }
```
`tailwindcss-animate` ya provee `accordion-down`/`accordion-up`; verificar si están registrados en la config Tailwind v4 (puede requerir declararlos). `[CITED: radix-ui.com/primitives/docs/components/accordion]` para `--radix-accordion-content-height`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Accordion.Header>` con nivel fijo h3 | `asChild` para elegir el nivel de heading (h2 aquí) | Radix 1.x | Permite preservar `h1→h2→h3` sin saltar niveles. |
| Pages Router / client-fetch | App Router: Server Components pasados como `children` a islas cliente | Next 13→16 | Habilita "solo el toggle es cliente" sin sacrificar SSR data-fetching. |
| `forceMount` raro / contenido desmontado | `forceMount` + CSS para SSR-presente | — | El contenido server-rendered queda en HTML aunque colapsado (anclas + no-JS). |

**Deprecated/outdated:**
- Importar Server Components dentro de un Client Component: NO soportado para mantenerlos server (se vuelven cliente). Usar children/props.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El conteo de patrimonio del chip puede ser "N versiones" (label "(6 años)" del UI-SPEC es discreción de presentación, derivable de años distintos de `fecha_presentacion`). | Code Examples / Q2 | Bajo — ambos son honestos; el planner/usuario elige el label. |
| A2 | `forceMount` es la opción correcta para "SSR intacto"; el default unmount también cumpliría "solo el toggle es cliente" pero deja el cuerpo colapsado fuera del HTML inicial. | Pitfall 3 / Q1 | Bajo-medio — afecta no-JS y anclas a carriles colapsados; decisión de planner. |
| A3 | Las tablas `lobby_ingesta_estado` / `probidad_ingesta_estado` siguen NO siendo PII (no en `PII_TABLES`), por lo que `.from()` desde el resumen es guard-safe. | Pitfall 2 | Bajo — verificado contra la lista actual en `lockdown-guard.test.ts`; si se agregan a PII en el futuro, mover a un RPC. |
| A4 | Duplicar la query de conteo (resumen + sección) es aceptable para un sitio read-only; `cache()` la deduplica solo si la sección usara el mismo fetcher (hoy no lo hace). | Don't Hand-Roll / Q3 | Bajo — costo server-side modesto; medible. |
| A5 | El default de apertura (heurística) es discreción de Claude; conservador = colapsar todos salvo el primer carril con datos sustantivos. | User Constraints (Discretion) | Ninguno — explícitamente discrecional. |

## Open Questions

1. **`forceMount` vs unmount por defecto en `Accordion.Content`.**
   - Lo que sabemos: `forceMount` deja el contenido SSR en el HTML (mejor para no-JS y para anclas que aterrizan en un carril colapsado); el default desmonta el cuerpo cuando está cerrado pero el Server Component igual ejecuta en el server.
   - Recomendación: usar `forceMount` + `data-[state=closed]:hidden` para honrar "SSR intacto" literalmente. Planner confirma.

2. **Label del conteo de patrimonio: "(N versiones)" vs "(N años)".**
   - Sabemos: la sección computa `totalVersiones`; el UI-SPEC dibuja "(6 años)".
   - Recomendación: usar el conteo que ya computa la sección (versiones) para fidelidad; "años" es derivable pero es otra métrica. Decisión de presentación del planner/usuario.

3. **Dedupe real de conteos vs duplicación aceptada.**
   - Sabemos: hoy las secciones no comparten un fetcher cacheado; el resumen volvería a llamar el RPC.
   - Recomendación: F45 acepta la doble llamada (server-side, barata) y usa `cache()` de cara a un futuro refactor que comparta fetchers. NO refactorizar las secciones en esta fase (fuera de scope).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | `pnpm add @radix-ui/react-accordion` | ✓ (repo usa pnpm) | — | — |
| `@radix-ui/react-accordion` | Acordeón | ✗ (a instalar) | 1.2.14 | sin fallback — es la dep de la fase |
| Docker Linux | Build OpenNext/Cloudflare de validación | ✓ (patrón establecido) | — | NO usar build Windows (rompe el worker → 500) |
| Supabase (RPCs) | Conteos del resumen + secciones | ✓ (prod, service_role) | — | — |

**Missing dependencies with no fallback:** `@radix-ui/react-accordion` (instalación es parte de la fase).
**Missing dependencies with fallback:** ninguno.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.6 + @testing-library/react 16 (jsdom) |
| Config file | `app/vitest.config.ts` (alias `@`→`app/`, `server-only`→empty.js; jsdom; globals; setup `app/vitest.setup.ts`) |
| Quick run command | `cd app && pnpm test` (`vitest run`) |
| Full suite command | `cd app && pnpm test && pnpm typecheck` (`tsc --noEmit`) |

Nota (memoria): el `pnpm test` de la RAÍZ no corre `app/` — ejecutar dentro de `app/`. Para `tsc -b` usar `references`, no `paths`, o se rompe.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEG-01 | `CarrilAccordion`: `<h2>` presente y visible esté abierto o cerrado; el conteo aparece en el header; el trigger toggla `aria-expanded`/`data-state`; el cuerpo (children) está en el DOM con forceMount | unit (RTL) | `cd app && pnpm test components/carril-accordion.test.tsx` | ❌ Wave 0 |
| LEG-01 | Frontera `mt-12`: cada carril es su propia `<section className="…mt-12…">`; un acordeón por dominio (no dos dominios en un Root) | unit (estructural/grep) | `cd app && pnpm test` (test de estructura de página o assertion sobre el markup de carriles) | ❌ Wave 0 |
| LEG-02 | `ParlamentarioResumen`: un chip por carril PRESENTE; cada chip con `href="#<carril>"`; 3-estado distinto (dato/vacío-honesto/no-ingerido); MONEY OFF → chip honest-state, NUNCA un número | unit (RTL, vista pura con fixtures) | `cd app && pnpm test components/parlamentario-resumen.test.tsx` | ❌ Wave 0 |
| LEG-02 | El chip nunca renderiza densidad falsa para un vacío (no "0 actividad" disfrazado) | unit (RTL, negative-assert sobre copy) | idem | ❌ Wave 0 |
| LEG-03 | Guard de lockdown verde: el árbol público no llama RPC fuera del allowlist ni `.from('<pii>')` (incluye los nuevos módulos) | guard (existente) | `cd app && pnpm test lib/lockdown-guard.test.ts` | ✅ existe |
| LEG-03 | `carril-accordion.tsx` no importa secciones ni `@/lib/supabase` (no-leak SSR) | unit (grep/negative) | `cd app && pnpm test` | ❌ Wave 0 |
| LEG-03 | Tipos limpios | typecheck | `cd app && pnpm typecheck` | ✅ infra |
| LEG-03 | Suite completa verde | regression | `cd app && pnpm test` | ✅ infra |

### Sampling Rate
- **Per task commit:** `cd app && pnpm test <archivo afectado>`
- **Per wave merge:** `cd app && pnpm test && pnpm typecheck`
- **Phase gate:** suite `app/` completa verde + guard verde + `tsc` limpio antes de `/gsd:verify-work`; build OpenNext validado en Docker Linux (checkpoint operador para deploy).

### Wave 0 Gaps
- [ ] `components/carril-accordion.test.tsx` — cubre LEG-01 (header visible, conteo, toggle, forceMount). Considerar `@testing-library/user-event` para el click del trigger; asertar sobre `aria-expanded`/`data-state` (robusto en jsdom) más que sobre mount/unmount.
- [ ] `components/parlamentario-resumen.test.tsx` — cubre LEG-02 (extraer una **vista pura** `ResumenView({chips})` para testear con fixtures sin runtime Supabase, igual que `LobbyView`/`VotosView`).
- [ ] Test estructural de frontera `mt-12` + "un acordeón por dominio" — LEG-01/03. Puede ser un test que importe el markup de carriles o un grep-assert sobre `page.tsx`.
- [ ] (Opcional) `lib/parlamentario-resumen-conteos.test.ts` — mapeo puro conteo→3-estado.
- [ ] Framework install: ninguno (vitest+RTL ya presentes). Solo `pnpm add @radix-ui/react-accordion@1.2.14`.

## Security Domain

> `security_enforcement` no está marcado `false` → incluido. Esta fase es UI; la superficie de seguridad real es el guard de lockdown (Camino A) y PII.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sitio público read-only; sin auth en esta superficie. |
| V3 Session Management | no | — |
| V4 Access Control | yes | Gates server-only (`crucesPublicEnabled`/`moneyPublicEnabled`) envuelven la `<section>` entera; OFF = nodo ausente del HTML. El resumen replica el gate (no lista carriles ausentes). |
| V5 Input Validation | yes | `id` validado por `PARLAMENTARIO_ID_RE` antes de DB (ya existe); el resumen reusa el mismo `id`. |
| V6 Cryptography | no | — |
| V14 Config / Data exposure | yes | `service_role` NUNCA al cliente; el toggle cliente no recibe datos ni keys; conteos server-only; PII (rut/partido) jamás al DOM. |

### Known Threat Patterns for Next.js RSC + Camino A
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server Component arrastrado al bundle cliente (fuga de `service_role`/RPC) | Information Disclosure | Wrapper recibe `children`; NO importa secciones ni `@/lib/supabase`; `import "server-only"` en el módulo de conteos. |
| RPC fuera del allowlist / `.from('parlamentario')` en el resumen | Elevation / Info Disclosure | Solo RPCs en `PUBLIC_RPC_ALLOWLIST`; `lockdown-guard.test.ts` (Block B) verde. |
| PII en el chip (rut, partido, nº familiar) | Information Disclosure | El conteo es un entero/estado; nunca proyecta columnas PII; reusa RPCs PII-safe. |
| Gate bypass (mostrar carril MONEY OFF) | Tampering | El resumen consulta `moneyPublicEnabled(process.env)` igual que la página; OFF → chip honest-state, no número. |

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` (Next 16.2.9 instalado) — §Interleaving Server and Client Components (líneas 178, 297–345): Server Components como `children` no entran al module graph del cliente; render server + RSC payload. `[CITED]`
- `radix-ui.com/primitives/docs/components/accordion` — `Accordion.Header asChild` para nivel de heading; `Accordion.Root type single/multiple` + `collapsible` + `defaultValue` + `value/onValueChange`; `--radix-accordion-content-height`; `prefers-reduced-motion` es responsabilidad del consumidor. `[CITED]`
- npm registry: `@radix-ui/react-accordion@1.2.14` (mod. 2026-06-15), peer `react ^19.0`, sin postinstall. `[VERIFIED: npm view]`
- slopcheck 0.6.1: `@radix-ui/react-accordion` → `[OK]`. `[VERIFIED]`
- Código real leído: `app/app/parlamentario/[id]/page.tsx`, `app/components/{votos-por,lobby-de,patrimonio-de,cruces-de,financiamiento-de}-parlamentario.tsx`, `app/components/parlamentario-header.tsx`, `app/components/{autores-list,search-box,week-nav}.tsx`, `app/lib/{cruces-gate,money-gate,lockdown-guard.test}.ts`, `app/lib/lockdown-guard.test.ts` (PUBLIC_RPC_ALLOWLIST + PII_TABLES), `app/package.json`, `app/vitest.config.ts`, `app/components/lobby-de-parlamentario.test.tsx`, `.planning/REQUIREMENTS.md` (LEG-01..03), DESIGN-SYSTEM.md §3/§7/§8. `[VERIFIED: codebase]`

### Secondary (MEDIUM confidence)
- Patrón shadcn/ui Accordion (Radix + tailwindcss-animate keyframes accordion-up/down) como referencia de estilado — verificar registro de keyframes en Tailwind v4.

### Tertiary (LOW confidence)
- Cifras de descargas semanales de la familia Radix (orden de magnitud, no verificado exacto en sesión).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — una sola dep, verificada en registro + slopcheck + familia ya instalada.
- Architecture: HIGH — patrón confirmado por la doc de Next instalada y por la API de Radix; código real leído.
- Pitfalls: HIGH — derivados de invariantes LOCKED (guard, mt-12, SSR) y comportamiento documentado de Radix Content.
- Validation: HIGH — framework y patrón de tests (vista pura + fixtures) ya establecidos en `app/`.

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stack estable; Radix/Next no cambian semántica en este rango)

## RESEARCH COMPLETE

**Phase:** 45 - LEG Navegación (acordeones por carril + resumen above-fold)
**Confidence:** HIGH

### Key Findings
- Patrón LOCKED y verificado: `CarrilAccordion` `"use client"` (solo el toggle) que recibe los Server Components de sección **como `children`** — confirmado por la doc de Next 16 instalada; el único landmine es que el wrapper NO debe importar las secciones (las importa y pasa la página server).
- Una sola dep nueva: `@radix-ui/react-accordion@1.2.14` (familia Radix ya instalada, React 19 OK, sin postinstall, slopcheck [OK]). `Accordion.Header asChild` → `<h2>` preserva `h1→h2→h3`; un `Accordion.Root` por carril dentro de su `<section className="mt-12">` preserva la frontera anti-insinuación.
- Conteos del resumen: módulo server `contarCarriles(id)` con `React.cache()`, llamando SOLO RPCs ya allowlisted (`votos/lobby/declaraciones/cruces_de_parlamentario`) + `.from()` sobre tablas `*_ingesta_estado` (NO-PII) para el 3-estado. Guard verde, cero número inventado.
- Recomendación `Accordion.Content forceMount` + CSS hide para que el contenido SSR quede en el HTML aunque el carril esté colapsado ("SSR intacto").
- Tests: extraer vistas puras (`ResumenView`) testeables con fixtures como el patrón existente (`LobbyView`/`VotosView`); ejecutar dentro de `app/` (no raíz); validar build en Docker Linux.

### File Created
`.planning/phases/45-leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol/45-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | dep verificada en registro + slopcheck + familia instalada |
| Architecture | HIGH | patrón confirmado por doc Next instalada + API Radix + código real |
| Pitfalls | HIGH | derivados de invariantes LOCKED y comportamiento documentado de Radix |

### Open Questions
- `forceMount` vs unmount default (recomendado forceMount).
- Label de patrimonio "(N versiones)" vs "(N años)".
- Aceptar doble query de conteo vs refactor compartido (recomendado aceptar en F45).

### Ready for Planning
Research completa. El planner puede crear los PLAN.md (instalar dep, crear `carril-accordion.tsx` + `parlamentario-resumen.tsx` + `parlamentario-resumen-conteos.ts`, re-layout de `page.tsx`, tests Wave 0).
