---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: — Votos, dinero y cierre técnico
status: verifying
stopped_at: "Completed 68-02-PLAN.md (cobertura del voto individual N/M en pnpm freshness: COBERTURA_VOTO_SENALES + renderCoberturaVoto; Camara confirmado / Senado por nombre). Phase 68 P2 de 4."
last_updated: "2026-07-14T05:57:29.849Z"
last_activity: 2026-07-14
progress:
  total_phases: 12
  completed_phases: 3
  total_plans: 13
  completed_plans: 11
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 68 — VOTO P3e — Superficies de voto + linter + cobertura + gate BrowserOS

## Current Position

Phase: 68 (VOTO P3e — Superficies de voto + linter + cobertura + gate BrowserOS) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-07-14

Progress: [░░░░░░░░░░] 0% (v7.0: 0/12 fases; v1.0–v6.1 shipped)

## Performance Metrics

**Velocity:**

- v7.0 plans completed: 0
- v6.1 (62-63): 7 planes, corrida autónoma ~3 días con 2 checkpoints humanos

**By Phase (v7.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 64–75 | TBD | - | - |

**Recent Trend:**

- Trend: Stable

*Updated after each plan completion*
| Phase 64 P02 | ~25 min | 2 tasks | 5 files |
| Phase 66 P01 | ~8 min | 3 tasks | 6 files |
| Phase 66 P02 | 6 | 2 tasks | 1 files |
| Phase 67 P02 | ~10min | 1 tasks | 1 files |
| Phase 68 P03 | ~9 min | 2 tasks | 6 files |
| Phase 68 P01 | ~5 min | 1 tasks | 1 files |
| Phase 68 P02 | ~12min | 2 tasks | 4 files |
| Phase 68 P04 | ~4 min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisiones en PROJECT.md Key Decisions. Rectoras para v7.0:

- HALLAZGO RECTOR (research HIGH, 4/4): el código de P3 (`packages/votos/`) y P5 (`packages/dinero/`) YA EXISTE desde v2.0 → v7.0 = WIRING dos-etapas + validación endpoint LIVE + BACKFILL + GATING. Se rechaza cualquier fase "crear tabla/conector/modelo".
- Secuencia dura: P3 (64→68) antes que P5; dentro de P5, RUT-01 (69) SIEMPRE primero (dato bloqueante, no flag).
- DEBT-01 (source_snapshot/`--from-r2`) se FUNDE con el wire de votos (66) y dinero (70/71), no es fase aparte.
- Gates que el agente NO flipea: RUT-01 (checkpoint operador, Phase 69) + sign-off legal 21.719 (Phase 73). El operador pre-aprobó el encendido; la aprobación NO reemplaza la revisión.
- Voto reconciliado por DIPID determinista PUNTO; nunca name-match para votos (riesgo #1). Senado por nombre → probable/no_confirmado.
- [Phase ?]: Phase 64: codigo 2 -> abstencion CONFIRMADO LIVE 2026-07-13; pareo desde bloque Pareos por DIPID, NUNCA codigo 3
- [Phase ?]: Phase 64: getVotacion_Detalle UP a escala; PAREO confirmado LIVE desde <Pareos> (A1b resuelto, 5/5); Dispensado no observado (no fabricado); crudo LIVE en R2
- [Phase ?]: Phase 65: golden set DIPID->id_maestra DERIVADO del seed + gate CI fail-closed 4-aristas; reconciliador y branded type NO tocados
- [Phase 66]: wire dos-etapas votos por RUTA A (threadear runCamaraVotos r2Store/snapshotWriter/fromR2 a runIngest); --from-r2 REUSA el writer resuelto (W-1, no re-deriva como ingest-cli); CLI operador construye R2Store real de .env R2_* (W-2)
- [Phase 66]: cobertura = conteo por estado_vinculo (head+count, sin cap 1k) + invariante duro '0 DIPID-maestra no_confirmado' (D-SC4-MET), NUNCA name-match; @obs/votos gana dep @supabase/supabase-js@^2.108.2 (ya en el monorepo)
- [Phase ?]: 66-02: backfill de votos a escala documentado como runbook operador-LOCAL; corrida LIVE + write PROD PENDIENTE (checkpoint human-action)
- [Phase ?]: 67-01: votXmlSenado en el envelope R2 → --from-r2 reconstruye los votos del Senado; mapSeleccion fail-loud (D-A4); reconciliar-senado.ts intacto (D-A1)
- [Phase ?]: 67-02: runbook operador-LOCAL del backfill Senado (67-BACKFILL-SENADO-RUNBOOK.md) espeja 66; corrida LIVE votaciones.php + write PROD + confirmacion tokens SELECCION = checkpoint operador PENDIENTE (agente NO toco WAF ni PROD)
- [Phase ?]: [Phase 68] 68-03: carril de voto PODADO (rebeldía + mediana de cámara FUERA del render; RPC inertes en DB y fuera de PUBLIC_RPC_ALLOWLIST). Leyenda anti-insinuación VERBATIM bloque 0; N/M incondicional; techo por causa condicional. Ejecutado ANTES de 68-01.
- [Phase ?]: [Phase 68] 68-01: linter anti-insinuacion = test de vitest (app/lib/anti-insinuacion-guard.test.ts), espejo lockdown-guard; caza texto RENDERIZADO post-stripTsComments (no identificadores), resta la leyenda LOCKED que NIEGA disciplina, mutation self-check prueba que muerde; 0 offenders sobre arbol podado 68-03, suite app 758 verde.
- [Phase ?]: [Phase 68] 68-02: cobertura del voto individual en pnpm freshness = array COBERTURA_VOTO_SENALES SEPARADO (denominador = sesiones de sala conocidas, count(DISTINCT votacion.id), NO proyecto) + renderCoberturaVoto; evaluateCobertura se reusa tal cual (array marca su propio esDenominador); Camara solo confirmado determinista, Senado por nombre (probable/no_confirmado, techo honesto); degrada a null NO 0; en vivo 4731 sesiones, Camara 80%, Senado 20%.

### Pending Todos

Backlog v6.x absorbido como DEBT-02..06 en Phases 74-75.

### Blockers/Concerns

- [Phase 64] opendata.camara.cl UP a escala HOY = MEDIUM confidence → SPIKE bloqueante; fallback honesto a agregados si falla. Códigos Abstención/Pareo (A1) nunca confirmados live → fijar con test.
- [Phase 69] RUT-01 = write remoto vía db-url = checkpoint de OPERADOR (bloquea TODO P5).
- [Phase 70] Cuota ChileCompra (10k/día) + ticket operador; SERVEL sin feed estable (toil operador por elección).
- [Phase 73] Flip de MONEY_PUBLIC_ENABLED = acto humano (sign-off dossier legal 13); guard CI anti-flip.
- 66-02 PENDIENTE operador-LOCAL: correr el backfill LIVE de votos (VOTOS_LIVE=1 --boletines-file, rate-limit 2-3s) + reportar cobertura N/M e invariante dipidsMaestraNoConfirmados===0. Ver 66-BACKFILL-RUNBOOK.md
- 67-02 PENDIENTE operador-LOCAL: correr el backfill LIVE del Senado (VOTOS_LIVE=1 --boletines-file, rate-limit 2-3s) + confirmar tokens <SELECCION> LIVE + reportar cobertura por porEstado (N confirmado/M probable/K no_confirmado) y SC#4 (senado_no_confirmado_con_fk===0). Ver 67-BACKFILL-SENADO-RUNBOOK.md
- 68-04 gate BrowserOS comprensible PENDING operador: requiere backfill votos 66/67 (LOCAL) + deploy Cloudflare, luego cold-read segun 68-BROWSEROS-GATE.md. Resume: escribir comprensible o listar puntos fallidos.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-izo | Rediseñar /red: layout B seed→columna con conectores fan-out (sketch 002) | 2026-07-13 | 75a8617 | [260713-izo-redisenar-red-layout-b-seed-columna-con-](./quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| VOTO avanzado | Comparativo voto vs mayoría bancada (VOTOX-01), votos cruzados (VOTOX-02) | v2 (alto riesgo insinuación, tras sign-off) | 2026-07-13 |
| DINERO avanzado | Cruce dinero × voto × timeline por sector (MONEYX-01), co_votación | v2 (máquina de sospechas, 17-LEGAL-DOSSIER §2) | 2026-07-13 |
| Legal | Sign-offs F13/MONEY + F17/NET | Human gate — F13 vive en Phase 73 (v7.0) | v4.0 |
| verification_gap | Phase 62: 62-VERIFICATION.md | human_needed (mismo ítem UAT) | v6.1 close 2026-07-11 |

## Session Continuity

Last session: 2026-07-14T05:57:23.073Z
Stopped at: Completed 68-02-PLAN.md (cobertura del voto individual N/M en pnpm freshness: COBERTURA_VOTO_SENALES + renderCoberturaVoto; Camara confirmado / Senado por nombre). Phase 68 P2 de 4.
Resume file: None

## Operator Next Steps

- Plan Phase 64 con /gsd:plan-phase 64 (o corrida autónoma vía PROMPT-v7.0-build-autonomo.md)
