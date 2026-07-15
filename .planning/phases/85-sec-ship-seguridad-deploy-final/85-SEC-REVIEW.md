---
phase: 85-sec-ship-seguridad-deploy-final
reviewed: 2026-07-15T00:00:00Z
depth: deep
scope: security-only (gate DEMO-04, milestone v8.1)
files_reviewed: 21
files_reviewed_list:
  - .github/workflows/deploy-cloudflare.yml
  - .github/workflows/leyes-weekly.yml
  - .github/workflows/agenda-weekly.yml
  - .github/workflows/backfill.yml
  - .github/workflows/backup-parlamentario.yml
  - .github/workflows/fichas-backfill.yml
  - .github/workflows/lobby-camara-weekly.yml
  - .github/workflows/lobby-leylobby-weekly.yml
  - .github/workflows/probidad-weekly.yml
  - .github/workflows/roster-weekly.yml
  - app/next.config.ts
  - app/wrangler.jsonc
  - app/open-next.config.ts
  - app/app/page.tsx
  - app/components/actualidad-module.tsx
  - app/components/search-box.tsx
  - app/lib/utils.ts
  - app/lib/supabase.ts
  - app/app/proyecto/[boletin]/page.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/contraparte/[id]/page.tsx
  - app/app/red/page.tsx
  - app/components/red/red-graph.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 85: Security Review Report (SEC-only)

**Reviewed:** 2026-07-15
**Depth:** deep (security-only, gate DEMO-04)
**Files Reviewed:** 21 (10 CI workflows + worker/next config + 9 app surfaces)
**Status:** issues_found

## Summary

Auditoría de seguridad app-side + CI para el cierre v8.1 del sitio público
`gov-map` (repo PÚBLICO). El resultado es **sólido**: cero críticos.

**Fortalezas confirmadas (no son findings, se registran como evidencia):**

- **CI hardening real.** Los 10 workflows declaran `permissions: contents: read`
  (least-privilege) salvo `backup-parlamentario` que legítimamente pide
  `contents: write` para commitear el snapshot. **Cero `pull_request_target`**,
  cero `issue_comment`, cero triggers que ejecuten código de un fork con secrets.
  Todos los disparos son `schedule` + `workflow_dispatch` (operador autenticado).
- **Inyección de comandos mitigada correctamente.** Todos los inputs de
  `workflow_dispatch` (`limite`, `boletines`, `desde`, `hasta`, `institucion`,
  `anio`, `reembed`) se pasan **por `env:` y se referencian como `$VAR`**, nunca
  interpolados como `${{ github.event.inputs.* }}` dentro del `run:`. Esto rompe
  el vector clásico de script injection en un step que porta `SUPABASE_SECRET_KEY`.
  `probidad-weekly` va más allá y **valida `LIMITE` con `grep -qE '^[0-9]+$'`**.
- **Secrets nunca en claro.** Cero `echo $SECRET`, cero secrets como argumento
  visible en `ps`, cero hardcodeo. Todo vía `${{ secrets.* }}`.
- **App surface limpia.** `safeExternalHref` neutraliza `javascript:`/`data:`/`vbscript:`
  en todo `href` derivado de datos de fuente; enlaces externos con
  `rel="noopener noreferrer"` + `target="_blank"`. `SearchBox` usa
  `encodeURIComponent` en la query. Los 3 params dinámicos (`[boletin]`,
  `parlamentario/[id]`, `contraparte/[id]`) y `/red?seed=` se **validan con regex
  ANTES de tocar la DB** y usan `.eq()`/`.rpc()` parametrizados (sin interpolación SQL).
- **Cero secrets client-side.** Ningún componente `"use client"` lee
  `SUPABASE_*`/`GEMINI`/`DEEPSEEK`/`MINIMAX`/service key. `lib/supabase.ts` abre con
  `import "server-only"`. Los flags leídos con `process.env` (money/net/cruces gates)
  viven en Server Components y NO llevan prefijo `NEXT_PUBLIC_`.
- **`svg.innerHTML = html` en `red-graph.tsx:393` NO es XSS.** El string se compone
  solo de floats geométricos (`getBoundingClientRect`) + un color constante; ningún
  dato de DB o de usuario entra al markup. Verificado, descartado.

Los findings abajo son de **postura defensiva** (defensa en profundidad), no
vulnerabilidades explotables hoy. El más relevante para un sitio público en
producción es la **ausencia total de cabeceras de seguridad HTTP** (WR-01).

---

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Cero cabeceras de seguridad HTTP en el sitio público

**File:** `app/next.config.ts:3-5` (config vacía) · `app/wrangler.jsonc` (sin `_headers`) · no existe `app/public/_headers`
**Issue:** El sitio público en producción no emite **ninguna** cabecera de
seguridad. `next.config.ts` es un objeto vacío (`{}`), no hay `async headers()`,
no existe un archivo `public/_headers` (que Cloudflare Workers/Assets sirve
nativamente), y el Worker de OpenNext no inyecta cabeceras. Falta, como mínimo:
`Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (defensa
clickjacking — relevante porque el sitio embebe iframes propios y podría ser
embebido por terceros), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Strict-Transport-Security` y `Permissions-Policy`. Para un sitio ciudadano
público con foco en prensa, la ausencia de CSP y anti-clickjacking es la brecha
de seguridad más tangible del cierre v8.1.
**Fix:** Añadir un `app/public/_headers` (servido por Cloudflare Assets) o
`async headers()` en `next.config.ts`. Ejemplo `public/_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```
Nota: verificar que `frame-ancestors 'none'` / `X-Frame-Options: DENY` no rompa
el iframe same-origin de la ficha (usar `frame-ancestors 'self'` si se tiling
propio). Ajustar `script-src` si Next.js requiere `'unsafe-inline'` para hidration
bootstrap; preferir nonce si es viable.

### WR-02: Actions de terceros pinneadas a tag mutable, no a SHA (repo público)

**File:** los 10 workflows — p.ej. `deploy-cloudflare.yml:35,38,41`, `backup-parlamentario.yml:44,47,50`, y todos los `uses:`
**Issue:** Todas las actions se referencian por tag mutable
(`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`,
`denoland/setup-deno@v2`). Un tag es reasignable: si la cuenta de un mantenedor
de action es comprometida y reapunta `v4` a un commit malicioso, ese código
corre en un job que porta `SUPABASE_SECRET_KEY`, `DEEPSEEK_API_KEY`,
`R2_SECRET_ACCESS_KEY` y (en `backup-parlamentario`) el `GITHUB_TOKEN` con
`contents: write` + push. Es la vía de supply-chain estándar. Guía oficial de
GitHub para workflows que tocan secrets: **pin por SHA completo**.
**Fix:** Pinnear cada `uses:` al SHA de 40 caracteres del release, con el tag en
comentario. Ejemplo:
```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
- uses: pnpm/action-setup@fe02b34f77f8bc703788d5817da081398fad5dd2 # v4.0.0
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
```
Dependabot (`.github/dependabot.yml` con `package-ecosystem: github-actions`)
mantiene los SHA al día automáticamente — recomendado añadirlo (hoy ausente).

### WR-03: `backup-parlamentario` hace `git push` automático con `contents: write` en cron

**File:** `.github/workflows/backup-parlamentario.yml:24-25,65-75`
**Issue:** El workflow corre por `schedule` (lunes 06:00 UTC), tiene
`permissions: contents: write` y ejecuta `git commit` + `git push` sin
intervención humana usando el `GITHUB_TOKEN`. En sí es el diseño querido (ID-09),
pero combina tres factores de riesgo: (a) push automático a `master` de un repo
público, (b) el contenido commiteado (`parlamentario.seed.json`) se genera desde
fetch de fuentes externas (Senado/Cámara XML) — un envenenamiento de la fuente se
persiste en git sin revisión, y (c) es el único workflow con permiso de escritura,
así que es el objetivo de mayor valor si WR-02 se materializa. El `--preserve-estado`
protege el campo `estado` (compuerta ID-01) pero no el resto del snapshot.
**Fix:** Defensa en profundidad: (1) restringir el push a una rama/PR en vez de a
`master` directo (abrir PR con `peter-evans/create-pull-request` pinneado por SHA,
revisión humana antes de merge); o como mínimo (2) proteger `master` con branch
protection que exija PR; y (3) tras aplicar WR-02, este es el workflow prioritario
para el pin-by-SHA. Si el push directo a `master` es requisito operacional, dejarlo
documentado como riesgo aceptado explícito.

## Info

### IN-01: `deploy-cloudflare` usa `input.environment` solo como etiqueta — verificar que no se cablee al target

**File:** `.github/workflows/deploy-cloudflare.yml:21-25`
**Issue:** El input `environment` (default `"production"`) se documenta como
"etiqueta informativa … no cambia el target" y efectivamente no se referencia en
ningún `run:`/`env:`. Correcto hoy. Se anota para que futuros cambios no lo
promuevan a un selector de entorno sin validación (evitar deploy a un target
arbitrario vía input).
**Fix:** Mantener el input inerte o, si se cablea, validarlo contra una allowlist
(`production`|`staging`) antes de usarlo.

### IN-02: `pnpm rebuild esbuild workerd sharp || true` enmascara fallo de build nativo

**File:** `.github/workflows/deploy-cloudflare.yml:54`
**Issue:** El `|| true` traga cualquier error del rebuild de binarios nativos. No
es un riesgo de seguridad directo, pero si el rebuild de `esbuild`/`workerd`
fallara silenciosamente el deploy podría publicar un artefacto inconsistente. Es
higiene de pipeline, no vulnerabilidad.
**Fix:** Quitar `|| true` o degradar a un warning explícito que no oculte un fallo
del que el deploy depende.

### IN-03: `SUPABASE_SECRET_KEY` = `service_role` (bypassa RLS) recae en disciplina de código

**File:** `app/lib/supabase.ts:34-53`
**Issue:** El sitio público lee con la **service key** (`service_role`), que
**bypassa RLS** por diseño (Camino A, trade-off ya documentado y aceptado). La
protección de PII no está en la DB para esta ruta — recae en el guard CI
`lockdown-guard.test.ts` que escanea `app/`. No es un defecto de este cambio; se
registra porque en un repo público es la superficie donde un `.from('parlamentario')`
accidental filtraría PII sin que RLS lo frene. El guard es la única red.
**Fix:** Ninguno requerido (fuera del scope de v8.1). Confirmar que el guard
`lockdown-guard.test.ts` corre en el CI de PR (bloqueante) y cubre las superficies
nuevas de v8/v8.1 (`actualidad-module.tsx`, `page.tsx`) — todas leen tablas NO-PII
(`votacion`/`proyecto`/`tramitacion_evento`/`citacion`/`lobby_audiencia`/`proyecto_ficha`),
verificado en esta revisión.

### IN-04: CodeQL corre por "default setup" (repo-level), no como workflow versionado

**File:** `.github/workflows/` (no existe archivo `codeql*.yml`)
**Issue:** El scope indica "CodeQL corre en push (visto verde)", pero **no hay un
workflow CodeQL committeado** en `.github/workflows/`. Eso significa que corre vía
GitHub *Default Setup* (config a nivel de repo, invisible en el árbol). Cobertura:
Default Setup analiza JS/TS con el query pack estándar en push a `master` y en PRs.
Limitación: la config no es auditable en el repo, no está versionada, y su alcance
(qué lenguajes/queries) no es verificable desde el código. También: `dependabot.yml`
está ausente → sin alertas automáticas de dependencias vulnerables versionadas
(las alertas Dependabot del historial —postcss/uuid/esbuild— se parchearon a mano).
**Fix:** Opcional pero recomendado para trazabilidad: migrar a *Advanced Setup*
committeando `.github/workflows/codeql.yml` (queries `security-extended`), y añadir
`.github/dependabot.yml` con `npm` + `github-actions` para alertas + PRs de bump
automáticas.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (security-only)_

---

## Fixes Applied (Phase 85 fixer — 2026-07-15)

### WR-02 → FIXED (commit `9040a80`)

Pinned all 10 workflows to full 40-char SHA with tag comment. Verified SHAs via `gh api`:
- `actions/checkout@v4` → `34e114876b0b11c390a56381ad16ebd13914f8d5` # v4.3.1
- `pnpm/action-setup@v4` → `b906affcce14559ad1aafd4ab0e942779e9f58b1` # v4.4.0
- `actions/setup-node@v4` → `49933ea5288caeca8642d1e84afbd3f7d6820020` # v4.4.0
- `denoland/setup-deno@v2` → `22d081ff2d3a40755e97629de92e3bcbfa7cf2ed` # v2.0.5

Also created `.github/dependabot.yml` (`github-actions` + `npm/app`, weekly Monday) so
Dependabot will keep the pinned SHAs current via automatic PRs.

### D1 → FIXED (commit `10470b4`)

Created `.github/workflows/ci.yml` (`on: push master + pull_request`):
- `pnpm --filter ./app test -- --run` (vitest; covers lockdown-guard, bento-guards, anti-insinuación)
- `pnpm --filter ./app exec tsc --noEmit`
- SHA-pinned actions (coherente con WR-02)
- `concurrency: cancel-in-progress: true` para cancelar runs viejos en PRs

The guard now runs automatically on every push and PR — not only on local `pnpm test`.

### WR-01 → FIXED (commit `3cb8fd0`)

Applied conservative security headers (no enforced CSP to protect Next.js hydration):

**`app/next.config.ts`** — `async headers()` → served by OpenNext Worker for SSR + API routes:
- `X-Frame-Options: DENY` (no iframes in the app — verified)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Content-Security-Policy-Report-Only` (detects, does not enforce — avoids breaking `__NEXT_DATA__` inline scripts)

**`app/public/_headers`** — same headers for static assets served by Cloudflare Assets.

**Operator TODO (post-deploy):** After confirming zero CSP violations in the browser console,
promote `Content-Security-Policy-Report-Only` to `Content-Security-Policy` (enforced). Add
`report-uri` to collect violations before enforcing.

### WR-03 → SKIPPED (operator recommendation)

No code change. Branch protection on `master` + moving `pgtap` out of public are DB/infra ops.
See `85-01-SUMMARY.md` for detailed operator recommendations.

### D2, D3, D4 → SKIPPED (operator tasks)

DB-level items: pgtap in public schema, migration ledger drift (0052/0053 not applied), and
leylobby cursor. Documented in `85-01-SUMMARY.md`. None block Gate DEMO-04.

### Test Gate

**PASSED** — `pnpm --filter ./app test -- --run`: 80 test files, 991 tests, all green.
`pnpm --filter ./app exec tsc --noEmit`: clean (no type errors in modified files).
