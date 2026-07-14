---
phase: 66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
verified: 2026-07-14T00:15:00Z
status: human_needed
score: 4/4 code-verifiable truths verified (2 data-population truths route to human_needed by design)
overrides_applied: 0
human_verification:
  - test: "Correr el backfill LIVE operador-LOCAL siguiendo 66-BACKFILL-RUNBOOK.md end-to-end (VOTOS_LIVE=1, rate-limit 2-3s, por lotes reanudables)"
    expected: "El voto individual de Cámara queda poblado a escala en Supabase REMOTO; los votos ganan sus PRIMEROS snapshots crudos en R2 (hoy 0); el CLI imprime cobertura N confirmado / M total"
    why_human: "checkpoint:human-action (autonomous:false): golpea el WAF gubernamental y escribe a PROD. Regla LOCKED del proyecto: backfill masivo = LOCAL, NUNCA CI/GitHub Actions. El agente NO ejecutó y NO debe ejecutar VOTOS_LIVE=1."
  - test: "Tras el backfill, confirmar el invariante de cierre dipidsMaestraNoConfirmados === 0 (CLI + query manual del RESEARCH)"
    expected: "0 DIPID de la maestra vigente (camara='diputados', periodo vigente) quedó no_confirmado — el % confirmado NO bajó por name-match"
    why_human: "Requiere los datos reales poblados por la corrida LIVE del operador; no es medible sin la corrida a escala. El código del invariante está probado en ambas direcciones offline, pero el número real depende de la ingesta LIVE."
  - test: "Confirmar en la ficha/superficie que el ciudadano ve cómo votó cada diputado (sí/no/abstención/pareo/ausente) con fuente/fecha/enlace, para una votación real de sala"
    expected: "Cada fila de voto muestra el sentido literal + provenance (origen/fecha_captura/enlace al registro oficial)"
    why_human: "VOTO-01 SC#2 es observable en UI. El modelo + provenance por fila están wired y probados offline; la lectura del dato real de sala requiere la ingesta LIVE. (La SUPERFICIE/UI misma es Phase 68, fuera de alcance de P66.)"
---

# Phase 66: VOTO P3c — Wire dos-etapas Cámara + backfill a escala Verification Report

**Phase Goal:** Poblar el voto individual de Cámara a escala por la ingesta de dos etapas fuente→R2→Supabase — el mismo wire mata DEBT-01 y cumple VOTO-01.
**Verified:** 2026-07-14T00:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

El deliverable AUTOMATIZABLE de esta fase es el **CODE WIRE** dos-etapas (r2Store/snapshotWriter/fromR2 threaded + cobertura + runbook). El backfill LIVE a escala es intencionalmente operador-LOCAL (`autonomous:false`, `checkpoint:human-action`) por regla LOCKED del proyecto (backfill masivo = LOCAL, golpea el WAF + escribe a PROD). El wire está VERIFICADO como real y no inerte; las verdades de población-de-datos se enrutan a `human_needed` por diseño.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | La ingesta de votos escribe crudo content-addressed a R2 (Etapa 1) ANTES de Supabase (Etapa 2), re-ejecutables por separado (`--from-r2`) | ✓ VERIFIED | `runCamaraVotos` threadea `r2Store`/`snapshotWriter` a `runIngest` en el camino NORMAL (run-camara-votos.ts:248-249, spread condicional). `runIngest` ejecuta `putImmutable` (ingest-run.ts:281) ANTES de `upsertVotos` (:344); `existed=true`→`continue` salta Etapa 2 (:289-292). Test A afirma el orden por contador monotónico compartido (`r2.putTicks[0] < writer.upsertVotosTicks[0]`, test:400). `--from-r2` lee `getObject` + conectores fake sin fetch (run-camara-votos.ts:184-237); Test B usa spies que LANZAN si se tocan (test:414-430). 26/26 tests verdes. |
| 2 | El voto individual se persiste con seleccion ∈ {si,no,abstencion,pareo,ausente} + provenance por fila (origen/fecha_captura/enlace), consultable | ✓ VERIFIED (código) / ⏳ dato = human_needed | Test C: `seleccion='ausente'` (código 4, 0019) se persiste sin coacción (test:444-458). Provenance por fila afirmada (test:227-230: origen/fecha_captura/enlace > 0). El cruce DIPID es determinista fail-closed (999 no en maestra → no_confirmado, test:220-224). El DATO poblado real requiere la corrida LIVE del operador → human_needed. |
| 3 | Poblado a escala acotado por `--boletines`/`--limit`, rate-limit 2-3s, backfill LOCAL reanudable, PostgREST `.range()` | ✓ VERIFIED (código+runbook) / ⏳ corrida = human_needed | CLI expone `--limit` (:54), `--boletines-file` (:62-68), `--from-r2` (:71), `--dry-run` (:53). Runbook 66-BACKFILL-RUNBOOK.md (261 líneas, 7 secciones): VOTOS_LIVE=1 gated, rate-limit 2-3s LOCKED, particionado `split -l 200` reanudable por idempotencia, `.order().range()` para paginar. Rate-limit heredado de `HostRateLimiter` (buildCamaraConnector). La corrida misma = operador-LOCAL. |
| 4 | confirmado% NO baja; cobertura medida | ✓ VERIFIED (código) / ⏳ números = human_needed | `reportarCobertura` (cobertura.ts): head+count por estado_vinculo (sin cap 1k) + invariante `dipidsMaestraNoConfirmados` por `.in()` en lotes, NUNCA name-match. cobertura.test.ts prueba el invariante en AMBAS direcciones: ===0 limpio (test:94-105) y >0 cuando se inyecta un DIPID-maestra no_confirmado (test:107-117). El CLI alerta ruidoso si >0 (cli:130-135). Los números reales requieren la corrida LIVE. |

**Score:** 4/4 code-verifiable truths verified. Truths 2/3/4 tienen una componente de población-de-datos que es operador-LOCAL → human_needed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/votos/src/run-camara-votos.ts` | RunCamaraVotosOpts con r2Store/snapshotWriter/fromR2 threaded a runIngest | ✓ VERIFIED | 3 campos opcionales añadidos (:76,:81,:88); threaded en el camino normal (:248-249) y bloque fromR2 (:184-237); guard lanza si fromR2 sin r2Store (:185-189) |
| `packages/votos/src/run-votos-masivo-cli.ts` | --from-r2 replay + cobertura + CONSTRUYE R2Store real | ✓ VERIFIED | `new R2Store({...})` de `.env R2_*` (:78-83, no solo grep); `--from-r2` reenviado (:71,:108); `reportarCobertura` tras writer real (:128); loguea destino REMOTO (:104) |
| `packages/votos/src/cobertura.ts` | Reporte por estado_vinculo + invariante DIPID-maestra | ✓ VERIFIED | Exporta `reportarCobertura` (:95); head+count (:53-59); invariante por `.in()` en lotes (:66-84); NUNCA name-match |
| `packages/votos/src/run-camara-votos.test.ts` | Etapa-1-primero (fake R2) + ausente + --from-r2 sin fetch | ✓ VERIFIED | FakeR2Store con putImmutable/getObject (:269-303); OrderTrackingWriter con contador compartido (:309-335); Tests A/B/B2/C/D |
| `.planning/.../66-BACKFILL-RUNBOOK.md` | Procedimiento operador-LOCAL end-to-end | ✓ VERIFIED | 261 líneas, 7 secciones; flags reales verificados contra el CLI |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| run-camara-votos.ts | runIngest | reenvío r2Store/snapshotWriter (camino normal) | ✓ WIRED | Spread condicional :248-249; Test A prueba Etapa 1 se ejecuta (putTicks > 0) |
| run-camara-votos.ts | R2Store.getObject | modo fromR2 con conectores fake | ✓ WIRED | :191 getObject; :200-218 fakes; Test B: 0 fetch |
| run-votos-masivo-cli.ts | R2Store (construcción) | new R2Store de .env R2_* | ✓ WIRED | :78-83; threaded :114 (no inerte — W-2 honrado) |
| runIngest | putImmutable ANTES de upsertVotos | orden Etapa 1 → Etapa 2 | ✓ WIRED | ingest-run.ts:281 put antes de :344 upsert; existed→continue :289-292 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite offline @obs/votos | `pnpm --filter @obs/votos test` | 26 passed (run-camara-votos 8, cobertura 4, golden-dipid 14) | ✓ PASS |
| Etapa-1-primero por orden de captura | Test A (contador monotónico compartido) | putTicks[0] < upsertVotosTicks[0] | ✓ PASS |
| --from-r2 sin fetch | Test B (spies que lanzan) | votos=3 sin invocar fetch | ✓ PASS |
| Invariante detecta violación | cobertura.test (c) | dipidsMaestraNoConfirmados > 0 al inyectar DIPID-maestra no_confirmado | ✓ PASS |
| Backfill LIVE a escala | operador-LOCAL (VOTOS_LIVE=1) | no ejecutado por diseño | ? SKIP → human_needed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTO-01 | 66-01 | Ciudadano ve voto individual (sí/no/abstención/pareo/ausente) + fuente/fecha/enlace | ✓ SATISFIED (código) / ⏳ dato+UI human | Modelo + seleccion 'ausente' + provenance por fila probados; dato real = corrida LIVE; UI = Phase 68 |
| DEBT-01 | 66-01 | Conectores cumplen dos etapas (source_snapshot R2 crudo) + `--from-r2` replay | ✓ SATISFIED | Votos ahora threadean r2Store/snapshotWriter → producen snapshots R2 (hoy 0); `--from-r2` implementado y probado sin fetch |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno | — | Grep de TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER en packages/votos/src → 0 matches. Sin debt markers. Los fakes viven solo en tests. |

### Guard Verification (el punto de la fase)

| Guard | Status | Evidence |
|-------|--------|----------|
| Wire REAL no inerte — camino NORMAL threadea r2Store | ✓ | run-camara-votos.ts:248-249 (no solo replay) |
| Test prueba putImmutable ANTES de upsert (orden, no presencia) | ✓ | Test A: contador monotónico compartido, putTicks[0] < upsertVotosTicks[0] |
| --from-r2 NO llama Fetcher y reusa writer resuelto | ✓ | Spies que lanzan (Test B) + W-1 reusa writer (:225) |
| CLI operador CONSTRUYE R2Store (no grep de flag) | ✓ | `new R2Store({...})` de .env (:78-83) + threaded (:114) |
| reconciliador/parser/golden intactos (git diff) | ✓ | `git diff` VACÍO en reconciliar-camara.ts, parse-camara-votacion.ts, golden-dipid.ts, supabase/migrations/ a través de los 4 commits de la fase |

### Gaps Summary

No hay gaps que bloqueen el goal automatizable. El code wire está completo, probado (26/26 verde) y verificado como real (no inerte): el camino normal produce Etapa 1 antes de Etapa 2, `--from-r2` reejecuta sin fetch, el CLI construye un R2Store real, y el reconciliador/parser/golden quedan intactos (git diff vacío).

El único trabajo pendiente es el **backfill LIVE a escala**, que es `checkpoint:human-action` (`autonomous:false`) por regla LOCKED del proyecto (backfill masivo = LOCAL; golpea el WAF gubernamental con rate-limit 2-3s y escribe a Supabase PROD). Este es el estado honesto esperado: `human_needed`. Las tres verdades de población-de-datos (VOTO-01 dato+UI, invariante numérico real, cobertura N/M medida) se satisfacen cuando el operador corre `66-BACKFILL-RUNBOOK.md` end-to-end. Señal de reanudación: el operador reporta "backfill hecho" con la cobertura N/M y el conteo del invariante (esperado 0).

---

_Verified: 2026-07-14T00:15:00Z_
_Verifier: Claude (gsd-verifier)_
