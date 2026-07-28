---
phase: 114
plan: 01
subsystem: verificación de superficies (links internos)
tags: [links, verificacion, deploy-real, inventario-113, LINK-02]
requires:
  - ".planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md (estado: validado)"
  - "deploy real https://observatorio-congreso.thevalis.workers.dev"
provides:
  - "scripts/links-internos-manifiesto.mjs — universo declarativo de links internos (77 refs cubiertas)"
  - "scripts/verificar-links-internos.mjs — runner reproducible (status/ancla/ausencia, txt+json, exit-code gate)"
  - "114-CORRIDA-PRE.txt / .json — estado PRE-FIX del deploy real"
affects:
  - "114-02 (triage de anclas): consumirá --tipo ancla; esta corrida NO dejó MISSING-SSR"
  - "114-03 (fixes): recibe 1 FAIL y 1 divergencia de inventario"
  - "125 (E2E final): el runner es re-ejecutable tras el deploy"
tech-stack:
  added: []
  patterns:
    - "Universo derivado del inventario, no por crawl; exhaustividad probada por IGUALDAD (77/77)"
    - "Runner con cero dependencias externas: solo node:* + import local"
    - "Mesura: recorrido secuencial + sleep(400) + caché de HTML por URL"
key-files:
  created:
    - scripts/links-internos-manifiesto.mjs
    - scripts/verificar-links-internos.mjs
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-PRE.txt
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-PRE.json
  modified: []
decisions:
  - "cheerio NO resuelve desde la raíz (probe CHEERIO_NO) → verificación por búsqueda sobre el HTML servido; cero paquete nuevo (T-114-SC)"
  - "Las filas que exigen un id de PROD no fijado en §1 (4.1-A7, 4.1-A16, 4.2-A4) se verifican como ruta base con nota de limitación; prohibido inventar ids"
  - "4.2-A5 (stepper) se colapsa en la entrada de ancla #timeline, con la colisión declarada citando tramitacion-stepper.tsx:120,133"
  - "4.1-A5 (verTodosHref null) va a EXCLUIDOS: no hay href que solicitar, la fila declara ausencia por diseño"
metrics:
  duration: ~35 min
  completed: 2026-07-28
---

# Phase 114 Plan 01: Infraestructura de verificación de links internos + corrida PRE-FIX — Summary

Manifiesto declarativo de las 77 referencias de links internos del inventario 113 y runner sin
dependencias que las verifica contra el deploy real; la corrida PRE-FIX deja 94 PASS, 1 FAIL
(`/proyecto/00000-00` responde 200 en vez de 404) y cero anclas MISSING-SSR.

## Qué se construyó

| Tarea | Artefacto | Commit |
|-------|-----------|--------|
| 1 | `scripts/links-internos-manifiesto.mjs` — 95 entradas (67 status / 19 ancla / 9 ausencia) + 4 exclusiones | `b59eeaf` |
| 2 | `scripts/verificar-links-internos.mjs` — runner con `--route` / `--tipo` / `--out` / `--json-only` | `696efdf` |
| 3 | `114-CORRIDA-PRE.txt` + `.json` — evidencia PRE-FIX contra el deploy real | `00e0d5d` |

**Cobertura probada por igualdad:** `MANIFIESTO ∪ EXCLUIDOS === REFS_INVENTARIO` = **77/77**.
El denominador se re-derivó del inventario con los dos `awk` documentados en el módulo: **66**
filas `AN` de Tabla A (§4) + **11** filas de chrome (§2). Cero gap, cero ref inventada.

**Reconciliación cerrada en Wave 1** (no diferida): 73 refs cubiertas por resultados de la corrida
+ 4 por `EXCLUIDOS` (`C-01-1` externo CC BY, `C-01-4` mailto, `C-04-1` breadcrumbs sin href propio,
`4.1-A5` `verTodosHref` null en los 5 bloques).

## Resultado de la corrida PRE-FIX

`node scripts/verificar-links-internos.mjs --out …/114-CORRIDA-PRE` → **exit 1**,
95 entradas, **PASS 94 · FAIL 1 · MISSING-SSR 0** (`2026-07-28T01:06:03.406Z`).

**FAIL único (viaja al Plan 03, no se corrigió aquí):**
`4.2.b-404` — `/proyecto/00000-00` devuelve **200** donde el inventario §4.2.b declara la página
`not-found`. Hipótesis: el boletín inexistente supera `BOLETIN_RE` y la ficha renderiza en vez de
llamar `notFound()` con 0 filas — a diferencia de `/parlamentario/D0000000`, que sí 404ea.

**MISSING-SSR: ninguno.** Las 19 anclas verificadas aparecen como atributo `id` en el HTML SSR ⇒
el Plan 02 **no** necesita el fallback BrowserOS para ninguna ancla de esta corrida.

**Gates (§5) — cero divergencias de régimen:** NET ON, CRUCES ON, MONEY OFF (ausencia de
`href="/contraparte/`, de `id="dinero|contratos|financiamiento|aportes"`, presencia de
`id="financiamiento-pendiente"`, `/contraparte/<placeholder>` → 404), NOTIF OFF (ausencia de
`/cuenta?next=`, rutas no-404). **Ningún flag fue tocado**: el script solo lee.

**Hallazgo de inventario (no de régimen):** §4.1 "Diferencia por sujeto" afirma que con `S1338` el
carril no ofrece la entrada `#cruces`; el deploy **sí** emite `href="#cruces"` y **sí** tiene
`id="cruces"`. El link **no está roto** (destino existente), así que la entrada se verifica como
ancla y pasa; la divergencia se reporta a 114-02 / 114-03 y el inventario 113 no se editó.

## Deviations from Plan

**1. [Rule 1 - Bug] Aserción de manifiesto incorrecta para `S1338` / `#cruces`**
- **Found during:** Task 3 (primera corrida completa)
- **Issue:** la entrada se escribió como `ausencia` de `id="cruces"` leyendo §4.1 como si la
  `<section>` no se montara; el inventario dice que no pinta **detalle**, no que desaparezca.
- **Fix:** se convirtió en entrada `ancla` (`#cruces` en `/parlamentario/S1338`) con la
  divergencia observada declarada en la `nota`. Verificado sobre el deploy: `href="#cruces"` = 1,
  `id="cruces"` = 1.
- **Files modified:** `scripts/links-internos-manifiesto.mjs`
- **Commit:** `00e0d5d`

**2. [Rule 1 - Bug] Causa engañosa en el runner para el tipo `ausencia`**
- **Issue:** el mensaje decía "con el gate X OFF" incluso cuando el gate está ON (caso CRUCES).
- **Fix:** se reformuló a "patrón presente aunque el inventario lo declara ausente (gate X)".
- **Commit:** `00e0d5d`

**3. [Rule 3 - Blocking] Literales `$TMPDIR` / `Promise.all` en comentarios rompían los gates**
- **Issue:** los gates de acceptance son `grep` sobre el archivo completo; los comentarios que
  *prohibían* esos patrones los hacían fallar.
- **Fix:** se reescribieron los comentarios sin los literales, conservando la prohibición.
- **Commit:** `696efdf`

**Desviación declarada (prevista por el plan, no un fix):** la probe
`node -e "import('cheerio')…"` imprimió **`CHEERIO_NO`** ⇒ verificación por búsqueda sobre el HTML
servido, documentada en la cabecera del runner. **Cero paquete nuevo instalado.**

## Gotcha para futuras corridas

En Git Bash, `--route /parlamentario/S1338` se mangle a `C:/Program Files/Git/parlamentario/...`
y el filtro devuelve 0 entradas **silenciosamente**. Anteponer `MSYS_NO_PATHCONV=1`.

## Verificación

| Criterio | Resultado |
|----------|-----------|
| Cobertura 77/77 por igualdad | **OK** — `OK cobertura 77/77 \| entradas 95 \| status 67 ancla 19 ausencia 9 \| excluidos 4` |
| Smoke `--route` + `--tipo` (`os.tmpdir()`) | **OK** — `exit=0 \| route=2 \| tipo-ancla=19` |
| Artefactos `114-CORRIDA-PRE.txt` / `.json` completos | **OK** — 95 resultados, `meta.total` cuadra |
| `git status --porcelain app/ packages/` | **vacío** (este plan no toca código de producto) |
| Cero RUT en los artefactos y en el manifiesto | **OK** |
| Sin `$TMPDIR`, sin concurrencia, con UA identificatorio | **OK** |

## Self-Check: PASSED

- `scripts/links-internos-manifiesto.mjs` — FOUND
- `scripts/verificar-links-internos.mjs` — FOUND
- `114-CORRIDA-PRE.txt` / `114-CORRIDA-PRE.json` — FOUND
- Commits `b59eeaf`, `696efdf`, `00e0d5d` — FOUND en `git log`
