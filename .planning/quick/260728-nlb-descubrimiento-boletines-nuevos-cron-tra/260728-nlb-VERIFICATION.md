---
phase: quick/260728-nlb
verified: 2026-07-28T21:25:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Quick 260728-nlb: Descubrimiento de boletines nuevos — Verification Report

**Goal:** el cron diario de tramitación descubre boletines nuevos (cap 20/corrida, ≤2 requests extra, degradación honesta, kill-switch) y el 18464-14 + lote acotado quedaron ingeridos en PROD.
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cron incorpora boletines del año en curso ausentes de `proyecto`, cap por corrida, sin tocar schedule | VERIFIED | `run-tramitacion-prod-cli.ts` paso 4: `descubrirNuevosDelAnno({conector, anno: new Date().getUTCFullYear(), corpus, cap: CAP_DESCUBRIMIENTO, log})`; `CAP_DESCUBRIMIENTO = 20`. `leyes-weekly.yml` sin diff en la task (0 commits lo tocan). |
| 2 | Máximo 2 requests extra por corrida | VERIFIED | `descubrirNuevosDelAnno` hace UNA invocación de `conector.enumerarProyectosXAnno(anno)`; el connector ejecuta exactamente `ops = ["retornarMocionesXAnno","retornarMensajesXAnno"]` (connector-camara.ts:145) = 2 ops. Cero fetch hand-rolled en el módulo nuevo. Test `registro.llamadas).toEqual([2026])` confirma una sola invocación. |
| 3 | Fallo del WS → la corrida sigue y loguea `[WARN] descubrimiento omitido: <causa>` | VERIFIED | try/catch en `descubrirNuevosDelAnno` retorna `[]` y loguea el WARN; nunca relanza. Test "degrada honesto a [] con [WARN] cuando el WS lanza (nunca relanza)". |
| 4 | `--sin-descubrimiento` = CERO llamadas al WS, selección byte-equivalente | VERIFIED | `const descubrir = !process.argv.includes("--sin-descubrimiento")` → `descubrir ? await ... : []`. Test KILL-SWITCH con conector espía: `expect(registro.llamadas).toEqual([])`. Con `nuevos=[]`, `intercalarDescubrimiento` devuelve la selección idéntica (test dedicado). |
| 5 | El descubrimiento NO canibaliza la ventana de rotación DEBT-04 | VERIFIED | `seleccionarRotado({... limite: Math.max(0, limite - nuevos.length)})` en el CLI, con comentario LOAD-BEARING explicando el riesgo de offset persistido. Test "INVARIANTE de presupuesto: limite=10 y 3 nuevos → rotación con limite=7 y los 7 rotados sobreviven". |
| 6 | 18464-14 en PROD con `titulo` no vacío y ≥1 `tramitacion_evento` | VERIFIED | psql read-only: `eventos=6`; `proy=1 titulo_ok=true`. Lote completo de 16 boletines presente (`lote_presente=16`); corpus `3675` (coincide con el delta 3.659→3.675 declarado). |

**Score:** 6/6

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/tramitacion/src/descubrimiento-boletines.ts` | VERIFIED | 167 líneas; exporta `CAP_DESCUBRIMIENTO`, `ConectorDescubrimiento`, `crearConectorDescubrimiento`, `seleccionarNuevos`, `intercalarDescubrimiento`, `descubrirNuevosDelAnno`. Sin stubs ni TODO/FIXME. |
| `packages/tramitacion/src/descubrimiento-boletines.test.ts` | VERIFIED | 236 líneas, 18 tests: diff, malformados, dedupe/trim, orden por recencia, desempate por sufijo, cap, intercalado, invariante de presupuesto, kill-switch con espía, degradación honesta. |
| `packages/tramitacion/src/run-tramitacion-prod-cli.ts` | VERIFIED | Cableado real (no orphan): import + llamada + flag + log honesto `+N nuevos descubiertos año YYYY` / `descubrimiento OFF`. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| run-tramitacion-prod-cli.ts | descubrimiento-boletines.ts | `import { CAP_DESCUBRIMIENTO, crearConectorDescubrimiento, descubrirNuevosDelAnno, intercalarDescubrimiento, type ConectorDescubrimiento }` + uso en `boletinesARefrescar` y `run()` | WIRED |
| descubrimiento-boletines.ts | connector-camara.ts | `new CamaraConnector({fetcher, rateLimiter, robots})` → `enumerarProyectosXAnno` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite del paquete | `pnpm --filter @obs/tramitacion exec vitest run` | 19 files, **188 passed** | PASS |
| 18464-14 en PROD | psql read-only SELECT | eventos=6; proyecto 1 fila, titulo no vacío | PASS |
| Lote acotado en PROD | psql read-only SELECT | 16/16 presentes; corpus=3675 | PASS |

### Constraint Compliance (CLAUDE.md LOCKED)

- Rate-limit 2–3s/host, robots.txt, UA y allowlist SSRF NO reimplementados: viven en `CamaraConnector.fetch` (`assertAllowedUrl → robots.isAllowed → rateLimiter.wait(host) → fetcher.get`). El módulo nuevo no importa `Fetcher` para uso directo, solo para ensamblar el connector.
- Presupuesto de red: 1 invocación × 2 ops = 2 requests extra por corrida, incluido `--dry-run` (documentado explícitamente en la cabecera del módulo).
- Sin cambios de cadencia: `.github/workflows/leyes-weekly.yml` y `run-enumerar-historico-cli.ts` sin diff alguno en los commits de la task (verificado con `git show --stat` de 8840e1e/3aba04a/58246d8 y `git log 3e4ea1b..HEAD -- <paths>` → 0).

### Anti-Patterns Found

Ninguno. Sin TODO/FIXME/XXX/HACK ni retornos vacíos hardcodeados en los archivos tocados (los `[]` son ramas de degradación y de kill-switch, ambas cubiertas por test).

### Notas (informativas, no bloqueantes)

- Los tests de invariante de presupuesto y de kill-switch replican en el test la aritmética `Math.max(0, limite - nuevos.length)` en lugar de invocar `boletinesARefrescar` (que exige Supabase). La aritmética real del CLI fue verificada por lectura directa del código y coincide byte a byte con la del test.

### Gaps Summary

Sin gaps. Las seis verdades declaradas se comprueban en el código y en PROD; la suite pasa 188/188 y los archivos protegidos quedaron intactos.

---

_Verified: 2026-07-28T21:25:00Z_
_Verifier: Claude (gsd-verifier)_
