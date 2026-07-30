---
phase: 131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - supabase/migrations/0083_coautoria_v2.sql
  - supabase/tests/0083_coautoria_v2.test.sql
  - supabase/queries/timeline-regla-de-seleccion.sql
  - app/app/proyecto/[boletin]/page.tsx
  - app/app/proyecto/[boletin]/page.test.tsx
  - app/components/timeline-view.test.tsx
  - app/components/__fixtures__/timeline-14309-04.json
  - app/components/__fixtures__/timeline-14309-04.esperado.json
  - app/app/comparar/page.tsx
  - app/app/comparar/page.test.tsx
  - app/lib/lockdown-guard.test.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: fixed
fixed_at: 2026-07-30
fixed: 10
skipped: 0
---

# Phase 131: Code Review Report

**Depth:** standard
**Status:** fixed (10/10 findings — ver §Fixes Applied al final)

## Summary

La migración 0083 es un espejo **exacto** de la viva de 0064 (diff = `_v2` en el nombre y
`limit 1000` en vez de `limit 20`): mismo `from/join/where/group by/order by`, misma
`returns table`, mismo `search_path=''` + `statement_timeout=5s`, doble-revoke, cero grant,
cero DML. **No hay drift semántico de universo** — foco 1 despejado. La parametrización del
cap en `/comparar` tampoco tiene fuga: `interseccionPar` se llama con default (CAP_RPC=20)
sólo en militancia y con `CAP_RPC_COAUTORES` explícito sólo en co-autoría, y hay control
apareado vivo (`page.test.tsx` "control apareado anti-Pitfall-1") que se pone rojo si alguien
sube CAP_RPC — foco 2 despejado.

El problema está en la **query documental H-06**: no es byte-equivalente a `construirItems`
en presencia de `descripcion NULL` (columna nullable en 0008), y no es re-runnable con
seguridad en otro boletín. Además, el número congelado `hitos_del` se vende como el conteo DOM
de `Hito del` sin declarar las dos precondiciones que lo condicionan, y el mock `.order()`
encadenable **no asserta nada** sobre el orden total que es el fix central de la fase.

## Structural Findings (fallow)

No se entregó bloque `<structural_findings>` para esta revisión.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: La query documental diverge de `construirItems` con `descripcion NULL` (lógica trivaluada)

**File:** `supabase/queries/timeline-regla-de-seleccion.sql:64` (y `:63`, `:74`)
**Issue:** `es_retiro` se calcula como `descripcion ~* 'retira'`. Con `descripcion IS NULL`
(columna **nullable** — `supabase/migrations/0008_tramitacion.sql:75`) el resultado es `NULL`,
y entonces `colapsable = es_urg and not es_retiro` = `true AND NOT NULL` = **NULL**, que el
`where colapsable` de la CTE `runs` descarta.

En TS, `esRetiroUrgencia` hace `/retira/i.test(e.descripcion ?? "")` → `false`, y el evento
`tipo='urgencia'` con descripción nula **SÍ es colapsable** (con `ukey = ""`).

Consecuencia directa: para cualquier boletín con al menos un evento de urgencia sin
descripción, la query mide `eventos_absorbidos` **menor** que el builder, y además rompe la
contigüidad de los runs vecinos (el evento sale de su partición, uniendo dos islas que en TS
están cortadas). El testigo `14309-04` tiene 0 descripciones nulas (verificado sobre el
fixture: `nulldesc = 0`), así que el defecto es **invisible en el número congelado** — la
query se declara "espejo" y no lo es. Esto responde el foco 3: **no es re-runnable con otro
boletín** sin arriesgar un número silenciosamente equivocado.

Riesgo simétrico y latente en `es_urg` (`:63`): `tipo='tramite' AND NULL` = `NULL` — hoy
converge con TS (`false`) por el `where colapsable`, pero por accidente, no por diseño.

**Fix:** normalizar el NULL antes de comparar, igual que hace el `?? ""` de TS.
```sql
with e as (
  select *,
    (tipo = 'urgencia' or (tipo = 'tramite' and coalesce(descripcion,'') ~* 'urgencia')) as es_urg,
    (coalesce(descripcion,'') ~* 'retira')                                              as es_retiro,
    ...
```
Y añadir al fixture-suite un caso con `descripcion: null` sobre `construirItems` + una
re-corrida de la query sobre un boletín que sí tenga nulos, para que el espejo quede probado
y no sólo declarado.

## Warnings

### WR-01: El orden total declarado `(fecha asc, id asc)` NO es el orden efectivo del builder

**File:** `supabase/queries/timeline-regla-de-seleccion.sql:23-33`, `app/components/timeline-view.tsx:157-166`
**Issue:** La query afirma que el orden total es `(fecha asc, id asc)` y que `construirItems`
lo "hereda" por estabilidad del sort. Falso en un caso: `construirItems` re-ordena con
`fechaValida()`, que devuelve `null` para fechas **fuera del rango plausible**
(`fechaPlausible`: piso `1990-01-01`, techo `now + 5 años`) y las manda **al final**. Postgres
ordena por el valor crudo. Un typo de siglo **bajo** (`0202-05-25`, `1907-…`) queda PRIMERO en
la query y ÚLTIMO en el render → runs distintos → `eventos_absorbidos`/`hitos_del` distintos.
El typo real conocido de PROD (`2626-05-25`, boletín `18232-25`) converge sólo porque es el
máximo. Los `fecha IS NULL` sí convergen (`order by fecha asc` = NULLS LAST en Postgres).

Segundo efecto: el techo de plausibilidad es `now + 5 años` ⇒ el orden del builder es
**dependiente del reloj**. Un evento fechado a >5 años vista hoy entra al orden cronológico
dentro de 5 años, cambiando H sin que cambie un dato — exactamente el no-determinismo que la
fase vino a cerrar, sólo que en otro eje.

**Fix:** espejar la plausibilidad en el `order by` de la query y declarar el techo móvil como
límite conocido:
```sql
row_number() over (
  order by (fecha >= timestamptz '1990-01-01'
            and fecha <= now() + interval '5 years') desc nulls last,
           fecha asc, id asc) as rn
```

### WR-02: `hitos_del` se vende como conteo DOM sin declarar sus dos precondiciones

**File:** `app/components/__fixtures__/timeline-14309-04.esperado.json:7`, `supabase/queries/timeline-regla-de-seleccion.sql:53-55`
**Issue:** El nombre `hitos_del` y el comentario del test (`grep -o 'Hito del' | wc -l` en 138)
prometen paridad con el DOM. El DOM real no da 85 en dos escenarios:
1. `?urgencias=uN` expande un período y renderiza sus eventos como `TimelineEvent`
   (`timeline-view.tsx:305-310`) ⇒ DOM = 85 + n(uN). El default es colapsado, pero la
   precondición no está escrita.
2. `TimelineEvent` sólo emite el `<span>Hito del …</span>` si `fecha && fechaPlausible(fecha)`
   (`timeline-event.tsx:101`) ⇒ un ítem `kind:"evento"` con fecha nula/implausible cuenta en
   `hitos_del` pero **no** aparece como "Hito del" en el HTML. `14309-04` no los tiene; otro
   boletín sí.

Phase 138 medirá contra el número congelado y leerá un mismatch como regresión.
**Fix:** añadir a `esperado.json` un campo `precondiciones: "sin ?urgencias; todos los eventos
con fecha plausible (verificado para 14309-04)"` y repetirlo en la cabecera de la query.

### WR-03: El mock `.order()` encadenable no asserta el orden total — el fix central de la fase queda sin guard

**File:** `app/app/proyecto/[boletin]/page.test.tsx:112-128`
**Issue:** `const chain = () => { const p = Promise.resolve(...); p.order = chain; return p; }`
descarta los argumentos. El mock acepta `.order()` con cualquier columna, cualquier dirección,
en cualquier cantidad — incluida **ninguna**: si alguien borra `.order("id", {ascending:true})`
de `page.tsx:472` (el fix H-06/D-03 completo), la suite sigue verde. El mock es correcto en
mecánica (re-encadenable, resuelve el thenable) pero enmascara exactamente la regresión que
esta fase existe para prevenir. Es el molde de falso-verde ya registrado en los gotchas v12.0.
**Fix:** grabar las llamadas y assertarlas.
```ts
const orderCalls: unknown[][] = [];
const chain = (...args: unknown[]) => {
  orderCalls.push(args);
  const p: any = Promise.resolve({ data: eventos, error: null });
  p.order = chain;
  return p;
};
// ...
it("lee tramitacion_evento con el orden total (fecha asc, id asc)", async () => {
  orderCalls.length = 0;
  await renderTramitacion();
  expect(orderCalls).toEqual([
    ["fecha", { ascending: true }],
    ["id", { ascending: true }],
  ]);
});
```

### WR-04: La lectura de `tramitacion_evento` no pagina — cap PostgREST de 1.000 filas rompe la paridad silenciosamente

**File:** `app/app/proyecto/[boletin]/page.tsx:460-472`
**Issue:** `.select("*").eq("boletin", …).order(...).order(...)` sin `.range()`. El gotcha
rector del repo (memoria v6.1) es que PostgREST corta en 1.000 filas por default. Para un
boletín con >1.000 eventos, `eventos.length` ≤ 1000 mientras la query documental cuenta
`count(*)` completo: la "regla escrita" y el render dejarían de coincidir sin ninguna señal, y
el timeline mostraría una tramitación **incompleta** presentada como completa (riesgo de
producto, no sólo de test). `14309-04` tiene 99 ⇒ latente.
**Fix:** paginar con `.range()` en bucle (patrón ya usado en el repo) o, como mínimo, medir el
máximo real de eventos por boletín y declarar el techo con una aserción que falle al acercarse.

### WR-05: La cabecera del pgTAP afirma más de lo que el pgTAP prueba (grant a `authenticated`/`public`)

**File:** `supabase/tests/0083_coautoria_v2.test.sql:11` vs `:67`
**Issue:** El comentario declara *"CERO grant execute a anon/authenticated/public
(doble-revoke re-emitido)"*, pero el único assert de privilegio es sobre `anon`
(`has_function_privilege('anon', …)`). `authenticated` y `PUBLIC` quedan sin verificar, aunque
la migración emite el revoke para ambos (`0083:65-66`). Es un cero **vacuo** sobre dos de los
tres principals — el mismo defecto que 0079 se propuso cerrar. `plan(12)` cuadra, así que
nadie lo nota.
**Fix:** añadir dos asserts y subir a `plan(14)`:
```sql
select is(has_function_privilege('authenticated', 'public.coautores_de_parlamentario_v2(text)', 'execute'), false,
          'authenticated SIN execute sobre coautores_de_parlamentario_v2');
select ok((select count(*) from aclexplode(coalesce(proacl, acldefault('f', proowner)))
           where grantee = 0 and privilege_type = 'EXECUTE') = 0,
          'PUBLIC SIN execute sobre coautores_de_parlamentario_v2')
  from pg_proc where oid = 'public.coautores_de_parlamentario_v2(text)'::regprocedure;
```

### WR-06: El test "cierra sin residuo" es tautológico — no ejerce una sola línea de implementación

**File:** `app/components/timeline-view.test.tsx:683-686`
**Issue:**
```ts
expect(esperado.hitos_del + esperado.eventos_absorbidos).toBe(esperado.eventos_totales);
```
compara tres literales del **mismo** JSON entre sí. `hitos_del` está *definido* en la query
como `eventos_totales - eventos_absorbidos` (`.sql:86`), así que la igualdad no puede fallar
salvo que alguien edite el JSON a mano. No toca `construirItems`, no toca el fixture salvo por
el `.length`. Tiene forma de guard y valor de cero. Los tres tests anteriores del `describe` sí
son reales; este diluye la señal.
**Fix:** o borrarlo, o convertirlo en el control que finge ser — que los ítems del builder
cubran los 99 eventos **sin duplicar ni perder ninguno**:
```ts
const cubiertos = items.flatMap((it) =>
  it.kind === "evento" ? [it.evento.id] : it.periodo.eventos.map((e) => e.id));
expect(new Set(cubiertos).size).toBe(fixtureEventos.length);
expect([...cubiertos].sort()).toEqual(fixtureEventos.map((e) => e.id).sort());
```

## Info

### IN-01: `prosrc ~ 'limit 20'` también matchea `limit 200`

**File:** `supabase/tests/0083_coautoria_v2.test.sql:58`
**Issue:** El regex no está anclado: si alguien alterara la viva a `limit 200`, el assert
"la viva conserva limit 20 (no fue alterada)" seguiría verde. Mismo patrón en `:63`
(`'limit 1000'` es menos expuesto, pero conviene simetría).
**Fix:** `~ 'limit 20\s*;'` / `~ 'limit 1000\s*;'`.

### IN-02: `D1178` hardcodeado acopla el pgTAP a datos de PROD

**File:** `supabase/tests/0083_coautoria_v2.test.sql:77`
**Issue:** El control de contenido positivo depende de que ese id exista y mantenga >20
coautores. Si el id desaparece, el test falla en rojo (fail-loud, aceptable) pero con un
mensaje que no explica que es un problema de fixture, no de la RPC.
**Fix:** derivar el sujeto en vez de fijarlo: `select id from public.parlamentario …` con
`group by`/`having count > 20 limit 1`, o dejar el id con un comentario que declare la
dependencia y cómo re-elegirlo.

### IN-03: Comentario obsoleto en `/comparar` tras la migración a la v2

**File:** `app/app/comparar/page.tsx:240-243`
**Issue:** *"los ejes de PAR (militancia / co-autoría) se leen en AMBAS direcciones (A y B):
el canal de datos de las RPCs viene cap-eado (limit 20)"*. Ya no es cierto para co-autoría
(`limit 1000` vía 0083) — el bloque de constantes de `:582-605` sí lo documenta bien, pero
este comentario contradice al de abajo y es el que se lee primero.
**Fix:** *"…cap-eado (militancia: 20; co-autoría: 1000 vía la v2 de 0083)"*.

---

## Focos de la revisión — respuesta directa

| # | Foco | Veredicto |
|---|------|-----------|
| 1 | ¿La v2 espeja el universo de la viva? | **Sí, exacto.** Diff = nombre + `limit`. Cero drift semántico. |
| 2 | ¿El cap parametrizado puede llegar al eje equivocado? | **No.** Default = CAP_RPC (20) sólo en militancia; co-autoría pasa CAP_RPC_COAUTORES explícito; comisiones no usa `interseccionPar`. Militancia sigue en 20 en su único call-site, con control apareado vivo. |
| 3 | ¿La query H-06 matchea `construirItems` byte-a-byte? ¿Re-runnable? | **No** — CR-01 (NULL descripcion) y WR-01 (fechas implausibles). Correcta para `14309-04`, no garantizada para otro boletín. |
| 4 | ¿Fixtures congelados honestos? | **Sí.** `esperado.json` trae `boletin`/`orden`/`medido_en`/`nota_reconciliacion`; el crudo es real (99 filas, ids no correlativos 1…8024, `fecha_captura` de PROD). Falta declarar precondiciones (WR-02). |
| 5 | ¿Copy de `/comparar` linter-safe, "N de M", cero afinidad? | **Sí.** "Comparten N", "Han co-firmado", indeterminado explícito con el cap correcto, totales por `total_n` y no por `.length`. Cero vocabulario de afinidad/bancada. |
| 6 | ¿El mock `.order()` encadenable es correcto y no enmascara? | Correcto en mecánica; **enmascara** — WR-03. |

---

_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Fixes Applied

**Fecha:** 2026-07-30 · **Alcance:** Critical + Warnings + los 3 Info (todos triviales)
**Resultado:** 10 de 10 findings corregidos, 0 saltados.
**La migración `0083_coautoria_v2.sql` NO fue tocada** (verificado: su último commit sigue
siendo `e4d515a`, el `feat(131-02)` de la propia fase). Los revokes ya están vivos en PROD;
sólo se editó el pgTAP, que corre contra el schema APLICADO.

| ID | Fix | Commit |
|----|-----|--------|
| CR-01 | `coalesce(descripcion,'')` en `es_urg` y `es_retiro` de la query documental | `85c04eb` |
| WR-01 | Plausibilidad de fecha como PRIMERA clave del orden total (espejo de `fechaValida`) | `20d37d2` |
| WR-02 | Precondiciones de `hitos_del` en query + `esperado.json` + describe del test | `20d37d2`, `c85ba86` |
| WR-06 | El test "cierra sin residuo" ahora ejerce `construirItems` (cobertura real de ids) | `c85ba86` |
| WR-03 | El mock `.order()` graba columnas; test assertea la cadena exacta + control apareado | `7c33a35` |
| WR-04 | Lectura de `tramitacion_evento` paginada con `.range()` (cap PostgREST 1.000) | `1aab37f` |
| WR-05 | pgTAP: cero-grant verificado en `authenticated` y `PUBLIC`, `plan(12)`→`plan(14)` | `42b16b9` |
| IN-01 | Regex de `limit` anclado (`limit 20\s*;`) — ya no matchea `limit 200` | `42b16b9` |
| IN-02 | Sujeto del control positivo DERIVADO en vez del `D1178` hardcodeado | `42b16b9` |
| IN-03 | Comentario obsoleto del cap de RPCs en `/comparar` | `22325eb` |

### Números de verificación (todos medidos, ninguno asumido)

- **Query documental contra PROD, testigo `14309-04`: `99|14|5|85`** — INVARIANTE tras CR-01
  y WR-01. El número congelado de `esperado.json` no se movió.
- **Control con el boletín del typo `2626-05-25` (`18232-25`): `26|2|1|24`**, estable bajo el
  nuevo orden con plausibilidad.
- **pgTAP `0083` contra PROD: `1..14`, 14/14 `ok`** (los 3 principals verificados).
- **`pnpm test`: 1644 passed / 108 files** (umbral ≥1641). **`pnpm guards`: 11 files, 334 passed.**
- **`npx tsc --noEmit`: limpio.**
- **Mutation-test de WR-03:** borrando `.order("id", {ascending:true})` de `page.tsx` el nuevo
  test se pone ROJO (`1 failed | 14 passed`) — el guard no es vacuo. Revertido.
- **Medidas de PROD que fundaron los fixes:** `0/48406` descripciones nulas hoy (CR-01 era
  latente, no activo, pero la columna es nullable); `2` eventos por encima del techo de
  plausibilidad (WR-01 real); máximo `733` eventos por boletín — `17142-05`, 73% del cap de
  1.000 (WR-04 latente y cercano, no hipotético).

### Cambio colateral (no pedido por un finding, pero exigido por el typecheck)

`TramitacionEventoRow` no declaraba `id`, **la columna de desempate sobre la que gira toda la
fase**. Se agregó como `id?: number` (opcional, no rompe los fixtures/tests que construyen
filas sin id; la lectura real hace `select("*")` y siempre lo trae).

### Deuda declarada, NO cerrada

- **Techo de plausibilidad móvil (`now + 5 años`)** — WR-01, segundo efecto. Queda ESPEJADO en
  ambos lados (query y builder se mueven juntos, que es lo que la paridad exige) y DECLARADO
  en la cabecera de la query, pero no congelado: un evento fechado a >5 años vista entra al
  orden cronológico dentro de 5 años y cambia H sin que cambie un dato. Cerrarlo exige
  rediseñar `fechaPlausible`, que es transversal a toda la app — fuera del alcance de 131.
- **`TramitacionEventoRow.descripcion` está tipado `string`** mientras la columna es NULLABLE
  (`0008:75`). El código ya lo trata como nullable (`?? ""` en `esRetiroUrgencia`/
  `esEventoUrgencia`), así que no hay bug vivo, pero el tipo miente. Cambiarlo a
  `string | null` ripplearía por varios componentes: no se tocó en esta pasada.

_Fixer: Claude (gsd-code-fixer)_
