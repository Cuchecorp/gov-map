# Phase 23: OPS — Aplicar migraciones remotas pendientes + pgTAP verde - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous OPS phase — discovery done inline)

<domain>
## Phase Boundary

Hacer visible cualquier dato poblado de v3.0 aplicando al Supabase remoto las
migraciones/RPC pendientes (0026 `parlamentarios_publico`, 0028 `votos_instructivos`,
0030 `net`) por `psql --db-url` —NUNCA `supabase db push` (drift `schema_migrations`
≤0025)— con pgTAP verde y las RPC probadas en vivo. Precondición dura de todas las
fases de datos.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (OPS — verificación, no construcción)
- Conexión por `SUPABASE_DB_URL` (pooler sa-east-1) extraído de `.env` con strip de BOM vía node.
- pgTAP corrido con `psql -tA -f` directo contra el remoto (pgtap ya instalado en el remoto).
- RPC probadas con `set role anon` para ejercer el canal público real.
</decisions>

<code_context>
## Existing Code Insights

- Migraciones 0026/0028/0030 ya estaban aplicadas al remoto (verificado por introspección).
- pgTAP tests: `0027` (→0026), `0029` (→0028), `0030` (→0030).
- `entidad`/`arista` son deny-by-default con `revoke all from anon` (no solo RLS).
</code_context>

<specifics>
## Specific Ideas

- El único delta de código fue un bug latente en `supabase/tests/0030_net.test.sql`
  (aserción de la forma equivocada + plan count off-by-one).
</specifics>

<deferred>
## Deferred Ideas

None.
</deferred>
