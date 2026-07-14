---
phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
plan: 03
subsystem: handoff / runbook-operador
tags: [RUT-01, runbook, operador-LOCAL, checkpoint, PII, dv-gate, provenance, backfill, P5-blocker]

# Dependency graph
requires:
  - phase: 69-01
    provides: "guard name-match≠write-rut (corte CR-01) verde — pre-check offline del runbook"
  - phase: 69-02
    provides: "COBERTURA_RUT en pnpm freshness (N/M ambas maestras) — el reporte de cobertura del runbook"
provides:
  - "69-BACKFILL-RUT-RUNBOOK.md: handoff operador-LOCAL para el write remoto del RUT a la maestra + reporte de cobertura"
  - "GAP documentado: no existe CLI operador que lea Track B + corra runBackfillRut al REMOTO (mecanismo existe, invocador remoto lo monta el operador)"
affects: [70-dinero-chilecompra, 71-servel, 72-materializador-lobby-sector, 73-money-gate-legal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runbook operador-LOCAL espejo de 66/67-BACKFILL-RUNBOOK: pre-checks offline → corrida gated (destino verificado) → cobertura → rollback → seguridad de credenciales solo-nombres"
    - "GAP explícito documentado en frontmatter entry_point cuando el invocador remoto no existe (fail-closed: sin el CLI, CI no puede escribir al remoto)"

key-files:
  created:
    - ".planning/phases/69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador/69-BACKFILL-RUT-RUNBOOK.md"
  modified: []

key-decisions:
  - "El write remoto del RUT NO se ejecutó: es checkpoint:human-verify gate=blocking-human (autonomous:false, PII, bloqueante duro de TODO P5). Registrado como PENDING; RUT-01 NO marcado complete."
  - "Entry_point documentado como GAP honesto: runBackfillRut + SupabaseMaestraWriter.updateRut EXISTEN y están testeados, pero NO hay un CLI operador que lea el seed Track B y apunte el writer al REMOTO (SupabaseMaestraWriter va al LOCAL por diseño, writer-supabase.ts L18-21). El operador monta/corre ese invocador LOCAL vía db-url."
  - "Molde a copiar para el invocador remoto: backfill-entidad-cli.ts (loadEnv BOM-safe + buildWriterFromEnv null-sin-credencial → modo solo-custodia)."

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-07-14
---

# Phase 69 Plan 03: Runbook del write remoto de RUT + checkpoint operador Summary

**Handoff operador-LOCAL (`69-BACKFILL-RUT-RUNBOOK.md`) para la ESCRITURA REMOTA del RUT a la maestra — checkpoint bloqueante duro de TODO P5. El agente entregó el mecanismo validado offline (Plan 01 guard + Plan 02 cobertura + runBackfillRut testeado), documentó el GAP del invocador remoto, y dejó la escritura remota como acto exclusivo del operador. El write remoto NO se ejecutó; RUT-01 NO se marca completo.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-14
- **Tasks:** 1 auto (runbook) + 1 checkpoint:human-verify blocking-human (write remoto — PENDING)
- **Files:** 1 created (0 código de producción tocado)

## Accomplishments

- **`69-BACKFILL-RUT-RUNBOOK.md`** (238 líneas ≥ 80): espejo de `66-BACKFILL-RUNBOOK.md` con frontmatter
  (`phase`/`plan`/`tipo`/`requirements: [RUT-01]`/`locked`/`entry_point`), encabezado "QUIÉN CORRE ESTO"
  (operador LOCAL, NO agente, NO CI) + declaración explícita de que el agente no ejecutó el write remoto,
  no tocó db-url, no fabricó RUTs, validó todo offline (Pitfall: CI verde ≠ escritura remota probada).
- **Secciones completas:** §0 GAP del entrypoint · §1 PRE-CHECKS OFFLINE (mecanismo verde + guard Plan 01 +
  RLS deny-by-default remoto + credencial db-url ausente-por-diseño + baseline de cobertura) · §2 POBLAR
  Track B (RUTs reales DV-válidos + provenance, NUNCA fabricar; Track A solo corrobora) · §3 CORRIDA LIVE
  (verificar destino REMOTO antes de escribir, DV-gate por fila, idempotente por `id`) · §4 REPORTE DE
  COBERTURA (`pnpm freshness` COBERTURA_RUT N/M, techo honesto) · §5 CRITERIOS DE CIERRE · §6 ROLLBACK /
  SEGURIDAD + credenciales solo-nombres.
- **Referencia al mecanismo REAL** (no inventado): `runBackfillRut` / `isRutValido` (módulo-11) / provenance
  NOT NULL / `SupabaseMaestraWriter.updateRut` (por fila `.eq("id")`, lotes 100) / Track B seed default /
  Track A `runHarvestRut` corrobora / guard Plan 01 / `pnpm freshness` COBERTURA_RUT del Plan 02.
- **GAP honesto documentado:** NO existe un CLI operador que lea `parlamentario-rut.seed.json` y corra
  `runBackfillRut` con un writer REMOTO; `SupabaseMaestraWriter` apunta al LOCAL por diseño. El runbook
  entrega el esqueleto del invocador (molde `backfill-entidad-cli.ts`) que el operador materializa LOCAL.
  Este gap es fail-closed: sin el invocador, CI no puede escribir un RUT al remoto.

## Task Commits

1. **Task 1: Escribir 69-BACKFILL-RUT-RUNBOOK.md** — `a92e8b1` (docs)
2. **Task 2: Checkpoint operador (write remoto)** — NO ejecutado (blocking-human). Ver abajo.

## Checkpoint de operador — PENDIENTE (write remoto del RUT)

**Tipo:** `checkpoint:human-verify` `gate="blocking-human"` (autonomous:false).
**Estado:** **PENDING — NO ejecutado por el agente.**

La ESCRITURA REMOTA del `rut` a la maestra es el acto exclusivo del operador y el **bloqueante duro de
TODO P5** (Phases 70/71/72). El agente **NO** la ejecutó, **NO** tocó db-url, **NO** fabricó ni pobló RUTs.
Razones (LOCKED):
1. **PII real:** los RUTs reales son PII que el agente no posee.
2. **Credencial ausente por diseño:** el write usa db-url; el `.env` HOY no tiene DB password apta para push
   remoto — intencional. El operador provee la credencial al escribir.

**Cómo lo verifica/ejecuta el operador** (del runbook):
1. Pre-checks offline: `pnpm --filter @obs/identity test` + `pnpm --filter @obs/dinero test` +
   `pnpm --filter ./app test -- name-match-rut-guard` — todos verde.
2. `pnpm freshness` → confirmar COBERTURA_RUT (techo honesto HOY ≈ 0/M con seed vacío).
3. (Cuando decida escribir) poblar `parlamentario-rut.seed.json` con RUTs reales DV-válidos + provenance,
   correr el write remoto LOCAL vía db-url, re-leer `pnpm freshness` para la nueva cobertura N/M.
4. Confirmar `rut` NO legible por anon en la DB REMOTA (RLS) + lockdown-guard verde.

**Señal de reanudación:** el operador escribe `"backfill hecho"` con N/M concreto, o
`"mecanismo entregado, write remoto diferido"` (deuda de operador, no bloquea el cierre del mecanismo), o
describe el problema.

## Deviations from Plan

None - plan executed exactly as written. El plan anticipó el GAP del entrypoint ("si no existe un CLI operador
con writer remoto, documentarlo como gap explícito"); se documentó como gap honesto con el esqueleto del
invocador y el molde a copiar. El write remoto se dejó como checkpoint operador PENDING según lo instruido.

## Threat Register Compliance

| Threat | Disposition | Applied |
|--------|-------------|---------|
| T-69-08 EoP/Tampering (write remoto accidental desde CI) | mitigate | Write = checkpoint operador (autonomous:false); sin db-url en .env; GAP fail-closed (sin invocador remoto CI no escribe). Runbook prohíbe correr en GitHub Actions. |
| T-69-09 Tampering (RUT fabricado / DV falso) | mitigate | Runbook exige DV-gate módulo-11 (isRutValido) + provenance NOT NULL en runBackfillRut, fail-closed; prohíbe fabricar RUTs/placeholders. |
| T-69-10 InfoDisclosure (db-url/credencial en el runbook) | mitigate | Runbook referencia SOLO nombres de env, nunca valores; §Seguridad de credenciales explícita. |
| T-69-11 Spoofing (falso "backfill hecho") | accept | El operador reporta N/M concreto vía pnpm freshness; HOY ≈ 0/M es el veredicto honesto hasta poblar el seed. |

## Known Stubs

None. El runbook es documentación ejecutable; el "GAP del invocador remoto" NO es un stub sino un hecho
declarado honestamente (el mecanismo existe + testeado; el invocador remoto es acto deliberado del operador,
fail-closed por diseño).

## Operator Debt / Blocker (P5)

- **BLOCKER (bloqueante duro de TODO P5):** el write remoto del RUT a la maestra + poblar Track B con RUTs
  reales DV-válidos. Acto exclusivo del operador (PII + db-url ausente por diseño). RUT-01 NO se cierra hasta
  que el operador reporte cobertura N/M concreta o difiera explícitamente.
- **Deuda de invocador:** montar el CLI operador que lee Track B + corre `runBackfillRut` con
  `SupabaseMaestraWriter` apuntado al REMOTO (molde: `backfill-entidad-cli.ts`).

## Next Phase Readiness

- El handoff del write remoto queda entregado y ejecutable por el operador. El mecanismo (Plan 01 guard +
  Plan 02 cobertura + runBackfillRut testeado) está completo offline. RUT-01 sigue siendo el bloqueante duro
  de P5 hasta que el operador ejecute (o difiera) el write remoto — intacto.

## Self-Check: PASSED

- FOUND: `.planning/phases/69-.../69-BACKFILL-RUT-RUNBOOK.md` (238 líneas, ≥ 80 ✓)
- FOUND commit: `a92e8b1`
- Write remoto: NO ejecutado (blocking-human, correcto). RUT-01 NO marcado complete (correcto).

---
*Phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador*
*Completed: 2026-07-14*
