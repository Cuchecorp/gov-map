---
phase: 114-link-int-links-internos-exhaustivos
verified: 2026-07-28T02:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Tras el deploy de la Phase 125, solicitar https://observatorio-congreso.thevalis.workers.dev/proyecto/00000-00 y comprobar el status HTTP"
    expected: "404 (hoy el deploy vigente responde 200 — el fix H-01 está en código, sin desplegar)"
    why_human: "El fix vive en `app/app/proyecto/[boletin]/page.tsx` pero el deploy está diferido a 125 por decisión rector v12.0; el status real solo se observa post-deploy"
  - test: "Re-correr `node scripts/verificar-links-internos.mjs --out <basename>` completo en la Phase 125 con el runner ENDURECIDO (post CR-01/CR-02/WR-02) y comparar contra 114-CORRIDA-POST.json"
    expected: "Los FAIL de tipo `href \"X\" NO emitido por <origen> (destino alcanzable)` deben resolverse como falsos positivos del assert de emisión sobre contenido en Suspense, o corregirse el runner"
    why_human: "Verificado en vivo: /agenda devuelve el shell de streaming (54 `animate-pulse`, cero `href=\"/proyecto/…\"`), por lo que el assert de emisión de CR-02 no puede ver secciones diferidas; requiere decisión de diseño del runner"
---

# Phase 114: LINK-INT — Links internos exhaustivos — Verification Report

**Phase Goal:** Ningún link interno del sitio lleva a un 404 ni a un ancla inexistente, verificado sobre el deploy real.
**Verified:** 2026-07-28
**Status:** human_needed
**Re-verification:** No — verificación inicial

> Nota: este es el reporte del verificador (inglés). `114-VERIFICACION.md` (español) es un ENTREGABLE del Plan 03 y no fue tocado.

## Goal Achievement

### Observable Truths (Success Criteria del ROADMAP §114)

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC#1 | Cada link interno del inventario 113 fue solicitado contra el deploy real y devolvió no-404 | ✓ VERIFIED | `114-CORRIDA-POST.json` meta: 95 entradas, PASS 94, FAIL 1, MISSING-SSR 0 contra `https://observatorio-congreso.thevalis.workers.dev`. El único FAIL (`4.2.b-404`) es la dirección INVERSA (se esperaba 404 y llegó 200) — ningún destino real 404ea. Re-corrida propia del subset `/proyecto` (2026-07-28T01:53Z) confirma todos los destinos alcanzables |
| SC#2 | Cada ancla `#id` existe en el DOM de la página destino | ✓ VERIFIED | `114-ANCLAS.md` 20/20 anclas `existe` por SSR; MISSING-SSR = 0 en PRE y POST. Re-corrida propia: las 12 anclas de `/proyecto/14309-04` PASS con la aserción endurecida. Aserción PROBADA: `node scripts/verificar-links-internos.selfcheck.mjs` → **22 fixtures, 0 fallos, exit 0** (distingue `id` real de `aria-controls`, `<script>`, comentario, `<template>`, `<noscript>`) |
| SC#3 | Todo link o ancla roto quedó corregido en el código, con evidencia antes/después | ✓ VERIFIED (con limitación declarada) | Hallazgo único H-01 corregido en `app/app/proyecto/[boletin]/page.tsx:68-76`: `if (!(await leerProyecto(boletin))) notFound();` ELEVADO al componente de página, antes del boundary de streaming, reusando la lectura `cache()`-ada (línea 421). Evidencia antes/después en `114-HALLAZGOS.md` + `114-VERIFICACION.md`. **Limitación declarada (NO gap):** el deploy viaja con la Phase 125 (decisión LOCKED del prompt rector v12.0) ⇒ el deploy vigente aún responde 200 |
| SC#4 | La corrida es reproducible (comando + salida guardada), no un chequeo manual | ✓ VERIFIED (con warning) | `scripts/verificar-links-internos.mjs` (413 líneas, ejecutable) + `scripts/links-internos-manifiesto.mjs` (394 líneas). Ejecutado por el verificador contra el deploy real: `node scripts/verificar-links-internos.mjs --route /proyecto --out <tmp>` → 29 entradas procesadas, salida txt+json. Salidas guardadas PRE/POST presentes |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/links-internos-manifiesto.mjs` | Universo declarativo con trazabilidad ref-por-ref | ✓ VERIFIED | Importado en runtime: exporta `BASE_URL`, `MANIFIESTO` (95), `REFS_INVENTARIO` (**77** = igualdad con el inventario), `SUJETOS`, `EXCLUIDOS` (4), `EMISORES_HUERFANOS`, `RUTAS_EXCLUIDAS` |
| `scripts/verificar-links-internos.mjs` | Runner reproducible status+ausencia, txt/json, filtrable | ✓ VERIFIED | Ejecutado en vivo, exit code semántico (1 con FAIL, 2 con error de uso), UA identificatorio desde `INGESTA_CONTACTO`, delay 400ms, timeout 15s + 1 reintento |
| `scripts/verificar-links-internos.selfcheck.mjs` | Self-check que prueba que la aserción muerde | ✓ VERIFIED | 203 líneas, 22 fixtures, exit 0 ejecutado por el verificador |
| `114-CORRIDA-PRE.{txt,json}` | Estado ANTES del fix | ✓ VERIFIED | 95 entradas, PASS 94 / FAIL 1, ts 2026-07-28T01:06Z |
| `114-CORRIDA-POST.{txt,json}` | Estado DESPUÉS | ⚠️ VERIFIED (stale) | 95 entradas, PASS 94 / FAIL 1, ts 2026-07-28T01:21Z — generada ANTES del endurecimiento del runner (commits 21:39-21:51) |
| `114-ANCLAS.md` / `114-HALLAZGOS.md` / `114-VERIFICACION.md` | Veredictos y cierre | ✓ VERIFIED | 20 anclas con método; H-01 con emisor/intención/fix; SC#1-4 con evidencia |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `verificar-links-internos.mjs` | `links-internos-manifiesto.mjs` | import estático | ✓ WIRED (probado por ejecución) |
| runner | deploy real (`observatorio-congreso.thevalis.workers.dev`) | fetch secuencial con delay | ✓ WIRED (29 requests reales observados) |
| `selfcheck.mjs` | aserción exportada del runner | import | ✓ WIRED (22 fixtures ejercitan la función real) |
| `114-HALLAZGOS.md` | `114-CORRIDA-PRE.json` | id de manifiesto `4.2.b-404` | ✓ WIRED |
| `114-VERIFICACION.md` | `114-HALLAZGOS.md` | disposición de H-01 | ✓ WIRED |
| Fix H-01 | `app/app/proyecto/[boletin]/page.tsx` | `notFound()` pre-streaming | ✓ WIRED (líneas 68-76, previo al return del árbol) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|---|---|---|---|---|
| `MANIFIESTO` | 95 entradas con `inventarioRef` | inventario 113 (`validado`) | Sí — 77/77 refs por igualdad | ✓ FLOWING |
| `114-CORRIDA-POST.json` | `status`/`resultado` por entrada | fetch al deploy real | Sí — status HTTP reales, ts real | ✓ FLOWING (pero pre-endurecimiento) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| La aserción de ancla muerde | `node scripts/verificar-links-internos.selfcheck.mjs` | 22 fixtures, 0 fallos | ✓ PASS |
| El manifiesto cubre 77/77 refs | import + `REFS_INVENTARIO.length` | 77 | ✓ PASS |
| El runner corre contra el deploy | `... --route /proyecto --out <tmp>` | 29 entradas, PASS 19 / FAIL 10 | ⚠️ ver Warning |
| Fix H-01 presente en código | grep `page.tsx` | `notFound()` en línea 75 antes del árbol | ✓ PASS |
| Estado real del 404 en el deploy | entrada `4.2.b-404` | 200 | ✗ (deploy diferido a 125 — declarado) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| LINK-02 | 114-01/02/03 | Todo link interno resuelve (cero 404, cero anchors rotos), verificado exhaustivo sobre el deploy real | ✓ SATISFIED (cierre pendiente de deploy en 125) | 95/95 entradas ejercitadas contra el deploy; 0 destinos 404; 20/20 anclas existen; único defecto (contrato 404 de `/proyecto/<inexistente>`) corregido en código |

Sin requisitos huérfanos: REQUIREMENTS.md mapea LINK-02 → Phase 114 y los 3 planes lo declaran.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/verificar-links-internos.mjs` | filtro `--route` | Un `--route` que no matchea nada procesa 0 entradas y sale con exit 0 | ℹ️ Info | Una corrida vacía se ve como éxito (observado con path mangling de Git Bash: `route=C:/Program Files/Git/metodologia`, 0 de 95, exit 0). Usar `MSYS_NO_PATHCONV=1` |

Cero marcadores TBD/FIXME/XXX sin referencia en los archivos de la fase.

### Warnings

**W-01 — El artefacto POST y el runner actual divergen.** `114-CORRIDA-POST.json` (01:21Z) se generó con el runner PRE-endurecimiento. Con el runner actual (post CR-02, que exige que el ORIGEN emita el href) el subset `/proyecto` arroja 10 FAIL en vez de 1. Verificado en vivo la causa: `/agenda` sirve el shell de streaming (54 `animate-pulse`, cero `href="/proyecto/…"` en el HTML servido), por lo que el assert de emisión no puede ver secciones bajo Suspense y produce falsos FAIL del tipo `href "X" NO emitido por <origen> (destino alcanzable)`. **Ningún destino 404ea** ⇒ el goal no se falsifica, pero la re-corrida de la Phase 125 heredará estos falsos positivos si el runner no se ajusta (leer el stream completo o declarar los orígenes con contenido diferido).

### Human Verification Required

#### 1. 404 real de `/proyecto/<boletín inexistente>` post-deploy

**Test:** Tras el deploy de la Phase 125, `curl -I .../proyecto/00000-00`
**Expected:** `404` (hoy: 200)
**Why human:** El fix está en código; el deploy está LOCKED a la Phase 125 por decisión rector v12.0.

#### 2. Re-corrida completa con el runner endurecido

**Test:** `node scripts/verificar-links-internos.mjs --out .../125-CORRIDA` completo en 125
**Expected:** 95/95 PASS, o los FAIL de emisión resueltos/declarados como limitación del assert sobre Suspense
**Why human:** Requiere decisión de diseño sobre cómo el runner observa contenido diferido.

### Gaps Summary

No hay gaps que bloqueen el goal. Los 95 links/anclas del universo fueron solicitados contra el deploy real: cero destinos 404, cero anclas inexistentes, aserción de ancla probada con 22 fixtures. El único defecto hallado (H-01: el contrato 404 de `/proyecto/<inexistente>` devolvía 200 por el boundary de streaming) está corregido en `app/app/proyecto/[boletin]/page.tsx` con la comprobación elevada antes de emitir cabeceras. Lo que queda es deploy-gated (Phase 125, decisión rector) más el ajuste del assert de emisión introducido por el code-review, ambos ruteados a verificación humana.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
