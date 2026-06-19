---
phase: 13-compuerta-legal-bloque-money-ley-21-719
verified: 2026-06-19T13:30:00Z
status: human_needed
score: 3/3 buildable success criteria verified (2 human items pending by design)
overrides_applied: 0
human_verification:
  - test: "Asesoría legal externa real (Ley 21.719) revisa y firma el dossier; operador setea signoff: approved en el YAML de 13-LEGAL-DOSSIER.md (canónico + copia docs/legal/)"
    expected: "signoff pasa de pending a approved (o rejected) con asesor + fecha_signoff + observaciones poblados; cierra SC1 (aprobada) y habilita encender MONEY_PUBLIC_ENABLED por la dependencia documentada"
    why_human: "Es un dictamen legal humano (deuda de operador F13). Ningún chequeo programático puede emitir ni sustituir el sign-off de un abogado; por diseño esta corrida autónoma deja signoff: pending."
  - test: "Operador corre el pgTAP 0023 contra la DB remota aplicada: extraer SUPABASE_DB_URL (esquivando BOM U+FEFF) y `supabase test db --db-url <url>`"
    expected: "0023_money_gate.test.sql pasa 3/3 (RLS habilitada + cero policies + anon SELECT-grant=0 sobre lobby_contraparte) junto a 0018/0021/0022 verdes — el piso deny-by-default no se rompió"
    why_human: "El CLI local de Supabase no puede probar la aserción deny-by-default contra el schema aplicado (build/typecheck dan falso positivo, RESEARCH Pitfall 4). Requiere credencial de operador contra el remoto sa-east-1."
deferred:
  - truth: "Wiring del flag moneyPublicEnabled a un consumidor real (ficha MONEY + RPC público)"
    addressed_in: "Phase 14"
    evidence: "13-01 WR-02 (resuelto): el flag se construye por delante de sus llamadores; Phase 14 enruta toda ruta pública MONEY a través de moneyPublicEnabled(process.env). ROADMAP Phase 14 goal: 'El ciudadano ve los contratos del Estado asociados al RUT...'"
---

# Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719) Verification Report

**Phase Goal:** Obtener la aprobación legal explícita antes de exponer públicamente cualquier dato de dinero — gate de proceso, no de construcción, que cubre la superficie de mayor sensibilidad del milestone.
**Verified:** 2026-06-19T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Phase Mode:** mvp (ROADMAP `Mode: mvp`) — but the phase goal is NOT a User Story ("As a... I want to... so that..."). The goal is a process-gate outcome. The MVP User-Flow-Coverage table does not apply; verified against the three ROADMAP Success Criteria directly. This is consistent with a process-gate phase that ships preparation artifacts, not a user-facing flow.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Pasada legal **registrada** y aprobada cubriendo las 3 superficies (republicación de datos públicos / datos sensibles afiliación política / terceros privados donantes-lobistas) | ⚠️ PARTIAL — registered ✓, aprobada = human | Dossier estructura las 3 superficies en secciones 1/2/3 (`docs/legal/13-LEGAL-DOSSIER.md:55-125`), front-matter `signoff: pending` (line 4). El REGISTRO existe y es correcto. La APROBACIÓN es deuda de operador F13 (sign-off humano) — **canonical human_needed item, NOT a gap (by design, operator decision 2026-06-19).** |
| SC2 | Minimización se sostiene (solo lo que la fuente publica; RUT/familiares internos) + propósito fijado y visible | ✓ VERIFIED | Sección 4 Minimización (`:129-149`): RUT/familiares INTERNOS, RUT nunca al LLM (cita `assertPiiDocumentSafeForLlm`, LEGAL-03 marcado VERIFIED), doble candado datos+presentación. Sección 5 Propósito (`:153-161`): transparencia legislativa / control ciudadano, regla rectora "nunca afirma intención ni causalidad". Verificable ahora. |
| SC3 | Sign-off es prerrequisito duro y verificable: ninguna ruta pública MONEY se expone hasta aprobación | ✓ VERIFIED | Flag `moneyPublicEnabled` fail-closed default `false`, solo literal `"true"` enciende (`app/lib/money-gate.ts:30-34`), `import "server-only"` línea 1, sin `NEXT_PUBLIC_`. Vitest 5/5 green (ejecutado). Dossier sección 9 (`:247-260`) documenta que encender depende de `signoff: approved`, verificable por inspección del YAML. Doble candado construido y apagado. |

**Score:** 3/3 buildable criteria verified (SC2, SC3 fully; SC1 registered-half verified, approved-half = intentional human item).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Wiring del flag a consumidor real (ficha + RPC) | Phase 14 | WR-02 resuelto: gate construido por delante de sus llamadores; Phase 14 enruta MONEY a través de `moneyPublicEnabled`. By design para un gate de proceso. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/money-gate.ts` | Flag server-only fail-closed default false | ✓ VERIFIED | `=== "true"` exacto, `import "server-only"` línea 1, sin `NEXT_PUBLIC_`, env inyectado testeable. 34 líneas, sustantivo. |
| `app/lib/money-gate.test.ts` | Vitest default false + solo "true" enciende | ✓ VERIFIED | 5 casos ({}, "false", "1", "TRUE", "true"). Ejecutado: 5/5 passed. |
| `.env.example` | Contrato MONEY_PUBLIC_ENABLED=false documentado | ✓ VERIFIED | Bloque `:40-50` con contrato completo (default OFF, server-only, no NEXT_PUBLIC_, depende de signoff:approved) + `MONEY_PUBLIC_ENABLED=false`. |
| `supabase/tests/0023_money_gate.test.sql` | pgTAP deny-by-default piso PII | ✓ VERIFIED (locally) | `plan(3)`: RLS + is_empty(pg_policy) + anon SELECT-grant=0 sobre `lobby_contraparte`. Ejecución remota = operador. |
| `.planning/.../13-LEGAL-DOSSIER.md` (canónico) | Dossier YAML signoff + 3 superficies + minimización + propósito + licitud + licencia | ✓ VERIFIED | Front-matter completo, secciones 0-10 + anexo. Tono preparación (sin afirmación de licitud). |
| `docs/legal/13-LEGAL-DOSSIER.md` | Copia byte-idéntica | ✓ VERIFIED | `node` confirma IDENTICAL al canónico. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `money-gate.ts` | `process.env.MONEY_PUBLIC_ENABLED` | `=== "true"` fail-closed | ✓ WIRED | Línea 33: `env.MONEY_PUBLIC_ENABLED === "true"`. |
| `0023...sql` | `pg_class.relrowsecurity / pg_policy` | aserción deny-by-default | ✓ WIRED | Las 3 patrones presentes (relrowsecurity, is_empty/pg_policy, role_table_grants). |
| `13-LEGAL-DOSSIER.md` | `MONEY_PUBLIC_ENABLED` (gate 13-01) | nota: encender depende de signoff:approved | ✓ WIRED | Sección 9 + front-matter `nota`. |
| `13-LEGAL-DOSSIER.md` | deuda F13 + ROADMAP SC3 | trazabilidad sign-off | ✓ WIRED | `depende_de: "deuda operador F13; ROADMAP success criterion 3"` + sección 9. |

### Data-Flow Trace (Level 4)

N/A — Phase 13 ships a feature flag (pure boolean) and preparation docs, not dynamic-data-rendering artifacts. No data source to trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Flag fail-closed (default false, solo "true" enciende) | `pnpm vitest run lib/money-gate.test.ts` | 5/5 passed | ✓ PASS |
| Dossier copies byte-idénticas | `node` compare canónico vs docs/legal | IDENTICAL | ✓ PASS |
| signoff state = pending (registro, no aprobado) | inspect YAML line 4 | `signoff: pending` | ✓ PASS |
| Sin fuga al bundle | grep `NEXT_PUBLIC_MONEY` en app/ | 0 matches | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| pgTAP 0023 deny-by-default | `supabase test db --db-url <remote>` | NOT RUN (operator-gated, remote credential) | ? SKIP → human |

The pgTAP is the only artifact that proves "candado A" against the **applied** schema; by the file's own warning (Pitfall 4) build/typecheck are false positives. Operator must run it remotely. Routed to human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LEGAL-01 | 13-01, 13-02 | Pasada de asesoría legal antes del lanzamiento (republicación / datos sensibles / terceros privados) | ⚠️ PARTIAL | Dossier registrado cubriendo las 3 superficies (preparación completa); la aprobación legal humana = deuda F13. Registro satisfecho; aprobación es human item. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `13-LEGAL-DOSSIER.md` | 165-168 | Sección 6 "(reservado)" placeholder | ℹ️ Info | Cosmético; prosa explica el salto de numeración (IN-03 del review). No bloquea. |
| (none) | — | `signoff: pending` / `asesor: ""` empty | ℹ️ Info — NOT a stub | Estado inicial intencional del registro de sign-off; la aprobación es deuda F13 documentada, no un stub de código. |

No debt markers (TBD/FIXME/XXX) in modified files. The empty YAML fields and the dossier's PENDIENTE markers are intentional preparation-document semantics, not unresolved debt. CR-01 (pgTAP targeting a table without the `revoke`) was found in review and **resolved** (commit `fc4cad1`): retargeted to `lobby_contraparte`, confirmed to carry `revoke all ... from anon, authenticated` at `0021_lobby.sql:98`.

### Human Verification Required

#### 1. Sign-off legal humano (cierra SC1 "aprobada")

**Test:** Llevar el dossier `docs/legal/13-LEGAL-DOSSIER.md` a asesoría legal externa real (Ley 21.719). Tras el dictamen, el operador setea en el front-matter YAML (canónico + copia): `signoff: approved` (o `rejected`), `asesor: <nombre>`, `fecha_signoff: <ISO>`, `observaciones: <...>`.
**Expected:** `signoff` deja de ser `pending`; con `approved` se habilita —por la dependencia documentada— encender `MONEY_PUBLIC_ENABLED`. Cierra la mitad "aprobada" de SC1.
**Why human:** Es un dictamen legal humano (deuda de operador F13). Por decisión explícita del operador (2026-06-19, "preparar + construir, exposición gateada"), esta corrida autónoma deja `signoff: pending` deliberadamente. No es un gap.

#### 2. pgTAP 0023 contra el remoto aplicado (cierra el candado A verificado)

**Test:** Extraer `SUPABASE_DB_URL` esquivando el BOM U+FEFF (helper de Phases 9-12) y correr `supabase test db --db-url "<url>"`.
**Expected:** `0023_money_gate.test.sql` pasa 3/3 (RLS habilitada + cero policies + `anon` SELECT-grant=0 sobre `lobby_contraparte`) junto a 0018/0021/0022 verdes.
**Why human:** El CLI local no prueba la aserción contra el schema aplicado (build/typecheck = falso positivo, Pitfall 4). Requiere credencial de operador contra sa-east-1.

### Gaps Summary

**No gaps.** All buildable artifacts of Phase 13 are present, substantive, correctly wired, and behaviorally verified:

- **SC3 (hard prerequisite / fail-closed gate)** is fully VERIFIED now: the flag is server-only, default-OFF, only the literal `"true"` enables it (Vitest 5/5 green by execution), it never carries `NEXT_PUBLIC_`, and the dossier documents `signoff: approved` as the hard dependency for enabling it — verifiable by inspection.
- **SC2 (minimization + purpose)** is fully VERIFIED now: documented with VERIFIED technical evidence (RUT internal, RUT never to LLM, deny-by-default RLS) and a visible, bounded purpose.
- **SC1 (legal pass registered + approved)** is half-VERIFIED: the dossier is *registered* — structured by the 3 LEGAL-01 surfaces, `signoff: pending`, license corrected per-dataset (ChileCompra = mention-of-source NOT CC BY; CC BY only InfoProbidad), tone strictly preparation (no compliance claim). The *approved* half is the human legal sign-off — operator debt F13, intentionally NOT done in this autonomous run per the operator's explicit "prepare + build, gated exposure" decision.

The two outstanding items (human legal sign-off → `signoff: approved`; operator-run remote pgTAP 0023 → 3/3 green) are **by design**, not defects. Status is therefore `human_needed`, not `gaps_found`. The code-review Critical (CR-01) was resolved before this verification.

---

_Verified: 2026-06-19T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
