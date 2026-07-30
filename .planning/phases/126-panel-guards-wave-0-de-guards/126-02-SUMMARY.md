---
phase: 126-panel-guards-wave-0-de-guards
plan: 02
subsystem: guards (B-03 create view, runner explícito)
tags: [guards, vitest, security_invoker, glob-trap, DEBT-02, PANEL-08]
dependency-graph:
  requires:
    - "126-01: SUPERFICIES_PANEL + IDIOMS_APROBADOS (anti-insinuacion-guard.test.ts)"
  provides:
    - "Guard B-03: detectarViewsSinInvoker sobre supabase/migrations/*.sql (create-view-guard.test.ts)"
    - "Script `guards` en app/package.json con 11 nombres explícitos, cero glob"
    - "Conteo real de guards del monorepo documentado (11 app/ + 6 packages/ = 17)"
  affects:
    - "Phase 127: la 0080 (primera view del milestone) queda blindada por este guard ANTES de existir; debe declarar security_invoker = true"
tech-stack:
  added: []
  patterns:
    - "detector puro sin I/O (detectarViewsSinInvoker), fixtures string inline, sin .sql en supabase/migrations/"
    - "runner de guards por nombre EXPLÍCITO, jamás glob (passWithNoTests:true del vitest.config.ts convertiría un glob roto en 0 tests silenciosos)"
key-files:
  created:
    - app/lib/create-view-guard.test.ts
  modified:
    - app/package.json
decisions:
  - "MATVIEW_ALLOWLIST declarada vacía (const) — sumar una entrada exige decisión explícita futura, no es escape hatch silencioso"
  - "stripSqlComments de este guard es MÁS estricto que el de lockdown-guard.test.ts (también quita -- a mitad de línea y bloques /* */); no se importa, se reproduce module-local"
metrics:
  duration: "~30 min"
  completed: "2026-07-30"
---

# Phase 126 Plan 02: Guard B-03 (create view sin security_invoker) + runner explícito Summary

Crea el guard estático `create-view-guard.test.ts` (B-03, DEBT-02) que falla ante cualquier
`create view`/`create materialized view` en `public` sin `security_invoker`, con control
positivo apareado que demuestra que el cero actual (77 migraciones, 0 views) es fuerte y no
vacuo. Añade el script `guards` a `app/package.json` con los 11 nombres explícitos de guard,
inmune al glob-trap de `passWithNoTests: true`.

## Task 1 — Guard B-03

`app/lib/create-view-guard.test.ts` (nuevo, 212 líneas). Rutas ancladas a
`import.meta.dirname` (jamás `process.cwd()`). Detector puro
`detectarViewsSinInvoker(sql: string): string[]` sin I/O interno:

1. `stripSqlComments` propio (más estricto que el de `lockdown-guard.test.ts`: también
   elimina `--` a mitad de línea y bloques `/* … */`).
2. Split por `;`, match de `create (or replace) (materialized) view (if not exists)
   (public.)?<nombre>`.
3. Solo considera views no calificadas o `public.`-calificadas; ignora otros schemas.
4. `materialized view` → violación SIEMPRE (allowlist `MATVIEW_ALLOWLIST` declarada vacía).
5. `view` normal → verde solo si la misma sentencia matchea
   `with (... security_invoker = true|on)`.

### Resultado del escaneo real

`npx vitest run lib/create-view-guard.test.ts` → **10 passed (10)**:
- `(1)` escaneo real: `archivos.length >= 70` (real: 77) y 0 offenders sobre las 77
  migraciones existentes.
- `(2)` control positivo apareado: 7 fixtures string inline — `create view public.v_x`
  sin invoker (reporta), `create or replace view v_y` no calificado (reporta),
  `create materialized view public.mv_z` (reporta siempre), `security_invoker = true`
  (`[]`), `security_invoker = on` (`[]`), `otro_schema.v_w` (`[]`, fuera de public),
  view comentada con `--` y `/* */` (`[]`, prueba del strip).
- `(3)` mutation self-check: el detector sobre un fixture sin invoker devuelve
  `length > 0` — el mismo código que da 0 en el árbol real SÍ muerde.

### Control negativo del assert anti-vacuo (ejecutado y REVERTIDO)

1. `MIGRATIONS_DIR` apuntado temporalmente a `path.join(APP_ROOT, "lib")` (directorio
   existente, cero `.sql`).
2. Corrida → **FALLA**, verbatim:
   ```
   FAIL  lib/create-view-guard.test.ts > (1) Guard B-03 — escaneo real de supabase/migrations > MIGRATIONS_DIR resuelve al árbol real (cero fuerte, no vacuo por ruta rota)
   AssertionError: MIGRATIONS_DIR mal resuelto — el cero sería vacuo por ruta rota: expected 0 to be greater than or equal to 70
   Tests  1 failed | 9 passed (10)
   ```
3. Revertido `MIGRATIONS_DIR` a `path.join(REPO_ROOT, "supabase", "migrations")` →
   corrida vuelve a **VERDE**, 10 passed (10).

### Verificación de ledger intacto

- `git status --porcelain supabase/migrations` → vacío (ningún `.sql` creado).
- `ls supabase/migrations/*.sql | wc -l` → 77 (baseline intacto, 0080 sigue libre).
- El archivo contiene `import.meta.dirname`; `grep -c process.cwd()` solo matchea el
  comentario que EXPLICA por qué no usarlo (línea 33), no una llamada real.

## Task 2 — Script `guards` + verificación de fase

Añadido a `app/package.json` (única línea nueva, `git diff` confirma cero cambios en
`dependencies`/`devDependencies`): script `guards` con `vitest run` + 11 nombres explícitos,
cero `*`.

### Conteo real de guards (resolución del "14+" del criterio 4)

| Ámbito | Guards | Comando |
|---|---|---|
| `app/` (11 archivos) | 11 | `pnpm guards` → **11 passed (11)**, 321 tests |
| `packages/@obs/dinero` (3 archivos) | 3 | `name-match-rut-guard.behavior.test.ts`, `reconciler-frozen-guard.test.ts`, `servel-frozen-guard.test.ts` → **3 passed (3)**, 34 tests |
| `packages/@obs/llm` (3 archivos) | 3 | `integ-scope-guard.test.ts`, `provider-guard.test.ts`, `tiered-scope-guard.test.ts` → **3 passed (3)**, 7 tests |
| **Total monorepo** | **17** | 17 > 14 → criterio 4 cerrado |

El "14+" del ROADMAP no especificaba si contaba solo `app/` o el monorepo completo; con
11 en `app/` (insuficiente para "14+" solo) el conteo real que cierra el criterio es el
del **monorepo completo: 17 guards ejecutados por nombre explícito, 17 > 14**.

### Verificación de fase completa

- `cd app && pnpm guards` → `Test Files 11 passed (11)`, `Tests 321 passed (321)`.
- `cd app && pnpm test` → `Test Files 108 passed (108)`, `Tests 1607 passed (1607)`
  (baseline 107/1590 → por encima en ambos ejes).
- `pnpm --filter @obs/dinero exec vitest run <3 nombres>` → `Test Files 3 passed (3)`,
  `Tests 34 passed (34)`.
- `pnpm --filter @obs/llm exec vitest run <3 nombres>` → `Test Files 3 passed (3)`,
  `Tests 7 passed (7)`.
- `git diff app/package.json` → una sola línea añadida (script `guards`).
- Los 11 nombres del script existen en disco; `ls app/lib/*guard*.test.ts
  app/components/*guard*.test.ts` lista exactamente los mismos 10 archivos guard + el
  nuevo `create-view-guard.test.ts` = 11, todos declarados en el script.

## Deviations from Plan

None — plan ejecutado exactamente como escrito. Se requirió `pnpm install --prefer-offline`
en la raíz del worktree antes de correr los tests (node_modules del worktree recién creado
no tenía `@testing-library/jest-dom` resuelto; nota heredada del ejecutor de 126-01).

## Self-Check: PASSED
