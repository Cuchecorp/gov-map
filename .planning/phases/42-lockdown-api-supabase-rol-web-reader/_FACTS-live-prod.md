# Phase 42 LOCKDOWN — AUTHORITATIVE LIVE FACTS (PROD, 2026-06-24)

Queried directly against PROD pooler (`information_schema`, `pg_policies`, `pg_proc`, `pg_class`, `pg_roles`).
These are the ground truth. Do NOT re-derive from .sql migrations (drift). Do NOT re-query PROD; use these.

## Roles (pg_roles)
- `anon` NOLOGIN, `authenticated` NOLOGIN, `service_role` NOLOGIN, `authenticator` **LOGIN**.
- `web_reader` DOES NOT EXIST yet.
- In Supabase, `authenticator` is the login role PostgREST connects as; it `SET ROLE` to anon/authenticated/service_role per request. For PostgREST to `SET ROLE web_reader`, **`authenticator` must be a member of `web_reader`** → `GRANT web_reader TO authenticator;`.

## anon's EFFECTIVE grants (the Supabase default-privilege reality)
- `anon` (and `authenticated`) hold **ALL** table privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) on EVERY table in `public` — this is Supabase's baked-in `ALTER DEFAULT PRIVILEGES ... GRANT ALL ... TO anon`. The writes are INERT because RLS has no permissive write policy for anon.
- `anon`/`authenticated` hold **EXECUTE on every function** in `public` — including the **pgTAP harness** (`has_table`, `is`, `ok`, `throws_ok`, hundreds of `_*`/`*_are`/`has_*`/`is_*`) AND **pgvector** functions (`vector_*`, `halfvec_*`, `l2_distance`, `cosine_distance`, `<=>` backing funcs). Same default-privilege source.
- `anon` holds USAGE on 27 sequences (default privilege). Read-only role does NOT need these.
- `anon`/`authenticated` hold USAGE on schema `public` (implicit; required to touch any object).

## What ACTUALLY makes data public = the 26 RLS SELECT policies (NOT the grants)
RLS is enabled on all 46 data tables. A table is publicly readable ONLY if it has a permissive `FOR SELECT TO anon USING(true)` policy. There are **exactly 26**, all named `<table>_public_read`, `cmd=SELECT`, `roles={anon}`, `qual=true`:

```
aporte, aportes_ingesta_estado, citacion, citacion_invitado, citacion_punto,
contrato, contratos_ingesta_estado, declaracion, declaracion_accion_derecho,
declaracion_actividad, declaracion_bien_inmueble, declaracion_bien_mueble,
declaracion_pasivo, declaracion_valor, lobby_audiencia, lobby_ingesta_estado,
probidad_ingesta_estado, proyecto, proyecto_embedding, proyecto_ficha, sector,
sesion_sala, sesion_tabla_item, tramitacion_evento, votacion, voto
```

## PII tables = deny-by-default (NO public_read policy → anon reads 0 rows despite the ALL grant)
`parlamentario` (raw, incl rut), `donante`, `pii_contraparte_declaracion`, `entidad_tercero`,
`entidad`, `entidad_tercero_alias`, `lobby_contraparte`, `contratista`, `cruce_senal`, `arista`,
`vinculo_identidad` (FORCE RLS), `vinculo_entidad` (FORCE RLS), `identidad_audit` (FORCE RLS),
`revision_identidad`, `revision_entidad`, `ingest_run`, `source_snapshot`, `drift_alert`,
`declaracion_familiar`, `parlamentario_alias`.
These are exposed to the public ONLY via curated security-definer RPCs (PII-safe projections). The PII floor (migration 0018) = these have RLS enabled + NO `to anon` policy.

## The 15 curated public RPCs (EXECUTE granted to anon in PROD) — confirmed
| RPC | anon EXEC | authed EXEC | secdef | notes |
|---|---|---|---|---|
| agregado_por_contraparte | t | t | **t** | |
| aportes_de_parlamentario | t | t | **t** | |
| bienes_de_parlamentario | t | t | **t** | |
| buscar_citaciones | t | t | **f** | runs as caller → needs SELECT citacion (in 26) + FTS |
| comparar_declaraciones | t | t | **t** | |
| contratos_de_parlamentario | t | t | **t** | |
| cruces_de_parlamentario | t | **f** | **t** | anon-only grant (0042); NOT granted to authenticated |
| declaraciones_de_parlamentario | t | t | **t** | |
| lobby_de_parlamentario | t | t | **t** | |
| match_proyectos | t | t | **f** | runs as caller → needs SELECT proyecto/proyecto_embedding (in 26) **+ pgvector operator EXECUTE** |
| parlamentario_publico | t | t | **t** | |
| parlamentarios_publico | t | t | **t** | |
| rebeldias_de_parlamentario | t | t | **f** | runs as caller → needs SELECT votacion/voto (in 26) |
| subgrafo_red | t | t | **t** | |
| votos_de_parlamentario | t | t | **f** | runs as caller → needs SELECT votacion/voto/proyecto (in 26) |

`resolver_entidad` = anon **f** (correctly deny; admin-only via service_role). DO NOT grant to web_reader.

**KEY (CORRECTED by Opus validators — do NOT use broad `ON ALL`):** the secdef=f RPCs are covered by ENUMERATED grants because pgvector operator funcs are PUBLIC-executable (PROD ACL `=X/supabase_admin`) and `match_proyectos` only reads `proyecto_embedding` (∈ the 26). Give web_reader an ENUMERATED set: SELECT on the 26 named tables + EXECUTE on the 15 named RPCs (by signature) + USAGE on schema public + membership in authenticator. NOT `GRANT … ON ALL …` — that would over-grant `resolver_entidad` (anon=f) and the 2 pgTAP VIEWS (`pg_all_foreign_keys`, `tap_funky`, relkind=v → RLS bypass), violating gate 3. Enumeration = strict subset of anon. See `42-RESEARCH.md` §0/§3 (authoritative).

## App functional surface (grep `createServerSupabase()` in app/)
- `.from(...)`: proyecto, proyecto_ficha, tramitacion_evento, votacion, citacion, sesion_sala, contratos_ingesta_estado, aportes_ingesta_estado, lobby_ingesta_estado, probidad_ingesta_estado (all ⊂ the 26).
- `.rpc(...)`: parlamentario_publico, parlamentarios_publico, agregado_por_contraparte, buscar_citaciones, cruces_de_parlamentario, subgrafo_red, match_proyectos (all ⊂ the 15).
- `admin/revisar-entidades` uses `createAdminSupabase()` (service key) for `revision_entidad`/`resolver_entidad` — NOT web_reader. Out of scope.
- Single read chokepoint to migrate: `app/lib/supabase.ts` `createServerSupabase()`.

## JWT / credential reality (.env + decoded)
- `SUPABASE_ANON_KEY` = legacy **HS256** JWT, payload `{"iss":"supabase","ref":"bctyygbmqcvizyplktuw","role":"anon","iat":1781724064,"exp":2097300064}`. Signed with the project's **legacy JWT secret** (symmetric HS256). The server uses it today and it works → the legacy JWT secret is live.
- To mint a web_reader token: sign `{"iss":"supabase","ref":"bctyygbmqcvizyplktuw","role":"web_reader","iat":<now>,"exp":<now+TTL>}` with the SAME legacy JWT secret (HS256). PostgREST validates signature + does `SET ROLE web_reader`.
- **`SUPABASE_JWT_SECRET` is NOT in .env** → operator must add it (Dashboard → Settings → API → JWT Settings → JWT Secret). This is a feasibility checkpoint, not a blocker.
- `SUPABASE_SECRET_KEY` = `sb_secret_…` (41 chars, new-format key, maps to service_role / bypasses RLS) — **NOT** the JWT signing secret; cannot sign a web_reader JWT. Do NOT use it for reads.
- Kong validates the `apikey` header by JWT signature independent of DB grants → the anon key stays valid as `apikey` forever (even after anon's DB grants are revoked). PostgREST picks the DB role from the `Authorization: Bearer` JWT's `role` claim.
- supabase-js v2: pass a custom bearer via the `accessToken: async () => <jwt>` client option (keeps `apikey`=anonKey for Kong, overrides the Authorization bearer). Direct callers holding only the anon key send `Authorization: Bearer <anonKey>` → role anon → revoked → permission denied. Exactly the goal.

## Cutover order (LOCKED gate, load-bearing)
1. Apply LOCKDOWN-01 (web_reader created + grants) — no effect on live API.
2. Deploy LOCKDOWN-03 to Cloudflare (server reads as web_reader) — requires SUPABASE_JWT_SECRET in CF env.
3. Apply LOCKDOWN-02 (revoke anon/authenticated) LAST — kills public API.
Revoking anon before step 2 = site down (server still reads as anon). Rollback = re-grant anon (re-create the 26 policies + re-grant) / redeploy old server.

## Repo conventions
- DDL to PROD: `psql "<SUPABASE_DB_URL>" --single-transaction -f mig.sql` + INSERT row into `schema_migrations` (NEVER `supabase db push`). Windows: `PGCLIENTENCODING=UTF8`, multibyte via stdin heredoc. Load SUPABASE_DB_URL via node .env parse (strip BOM), never echo.
- pgTAP runner = `psql -tA -f tests/xxxx.test.sql` vs PROD-applied schema. Header "supabase test db" is stale boilerplate.
- Monorepo pnpm. Tests: `cd app && npx vitest run` + `npx tsc -b`. LF EOL (normalize if agent writes CRLF).
- Migrations dir: `supabase/migrations/`. Next migration number = **0043** (PROD has 0042/0041/0040…). LOCKDOWN-01 = 0043, LOCKDOWN-02 = 0044 (separate files, cutover order).
