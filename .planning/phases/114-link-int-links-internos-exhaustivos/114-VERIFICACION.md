# 114-VERIFICACION — Fixes con evidencia antes/después y cierre de fase

**Insumo:** `114-HALLAZGOS.md` (lista CERRADA — 1 hallazgo accionable: `H-01`).
**Base PRE:** `114-CORRIDA-PRE.json` / `.txt` (95 entradas · PASS 94 · FAIL 1 · MISSING-SSR 0).
**Nota LOCKED:** esta fase **no deploya** — los fixes viajan con la **Phase 125**; ningún flag fue tocado.

---

## Fixes

**Total de hallazgos corregidos:** 1 de 1 (`H-01`). **Diferidos:** 0.

### H-01 — `/proyecto/<boletín inexistente>` respondía HTTP 200 en vez de 404

| Campo | Valor |
|---|---|
| **id de manifiesto** | `4.2.b-404` (`inventarioRef` 4.2.b-A1, `tipo=status`, `espera=404`) |
| **intención aplicada** | corregir el **destino** (contrato HTTP de la ruta), no un href — no hay emisor público |
| **archivo tocado** | `app/app/proyecto/[boletin]/page.tsx` (único) |

**ANTES** — la única comprobación de existencia vivía en `FichaSection`, **dentro** de un boundary
de streaming, en `app/app/proyecto/[boletin]/page.tsx:425-431`:

```tsx
// app/app/proyecto/[boletin]/page.tsx:425-431 (estado previo, sin cambios en el fix)
async function FichaSection({ boletin }: { boletin: string }) {
  const data = await leerProyecto(boletin);
  if (!data) {
    notFound();
  }
  return <FichaHeader proyecto={data} />;
}
```

`FichaSection` se monta bajo `<Suspense>` en `page.tsx:99-101`, así que para un boletín con formato
válido (que **pasa** `BOLETIN_RE`, `page.tsx:60-62`) pero sin fila, el shell ya se había emitido con
las cabeceras puestas: la UI de not-found se pintaba, pero el status quedaba en **200**.

**DESPUÉS** — comprobación elevada al componente de página, antes del `return` y por tanto antes de
abrir cualquier boundary de streaming (`app/app/proyecto/[boletin]/page.tsx:64-77`):

```diff
--- a/app/app/proyecto/[boletin]/page.tsx
+++ b/app/app/proyecto/[boletin]/page.tsx
@@ -61,6 +61,20 @@ export default async function ProyectoPage({ params, searchParams }: PageProps)
     notFound();
   }
 
+  // 114-03 (H-01) — El 404 de "boletín inexistente" DEBE resolverse ANTES de abrir
+  // cualquier boundary de streaming. Antes, la única comprobación de existencia vivía
+  // en `FichaSection` (dentro de un <Suspense>): para un boletín con formato válido
+  // pero sin fila, el shell ya se había emitido con las cabeceras puestas, así que el
+  // `notFound()` pintaba la UI de not-found pero el status quedaba en 200. Aquí se
+  // resuelve en el componente de página, antes del `return`, y por tanto antes de que
+  // Next envíe cabecera alguna. La lectura es la MISMA `leerProyecto` cacheada
+  // (React.cache) que consumen el rail, la ficha y la tramitación ⇒ cero query extra.
+  // `leerProyecto` LANZA ante un error real de DB/red (#34): esto no fabrica un 404 a
+  // partir de un fallo, sólo lo emite cuando la fila realmente no existe.
+  if (!(await leerProyecto(boletin))) {
+    notFound();
+  }
+
   // Período de urgencia expandido (SC2, server-driven): ?urgencias=<id>. Normalizado
```

**Qué NO cambió (invariantes preservadas):**

- `FichaSection` conserva su propio `notFound()` — guard defensivo, no se relajó nada.
- Cero query extra: `leerProyecto` es `React.cache` (`page.tsx:407-422`) y ya la consumen el rail, la
  ficha, la tramitación y la validación de fuente.
- Cero cambio de copy, de dato, de conteo, de fecha y de gate ⇒ **no se tocó el linter
  anti-insinuación** (no hubo texto visible nuevo: la UI de not-found es la ya existente
  `app/app/proyecto/[boletin]/not-found.tsx`).
- Honest-error #34 intacto: un fallo real de DB/red sigue **lanzando** desde `leerProyecto`; el 404
  sólo se emite cuando `data` es `null` (0 filas).

**Test de respaldo** (`app/app/proyecto/[boletin]/page.test.tsx`, 3 tests nuevos):

| Test | Asevera |
|---|---|
| `llama notFound() ANTES de devolver el árbol cuando el proyecto no existe` | `ProyectoPage(...)` **rechaza** con `NEXT_NOT_FOUND` sin llegar a producir markup |
| `con un boletín existente NO llama notFound() y sí devuelve el árbol` | no-regresión del camino feliz (`id="estado"` presente) |
| `la comprobación de existencia vive en la page, ANTES del primer <Suspense>` | invariante estructural: `await leerProyecto(boletin)` precede al primer `<Suspense fallback=` |

**Prueba de que el test MUERDE (mutación):** neutralizando el guard
(`if (!(await leerProyecto(boletin)))` → `if (false)`), la corrida dio **2 de 13 tests en FAIL**
(el de rechazo y el estructural). Revertida la mutación, **13/13 PASS**.

**Gates de la tarea:**

| Gate | Resultado |
|---|---|
| `git diff --stat .env .env.example` | **vacío** — cero flags tocados |
| `git diff --name-only \| grep -qE 'package\.json\|pnpm-lock\.yaml'` | sin match (exit 1) ⇒ el gate `!` sale **0** — cero paquete nuevo |
| Archivos de `app/` tocados | exactamente los 2 previstos (`page.tsx` + su test) |
| Deploy | **NO ejecutado** — viaja con la Phase 125 |

---

## No-regresión (corrida POST-FIX)

| Chequeo | Baseline LOCKED | Observado | Veredicto |
|---|---|---|---|
| `pnpm test` — `packages/*` | 176 files / 1535 tests / 11 skipped | **176 / 1535 / 11** | idéntico |
| `pnpm test` — `app` | 107 files / 1428 tests | **107 / 1431** | **+3** (los 3 tests de H-01) |
| `pnpm test` — total | 283 / 2963 | **283 / 2966** | delta declarado: +3 |
| `pnpm typecheck` (`tsc -b`) | exit 0 | **exit 0** | PASS |

**Guards de régimen — 9/9 verdes** (corridos individualmente):

| Guard | Tests |
|---|---:|
| `anti-insinuacion-guard` | 33 |
| `lockdown-guard` | 22 |
| `vsim-antiflip-guard` | 20 |
| `notif-antiflip-guard` | 20 |
| `money-antiflip-guard` | 20 |
| `bento-guards` | 114 |
| `bento-coherencia-guard` | 8 |
| `name-match-rut-guard` | 15 |
| `env-example-guard` | 16 |

---

## Veredicto por success criterion

Los 4 SC son los del `ROADMAP.md` §`### Phase 114`, verbatim.

### SC#1 — «Cada link interno emitido por las rutas del inventario 113 fue solicitado contra el deploy real y devolvió respuesta no-404»

**Veredicto: PASS.**

- Evidencia: `114-CORRIDA-POST.json` — **63 de 63** entradas `tipo=status` con `espera="no-404"` en
  **PASS**. Las 4 restantes de `status` esperan un 404 *por diseño* (placeholders sintéticos y ruta
  gated), y por tanto no son "links emitidos": `4.1.b-404` PASS, `4.3-A2-A3` PASS (contraparte 404ea
  entera con MONEY OFF, declarado por 113 §4.3), `4.9.b-404` PASS y `4.2.b-404` FAIL (= `H-01`, cuyo veredicto se da en el criterio 3, abajo).
- Comando: `node scripts/verificar-links-internos.mjs --out …/114-CORRIDA-POST`
- Universo: las 95 entradas del manifiesto, que cubren por igualdad las 77 refs del inventario rector.

### SC#2 — «Cada ancla `#id` referenciada existe en el DOM de la página destino (no basta con que la página cargue) — precedente scroll-margin/`section[id]` de v8.0»

**Veredicto: PASS.**

- Evidencia: **20 de 20** entradas `tipo=ancla` en PASS en `114-CORRIDA-POST.json`; **MISSING-SSR = 0**
  (ninguna ancla existe sólo en el DOM del cliente ⇒ el fallback BrowserOS no se requirió).
  El veredicto detallado por ancla, con su fragmento de evidencia, vive en `114-ANCLAS.md`.
- La aserción **no basta con que la página cargue**: `tieneId()` busca el atributo `id` real
  (`\sid=["']x["']`, descartando `aria-controls` / `aria-labelledby` / `data-id` y prefijos ajenos) y
  **remueve los bloques `<script>`** antes de buscar, para que el payload RSC serializado no
  produzca un falso positivo. Probada por **mutación**: relajarla a `includes()` tumba 6 de 10
  fixtures (`scripts/verificar-links-internos.selfcheck.mjs`, exit 1), y revertida vuelve a exit 0.
- Lección v8.0 (scroll-margin) cerrada con evidencia del **bundle servido por el deploy**:
  `:where([id]){scroll-margin-top:5rem}` en `/_next/static/chunks/1wa_zok604slz.css`
  (fuente: `app/app/globals.css:103-108`) ⇒ ningún destino queda tapado por el header.
- 3 filas quedan como `ausente-declarado` (`#dinero`, `#financiamiento` con MONEY OFF;
  `#contratos`/`#aportes` de `/contraparte/[id]`, ruta 404 entera por el mismo gate). No son anclas
  rotas: el inventario 113 las declara `no emitido en el deploy auditado`, y las 8 entradas
  `tipo=ausencia` confirman que **ninguna superficie las referencia** (8/8 PASS).

### SC#3 — «Todo link o ancla roto quedó corregido en el código, con evidencia antes/después»

**Veredicto: PASS con limitación declarada.**

- **1 de 1** hallazgo accionable corregido (`H-01`), con evidencia ANTES (`archivo:línea` + contenido
  previo), DESPUÉS y `git diff` acotado en §Fixes de este documento, más 3 tests de respaldo cuya
  mordida se probó por mutación (2 de 13 tests caen al neutralizar el guard). Commit `10f1106`.
  **Cero hallazgos diferidos.**
- **Limitación (LOCKED):** los fixes están en código con evidencia antes/después y test de respaldo;
  **su observación sobre el deploy real ocurre en la Phase 125**. El deploy de esta fase está
  diferido por decisión del prompt rector v12.0, así que la corrida POST contra el deploy sigue
  mostrando `4.2.b-404` en FAIL — marcado literalmente `FIX EN CÓDIGO — se re-verifica en 125` en el
  bloque `=== DELTA PRE→POST ===`. **No se declara verificado sobre el deploy lo que no lo está.**

### SC#4 — «La corrida de verificación es reproducible (comando + salida guardada), no un chequeo manual irrepetible»

**Veredicto: PASS.**

- Evidencia: dos corridas del **mismo** comando (sólo cambia `--out`) con salida guardada y
  commiteada — `114-CORRIDA-PRE.{txt,json}` (2026-07-28T01:06:03.406Z) y
  `114-CORRIDA-POST.{txt,json}` (2026-07-28T01:21:14.971Z), ambas con 95 resultados y el **mismo
  conjunto de ids** (cero id nuevo, cero id desaparecido).
- El universo es **declarativo** (`scripts/links-internos-manifiesto.mjs`), no un crawl: la corrida es
  determinista y auditable fila por fila contra el inventario 113.
- Cero dependencia externa (`node:*` + import local) ⇒ re-ejecutable en 125 sin instalar nada.

---

## Cobertura del universo

Re-confirmación de la reconciliación **77/77** ya CERRADA en Wave 1 (114-01 Task 3), re-calculada
sobre el manifiesto vigente:

| Componente | Refs |
|---|---:|
| `MANIFIESTO` (95 entradas: 67 `status` + 20 `ancla` + 8 `ausencia`) | **73** |
| `EXCLUIDOS` | **4** |
| **Unión** | **77** |
| `REFS_INVENTARIO` (66 filas `AN` de Tabla A §4 + 11 de chrome §2) | **77** |

Diferencia simétrica **vacía en ambos sentidos** (`faltan []` / `sobran []`). **Cero gaps** — a esta
altura un gap sería una regresión del manifiesto y bloquearía el cierre.

**Los 4 `EXCLUIDOS`, con su razón individual:**

| Ref | Razón |
|---|---|
| `C-01-1` | Link **externo** (licencia CC BY 4.0, `app/app/layout.tsx:58`): no es navegación interna. Los patrones externos son alcance de la **Phase 115**. |
| `C-01-4` | Esquema `mailto:` (`app/app/layout.tsx:83`): ni navegación interna ni status HTTP verificable. |
| `C-04-1` | Placeholder dinámico: `Breadcrumbs` (`app/components/breadcrumbs.tsx:38-39`) no emite href propio — renderiza los `items` de la página llamante, cuyos hrefs ya están enumerados en las filas de esa ruta (regla de no-repetición de §2). |
| `4.1-A5` | `verTodosHref` es `null` en los 5 bloques (`app/app/parlamentario/[id]/page.tsx:430,446,462,479,505`) ⇒ el `<a>` **no se emite**: no hay href que solicitar. |

---

## Reproducción

Comandos verbatim y los artefactos que producen:

| Objetivo | Comando | Artefactos |
|---|---|---|
| Corrida completa | `node scripts/verificar-links-internos.mjs --out .planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-POST` | `114-CORRIDA-POST.txt` + `.json` |
| Una ruta | `MSYS_NO_PATHCONV=1 node scripts/verificar-links-internos.mjs --route /proyecto --out <destino>` | `<destino>.txt` + `.json` |
| Un tipo | `node scripts/verificar-links-internos.mjs --tipo ancla --out <destino>` | `<destino>.txt` + `.json` (cf. `114-ANCLAS-RUN.json`) |
| Sólo JSON | `node scripts/verificar-links-internos.mjs --json-only --out <destino>` | `<destino>.json` |
| Que la aserción de ancla MUERDE | `node scripts/verificar-links-internos.selfcheck.mjs` | exit 0 = 10/10 fixtures |
| No-regresión | `pnpm test` · `pnpm typecheck` | — |

**Gotcha LOCKED (Git Bash/Windows):** sin `MSYS_NO_PATHCONV=1`, un `--route /parlamentario/S1338` se
mangle a `C:/Program Files/…` y el filtro devuelve **0 entradas en silencio**.

Exit-code del runner: **0** si todo PASS, **1** si hay algún FAIL (gate usable en CI/125).

---

## Deuda y diferidos

**Hallazgos diferidos: NINGUNO.** El único hallazgo accionable (`H-01`) quedó corregido en esta fase.

**Nota LOCKED — deploy:** el deploy de los fixes de esta fase **viaja con la Phase 125**; ningún flag
fue tocado; `.env` y `.env.example` están **intactos**. Evidencia:
`git diff --stat .env .env.example` → **salida vacía**. Cero paquete npm nuevo
(`git diff --name-only | grep -qE 'package\.json|pnpm-lock\.yaml'` sin match).

**Anclado para la Phase 125 (re-verificación tras deployar):**

| Qué re-correr | Resultado esperado |
|---|---|
| `node scripts/verificar-links-internos.mjs --out <125>/…` | **cero FAIL**, exit **0** (`4.2.b-404` debe pasar de FAIL a PASS). Los `WARN-STREAM` **no cuentan como FAIL**: son los emisores bajo Suspense y se cierran verificando el **DOM** (BrowserOS), no el HTML servido. |
| `node scripts/verificar-links-internos.selfcheck.mjs` | exit 0 (**28** fixtures) |

**Divergencia documental abierta (no es defecto de link) — `D-01`:** 113 §4.1 (líneas 1043-1045)
predice que con `S1338` el carril no ofrece la entrada `#cruces`; el deploy **sí** emite
`href="#cruces"` y **sí** monta `<section id="cruces">`. Emisor y destino coexisten ⇒ el link no está
roto. El inventario 113 **no se editó** (es rector y está `validado`): queda registrado en
`114-HALLAZGOS.md` y `114-ANCLAS.md` §D-01 para quien lo reabra.

---

## Nota post code-review — el runner se endureció DESPUÉS de las corridas guardadas

El code-review de esta fase (`114-REVIEW.md`) encontró que el runner con el que se produjeron
`114-CORRIDA-PRE/POST` era **más laxo** de lo que sus veredictos daban a entender. Los fixes están
aplicados en `scripts/verificar-links-internos.mjs`; los artefactos históricos **NO se re-escribieron**
(sería falsificar la evidencia de lo que realmente se corrió). **La re-corrida real ocurre en la
Phase 125**, junto con el deploy.

| Fix | Qué cambia en el veredicto |
|---|---|
| `CR-01` | `ausencia` exigía sólo "200 **o** 404"; como el cuerpo no se leía fuera del 200, un origen 404 daba **PASS siempre**. Las 8 entradas `tipo=ausencia` que respaldan los gates MONEY/NOTIF eran vacuas ante un origen roto. Ahora exigen 200 con cuerpo no vacío. |
| `CR-02` | `tipo=status` sólo probaba **alcanzabilidad del destino**, nunca que el origen EMITA el href. El veredicto «SC#1 PASS · 63/63» de `114-03-SUMMARY.md` y de §SC#1 de este documento debe leerse, para la corrida guardada, como **"63 destinos alcanzables"**, no como "63 links íntegros". El runner ya comprueba la emisión; la afirmación fuerte sólo podrá hacerse con la corrida de 125. |
| `WR-02` | `no-404` aceptaba 3xx y 5xx como sano. Ahora exige 200 ⇒ una entrada que en la corrida guardada figura PASS por un 301/500 puede aparecer en FAIL en 125. **Eso sería el runner mordiendo, no una regresión del sitio.** |
| `WR-03` / `WR-04` | Los patrones de `ausencia` pasan por la maquinaria endurecida, y el strip de ruido cubre comentarios / `<template>` / `<noscript>`. |
| `WR-05` | Cota de 15s por request y un reintento sin cachear el fallo de red ⇒ la corrida de 125 es determinista bajo red inestable. |
| `W-01` | **Corrección del propio `CR-02`** (la encontró el verifier de fase): el assert de emisión daba **falsos FAIL** con las secciones bajo `<Suspense>`. Tercer estado `WARN-STREAM`, que **no falla la corrida**. |

### W-01 — por qué `WARN-STREAM` y no FAIL (medido, no supuesto)

El assert de emisión de CR-02 sólo mira el markup **vivo** (`sinRuido()` remueve los `<script>`).
Medición contra el deploy (2026-07-28): `/agenda` responde un **shell de streaming** — 54
`animate-pulse` y **cero** ocurrencias de `14309-04`, ni en el markup vivo **ni en el HTML crudo**:
el contenido suspendido se resuelve en el cliente. Con el runner tal como quedó tras CR-02, el
subset `/proyecto` daba **10 FAIL cuando el defecto real era 1**.

`veredictoDeEmision()` usa dos señales, y cualquiera basta para degradar a `WARN-STREAM`:
(a) el href está en el HTML **crudo** (payload RSC dentro de `<script>`); (b) la respuesta es un
**shell** con fallbacks de Suspense sin resolver. Un shell no es evidencia de ausencia: es
**ausencia de evidencia**, y el veredicto honesto es "no se puede concluir desde el HTML servido".
`FAIL` queda reservado a destino no-200, o href ausente del markup vivo **y** del crudo en una
página que **no** es shell — ahí el assert conserva su mordida.

**Estado real del subset `/proyecto` con el runner ya corregido** (`--route /proyecto`, deploy
2026-07-28): **29 entradas · 19 PASS · 1 FAIL · 9 WARN-STREAM · 0 MISSING-SSR**, `exit 1`. El único
FAIL es `4.2.b-404` — el `H-01` ya corregido en código, cuyo deploy viaja con la **Phase 125**. Las
9 `WARN-STREAM` son emisores bajo Suspense (`/agenda` ×3, `/agenda?q=trabajo`, `/buscar?q=…`,
`/proyecto/14309-04` y `/parlamentario/D1165`) y **no son links rotos**: se cierran en 125
verificando el DOM.

**Expectativa actualizada para la Phase 125:** el «95/95 PASS, exit 0» anclado más abajo se evalúa con
el runner **endurecido**. Cualquier delta nuevo respecto de `114-CORRIDA-POST.json` debe atribuirse
primero a estos cinco fixes antes que a un cambio del deploy.

---

## Régimen

Los estados de gate observados en ambas corridas **coinciden exactamente** con §5 del inventario 113
— **cero divergencia de régimen**, y las 8 entradas `tipo=ausencia` cerraron **8/8 PASS**:

| Gate | Estado §5 | Observado en el deploy |
|---|---|---|
| NET | ON | ON — `/red?seed=D1165` y `/parlamentarios` no-404; `/red?seed=D0000000` 404ea |
| CRUCES | ON | ON — `#cruces` presente en ficha de proyecto y de parlamentario |
| MONEY | OFF | OFF — sin `href="/contraparte/`, sin `id="dinero\|contratos\|financiamiento\|aportes"`, con `id="financiamiento-pendiente"`, y `/contraparte/<placeholder>` 404ea |
| NOTIF | OFF | OFF — sin `/cuenta?next=` en el DOM; `/cuenta` y `/notificaciones/*` responden no-404 con su contenido gated |

**Ningún flag fue tocado en esta fase**, ni como remedio ni como conveniencia: el runner sólo lee, y
el único fix aplicado es un cambio de orden de ejecución dentro de una page — sin tocar copy, dato,
conteo, fecha ni gate. Los 3 guards anti-flip (`vsim`, `notif`, `money`) corrieron verdes.
