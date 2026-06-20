---
phase: 20
plan: 05
subsystem: deploy-cloudflare
tags: [deploy, cloudflare-workers, opennext, noindex, secrets, wrangler]
requires:
  - "20-03 + 20-04 (cloud poblado: proyectos/embeddings/votos/lobby/patrimonio)"
  - ".env con SUPABASE_ANON_KEY (operador, ya presente)"
  - "wrangler autenticado (OAuth, sanchez.rossi@gmail.com, account 10fb709d…)"
provides:
  - "Worker observatorio-congreso DESPLEGADO: https://observatorio-congreso.thevalis.workers.dev"
  - "3 secrets de runtime: SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY (MONEY_PUBLIC_ENABLED ausente)"
  - "noindex,nofollow por defecto (toggle PUBLIC_INDEXABLE) hasta la pasada legal"
affects:
  - "Habilita 20-06 (verificación e2e). gov-map.com custom domain = paso de operador diferido."
tech-stack:
  added: []
  patterns:
    - "Build OpenNext en Linux vía Docker (node:22) — el build en Windows produce bundle que 500ea (dynamic require middleware-manifest.json). docker cp del bundle + wrangler deploy desde host (OAuth)."
    - "noindex fail-closed con generateMetadata (espejo de money-gate): solo PUBLIC_INDEXABLE=true indexa."
key-files:
  created:
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/20-05-SUMMARY.md"
    - "docker-cf-build.sh (helper de build Linux reproducible)"
  modified:
    - "app/app/layout.tsx (generateMetadata robots noindex toggle)"
    - "app/lib/buscar.ts (PARLAMENTARIO_ID_RE: P##### -> [DSP]\\d{3,5})"
decisions:
  - "wrangler YA estaba autenticado (OAuth) → no requirió login de operador. anon key YA en .env → no requirió input. Único bloqueo real: el build de Windows."
  - "Windows EPERM (symlinks) NO ocurrió (Developer Mode activo), pero el bundle de Windows 500ea en runtime (dynamic require de middleware-manifest.json). Fix: build en Linux vía Docker (WSL no tenía distro usable; deploy-cloudflare.yml Actions no usado: repo no en GitHub)."
  - "Bug de integración encontrado en deploy: el regex de id de parlamentario (P#####) no matcheaba los ids reales del seed (D####/S####) → TODAS las fichas 404eaban. Corregido a [DSP]\\d{3,5}."
  - ".env tenía BOM (re-agregado al editar en Windows) → removido; CRLF → carga BOM/CRLF-safe vía ~/obs_env.sh."
metrics:
  duration: "~50 min (incl. diagnóstico Windows-bundle + build Linux Docker)"
  completed: "2026-06-20"
  tasks: 5
  files: 3
---

# Phase 20 Plan 05: Wiring + noindex + deploy a Cloudflare Workers — Summary

El Observatorio está **DESPLEGADO EN PRODUCCIÓN**: **https://observatorio-congreso.thevalis.workers.dev** (Worker `observatorio-congreso`), cableado al Supabase de la nube poblado, con `noindex` por defecto y MONEY/NET apagados.

## What was built

- **noindex toggle** (`app/app/layout.tsx`): `generateMetadata` con `robots: { index:false, follow:false }` fail-closed; solo `PUBLIC_INDEXABLE=true` (var del Worker) indexa. Espejo de `money-gate`.
- **3 secrets de runtime del Worker** (`wrangler secret put`, vía stdin): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon, RLS public-read — NUNCA el service key), `GEMINI_API_KEY` (embeddings de /buscar en runtime). `MONEY_PUBLIC_ENABLED` **ausente**. Confirmado con `wrangler secret list`.
- **Build + deploy**: el build de OpenNext en **Windows produce un bundle roto** que 500ea en runtime (`Dynamic require of "/.next/server/middleware-manifest.json" is not supported`). Diagnosticado con `wrangler dev` local. Fix: build de OpenNext en **Linux vía Docker** (`docker-cf-build.sh`, node:22 — copia el source sin node_modules, instala, `opennext cf-build`), `docker cp` del `.open-next` al host, y `wrangler deploy` desde el host (OAuth ya autenticado). Sitio en `*.workers.dev`, HTTP 200, noindex presente.

## Deviations / notes

- **Bug de integración (fix incluido):** `PARLAMENTARIO_ID_RE` era `/^P\d{5}$/` (esquema documentado en 0005) pero el seeder emite ids `D####`/`S####` → todas las fichas 404eaban. Corregido a `/^[DSP]\d{3,5}$/`. El RPC `parlamentario_publico` no tenía constraint de formato; solo el guard del frontend bloqueaba.
- **`pnpm --filter app deploy` colisiona con el builtin `deploy` de pnpm** → usar `pnpm --filter app run deploy` (o `wrangler deploy` directo sobre el `.open-next` ya construido).
- **gov-map.com (custom domain): DIFERIDO** — paso de operador (agregar el dominio a la cuenta Cloudflare + DNS). La URL `*.workers.dev` es el entregable para la ONG mientras tanto.
- **docker-cf-build.sh** queda como helper reproducible del build Linux (candidato a moverse a `docs/deploy-cloudflare.md`).

## Self-Check: PASSED

- [x] Worker desplegado y accesible (HTTP 200) en *.workers.dev
- [x] 3 secrets seteados; MONEY_PUBLIC_ENABLED ausente
- [x] noindex,nofollow presente en la respuesta
- [x] Cableado a la nube poblada (sirve data real)
