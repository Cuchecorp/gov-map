---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 06
subsystem: verificacion-e2e
tags: [e2e, browseros, dom-hidratado, suspense, islas-cliente, not-found, gates, mcp]
requires:
  - "125-01 (deploy 0ea5d97f-a172-436e-aad0-add95940ee0e)"
  - "125-02/03/04/05 (los limites declarados que este plan cierra)"
  - "113-INVENTARIO.md §0.4 Tabla D (19 filas) + §3.0.1 (huerfanos)"
provides:
  - "125-E2E-D-BROWSEROS.md — pasada BrowserOS con criterio de estratificacion declarado a priori"
  - "captures/ — 23 png (21 del recorrido + 2 de evidencia adicional)"
  - "cierre DOM-hidratado de 4 de los 5 limites declarados por wave 2"
  - "HALLAZGO H-01 (/comparar, error transitorio hidratado) escalado"
affects:
  - "SC2 del ROADMAP v12.0 (parte BrowserOS)"
  - "125-HANDOFF-HUMANO.md (Plan 07): gate humano abierto + 4.9-A1 + H-01"
tech-stack:
  added: []
  patterns:
    - "fragmento verbatim leido de document.body.textContent via evaluate_script (innerText y el extractor markdown son CIEGOS al contenido de Suspense)"
    - "deteccion de fallo del MCP por TEXTO de error, no por exit code (bros-cli sale 0 aunque falle)"
    - "control positivo apareado para cada regex de ausencia, ejecutado en la pagina"
    - "take_snapshot como prueba de presencia, jamas como denominador de interactivos"
key-files:
  created:
    - ".planning/phases/125-e2e-pasada-final-producto-a-producto/125-E2E-D-BROWSEROS.md"
    - ".planning/phases/125-e2e-pasada-final-producto-a-producto/captures/ (23 png)"
  modified: []
decisions:
  - "4.9-A1 se declara NO OBSERVADO en el DOM en vez de PASS: el click no expandio la tarjeta del vecino y fabricar la revelacion via $RC habria sido inventar evidencia"
  - "La ausencia del idiom 'segun … al' en / y /agenda NO es defecto: 117 lo exige en los chokepoints de procedencia, no en fechas de hecho desnudas"
  - "El criterio F-06 no se re-intenta: el 125-03 ya lo declaro insatisfacible por emisor huerfano (E-008)"
  - "H-01 se clasifica transitorio (1 de 2 observaciones, re-test 3/3 sano, HTML servido limpio) y se escala sin arreglar: un fix exigiria re-deploy"
  - "La captura del estado de error de /comparar se PRESERVA como evidencia ademas de la captura sana canonica"
metrics:
  duration: "~85 min"
  completed: 2026-07-29
  filas_tabla_d_cubiertas: "18/19 (fila 15 n/a — EXCLUIDA)"
  urls_recorridas: 21
  capturas: 23
  veredictos: "17 ok + 1 hallazgo"
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
flips_ejecutados: 0
ddl_dml_ejecutado: 0
codigo_modificado: 0
---

# Phase 125 Plan 06: Pasada BrowserOS sobre el DOM hidratado — Summary

Las **18 filas no-EXCLUIDAS** de la Tabla D recorridas con BrowserOS sobre el deploy `0ea5d97f`, con
**21 URLs**, **23 capturas** y fragmento DOM verbatim por fila. El criterio de estratificación se
escribió y se **commiteó antes** de abrir la primera página. **17 `ok` + 1 `hallazgo`** por fila de la
Tabla D (equivalente a 20 `ok` + 1 `hallazgo` por URL: 3 filas se instanciaron con 2 sujetos). Cero
fixes de código, cero DDL/DML, cero deploy, cero flips.

## Lo que este plan cierra de wave 2

Wave 2 midió el HTML servido y declaró honestamente lo que no podía ver. Estado de esos 5 límites:

| límite de wave 2 | estado | evidencia |
|---|:---:|---|
| Suspense de `/proyecto/17870-05` (11 de 12 secciones en `<div hidden id="S:8">`) | **CERRADO** | `textContent` 7.100.139 · 574 links · 257 botones · 266 idioms |
| copy de `not-found` E-049/E-023 sólo en payload RSC (`<main` → 0) | **CERRADO** | las 4 filas del grupo C con copy verbatim y `h1` propia |
| `/`, `/agenda`, `/parlamentarios` → 0 fechas (shell) | **CERRADO** | `/` rinde `22 jul 2026 · 24 jul 2026 · 28 jul 2026 · 10 ago 2026`; `/agenda` `2 ago 2026`; `/parlamentarios` **no es ruta con dato fechado** |
| `/red` como isla cliente | **CERRADO** | grafo con 10 nodos vecinos, seed `80 vecinos · 235 hechos`, filtros y paginación |
| `4.9-A1` (href emitido en `red-graph.tsx:210`) | **NO CERRADO — declarado** | el click no expandió la tarjeta; href **no observado**. Ni PASS ni defecto |

Cerrados además: acordeones/`detalle-colapsable` de `/parlamentario/[id]` (5 `aria-expanded`), island
de filtros de `/buscar` (4 grupos de facetas, 16 botones), island de facetas de `/parlamentarios`,
header-nav en las 18 filas, y **MONEY/NOTIF confirmados OFF hidratados** con control positivo apareado.

## HALLAZGO H-01 — `/comparar`, error transitorio que sólo existe hidratado

En la primera pasada, `/comparar?a=D1170&b=D1165` rindió un error-boundary:

```
No pudimos cargar la portada
Ocurrió un error al consultar los datos. Esto es una falla técnica, no una ausencia de información:
no asumas que no hay registros.
```

Es exactamente la clase de defecto que este plan existe para cazar: el **HTML servido está limpio**
(0 ocurrencias en 5 variantes, HTTP 200, ~109 KB), así que ningún plan de wave 2 podía verlo. El
re-test dio `Comparar dos parlamentarios` en **3/3** ⇒ **transitorio, no reproducible**, severidad
baja, **escalado sin arreglar**. Ambas capturas se preservan (estado de error y estado sano).

Nota de honestidad doble: el copy dice "la portada" en `/comparar` (texto de error reutilizado), y a la
vez **acierta en lo rector** al distinguir falla técnica de ausencia de dato.

## Cruce que confirma un ítem abierto ajeno

El botón de `/parlamentario/D1165` dice literalmente `Ver detalle (1000)`. Coincide con lo que el
125-02 midió: el clamp de `0078` está en PROD (topa en 4000) pero el call-site sigue pasando **1000**.
Este plan lo **confirma en el DOM hidratado** y **no** lo trata como regresión: **B-01 sigue abierto**
tal como lo dejó el 125-02.

## Desviaciones RULE-1 — el instrumento hubo que arreglarlo dos veces

**RULE-1 / D-01 — la primera corrida perdió 12 de 21 capturas en silencio.** `bros-cli` imprime
`CDP request timeout` **y termina con exit 0**, así que el patrón `cmd || (sleep 3; cmd)` del plan
**nunca dispara**. *Antes:* 9 capturas, 12 ausentes, cero señal de fallo. *Después:* detección por
**texto** del error + verificación de tamaño del `.png` + 3 intentos ⇒ **21/21**.

**RULE-1 / D-02 — `get_page_content` y `innerText` son ciegos al contenido de Suspense.** En
`/proyecto/14309-04` el extractor devolvió **645 bytes** (sólo los `##`), mientras el DOM tenía
`textContent` = **914.556** y la captura mostraba la página completa. *Antes:* la pasada habría
reportado "secciones vacías" — el falso hallazgo que el 125-02 anticipó. *Después:* todo fragmento se
lee de `document.body.textContent`.

**RULE-1 / D-03 — `take_snapshot` sub-reporta.** `/buscar` listó 1 botón en el snapshot y **16** en la
enumeración DOM. El snapshot se conserva como prueba de *presencia* (así se documentó el grafo), no
como denominador.

**RULE-1 / D-04 — mi propio §0 violaba su criterio.** El auto-check exigía que la cadena prohibida no
apareciera, y aparecía **1 vez**: en mi nota meta sobre ella y luego en el propio comando del check.
Corregido con regex `[ ]` que no coincide consigo misma, más control positivo. Dos commits
(`8d76d69` → `bc781cc`), **sin `--amend`**.

**RULE-3 / D-05 — el MCP se cayó** (`ECONNREFUSED 127.0.0.1:9200`) y **se recuperó solo** en <12 s. No
hubo que escalar el gate de operador. Confirma T-125-17.

**RULE-3 / D-06 — argumentos del MCP:** `evaluate_script` usa `expression` (no `script`); `click` usa
`element` (no `elementId`). Un intento fallido cada uno.

**Corrección de un error propio:** mi primer selector para `4.9-A1` buscó `a[href^="/parlamentario/"]`;
el emisor real (`red-graph.tsx:210`) produce `/red?seed=<vecinoId>`. Corregido y declarado en §1.5 —
el hallazgo original habría sido un falso negativo por selector equivocado.

## Gate humano: ABIERTO

**El gate NO está cerrado.** Registrado en §3.3 como `SIN RESPUESTA DEL OPERADOR — handoff`. Exige
juicio humano de copy sobre dos capturas (línea de cobertura de lobby en `14309-04`; carril de lobby
sin cifras en `S1338`). **Ninguna aprobación se infirió del silencio** (T-125-18). Lo cierra el
orquestador, o viaja a `125-HANDOFF-HUMANO.md` (Plan 07).

## Ítems escalados (no arreglados aquí)

| id | ítem | destino |
|----|------|---------|
| **H-01** | error transitorio hidratado en `/comparar` | Plan 07 / backlog |
| **4.9-A1** | href `/red?seed=<vecinoId>` no observado en DOM | Plan 07 (verificación manual) |
| gate humano | 3 preguntas de copy sin responder | Plan 07 |
| copy C3/C4 | `not-found` de contraparte y red con copy genérico, sin salida a fuente oficial (C2 sí la ofrece) | observación, sin escalar |

## Restricciones respetadas

| restricción | resultado |
|---|---|
| cero fixes de código / DDL / DML / deploy / flips | ✓ `git diff HEAD~2 HEAD -- app/ packages/ supabase/ scripts/` = **0 archivos** |
| `/admin/revisar-entidades` no navegada (fila 15 EXCLUIDA) | ✓ cero capturas de admin; sólo se nombra como excluida |
| MONEY y NOTIF OFF y ausentes del DOM hidratado | ✓ 3+2 discriminantes = 0 en las 18 filas, con controles positivos |
| cero PII · `SUPABASE_DB_URL` jamás expandida | ✓ sólo sitio público, páginas ocultas, sin sesión autenticada; cero SQL en este plan |
| sin `git commit --amend` | ✓ la corrección de §0 fue un commit nuevo |
| cero `git clean` / reset / stash | ✓ |

## Commits

| hash | contenido |
|------|-----------|
| `8d76d69` | §0: criterio de estratificación declarado **antes** del recorrido |
| `bc781cc` | §0.9: auto-check sin reintroducir el literal prohibido |
| `168e6c9` | §1/§2/§3 + 23 capturas |

## Self-Check: PASSED

| check | esperado | observado |
|---|---|---|
| `125-E2E-D-BROWSEROS.md` existe | sí | ✓ |
| capturas `.png` | ≥10 (plan) · 21 del recorrido | **23** (0 de tamaño 0) |
| las 21 URLs del recorrido con captura | 21 | ✓ 21/21, ninguna `FALTA` |
| 19 filas de la Tabla D en §0.3 | 19 | ✓ 19 |
| 18 filas con fragmento verbatim + veredicto | 18 | ✓ 18 |
| cadena prohibida en el artefacto | 0 | ✓ 0 (control positivo `recorrido` = 5) |
| gate registrado (`aprobado\|SIN RESPUESTA`) | ≥1 | ✓ 1 |
| commits existen | 3 | ✓ `8d76d69` `bc781cc` `168e6c9` |
| borrados en el commit de capturas | 0 | ✓ `git diff --diff-filter=D` vacío |
