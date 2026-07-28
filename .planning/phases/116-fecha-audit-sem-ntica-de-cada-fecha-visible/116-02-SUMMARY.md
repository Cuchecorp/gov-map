---
phase: 116
plan: 02
subsystem: auditoria-fechas
tags: [fecha-audit, solo-lectura, grupo-a, provenance]
requires: [116-01 (116-FORMATTERS.md), 113-INVENTARIO.md §3.0]
provides: [116-PARCIAL-A.md]
affects: [116-04]
tech-stack:
  added: []
  patterns: [auditoria-con-evidencia-archivo-linea, veredicto-tri-estado, anchors-re-localizados-por-simbolo]
key-files:
  created:
    - .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-PARCIAL-A.md
  modified: []
decisions:
  - "Los 2 emisores del grupo A que NO renderizan fecha (E-026, E-057) se declaran en una subsección A.1.bis con evidencia de ausencia, en vez de forzarles un veredicto del conjunto cerrado"
  - "El eje de auditoría date-only se amplía a su corolario inverso: timestamps reales renderizados sin timeZone (votacion.fecha, lobby_audiencia.fecha) son hallazgo de DÍA"
metrics:
  duration: ~50 min
  completed: 2026-07-28
---

# Phase 116 Plan 02: Veredicto de fechas del grupo A — Summary

Auditoría solo-lectura que emite veredicto `hecho`/`captura`/`ambigua` para las 42 fechas visibles de
los 18 emisores del grupo A (carril parlamentario + `/comparar` + `/cuenta` + gate MONEY), con origen
citado hasta la columna, etiqueta verbatim y tipo de columna verificado contra las migraciones.

## Qué se construyó

`116-PARCIAL-A.md` (203 líneas) con:

- **`## A.0`** — las 5 reglas de decisión LOCKED declaradas una vez y referenciadas por A.1 y A.2.
- **`## A.1`** — 22 filas del carril ficha parlamentario (E-001, E-002, E-003, E-005, E-012, E-019,
  E-053, E-054, E-059) con etiqueta visible verbatim leída del JSX.
- **`### A.1.bis`** — E-026 y E-057 declarados como emisores **sin fecha renderizada**, con el grep
  de evidencia de ausencia.
- **`## A.2`** — 20 filas de `/comparar` (VSIM ON), `/cuenta` (NOTIF OFF) y los 5 emisores MONEY,
  cada uno con `MONEY — no emitido en el deploy auditado`.
- **`### A.2.1`** — auditoría date-only de 10 filas con el tipo real de cada columna verificado en
  `supabase/migrations/*.sql`.
- **`## A.3`** — cierre: los 18 ids con su número de filas de veredicto.

## Hallazgos sustantivos (insumo del plan 04 → Phase 117)

1. **Ambigüedad de DÍA en `votacion.fecha` y `lobby_audiencia.fecha`.** Ambas son `timestamptz`
   (`0008_tramitacion.sql:40`, `0021_lobby.sql:41`), no date-only, y se renderizan recortando/
   formateando en UTC (`fechaCortaSegura`, `fechaCorta` sin `timeZone`). Una votación o audiencia
   chilena posterior a las 21:00 CL se muestra con el día siguiente. Es el **corolario inverso** del
   gotcha LOCKED v9.0: no se convierte de zona un date-only, se trata como date-only un timestamp
   real. `lobby_audiencia.fecha_raw` (ej. `"2023-12-26 13:00:00-03"`) prueba que el día chileno es
   conocible y el render lo pierde. Magnitud pendiente de SQL en el plan 04.
2. **`fecha_corte` / `ingestado_hasta` son ambiguas por CATEGORÍA** (4 emisores MONEY). No son el
   hecho ni el reloj de scraping: son el borde del periodo cubierto por la fuente y la cobertura de
   ingesta respectivamente, ambas rotuladas "corte al" y conviviendo en la misma fila con un badge
   "Actualizado hace X". El usuario no puede separarlas. Deuda que 117 debe cerrar **antes** de
   cualquier flip del gate MONEY.
3. **Contraejemplos limpios que 117 puede copiar como idiom**: `partido-chip.tsx:73` (`según
   {fuente} al {fecha}`), `comparar/page.tsx:324` (`según fuente al`) y `:293` (`consultado al` para
   la fecha de consulta), y `militancias-de-parlamentario.tsx:27` (ausencia honesta `vigente`, cero
   fecha fabricada).
4. **`fechaCortaSegura` cumple el contrato date-only** en las cuatro superficies de E-005; ninguna
   columna genuinamente date-only del grupo A sufre conversión de zona.

## Desviaciones del plan

### [Rule 2 — honestidad de la auditoría] E-026 y E-057 no renderizan fecha

- **Encontrado en:** Task 1.
- **Situación:** el plan los clasificó en el grupo A ("fechas que muestra" no vacía en 113 §3.0),
  pero el código no emite ninguna fecha (`grep` de formatters → 0 matches en ambos archivos).
- **Resolución:** en vez de forzarles un veredicto de `{hecho, captura, ambigua}` —que solo tiene
  sentido sobre una fecha visible— se creó `### A.1.bis` con la evidencia de ausencia y la condición
  registrada. Ambos ids siguen presentes y contados en `## A.3`.
- **Efecto en el criterio de aceptación:** la igualdad "nº de veredictos = nº de filas" se cumple
  dentro de cada tabla de veredicto; las dos filas puntero de `## A.1` llevan `—` y remiten a
  `A.1.bis`.

### [Rule 1 — corrección de veredicto] E-001 y E-002 pasaron de "sin hallazgo" a hallazgo de DÍA

- **Encontrado en:** Task 2, al verificar los tipos de columna en las migraciones para `### A.2.1`.
- **Situación:** en Task 1 se les había asignado `¿miente?` = `no` asumiendo entradas date-only.
- **Resolución:** verificado que ambas columnas son `timestamptz`, se corrigieron las tres celdas en
  `## A.1` y se ajustó el párrafo de cierre de sección. La lista `Sin hallazgos` no cambió (ambos ya
  figuraban con hallazgo por el idiom del chokepoint).

### Anchors STALE re-localizados (declarados, como exige el plan)

| símbolo | línea citada por el plan / inventario | línea OBSERVADA |
|---|---|---|
| `resumen.mesFin` (render) | `votos-por-parlamentario.tsx:452` | `:451` |
| `select` de `probidad_ingesta_estado` | `patrimonio-de-parlamentario.tsx:991` | `:992` |
| provenance "según fuente al" de comisiones | `comparar/page.tsx:325` | `:324` (`:325` es la rama fallback "consultado al") |
| `fechaCorta(new Date(fechaCorte))` | `financiamiento-de-parlamentario.tsx:355` | `:356` |
| `.from("aportes_ingesta_estado")` | `financiamiento-de-parlamentario.tsx:517` | `:518` |
| `.from("contratos_ingesta_estado")` | `contratos-de-parlamentario.tsx:353` | `:354` |
| `capturedAt` de E-003 | `voto-ficha-row.tsx:134,:218` (113 §3.0) | `:135,:220` (coincide con el plan 02) |

Todos los demás anchors citados fueron verificados por símbolo (`sed -n '<n>p' | grep -qF`) y
coinciden.

## Régimen verificado

- `git status --porcelain app/ packages/` → vacío tras ambas tasks.
- `git diff --quiet -- .env .env.example` → limpio. **Cero flags tocados** (MONEY y NOTIF siguen OFF;
  E-060 se auditó leyendo el gate en `page.tsx:50-51`, jamás ejecutándolo).
- Cero RUT, cero email, cero cadena `postgres://` en el artefacto (`grep -cE` → 0 en los tres).
- Cero instalación de paquetes.

## Verificación

- Task 1: `OK-A1` (11 ids presentes + línea `Sin hallazgos:`).
- Task 2: `OK-A2` (7 ids presentes + `no emitido en el deploy auditado` + `## A.3 Cierre del grupo A`).
- 18/18 ids del grupo A con al menos una fila de veredicto.

## Self-Check: PASSED

- `.planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-PARCIAL-A.md` — FOUND (203 líneas).
- Commit `f583be3` (Task 1) — FOUND.
- Commit `889dfa1` (Task 2) — FOUND.
