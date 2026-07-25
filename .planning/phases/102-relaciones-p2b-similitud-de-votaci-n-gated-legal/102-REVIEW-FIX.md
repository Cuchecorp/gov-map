---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
fixed_at: 2026-07-24T23:35:00Z
review_path: .planning/phases/102-relaciones-p2b-similitud-de-votaci-n-gated-legal/102-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 7
skipped: 1
tests_passed: true
test_command: "pnpm --filter app test -- --run && pnpm --filter app exec tsc -b"
status: all_fixed
---

# Phase 102: Code Review Fix Report

**Fixed at:** 2026-07-24
**Source review:** 102-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01 + WR-01..04) + 2 adjacentes triviales (IN-01, IN-03)
- Fixed: 7 (CR-01, WR-01, WR-02, WR-03, WR-04, IN-01, IN-03)
- Skipped: 1 (IN-02 — fuera de alcance, no trivialmente adyacente)
- Test gate: PASSED (`pnpm --filter app test -- --run` 1354/1354 en 102 archivos + `tsc -b` exit 0)
- pgTAP 0068 vs PROD APLICADO: **14/14 verde** (re-apply vía `psql --single-transaction`)

## Test Gate

- PASSED — `pnpm --filter app test -- --run` → 102 files / 1354 tests verdes; `pnpm --filter app exec tsc -b` → exit 0 sin errores.
- Nota: en la PRIMERA corrida (worktree frío en C:\Temp) dos guards (`vsim-antiflip-guard`, `money-antiflip-guard`) excedieron el timeout de 5s del walk de `packages/` (disco frío/antivirus). Re-corridos en caliente: 74 ms cada uno. Flake de entorno, NO regresión (ningún fix tocó esos archivos).
- pgTAP: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0068_coincidencia_votos_par.test.sql` → `1..14`, todo ok, rollback limpio.

## Fixed Issues

### CR-01: leyenda /red aún anunciaba "misma votación" (violación VSIM-03)

**Files modified:** `app/components/red/red-graph.tsx`
**Commit:** b1f69cb
**Applied fix:** Paso 4 de la leyenda ahora dice solo "(audiencia de la misma contraparte de lobby)" y la línea de fuente quedó "Fuente: Ley del Lobby (Ley 20.730) · datos ingestados por este observatorio." — alineado con el CHECK de 0030 (solo `co_lobby_contraparte`). Grep confirmó cero otras menciones renderizadas de voto en `/red`; ningún test asertaba el copy viejo.
**Deuda operador:** re-correr la lectura fría del dossier (§3/§8 citan la exclusión /red como completa; ahora vuelve a ser verdad, pero el claim de cold-read debe re-validarse en vivo tras el próximo deploy).

### WR-01: 0068 inflaba N y M ante votos confirmados duplicados por (votación, parlamentario)

**Files modified:** `supabase/migrations/0068_coincidencia_votos_par.sql`, `supabase/tests/0068_coincidencia_votos_par.test.sql`
**Commit:** 45077b2
**Applied fix:** Cada CTE agrupa por `votacion_id` con `having count(distinct seleccion) = 1` + `min(seleccion)`: duplicado concordante colapsa a 1 fila; selecciones en conflicto excluyen la votación de N y M (determinista, jamás pick al azar). pgTAP plan 10→13 con fixtures de duplicado concordante (m/n no inflan) y contradictorio (votación excluida de N, M y fecha_captura_max). **Re-aplicada a PROD** (`--single-transaction`, DROP/CREATE/REVOKE×2 ok) y pgTAP verde contra el schema aplicado.

### WR-02: eje comisiones declaraba ausencia desde listas cap-eadas a 50 (sin disciplina CR-01)

**Files modified:** `app/app/comparar/page.tsx`, `app/app/comparar/page.test.tsx`
**Commit:** 818abc3
**Applied fix:** Nueva `CAP_RPC_COMISIONES = 50` + `comisionesCompletas` (AMBAS listas bajo el cap — aquí una dirección completa no basta: la comisión compartida puede caer fuera del cap de cualquiera). Al cap sin match → `InterseccionIndeterminada` (limitación declarada) + nota "Lista posiblemente truncada" en las columnas. Comentario CAP_RPC corregido (limit 20 = 0061/0067; comisiones = limit 50 en 0064, verificado en el SQL). RTL: describe (9b) con 2 casos (50 filas sin match → indeterminado; listas cortas → ausencia se mantiene).

### WR-03: guards de /red ciegos a la prosa renderizada (el agujero del CR-01)

**Files modified:** `app/components/co-votacion-red-guard.test.ts`
**Commit:** cbe00f7
**Applied fix:** Nuevo detector `tieneProsaVotoEnCodigo` — escanea el código post-strip de comentarios (strings/JSX incluidos) de `RED_DIRS` con `/votaci|\bvota\b|\bvotan\b|\bvotar\b|\bvotaron\b|\bvoto\b|\bvotos\b|votó/i`. Test de guard + 5 mutation self-checks: muerde sobre el copy exacto del CR-01 ("misma votación", "votaciones de sala", "votan"/"votaron"), NO reporta comentarios de documentación ni subcadenas inocentes ("pivota"). Baseline verificado limpio tras CR-01 (solo comentarios quedan en /red).

### WR-04: aserción de figura neutral solo miraba 120 chars ANTES de la figura

**Files modified:** `app/app/comparar/page.test.tsx`
**Commit:** e12fa1d
**Applied fix:** La aserción ahora localiza el `<p>…</p>` que contiene "Coinciden en 3 de 4" (lastIndexOf `<p` / indexOf `</p>`) y aserta cero `text-accent-product`/`font-semibold` sobre el párrafo COMPLETO — un span de acento envolviendo el "75%" ya no pasa.

### IN-01 (adyacente trivial): guard p_a <> p_b en 0068

**Files modified:** `supabase/migrations/0068_coincidencia_votos_par.sql`, `supabase/tests/0068_coincidencia_votos_par.test.sql`
**Commit:** 426fd94
**Applied fix:** `and p_a <> p_b` en el CTE `a` → self-pair devuelve `(0, 0, null)` (el estado M=0 honesto del UI), nunca el 100% trivial. pgTAP plan 13→14 con assert del self-pair. Incluido en el re-apply a PROD.

### IN-03 (adyacente trivial): dossier §3/§5 alineado con el guard y el denylist reales

**Files modified:** `docs/legal/102-LEGAL-DOSSIER-VSIM.md`
**Commit:** 75c402a
**Applied fix:** §5 cita los términos VERBATIM de `TERMINOS_PROHIBIDOS` ("afín", "cercano a", "bloque de"…), declarando explícito que "cercano" suelto NO está cubierto; §3 "verifica en diff" → "escaneo estático PERMANENTE del árbol completo" + menciona el tripwire de prosa (WR-03); pgTAP 10/10 → 14/14.

## Skipped Issues

### IN-02: componente renders "({pct}%)" sin guard de pct === null cuando m > 0

**File:** `app/components/similitud-votacion-comparar.tsx:119-121`
**Reason:** fuera del alcance (Info no trivialmente adyacente a otro fix; requiere decisión de contrato de props — discriminated union vs fallback — mejor con criterio del operador).
**Original issue:** el contrato de props permite `{ m: 4, pct: null }` y renderizaría "(%)"; imposible desde el caller actual (pct derivado de m), pero el tipo invita drift.

---

_Fixed: 2026-07-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
