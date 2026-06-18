---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
plan: 04
subsystem: frontend-ficha
tags: [frontend, nextjs-16, server-components, shadcn, tailwind-v4, ficha, timeline, votaciones, provenance, guarda-identidad, rls-anon, tdd-render-tests]

# Dependency graph
requires:
  - "05-01: tablas públicas proyecto/votacion/voto/tramitacion_evento + RLS public-read explícito para anon (migración 0008)"
  - "05-03: voto con parlamentario_id (solo confirmado) + estado_vinculo (confirmado/probable/no_confirmado) — la guarda LOCKED observable en la capa pública"
  - "Scaffold Next.js 16 en /app (Fase 1) con next/font Geist"
provides:
  - "Ficha /proyecto/[boletin]: Server Component que lee Supabase (anon) y renderiza header + timeline fusionado + votaciones"
  - "Design system cívico: shadcn (Default/Slate) + tokens --camara/--senado/--provenance/--identity-warn"
  - "ProvenanceBadge (TRAM-09): frescura + fuente, amber >48h, nunca oculto"
  - "IdentityMarker + VotoRow: guarda de identidad en UI (link SOLO si confirmado)"
  - "Helpers lib/format (relativeTimeEs/fechaCorta/esStale) + cliente supabase server-only"
affects: [frontend, ficha-parlamentario-futura, busqueda-semantica-fase7]

# Tech tracking
tech-stack:
  added:
    - "tailwindcss@4 + @tailwindcss/postcss + @tailwindcss/typography (LOCKED stack, Tailwind Labs oficial)"
    - "shadcn/ui primitives (Badge/Card/Separator/Skeleton/Tooltip) — registro oficial, copiados al repo"
    - "@radix-ui/react-tooltip|separator|slot, class-variance-authority, clsx, tailwind-merge, lucide-react"
    - "@supabase/supabase-js + server-only"
    - "vitest + @testing-library/react + jsdom (render tests)"
  patterns: [server-components-leen-supabase, anon-key-no-NEXT_PUBLIC, suspense-skeletons-por-seccion, css-puro-barra-timeline-sin-recharts-visx, guarda-identidad-en-render, provenance-por-dato, regex-guard-path-injection, tailwind-v4-config-via-@config]

key-files:
  created:
    - app/components.json
    - app/tailwind.config.ts
    - app/postcss.config.mjs
    - app/lib/utils.ts
    - app/components/ui/badge.tsx
    - app/components/ui/card.tsx
    - app/components/ui/separator.tsx
    - app/components/ui/skeleton.tsx
    - app/components/ui/tooltip.tsx
    - app/app/styles/civic-tokens.css
    - app/lib/supabase.ts
    - app/lib/format.ts
    - app/lib/format.test.ts
    - app/lib/types.ts
    - app/vitest.config.ts
    - app/vitest.setup.ts
    - app/components/provenance-badge.tsx
    - app/components/identity-marker.tsx
    - app/components/etapa-badge.tsx
    - app/components/camara-chip.tsx
    - app/components/ficha-header.tsx
    - app/components/autores-list.tsx
    - app/components/timeline-event.tsx
    - app/components/timeline-view.tsx
    - app/components/votacion-card.tsx
    - app/components/votacion-bar.tsx
    - app/components/voto-detalle.tsx
    - app/components/voto-row.tsx
    - app/components/voto-row.test.tsx
    - app/components/provenance-badge.test.tsx
    - app/components/votacion-bar.test.tsx
    - app/app/proyecto/[boletin]/page.tsx
    - app/app/proyecto/[boletin]/not-found.tsx
  modified:
    - app/app/globals.css
    - app/app/layout.tsx
    - app/package.json

key-decisions:
  - "Tailwind v4 (CSS-first) en vez de v3: el scaffold trae Next 16; se honra el contrato del UI-SPEC (tailwind.config.ts con fontFamily Geist) referenciándolo vía @config en globals.css"
  - "shadcn instalado manualmente (no `init` interactivo): mismos artefactos (components.json/lib/utils/primitives del registro oficial), pero reproducible y no interactivo en Windows"
  - "anon key SIN NEXT_PUBLIC_ + lib/supabase 'server-only': la key nunca llega al bundle del cliente (T-05-10); las lecturas viven en Server Components"
  - "App lee filas crudas de Supabase con tipos locales (lib/types.ts) en vez de depender de @obs/tramitacion: desacopla el frontend del paquete backend"
  - "Gate visual satisfecho programáticamente: pnpm build OK + 22 tests RTL + render real contra Supabase local (seed + fetch HTTP) — firma humana sigue recomendada"

requirements-completed: [TRAM-04, TRAM-05, TRAM-06, TRAM-09]

# Metrics
duration: 30min
completed: 2026-06-18
---

# Phase 5 Plan 04: Frontend Next.js de la ficha de proyecto Summary

**Construye el frontend Next.js 16 (App Router, Server Components) de la ficha `/proyecto/[boletin]`: inicializa el design system cívico (shadcn Default/Slate + tokens `--camara`/`--senado`/`--provenance`/`--identity-warn` del UI-SPEC), y los componentes que leen las tablas públicas de Supabase (anon, RLS public-read de 05-01) para renderizar header (estado/etapa, autores, boletín mono), timeline fusionado cross-cámara (CSS puro, sin SVG), votaciones (barra CSS de 4 segmentos accesible + totales + voto-a-voto del Senado), el `ProvenanceBadge` (frescura + fuente, amber >48h, nunca oculto — TRAM-09) y la guarda de identidad en la UI (`IdentityMarker` + `VotoRow`: enlace SOLO si `estado_vinculo='confirmado'` — TRAM-06). Tono sobrio en español, sin causalidad. `pnpm build` verde, 22 tests (10 format + 12 render RTL), tsc exit 0; render verificado end-to-end contra Supabase local.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-18T16:43:00Z (continuación de 05-03)
- **Completed:** 2026-06-18T17:01:00Z
- **Tasks:** 4 (Task 1 + Task 4 son gates pre-autorizados por el orquestador en corrida autónoma)
- **Files:** 33 creados, 3 modificados

## Accomplishments

- **Task 1 (gate de paquetes):** instalados `tailwindcss@4` + `@tailwindcss/postcss` + `@tailwindcss/typography` (Tailwind Labs, stack LOCKED del UI-SPEC §0) y las primitivas shadcn del **registro oficial** (Badge/Card/Separator/Skeleton/Tooltip) + sus deps Radix/cva/clsx/tailwind-merge/lucide. `components.json` (Default/Slate, RSC) y `tailwind.config.ts` presentes. Sin registries de terceros; sin visx/recharts.
- **Task 2 (design system bootstrap):** `civic-tokens.css` (UI-SPEC §1.1, importado en `globals.css` tras los tokens shadcn), `layout.tsx` con `lang="es"` (a11y §8) + metadata cívica conservando las variables Geist, `lib/supabase.ts` (`createServerSupabase()` server-only, anon key sin `NEXT_PUBLIC_`), `lib/format.ts` (`relativeTimeEs`/`fechaCorta`/`esStale` es-CL, umbral 48h) con **10 tests verdes**, `vitest.config.ts` (jsdom + RTL).
- **Task 3 (componentes + página):** 12 componentes del UI-SPEC §2.2–§5 + la página Server Component. `page.tsx` valida `boletin` con regex `^\d{3,6}(-\d{1,2})?$` y `notFound()` (T-05-09), lee `proyecto` (`.single`), `tramitacion_evento` (`.order fecha ASC`) y `votacion` (`.select("*, voto(*)")`), cada sección en su `<Suspense>` con Skeleton. `not-found.tsx` con copy español + enlaces Senado/Cámara. Barra y timeline en **CSS puro**.
- **Task 4 (gate visual, satisfecho programáticamente):** `pnpm build` compila sin errores (ruta `/proyecto/[boletin]` dinámica server-rendered); 12 tests de render RTL (VotoRow guarda, ProvenanceBadge stale, VotacionBar accesible); y verificación end-to-end real: seed de un proyecto + evento + votación + 2 votos Senado no-confirmados vía service role, fetch HTTP de la página servida (200) → render del header/timeline/votaciones/provenance confirmado, `Ver votos individuales (2)` presente, **0 enlaces `/parlamentario/`** (guarda intacta), `/proyecto/99999-99` → not-found español, `/proyecto/abc-injection` → 404. Guarda `parlamentario.rut` vacía para anon confirmada.

## Task Commits

1. **Task 1: init Tailwind + shadcn UI primitives (package gate)** — `a2d14a5` (chore)
2. **Task 2: design system bootstrap (civic tokens, lang=es, supabase client, format helpers)** — `c6f9a41` (feat)
3. **Task 3 + Task 4: ficha /proyecto/[boletin] + render tests (gate visual programático)** — `2c41354` (feat)

## Files Created/Modified

Ver `key-files` en frontmatter. Destacados:
- `app/app/proyecto/[boletin]/page.tsx` — Server Component de la ficha (regex guard + 3 lecturas Supabase + Suspense).
- `app/components/voto-row.tsx` — guarda de identidad LOCKED en render (link solo si confirmado).
- `app/components/provenance-badge.tsx` — frescura + fuente (amber >48h, nunca oculto).
- `app/app/styles/civic-tokens.css` — tokens cívicos del UI-SPEC §1.1.
- `app/lib/format.ts` (+ test) — tiempo relativo es-CL + umbral stale.

## Decisions Made

- **Tailwind v4 (CSS-first) honrando el contrato del UI-SPEC:** el scaffold de Fase 1 es Next 16, cuyo toolchain por defecto es Tailwind v4 (config en CSS vía `@import "tailwindcss"`). El UI-SPEC §0/§12.7 asume `tailwind.config.ts` (estilo v3) con `fontFamily` Geist. Se mantiene AMBOS: existe `tailwind.config.ts` con la extensión `fontFamily`/`colors`/`borderRadius`, referenciado desde `globals.css` con `@config "../tailwind.config.ts"`. Artefacto del plan presente, build v4 funcional.
- **shadcn instalado manualmente, no por `init` interactivo:** `shadcn@latest init` es un prompt interactivo (Style/BaseColor/aliases) que no corre determinísticamente en una sesión no interactiva en Windows. Se materializaron los MISMOS artefactos que produce (`components.json` con Default/Slate/RSC, `lib/utils.ts` con `cn()`, y los 5 primitivos copiados del **código del registro oficial** de shadcn). Cero registries de terceros (UI-SPEC §11).
- **Frontend desacoplado de @obs/tramitacion:** la app lee filas crudas snake_case de Supabase con tipos locales en `lib/types.ts` (espejo del modelo común). El paquete `@obs/tramitacion` (con sus deps Node de ingesta) NO entra al bundle del frontend.
- **anon key server-only sin `NEXT_PUBLIC_`:** `lib/supabase.ts` marca `import "server-only"` y lee `SUPABASE_URL`/`SUPABASE_ANON_KEY` sin prefijo público → la key jamás llega al navegador (T-05-10). Las lecturas viven en Server Components.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Toolchain de test: `@vitejs/plugin-react@6` incompatible con la vite embebida de vitest 3.2**
- **Found during:** Task 2 (primer `pnpm vitest run`)
- **Issue:** `@vitejs/plugin-react@6` importa `vite/internal` y al resolverse contra la vite que arrastra vitest 3.2 lanza `ERR_PACKAGE_PATH_NOT_EXPORTED`, abortando la carga de `vitest.config.ts`.
- **Fix:** se removió `@vitejs/plugin-react` y se usa el transform JSX nativo de esbuild de vitest (`esbuild: { jsx: "automatic" }`). React 19 + jsdom + RTL renderizan sin el plugin.
- **Files modified:** app/vitest.config.ts, app/package.json
- **Verification:** 22 tests verdes (10 format + 12 render).
- **Committed in:** `c6f9a41` (Task 2) / `2c41354` (Task 3, tests de render)

**2. [Rule 1 - Bug] Tipo `darkMode` de Tailwind v4 (`["class"]` → `"class"`)**
- **Found during:** Task 2 (`tsc --noEmit`)
- **Issue:** el `Config` de Tailwind v4 tipa `darkMode` como `"class" | ["class", string]`; el `["class"]` heredado del patrón v3 falla el typecheck (TS2322).
- **Fix:** `darkMode: "class"`.
- **Files modified:** app/tailwind.config.ts
- **Verification:** `tsc --noEmit` exit 0.
- **Committed in:** `c6f9a41` (Task 2)

**3. [Rule 2 - Critical] `@config` + civic-tokens import wiring para que Tailwind v4 resuelva el config v3 y los tokens**
- **Found during:** Task 2 (build)
- **Issue:** Tailwind v4 no lee `tailwind.config.ts` automáticamente como v3; sin enlace explícito, la extensión `fontFamily` Geist y los colores HSL del config quedarían inertes.
- **Fix:** `@config "../tailwind.config.ts"` + `@import "./styles/civic-tokens.css"` en `globals.css`, con los tokens base shadcn en formato HSL-triplet consumidos por `hsl(var(--token))`.
- **Files modified:** app/app/globals.css
- **Verification:** `pnpm build` compila; clases `font-mono`/`bg-secondary`/tokens cívicos presentes en el HTML servido.
- **Committed in:** `c6f9a41` (Task 2)

**Total deviations:** 3 auto-fixed (1 blocking de toolchain, 1 bug de tipo, 1 critical de wiring). Sin scope creep; sin cambio del contrato del UI-SPEC.

## Checkpoint Handling (autónomo)

- **Task 1 (gate de paquetes, BLOQUEANTE):** pre-autorizado por el orquestador — `tailwindcss`/`@tailwindcss/typography` son el stack LOCKED del UI-SPEC §0 (Tailwind Labs oficial); shadcn copia del registro oficial. Instalado y verificado (`components.json` + `tailwind.config.ts` presentes). Sin paquetes de terceros, sin visx/recharts.
- **Task 4 (gate visual, BLOQUEANTE):** el ejecutor no puede abrir un navegador. Satisfecho programáticamente per la directiva del orquestador: (a) `pnpm build` verde, (b) 12 tests de render RTL de los comportamientos clave, (c) render real end-to-end contra Supabase local (seed vía service role + fetch HTTP de la página → 200, contenido del ficha confirmado, guarda de identidad sin fugas, not-found y guard de injection verificados). **La firma visual de un operador humano sigue recomendada** antes del cierre formal de la fase, pero el render está probado por build + tests + fetch real.

## Threat Model Coverage

- **T-05-09 (Tampering / path injection en `/proyecto/[boletin]`):** mitigado — regex `^\d{3,6}(-\d{1,2})?$` + `notFound()` antes de tocar la DB; `.eq()` de supabase-js parametriza. Verificado: `/proyecto/abc-injection` → 404.
- **T-05-06 (Tampering / falsa identidad en VotoRow):** mitigado — `VotoRow` enlaza a `/parlamentario/[id]` SOLO si `estado_vinculo === 'confirmado'` Y `parlamentario_id != null`; si no, nombre crudo + `IdentityMarker` "identidad no verificada", NUNCA link. 6 tests de render lo prueban (incluye el caso `probable` con id presente → NO link). Verificado en vivo: 0 enlaces `/parlamentario/` con 2 votos no-confirmados/probable seedeados.
- **T-05-10 (Information Disclosure / supabase key en el cliente):** mitigado — `SUPABASE_ANON_KEY` (no service) sin `NEXT_PUBLIC_`; `lib/supabase.ts` con `import "server-only"`; lecturas en Server Components; anon limitado por RLS. Verificado: `parlamentario.rut` vacío para anon.
- **T-05-SC (npm installs Tailwind/shadcn):** gate BLOQUEANTE pre-autorizado (stack LOCKED Tailwind Labs + registro oficial shadcn); sin registries de terceros.

## Known Stubs

- Ninguno que engañe a la UI. El enlace `/parlamentario/[id]` que `VotoRow` genera para votos confirmados apunta a una ruta de un milestone posterior (ficha de parlamentario, fuera de Fase 5) — es un enlace de futuro declarado en el UI-SPEC §3.3, no un stub de datos. En Fase 5 los votos confirmados provienen del cruce determinista de Cámara (05-03); el Senado seedeado para el gate es no-confirmado a propósito (muestra la guarda). La población real de las tablas la hace la ola 4 (ingesta LIVE); la ficha lee lo que haya con RLS public-read.

## Verification

- `cd app && pnpm vitest run`: **22/22 verdes** (10 format + 6 VotoRow guarda + 3 ProvenanceBadge stale + 3 VotacionBar).
- `cd app && pnpm exec tsc --noEmit`: **exit 0**.
- `cd app && pnpm build`: **OK** — `/proyecto/[boletin]` dinámica (server-rendered on demand).
- Render end-to-end contra Supabase local (seed + `pnpm start` + curl): `/proyecto/14309-04` → 200 con header/timeline/votaciones/ProvenanceBadge; `Ver votos individuales (2)`; **0** enlaces `/parlamentario/`; `/proyecto/99999-99` → not-found español; `/proyecto/abc-injection` → 404; `parlamentario.rut` vacío para anon.

## Next Phase Readiness

- **Ola 4 (ingesta LIVE):** al poblar `proyecto`/`votacion`/`voto`/`tramitacion_evento` con datos reales (consumiendo `reconciliarVotosCamara`/`reconciliarVotosSenado` de 05-03), la ficha los renderiza sin cambios — solo necesita `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno.
- **Firma visual humana:** recomendada antes del cierre formal de la fase (operador abre `/proyecto/{boletin}` con datos reales de la ola 4 y confirma tono/estética). El render funcional ya está probado.
- **Ficha de parlamentario (milestone siguiente):** la ruta `/parlamentario/[id]` que `VotoRow` enlaza para votos confirmados queda lista para implementarse; reutilizará votaciones/proyectos.

## Self-Check: PASSED

Archivos declarados existen y los 3 commits de tarea están en el historial:
- Archivos: components.json, tailwind.config.ts, lib/{utils,supabase,format,types,format.test}, components/ui/{badge,card,separator,skeleton,tooltip}, components/{provenance-badge,identity-marker,etapa-badge,camara-chip,ficha-header,autores-list,timeline-event,timeline-view,votacion-card,votacion-bar,voto-detalle,voto-row}(+3 .test), app/proyecto/[boletin]/{page,not-found}, app/styles/civic-tokens.css, vitest.config — todos FOUND.
- Commits: a2d14a5 (T1), c6f9a41 (T2), 2c41354 (T3+T4) — verificados en git log.

---
*Phase: 05-tramitaci-n-core-ficha-timeline-votaciones*
*Completed: 2026-06-18*
