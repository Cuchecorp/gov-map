# Requirements: Observatorio del Congreso 360

**Defined:** 2026-06-17
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

> Milestone 1 = frente "proyectos" completo + fundaciones de identidad. El frente "parlamentarios 360" (P3–P6) está en v2 Requirements.

## v1 Requirements

Requisitos del milestone 1. Cada uno mapea a una fase del roadmap.

### Fundaciones e Infraestructura (FND)

- [ ] **FND-01**: El sistema ingesta datos mediante un framework de conector aislado por fuente que aplica rate-limit de 2–3s, User-Agent identificatorio y respeto de robots.txt
- [ ] **FND-02**: El sistema guarda todo el dato crudo (XML/JSON/HTML) en object storage (Cloudflare R2), inmutable y append-only, sin meterlo en Postgres
- [ ] **FND-03**: Cada respuesta de fuente queda cacheada (caché diaria) y versionada como snapshot, para re-procesamiento sin re-scrapear
- [ ] **FND-04**: El sistema detecta cambios de esquema (drift) en una fuente y los registra en lugar de fallar en silencio
- [ ] **FND-05**: La ingesta pesada corre dirigida por cola (pgmq) y chunking vía pg_cron + Edge Functions, con backoff exponencial ante 429
- [ ] **FND-06**: Todo acceso LLM pasa por una interfaz enchufable `LLMProvider` con salida estructurada validada por-proveedor (zod), seleccionable por configuración
- [ ] **FND-07**: Todo embedding pasa por una interfaz `EmbeddingProvider` que fija y versiona modelo/dimensiones en los metadatos del vector
- [ ] **FND-08**: Cada dato normalizado conserva trazabilidad a su fuente (origen, fecha de captura, enlace original) capturada en el momento de ingesta

### Identidad de Parlamentarios (ID)

- [ ] **ID-01**: El sistema mantiene una tabla maestra `Parlamentario` sembrada desde la Cámara y el Senado (`senadores_vigentes.php`, con PARLID)
- [ ] **ID-02**: El sistema reconcilia un registro foráneo por match determinista (RUT exacto, o nombre normalizado dentro de cámara+periodo sin homónimo) sin invocar LLM
- [ ] **ID-03**: Para matches dudosos, el sistema genera candidatos por blocking (apellido + cámara + periodo + región) y los adjudica con LLM (MiniMax) devolviendo decisión/confianza/evidencia/conflictos en JSON validado
- [ ] **ID-04**: Una compuerta de validación enruta a revisión humana todo match con confianza < umbral, con conflictos, o inconsistencia de cámara/periodo — nada bajo el umbral se auto-acepta
- [ ] **ID-05**: Un revisor humano puede confirmar/rechazar/corregir un match, registrándose con revisor y timestamp
- [ ] **ID-06**: Cada vínculo nombre→id tiene estado `confirmado`/`probable`/`no_confirmado`, y solo `confirmado` se muestra como hecho en la capa pública
- [ ] **ID-07**: El sistema corre un golden set de casos difíciles (homónimos, nombres de casada, abreviaturas) y bloquea el deploy si la precisión baja del umbral
- [ ] **ID-08**: Cada match guarda procedencia (método determinista/llm/humano, confianza, timestamp, versión de modelo) para auditoría
- [ ] **ID-09**: La tabla maestra de identidades se respalda fuera de Supabase

### Tramitación de Proyectos — P2 (TRAM)

- [ ] **TRAM-01**: El sistema ingesta votaciones y sesiones de la Cámara vía el WS JSON `doGet.asmx`
- [ ] **TRAM-02**: El sistema ingesta tramitación y votaciones del Senado vía `wspublico` (`tramitacion.php`/`votaciones.php`), parseando el XML
- [ ] **TRAM-03**: El sistema modela `Proyecto` con clave de boletín y `Votacion`, normalizando ambas cámaras a un modelo común
- [ ] **TRAM-04**: Un usuario puede ver la ficha de un proyecto con su estado/etapa actual de tramitación
- [ ] **TRAM-05**: Un usuario puede ver el timeline de tramitación de un proyecto cruzando ambas cámaras por número de boletín
- [ ] **TRAM-06**: Un usuario puede ver los resultados de votación (totales SI/NO/Abstención y resultado) asociados a un proyecto
- [ ] **TRAM-07**: El sistema ingesta y muestra las citaciones de comisiones de la Cámara (`citaciones_semana.aspx`) y del Senado (portal Next.js, con autodetección de `buildId`)
- [ ] **TRAM-08**: Un usuario puede ver la tabla semanal de sala (orden del día)
- [ ] **TRAM-09**: Cada ficha y dato de tramitación muestra un indicador de frescura por fuente y enlace a la fuente original

### Búsqueda Semántica y Fichas — P1 (SEM)

- [ ] **SEM-01**: El sistema descarga el texto íntegro de mensajes y mociones (links del XML del Senado y BCN `obtxml`)
- [ ] **SEM-02**: El sistema extrae idea matriz y cuerpos legales afectados de cada proyecto mediante parsing + LLM (DeepSeek con prompt-cache)
- [ ] **SEM-03**: El sistema genera embeddings (Gemini, 768-dim) de las fichas e indexa en pgvector con índice HNSW
- [ ] **SEM-04**: Un usuario puede buscar proyectos en lenguaje natural y recibir fichas estructuradas con trazabilidad a la fuente
- [ ] **SEM-05**: Un usuario puede ver "proyectos similares" a uno dado, por vecindad semántica (kNN)
- [ ] **SEM-06**: Cada ficha unifica boletín, título, iniciativa, autores, cámara de origen, materia, idea matriz, cuerpos legales, estado y enlace a fuente

## v2 Requirements

Diferidos a milestones siguientes. Reconocidos, no en el roadmap actual.

### P3 — Cómo vota el Congreso

- **VOTE-01**: Voto individual por parlamentario (Cámara vía `opendata.camara.cl` — requiere validar endpoint; Senado vía `votaciones.php`)
- **VOTE-02**: Tabla puente `Voto` poblada en ambas cámaras
- **VOTE-03**: Visualizaciones: matrices de cohesión, alineamiento partido vs voto, rankings por materia

### P4 — Consultas + alertas integradas

- **INT-01**: Conector Ley Lobby (audiencias) e InfoProbidad (declaraciones de patrimonio/intereses)
- **INT-02**: Motor de consultas cruzadas (proyecto/voto/lobby/patrimonio)
- **INT-03**: Alertas por suscripción (parlamentario/materia/boletín/gestor), que describen el hecho con fecha y fuente, sin insinuar motivo

### P5 — Dimensión dinero

- **MONEY-01**: Contratos del Estado (ChileCompra, llave RUT proveedor)
- **MONEY-02**: Financiamiento de campaña (SERVEL, conector artesanal por proceso electoral)

### P6 — Observatorio de redes

- **NET-01**: Productos de grafo (redes de influencia, bloques de votación, "sigue la plata") vía recursive CTEs en Postgres (Apache AGE no disponible en Supabase managed)

## Out of Scope

Excluidos explícitamente. Documentados para evitar scope creep.

| Feature | Reason |
|---------|--------|
| Conclusiones de causalidad o intención | Regla rectora: el sistema nunca afirma motivo; solo correlaciones con contexto temporal y fuente |
| Rankings de "culpabilidad" / scorecards morales | Anti-feature: convierte transparencia en máquina de sospechas |
| Exposición pública de RUT y datos de familiares | Minimización por diseño; uso interno solo para reconciliar identidad |
| Salidas de LLM presentadas como hechos sin verificación | El LLM extrae/sugiere, no decide; identidad pasa por umbral y revisión humana |
| Fuzzy-match automático de identidad sin umbral ni revisión | Riesgo existencial #1: produce afirmaciones falsas creíbles |
| Apache AGE / triplestore en M1 | No disponible en Supabase managed; grafo diferido a P6 con CTEs |
| Llamadas a fuentes externas desde el navegador | WAF + CORS: toda ingesta corre en backend |

## Traceability

Poblada durante la creación del roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01..08 | TBD | Pending |
| ID-01..09 | TBD | Pending |
| TRAM-01..09 | TBD | Pending |
| SEM-01..06 | TBD | Pending |

**Coverage:**
- v1 requirements: 32 total (FND 8, ID 9, TRAM 9, SEM 6)
- Mapped to phases: 0 (roadmap pendiente)
- Unmapped: 32 ⚠️ (se resuelve al crear el roadmap)

---
*Requirements defined: 2026-06-17*
*Last updated: 2026-06-17 after initial definition*
