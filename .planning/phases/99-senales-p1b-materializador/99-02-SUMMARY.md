---
phase: 99-senales-p1b-materializador
plan: 02
subsystem: database
tags: [postgres, bounded-rpc, security-definer, statement-timeout, lockdown-guard, camino-a, actualidad_senal]

# Dependency graph
requires:
  - phase: 99-01
    provides: "tabla precomputada actualidad_senal (9 columnas del panel) + proc materializador + pg_cron"
  - phase: 95-01 (0064)
    provides: "molde bounded RPC: security definer + set search_path='' + statement_timeout='5s' + LIMIT + drop-before-create + doble-revoke + CERO grant"
  - phase: 42/44 (0044, Camino A)
    provides: "service_role lee el árbol web; PUBLIC_RPC_ALLOWLIST (lockdown-guard Direction-B) es la barrera de superficie"
provides:
  - "RPC bounded PII-safe public.actualidad_senales_panel(p_tipo text default null) — la superficie de lectura del panel de actualidad"
  - "actualidad_senales_panel registrada en PUBLIC_RPC_ALLOWLIST (guard Direction-B verde)"
affects: [phase-100-panel-landing, phase-99-04-apply-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bounded read RPC aguja-completa espejo 0064: security definer + search_path='' + statement_timeout='5s' + LIMIT explícito + drop-before-create (42P13) + doble-revoke + CERO grant"
    - "filtro paramétrico p_tipo (where p_tipo is null or s.tipo_senal = p_tipo) — sin SQL string-building (ASVS V5)"
    - "toda RPC nueva que el árbol web invoca DEBE entrar en PUBLIC_RPC_ALLOWLIST o el guard Direction-B falla (Camino A: service_role puede ejecutar cualquier RPC, la DB ya no bloquea)"

key-files:
  created:
    - "supabase/migrations/0066_actualidad_rpc.sql"
  modified:
    - "app/lib/lockdown-guard.test.ts"

key-decisions:
  - "returns table de la RPC = las 9 columnas de actualidad_senal (0065) VERBATIM: tipo_senal, ventana, conteo int, cobertura_camara, materia, cluster_id int, fecha_max timestamptz, supresion_causa, evidencia jsonb. Cero deriva de nombre/tipo vs el schema real de 0065."
  - "ORDER BY tipo_senal, cobertura_camara nulls last, cluster_id nulls last — orden neutral por nombre/estructura, NUNCA order by conteo (anti-ranking cross-cámara T-52-13). El orden del panel lo pone la RPC, no el proc."
  - "actualidad_senales_panel entra PRIMERA alfabéticamente en PUBLIC_RPC_ALLOWLIST (antes de agregado_por_contraparte)."

patterns-established:
  - "Bounded read RPC sobre tabla precomputada: la tabla ya está materializada (proc + cron) → la RPC es trivialmente sub-5s; statement_timeout='5s' + limit 200 son defensa en profundidad (T-99-07)."

requirements-completed: [SEN-02]

# Metrics
duration: 4min
completed: 2026-07-24
---

# Phase 99 Plan 02: RPC bounded actualidad_senales_panel Summary

**RPC bounded PII-safe `public.actualidad_senales_panel(p_tipo)` — aguja completa espejo 0064 (security definer, search_path='', statement_timeout='5s', LIMIT 200, drop-before-create, doble-revoke, CERO grant) — que lee la tabla precomputada `actualidad_senal` y devuelve las 9 columnas del panel, registrada en `PUBLIC_RPC_ALLOWLIST` para que el guard Direction-B (Camino A) no muerda.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-24T13:56Z (approx)
- **Completed:** 2026-07-24
- **Tasks:** 2
- **Files modified:** 2 (1 creado, 1 editado)

## Accomplishments

- **Migración `0066_actualidad_rpc.sql`** — RPC `public.actualidad_senales_panel(p_tipo text default null)` construida como aguja completa espejo de 0064:
  - `language sql stable security definer` + `set search_path = ''` + `set statement_timeout = '5s'`.
  - `drop function if exists public.actualidad_senales_panel(text)` ANTES del `create or replace` (idiom 42P13).
  - Cuerpo: `select` de las 9 columnas `from public.actualidad_senal s where p_tipo is null or s.tipo_senal = p_tipo order by s.tipo_senal, s.cobertura_camara nulls last, s.cluster_id nulls last limit 200`.
  - **Doble-revoke** (`from public` Y `from anon, authenticated`), **CERO grant**.
  - Encabezado con la orden de apply `psql --single-transaction` + warning NUNCA `db push` (apply = checkpoint 99-04).
- **`actualidad_senales_panel` añadida a `PUBLIC_RPC_ALLOWLIST`** en `app/lib/lockdown-guard.test.ts`, primera alfabéticamente. Sin esta entrada el guard Direction-B falla porque bajo Camino A el árbol web lee con service_role (que puede ejecutar cualquier RPC) → el allowlist es la única barrera de superficie.
- **Suite lockdown-guard verde (14/14)** tras el edit (Direction-B + anonGrantOffenders). El migration `0066` no dispara `anonGrantOffenders` porque solo revoca (cero `grant … to anon/public`).

## Task Commits

1. **Task 1: Migración 0066 — RPC bounded actualidad_senales_panel** - `19c217d` (feat)
2. **Task 2: Añadir actualidad_senales_panel a PUBLIC_RPC_ALLOWLIST** - `df5e564` (feat)

## Files Created/Modified

- `supabase/migrations/0066_actualidad_rpc.sql` (creado) — RPC bounded PII-safe aguja-completa espejo 0064, doble-revoke, cero grant, filtro paramétrico p_tipo.
- `app/lib/lockdown-guard.test.ts` (editado) — entrada `"actualidad_senales_panel"` en `PUBLIC_RPC_ALLOWLIST`.

## Decisions Made

- **returns table alineado VERBATIM con las 9 columnas de 0065.** Verificado contra `supabase/migrations/0065_actualidad_senal.sql` (L48-68): `tipo_senal text`, `ventana text`, `conteo int`, `cobertura_camara text`, `materia text`, `cluster_id int`, `fecha_max timestamptz`, `supresion_causa text`, `evidencia jsonb`. Cero deriva de nombre o tipo — la RPC re-emite exactamente esas columnas.
- **ORDER BY neutral por estructura, no por conteo** (`tipo_senal, cobertura_camara nulls last, cluster_id nulls last`). Respeta el anti-ranking cross-cámara (T-52-13): el proc no ordena por conteo y la RPC tampoco; el orden es determinístico por nombre/estructura.
- **Filtro `p_tipo` paramétrico** (`where p_tipo is null or s.tipo_senal = p_tipo`), `language sql` — sin construcción de SQL por string (ASVS V5, T-99-08). `p_tipo` con default `null` devuelve todas las señales.
- **`statement_timeout='5s'` + `limit 200` como defensa en profundidad** (T-99-07): la tabla `actualidad_senal` ya está precomputada → la RPC es trivialmente sub-5s; el timeout y el LIMIT acotan cualquier degradación futura.

## Deviations from Plan

None - plan executed exactly as written. Ambos `<verify>` grep-blocks pasaron; la suite lockdown-guard corre verde (14/14) con la entrada nueva. No hubo deriva de columna vs el schema real de 0065.

## Threat Model Compliance

- **T-99-05 (EoP, RPC fuera del allowlist) — mitigate:** `actualidad_senales_panel` alta en `PUBLIC_RPC_ALLOWLIST`; guard Direction-B verde.
- **T-99-06 (EoP, grant en la migración) — mitigate:** doble-revoke (public + anon/authenticated), CERO grant; `anonGrantOffenders` no muerde.
- **T-99-07 (DoS, query cara/sin límite) — mitigate:** `statement_timeout='5s'` + `limit 200` explícito.
- **T-99-08 (Tampering, SQLi vía p_tipo) — mitigate:** filtro paramétrico + `language sql` (no string-building).
- **T-99-09 (Info Disclosure, fuga PII) — accept:** `actualidad_senal` es no-PII por construcción (conteos/labels/fechas/evidencia de fuente); la RPC solo re-emite esas 9 columnas y NO hace join a tablas PII.

## Known Stubs

None. La RPC lee filas reales de `actualidad_senal`; la tabla se puebla por el proc de 99-01 tras el apply de 99-04. No hay valores hardcodeados ni placeholder en la superficie.

## User Setup Required

None en este plan. **El apply a PROD de 0066 (y 0065) es el checkpoint operador de Plan 99-04** (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0066_actualidad_rpc.sql`, DESPUÉS de 0065, NUNCA `db push`). El agente NO tocó PROD.

## Next Phase Readiness

- **99-04 (apply checkpoint):** 0065 + 0066 listas para aplicar en orden (0065 primero — la RPC lee su tabla). El pgTAP de 99-01 corre contra el schema aplicado; la RPC se puede probar con `select * from public.actualidad_senales_panel()` y `select * from public.actualidad_senales_panel('velocity')`.
- **Phase 100 (panel landing):** puede consumir `actualidad_senales_panel(p_tipo)` con service_role (Camino A) — la RPC está allowlisted y es la superficie de lectura fijada de SEN-02.

## Self-Check: PASSED

- FOUND: supabase/migrations/0066_actualidad_rpc.sql
- FOUND: app/lib/lockdown-guard.test.ts (contiene "actualidad_senales_panel")
- FOUND commit 19c217d (feat, Task 1), FOUND commit df5e564 (feat, Task 2)

---
*Phase: 99-senales-p1b-materializador*
*Completed: 2026-07-24*
