---
phase: 92-personas-p2c-lobby-legible-audiencia-pl-fail-closed
plan: 03
subsystem: ficha proyecto / sección menciones de lobby + linter anti-insinuación
tags: [LOB-02, LOB-03, degrade-honesto, PGRST202, navegacion-bidireccional, NEGACIONES_LOCKED, mutation-self-check]
requires:
  - supabase/migrations/0062_lobby_menciones_de_boletin.sql (RPC lobby_menciones_de_boletin — Plan 92-01, NO aplicada a PROD aún)
  - app/components/lobby-en-tramitacion.tsx (espejo de layout/degrade honesto 3 caminos — 0048)
  - app/lib/format.ts (formatNombre, fechaCorta)
  - app/lib/utils.ts (safeExternalHref)
  - app/lib/anti-insinuacion-guard.test.ts (linter extensible por NEGACIONES_LOCKED + SUPERFICIES_*)
provides:
  - LobbyMencionesView (pura) + LobbyMencionesSection (server) — sección menciones explícitas en ficha proyecto
  - LEYENDA_MENCIONES_LOBBY + EMPTY_MENCIONES_LOBBY — copy LOCKED single-source (importado por el linter)
  - <section id="lobby-menciones"> montada + rail entry "Menciones en lobby"
  - SUPERFICIES_LOBBY en el linter (3 superficies nuevas escaneadas) + mutation self-check LOBBY
affects:
  - Plan 04 (apply 0062 a PROD → la sección deja de degradar a null y renderiza filas reales)
tech-stack:
  added: []
  patterns:
    - "degrade honesto 3 caminos (PGRST202→null / otro error→throw / data→View) espejo 0048"
    - "carril hermano SEPARADO: <section> propia + mt-12 + heading/leyenda distintos, NUNCA fusión con 0048"
    - "parlamentario ENLAZADO (LOB-03, departure vs 0048) + contraparte texto plano sin RUT"
    - "leyenda LOCKED en UN string literal (concat + entre líneas rompería la resta split/join del linter → falso-positivo, lección 91)"
    - "NEGACIONES_LOCKED registradas ANTES de añadir SUPERFICIES_LOBBY al scan (ORDEN LOCKED lección BLOCKER 91)"
key-files:
  created:
    - app/components/lobby-menciones-de-boletin.tsx
    - app/components/lobby-menciones-de-boletin.test.tsx
  modified:
    - app/app/proyecto/[boletin]/page.tsx
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "leyenda/empty como UN string literal en una línea (no concat multi-línea): el linter resta la negación VERBATIM del source con split/join; un `+` entre líneas rompería la sustracción y 'influencia' quedaría → falso-positivo BLOCKER (lección 91)"
  - "RailSkeleton 8/9 → 9/10 (+1 en toda config): la entrada 'lobby-menciones' es SIEMPRE presente (no gated) — la <section> se monta siempre aunque su contenido degrade a null pre-apply de 0062"
  - "ORDEN LOCKED del linter: PRIMERO NEGACIONES_LOCKED (import + resta), LUEGO SUPERFICIES_LOBBY al scan — invertirlo auto-cazaría 'influencia' sobre la propia superficie que renderiza la leyenda"
  - "0062 NO aplicada a PROD → la sección degrada honesto a null (PGRST202) hasta el Plan 04; el mt-12 del wrapper preserva la frontera sin heading huérfano"
metrics:
  duration: ~12min
  completed: 2026-07-22
---

# Phase 92 Plan 03: Sección menciones de lobby en ficha proyecto + linter extendido Summary

**One-liner:** La ficha del proyecto gana un carril HERMANO SEPARADO de la sección
temporal 0048 — "Audiencias de lobby que mencionan este boletín" — que consume la RPC
`lobby_menciones_de_boletin` (0062) con degrade honesto de 3 caminos, leyenda anti-causal
LOCKED, parlamentario ENLAZADO a `/parlamentario/{id}` (navegación bidireccional
PL→audiencia→parlamentario, LOB-03), conteo honesto `total_n` y empty honesto verbatim;
y el linter anti-insinuación se EXTIENDE a las 3 superficies nuevas de la fase con las
leyendas que NIEGAN términos prohibidos registradas ANTES en `NEGACIONES_LOCKED` (lección
BLOCKER 91) + mutation self-check que muerde sobre el carril LOBBY.

## What Was Built

### Task 1 — `LobbyMencionesView` / `LobbyMencionesSection` (+ tests RTL)
- **Espejo estructural de `lobby-en-tramitacion.tsx` (0048)** con las diferencias LOCKED
  del UI-SPEC:
  - **Degrade honesto 3 caminos** (verbatim 0048): `error.code === "PGRST202"` → return
    null (RPC 0062 ausente pre-apply — Plan 04 — sin heading huérfano; el mt-12 del
    wrapper preserva la frontera); otro error → throw (#34); data (incl. 0 filas) → View.
  - **Heading LOCKED verbatim** (h2, text-xl font-semibold): "Audiencias de lobby que
    mencionan este boletín" — DISTINTO de 0048 ("Reuniones de lobby registradas en el
    mismo período").
  - **Leyenda anti-causal LOCKED verbatim** (1×, banda `bg-muted`): `LEYENDA_MENCIONES_LOBBY`
    exportada single-source ("…no implica influencia en la tramitación ni relación causal
    con el proyecto.").
  - **Parlamentario ENLAZADO** a `/parlamentario/{parlamentario_id}` (DEPARTURE vs 0048 que
    es texto plano; LOB-03: hay evidencia dura de mención → navegación justificada), acento
    petróleo (`text-accent-product`, color de enlace, jamás señal de alerta), focus-visible.
  - **Contraparte cruda** (nombre · rol · representado) verbatim, NUNCA enlazada, sin RUT;
    línea compuesta sólo con los fragmentos presentes (honest-state).
  - **Materia legible** en bloque `whitespace-pre-line leading-relaxed` (sin clamp/truncate/max-h).
  - **Conteo honesto** singular/plural + variante truncada `total_n` (0062 emite
    `count(*) over ()`; filas < total_n → LIMIT 50 alcanzado → "Se muestran las N más
    recientes de M…").
  - **Empty state LOCKED verbatim** (`EMPTY_MENCIONES_LOBBY`, NUNCA "sin lobby"/"limpio";
    declara que sólo cuenta menciones explícitas del número).
  - **Provenance** "Ver fuente oficial ↗" vía `safeExternalHref(enlace_detalle)`, ml-auto,
    min-h-11 — omitido si no hay enlace (nunca fabricado). Orden fecha DESC (de la RPC).
- **11 tests RTL** (View pura, fixtures): heading + leyenda; parlamentario enlazado a
  `/parlamentario/id`; materia whitespace-pre-line sin clamp; contraparte texto plano sin
  enlace; conteo singular/plural/truncado; empty verbatim; provenance presente/omitido;
  guard de single-source (la leyenda niega "influencia"/"relación causal").

### Task 2 — Montaje en page.tsx + rail entry + linter extendido
- **Montaje:** `<section id="lobby-menciones" className="mt-12">` con `<Suspense>` +
  `<LobbyMencionesSection boletin={boletin} />`, DESPUÉS de `#lobby-tramitacion` (0048, NO
  tocado) y ANTES de `#cruces`. Carril hermano contiguo pero JAMÁS fusionado.
- **Rail:** entrada `{ id: "lobby-menciones", label: "Menciones en lobby" }` tras "Lobby
  del período". `RailSkeleton` 8/9 → 9/10 (iguala navEntries en toda config — sin CLS; la
  entrada es siempre presente, no gated).
- **Linter (ORDEN LOCKED, lección BLOCKER 91):** PRIMERO importar `LEYENDA_MENCIONES_LOBBY`
  + `EMPTY_MENCIONES_LOBBY` (single-source del Task 1) y añadirlas a `NEGACIONES_LOCKED`
  (contienen "influencia"/"relación causal"/"actividad de lobby" en contexto que los NIEGA
  → sin restarlas el scan se auto-cazaría). LUEGO añadir `SUPERFICIES_LOBBY`
  (`lobby-menciones-de-boletin.tsx`, `mencion-boletin-chip.tsx`,
  `lobby-de-parlamentario.tsx`) al bucle `[...VOTO, ...MONEY, ...HOME, ...BUSQUEDA,
  ...PERSONAS, ...LOBBY]`.
- **Mutation self-check LOBBY:** término causal FRESCO ("influencia" + "a cambio de")
  inyectado en fixture EN MEMORIA → cazado (el guard muerde sobre lo nuevo aunque la
  leyenda LOCKED esté restada). + 2 pruebas no-falso-positivo (leyenda y empty verbatim → []).

## Verification

- **Suite app:** 90 archivos / **1155 tests VERDE**. `anti-insinuacion-guard.test.ts` corre
  **25 tests** (4 nuevos: mutation LOBBY + 2 no-falso-positivo + guard single-source en el
  componente); `lobby-menciones-de-boletin.test.tsx` corre **11 tests**.
- **`tsc --noEmit`:** exit 0 (tras Task 1 y tras Task 2).
- **Carril hermano verificado:** `#lobby-menciones` es su propia `<section mt-12>` con
  heading/leyenda distintos; `page-cruces.test.ts` sigue verde (#cruces entre
  #lobby-tramitacion y #idea-matriz — mi sección va entre lobby-tramitacion y cruces, no
  altera esa relación).
- **Degrade honesto confirmado por el build/test:** con la RPC 0062 ausente (no aplicada a
  PROD), `LobbyMencionesSection` retorna null (PGRST202) sin 500 y sin heading huérfano —
  el sitio degrada honesto hasta el Plan 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Leyenda/empty como concat multi-línea rompía la resta del linter**
- **Found during:** Task 2 (razonamiento sobre el mecanismo split/join del linter, antes de correr).
- **Issue:** definir `LEYENDA_MENCIONES_LOBBY` / `EMPTY_MENCIONES_LOBBY` con `"…" + "…"`
  en varias líneas produce un source donde la palabra prohibida ("influencia") queda a un
  lado de un `" + "`. El linter resta la negación LOCKED VERBATIM del source con
  `texto.split(negNorm).join(" ")`; con el `+` intercalado la negación assembled NO matchea
  el source → la sustracción falla → "influencia" queda → falso-positivo BLOCKER (exactamente
  la clase de fallo que la lección 91 advierte, por vía de concat en lugar de JSX wrap).
- **Fix:** ambas constantes se definen como UN string literal en una sola línea (con
  `// eslint-disable-next-line` / `// prettier-ignore`), de modo que el source contiene la
  negación intacta y el `split/join` la resta limpiamente.
- **Files modified:** app/components/lobby-menciones-de-boletin.tsx
- **Commit:** 6462fea

**2. [Rule 2 - Missing critical] test RTL con cleanup()+rerender rompía en unmounted root**
- **Found during:** Task 1 (primera corrida de tests).
- **Issue:** un test de provenance usaba `cleanup()` seguido de `rerender()` (root ya
  desmontado → "Cannot update an unmounted root" en React 19).
- **Fix:** partido en dos tests independientes con `render()` cada uno (presencia / omisión
  del link de fuente). Cobertura idéntica, sin el patrón roto.
- **Files modified:** app/components/lobby-menciones-de-boletin.test.tsx
- **Commit:** 56256be

## Known Stubs

Ninguno. La sección es sustantiva: consume la RPC real 0062 y renderiza filas reales una vez
aplicada (Plan 04). El degrade a null pre-apply NO es un stub — es el contrato de degrade
honesto declarado (idéntico a 0048/cruces): la sección se monta siempre; su contenido
aparece cuando la RPC existe en PROD. La entrada del rail y el ancla del scrollspy existen
en el DOM desde ya.

## Threat Flags

Ninguno nuevo. La única lectura server-side añadida es `sb.rpc("lobby_menciones_de_boletin")`
— una RPC PII-safe security-definer (0062: nombre público del parlamentario + contraparte
cruda sin RUT/contraparte_id, doble-revoke Camino A) ya declarada y probada por pgTAP en
el Plan 01. No introduce endpoint, auth path ni schema en frontera de confianza fuera del
threat model de la fase.

## Deferred (por diseño de la fase)

- **Apply 0062 a PROD:** Plan 04 (por el agente vía `psql --single-transaction`, precedente
  0059-0061). Hasta entonces la sección degrada honesto a null (PGRST202) — comportamiento
  correcto y probado.
- **Verificación visual BrowserOS/iframe (materia completa, chips, sección con leyenda a
  390px):** gate posterior de la fase, tras el apply.

## Self-Check: PASSED

- FOUND: app/components/lobby-menciones-de-boletin.tsx
- FOUND: app/components/lobby-menciones-de-boletin.test.tsx
- FOUND: app/app/proyecto/[boletin]/page.tsx (modificado — sección + rail entry)
- FOUND: app/lib/anti-insinuacion-guard.test.ts (modificado — SUPERFICIES_LOBBY + NEGACIONES_LOCKED)
- FOUND commit: 56256be (Task 1 — sección + tests RTL)
- FOUND commit: 6462fea (Task 2 — montaje + rail + linter extendido)
