# Phase 110: V7GATES P4a — Applies delegables 0052-0054 + CI/secrets + rotación B26 - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Cerrar lo DELEGABLE de los gates v7.0. El agente aplica las migraciones aditivas
0052/0053/0054 a PROD (por `psql --single-transaction`, NUNCA `db push`, runbooks
72/74 existentes) y verifica sus pgTAP contra el schema aplicado. Prepara y verifica
la plomería de CI/secrets (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` en GH)
y la rotación del DB password B26 (runbook 75). El operador provee los valores de
secreto y rota la credencial; el agente NUNCA carga valores de secreto ni rota.

Fuera de alcance: RUT-01 y backfills (Phase 111); flip MONEY y audit/complete
(Phase 112).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (rectoras del PROMPT PASADA 3 — YA resueltas por el operador)
- Migraciones por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`, NUNCA `supabase db push`; BOM esquivado; aplicar UNA vez cada una.
- 0052: verificar el constraint `cruce_senal_tipo_senal_check` contra `pg_constraint` ANTES del drop (Pitfall A1 del runbook 72-APPLY).
- ANTES de aplicar cualquier migración: verificar contra `schema_migrations` LIVE + `pg_constraint`/objetos reales qué está YA aplicado (memoria contradictoria: v8.1 sugiere 0053/0054 aplicadas; Phase 74 dice 0054 no aplicada). Si una migración ya está aplicada, se declara no-op honesto y se corre solo su pgTAP de verificación — no se re-aplica.
- pgTAP contra el schema APLICADO (no scratch): `0052_...test.sql`, y los de 0053/0054 si existen; reportar N/N ok.
- CI/secrets y rotación B26 = CHECKPOINT operador blocking-human. El agente documenta pasos exactos zero-credential-values, verifica el estado post-carga (la url vieja falla / la nueva funciona / CI verde) pero NO ejecuta la carga ni la rotación.
- Query DB viva: filtro `not exists (pg_depend deptype='e')`; read-only; JAMÁS imprimir `SUPABASE_DB_URL`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Runbooks load-bearing en `.planning/phases/`: `72-APPLY-RUNBOOK.md` (0052), notas 74 (0054), `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` (B26).
- Migraciones: `supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql`, `0053_*`, `0054_*`.
- pgTAP: `supabase/tests/0052_*.test.sql` (+ 0053/0054 si existen).

### Established Patterns
- Applies aditivos a PROD por psql directo con `--single-transaction` (precedente 0059-0068).
- `schema_migrations` retomada en 0069 (0059-0068 sin traza — normal); verificar por objetos reales, no solo por la tabla.

### Integration Points
- GH Actions deploy workflow referencia `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (referencia YAML ya correcta).
- `SUPABASE_DB_URL` (blast radius de B26); CI/sitio corren con `SUPABASE_SECRET_KEY` (service_role REST, no afectados por la rotación).

</code_context>

<specifics>
## Specific Ideas

Runbooks existentes son la fuente de verdad de los pasos; no reinventar. El plan
debe partir por VERIFICAR el estado real de PROD (qué migraciones ya están) antes
de aplicar nada.

</specifics>

<deferred>
## Deferred Ideas

- RUT-01 + backfills → Phase 111.
- Flip MONEY + audit/complete v7.0 + cierre quick tasks → Phase 112.

</deferred>
