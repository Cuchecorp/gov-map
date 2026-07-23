---
phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co
plan: 03
subsystem: ingesta
tags: [bio, cli, dos-etapas, r2, sparql, comisiones, migracion, pgtap, fail-closed, live-run, prod]

# Dependency graph
requires:
  - phase: 90-01 (@obs/bio scaffold + model.ts + migración 0059 offline)
    provides: contratos allowlist + 4 tablas deny-by-default listas para aplicar
  - phase: 90-02 (parsers + writer + orquestador run-bio dos-etapas)
    provides: runBio(RunBioOpts) + 3 parsers + SupabaseBioWriter que el CLI ensambla
provides:
  - "run-bio-cli.ts: entry-point operador/agente (flags --dry-run/--from-r2/--xml-file/--integrantes-file/--fuente) + buildBioConector real"
  - "Migración 0059 APLICADA a PROD (4 tablas bio/comisiones) verificada por pgTAP 28/28 contra schema vivo"
  - "Bio poblada en PROD: 315 militancias diputados + 48 senadores + 34 comisiones + 386 membresías; 0 FK fabricado"
  - "Query BCN corregida (bio:idSenado) + enlace determinista por parlid_senado (más fuerte que name-match A3)"
affects: [91 (RPCs públicas + ficha de bio/militancia/comisiones — gate desbloqueado)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI dos-etapas espejo run-camara-lobby-cli: ensamblado condicional real (Fetcher+RateLimiter+RobotsGuard+R2Store+SupabaseWriter) vs dry-run in-memory"
    - "Enlace de senadores por parlid_senado DETERMINISTA (BCN SÍ expone bio:idSenado en la query correcta) — supera el name-match del research A3"
    - "curl-first ante WAF de www.camara.cl para comisiones (34 catálogo + 34 integrantes, rate-limit 2.5-8s con reintento ante 403)"

key-files:
  created:
    - packages/bio/src/run-bio-cli.ts
    - packages/bio/src/run-bio-cli.test.ts
    - .planning/phases/90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co/90-BIO-LEDGER.md
  modified:
    - packages/bio/src/parse-bcn-senadores.ts
    - packages/bio/src/parse-bcn-senadores.test.ts
    - packages/bio/src/__fixtures__/bcn-militancy.json
    - packages/bio/src/run-bio.ts
    - packages/bio/src/index.ts

key-decisions:
  - "El AGENTE corrió la ingesta LIVE (bio = pocas requests, no backfill masivo — precedente pasada-1); apply 0059 dentro de autoridad del agente por DDL aditivo deny-by-default (precedente 0055-0058)"
  - "Senadores: join por parlid_senado (bio:idSenado) en vez de name-match — el research A3 subestimó a BCN; la query correcta SÍ trae idSenado. El name-match queda como fallback documentado"
  - "85 senadores sin match = históricos de BCN fuera de la maestra activa → fail-closed declarado (no bug); cobertura del período vigente = 31/31 (100%)"
  - "parlamentario_bio queda en 0 filas (Known Stub de 90-02): ninguna fuente trae profesión estructurada; militancias+partido+comisiones sí pueblan y desbloquean el gate de 91"

patterns-established:
  - "Corrida LIVE con dry-run PRIMERO (parsea+cuenta, no escribe) → LIVE (Etapa 1 R2 → Etapa 2 PROD)"
  - "Ledger de apply+pgTAP+cobertura N/M por fuente con r2Paths y confirmación de cero FK fabricado"

requirements-completed: [BIO-01, BIO-05]

# Metrics
duration: ~55min
completed: 2026-07-22
---

# Phase 90 Plan 03: run-bio-cli + apply 0059 a PROD + corrida LIVE de bio Summary

**El CLI `run-bio-cli` (dos-etapas, dry-run/from-r2/xml-file/fuente) cierra la fase: la migración 0059 quedó APLICADA a PROD y verificada por pgTAP 28/28, y la bio de diputados (155/155), senadores (31/31 del período) y comisiones (34 comisiones + 386 membresías) está POBLADA en PROD con CERO FK fabricado — declarada N/M por fuente en el ledger. Corrección LIVE clave: la query BCN de senadores usaba una clase inexistente (`bio:Senador` → 0 filas); se corrigió a `bio:idSenado` con join determinista por `parlid_senado`.**

## Performance
- **Duration:** ~55 min
- **Completed:** 2026-07-22
- **Tasks:** 3
- **Files created:** 3 · **Files modified:** 5

## Accomplishments
- **run-bio-cli.ts** (Task 1): entry-point espejo de `run-camara-lobby-cli`. Helpers verbatim (`flagValue`/`flagValues`/`loadEnv` BOM-safe con precedencia `process.env`/`findWorkspaceRoot`/`cargarMaestra`). Flags `--dry-run` (InMemory + sin R2), `--from-r2` (replay sin red), `--xml-file` (catálogo comisiones, WAF curl-first), `--integrantes-file prmId=ruta` (repetible), `--fuente diputados|senadores|comisiones|all`. `buildBioConector` real respeta el ORDEN LOCKED (`assertAllowedUrl → robots.isAllowed → rateLimiter.wait → fetcher.get`): diputados por `opendata.camara.cl` (sin WAF), senadores por BCN SPARQL, comisiones inyectadas por archivo. 8 tests.
- **Apply 0059 + pgTAP** (Task 2): precondición `count=0` verificada → aplicada UNA vez por `psql --single-transaction` (NUNCA `db push`). 4 tablas creadas. pgTAP contra el schema APLICADO: **28 ok / 0 not ok** (RLS on, cero policies, cero grant anon, provenance NOT NULL).
- **Corrida LIVE** (Task 3): dry-run PRIMERO en cada fuente, luego LIVE. **Diputados 155/155** (315 militancias, 155 partidos frescos, 0 sin match). **Senadores 31/31** del período vigente (48 militancias; 85 históricos de BCN sin match, fail-closed declarado). **Comisiones 34 + 386 membresías + 154 diputados** (curl-first contra el WAF, con membresía sin degradar). Idempotencia verificada (re-run → `[skip] sin novedades`). **Cero FK fabricado** (3 checks de integridad en PROD = 0).

## Task Commits
1. **Task 1: run-bio-cli entry-point dos-etapas** - `6099b8a` (feat)
2. **Task 2: aplicar 0059 a PROD + pgTAP 28/28 (ledger)** - `5ad2dce` (feat)
3. **Task 3: corrida LIVE de bio poblada en PROD + fix query BCN senadores** - `6ee0c2d` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `packages/bio/src/run-bio-cli.ts` - Entry-point operador/agente dos-etapas + buildBioConector real.
- `packages/bio/src/run-bio-cli.test.ts` - 8 tests (flags, loadEnv BOM/precedencia/CI, conector acota por fuente + respeta WAF).
- `packages/bio/src/parse-bcn-senadores.ts` - Query corregida (bio:idSenado) + `enlazarSenadoresPorParlid` determinista + `parlidSenado` en el modelo.
- `packages/bio/src/parse-bcn-senadores.test.ts` - +5 tests (query idSenado, mapeo parlid, join determinista, ambigüedad, sin-parlid).
- `packages/bio/src/__fixtures__/bcn-militancy.json` - Fixture con `idSenado` (forma real de la query corregida).
- `packages/bio/src/run-bio.ts` - Senadores por `enlazarSenadoresPorParlid`; sin doble prefijo `SEN:SEN:`; limpieza de periodoSenado.
- `packages/bio/src/index.ts` - Re-exporta helpers del CLI + `enlazarSenadoresPorParlid`.
- `.planning/phases/90-.../90-BIO-LEDGER.md` - Apply + pgTAP + cobertura N/M por fuente + r2Paths + cero FK fabricado.

## Decisions Made
- **El agente corrió la ingesta LIVE + aplicó 0059:** bio = pocas requests (no backfill masivo), migración aditiva deny-by-default — ambos dentro de la autoridad del agente por precedente de pasada-1 (0055-0058). Los backfills masivos (votos/dinero/SERVEL) siguen siendo deuda de operador-LOCAL; la bio no lo es.
- **Senadores por `parlid_senado` (no name-match):** el probe en vivo desmintió el research A3 — BCN SÍ expone `bio:idSenado` cuando la query lo pide. El join determinista es más fuerte y fail-closed ante ambigüedad; el name-match (`enlazarSenadores`) queda como fallback escrito.
- **85 senadores sin match ≠ bug:** son senadores históricos de BCN que no están en la maestra de parlamentarios activos (2026-2034). La cobertura del universo vigente es 31/31.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Query BCN de senadores devolvía 0 bindings (clase inexistente)**
- **Found during:** Task 3 (corrida LIVE senadores: 0 militancias / 0 sin match).
- **Issue:** `BCN_MILITANCY_QUERY` filtraba `?person a bio:Senador` — esa clase NO existe en el grafo BCN (las personas son `foaf:Person`). El spike de 90-02 validó el vocabulario de `Militancy` pero no corrió esta query person-type end-to-end. Resultado: 0 senadores poblados (violaría "senadores INTENTADO y su veredicto DECLARADO").
- **Fix:** Probe en vivo → un senador se distingue por el predicado `bio:idSenado`. Se corrigió la query a `?person bio:idSenado ?idSenado ...` y se añadió `enlazarSenadoresPorParlid` (join determinista por `parlid_senado`, fail-closed ante ambigüedad/ausencia). El name-match queda como fallback.
- **Files modified:** parse-bcn-senadores.ts, parse-bcn-senadores.test.ts, __fixtures__/bcn-militancy.json, run-bio.ts, index.ts
- **Commit:** 6ee0c2d

**2. [Rule 1 - Bug] Doble prefijo `SEN:SEN:` en el reporte de sin-match**
- **Found during:** Task 3 (log de senadores mostraba `SEN:SEN:1009`).
- **Issue:** `enlazarSenadoresPorParlid` ya prefija sus entradas con `SEN:`; el runner las re-prefijaba. Cosmético (no afecta datos), pero ensucia el ledger.
- **Fix:** El runner añade las entradas de sin-match sin re-prefijar.
- **Files modified:** run-bio.ts
- **Commit:** 6ee0c2d

## Threat Surface (threat_model del plan — todas mitigadas)
- **T-90-SPOOF** (falsa atribución): match fail-closed por DIPID exacto (diputados/comisiones) y por `parlid_senado` exacto (senadores); sin-match → skip. 3 checks de integridad en PROD = 0 FK fabricado.
- **T-90-EOP** (apply a PROD): DDL aditivo deny-by-default; pgTAP contra schema aplicado confirma cero grant anon; `--single-transaction` (rollback atómico).
- **T-90-KEY** (service key): `loadEnv` BOM-safe; writer-supabase solo `error.message`; la service key nunca en logs.
- **T-90-WAF** (auto-DoS): rate-limit 2-3s + UA identificatorio; curl-first ante 403 de www.camara.cl con reintento espaciado; 1 request cubre diputados.
- **T-90-SC** (npm installs): cero paquetes nuevos.

## Known Stubs
- **`parlamentario_bio` = 0 filas** (intencional, heredado de 90-02): ninguna fuente probada trae profesión estructurada (research Open Q3). Las militancias + partido + comisiones SÍ pueblan y desbloquean el gate de header de 91. La profesión se resolverá en 91 o en un spike de ficha.

## Issues Encountered
- **WAF intermitente de www.camara.cl:** 7/34 integrantes dieron 403 en la primera pasada; se recuperaron todos con reintento espaciado (5-8s). Ingesta respetuosa mantenida.
- **Paths con espacio en Windows/bash:** la ruta del repo (`OneDrive - pjud.cl`) truncaba los args del CLI cuando se expandía `$ARGS` sin comillas; se resolvió con un array bash (`args+=(...)`) que preserva los espacios. Artefacto de invocación, no del código.

## User Setup Required
None. La corrida LIVE + el apply de 0059 los ejecutó el agente (bio = pocas requests + DDL aditivo, dentro de autoridad). No quedan gates de operador para esta fase.

## Next Phase Readiness
- **Gate de 91 DESBLOQUEADO:** modelo + columna/tabla de bio + membresía (34 comisiones / 386 membresías) + bio de diputados poblada (315 militancias, 155 partidos frescos). Las RPCs públicas de lectura (con `grant execute to anon`) nacen en 91 sobre estas 4 tablas deny-by-default.
- **Fallback senado listo:** `parse-senado-ficha.ts` + `enlazarSenadores` (name-match) quedan escritos si el join por `parlid_senado` no cerrara en una corrida futura.

## Self-Check: PASSED
- Archivos creados: 3/3 FOUND (run-bio-cli.ts, run-bio-cli.test.ts, 90-BIO-LEDGER.md).
- Commits: 3/3 FOUND (`6099b8a`, `5ad2dce`, `6ee0c2d`).
- Verificaciones: `pnpm --filter @obs/bio test` (51 tests, 7 files) · `pnpm test` raíz (1071 package tests + app suite verde) · `tsc -b` exit 0 · pgTAP 0059 = 28 ok / 0 not ok · PROD: 315+48 militancias / 34 comisiones / 386 membresías / 0 FK fabricado.

---
*Phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co*
*Completed: 2026-07-22*
