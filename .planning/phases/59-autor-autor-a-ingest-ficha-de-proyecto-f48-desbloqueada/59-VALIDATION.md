---
phase: 59
slug: autor-autor-a-ingest-ficha-de-proyecto-f48-desbloqueada
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 59 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace) + pgTAP (migración) + RTL (ficha) |
| **Config file** | configs existentes por paquete |
| **Quick run command** | `pnpm --filter @obs/tramitacion test --run` |
| **Full suite command** | `pnpm -w test && pnpm -w typecheck` |
| **Estimated runtime** | ~200 seconds |

## Sampling Rate

- **After every task commit:** test del paquete tocado
- **After every plan wave:** full suite + typecheck
- **Before `/gsd:verify-work`:** full suite + pgTAP PROD + corrida idempotente verificada
- **Max feedback latency:** 200 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| parser fix | TBD | 1 | AUTOR-01 | — | mocion→autores poblados; mensaje→[] honesto | unit (fixture real) | `pnpm --filter @obs/tramitacion test -- -t autores` | ✅ | ⬜ pending |
| 0051 DDL + pgTAP | TBD | 1 | AUTOR-01 | T-59-01 RLS public-read, maestra intacta | pgTAP | `psql $SUPABASE_DB_URL -tA -f supabase/tests/0051_proyecto_autor.test.sql` | ✅ | ⬜ pending |
| reconciliación | TBD | 1 | AUTOR-01 | T-59-02 solo determinista puebla FK; cero LLM; cero RUT | unit | test: homónimo/no-match → parlamentario_id null | ✅ | ⬜ pending |
| writer upsert | TBD | 1 | AUTOR-01 | — | clave natural (boletin, autor_normalizado); re-corrida 0 nuevos | unit | test upsert idempotente | ✅ | ⬜ pending |
| corrida LIVE from-r2 | TBD | 2 | AUTOR-01 | T-59-03 cero fetch a fuentes en replay | CLI + SQL | `SELECT count(*) FROM proyecto_autor` > 0; 2ª corrida log 0 upserts | ✅ | ⬜ pending |
| AutorRow guard | TBD | 2 | AUTOR-02 | T-59-04 link SOLO confirmado | RTL | test: confirmado→href; crudo→IdentityMarker sin href | ✅ | ⬜ pending |
| sección honesta | TBD | 2 | AUTOR-02 | — | sin filas→sección AUSENTE del DOM; mensaje→línea Ejecutivo | RTL | render tests 3 estados | ✅ | ⬜ pending |

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — fixtures XML reales con autores deben añadirse (boletín 16588 moción) como fixture nuevo.*

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sección visible en PROD tras deploy | AUTOR-02 | requiere deploy Cloudflare | Phase 61 la barre con BrowserOS; operador puede verificar /proyecto/16588-XX |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity ok
- [ ] No watch-mode flags
- [ ] Feedback latency < 200s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
