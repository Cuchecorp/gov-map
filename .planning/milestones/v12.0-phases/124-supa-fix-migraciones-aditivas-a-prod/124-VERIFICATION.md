---
phase: 124-supa-fix-migraciones-aditivas-a-prod
verified: 2026-07-29T15:30:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "Ejecutar como `supabase_admin` las 3 sentencias de OFF-01 (`alter default privileges for role supabase_admin in schema public revoke all on tables/functions/sequences from anon, authenticated`), vía ticket a soporte de Supabase"
    expected: "`0073_default_acl_supabase_admin_public.test.sql` pasa de 2 ok / 2 not ok a 4 ok / 0 not ok"
    why_human: "`postgres` no es miembro de `supabase_admin` (`rolsuper=f`); verificado en vivo — la migración aborta con 42501. Requiere identidad que el agente no tiene ni debe escalar."
  - test: "Ejecutar como `supabase_admin` las 4 sentencias de OFF-6-03 (revoke de `USAGE`/`EXECUTE` sobre el esquema `net` a anon, authenticated y PUBLIC)"
    expected: "`0075_revoke_net_roles_publicos.test.sql` pasa de 1 ok / 5 not ok a 6 ok / 0 not ok, y la aserción (F) (`service_role` conserva EXECUTE sobre `net.http_post`) sigue verde"
    why_human: "Cadena SSRF ABIERTA hoy, verificada en vivo (`net` → anon `t`, `nspacl` conserva `=U`). Mismo bloqueo de ownership. Urgencia elevada."
  - test: "OP-1 — probe REST con la anon key contra la familia `lives_ok` de pgtap"
    expected: "Decide si OFF-6-01 escala a bloqueante"
    why_human: "Requiere la anon key y una llamada externa a PostgREST"
  - test: "OP-4 — decidir destino de la extensión `pgtap` y de las suites pgTAP fuera de `public`"
    expected: "Checkpoint de operador + supabase-architect"
    why_human: "Movimiento de extensión con riesgo de romper ingesta; requiere decisión de arquitectura"
  - test: "OP-2 (Database Advisors + DEBT.md) y OP-3 (bucket `crudo-servel`)"
    expected: "Deuda registrada, no bloqueo"
    why_human: "Actos de dashboard/operador"
  - test: "D-01 — re-medir `aportes_de_parlamentario` y `contratos_de_parlamentario` el día del flip de MONEY"
    expected: "Si el máximo real supera 5.000, re-derivar el techo de 20.000 con criterio ≥4×"
    why_human: "Depende del flip del gate MONEY, que es acto de operador"
---

# Phase 124: SUPA-FIX — Migraciones aditivas a PROD · Verification Report

**Phase Goal:** Los defectos de estructura encontrados quedan corregidos en PROD sin nada destructivo y con no-regresión demostrable.
**Verificado:** 2026-07-29 · contra PROD, **read-only** (`current_user=postgres`, `rolsuper=f`, `TimeZone=UTC`)
**Status:** `human_needed` — los 4 criterios están CUMPLIDOS con evidencia propia; lo abierto es exclusivamente deuda que solo el operador puede pagar.
**Re-verification:** No — verificación inicial.

Método: **cero confianza en SUMMARY/DELIVERABLE.** Todo número de abajo lo produjo este verificador
ejecutando la query o el test contra la DB viva y el repo, no leyéndolo de un artefacto.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidencia (medida por el verificador) |
|---|---|---|---|
| 1 | Cada fix es una migración aditiva numerada; nada destructivo aplicado | ✓ VERIFIED | `grep -inE '^\s*(drop\|alter table\|update\|delete\|insert\|truncate\|alter type\|create table)' 007[3-9]*.sql` → único DML = `insert` al ledger (0077/0078/0079) y una tmp table en 0079. **Cero `drop`, cero cambio de tipo, cero backfill.** `0077` es puramente `alter function … set`; `0078`/`0079` son `create or replace` con firma idéntica (pgTAP 0079 asserts 13/16 lo prueban) |
| 2 | Aplicadas por `psql --single-transaction`, jamás `supabase db push` | ✓ VERIFIED | Ledger vivo = `0074,0076,0077,0078,0079`; **`0073` y `0075` ausentes**. Aplicación selectiva fuera de orden es **imposible** con `db push` (aplica todo lo pendiente en orden) ⇒ prueba positiva de la vía `psql`. Grep de `db push\|db reset` no-comentario en las 7 migraciones → **0** |
| 3 | Pre-checks fail-closed reales, no comentarios | ✓ VERIFIED | Las 7 migraciones tienen **2 bloques `do $…$`** (pre-check + post-check) con `raise exception` (2–9 por archivo). Probado en vivo por el caso `0075`: el post-check abortó la transacción (`P0001`) tras 24 `WARNING 01006` no-op ⇒ el mecanismo **mordió de verdad** |
| 4 | pgTAP contra el schema APLICADO, cubriendo el defecto específico | ✓ VERIFIED | Los 7 tests **re-corridos por el verificador**: 0073 `2 ok/2 not ok`, 0074 `4/0`, 0075 `1 ok/5 not ok`, 0076 `5/0`, 0077 `20/0`, 0078 `11/0`, 0079 `26/0` — **idéntico a lo reportado**. No son smoke tests: asertan ACL por `aclexplode`, invocan las RPC y comparan firma/retorno pre-post |
| 5 | Re-corrida del audit → 0 offenders en lo corregido | ✓ VERIFIED | `Q-15` → **0** sobre denominador **42**; `Q-12` → `42\|0\|0\|42\|28\|31` (0 exec-anon, 0 exec-auth, **42/42 service_role**); `Q-17` → **0** sobre 28 secdef; `Q-10` `postgres/storage` sin `anon=`/`authenticated=` |
| 6 | Lo NO corregido sigue **demostrablemente vivo** (deuda no cerrada en silencio) | ✓ VERIFIED | `Q-10` `supabase_admin/public` conserva `anon=rwU`/`anon=X`/`anon=arwdDxtm` byte-idéntico; `Q-22` fila `net` → `t\|t`; `nspacl` de `net` conserva `=U/supabase_admin` **y** `anon=U`. Ambas direcciones probadas |
| 7 | No-regresión de producto bajo `service_role` | ✓ VERIFIED | `votos_de_parlamentario('D1165',1000,0)` → **1000**; `match_proyectos(…,1001)` → **1001**; `subgrafo_red('D1009',2)` → **134 nodos / 7.394 aristas** (= el máximo medido, sin recorte); cota operando: `votos(100000)` → **3752 ≤ 4000**; `parlamentarios_publico()` → **186** |
| 8 | Camino A intacto + `statement_timeout` no borrado | ✓ VERIFIED | `service_role` conserva `EXECUTE` en **42/42**. `tiene_timeout` = **31/42** exacto. Las **15** funciones re-emitidas por `0078`/`0079` conservan las tres `statement_timeout=5s` (y `search_path=""` donde correspondía) |
| 9 | Higiene: cero PII, cero credenciales, cero flags, repo limpio | ✓ VERIFIED | `git diff --quiet -- supabase` → **exit 0**; `git diff --stat -- '*PUBLIC_ENABLED*' '*.env*'` → **0 líneas**; grep de `postgres://\|sb_secret\|eyJ…\|RUT` sobre los artefactos de la fase → **0** (único hit es la línea que documenta el propio control). Suite `app/` **1590 passed / 107 files**, `tsc --noEmit` **exit 0** — ambos corridos por el verificador |

**Score:** 9/9 truths verificados.

---

## Estado de los 4 criterios de éxito de la fase

| # | criterio | veredicto del verificador |
|---|---|---|
| 1 | Cada fix = migración aditiva numerada, nunca destructivo sin checkpoint | ✅ **CUMPLIDO**. Revisados los 5 `.sql` aplicados línea a línea, no su descripción. No hay drop, cambio de tipo, backfill ni cambio de firma. `0078`/`0079` re-emiten cuerpos con `create or replace` **preservando firma y tipo de retorno** (asertado por pgTAP e independientemente por `pg_get_function_result`) |
| 2 | `psql --single-transaction`, pre-checks fail-closed, JAMÁS `db push` | ✅ **CUMPLIDO**. Ver truths 2 y 3. La ausencia de `0073`/`0075` en el ledger es prueba estructural de que no hubo `db push`. Los pre/post-checks son bloques `do` con `raise exception`, no comentarios — y el de `0075` **abortó en vivo**, que es la mejor prueba posible |
| 3 | pgTAP contra el schema aplicado, cubriendo el defecto | ✅ **CUMPLIDO**. Re-corridos por el verificador; conteos exactos. Las cotas **vacuas** de `aportes`/`contratos` están **declaradas como vacuas en el propio mensaje del test**: `ok 1 - … (VACUA HOY: public.aporte=0 filas por el gate MONEY; re-medir tras el flip)`. No hay verde engañoso |
| 4 | Re-corrida del audit → 0 offenders en lo corregido | ✅ **CUMPLIDO**. Re-corridas por el verificador `Q-15`, `Q-12`, `Q-17`, `Q-10`, `Q-22`, `Q-22b`, `Q-02`, `Q-05` y el recuento de `Q-13bis`. Todo cero es **fuerte** (con denominador). La trampa declarada se confirma: `Q-13bis` da `tiene_limit_regex = 26/42` y `match_proyectos` sale `false` **teniendo `limit least(coalesce(match_count,20), 4000)` en el cuerpo vivo** — límite del regex, no defecto |

---

## Key Link Verification

| From | To | Via | Status | Detalle |
|---|---|---|---|---|
| `0074`,`0076`–`0079` | PROD | `psql --single-transaction` | WIRED | En `supabase_migrations.schema_migrations` |
| `0073`,`0075` | PROD | — | **NO WIRED — por diseño** | Ausentes del ledger. Correcto: el ledger no debe afirmar lo que la DB no tiene |
| `0076` (revoke `f_unaccent`) | `app/lib/lockdown-guard.test.ts` | `KNOWN_MISSING_REVOKE_FROM_PUBLIC` | WIRED | Verificado `= []` en `:1125`; el guard (A5) muerde ante la primera `create function` sin revoke |
| RPCs re-emitidas | sitio (`service_role`) | Camino A | WIRED | 42/42 `EXECUTE`; probes de producto sin encoger |

## Data-Flow Trace (Level 4)

| Artefacto | Dato | Fuente | Datos reales | Status |
|---|---|---|---|---|
| `votos_de_parlamentario` | filas de voto | `public.voto` | sí (3.752 para D1165) | ✓ FLOWING |
| `match_proyectos` | vecinos vectoriales | `proyecto_embedding` | sí (1001 con match_count=1001) | ✓ FLOWING |
| `subgrafo_red` | grafo | `entidad`/`arista` | sí (134/7.394) | ✓ FLOWING |
| `aportes_/contratos_de_parlamentario` | filas | `aporte`/`contrato` | **NO — tablas en 0 por el gate MONEY** | ⚠️ VACUO **DECLARADO** (no es gap: el test lo dice en su propio mensaje; deuda D-01 nombrada) |

## Behavioral Spot-Checks

| Behavior | Comando | Resultado | Status |
|---|---|---|---|
| Suite `app/` | `pnpm --filter ./app test` | 1590 passed / 107 files | ✓ PASS |
| Typecheck | `pnpm --filter ./app exec tsc --noEmit` | exit 0 | ✓ PASS |
| pgTAP ×7 | `psql -f supabase/tests/post-apply/007*.test.sql` | 69 ok / 7 not ok (los 7 = las 2 deudas) | ✓ PASS |
| Repo limpio en `supabase/` | `git diff --quiet -- supabase` | exit 0 | ✓ PASS |

## Anti-Patterns Found

| File | Pattern | Severidad | Impacto |
|---|---|---|---|
| `0076`–`0079` | 4 líneas con `db push` | ℹ️ Info | Son la **prohibición escrita en comentario**. El DELIVERABLE ya lo corrigió en voz alta (nota RULE-1) en vez de ajustar el número — se confirma la corrección |
| — | debt markers `TBD`/`FIXME`/`XXX` en archivos de la fase | ninguno bloqueante | Sin marcadores huérfanos |

---

## Honestidad del cierre — auditada explícitamente

Se revisó si el DELIVERABLE suaviza algo. **No lo hace, y en varios puntos se acusa a sí mismo:**

- Las **4 transcripciones falladas del audit** están escritas como **patrón**, no como mala suerte, con la frase «Los números del audit son hipótesis a verificar contra PROD, no hechos» — y con las dos que **habrían roto producción o el Camino A**.
- Los **techos prescritos** (100 / 200) que habrían roto `/buscar` desde la página 6 y desincronizado los votos de los 186 parlamentarios están tabulados con el llamador y la línea exacta. La adjudicación a 4000 está fundada y verificada (el máximo real es 3.773 y mi probe midió 3.752 para D1165).
- Las **cotas vacuas** de `aportes`/`contratos` se declaran vacuas **dentro del mensaje del test**, no solo en la prosa.
- La **SSRF abierta** de `OFF-6-03` se describe sin suavizar, incluida la frase «una seguridad que depende de que una extensión de terceros no ponga nombre a sus parámetros … es una coincidencia con fecha de vencimiento».
- Las **2 deudas de operador** están tipadas como `DEUDA-OPERADOR` en el frontmatter de sus `*-RESULTADO.md` (`aplicado_en_prod: false`, `registrado_en_ledger: false`, `escalada_de_privilegio: false`) y **probadas vivas por sus pgTAP rojos** — no aparecen como hecho en ningún lado.
- La identidad `6 + 2 + 2 + 3 == 13` cuadra y usa vocabulario cerrado.

No se halló ninguna afirmación sin evidencia verificable.

---

## Deferred / Human Items

No hay gaps. Lo abierto es deuda **nombrada con dueño** en `124-HANDOFF-EXACTITUD.md` (401 líneas,
14 ítems + anexo): `B-01`, `B-02`, `B-03`, `OFF-6-01`, `OFF-6-02`, `OP-1`..`OP-4`, `D-01` y los 4
huecos del gate. **6 items** requieren al operador (ver frontmatter `human_verification`), de los
cuales **2 son de urgencia elevada** (`OFF-6-03`/`OP-1`+`OP-4`, por la cadena SSRF).

## Gaps Summary

**Ninguno.** El goal —*defectos corregidos en PROD sin nada destructivo y con no-regresión
demostrable*— está achieved en la parte que la fase podía cerrar con la identidad `postgres`, y la
parte que no podía está **demostrada abierta** en vez de silenciada. Los 7 `not ok` de pgTAP no son
fallos de la fase: son la prueba de la deuda, y desaparecer sin ellos habría sido el gap real.

El status es `human_needed`, no `passed`, únicamente porque quedan **6 actos que solo el operador
puede ejecutar** — no por defecto alguno del trabajo entregado.

---

_Verified: 2026-07-29 · contra PROD read-only_
_Verifier: Claude (gsd-verifier)_
