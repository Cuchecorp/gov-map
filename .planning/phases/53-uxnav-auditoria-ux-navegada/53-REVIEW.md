---
phase: 53-uxnav-auditoria-ux-navegada
reviewed: 2026-07-07T03:42:16Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - app/app/agenda/citaciones-empty.test.tsx
  - app/app/agenda/page.tsx
  - app/app/buscar/page.tsx
  - app/app/buscar/resultados-error.test.tsx
  - app/app/contraparte/[id]/page.tsx
  - app/app/parlamentario/[id]/page.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/breadcrumbs.test.tsx
  - app/components/breadcrumbs.tsx
  - app/components/header-nav.test.tsx
  - app/components/header-nav.tsx
  - app/components/lobby-de-parlamentario.test.tsx
  - app/components/lobby-de-parlamentario.tsx
  - app/components/parlamentario-header.tsx
  - app/components/red/red-graph.test.tsx
  - app/components/red/red-graph.tsx
  - app/components/votos-por-parlamentario.test.tsx
  - app/components/votos-por-parlamentario.tsx
  - scripts/rewalk-shot.mjs
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: clean
fixed_at: 2026-07-06
fixes: WR-01..WR-06 + IN-05 resueltos (commits fix(53) c014f86..78710a8; suite 565 verde + tsc -b limpio)
---

# Phase 53: Code Review Report

**Reviewed:** 2026-07-07T03:42:16Z
**Depth:** deep
**Files Reviewed:** 21 (20 changed in `8c49188..HEAD` scope + `global-header.tsx` traced as direct consumer)
**Status:** clean — WR-01..WR-06 (todas las warnings) + IN-05 RESUELTOS 2026-07-06 (commits `fix(53):`, suite 565 verde + `tsc -b` limpio); quedan 4 info abiertas (IN-01..IN-04)

## Summary

Deep review of the F53 UX-nav phase: HeaderNav 5-item re-order (+`/red`), new `Breadcrumbs` server component wired into the 3 fichas, F-03 continuation lines in 6 empty states, named-export-for-testability changes, and the `rewalk-shot.mjs` evidence helper. All 24 tests in the 5 new/extended test files were executed and pass.

**Invariants verified (no violations found):**

- **Gate ordering (contraparte):** `moneyPublicEnabled` `notFound()` remains the FIRST statement of the page; the breadcrumb renders inside `HeaderSection` only AFTER the RPC resolves a valid `fila` and the jurídica defense — no existence leak, and with gate OFF the whole route 404s before any crumb exists (`app/app/contraparte/[id]/page.tsx:49,142`).
- **Contraparte never linked TO:** no new crumb, nav item, or continuation link points at `/contraparte`; contraparte breadcrumb only links outward to `/`.
- **PII in chrome:** breadcrumb renders only route labels + the same public `nombre` already in the h1 (`ParlamentarioPublicoRow.nombre` is non-null `string`, `lib/types.ts:111`); no partido/rut/email anywhere in the new chrome.
- **Anti-insinuación in new copy:** all 6 continuation lines are neutral navigation ("buscar un proyecto de ley por su idea", "directorio de parlamentarios", "agenda legislativa de la semana"); no causal/affinity vocabulary; empty ≠ virtue preserved verbatim (asserted byte-identical in tests). Nav label is "Red", not banned vocab.
- **Design system:** all new links use `text-accent-product` token + `min-h-11` touch targets; `mt-12` carril frontiers untouched by the diff; breadcrumb is a `<nav>`, never a heading (asserted in RTL).
- **Named exports don't leak into routing:** `CitacionesSection` (agenda), `HeaderSection` (parlamentario/contraparte) are named exports; only the default export defines an App Router page. The repo already shipped this pattern (`Resultados`, `CarrilesSection`) through a successful deploy, so the Next build accepts the extra exports.
- **Redirect shortcut safety:** `redirect(\`/proyecto/${q}\`)` in /agenda and /buscar is guarded by anchored digits-only `BOLETIN_RE` (`/^\d{3,6}(-\d{1,2})?$/`) — no path injection.

Issues found are below: 6 warnings (one gate-consistency coupling, two defects in the evidence script, one LOCKED-docstring contradiction, one latent client-state bug, one hollow test assertion) and 5 info items. Code is already deployed (7b35b99e).

**Fix pass (2026-07-06):** las 6 warnings + IN-05 fueron resueltas con commits atómicos `fix(53): WR-0x …` (WR-01 `c014f86`, WR-02 `19795f7`, WR-03 `01f9a5d`, IN-05 `f49f4bf`, WR-04 `e378b71`, WR-05 `82bd432`, WR-06 `78710a8`). Gates: suite completa 565/565 verde + `tsc -b` limpio. Quedan abiertas solo las info IN-01..IN-04.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: Header nav advertises the gated `/red` route unconditionally — breaks the "espejo EXACTO de los gates" pattern

**File:** `app/components/header-nav.tsx:31-37`
**Issue:** `NAV_ITEMS` is a static list in a client component; the "Red" item renders on every page regardless of `netPublicEnabled`. Every other NET/MONEY/CRUCES surface in the repo removes the node ENTIRELY from the DOM when its gate is OFF (e.g., the B21b link in `parlamentario/[id]/page.tsx:143` is wrapped in `netPublicEnabled(process.env)`). `/red` itself is gated fail-closed (`app/app/red/page.tsx`: `notFound()` first statement). If `NET_PUBLIC_ENABLED` ever regresses to its default OFF (e.g., a redeploy that loses the Cloudflare env var — deploy creds/vars are operator-managed and NOT in `.env`), the global header on every page links to a 404, and the chrome still names the NET surface while the gate says it must be absent. Today the flag is ON in PROD so behavior is correct, but the coupling is a silent-regression trap.
**Fix:** Derive the item server-side. `GlobalHeader` is already a Server Component — compute the flag there and pass it down:
```tsx
// global-header.tsx (server)
<HeaderNav showRed={netPublicEnabled(process.env)} />

// header-nav.tsx
export function HeaderNav({ showRed }: { showRed: boolean }) {
  const items = showRed ? NAV_ITEMS : NAV_ITEMS.filter((i) => i.href !== "/red");
  ...
}
```
(The boolean prop is not sensitive — it only mirrors what the route already reveals.)
**RESUELTO** (`c014f86`): `GlobalHeader` computa `showRed` vía `netPublicEnabled(process.env)` y `HeaderNav` filtra el ítem `/red` del DOM con gate OFF; tests cubren ambos estados (5 ítems ON / 4 ítems OFF).

#### WR-02: `rewalk-shot.mjs` reports `SHOT_OK` even when the MCP tool call failed (`result.isError` never checked)

**File:** `scripts/rewalk-shot.mjs:24-37,54-62`
**Issue:** `rpc()` only throws on a JSON-RPC-level `parsed.error`. MCP tool failures (bad output path, page not found, screenshot error) are returned as a *successful* JSON-RPC response with `result.isError: true` and the error text in `result.content`. Both `evaluate_script` and `save_screenshot` failures therefore sail through, the retry `catch` never fires, and the script prints `SHOT_OK <path>` with no file (or a stale file) on disk. Since this script produced the before/after evidence for the 53-05 re-walkthrough, a silent failure fabricates audit evidence.
**Fix:**
```js
const callTool = async (name, args) => {
  const result = await rpc("tools/call", { name, arguments: args });
  if (result?.isError) {
    const msg = (result.content ?? []).map((c) => c.text ?? "").join(" ");
    throw new Error(`tool ${name} failed: ${msg.slice(0, 200)}`);
  }
  return result;
};
```
**RESUELTO** (`19795f7`): `callTool` lanza sobre `result.isError` con el texto del tool; el script sale ≠0 en vez de imprimir `SHOT_OK` falso.

#### WR-03: `rewalk-shot.mjs` SSE parsing crashes on standard event-stream framing

**File:** `scripts/rewalk-shot.mjs:30-34`
**Issue:** The response is treated as SSE only when the body starts with the literal `"data:"`. Streamable-HTTP MCP servers commonly emit frames beginning with `event: message\ndata: {...}` — in that case the ternary falls through and `JSON.parse` runs on the entire SSE text → `SyntaxError: Unexpected token 'e'`. Additionally, when the body does start with `"data:"` but no `"data: "` line is found, `line` is `undefined` and `JSON.parse(undefined)` throws an unhelpful error. Either path aborts the shot with a misleading `FAIL Unexpected token…` instead of the real cause.
**Fix:**
```js
const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
const line = dataLine ? dataLine.slice(6) : text;
```
(Search for the `data:` line unconditionally; fall back to raw text only when none exists.)
**RESUELTO** (`01f9a5d`): la línea `data: ` se busca en cualquier posición del body; fallback a JSON plano, y si ninguno parsea se lanza un error con snippet del body (fail-loud).

#### WR-04: Lobby empty states now link to `/buscar` while the component's own LOCKED §9.1 rule 1 says the section "NUNCA … enlaza un … proyecto" — contract/code contradiction

**File:** `app/components/lobby-de-parlamentario.tsx:23-24,302-312,326-337`
**Issue:** The content-gate box at the top of the file (marked LOCKED, "RELEASE GATE DE LA FASE") states: "esta sección NUNCA referencia, compone ni enlaza un voto / boletín / proyecto / declaración". F-03 added, inside this same section, a link to `/buscar` labeled "buscar un proyecto de ley por su idea". The anti-insinuación *intent* is intact — the link lives only in the two empty states, where zero lobby facts exist, so no lobby fact is composed with a legislative fact, and 53-UI-SPEC contracted this exact copy. But the code now literally contradicts its own LOCKED contract. Future agents enforcing the docstring verbatim will either "fix" the contracted link away, or — worse — read the rule as already broken and feel licensed to add project links in state (c), where composition WOULD be an insinuation vector.
**Fix:** Amend the docstring rule (not the code): add an explicit carve-out, e.g. "1. … Excepción ÚNICA: en los empty states (a)/(b) —cero hechos de lobby presentes— se permite UNA línea de continuación de navegación a /buscar (F-03, 53-UI-SPEC), nunca a un /proyecto/[boletin] concreto." Keep the state-(c) prohibition absolute.
**RESUELTO** (`e378b71`): carve-out explícito agregado a la regla 1 del gate §9.1 (comment-only) — empty states (a)/(b) pueden enlazar la RUTA /buscar (cero hechos = nada que componer); estado (c) mantiene la prohibición absoluta.

#### WR-05: `RedGraph` filter state goes stale if `subgrafo` prop changes without remount — latent "Ninguna relación coincide" with untouched filters

**File:** `app/components/red/red-graph.tsx:129-131,144-157`
**Issue:** `tiposActivos` is initialized once from `tiposPresentes` (`useState(() => new Set(tiposPresentes))`) and is never reconciled when `subgrafo` changes. If the client island receives a new subgraph (different seed) at the same tree position, any edge tipo present in the new data but absent at mount time renders its checkbox unchecked and all its edges filtered out — the user sees "Ninguna relación coincide con los filtros seleccionados" despite touching nothing. **Currently latent:** the only entries to `/red?seed=…` are a plain `<a>` from the ficha (`parlamentario/[id]/page.tsx:145`) and a GET `<form>` on `/red`, both full document loads that remount the island. The first future `<Link>` to `/red?seed=…` (the natural Next idiom) silently activates the bug. Pre-existing code, surfaced by this review because the file was modified in this phase.
**Fix:** Track *deselected* tipos instead of selected ones (empty set = all on), so new tipos default to visible:
```tsx
const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(new Set());
const visible = (tipo: string) => !tiposOcultos.has(tipo);
```
**RESUELTO** (`82bd432`): el estado ahora es `tiposOcultos` (set vacío = todo visible); tipos nuevos que lleguen por cambio de prop nacen visibles. 18/18 tests RTL del grafo verdes sin cambios.

#### WR-06: Test asserts `>= 1` RPC calls under the name "el breadcrumb NO invoca un RPC extra" — the stated contract is untested

**File:** `app/app/parlamentario/[id]/page.test.tsx:238-246`
**Issue:** The test's docstring and name promise that the breadcrumb reuses the cached row ("una sola lectura cacheada"), but the assertion is `expect(headerRpc.length).toBeGreaterThanOrEqual(1)` — it passes with 1, 2, or 50 RPC calls. A regression that adds a second `parlamentario_publico` round-trip per header render would sail through. In this scenario (`HeaderSection` invoked directly, single call site) the true count is exactly 1, so the strict assertion is safe today.
**Fix:** `expect(headerRpc).toHaveLength(1);` — if `React.cache` behavior outside a render pass is the concern, that is precisely what the test must pin, not paper over.
**RESUELTO** (`78710a8`): aserción fijada a `toHaveLength(1)`; el test pasa (la cabecera hace exactamente 1 round-trip).

### Info

#### IN-01: Unused import `within` in header-nav test

**File:** `app/components/header-nav.test.tsx:2`
**Issue:** `within` is imported from `@testing-library/react` and never used.
**Fix:** Drop it from the import list.

#### IN-02: Breadcrumbs test title contradicts its own assertions

**File:** `app/components/breadcrumbs.test.tsx:76-86`
**Issue:** The test is named "un solo ítem (contraparte: [Inicio, nombre]) dibuja 0 separadores y 1 link" but the fixture has DOS items and the assertions expect `1` separator (`toHaveLength(1)`) and 1 link — which is the correct N-1 behavior for 2 items. The title's "un solo ítem"/"0 separadores" is wrong on both counts and will mislead the next reader debugging a failure.
**Fix:** Rename to "dos ítems (contraparte: [Inicio, nombre]) dibujan 1 separador y 1 link".

#### IN-03: Header skeletons not updated for the new breadcrumb row → layout shift on Suspense resolution

**File:** `app/app/parlamentario/[id]/page.tsx:440-451`; `app/app/contraparte/[id]/page.tsx:161-169`
**Issue:** `ParlamentarioHeaderSkeleton` and `HeaderSkeleton` are documented as shape-matched to their headers, but the breadcrumb added inside `ParlamentarioHeader`/`HeaderSection` makes the resolved content one row taller than the skeleton — a small CLS on every ficha load. (The /proyecto ficha avoids this by rendering the crumb outside Suspense.)
**Fix:** Add one `<Skeleton className="h-4 w-40" />` line at the top of both skeletons.

#### IN-04: `GlobalHeader` docstring stale after the F53 nav change (cross-file doc drift)

**File:** `app/components/global-header.tsx:16-17` (consumer of the reviewed `header-nav.tsx`)
**Issue:** The docstring still describes the nav as "(Buscar · Parlamentarios · Agenda · Sobre / Metodología)" — the pre-F53 4-item list. The nav is now 5 items with "Red" and the shortened "Sobre".
**Fix:** Update the comment to the 53-UI-SPEC §(a) order.

#### IN-05: `rewalk-shot.mjs` dead conditional and unvalidated numeric args

**File:** `scripts/rewalk-shot.mjs:22` (and `20`)
**Issue:** `Number(waitStr || (width >= 1000 ? 7000 : 7000))` — both ternary branches are `7000`; the conditional is dead code that implies a distinction that doesn't exist. Also `width = Number(widthStr)` is never checked: a non-numeric arg yields `width:NaNpx` in the injected iframe CSS and a silent garbage screenshot instead of a usage error.
**Fix:** `const waitMs = Number(waitStr || 7000);` and `if (!Number.isFinite(width) || width <= 0) { console.error("width inválido"); process.exit(1); }`.
**RESUELTO** (`f49f4bf`): width no numérico → usage error + exit 1; ternario muerto reemplazado por el literal `7000` (fix oportunista autorizado junto a WR-02/WR-03).

---

_Reviewed: 2026-07-07T03:42:16Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
