---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Parlamentarios 360
status: verifying
stopped_at: "Completed 09-03-PLAN.md (LEGAL-03: piso RLS/PII + pgTAP 11/11 remoto)"
last_updated: "2026-06-19T04:36:29.390Z"
last_activity: 2026-06-19
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 4
  completed_plans: 5
  percent: 18
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 9 — Completitud de Identidad

## Current Position

Phase: 9 (Completitud de Identidad) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Next phase: Phase 09 — Completitud de Identidad (puede correr en paralelo); Phase 10 (@obs/votos) desbloqueada
Last activity: 2026-06-19

## Performance Metrics

**Velocity:**

- Total plans completed (v2.0): 0
- Average duration: -
- Total execution time: 0 hours

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

**v1.0 plan history (shipped):**

| Phase 01 P01 | 11min | 3 tasks | 16 files |
| Phase 01 P02 | 9min | 3 tasks | 25 files |
| Phase 01 P03 | 18min | 2 tasks | 9 files |
| Phase 02 P01 | 8min | 3 tasks | 18 files |
| Phase 02 P02 | 3min | 2 tasks | 7 files |
| Phase 02 P03 | 5min | 1 tasks | 2 files |
| Phase 03 P01 | 14min | 3 tasks | 13 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 03 P03 | 18min | 3 tasks | 14 files |
| Phase 03 P04 | 14min | 3 tasks | 13 files |
| Phase 04 P01 | 9min | 3 tasks | 13 files |
| Phase 04 P02 | 4min | 2 tasks | 2 files |
| Phase 04 P03 | 12min | 3 tasks | 10 files |
| Phase 05 P01 | 8min | 3 tasks | 16 files |
| Phase 05 P02 | 7min | 3 tasks | 13 files |
| Phase 05 P03 | 8min | 2 tasks | 5 files |
| Phase 05 P04 | 30min | 4 tasks | 36 files |
| Phase 05 P05 | 19min | 3 tasks | 15 files |
| Phase 06 P01 | 12min | 3 tasks | 15 files |
| Phase 06 P02 | 9 | 3 tasks | 10 files |
| Phase 06 P03 | 9min | 2 tasks | 14 files |
| Phase 06 P04 | 17 | 4 tasks | 14 files |
| Phase 07 P02 | 11min | 3 tasks | 14 files |
| Phase 09 P01 | 12min | 2 tasks | 10 files |
| Phase 09 P02 | 7min | 2 tasks | 8 files |
| Phase 09 P03 | 14 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap v2.0]: Numeración continúa desde v1.0 — Phase 7 fue la última de v1.0; v2.0 arranca en Phase 8 (no reset)
- [Roadmap v2.0]: Build order forzado por dependencias duras — VOTE spike (8, gate) + Identidad (9, paralelo) → VOTE (10) → INT Lobby (11) → INT Probidad (12) → Legal MONEY (13) → MONEY ChileCompra (14) → MONEY SERVEL (15) → MONEY agregación (16) → Legal NET (17) → NET (18)
- [Roadmap v2.0]: VOTE-01 es su propia fase temprana (Phase 8) framed confirm-or-replan; no se dimensiona el bloque VOTE hasta que el spike vuelva
- [Roadmap v2.0]: IDENT-12 (writer-invariant tipado) + LEGAL-03 (RLS/data-routing PII) aterrizan en Phase 9, ANTES de que escriba el primer dataset de atribución nuevo
- [Roadmap v2.0]: Sub-maestras se construyen en su bloque, NO en NET — lobista (11), contratista (14), donante (15); NET (18) es consumidor puro
- [Roadmap v2.0]: LEGAL-01 gate ANTES de exponer MONEY (Phase 13); LEGAL-02 gate ANTES de exponer NET (Phase 17)
- [Roadmap v2.0]: Cada fase de dataset entrega rebanada vertical conector → reconciliación → sección de ficha; "ninguna unidad de UI compone dinero/lobby con un voto" es criterio de éxito desde la primera sección multi-dataset (Phase 11)
- [Roadmap]: M1 = Fundaciones + Identidad + P2 Tramitación + P1 Búsqueda semántica; 7 fases en orden de dependencia dura
- [Roadmap]: Identidad dividida en determinista (P3, desbloquea Tramitación) y adjudicación LLM + gate (P4, sella riesgo existencial #1)
- [Roadmap]: Conectores ordenados por fragilidad ascendente — JSON/XML (P5) antes que WebForms/Next.js (P6)
- [Phase 01]: [01-02]: rate-limiter serial por host (Map host->cola encadenada); BaseConnector Template Method fija el flujo invariante (FND-01)
- [Phase 01]: [01-02]: R2 inmutable via aws4fetch + If-None-Match:* (412=idempotente); drift no-bloqueante (FND-02/FND-04)
- [Phase 02]: [02-02]: MiniMax structured output = tool-calling forzado (tool_choice fija emit_result), NO response_format; valida por compuerta zod externa
- [Phase 02]: [02-02]: data-routing en codigo — assertNoRutInLlmInput (RUT nunca al LLM) + assertSensitivityAllowed reusa SensitiveRoutingError
- [Phase 02]: [02-03]: GeminiEmbeddingProvider L2-normaliza manual a 768 (Gemini no normaliza a dims!=3072); todo vector versionado (FND-07)
- [Phase 03]: [03-01]: matchDeterminista fail-closed, único escritor de estado; confirma solo con length===1 (RUT exacto o nombre único en cámara+periodo)
- [Phase 03]: [03-04]: corrida LIVE → maestra 186 filas (31 senadores + 155 diputados) en Supabase local + snapshot git autoritativo (ID-09); seeder nunca auto-confirma
- [Phase 04]: [04-01]: UMBRAL=0.90 con < ESTRICTO; auto-aceptar mapea SOLO a 'probable', NUNCA 'confirmado'; promocion a confirmado es exclusiva de humano/determinista
- [Phase 04]: [04-02]: identidad_audit inmutable por trigger BEFORE UPDATE OR DELETE + REVOKE (defensa en profundidad, aplica al service role)
- [Phase 05]: [05-01]: RLS public-read EXPLICITO + GRANT SELECT en tablas de tramitacion; parlamentario.rut intacta (deny-by-default)
- [Phase 05]: [05-03]: voto Cámara cruza determinísticamente por Diputado/Id (sin LLM); Senado por nombre vía correrPipeline; solo determinista/confirmado puebla parlamentario_id
- [Phase 05]: Guarda de identidad en UI (TRAM-06): VotoRow enlaza al parlamentario SOLO si estado_vinculo=confirmado; si no, nombre crudo + IdentityMarker
- [Phase 06]: [06-01]: citacion_invitado SIN parlamentario_id ni reconciliacion — invitados son terceros, texto crudo
- [Phase 06]: runIngest degrada honestamente: tabla de Cámara→PDF sin fabricar filas; 403 persistente degrada esa fuente sin abortar el Senado
- [Phase 07]: [07-01]: gate de extracción literal golden (precision>=0.95 BLOQUEA CI); 0011 — RPC match_proyectos ordena por distancia CRUDA `<=>` ASC (HNSW), grant execute a anon
- [Phase 07]: [07-02]: texto-fuente reusa @obs/ingest en orden LOCKED; degradacion encadenada texto null→idea_matriz null→embed titulo+materia (nunca fabrica)
- [Phase 08]: [08-01]: VOTE spike CONFIRMÓ EN VIVO — `getVotacion_Detalle` entrega DIPID+Opcion no-null, totales reconcilian (count(si)===total_si, count(no)===total_no), y DIPID mapea a `id_diputado_camara` determinísticamente al 100% sobre 6 votaciones Leg-58 (boletines 14309/18296). Decisión binaria: **CONFIRMAR** → construir Phase 10 (@obs/votos) tal cual. Corrida LIVE 2026-06-19: 8 requests, 0 errores, delay 2-3s LOCKED reflejado. El allowlist NO requiere edición (camara.cl ya es sufijo)
- [Phase ?]: [Phase 09]: [09-01]: EnlaceConfirmado branded (unique symbol privado, NO exportado) + factory unica confirmar() en @obs/identity; el FK del voto se tipa EnlaceConfirmado|null (string crudo = error de compilacion, IDENT-12)
- [Phase ?]: [Phase 09]: [09-01]: reconciliar-senado + reconciliar-camara (DIPID) son los unicos mint sites de confirmar(); Voto persistido sigue plano string|null (Anti-Pattern A4: input branded, storage plano)
- [Phase ?]: [Phase 09]: [09-02]: backfill-rut DV-gate (isRutValido modulo-11) + provenance + updateRut por id; NUNCA fabrica un RUT (invalido/sin-provenance -> revision). Track B curado entregado; Track A SERVEL NO perseguido (RUT por nombre = candidato, no hecho)
- [Phase ?]: [Phase 09]: [09-02]: golden +3 casos RUT (colision/persona-juridica/colision dura) -> revision/no_match, gate >=0.95 intacto; parlamentario-rut.seed.json filas vacio (operador puebla con DV-validos + provenance)
- [Phase ?]: [Phase 09]: [09-03]: PII nueva nace en tabla deny-by-default (RLS on + cero policies + sin GRANT a anon, espejo de 0005); filas publicas llevan solo el FK, nunca el RUT (LEGAL-03)
- [Phase ?]: [Phase 09]: [09-03]: assertPiiDocumentSafeForLlm COMPONE assertNoRutInLlmInput + assertSensitivityAllowed (RUT primero); cero duplicacion del regex/gate
- [Phase ?]: [Phase 09]: [09-03]: 0018 APLICADA al remoto sa-east-1 (pooler) + pgTAP 11/11 PASS contra schema aplicado; DB password no roto

### Pending Todos

None yet for v2.0.

### Blockers/Concerns

- [v2.0 Phase 8 — GATE] ✅ RESUELTO 2026-06-19: spike CONFIRMÓ EN VIVO que `opendata.camara.cl/getVotacion_Detalle` entrega `Diputado/DIPID`+`Opcion` poblados (no null), totales reconcilian y DIPID mapea a `id_diputado_camara` al 100% en la muestra Leg-58. Decisión: **CONFIRMAR** — Phase 10 (@obs/votos) desbloqueada, construir tal cual. (No se replanifica el bloque VOTE.)
- [v2.0 Phase 11 re-validar]: endpoint bulk de `leylobby.gob.cl` devolvió 503 en research — re-validar antes de construir `@obs/lobby`.
- [v2.0 Phase 15 — riesgo conocido]: conector SERVEL artesanal/frágil (no API REST). Drift BLOQUEANTE + reconciliación de completitud obligatorios; una corrida parcial se pone en cuarentena, nunca emite filas silenciosamente. Agregar `servel.cl`/`aportes.servel.cl` al allowlist.
- [v2.0 Phase 14 — quota]: ChileCompra rate/quota (10k req/día) con fan-out por ~186 RUTs → barrido serial vía pgmq + GH Actions; "consultado-cero" ≠ "no-consultado".
- [v2.0 Phases 13/17 — gates legales DUROS]: LEGAL-01 ANTES de exponer MONEY públicamente; LEGAL-02 ANTES de exponer NET. Ley 21.719 plena vigencia 2026-12-01.
- [Deuda v1.0 acarreada]: (1) 🔴 rotar DB password de Supabase (expuesto en transcript); (2) aplicar migración 0011 al Supabase LOCAL (checkpoint humano 07-01 Task 5); (3) cargar corpus a la nube + wiring app→nube; (4) persistir link_mensaje_mocion para activar idea matriz; (5) desplegar Edge Functions + vault secrets. Ver `.planning/v1.0-MILESTONE-AUDIT.md`.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Búsqueda semántica | Persistir `link_mensaje_mocion` end-to-end (idea matriz dormida hasta cablearlo) | Pending | v1.0 close |
| Infra | Cargar corpus a la nube + wiring app→nube + aplicar 0011 LOCAL + rotar DB password | Pending | v1.0 close |
| v2.1+ | NET-D (contraparte compartida) + cruces inter-bloque — diferidos por riesgo "máquina de sospechas" | Deferred | v2.0 roadmap |

## Session Continuity

Last session: 2026-06-19T04:36:29.376Z
Stopped at: Completed 09-03-PLAN.md (LEGAL-03: piso RLS/PII + pgTAP 11/11 remoto)
Resume file: None

## Operator Next Steps

- Phase 8 CONFIRMÓ: planificar Phase 10 (`@obs/votos` producción) con `/gsd:plan-phase 10` — conector + modelo de voto + reconciliación + ficha, reusando los símbolos v1.0 validados.
- Phase 9 (Identidad) puede planificarse/correr en paralelo (VOTE Cámara usa DIPID, no RUT).
- El paquete `packages/votos` es throwaway (spike); Phase 10 lo reemplaza con `src/` de producción.
