# Requirements: Observatorio del Congreso 360 — v9.0

**Defined:** 2026-07-21
**Milestone:** v9.0 — Robustez de productos estrella + seguridad final
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente".
**Estructura:** TRES PASADAS autónomas con `/clear` entre ellas — P1 búsqueda/PL (RETR/RANK/FILT/TRACE), P2 personas/agenda (BIO/LOB/CIT), P3 seguridad (SEC).
**Ciclo por producto (LOCKED):** diseño → prueba empírica BrowserOS → rediseño → validación empírica + de seguridad.

## v9.0 Requirements

### RETR — Retrieval de proyectos de ley (producto estrella)

- [x] **RETR-01**: El ciudadano que escribe un número de boletín en cualquier formato (`14309-04`, `14309`, `14.309-04`) SIEMPRE encuentra el proyecto, como resultado #1 — short-circuit determinista fuera del RRF
- [x] **RETR-02**: El ciudadano que escribe un fragmento LITERAL del título/nombre del PL SIEMPRE lo encuentra — FTS `spanish` + unaccent sobre título/materia (hoy la búsqueda es solo-semántica y falla; ese es EL bug)
- [x] **RETR-03**: La estrategia híbrida keyword ∪ semántica (RRF, patrón oficial Supabase) se elige por SPIKE EMPÍRICO con golden set congelado ANTES de escribir schema (≥30 queries: título literal, paráfrasis NL, normas, todos los formatos de boletín, ñ/acentos/topónimos)
- [x] **RETR-04**: El golden set queda como test de regresión permanente en CI; la búsqueda NL/semántica y "proyectos similares" NO regresionan (RPC vieja tras flag hasta que la nueva domine)
- [x] **RETR-05**: La búsqueda por idea matriz y por normas/cuerpos legales afectados en lenguaje natural opera con pesos declarados (A título / B idea matriz / C normas)

### RANK — Ranking explicable

- [x] **RANK-01**: Los mensajes (Ejecutivo) se priorizan sobre las mociones y lo reciente sobre lo antiguo, por reglas explicables y declaradas — nunca ML opaco ni score de parlamentarios

### FILT — Filtros client-side

- [x] **FILT-01**: Filtros que reordenan/filtran los resultados YA obtenidos sin re-buscar: año, mensaje/moción, estado (archivado/en tramitación), cámara de origen, partido de autores (cuando BIO-03 esté poblado)
- [x] **FILT-02**: Chips con counts honestos ("de estos N resultados", nunca presentados como globales), facetas vacías deshabilitadas, NULLs explícitos como bucket "sin dato"
- [x] **FILT-03**: Normalizador de estado de tramitación (texto libre → buckets enum) definido, testeado y reusable

### TRACE — Trazabilidad al punto oficial

- [x] **TRACE-01**: Cada ficha de boletín lleva deep-link a la página oficial PRECISA para validar el dato: Senado (`?boletin_ini=` con boletín completo), Cámara (`prmID` + `prmBOLETIN` — requiere persistir `prmID` en ingesta), BCN (`idNorma`)
- [ ] **TRACE-02**: Los deep-links se validan EMPÍRICAMENTE (HTTP 200 + content-match, gate BrowserOS); nunca rutas con buildId ni URLs de sesión
- [ ] **TRACE-03**: Fecha de captura visible junto al link + acceso al snapshot R2 correspondiente ("esto decía la fuente ese día") como respaldo de verificación

### BIO — Parlamentario 360 (bio oficial cruzada)

- [ ] **BIO-01**: Conector de biografía oficial dos-etapas (fuente→R2→Supabase): WSCamaraDiputados `getDiputados` (XML GET) para diputados + fuente Senado/BCN para senadores (SPIKE SPARQL BCN); la PII de TERCEROS/familiares queda en R2, jamás en tablas servidas
- [ ] **BIO-02**: La ficha muestra la biografía oficial del Congreso: región/distrito, períodos, profesión, comisiones, y demás campos de la bio oficial — con fuente+fecha+enlace
- [ ] **BIO-03**: El partido político se muestra DIRECTO y se correlaciona en todas las superficies (ficha, filtros, cruces) — decisión del operador 2026-07-21: la militancia del cargo electo y su bio oficial son datos públicos esenciales para accountability; siempre con fuente+fecha ("según fuente al [fecha]"), distinguiendo partido vs comité (Senado) y militancia histórica vs actual
- [ ] **BIO-04**: Cross-links factuales entre parlamentarios: mismo partido, misma región/distrito, misma comisión, co-autoría — relaciones DECLARADAS u observables, jamás afinidad inferida (anti-insinuación LOCKED)
- [ ] **BIO-05**: Membresía de comisiones ingerida y modelada (hoy NO existe) — prerequisito de BIO-02/BIO-04 y de CIT-04

### LOB — Lobby legible y enlazado

- [ ] **LOB-01**: El título/materia COMPLETO de cada audiencia de lobby es visible y legible en la ficha del parlamentario (el dato ya está entero en DB — la falla es presentacional)
- [ ] **LOB-02**: Audiencia→PL enlazada SOLO por mención explícita de boletín en la materia (fail-closed, reusa `lobby_en_tramitacion`), con leyenda anti-causal — nunca regex de keywords ni "coincidencia temática" afirmada
- [ ] **LOB-03**: Navegación bidireccional fácil para ciudadano/periodista: audiencia → ficha del PL en movimiento → parlamentario, con links específicos

### CIT — Citaciones completas (sala + comisiones, ambas cámaras)

- [ ] **CIT-01**: AUDITORÍA de cobertura ANTES de tocar UI: qué se scrapea hoy vs qué publica cada fuente (sala+comisiones × Cámara+Senado), con N/M declarado — hallazgos previos a confirmar: Senado comisiones forward-only, Cámara sala thin (PDF→DeepSeek)
- [ ] **CIT-02**: Scraping/backfill de lo faltante por dos-etapas y rate-limit LOCKED — endpoints candidatos verificados: Senado PHP `?mo=comisiones&ac=citacionesComision` (sin buildId), Cámara `citaciones_semana.aspx?prmSemana=` + `getComisiones_Vigentes`; probar con curl primero (WAF)
- [ ] **CIT-03**: /agenda estructurada POR DÍA (tz America/Santiago), distinguiendo sala vs comisiones y Cámara vs Senado, fácil de navegar
- [ ] **CIT-04**: Filtros para periodistas/ciudadanos: cámara, comisión, rango de fechas, boletín mencionado, vista "esta semana"
- [ ] **CIT-05**: Sesiones canceladas/reagendadas modeladas honestamente — nunca mostradas como vigentes; cobertura parcial declarada, nunca calendario parcial presentado como completo

### SEC — Seguridad final (repo público, sujetos hostiles)

- [ ] **SEC-01**: Todos los guards existentes (lockdown/allowlist, PII, anti-insinuación, pgTAP) extendidos sobre las RPCs y superficies NUEVAS de P1/P2; toda RPC nueva acotada (LIMIT, `statement_timeout`, caps de `match_count`) contra DoS
- [ ] **SEC-02**: Audit final del sitio/repo público: scan de secretos sobre TODO el historial git, `.env.example` sin valores reales, mensajes de error genéricos, headers de seguridad verificados, CSP Report-Only → enforced
- [ ] **SEC-03**: Audit final de Supabase: Splinter + revisión de grants/RLS sobre la DB VIVA (no solo migraciones), re-derivación del RPC allowlist incluyendo lo nuevo, pgvector ≥0.8.2 confirmado, `pnpm audit` limpio
- [ ] **SEC-04**: Rotación del DB password (B26, arrastrada de v7) — checkpoint de operador documentado; el agente no rota

## Future Requirements (deferred)

- Filtro por tema/materia normalizada (taxonomía de temas) — v9.x/v10
- Alertas/seguimiento por boletín (watchlist) — v10
- Notificaciones pre-votación — v10
- Grafo de influencia P6 ampliado — cuando el modelo esté poblado

## Out of Scope

| Item | Reason |
|------|--------|
| "Voting summaries" valorativos estilo TheyWorkForYou ("votó fuertemente a favor de X") | Anti-insinuación LOCKED — es exactamente la máquina de sospechas |
| Score/ranking de parlamentarios; "con quién se alía" por co-voto/co-lobby | Afinidad inferida prohibida; solo relaciones declaradas/observables |
| Enlace audiencia→PL por keywords/tema | Falso vínculo = afirmación de influencia falsa; solo boletín explícito (LOB-02) |
| Predicción de aprobación de proyectos | Especulación, fuera del principio "qué pasó, cuándo, según qué fuente" |
| Re-arquitectura de búsqueda con servicios externos (Elastic, Algolia, Typesense) | El híbrido nativo Postgres (RRF) resuelve el problema sin infra nueva |
| RUT/PII de terceros y familiares en superficies públicas | Minimización LOCKED — sigue siendo interno; la apertura de BIO-03 aplica SOLO a datos oficiales del cargo electo |

## Traceability

Cobertura 100 por ciento: 27/27 requisitos mapeados a fases 86-96 (sin huérfanos, sin duplicados).

| Requirement | Phase | Status |
|-------------|-------|--------|
| RETR-01 | Phase 87 | Complete |
| RETR-02 | Phase 87 | Complete |
| RETR-03 | Phase 86 | Complete |
| RETR-04 | Phase 86 | Complete |
| RETR-05 | Phase 87 | Complete |
| RANK-01 | Phase 88 | Complete |
| FILT-01 | Phase 88 | Complete |
| FILT-02 | Phase 88 | Complete |
| FILT-03 | Phase 88 | Complete |
| TRACE-01 | Phase 89 | Complete |
| TRACE-02 | Phase 89 | Pending |
| TRACE-03 | Phase 89 | Pending |
| BIO-01 | Phase 90 | Pending |
| BIO-02 | Phase 91 | Pending |
| BIO-03 | Phase 91 | Pending |
| BIO-04 | Phase 91 | Pending |
| BIO-05 | Phase 90 | Pending |
| LOB-01 | Phase 92 | Pending |
| LOB-02 | Phase 92 | Pending |
| LOB-03 | Phase 92 | Pending |
| CIT-01 | Phase 93 | Pending |
| CIT-02 | Phase 94 | Pending |
| CIT-03 | Phase 94 | Pending |
| CIT-04 | Phase 94 | Pending |
| CIT-05 | Phase 94 | Pending |
| SEC-01 | Phase 95 | Pending |
| SEC-02 | Phase 96 | Pending |
| SEC-03 | Phase 96 | Pending |
| SEC-04 | Phase 96 | Pending |

---
*Requirements defined: 2026-07-21*
*Decisión clave del operador (2026-07-21): partido político y bio oficial del cargo electo se muestran DIRECTO y se correlacionan — dato público esencial para accountability. La minimización (Ley 21.719) sigue plena para terceros/familiares/RUT.*
