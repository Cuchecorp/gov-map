---
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
plan: 03
subsystem: fullstack
tags: [relaciones, comparar, militancia-historica, rpc-0067, pgtap, anti-insinuacion, force-dynamic, wave-3]

# Dependency graph
requires:
  - phase: 101-01 (audit N/M)
    provides: "net-new 696 LOCKED, cruce por partido_alias (Pitfall 1), zona SOLO-Senado (diputados distrito NULL)"
  - phase: 101-02 (Wave 0 guards + 0067 escrita)
    provides: "SUPERFICIES_RELACIONES 4 superficies pre-registradas, militancia_historica_compartida allowlistada, migración 0067 ESCRITA (no aplicada), RelacionesSection wrapper"
  - phase: 91 (0060/0061 cross-link RPCs)
    provides: "comisiones_de_parlamentario, coautores_de_parlamentario, parlamentarios_publico_v2, CrossLinkBloque"
provides:
  - "RPC militancia_historica_compartida APLICADA a PROD (secdef alias-keyed net-new 696, prosecdef=t, anon sin execute) + pgTAP 6/6 contra schema aplicado"
  - "5º bloque 'Compartieron militancia en un partido' en la ficha (CrossLinkMilitanciaHistorica dentro de RelacionesSection), cobertura declarada con N honesto"
  - "Ruta /comparar?a=&b= force-dynamic con 4 ejes factuales no-voto (militancia histórica/comisiones/co-autoría/zona) + intersección server-side + fuente+fecha por eje + vacíos honestos + error≠vacío"
  - "CompararSelector (GET-form) + RelacionesEjeComparar (render A/B) + CTA 'Comparar con otro parlamentario' desde la ficha (pre-llena slot A)"
  - "SUPERFICIES_RELACIONES ahora MUERDE sobre las 4 superficies (ya no toleradas-ausentes)"
affects: [ui-review (comparar en deploy real), BrowserOS gate (deploy pendiente)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side intersection por eje: A y B leen la misma RPC deduplicada por React.cache; el set-intersect (comisiones por nombre) / lookup-por-id (militancia histórica, co-autoría) corre server-only"
    - "force-dynamic + await searchParams antes de todo + orden canónico .filter(Boolean).sort() → URL estable; validación PARLAMENTARIO_ID_RE antes de .rpc() (id inválido = no-seleccionado, jamás 500)"
    - "Provenance en copy renderido = 'según fuente al {fecha}' (patrón validacion-fuente.tsx), NUNCA 'captura' (colisiona con término prohibido MONEY del anti-insinuacion-guard)"
    - "Named export del server child async (CompararEjes) para RTL: renderToStaticMarkup no resuelve async children → el test await-ea el componente server y renderiza su árbol resuelto (espejo CarrilesSection)"

key-files:
  created:
    - "supabase/tests/0067_militancia_historica_compartida.test.sql"
    - "app/app/comparar/page.tsx"
    - "app/app/comparar/page.test.tsx"
    - "app/components/comparar-selector.tsx"
    - "app/components/relaciones-eje-comparar.tsx"
  modified:
    - "app/app/parlamentario/[id]/page.tsx"
  applied-to-prod:
    - "supabase/migrations/0067_militancia_historica_compartida.sql (psql --single-transaction; prosecdef=t verificado)"

key-decisions:
  - "0067 = NET-NEW-ONLY (696), no shared-ever (1966): decisión LOCKED del audit 101-01 §4 seguida verbatim. Verificado en vivo: 0 overlap entre militancia_historica_compartida('D1074') y copartidarios_de_parlamentario('D1074')"
  - "5º bloque SÍ entró a la ficha (el audit sostiene sustancia — 696 net-new pares). Heading pasado/factual 'Compartieron militancia en un partido', cobertura declarada con el total_n honesto de la RPC"
  - "Co-autoría en /comparar = COUNT-ONLY: la RPC coautores_de_parlamentario devuelve n_proyectos (conteo honesto de boletines co-firmados) pero NO la lista de boletines. Se muestra el count con provenance; NO se fabrica enlace ni se crea una RPC boletines_compartidos nueva (no expandir alcance; el UI-SPEC no lo exige duro)"
  - "Provenance 'según fuente al {fecha}' en vez de 'captura {fecha}': el término 'captura' está en TERMINOS_PROHIBIDOS (carril MONEY = regulatory capture). Se adoptó el idiom de provenance ya validado (validacion-fuente.tsx / parlamentario-header.tsx)"

requirements-completed: [REL-03, REL-04]

# Metrics
duration: ~35min
completed: 2026-07-24
---

# Phase 101 Plan 03: Militancia histórica compartida (REL-04) + /comparar 1-a-1 (REL-03) Summary

**La RPC net-new 0067 (secdef alias-keyed, 696 pares) se APLICA a PROD y se valida con pgTAP 6/6; el 5º bloque 'Compartieron militancia en un partido' aterriza en la ficha; y nace /comparar?a=&b= (force-dynamic, 4 ejes factuales no-voto con intersección server-side, fuente+fecha por eje, vacíos honestos, error≠vacío) con su selector GET-form y el CTA desde la ficha — SUPERFICIES_RELACIONES ahora MUERDE sobre las 4 superficies aterrizadas.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files:** 5 created, 1 modified, 1 migración aplicada a PROD

## Accomplishments

- **Task 1 (REL-04):** migración 0067 (ya escrita por Plan 02, verificada correcta) APLICADA a PROD vía `psql --single-transaction` — `prosecdef=t`, returns table `(id text, nombre text, camara text, total_n bigint)` (cero PII), `anon` sin execute. pgTAP `0067_*.test.sql` (6 ok / 0 not ok) contra el schema aplicado: has_function, secdef, anon-sin-execute, total_n, PII-safe (no rut/email/partido_alias), contrato exacto. Net-new verificado EN VIVO: `select count(*) from militancia_historica_compartida('D1074') where id in (select id from copartidarios_de_parlamentario('D1074'))` = **0** (cero solape con copartidarios vigentes → el 5º bloque añade info que "Del mismo partido" no da). 5º bloque `CrossLinkMilitanciaHistorica` montado dentro de `RelacionesSection` (children adicional), heading pasado/factual, cobertura con N honesto.
- **Task 2 (REL-03):** `/comparar?a=&b=` (`app/app/comparar/page.tsx`) force-dynamic, `await searchParams` primero, orden canónico `.filter(Boolean).sort()`, validación `PARLAMENTARIO_ID_RE` antes de `.rpc()`, sin `notFound` (empty state honesto, jamás 404). Los 4 ejes computan intersección server-side: **militancia histórica** (B en el net-new de A), **comisiones** (set-intersect por nombre), **co-autoría** (lookup de B en coautores de A → n_proyectos count-only), **zona** (circunscripción/distrito del roster; dos diputados → NULL → "no comparten zona"). Cada eje con fuente+fecha, orden alfabético, figura de intersección en `text-accent-product` (petróleo NEUTRAL). `CompararSelector` (GET-form progressive-enhancement) + `RelacionesEjeComparar` (render A/B) + CTA "Comparar con otro parlamentario" desde la ficha (pre-llena `?a=${id}`). RTL `page.test.tsx`: force-dynamic, empty-state, orden canónico, 4 ejes, zona-vacío, error-LANZA, cero-hex.
- **Verificación:** `pnpm test --run` = **1290 verde (99 files)**; `tsc -b` exit 0; `SUPERFICIES_RELACIONES` ahora MUERDE sobre `comparar/page.tsx` + `comparar-selector.tsx` + `relaciones-eje-comparar.tsx` (ya presentes); lockdown-guard verde (allowlist de Plan 02).

## Task Commits

1. **Task 1 (0067 apply + pgTAP 6/6 + 5º bloque ficha)** — `f432f9e` (feat)
2. **Task 2 (/comparar force-dynamic + 4 ejes + selector + CTA)** — `e8e9b0b` (feat)

## Files Created/Modified

- `supabase/migrations/0067_militancia_historica_compartida.sql` — APLICADA a PROD (escrita en Plan 02, sin cambios; verificada correcta contra el schema)
- `supabase/tests/0067_militancia_historica_compartida.test.sql` — pgTAP 6/6 (has_function, secdef, anon-sin-execute, total_n, PII-safe, contrato exacto)
- `app/app/comparar/page.tsx` — ruta force-dynamic + 4 ejes con intersección server-side
- `app/app/comparar/page.test.tsx` — RTL de /comparar (6 áreas + candados de régimen)
- `app/components/comparar-selector.tsx` — dos selectores GET-form (progressive-enhancement)
- `app/components/relaciones-eje-comparar.tsx` — render presentacional A/B + intersección por eje
- `app/app/parlamentario/[id]/page.tsx` — 5º bloque CrossLinkMilitanciaHistorica + CTA a /comparar

## Decisions Made

- **0067 net-new-only (696).** Seguida la decisión LOCKED del audit 101-01 §4 (vs shared-ever 1966). El net-new-only excluye los pares que comparten el alias vigente (esos ya salen en copartidarios). Verificado EN VIVO contra PROD: 0 overlap.
- **5º bloque SÍ en la ficha.** El audit sostiene sustancia (696 pares net-new son información que "Del mismo partido" no da). Heading en pasado/factual — jamás "aliados/cercanos".
- **Co-autoría COUNT-ONLY en /comparar.** La RPC devuelve n_proyectos (conteo honesto) pero no la lista de boletines. Se muestra el count con provenance; NO se fabrica un enlace ni se crea `boletines_compartidos(a,b)` — no se expande el alcance (el UI-SPEC no lo exige duro; "Claude's Discretion" del plan resuelto a count-only).
- **Provenance = 'según fuente al {fecha}'.** El término "captura" está en TERMINOS_PROHIBIDOS del anti-insinuacion-guard (carril MONEY, = regulatory capture). Se adoptó el idiom de provenance ya validado en el codebase (validacion-fuente.tsx). Ver Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/colisión de guard] 'captura' en el copy de provenance dispara el anti-insinuacion-guard**
- **Found during:** Task 2 (al aterrizar comparar/page.tsx, SUPERFICIES_RELACIONES empezó a morder)
- **Issue:** El copy de provenance inicial usaba `Fuente: X · captura ${fecha}` (frescura del dato). El guard anti-insinuación tiene "captura" en TERMINOS_PROHIBIDOS (carril MONEY, sentido "captura regulatoria") con límite de palabra → cazó la palabra "captura" en el texto renderizado de comparar/page.tsx. Es una colisión legítima: "captura" (frescura/provenance, factual) vs "captura" (regulatory capture, insinuación).
- **Fix:** Reemplazado el copy de provenance por `Fuente: X · según fuente al ${fecha}` — el idiom de provenance YA validado y usado en copy renderido del codebase (`validacion-fuente.tsx:139`, `parlamentario-header.tsx`). Mismo dato factual (fecha de frescura), sin colisionar con el término prohibido. Las 4 líneas de provenance de los ejes actualizadas.
- **Files modified:** app/app/comparar/page.tsx
- **Verification:** `pnpm test --run anti-insinuacion-guard` PASS (0 offenders); guard MUERDE correctamente sobre las 4 superficies RELACIONES.
- **Committed in:** `e8e9b0b`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — colisión de vocabulario provenance/insinuación resuelta adoptando el idiom validado del codebase).
**Impact on plan:** Cero scope creep. La 0067 ya estaba escrita (Plan 02) → Task 1 fue verify+apply+pgTAP+consumo. Ambas tareas se ejecutaron como planificadas.

## Known Stubs

Ninguno. Los 4 ejes de /comparar leen RPCs reales con intersección server-side; el 5º bloque de la ficha lee la RPC 0067 aplicada. Co-autoría count-only es una decisión documentada (no un stub): el conteo es honesto y real; la lista de boletines por par NO existe en la RPC y NO se fabrica.

## Threat Flags

Ninguno. Las mitigaciones del threat_model están implementadas: T-101-07 (`.rpc()` parametrizado + PARLAMENTARIO_ID_RE antes de la query, cero interpolación), T-101-08 (0067 LIMIT 20 + secdef search_path=''), T-101-09 (0067 emite SOLO id/nombre/camara/total_n — pgTAP lo verifica), T-101-10 (allowlist de Plan 02), T-101-11 (error de RPC LANZA, test lo prueba). CERO paquetes nuevos (T-101-SC).

## Notes for ui-review / deploy

- **BrowserOS sobre el deploy real = gate del orquestador PENDIENTE (deploy):** verificar (1) el 5º bloque 'Compartieron militancia en un partido' above-the-fold en la ficha (grid ahora 5 bloques bajo `[&>section]:mt-0`), (2) /comparar A/B con dos parlamentarios reales (intersección de comisiones/co-autoría/militancia + zona-vacío para dos diputados), (3) el CTA "Comparar con otro parlamentario" pre-llena el slot A. Cascada CSS del grid de 5 bloques solo cazable con getComputedStyle en deploy real (memoria v6.1/v8.0).
- **Zona SOLO-Senado:** en /comparar, dos diputados SIEMPRE dan "no comparten zona" (distrito NULL, audit 101-01) — es el vacío honesto declarado, no un bug. Verificar con un par senador+senador de la misma circunscripción que la intersección de zona SÍ aparece.

## Next Phase Readiness

- **REL-03 + REL-04 CERRADOS.** Militancia histórica compartida vive en PROD (RPC + pgTAP + 5º bloque ficha + eje /comparar); /comparar 1-a-1 factual no-voto completo. Pendiente ÚNICO de la pasada: el gate BrowserOS del orquestador sobre el deploy real.
- **Futuros (fuera de v10.0 pasada 2):** eje coalición Servel (VIABLE, dos-etapas R2 documentada, audit 101-01 §5); lobby-misma-contraparte (DIFERIDA por conflación); zona-Cámara (ingesta); comités Senado (re-probe desde red no bloqueada); RPC `boletines_compartidos(a,b)` si el UI-SPEC futuro exige la lista de boletines por par en co-autoría.

---
*Phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali*
*Completed: 2026-07-24*

## Self-Check: PASSED
- FOUND: supabase/tests/0067_militancia_historica_compartida.test.sql
- FOUND: app/app/comparar/page.tsx
- FOUND: app/app/comparar/page.test.tsx
- FOUND: app/components/comparar-selector.tsx
- FOUND: app/components/relaciones-eje-comparar.tsx
- FOUND commit: f432f9e (Task 1)
- FOUND commit: e8e9b0b (Task 2)
- VERIFIED PROD: prosecdef=t on militancia_historica_compartida; pgTAP 6 ok / 0 not ok
