---
phase: 92-personas-p2c-lobby-legible-audiencia-pl-fail-closed
plan: 02
subsystem: lobby ficha parlamentario / materia legible + chips audiencia→PL
tags: [LOB-01, LOB-02, LOB-03, whitespace-pre-line, chip-link, fail-closed, Block-B, RTL]
requires:
  - app/lib/boletin-en-materia.ts (extraerBoletines — Plan 92-01)
  - app/components/lobby-de-parlamentario.tsx (LobbyView puro + LobbySection server)
  - app/components/ui/badge.tsx (Badge outline)
  - app/lib/types.ts (LobbyAudienciaRow)
provides:
  - MencionBoletinChip / MencionBoletinChips — chip-link "Menciona boletín N" reutilizable (petróleo, min-h-11, aria LOCKED)
  - LobbyAudienciaRow.boletines_mencionados — boletines VALIDADOS (patrón + existencia) por audiencia
  - GrupoContraparte.reuniones — lista explícita por reunión (fecha + materia + boletines)
  - resolverBoletinesMencionados — wire server-side fail-closed doble, bounded < 1000
affects:
  - Plan 03 (sección "Audiencias que mencionan este boletín" en ficha proyecto — reutiliza patrón/extractor)
tech-stack:
  added: []
  patterns:
    - "materia legible: bloque whitespace-pre-line leading-relaxed, PROHIBIDO line-clamp/truncate/max-h"
    - "chip como Link (navega) con Badge asChild-style dentro, sin TooltipTrigger anidado (WR-04)"
    - "fail-closed doble server-side (Block-B): patrón (extraerBoletines) + existencia (.in proyecto); inexistentes descartados"
    - "bound duro del .in() por request: dedupe candidatos + paginado IN_CHUNK=500 < cap PostgREST"
key-files:
  created:
    - app/components/mencion-boletin-chip.tsx
  modified:
    - app/components/lobby-de-parlamentario.tsx
    - app/components/lobby-de-parlamentario.test.tsx
    - app/lib/types.ts
decisions:
  - "boletines_mencionados vive en LobbyAudienciaRow (opcional) → fluye in-place al slice paginado (cronológica) y a los grupos (agrupada) desde el MISMO objeto `todas`"
  - "GrupoContraparte.reuniones paralelo a fechas (reuniones[i].fechaTexto === fechas[i]) — `fechas` conservado por retro-compat; semántica freq-DESC + dedupe-por-audiencia intacta (MAJOR-4)"
  - "bound del .in() paginado en IN_CHUNK=500 → bound por request SIEMPRE < 1000 sin importar el volumen del parlamentario (MAJOR-5)"
  - "chip surfaces NO se agregan al anti-insinuacion-guard: el copy 'Menciona boletín N' no contiene términos prohibidos (MINOR-9); la cobertura anti-insinuación de la sección la dan los tests RTL del componente"
metrics:
  duration: ~6min
  completed: 2026-07-22
---

# Phase 92 Plan 02: Lobby legible + chips audiencia→PL Summary

**One-liner:** La materia COMPLETA de cada audiencia de lobby ahora es legible en AMBAS
vistas de la ficha del parlamentario (bloque `whitespace-pre-line leading-relaxed`, sin
clamp) — incluida la vista agrupada, que antes NO la mostraba — y cada materia que
menciona un boletín VÁLIDO (patrón `extraerBoletines` + existencia en `proyecto`,
fail-closed doble server-side) monta un chip-link "Menciona boletín N" → `/proyecto/N`,
con `LobbyView` estrictamente puro (los chips llegan resueltos en los datos, Block-B).

## What Was Built

### Task 1 — `MencionBoletinChip` / `MencionBoletinChips` (chip-link reutilizable)
- `<Link href="/proyecto/{N}">` que envuelve `<Badge variant="outline">` con acento
  petróleo (`border-accent-product bg-accent-product-soft text-accent-product`), `min-h-11`
  táctil, `focus-visible:outline-2 outline-offset-2 outline-accent-product`.
- Contenido: `Menciona boletín ` (Sans) + `{N}` en `font-mono`. `aria-label` LOCKED
  verbatim del UI-SPEC: `Esta materia menciona el boletín {N}; abre el proyecto.`.
- SIN `TooltipTrigger` anidado dentro del Link (WR-04, HTML hostil). Color petróleo
  IDÉNTICO por boletín (codifica "enlace", jamás relevancia/riesgo).
- `MencionBoletinChips`: layout `flex flex-wrap gap-2 mt-1` sobre lista YA validada/
  ordenada/deduplicada; `[]` → no pinta nada (fail-closed: materia sin mención = sin chip).

### Task 2 — Materia legible ambas vistas + wire de chips server-side + tests
- **Materia legible (LOB-01):**
  - `VistaCronologica`: el `Asunto: {a.materia}` pasa de `<span>` inline a `<div>`
    `whitespace-pre-line leading-relaxed text-sm` → el texto multilínea se lee ENTERO.
    CERO `line-clamp/truncate/max-h`. `min-w-0` del contenedor padre permite el wrap.
  - `VistaAgrupada`: HOY solo mostraba contraparte + conteo + fechas. Ahora lista POR
    REUNIÓN dentro del grupo: `{fecha mono}` + `{materia completa}` (whitespace-pre-line)
    + sus chips, en la MISMA fila (carril LOCKED — la mención es metadata de ESA materia).
    El conteo neutro `{N} reuniones` se mantiene.
- **Reshape `GrupoContraparte` (MAJOR-4):** `reuniones: GrupoReunion[]` explícito
  (`{ fechaTexto, materia, boletines }`), paralelo a `fechas` (mismo índice = misma
  reunión). Semántica LOCKED preservada con tests de regresión: orden freq-DESC + dedupe
  por audiencia (una fila por contraparte×audiencia, nombres repetidos no inflan `n`).
- **Wire de chips server-side (LOB-02/LOB-03, Block-B, fail-closed doble):**
  `resolverBoletinesMencionados(sb, todas)` — (1) patrón: `extraerBoletines(a.materia)`
  por audiencia; (2) existencia: query batched `sb.from("proyecto").select("boletin")
  .in("boletin", chunk)`; construye `Set` de existentes; adjunta in-place a cada
  audiencia `boletines_mencionados = candidatos.filter(existe)`. Los que matchean el
  patrón pero NO existen se descartan (fail-closed #2 — jamás chip muerto). El error real
  de la query se PROPAGA → `LobbySection` lo LANZA (#34), nunca degrada a "sin chips".
- **Bound del `.in()` (MAJOR-5):** candidatos deduplicados (Set) y query PAGINADA en
  `IN_CHUNK = 500` (< cap PostgREST ~1000) → el bound por request es SIEMPRE `IN_CHUNK`
  < 1000, independiente del volumen de audiencias del parlamentario.
- **Tests RTL (+10, LobbyView puro):** materia multilínea completa visible en ambas vistas
  (assert `whitespace-pre-line` + `leading-relaxed`, sin `line-clamp|truncate|max-h`);
  materia seleccionable, sin "ver más"; chip presente cuando el boletín está validado →
  `/proyecto/N`; SIN chip cuando el patrón matchea pero no fue validado (fail-closed #2);
  SIN chip cuando no hay mención; múltiples chips deduplicados; chip también en agrupada.
  + regresión MAJOR-4 (`reuniones` paralelo a `fechas`, freq-DESC + dedupe).

## Verification

- **Suite app:** 89 archivos / **1140 tests VERDE** (incluye anti-insinuacion-guard y
  lockdown-guard). El archivo `lobby-de-parlamentario.test.tsx` corre **45 tests** (10
  nuevos), todos verdes en ejecución aislada.
- **`tsc --noEmit`:** exit 0 (tras Task 1 y tras Task 2).
- **Copy del chip (MINOR-9):** "Menciona boletín N" + aria-label LOCKED — CERO términos
  prohibidos; no requiere entrada en `NEGACIONES_LOCKED` ni sumar la superficie al scan.
- **Block-B respetado:** la validación de existencia es SERVER-SIDE (`LobbySection`);
  `LobbyView`/`VistaCronologica`/`VistaAgrupada`/el chip NO importan `@/lib/supabase` ni
  `.rpc`/`.from` — los chips llegan resueltos en los datos serializados.

## Deviations from Plan

None — plan executed exactly as written. Los tres fixes del PLAN-CHECKER (MAJOR-4 shape
explícito + regresión, MAJOR-5 bound < 1000 declarado y paginado, MINOR-9 copy sin
términos prohibidos) se implementaron dentro de las dos tareas.

## Known Stubs

Ninguno. Ambos artefactos son sustantivos y probados. El chip navega a `/proyecto/N`
real (la ficha proyecto ya existe); la validación de existencia es efectiva contra
`proyecto`. La sección hermana en la ficha PROYECTO ("Audiencias que mencionan este
boletín") es Plan 03 — secuenciación de la fase, no un stub de este plan.

## Threat Flags

Ninguno nuevo. La única lectura server-side añadida es `proyecto.select("boletin")` —
`proyecto` NO es PII y ya se lee server-side en el árbol (patrón `leerProyecto`); no
introduce endpoint, auth path, ni schema en frontera de confianza fuera del threat model.

## Self-Check: PASSED

- FOUND: app/components/mencion-boletin-chip.tsx
- FOUND: app/components/lobby-de-parlamentario.tsx (modificado)
- FOUND: app/components/lobby-de-parlamentario.test.tsx (modificado, 45 tests)
- FOUND: app/lib/types.ts (LobbyAudienciaRow.boletines_mencionados)
- FOUND commit: 55692e5 (Task 1 — chip-link reutilizable)
- FOUND commit: cba2c25 (Task 2 — materia legible + wire chips + tests)
