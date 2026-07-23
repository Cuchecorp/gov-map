# Requirements: Observatorio del Congreso 360 — v10.0

**Defined:** 2026-07-23
**Milestone:** v10.0 — Panel de actualidad legislativa (landing) + notificaciones + relaciones
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — sin afirmar jamás intención ni causalidad.
**Brief del operador (2026-07-23):** landing = panel de actualidad cuantitativo usable por quien va todos los días al Congreso; señales derivadas de datos objetivos (ser creativo con BCN); crons más frecuentes OK; evaluar/construir notificaciones por suscripción; relaciones entre parlamentarios EXHAUSTIVAS (partido, coalición, comisiones, co-autoría, "si votan parecido"); benchmark UX/UI vs senado.cl/camara.cl; TODO con base empírica (spikes, BrowserOS, diseño→crítica→loop); fase final "asegúrate que todo funciona".
**Regla rectora heredada (LOCKED):** toda señal/relación es factual con fuente+fecha; la ausencia de datos se DECLARA, jamás se emite como hecho; anti-insinuación (linter) cubre todo copy nuevo.

## v10.0 Requirements

### AUTH — De-risk estructural (spike primero)

- [ ] **AUTH-01**: El deploy OpenNext/Cloudflare sostiene sesión Supabase Auth end-to-end (primer `middleware.ts` del repo, Edge-style — NO Node Middleware 15.2+; `@supabase/ssr`, Set-Cookie + refresh verificados sobre deploy real) ANTES de construir cualquier feature de usuario.

### SEN — Señales de actualidad (datos ANTES que frontend — gate del operador)

- [ ] **SEN-01**: SPIKE-auditoría de `tramitacion_evento` (frescura, cobertura por cámara, fiabilidad de primer-evento por boletín) clasifica CADA señal candidata como honesta/sesgada/imposible — gatea el panel completo. `fecha_captura` JAMÁS se usa como "fecha de ingreso".
- [ ] **SEN-02**: Las señales viven en tabla precomputada (`actualidad_senal`, espejo `cruce_senal`/0039) refrescada offline (SQL puro → pg_cron; lógica TS → GH Actions intradía L-V); la landing lee filas listas vía RPC bounded PII-safe allowlisted.
- [ ] **SEN-03**: Toda señal se suprime (con causa) cuando su fuente está stale — "sin movimiento" nunca se afirma si no se scrapeó; sesgo de cobertura Cámara/Senado declarado por señal.
- [ ] **SEN-04**: Señales mínimas del panel (las que el SPIKE valide): actividad reciente por ventana (conteo factual de trámites, framing "N trámites en 7 días" — nunca "top/los más", resuelve el lock T-52-13), nuevos ingresos (solo si el reloj es fiable), urgencias vivas, votaciones/citaciones próximas (agenda), archivados/retirados recientes.
- [ ] **SEN-05**: Agrupación POR TEMA de proyectos con movimiento usando `materia` oficial como label primario (+ clustering k-means determinista seed-fija sobre embeddings existentes como capa secundaria) — labels JAMÁS generados por LLM.
- [ ] **SEN-06**: Señal "leyes recién publicadas" evaluada empíricamente contra BCN (`portada_ulp`)/Cámara (`leyes_promulgadas.aspx`) — si la fuente es viable, entra por dos-etapas R2; si no, se difiere documentado.

### PANEL — Landing de actualidad (frontend)

- [ ] **PANEL-01**: La landing muestra "qué está pasando" (señales SEN validadas) en lugar del bento producto-céntrico, reusando primitivas BentoGrid/tokens y conservando candados de régimen (cero-hex, tipografía, linter home extendido a `SUPERFICIES_PANEL` ANTES del copy).
- [ ] **PANEL-02**: Cada tile/señal lleva fuente+fecha y estados vacíos honestos ("en las fuentes consultadas al [fecha]"); cero agregación cara on-read (lee precomputado).
- [ ] **PANEL-03**: Benchmark empírico BrowserOS de senado.cl y camara.cl (portada/actualidad/tablas) documentado con crítica de diseño — qué evitar y qué superar; el panel itera diseño→crítica→loop contra ese benchmark.
- [ ] **PANEL-04**: Gate BrowserOS de lectura fría sobre el deploy real (comprensible para periodista/tramitador/ciudadano) — criterio de éxito, no opcional.

### REL — Relaciones entre parlamentarios (exhaustivas)

- [ ] **REL-01**: Audit de brecha dato-disponible vs superficie-mostrada (los 4 cross-links 0060/0061 existen pero enterrados; /red NET OFF con una sola arista) — inventario N/M por relación como insumo de diseño.
- [ ] **REL-02**: La ficha del parlamentario agrupa las relaciones en un bloque visible ("Relaciones con otros parlamentarios": mismo partido, misma zona, mismas comisiones, co-autoría) — conteo honesto total_n, orden alfabético anti-ranking, leyenda factual.
- [ ] **REL-03**: Página de comparación 1-a-1 (`/comparar`) entre dos parlamentarios con ejes factuales no-voto: partido/militancia histórica, comisiones compartidas, co-autoría, zona — cada dato con fuente+fecha.
- [ ] **REL-04**: Relaciones nuevas derivadas de datos existentes: militancia histórica compartida y lobby con la misma contraparte (si el dato lo sostiene) — cada una con framing factual y cobertura declarada.
- [ ] **REL-05**: Coalición/pacto evaluada empíricamente (Servel pactos electorales / comités Senado como fuentes candidatas): si hay fuente factual viable, se ingiere por dos-etapas; si no, DIFERIDA documentada — jamás inferida desde votos.

### VSIM — Similitud de votación (dato listo, gate legal)

- [ ] **VSIM-01**: Métrica factual pairwise "coinciden en N de M votaciones compartidas" (denominador honesto: solo votaciones sustantivas donde ambos votaron) con caveat de base-alta OBLIGATORIO ("la coincidencia alta es la norma, no una señal") — nunca score/ranking/eje ideológico/mapa (anti-modelo DW-NOMINATE).
- [ ] **VSIM-02**: La similitud se muestra en `/comparar` detrás de flag deny-by-default (`VSIM_PUBLIC_ENABLED` o equivalente) — el flip requiere sign-off legal humano (dossier, clase MONEY/NET); el agente jamás flipea.
- [ ] **VSIM-03**: Linter anti-insinuación extendido ANTES del copy: idioms de similitud vetados ("votan juntos", "aliados", "más afín", "tasa de coincidencia" como ranking) + leyenda en NEGACIONES_LOCKED + mutation self-check; `co_votacion` JAMÁS entra a /red.

### NOTIF — Notificaciones por suscripción (primer dato de usuario)

- [ ] **NOTIF-01**: Un usuario autenticado (Supabase Auth, magic-link/OTP) puede suscribirse y des-suscribirse a un proyecto de ley o a un parlamentario; sus suscripciones viven en tablas user-owned con RLS real (`to authenticated`, `auth.uid()=user_id`), deny-by-default, aisladas del plano service_role.
- [ ] **NOTIF-02**: El lockdown-guard se extiende al rol `authenticated` (allowlist de tablas-de-usuario + mutation self-check) como PRIMER commit de la fase — el agujero detectado en research no llega a PROD.
- [ ] **NOTIF-03**: Un digest diario por email (Resend; free tier 100/día declarado como techo) agrupa las novedades de las suscripciones del usuario (cursor idempotente, cola en tabla drenada por cron GH Actions — patrón EGRESO nuevo, documentado); jamás instantáneo (promesa falsa bajo crons).
- [ ] **NOTIF-04**: Doble opt-in, unsubscribe por token opaco en footer (sin login), preference center mínimo, registro de consentimiento (fecha/versión/método); email de usuario = PII propia: nunca a LLM, logs de CI, ni R2.
- [ ] **NOTIF-05**: Checkpoint legal humano 21.719 ANTES de exponer la captura de emails al público (DPA del proveedor = gate de operador); sin respuesta → feature queda detrás de flag OFF con handoff documentado, la corrida cierra igual.

### E2E — Verificación final (pedido del operador)

- [ ] **E2E-01**: Fase final "todo funciona": inventario de CADA superficie nueva × dato real × BrowserOS sobre el deploy (panel con señales vivas, relaciones con conteos honestos verificados contra SQL, comparador con caveat visible, flags OFF ausentes del DOM, linter verde con vocabulario nuevo, suite completa + guards verdes).

## Future Requirements (deferred)

- Web push / Service Worker (VAPID) — email cubre el caso; CSP enforced complica; post-v10.
- Suscripción por keyword/comisión (granularidad GovTrack completa) — tras validar bill/legislator.
- Resúmenes LLM de novedades en el digest — anti-feature hoy (fabricaciones vs trazabilidad).
- Coalición si REL-05 concluye no-viable — queda con ruta de ingesta documentada.

## Out of Scope

- **Señales de intención/timing como módulo destacado** ("presentado a último momento", "de madrugada", "zombie revivido" como listas de sospechosos) — fecha neutra en ficha OK; módulo editorial = máquina de sospechas (riesgo existencial #2).
- **Score/eje/mapa ideológico de similitud** (DW-NOMINATE-like) — prohibido por F18/anti-insinuación.
- **co_votacion como arista de /red** — explosión de clique (~12k aristas/roll-call) + insinuación espacial.
- **Labels de cluster generados por LLM** — editorializan por construcción.
- **Notificación instantánea/real-time** — los datos llegan por cron; prometer real-time es mentir.
- **Reactivar la anon key legacy** — cualquier acceso cliente usa publishable nueva con RLS o va server-side.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | Phase 97 | Pending |
| SEN-01 | Phase 98 | Pending |
| SEN-06 | Phase 98 | Pending |
| SEN-02 | Phase 99 | Pending |
| SEN-03 | Phase 99 | Pending |
| SEN-04 | Phase 99 | Pending |
| SEN-05 | Phase 99 | Pending |
| PANEL-01 | Phase 100 | Pending |
| PANEL-02 | Phase 100 | Pending |
| PANEL-03 | Phase 100 | Pending |
| PANEL-04 | Phase 100 | Pending |
| REL-01 | Phase 101 | Pending |
| REL-02 | Phase 101 | Pending |
| REL-03 | Phase 101 | Pending |
| REL-04 | Phase 101 | Pending |
| REL-05 | Phase 101 | Pending |
| VSIM-01 | Phase 102 | Pending |
| VSIM-02 | Phase 102 | Pending |
| VSIM-03 | Phase 102 | Pending |
| NOTIF-01 | Phase 103 | Pending |
| NOTIF-02 | Phase 103 | Pending |
| NOTIF-03 | Phase 103 | Pending |
| NOTIF-04 | Phase 103 | Pending |
| NOTIF-05 | Phase 103 | Pending |
| E2E-01 | Phase 104 | Pending |

*Filled by roadmap: 25 requirements total (AUTH 1, SEN 6, PANEL 4, REL 5, VSIM 3, NOTIF 5, E2E 1) — mapeados 25/25 a Phases 97-104, 0 huérfanos, 0 duplicados. Nota: el brief citó "24"; la enumeración real del bloque SEN es de 6 (SEN-01..06), total 25.*
