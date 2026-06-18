---
phase: 6
slug: citaciones-tabla-semanal-de-sala
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 6 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (conectores/parsers, fixtures reales cheerio HTML + JSON); pgTAP (migración); RTL para /agenda |
| **Quick run command** | `pnpm --filter @obs/agenda test --run` (o el paquete que use el planner) |
| **Full suite command** | `pnpm -w test --run && supabase test db` |
| **Estimated runtime** | ~45–90s |

## Sampling Rate
- Tras cada commit: quick run · Tras cada wave: full suite · Antes de verify: full suite + ingesta live representativa con counts reales.

## Per-Task Verification Map

| Plan | Wave | Req | Behavior | Test | Command |
|------|------|-----|----------|------|---------|
| TBD | 1 | TRAM-07 | migración citacion (+invitados) + tabla_sala + RLS public-read anon | pgTAP | `supabase test db` |
| TBD | 1 | TRAM-07 | parser Cámara cheerio (`article.citaciones`→`table.tabla`: comisión/horario/sala/materia/boletín/invitados) sobre fixture real | unit | `pnpm ... test --run camara` |
| TBD | 1 | TRAM-07 | parser Senado JSON (`web-back/api/commissions_citations` → CITACIONES[] con PUNTOS_PROPUESTOS/NUMERO_BOLETIN) | unit | `pnpm ... test --run senado` |
| TBD | 2 | TRAM-08 | parser tabla Senado (`api/weekly_table` → TABLA[]); Cámara → degradación a PDF link | unit | `pnpm ... test --run tabla` |
| TBD | 2 | TRAM-07 | conectores reusan @obs/ingest + header-set anti-Cloudflare Cámara; allowlist += web-back.senado.cl | unit | `pnpm ... test --run connector` |
| TBD | 3 | TRAM-07/08 | /agenda: semana navegable, CitacionCard con ProvenanceBadge + boletín link; SalaTable available/degraded | RTL/component | `pnpm --filter app test --run` |

## Wave 0 Requirements
- [ ] Fixtures reales: HTML semana Cámara (capturado vía header-set/browseros), JSON commissions_citations + weekly_table del Senado
- [ ] Allowlist += web-back.senado.cl

## Manual-Only Verifications

| Behavior | Req | Why Manual | Instructions |
|----------|-----|------------|--------------|
| Ingesta LIVE representativa (varias semanas, ambas cámaras) con header-set anti-Cloudflare desde el egress real | TRAM-07 | Cloudflare puede dar 403 según egress; red gov | Correr el conector live; confirmar citaciones reales de ambas cámaras con provenance, 0 errores; si Cámara da 403 persistente → fallback browseros + degradar sin abortar Senado |
| Tabla de sala Cámara = degradación honesta (PDF) | TRAM-08 | Decisión de producto | Confirmar que la UI muestra "no disponible + PDF oficial", no inventa |
| Deploy remoto + R2 | — | Credenciales | Diferido |
