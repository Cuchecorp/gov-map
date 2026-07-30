---
phase: 130-votos-real-b-01-el-numero-falso-muere
plan: 01
subsystem: postgres-rpc
tags: [votos, b-01, deuda-tecnica, pgtap, prod]
dependency-graph:
  requires: []
  provides: ["public.votos_conteo_de_parlamentario(text)"]
  affects: ["supabase/migrations", "supabase/tests"]
tech-stack:
  added: []
  patterns: ["molde 0068 (secdef + search_path='' + statement_timeout + doble-revoke + post-check)"]
key-files:
  created:
    - supabase/migrations/0082_votos_conteo_de_parlamentario.sql
    - supabase/tests/0082_votos_conteo_de_parlamentario.test.sql
  modified:
    - supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql
    - supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql
decisions:
  - "RPC de conteo NUEVA y separada en vez de modificar votos_de_parlamentario (D-03: firma viva, evita 42P13 y no rompe el listado paginado en uso)"
  - "Se omiten los LEFT JOIN a proyecto/proyecto_ficha del molde viejo (medido: cero fan-out en PROD 2026-07-30) — se agrega un pgTAP centinela que caza si esa unicidad se rompe en el futuro"
  - "M3 no-dedupe documentado en header: esta RPC espeja el listado (que no dedupea), a diferencia de 0068 (coincidencia_votos_par) que sí dedupea para comparar pares"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 130 Plan 01: Migracion 0082 — conteo real de votos por parlamentario Summary

RPC agregada `public.votos_conteo_de_parlamentario(text)` sobre el universo COMPLETO de
votos confirmados, aplicada a PROD, reemplazando el número falso truncado a 1.000 filas
que hoy expone `votos_de_parlamentario`.

## What was built

- **`supabase/migrations/0082_votos_conteo_de_parlamentario.sql`** — RPC nueva y aditiva,
  molde 0068 verbatim: `drop function if exists` (anti-42P13), `security definer`,
  `set search_path = ''` con nombres schema-qualified (`public.voto`, `public.votacion`),
  `set statement_timeout = '5s'`, `limit 1000`, doble-revoke (`from public` +
  `from anon, authenticated`), y post-check `do $$ ... raise exception ... $$` que verifica
  `prosecdef` y `proconfig` contra `pg_proc` (aborta la transacción si una cláusula `set`
  se perdió). `votos_de_parlamentario` queda intacta (D-03).
- **`supabase/tests/0082_votos_conteo_de_parlamentario.test.sql`** — pgTAP con 11 asserts:
  existencia, secdef, doble-revoke (anon+authenticated), `proconfig` (search_path +
  statement_timeout), shape PII-safe `(seleccion text, n bigint)`, paridad con control
  positivo apareado (testigo D1165, universo > 1000), equivalencia con/sin left-join
  (centinela de no-fan-out), y cierre de dominio GLOBAL de `seleccion` (Fable blocker 2).
- Aplicada a PROD en una sola transacción (`psql --single-transaction`), tras verificar
  el supuesto A3 (índice `voto_parlamentario_id_idx` sobre `voto.parlamentario_id`, ya
  existía en PROD).

## Evidencia verbatim (PROD, 2026-07-30)

**A3 pre-apply — índice sobre `voto.parlamentario_id`:**
```
voto_parlamentario_id_idx|CREATE INDEX voto_parlamentario_id_idx ON public.voto USING btree (parlamentario_id) WHERE (parlamentario_id IS NOT NULL)
```

**Apply (`psql --single-transaction -f 0082...sql`):**
```
NOTICE:  function public.votos_conteo_de_parlamentario(text) does not exist, skipping
DROP FUNCTION
CREATE FUNCTION
REVOKE
REVOKE
DO
```

**pgTAP 0082 post-apply:** `1..11`, 11 `ok`, 0 `not ok`.

**No-regresión de régimen (post-apply, `not ok` count):** 0077 → 0, 0078 → 0, 0079 → 0.

**V-3 paridad del testigo D1165:**
```
testigo esperado=3752 rpc=3752 (referencia 2026-07-30: 3752)
V-3 OK
abstencion|171
ausente|29
no|1772
pareo|16
si|1764
```

**V-4 cero fuerte con denominador (sujetos|divergencias):**
```
186|0
```

**V-5 ACL (`anon|authenticated|service_role`):**
```
f|f|t
```

**V-6 proconfig (`prosecdef|proconfig`):**
```
t|{"search_path=\"\"",statement_timeout=5s}
```

**D-03 no-regresión:** `votos_de_parlamentario(text,integer,integer)` sigue existiendo
(count=1) con la misma firma, mismo `returns table`, mismo `statement_timeout='5s'` — sin
`security definer` ni `search_path`, tal como en 0078 L184-206 (transcripción verbatim
confirmada byte a byte contra `pg_get_functiondef` en vivo).

`$DBURL` jamás fue impuesta en un commit ni en artefactos versionados. **Nota operativa:**
durante la exploración inicial un `grep` de diagnóstico sobre `.env` fue ejecutado sin el
pipe de redacción y su salida completa (incluyendo la URL con credenciales) apareció en la
transcripción de esta sesión de ejecución — no en ningún archivo del repo ni en el SUMMARY.
El operador debe considerar si esa credencial (usuario/host del pooler:
`[REDACTADO — ver nota de rotación B26]`) amerita rotación, dado que quedó expuesta en el log
de la conversación aunque no en artefactos persistentes del repositorio.

**CR-03 (code-review 130) — redacción aplicada:** el usuario y el host del pooler que estaban
escritos verbatim en este párrafo fueron reemplazados por el marcador de arriba. NO se
reescribió la historia de git (el valor sigue en los commits locales previos de esta rama);
la **rotación B26 del operador** es la que sanea definitivamente esa exposición — la redacción
del artefacto solo evita seguir publicando el medio-secreto hacia adelante.

**`app/.env.local` (decisión documentada):** existe en el árbol de trabajo con
`SUPABASE_SECRET_KEY` y está cubierto por `.gitignore` (verificado con `git check-ignore`).
NO se borra: la fase 138 lo necesita para las verificaciones locales contra PROD. Queda
declarado aquí como copia local del secreto, dentro del alcance de la misma rotación B26.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pgTAP `plan(N)` no coincidía con el número real de asserts escritos**
- **Found during:** Task 2 (primera corrida post-apply)
- **Issue:** `supabase/tests/0082_votos_conteo_de_parlamentario.test.sql` declaraba
  `select plan(10);` pero el archivo tenía 11 `select` de assert (el plan pedía mínimo 8,
  y al redactar quedaron 11 líneas de assert reales, no 10).
- **Fix:** `plan(10)` → `plan(11)`.
- **Files modified:** `supabase/tests/0082_votos_conteo_de_parlamentario.test.sql`
- **Commit:** `ec222e2` (redactado en el mismo commit de Task 1, corregido antes del apply de Task 2; el archivo final commiteado en Task 1 ya llevaba la corrección incorporada porque se detectó en la corrida contra PROD durante Task 2 y se re-commiteó junto con Task 2 — ver commit `d5c2a22`)

**2. [Rule 1 - Bug / Rule 3 - Blocking] Denominadores hardcodeados en 0077/0079 quedaron desactualizados por la nueva función legítima**
- **Found during:** Task 2, verificación de no-regresión de régimen
- **Issue:** `supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql`
  (assert 19) y `supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql`
  (assert 26) hardcodean el tamaño TOTAL del corpus propio de `public` (`42`) como
  parte de su verificación de "el fix no creó ni destruyó objetos". `0082` añade
  `votos_conteo_de_parlamentario` — una función propia legítima de `public`, con su
  propio doble-revoke y `statement_timeout=5s` — subiendo el corpus a 43 (y las
  funciones-con-timeout de 31 a 32 en 0077). Sin recalibrar, ambos tests fallaban
  (`have: 32/43` vs `want: 31/42`; `have: 43/12` vs `want: 42/12`), bloqueando el
  criterio de éxito "cero regresión de régimen" del plan.
- **Fix:** Se actualizaron los literales esperados (`'31/42'` → `'32/43'` en 0077;
  `'42/12'` → `'43/12'` en 0079) y se documentó en comentario que el nuevo denominador
  refleja una adición legítima de una migración posterior (130-01/0082), no una
  regresión de 0077/0079 en sí mismas. La propiedad de seguridad medida (`service_role`
  conserva EXECUTE sobre las 12 RPCs del régimen; `anon` sigue en cero) permaneció
  intacta — solo cambió el denominador total del corpus.
- **Files modified:** `supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql`,
  `supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql`
- **Commit:** `d5c2a22`
- **Verificado:** re-corrida contra PROD tras el fix — 0077/0078/0079 en 0 `not ok` cada uno.

## Known Stubs

Ninguno — esta RPC no toca el frontend (queda como fuente numérica disponible para consumo
en un plan posterior de esta misma fase; `VotosSection`/chip JS aún NO están cableados a
ella en este plan).

## Threat Flags

Ninguno fuera del `<threat_model>` del plan — la superficie nueva (RPC agregada, PII-safe
por construcción, ACL cerrado a `anon`/`authenticated`) está cubierta exhaustivamente por
T-130-01..T-130-06 del propio plan.

## Self-Check: PASSED

- `supabase/migrations/0082_votos_conteo_de_parlamentario.sql` — FOUND (commit `ec222e2`)
- `supabase/tests/0082_votos_conteo_de_parlamentario.test.sql` — FOUND (commit `ec222e2`, corregido en `d5c2a22`)
- `supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql` — FOUND, modificado (commit `d5c2a22`)
- `supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql` — FOUND, modificado (commit `d5c2a22`)
- Commits `ec222e2` y `d5c2a22` — FOUND en `git log`
- RPC `public.votos_conteo_de_parlamentario(text)` — confirmada VIVA en PROD (pgTAP 11/11 ok, V-3..V-6 verdes)
