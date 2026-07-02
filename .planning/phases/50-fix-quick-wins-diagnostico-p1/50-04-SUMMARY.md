---
phase: 50-fix-quick-wins-diagnostico-p1
plan: 04
subsystem: frontend (ficha parlamentario — sección lobby)
tags: [B10, trazabilidad, lobby, camara, honest-state]
requires:
  - "RPC parlamentario_publico (allowlisted, security-definer PII-safe) — ya en PROD"
  - "patrón FinanciamientoSectionConPeriodo (page.tsx) — wrapper que deriva campo público vía RPC"
provides:
  - "LobbyView/LobbyViewData parametrizada por cámara: el frame de fuente refleja la cámara real"
  - "LobbySectionConCamara wrapper (page.tsx) que threadea camara vía RPC allowlisted"
affects:
  - "app/components/lobby-de-parlamentario.tsx"
  - "app/app/parlamentario/[id]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "threading de campo público vía RPC parlamentario_publico (espejo de FinanciamientoSectionConPeriodo)"
    - "helper de copy ramificado por normalización de cámara (idéntica a classify de camara-chip)"
key-files:
  created: []
  modified:
    - "app/components/lobby-de-parlamentario.tsx"
    - "app/app/parlamentario/[id]/page.tsx"
    - "app/components/lobby-de-parlamentario.test.tsx"
decisions:
  - "camara como campo OPCIONAL en LobbyViewData (camara?: string | null) — mantiene tsc verde sin forzar edición del test en Task 1; LobbySection lo pasa siempre"
  - "cámara desconocida (null) → frame genérico 'el registro oficial de la Ley del Lobby' (no atribuye una cámara concreta), en vez del default previo 'la Cámara'"
  - "senado → 'el registro de la Ley del Lobby del Senado'; diputados → 'el registro oficial de la Cámara (camara.cl/transparencia)' (conservado)"
metrics:
  duration: ~7min
  completed: 2026-07-02
  tasks: 2
  files: 3
---

# Phase 50 Plan 04: B10 — Copy de lobby parametrizado por cámara Summary

Parametrización por cámara del frame/intro y empty-state de la sección de lobby: la ficha de un senador ya NO atribuye sus reuniones a "la Cámara (camara.cl/transparencia)" — el frame refleja la cámara real del parlamentario, threadeada vía el RPC `parlamentario_publico` (ya allowlisted), sin tocar el enlace por fila (fuente real) ni abrir superficie nueva.

## Qué se construyó

- **`fuenteLobbyPorCamara(camara)`** en `lobby-de-parlamentario.tsx`: helper puro que ramifica la frase de la fuente del frame según la cámara real (misma normalización que `classify` en `camara-chip.tsx`): senado → "el registro de la Ley del Lobby del Senado"; diputados → "el registro oficial de la Cámara (camara.cl/transparencia)"; desconocida/null → frame genérico "el registro oficial de la Ley del Lobby".
- **`LobbyViewData.camara?: string | null`** + consumo en `LobbyView`: el intro (`:102-108`) y el empty-state (b) (`:129-132`) usan la frase parametrizada. El estado (a) no-ingestado hereda el mismo `intro`. El enlace por fila (`sourceUrl={a.enlace}`) intacto.
- **`LobbySection` gana prop `camara: string | null`** y lo propaga a `LobbyViewData`.
- **`LobbySectionConCamara`** en `page.tsx`: wrapper que espeja VERBATIM `FinanciamientoSectionConPeriodo` — lee `parlamentario_publico` (RPC allowlisted, `.maybeSingle`), `throw-on-error` (#34), deriva `data?.camara ?? null`, y lo pasa como prop. Reemplaza el call directo `<LobbySection … />`.
- **Tests (`lobby-de-parlamentario.test.tsx`)**: `makeViewData` gana `camara` (default `diputados`); 5 nuevos casos B10 (diputados atribuye a la Cámara; senado no dice `camara.cl/transparencia` y refiere el Senado; empty-state senado idem; null → genérico; negative-match §9.1 sobre el copy nuevo).

## Verificación

- `pnpm --filter app exec tsc -b` → limpio.
- `pnpm --filter app test -- lockdown-guard.test.ts` → suite completa **399 verde** (7/7 lockdown, sin nueva RPC/`.from` PII). Baseline 394 → 399 (+5 tests B10).
- Grep: la única ocurrencia viva de `camara.cl/transparencia` está en la rama `diputados` de `fuenteLobbyPorCamara` (`:86`); el path senado nunca la emite.

## Deviations from Plan

None - plan executed exactly as written. (El plan permitía `camara` en `LobbyViewData` "o como prop directo"; se implementó como campo opcional de `LobbyViewData` — decisión documentada arriba para mantener tsc verde entre tareas sin editar el test en Task 1.)

## Commits

- `bc912d8` — fix(50): B10 threading de cámara + copy parametrizado (lobby-de-parlamentario.tsx, page.tsx)
- `f747344` — test(50): B10 fixtures/asserts cubren ambas cámaras (lobby-de-parlamentario.test.tsx)

## Self-Check: PASSED

- FOUND: app/components/lobby-de-parlamentario.tsx (modified)
- FOUND: app/app/parlamentario/[id]/page.tsx (modified)
- FOUND: app/components/lobby-de-parlamentario.test.tsx (modified)
- FOUND commit: bc912d8
- FOUND commit: f747344
