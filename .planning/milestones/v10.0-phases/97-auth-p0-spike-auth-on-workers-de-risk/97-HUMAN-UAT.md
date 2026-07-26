---
status: partial
phase: 97-auth-p0-spike-auth-on-workers-de-risk
source: [97-VERIFICATION.md]
started: 2026-07-24
updated: 2026-07-24
---

## Current Test

[awaiting operator provisioning + human testing]

## Tests

### 1. SC2 — Set-Cookie + refresh de sesión sobreviven el pipeline OpenNext (deploy real)
expected: tras provisionar (publishable key `sb_publishable_` + plantilla OTP `{{ .Token }}` + `wrangler secret put SUPABASE_PUBLISHABLE_KEY` + `SPIKE_AUTH_ENABLED=true` en un Worker preview), el flujo OTP en `/spike-auth` emite cookies `sb-*`, el refresh intercambia el token tras expiry, y dos cookie-jars no se contaminan (anti cache-leak, Pitfall #4). Bloque de reproducción copy-paste en `97-SPIKE-EVIDENCE.md §Reproducción SC2`.
result: [pending — checkpoint de operador diferido, patrón handoff v7/v9]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
