---
phase: 99-senales-p1b-materializador
plan: 01
subsystem: database
tags: [postgres, pg_cron, security-definer, materialization, rls, pgtap, actualidad_senal]

# Dependency graph
requires:
  - phase: 98-senales-p1a-spike-de-datos
    provides: "veredicto por señal (6 honestas), 3 defectos de datos LOCKED, regla del reloj, anti-ranking cross-cámara"
  - phase: 39-cruces (0039)
    provides: "molde tabla deny-by-default + proc full-rebuild security-definer + pg_cron + assertion"
provides:
  - "tabla precomputada actualidad_senal (deny-by-default, RLS enabled, cero policies, revoke all)"
  - "proc actualidad.materializar_senales() (security definer, full-rebuild acotado, 6 señales, 3 defectos)"
  - "pg_cron job actualidad-materializar intradía L-V"
  - "pgTAP 0065_actualidad_senal.test.sql (estructural + 3 defectos + supresión-como-fila)"
affects: [phase-100-panel-landing, phase-99-02-rpc-bounded, phase-99-03-cli-kmeans, phase-99-04-apply-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "materializador full-rebuild ACOTADO por tipo_senal (delete where tipo in (...) — nunca global) para coexistir sin race con el CLI que posee 'agrupacion_materia'"
    - "supresión-como-fila: fuente stale / sin futuras => fila con supresion_causa + conteo 0, jamás ausencia ni 0-como-hecho"
    - "umbral stale hardcodeado en SQL con comentario que cita su origen TS (catalog.ts) por no ser consultable desde el proc"

key-files:
  created:
    - "supabase/migrations/0065_actualidad_senal.sql"
    - "supabase/tests/0065_actualidad_senal.test.sql"
  modified: []

key-decisions:
  - "Umbral stale = 7 días HARDCODEADO en el proc; origen packages/freshness/src/catalog.ts (fuentes 'leyes' y 'agenda', umbralDias:7). El valor TS no es consultable desde SQL."
  - "sesion_sala CONFIRMADA como el nombre real de la tabla de sesiones de sala (0010_agenda.sql L59), NO sesion_tabla_item — Open Question A4 resuelto."
  - "DELETE del proc acotado a los 6 tipos temporales; 'agrupacion_materia' NUNCA se toca (lo posee el CLI k-means de 99-03)."
  - "Validación end-to-end contra Postgres 15 efímero (Docker) — el apply a PROD + pgTAP es el checkpoint operador de 99-04."

patterns-established:
  - "Materializador acotado-por-tipo: dos writers (proc SQL + CLI TS) escriben conjuntos disjuntos de tipo_senal con deletes acotados => sin race."
  - "Supresión-como-fila honesta: toda fuente stale/vacía emite fila causada; el pgTAP siembra stale y verifica que dispara."

requirements-completed: [SEN-02, SEN-03, SEN-04]

# Metrics
duration: 5min
completed: 2026-07-24
---

# Phase 99 Plan 01: Materializador actualidad_senal Summary

**Tabla precomputada `actualidad_senal` deny-by-default + proc full-rebuild `actualidad.materializar_senales()` (security definer, 6 señales honestas, 3 defectos de datos LOCKED, supresión-como-fila) + pg_cron intradía L-V, espejando 0039 y validado end-to-end en Postgres efímero.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-24T13:48:53Z
- **Completed:** 2026-07-24T13:53:54Z
- **Tasks:** 2
- **Files modified:** 2 (ambos creados)

## Accomplishments

- **Tabla `actualidad_senal`** deny-by-default: RLS enabled + `revoke all from anon, authenticated` + CHECK de 7 tipos (6 temporales + `agrupacion_materia`) + provenance inline NOT NULL + `unique(tipo_senal, cobertura_camara, ventana, cluster_id)`. Cero policies, cero grant (espejo 0039).
- **Proc `actualidad.materializar_senales()`** security definer `set search_path=''` con DELETE ACOTADO a los 6 tipos temporales (nunca global — el CLI 99-03 posee `agrupacion_materia`). Las 6 señales honestas: velocity (7d), nuevos_ingresos (2022-2026, primer-evento por boletín, excluye pre-2022), urgencias (30d, hecho fechado), agenda_citacion (futuras, tz Chile date-only), agenda_sala (futuras o supresión), archivados (30d por descripcion).
- **3 defectos LOCKED aplicados en cada agregación:** (D1) `fecha <= current_date` en todo max/ventana; (D2) `regexp_replace(camara,'\s+','','g')` antes de agrupar; (D3) `camara IS NULL` → `'(sin cámara)'` literal, nunca repartido.
- **Supresión-como-fila:** agenda_sala/agenda_citacion sin futuras o fuente stale → fila con `supresion_causa` + `conteo 0` (nunca ausencia, nunca 0-como-hecho). Ancla a `tramitacion_evento.fecha`, jamás `fecha_captura`.
- **pg_cron** `actualidad-materializar` `'7 11,14,17,20 * * 1-5'` + version-guard + assertion post-migración (espejo 0039 verbatim).
- **pgTAP** espejo 0039 (has_table, RLS enabled, cero policies, security definer, no-PII body, cron registrado, anon 42501) + 5 aserciones Phase 99 (D1/D2/D3 + supresión-como-fila).
- **Validación runtime end-to-end** contra Postgres 15 efímero (Docker + stub pg_cron): apply limpio, y sobre datos sembrados los 3 defectos y la supresión se comportaron exactamente según contrato.

## Task Commits

1. **Task 1: pgTAP 0065 (test primero, Wave 0)** - `e508619` (test)
2. **Task 2: Migración 0065 (tabla + proc + pg_cron)** - `01c72ac` (feat)

_Task 1 es el gate RED (test escrito antes de que el proc exista); Task 2 es el gate GREEN (el proc que el test apunta existe y su runtime está validado)._

## Files Created/Modified

- `supabase/migrations/0065_actualidad_senal.sql` - tabla deny-by-default + schema `actualidad` + proc full-rebuild acotado (6 señales, 3 defectos, supresión-como-fila) + pg_cron intradía L-V + assertion.
- `supabase/tests/0065_actualidad_senal.test.sql` - pgTAP espejo 0039 + aserciones D1/D2/D3 + supresión; corre contra el schema APLICADO en 99-04.

## Decisions Made

- **Umbral stale = 7 días, HARDCODEADO** (checker warning #1 / Open Question A5). Origen documentado: `packages/freshness/src/catalog.ts`, fuentes `leyes` (tabla `proyecto`/tramitación) y `agenda` (tabla `citacion`), ambas con `umbralDias: 7`. El valor vive en TypeScript y NO es consultable desde el proc SQL, por eso se replica como constante `c_umbral_stale_dias constant int := 7` con comentario. **Si `catalog.ts` cambia el umbral de esas fuentes, hay que actualizar la constante del proc** (deriva documentada aquí).
- **`sesion_sala` es el nombre real** de la tabla de sesiones de sala (verificado contra `0010_agenda.sql` L59: `create table sesion_sala (... fecha timestamptz ...)`), NO `sesion_tabla_item` (que es el ítem del orden del día). Open Question A4 / research #1 RESUELTO.
- **Corte de cámara declarado con la grafía CRUDA normalizada** (`C.Diputados` / `Senado` según la fuente) en `cobertura_camara`. Anti-ranking respetado: sin `order by conteo` cross-cámara en el proc; el orden lo pone la RPC (99-02) por nombre.
- **Validación por Postgres efímero** en vez de solo grep: se levantó `postgres:15-alpine` con un stub de `cron.schedule`/`cron.job` + fila `pg_extension` para pg_cron, se aplicó el .sql completo y se ejecutó el proc sobre datos sembrados. Esto prueba syntaxis + runtime de los 3 defectos y la supresión ANTES del checkpoint operador. El apply a PROD sigue siendo 99-04.

## Deviations from Plan

None - plan executed exactly as written. Los dos `<verify>` grep-blocks del plan pasaron; adicionalmente se validó runtime en Postgres efímero (esfuerzo extra dentro de alcance, no una desviación).

## Column-name / schema drift vs applied schema

Ninguna deriva de nombre de columna. Verificado contra el schema real:
- `tramitacion_evento` (0008 L68-82): `fecha timestamptz`, `camara text` (nullable), `tipo` CHECK (tramite/urgencia/informe/oficio/votacion), `descripcion text` (nullable), `boletin`. Todos usados tal cual.
- `citacion` (0010 L19-33): `fecha timestamptz`, `camara text`. Usados tal cual.
- `sesion_sala` (0010 L59-70): `fecha timestamptz`, `camara text`. Usados tal cual (confirma A4).
- `proyecto` (0008 L19-34): `materia text` presente (label factual para 99-03), no consumido en este proc.

## Issues Encountered

- **`ilike '%archiv%'` y acentos:** durante la validación runtime, un evento de prueba con "Archívese" (acentuado) NO fue capturado por `ilike '%archiv%'` porque el acento rompe el stem "archiv". Esto es correcto-por-diseño: los tokens reales que cita el SPIKE ("Archivado...", "Se retira...", "Desarchivo de proyecto", "retira y hace presente") son los que importan. Re-sembrando esos tokens reales, `archivados` contó 2 y excluyó los 2 que invierten el sentido (`desarchiv%`, `retira y hace presente%`) — exactamente el contrato. No es un bug del proc; es un artefacto de la semilla de prueba acentuada.

## User Setup Required

None en este plan. **El apply a PROD + corrida del pgTAP contra el schema aplicado es el checkpoint operador de Plan 99-04** (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0065_actualidad_senal.sql`, NUNCA `db push`). El agente NO tocó PROD.

## Next Phase Readiness

- **99-02 (RPC bounded):** la tabla `actualidad_senal` y sus columnas están fijadas; la RPC `actualidad_senales_panel` puede leerlas con la firma sugerida en 99-RESEARCH §Bounded RPCs.
- **99-03 (CLI k-means):** el tipo `agrupacion_materia` está en el CHECK y NUNCA es tocado por el DELETE del proc → el CLI puede hacer su propio full-rebuild acotado sin race.
- **99-04 (apply checkpoint):** migración + pgTAP listos para aplicar a PROD y correr `psql -tA -f` contra el schema aplicado (el pgTAP corre verde contra el schema aplicado; build/typecheck son falsos positivos para SQL).

## Self-Check: PASSED

- FOUND: supabase/migrations/0065_actualidad_senal.sql
- FOUND: supabase/tests/0065_actualidad_senal.test.sql
- FOUND: .planning/phases/99-senales-p1b-materializador/99-01-SUMMARY.md
- FOUND commit e508619 (test), FOUND commit 01c72ac (feat)

---
*Phase: 99-senales-p1b-materializador*
*Completed: 2026-07-24*
