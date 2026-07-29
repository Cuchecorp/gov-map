---
phase: 122
plan: 06
subsystem: auditoria-cruces
tags: [cruces, sql, prod, consolidacion, cobertura, inventario-113]
requires: [122-02, 122-03, 122-04, 122-05, 113-INVENTARIO]
provides: ["122-CRUCES-SQL.md — artefacto único de la fase, consumible por la Phase 125"]
affects: [125, 124]
tech-stack:
  added: []
  patterns: ["barrido de cobertura emisor-por-emisor con criterio escrito antes de la tabla", "cierre de hueco con SQL + primeros principios + DOM en vez de 'no aplica'"]
key-files:
  created: [".planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL.md"]
  modified: []
decisions:
  - "El barrido de cobertura de los 60 emisores del inventario 113 detectó 6 huecos reales (E-011 /red, E-041 lobby_en_tramitacion, E-017 /buscar, E-004 /agenda) y se cerraron AQUÍ con SQL+DOM: 82 filas finales, no 76"
  - "Los ids de fila de los fragmentos (1.x, 2.x, 3.a-N, 3.b-N, 4-N, 5.N) se PRESERVAN porque los handoffs a 124/125 los nombran así; las filas nuevas llevan prefijo H-"
  - "Los bloques de query se renumeraron globalmente (Q-01..Q-86) con tabla de mapeo explícita desde los ids locales de cada fragmento"
metrics:
  duracion: "~1 sesión"
  completado: 2026-07-29
---

# Phase 122 Plan 06: Consolidación de 122-CRUCES-SQL.md — Summary

Artefacto único de la fase escrito y cerrado: **82 filas de veredicto** (72 `cuadra` · 2
`discrepancia-corregida` · 8 `discrepancia-declarada`), cada una con query verbatim, nº SQL, nº deploy
y veredicto; cobertura probada **emisor por emisor** contra los 60 `E-NNN` del inventario 113, con
**cero huecos abiertos** — porque los **6 huecos detectados se cerraron en esta misma corrida** con el
método completo (RPC por psql + primeros principios + `curl` del deploy).

## Qué se hizo

**Task 1 — consolidación.** Los 5 fragmentos (00 método, 01 relaciones/comparar, 02 cruces/actualidad,
03 lobby, 04 fixes) se fundieron en
`.planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL.md` con las 10 secciones
pedidas, en orden, más `## 7` (huecos cerrados), `## Cobertura × inventario 113`,
`## Veredicto de la fase` y `## Procedencia`. Los 78 bloques de query originales se copiaron
**verbatim** (incluidas sus notas de encoding `bolet.n` / `SIN-CAMARA`) y se renumeraron de forma
global y correlativa a `Q-01`…`Q-86`, con tabla de mapeo en §0.7.

**Task 2 — auditoría de cobertura y cierre.** Barrido determinista de las 60 filas del §3.0 del
inventario, con el criterio de clasificación escrito **arriba** de la tabla. Resultado:
15 emisores emiten cruce/conteo · 34 no emiten cruce · 8 gated OFF (MONEY/NOTIF) · 3 huérfanos.

## Coherencia de veredicto (regla del plan)

**Contradicciones entre fragmentos: cero.** Las 2 filas `discrepancia-corregida` (5.11, 5.12)
conservan ese veredicto como valor definitivo; el fragmento 04 declara explícitamente su sección
"Fixes NO aplicados" **vacía**, y la identidad aritmética cierra (2 corregidas = 2 fixes aplicados +
0 no aplicados). No hubo que arbitrar a favor del fragmento 04 en ninguna fila.

## Huecos detectados y CERRADOS (no declarados)

El plan prohíbe cerrar un hueco con "no aplica". Los 6 se cerraron con evidencia ejecutada hoy:

| fila | hueco | evidencia de cierre | veredicto |
|------|-------|---------------------|-----------|
| H-1 | `/red?seed=D1165` (E-011) emitía `80 vecinos · 235 hechos documentados`, fuera del universo §0.3 | `RPC:subgrafo_red` → `81` nodos / `4501` aristas, de las cuales `235` incidentes al seed y `80` vecinos distintos; primeros principios sobre `arista` → `235`/`80`; DOM → idénticos | `cuadra` |
| H-2 | `/red?seed=S1338` | RPC `0`/`0`; `arista` `0`; DOM: *"Aún no hay relaciones para mostrar…"*, ruta `200` | `cuadra` |
| H-3 | `lobby_en_tramitacion` (E-041) — **segundo canal lobby↔PL**, montado en `/proyecto/[boletin]:198`, no auditado por el Grupo 5 | RPC `14309-04` → `0`; DOM: empty honesto con heading + caveat anti-causal presentes | `cuadra` |
| H-4 | idem, caso no vacío | sondeo acotado (200 boletines): `94/125` con datos, máximo `17337-07` = **219**; per-semana SQL `55/33/65/61/5` == DOM `55/33/65/61/5` (Σ 219) | `cuadra` |
| H-5 | `/buscar` — banner `Busca sobre N proyectos de ley` (cobertura del corpus) | `count(proyecto_embedding)` = `3100` == DOM `3100` | `cuadra` |
| H-6 | `/agenda` — banner de cobertura de la Cámara | `count(*)=164`, `min=2026-05-11`, `max=2026-07-07`, `floor(días/7)+1 = 9` == DOM `164 citaciones ingeridas en 9 semanas (2026-05-11→2026-07-07)` | `cuadra` |

**Consecuencia aritmética:** el total de la fase pasó de las 76 filas de los fragmentos a **82**;
`cuadra` de 66 a **72**. `discrepancia-corregida` (2) y `discrepancia-declarada` (8) **no cambiaron**.

## Desviaciones del plan

**[RULE-1] El plan asumía 76 filas y "cero cruces asumidos"; la realidad exigió 6 filas más.** El
plan preveía que el barrido *pudiera* encontrar huecos y ordenaba cerrarlos con el método completo.
Los encontró: cuatro emisores (E-011, E-041, E-017, E-004) emiten cruces o coberturas cuantificadas
que el universo §0.3 —derivado del inventario en la Wave 0— no había incluido. Se cerraron con SQL
read-only y `curl`, dentro del régimen (cero DDL/DML, cero deploy, cero flags, cero fuentes
gubernamentales). **Ninguno se declaró "no aplica".**

**[RULE-1 menor] Un bloque de query extra respecto de lo previsto.** El plan hablaba de renumerar los
bloques existentes; el cierre de huecos añadió `Q-79`…`Q-86` (8 nuevos), documentados como tales en la
tabla de mapeo §0.7.

**PII — decisión de método durante el cierre de H-4.** `lobby_en_tramitacion` devuelve
`parlamentario_nombre` y `materia` de la audiencia. Se registró **sólo el agregado** (total y conteo
por `semana_iso`); ni un nombre, ni una materia, ni un identificador de audiencia entraron al
artefacto.

## Huecos declarados

**Ninguno abierto.** Los 11 emisores con `¿auditado en 122?` = NO son:

- **8 gated OFF** (E-013/014/015/016 MONEY, E-039/052 NOTIF, E-050/060 rutas 404 por MONEY) —
  declarados por LÍMITE B, con la evidencia de gate observada en §1.2 (`/contraparte/1` → `404`;
  `/cuenta` → `200` + *"no están disponible"*).
- **3 huérfanos** (E-003, E-008, E-029) — declarados en §0.4 y L-3, con el grep que prueba la ausencia
  de call-site non-test.

Ninguno se omitió en silencio ni se cerró con un "no aplica" pelado.

## Estado final de los 4 criterios de éxito de la fase

| # | criterio | estado |
|---|----------|--------|
| 1 | **Existe un artefacto único auditable sin leer código** | **CUMPLIDO** — `122-CRUCES-SQL.md`, 2.700+ líneas, con índice, método, vocabulario, plantilla, 82 filas y 86 bloques de query re-ejecutables |
| 2 | **Los 6 grupos del universo §0.3 están cubiertos: cero grupo sin filas** | **CUMPLIDO** — §2 (G1), §3 (G2), §4 (G3), §5 (G4), §6 (G5), Vacíos honestos (G6, `lobby_sector_aporte` con su query y su "NO es bug"). Además §7 y las filas `H-*` cubren lo que el universo no había visto |
| 3 | **Toda discrepancia queda corregida O declarada, con ambos números y su query** | **CUMPLIDO** — 2 corregidas (con test de respaldo y commits `45cdac4`/`df6364d`/`5c8f1a4`) y 8 declaradas, cada una con nº SQL, nº deploy, motivo y **handoff nombrado** (124 / 125 / catálogo 113). Ningún número erróneo fue borrado |
| 4 | **Los vacíos honestos y los límites declarados tienen sección propia** | **CUMPLIDO** — `## Vacíos honestos` (10 filas, todas con query; incluye la nota verbatim al auditor futuro sobre `lobby_sector_aporte`) y `## Límites declarados` (L-1…L-11 + la tabla de fixes NO aplicados con su motivo y handoff) |

## Handoffs preservados textualmente

- **Phase 124 (SUPA-FIX):** cap `p_limit` de votos (filas 2.1/2.5/2.6, RPC de conteo dedicado —
  **no se escribió `0073`**), denominador del tile *Por materia* (4-14, 84,4 % sin denominador que la
  RPC emita), dos grafías de cámara (4-15, fix en el materializador 0065), rediseño de RPC para
  membresía de par (3.3), y la constraint del denominador de lobby (L-4).
- **Phase 125:** fila 5.5 (rama `LIMIT 50` no observable), el deploy de los 2 fixes y la
  re-verificación de las 82 filas sobre el deploy final.
- **Catálogo 113:** fila 3.b-9 (empty-state muerto de E-053) y la atribución de los emisores
  huérfanos.

## Límites declarados preservados verbatim

`agrupacion_materia` **no tiene primeros principios en SQL** (es k-means; verificado por la propiedad
falsable `sum(conteo) = count(proyecto_embedding) = 3100`) · el contrato `RelacionesSection vacio` es
**no observable en PROD** (0 filas con los 5 ejes en cero), **no** "verificado" · `lobby_sector_aporte`
= 0 filas por construcción (`0052:130-136`), sin consumidor en `app/` · `S1338` con cero cruces
presentado como cero · supresión-como-fila de `nuevos_ingresos`.

## Verificación ejecutada

| verificación | comando | resultado |
|--------------|---------|-----------|
| las 14 secciones `## ` en orden | `grep -n "^## "` | Índice · 0 · 1 · 2 · 3 · 4 · 5 · 6 · 7 · Vacíos honestos · Fixes aplicados · Límites declarados · Cobertura × inventario 113 · Veredicto de la fase · Procedencia ✔ |
| 60 emisores, 60 filas | `grep -o -E "E-0[0-9]{2}" \| sort -u \| wc -l` / `grep -c "^\| E-0"` | **60** / **60** ✔ |
| tablas con columna `veredicto` | `grep -c "\| veredicto \|"` | **18** (secciones 2, 3, 4, 5, 6 y 7 todas con ≥1) ✔ |
| conteo por veredicto (sólo filas con id) | `grep -E '^\| (1\.\|2\.\|3\.\|4\.\|5\.\|3\.a-\|3\.b-\|4-\|H-)…'` | **72 cuadra · 2 corregida · 8 declarada**, **82 ids únicos** — cuadra con el front-matter ✔ |
| cero cadenas de conexión y cero email | `grep -inE "postgres(ql)?://\|<patrón email>"` | **sin salida** ✔ |
| cero PII | `grep -inE "\brut\b"` | 6 líneas, **todas** nombres de columna, reglas de régimen o el nombre del guard `name-match-RUT`; cero valores ✔ |
| ningún archivo de `app/` o `supabase/` tocado | `git status --short` | sólo el artefacto nuevo (los 2 archivos modificados preexistentes son de otra rama de trabajo, no de este plan) ✔ |
| commit sin borrados | `git diff --diff-filter=D --name-only HEAD~1 HEAD` | **sin salida** ✔ |

## Commits

| hash | qué |
|------|-----|
| `897adad` | `docs(122-06): consolidar 122-CRUCES-SQL.md con cobertura x inventario 113` |

## Self-Check: PASSED

- `122-CRUCES-SQL.md` — FOUND
- commit `897adad` — FOUND
