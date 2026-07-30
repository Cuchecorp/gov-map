---
phase: 127-panel-mat-materializador-0080-puebla-los-sujetos
plan: 02
subsystem: tests (pgTAP)
tags: [pgtap, actualidad, evidencia, panel-01, panel-06, guard-404, supresion-determinista]
dependency-graph:
  requires: ["127-01"]
  provides: ["supabase/tests/0080_actualidad_evidencia.test.sql", "supabase/tests/0065_actualidad_senal.test.sql (assert D2 actualizado)"]
  affects: ["127-03 (aplicar 0080 + correr ambos tests contra PROD)"]
tech-stack:
  added: []
  patterns: ["pgTAP begin/plan/siembra-owner/proc/asserts/finish/rollback (espejo 0065)", "control positivo apareado por cada 'cero' asertado", "orden asserts-positivos-antes-de-delete para supresión determinista"]
key-files:
  created:
    - supabase/tests/0080_actualidad_evidencia.test.sql
  modified:
    - supabase/tests/0065_actualidad_senal.test.sql
decisions:
  - "El assert D2 de 0065 se reemplaza por igualdad exacta a 'Cámara de Diputados' (más fuerte que 'sin espacios'); plan(17) no cambia y la migración 0065 no se toca."
  - "La supresión determinista de agenda_sala (asserts 15-16) se verifica DESPUÉS de correr los asserts positivos (9-14, 17-20) y de borrar sesion_sala futuras dentro de la misma transacción — evita el no-determinismo de contar 'suprimidas >= 1' contra el estado vivo de PROD."
  - "El boletín fantasma 88888-88 se siembra en citacion_punto y sesion_tabla_item (ambas sin FK sobre boletin), NUNCA en tramitacion_evento (su boletin SÍ tiene FK a proyecto)."
metrics:
  duration: "~25 min"
  completed: "2026-07-30"
---

# Phase 127 Plan 02: pgTAP de evidencia/paridad/supresión determinista para 0080 Summary

Dos archivos de test pgTAP: uno nuevo (20 asserts sobre grafía ciudadana, evidencia jsonb, guard
404 y supresión determinista de 0080) y una edición quirúrgica del assert D2 de 0065 para que no
rompa en falso al aplicarse la grafía ciudadana.

## Qué se hizo

### Task 1 — `supabase/tests/0065_actualidad_senal.test.sql`

Se reemplazó el assert de L110-114 (`cobertura_camara !~ '\s'`, "sin espacios") por un assert MÁS
FUERTE: `cobertura_camara = 'Cámara de Diputados'` exacto. El régimen viejo pedía ausencia de
espacios porque la grafía normalizada era `C.Diputados`; desde 0080 la grafía es la ciudadana
`Cámara de Diputados` (con espacios) — el assert viejo pasaría a FAIL garantizado en cuanto se
aplique 0080, sin que sea un defecto real. El assert de L104-108 (`count(distinct
cobertura_camara) = 1`) no se tocó — sigue siendo la protección D2 real. `select plan(17)` no
cambió. La migración `0065_actualidad_senal.sql` no se editó.

### Task 2 — `supabase/tests/0080_actualidad_evidencia.test.sql` (nuevo, 247 líneas, `plan(20)`)

Envoltura transaccional (`begin` → siembra owner → `select actualidad.materializar_senales()` →
asserts → `select * from finish()` → `rollback`), espejando `0065_actualidad_senal.test.sql`.

**Siembra:** proyecto `99101-99` (control positivo, en corpus), dos eventos de tramitación
(urgencia + trámite con grafía cruda `'C. Diputados'`), citación futura con un punto en-corpus y
un punto **fantasma** (`boletin='88888-88'`, sin fila en `proyecto`), sesión de sala futura con
el mismo patrón (un ítem en-corpus + uno fantasma). El fantasma se sembró en `citacion_punto` y
`sesion_tabla_item` (ninguna tiene FK sobre `boletin`); **no** en `tramitacion_evento` (su
`boletin` sí referencia `proyecto`).

**Lista numerada de asserts (N=20, coincide con `select plan(20)`):**

1. `has_function('actualidad','grafia_camara', array['text'])` — existencia de la función.
2. `grafia_camara('C. Diputados')` == `'Cámara de Diputados'`.
3. `grafia_camara('camara')` == `'Cámara de Diputados'`.
4. `grafia_camara('senado')` == `'Senado'`.
5. `grafia_camara(null)` == `'(sin cámara)'` (D-08).
6. `prosecdef` de `materializar_senales` sigue `true` tras el `create or replace`.
7. D-09b: `proconfig` de la función contiene `search_path=` (no se perdió en el REPLACE).
8. No-PII ampliado: el cuerpo (comentarios `--` stripeados) no matchea `\y(partido|rut|autores)\y`.
9. **Control positivo apareado**: existe ≥1 fila positiva (`supresion_causa is null`, no
   `agrupacion_materia`) — ancla de los ceros de abajo.
10. Toda positiva trae las 4 claves de evidencia (`total`/`items`/`consultado_al`/`fuente`) —
    violaciones == 0.
11. `evidencia->'items'` es siempre `jsonb_typeof = 'array'` en toda positiva (nunca NULL —
    Pitfall 3).
12. Paridad D-06 / anti-cap D-03: `conteo == (evidencia->>'total')::int ==
    jsonb_array_length(evidencia->'items')` — violaciones == 0.
13. D-04: `(evidencia->>'consultado_al')::date == current_date` en toda positiva — violaciones == 0.
14. D-04b + Fable M2 (anti-drift jsonb↔fila): `evidencia->'fuente'->>'dataset'` no nulo y ==
    columna `dataset` de la misma fila — violaciones == 0.
15. **Supresión determinista** (corre DESPUÉS del `delete from sesion_sala` + re-materialización):
    `agenda_sala` con `supresion_causa is not null` existe (≥1) — determinista porque la rama de
    supresión de `agenda_sala` es incondicional sin sesiones futuras.
16. Esa misma fila conserva `evidencia = '{}'::jsonb` (D-09: la supresión no lista evidencia).
17. Guard 404 negativo: el punto anidado con `boletin='88888-88'` tiene `en_corpus:false` y
    `titulo`/`enlace` null (corre ANTES del delete de 15-16, usa la citación futura sembrada).
18. Guard 404 control positivo apareado: el punto `99101-99` tiene `en_corpus:true` y `titulo` not
    null.
19. Grafía PANEL-06: ninguna `cobertura_camara` fuera del vocabulario ciudadano
    (`'Cámara de Diputados'|'Senado'|'(sin cámara)'|'2022-2026 (piso de corpus)'`) — violaciones == 0,
    apareado con el control 9.
20. D-02b: cada ítem de `agenda_sala` trae `tabla` como array (unidad = sesión).

El orden en el archivo respeta la regla de determinismo: los asserts 9-14 y 17-20 (positivos)
corren primero contra el estado que sea (siembra + PROD comingled); recién después se hace
`delete from public.sesion_sala where fecha::date >= current_date;` + re-materialización, y
entonces corren 15-16 sobre la garantía de "cero sesiones futuras".

**Prohibido asertar cifras vivas de PROD** — ningún assert depende de conteos que cambien a
diario; todos son estructurales (existencia de claves, tipos, igualdades de fórmula).

## Verificación (acceptance criteria)

- `grep -c "88888-88"` → 6 (≥2 requerido).
- El archivo empieza con `begin;` y termina con `select * from finish();` + `rollback;`.
- `grep -c "jsonb_array_length(evidencia->'items')"` → 1 (≥1 requerido).
- `grep -c "autores"` → 6 (≥1 requerido).
- `select plan(20);` — 20 asserts reales contados manualmente (líneas 83-239, excluyendo las 2
  llamadas a `materializar_senales()`).
- `grep -c "delete from public.sesion_sala"` → 1, y aparece DESPUÉS de los asserts positivos.
- `git status --porcelain supabase/migrations/` → vacío.
- 0065: `cobertura_camara !~` → 0; `Cámara de Diputados` → 3; `select plan(17)` → 1;
  `cobertura_camara ~ '\[Dd\]iputados'` → 2 (los dos asserts D2 siguen existiendo).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — este plan solo escribe archivos de test (`supabase/tests/`), no introduce superficie
nueva. La mitigación T-127-06/07/08 del threat_model del plan queda satisfecha por el `begin`/
`rollback` obligatorio y los controles positivos apareados descritos arriba.

## Self-Check: PASSED

- FOUND: supabase/tests/0080_actualidad_evidencia.test.sql
- FOUND: supabase/tests/0065_actualidad_senal.test.sql (modificado)
- FOUND commit 6300d55 (Task 1)
- FOUND commit db4a934 (Task 2)
