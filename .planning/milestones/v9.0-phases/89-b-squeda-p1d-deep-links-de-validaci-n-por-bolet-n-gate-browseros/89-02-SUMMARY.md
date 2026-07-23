---
phase: 89-b-squeda-p1d-deep-links-de-validaci-n-por-bolet-n-gate-browseros
plan: "02"
subsystem: frontend
tags: [trace, deep-link, validacion-fuente, r2, allowlist, trazabilidad]
dependency_graph:
  requires: [prm_id_camara columna PROD (89-01)]
  provides: [ValidacionFuenteSection, validar-deeplinks.mjs, ProyectoRow.prm_id_camara en app/lib/types.ts]
  affects: [app/app/proyecto/[boletin]/page.tsx, app/lib/types.ts]
tech_stack:
  added: []
  patterns:
    - "Server component recibe datos ya resueltos por page.tsx (no fetch propio)"
    - "safeExternalHref en todo href externo (T-89-08)"
    - "allowlist de prefijo R2 tramitacion/* (T-89-06, helper puro testeable)"
    - "leerSourceSnapshot directo .from() sin RPC — Camino A (no PII_TABLE)"
    - "honest-error #34 en server functions (lanza, no degrada a empty)"
    - "curl-first para Cámara (WAF bypass verificado vivo)"
key_files:
  created:
    - app/components/validacion-fuente.tsx
    - app/components/validacion-fuente.test.tsx
    - scripts/validar-deeplinks.mjs
  modified:
    - app/app/proyecto/[boletin]/page.tsx
    - app/lib/types.ts
    - app/components/estado-actual-block.test.tsx
decisions:
  - "ValidacionFuenteSection es server component puro; recibe datos del page.tsx — cero fetch propio"
  - "leerSourceSnapshot vive en page.tsx (no dentro del componente) — separa concerns entre data y UI"
  - "prm_id_camara: string | null añadido a ProyectoRow (mig 0058 ya aplicada a PROD)"
  - "navEntries: +1 entrada validacion-fuente; RailSkeleton 7→8/8→9 (WR-02)"
  - "BCN omitido del DOM sin placeholder ni comentario visible — fail-honest LOCKED"
metrics:
  duration: "~30 min"
  completed: "2026-07-22"
  tasks: 2
  files: 6
---

# Phase 89 Plan 02: ValidacionFuenteSection + validar-deeplinks.mjs Summary

Sección "Valida este dato en la fuente" montada en la ficha de proyecto: Senado SIEMPRE, Cámara SOLO si `prm_id_camara != null`, BCN omitido; fecha de captura visible; respaldo R2 con allowlist de prefijo `tramitacion/*` (fecha + hash, sin descarga). Script curl-first para validación empírica viva.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ValidacionFuenteSection + tests TRACE-01/03 | 210111d | validacion-fuente.tsx, validacion-fuente.test.tsx, lib/types.ts |
| 2 | Wiring page.tsx + script validar-deeplinks | b0960b0 | page.tsx, validar-deeplinks.mjs, estado-actual-block.test.tsx |

## What Was Built

### `app/components/validacion-fuente.tsx`
- `ValidacionFuenteSection`: server component, recibe `{boletin, prm_id_camara, fecha_captura, snapshot}`.
- `buildSenadoUrl(boletin)`: `tramitacion.senado.cl/...?boletin_ini=` (boletín completo con sufijo).
- `buildCamaraUrl(boletin, prmId)`: `camara.cl/...?prmID=&prmBOLETIN=` — solo cuando `prm_id_camara != null`.
- `esR2PathPermitido(r2_path)`: allowlist `tramitacion/` (T-89-06, helper puro testeable).
- `safeExternalHref` en TODO href externo (T-89-08).
- Respaldo R2: muestra `Respaldo del {fecha} · hash {12 chars}…` + leyenda "Esto decía la fuente ese día." SIN link de bucket.
- `ValidacionFuenteSkeleton` shape-matched para Suspense fallback.
- Tokens UI-SPEC: petróleo `--accent-product` solo en links, nunca fill; fuentes Senado/Cámara por texto, nunca por color; touch target `min-h-11`.

### `app/components/validacion-fuente.test.tsx` (9 tests, todos verdes)
- TRACE-01: Senado SIEMPRE con `boletin_ini=14309-04` encodeURIComponent; host `tramitacion.senado.cl`.
- TRACE-01: Cámara con `prmID=17140&prmBOLETIN=16572-06` cuando `prm_id_camara="17140"`.
- TRACE-01: `prm_id_camara=null` → NO fila Cámara, NO texto "Ver en la Cámara".
- TRACE-01: BCN nunca en el DOM (ningún texto BCN/LeyChile/Biblioteca del Congreso).
- TRACE-03: `r2_path=tramitacion/...` → muestra hash 12 chars + leyenda; NUNCA href con r2_path.
- TRACE-03: `r2_path=infoprobidad/...` → respaldo OMITIDO (allowlist muerde).
- TRACE-03: `snapshot=null` → sin bloque respaldo.
- T-89-08: ningún href `javascript:` ni `data:` en el DOM.

### `app/app/proyecto/[boletin]/page.tsx`
- Importa `ValidacionFuenteSection`, `ValidacionFuenteSkeleton`, `SourceSnapshotRecord`.
- `leerSourceSnapshot(boletin)`: `.from("source_snapshot").select("content_hash, fetched_at, r2_path").eq("source","leyes").eq("resource", boletin).order("date_bucket",{ascending:false}).limit(1).maybeSingle()` — sin RPC, sin tocar PUBLIC_RPC_ALLOWLIST (T-89-09).
- `ValidacionFuenteServerSection`: server component que llama `leerProyecto` (cacheada) + `leerSourceSnapshot`, y monta `ValidacionFuenteSection`.
- Sección `<section id="validacion-fuente" className="mt-12">` montada tras `#similares`.
- `navEntries`: entrada `{ id: "validacion-fuente", label: "Valida en fuente" }` añadida.
- `RailSkeleton`: `nEntries` actualizado (7→8 OFF / 8→9 ON) para evitar CLS (WR-02).
- Honest-error #34: `leerSourceSnapshot` lanza ante error DB/red — nunca fabrica empty.

### `app/lib/types.ts`
- `ProyectoRow.prm_id_camara: string | null` añadido (mig 0058, aplicada a PROD en Plan 01).

### `scripts/validar-deeplinks.mjs`
- Node ESM, `#!/usr/bin/env node`, cero dependencias externas.
- Muestra por defecto: 12 boletines (≥10, incl. golden `14309-04` + fixture `16572-06`).
- `--muestra <json>` para inyectar muestra custom; `--smoke` para solo 3 entradas.
- `curlGet`: Senado `-sL --max-time 40 --connect-timeout 15`; Cámara `-s --max-time 25`.
- `assertResponse`: HTTP 200 + content-match del boletín base en body.
- `sleep(3000)` entre boletines (rate-limit LOCKED).
- UA identificatorio completo.
- Tabla de resultados por línea (✓/✗ + fuente + HTTP + match).
- `exit 1` si algún assert falla.
- Smoke test verificado VIVO: 14309-04 y 16572-06 Senado → HTTP 200 + match:true.

## Verification Results

- `pnpm --filter ./app test -- --run`: 85 test files, 1070 tests, **todos PASS** (incluyendo 9 nuevos de validacion-fuente).
- `pnpm --filter ./app exec tsc --noEmit`: **limpio** (sin errores).
- `node --check scripts/validar-deeplinks.mjs`: **PARSE OK**.
- Smoke test vivo (`--smoke`): HTTP 200 + content-match para 14309-04 y 16572-06 contra Senado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ProyectoRow fixture en estado-actual-block.test.tsx**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** La adición de `prm_id_camara: string | null` a `ProyectoRow` dejó el fixture `makeProyecto()` incompleto — TypeScript error TS2322.
- **Fix:** Añadido `prm_id_camara: null` al objeto base del fixture (antes del spread `...overrides`).
- **Files modified:** `app/components/estado-actual-block.test.tsx`
- **Commit:** b0960b0

## Known Stubs

Ninguno — la sección muestra datos reales del server. Cuando `prm_id_camara` no está poblado (backfill Plan 01 pendiente para años anteriores a 2024), la fila Cámara se omite honestamente (fail-honest, no stub).

## Threat Flags

Ninguno — la superficie introducida está dentro del threat_model de este plan (T-89-06 a T-89-10, todos mitigados).

## Self-Check: PASSED

- `app/components/validacion-fuente.tsx` — FOUND
- `app/components/validacion-fuente.test.tsx` — FOUND
- `scripts/validar-deeplinks.mjs` — FOUND
- Commits 210111d, b0960b0 — FOUND (`git log --oneline -5` confirma)
