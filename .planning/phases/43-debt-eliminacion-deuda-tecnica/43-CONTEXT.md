# Phase 43: DEBT — Eliminación de deuda técnica (exhaustiva) - Context

**Gathered:** 2026-06-24
**Status:** Ready for research+planning (ventana fresca; método = swarm premortem Sonnet + validadores Opus 1-a-1, igual rigor que Phase 41/42)
**Source:** Decisión del operador tras cerrar Phase 42 (LOCKDOWN): hacer una pasada dedicada y exhaustiva de eliminación de deuda técnica. Mandato explícito: **"nada por sentado"** — la fase DESCUBRE la deuda con evidencia, NO parte de una lista asumida; cada hallazgo se valida adversarialmente uno por uno antes de tocarlo.

<domain>
## Phase Boundary

Hacer UNA pasada exhaustiva de deuda técnica del repo completo (app/ Next.js + los 13 packages + supabase/ migraciones/tests/functions + .planning/ + config/build): (1) DESCUBRIR toda la deuda con evidencia concreta (premortem swarm), (2) VALIDAR cada hallazgo uno por uno (Opus adversarial: ¿es deuda real? ¿causa raíz? ¿el fix es seguro? ¿qué rompe?), (3) APLICAR solo los fixes seguros y autónomos con prueba de test + commits atómicos, (4) DOCUMENTAR en un DEBT-LEDGER lo arreglado, lo diferido (con razón) y lo won't-fix. La barra de calidad: la suite sigue verde (≥316), tsc limpio, cero regresión, cero cambio de comportamiento de features shipeadas sin prueba.

**EN ALCANCE (descubrir + clasificar + arreglar lo seguro):**
- Código (app/ + packages/*): dead code, `catch{}` vacíos / swallow de errores sensibles, returns ignorados (`insert().select()` sin usar), lógica duplicada, `any`/`@ts-ignore`/`@ts-expect-error`, TODO/FIXME reales, mis-wires de env (p.ej. `supabase-admin.ts` usa `SUPABASE_SERVICE_KEY` mientras TODO el repo usa `SUPABASE_SECRET_KEY` → admin client roto, enmascarado por gated-OFF).
- DB/migraciones/tests: drift `schema_migrations` vs aplicado; bug histórico de `0036` (INSERT a `vinculo_id` en vez de `vinculo_entidad_id` — inmutable, lo corrige el CREATE OR REPLACE de 0037, pero el archivo 0036 miente); headers pgTAP stale ("supabase test db"); índices huérfanos/duplicados; consistencia de grants/RLS; tests `skip`/`only`, mocked-only que nunca tocan PROD, timeouts frágiles.
- Config/build/CI: `lint` = placeholder `echo` (sin linter real); root `pnpm test` corre `packages/*` pero NO `app/` (gap CI — el 316 no entra al test root); `.gitignore` sin `.claude/` (untracked recurrente); `.env.example` completitud; deps desactualizadas/sin usar/duplicadas en el monorepo; tsconfig/vitest drift; EOL/CRLF.
- Planning/docs: scratch dejado en phase dirs (p.ej. `42/_inv*.sql`, `42/_verify_targets.sql`, `42/drafts/`); inconsistencias ROADMAP/REQUIREMENTS/STATE; memoria stale; claims de doc vs código real.

**FUERA DE ALCANCE (NO es deuda de código de esta fase):**
- El cutover pendiente de Phase 42 (aplicar 0043 → deploy 03 → aplicar 0044) — es una ACCIÓN DE OPERADOR pendiente, no deuda a "arreglar" aquí. NO aplicar, NO deployar.
- Encender flags `*_PUBLIC_ENABLED`, firmar dossiers legales, encender crons/secrets en `Cuchecorp/gov-map` — acciones humanas/operador (deudas conocidas, se INVENTARÍAN y documentan, NO se ejecutan).
- Features nuevas, refactors arquitectónicos grandes, o cambios de modelo de embeddings. Esto es higiene, no rediseño.
- RUT-01 / ChileCompra / SERVEL / sign-off legal (Fases 39/40 — bloqueos de producto, no deuda técnica).
</domain>

<decisions>
## Implementation Decisions (LOCKED por el operador / a refinar en research)

### Método LOCKED: descubrir → validar 1-a-1 → arreglar lo seguro (premortem, nada por sentado)
- **Etapa 1 — DESCUBRIMIENTO (swarm premortem Sonnet, 1 agente por dimensión):** cada agente escanea SU dimensión con la pregunta premortem "es 2027 y esto nos explotó en la cara — ¿qué deuda fue?". Devuelve hallazgos con EVIDENCIA concreta (archivo:línea, repro, por qué es deuda, blast radius estimado). NADA se da por sentado: un hallazgo sin evidencia verificable no entra al ledger.
- **Etapa 2 — VALIDACIÓN ADVERSARIAL (Opus, UNO POR UNO):** cada hallazgo pasa por un validador Opus que responde: (a) ¿es deuda REAL o falso positivo? (b) ¿cuál es la causa raíz (no el síntoma)? (c) ¿el fix propuesto es SEGURO y autónomo, o cambia comportamiento? (d) ¿qué se rompe si lo toco? ¿hay test que lo proteja? (e) veredicto: **FIX-NOW** (seguro, autónomo, con test) / **CHECKPOINT-OPERADOR** (DDL a PROD, deploy, secret, flag, firma) / **WON'T-FIX** (riesgo > beneficio, o intencional — documentar razón). "Uno por uno" es load-bearing: nada se arregla en lote sin su veredicto propio.
- **Etapa 3 — FIX (solo FIX-NOW):** aplicar cada fix con su test/prueba, commit atómico por fix (revertible), suite verde mantenida entre fixes. Si un fix destapa otro problema, vuelve a Etapa 2 (no se improvisa).
- **Etapa 4 — LEDGER + cierre:** `DEBT-LEDGER.md` con las 3 columnas (fixed / deferred-con-razón-y-dueño / won't-fix-con-razón) + guard/regresión donde aplique + reporte de checkpoints de operador.

### Dimensiones del swarm de descubrimiento (premortem — punto de partida, NO la lista cerrada)
1. **Código app/** (Next.js, components, lib).
2. **Código packages/** (los 13: adjudication, agenda, core, cruces, dinero, fichas, identity, ingest, llm, lobby, probidad, tramitacion, votos).
3. **DB / migraciones / pgTAP** (supabase/migrations, supabase/tests, supabase/functions).
4. **Tests / cobertura / flakiness** (app + packages; gaps de CI).
5. **Deps / config / build / CI** (package.json, pnpm-workspace, tsconfig, vitest, .gitignore, .env.example, lint, EOL).
6. **Planning / docs / memoria / scratch** (.planning, docs/, memoria, drift doc-vs-código).
(El plan puede dividir/fusionar dimensiones; cada hallazgo debe trazar a evidencia.)

### Señales de deuda YA confirmadas (semilla verificada — NO es el alcance total)
- `app/lib/supabase-admin.ts` lee `process.env.SUPABASE_SERVICE_KEY`; el resto del repo y `.env` usan `SUPABASE_SECRET_KEY` → admin client tira "Falta SUPABASE_SERVICE_KEY". Enmascarado: superficie admin gated OFF. (Confirmado por validadores de Phase 42 también.)
- `.gitignore` NO ignora `.claude/` → untracked recurrente.
- root `package.json` `scripts.lint` = `echo "(lint placeholder…)"` → sin linter real; `scripts.test` corre `packages/*` pero NO `app/` → el suite de 316 no entra al test root (gap CI).
- Scratch en `.planning/phases/42-…/`: `_inv*.sql`, `_inventory*.txt`, `_rpc_check.sql`, `_verify_targets.sql`, `drafts/` — clasificar (archivar/borrar lo confirmado scratch; conservar FACTS/validation si tienen valor).
- Memoria v4 nota: bug histórico `0036` (columna `vinculo_id`), EOL CRLF de los agentes gsd-planner, advisory de Phase 35 (`reconciliar-contrato.ts` bare catch; `writer-revision-entidad` insert().select() ignorado).

### Claude's Discretion (research/plan)
- Granularidad: si Etapas 1–4 son 4 planes (uno por etapa) o más (p.ej. fix dividido por dimensión). Recomendado espejar 41/42: research swarm → ledger → validación → fix(es) → cierre.
- Si introducir un linter real (ESLint/Biome) es un FIX-NOW de esta fase o un CHECKPOINT (decisión de tooling) — el validador Opus decide.
- Orden de los fixes (independientes → paralelizables como write-work; serializar en master por worktrees OFF).
</decisions>

<gates_LOCKED>
## Gates inviolables

1. **CERO regresión, CERO cambio de comportamiento de features shipeadas sin prueba.** La suite (`cd app && npx vitest run` + cada `packages/*`) se mantiene verde (≥316 en app) y `tsc -b` limpio ENTRE cada fix. Un fix que no se puede probar verde → NO se aplica (pasa a CHECKPOINT o WON'T-FIX).
2. **El agente NO aplica a PROD ni deploya.** Cualquier fix que toque schema = escribir migración numerada (0045+), apply = checkpoint operador (`psql --single-transaction` + schema_migrations, NUNCA `db push`). NO ejecutar el cutover de Phase 42. NO encender flags `*_PUBLIC_ENABLED`. NO firmar dossiers. NO encender crons/secrets.
3. **Uno por uno (nada por sentado).** Cada hallazgo se valida adversarialmente con su propio veredicto Opus antes de tocarlo. Prohibido el fix masivo "de una" sin validación individual. Un hallazgo sin evidencia verificable NO entra al ledger.
4. **No borrar/sobrescribir lo que el agente no creó sin validar.** Los scratch, docs, migraciones históricas se tocan solo tras confirmar (con evidencia) que es seguro; las migraciones APLICADAS son inmutables (forward-fix, nunca editar 0001–0042).
5. **Cada fix = atómico y revertible** (un commit por fix, mensaje claro); cada WON'T-FIX y cada DEFERRED documentado con razón y dueño en el DEBT-LEDGER.
6. **No expandir el alcance a features/refactors grandes.** Higiene, no rediseño. Si un hallazgo exige rearquitectura, va a DEFERRED con una nota, no se hace aquí.
</gates_LOCKED>

<deliverables>
## Deliverables (refinar numeración en plan-phase)
1. **DEBT-01 — Inventario exhaustivo** (`43-DEBT-LEDGER.md` v0): swarm premortem Sonnet (1+/dimensión) → todos los hallazgos con evidencia (archivo:línea, repro, severidad, blast radius). Nada por sentado.
2. **DEBT-02 — Validación adversarial 1-a-1** (Opus por hallazgo): veredicto FIX-NOW / CHECKPOINT-OPERADOR / WON'T-FIX + causa raíz + qué rompe + test que lo protege. Actualiza el ledger.
3. **DEBT-03 — Fixes seguros** (solo FIX-NOW): aplicados con test, commits atómicos, suite verde entre fixes; migraciones nuevas (si las hay) ESCRITAS no aplicadas (apply=operador).
4. **DEBT-04 — Cierre**: DEBT-LEDGER final (fixed/deferred/won't-fix) + guards anti-regresión donde apliquen (p.ej. CI que corra app/ tests; linter si se decide) + reporte de checkpoints de operador + actualización de memoria/STATE/ROADMAP.
</deliverables>

<canonical_refs>
## Canonical References (READ antes de planificar/implementar)
- `CLAUDE.md` (convenciones: DDL psql NUNCA db push; pnpm monorepo; tests `cd app && npx vitest run` + `npx tsc -b`; LF EOL; ingesta 2 etapas R2→Supabase).
- `memory/v4-cruces-progreso.md` (gotchas acumulados: 0036 bug, EOL CRLF, pgTAP-vs-PROD, admin-key mis-wire, advisory Phase 35) y `memory/MEMORY.md`.
- `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` / `.planning/STATE.md` (drift a auditar).
- Estructura: `app/` (Next.js 16), `packages/*` (13), `supabase/migrations` (0001–0044), `supabase/tests` (+ `post-apply/`), `supabase/functions/ingest-worker`.
- Phase 42 artifacts (referencia de método swarm+Opus; NO re-ejecutar su cutover): `.planning/phases/42-…/42-RESEARCH.md`, `42-VALIDATION.md`.
</canonical_refs>

<deferred>
## Deferred (conocidos, se inventarían y documentan — NO se ejecutan aquí)
- Cutover Phase 42 (apply 0043/deploy 03/apply 0044) — operador.
- Sign-off legal F13/F17/cruces (Phase 39), RUT-01/ChileCompra/SERVEL (Phase 40), Phase 38 (SURF proyecto).
- Encender crons + transferir secrets a `Cuchecorp/gov-map` (deuda operador Phase 34).
</deferred>

---

*Phase: 43-debt-eliminacion-deuda-tecnica*
*Context gathered: 2026-06-24 — mandato del operador: pasada exhaustiva de deuda técnica, "nada por sentado", swarm premortem + validación Opus 1-a-1*
