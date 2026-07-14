---
phase: 68-voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros
verified: 2026-07-14T02:05:00Z
status: human_needed
score: 4/4 must-haves verified (offline) — SC#4 BrowserOS clause pending operator cold-read
re_verification:
  previous_status: none
  note: initial verification
human_verification:
  - test: "Cold-read de la sección 'Votaciones' de una ficha real desplegada por un lector no experto, vía BrowserOS CDP (runbook 68-BROWSEROS-GATE.md §2-§3, rúbrica 6 puntos)"
    expected: "Veredicto binario 'comprensible': el lector entiende a-favor/en-contra, percibe ausente/pareo como NEUTROS (no 'en contra'), lee la leyenda anti-insinuación antes del dato, ve la trazabilidad a la fuente, NO sale con impresión de 'alineamiento/disciplina/rebeldía', y la cobertura N/M + techo se declaran"
    why_human: "T-68-10 (Repudiation): una superficie puede pasar todos los tests offline y aun así leerse como insinuación en frío. La comprensión honesta del producto DESPLEGADO por un humano no es automatizable. Bloqueado (lado operador) por: (1) backfill de votos Fases 66/67 LOCAL, (2) deploy a Cloudflare (creds CF fuera de .env), (3) MCP BrowserOS levantado."
---

# Phase 68: VOTO P3e — Superficies de voto + linter anti-insinuación + cobertura + gate BrowserOS — Verification Report

**Phase Goal:** Cerrar el 360 del voto en la ficha del parlamentario — descriptivo, nunca "alineamiento/disciplina/rebeldía" — con cobertura honesta y comprensión validada.
**Verified:** 2026-07-14T02:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El ciudadano ve historial de votos individuales por sesión/proyecto (arco + link a votación + proyecto); NUNCA "alineamiento"/"rebeldía" | ✓ VERIFIED | `votos-por-parlamentario.tsx`: arcos agrupados por `boletin`, `<Link href={/proyecto/${grupo.boletin}}>` (L489-501), `votacion_id` por voto (L519), `ProvenanceBadge` inline (L551). Los 2 únicos matches de "mediana/rebeldía" en el archivo son COMENTARIOS de la poda (L32, L1040). El bloque `Votó distinto a su bancada` solo existe en un test que asserta su AUSENCIA. |
| 2 | Cada superficie: leyenda anti-insinuación verbatim + provenance inline; pareo/ausente slate NEUTRO, nunca fundido con "en contra" | ✓ VERIFIED | Leyenda VERBATIM en `LEYENDA_ANTI_INSINUACION` (L275, byte-idéntica a UI-SPEC §Leyenda), renderizada como Bloque 0 / primer hijo del detalle antes de todo dato (L645-647). `voto-presentacion.ts`: `pareo: bg-slate-400`, `ausente: bg-slate-300` (L33-34); `no: bg-red-500` (L27) — familias distintas, nunca fusionadas. |
| 3 | Linter anti-insinuación corre sobre los componentes de voto; NO existe vista "vota como X"/matriz de similitud | ✓ VERIFIED | `anti-insinuacion-guard.test.ts` 9/9 verde; `SUPERFICIES_VOTO` incluye las 6 superficies de voto + page.tsx (L83-91); mutation self-check REAL (inyecta "rebeldía"/"score"/"disciplina" al detector `detectarInsinuaciones` real, L227-253 → BITES). Cero "vota como"/matriz de voto-similitud en app (los matches de `similarity` son de proyectos-similares, feature de búsqueda semántica de leyes, no de voto). |
| 4 | Cobertura N/M + techo por causa en UI Y `pnpm freshness`; veredicto BrowserOS "comprensible" | ✓ VERIFIED (offline) / ? BrowserOS clause = human | UI: N/M incondicional `Se registran votaciones de {totalProyectos}` (L801-806) + techo condicional `COPY_TECHO_POR_CAUSA` (L813-817). Freshness: `COBERTURA_VOTO_SENALES` (denom sesiones + Cámara confirmado + Senado por nombre, catalog L107-137), wired `queryCoberturaVoto → evaluateCobertura → renderCoberturaVoto` en cli.ts (L264-288), append (no reemplaza corpus). BrowserOS cold-read → human_needed (operator-gated). |

**Score:** 4/4 truths verified offline. SC#4's BrowserOS "comprensible" clause is the only item routed to human.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/components/votos-por-parlamentario.tsx` | Carril podado + leyenda + cobertura | ✓ VERIFIED | Exists, substantive (1000+ L), wired via `votos_de_parlamentario` RPC (allowlisted); data flows from DB via that RPC |
| `app/components/ausencias-contexto.tsx` + `.test.tsx` | ELIMINADO | ✓ VERIFIED | Both MISSING (deleted) — confirmed absent |
| `app/lib/anti-insinuacion-guard.test.ts` | Linter con stripTsComments + mutation self-check | ✓ VERIFIED | Exists, `stripTsComments` present, mutation self-check bites, 9/9 green |
| `packages/freshness/src/catalog.ts` | COBERTURA_VOTO_SENALES separado | ✓ VERIFIED | Array present (both chambers), corpus `COBERTURA_SENALES` untouched (own `esDenominador: true`) |
| `packages/freshness/src/cli.ts` | renderCoberturaVoto + wiring | ✓ VERIFIED | Present + wired in main, append output |
| `app/lib/lockdown-guard.test.ts` | PUBLIC_RPC_ALLOWLIST endurecido | ✓ VERIFIED | `votos_de_parlamentario` present; `rebeldias_de_parlamentario` + `tasa_ausencia_comparada` ABSENT from the Set (L165-182); 8/8 green |
| `68-BROWSEROS-GATE.md` | Runbook operador + rúbrica 6 puntos | ✓ VERIFIED | Exists (12KB), rubric present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `votos-por-parlamentario.tsx` | leyenda verbatim | primer hijo del detalle | ✓ WIRED | `LEYENDA_ANTI_INSINUACION` rendered L646, first child of return tree (Bloque 0) |
| `lockdown-guard.test.ts` | PUBLIC_RPC_ALLOWLIST | 2 RPC removed | ✓ WIRED | Forbidden RPCs absent from Set; guard bites re-mount |
| `anti-insinuacion-guard.test.ts` | vote surfaces | readFileSync SUPERFICIES_VOTO | ✓ WIRED | Scans real files incl. votos-por-parlamentario.tsx |
| `cli.ts` | COBERTURA_VOTO_SENALES | queryCoberturaVoto + evaluateCobertura + renderCoberturaVoto | ✓ WIRED | Full chain in main, JSON exposes `coberturaVoto` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `votos-por-parlamentario.tsx` | `todasData` / `votos` | `sb.rpc("votos_de_parlamentario")` (allowlisted, DB-backed) | Yes (real RPC; empty-state honest when no votes) | ✓ FLOWING |
| `cli.ts` cobertura voto | `coberturaVoto` | `queryCoberturaVoto` → psql `SELECT count(DISTINCT ...) FROM votacion/voto` | Yes (68-02 live run: 4731 sesiones, Cámara 3765/80%, Senado 963/20%) | ✓ FLOWING |
| `techoPorCausa` | `data.techoPorCausa` | undefined (no causa signal wired yet) | N/A — conditional; line OMITTED when absent, never fabricated | ⚠️ INTENTIONAL STUB (data, not render) |

Note: `techoPorCausa` is a declared intentional stub (68-03 Known Stubs) — the UI supports both branches (test covers both); the causa signal is deferrable to a later plan. Never fabricates a ceiling. Not a gap.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Anti-insinuación guard bites | `pnpm --filter ./app test anti-insinuacion-guard` | 9/9 passed (incl. mutation self-check) | ✓ PASS |
| Lockdown allowlist hardened | `pnpm --filter ./app test lockdown-guard` | 8/8 passed | ✓ PASS |
| Full app suite (no regression) | `pnpm --filter ./app test` | 71 files / 758 tests passed | ✓ PASS |
| Freshness cobertura voto | `pnpm --filter @obs/freshness test` | 20 tests passed (incl. 5 voto cobertura) | ✓ PASS |
| BrowserOS cold-read "comprensible" | (deploy + backfill + MCP required) | deferred | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTO-02 | 68-03 | Historial de votos individuales por sesión/proyecto, descriptivo | ✓ SATISFIED | Arcos por proyecto + links + prune of rebeldía/mediana |
| VOTO-04 | 68-01, 68-03 | Leyenda anti-insinuación + provenance inline + linter | ✓ SATISFIED | Legend verbatim + ProvenanceBadge + guard 9/9 green |
| VOTO-05 | 68-02, 68-03, 68-04 | Cobertura declarada honesta (N/M + techo) en UI y freshness | ✓ SATISFIED (offline) | UI N/M + techo + freshness COBERTURA_VOTO_SENALES; BrowserOS clause = human |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No debt markers (TBD/FIXME/XXX) in any phase-modified file | — | Clean |
| votos-por-parlamentario.tsx | 32, 1040 | "mediana de cámara"/"rebeldía" in comments | ℹ️ Info | Comments documenting the prune, not rendered text; guard strips comments → not offenders |

No blockers. The 2 comment matches are intentional documentation of the prune and are correctly excluded by `stripTsComments`.

### Human Verification Required

#### 1. BrowserOS cold-read "comprensible" (SC#4 clause)

**Test:** Cold-read de la sección "Votaciones" de una ficha real desplegada por un lector no experto vía BrowserOS CDP, siguiendo `68-BROWSEROS-GATE.md` §2 (procedimiento) + §3 (rúbrica 6 puntos).
**Expected:** Veredicto binario "comprensible" — el lector entiende a-favor/en-contra, percibe ausente/pareo como neutros (slate, no "en contra"), lee la leyenda anti-insinuación antes del dato, ve trazabilidad a la fuente, NO sale con impresión de "alineamiento/disciplina/rebeldía", y la cobertura N/M + techo se declaran.
**Why human:** T-68-10 (Repudiation) — la comprensión honesta del producto desplegado no es automatizable. Bloqueado (lado operador): (1) backfill de votos Fases 66/67 LOCAL para render de votos reales; (2) deploy a Cloudflare (creds CF fuera de .env); (3) MCP BrowserOS levantado.
**Resume-signal:** el operador escribe "comprensible" para cerrar VOTO-05/SC#4, o lista los puntos de la rúbrica §3 que fallaron (replanificados como gaps al Plan 03, re-deploy, re-cold-read).

### Gaps Summary

No gaps. All 4 success criteria are met in the codebase for everything offline-verifiable:
- The vote lane is purely descriptive (rebeldía + chamber-median blocks pruned from the render tree; `ausencias-contexto.tsx` deleted; 2 forbidden RPCs removed from `PUBLIC_RPC_ALLOWLIST`, inert in DB).
- The anti-insinuation guard genuinely BITES (mutation self-check feeds injected terms through the real detector) and is green on the current tree.
- The verbatim legend is byte-identical to UI-SPEC and rendered as the first child before any data; pareo/ausente use slate tokens distinct from the "en contra" red.
- Coverage N/M + conditional ceiling are declared in both the UI and `pnpm freshness` (`COBERTURA_VOTO_SENALES`, both chambers, corpus semantics untouched, honest degrade to null).

Suites: app 758/758 green, freshness 20/20 green, anti-insinuación 9/9, lockdown 8/8.

The single remaining item — the BrowserOS "comprensible" cold-read — is intrinsically operator-gated (needs deploy + backfill + MCP) and is correctly documented as a `checkpoint:human-verify`. Status is `human_needed` per the decision tree (non-empty human verification section takes priority even with 4/4 offline truths verified).

---

_Verified: 2026-07-14T02:05:00Z_
_Verifier: Claude (gsd-verifier)_
