# 92-04 APPLY RUNBOOK — 0062 a PROD + pgTAP + cobertura de menciones

Cierre de datos de la Fase 92: aplicar la RPC `lobby_menciones_de_boletin` (0062) a PROD,
verificar con pgTAP contra el **schema aplicado**, y MEDIR/DECLARAR la cobertura honesta de
menciones válidas. El apply lo ejecuta el AGENTE (0062 es aditiva deny-by-default, DENTRO de
su autoridad — precedente 0059/0060/0061), **UNA vez**, vía `psql --single-transaction`
(NUNCA `supabase db push` → drift de `schema_migrations`).

Ejecutado: 2026-07-22 — Claude (gsd-execute-phase, Plan 92-04, Task 1).

---

## 0. Precondición verificada (fail-closed antes del apply)

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select count(*) from pg_proc where proname='lobby_menciones_de_boletin';"
```
Resultado ANTES del apply: **0** (la RPC no existía en PROD → apply legítimo, no re-corrida).

---

## 1. Apply 0062 a PROD (UNA vez, VERBATIM)

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
  supabase/migrations/0062_lobby_menciones_de_boletin.sql
```

Salida (limpia):
```
NOTICE:  function public.lobby_menciones_de_boletin(text) does not exist, skipping
DROP FUNCTION      -- no-op idempotente (drop if exists)
CREATE FUNCTION
REVOKE             -- revoke all … from public
REVOKE             -- revoke all … from anon, authenticated  (Camino A, CERO grant)
```

NUNCA `supabase db push`. NUNCA re-emitir grant. La función es `security definer set
search_path = ''`, nombres schema-qualified, `p_boletin` parametrizado, `LIMIT 50` bounded.

---

## 2. pgTAP contra el schema APLICADO (VERBATIM)

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f \
  supabase/tests/0062_lobby_menciones_de_boletin.test.sql
```

Resultado: **13/13 `ok`, 0 `not ok`** (todo dentro de `begin … rollback` → CERO efecto en PROD):
```
1..13
ok 1 - lobby_menciones_de_boletin(text) existe
ok 2 - lobby_menciones_de_boletin es security definer
ok 3 - anon SIN execute sobre lobby_menciones_de_boletin
ok 4 - lobby_menciones_de_boletin emite total_n (conteo honesto WR-01)
ok 5 - lobby_menciones_de_boletin NO emite rut/email/contraparte_id (PII-safe)
ok 6 - (a) materia con sufijo 14309-04 → mencionada
ok 7 - (b) materia "boletín N° 14309" (pelado tras gatillo) → mencionada
ok 8 - (c) "Ley 20.730" → NO mencionada (fail-closed keywords)
ok 9 - (c-2) "14309 pelado suelto" (sin gatillo) → NO mencionada
ok 10 - (d) boletín inexistente en proyecto → 0 filas (fail-closed existencia)
ok 11 - (e) no_confirmado / sin parlamentario_id → NO mencionada (fail-closed identidad)
ok 12 - los 2 fixtures válidos del test (T92AW1+T92AW2) son emitidos como menciones
ok 13 - total_n constante (count(*) over ()) y ≥ 2 (conteo honesto de menciones válidas)
```

**Dos fixes de fixture** aplicados al `.test.sql` al correrlo contra el schema REAL (ver
SUMMARY §Deviations — Rule 1): (1) el `insert` de `parlamentario` debía suplir las columnas
NOT NULL sin default del schema PROD (`periodo`, `origen`, `enlace`); (2) `14309-04` es un
boletín REAL de PROD con audiencias reales que también lo mencionan → el `total_n` absoluto
NO es isolation-safe (`begin/rollback` protege PROD pero el `count(*) over ()` ve las filas
reales). La aserción honesta pasó a: los 2 fixtures del test SÍ se emiten (test 12) + `total_n`
constante y ≥ 2 (test 13). El `not ok` transitorio con `total_n=3` fue, de hecho, **prueba
empírica de que 0062 opera sobre dato LIVE**.

---

## 3. Cobertura de menciones válidas en PROD (query VERBATIM)

Sobre las audiencias de lobby **CONFIRMADAS con `parlamentario_id` y `materia`**, cuántas
tienen ≥1 mención VÁLIDA de boletín — fail-closed DOBLE idéntico a la RPC: mención EXPLÍCITA
(patrón context-gated, espejo del extractor TS / RPC 0062) **+ EXISTENCIA en `public.proyecto`**.

```sql
with base as (
  select a.identificador, a.materia
  from public.lobby_audiencia a
  where a.estado_vinculo='confirmado' and a.parlamentario_id is not null and a.materia is not null
),
menciones as (
  -- (a) {base}-{sufijo} en cualquier posición → inequívoca por el sufijo
  select b.identificador,
         replace((regexp_matches(b.materia, '\m(\d{1,3}(?:\.\d{3})*|\d{3,6})-\d{2}\M', 'g'))[1], '.', '') as base
  from base b
  union all
  -- (b) base pelada SOLO tras gatillo "boletín"/"boletin"/"bol." (≤2 tokens sin dígitos)
  select b.identificador,
         replace((regexp_matches(b.materia, '(?:bolet[ií]n|bol\.)(?:\s+[^[:space:][:digit:]]+){0,2}\s+(\d{1,3}(?:\.\d{3})*|\d{3,6})\M(?!-\d)', 'gi'))[1], '.', '') as base
  from base b
),
validas as (
  -- EXISTENCIA (fail-closed #2): el boletín citado existe en proyecto
  select distinct m.identificador
  from menciones m
  join public.proyecto pr on pr.boletin_num = m.base or split_part(pr.boletin,'-',1) = m.base
)
select
  (select count(*) from base)    as total_confirmadas_con_materia,
  (select count(*) from validas) as audiencias_con_mencion_valida,
  (select count(distinct base) from menciones m2
     join public.proyecto pr2 on pr2.boletin_num=m2.base or split_part(pr2.boletin,'-',1)=m2.base
  ) as boletines_distintos_mencionados;
```

Resultado (`total_confirmadas_con_materia | audiencias_con_mencion_valida | boletines_distintos`):
```
5106|195|82
```

### Cobertura DECLARADA (dato honesto)

- **5.106** audiencias de lobby confirmadas con parlamentario_id y materia (coincide con el
  dato de PROD del CONTEXT: "5.106 audiencias confirmadas").
- **195** de ellas (**~3,8 %**) tienen al menos una **mención VÁLIDA** de boletín (explícita +
  existente en `proyecto`).
- Esas menciones cubren **82** boletines distintos.
- Top boletines por audiencias que los mencionan: `16849-12` (13), `16374-07` (12),
  `17064-08` (9), `15975-25` (9), `17337-07` (8), `14985-34` (8).

La cobertura es **baja por diseño** (fail-closed): la mayoría de las materias de lobby NO
citan el número de boletín, y el canal SOLO enlaza cuando el número está explícito y el
proyecto existe — jamás por tema/keyword/similitud. 195/5106 es el dato honesto, no un defecto.

---

## Targets para el gate BrowserOS (Task 2)

- **Ficha parlamentario con lobby + chips:** `/parlamentario/D1132` (Jorge Guzmán) — 8
  audiencias confirmadas cuya materia menciona boletín → materia completa + chips "Menciona
  boletín N".
- **Ficha proyecto mencionado:** `/proyecto/16849-12` — la RPC devuelve 13 filas
  (`total_n=13`) → sección `#lobby-menciones` poblada con leyenda anti-causal.
