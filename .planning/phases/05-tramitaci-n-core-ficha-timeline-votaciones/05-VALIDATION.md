---
phase: 5
slug: tramitacion-core-ficha-timeline-votaciones
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 5 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (conectores/modelo, mock fetch + fixtures XML reales); pgTAP (migración); Next.js → React Testing Library / componentes server probados por render + assertions |
| **Quick run command** | `pnpm --filter @obs/tramitacion test --run` |
| **Full suite command** | `pnpm -w test --run && supabase test db` |
| **Estimated runtime** | ~45–90 seconds |

## Sampling Rate
- After every task commit: quick run · After every wave: full suite · Before verify: full suite green + bounded live ingest produced real Proyecto/Votacion rows.

## Per-Task Verification Map

| Plan | Wave | Requirement | Behavior | Test | Command |
|------|------|-------------|----------|------|---------|
| TBD | 1 | TRAM-03 | migración proyecto/votacion/voto/tramitacion_evento + RLS public-read explícito para anon | pgTAP | `supabase test db` |
| TBD | 1 | TRAM-01 | conector Cámara (opendata XML): getVotaciones_Boletin/retornarVotacionDetalle parsea votos por Diputado/Id | unit (fixtures) | `pnpm --filter @obs/tramitacion test --run camara` |
| TBD | 1 | TRAM-02 | conector Senado (wspublico XML): tramitacion.php + votaciones.php parseados | unit (fixtures) | `pnpm --filter @obs/tramitacion test --run senado` |
| TBD | 2 | TRAM-05 | timeline merge cross-cámara por boletín, cronológico | unit | `pnpm --filter @obs/tramitacion test --run timeline` |
| TBD | 2 | TRAM-06 | voto Cámara→parlamentario_id por Diputado/Id determinista; Senado→correrPipeline (solo confirmado vinculado) | unit | `pnpm --filter @obs/tramitacion test --run voto` |
| TBD | 3 | TRAM-04/09 | ficha /proyecto/[boletin]: estado+timeline+votaciones, badge frescura+enlace fuente, marca identidad no confirmada | component | `pnpm --filter app test --run` |

## Wave 0 Requirements
- [ ] Fixtures XML reales capturados (Cámara opendata getVotaciones_Boletin + retornarVotacionDetalle; Senado tramitacion.php + votaciones.php) para un boletín que cruce ambas cámaras (p.ej. 18296-05)
- [ ] shadcn init + design tokens del UI-SPEC
- [ ] Mock Supabase + fetch helpers

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| Ingesta LIVE acotada (Leg 58) → Proyecto/Votacion reales en Supabase local | TRAM-01/02/03 | Red gov + rate-limit | Correr el conector live una vez; confirmar proyectos/votaciones reales con provenance, 0 errores 403/429 |
| Render real de una ficha en el navegador | TRAM-04 | UX visual | `pnpm --filter app dev`, abrir /proyecto/{boletin real} |
| Deploy remoto + R2 | TRAM-09 | Credenciales | Diferido (DB password/PAT; R2 S3) |
