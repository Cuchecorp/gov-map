---
phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co
plan: 02
subsystem: ingesta
tags: [bio, allowlist, minimizacion-pii, fail-closed, dos-etapas, r2, sparql, cheerio, xml, comisiones, vitest, spike]

# Dependency graph
requires:
  - phase: 90-01 (packages/bio scaffold + model.ts + 0059)
    provides: contratos allowlist (BioParlamentario/Militancia/Comision/ComisionMembresia) + claves naturales de upsert
  - phase: 09 (@obs/identity)
    provides: matchDeterminista fail-closed + confirmar()/EnlaceConfirmado (único escritor de FK)
  - phase: 21/24 (@obs/lobby, @obs/ingest)
    provides: plantillas writer-supabase (onConflict + solo error.message) + R2Store dos-etapas + Fetcher/RateLimiter
provides:
  - "parse-diputados.ts: XML retornarDiputadosPeriodoActual → bio con allowlist por construcción (sin PII) + militancia vigente WR-04"
  - "parse-bcn-senadores.ts: sparql-results JSON → Militancia + enlace fail-closed por nombre (A3); vocabulario BCN descubierto"
  - "parse-comisiones.ts: catálogo camara.cl + membresía fail-closed por DIPID (fuente Open Q1 resuelta) + degradación honesta"
  - "writer.ts/writer-supabase.ts: BioWriter idempotente por clave natural + InMemory fake"
  - "run-bio.ts: orquestador dos-etapas fetch→R2 envelope→parse→match→write; --from-r2 replay sin red"
affects: [90-03 (CLI run-bio-cli + apply de 0059 a PROD + corrida LIVE), 91 (RPCs públicas de bio/militancia/comisiones)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist por construcción en 3 parsers: el modelo tipado no declara PII → imposible mapearla; test que muerde con fixture PII sintética"
    - "Dos-etapas con ENVELOPE JSON único content-addressed en R2 (bio/envelope/<fecha>/<sha>.json); --from-r2 replay vía conector-fake"
    - "Match fail-closed heterogéneo: diputados/comisiones por DIPID exacto (===1); senadores por nombre único (matchDeterminista)"

key-files:
  created:
    - packages/bio/src/parse-diputados.ts
    - packages/bio/src/parse-diputados.test.ts
    - packages/bio/src/parse-bcn-senadores.ts
    - packages/bio/src/parse-bcn-senadores.test.ts
    - packages/bio/src/parse-senado-ficha.ts
    - packages/bio/src/parse-comisiones.ts
    - packages/bio/src/parse-comisiones.test.ts
    - packages/bio/src/writer.ts
    - packages/bio/src/writer.test.ts
    - packages/bio/src/writer-supabase.ts
    - packages/bio/src/run-bio.ts
    - packages/bio/src/run-bio.test.ts
    - packages/bio/src/__fixtures__/diputados-periodo-actual.xml
    - packages/bio/src/__fixtures__/bcn-militancy.json
  modified:
    - packages/bio/src/index.ts

key-decisions:
  - "Envelope JSON único para las 3 fuentes (diputados/senadores/comisiones) → un solo objeto content-addressed en R2, un solo short-circuit 'sin novedades', replay simple; espeja el envelope de run-camara-votos"
  - "Comisiones: fuente ELEGIDA = camara.cl comisiones_permanentes.aspx → integrantes.aspx?prmID=N (spike en vivo), membresía por DIPID exacto; staff sin DIPID excluido por construcción"
  - "BCN vocabulario Militancy DESCUBIERTO por mini-spike: hasPoliticalParty / hasBeginning·originalDate / hasEnd·originalDate; join por nombre (BCN sin parlid, A3)"
  - "esActual de senadores = militancia sin FechaTermino (BCN no da un corte limpio); honest-state por fin de rango"

patterns-established:
  - "3 parsers con allowlist por construcción + test que muerde (JSON del modelo no contiene la PII del fixture)"
  - "Orquestador dos-etapas con envelope replay --from-r2 (conector que explota si toca la red)"

requirements-completed: [BIO-01, BIO-05]

# Metrics
duration: ~40min
completed: 2026-07-22
---

# Phase 90 Plan 02: Núcleo net-new de @obs/bio (parsers allowlist + writer idempotente + orquestador dos-etapas fail-closed) Summary

**Los 3 parsers de bio (diputados XML, senadores BCN SPARQL, comisiones camara.cl) con allowlist por construcción probado por test que muerde, el writer idempotente por clave natural, y el orquestador dos-etapas fail-closed con replay `--from-r2` — todo OFFLINE contra fixtures, 38 tests verdes; los dos spikes en vivo (BCN vocabulario + comisiones Open Q1) RESUELTOS con evidencia.**

## Performance
- **Duration:** ~40 min
- **Completed:** 2026-07-22
- **Tasks:** 3
- **Files created:** 14 · **Files modified:** 1

## Accomplishments
- **parse-diputados.ts** (Task 1, TDD): parsea `retornarDiputadosPeriodoActual` leyendo SOLO `<Id>`/nombres/`<Militancias>`. Los nodos `<FechaNacimiento>`/`<RUT>`/`<RUTDV>`/`<Sexo>` NO se leen ni mapean — allowlist por AUSENCIA estructural. "Actual" = militancia con `FechaTermino` abierta/más reciente (WR-04, no la primera del XML). Fail-loud `FechaInvalidaError` ante fecha malformada. Fixture con PII sintética (`12345678-9`, `FechaNacimiento`, `Femenino`); el test que MUERDE verifica que el JSON del modelo no la contiene.
- **parse-bcn-senadores.ts + parse-senado-ficha.ts** (Task 2): cliente SPARQL = `fetch` + `JSON.parse` (cero RDF), query con `URLSearchParams` (sin inyección). Mapea `results.bindings[]` → `Militancia`; enlace a la maestra por NOMBRE determinista (`matchDeterminista`, fail-closed) porque BCN no expone `parlid_senado` (A3). Fallback `parse-senado-ficha.ts` (cheerio por `parlid_senado`) para degradación honesta.
- **parse-comisiones.ts** (Task 2): catálogo desde `comisiones_permanentes.aspx` + membresía desde `integrantes.aspx?prmID=N`, extrayendo SOLO integrantes con DIPID (`mociones.aspx?prmID=<DIPID>`). El staff (Abogado Secretario, sin DIPID) queda excluido por construcción. Degradación honesta: sin fuente de integrantes → catálogo sin membresía.
- **writer.ts / writer-supabase.ts** (Task 3): `BioWriter` idempotente por clave natural (`InMemoryBioWriter` con Map + `SupabaseBioWriter` con `upsert onConflict`). onConflict: bio→`parlamentario_id`, militancia→`parlamentario_id,partido_alias,desde`, comision→`nombre,camara`, membresia→`comision_id,parlamentario_id`. `error.message` de PostgREST únicamente — nunca interpola la service key.
- **run-bio.ts** (Task 3): orquestador dos-etapas. Etapa 1 = envelope JSON content-addressed en R2 (`bio/envelope/<fecha>/<sha>.json`) con short-circuit `existed`. Etapa 2 = parse (allowlist) → MATCH FAIL-CLOSED (diputados/comisiones por DIPID `===1`; senadores por nombre único) → writer + `UPDATE parlamentario.partido` desde la actual. `--from-r2` reconstruye vía conector-fake sin red. Sin match → skip + `sinMatch` (DIPIDs/nombres solo en log local, NO persistidos).

## Task Commits
1. **Task 1: parse-diputados XML allowlist + militancia vigente (test que muerde)** - `1386318` (feat)
2. **Task 2: parsers senadores (BCN SPARQL) + comisiones con spikes en vivo** - `46ebbbf` (feat)
3. **Task 3: writer idempotente + run-bio orquestador dos-etapas fail-closed** - `c0266c5` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Veredictos de los Spikes en Vivo (2026-07-22, curl-first, rate-limit 2-3s, UA identificatorio)

### Spike 1 — BCN SPARQL vocabulario (research A2) — ✅ RESUELTO
`GET https://datos.bcn.cl/sparql` → 200 OK JSON. `SELECT DISTINCT ?pred WHERE { ?m a bio:Militancy ; ?pred ?obj }` reveló los predicados reales de `Militancy` (NO eran `hasParty`/`startDate` como advertía el research):
- **`bcn-biographies#hasPoliticalParty`** → URI del partido (con `rdfs:label` = nombre display)
- **`bcn-biographies#hasBeginning`** → recurso Evento con **`bcn-biographies#originalDate`** = `"YYYY-MM-DD"` (ej. `2006-03-11`)
- **`bcn-biographies#hasEnd`** → ídem; ausente = militancia vigente
- La persona enlaza vía **`?person bcn-biographies#hasMilitancy ?m`**, con `rdfs:label` = nombre de la persona.
**Join:** BCN indexa por `persona/{id}` propio, NO por `parlid_senado` (confirmado, A3) → el enlace a la maestra es por NOMBRE determinista, fail-closed ante homónimo. El fallback `parse-senado-ficha.ts` (cheerio por parlid) queda escrito para la degradación honesta si el join por nombre no cierra en la corrida LIVE (90-03).

### Spike 2 — Comisiones (Open Question 1) — ✅ RESUELTO (fuente elegida, sin degradación)
Curl-first en orden:
- ✗ `opendata.camara.cl` + `opendata.congreso.cl` `WSComisiones.asmx` → **302 /mantencion.html** (confirmado caído, research VERDICT 3).
- ✗ `www.camara.cl/.../citaciones_semana.aspx` → **200** pero SOLO lista sesiones/comisiones, **SIN integrantes**.
- ✅ **ELEGIDA:** `www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx` → 200, catálogo con enlaces `integrantes.aspx?prmID=<N>`. `integrantes.aspx?prmID=4884` (Constitución) → 200, lista **13 integrantes**, cada uno con `<a href=".../diputados/detalle/mociones.aspx?prmID=<DIPID>">Sr. Nombre</a>` + `<strong>Cargo</strong>`. El **DIPID = `id_diputado_camara`** de la maestra (ej. 872, 1009, 1188) → membresía enlazada FAIL-CLOSED por DIPID exacto. El "Abogado Secretario" (staff) NO trae DIPID → excluido por construcción.
**No hubo degradación:** la fuente elegida SÍ trae integrantes identificables. `www.camara.cl` tiene WAF → el fetch va por curl-first (`--html-file`) en el CLI de 90-03 (Pitfall 5).

## Files Created/Modified
- `packages/bio/src/parse-diputados.ts` - Parser XML con allowlist + militancia vigente WR-04 + fail-loud.
- `packages/bio/src/parse-diputados.test.ts` - 7 tests (test que muerde + mapeo + actual + fail-loud).
- `packages/bio/src/parse-bcn-senadores.ts` - Cliente SPARQL (URLSearchParams) + mapeo + enlace fail-closed por nombre.
- `packages/bio/src/parse-bcn-senadores.test.ts` - 5 tests (URL, mapeo, sin PII, fail-closed homónimo/sin-candidato).
- `packages/bio/src/parse-senado-ficha.ts` - Fallback cheerio por parlid_senado (degradación honesta).
- `packages/bio/src/parse-comisiones.ts` - Catálogo + membresía fail-closed por DIPID.
- `packages/bio/src/parse-comisiones.test.ts` - 4 tests (catálogo, DIPID fail-closed, cargo, degradación).
- `packages/bio/src/writer.ts` - BioWriter + InMemoryBioWriter (idempotencia por clave natural).
- `packages/bio/src/writer.test.ts` - 4 tests (idempotencia militancia/comisión/membresía/partido).
- `packages/bio/src/writer-supabase.ts` - SupabaseBioWriter (onConflict + solo error.message).
- `packages/bio/src/run-bio.ts` - Orquestador dos-etapas fail-closed + --from-r2 replay.
- `packages/bio/src/run-bio.test.ts` - 7 tests (DIPID fail-closed, partido actual, --from-r2 sin red, short-circuit, idempotencia, comisiones).
- `packages/bio/src/__fixtures__/diputados-periodo-actual.xml` - 2 diputados con PII sintética + ≥2 militancias.
- `packages/bio/src/__fixtures__/bcn-militancy.json` - sparql-results con la forma real descubierta por el spike.
- `packages/bio/src/index.ts` - Barrel: re-exporta los 3 parsers + writer + runner.

## Decisions Made
- **Envelope JSON único content-addressed:** las 3 fuentes se empaquetan en un `BioEnvelope` → un solo objeto en R2, un solo short-circuit, `--from-r2` trivial. Espeja el envelope de `run-camara-votos.ts`.
- **`esActual` de senadores = fin de rango:** BCN no da un corte limpio de vigencia; la militancia sin `FechaTermino` se marca vigente (honest-state), distinto del corte-fecha de diputados.
- **`comisionKey` compartido writer↔runner:** el runner importa `comisionKey` de writer.ts (no re-implementa la clave) — evita divergencia de separador entre el id del InMemory y la búsqueda del runner (cazado en test).
- **bio 1:1 con `profesion` null en 90:** ninguna fuente probada trae profesión estructurada (research Open Q3); `run-bio` no puebla `parlamentario_bio` aún (poblable en 91/spike de ficha). Las militancias + partido + comisiones SÍ se pueblan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Divergencia de clave natural comisión writer↔runner**
- **Found during:** Task 3 (test de comisiones daba 0 membresías).
- **Issue:** El runner computaba la clave de comisión inline (`${c.nombre}${c.camara}`) mientras el `InMemoryBioWriter` la generaba con su helper `comisionKey`; una divergencia futura de formato rompería el lookup del `comisionId`.
- **Fix:** El runner importa y usa `comisionKey` de writer.ts (fuente única de la clave).
- **Files modified:** packages/bio/src/run-bio.ts
- **Commit:** c0266c5

Fuera de eso, el plan se ejecutó como está escrito. Los dos spikes se resolvieron con fuente elegida (sin activar la degradación honesta), pero el código de degradación (catálogo sin membresía; fallback ficha senado.cl) queda escrito y probado para la corrida LIVE de 90-03.

## Threat Surface (threat_model del plan — todas mitigadas)
- **T-90-PII** (allowlist): 3 parsers no declaran PII; test que muerde verde en diputados; greps de PII a 0 en senadores/comisiones.
- **T-90-SPOOF** (falsa atribución): DIPID exacto `===1` diputados/comisiones; nombre único senadores; sin match → skip, cero FK fabricado (probado).
- **T-90-STALE** (partido stale): "actual" por FechaTermino abierta/más reciente; ambigüedad (2+ actuales) → NO actualiza partido + log (A1).
- **T-90-KEY** (service key): writer-supabase solo `error.message`; `serviceKey` únicamente en `createClient`.
- **T-90-INJ** (SPARQL/XML): query SPARQL por `URLSearchParams` (probado); XMLParser sin entidades externas.

## Known Stubs
- **`parlamentario_bio.profesion` no poblada en 90** (intencional): ninguna fuente probada trae profesión estructurada (research Open Q3). `run-bio` puebla militancias/partido/comisiones; la profesión se resolverá en 91 o en el spike de ficha. NO impide el gate de header de 91 (partido+militancia+comisiones sí lo desbloquean).

## Issues Encountered
- **`tsx -e` con top-level await no imprimía en Windows/PowerShell:** el debug inline de `runBio` (async) no emitía salida; se resolvió escribiendo un `.mts` temporal (eliminado tras el diagnóstico). Artefacto de invocación, no del código.

## User Setup Required
None. La corrida LIVE (fetch real + apply de 0059 a PROD) es 90-03 (checkpoint de operador). Este plan es 100% offline contra fixtures.

## Next Phase Readiness
- **90-03 listo:** `run-bio` + los 3 parsers + el writer existen y compilan; el CLI `run-bio-cli` (flags `--dry-run`/`--from-r2`/`--html-file`) ensambla los colaboradores reales y hace la corrida LIVE acotada (BCN fetch + curl-first para comisiones camara.cl con WAF) + aplica 0059 a PROD por psql + pgTAP. Los veredictos de los spikes (endpoints + vocabulario BCN + membresía por DIPID) están documentados arriba para la corrida.

## Self-Check: PASSED
- Archivos creados: 14/14 FOUND (parsers + tests + writer + runner + 2 fixtures).
- Commits: 3/3 FOUND (`1386318`, `46ebbbf`, `c0266c5`).
- Verificaciones: `pnpm --filter @obs/bio test` (38 tests, 6 files verde) · `pnpm test` raíz (1071 tests, 85 files verde) · `npx tsc -b` (exit 0) · grep PII en parsers = 0 · grep DIPID-match en run-bio (===1, sin name-match diputados) · grep service key en writer-supabase (solo createClient).

---
*Phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co*
*Completed: 2026-07-22*
