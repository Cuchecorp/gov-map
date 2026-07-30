# Evidencia de aplicación — 131-03: RPC v2 de co-autoría en PROD

Fecha/hora de aplicación: 2026-07-30 (sesión de ejecución, worktree `agent-aab8ddd65cd9a3e7a`).
Migración: `supabase/migrations/0083_coautoria_v2.sql` (número final — sin colisión: `ls
supabase/migrations | sort | tail` mostró `0079_limit_explicito_rpcs.sql`, `0080_actualidad_evidencia.sql`,
`0081_actualidad_evidencia_fix.sql`, `0082_votos_conteo_de_parlamentario.sql`, `0083_coautoria_v2.sql`
como último archivo en disco — 0083 quedó libre y correlativo, sin renombrar nada).

## Comando de aplicación

```
set -a && . ./.env && set +a && export PGCLIENTENCODING=UTF8
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/0083_coautoria_v2.sql
```

## Salida de la aplicación

```
psql:supabase/migrations/0083_coautoria_v2.sql:34: NOTICE:  function public.coautores_de_parlamentario_v2(text) does not exist, skipping
DROP FUNCTION
CREATE FUNCTION
REVOKE
REVOKE
```

## Control previo / posterior (T-131-13, Repudiation)

- ANTES de aplicar: `select count(*) from pg_proc ... where proname like 'coautores_de_parlamentario%'` → **1**
  (solo la viva existía — confirmado antes de correr la migración, ver Task 1 de ejecución).
- DESPUÉS de aplicar: mismo query → **2** (viva + v2 conviven). Cumple el criterio del plan
  (1→2, no 2→2 que hubiera significado re-aplicación ciega).

## Salida íntegra del pgTAP

Comando: `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0083_coautoria_v2.test.sql | tr -d '\r'`

```
BEGIN
1..12
ok 1 - coautores_de_parlamentario_v2(text) existe
ok 2 - coautores_de_parlamentario_v2 es security definer
ok 3 - coautores_de_parlamentario_v2 es stable
ok 4 - search_path fijado en la v2 (secdef con nombres schema-qualified)
ok 5 - statement_timeout=5s fijado en la v2 (RPC bounded, molde 0064)
ok 6 - coautores_de_parlamentario_v2 emite la MISMA firma de retorno que la viva (control apareado)
ok 7 - coautores_de_parlamentario(text) [la viva] sigue existiendo
ok 8 - la viva conserva limit 20 (no fue alterada)
ok 9 - coautores_de_parlamentario_v2 tiene limit 1000 (techo derivado)
ok 10 - anon SIN execute sobre coautores_de_parlamentario_v2
ok 11 - coautores_de_parlamentario_v2 NO expone rut/donante_id en el returns table
ok 12 - coautores_de_parlamentario_v2 devuelve mas de 20 filas para D1178 (deuda no vacua)
ROLLBACK
```

12 `ok`, 0 `not ok` — cumple el mínimo de 8 asserts exigido por el plan.

Control adicional de privilegio (T-131-14): `select has_function_privilege('anon',
'public.coautores_de_parlamentario_v2(text)','execute')` → **f** (anon sin execute, verificado
independientemente del pgTAP).

## A — Testigo por recálculo INDEPENDIENTE (no vía RPC)

Comando:
```sql
select count(distinct a1.boletin) from public.proyecto_autor a1
join public.proyecto_autor a2 on a2.boletin=a1.boletin
  and a2.estado_vinculo='confirmado' and a2.parlamentario_id='D1099'
where a1.parlamentario_id='D1178' and a1.estado_vinculo='confirmado'
```
Salida: **A=92**

## B — El mismo testigo, vía la RPC v2 (ambas direcciones)

```sql
select n_proyectos from public.coautores_de_parlamentario_v2('D1178') where id='D1099'
select n_proyectos from public.coautores_de_parlamentario_v2('D1099') where id='D1178'
```
Salida: **B1(D1178→D1099)=92  B2(D1099→D1178)=92**

**A == B == 92** — el conteo mostrado por la v2 iguala el recálculo SQL independiente en ambas
direcciones (criterio D-06 satisfecho).

## C — Control apareado del defecto (cero fuerte, no vacuo)

```sql
select count(*) from public.coautores_de_parlamentario('D1178') where id='D1099'   -- vieja
select count(*) from public.coautores_de_parlamentario_v2('D1178') where id='D1099' -- v2
```
Salida: **vieja=0  v2_filas=1**

La RPC vieja da **0** filas para el par testigo (D1099 cae fuera de su top-20 alfabético — el
defecto de truncamiento silencioso que motivó DEBT-04 existía realmente), mientras la v2 da 1 fila
para el mismo par. Este control prueba, en el mismo par de comandos, que el defecto existía y que
la v2 lo cierra — no es un cero vacuo (ausencia de datos), es un cero por límite estructural de la
RPC vieja frente a datos que sí existen (confirmado por A/B=92).

## D — La vieja sigue funcional (SC#4 — cero regresión)

```sql
select count(*) from public.coautores_de_parlamentario('D1178')     -- vieja, total
select count(*) from public.coautores_de_parlamentario_v2('D1178')  -- v2, total
```
Salida: **vieja_total=20  v2_total=91**

La vieja sigue devolviendo exactamente **20** filas (su cap histórico, intacto — confirmado también
por el pgTAP assert 8). La v2 da 91 filas reales (> 20, < 1000 — cumple la aserción del plan de
`>20 y <1000`, valor medido hoy anotado tal cual).

## E — Techo no rozado

Comando: máximo real de filas devueltas por la v2 sobre los 180 parlamentarios con autoría
confirmada (`max(select count(*) from coautores_de_parlamentario_v2(p.id))` sobre toda la tabla
`parlamentario`).

Salida: **max_coautores_v2 = 101**

Con el techo derivado en 0083 (`limit 1000`, piso de 0079), esta aserción hoy es **tautológica**
(101 << 1000, margen 9.9x): declarado explícitamente como estándar de honestidad de 0079 — su valor
real es cazar deriva futura (si el máximo real creciera y se acercara al techo, esta medición lo
detectaría en la próxima corrida), no demostrar nada no ya sabido por el research previo (que midió
101 el mismo día).

## F — H-06 tras el merge (regla del timeline, congelada por 131-01)

Comando:
```
psql "$SUPABASE_DB_URL" -tA -F'|' -v boletin=14309-04 -f supabase/queries/timeline-regla-de-seleccion.sql
```
Salida cruda: `99|14|5|85`

Fixture congelado (`app/components/__fixtures__/timeline-14309-04.esperado.json`):
```json
{
  "boletin": "14309-04",
  "orden": "fecha asc, id asc",
  "medido_en": "2026-07-30T17:36:51Z",
  "eventos_totales": 99,
  "eventos_absorbidos": 14,
  "periodos": 5,
  "hitos_del": 85
}
```

`eventos_totales=99`, `eventos_absorbidos=14`, `hitos_del=85` — coincide EXACTAMENTE con el fixture
congelado por 131-01. La identidad `N − K = H` se sostiene (`99 − 14 = 85`). El número no derivó
tras el merge de 131-01/02/03: se reproduce contra PROD tal como quedó congelado.

## Qué NO prueba esta evidencia

- **No toca el DOM del deploy.** Todas las mediciones de esta evidencia son `psql` directo contra
  PROD y un test pgTAP transaccional (`ROLLBACK` al final — la migración queda aplicada, las
  aserciones del pgTAP no dejan residuo). Ninguna corre en el navegador ni contra el sitio
  desplegado.
- **No verifica el render real de `/comparar` ni de la ficha de parlamentario en producción.** El
  copy exacto ("Comparten 92 proyectos co-firmados") está probado en 131-02 por tests unitarios con
  mocks de la RPC (`app/app/comparar/page.test.tsx`), no contra un navegador real ni contra el
  deploy de Cloudflare.
- **No mide la paridad visual del timeline** (posiciones, colores, tooltips) — solo la aritmética
  `N − K = H` que alimenta el copy "Hito del".
- La verificación DOM del timeline y el render real de `/comparar` sobre el deploy quedan
  **delegadas a la Phase 138** (según el plan de esta fase, sección `<objective>`).

## Gate de fase (Task 3) — suite completa, guards, tsc

Comandos y salidas (raíz del repo, `pnpm install --prefer-offline` corrido antes por ausencia de
`node_modules` en el worktree):

**`pnpm test`** (packages/* + app/):
```
Test Files  108 passed (108)
     Tests  1630 passed (1630)
  Duration  80.03s
```
1630 ≥ 1630 (baseline post-merge 2026-07-30 declarada en el prompt de ejecución) — cumple.

**`pnpm guards`** (17 archivos de guard por nombre explícito, 3 workspaces):
```
app:      Test Files  11 passed (11)   Tests  334 passed (334)
dinero:   Test Files   3 passed (3)    Tests   34 passed (34)
llm:      Test Files   3 passed (3)    Tests    7 passed (7)
```
11+3+3 = 17 archivos de guard, todos verdes.

**`pnpm --filter ./app exec tsc --noEmit`**: sin salida (limpio, exit 0).

## Auto-ratificación (precedente 127-03) — los 4 success criteria del ROADMAP §Phase 131

1. **"DEBT-04 cerrado con prueba de que Postgres ejecutó el DDL, no con la existencia del archivo."**
   Sostenido por: control previo/posterior `pg_proc` 1→2 (sección "Control previo / posterior"
   arriba) + salida íntegra del pgTAP (12 `ok`, 0 `not ok`, sección "Salida íntegra del pgTAP") —
   ambos ejecutados contra PROD real, no contra el archivo en disco.

2. **"DEBT-03 sigue reproduciéndose tras el merge (no derivó al integrar)."**
   Sostenido por: sección F — `psql ... timeline-regla-de-seleccion.sql` contra PROD da
   `99|14|5|85`, idéntico al fixture `timeline-14309-04.esperado.json` (`eventos_totales=99,
   eventos_absorbidos=14, hitos_del=85`). Medido HOY, tras el merge de 131-01/02/03 en este
   worktree — no es el valor congelado citado de memoria, es la misma query re-ejecutada.

3. **"La RPC vieja intacta y funcional: cero regresión en `/parlamentario/[id]`."**
   Sostenido por: sección D (`vieja_total=20`, exactamente el cap histórico) + pgTAP assert 7-8
   (la vieja existe y conserva `limit 20`) + `pnpm test` completo (1630 passed, incluye
   `app/parlamentario/[id]/page.test.tsx` con 16 tests verdes — el consumidor de la RPC vieja no
   cambió). **Límite declarado:** esto prueba la RPC en PROD + el contrato unitario de la página;
   NO prueba el render DOM real de `/parlamentario/[id]` en el deploy — eso es Phase 138.

4. **"Auto-ratificación con evidencia verificable; verificación DOM declarada como delegada a 138."**
   Sostenido por: este mismo documento (comandos + salidas crudas pegadas, no declaradas) + la
   sección "Qué NO prueba esta evidencia" arriba, que declara explícitamente el render de
   `/comparar` y la paridad DOM del timeline como delegados a Phase 138 (el copy exacto
   "Comparten 92 proyectos co-firmados" está sostenido SOLO por un unit test con mocks de la RPC
   en `app/app/comparar/page.test.tsx`, no por un navegador real — declarado sin ambigüedad).

Ningún criterio queda sostenido por afirmación sin comando+salida pegada en este documento.
