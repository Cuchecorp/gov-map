---
phase: 50-fix-quick-wins-diagnostico-p1
plan: "02"
subsystem: frontend
tags: [honest-state, copy, presentacion, quick-wins, diagnostico-p1]
requires:
  - "app/lib/format.ts helpers (50-01, ya mergeado): conteoVotacion, extractoIdea"
provides:
  - "Pill del hero del home apuntando a boletín real 14309-04"
  - "Honest-state explícito para votación sin desenlace (paridad Cámara/Senado)"
  - "Nota una-vez-por-sección para arcos sin idea matriz (fin del ruido per-arco)"
affects:
  - "app/app/page.tsx"
  - "app/components/votacion-card.tsx"
  - "app/components/votos-por-parlamentario.tsx"
tech-stack:
  added: []
  patterns:
    - "honest-state sobrio (text-sm text-muted-foreground) sin vocabulario prohibido"
    - "nota-de-sección una-vez (espejo del bloque de cobertura baja)"
key-files:
  created: []
  modified:
    - "app/app/page.tsx"
    - "app/app/page.test.tsx"
    - "app/components/votacion-card.tsx"
    - "app/components/votacion-card.test.tsx"
    - "app/components/votos-por-parlamentario.tsx"
    - "app/components/votos-por-parlamentario.test.tsx"
decisions:
  - "B1 = cambio de VALOR del pill (LOCKED UI-SPEC §6), no validación dinámica contra DB"
  - "B14 revierte la omisión de Phase 22: ausencia de desenlace se dice como HECHO honesto"
  - "Honest-state de idea matriz va UNA vez por sección; repetirlo por arco es ruido, no honestidad"
  - "voto-ficha-row.tsx NO se toca (dead code, diferido a B24/Phase 51); test migrado a VotosView"
metrics:
  duration: ~4min
  tasks: 3
  files: 6
  completed: 2026-07-02
---

# Phase 50 Plan 02: Honest-states de superficie (pill del home, votación sin desenlace, idea matriz repetida) Summary

Tres fixes independientes de honestidad de superficie: el pill del hero apunta a un boletín real (14309-04), una votación sin resultado muestra "Desenlace no informado por la fuente." en vez de omitir silenciosamente, y el honest-state de idea matriz en la sección de votos aparece una sola vez por sección en lugar de repetirse por cada arco.

## What Was Built

- **B1 — pill del home (`app/app/page.tsx`):** `EXAMPLE_CHIPS` cambia el boletín Mono de `15234-07` (inexistente) a `14309-04` (verificado en PROD). El pill navega a `/buscar?q=14309-04`. Test actualizado (botón `"14309-04"` + push esperado); `search-result-card.test.tsx` intacto (usa 15234-07 como fixture arbitrario, no como el pill).
- **B14 — votación sin desenlace (`app/components/votacion-card.tsx`):** el bloque `{votacion.resultado && (…)}` pasa a ternario. Rama con resultado = intacta (frase "El proyecto fue …" + `EtapaBadge`). Rama null = línea honest-state `<p className="mt-3 text-sm text-muted-foreground">Desenlace no informado por la fuente.</p>`. Barra y totales siempre visibles (sin cambios). Revierte la omisión de Phase 22 → paridad Cámara/Senado.
- **HS — idea matriz repetida (`app/components/votos-por-parlamentario.tsx`):** `ProyectoGrupo` omite la línea per-arco cuando `grupo.idea_matriz` es null (antes renderizaba "De qué trata: no disponible aún" 1×/arco). `VotosView` computa `hayArcoSinIdea = arcos.some((g) => !g.idea_matriz)` sobre los arcos (agrupados una sola vez, reusados por la lista) y emite UNA nota de sección espejando el bloque de cobertura baja. Cuando SÍ hay idea, sigue mostrando "De qué trata: {extracto}".

## How to Verify

- `pnpm --filter app test` → 385 verde (suite completa; incluye los 3 archivos de test tocados).
- `pnpm --filter app exec tsc -b` → limpio.
- `git diff app/components/voto-ficha-row.tsx app/components/search-result-card.test.tsx` → vacío (dead code y fixture no relacionado intactos).

## Deviations from Plan

None - plan executed exactly as written. Cero DB, cero RPC, cero flags/DDL, cero packages. Superficie lockdown-guard sin cambios (solo `app/**` presentación).

## Key Decisions

- El copy del honest-state de idea matriz ("En algunos proyectos, la idea matriz aún no está disponible en las fuentes consultadas; se irá incorporando.") es sobrio es-CL, dentro de DESIGN-SYSTEM §6/§9.1, sin vocabulario prohibido; el negative-match de la suite (GATE §6) pasa.
- La nota de sección se renderiza junto al bloque de cobertura baja (ambas pueden coexistir; son hechos distintos), condicionada a `votos.length > 0 && hayArcoSinIdea`.

## Threat Flags

None. Sin superficie de seguridad nueva: cero endpoint, cero auth, cero `.from()` PII, cero cambio de schema. T-50-02-INT mitigado (copy sobrio, honest-state una vez, negative-match verde).

## Commits

- `abaa180` fix(50): B1 — pill del home 15234-07 → 14309-04 (boletín real en PROD)
- `37d9f5b` fix(50): B14 — votación sin resultado muestra honest-state explícito
- `2e966a0` fix(50): HS — honest-state de idea matriz una-vez-por-sección en votos
