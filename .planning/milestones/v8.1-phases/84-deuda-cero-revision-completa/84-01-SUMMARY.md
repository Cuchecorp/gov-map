---
phase: 84
plan: "01"
subsystem: frontend/tests
tags: [deuda-tecnica, WCAG, tailwind-v4, guards, DEMO-03]
dependency_graph:
  requires: []
  provides: [DEMO-03]
  affects: [app/components, app/lib, app/app]
tech_stack:
  added: []
  patterns: [wcag-luminance-unit-test, source-scan-guard, bare-var-migration]
key_files:
  created:
    - app/lib/civic-contrast.test.ts
  modified:
    - app/components/camara-chip.tsx
    - app/components/provenance-badge.tsx
    - app/components/aportes-por-contraparte.tsx
    - app/components/contratos-de-parlamentario.tsx
    - app/components/contratos-por-contraparte.tsx
    - app/components/financiamiento-de-parlamentario.tsx
    - app/components/voto-detalle.tsx
    - app/components/votos-por-parlamentario.tsx
    - app/lib/bento-guards.test.ts
    - app/app/layout.tsx
    - app/app/page.test.tsx
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "D2 fix mecánico (-[--var] → -[var(--var)]) en 8 componentes: menor diff/riesgo vs @theme inline"
  - "Guard repo-wide via walkTsx recursivo (readdirSync) en vez de globSync (no en TS target ES2017)"
  - "D4 /red documentado-con-razón: island pixel-LOCKED + gate 75 aprobado + re-layout = v9"
metrics:
  duration: "~35 min"
  completed: "2026-07-15"
  tasks: 4
  files: 12
---

# Phase 84 Plan 01: DEUDA-CERO — Revisión completa + eliminación de deuda

**One-liner:** Migrar 14 usos `-[--var]` a `-[var(--var)]` en 8 componentes públicos + test WCAG dark 5.63/4.80:1 + guard repo-wide cero-bare-var-shorthand + IN-01/02/03 cerrados.

## Inventario → Disposición → Estado

| # | Ítem | Disposición | Estado |
|---|------|-------------|--------|
| D1 | Contraste barra cívica dark sin test WCAG | cerrar-ahora → test | **CERRADO** — `civic-contrast.test.ts` 5 tests (Cámara 5.63:1 / Senado 4.80:1 ≥ 3:1) |
| D2 | `-[--var]` shorthand en 8 componentes (defecto CSS real en vivo) | cerrar-ahora | **CERRADO** — 14 usos migrados; guard III repo-wide en `bento-guards.test.ts` con mutation self-check (95 tests) |
| D3 | IN-01 padding footer divergente (<md) | cerrar-ahora | **CERRADO** — footer `px-4 md:px-8` → `px-6` (igual que header) |
| D4 | Deuda P3 /red: curvas seed-card | documentar-con-razón | **DOCUMENTADO** — ver sección abajo |
| D5 | Typography island `.net-*` | YA resuelto en Phase 75 | **CONSTATADO** — swap pixel-idéntico; gate visual = operador |
| D6 | UAT rotate /red | operador | **LISTADO** — gate visual real-deploy (`getComputedStyle`) |
| D7 | CLOUDFLARE_API_TOKEN + ACCOUNT_ID faltantes en GH | operador | **LISTADO** — dashboard GH settings; YAML ya correcto |
| D8 | Rotar DB password B26 | operador | **LISTADO** — Supabase dashboard; blast radius = solo `SUPABASE_DB_URL` |
| D9 | Gates v7.0 (RUT-01, flip MONEY, backfills, applies 0052-0054) | operador/legal OUT OF SCOPE | **LISTADO** |
| D10 | cursor leylobby / lobby `--from-r2` / source_snapshot | Phase 83 (DEMO-02) | **NO DUPLICADO** |
| D11 | Guard tipografía WR-01/02/03 falsos negativos | YA resuelto en Phase 80 | **CONSTATADO** — 80-REVIEW-FIX commit 35d0730, 27/27 |
| D12 | TODOs/FIXMEs/HACKs en `app/` y `packages/` | CERO reales | **CONSTATADO** — grep confirmó: "TODO" es español, `@ts-expect-error` son gates intencionales |
| D13 | IN-02 collapse regex col-span + IN-03 negación exact-string | cerrar-ahora selectivo | **CERRADO** — IN-02 tokenizar whitespace en `page.test.tsx`; IN-03 normalizar en `anti-insinuacion-guard.test.ts` |

## Deuda documentada con razón

### D4 — Deuda P3 /red: curvas juntas en esquina de seed-card

**Razón para NO cerrar:**
1. **Invariante v8.0 explícito:** "island `/red` pixel-intocable" (audit línea 69).
2. **Gate 75 cerrado + operador-aprobado** ("aprobado", memoria 2026-07-13); UAT rotate = operador.
3. **Fix real = re-layout** de la geometría del island (ajustar `pad` o repartir sobre altura del contenedor), no un tweak trivial. Cae bajo "re-layout → v9" (OUT OF SCOPE) y bajo la regla "cerrar-ahora exige S/M-riesgo-bajo".
4. **Esfuerzo M-L / riesgo Alto** — no califica para DEMO-03.

**Registro para v9:** reabrir cuando el island `/red` entre en re-layout; ajustar `pad=18` en `red-graph.tsx:392` o escalar dinámicamente sobre la altura del contenedor.

## Deuda de operador (sin cambio de código)

- **D6 — UAT rotate /red:** gate visual con `getComputedStyle` en deploy real; operador.
- **D7 — CLOUDFLARE_API_TOKEN / ACCOUNT_ID:** secrets faltantes en GH settings; YAML correcto; operador.
- **D8 — Rotar DB password B26:** Supabase dashboard; `SUPABASE_DB_URL`; 0 workflows afectados; operador.
- **D9 — Gates v7.0:** RUT-01 write, flip MONEY, backfills, applies 0052-0054 — OUT OF SCOPE v8.1 (operador/legal).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsc ES2017: `s` flag regex y `globSync` no disponibles**
- **Found during:** Commit D2/D1 — tsc --noEmit reveló 3 errores de compatibilidad.
- **Fix:** (a) Reemplazar `/regex/s` por `/[\s\S]+?/` en `civic-contrast.test.ts`. (b) Reemplazar `globSync` (no en TS target ES2017) por helper recursivo `walkTsx` con `readdirSync`/`statSync` en `bento-guards.test.ts`.
- **Commit:** 2423ef7

## Suite final

- `app`: **991/991** (baseline 918 + 73 nuevos)
- `tsc --noEmit`: **0 errores**
- Phases paralelas 83 respetadas: ningún archivo de `packages/probidad`, `packages/lobby`, `.github/workflows`, `docs/crons.md` tocado.

## Self-Check: PASSED

- `app/lib/civic-contrast.test.ts`: existe y tiene 5 tests verdes
- `app/lib/bento-guards.test.ts`: Guard III repo-wide presente, 95 tests verdes
- Commits: a75ff1b (D1), a44a605 (D2), ad53539 (D3), d70694d (D13), 2423ef7 (tsc fix)
