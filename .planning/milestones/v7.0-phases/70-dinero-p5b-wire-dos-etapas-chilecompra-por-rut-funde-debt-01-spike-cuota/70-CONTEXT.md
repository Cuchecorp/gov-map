# Phase 70: DINERO P5b — Wire dos-etapas ChileCompra por RUT (funde DEBT-01, SPIKE cuota) - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (wire/backfill phase, gated OFF — discuss skipped; decisions locked by two-stage + fail-closed + MONEY-gate rules)

<domain>
## Phase Boundary

Poblar los contratos del Estado por RUT EXACTO vía ingesta de DOS ETAPAS (fuente→R2→Supabase), CONSTRUIDO DETRÁS del flag `MONEY_PUBLIC_ENABLED` (OFF). El mismo wire mata DEBT-01 (dos-etapas) para ChileCompra: hoy `ingest-run` marca "R2 BLOQUEADO" para ChileCompra → esta fase lo desbloquea. Componentes `connector-chilecompra.ts` + `reconciliar-contrato.ts` + tablas `contrato/contratista` (0023) YA EXISTEN. La rama de persona jurídica reconcilia SOLO por RUT exacto fail-closed — nunca `correrPipeline`/LLM/name-match (reforzado por el brand `FilaRutCorroborada` de Phase 69). SPIKE: cuota ChileCompra (10k/día) por universo de diputados; mecánica bulk OCDS no documentada.

</domain>

<decisions>
## Implementation Decisions

### Gate MONEY (LOCKED)
- Todo detrás de `MONEY_PUBLIC_ENABLED` OFF (deny-by-default). El agente construye HASTA el gate; el encendido es acto humano con sign-off legal (Phase 73). Guard CI anti-flip.
- Contratos existen en la DB pero NO se presentan públicamente hasta el flip legal.

### Dos etapas + respeto fuente (LOCKED)
- Etapa 1 fuente→R2 crudo content-addressed primero; Etapa 2 R2→Supabase; `--from-r2` replay. Serial por RUT respetando 2-3s.
- Ticket `CHILECOMPRA_TICKET` REDACTADO en logs (nunca en claro).
- Cuota 10k/día → crawl partido en varios días, LOCAL reanudable.
- freshness cubre ChileCompra con staleness.

### Reconciliación RUT-exacto fail-closed (LOCKED, defamación)
- Persona jurídica reconcilia SOLO por RUT exacto. Nunca name-match / `correrPipeline` / LLM. Un RUT ausente → sin vínculo (null), nunca falso por nombre.
- Monto VERBATIM string (nunca re-formatear/parsear a número que altere el dato de la fuente).

### Backfill LOCAL (operador)
- El crawl LIVE (cuota-limitado, ticket) es operador-LOCAL reanudable, NO GitHub Actions. El agente entrega el wire + tests con datos fake + runbook.

### Claude's Discretion
Detalles del wire dentro de las reglas; reusar `connector-chilecompra.ts`, `reconciliar-contrato.ts`, tablas 0023.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research (SPIKE). YA EXISTEN:
- `connector-chilecompra.ts` (fetch OCDS/API ChileCompra), `reconciliar-contrato.ts` (rama jurídica por RUT).
- Tablas `contrato`/`contratista` (migración 0023).
- Wire dos-etapas de Phase 66/67 (`runIngest` con r2Store/snapshotWriter/fromR2; fail-closed R2 Stage-1). `ingest-run` marca ChileCompra "R2 BLOQUEADO" hoy → desbloquear.
- Brand `FilaRutCorroborada` (Phase 69) — RUT escribible sólo vía DV-gate; refuerza el fail-closed por RUT.
- `MONEY_PUBLIC_ENABLED` flag + guard anti-flip. Cobertura freshness (Phase 68/69 patrón).

</code_context>

<specifics>
## Specific Ideas

- `--from-r2` replay; serial por RUT 2-3s; `CHILECOMPRA_TICKET` redactado.
- Monto VERBATIM string con fuente/fecha/enlace.
- Cuota 10k/día → multi-día LOCAL reanudable.
- freshness señal ChileCompra staleness.
- SPIKE: caracterizar cuota + mecánica bulk OCDS (no documentada) contra la fuente si es alcanzable; si no, fallback honesto documentado.

</specifics>

<deferred>
## Deferred Ideas

- Materializador `cruce_senal` con `lobby_sector_aporte` → Phase 72.
- Superficies MONEY + flip legal → Phase 73 (acto humano).
- SERVEL financiamiento → Phase 71.
- El crawl LIVE real = operador-LOCAL (cuota/ticket), no esta corrida.
</deferred>
