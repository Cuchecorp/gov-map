# Requirements: Observatorio del Congreso 360 — Milestone v11.0

**Defined:** 2026-07-26
**Milestone:** v11.0 — Capa LLM escalonada + cierre de deuda viva
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.

**Regla LOCKED del operador (rectora de todo BENCH/TIER/INTEG):** ante la duda, SIEMPRE calidad. El escalonamiento optimiza latencia/costo ÚNICAMENTE donde el benchmark demuestra paridad de calidad. DeepSeek se mantiene donde luce; la adjudicación de identidad (MiniMax) JAMÁS se degrada ni se observa este milestone.

## v11.0 Requirements

### BENCH — Spike de benchmark por tarea (SEED-001, gate duro de todo lo demás)

- [x] **BENCH-01**: Operador puede correr un harness de benchmark (`packages/llm-bench` o equivalente) que evalúa candidatos (Granite-4.0-H-Micro, Phi-4-mini-instruct, DeepSeek actual) sobre golden sets POR TAREA en español chileno legal, midiendo calidad, latencia, costo y tasa de fallo zod/structured-output como métricas de primera clase separadas
- [x] **BENCH-02**: Existen golden sets es-CL nuevos por tarea (routing, clasificación, juez/validación, paridad de extracción) con distribución estratificada del corpus real — sin leakage al prompt, congelados ANTES de cualquier integración (precedente golden 32 / golden 1263)
- [ ] **BENCH-03**: El benchmark corre contra el endpoint/cuantización EXACTOS que servirían en producción (pinned host+revision; spike local Ollama para calidad, re-medición latencia/costo en host servido) — nunca números de un host distinto al que se integra
- [ ] **BENCH-04**: La capacidad de juez de Phi-4-mini se mide contra etiquetas HUMANAS (no contra el responder), con métricas de sesgo conocidas (self-preference, posición, verbosidad) sobre datos no-PII
- [ ] **BENCH-05**: El spike produce un veredicto POR TAREA con gate de paridad explícito (ε declarado): qué tarea aprueba qué modelo, cuáles quedan en su incumbente — NADA se integra sin su gate verde

### TIER — Plomería del escalonamiento (respond→validate→escalate)

- [ ] **TIER-01**: Adapters Granite y Phi implementan la interfaz `LLMProvider` existente por el patrón openai@5+baseURL (cero SDK nuevo), con los guards fail-closed por construcción (assertNoRutInLlmInput + sensitivity) idénticos a DeepSeek/MiniMax — tool calling o prompt-forzado + zod por proveedor, jamás asumir `response_format: json_schema`
- [ ] **TIER-02**: Existe un `TieredProvider` (decorador que implementa `LLMProvider`) con config declarativa tarea→escalera; los consumidores no cambian de cuerpo (drop-in en el punto de construcción del CLI)
- [ ] **TIER-03**: El juez compone como interfaz separada (`JudgeProvider`), es ESCALATE-ONLY (puede escalar/rechazar, jamás aprobar ni suavizar una compuerta), y sus veredictos quedan registrados estructurados para auditabilidad
- [ ] **TIER-04**: Telemetría por llamada (modelo, tarea, latencia, costo, veredicto, escalación) sin payload ni PII en logs, alimentando el loop de benchmark; escalación acotada (sin loops, presupuesto máximo por ítem)
- [ ] **TIER-05**: El ruteo ocurre ENTRE pipelines, nunca a mitad de sesión — la economía del prompt-cache DeepSeek en fichas queda intacta (verificable)

### INTEG — Integración de la tarea de menor riesgo

- [ ] **INTEG-01**: UNA tarea reversible no-legal (clasificación o routing, elegida por evidencia del spike) corre con la escalera integrada en producción de pipeline, gated por su golden set verde en CI como regresión permanente
- [ ] **INTEG-02**: Extracción de fichas sigue en DeepSeek y adjudicación de identidad sigue en MiniMax, sin cambio de comportamiento — guard estático/CI que impide que la escalera toque `adjudicacion.*` y la extracción strict-schema
- [ ] **INTEG-03**: Rollback trivial: apagar la escalera vuelve al incumbente por config, sin migración ni deploy especial

### BCN — Parser senadores en origen

- [x] **BCN-01**: El parser de `@obs/bio` resuelve `hasPoliticalParty` URI→label legible en ORIGEN (mapeo determinista, fail-closed ante URI desconocida) y la re-corrida de militancias deja cero URI-como-partido en las filas afectadas de PROD
- [x] **BCN-02**: `partidoLegible()` (cinturón display-only de 104-03) queda como defensa en profundidad o se retira, según evidencia post-re-corrida — decisión documentada

### V7GATES — Pasada de cierre de gates v7.0 (con operador en la corrida)

- [ ] **V7-01**: Migraciones 0052/0053/0054 aplicadas a PROD (`psql --single-transaction`, runbooks existentes) con sus pgTAP verdes contra schema aplicado
- [ ] **V7-02**: RUT-01 poblado en la maestra vía checkpoint blocking-human (operador ejecuta el write por runbook 69; el agente prepara/verifica, jamás escribe RUT)
- [ ] **V7-03**: Backfills LIVE de votos Cámara (runbook 66) y Senado (runbook 67) corridos con checkpoint operador; cobertura N/M reportada + invariantes (dipids no_confirmado=0, tokens SELECCION confirmados)
- [ ] **V7-04**: Backfills de dinero corridos con checkpoint operador: ChileCompra por RUT (runbook 70, post RUT-01, cuota 10k/día) y SERVEL .xlsx por elección (runbook 71)
- [ ] **V7-05**: Gates de comprensión/visuales cerrados sobre deploy real: cold-read votos (68-BROWSEROS-GATE), cold-read MONEY gated-preview (73), no-regresión visual /red (75)
- [ ] **V7-06**: Flip MONEY_PUBLIC_ENABLED ejecutado SOLO tras sign-off legal 21.719 del operador en 13-LEGAL-DOSSIER (`signoff: approved`) — el agente documenta, el operador firma y flipea; si el operador no firma, MONEY queda OFF y el milestone lo declara honesto
- [ ] **V7-07**: CI/secrets v7.0 cargados por operador (CLOUDFLARE_API_TOKEN/ACCOUNT_ID en GH) + rotación DB password B26 verificada (url vieja falla, nueva funciona, CI verde)
- [ ] **V7-08**: v7.0 auditada y archivada (`audit-milestone` → `complete-milestone v7.0`) al cerrar los gates alcanzados, con deuda restante declarada explícita

### QT — Cierre formal de quick tasks

- [ ] **QT-01**: Las 5 quick tasks abiertas (260623-rtl, 260702-rbb, 260713-izo, 260715-bvd, 260722-eia) tienen marcador formal de cierre en su directorio y STATE.md las refleja

## v2 Requirements (deferred)

### Escalonamiento ampliado

- **TIERX-01**: Integrar cada tarea adicional cuya paridad quede demostrada (ampliación por evidencia, milestone futuro)
- **TIERX-02**: Phi como segunda opinión record-only sobre adjudicación de identidad — requiere host con DPA/no-train confirmado (21.719) + diseño de golden set de juez con etiquetas humanas sobre casos de identidad
- **TIERX-03**: Router aprendido / umbrales de confianza calibrados por tarea (solo si el registro de telemetría de v11.0 lo justifica)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modelos chicos en extracción strict-schema de fichas | Evidencia de research: ~3B da near-zero schema accuracy; DeepSeek se queda donde luce (regla del operador) |
| Cualquier cambio al camino de adjudicación de identidad (responder, compuerta, umbral) | Tarea CRÍTICA (riesgo existencial #1); ni se toca ni se observa este milestone (decisión operador 2026-07-26) |
| Router aprendido / dynamic pricing per-request | Anti-feature (research): rompe reproducibilidad del gate; reglas estáticas bastan |
| Fine-tuning de modelos chicos | Fuera del alcance swap-by-baseURL; complejidad sin evidencia de necesidad |
| Escalación por auto-confianza del modelo chico | Miscalibrada (research); solo veredicto de juez o fallo zod escalan |
| Azure AI Foundry como host | Rompe la disciplina apiKey+baseURL del stack |
| Juez que APRUEBA o relaja compuertas | El juez solo endurece/escala; aprobar es teatro de validación con juez débil |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BENCH-01 | Phase 106 | Complete |
| BENCH-02 | Phase 106 | Complete |
| BENCH-03 | Phase 106 | Pending |
| BENCH-04 | Phase 107 | Pending |
| BENCH-05 | Phase 107 | Pending |
| TIER-01 | Phase 107 | Pending |
| TIER-02 | Phase 108 | Pending |
| TIER-03 | Phase 108 | Pending |
| TIER-04 | Phase 108 | Pending |
| TIER-05 | Phase 108 | Pending |
| INTEG-01 | Phase 109 | Pending |
| INTEG-02 | Phase 109 | Pending |
| INTEG-03 | Phase 109 | Pending |
| BCN-01 | Phase 105 | Complete |
| BCN-02 | Phase 105 | Complete |
| V7-01 | Phase 110 | Pending |
| V7-07 | Phase 110 | Pending |
| V7-02 | Phase 111 | Pending |
| V7-03 | Phase 111 | Pending |
| V7-04 | Phase 111 | Pending |
| V7-05 | Phase 112 | Pending |
| V7-06 | Phase 112 | Pending |
| V7-08 | Phase 112 | Pending |
| QT-01 | Phase 112 | Pending |

**Coverage:**

- v11.0 requirements: 24 total
- Mapped to phases (105-112): 24/24 ✓
- Unmapped: 0
- Duplicates: 0

**Phase distribution:**

- Phase 105 (BCN parser en origen): BCN-01, BCN-02
- Phase 106 (BENCH harness + golden sets): BENCH-01, BENCH-02, BENCH-03
- Phase 107 (BENCH adapters + juez + veredicto): BENCH-04, BENCH-05, TIER-01
- Phase 108 (TIER plomeria): TIER-02, TIER-03, TIER-04, TIER-05
- Phase 109 (INTEG tarea menor riesgo): INTEG-01, INTEG-02, INTEG-03
- Phase 110 (V7GATES applies + CI/B26): V7-01, V7-07
- Phase 111 (V7GATES RUT-01 + backfills): V7-02, V7-03, V7-04
- Phase 112 (V7GATES cold-reads + flip MONEY + close + quick tasks): V7-05, V7-06, V7-08, QT-01

---
*Requirements defined: 2026-07-26*
*Last updated: 2026-07-26 after roadmap (phases 105-112 mapped, 24/24 coverage)*
