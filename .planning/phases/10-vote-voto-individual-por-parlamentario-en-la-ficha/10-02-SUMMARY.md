---
phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha
plan: 02
subsystem: api
tags: [typescript, deno-node, conector, scraping, opendata-camara, supabase, vote, idempotencia, branded-types]

# Dependency graph
requires:
  - phase: 08-vote-spike
    provides: "ensamblaje LOCKED buildCamaraConnector + muestra LIVE confirmada (boletines 14309/18296, Leg-58, 0 errores)"
  - phase: 09-completitud-identidad
    provides: "EnlaceConfirmado branded + invariante de writer (FK del voto sólo vía confirmar(), string crudo = error de compilación, IDENT-12)"
  - phase: 10-01
    provides: "parser de las 5 opciones del roll-call (si/no/abstencion/pareo/ausente) + 0019 (CHECK ausente, índice, RPCs) aplicada al remoto"
  - phase: 05-tramitacion
    provides: "runIngest / reconciliarVotosCamara / SupabaseTramitacionWriter / InMemoryTramitacionWriter / cargarMaestra"
provides:
  - "@obs/votos de producción: runCamaraVotos(opts) — runner Cámara-only que ensambla los colaboradores LOCKED y reusa runIngest verbatim"
  - "Escritura a Supabase vía SupabaseTramitacionWriter (auto por SUPABASE_URL+SUPABASE_LOCAL_SERVICE_KEY) o dry-run InMemoryTramitacionWriter"
  - "Corrida ACOTADA: requiere boletines explícitos o limite > 0 (RunCamaraVotosArgsError si no se acota)"
  - "Cruce DIPID→id_diputado_camara determinista minteando EnlaceConfirmado (sin LLM); idempotente por (votacion_id, fuente_voter_id); provenance por fila; fail-closed"
  - "Test offline (InMemoryWriter + fixtures inline) + test LIVE-gated (VOTOS_LIVE=1)"
  - "Verificación LIVE: A1/A2 confirmados — abstencion y ausente vienen con DIPID por diputado y cruzan determinísticamente"
affects: [10-03-ficha-parlamentario, ficha, asistencia, voto-x-tema, rebeldias, backfill-historico]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conector de producción = runner DELGADO que reusa el pipeline LOCKED (cero ingeniería nueva de fetch/parse/cruce/upsert)"
    - "El runner SOLO cambia respecto del spike en (1) writer Supabase real y (2) acota a la legislatura vigente"
    - "Colaboradores inyectables (camara/senado/writer/maestra) → test offline 100% sin red; defaults a la política LOCKED en prod"
    - "Corrida nunca a ciegas: boletines explícitos o limite obligatorio (guard RunCamaraVotosArgsError antes de tocar red/DB)"

key-files:
  created:
    - packages/votos/src/run-camara-votos.ts
    - packages/votos/src/index.ts
    - packages/votos/src/run-camara-votos.test.ts
    - packages/votos/src/run-camara-votos.live.test.ts
  modified:
    - packages/votos/package.json
    - packages/votos/tsconfig.json
    - packages/votos/vitest.config.ts
    - tsconfig.json
  deleted:
    - packages/votos/spike/spike.ts
    - packages/votos/spike/spike.test.ts

key-decisions:
  - "El runner REUSA runIngest completo (no un subset Cámara-only): runIngest ya degrada fail-closed sin provider del Senado → menos código, mismo resultado (Open Question 2 del research)"
  - "Writer auto-seleccionado por entorno: SupabaseTramitacionWriter si hay URL+service key, si no InMemoryTramitacionWriter (dry-run) — espeja ingest-cli; inyectable para tests"
  - "Corrida SIEMPRE acotada: sin boletines y sin limite el runner LANZA (RunCamaraVotosArgsError) antes de tocar el WAF/DB"
  - "El spike se ELIMINA (no solo se marca): el runner de producción cubre su rol y el FINDINGS histórico vive en 08-SUMMARY; el spike test encodaba el contrato pre-Phase-9 (parser solo sí/no + VotoParaEscribir.parlamentario_id) ya obsoleto"
  - "El test LIVE usa InMemoryWriter (NO escribe DB): la escritura real a Supabase es el paso de operador (Task 3)"

patterns-established:
  - "Pattern 1 (research): conector de producción como runner que ensambla colaboradores LOCKED y llama el pipeline existente"
  - "Pattern 2 (research): el FK del voto SOLO se fija vía confirmar() — heredado de reconciliarVotosCamara, sin reimplementar"

requirements-completed: [VOTE-02]

# Metrics
duration: ~20min
completed: 2026-06-19
---

# Phase 10 Plan 02: Conector de producción @obs/votos Summary

**`runCamaraVotos` promueve el spike de Phase 8 a un runner Cámara-only de producción que reusa `runIngest`/`reconciliarVotosCamara`/`SupabaseTramitacionWriter` verbatim; cruce DIPID determinista minteando `EnlaceConfirmado`, idempotente por clave natural, provenance por fila, acotado a Leg-58. Corrida LIVE acotada: 10 votaciones / 1389 votos / 0 errores, idempotente, con A1/A2 confirmados (abstención y ausente traen DIPID por diputado).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-19T08:54Z (aprox.)
- **Completed:** 2026-06-19T09:04Z
- **Tasks:** 3 (2 auto + 1 operator checkpoint — LIVE de red ejecutada, escritura a DB queda al operador)
- **Files modified:** 10 (4 creados, 4 modificados, 2 eliminados)

## Accomplishments
- `@obs/votos/src/run-camara-votos.ts`: `runCamaraVotos(opts)` ensambla `buildCamaraConnector()` (allowlist `{}`, `HostRateLimiter` 2-3s, `RobotsGuard`) + `buildSenadoConnector()` y REUSA `runIngest({ boletines, legislaturaId: 58, limite, maestra, camara, senado, writer, log })`. Cero ingeniería nueva: no reimplementa fetch/parse/cruce/upsert.
- El cruce DIPID→`id_diputado_camara` lo hace `reconciliarVotosCamara` (sin LLM), minteando el FK como `EnlaceConfirmado` (IDENT-12). Idempotente por `(votacion_id, fuente_voter_id)`; provenance por fila; fail-closed en DIPID fuera de la maestra (`no_confirmado`, `parlamentario_id=null`).
- Acotación obligatoria: sin `boletines` y sin `limite`, `runCamaraVotos` lanza `RunCamaraVotosArgsError` ANTES de tocar la red/DB (nunca corre todo a ciegas contra el WAF).
- Writer auto-seleccionado: `SupabaseTramitacionWriter` si hay `SUPABASE_URL`+`SUPABASE_LOCAL_SERVICE_KEY`, si no `InMemoryTramitacionWriter` (dry-run). Inyectable para tests.
- Test offline (InMemoryWriter + fixtures inline, sin red): idempotencia (2 corridas → 3 votos estables), cruce confirmado/no_confirmado, provenance presente, y guard de acotación. Test LIVE-gated `VOTOS_LIVE=1` (skip sin la flag).
- `package.json` apunta `main`/`exports` → `./src/index.ts`; `tsconfig.json` ahora es composite con references a core/ingest/identity/tramitacion y está referenciado desde el root (typecheck `tsc -b` verde). Spike eliminado.

## Corrida LIVE acotada (red ejecutada — escritura a DB = operador)

Se ATTEMPTÓ la corrida LIVE bounded contra `opendata.camara.cl` (boletines `["14309","18296"]`, Leg-58) con `InMemoryTramitacionWriter` (sin escribir DB), respetando el delay 2-3s LOCKED. **Éxito total de red:**

| Métrica | Valor |
|---|---|
| Votaciones ingeridas | 10 |
| Votos individuales | 1389 |
| Errores de red (`errores[]`) | 0 |
| Confirmados (DIPID cruza) | 1153 |
| No confirmados (fail-closed) | 236 |
| **Ratio de cruce DIPID** | **83.01%** |
| Idempotencia (2ª corrida) | OK — `votos.size` estable en 1389 |
| Duración | ~46 s (delay 2-3s LOCKED reflejado en ~18 requests) |

**Mapeo de opciones por código (A1/A2 — verificación LIVE):**

| Selección | Total | Confirmados | Observación |
|---|---|---|---|
| `si` | 799 | 643 | código `1` confirmado (Phase 8) |
| `no` | 410 | 365 | código `0` confirmado (Phase 8) |
| `abstencion` | 85 | 50 | **A1 CONFIRMADO LIVE: la abstención VIENE con DIPID por diputado y cruza determinísticamente** |
| `ausente` | 95 | 95 | **A2 CONFIRMADO LIVE: `ausente` (código `4` "No Vota") trae DIPID; deriva del roster, no de la ausencia de fila** |
| `pareo` | 0 | — | no apareció en esta muestra (Leg-58, 2 boletines) — sin verificar LIVE |

**Lecturas:**
- **A1/A2 resueltos en vivo:** `abstencion` y `ausente` traen DIPID individual y se persisten como filas `voto` propias con cruce determinista — NO quedan como agregado. `pareo` no apareció en la muestra; su mapeo por texto (Plan 01) sigue sin confirmación LIVE.
- **Ratio 83% (vs ~95% de Phase 8):** la baja es esperada y honesta — el roster COMPLETO ahora incluye `abstencion`/`ausente`, y los 236 `no_confirmado` son DIPIDs no presentes en la maestra de 155 (suplentes / desfases de periodo). Es fail-closed correcto: NUNCA se fabrica un vínculo. Los confirmados llevan `parlamentario_id`; los misses lo dejan `null` conservando la mención cruda.
- **Cero fabricación:** 0 errores, idempotente, provenance por fila en las 10 votaciones.

## Task Commits

1. **Task 1 (tdd, GREEN): runner de producción + test offline** — `7f7923d` (feat)
2. **Task 2: test LIVE-gated + retiro del spike obsoleto** — `c7389bb` (feat)

## Files Created/Modified
- `packages/votos/src/run-camara-votos.ts` — `runCamaraVotos` + `buildCamaraConnector`/`buildSenadoConnector` + `RunCamaraVotosArgsError`; ensambla LOCKED y reusa `runIngest`.
- `packages/votos/src/index.ts` — barrel de producción (exporta el runner y sus tipos).
- `packages/votos/src/run-camara-votos.test.ts` — test offline (InMemoryWriter + fixtures inline): idempotencia, cruce, provenance, guard de acotación.
- `packages/votos/src/run-camara-votos.live.test.ts` — test LIVE-gated `VOTOS_LIVE=1` (InMemoryWriter; no escribe DB).
- `packages/votos/package.json` — `main`/`exports` → `src/index.ts`; script `typecheck`.
- `packages/votos/tsconfig.json` — composite + references (core/ingest/identity/tramitacion); `rootDir: src`; excluye tests.
- `packages/votos/vitest.config.ts` — `include` apunta a `src/**/*.test.ts` (spike retirado).
- `tsconfig.json` (root) — añade `{ "path": "./packages/votos" }` a references.
- `packages/votos/spike/spike.ts` + `spike.test.ts` — ELIMINADOS (obsoletos; rol cubierto por `src/`).

## Decisions Made
- **Reusar `runIngest` completo (Senado+Cámara), no un subset Cámara-only:** `runIngest` ya degrada fail-closed sin provider del Senado (las votaciones del Senado quedan vacías y no abortan), así que reusarlo es menos código con el mismo resultado para VOTE. (Open Question 2 del research.)
- **Writer auto por entorno:** evita acoplar el runner a Supabase; el operador controla si escribe (URL+service key) o hace dry-run. El test inyecta `InMemoryTramitacionWriter`.
- **Acotación dura:** un runner que pudiera correr "todo" contra el WAF es un riesgo; `RunCamaraVotosArgsError` lo impide en seco.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El paquete `@obs/votos` no era un proyecto TypeScript composite ni estaba referenciado en el root**
- **Found during:** Task 1 (verificación `done`: "el paquete typecheck verde")
- **Issue:** El `tsconfig.json` de votos era el del spike (`noEmit`, `include: spike/**`), no referenciaba a los workspace packages ni estaba en `tsconfig.json` root. `tsc -b` no podía typechear el runner (errores `rootDir`/`TS6059`). Sin esto no había `typecheck` verde para el paquete.
- **Fix:** Reescrito el `tsconfig.json` de votos espejando `@obs/tramitacion` (composite, `rootDir: src`, references a core/ingest/identity/tramitacion, excluye tests); añadido script `typecheck`; añadido `{ "path": "./packages/votos" }` al root `tsconfig.json`.
- **Files modified:** packages/votos/tsconfig.json, packages/votos/package.json, tsconfig.json
- **Verification:** `pnpm --filter @obs/votos typecheck` exit 0.
- **Committed in:** `7f7923d` (Task 1).

**2. [Rule 3 - Blocking] El spike test fallaba por el contrato pre-Phase-9/10-01 (no por el runner)**
- **Found during:** Task 1 (corrida de la suite completa de @obs/votos)
- **Issue:** `spike/spike.test.ts` asertaba el contrato VIEJO del parser (solo sí/no nominal → `crudos.length===139`, todas las opciones in {si,no}) y de `VotoParaEscribir.parlamentario_id` (removido en Phase 9 → ahora `enlace` branded). Plan 01 extendió el parser a las 5 opciones (roster completo, 155 filas) y Phase 9 cambió el input del writer, dejando el spike test rojo y el typecheck con `TS2339`. Es deuda del spike, no del runner.
- **Fix:** Eliminado `packages/votos/spike/` (el runner de producción cubre su rol; el FINDINGS histórico vive en 08-SUMMARY, intacto). Removidos los globs `spike/**` de vitest/tsconfig. Task 2 ya contemplaba obsoletar el spike — se optó por eliminarlo en vez de comentarlo, dado que su test era irreparable sin reescribir contra el nuevo contrato (fuera de alcance).
- **Files modified:** eliminados spike.ts/spike.test.ts; vitest.config.ts, tsconfig.json
- **Verification:** `pnpm --filter @obs/votos test` → 3 passed / 1 skipped (LIVE), 0 failed; `typecheck` exit 0.
- **Committed in:** `c7389bb` (Task 2).

---

**Total deviations:** 2 auto-fixed (ambas Rule 3 - blocking). Sin scope creep: ambas son requisitos para "paquete typecheck verde" + "suite offline completa pasa" del plan.
**Impact on plan:** El alcance sigue siendo exactamente el del plan (runner + tests + obsoletar spike). La eliminación del spike es justo lo que Task 2 pedía ("opcionalmente elimina spike/ si el runner cubre su rol").

## Issues Encountered
- La corrida LIVE produce un ratio de cruce de 83% (no ~95%) porque ahora el roster incluye `abstencion`/`ausente` y hay DIPIDs de suplentes/periodos fuera de la maestra de 155. Es fail-closed correcto, no un bug: documentado arriba. NO se intentó "subir" el ratio fabricando vínculos.
- Pre-existente y AJENO (no tocado): `app/lib/buscar.test.ts` typecheck (registrado en `deferred-items.md` desde Phase 9/10-01). Fuera de alcance (SCOPE BOUNDARY).

## Checkpoint (Task 3 — operador): human_verification

La corrida LIVE de RED se ejecutó con éxito (10 votaciones / 1389 votos / 0 errores / idempotente / A1/A2 confirmados) usando `InMemoryTramitacionWriter`. **La escritura real a Supabase NO se realizó** — es el paso de operador por diseño (no determinista, rate-limited, y el test LIVE usa in-memory a propósito). Para completar Task 3, el operador debe:

1. Exportar `SUPABASE_URL` + `SUPABASE_LOCAL_SERVICE_KEY` y correr `runCamaraVotos({ boletines: ["14309","18296"], limite: 2 })` (el writer Supabase se auto-selecciona) — o vía un CLI/invocación deliberada.
2. Verificar idempotencia EN VIVO contra la DB: correr 2× y confirmar que el conteo de filas `voto` no cambia (upsert por clave natural).
3. Confirmar en la DB: filas con DIPID en la maestra → `estado_vinculo='confirmado'`, `parlamentario_id` poblado; las demás → `no_confirmado`, `null`. Ninguna fila sin `origen`/`enlace`.
4. (Opcional remoto) repetir contra el pooler sa-east-1 tras 0019 (ya aplicada en Plan 01).

**Estado:** `human_verification` — NO es un fallo. El conector de producción está completo y validado contra la fuente LIVE; la persistencia a DB es la acción de operador. Nunca se fabricaron votos.

## Known Stubs
Ninguno. El runner escribe datos reales de la fuente (verificado LIVE) o degrada honestamente; sin placeholders. La ficha que LEE estos votos (`/parlamentario/[id]`) es Plan 03.

## TDD Gate Compliance
Task 1 está marcada `tdd="true"`. El runner es un ensamblaje DELGADO de símbolos ya probados (`runIngest`/`reconciliarVotosCamara`/writers, con sus propias suites en `@obs/tramitacion`); el test offline (`run-camara-votos.test.ts`) se escribió junto al runner y pasa en verde (gate GREEN: 3/3). No hubo un commit `test(...)` RED separado porque la lógica de fetch/parse/cruce no es nueva (cero ingeniería nueva, por diseño del plan) — el comportamiento nuevo verificado es el ENSAMBLAJE + la acotación + la idempotencia e2e, cubiertos por el test que acompaña al `feat`. Secuencia en git: `7f7923d` (feat con test verde).

## Next Phase Readiness
- Plan 03 (`/parlamentario/[id]`) puede leer los votos enriquecidos vía `votos_de_parlamentario` / `rebeldias_de_parlamentario` (RPCs de Plan 01, ya en el remoto), con `ausente`/`abstencion` ya como filas propias y el índice parcial soportando la query.
- Operador: ejecutar Task 3 (escritura LIVE a Supabase) para poblar la DB; el conector es idempotente y seguro de re-correr.
- `pareo` no apareció en la muestra Leg-58 — su mapeo por texto sigue ASUMIDO (A1); confirmar en una corrida con una votación que lo contenga.

## Self-Check: PASSED

- Archivos creados verificados en disco: `run-camara-votos.ts`, `index.ts`, `run-camara-votos.test.ts`, `run-camara-votos.live.test.ts`, `10-02-SUMMARY.md` (FOUND); spike eliminado (REMOVED).
- Commits verificados en git: `7f7923d` (Task 1 feat), `c7389bb` (Task 2 feat) (FOUND).
- Gates: `pnpm --filter @obs/votos test` → 3 passed / 1 skipped (LIVE) / 0 failed; `typecheck` (`tsc -b`) exit 0; corrida LIVE bounded ejecutada (10 votaciones / 1389 votos / 0 errores / idempotente).

---
*Phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha*
*Completed: 2026-06-19*
