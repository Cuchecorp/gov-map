---
phase: 73-dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano
verified: 2026-07-14T22:30:00Z
status: human_needed
score: 3/3 automated must-haves verified (4th criterion is operator-exclusive)
overrides_applied: 0
human_verification:
  - test: "BrowserOS cold-read (gated-preview) sobre las 4 superficies MONEY con MONEY_PUBLIC_ENABLED=true SOLO en preview local"
    expected: "Veredicto 'comprensible' sobre los 6 puntos del UI-SPEC §Gate: (a) contrato/aporte se lee como HECHO, no acusación; (b) 'por RUT exacto' (contratos) distinto de 'por nombre confirmado' (aportes), no conflados; (c) monto verbatim, 'No publicado' ≠ '$0'; (d) cero verbo causal / cero rojo-verde de severidad; (e) frescura por dato visible; (f) enlace a la fuente oficial por fila"
    why_human: "Requiere deploy/preview real + datos + juicio de comprensión visual (lectura fría). No verificable por grep. Apagar el flag tras el cold-read."
  - test: "Sign-off legal 21.719 con asesor externo sobre docs/legal/13-LEGAL-DOSSIER.md"
    expected: "SOLO el operador setea signoff: approved + asesor + fecha_signoff en el front-matter YAML tras revisión del abogado externo"
    why_human: "Acto legal humano exclusivo (deuda de operador F13). El agente NUNCA firma."
  - test: "Flip de MONEY_PUBLIC_ENABLED=true en el .env de prod"
    expected: "SOLO tras signoff: approved, el operador enciende el flag en prod"
    why_human: "Acto humano exclusivo condicionado al sign-off legal. El agente construye hasta el gate; el encendido es humano."
---

# Phase 73: DINERO P5e — Superficies MONEY gated OFF + linter + GATE LEGAL humano — Verification Report

**Phase Goal:** Montar todas las superficies de dinero detrás del gate deny-by-default; el agente construye hasta el gate, el encendido es acto humano (sign-off 21.719).
**Verified:** 2026-07-14T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Toda superficie MONEY se renderiza SOLO vía `moneyPublicEnabled` (fail-closed `=== "true"`, OFF default); ninguna ruta lee la env cruda | ✓ VERIFIED | `money-gate.ts:33` sigue `=== "true"` (UNCHANGED). Las 4 superficies + `/contraparte` page gatean con `if (!moneyPublicEnabled(process.env)) return null / notFound()`. `grep MONEY_PUBLIC_ENABLED` fuera de money-gate.ts (no-test) → 1 hit, en un COMENTARIO (contraparte page.tsx:36), strippeado por el guard. Guard vector-3 (walk app/) VERDE. |
| 2 | Cada superficie: procedencia + leyenda anti-insinuación; "empresa ligada" solo RUT-exacto, nunca name-match/LLM; conteos factuales | ✓ VERIFIED | `LEYENDA_ANTI_INSINUACION_MONEY` (single-source) importado y renderizado 1× por estado en las 4 superficies. `ProvenanceBadge` por fila. Ficha contratos: "Enlazado por RUT al parlamentario." (RUT-exacto). Ficha financiamiento: "Asociado por nombre confirmado al candidato." (NUNCA "por RUT"). Conteo neutro sin suma/ranking. |
| 3 | Un guard CI impide que un commit de agente flipee el flag/default a "true"; el flip requiere signoff: approved (humano) | ✓ VERIFIED | `money-antiflip-guard.test.ts` (12 tests VERDE): 3 vectores (fail-closed, `.env.example=false`, no-raw-env-en-ruta) + mutation self-check en memoria (muerde ante Boolean laxo, `!== "false"`, `=true` en env, raw-env en ruta). `.env.example:64` = `false`. Dossier 13 `signoff: pending`. |
| 4 | Veredicto BrowserOS "comprensible" gated-preview | ⏸ HUMAN | Operator-exclusive (73-04 `checkpoint:human-verify`, `autonomous: false`). Requiere deploy/preview + juicio visual. Routed to human_needed. |

**Score:** 3/3 automated truths verified; truth 4 is operator-exclusive by design.

### Adversarial Checks (per verification_context)

| Check | Result | Evidence |
|-------|--------|----------|
| (a) money-gate.ts UNCHANGED + `=== "true"` fail-closed | ✓ PASS | `money-gate.ts:33` `return env.MONEY_PUBLIC_ENABLED === "true";` — sin Boolean laxo ni `!== "false"`. |
| (a) `.env.example` still `false` | ✓ PASS | `.env.example:64` `MONEY_PUBLIC_ENABLED=false`. |
| (a) dossier still `signoff: pending` | ✓ PASS | `13-LEGAL-DOSSIER.md:4` `signoff: pending`. Agent did NOT flip anything. |
| (b) anti-flip guard genuinely BITES | ✓ PASS | Self-check A (Boolean/`!== "false"`), B (env=true), C (raw-env en ruta con relPath no-chokepoint) todos reportan violación en memoria; base válida → 0 offenders. A real raw-env read in a route WOULD be caught: vector-3 walks app/, strips comments, FAILs on any `.ts/.tsx` (≠ lib/money-gate.ts) naming the flag; allowlist is a single nominated path. |
| (c) legend single-source, rendered once per surface | ✓ PASS | Constante única en `money-presentacion.ts`; `LeyendaMoney()` 1× por rama de estado en las 4 superficies. RUT-exact ("Enlazado por RUT") vs by-name ("Asociado por nombre confirmado") never conflated. |
| (d) linter bites on injected money causal term but NOT on "Enlazado por RUT"/legend | ✓ PASS | `anti-insinuacion-guard.test.ts` (16 VERDE): caza "financió"/"a cambio de"/"empresa ligada a"/"corrupción"/"conflicto de interés"/"contrato a dedo" inyectados; NO dispara sobre "Enlazado por RUT", "Asociado por nombre confirmado", `empresa_ligada_por_rut`, ni la leyenda MONEY (restada en NEGACIONES_LOCKED, importada verbatim). |
| (e) monto VERBATIM (null→"No publicado", not "$0") | ✓ PASS | Las 4 superficies: `{c.monto ?? "No publicado"}` / `{a.monto ?? "No publicado"}`. Nunca "$0". |
| `pnpm --filter ./app test` | ✓ PASS | 74 test files, 809 tests passed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/money-gate.ts` | UNCHANGED, `=== "true"` fail-closed | ✓ VERIFIED | Chokepoint intacto; solo lo lee el guard. |
| `app/lib/money-presentacion.ts` | LEYENDA_ANTI_INSINUACION_MONEY single-source verbatim | ✓ VERIFIED | Export único, texto LOCKED verbatim, sin server-only. |
| `app/lib/money-antiflip-guard.test.ts` | Guard 3 vectores + mutation self-check | ✓ VERIFIED | 308 líneas, 12 tests VERDE, detectores puros ejercidos en memoria. |
| `app/lib/anti-insinuacion-guard.test.ts` | Extendido a las 4 superficies MONEY + /contraparte | ✓ VERIFIED | SUPERFICIES_MONEY[], blocklist causal con tildes, leyenda restada, 16 tests VERDE. |
| `app/components/contratos-de-parlamentario.tsx` | Gate + legend + RUT-exacto + monto verbatim | ✓ VERIFIED | Gated, "Enlazado por RUT", "No publicado". |
| `app/components/financiamiento-de-parlamentario.tsx` | Gate + legend + nombre-confirmado + monto verbatim | ✓ VERIFIED | Gated, "Asociado por nombre confirmado", nunca "por RUT". |
| `app/components/contratos-por-contraparte.tsx` | Gate + legend + monto verbatim | ✓ VERIFIED | Gated, legend 1×/estado, "No publicado". |
| `app/components/aportes-por-contraparte.tsx` | Gate + legend + monto verbatim | ✓ VERIFIED | Gated, legend 1×/estado, "No publicado". |
| `docs/legal/13-LEGAL-DOSSIER.md` | signoff: pending conservado | ✓ VERIFIED | `signoff: pending`; flip condicionado a `signoff: approved`. |
| `.env.example` | MONEY_PUBLIC_ENABLED=false | ✓ VERIFIED | Línea 64 `=false`. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| money-antiflip-guard.test.ts | money-gate.ts | readFileSync + regex `=== "true"` | ✓ WIRED |
| money-antiflip-guard.test.ts | app/ (walk recursivo) | walkSourceFiles, FAIL si flag fuera de money-gate.ts | ✓ WIRED |
| anti-insinuacion-guard.test.ts | money-presentacion.ts | import LEYENDA_ANTI_INSINUACION_MONEY → NEGACIONES_LOCKED | ✓ WIRED |
| 4 superficies | money-gate.ts | `moneyPublicEnabled(process.env)` gate | ✓ WIRED |
| 4 superficies | money-presentacion.ts | import + render LEYENDA_ANTI_INSINUACION_MONEY | ✓ WIRED |
| dossier 13 (signoff) | money-gate.ts (flip) | el flip depende de signoff: approved (humano) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Anti-flip guard bites (3 vectors + self-check) | `pnpm --filter ./app test money-antiflip-guard` (via full suite) | 12/12 passed | ✓ PASS |
| Linter bites on money causal terms, not on facts/legend | `pnpm --filter ./app test anti-insinuacion-guard` (via full suite) | 16/16 passed | ✓ PASS |
| Full app suite (no regression) | `pnpm --filter ./app test` | 809 passed / 74 files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MONEY-04 | 73-01/02/03 | Single-source legend + procedencia + RUT-exacto vs nombre + monto verbatim en las 4 superficies; linter anti-insinuación | ✓ SATISFIED | Legend single-source rendered per surface; linter extended + green; RUT/name distinction not conflated. |
| MONEY-05 | 73-01/04 | Agente construye hasta el gate; guard CI impide flip por agente; flip requiere signoff: approved | ✓ SATISFIED | Anti-flip guard green with 3 vectors + self-check; gate/env/dossier all UNCHANGED (OFF). Flip is human. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno | — | No TBD/FIXME/XXX/TODO/HACK en los archivos modificados. `return null` en gates es intencional (deny-by-default OFF), no un stub. |

### Human Verification Required

The gate/guard/legend/linter are solid (all automated criteria VERIFIED). The remaining items are operator-exclusive by design (73-04 `autonomous: false`, `checkpoint:human-verify`):

**1. BrowserOS "comprensible" gated-preview**
- **Test:** Encender MONEY_PUBLIC_ENABLED=true SOLO en preview local; correr lectura fría BrowserOS (CDP) sobre las 4 superficies MONEY (patrón 68-BROWSEROS-GATE.md); apagar el flag tras el cold-read.
- **Expected:** Los 6 puntos del UI-SPEC §Gate se leen "comprensible" (hecho no acusación; RUT-exacto ≠ nombre-confirmado; monto verbatim ≠ "$0"; cero causal/severidad; frescura por dato; enlace por fila).
- **Why human:** Requiere deploy/preview + datos + juicio visual.

**2. Sign-off legal 21.719**
- **Test:** Revisar docs/legal/13-LEGAL-DOSSIER.md con asesor externo; setear signoff: approved + asesor + fecha_signoff.
- **Expected:** El operador (no el agente) firma.
- **Why human:** Acto legal humano exclusivo (deuda F13).

**3. Flip a prod**
- **Test:** Tras signoff: approved, poner MONEY_PUBLIC_ENABLED=true en el .env de prod.
- **Expected:** Encendido humano exclusivo condicionado al sign-off.
- **Why human:** El agente construye hasta el gate; el encendido es acto humano.

### Gaps Summary

Sin gaps. El agente construyó fielmente hasta el gate deny-by-default y NO flipeó nada: `money-gate.ts` sigue `=== "true"` fail-closed, `.env.example=false`, dossier `signoff: pending`. El guard anti-flip muerde (3 vectores + mutation self-check en memoria) y una lectura real de env cruda en una ruta SÍ sería cazada por el walk de app/. La leyenda es single-source renderizada 1× por estado; la distinción RUT-exacto vs nombre-confirmado nunca se conflaciona; el linter caza términos causales inyectados pero no los hechos ("Enlazado por RUT") ni la leyenda; el monto es verbatim (null→"No publicado", nunca "$0"). Suite completa verde (809). Los 3 items pendientes (BrowserOS gated-preview, sign-off legal, flip a prod) son actos humanos exclusivos por diseño → status human_needed.

---

_Verified: 2026-07-14T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
