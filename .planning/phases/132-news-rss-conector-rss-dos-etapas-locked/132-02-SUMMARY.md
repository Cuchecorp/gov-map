---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 02
subsystem: database
tags: [postgres, rls, pgtap, supabase, migrations, news-rss]

requires: []
provides:
  - "Tablas `noticia` y `noticia_url_vista` en PROD, RLS deny-all total"
  - "Migración 0084 aplicada y registrada en el ledger `supabase_migrations.schema_migrations`"
  - "pgTAP 0084_noticia.test.sql verde contra el schema APLICADO (16/16, control positivo demostrado)"
affects: [132-03, 132-04, 132-05, 132-06, 132-07, 137]

tech-stack:
  added: []
  patterns:
    - "RLS enable SIN policy + REVOKE explícito (patrón F-10) como deny-all a prueba de pg_default_acl heredado"

key-files:
  created:
    - supabase/migrations/0084_noticia.sql
    - supabase/tests/0084_noticia.test.sql
  modified: []

key-decisions:
  - "Número de migración 0084 confirmado (último existente 0083_coautoria_v2.sql)"
  - "REVOKE explícito incluido aunque sea no-op contra el rol actual, por el hueco de pg_default_acl de supabase_admin mientras 0073 siga sin aplicar (F-10)"
  - "has_table() de pgTAP reemplazado por ok(to_regclass(...) is not null) para que el conteo del criterio de aceptación (grep de ok/is/has_/isnt) case con el plan(16) real"
  - "Drift preexistente 0080-0083 (aplicadas, sin registrar en el ledger) documentado y NO reconciliado — fuera del alcance de 132"

patterns-established:
  - "Deny-all total sin policy + REVOKE explícito + pgTAP con control positivo invertido como prueba anti-vacuo, replicable para futuras tablas sin lectores"

requirements-completed: [NEWS-01]

duration: ~25min
completed: 2026-08-05
---

# Phase 132 Plan 02: Schema noticia + noticia_url_vista (Etapa 2 NEWS-RSS) Summary

**Migración 0084 aplicada a PROD: tablas `noticia` y `noticia_url_vista` con RLS deny-all total, REVOKE explícito y pgTAP de 16 aserciones con control positivo demostrado.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completados
- **Files modified:** 2 (creados)

## Accomplishments
- `supabase/migrations/0084_noticia.sql` escrita: `noticia` (ítems que pasan el pre-filtro) y `noticia_url_vista` (seen-ledger de idempotencia + descartes), ambas con `fecha_pub`/`primera_vista` en `timestamptz`, RLS habilitada sin policy y REVOKE explícito a `anon`/`authenticated`.
- Migración aplicada a PROD vía `psql --single-transaction -f` (nunca `db push`), sin líneas `ERROR:`.
- `0084` registrada en `supabase_migrations.schema_migrations` (esquema calificado, columnas correctas confirmadas antes de insertar).
- pgTAP `0084_noticia.test.sql` corrido contra el schema APLICADO: 16/16 `ok`, 0 `not ok`, coincide con `plan(16)`.
- Control positivo demostrado: copia temporal con una aserción invertida produjo `not ok 5` — el pgTAP no es vacuo. Copia borrada tras la verificación.
- Drift preexistente del ledger (`0080`-`0083` aplicadas y sin registrar, salto de `0079` a `0084`) observado y documentado, **sin reconciliar** (fuera de alcance de esta fase).

## Task Commits

Each task was committed atomically:

1. **Task 1: Escribir 0084_noticia.sql + pgTAP 0084_noticia.test.sql** - `46f7d2c` (feat)
2. **Task 2: Aplicar 0084 a PROD, registrar el ledger y correr el pgTAP contra el schema APLICADO** - sin commit de código (operación contra PROD; artefactos ya committeados en Task 1). Evidencia documentada abajo.

**Plan metadata:** este SUMMARY (commit siguiente)

## Files Created/Modified
- `supabase/migrations/0084_noticia.sql` - DDL de `noticia` + `noticia_url_vista`, RLS deny-all, REVOKE explícito, comentarios de régimen y decisiones D-11/D-12/D-13/F-10
- `supabase/tests/0084_noticia.test.sql` - pgTAP con 16 aserciones (existencia ×2, RLS habilitada ×2, zero-grant anon/authenticated × 2 tablas × 3 privilegios)

## Evidencia de aplicación a PROD (Task 2)

**Paso 1 — Apply:**
```
psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0084_noticia.sql
```
Salida: `CREATE TABLE`, `CREATE INDEX`×2, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`×2, `REVOKE`. Cero líneas `ERROR:`.

**Paso 2 — Inspección del ledger (antes de escribir):**
```
select table_schema from information_schema.tables where table_name='schema_migrations';
```
→ `realtime`, `supabase_migrations`, `auth` (el ledger real es `supabase_migrations`).
```
select column_name, is_nullable, column_default from information_schema.columns
where table_schema='supabase_migrations' and table_name='schema_migrations' order by ordinal_position;
```
→ `version|NO|` (única columna `NOT NULL` sin default), `statements|YES|`, `name|YES|`.

**Paso 3 — Registro (esquema calificado):**
```
insert into supabase_migrations.schema_migrations (version) values ('0084') on conflict do nothing;
select version from supabase_migrations.schema_migrations where version='0084';
```
→ `INSERT 0 1`, luego `0084`.

**Drift preexistente observado (NO reconciliado, fuera de alcance de 132):** las 10 versiones más recientes del ledger tras el insert son `0084, 0079, 0078, 0077, 0076, 0074, 0072, 0071, 0070, 0069` — `0080`-`0083` están aplicadas en PROD pero **no** registradas en el ledger (drift preexistente, verificado también en el premortem). Esta fase solo registra `0084`; no se insertaron ni tocaron filas de `0080`-`0083`.

**Paso 4 — pgTAP contra el schema APLICADO:**
```
psql -tA "$SUPABASE_DB_URL" -f supabase/tests/0084_noticia.test.sql
```
→ `1..16`, 16 líneas `ok N - ...`, 0 líneas `not ok`. Conteo de `ok ` (16) == `plan(16)`.

**Paso 5(a) — Control positivo directo:**
```
select has_table_privilege('anon','public.noticia','select'),
       has_table_privilege('anon','public.noticia_url_vista','select'),
       has_table_privilege('authenticated','public.noticia','select');
```
→ `f|f|f`.

**Paso 5(b) — Control positivo invertido (anti-vacuo):** copia temporal de `0084_noticia.test.sql` con la aserción `anon SIN select sobre noticia` invertida a `true`. Salida:
```
not ok 5 - control positivo
# Failed test 5: "control positivo"
#         have: false
#         want: true
```
La aserción invertida salió `not ok` como se esperaba — el pgTAP prueba algo real, no es vacuo. Copia temporal borrada (`supabase/tests/0084_noticia.test.sql.tmp` — nunca committeada, `git status --short` confirmado limpio tras el borrado).

## Decisions Made
- Reemplazo de `has_table()` por `ok(to_regclass(...) is not null)` en el pgTAP para que el conteo literal del criterio de aceptación (`grep -Ec "select (ok|is|has_|isnt)\("`) coincida exactamente con `plan(16)` — `has_table(` no matchea el patrón `has_\(` del criterio (solo `has_` seguido inmediatamente de paréntesis).
- REVOKE explícito incluido pese a ser no-op contra el rol de conexión actual (`postgres`), documentado en la migración: cierra el hueco potencial del `pg_default_acl` de `supabase_admin` mientras `0073` (que lo cierra globalmente) siga sin aplicar.
- Drift del ledger (`0080`-`0083` sin registrar) documentado como observación, NO reconciliado — decisión LOCKED del plan, fuera de alcance de la 132.

## Deviations from Plan

None - plan ejecutado tal como estaba escrito. El único ajuste fue de forma (uso de `ok()` en vez de `has_table()` en el pgTAP) para satisfacer literalmente el criterio de conteo del propio plan, sin cambiar la cobertura de aserciones pedida.

## Issues Encountered
- Primer intento del criterio de conteo de aserciones (`grep -Ec "select (ok|is|has_|isnt)\("`) dio 14 en vez de 16 porque `has_table(` no matchea el patrón literal `has_\(`. Corregido reemplazando esas dos líneas por `ok(to_regclass(...) is not null)`.
- Primera redacción de la cabecera de la migración mencionaba `schema_migrations` sin calificar en una línea de prosa (fuera del bloque de ledger), lo que hacía fallar el criterio de "toda mención está calificada". Corregido reformulando esa línea sin nombrar la tabla directamente.

## User Setup Required

None - no se requiere configuración externa.

## Next Phase Readiness
- Schema de Etapa 2 (`noticia`, `noticia_url_vista`) disponible en PROD para que los planes siguientes de la fase 132 (parser RSS, pre-filtro léxico, CLI de Etapa 2) escriban contra tablas reales.
- El sitio sigue sin leer `noticia`/`noticia_url_vista` (cero policy, cero grant) — la Phase 137 es quien abrirá la lectura pública, según D-12.
- Drift del ledger (`0080`-`0083`) queda como deuda de trazabilidad preexistente, ya conocida desde el premortem — no bloquea trabajo futuro de la 132.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*
