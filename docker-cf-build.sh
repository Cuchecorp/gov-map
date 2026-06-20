#!/usr/bin/env bash
# Linux OpenNext build for Cloudflare Workers (Phase 20).
# Windows-built bundles 500 at runtime (dynamic require of middleware-manifest.json).
# This builds the bundle on Linux inside a container, then copies .open-next back to the host.
set -euo pipefail

echo "[docker-build] node $(node --version)"
corepack enable
corepack prepare pnpm@11.3.0 --activate

echo "[docker-build] copying source (excluding node_modules/.git/.next/.open-next)…"
mkdir -p /build
cd /host
tar --exclude=node_modules --exclude=.git --exclude=.next --exclude=.open-next --exclude=.wrangler -cf - . | (cd /build && tar -xf -)

cd /build
echo "[docker-build] pnpm install (ignored-builds gate exits nonzero in pnpm 11; non-fatal)…"
pnpm install --no-frozen-lockfile || echo "[docker-build] install returned nonzero (ignored-builds gate) — continuing; native deps ship prebuilt binaries"
echo "[docker-build] rebuild native deps used by the build (prebuilt fallback)…"
pnpm rebuild esbuild workerd 2>/dev/null || true

echo "[docker-build] opennext cf-build…"
pnpm --filter app run cf-build

echo "BUILD_OK bundle at /build/app/.open-next (retrieve via docker cp)"
ls /build/app/.open-next | head
