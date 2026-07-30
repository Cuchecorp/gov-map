---
phase: 124-supa-fix-migraciones-aditivas-a-prod
plan: 07
wave: 7
subsystem: supabase-boundary
tags: [supabase, re-audit, verbatim, veredicto, handoff, deuda-operador, ssrf, rule-1]
requires: ["124-01", "124-02", "124-03", "124-04", "124-05", "124-06"]
provides:
  - "124-SUPA-FIX.md — deliverable consolidado de SUPA-02: re-audit verbatim + veredicto de los 13 offenders + identidad aritmetica"
  - "124-HANDOFF-EXACTITUD.md — 14 items no cerrados, con 5 campos y destino nombrado cada uno"
  - "Criterio de exito n4 de la fase DEMOSTRADO: 0 offenders en lo corregido, con la misma query que los detecto"
  - "Las 2 deudas de operador acumuladas en UN ticket zero-credential-value (7 sentencias)"
  - "Precedente LOCKED: un REVOKE ajeno no falla (WARNING 01006) — el post-check fail-closed es lo unico que separa cierre real de cierre falso"
  - "Precedente LOCKED: los numeros de un audit son hipotesis a verificar contra PROD, no hechos (4 casos)"
affects:
  - "Phase 125: verifica sintomas de B-01/B-02 sobre el deploy; NO es su fix"
  - "supabase-architect: OFF-6-01 y OFF-6-02 entran como DIFERIDO con OP-4 de gate"
  - "operador: OP-1 y OP-4 suben a urgencia ELEVADA (cadena SSRF abierta)"
  - "toda fase futura: ninguna migracion crea objeto nuevo en public sin su revoke adjunto mientras OFF-01 sea deuda"
tech-stack:
  added: []
  patterns:
    - "re-corrida VERBATIM: las queries se copian del audit, nunca se reescriben (verificado por comparacion de bloques, 12/12 byte-identicas)"
    - "toda deuda se demuestra VIVA con su query original, no se asume"
    - "cada cero lleva denominador explicito (cero fuerte vs cero vacuo)"
    - "veredicto de vocabulario cerrado + identidad aritmetica que debe cuadrar o se escribe la correccion"
key-files:
  created:
    - .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-SUPA-FIX.md
    - .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-HANDOFF-EXACTITUD.md
  modified: []
decisions:
  - "Los veredictos de OFF-01, OFF-6-04 y OFF-6-03 se COPIARON del frontmatter de sus archivos de adjudicacion; cero re-interpretacion"
  - "Destino de B-01/B-02: proxima auditoria de regimen (backlog de exactitud), con sintoma verificable en Phase 125 — Phase 125 es E2E, no escribe SQL, asi que nombrarla como duena del fix habria sido falso"
  - "B-03 se declara cero VACUO: no hay nada que arreglar hoy; lo que falta es una asercion de guard, no un fix"
  - "RULE-1: el grep de `db push` da 4 lineas, las 4 comentarios de prohibicion; se escribe la correccion en vez de ajustar el numero"
metrics:
  duration: "~45 min"
  completed: 2026-07-29
  tasks: 3
  commits: 2
---

# Phase 124 Plan 07: cierre de fase — re-auditoría verbatim, veredicto y handoff — Summary

Las **12** queries que detectaron cada offender en la Phase 123 se re-corrieron **verbatim** contra
PROD (verificadas byte-idénticas contra el audit original, 12/12) y **el criterio de éxito nº4 quedó
demostrado**: cero offenders en lo corregido, cada cero con su denominador. Lo que 124 **no** cerró se
demostró **siguiendo vivo** — porque una deuda que no se prueba viva es una deuda que se está cerrando
en silencio. Los **13** offenders del audit tienen veredicto de vocabulario cerrado y la identidad
`6 + 2 + 2 + 3 == 13` **cuadra**. Los **14** ítems que la fase no cierra salen nombrados, con forma de
fix y con dueño.

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | Re-corrida verbatim de las queries de 123 contra PROD | `2bd2e40` | 14 bloques ```sql; **12/12** byte-idénticos al audit |
| 2 | Veredicto de los 13 offenders + identidad aritmética + régimen | `2bd2e40` | `6+2+2+3 == 13` ✔ |
| 3 | Handoff nombrado de lo no cerrado | `db381e4` | 14 ítems × 5 campos, cero destino vago |

## El veredicto — los 13, con vocabulario cerrado

| veredicto | n | cuáles |
|---|---|---|
| **`CERRADO`** | **6** | `OFF-4-01`, `OFF-4-02`, `OFF-4-03`, `OFF-4-04`, `OFF-5-01`, `OFF-6-04` |
| **`DEUDA-OPERADOR`** | **2** | `OFF-01`, `OFF-6-03` |
| **`DIFERIDO`** | **2** | `OFF-6-01`, `OFF-6-02` |
| **`CERRADO-EN-123`** | **3** | `OFF-02` (A4), `OFF-4-05` (A5, deuda además **PAGADA** en 124-03), `OFF-6-05` (A6) |
| **suma** | **13** | = las 13 filas de la tabla de offenders |

Control cruzado contra el §Recuento por destino de 123 (con su corrección RULE-1 `124-aditivo = 8`):
de esos 8, **6 `CERRADO` + 2 `DEUDA-OPERADOR`**; `architect+checkpoint` 2 → `DIFERIDO`; `guard` 3 →
`CERRADO-EN-123`. `8 + 2 + 3 = 13`. **Cuadra.**

Ningún `CERRADO` sin sus **tres** evidencias en su fila: migración aplicada con exit 0 y en ledger +
pgTAP verde contra el schema aplicado + re-corrida verbatim de su query en cero.

## La evidencia — 0 offenders en lo corregido, con denominador

Ancla: `2026-07-29 | UTC | PostgreSQL 17.6`.

| query verbatim | resultado | denominador |
|---|---|---|
| `Q-15` (fn exec-`anon`) | **`(0 filas)`** — eran **8** | **42** (corpus propio de `public`, vía `Q-12`) |
| `Q-12` (exposición por rol) | **0/42** exec-`anon`, **0/42** exec-`authenticated`, **42/42** `service_role` | 42 |
| `Q-17` (secdef sin `search_path`) | **`(0 filas)`** | **28** secdef (`Q-16`) — cero **fuerte** |
| `Q-10` (`postgres`/`storage`) | las 3 filas **sin** `anon=` ni `authenticated=` | 30 filas de `pg_default_acl` |
| `Q-13bis` (acotamiento) | `tiene_timeout` **31/42**; cota real **29/42** | 42 |
| `Q-02`, `Q-05`, `Q-09b`, `Q-19` (no-regresión) | **las 4 en `(0 filas)`** | 57 tablas / 28 secdef |

Y **lo no cerrado, demostrado vivo** (que era la otra mitad del criterio nº4):

| query verbatim | resultado | offender |
|---|---|---|
| `Q-10` (`supabase_admin`/`public`) | las 3 filas **conservan** `anon=arwdDxtm` / `anon=X` / `anon=rwU` | `OFF-01` vivo |
| `Q-22` | fila `net` → **`t\|t`** | `OFF-6-03` vivo |
| `Q-22b` | `nspacl` de `net` conserva **`=U`** (`TO PUBLIC`) **y** `anon=U` | `OFF-6-03` vivo |
| pgTAP `0073` | **2 ok / 2 not ok** | los `not ok` **son** la prueba |
| pgTAP `0075` | **1 ok / 5 not ok** | ídem |

pgTAP de las 5 aplicadas, re-corridos hoy: `0074` **4/4**, `0076` **5/5**, `0077` **20/20**,
`0078` **11/11**, `0079` **26/26**. Ledger vivo: `0074, 0076, 0077, 0078, 0079` presentes; `0073` y
`0075` **ausentes** — correcto, el ledger no afirma lo que la DB no tiene.

## Lo que se emitió sin suavizar

**1. Las cuatro transcripciones del audit que no cuadraron contra PROD.** Es un patrón, no mala
suerte: `Q-15` (ACL con grant explícito a `service_role` — asertarlo en `false` habría **roto el
Camino A**), la aritmética de `0077` (18 vs 29 — el pre-check original habría **abortado siempre**),
`OFF-5-01` (`match_proyectos`/`votos_de_parlamentario` **no deben** recibir `search_path=''`: cuerpos
sin calificar, no secdef), y la clase de `comparar_declaraciones` (FILAS, no AGREGADO). **Conclusión
escrita: los números del audit son hipótesis a verificar contra PROD, no hechos.**

**2. Los techos prescritos que habrían roto producto.** `match_proyectos` 100 vs demanda viva **1001**
(rompía `/buscar` desde la página 6) y `votos_de_parlamentario` 200 vs **1000** (recortaba a los 186
parlamentarios y **empeoraba** `B-01`). Adjudicado **4000**, criterio ≥4× el argumento máximo del
llamador **vivo**. **El executor paró antes de aplicar.**

**3. Las cotas vacuas de `aportes`/`contratos`.** Midieron 0 **porque sus tablas están vacías por el
gate MONEY**, no porque el dato sea pequeño. `4 × 0` no es techo ⇒ **20.000 provisional**, aserciones
(1) y (4) del pgTAP `0079` **declaradas vacuas en el propio mensaje del test**. Deuda `D-01`:
re-medir tras el flip.

**4. La consecuencia de `OFF-6-03`.** `anon` conserva `USAGE` sobre `net` y `EXECUTE` sobre sus **12**
funciones (incl. `http_post`, `http_delete`, `worker_restart`). El único mitigante es el **accidente**
de que `pgtap` no nombra sus argumentos (`proargnames = NULL`) — *"frágil y no intencional"* según el
gate. ⇒ **`OP-1` y `OP-4` con urgencia ELEVADA**, no como línea de backlog.

**5. La lección mecánica, como precedente del proyecto.** Un `REVOKE` sobre objetos ajenos **no
falla**: no-opea con `WARNING 01006 no privileges could be revoked` y el `psql` termina en 0. En
`0075` ocurrió **24 veces**. **El post-check fail-closed en la misma transacción es lo único que
separa un cierre real de uno falso.**

**6. Las dos deudas de operador, acumuladas en UN ticket** (misma identidad `supabase_admin`, mismo
motivo): **3 sentencias de `OFF-01` + 4 de `OFF-6-03` = 7**, vía soporte de Supabase, **sin entregar
credenciales**. Criterio de cierre nombrado: `0073` de 2/2 a **4 ok**, `0075` de 1/5 a **6 ok**, con
la aserción (F) de `0075` **siguiendo verde** (si se pusiera roja, el revoke habría alcanzado a
`service_role` y roto `pg_cron`).

## El handoff — 14 ítems, 14 destinos, 0 cerrados en silencio

Abre con la **decisión explícita**: `B-01`/`B-02`/`B-03` **no se toman en 124** por **presupuesto, no
dificultad** — la fase consumió su presupuesto íntegro en los 8 offenders de seguridad, y son de otra
clase (exactitud, no boundary).

La **separación LOCKED está escrita y es auditable**: `0078` puso el clamp de **seguridad**
(`least(coalesce(p_limit,20),4000)`) y **no tocó** el `order by fecha desc`, el `offset` ni el default
20 — el problema de **exactitud** de `B-01` sigue exactamente donde estaba.

`B-01` · `B-02` · `B-03` · `OFF-6-01` · `OFF-6-02` · `OP-1`..`OP-4` · `D-01` (nuevo) · y los **4
huecos "al régimen"** (pgmq/pg_cron, esquemas fuera de `public`, Edge Function `ingest-worker`,
`graphql_public`). Cada uno con **qué es · evidencia citada · forma del fix aditiva · destino nombrado
· quién lo cierra**.

**Destinos:** ninguno dice "más adelante". `B-01`/`B-02` → **próxima auditoría de régimen** (backlog
de exactitud) con síntoma verificable en **Phase 125** — nombrar a 125 como dueña del fix habría sido
falso: es E2E, no escribe SQL. `B-03` → **próxima auditoría de régimen**, y se declara **cero vacuo**:
no hay nada que arreglar, falta la **aserción de guard**. `OFF-6-01`/`OFF-6-02` → **`supabase-architect`
+ `OP-4`**. Los 4 huecos → **próxima auditoría de régimen** (el de `ingest-worker` con prioridad alta:
una Edge Function con `verify_jwt=false` es superficie pública **fuera del boundary de Postgres por
completo**).

## Hallazgo incidental registrado (RULE-1)

**Deriva de plataforma ajena a 124:** la fila `realtime` de `Q-22b` pasó de `postgres=U*` (123) a
`postgres=U` (hoy). Es esquema de plataforma, fuera de los ejes auditados, y **ninguna migración de
124 lo tocó** (`0074`–`0079` solo tocan `public` y `storage`). Se registra como observación, no como
offender.

**También registrado y no cerrado en silencio:** `Q-10` muestra que el default ACL de `supabase_admin`
sobre **`graphql`** y **`graphql_public`** concede `arwdDxtm`/`EXECUTE`/`rwU` a `anon` — **el mismo
defecto que `OFF-01`, en otros dos esquemas, fuera del alcance declarado de 123 y de 124**. Va al
handoff dentro del hueco 5.

## Desviaciones (RULE-1)

**1. [Rule 1] El grep de `db push` no da 0 líneas: da 4, y las 4 son comentarios de prohibición.**
- **Encontrado en:** Task 2, corriendo el control de régimen del acceptance criterion.
- **Realidad:** `grep -riE 'db push|db reset' supabase/migrations/007[3-9]*` → **4 líneas**, todas de
  la forma `-- NUNCA supabase db push (drift de schema_migrations).` en `0076`, `0077`, `0078`, `0079`.
- **Acción:** el control que importa —*"ninguna migración de la fase invoca `db push`"*— se verificó
  filtrando las líneas de comentario: **0**. La corrección quedó **escrita** en `124-SUPA-FIX.md`
  §Régimen, no ajustada en silencio (precedente RULE-1 de 123).

**2. [Rule 1] Destino de `B-01`/`B-02`: no se les asignó Phase 125 como dueña del fix.**
- **Problema:** el plan lista Phase 125 entre los destinos válidos, pero Phase 125 es **E2E sobre el
  deploy real** — no escribe SQL. Nombrarla dueña de una RPC de conteo nueva habría sido un destino
  **falso**, que es el mismo modo de fallo que el handoff existe para evitar.
- **Acción:** destino = **próxima auditoría de régimen (backlog de exactitud)**, con Phase 125 nombrada
  explícitamente como la superficie donde su **síntoma** es verificable. Sigue siendo un destino
  nombrado y con dueño; ninguno dice "más adelante".

Sin otras desviaciones. **Cero** archivos tocados fuera de `files_modified`.

## Lo que NO se hizo

Cero DDL, cero DML, **cero migración nueva**, cero `supabase db push`, cero `db reset`, cero deploy,
cero flip de flag, cero `set role`, cero destructivo, cero PII, cero instalación de paquetes.
`git diff --quiet -- supabase` → **exit 0** (este plan no aplicó ni escribió nada en `supabase/`).
`SUPABASE_DB_URL` se usó **por nombre**; su valor no se ecoó, no se expandió y no aparece en ningún
artefacto (grep de `postgres://`/`sb_secret`/`eyJ` sobre los 2 documentos → **0**).

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit 0. ✔ ≥ 1590
- `pnpm --filter ./app exec tsc --noEmit` → exit **0**.
- `git diff --quiet -- supabase` → exit **0**.
- `git diff --stat -- '*PUBLIC_ENABLED*' '*.env*'` → **0 líneas**.
- Bloques ```sql en `124-SUPA-FIX.md`: **14**; **12/12** de las queries del audit **byte-idénticas** a
  su original (comparación programática de bloques, `\r` normalizado). Los 2 restantes son el query de
  ledger y el SQL de la deuda de operador, que no provienen del audit.
- `grep` de secretos sobre los 2 documentos → **0**.
- Untracked/modificados preexistentes (`119-REVIEW.md`, `pnpm-workspace.yaml`, `122-VERIFICATION.md`,
  `123-VERIFICATION.md`) **fuera de alcance**, no tocados.

## Self-Check: PASSED

- `.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-SUPA-FIX.md` — FOUND
- `.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-HANDOFF-EXACTITUD.md` — FOUND
- commit `2bd2e40` — FOUND
- commit `db381e4` — FOUND
- enlace `124-HANDOFF-EXACTITUD` dentro de `124-SUPA-FIX.md` — FOUND (7 referencias)
