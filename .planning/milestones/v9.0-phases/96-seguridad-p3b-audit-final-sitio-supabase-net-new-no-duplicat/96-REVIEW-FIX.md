---
phase: 96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
fixed_at: 2026-07-23T15:50:00Z
review_path: .planning/phases/96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat/96-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
tests_passed: true
test_command: pnpm vitest run lib/env-example-guard.test.ts
status: all_fixed
---

# Phase 96: Code Review Fix Report

**Fixed at:** 2026-07-23
**Source review:** `.planning/phases/96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat/96-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (3 WR + 2 IN)
- Fixed: 4
- Skipped: 1 (IN-01a — WONT-FIX intencional, no hay código que cambiar)
- Test gate: PASSED (`pnpm vitest run lib/env-example-guard.test.ts` — 16/16)

## Test Gate

- PASSED — `pnpm vitest run lib/env-example-guard.test.ts` exited 0 after all fixes. 16 tests (15 previos + 1 nuevo mutation self-check base64).

## Fixed Issues

### WR-01: CSP enforced only on SSR surface — `public/_headers` still Report-Only and directive-drifted

**Files modified:** `app/public/_headers`
**Commit:** `0220be5`
**Applied fix:**
- Renombrado `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (enforced)
- Añadidas directivas NET-NEW: `connect-src 'self'` y `object-src 'none'` (espejo exacto de `next.config.ts`)
- Actualizado comentario de cabecera: ahora indica que el archivo es ESPEJO de `next.config.ts`, incluye nota "latente hasta redeploy" y documenta la omision intencional de HSTS `preload` (cubre IN-01a y IN-01b)
- **NOTA: fix latente hasta redeploy a Cloudflare Workers Assets**

### WR-02: env-example guard has false-negative gaps for base64 and short secrets

**Files modified:** `app/lib/env-example-guard.test.ts`
**Commit:** `46a9908`
**Applied fix:**
- Añadida regla base64-ish al detector `detectarValorNoPlaceholder`: captura valores ≥20 chars con alphabet `[A-Za-z0-9+/=]` que contengan al menos un char ambiguo (`+`, `/`, `=`) y no sean URLs
- Cubre HMAC blobs, R2 secret keys, JWT secrets no-eyJ que escapaban al regex alfanumérico anterior
- Añadido test mutation nuevo: "MUERDE: base64 con '+' y '/' (HMAC blob, R2 secret key, JWT secret no-eyJ)"
- 0 falsos positivos nuevos en `.env.example` real (todos sus valores no-placeholder ya estaban en la allowlist)

### WR-03: gitleaks allowlist is whole-path — will mask a future real secret in those files

**Files modified:** `.gitleaks.toml`
**Commit:** `f6b61e4`
**Applied fix:**
- Reemplazado `paths = [...]` (supresión de archivo completo, 6 paths) por `regexes = [...]` acotadas a los tokens FP exactos:
  - `S3CR3T-TICKET-(?:NO-LEAK-9f2a|NO-LEAK-70|MASIVO-70)` — los 3 valores exactos de las constantes de test
  - `WVUpe\+ogzS8t9\+hVNzDT` — prefijo único del `__VIEWSTATE` ASP.NET en el fixture HTML
- Gitleaks sigue escaneando todos los archivos — solo silencia los tokens FP específicos
- Verificado: `gitleaks git --redact --config .gitleaks.toml` → "no leaks found" (1726 commits)

### IN-02: `minimumReleaseAgeExclude` is documented-inert dead config

**Files modified:** `pnpm-workspace.yaml`
**Commit:** `ef64d56`
**Applied fix:**
- Eliminado el bloque `minimumReleaseAgeExclude: [openai@6.44.0]` (7 líneas incluyendo comentario)
- Confirmado: no existe `minimumReleaseAge` base en el repo; la config era inerte y auto-documentada como candidata a borrarse
- Sin impacto en `pnpm install`; los overrides restantes (postcss/esbuild/uuid/protobufjs/sharp) intactos

## Skipped Issues

### IN-01a: HSTS lacks `preload`

**File:** `app/next.config.ts:20-22`
**Reason:** WONT-FIX intencional. La omisión de `preload` es una decisión de operador documentada (preload es irreversible y requiere control del apex domain). No hay código que cambiar. El comentario aclaratorio fue añadido en el fix de WR-01 dentro de `app/public/_headers`.

---

_Fixed: 2026-07-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
