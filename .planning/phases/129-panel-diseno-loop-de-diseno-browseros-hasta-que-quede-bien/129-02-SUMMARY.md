---
phase: 129-panel-diseno-loop-de-diseno-browseros-hasta-que-quede-bien
plan: 02
subsystem: diagnostico-h01
tags: [h-01, sc4, flakiness, comparar, error-boundary, doc-only]
requires:
  - "129-01: deploy 4c6fdbda-61ae-485e-9a4d-4197db35cf61 vigente"
  - "129-01: reproduccion de H-01 con SSR sano detras"
provides:
  - "129-H01-DEBUG.md: tasa cuantificada (36 requests), causa raiz con archivo:linea, fix DIFERIDO"
  - "Separacion de H-01 en dos modos de fallo distintos (M-A cliente / M-B servidor)"
  - "Item DIFERIDO listo para que 129-03 lo arrastre a 129-CRITICA.md §Diferidos"
affects:
  - "129-03: debe arrastrar 2 filas DIFERIR (fix de resiliencia + aislamiento de M-A)"
tech-stack:
  added: []
  patterns:
    - "control apareado de chunk: 9 chunks reales 200 vs hash inventado 404"
    - "integridad de stream como metrica aparte del codigo HTTP (bytes + </html> + n de __next_f.push)"
    - "probe del canal RSC con header 'RSC: 1' para medir el path de navegacion de cliente"
key-files:
  created:
    - .planning/phases/129-.../129-H01-DEBUG.md
  modified: []
decisions:
  - "H-01 se separa en M-A (boundary post-hidratacion, reproducido) y M-B (500 __next_error__, 1 observacion): confundirlos era el error de diagnostico previo"
  - "El componente exacto que lanza en M-A NO se aisla; se declara con esas palabras y se publican los 5 descartes con su metodo"
  - "El fix de resiliencia queda DIFERIDO: enmendar el contrato LOCKED #34 requiere pronunciamiento del operador"
metrics:
  duration: ~25 min
  completed: 2026-07-30
---

# Phase 129 Plan 02: H-01 — tasa, causa raíz y diferido — Summary

SC4 cerrado en sus propios términos: **36/36 requests → 200** publicados tal cual, H-01 separado en dos modos de fallo distintos, la causa raíz de cada uno nombrada con `archivo:línea`, y el fix registrado como DIFERIDO con su bloqueo de gobernanza. Plan **doc-only**: `git diff --name-only -- app/` vacío.

## Qué se hizo

| Task | Resultado | Commit |
|---|---|---|
| 1 — Tasa + causa raíz | 24 doc + 12 RSC + 15 integridad + `wrangler tail`; 8 refs `page.tsx:<línea>` | `bd656ae` |
| 2 — DIFERIDO | Sección con mecanismo/propuesta/bloqueo + nota para 129-03 | `bd656ae` |

## Resultado clave: H-01 son DOS fallos, no uno

| Modo | Evidencia | Estado |
|---|---|---|
| **M-A** boundary post-hidratación | Reproducido por la ola 1 con SSR 200 e íntegro detrás | Mecanismo acotado con control apareado; **componente exacto NO aislado** |
| **M-B** `500 __next_error__` | 1 observación del premortem, contra el deploy anterior | Sin explicación confirmada; **se mantiene como observación real, no se descarta** |

Esto **refuta** la hipótesis del premortem de que lo reproducido fuera un 500 de Server Component, y **confirma** la formulación original de D-05.

## §Tasa observada (publicada tal cual)

Ventana `2026-07-30T23:51:21Z`→`23:52:16Z`, deploy `4c6fdbda-61ae-485e-9a4d-4197db35cf61`:

- `/comparar?a=D1178&b=D1099` — **`24 200`** (N=24)
- `/` control apareado — **`24 200`** (N=24)
- canal RSC (`RSC: 1`) — **`12 200`** (N=12)
- integridad — **15/15** `bytes=109384`, `</html>` presente, 14 `__next_f.push`: **una sola variante de tamaño**
- `wrangler tail` ~100 s con 10 recargas — **6/6 `outcome:"ok"`, `exceptions:[]`, `status:200`**

Ceros fuertes, no vacuos: apareados con `D1178`=10 y `<option>`=374 sobre el mismo cuerpo.

## §Causa raíz

**M-A (hipótesis principal, con control apareado):** `/comparar` **no tiene ni un componente cliente propio** — verificado con `"use client"` anclado a línea 1 (`components/comparar-selector.tsx` es un **falso positivo** del `grep -rl`: menciona la directiva en un comentario, línea 20). El único islote es `HeaderNav`, que vive en el layout y está en todas las rutas. Por eliminación, la causa es la **carga del bundle**: 9 chunks reales → `200`, hash inventado (= mapa de chunks del deploy anterior) → **`404`** ⇒ `ChunkLoadError` post-hidratación. Explica cada hecho sin residuo: SSR sano, boundary solo tras hidratar, re-navegar cura, solo en el primer load posterior al deploy, consola vacía.

Descartados con su método: mismatch de tz (`page.tsx:54-61` no se re-ejecuta en cliente), truncamiento (15/15 byte-idénticos), CSP (`connect-src 'self'`, RSC 12/12), fallo de datos (tail 6/6 ok).

**M-B:** `app/app/comparar/page.tsx:246` dispara **seis** lectores en un `Promise.all`, cada uno lanzando (`:81`, `:92`, `:108`, `:124`, `:510`), sin timeout ni retry; y `ls app/comparar/` = solo `page.tsx` + `page.test.tsx` ⇒ **no hay `error.tsx` de ruta**. Mecanismo completo: *fallo transitorio de UNA RPC → `throw` → `Promise.all` rechaza entero → sin boundary de ruta → boundary raíz → `500 __next_error__`*, y el usuario lee `No pudimos cargar la portada` estando en `/comparar`.

## Aislamiento: lo que NO se determinó

**No se aisló el componente exacto que lanza en M-A**, dicho con esas palabras. Impedimento concreto: `get_console_logs` volvió vacío en los 3 intentos de la ola 1 (sin stack trace) y M-A no volvió a presentarse en 36 requests ni en la ventana de tail. La hipótesis del chunk stale es **la mejor sostenida, no un hecho verificado por reproducción**.

## §DIFERIDO registrado

Fix de resiliencia SSR: aislar por eje (`allSettled`), estado `fallo` **distinto** de `vacío` (para no fabricar un hecho negativo), retry acotado + timeout, y `app/comparar/error.tsx` propio. Harness ya existente: `app/app/comparar/page.test.tsx:218-231` (invertir la aserción, con control apareado). **No se implementa porque enmendar el contrato LOCKED #34 (`page.tsx:74-76`) e invertir su test requiere pronunciamiento del operador**; además metería copy nuevo en PROD fuera del único checkpoint humano, y excede SC4.

## Desviaciones

**1. [Rule 3] Primer bucle de medición fallido, descartado entero.** Las redirecciones apuntaban a `$HOME/../AppData` (permiso denegado) ⇒ **cero requests ejecutados** (en bash, una redirección fallida aborta el comando). Se detectó por el propio output, se relanzó con ruta absoluta y **ninguna cifra del documento proviene de esa corrida**. Registrado en el §Método del propio `129-H01-DEBUG.md` para que no se lea como una medición válida.

**2. [Hallazgo de método] `grep -rl '"use client"'` da falsos positivos.** Matcheaba `comparar-selector.tsx` por una mención **en un comentario** (línea 20: *"sin `use client`"*). Sin anclar a la línea 1, el inventario de superficie cliente habría sido erróneo y la causa raíz de M-A habría apuntado a un componente que no existe como cliente.

## Known Stubs

Ninguno: este plan no toca código de la app.

## Threat Flags

Ninguna superficie nueva: plan doc-only, cero archivos de `app/`, cero migraciones, cero paquetes.

## Self-Check: PASSED

- `129-H01-DEBUG.md` — FOUND (246 líneas)
- commit `bd656ae` — FOUND
- `grep -oF 'no reproducible' | wc -l` = **0**
- refs `app/app/comparar/page.tsx:<línea>` = **8** (:74, :81, :92, :108, :124, :246, :510) — ≥5 requerido
- `requiere pronunciamiento del operador` = **1** ≥1
- `page.test.tsx:218` = **3** ≥1
- `git diff --name-only -- app/` = **VACÍO**; `git status --porcelain -- app/` = 0; `supabase/migrations` = 0
- verify literal de Task 1 → **TASK1 PASS**; de Task 2 → **TASK2 PASS**
