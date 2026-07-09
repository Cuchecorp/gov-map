---
phase: 60
plan: "01"
subsystem: brand
tags: [brand, icon, favicon, og-image, manifest, header]
dependency_graph:
  requires: [BRAND-01]
  provides: [BRAND-02]
  affects: [GlobalHeader, layout metadata, PWA manifest]
tech_stack:
  added: [sharp@0.35.x (devDep, asset generation)]
  patterns: [Next.js file-convention icons, inline SVG React component, structural source-scan tests]
key_files:
  created:
    - app/app/icon.svg
    - app/app/favicon.ico
    - app/app/apple-icon.png
    - app/app/opengraph-image.png
    - app/app/manifest.ts
    - app/public/icon-192.png
    - app/public/icon-512.png
    - app/components/brand-icon.tsx
    - app/components/global-header.test.ts
    - scripts/generate-brand-assets.mjs
  modified:
    - app/components/global-header.tsx
    - app/package.json
    - pnpm-lock.yaml
decisions:
  - "Used sharp (Node) for SVG→PNG/ICO rasterization via one-off script; binaries committed"
  - "ICO encoded manually (minimal ICO format) with PNG payloads per size — no extra ico package needed"
  - "BrandIcon as inline SVG React component (not next/image) — zero HTTP round-trip, currentColor-compatible"
  - "GlobalHeader lockup: [BrandIcon 26px] + 'gov-map' — text-only wordmark replaced"
  - "Structural source-scan test idiom (same as layout.test.tsx) — no DOM render needed for Server Component"
metrics:
  duration: "~20 min"
  completed: "2026-07-09"
  tasks_completed: 2
  files_changed: 11
---

# Phase 60 Plan 01: Brand Assets & Header Lockup Summary

**One-liner:** All brand static assets generated from master C-geometry SVG (petrol #2A5859) and wired into Next.js file conventions + GlobalHeader [icon + "gov-map"] lockup.

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Brand assets | e3a28cd | icon.svg, favicon.ico, apple-icon.png, opengraph-image.png, manifest.ts, icon-192/512.png, generate-brand-assets.mjs |
| 2 | Header lockup + tests | a5b9c92 | brand-icon.tsx, global-header.tsx, global-header.test.ts |

## Asset Inventory

| File | Size | Notes |
|------|------|-------|
| `app/app/icon.svg` | <1KB | Master geometry, petrol/transparent, Next.js file convention |
| `app/app/favicon.ico` | 2KB | Multi-res 16/32/48, PNG payloads in ICO container |
| `app/app/apple-icon.png` | 2KB | 180×180, cream bg #FAF8F3 |
| `app/app/opengraph-image.png` | 35KB | 1200×630, cream bg, icon + "gov-map" + tagline |
| `app/app/manifest.ts` | — | Next.js MetadataRoute.Manifest, name=gov-map, petrol/cream theme |
| `app/public/icon-192.png` | 2KB | 192×192, cream bg (PWA manifest) |
| `app/public/icon-512.png` | 6KB | 512×512, cream bg (PWA manifest) |

## Verification Results

- `pnpm --filter app test --run`: 730/730 passed (70 test files)
- `pnpm -w typecheck`: clean (0 errors)
- `pnpm --filter app build`: exit 0; file-convention routes confirmed in build output (icon.svg, apple-icon.png, opengraph-image.png, manifest.webmanifest)
- `pnpm -w test --run`: 730/730 passed

## Deviations from Plan

None — plan executed exactly as written. ICO encoding handled inline (no `png-to-ico` package needed; manual ICO binary format with PNG payloads is well-supported by all modern browsers).

## Known Stubs

None. All assets are real generated binaries; OG image contains actual icon + wordmark + tagline text.

## Threat Flags

None. This plan adds only static assets and a visual component change to the header — no network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- `app/app/icon.svg` — FOUND
- `app/app/favicon.ico` — FOUND
- `app/app/apple-icon.png` — FOUND
- `app/app/opengraph-image.png` — FOUND
- `app/app/manifest.ts` — FOUND
- `app/public/icon-192.png` — FOUND
- `app/public/icon-512.png` — FOUND
- `app/components/brand-icon.tsx` — FOUND
- `app/components/global-header.test.ts` — FOUND
- Commits e3a28cd, a5b9c92 — FOUND in git log
