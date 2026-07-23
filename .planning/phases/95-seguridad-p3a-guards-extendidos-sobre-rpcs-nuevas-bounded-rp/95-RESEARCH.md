# Phase 95: SEGURIDAD P3a — Guards extendidos sobre RPCs nuevas + bounded RPCs - Research

**Researched:** 2026-07-23
**Domain:** Postgres RPC hardening (bounded RPCs vs DoS) + CI guard extension (lockdown/PII/anti-insinuación) + pgTAP against applied schema, under the service_role model (RLS bypassed by design → each RPC IS the security boundary)
**Confidence:** HIGH (all findings verified directly against repo files: migrations 0055–0063, the three guards, pgTAP tests, and the full `.rpc()` surface in `app/`)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Modelo de amenaza (LOCKED, no OWASP genérico):** repo PÚBLICO en GitHub + sujetos capaces de hostilidad (parlamentarios) + service_role bypassa RLS → el guard ES el muro. La correctitud del dato ES la defensa legal.
- **Fuera de alcance (= Phase 96):** DB VIVA y repo público (Splinter, secret-scan historial, CSP, headers, pnpm audit, B26). Flags `*_PUBLIC_ENABLED`, sign-offs legales, rotación de credenciales = gates que el agente JAMÁS cruza.
- **Bounded RPCs (SC#2):** migración nueva (≥0064) que re-emite las RPCs sin timeout con el patrón 0057 (`set local statement_timeout`). Doble-revoke + cero grant a anon VERBATIM. Timeout recomendado = mismo valor que 0057 (consistencia). Cap de `match_count`: verificar que `buscar_proyectos_hibrido` capea dentro de la función.
- **Apply a PROD:** DDL aditivo de RPCs públicas ya-servidas = precedente 0055–0063 (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, NUNCA `db push`) + pgTAP contra schema aplicado.
- **Guards extendidos (SC#1) — extender, NO duplicar.** Los cuatro guards (lockdown/allowlist, PII, anti-insinuación, pgTAP) YA EXISTEN.
- **PII / partido:** las RPCs v2 devuelven partido DIRECTO por decisión operador 2026-07-21 (NO es PII: dato público del cargo electo); RUT/email/terceros siguen prohibidos.
- **Allowlist sin drift (SC#3) — bidireccional.** Dirección A (servida→enumerada) ya existe. Dirección B (enumerada→respaldada) = agregar assert si no existe. Comparación contra DB VIVA (pg_proc) = Phase 96, NO esta fase.
- **Mutation self-check (SC#4):** cada guard extendido gana su self-check sobre lo NUEVO específicamente. Cero mutación de archivos reales; mutación EN MEMORIA.
- **No tocar:** 0020 intacto (guard LEGAL-03); no alterar firmas de las RPCs v2/cross-links (cambiar returns table = 42P13 → drop → re-arma default privileges).

### Claude's Discretion

- Estructura exacta de los asserts de bounded-ness (estático sobre SQL vs pgTAP contra schema) — elegir lo que muerda más y duplique menos.
- Valor exacto del statement_timeout (consistencia con 0057 = `'5s'` como default).
- Si `match_proyectos` (RPC vieja tras flag) también gana timeout en la misma migración — recomendado sí, es barata y sigue servida.
- Orden de planes (guards primero vs migración primero) — respetar que pgTAP corre contra schema aplicado.

### Deferred Ideas (OUT OF SCOPE)

- Auditoría DB VIVA (pg_proc vs allowlist, Splinter, grants reales) → Phase 96 (net-new).
- Rate-limiting a nivel Worker/Cloudflare (WAF propio) — fuera de milestone; statement_timeout es la mitigación DoS de esta fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Todos los guards existentes (lockdown/allowlist, PII, anti-insinuación, pgTAP) extendidos sobre las RPCs y superficies NUEVAS de P1/P2; toda RPC nueva acotada (LIMIT, `statement_timeout`, caps de `match_count`) contra DoS | §Inventario exacto de RPCs nuevas (bounded audit table), §Anatomía de los guards, §Drift bidireccional (exacto), §Patrón 0057 statement_timeout, §pgTAP idiom + runner |
</phase_requirements>

---

## Summary

Phase 95 has **two verified concrete gaps** and one **corrected scout claim**:

1. **DoS bounding gap (real):** `statement_timeout` exists in exactly ONE migration — `0057` on `buscar_proyectos_hibrido`. The **9 RPCs of 0060/0061** (`parlamentario_publico_v2`, `parlamentarios_publico_v2`, `militancias_de_parlamentario`, `comisiones_de_parlamentario`, and the 4 cross-links) and **`lobby_menciones_de_boletin`** (0062/0063) all have `LIMIT` (50/20) but **zero `statement_timeout`**. Fix = migration ≥0064 re-emitting each with `set statement_timeout = '5s'`, using the same idiom (`drop function if exists` → `create or replace` → doble-revoke). Confirmed by grep: only `0057` contains `statement_timeout`.

2. **pgTAP scope correction (scout was partly WRONG):** The scout said "búsqueda híbrida (0055-0057) SIN pgTAP." **This is FALSE** — `supabase/tests/post-apply/0055`, `0056`, and `0057_*.test.sql` all EXIST. What's true is those pgTAP tests are `post-apply` (run against applied PROD, not scratch) and the new timeout migration (≥0064) needs its own pgTAP. Do NOT re-write hybrid pgTAP from scratch; extend/verify.

3. **`match_count` cap already present (scout question answered):** `buscar_proyectos_hibrido` caps its parameter INTERNALLY via `least(match_count, 50)` at every LIMIT (both arms, `*2`, and the final output). Confirmed by reading 0055/0056/0057. No cap-adding needed for the hybrid RPC; verify the cap survives in the timeout migration.

4. **Allowlist drift = NONE in either direction (verified exhaustively):** All 18 distinct `.rpc()` names in non-test `app/` code ⊆ the 26-entry `PUBLIC_RPC_ALLOWLIST`; all 26 allowlist entries trace to a defined function in `supabase/migrations/`. Direction-B (enumerated→backed) is the assert SC#3 wants and it does NOT yet exist in the guard — it's the one net-new guard addition.

**Primary recommendation:** ONE additive migration `0064_bounded_rpc_statement_timeout.sql` (10 RPCs get `statement_timeout='5s'`, +`match_proyectos` optionally) with `drop → create or replace → doble-revoke` VERBATIM per RPC; ONE new pgTAP `0064_*.test.sql` (has_function + prosecdef + no-anon-execute + `statement_timeout=%` in `proconfig`); extend the three existing guards with mutation self-checks that bite on the NEW surfaces; add the Direction-B allowlist-backed assert to `lockdown-guard.test.ts`. Apply migration to PROD via `psql --single-transaction` then run pgTAP against the applied schema.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bound RPCs vs DoS (statement_timeout / LIMIT / match_count cap) | Database (Postgres RPC) | — | Under service_role RLS is bypassed → the RPC body is the only enforcement point; a Worker rate-limiter is deferred (Phase 96 / out of milestone) |
| Allowlist drift detection (both directions) | CI guard (vitest in `app/lib`) | — | Static scan of `app/` `.rpc()` calls + `supabase/migrations/*.sql`; runs in `pnpm --filter ./app test` |
| PII-safety of new RPC return signatures | Database (returns table) + pgTAP + CI guard | — | pgTAP asserts `pg_get_function_result !~* rut/email/partido_alias`; CI guard blocks `.from(PII)` and non-allowlisted `.rpc()` |
| Anti-insinuación of new UI surfaces | CI guard (vitest) | — | Static text-scan of rendered copy of P1/P2 surfaces (búsqueda/personas/lobby/agenda) |
| Applying DDL to PROD | Operator-precedent agent action | — | Additive DDL of already-served public RPCs = agent authority (precedent 0055–0063); NEVER `db push` |

---

## Standard Stack

No new packages. This phase uses only what the repo already has:

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| vitest | (in `app/`) | Guards run as `*.test.ts` in `app/lib/` | The three existing guards ARE vitest tests; extending them = same harness |
| pgTAP | (Supabase managed) | `plan(N)` / `has_function` / `is` / `ok` schema assertions | Every migration in the repo has a hermano pgTAP; idiom is uniform |
| psql | (client) | Apply DDL + run pgTAP against applied schema | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f …` (LOCKED, never `db push`) |

**Installation:** none. No `## Package Legitimacy Audit` needed — this phase installs zero external packages.

**Test runner (verified in root `package.json`):**
```
"test": "pnpm -r --filter \"./packages/*\" test && pnpm --filter ./app test"
```
The guards live in `app/`, so `pnpm --filter ./app test` runs them. pgTAP is run separately by hand: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/…test.sql` (never `supabase test db` — that reports "supabase test db" stale headers per MEMORY.md; the real runner is `psql -tA -f`).

---

## Runtime State Inventory

> This is a hardening/guard phase, not a rename. But it DOES apply DDL to PROD, so the "live service config" and "stored data" categories matter.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no data migration. The timeout migration is `create or replace function` only; no table touched, no backfill. | None (verified: 0060/0061/0062/0063 idiom is function-only DDL) |
| Live service config | **PROD Postgres has the current definitions of 10 RPCs (0060/0061 × 9 + 0062/0063 × 1) WITHOUT statement_timeout.** These live in `pg_proc`, applied by prior phases — NOT re-created by re-reading migrations. | Apply `0064` to PROD via `psql --single-transaction` (agent authority, additive DDL precedent). The migration re-emits each RPC with the timeout. |
| OS-registered state | None. | None. |
| Secrets/env vars | `SUPABASE_DB_URL` (BOM in `.env` → pass `--db-url` explicitly). No secret renamed. | None (read-only use). |
| Build artifacts | None. Guards are source `.test.ts`; no compiled artifact carries state. | None. |

**The canonical question:** After every migration file is written, PROD still has the OLD (no-timeout) RPC bodies until `0064` is applied. The pgTAP `statement_timeout=%` assert MUST run against the APPLIED schema, not scratch — build/typecheck passing is a false positive (Pitfall 6, per 0060 header).

---

## Inventory EXACTO de RPCs nuevas v9.0 (0055–0063) — bounded-ness audit

Verified by reading each migration. **Final signature** = the last migration that (re)defines the RPC (create-or-replace chains; later migration wins).

| RPC | Final def | Firma | `security definer` + `search_path=''` | LIMIT | `statement_timeout` | `match_count` cap | Revokes (doble) |
|-----|-----------|-------|:---:|:---:|:---:|:---:|:---:|
| `buscar_proyectos_hibrido` | **0057** | `(text, vector, int)` | ✅ | `least(match_count,50)` ×3 | ✅ **`'5s'`** | ✅ `least(match_count,50)` internal (both arms `*2`, final) | ✅ |
| `parlamentario_publico_v2` | **0060** | `(text)` | ✅ | single-row (`where p.id=p_id`) | ❌ **MISSING** | n/a | ✅ |
| `parlamentarios_publico_v2` | **0060** | `()` | ✅ | none (186 filas fijas, by design) | ❌ **MISSING** | n/a | ✅ |
| `militancias_de_parlamentario` | **0060** | `(text)` | ✅ | `limit 50` | ❌ **MISSING** | n/a | ✅ |
| `comisiones_de_parlamentario` | **0060** | `(text)` | ✅ | `limit 50` | ❌ **MISSING** | n/a | ✅ |
| `copartidarios_de_parlamentario` | **0061** | `(text)` | ✅ | `limit 20` | ❌ **MISSING** | n/a | ✅ |
| `de_la_misma_zona` | **0061** | `(text)` | ✅ | `limit 20` | ❌ **MISSING** | n/a | ✅ |
| `co_comisionados_de_parlamentario` | **0061** | `(text)` | ✅ | `limit 20` | ❌ **MISSING** | n/a | ✅ |
| `coautores_de_parlamentario` | **0061** | `(text)` | ✅ | `limit 20` | ❌ **MISSING** | n/a | ✅ |
| `lobby_menciones_de_boletin` | **0063** | `(text)` | ✅ | `limit 50` | ❌ **MISSING** | n/a | ✅ |

**10 RPCs need the timeout.** (The 4 cross-links changed their returns-table in 0061 — they added `total_n bigint` — so 0061 used `drop → create or replace`; their FINAL signature is the 0061 one, which is what the timeout migration must re-emit.)

**CRITICAL for the timeout migration — the 0061 returns tables (must be reproduced EXACTLY):**
- `copartidarios_de_parlamentario(text)` → `(id text, nombre text, camara text, total_n bigint)`
- `de_la_misma_zona(text)` → `(id text, nombre text, camara text, total_n bigint)`
- `co_comisionados_de_parlamentario(text)` → `(id text, nombre text, camara text, comision_nombre text, total_n bigint)`
- `coautores_de_parlamentario(text)` → `(id text, nombre text, camara text, n_proyectos int, total_n bigint)`
- `parlamentario_publico_v2(text)` → 13 cols incl. `partido text, partido_fecha_captura timestamptz, partido_origen text`
- `parlamentarios_publico_v2()` → 10 cols incl. `partido …`
- `militancias_de_parlamentario(text)` → `(partido text, desde date, hasta date, es_actual boolean, origen text, fecha_captura timestamptz, enlace text)`
- `comisiones_de_parlamentario(text)` → `(nombre text, camara text, tipo text, cargo text, origen text, fecha_captura timestamptz, enlace text)`
- `lobby_menciones_de_boletin(text)` → 13 cols (see 0063; `contraparte_rol`/`representado` emitted NULL for deploy compat)

> **Signature stability rule (from 0060/0061 headers):** re-emitting WITHOUT changing the returns table means `create or replace` alone would suffice, but the repo idiom keeps a defensive `drop function if exists public.<name>(<args>);` before each `create or replace` (idiom 42P13). Since 0064 does NOT change any returns table, this is a body-only change and does NOT re-arm default privileges in a problematic way — but the doble-revoke after each re-emit re-cleans the DEFAULT PRIVILEGES that Postgres re-grants on functions in `public`. **Keep the returns tables byte-identical to 0061/0063** — any drift triggers 42P13 mid-transaction and aborts the whole `--single-transaction` apply.

---

## Anatomía de los guards existentes (verified by reading each file)

### 1. `app/lib/lockdown-guard.test.ts` (LOCKDOWN-04, Camino A)

Two blocks:
- **Block (A)** — static scan of `supabase/migrations/*.sql` with number `> 0044`. `anonGrantOffenders()` splits SQL by `;`, strips `--` comments, and flags any `grant … to (anon|public)`. `public` counts (anon is implicit member). No exemptions (Phase 51 carve-out was reverted). Has a rich mutation self-check block (`it("BLOQUEA todo grant…")`) with 7 in-memory cases (a–g).
- **Block (B)** — walks all `.ts/.tsx` in `app/` (skipping `node_modules/.next/.open-next/.turbo/dist/coverage/.vercel/.wrangler` and `*.test.*`), strips TS comments (with `://`-URL skip), and asserts: (1) no `.from('<PII_TABLE>')` outside admin allowlist; (2) no `.rpc('<name>')` where name ∉ `PUBLIC_RPC_ALLOWLIST`; (3) `supabase.ts` doesn't `.select(rut|donante_id)`.
- **`PUBLIC_RPC_ALLOWLIST`** = a `Set` of **26** names (the scout said 26; verified: I count 26 including the 8 v2/cross-link/bio names + `lobby_menciones_de_boletin` + `buscar_proyectos_hibrido`, all already present).
- **`isAdminAllowlisted(file)`** — exempts `app/admin/`, `lib/supabase-admin.ts`, `lib/admin/`. This is why `resolver_entidad` (called in `app/admin/revisar-entidades/page.tsx`) does NOT need to be in the public allowlist.

**What Block (A) does NOT do today (the SC#3 Direction-B + SC#2 static-bound gap):**
- No assert that every allowlist entry corresponds to a defined function in migrations (Direction B).
- No assert that every RPC created in a migration `>0044` (or a curated NEW-RPC set) has `statement_timeout` / `LIMIT`. This is the optional static bounded-ness assert (Claude's Discretion — see recommendation below).

### 2. PII-guard (in the SAME file, Block B)

There is no separate `pii-guard.test.ts` — the PII guard IS Block (B) of `lockdown-guard.test.ts`. `PII_TABLES` = 10 tables (`parlamentario`, `donante`, `cruce_senal`, `identidad_audit`, `vinculo_identidad`, `vinculo_entidad`, `declaracion_familiar`, `parlamentario_alias`, `entidad_tercero`, `revision_entidad`). It runs in CI (`ci.yml` runs `app/` vitest suite). The two addresses it covers: `.from('<pii>')` and `.rpc('<not-allowlisted>')`.

### 3. `app/lib/anti-insinuacion-guard.test.ts`

- Scans EXPLICIT arrays of surface files (relative to `app/`), post-`stripTsComments`, against `TERMINOS_PROHIBIDOS` (a ~90-term denylist), subtracting `NEGACIONES_LOCKED` (legends that contain a banned term while negating it, imported verbatim).
- **Surface arrays already present:** `SUPERFICIES_VOTO`, `SUPERFICIES_MONEY`, `SUPERFICIES_HOME`, **`SUPERFICIES_BUSQUEDA`** (`buscar-filtros.tsx`, `app/buscar/page.tsx`), **`SUPERFICIES_PERSONAS`** (7 files incl. cross-links, partido-chip, militancias, comisiones, directory), **`SUPERFICIES_LOBBY`** (3 files), **`SUPERFICIES_AGENDA`** (5 files incl. `estado-actual-block.tsx`, `citacion-card.tsx`).
- **Mutation self-check already covers the NEW surfaces:** there are dedicated self-check `it()` blocks for PERSONAS (`cercano a` / `bloque de` / `aliado`; `afín` / `coordina con`), AGENDA (`disciplina` / `influencia`), LOBBY (`influencia` / `a cambio de`). **So SC#4 for anti-insinuación is LARGELY ALREADY SATISFIED for personas/lobby/agenda.**
- **Gap to check:** the CONTEXT flags P1 surfaces `/buscar híbrido` and **deep-links (89)**. `SUPERFICIES_BUSQUEDA` covers `buscar-filtros.tsx` + `app/buscar/page.tsx`, but deep-link surfaces (TRACE-01/02/03 from Phase 89 — the ficha's official-link block) may NOT be enumerated. **The planner should verify whether the Phase-89 deep-link component (e.g. an "enlace oficial"/tramitación-link block) is in any surface array; if not, add it + a mutation self-check.** (This is the one plausible anti-insinuación extension.)

### 4. pgTAP idiom (template = 0060/0059/0062 tests)

Uniform structure (verified in `0060_bio_partido_publico.test.sql` and `0057_…test.sql`):
```sql
begin;
select plan(N);
select has_function('public', '<name>', ARRAY['text'], '<msg>');          -- existence + arg types
select is((select prosecdef from pg_proc where proname='<name>'), true, '<msg>');  -- security definer
select is(has_function_privilege('anon','public.<name>(text)','execute'), false, '<msg>'); -- CERO grant
select ok(pg_get_function_result('public.<name>(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y', '<msg>'); -- PII-safe
-- bounded-ness (NEW, template from 0057 lines 32-41):
select ok(exists(
  select 1 from pg_proc p cross join lateral unnest(p.proconfig) cfg
  where p.oid='public.<name>(text)'::regprocedure and cfg like 'statement_timeout=%'), '<msg>');
select * from finish();
rollback;
```
- `has_function` uses `ARRAY['text']` (or `'{}'::text[]` for no-arg like `parlamentarios_publico_v2()`).
- Multi-word regprocedure casts need EXACT type spelling: `buscar_proyectos_hibrido(text,vector,integer)` (note `integer` not `int`, and `vector` unqualified works).
- The `statement_timeout=%` check is EXACTLY the template in `0057_…test.sql` lines 32–41 — reuse it verbatim per RPC in the new `0064` pgTAP.

---

## Drift bidireccional — el diff EXACTO (verified exhaustively)

### Direction A — served (`app/` `.rpc()`) ⊆ allowlist

All distinct non-test `.rpc()` names found in `app/` (grep of `\.rpc\(\s*['"\`]name`):

| RPC called in app/ | In allowlist? | Location |
|--------------------|:---:|---|
| `resolver_entidad` | exempt (admin path) | `app/admin/revisar-entidades/page.tsx` — `isAdminAllowlisted` exempts it |
| `buscar_citaciones` | ✅ | `lib/agenda-buscar.ts` |
| `match_proyectos` | ✅ | `lib/buscar.ts` |
| `buscar_proyectos_hibrido` | ✅ | `lib/buscar.ts:213` |
| `agregado_por_contraparte` | ✅ | `app/contraparte/[id]/page.tsx` |
| `parlamentario_publico_v2` | ✅ | `app/parlamentario/[id]/page.tsx:131` |
| `comisiones_de_parlamentario` | ✅ | `app/parlamentario/[id]/page.tsx:149` |
| `militancias_de_parlamentario` | ✅ | `app/parlamentario/[id]/page.tsx:167` |
| `copartidarios_de_parlamentario` | ✅ | `page.tsx:196` (via `crossLinkReader`) |
| `de_la_misma_zona` | ✅ | `page.tsx:197` |
| `co_comisionados_de_parlamentario` | ✅ | `page.tsx:198` |
| `coautores_de_parlamentario` | ✅ | `page.tsx:199` |
| `parlamentarios_publico_v2` | ✅ | `app/parlamentarios/page.tsx:117` |
| `parlamentarios_publico` | ✅ | `app/red/page.tsx:71` |
| `subgrafo_red` | ✅ | `app/red/page.tsx:140` |
| `cruces_de_parlamentario` | ✅ | `components/cruces-de-parlamentario.tsx` |
| `cruces_de_proyecto` | ✅ | `components/cruces-de-proyecto.tsx` |
| `lobby_en_tramitacion` | ✅ | `components/lobby-en-tramitacion.tsx` |
| `lobby_menciones_de_boletin` | ✅ | `components/lobby-menciones-de-boletin.tsx:245` |
| `contratos_de_parlamentario` | ✅ | `components/contratos-de-parlamentario.tsx` |
| `aportes_de_parlamentario` | ✅ | `components/financiamiento-de-parlamentario.tsx` |
| `lobby_de_parlamentario` | ✅ | `components/lobby-de-parlamentario.tsx` |
| `votos_de_parlamentario` | ✅ | `components/votos-por-parlamentario.tsx`, `lib/parlamentario-resumen-conteos.ts` |
| `declaraciones_de_parlamentario` | ✅ | `components/patrimonio-…`, `lib/parlamentario-resumen-conteos.ts` |
| `bienes_de_parlamentario` | ✅ | `components/patrimonio-de-parlamentario.tsx:963` |
| `comparar_declaraciones` | ✅ | `components/patrimonio-de-parlamentario.tsx:1011` |
| `parlamentario_publico` | ✅ | (test file `page.test.tsx` — but tests aren't scanned) |

**Direction A result: ZERO drift.** Every served RPC is enumerated (or admin-exempt). The existing Block-B assert (2) already catches this. The 4 cross-links via `crossLinkReader("<literal>")` are caught because the guard's `rpcPattern` = `/\.rpc\(\s*['"\`]([a-zA-Z_][\w]*)['"\`]/g` matches `.rpc("copartidarios_de_parlamentario"` even inside the reader helper (the literal is passed to `.rpc(...)` in `crossLinkReader`). **Planner should confirm** `crossLinkReader` internally calls `sb.rpc(<the literal>)` and not a variable — if the name is stored in a variable and interpolated, the static guard would MISS it. (Verify `app/parlamentario/[id]/page.tsx` around line 190.)

### Direction B — allowlist ⊆ defined functions (the NEW assert SC#3 wants)

All 26 allowlist entries trace to a `create [or replace] function public.<name>` in `supabase/migrations/`:

| Allowlist entry | Defining migration |
|-----------------|---------------------|
| agregado_por_contraparte | 0025 |
| aportes_de_parlamentario | 0024 |
| bienes_de_parlamentario | 0031 |
| buscar_citaciones | 0032 / 0033 |
| buscar_proyectos_hibrido | 0055/0056/0057 |
| co_comisionados_de_parlamentario | 0060/0061 |
| coautores_de_parlamentario | 0060/0061 |
| comisiones_de_parlamentario | 0060 |
| comparar_declaraciones | 0022/0031 |
| contratos_de_parlamentario | 0023 |
| copartidarios_de_parlamentario | 0060/0061 |
| cruces_de_parlamentario | 0040/0041 |
| cruces_de_proyecto | 0049 |
| de_la_misma_zona | 0060/0061 |
| declaraciones_de_parlamentario | 0022 |
| lobby_de_parlamentario | 0021 |
| lobby_en_tramitacion | 0048 |
| lobby_menciones_de_boletin | 0062/0063 |
| match_proyectos | (≤0028; revoked in 0045) |
| militancias_de_parlamentario | 0060 |
| parlamentario_publico | (0020; revoked in 0045) |
| parlamentario_publico_v2 | 0060 |
| parlamentarios_publico | (0026/0027; revoked in 0045) |
| parlamentarios_publico_v2 | 0060 |
| subgrafo_red | 0030 |
| votos_de_parlamentario | 0019/0028 |

**Direction B result: ZERO stale entries.** The assert does NOT exist yet in the guard. **Recommendation:** add a static assert in `lockdown-guard.test.ts` that greps all `create (or replace )?function public.<name>` across `supabase/migrations/*.sql` into a Set, and asserts `PUBLIC_RPC_ALLOWLIST ⊆ that Set`. Add a mutation self-check with a synthetic ghost name (e.g. `funcion_fantasma_typo`) proving the assert would fire. Caveat: `match_proyectos`/`parlamentario_publico`/`parlamentarios_publico` are defined in migrations ≤0028 (their `create function` lines exist), so a repo-wide grep (not a `>0044` filter) is required for Direction B.

---

## Patrón EXACTO de statement_timeout (0057 template)

**Idiom (verbatim from 0057 lines 17–28):**
```sql
-- Drop previo para create-or-replace sin error de tipo (idiom 42P13)
drop function if exists public.<name>(<exact-args>);

create or replace function public.<name>(<exact-args>)
returns table ( <EXACT returns table from 0061/0063> )
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'   -- day-1 DoS cap
as $$
  <EXACT body from 0060/0061/0063 — unchanged>
$$;

-- ACL doble-revoke, CERO grant (VERBATIM)
revoke all on function public.<name>(<exact-args>) from public;
revoke all on function public.<name>(<exact-args>) from anon, authenticated;
```

Key details:
- 0057 uses `set search_path = '' set statement_timeout = '5s'` as TWO function-storage options (both land in `pg_proc.proconfig`). **`set` (persistent function config), NOT `set local`** — the CONTEXT/scout wording "`set local statement_timeout`" is imprecise; 0057 uses the function-attribute form `set statement_timeout = '5s'` (which is per-call, scoped to the function). The pgTAP checks `proconfig LIKE 'statement_timeout=%'` — so the function-attribute form is what's asserted. Use the SAME form.
- The 0060/0061 RPCs are `language sql` (not plpgsql) — keep them `language sql`. `lobby_menciones_de_boletin` is also `language sql`. Only `0056/0057`'s hybrid is `language plpgsql`.
- **`match_count` cap:** the hybrid already caps via `least(match_count, 50)`. The 10 RPCs needing timeout take NO `match_count` param (they're `(text)` or `()`), so there's nothing to cap — their `LIMIT` is a literal (20/50). No cap work beyond preserving existing LIMITs.

**Migración aditiva — idiom del proyecto (headers of 0060/0061/0063):**
1. Header comment: number, phase, what changed, apply-order, apply-command (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f …`), `NUNCA supabase db push`, "additive → agent authority (precedent 0055-0063)", "only valid DDL proof is pgTAP against applied schema (Pitfall 6)".
2. Per RPC: `drop function if exists` → `create or replace` → `revoke all … from public;` + `revoke all … from anon, authenticated;`.
3. Apply ONCE, `--single-transaction`. BOM in `.env` → pass `--db-url` explicitly.

---

## pgTAP: cómo se corre aquí + precedente de apply DDL a PROD

- **Runner:** `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/<file>.test.sql`. Expected output "N ok, 0 not ok". NEVER `supabase test db` (stale, per MEMORY.md and 0060 header).
- **Scratch vs PROD:** two conventions in the repo. `supabase/tests/00NN_*.test.sql` (non-post-apply) are validated against a scratch/ephemeral pg (e.g. 0062 was "VALIDADO local en pg efímero 14/14"). `supabase/tests/post-apply/*.test.sql` are for running AFTER applying to PROD (0044/0045/0046/0055/0056/0057). **The new `0064` timeout pgTAP tests bounded-ness which only exists after apply → it belongs in `post-apply/` and runs against the applied schema.** (0057's timeout test is already in `post-apply/`.)
- **Precedent for agent applying DDL to PROD:** 0055–0063 were all applied to PROD BY THE AGENT (STATE.md: "0059 APLICADA a PROD (pgTAP 28/28)", "0060… APLICADA a PROD… pgTAP 30/30", "0062 APLICADA a PROD… pgTAP 13/13"). Additive DDL of already-served public RPCs = agent authority, no operator checkpoint. `0064` fits this precedent exactly (function-only, no backfill, no destructive DROP, no flag flip).

---

## Architecture Patterns

### Recommended plan structure (respecting "pgTAP corre contra schema aplicado")

```
Plan 01 (migration + pgTAP):
  ├─ write 0064_bounded_rpc_statement_timeout.sql (10 RPCs + optional match_proyectos)
  ├─ write supabase/tests/post-apply/0064_*.test.sql (has_function + prosecdef + no-anon + PII-safe + statement_timeout=%)
  ├─ APPLY 0064 to PROD via psql --single-transaction
  └─ run 0064 pgTAP against applied schema → N ok, 0 not ok

Plan 02 (guard extensions — pure app/lib, no PROD contact):
  ├─ lockdown-guard.test.ts: add Direction-B assert (allowlist ⊆ defined functions) + mutation self-check
  ├─ (optional, Claude's discretion) lockdown-guard.test.ts: static bounded-ness assert over 0064 + self-check
  ├─ anti-insinuacion-guard.test.ts: verify deep-link (89) surface enumerated; add if missing + self-check
  └─ suite app (1129+) + packages (1103) green + tsc --noEmit 0
```

**Order rationale:** Migration + pgTAP first (Plan 01) because the pgTAP MUST run against the applied schema. Guard extensions (Plan 02) are pure static `app/lib` edits with zero PROD contact — they can land after. If the static bounded-ness guard reads `0064` SQL, `0064` must exist first (it does, written in Plan 01).

### Pattern: mutation self-check EN MEMORIA (bite proof)

Established template (68-01, 69-01, 70-02, and the existing anti-insinuación self-checks). For the new asserts:
- **Direction-B allowlist:** feed the detector a synthetic allowlist entry `funcion_fantasma_typo` with an empty "defined functions" set → assert it's reported as orphan.
- **Bounded-ness (if static):** feed a synthetic migration string with a `create or replace function public.foo(text) … as $$ … $$;` LACKING `statement_timeout` → assert it's flagged.
- **anti-insinuación deep-link (if added):** inject `cercano a`/`influencia` into a fixture simulating the deep-link block → assert it's caught.

The detector must be a PURE function (input string → offenders[]) so the self-check exercises it without touching disk — exactly the shape of `detectarInsinuaciones()` and `anonGrantOffenders()`.

### Anti-Patterns to Avoid

- **Rewriting hybrid pgTAP from scratch** — `post-apply/0055/0056/0057` already exist. Extend/verify, don't duplicate (scout claim was wrong).
- **Changing any returns table in 0064** — would trigger 42P13 mid `--single-transaction` and abort the apply. Reproduce 0061/0063 returns tables byte-identically.
- **`set local statement_timeout` inside the body** — use the function-attribute `set statement_timeout='5s'` form (what pgTAP asserts via `proconfig`). 0057 uses the attribute form; match it.
- **Re-emitting a grant** — the doble-revoke is CERO-grant. Any `grant … to anon/public` in a `>0044` migration fails the lockdown guard (Block A). service_role executes via `.rpc()` bypassing ACL.
- **`supabase db push` / `supabase test db`** — both cause `schema_migrations` drift / stale results. Always `psql --single-transaction -f` (apply) and `psql -tA -f` (pgTAP).
- **A static bounded-ness assert that scans ALL `>0044` migrations** — 0044/0045/0046 are revoke-only (no `create function`), and some create-function migrations legitimately have no timeout historically (0048/0049/0050). A blanket "every RPC everywhere must have statement_timeout" would fail on pre-existing RPCs. If adding a static bounded assert, SCOPE it to the NEW-RPC set (the 10 + hybrid) or to `0064` specifically — don't retroactively demand timeout on 0021–0050 RPCs (out of this phase's scope; those are older, cheaper, single-row/bounded-LIMIT surfaces).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| statement_timeout enforcement | Custom timing/kill logic | Postgres function attribute `set statement_timeout='5s'` | Native, asserted via `pg_proc.proconfig`; 0057 is the template |
| Bounded output | Manual row-slicing in app | RPC-side `LIMIT` (already present) | Enforced at the boundary (service_role bypasses RLS; the RPC is the wall) |
| Guard framework | New CLI runner | Extend existing `*.test.ts` in `app/lib` | Same vitest harness, runs in `pnpm --filter ./app test` + GSD verify; a new runner has no CI wiring |
| Applying DDL | `supabase db push` | `psql --single-transaction -f` | `db push` drifts `schema_migrations` (LOCKED lesson, repeated across STATE.md) |
| DDL proof | Trust build/typecheck | pgTAP against applied schema | build/typecheck never execute the DDL (Pitfall 6, 0060 header) |

**Key insight:** Under Camino A / service_role, RLS is bypassed by design → each RPC body is the ONLY security boundary. Bounding is a DB-level attribute, not app logic. The guards are static tripwires (denylist/allowlist), not runtime protection — their value is catching regressions in review, and they MUST bite (mutation self-check) or they're a green no-op.

---

## Common Pitfalls

### Pitfall 1: 42P13 abort on returns-table drift
**What goes wrong:** re-emitting a v2/cross-link RPC in 0064 with even a slightly different returns table → Postgres error 42P13 "cannot change return type" → aborts the entire `--single-transaction` apply, leaving PROD in a half-state (mitigated by single-transaction rollback, but the apply fails).
**How to avoid:** copy the returns tables VERBATIM from 0061 (cross-links have `total_n bigint`) and 0063 (`lobby_menciones_de_boletin` has 13 cols incl. NULL `contraparte_rol`/`representado`). The `drop function if exists` before each `create or replace` is defensive but does NOT save you if the new signature differs and another object depends on it.
**Warning signs:** any diff between the 0064 returns table and 0061/0063.

### Pitfall 2: pgTAP passing against scratch but not PROD (or vice-versa)
**What goes wrong:** the `statement_timeout=%` assert only passes after 0064 is applied. Running it against a scratch DB without 0064 → fail; running against PROD before apply → fail.
**How to avoid:** put the 0064 pgTAP in `post-apply/`; run it ONLY after the `psql --single-transaction` apply succeeds.

### Pitfall 3: static bounded-ness guard over-reaching to old RPCs
**What goes wrong:** a guard asserting "every `create function` migration has statement_timeout" fails on 0019–0050 (which legitimately lack it and are out of scope).
**How to avoid:** scope the static bounded assert to the NEW set (0064 / the 10+hybrid), or don't add a static assert at all and rely on the `0064` pgTAP for bounded-ness proof (both satisfy SC#2; pgTAP is the higher-fidelity "muerde" per Claude's Discretion).

### Pitfall 4: `crossLinkReader` name indirection defeating Direction-A guard
**What goes wrong:** if `crossLinkReader` stored the RPC name in a variable and called `sb.rpc(name)`, the static `rpcPattern` (which needs a string literal) would MISS it → a non-allowlisted cross-link could slip through.
**How to avoid:** verify `app/parlamentario/[id]/page.tsx:196-199` passes string literals to `crossLinkReader("copartidarios_de_parlamentario")` AND that `crossLinkReader` forwards a literal to `.rpc()`. (Grep already shows the 4 literals present; confirm the internal `.rpc(<literal>)`.)

### Pitfall 5: guard scanning zero files silently (process.cwd bug)
**What goes wrong:** `pnpm --filter exec` can change cwd → a guard anchored on `process.cwd()` scans zero files and passes green vacuously (MEMORY.md v8.1 bug).
**How to avoid:** the anti-insinuación guard already fixes this by anchoring on `import.meta.dirname`. `lockdown-guard.test.ts` uses `process.cwd()` (`APP_ROOT`) + a sanity assert (`sourceFiles.length > 10`). Any NEW guard code must keep a sanity assert that fails loud if it scanned nothing.

---

## Code Examples

### 0064 migration — one RPC (cross-link, with total_n)
```sql
-- Source: idiom from 0057 (statement_timeout) + 0061 (returns table with total_n)
drop function if exists public.copartidarios_de_parlamentario(text);

create or replace function public.copartidarios_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)   -- BYTE-IDENTICAL to 0061
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'          -- NEW: day-1 DoS cap (SC#2)
as $$
  -- BODY VERBATIM from 0061 (distinct on + total_n window + limit 20)
  select d.id, d.nombre, d.camara, count(*) over () as total_n
  from ( … ) d order by d.nombre limit 20;
$$;

revoke all on function public.copartidarios_de_parlamentario(text) from public;
revoke all on function public.copartidarios_de_parlamentario(text) from anon, authenticated;
```

### 0064 pgTAP — bounded-ness assert
```sql
-- Source: 0057_busqueda_hibrida_statement_timeout.test.sql lines 32-41
select ok(
  exists(
    select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.copartidarios_de_parlamentario(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en copartidarios_de_parlamentario (SC#2)'
);
```

### Direction-B allowlist assert (new, in lockdown-guard.test.ts)
```ts
// Pseudocode: allowlist ⊆ defined functions (repo-wide grep, NOT >0044)
const definedFns = new Set<string>();
for (const f of readdirSync(MIGRATIONS_DIR).filter(x => x.endsWith(".sql"))) {
  const sql = stripSqlComments(readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf-8"));
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi))
    definedFns.add(m[1]);
}
const orphans = [...PUBLIC_RPC_ALLOWLIST].filter(n => !definedFns.has(n));
expect(orphans, `Allowlist con entradas sin función definida (typo/stale): ${orphans}`).toHaveLength(0);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scout: "búsqueda híbrida SIN pgTAP" | Hybrid HAS post-apply pgTAP (0055/0056/0057) | Verified 2026-07-23 | Don't rewrite; the new pgTAP is only for 0064's timeouts |
| Scout: "9 RPCs de 0060/0061 tienen LIMIT pero cero statement_timeout" | CONFIRMED (grep: only 0057 has it) | Verified | 10 RPCs total (9 bio/cross-link + lobby_menciones) need the timeout |
| Scout: cap de match_count uncertain | CONFIRMED capped internally (`least(match_count,50)`) | Verified | No cap work for hybrid; verify it survives 0064 if hybrid is re-touched (it need not be — 0057 already has both) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crossLinkReader` forwards a string LITERAL to `.rpc()` (not a variable) so Direction-A guard catches the 4 cross-links | Drift Direction A / Pitfall 4 | If it interpolates a variable, the static guard misses non-allowlisted cross-links — planner must read `page.tsx:~190` to confirm |
| A2 | Phase-89 deep-link/tramitación-link block copy is either already in a surface array OR is factual (no banned terms) | Anti-insinuación §3 | If a deep-link surface renders insinuating copy and isn't scanned, anti-insinuación SC#1 has a hole — planner should enumerate the 89 surface |
| A3 | `'5s'` is the right timeout for the cheap RPCs (limit 20/50, single-row) | Bounded RPCs | Too low could time out a legit slow plan; but these are trivially cheap queries — `'5s'` is generous. Consistency with 0057 is the LOCKED default |
| A4 | No `parlamentario_publico`/`parlamentarios_publico`/`match_proyectos` re-touch needed (they're pre-0057 and out of the "new RPC" scope) | Bounded RPCs | `match_proyectos` (RPC vieja tras flag) is Claude's-discretion to add a timeout; recommended yes but optional |

**These 4 assumptions need the planner to (A1/A2) read two files and (A3/A4) make a discretion call — none block planning.**

---

## Open Questions

1. **Does `crossLinkReader` pass a string literal to `.rpc()`?**
   - What we know: `page.tsx:196-199` call `crossLinkReader("<literal>")` with the 4 literals; the guard's `rpcPattern` needs a literal at the `.rpc(` call site.
   - What's unclear: whether `crossLinkReader`'s body does `sb.rpc(name, …)` (variable → guard misses) or `sb.rpc("literal", …)`.
   - Recommendation: planner reads the `crossLinkReader` definition (~`app/parlamentario/[id]/page.tsx:180-195`). If it's a variable, add the 4 literals to a hardcoded "expected cross-link RPCs" set in the guard, OR keep them enumerated at the call site (they already are, so Direction A is satisfied regardless — the risk is only for FUTURE additions).

2. **Is the Phase-89 deep-link surface in an anti-insinuación surface array?**
   - What we know: `SUPERFICIES_BUSQUEDA` covers `buscar-filtros.tsx` + `app/buscar/page.tsx`; TRACE-01/02/03 (89) surfaces (official-link block, fecha-captura/snapshot) are NOT obviously listed.
   - What's unclear: the exact component name for the 89 deep-link block and whether its copy could ever insinuate.
   - Recommendation: planner greps for the deep-link component (e.g. `enlace`/`tramitacion`/`fuente oficial` in `components/`), confirms it's factual, and enumerates it in a surface array with a self-check IF the CONTEXT's "extender solo si el linter no cubre alguna superficie de P1" applies.

3. **Should `match_proyectos` get a timeout in 0064?**
   - What we know: it's the old RPC behind the híbrida flag, still served, cheap.
   - Recommendation (matches CONTEXT Claude's Discretion): yes, add it — one more `create or replace` with `set statement_timeout='5s'`, byte-identical returns table (`(vector, int, float8, text)` per 0045). Low cost, closes the "old but still served" gap. Verify its exact current signature before re-emitting.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `psql` client | Apply 0064 + run pgTAP | assumed ✓ (used every phase 0055–0063) | — | none — blocking for apply, but apply is a distinct step; guard/migration authoring needs no psql |
| `SUPABASE_DB_URL` | Apply to PROD | in `.env` (BOM → `--db-url` explicit) | — | none |
| pnpm + vitest | Run guards | ✓ (`app/` suite runs today, 1129+ tests) | — | none |
| pgTAP extension | pgTAP tests | ✓ (Supabase managed; every prior phase used it) | — | none |

**Missing dependencies with no fallback:** none identified — this phase is code/DDL authoring + a PROD apply that has direct precedent (0055–0063).

---

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json` → this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (`app/`) for guards; pgTAP (psql) for schema |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter ./app test` (runs all `app/lib/*guard*.test.ts`) |
| Full suite command | `pnpm test` (root: `packages/*` then `app/`) |
| pgTAP run | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0064_*.test.sql` (post-apply) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 (bounded) | 10 RPCs have statement_timeout | pgTAP | `psql -tA -f supabase/tests/post-apply/0064_*.test.sql` | ❌ Wave 0 (new) |
| SEC-01 (allowlist A) | served ⊆ allowlist | vitest | `pnpm --filter ./app test lockdown-guard` | ✅ (exists, verify bites new) |
| SEC-01 (allowlist B) | allowlist ⊆ defined fns | vitest | `pnpm --filter ./app test lockdown-guard` | ❌ Wave 0 (add assert) |
| SEC-01 (anti-insin) | new surfaces clean | vitest | `pnpm --filter ./app test anti-insinuacion-guard` | ✅ (personas/lobby/agenda done; verify 89) |
| SEC-01 (self-check SC#4) | guards bite on NEW | vitest | same as above | Partly ✅ (add for allowlist-B + bounded) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test <guard-name>` (single guard, <10s)
- **Per plan merge:** `pnpm --filter ./app test` (full app suite) + `tsc --noEmit`
- **Phase gate:** full `pnpm test` (1129+ app / 1103 packages) green + `0064` pgTAP "N ok, 0 not ok" against applied PROD schema

### Wave 0 Gaps
- [ ] `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` — the 10 (+match_proyectos) RPC re-emits (SC#2)
- [ ] `supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql` — has_function + prosecdef + no-anon-execute + PII-safe + `statement_timeout=%` per RPC (SC#2 proof)
- [ ] `lockdown-guard.test.ts` — Direction-B assert (allowlist ⊆ defined fns) + mutation self-check (SC#3/SC#4)
- [ ] (optional, Claude's discretion) `lockdown-guard.test.ts` — static bounded-ness assert scoped to 0064 + self-check
- [ ] `anti-insinuacion-guard.test.ts` — enumerate Phase-89 deep-link surface IF not covered + self-check (SC#1/SC#4)

*Framework install: none — vitest + pgTAP already present.*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` in config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control (this phase) |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — service_role model; anon is dead (0044) |
| V3 Session Management | no | n/a |
| V4 Access Control | **yes** | RPC allowlist (both directions) + CERO-grant doble-revoke; each RPC is the boundary under service_role |
| V5 Input Validation | **yes** | RPCs parameterize `p_id`/`q` (no string interpolation); `websearch_to_tsquery` sanitizes; `lobby_menciones` IN-01 format guard |
| V6 Cryptography | no | n/a — no crypto in scope |
| V12 Files/Resources (DoS) | **yes** | `statement_timeout='5s'` + `LIMIT` + `match_count` cap = the DoS bound (the phase's core) |

### Known Threat Patterns for {Postgres RPC under service_role, public repo, hostile subjects}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded RPC → cheap DoS on Pro-plan DB (pathological input to a no-timeout RPC) | Denial of Service | `set statement_timeout='5s'` + `LIMIT` + `least(match_count,50)` (0057 template) |
| New RPC not in allowlist → PII/expensive endpoint reachable via service_role | Information Disclosure / Elevation | Direction-A guard (served ⊆ allowlist), already present; each RPC PII-safe (pgTAP `!~* rut/email`) |
| Stale allowlist entry (typo) masking a real RPC | Tampering | Direction-B guard (allowlist ⊆ defined fns), NEW |
| Re-grant to anon in a `>0044` migration re-opens REST surface | Elevation of Privilege | lockdown Block A (grant-to-anon/public offender), already present; 0064 must doble-revoke |
| Insinuating copy on a new P1/P2 surface = defamation of hostile subject | Repudiation / (legal) | anti-insinuación denylist + NEGACIONES_LOCKED; correctness IS the legal defense |
| SQL injection via RPC param | Tampering | parameterized `p_id`/`q`, `search_path=''`, schema-qualified names (all present in 0060/0061/0063) |

---

## Sources

### Primary (HIGH confidence — repo files, read directly this session)
- `supabase/migrations/0055_busqueda_hibrida.sql` / `0056_…boletin_norm.sql` / `0057_…statement_timeout.sql` — hybrid RPC, `least(match_count,50)` cap, `statement_timeout='5s'`, doble-revoke
- `supabase/migrations/0060_bio_partido_publico.sql` / `0061_cross_links_conteo_honesto_orden.sql` — 9 bio/cross-link RPCs, LIMIT present, NO timeout, final returns tables (0061 adds `total_n`)
- `supabase/migrations/0062_…` / `0063_lobby_menciones_una_fila_por_audiencia.sql` — lobby RPC, LIMIT 50, NO timeout, 13-col returns table
- `app/lib/lockdown-guard.test.ts` — Block A (grant offenders) + Block B (PII `.from` / `.rpc` allowlist); `PUBLIC_RPC_ALLOWLIST` (26); `isAdminAllowlisted`
- `app/lib/anti-insinuacion-guard.test.ts` — surface arrays (VOTO/MONEY/HOME/BUSQUEDA/PERSONAS/LOBBY/AGENDA), `TERMINOS_PROHIBIDOS`, `NEGACIONES_LOCKED`, mutation self-checks for personas/lobby/agenda
- `supabase/tests/0060_bio_partido_publico.test.sql` / `post-apply/0057_…test.sql` — pgTAP idiom (plan/has_function/prosecdef/has_function_privilege/pg_get_function_result/proconfig)
- Grep: `statement_timeout` → only `0057`; `create function public.<name>` inventory → all 26 allowlist entries backed; `.rpc(` in `app/` → 18 distinct served names all allowlisted
- `.planning/config.json` — nyquist_validation true, security_enforcement true, commit_docs true
- `package.json` — test runner `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`
- `.planning/STATE.md` — apply precedents (0059/0060/0062 to PROD by agent), 42P13/default-privileges lessons, suite counts (1129 app / 1103 packages)

### Secondary (MEDIUM — CONTEXT/PITFALLS)
- `.planning/phases/95-…/95-CONTEXT.md` — locked decisions, scout claims (partly corrected here)
- `.planning/research/PITFALLS.md` Pitfall 12 — public-repo/hostile threat model, DoS bounding, allowlist drift

### Tertiary (LOW) — none. Every claim verified against repo.

---

## Metadata

**Confidence breakdown:**
- Bounded-RPC inventory: HIGH — read every migration; grep confirms only 0057 has statement_timeout
- Guard anatomy: HIGH — read all three guards in full
- Drift analysis: HIGH — exhaustive grep of `.rpc()` + `create function`, both directions verified
- pgTAP idiom + runner + apply precedent: HIGH — read the tests + STATE.md precedents
- Anti-insinuación 89-surface gap: MEDIUM — inferred from surface arrays; planner should confirm the exact 89 component (Open Q2)
- `crossLinkReader` literal-vs-variable: MEDIUM — literals present at call site; internal `.rpc()` not read (Open Q1)

**Scout corrections issued:** (1) hybrid DOES have pgTAP (post-apply 0055/0056/0057); (2) hybrid DOES cap match_count internally; (3) `statement_timeout` form is the function-attribute `set statement_timeout='5s'`, not `set local`.

**Research date:** 2026-07-23
**Valid until:** 2026-08-22 (stable — repo-internal, no fast-moving external deps)
