---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
plan: 02
subsystem: data
tags: [rpc, security-definer, pgtap, gated-legal, vsim, apply-migration, denominador-sustantiva]

# Dependency graph
requires:
  - phase: 102-01
    provides: "supabase/migrations/0068_coincidencia_votos_par.sql ESCRITA (no aplicada) + entrada coincidencia_votos_par en PUBLIC_RPC_ALLOWLIST"
  - phase: 101-relaciones-p2a
    provides: "0067 mold pgTAP (secdef/doble-revoke/proconfig/regprocedure-scope WR-05)"
provides:
  - "RPC public.coincidencia_votos_par(text,text) APLICADA a PROD (secdef, search_path='', statement_timeout='5s', doble-revoke CERO grant)"
  - "supabase/tests/0068_coincidencia_votos_par.test.sql (pgTAP 10/10 contra schema aplicado: contrato + denominador sustantiva)"
affects: [102-03-copy-mount-comparar, 104-e2e-flags-off]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Apply aditivo por psql --single-transaction (NUNCA db push), pgTAP contra schema aplicado como ÚNICA prueba válida del DDL (Pitfall 6)"
    - "Fixture pgTAP de denominador: par PA/PB con filas pareo + no_confirmado que NO cuentan en m_compartidas (VSIM-01)"

key-files:
  created:
    - supabase/tests/0068_coincidencia_votos_par.test.sql
  modified: []

key-decisions:
  - "0068 aplicada a PROD (aditiva pura: función nueva + revokes, sin flip de régimen ni anon key) → dentro de forbidden-gate permitido, precedente 0059-0067"
  - "Test 7 (returns) usa la forma canónica 'timestamp with time zone' — así lo emite pg_get_function_result, no 'timestamptz' (drift de display, NO relajación del contrato: siguen siendo 3 columnas agregadas exactas)"
  - "Fixture provee fuente_voter_id NOT NULL (drift 0009) por fila — corrección de fixture, NO del contrato (patrón 92-04)"

requirements-completed: [VSIM-01]

# Metrics
duration: 8min
completed: 2026-07-25
---

# Phase 102 Plan 02: Apply 0068 + pgTAP contra schema aplicado Summary

**RPC `coincidencia_votos_par(text,text)` aplicada a PROD por `psql --single-transaction` (secdef, search_path='', statement_timeout='5s', doble-revoke CERO grant) y probada con pgTAP 10/10 contra el schema aplicado — incluye el test de denominador sustantiva (VSIM-01): pareo y no_confirmado NO cuentan en `m_compartidas`.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files modified:** 1 (creado: el pgTAP)

## Accomplishments
- Escrito `supabase/tests/0068_coincidencia_votos_par.test.sql` copiando el mold de 0067 (begin/plan/finish/rollback), swappeado a firma 2-arg `text,text` y scope por `::regprocedure` (WR-05). Cubre: has_function, prosecdef=true, anon SIN execute, authenticated SIN execute, search_path fijado, statement_timeout=5s, returns exacto de 3 agregados, + 3 aserciones de denominador sustantiva.
- Aplicada la migración 0068 a PROD por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0068_coincidencia_votos_par.sql` (DROP/CREATE/REVOKE/REVOKE limpios). NUNCA `db push`.
- La función existe en PROD: `public.coincidencia_votos_par(text,text)::regprocedure` resuelve.
- pgTAP corre contra el schema aplicado: **10/10 ok, 0 not-ok**.
- Verificación de cifras reales (par D1170/D1165): `n_coinciden=3655 ≤ m_compartidas=3672`, ambos > 0, `fecha_captura_max=2026-07-24 21:30:05.545+00` (no null).

## pgTAP — resultado (contra schema APLICADO)

```
1..10
ok 1  - coincidencia_votos_par(text,text) existe
ok 2  - coincidencia_votos_par es security definer
ok 3  - anon SIN execute sobre coincidencia_votos_par
ok 4  - authenticated SIN execute sobre coincidencia_votos_par
ok 5  - search_path fijado en la función
ok 6  - statement_timeout=5s fijado en la función
ok 7  - coincidencia_votos_par emite SOLO n_coinciden/m_compartidas/fecha_captura_max (3 agregados)
ok 8  - m_compartidas=2 (pareo y no_confirmado excluidos del denominador)
ok 9  - n_coinciden=1 (solo V1 coincide) y <= m_compartidas
ok 10 - fecha_captura_max = max de las votaciones sustantivas compartidas
```
**0 not ok.** Denominador VSIM-01 probado: fixture PA/PB con 4 votaciones (2 sustantivas, 1 pareo, 1 no_confirmado) → `m_compartidas=2`, `n_coinciden=1`, pareo/no_confirmado excluidos.

## Task Commits

1. **Task 1: Escribir el pgTAP 0068** — `79e9ccd` (test)
2. **Task 2: Aplicar 0068 a PROD + correr pgTAP + corregir fixture** — `75ae893` (test)

## Files Created/Modified
- `supabase/tests/0068_coincidencia_votos_par.test.sql` — pgTAP de la RPC 0068 (firma, secdef, doble-revoke, proconfig, returns exacto, denominador sustantiva). Corre contra schema aplicado.
- `supabase/migrations/0068_coincidencia_votos_par.sql` — APLICADA a PROD en este plan (escrita en Plan 01, sin cambios de contenido).

## Decisions Made
- 0068 es aditiva pura (función nueva + revokes) → el agente PUEDE aplicarla (precedente 0059-0067); no toca régimen ni anon key.
- El apply se hizo por `psql --single-transaction` (rollback atómico ante error), NUNCA `supabase db push` (drift de schema_migrations).

## Deviations from Plan

### Auto-fixed Issues (fixture, NO contrato)

**1. [Rule 1 - Fixture drift] `pg_get_function_result` emite `timestamp with time zone`, no `timestamptz`**
- **Found during:** Task 2 (primera corrida del pgTAP contra schema aplicado — test 7 not ok)
- **Issue:** El expected del test 7 usaba `timestamptz`; Postgres normaliza a la forma canónica `timestamp with time zone` en `pg_get_function_result`.
- **Fix:** Ajustado el expected a `'TABLE(n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamp with time zone)'`. El contrato NO se relajó: siguen siendo exactamente 3 columnas agregadas (n_coinciden bigint, m_compartidas bigint, fecha timestamptz) — solo cambió la representación textual esperada.
- **Files modified:** supabase/tests/0068_coincidencia_votos_par.test.sql
- **Committed in:** 75ae893

**2. [Rule 1 - Fixture drift] `voto.fuente_voter_id` es NOT NULL (drift 0009) — el fixture no lo proveía**
- **Found during:** Task 2 (INSERT del fixture violaba not-null de fuente_voter_id)
- **Issue:** El fixture insertaba en `voto` sin `fuente_voter_id`; esa columna es NOT NULL con unique `(votacion_id, fuente_voter_id)` desde 0009 (patrón 92-04: fixture mal formado por drift de NOT NULL).
- **Fix:** Añadido `fuente_voter_id` distinto por votante (T68A/T68B) en cada fila del fixture. No relaja el contrato de la RPC; corrige solo el fixture del test.
- **Files modified:** supabase/tests/0068_coincidencia_votos_par.test.sql
- **Committed in:** 75ae893

---

**Total deviations:** 2 auto-fixed (ambos fixture/expected del test, ninguno del contrato de la RPC).
**Impact on plan:** Nulo sobre el diseño LOCKED — la RPC aplicada es byte-idéntica a la escrita en Plan 01; solo el pgTAP se ajustó a la representación real del schema aplicado.

## Issues Encountered
- Ninguno pendiente. La RPC quedó aplicada y probada contra PROD.

## Known Stubs
- Ninguno. La RPC está aplicada y funcional; el consumo (5º eje de `/comparar`) es Plan 03 y sigue gated por `VSIM_PUBLIC_ENABLED` (flip = acto humano con sign-off legal).

## Threat Flags
Ninguno nuevo. Toda la superficie (RPC secdef con doble-revoke CERO grant, statement_timeout=5s) está cubierta por el `<threat_model>` del plan (T-102-05/06/07) y verificada por el pgTAP contra el schema aplicado.

## Self-Check: PASSED
- Archivo creado verificado en disco: `supabase/tests/0068_coincidencia_votos_par.test.sql` presente.
- RPC verificada en PROD: `public.coincidencia_votos_par(text,text)::regprocedure` resuelve (EXISTS).
- pgTAP verde contra schema aplicado: 10/10 ok, 0 not-ok.
- Commits verificados en git log: 79e9ccd, 75ae893.

## Next Phase Readiness
- **Plan 03 (copy + montaje):** la RPC `coincidencia_votos_par` ya existe físicamente en PROD y está allowlisted; el gate `vsimPublicEnabled()` y la constante `LEYENDA_SIMILITUD_VOTO` existen desde Plan 01. Falta el cuerpo presentacional neutro + el 5º eje gated en `/comparar` + `docs/legal/102-LEGAL-DOSSIER-VSIM.md`.
- **Blocker (operador):** el flip de `VSIM_PUBLIC_ENABLED=true` requiere sign-off legal humano (anti-DW-NOMINATE); el agente NO flipea.

---
*Phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal*
*Completed: 2026-07-25*
