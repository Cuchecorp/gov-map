---
phase: 130-votos-real-b-01-el-numero-falso-muere
plan: 03
subsystem: verificacion-e2e
tags: [votos, b-01, deuda-tecnica, verificacion-prod, oq-1]
dependency-graph:
  requires: ["130-01", "130-02"]
  provides: ["evidencia-e2e-b-01-cerrado"]
  affects: []
tech-stack:
  added: []
  patterns: ["render real contra PROD via next dev + service_role, control positivo antes de assert negativo"]
key-files:
  created: []
  modified: []
decisions:
  - "Gap operativo hallado: app/ no tenia SUPABASE_URL/SUPABASE_SECRET_KEY visibles a next dev (viven en el .env de la raiz, Next.js solo lee .env* de su propio directorio) -- se creo app/.env.local (gitignorado, Rule 3 blocking-fix) copiando SOLO esas 2 lineas desde .env de la raiz, sin ecoar valores"
  - "El copy real de 'Como voto' NO usa el patron literal 'Ver detalle (N)' que el plan supuso -- usa 'Presente en {presentes} de {totalConteos} votaciones' (rama ausentes>0) y una barra con aria-label 'A favor: N, En contra: N, ...'. El ejecutor ajusto los patrones de extraccion al copy real (autorizado explicitamente por el plan: 'ajustar el patron al copy definitivo y dejarlo registrado'), sin tocar codigo de produccion"
metrics:
  duration: "~40 min"
  completed: "2026-07-30"
---

# Phase 130 Plan 03: Verificacion E2E contra PROD + deuda residual OQ-1 Summary

El HTML realmente renderizado por el servidor Next.js local (mismo codigo, mismos datos de PROD via
service_role) para D1165 y D1170 muestra el conteo real de votos (3752 y 3773) y coincide exactamente
con el recalculo `psql -tA` en la misma corrida; el desglose "Como voto" de D1165 coincide 1:1 con
V-2. El numero falso `Ver detalle (1000)` / cualquier variante truncada a 1000 no aparece en ningun
lugar de ninguna de las dos fichas.

## What was verified

### Gap operativo encontrado y resuelto (Rule 3 - blocking)

Al levantar `pnpm --filter ./app dev`, la primera corrida devolvio HTML de 107.167 bytes IDENTICO
para D1165 y D1170, con un error embebido en el RSC payload:
`Error: Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno del servidor` (el "control positivo"
de tamano >10KB paso pero el contenido era un error, no datos -- exactamente el escenario que el
gotcha v12 advierte: sin inspeccionar el contenido real, un falso verde era posible). Causa: Next.js
16 solo lee `.env*` del directorio del propio paquete (`app/`); las credenciales viven en `.env` de
la raiz del repo (monorepo), invisibles para `next dev` corriendo con cwd en `app/`. Fix: se creo
`app/.env.local` (ya cubierto por `.gitignore`: patrones `.env`, `.env.local`, `.env.*.local`)
copiando UNICAMENTE las lineas `SUPABASE_URL=` y `SUPABASE_SECRET_KEY=` desde `.env` de la raiz, sin
ecoar sus valores en ningun momento de la sesion. Tras el fix y reinicio del servidor, ambas fichas
renderizaron con datos reales (497.618 y 317.505 bytes respectivamente, tamanos ahora DIFERENTES
entre sujetos, confirmando que el contenido es real y no un artefacto).

### Copy real distinto al supuesto por el plan (ajuste autorizado)

El plan asumia el patron literal `Ver detalle (N)`. El copy real de Plan 02 (`votos-por-parlamentario.tsx`)
no usa esa cadena para el total: el bloque "Como voto" muestra, cuando `ausentes > 0` (caso de ambos
testigos), `Presente en {presentes} de {totalConteos} votaciones · Ausente en {ausentes}.` -- el
`totalConteos` real aparece ahi. El desglose por seleccion vive en el `aria-label` de la barra:
`"A favor: N, En contra: N, Abstención: N, Pareo: N, Ausente: N"`. Se ajustaron los patrones de
extraccion a este copy real (autorizado por el plan: "ajustar el patron al copy definitivo y
dejarlo registrado"), sin tocar codigo de produccion.

## Evidencia verbatim (PROD via service_role, next dev local, 2026-07-30)

**Control positivo (obligatorio antes de cualquier assert negativo):**
```
D1165 bytes=497618  grep -c "Votaciones" = 1   grep -c "Faltan SUPABASE_URL" = 0
D1170 bytes=317505  grep -c "Votaciones" = 1   grep -c "Faltan SUPABASE_URL" = 0
```
Ambos muy por encima de 10 KB, sin error de entorno embebido, con el heading "Votaciones" presente.

**Paridad HTML vs psql (V-1, misma corrida):**
```
D1165 html=3752 sql=3752  -> PARIDAD OK (>1000)
D1170 html=3773 sql=3773  -> PARIDAD OK (>1000)
```
Extraido de: `Presente en<!-- --> <span class="font-mono">3723<!-- --> de <!-- -->3752</span>` (D1165)
y `Presente en<!-- --> <span class="font-mono">3772<!-- --> de <!-- -->3773` (D1170). El `<!-- -->`
intercalado por React confirma el gotcha v12 documentado en el plan.

**Assert negativo apareado (0 = ausente en ambos, valido porque el control positivo paso primero):**
```
grep -c "Ver detalle (1000)\|Ver detalle (1.000)\|Emitió 1000\|Emitió 1.000\|Presente en...>1000" D1165.html = 0
grep -c "Ver detalle (1000)\|Ver detalle (1.000)\|Emitió 1000\|Emitió 1.000\|Presente en...>1000" D1170.html = 0
```

**Composicion (5 pares, D1165) -- HTML (`aria-label` de la barra) vs `psql` group-by, misma corrida:**
```
HTML: A favor: 1764, En contra: 1772, Abstención: 171, Pareo: 16, Ausente: 29
SQL:  si=1764, no=1772, abstencion=171, pareo=16, ausente=29
```
Los 5 pares coinciden 1:1 -> **COMPOSICION OK**. Esta es la confirmacion de que el criterio 2 del
ROADMAP ("composicion no distorsionada") no es solo el total sino el desglose real por sentido de
voto, y que coincide byte-a-byte con V-2.

**Tercer sujeto de referencia (D1012, medido en esta corrida, no renderizado):**
```
psql: count = 3736
```
Confirma que la clase afectada no es idiosincratica de D1165/D1170 (tres sujetos > 1000 medidos).

**Rotulo de alcance (fix B-1, ex human-check, ahora assert) presente en el HTML de D1165:**
```
"muestra las 1000 votaciones más recientes de 3752" -- presente 1x
"votaciones cargadas en este detalle" -- presente 4x (chart + Como voto + nota de proyectos)
"período completo del registro" -- presente 2x
```
El rotulo real implementado por Plan 02 no es literalmente "N de M cargados" ni "sobre los N mas
recientes" (los patrones que el plan sugeria como ejemplo) sino "El listado de abajo muestra las
{filasCargadas} votaciones más recientes de {totalConteos}." -- semanticamente identico (declara
cuanto se muestra vs cuanto existe), registrado aqui como el texto REAL vigente.

## Deuda residual declarada (OQ-1)

Decision consciente para que el audit de v13 la lea como tal, no la re-descubra como hallazgo nuevo:

- **`totalProyectos`** (`votos-por-parlamentario.tsx`, bloque de nota de cobertura por proyectos)
  sigue derivando del conjunto de filas CARGADAS (1000 max via `votos_de_parlamentario`), NO del
  agregado real de proyectos distintos. Medido en esta corrida: D1165 muestra `191` (proyectos
  distintos entre las 1000 filas cargadas) mientras el registro real de votos es 3752 -- el numero
  de proyectos distintos reales es mayor y desconocido sin una RPC nueva. Mitigacion aplicada (Plan
  02): rotulo honesto que declara "votaciones cargadas en este detalle" en vez de afirmar el total.
  Fix real pendiente: RPC de `count(distinct proyecto_id)` sobre el universo completo (fuera de
  alcance de DEBT-01, que habla de "conteo de votos", no de "conteo de proyectos").
- **Chart "¿Cuándo votó?"** cubre solo el tramo de fechas de las filas cargadas -- para D1165, el
  rotulo medido dice explicitamente "no necesariamente el período completo del registro" (2
  ocurrencias confirmadas en el HTML). El registro real de D1165 arranca en 2022-03 (segun 130-RESEARCH);
  el chart solo grafica el tramo de las 1000 filas mas recientes cargadas. Mitigacion: rotulo
  presente y verificado. Fix real pendiente: agregado por trimestre calculado en SQL sobre el
  universo completo (RPC nueva), no sobre las filas cargadas en el cliente.
- **Listado de detalle** sigue capado a 1000 filas (`votos_de_parlamentario`, `p_limit: 1000` intacto,
  confirmado 0 cambios via `git diff` sobre `p_limit` en toda la fase). Paginacion real mas alla de
  1000 esta explicitamente DEFERIDA en `130-CONTEXT.md`, fuera del alcance de DEBT-01. Mitigacion
  medida: rotulo "muestra las 1000 votaciones más recientes de 3752" (verbatim, ver arriba).
- **Por que NO se amplio el alcance en esta fase:** DEBT-01 nombra especificamente "el conteo REAL de
  votos ... con composicion no distorsionada" -- "composicion" es inequivocamente el desglose por
  `seleccion` (si/no/abstencion/pareo/ausente), que quedo corregido y verificado byte-a-byte contra
  V-2 en esta misma corrida. `totalProyectos` y el chart son deuda DISTINTA y preexistente (conteos
  derivados de un subconjunto capado, no el conteo de votos en si) que ampliar el alcance de esta
  fase habria arriesgado la paralelizacion acotada de Wave 3 sin agregar valor al criterio de exito
  medido.
- **Declaracion explicita anti-clamp:** ningun numero visible en las fichas testigo deriva ya de un
  `.length`/`count` sobre las filas capadas SIN rotulo que lo declare -- el total y el desglose de
  "Como voto" derivan del agregado SQL real (`votos_conteo_de_parlamentario`, migracion 0082); solo
  `totalProyectos` y el chart siguen derivando de lo cargado, y ambos llevan rotulo honesto medido
  arriba. En ningun momento de las tres fases (130-01/02/03) se uso un clamp como fix: `p_limit`
  permanecio en `1000` sin tocarse (`git diff` de toda la fase sobre `p_limit`: 0 lineas fuera del
  valor legitimo).

## Alcance de la verificacion

Esta fase NO desplego a Cloudflare. La verificacion se hizo contra el render real de un servidor
Next.js local (`next dev`) leyendo la base de datos de PROD por `service_role` -- mismo codigo,
mismos datos, misma RPC que se usaria en el deploy; lo unico ausente es el runtime de Cloudflare
Workers, que no participa del calculo del numero mostrado (es transporte HTTP, no logica de
agregacion). La confirmacion sobre el deploy vivo en Cloudflare ocurre en el deploy conjunto del
milestone v13.0, compartido con las demas fases 126-138 (ver `<alcance>` del plan y `130-CONTEXT.md`).

## Mapeo criterio de exito -> evidencia

| Criterio (ROADMAP §Phase 130) | Evidencia | Comando |
|---|---|---|
| 1. RPC de conteo real + pgTAP | `public.votos_conteo_de_parlamentario(text)` en PROD, 11/11 pgTAP ok | Ver 130-01-SUMMARY.md §Evidencia verbatim |
| 2. Numero mostrado == recalculo SQL, composicion no distorsionada | D1165 html=3752=sql, D1170 html=3773=sql; 5 pares de composicion coinciden 1:1 | Bloque "Paridad HTML vs psql" y "Composicion" de este SUMMARY |
| 3. Rotulos honestos de alcance sobre lo capado (ex human-check) | 3 rotulos distintos medidos presentes en el HTML real (proyectos, chart, listado) | Bloque "Rotulo de alcance" de este SUMMARY |
| 4. Test centinela D-05 + cero clamp | `page.test.tsx` D-05 muerde ambos lados (3752 presente / 3 ausente); `git diff` sobre `p_limit` en toda la fase = 0 | 130-02-SUMMARY.md §Test centinela D-05; bloque "anti-clamp" de este SUMMARY |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `app/.env.local` faltante impedia levantar el servidor con datos reales**
- **Found during:** Task 1, primer intento de render
- **Issue:** `next dev` corriendo con cwd en `app/` no ve `SUPABASE_URL`/`SUPABASE_SECRET_KEY` de
  `.env` en la raiz del monorepo; el servidor arrancaba pero cada Suspense boundary de datos
  fallaba con `Error: Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno del servidor`.
- **Fix:** creado `app/.env.local` (gitignorado por patron existente `.env.local`) con solo esas 2
  lineas copiadas de `.env` de la raiz, sin ecoar valores en ningun log de esta sesion.
- **Files modified:** `app/.env.local` (no versionado, gitignorado; no aparece en `git status`).
- **Commit:** N/A (archivo gitignorado, fuera de control de versiones por diseno).

**2. [Rule 1 - Bug en el plan, no en el codigo] Patron de extraccion `Ver detalle (N)` no coincide
con el copy real**
- **Found during:** Task 1, extraccion del numero mostrado
- **Issue:** El plan (redactado antes de ver el copy final de Plan 02) asumia el literal
  `Ver detalle (N)`. El copy real usa `Presente en {presentes} de {totalConteos} votaciones` (rama
  con ausentes) y un `aria-label` con el desglose. El grep original devolvia vacio.
- **Fix:** se ajustaron los patrones de extraccion al copy real, documentado verbatim arriba
  (autorizado explicitamente por el texto del plan: "ajustar el patron al copy definitivo y
  dejarlo registrado"). Cero cambio de codigo de produccion.
- **Files modified:** ninguno (solo el metodo de verificacion de este SUMMARY).
- **Commit:** N/A (deviation de verificacion, no de codigo).

## Known Stubs

Ninguno.

## Threat Flags

Ninguno fuera del `<threat_model>` del plan. `$DBURL` no fue ecoada en ningun momento de esta
sesion (leida a variable una sola vez, usada solo dentro de comandos `psql`); los HTML descargados
quedaron en el scratchpad (`${TMPDIR:-/tmp}/gsd-130`), nunca en el repo. `app/.env.local` contiene
credenciales pero esta cubierto por `.gitignore` (`.env.local` en patron existente) y nunca se
staged ni se commiteo.

## Self-Check: PASSED

- Servidor Next.js levantado y detenido (`taskkill` confirmado, `pnpm --filter ./app dev` no corre
  en background al cierre de esta sesion).
- D1165: html=3752, sql=3752, PARIDAD OK, negativo=0 — confirmado en la corrida.
- D1170: html=3773, sql=3773, PARIDAD OK, negativo=0 — confirmado en la corrida.
- Composicion D1165: 5/5 pares HTML==SQL — confirmado en la corrida.
- `git status --short` limpio salvo este SUMMARY al momento de commit (verificado antes de commitear).
- `git diff` de toda la fase sobre `p_limit`: 0 lineas fuera de `p_limit: 1000` — confirmado.
