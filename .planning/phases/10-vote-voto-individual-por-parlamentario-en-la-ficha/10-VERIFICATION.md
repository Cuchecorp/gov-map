---
phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha
verified: 2026-06-19T09:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Aplicar migración 0020 (parlamentario_publico) al remoto sa-east-1 y correr su pgTAP (7/7 esperado)"
    expected: "ALTER/CREATE FUNCTION + GRANT exitosos; pgTAP 0020 7/7 PASS; anon: select partido from parlamentario = 0 filas; parlamentario_publico('P00001') devuelve cabecera sin partido/rut/email"
    why_human: "DDL no se aplica desde build/typecheck; .env tiene BOM (Pitfall 5); aplicar al remoto es paso de operador (igual que 0018/0019). El archivo de migración + pgTAP existen y son correctos por lectura; falta el apply real."
  - test: "Persistir la corrida LIVE de @obs/votos a Supabase (runCamaraVotos con SUPABASE_URL+SERVICE_KEY)"
    expected: "Filas voto escritas; correr 2× deja el conteo estable (idempotente por clave natural); DIPID en maestra → estado_vinculo='confirmado' + parlamentario_id; demás → no_confirmado + null; ninguna fila sin origen/enlace"
    why_human: "La corrida LIVE de red ya se ejecutó (10 votaciones/1389 votos/0 errores/idempotente, A1/A2 confirmados) con InMemoryWriter. La escritura real a DB es no-determinista, rate-limited y queda como paso de operador por diseño (Task 3 de 10-02)."
  - test: "Render visual de /parlamentario/[id] con datos reales en la nube"
    expected: "Cabecera + asistencia + lista paginada + faceta voto×tema + 'Votó distinto a su bancada' + 3 estados honestos, todo legible y trazable a fuente"
    why_human: "Requiere datos en la nube (deuda v1.0: cargar corpus/maestra + wiring app→nube) + apariencia visual/UX. La ruta, RPCs y lógica están listos y testeados por RTL; falta el render end-to-end con datos reales."
deferred: []
---

# Phase 10: VOTE — Voto individual por parlamentario en la ficha — Verification Report

**Phase Goal:** El ciudadano ve, en la ficha del parlamentario, cómo vota cada uno — lista de votos, asistencia, voto por tema y una métrica observable de rebeldías — con la guarda de identidad aplicada y provenance por fila.
**Verified:** 2026-06-19T09:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | VOTE-02: `@obs/votos` ingiere voto individual, enriquece `voto`/`votacion` (no forka), cruza DIPID→id_diputado_camara sin LLM, provenance por fila | ✓ VERIFIED | `run-camara-votos.ts` reusa `runIngest`/`reconciliarVotosCamara` verbatim; FK minteado solo vía `EnlaceConfirmado` (IDENT-12); offline test (3/3) prueba cruce confirmado/no_confirmado, idempotencia (2× → 3 votos estables), provenance por fila, guard de acotación. LIVE de red ejecutada: 10 votaciones/1389 votos/0 errores. DB persistence = operador (human_verification #2). |
| 2 | VOTE-03: ficha muestra lista (A favor/En contra/Abstención/Pareo/Ausente) + asistencia; enlace al parlamentario solo si `estado_vinculo='confirmado'`, si no mención cruda + IdentityMarker | ✓ VERIFIED | `votos-por-parlamentario.tsx` (asistencia §3.3 + lista paginada §3.2 con los 5 chips incl. Ausente); `voto-ficha-row.tsx` guarda: `confirmado = estado_vinculo==='confirmado' && parlamentario_id!=null`, si no → `VotoFichaMencionRow` con `IdentityMarker`, nunca enlaza a `/parlamentario/`. RTL prueba estados (a)/(b) y que 'probable' con id NO enlaza. |
| 3 | VOTE-04: voto×tema (reusa materia de proyecto), sin lenguaje de afinidad ni score | ✓ VERIFIED | Faceta por `proyecto.materia` (público-read, unida por boletín; cero materia fabricada); chips `?materia=slug` con conteos crudos. Gate §9.1 (RTL `container.textContent`) prohíbe afinidad/score/ranking/causal y pasa verde. |
| 4 | VOTE-05: métrica de rebeldías (cuántas veces votó distinto a bancada) como dato bruto, sin juicio | ✓ VERIFIED | RPC `rebeldias_de_parlamentario` (security definer, lee `partido` internamente, emite solo derivado público); heading neutro "Votó distinto a su bancada", conteo+lista+footnote del método, sin etiqueta. RTL prueba conteo, footnote y vacío como hecho (no virtud). |
| 5 | Tres estados honestos (confirmado / presente-no-verificado / no-ingestado); vacío nunca se lee como "limpio" | ✓ VERIFIED | `VotosView`: estado (c) `noIngestado` ≠ `totalVotos===0` (copys distintos); estado (b) mención sin verificar fuera de agregados con IdentityMarker; estado (a) confirmado. RTL prueba que vacío no dice "limpio/leal/100% alineado/impecable". |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/votos/src/run-camara-votos.ts` | runner producción VOTE-02 | ✓ VERIFIED | 177 líneas; ensambla LOCKED, reusa `runIngest`, acotación dura `RunCamaraVotosArgsError`, writer auto por entorno |
| `supabase/migrations/0019_voto_asistencia_y_ficha.sql` | CHECK ausente + índice parcial + 2 RPCs | ✓ VERIFIED | CHECK 5 opciones; índice parcial `voto(parlamentario_id)`; RPC votos (invoker) + rebeldias (definer); grants solo sobre RPCs, cero policy/grant sobre `partido` |
| `supabase/migrations/0020_parlamentario_publico.sql` | RPC cabecera pública sin partido/rut/email | ✓ VERIFIED (apply = operador) | security definer; emite solo columnas públicas; grant execute a anon; cero policy sobre `parlamentario` |
| `app/app/parlamentario/[id]/page.tsx` | ficha shell apilable + sección VOTE | ✓ VERIFIED | valida `PARLAMENTARIO_ID_RE` antes de DB; cabecera vía RPC; distingue 404 de error real (`.maybeSingle`) |
| `app/components/votos-por-parlamentario.tsx` | lista+asistencia+tema+rebeldías+3 estados | ✓ VERIFIED | RSC `VotosSection` + vista pura `VotosView`; conteos solo confirmados; faceta sin score |
| `app/components/parlamentario-header.tsx` | cabecera reusable, partido OMITIDO | ✓ VERIFIED | CamaraChip + nombre + cargo + ProvenanceBadge; chip de partido omitido por LEGAL-03 |
| `app/components/voto-ficha-row.tsx` | guarda de identidad estados (a)/(b) | ✓ VERIFIED | enlace al proyecto siempre; atribución al parlamentario solo si confirmado |
| `app/components/votos-por-parlamentario.test.tsx` | RTL 3 estados + gate §9.1 | ✓ VERIFIED | contiene "identidad no verificada"; 13 tests pasan incl. gate §9.1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `votos-por-parlamentario.tsx` | RPC votos/rebeldias | `createServerSupabase().rpc(...)` | ✓ WIRED | `sb.rpc("votos_de_parlamentario",...)` + `sb.rpc("rebeldias_de_parlamentario",...)`, error real lanza |
| `page.tsx` | RPC parlamentario_publico | `sb.rpc("parlamentario_publico").maybeSingle` | ✓ WIRED | error → throw; sin data → notFound |
| `voto-ficha-row.tsx` | guarda de identidad | `estado_vinculo==='confirmado' && parlamentario_id!=null` | ✓ WIRED | no_confirmado/probable → IdentityMarker, nunca enlaza al parlamentario |
| `run-camara-votos.ts` | FK del voto | `EnlaceConfirmado` vía reconciliarVotosCamara | ✓ WIRED | string crudo no compila (IDENT-12); fail-closed en DIPID fuera de maestra |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VotosSection` | `todas`/`rebeldias` | RPC votos_de_parlamentario / rebeldias_de_parlamentario | RPCs leen tablas reales (voto/votacion/parlamentario) — no static | ⚠️ FLOWING-pending-data: código y RPCs reales, pero la nube aún no tiene datos (deuda v1.0) → render real es human_verification #3 |
| `HeaderSection` | `data` | RPC parlamentario_publico | RPC lee `parlamentario` real | ⚠️ idem — requiere datos en la nube |

Nota: la lógica de flujo es real (RPCs sobre tablas reales, cero hardcode). El único faltante es la presencia de datos en la nube de producción, declarado como paso de operador (deuda v1.0) — no un stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| @obs/votos offline suite (cruce, idempotencia, provenance, guard) | `pnpm --filter @obs/votos test` | 3 passed / 1 skipped (LIVE) / 0 failed | ✓ PASS |
| Parser mapea Abstención(cod 2) por texto + No Vota→ausente | lectura `opcionDeVoto` (`/abstenci/i`, `cod 4` o `/no vota.../`) | mapeo correcto, fail-closed en ilegible | ✓ PASS |
| App suite (incl. gate §9.1 + 3 estados + 13 RTL VOTE) | `pnpm --filter app test` | 82 passed / 0 failed | ✓ PASS |
| Gate §9.1 anti-afinidad/score/causal | RTL assert sobre `container.textContent` | sin términos prohibidos; heading neutro presente | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` declared for this phase. Verification driven by vitest suites + pgTAP (pgTAP apply = operador). Skipped: no project probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTE-02 | 10-02 | Conector @obs/votos cruza DIPID sin LLM, provenance | ✓ SATISFIED | runner + offline test + LIVE de red |
| VOTE-03 | 10-01/10-03 | Lista + asistencia + guarda de identidad | ✓ SATISFIED | migración 0019 + ficha + RTL |
| VOTE-04 | 10-01/10-03 | voto×tema sin score | ✓ SATISFIED | faceta por materia + gate §9.1 |
| VOTE-05 | 10-01/10-03 | Rebeldías como dato bruto | ✓ SATISFIED | RPC security definer + RTL |

No orphaned requirements. All 4 phase requirements implemented and covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `votos-por-parlamentario.tsx` | 438 | `noIngestado: false` (hardcoded) | ℹ️ Info | Documentado: estado (c) "no ingestado" se infiere; hoy `false` cuando hay datos. No es stub — el estado honesto está modelado y testeado (RTL prueba `noIngestado: true`). Wiring del marcador de "no consultado todavía" llega con datos reales. |

No debt markers (TBD/FIXME/XXX) in phase-modified files. No empty handlers, no placeholder copy, no `return null` stubs in user-visible paths.

### Human Verification Required

1. **Aplicar 0020 al remoto + pgTAP** — DDL no probado por build; apply es paso de operador (BOM Pitfall 5). Esperado 7/7 PASS; anon no lee partido; cabecera sin PII.
2. **Persistir corrida LIVE de @obs/votos a Supabase** — red ya validada (10 votaciones/1389 votos/0 errores/idempotente/A1-A2 confirmados con InMemoryWriter); la escritura real a DB es operador.
3. **Render visual de `/parlamentario/[id]` con datos reales** — requiere datos en la nube (deuda v1.0) + revisión visual/UX. Lógica y RPCs listos y testeados.

### Gaps Summary

No code/test gaps. All 5 ROADMAP success criteria are observably implemented and verified in the codebase:
- VOTE-02 runner reuses the LOCKED pipeline, mints `EnlaceConfirmado` (no LLM), is idempotent and fail-closed (offline suite green; LIVE network run executed).
- VOTE-03/04/05 ficha renders list/attendance/by-theme/dissent with the identity guard, the three honest states, and the §9.1 content gate enforced by a passing RTL test.
- LEGAL-03 invariant holds: `partido` is never returned by any RPC nor referenced in any public type/component (only in comments documenting its omission); 0019/0020 add zero policy/grant on `parlamentario`, the only channel to `partido` is the security-definer body.

**Distinguished from operator/deferred items (NOT gaps):**
- Applying migration 0020 + LIVE DB persistence + cloud data load are operator steps by design → routed to human_verification, not failures.
- `app/lib/buscar.test.ts:156` is a pre-existing `tsc --noEmit` typecheck error (TS2532/TS2493) in a Phase-7 file (last touched commit `86073bf`), untouched by Phase 10, documented in `deferred-items.md`. The vitest suite for `buscar.test.ts` runs GREEN (10/10). NOT a regression.

Status is **human_needed** (not passed) solely because the human verification section is non-empty — all automated checks pass.

---

_Verified: 2026-06-19T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
