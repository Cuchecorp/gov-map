---
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
verified: 2026-07-24T22:15:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification. Verified against CURRENT code state (after code-review fix loop CR-01..03 / WR-01..06, commits abc1f04..1681148), not against the raw executor SUMMARYs."
human_verification:
  - test: "Deploy a Cloudflare + BrowserOS cold-read de la ficha de un parlamentario: el 5º bloque 'Militaron en el mismo partido' aparece above-the-fold dentro de <section id=relaciones> (grid ahora de hasta 5 bloques bajo [&>section]:mt-0), sin doble-espaciado ni colapso de celdas."
    expected: "Bloque relaciones visible above-the-fold con heading, leyenda de grupo y grid 2x2/celdas; sin colapso mt-12 entre celdas (cascada CSS solo cazable con getComputedStyle en deploy real — memoria v6.1/v8.0)."
    why_human: "Cascada CSS del grid y el ritmo vertical solo se observan en el render real del deploy; no verificable por grep/tests unitarios."
  - test: "BrowserOS sobre el deploy: /comparar?a=&b= con dos parlamentarios reales — seleccionar A y B, verificar intersección de comisiones/co-autoría/militancia histórica + zona; luego un par senador+senador de la misma circunscripción para ver que la zona SÍ aparece."
    expected: "Los 4 ejes renderizan A/B + intersección factual con fuente+fecha; dos diputados → 'no comparten zona' (vacío honesto); dos senadores misma circ → zona compartida aparece."
    why_human: "Flujo de usuario end-to-end (selección + render server-side sobre datos reales de PROD) solo validable en el deploy real; no cubierto por la verificación automatizada de esta fase."
  - test: "CTA 'Comparar con otro parlamentario' desde la ficha pre-llena el slot A en /comparar?a=${id}."
    expected: "Al hacer clic desde la ficha, /comparar abre con el parlamentario A ya seleccionado."
    why_human: "Navegación cliente + estado de selector solo verificable interactuando con el deploy."
---

# Phase 101: Relaciones (P2A) — Audit de brecha + bloque relaciones + /comparar + coalición — Verification Report

**Phase Goal:** Sacar a la superficie las relaciones entre parlamentarios que YA existen en datos pero están enterradas, y añadir la comparación 1-a-1 que falta — todo factual, orden alfabético, jamás ranking.
**Verified:** 2026-07-24T22:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (verified against current code state after the code-review fix loop, not the raw SUMMARYs)

## Goal Achievement

All code-level truths for the phase goal are VERIFIED in the actual codebase and against PROD. The three remaining items are deploy-dependent visual/flow checks explicitly out of scope for this phase's automated verification (Phase 104 E2E / orchestrator BrowserOS gate covers deploy), so status is `human_needed` — no gaps.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Audit N/M reproducible con psql verbatim contra PROD existe (REL-01) | ✓ VERIFIED | `101-AUDIT-RELACIONES.md` (382 líneas); §1 matriz N/M con queries `psql -tA` pegadas + resultados reales; grep confirma `SUPABASE_DB_URL`, `zona`, `contraparte_id`, `coalici`. |
| 2 | Zona-gap headline registrado (155 diputados sin distrito, eje SOLO Senado) | ✓ VERIFIED | Audit §2: `diputados 155 → 0 con_distrito`; declara "eje SOLO Senado (31)", NO fabrica distrito, marca Cámara-zona como Future Requirement de ingesta. |
| 3 | Decisión lobby-misma-contraparte tomada con N (contraparte_id 100% NULL) | ✓ VERIFIED | Audit §3: `contraparte_id NOT NULL = 0 de 17.681`; name-match 3.749 pares / 134 parl con conflación CGE documentada; VEREDICTO DIFERIDA por default, sin ship. |
| 4 | Probe empírico de coalición con veredicto viable/DIFERIDA (REL-05) | ✓ VERIFIED | Audit §5: Servel pactos 2025 VIABLE (200 OK, robots-allowed, ruta dos-etapas R2 documentada NO ejecutada); comités Senado DIFERIDA (host firewalled, curl 28 timeout). Regla LOCKED "jamás inferida desde votos" explícita. |
| 5 | N militancia histórica emitido (net-new 696 vs shared-ever 1966) | ✓ VERIFIED | Audit §4: `1966\|1270\|696`; net-new-only 696 LOCKED para copy downstream; Pitfall 1 (display≠alias) confirmado. |
| 6 | Guard anti-insinuación registra superficies nuevas ANTES del copy | ✓ VERIFIED | `SUPERFICIES_RELACIONES` (anti-insinuacion-guard.test.ts:339) + spread en scan loop (:565); mutation self-check muerde; suite verde. |
| 7 | Guard lockdown allowlista militancia_historica_compartida (Direction-B) | ✓ VERIFIED | `lockdown-guard.test.ts:186` entrada en PUBLIC_RPC_ALLOWLIST; 0067 existe en migrations (Direction-B satisfecho); lockdown-guard verde. |
| 8 | Ficha muestra los cross-links en <section id=relaciones> above-the-fold | ✓ VERIFIED | `RelacionesSection` importado (page.tsx:36) y montado (:378-397) tras MilitanciasSection, antes de CarrilesSection; heading + leyenda de grupo + grid. |
| 9 | CrossLinkBloque byte-intacto (leyenda LOCKED, total_n honesto, mt-12 frontier) | ✓ VERIFIED | `cross-links-parlamentario.tsx` último cambio en Phase 91 (commit 5f4127f); no tocado por 101. Composición por children. |
| 10 | RPC militancia_historica_compartida en PROD (secdef, alias-keyed, total_n, anon sin execute) + pgTAP | ✓ VERIFIED | PROD: `prosecdef=t`, returns `TABLE(id text, nombre text, camara text, total_n bigint)` (cero PII); `has_function_privilege('anon',...)=f`; pgTAP **9 ok / 0 not ok** contra schema aplicado. Net-new live: 0 overlap con copartidarios('D1074'). |
| 11 | /comparar?a=&b= force-dynamic, searchParams antes de notFound, orden canónico alfabético | ✓ VERIFIED | page.tsx:41 `dynamic="force-dynamic"`; :175 `await searchParams`; :181 `.sort()`; :185 validación `PARLAMENTARIO_ID_RE` antes de `.rpc()`; sin notFound (empty state). |
| 12 | 4 ejes factuales no-voto (militancia histórica/comisiones/co-autoría/zona) con A/B + intersección + fuente+fecha | ✓ VERIFIED | Los 4 ejes computan intersección server-side; comisiones por clave compuesta `camara::nombre` (CR-02); intersección de par en dos direcciones + total_n honesto (CR-01); provenance "según fuente al {fecha}" (6 ocurrencias). |
| 13 | Vacíos honestos declarados; error de RPC LANZA, jamás degrada a "sin relaciones" | ✓ VERIFIED | 4× `throw new Error` en lecturas RPC; zona "no comparten zona" declarada (:450); `RelacionesConDatos` monta `<RelacionesSection vacio />` (WR-04); copy net-new acotado "fuera del partido vigente" (WR-02/WR-06). |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `101-AUDIT-RELACIONES.md` | Matriz N/M + probe + decisión lobby (≥80 líneas) | ✓ VERIFIED | 382 líneas; §1-§5 con queries verbatim + resultados reales. |
| `app/components/relaciones-section.tsx` | Wrapper <section id=relaciones> (≥25 líneas) | ✓ VERIFIED | 78 líneas; heading + leyenda + grid + estado vacío declarado. |
| `app/components/relaciones-section.test.tsx` | RTL sección/bloques/leyenda/mt-12 (≥20 líneas) | ✓ VERIFIED | 108 líneas; suite verde. |
| `supabase/migrations/0067_militancia_historica_compartida.sql` | RPC secdef alias-keyed net-new | ✓ VERIFIED | 87 líneas; secdef, search_path='', statement_timeout=5s, join por partido_alias, order by nombre, limit 20, double-revoke, zero grant. Aplicada a PROD. |
| `supabase/tests/0067_*.test.sql` | pgTAP has_function/prosecdef/anon/total_n (≥8 líneas) | ✓ VERIFIED | 63 líneas; plan(9); 9 ok / 0 not ok contra schema aplicado. |
| `app/app/comparar/page.tsx` | /comparar force-dynamic 4 ejes (≥40 líneas) | ✓ VERIFIED | 568 líneas; force-dynamic + 4 ejes + intersección server-side + empty/error contract. |
| `app/app/comparar/page.test.tsx` | RTL /comparar | ✓ VERIFIED | 413 líneas; suite verde. |
| `app/components/comparar-selector.tsx` | Selectores GET-form | ✓ VERIFIED | 85 líneas. |
| `app/components/relaciones-eje-comparar.tsx` | Render A/B por eje | ✓ VERIFIED | 83 líneas. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `parlamentario/[id]/page.tsx` | `relaciones-section.tsx` | import + montaje above-the-fold | ✓ WIRED | import :36; `<RelacionesSection>` montado :378-397. |
| `anti-insinuacion-guard.test.ts` | `SUPERFICIES_RELACIONES` | array + scan loop spread | ✓ WIRED | array :339; spread :565. |
| `comparar/page.tsx` | `militancia_historica_compartida` | `.rpc()` server-side | ✓ WIRED | `sb.rpc("militancia_historica_compartida",...)` :90. |
| `comparar/page.tsx` | `searchParams` | await antes de notFound | ✓ WIRED | `await searchParams` :175; validación antes de cualquier `.rpc()`. |
| `lockdown-guard` | allowlist | Direction-B (allowlist⊆migrations) | ✓ WIRED | entrada :186 + 0067 en migrations; guard verde. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| 0067 RPC (5º bloque + eje militancia) | `militancia_historica_compartida(id)` | PROD RPC secdef, join por partido_alias net-new | ✓ Sí — live: `militancia_historica_compartida('D1074')` retorna filas reales (D1017, D1128, D1012…), 0 overlap con copartidarios | ✓ FLOWING |
| /comparar comisiones/co-autoría/zona | `comisiones_/coautores_/parlamentarios_publico_v2` | RPCs 0060/0061 existentes en PROD | ✓ Sí — RPCs pre-existentes con datos reales (verificado en fases 91) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RPC 0067 secdef + PII-safe en PROD | `psql select proname,prosecdef,pg_get_function_result` | `militancia_historica_compartida\|t\|TABLE(id text, nombre text, camara text, total_n bigint)` | ✓ PASS |
| anon sin execute | `has_function_privilege('anon',...,'execute')` | `f` | ✓ PASS |
| Net-new-only (0 overlap con vigentes) | `count(*) where id in copartidarios('D1074')` | `0` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| pgTAP 0067 | `psql -tA -f supabase/tests/0067_*.test.sql` | `1..9` → 9 ok / 0 not ok | ✓ PASS |
| Suite Phase 101 + full | `pnpm test --run comparar relaciones-section guards page` | 1303 passed / 99 files | ✓ PASS |
| Typecheck | `npx tsc -b` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REL-01 | 101-01 | Audit de brecha dato-disponible vs superficie-mostrada, inventario N/M | ✓ SATISFIED | Truths 1-2, 5; audit §1-2/4 verbatim. |
| REL-02 | 101-02 | Bloque "Relaciones con otros parlamentarios" en la ficha, total_n honesto, orden alfabético anti-ranking | ✓ SATISFIED | Truths 8-9; RelacionesSection montado above-the-fold; CrossLinkBloque intacto; order by nombre. |
| REL-03 | 101-03 | Página /comparar 1-a-1 con ejes factuales no-voto, fuente+fecha | ✓ SATISFIED | Truths 11-13; /comparar 4 ejes + intersección + provenance + error≠vacío. |
| REL-04 | 101-02, 101-03 | Relaciones nuevas: militancia histórica compartida (+ lobby si el dato lo sostiene), framing factual, cobertura declarada | ✓ SATISFIED | Truths 3, 5, 10; RPC 0067 en PROD + 5º bloque + copy net-new acotado; lobby DIFERIDA con evidencia. |
| REL-05 | 101-01 | Coalición evaluada empíricamente, ingesta dos-etapas si viable / DIFERIDA documentada, jamás inferida desde votos | ✓ SATISFIED | Truth 4; audit §5 Servel VIABLE / comités DIFERIDA; regla LOCKED explícita. |

No orphaned requirements: REQUIREMENTS.md maps REL-01..05 to Phase 101, all declared across the three plans, all satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Debt markers (TBD/FIXME/XXX) in modified files | ℹ️ Info | NONE — grep of all 6 modified files returned zero markers. |
| `page.tsx` (ficha) | 257-260 | IN-01: comment claims Suspense makes reader failures non-fatal (contradicts WR-04 JSDoc) | ℹ️ Info | Comment-only inconsistency; runtime behavior is the correct #34 throw-to-error-boundary. Non-blocking (carried info from REVIEW). |
| `lockdown-guard.test.ts` | 43 | IN-02: anchors on process.cwd() vs sibling's import.meta.dirname | ℹ️ Info | Loud sanity assertions keep it non-exploitable; non-blocking. |
| `comparar/page.tsx` | 483-490 | IN-06: listaCompleta checks CAP_RPC before total_n (latent if a future migration lowers LIMIT) | ℹ️ Info | Today all caps = 20; no live defect. Non-blocking. |

All findings are Info-level (0 Critical, 0 Warning) — consistent with 101-REVIEW.md status `clean` after the iteration-3 fix loop. None block the goal.

### Human Verification Required

The following are deploy-dependent visual/flow checks, explicitly out of scope for this phase's automated verification (orchestrator BrowserOS gate / Phase 104 E2E covers deploy). The code-level truths all hold, so these are NOT gaps.

1. **Bloque relaciones above-the-fold (deploy + BrowserOS)** — verify the 5-block grid renders above-the-fold in `<section id=relaciones>` with no mt-12 double-spacing/collapse (CSS cascade only observable in real deploy).
2. **/comparar A/B con parlamentarios reales (deploy + BrowserOS)** — verify the 4 ejes render intersections; two diputados → "no comparten zona"; two senadores same circ → zona shows.
3. **CTA "Comparar con otro parlamentario"** — verify the ficha CTA pre-fills slot A in `/comparar?a=${id}`.

### Gaps Summary

None. Every observable truth (13/13), all 9 artifacts, all 5 key links, both data-flow traces, the pgTAP probe (9/9), the full suite (1303/99), and tsc -b (exit 0) are VERIFIED against the current code state and PROD. All 5 requirements (REL-01..05) are satisfied. The code-review fix loop (CR-01..03, WR-01..06) is confirmed landed in current code (commits abc1f04..1681148), and 101-REVIEW.md is `clean`. Anti-insinuación discipline is intact: order by nombre (alphabetical, never total_n), net-new copy scoped "fuera del partido vigente", error-throws over false-empty, provenance per datum, coalición never inferred from votes, lobby DIFERIDA on unresolved identity.

Status is `human_needed` (not `passed`) solely because three deploy-dependent visual/flow checks remain — these are the orchestrator's BrowserOS gate over the real deploy, not code-level gaps.

---

_Verified: 2026-07-24T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
