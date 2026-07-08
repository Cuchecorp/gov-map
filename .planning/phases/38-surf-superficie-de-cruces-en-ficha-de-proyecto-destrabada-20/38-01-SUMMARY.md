---
phase: 38-surf-superficie-de-cruces-en-ficha-de-proyecto-destrabada-20
plan: 01
subsystem: cruces-superficie
tags: [rpc, security-definer, pgtap, lockdown-guard, pii-safe, camino-a]
requires:
  - "public.proyecto_ficha.sector_id (0038, poblado 65/74 en PROD)"
  - "public.cruce_senal (0039, deny-by-default, rebuild diario)"
  - "public.voto / public.votacion (0008)"
  - "public.parlamentario / public.sector (0005/0038)"
provides:
  - "RPC public.cruces_de_proyecto(text) — ESCRITA (no aplicada); apply = checkpoint operador Plan 03"
  - "pgTAP 0049 post-apply (10 asserts, fixture rollback)"
  - "tipo CruceProyectoRow PII-safe (app/lib/types.ts) para el consumidor de Plan 02"
  - "cruces_de_proyecto en PUBLIC_RPC_ALLOWLIST (lockdown-guard)"
affects:
  - "Plan 02 (CrucesSection en ficha de proyecto — consume CruceProyectoRow + invoca la RPC)"
  - "Plan 03 (apply operador de 0049 + pgTAP post-apply)"
tech-stack:
  added: []
  patterns:
    - "RPC security definer post-Camino A: doble revoke (from public; from anon,authenticated), CERO grant"
    - "Ruta de sector vía proyecto_ficha.sector_id (Alt B) — cero fabricación, empty honesto sin ficha"
    - "pgTAP post-apply fuera del glob vitest (fixture begin;...;rollback;)"
key-files:
  created:
    - supabase/migrations/0049_cruces_de_proyecto.sql
    - supabase/tests/0049_cruces_de_proyecto.test.sql
  modified:
    - app/lib/types.ts
    - app/lib/lockdown-guard.test.ts
decisions:
  - "Sector del proyecto vía proyecto_ficha.sector_id (Alt B, verificado psql PROD): un sector por proyecto, cero fabricación; boletín sin ficha/sector => 0 filas (empty honesto)"
  - "Voto a favor = seleccion='si' AND estado_vinculo='confirmado' AND parlamentario_id not null (IDENT-12: no arrastra Senado por-nombre no confirmado)"
  - "RPC lee parlamentario/cruce_senal deny-by-default INTERNAMENTE (security definer); emite parlamentario_id + nombre_normalizado (sujeto enlazable /parlamentario/[id]) — NUNCA partido/rut/email"
  - "APPLY a PROD = checkpoint operador (Plan 03, psql --db-url --single-transaction); NUNCA supabase db push; el agente NO aplicó DDL"
metrics:
  duration_min: 5
  tasks: 3
  files: 4
  completed: "2026-07-08T02:00:06Z"
---

# Phase 38 Plan 01: RPC cruces_de_proyecto + contrato PII-safe Summary

RPC `cruces_de_proyecto(p_boletin text)` (security definer, doble revoke, cero grant) que yuxtapone parlamentarios con voto 'si' confirmado del boletín ∩ sus cruces de lobby en el sector del proyecto — escrita y committeada, NO aplicada a PROD (apply = checkpoint operador Plan 03) — más su pgTAP post-apply con fixture rollback, el tipo `CruceProyectoRow` PII-safe y la allowlist del lockdown-guard extendida.

## What Was Built

- **`supabase/migrations/0049_cruces_de_proyecto.sql`** — RPC nueva, idiom ACL byte-espejo de 0048: `drop function if exists` defensivo, `language sql stable security definer set search_path = ''`, todos los nombres calificados con `public.`. Returns table de 8 columnas (`parlamentario_id, nombre_normalizado, sector_id, sector_etiqueta, tipo_senal, conteo, evidencia, fecha_captura`). Cuerpo: CTE `sec` (proyecto_ficha.sector_id) + `afavor` (voto 'si' confirmado, join votacion por boletín) + 4 joins (cruce_senal, sec, afavor, sector, parlamentario) `order by cs.conteo desc, p.nombre_normalizado asc`. Termina con las dos sentencias revoke exactas; CERO grant.
- **`supabase/tests/0049_cruces_de_proyecto.test.sql`** — pgTAP `plan(10)`, fixture `begin;…;rollback;`: contrato (has_function, proargnames pineados a 9, prosecdef, search_path), deny anon, no-PII (`proargnames !~* '\y(partido|rut|email)\y'`), fixture con partido no-null que confirma que el returns table NO lo emite, 1 positivo (PTEST_SURF 'si' confirmado + cruce) y 2 negativos (PTEST_NO votó 'no' → excluido; BTEST-NOSEC sin ficha → 0 filas). Fuera del glob vitest; lo corre el operador post-apply.
- **`app/lib/types.ts`** — `CruceProyectoRow` (8 campos, reutiliza `CruceEvidencia`): `parlamentario_id` enlazable + `nombre_normalizado`, docstring que declara la proyección pública espejo de 0049 (NUNCA rut/partido/email) y `fecha_captura` = frescura del rebuild.
- **`app/lib/lockdown-guard.test.ts`** — `"cruces_de_proyecto"` insertado en `PUBLIC_RPC_ALLOWLIST` en orden alfabético (entre `cruces_de_parlamentario` y `declaraciones_de_parlamentario`). `PII_TABLES` intacto (`cruce_senal` ya presente).

## Verification

- Grep-gate migración: cero `grant … to anon/public`, exactamente 2 `revoke all on function public.cruces_de_proyecto(text)`, `security definer set search_path = ''` presente → exit 0.
- pgTAP structure gate: `plan(10)`, `rollback;`, proargnames pineados, caso `PTEST_NO` presentes → exit 0.
- `pnpm exec vitest run lockdown-guard` → 8/8 verde.
- `pnpm exec tsc -b` → limpio (exit 0).
- `pnpm test` → **670/670 verde** (64 files), baseline mantenido.

## Deviations from Plan

None - plan executed exactly as written.

## Operator Debt (checkpoint Plan 03)

- **Aplicar 0049 a PROD** con `psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0049_cruces_de_proyecto.sql` (PGCLIENTENCODING=UTF8 en Windows). NUNCA `supabase db push` (drift schema_migrations). El agente NO aplicó DDL.
- **Correr el pgTAP post-apply** contra el schema aplicado: `psql -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql "$SUPABASE_DB_URL"` — 10 asserts esperados verdes.
- `tsc`/`pnpm test` NO prueban que Postgres ejecutó el DDL (falso positivo conocido): la única prueba válida es el pgTAP contra el schema aplicado.

## Notes for Next Plan

- Plan 02 consume `CruceProyectoRow` e invoca `sb.rpc("cruces_de_proyecto", { p_boletin })` desde un Server Component (service_role). Degrade honesto: `error?.code === "PGRST202"` → `null` (patrón `lobby-en-tramitacion.tsx:260`, NO el de `cruces-de-parlamentario.tsx`), otro error → throw (#34), 0 filas → empty honesto.
- Demo con filas = **14309-04** (47 parlamentarios en PROD); 14782-13 demuestra el empty honesto (sin sector). Cobertura baja (2 boletines con filas) es estado honesto esperado, no bug.

## Self-Check: PASSED

- Files: 5/5 FOUND (0049 migration, 0049 test, types.ts, lockdown-guard.test.ts, SUMMARY).
- Commits: 3/3 FOUND (8dc674b, 54bea46, 359bbd5).
