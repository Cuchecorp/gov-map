---
status: partial
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-legal
source: [103-VERIFICATION.md]
started: 2026-07-26T12:05:00Z
updated: 2026-07-26T12:05:00Z
---

## Current Test

[awaiting operator provisioning]

## Tests

### 1. Supabase publishable key + plantilla OTP
expected: sb_publishable_… creada (proyecto bctyygbmqcvizyplktuw); Email provider ON; plantilla OTP renderiza {{ .Token }} (NO {{ .ConfirmationURL }}); `wrangler secret put SUPABASE_PUBLISHABLE_KEY` confirmado
result: [pending]

### 2. Resend: dominio verificado + DPA firmado + RESEND_API_KEY
expected: dominio de envío verificado; DPA Resend firmado (subencargado 21.719); key re_… cargada como wrangler secret + GH Actions secret; NOTIF_FROM + NOTIF_BASE_URL seteados
result: [pending]

### 3. NOTIF_TOKEN_SECRET (GH Actions + Worker, mismo valor)
expected: ambos pasos de digest-daily.yml lo leen; sin él seguir() y ambos CLIs fallan fail-loud
result: [pending]

### 4. Deploy + flip NOTIF_PUBLIC_ENABLED=true (o mantener Flag-OFF)
expected: build OpenNext Docker + wrangler deploy; /spike-auth ausente del build; Camino A + CSP intactos; flip vía Worker env var (jamás committeado). Deploy viaja con Phase 104
result: [pending]

### 5. Evidencia SC2 (curl block de 97-SPIKE-EVIDENCE sobre el deploy vivo)
expected: Set-Cookie + refresh de sesión sobreviven OpenNext (REDACTADO)
result: [pending]

### 6. BrowserOS DOM: botón Seguir presente con flag ON en ambas fichas
expected: con flag ON renderiza en proyecto/[boletin] y parlamentario/[id]; ausente con OFF (ya verificado estático como return null)
result: [pending]

### 7. Dry-run manual workflow_dispatch (confirmaciones + digest) antes del flip LIVE
expected: loop doble opt-in completo E2E; baja one-click de usuario multi-suscripción mata TODO el digest (CR-03)
result: [pending]

### 8. UAT email real (confirmación + digest + unsubscribe one-click)
expected: bandeja real recibe confirmación → confirma → recibe digest → unsubscribe detiene todo
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
