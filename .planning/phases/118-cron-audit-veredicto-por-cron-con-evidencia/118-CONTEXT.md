# Phase 118: CRON-AUDIT — Veredicto por cron con evidencia - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — recomendaciones auto-aceptadas por directiva del prompt v12.0 (decisiones del operador ya resueltas)

<domain>
## Phase Boundary

Auditoría EMPÍRICA de toda la ingesta programada: cada workflow de GitHub Actions y cada job de `pg_cron` recibe veredicto verde/stale/roto respaldado por evidencia OBSERVADA (última corrida `gh run list`, última fila escrita en la tabla destino vía psql, señal `pnpm freshness`), jamás por lectura del YAML solamente. Cada veredicto no-verde lleva causa identificada apuntando a archivo o dato. Salida: documento de veredictos + gaps priorizados como entrada ejecutable para Phase 119 (CRON-FIX). Esta fase NO arregla nada — solo audita y documenta. La única excepción de interacción: si falta un secret en GH (deuda 110-02: `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`), es checkpoint de operador — se pide UNA vez con pasos exactos zero-credential-value y se sigue con lo no bloqueado.

</domain>

<decisions>
## Implementation Decisions

### Alcance de la enumeración
- Los 13 workflows de `.github/workflows/` entran TODOS al inventario: los 8 con `schedule:` (actualidad-refresh, agenda-weekly, backup-parlamentario, digest-daily, leyes-weekly, lobby-leylobby-weekly, probidad-weekly, roster-weekly) con veredicto completo; los sin schedule (ci, deploy-cloudflare, backfill, fichas-backfill, lobby-camara-weekly) se enumeran y se declara por qué no son cron (manual/CI) — cero workflows sin clasificar. Nota: `lobby-camara-weekly.yml` dice "weekly" en el nombre pero NO aparece con schedule — verificar en ejecución si es gap real o dispatch manual intencional.
- Jobs `pg_cron` se enumeran contra la DB VIVA (`select * from cron.job`) + últimas corridas (`cron.job_run_details`), no contra migraciones.
- MONEY/SERVEL siguen fuera del cron (gated) — se registra como estado esperado, no como gap.

### Evidencia por cron (las 3 patas)
- Pata 1 — última corrida: `gh run list --workflow=X` (conclusión + fecha). Billing GH intermitente es causa conocida: si las corridas fallan por billing, veredicto roto con causa "billing", no especulación.
- Pata 2 — última fila escrita: psql read-only contra la tabla destino REAL del entrypoint que el YAML invoca (gotcha 57-05: dos entrypoints CLI — SIEMPRE verificar contra el YAML cuál corre de verdad; el veredicto se emite sobre ese, no sobre el que uno cree).
- Pata 3 — señal freshness: `pnpm freshness` (tsx packages/freshness/src/cli.ts) — cruzar su salida con las patas 1-2; discrepancia entre freshness y fila real es hallazgo en sí mismo.
- R2: spot-check de crudo reciente solo donde el conector escribe a R2 (dos etapas LOCKED); no exhaustivo.

### Taxonomía de veredictos
- **verde**: corrió en su ventana esperada Y escribió/verificó datos frescos (o `[skip] sin novedades` legítimo con hash-check).
- **stale**: corre pero no produce filas nuevas más allá de su cadencia esperada sin causa legítima declarada, o lleva N ventanas sin correr.
- **roto**: falla la corrida (exit no-cero, secret ausente, entrypoint equivocado, WAF) o escribe basura.
- Cadencia esperada se deriva del cron expression del YAML + naturaleza de la fuente (semanal legislativo ≠ diario). Skip legítimo (semana sin sesiones) NO es stale — el veredicto distingue "sin novedades honesto" de "cursor detenido".
- Causa por veredicto no-verde: apuntar a archivo:línea (YAML o CLI) o a dato (fila/timestamp psql, log de gh run).

### Manejo de secrets y checkpoint
- El agente JAMÁS imprime ni carga valores de secreto. `gh secret list` (nombres solamente) es la evidencia permitida.
- Si falta secret (deuda 110-02 esperada: rotación B26 + CF secrets): checkpoint de operador — pedir UNA vez con pasos exactos (nombre del secret, dónde cargarlo, permiso mínimo del token), seguir auditando lo no bloqueado. Sin respuesta → gap documentado como deuda operador para 119, la fase CIERRA igual.

### Formato de salida
- Documento único en el dir de fase: `118-CRON-VERDICTS.md` — tabla maestra (cron × veredicto × evidencia × causa) + sección de gaps priorizados (P0 roto accionable / P1 stale accionable / P2 deuda operador) con pasos concretos por gap, consumible directamente por el plan de 119.
- Toda corrida de probe reproducible: comandos exactos registrados en el documento (sin URLs de DB ni secretos).

### Claude's Discretion
- Orden de las probes, batching de queries psql, y cómo agrupar workflows afines. Profundidad del spot-check R2 por conector.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pnpm freshness` → `packages/freshness/src/cli.ts` (señales por fuente, verde 1ª vez en v8.1 tras fix process.cwd).
- `gh` CLI autenticado para runs/secrets; psql read-only vía `set -a; source .env; set +a` (JAMÁS imprimir URL).
- Precedente v8.1: bug `process.cwd` bajo `pnpm --filter exec` — patrón de causa ya pagado, buscar variantes.

### Established Patterns
- Gotcha 57-05: dos entrypoints CLI (ej. tramitación) — el YAML es la verdad de qué corre; auditar el entrypoint invocado.
- Dos etapas LOCKED: fuente→R2 content-addressed → R2→Supabase; hash-check antes de descargar; rate-limit 2-3s.
- Deuda operador viva: 110-02 (CF secrets + rotación B26) — el audit la va a ENCONTRAR: es checkpoint, no fix de agente.

### Integration Points
- Salida consumida por Phase 119 (CRON-FIX) como entrada ejecutable.
- `cron.job` / `cron.job_run_details` en DB viva para pg_cron.

</code_context>

<specifics>
## Specific Ideas

- Evidencia OBSERVADA obligatoria — el criterio de éxito del ROADMAP prohíbe veredictos por lectura de YAML.
- `lobby-camara-weekly.yml` sin `schedule:` pese al nombre: candidato a gap desde el scouting; confirmar en ejecución.

</specifics>

<deferred>
## Deferred Ideas

- Cualquier fix de código o de workflow → Phase 119.
- Flip escalera y keys Workers AI → Phase 120 (el checkpoint de secrets de 118 es solo por CF/GH secrets de crons existentes, no por Workers AI).

</deferred>
