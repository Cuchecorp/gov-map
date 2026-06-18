---
phase: 06-citaciones-tabla-semanal-de-sala
plan: 01
subsystem: agenda
tags: [agenda, citaciones, tabla-sala, modelo-comun, supabase, postgres, migracion, rls, pgtap, fixtures, e2e, walking-skeleton, cheerio]

# Dependency graph
requires:
  - "Migraciones 0001-0009 + patrón pgTAP de Fases 1-5 (RLS public-read explícito)"
  - "Maestra `parlamentario` (guarda anon NO lee rut)"
  - "@obs/core (Provenance), @obs/ingest (Fetcher/allowlist), patrón @obs/tramitacion (Fase 5)"
provides:
  - "Paquete @obs/agenda dado de alta en el workspace (typecheck verde)"
  - "Modelo común Citacion/CitacionInvitado/CitacionPunto/SesionSala/SesionTablaItem + zod (boletín = llave de cruce con Fase 5)"
  - "Migración 0010: 5 tablas de agenda + RLS public-read EXPLÍCITO para anon"
  - "pgTAP 0008 que prueba que anon SÍ lee las 5 tablas y NO lee parlamentario.rut"
  - "3 fixtures reales (HTML Cámara 235KB + JSON commissions_citations + JSON weekly_table)"
  - "slice.e2e.test.ts (RED): la diana ciudadana de la fase (parsers ausentes)"
affects: [agenda, frontend-agenda, tramitacion]

# Tech tracking
tech-stack:
  added: [cheerio@1.2.0]
  patterns: [rls-public-read-explicito, provenance-inline, modelo-comun-zod, walking-skeleton-red, fixtures-reales-live, claves-naturales-upsert, invitados-sin-reconciliacion]

key-files:
  created:
    - packages/agenda/package.json
    - packages/agenda/tsconfig.json
    - packages/agenda/vitest.config.ts
    - packages/agenda/src/index.ts
    - packages/agenda/src/model.ts
    - packages/agenda/src/model.test.ts
    - packages/agenda/src/slice.e2e.test.ts
    - packages/agenda/test/fixtures/camara-citaciones-semana.html
    - packages/agenda/test/fixtures/senado-commissions-citations.json
    - packages/agenda/test/fixtures/senado-weekly-table.json
    - supabase/migrations/0010_agenda.sql
    - supabase/tests/0008_agenda.test.sql
  modified:
    - tsconfig.json
    - tsconfig.base.json
    - pnpm-lock.yaml

key-decisions:
  - "RLS public-read EXPLÍCITO (policy for select to anon using(true)) + GRANT SELECT en las 5 tablas de agenda: el deny-by-default heredado dejaría la /agenda en blanco (Pitfall 5/T-06-01); parlamentario intacta"
  - "citacion_invitado SIN parlamentario_id ni reconciliación: invitados = gestores de interés/terceros, texto crudo (nombre+calidad) — NO parlamentarios (T-06-02)"
  - "boletín (NNNNN-NN) en citacion_punto y sesion_tabla_item como llave de cruce hacia proyecto.boletin (Fase 5)"
  - "claves naturales TOTALES para upsert idempotente: citacion.id PK, unique(citacion_id,nombre) en invitado, unique(citacion_id,posicion) en punto, sesion_sala.id PK, unique(sesion_id,posicion) en item"
  - "cheerio@1.2.0 instalado del registro (versión LOCKED en STACK.md): el plan asumía que ya estaba en el lockfile pero no lo estaba; tramitacion usa fast-xml-parser, no cheerio"
  - "slice.e2e en RED por imports ausentes (no it.todo): contrato observable que las olas de parsers vuelven verde (walking-skeleton-first)"

requirements-completed: [TRAM-07, TRAM-08]

# Metrics
duration: 12min
completed: 2026-06-18
---

# Phase 6 Plan 01: Fundación del slice de Agenda (scaffold + modelo + RLS + fixtures + E2E RED) Summary

**Da de alta `@obs/agenda` en el workspace (espejando `@obs/tramitacion`), materializa el modelo común `Citacion`/`CitacionInvitado`/`CitacionPunto`/`SesionSala`/`SesionTablaItem` (tipos + zod, con boletín como llave de cruce hacia la ficha de Fase 5), crea la migración `0010` con las 5 tablas de agenda y RLS public-read EXPLÍCITO para `anon` (probado por pgTAP: anon SÍ lee las 5, NO lee `parlamentario.rut`), persiste los 3 fixtures reales de las fuentes confirmadas (HTML Cámara 235KB tras Cloudflare + 2 JSON limpios del Senado) y deja el `slice.e2e.test.ts` en RED como diana ciudadana de la fase.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-18T18:41:00Z
- **Completed:** 2026-06-18T18:53:38Z
- **Tasks:** 3 (Task 2 con ciclo TDD RED→GREEN)
- **Files:** 12 creados, 3 modificados

## Accomplishments

- **Paquete `@obs/agenda`** dado de alta espejando `@obs/tramitacion`: `package.json` (type:module, deps workspace `@obs/core`/`@obs/ingest` + `@supabase/supabase-js`/`cheerio@1.2.0`/`zod`; SIN `@obs/adjudication`/`@obs/identity`/`fast-xml-parser`), `tsconfig` composite con project references a `core` e `ingest` (lib DOM para cheerio), `vitest.config` (node, sin RTL), barrel `src/index.ts`. Project reference en `tsconfig.json` raíz + path mapping en `tsconfig.base.json`. `pnpm install` + `pnpm -w typecheck` exit 0.
- **Modelo común (`model.ts`)** TRAM-07/TRAM-08: `Citacion` (id sintético, camara `camara|senado`, comision, fecha, horario crudo, sala, materia, estado nullable, semana_iso `YYYY-Www`, invitados[], puntos[], provenance inline), `CitacionInvitado` (nombre + calidad nullable, SIN reconciliación), `CitacionPunto` (boletin nullable formato `NNNNN-NN`, id_proyecto, materia, tipo_tramite), `SesionSala` (id = ID_SESION, items[], provenance inline) y `SesionTablaItem` (posicion int, parte_sesion, materia, boletin nullable, id_proyecto, alias, quorum). Zod schemas exportados desde el barrel. Provenance inline (`origen`/`fecha_captura`/`enlace`) en `Citacion` y `SesionSala` (TRAM-09).
- **Migración `0010_agenda.sql`**: DDL de las 5 tablas + claves naturales totales para upsert idempotente (`citacion.id` PK, `unique(citacion_id,nombre)`, `unique(citacion_id,posicion)`, `sesion_sala.id` PK, `unique(sesion_id,posicion)`) + FKs `on delete cascade` de hijos hacia raíz + índices de la `/agenda` (`citacion(semana_iso)`, `citacion(fecha)`, `citacion_punto(boletin)`, `sesion_tabla_item(boletin)`) + **RLS public-read EXPLÍCITO** (`enable rls` + `create policy ... for select to anon using(true)` + `grant select ... to anon` en las 5). `parlamentario` intacta (deny-by-default).
- **pgTAP `0008_agenda.test.sql`** (22 asserts): existencia de las 5 tablas, columnas + provenance, guarda `hasnt_column(citacion_invitado, parlamentario_id)` (T-06-02), FKs de los hijos, check de `camara`, RLS habilitada en las 5; **prueba efectiva de RLS** sembrando citación + sesión como owner, `set local role anon`, `isnt_empty` en las 5 tablas y `is_empty($$select rut from parlamentario$$)` (guarda T-06-01). `supabase test db` verde (148 tests totales, Result: PASS); migración 0010 aplica limpia desde 0001.
- **3 fixtures reales** capturados LIVE: `camara-citaciones-semana.html` (235632 B, `prmSemana=2026-25`, HTTP 200 con header-set anti-Cloudflare; 4 `article.citaciones`/`table.tabla` reales, NO página de error CF), `senado-commissions-citations.json` (63839 B, `web-back.senado.cl/api/commissions_citations?limit=100`, `data[].CITACIONES[].PUNTOS_PROPUESTOS[]` con `NUMERO_BOLETIN`) y `senado-weekly-table.json` (11099 B, `.../api/weekly_table?limit=100`, `data[].TABLA[]` con `POSICION/PARTE_SESION/BOLETIN`). Delay 3s entre requests, UA identificatorio.
- **slice.e2e.test.ts (RED):** importa `parseCamaraCitaciones`/`parseSenadoCitaciones`/`parseSenadoTabla` (no exportados aún); los 3 tests fallan por símbolos ausentes (no por fixtures rotos), describiendo el objetivo ciudadano: ver las citaciones de ambas cámaras y la tabla de sala del Senado, con boletín como cruce a la ficha.

## Task Commits

1. **Task 1: Scaffold @obs/agenda + alta en workspace** — `4ed4649` (feat)
2. **Task 2 RED: test del modelo común (falla por ./model ausente)** — `df9642c` (test)
3. **Task 2 GREEN: modelo común + migración 0010 + pgTAP RLS público** — `e4bb5ac` (feat)
4. **Task 3: fixtures reales de las 3 fuentes + slice E2E (RED)** — `9798a05` (test)

## Decisions Made

- **RLS public-read EXPLÍCITO + GRANT en las 5 tablas** — el deny-by-default heredado dejaría la `/agenda` en blanco (`anon` leería 0 filas sin error). Se añadió `create policy ... for select to anon using(true)` Y `grant select to anon` en las 5 tablas (la policy sin el privilegio no expone nada). `parlamentario` intacta (Pitfall 5 / T-06-01).
- **`citacion_invitado` sin `parlamentario_id` ni reconciliación** — los invitados son gestores de interés / terceros, NO parlamentarios; se modelan como texto crudo (nombre + calidad) sin cruce contra la maestra. El pgTAP lo prueba con `hasnt_column` (T-06-02). Por eso `@obs/agenda` NO depende de `@obs/adjudication`/`@obs/identity`.
- **Boletín (`NNNNN-NN`) como llave de cruce** — `citacion_punto.boletin` y `sesion_tabla_item.boletin` enlazan a `proyecto.boletin` de Fase 5; indexados para el cruce. Nullable (no todo punto tiene proyecto).
- **slice E2E en RED por imports reales** (no `it.todo`) — falla por símbolos ausentes; es el contrato observable del valor ciudadano que las olas de parsers vuelven verde (walking-skeleton-first).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] cheerio NO estaba en el workspace (premisa falsa del plan)**
- **Found during:** Task 1 (verificación de dependencias antes del install)
- **Issue:** El `<package_note>` del plan y la Package Legitimacy Audit del RESEARCH afirmaban que `cheerio@1.2.0` "ya está en el workspace (usado por @obs/tramitacion en Fases 3/5)" y que NO se instalaría nada nuevo del registro. La verificación mostró que `@obs/tramitacion` usa `fast-xml-parser`, NO cheerio, y que cheerio no estaba en `pnpm-lock.yaml` ni en `node_modules`. Las coincidencias de "cheerio" en grep eran substrings de paquetes ajenos (es-abstract, eslint).
- **Fix:** Se instaló `cheerio@1.2.0` (versión EXACTA pineada) del registro. El gate de legitimidad de paquete NO bloquea aquí porque cheerio está LOCKED y pineado a nivel de proyecto en `STACK.md` ("cheerio | 1.2.0 | Parsing de HTML ASP.NET WebForms") y aprobado en la Package Legitimacy Audit; es un paquete canónico (millones de descargas/semana), no un nombre alucinado/slopsquatted. La única corrección fue la premisa "ya instalado", no la legitimidad.
- **Files modified:** packages/agenda/package.json, pnpm-lock.yaml
- **Verification:** `cheerio@1.2.0` resuelto en el lockfile + `node_modules/.pnpm/cheerio@1.2.0`; `pnpm -w typecheck` exit 0.
- **Committed in:** `4ed4649` (Task 1)

**Total deviations:** 1 auto-fixed (1 bug / premisa). Sin scope creep.

## Checkpoint Handling (autónomo)

El plan es `autonomous: false` con captura de fixtures. Per la directiva de ejecución autónoma, se capturaron los 3 fixtures reales directamente:
- **Cámara (Cloudflare):** `GET citaciones_semana.aspx?prmSemana=2026-25` con el header-set de navegador completo (`Sec-Ch-Ua*`, `Sec-Fetch-*`, `Accept-Language`, `Upgrade-Insecure-Requests`, UA Chrome + sufijo `Bot-Ciudadano/1.0`) → **HTTP 200, 235632 B descomprimidos** (`--compressed`). Se verificó que NO es una página de error de Cloudflare: `Attention Required`=false, `cf-error-details`=false, 4 `article.citaciones`/`table.tabla` reales, headers Comisión/Invitados, título legítimo. (El único match de `challenge-platform` fue el script benigno `/cdn-cgi/challenge-platform/.../jsd/main.js` que CF inyecta en toda página 200.) NO se necesitó el fallback de navegador real; el header-set bastó desde este egreso (la re-verificación LIVE desde el egreso de ejecución se hace en 06-04, Assumption A2).
- **Senado:** `web-back.senado.cl/api/commissions_citations?limit=100` (HTTP 200, 63839 B) y `.../weekly_table?limit=100` (HTTP 200, 11099 B), JSON limpio sin headers especiales, delay 3s entre requests. Shapes confirmados (`PUNTOS_PROPUESTOS[].NUMERO_BOLETIN`, `TABLA[].POSICION/PARTE_SESION/BOLETIN`).

Todos los endpoints respondieron HTTP 200; tamaños coinciden con el RESEARCH.

## Threat Model Coverage

- **T-06-01 (Information Disclosure / RLS):** mitigado — policies public-read SOLO en las 5 tablas de agenda + grant; `parlamentario` deny-by-default; pgTAP prueba `anon` SÍ lee las 5 y NO lee `parlamentario.rut` (como rol anon real).
- **T-06-02 (Tampering / identidad de invitados):** mitigado — `citacion_invitado` SIN `parlamentario_id` ni reconciliación (probado con `hasnt_column`); nombre + calidad como texto crudo de la fuente.
- **T-06-03 (DoS / fixture HTML gigante):** aceptado — fixtures acotados (235KB Cámara); zod por fila en olas siguientes; cheerio no ejecuta scripts.
- **T-06-SC (npm install cheerio):** `cheerio@1.2.0` instalado a versión EXACTA pineada (LOCKED en STACK.md + Package Legitimacy Audit). Paquete canónico verificado; sin checkpoint de legitimidad requerido (el gate aplica a nombres `[ASSUMED]`/`[SUS]`, no a `[VERIFIED]` pineados). Ver Deviación 1.

## Known Stubs

- `packages/agenda/src/index.ts` exporta solo el modelo común; los parsers (`parseCamaraCitaciones`, `parseSenadoCitaciones`, `parseSenadoTabla`), conectores, writer y orquestación de ingesta **NO existen aún por diseño** — son la diana RED del `slice.e2e.test.ts` que las olas siguientes de esta fase implementan. No es un stub de datos que engañe a la UI; es el contrato walking-skeleton declarado del plan.

## Issues Encountered

- `supabase test db` no aplica la migración nueva por sí solo contra el estado actual; fue necesario `supabase db reset` (aplica 0001→0010 limpio) antes de correr los pgTAP. Sin efecto en el resultado.
- El header-set anti-Cloudflare de Cámara funcionó desde este egreso (HTTP 200). La estabilidad desde el egreso real de ejecución/CI se re-verifica en 06-04 (Assumption A2 del RESEARCH).

## Next Phase Readiness

- **Olas de parsers** tienen el contrato del modelo común estable + los 3 fixtures reales para escribir `parseCamaraCitaciones` (cheerio sobre `article.citaciones`/`table.tabla`), `parseSenadoCitaciones` (JSON `commissions_citations`) y `parseSenadoTabla` (JSON `weekly_table`) que vuelven verde el `slice.e2e.test.ts`.
- **Conectores** reusan `@obs/ingest` (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get); falta añadir `web-back.senado.cl` a la SSRF allowlist y aplicar el header-set anti-Cloudflare en Cámara.
- **Writer idempotente** tiene las claves naturales ya en 0010.
- **Frontend `/agenda`** tiene las 5 tablas con RLS public-read → los Server Components leerán como `anon` sin quedar en blanco.

## Self-Check: PASSED

Archivos declarados existen y los 4 commits están en el historial:
- Archivos: package.json/tsconfig/vitest/index/model(.test)/slice.e2e + 3 fixtures + 0010_agenda.sql + 0008_agenda.test.sql + 06-01-SUMMARY.md — todos FOUND.
- Commits: 4ed4649 (T1), df9642c (T2 RED), e4bb5ac (T2 GREEN), 9798a05 (T3) — todos FOUND.

---
*Phase: 06-citaciones-tabla-semanal-de-sala*
*Completed: 2026-06-18*
