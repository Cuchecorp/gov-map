# Phase 56: CRON-AUDIT — Auditoría E2E de los 9 workflows de ingesta - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva del operador: "todo en modo autónomo"; override posible editando este archivo antes de plan-phase)

<domain>
## Phase Boundary

Producir el diagnóstico completo del estado de la ingesta programada: inventario auditado de los 9 workflows de GitHub Actions (`agenda-weekly`, `leyes-weekly`, `lobby-camara-weekly`, `lobby-leylobby-weekly`, `probidad-weekly`, `fichas-backfill`, `backup-parlamentario`, `backfill`, `deploy-cloudflare`) con veredicto por cron (corre / no corre / por qué) y gap-list accionable con precisión archivo:línea. SOLO diagnóstico — el hardening es Phase 57. Esta fase NO modifica conectores ni workflows (salvo el propio documento de auditoría).

</domain>

<decisions>
## Implementation Decisions

### Método de auditoría
- Estática + probes read-only EN VIVO: leer los 9 YAML + los CLIs/conectores subyacentes (`packages/@obs/*`), y verificar contra la realidad: `gh run list` por workflow (historial de corridas, verdes/rojas/nunca corrió), `gh secret list` (presencia de secrets por NOMBRE, jamás valores), listado/HEAD de R2 (¿hay snapshots recientes por fuente?), SELECTs read-only a Supabase PROD (última fila por tabla destino, `ingest_run`, `source_snapshot`).
- PROHIBIDO en esta fase: disparar ingestas reales, tocar fuentes gubernamentales, workflow_dispatch de crons de datos, escribir a R2/Supabase. Un `workflow_dispatch` de prueba solo si existe un workflow inocuo (p.ej. deploy NO se dispara).
- Billing GH: verificar estado real (gh api / última corrida programada ejecutada vs saltada) — el gotcha 2026-06-23 decía billing bloqueado; confirmar si sigue así porque decide el fallback local de CRON-04.

### Entregable y formato
- Documento único: `56-CRON-AUDIT.md` en el phase dir (fuente de verdad para Phase 57), con: (a) tabla resumen 9 filas — workflow, schedule, trigger, secrets requeridos vs presentes, última corrida real, veredicto; (b) sección por workflow con cadena completa fuente→R2→Supabase, cumplimiento DOS ETAPAS y hash-check con archivo:línea; (c) gap-list numerada (G1, G2, …) accionable, cada gap con severidad, archivo:línea y fix propuesto — insumo directo de Phase 57.
- Veredictos cerrados: `VERDE` (corre y cumple), `CORRE-CON-GAPS`, `NO-CORRE` (con causa: secrets / billing / trigger / bug), `NO-APLICA-CRON` (backfill/deploy son manuales por diseño — auditarlos igual pero contra su propósito).
- Frescura observada por fuente queda REGISTRADA en el audit (sirve de baseline para CRON-05 / Phase 58).

### Criterio de cumplimiento (lo que se audita por conector)
- DOS ETAPAS LOCKED: ¿el crudo va a R2 content-addressed ANTES de parsear? ¿la carga a Supabase puede re-ejecutarse leyendo SOLO de R2 sin tocar la fuente? (buscar el seam real en el código, no asumir).
- Hash-check: ¿comprueba sha256/ETag/If-None-Match ANTES de descargar? ¿corrida sin novedades sale temprano?
- Rate-limit 2–3s/host, UA identificatorio, robots — verificar que siguen cableados (regresión).
- Secrets requeridos por workflow enumerados por nombre exacto (cruzar `env:`/`secrets.` del YAML contra `gh secret list`).

### Claude's Discretion
- Estructura interna del documento, orden del barrido, y qué CLIs leer en profundidad.
- Si `gh` CLI no está autenticado para el repo remoto (Cuchecorp/gov-map — ver memoria de transfer), degradar honesto: registrar "no verificable desde este entorno" como gap, nunca inventar estado.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/` — los 9 YAML a auditar.
- `packages/` monorepo `@obs/*`: `ingest` (BaseConnector: rate-limit/robots/UA/R2 content-addressed If-None-Match 412=idempotente), `tramitacion`, `agenda`, `lobby`, `probidad`, `fichas`, `votos` — cada uno con su CLI (`run-*-cli`).
- Tablas de observabilidad ya existentes: `ingest_run`, `source_snapshot`, `drift_alert`, `lobby_ingesta_estado` (patrón `*_ingesta_estado`).
- Credenciales `.env`: R2 S3 OK, `SUPABASE_DB_URL` OK (psql read-only probado en fases previas; PGCLIENTENCODING=UTF8 en Windows; BOM U+FEFF al extraer del .env).

### Established Patterns
- Convención LOCKED (CLAUDE.md): dos etapas fuente→R2→Supabase; hash-check antes de descargar; backfill masivo = LOCAL; cron = novedades L–V acotadas.
- Gotchas conocidos: WAF camara.cl bloquea fetch de Node (curl OK); billing GH bloqueado al 2026-06-23 (→ ingesta local); cron agenda-weekly esperaba secrets DEEPSEEK+R2 nunca cargados; MONEY/SERVEL fuera del cron mientras gated.

### Integration Points
- El audit alimenta directamente Phase 57 (gap-list = backlog de hardening) y Phase 58 (baseline de frescura).

</code_context>

<specifics>
## Specific Ideas

- El operador pidió "dejar todos los cron andando bien, de modo detallado" — el audit debe ser lo bastante granular para que Phase 57 no re-investigue nada (archivo:línea por gap).
- Nunca imprimir valores de secrets ni credenciales en el documento.

</specifics>

<deferred>
## Deferred Ideas

- Arreglos de los gaps encontrados → Phase 57 (CRON-FIX).
- Reporte de frescura como herramienta permanente → Phase 58 (CRON-FRESH).

</deferred>
