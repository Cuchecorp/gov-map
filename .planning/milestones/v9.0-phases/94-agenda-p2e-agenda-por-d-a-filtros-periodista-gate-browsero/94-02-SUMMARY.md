---
phase: 94
plan: 02
subsystem: agenda
tags: [agenda, filtros-periodista, island, ficharail, tz-chile, anti-insinuacion, cit-04]
requires:
  - "94-01: CitacionCard.estado + dayKey Chile + banner de cobertura (montados)"
  - "parlamentarios-filtro.tsx: idiom FacetChip + counts-de-estos-N (espejo)"
  - "boletin-detector.ts: detectarBoletin (filtro por boletín)"
  - "carril-accordion.tsx: island cliente que envuelve el día (reusado por el island)"
provides:
  - "AgendaFiltros: island client de filtros de periodista — ÚNICO renderer del listado por día post-hidratación"
  - "CitacionSliceRow: fila plana serializable server→island (estado + provenance + invitados; dayKey/dayLabel tz Chile)"
  - "SUPERFICIES_AGENDA: scan del linter anti-insinuación extendido a la superficie nueva + mutation self-check"
affects:
  - "app/app/agenda/page.tsx"
  - "app/lib/agenda-types.ts"
  - "app/lib/anti-insinuacion-guard.test.ts"
tech-stack:
  added: []
  patterns:
    - "island FichaRail: filtra/reagrupa EN MEMORIA el slice serializado; cero Supabase (lockdown-guard escanea .from/.rpc)"
    - "server calcula dayKey/dayLabel en tz Chile UNA vez y los serializa; el island NUNCA recalcula tz (no duplica tzdb en cliente)"
    - "counts honestos de-estas-N sobre el slice COMPLETO (useMemo sobre slice, no sobre filasVisibles)"
    - "fechas cruzan la frontera server→client como ISO string; el island reconstruye Date para la CitacionCard"
key-files:
  created:
    - "app/components/agenda-filtros.tsx"
    - "app/components/agenda-filtros.test.tsx"
  modified:
    - "app/lib/agenda-types.ts"
    - "app/app/agenda/page.tsx"
    - "app/app/agenda/page.test.tsx"
    - "app/lib/anti-insinuacion-guard.test.ts"
decisions:
  - "DECISIÓN del orquestador aplicada: el island es el ÚNICO renderer del listado por día post-hidratación y renderiza la MISMA CitacionCard que el SSR (cero divergencia); el slice incluye estado + provenance + invitados (dato público ya renderizado SSR — no es exposición adicional)"
  - "El island REUSA CarrilAccordion (que ya es 'use client') para el día — un solo owner del día-list; se eliminó la sub-agrupación h4 por comisión (la comisión es el heading de la propia CitacionCard)"
  - "El rango de fechas compara contra dayKey (día-Chile YYYY-MM-DD), no contra la fecha ISO cruda — coherente con la agrupación tz Chile"
metrics:
  duration: "~25 min"
  completed: 2026-07-22
  tasks: 2
  files: 6
---

# Phase 94 Plan 02: Island agenda-filtros + serialización slice + linter Summary

Island de filtros de periodista para /agenda (CIT-04): filtra EN MEMORIA el slice de la semana cargada por cámara / comisión / rango de fechas / boletín mencionado, con counts honestos "de estas N", y reagrupa por día-Chile. Aplica la DECISIÓN del orquestador: el island es el ÚNICO renderer del listado por día post-hidratación (renderiza la MISMA `CitacionCard` que el SSR — cero divergencia visual). Extiende el linter anti-insinuación a la superficie nueva con mutation self-check. Contrato FichaRail intacto (cero Supabase en el island).

## What Was Built

**Task 1 — Island `agenda-filtros.tsx` (TDD, commit ae2dde7):**
- `CitacionSliceRow` (agenda-types): fila PLANA JSON-serializable que cruza server→island. Incluye TODO lo que la card muestra — `estado`, `provenance` (trazabilidad, principio rector) e `invitados` (dato público ya renderizado SSR; la exclusión previa se REVIRTIÓ por decisión del orquestador documentada). Fechas como ISO string; `dayKey`/`dayLabel` en tz Chile calculados por el server.
- `agenda-filtros.tsx`: island `"use client"` espejo estructural de `parlamentarios-filtro.tsx`. **Contrato FichaRail DURO: JAMÁS importa `@/lib/supabase` ni usa `.rpc`/`.from`** — filtra en memoria con React state. Reutiliza `FacetChip` (min-h-11, aria-pressed, disabled en count=0, engaged en petróleo vía utilidad registrada). 4 facetas: cámara (chips), comisión (freq desc→alfa, "Sin dato" al final), rango de fechas (`<input type="date">` acotado a min/max del slice), boletín (`detectarBoletin` por base). Counts honestos sobre el slice completo. "Esta semana" resetea. Empty tras filtro LOCKED. **Es el ÚNICO renderer del listado por día**: reagrupa por `dayKey` y renderiza cada día en un `CarrilAccordion` (que ya es un island cliente) con sus `CitacionCard`.
- 16 tests RTL: render del listado por día, estado visible, faceta cámara/comisión/Sin dato, rango date acota, boletín "14309" filtra por base + texto libre no filtra a cero, counts sobre slice completo, "Esta semana" resetea, empty LOCKED, accesibilidad (aria-pressed, labels).

**Task 2 — Serialización + montaje + linter (commit ef35661):**
- `CitacionesSection` (page.tsx): arma el SLICE PLANO (dayKey/dayLabel tz Chile calculados server-side, boletines[] de `citacion_punto`, provenance ISO) y monta `<AgendaFiltros slice={slice} />` como el vehículo de la vista semanal. El SSR de `AgendaFiltros` produce el primer render (hidratación progresiva). El buscador FTS global (`buscarCitaciones`) coexiste intacto en la rama `buscando`.
- Se eliminó el import de `CarrilAccordion` de page.tsx (ahora lo usa el island) y la sub-agrupación h4 por comisión (la comisión es el heading de la `CitacionCard`).
- Linter `anti-insinuacion-guard.test.ts`: nuevo `SUPERFICIES_AGENDA` (`agenda-filtros.tsx`, `agenda-cobertura.tsx`, `app/agenda/page.tsx`) al spread del scan + mutation self-check AGENDA (fixture EN MEMORIA que inyecta "disciplina"/"influencia" → el guard MUERDE).
- `page.test.tsx` actualizado a la estructura island (día h3 trigger + CitacionCard con su comisión como heading) + nuevo caso de leyenda de counts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reword "inicio de la captura" → "inicio de la ingesta"**
- **Found during:** Task 2 (al añadir `page.tsx` al scan del linter)
- **Issue:** El copy factual del Senado forward-only ("…es anterior al inicio de la captura…") contiene el término `captura`, prohibido en el carril MONEY del linter (sentido "captura regulatoria"). Aquí "captura" significa "captura/ingesta de datos" — sentido benigno, pero el linter no puede distinguirlos.
- **Fix:** Reword a "la ingesta" — vocabulario canónico del proyecto (CLAUDE.md usa "ingesta" en todo el pipeline), mismo significado exacto, sin falso-positivo. Ningún test dependía de esa copy.
- **Files modified:** `app/app/agenda/page.tsx`
- **Commit:** ef35661

**2. [Decisión orquestador aplicada] El island reemplaza al SSR como owner del día-list**
- La sub-agrupación h4-por-comisión del SSR previo se eliminó: el island renderiza `CitacionCard` directo bajo el día, y la comisión ya es el heading de la card. `page.test.tsx` se ajustó (no es deviación de código sino consecuencia declarada de la decisión). La leyenda de estado y el banner de cobertura (94-01) permanecen; solo cambió el renderer del listado por día.

## Verification

- `grep -nE "@/lib/supabase|\.rpc|\.from\(" agenda-filtros.tsx` → solo JSDoc + `Array.from` (builtin). **CERO acceso Supabase** (contrato FichaRail). lockdown-guard verde.
- Filtros operan: cámara reduce (Senado → 3 filas), comisión con "Sin dato", rango date acota (desde 2026-06-24 oculta días previos), boletín "14309" filtra por base, texto libre no filtra a cero.
- Counts "de estas N" sobre el slice completo (tras filtrar Hacienda, Senado sigue en 3).
- Linter verde con `SUPERFICIES_AGENDA` incluido; mutation self-check AGENDA muerde ("disciplina"/"influencia").
- Suite completa: **1206/1206** (92 test files). tsc `--noEmit`: **exit 0**.

## NEGACIONES_LOCKED / Linter

Las leyendas LOCKED del banner/estado ("…no es un calendario completo del Congreso.", "…no confirma que la sesión se realizará.") usan "completo"/"confirma", que NO están en `TERMINOS_PROHIBIDOS` — son negaciones honestas de términos NO prohibidos, así que NO requirieron registro en `NEGACIONES_LOCKED` (verificado: el diff de términos no contiene "completo" ni "confirma"). El único choque fue "captura" (término MONEY) en copy factual de ingesta → resuelto por reword, no por negación.

## Known Stubs

Ninguno. El slice se sirve de datos reales; el island no tiene datos mock ni placeholders.

## Threat Flags

Ninguna superficie nueva de seguridad. El slice serializado son campos NO-PII (citacion/citacion_punto/citacion_invitado son públicas por 0010, T-94-03 mitigado — invitados incluidos por decisión del orquestador: dato público ya renderizado SSR en la misma página, no exposición adicional). El input de boletín se procesa client-side con `detectarBoletin` (regex acotada), no navega ni consulta (T-94-04 mitigado por el linter extendido). Cero paquete nuevo (T-94-SC).

## Self-Check: PASSED

- FOUND: app/components/agenda-filtros.tsx
- FOUND: app/components/agenda-filtros.test.tsx
- FOUND: commit ae2dde7 (feat 94-02 island agenda-filtros)
- FOUND: commit ef35661 (feat 94-02 slice + montaje + linter)
