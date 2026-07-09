---
phase: 57-cron-fix-hardening-dos-etapas-hash-check-crons-verdes
plan: "04"
subsystem: ops/ci
tags:
  - github-actions
  - secrets
  - cron
  - runbook
  - waf
dependency_graph:
  requires:
    - 57-01
    - 57-02
    - 57-03
  provides:
    - secrets-loaded-cuchecorp
    - lobby-camara-dispatch-only
    - probidad-assert-consultados
    - runbook-waf-fallback
    - e2e-leyes-green
  affects:
    - .github/workflows/lobby-camara-weekly.yml
    - .github/workflows/probidad-weekly.yml
    - docs/runbooks/cron-local-fallback.md
tech_stack:
  added: []
  patterns:
    - "gh secret set via pipe (no echo, no historial)"
    - "workflow_dispatch-only para workflows WAF-bloqueados"
    - "assert consultados>0 vs declaraciones>0 (robustez semana-sin-novedades)"
key_files:
  created:
    - docs/runbooks/cron-local-fallback.md
  modified:
    - .github/workflows/lobby-camara-weekly.yml
    - .github/workflows/probidad-weekly.yml
decisions:
  - "agenda-weekly.yml ya tenía los 7 secrets completos — no se modificó (solo confirmación)"
  - "lobby-camara-weekly.yml schedule OFF definitivo; re-habilitar requiere editar YAML + push (decisión deliberada)"
  - "probidad assert cambiado a consultados>0: semana sin declaraciones nuevas = honesta, no error"
  - "E2E: leyes-weekly elegido como candidato primario (solo 2 secrets, G4 ya resuelto en plan 02)"
metrics:
  duration: "~35 min (incluyendo espera de 23 min de corrida E2E)"
  completed: "2026-07-09"
  tasks_completed: 3
  files_modified: 3
  files_created: 1
  secrets_loaded: 5
  e2e_run_id: "28984574279"
  e2e_conclusion: "success"
---

# Phase 57 Plan 04: Ops Closure — Secrets, YAMLs, Runbook, E2E Verde

**One-liner:** 5 secrets R2+DeepSeek cargados a Cuchecorp/gov-map, lobby-camara schedule OFF (WAF G7), probidad assert robustecido (consultados>0), runbook WAF documentado, y leyes-weekly corrida E2E verde confirmada (run 28984574279).

## Tasks Completed

| Task | Description | Commit | Result |
|------|-------------|--------|--------|
| 1 | YAMLs G7+probidad-assert + runbook | bd44202 | PASS |
| 2 | Cargar 5 secrets a Cuchecorp/gov-map | (sin commit — ops) | PASS |
| 3 | Push + dispatch E2E leyes-weekly | bd44202 (push) | conclusion=success |

## Commits

- `bd44202` — `ops(57-04): YAMLs G7+probidad-assert + runbook WAF lobby-camara`
  - `.github/workflows/lobby-camara-weekly.yml`: schedule deshabilitado, dispatch-only + comentario G7
  - `.github/workflows/probidad-weekly.yml`: assert `declaraciones/confirmados` → `consultados=[1-9]`
  - `docs/runbooks/cron-local-fallback.md`: runbook 5 secciones (prereqs, lobby local, gh secret set cookbook, re-enable, verificacion)

## Secrets Cargados (solo NOMBRES)

Los 5 secrets cargados a `Cuchecorp/gov-map` vía `gh secret set` con pipe desde `.env` (valores NUNCA impresos):

1. `R2_ENDPOINT_URL`
2. `R2_ACCESS_KEY_ID`
3. `R2_SECRET_ACCESS_KEY`
4. `R2_BUCKET`
5. `DEEPSEEK_API_KEY`

Verificado con `gh secret list --repo Cuchecorp/gov-map` (7 secrets total: 2 pre-existentes SUPABASE_* + 5 nuevos).

## E2E Run

- **Workflow:** `leyes-weekly.yml`
- **Run ID:** `28984574279`
- **URL:** https://github.com/Cuchecorp/gov-map/actions/runs/28984574279
- **Conclusion:** `success`
- **Duración:** ~23 minutos (00:10 → 00:33 UTC 2026-07-09)

## Deviations from Plan

### agenda-weekly.yml — No change needed

**Found during:** Task 1 read-first
**Issue:** El plan indicaba que agenda-weekly.yml necesitaba los 5 secrets añadidos al bloque env. Al leer el archivo, el bloque env ya tenía los 7 secrets completos (SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) — probablemente añadidos en un commit anterior de la Phase 57.
**Acción:** No se modificó. Confirmado como ya correcto.

## Must-Haves Verificados

| Criterio | Estado |
|----------|--------|
| gh secret list muestra 5 nombres R2+DEEPSEEK | PASS |
| lobby-camara-weekly.yml sin schedule activo (solo workflow_dispatch) | PASS |
| agenda-weekly.yml tiene 7 secrets en env (incl. DEEPSEEK + R2) | PASS (pre-existente) |
| probidad-weekly.yml usa grep consultados=[1-9] | PASS |
| docs/runbooks/cron-local-fallback.md existe con 5 secciones | PASS |
| Al menos 1 corrida E2E con conclusion=success | PASS (28984574279) |

## Known Stubs

Ninguno. El plan era de operaciones (secrets + YAML + runbook) — no hay stubs de datos o UI.

## Threat Flags

Ninguno. El plan refuerza la frontera de confianza .env → gh secret set → GH repo sin nuevas superficies.

## Self-Check: PASSED

- `docs/runbooks/cron-local-fallback.md`: EXISTS
- commit `bd44202`: EXISTS (`git log --oneline | grep bd44202`)
- gh secret list R2_ENDPOINT_URL: FOUND (verificado en ejecución)
- lobby-camara no tiene schedule activo: VERIFIED (`grep -v "^#" ... | grep schedule` → 0 resultados)
- probidad usa consultados=: VERIFIED (línea 69)
- E2E run 28984574279: conclusion=success (verificado en tiempo real)
