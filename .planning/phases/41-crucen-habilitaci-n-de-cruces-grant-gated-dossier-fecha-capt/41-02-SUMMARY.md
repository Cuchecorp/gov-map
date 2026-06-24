---
phase: 41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt
plan: 02
subsystem: cruces (release valve / Candado A)
tags: [grant-gated, candado-a, deny-by-default, release-migration, pgtap, post-apply]
requires:
  - "0041_cruces_rpc_fecha_captura.sql (la precondición fail-loud exige fecha_captura en el retorno)"
  - "0040_cruces_rpc.sql (el grant que 0042 completa; su assert #3 es el guard de no-apply-prematuro)"
provides:
  - "supabase/migrations/0042_cruces_grant_anon.sql — válvula de release (Candado A) ESCRITA, NO aplicada"
  - "supabase/tests/post-apply/0042_cruces_grant_anon.test.sql — pgTAP de encendido fuera del glob de la suite"
affects:
  - "el día del encendido (operador): aplicar 0042 + post-apply pgTAP + flip CRUCES_PUBLIC_ENABLED"
tech-stack:
  added: []
  patterns:
    - "migración de release inerte en el repo (espejo F17/NET): se commitea, NO se aplica; apply = checkpoint humano"
    - "precondición fail-loud do$$ + raise exception (cultura del repo: cada migración se auto-chequea)"
    - "pgTAP post-apply en subdir post-apply/ para quedar fuera de TODO glob de suite (asierta el estado OPUESTO al guard always-on)"
key-files:
  created:
    - supabase/migrations/0042_cruces_grant_anon.sql
    - supabase/tests/post-apply/0042_cruces_grant_anon.test.sql
  modified: []
decisions:
  - "El guard de no-apply-prematuro NO es código nuevo: es el assert #3 EXISTENTE de 0040_cruces_rpc.test.sql (anon NO execute), dejado SIN cambios. La variante condicional (condicionar el assert a schema_migrations) fue RECHAZADA por el validador como moot + security regression."
  - "0042 NO se aplicó a PROD ni se registró en schema_migrations durante la corrida autónoma (gate 2 LOCKED)."
metrics:
  duration: ~2min
  completed: "2026-06-24"
  tasks: 2
  files: 2
---

# Phase 41 Plan 02: CRUCEN-02 — Grant gated (0042 escrita NO aplicada) Summary

Escrita y commiteada la migración de release `0042_cruces_grant_anon.sql` —la válvula del Candado A que abre el RPC `cruces_de_parlamentario` a `anon`— junto con su pgTAP de encendido en `post-apply/`. **0042 quedó INERTE en el repo: NO se aplicó a PROD ni se registró en `schema_migrations`.** El apply es checkpoint humano post-sign-off legal (CRUCEN-03), espejo del patrón F17/NET.

## Lenguaje obligatorio (CRUCEN-02)

> **CRUCEN-02:** `0042_cruces_grant_anon.sql` fue escrita y commiteada. Contiene la precondición fail-loud + el único `grant execute … to anon` que `0040` omite. **NO fue aplicada a PROD y NO está en `schema_migrations`.** Apply = checkpoint humano post-sign-off CRUCEN-03. Guard de regresión = `0040_cruces_rpc.test.sql` assert #3 (anon NO execute), intacto. El pgTAP de encendido vive en `supabase/tests/post-apply/`, fuera de la suite autónoma.

## What Was Built

### Task 1 — Migración 0042 (grant gated, escrita NO aplicada) + guard fail-loud · commit `a5e410a`

`supabase/migrations/0042_cruces_grant_anon.sql`, verbatim del draft de 41-RESEARCH §CRUCEN-02 (líneas 204-246):

- **Cabecera LOUD** con el banner `████ MIGRACIÓN DE RELEASE — NO APLICAR EN CORRIDAS AUTÓNOMAS ████`, explicando: que es la válvula del Candado A (el único grant que 0040 omite intencionalmente); el **orden de dependencia crítico** (aplicar DESPUÉS de 0041 — un grant antes de 0041 se pierde porque el drop+recreate de 0041 lo descarta); la **regla NO-APLICAR** (se commitea pero no se aplica ni se registra en schema_migrations durante Phase 41; apply = checkpoint humano post-sign-off); y el **orden de encendido** documentado (firmar dossier → aplicar 0042 + fila schema_migrations → post-apply test → flip `CRUCES_PUBLIC_ENABLED`, los 4 juntos).
- **Precondición fail-loud** `do $$ … if not exists (select 1 from pg_proc … 'fecha_captura' = any(p.proargnames)) then raise exception '0042 abortada: 0041 no está aplicada …' end if; end; $$;` — convierte el ordering-trap (aplicar antes de 0041) en error duro en vez de un no-op silencioso.
- **La única acción:** `grant execute on function public.cruces_de_parlamentario(text) to anon;` (firma exacta `(text)`, espejo de `subgrafo_red`/0030:254 y `lobby_de_parlamentario`/0021).

NO se creó ninguna fila en schema_migrations. NO se aplicó. NO se modificó `supabase/tests/0040_cruces_rpc.test.sql`.

### Task 2 — pgTAP post-apply (fuera del glob de la suite) · commit `0ad6f1c`

Creado el directorio `supabase/tests/post-apply/` (nuevo) y dentro `0042_cruces_grant_anon.test.sql`, verbatim del draft 41-RESEARCH (líneas 261-275):

- `begin; select plan(2);`
- (1) `ok(has_function_privilege('anon','public.cruces_de_parlamentario(text)','execute'), 'anon TIENE EXECUTE … Candado A abierto')` — espejo INVERTIDO del 0040 assert #3.
- (2) `is((select p.prosecdef …), true, 'sigue security definer post-0042')`.
- `select * from finish(); rollback;`

Vive en `post-apply/` deliberadamente: ningún glob de suite (vitest globea solo `.test.{ts,tsx}` bajo `lib/`/`components/`/`app/`; no hay runner pgTAP automático que globee `supabase/tests`) lo recoge. Asierta el estado OPUESTO al 0040 assert #3 → fallaría pre-encendido. La cabecera declara `POST-APPLY ONLY — corre tras aplicar 0042` (lo corre el operador a mano el día del encendido).

## El doble candado / guard (sin código nuevo)

El guard de no-apply-prematuro es **el assert #3 EXISTENTE de `0040_cruces_rpc.test.sql`** (anon NO execute), que corre en cada suite y fallaría ante una aplicación prematura de 0042. La variante de condicionar ese assert a `schema_migrations` fue RECHAZADA por el validador (moot + security regression — gutting Candado A). **No se tocó el test de 0040.** Más la precondición fail-loud en 0042 cubre el ordering-trap 0041-antes-de-0042. Y 0042 simplemente nunca se aplica en autónomo.

## Verification

- `grep -c "to anon" 0042_cruces_grant_anon.sql` = 2 (1 en la cabecera explicativa + 1 el grant real) → grant presente.
- `grep -c "raise exception" 0042_cruces_grant_anon.sql` = 1 → guard fail-loud presente.
- `git diff --name-only supabase/tests/0040_cruces_rpc.test.sql` = vacío → guard de no-apply-prematuro INTACTO.
- `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql` existe, `has_function_privilege('anon'` presente, cabecera `POST-APPLY ONLY`.
- Ambos archivos LF-clean (0 CRLF).
- `cd app && npx vitest run` → 298/298 verde (30 files), sin regresión (0042 no toca frontend).

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. 0042 y el post-apply pgTAP se copiaron verbatim del draft de 41-RESEARCH §CRUCEN-02.

## Gate compliance (gates LOCKED de 41-CONTEXT)

- **Gate 1 (NO flipear `crucesPublicEnabled`):** no se tocó ningún flag ni `.env`.
- **Gate 2 (NO aplicar 0042):** ✅ 0042 ESCRITA y commiteada, **NO aplicada a PROD, NO en `schema_migrations`**. Inerte en el repo. Apply = checkpoint humano post-sign-off CRUCEN-03.
- **Gate 3 (NO firmar dossier):** fuera de alcance de este plan (CRUCEN-03).
- **Gate 5 (RPC deny-by-default / Candado A):** el guard always-on (0040 assert #3) queda intacto; la variante condicional fue rechazada.

## Self-Check: PASSED

- FOUND: `supabase/migrations/0042_cruces_grant_anon.sql`
- FOUND: `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql`
- FOUND commit: `a5e410a` (feat 41-02, migración 0042)
- FOUND commit: `0ad6f1c` (test 41-02, post-apply pgTAP)
- CONFIRMED: 0042 NO está en `schema_migrations` (nunca se ejecutó `psql` contra PROD; no hay paso de apply en este plan).
- CONFIRMED: `supabase/tests/0040_cruces_rpc.test.sql` SIN cambios.
