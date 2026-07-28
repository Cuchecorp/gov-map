---
phase: 114-link-int-links-internos-exhaustivos
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - app/app/proyecto/[boletin]/page.tsx
  - app/app/proyecto/[boletin]/page.test.tsx
  - scripts/links-internos-manifiesto.mjs
  - scripts/verificar-links-internos.mjs
  - scripts/verificar-links-internos.selfcheck.mjs
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
fixed_at: 2026-07-28
fix_scope: critical_warning
fixed: 10 (9 del review + W-01 del verifier)
skipped: 4
---

## Estado de los fixes (code-review --fix, 2026-07-28)

Alcance aplicado: **Critical + Warning** (CR-01, CR-02, WR-01…WR-06). De los Info sólo se tomó
`IN-01` por ser un one-liner. Un commit atómico por hallazgo; **cero deploy, cero flag tocado**.

| Finding | Estado | Commit | Nota |
|---|---|---|---|
| CR-01 | **fixed** | `5801b77` | `ausencia` exige 200 con cuerpo no vacío; sin HTML servido no hay veredicto. |
| CR-02 | **fixed** | `ad3cb7b` | `status` con `origen` real + `href` comprueba la EMISIÓN del href (`tieneHref`); `pedir()` lee el cuerpo también en 404. Artefactos PRE/POST **no re-escritos** — la mejora queda declarada en el header del runner y en `114-VERIFICACION.md`; la re-corrida es de la **Phase 125**. |
| WR-01 | **fixed** | `772b42f` | `RailSkeleton` = 9 fijas + autores + cruces (antes 10/9, ignoraba autores). |
| WR-02 | **fixed** | `57aa2a2` | `no-404` exige 200: un 3xx o 5xx ya no cuenta como link sano. |
| WR-03 | **fixed** | `71bc1c8` | Patrones de `ausencia` vía `contienePatron` (id / prefijo de href / substring sin `<script>`); +8 fixtures. |
| WR-04 | **fixed** | `77d5893` | `sinRuido` cubre comentarios, `<template>` y `<noscript>`; +4 fixtures (22 en total). |
| WR-05 | **fixed** | `fc15bcc` | `AbortSignal.timeout(15s)`, fallo de red no cacheado + 1 reintento con backoff; secuencialidad y delay 400ms intactos. |
| WR-06 | **fixed** | `ba7c5a5` | Aserción anclada al contador real del rail; mordida probada por mutación (1/13 cae). |
| IN-01 | **fixed** | `fc9494d` | Contacto del User-Agent desde `INGESTA_CONTACTO`, default genérico. |
| **W-01** (verifier de fase, no del review) | **fixed** | `07c19ea` | **Defecto introducido por CR-02**: el assert de emisión daba falsos FAIL con secciones bajo `<Suspense>` (subset `/proyecto`: 10 FAIL cuando el defecto real era 1). Nuevo estado `WARN-STREAM` (href en el crudo, **o** origen = shell con fallbacks sin resolver), contado aparte en `meta.warn_stream` y que **no falla la corrida**. Además `--route` con 0 entradas → exit 2. Subset `/proyecto` verificado contra el deploy: **19 PASS / 1 FAIL legítimo (`4.2.b-404`) / 9 WARN-STREAM**. |
| IN-02 | skipped | — | Fuera del alcance pedido (Info no trivial): exige exportar `verificarCobertura()` y cablearla en `main()` o un test nuevo. El invariante 77/77 sigue verificado a mano en `114-VERIFICACION.md` §Cobertura. |
| IN-03 | skipped | — | Fuera del alcance pedido: añadir `--strict-anclas` es diseño de CLI nuevo. El supuesto ya está escrito en el header del runner y en §SC#2. |
| IN-04 | skipped | — | Fuera del alcance pedido: actualizar prosa y extender las listas de anclas del test es trabajo de test, no un one-liner. |
| IN-05 | skipped | — | Fuera del alcance pedido: cambiar `process.cwd()` por `import.meta.dirname` y acotar el source-scan toca 4 sitios del test. |

**Gates tras los fixes:** suite `pnpm test` exit 0 (`packages/*` sin delta · `app` 107 files / **1431**
tests, exactamente el baseline post-114-03) · `tsc -b` exit 0 · `node scripts/verificar-links-internos.selfcheck.mjs`
exit 0 (**28/28** fixtures, antes 10) · 9/9 guards de régimen verdes · `git diff .env .env.example
package.json pnpm-lock.yaml` **vacío**.

# Phase 114: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

El fix H-01 en sí es **correcto**: `BOLETIN_RE` (`/^\d{3,6}(-\d{1,2})?$/`, `app/lib/buscar.ts:30`) está
anclado en ambos extremos ⇒ no hay path/SQL injection por el param; el guard elevado reusa
`leerProyecto` (React.cache) ⇒ cero query extra y cero doble-fetch; `leerProyecto` lanza ante error real
de DB ⇒ ningún boletín válido puede recibir un 404 fabricado a partir de un fallo. Verificado también
que la compuerta de cobertura del manifiesto se cumple hoy (77 refs = 77, 0 gaps, 0 refs inventadas,
0 ids duplicados, 95 entradas) — pero **no está enforced por código**.

El peso de los hallazgos está en el **verificador**, no en la page: el runner tiene dos caminos por los
que emite PASS sin haber comprobado nada (aserciones de `ausencia` sobre un origen que 404ea, y
"no-404" que acepta cualquier 3xx), y el diseño del manifiesto **nunca comprueba que el href exista en
la página de origen** — sólo que el destino responda. Para una fase titulada "links internos
exhaustivos" eso es una brecha de contrato, no un detalle. Además el `RailSkeleton` de la page tiene un
conteo desincronizado con `ProyectoRail` (el invariante anti-CLS que el propio comentario declara está
roto), y uno de los tests del rail no puede fallar nunca.

## Critical Issues

### [FIXED 5801b77] CR-01: `ausencia` emite PASS cuando la página de origen devuelve 404 (falso negativo de gate MONEY/NOTIF)

**File:** `scripts/verificar-links-internos.mjs:198-204` (con `:157`)
**Issue:** `pedir()` sólo llena `html` cuando `res.status === 200` (`:157`); para cualquier otro status
`html` queda `""`. La rama de `ausencia` acepta explícitamente `status === 404` como origen válido y
entonces evalúa `!"".includes(entrada.espera)` → **siempre true → PASS**. Resultado: si
`/parlamentario/D1165` o `/proyecto/14309-04` empezaran a 404ear (regresión de datos, deploy roto, id
que dejó de existir), las 7 entradas de tipo `ausencia` del manifiesto —las que certifican que los
gates **MONEY** y **NOTIF** no están filtrando superficie (`4.1-A18`…`4.3-A1-desde-proyecto`)— pasarían
a verde sin haber inspeccionado un solo byte de HTML. Es el peor modo de falla posible: la aserción que
respalda un gate legal/de privacidad se vuelve vacua justo cuando el sitio está roto.
**Fix:** exigir 200 para poder afirmar ausencia.
```js
} else if (entrada.tipo === "ausencia") {
  if (r.status !== 200) {
    causa = `origen HTTP ${r.status}: no se puede afirmar ausencia sin HTML servido`;
  } else if (!r.html.includes(entrada.espera)) {
```
(Si alguna entrada necesita afirmar ausencia sobre una página 404, hay que capturar el body también en
ese caso: `const html = await res.text()` incondicional.)

### [FIXED ad3cb7b] CR-02: el manifiesto nunca verifica que el link EXISTA en la página de origen

**File:** `scripts/links-internos-manifiesto.mjs:129-345`, `scripts/verificar-links-internos.mjs:172-205`
**Issue:** para `tipo: "status"` el runner pide **`entrada.destino`** y descarta por completo
`entrada.origen` y `entrada.href`. Es decir: verifica que el destino sea alcanzable, jamás que la página
de origen emita el href. Un enlace borrado, mal escrito o condicionado a datos que ya no existen sigue
dando PASS mientras la ruta destino viva. Caso más flagrante: `4.2.b-A1` (`:253-254`) declara "único
link de la página 404 de proyecto" y lo que el runner comprueba es que **`/` responde** — el 404 ni
siquiera se descarga. Lo mismo en `4.1.b-A1`, `4.3.b-A1`, `4.9.b-A1`, `4.5-A*`, `4.11-A*`, `4.4-A*`. Con
esto, el veredicto "SC#1 PASS · 63/63" del 114-03-SUMMARY sobre-declara lo verificado: se probó
alcanzabilidad de destinos, no integridad de links.
**Fix:** añadir una comprobación de emisión para las entradas con `origen` real y `href` no nulo — pedir
el origen (ya está cacheado por ruta, cero requests extra en la mayoría) y buscar el href emitido:
```js
if (entrada.tipo === "status" && entrada.href && entrada.origen?.startsWith("/")) {
  const o = await pedir(entrada.origen);
  if (o.status !== 200 || !hrefEmitido(o.html, entrada.href)) {
    resultado = "FAIL";
    causa = `href="${entrada.href}" no emitido por ${entrada.origen}`;
  }
}
```
Si se decide no hacerlo en esta fase, la limitación debe quedar **escrita en el `.txt`/`.json` y en el
veredicto de SC#1**, no sólo implícita.

## Warnings

### [FIXED 772b42f] WR-01: `RailSkeleton` cuenta 9/10 entradas; `ProyectoRail` puede emitir 11 (CLS, invariante roto)

**File:** `app/app/proyecto/[boletin]/page.tsx:706` vs `:315-351`
**Issue:** el comentario `:698-706` declara LOCKED que el skeleton debe igualar `navEntries`. Pero
`navEntries` tiene 9 entradas fijas + `autores` (condicional a `nAutores > 0`, `:328-330`) + `cruces`
(condicional al gate, `:341-343`). Con autores presentes y CRUCES ON son **11**, y el skeleton pinta
**10**; con CRUCES OFF y autores, 10 vs 9. El salto de layout que el comentario dice prevenir ocurre en
el caso más común (la mayoría de las mociones tienen autores).
**Fix:** derivar el conteo de la misma fuente, o al menos reflejar ambas condiciones:
```js
// nAutores no es conocible sin query; usar el rango alto evita el salto hacia abajo.
const nEntries = 9 + 1 /* autores, caso frecuente */ + (crucesPublicEnabled(process.env) ? 1 : 0);
```
(Mejor aún: extraer `construirNavEntries()` y que el skeleton use `.length` de una versión sin datos.)

### [FIXED 57aa2a2] WR-02: "no-404" acepta redirecciones y errores 5xx como PASS

**File:** `scripts/verificar-links-internos.mjs:185`
**Issue:** con `redirect: "manual"` (`:155`) y la regla `r.status !== 404 ? "PASS"`, un 301/302/307/308
—incluido un redirect **hacia una página que 404ea**— y también un **500/502/503** cuentan como link
sano. Toda la clase `status`/`no-404` (63 entradas, el grueso de SC#1) queda sin poder distinguir "vivo"
de "roto de otra forma".
**Fix:**
```js
resultado = r.status === 200 ? "PASS" : "FAIL";
if (resultado === "FAIL") causa = `esperaba 200, observado ${r.status}`;
```
o, si el redirect es aceptable por diseño, seguirlo (`redirect: "follow"`) y evaluar el status final.

### [FIXED 71bc1c8] WR-03: las aserciones de `ausencia` usan substring pelado sobre el HTML completo (incluido `<script>`)

**File:** `scripts/verificar-links-internos.mjs:200`, manifiesto `:193-204,257-260`
**Issue:** el propio archivo argumenta con detalle (`:70-88`) por qué un substring pelado no sirve para
anclas… y luego usa exactamente eso para `ausencia`, sobre el HTML **sin remover `<script>`**. Dos fallas
simétricas: (a) falso FAIL si `id="dinero"` o `/contraparte/` aparece en el payload RSC serializado sin
que exista el elemento/enlace; (b) falso PASS si el markup usa comillas simples (`id='dinero'`) o si el
href se emite con otra forma. Contradice el estándar de rigor que la misma fase se autoimpuso.
**Fix:** reusar la maquinaria endurecida — `!tieneId(r.html, "dinero")` para las anclas, y una
`tieneHref(html, prefijo)` análoga (strip de `<script>` + regex de atributo `href`) para
`href="/contraparte/`.

### [FIXED 77d5893] WR-04: `tieneId` no ignora comentarios HTML ni `<template>`/`<noscript>`

**File:** `scripts/verificar-links-internos.mjs:86-87`
**Issue:** sólo se remueven bloques `<script>`. Un `<!-- <section id="votos"> -->` o markup dentro de
`<template>`/`<noscript>` produce **PASS falso** para un ancla que no existe como destino de salto. Los
10 fixtures del self-check no cubren ninguno de estos casos, así que la prueba de mordida no lo detecta.
**Fix:** ampliar el strip y añadir fixtures:
```js
const sinRuido = String(html)
  .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
  .replace(/<template\b[\s\S]*?<\/template\s*>/gi, " ")
  .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ")
  .replace(/<!--[\s\S]*?-->/g, " ");
```
más fixtures `{html:'<!-- <section id="votos"> -->', espera:false}` y el de `<template>`.

### [FIXED fc15bcc] WR-05: los errores de red se cachean permanentemente y contaminan todas las entradas de esa ruta

**File:** `scripts/verificar-links-internos.mjs:148-164`
**Issue:** `cache.set(ruta, out)` se ejecuta también en el `catch` (`:159-162`). Un único `ECONNRESET`
transitorio marca la ruta como fallida para **todas** las entradas restantes que la comparten (p. ej. las
11 anclas de `/proyecto/14309-04` caen juntas) sin un solo reintento, y el `sleep(400)` ni siquiera se
paga de nuevo porque la ruta ya está en caché. La corrida se vuelve no determinista bajo red inestable,
justo lo que un artefacto reproducible no puede permitirse.
**Fix:** no cachear el fallo, y reintentar con backoff:
```js
} catch (err) {
  out = { status: -1, html: "", error: err.message };
  return out;            // ← sin cache.set: se reintenta en la siguiente entrada
}
```
más un `AbortSignal.timeout(...)` en el `fetch` (hoy no hay timeout: una ruta colgada bloquea la corrida
indefinidamente).

### [FIXED ba7c5a5] WR-06: test del rail que no puede fallar (`expect(html).toContain("3")`)

**File:** `app/app/proyecto/[boletin]/page.test.tsx:264`
**Issue:** se presenta como "muestra el conteo honesto de votaciones (3)", pero `"3"` aparece de todos
modos en el markup (`md:grid-cols-[13rem_1fr]`, `text-xs`, cualquier clase con un 3). La aserción pasa
aunque el conteo se rompa o desaparezca — el mismo pecado que el resto de la fase persigue por mutación.
**Fix:** anclar al marcado real del contador del rail, p. ej.
`expect(html).toMatch(/aria-label="3 votaciones"|>3<\/span>/)`, y comprobar con una mutación
(`count: nVotaciones` → `count: undefined`) que el test cae.

## Info

### [FIXED fc9494d] IN-01: dirección de correo personal hardcodeada en el User-Agent

**File:** `scripts/verificar-links-internos.mjs:52`
**Issue:** `sanchez.rossi@gmail.com` queda commiteado en el repo y además se propaga al `.json` de cada
corrida (`meta.user_agent`, `:243`). No es un secreto (el UA identificatorio es requisito de CLAUDE.md),
pero es PII de contacto duplicada en artefactos versionados.
**Fix:** leerla de `process.env.INGESTA_CONTACTO` con un default genérico del proyecto.

### [SKIPPED] IN-02: la compuerta de cobertura del manifiesto está documentada pero no ejecutada

**File:** `scripts/links-internos-manifiesto.mjs:20-22`
**Issue:** el invariante `unión(MANIFIESTO ∪ EXCLUIDOS) === REFS_INVENTARIO` se declara como "invariante
del módulo" y hoy se cumple (verificado en este review: 77/77, 0 gaps, 0 inventadas, 0 ids duplicados),
pero ningún código lo comprueba — se re-valida a mano en cada plan. Es exactamente el tipo de invariante
que se rompe silenciosamente al añadir una entrada.
**Fix:** exportar `verificarCobertura()` y llamarla al inicio de `main()` (fail-loud con exit 2), o
añadir un test que la ejerza.

### [SKIPPED] IN-03: `MISSING-SSR` no falla la corrida ⇒ SC#2 puede declarar PASS con anclas ausentes

**File:** `scripts/verificar-links-internos.mjs:207-209,251`
**Issue:** documentado como intencional (`:41`), pero implica que `exit 0` **no** significa "todas las
anclas existen". Un ancla que desaparezca del SSR degrada a MISSING-SSR y la corrida sigue verde.
**Fix:** al menos exponerlo en el exit code bajo flag (`--strict-anclas`) o dejar constancia del
supuesto en el veredicto de SC#2.

### [SKIPPED] IN-04: los describes/comentarios del test están desactualizados (6 secciones / 7 entradas vs. 11)

**File:** `app/app/proyecto/[boletin]/page.test.tsx:5-18,168,234-248`
**Issue:** el archivo habla de "6 secciones" y "7 entradas del rail"; la page monta 11 secciones y el rail
9-11 entradas. Las aserciones sólo recorren el subconjunto viejo: `#autores`, `#lobby-menciones`,
`#cuerpos-legales` y `#validacion-fuente` no se comprueban en ningún test.
**Fix:** actualizar la prosa y extender las listas de ids/anclas a las secciones reales.

### [SKIPPED] IN-05: el source-scan estructural depende de `process.cwd()` y del texto exacto del código

**File:** `app/app/proyecto/[boletin]/page.test.tsx:221-231,302-305`
**Issue:** `path.join(process.cwd(), "app", "proyecto", …)` sólo resuelve si el runner arranca en `app/`
(gotcha ya registrado en el proyecto: `process.cwd()` en CLIs bajo `pnpm --filter`). Además
`src.indexOf("await leerProyecto(boletin)")` toma la **primera** ocurrencia sin comprobar que esté dentro
de `ProyectoPage` — muerde hoy por accidente de orden (la siguiente ocurrencia vive en `ProyectoRail`,
`:294`), no por construcción.
**Fix:** usar `import.meta.dirname` para la ruta, y acotar el scan al cuerpo de la función
(`src.slice(src.indexOf("export default async function ProyectoPage"), src.indexOf("// ── Rail"))`).

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
