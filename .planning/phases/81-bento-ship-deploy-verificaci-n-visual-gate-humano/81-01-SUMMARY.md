---
phase: "81"
plan: "01"
subsystem: deploy
tags: [cloudflare, opennext, docker, wrangler, bento-v8]
dependency_graph:
  requires: [80-01]
  provides: [BENTO-07]
  affects: [observatorio-congreso.thevalis.workers.dev]
tech_stack:
  added: []
  patterns: [docker-linux-build, opennext-cf, wrangler-oauth-local]
key_files:
  created: []
  modified:
    - app/.open-next/ (rebuilt artifact, not committed)
decisions:
  - Docker volume obs-build-out removed and recreated to avoid tar "file exists" collisions from prior run
  - Global wrangler 4.109.0 used (node C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js)
  - MSYS_NO_PATHCONV=1 required in Git Bash to prevent path rewriting /host → C:/Program Files/Git/host
metrics:
  duration: ~25 min (docker build ~15 min + deploy ~2 min)
  completed: 2026-07-15
  tasks_completed: 3/3
  files_changed: 0
---

# Phase 81 Plan 01: Bento v8 Deploy a Cloudflare — Summary

**One-liner:** Deploy bento v8 OpenNext bundle a Cloudflare Workers vía Docker Linux build + wrangler OAuth local — Version ID `8ad839b3-497d-4824-913c-ac4b710a0e08`.

## Tasks Completed

| Task | Description | Outcome |
|------|-------------|---------|
| 1 | Pre-flight (suite, git push, docker check) | Suite 917 verde; master pushed b497e92; Docker v29.5.2 running |
| 2 | Docker build + wrangler deploy | BUILD_OK; 15 assets uploaded; Version ID `8ad839b3-497d-4824-913c-ac4b710a0e08` |
| 3 | HTTP checks + SUMMARY | / → "Qué pasó con cada proyecto" ✓; /parlamentarios /red /sobre → 200 ✓ |

## Deploy Details

- **URL:** https://observatorio-congreso.thevalis.workers.dev
- **Version ID:** `8ad839b3-497d-4824-913c-ac4b710a0e08`
- **Worker startup time:** 27 ms
- **Assets uploaded:** 15 new/modified, 60 already cached (total 75)
- **Bundle size:** 7051.95 KiB / 1493.18 KiB gzip

## HTTP Checks

| Route | Status | Content |
|-------|--------|---------|
| / | 200 | "Qué pasó con cada proyecto" presente |
| /parlamentarios | 200 | — |
| /red | 200 | — |
| /sobre | 200 | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docker volume collision (tar "file exists" errors)**
- **Found during:** Task 2, first build attempt
- **Issue:** Prior run left `obs-build-out` volume with stale data. `set -euo pipefail` in docker-cf-build.sh caused script to abort when tar exited with code 2 (file exists).
- **Fix:** `docker volume rm obs-build-out` then re-ran with fresh volume.
- **Files modified:** None (operational fix)
- **Commit:** N/A

**2. [Rule 3 - Blocking] MSYS_NO_PATHCONV missing on first docker run attempt**
- **Found during:** Task 2, zeroth attempt
- **Issue:** Git Bash rewrote `/host` argument to `C:/Program Files/Git/host` — path doesn't exist inside container, exit 127.
- **Fix:** Prepend `MSYS_NO_PATHCONV=1` to all docker commands.
- **Files modified:** None
- **Commit:** N/A

## Known Stubs

None — visual gate (checkpoint:human-verify) follows in this same phase.

## Threat Flags

None — no new network surface introduced; same worker endpoint as prior deploys.

## Self-Check: PASSED

- SUMMARY file: present at `.planning/phases/81-bento-ship-deploy-verificaci-n-visual-gate-humano/81-01-SUMMARY.md`
- Version ID `8ad839b3-497d-4824-913c-ac4b710a0e08` confirmed in wrangler output
- HTTP checks: all pass

## Redeploy (fix anchors)

**Trigger:** CSS-only fix for anchor link visibility (`a` color override in `globals.css`, commit `32284b2`).

**Version ID:** `fb88c8a4-dd05-4b9a-a017-0c373d0f185f`

**Assets uploaded:** 2 new (`/BUILD_ID` + `/_next/static/chunks/3x_ng_-6ds3a6.css`); 53 already cached

**HTTP check:** / → 200

**Method:** Same Docker Linux build runbook as above. Key deviation from prior attempt: output volume (`obs-build-out`) was empty because the build script writes to `/build/app/.open-next` not to the volume mount path. Fixed by mounting host directory `C:/Temp/obs-build/app/.open-next` directly as `/open-next-out` and running `cp -r /build/app/.open-next/. /open-next-out/` at end of build script inline.

**Completed:** 2026-07-15
