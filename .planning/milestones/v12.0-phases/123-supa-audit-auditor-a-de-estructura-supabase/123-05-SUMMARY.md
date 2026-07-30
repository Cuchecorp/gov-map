---
phase: 123-supa-audit
plan: 05
subsystem: seguridad / guards CI
tags: [lockdown, guard, supabase, boundary, anti-regresion]
requires: ["123-02", "123-03", "123-04"]
provides: ["guard estatico contra OFF-02, OFF-4-05 y OFF-6-05c", "123-SUPA-AUDIT-04-GUARDS.md"]
affects: ["app/lib/lockdown-guard.test.ts", "Phase 124 (baseline f_unaccent a limpiar)"]
tech-stack:
  added: []
  patterns: ["detector puro + mutation self-check (fixture positivo/negativo/comentario)", "baseline congelada comparada por IGUALDAD (muerde en ambas direcciones)"]
key-files:
  created:
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-04-GUARDS.md
  modified:
    - app/lib/lockdown-guard.test.ts
decisions:
  - "Rama A adjudicada: tres puntos ciegos (OFF-02, OFF-4-05, OFF-6-05c), no uno"
  - "Direction-C DESCARTADA con evidencia: Block A es superconjunto y el chequeo ingenuo daria 9 falsos positivos"
  - "La deuda de f_unaccent se CONGELA visible en CI (KNOWN_MISSING_REVOKE_FROM_PUBLIC), no se silencia"
metrics:
  duration: "~1h"
  completed: 2026-07-29
---

# Phase 123 Plan 05: Extensión de guards ("guard primero") Summary

Tres puntos ciegos del único control del boundary público quedaron cerrados con aserciones estáticas
que muerden — `alter default privileges`, `create function` sin su `revoke … from public`, y
extensiones instaladas en `public` — sin tocar una sola migración.

## Qué se hizo

`app/lib/lockdown-guard.test.ts` creció **498 líneas, 0 borradas** (extensión estrictamente aditiva;
los `describe` y constantes preexistentes conservan sus líneas: `:322`, `:454`, `:546`, `:614`,
`:694`, `:749`). Tres bloques nuevos:

| bloque | vector cubierto | offender que cierra | assert (scan real) |
|---|---|---|---|
| **(A4)** | `alter default privileges … grant … to anon\|public\|authenticated` en migración >0044 | `OFF-02` (fragmento 01, `Q-10`) | `lockdown-guard.test.ts:939` |
| **(A5)** | `create function` en `public` sin su `revoke {all\|execute} … from public` | `OFF-4-05` (fragmento 02, `Q-15` + `comm -13`) | `:1119` |
| **(A6)** | `create extension` en `public` fuera de `{vector, unaccent}` | `OFF-6-05c` (fragmento 03, `Q-24b`/`Q-24c`) | `:1271` |

Los tres detectores son **funciones puras** (`alterDefaultPrivilegesOffenders` `:919`,
`missingRevokeFromPublicOffenders` `:1055`, `publicExtensionOffenders` `:1235`), reutilizan
`stripSqlComments` / `migrationNumber` / `MIGRATIONS_DIR` y no duplican lógica de parsing.

## Qué mutación demuestra que muerden

**En memoria (self-check por bloque):** fixture (a) POSITIVO ⇒ offender, (b) NEGATIVO ⇒ 0 offenders,
(c) COMENTARIO ⇒ 0 offenders — este último prueba que `stripSqlComments` está en el camino y que la
prosa de un header no auto-invalida el guard (el modo de fallo que ya mordió a este proyecto con los
139 falsos positivos de `check_drift.sh` por la frase `NUNCA supabase db push`).

**Contra el disco real (inyectar → rojo; restaurar → verde):** se creó
`supabase/migrations/9999_mutation_probe.sql` con los tres vectores simultáneos ⇒ **5 tests rojos**,
incluidos los tres nuevos, cada uno nombrando el archivo ofensor. Segunda sonda
(`9998_probe_deuda_pagada.sql`, con el revoke de `f_unaccent`) ⇒ **(A5) rojo también**, demostrando
que la baseline muerde en la dirección inversa. Ambas sondas eliminadas;
`git diff --quiet -- supabase` → **exit 0**; guard de vuelta en **31/31 verde**.

## La baseline congelada (enganche con la Phase 124)

El detector (A5), contra el repo real, encuentra **exactamente un** offender:
`0055_busqueda_hibrida.sql: f_unaccent` — que es **`OFF-4-01`/`OFF-5-01`**, la única función de
`public` invocable por `anon` vía `/rest/v1/rpc/f_unaccent` (`Q-15`: ACL `=X/postgres`). Guard
estático y catálogo vivo convergen en el mismo nombre por dos vías independientes.

Como este plan tiene prohibido tocar `supabase/`, la deuda se **congela a la vista** en
`KNOWN_MISSING_REVOKE_FROM_PUBLIC` y se compara por **igualdad**, no por subconjunto: si sobra una
entrada hay regresión; si falta, es que la Phase 124 pagó la deuda y **debe borrar la entrada**. Una
baseline que se limpia sola es una baseline que se olvida.

## Deviations from Plan

### 1. [RULE-1 — la realidad manda] Direction-C descartada; tres bloques distintos en su lugar

- **Encontrado durante:** Task 1 (adjudicación).
- **Qué decía el plan:** implementar Direction-C — «`grant execute … to anon` extraído de las
  migraciones ⊆ `PUBLIC_RPC_ALLOWLIST`» — como candidato prioritario.
- **La realidad:** sería **estrictamente más débil** que el Block A ya existente, que prohíbe
  **cualquier** `grant … to anon|public` en migraciones >0044 esté o no en la allowlist — su propio
  fixture caso (a) `:378` lo ejercita con una RPC **allowlisted**. Un chequeo `⊆ allowlist`
  *admitiría* ese grant y reintroduciría de facto la exención de Phase 51 que el proyecto ya revirtió
  (CR-01/CR-03). Aplicado repo-wide, además, daría **9 falsos positivos** (los grants de `0011`–`0024`
  revocados después por `0044`/`0045`; `Q-12` da `exec_anon = f` para los nueve).
- **Qué se hizo en su lugar:** implementar los **tres offenders que la auditoría sí ruteó a
  `destino: guard`** — `OFF-02`, `OFF-4-05`, `OFF-6-05c` — que no tenían **ninguna** aserción. La
  celda `¿?` de la tabla de cobertura se resuelve citando Block A (`:322` + `:378`) como superconjunto
  del chequeo propuesto, con la justificación escrita.
- **Archivos:** `123-SUPA-AUDIT-04-GUARDS.md` §"Direction-C: por qué NO se implementa".
- **Commit:** `1099907`.

### 2. [RULE-3 — desbloqueo] (A5) habría nacido rojo; se resolvió con baseline, no debilitando el detector

- **Encontrado durante:** Task 1 (probe del detector contra el repo antes de escribir el guard).
- **Issue:** el detector honesto encuentra `f_unaccent` en `0055`. Dejar el guard rojo viola
  "suite verde"; arreglar `0055` viola "cero migración tocada".
- **Fix:** constante `KNOWN_MISSING_REVOKE_FROM_PUBLIC` con comparación por **igualdad** y mensaje que
  instruye a borrarla cuando la deuda se pague. El **detector no está exento de nada**: caza el
  `f_unaccent` real; la baseline es la resta explícita, fuera del detector.
- **Commit:** `0bd514e`.

### 3. [RULE-1 — decisión de scope] (A5) tolera el revoke en migración posterior; (A6) se scopea a >0044

- `(A5)`: la auditoría pedía "en la misma migración". Se relajó a "en la misma **o en cualquier
  otra**" — es la única forma de que el fix aditivo de la Phase 124 (`0073+`) pueda limpiar la
  baseline sin reescribir una migración ya aplicada a PROD.
- `(A5)`: se **excluyen** funciones de esquemas distintos de `public` (`cruces.materializar_cruces` de
  `0052`, `actualidad.materializar_senales` de `0065`): no viven en el esquema que PostgREST expone.
  Sin ese filtro el bloque nacería rojo por dos falsos positivos.
- `(A6)`: scope `>0044`, igual que Block A/D/E. `0001_extensions.sql` instala `pg_cron`/`pg_net`/`pgmq`
  en `public` — historia congelada pre-lockdown; `pg_net` ya está ruteada como `OFF-6-03`. Un scope
  repo-wide nacería rojo por historia, la misma trampa de polaridad de `check_drift.sh`.

## Límites declarados (no se finge cobertura)

| # | vector | por qué es incubrible estáticamente | quién lo cierra |
|---|---|---|---|
| LIM-05-01 | ACL vivo del default de `supabase_admin` sobre `public` (`Q-10`) | no proviene de ninguna migración: es bootstrap de plataforma | `OFF-01` → Phase 124 (o `deuda-operador`) |
| LIM-05-02 | las **1.209** funciones de extensión exec-`anon` ya instaladas (`pgtap` 1.079, `vector` 118, `unaccent` 4) | ninguna se instala desde el repo; (A6) solo impide que entre **una nueva** | `OFF-6-01`/`OFF-6-02` → `supabase-architect+checkpoint` |
| LIM-05-03 | `USAGE TO PUBLIC` sobre `public` y `net` (`Q-11`, `Q-22b`) | catálogo vivo, sin origen en el repo | `OFF-6-03` → Phase 124 |
| LIM-05-04 | el `EXECUTE TO PUBLIC` **ya materializado** sobre las 8 fn de `Q-15` | (A5) impide la regresión futura y congela la deuda; no revoca nada | `OFF-4-01`/`OFF-4-02` → Phase 124 |

**Regla rectora:** extender el guard **no cierra** los offenders existentes; **impide la regresión
futura**. Ninguno sustituye al otro.

## Suite, tsc y guards

| métrica | antes | después |
|---|---|---|
| `lib/lockdown-guard.test.ts` | 22 | **31** ✅ |
| suite completa de `app/` | 1577 (107 archivos) | **1586 (107 archivos)** ✅ `>= 1577` |
| `pnpm exec tsc --noEmit` | 0 | **0** ✅ |

Comandos reales (`cwd = app/`): `pnpm exec vitest run lib/lockdown-guard.test.ts`, `pnpm test`
(= `vitest run`), `pnpm exec tsc --noEmit`. La suite se corrió con `set -o pipefail` (un `| tail` sin
`pipefail` devuelve el status del `tail` y enmascararía una suite roja) — `EXIT=0`.

Los guards de régimen (anti-flip MONEY/VSIM/NOTIF, anti-insinuación, name-match-rut, env-example,
bento, cruces-gate, money-gate) están dentro de los 107 archivos verdes: **ningún flag se tocó**.

## Lo que este plan NO hizo

Cero migraciones (`git diff --quiet -- supabase` → **0**), cero DDL/DML (no se abrió conexión a
Postgres), cero deploy, cero flags, cero fixes de estructura. `OFF-01`, `OFF-4-01`..`OFF-4-04`,
`OFF-5-01`, `OFF-6-01`..`OFF-6-04` **siguen ruteados** a la Phase 124 / `supabase-architect+checkpoint`.

## Known Stubs

Ninguno. La única "deuda declarada" es `KNOWN_MISSING_REVOKE_FROM_PUBLIC`, que es deliberada,
documentada, visible en CI y con instrucción de limpieza en el mensaje de fallo.

## Self-Check: PASSED

- `123-SUPA-AUDIT-04-GUARDS.md` → FOUND
- `app/lib/lockdown-guard.test.ts` → FOUND (498+/0-)
- commit `1099907` (fragmento) → FOUND
- commit `0bd514e` (guard) → FOUND
- `git diff --quiet -- supabase` → exit 0
