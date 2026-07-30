---
phase: 127-panel-mat-materializador-0080-puebla-los-sujetos
plan: 01
subsystem: db-migrations
tags: [supabase, plpgsql, actualidad, evidencia, panel]
dependency-graph:
  requires: []
  provides: [migration-0080-written]
  affects: [127-02, 127-03]
tech-stack:
  added: []
  patterns:
    - "create or replace function del proc secdef restatea literal security definer set search_path"
    - "jsonb_build_object('total', count(*), 'consultado_al', current_date, 'fuente', {...}, 'items', coalesce(jsonb_agg(...), '[]'::jsonb))"
    - "left join public.proyecto + en_corpus boolean (guard 404 D-05)"
    - "sub-select correlacionado para ítems anidados 1:N (puntos/tabla) para no multiplicar el count(*)"
    - "funcion inmutable actualidad.grafia_camara como single-source de grafia, usada identica en select y group by"
key-files:
  created:
    - supabase/migrations/0080_actualidad_evidencia.sql
  modified: []
decisions:
  - "grafia_camara implementada como función SQL immutable (no CASE ×3 repetido) — single-source real, expresión infalsificable en select/group by"
  - "descripcion (no grado) como clave del ítem en urgencias/archivados — verbatim de fuente, sin tipificar"
  - "enlace presente en los ítems anidados de agenda_citacion (puntos) y agenda_sala (tabla) — shape uniforme ítem-con-boletín"
  - "left join public.proyecto == 6 exactamente (4 bloques de evento + 2 sub-selects anidados p2/p3); los 2 bloques de agenda NO lo llevan a primer nivel"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 127 Plan 01: Migración 0080 — evidencia jsonb en el materializador de señales Summary

Migración aditiva `0080_actualidad_evidencia.sql`: `create or replace` de `actualidad.materializar_senales()` (copiado literalmente de `0065:88-310`) que añade una columna `evidencia` jsonb con los sujetos del hecho (boletín/título/fecha/enlace/en_corpus) a cada uno de los 6 INSERT positivos, más una función inmutable `actualidad.grafia_camara(text)` que unifica la grafía de cámara en un único punto (PANEL-06/D-07).

## Qué se construyó

El archivo `supabase/migrations/0080_actualidad_evidencia.sql` (440 líneas) contiene:

1. **Cabecera** con las reglas del archivo (aditiva, anti-B-01, guard 404, unidad de la evidencia, supresión conserva `'{}'`, riesgo D-09b de `create or replace` sobre proc secdef, D-12 sobre el cron, aplicación por `psql --single-transaction`) y las 3 notas del gate Fable (M3 sobre la franja horaria de materialización manual, M5 sobre el EXECUTE-to-PUBLIC residual de `grafia_camara`, M4 sobre la convención de nombrar la función sin calificar en prosa).

2. **`actualidad.grafia_camara(p_camara text)`**: función `language sql immutable` que normaliza `null`/vacío → `'(sin cámara)'`, variantes de `Cámara de Diputados` → grafía ciudadana, `Senado` → `'Senado'`, y preserva cualquier valor no previsto normalizado en espacios (nunca lo descarta).

3. **`create or replace function actualidad.materializar_senales()`**: mismo `declare`/`begin`/delete-acotado/frescuras que 0065, y los 6 bloques originales con la columna `evidencia` añadida a cada INSERT positivo:
   - **velocity**: evento de tramitación, `left join public.proyecto`, `grafia_camara(te.camara)` idéntica en select/group by.
   - **nuevos_ingresos**: subquery `pe` intacta + left join proyecto; `cobertura_camara` sigue siendo el literal de piso de corpus (no pasa por grafía).
   - **urgencias**: clave `descripcion` (no `grado`, Fable blocker 3); cero límite/cap.
   - **agenda_citacion**: unidad = citación; `puntos` anidado vía sub-select correlacionado contra `citacion_punto` + left join `p2`; orden externo ascendente (agenda futura).
   - **agenda_sala**: unidad = sesión; `tabla` anidada vía sub-select correlacionado contra `sesion_tabla_item` + left join `p3`; sin fabricar `urgencia`.
   - **archivados**: mismo patrón que urgencias con el `where` completo de exclusión de `desarchiv%`/`retira y hace presente%`.
   - Los 8 INSERT de supresión se copiaron intactos, sin listar `evidencia`.
   - Cierre `end; $$;` idéntico a `0065:309-310`. El bloque `cron.schedule` de 0065 NO se re-emite (D-12).

## Verificación (conteos normalizados `tr -s '[:space:]' ' '`)

- `coalesce(jsonb_agg` == 8 (6 agregados de primer nivel + 2 sub-selects anidados)
- `left join public.proyecto` == 6 (4 bloques de evento + `p2`/`p3` anidados)
- `jsonb_build_object('total'` == 6 (una evidencia por bloque positivo)
- `actualidad.grafia_camara` == 7 (definición + 3 pares select/group by)
- `security definer set search_path = ''` == exactamente 1 (D-09b)
- `insert into public.actualidad_senal` == 16 (≥14 requerido)
- Cero `limit`, cero `at time zone`, cero `grant`/`revoke`/`cron.schedule`/`create table`/`create view` fuera de comentarios, cero PII (`partido`/`rut`/`autores`)
- `git status --porcelain supabase/migrations/` → solo `0080_actualidad_evidencia.sql`
- `0065`, `0073`, `0075` sin modificar; `app/` sin tocar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentarios de prosa colisionaban con los greps de acceptance normalizados**

- **Encontrado durante:** verificación de Task 2 y Task 3.
- **Problema:** varios comentarios explicativos (cabecera, notas del bloque agenda_citacion, nota sobre PII) usaban literalmente las mismas cadenas que los patrones de acceptance (`security definer set search_path = ''`, `at time zone`, `partido`/`rut`, `actualidad.grafia_camara` calificado), inflando los conteos por encima de los exactos requeridos por el plan (p.ej. `security definer set search_path = ''` daba 2 en vez de 1 exacto; `actualidad.grafia_camara` daba 10 en vez de 7; `at time zone` daba 1 en vez de 0; PII-words daban 1 en vez de 0).
- **Fix:** se reescribieron esos comentarios para transmitir el mismo significado sin repetir el literal exacto (p.ej. "cláusula security-definer + search_path vacío", "sin conversión de zona horaria", "tablas/columnas de identidad/afiliación política de personas", "grafia_camara" sin calificar / "nombre calificado completo").
- **También:** se reformateó `jsonb_build_object(\n  'total', ...)` a una sola línea `jsonb_build_object('total', ...)` en los 6 bloques positivos, porque el patrón de acceptance `jsonb_build_object('total'` no toleraba el salto de línea incluso tras `tr -s '[:space:]' ' '` (la normalización colapsa el newline a un espacio, no lo elimina).
- **Archivos modificados:** `supabase/migrations/0080_actualidad_evidencia.sql`.
- **Commits:** incluido en `866d1cf` y `ffe8467` (fix aplicado antes de cada commit, no como commit separado).

## Known Stubs

Ninguno — este plan solo escribe SQL, no UI ni datos mockeados.

## Threat Flags

Ninguno nuevo fuera del `<threat_model>` ya declarado en el PLAN.md (T-127-01..05), todos con disposición `mitigate`/`accept` ya cubierta por el diseño del archivo.

## Self-Check: PASSED

- `supabase/migrations/0080_actualidad_evidencia.sql` existe: FOUND.
- Commit `66c126a` (Task 1): FOUND en `git log --oneline`.
- Commit `866d1cf` (Task 2): FOUND en `git log --oneline`.
- Commit `ffe8467` (Task 3): FOUND en `git log --oneline`.
- `git status --porcelain supabase/migrations/` muestra únicamente el archivo esperado.
