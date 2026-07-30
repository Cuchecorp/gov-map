---
phase: 128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas
verified: 2026-07-30T19:05:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
deferred:
  - truth: "El panel 'queda bien' visualmente y los números reales de cobertura (23 Senado · 0 Cámara) se ven correctos sobre datos de PROD"
    addressed_in: "Phase 129"
    evidence: "ROADMAP §129: 'PANEL-DISEÑO — Loop de diseño BrowserOS hasta que quede bien' (sobre deploy real); 128-CONTEXT O-7 delega a 129 el arbitraje de densidad"
  - truth: "Concordancia de plural del copy de cobertura ('1 citaciones del Senado' en el volcado con fixture de 1 fila)"
    addressed_in: "Phase 129"
    evidence: "Loop de copy/diseño sobre deploy real; SC-5 exige denominador y honestidad, no concordancia gramatical"
---

# Phase 128: PANEL-UI — Contrato RPC/UI con sujetos, links y fechas correctas — Verification Report

**Phase Goal:** La portada renderiza la propuesta editorial ratificada — sujetos con verbo y fecha, links vía helper central, L4 visible, fechas 3 carriles, cobertura declarada.
**Verified:** 2026-07-30
**Status:** passed
**Re-verification:** No — verificación inicial (post-REVIEW 17/17 FIXED, contra código ACTUAL)

## Goal Achievement

### Observable Truths (5 SC del ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cada ítem nombra su sujeto y enlaza vía helper central; `en_corpus:false` → texto plano + enlace externo; ningún link de agenda 404 | ✓ VERIFICADO | `lib/links-internos.ts` importado por `panel-actualidad.tsx`, `panel-item-proyecto.tsx`, `panel-tile-{sala,comisiones,votaciones}.tsx`. Guard `en_corpus` en `panel-item-proyecto.tsx:84` — cero `href /proyecto` en cualquier path. DOM regenerado: 6 ocurrencias de `/proyecto/`; ítems con boletín + título + verbo ("14782-13 · Equipara el derecho de sala cuna", "Citado el 03 ago 2026") |
| 2 | Grilla con O-1..O-7; tile materia AUSENTE | ✓ VERIFICADO | Orden DOM = D-01 exacto: sala → comisiones → urgencias → movimiento → votaciones → ingresos (O-5 ✓). Chips L5 yuxtapuestos "Urgencia Suma fechada el 28 jul 2026" en tiles 1-2 (O-4 ✓). Urgencias sin link agregado de tile — cero `href` en `panel-tile-urgencias.tsx` (O-6 ✓). `maxItems=4` + remanente honesto en sala/comisiones/urgencias/movimiento/ingresos (O-7 ✓). Urgencias cuenta boletines distintos (`vigentePorBoletin`, línea 172) — el "95" muere. Ingresos: "1 evento de 1 proyecto". Único match de "materia" en el DOM = dentro de un TÍTULO real ("…en materia de ciberdelitos"), no un tile ni tombstone (O-3 ✓) |
| 3 | Votaciones L4 visibles, una línea por votación, `resultado` NULL honesto, conteos confirmados | ✓ VERIFICADO | Tile presente en el DOM: "Votación en Cámara de Diputados el 22 jul 2026: Aprobado — 80 a favor, 48 en contra, 2 abstenciones, 0 pareos" + leyenda anti-insinuación. `panel-tile-votaciones.tsx:63` → fallback literal exacto `"resultado no informado por la fuente"`. Sin agregación por boletín (comentario + tests). Flags intactos: `vsim-gate.test.ts` verde, `git diff` de flags/gates/migraciones vs. inicio de fase = VACÍO (cero flip) |
| 4 | Fechas 3 carriles; `"datos al"` = 0; `fecha_captura` jamás visible | ✓ VERIFICADO | **Volcado DOM regenerado por el verificador** (`rm` + `vitest run components/panel-actualidad.test.tsx` → 17/17, `.artifacts/panel-render.html` 6.642 bytes, timestamp 15:54). Greps APAREADOS: `datos al`=**0** ∧ `según fuente al`=**6** (control positivo — el cero no es vacuo), `(sin materia)`=**0**, `fecha_captura`=**0**, `/proyecto/`=**6**. Hecho con verbo en el cuerpo ("En tabla de sala del…", "Citado el…", "Trámite del…", "fechada el…"), footer solo `Fuente: X · según fuente al d`. `IDIOMS_APROBADOS` single-source `as const` + tipo `Idiom` en `lib/idioms-panel.ts` (invariante estático verificado por `tsc -b` limpio) |
| 5 | Cobertura con denominador; Cámara como "tabla semanal" sin fabricar sesión/hora | ✓ VERIFICADO | DOM: "1 citaciones del Senado · 0 de la Cámara en las fuentes consultadas" (`panel-tile-comisiones.tsx:220`). `panel-tile-sala.tsx:71-90`: `sinDatosDeSesion` → solo día + "tabla semanal"; el segmento de sesión se arma POR PARTES (WR-03) — jamás fabrica "Sesión N.º a las HH:MM". Vacío honesto con causa: "sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 28 jul 2026" |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Nivel 1-4 | Estado |
|----------|-----------|--------|
| `app/lib/idioms-panel.ts` | existe · sustantivo · importado por guard+tiles · datos fluyen | ✓ VERIFICADO |
| `app/lib/links-internos.ts` | existe · sustantivo · importado por 4 componentes + tests | ✓ VERIFICADO |
| `app/lib/panel-evidencia.ts` | existe · parse defensivo (REVIEW: cero `as`) · consumido por el orquestador | ✓ VERIFICADO |
| `app/lib/panel-camara.ts` | existe · helper de barra cívica · usado por tiles | ✓ VERIFICADO |
| `app/components/panel-item-proyecto.tsx` | existe · guard `en_corpus` real · reusado por tiles | ✓ VERIFICADO |
| `app/components/panel-tile-{sala,comisiones,urgencias,movimiento,votaciones,ingresos}.tsx` | 6/6 existen · sustantivos · los 6 renderizan en el DOM regenerado | ✓ VERIFICADO |
| `app/components/panel-actualidad.tsx` | orquestador de 6 tiles en orden D-01 · montado desde `actualidad-module.tsx` | ✓ VERIFICADO |

### Behavioral Spot-Checks (ejecutados por el verificador, no narrados)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Volcado DOM se regenera | `rm .artifacts/panel-render.html && vitest run components/panel-actualidad.test.tsx` | 17/17 passed, archivo recreado 6.642 B | ✓ PASS |
| `"datos al"` muerto ∧ control positivo | `grep -o` ×2 | 0 ∧ 6 | ✓ PASS |
| `(sin materia)` muerto | `grep -o` | 0 | ✓ PASS |
| `fecha_captura` invisible | `grep -o` | 0 | ✓ PASS |
| Links de ficha presentes | `grep -o '/proyecto/'` | 6 | ✓ PASS |
| Suite completa | `pnpm test` | **118 archivos / 1776 tests passed** (≥1776 exigido) | ✓ PASS |
| Guards | `pnpm guards` | 347 + 34 + 7 tests passed, 0 fallos | ✓ PASS |
| Linter anti-insinuación | `vitest run lib/anti-insinuacion-guard.test.ts` | 57/57 passed (corrió de verdad — no exit-0 vacuo) | ✓ PASS |
| Compilador (invariante `Idiom`) | `pnpm typecheck` (`tsc -b`) | limpio | ✓ PASS |
| Cero flags tocados | `git diff --stat 35a1174..HEAD -- '*flag*' '*gate*' 'supabase/migrations'` | salida VACÍA | ✓ PASS |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PANEL-02 | ✓ SATISFIED | Helper central `links-internos.ts` + guard `en_corpus:false` sin inner-join (SC-1) |
| PANEL-03 | ✓ SATISFIED | Grilla D-01 con O-1..O-7 verificados uno por uno contra DOM y código (SC-2) |
| PANEL-04 | ✓ SATISFIED | Tile L4 visible, resultado NULL honesto, VSIM sin flip (SC-3) |
| PANEL-05 | ✓ SATISFIED | 3 carriles + greps apareados sobre DOM regenerado (SC-4) |
| PANEL-07 | ✓ SATISFIED | Cobertura con denominador + "tabla semanal" sin fabricación (SC-5) |

Sin requisitos huérfanos: REQUIREMENTS.md mapea exactamente PANEL-02/03/04/05/07 a la fase 128.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` en los 13 archivos de la fase | — | **0 ocurrencias** — gate de debt-markers verde |
| `panel-tile-comisiones.tsx` | 220 | "1 citaciones del Senado" — sin concordancia de plural | ℹ️ Info | Cosmético; el loop de copy/diseño de 129 lo arbitra sobre datos reales |

### Desviaciones deliberadas del REVIEW (aceptadas)

- **WR-07 / WR-12:** documentadas en 128-REVIEW como desviaciones deliberadas; el código actual las materializa de forma verificable (`panel-tile-votaciones.tsx:75` declara el estado de fallo de lectura de `votacion` en vez de confundirlo con "sin votaciones") — no afectan ninguna SC.
- **3 tests corregidos, no relajados:** verificados indirectamente — la suite completa sigue en 1776 con el linter anti-insinuación en 57/57 (un test relajado habría bajado la cuenta o apagado asserts; el volcado DOM sigue exigiendo los 5 greps).

### Human Verification Required

Ninguno para esta fase. La correctitud es verificable programáticamente y quedó verificada; el juicio visual ("queda bien") es explícitamente alcance de la Phase 129 sobre el deploy real (ver `deferred`).

### Gaps Summary

Sin gaps. El pendiente del fixer que esta verificación cerraba —regenerar el volcado DOM con el mecanismo de 128-06 y re-correr los 5 greps— fue ejecutado por el verificador en su propio proceso: el archivo se borró antes de correr el test, se recreó con timestamp nuevo, y el cero de `"datos al"` quedó apareado con un control positivo de 6 `"según fuente al"`, de modo que el cero no es vacuo.

---

_Verified: 2026-07-30_
_Verifier: Claude (gsd-verifier)_
