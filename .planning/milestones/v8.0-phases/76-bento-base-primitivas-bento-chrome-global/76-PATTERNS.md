# Phase 76: BENTO-BASE — Primitivas bento + chrome global - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 10 (3 modify, 4 new source, 3 test create/extend)
**Analogs found:** 10 / 10 (all in-repo, VERIFIED)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/app/globals.css` (modify) | config / design-tokens | transform (CSS) | `:root` + `@layer base` existentes en el propio `globals.css` | exact (self) |
| `app/components/bento/bento-grid.tsx` (new) | component (Server) | request-response (pure presentation) | `app/components/global-header.tsx` (hand-rolled SC, no cva) | role-match |
| `app/components/bento/bento-tile.tsx` (new) | component (Server, variants) | request-response (pure presentation) | `app/components/ui/button.tsx` (cva + cn + Slot/asChild) | exact |
| `app/components/global-header.tsx` (modify) | component (Server + client island) | request-response | self (2-line class change) | exact (self) |
| `app/app/layout.tsx` (modify — footer) | config / root layout (Server) | request-response | self (footer `<div>` class change) | exact (self) |
| `app/app/globals.test.ts` (new) | test (source-scan) | file-I/O (readFileSync) | `app/components/global-header.test.ts` | exact |
| `app/components/bento/bento-grid.test.tsx` (new) | test (RTL render) | request-response (jsdom) | `app/components/header-nav.test.tsx` (RTL + render) | role-match |
| `app/components/bento/bento-tile.test.tsx` (new) | test (RTL render) | request-response (jsdom) | `app/components/header-nav.test.tsx` | role-match |
| `app/components/global-header.test.ts` (extend) | test (source-scan) | file-I/O | self | exact (self) |
| `app/app/layout.test.tsx` (extend) | test (source-scan) | file-I/O | self | exact (self) |

## Pattern Assignments

### `app/components/bento/bento-tile.tsx` (component, cva variants)

**Analog:** `app/components/ui/button.tsx` (VERIFIED, whole file 63 lines) — EL patrón de variants del repo. Espejo verbatim: imports, `cva(base, { variants, defaultVariants })`, `VariantProps`, `forwardRef`, `Slot`/`asChild`, `cn()` merge, `displayName`, named export of both component and `*Variants`.

**Imports pattern** (button.tsx lines 1-5):
```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
```

**cva variants pattern** (button.tsx lines 12-40 — copy the SHAPE, swap tokens):
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md ... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ...",
  {
    variants: {
      variant: { default: "bg-primary text-primary-foreground ...", /* … */ },
      size:    { default: "h-10 px-4 py-2", /* … */ },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```
For `BentoTile` (per RESEARCH Pattern 1) the base becomes `rounded-[--radius-tile] transition-colors`; `variant.default = "bg-card border border-border"`, `variant.accent = "bg-accent-product text-primary-foreground"`; add `span: { 2: "md:col-span-2", 4: "md:col-span-4", 6: "md:col-span-6" }`; `defaultVariants: { variant: "default", span: 2 }`. If tile is interactive, keep `focus-visible:ring-2 focus-visible:ring-ring` + `min-h-11` from the button base (SC2 test asserts these).

**forwardRef + asChild/Slot pattern** (button.tsx lines 42-60):
```typescript
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```
`BentoTile` uses the same `asChild`/Slot polymorphism (RESEARCH Open Question 2 → asChild is the repo pattern, lets tile wrap a `<Link>` full-card). Base element is `<div>` not `<button>` — use `React.HTMLAttributes<HTMLDivElement>` and `forwardRef<HTMLDivElement>`. Export `{ BentoTile, bentoTileVariants }`.

**cn() merge** — always `cn(bentoTileVariants({ variant, span, className }))`, never `[...].join(" ")` (RESEARCH Anti-Pattern). `cn` source (`app/lib/utils.ts`): `twMerge(clsx(inputs))`.

---

### `app/components/bento/bento-grid.tsx` (component, no variants)

**Analog:** `app/components/global-header.tsx` (VERIFIED) — a hand-rolled Server Component with a single wrapper `<div>` and `{children}`. No cva needed (no discrete variants; RESEARCH Pattern 2).

**Structure** (mirror the GlobalHeader wrapper-div idiom):
```typescript
// Server Component, no "use client". Single wrapper div + {children}.
export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-[14px] md:grid-cols-6 [grid-auto-rows:minmax(0,auto)]", className)}>
      {children}
    </div>
  );
}
```
`gap-[14px]` is an intentional off-step arbitrary value — do NOT round to `gap-4`/`gap-3` (RESEARCH Anti-Pattern, UI-SPEC §Spacing). `[grid-auto-rows:minmax(0,auto)]` arbitrary is intentional. Colapso ≤md = `grid-cols-1` default, `md:grid-cols-6` above; children flow in DOM order = visual order (no CSS reorder).

---

### `app/components/global-header.tsx` (modify — 2 lines only)

**Analog:** self (VERIFIED, 47 lines). Only 2 class strings change; everything else (BrandIcon, `HeaderNav showRed={netPublicEnabled(process.env)}`, gov-map text, Link home) stays byte-identical.

**Current (line 33) `<header>`:**
```typescript
<header className="border-b border-border bg-background">
```
**Target:** add `sticky top-0 z-40` (RESEARCH §GlobalHeader):
```typescript
<header className="sticky top-0 z-40 border-b border-border bg-background">
```

**Current (line 34) inner container `<div>`:**
```typescript
<div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:px-8">
```
**Target:** `max-w-5xl` → `max-w-[1120px]` (padding may go to `px-6 py-3` per RESEARCH §GlobalHeader — Claude discretion, keep `min-h-14`):
```typescript
<div className="mx-auto flex min-h-14 max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
```
**Preserve:** the `netPublicEnabled(process.env)` gate read (line 30) and `<HeaderNav showRed={showRed} />` (line 43) — invariante 3, untouched.

---

### `app/app/layout.tsx` (modify — footer `<div>` only)

**Analog:** self (VERIFIED lines 41-77). Edit ONLY the `<footer>`/inner `<div>` class strings; ALL copy strings (CC BY 4.0, trust line, license paragraph, nav links) are LOCKED byte-identical (Pitfall 2). Do NOT wrap `{children}` in `<main>` (Pitfall 4 — every page has its own `<main>`).

**Current (line 49-50):**
```typescript
<footer className="mt-16 border-t bg-muted/40">
  <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 text-sm text-muted-foreground">
```
**Target:** quitar `bg-muted/40`; `max-w-3xl` → `max-w-[1120px]` (RESEARCH §State-of-the-Art; keep `mt-16` — fix the discretion choice `mt-16` per RESEARCH Discretion note):
```typescript
<footer className="mt-16 border-t">
  <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 text-sm text-muted-foreground">
```
Everything from `<p className="leading-relaxed">` (line 51) through `</footer>` stays byte-identical.

---

### `app/app/globals.css` (modify — add tokens + scroll-mt)

**Analog:** self — `:root` block (VERIFIED lines 9-31) and `@layer base` block (lines 75-87).

**Radius tokens** — append inside `:root`, AFTER line 30 `--radius: 0.5rem;` (do NOT touch `--radius`; D4). Add comment documenting mockup→token map (RESEARCH Code Examples):
```css
:root {
  /* … existing tokens … */
  --radius: 0.5rem;         /* shadcn — INTACTO (D4) */
  --radius-tile: 16px;      /* esquina de tile bento (v8, D4) */
  --radius-control: 11px;   /* input/botón bento; off-step, mockup-exact (cf .net-chip 11px DEBT-05) */
}
```

**scroll-margin-top global** — add a rule inside the existing `@layer base` block (lines 75-87), alongside the `*` and `body` rules already there:
```css
@layer base {
  /* … existing * and body rules … */
  :where(h1, h2, h3)[id] {
    scroll-margin-top: 5rem; /* 80px — sticky header ocluye anchors, riesgo #2 */
  }
}
```
Open Question 1: fichas use `scroll-mt-6` on `<section id>`. Apply the global generously (`:where([id])` on headings/sections) so the anchor target clears the sticky header; do NOT touch ficha files (out of scope 76).

---

### `app/app/globals.test.ts` (new — source-scan)

**Analog:** `app/components/global-header.test.ts` (VERIFIED, whole file 53 lines) — the source-scan idiom.

**Full idiom to copy** (global-header.test.ts lines 14-33):
```typescript
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd(); // app/
const GLOBALS_CSS = path.join(APP_ROOT, "app", "globals.css");

function stripComments(content: string): string {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.search(/(?<!:)\/\//);
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

const SRC = stripComments(readFileSync(GLOBALS_CSS, "utf8"));
```
CRITICAL: use `process.cwd()` + `path.join`, NEVER `new URL(import.meta.url)` (Pitfall 3, lesson 45-01 — breaks on OneDrive/jsdom).
Note: `stripComments` removes CSS `/* … */` blocks, so assert the TOKEN LINES (`--radius-tile: 16px`, `--radius-control: 11px`, `--radius: 0.5rem` intact, `scroll-margin-top`) which survive stripping — do NOT assert the mapa-mockup comment text (it gets stripped). SC1/SC3 asserts: `expect(SRC).toContain("--radius-tile: 16px")`, `--radius-control: 11px`, `--radius: 0.5rem` (intact), `scroll-margin-top`.

---

### `app/components/bento/bento-grid.test.tsx` + `bento-tile.test.tsx` (new — RTL)

**Analog:** `app/components/header-nav.test.tsx` (RTL render + `@testing-library/react`, jsdom). Assert CLASSES/props/DOM-order only, never geometry (Pitfall 5 — jsdom doesn't compute grid).

RTL asserts (SC2):
- grid: `toHaveClass("md:grid-cols-6")`, `toHaveClass("gap-[14px]")`; children present in DOM order.
- tile default: `bg-card` + `border-border` + `rounded-[--radius-tile]`; accent: `bg-accent-product`; `span={4}` → `md:col-span-4`; interactive tile → `focus-visible` + `min-h-11`.
- soft check: source contains no `#` hex literal (candado formal is Phase 80 — soft here).

---

### `app/components/global-header.test.ts` (extend) & `app/app/layout.test.tsx` (extend)

**Analog:** self. Both already use the `process.cwd()` + `stripComments` source-scan idiom (VERIFIED). ADD assertions to the existing `describe` blocks:
- global-header.test.ts (SC3): `expect(SRC).toMatch(/sticky/)`, `/top-0/`, `expect(SRC).toContain("max-w-[1120px]")`. Existing brand/nav tests stay.
- layout.test.tsx (SC4/SC5): `expect(LAYOUT_SRC).not.toMatch(/bg-muted\/40/)`, `.toContain("max-w-[1120px]")`, assert full LOCKED strings (CC BY paragraph, trust line), and NO `<main>` around `{children}` (`expect(LAYOUT_SRC).not.toMatch(/<main/)`). Existing Tests 1-5 stay green.

## Shared Patterns

### cva + cn variants
**Source:** `app/components/ui/button.tsx` (lines 1-5 imports, 12-40 cva, 48-58 forwardRef+Slot), `app/lib/utils.ts` (`cn = twMerge(clsx(...))`)
**Apply to:** `bento-tile.tsx` (verbatim shape). Never `[...].join(" ")` for variants.

### Source-scan test idiom (Server Components)
**Source:** `app/components/global-header.test.ts` (lines 14-33), `app/app/layout.test.tsx` (lines 17-42)
**Apply to:** `globals.test.ts` (new), and the extensions of `global-header.test.ts` + `layout.test.tsx`.
```typescript
const APP_ROOT = process.cwd();          // NEVER import.meta.url (lesson 45-01, OneDrive)
const SRC = stripComments(readFileSync(path.join(APP_ROOT, ...), "utf8"));
```
`stripComments` strips `/* */` and `//` (but preserves `://` in URLs). Assert only lines that survive stripping.

### Token-only color (zero new hex)
**Source:** `app/app/globals.css` `:root` (lines 9-31) — the mockup palette IS the current tokens (`--accent-product: 183 38% 26%` = `#2A5859`, `--background: 40 33% 97%` = `#F9F6F0`, `--card: 40 30% 99%`, `--border: 40 16% 86%`).
**Apply to:** all `components/bento/*` — reference `bg-card`, `border-border`, `bg-accent-product`, `text-muted-foreground`. No hex literals (D-decision; formal candado is Phase 80).

### Server Component + client island split (chrome)
**Source:** `app/components/global-header.tsx` (Server Component; `HeaderNav` is the only `"use client"`, reads `usePathname`). `netPublicEnabled(process.env)` read server-side.
**Apply to:** header edits preserve this split untouched (invariante 3). `bento-*` are Server Components (no `"use client"`).

## No Analog Found

None. Every file to be created or modified has a strong in-repo analog (VERIFIED). All patterns are composition of existing repo idioms.

## Metadata

**Analog search scope:** `app/components/` (button.tsx, global-header.tsx, header-nav.tsx), `app/components/ui/`, `app/app/` (layout.tsx, globals.css, layout.test.tsx), `app/lib/utils.ts`, test files (`*.test.ts`/`*.test.tsx`).
**Files scanned:** button.tsx, global-header.tsx, global-header.test.ts, layout.tsx, layout.test.tsx, globals.css (:root + @layer base), utils.ts; bento/ dir confirmed absent (new).
**Pattern extraction date:** 2026-07-15
