# Phase 83: CRON-SALUD — Crons sanos + datos frescos - Context

**Gathered:** 2026-07-15
**Status:** Ready for execution (research HIGH confidence — 83-RESEARCH.md es el diagnóstico)
**Requirement:** DEMO-02

<domain>
## Phase Boundary

Ningún cron falla en silencio; toda fuente visible del sitio tiene refresco programado; "Votado esta semana" se llena entre semana (cadencia diaria L-V). Fixes quirúrgicos sobre maquinaria existente — CERO paquetes nuevos, CERO DDL.

</domain>

<decisions>
## Open questions del research — DIRIMIDAS por el orquestador

1. **Roster refresh = workflow NUEVO separado (`roster-weekly.yml`)** — blast-radius de la service key acotado (recomendación del research). Orden interno: primero snapshot/backup (o verificar que backup-parlamentario ya corrió verde ese día), luego `seed:live --preserve-estado`. Guard fail-loud (si el seed escribe 0 filas o falla, exit 1). **Estreno gated:** crear el workflow con `workflow_dispatch` SOLO; validar con una corrida manual VERDE; recién entonces añadir el schedule (semanal, lunes 10:00 UTC — después del backup del domingo).
2. **Cadencia diaria: `0 20 * * 1-5`** (20:00 UTC L-V, hora actual conservada).
3. **findWorkspaceRoot: replicar el patrón EXACTO de los CLIs verdes** (leyes/votos) en los 3 CLIs rotos — sin crear dependencia cruzada nueva ni paquete compartido (fuera de scope).

## Fixes (del research, con root cause verificado)

- RC-1: `run-probidad-todos-cli.ts:86` + `run-probidad-bienes-cli.ts` — `process.cwd()` → patrón findWorkspaceRoot de los CLIs verdes. Validar con `gh workflow run probidad-weekly` → corrida VERDE.
- RC-2: `run-camara-lobby-cli.ts:72` — mismo fix. El schedule de lobby-camara-weekly queda como está (OFF/fail-loud + runbook local) — NO relajar el guard WAF.
- RC-3: workflow nuevo `roster-weekly.yml` (ver decisión 1) para refrescar `parlamentario.fecha_captura` (chip "Actualizado 20 jun · Senado").
- Cadencia: `leyes-weekly.yml` cron → `0 20 * * 1-5` (round-robin incremental con cursor ya existe — Phase 74; el job semanal de 23 min será más corto en diario incremental).
- `docs/crons.md`: matriz fuente→workflow→cadencia→secrets derivada de `packages/freshness/src/catalog.ts` + notas de fail-loud y runbooks locales (lobby-camara WAF).

## Validación (Nyquist de la fase)

- probidad-weekly: dispatch manual → VERDE (evidencia: run id + conclusión).
- leyes-weekly: dispatch manual → VERDE (valida el entrypoint intacto tras el cambio de cron).
- roster-weekly: dispatch manual → VERDE + chip de ficha refrescado (verificable vía RPC/SQL o al día siguiente en el sitio).
- Suite local: tests de packages afectados verdes (probidad/lobby); tsc.
- CERO writes destructivos: seed:live --preserve-estado (preserva estado local); tabla maestra respaldada por backup previo (regla CLAUDE.md).

</decisions>

<specifics>
- Secrets ya cargados en el repo (9 de .env — memoria transfer Cuchecorp). Si roster-weekly necesita un secret adicional (service key con nombre distinto), usar los nombres EXISTENTES en los workflows verdes; si falta uno, documentarlo como TODO de operador con nombre exacto y NO fingir la validación.
- Minutos ilimitados (repo público) — cadencia diaria autorizada por el operador.
</specifics>

<deferred>
- Superficies MONEY/SERVEL siguen fuera del cron (gated — CLAUDE.md).
</deferred>
