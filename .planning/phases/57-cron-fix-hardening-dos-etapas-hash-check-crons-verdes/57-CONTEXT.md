# Phase 57: CRON-FIX — Hardening dos-etapas + hash-check + crons verdes - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva del operador; base = 56-CRON-AUDIT.md G1–G23)

<domain>
## Phase Boundary

Cerrar los gaps G1–G23 del audit de Phase 56 en los conectores RECURRENTES (agenda, tramitación/leyes, lobby-camara, lobby-leylobby, probidad): dos etapas re-ejecutables (fuente→R2, R2→Supabase), hash-check con salida temprana, crons verdes en GH Actions con secrets cargados, y fallback local documentado para lo que GH no puede correr (WAF). CRON-05 (frescura) es Phase 58; autoría es Phase 59. Cero cambios de UI.

</domain>

<decisions>
## Implementation Decisions

### Etapa 2 — R2→Supabase re-ejecutable (G23, el gap sistémico)
- Seam COMPARTIDO en `@obs/ingest`: un lector de snapshots R2 (por clave content-addressed y/o registro `source_snapshot`) que entrega el crudo a los parsers existentes SIN tocar la red gubernamental.
- Cada CLI recurrente gana modo `--from-r2` (re-ingesta desde crudo). Los parsers NO se duplican: se reusan los mismos (`parseX`) alimentados desde R2 en vez de fetch.
- Alcance: los 5 conectores recurrentes. `fichas-backfill`/`backup` solo si el costo marginal es trivial; si no, gap documentado para milestone siguiente.

### Etapa 1 — fuente→R2 donde falta
- `tramitacion` (leyes-weekly) y `lobby-leylobby` no escriben crudo a R2: añadir la escritura content-addressed (`If-None-Match: *`, 412=éxito idempotente) ANTES de parsear, reusando el writer existente de @obs/ingest.
- Los conectores cuya Etapa 1 es silently no-op por falta de secrets en CI: la causa se arregla cargando secrets (abajo), y el código debe FALLAR LOUD (o log WARN explícito) cuando R2 no está configurado en una corrida de cron — nunca no-op silencioso.

### Hash-check / salida temprana (CRON-03)
- Antes de descargar: conditional GET (ETag/If-Modified-Since) donde la fuente lo soporte; si no, descargar→sha256→si el objeto ya existe en R2 (412), NO re-parsear ni re-escribir a Supabase.
- Log estándar: `[skip] sin novedades — <fuente> <recurso>` (grep-able, criterio de éxito 2). Corrida sin novedades = 0 writes a Supabase, verificable en logs del workflow.

### Bugs concretos del audit
- G4 (CRITICAL, leyes-weekly): `tramitacion_evento` duplicate key dentro del mismo batch de upsert — deduplicar el batch por la clave natural antes del upsert (y test que lo reproduce).
- Probidad (assertion `declaraciones>0`): distinguir "fuente devolvió 0 resultados" (¿SPARQL cambió? investigar y arreglar la causa raíz) de "corrida vacía honesta"; la assertion no debe reventar si la fuente legítimamente no tiene novedades — pero un 0 sistemático tras N corridas es señal de drift → fail loud con diagnóstico.
- Backup startup_failure: reparar el YAML si el parse error persiste al re-verificar.

### G7 — WAF camara.cl bloquea IPs de GH Actions (lobby-camara)
- NO se hace evasión de WAF (ni proxies, ni rotación de IP, ni headers engañosos más allá del header-set navegador ya existente). Respeto al servidor es convención LOCKED.
- Decisión: lobby-camara-weekly pasa a FALLBACK LOCAL — runbook + CLI idempotente en `docs/runbooks/cron-local-fallback.md`; el workflow GH queda con schedule deshabilitado (o dispatch-only) y un comentario que explica por qué. Si el WAF vuelve a permitir GH en el futuro, re-habilitar es 1 línea.

### Secrets y verificación LIVE (CRON-04)
- Cargar los secrets faltantes al repo Cuchecorp/gov-map vía `gh secret set` LEYENDO de .env local — los VALORES jamás se imprimen en logs/commits/docs. Lista por NOMBRE en el runbook: R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET (los nombres reales que consuman los YAML), DEEPSEEK_API_KEY, GEMINI_API_KEY (si un cron lo usa), SUPABASE_URL (si falta).
- Billing GH está ACTIVO (verificado en 56) → el camino primario es GH Actions; el fallback local queda para lo WAF-bloqueado y como plan B documentado.
- Verificación verde E2E: el agente PUEDE disparar `workflow_dispatch` de UNA corrida acotada e incremental (agenda-weekly o leyes-weekly) tras cargar secrets y fixes — es ingesta idempotente de datos públicos con rate-limit intacto, no un flag público ni backfill masivo. Los demás crons se verifican en dry-run/local. (El "checkpoint operador" del roadmap asumía secrets/billing ausentes; ambos quedan resueltos en esta fase. El operador puede re-verificar con los comandos del runbook.)

### Límites duros
- NUNCA: flags `*_PUBLIC_ENABLED`, DDL destructivo, backfill masivo en GH Actions, tocar MONEY/SERVEL (gated), imprimir valores de secrets.
- Migraciones SQL solo si un fix las exige (p.ej. índice/constraint para dedupe) — additivas, vía archivo en supabase/migrations + pgTAP, apply con psql --db-url según runbook existente (nunca db push).
- Suite completa + typecheck verdes al cierre; tests nuevos para dedupe G4, early-exit hash-check, y lector R2.

### Claude's Discretion
- Diseño exacto del lector R2 (clave por listado vs registro source_snapshot), nombres de flags CLI, estructura del runbook.
- Orden de ataque de los gaps no-críticos G1–G22 restantes; los CRITICAL (G4, G7, G23) son obligatorios.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `56-CRON-AUDIT.md` + `56-RESEARCH.md`: gap-list G1–G23 con archivo:línea exacto por conector — el planner NO re-investiga, cita esos seams.
- `@obs/ingest`: BaseConnector (orden LOCKED rate-limit→robots→UA→R2), writer R2 aws4fetch If-None-Match, `source_snapshot`/`ingest_run`/`drift_alert`.
- CLIs: run-agenda-prod-cli, run-tramitacion-prod-cli, run-camara-lobby-cli, run-probidad-todos-cli (+ loadEnv CI-safe de INFRA-01).

### Established Patterns
- Corridas acotadas por flags (`--limite`, `--desde/--hasta`, `--boletines`); writers upsert idempotentes por clave natural; degradación honesta sin fabricar filas.
- gh CLI autenticado contra Cuchecorp/gov-map (verificado en 56); psql con PGCLIENTENCODING=UTF8 y BOM-gotcha en .env.

### Integration Points
- Los YAML de `.github/workflows/` consumen los CLIs; el runbook local reusa los MISMOS CLIs (mismo código, convención LOCKED).
- Phase 58 (frescura) leerá `source_snapshot`/`ingest_run` — mantener esos registros escritos por cada corrida es parte del contrato de esta fase.

</code_context>

<specifics>
## Specific Ideas

- El operador pidió "PERFECTO": el criterio operativo es que el lunes siguiente los crons programados corran solos y verdes, y que cualquier re-ingesta a Supabase pueda hacerse desde R2 sin tocar las fuentes.
- Log `[skip] sin novedades` textual exacto para que Phase 58 y el operador lo grep-een.

</specifics>

<deferred>
## Deferred Ideas

- Frescura/alertas por fuente → Phase 58.
- Ingesta de autoría → Phase 59.
- Backfill histórico de tabla de sala Cámara (fuera de alcance desde v3).

</deferred>
