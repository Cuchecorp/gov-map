---
phase: 45-leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol
verified: 2026-06-26T15:50:00Z
status: human_needed
score: 8/8 code-verifiable must-haves verified
overrides_applied: 0
human_verification:
  - test: "Build OpenNext en Docker Linux + deploy wrangler local, abrir /parlamentario/[id] en navegador real"
    expected: "La ficha carga server-rendered; cada carril es un acordeón con su <h2> visible; el toggle abre/cierra el cuerpo; el resumen above-fold muestra chips ancla que saltan al carril; el worker no devuelve 500 (Windows rompe el worker → build SÓLO en Docker Linux)"
    why_human: "Requiere build OpenNext en Docker Linux + deploy Cloudflare (checkpoint operador, creds CF fuera de .env); no observable en jsdom/CI"
  - test: "Con prefers-reduced-motion: no-preference vs reduce, observar la animación accordion-down/up del cuerpo del acordeón"
    expected: "Con no-preference, el cuerpo anima su altura (keyframes accordion-down/up); con reduce, NO anima pero igual colapsa/expande (el colapso real lo hace data-[state=closed]:hidden, la animación es no-load-bearing)"
    why_human: "Comportamiento visual de CSS @media (prefers-reduced-motion) no observable en jsdom; requiere navegador real"
---

# Phase 45: LEG Navegación (acordeones por carril + resumen/índice above-fold) Verification Report

**Phase Goal:** Transformar la ficha de parlamentario en una ficha navegable: cada carril de dominio = acordeón Radix independiente (header `<h2>` siempre visible, cuerpo colapsable) + resumen/índice above-fold con conteo/estado honesto (3-estado) y anclas, SIN romper la frontera de carril `mt-12` (DESIGN-SYSTEM §3/§8 LOCKED), el SSR (solo el toggle es cliente), ni el guard de lockdown (Camino A).

**Verified:** 2026-06-26T15:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Cada carril de dominio es un acordeón independiente (header `<h2>` siempre visible, cuerpo colapsable) | ✓ VERIFIED | `carril-accordion.tsx`: `Accordion.Root type="single" collapsible`, `Header asChild` con `<h2 className="text-xl font-semibold">` conteniendo el `Trigger`, `Content forceMount`. `page.tsx`: 7 `<section>` cada una con UN `CarrilAccordion`. Test `carril-accordion.test.tsx` 5/5 verde (h2 visible abierto/cerrado, toggle, conteo, no-leak). |
| 2 | La frontera `mt-12` nunca se colapsa; jamás dos dominios en una unidad | ✓ VERIFIED | `page.tsx`: cada carril es `<section id="…" className="mt-12">` hermana; el `mt-12` vive en la `<section>`, no en el wrapper. `page-estructura.test.ts` Test 1 (mt-12 en cada uno de los 7 carriles, `mt-12` ≥ nº carriles) + Test 2 (`<CarrilAccordion` ↔ `<section>` 1:1, página NO instancia `Accordion.Root`/`AccordionPrimitive` crudos). 5/5 verde. |
| 3 | @radix-ui/react-accordion, SSR + thin client wrapper | ✓ VERIFIED | `pnpm ls` → `@radix-ui/react-accordion@1.2.14` en dependencies. `carril-accordion.tsx` línea 1 `"use client"`; `page.tsx` es Server Component que pasa los `*Section` como children (no entran al module graph cliente). |
| 4 | Resumen + índice above-fold: un chip por carril presente, conteo/estado honesto 3-estado, ancla al carril | ✓ VERIFIED | `parlamentario-resumen.tsx`: `ResumenView` pura + `ParlamentarioResumen` server; `<nav aria-label="Índice de secciones">` con `<a href="#votos|#lobby|#patrimonio|…">`; `ChipConteo` mapea `dato`→n, `vacio`→"sin registros", `no_ingerido`→"—", `pendiente`→italic (jamás dígito en no-dato). Gates cruces/money replicados. Tests `parlamentario-resumen.test.ts` (10) + `parlamentario-resumen-conteos.test.ts` (7) verdes. |
| 5 | Sin `.from('parlamentario')` ni RPC fuera del allowlist; guard verde | ✓ VERIFIED | `pnpm test lib/lockdown-guard.test.ts` → 7/7 verde. `parlamentario-resumen-conteos.ts` usa SOLO RPCs allowlisted (votos/lobby/declaraciones/cruces/contratos/aportes) + `.from('lobby_ingesta_estado')`/`.from('probidad_ingesta_estado')` (NO-PII). Grep `.from('parlamentario')` en código = sólo aparece en prosa del docstring (línea 16), no en código. |
| 6 | SSR intacto (solo el toggle es cliente) | ✓ VERIFIED | `carril-accordion.tsx` es la única isla `"use client"`; no importa ninguna `*Section` ni `@/lib/supabase`/`createServerSupabase` (grep = sin matches; test no-leak behavior 5 verde). `forceMount` deja el contenido server-rendered en el HTML aunque el carril esté cerrado. Lectura de datos sigue en server (`contarCarriles` es `import "server-only"`). |
| 7 | Default colapsa carriles vacíos/ralos | ✓ VERIFIED | `page.tsx` `abrePorDefecto(estado)` retorna `estado.tipo === "dato"` (abre SOLO total>0); `vacio`/`no_ingerido`/`pendiente` arrancan colapsados. `financiamiento-pendiente` siempre `defaultOpen={false}`. |
| 8 | Suite `app/` verde + `tsc -b` limpio | ✓ VERIFIED | `pnpm test` → 357/357 verde (40 archivos). `pnpm typecheck` (`tsc --noEmit`) → limpio, sin errores. |

**Score:** 8/8 code-verifiable must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/components/carril-accordion.tsx` | Isla cliente Radix, h2 header, forceMount, no-leak | ✓ VERIFIED | `"use client"`, `AccordionPrimitive.Root/Item/Header/Trigger/Content forceMount`, h2 en header, sin imports de Section/supabase. WIRED (importado en `page.tsx`). |
| `app/components/parlamentario-resumen.tsx` | ResumenView pura + ParlamentarioResumen server, chips ancla 3-estado | ✓ VERIFIED | Split puro/server, `<nav>` con `<a href="#…">`, ChipConteo 3-estado. WIRED (importado en `page.tsx`). |
| `app/lib/parlamentario-resumen-conteos.ts` | server-only + React.cache, RPCs allowlisted, `.from('*_ingesta_estado')` | ✓ VERIFIED | `import "server-only"` línea 1, `cache()`, derivarEstado puro, sólo RPCs allowlisted + `*_ingesta_estado`. WIRED (consumido por resumen + page). |
| `app/app/parlamentario/[id]/page.tsx` | Re-layout: resumen above-fold + cada carril en CarrilAccordion | ✓ VERIFIED | Resumen tras HeaderSection antes de #votos; 7 `<section mt-12>` cada una con un CarrilAccordion; gates cruces/money envuelven la section entera. |
| `app/app/parlamentario/[id]/page-estructura.test.ts` | Source-scan invariantes LOCKED | ✓ VERIFIED | 5/5 verde (mt-12, 1×dominio, gates, resumen-antes-carril, no-leak). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `page.tsx` | `CarrilAccordion` | import + 7 instancias envolviendo cada `<section>` | ✓ WIRED | Cada carril pasa `titulo`/`conteo`/`defaultOpen` + Section como children. |
| `page.tsx` | `ParlamentarioResumen` | import + `<Suspense>` above-fold | ✓ WIRED | Insertado tras HeaderSection, antes de #votos. |
| `page.tsx` / resumen | `contarCarriles` | `await contarCarriles(id)` (React.cache dedupe) | ✓ WIRED | Alimenta conteo del header + defaultOpen + chips del resumen, una sola lectura. |
| `contarCarriles` | RPCs allowlisted + `*_ingesta_estado` | `sb.rpc()` / `sb.from()` server-only | ✓ WIRED | Datos reales; errores se lanzan (patrón #34), nunca degradan a vacío. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ParlamentarioResumen` | `c = contarCarriles(id)` | RPCs allowlisted + `*_ingesta_estado` (service_role, Camino A) | Sí — RPCs reales, conteo derivado del total real | ✓ FLOWING |
| `page.tsx` headers | `conteos = contarCarriles(id)` | igual (React.cache compartido) | Sí | ✓ FLOWING |

Nota: la animación es no-load-bearing; el colapso real lo hace `data-[state=closed]:hidden`. El honest-state `pendiente` (MONEY OFF) es contrato gated existente, no stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Suite completa verde | `pnpm test` | 357/357 (40 archivos) | ✓ PASS |
| Typecheck limpio | `pnpm typecheck` (`tsc --noEmit`) | sin errores | ✓ PASS |
| Lockdown guard verde | `pnpm test lib/lockdown-guard.test.ts` | 7/7 | ✓ PASS |
| Dep instalada versión exacta | `pnpm ls @radix-ui/react-accordion` | 1.2.14 | ✓ PASS |

### Probe Execution

No aplica — fase frontend (no migración/CLI); sin probes `scripts/*/tests/probe-*.sh` declarados en PLAN/SUMMARY. Verificación cubierta por la suite vitest + tsc.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LEG-01 | 45-01, 45-03 | Cada carril = acordeón independiente, h2 header siempre visible, mt-12 nunca colapsa, Radix + thin client wrapper | ✓ SATISFIED | Truths 1-3; `carril-accordion.tsx` + `page.tsx` + tests estructural/unit verdes |
| LEG-02 | 45-02 | Resumen+índice above-fold, chip por carril, 3-estado honesto, ancla | ✓ SATISFIED | Truth 4; `parlamentario-resumen.tsx` + `parlamentario-resumen-conteos.ts` + tests verdes |
| LEG-03 | 45-02, 45-03 | Comportamiento-preservante: sin `.from('parlamentario')`/RPC no-allowlist (guard verde), SSR intacto, default colapsa ralos, suite verde + tsc limpio; build Docker Linux | ✓ SATISFIED (código) / ⚠ build Docker = human | Truths 5-8; guard 7/7, suite 357/357, tsc limpio. Build Docker Linux + deploy = checkpoint operador (human_verification) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (ninguno) | — | — | — | Sin TBD/FIXME/XXX en archivos de la fase; sin stubs (datos reales vía RPCs); sin `return null`/empty data hollow. El honest-state `pendiente` es contrato gated documentado, no stub. |

### Human Verification Required

Estos ítems NO son gaps — requieren navegador real / build OpenNext Docker Linux, fuera del alcance del agente (el plan se declara completo con suite verde + tsc + lockdown; el deploy es checkpoint operador explícito).

#### 1. Build OpenNext (Docker Linux) + deploy + render en navegador

**Test:** Build OpenNext en Docker Linux, deploy wrangler local, abrir `/parlamentario/[id]` en navegador real.
**Expected:** Ficha server-rendered; cada carril es un acordeón con `<h2>` visible; el toggle abre/cierra el cuerpo; el resumen above-fold muestra chips ancla que saltan al carril; el worker no devuelve 500.
**Why human:** Requiere build Docker Linux (Windows rompe el worker → 500) + deploy Cloudflare (creds CF fuera de `.env`); no observable en CI/jsdom.

#### 2. Animación con prefers-reduced-motion

**Test:** Con `prefers-reduced-motion: no-preference` vs `reduce`, observar la animación accordion-down/up al expandir/colapsar.
**Expected:** Con no-preference anima la altura del cuerpo; con reduce no anima pero igual colapsa/expande (colapso real vía `data-[state=closed]:hidden`).
**Why human:** Comportamiento de `@media (prefers-reduced-motion)` no observable en jsdom; requiere navegador real.

### Gaps Summary

No hay gaps de código. Las 8 must-haves verificables por código están VERIFIED: los tres requisitos (LEG-01/02/03) están implementados y cableados, la suite `app/` corre 357/357 verde, `tsc --noEmit` está limpio, el lockdown-guard pasa 7/7 (sin `.from('parlamentario')` ni RPC fuera del allowlist), el SSR se preserva (única isla cliente = `carril-accordion.tsx`, sin imports de Section/Supabase), la frontera `mt-12` permanece en cada `<section>` hermana con un acordeón por dominio (1:1), y el default colapsa carriles ralos.

El estado es **human_needed** (no passed) porque el cierre del requisito LEG-03 ("build validado en Docker Linux") y la verificación visual de la animación `prefers-reduced-motion` sólo se pueden confirmar con build/deploy OpenNext en Docker + navegador real — checkpoint de operador documentado en el SUMMARY 45-03, no un gap.

---

_Verified: 2026-06-26T15:50:00Z_
_Verifier: Claude (gsd-verifier)_
