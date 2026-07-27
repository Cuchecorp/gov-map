---
phase: 113
plan: 05
subsystem: planning-artifacts
tags: [inventario, gate-de-cierre, validacion-opus, higiene-pii, no-regresion]
requires:
  - "113-01 (check-inventario.sh, §0 método, baseline de suite)"
  - "113-02/03/06 (catálogo E-001..E-060, chrome, familias externas)"
  - "113-04 (las 15 rutas, Tabla D, límite H3 diferido)"
provides:
  - "113-INVENTARIO.md con estado: validado (7/7 criterios PASS, cero límites diferidos)"
  - "113-VALIDACION-OPUS.md: veredicto independiente por criterio + ronda 2 mecánica"
  - "§0.7 verificación de cierre (checklist STRICT=1 + higiene H1-H5 + no-regresión)"
  - "§0.8 veredicto y disposición de hallazgos"
affects:
  - "114 (links internos), 115 (patrones externos), 116/117 (fechas), 122 (cruces), 125 (E2E)"
tech-stack:
  added: []
  patterns:
    - "juez/parte separados: el validador Opus solo escribe su veredicto, jamás el artefacto juzgado"
    - "compuerta de higiene con patrón acotado a filas de tabla cuando el patrón amplio tiene falsos positivos en código citado verbatim"
key-files:
  created:
    - ".planning/phases/113-inv-inventario-rector-de-superficies/113-VALIDACION-OPUS.md"
  modified:
    - ".planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md"
decisions:
  - "El id de sonda del gate MONEY con forma de RUT se sustituyó por un placeholder no-RUT: el gate es la PRIMERA sentencia, así que cualquier id 404ea y la evidencia no pierde poder (verificado con ambos ids contra el deploy vivo)"
  - "Los 2 falsos positivos del guard de celdas se mantienen: están FUERA de tablas, en código citado verbatim; alterarlos rompería la re-ejecutabilidad de la evidencia. Se declara el límite y se verifica con el patrón acotado a filas de tabla"
  - "La ronda 2 se declara explícitamente como re-verificación MECÁNICA del ejecutor (parte), no como segundo juicio independiente: la ronda 1 dio PASS y su propio texto dice que los hallazgos no exigían ronda 2"
metrics:
  duration: "~1 sesión"
  completed: 2026-07-27
  tasks: 3
  commits: 2
---

# Phase 113 Plan 05: Gate de cierre del inventario rector Summary

El inventario rector pasó el checklist en modo estricto, las cinco compuertas de higiene y el gate
del validador Opus independiente (**PASS 7/7**), con la suite idéntica al baseline y cero cambios en
código de producto — queda `estado: validado` y LOCKED como denominador de 114/115/116/122/125.

## Qué se hizo

| Task | Qué | Commit |
|------|-----|--------|
| 1 | §0.7: checklist `STRICT=1` (5/5 OK) + higiene H1-H5 + no-regresión de la suite | `65476e5` |
| 2 | Veredicto del validador Opus independiente (ronda 1) — **spawneado por el orquestador**, no por mí | (artefacto commiteado en `29a25f6`) |
| 3 | Cierre de los 2 hallazgos + §0.8 + ronda 2 mecánica + `estado: validado` | `29a25f6` |

## El veredicto

**PASS en los 7 criterios** (rutas, links internos, links externos, fechas, sujetos, cobertura,
régimen), emitido por un validador Opus **independiente y read-only** sobre el commit `65476e5`. El
juez no tocó el artefacto juzgado — `113-VALIDACION-OPUS.md` es lo único que escribió.

Dos hallazgos **no bloqueantes**, ambos **cerrados en el inventario** (ninguno diferido a otra fase):

| # | Hallazgo | Cierre |
|---|----------|--------|
| 1 | §4.8 afirmaba que el `grep` de `ProvenanceBadge` sobre los 3 archivos de `/parlamentarios` daba "sin match", pero `partido-chip.tsx:27` **sí** matchea | Se corrigió el **comando, no la conclusión**: se declara el 1 match y se prueba que es un **comentario** (el chip imita el *idiom* vía Tooltip Radix, no monta el componente), con el grep que separa mención de uso — `import.*ProvenanceBadge\|<ProvenanceBadge` → **sin match**. Verificado contra el repo antes de commitear |
| 2 | §4.3.c quedó obsoleta tras mi propio cierre de H2: seguía declarando una "excepción" de RUT y afirmando que era "el único match del patrón" | Reescrita al estado actual: **no hay excepción**, el patrón tiene **0 matches** en todo el archivo |

## Higiene de seguridad — un hallazgo real, no un trámite

El grep de RUT **sí daba match**. La evidencia del gate MONEY en §5 probaba la ruta con un id con
forma de RUT de empresa. Era un valor **sintético** (en PROD `contrato` y `aporte` tienen 0 filas —
por eso el Sujeto E se degradó honestamente en el Plan 01), pero disparaba la compuerta T-113-01
igual, y "es sintético" no es defensa cuando el patrón es la compuerta.

Se sustituyó por `c:sujeto-inexistente` **sin perder poder probatorio**: el gate es la PRIMERA
sentencia de `app/app/contraparte/[id]/page.tsx:50-52`, así que cualquier id 404ea. Lo verifiqué
corriendo `curl` con **ambos** ids contra el deploy vivo: **404 y 404**.

| # | Verificación | Resultado |
|---|--------------|-----------|
| H1 | `grep -cE 'postgres(ql)?://'` | **0** |
| H2 | `grep -cE '[0-9]{7,8}-[0-9kK]'` (RUT) | **0** tras el cierre |
| H3 | celdas vacías en filas de tabla | **0** (ver límite abajo) |
| H4 | ids `E-NNN` duplicados | **0** — 60 definiciones, 60 únicos `E-001`…`E-060` |
| H5 | emails | una sola: `contacto@observatoriocongreso.cl`, buzón institucional público del footer |

## El límite H3, confirmado tal como lo dejó el Plan 04

El patrón amplio `grep -nE '\|[[:space:]]*\|'` devuelve **exactamente 2 matches**, ambos **fuera de
toda tabla**, dentro de bloques de código citados **verbatim**: el `||` de concatenación SQL del
Sujeto E y el `||` lógico del cuerpo de `safeExternalHref`. No los toqué: alterarlos rompería la
re-ejecutabilidad de la evidencia, que es justamente el bien que protege el régimen de §0.1. La
verificación válida es la acotada a filas de tabla (`^\|.*\|[[:space:]]*\|` menos separadoras) →
**cero matches**, que es lo que la compuerta realmente busca.

## No-regresión: idéntico al baseline

| Workspace | Test files | Tests passed | Skipped | vs. baseline §0.5 |
|-----------|-----------:|-------------:|--------:|-------------------|
| `app` | 107 | 1428 | 0 | **=** |
| `packages/*` (18) | 176 | 1535 | 11 | **=** |
| **Total** | **283** | **2963** | **11** | **=** |

`pnpm test` exit 0. `git status --porcelain app/ packages/` **vacío** — la fase no corrigió nada, que
es su régimen.

## Deviations from Plan

### Auto-fixed

**1. [Rule 2 - Seguridad] El probe del gate MONEY usaba un id con forma de RUT**
- **Found during:** Task 1 (compuerta H2)
- **Issue:** `curl … "$B/contraparte/c:<rut-sintético>"` en §5 matcheaba el patrón de RUT, violando
  el criterio de aceptación y la mitigación T-113-01.
- **Fix:** sustituido por `c:sujeto-inexistente`, con nota de por qué la evidencia sigue siendo
  válida y verificación empírica con ambos ids contra el deploy vivo.
- **Commit:** `65476e5`

**2. [Rule 1 - Bug] Mi primera redacción de la nota H2 re-disparó la compuerta**
- **Found during:** Task 1 (re-verificación post-edit)
- **Issue:** al documentar el cierre cité el literal viejo, con lo que el grep volvió a dar 1 match.
- **Fix:** la nota describe el valor sin reproducirlo. Cazado por re-correr la compuerta después de
  editar, no antes.
- **Commit:** `65476e5`

### Desviación de proceso (instrucción del orquestador)

**Task 2 no la ejecuté yo.** El plan exige un validador Opus **independiente** con contexto fresco y
separación juez/parte; como agente ejecutor no puedo spawnear agentes, y además yo había escrito la
remediación de Task 1 — juzgar mi propio artefacto habría violado el mandato aunque hubiera podido.
Retorné un checkpoint y el orquestador spawneó el validador. Su veredicto llegó como insumo de la
Task 3.

**La ronda 2 no es un segundo juicio independiente, y así queda declarado.** La ronda 1 dio PASS y su
propio texto dice que los hallazgos **"no exigen ronda 2"**. Lo que registré como ronda 2 es la
**re-verificación mecánica del ejecutor (parte, no juez)** tras los cierres. Preferí declarar esa
naturaleza en el propio artefacto antes que presentar una auto-verificación con la apariencia de un
veredicto independiente.

## Threat Flags

Ninguna. La fase es documental y read-only: cero DDL/DML, cero paquetes instalados, cero requests a
fuentes gubernamentales (solo `curl` al propio deploy), cero credenciales impresas, cero PII.
T-113-09 (tampering de código de producto) verificado vacío; T-113-01 cerrado con hallazgo real.

## Known Stubs

Ninguno. El inventario queda sin hallazgos abiertos ni límites diferidos a otra fase.

## Self-Check: PASSED

- `FOUND` `.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md` (`estado: validado`)
- `FOUND` `.planning/phases/113-inv-inventario-rector-de-superficies/113-VALIDACION-OPUS.md`
- `FOUND` commit `65476e5` — Task 1
- `FOUND` commit `29a25f6` — Task 3 + artefacto del validador
- `STRICT=1 bash check-inventario.sh` → exit 0 en el estado final
