---
phase: 63-busq-b-squeda-de-proyectos-completa
plan: 02
subsystem: tramitacion
tags: [scraping, deno-ts, camara, wslegislativo, fast-xml-parser, zod, cli, enumeracion, historico]

# Dependency graph
requires:
  - phase: earlier-tramitacion
    provides: "CamaraConnector (this.fetch LOCKED @obs/ingest), parse-camara-votacion (fast-xml-parser+zod idiom), run-tramitacion-prod-cli (--boletines)"
provides:
  - "parseCamaraLegislativo(xml): NumeroBoletin[] — parser fast-xml-parser + zod del shape ProyectosLeyColeccion>ProyectoLey"
  - "CamaraConnector.enumerarProyectosXAnno(anno): NumeroBoletin[] — mociones+mensajes vía WSLegislativo.asmx, reusa this.fetch LOCKED"
  - "run-enumerar-historico-cli.ts — CLI LOCAL one-shot: --desde/--hasta → lista de boletines para pipe a run-tramitacion-prod-cli --boletines"
affects: ["backfill P03", "cobertura búsqueda", "corpus de proyectos históricos"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enumeración histórica separada de la ingesta: enumerar (P02) → pipe a --boletines (P03)"
    - "Parser zod-validado-por-elemento con descarte fail-closed (inválido se descarta, no lanza)"

key-files:
  created:
    - packages/tramitacion/src/parse-camara-legislativo.ts
    - packages/tramitacion/src/parse-camara-legislativo.test.ts
    - packages/tramitacion/src/run-enumerar-historico-cli.ts
  modified:
    - packages/tramitacion/src/connector-camara.ts

key-decisions:
  - "WSLegislativo.asmx (retornarMocionesXAnno + retornarMensajesXAnno) como fuente de enumeración — confirmado LIVE 2026-07-10; el WS de votaciones devuelve [] al enumerar por año (anti-patrón conocido)"
  - "El método enumera pero NO ingiere: la lista alimenta el camino existente run-tramitacion-prod-cli --boletines (P03 hace el backfill idempotente)"
  - "CLI LOCAL one-shot, isMain con regex propio, NO cableado a ningún cron YAML — coherente con CLAUDE.md (backfill masivo = LOCAL, nunca GH Actions)"

patterns-established:
  - "Enumeración best-effort por op (una op fallida no aborta la otra, se loguea)"
  - "Validación de año/rango (1990..2100) antes de tocar el WS gob (V5, no basura al servidor)"

requirements-completed: [BUSQ-02]

# Metrics
duration: 10min
completed: 2026-07-10
---

# Phase 63 Plan 02: Enumeración histórica de proyectos (WSLegislativo) Summary

**`enumerarProyectosXAnno` + `parseCamaraLegislativo` + un CLI LOCAL cierran BUSQ-02: enumeran los `NumeroBoletin` de mociones y mensajes de cualquier año vía `WSLegislativo.asmx` (fuente verificada LIVE), reusando la política LOCKED de @obs/ingest y validando el shape con zod, para que la lista entre por el camino existente `run-tramitacion-prod-cli --boletines`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-10T02:02Z
- **Completed:** 2026-07-10T02:06Z
- **Tasks:** 3
- **Files modified:** 4 (3 creados, 1 modificado)

## Accomplishments
- **Shape confirmado LIVE (Task 1):** UNA sola llamada con UA identificatorio a `retornarMocionesXAnno?prmAnno=2024` (200 OK, sin WAF). Shape real: root wrapper `<ProyectosLeyColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">`, items `<ProyectoLey>`, boletín en `<NumeroBoletin>` (string "16572-06"), + `Id`/`Nombre`/`FechaIngreso`/`TipoIniciativa`/`CamaraOrigen`. Fixture inline capturado en el test.
- `parseCamaraLegislativo(xml): string[]` — idiom verbatim de `parse-camara-votacion.ts` (`XMLParser({ ignoreAttributes:false, parseTagValue:false })`, `txt`, `asArray`). `ProyectoLeySchema` (zod) valida cada elemento contra `/^\d{3,6}-\d{1,3}$/`; inválidos/vacíos se descartan (no lanzan), dedup, XML sin colección → `[]`.
- `CamaraConnector.enumerarProyectosXAnno(anno)` — valida año 1990..2100 (V5), por cada op en `[retornarMocionesXAnno, retornarMensajesXAnno]` construye la URL con `encodeURIComponent` y llama `this.fetch` (política LOCKED: SSRF allowlist → robots → rate-limit 2-3s → fetcher UA), pasa el XML a `parseCamaraLegislativo`, une en un Set. Best-effort por op (fallo de una op no aborta la otra, se loguea).
- `run-enumerar-historico-cli.ts` — CLI LOCAL `--desde/--hasta [--dry-run]`: valida rango, ensambla `CamaraConnector` con las deps @obs/ingest reales (Fetcher/HostRateLimiter/RobotsGuard, iguales a `ingest-cli`), loop de años → dedup global → filtro `BOLETIN_RE` → imprime lista (una por línea) + una línea `--boletines a,b,c` lista para pipe a `run-tramitacion-prod-cli`. `isMain` con regex propio, exit code `errores ? 1 : 0`, `.catch` con `err.message`. NO cableado a ningún cron YAML.

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Task 1: Fixture LIVE + tests RED** - `9630ae7` (test)
2. **Task 2: parseCamaraLegislativo (GREEN)** - `53ad884` (feat)
3. **Task 3: enumerarProyectosXAnno + CLI LOCAL** - `36f5b1c` (feat)

_TDD: Task 1 (RED) → Task 2 (GREEN); Task 3 sin TDD._

## Files Created/Modified
- `packages/tramitacion/src/parse-camara-legislativo.test.ts` (nuevo) — 5 tests con fixture LIVE inline: múltiples→array, nodo único→array, descarta inválidos + dedup, shape inválido→[], XML vacío→[].
- `packages/tramitacion/src/parse-camara-legislativo.ts` (nuevo) — parser fast-xml-parser + zod (`ProyectoLeySchema`), descarte fail-closed, dedup.
- `packages/tramitacion/src/connector-camara.ts` (modificado) — `import parseCamaraLegislativo`, `BASE_LEG` (WSLegislativo), método `enumerarProyectosXAnno` reusando `this.fetch`.
- `packages/tramitacion/src/run-enumerar-historico-cli.ts` (nuevo) — CLI LOCAL one-shot, deps @obs/ingest reales, dedup + `BOLETIN_RE`, salida pipe-friendly, `isMain` propio.

## Decisions Made
- `WSLegislativo.asmx` como fuente de enumeración (verificado LIVE, sin WAF); el WS de votaciones devuelve `[]` al enumerar por año (anti-patrón conocido documentado en PATTERNS/RESEARCH).
- Enumerar y NO ingerir: separación limpia P02 (enumerar) → P03 (backfill idempotente vía `--boletines`). Un solo camino de ingesta, sin duplicar la máquina de upsert.
- CLI LOCAL one-shot, jamás en cron YAML (CLAUDE.md: backfill masivo = LOCAL). `isMain` con regex propio evita el gotcha "dos entrypoints CLI".

## Deviations from Plan

None - plan executed exactly as written. El shape LIVE confirmó exactamente lo declarado en `<interfaces>` (`ProyectoLey`/`NumeroBoletin`), con el detalle de que el wrapper raíz es `<ProyectosLeyColeccion>` (contemplado por `asArray` + fallback al root). Sin WAF → no hizo falta el fallback `createCurlTransport`.

## Threat Model Compliance
- **T-63-04 (Tampering / SSRF):** URL construida pasa por `assertAllowedUrl` dentro de `this.fetch` (allowlist deny-by-default @obs/ingest LOCKED). ✓
- **T-63-05 (DoS / ráfagas al WS gob):** `rateLimiter.wait(host)` 2-3s + robots + UA identificatorio (política LOCKED); best-effort, sin martillar. La verificación de shape fue UNA sola llamada con UA. ✓
- **T-63-06 (Tampering / año-boletín malformado):** `Number.isInteger` + rango 1990..2100 + `encodeURIComponent` en el connector; `BOLETIN_RE` filtra la salida del CLI. ✓
- **T-63-07 (Tampering / XML malicioso del WS):** `ProyectoLeySchema` (zod) valida por elemento antes de aceptar; inválidos descartados, XML ilegible → `[]` (no lanza). ✓

## Issues Encountered
None. La suite `@obs/tramitacion` verde (17 files, 134 tests), typecheck limpio (`tsc --noEmit` exit 0). Dry-run del CLI verificado (no hace fetch, exit 0); rango inválido falla fast (exit 1). Nota de entorno: `tsx` es devDep del paquete → el CLI se corre `pnpm --filter @obs/tramitacion exec tsx src/run-enumerar-historico-cli.ts ...` (idéntico patrón al prod-CLI), no desde el root.

## Known Stubs
None. El plan entrega CÓDIGO + tests + fixture LIVE; el backfill real (correr la enumeración LIVE contra WSLegislativo por rango de años y pipe a `run-tramitacion-prod-cli`) es P03 por diseño — no es stub, es el alcance declarado.

## User Setup Required
None - el CLI de enumeración no requiere credenciales (WS público). El backfill posterior (P03) usa la service key de `.env` con `run-tramitacion-prod-cli`.

## Next Phase Readiness
- `enumerarProyectosXAnno` + CLI listos para que P03 enumere el histórico (`--desde YYYY --hasta YYYY`) y pipe la lista a `run-tramitacion-prod-cli --boletines`.
- El seed de P01 (`seedFichasPendientes`) + esta enumeración cubren las dos vías de ampliación del corpus (proyectos ya referenciados sin ficha + proyectos históricos no referenciados).
- Sin bloqueos. La enumeración es LOCAL (operador), coherente con CLAUDE.md.

## Self-Check: PASSED

---
*Phase: 63-busq-b-squeda-de-proyectos-completa*
*Completed: 2026-07-10*
