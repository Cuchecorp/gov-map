---
phase: 62-red-grafo-de-relaciones-entendible
verified: 2026-07-10T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification. Post-execution code review (62-REVIEW.md) found 1 critical (CR-01) + 6 warnings; CR-01/WR-01..05 FIXED and redeployed (820ecba4), WR-06 deferred with documented reason."
human_verification:
  - test: "Abrir /red?seed=<id> en un móvil/tablet real (o dispositivo con rotación) y girar a horizontal cruzando el breakpoint 48rem."
    expected: "Al cruzar a ancho ≥48rem, el anillo radial xyflow debe encuadrar correctamente (fitView), no aparecer en blanco ni mal encuadrado. El canvas se monta bajo display:none en móvil (0×0), por lo que el reencuadre depende de la recuperación por ResizeObserver de xyflow."
    why_human: "WR-06 (62-REVIEW) fue diferido explícitamente a verificación en navegador real; jsdom no evalúa layout/ResizeObserver y BrowserOS (MCP local) no expone viewport/resize nativo — la ruta rotate-to-desktop no fue ejercida por ninguna herramienta automatizada."
---

# Phase 62: Red — Grafo de relaciones entendible — Verification Report

**Phase Goal:** `/red` deja de ser una franja apiñada de ~136 nodos: con seed muestra el ego-network real (seed + vecinos directos y sus aristas) en un layout radial determinista que no implica afinidad (LOCKED F18: nunca force-simulation), etiquetas legibles sin zoom, tope de vecinos honesto, usable en móvil; sin seed, un estado inicial que orienta. Validado por lectura fría BrowserOS con evidencia before/after.
**Verified:** 2026-07-10
**Status:** human_needed
**Re-verification:** No — initial verification (post code-review fixes).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RED-01: `/red` con seed muestra SOLO el ego-network real (seed + vecinos directos capados a 24), NUNCA ~136 nodos; sin seed, estado inicial que orienta (explicación + selector prominente), jamás el grafo completo. | VERIFIED | `red-graph.tsx:114` `CAP=24`; `:265-266` `rendered=slice(0,24)`/`overflow=slice(24)`; `:281-305` `rfNodes=[seed,...rendered]`, invariante `|rfNodes|===rendered.length+1`; `:584-605` control "Ver {N} vecinos más" con Links `/red?seed=`. No-seed: `page.tsx:69-131` selector `<select>` agrupado por cámara + "Ver relaciones", el RPC `subgrafo_red` exige semilla (sin variante seedless → sin enumeración). Test `red-graph.test.tsx:650` "Ver 6 vecinos más" (30−24) + count 25. VEREDICTO: 25 `.net-nodo` vs 93 antes. |
| 2 | RED-02: Layout legible y determinista que NO implique afinidad (F18: nunca force-simulation): radial ego-céntrico, orden alfabético, etiquetas legibles sin zoom, tope con "ver más" honesto, usable en móvil 390px; leyenda actualizada. | VERIFIED | `radialPos()` `red-graph.tsx:126-139` trig pura (`cos`/`sin`, `Math.round`), cero física; orden alfabético `:220` `localeCompare(...,"es")`, invariante al orden de entrada (test `:556`); fallback móvil `.net-vecinos md:hidden` `:512-578` lista con hecho + procedencia; borde institucional por cámara `nodo-parlamentario.tsx:57-69` → `globals.css:244-251` `var(--camara-muted-foreground)`/`--senado-muted-foreground` (WR-01 fix, contraste real); leyenda `:409-414` "La posición en el anillo es orden alfabético, no cercanía". Test `:671` banned-vocab + presencia "orden alfabético"/"no cercanía". |
| 3 | RED-03: Lectura fría BrowserOS (F61: captura→corrección→re-captura, desktop+390px) da veredicto "comprensible" con/sin seed; evidencia before/after archivada. | VERIFIED | `red-evidence/VEREDICTO.md` veredicto global **COMPRENSIBLE** en las 4 combinaciones; 13 capturas antes/después presentes; deploy live Version `61d8fe13` (P1 fix) + redeploy post-review `820ecba4` (CR-01/WR-01..05). Checkpoint humano: operador respondió "aprobado" 2026-07-09. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/components/red/red-graph.tsx` | radial layout + cap 24 + "N vecinos más" + móvil vecinos-list + leyenda + CR-01/WR-04/WR-05 fixes | VERIFIED | `radialPos` (no `posicion`/`laneCounters`), `CAP=24`, `displayNombre` (WR-05), self-loop guard `:215-216` (WR-04), `sinVecinosVisibles`/`avisoMovilFallback` (CR-01), `.net-vecinos` list. Wired: imported+mounted in `page.tsx:174`. |
| `app/components/red/nodo-parlamentario.tsx` | borde por cámara (net-nodo--camara/--senado) | VERIFIED | `:57-69` `camaraClase` compuesto con `filter(Boolean).join(" ")`, conserva `net-nodo`+`net-nodo--seed`. Solo borde, sin partido/foto/RUT. |
| `app/app/globals.css` | .net-nodo--camara/--senado (foreground tokens) + .net-vecinos (48rem query) | VERIFIED | `:244-251` `-foreground` tokens (WR-01); `:261-262` seed-border cascade win (WR-02); `:383` `@media (min-width: 48rem)` (WR-03, no `768px`); `.net-vecinos*` block. |
| `red-evidence/` + `VEREDICTO.md` | capturas antes/después + veredicto "comprensible" | VERIFIED | 13 PNGs (seed/no-seed × desktop/móvil, antes/después) + VEREDICTO.md con "COMPRENSIBLE" + redeploy note 820ecba4. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `red-graph.tsx` | `seedNeighbors` (memo alfabético) | `radialPos(i, rendered.length)` sobre `slice(0,24)` | WIRED | `:293-303` map over `rendered` with `radialPos`. |
| `red-graph.tsx` | leyenda | copy "orden alfabético, no cercanía" | WIRED | `:410-413`. |
| `globals.css .net-nodo--camara` | civic-tokens `--camara-muted-foreground` | `border-left-color: var(...)` (sin doble hsl) | WIRED | `:246`; token defined `civic-tokens.css:13`. |
| `.net-vecinos` filas | `/red?seed=<id>` | Link por vecino + procedencia (etiquetaHecho/ventanaTexto/safeExternalHref) | WIRED | `:526-568`. |
| deploy | `workers.dev/red` | Docker node:22-slim + wrangler 4 OAuth | WIRED | VEREDICTO redeploy note: Version `820ecba4`, `/red?seed=D1009` HTTP 200. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `<RedGraph>` | `subgrafo` (nodos/aristas) | `page.tsx:140` `sb.rpc("subgrafo_red", {p_id, p_depth:1})` — real DB RPC, honest-error on failure | Yes (grafo NET poblado: seed D1009 = 92 vecinos reales) | FLOWING |
| no-seed selector | `parlamentarios_publico` rows | `page.tsx:71` `sb.rpc("parlamentarios_publico")`, throws on error (no degradation) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| red-graph test contract (radial, cap, banned-vocab, cámara border, mobile list, self-loop, empty-name, CR-01 state) | `pnpm test -- red-graph` | 750 passed (70 files) | PASS |
| Type safety of the island + page | `pnpm typecheck` (`tsc --noEmit`) | no output (clean) | PASS |
| Review-fix commits on master | `git log b32f41e..27f26d4` | 173644f/12ba154/d0f4c5e/b32f41e/27f26d4 present | PASS |
| Deploy live rotate-to-desktop framing (WR-06) | — | not exercisable (no viewport tool) | SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RED-01 | 62-01 | ego-network real + cap honesto; sin seed = estado que orienta | SATISFIED | Truth 1 |
| RED-02 | 62-01, 62-02 | layout radial determinista (F18), legible, cap "ver más", móvil, leyenda | SATISFIED | Truth 2 |
| RED-03 | 62-03 | lectura fría BrowserOS "comprensible" + evidencia before/after | SATISFIED | Truth 3 |

All three requirement IDs from PLAN frontmatter accounted for; REQUIREMENTS.md marks RED-01/02/03 as Complete (Phase 62). No orphaned requirements for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER in `red-graph.tsx`, `nodo-parlamentario.tsx`, `globals.css` (modified files) | — | None |

### Human Verification Required

#### 1. Rotate-to-desktop framing on a real device (WR-06)

**Test:** Open `https://observatorio-congreso.thevalis.workers.dev/red?seed=D1009` on a real phone/tablet (or a device that can rotate), then rotate/resize across the 48rem breakpoint into the desktop layout.
**Expected:** When the layout crosses to ≥48rem, the radial xyflow canvas (which initializes under `display:none` on mobile, 0×0) must re-frame correctly via `fitView` — no blank or misframed canvas.
**Why human:** WR-06 was explicitly deferred to real-browser verification. jsdom does not evaluate layout/ResizeObserver, and BrowserOS (MCP local) exposes no native viewport/resize — the rotate-to-desktop path was never exercised by any automated tool. This is the only unverified corner of an otherwise fully-substantiated phase; the desktop-only and 390px-simulated paths passed the cold read.

### Gaps Summary

No blocking gaps. All three requirements (RED-01, RED-02, RED-03) are substantiated in the codebase: the radial ego-network with a 24-neighbor honest cap, the mobile vecinos-list fallback, the institutional cámara border (now using contrast-correct `-foreground` tokens after WR-01), and the no-seed orienting selector are all present, wired, and fed by real RPC data. The full suite is 750/750 green, typecheck is clean, and all six code-review fix commits (b32f41e..27f26d4) are on master. The BrowserOS cold read gave a "COMPRENSIBLE" verdict with before/after evidence archived, the P1 (mobile list leaking to desktop) was caught, fixed, redeployed, and re-captured, and the human checkpoint was approved by the operator.

**Documentation note (non-blocking):** 62-03-SUMMARY.md cites Version `61d8fe13` as the final live version, but VEREDICTO.md's redeploy section and the prompt context confirm `820ecba4` is the authoritative post-review-fix deploy. The SUMMARY predates the code-review fixes; the code on master carries all of them (verified above). No code gap — SUMMARY staleness only.

**Deferred debt (documented, non-blocking):** P2 (ring density at 772px capture width — artifact of BrowserOS window width, not a comprehension defect) and WR-06 (see human verification above). Both are documented in VEREDICTO.md / 62-REVIEW.md with bounded remediation paths.

Status is `human_needed` (not `passed`) solely because WR-06's rotate-to-desktop path requires real-device verification that no automated tool in this environment can perform. All programmatically verifiable truths passed.

---

_Verified: 2026-07-10_
_Verifier: Claude (gsd-verifier)_
