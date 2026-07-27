# Phase 69: DINERO P5a — RUT-01 backfill a la maestra (CHECKPOINT OPERADOR) - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (data/PII phase — discuss skipped; decisions locked by minimización + fail-closed rules)

<domain>
## Phase Boundary

Poblar FÍSICAMENTE el RUT en la maestra (`entidad_tercero`/`parlamentario`) — DATO bloqueante de TODO P5; sin RUT presente, cualquier cruce de dinero rinde `null` (o peor, FALSO por name-match). El backfill usa `harvest-rut.ts`/`runBackfillRut` (YA EXISTEN): Track B (seed curado como default) + Track A (SERVEL como corroboración), con DV-gate módulo-11 y provenance NOT NULL. La ESCRITURA remota (vía db-url) es un CHECKPOINT DE OPERADOR (bloqueante duro) — el agente construye/valida el mecanismo, los guards y la medición de cobertura; el operador ejecuta la escritura. Esta fase arranca P5 (paralelizable con P3).

</domain>

<decisions>
## Implementation Decisions

### PII / minimización (LOCKED — rector)
- El RUT NUNCA cruza al LLM ni a una tabla/ruta PÚBLICA. RLS deny-by-default sobre la columna `rut`. Minimización de dato.
- Name-match NUNCA escribe el `rut` de la maestra (name-uniqueness ≠ RUT-ownership). Un name-match SOLO corrobora un RUT ya presente, o encola a revisión humana. Un GUARD CI lo enforça (fail-closed).
- DV-gate módulo-11 obligatorio antes de escribir cualquier RUT; provenance NOT NULL (de dónde vino el RUT).
- Cobertura de RUT DV-válido MEDIDA y DECLARADA como techo honesto (N/M); "sin dato de RUT" ≠ "sin vínculos".

### Track B default / Track A corroboración
- Track B (seed curado) es el default de escritura; Track A (SERVEL) corrobora, no sobre-escribe a ciegas.

### Checkpoint operador
- La escritura remota a la maestra (db-url) NO la ejecuta el agente. El agente entrega el mecanismo validado + runbook + guards + medición; el operador corre la escritura y reporta cobertura N/M.

### Claude's Discretion
Detalles de implementación del mecanismo/guard/medición dentro de las reglas anteriores; reusar `harvest-rut.ts`/`runBackfillRut` existentes.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- `harvest-rut.ts` / `runBackfillRut` — mecanismo de backfill de RUT.
- Maestra `entidad_tercero` / `parlamentario` (respaldada fuera de Supabase por diseño).
- Patrón de guard CI (lockdown-guard, anti-insinuacion-guard de Phase 68) para el guard name-match-nunca-escribe-RUT.
- DV módulo-11 (verificador de dígito verificador chileno) — confirmar si existe util o crearlo.
- RLS deny-by-default (Candado A/B de fases previas; service_role bypassa RLS → guard CI escanea rutas públicas por PII).

</code_context>

<specifics>
## Specific Ideas

- DV-gate módulo-11 antes de escribir.
- Provenance NOT NULL por RUT (Track B seed / Track A SERVEL).
- Guard CI: name-match nunca escribe `rut`; solo corrobora o encola revisión humana.
- Cobertura N/M DV-válido declarada (techo por causa: sin dato, DV inválido, ambigüedad).
- RLS deny-by-default sobre `rut`; nunca a LLM ni ruta pública.

</specifics>

<deferred>
## Deferred Ideas

- Cruces de dinero (ChileCompra Phase 70, SERVEL financiamiento Phase 71) — dependen de esta fase.
- La escritura remota real = acto de operador (checkpoint), no de esta corrida autónoma.
</deferred>
