---
phase: 125-e2e-pasada-final-producto-a-producto
verified: 2026-07-29T22:50:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
verificador: Claude Opus 5 (gsd-verifier, goal-backward, stance FORCE)
metodo: re-medición independiente sobre el deploy vivo + PROD SQL read-only + suite/tsc/guards corridos por el verificador
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "H-03 (`4.9-A1`) — abrir `/red?seed=D1165` en un navegador visible, hacer click en una tarjeta de vecino y comprobar a ojo si aparece un enlace `/red?seed=<vecinoId>`"
    expected: "La tarjeta del vecino expande y emite el href `/red?seed=<vecinoId>` (red-graph.tsx:210)"
    why_human: "El click se ejecutó bajo página oculta y la tarjeta no expandió. `NOT OBSERVED` — ni PASS ni defecto. Fabricar el reveal vía `$RC` está prohibido; solo una sesión de navegador visible lo cierra"
  - test: "H-01 — recargar `/comparar?a=D1170&b=D1165` varias veces y observar si aparece el error boundary «No pudimos cargar la portada» tras hidratación"
    expected: "Portada de comparación sin error boundary"
    why_human: "Observado 1 de 2 veces, re-test 3/3 limpio ⇒ transitorio. No es reproducible por curl (solo tras hidratación) y su fix exige re-deploy, fuera del alcance de esta fase"
  - test: "P-1 (opcional) — lectura fría de las 82 filas de `122-CRUCES-SQL.md`: ¿se auditan sin abrir el código?"
    expected: "Un lector puede seguir cada fila hasta su query y su superficie sin leer el código"
    why_human: "Era el ítem 3 (opcional) del gate humano; el operador NO lo ejerció. No se declara aprobado ni rechazado"
  - test: "H-06 — decidir si el timeline de `/proyecto/14309-04` debe mostrar 99 o 85 hitos"
    expected: "Regla de selección del timeline documentada y auditable"
    why_human: "Juicio de producto: 117 gobierna rótulo y helper, no cardinalidad. El verificador confirmó 99 en `tramitacion_evento` vs 85 renderizados — se muestran MENOS, nunca más"
  - test: "OP-1 / OP-4 (deuda de 124), CF secrets + GEMINI (118), identidad local"
    expected: "Cierre por checkpoint de operador"
    why_human: "Deuda de operador viva heredada, re-nombrada en `125-HANDOFF-HUMANO.md` §5"
---

# Phase 125: E2E — Pasada final producto-a-producto sobre el deploy real · Verification Report

**Phase Goal:** Alguien puede recorrer el sitio producto por producto sobre el deploy real y confirmar que todo lo validado en el milestone sigue verde después de los fixes.
**Verified:** 2026-07-29
**Status:** `human_needed` — los 5 SC verificados; 5 ítems de juicio humano/operador con destino escrito
**Re-verification:** No — verificación inicial

**Postura del verificador.** Hipótesis de partida: tareas completas, goal no alcanzado. Todo número de
este informe fue **re-medido por el verificador** contra el deploy vivo, contra PROD por `psql -tA`
read-only y corriendo la suite/tsc/guards en su propio proceso. Los SUMMARY no se usaron como
evidencia en ningún punto.

---

## Goal Achievement

### Observable Truths (los 5 Success Criteria del ROADMAP)

| # | Truth (SC) | Status | Evidencia re-medida por el verificador |
|---|---|---|---|
| 1 | Fixes de UI de links y fechas desplegados ANTES de la pasada | ✓ VERIFIED | Deploy `21:26Z`; medidas de wave 2 a `21:37:53Z` (links), `21:41:20Z` (robots), `21:42:57Z` (muestra ext). **Verificado por contenido en vivo hoy**: `/proyecto/14309-04` → `3,8`=**2**, `según fuente al `=**32**, `Actualizado`=**0** — los tres discriminantes exactos que el runbook midió (318→0 / 0→32 / 0→2). Los **4** planes de wave 2 registraron Paso 0 **ejecutado** con cifras propias (`125-02:50`, `125-03:55`, `125-04:36`, `125-05:38`) |
| 2 | Cada superficie del inventario 113 recorrida con evidencia DOM | ✓ VERIFIED (con límites declarados) | Conteo propio: **60** emisores únicos `E-001…E-060`, veredictos **45 + 7 + 3 + 1 + 4 = 60** exacto. `grep -c "se recorrió todo"` → **0** en el deliverable. **23** capturas `.png` reales (2,1 MB; abrí una y es un screenshot legítimo). Fila 15 excluida por decisión **preexistente** (`113-CONTEXT.md:19`, `T-113-04` en 113-01/04-PLAN) — no inventada aquí |
| 3 | Links internos + muestra de externos re-verificados post-deploy, rate-limit respetado | ✓ VERIFIED | Re-verifiqué **11** rutas internas: 7×200 + 4×404 (`/parlamentario/D0000000`, `/proyecto/00000-00`, `/red?seed=D0000000`, `/contraparte/c:sujeto-inexistente`) — coincide 11/11. Mesura con **dos sellos**: config `delay_ms: 2500` + medición `delta_ms_mismo_host` **todos ≥ 2.501 ms**; mi cálculo de deltas de `ts_inicio` da **min 2.584 ms, media 3,071 s/request**. Robots-primero sellado por timestamp embebido (`21:41:20` < `21:42:57`). Corrí **1** caso externo yo mismo (robots primero, 3 s de espera): `P-03-c01` → **200** |
| 4 | Fechas etiquetadas y cruces cuadrando contra SQL en el deploy final | ✓ VERIFIED | Re-corrí SQL contra PROD: `cruces_de_parlamentario('D1165')`=**11**, `lobby_menciones_de_boletin('14309-04')`=**1\|1**, `('16849-12')`=**13\|13**, `cruces_de_proyecto('14309-04')`=**47**, `parlamentarios_publico_v2()`=**186**, `proyecto_embedding`=**3100**, `votacion` 14309-04=**7** / 17870-05=**256**, `tramitacion_evento` 17870-05=**355**. **Todos cuadran** con el DOM. Las 8 `discrepancia-declarada` siguen declaradas: reproduje en vivo `Ver detalle (1000)` y `Presente en 973 de 1000 … Ausente en 27` |
| 5 | MONEY/NOTIF OFF y ausentes del DOM; guards y suite verdes | ✓ VERIFIED | Corrido por mí: `tsc --noEmit` exit **0**; `vitest run` **1590/1590** en **107** archivos, exit **0**; los **14** guards **por nombre explícito** = **166 + 6 = 172** tests, exit 0. MONEY: 5 discriminantes → **0** en `/parlamentario/D1165`; NOTIF: `Suscrib`/`notificac`/`Seguir este` → **0**; `/contraparte/S1338` → **404**. **Controles positivos apareados reproducidos**: `grep -oi 'suscrip'` en `/cuenta` → **2** y `Financiamiento` en D1165 → **6** ⇒ el pipeline de medición sabe dar positivo |

**Score: 5/5 truths verified.**

---

### Verificación adversarial punto por punto del método pedido

#### 1. ¿El deploy precedió realmente a la pasada?

**Sí.** Deploy `2026-07-29T21:26Z`; la medida de wave 2 más temprana es `21:37:53.813Z`
(`125-LINKS-INT.json`, `meta.iso_timestamp`). Los 4 planes de wave 2 no solo *tenían* el Paso 0 en el
plan: **lo ejecutaron y publicaron sus cifras** (marcador `3,8` = 2, `según fuente al ` = 32/14/20/527,
`Actualizado` = 0). Yo mismo reproduje esos tres discriminantes en vivo hoy, y coinciden al dígito.

**Límite honesto de mi verificación:** el uuid `0ea5d97f-a172-436e-aad0-add95940ee0e` no es
verificable sin credenciales de Cloudflare (que no están en `.env`, deuda de operador conocida). Lo
verificado es más fuerte que el uuid: **la prueba por contenido**, que es exactamente lo que el SC1
exige ("se prueba por contenido, no por disponibilidad").

#### 2. ¿La cobertura declarada es real, o hay cobertura inventada?

**Real.** Conté yo los denominadores:

| control | esperado | mi medición |
|---|---|---|
| emisores en la tabla §1.2 | 60 | **60** (60 únicos, cero duplicados) |
| suma de veredictos | 60 | **45 + 7 + 3 + 1 + 4 = 60** |
| `grep -c "se recorrió todo"` en el deliverable | 0 | **0** |
| capturas BrowserOS | 23 | **23** archivos `.png`, 2,1 MB |

Los 3 hits de `"se recorrió todo"` en la fase están en **texto de criterio** (`125-06-PLAN.md`,
`125-07-PLAN.md`) y en la **fila del auto-check** del propio `125-07-SUMMARY.md:84` (que además lleva
su control positivo `recorrid` → 5). Ninguno es una afirmación de cobertura.

**Los 3 huérfanos no son escapatoria — los verifiqué en el grafo de imports:**

- `VotoFichaRow` — solo auto-referencias en `components/voto-ficha-row.tsx`; `lib/types.ts:315` es un **tipo** homónimo. Cero call-sites.
- `ActualidadModule` — **una sola** aparición: su propia definición.
- `ResumenView` — `app/parlamentario/[id]/page.tsx:7-10` importa **solo** `construirChips` y el tipo `ResumenChip`. Confirmado leyendo el import.

**El quinto valor de vocabulario (`no aislado`) está justificado por fila, no es escapatoria.** Los 4
(E-026, E-030, E-034, E-057) llevan motivo escrito individual. La alternativa habría sido marcarlos
`verificado en DOM` e **inflar 45 → 49**; el documento lo dice explícitamente y elige no hacerlo
(`RULE-1`). Marcarlos `no emite superficie visible` habría sido falso. El valor **reduce** la cobertura
reportada, que es lo contrario de una escapatoria.

**La fila 15 (`/admin/revisar-entidades`) no se excluyó aquí para esquivar el SC2.** La exclusión es
**preexistente y trazable**: `113-CONTEXT.md:19` («`/admin/revisar-entidades` se LISTA como EXCLUIDA
del inventario público con razón») y `T-113-04` en `113-01-PLAN.md:167` / `113-04-PLAN.md:164`. El
denominador recorrido se declara **18, no 19**, en el propio deliverable.

#### 3. Links internos y externos — re-verificados por mí

Corrí **11** rutas internas con UA identificatorio y 1 s de espera: coincidencia **11/11** con lo
reportado, incluida la **mejora** `4.2.b-404` (`/proyecto/00000-00` ahora **404**, era 200 en 114).

**Los 5 `FAIL` del runner no están escondidos tras el «0 con 404».** `125-LINKS-INT.json` reporta
`pass: 73, fail: 5, warn_stream: 17`. Busqué específicamente si el deliverable los suavizaba:
`125-RE-VERIFICACION.md:108-117` los lista **uno por uno con su causa**, clasificándolos como
`falso FAIL` con el fragmento del payload RSC citado, y `4.9-A1` además como **defecto de
instanciación del caso** (`H-125-05-A`: el caso pide el href *por vecino* pero se instanció con el
propio seed, el único id que nunca es vecino de sí mismo). Los 4 restantes son `H-04`, cerrado por
BrowserOS como `L-4`. **Disclosure completa, cero suavizado.**

**La prueba de mesura tiene sus dos sellos y da ≥ 2 s/request:**

| sello | valor |
|---|---|
| configuración declarada | `meta.delay_ms = 2500` |
| medición por registro | `delta_ms_mismo_host` ∈ {2501…2514}, **todos ≥ 2.501 ms** |
| mi cálculo de deltas de `ts_inicio` | min **2.584 ms**, media **3,071 s/request** (18 deltas) |
| robots-primero | `125-ROBOTS-RUN` `21:41:20.335Z` **<** `125-MUESTRA-EXT` `21:42:57.861Z` |

Corrí **1** caso externo yo mismo respetando el régimen (robots.txt primero, luego 3 s de espera, UA
identificatorio): `tramitacion.senado.cl/appsenado/…?boletin_ini=14309-04` → **200**. Confirmé también
que ese `robots.txt` devuelve una página HTML genérica, exactamente como el artefacto lo clasificó
(`REDIR-GENERICA`) — no se maquilló.

#### 4. Cruces contra SQL sobre el deploy final — re-corridos por mí

Ejecuté las queries **verbatim de 122** contra PROD, read-only, sin expandir `SUPABASE_DB_URL`:

| query | esperado | mi resultado |
|---|---|---|
| `Q-49` `cruces_de_parlamentario('D1165')` | 11 | **11** ✓ |
| `Q-69` `lobby_menciones_de_boletin('14309-04')` | `1\|1` | **1\|1** ✓ |
| `Q-69` `('16849-12')` | `13\|13` | **13\|13** ✓ |
| `cruces_de_proyecto('14309-04')` | 47 | **47** ✓ (y el DOM sirve `Explorar los 47 cruces`) |
| `parlamentarios_publico_v2()` | 186 | **186** ✓ |
| `proyecto_embedding` | 3100 | **3100** ✓ |
| `votacion` 14309-04 / 17870-05 | 7 / 256 | **7 / 256** ✓ |
| `tramitacion_evento` 17870-05 | 355 | **355** ✓ |
| `tramitacion_evento` 14309-04 | 99 (H-06) | **99** ✓ — y `Hito del` en vivo = 170 = **85** × 2 (capa RSC) |

**El canario `Ver detalle` = 1000 se sostiene.** Lo extraje por offset (evitando G-2) del HTML vivo:
`Ver detalle (1000)`, `Ver detalle (112)`, `Ver detalle (6)` — los tres números de las filas 2.1, lobby
y patrimonio, al dígito. También reproduje `Presente en … 973 de 1000 … Ausente en … 27` desde el
payload RSC. **Las 8 `discrepancia-declarada` siguen declaradas**, ninguna se cerró sola, y el
recordatorio de por qué `2.1/2.5/2.6` **deben** seguir declaradas (`0078` topa en 4000, el call-site
sigue pasando 1000) es correcto.

**H-06 es un ejemplo de honestidad, no un gap:** con 99 eventos en DB y 85 renderizados, el documento
**niega el `cuadra`** por falta de query que gobierne la regla de selección, y hace notar que se
muestran **menos, nunca más** (cero relleno). Reproduje ambos números.

#### 5. Suite, tsc y guards — corridos por mí, y la trampa del glob reproducida

| check | comando | mi resultado |
|---|---|---|
| typecheck | `pnpm --filter ./app exec tsc --noEmit` | exit **0**, cero diagnósticos |
| suite | `pnpm --filter ./app exec vitest run` | **1590 passed / 1590**, **107** archivos, exit **0** |
| 12 guards de `app/` | por **nombre explícito** (12 rutas) | **12 archivos / 166 tests**, exit **0** |
| 2 guards de `packages/llm` | `src/integ-scope-guard.test.ts src/provider-guard.test.ts` | **2 / 6 tests**, exit **0** |
| **control negativo `G-9`** | `vitest run lib/*guard*.test.ts lib/*gate*.test.ts` desde la raíz | **exit 0 sin correr nada** ⇒ el falso verde es **real** y el 125-07 lo cazó bien |

**172 tests de régimen, 14/14 verdes**, idéntico a lo reportado. No repetí la trampa del glob: la
reproduje como control y luego corrí la lista nominal.

**Ausencia de MONEY/NOTIF con control positivo apareado, reproducida:**

| medición | mi resultado |
|---|---|
| `Aportes recibidos` / `Contratos con el Estado` / `monto adjudicado` / `Aportes de campaña` / `aporte reservado` en D1165 | **0 / 0 / 0 / 0 / 0** |
| `Suscrib` / `notificac` / `Seguir este` en D1165 | **0 / 0 / 0** |
| **control positivo NOTIF** `grep -oi 'suscrip'` en `/cuenta` | **2** ✓ (coincide exactamente con `125-E2E-C` §3.3) |
| **control positivo MONEY** `Financiamiento` / `Pendiente de revisión legal` / `21.719` en D1165 | **6 / 2 / 2** ✓ ⇒ confirma `D-2`: la palabra vive en el copy del **propio gate OFF** |
| `/contraparte/S1338` | **404** ✓ |

Los ceros son reales, no artefactos de medición.

#### 6. Honestidad — ¿algún PASS apoyado en silencio o evidencia fabricada?

**No encontré ninguno.** Los hallazgos abiertos están **sin suavizar**, y varios los reproduje:

| ítem | estado en el deliverable | mi comprobación |
|---|---|---|
| `H-01` | **ABIERTO**, escalado, captura preservada | La captura `comparar-…-HALLAZGO-error-transitorio.png` es un screenshot real del error boundary. Preservar la evidencia de tu propio fallo es lo contrario de fabricar |
| `4.9-A1` / `H-03` | **`NOT OBSERVED` — ni PASS ni defecto** | El runner lo marca `FAIL` y el deliverable **no** lo convierte en PASS; además declara prohibido fabricar el reveal vía `$RC` |
| `H-06` | `cuadra` **negado** explícitamente | Reproduje 99 vs 85 |
| `F-08` | «no observable con MONEY OFF · **no se afirma verificado**» | Coherente: el bloque no se emite |
| `www.senado.cl` 520 | **fuente caída declarada**, cero reintento, cero evasión | Consta en `125-MUESTRA-EXT.txt:19` |
| `og:image` localhost | declarado + `deferred-items.md` | **Reproducido en vivo**: `content="http://localhost:3000/opengraph-image.png?…"` |
| `H-09` (corrida 1587 sin log) | «el log **no se preservó** ⇒ **no se nombra qué 3 tests fueron**: adivinarlo sería inventar evidencia» | Mi corrida dio 1590/1590, consistente con «contención de entorno». La negativa a nombrar los 3 tests es la conducta correcta |
| `Actualizado hace` | declarado **control INERTE**, «no cuenta como prueba» | Un control que ya daba 0 pre-deploy, degradado por su propio autor |
| 5 `FAIL` del runner | listados uno por uno con causa | Verificado en `125-RE-VERIFICACION.md:108-117` |
| `aprobados_por_silencio` | **0** en el frontmatter del handoff | Coherente con el registro verbatim del operador |

#### 7. Alcance del gate humano — ¿se sobre-leyó?

**No.** El gate fue de **copy** (2 líneas: cobertura lobby↔PL y carril de lobby de `S1338`). El
deliverable lo acota **tres veces** de forma explícita: «Su aprobación **no** convierte `H-01`, **no**
convierte `4.9-A1` (`H-03`), y **no** ejerció el ítem opcional de lectura fría». `125-E2E-D` §3.4 marca
los ítems escalados como **INTACTOS tras la aprobación**, y el ítem 3 (opcional) como
**«NO EJERCIDO — no se declara aprobado ni rechazado»**. La respuesta del operador está registrada
verbatim («`Aprobado — cierro el gate`») junto al enunciado exacto de lo aprobado.

#### 8. Higiene — probada por comando

| control | esperado | mi resultado |
|---|---|---|
| `git diff --name-only 338ffa4..HEAD -- app/ packages/ supabase/` | vacío | **vacío** ✓ |
| `git diff --name-only 338ffa4..HEAD -- . ':!.planning/'` (más estricto que el del plan) | vacío | **vacío** ✓ — **cero** archivos fuera de `.planning/` |
| última migración | `0079` | `0077`, `0078`, **`0079_limit_explicito_rpcs.sql`** ✓ |
| flips | 0 | **0** — el diff acotado está vacío, y el propio diff sin acotar está vacío también para no-`.planning` |
| PII / credenciales | 0 | **0** — los 2 hits de `postgres://` y el 1 de `TBD\|FIXME\|XXX` son el **texto del propio criterio** en `125-07-PLAN.md`, citados con origen |
| commits `338ffa4` / `b4882e9` | existen | `git cat-file -t` → `commit` ✓ |

**Nota sobre el diff acotado:** el argumento del 125-04 para acotarlo es correcto y lo comprobé — con
el diff completo el único «hit» sería el propio informe (`125-E2E-C-GATES.md`). Pero además verifiqué
la variante **más estricta** (todo el repo excepto `.planning/`) y **también sale vacía**, así que la
conclusión «cero flips» no depende del acotamiento.

**Nota sobre `pnpm-workspace.yaml` y `119-REVIEW.md` modificados** en `git status`: son cambios
**pre-existentes al rango de la fase** (no aparecen en `338ffa4..HEAD`), ajenos a 125.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `125-E2E.md` | Deliverable consolidado, cobertura por lista | ✓ VERIFIED | 539 líneas; §1.1 (19 filas) + §1.2 (60 emisores) + §2 (~80 filas) + §6.4 (trazabilidad a los 5 SC) |
| `125-DEPLOY-RUNBOOK.md` | uuid, exits, antes/después medido | ✓ VERIFIED | 372 líneas; `BUILD EXIT: 0`, `DEPLOY EXIT: 0`, `Current Version ID` real, `21:26Z` |
| `125-E2E-A-FICHAS.md` | Fichas densas vs SQL | ✓ VERIFIED | 642 líneas; 34 filas de veredicto; cifras re-corridas por mí |
| `125-E2E-B-RUTAS.md` | Chrome + rutas + not-found | ✓ VERIFIED | 870 líneas; 29 filas |
| `125-E2E-C-GATES.md` | 5 gates con control positivo apareado | ✓ VERIFIED | 454 líneas; controles positivos reproducidos por mí |
| `125-E2E-D-BROWSEROS.md` | DOM hidratado, 18 filas, gate humano | ✓ VERIFIED | 596 líneas; 23 capturas reales; gate verbatim y acotado |
| `125-RE-VERIFICACION.md` | Links + fechas post-deploy | ✓ VERIFIED | 464 líneas; los 5 FAIL disclosados uno por uno |
| `125-HANDOFF-HUMANO.md` | Ítems no cerrados con 5 campos | ✓ VERIFIED | 241 líneas; `aprobados_por_silencio: 0`; cada ítem con destino nombrado |
| `125-LINKS-INT.json` / `.txt` | 95 ids con resultado | ✓ VERIFIED | `meta.total: 95`; 0 destinos con 404; 5 FAIL explicados |
| `125-MUESTRA-EXT.json` / `.txt` | 19 casos con mesura instrumentada | ✓ VERIFIED | `delay_ms: 2500` + `delta_ms_mismo_host` ≥ 2501 medidos |
| `125-ROBOTS-RUN.json` / `.txt` | robots-primero sellado | ✓ VERIFIED | `21:41:20Z`, anterior a la muestra |
| `captures/*.png` | 23 capturas | ✓ VERIFIED | 23 archivos, 2,1 MB; una inspeccionada visualmente = screenshot legítimo |
| `deferred-items.md` | og:image diferido | ✓ VERIFIED | Reproducido en vivo por mí |

### Data-Flow Trace (Level 4)

No aplica como en una fase de código: esta fase **no produce artefactos de software** (diff de código
vacío por comando). El equivalente al Nivel 4 es el flujo **fuente de datos → SQL → DOM servido**, que
verifiqué de punta a punta en 9 magnitudes (tabla del punto 4): PROD → RPC → HTML vivo, cuadrando al
dígito. Cero valores horneados sin origen; el único horneado por diseño
(`COBERTURA_MENCIONES_LOBBY` = 3,8 %) lleva su fecha y su `Q-74` de respaldo.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|:---:|
| PROD sirve el bundle con el fix de 122 | `curl … /proyecto/14309-04 \| grep -o "3,8" \| wc -l` | **2** | ✓ PASS |
| PROD sirve el idiom de 117 | `grep -o "según fuente al " \| wc -l` | **32** | ✓ PASS |
| idiom viejo erradicado | `grep -o "Actualizado" \| wc -l` | **0** | ✓ PASS |
| canario de 124 vivo | extracción por offset de `Ver detalle` | `(1000)`, `(112)`, `(6)` | ✓ PASS |
| 4 `not-found` dan 404 | `curl -w "%{http_code}"` ×4 | 404, 404, 404, 404 | ✓ PASS |
| 7 rutas públicas dan 200 | `curl -w "%{http_code}"` ×7 | 200 ×7 | ✓ PASS |
| MONEY ausente | 5 discriminantes | 0 ×5 | ✓ PASS |
| NOTIF ausente | 3 discriminantes | 0 ×3 | ✓ PASS |
| control positivo NOTIF | `grep -oi 'suscrip'` en `/cuenta` | **2** | ✓ PASS |
| control positivo MONEY | `Financiamiento` en D1165 | **6** | ✓ PASS |
| gate MONEY cierra la ruta | `curl /contraparte/S1338` | **404** | ✓ PASS |
| cruces vs SQL | 9 queries read-only | 9/9 cuadran | ✓ PASS |
| externo con mesura | robots + 3 s + 1 request | **200** | ✓ PASS |
| typecheck | `tsc --noEmit` | exit 0 | ✓ PASS |
| suite | `vitest run` | 1590/1590, 107 archivos | ✓ PASS |
| 14 guards por nombre | 12 + 2 archivos | 166 + 6 = 172 tests, exit 0 | ✓ PASS |
| trampa del glob (control negativo) | `vitest run lib/*guard*.test.ts` | exit 0 **sin correr nada** | ✓ PASS (reproducida) |
| higiene de código | `git diff 338ffa4..HEAD` no-`.planning` | vacío | ✓ PASS |
| H-01 tras hidratación | — | no reproducible por `curl` | ? SKIP → humano |
| H-03 `4.9-A1` tras click | — | requiere navegador visible | ? SKIP → humano |

### Probe Execution

No aplica: esta fase no declara probes `scripts/*/tests/probe-*.sh` ni es fase de migración/tooling.
Su equivalente — el gate de cierre de `§6` — lo **re-ejecuté yo entero** (suite, tsc, 14 guards, los 5
controles de régimen), con los resultados de la tabla anterior.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|:---:|---|
| `E2E-01` | 125-01…07 | Pasada final producto-a-producto sobre el deploy real | ✓ SATISFIED | Los 5 SC verificados por re-medición independiente; `§6.4` del deliverable traza cada SC a su fragmento y yo verifiqué cada uno contra el deploy vivo y PROD |

Cero requisitos huérfanos: `REQUIREMENTS.md` mapea únicamente `E2E-01` a la fase 125, y el plan lo
reclama.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|:---:|---|
| `125-07-PLAN.md` | 182, 217 | `postgres://` / `postgresql://` | ℹ️ Info | **Texto del propio criterio de verificación**, con origen citado. Cero cadenas de conexión reales |
| `125-07-PLAN.md` | 183 | `TBD\|FIXME\|XXX` | ℹ️ Info | Ídem: el criterio se encuentra a sí mismo. **Cero marcadores de deuda propios** ⇒ el debt-marker gate **no** dispara |
| `125-06/07-PLAN.md`, `125-07-SUMMARY.md:84` | — | `"se recorrió todo"` | ℹ️ Info | Texto del criterio prohibitivo y su propia fila de auto-check (con control positivo). **0** en el deliverable |
| — | — | archivos de código modificados | — | **cero** (`git diff` vacío para todo el repo fuera de `.planning/`) |
| — | — | migraciones nuevas / flips | — | **cero**; última migración `0079` |

Ningún anti-patrón bloqueante ni de advertencia.

### Human Verification Required

**5 ítems que solo el operador (o una fase futura) puede cerrar.** Ninguno bloquea el goal de la fase:
los cuatro primeros están **escalados con destino escrito** en `125-HANDOFF-HUMANO.md`, y el goal
—«recorrer el sitio y confirmar que sigue verde, o declarar honestamente lo que no»— se cumple
precisamente **porque** están declarados y no convertidos en PASS.

#### 1. `H-03` (`4.9-A1`) — href `/red?seed=<vecinoId>` NO OBSERVADO

**Test:** abrir `/red?seed=D1165` en un navegador **visible**, hacer click en una tarjeta de vecino y
comprobar a ojo si aparece un enlace `/red?seed=<vecinoId>`.
**Expected:** la tarjeta expande y emite el href (`red-graph.tsx:210`).
**Why human:** el click se ejecutó (`Clicked [137]`) pero la tarjeta no expandió bajo página oculta.
Es el único de los 5 límites de wave 2 que sigue abierto (`L-5`). Fabricar el reveal vía `$RC` está
prohibido. **Ni PASS ni defecto.**

#### 2. `H-01` — error boundary transitorio en `/comparar`

**Test:** recargar `/comparar?a=D1170&b=D1165` varias veces y observar si aparece
«No pudimos cargar la portada» tras hidratación.
**Expected:** portada de comparación sin error boundary.
**Why human:** 1 de 2 observaciones, re-test 3/3 limpio ⇒ transitorio. No reproducible por `curl`.
Su fix exige re-deploy, fuera del alcance de esta fase.

#### 3. `P-1` (opcional) — lectura fría de las 82 filas de `122-CRUCES-SQL.md`

**Test:** hojear `122-CRUCES-SQL.md`: ¿sus 82 filas se auditan sin abrir el código?
**Expected:** cada fila seguible hasta su query y su superficie sin leer código.
**Why human:** era el ítem 3 (opcional) del gate humano; el operador **no lo ejerció**. No se declara
aprobado ni rechazado.

#### 4. `H-06` — 85 `Hito del` contra 99 eventos en `14309-04`

**Test:** decidir cuál es la cardinalidad correcta del timeline y documentar la regla de selección.
**Expected:** regla auditable.
**Why human:** juicio de producto. Confirmé ambos números (99 en `tramitacion_evento`, 85 renderizados).
Se muestran **menos, nunca más** ⇒ sin riesgo de relleno.

#### 5. Deuda de operador viva (heredada)

`OP-1` / `OP-4` (de 124), CF secrets + `GEMINI` (de 118), identidad local, y el diferido `og:image`
(`metadataBase`). Todos con destino nombrado en `125-HANDOFF-HUMANO.md` §5 y `deferred-items.md`.

### Deferred Items

No aplica: la fase 125 es la **última** del milestone v12.0 (113–125). No hay fase posterior a la que
diferir gaps. Los 4 hallazgos abiertos están escalados a **fases futuras aún no planificadas**, con
destino escrito, lo que el handoff registra explícitamente en vez de silenciarlo.

### Gaps Summary

**Cero gaps.** Intenté falsar la narrativa del SUMMARY por ocho vías distintas y en las ocho la
evidencia del repo y del deploy **confirmó** lo declarado, con frecuencia al dígito:

- Los denominadores (60 emisores, 19/18 filas, 95 links, 23 capturas) **los conté yo** y cuadran exacto.
- Las 9 magnitudes de cruce **las re-corrí yo** contra PROD y cuadran exacto.
- La suite, `tsc` y los 14 guards **los corrí yo** y dan los mismos números (1590/1590, 172 tests).
- La trampa del glob que produciría el falso verde **la reproduje** — y confirmé que el gate no la usó.
- Los tres emisores huérfanos **los verifiqué en el grafo de imports**: son huérfanos de verdad.
- La exclusión de la fila 15 **la trazé a `113-CONTEXT.md:19`**: es preexistente, no una escapatoria.
- El quinto valor de vocabulario **reduce** la cobertura reportada (45, no 49), lo contrario de inflarla.
- Los 5 `FAIL` del runner de links **están disclosados uno por uno**, no escondidos tras «0 con 404».

Lo más notable en clave adversarial es lo que el documento se **niega** a afirmar: no nombra los 3
tests de la corrida `H-09` porque perdió el log; no convierte `4.9-A1` en PASS ni en defecto; niega el
`cuadra` a `H-06` por falta de query que lo gobierne; degrada su propio control `Actualizado hace` a
«INERTE»; declara `F-08` no observable en vez de verificado; preserva una captura del error boundary
que él mismo provocó; y acota tres veces el alcance del gate humano aprobado para que nadie lo
sobre-lea. Un informe que quisiera aparentar verde no haría ninguna de esas ocho cosas.

**El goal está alcanzado:** alguien puede recorrer el sitio producto por producto sobre el deploy real
—yo lo hice, de forma independiente— y confirmar que lo validado en el milestone sigue verde, con las
excepciones nombradas, medidas y con destino escrito.

**Status `human_needed`, no `passed`,** únicamente porque quedan 5 ítems de juicio humano/operador
abiertos. Cero de ellos indica un defecto de la fase; los cuatro primeros son hallazgos escalados con
destino, y el quinto es deuda heredada.

---

_Verified: 2026-07-29 · Verificador: Claude Opus 5 (gsd-verifier)_
_Método: goal-backward, stance FORCE. Todo número re-medido por el verificador contra el deploy vivo, PROD por `psql -tA` read-only, y suite/tsc/guards corridos en proceso propio. Los SUMMARY no se usaron como evidencia._
