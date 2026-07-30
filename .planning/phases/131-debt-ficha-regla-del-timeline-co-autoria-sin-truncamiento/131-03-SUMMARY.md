---
phase: 131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento
plan: 03
subsystem: postgres-prod-gate
tags: [migration, pgtap, prod-apply, coautoria, timeline, debt-03, debt-04]
dependency-graph:
  requires:
    - "supabase/migrations/0083_coautoria_v2.sql (131-02, ESCRITA pero no aplicada)"
    - "supabase/tests/0083_coautoria_v2.test.sql (131-02)"
    - "supabase/queries/timeline-regla-de-seleccion.sql (131-01)"
  provides:
    - "coautores_de_parlamentario_v2 APLICADA y viva en PROD"
    - ".planning/phases/131-.../131-EVIDENCIA-APLICACION.md — evidencia verificable de aplicación + gate de fase"
  affects:
    - "app/app/comparar (eje de co-autoría ahora consume una RPC real en PROD, no solo código)"
    - "REQUIREMENTS.md (DEBT-03, DEBT-04 cerrados)"
    - "ROADMAP.md (Phase 131 marcada Complete, 3/3)"
tech-stack:
  added: []
  patterns:
    - "Control previo/posterior pg_proc 1→2 como prueba de aplicación real (no confiar en existencia de archivo)"
    - "Recálculo SQL independiente como oráculo para validar el conteo mostrado por una RPC"
key-files:
  created:
    - .planning/phases/131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento/131-EVIDENCIA-APLICACION.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
decisions:
  - "Migración 0083 aplicada sin colisión ni renombre — 131-02 ya había resuelto la numeración correctamente (0080/0081 Phase 127, 0082 Phase 130, 0083 libre)."
metrics:
  duration: "~40 min"
  completed: "2026-07-30"
---

# Phase 131 Plan 03: Aplicación a PROD + verificación con evidencia Summary

Migración `0083_coautoria_v2.sql` aplicada a PROD con `--single-transaction` (viva+v2 conviven,
pgTAP 12/12 verde), testigo D1178×D1099 recalculado independientemente e igualado 92==92 por la
RPC v2 en ambas direcciones, control apareado confirma que la RPC vieja daba 0 para ese par (defecto
real, no vacuo), y la regla del timeline (H-06) se reprodujo contra PROD tras el merge —
cerrando DEBT-03 y DEBT-04 con evidencia verbatim, no declarativa.

## Lo hecho

**Task 1 — Aplicación + pgTAP:**
- Verificado en base (`ls supabase/migrations | sort`): `0083_coautoria_v2.sql` es el último
  archivo, sin colisión ni hueco — 131-02 ya había resuelto la numeración correctamente.
- Control previo: `pg_proc` con `proname like 'coautores_de_parlamentario%'` = **1** (solo la viva).
- Aplicada con `psql -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/0083_coautoria_v2.sql`
  → `DROP FUNCTION` (skip, no existía) → `CREATE FUNCTION` → `REVOKE` ×2.
- Control posterior: mismo query = **2** (viva + v2 conviven).
- pgTAP contra el schema aplicado: **12 `ok`, 0 `not ok`** (existencia, secdef, stable, search_path,
  statement_timeout, firma pareada con la viva, la viva intacta con `limit 20`, la v2 con
  `limit 1000`, anon sin execute, sin PII, >20 filas para D1178).
- `anon` sin `execute` sobre la v2 verificado por separado (no solo el pgTAP).

**Task 2 — Testigo + controles apareados + evidencia:**
- **A** (recálculo independiente sobre `proyecto_autor`) = **92**.
- **B** (RPC v2, ambas direcciones D1178↔D1099) = **92 y 92**. A==B==92 ⇒ D-06 satisfecho.
- **C** (control apareado): RPC vieja para el par = **0**; v2 para el par = **1 fila** — prueba que
  el defecto de truncamiento existía y que la v2 lo cierra, en el mismo par de comandos.
- **D** (vieja sigue funcional): vieja total = **20** (intacta); v2 total = **91** (>20, <1000).
- **E** (techo): máximo real medido hoy sobre 180 parlamentarios = **101** — declarado
  explícitamente como tautológico bajo el `limit 1000` (margen 9.9x), su valor es cazar deriva
  futura, no probar algo nuevo.
- **F** (H-06 tras el merge): `timeline-regla-de-seleccion.sql` sobre `14309-04` da `99|14|5|85`,
  idéntico al fixture congelado por 131-01 — no derivó tras integrar 131-01/02/03.
- Evidencia escrita en `131-EVIDENCIA-APLICACION.md` (169 líneas) con sección "Qué NO prueba esta
  evidencia" (DOM del deploy y render real delegados a Phase 138).

**Task 3 — Gate de fase + ratificación:**
- `pnpm test`: **1630 passed** (108 archivos) — cumple el baseline post-merge.
- `pnpm guards`: **17 archivos de guard** verdes (11 app + 3 dinero + 3 llm).
- `pnpm --filter ./app exec tsc --noEmit`: limpio.
- Bloque de auto-ratificación (precedente 127-03) añadido a la evidencia: los 4 success criteria
  del ROADMAP §Phase 131 sostenidos cada uno con su comando+salida pegada, sin afirmación suelta.
- `ROADMAP.md` §Phase 131 marcada `3/3 Complete`; `REQUIREMENTS.md` marca `DEBT-03` y `DEBT-04`
  como cerrados con puntero a la evidencia.

## Verificación

Todos los `<verify automated>` del plan corrieron y pasaron (control pg_proc 1→2, pgTAP 12/12,
anon sin execute, A==B==92, control apareado 0 vs 1, vieja=20 v2>20<1000, H-06 reproduce
`99|14|5|85`, evidencia ≥40 líneas con sección "Qué NO prueba", `pnpm test`/`pnpm guards`/`tsc`
verdes, ratificación presente).

## Deviations from Plan

Ninguna — el plan se ejecutó tal como estaba escrito. La única nota operativa: el worktree no
tenía `.env` ni `node_modules`; se cargó el secreto de conexión desde la ruta absoluta del `.env`
del repo raíz (jamás ecoado en ningún comando ni log) y se corrió `pnpm install --prefer-offline`
antes del gate de Task 3.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno — toda la superficie (aplicación DDL, verificación de privilegios, evidencia escrita) está
cubierta por el `<threat_model>` del plan (T-131-11 a T-131-16), sin superficie adicional.

## Self-Check: PASSED

- `supabase/migrations/0083_coautoria_v2.sql` — FOUND (pre-existente de 131-02, aplicado en este plan)
- `.planning/phases/131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento/131-EVIDENCIA-APLICACION.md` — FOUND
- Commit `eb1f8e1` (aplicación + evidencia inicial) — FOUND en `git log`
- Commit `0f9efe5` (gate de fase + ratificación + ROADMAP/REQUIREMENTS) — FOUND en `git log`
