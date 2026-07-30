---
phase: 114
plan: 02
subsystem: verificación de superficies (anclas + triage de links internos)
tags: [links, anclas, selfcheck, mutation-test, deploy-real, LINK-02]
requires:
  - "114-01 (manifiesto 95 entradas + runner + 114-CORRIDA-PRE.json/.txt)"
  - "113-INVENTARIO.md (estado: validado) — §4.1 A3/A19/A20, §4.2 A1/A2/A5, §4.2.b"
  - "deploy real https://observatorio-congreso.thevalis.workers.dev"
provides:
  - "scripts/verificar-links-internos.selfcheck.mjs — 10 fixtures que prueban que la aserción de ancla muerde"
  - "tieneId() exportada y endurecida (strip de <script>) desde scripts/verificar-links-internos.mjs"
  - "114-ANCLAS.md — veredicto de las 20 anclas (20/20 existe por SSR) + 3 filas ausente-declarado"
  - "114-HALLAZGOS.md — lista cerrada: 1 hallazgo accionable (H-01)"
  - "114-ANCLAS-RUN.json — corrida --tipo ancla con la aserción ya endurecida"
affects:
  - "114-03 (fixes): recibe H-01 y un único archivo a tocar"
  - "125 (E2E final): re-corrida del runner + selfcheck tras el deploy"
tech-stack:
  added: []
  patterns:
    - "Mutation self-check de la aserción (68-01, 100-01, 103-01): relajarla debe romper el guard"
    - "Guard de import (pathToFileURL) para que un runner CLI sea importable sin ejecutarse"
    - "Evidencia textual recortada ≤120 chars en vez de screenshots (T-114-04)"
key-files:
  created:
    - scripts/verificar-links-internos.selfcheck.mjs
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-ANCLAS.md
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-HALLAZGOS.md
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-ANCLAS-RUN.json
  modified:
    - scripts/verificar-links-internos.mjs
decisions:
  - "La aserción se endureció removiendo bloques <script> antes de buscar: el payload RSC de Next.js es texto y podría contener un id serializado sin que exista el elemento"
  - "No se abrió BrowserOS: 0 anclas MISSING-SSR ⇒ la rama sin fallback es el resultado válido, y evita T-114-04/T-114-05 gratuitamente"
  - "La lección v8.0 (scroll-margin) se cerró con evidencia MÁS fuerte que getComputedStyle: la regla global leída del bundle CSS que sirve el deploy"
  - "H-01 usa la intención `añadir el id al destino` reformulada como corrección del destino: no hay href que arreglar, el defecto es el contrato HTTP de la ruta"
  - "El inventario 113 NO se editó pese a la divergencia D-01: es rector y está validado; la divergencia se registra en los artefactos de 114"
metrics:
  duration: ~30 min
  completed: 2026-07-28
---

# Phase 114 Plan 02: Veredicto de anclas + lista cerrada de hallazgos — Summary

Las 20 anclas `#id` del universo existen como elemento real en el HTML del deploy — verificado con una
aserción **endurecida y probada por mutación** — y el triage cierra con **un solo defecto accionable**:
`/proyecto/<boletín inexistente>` devuelve HTTP 200 en vez de 404 porque el `notFound()` vive dentro
de un boundary de streaming.

## Qué se construyó

| Tarea | Artefacto | Commit |
|-------|-----------|--------|
| 1 | `tieneId()` exportada + endurecida, `verificar-links-internos.selfcheck.mjs`, `114-ANCLAS.md`, `114-ANCLAS-RUN.json` | `ab653d4` |
| 2 | Rama sin fallback BrowserOS registrada en `114-ANCLAS.md` | `e3328f1` |
| 3 | `114-HALLAZGOS.md` — lista cerrada | `f300f17` |

## La aserción de ancla: qué cambió y por qué

**Ya era correcta en lo esencial** (`\sid=["']x["']` descarta `aria-controls`, `aria-labelledby`,
`data-id` y el prefijo ajeno `votos-extra`), así que ese núcleo se dejó intacto. Se **añadió** una
sola cosa: remover los bloques `<script>…</script>` antes de buscar. Motivo concreto, no cosmético:
el payload RSC de Next.js viaja como texto dentro de `self.__next_f.push([...])` y puede contener un
`id=\"votos\"` serializado — un elemento que existe en el string pero **no** en el DOM.

**Prueba de que el self-check muerde (acceptance explícita):** relajando `tieneId` a
`String(html).includes(id)`, `node scripts/verificar-links-internos.selfcheck.mjs` salió **exit 1 con
6 de 10 fixtures en FAIL** (`aria-controls`, `<script>`, `votos-extra`, `data-id`, `aria-labelledby`,
payload RSC). La relajación se revirtió (`git diff` confirmó el retorno al archivo endurecido) y el
self-check volvió a **exit 0**.

**Regresión del contrato:** re-corrida `--tipo ancla` **con la aserción endurecida** →
20/20 PASS, 0 MISSING-SSR, exit 0. El endurecimiento **no** convirtió ningún PASS previo en falso
negativo. Smoke de 114-01 (`--route /metodologia` con `os.tmpdir()`) sigue verde: exit 0, 2/2 PASS.

## Resultado del veredicto de anclas

| Veredicto | N | Detalle |
|---|---|---|
| `existe` (método SSR) | **20** | las 20 entradas `ancla` del manifiesto, con evidencia `<section id="…" class="mt-12">` |
| `ausente` | **0** | — |
| `ausente-declarado` | **3 filas** | `#dinero` y `#financiamiento` (MONEY OFF, 113 §4.1 A19/A20) y `#contratos`/`#aportes` de `/contraparte/[id]` (ruta 404 entera por gate) |
| `MISSING-SSR` | **0** | ⇒ **BrowserOS no se abrió** |

**scroll-margin (lección v8.0) — verificado, sin hallazgo.** Ninguna `<section id=…>` lleva
`scroll-mt-*` (0 ocurrencias en las 3 rutas), pero existe la regla global
`:where([id]) { scroll-margin-top: 5rem; }` (`app/app/globals.css:103-108`), y se comprobó **en el
bundle que sirve el deploy** (`/_next/static/chunks/1wa_zok604slz.css` →
`:where([id]){scroll-margin-top:5rem}`). Cubre por construcción los 20 destinos.

## Hallazgo único: H-01

`/proyecto/00000-00` → **200** donde 113 §4.2.b declara la página `not-found`. Diagnóstico cerrado
contra el deploy: el boletín sintético **pasa** `BOLETIN_RE` (`page.tsx:60-62`), así que el 404
depende del segundo guard, `FichaSection` con 0 filas (`page.tsx:428-431`) — que corre **dentro de un
boundary de streaming**. El cuerpo entregado SÍ es la UI de not-found (`"No encontramos"`,
`"Buscar en el Senado"`, `"Volver al inicio"` presentes) pero llega junto al shell de la ficha
(`id="estado"` presente) y con las cabeceras ya emitidas ⇒ el status ya no puede cambiar. Contraste
que lo prueba: `/parlamentario/D0000000` **sí** 404ea. Fix propuesto (Plan 03, un solo archivo):
elevar `leerProyecto` + `notFound()` al componente de página, antes de abrir el streaming.

## Deviations from Plan

**1. [Rule 3 - Blocking] El runner ejecutaba `main()` al ser importado**
- **Found during:** Task 1, al crear el self-check.
- **Issue:** `scripts/verificar-links-internos.mjs` llamaba `main()` en el top level; importarlo desde
  el self-check disparaba la corrida y salía `exit 2` por falta de `--out`, haciendo imposible probar
  la aserción — que es justamente lo que el plan exige.
- **Fix:** guard `import.meta.url === pathToFileURL(process.argv[1]).href`; el módulo solo corre
  invocado como script. El CLI se comporta idéntico (verificado con el smoke `--route`).
- **Files modified:** `scripts/verificar-links-internos.mjs`
- **Commit:** `ab653d4`

**2. [Rule 2 - Correctitud] La corrida PRE tenía 20 anclas, no 19**
- **Issue:** el `114-01-SUMMARY.md` afirma «19 anclas»; el JSON tiene **20** resultados de tipo
  `ancla`. Era un error de conteo del texto del SUMMARY anterior, no del manifiesto ni de la corrida.
- **Fix:** `114-ANCLAS.md` documenta **20** y lo cuadra por igualdad contra el manifiesto y contra
  `114-ANCLAS-RUN.json`. No se editó el SUMMARY de 114-01 (artefacto cerrado); la corrección queda
  aquí y en `114-ANCLAS.md`.
- **Commit:** `ab653d4`

**3. [Rule 3 - Blocking] Timeout transitorio de red al recolectar evidencia**
- **Issue:** un `fetch` al deploy cayó por `UND_ERR_CONNECT_TIMEOUT` a mitad de la extracción de
  fragmentos.
- **Fix:** el script de evidencia (temporal, no commiteado) se dotó de 3 reintentos con espera de 3 s
  y `sleep(800)` entre rutas. **Solo 3 requests reales** al deploy para las 3 rutas con anclas.
- **Commit:** n/a (herramienta efímera en el scratchpad; la evidencia vive en `114-ANCLAS.md`)

**Ramas declaradas del plan que se tomaron (no son desviaciones):** fallback BrowserOS **no
requerido** (0 MISSING-SSR) y aserción del runner que ya era correcta en su núcleo ⇒ se documentó lo
que cambió y lo que se dejó intacto, en vez de cambiar por cambiar.

## Verificación

| Criterio | Resultado |
|----------|-----------|
| `node scripts/verificar-links-internos.selfcheck.mjs` | **exit 0** — 10 fixtures, 0 fallos (los 3 obligatorios del `<behavior>` incluidos) |
| Self-check probado que MUERDE (mutación → exit 1) | **OK** — 6/10 FAIL con `includes()`; revertido |
| Verify de Task 1 (selfcheck + conteo de filas + RUT) | **OK** — `OK selfcheck + anclas 20 filas 23` |
| Verify de Task 2 (pendientes / veredictos / RUT) | **OK** — `OK sin pendientes`; veredictos ∈ {`existe`, `ausente-declarado`} |
| Verify de Task 3 (secciones + disposición de FAIL + RUT) | **OK** — `OK hallazgos 4 \| FAIL con disposicion 1` |
| Smoke 114-01 `--route /metodologia` (`os.tmpdir()`) | **OK** — exit 0, 2/2 PASS |
| `git status --porcelain app/ packages/` | **vacío** (este plan tampoco toca código de producto) |
| Cero RUT y cero screenshots en los artefactos | **OK** |
| Paquetes nuevos (T-114-SC) | **CERO** |
| Flags tocados | **NINGUNO**; deploy **NO** ejecutado (viaja con la Phase 125) |

## Self-Check: PASSED

- `scripts/verificar-links-internos.selfcheck.mjs` — FOUND
- `.planning/phases/114-link-int-links-internos-exhaustivos/114-ANCLAS.md` — FOUND
- `.planning/phases/114-link-int-links-internos-exhaustivos/114-HALLAZGOS.md` — FOUND
- `.planning/phases/114-link-int-links-internos-exhaustivos/114-ANCLAS-RUN.json` — FOUND
- Commits `ab653d4`, `e3328f1`, `f300f17` — FOUND en `git log`
