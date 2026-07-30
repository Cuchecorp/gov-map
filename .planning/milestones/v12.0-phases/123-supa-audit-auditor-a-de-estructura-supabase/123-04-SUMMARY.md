---
phase: 123
plan: 04
subsystem: seguridad-datos
tags: [supabase, auditoria, boundary, storage, extensiones, guards, pgtap]
requires: ["123-01", "123-02", "123-03"]
provides: ["123-SUPA-AUDIT-03-EXPOSICION-GUARDS.md", "eje-6", "mapa-puntos-ciegos-guard"]
affects: ["123-05", "123-06", "124", "125"]
tech-stack:
  added: []
  patterns: ["SQL read-only sobre catálogos", "probe de control con SET ROLE", "cero fuerte vs cero vacuo", "excepción §0.6 E al filtro deptype='e'"]
key-files:
  created:
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-03-EXPOSICION-GUARDS.md
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-04-SUMMARY.md
  modified: []
decisions:
  - "El filtro pg_depend deptype='e' ocultó la superficie anon más grande del proyecto: se invocó la excepción §0.6 E y se auditaron las extensiones de public"
  - "pgtap en PROD en el esquema public es offender supabase-architect+checkpoint, no se diseña el fix aquí"
  - "vector y unaccent en public NO se mueven (romperían tipos e índices HNSW): se documenta la excepción"
  - "El bucket crudo-servel NO se crea: es deuda-operador y va DESPUÉS de cerrar OFF-6-04"
metrics:
  duration: "~50 min"
  completed: "2026-07-29"
  tasks: 2
  commits: 3
---

# Phase 123 Plan 04: Eje 6 (exposición) + auditoría del guard CI Summary

Auditoría del eje 6 contra PROD que destapa que la superficie `anon` real del esquema `public` no son
las 8 funciones residuales del fragmento 02 sino **1.209**, porque el filtro `deptype='e'` obligatorio
del método ocultó **1.079 funciones de `pgtap` ejecutables por `anon`** en el esquema que PostgREST
expone — demostrado con una ejecución real (`set role anon; select public.pg_version()` → `17.6`), no
con una inferencia de ACL — más el mapa de los seis puntos ciegos del guard CI, que es la **única**
capa del boundary del sitio ahora que `Q-23` prueba en catálogo que `service_role.rolbypassrls = t`.

## Qué se hizo

**Task 1 — Eje 6 lado DB** (commit `7d74dd4`). `Q-20`..`Q-24` transcritas verbatim con su salida real,
más tres queries de apoyo (`Q-22b` ACL crudo de esquemas, `Q-24b` superficie `anon` de extensiones,
`Q-24c` probe de control con `SET ROLE`). Cinco offenders y dos `limite-declarado`.

**Task 2 — El guard CI como control efectivo** (commit `977edf9`). Mapa del boundary con una fila por
bloque (A, B, D, E, A2/Direction-B, A3), cada `archivo:línea` verificado contra el fuente y cada celda
"qué NO ve" razonada contra hallazgos reales de los fragmentos `-01`/`-02` con su `Q-NN`. Corrida real
de 14 guards. Escáneres de secretos y de drift, saneados y clasificados hallazgo por clase.

## Offenders del eje 6

| # | objeto | riesgo (resumen) | destino |
|---|---|---|---|
| `OFF-6-01` | `extensión · pgtap` en `public` (1.087 obj / **1.079 fn exec-`anon`**) | divulgación de estructura a `anon`: enumeración de tablas, columnas y funciones sin ningún grant. Extensión de **testing** en PRODUCCIÓN, en el esquema expuesto | `supabase-architect+checkpoint` |
| `OFF-6-02` | `extensión · vector` (118 fn) y `unaccent` (4 fn) en `public` | 122 funciones exec-`anon` fuera de todo control declarado. Fuga nula, riesgo de régimen. **No se mueven**: romperían el tipo `vector(768)`, el índice HNSW y el FTS | `supabase-architect+checkpoint` |
| `OFF-6-03` | `extensión · pg_net` + esquema `net` con `USAGE`+`EXECUTE` para `anon` | SSRF potencial (`net.http_post` desde el servidor de la DB). **Mitigante honesto:** PostgREST no expone `net`, y eso no es verificable por SQL (`LIM-6-01`) | `124-aditivo` |
| `OFF-6-04` | `default-acl · postgres en schema storage` | los defaults conceden `arwdDxtm` a `anon` sobre objetos futuros de `storage`. Inerte hoy (0 buckets) — **pero crear un bucket antes de cerrarlo lo nace público** | `124-aditivo` |
| `OFF-6-05` | `guard · lockdown-guard.test.ts` (transversal a los 6 bloques) | el guard es estático sobre el repo y ciego a todo lo que abre la plataforma: default ACL de `supabase_admin`, `USAGE TO PUBLIC`, `EXECUTE TO PUBLIC` por default y las 1.209 fn de extensión | `guard` (123-05) |

**`limite-declarado`:** `LIM-6-01` (qué esquemas expone PostgREST — `pgrst.db_schemas` no es visible
por SQL; se registró el intento y su salida `NO-VISIBLE-EN-SESION`, y `OFF-6-03` se documenta
**asumiendo el caso favorable y diciendo que lo asume**) y `LIM-6-02` (si `pgtap` está expuesta como
`/rest/v1/rpc/*`; el `EXECUTE` sí está probado, el último salto HTTP no).

## El mapa "qué NO ve el guard CI" — con los `Q-NN` reales

Los dos fragmentos requeridos **existían** al arrancar (wave 3 respetada), así que ninguna celda dice
"pendiente" ni "se declara la dependencia". Puntos ciegos, cada uno anclado en una query real:

| bloque | punto ciego | `Q-NN` que lo demuestra |
|---|---|---|
| A (`:310`) | ciego a `ALTER DEFAULT PRIVILEGES`; ciego al `USAGE TO PUBLIC`; ciego a objetos de extensión | `Q-10`, `Q-22b`, `Q-24b` |
| B (`:718`) | ciego a PII dentro de `jsonb`/`text` de una RPC allowlisted; ciego al acotamiento (17 RPCs sin timeout) | `Q-14bis` (`limite-declarado`), `Q-13bis`, `Q-23` |
| D (`:437`) | mismo ciego de defaults; ciego a grants aplicados fuera de migración | `Q-10`, `Q-08b` |
| E (`:532`) | ciego a **qué** consulta el punto `service_role` sancionado (verifica existencia, no contenido) | `Q-01`, `Q-04`, `Q-23` |
| A2/Direction-B (`:609`) | **el mayor**: mira definiciones, **nunca grants**. No caza los 9 `grant … to anon` ya revocados ni las 8 fn abiertas por default `TO PUBLIC`; ni las 1.079 de `pgtap` | `Q-12`, `Q-15`+`comm -13`, `Q-24b` |
| A3/Direction-A3 (`:679`) | certifica que la llamada está allowlisted, **no** que el retorno sea PII-safe — agravado en `cruces_de_parlamentario` (`evidencia jsonb`) | `Q-14bis`, `Q-16`, `Q-13bis` |

## Corrida de guards y escáneres

**477 tests verdes, 0 rojos** (+6 skip LIVE-gated por diseño, `ci.yml:55-58`). `lockdown-guard` 22/22,
igual que el baseline del fragmento 01. Los 14 controles de la tabla final están todos en verde.

`security_scan.sh` → `RESULTADO: findings HIGH` con **53 hallazgos, 53 falsos positivos** (51 en
`.pnpm-store/`, que ni siquiera está versionado; 1 fixture del propio `env-example-guard`; 1 hash
`integrity` de `pnpm-lock.yaml`). `check_drift.sh` → `DRIFT detectado` con **714 hallazgos, todos
falsos positivos**: `supabase db push` matchea porque el repo escribe la **prohibición** en cada
cabecera de migración, y `web_reader` matchea las migraciones que lo crearon y **dropearon** — se
verificó contra la DB viva: `select count(*) from pg_roles where rolname='web_reader'` → **`0`**.

## Desviaciones (RULE-1)

**1. El comando de corrida de guards del plan no existe en este repo.** El plan proponía
`pnpm --filter ./app test -- lockdown-guard`. `app/package.json` define `"test": "vitest run"` y `--`
no pasa un filtro de archivo por esa vía. Comando REAL usado y transcrito:
`pnpm exec vitest run <archivos>` con `cwd = app/`, más
`pnpm --filter @obs/llm exec vitest run` y `pnpm --filter @obs/cruces exec vitest run` para los
guards de `packages/` que `ci.yml:59,65` corre en jobs separados. Manda la realidad.

**2. Se añadieron `Q-22b`, `Q-24b` y `Q-24c`, no previstas por el plan.** Sin `Q-22b` (ACL crudo) no
se puede distinguir un grant explícito a `anon` de una herencia de `PUBLIC` —`has_schema_privilege`
funde ambos—. Sin `Q-24b`/`Q-24c` el eje 6 habría reportado "4 extensiones en `public`, Splinter
0014" como una nota de higiene, cuando el hallazgo real es **1.079 funciones ejecutables por `anon`**.
`Q-24c` es una **probe de ejecución** (`SET ROLE`, read-only, función escalar sin acceso a tablas):
la regla de método de la fase es que la alcanzabilidad se demuestra, no se infiere.

**3. Se invocó la excepción §0.6 E al filtro `pg_depend deptype='e'`.** El método lo permite
explícitamente ("si un eje necesitara auditar uno, se declara como excepción explícita en su
fragmento, con la razón") y este es el caso que la cláusula anticipaba. La razón está escrita en el
fragmento: una función de extensión instalada en `public` es tan alcanzable por PostgREST como una
propia.

**4. El propio `<verify>` del plan mordió al artefacto.** La primera redacción de la tabla del
escáner transcribía el valor literal de la fixture de `env-example-guard.test.ts:208` para explicar
el falso positivo, y el grep anti-secreto salió no-cero. Se reescribió a **clase sin valor** y quedó
registrado dentro del propio fragmento. Es la mitigación T-123-17 funcionando **sobre el auditor**.

## Régimen respetado

Cero DDL, cero DML, cero `supabase db push`, cero deploy, cero flags tocados, cero paquetes
instalados. `git diff --quiet -- app supabase` sale **0**: no se modificó ni una línea de código ni de
migración. **No se creó el bucket** (deuda-operador). Ninguna RPC de negocio fue invocada; la única
ejecución fue `public.pg_version()` bajo `SET ROLE anon` (escalar de `pgtap`, sin acceso a tablas).
Cero PII: solo nombres de objeto, recuentos y ACLs. El valor de `SUPABASE_DB_URL` no aparece en ningún
artefacto — solo su nombre.

## Qué heredan 123-05 y 123-06

**123-05** recibe `OFF-6-05`, que se suma a `OFF-02` y `OFF-4-05`: los tres son el mismo defecto
estructural desde tres ejes. Tres requisitos concretos en orden de decidibilidad estática (defaults →
`revoke execute … from public` obligatorio por `create function` → **allowlist de extensiones
permitidas en `public`**, aporte de este plan). Baseline a preservar: **477 verdes / 0 rojos**.
Límite escrito: el guard corre en CI **sin DB** (`ci.yml:48`), así que no puede ver el ACL vivo —
esa mitad la cierra la Phase 124, y ninguna sustituye a la otra.

**123-06** recibe el eje 6 como **`offender` (5 filas) + 2 `limite-declarado`**, y con él las
**primeras dos filas de toda la fase con destino `supabase-architect+checkpoint`** (los fragmentos 01
y 02 cerraron con cero). Splinter **0014** reclamado con 4 hallazgos; Splinter **0025** reclamado con
**cero VACUO** declarado como tal. Orden que importa para la Phase 124: cerrar los defaults de
`storage` y de `supabase_admin` **antes** de que nazca ningún objeto bajo ellos, con el mismo escape
en ambos — si falla por membresía, se reclasifica a `deuda-operador`, **jamás se escala privilegio**.

## Self-Check: PASSED

Archivos creados verificados en disco:

```
FOUND: .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-03-EXPOSICION-GUARDS.md
FOUND: .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-04-SUMMARY.md
```

Commits verificados en `git log`:

```
FOUND: 7d74dd4  docs(123-04): eje 6 lado DB
FOUND: 977edf9  docs(123-04): eje 6b guard CI
```

Verify de ambos tasks: `OK`. `git diff --quiet -- app supabase`: **0**. Grep anti-secreto sobre el
fragmento: **0 hallazgos**.
