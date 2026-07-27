# Phase 111: V7GATES P4b — RUT-01 + backfills LIVE (votos + dinero) - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Mode:** Execution phase — decisions LOCKED by existing runbooks 69/66/67/70/71 (no design grey areas)

<domain>
## Phase Boundary

Poblar los datos que los gates v7.0 dejaron pendientes, en ORDEN DURO:
**RUT-01 (runbook 69) → votos Cámara (66) + Senado (67) → ChileCompra por RUT (70, POST RUT-01) + SERVEL .xlsx (71)**.

Cada write LIVE es un **checkpoint blocking-human** que el OPERADOR ejecuta LOCAL (no CI). El agente:
(1) verifica la maquinaria (tests de mecanismo + guards + RLS/lockdown) offline;
(2) reporta la cobertura baseline N/M;
(3) consolida los runbooks en un checkpoint doc en orden de dependencia;
(4) tras cada corrida del operador, verifica cobertura N/M + invariantes.

El agente **JAMÁS** escribe RUT (guard compilador `FilaRutCorroborada` + name-match≠write-rut), no toca db-url de write, no corre crawls LIVE, no consume cuota, no coloca .xlsx. MONEY sigue `MONEY_PUBLIC_ENABLED` OFF (flip = Phase 112).

</domain>

<decisions>
## Implementation Decisions (LOCKED por runbooks + PROMPT PASADA 3)

### Orden DURO
- RUT-01 PRIMERO (bloqueante duro de dinero: sin RUT, ChileCompra no tiene universo → null o FALSO por name-match).
- Votos (66/67) independientes de RUT (pueden correr en cualquier orden vs dinero).
- ChileCompra (70) SOLO post RUT-01. SERVEL (71) no depende de RUT (cruce por nombre determinista).

### RUT-01 (operador, runbook 69)
- Write REMOTO a la maestra = acto exclusivo del operador (PII real + credencial db-url ausente por diseño + bloqueante duro). El agente NO ejecuta.
- Seed Track B `supabase/seeds/parlamentario-rut.seed.json` HOY vacío (`"filas": []`); el operador lo puebla con RUTs reales DV-válidos + provenance NOT NULL. NUNCA fabricar RUT/placeholder.
- GAP §0: no existe CLI operador que lea el seed y corra `runBackfillRut` contra REMOTO (el writer apunta a LOCAL por diseño). El operador materializa/corre el invocador LOCAL. El agente PUEDE construir ese invocador (código, no un write de RUT) SI el operador va a correr RUT-01 esta corrida — decisión en el checkpoint.
- Track A (SERVEL/ChileCompra) SOLO corrobora un RUT ya presente; name-match JAMÁS escribe rut (corte CR-01, guard Plan 01).

### Backfills votos/dinero (operador, runbooks 66/67/70/71)
- `VOTOS_LIVE=1` + rate-limit 2-3s/host + curl-first ante WAF; dos-etapas fuente→R2→Supabase; hash-check R2 primero. LOCAL, no GitHub Actions.
- Cobertura DECLARADA como techo honesto (N/M); "sin dato" ≠ "sin vínculos"; invariantes: dipids_maestra_no_confirmado=0 (Cámara determinista), tokens `<SELECCION>` confirmados LIVE (Senado).
- ChileCompra: cuota 10k/día reanudable, ticket `MERCADOPUBLICO_TICKET` solo en .env, partición multi-día. SERVEL: Etapa 1 = operador coloca .xlsx content-addressed en R2.

### PII / seguridad
- RUT es PII interna: nunca a anon, nunca a un LLM, nunca a ruta/RPC/proyección pública. Reporte counts-only. RLS deny-by-default intacta.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (mecanismo EXISTE, testeado offline)
- `runBackfillRut` (`packages/identity/src/backfill-rut.ts`) — DV-gate módulo-11 + provenance NOT NULL + fail-closed + idempotente por id.
- `SupabaseMaestraWriter` (`packages/identity/src/writer-supabase.ts`) — implementa `RutBackfillWriter`; apunta a LOCAL por diseño.
- `runHarvestRut` (`packages/dinero/src/harvest-rut.ts`) — canal Track A (solo corrobora).
- Runbooks LIVE: 69-BACKFILL-RUT-RUNBOOK, 66-BACKFILL-RUNBOOK, 67-BACKFILL-SENADO-RUNBOOK, 70-BACKFILL-CHILECOMPRA-RUNBOOK (+70-SPIKE-CUOTA-OCDS), 71-BACKFILL-SERVEL-RUNBOOK.
- Molde CLI operador: `packages/identity/src/backfill-entidad-cli.ts` (loadEnv BOM-safe + buildWriterFromEnv null-sin-credencial).
- Guards: `name-match-rut-guard` (app estático + `@obs/dinero` companion), `lockdown-guard`, `pnpm freshness` (COBERTURA_RUT / COBERTURA_VOTO).

### Integration Points
- Cobertura via `pnpm freshness` (COBERTURA_RUT, COBERTURA_VOTO señales).

</code_context>

<specifics>
## Specific Ideas

Runbooks 69/66/67/70/71 son la fuente de verdad de los pasos. El plan verifica la maquinaria y consolida el checkpoint; NO reinventa los runbooks.

</specifics>

<deferred>
## Deferred Ideas
- Flip MONEY + cold-reads + audit/complete v7.0 → Phase 112.
</deferred>
