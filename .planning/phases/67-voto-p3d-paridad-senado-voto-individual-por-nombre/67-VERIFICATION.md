---
phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre
verified: 2026-07-14T00:50:00Z
status: human_needed
score: 4/4 code-verifiable truths verified
overrides_applied: 0
human_verification:
  - test: "Backfill LIVE del Senado a escala vía votaciones.php (67-BACKFILL-SENADO-RUNBOOK.md)"
    expected: "El voto individual del Senado se puebla en la Supabase REMOTA PROD por porEstado (N confirmado / M probable / K no_confirmado); replay --from-r2 reconstruye lotes que fallen en Etapa 2; SC#4 query: senado_no_confirmado_con_fk === 0"
    why_human: "Golpea el WAF tramitacion.senado.cl a escala (rate-limit 2-3s) + write PROD REMOTO — operador-LOCAL por regla LOCKED (autonomous:false, checkpoint:human-action). El agente NO lo ejecutó (0 fetch WAF, 0 write PROD). El CODE deliverable (wire + replay + fail-loud) está verificado offline."
  - test: "Confirmación LIVE de los tokens <SELECCION> reales del Senado (SPIKE gated, A4/Open Q2)"
    expected: "Capturar una respuesta real de votaciones.php, confirmar el set de tokens; si el fail-loud registra un token desconocido en `errores` (etapa senado-votaciones), mapearlo + fijarlo con fixture ANTES del masivo — nunca descartar el voto"
    why_human: "Requiere una respuesta LIVE de la fuente gubernamental; los tokens reales no están confirmados en código. El fail-loud de 67-01 los hace RUIDOSOS (visible en errores) en vez de silenciosos, pero fijar el mapeo es un acto operador."
  - test: "SC#4 en la UI ciudadana: solo `confirmado` se presenta como voto atribuido de la persona"
    expected: "La ficha muestra probable/no_confirmado sin afirmar que es el voto de esa persona; solo confirmado aparece atribuido"
    why_human: "La UI del voto es Phase 68 (fuera de esta fase). En Phase 67 SC#4 está verificado SOLO como invariante de datos (solo confirmado puebla parlamentario_id, Test G). La presentación visual es verificación humana en Phase 68."
---

# Phase 67: VOTO P3d — Paridad Senado (voto individual por nombre) Verification Report

**Phase Goal:** Cerrar el voto individual del Senado a escala, degradando fail-closed donde solo hay nombre — sin fabricar FK.
**Verified:** 2026-07-14T00:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

El deliverable de CÓDIGO de la fase (wire dos-etapas Senado + replay `--from-r2` que reconstruye votos + `mapSeleccion` fail-loud + D-A1 preservado) está VERIFICADO contra el código y las dos suites de tests corridas por el verificador (no según claims del SUMMARY). La corrida LIVE a escala es intencionalmente operador-LOCAL (Plan 02, `autonomous:false`) y se enruta a verificación humana.

### Observable Truths

| # | Truth (Success Criteria ROADMAP) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | El voto individual del Senado se puebla a escala vía `votaciones.php` con dos etapas R2 (`--from-r2`) | ✓ VERIFIED (code) + ⧗ human (live run) | `votXmlSenado` capturado ANTES del parse en `ingest-run.ts:236` y añadido al envelope Etapa 1 (`:290`); `run-camara-votos.ts:221` + `ingest-cli.ts:245` sirven `envelope.votXmlSenado ?? ""`. **Test F** (run-camara-votos.test.ts:572-601): replay `--from-r2` con `votXmlSenado` (y `votXml:null`) reconstruye ≥1 voto Senado con `fuente_voter_id` matcheando `^seq:\d+$`, con conectores que LANZAN si se tocan (0 fetch). El backfill LIVE a escala es Plan 02 (operador). |
| 2 | Vínculo por nombre → probable/no_confirmado con `fuente_voter_id = seq:<n>`; nunca fabrica un FK confirmado | ✓ VERIFIED | **Test G** (:603-635): Coloma (único en la maestra) → `confirmado` + `parlamentario_id=S00500` (D-A1 legítimo = paridad Cámara); Fantasma (ausente) → `estado_vinculo` ∈ {probable, no_confirmado}, `.not.toBe("confirmado")`, `parlamentario_id=null`. Todos los `fuente_voter_id` = `seq:<n>` (Test F). `reconciliar-senado.ts` UNCHANGED (git log `d51c6ed..HEAD` vacío) → el minteo de `confirmado` sigue solo en la rama `determinista`. |
| 3 | `runIngest` degrada fail-closed sin provider Senado — no inventa votos | ✓ VERIFIED | `ingest-run.ts:234-253` envuelve el path Senado en try/catch → registra en `errores` etapa `senado-votaciones`, no aborta el boletín ni fabrica votos. `fakeSenado()` devuelve `<Votaciones></Votaciones>` vacío en los tests de la suite → 0 votos Senado sin lanzar. **Test H** (:637-661): envelope SIN `votXmlSenado` → `errores.length===0`, `votos===0`, sin crash (retro-compat P66). |
| 4 | La UI solo muestra como atribuido lo `confirmado`; lo demás no se presenta como voto de la persona | ✓ VERIFIED (invariante de datos) + ⧗ human (UI Phase 68) | Invariante de disciplina verificado por **Test G**: solo `confirmado` puebla `parlamentario_id`; probable/no_confirmado dejan `parlamentario_id=null`. La UI del voto es Phase 68 → la presentación visual se enruta a verificación humana. |

**Score:** 4/4 truths code-verifiable verified. Aspectos LIVE (backfill a escala SC#1, tokens SELECCION LIVE, UI SC#4) enrutados a human_needed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/tramitacion/src/ingest-run.ts` | envelope R2 con `votXmlSenado` (crudo votaciones.php) | ✓ VERIFIED | `votXmlSenadoCrudo` capturado `:236` (antes del parse → un fallo de parse no pierde el crudo), añadido al envelope `:290`. WIRED → runIngest paso 4. |
| `packages/votos/src/run-camara-votos.ts` | `senadoFake.fetchVotaciones` sirve `envelope.votXmlSenado` en `--from-r2` | ✓ VERIFIED | `:221` `return envelope.votXmlSenado ?? ""`; envelope type gana el campo `:198`. Ruta a `runIngest` `:225`. |
| `packages/tramitacion/src/ingest-cli.ts` | 3.er sitio del envelope sincronizado | ✓ VERIFIED | `:232` type + `:245` senadoFake sirve el crudo. Sincronizado (previsto en el `<action>` de Task 1). |
| `packages/tramitacion/src/parse-senado-votacion.ts` | `mapSeleccion` fail-loud ante token desconocido (D-A4) | ✓ VERIFIED | `:77-90` distingue 3 casos: vacío→null (:79), conocido→Seleccion (:81-84), desconocido→`throw` con token crudo (:86-89). Caller `:210-212` omite solo vacío/ausente. |
| `packages/votos/src/run-camara-votos.test.ts` | Tests F/G/H (replay Senado, D-A1 ambos lados, retro-compat) | ✓ VERIFIED | :571-662 — tests substantivos; Test F/G/H asertan reconstrucción, D-A1 y retro-compat. |
| `packages/tramitacion/src/parse-senado-votacion.test.ts` | Tests D-A4 (token desconocido throw / vacío omite / conocidos sin regresión) | ✓ VERIFIED | :126-164 — token desconocido throw con el token (:134-142), vacío/ausente omite sin lanzar (:144-155), conocidos mapean (:157-163). |
| `packages/tramitacion/src/reconciliar-senado.ts` | UNCHANGED (D-A1 grep-gate) | ✓ VERIFIED | `git log d51c6ed..HEAD -- reconciliar-senado.ts` VACÍO. El reconciliador no se degradó. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ingest-run.ts` paso 4 `senVotXml` | `envelope.votXmlSenado` (Etapa 1 R2) | captura del crudo Senado análoga a votXmlCrudo | ✓ WIRED | `:235-236` fetch→captura; `:290` al envelope. |
| `run-camara-votos.ts` senadoFake | `envelope.votXmlSenado` | `fetchVotaciones() → envelope.votXmlSenado ?? ""` | ✓ WIRED | `:218-222`; consumido por `runIngest` `:225`. Test F prueba la reconstrucción end-to-end. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Replay Senado reconstruye + D-A1 + retro-compat + fail-loud | `pnpm --filter @obs/votos test` | 31 passed (3 files); run-camara-votos 12 tests incl. F/G/H | ✓ PASS |
| mapSeleccion fail-loud + parser Senado + reconciliador sin regresión | `pnpm --filter @obs/tramitacion test` | 150 passed (17 files); parse-senado-votacion 16, reconciliar-senado 6 | ✓ PASS |
| `reconciliar-senado.ts` intacto (D-A1) | `git log d51c6ed..HEAD -- …/reconciliar-senado.ts` | vacío | ✓ PASS |
| Sin debt markers en archivos modificados | grep TBD/FIXME/XXX | ninguno | ✓ PASS |

**Nota:** El "negative/backward-compat" pedido explícitamente está cubierto: **Test H** asserta que un envelope SIN `votXmlSenado` → 0 votos Senado, sin crash (habría fallado antes del fix si el replay dependiera del campo sin `?? ""`); **Test F** habría fallado antes del fix (senadoFake devolvía `""` → 0 votos reconstruidos). El fail-loud de `mapSeleccion` distingue token desconocido (throw) de vacío/ausente (omite legítimo).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTO-01 | 67-01-PLAN | Voto individual del Senado por nombre, dos etapas R2, fail-closed | ✓ SATISFIED (code) | Truths 1-4 code-verifiable; suites verdes. La población LIVE a escala es checkpoint operador (Plan 02). |

### Anti-Patterns Found

Ninguno. Sin debt markers (TBD/FIXME/XXX), sin stubs, sin retornos vacíos que fluyan a render. Los `return null` / `return ""` presentes son ramas legítimas (SELECCION vacío→omite; retro-compat `?? ""`).

### Human Verification Required

Ver frontmatter `human_verification`. Tres ítems, todos por diseño operador-LOCAL / Phase 68:

1. **Backfill LIVE del Senado a escala** (`67-BACKFILL-SENADO-RUNBOOK.md`, Task 2 de Plan 02, `checkpoint:human-action` blocking) — golpea el WAF gubernamental + write PROD REMOTO. El agente NO lo ejecutó (0 fetch WAF, 0 write PROD).
2. **Confirmación LIVE de tokens `<SELECCION>`** (SPIKE gated A4/Open Q2) — requiere respuesta real de `votaciones.php`; el fail-loud los hace ruidosos, fijarlos es acto operador.
3. **SC#4 en la UI** — solo `confirmado` presentado como atribuido; la UI del voto es Phase 68. En Phase 67 SC#4 está verificado SOLO como invariante de datos.

### Gaps Summary

Sin gaps bloqueantes. Todo lo verificable en código está VERIFICADO por lectura del código + ejecución de ambas suites por el verificador (no por claims del SUMMARY):
- El replay `--from-r2` GENUINAMENTE reconstruye los votos del Senado desde `votXmlSenado` (Test F, con conectores que lanzan si se tocan → 0 fetch; el caso backward-compat sin el campo = Test H → 0 votos, no crash).
- `mapSeleccion` LANZA con el token exacto ante un token desconocido (parse-senado-votacion.test.ts:134-142), mientras vacío/ausente sigue omitiéndose legítimamente (:144-155).
- D-A1 ambos lados: único-determinista → confirmado PRESERVADO (Test G); ambiguo/ausente → probable/no_confirmado, nunca confirmado, FK null.
- `reconciliar-senado.ts` git log VACÍO (intacto).
- Sin regresión cross-connector: tramitacion 150/150, votos 31/31.

El estado es **human_needed** (no `passed`) porque hay ítems de verificación humana no vacíos: el backfill LIVE a escala (SC#1 completo), la confirmación de tokens LIVE, y la presentación en UI de SC#4 — todos gated por diseño (operador-LOCAL / Phase 68).

---

_Verified: 2026-07-14T00:50:00Z_
_Verifier: Claude (gsd-verifier)_
