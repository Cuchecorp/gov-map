---
phase: 64-voto-p3a-validar-caracterizar-opendata-camara-cl-live-spike
verified: 2026-07-13T22:10:00Z
status: human_needed
score: 4/4 must-haves verified (offline-verifiable); 3 depend on a one-shot gated LIVE probe → human confirmation
overrides_applied: 0
human_verification:
  - test: "Confirmar que el crudo LIVE de getVotacion_Detalle está realmente en R2 (SC#1)"
    expected: "Los 5 objetos content-addressed listados en spike-votacion-detalle.live.test.ts.md existen en el bucket R2 (camara-opendata/getVotacion_Detalle/2026-07-14/<sha>.xml). Re-correr VOTOS_LIVE=1 pnpm --filter @obs/votos exec vitest run --config vitest.live.config.ts src/spike-votacion-detalle.live.test.ts debe pasar (existed=true idempotente) o repersistir."
    why_human: "El probe es describe.skip por defecto, requiere credenciales R2 en .env y golpea el WAF gubernamental (rate-limit 2-3s). El verificador no puede reproducir la escritura R2 ni el fetch LIVE de forma automática. La evidencia (5 r2Path + tabla cross-check 5/5) está documentada pero no es re-ejecutable en CI."
  - test: "Confirmar el cross-check LIVE y la observación de Pareo contra la fuente viva (SC#2/SC#3 LIVE)"
    expected: "La corrida LIVE muestra cross-check Σ(roster)==Total* verde en las 5 votaciones y PAREO observado (parser emite 'pareo' para los DIPID de <Pareos>). Dispensado queda no-observado (TotalDispensados=0) — aceptable y documentado."
    why_human: "Depende de la misma corrida gated LIVE; sólo replicable a mano con VOTOS_LIVE=1 y creds. La semántica está fijada offline por 22 tests deterministas verdes, pero la validación CONTRA LA FUENTE es intrínsecamente one-shot."
---

# Phase 64: VOTO P3a — Validar/caracterizar opendata.camara.cl LIVE (SPIKE) Verification Report

**Phase Goal:** Confirmar la forma VIVA del endpoint bloqueante histórico de P3 antes de cablear producción — la semántica del voto no puede quedar asumida.
**Verified:** 2026-07-13T22:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `OpcionVoto/Opcion Codigo → Selección` fijado por test contra fixture LIVE, incl. abstención code-2 explícita (no asumida) | ✓ VERIFIED | `parse-camara-votacion.ts:359` `if (codigo === "2" || /abstenci/i.test(texto)) return "abstencion"`; test `parse-camara-votacion.test.ts:112-121` asserta code-2→abstención con texto / sin texto / texto raro. Suite green (22 tests en el archivo). |
| 2 | Pareo derivado del bloque `<Pareos>` por DIPID; NO existe rama fabricada `codigo === "3"` | ✓ VERIFIED | `parse-camara-votacion.ts:227-239` recolecta set de DIPID de `<Pareos>`; `:261` re-etiqueta. `grep codigo === "3"` → único match en comentario prohibitivo (`:362`), sin branch ejecutable. Test `:144-153` asserta 10 DIPID → pareo; `:155-158` No-Vota fuera de Pareos → ausente. |
| 3 | Cross-check Σ(roster)==Total* del header; un voto mutado hace THROW ruidoso | ✓ VERIFIED | Test `:205-264`: positivo Σ(si)=58/Σ(no)=81/Σ(abs)=0 cuadra; negativo `:251-263` muta `<Opcion Codigo="0">` → `expect(()=>crossCheck).toThrow(/cross-check FALLÓ/)`. Cross-check por bucket semántico, no por string de label. |
| 4 | Fallback honesto `getVotaciones_Boletin` + re-plan VOTO documentado (SC#4) | ✓ VERIFIED | `spike-votacion-detalle.live.test.ts.md` sección (d): detalle=vía primaria, boletín agregado=contingencia, re-plan del bloque VOTO explícito, conector ya expone `fetchVotacionesBoletin`. |
| 5 | Raw LIVE `getVotacion_Detalle` persistido a R2 content-addressed (SC#1) | ⚠️ HUMAN | Probe `spike-votacion-detalle.live.test.ts:105-117` llama `R2Store.putImmutable(...)`; `.md` documenta 5 r2Path con SHA-256. NO re-ejecutable por el verificador (gated, creds R2, WAF). Ver Human Verification. |

**Score:** 4/4 offline-verifiable truths VERIFIED; truth #5 (LIVE R2 persist) routed to human confirmation (inherently one-shot for a SPIKE).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/tramitacion/src/parse-camara-votacion.ts` | code-2 abstención + pareo-desde-`<Pareos>` + `caracterizarVotacionDetalle` | ✓ VERIFIED | 369 líneas; code-2 branch (`:359`), Pareos set (`:227-239`, `:301-313`), no code-3 branch, header helper exportado. |
| `packages/tramitacion/src/parse-camara-votacion.test.ts` | cross-check ruidoso + pareo assert + code-2 assert | ✓ VERIFIED | 22 tests verdes; cross-check throw-on-mutation, 10 DIPID pareo, code-2 por código. |
| `packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml` | fixture LIVE con `<Pareos>` + header Total* | ✓ VERIFIED | Header 58/81/0/0 (`:20-23`); bloque `<Pareos>` con 5 `<Pareo>` = 10 DIPID (`:1421-1492`). |
| `packages/votos/src/spike-votacion-detalle.live.test.ts` | probe gated que persiste a R2 + hunt + cross-check | ✓ VERIFIED (existencia+wiring) | Gated `VOTOS_LIVE=1`/`describe.skip`; `putImmutable`, `fetchVotacionDetalle`, serial (0 Promise.all), fail-ruidoso si faltan creds. Ejecución LIVE → human. |
| `packages/votos/src/spike-votacion-detalle.live.test.ts.md` | hallazgos: códigos, Pareo/Dispensado, r2Path, fallback | ✓ VERIFIED | Tabla cross-check 5/5, mapeo confirmado, 5 r2Path SHA-256, decisión fallback SC#4. |
| `packages/votos/vitest.live.config.ts` | config deliberada para correr el probe gated | ✓ VERIFIED | Existe; la suite normal excluye `*.live.test.ts` del glob (`vitest.config.ts:11`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `parseCamaraVotoDetalle` | bloque `<Pareos>` | set de DIPID que sobreescribe opción del roster | ✓ WIRED | `:227-239` recolecta, `:261` `if (pareados.has(diputadoId)) opcion = "pareo"`. |
| test | `TotalAfirmativos/Negativos/Abstenciones` | suma roster por Seleccion vs header | ✓ WIRED | `crossCheck` `:219-236` empareja bucket semántico. |
| `spike…live.test.ts` | `R2Store.putImmutable` | STAGE 1 persist content-addressed | ✓ WIRED (offline) / ⚠️ LIVE run → human | `:105`. Ejecución real documentada, no re-ejecutable por verificador. |
| `spike…live.test.ts` | `CamaraConnector.fetchVotacionDetalle` | fetch LIVE rate-limit LOCKED | ✓ WIRED (offline) / ⚠️ LIVE run → human | `:90`, serial for-await, sin override del delay. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Offline suite tramitacion verde | `pnpm --filter @obs/tramitacion test` | 17 files, 145 tests passed | ✓ PASS |
| `.live.test.ts` NO se colecta sin gate | `pnpm --filter @obs/votos test` | Sólo run-camara-votos.test.ts (3 tests); live excluido | ✓ PASS |
| No rama fabricada codigo 3 | `grep codigo === "3"` | 1 match, en comentario prohibitivo | ✓ PASS |
| code-2 abstención presente | `grep codigo === "2"` | 1 match ejecutable (`:359`) | ✓ PASS |
| Exports `caracterizarVotacionDetalle`/`findWorkspaceRoot` | grep index.ts | Ambos exportados | ✓ PASS |
| Corrida LIVE (fetch+R2) | `VOTOS_LIVE=1 … vitest.live.config.ts` | No re-ejecutable (gated, creds, WAF) | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTO-05 (enabler) | 64-01, 64-02 | Validar/caracterizar semántica del voto LIVE antes del wire de producción | ✓ SATISFIED (offline) / ⚠️ LIVE→human | Mapeo fijado por 22 tests deterministas; cross-check ruidoso; fallback documentado. La confirmación CONTRA LA FUENTE + persistencia R2 requiere confirmación humana de la corrida gated. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ningún TBD/FIXME/XXX en los archivos del fase; ningún stub ni valor hardcodeado a UI; `codigo === "3"` sólo en comentario prohibitivo | ℹ️ Info | Ninguno. Dispensado no-observado está honestamente documentado como Open Question para Phase 66, no como stub. |

### Human Verification Required

**1. Confirmar persistencia R2 del crudo LIVE (SC#1)**
- **Test:** Verificar que los 5 objetos content-addressed listados en `spike-votacion-detalle.live.test.ts.md` existen en R2, o re-correr `VOTOS_LIVE=1 pnpm --filter @obs/votos exec vitest run --config vitest.live.config.ts src/spike-votacion-detalle.live.test.ts`.
- **Expected:** Test verde; `putImmutable` retorna r2Path no-vacío (existed=true idempotente aceptable).
- **Why human:** Probe gated (describe.skip), requiere creds R2 en `.env` y golpea el WAF gubernamental con rate-limit 2-3s. No re-ejecutable automáticamente en CI/verificación.

**2. Confirmar cross-check LIVE + Pareo observado (SC#2/SC#3 LIVE)**
- **Test:** En la misma corrida, confirmar cross-check Σ(roster)==Total* verde 5/5 y PAREO observado (parser emite "pareo" para DIPID de `<Pareos>`).
- **Expected:** 5/5 cross-check verde; pareo emitido; Dispensado no-observado (aceptable, documentado).
- **Why human:** Misma corrida gated LIVE; sólo replicable a mano. La semántica está fijada offline (deterministic), la validación contra la fuente es one-shot.

### Gaps Summary

No hay gaps bloqueantes. Las cuatro Success Criteria del roadmap están cubiertas: SC#2 (mapeo, incl. abstención code-2 y pareo-desde-`<Pareos>`, sin código 3 fabricado), SC#3 (cross-check ruidoso con test negativo throw-on-mutation) y SC#4 (fallback honesto documentado) son verificables offline y están VERIFIED. SC#1 (crudo LIVE en R2) y la mitad-LIVE de SC#2/SC#3 dependen de una corrida gated `VOTOS_LIVE=1` que — por ser un SPIKE contra el WAF gubernamental con creds R2 — es intrínsecamente one-shot y no re-ejecutable por el verificador. El SUMMARY documenta la corrida (5 r2Path SHA-256, tabla cross-check 5/5, pareo 5/5, dispensado=0), y el probe está correctamente cableado y gated (verificado: NO se colecta en la suite normal). Se enruta a confirmación humana la evidencia de esa corrida LIVE, no un defecto de implementación.

---

_Verified: 2026-07-13T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
