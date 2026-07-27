# Requirements: Observatorio del Congreso 360 — Milestone v12.0

**Defined:** 2026-07-27
**Core Value:** La ciudadanía puede responder "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Milestone goal:** Validación general producto-a-producto: links + fechas verificados, crons robustos con escalera LLM encendida donde el benchmark aprobó, cruces + estructura Supabase auditados. Modo validar-y-arreglar (Sonnet ejecuta, Opus valida, Fable decide).

## v12.0 Requirements

### Links

- [ ] **LINK-01**: Existe un inventario rector de superficies (toda ruta pública × links que emite, internos y externos) como artefacto del milestone
- [ ] **LINK-02**: Todo link interno del sitio resuelve (cero 404, cero anchors rotos) — verificado exhaustivo sobre el deploy real
- [ ] **LINK-03**: Todo patrón de link externo a fuente (camara.cl, senado.cl, BCN, leylobby) queda validado por construcción + muestra live estratificada por tipo (rate-limit 2-3s/host), con hallazgos corregidos

### Fechas

- [ ] **FECHA-01**: Cada fecha visible en cada superficie queda auditada semánticamente (fecha del hecho vs fecha de captura) — `fecha_captura` jamás presentada como el hecho
- [ ] **FECHA-02**: Toda etiqueta de fecha incorrecta o ambigua queda corregida ("según fuente al…" donde corresponda)

### Crons

- [ ] **CRON-01**: Auditoría E2E de TODOS los workflows (GH Actions + pg_cron) con veredicto por cron (verde/stale/roto) y evidencia
- [ ] **CRON-02**: Robustez cerrada donde falte: reintentos/backoff, cursores, hash-check, señales freshness — cada cron degrada honesto, jamás fabrica
- [ ] **CRON-03**: Escalera LLM encendida en clasificación (`CLASIFICACION_ESCALERA=1`) tras shadow-eval verde + drift canary + rollback-by-config — flip AUTORIZADO por el operador 2026-07-27; checkpoint de provisión keys Workers AI con operador
- [ ] **CRON-04**: Extensión de la escalera a otras tareas SOLO con benchmark nuevo de paridad; sin evidencia = no se extiende (documentado por tarea)

### Cruces

- [ ] **CRUCE-01**: Cada cruce visible en el sitio cuadra contra SQL de PROD (conteos, denominadores, cobertura declarada) — discrepancias corregidas

### Supabase

- [ ] **SUPA-01**: Auditoría de estructura completa (schema, RLS, grants, RPCs bounded, PUBLIC_RPC_ALLOWLIST, secdef/search_path) con supabase-reviewer como gate — 0 offenders o fix aplicado
- [ ] **SUPA-02**: Fixes de estructura aplicados a PROD como migraciones aditivas + pgTAP contra schema aplicado

### Cierre

- [ ] **E2E-01**: Pasada final producto-a-producto sobre el deploy real (BrowserOS) confirmando que todo lo validado sigue verde post-fixes

## Future Requirements

- Extensión de la escalera LLM a extracción/juez/routing cuando un benchmark nuevo demuestre paridad (CRON-04 documenta el estado por tarea)
- Backfills LIVE (votos 66/67, ChileCompra 70, SERVEL 71) + RUT-01 — deuda operador Phase 111, fuera de este milestone
- Flip MONEY (Phase 112) y provisión NOTIF (103-HUMAN-UAT) — actos operador

## Out of Scope

| Item | Reasoning |
|------|-----------|
| Flips MONEY/NOTIF/nuevos VSIM | Gates legales/operador separados; este milestone no toca flags no autorizados |
| RUT-01 + backfills LIVE | Deuda operador (111-OPERATOR-CHECKPOINT.md); requiere actos humanos LOCAL |
| Features nuevas de producto | Milestone de validación, no de construcción |
| Link-check externo exhaustivo | Decisión operador 2026-07-27: patrón + muestra estratificada (rate-limit, WAF) |

## Traceability

Filled by roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Requirements defined: 2026-07-27*
*Last updated: 2026-07-27*
