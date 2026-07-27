---
phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre
plan: 02
subsystem: docs
tags: [voto, senado, backfill, runbook, operador-LOCAL, votaciones.php, SELECCION, VOTO-01]

# Dependency graph
requires:
  - phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre
    provides: "wire dos-etapas Senado (votXmlSenado en el envelope R2 + --from-r2 reconstruye votos + mapSeleccion fail-loud)"
  - phase: 66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
    provides: "runbook operador-LOCAL de Cámara (66-BACKFILL-RUNBOOK.md) espejado aquí"
provides:
  - "67-BACKFILL-SENADO-RUNBOOK.md: runbook operador-LOCAL reproducible para poblar el voto individual del Senado a escala vía votaciones.php sin que el agente toque el WAF ni escriba a PROD"
  - "SPIKE gated documentado para fijar los tokens <SELECCION> LIVE del Senado (A4), apoyado en el fail-loud de 67-01"
affects: [backfill-senado-live, phase-68]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runbook operador-LOCAL como artefacto de checkpoint: el agente produce el DOCUMENTO; la corrida LIVE (WAF + write PROD) es acto humano gated"
    - "Cobertura Senado por porEstado (agnóstico de cámara); el invariante DIPID-maestra NO se fuerza sobre filas Senado (Cámara-only)"

key-files:
  created:
    - .planning/phases/67-voto-p3d-paridad-senado-voto-individual-por-nombre/67-BACKFILL-SENADO-RUNBOOK.md
  modified: []

key-decisions:
  - "El agente NO corre el backfill LIVE del Senado: golpea el WAF tramitacion.senado.cl a escala (rate-limit 2-3s) + escribe a la Supabase REMOTA PROD — ambos operador-LOCAL por regla LOCKED. Task 2 es checkpoint:human-action, no ejecutada por el agente."
  - "Cobertura Senado = porEstado (confirmado/probable/no_confirmado); NO se aplica el invariante DIPID-maestra (Cámara-only, Open Q3) — el Senado no tiene DIPID."
  - "D-A1 documentado como LEGÍTIMO: determinista único → confirmado es paridad Cámara, no fabricación; lo prohibido es confirmado por match ambiguo. SC#4 = solo confirmado atribuye parlamentario_id."

patterns-established:
  - "SPIKE de tokens <SELECCION> convertido de riesgo silencioso a ruido visible: con el fail-loud de 67-01 un token nuevo aparece en errores → el operador lo fija con fixture ANTES del masivo, nunca pierde el voto"

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-07-14
---

# Phase 67 Plan 02: Backfill Senado (runbook operador-LOCAL) Summary

**Producido `67-BACKFILL-SENADO-RUNBOOK.md` — el runbook operador-LOCAL que consume el wire dos-etapas + `votXmlSenado` de 67-01 para poblar el voto individual del Senado a escala vía `votaciones.php`, con SPIKE gated de tokens `<SELECCION>` y cobertura por `porEstado`. El agente NO corrió el backfill LIVE ni escribió a PROD; esa corrida es un checkpoint de operador PENDIENTE.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 1 ejecutada (runbook) + 1 checkpoint operador (no ejecutada por el agente)
- **Files created:** 1

## Accomplishments

- **Runbook operador-LOCAL completo (`67-BACKFILL-SENADO-RUNBOOK.md`, 323 líneas)** espejando `66-BACKFILL-RUNBOOK.md`, adaptado al Senado (reconciliación por NOMBRE, sin DIPID). Secciones: header QUIÉN/POR QUÉ LOCAL + nota anti-CI, PRE-CHECKS offline (suite 67-01 verde + 0019 en el REMOTO + `.env`), SPIKE gated de tokens `<SELECCION>`, derivar boletines Senado (base sin sufijo), particionar reanudable, corrida LIVE serial rate-limit 2-3s con verificación de destino REMOTO, replay `--from-r2`, cobertura por `porEstado` + SC#4, criterios de cierre, rollback, seguridad de credenciales.
- **Flags CLI reales verbatim** contra `packages/votos/src/run-votos-masivo-cli.ts` (`--boletines-file`, `--from-r2`, `--dry-run`, `--limit`). El CLI ya threadea `buildSenadoConnector()`, así que el mismo entry-point cubre el path Senado.
- **SPIKE gated de tokens `<SELECCION>` (A4 / Open Q2)** documentado apoyándose en el fail-loud de 67-01: un token desconocido LANZA con el token crudo y aparece en `errores` (etapa `senado-votaciones`) → el operador lo fija con fixture ANTES del masivo, nunca pierde el voto en silencio.
- **Cobertura Senado por `porEstado`** con NOTA EXPLÍCITA de que el invariante DIPID-maestra es Cámara-only (Open Q3) y NO se aplica a filas Senado. D-A1 documentado como legítimo (determinista único → confirmado); SC#4 verificado por query (`senado_no_confirmado_con_fk === 0`).
- **Disciplina LOCKED declarada:** operador-LOCAL / NO GitHub Actions / rate-limit 2-3s serial / dos etapas R2, y que el agente NO invocó `VOTOS_LIVE`, NO tocó el WAF, NO escribió a PROD.

## Task Commits

1. **Task 1: 67-BACKFILL-SENADO-RUNBOOK.md** — `a11c791` (docs)
2. **Task 2 (checkpoint:human-action): correr el backfill LIVE Senado** — NO ejecutada por el agente (ver PENDING abajo).

## Files Created/Modified

- `.planning/phases/67-voto-p3d-paridad-senado-voto-individual-por-nombre/67-BACKFILL-SENADO-RUNBOOK.md` — runbook operador-LOCAL del backfill LIVE Senado (323 líneas), espejo de `66-BACKFILL-RUNBOOK.md`.

## PENDING Operator Actions (checkpoint:human-action — NO ejecutadas por el agente)

Task 2 es un checkpoint humano bloqueante (`autonomous:false`). El agente produjo el runbook; el operador ejecuta la corrida LIVE en su máquina LOCAL:

1. **Backfill LIVE del Senado** siguiendo `67-BACKFILL-SENADO-RUNBOOK.md`:
   - PRE-CHECKS offline (suite Senado verde + 0019 en el REMOTO + `.env` con `R2_*` y `SUPABASE_*`).
   - `VOTOS_LIVE=1 … --boletines-file boletines-senado-lote-*.txt`, serial, rate-limit 2-3s, verificando el destino REMOTO en el log ANTES de escribir.
   - Replay `--from-r2` para reanudar cualquier lote que falle en Etapa 2 (reconstruye votos Senado gracias a `votXmlSenado`).
2. **Confirmación LIVE de los tokens `<SELECCION>`** (SPIKE gated): capturar una respuesta real de `votaciones.php`, confirmar el set de tokens, y si el fail-loud registra un token desconocido en `errores`, mapearlo + fijarlo con fixture ANTES del masivo — nunca descartar el voto.
3. **Reporte de cobertura** por `porEstado` (N confirmado / M probable / K no_confirmado) y verificación SC#4 (`senado_no_confirmado_con_fk === 0`). NO aplicar el invariante DIPID-maestra (Cámara-only).

**Señal de reanudación:** el operador reporta "backfill Senado hecho" con la cobertura por estado + confirmación de los tokens `<SELECCION>`, o "diferir backfill" para cerrar la fase con código + runbook listos y la corrida LIVE pendiente.

## Deviations from Plan

None - plan executed exactly as written. El agente ejecutó Task 1 (runbook) y se detuvo en Task 2 (checkpoint:human-action) por diseño — el backfill LIVE + write PROD son operador-LOCAL por regla LOCKED.

## Authentication / Checkpoint Gates

- **Task 2 (checkpoint:human-action, gate="blocking"):** el backfill LIVE del Senado + write PROD + confirmación de tokens `<SELECCION>` LIVE es un acto humano operador-LOCAL. El agente NO lo ejecutó (0 fetch al WAF, 0 write PROD). Documentado como flujo normal, no como falla.

## Verification

- `67-BACKFILL-SENADO-RUNBOOK.md` existe con 323 líneas (≥120 requeridas).
- Grep-gates: `run-votos-masivo-cli|from-r2|rate-limit|porEstado|votXmlSenado|operador` → 37 matches; `--boletines-file` (4), `--dry-run` (8), `--limit` (2), `SELECCION` (8), `DIPID` (5, con la nota Cámara-only).
- Contiene el SPIKE gated de tokens, la referencia al fail-loud de 67-01, la cobertura por `porEstado`, D-A1/SC#4, y las reglas LOCKED (LOCAL, rate-limit 2-3s, dos etapas).
- El agente NO corrió el LIVE: 0 fetch al WAF `tramitacion.senado.cl`, 0 write a la Supabase REMOTA PROD.

## Self-Check: PASSED

- El archivo `67-BACKFILL-SENADO-RUNBOOK.md` existe (323 líneas).
- El commit `a11c791` existe en git.
- Grep-gates verdes (flags reales verbatim, SELECCION, DIPID Cámara-only).
- Task 2 (backfill LIVE + confirmación de tokens) registrada como PENDING operator action, NO ejecutada.

---
*Phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre*
*Completed: 2026-07-14*
