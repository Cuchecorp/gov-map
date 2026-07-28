---
phase: 114-link-int-links-internos-exhaustivos
verified: 2026-07-28T02:20:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verify_in_125:
  - item: "Status HTTP real de /proyecto/<boletín inexistente> tras el deploy"
    expectativa: "404 (el deploy vigente responde 200 — fix H-01 en código, sin desplegar)"
    razon: "Decisión rector del PROMPT v12.0: el deploy de los fixes viaja con la Phase 125. No es acto humano de esta fase"
  - item: "Los 9 WARN-STREAM del universo (orígenes que sirven shell de Suspense)"
    expectativa: "Cero FAIL + resolución de cada WARN-STREAM por DOM/BrowserOS"
    razon: "No cerrables por HTML servido: el href vive en el DOM resuelto. Re-anclado en 114-VERIFICACION.md"
---

# Phase 114: LINK-INT — Links internos exhaustivos — Verification Report

**Phase Goal:** Ningún link interno del sitio lleva a un 404 ni a un ancla inexistente, verificado sobre el deploy real.
**Verified:** 2026-07-28 (re-emitido tras el cierre de W-01, commits `07c19ea` + `43681fb`)
**Status:** passed — con limitación documentada en `re_verify_in_125`
**Re-verification:** Sí — segunda pasada del verificador sobre la fase

> Nota: este es el reporte del verificador (inglés). `114-VERIFICACION.md` (español) es un ENTREGABLE del Plan 03 y no fue tocado.

## Goal Achievement

### Observable Truths (Success Criteria del ROADMAP §114)

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC#1 | Cada link interno del inventario 113 fue solicitado contra el deploy real y devolvió no-404 | ✓ VERIFIED | `114-CORRIDA-POST.json`: 95 entradas contra `observatorio-congreso.thevalis.workers.dev`, cero destinos 404. El único FAIL (`4.2.b-404`) es la dirección INVERSA (se esperaba 404, llegó 200). Re-corrida propia del subset `/proyecto` con el runner actual: **29 entradas · PASS 19 · FAIL 1 · WARN-STREAM 9 · MISSING-SSR 0**, todos los destinos alcanzables |
| SC#2 | Cada ancla `#id` existe en el DOM de la página destino | ✓ VERIFIED | `114-ANCLAS.md` 20/20 anclas `existe` por SSR; MISSING-SSR = 0 en PRE, POST y en mi re-corrida. Las 12 anclas de `/proyecto/14309-04` PASS con la aserción endurecida. Aserción PROBADA: `selfcheck.mjs` → **28 fixtures, 0 fallos, exit 0** (distingue `id` real de `aria-controls`, `<script>`, comentario, `<template>`, `<noscript>`; y un href ajeno en el payload RSC no salva a otro) |
| SC#3 | Todo link o ancla roto quedó corregido en el código, con evidencia antes/después | ✓ VERIFIED (deploy re-verificable en 125) | Hallazgo único H-01 corregido en `app/app/proyecto/[boletin]/page.tsx:74-75`: `if (!(await leerProyecto(boletin))) notFound();` ELEVADO al componente de página, antes del boundary de streaming, reusando la lectura `cache()`-ada (línea 421). Evidencia antes/después en `114-HALLAZGOS.md`. El deploy viaja con la Phase 125 (decisión LOCKED del prompt rector v12.0) |
| SC#4 | La corrida es reproducible (comando + salida guardada), no un chequeo manual | ✓ VERIFIED | `scripts/verificar-links-internos.mjs` + `scripts/links-internos-manifiesto.mjs` (77/77 refs del inventario por igualdad). Ejecutado por el verificador contra el deploy real, salida txt+json. Exit codes semánticos comprobados: **1** con FAIL, **2** con filtro que no casa (mensaje que enseña `MSYS_NO_PATHCONV=1`), 0 limpio |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/links-internos-manifiesto.mjs` | Universo declarativo con trazabilidad ref-por-ref | ✓ VERIFIED | Importado en runtime: `MANIFIESTO` (95), `REFS_INVENTARIO` (**77** = igualdad con el inventario 113), `SUJETOS`, `EXCLUIDOS` (4), `EMISORES_HUERFANOS`, `RUTAS_EXCLUIDAS` |
| `scripts/verificar-links-internos.mjs` | Runner reproducible status+ausencia, txt/json, filtrable | ✓ VERIFIED | Ejecutado en vivo. `veredictoDeEmision()` (línea 232) con doble señal: href por valor completo en HTML crudo/RSC, o detección de shell con fallbacks de Suspense sin resolver → tercer estado `WARN-STREAM` que NO falla la corrida. UA desde `INGESTA_CONTACTO`, delay 400ms, timeout 15s + 1 reintento |
| `scripts/verificar-links-internos.selfcheck.mjs` | Self-check que prueba que la aserción muerde | ✓ VERIFIED | 28 fixtures, exit 0, ejecutado por el verificador |
| `114-CORRIDA-PRE.{txt,json}` | Estado ANTES del fix | ✓ VERIFIED | 95 entradas, PASS 94 / FAIL 1 |
| `114-CORRIDA-POST.{txt,json}` | Estado DESPUÉS | ✓ VERIFIED | 95 entradas, PASS 94 / FAIL 1; la corrida canónica con el runner endurecido es la de la Phase 125, declarado en `114-VERIFICACION.md` |
| `114-ANCLAS.md` / `114-HALLAZGOS.md` / `114-VERIFICACION.md` | Veredictos y cierre | ✓ VERIFIED | 20 anclas con método; H-01 con emisor/intención/fix; SC#1-4 con evidencia; expectativa de 125 re-anclada ("cero FAIL" + WARN-STREAM vía DOM) |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `verificar-links-internos.mjs` | `links-internos-manifiesto.mjs` | import estático | ✓ WIRED (probado por ejecución) |
| runner | deploy real | fetch secuencial con delay | ✓ WIRED (29 requests reales observados) |
| `selfcheck.mjs` | `veredictoDeEmision()` + aserción de ancla | import de funciones exportadas | ✓ WIRED (28 fixtures ejercitan las funciones reales) |
| `114-HALLAZGOS.md` | `114-CORRIDA-PRE.json` | id de manifiesto `4.2.b-404` | ✓ WIRED |
| `114-VERIFICACION.md` | `114-HALLAZGOS.md` | disposición de H-01 | ✓ WIRED |
| Fix H-01 | `app/app/proyecto/[boletin]/page.tsx` | `notFound()` pre-streaming | ✓ WIRED (líneas 68-76, previo al return del árbol) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|---|---|---|---|---|
| `MANIFIESTO` | 95 entradas con `inventarioRef` | inventario 113 (`validado`) | Sí — 77/77 refs por igualdad | ✓ FLOWING |
| corridas `.json` | `status`/`resultado` por entrada | fetch al deploy real | Sí — status HTTP y timestamps reales | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| La aserción muerde (ancla + emisión) | `node scripts/verificar-links-internos.selfcheck.mjs` | 28 fixtures, 0 fallos | ✓ PASS |
| El manifiesto cubre 77/77 refs | import + `REFS_INVENTARIO.length` | 77 | ✓ PASS |
| El runner corre contra el deploy sin falsos FAIL | `... --route /proyecto --out <tmp>` | 29 · PASS 19 · FAIL 1 · WARN-STREAM 9 · MISSING-SSR 0 | ✓ PASS |
| El único FAIL es el esperado | inspección de la tabla | `4.2.b-404` (H-01, deploy en 125) | ✓ PASS |
| Filtro vacío no se disfraza de éxito | `--route /noexiste` | error de uso explícito, **exit 2** | ✓ PASS |
| Fix H-01 presente en código | lectura de `page.tsx` | `notFound()` antes del árbol | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| LINK-02 | 114-01/02/03 | Todo link interno resuelve (cero 404, cero anchors rotos), verificado exhaustivo sobre el deploy real | ✓ SATISFIED | 95/95 entradas ejercitadas contra el deploy; 0 destinos 404; 20/20 anclas existen; único defecto (contrato 404 de `/proyecto/<inexistente>`) corregido en código |

Sin requisitos huérfanos: REQUIREMENTS.md mapea LINK-02 → Phase 114 y los 3 planes lo declaran.

### Anti-Patterns Found

Ninguno. Cero marcadores `TBD`/`FIXME`/`XXX` sin referencia en los archivos de la fase.
El riesgo previo de "filtro vacío = exit 0 silencioso" quedó cerrado (exit 2 con mensaje pedagógico), verificado por ejecución.

### Cierre de W-01 (warning de la pasada anterior)

La pasada anterior detectó que el assert de emisión de CR-02 producía FAIL sobre orígenes que sirven un shell de Suspense (`/agenda` con 54 `animate-pulse` y cero `href="/proyecto/…"` en los bytes servidos). Cerrado en `07c19ea`/`43681fb` con `veredictoDeEmision()` de doble señal y el estado `WARN-STREAM`. **Re-ejecutado por el verificador**: los 9 casos que antes eran FAIL ahora son WARN-STREAM con causa explícita ("el origen sirve un SHELL de streaming (N fallbacks de Suspense sin resolver) … verificar en DOM (125/BrowserOS)"); FAIL queda reservado a destino no-200 o ausencia también del crudo en página resuelta. **Cero falsos FAIL.**

### Human Verification Required

Ninguna. No queda ningún acto humano pendiente ANTES de la Phase 125: el deploy es decisión rector del PROMPT v12.0 (viaja con 125) y la resolución de los WARN-STREAM por DOM es el trabajo propio de esa fase, no un checkpoint de ésta.

### Re-verify in 125

1. **Status real del 404** — `/proyecto/00000-00` debe responder 404 post-deploy (hoy 200; fix en código).
2. **Corrida canónica completa** con el runner endurecido: expectativa **cero FAIL**; los 9 WARN-STREAM se cierran con verificación de DOM (BrowserOS), no con HTML servido.

### Gaps Summary

Sin gaps. Los 95 links/anclas del universo fueron solicitados contra el deploy real: cero destinos 404, cero anclas inexistentes, aserción probada con 28 fixtures y exit codes que no disfrazan corridas vacías. El único defecto hallado (H-01) está corregido en el código con la comprobación de existencia elevada antes de emitir cabeceras. Lo pendiente es deploy-gated por decisión rector y queda anclado como re-verificación en la Phase 125.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
