---
phase: 128-panel-ui
plan: 01
subsystem: panel-ui-cimientos
tags: [links-internos, idioms-panel, panel-item-proyecto, anti-insinuacion-guard]
dependency-graph:
  requires: []
  provides:
    - "lib/idioms-panel.ts (IDIOMS_APROBADOS single-source)"
    - "lib/links-internos.ts (hrefProyecto/hrefAgenda/semanaIsoDeFecha)"
    - "components/panel-item-proyecto.tsx (PanelItemProyecto)"
  affects:
    - "Plans 03/04/05 (tiles del panel): consumen hrefProyecto/hrefAgenda/PanelItemProyecto"
tech-stack:
  added: []
  patterns:
    - "single-source prod→test para IDIOMS_APROBADOS (mismo patrón que las LEYENDA_* existentes)"
    - "helper puro de hrefs en lib/ (cero I/O, cero JSX) separado de componentes"
key-files:
  created:
    - app/lib/idioms-panel.ts
    - app/lib/links-internos.ts
    - app/lib/links-internos.test.ts
    - app/components/panel-item-proyecto.tsx
    - app/components/panel-item-proyecto.test.tsx
    - .planning/phases/128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas/deferred-items.md
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "IDIOMS_APROBADOS: 5 stems totales (4 previos de 126 + 'fechada el', mandato O-4) — se siguió el <success_criteria> del plan (explícito en 5 stems + 'fechada el') sobre la lista más amplia mencionada en el <done> de la Task 1, que enumeraba también 'fechado el'/'fechadas en'/'En tabla de sala del' sin aclarar si esos entran en este plan o en los siguientes (03/04/05); esos 3 quedan para cuando el copy real de esos tiles los use, con el mismo patrón de alta previa al copy."
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 128 Plan 01: Cimientos del panel — idioms, links internos y item nombrado Summary

Single-source de idioms aprobados vía import (no re-tipeo), helper puro de hrefs con el orden `?query#hash` correcto, y el ítem de proyecto reusable con guard `en_corpus` que nunca enlaza a una ficha inexistente.

## What Was Built

**Task 1 — `app/lib/idioms-panel.ts`:** módulo single-source REAL que exporta `IDIOMS_APROBADOS` (5 stems: los 4 previos de la Phase 126 + `"fechada el"`, mandato O-4). `app/lib/anti-insinuacion-guard.test.ts` fue modificado para IMPORTAR el array (se borró su `const` local) en vez de re-tipearlo — misma dirección prod→test que las `LEYENDA_*` existentes en el mismo archivo. Los self-checks existentes (`it.each` D-10(i) en :1576, anti-cero-vacuo en :1594, y WR-03 no-hueco inverso) quedaron intactos, cubriendo ahora el array importado sin duplicación.

**Task 2 — `app/lib/links-internos.ts`:** módulo puro (cero I/O, cero JSX, cero strings visibles) con `hrefProyecto`, `hrefAgenda`, `semanaIsoDeFecha`. `hrefAgenda` siempre emite `?semana=...#ancla` (query ANTES del fragmento — Pitfall P1) y omite el query si la semana es null/undefined/malformada (validado con `parseISOWeek` + `semanaIsoKey` contra el string crudo, para no fabricar una semana distinta a la pedida). `semanaIsoDeFecha` usa `isoWeekOf`/`semanaIsoKey` de `lib/week-utils.ts` sobre `new Date(fechaIso)` — sin conversión de zona horaria (gotcha rector v9.0/v12.0: date-only disfrazado de timestamptz).

**Task 3 — `app/components/panel-item-proyecto.tsx`:** RSC puro con el guard `en_corpus`: `enCorpus:true` + boletín emite `<a href={hrefProyecto(...)}>`; `enCorpus:false` emite CERO hrefs internos (`a[href^="/proyecto"]`) y, si hay `enlaceFuente`, un enlace externo `target="_blank" rel="noopener noreferrer"`. `textoAlterno` se trunca con `extractoIdea` (max 120). `titulo:null` con boletín renderiza el boletín solo, sin fabricar "null"/"undefined". Nombre de archivo `panel-item-proyecto.tsx` — ya estaba declarado en `SUPERFICIES_PANEL` del guard (alta preventiva de la Phase 126), así el anti-drift `(1f)` no muerde.

## Deviations from Plan

None — el plan se ejecutó tal como estaba escrito, salvo la decisión documentada arriba sobre el alcance exacto de `IDIOMS_APROBADOS` (5 stems, siguiendo `<success_criteria>` sobre la ambigüedad del `<done>` de Task 1).

## Deferred Issues (out of scope)

Ver `.planning/phases/128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas/deferred-items.md`: `pnpm guards` completo mostró 3 timeouts (`money`/`notif`/`vsim`-antiflip-guard `WR-03`, escaneo de `packages/`) al correr en paralelo bajo carga; los 3 pasan en aislamiento con timeout default. No relacionados con los archivos de este plan (no tocan `packages/` ni los chokepoints MONEY/NOTIF/VSIM) — no se corrigieron por estar fuera del alcance de esta tarea.

## Verification

```
cd app && pnpm vitest run lib/links-internos.test.ts components/panel-item-proyecto.test.tsx lib/anti-insinuacion-guard.test.ts lib/bento-guards.test.ts
```
→ 4 archivos de test, 187 tests, todos verdes.

## Self-Check: PASSED

- `app/lib/idioms-panel.ts` existe: FOUND
- `app/lib/links-internos.ts` existe: FOUND
- `app/lib/links-internos.test.ts` existe: FOUND
- `app/components/panel-item-proyecto.tsx` existe: FOUND
- `app/components/panel-item-proyecto.test.tsx` existe: FOUND
- Commit `5430ce4` (feat idioms-panel): FOUND
- Commit `a10f2f5` (test links-internos): FOUND
- Commit `9cecc39` (feat links-internos): FOUND
- Commit `fffa999` (test panel-item-proyecto): FOUND
- Commit `e15f241` (feat panel-item-proyecto): FOUND
