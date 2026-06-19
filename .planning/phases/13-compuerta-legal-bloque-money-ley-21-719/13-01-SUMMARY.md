---
phase: 13-compuerta-legal-bloque-money-ley-21-719
plan: 01
subsystem: gate-exposicion-money
tags: [legal, gate, rls, feature-flag, server-only, pgtap, ley-21719]
requires:
  - "supabase/tests/0018_piso_pii.test.sql (tabla-exemplar pii_contraparte_declaracion)"
  - "app/lib/supabase.ts (patrón server-only, sin NEXT_PUBLIC_)"
  - "packages/llm/src/config.ts (patrón env inyectado, testeable)"
provides:
  - "app/lib/money-gate.ts — moneyPublicEnabled(env): candado B, fail-closed default false"
  - "supabase/tests/0023_money_gate.test.sql — contrato deny-by-default que money_* de 14-16 hereda"
  - ".env.example — contrato de MONEY_PUBLIC_ENABLED (default OFF)"
affects:
  - "Phases 14-16 (MONEY): consumen el flag server-side + heredan el contrato RLS deny-by-default"
tech-stack:
  added: []
  patterns:
    - "Server-only feature flag con env inyectado (espejo supabase.ts + config.ts)"
    - "pgTAP de contrato (re-afirma invariante del piso sin DDL nuevo)"
key-files:
  created:
    - app/lib/money-gate.ts
    - app/lib/money-gate.test.ts
    - supabase/tests/0023_money_gate.test.sql
  modified:
    - .env.example
decisions:
  - "Flag ubicado en app/lib/ (consumidor declarado = ficha Next.js server-side), no en packages/core"
  - "Sin canal Postgres (app.settings.money_public_enabled) — diferido a 14-16 si un RPC consulta el flag (Open Question 3)"
  - "Phase 13 NO introduce DDL MONEY; el pgTAP re-afirma el piso sobre la tabla-exemplar pii_contraparte_declaracion"
metrics:
  duration: ~12min
  tasks_completed: 2_of_3
  completed: 2026-06-19
---

# Phase 13 Plan 01: Gate de exposición MONEY (Ley 21.719) Summary

Doble candado de exposición MONEY construido y verificado localmente, apagado: flag server-only `moneyPublicEnabled` fail-closed (default `false`, solo `"true"` literal lo enciende, sin `NEXT_PUBLIC_`) + pgTAP que codifica el contrato deny-by-default (RLS + cero policies + `anon` sin grant SELECT) que toda tabla `money_*` de Phases 14-16 heredará.

## What Was Built

### Task 1 — Candado B: flag server-only + Vitest (TDD)
- **`app/lib/money-gate.ts`**: `moneyPublicEnabled(env = process.env): boolean` que devuelve `env.MONEY_PUBLIC_ENABLED === "true"` y nada más. `import "server-only"` en línea 1 (espejo de `app/lib/supabase.ts:1`); la var NO lleva prefijo `NEXT_PUBLIC_`. Fail-closed: la ausencia ES el default seguro (OFF), NO lanza (a diferencia de `supabase.ts`). `env` inyectado por defecto `process.env` (espejo de `loadRouterConfigFromEnv`) para testeo sin runtime. Comentario de cabecera documenta que encender requiere `signoff: approved` (deuda F13).
- **`app/lib/money-gate.test.ts`**: Vitest con los 5 casos del bloque `<behavior>`: `{}`→false, `"false"`→false, `"1"`→false, `"TRUE"`→false (case-sensitive), `"true"`→true. Estilo de `packages/llm/src/config.test.ts`.
- **TDD:** RED (`test(13-01)` commit `78f0dd0`, test falla por módulo ausente) → GREEN (`feat(13-01)` commit `c4fbd4a`, 5/5 verde). REFACTOR no necesario (módulo minimal).

### Task 2 — `.env.example` + pgTAP de contrato del piso
- **`.env.example`**: bloque documentado `# --- Gate de exposicion MONEY (Ley 21.719, Phase 13) ---` con el contrato (default OFF; server-only leído por `app/lib/money-gate.ts`; nunca `NEXT_PUBLIC_`; no es secreto sino booleano de feature; encender depende de `signoff: approved`) + línea `MONEY_PUBLIC_ENABLED=false`. Sin canal Postgres (diferido).
- **`supabase/tests/0023_money_gate.test.sql`**: pgTAP `plan(3)` que re-afirma el piso deny-by-default sobre `pii_contraparte_declaracion` (tabla-exemplar de 0018, NO tabla MONEY nueva): (1) `relrowsecurity = true`, (2) `is_empty(pg_policy...)`, (3) `anon` con 0 grants SELECT en `role_table_grants`. Header copia la advertencia Pitfall 4 (solo pgTAP contra schema aplicado vale; build/typecheck dan falso positivo) y documenta el contrato que `money_*` de 14-16 hereda.

## Pending Operator Action (Task 3 — checkpoint:human-action, gate=blocking)

**NO ejecutado por el agente — acción de operador, NO auto-aprobado.** Tarea queda SIN marcar en el plan.

El pgTAP `0023_money_gate.test.sql` debe correrse contra el **schema remoto aplicado** (Supabase sa-east-1):

1. Extraer `SUPABASE_DB_URL` esquivando el BOM UTF-8 (U+FEFF) con el helper de extracción ya usado en Phases 9-12 (NO re-tipear el regex con el carácter literal).
2. `supabase test db --db-url "<URL_EXTRAIDA>"`
3. Confirmar que `0023` pasa (3/3 verdes) junto al resto de la suite pgTAP existente (0018/0021/0022 siguen verdes — el piso no se rompió).

**Phase 13 NO añade migración nueva** → NO hay `db push` que correr, solo el test pgTAP contra el schema ya aplicado.

**Resume-signal:** escribir "pgTAP verde" (con el conteo) o pegar el error si alguna aserción falla.

## Local Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Flag default false / fail-closed | `cd app && pnpm vitest run lib/money-gate.test.ts` | ✅ 5/5 passed |
| `import "server-only"` en línea 1 | `head -1 app/lib/money-gate.ts` | ✅ `import "server-only";` |
| Comparación exacta `=== "true"` | `grep 'MONEY_PUBLIC_ENABLED.*===.*"true"'` | ✅ línea 27 |
| `.env.example` MONEY_PUBLIC_ENABLED=false (no comentario) | `grep -v '^#' .env.example \| grep -c 'MONEY_PUBLIC_ENABLED=false'` | ✅ 1 |
| pgTAP patrones presentes | `grep -E "relrowsecurity\|is_empty\|role_table_grants"` | ✅ los 3 |
| `plan(N)` == nº aserciones | `grep 'select plan'` vs aserciones top-level | ✅ `plan(3)` == 3 |
| Sin `NEXT_PUBLIC_MONEY` | `grep -rn "NEXT_PUBLIC_MONEY" app/ .env.example` | ✅ 0 resultados |
| Sin BOM / unicode invisible | `od -An -tx1` + `grep -P '\x{FEFF}\|\x{200B}\|\x{00A0}'` | ✅ ninguno en los 4 archivos |

**[OPERADOR — pendiente]** `supabase test db --db-url <url>` → `0023` + suite pgTAP verdes contra el remoto aplicado.

## Deviations from Plan

None — el plan se ejecutó exactamente como está escrito. Task 3 (checkpoint:human-action, gate=blocking) se deja como acción de operador pendiente per instrucción explícita; las dos tareas autónomas se completaron y verificaron localmente.

## Known Stubs

None. El flag es lógica pura completa; el pgTAP afirma sobre una tabla real existente. El campo `signoff: pending` del dossier (13-02) y el encendido real del flag son acciones de operador documentadas (deuda F13), no stubs de código.

## Commits

- `78f0dd0` test(13-01): add failing test for MONEY_PUBLIC_ENABLED gate (RED)
- `c4fbd4a` feat(13-01): implement MONEY_PUBLIC_ENABLED server-only gate (candado B) (GREEN)
- `0acd0f9` feat(13-01): document MONEY_PUBLIC_ENABLED + pgTAP contrato del piso

## TDD Gate Compliance

Task 1 (`tdd="true"`): RED commit (`test(13-01)` `78f0dd0`, test falla por import no resuelto) precede a GREEN commit (`feat(13-01)` `c4fbd4a`, 5/5 verde). Gate sequence cumplida.

## Self-Check: PASSED

- Archivos creados verificados en disco: `app/lib/money-gate.ts`, `app/lib/money-gate.test.ts`, `supabase/tests/0023_money_gate.test.sql`, `13-01-SUMMARY.md`.
- Commits verificados en git log: `78f0dd0`, `c4fbd4a`, `0acd0f9`.
