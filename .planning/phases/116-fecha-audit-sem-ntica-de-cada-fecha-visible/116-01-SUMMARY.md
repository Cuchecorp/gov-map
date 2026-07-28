---
phase: 116
plan: 01
subsystem: planning-audit
tags: [fechas, formatters, provenance-badge, auditoria, solo-lectura]
requires:
  - "113-INVENTARIO.md §0.2 (universo del grep de fechas)"
  - "113-INVENTARIO.md §3.1 / §3.1.4 (chokepoint ProvenanceBadge, denominador de call-sites)"
  - "116-CONTEXT.md (reglas LOCKED del veredicto)"
provides:
  - "116-FORMATTERS.md — semántica + veredicto de capa por formatter (19 filas)"
  - "116-FORMATTERS.md §2 — auditoría del chokepoint ProvenanceBadge y veredicto por call-site de capturedAt (17 filas)"
  - "3 candidatos a hallazgo para el plan 116-04"
affects:
  - "116-02 (grupo A de emisores) — consume §1 y §2 sin re-derivar"
  - "116-03 (grupo B de emisores) — idem, + 4 pistas de vía (b)"
  - "116-04 (consolidación F-xx)"
tech-stack:
  added: []
  patterns:
    - "auditoría con anchor verificado POR SÍMBOLO (sed -n Np | grep -qF), no por existencia de línea"
    - "denominador vivo re-corrido, jamás heredado de la fase anterior"
key-files:
  created:
    - ".planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-FORMATTERS.md"
  modified: []
decisions:
  - "esStale usa 14 días (format.ts:10), NO 48h: 113 §3.1.1 y el JSDoc del badge (:18) están stale — declarado, no corregido (fix = 117)"
  - "diaCalendarioCitacion honra la regla 3 verificado en el CUERPO (:42 toISOString().slice(0,10)), no solo en el comentario (:41)"
  - "17 ocurrencias de capturedAt vs 15 archivos de 113: diferencia de DENOMINADOR (ocurrencias vs archivos), no de cobertura"
  - "17/17 call-sites pasan fecha_captura genuina ⇒ cero HECHO-COMO-CAPTURA; el hallazgo del badge es de COPY, no de dato"
metrics:
  duration: "~35 min"
  completed: "2026-07-28"
  tasks: 2
  files: 1
---

# Phase 116 Plan 01: Base compartida de formatters de fecha — Summary

Auditoría solo-lectura de la capa transversal que gobierna toda fecha visible: 19 formatters con
semántica y veredicto de capa, más el chokepoint `ProvenanceBadge` y sus 17 call-sites de
`capturedAt`, todos con anchor verificado por símbolo contra el código real.

## Qué se construyó

**Artefacto único:** `.planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-FORMATTERS.md`
(248+ líneas, front-matter `phase: 116` / `plan: 01` / `consumido_por: [116-02, 116-03, 116-04]`).

- **§0 Reglas LOCKED aplicadas** — las tres reglas del veredicto citadas verbatim del CONTEXT
  (`fecha_captura` jamás es el hecho · "captura" pelado prohibido, idiom "según fuente al…" ·
  date-only = medianoche UTC, la parte fecha UTC ES el día chileno).
- **§1 Semántica por formatter** — universo re-corrido (28 archivos, coincide con 113 §0.2) y tabla
  de **19 filas** × 6 columnas, cero celdas vacías. Incluye los 11 `Intl.DateTimeFormat` del árbol y
  los 2 `toLocaleDateString`. Veredictos: 15 `seguro`, 3 `ambiguo`/`ambiguo-por-construcción`.
- **§1.2 Notas de anchors** — tabla de 10 diferencias respecto a los números citados en el plan
  (mayoría off-by-one: el plan ancló la línea `timeZone:` en vez del constructor).
- **§2.1 El componente** — 9 anchors del badge re-localizados (todos coinciden con el plan) + el
  texto VISIBLE exacto leído del JSX y verificado verbatim con `grep -F`.
- **§2.2 Veredicto por call-site** — **17 filas** × 9 columnas, una por ocurrencia del grep vivo.
- **§2.3 Cierre del denominador** — 17 observados = 17 filas = 0 sin veredicto.

## Hallazgos principales (insumo del plan 04)

1. **Copy del chokepoint (transversal, 17 call-sites):** `provenance-badge.tsx:90` rotula la fecha
   de captura como **"Actualizado hace X"**. No es el idiom aprobado "según fuente al…" y sugiere
   *actualización del dato* donde solo hay *recencia de scraping* — exactamente el defecto que la
   regla LOCKED 1 nombra. La regla 2 **no** se viola: "captura" no aparece pelada en ningún texto
   visible.
2. **Umbral de frescura mal documentado:** `provenance-badge.tsx:18` y `113-INVENTARIO.md` §3.1.1
   afirman **48 h**; el código dice **14 días** (`format.ts:10`, justificado en `:6-9` por la
   cadence de ingesta semanal). El comentario es la fuente del error heredado.
3. **Dos formatters sin `timeZone` fijada:** `fechaCorta` (`format.ts:21`) y el `mesAnioFormatter`
   de `timeline-view.tsx:29` dependen del huso del runtime para el día/mes visible.

**Resultado limpio del eje crítico:** **cero `HECHO-COMO-CAPTURA`**. Los 17 call-sites pasan una
columna `fecha_captura` genuina. Dos llamantes (`cruces-de-proyecto.tsx:173-174`,
`cruces-de-parlamentario.tsx:188-192`) documentan en comentario por qué NO pasan la fecha del hecho:
el error fue considerado y evitado en origen.

**4 pistas de vía (b)** para el plan 03, todas en superficies MONEY OFF: el copy "…, corte al
{fecha}" presenta `fecha_corte` (corte de la fuente, no captura) fuera del badge.

## Cobertura de gates y huérfanos

- **MONEY OFF** (`no emitido en el deploy auditado`): 4 call-sites — E-013, E-014, E-015, E-016.
- **CRUCES** (gate abierto desde v4.0, sí se emiten): 2 call-sites — E-044, E-053.
- **HUÉRFANO**: 2 ocurrencias — `voto-ficha-row.tsx:135` y `:220` (E-003). Auditados igual; el
  veredicto vale si alguien los re-monta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 3 anchors propios stale en §2.2, corregidos contra el código real**

- **Found during:** Task 2 (verificación de aceptación "anchors por símbolo, no por existencia")
- **Issue:** tres pares `archivo:línea` que yo mismo escribí apuntaban a la línea equivocada:
  `aportes-por-contraparte.tsx:189-190` (real `:188`), `financiamiento-de-parlamentario.tsx:355`
  para `ingestado_hasta` (real `:519,539`), `patrimonio-de-parlamentario.tsx:766` para
  `columnas.map` (real `:765`).
- **Fix:** re-localizados con `grep -n` y corregidos. Además se descubrió que el copy de las filas 4
  y 9 **no** es "Consolidado, corte al" sino "Consultado por RUT, corte al" (`:184`) y "Consultado
  por nombre del candidato, corte al" (`:223`) — corregido a texto verbatim.
- **Files modified:** `116-FORMATTERS.md` (artefacto de planificación únicamente)
- **Commit:** d0cd902

**2. [Rule 2 - Missing critical] Divergencia 48h vs 14 días elevada a candidato a hallazgo**

- **Found during:** Task 1, al leer el cuerpo de `esStale`
- **Issue:** el plan y 113 §3.1.1 afirmaban un umbral de 48h que el código contradice.
- **Fix:** no se tocó el código (régimen solo-lectura). Se declaró en §1.1, §1.2 y §2.1 como
  `candidato a hallazgo` documental, con las tres ubicaciones del error citadas.
- **Commit:** 481feb0 (declaración inicial) + d0cd902 (§2.1)

### Divergencias de anchor declaradas (no son deviaciones — el plan las mandataba)

10 diferencias entre los anchors del plan y los observados, tabuladas en §1.2. Ninguna invalidó un
símbolo: todas son off-by-one entre el constructor `Intl.DateTimeFormat` y su línea `timeZone:`,
salvo `diaCalendarioCitacion` (el plan ancló el comentario `:41` en vez de la función `:34`; ambos
anchors son reales).

## Verificación

| criterio | resultado |
|---|---|
| `116-FORMATTERS.md` existe con front-matter `phase: 116` / `plan: 01` | PASS |
| §0 contiene `fecha_captura`, `según fuente al`, `medianoche UTC` | PASS (3/3 `grep -F`) |
| §1.1 ≥12 filas de datos, 6 columnas, cero celdas vacías | PASS (19 filas, `grep -cE '^\|.*\|[[:space:]]*\|'` → 0) |
| símbolos `fechaCorta`, `fechaCortaSegura`, `relativeTimeEs`, `esStale`, `diaCalendarioCitacion` en la tabla | PASS |
| §2.1/§2.2/§2.3 presentes | PASS (4/4 headers) |
| filas de §2.2 == `wc -l` del grep vivo | PASS (17 == 17) |
| veredictos dentro del conjunto cerrado | PASS (17 × `captura correcta`, 0 fuera) |
| `E-003` HUÉRFANO + ≥1 de E-013..E-016 con `no emitido en el deploy auditado` | PASS (6 × HUÉRFANO, 5 × la cadena de gate) |
| texto del badge citado aparece verbatim en `provenance-badge.tsx` | PASS (5/5 `grep -F`) |
| **anchors verificados por símbolo** (`sed -n Np \| grep -qF`) | PASS — 48 anchors de §1 + 55 de §2, cero stale tras el fix |
| `git status --porcelain app/ packages/` vacío | PASS (T-116-03) |
| PII scan (`grep -cE '[0-9]{7,8}-[0-9kK]'`) | PASS → 0 (T-116-01) |
| psql invocado | NO — este plan no toca PROD ni fuentes (T-116-02) |
| paquetes instalados | NINGUNO (T-116-SC) |

## Known Stubs

Ninguno. El artefacto es la entrega completa del plan; no hay superficie de producto involucrada.

## Threat Flags

Ninguna. El plan no introduce superficie de red, auth, acceso a archivos ni cambio de esquema:
régimen solo-lectura sobre el repo, verificado con `git status --porcelain app/ packages/` vacío
tras cada task.

## Commits

| Task | Commit | Descripción |
|---|---|---|
| 1 | `481feb0` | `docs(116-01): tabla de semantica por formatter de fecha` |
| 2 | `d0cd902` | `docs(116-01): auditoria del chokepoint ProvenanceBadge y sus 17 call-sites` |

## Para los planes 02 / 03

- **No re-derivar** la semántica de ningún formatter de §1.1 ni la del badge de §2.1: aplicar el
  veredicto por emisor.
- Los 17 call-sites de `capturedAt` **ya tienen veredicto**: no re-auditarlos, solo referenciarlos.
- Atender las 4 pistas de vía (b) (`fecha_corte` fuera del badge, filas 2/4/5/9) y el homónimo
  `fechaCorta` de `/cuenta` (`cuenta/page.tsx:90`), que tiene semántica distinta del de `format.ts`.

## Self-Check: PASSED

- `116-FORMATTERS.md` — FOUND
- `116-01-SUMMARY.md` — FOUND
- commit `481feb0` — FOUND
- commit `d0cd902` — FOUND
