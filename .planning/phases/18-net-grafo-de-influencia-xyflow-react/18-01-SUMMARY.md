---
phase: 18-net-grafo-de-influencia-xyflow-react
plan: 01
subsystem: NET — grafo de influencia (data model / Candado A)
tags: [postgres, rls, pg_cron, recursive-cte, rpc, pii-safe, anti-insinuacion, gated-off]
status: code-complete-apply-pending
requires:
  - parlamentario (0005) maestra deny-by-default
  - lobby_audiencia / lobby_contraparte (0021) hechos fuente + estado_vinculo='confirmado'
  - pg_cron (0003) scheduler + version-guard idiom
provides:
  - entidad/arista deny-by-default (Candado A del doble candado NET)
  - net.materializar_aristas() proc idempotente (pg_cron)
  - subgrafo_red(text,int,text[],timestamptz,timestamptz) RPC PII-safe depth-clamped
affects:
  - Plan 02 (net-gate.ts Candado B + ruta /red)
  - Plan 03 (UI xyflow client island)
tech-stack:
  added: []
  patterns:
    - deny-by-default RLS (enable + 0 policies + revoke all from anon,authenticated) — espejo 0018/0021
    - security definer set search_path='' RPC PII-safe — espejo 0019/0020
    - pg_cron version-guard + post-migration cron.job assertion — espejo 0003
    - recursive CTE depth-clamp 1..2 in-SQL + seed-required (no seedless enumeration)
key-files:
  created:
    - supabase/migrations/0030_net.sql
    - supabase/tests/0030_net.test.sql
  modified: []
decisions:
  - "Taxonomía MVP = UNA sola arista co_lobby_contraparte; co_votacion EXCLUIDO (explosión de clique ~12k aristas/votación + lectura hairball conspirativa, anti-insinuación 17-DOSSIER §2)"
  - "check (tipo in ('co_lobby_contraparte')) = allow-list de un solo tipo; agregar otro exige migración (fricción correcta)"
  - "both-confirmado garantizado ESTRUCTURALMENTE por FK arista→entidad (entidad nace solo de identidades confirmadas) + filtro estado_vinculo='confirmado' en el proc (belt-and-suspenders)"
  - "licencia per-row SIN default (17-DOSSIER §6); co-lobby deriva de leylobby → licencia NULL (NUNCA 'CC BY 4.0')"
  - "subgrafo_red exige semilla p_id; NO hay variante seedless whole-graph (evita enumeración — espejo WR-03/0025)"
  - "depth clamp 1..2 in-SQL (least(greatest(coalesce(p_depth,1),1),2)); nunca walk unbounded (DoS + cadenas profundas se leen como insinuación)"
  - "join-key de contraparte = lower(trim(nombre)); limitación conocida (OQ3: lobby_contraparte sin id autoritativo en P11), pineada en pgTAP con caso negativo"
metrics:
  duration: ~3min
  completed: 2026-06-21
  tasks_completed: 2
  tasks_total: 3
  files: 2
---

# Phase 18 Plan 01: NET data model (entidad/arista + proc + RPC) Summary

Modelo de grafo-como-Postgres de NET (NET-01) materializado en la migración `0030_net.sql` + su pgTAP `0030_net.test.sql`: dos tablas deny-by-default (`entidad` nodos, `arista` aristas), el proc idempotente `net.materializar_aristas()` invocado por `pg_cron`, y el RPC público `subgrafo_red` con CTE recursiva PII-safe (solo id/nombre/camara, depth clamp 1..2, semilla obligatoria). Candado A (datos) del doble candado NET; nada se expone — las tablas son deny-by-default y el RPC nace sin consumidor. **Code-complete; la aplicación al Postgres remoto es un checkpoint de operador pendiente (Task 3).**

## What Was Built

### Task 1 — `supabase/migrations/0030_net.sql` (commit `2732c53`)
- **`entidad`** (nodo identidad-only): `id` = `parlamentario.id`, FK a `parlamentario`, `tipo` default `'parlamentario'`, `unique(parlamentario_id)`. SIN partido/rut/email. RLS on + 0 policies + `revoke all from anon, authenticated`.
- **`arista`** (hecho público tipado): `check (tipo in ('co_lobby_contraparte'))` allow-list de un solo tipo; `extremo_a/extremo_b` FK a `entidad` (garantía estructural both-confirmado); `contexto_clave/contexto_detalle`; ventana `desde/hasta`; provenance inline NOT NULL (`dataset/origen/fecha_captura/enlace`); `licencia text` SIN default; `check (extremo_a < extremo_b)` (orientación canónica); `unique (tipo, extremo_a, extremo_b, contexto_clave)` (idempotencia). RLS on + 0 policies + `revoke all`. Índices en extremo_a/extremo_b/tipo.
- **`net.materializar_aristas()`** `security definer set search_path=''`: (1) inserta `entidad` de cada parlamentario con audiencia confirmada; (2) inserta aristas `co_lobby_contraparte` entre dos confirmados que recibieron audiencia de la misma contraparte (join por `lower(trim(nombre))`), `on conflict do nothing`. NO incluye bloque co_votacion.
- **`cron.schedule('net-materializar-aristas', '17 3 * * *', ...)`** con guard de versión pg_cron + bloque `do $$ raise exception if not exists in cron.job $$` (espejo 0003).
- **`subgrafo_red(p_id, p_depth, p_tipos[], p_desde, p_hasta)`** `returns jsonb language sql stable security definer set search_path=''`: CTE recursiva con clamp `least(greatest(coalesce(p_depth,1),1),2)`, filtros por tipo/ventana, nodos proyectados a SOLO id/nombre/camara (espejo 0020), aristas con provenance. `revoke execute from public` + `grant execute to anon`.

### Task 2 — `supabase/tests/0030_net.test.sql` (commit `60ac5ff`)
`begin; select plan(16); ... finish(); rollback;`. Siembra 4 parlamentarios confirmados + audiencias + contrapartes, corre `net.materializar_aristas()`. Asserts: entidad/arista existen con RLS + 0 policies; proc y RPC son security definer; anon tiene EXECUTE; anon lee 0 filas de entidad/arista directo; el cuerpo del RPC y su salida no contienen `partido`/`rut`; la arista lleva `dataset/desde/hasta/enlace`; clamp efectivo (depth=2 == depth=99 node set). **Plan-checker MEDIUM-2 incorporado:** caso happy-path (nombres normalizados idénticos → EXACTAMENTE una arista) + caso negativo (variantes "Fundación X" vs "Fundacion X A.G." NO se funden bajo `lower(trim(nombre))` → cero arista — limitación OQ3 pineada).

## Deviations from Plan

**1. [Rule 3 — Blocking] `grant execute` formateado con espacio simple**
- **Found during:** Task 1 verificación automatizada.
- **Issue:** El grep literal de la Task buscaba `'grant execute'` (un espacio); la línea estaba alineada con dos espacios (`grant  execute`).
- **Fix:** Espacio simple en `grant execute on function public.subgrafo_red(...) to anon;`.
- **Files modified:** supabase/migrations/0030_net.sql
- **Commit:** 2732c53

Sin otras desviaciones. El test usa el path `supabase/tests/0030_net.test.sql` (per frontmatter `files_modified` del plan), no `0031` (que la sección §Validation del RESEARCH mencionaba como alternativa).

## Operator Apply Status

**La migración 0030 NO ha sido aplicada al Postgres remoto.** Task 3 es un checkpoint de operador (`checkpoint:human-action`, gate=blocking): aplicar por `psql --db-url` directo (NUNCA `supabase db push` — drift de `schema_migrations` remoto registra ≤0025) + correr el seed + el pgTAP + confirmar el cron job + loguear el conteo de aristas materializadas. Comandos exactos en el mensaje de CHECKPOINT del ejecutor.

## Self-Check: PASSED

- FOUND: supabase/migrations/0030_net.sql
- FOUND: supabase/tests/0030_net.test.sql
- FOUND commit: 2732c53 (Task 1)
- FOUND commit: 60ac5ff (Task 2)
- Grep negativo anti-insinuación: 0 ocurrencias de `co_votacion` y 0 de `default 'CC BY 4.0'` en el cuerpo no-comentario de 0030_net.sql.
