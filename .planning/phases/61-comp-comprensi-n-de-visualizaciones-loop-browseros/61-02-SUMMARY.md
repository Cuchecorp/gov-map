---
phase: 61
plan: "02"
subsystem: deploy
tags: [deploy, cloudflare, wrangler, opennext, docker]
dependency_graph:
  requires: [61-01, 60-01, 59-03]
  provides: [COMP-02-deploy-1, v6-live]
  affects: [observatorio-congreso.thevalis.workers.dev]
tech_stack:
  added: []
  patterns: [docker-linux-build, wrangler-oauth-local, opennext-volume-extract]
key_files:
  created:
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-02-PLAN.md
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-02-SUMMARY.md
  modified: []
decisions:
  - "Build via Docker node:22-slim (not Alpine — workerd binary requires glibc); source copied via tar (exclude node_modules) to avoid Docker virtiofs bottleneck with OneDrive-mounted source"
  - "Deploy via wrangler 4.109.0 installed globally (npm install -g wrangler@4), NOT the pnpm-local wrangler (which needs @cloudflare/workerd-windows-64 and is broken on this machine); OAuth token from existing local auth (xdg.config)"
  - "CI path blocked: CLOUDFLARE_API_TOKEN secret not set in Cuchecorp/gov-map repo; local path successful"
  - ".open-next built in Docker volume, extracted to Windows app/.open-next via docker cp, then wrangler deploy from Windows with --config wrangler.jsonc"
metrics:
  duration: "~2 hours (Docker build, iteration on approach)"
  completed: "2026-07-09"
  tasks_completed: 4
  tasks_total: 4
---

# Phase 61 Plan 02: Deploy #1 — v6 LIVE Summary

v6 (Phases 59+60+61-01: autoría, brand, leyenda cruces + triple-requisito charts) desplegado a producción en Cloudflare Workers.

## Deployment Details

| Field | Value |
|-------|-------|
| Worker | observatorio-congreso |
| URL | https://observatorio-congreso.thevalis.workers.dev |
| Version ID | cd7deb4b-8c1c-4f69-ac98-67ac61cf7d0e |
| Build method | Docker node:22-slim + wrangler 4.109.0 local OAuth |
| Assets uploaded | 9 new / 49 cached (total 58 static assets) |
| Worker startup time | 43 ms |

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Push master to origin (6 commits ahead) | 9012e62 | Pushed |
| 2 | Trigger GitHub Actions deploy | Run 29027652583 | FAILED: CLOUDFLARE_API_TOKEN secret missing in repo |
| 3 | Docker build + local wrangler deploy | - | SUCCESS: cd7deb4b |
| 4 | LIVE verification (HTTP checks) | - | ALL PASS |

## LIVE Verification

| Surface | URL | Status | Evidence |
|---------|-----|--------|---------|
| Home (200 + brand) | / | 200 | Body contains "gov-map" x2 |
| /icon.svg | /icon.svg | 200 | SVG served correctly |
| /buscar | /buscar | 200 | Search page renders |
| /parlamentarios | /parlamentarios | 200 | Directory renders |
| Parlamentario (D1009) | /parlamentario/D1009 | 200 | Contains "Cómo leer esto" x4 (Phase 61-01 legend LIVE) |
| Proyecto mocion (14309-04) | /proyecto/14309-04 | 200 | Contains "Autores" section + "Cómo leer esto" + "no afirma" + "causalidad" |

## Feature Verification (v6 content confirmed LIVE)

- Phase 59 (autoría): "Autores" section renders in /proyecto/14309-04
- Phase 60 (brand): "gov-map" identifier present in home HTML
- Phase 61-01 (leyenda cruces): "Cómo leer esto" + "no afirma" + "causalidad" confirmed in both parlamentario and proyecto pages

## Deviations from Plan

### Task 2: GitHub Actions — CI Secret Missing

**Found during:** Task 2 (GitHub Actions workflow triggered)
**Issue:** The GitHub Actions workflow requires `CLOUDFLARE_API_TOKEN` as a repository secret. This secret is not set in the Cuchecorp/gov-map repo. The CI build itself completed successfully (OpenNext worker.js generated), but wrangler deploy failed with `CLOUDFLARE_API_TOKEN` not found in non-interactive environment.
**Fix:** Used local Docker build + global wrangler 4.109.0 (OAuth-authenticated) instead. This is documented as the local path in `docs/deploy-cloudflare.md` (Opción B) and matches the procedure documented in MEMORY (camino-a-post-legacy-cutover).
**Impact:** None — deploy succeeded, equivalent outcome.

### Docker Build: Alpine vs Debian

**Found during:** Docker troubleshooting
**Issue:** `node:22-alpine` cannot run the workerd binary (glibc vs musl ABI mismatch). `bin/workerd` exists but `sh: not found` when executing it.
**Fix:** Switched to `node:22-slim` (Debian-based, glibc), which correctly executes workerd during the OpenNext build.
**Documented for:** Future deploys — always use `node:22-slim` (or `node:22`) not `node:22-alpine`.

### Docker Source Copy: OneDrive Bottleneck

**Found during:** Multiple Docker build attempts
**Issue:** Mounting OneDrive-backed directory directly into Docker is extremely slow (~20+ minutes for tar copy) due to Docker Desktop virtiofs overhead over OneDrive sync layer.
**Fix 1:** Use `node:22-slim` (faster than alpine for the actual build, but copy bottleneck remains).
**Fix 2:** Pre-copy source via PowerShell to `C:/Temp/obs-build` (fast local path), then mount that to Docker — tar copy completes in ~5 min vs never-completing from OneDrive.
**Documented for:** `docker-cf-build.sh` in repo root already uses `/host:ro` pattern; for future operators: copy to local non-OneDrive path first OR use GitHub Actions.

### Wrangler version: global wrangler 3.57 is a Python package impostor

**Found during:** Task 3 — local deploy attempt
**Issue:** `C:/Users/Carlo/miniconda3/Scripts/wrangler` is a Python package (moduleNotFoundError: 'Reader'), not the Cloudflare wrangler. The real wrangler at `C:/Users/Carlo/AppData/Roaming/npm/wrangler` is v3.57.0 which doesn't support the `assets.directory`/`assets.binding` format (requires wrangler 4).
**Fix:** `npm install -g wrangler@4` → wrangler 4.109.0 at `C:/Users/Carlo/AppData/Roaming/npm/`, invoked via `node .../wrangler/bin/wrangler.js` to bypass PATH resolution picking up pnpm-local (broken `@cloudflare/workerd-windows-64`).
**Documented for:** Future deploys — use `node "C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js" deploy --config wrangler.jsonc` from `app/` dir.

## Known Stubs

None. This is a deploy plan — no new code was added.

## Threat Flags

None. No new source code. Deploy only.

## Self-Check: PASSED

- Deployment Version ID `cd7deb4b-8c1c-4f69-ac98-67ac61cf7d0e` confirmed by wrangler deploy output
- Worker URL `https://observatorio-congreso.thevalis.workers.dev` returns HTTP 200
- Phase 61-01 content ("Cómo leer esto", "no afirma") confirmed in live responses via curl
- Phase 59 content ("Autores") confirmed in live response for /proyecto/14309-04
- Phase 60 brand ("gov-map") confirmed in live response for /

## Operator Note: Fix CI for future deploys

To re-enable GitHub Actions deploys (faster, no local Docker needed):
1. Go to Cuchecorp/gov-map → Settings → Secrets and variables → Actions
2. Add `CLOUDFLARE_API_TOKEN` with a "Edit Cloudflare Workers" API token
3. Add `CLOUDFLARE_ACCOUNT_ID` = `10fb709d866bb5b06dd2a5d13c8dd472`
4. Future deploys: Actions → deploy-cloudflare → Run workflow
