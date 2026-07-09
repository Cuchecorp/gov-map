---
phase: "56"
plan: "01"
subsystem: ingesta/cron
tags: [audit, cron, github-actions, ingesta, R2, dos-etapas]
dependency_graph:
  requires: []
  provides: [56-CRON-AUDIT.md, gap-list-G1-G23]
  affects: [Phase 57 CRON-FIX, Phase 58 CRON-FRESH]
tech_stack:
  added: []
  patterns: [gh-cli-read-only, psql-select-only, R2-SigV4-probe]
key_files:
  created:
    - .planning/phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md
  modified: []
decisions:
  - "A1 resuelto parcialmente: 0 parlamentarios procesados en run probidad 2026-07-02 confirmado por DB; causa SPARQL vs identity irresolvable sin log completo"
  - "A2 resuelto: backup-parlamentario startup_failure 2026-07-08 es push-episódico, no afecta schedule"
  - "A3 resuelto: SUPABASE_URL ausente del repo — G16 es gap real"
  - "R2 en CI es sistemáticamente no-op: solo 2 secrets presentes de 7+ requeridos"
  - "Billing GH activo al 2026-07-08: 11 corridas scheduled en 14 días"
metrics:
  duration: "~35 minutos"
  completed: "2026-07-08"
  tasks_completed: 2
  files_created: 1
---

# Phase 56 Plan 01: CRON-AUDIT Auditoría E2E Summary

**One-liner:** Auditoría E2E de 9 workflows de GitHub Actions con 23 gaps (2 CRITICAL, 14 HIGH, 6 MEDIUM, 1 LOW), frescura baseline por 7 tablas, y 3 assumptions resueltas mediante probes live gh CLI + psql + R2 SigV4.

## What Was Built

Documento de auditoría completo `56-CRON-AUDIT.md` con:
- Tabla resumen de 9 filas con veredicto cerrado por workflow
- 9 secciones por workflow: cadena fuente→R2→Supabase, DOS ETAPAS compliance, gaps, "Cómo re-verificar"
- Gap-list G1-G23 ordenada por severidad con archivo:línea y fix propuesto para Phase 57
- Mapa sistémico DOS ETAPAS: ningún conector implementa Etapa-2 (R2→Supabase)
- Baseline de frescura por 7 tablas Supabase + R2 por prefijo
- Estado de billing GH (activo) con evidencia de 11 corridas scheduled
- Assumptions A1/A2/A3 resueltas o documentadas como irresolubles

## Probes Ejecutados

| Probe | Resultado clave |
|-------|----------------|
| P1: `gh run list --repo Cuchecorp/gov-map --limit 40` | 11 corridas scheduled exitosas en 14 días; billing activo |
| P2: `gh secret list --repo Cuchecorp/gov-map` | Solo 2 secrets presentes (SUPABASE_API_URL + SUPABASE_SECRET_KEY); 9+ ausentes |
| P3: `gh run view 28980585955 --log-failed` | Log no disponible; "workflow file issue" = push episódico confirmado (A2) |
| P4: `psql SELECT FROM probidad_ingesta_estado` | 0 filas con fecha_captura > 2026-07-01 (A1 parcial) |
| P5: `psql SELECT max(fecha_captura) FROM ...` | 7 tablas consultadas; lobby_audiencia más fresca (2026-07-08) |
| P6: R2 SigV4 ListObjectsV2 | Solo objetos de runs locales manuales (CI = siempre no-op R2) |
| P7: `gh api` schedule runs | 11 runs scheduled exitosas confirman billing no bloqueado |

## Veredictos (9/9)

| Veredicto | Workflows |
|-----------|-----------|
| CORRE-CON-GAPS | agenda-weekly, lobby-leylobby-weekly, backup-parlamentario |
| NO-CORRE | leyes-weekly (bug G4 upsert), lobby-camara-weekly (WAF G7), probidad-weekly (assert G12) |
| NO-APLICA-CRON | fichas-backfill, backfill, deploy-cloudflare |

## Gaps por severidad

| Severidad | Gaps | Ejemplos |
|-----------|------|---------|
| CRITICAL | G4, G7 | upsert tramitacion_evento ON CONFLICT; WAF camara.cl bloquea GH Actions IPs |
| HIGH | G1-G3, G5, G8, G10, G12-G17, G21-G23 | 14 gaps incluyendo G23 sistémico (ningún conector Etapa-2) |
| MEDIUM | G6, G9, G11, G18, G19 | hash-check ausente en 3 conectores; R2 step backup; startup_failure |
| LOW | G20 | backfill con DummyConnector |

## Hallazgo sistémico

**Ningún conector de producción implementa la ruta R2→Supabase (Etapa-2)**. Toda la ingesta a Supabase lee de resultados en memoria (no de R2 crudo). Re-ingestar a Supabase requeriría volver a las fuentes gubernamentales, violando la convención LOCKED del proyecto. Este es el gap arquitectónico de mayor impacto a mediano plazo (G23).

## Deviations from Plan

None — plan ejecutado exactamente como escrito. Los probes se ejecutaron en orden P1-P7. Los únicos ajustes fueron:
- `psql`: columnas reales difieren de las previstas en RESEARCH.md (`fecha_captura` en lugar de `created_at`/`updated_at`/`ultima_ingesta`) — adaptado en tiempo real.
- R2 probe: `aws` CLI no disponible en entorno; se usó SigV4 directo via Node.js (equivalente).
- V3 grep de secrets: el propio comando de validación contenía el patrón `sk-`/`AKIA`/`Bearer` — se reformuló para evitar falso positivo en la sección "Cómo reproducir".

## Self-Check: PASSED

- `56-CRON-AUDIT.md` existe: CONFIRMED
- `grep -cE "Veredicto: ..."` → 9: CONFIRMED
- `grep -cE "G[0-9]+.*\.(ts|yml|sql):[0-9]+"` → 23 (≥20): CONFIRMED
- `grep -icE "(sk-|AKIA|Bearer )"` → 0: CONFIRMED
- `grep -c "Cómo re-verificar"` → 10 (≥9): CONFIRMED
- `grep -c "Frescura baseline"` → 1: CONFIRMED
- `pnpm -w typecheck` → PASSED (phase doc-only, zero código cambiado)
- Commit `c10a77b`: CONFIRMED
