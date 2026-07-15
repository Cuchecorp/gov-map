---
phase: 74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly
plan: 02
subsystem: infra
tags: [ingesta, cron, rotacion, round-robin, paginacion, postgrest, supabase, rls, vitest]

# Dependency graph
requires:
  - phase: 74-01
    provides: patrón cursor marcador durable deny-by-default (0053 leylobby_cursor_estado) reutilizado como forma del 0054
  - phase: fichas (v3)
    provides: patrón .order('boletin').range() paginado (writer-supabase.ts:124-143) espejado por leerCorpusPaginado
provides:
  - Cursor de rotación durable del cron leyes-weekly (leyes_rotacion_estado, 0054, singleton id=1)
  - leerCorpusPaginado — lectura paginada del corpus (.order().range()) que resuelve el cap ~1000 de PostgREST
  - seleccionarRotado — selección round-robin pura (agenda-prioridad + ventana rotada wrap-around de la cola)
  - Wire en run-tramitacion-prod-cli: lee offset antes de seleccionar, upserta nuevoOffset después
affects: [cron leyes-weekly (frescura de los 3.657 proyectos), 74-03 (Cloudflare API token CI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lectura paginada .order('boletin').range(from, from+PAGE-1) en loop hasta filas<PAGE → cap 1k PostgREST resuelto (espeja fichas/writer-supabase)"
    - "Cursor de rotación singleton (id int primary key default 1 check (id=1)) deny-by-default, espejando 0053/0021 pero uso interno de cron"
    - "Selección round-robin PURA separada del I/O (rotacion-leyes.ts) → test unitario sin red con fake Supabase >1k filas"
    - "Persistir nuevoOffset por upsert onConflict id=1 tras seleccionar → sucesivas corridas cubren rebanadas distintas"

key-files:
  created:
    - supabase/migrations/0054_leyes_rotacion_estado.sql
    - packages/tramitacion/src/rotacion-leyes.ts
    - packages/tramitacion/src/rotacion-leyes.test.ts
  modified:
    - packages/tramitacion/src/run-tramitacion-prod-cli.ts

key-decisions:
  - "El corpus proyecto se lee COMPLETO paginado (leerCorpusPaginado) — antes .select() sin .range() truncaba 3.657 a ~1000 silenciosamente (T-74-05)"
  - "Cursor deny-by-default (RLS sin policy to anon, sin grant): uso interno de cron, la ficha no lo consulta (T-74-04/T-74-05)"
  - "Singleton reforzado en schema: id int primary key default 1 check (id=1) → una sola fila; upsert onConflict id"
  - "seleccionarRotado excluye de la cola los boletines ya cubiertos por agenda → no gasta doble presupuesto ni duplica"
  - "wrap-around circular sobre la cola + nuevoOffset=(offset+tomados) mod cola.length → round-robin recorre toda la cola en ceil(cola/porRonda) corridas"
  - "fail-loud preservado: error de lectura/upsert LANZA (no []); solo error.message (nunca service key) — T-74-06/T-74-08"
  - "MONEY/SERVEL excluidos por construcción: rotacion-leyes solo opera sobre proyecto/citacion_punto/sesion_tabla_item; test grep de .from('contrato'|'aporte'|'servel'|'chilecompra') = 0 (T-74-07)"
  - "override --boletines y dry-run/sin-credenciales NO consultan ni persisten el cursor (corridas dirigidas / no tocan DB)"
  - "cadencia del cron intacta (no se toca el schedule del YAML); el cursor garantiza cobertura a lo largo de las corridas, minimizando minutos CI"

metrics:
  duration: ~30 min
  tasks: 2
  files: 4
  completed: 2026-07-15
---

# Phase 74 Plan 02: Rotación round-robin del cron leyes-weekly (corpus paginado + cursor 0054) Summary

Cierra DEBT-04: el cron `leyes-weekly` ahora lee el corpus COMPLETO (3.657) vía `.order('boletin').range()` paginado — resolviendo el cap ~1000 de PostgREST que truncaba silenciosamente — y rota round-robin sobre la cola de proyectos sin actividad de agenda mediante un cursor de offset persistido (marcador singleton `leyes_rotacion_estado`, migración 0054), garantizando que ningún proyecto quede indefinidamente sin refrescar sin cambiar la cadencia del cron.

## What Was Built

### Task 1 — Migración 0054 + selección round-robin pura y paginada (commit 5ccdb33)
- **`supabase/migrations/0054_leyes_rotacion_estado.sql`** — tabla marcador singleton (`id int primary key default 1 check (id = 1)`, `offset_rotacion int not null default 0 check >= 0`, `ultimo_boletin text`, `fecha_captura`). RLS habilitada SIN policy `to anon` y SIN grant (deny-by-default, uso interno de cron). Espeja la forma de 0053/0021.
- **`packages/tramitacion/src/rotacion-leyes.ts`**:
  - `leerCorpusPaginado(cliente, tabla)` — `.order('boletin', {ascending:true}).range(from, from+999)` en loop hasta `filas.length < PAGE` (PAGE=1000); espeja `fichas/writer-supabase.ts:124-143`. LANZA ante `error` con solo `error.message`.
  - `seleccionarRotado({agenda, corpus, offset, limite})` — pura: agenda dedup (BOLETIN_RE) primero, cola = corpus menos agenda, toma `limite - agenda.length` desde `offset` con wrap-around circular, devuelve `{seleccion, nuevoOffset}`.
  - `avanzarOffset(offset, n, tamañoCola)` — `(offset+n) mod tamañoCola`, cola vacía → 0.
- **`packages/tramitacion/src/rotacion-leyes.test.ts`** — fake Supabase `.from().select().order().range()` con páginas parametrizables; prueba 2500 filas en 3 páginas (cap 1k resuelto), orden estable antes de range, wrap-around por ids concretos, `avanzarOffset < cola`, fail-loud por throw, cobertura round-robin sobre N corridas, y grep de tablas MONEY/SERVEL = 0.

### Task 2 — Wire de la rotación en run-tramitacion-prod-cli (commit f681459)
- `boletinesARefrescar` reescrita: (1) agenda (`citacion_punto` + `sesion_tabla_item`) como antes; (2) corpus `proyecto` vía `leerCorpusPaginado`; (3) lee `offset_rotacion` de `leyes_rotacion_estado` (id=1, `maybeSingle` → 0 si no hay fila); (4) `seleccionarRotado`; (5) upsert singleton `id=1` con `onConflict: "id"`.
- Preservados: override `--boletines` (retorna antes del gather, no toca el cursor), gate dry-run/sin-credenciales (no persiste), fail-loud (error de read/upsert lanza con solo message), cadencia del YAML. Comentario de cabecera de la función documenta la rotación + paginación. `BOLETIN_RE` muerto eliminado del CLI (la validación vive en `rotacion-leyes`).

## Verification

- `pnpm --filter @obs/tramitacion test` → **168 tests verdes** (18 files).
- `pnpm test` (monorepo completo) → **819 tests verdes** (74 files) — sin regresión.
- `npx tsc -b packages/tramitacion` → exit 0 (sin errores de tipo).
- **Migración 0054 validada en begin/rollback contra Postgres local** (puerto 54322): table crea, `check(id=1)` rechaza id=2, `on conflict (id)` upsert funciona, `relrowsecurity = t`, `count(*) from pg_policies = 0`. Transacción rolled back — NADA persistido, remoto NO tocado.
- `grep` de la migración: `create table leyes_rotacion_estado` + `enable row level security` presentes; las únicas ocurrencias de "to anon" son comentarios (deny-by-default confirmado).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test de exclusión MONEY/SERVEL con falso positivo por prosa de comentarios**
- **Found during:** Task 1 (fase GREEN)
- **Issue:** El primer test de exclusión hacía `expect(src.toLowerCase()).not.toContain("servel")` — pero los propios comentarios del módulo mencionan "MONEY/SERVEL" para DOCUMENTAR la exclusión, disparando un falso positivo.
- **Fix:** El test ahora hace grep de referencias de TABLA reales (`from(['"`]<tabla>`) en vez de la prosa. Afirma la intención correcta (no leer tablas de dinero/padrón) sin prohibir documentarla. Reforzado con reescritura del comentario para no arrastrar los stems `contrato`/`aporte`.
- **Files modified:** packages/tramitacion/src/rotacion-leyes.test.ts, packages/tramitacion/src/rotacion-leyes.ts
- **Commit:** 5ccdb33

**2. [Rule 3 - Blocking] BOLETIN_RE quedó sin uso en el CLI tras mover la validación**
- **Found during:** Task 2
- **Issue:** Al mover la validación de boletines a `seleccionarRotado`, `const BOLETIN_RE` del CLI quedó sin referencias → `tsc` con `noUnusedLocals` habría fallado.
- **Fix:** Eliminada la constante muerta del CLI (la validación bien formada vive ahora en `rotacion-leyes`).
- **Files modified:** packages/tramitacion/src/run-tramitacion-prod-cli.ts
- **Commit:** f681459

## Authentication Gates

Ninguna. Toda la validación fue offline (tests puros + fake Supabase) y local (begin/rollback contra Postgres local en 54322). No se tocó el remoto ni se corrió ningún cron LIVE.

## Known Stubs

Ninguno. La migración 0054 es la superficie DDL completa del cursor; la lógica de rotación está totalmente cableada y testeada. El cursor arranca en `offset=0` (fila ausente → 0) y avanza en cada corrida real del cron.

## Operator Debt

- La **migración 0054 NO fue aplicada al remoto PROD** (validada solo local begin/rollback). Aplicarla por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0054_leyes_rotacion_estado.sql` (NUNCA `supabase db push`) antes de la próxima corrida real del cron leyes-weekly. Sin la tabla, `boletinesARefrescar` LANZARÁ al leer `leyes_rotacion_estado` (fail-loud correcto: el cron sale != 0 hasta que la tabla exista).

## Self-Check: PASSED

- Archivos verificados en disco: 0054 migration, rotacion-leyes.ts, rotacion-leyes.test.ts, run-tramitacion-prod-cli.ts, 74-02-SUMMARY.md → todos FOUND.
- Commits verificados en git log: 5ccdb33 (Task 1), f681459 (Task 2) → ambos FOUND.
