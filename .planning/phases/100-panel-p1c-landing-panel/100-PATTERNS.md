# Phase 100: PANEL P1c — Landing panel + benchmark + gate BrowserOS - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 6 (2 NEW, 4 MODIFIED)
**Analogs found:** 6 / 6 (all exact or role-match; every new file has a concrete in-repo analog)

> Phase 100 is pure frontend + guard extension. NO new packages, NO migrations, NO on-read aggregation. Every pattern below is copied from an existing, live surface. The RPC (`actualidad_senales_panel`, 0066) is already applied to PROD and already in `PUBLIC_RPC_ALLOWLIST` (line 166) — do NOT touch the lockdown-guard.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/components/panel-actualidad.tsx` (NEW) | component (RSC) | request-response (read RPC → group → render) | `app/components/actualidad-module.tsx` | exact (same role, same fetch+render+empty-state idiom) |
| `app/app/page.tsx` (MODIFIED) | route (RSC page, `/`) | request-response | itself + `actualidad-module.tsx` mount pattern | exact (self-modification, hero LOCKED) |
| suppression-state tile render (NEW, inside `panel-actualidad.tsx`) | component (pure view) | transform (row → honest UI) | `actualidad-module.tsx` empty-state L153-156 / L297-300 | exact |
| tz-Chile agenda dates (inside `panel-actualidad.tsx`) | utility (consumed) | transform | `app/lib/dia-calendario.ts` | exact (date-only-midnight-UTC contract) |
| `app/lib/anti-insinuacion-guard.test.ts` (MODIFIED) | test (guard) | build/CI | its own `SUPERFICIES_*` arrays (L100-282) + scan loop L472 | exact (append array + loop entry) |
| `app/lib/bento-guards.test.ts` (MODIFIED) | test (guard) | build/CI | `SUPERFICIES_CERO_HEX` L69 + `SUPERFICIES_TIPOGRAFIA` L86 | exact (append to two arrays) |

**Server RPC read** and **BentoGrid/BentoTile** are not separate files — they are shared patterns applied inside `panel-actualidad.tsx` and `page.tsx` (see Shared Patterns).

---

## Pattern Assignments

### `app/components/panel-actualidad.tsx` (NEW — component / RSC)

**Analog:** `app/components/actualidad-module.tsx` (the 3 germ tiles Votado/Urgencias/Frescura). This is a RSC-pure module (NO `"use client"`) exporting async server components + pure `*View` components testable with fixtures. Copy that exact split.

**Imports pattern** (verbatim from `actualidad-module.tsx:1-12`):
```typescript
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta } from "@/lib/format";
import { safeExternalHref } from "@/lib/utils";
import { sourceLabel } from "@/lib/types";        // origen → "Cámara"/"Senado"/… (source-label.test.ts)
import { BentoTile } from "@/components/bento/bento-tile";
```
Note: `sourceLabel(origen)` lives in `app/lib/types.ts:755` (NOT a separate file). Use it for the per-tile `Fuente:` footer.

**RPC fetch pattern** (copy the `.rpc(name, params)` + `throw`-on-error idiom from `app/app/contraparte/[id]/page.tsx:104-114`, adapted to `p_tipo`):
```typescript
export async function PanelActualidad() {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("actualidad_senales_panel", { p_tipo: null });
  // #34: error real de lectura ≠ "sin señales". Se lanza (NUNCA `?? []`).
  if (error) {
    throw new Error(`PanelActualidad: no se pudo leer actualidad_senales_panel: ${error.message}`);
  }
  const filas = (data as SenalRow[] | null) ?? [];   // [] SOLO = 0 filas legítimo
  const porTipo = new Map<string, SenalRow[]>();
  for (const f of filas) {
    const arr = porTipo.get(f.tipo_senal);
    if (arr) arr.push(f); else porTipo.set(f.tipo_senal, [f]);
  }
  // … render one BentoTile per tipo_senal group (see View pattern)
}
```

**SenalRow type** (the 9 columns of RPC `0066_actualidad_rpc.sql:32-42`):
```typescript
interface SenalRow {
  tipo_senal: string;          // 'velocity'|'nuevos_ingresos'|'urgencias'|'agenda_citacion'|'agenda_sala'|'archivados'|'agrupacion_materia'
  ventana: string | null;      // '7d' | '30d' | 'futuras' | null
  conteo: number;
  cobertura_camara: string | null;  // 'C.Diputados' | 'Senado' | '(sin cámara)' | '2022-2026 (piso de corpus)' | null
  materia: string | null;      // '(sin materia)' tolerado
  cluster_id: number | null;
  fecha_max: string | null;    // timestamptz ISO
  supresion_causa: string | null;   // NULL = activa; texto = suprimida CON causa
  evidencia: Record<string, unknown>;  // jsonb (deserializado a objeto por supabase-js)
}
```
Note: RPC does NOT return `dataset`/`origen` columns (they exist in the table but the RPC re-emits only the 9 above — see `0066:47-52`). If a per-source label is needed, derive it from `tipo_senal`/`cobertura_camara`, OR the plan may extend the RPC (out of scope; prefer deriving). `dataset`/`origen` are the provenance columns in `0065:64-65`.

**Pure View + empty/suppression pattern** (copy structure from `actualidad-module.tsx:148-231` and empty-state L153-156):
```tsx
export function TileSenal({ tipo, filas }: { tipo: string; filas: SenalRow[] }) {
  return (
    <BentoTile variant="default" span={2} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">{TITULO[tipo]}</h2>
        {filas.map((f, i) => f.supresion_causa ? (
          // SUPRESIÓN: la causa ES el contenido, nunca vacío ni "0" mudo (SEN-03 LOCKED)
          <p key={i} className="text-sm text-muted-foreground">
            {f.supresion_causa}
            {f.fecha_max && <> — en las fuentes consultadas al {fechaCorta(new Date(f.fecha_max))}</>}
          </p>
        ) : (
          // ACTIVA: conteo factual + cobertura declarada + fecha; NUNCA "top/los más"
          <p key={i} className="text-[13px]">
            <span className="font-mono">{f.conteo}</span> {FRAMING[tipo]}
            {f.cobertura_camara && <> · {f.cobertura_camara}</>}
            {f.fecha_max && <span className="font-mono text-xs text-muted-foreground"> · al {fechaCorta(new Date(f.fecha_max))}</span>}
          </p>
        ))}
      </section>
    </BentoTile>
  );
}
```

**Civic provenance bar pattern** (copy verbatim from `actualidad-module.tsx:166-176`) — for per-cámara rows. LOCKED: `bg-[var(--camara)]` / `bg-[var(--senado)]` (v4 form; bare `-[--camara]` FAILS guard III):
```tsx
{it.camara && (
  <span aria-hidden="true"
    className={`w-[3px] self-stretch rounded-[2px] ${
      it.camara === "diputados" ? "bg-[var(--camara)]" : "bg-[var(--senado)]"
    }`} />
)}
```

**Source-link pattern** (copy from `actualidad-module.tsx:205-221`) — `Fuente ↗` (external, `safeExternalHref`) or `Ver proyecto →` (internal `<Link>`), both `text-accent-product underline min-h-11`:
```tsx
const href = safeExternalHref(it.enlace);
{href ? (
  <a href={href} target="_blank" rel="noopener noreferrer"
     className="mt-1 inline-flex min-h-11 items-center text-[13px] underline underline-offset-2 text-accent-product">
    Fuente ↗
  </a>
) : (
  <Link href={`/proyecto/${it.boletin}`}
        className="mt-1 inline-flex min-h-11 items-center text-[13px] underline underline-offset-2 text-accent-product">
    Ver proyecto →
  </Link>
)}
```

**`fechaValida` helper** (copy verbatim from `actualidad-module.tsx:115-119`) — parse ISO → `Date | null`, never "Invalid Date".

**Exact `supresion_causa` string values** (from `0065_actualidad_senal.sql`, render verbatim — do NOT rewrite):
- `"sin datos frescos de esta fuente"` (stale gate — velocity/urgencias/agenda/archivados) — L214, L249, L306
- `"sin urgencias fechadas en la ventana"` — L208
- `"sin citaciones agendadas en las fuentes consultadas"` — L243
- `"sin sesiones agendadas en las fuentes consultadas"` (agenda_sala) — L272
- `"sin movimientos de archivo/retiro fechados en la ventana"` — L300

**`cobertura_camara` literal values** (render verbatim, NEVER rank cross-cámara): `'C.Diputados'`, `'Senado'`, `'(sin cámara)'`, `'2022-2026 (piso de corpus)'` (nuevos_ingresos, `0065:159`).

**Anti-patterns (from `actualidad-module.tsx` reglas A-E, header L24-42):**
- Rule D / #34: real read error → `throw`; NEVER `?? []` that fabricates "sin datos". `[]` is ONLY the legitimate 0-rows path.
- Rule A: civic bar OMITTED when cámara is null (never guess a chamber).
- Rule B: NEUTRAL counts; NEVER "top/los más/la cámara más activa" (T-52-13).
- Rule E: a datum with no traceable source link is not shown standalone.
- Do NOT recompute any aggregation on-read (SEN-02 LOCKED) — the RPC already returns `conteo`/`fecha_max`/`cobertura_camara`.

---

### tz-Chile agenda dates (inside `panel-actualidad.tsx`)

**Analog:** `app/lib/dia-calendario.ts` — `diaCalendarioCitacion`, `badgeFechaCitacion`, `dayLabelCitacion`.

**CRITICAL contract (dia-calendario.ts:1-43, LOCKED):** `citacion.fecha` / `sesion_sala.fecha` (behind `agenda_citacion`/`agenda_sala` signals) are **date-only-midnight-UTC = the Chilean calendar day already**. Use `diaCalendarioCitacion(iso)` (returns the UTC date part). NEVER `Intl` with `timeZone: "America/Santiago"` on these — it fabricates the previous day.

**Contrast:** real timestamps with a clock (`fecha_max` from `tramitacion_evento` for velocity/urgencias/archivados) DO carry a real time — use `fechaCorta(new Date(fecha_max))` (from `format.ts:21`). The distinction is per-signal:
- velocity / urgencias / archivados / nuevos_ingresos → `fecha_max` is a real timestamp → `fechaCorta`.
- agenda_citacion / agenda_sala → `fecha_max` is date-only-midnight-UTC → treat via `dia-calendario.ts` if formatting the day, or `fechaCorta` is acceptable for the footer since it only reads the date (verify no tz shift; prefer `diaCalendarioCitacion` for agenda days).

---

### `app/app/page.tsx` (MODIFIED — route / RSC page `/`)

**Analog:** itself. Self-modification: replace the product-centric BODY (the 3 germ tiles under `<Suspense>`, L172-183) with the panel; keep everything else.

**MUST NOT change:**
- `export const dynamic = "force-dynamic";` (L19) — LOAD-BEARING (Pitfall 5 / gotcha F50). Without it `/` prerenders static → stale/500.
- Hero tile (L90-107): kicker + h1 + SearchBox — copy LOCKED byte-identical (v8.1 D1: operator annulled copy changes). `EXAMPLE_CHIPS` (L48-53) LOCKED.
- Accent "¿Cómo leer esto?" tile → `/sobre` (L112-132) — LOCKED copy.
- The 3 entry tiles `/buscar`, `/parlamentarios`, `/agenda` (`ENTRY_CARDS` L58-81, `<nav className="contents">` L136-170) — LOCKED copy; may move below the panel (Claude's discretion / layout).
- The URL, `section[id]` anchors, and `:where([id]) scroll-margin-top` (gotcha v8.0).
- `max-w-[1120px]` bento container (L87, whitelisted).

**Mount pattern** (copy the `<Suspense fallback={<BloqueSkeleton span={N}/>}>` idiom L174-182; `BloqueSkeleton` is defined at L35-45 — reuse it):
```tsx
<Suspense fallback={<BloqueSkeleton span={4} />}>
  <PanelActualidad />
</Suspense>
```
`BloqueSkeleton` is an honest loading state (asserts no data). Keep it.

---

### `app/lib/anti-insinuacion-guard.test.ts` (MODIFIED — guard / test) — WAVE 0, FIRST commit

**Analog:** its own `SUPERFICIES_*` arrays (the pattern is repeated 8× at L100-282) + the scan loop at L472.

**Step 1 — new array** (mirror the JSDoc + shape of `SUPERFICIES_HOME` L145-148). `SUPERFICIES_HOME` ALREADY covers `app/page.tsx` + `actualidad-module.tsx` (Pitfall 1 — do NOT rename it). Add a NEW array with the NEW panel files:
```typescript
const SUPERFICIES_PANEL: string[] = [
  "components/panel-actualidad.tsx",
  // + any sub-tile components if split out
];
```

**Step 2 — add to scan loop** (L472, append `...SUPERFICIES_PANEL`):
```typescript
for (const rel of [...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME,
                   ...SUPERFICIES_BUSQUEDA, ...SUPERFICIES_PERSONAS, ...SUPERFICIES_LOBBY,
                   ...SUPERFICIES_AGENDA, ...SUPERFICIES_DEEPLINK, ...SUPERFICIES_PANEL]) { … }
```

**Step 3 — new timing-insinuation terms** (append to `TERMINOS_PROHIBIDOS` L293-370; TILDES EXACTAS — `buildTermRegex` is NOT accent-insensitive, L414-419). From UI-SPEC §Copywriting denylist + Pitfall 3:
```typescript
"último momento", "a última hora", "de madrugada", "exprés",
"revivido", "reactivado", "zombie", "resucitó", "colado",
"la cámara más activa",   // ("top"/"los más" — see note)
```
Note: `"top"` and `"los más"` are NOT yet in `TERMINOS_PROHIBIDOS` — verify before assuming; the current list covers `"score"/"ranking"/"índice"/"puntaje"`. Add the exact anti-ranking idioms the copy uses.

**Step 4 — mutation self-check** (mirror the per-carril `it(...)` blocks in describe (2), e.g. the AGENDA one at L609-628). Add a PANEL block proving the detector BITES on an injected timing term:
```typescript
it("PANEL (100): caza timing insinuante inyectado (exprés / de madrugada)", () => {
  const hits = detectarInsinuaciones(`<p>ley exprés aprobada de madrugada</p>`);
  expect(hits).toEqual(expect.arrayContaining(["exprés", "de madrugada"]));
});
```

**Step 5 — NEGACIONES_LOCKED (only if needed)** (L378-400): if the panel renders a locked legend that CONTAINS a prohibited term to NEGATE it, export it as a const from `panel-actualidad.tsx` and add it verbatim BEFORE the surface enters the scan (Pitfall 2, lección BLOCKER 91). The germ copy contains no such negation today — likely NOT needed, but register FIRST if it appears.

`import.meta.dirname` anchoring (L64) is the reason the guard scans real files — do NOT change to `process.cwd()` (v8.1 bug).

---

### `app/lib/bento-guards.test.ts` (MODIFIED — guard / test) — WAVE 0

**Analog:** `SUPERFICIES_CERO_HEX` (L69-75) + `SUPERFICIES_TIPOGRAFIA` (L86-91). Both currently list `app/page.tsx` + `components/actualidad-module.tsx`.

**Add the new panel component to BOTH arrays:**
```typescript
const SUPERFICIES_CERO_HEX: string[] = [
  "components/bento/bento-grid.tsx", "components/bento/bento-tile.tsx",
  "app/page.tsx", "components/actualidad-module.tsx", "components/brand-icon.tsx",
  "components/panel-actualidad.tsx",   // + sub-tiles
];
const SUPERFICIES_TIPOGRAFIA: string[] = [
  "components/bento/bento-grid.tsx", "components/bento/bento-tile.tsx",
  "app/page.tsx", "components/actualidad-module.tsx",
  "components/panel-actualidad.tsx",   // + sub-tiles
];
```

**Guard III (bare-var shorthand, L467-498) already scans ALL `app/components/**`** recursively (excludes `*.test.*`) — the new panel is covered automatically. No action needed for guard III except: use `bg-[var(--camara)]` NEVER `bg-[--camara]`.

**WHITELIST_ARBITRARIOS (L249-263):** the panel reuses only already-whitelisted off-steps (`text-[11px]`, `text-[13px]`, `text-[15px]`, `gap-[14px]`, `gap-x-[22px]`, `px-[9px]`, `py-[18px]`, `w-[3px]`, `rounded-[2px]`, `max-w-[1120px]`). If a genuinely new off-step is needed, add it to the Set WITH a documented reason (pattern DEBT-05) BEFORE writing the class, or guard II fails.

---

## Shared Patterns

### Server RPC read (Camino A, service_role)
**Source:** `app/lib/supabase.ts` (`createServerSupabase`, L34-53) + `app/app/contraparte/[id]/page.tsx:104-114` (`.rpc(name, params)` + throw).
**Apply to:** `panel-actualidad.tsx`.
- `createServerSupabase()` returns a `service_role` client, `import "server-only"` (L1) keeps the key out of the browser bundle.
- service_role BYPASSES RLS → the tree must ONLY read the allowlisted RPC / non-PII tables. `actualidad_senales_panel` is already in `PUBLIC_RPC_ALLOWLIST` (`lockdown-guard.test.ts:166`).
- Error handling: `if (error) throw new Error(...)`; `(data as T[] | null) ?? []`.

### BentoGrid / BentoTile primitives
**Source:** `app/components/bento/bento-tile.tsx` + `bento-grid.tsx`.
**Apply to:** `panel-actualidad.tsx` + `page.tsx`.
- `BentoTile` variants: `default` (`bg-card border border-border hover:border-accent-product`) / `accent`; spans `2 | 4 | 6` ONLY (L32-36) — do NOT add new span values to `bentoTileVariants`. For a 3-span visual, pair `span={2}` + sibling or promote to `span={6}` (UI-SPEC §Panel Layout note).
- `asChild` (Slot) makes the tile a full-card `<Link>` / `<section>` without duplicating focus/min-h.
- `BentoGrid` (L21-32): `grid-cols-1 gap-[14px] md:grid-cols-6` — collapses to 1-col below `md`; **DOM order = visual order** on collapse (no CSS reorder). Arrange tiles in the DOM in the 390px reading order.

### Tile inner padding & typography (design system)
**Source:** `actualidad-module.tsx` + UI-SPEC §Spacing/§Typography.
**Apply to:** every panel tile.
- Tile padding `p-6` (24px). Heading `text-lg font-semibold`. Item title `text-[15px] font-semibold leading-snug`. Body `text-[13px]`. Empty/suppression `text-sm text-muted-foreground`. Chip/kicker `text-[11px] font-mono`.
- ALL numbers/dates/boletines in `font-mono`. Two weights only: 400 + 600 (mono kicker/chip may be `font-medium`).
- Chip pill idiom (copy from `actualidad-module.tsx:309`): `inline-flex items-center px-[9px] py-0.5 font-mono text-[11px] font-medium text-accent-product bg-accent-product-soft rounded-full`.

### Honesty / anti-insinuación (build-time contract)
**Source:** `anti-insinuacion-guard.test.ts` + `bento-guards.test.ts` (guards-as-test).
**Apply to:** all panel copy — enforced statically in `pnpm --filter ./app test`.
- Guards run in the vitest suite; extend them in Wave 0 BEFORE writing any copy.

---

## No Analog Found

*(none)* — every file has a concrete in-repo analog. The only NEW file (`panel-actualidad.tsx`) is a near-clone of `actualidad-module.tsx` (same RSC fetch+view+empty-state idiom), differing only in reading the precomputed RPC instead of raw `.from()` tables.

---

## Metadata

**Analog search scope:** `app/components/**`, `app/app/**`, `app/lib/**`, `supabase/migrations/0065-0066`.
**Files scanned:** page.tsx, actualidad-module.tsx, bento-tile.tsx, bento-grid.tsx, supabase.ts, format.ts, dia-calendario.ts, types.ts, utils.ts, anti-insinuacion-guard.test.ts, bento-guards.test.ts, lockdown-guard.test.ts, contraparte/[id]/page.tsx, 0065_actualidad_senal.sql, 0066_actualidad_rpc.sql.
**Pattern extraction date:** 2026-07-24

**Wave ordering reminder (from RESEARCH Wave 0 Gaps):** guards FIRST (both test files) → then `panel-actualidad.tsx` + its RTL test with `SenalRow[]` fixtures (activa / suprimida / `'(sin materia)'`) → then mount in `page.tsx` → then benchmark (PANEL-03) + BrowserOS cold-read gate over the real deploy (PANEL-04).
