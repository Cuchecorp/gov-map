---
phase: 41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt
verified: 2026-06-24T19:45:00Z
status: passed
score: 3/3 must-haves verified (CRUCEN-01/02/03) + 5/5 LOCKED gates held
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
notes:
  - "Apply de 0041 a PROD DIFERIDO por diseño (gate 4 = checkpoint operador). El agente la ESCRIBIÓ pero NO la aplicó. pgTAP 0041 NO corrido (requiere PROD aplicado). Esto es estado intencional, no un gap."
  - "REQUIREMENTS.md L60 deja CRUCEN-01 en [ ] (unchecked) porque el apply de operador está pendiente — coherente con el deferred-apply, no una omisión."
human_verification:
  - test: "Operador aplica 0041 a PROD (psql --db-url --single-transaction) + registra fila en schema_migrations + corre pgTAP 0041 (4/4) y re-corre 0040 (sigue verde)."
    expected: "0041 aplicada, returns table emite fecha_captura, anon SIGUE sin EXECUTE (re-revoke OK)."
    why_human: "DDL contra PROD = checkpoint operador explícito (gate 4 LOCKED). Build/typecheck/vitest NO prueban que Postgres ejecutó el DDL."
  - test: "Render visual de la ficha de parlamentario con cruces (gate ON, post-firma) — confirmar que el ProvenanceBadge ya NO marca amber falso y que 'Reunión registrada el …' se lee como texto factual neutro."
    expected: "Badge fresco (capturedAt = fecha de materialización reciente); fecha de reunión como texto plano sin verbo causal."
    why_human: "Apariencia visual + lectura §9.1 (no insinuación) no es verificable por grep; además la superficie está gated OFF."
---

# Phase 41: CRUCEN — Habilitación de cruces (grant gated + dossier + fecha_captura) Verification Report

**Phase Goal:** Dejar la superficie de cruces (`/parlamentario/[id]` → `CrucesSection`) LISTA para firmar/encender — SIN firmar, encender ni aplicar el grant. 3 deliverables: CRUCEN-01 (fecha_captura proyectada en el RPC, fix WR-02), CRUCEN-02 (grant 0042 escrito NO aplicado), CRUCEN-03 (dossier legal preparado, signoff: pending).
**Verified:** 2026-06-24T19:45:00Z
**Status:** passed (con verificación de operador/humano pendiente para el ENCENDIDO — fuera de alcance de esta fase por diseño)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **CRUCEN-01:** 0041 drop+recreate del RPC con `fecha_captura` en returns table | ✓ VERIFIED | `0041:21` `drop function if exists …(text)`; `0041:30` `fecha_captura timestamptz` última col del returns table; `0041:39` proyecta `cs.fecha_captura` |
| 2 | **CRUCEN-01:** doble revoke re-emitido (gate 5) + CERO grant a anon | ✓ VERIFIED | `0041:50` `revoke … from public`; `0041:51` `revoke … from anon, authenticated`; grant-count (non-comment) = **0**; revoke-count = **2** |
| 3 | **CRUCEN-01:** componente usa `s.fecha_captura` como capturedAt; WR-02 comment removido; meeting date = texto plano | ✓ VERIFIED | `cruces-de-parlamentario.tsx:162` `capturedAt={new Date(s.fecha_captura)}`; `:145` "Reunión registrada el {fechaCorta(new Date(item.fecha))}" (sin verbo causal); "LIMITACIÓN CONOCIDA" ausente (0 matches) |
| 4 | **CRUCEN-01:** `types.ts` añade `fecha_captura: string` a `CruceSenalRpcRow` | ✓ VERIFIED | `types.ts:318` `fecha_captura: string;` dentro de `CruceSenalRpcRow` (L305-319) con JSDoc nivel-señal |
| 5 | **CRUCEN-01:** pgTAP usa `proargnames` (no `pg_get_function_result`), orden exacto + anon-deny + no-PII | ✓ VERIFIED | `0041.test.sql:9` `unnest(proargnames)`; `:17-21` `array_to_string` = `p_id,sector_id,sector_etiqueta,tipo_senal,conteo,evidencia,fecha_captura`; `:25-27` `not has_function_privilege('anon',…)`; `:30-35` no-PII; CERO `pg_get_function_result` |
| 6 | **CRUCEN-02:** 0042 = precondición fail-loud + único grant a anon + cabecera LOUD no-apply | ✓ VERIFIED | `0042:3` banner `████ NO APLICAR EN CORRIDAS AUTÓNOMAS ████`; `0042:29-40` `do $$ … raise exception` si falta fecha_captura; `0042:42` único `grant execute … to anon` (real-grant-count = 1) |
| 7 | **CRUCEN-02:** post-apply pgTAP en `supabase/tests/post-apply/` | ✓ VERIFIED | `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql` existe; asierta `has_function_privilege('anon',…)` = true (espejo INVERTIDO); cabecera `POST-APPLY ONLY`; fuera del glob vitest (`lib/components/app` + `.test.{ts,tsx}`) |
| 8 | **CRUCEN-02:** `0040_cruces_rpc.test.sql` byte-unchanged (guard no-apply-prematuro) | ✓ VERIFIED | git log de `0040_cruces_rpc.test.sql` → último commit `02fbccf` (Phase **36-01**); Phase 41 NO lo tocó. Assert #3 (anon NO execute) intacto |
| 9 | **CRUCEN-03:** dossier en ambos paths, byte-idéntico, signoff pending, secciones vacías, §9 sin marcar | ✓ VERIFIED | `cmp -s` BYTE-IDENTICAL; sha256 `15b13be9…` igual en ambos; `signoff: pending` (L4); `asesor/fecha_signoff/observaciones` = `""`; checked-box count = **0** |
| 10 | **CRUCEN-03:** `nota:` NO contiene literal `signoff: approved`; CRUCES-específico | ✓ VERIFIED | `grep -c "signoff: approved"` = **0** en ambos; §1 agregación intra-bloque `lobby_sector`; §2 sin aristas/caminos; §3 SIN partido/sentido-de-voto (10 menciones "partido", TODAS negaciones); §6 fuente única lobby (NO CC BY 4.0) |

**Score:** 10/10 supporting truths verified → 3/3 deliverables (CRUCEN-01/02/03)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0041_cruces_rpc_fecha_captura.sql` | drop+recreate, fecha_captura, doble revoke, 0 grant | ✓ VERIFIED | 54 líneas; DDL completo, PII-safe (join solo a `sector`) |
| `supabase/migrations/0042_cruces_grant_anon.sql` | fail-loud + único grant + LOUD header, NO aplicada | ✓ VERIFIED | 43 líneas; banner + `do$$ raise exception` + 1 grant; NO en schema_migrations |
| `supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` | proargnames, orden, anon-deny, no-PII | ✓ VERIFIED | plan(4); idiom proargnames |
| `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql` | post-apply, anon EXECUTE = true | ✓ VERIFIED | plan(2); subdir fuera de glob |
| `app/lib/types.ts` | `CruceSenalRpcRow.fecha_captura: string` | ✓ VERIFIED | L318 |
| `app/components/cruces-de-parlamentario.tsx` | capturedAt=fecha_captura, WR-02 removido, texto plano | ✓ VERIFIED | L162/L145; sin "LIMITACIÓN CONOCIDA" |
| `docs/legal/41-LEGAL-DOSSIER-CRUCES.md` | signoff pending, CRUCES-específico | ✓ VERIFIED | 384 líneas; canónico |
| `.planning/phases/41-…/41-LEGAL-DOSSIER.md` | twin byte-idéntico | ✓ VERIFIED | sha256 match |
| `app/lib/cruces-gate.ts` | UNTOUCHED (Candado B) | ✓ VERIFIED | último commit `b09d72f` (Phase **37-01**); Phase 41 NO lo tocó; fail-closed `=== "true"` intacto |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `cruces-de-parlamentario.tsx` | RPC `cruces_de_parlamentario` | `sb.rpc("cruces_de_parlamentario")` | ✓ WIRED | `CrucesSection` L180; consume `s.fecha_captura` → `ProvenanceBadge.capturedAt` |
| `CruceSenalRpcRow.fecha_captura` | render badge | `capturedAt={new Date(s.fecha_captura)}` | ✓ WIRED | tipo (L318) → componente (L162) |
| `0042` (grant) | `0041` (precondición) | `do$$ … 'fecha_captura' = any(proargnames)` | ✓ WIRED | ordering-trap convertido en error duro |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| `CrucesView` | `cruces` (`s.fecha_captura`) | RPC `cruces_de_parlamentario` → `cruce_senal.fecha_captura` (set por `materializar_cruces()` 0039) | ✓ (columna real materializada) — **gated OFF intencionalmente** | ✓ FLOWING (path inalcanzable en prod por doble candado, por diseño) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite frontend completa | `cd app && npx vitest run` | 298/298 (30 files) verde, incl. `cruces-gate.test.ts` 5/5 y `cruces-de-parlamentario` | ✓ PASS |
| Typecheck | `cd app && npx tsc -b` | exit 0 (limpio) | ✓ PASS |
| 0041: 0 grant / 2 revoke | grep non-comment | grant=0, revoke=2 | ✓ PASS |
| 0042: 1 grant real | grep non-comment | grant=1 | ✓ PASS |
| Twin byte-identity | `cmp -s` + `sha256sum` | idéntico (`15b13be9…`) | ✓ PASS |
| pgTAP 0041 contra PROD | `psql -tA -f` | NO corrido (requiere apply de operador) | ? SKIP (deferred a operador, gate 4) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `supabase/tests/0041_…test.sql` | `psql -tA -f` (PROD aplicado) | requiere 0041 aplicada — DIFERIDO | SKIP (operador checkpoint) |
| `supabase/tests/post-apply/0042_…test.sql` | `psql -tA -f` (post-apply) | POST-APPLY ONLY — corre el día del encendido | SKIP (post-encendido) |

_Nota: ambos pgTAP requieren un schema PROD aplicado que esta fase intencionalmente NO produjo (gates 2 y 4). No correrlos es el comportamiento CORRECTO, no un gap._

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CRUCEN-01 | 41-01 | fecha_captura en RPC + componente (fix WR-02) | ✓ SATISFIED (escrito; apply=operador) | 0041 + types + componente + pgTAP, todos en disco; suite verde |
| CRUCEN-02 | 41-02 | grant gated escrito NO aplicado | ✓ SATISFIED | 0042 escrita, NO en schema_migrations; post-apply pgTAP |
| CRUCEN-03 | 41-03 | dossier legal signoff pending | ✓ SATISFIED | dossier ×2 byte-idéntico, pending, §9 sin marcar |

Ningún requisito ORPHANED. Los 3 IDs de REQUIREMENTS.md mapeados a Phase 41 están cubiertos por un plan.

### GATE COMPLIANCE (LOCKED — cualquier violación = FAIL)

| Gate | Regla | Estado | Evidencia |
|------|-------|--------|-----------|
| 1 | NO flipear `crucesPublicEnabled` / `CRUCES_PUBLIC_ENABLED` | ✓ HELD | `cruces-gate.ts` untouched (último = Phase 37-01); `=== "true"` fail-closed intacto; **CERO `CRUCES_PUBLIC_ENABLED` en cualquier .env** (grep vacío) |
| 2 | NO aplicar 0042 a PROD | ✓ HELD | 0042 escrita+commiteada; NO en schema_migrations; cero referencia a 0042 en seeds; cabecera LOUD no-apply |
| 3 | NO firmar el dossier (signoff pending) | ✓ HELD | `signoff: pending`; asesor/fecha/observaciones vacíos; §9 sin marcar; literal `signoff: approved` = 0 ocurrencias |
| 4 | 0041 NO aplicada autónomamente (checkpoint operador) | ✓ HELD | SUMMARY declara DIFERIDO explícito; pgTAP 0041 NO corrido; no se tocó schema_migrations |
| 5 | RPC sigue deny-by-default tras 0041 (re-revoke) | ✓ HELD | `0041:51` `revoke … from anon, authenticated` re-emitido; 0040 test assert #3 intacto; pgTAP 0041 assert #3 lo afirma |
| 6 | Señales factuales, anti-insinuación §9.1, PII-safe | ✓ HELD | GATE §9.1 en componente intacto; "Reunión registrada el …" sin verbo causal; RPC join solo a `sector`; pgTAP no-PII (sin partido/rut/email/donante_id) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ningún TBD/FIXME/XXX en archivos modificados de Phase 41 | — | Sin deuda no auditable |

REQUIREMENTS.md L60 mantiene CRUCEN-01 en `[ ]` (unchecked): NO es un gap — refleja que el apply de operador está pendiente (gate 4). El deliverable de código está completo; el checkbox cierra cuando el operador aplica.

### Human Verification Required

1. **Apply de 0041 a PROD (operador)** — DDL `psql --db-url --single-transaction` + fila schema_migrations + pgTAP 0041 (4/4) + regresión 0040 (sigue verde). _Por qué humano:_ gate 4 LOCKED; build/typecheck no prueban ejecución de DDL.
2. **Render visual de cruces (gate ON, post-firma)** — confirmar badge fresco (no amber falso) + fecha de reunión como texto factual neutro. _Por qué humano:_ apariencia + lectura §9.1; además gated OFF.

### Gaps Summary

**Ninguno.** Los 3 deliverables (CRUCEN-01/02/03) están en disco, sustantivos, cableados y consistentes con el goal "dejar la superficie LISTA para firmar/encender SIN firmar, encender ni aplicar el grant". Los 6 gates LOCKED se sostienen (verificados contra git + .env + disco, no contra el SUMMARY):

- **Candado B intacto** — `cruces-gate.ts` no tocado desde Phase 37; sin flip en .env.
- **0042 inerte** — escrita, no aplicada, no registrada; cabecera LOUD + fail-loud guard.
- **Dossier sin firmar** — pending, §9 en blanco, twin byte-idéntico.
- **Deny-by-default re-emitido** tras drop+recreate (gate 5) — confirmado por revoke-count=2, grant-count=0.
- **0040 test byte-unchanged** — guard de no-apply-prematuro intacto (git: último commit Phase 36).

Suite 298/298 verde + tsc limpio. La única "incompletitud" es intencional y por diseño: el ENCENDIDO (apply 0041/0042 + firma + flip) es trabajo de operador/humano fuera del boundary de esta fase. Un encendido autónomo habría sido el FAIL; su ausencia es el PASS.

---

_Verified: 2026-06-24T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
