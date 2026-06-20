---
phase: 21
slug: producto-en-vivo-diseno-phase19-directorio-ideas-matrices
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (monorepo packages) + psql gates (data) + browseros e2e (frontend) |
| **Config file** | per-package `vitest.config.ts`; psql via `$SUPABASE_DB_URL` |
| **Quick run command** | `pnpm --filter @obs/fichas test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~60 seconds (unit); data/e2e gates manual |

---

## Sampling Rate

- **After every task commit:** Run the package-scoped quick command for the touched package.
- **After every plan wave:** Run `pnpm -r test`.
- **Before `/gsd:verify-work`:** Full suite green + psql gate `count(idea_matriz) > 0` + browseros e2e on production URL.
- **Max feedback latency:** 60 seconds (unit); data/e2e are checkpoint gates.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-SC3 | fichas | — | idea matrices | — | no fabricated idea_matriz; honest-state on missing text | data gate | `psql "$SUPABASE_DB_URL" -c "select count(idea_matriz) from proyecto_ficha"` returns > 0 | ❌ W0 | ⬜ pending |
| 21-SC2 | directorio | — | discover parlamentarios | LEGAL-03 | RPC never emits partido/rut/email to anon | unit + manual | `pnpm --filter app test` + curl RPC payload audit | ❌ W0 | ⬜ pending |
| 21-SC1 | diseño | — | Phase 19 design wired | — | civic-tokens.css untouched | source + e2e | grep tokens in globals.css; browseros vs mockup | ❌ W0 | ⬜ pending |
| 21-SC5 | deploy | — | redeploy verified | — | noindex active; MONEY/NET off | e2e | browseros on production URL; assert robots noindex | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Pre-flight: regenerate `~/obs_env.sh` from `.env` (BOM/CRLF-safe); confirm `DEEPSEEK_API_KEY`, `SUPABASE_SECRET_KEY`/`SUPABASE_DB_URL`, CF OAuth.
- [ ] Smoke test 1–2 boletines for Senado `link_mensaje_mocion` presence/format before full backfill.
- [ ] `obsbuild` Docker container available (`docker start -a obsbuild`).

*Existing package test infrastructure (vitest) covers unit-level fichas/writer changes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Design parity vs mockup | SC1 | Visual judgement | browseros screenshot `/` vs `mockup/landing.html`; cream bg + petróleo accent |
| Directory navigable | SC2 | UX flow | browseros: open `/parlamentarios`, filter by cámara, click into a ficha |
| Idea matrices visible | SC3 | Content render | browseros: open a proyecto ficha; idea_matriz + cuerpos_legales render with source |
| Production redeploy | SC5 | Live infra | browseros on `observatorio-congreso.thevalis.workers.dev`; assert noindex, no foto/partido |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
