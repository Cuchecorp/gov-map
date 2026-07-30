---
phase: 123
plan: 02
subsystem: supabase-audit
tags: [audit, schema, rls, grants, read-only, boundary]
requires: ["123-01"]
provides:
  - "123-SUPA-AUDIT-01-SCHEMA-RLS-GRANTS.md (ejes 1-3 con query verbatim y salida real)"
affects: [123-03, 123-04, 123-05, 123-06]
tech-stack:
  added: []
  patterns:
    - "evidencia autoritativa = aclexplode(pg_class.relacl); information_schema.role_table_grants solo como contraste"
key-files:
  created:
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-01-SCHEMA-RLS-GRANTS.md
  modified: []
decisions:
  - "Ejes 1 y 2 conformes con evidencia; eje 3 offender por ALTER DEFAULT PRIVILEGES de supabase_admin en public"
  - "Q-11 (anon con USAGE sobre public) se clasifica limite-declarado, NO offender: revocarlo es arquitectura de plataforma, no fix aditivo"
  - "OFF-02 (guard ciego a alter default privileges) se separa de OFF-01: guard cubre regresion futura, 124 cierra el ACL vivo"
metrics:
  duration: "~20 min"
  completed: 2026-07-29
  tasks: 3
  commits: 1
---

# Phase 123 Plan 02: Ejes 1-3 (Schema · RLS · Grants) — Summary

El boundary de tablas está **cerrado en el presente y abierto en el futuro**: 57/57 tablas con RLS,
cero policies `to anon`, cero grants a `anon` — todo demostrado con la query — pero un
`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public` vivo concede `arwdDxtm` a `anon`
sobre **toda tabla futura** que ese rol cree, y el guard estático es ciego a esa clase de sentencia.

## Qué se hizo

Un único artefacto, `123-SUPA-AUDIT-01-SCHEMA-RLS-GRANTS.md` (commit `1b75d23`), con las **13 queries
`Q-01`…`Q-11`** (incluidas `Q-08b`/`Q-09b`) transcritas verbatim y su **salida real** debajo, más dos
consultas de método adicionales (membresías del rol de conexión, y la corrida del guard).

Las tres tasks escriben el mismo archivo y se materializaron en **un commit atómico** en vez de tres:
el fragmento se redactó de una sola pasada tras recoger toda la evidencia SQL. Se declara aquí por
transparencia; no hubo trabajo sin commitear.

## Resultado por eje

| eje | veredicto | evidencia |
|-----|-----------|-----------|
| 1 Schema | `conforme` | `Q-01` 57 filas todas `relrowsecurity=t`; `Q-02` `(0 filas)`; `Q-03` `(0 filas)` |
| 2 RLS | `conforme` | `Q-04` 5 policies; `Q-05`/`Q-06`/`Q-07` `(0 filas)` |
| 3 Grants | **`offender` (2)** | `Q-08b`/`Q-09b` conformes; **`Q-10` destapa el default ACL de `supabase_admin`** |

### Hechos que valen la pena retener

- **`Q-03` = `(0 filas)`**: `public` no tiene **ninguna vista ni matview propia**. Elimina por
  construcción el sub-chequeo de vistas `SECURITY DEFINER` (Splinter **0010**) del eje 5.
- **`Q-05` = `(0 filas)`**: la "superficie pública real" de la lección v4.0 (policies `to anon`) está
  **vacía**. Las 5 policies vivas son todas `to authenticated` sobre `suscripcion`/`consentimiento`,
  trazadas a `0069` y `0071`.
- **55 de 57 tablas tienen RLS on y CERO policies** ⇒ deny-by-default absoluto.
- **Grant y policy encajan 1:1** en las 2 tablas de-usuario (`SELECT`+`INSERT`+`DELETE` en
  `suscripcion`, `SELECT`+`INSERT` en `consentimiento`). Cero `UPDATE`, cero over-grant huérfano.
- **`0044` está vivo y correcto** para el rol `postgres`: `postgres | public | r` = `{postgres,
  service_role}`, sin `anon`. El pipeline de migraciones corre como `postgres`, de ahí el
  `Q-09b` vacío.
- **Guard estático 22/22 verde y coincide con la DB viva** en Block A/D: **no hay punto ciego** en el
  eje que el plan anticipaba como caliente. El punto ciego real es otro (ver `OFF-02`).

## Offenders

| # | objeto | eje | riesgo | destino |
|---|--------|-----|--------|---------|
| OFF-01 | `default-acl · supabase_admin en schema public (r, f, S)` | 3 | Toda tabla/función/secuencia futura creada por `supabase_admin` en `public` nace con `arwdDxtm`/`EXECUTE` para `anon` ⇒ PII legible por cliente no autenticado sin ningún `GRANT` en el repo que lo delate (`anon` ya tiene `USAGE`, `Q-11`) | `124-aditivo` |
| OFF-02 | `guard · app/lib/lockdown-guard.test.ts (Block A/D)` | 3 | El guard solo caza `grant … to anon/authenticated` en texto; es ciego a `alter default privileges` ⇒ una migración futura podría abrir toda tabla futura **con CI en verde** | `guard` (→ 123-05) |

`OFF-01` lleva escrito su propio escape: **si el `alter default privileges for role supabase_admin`
falla por falta de membresía, NO se fuerza ni se escala privilegio — se reclasifica a
`deuda-operador`**.

Además un **`limite-declarado`**: `Q-11` muestra que `anon` tiene `USAGE` sobre `public`. No se marca
offender porque revocarlo es arquitectura de plataforma (PostgREST resuelve la Data API por ahí), no
un fix aditivo. Se entrega a 123-06 para que decida si escala.

## Desviaciones (RULE-1: manda la realidad)

**1. [RULE-1] El plan asumía superficie `to anon` existente; en PROD es VACÍA.**
- **Antes (plan/contexto v4.0):** "la superficie pública real son las policies `to anon`"; `Q-05`
  debía producir filas con columna `¿esperada?` citando su migración.
- **Después:** `Q-05` = `(0 filas)`. La tabla `¿esperada?` se pobló, como manda el criterio de
  aceptación, sobre las **5 policies reales de `Q-04`** (todas `to authenticated`), con `Q-05`
  registrada explícitamente como `(0 filas)`.
- **Consecuencia que hereda 123-04:** con cero policies `to anon` y cero grants a `anon`, el guard CI
  no es *una* capa del boundary público — es **la única**. Sube la criticidad del eje 6.

**2. [RULE-1] El falso negativo de `role_table_grants` NO se materializó, y eso refuerza la advertencia.**
- **Antes:** el plan advertía que la vista podía devolver `(0 filas)` sin probar nada.
- **Después:** se ejecutó la comprobación del supuesto: `current_user` = `postgres`, **miembro de
  `anon`, `authenticated` y `service_role`** ⇒ la vista no ocultó nada y `Q-08`≡`Q-08b`,
  `Q-09`≡`Q-09b`. Se documentó que **la coincidencia es un accidente del privilegio de esta
  conexión, no una propiedad de la vista**, y el veredicto se apoya igualmente solo en `Q-08b`/`Q-09b`.

**3. [RULE-1] El eje 3 esperaba (o no) offenders en grants; el offender real está en los DEFAULTS.**
- **Antes:** el plan enfocaba `Q-09`/`Q-09b` como el detector caliente, con `Q-10` como control
  secundario ("¿re-abre lo que 0044 revocó?").
- **Después:** `Q-09b` salió limpia y **`Q-10` fue quien destapó todo**. `0044` revocó los defaults
  de `postgres` pero **nunca tocó los de `supabase_admin`**, que siguen concediendo todo a `anon` en
  el **mismo esquema `public`**. El riesgo es latente (ninguna tabla actual lo tiene) pero se abre
  solo, sin línea de código que lo delate.

**4. [RULE-1] El punto ciego del guard existe, pero NO es el que el plan anticipaba.**
- **Antes:** el plan preveía "guard verde + `Q-09b` con filas ⇒ punto ciego confirmado".
- **Después:** ambos dieron 0 ⇒ **sin divergencia** en Block A/D. El punto ciego encontrado es de
  **cobertura de idiom**: el guard no vigila `alter default privileges`. Se registró como `OFF-02`
  con `destino: guard` (no como la divergencia que el plan describía), con su límite escrito: el
  guard es estático sobre el repo y no puede ver el ACL vivo de `supabase_admin` — esa mitad la
  cierra `OFF-01` en 124.

**5. [RULE-1] Tres filas de `Q-10` caen fuera del alcance de este plan y se derivan al eje 6.**
- `postgres | storage | {r,f,S}` conceden todo a `anon`/`authenticated` por default en el esquema
  **`storage`**. §0.6(D) del método acota este fragmento a `public` ⇒ se entregan a 123-04, cruzadas
  con el hallazgo de 123-01 (`storage.buckets` vacío en PROD): **el orden importa** — crear un bucket
  antes de cerrar ese default lo nace público.

## "0 offenders" demostrados

`Q-02`, `Q-03`, `Q-05`, `Q-06`, `Q-07`, `Q-09b` y `Q-09` — las siete con su bloque ```sql verbatim y
su `(0 filas)` transcrito junto a la query, según la regla dura de §0.1. Ninguna afirmación de
conformidad de este fragmento carece de query.

## Qué hereda cada plan

- **123-03 (ejes 4-5):** `Q-03` vacía cierra el sub-chequeo de vistas secdef en `public`; la fila `f`
  de `OFF-01` obliga a enumerar el `proacl` **vivo** de las 42 funciones en vez de confiar en el default.
- **123-04 (eje 6):** el guard CI es la **única** capa del boundary público; `Q-05` no aporta filas
  que cruzar; **las 3 filas `storage` de `Q-10`** son suyas; `Q-11` queda como `limite-declarado`.
- **123-05 (guards):** `OFF-02` es su entrada — extender el guard a `alter default privileges … to
  anon|public|authenticated` en migraciones > 0044, manteniendo el baseline **22/22 verde**. Debe
  quedar hecho **antes** de que 124 aplique `OFF-01`.
- **123-06 (veredicto):** ejes 1-2 `conforme` con evidencia completa; eje 3 `offender` (2 filas) +
  1 `limite-declarado`. Splinter **0007** y **0013** reclamados sin hallazgo (`Q-06`+`Q-02`);
  **0010** sin hallazgo en `public` (`Q-03`), cierre formal en 123-03. Preservar la nota de método
  `aclexplode`-primero para toda re-auditoría futura.

## Known Stubs

Ninguno. Cada sección lleva su query y su salida real; no hay veredicto sin evidencia ni celda
rellenada por suposición.

## Threat Flags

Ninguno. Este plan no introdujo superficie: cero endpoints, cero rutas de auth, cero cambios de
schema. El artefacto es documentación versionada, greppeada contra fuga de credenciales
(connection strings, claves secretas/publicables, prefijo JWT, `SERVICE_ROLE_KEY`) → limpio.
Los threats `T-123-04`/`T-123-05` del plan se **materializaron** y quedan registrados como
`OFF-01`/`OFF-02` con fix propuesto no aplicado (mitigación = Phase 124/123-05).

## Verificación

- Los tres bloques `<automated>` del plan (Task 1, 2 y 3) → `OK1`, `OK2`, `OK3`.
- Las 13 etiquetas `Q-01`…`Q-11` (con `Q-08b`/`Q-09b`) presentes en el fragmento → sin faltantes.
- Escáner anti-secreto sobre el artefacto → `SIN-SECRETOS`.
- `git status --porcelain supabase/ app/` → **vacío**. Cero DDL, cero DML, cero deploy, cero flags:
  solo `SELECT` read-only contra PROD.
- Guard lockdown: `pnpm exec vitest run lib/lockdown-guard.test.ts` → **22/22**; suite completa de
  `app` → **107 archivos / 1577 tests** verdes.

## Self-Check: PASSED

- FOUND: `.planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-01-SCHEMA-RLS-GRANTS.md`
- FOUND: commit `1b75d23`
