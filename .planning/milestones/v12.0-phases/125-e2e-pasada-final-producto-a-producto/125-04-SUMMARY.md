---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 04
subsystem: gates / regimen
tags: [gates, money, notif, net, cruces, vsim, e2e, verificacion-de-ausencia]
requires: ["125-01 (deploy 0ea5d97f)"]
provides: ["125-E2E-C-GATES.md — estado de los 5 gates con evidencia HTTP+DOM"]
affects: ["SC5 del ROADMAP v12.0"]
tech-stack:
  added: []
  patterns: ["control de ausencia SIEMPRE apareado con control positivo", "grep -o | wc -l (nunca grep -c) sobre HTML de una linea", "diff acotado a codigo para probar cero flips"]
key-files:
  created:
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-E2E-C-GATES.md
  modified:
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/deferred-items.md
decisions:
  - "El criterio 'Financiamiento -> 0' del plan es invalido: la palabra vive en el copy del propio gate OFF. Sustituido por 14 discriminantes de emision MONEY (RULE-1)"
  - "grep -i combinado con -F devuelve 0 SIEMPRE en GNU grep 3.0 (Git Bash): prohibido en controles de ausencia"
  - "El idiom LOCKED 'segun <fuente> al' se sirve como FAMILIA (segun Camara al / segun Senado al); el grep literal 'segun fuente al ' es demasiado estrecho"
  - "/red no es ruta con dato fechado: 0 fechas es-CL renderizadas; el criterio de idiom no le aplica"
metrics:
  duration: ~35 min
  completed: 2026-07-29
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
flips_ejecutados: 0
---

# Phase 125 Plan 04: Gates — Summary

Los 5 gates quedan registrados por evidencia HTTP+DOM sobre el deploy `0ea5d97f`: MONEY y NOTIF
probados **OFF y ausentes del DOM** con cada control de ausencia apareado a un control positivo, y
CRUCES/NET/VSIM probados **ON** — con VSIM verificado por par mismo-cámara para no confundir el
HALLAZGO A con un gate apagado. **Cero flips.**

## Paso 0 — precondición de frescura: APROBADA

Bloqueante y doblemente crítica aquí (un 404 de gate y un 404 de deploy roto son indistinguibles).

| control | resultado |
|---|---|
| uuid leído del runbook §2 | `0ea5d97f-a172-436e-aad0-add95940ee0e` ✓ |
| `/proyecto/14309-04` | **200**, 1.278.386 bytes ✓ |
| marcador **positivo** `3,8` (fix de 122) | **2** ocurrencias, en la línea de cobertura lobby↔PL con `29 jul 2026` ✓ |

Recién tras esto, cualquier 404 pasó a contar como evidencia de gate.

## Tabla de los 5 gates

| gate | estado | evidencia principal | control positivo apareado |
|---|:---:|---|---|
| **MONEY** | **OFF** | secret ausente; `/contraparte/{S1338,D1165,zzz-inexistente-999}` → **404** ×3 (byte-idénticos tras normalizar el id ⇒ es el gate, no "id no hallado"); **14** discriminantes de emisión MONEY → **0** en **5** rutas | cada patrón sembrado → 1; `grep -oF 'Observatorio'` por archivo → 188/8/8/8/8 (los 5 HTML se leyeron) |
| **NOTIF** | **OFF** | secret ausente; `/cuenta` → **200** con «Las suscripciones no están disponibles en este momento» verbatim (**el 500 de v10.0 no reaparece**); `/notificaciones/{baja,confirmar}` → **200** inertes, **sin token inventado**; `seguir`/`Suscrib`/`notificac` → **0** en 3 rutas | el mismo `grep -oi 'suscrip'` da **2** en `/cuenta` |
| **CRUCES** | **ON** | secret presente; `id="cruces"` → **1** en `/parlamentario/D1165` y **1** en `/proyecto/14309-04` | rail completo de 7 anclas enumerado |
| **NET** | **ON** | secret presente; `/red?seed=D1165` → **200**, 1.636.624 B con `nodos`+`aristas` poblados; `id="relaciones"` → **1** en la ficha | fragmento verbatim del subgrafo citado |
| **VSIM** | **ON** | secret presente; `?a=D1170&b=D1165` (**mismo-cámara**) → `Coinciden en 3655 de 3672 votaciones compartidas (100%)` + caveat de base alta | el par **cruzado** da 0 y se explica por **HALLAZGO A**, jamás como "VSIM OFF" |

`wrangler secret list` corrido **solo en lectura** (binario de AppData; el del PATH es el paquete
Python de miniconda que lo sombrea): 6 nombres, **cero valores**. `MONEY_PUBLIC_ENABLED` y
`NOTIF_PUBLIC_ENABLED` **ausentes = OFF**, idéntico al runbook §2.3. **Cero `secret put`.**

## Guards de régimen sobre el DOM servido (4 rutas)

`Actualizado hace` → **0**, `Actualizado` → **0**, `corte al` → **0**, `captura` como palabra → **0**
(y **0** en las 15 rutas capturadas). Cada uno con su positivo sembrado en 1.
`Actualizado hace` se declara **INERTE** (ya era 0 pre-deploy); el discriminante real es el par
`Actualizado` 318→0 + `según fuente al ` 0→32.

## Deviations from Plan

### 1. [RULE-1 — criterio de plan falsado por la realidad] `Financiamiento → 0` es inalcanzable y el propio `read_first` lo decía

- **Found during:** Task 1, paso 2.
- **Antes:** el plan exigía `grep 'Financiamiento'` → **0** en `/parlamentario/{D1165,S1338}`.
- **Realidad medida:** **6** y **4**. Investigado antes de concluir: 4+3 son el **placeholder del gate
  OFF** (`<section id="financiamiento-pendiente" class="mt-12 opacity-60">` → «Financiamiento y
  contratos del Estado / Pendiente de revisión legal (Ley 21.719) antes de publicarse») y 2 son un
  **asunto de lobby real** («Financiamiento SENDA…»), ajeno a MONEY.
- **Clave:** `113-INVENTARIO.md` §5 — `read_first` de este mismo plan — **ya documentaba el
  placeholder palabra por palabra**. El criterio contradecía su propia fuente.
- **Después (fix, no relajación):** criterio sustituido por los **14 discriminantes de emisión** que el
  inventario define como señal real (links a `/contraparte/`, mercadopublico/servel, nombres de RPC de
  dinero, montos, fechas de esos bloques) → **0** en 5 rutas. `Financiamiento` descartado como control
  por falso positivo estructural.
- **Commit:** `873f602`

### 2. [RULE-1 — gotcha de medición NUEVO] `grep -i` + `-F` devuelve 0 SIEMPRE (GNU grep 3.0)

- **Found during:** Task 2, al fallar un **control positivo**: `grep -oiF 'suscripciones'` sobre
  `/cuenta` dio **0** con el copy a la vista.
- **Issue:** en GNU grep 3.0 (Git Bash/MSYS2) la combinación `-i`+`-F` produce **0 coincidencias
  incluso sobre positivo sembrado**. Es el fallo más peligroso posible para un plan de ausencia: un
  falso cero es exactamente el resultado que se busca demostrar.
- **Después:** matriz de 8 variantes documentada en §0.2; regla para 125-02…07 («jamás `-i` con `-F`»).
  La única celda contaminada (`notificac`) fue **recalculada con `-oi`** → sigue 0, ahora válido. El
  resto de las tablas ya usaba `-oF` y no requirió cambios.
- **Commit:** `873f602`

### 3. [Ajuste de alcance declarado, no desviación] el idiom LOCKED es una FAMILIA

`según fuente al ` da **0** en `/parlamentarios`, pero la ruta sirve **372** instancias de
`según Cámara al 22 jul 2026` / `según Senado al …` — **más** específico, no menos. No es hallazgo:
el grep literal del plan no cubría la familia. Y `/red` **no es ruta con dato fechado** (0 fechas
es-CL renderizadas; las 8.990 ISO viven solo en el payload del grafo), así que el criterio ≥1 no le
aplica — se declara en lugar de forzarlo.

## Cero flips — probado con el diff acotado, y con la auto-falsación demostrada

| variante | salida |
|---|---|
| **acotada** `-- app/ packages/ supabase/ .github/ ':!.planning/'` | **VACÍA** ✓ — **0** archivos de código/config tocados por toda la Phase 125 |
| sin acotar | `125-E2E-C-GATES.md` — **este mismo informe** |

Demostrado empíricamente tras commitear el artefacto: el único «hit» del criterio sin acotar es la
propia evidencia. Un plan que usara el diff completo reportaría un flip inexistente.

## Restricciones honradas

Cero `secret put` · cero flips · cero DDL/DML · cero fixes de código · cero deploy · cero PII
(ids públicos + un placeholder sintético, ningún RUT) · `SUPABASE_DB_URL` jamás expandida · cero
navegación a `/admin/revisar-entidades` · cero requests a fuentes gubernamentales (todo contra el
Worker propio, **secuencial, 1 s**) · cero tokens inventados · cero archivos de los planes 02/03/05/06.

## Known Stubs

Ninguno. El artefacto es un informe de medición; toda cifra proviene de salida real citada.

## Deferred Issues

1. **F-08 de 117 no verificable** contra dato real con MONEY OFF — declarado explícitamente en el
   artefacto §2.4; **no se afirma verificado**. Pendiente del flip de MONEY (deuda de operador).
2. **`og:image`/`twitter:image` → `http://localhost:3000`** en el deploy. Ajeno a los 5 gates y al
   alcance (cero fixes de código). Registrado en `deferred-items.md`; requiere `metadataBase`.

### 4. [RULE-1 — tercer gotcha de medición] `set -o pipefail` + `grep -q` fabrica falsos negativos

- **Found during:** el **self-check de este propio plan**, que reportó `MISSING: 873f602` para un
  commit que existe.
- **Issue:** `grep -q` cierra el pipe al primer match → `git log` muere por **SIGPIPE** → con
  `pipefail` la tubería sale **141**, y el `&&` no dispara. Tercer generador de falsos negativos de la
  corrida, después de `grep -c` sobre HTML de una línea y de `-i`+`-F`.
- **Después:** existencia de commits se comprueba con `git cat-file -t <hash>` (sin tubería).
  Documentado en §0.3 del artefacto. **Ninguna cifra del informe está afectada**: todas las mediciones
  usan `grep -o … | wc -l`, que consume el stream completo y no provoca SIGPIPE.

## Self-Check: PASSED

- `125-E2E-C-GATES.md` — FOUND · `125-04-SUMMARY.md` — FOUND · `deferred-items.md` — FOUND
- commit `873f602` — **FOUND** vía `git cat-file -t` (`git log | grep -q` bajo `pipefail` dio un falso
  negativo por SIGPIPE — ver desviación 4); `git branch --contains 873f602` → `master`
- contiene `MONEY` (must_have `contains`) — sí, **16** ocurrencias (frontmatter, §1, §2)
