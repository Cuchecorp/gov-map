---
phase: 06-citaciones-tabla-semanal-de-sala
plan: 04
subsystem: frontend-agenda
tags: [frontend, nextjs-16, server-components, agenda, citaciones, tabla-sala, week-nav, iso-week, degradacion-honesta, provenance, rls-anon, live-ingest, idempotente, rtl-tests, cloudflare-403-fallback]

# Dependency graph
requires:
  - "06-01: 5 tablas de agenda (migración 0010) + RLS public-read anon + claves naturales"
  - "06-03: conectores reales (Cámara header-set CF + Senado API) + runIngest + SupabaseAgendaWriter + CLI"
  - "05-04: design system cívico (shadcn Default/Slate) + ProvenanceBadge + CamaraChip + EtapaBadge + createServerSupabase (anon server-only)"
provides:
  - "Ruta /agenda (Server Component): semana ISO navegable (?semana=YYYY-Www), citaciones de ambas cámaras agrupadas por día + tabla de sala"
  - "WeekNav: navegación prev/next por semana ISO vía <Link> server-side (sin JS de cliente)"
  - "CitacionCard: comisión/horario/sala/materia/invitados (texto crudo, SIN IdentityMarker)/CamaraChip/ProvenanceBadge + boletín→/proyecto/[boletin]"
  - "SalaTableSection: modo available (tabla del Senado) / modo degraded (degradación honesta de Cámara al PDF, sin fabricar)"
  - "week-utils (frontend): parseISOWeek (tolerante→semana actual), getWeekBounds, prev/next, formatWeekLabel es-CL"
  - "agenda-types (frontend): filas snake_case desacopladas de @obs/agenda"
  - "Datos LIVE reales en Supabase local: 134 citaciones Cámara + 27 Senado + 4 sesiones/7 ítems de tabla del Senado, con provenance, idempotente"
  - "parseFechaLargaEs: normaliza la FECHA larga del Senado ('Martes 16 de Junio de 2026') a ISO (fix de timestamptz)"
affects: [milestone-1-cierre, ingesta-incremental-futura, firma-visual-humana]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-components-leen-supabase-anon, searchParams-promise-await, parseISOWeek-tolerante-sin-redirect, agrupacion-por-dia, degradacion-honesta-siempre-visible, invitados-texto-crudo-sin-identitymarker, tdd-render-tests-rtl, live-capture-fallback-cloudflare-403, fecha-larga-es-a-iso]

key-files:
  created:
    - app/lib/agenda-types.ts
    - app/lib/week-utils.ts
    - app/lib/week-utils.test.ts
    - app/components/ui/button.tsx
    - app/components/week-nav.tsx
    - app/components/citacion-card.tsx
    - app/components/citacion-card.test.tsx
    - app/components/sala-table-section.tsx
    - app/components/sala-table-section.test.tsx
    - app/app/agenda/page.tsx
    - packages/agenda/scripts/load-camara-live.mts
    - packages/agenda/.gitignore
  modified:
    - packages/agenda/src/parse-senado-tabla.ts
    - packages/agenda/src/parse-senado-tabla.test.ts

key-decisions:
  - "Frontend desacoplado de @obs/agenda: app/lib/agenda-types.ts define las filas snake_case (mismo patrón que lib/types.ts de Fase 5); el paquete backend no entra al bundle"
  - "parseISOWeek tolerante a malformado/ausente → semana ISO actual, SIN redirect (UI-SPEC §12.1, T-06-10); valida formato \\d{4}-W\\d{2} + rango de semana antes de usar el param"
  - "SalaTableSection: la degradación de Cámara SIEMPRE se renderiza (no hay fuente estructurada); la tabla del Senado (available) aparece arriba cuando hay sesiones de esa semana — degradación honesta sin fabricar (T-06-09)"
  - "Invitados = gestores de interés: texto crudo nombre + (calidad), SIN IdentityMarker, SIN link /parlamentario/ (T-06-02); 4 tests RTL + render LIVE lo afirman (0 enlaces /parlamentario/)"
  - "[Rule 1] La FECHA del weekly_table del Senado viene como texto largo en español; sesion_sala.fecha es timestamptz → se normaliza a ISO con parseFechaLargaEs (sin esto, 0 filas de tabla del Senado en la corrida LIVE)"
  - "Fallback LIVE de Cámara: el Fetcher de @obs/ingest recibió 403 de Cloudflare desde este egreso, PERO curl con el header-set obtuvo HTTP 200; se cargó el HTML LIVE-capturado por el PARSER REAL + SupabaseAgendaWriter (camino de código real), documentado en scripts/load-camara-live.mts"

requirements-completed: [TRAM-07, TRAM-08]

# Metrics
duration: 17min
completed: 2026-06-18
---

# Phase 6 Plan 04: Frontend /agenda + corrida LIVE acotada Summary

**Cierra la rebanada ciudadana de la Fase 6: construye `/agenda` (Next.js 16, Server Components) que lee las 5 tablas de agenda de Supabase como `anon` (RLS public-read de 06-01) y renderiza la semana ISO navegable — `WeekNav` (prev/next vía `<Link>` server-side), `CitacionCard` (comisión/horario/sala/materia/invitados como TEXTO CRUDO sin IdentityMarker/CamaraChip/ProvenanceBadge + boletín→`/proyecto/[boletin]` de Fase 5) agrupadas por día con citaciones de AMBAS cámaras, y `SalaTableSection` (tabla del Senado en modo available / degradación honesta de Cámara al PDF en modo degraded). Reusa el design system de Fase 5 verbatim + el shadcn `Button` nuevo. Una corrida LIVE acotada (semanas 2026-W23..W26) dejó datos reales en el Supabase local: 134 citaciones de Cámara + 27 del Senado + 4 sesiones/7 ítems de tabla del Senado, con provenance completa (161/161), idempotente, sin fabricar la tabla de Cámara. `pnpm build` verde con `/agenda` presente, 55 tests del app + 88 de `@obs/agenda` verdes, `pnpm -w typecheck` exit 0, y render LIVE end-to-end confirmado (ambas cámaras + tabla del Senado available en W25 + degradación de Cámara + 0 enlaces `/parlamentario/` desde invitados).**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-06-18T19:21:48Z
- **Completed:** 2026-06-18T19:38:00Z
- **Tasks:** 4 (Task 2 con ciclo TDD RED→GREEN; Task 4 = corrida LIVE + gate visual, pre-autorizados)
- **Files:** 12 creados, 2 modificados
- **Tests:** 55 app (22 previos + 15 week-utils + 18 componentes) + 88 @obs/agenda (84 previos + 4 del fix); `pnpm -w typecheck` exit 0; `pnpm build` OK

## Accomplishments

- **Task 1 — helpers + tipos + Button:** `app/lib/week-utils.ts` (`parseISOWeek` tolerante a malformado/ausente → semana ISO actual sin redirect + validación de rango; `getWeekBounds` lunes–domingo UTC; `prevISOWeek`/`nextISOWeek` que cruzan el borde de año respetando los años de 53 semanas; `formatWeekLabel` es-CL "Semana 25 · 15 jun–21 jun 2026"), espejo de la aritmética ISO de `@obs/agenda` pero en el frontend. `app/lib/agenda-types.ts` con las 5 filas snake_case (desacopla de `@obs/agenda`). Shadcn `Button` (Default/Slate) copiado del registro oficial para el `asChild` de WeekNav. 15 tests de bordes ISO verdes.
- **Task 2 (TDD) — 3 componentes:** `WeekNav` (Server Component, dos `<Button asChild><Link>` prev/next con aria-labels + `formatWeekLabel` central, sin "use client"). `CitacionCard` (CamaraChip + fecha/horario mono + comisión/sala + materia con `line-clamp-3`+`<details>` + bloque invitados TEXTO CRUDO nombre+(calidad) SIN IdentityMarker SIN link a parlamentario + boletín→`/proyecto/[boletin]` + ProvenanceBadge). `SalaTableSection` (mode available → `<table>` N°/Boletín/Materia/Etapa con caption sr-only + boletín link + ProvenanceBadge; mode degraded → `border-border bg-muted/40` con copy honesto "Tabla de sala no disponible" + links Cámara/Senado, SIN destructive, SIN "próximamente", SIN filas fabricadas). 18 tests RTL verdes (RED confirmado antes de implementar).
- **Task 3 — ruta /agenda:** `app/app/agenda/page.tsx` (Server Component). `searchParams` es Promise → `await` (LEÍDO en node_modules/next/dist/docs antes de escribir). `parseISOWeek(sp.semana)` con fallback a la semana actual. Layout `max-w-3xl mx-auto px-4 md:px-8`. `<h1>Agenda legislativa</h1>` + `<WeekNav>` + sección citaciones (query `citacion` `WHERE semana_iso = key` con embeds `citacion_invitado`/`citacion_punto`, order `fecha,camara,comision`, agrupadas por día → `CitacionCard`; empty-state honesto) + sección tabla de sala (query `sesion_sala`+items del Senado por rango de la semana → available cuando hay filas; degradación de Cámara SIEMPRE visible). Cada sección en su `<Suspense>` con skeleton. Lecturas con `createServerSupabase()` (anon). `pnpm build` OK con `/agenda` dinámica.
- **Task 4 — corrida LIVE acotada + gate visual (pre-autorizados):** `supabase db reset` (0001→0010) + corrida LIVE de la agenda (semanas 2026-W23..W26) con el CLI real (`runIngest` + conectores reales + `SupabaseAgendaWriter`) contra el Supabase local. Resultado: 27 citaciones del Senado (forward-only) + 4 sesiones/7 ítems de tabla del Senado, provenance completa, 0 errores, idempotente (re-corrida → conteos idénticos). Cámara degradada honestamente (403 de Cloudflare desde este egreso → backoff → degradación sin abortar el Senado; tabla de Cámara = PDF marker, 0 filas). Para cubrir AMBAS cámaras (énfasis del usuario), se aplicó el fallback documentado del checkpoint: `curl` con el header-set anti-Cloudflare SÍ obtuvo HTTP 200 de Cámara, y se cargó el HTML LIVE-capturado por el PARSER REAL `parseCamaraCitaciones` + `SupabaseAgendaWriter` → 134 citaciones reales de Cámara (146 invitados, 211 puntos, 197 con boletín). Gate visual satisfecho programáticamente: `pnpm build` verde + 18 tests RTL + render LIVE end-to-end (`pnpm start` + curl) confirmando en `/agenda?semana=2026-W25` ambas cámaras agrupadas + tabla del Senado available + degradación de Cámara + ProvenanceBadge + 28 enlaces de boletín + **0 enlaces `/parlamentario/`**; param malformado/injection → HTTP 200 con fallback (sin crash).

## Task Commits

1. **Task 1: week ISO helpers + agenda row types + shadcn Button** — `c28544b` (feat)
2. **Task 2 RED: behavior tests CitacionCard + SalaTableSection** — `47ab0c5` (test)
3. **Task 2 GREEN: WeekNav + CitacionCard + SalaTableSection** — `3dcdf9d` (feat)
4. **Task 3: ruta /agenda (Server Component, semana navegable)** — `002235d` (feat)
5. **Task 4 (fix + fallback): normalizar FECHA del Senado a ISO + loader LIVE de Cámara** — `c3d2a7d` (fix)

## LIVE Ingest — Conteos Documentados (Supabase local)

| Tabla | Filas | Detalle |
|-------|-------|---------|
| `citacion` (Cámara) | 134 | semanas 2026-W23..W26 (37/37/40/20), HTML LIVE 200 vía header-set |
| `citacion` (Senado) | 27 | forward-only (W25..W29 desde la API `commissions_citations`) |
| `citacion_invitado` | 146 | de Cámara (Senado no expone invitados en esta corrida) |
| `citacion_punto` | 211 | 197 con boletín (cruce a `/proyecto/[boletin]`) |
| `sesion_sala` (Senado) | 4 | tabla del Senado, fecha 2026-06-16/17 (ISO 2026-W25) |
| `sesion_sala` (Cámara) | 0 | degradación honesta — NUNCA se fabrica (T-06-09) |
| `sesion_tabla_item` | 7 | ítems del orden del día del Senado |
| **provenance** | 161/161 | origen + fecha_captura + enlace en cada citación |

**Idempotencia:** re-corrida del ingest + re-corrida del loader → conteos idénticos (134/27/146/211/4/7), sin duplicación (upsert por clave natural).

## Decisions Made

- **`searchParams` como Promise (Next.js 16):** se leyó `node_modules/next/dist/docs/01-app/.../03-layouts-and-pages.md` antes de escribir la ruta (AGENTS.md). `searchParams: Promise<{...}>` → `await` antes de usar `sp.semana`; usar `searchParams` opta la página a render dinámico (correcto: la agenda depende del request).
- **Degradación de Cámara siempre visible + Senado available condicional:** `SalaTableSection mode="degraded"` se renderiza SIEMPRE (Cámara no tiene fuente estructurada); la tabla del Senado (`mode="available"`) aparece solo cuando hay `sesion_sala` de esa semana (en la corrida, W25). Esto honra la "degradación honesta" sin fabricar filas (T-06-09) y a la vez muestra el dato real del Senado.
- **Guarda de identidad de invitados en render:** `CitacionCard` muestra `nombre` + `(calidad)` como texto plano; NUNCA importa `IdentityMarker` ni enlaza a `/parlamentario/`. Probado por 4 tests RTL + el render LIVE (0 enlaces `/parlamentario/` con 146 invitados reales cargados). T-06-02 cerrado en la UI.
- **Fallback de Cloudflare documentado, no silencioso:** el `Fetcher` de `@obs/ingest` fue 403'd por Cloudflare desde el egreso de ejecución, pero `curl` con el mismo header-set obtuvo HTTP 200 (la fuente responde; el bloqueo es del cliente HTTP del framework, no de la red). Se cargó el HTML LIVE por el PARSER REAL + WRITER REAL — mismos caminos de código que `runIngest`, solo cambia el transporte de captura. Queda `scripts/load-camara-live.mts` como el fallback documentado del checkpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] La FECHA del weekly_table del Senado rompía el upsert de `sesion_sala` (timestamptz)**
- **Found during:** Task 4 (primera corrida LIVE)
- **Issue:** `parse-senado-tabla.ts` conservaba `FECHA` como texto largo en español ("Martes 16 de Junio de 2026") y lo asignaba a `sesion.fecha`. La columna `sesion_sala.fecha` es `timestamptz` → PostgREST rechazó el lote (`invalid input syntax for type timestamp with time zone`), dejando **0 filas de tabla del Senado** en la corrida — contradiciendo el criterio de éxito "tabla del Senado presente".
- **Fix:** se añadió `parseFechaLargaEs` (extrae día/mes/año con regex tolerante a tildes/mayúsculas, mapea el mes en español, devuelve ISO `YYYY-MM-DD`; `null` → descarta la sesión sin fabricar). `parseSenadoTabla` la usa para `sesion.fecha`. 4 tests nuevos (normalización + casos de `parseFechaLargaEs`).
- **Files modified:** packages/agenda/src/parse-senado-tabla.ts, packages/agenda/src/parse-senado-tabla.test.ts
- **Verification:** 88/88 tests de `@obs/agenda` verdes; re-corrida LIVE → 4 sesiones/7 ítems del Senado cargados, 0 errores; `sesion_sala.fecha` válida (`2026-06-16` etc.).
- **Committed in:** `c3d2a7d` (Task 4)

**2. [Rule 3 - Blocking] Fetcher de @obs/ingest 403'd por Cloudflare → cobertura de Cámara en riesgo**
- **Found during:** Task 4 (corrida LIVE)
- **Issue:** `runIngest` recibió 403 persistente de Cámara desde el egreso de ejecución (degradó la fuente, como diseñado), dejando 0 citaciones de Cámara. El criterio de éxito (énfasis del usuario) pide TODAS las citaciones de AMBAS cámaras.
- **Fix (camino documentado del checkpoint, no arquitectónico):** `curl` con el header-set anti-Cloudflare SÍ devolvió HTTP 200 de Cámara (la fuente responde; el 403 es del cliente HTTP del framework). Se capturó el HTML LIVE de W23..W26 y se cargó por el PARSER REAL `parseCamaraCitaciones` + `SupabaseAgendaWriter` (caminos de código reales). Quedó `scripts/load-camara-live.mts` como el fallback documentado; las capturas transitorias se gitignoran.
- **Files modified:** packages/agenda/scripts/load-camara-live.mts (nuevo), packages/agenda/.gitignore (nuevo)
- **Verification:** 134 citaciones reales de Cámara cargadas (146 invitados, 211 puntos); render LIVE muestra ambas cámaras; idempotente.
- **Committed in:** `c3d2a7d` (Task 4)

**Total deviations:** 2 auto-fixed (1 bug de timestamptz que bloqueaba la tabla del Senado; 1 blocking de egreso resuelto por el fallback documentado del propio checkpoint). Sin cambios arquitectónicos; sin scope creep; sin paquetes nuevos.

## Checkpoint Handling (autónomo)

- **Task 4 (corrida LIVE, BLOQUEANTE):** pre-autorizada por el orquestador. Corrida acotada-pero-representativa (2026-W23..W26, ambas cámaras) contra las fuentes reales con el `SupabaseAgendaWriter` local. Verificación objetiva: >0 citaciones de AMBAS cámaras (134 Cámara + 27 Senado), tabla del Senado presente (4 sesiones/7 ítems), tabla de Cámara degradada honestamente (0 filas + PDF marker), provenance completa (161/161), 0 errores tras el fix, idempotente. El 403 de Cámara desde este egreso se resolvió con el fallback documentado (curl 200 + parser/writer reales), no se falló la corrida.
- **Task 4 (gate visual, BLOQUEANTE):** el ejecutor no puede abrir un navegador. Satisfecho programáticamente: (a) `pnpm build` verde con `/agenda`; (b) 18 tests RTL de los comportamientos clave; (c) render LIVE end-to-end (`pnpm start` con env del Supabase local + curl) confirmando en `/agenda?semana=2026-W25` ambas cámaras agrupadas por día + tabla del Senado available + degradación de Cámara + ProvenanceBadge (17) + boletín links (28) + caption sr-only + **0 enlaces `/parlamentario/`**; param malformado → 200 con fallback. **La firma visual de un operador humano sigue recomendada** antes del cierre formal de la fase (abrir `/agenda` con los datos reales y confirmar tono/estética cívica).

## Threat Model Coverage

- **T-06-10 (Tampering / injection vía `semana` searchParam):** mitigado — `parseISOWeek` valida `\d{4}-W\d{2}` + rango de semana antes de usar el param; fallback a la semana actual sin redirect; supabase-js `.eq()`/rango parametriza. Verificado: `/agenda?semana=2026-W99';DROP--` → HTTP 200 con fallback (sin crash).
- **T-06-02 (Tampering / identidad de invitados):** mitigado — invitados como texto crudo (nombre + calidad), SIN IdentityMarker, SIN link `/parlamentario/`; 4 tests RTL + render LIVE (0 enlaces `/parlamentario/` con 146 invitados reales).
- **T-06-11 (Information Disclosure / anon key en el bundle):** mitigado — `createServerSupabase()` server-only (reuso de Fase 5), anon key sin `NEXT_PUBLIC_`, lecturas en Server Components; anon limitado por RLS public-read de 06-01. Verificado: anon lee las 5 tablas vía REST.
- **T-06-09 (Tampering / fabricar tabla de Cámara):** mitigado — `SalaTableSection mode="degraded"` con PDF link honesto, SIEMPRE visible; 0 filas de `sesion_sala` de Cámara en la DB (confirmado); test RTL afirma sin destructive ni "próximamente".
- **T-06-07 (DoS / WAF de Cámara):** mitigado — `runIngest` rate-limit 2-3s + header-set CF + alcance acotado + backoff ante 403; degradó Cámara sin abortar el Senado. El fallback de captura respetó el delay 3s entre requests.

## Known Stubs

- **Ninguno que engañe a la UI.** El enlace `/proyecto/[boletin]` de `CitacionCard`/`SalaTableSection` apunta a la ficha real de Fase 5; los boletines provienen de los puntos/ítems reales (197 puntos con boletín cargados). La tabla de sala de Cámara en "no disponible + PDF" no es un stub: es la degradación honesta declarada (no hay fuente estructurada de Cámara). Los invitados del Senado vienen vacíos en esta corrida porque la API `commissions_citations` no los expuso — es ausencia de dato en la fuente, no un stub.

## Threat Flags

Ninguna superficie de seguridad nueva fuera del `<threat_model>` del plan: la ruta `/agenda` solo lee (anon, RLS) las 5 tablas ya cubiertas; el loader de Cámara escribe con la service key SOLO al Supabase local (mismo writer que 06-03, T-06-06).

## Next Phase Readiness

- **Firma visual humana:** recomendada antes del cierre formal de la fase — operador abre `/agenda?semana=2026-W25` (con los datos LIVE ya cargados) y confirma la estética cívica/tono sobrio. El render funcional ya está probado por build + tests + curl.
- **Cierre del MVP de la Fase 6 / Milestone 1:** la rebanada ciudadana está viva end-to-end (citaciones de ambas cámaras + tabla del Senado + degradación de Cámara, cada dato con frescura+fuente, alimentado por una ingesta real).
- **Ingesta incremental futura:** `runIngest` + CLI son la base; la cadencia (pgmq + pg_cron) y la resolución del 403 de Cloudflare desde el egreso de CI (header-set en el `Fetcher`, o navegador real/browseros) son trabajos posteriores — el camino de fallback queda documentado.

## Self-Check: PASSED

- Archivos creados verificados en disco: agenda-types, week-utils(.test), ui/button, week-nav, citacion-card(.test), sala-table-section(.test), app/agenda/page, scripts/load-camara-live.mts, .gitignore — todos FOUND.
- Archivos modificados: parse-senado-tabla(.ts/.test) — FOUND.
- Commits verificados en el historial: c28544b (T1), 47ab0c5 (T2 RED), 3dcdf9d (T2 GREEN), 002235d (T3), c3d2a7d (T4 fix) — todos FOUND.
- Suite: `app` 55/55 verde; `@obs/agenda` 88/88 verde; `pnpm -w typecheck` exit 0; `pnpm build` OK con `/agenda` presente; render LIVE end-to-end confirmado (ambas cámaras + tabla del Senado + 0 enlaces /parlamentario/).

---
*Phase: 06-citaciones-tabla-semanal-de-sala*
*Completed: 2026-06-18*
