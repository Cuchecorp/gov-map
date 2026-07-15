# Phase 84: DEUDA-CERO + Revisión Completa — Research

**Researched:** 2026-07-15
**Domain:** Deuda técnica registrada (v8.0/v7.x/v6.x) + revisión code-level del sitio; disposición por ítem
**Confidence:** HIGH (todo verificado contra código/reviews del repo; cero dependencia de fuentes externas)

## Summary

Phase 84 satisface **DEMO-03**: inventariar TODA la deuda técnica registrada + una revisión completa code-level del sitio, y para cada ítem proponer disposición (cerrar-ahora / convertir-en-test / documentar-con-razón / operador). Es una fase de **cierre de deuda**, no de features. READ-ONLY en research; los edits los hace el plan.

El hallazgo rector es que la deuda registrada del audit v8.0 es **pequeña y en su mayoría cerrable barato**, pero la revisión code-level destapa un ítem **mayor que la deuda registrada minimizaba**: el "landmine" IN-02 de Phase 76 (`-[--var]` shorthand pre-v8) no es teórico — es el **mismo defecto CR-01** (probado por el reviewer compilando con el plugin del repo: `bg-[--camara]` → `background-color: --camara;`, inválido, descartado por el browser). Estos componentes (`camara-chip`, `provenance-badge`, `contratos-*`, `aportes-*`, `voto-detalle`, `votos-por-parlamentario`, `financiamiento`) **se montan en rutas públicas** (`/parlamentario/[id]`, `/proyecto/[boletin]`, `/contraparte/[id]`) → los chips cívicos y badges de procedencia probablemente renderizan **sin color de fondo/borde** en vivo. Esto es deuda funcional, no cosmética menor.

El segundo hallazgo: el **test de contraste de la barra cívica dark** (única deuda de código del audit v8.0) es trivial de escribir y **verde de entrada** — los valores actuales pasan WCAG 1.4.11 (Cámara 5.63:1, Senado 4.80:1 sobre `--card` dark `222 24% 12%`, umbral 3:1). Convertir esa deuda en un unit test de luminancia (sin browser) es S/riesgo-bajo → cerrar-ahora.

**Primary recommendation:** Cerrar-ahora (1) el test de contraste de la barra cívica (verde de entrada, bloquea regresión), (2) la migración mecánica del shorthand `-[--var]` → `-[var(--var)]` en los ~9 componentes legacy + extender el guard cero-hex/tipografía para cazarlo repo-wide (barato: el detector genérico WR-01 ya existe), (3) IN-01 padding header/footer. Documentar-con-razón la deuda P3 de `/red` (island pixel-LOCKED, gate 75 cerrado + operador-aprobado → NO tocar). Clasificar como **operador** el CLOUDFLARE_API_TOKEN, rotación DB password B26, y todos los gates v7.0 (RUT/MONEY/backfills).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Test contraste barra cívica | Test infra (unit) | Frontend tokens | Luminancia WCAG es matemática pura sobre valores HSL de `civic-tokens.css` — computable sin DOM/browser |
| Shorthand `-[--var]` → `-[var()]` | Frontend (React/Tailwind) | — | Utilidades Tailwind en componentes; fix de clase de string, sin lógica |
| Guard repo-wide `-[--` | Test infra (source-scan) | CI | El guard ya escanea archivos como texto; ampliar el glob de superficies |
| IN-01 padding header/footer | Frontend (layout chrome) | — | Clases de contenedor en `layout.tsx`/`global-header.tsx` |
| /red curvas seed-card | Frontend (island `/red`) | — | SVG geometry en `red-graph.tsx` — LOCKED, no tocar |
| CLOUDFLARE_API_TOKEN, DB pwd | Operador (dashboard/secrets) | — | Acceso a GH settings / Supabase dashboard; no agent-executable |

## User Constraints (from REQUIREMENTS.md — no hay CONTEXT.md aún)

### Locked (de DEMO-03 y Out of Scope v8.1)
- **DEMO-03**: cada ítem de deuda **cerrado o documentado con razón**. Cubre: tech debt del audit v8.0 (contraste dark con test de ratio), deuda P3 de `/red` **si es code-side barata**, y hallazgos de la revisión completa (rutas, estados vacíos, textos).
- **OUT OF SCOPE**: gates legales/operador v7.0 (RUT-01 write, flip MONEY) → son del operador (`HANDOFF-v7.0-operator-gates.md`); datos inventados en "Votado esta semana"; **re-layout de rutas interiores → v9**.
- **Invariantes v8.0 (audit líneas 67-69)**: Copy LOCKED intacto · cero strings del mockup · **cero hex en superficies bento** · gates `*_PUBLIC_ENABLED` intocados · **island `/red` pixel-intocable** · empty states honestos · CERO DDL · server-only intacto.

### Claude's Discretion
- Diseño del test de contraste (dónde vive, cómo parsea `civic-tokens.css`).
- Estrategia de fix del shorthand (`-[var(--x)]` mecánico vs registrar en `@theme inline` + utilidad plana). Research recomienda el mecánico por menor diff/riesgo.
- Qué superficies añadir al guard repo-wide.

### Deferred (v9)
- Re-layout de rutas interiores. Cualquier ítem que requiera re-layout (no fix mecánico) se **documenta-con-razón**, no se ejecuta.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEMO-03 | Deuda técnica registrada eliminada o convertida en test (audit v8.0 contraste dark, deuda P3 /red si code-side barata, hallazgos revisión completa) — cada ítem cerrado o documentado con razón | Inventario completo abajo con disposición/esfuerzo/riesgo por ítem; test de contraste diseñado y pre-verificado verde; shorthand landmine cuantificado (~15 usos/9 archivos, probado como defecto real); /red P3 evaluado como no-code-barato → documentar |

---

## Inventario de Deuda — Tabla Maestra (ítem → disposición → esfuerzo)

| # | Ítem | Origen | Esfuerzo | Riesgo | Disposición |
|---|------|--------|----------|--------|-------------|
| D1 | **Contraste barra cívica dark sin test de ratio** | audit v8.0 / 80-REVIEW; `civic-tokens.css` | S | Bajo | **cerrar-ahora → convertir-en-test** (verde de entrada) |
| D2 | **IN-02: `-[--var]` shorthand en ~9 componentes legacy (defecto CSS real en vivo)** | 76-REVIEW IN-02 (elevado a defecto por esta revisión) | M | Bajo-Medio | **cerrar-ahora** (fix mecánico + guard repo-wide) |
| D3 | **IN-01: padding header/footer divergente (<md)** | 76-REVIEW IN-01 | S | Bajo | **cerrar-ahora** |
| D4 | **Deuda P3 /red: curvas juntas en esquina de seed-card** | memoria 2026-07-13 | M-L | Alto (island LOCKED) | **documentar-con-razón** (NO tocar island) |
| D5 | **Typography island `.net-*`** | memoria v6.1/v6.0 | — | — | **YA resuelto en Phase 75** (`.net-*` swap pixel-idéntico); solo queda gate visual operador |
| D6 | **UAT rotate /red** | memoria v6.1 | — | — | **operador** (gate visual real-deploy, `getComputedStyle`) |
| D7 | **CLOUDFLARE_API_TOKEN + ACCOUNT_ID faltantes en GH** | HANDOFF v7.0 / 74-DEBT-03 | S (operador) | — | **operador** (dashboard GH settings; YAML ya correcto) |
| D8 | **Rotar DB password B26** | HANDOFF v7.0 / 75-NOTE | S (operador) | — | **operador** (Supabase dashboard; blast radius = solo `SUPABASE_DB_URL`, 0 workflows) |
| D9 | **Gates v7.0: RUT-01 write, flip MONEY, backfills, applies 0052-0054** | HANDOFF v7.0 | — | — | **operador/legal — OUT OF SCOPE v8.1** |
| D10 | **cursor leylobby / lobby `--from-r2` / source_snapshot multi-fuente** | memoria/HANDOFF | — | — | **Phase 83** (DEMO-02 crons) — no duplicar aquí |
| D11 | **Guard tipografía WR-01/WR-02/WR-03 (falsos negativos)** | 80-REVIEW | — | — | **YA resuelto en Phase 80** (80-REVIEW-FIX, commit 35d0730, 27/27) |
| D12 | **TODOs/FIXMEs/HACKs en `app/` y `packages/`** | revisión completa | — | — | **CERO reales** (ver hallazgo abajo) |
| D13 | **IN-01..IN-04 restantes de 80-REVIEW (whitelist muerta, collapse regex, negación exact-string, size/hex boundary)** | 80-REVIEW Info tier | S c/u | Bajo | **cerrar-ahora selectivo** (los S/riesgo-bajo) o **documentar-con-razón** |

**Regla de la fase:** los "cerrar-ahora" (D1, D2, D3, y D13 selectivo) son todos S/M con riesgo bajo. D4 es M-L y toca un island LOCKED → NO califica para cerrar-ahora → documentar-con-razón (consistente con el invariante "island `/red` pixel-intocable" y con "re-layout → v9").

---

## Hallazgos Detallados

### D1 — Test de contraste de la barra cívica dark (cerrar-ahora → test)

**Estado:** Único ítem de **código** del tech_debt v8.0 (audit líneas 14-18). La barra cívica 3px (`bg-[var(--camara)]`/`bg-[var(--senado)]` en `actualidad-module.tsx`) usa pares dark PROVISIONALES en `civic-tokens.css`, verificados solo visualmente en el gate 81. No existe test de ratio (grep de "contraste/luminanc/WCAG/ratio" en `bento-guards.test.ts` → 0 resultados). `[VERIFIED: grep]`

**El test es computable sin browser.** WCAG 1.4.11 (non-text contrast, umbral 3:1) se calcula con luminancia relativa sobre HSL → sRGB. Cálculo ejecutado sobre los valores reales:

| Par | Valores (HSL) | vs fondo | Ratio | Umbral 3:1 |
|-----|---------------|----------|-------|-----------|
| Cámara dark | `213 90% 62%` | `--card` dark `222 24% 12%` | **5.630** | ✅ PASA |
| Senado dark | `355 70% 62%` | `--card` dark `222 24% 12%` | **4.800** | ✅ PASA |
| Cámara light | `213 94% 38%` | blanco | 6.725 | ✅ (referencia) |
| Senado light | `355 65% 38%` | blanco | 7.616 | ✅ (referencia) |

`[VERIFIED: cálculo WCAG en node sobre valores de civic-tokens.css + globals.css:46]`

**Implicación:** el test es **verde de entrada** — no destapa un problema; **congela** los valores actuales y bloquea regresión futura (si alguien baja la L del par dark por debajo de 3:1, CI falla). Esto convierte la deuda "PROVISIONAL sin test" en "test-locked". Effort S, riesgo bajo → cerrar-ahora.

**Diseño recomendado del test (para el plan):**
- Parsear `--camara`, `--senado` (bloque `.dark`) y `--card` (bloque `.dark` de `globals.css`) desde el CSS como texto (regex sobre `hsl(H S% L%)`), NO hardcodear — así el test sigue al token si cambia.
- Función pura `hslToRgb` → `relativeLuminance` → `contrastRatio` (fórmula WCAG estándar; ~15 líneas).
- Assert `ratio(camaraDark, cardDark) >= 3` y `ratio(senadoDark, cardDark) >= 3`.
- Ubicación natural: nuevo `app/lib/civic-contrast.test.ts` (o dentro de `bento-guards.test.ts` como bloque). Vitest, sin jsdom necesario (matemática pura).
- **Gotcha:** el wrapper `hsl()` está horneado en el valor del token (consumidor usa `bg-[var(--camara)]` sin envolver) — el parser debe leer el triplete de DENTRO del `hsl(...)`.

### D2 — Shorthand `-[--var]` landmine = defecto CSS real en vivo (cerrar-ahora)

**Esto NO es teórico.** El reviewer de Phase 76 compiló estas clases exactas con el propio `@tailwindcss/postcss` del repo (Tailwind **4.3.1**, verificado en `app/package.json:51`) y confirmó ground-truth: `bg-[--camara]` → `background-color: --camara;` — un valor bare inválido que **el browser descarta → cae a sin-color**. El mismo defecto que CR-01 (que rompía el radius del tile) y que el fix documentado en `identity-marker.test.tsx` ("compilaba a CSS inválido y dejaba el marker sin su fondo/texto/borde ámbar"). `[VERIFIED: 76-REVIEW.md CR-01/IN-02 + identity-marker.test.tsx + npm view tailwindcss]`

**Inventario de usos vivos (grep `-\[--[a-z]` en `app/**/*.tsx`):** ~15 ocurrencias en 9 componentes:

| Componente | Clases afectadas | ¿Ruta pública? |
|------------|------------------|----------------|
| `camara-chip.tsx:28,32,53,54` | `bg-[--camara]`, `bg-[--senado]`, `bg-[--camara-muted]`, `text-[--camara-muted-foreground]`, `bg-[--senado-muted]`, `text-[--senado-muted-foreground]` | **SÍ** — `/parlamentario/[id]`, `/proyecto/[boletin]`, `/contraparte/[id]` |
| `provenance-badge.tsx:43,48` | `border-[--provenance-border]`, `bg-[--provenance-bg]`, `text-[--provenance-fg]`, `bg-[--provenance-fg]` | **SÍ** (badge de frescura, ubicuo) |
| `aportes-por-contraparte.tsx:123` | `border-[--primary]` | SÍ (gated MONEY) |
| `contratos-de-parlamentario.tsx:101` | `border-[--primary]` | SÍ (gated MONEY) |
| `contratos-por-contraparte.tsx:109` | `border-[--primary]` | SÍ (gated MONEY) |
| `financiamiento-de-parlamentario.tsx:141` | `border-[--primary]` | SÍ (gated MONEY) |
| `voto-detalle.tsx:46` | `border-[--accent-product]` | SÍ (votos) |
| `votos-por-parlamentario.tsx:638` | `border-[--accent-product]` | SÍ (votos) |

`[VERIFIED: grep + usage grep]`

**Severidad:** los chips cívicos Cámara/Senado (identidad institucional del proyecto) y los badges de procedencia (principio rector "trazabilidad a la fuente") renderizan **sin su color** en vivo. Alto valor de cierre para un "demo perfecto".

**Fix recomendado (mecánico, menor diff, menor riesgo):** `bg-[--x]` → `bg-[var(--x)]` en cada uno. Alternativa (registrar `--color-camara` etc. en `@theme inline` + utilidad plana `bg-camara`) es más limpia a largo plazo pero mayor diff y toca `globals.css` (donde ya viven `identity-warn-*` y `accent-product-soft`). Para DEMO-03 el mecánico basta y es reversible por clase.

**Guard repo-wide (barato):** el detector genérico ya existe post-80 (`/(?<![\w-])[a-z][\w-]*-\[[^\]]+\]/g` en `bento-guards.test.ts`, que permite `[var(--…)]` y falla ante otros arbitrary). Hoy solo escanea `SUPERFICIES_CERO_HEX`/`SUPERFICIES_TIPOGRAFIA` (4-5 archivos bento). Extender: añadir un scan que falle ante `-[--` (shorthand crudo, NO `-[var(--`) sobre **todo** `app/components/**` — reutiliza la misma infra de lectura de archivos como texto. Effort S. Esto cierra la clase de defecto permanentemente (recurrió 3 veces: identity-marker, CR-01 tile, estos 9). `[VERIFIED: bento-guards.test.ts source]`

- **Warning de scope:** después del fix mecánico, la migración a `[var(--)]` hace pasar el guard; verificar que el guard distingue `-[var(--x)]` (permitido) de `-[--x]` (prohibido) — el detector actual ya lo hace (permite `[var(--…)]`).

### D3 — IN-01 padding header/footer divergente (cerrar-ahora)

Header usa `px-6 py-3`; footer usa `px-4 md:px-8 py-8` (`layout.tsx:50` vs `global-header.tsx:34`). Ambos `max-w-[1120px] mx-auto` → alineados en anchos amplios pero divergen bajo `md` (header 24px, footer 16px). No es defecto de runtime; es inconsistencia de chrome que el 76-REVIEW explícitamente difirió a "la pasada visual de 79/81". `[VERIFIED: 76-REVIEW IN-01]` Fix: alinear el gutter del footer al `px-6` del header (o clase de contenedor compartida). Effort S, riesgo bajo. **Cerrar-ahora** — es exactamente el tipo de inconsistencia de texto/layout que DEMO-03 pide reconciliar.

### D4 — Deuda P3 /red: curvas juntas en esquina de seed-card (documentar-con-razón)

La geometría de aristas en `red-graph.tsx:378-392` ya reparte la salida verticalmente por el borde derecho del seed (`sy = sr.top + pad + span*k/(n-1)`, `pad=18`, comentario "NUNCA convergen a un punto"). El P3 de la memoria (2026-07-13) es que, con hasta 10 vecinos por página y una seed-card corta, los puntos de salida se apiñan dentro de la altura de la card. `[VERIFIED: red-graph.tsx source]`

**Disposición: documentar-con-razón, NO tocar.** Razones (todas LOCKED):
1. Invariante v8.0: **"island `/red` pixel-intocable"** (audit línea 69).
2. Gate 75 `/red` visual **cerrado + operador-aprobado** ("aprobado", memoria 2026-07-13); UAT rotate pendiente = operador.
3. Un fix real (repartir sobre la altura del contenedor en vez de la card, o escalar `pad`) es **re-layout de la geometría del island**, no un tweak trivial → cae bajo "re-layout → v9" (OUT OF SCOPE) y bajo la regla de que "cerrar-ahora" exige S/M-riesgo-bajo. Effort M-L, riesgo Alto.

DEMO-03 explícitamente condiciona /red a **"si es code-side barata"** → no lo es → documentar.

### D12 — TODOs/FIXMEs/HACKs (CERO reales — hallazgo limpio)

Grep de `TODO|FIXME|HACK|XXX` en `app/components/**` y `packages/**`:
- **app/**: los ~11 hits son "TODO" español (=todo/cada), p.ej. "el detalle lista TODO", "TODOS los vecinos". Un solo `// TODO.` (tramitacion-stepper:166) es también parte de la frase "el detalle lista TODO." (no un marcador). **Cero marcadores reales.** `[VERIFIED: grep + lectura de contexto]`
- **packages/**: solo `@ts-expect-error` en archivos `*.test-d.ts`/`*.test.ts` — son **gates de compilación intencionales** (branded types RUT/enlace/voto), NO deuda. `[VERIFIED: grep]`
- `@ts-ignore`: 0. `eslint-disable`: hits son en tests/CSS, no supresiones de lógica.

**El código está limpio de deuda-por-marcador.** Reportarlo así es un hallazgo valioso: la revisión "completa del sitio" no destapa un basurero de TODOs.

### D13 — Info tier restante de 80-REVIEW (cerrar-ahora selectivo)

De 80-REVIEW, WR-01/02/03 YA fueron fixed (80-REVIEW-FIX). Quedan Info:
- **IN-01 (whitelist muerta `h-[52px]`/`w-[1120px]`)**: ya documentada como "future scope" en el docstring del guard (comentario IN-01 presente). **documentar** (ya hecho) — sin acción.
- **IN-02 (collapse regex enmascara bare col-span)**: exposición baja (bento usa solo `md:col-span-N`); fix = tokenizar por whitespace. S/riesgo-bajo → **cerrar-ahora opcional**.
- **IN-03 (negación anti-insinuación exact-string frágil)**: pre-existente VOTO-04; fix = normalizar whitespace antes de restar. S. Toca `anti-insinuacion-guard.test.ts` (¿lo edita Phase 83/85?). Verificar no-colisión → si libre, **cerrar-ahora**; si en uso por otra fase, **documentar**.
- **IN-04 (size/hex boundary)**: cubierto por el rewrite WR-01 (`size-[…]` ya capturado por el regex genérico); el boundary hex 9-10 dígitos es aceptable. **documentar** — sin acción.

---

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Contraste WCAG | Parser de color de librería pesada / headless browser | ~15 líneas de `hslToRgb`+`relativeLuminance`+`contrastRatio` en el test | Matemática pura estándar; sin deps; sin browser; ya validada en este research |
| Detección de shorthand `-[--` | Nuevo linter / plugin ESLint | Extender el source-scan `bento-guards.test.ts` existente | La infra de lectura-como-texto + whitelist + detector genérico ya existe post-80 |

**Key insight:** toda la deuda cerrable de esta fase se resuelve con las herramientas que el repo ya tiene (vitest source-scan, matemática WCAG). Cero librerías nuevas → **cero superficie de package-legitimacy**.

## Common Pitfalls

### Pitfall 1: Tocar el island `/red`
**Qué sale mal:** cualquier edit a `red-graph.tsx` geometry rompe el gate 75 cerrado + operador-aprobado y viola el invariante pixel-intocable.
**Cómo evitar:** D4 es documentar-con-razón. NO editar `red-graph.tsx`.

### Pitfall 2: Fix mecánico que rompe el doble-hsl
**Qué sale mal:** al migrar `bg-[--camara]` → `bg-[var(--camara)]`, si alguien "ayuda" envolviendo en `hsl()` extra, produce `hsl(hsl(...))` inválido. El token `--camara` YA horneó `hsl()` en su valor.
**Cómo evitar:** el fix es SOLO `[--x]` → `[var(--x)]`. Nunca añadir `hsl()`.

### Pitfall 3: Falso verde del test de contraste
**Qué sale mal:** hardcodear los valores HSL en el test → el test pasa aunque el token cambie a algo que falle.
**Cómo evitar:** el test parsea `civic-tokens.css`/`globals.css` como texto y extrae los HSL en runtime.

### Pitfall 4: Colisión con Phases 83/85
**Qué sale mal:** Phase 83 edita `packages/probidad`, `packages/lobby`, `.github/workflows`; Phase 85 (seguridad) puede tocar guards/anti-insinuación.
**Cómo evitar:** no tocar esos paths. Para D13-IN-03 (anti-insinuacion-guard), verificar que Phase 85 no lo reclame antes de editarlo; si hay duda, documentar en vez de cerrar.

## Runtime State Inventory

> Fase de deuda code-side + revisión. No hay rename/migración de datos. Aún así, verificado explícito:

| Categoría | Ítems encontrados | Acción |
|-----------|-------------------|--------|
| Stored data | Ninguno — esta fase no toca datos ni keys. Verificado: sin DDL, sin escritura Supabase. | Ninguna |
| Live service config | CLOUDFLARE_API_TOKEN/ACCOUNT_ID faltan en GH settings (D7) — config vive en dashboard GH, no en git | **operador** |
| OS-registered state | Ninguno | Ninguna |
| Secrets/env vars | DB password B26 rotación pendiente (D8) — `SUPABASE_DB_URL`, 0 workflows lo referencian | **operador** |
| Build artifacts | Ninguno — sin rename de package/binario | Ninguna |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`app/vitest.config.ts` presente) — `"test": "vitest run"` en `app/package.json:10` |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm exec vitest run <archivo>` (p.ej. `lib/civic-contrast.test.ts`) |
| Full suite command | `cd app && pnpm test` (app 918/918 baseline v8.0) + packages `pnpm -r test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| DEMO-03 / D1 | Barra cívica dark cumple ≥3:1 (WCAG 1.4.11) y no regresiona | unit (matemática pura) | `pnpm exec vitest run lib/civic-contrast.test.ts` | ❌ Wave 0 — crear |
| DEMO-03 / D2 | Ningún componente usa `-[--var]` crudo (solo `-[var(--…)]`) | source-scan | `pnpm exec vitest run lib/bento-guards.test.ts` | ✅ existe — extender scope repo-wide |
| DEMO-03 / D2 | `camara-chip`/`provenance-badge` NO contienen `[--camara]`/`[--provenance-bg]` (patrón identity-marker) | RTL/string | `pnpm exec vitest run components/camara-chip.test.tsx` | ✅ existe — añadir aserción negativa |
| DEMO-03 / D3 | Header y footer comparten gutter <md | RTL/string | `pnpm exec vitest run app/layout.test.tsx` | ✅ existe — añadir aserción |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run <archivo tocado>`
- **Per wave merge:** `cd app && pnpm test` (suite app completa)
- **Phase gate:** app 918+ verde + packages verdes antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/lib/civic-contrast.test.ts` — cubre D1 (contraste dark). Helper de luminancia + parser de `civic-tokens.css`/`globals.css`.
- [ ] Extensión del guard `-[--` repo-wide en `bento-guards.test.ts` (o nuevo `lib/no-bare-var-shorthand.test.ts`) — cubre D2 permanentemente.
- [ ] Aserciones negativas en `camara-chip.test.tsx` / `provenance-badge.test.tsx` (patrón `identity-marker.test.tsx`) — cubre D2 por-componente.
- Framework: ya instalado (Vitest). Sin install nuevo.

## Security Domain

> `security_enforcement` no está explícitamente en `false` → incluido. Nota: la revisión de seguridad **completa** es **Phase 85 (DEMO-04)**, no ésta. Aquí solo lo relevante a la deuda code-side.

### ASVS aplicable a esta fase
| Categoría | Aplica | Control |
|-----------|--------|---------|
| V5 Input Validation | no (fase de deuda visual/CSS, sin nuevos inputs) | — |
| V14 Config | tangencial | CLOUDFLARE_API_TOKEN es secret de operador (D7); no se loguea ni se commitea |
| V6 Cryptography | no | — |

### Threat patterns
| Patrón | STRIDE | Mitigación |
|--------|--------|-----------|
| Secret en workflow/log (CF token, DB pwd) | Information Disclosure | Ambos son acciones de **operador** en dashboard, nunca en git/logs (D7/D8). El plan no debe imprimir valores. |
| Regresión de guard que reabre el shorthand landmine | Tampering (integridad de UI) | El guard repo-wide (D2) es el control preventivo. |

**Sin hallazgos de seguridad críticos en el scope de deuda code-side.** La posture Supabase/RLS, headers del worker, CodeQL → Phase 85.

## State of the Art

| Old | Current | When | Impact |
|-----|---------|------|--------|
| Tailwind v3 shorthand `utility-[--var]` | v4 requiere `utility-[var(--x)]` o `utility-(--x)` | Tailwind v4 (repo en 4.3.1) | La causa raíz de D2; el shorthand v3 compila a CSS inválido en v4 |

**Deprecado/obsoleto:**
- `-[--var]` (arbitrary-var shorthand v3): inválido en v4 → migrar a `[var(--x)]` o registrar en `@theme inline`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Los ~9 componentes con `-[--var]` renderizan sin color EN VIVO (no solo en teoría) | D2 | Bajo — probado por el reviewer 76 compilando con el plugin del repo + documentado en identity-marker.test.tsx. Si por alguna capa de safelist se rescatara, el fix sigue siendo correcto (no-op benigno). Confirmación definitiva = inspección visual en deploy (Phase 85 gate). |
| A2 | Phase 85 no reclama `anti-insinuacion-guard.test.ts` antes que 84 | D13-IN-03 | Bajo — si colisiona, D13-IN-03 se documenta en vez de cerrarse |

*Nota: A1 es el único assumption con impacto visual; verificado indirectamente por dos fuentes del repo (76-REVIEW ground-truth compile + identity-marker fix). No requiere confirmación del usuario para proceder con el fix (el fix es correcto en ambos escenarios).*

## Open Questions

1. **¿D13-IN-03 (anti-insinuación) es tocable sin colisionar con Phase 85 (seguridad)?**
   - Qué sabemos: 85 es la fase de seguridad/anti-insinuación posture.
   - Recomendación: el planner verifica ownership; si dudoso → documentar-con-razón (no cerrar).

2. **¿El fix de D2 usa migración mecánica o registro en `@theme inline`?**
   - Qué sabemos: ambos válidos; el mecánico es menor diff/riesgo; el registro es más limpio y da utilidades planas (`bg-camara`).
   - Recomendación: mecánico para DEMO-03 (menor blast radius); dejar el registro como mejora opcional si el planner quiere consolidar (pero eso toca `globals.css`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/pnpm + Vitest | correr y escribir tests | ✓ | Node 22.21.1, Vitest instalado | — |
| Tailwind 4.3.1 | contexto del fix D2 | ✓ | 4.3.1 (`app/package.json`) | — |

Sin dependencias externas nuevas. Fase code/test-only.

## Sources

### Primary (HIGH)
- `.planning/v8.0-MILESTONE-AUDIT.md` — tech_debt v8.0 (contraste dark, sign-off) — HIGH
- `.planning/milestones/v8.0-phases/76-*/76-REVIEW.md` — CR-01 (ground-truth compile), IN-01 (padding), IN-02 (shorthand landmine) — HIGH
- `.planning/milestones/v8.0-phases/80-*/80-REVIEW.md` + `80-REVIEW-FIX.md` — guards WR-01/02/03 fixed, IN tier restante — HIGH
- `.planning/HANDOFF-v7.0-operator-gates.md` — gates operador (RUT/MONEY/CF-token/DB-pwd/backfills) — HIGH
- `app/app/styles/civic-tokens.css` + `app/app/globals.css:46` — valores dark de la barra cívica + `--card` — HIGH
- `app/components/identity-marker.test.tsx` — patrón de fix del shorthand (aserción negativa) — HIGH
- `app/components/red/red-graph.tsx:378-392` — geometría de aristas /red (D4) — HIGH
- `app/lib/bento-guards.test.ts` — detector genérico + superficies del guard — HIGH
- Cálculo WCAG 1.4.11 ejecutado en node sobre los valores reales — HIGH

### Secondary
- Memoria MEMORY.md (v6.1/v7.0/v8.0) — deuda P3 /red, typography `.net-*`, gates — MEDIUM (cruzada con el código)

## Metadata

**Confidence breakdown:**
- Inventario de deuda: HIGH — todo cruzado contra reviews + código del repo
- Test de contraste (diseño + valor esperado): HIGH — calculado, verde de entrada
- D2 severidad (defecto en vivo): HIGH — probado por reviewer 76 + identity-marker precedente
- D4 /red disposición: HIGH — código leído; invariante LOCKED explícito

**Research date:** 2026-07-15
**Valid until:** ~30 días (repo estable; Tailwind 4.3.1 fijo)
