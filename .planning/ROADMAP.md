# Roadmap: Observatorio del Congreso 360

**Created:** 2026-06-17
**Mode:** mvp (Vertical MVP — cada fase usuario-visible entrega valor ciudadano end-to-end)
**Granularity:** fine
**Milestone:** M1 — frente "proyectos" completo + fundaciones de identidad

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

## Coverage

- v1 requirements: 32 (FND 8, ID 9, TRAM 9, SEM 6)
- Mapped to phases: 32/32 ✓
- Orphaned: 0

## Phases

- [ ] **Phase 1: Framework de Conectores + Almacenamiento + Orquestación** - Ingesta respetuosa con crudo inmutable en R2, snapshots, drift y cola pgmq/pg_cron
- [ ] **Phase 2: Capa de Providers LLM/Embeddings** - Interfaces enchufables con salida estructurada per-proveedor y versionado de vectores
- [ ] **Phase 3: Tabla Maestra Parlamentario + Identidad Determinista** - Maestra sembrada (Cámara + Senado), match determinista y respaldo externo
- [ ] **Phase 4: Adjudicación de Identidad + Compuerta Humana + Golden Set** - Subsistema crítico aislado: LLM MiniMax, umbral, revisión humana, auditoría, gate de deploy
- [ ] **Phase 5: Tramitación Core — Ficha + Timeline + Votaciones** - Conectores JSON/XML, modelo Proyecto/Votacion, ficha + timeline cross-cámara + frescura (primer valor ciudadano visible)
- [ ] **Phase 6: Citaciones + Tabla Semanal de Sala** - Conectores frágiles (WebForms __VIEWSTATE + Next.js __NEXT_DATA__) con agenda de comisiones y sala
- [ ] **Phase 7: Búsqueda Semántica + Fichas Estructuradas** - Extracción LLM, embeddings Gemini + HNSW, búsqueda NL y "proyectos similares"

## Phase Details

### Phase 1: Framework de Conectores + Almacenamiento + Orquestación
**Goal:** El sistema puede ingestar cualquier fuente gubernamental de forma respetuosa, guardar el crudo inmutable con procedencia, detectar drift y orquestar trabajo pesado por cola — la base que todo conector posterior hereda sin reescribir política.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** FND-01, FND-02, FND-03, FND-04, FND-05, FND-08
**Success Criteria** (what must be TRUE):
  1. Un backfill completo respeta 2–3s entre requests con User-Agent identificatorio y robots.txt — no aparece ningún 403/429 por ráfaga (sella riesgo WAF)
  2. Todo crudo (XML/JSON/HTML) queda en Cloudflare R2 append-only con hash; Postgres guarda solo la referencia (`r2_path`, `hash`) más `source_snapshot`/`ingest_run`, nunca el crudo
  3. Una misma fuente cacheada en el día no se re-pide; un snapshot versionado permite re-procesar sin re-scrapear
  4. Un cambio de esquema en una fuente dispara una alerta de drift en lugar de corromper en silencio
  5. La ingesta pesada corre dirigida por pgmq + pg_cron con chunking y backoff exponencial ante 429, y cada dato normalizado conserva su procedencia (origen, fecha de captura, enlace) capturada al ingestar
**Plans:** 3 plans (3 waves)
Plans:
- [ ] 01-01-PLAN.md — Scaffold monorepo pnpm + tooling de test + @obs/core (Provenance + tipos de control) + migraciones de extensiones y tablas de control (FND-02, FND-08)
- [ ] 01-02-PLAN.md — Framework @obs/ingest: rate-limit/robots/fetcher, R2 content-addressed, cache diaria, drift, snapshot + DummyConnector E2E (FND-01, FND-02, FND-03, FND-04, FND-08)
- [ ] 01-03-PLAN.md — Orquestación pgmq + pg_cron + pg_net + Edge Function ingest-worker + escape hatch CI + checkpoint R2 real (FND-05)

### Phase 2: Capa de Providers LLM/Embeddings
**Goal:** Todo cómputo LLM y de embeddings pasa por interfaces enchufables que aíslan el modelo concreto, garantizan salida estructurada validada per-proveedor y versionan cada vector — el dominio nunca conoce qué modelo corre.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** FND-06, FND-07
**Success Criteria** (what must be TRUE):
  1. Todo acceso LLM pasa por `LLMProvider` con router por criticidad/sensibilidad; MiniMax usa tool calling y DeepSeek usa json_object, ambos validados con zod (sella el hallazgo "MiniMax sin response_format universal")
  2. Cambiar de modelo es un adaptador nuevo con cero cambios aguas arriba, seleccionable por configuración
  3. Todo embedding pasa por `EmbeddingProvider` que fija y persiste `embedding_model`/`embedding_dims`/`embedding_version` junto al vector — no existe vector anónimo
  4. La política "qué dato va a qué proveedor/tier" queda documentada: ningún dato personal (RUT/nombres) puede dirigirse a un tier que entrena con inputs
**Plans:** TBD

### Phase 3: Tabla Maestra Parlamentario + Identidad Determinista
**Goal:** Existe una tabla maestra `Parlamentario` sembrada con revisión humana desde Cámara y Senado, respaldada fuera de Supabase, con reconciliación determinista que resuelve los matches no ambiguos sin invocar LLM — el cimiento sobre el que se atribuye cualquier dato a una persona.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** ID-01, ID-02, ID-09
**Success Criteria** (what must be TRUE):
  1. La maestra `Parlamentario` está sembrada desde Cámara y Senado (`senadores_vigentes.php`, con PARLID) con identidades confirmadas por revisión humana, no auto-generadas
  2. El sistema reconcilia un registro foráneo por match determinista (RUT exacto, o nombre normalizado dentro de cámara+periodo sin homónimo) sin invocar LLM
  3. La tabla maestra de identidades tiene un job de respaldo periódico fuera de Supabase (R2/git/otro) — el activo más caro de reconstruir nunca depende solo del free tier
**Plans:** TBD

### Phase 4: Adjudicación de Identidad + Compuerta Humana + Golden Set
**Goal:** El subsistema de identidad aislado resuelve los casos ambiguos con LLM crítico, escala lo dudoso a revisión humana bajo umbral conservador, audita cada decisión y bloquea el deploy si el golden set baja del umbral — sella el riesgo existencial #1 antes de que cualquier dato con identidad llegue a público.
**Mode:** mvp
**Depends on:** Phase 2, Phase 3
**Requirements:** ID-03, ID-04, ID-05, ID-06, ID-07, ID-08
**Success Criteria** (what must be TRUE):
  1. Para matches dudosos el sistema genera candidatos por blocking (apellido + cámara + periodo + región) y los adjudica con LLM (MiniMax) devolviendo decisión/confianza/evidencia/conflictos en JSON validado
  2. Una compuerta enruta a revisión humana todo match con confianza < umbral, con conflictos o inconsistencia de cámara/periodo — nada bajo el umbral se auto-acepta (preferencia asimétrica por falso negativo)
  3. Un revisor humano puede confirmar/rechazar/corregir un match, registrándose con revisor y timestamp; cada match guarda procedencia (método, confianza, timestamp, versión de modelo) en audit log inmutable
  4. Cada vínculo nombre→id tiene estado `confirmado`/`probable`/`no_confirmado` y solo `confirmado` se muestra como hecho en la capa pública
  5. El golden set de casos difíciles (homónimos, nombres de casada, abreviaturas) corre como test de regresión y bloquea el deploy si la precisión baja del umbral (sella riesgo existencial #1)
**Plans:** TBD

### Phase 5: Tramitación Core — Ficha + Timeline + Votaciones
**Goal:** Un ciudadano puede ver la ficha de cualquier proyecto de ley con su estado actual, el timeline de tramitación cruzando ambas cámaras por boletín y los resultados de votación, cada dato con indicador de frescura y enlace a la fuente — el primer valor ciudadano end-to-end visible.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** TRAM-01, TRAM-02, TRAM-03, TRAM-04, TRAM-05, TRAM-06, TRAM-09
**Success Criteria** (what must be TRUE):
  1. El sistema ingesta votaciones/sesiones de la Cámara vía WS JSON `doGet.asmx` y tramitación/votaciones del Senado vía `wspublico` XML (conectores en orden ascendente de fragilidad: JSON → XML)
  2. Existe modelo `Proyecto` con clave de boletín y `Votacion`, normalizando ambas cámaras a un modelo común; los votos atribuidos a parlamentarios pasan por `identity.reconcile()`
  3. Un usuario puede ver la ficha de un proyecto con estado/etapa actual y el timeline de tramitación cruzando ambas cámaras por número de boletín (RPC recursive CTE)
  4. Un usuario puede ver los resultados de votación (totales SI/NO/Abstención y resultado) asociados a un proyecto
  5. Cada ficha y dato de tramitación muestra indicador de frescura por fuente y enlace a la fuente original, con copy en lenguaje neutro (sin framing causal — guardarraíl riesgo existencial #2)
**Plans:** TBD
**UI hint**: yes

### Phase 6: Citaciones + Tabla Semanal de Sala
**Goal:** Un ciudadano puede ver la agenda de comisiones (citaciones) de Cámara y Senado y la tabla semanal de sala, con conectores que sobreviven a los formatos más frágiles (WebForms con `__VIEWSTATE` y portal Next.js con `buildId` dinámico).
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** TRAM-07, TRAM-08
**Success Criteria** (what must be TRUE):
  1. El sistema ingesta y muestra las citaciones de comisiones de la Cámara (`citaciones_semana.aspx`, reenviando `__VIEWSTATE`/`__EVENTVALIDATION` en el POST) y del Senado (portal Next.js `__NEXT_DATA__` con autodetección de `buildId` que sobrevive a un deploy)
  2. Un usuario puede ver la tabla semanal de sala (orden del día) vía `getTablaHTML`/`getSesiones`
  3. Cada cita y entrada de tabla muestra frescura por fuente y enlace a la fuente original, en lenguaje neutro
**Plans:** TBD
**UI hint**: yes

### Phase 7: Búsqueda Semántica + Fichas Estructuradas
**Goal:** Un ciudadano puede buscar proyectos de ley en lenguaje natural por idea matriz o cuerpos legales y descubrir "proyectos similares", recibiendo fichas estructuradas con plena trazabilidad a la fuente.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** SEM-01, SEM-02, SEM-03, SEM-04, SEM-05, SEM-06
**Success Criteria** (what must be TRUE):
  1. El sistema descarga el texto íntegro de mensajes y mociones (links del XML del Senado y BCN `obtxml`) hacia R2
  2. El sistema extrae idea matriz y cuerpos legales afectados mediante parsing + LLM (DeepSeek con prompt-cache), con prompt restrictivo que no interpreta ni conecta hechos (guardarraíl riesgo existencial #2)
  3. El sistema genera embeddings (Gemini, 768-dim) e indexa en pgvector con índice HNSW, con plan de re-embedding idempotente y reanudable; cada vector versionado
  4. Un usuario puede buscar proyectos en lenguaje natural y recibir fichas estructuradas con trazabilidad, y ver "proyectos similares" por vecindad semántica (kNN)
  5. Cada ficha unifica boletín, título, iniciativa, autores, cámara de origen, materia, idea matriz, cuerpos legales, estado y enlace a fuente
**Plans:** TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Framework de Conectores + Almacenamiento + Orquestación | 0/3 | Planned | - |
| 2. Capa de Providers LLM/Embeddings | 0/? | Not started | - |
| 3. Tabla Maestra Parlamentario + Identidad Determinista | 0/? | Not started | - |
| 4. Adjudicación de Identidad + Compuerta Humana + Golden Set | 0/? | Not started | - |
| 5. Tramitación Core — Ficha + Timeline + Votaciones | 0/? | Not started | - |
| 6. Citaciones + Tabla Semanal de Sala | 0/? | Not started | - |
| 7. Búsqueda Semántica + Fichas Estructuradas | 0/? | Not started | - |

## Dependency Notes

- **Fundaciones (1, 2) antes que todo:** los riesgos existenciales y el WAF se sellan antes de que exista cualquier dato público.
- **Identidad (3, 4) antes de Tramitación (5):** `Voto.parlamentario_id` solo lo escribe el subsistema de identidad; sin maestra sembrada no hay a qué atribuir. La rama determinista (P3) ya desbloquea P5; la adjudicación LLM + gate (P4) debe existir antes de mostrar cualquier dato con identidad en público.
- **Tramitación (5) antes de Búsqueda Semántica (7):** la búsqueda embeddea textos *de proyectos*; sin proyectos cargados no hay corpus.
- **Conectores en orden de fragilidad ascendente:** JSON/XML (P5) validan el framework antes de los frágiles WebForms/Next.js (P6).
- **Phase 6 y 7 dependen ambas de Phase 5** y son paralelizables entre sí (distinto valor ciudadano: agenda vs. búsqueda).

## Out of Scope (v2 — no en este milestone)

- **P3 voto individual por diputado** — bloqueado por `opendata.camara.cl` sin validar (requiere spike antes de M2)
- **P4 lobby + patrimonio / alertas** — requiere política de datos LLM y auth completa
- **P5 dimensión dinero (SERVEL + ChileCompra)** — conector artesanal frágil
- **P6 grafo de influencia** — Apache AGE no disponible en Supabase managed; recursive CTEs en M1, decisión de plataforma diferida

---
*Roadmap created: 2026-06-17*
