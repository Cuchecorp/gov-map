---
phase: 130-votos-real-b-01-el-numero-falso-muere
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - supabase/migrations/0082_votos_conteo_de_parlamentario.sql
  - supabase/tests/0082_votos_conteo_de_parlamentario.test.sql
  - supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql
  - supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql
  - app/lib/parlamentario-resumen-conteos.ts
  - app/lib/parlamentario-resumen-conteos.test.ts
  - app/components/votos-por-parlamentario.tsx
  - app/components/votos-por-parlamentario.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/parlamentario/[id]/page.test.tsx
  - app/lib/types.ts
  - app/lib/lockdown-guard.test.ts
findings:
  critical: 3
  warning: 8
  info: 1
  total: 12
status: fixed
fixed_at: 2026-07-30
fixed: 10
deferred: 2
---

# Phase 130: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** standard
**Files Reviewed:** 10 (+2 auxiliares)
**Status:** issues_found

## Summary

El núcleo del fix es correcto: `0082` es aditiva, la firma viva de `votos_de_parlamentario`
no se tocó (D-03), el predicado del agregado (`parlamentario_id` + `estado_vinculo='confirmado'`
+ `join votacion`) es **byte-idéntico** al del listado (0078 L198-203) → la paridad
`sum(n) == count(*)` es estructural, no accidental. El chip/capa-1/"Ver detalle"/"Cómo votó"
tienen **un solo productor** (`contarCarriles`), la asistencia deriva de los agregados y no de
un `filter` sobre filas, y el desglose suma exacto por construcción (las 5 claves LOCKED, no
`Object.values`; selección fuera de dominio se ignora — y el dominio está cerrado por el CHECK
de `voto_seleccion_check`, 0019 L36-37, así que la rama de ignorar es inalcanzable hoy).

Las recalibraciones de 0077/0079 son **legítimas**: solo movieron denominadores de corpus
(`31/42→32/43`, `42/12→43/12`) por una función propia nueva; los asserts con poder de caza de
seguridad (0079 assert 25 "cero exec-anon en TODO el corpus propio" y el `/12` de service_role)
quedaron intactos y ahora cubren 0082 automáticamente. No se relajó ningún assert.

Lo que NO cierra: el error-path de fable_blocker_1 está cubierto solo en la rama `ausentes === 0`
(CR-01), la capa-1 fabrica ceros bajo un encabezado "—" cuando el RPC falla (CR-02), y la
credencial de PROD quedó expuesta en el log de la sesión de ejecución sin rotación confirmada
(CR-03).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: fable_blocker_1 cubre solo la rama `ausentes === 0` — con ausentes>0 el total capado se presenta como el real

**File:** `app/components/votos-por-parlamentario.tsx:676-682, 759-785`

**Issue:** El fix declarado ("el error-path jamás resucita B-01") solo actúa sobre
`totalEsSoloLoCargado`, que se consume **exclusivamente** en la rama `ausentes === 0`:

```tsx
{ausentes > 0 ? (
  <p>Presente en {presentes} de {totalConteos} votaciones · Ausente en {ausentes}.</p>
) : totalEsSoloLoCargado ? (
  <p>Emitió {totalConteos} votos sobre las votaciones cargadas en este detalle.</p>
) : (
  <p>Emitió {totalConteos} votos registrados.</p>
)}
```

Con `conteoGlobalDisponible === false` (agregado no disponible) y `ausentes > 0` — que es el
caso REAL de ambos testigos de la fase, D1165 (29 ausentes) y D1170 — el copy renderizado es
`Presente en 971 de 1000 votaciones`, sin ninguna calificación de alcance. Y el rótulo de
recorte tampoco aparece: `mostrarRecorte = materiaActiva === null && filasCargadas < totalConteos`
es **false** en ese camino, porque `totalConteos` sale del propio listado (`filasCargadas ===
totalConteos`). Resultado: "de 1000" leído como el total del registro — B-01 verbatim.

El test de la fase (`votos-por-parlamentario.test.tsx:1133`) fija `ausente: 0` *a propósito*
("es exactamente el camino donde B-01 resucitaría"), es decir, prueba la única rama que SÍ está
cubierta y no la rama dominante en producción.

**Fix:** que `totalEsSoloLoCargado` gobierne también la rama con ausentes:

```tsx
{ausentes > 0 ? (
  <p>
    Presente en <span className="font-mono">{presentes} de {totalConteos}</span>{" "}
    votaciones{totalEsSoloLoCargado ? " cargadas en este detalle" : ""} ·
    Ausente en <span className="font-mono">{ausentes}</span>.
  </p>
) : ...}
```
y añadir el test apareado con `ausente: 29, conteoGlobalDisponible: false` asertando que el DOM
NO contiene `de 1000 votaciones` pelado.

### CR-02: en el error-path la capa-1 pinta cuatro ceros fabricados bajo un encabezado que dice "—"

**File:** `app/app/parlamentario/[id]/page.tsx:585-590`; `app/lib/parlamentario-resumen-conteos.ts:460-477`; `app/components/capa1/votos-capa1.tsx:82-94`

**Issue:** `contarCarrilesSeguro` degrada un fallo del RPC a `conteosDesconocidos()`, que emite
`votosBreakdown = {si:0,no:0,abstencion:0,pareo:0,ausente:0}` y `votos: {tipo:"no_ingerido"}`.
`CarrilHeader` respeta el 3-estado y muestra `—`, pero `<VotosCapa1>` se monta
**incondicionalmente** con ese breakdown y renderiza cuatro KPIs `0` a 24px:
`0 a favor · 0 en contra · 0 abstención · 0 ausente`. El ciudadano lee "este parlamentario votó
0 veces" cuando el hecho es "no pudimos leer el conteo".

Es exactamente el defecto que 122-05 corrigió para lobby y que está documentado en el comentario
de `page.tsx:621-627` ("colapsaba `vacio` y `no_ingerido` al literal `0`"): `LobbyCapa1` recibe
`estado={conteos.lobby}` y omite el conteo; `VotosCapa1` no recibe estado alguno. Es preexistente,
pero cae de lleno en el mandato de esta fase ("el número falso muere") y la fase enruta ahora
chip+capa-1 por un RPC nuevo, sin ampliar la protección.

**Fix:** pasar el `CarrilEstado` a la capa-1 y omitir las cifras cuando no es `dato` (espejo
byte-a-byte de `LobbyCapa1`):

```tsx
<VotosCapa1
  breakdown={conteos.votosBreakdown}
  asistencia={conteos.asistencia}
  estado={conteos.votos}
/>
// en votos-capa1.tsx: if (estado.tipo !== "dato") return null;  (o rótulo honesto)
```

### CR-03: credencial de PROD expuesta en el log de ejecución, sin rotación confirmada

**File:** `.planning/phases/130-votos-real-b-01-el-numero-falso-muere/130-01-SUMMARY.md:105-111`

**Issue:** El propio SUMMARY documenta que un `grep` de diagnóstico sobre `.env` volcó la
`$DBURL` completa (usuario y host del pooler: `[REDACTADO — ver nota de rotación B26]`,
redactados aquí y en el SUMMARY por el fix de CR-03) a la transcripción. El usuario y el host quedan además
**versionados en el repo** dentro del propio SUMMARY (la contraseña no, pero medio secreto
publicado reduce el trabajo del atacante y el SUMMARY queda en `git` indefinidamente). Además,
Plan 03 creó `app/.env.local` con `SUPABASE_SECRET_KEY` — gitignorado (verificado por patrón),
pero es una copia adicional de la service key en el árbol de trabajo.

**Fix:** (1) rotar la contraseña del rol de PROD; (2) editar el SUMMARY para reemplazar el
usuario/host por `<redactado>` (el hecho de la exposición debe quedar, el valor no); (3) declarar
`app/.env.local` en el checklist de limpieza post-verificación o sustituirlo por `dotenv -e ../.env`.

## Warnings

### WR-01: la rama `: null` de `conteosGlobales` es código muerto — el fallback nunca se ejerce en producción

**File:** `app/app/parlamentario/[id]/page.tsx:591, 601-603`
**Issue:** `<VotosSection>` se monta dentro de `{conteos.votos.tipo === "dato" && (...)}`, y dentro
se vuelve a evaluar `conteos.votos.tipo === "dato" ? conteos.votosBreakdown : null`. TypeScript ya
estrechó el tipo; la rama `null` es inalcanzable. Consecuencia real: el camino
`conteoGlobalDisponible === false` (y por tanto todo el fix de fable_blocker_1) **jamás se ejecuta
desde la página** — su única cobertura es un prop sintético en vitest. La invariante "el error-path
no resucita B-01" es hoy verdadera *por vacuidad*, no por el fix.
**Fix:** eliminar el ternario redundante (`conteosGlobales={conteos.votosBreakdown}`) y decidir
explícitamente qué debe pasar cuando el conteo falla: hoy la sección entera desaparece. Si el
fallback debe existir, montar `VotosSection` también en `no_ingerido` con `conteosGlobales={null}`
— y entonces CR-01 pasa a ser explotable.

### WR-02: el assert 10 de pgTAP ("cierre de dominio GLOBAL") es vacuo por construcción y ciego a NULL

**File:** `supabase/tests/0082_votos_conteo_de_parlamentario.test.sql:90-95`
**Issue:** `voto.seleccion` es `text not null check (seleccion in ('si','no','abstencion','pareo','ausente'))`
(0008 L61 + 0019 L36-37). El assert cuenta filas fuera de ese conjunto: **el motor ya lo impide**,
así que solo puede fallar si alguien dropea el constraint — y en ese escenario exacto el assert
falla igual de tarde, porque `seleccion not in (...)` con `seleccion IS NULL` evalúa a NULL, no a
true: una fila NULL **no** sería contada. Es decir, el único modo de fallo nuevo que el constraint
dejaría entrar es justamente el que este assert no ve.
**Fix:** medir la garantía, no su consecuencia:
```sql
select ok(exists(select 1 from pg_constraint
  where conrelid='public.voto'::regclass and conname='voto_seleccion_check'),
  'el CHECK de dominio de voto.seleccion sigue vivo');
-- y, si se mantiene el conteo:
where v.seleccion is null or v.seleccion not in ('si','no','abstencion','pareo','ausente')
```

### WR-03: el centinela de no-fan-out (assert 9) no tiene control positivo apareado

**File:** `supabase/tests/0082_votos_conteo_de_parlamentario.test.sql:76-84`
**Issue:** Compara `count(*)` con y sin los LEFT JOIN sobre el testigo hardcodeado `D1165`. Si
D1165 desaparece o cambia de ID, ambos lados dan `0` y el assert queda **verde y vacío** — el
mismo modo de falso-verde que el assert 8 sí neutraliza con su control `> 1000`. El assert 8
protege su propia vacuidad; el 9 no hereda esa protección (son asserts independientes).
**Fix:** encadenar el control (`and (select count(*) ...) > 1000`) dentro del propio assert 9, o
derivar el testigo dinámicamente (`order by count desc limit 1`) en vez de hardcodear D1165.

### WR-04: con faceta de tema activa NO hay ningún rótulo de alcance — el desglose por tema sigue saliendo del listado capado

**File:** `app/components/votos-por-parlamentario.tsx:676-682, 993-1008`
**Issue:** Con `materiaActiva !== null`, `conteosGlobales` se ignora (correcto, WR-01 histórico),
pero además `mostrarRecorte` y `totalEsSoloLoCargado` se apagan **los dos** por su guarda
`materiaActiva === null`. El desglose de "Cómo votó" bajo un chip de tema se computa sobre ≤1000
filas ordenadas por `fecha desc` y se presenta sin declarar que es un subconjunto recortado — la
misma clase de dato distorsionado de B-01, un nivel más abajo. Para D1165 (3.752 votos) cualquier
tema muestra composición sesgada al último tramo temporal.
**Fix:** cuando hay tema activo y el listado global está recortado
(`conteosGlobales && filasCargadas < sum(conteosGlobales)`), emitir un rótulo del tipo "sobre las
{filasCargadas} votaciones más recientes cargadas", o declarar el tema como deuda OQ-1 explícita
igual que el chart.

### WR-05: el chart y `totalProyectos` contradicen numéricamente a la barra que está inmediatamente encima

**File:** `app/components/votos-por-parlamentario.tsx:708-727, 868-875, 1024-1029`
**Issue:** Tras el fix, en la misma pantalla conviven "Presente en 3723 de 3752" (agregado real) y
un chart cuyas barras suman ≤1000, más "Se registran votaciones de 191 proyectos" (derivado de las
mismas 1000 filas). Está declarado como OQ-1 y los rótulos existen, pero dos cifras del mismo
dominio que no reconcilian en una sola vista siguen siendo un defecto de comprensión, no solo de
alcance.
**Fix (fuera de DEBT-01, para el backlog):** RPC de `count(distinct proyecto_id)` y de agregado
por trimestre sobre el universo completo; entretanto, mover el chart y la nota de proyectos DEBAJO
del rótulo de recorte para que la calificación preceda a las cifras que califica.

### WR-06: `VotoConteoRow` está definido en `types.ts` y no lo usa nadie — el consumidor redeclara el shape inline

**File:** `app/lib/types.ts:356-359`; `app/lib/parlamentario-resumen-conteos.ts:107-108, 291-292`
**Issue:** El tipo canónico documentado (`VotoConteoRow`) no tiene ni una referencia; tanto
`agregarConteoVotos` como el cast del `.rpc()` usan `{ seleccion: string; n: number }` literal.
Dos definiciones del mismo contrato = deriva silenciosa el día que el RPC gane una columna.
**Fix:** importar y usar `VotoConteoRow` en ambos puntos, o borrar el tipo.

### WR-07: el centinela D-05 solo muerde sobre el label del trigger, no sobre el desglose de la sección

**File:** `app/app/parlamentario/[id]/page.test.tsx:447-494`
**Issue:** Los dos asserts (`toContain("Ver detalle (3752)")` /
`not.toContain("Ver detalle (3)")`) leen el label de `DetalleColapsable`, que sale de
`conteos.votos.n`. Si alguien revierte el prop `conteosGlobales` (dejando `VotosSection` calculando
del listado) el trigger sigue diciendo 3752 y **ambos asserts pasan**, mientras "Cómo votó" vuelve
a mentir. El centinela cubre el chip, no la sección — que es donde vive la composición.
**Fix:** añadir al mismo test un assert sobre el `aria-label` de la barra
(`/A favor: 1764, En contra: 1772/`) y su negativo apareado (`not.toContain("A favor: 1,")`).

### WR-08: `limit 1000` sin `order by` en un agregado — truncamiento silencioso si el dominio creciera

**File:** `supabase/migrations/0082_votos_conteo_de_parlamentario.sql:74`
**Issue:** El piso LOCKED del régimen se cumple, pero sobre un `group by` **sin `order by`** un
`limit` recorta filas arbitrarias. Hoy son 5 grupos (CHECK cerrado), así que es inofensivo; el
riesgo es que el día que el dominio se abra el efecto no sea "faltan categorías raras" sino
"faltan categorías al azar", y el total mostrado bajaría en silencio — clase B-01 otra vez.
**Fix:** `order by v.seleccion limit 1000` (determinista y gratis a 5 filas).

## Info

### IN-01: 0077 assert 19 cuenta por `prosrc like '%statement_timeout%'`

**File:** `supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql:150-158`
**Issue:** El predicado del denominador cuenta como "acotada" cualquier función que **mencione**
la cadena en su cuerpo (un comentario bastaría), no solo las que la fijan en `proconfig`.
Preexistente y declarado como "Q-13bis VERBATIM"; se registra porque la recalibración de esta fase
lo hereda. **Fix:** ninguno requerido ahora; si se toca, restringir a `proconfig`.

---

## Verificaciones que SÍ pasaron (y por qué no son findings)

- **Recalibración 0077/0079 — legítima.** Solo cambiaron literales de denominador de corpus
  (`'31/42'→'32/43'`, `'42/12'→'43/12'`) con comentario que explica la causa. Los asserts
  portadores de la propiedad de seguridad — 0079 assert 25 (`cero funciones propias de public
  ejecutables por anon`, sobre TODO el corpus, sin lista blanca) y el `/12` de `service_role` del
  assert 26 — **no se tocaron** y ahora cubren `votos_conteo_de_parlamentario` automáticamente.
  Ningún assert se relajó, ninguna función se sacó de un conjunto medido.
- **Suma exacta del desglose.** `votosTotal` suma las 5 claves LOCKED explícitamente
  (`parlamentario-resumen-conteos.ts:298-303`), no `Object.values`; `VotosView` recomputa
  `totalConteos` sobre `SELECCION_ORDEN` — misma base, imposible que barra y total diverjan.
  La rama "selección desconocida se ignora" es inalcanzable bajo `voto_seleccion_check`.
- **Asistencia derivada de agregados**, no del listado: `presentes = votosTotal − ausente`
  (L309-315), y `null` cuando el total es 0 (cero "0 de 0" fabricado).
- **D-03 respetado:** `votos_de_parlamentario` no aparece modificada en ninguna migración de la
  fase; `p_limit: 1000` intacto en `votos-por-parlamentario.tsx:1093` (cero clamp).
- **Paridad estructural:** el `where` del agregado (0082 L72) es idéntico al del listado
  (0078 L203) — la paridad medida en PROD no es coincidencia de datos.
- **Aguja completa:** secdef + `search_path=''` + schema-qualified + `statement_timeout=5s` +
  doble-revoke + post-check fail-closed + alta en `PUBLIC_RPC_ALLOWLIST` + shape PII-safe
  `(seleccion text, n bigint)` asertado por `pg_get_function_result`. Nada que objetar.

---

## Fixes Applied

**Fixed:** 2026-07-30 · **Resueltos:** 10/12 · **Diferidos:** 2 (WR-05 backlog, IN-01 sin acción requerida)

**Verificación:** `pnpm test` 1707/1707 verde (112 archivos) · `pnpm guards` 11/11 archivos, 339 tests · `tsc --noEmit` limpio · pgTAP `0082` contra PROD **12/12 ok** (`plan(11)→plan(12)`).

| ID | Estado | Commit | Qué se hizo |
|----|--------|--------|-------------|
| CR-01 | fixed | `de58f63` | `totalEsSoloLoCargado` gobierna TAMBIÉN la rama `ausentes > 0` (la dominante en PROD: D1165/D1170). Test apareado con `ausente: 29, conteoGlobalDisponible: false` + control negativo (con agregado el copy queda pelado). |
| CR-02 | fixed | `0075867` | `VotosCapa1` recibe el `CarrilEstado` completo y omite TODA cifra si `tipo !== "dato"` — espejo byte-a-byte de `LobbyCapa1` (122-05). Test con control positivo/negativo apareado sobre `conteosDesconocidos()`. |
| CR-03 | fixed (parcial, requiere operador) | `378dc79` | Usuario/host del pooler redactados en `130-01-SUMMARY.md` y en este REVIEW (`[REDACTADO — ver nota de rotación B26]`). **NO se reescribió la historia git**: el valor sigue en commits locales previos; **la rotación B26 del operador es lo que sanea definitivamente la exposición**. `app/.env.local`: verificado gitignored (`git check-ignore` → `app/.gitignore:34 .env*`), **NO se borra** (la fase 138 lo necesita); queda documentado como copia local del secreto dentro del alcance de B26. |
| WR-01 | fixed | `0075867` | Eliminado el ternario muerto por narrowing; el detalle se monta TAMBIÉN bajo `no_ingerido` (único origen para votos: el RPC de conteo caído) con `conteosGlobales` null y trigger sin número fabricado. El fix de fable_blocker_1 pasa a ser **alcanzable desde la página** en vez de verdadero por vacuidad. |
| WR-02 | fixed | `ed049d5` | Se mide la GARANTÍA: nuevo assert de que `voto_seleccion_check` sigue vivo (primera línea) + el conteo de fuera-de-dominio incluye `seleccion is null` (hueco NULL-blind cerrado). |
| WR-03 | fixed | `ed049d5` | Control positivo `> 1000` **encadenado dentro** del assert 9 (`is` → `ok`): si D1165 desapareciera, el centinela ya no queda verde y vacío. |
| WR-04 | fixed | `de58f63` | Nuevo `listadoRecortado` (comparado SIEMPRE contra el agregado global, haya tema o no) + rótulo de alcance con faceta activa, con control de ausencia apareado. |
| WR-05 | **diferido** (backlog) | — | Exige RPC nuevo (`count(distinct proyecto_id)` + agregado por trimestre sobre el universo completo) ⇒ **DDL**, y `0082` está aplicada e intocable. Sigue declarado como OQ-1. |
| WR-06 | fixed | `0075867` | `agregarConteoVotos` y el cast del `.rpc()` usan el tipo canónico `VotoConteoRow`. |
| WR-07 | fixed (**con corrección del fix sugerido**) | `0075867` | El assert propuesto por el review (`aria-label` de la barra) resultó **FALSO VERDE**: esa cadena la emite `VotosCapa1`, no la sección, y al mutar (`conteosGlobales` → `null`) el test seguía en verde. Causa raíz: `renderToStaticMarkup` es síncrono y NO atraviesa el `<Suspense>` async de `VotosSection` (sale el skeleton). Se reemplazó por dos centinelas que sí muerden — (a) render DIRECTO de `VotosSection` (awaited) asertando la línea a11y `"A favor 1764 · En contra 1772 · …"` + negativo apareado `"A favor 1 · En contra 1"`, (b) source-scan del wiring del prop. **Mutación verificada: revertir el prop deja ambos en rojo, restaurarlo en verde.** |
| WR-08 | fixed (documentado; DDL diferido) | `ed049d5` | **Requiere DDL que NO se aplicó**: `order by v.seleccion limit 1000` viviría en `0082`, que está APLICADA e INTOCABLE ⇒ tendría que entrar por una migración futura (p. ej. `0083`). Se documentó en el pgTAP y el riesgo real (truncamiento silencioso si el dominio se abriera) queda cazado por los asserts 10-11, que se ponen rojos ANTES de que el `limit` pueda truncar. |
| IN-01 | sin acción | — | El propio review lo marca "ninguno requerido ahora" (preexistente, Q-13bis VERBATIM). |

**Para el operador:**
1. **Rotación B26** de la contraseña del rol de PROD — es lo que cierra CR-03 de verdad (la redacción sólo detiene la publicación hacia adelante).
2. **DDL pendiente (WR-08):** si algún día se abre el dominio de `voto.seleccion`, hace falta una migración nueva con `order by v.seleccion` en el agregado de `0082`.
3. **WR-05** queda en backlog (necesita RPC nuevo).

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
