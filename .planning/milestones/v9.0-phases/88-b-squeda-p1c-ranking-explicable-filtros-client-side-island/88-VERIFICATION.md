---
phase: 88-b-squeda-p1c-ranking-explicable-filtros-client-side-island
verified: 2026-07-22T03:19:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 88: BÚSQUEDA P1c — Ranking explicable + filtros client-side island — Verification Report

**Phase Goal:** Operar sobre lo que el retrieval ya devolvió — reordenar/filtrar sin re-buscar — con ranking explicable y counts honestos.
**Verified:** 2026-07-22T03:19:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP §88 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Normalizador de estado (texto libre → buckets enum) definido, testeado y reusable | ✓ VERIFIED | `app/lib/estado-bucket.ts`: `estadoBucket()` table-driven first-match-wins, 6 buckets LOCKED, `ETIQUETA_BUCKET`, `deriveAnio()`. Puro (sin React/Supabase), reusable. Censo PROD documentado como comentario (líneas 12-38, `SELECT DISTINCT estado/etapa`). 25 tests verdes en `estado-bucket.test.ts` incl. 6 buckets + `sin_dato` + order-matters compuesto + deriveAnio honesto |
| 2 | Filtros reordenan/filtran los resultados YA obtenidos SIN re-buscar (año/iniciativa/estado/cámara; partido cuando BIO-03) | ✓ VERIFIED | `app/components/buscar-filtros.tsx` island `"use client"`: filtra/reordena en memoria vía `useState`/`useMemo`. CERO `@/lib/supabase`, cero `fetch`/`.rpc`/`.from(` en código (solo mencionados en comentarios). 4 facetas renderizadas (Estado/Iniciativa/Año/Cámara); partido OPCIONAL (campo `partido?`, faceta solo si `tienePartido`). tsc exit 0 |
| 3 | Chips con counts honestos "de estos N", facetas vacías deshabilitadas, NULLs como bucket "sin dato" | ✓ VERIFIED | Leyenda exacta `"Conteos sobre estos N resultados, no sobre todo el corpus."` (línea 31). `FacetChip` con `count===0` → `disabled` + `aria-disabled="true"` + `opacity-40` (líneas 96-116). `sin_dato` bucket visible (faceta estado vía `ETIQUETA_BUCKET.sin_dato`) y año `Sin dato` visible (línea 396). Tests confirman count exacto (7/3/1), disabled, sin_dato visible |
| 4 | Ranking prioriza mensaje>moción + reciente, reglas declaradas, nunca ML opaco ni score | ✓ VERIFIED | `applyOrder` 3 modos deterministas: relevancia (preserva rank retrieval), recientes (año desc, null al final — nunca fabricado), mensajes (Mensaje antes Moción, sort estable preserva rank interno). Leyenda LOCKED línea 33-34. Toggle `role="group"` + 3 `OrderChip` con `aria-pressed`. CERO "ranking/score/puntaje/afinidad/cosine/similitud" en código; linter anti-insinuación (18 tests + mutation self-check) verde sobre las superficies nuevas |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/estado-bucket.ts` | normalizador + deriveAnio puros | ✓ VERIFIED | Exporta `EstadoBucket`, `estadoBucket()`, `ETIQUETA_BUCKET`, `deriveAnio()`; censo PROD documentado; honest-default `sin_dato`; sin I/O |
| `app/lib/estado-bucket.test.ts` | cobertura 6 buckets + sin_dato + deriveAnio | ✓ VERIFIED | 25 tests verdes; order-matters, insensibilidad mayúsculas, deriveAnio null-nunca-fabricado |
| `app/lib/types.ts` (`BuscarSliceRow`) | tipo serializado con partido opcional | ✓ VERIFIED | `BuscarSliceRow` líneas 113-133; `partido?` opcional (BIO-03 fwd-compat); `estadoBucket: EstadoBucket`; JSDoc por nullable |
| `app/components/buscar-filtros.tsx` | island filtros/orden en memoria | ✓ VERIFIED | `"use client"`, cero red, 4 facetas + toggle 3 modos, min-h-11 (×2 controles), aria-pressed (×2), cero raw hex |
| `app/components/buscar-filtros.test.tsx` | tests del island | ✓ VERIFIED | 9 describe blocks: counts, leyendas exactas, toggle, disabled, sin_dato, 3 modos orden, empty-after-filter, partido ausente/presente, a11y |
| `app/app/buscar/page.tsx` | wiring: enriquecer slice + montar island | ✓ VERIFIED | `sliceEnriquecido` deriva año de `min(tramitacion_evento.fecha)`, `estadoBucket`, `normalizarIniciativa`; `<BuscarFiltros slice=... />` montado; card con chip Mensaje/Moción + año |
| `app/components/search-result-card.tsx` | chip iniciativa + año, NO score | ✓ VERIFIED | Badge iniciativa + año/Sin dato; JSDoc §5 "NUNCA score/cosine/rank"; sin puntaje |
| `app/lib/anti-insinuacion-guard.test.ts` (`SUPERFICIES_BUSQUEDA`) | linter cubre archivos nuevos + self-check | ✓ VERIFIED | `SUPERFICIES_BUSQUEDA = ["components/buscar-filtros.tsx","app/buscar/page.tsx"]`; incluido en bucle de escaneo; mutation self-check (guard SÍ muerde) presente; 18 tests verdes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| estado-bucket.ts | estado-bucket.test.ts | import estadoBucket/deriveAnio | ✓ WIRED | import línea 2 del test |
| page.tsx | estado-bucket.ts | import estadoBucket, deriveAnio | ✓ WIRED | línea 9 |
| page.tsx | buscar-filtros.tsx | `<BuscarFiltros slice=.../>` | ✓ WIRED | línea 12 import + 214 montaje |
| page.tsx | tramitacion_evento | año de min(fecha), NUNCA fecha_captura | ✓ WIRED | líneas 157-178 `.select("boletin,fecha").order("fecha",asc)` → minFechaPorBoletin → deriveAnio |
| buscar-filtros.tsx | types.ts / estado-bucket.ts | import BuscarSliceRow, ETIQUETA_BUCKET | ✓ WIRED | líneas 23-24 |
| anti-insinuacion-guard.test.ts | superficies nuevas | SUPERFICIES_BUSQUEDA en bucle | ✓ WIRED | línea 313 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| buscar-filtros.tsx | `slice` prop | page.tsx `sliceEnriquecido` (retrieval→proyecto→tramitacion_evento hidratado) | ✓ Sí (DB queries reales) | ✓ FLOWING |
| page.tsx `anio` | `minFechaPorBoletin` | `tramitacion_evento.fecha` min, `deriveAnio` | ✓ Sí (jamás fecha_captura ni sufijo boletín) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite completa | `cd app && pnpm test` | 84 files / 1059 tests passed (esperado 1059) | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Linter anti-insinuación | `vitest run lib/anti-insinuacion-guard.test.ts` | 18 tests passed (incl. mutation self-check) | ✓ PASS |
| Island sin red | grep supabase/fetch/.rpc/.from en buscar-filtros.tsx | solo comentarios, cero llamadas | ✓ PASS |
| Cero raw hex | grep `#[0-9a-f]{3,6}` en 3 archivos nuevos | ninguno | ✓ PASS |
| Año honesto | grep `fecha_captura` en island/estado-bucket | solo JSDoc prohibitivo | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RANK-01 | 88-02 | Mensajes>mociones + reciente por reglas declaradas, nunca ML/score | ✓ SATISFIED | Truth 4; applyOrder 3 modos; leyenda LOCKED; linter verde |
| FILT-01 | 88-02 | Filtros reordenan/filtran sin re-buscar (año/mensaje-moción/estado/cámara/partido-cuando-BIO-03) | ✓ SATISFIED | Truth 2; island en memoria cero-red; partido opcional |
| FILT-02 | 88-02 | Counts honestos "de estos N", facetas vacías disabled, NULLs bucket sin dato | ✓ SATISFIED | Truth 3; leyenda + disabled + sin_dato visible |
| FILT-03 | 88-01 | Normalizador estado texto→bucket definido/testeado/reusable | ✓ SATISFIED | Truth 1; estado-bucket.ts + 25 tests + censo PROD |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno | — | Sin debt markers (TBD/FIXME/XXX/TODO/HACK), sin stubs, sin raw hex, sin términos de insinuación en los 4 archivos nuevos |

### Human Verification Required

Ninguno. Toda la superficie de esta fase es verificable programáticamente (lógica pura + island in-memory con tests DOM completos vía @testing-library). El gate empírico BrowserOS pertenece a la Phase 89 (deep-links), no a 88 — ROADMAP no declara UI-check humano para 88.

### Gaps Summary

Sin gaps. Los 4 success criteria del ROADMAP §88 están observablemente cumplidos en el código:
- FILT-03: normalizador table-driven honest-default con censo PROD, reusable, 25 tests.
- FILT-01: island `"use client"` filtra/reordena EN MEMORIA — cero Supabase/fetch verificado por grep; contrato FichaRail respetado.
- FILT-02: counts "de estos N" con leyenda LOCKED exacta, facetas count-0 deshabilitadas (aria-disabled), `sin_dato` visible como faceta Y en card.
- RANK-01: 3 modos deterministas explicados, año nunca fabricado (null al final), sort estable preserva rank, cero vocabulario de score/ranking; linter con mutation self-check cubre `buscar-filtros.tsx` + `page.tsx`.

Nota técnica (no gap): el año se deriva EXCLUSIVAMENTE de `min(tramitacion_evento.fecha)` en page.tsx; `fecha_captura` se usa SOLO para el `capturedAt` del ProvenanceBadge (uso correcto), jamás como año. Suite 1059/1059, tsc limpio.

Observación menor (no gap): el linter `SUPERFICIES_BUSQUEDA` cubre `buscar-filtros.tsx` y `page.tsx` (las superficies con copy renderizado). `estado-bucket.ts` (sin copy visible, solo enum/labels factuales) y `search-result-card.tsx` no están en el array — consistente con el criterio del linter (escanea texto renderizado de superficies con copy libre). Las etiquetas de `ETIQUETA_BUCKET` son factuales y no contienen términos prohibidos (verificado por grep).

---

_Verified: 2026-07-22T03:19:00Z_
_Verifier: Claude (gsd-verifier)_
