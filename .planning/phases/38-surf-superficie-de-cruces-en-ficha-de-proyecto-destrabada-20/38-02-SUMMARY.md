---
phase: 38-surf-superficie-de-cruces-en-ficha-de-proyecto-destrabada-20
plan: 02
subsystem: cruces-superficie-frontend
tags: [rsc, degrade-honesto, anti-insinuacion, pii-safe, camino-a, suspense]
requires:
  - "CruceProyectoRow PII-safe (app/lib/types.ts — Plan 01)"
  - "RPC cruces_de_proyecto(text) — ESCRITA (apply = checkpoint operador Plan 03)"
  - "DetalleColapsable triggerVariant primary (F55)"
  - "crucesPublicEnabled (Candado B, ON en PROD desde 2026-07-02)"
provides:
  - "CrucesView (pura, testeable) + CrucesSection (Server Component, degrade PGRST202→null)"
  - "<section id=cruces> cableada en /proyecto/[boletin] tras #lobby-tramitacion, gated Candado B"
  - "rail entry Cruces ◆ (marker diamante) gated"
  - "CrucesSkeleton local (fallback Suspense anti-CLS)"
affects:
  - "Plan 03 (apply operador de 0049 → la sección pasa de degrade→null a montada con datos)"
tech-stack:
  added: []
  patterns:
    - "Degrade honesto 3 caminos espejo de lobby-en-tramitacion.tsx:248-276 (PGRST202→null, otro→throw, 0 filas→empty)"
    - "Disclosure progresivo DENTRO de CrucesView (DetalleColapsable primary sobre datos ya fetcheados — cero lazy-fetch)"
    - "Rail entry + <section> gated por el MISMO crucesPublicEnabled (sin ancla muerta pre-apply)"
    - "DEPARTURE LOCKED: parlamentario público = LINK; contraparte de lobby = texto plano + IdentityMarker (52-03)"
key-files:
  created:
    - app/components/cruces-de-proyecto.tsx
    - app/components/cruces-de-proyecto.test.tsx
    - app/app/proyecto/[boletin]/page-cruces.test.ts
  modified:
    - app/app/proyecto/[boletin]/page.tsx
decisions:
  - "Degrade honesto espejo de lobby-en-tramitacion (NO de cruces-de-parlamentario): SOLO error.code==='PGRST202'→null; cualquier otro error→throw (#34). Un regex de mensaje tragaría 'column ... does not exist' (WR-01) — prohibido"
  - "Disclosure primary vive DENTRO de CrucesView (no en la page): las filas ya fetcheadas van en DetalleColapsable primary 'Explorar los N cruces'; la page solo monta <CrucesSection boletin/>, sin duplicar triggers"
  - "Rail entry de cruces GATED por crucesPublicEnabled (además de la <section>): sin el gate ni el ancla ni el target de scrollspy existen — sin ancla muerta pre-apply. Consistente con 38-UI-SPEC §6"
  - "ProvenanceBadge capturedAt = new Date(row.fecha_captura) (nivel señal, frescura del rebuild — WR-02/F41), NUNCA item.fecha (fecha de la reunión, que marcaría stale-amber falso)"
  - "Caveat anti-causal LOCKED exactamente 1× por render (constante compartida CAVEAT_CRUCES); línea de voto y conteo de reuniones SEPARADAS, nunca un <li> ni frase causal"
metrics:
  duration_min: 11
  tasks: 3
  files: 4
  completed: "2026-07-08T02:12:00Z"
---

# Phase 38 Plan 02: Superficie frontend de cruces en la ficha de proyecto Summary

`CrucesView` (pura, testeable) + `CrucesSection` (Server Component con degrade honesto PGRST202→null) que yuxtaponen, en la ficha de un proyecto, los parlamentarios que votaron A FAVOR del boletín con sus reuniones de lobby en el sector del proyecto — nombre del parlamentario como LINK a `/parlamentario/[id]`, contraparte de lobby en texto plano + IdentityMarker, caveat anti-causal 1× y conteo neutro — cableada como carril hermano `mt-12` tras `#lobby-tramitacion`, gated en Candado B, con rail entry "Cruces ◆" y `CrucesSkeleton` de fallback, cubierta por RTL (capa-1/2, empty, degrade, throw, negative-match).

## What Was Built

- **`app/components/cruces-de-proyecto.tsx`** — `CrucesView({ rows })` PURA + `CrucesSection({ boletin })` async, sin `"use client"`. La vista hereda la gramática F55: marco petróleo `border-[1.5px] border-accent-product` capa-1 con `<h2>` petróleo "Cruces con el sector del proyecto" + conteo 3-estado Mono ("{N} parlamentarios" / "sin registros") + intro factual LOCKED + caveat 1×, y las filas por parlamentario DENTRO de `<DetalleColapsable triggerVariant="primary" triggerLabel="Explorar los N cruces">` (disclosure inverso, arranca colapsado, datos ya fetcheados). Cada `GrupoParlamentario`: nombre `formatNombre` como `<a href="/parlamentario/{id}">` (DEPARTURE LOCKED), línea de voto SEPARADA "Votó a favor de este proyecto", encabezado neutro `encabezadoReuniones` (singular "1 reunión"; `tipo_senal` desconocido → "{n} registros en el sector {etiqueta}"), evidencia con `ContraparteCruda` (texto plano + IdentityMarker, 52-03) y `ProvenanceBadge` (`capturedAt=new Date(row.fecha_captura)`, `sourceUrl=item.enlace_fuente`, key con índice). `CrucesSection` = espejo del degrade de `lobby-en-tramitacion.tsx`: `error?.code==='PGRST202'`→null, otro error→throw, `data ?? []`→`CrucesView`.
- **`app/components/cruces-de-proyecto.test.tsx`** — 11 tests. `CrucesView` (fixtures `CruceProyectoRow[]`): capa-1/2 con nombre linkeado + caveat 1× + voto + conteo, conteo 3-estado, singular, empty honesto sin dígito fabricado + "sin registros", `tipo_senal` degradado, negative-match anti-insinuación (regex banned-vocab + sin RUT), contraparte plana + IdentityMarker no-enlazada. `CrucesSection` (mock `sb.rpc`): PGRST202→null, 42P01→throw, filas→link, 0 filas→empty.
- **`app/app/proyecto/[boletin]/page.tsx`** — import de `CrucesSection` + `crucesPublicEnabled`; `<section id="cruces" className="mt-12 scroll-mt-6">` (Suspense + `CrucesSkeleton`) envuelta en `crucesPublicEnabled(process.env)`, insertada entre `#lobby-tramitacion` y `#idea-matriz`; rail entry `{ id:"cruces", label:"Cruces", marker:"diamante" }` GATED por el mismo flag tras la entrada de lobby; `CrucesSkeleton` local shape-matched al marco petróleo (anti-CLS).
- **`app/app/proyecto/[boletin]/page-cruces.test.ts`** — 8 tests source-scan: presencia del tag `<section id="cruces" mt-12 scroll-mt-6>`, placement DOM entre lobby e idea-matriz, gate `&& (` antes del tag real, import + montaje de `CrucesSection`, rail entry diamante tras lobby, rail entry gated, `CrucesSkeleton` local, sin disclosure duplicado en la page.

## Verification

- `pnpm exec vitest run cruces-de-proyecto` → 11/11 verde.
- `pnpm exec vitest run page-cruces` → 8/8 verde.
- `pnpm exec tsc -b` → limpio (exit 0).
- `pnpm test` → **689/689 verde** (66 files) — baseline 670 mantenido + 19 nuevos, nunca menos.
- Negative-match anti-causal verde sobre el render de `CrucesView` (regex del `<interfaces>`).
- Degrade PGRST202→null verificado por RTL con mock de `sb.rpc`; 42P01→throw; 0 filas→empty honesto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Rail entry de cruces gated por crucesPublicEnabled**
- **Found during:** Task 3
- **Issue:** El plan (Task 3 action) pedía añadir la entrada de rail sin especificar gating, pero un rail entry incondicional con la `<section>` gated OFF dejaría un ancla `#cruces` muerta (target de scrollspy inexistente) pre-apply.
- **Fix:** El spread condicional `...(crucesPublicEnabled(process.env) ? [{...}] : [])` gatea el rail entry con el MISMO flag que la sección — consistente con 38-UI-SPEC §6 ("Gate `crucesPublicEnabled` wraps the entire `<section>` + rail entry"). Sin ancla muerta.
- **Files modified:** app/app/proyecto/[boletin]/page.tsx
- **Commit:** bce555e

## Threat Flags

None — la sección consume solo `CruceProyectoRow` (sin partido/rut/email); el parlamentario público se enlaza (DEPARTURE LOCKED), la contraparte de lobby queda plana + IdentityMarker (52-03). `CrucesSection` es Server Component (service_role nunca al navegador); `DetalleColapsable` recibe el detalle como `children` y no importa `@/lib/supabase` (contrato F45 no-leak). Cero superficie nueva fuera del threat register (T-38-05..08 mitigados; T-38-SC accept: cero deps nuevas).

## Notes for Next Plan

- Plan 03 (checkpoint operador): aplicar 0049 a PROD con `psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0049_cruces_de_proyecto.sql` (PGCLIENTENCODING=UTF8 en Windows) + correr el pgTAP post-apply. Antes del apply, `CrucesSection` degrada a `null` (PGRST202) sin 500; el wrapper `mt-12` persiste (frontier). Tras el apply, la sección se monta con datos (demo con filas = **14309-04**, 47 parlamentarios; empty honesto = **14782-13**).
- El flag `CRUCES_PUBLIC_ENABLED` YA está ON en PROD (2026-07-02) — el único gate restante es el apply de la RPC (Candado A datos).

## Self-Check: PASSED

- Files: 4/4 FOUND (cruces-de-proyecto.tsx, cruces-de-proyecto.test.tsx, page-cruces.test.ts, page.tsx modificado).
- Commits: 3/3 FOUND (c8985e2, 0e00113, bce555e).
