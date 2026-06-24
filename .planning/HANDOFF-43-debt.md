# HANDOFF — Phase 43 (DEBT — eliminación de deuda técnica) — listo para ventana fresca

Pegá el bloque "PROMPT DE ARRANQUE" (abajo) en una sesión nueva tras `/clear`. El andamiaje ya está commiteado: ROADMAP + REQUIREMENTS (DEBT-01..04) + `43-CONTEXT.md` (diseño/método LOCKED).

---

## Dónde estamos
- Repo: `C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio` (git, branch master).
- Phase 42 (LOCKDOWN) cerrada **WRITE-COMPLETE** 2026-06-24 (verifier PASS 4/4, suite 316/316). Su cutover a PROD (aplicar 0043 → deploy 03 → aplicar 0044) es deuda de OPERADOR pendiente — **NO es alcance de Phase 43, NO ejecutarlo**.
- **Raíz de Phase 43:** el operador quiere una pasada dedicada y EXHAUSTIVA de eliminación de deuda técnica. Mandato: **"nada por sentado"** — descubrir con evidencia, validar uno por uno, arreglar solo lo seguro.

## Mandato del operador (NO re-litigar)
- **Exhaustivo, premortem swarm de Sonnet (1 agente por dimensión), validador Opus UNO POR UNO.** Nada se da por sentado: hallazgo sin evidencia verificable no entra; nada se arregla sin su veredicto Opus individual.

## Método LOCKED (igual rigor que Phase 41/42) — ver `43-CONTEXT.md`
1. **DESCUBRIR** (swarm premortem Sonnet, ~6 dimensiones: código app/, código packages/, DB+migraciones+pgTAP, tests+cobertura+CI, deps+config+build, planning+docs+scratch). Cada hallazgo con archivo:línea, repro, severidad, blast radius.
2. **VALIDAR 1-a-1** (Opus por hallazgo): ¿deuda real o falso positivo? causa raíz, qué rompe, test que lo protege → veredicto **FIX-NOW** / **CHECKPOINT-OPERADOR** / **WON'T-FIX**.
3. **FIX** (solo FIX-NOW): test + commit atómico por fix; suite verde entre fixes.
4. **CIERRE**: `43-DEBT-LEDGER.md` (fixed / deferred-con-razón / won't-fix) + guards anti-regresión + reporte de checkpoints operador + memoria/STATE/ROADMAP.

## Señales de deuda YA confirmadas (semilla verificada 2026-06-24 — NO es el alcance total; el swarm descubre el resto)
- `app/lib/supabase-admin.ts` usa `SUPABASE_SERVICE_KEY`; todo el repo + `.env` usan `SUPABASE_SECRET_KEY` → admin client roto (enmascarado por gated-OFF).
- `.gitignore` no ignora `.claude/`.
- root `package.json`: `scripts.lint` = placeholder `echo`; `scripts.test` corre `packages/*` pero NO `app/` (gap CI — el 316 no entra al test root).
- Scratch en `.planning/phases/42-…/`: `_inv*.sql`, `_inventory*.txt`, `_rpc_check.sql`, `_verify_targets.sql`, `drafts/`.
- Bug histórico `0036` (INSERT a `vinculo_id`, corregido por el CREATE OR REPLACE de 0037 — el archivo 0036 miente, inmutable); advisory Phase 35 (`reconciliar-contrato.ts` bare catch; `writer-revision-entidad` insert().select() ignorado); EOL CRLF de agentes gsd-planner; headers pgTAP "supabase test db" stale.

## GATES INVIOLABLES (los 6 de `43-CONTEXT.md`)
1. CERO regresión / cero cambio de comportamiento sin prueba: suite app ≥316 verde + `tsc -b` limpio + `packages/*` test verdes ENTRE cada fix. No probable verde → no se aplica.
2. El agente NO aplica a PROD ni deploya. Fix con schema = migración 0045+ ESCRITA, apply = checkpoint operador (psql + schema_migrations, NUNCA db push). NO ejecutar cutover de 42, NO flags `*_PUBLIC_ENABLED`, NO firmas, NO crons.
3. Uno por uno: cada hallazgo con su veredicto Opus antes de tocarlo. Prohibido fix masivo sin validación individual.
4. No borrar/sobrescribir lo no-creado-por-el-agente sin validar; migraciones aplicadas (0001–0044) inmutables (forward-fix).
5. Cada fix atómico/revertible (1 commit/fix); cada won't-fix y deferred documentado con razón+dueño.
6. Higiene, NO rediseño. Hallazgo que exige rearquitectura → DEFERRED con nota, no se hace aquí.

## Fuentes de verdad (LEE PRIMERO)
- `.planning/phases/43-debt-eliminacion-deuda-tecnica/43-CONTEXT.md` — método/dimensiones/gates LOCKED. **NO re-diseñar.**
- `CLAUDE.md`, `memory/MEMORY.md` + `memory/v4-cruces-progreso.md`, `.planning/ROADMAP.md` (Phase 43), `.planning/REQUIREMENTS.md` (DEBT-01..04).

## Cómo proceder (igual que Phase 42)
1. Research/descubrimiento vía `/sonnet-swarm` (≥6 agentes Sonnet, 1/dimensión, framing premortem, evidencia obligatoria) → sintetizá `43-RESEARCH.md` (con `## Validation Architecture`) + el `43-DEBT-LEDGER.md` v0 (todos los hallazgos crudos).
2. Validación adversarial Opus **UNO POR UNO** sobre cada hallazgo del ledger → veredicto + causa raíz + qué rompe → `43-VALIDATION.md` y ledger actualizado con la clasificación. Commiteá.
3. `/gsd:plan-phase 43 --skip-research` → revisá (plan-checker Opus) → `/gsd:execute-phase 43` (solo FIX-NOW; cada fix con test + commit atómico; checkpoints de operador diferidos).
4. Cerrá con SUMMARY + gsd-verifier (Opus) sobre "cero regresión + ledger completo + gates honrados"; actualizá memoria; reportá el DEBT-LEDGER final + la lista de checkpoints de operador.

Al terminar, reportá: cuántos hallazgos, cuántos FIX-NOW aplicados (con commits), cuántos DEFERRED/CHECKPOINT (con dueño), cuántos WON'T-FIX (con razón), y el estado de la suite.

---

## PROMPT DE ARRANQUE (pegar tras `/clear`)

```
Ejecutá Phase 43 "DEBT — Eliminación de deuda técnica (exhaustiva)" del Observatorio del Congreso 360 en modo autónomo. Objetivo: una pasada EXHAUSTIVA de deuda técnica — descubrir con evidencia, validar UNO POR UNO, arreglar SOLO lo seguro, documentar el resto. Mandato del operador: "nada por sentado".

LEE PRIMERO (fuentes de verdad, NO re-diseñar):
- .planning/HANDOFF-43-debt.md  ← arrancá acá: método, gates, señales confirmadas, flujo swarm+Opus.
- .planning/phases/43-debt-eliminacion-deuda-tecnica/43-CONTEXT.md (diseño/método LOCKED: dimensiones, 6 gates, 4 deliverables).
- CLAUDE.md + memory/MEMORY.md + memory/v4-cruces-progreso.md (gotchas + deuda conocida).
- .planning/ROADMAP.md (Phase 43) + .planning/REQUIREMENTS.md (DEBT-01..04).

MÉTODO LOCKED (NO re-litigar): (1) DESCUBRIR con swarm premortem de /sonnet-swarm (≥6 agentes Sonnet, 1 por dimensión: código app/, código packages/ (13), DB+migraciones+pgTAP, tests+cobertura+CI, deps+config+build, planning+docs+scratch). Cada hallazgo con archivo:línea + repro + severidad + blast radius; NADA sin evidencia entra al ledger. (2) VALIDAR adversarialmente con Opus UNO POR UNO cada hallazgo: ¿real o falso positivo? causa raíz, qué rompe, test que lo protege → veredicto FIX-NOW / CHECKPOINT-OPERADOR / WON'T-FIX. (3) Aplicar SOLO los FIX-NOW: test + commit atómico por fix, suite verde entre fixes. (4) Cerrar con 43-DEBT-LEDGER.md (fixed/deferred/won't-fix).

PROCEDÉ: /sonnet-swarm para el descubrimiento → sintetizá 43-RESEARCH.md (con "## Validation Architecture") + 43-DEBT-LEDGER.md v0 → validación Opus 1-a-1 → 43-VALIDATION.md + ledger clasificado → commiteá → /gsd:plan-phase 43 --skip-research → revisá con plan-checker Opus → /gsd:execute-phase 43 (solo FIX-NOW) → SUMMARY + gsd-verifier Opus (cero regresión + gates honrados) → actualizá memoria → reportá el DEBT-LEDGER final + checkpoints de operador.

GATES INVIOLABLES: CERO regresión/cambio de comportamiento sin prueba (suite app ≥316 verde + tsc -b limpio + packages/* test verdes entre cada fix; no probable verde → no se aplica). El agente NO aplica a PROD ni deploya (fix con schema = migración 0045+ ESCRITA, apply=checkpoint operador, psql + schema_migrations, NUNCA db push). NO ejecutar el cutover de Phase 42. NO tocar flags *_PUBLIC_ENABLED, NO firmar dossiers, NO encender crons/secrets. Uno por uno: cada hallazgo con su veredicto Opus antes de tocarlo (prohibido fix masivo sin validación individual). Migraciones aplicadas 0001–0044 inmutables (forward-fix). No borrar lo no-creado-por-el-agente sin validar. Cada fix atómico/revertible; cada deferred/won't-fix con razón+dueño. Higiene, NO rediseño (rearquitectura → DEFERRED).
```

---
