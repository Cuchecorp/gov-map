---
phase: 96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
verified: 2026-07-23T15:42:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 96: SEGURIDAD P3b — Audit final sitio + Supabase Verification Report

**Phase Goal:** Los guards revisan las migraciones; el audit final revisa la DB VIVA y el repo público con modelo de amenaza de sujetos hostiles — más la rotación de credencial arrastrada.
**Verified:** 2026-07-23T15:42:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves merged)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Repo público: gitleaks historial completo triaged (0 rotaciones, sin valores impresos), `.env.example` placeholders + guard CI, errores genéricos, headers verificados, CSP Report-Only → ENFORCED live | ✓ VERIFIED | `gitleaks git --redact --config .gitleaks.toml` re-corrido por verifier → **"no leaks found", exit 0, 1722 commits/30.73 MB**. `.gitleaks.toml` con 6 paths FP. `env-example-guard.test.ts` 15/15 verde (verifier), detector puro + mutation self-check MUERDE ante sb_secret_/eyJ/hex/conn-string/R2. `.env.example` heurística → 0 valores no-placeholder. CSP live via `curl -sI` → `content-security-policy:` (SIN `-report-only`) con object-src 'none' + connect-src 'self' + frame-ancestors 'none' + base-uri 'self' + form-action 'self'. Errores genéricos confirmados en 96-CSP-DEPLOY-EVIDENCIA.md §4 (0 texto Postgres). |
| 2 | Supabase vivo: grants/RLS/Splinter sobre PROD (0 offenders con filtro pg_depend), allowlist re-derivado (2 inertes documentadas), pgvector 0.8.2 gap → handoff honesto, pnpm audit limpio | ✓ VERIFIED | 96-AUDIT-DB-VIVA.md: 4 checks de app = 0/0/0/0 con filtro `pg_depend deptype='e'` (queries verbatim presentes); Splinter search_path="" + 0 tablas sin PK. Allowlist: 25 secdef vivos vs 26 repo; 2 secdef fuera de allowlist (`rebeldias_de_parlamentario`, `tasa_ausencia_comparada`) inertes-por-diseño 68-03 — **confirmadas en `app/lib/lockdown-guard.test.ts`** + lockdown-guard 14/14 verde (verifier). pgvector 0.8.0 vivo; ≥0.8.2 no disponible en plataforma gestionada → handoff honesto (ver override-nota abajo). `pnpm audit --prod` re-corrido por verifier → **"No known vulnerabilities found"**. |
| 3 | B26 documentado como checkpoint operador (cita runbook 75, NO rotado) | ✓ VERIFIED | 96-OPERATOR-HANDOFF.md cita `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` (grep=2, runbook existe verificado); estado B26 = `[ ] Operador: PENDIENTE`, agente NO rota; cierre "Esta nota no contiene ningún valor de secret." presente; heurística de secretos en docs de fase → 0 valores reales (solo fixtures `sb_secret_realvalueXXX`). |
| 4 | Golden gate identidad re-verificado (packages 1263 verdes) | ✓ VERIFIED | Verifier re-corrió los 3 golden gates: **adjudication 89, cruces 33, votos gate-DIPID 14** (todos verdes, counts idénticos a lo citado). Golden test files existen (`adjudication/src/golden/golden-set.test.ts`, `cruces/src/golden/golden-set.test.ts`, `votos/src/golden-dipid.test.ts`). Suite completa de packages 1263 citada en 96-02 (150 test files, 0 fallos). |

**Score:** 4/4 truths verified

### Nota sobre wording ROADMAP SC#2 "pgvector ≥0.8.2 confirmado"

La redacción literal del ROADMAP SC#2 dice "pgvector ≥0.8.2 confirmado". La realidad viva es **0.8.0** y la plataforma Supabase gestionada NO ofrece ≥0.8.2 (`default_version = 0.8.0`, `ALTER EXTENSION vector UPDATE` no encuentra target). El PLAN 96-02 y el criterio de éxito de esta fase reencuadran el ítem como **"pgvector 0.8.2 gap → handoff honesto"** — el agente NO fuerza DDL. Exposición práctica baja: 0 funciones anon-executable (check (a) verde). Esto es una desviación INTENCIONAL y documentada (handoff de operador B27/pgvector en 96-OPERATOR-HANDOFF.md), no un gap accionable. El goal real de la fase ("audit + handoff honesto de deuda de operador") se cumple. No requiere override formal porque el criterio de éxito de la fase ya lo especifica como handoff.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/lib/env-example-guard.test.ts` | Guard placeholder-only + mutation self-check | ✓ VERIFIED | `detectarValorNoPlaceholder` exportado, 5 patrones de secreto + allowlist config, §1 archivo real + §2 mutation self-check. 15/15 verde. |
| `.gitleaks.toml` | Allowlist FP | ✓ VERIFIED | `[allowlist]` con 6 paths FP; scan re-corrido → 0 findings. |
| `pnpm-workspace.yaml` | Overrides transitivos de seguridad | ✓ VERIFIED (contains stale) | Contiene overrides protobufjs/sharp/postcss/esbuild/uuid. `brace-expansion` fue REMOVIDO por Plan 03 (rompía build Docker) — el must_have `contains: brace-expansion` de Plan 01 quedó stale por diseño; `pnpm audit` = 0 igual. |
| `app/next.config.ts` | CSP enforced | ✓ VERIFIED | Header `Content-Security-Policy` (no Report-Only) con object-src 'none' + connect-src 'self'; emitido en `headers()` a `/(.*)`; confirmado live via curl. |
| `96-AUDIT-REPO.md` | Reporte gitleaks + audit | ✓ VERIFIED | N/M declarado, triage 6 FP, cero valores impresos, pnpm audit antes/después. |
| `96-AUDIT-DB-VIVA.md` | Reporte DB viva | ✓ VERIFIED | `pg_depend` (10 ocurrencias), queries verbatim, allowlist drift, pgvector gap, golden gate counts. |
| `96-OPERATOR-HANDOFF.md` | Handoff zero-credential | ✓ VERIFIED | B26 + pgvector + gitleaks + sign-offs; cita runbook 75; cierre zero-secret. |
| `96-CSP-DEPLOY-EVIDENCIA.md` | Evidencia empírica deploy | ✓ VERIFIED | §2 curl -sI (CSP enforced), §3 BrowserOS orquestador (consola 0 + island vivo), §4 errores genéricos, §5 fixes 94. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `env-example-guard.test.ts` | `.env.example` | readFileSync desde REPO_ROOT | ✓ WIRED | `ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example")`; §1 lee y asierta 0 offenders. |
| `next.config.ts` | Cloudflare Worker | headers() OpenNext | ✓ WIRED | curl live confirma CSP enforced servido en PROD (deploy 1bcdc948). |
| `96-OPERATOR-HANDOFF.md` | `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` | cita runbook (no duplica) | ✓ WIRED | grep=2, runbook existe. |
| `96-AUDIT-DB-VIVA.md` | `lockdown-guard.test.ts PUBLIC_RPC_ALLOWLIST` | re-derivación secdef vivos | ✓ WIRED | Las 2 secdef inertes están en el test; lockdown-guard 14/14 verde. |

### Behavioral Spot-Checks (run by verifier)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CSP enforced live | `curl -sI -H "Cache-Control: no-cache" .../` | `content-security-policy:` sin `-report-only`, 6 headers seguridad presentes | ✓ PASS |
| Guard muerde | `pnpm vitest run lib/env-example-guard.test.ts` | 15/15 verde (mutation self-check activo) | ✓ PASS |
| gitleaks limpio | `gitleaks git --redact --config .gitleaks.toml` | no leaks found, exit 0, 1722 commits | ✓ PASS |
| pnpm audit | `pnpm audit --prod` | No known vulnerabilities found | ✓ PASS |
| allowlist en sync | `pnpm vitest run lib/lockdown-guard.test.ts` | 14/14 verde | ✓ PASS |
| golden identidad | `pnpm --filter @obs/adjudication --filter @obs/cruces --filter @obs/votos test` | adjudication 89 / cruces 33 / votos 31 (gate-DIPID 14) verdes | ✓ PASS |
| errores genéricos | 96-CSP-DEPLOY-EVIDENCIA §4 (curl boletín inexistente) | 0 texto Postgres/PostgREST al cliente | ✓ PASS (doc) |
| secret leak en docs | grep heurístico sb_secret/eyJ/conn-string en *.md fase | 0 valores reales (solo fixtures de test) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SEC-02 | 96-01, 96-03 | Audit sitio/repo público: secretos, .env.example, errores genéricos, headers, CSP enforced | ✓ SATISFIED | gitleaks clean + guard CI + CSP live enforced + errores genéricos |
| SEC-03 | 96-01, 96-02 | Audit Supabase: Splinter + grants/RLS DB viva + allowlist + pgvector + pnpm audit | ✓ SATISFIED | 0/0/0/0 checks + allowlist sync + pnpm audit 0; pgvector reframed a handoff honesto (ver nota) |
| SEC-04 | 96-03 | B26 rotación DB password = checkpoint operador documentado, agente no rota | ✓ SATISFIED | 96-OPERATOR-HANDOFF cita runbook 75, B26 PENDIENTE operador |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Ninguno | — | 0 debt markers (TBD/FIXME/XXX) sin referencia; `S3CR3T-TICKET-*` en docs son fixtures de test triados como FP; `sb_secret_realvalueXXX` en docs son mutation self-check, no secretos reales. |

### Human Verification Required

Ninguno. La verificación interactiva de hidratación bajo CSP enforced (BrowserOS: consola 0 errores + island de filtros vivo re-filtrando 20→19 cards) fue cerrada por el ORQUESTADOR el 2026-07-23 sobre el deploy `1bcdc948` y está registrada en 96-CSP-DEPLOY-EVIDENCIA.md §3 — aceptada como evidencia per el método de verificación de esta fase. El verifier re-confirmó el CSP enforced live via curl independiente.

### Gaps Summary

Sin gaps. Los 4 must-haves están verificados con evidencia re-corrida por el verifier (no solo claims de SUMMARY). El único ítem con wording divergente (ROADMAP SC#2 "pgvector ≥0.8.2 confirmado" vs realidad 0.8.0) es una desviación intencional documentada como handoff de operador — la plataforma gestionada no ofrece ≥0.8.2 y el criterio de éxito de la fase ya la especifica como "gap → handoff honesto". Exposición práctica baja (0 funciones anon-executable). No accionable como gap; es deuda de operador correctamente escalada.

---

_Verified: 2026-07-23T15:42:00Z_
_Verifier: Claude (gsd-verifier)_
