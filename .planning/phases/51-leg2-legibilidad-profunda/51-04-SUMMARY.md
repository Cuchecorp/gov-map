---
phase: 51-leg2-legibilidad-profunda
plan: 04
subsystem: frontend-ficha-parlamentario
tags: [lobby, legibilidad, SC6, B11, anti-insinuacion]
requires:
  - "RPC lobby_de_parlamentario (0021, ya en PROD, sin cambios)"
  - "lobby_ingesta_estado (marcador de ingesta, sin cambios)"
provides:
  - "agruparPorContraparte(audiencias) — helper puro exportado (freq DESC)"
  - "normalizarVista(?vista) — fail-safe enum"
  - "vista agrupada por contraparte como DEFAULT de la sección lobby"
  - "toggle server-driven ?vista=cronologica (preserva la lista paginada)"
  - "caveat de identidad 1×/sección (reemplaza IdentityMarker por fila)"
affects:
  - "app/components/lobby-de-parlamentario.tsx (LobbyView, LobbySection)"
  - "sección #lobby de /parlamentario/[id]"
tech-stack:
  added: []
  patterns:
    - "helper puro exportado + vista pura RTL (sin runtime Supabase/Next)"
    - "toggle server-driven vía searchParam (cero client island nuevo)"
    - "caveat único por sección (idiom del intro + tokens --identity-warn-*)"
key-files:
  created: []
  modified:
    - "app/components/lobby-de-parlamentario.tsx"
    - "app/components/lobby-de-parlamentario.test.tsx"
decisions:
  - "n = audiencias distintas por contraparte (dedupe de nombre DENTRO de la audiencia → no infla el conteo si la fuente repite el nombre)"
  - "audiencias SIN contraparte se EXCLUYEN de la agrupación (nunca fabrica un nombre); la vista cronológica sigue mostrándolas"
  - "vista agrupada NO se pagina (bounded a cientos, el RPC ya trae todo); la paginación ?lobbyPage vive solo en la vista cronológica y preserva ?vista=cronologica"
  - "sort estable → empates de frecuencia conservan el orden de aparición del RPC (fecha DESC)"
  - "caveat copy LOCKED del UI-SPEC: 'su identidad no está verificada' (no el marcador inline 'identidad no verificada')"
metrics:
  duration: ~10min
  tasks: 2
  files: 2
  completed: 2026-07-03
---

# Phase 51 Plan 04: Lobby agrupado por contraparte Summary

**One-liner:** La sección de lobby de `/parlamentario/[id]` pasa a agrupar por contraparte (orden por frecuencia DESC) como vista DEFAULT — respondiendo "¿con quién se reúne más?" — con un caveat de identidad único por sección y un toggle server-driven `?vista=cronologica` que preserva intacta la lista cronológica paginada existente.

## What Was Built

### Task 1 — Helper `agruparPorContraparte` + vista agrupada default + caveat 1× (TDD)
- **`agruparPorContraparte(audiencias): GrupoContraparte[]`** — helper puro exportado que agrupa por `contraparte_nombre` crudo verbatim, cuenta `n` reuniones (dedupe de nombre dentro de la audiencia) y colecta `fechas[]` ya formateadas (`fechaCorta`), ordenado por `n` DESC con `sort` estable. Audiencias sin contraparte se excluyen de la agrupación (nunca fabrica un nombre).
- **Vista agrupada = DEFAULT** de `LobbyView`: cada grupo es un `<li>` con `<h3>` para la contraparte verbatim + línea "— {N} reuniones: {fechas}" (Mono para N/fechas). Cero composición con votos/dinero/proyectos.
- **Caveat de identidad 1×/sección** (`CaveatIdentidad`): "Las contrapartes se muestran tal como las registra la fuente; su identidad no está verificada." (tokens `--identity-warn-*`, idiom del intro).
- **Removido el `<IdentityMarker/>` por fila** de `ContraparteCruda` (el caveat de sección lo reemplaza) + import de `IdentityMarker` eliminado. La contraparte sigue verbatim y NUNCA enlazada.

### Task 2 — Toggle `?vista=cronologica` que preserva la vista paginada
- **`normalizarVista(?vista)`** — fail-safe: solo el literal `"cronologica"` activa la vista cronológica; cualquier otro valor (`undefined`/`""`/`"basura"`/array) → `"agrupada"`. Nunca alcanza SQL crudo (T-51-12).
- **`VistaToggle`** — dos enlaces server-driven al tope: "Agrupar por contraparte" (default) y "Ver en orden cronológico" → `?vista=cronologica`. El enlace activo lleva el estado activo petróleo (`text-accent-product` + `decoration-accent-product`, `aria-current="true"`).
- **`LobbySection`** lee `vista` desde el `searchParams` ya resuelto (helper `single()` + `normalizarVista`); `vista==='cronologica'` renderiza la lista paginada existente (extraída a `VistaCronologica`, comportamiento intacto) y cualquier otro caso la vista agrupada.
- **`buildHref`** ahora preserva `?vista=cronologica` en los enlaces de paginación (Anteriores/Siguientes) para que el toggle no se pierda al paginar.

## Verification
- `pnpm --dir app test -- --run lobby-de-parlamentario` → **448/448 verde** (incluye 32 tests nuevos/ajustados de lobby + lockdown-guard).
- `pnpm --dir app exec tsc -b` → limpio (exit 0).
- Negative-match banned-vocab §9.1 verde sobre el copy nuevo (caveat + grupos + toggle): sin causalidad/afinidad/score/ranking/juicio.
- Lockdown-guard (parte de la suite): sin RPC nueva ni `.from` PII nuevos — solo se reusa `lobby_de_parlamentario` (allowlisted) y `lobby_ingesta_estado` (no-PII). Camino A intacto.

## Threat Model Coverage
- **T-51-11 (Spoofing identidad):** contraparte verbatim, NUNCA enlazada; caveat de identidad 1×/sección visible en estado (c). Test asierta que la contraparte no está dentro de un `<a>`.
- **T-51-12 (Tampering ?vista):** `normalizarVista` normaliza a un enum efectivo antes de cualquier uso; `?vista=basura` → agrupada (test lo asierta).
- **T-51-13 (Repudiation, audiencia sin contraparte):** excluida de la agrupación, nunca fabrica un nombre (test dedicado).
- **T-51-SC (npm installs):** cero nuevas dependencias.

## Deviations from Plan

**None material.** El plan definía dos tasks (Task 1 tdd, Task 2 auto) sobre los mismos dos archivos. El ciclo TDD se preservó (RED `c8342fb` → GREEN `253f624`), pero el RED unificó los tests de ambas tasks en un solo commit de test (la vista pura testea Task 2 vía el prop `vista`, y `normalizarVista` es un helper puro), y el GREEN aterrizó la implementación de ambas tasks en un solo commit `feat` — Task 1 y Task 2 son ediciones fuertemente acopladas al mismo `LobbyView`/`LobbySection`, y separarlas dejaría un estado intermedio con tests rojos (violando el gate de verify verde por task). Comportamiento, criterios de aceptación y anti-insinuación cumplidos íntegramente.

## Commits
- `c8342fb` — test(51-04): failing tests (RED) — agruparPorContraparte, normalizarVista, caveat 1×, toggle
- `253f624` — feat(51-04): lobby agrupado por contraparte (default) + toggle ?vista + caveat 1× (GREEN)

## Known Stubs
None. La vista agrupada consume datos reales del RPC `lobby_de_parlamentario` (sin cambios de contrato); la vista cronológica se preserva verbatim.

## Self-Check: PASSED

- Files verified on disk: lobby-de-parlamentario.tsx, lobby-de-parlamentario.test.tsx, 51-04-SUMMARY.md
- Commits verified in git log: c8342fb (test), 253f624 (feat)
