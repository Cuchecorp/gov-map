---
phase: 11
plan: 03
subsystem: ui-ficha-parlamentario-lobby
tags: [nextjs, server-component, rtl, anti-insinuation, lobby, provenance, identity-guard, content-gate]
requires:
  - "supabase/migrations/0021_lobby.sql (RPC lobby_de_parlamentario + lobby_ingesta_estado)"
  - "app/components/votos-por-parlamentario.tsx (patrón Section+View espejado)"
  - "app/components/provenance-badge.tsx (reuse verbatim)"
  - "app/components/identity-marker.tsx (reuse verbatim)"
  - "app/app/parlamentario/[id]/page.tsx (shell apilable de Phase 10)"
provides:
  - "LobbyView (componente puro, RTL-testeable) — carril propio, contraparte cruda, 3 estados honestos"
  - "LobbySection (Server Component) — lee lobby_de_parlamentario + lobby_ingesta_estado"
  - "LobbyAudienciaRow/LobbyContraparteRow/LobbyAudienciaRpcRow (tipos del payload público, UI-SPEC §10)"
  - "agruparAudiencias (left-join RPC → audiencia con N contrapartes)"
  - "<section id=\"lobby\"> apilada en /parlamentario/[id]"
affects:
  - "Phases 12/14-16 — fija el patrón anti-insinuación de carril propio para toda sección multi-dataset"
tech-stack:
  added: []
  patterns:
    - "Section (Server Component, RPC) + View (puro, RTL) espejado de votos-por-parlamentario"
    - "noIngestado REAL desde la ausencia de fila en lobby_ingesta_estado (resuelve el hardcode de VotosView.noIngestado)"
    - "contraparte cruda + IdentityMarker SIEMPRE (P11 nunca confirma — RPC no emite contraparte_id) — nunca enlace muerto"
    - "alias contraparte_rol (RPC) → contraparte_tipo (UI) en el Server Component"
    - "carril aislado mt-12 como frontera estructural anti-insinuación"
key-files:
  created:
    - "app/components/lobby-de-parlamentario.tsx"
    - "app/components/lobby-de-parlamentario.test.tsx"
  modified:
    - "app/lib/types.ts"
    - "app/app/parlamentario/[id]/page.tsx"
decisions:
  - "El RPC lobby_de_parlamentario NO emite contraparte_id ni estado_vinculo (deny-by-default) → en P11 la contraparte NUNCA se enlaza; siempre texto crudo + IdentityMarker (no enlace muerto a sub-maestra inexistente)"
  - "contraparte_rol del RPC se expone como contraparte_tipo en la UI (alias UI-SPEC §10)"
  - "noIngestado = ausencia de fila en lobby_ingesta_estado AND 0 audiencias — distingue estado (a) de (b)"
  - "-t lobby (lowercase) debe ser verde: describes renombrados a 'LobbyView (sección lobby) — …' para que el verify documentado del plan corra verbatim"
metrics:
  duration: 10min
  tasks: 2
  files: 4
  completed: 2026-06-19
---

# Phase 11 Plan 03: Sección de lobby en /parlamentario/[id] Summary

Apila una `<section id="lobby">` en el shell de `/parlamentario/[id]` (Phase 10), en su propio carril a `mt-12` tras `#votos`, que renderiza las reuniones de lobby confirmadas vía el RPC `lobby_de_parlamentario` (Plan 01): contraparte como TEXTO CRUDO + `ProvenanceBadge` por fila, tres estados honestos distintos, y cero composición cruzada con votos / cero lenguaje causal-afinidad-score. Es la PRIMERA sección multi-dataset → fija el patrón anti-insinuación de carril propio para Phases 12/14–16. Server Component end-to-end; 11/11 tests verdes (incluido el content-gate §9.1, release gate de la fase); build verde.

## What Was Built

- **`LobbyView` (puro, RTL-testeable)** — línea de intro honesta (Ley 20.730) bajo el `<h2>`, los tres estados honestos, y la lista `<ul>/<li>` de audiencias en orden `fecha DESC`. Cada fila: fecha (`font-mono`, `DD MMM YYYY`, con fallback a `fecha_raw` / "Fecha no publicada"), contraparte(s) como TEXTO CRUDO (`contraparte_nombre` verbatim + `contraparte_tipo` + `representado` como metadata sin editorializar) **siempre acompañada de `IdentityMarker` y NUNCA enlazada**, asunto opcional verbatim, y `ProvenanceBadge` `ml-auto` obligatorio. Conteo neutro de reuniones (único agregado permitido §3.4). Paginación server-driven `?lobbyPage=N` (page size 20, anchor `#lobby`).
- **`LobbySection` (Server Component)** — `createServerSupabase()` → `sb.rpc("lobby_de_parlamentario", { p_id: id })`; distingue error real de DB/red (throw → UI de error honesta) de "0 filas" (estado honesto). Consulta `lobby_ingesta_estado` (`.maybeSingle()`) para computar `noIngestado` REAL (ausencia de fila AND 0 audiencias). Agrupa las filas del left-join del RPC por `identificador` (`agruparAudiencias`) → una audiencia con sus N contrapartes; aplica el alias `contraparte_rol → contraparte_tipo`.
- **Gate de contenido (§9.1)** documentado en el encabezado del archivo: lista dura de términos prohibidos (causalidad / afinidad / score-ranking-flag / juicio), regla de carril aislado, privacidad absoluta del tercero (sin RUT, RPC no emite `contraparte_id`).
- **Tipos (`app/lib/types.ts`)** — `LobbyAudienciaRpcRow` (forma cruda del RPC), `LobbyContraparteRow`, `LobbyAudienciaRow` (audiencia agrupada). `sourceLabel` extendido: origen con "lobby" → "Ley del Lobby".
- **`app/app/parlamentario/[id]/page.tsx`** — `<section id="lobby" className="mt-12">` como SIBLING tras `#votos` (nunca anidada), con su `<h2>` + `Suspense` + `LobbySkeleton` (shape-matched: intro + 3 filas, `aria-hidden`). Cabecera y `#votos` intactos.
- **`lobby-de-parlamentario.test.tsx`** — 11 tests RTL: carril aislado (sin enlace a `/proyecto/`, `/parlamentario/`, sin texto de voto), contraparte cruda + IdentityMarker sin enlace sin RUT, audiencia sin contraparte que no inventa ninguna, tres estados honestos textualmente distintos, ProvenanceBadge por fila, y el **content-gate anti-insinuación** (assertion negativa sobre `textContent` con regex de términos prohibidos §9.1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import inexistente `sourceName` de `@/lib/format`**
- **Found during:** Task 1 (GREEN). Al escribir el componente se introdujo por error un `import { sourceName } from "@/lib/format"` (el símbolo no existe en `format.ts`).
- **Fix:** Eliminado el import; la etiqueta de fuente se obtiene de `sourceLabel(origen)` de `@/lib/types`, ya importado.
- **Files modified:** `app/components/lobby-de-parlamentario.tsx`
- **Commit:** 934eb03 (corregido antes del commit GREEN).

**2. [Rule 3 - Blocking] `-t lobby` (lowercase) del verify no matcheaba los describes**
- **Found during:** Task 1 (GREEN). El comando de verificación del plan es `pnpm --filter app test -t lobby` (minúscula); `-t` de vitest es case-sensitive y los describes decían "LobbyView" → 11 tests quedaban skipped (0 corridos).
- **Fix:** Renombrados los cinco describes a "LobbyView (sección lobby) — …" para incluir el token "lobby" en minúscula; el verify documentado corre verbatim (11 passed).
- **Files modified:** `app/components/lobby-de-parlamentario.test.tsx`
- **Commit:** 934eb03.

## Verification

- `pnpm --filter app test -t lobby` → **11/11 PASS** (incluido el content-gate anti-insinuación §9.1).
- `npx next build` → **verde** (compila + paso TypeScript del build OK; `/parlamentario/[id]` se renderiza server-on-demand).
- `npx tsc --noEmit` → **mi código typechequea limpio**; el único error es el pre-existente y diferido `app/lib/buscar.test.ts(156)` (documentado en `.planning/phases/10-.../deferred-items.md`, ajeno a esta tarea).
- Estructura de página verificada por el snippet `node -e …`: `id="lobby"` + `LobbySection` + `LobbySkeleton` + `mt-12` presentes; `#lobby` es sibling DESPUÉS de `#votos` (no anidado).

## Anti-Insinuation Gate (§9.1) — Compliance

- **Carril aislado:** `<section id="lobby">` es sibling de `#votos` a `mt-12`; ninguna unidad de UI (li/article/Card) compone una reunión con un voto. Test negativo verde (sin enlaces a `/proyecto/`, `/parlamentario/`, sin texto de voto).
- **Cero causalidad / afinidad / score / ranking / flag / juicio:** content-gate test sobre `textContent` verde.
- **Contraparte = texto crudo, NUNCA enlazada en P11:** el RPC no emite `contraparte_id` → `IdentityMarker` siempre; cero RUT de tercero (test negativo verde).
- **Tres estados honestos distintos:** un vacío nunca se lee como "no se reúne con nadie" ni virtud.

## TDD Gate Compliance

- RED: `test(11-03): add failing RTL + content-gate tests for lobby section` — d95eff4 (tests fallaban por módulo inexistente).
- GREEN: `feat(11-03): LobbySection + pure LobbyView for /parlamentario/[id]` — 934eb03.
- REFACTOR: no fue necesario (la vista quedó limpia tras GREEN).
- Task 2 (auto, no-TDD): `feat(11-03): stack lobby section …` — dc3bca1.

## Known Stubs

Ninguno funcional. La contraparte es texto crudo por diseño (el RPC no emite `contraparte_id` en P11 y la sub-maestra de contrapartes aún no tiene página): no es un stub, es la regla anti-insinuación (nunca un enlace muerto). Cuando exista la página de sub-maestra (fase futura) y el RPC emita un `contraparte_id` confirmado, la contraparte podrá enlazarse — la `LobbyContraparteRow` está lista para extenderse sin re-arquitectura.

## Self-Check: PASSED

- FOUND: app/components/lobby-de-parlamentario.tsx
- FOUND: app/components/lobby-de-parlamentario.test.tsx
- FOUND: app/lib/types.ts (LobbyAudienciaRow añadido)
- FOUND: app/app/parlamentario/[id]/page.tsx (section id="lobby")
- FOUND commit d95eff4 (RED)
- FOUND commit 934eb03 (GREEN Task 1)
- FOUND commit dc3bca1 (Task 2)
