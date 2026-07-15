---
phase: 78-bento-home-actualidad-votado-urgencias-frescura-como-tiles
verified: 2026-07-15T12:20:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 78: BENTO-HOME-ACTUALIDAD Verification Report

**Phase Goal:** La actualidad vive como tiles del grid con los datos reales de hoy — presentación nueva, datos idénticos.
**Verified:** 2026-07-15T12:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Votado span-4 con barra civic por cámara (azul/burdeos) + tally mono en-dash, o empty honesto | ✓ VERIFIED | `actualidad-module.tsx:87` `BentoTile span={4}`; `:104-113` barra `bg-[var(--camara)]`/`bg-[var(--senado)]` con `aria-hidden`, omitida si `it.camara` falsy; `:124-126` `conteoVotacion` en `span.font-mono`; `:92` empty verbatim `Sin votaciones registradas esta semana en las fuentes consultadas.` |
| 2 | Urgencias span-2 con chip pill del tipo (suma/simple) en fondo petróleo suave | ✓ VERIFIED | `:224` `BentoTile span={2}`; `:239-241` chip `bg-accent-product-soft font-mono text-[11px]` renderiza `{it.tipo}` verbatim; `:248` `desde {fechaCorta}` mono; empty `:228` verbatim |
| 3 | Strip frescura span-6 con dot petróleo + fuente + fecha mono, desaparece si 0 items | ✓ VERIFIED | `:329` `if (items.length === 0) return null;`; `:332` `BentoTile span={6}`; `:339-341` dot `w-1.5 h-1.5 rounded-full bg-accent-product`; `:344-346` fecha `font-mono`; `:333` `flex-wrap` |
| 4 | Módulo lineal (ActualidadModule/Panel) retirado; 3 bloques dentro del BentoGrid en orden votado→urgencias→frescura | ✓ VERIFIED | `grep` de `function Panel`/`export function ActualidadModule`/`<ActualidadModule` → 0 matches; `page.tsx:188-196` 3 `<Suspense>` con fetchers hijos del `<BentoGrid>` en orden correcto; `page.test.tsx:261-269` asserta ausencia de `[aria-label="Actualidad"]` y `.max-w-5xl` |
| 5 | Barra de cámara omitida honestamente cuando la votación no trae cámara | ✓ VERIFIED | `:104` `{it.camara && (...)}` — condicional; `:131-133` meta = `Votación del {fecha}` sin suffix cuando null; test `:137-146` afirma NO existe marcador y meta sin `· Cámara/· Senado` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/components/actualidad-module.tsx` | 3 *View a BentoTile + camara proyectada + Panel/wrapper borrados | ✓ VERIFIED | Contains `bg-[var(--camara)]` (:109); Panel/ActualidadModule/BloqueSkeleton removed; fetchers + helpers verbatim |
| `app/app/page.tsx` | 3 fetchers en BentoGrid; `<ActualidadModule/>` retirado; force-dynamic conservado | ✓ VERIFIED | Contains `VotadoEstaSemana` (:6); `export const dynamic = "force-dynamic"` (:19); 3 `<Suspense>` under grid |
| `app/components/actualidad-module.test.tsx` | tests forma tile + barra/chip/strip + GATE §9.1 | ✓ VERIFIED | `makeVotado` (:19) con `camara`; barra/chip/strip asserts; GATE §9.1 (:224-238); source-scan invariantes (:240-271) |
| `app/app/page.test.tsx` | retiro módulo lineal + montaje tiles + force-dynamic | ✓ VERIFIED | Contains `force-dynamic` (:253); Contract 3 (:250-270) mockea 3 fetchers y asserta retiro |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `VotadoEstaSemana()` | `sb.from('votacion').select` | columna `camara` añadida al select existente | ✓ WIRED | `:169` `.select("boletin, resultado, total_si, total_no, fecha, enlace, camara")`; diff pre-78 confirma ÚNICA línea de query cambiada |
| `page.tsx` | `BentoGrid` | 3 `<Suspense>` con fetchers como hijos del grid | ✓ WIRED | `:188-196` los 3 `<Suspense fallback={<BloqueSkeleton span={N}/>}>` dentro de `<BentoGrid>` tras `</nav>` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| VotadoEstaSemana | `items` | `sb.from('votacion').select(...)` real query, `.gte/.order/.limit` | Sí (throw #34 on error, no `?? []` masking) | ✓ FLOWING |
| UrgenciasVigentes | `items` | `sb.from('tramitacion_evento')` + `urgenciaVigente()` helper | Sí | ✓ FLOWING |
| UltimaActualizacion | `items` | `FUENTES_FRESCURA` allowlist → `.from(tabla).select('fecha_captura')` | Sí | ✓ FLOWING |

Data layer is presentation-identical: the ONLY diff (`git diff 036fabd..HEAD`) is `select(...enlace)` → `select(...enlace, camara)`. Zero new `.rpc`, zero new `.from`. `camara` is a non-PII enum column (types.ts:61 `"diputados" | "senado"`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Civic tokens defined as complete hsl() | `grep --camara: app/app/styles/civic-tokens.css` | `--camara: hsl(213 94% 38%)` (line 10) | ✓ PASS |
| accent-product-soft util generated | `grep accent-product-soft globals.css` | `--color-accent-product-soft` (line 87) | ✓ PASS |
| Helpers not re-implemented | `grep` conteoVotacion/fechaCorta/urgenciaVigente/safeExternalHref | all exported from original modules, imported | ✓ PASS |
| Migrated tests green | `vitest run actualidad-module.test.tsx app/page.test.tsx` | 39 passed | ✓ PASS |
| Full suite green | `pnpm exec vitest run` | 867 passed, 77 files | ✓ PASS |
| TypeScript clean | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BENTO-03 | 78-01 | Actualidad como tiles (votado span-4/urgencias span-2/frescura span-6), mismas queries, empty honesto, lineal retirado | ✓ SATISFIED | Truths 1-5 all VERIFIED |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Zero hex, zero `hsl(var(`, zero `[--token]` bare, zero `bg-camara`/`bg-senado` util | none | `grep -nE '#[0-9a-fA-F]{3,6}\|hsl\(var\(\|bg-camara\|bg-senado[^-]\|\[--[a-z]'` on both modified files → 0 matches |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers in modified files | none | clean |

Note: `.next/` build artifacts show `--camara: #0658bc` (compiled hex) — this is Tailwind's output CSS, NOT source. Source token is `hsl(213 94% 38%)`. Not a violation.

### Human Verification Required

None. Phase is presentation migration of existing data blocks; all behavior is unit-testable and verified via the suite. Visual bento layout parity vs mockup is explicitly deferred to Phase 81 (BENTO-SHIP — BrowserOS en deploy real) per ROADMAP.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria and all 5 PLAN must-have truths are observably true in the codebase on master HEAD (25e9d3f). The three phase commits (e3d8eac, fc474ff, 18546b9) are present. Suite 867/867 green matches SUMMARY claim; tsc clean; zero token/hex violations; data layer identical save the single sanctioned non-PII `camara` column. "Ver todo" honestly omitted (no ruta), empty states verbatim, GATE §9.1 and source-scan (cero .from PII, ≥4 throws #34) intact.

---

_Verified: 2026-07-15T12:20:00Z_
_Verifier: Claude (gsd-verifier)_
