---
phase: 45-leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol
plan: 02
subsystem: frontend-ficha-parlamentario
tags: [leg, resumen, above-fold, conteos, server-only, lockdown, 3-estado]
requires:
  - "createServerSupabase (app/lib/supabase.ts) — Camino A service_role"
  - "crucesPublicEnabled/moneyPublicEnabled (gates server-only)"
  - "RPCs PUBLIC_RPC_ALLOWLIST: votos/lobby/declaraciones/cruces/contratos/aportes_de_parlamentario"
  - "tablas *_ingesta_estado (NO-PII)"
provides:
  - "contarCarriles(id) server-only con React.cache() + tipo CarrilEstado 3-estado"
  - "derivarEstado({total,ingestado}) puro testeable"
  - "ResumenView({chips}) vista pura + ParlamentarioResumen({id}) server"
affects:
  - "app/app/parlamentario/[id]/page.tsx (consumidor futuro — Plan 45-03 lo cablea above-fold)"
tech-stack:
  added: []
  patterns:
    - "pure-view + server-fetch split (espejo LobbyView/LobbySection)"
    - "import server-only chokepoint (espejo cruces-gate/money-gate)"
    - "3-estado honesto dato/vacio/no_ingerido + pendiente (MONEY OFF)"
    - "gate replication V4 Access Control (resumen lista solo carriles presentes)"
key-files:
  created:
    - app/lib/parlamentario-resumen-conteos.ts
    - app/lib/parlamentario-resumen-conteos.test.ts
    - app/components/parlamentario-resumen.tsx
    - app/components/parlamentario-resumen.test.tsx
  modified: []
decisions:
  - "votos sin ingesta_estado → ingestado=true (0 votos = 'vacio', nunca 'no_ingerido': no podemos afirmar honestamente la no-ingesta de votos)"
  - "dinero MONEY ON = contratos + aportes combinados; MONEY OFF = honest-state 'pendiente' armado por el resumen"
  - "lobby cuenta identificador distinto (el RPC trae left-join por contraparte)"
  - "patrimonio cuenta filas (modelarVersiones es 1:1) — conteo = versiones"
metrics:
  duration: ~15min
  completed: 2026-06-26
---

# Phase 45 Plan 02: LEG Resumen + índice above-fold Summary

Módulo server-only `contarCarriles(id)` (React.cache, RPCs allowlisted + `.from('*_ingesta_estado')`) y resumen above-fold (`ParlamentarioResumen` server + `ResumenView` pura) que emite un chip ancla por carril presente con conteo/estado honesto 3-estado, replicando los gates cruces/money de la página.

## What Was Built

**Task 1 — `app/lib/parlamentario-resumen-conteos.ts` (+test puro):**
- `import "server-only"` línea 1 (espejo de `cruces-gate.ts:1`) + `React.cache()` para dedupe por request.
- `export type CarrilEstado` (4 variantes: `dato`/`vacio`/`no_ingerido`/`pendiente`) y `export function derivarEstado({total, ingestado})` PURA, testeada sin runtime Supabase.
- `export const contarCarriles = cache(async (id) => …)`: deriva el 3-estado de votos, lobby, patrimonio (y cruces/dinero gated) usando SOLO RPCs ya en `PUBLIC_RPC_ALLOWLIST` + `.from('lobby_ingesta_estado')`/`.from('probidad_ingesta_estado')` (NO-PII). Cada error real de RPC/`.from()` → `throw` (patrón #34), nunca degrada a vacío.
- Regla de no-ingerido replica EXACTO la de cada sección: `noIngestado = estadoData === null && total === 0` (vía `ingestado = data !== null`).
- `cruces_de_parlamentario` SOLO se invoca bajo `crucesPublicEnabled(process.env)`; los RPCs MONEY (`contratos_de_parlamentario` + `aportes_de_parlamentario`) SOLO bajo `moneyPublicEnabled(process.env)`.

**Task 2 — `app/components/parlamentario-resumen.tsx` (+test RTL):**
- Split pure-view/server-fetch: `ResumenView({chips})` PURA (sin `"use client"`, sin Supabase) + `ParlamentarioResumen({id})` async server que llama `contarCarriles` y arma los chips.
- `ChipConteo` mapea cada `CarrilEstado` a render textual DISTINTO: `dato`→n; `vacio`→"sin registros"; `no_ingerido`→"—"; `pendiente`→"pendiente" (italic). `vacio`/`no_ingerido`/`pendiente` JAMÁS muestran un dígito.
- Chips en ORDEN LOCKED con gates espejo de `page.tsx`: votos → lobby → patrimonio → `…(crucesPublicEnabled ? [#cruces] : [])` → `moneyPublicEnabled ? [#dinero] : [#financiamiento-pendiente {tipo:"pendiente"}]`.
- `<nav aria-label="Índice de secciones">`; cada chip `<a href="#<carril>">` con `min-h-11` (touch-target) y estilo dentro del DESIGN-SYSTEM (border/card, hover petróleo).

## Verification

- `cd app && pnpm test lib/parlamentario-resumen-conteos.test.ts components/parlamentario-resumen.test.tsx lib/lockdown-guard.test.ts` → 24 verde (7 + 10 + 7).
- `cd app && pnpm typecheck` → limpio.
- Suite completa `cd app && pnpm test` → **352/352 verde** (sin regresión; +17 nuevos).
- Lockdown guard (Block B) verde: el módulo nuevo solo usa RPCs allowlisted (incl. `contratos_de_parlamentario`/`aportes_de_parlamentario` ya en la lista) y `.from('*_ingesta_estado')` (NO en `PII_TABLES`); cero `.from('parlamentario')`.

## Deviations from Plan

None — plan ejecutado tal como está escrito. Decisiones de discreción documentadas en frontmatter (votos sin marcador de ingesta → `ingestado=true`; dinero ON = contratos+aportes; lobby por identificador distinto; patrimonio por versiones).

## Threat Model Compliance

- **T-45-03/06** (Elevation/Info Disclosure, conteos): `import "server-only"` línea 1 + SOLO RPCs allowlisted + `.from('*_ingesta_estado')`. Asertado por `lockdown-guard.test.ts` Block B. ✓
- **T-45-04** (Info Disclosure, ChipConteo): la vista pura recibe solo `CarrilEstado` (entero/estado); nunca proyecta columnas PII. ✓
- **T-45-05** (Tampering/gate bypass): `ParlamentarioResumen` consulta `crucesPublicEnabled`/`moneyPublicEnabled(process.env)` igual que `page.tsx`; MONEY OFF → chip `pendiente`, nunca un número ni un carril ausente. ✓

## Known Stubs

None — `contarCarriles` consulta datos reales vía RPCs; los chips reflejan el estado honesto real de cada carril.

## Notes for Next Plan (45-03)

`ParlamentarioResumen` y `contarCarriles` están listos pero AÚN SIN CONSUMIDOR en `page.tsx`. El Plan 45-03 (re-layout de la página + `CarrilAccordion`) debe:
- Insertar `<ParlamentarioResumen id={id} />` DESPUÉS de `HeaderSection` y ANTES del primer carril.
- Reutilizar `contarCarriles(id)` (deduplicado por `React.cache()`) para el heurístico de `defaultOpen` de cada `CarrilAccordion` y para el conteo del header del acordeón.
- Mantener los gates cruces/money envolviendo la `<section>` entera (el resumen ya los replica byte-a-byte).

## Self-Check: PASSED

- FOUND: app/lib/parlamentario-resumen-conteos.ts
- FOUND: app/lib/parlamentario-resumen-conteos.test.ts
- FOUND: app/components/parlamentario-resumen.tsx
- FOUND: app/components/parlamentario-resumen.test.tsx
- FOUND commit 11d078f (test: derivarEstado RED)
- FOUND commit 3e15ccd (feat: contarCarriles GREEN)
- FOUND commit 2ff5099 (test: ResumenView RED)
- FOUND commit 6503744 (feat: ParlamentarioResumen GREEN)
