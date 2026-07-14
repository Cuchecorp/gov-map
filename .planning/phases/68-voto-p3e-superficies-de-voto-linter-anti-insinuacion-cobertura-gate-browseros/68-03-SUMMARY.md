---
phase: 68
plan: 03
subsystem: frontend (ficha del parlamentario — carril de votaciones)
tags: [voto, anti-insinuacion, poda, cobertura, lockdown-allowlist, defamation-risk]
requires:
  - "app/components/votos-por-parlamentario.tsx (carril de voto ya montado)"
  - "app/lib/voto-presentacion.ts (tokens de sentido, fuente única)"
  - "app/components/provenance-badge.tsx (provenance inline)"
provides:
  - "Carril de voto puramente DESCRIPTIVO: sin rebeldía ni comparativo de cámara"
  - "Leyenda anti-insinuación verbatim (bloque 0) + techo por causa condicional + N/M incondicional"
  - "PUBLIC_RPC_ALLOWLIST endurecido (2 RPC insinuantes fuera; inertes en DB)"
affects:
  - "app/components/votos-por-parlamentario.tsx"
  - "app/lib/types.ts"
  - "app/lib/lockdown-guard.test.ts"
tech-stack:
  added: []
  patterns:
    - "Copy VERBATIM LOCKED como constante nombrada (LEYENDA_ANTI_INSINUACION / COPY_TECHO_POR_CAUSA)"
    - "Negative-match GATE resta la leyenda (que NIEGA 'disciplina') antes del regex — espejo del strip de la caption del chart"
    - "Poda coherente de 4 puntos por bloque (import → tipo → fetch → render) para no dejar fetch huérfano ni tipo sin poblar"
key-files:
  created: []
  modified:
    - "app/components/votos-por-parlamentario.tsx"
    - "app/components/votos-por-parlamentario.test.tsx"
    - "app/lib/types.ts"
    - "app/lib/lockdown-guard.test.ts"
  deleted:
    - "app/components/ausencias-contexto.tsx"
    - "app/components/ausencias-contexto.test.tsx"
decisions:
  - "Techo por causa CONDICIONAL vía nuevo campo opcional `techoPorCausa` en VotosViewData; sin señal de causa cableada aún → undefined → línea omitida (nunca se fabrica el techo). RESEARCH Open Question 3."
  - "N/M por proyecto hecho INCONDICIONAL (cuando hay votos) en vez de gated por umbral: el observatorio nunca finge exhaustividad. `COBERTURA_BAJA_UMBRAL` quedó sin uso → eliminado."
  - "RPC rebeldias_de_parlamentario / tasa_ausencia_comparada quedan INERTES en la DB (sin DDL); se quitan del allowlist para que el guard cace cualquier re-montaje futuro (endurecimiento, RESEARCH A2)."
metrics:
  duration: "~9 min"
  completed: 2026-07-14
  tasks: 2
  files: 6
---

# Phase 68 Plan 03: Poda de superficies de voto + anti-insinuación + cobertura Summary

Poda de los dos bloques prohibidos del carril ciudadano de votaciones ("Votó distinto a su bancada" / rebeldía y el comparativo con la mediana de la cámara), montaje de la leyenda anti-insinuación verbatim + declaración honesta de cobertura N/M + techo por causa, y endurecimiento de `PUBLIC_RPC_ALLOWLIST` — dejando el carril puramente descriptivo y las RPC insinuantes inertes en la DB.

## Objetivo cumplido

El carril de votaciones de la ficha del parlamentario es ahora un historial DESCRIPTIVO (VOTO-02): arco por proyecto con enlace a proyecto + votación + provenance inline, precedido por la leyenda anti-insinuación verbatim (VOTO-04), con cobertura declarada honestamente (VOTO-05). Los bloques de juicio/comparación (rebeldía, mediana de cámara) están fuera del render y del allowlist; sus RPC quedan inertes en la DB, cerrando el riesgo legal del 17-LEGAL-DOSSIER (ítem diferido VOTOX v2).

## Tareas ejecutadas

### Task 1 — Poda + eliminación + endurecimiento del allowlist (commit `6f4a7df`)
Poda coherente de los 4 puntos por bloque en `votos-por-parlamentario.tsx`:
- **Rebeldía:** import de tipo `RebeldiaRow`, campo `VotosViewData.rebeldias`, param/return en `derivarVotosViewData`, fetch `rebeldias_de_parlamentario`, y el bloque JSX `<h3>Votó distinto a su bancada</h3>`.
- **Ausencias/mediana:** import `AusenciasContexto`, campo `ausenciaContexto`, render `<AusenciasContexto/>`, fetch `tasa_ausencia_comparada`.
- Docblock cabecero reescrito al nuevo orden (sin "votó distinto"/"rebeldías").
- `app/components/ausencias-contexto.tsx` + `.test.tsx` **borrados** (verificado: nadie más los importaba).
- `RebeldiaRow` y `AusenciaContextoRow` **borrados** de `lib/types.ts` (sin consumidores en código; solo docs de `.planning`).
- `rebeldias_de_parlamentario` + `tasa_ausencia_comparada` **fuera de `PUBLIC_RPC_ALLOWLIST`** (el guard caza re-montaje).
- Fixtures y tests de rebeldía en `votos-por-parlamentario.test.tsx` reemplazados por un assert de ausencia del bloque podado.
- NO se borraron las RPC de la DB (DDL destructivo gated — quedan inertes).

### Task 2 — Leyenda verbatim + cobertura N/M + techo por causa (commit `f0de15f`)
- **Leyenda anti-insinuación VERBATIM** como bloque 0 (primer hijo del detalle, antes de "¿Cuándo votó?"), tratamiento visual UI-SPEC (`text-sm text-muted-foreground border-l-[3px] border-[--accent-product] pl-2.5`), 1× por superficie.
- **N/M por proyecto INCONDICIONAL** cuando hay votos (antes gated por umbral): nunca finge completitud. `COBERTURA_BAJA_UMBRAL` quedó sin uso → eliminado.
- **Techo por causa CONDICIONAL** (nuevo campo opcional `techoPorCausa`), copy verbatim; omitido cuando no hay causa conocida (sin fabricar el techo).
- Conservados: nota "A favor / En contra…", `ProvenanceBadge` inline por voto, tokens slate de `voto-presentacion.ts` (pareo/ausente nunca rojo — verificado por assert contra la fuente única).
- Los GATE de negative-match que renderizan el `VotosView` completo restan la leyenda antes del regex (la leyenda NIEGA "disciplina", igual que la caption del chart niega "tendencia").

## Verificación

- `pnpm --filter ./app test votos-por-parlamentario` → **70/70 verde**.
- `pnpm --filter ./app test lockdown-guard` → **8/8 verde** (allowlist endurecido, árbol público sin las 2 RPC).
- `pnpm typecheck` (root, `tsc -b`) → **limpio** (ningún `.rpc()` huérfano ni tipo sin usar).
- Suite completa `pnpm --filter ./app test` → **749/749 verde** (sin regresión; baseline 751 − 8 tests de `ausencias-contexto` borrados + tests netos de esta poda).
- `git grep` sobre `votos-por-parlamentario.tsx` de `AusenciasContexto|rebeldias_de_parlamentario|tasa_ausencia_comparada|Votó distinto a su bancada|RebeldiaRow|AusenciaContextoRow` → **0 matches**.
- `ausencias-contexto.tsx` / `.test.tsx` → **inexistentes**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Colisión de la leyenda verbatim con el negative-match de los GATE existentes**
- **Found during:** Task 2
- **Issue:** La leyenda LOCKED contiene "No medimos **disciplina** ni motivo"; tres tests GATE preexistentes (que renderizan el `VotosView` completo) incluyen `disciplina` en su regex prohibido → fallaban con la leyenda montada.
- **Fix:** Restar la leyenda del `textContent` antes del regex en los tres GATE afectados (líneas ~498, ~666, ~915), espejando el patrón ya existente para la caption del chart que niega "tendencia". La leyenda niega el término, no lo afirma.
- **Files modified:** `app/components/votos-por-parlamentario.test.tsx`
- **Commit:** `f0de15f`

**2. [Rule 3 - Blocking] `COBERTURA_BAJA_UMBRAL` sin uso tras hacer N/M incondicional**
- **Found during:** Task 2
- **Issue:** Al hacer la nota N/M incondicional (UI-SPEC §Cobertura), la constante de umbral quedó sin referencias → `tsc -b`/lint la marcaría.
- **Fix:** Eliminada la constante.
- **Files modified:** `app/components/votos-por-parlamentario.tsx`
- **Commit:** `f0de15f`

### Nota de orden de ejecución
Este plan (68-03) se ejecutó ANTES de 68-01 (el linter `anti-insinuacion-guard.test.ts`), por decisión del orquestador: el árbol debe estar limpio antes de que el linter asserte 0 offenders. El criterio de aceptación "linter del Plan 01 verde" queda diferido a la ejecución de 68-01, que correrá sobre el árbol ya podado por este plan.

## Known Stubs

**`techoPorCausa` (VotosViewData) — sin señal de causa cableada aún.**
- **Archivo:** `app/components/votos-por-parlamentario.tsx` (`VotosSection` no computa la causa; `techoPorCausa` llega `undefined`).
- **Razón:** El techo por causa es CONDICIONAL (RESEARCH Open Question 3 / UI-SPEC §Cobertura): solo se muestra con causa conocida (RUT-bloqueado, PDF escaneado, fuente sin desglose nominal). No se fabrica el techo. La derivación de la causa desde la cobertura de ingesta (señal N/M de `pnpm freshness`, Plan 68-01/wave-1) puede cablearse en un plan posterior. La UI YA soporta la línea (test cubre ambas ramas); es un stub INTENCIONAL de dato, no de render.

## Threat Flags

Ninguna superficie de seguridad nueva. La poda solo suprime render de RPC ya PII-safe; el guard lockdown (B) sigue vigente. Las dos RPC salen del allowlist (reduce superficie). No se introdujeron endpoints, auth paths ni accesos a schema nuevos.

## Self-Check: PASSED

- SUMMARY: `.planning/phases/68-.../68-03-SUMMARY.md` — creado (este archivo).
- Commit `6f4a7df` (Task 1) — existe en `git log`.
- Commit `f0de15f` (Task 2) — existe en `git log`.
- `app/components/ausencias-contexto.tsx` — MISSING (borrado, intencional).
- `app/components/votos-por-parlamentario.tsx` — FOUND (modificado).
