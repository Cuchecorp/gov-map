---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Votos, dinero y cierre técnico
status: planning
last_updated: "2026-07-13T23:58:41.418Z"
last_activity: 2026-07-13
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Milestone v7.0 — Votos, dinero y cierre técnico (definiendo requirements)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-07-13 — Milestone v7.0 started

## Performance Metrics

**Velocity (v6.0):**

- Total plans completed: 7
- Average duration: -
- Total execution time: 0 hours

**By Phase (v6.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 56 CRON-AUDIT | TBD | - | - |
| 57 CRON-FIX | TBD | - | - |
| 58 CRON-FRESH | TBD | - | - |
| 59 AUTOR | TBD | - | - |
| 60 BRAND | TBD | - | - |
| 61 COMP | TBD | - | - |
| 62 | 3 | - | - |
| 63 | 4 | - | - |

*Updated after each plan completion*
| Phase 62 P01 | 7 min | 2 tasks | 2 files |
| Phase 62 P62-03 | 90 | 3 tasks | 15 files |
| Phase 63 P01 | 8 min | 3 tasks | 4 files |
| Phase Phase 63 P02 P02 | 10 min | 3 tasks tasks | 4 files files |

## Accumulated Context

### Decisions

- v6.0 roadmap: 6 fases (56-61), granularity=fine; CRON audit primero (56) antes de hardening (57) — gap-list como insumo; AUTOR (59) bloqueado en 57 (patrón dos-etapas LOCKED); COMP (61) último — cubre superficie nueva de AUTOR + ícono de BRAND.
- BRAND (60) independiente de CRON/AUTOR pero se ubica antes de 61 para que el ícono esté live durante el barrido BrowserOS.
- Ingesta dos-etapas LOCKED (CLAUDE.md Conventions): fuente→R2 primero, R2→Supabase siempre del crudo; hash-check antes de descargar; backfill masivo = LOCAL nunca GH Actions.
- Billing GH bloqueado (gotcha conocido 2026-06-23): fallback local documentado es entregable aceptable para CRON-04.
- Gates humanos/legales (F13/F17/0042) fuera de v6.0 — ningún agente flipea flags `*_PUBLIC_ENABLED`.
- [Phase ?]: 62-01: cap de vecinos client-side (24 alfabetico) + layout radial ego-centrico determinista (radialPos, cero force-simulation); RPC/DDL intactos.
- [Phase ?]: 62-02: borde institucional por camara + fallback movil lista de vecinos honesta; RED-02 cerrado, falta RED-03 ops.
- 63-01: seed idempotente como paso dedicado (`seedFichasPendientes()` con `ignoreDuplicates:true` / DO NOTHING) cierra el gap BUSQ-01 (82 proyectos sin fila `proyecto_ficha`) sin re-abrir estado terminal; `scripts/verify-cobertura.sql` = fuente única de 7 conteos compartida por P03 y freshness. Entrega CÓDIGO+tests; el backfill real es P03 (LOCAL, operador).
- [Phase ?]: 63-02: enumeración histórica (BUSQ-02) vía WSLegislativo.asmx (retornarMocionesXAnno + retornarMensajesXAnno, shape ProyectosLeyColeccion>ProyectoLey>NumeroBoletin confirmado LIVE; el WS de votaciones devuelve [] al enumerar por año). enumerarProyectosXAnno reusa this.fetch LOCKED; parseCamaraLegislativo valida con zod. CLI LOCAL one-shot emite lista para pipe a run-tramitacion-prod-cli --boletines (P03). NO en cron YAML.

### Pending Todos

None yet.

### Blockers/Concerns

- Billing GH Actions: posiblemente bloqueado al inicio de v6 (ver fallback CRON-04).
- Secrets GH (DEEPSEEK, R2, SUPABASE): necesitan verificación en Cuchecorp/gov-map antes de Phase 57.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-izo | Rediseñar /red: layout B seed→columna con conectores fan-out (sketch 002) | 2026-07-13 | 75a8617 | [260713-izo-redisenar-red-layout-b-seed-columna-con-](./quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Legal | Sign-offs F13/MONEY + F17/NET | Human gate (Phase 39) | v4.0 |
| Data | RUT-01 backfill + ChileCompra/SERVEL | Needs-human (Phase 40) | v4.0 |
| Ops | Rotar DB password (B26) | Acción de operador en dashboard | v5.0 |
| UI | Rediseño /red móvil (P1 de F53) | ✅ RESUELTO 2026-07-13 (quick 260713-izo: layout B, columna responsive única) | v5.0 |
| uat_gap | Phase 62: 62-HUMAN-UAT.md (rotate móvil→desktop, WR-06) | ✅ RESUELTO 2026-07-13 (quick 260713-izo: xyflow eliminado, ya no monta bajo display:none; /red aprobado en prod) | v6.1 close 2026-07-11 |
| verification_gap | Phase 62: 62-VERIFICATION.md | human_needed (mismo ítem UAT) | v6.1 close 2026-07-11 |
| quick_task | 260623-rtl-loadenv-ci-safe-clis | unknown (pre-v6.1) | v6.1 close 2026-07-11 |
| quick_task | 260702-rbb-fix-b20-b21-pre-flip-net-red-graph-nodos | unknown (pre-v6.1; B20/B21 ya shipped en v5) | v6.1 close 2026-07-11 |
| Data | Cron leyes-weekly 80/sem sobre corpus 3657 — dilución de frescura (rotación round-robin candidata) | Deuda de datos (audit v6.1) | v6.1 |

## Session Continuity

Last session: 2026-07-11T13:51:06.593Z
Stopped at: Roadmap v6.0 creado — Phases 56-61, REQUIREMENTS.md traceability actualizado, STATE.md inicializado.
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd:new-milestone
