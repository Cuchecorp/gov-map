---
phase: 131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento
plan: 02
subsystem: parlamentarios-comparar
tags: [rpc, postgres, security-definer, comparar, coautoria, debt-04]
dependency-graph:
  requires:
    - "supabase/migrations/0064_bounded_rpc_statement_timeout.sql (coautores_de_parlamentario viva, cuerpo fuente del copy verbatim)"
    - "supabase/migrations/0060_bio_partido_publico.sql (precedente de firma v2 paralela)"
    - "supabase/migrations/0079_limit_explicito_rpcs.sql (formato de tabla de techo derivado + criterio 4x/piso 1000)"
  provides:
    - "supabase/migrations/0083_coautoria_v2.sql — coautores_de_parlamentario_v2(text), ESCRITA, NO aplicada"
    - "supabase/tests/0083_coautoria_v2.test.sql — pgTAP contra schema aplicado, NO ejecutado en este plan"
    - "CAP_RPC_COAUTORES=1000 en app/app/comparar/page.tsx"
  affects:
    - "app/app/comparar/page.tsx (eje de co-autoría migra de canal)"
    - "app/lib/lockdown-guard.test.ts (PUBLIC_RPC_ALLOWLIST +1 entrada)"
tech-stack:
  added: []
  patterns:
    - "Firma v2 paralela (precedente 0060): jamás alterar returns table de una RPC viva (42P13 re-arma default privileges)"
    - "Cap por eje como parámetro con default, NUNCA constante global compartida entre ejes distintos"
key-files:
  created:
    - supabase/migrations/0083_coautoria_v2.sql
    - supabase/tests/0083_coautoria_v2.test.sql
  modified:
    - app/lib/lockdown-guard.test.ts
    - app/app/comparar/page.tsx
    - app/app/comparar/page.test.tsx
decisions:
  - "Numeración de migración: 0083 (0080/0081 tomadas por Phase 127, 0082 reclamada por Phase 130 en paralelo, por instrucción explícita del prompt de ejecución)"
  - "CAP_RPC (militancia, 20) NUNCA se toca — CAP_RPC_COAUTORES (1000) es una constante separada consumida SOLO por el eje de co-autoría"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 131 Plan 02: Co-autoría sin truncamiento (RPC v2 + /comparar) Summary

RPC `coautores_de_parlamentario_v2` (firma paralela, precedente 0060) con `limit 1000`
reemplaza el consumo en `/comparar` para el eje de co-autoría, cerrando el truncamiento
silencioso a 20 (DEBT-04) sin tocar la RPC viva ni el eje de militancia histórica.

## Migración elegida

**Número: `0083`** (`supabase/migrations/0083_coautoria_v2.sql`). Al momento de escribir,
`ls supabase/migrations | sort | tail` mostraba `0080_actualidad_evidencia.sql` y
`0081_actualidad_evidencia_fix.sql` como últimas aplicadas/reservadas (Phase 127); la Phase 130
(en worktree paralelo) reclama `0082`. Por instrucción explícita del prompt de ejecución de este
plan se usó `0083`. **131-03 debe re-verificar este número al aplicar** (las migraciones se
aplican desde `master`, jamás desde el worktree; si hubo colisión al mergear, renombrar antes
de aplicar).

## Lo construido

**Task 1 — Migración v2 + pgTAP:**
- `supabase/migrations/0083_coautoria_v2.sql`: `coautores_de_parlamentario_v2(text)`, cuerpo
  VERBATIM del de la viva (`0064:263-287`) con el único cambio `limit 20` → `limit 1000`
  (verificado por diff normalizado en el verify automatizado del plan — exit 0, cero drift
  semántico). Aguja completa: `security definer`, `search_path=''`, `statement_timeout='5s'`,
  doble-revoke. Cero grant, cero cron, cero DML. Techo derivado: máximo real medido 101
  coautores sobre el dominio completo (180 parlamentarios, 100%) ⇒ `4×101=404 < 1000` ⇒
  techo = 1000 (el piso de 0079), margen 9.9x.
- `supabase/tests/0083_coautoria_v2.test.sql`: 12 asserts pgTAP — existencia, secdef, stable,
  proconfig (search_path/statement_timeout), firma de retorno PAREADA con la viva, la viva
  intacta (`limit 20` conservado), la v2 con `limit 1000`, cero-grant efectivo (anon), PII-safe
  (sin rut/donante_id), control de contenido positivo (>20 filas para D1178).
- **NO se aplicó la migración** (131-03 la aplica y corre el pgTAP contra PROD).

**Task 2 — Allowlist + consumo en `/comparar`:**
- `app/lib/lockdown-guard.test.ts`: `coautores_de_parlamentario_v2` añadida al
  `PUBLIC_RPC_ALLOWLIST` en su posición alfabética, inmediatamente tras la vieja (que se
  mantiene — sigue consumida por `/parlamentario/[id]`, molde WR-01).
- `app/app/comparar/page.tsx`:
  - Nueva constante `CAP_RPC_COAUTORES = 1000`, separada de `CAP_RPC = 20` (militancia,
    intacto — verificado explícitamente por el verify automatizado que falla si `CAP_RPC`
    cambia de valor).
  - `listaCompleta(filas, cap = CAP_RPC)` e `interseccionPar(listaA, idB, listaB, idA, cap =
    CAP_RPC)` parametrizados; el eje de militancia usa el default (byte-equivalente en
    comportamiento a antes de esta fase).
  - `getCoautores` migra el call-site a `coautores_de_parlamentario_v2`.
  - Eje de co-autoría pasa `CAP_RPC_COAUTORES` explícitamente; su copy de indeterminación
    cita `${CAP_RPC_COAUTORES}` en vez de `${CAP_RPC}`.
  - Comentario de bloque actualizado describiendo los TRES caps distintos y por qué no se
    unifican.

**Task 3 — Testigo D1178 × D1099 (TDD):**
- Los 4 mocks de RPC existentes en `app/app/comparar/page.test.tsx` actualizados al nombre
  `coautores_de_parlamentario_v2` (verificado: cero mocks stale del nombre viejo, `grep -c` = 0).
- Nuevo `describe` con 3 tests:
  1. Testigo real (`D1178` × `D1099`, 92 boletines co-firmados, listas de 91/82 co-autores
     generadas programáticamente): el render declara "Comparten 92 proyectos co-firmados",
     NO la frase de indeterminación.
  2. Regresión del defecto: listas al cap de 1000 (no 20 — el cap efectivo del eje ahora es
     1000) sin match y `total_n` > 1000 → el copy sigue indeterminado pero cita **1000**, no 20.
  3. Control apareado anti-Pitfall-1: militancia con listas de 20 filas y `total_n=40` sin
     match → sigue **indeterminada** (nunca "ausente") — guard vivo: si alguien subiera
     `CAP_RPC` a 1000 por error, este test se pone rojo.

## Verificación

- `pnpm --filter ./app exec vitest run lib/lockdown-guard.test.ts lib/anti-insinuacion-guard.test.ts` → 86 passed
- `pnpm --filter ./app exec vitest run app/comparar/page.test.tsx` → 33 passed
- `pnpm --filter ./app exec vitest run "app/comparar/page.test.tsx" components/relaciones-eje-comparar.test.tsx lib/lockdown-guard.test.ts lib/anti-insinuacion-guard.test.ts` → 119 passed
- `pnpm --filter ./app exec tsc --noEmit` → limpio (ambas veces)
- Diff verbatim (migración v2 vs 0064, normalizado) → exit 0
- `git diff --stat -- package.json pnpm-lock.yaml app/package.json` → vacío
- `supabase/migrations/0064_*.sql` y `app/app/parlamentario/[id]/page.tsx` → sin cambios (verificado por diff)

**W-7 (checker):** la suite completa de `app/` NO se corrió en este plan por diseño (wave 1
paralela con 131-01 editando fixtures/tests del timeline en el mismo worktree pool) — solo se
corrieron por NOMBRE los archivos tocados/relevantes. La suite entera corre en 131-03 Task 3.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixture de test con formato de línea no-verbatim al cuerpo real de 0064**

- **Encontrado durante:** Task 1, al validar manualmente el verify de diff verbatim antes de
  confiar en el plan.
- **Problema:** El bloque de código mostrado en `<interfaces>` del plan (líneas 84-113 del
  PLAN.md) reformatea el `coalesce(...)` a una sola línea envuelta; el archivo real
  `0064_bounded_rpc_statement_timeout.sql` lo tiene en 3 líneas. Copiar literalmente el bloque
  del plan habría hecho fallar el verify automatizado de diff verbatim (línea 212 del plan).
- **Fix:** Se copió el cuerpo VERBATIM línea-por-línea desde el archivo real `0064:263-287`
  (no desde el bloque re-formateado del PLAN.md), preservando el multi-línea del `coalesce`.
  Diff normalizado confirmado en exit 0.
- **Archivos:** `supabase/migrations/0083_coautoria_v2.sql`.
- **Commit:** `e4d515a`.

**2. [Rule 1 - Bug] Fixture de test de "regresión del defecto" usaba longitud de lista incorrecta**

- **Encontrado durante:** Task 3, al correr el test recién escrito.
- **Problema:** El primer intento del test de regresión usaba una lista de 20 filas (el cap
  viejo) con `total_n=25` para simular truncamiento. Bajo la NUEVA disciplina, `listaCompleta`
  compara contra `CAP_RPC_COAUTORES=1000`, así que una lista de 20 filas está muy por debajo
  del cap real y se considera COMPLETA — el test falló porque el render declaraba "ausente",
  no "indeterminado" (el comportamiento es correcto; el fixture del test estaba mal construido).
- **Fix:** La lista de regresión se generó con 1000 filas (el cap real del eje) y
  `total_n=1005`, reproduciendo un truncamiento genuino bajo la disciplina de 1000.
- **Archivos:** `app/app/comparar/page.test.tsx`.
- **Commit:** `6800ee1`.

## Known Stubs

Ninguno — el eje de co-autoría queda completamente wireado a la v2; no hay placeholders ni
datos mock en producción.

## Threat Flags

Ninguno — toda la superficie nueva (RPC v2, allowlist) está cubierta por el `<threat_model>`
del plan (T-131-05 a T-131-10), sin superficie adicional no declarada.
