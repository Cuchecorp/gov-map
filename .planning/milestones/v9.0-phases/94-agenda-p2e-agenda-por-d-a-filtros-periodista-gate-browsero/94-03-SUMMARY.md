---
phase: 94-agenda-p2e-agenda-por-d-a-filtros-periodista-gate-browsero
plan: 03
subsystem: ficha-proyecto / estado-actual
tags: [wiring, ficha, citaciones, tabla-de-sala, CIT-04, CIT-05]
requires:
  - "app/components/estado-actual-block.tsx (EstadoActualBlock/derivarEstadoActual — 88/89)"
  - "app/lib/week-utils.ts (isoWeekOf, semanaIsoKey)"
  - "sesion_tabla_item + sesion_sala (0010, public-read)"
provides:
  - "citacionesPasadas() — citaciones fecha<hoy-Chile visibles en la ficha (gap #1)"
  - "enTablaSala() — apariciones del boletín en la tabla de sala en la ficha (gap #2)"
  - "EstadoActual.citacionesPasadas / EstadoActual.enTablaSala (campos opcionales)"
affects:
  - "app/proyecto/[boletin] (ficha — bloque '¿Dónde está hoy?')"
tech-stack:
  added: []
  patterns:
    - "omit-when-not-derivable estricto para pasadas y tabla de sala"
    - "semana ISO derivada en TS (Chile tz) porque sesion_sala NO guarda semana_iso"
    - "4a lectura batched en el Promise.all existente; salaError se LANZA (#34)"
key-files:
  created: []
  modified:
    - "app/components/estado-actual-block.tsx"
    - "app/components/estado-actual-block.test.tsx"
decisions:
  - "sesion_sala NO tiene columna semana_iso (0010: solo fecha timestamptz) → semana ISO derivada en TS con semanaIsoChile(), espejando to_char(fecha at time zone 'America/Santiago','IYYY-\"W\"IW') de /agenda"
  - "cross-link comisión→membresía (CIT-04) DIFERIDO: la página propia por comisión no existe en esta fase (Deferred Ideas v9.x/v10); comisiones mostradas como texto, sin enlace inventado"
  - "una citación de HOY sigue en citacionVigente (no se duplica en pasadas); predicado pasada estricto fecha < hoy-Chile"
metrics:
  duration: "~35 min"
  completed: "2026-07-22"
  tasks: 2
  files: 2
---

# Phase 94 Plan 03: Fixes de wiring de la ficha (citaciones pasadas + tabla de sala) Summary

Cierre de los 2 gaps de WIRING de la ficha confirmados con DOM en 93: la ficha ahora muestra las citaciones PASADAS (marca sobria "(sesión pasada)") además de la vigente, y declara "En tabla de sala de la {Cámara|Senado} del {fecha}" con link petróleo a `/agenda?semana=`, leyendo `sesion_tabla_item` que antes no consultaba — todo SIN re-ingesta (la data ya estaba en DB).

## What Was Built

**Task 1 (`48202fd`)** — Derivadores puros, backward-compatible con 88/89:
- `citacionesPasadas(citaciones, hoy)`: espejo de `citacionVigente` con predicado ESTRICTO `fecha < hoy-Chile`, orden DESC (más reciente primero), `.slice(0,5)`, omit-when-empty. Una citación de HOY NO cuenta como pasada (la lleva `citacionVigente`).
- `enTablaSala(filas)`: mapea `{ camara, fecha, semanaIso }` de las filas crudas, descarta cámara/fecha inválida, orden DESC.
- `semanaIsoChile(fecha)`: deriva la semana ISO en tz Chile porque `sesion_sala` **no guarda** `semana_iso` (solo `fecha`).
- `derivarEstadoActual` gana un 5º parámetro OPCIONAL `tablaSala = []`; las firmas de 2 y 3 args (que usan los tests 88/89) siguen compilando idénticas.
- `EstadoActual` extendido con `citacionesPasadas?` y `enTablaSala?` (opcionales).

**Task 2 (`0f6b24d`)** — Lectura server-side + render:
- `EstadoActualBlock`: 4ª lectura batched en el `Promise.all` existente (`sesion_tabla_item` con embed `sesion_sala(camara, fecha)`). Un `salaError` real se LANZA (#34, espejo de las otras 3 lecturas), nunca degrada a línea vacía.
- `EstadoActualView`: renderiza las citaciones pasadas (marca "(sesión pasada)" en `text-muted-foreground`, fechas mono) y la línea de tabla de sala con link petróleo (`text-accent-product underline`) a `/agenda?semana={semanaIso}`; conteo honesto "En tabla de sala {N} veces" cuando aparece en varias sesiones.
- Guard `if (!etapaLinea && ... ) return null;` ampliado para incluir los campos nuevos: el bloque se pinta si hay CUALQUIER línea derivable (incl. solo pasadas o solo tabla de sala).

## Sujetos de validación (93-WIRING-EVIDENCIA §0)

- **18193-06** (1 citación 2026-07-21 pasada, hoy 2026-07-22, 0 filas de sala) → `citacionesPasadas` tiene 1 entrada, `citacionVigente` null, `enTablaSala` ausente. **Test presente.**
- **13665-07** (2 filas de sala Senado W28/W29, 0 citaciones) → `enTablaSala` tiene 2 entradas con `semanaIso` "2026-W29"/"2026-W28", pasadas/vigente ausentes. **Test presente.**
- **11929-13** (citación HOY, control) → `citacionVigente` sigue funcionando; una citación de HOY no se degrada a pasada. **Test presente.**

## Deviations from Plan

**None de tipo Rule 1-4.** Un hallazgo de wiring que ajusta la implementación respecto de la nota de interfaz del plan:

**[Rule 3 - Blocking] `sesion_sala` no tiene columna `semana_iso`**
- **Found during:** Task 1/2. La nota de interfaz del plan sugería embeber `sesion_sala(camara, fecha, semana_iso)` y el interface `SesionSalaRow` insinuaba `semana_iso?: string`. La migración 0010 (`create table sesion_sala`) **no define** esa columna — solo `fecha timestamptz`.
- **Fix:** el embed pide `sesion_sala(camara, fecha)` y la semana ISO se deriva en TS con `semanaIsoChile()`, tomando el día calendario chileno de la fecha y calculando su semana ISO — espejando la convención SQL de navegación de /agenda (`to_char(fecha at time zone 'America/Santiago','IYYY"-W"IW')`). Sin esto la query habría fallado en PROD (columna inexistente).
- **Files modified:** app/components/estado-actual-block.tsx
- **Commit:** 48202fd (helper) + 0f6b24d (query)

## Cross-link diferido (CIT-04)

El cross-link comisión→membresía se DIFIERE: no existe una página propia por comisión en esta fase (Deferred Ideas: "página propia por comisión — v9.x/v10"). Las comisiones se muestran como texto plano, sin enlace inventado. El link petróleo que sí se implementó es comisión/sala → `/agenda?semana=` (regla accent #2), que sí tiene destino real.

## Threat model

- **T-94-05 (mitigate):** citaciones pasadas ahora visibles → la ficha ya no niega que un proyecto histórico fue citado. ✔
- **T-94-06 (mitigate):** omit-when-not-derivable estricto; marca "(sesión pasada)" neutra en `text-muted-foreground`, NUNCA "Vigente" a partir de ausencia. ✔ (test asserta ausencia de `destructive`).
- **T-94-07 (accept):** `sesion_tabla_item`/`sesion_sala` son no-PII, ya servidas por /agenda. ✔
- **T-94-SC (mitigate):** CERO paquete nuevo. ✔

## Verification

- `grep sesion_tabla_item app/components/estado-actual-block.tsx` → presente (query + derivación). ✔
- `cd app && pnpm exec vitest run` → **1187 passed (91 files)**, cero regresión de los 88/89 compartidos. ✔
- `cd app && pnpm exec tsc --noEmit` → **exit 0** (firmas 2/3-arg de `derivarEstadoActual` intactas). ✔
- Sujetos 18193-06 / 13665-07 renderizarían las nuevas líneas (tests deterministas con `hoy` fijo 2026-07-22). ✔

## Self-Check: PASADO
