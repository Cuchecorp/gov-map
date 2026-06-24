# HANDOFF — Phase 42 (LOCKDOWN) — listo para ventana fresca

Pegá el bloque de "PROMPT DE ARRANQUE" (abajo) en una sesión nueva tras `/clear`. El andamiaje ya está commiteado: ROADMAP + REQUIREMENTS (LOCKDOWN-01..04) + `42-CONTEXT.md`.

---

## Dónde estamos
- Repo: `C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio` (git, branch master).
- Phase 41 (CRUCEN) cerrada y **ENCENDIDA** 2026-06-24: dossier de cruces firmado (`signoff: approved`), `0041` (fecha_captura) y `0042` (grant anon) aplicadas a PROD. Migraciones en PROD: 0042/0041/0040. Candado A abierto: anon ejecuta el RPC curado de cruces. Pendiente solo el redeploy de Cloudflare con `CRUCES_PUBLIC_ENABLED=true` (operador).
- **Raíz de Phase 42:** al encender cruces quedó claro que TODA la data del proyecto es consultable vía la API pública de Supabase (rol `anon`), no solo a través de la página. El operador quiere cerrar eso.

## Decisión LOCKED del operador (NO re-litigar)
- **Rol dedicado `web_reader` de mínimo privilegio**, NO `service_role`. El servidor lee como `web_reader` (RLS le aplica → PII protegido). Se revoca todo de `anon`/`authenticated`. La service key sigue siendo solo de escritores/admin.

## Hechos de arquitectura ya auditados (NO re-descubrir)
- TODAS las lecturas son server-only: `app/lib/supabase.ts` (`createServerSupabase`, anon key, sin `NEXT_PUBLIC_`). NO hay cliente browser, NO hay `@supabase/ssr`, NO hay login. Cerrar la API NO rompe features de cliente.
- El server ya tiene la service key (`app/lib/supabase-admin.ts`) — NO reutilizar para lecturas.
- Hay ~40 `grant ... to anon` (tablas public-read + RPCs) + varias policies `for select to anon using(true)`. La autoridad del inventario es la **DB VIVA en PROD** (information_schema/pg_policies), no los .sql (hay drift).

## Fuentes de verdad (LEE PRIMERO)
- `.planning/phases/42-lockdown-api-supabase-rol-web-reader/42-CONTEXT.md` — diseño LOCKED, inventario, los 5 gates, los 4 deliverables. **NO re-diseñar.**
- `.planning/ROADMAP.md` (Phase 42 Details), `.planning/REQUIREMENTS.md` (LOCKDOWN-01..04), `CLAUDE.md`, skill `supabase-ops`, memoria `memory/v4-cruces-progreso.md`.
- Código/migraciones: `app/lib/supabase.ts`, `app/lib/supabase-admin.ts`, `supabase/migrations/0008/0010/0011/0018/0021/0022/0023/0024/0030/0038/0040/0042` (modelo de grants/policies a replicar y revocar).

## Los 4 deliverables (ver 42-CONTEXT)
1. **LOCKDOWN-01** — crear `web_reader` + re-conceder el set vivo de anon (grants + policies) — migración idempotente, NO revoca aún. pgTAP.
2. **LOCKDOWN-03** — `createServerSupabase` se autentica como `web_reader` (JWT `role: web_reader`) — deploy ANTES del revoke.
3. **LOCKDOWN-02** — revocar TODO de anon/authenticated — migración que se aplica ÚLTIMA. pgTAP.
4. **LOCKDOWN-04** — verificación end-to-end (probe live anon → permission denied; sitio OK) + guard anti-regresión + runbook de cutover/rollback.

## Feasibility que la RESEARCH debe cerrar (antes de planificar)
- ¿Cuál es el JWT secret del proyecto para firmar el token `web_reader`? (¿`SUPABASE_SECRET_KEY` en .env? ¿hay que añadir `SUPABASE_JWT_SECRET`?). Confirmar contra el dashboard.
- ¿Kong acepta la anon key como `apikey` aunque `anon` no tenga grants de DB? (debería: validación de apikey ≠ grants).
- ¿Cómo inyecta supabase-js v2 un access token custom por request? (`global.headers.Authorization` / opción `accessToken`).
- ¿`grant web_reader to authenticator` basta para que PostgREST haga `set role web_reader`?
- Enumerar el set EXACTO de grants+policies de `anon` desde PROD (no de los .sql).

## Cómo proceder (igual que Phase 41: research sonnet-swarm + validadores Opus)
1. Research vía `/sonnet-swarm` (3 agentes Sonnet: LOCKDOWN-01 rol+regrants+policies; LOCKDOWN-03 JWT web_reader/supabase-js; LOCKDOWN-02 revoke exhaustivo+pgTAP) + 1-2 validadores Opus (feasibility del JWT, orden de cutover, que el re-grant sea byte-exacto del set vivo, que no se cuele PII a web_reader). El research DEBE consultar PROD vivo para el inventario.
2. Sintetiza `42-RESEARCH.md` (con `## Validation Architecture`) + `42-VALIDATION.md`. Commitea.
3. `/gsd:plan-phase 42 --skip-research` → revisa (plan-checker Opus) → `/gsd:execute-phase 42`.
4. Cierra con SUMMARY + gsd-verifier (Opus); actualiza memoria; reporta el runbook de cutover para el operador.

## GATES LOCKED — INVIOLABLES (los 5 de 42-CONTEXT)
- **ORDEN DE CUTOVER:** aplicar 01 → deployar 03 a Cloudflare → aplicar 02 (revoke ÚLTIMO). Revocar anon antes de que el server web_reader esté vivo en prod = sitio caído. Documentar rollback (re-grant anon).
- **`web_reader`, NO `service_role`** para lecturas (preservar RLS/PII).
- **Piso PII (0018) intacto:** web_reader recibe EXACTAMENTE el set de anon, ni una columna PII más.
- **El agente NO aplica a PROD ni deploya solo** — migraciones/cambio se escriben/commitean; aplicar (psql) y deployar (Cloudflare, Linux/Docker, creds CF que NO están en .env) son checkpoints de operador en el orden del cutover. (Aplicar DDL solo bajo autorización explícita del operador en la corrida.)
- **No tocar ingesta/cron (service_role) ni flags `*_PUBLIC_ENABLED`.**

## Convenciones (de este repo)
- DDL a PROD: `psql --db-url --single-transaction` + fila en `schema_migrations` (NUNCA `supabase db push`); en Windows `PGCLIENTENCODING=UTF8` + INSERT por stdin/heredoc para multibyte. pgTAP por `psql -tA -f` vs PROD.
- Monorepo pnpm (NO npm); tests `cd app && npx vitest run` + `npx tsc -b`; worktrees OFF → execute-phase serializa en master; LF EOL (normalizar si el agente escribe CRLF).
- Cargar `SUPABASE_DB_URL` sin echearla (node parse de .env, strip BOM).

Al terminar, reporta el estado y el **runbook de cutover ordenado** para que el operador lo ejecute (aplicar 01 → deploy 03 → aplicar 02 → probe), con el rollback a mano.

---
