# Phase 42: LOCKDOWN — Cierre de la API pública de Supabase (rol `web_reader`) - Context

**Gathered:** 2026-06-24
**Status:** Ready for research+planning (ventana fresca; research = sonnet-swarm + validadores Opus, igual que Phase 41)
**Source:** Decisión del operador tras el encendido de cruces (Phase 41). Temor: que la API pública de Supabase (rol `anon`) se use indiscriminadamente. Objetivo: que TODOS los datos se sirvan **solo a través de la página** (server-side), matando el canal `anon` público — **sin perder** el candado RLS que hoy protege el PII.

<domain>
## Phase Boundary

Eliminar la superficie de API pública de Supabase: revocar TODOS los permisos del rol `anon` (y `authenticated`) sobre RPCs y tablas, y hacer que el servidor de Next.js lea como un **rol dedicado de mínimo privilegio `web_reader`** (NO la service key — eso bypassearía RLS y tiraría la defensa PII). Tras el cambio, la anon key deja de servir para extraer datos: cualquier llamada directa a la API (PostgREST) con la anon key devuelve `permission denied`. El sitio sigue renderizando TODAS sus superficies, porque el servidor lee como `web_reader`, que conserva EXACTAMENTE los permisos curados que hoy tiene `anon`.

**EN ALCANCE:**
- Crear el rol `web_reader` (NOLOGIN) y concederle EXACTAMENTE el set curado que hoy tiene `anon` (execute en los RPCs públicos + select en las tablas public-read + las RLS policies `for select` equivalentes).
- Revocar TODO de `anon` y `authenticated` (execute en RPCs, select en tablas, y las policies `to anon`).
- Cambiar `app/lib/supabase.ts` (`createServerSupabase`) para autenticarse como `web_reader` (JWT firmado con claim `role: web_reader`) en vez de usar la anon key directa.
- Verificación end-to-end (probe live: anon key → permission denied en todo; sitio → todas las superficies OK) + guard anti-regresión.
- Runbook de cutover ORDENADO (el orden es load-bearing: ver gates).

**FUERA DE ALCANCE:**
- NO se toca el pipeline de ingesta/cron (escritores `service_role`) — siguen igual.
- NO se introduce login de usuarios / Supabase Auth (el sitio es read-only público; no hay sesión).
- NO se reescribe el data layer a conexión Postgres directa (se mantiene supabase-js/PostgREST; solo cambia la credencial).
- NO se tocan flags `*_PUBLIC_ENABLED` (eso es presentación/UI, ortogonal a este cambio de canal de datos).
</domain>

<decisions>
## Implementation Decisions (LOCKED por el operador / a refinar en research)

### Hecho central de arquitectura (auditado 2026-06-24)
- **TODAS las lecturas ya son server-only.** `app/lib/supabase.ts` es `import "server-only"`, usa `SUPABASE_ANON_KEY` SIN prefijo `NEXT_PUBLIC_` → la anon key NO viaja al bundle del navegador. NO hay cliente browser, NO hay `@supabase/ssr`, NO hay `createBrowserClient`, NO hay login. Las superficies "use client" son presentacionales (reciben props del Server Component). → **Cerrar la API NO rompe ninguna feature de cliente.** Único punto de lectura a migrar: `createServerSupabase`.
- El servidor YA tiene la service key disponible (`app/lib/supabase-admin.ts`, `SUPABASE_SERVICE_KEY`) usada por operaciones admin — NO se reutiliza para lecturas públicas (bypassa RLS).
- Hoy el servidor y el público usan el MISMO rol (`anon`). Por eso no se puede "revocar de anon" sin migrar antes la credencial del servidor.

### LOCKED: rol dedicado `web_reader` (opción elegida por el operador; NO service_role)
- **Por qué:** preserva la filosofía deny-by-default del proyecto. `web_reader` es un rol Postgres normal y restringido → la **RLS le sigue aplicando** → el PII (rut/partido/donante_id, declaraciones crudas) sigue protegido aunque haya un bug en una query del server. `service_role` habría sido más simple pero bypassa RLS = downgrade de defensa en profundidad (descartado).
- **Forma (a confirmar feasibility en research):** crear `web_reader` NOLOGIN; `grant web_reader to authenticator` (para que PostgREST pueda `set role web_reader`); el servidor firma un JWT corto con claim `{ "role": "web_reader" }` usando el **JWT secret del proyecto** y lo pasa como `Authorization: Bearer`, manteniendo la anon key como `apikey` (Kong exige una apikey válida para pasar el gateway; la validación de apikey es independiente de los grants de DB). Research DEBE confirmar: (a) que existe/forma de obtener el JWT secret (¿`SUPABASE_SECRET_KEY` en .env? ¿hay que añadir `SUPABASE_JWT_SECRET`?), (b) que Kong acepta la anon key como apikey aunque `anon` no tenga grants de DB, (c) que supabase-js permite inyectar un access token custom por request (global headers / `accessToken` option).

### Inventario a replicar a `web_reader` (autoridad = la DB VIVA, no las migraciones)
- La fuente de verdad del set a re-conceder es el **estado VIVO en PROD**, no los .sql (hay drift por revokes/re-grants). Research enumera con:
  - `select grantee, table_name, privilege_type from information_schema.role_table_grants where grantee='anon';`
  - `select grantee, routine_name from information_schema.role_routine_grants where grantee='anon';`
  - policies: `select schemaname, tablename, policyname, roles, cmd from pg_policies where 'anon' = any(roles);`
- Inventario observado por grep de migraciones (referencia, NO autoritativo): **Tablas** proyecto/votacion/voto/tramitacion_evento (0008), citacion/citacion_invitado/citacion_punto/sesion_sala/sesion_tabla_item (0010), proyecto_ficha/proyecto_embedding (0011), sector (0038), lobby_audiencia (0021), declaracion+6 tablas declaracion_* (0022), aporte (0024), contrato (0023), *_ingesta_estado (0021/0022/0023/0024). **RPCs** match_proyectos, votos_de_parlamentario, rebeldias_de_parlamentario, parlamentario_publico, parlamentarios_publico, declaraciones_de_parlamentario, comparar_declaraciones, bienes_de_parlamentario, lobby_de_parlamentario, aportes_de_parlamentario, agregado_por_contraparte, contratos_de_parlamentario, buscar_citaciones, subgrafo_red, cruces_de_parlamentario.
- **CRÍTICO — no son solo GRANTs:** varias tablas public-read dependen de una **RLS policy `for select to anon using(true)`** (p.ej. proyecto/votacion/sector/citacion/proyecto_ficha). Para que `web_reader` lea esas tablas bajo RLS, hay que recrear esas policies para `web_reader` (paralelas `for select to web_reader using(true)`), no basta el GRANT. Research inventaría policies Y grants.

### LOCKDOWN-01 — crear `web_reader` + re-conceder el set curado
- Migración: `create role web_reader nologin; grant web_reader to authenticator;` + para cada grant vivo de `anon`, el mismo a `web_reader`; + recrear las policies `to anon using(true)` como `to web_reader`. Idempotente (`do $$ ... if not exists`). NO revoca nada de anon todavía (sin efecto sobre la API actual). Aplicable a PROD = checkpoint operador (`psql --db-url --single-transaction` + schema_migrations). pgTAP: `web_reader` tiene execute/select sobre todo el set; puede invocar un RPC representativo.

### LOCKDOWN-03 — switch del servidor a `web_reader` (deploy ANTES del revoke)
- `createServerSupabase` deja de usar la anon key como token; firma/usa un JWT `role: web_reader`. Mantener `import "server-only"`. Tests del cliente (forma del token, server-only). Este cambio se DEPLOYA a Cloudflare ANTES de aplicar LOCKDOWN-02 (orden de cutover, gate).

### LOCKDOWN-02 — revocar TODO de `anon` y `authenticated` (mata la API pública)
- Migración: para cada objeto del inventario, `revoke execute/select ... from anon, authenticated;` + `drop policy` de las policies `to anon`. Se aplica **ÚLTIMA**, DESPUÉS de que el server `web_reader` esté vivo en prod. pgTAP: `anon` y `authenticated` SIN execute en ningún RPC y SIN select en ninguna tabla (probe exhaustivo sobre el inventario); `web_reader` intacto.

### LOCKDOWN-04 — verificación end-to-end + guard anti-regresión
- Probe live (operador): `curl` con la anon key contra cada RPC/tabla → `permission denied`/401/42501; el sitio (server como web_reader) renderiza votaciones, lobby, patrimonio, dinero, NET, cruces, búsqueda, agenda, parlamentarios, proyecto. Guard CI: falla si reaparece un `grant ... to anon` en migraciones nuevas o si el server hace `select` de columna PII conocida.

### Claude's Discretion (research/plan)
- Forma exacta del minteo del JWT `web_reader` (lib de firma, TTL, caché) vs alternativas (¿API keys nuevas de Supabase sb_secret_ mapeadas a rol? ¿`accessToken` callback de supabase-js v2?).
- Si LOCKDOWN-01/02 son una migración con dos fases o dos migraciones separadas (recomendado: separadas, por el orden de cutover).
- Granularidad de planes/waves.
</decisions>

<canonical_refs>
## Canonical References (READ antes de planificar/implementar)

### El punto de lectura a migrar
- `app/lib/supabase.ts` — `createServerSupabase()` (usa `SUPABASE_ANON_KEY`; el que cambia a `web_reader`).
- `app/lib/supabase-admin.ts` — usa `SUPABASE_SERVICE_KEY` (NO reutilizar para lecturas; referencia de cómo el server ya maneja una credencial alterna).
- Consumidores: todos los Server Components/`page.tsx` que llaman `createServerSupabase().rpc(...)`/`.from(...)` (grep `createServerSupabase`).

### El modelo de permisos a replicar/revocar (migraciones espejo)
- `supabase/migrations/0008_tramitacion.sql` (grants + policies public-read base), `0010_agenda.sql`, `0011_fichas_embeddings.sql`, `0038_sector.sql` — patrón `grant select to anon` + `create policy ... for select to anon using(true)`.
- `0018_piso_pii.sql` — el PISO PII (deny-by-default, NINGÚN grant/policy a anon sobre PII) — el invariante que `web_reader` NO debe violar.
- `0021_lobby.sql`/`0022_probidad.sql`/`0023_dinero.sql`/`0024_servel.sql`/`0030_net.sql`/`0040_cruces_rpc.sql`/`0042_cruces_grant_anon.sql` — RPCs security-definer + grants a anon.
- **Autoridad real = PROD vivo** (information_schema/pg_policies), no estos archivos.

### Convenciones
- `CLAUDE.md` — DDL = `psql --db-url --single-transaction` + fila en `schema_migrations` (NUNCA `supabase db push`); pgTAP por `psql -tA -f` vs PROD aplicado; pnpm monorepo; tests `cd app && npx vitest run` + `npx tsc -b`; LF EOL.
- Memoria: `memory/v4-cruces-progreso.md` (gotchas pgTAP-vs-PROD; el encendido de cruces que motivó esta fase).
- `.env` (server): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`/`SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_ID`. Research confirma cuál es el JWT secret para firmar el token web_reader (y si falta, qué añadir).
</canonical_refs>

<gates_LOCKED>
## Gates inviolables

1. **ORDEN DE CUTOVER (load-bearing):** aplicar LOCKDOWN-01 (web_reader recibe grants) → deployar LOCKDOWN-03 (server lee como web_reader) a PROD → SOLO ENTONCES aplicar LOCKDOWN-02 (revoke anon). Revocar anon ANTES de que el server web_reader esté vivo en prod = **sitio caído** (server lee como anon → permission denied). El revoke (LOCKDOWN-02) se aplica ÚLTIMO. Documentar runbook + rollback (re-grant anon si algo falla).
2. **`web_reader`, NO `service_role`, para lecturas.** La service key bypassa RLS; usarla para el canal público tiraría el candado PII. La service key sigue siendo SOLO de escritores/admin.
3. **PISO PII intacto (0018):** `web_reader` recibe EXACTAMENTE el set curado de `anon` — ni una columna/tabla PII más. rut/partido/donante_id/declaraciones crudas siguen deny-by-default bajo RLS para web_reader.
4. **El agente NO aplica a PROD ni deploya solo:** las migraciones y el cambio de server se ESCRIBEN/commitean; aplicar 01/02 (psql) y deployar 03 (Cloudflare, Linux/Docker, creds CF que NO están en .env) son checkpoints de operador, en el orden del gate 1. (El agente puede aplicar la DDL solo bajo autorización explícita del operador en la corrida, respetando el orden.)
5. **Sin tocar ingesta/cron (service_role) ni flags `*_PUBLIC_ENABLED`.**
</gates_LOCKED>

<deferred>
## Deferred
- Login de usuarios / Supabase Auth (no existe hoy; si algún día se agrega, revisar el rol `authenticated`).
- Migrar a conexión Postgres directa server-side (alternativa más invasiva; no necesaria si el JWT web_reader funciona).
- Rotar/regenerar la anon key (opcional; tras el revoke la anon key es inútil para datos, pero rotarla es higiene — evaluar aparte).
</deferred>

---

*Phase: 42-lockdown-api-supabase-rol-web-reader*
*Context gathered: 2026-06-24 — raíz: temor del operador a uso indiscriminado de la API pública tras el encendido de cruces (Phase 41)*
