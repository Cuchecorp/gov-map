# Phase 80: BENTO-GUARDS — Responsive + a11y + dark + candados de régimen - Research

**Researched:** 2026-07-15
**Domain:** Frontend hardening (responsive collapse, WCAG a11y, dark theme, source-scan régimen guards con mutation self-check)
**Confidence:** HIGH (codebase-verified; 100% de los hallazgos se leyeron del repo real)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Responsive**
- ≤`md`: 1 columna, orden DOM = orden visual = hero → cómo-leer → entradas(×3) → votado → urgencias → frescura (ya es el orden DOM actual de `app/app/page.tsx` — verificar y testear).
- `sm`-`lg` intermedio 2 col solo si el diseño lo aguanta (discreción — si complica, saltar documentado).
- Sticky header en móvil: verificación visual va en Phase 81 (BrowserOS 390px sobre deploy); en 80 se asegura por código/test que no hay overflow-x ni clases que rompan el sticky.

**A11y**
- focus-visible ring en todos los tiles-link (BentoTile asChild → el ring vive en las clases del tile, ya existe en la primitiva — verificar cobertura en los 3 tipos de tile-link).
- Contraste AA tile accent: ya resuelto por tokens 77 (`--accent-product-foreground` 7:1, fill pinned) — añadir test de estructura que fije el par de clases.
- aria-label en el form de búsqueda (SearchBox); un solo `<main>` por página; secciones del bento con heading.

**Dark**
- BentoTile default: `bg-card`/`border-border` ya tienen par dark → verificar. Accent: fill pinned `--bento-accent-fill` (idéntico en ambos temas, decisión 77) + foreground token — test de estructura que fije que las clases usan tokens theme-aware (no valores light hardcodeados).

**Candados (mutation self-check patrón linter existente)**
- Cero-hex: test-fuente regex sobre `app/components/bento/**` que detecta `#[0-9a-fA-F]{3,8}` y FALLA en rojo; self-check con fixture mutado. Considerar también `page.tsx` y `actualidad-module.tsx` (superficies bento) si es barato.
- Guard tipográfico extendido a tiles: solo tokens/escala TW (sin px arbitrarios fuera de los sancionados: 11px chip, 52px input, 3px barra, 14px gap, 18px strip py, 22px gap-x).
- Anti-insinuación: evaluar añadir `app/app/page.tsx` (tile cómo-leer) al scope del linter — el copy del tile roza la lectura de datos (fórmula /sobre); si el linter es lista-dura de superficies, añadir la home y verificar verde.
- BrandIcon default #2A5859 (deuda 77-UI-REVIEW): cambiar default a `currentColor` o excluir explícitamente del candado con comentario — resolver en esta fase.

### Claude's Discretion
- Detalles de implementación de los guards (archivo único vs varios), fixtures de mutación, breakpoint intermedio.

### Deferred Ideas (OUT OF SCOPE)
- Verificación visual móvil real (390px) y dark visual → Phase 81 BrowserOS.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENTO-05 | El bento es responsive (colapso ≤md a 1 columna con orden definido), accesible (focus-visible, contraste AA en tile acento, 44px touch targets, landmarks) y tiene par dark derivado de los tokens dark existentes. | §Responsive State, §A11y State, §Dark State — el colapso, focus-visible, min-h-11 y los tokens accent AA YA existen en la primitiva; el gap real es (a) test que FIJE el colapso/orden/landmarks, (b) `aria-label` en el form, (c) barra cívica 3px que NO es theme-aware en dark. |
| BENTO-06 | Candados de régimen verdes y mordiendo (mutation self-check): cero-hex-hardcodeado en componentes bento, guard tipográfico extendido a tiles, linter anti-insinuación cubre el copy nuevo de home si roza votos/dinero. | §Pattern 1 (mutation self-check), §Don't Hand-Roll, §Sanctioned px Values, §Anti-insinuación scope — el molde EXACTO de los 3 guards ya existe (`anti-insinuacion-guard.test.ts`, `bento-coherencia-guard.test.ts`, DEBT-05 en `red-graph.test.tsx`). |
</phase_requirements>

## Summary

Esta fase es **100% hardening y candados sobre código que YA existe** — cero net-new de features. El bento (grid 6-col colapsable, tiles con variants, tokens dark, focus-visible, touch targets) fue construido en 76-78. La fase 80 (a) **fija con tests** lo que hoy funciona pero no está protegido contra regresión, (b) cierra ~4 gaps reales concretos, y (c) monta 3 guards source-scan con mutation self-check copiando moldes ya presentes en el repo.

Los **gaps reales** (no todo lo listado en CONTEXT es un gap — mucho ya está hecho): (1) el form de SearchBox tiene `role="search"` pero **NO** `aria-label`; (2) la barra cívica 3px usa `bg-[var(--camara)]`/`bg-[var(--senado)]`, tokens que **NO tienen par `.dark`** en civic-tokens.css → el único elemento bento no theme-aware; (3) no existe un test que FIJE el colapso `md:` + orden DOM ni los landmarks de la home; (4) `BrandIcon` tiene default hex `#2A5859` que el candado cero-hex atraparía (aunque ningún caller lo usa — ambos pasan color explícito).

Los **guards son la parte con más señal**: el repo tiene tres moldes probados de "guard-como-test con mutation self-check" (`anti-insinuacion-guard.test.ts` con detector puro + fixture en memoria; `bento-coherencia-guard.test.ts` con detector puro por ejes; DEBT-05 en `red-graph.test.tsx` con región-scan de `font-size`). El guard tipográfico de tiles NO puede reusar DEBT-05 tal cual: DEBT-05 escanea `font-size:` en CSS `.net-*`, pero los tiles expresan tamaño con **arbitrary values de Tailwind en TSX** (`text-[11px]`, `text-[13px]`, `text-[15px]`), no CSS. Hay que scan-ear los `.tsx` por `text-[Npx]`/`px-[…]`/`gap-[…]` y whitelistear los 8 valores sancionados enumerados abajo.

**Primary recommendation:** Un archivo de guards nuevo (`app/lib/bento-guards.test.ts`) con 3 describe-blocks (cero-hex, tipografía-arbitraria, colapso/orden estructural), cada uno con detector puro + fixture mutado en memoria — molde verbatim de `bento-coherencia-guard.test.ts`. El guard anti-insinuación: **añadir `app/page.tsx` al array `SUPERFICIES_VOTO`/una nueva `SUPERFICIES_HOME`** en el linter existente (es lista-dura) y verificar verde contra el copy actual (que ya pasa — el copy del tile cómo-leer es la fórmula /sobre, no el mockup). Resolver BrandIcon default → `currentColor`. Cerrar los 3 gaps a11y/dark con edits mínimos.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Responsive collapse (grid → 1 col ≤md) | Browser / Client (CSS grid) | — | Es CSS puro (`grid-cols-1 md:grid-cols-6` + `md:col-span-N` sin base span). jsdom NO ve layout → el test fija CLASES, no píxeles. |
| focus-visible ring en tiles-link | Browser / Client (CSS `:focus-visible`) | — | Vive en las clases cva de `BentoTile`. El test verifica presencia de clase, no comportamiento de foco. |
| Contraste AA tile accent | Design tokens (globals.css) | Browser render | Resuelto en 77: `--accent-product-foreground` + `--bento-accent-fill` pinned idénticos en :root/.dark. El test fija el PAR de clases; el ratio real es verificación humana (Phase 81). |
| aria-label / landmarks | Frontend Server (SSR markup) | — | Server Components renderizan el markup semántico (`<main>`, `<nav aria-label>`, `<h2>`, `role="search"`). Se testean con RTL sobre el render. |
| Dark theme derivación | Design tokens (globals.css `.dark`) | — | Tokens dark existentes; el gap es la barra cívica 3px que referencia tokens sin par dark. |
| Régimen guards (source-scan) | Test infra (vitest) | Build (CI gate GSD verify-work) | Guards son `*.test.ts` que la suite recoge; corren en `pnpm test` y en el gate GSD. NO son CLIs separados. |

## Standard Stack

**Sin instalación nueva.** Toda la fase usa el stack de test ya presente. NO se añade ningún paquete externo → **la sección Package Legitimacy Audit se omite** (cero dependencias nuevas).

### Core (ya instalado, verificado en el repo)
| Library | Rol en Phase 80 | Verificación |
|---------|-----------------|--------------|
| `vitest` | Runner de los guards + tests estructurales (`vitest run`) | [VERIFIED: codebase] `app/vitest.config.ts`, `app/package.json` → `"test": "vitest run"` |
| `@testing-library/react` | Render de home/tiles para asserts de clase/landmark/heading | [VERIFIED: codebase] usado en `bento-tile.test.tsx`, `page.test.tsx` |
| `node:fs` + `node:path` (`readFileSync` + `process.cwd()`) | Source-scan de los guards (leer `.tsx`/`.css` como texto) | [VERIFIED: codebase] idiom exacto en `bento-coherencia-guard.test.ts`, `red-graph.test.tsx`, `layout.test.tsx` |
| `class-variance-authority` + `cn` | Ya en `BentoTile`; los guards leen las clases que produce | [VERIFIED: codebase] `bento-tile.tsx` |

## Architecture Patterns

### System Architecture Diagram

```
                       Phase 80 = candados + fixes sobre lo que 76-78 ya construyeron
                       ────────────────────────────────────────────────────────────

  ┌─ SUPERFICIES BENTO (fuente .tsx/.css) ─────────────────────────────┐
  │  app/app/page.tsx  (home: hero, accent tile, 3 entry, 3 actualidad) │
  │  components/actualidad-module.tsx  (votado/urgencias/frescura)       │
  │  components/bento/{bento-grid,bento-tile}.tsx  (primitivas)          │
  │  components/search-box.tsx  (form role=search)                       │
  │  components/brand-icon.tsx  (default hex #2A5859 ← gap)              │
  │  app/globals.css  (tokens :root + .dark)                            │
  └──────────────┬──────────────────────────────────┬──────────────────┘
                 │ (A) source-scan                   │ (B) RTL render
                 ▼                                    ▼
  ┌─ GUARDS source-scan (NUEVO, molde repo) ─┐   ┌─ TESTS estructura a11y/dark/responsive ─┐
  │  readFileSync + process.cwd()            │   │  render() → toHaveClass / getByRole      │
  │  1. cero-hex regex #[0-9a-fA-F]{3,8}     │   │  - md:col-span-N presente, sin base span │
  │  2. tipografía text-[Npx] whitelist 8    │   │  - focus-visible:ring-2 + min-h-11       │
  │  3. anti-insinuación (extender lista)    │   │  - <main> único; <nav aria-label>; <h2>  │
  │  cada uno: detector puro +               │   │  - form role=search + aria-label (GAP)   │
  │  fixture MUTADO en memoria (muerde)      │   │  - accent classes theme-aware (par fijo) │
  └──────────────┬───────────────────────────┘   └──────────────┬───────────────────────────┘
                 │                                                │
                 ▼                                                ▼
        ┌────────────────────────────────────────────────────────────────┐
        │  pnpm test (root → pnpm --filter ./app test)  +  GSD verify-work │
        │  suite base 885 app + 1103 packages → cierra en 885+nuevos verde │
        └────────────────────────────────────────────────────────────────┘

  NO cubierto por jsdom (→ Phase 81 BrowserOS deploy real, getComputedStyle):
    píxel real del colapso, contraste AA medido, dark visual, sticky en 390px.
```

### Recommended Project Structure (archivos tocados / creados)
```
app/
├── lib/
│   └── bento-guards.test.ts        # NUEVO — 3 guards (hex, tipografía, ¿colapso?) con mutation self-check
├── lib/
│   └── anti-insinuacion-guard.test.ts  # EDIT — añadir home al scope (nueva const SUPERFICIES_HOME)
├── app/
│   └── page.tsx                    # EDIT mínimo — asegurar <main> único (ya está), heading por sección actualidad (ya está)
├── app/
│   └── page.test.tsx               # EDIT — añadir asserts de colapso/orden/landmark/dark si no van al guard
├── components/
│   ├── search-box.tsx              # EDIT — aria-label en <form> (GAP a11y)
│   ├── brand-icon.tsx              # EDIT — default color → currentColor (GAP candado)
│   └── actualidad-module.tsx       # EDIT — barra cívica 3px theme-aware en dark (GAP dark)
└── app/globals.css                 # posible EDIT — par .dark para tokens de barra si se elige tokenizar
```

### Pattern 1: Guard-como-test con detector puro + mutation self-check (EL patrón central de BENTO-06)

**What:** Un `*.test.ts` que (1) lee fuente con `readFileSync`+`process.cwd()`, (2) corre un **detector puro** (función que opera sobre strings, testeable sin disco), (3) verifica VERDE sobre archivos reales, y (4) prueba con un **fixture MUTADO en memoria** que el detector SÍ muerde (no es un no-op verde).

**When to use:** Los 3 guards de BENTO-06. Es el invariante duro de la fase ("los 3 guards nuevos deben FALLAR en rojo si se violan").

**Example (molde verbatim de `bento-coherencia-guard.test.ts`, VERIFIED: codebase):**
```typescript
// Source: app/lib/bento-coherencia-guard.test.ts (Phase 79, mismo repo)
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd(); // app/  (vitest corre desde app/)

// Detector PURO — opera sobre strings en memoria, testeable sin disco.
function detectarHexHardcodeado(contenido: string): string[] {
  // Strip de comentarios ANTES del match (evita falsos positivos en JSDoc).
  // Reusar stripTsComments verbatim de anti-insinuacion-guard.test.ts.
  const hits = contenido.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  return hits;
}

describe("(A) Guard cero-hex — archivos reales bento: 0 offenders", () => {
  it("bento-tile.tsx no tiene literal hex", () => {
    const src = readFileSync(path.join(APP_ROOT, "components/bento/bento-tile.tsx"), "utf8");
    expect(detectarHexHardcodeado(strip(src))).toHaveLength(0);
  });
});

describe("(B) Mutation self-check — el detector muerde", () => {
  it("fixture con #2A5859 inyectado → detecta", () => {
    const mutado = `const c = "#2A5859";`;
    expect(detectarHexHardcodeado(mutado)).toContain("#2A5859");
  });
  it("archivo limpio → 0 offenders", () => {
    expect(detectarHexHardcodeado(`className="bg-card"`)).toHaveLength(0);
  });
});
```

**Detalle crítico heredado del molde (WR-05, gotcha del repo):** `stripTsComments` NO debe tratar `://` como comentario (URLs en string literals). Reusar la función verbatim de `anti-insinuacion-guard.test.ts` líneas 69-81 — si no, un hex dentro de un comentario JSDoc (p.ej. el propio `#2A5859` documentado en `brand-icon.tsx` línea 8) daría falso positivo, o una URL truncaría la línea y crearía falso negativo.

### Pattern 2: Guard tipográfico de arbitrary-values TSX (NO reusable de DEBT-05 directo)

**What:** DEBT-05 (`red-graph.test.tsx`) escanea `font-size:\s*([^;]+);` en la región `.net-*` de `globals.css` y whitelistea `var(--text-*)` + el off-step `0.6875rem`. **Los tiles NO usan CSS `font-size`** — usan **arbitrary values de Tailwind en TSX** (`text-[11px]`). Hay que adaptar el idiom: scan-ear los `.tsx` de bento por el patrón `(text|gap|gap-x|gap-y|px|py|w|h)-\[[^\]]+\]` y whitelistear los valores sancionados.

**When to use:** El guard tipográfico de BENTO-06.

**Sanctioned px values (VERIFIED: codebase — enumeración exacta de las superficies bento):**
| Valor arbitrario | Ubicación | Justificación (off-step intencional) |
|------------------|-----------|--------------------------------------|
| `text-[11px]` | `page.tsx:93` (kicker), `actualidad-module.tsx:309` (chip urgencia) | sub-caption/chip mono; 12px agrandaría |
| `text-[13px]` (×6) | `actualidad-module.tsx` (desenlace, ver fuente, strip frescura, ×3) | body compacto entre 12/14 |
| `text-[15px]` | `actualidad-module.tsx:178` (título votado) | escala entre text-sm/text-base |
| `tracking-[0.08em]` | `page.tsx:93` (kicker) | letter-spacing mono uppercase |
| `gap-[14px]` | `bento-grid.tsx:25`, `actualidad-module.tsx:164` | gap del grid mockup-exact (ya guardado por `bento-grid.test.tsx`) |
| `gap-x-[22px]` | `actualidad-module.tsx:439` (strip frescura) | espaciado horizontal del strip |
| `px-[9px]` | `actualidad-module.tsx:309` (chip urgencia) | padding pill |
| `py-[18px]` | `actualidad-module.tsx:439` (strip frescura) | padding vertical del strip |
| `w-[3px]` | `actualidad-module.tsx:170` (barra cívica) | ancho de la barra 3px |
| `rounded-[2px]` | `actualidad-module.tsx:170` (barra cívica) | radio de la barra |
| `h-[52px]` | `search-box.tsx:118,128` (input/botón hero) | altura input mockup-exact |
| `w-[1120px]`/`max-w-[1120px]` | `page.tsx:87`, `layout.tsx` | contenedor bento (ya guardado en `layout.test.tsx`) |
| `rounded-[var(--radius-tile)]` | `bento-tile.tsx` | token — NO es literal px, se permite |
| `rounded-[var(--radius-control)]` | `search-box.tsx` | token — NO es literal px, se permite |

**Regla del whitelist:** permitir `[var(--…)]` (tokens) siempre; permitir la lista dura de px de arriba; FALLAR ante cualquier OTRO `text-[Npx]`/`gap-[Npx]`/etc no enumerado. Documentar cada uno con su razón (como DEBT-05 documenta el `0.6875rem`). **Este es el candado que evita que un ejecutor futuro meta `text-[17px]` ad-hoc.**

### Pattern 3: Extensión de lista-dura del linter anti-insinuación

**What:** `anti-insinuacion-guard.test.ts` es una **lista dura de superficies** (`SUPERFICIES_VOTO`, `SUPERFICIES_MONEY` — arrays de rutas). Para cubrir el copy nuevo de home, se añade una tercera const `SUPERFICIES_HOME = ["app/page.tsx", "components/actualidad-module.tsx"]` (o se agregan al bucle `[...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME]`).

**When to use:** El sub-requisito anti-insinuación de BENTO-06.

**VERIFICACIÓN CLAVE (el copy actual YA pasa):** El copy del tile "¿Cómo leer esto?" en `page.tsx` es la fórmula /sobre ("Cada dato lleva su fuente… nunca se inventa"), NO el mockup de correlaciones. Los 201 términos prohibidos son vocabulario de juicio/causalidad (rebeldía/disciplina/score/financió/a cambio de/corrupción…). El copy de home no contiene ninguno → **añadir la home al scope debe quedar VERDE inmediatamente**. El `page.test.tsx` ya tiene un `BANNED_VOCAB` regex propio (líneas 161-162) que baneó "correlaci|irregularidad" — complementario, no duplicado.

**Términos a re-verificar contra el copy de home (los 201, pero los candidatos de riesgo):** ninguno del copy actual roza — pero el guard es preventivo para copy FUTURO. Confidence HIGH de que verde al montarlo.

### Anti-Patterns to Avoid
- **Aserción de layout con jsdom:** `getComputedStyle`/`getBoundingClientRect` devuelven 0 en jsdom (Pitfall 5, lección v6.1). El test fija CLASES (`toHaveClass("md:col-span-4")`), NUNCA píxeles. El píxel real es Phase 81.
- **`new URL(import.meta.url)` + `readFileSync`:** rompe bajo jsdom sobre OneDrive (lección 45-01, documentada en `layout.test.tsx` y `red-graph.test.tsx`). SIEMPRE `process.cwd()` + `path.join`.
- **Guard sin mutation self-check:** un guard verde vacío es un no-op (T-68-02 tampering). Cada guard DEBE tener el fixture mutado que demuestra que muerde.
- **Redondear off-step a paso TW:** los px del mockup son intencionales; redondear `text-[11px]`→`text-xs` cambia el diseño. El guard PROTEGE los off-step, no los prohíbe.
- **Regex hex sin strip de comentarios:** cazaría el `#2A5859` documentado en el JSDoc de `brand-icon.tsx` como falso positivo.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Guard-como-test con mutation self-check | Un CLI `tsx`/`node` separado, o un guard sin self-check | Molde de `bento-coherencia-guard.test.ts` (detector puro + fixture memoria) | No hay CI que corra CLIs sueltos; el idiom `*.test.ts` lo recoge `pnpm test` + gate GSD. El self-check es obligatorio (invariante de la fase). |
| Strip de comentarios para source-scan | Un regex ingenuo `//.*` | `stripTsComments` verbatim de `anti-insinuacion-guard.test.ts` (skip `://`) | El ingenuo trunca URLs (falso negativo) y no cubre bloques `/* */`. |
| Colapso responsive del grid | Media queries manuales, JS de resize | `grid-cols-1 md:grid-cols-6` + `md:col-span-N` sin base span (ya en `BentoGrid`/`BentoTile`) | Ya construido y testeado en 76. El colapso es automático (sin base span = full-width en móvil). |
| focus-visible ring | Estilos de foco custom por tile | Clases cva de `BentoTile` (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`) | Ya en la primitiva; asChild propaga al `<a>`/`<Link>`. Verificado en `bento-tile.test.tsx`. |
| Contraste AA del accent | Recalcular ratios, nuevos tokens | `--accent-product-foreground` + `--bento-accent-fill` (77, pinned idénticos en :root/.dark) | Resuelto en 77 con el fix del mid-teal dark que caía a 3.30:1. |

**Key insight:** El 70% de lo que CONTEXT lista "por hacer" YA está implementado y solo necesita un test que lo FIJE contra regresión. El trabajo neto es: 3 guards nuevos + 4 fixes puntuales + tests estructurales.

## Runtime State Inventory

> N/A — Phase 80 es 100% presentación/tests (guards + a11y/dark/responsive edits). Cero datastores, cero servicios externos, cero OS-state, cero secrets, cero build artifacts renombrados. Verificado: no toca ingesta, RPCs, schema ni env vars. **None — verified by scope (BENTO-05/06 son frontend hardening puro).**

## Common Pitfalls

### Pitfall 1: La barra cívica 3px NO es theme-aware (gap dark REAL)
**What goes wrong:** `actualidad-module.tsx:170-174` usa `bg-[var(--camara)]`/`bg-[var(--senado)]`. En civic-tokens.css, `--camara` (213 94% 38%) y `--senado` (355 65% 38%) **NO tienen override en `.dark`** — solo `--camara-muted`/`--camara-muted-foreground`/`--senado-muted`/`--senado-muted-foreground` sí. La barra mantiene su valor light en dark.
**Why it happens:** El fix de dark de 77 pinned los tokens accent pero no revisó los tokens de barra cívica (introducidos en 78).
**How to avoid:** Dos opciones: (a) verificar que el valor light de la barra tiene contraste aceptable en dark card (222 24% 12%) — puede que sí, ambas son colores saturados; (b) tokenizar con par dark. Recomendado: verificar contraste primero (barato); el diseño usa la barra como provenance de cámara, no como texto, así que el umbral es 3:1 (WCAG 1.4.11 non-text), no 4.5:1. **Es el hallazgo dark más importante — documentar la decisión en el plan.**
**Warning signs:** Barra apenas visible o "chillona" en dark durante el gate visual de Phase 81.

### Pitfall 2: `aria-label` ausente en el form de SearchBox (gap a11y REAL)
**What goes wrong:** `search-box.tsx:90-93` — el `<form>` tiene `role="search"` pero NO `aria-label`. El `<Input>` interno SÍ tiene `aria-label="Buscar proyectos de ley"` (línea 115). Un landmark `search` sin label es ambiguo si hubiera múltiples (no hay hoy, pero es best-practice WCAG).
**Why it happens:** El `role="search"` se añadió por progressive enhancement, no por a11y de landmarks.
**How to avoid:** Añadir `aria-label` al `<form>` (p.ej. "Buscar proyectos de ley"). Edit de una línea. Añadir assert en `page.test.tsx` (`getByRole("search", { name: … })`).
**Warning signs:** Auditoría axe/lighthouse marca "landmark without unique label".

### Pitfall 3: `BrandIcon` default hex atrapado por el candado cero-hex
**What goes wrong:** `brand-icon.tsx:24` tiene `color = "#2A5859"` como default. El guard cero-hex sobre `components/bento/**` NO lo toca (brand-icon vive en `components/`, no `components/bento/`), PERO si el scope se amplía o si se considera BrandIcon una superficie bento, dispara.
**Why it happens:** BrandIcon es pre-bento (Phase 60).
**How to avoid:** CONTEXT pide resolverlo: cambiar default a `currentColor`. **Es SEGURO** — ambos callers pasan color explícito (`page.tsx:128` → `currentColor`; `global-header.tsx:39` → `hsl(var(--accent-product))`). Ningún caller depende del default hex. Verificado por grep de `<BrandIcon`. Alternativa: excluir con comentario, pero `currentColor` es más limpio y elimina la deuda.
**Warning signs:** El candado cero-hex falla si `brand-icon.tsx` entra a su scope con el hex presente.

### Pitfall 4: DEBT-05 no cubre los tiles (falsa sensación de cobertura tipográfica)
**What goes wrong:** Asumir que el guard tipográfico existente (DEBT-05 en `red-graph.test.tsx`) ya cubre los tiles. NO — escanea `font-size:` en CSS `.net-*`. Los tiles usan `text-[Npx]` en TSX. Son mecanismos distintos.
**Why it happens:** CONTEXT dice "guard tipográfico existente" — pero es específico del island `.net-*`.
**How to avoid:** Construir el guard TSX-arbitrary-value nuevo (Pattern 2). No reusar la región-scan de CSS.
**Warning signs:** El guard "verde" no atrapa un `text-[17px]` ad-hoc inyectado en un tile.

### Pitfall 5: jsdom no ve el colapso real (lección v6.1 recurrente)
**What goes wrong:** Querer probar que "en móvil el grid es 1 columna" con `getComputedStyle`. jsdom devuelve 0 para todo.
**How to avoid:** El test verifica que las clases correctas están presentes (`grid-cols-1`, `md:grid-cols-6`, `md:col-span-N` sin base `col-span-N`) y que el orden DOM es el prescrito. El píxel real → Phase 81 BrowserOS deploy real.
**Warning signs:** Un assert de layout que "pasa" pero no probaría una regresión real.

## Code Examples

### Assert de colapso + orden DOM (estructural, jsdom-safe)
```typescript
// Source: patrón de app/components/bento/bento-grid.test.tsx (VERIFIED: codebase)
it("orden DOM = orden visual al colapsar: hero → cómo-leer → 3 entradas → votado → urgencias → frescura", () => {
  render(<Home />);
  // Los tiles-link/section en orden. El colapso lo garantiza la ausencia de base col-span.
  // Verificar que NINGÚN tile tiene `col-span-N` sin prefijo md: (rompería el colapso).
  const tiles = document.querySelectorAll("[class*='col-span']");
  tiles.forEach((t) => {
    expect(t.className).not.toMatch(/(?<!md:)\bcol-span-\d/); // solo md:col-span-N permitido
  });
});
```

### Assert de landmark único `<main>` + heading por sección
```typescript
// Source: patrón de app/app/page.test.tsx (VERIFIED: codebase)
it("home tiene exactamente un <main> (landmark único)", () => {
  const { container } = render(<Home />);
  expect(container.querySelectorAll("main")).toHaveLength(1);
});
// Nota: layout.tsx NO envuelve children en <main> (layout.test.tsx Test 8 lo fija) →
// el único <main> es el de page.tsx línea 85. Cada tile de actualidad tiene su <h2>
// (actualidad-module.tsx: "Votado esta semana"/"Urgencias vigentes" + strip label).
```

### Assert accent tile theme-aware (fija el par de clases)
```typescript
// Source: patrón de app/components/bento/bento-tile.test.tsx (VERIFIED: codebase)
it("accent tile usa tokens theme-aware, no valores light hardcodeados", () => {
  const { container } = render(<BentoTile variant="accent">x</BentoTile>);
  const tile = container.firstElementChild as HTMLElement;
  expect(tile).toHaveClass("bg-bento-accent-fill");          // pinned idéntico :root/.dark
  expect(tile).toHaveClass("text-accent-product-foreground"); // ≥7:1
  expect(tile.className).not.toContain("bg-accent-product");   // NO el que lightens en dark
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Guard tipográfico solo CSS `.net-*` (DEBT-05) | Guard TSX arbitrary-value para tiles | Phase 80 (nuevo) | Cubre `text-[Npx]` en componentes, no solo CSS island |
| Accent tile con `bg-accent-product` (lightens en dark, 3.30:1 FAIL) | `bg-bento-accent-fill` pinned (7:1) | Phase 77 (ya hecho) | Base para el test de estructura de esta fase |
| Home lineal `max-w-3xl` | Bento grid `max-w-[1120px]` con colapso | Phase 76-78 (ya hecho) | El colapso ya existe; Phase 80 lo FIJA |

**Deprecated/outdated:**
- Asumir que "guard tipográfico existente" cubre tiles → es específico de `.net-*` (Pitfall 4).
- Cualquier lectura de fuente con `import.meta.url` → prohibida en este repo (jsdom+OneDrive).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La barra cívica 3px con valor light tiene contraste ≥3:1 sobre card dark (222 24% 12%) sin tokenizar | Pitfall 1 | Bajo — si falla, se tokeniza con par dark (edit de civic-tokens.css); es fix conocido. Verificable en Phase 81 gate visual. |
| A2 | El copy actual de home NO contiene ninguno de los 201 términos prohibidos | Pattern 3 | Muy bajo — el copy es la fórmula /sobre; se verifica montando el guard (verde inmediato) o rojo señala el término exacto. |
| A3 | Suite base actual es 885 app + 1103 packages (de CONTEXT §specifics) | Validation Architecture | Bajo — dato de CONTEXT, no re-contado en esta sesión; el criterio de cierre es "885+nuevos verde", robusto al número exacto. |

**Nota:** A1 y A2 se resuelven DURANTE la ejecución (montar el guard revela la verdad). Ninguno bloquea el plan.

## Open Questions

1. **¿Breakpoint intermedio `sm`-`lg` a 2 columnas?**
   - What we know: CONTEXT lo deja a discreción ("solo si el diseño lo aguanta; si complica, saltar documentado"). El grid actual salta directo 1→6 col en `md`.
   - What's unclear: Si 2-col intermedio mejora la lectura en tablet sin romper spans (los tiles usan span 2/4/6 sobre 6 cols; un grid de 2 cols necesitaría re-mapear spans).
   - Recommendation: **Saltar el intermedio y documentarlo.** Añadir `sm:grid-cols-2` + `sm:col-span-*` re-mapeados es complejidad con spans que no dividen limpio en 2. El colapso 1-col ≤md es honesto y suficiente; el gate visual 390px (Phase 81) valida móvil. Si el operador lo pide en lectura fría, es un quick posterior.

2. **¿Guards en 1 archivo o 3?**
   - What we know: CONTEXT lo deja a discreción.
   - Recommendation: **1 archivo `bento-guards.test.ts` con 3 describe-blocks** (cohesión temática: todos son candados de régimen bento) + extensión IN-PLACE de `anti-insinuacion-guard.test.ts` (no duplicar su detector de 201 términos). Menos archivos, un solo lugar para los candados bento.

3. **¿El guard cero-hex incluye `page.tsx` + `actualidad-module.tsx`?**
   - What we know: CONTEXT dice "considerar también… si es barato".
   - Recommendation: **Sí, incluirlos** — el scan verifica que las superficies bento (no solo la carpeta `components/bento/`) no tengan hex. Barato (una entrada más en el array de rutas). Verificar verde: `actualidad-module.tsx` usa `bg-[var(--camara)]` (token, no hex ✓); `page.tsx` no tiene hex tras resolver BrandIcon.

## Environment Availability

> N/A — Phase 80 no tiene dependencias externas (tools/services/runtimes). Es tests + edits de frontend sobre el stack ya instalado. **SKIPPED (no external dependencies identified).**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (jsdom env) + @testing-library/react |
| Config file | `app/vitest.config.ts` |
| Quick run command | `cd app && pnpm test` (`vitest run`) — o filtrar: `pnpm --filter ./app test` |
| Full suite command | `pnpm test` (root: `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) + `pnpm --filter ./app tsc` (typecheck) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BENTO-05 | Grid colapsa ≤md (clases `grid-cols-1`/`md:grid-cols-6`, spans solo `md:`) | unit/structural | `cd app && pnpm test bento-grid` | ✅ existe (extender orden/colapso home en `page.test.tsx`) |
| BENTO-05 | focus-visible + min-h-11 en tiles-link | unit | `cd app && pnpm test bento-tile` | ✅ existe (`bento-tile.test.tsx` ya cubre) |
| BENTO-05 | accent tile theme-aware (par de clases pinned) | unit/structural | `cd app && pnpm test bento-tile` | ✅ existe (ya cubierto; confirmar) |
| BENTO-05 | `<main>` único + `<nav aria-label>` + `<h2>` por sección | structural | `cd app && pnpm test page.test` | ✅ existe (extender: main único; landmarks ya parciales) |
| BENTO-05 | form `role=search` + `aria-label` | unit | `cd app && pnpm test page.test` | ❌ Wave 0 (añadir aria-label + assert) |
| BENTO-05 | barra cívica 3px theme-aware en dark | structural/manual | `cd app && pnpm test` + Phase 81 visual | ❌ Wave 0 (decisión A1 + posible assert) |
| BENTO-06 | cero-hex en superficies bento + self-check | guard/source-scan | `cd app && pnpm test bento-guards` | ❌ Wave 0 (nuevo `bento-guards.test.ts`) |
| BENTO-06 | tipografía arbitraria whitelisted + self-check | guard/source-scan | `cd app && pnpm test bento-guards` | ❌ Wave 0 (nuevo) |
| BENTO-06 | anti-insinuación cubre home + self-check | guard/source-scan | `cd app && pnpm test anti-insinuacion` | ❌ Wave 0 (extender `SUPERFICIES_HOME`) |

### Sampling Rate
- **Per task commit:** `cd app && pnpm test <archivo-afectado>` (ej. `pnpm test bento-guards`) — < 30s por guard.
- **Per wave merge:** `cd app && pnpm test` (suite app completa, ~885+).
- **Phase gate:** Suite app + packages verde (`pnpm test` root) + `pnpm --filter ./app tsc` verde antes de `/gsd:verify-work`. Criterio de cierre (CONTEXT §specifics): **885 base + nuevos, todos verdes + tsc limpio.**

### Wave 0 Gaps
- [ ] `app/lib/bento-guards.test.ts` — cubre BENTO-06 (cero-hex + tipografía), con detector puro + fixture mutado (molde `bento-coherencia-guard.test.ts`).
- [ ] `app/lib/anti-insinuacion-guard.test.ts` — EDIT: añadir `SUPERFICIES_HOME` (`app/page.tsx`, `components/actualidad-module.tsx`) al bucle de scan; verificar verde + self-check ya existente cubre la mordida.
- [ ] `app/app/page.test.tsx` — EDIT: asserts de `<main>` único, orden DOM de tiles, form `role=search`+`aria-label`.
- [ ] `app/components/search-box.tsx` — EDIT: `aria-label` en `<form>`.
- [ ] `app/components/brand-icon.tsx` — EDIT: default `color` → `currentColor`.
- [ ] `app/components/actualidad-module.tsx` — EDIT (condicional a A1): barra cívica dark-aware si el contraste no basta.
- [ ] Framework install: N/A — vitest ya presente.

*Nota: no hay `conftest`/fixtures compartidos que crear — cada guard trae su fixture en memoria (molde del repo).*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` (verificado en `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth en superficies bento (home es pública, server-only reads). |
| V3 Session Management | no | Sin sesión. |
| V4 Access Control | no (indirecto) | Los gates fail-closed (`NET_/MONEY_/CRUCES_PUBLIC_ENABLED`, `PUBLIC_INDEXABLE`) NO se tocan en 80 — invariante del milestone. No se añade superficie que los eluda. |
| V5 Input Validation | no | Phase 80 no procesa input nuevo (SearchBox ya existe; el `aria-label` es a11y, no validación). El guard de submit vacío en SearchBox ya existe (`navigate` trim+guard). |
| V6 Cryptography | no | Sin cripto. |

### Known Threat Patterns for {frontend estático + guards}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guard-como-no-op verde (tampering del propio guard) | Tampering | Mutation self-check obligatorio (fixture mutado que demuestra la mordida) — patrón del repo, invariante de la fase. |
| Difamación / insinuación editorial en copy | Repudiation / reputational | Extensión del linter anti-insinuación al copy de home (BENTO-06); recordar (JSDoc del linter) que es un TRIPWIRE, no garantía — la garantía real es el sign-off legal humano (Ley 21.719). |
| Gate bypass por nueva superficie | Elevation of Privilege | Invariante del milestone: cero superficie nueva que eluda los gates; Phase 80 no toca gates. Verificable: no se añaden lecturas de datos gated. |
| Fuga PII en frescura | Information Disclosure | `UltimaActualizacion` ya restringe a `FUENTES_FRESCURA` NO-PII (guard T-52-12 existente); Phase 80 no cambia queries. |

**Nota de seguridad:** Phase 80 es net-negativa en superficie de riesgo (añade candados, no features). El único riesgo introducible sería un guard mal construido que dé falsa confianza — mitigado por el mutation self-check obligatorio.

## Sources

### Primary (HIGH confidence — codebase, verificado esta sesión)
- `app/lib/anti-insinuacion-guard.test.ts` — molde del linter (201 términos, 13 superficies, detector puro `detectarInsinuaciones`, `stripTsComments`, mutation self-check Test 2). Lista dura de superficies.
- `app/lib/bento-coherencia-guard.test.ts` (Phase 79) — molde EXACTO de guard con detector puro por ejes + mutation self-check en memoria + `process.cwd()`.
- `app/components/red/red-graph.test.tsx` líneas 637-696 (DEBT-05) — guard tipográfico source-scan de `font-size` en `.net-*` con whitelist off-step; molde a ADAPTAR (CSS→TSX arbitrary values).
- `app/components/bento/bento-tile.tsx` + `.test.tsx` — variants cva, focus-visible/min-h-11, accent theme-aware, source-scan cero-hex "soft".
- `app/components/bento/bento-grid.tsx` + `.test.tsx` — colapso `grid-cols-1 md:grid-cols-6`, gap-[14px], orden DOM.
- `app/app/page.tsx` + `.test.tsx` — composición home, `<main>` único, `<nav aria-label>`, landmarks, BANNED_VOCAB.
- `app/components/actualidad-module.tsx` — tiles votado/urgencias/frescura; barra cívica 3px `bg-[var(--camara/senado)]`; enumeración de px arbitrarios.
- `app/components/search-box.tsx` — form `role="search"` SIN aria-label (gap); Input con aria-label.
- `app/components/brand-icon.tsx` — default hex `#2A5859`; callers pasan color explícito.
- `app/app/globals.css` + `app/app/styles/civic-tokens.css` — tokens :root/.dark; `--accent-product-foreground`/`--bento-accent-fill` pinned; `--accent-product-soft` CON par dark; `--camara`/`--senado` SIN par dark.
- `app/app/layout.tsx` + `.test.tsx` — sin `<main>` global; footer 1120px; sticky header en `global-header.tsx`.
- `app/vitest.config.ts`, `app/package.json`, root `package.json`, `.planning/config.json` — infra de test + flags workflow.

### Secondary (MEDIUM)
- `.planning/MILESTONE-v8-bento.md` (fase 80, invariantes 7/8) — contexto de diseño.
- `.planning/REQUIREMENTS.md` §v8 BENTO-05/06 — texto de requisitos.

### Tertiary (LOW)
- Ninguna — toda la investigación fue codebase-verificada; no se recurrió a WebSearch (fase interna, sin dependencias externas).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero dependencias nuevas; todo verificado en el repo.
- Architecture (guards + tests): HIGH — 3 moldes de guard existen y se leyeron completos; el patrón mutation self-check es reproducible verbatim.
- Pitfalls: HIGH — los 4 gaps (aria-label, barra dark, BrandIcon hex, DEBT-05 no cubre tiles) se confirmaron leyendo el código fuente exacto.
- Sanctioned px values: HIGH — enumeración por grep exhaustivo de las superficies bento.
- Dark contrast de barra cívica (A1): MEDIUM — el valor light-en-dark no se midió (jsdom no computa); requiere Phase 81 o cálculo manual.

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (30 días — código estable; el único invalidador sería que 79 cambiara las primitivas bento, ya en master).
