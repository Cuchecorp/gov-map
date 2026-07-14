# Phase 71: DINERO P5c — SERVEL LOCAL (.xlsx artesanal, funde DEBT-01) - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (wire/backfill phase, gated OFF, LOCAL por elección — discuss skipped; decisions locked)

<domain>
## Phase Boundary

Poblar el financiamiento electoral DECLARADO (aportes/gastos SERVEL) por RUT — conector ARTESANAL FRÁGIL (.xlsx vía exceljs), LOCAL por elección (NO cron), con frescura DECLARADA. Wire de dos etapas R2 (funde DEBT-01 para SERVEL): el operador deja el `.xlsx` correcto en R2 (Etapa 1 manual — SERVEL no tiene feed estable) y el pipeline re-corre LEYENDO DE R2 sin volver a tocar la fuente (Etapa 2, `--from-r2`). Componentes `connector-servel.ts` (exceljs) + `reconciliar-aporte.ts` + tabla `aporte` (0024) YA EXISTEN. Todo detrás del flag `MONEY_PUBLIC_ENABLED` OFF. Reconciliación por RUT (fail-closed, reforzado por brand `FilaRutCorroborada` de Phase 69).

</domain>

<decisions>
## Implementation Decisions

### Frescura declarada por dato (LOCKED — rector)
- La FECHA DE CORTE y QUÉ ELECCIÓN/PERÍODO cubre el dato SERVEL están VISIBLES POR DATO. NUNCA un dato viejo presentado como actual. "Financiamiento de la elección X (corte YYYY-MM-DD)".

### Dos etapas LOCAL (LOCKED)
- Etapa 1 = el operador coloca el `.xlsx` en R2 (content-addressed) — SERVEL LOCAL, NO cron (feed inestable). Etapa 2 = pipeline lee de R2, re-ejecutable (`--from-r2`), sin re-tocar la fuente.
- `ServelBloqueadaError` degrada ESA elección/archivo SIN abortar la corrida completa (fail-soft por elección, fail-closed por dato).

### Gate MONEY (LOCKED)
- Detrás de `MONEY_PUBLIC_ENABLED` OFF (deny-by-default). Los aportes existen en la DB pero NO se presentan hasta el flip legal (Phase 73). Guard anti-flip.

### Reconciliación por RUT fail-closed (LOCKED, defamación)
- Aporte asociado por RUT; sin RUT → sin vínculo (null), nunca falso por nombre. Monto/valor VERBATIM string donde aplique.

### Backfill LOCAL (operador)
- Toil de operador POR ELECCIÓN: conseguir + colocar el `.xlsx` en R2. El agente entrega el wire + tests con fixture `.xlsx` fake + runbook. freshness con staleness SERVEL.

### Claude's Discretion
Detalles del wire dentro de las reglas; reusar `connector-servel.ts`, `reconciliar-aporte.ts`, tabla 0024.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- `connector-servel.ts` (exceljs — parseo del .xlsx), `reconciliar-aporte.ts` (rama por RUT), tabla `aporte` (0024).
- Wire dos-etapas de Phase 66/70 (`runIngest`/`runIngestDinero` con r2Store/snapshotWriter/fromR2; fail-closed R2 Stage-1).
- `ServelBloqueadaError` (degradación honesta por elección).
- Brand `FilaRutCorroborada` (Phase 69), `MONEY_PUBLIC_ENABLED` + guard anti-flip, patrón freshness (Phase 68/69/70).

</code_context>

<specifics>
## Specific Ideas

- Etapa 1 = operador deja `.xlsx` en R2 (no cron). Etapa 2 `--from-r2`.
- Corte + elección/período VISIBLE por dato.
- `ServelBloqueadaError` fail-soft por elección.
- freshness señal SERVEL con staleness.
- Fixture `.xlsx` fake para tests offline (exceljs).

</specifics>

<deferred>
## Deferred Ideas

- Materializador `cruce_senal` con `lobby_sector_aporte` → Phase 72.
- Superficies MONEY + flip legal → Phase 73 (acto humano).
- La obtención/colocación real del `.xlsx` por elección = toil operador-LOCAL, no esta corrida.
</deferred>
