# Requirements: Observatorio del Congreso 360 — Milestone v12.0

**Defined:** 2026-07-27
**Core Value:** La ciudadanía puede responder "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Milestone goal:** Validación general producto-a-producto: links + fechas verificados, crons robustos con escalera LLM encendida donde el benchmark aprobó, cruces + estructura Supabase auditados. Modo validar-y-arreglar (Sonnet ejecuta, Opus valida, Fable decide).

## v12.0 Requirements

### Links

- [x] **LINK-01**: Existe un inventario rector de superficies (toda ruta pública × links que emite, internos y externos) como artefacto del milestone
- [x] **LINK-02**: Todo link interno del sitio resuelve (cero 404, cero anchors rotos) — verificado exhaustivo sobre el deploy real
- [x] **LINK-03**: Todo patrón de link externo a fuente (camara.cl, senado.cl, BCN, leylobby) queda validado por construcción + muestra live estratificada por tipo (rate-limit 2-3s/host), con hallazgos corregidos

### Fechas

- [x] **FECHA-01**: Cada fecha visible en cada superficie queda auditada semánticamente (fecha del hecho vs fecha de captura) — `fecha_captura` jamás presentada como el hecho
- [x] **FECHA-02**: Toda etiqueta de fecha incorrecta o ambigua queda corregida ("según fuente al…" donde corresponda)

### Crons

- [x] **CRON-01**: Auditoría E2E de TODOS los workflows (GH Actions + pg_cron) con veredicto por cron (verde/stale/roto) y evidencia
- [x] **CRON-02**: Robustez cerrada donde falte: reintentos/backoff, cursores, hash-check, señales freshness — cada cron degrada honesto, jamás fabrica
- [x] **CRON-03**: Escalera LLM encendida en clasificación (`CLASIFICACION_ESCALERA=1`) tras shadow-eval verde + drift canary + rollback-by-config — flip AUTORIZADO por el operador 2026-07-27; checkpoint de provisión keys Workers AI con operador
- [x] **CRON-04**: Extensión de la escalera a otras tareas SOLO con benchmark nuevo de paridad; sin evidencia = no se extiende (documentado por tarea)

### Cruces

- [x] **CRUCE-01**: Cada cruce visible en el sitio cuadra contra SQL de PROD (conteos, denominadores, cobertura declarada) — discrepancias corregidas

### Supabase

- [x] **SUPA-01**: Auditoría de estructura completa (schema, RLS, grants, RPCs bounded, PUBLIC_RPC_ALLOWLIST, secdef/search_path) con supabase-reviewer como gate — 0 offenders o fix aplicado
- [x] **SUPA-02**: Fixes de estructura aplicados a PROD como migraciones aditivas + pgTAP contra schema aplicado

### Cierre

- [x] **E2E-01**: Pasada final producto-a-producto sobre el deploy real (BrowserOS) confirmando que todo lo validado sigue verde post-fixes

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

Mapeado por el roadmap v12.0 (Phases 113-125). Coverage 13/13 — cero huérfanos, cero duplicados.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LINK-01 | Phase 113 — INV inventario rector de superficies | Complete |
| LINK-02 | Phase 114 — LINK-INT links internos exhaustivos | Complete |
| LINK-03 | Phase 115 — LINK-EXT patrones de link a fuente oficial | Complete |
| FECHA-01 | Phase 116 — FECHA-AUDIT semántica de cada fecha visible | Complete |
| FECHA-02 | Phase 117 — FECHA-FIX etiquetas de fecha corregidas | Complete |
| CRON-01 | Phase 118 — CRON-AUDIT veredicto por cron con evidencia | Complete |
| CRON-02 | Phase 119 — CRON-FIX robustez de ingesta | Complete |
| CRON-03 | Phase 120 — ESCALERA-ON flip `CLASIFICACION_ESCALERA=1` | Complete |
| CRON-04 | Phase 121 — ESCALERA-DOC extensión solo con benchmark | Complete |
| CRUCE-01 | Phase 122 — CRUCE-SQL cruces visibles × SQL de PROD | Complete |
| SUPA-01 | Phase 123 — SUPA-AUDIT auditoría de estructura Supabase | Complete |
| SUPA-02 | Phase 124 — SUPA-FIX migraciones aditivas a PROD | Complete |
| E2E-01 | Phase 125 — E2E pasada final sobre el deploy real | Complete |

---
*Requirements defined: 2026-07-27*
*Last updated: 2026-07-27 — traceability mapeada por el roadmap v12.0 (Phases 113-125)*
