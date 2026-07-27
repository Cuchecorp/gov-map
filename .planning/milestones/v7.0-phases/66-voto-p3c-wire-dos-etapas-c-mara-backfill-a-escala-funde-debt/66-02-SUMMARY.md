---
phase: 66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
plan: 02
subsystem: votos
tags: [voto, backfill, operador-LOCAL, runbook, dos-etapas, r2, cobertura, VOTO-01, DEBT-01]
requires:
  - "Wire dos-etapas votos (Plan 66-01): runCamaraVotos reenvía r2Store/fromR2 + CLI construye R2Store + reportarCobertura"
  - ".env con R2_* + SUPABASE_API_URL + SUPABASE_SECRET_KEY (operador-LOCAL)"
provides:
  - "66-BACKFILL-RUNBOOK.md: procedimiento operador-LOCAL end-to-end del backfill de votos a escala"
affects:
  - "Wave 2 checkpoint operador-LOCAL: la corrida LIVE + write REMOTO queda PENDIENTE (no ejecutada por el agente)"
  - "SC#3 (voto poblado a escala) y SC#4 (cobertura medida) se satisfacen cuando el operador corre el runbook"
tech-stack:
  added: []
  patterns:
    - "Runbook operador-LOCAL: pre-checks offline → boletines.txt → particionar → LIVE gated → cobertura+invariante"
    - "Reanudable por particionado + idempotencia (votacion_id, fuente_voter_id), sin cursor durable nuevo"
key-files:
  created:
    - .planning/phases/66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt/66-BACKFILL-RUNBOOK.md
  modified: []
decisions:
  - "El agente NO ejecuta VOTOS_LIVE=1 ni escribe a PROD: la corrida LIVE es checkpoint:human-action operador-LOCAL"
  - "Crudo de votos = envelope tramitacion/<boletin> (votXml+detalles), NO namespace dedicado (hereda A1/D-R2-NS de 66-01)"
  - "Invariante de cierre 'dipidsMaestraNoConfirmados === 0' declarado como gate DURO (rompe P65 si >0)"
metrics:
  duration: "~6 min"
  completed: "2026-07-14"
  tasks: 2
  files: 1
---

# Phase 66 Plan 02: Backfill runbook operador-LOCAL (voto Cámara a escala) Summary

Runbook operador-LOCAL end-to-end para poblar el voto individual de Cámara **a escala**,
apoyado enteramente en el wire del Plan 66-01 (`--from-r2`, `reportarCobertura`) y en
`--boletines-file` (ya existente). Documenta las 7 secciones LOCKED: pre-checks offline,
derivación de `boletines.txt`, particionado reanudable, la corrida LIVE gated
(`VOTOS_LIVE=1`, rate-limit 2-3s), el replay Etapa 2 (`--from-r2`), y el reporte de cobertura
con el invariante duro "0 DIPID-maestra no_confirmado" como gate de cierre. **El agente NO
corrió el backfill LIVE, NO tocó el WAF y NO escribió a PROD** — esas son acciones del operador
(regla LOCKED: backfill masivo = LOCAL).

## What Was Built

**Task 1 (`docs(66-02)` `0d5e132`):** `66-BACKFILL-RUNBOOK.md` — 261 líneas, 7 secciones:

1. **PRE-CHECKS OBLIGATORIOS** — golden gate P65 verde
   (`pnpm --filter @obs/votos test golden-dipid`), suite offline + typecheck verdes (26 pass),
   `\d voto` incluye `'ausente'` en la DB **REMOTA** (0019 aplicada — Pitfall 4), `.env` con
   `R2_*` + `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` (grep de NOMBRES, sin valores), endpoint
   UP (dry-run opcional).
2. **DERIVAR `boletines.txt`** — `SELECT boletin FROM proyecto` paginado (`.order().range()` /
   `ORDER BY` psql, cap 1k) → un boletín por línea + assert `wc -l > 0` (Pitfall 1: backfill
   vacío silencioso).
3. **PARTICIONAR PARA REANUDABLE** — `split -l 200` en lotes; reanudable = correr los lotes
   pendientes (idempotencia por `(votacion_id, fuente_voter_id)` hace no-op los ya cargados;
   sin cursor durable nuevo).
4. **CORRIDA LIVE** — comando exacto
   `VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts --boletines-file boletines-lote-NN.txt`,
   serial, rate-limit 2-3s LOCKED, verificar en el log destino `REMOTO (<url>)` + `Etapa 1
   activa` ANTES de dejarlo correr (Pitfall 5).
5. **REPLAY ETAPA 2** — `--from-r2 <r2Path>` re-ejecuta la Etapa 2 desde R2 sin re-tocar la
   fuente (crudo dentro del envelope `tramitacion/<boletin>`).
6. **REPORTE DE COBERTURA** — el CLI imprime `reportarCobertura`; consolidar N confirmado /
   M total + verificar `dipidsMaestraNoConfirmados === 0` (SQL verbatim del RESEARCH incluido).
7. **CRITERIOS DE CIERRE** — todos los lotes corridos, cobertura declarada, invariante en 0,
   crudo de votos en R2. Más secciones de **Rollback/seguridad** (WAF 429/5xx → backoff +
   `--from-r2` para lo persistido) y **nota explícita operador-LOCAL, NO GitHub Actions**.

**Flags reales verificados contra el código** (`run-votos-masivo-cli.ts`): el CLI usa
`--limit N` (no `--limite`), `--boletines-file <ruta>`, `--from-r2 <r2Path>`, `--dry-run`. El
runbook cita los flags exactos del entry-point del Plan 66-01.

## Verification Results

- `test -f 66-BACKFILL-RUNBOOK.md` → EXISTS.
- `grep VOTOS_LIVE=1` → presente (comando LIVE gated).
- `grep boletines-file` → presente (vía robusta).
- `grep "dipidsMaestraNoConfirmados === 0"` → presente (gate de cierre).
- `grep ausente` → presente (pre-check 0019 en DB REMOTA).
- Grep de credenciales literales (`sb_secret_…`, `R2_ACCESS_KEY_ID=<valor>`,
  `SUPABASE_SECRET_KEY=<valor>`) → **0 matches** (solo nombres de env vars).

## Task 2 — CHECKPOINT operador-LOCAL: PENDIENTE (no ejecutado)

**Estado: PENDING — acción del operador.** Este es un `checkpoint:human-action`
(`gate="blocking"`, `autonomous:false`). El agente **NO** lo ejecutó por regla LOCKED
(backfill masivo = LOCAL; golpea el WAF gubernamental con rate-limit 2-3s; escribe a la
Supabase REMOTA/PROD; T-66-02b DoS + T-66-05b escritura accidental a PROD desde CI).

**Qué debe hacer el operador (LOCAL, siguiendo `66-BACKFILL-RUNBOOK.md` end-to-end):**
1. Correr los PRE-CHECKS (golden gate verde, suite offline verde, `\d voto` con `'ausente'`
   en la DB REMOTA, `.env` con `R2_*`+`SUPABASE_*`).
2. Derivar `boletines.txt` de `SELECT boletin FROM proyecto` y particionar en lotes.
3. Correr LIVE lote por lote:
   `VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts --boletines-file boletines-lote-NN.txt`,
   confirmando destino REMOTO en el log + rate-limit 2-3s.
4. Revisar el reporte de cobertura: N confirmado / M total, y CONFIRMAR
   `dipidsMaestraNoConfirmados === 0`.
5. Confirmar crudo de votos en R2 (primeros snapshots).

**Señal de reanudación:** el operador escribe `"backfill hecho"` con la cobertura N/M y el
conteo del invariante (esperado 0), o describe el problema (p.ej. un DIPID-maestra quedó
`no_confirmado` → BUG que detiene el cierre).

## Deviations from Plan

Ninguna. El plan se ejecutó exactamente como fue escrito: Task 1 (runbook) autónomo y
completo; Task 2 (backfill LIVE) registrado como checkpoint operador-LOCAL pendiente, no
ejecutado. Nota menor de fidelidad: el CLI real expone `--limit` (el PLAN/VALIDATION mencionan
`--limite`); el runbook cita el flag real `--limit N` del código.

## Known Stubs

None — el runbook referencia flags y símbolos reales del wire ya implementado (Plan 66-01).
El único trabajo pendiente es la corrida LIVE del operador (Task 2), que es operador-LOCAL por
diseño, no un stub.

## Threat Flags

Ninguno. Este plan es documentación: no introduce endpoints, no toca el reconciliador/parser,
no maneja RUT/PII (votos = DIPID público + nombre público). El runbook referencia SOLO nombres
de env vars (T-66-06 mitigado). Los mitigate del threat register del PLAN (T-66-02b DoS WAF,
T-66-05b write PROD desde CI, T-66-01b atribución histórica, T-66-06 creds) se preservan y se
documentan como procedimiento operador-LOCAL.

## Self-Check: PASSED

- FOUND: .planning/phases/66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt/66-BACKFILL-RUNBOOK.md
- FOUND commit 0d5e132 (docs runbook)
- Task 2 (backfill LIVE) correctamente registrado como PENDING operador-LOCAL, NO ejecutado
