---
phase: 131-debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento
plan: 01
subsystem: timeline-tramitacion
tags: [determinismo, sql-documental, testing, debt]
requires: []
provides:
  - "supabase/queries/timeline-regla-de-seleccion.sql (regla del timeline con criterio declarado)"
  - "app/components/__fixtures__/timeline-14309-04.json + .esperado.json (número congelado, sede única)"
  - "orden total (fecha asc, id asc) en la lectura de tramitacion_evento"
affects:
  - "app/app/proyecto/[boletin]/page.tsx"
  - "app/components/timeline-view.test.tsx"
tech-stack:
  added: []
  patterns:
    - "SQL documental (no vista, no función) como sede de una regla de negocio que un builder TS ya implementa — trazabilidad sin superficie nueva"
    - "Detector puro (ordenTotalDeclarado) probado con control positivo apareado (cero vacuo)"
    - "Paridad regla↔builder vía fixture congelado importado, cero literal numérico horneado en tests"
key-files:
  created:
    - supabase/queries/timeline-regla-de-seleccion.sql
    - app/components/__fixtures__/timeline-14309-04.json
    - app/components/__fixtures__/timeline-14309-04.esperado.json
  modified:
    - app/app/proyecto/[boletin]/page.tsx
    - app/components/timeline-view.test.tsx
decisions:
  - "id asc (única columna garantizada única en tramitacion_evento) como clave de desempate del orden total, tal como recomendaba 131-RESEARCH A3."
  - "Reconciliación del número viejo ('85' citado en ROADMAP.md §131) reescrita sin el dígito literal en el .sql, para no colisionar con el guard anti-duplicación de Task 3 (ver Deviations)."
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 131 Plan 01: Regla del timeline (determinismo + fixtures + paridad) Summary

Cierra DEBT-03 (H-06): la regla de agrupación de urgencias del timeline queda escrita en un
`.sql` documental ejecutable contra PROD, y la lectura de `tramitacion_evento` deja de depender
del orden físico de Postgres — el número de líneas "Hito del" ahora es determinista bajo un
orden total `(fecha asc, id asc)`.

## Número congelado (H) — testigo 14309-04

Medido en PROD el 2026-07-30 con la query de `supabase/queries/timeline-regla-de-seleccion.sql`
bajo el orden total `(fecha asc, id asc)`:

| Métrica | Valor |
|---|---|
| `eventos_totales` | 99 |
| `eventos_absorbidos` | 14 |
| `periodos` | 5 |
| `hitos_del` (H) | **85** |

Identidad verificada: `99 − 14 = 85` — cierra sin residuo.

**Reconciliación (fix W-2 checker):** el número "85" que ROADMAP.md §131 ya citaba para
14309-04 fue medido bajo el orden VIEJO (`fecha` sola, no determinista — dependiente del
desempate físico que Postgres entregara ese día: la medición del research dio 14/12/16
absorbidos según el criterio de desempate usado). El H=85 medido aquí bajo el orden total
`(fecha asc, id asc)` **coincide numéricamente por casualidad de esta corrida concreta, NO por
garantía** — el punto de D-03 es que H queda FIJO por el orden total declarado, ya no a merced
del vacuum/heap/plan de Postgres. Esta coincidencia NO debe leerse como que "no cambió nada":
lo que cambió es que el número ya no puede variar entre deploys. Repetido aquí y en la cabecera
de `timeline-regla-de-seleccion.sql` para que el audit no confunda coincidencia con regresión.

Sede única del número: `app/components/__fixtures__/timeline-14309-04.esperado.json`.

## Tasks ejecutadas

1. **Regla escrita + medición** — `supabase/queries/timeline-regla-de-seleccion.sql` (criterio
   declarado: qué entra/se agrupa/excluye/por qué + orden total + nota de fecha date-only +
   reconciliación) + fixture de los 99 eventos reales en orden + `*.esperado.json` congelado.
   Commit `83146e3`.
2. **Orden total en la lectura + guard** — `.order("id", { ascending: true })` encadenado tras
   `.order("fecha")` en `TramitacionSection` (`page.tsx`); `describe` nuevo con detector puro
   `ordenTotalDeclarado` + control positivo apareado (pasa contra la fuente real, falla si falta
   el desempate o si el `.order("id")` vive en otra query). Commit `3aff971`.
3. **Paridad regla↔builder** — `describe` nuevo que importa el fixture congelado y ejerce
   `construirItems` contra los 4 valores del `esperado.json` (periodos, absorbidos, hitos_del,
   cierre sin residuo), cero literal numérico horneado. Commit `06f2545`.

## Verificación

- `pnpm --filter ./app exec vitest run components/timeline-view.test.tsx` → **45/45 verde**
  (38 tests preexistentes + 3 de orden total + 4 de paridad).
- `pnpm --filter ./app exec tsc --noEmit` → limpio.
- `psql` contra PROD (14309-04): `99|14|5|85`, identidad `N−K=H` verificada.
- `grep -c "America/Santiago"` sobre el `.sql` (excluyendo comentarios) → 0.
- `git diff --stat -- package.json pnpm-lock.yaml app/package.json` → vacío (cero dependencias
  nuevas, coherente con threat T-131-SC = accept).
- Guard W-8 (número congelado no horneado fuera de su sede): 0 matches de `\b85\b` en
  `timeline-view.test.tsx` y `timeline-regla-de-seleccion.sql` tras el fix de wording (ver
  Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Colisión entre la reconciliación W-2 (Task 1) y el guard anti-duplicación W-8 (Task 3)**
- **Found during:** verificación de Task 3 (el guard `grep -o "\b${H}\b"` sobre
  `timeline-view.test.tsx` + `timeline-regla-de-seleccion.sql`).
- **Issue:** el Task 1 pedía escribir literalmente "85" en la cabecera del `.sql` como parte de
  la reconciliación con ROADMAP.md. La medición real de esta corrida dio H=85 — el MISMO
  dígito que la reconciliación cita como número viejo. El guard W-8 de Task 3 (que prohíbe que
  el número congelado H aparezca literal fuera de `*.esperado.json`) habría fallado por esta
  coincidencia numérica, no por una fuga real de la sede única.
- **Fix:** reescrita la nota de reconciliación en `timeline-regla-de-seleccion.sql` sin el
  dígito literal "85" — refiere a "el número citado en ROADMAP.md §131" y explicita que la
  coincidencia numérica de esta corrida no es garantía. El contenido semántico (por qué el
  número viejo no es comparable al nuevo) se preserva íntegro.
- **Files modified:** `supabase/queries/timeline-regla-de-seleccion.sql`.
- **Commit:** `06f2545` (incluido en el commit de Task 3, donde se detectó).

None otra — el resto del plan se ejecutó tal como escrito.

## Known Stubs

Ninguno. El fix de Task 2 es una línea (`.order("id", ...)`); las queries y fixtures son datos
reales de PROD, no mocks.

## Threat Flags

Ninguno — superficie nueva es cero (T-131-04 accept confirmado: no se creó vista ni función
SQL; el `.sql` es documental, sin credenciales embebidas, parametrizado por variable psql).

## Self-Check: PASSED

- `supabase/queries/timeline-regla-de-seleccion.sql` — FOUND
- `app/components/__fixtures__/timeline-14309-04.json` — FOUND (99 elementos)
- `app/components/__fixtures__/timeline-14309-04.esperado.json` — FOUND
- Commit `83146e3` — FOUND en `git log`
- Commit `3aff971` — FOUND en `git log`
- Commit `06f2545` — FOUND en `git log`
