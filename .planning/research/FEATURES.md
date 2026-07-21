# Feature Research

**Domain:** Legislative-transparency web platform (civic tech) — Chile Congress; ciudadanos + prensa
**Researched:** 2026-07-21
**Confidence:** HIGH (comparables directos: Congress.gov, GovTrack, OpenStates, TheyWorkForYou, OpenParliament.ca, InfoLobby.cl, Vota Inteligente)

> Scope: v9.0 "robustez de productos estrella" — retrieval de PL, ranking+filtros client-side, deep-link de validación, ficha de parlamentario con bio oficial cruzada, lobby legible, citaciones completas. Todo lo de abajo respeta **anti-insinuación LOCKED** (nunca causalidad/intención, nunca score de afinidad política) y el principio rector **fuente+fecha+enlace**. Complejidad y dependencias sobre superficies YA construidas se anotan por fila.
>
> NOTA: este archivo reemplaza la versión de v7.0 (votos/dinero, 2026-07-13). v9.0 = robustez de los 6 productos de cara al ciudadano.

---

## Área 1 — Búsqueda de proyectos de ley (retrieval)

Comparables clave: **Congress.gov** (exact-match por `cite:`, relevancia + sort por fecha/acción/número/título), **GovTrack** (bill number `HR 123`, comillas para frase exacta), **OpenStates** (full-text + tags), **hybrid search / RRF** (Reciprocal Rank Fusion) como estado del arte para combinar keyword+semántico.

### Table Stakes (usuarios lo asumen)

| Feature | Why Expected | Complexity | Notes / dependencias |
|---------|--------------|------------|-------|
| **Cero-fallo en número de boletín exacto** (`14309-04`, con o sin guion) | Un buscador legislativo que no encuentra el boletín exacto se siente roto. Congress.gov lo garantiza con `cite:` | LOW | Match determinista literal ANTES del vector. Debe surgir #1 siempre. Es la queja HOY (falla con literales). Depende de /buscar existente |
| **Cero-fallo en fragmento LITERAL del título/nombre** | "modifica el Código del Trabajo" debe traer los proyectos cuyo título contiene esa frase, no solo semánticamente parecidos | MEDIUM | Full-text (Postgres FTS `spanish`, ya usado en `buscar_citaciones`) sobre título/nombre. Es el gap explícito del milestone: "HOY falla con palabras LITERALES del título" |
| **Retrieval híbrido: keyword ∪ semántico, fusionados** | Estado del arte 2026 (RRF). Keyword da precisión de término exacto; vector da recall conceptual. Ninguno solo basta | HIGH | Fusionar FTS + pgvector kNN (`match_proyectos` existe) por RRF o unión con reglas. Elegido por SPIKE empírico con golden queries (ya en el plan). Reusa embeddings 768-dim |
| **Búsqueda por lenguaje natural / idea matriz** | Ciudadano no sabe jerga; escribe "proyecto para bajar el precio de los remedios" | LOW (ya existe) | Ya vive vía embeddings asimétricos + idea matriz. Mantener; solo integrarlo al híbrido |
| **Búsqueda por norma/cuerpo legal afectado** | "qué proyectos tocan la Ley 21.719" | MEDIUM | Ya se extraen cuerpos legales; exponerlos como campo buscable |
| **Cobertura declarada honesta** | Prensa exige saber el universo ("busca sobre 3.100 proyectos 2022-2026") | LOW (ya existe) | Banner en /buscar ya presente. Mantener N/M |
| **Suite de golden queries (test) para retrieval** | Regresión: cada release debe pasar consultas obvias (número, título literal, tema) | MEDIUM | Fixtures versionadas; gate en CI. El milestone ya lo pide como criterio de SPIKE |

### Differentiators (ventaja competitiva)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Ranking transparente y explicable** (mensaje Ejecutivo > moción, recencia, cámara de origen) | El usuario ve *por qué* un resultado está arriba, sin caja negra. Encaja con trazabilidad rectora | MEDIUM | Reglas explícitas, no ML opaco. Mensajes del Ejecutivo suelen avanzar más → prior legítimo de relevancia institucional (NO de mérito político) |
| **"Proyectos similares" kNN desde una ficha** | Descubrimiento lateral que Congress.gov no da bien | LOW (ya existe) | Ya construido. Reusar |
| **Idea matriz como snippet de resultado** | Muestra el "qué hace" en una línea, extraído literal (no resumen editorial) | LOW | Ya se extrae; mostrar en el hit |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Ranking "por importancia política" o por polémica** | "mostrar lo relevante" | Implica juicio editorial/afinidad → viola anti-insinuación | Ranking por señales factuales neutras (recencia, tipo de iniciativa, etapa) |
| **Autocompletar que "adivina intención"** | UX moderna | Puede sesgar hacia interpretaciones | Autocompletar solo sobre número/título literal + temas del corpus |
| **Solo-semántico (tirar el keyword)** | "IA moderna" | Falla en número/título exacto (el bug actual) | Híbrido con keyword como piso duro |

---

## Área 2 — Filtros client-side (reordenan/filtran resultados YA obtenidos)

Comparables: OpenStates (state/session/subject/type/chamber/updated), GovTrack advanced (subject, status, sponsor, chamber), Congress.gov (source/collection, sort). Patrón UX dominante: **facet chips + count por faceta + sort dropdown**, aplicados sin re-query cuando el conjunto ya está en cliente.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Filtro por estado de tramitación** (en trámite / archivado / publicado como ley) | El filtro #1 que todos esperan; separa "vivo" de "muerto" | LOW | Client-side sobre resultados. Dato ya en el modelo |
| **Filtro por tipo de iniciativa** (mensaje Ejecutivo / moción parlamentaria) | Distinción legislativa básica en Chile; alto valor para prensa | LOW | Campo ya disponible |
| **Filtro por año / legislatura** | Acotar temporalmente | LOW | Facet estándar |
| **Filtro por cámara de origen** (Cámara / Senado) | Estructura bicameral | LOW | Dato existente |
| **Filtro por etapa/urgencia** | "qué está por votarse" | MEDIUM | Etapa ya en timeline; urgencia puede requerir campo |
| **Chips removibles + "limpiar filtros"** | UX esperada de faceted search | LOW | Patrón chip estándar; el sitio ya usa chips cívicos (v8.1) |
| **Count por faceta** ("En trámite (42)") | Estándar faceted; orienta antes de clickear | LOW | Contar sobre el set ya obtenido |
| **Manejo de faceta vacía** (deshabilitar, no ocultar) | Evita confusión "¿dónde fue el filtro?" | LOW | Deshabilitar chip con count 0 |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Filtro por partido del autor** | Prensa filtra "mociones RN sobre pensiones" — factual, no valorativo | MEDIUM | Requiere autoría poblada (F48 ya LIVE) + partido (ver Área 4). Dependencia dura |
| **Filtro por tema/materia** | Navegación por policy area (como Congress.gov subjects) | MEDIUM | Requiere etiquetado de tema (ya existe sector/tema por LLM en cruces) |
| **Reordenar sin re-query** (recencia ↔ relevancia ↔ nº boletín) | Fluidez; el milestone lo pide explícito | LOW | Sort client-side sobre el array ya en memoria |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Filtro "por polémica / más comentados"** | engagement | Editorializa; anti-insinuación | Filtrar por señales factuales (urgencia, movimiento reciente) |
| **Filtro por "alineamiento" del autor** | análisis rápido | Score de afinidad = anti-feature LOCKED | Solo partido declarado (dato oficial), sin agregación valorativa |
| **Re-query en cada click de filtro** | "simplicidad" | Latencia + carga al backend; contradice "sin re-buscar" del milestone | Filtrado/orden 100% client-side sobre el set traído |

---

## Área 3 — Deep-link de validación a la fuente oficial

Comparables: Congress.gov (link al texto oficial y al status), OpenParliament.ca y TheyWorkForYou (permalink a Hansard por sección), InfoLobby (link a la audiencia registrada). Estándar del dominio: **cada dato lleva "ver en el sitio oficial" al punto más preciso posible**.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Enlace a la página oficial del boletín** (Cámara/Senado según origen) | Es el principio rector del producto; ya existe a nivel dato | LOW | Ya se guarda fuente+fecha+enlace. Consolidar el link "canónico" por boletín |
| **Deep-link al punto preciso** (tramitación específica, no solo home de la fuente) | El milestone lo pide: "a la parte precisa de la página oficial" | MEDIUM | Construir URL profunda por boletín/etapa. Cuidado: portal Senado Next.js con `buildId` volátil (leer `__NEXT_DATA__`, NO hardcodear) |
| **Fecha de captura visible** ("según fuente al DD/MM/AAAA") | Trazabilidad temporal; ya es convención del sitio | LOW | Ya presente vía `fecha_captura` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Enlace al crudo archivado en R2** (snapshot inmutable) | Defensa jurídica: "esto es lo que la fuente decía ese día", aunque la fuente cambie | MEDIUM | R2 content-addressed ya existe (dos-etapas LOCKED). Exponer link al snapshot como respaldo. ALTO valor legal para un repo público |
| **Indicador de frescura por dato** | Prensa sabe si el dato es de hoy o de hace un mes | LOW | `pnpm freshness` ya calcula; superficializar |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Cachear/servir el contenido oficial como propio sin atribución** | velocidad | Riesgo legal + rompe atribución CC BY | Link + snapshot atribuido con fecha |
| **Deep-link con `buildId` hardcodeado (Senado)** | simplicidad | Rompe silenciosamente en cada deploy del portal | Autodetectar `__NEXT_DATA__.buildId` |

---

## Área 4 — Ficha de parlamentario (bio oficial cruzada)

Comparables: TheyWorkForYou (votos recientes + discursos + comités + register of interests), OpenParliament.ca (partido, riding, comités, cross-link debates↔bills), Vota Inteligente (historial de votos, asistencia, comisiones, gastos). Campos bio estándar del dominio: **nacimiento, región/distrito, partido, periodos servidos, profesión, comités**.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Partido político (oficial, declarado)** | Campo #1 esperado; hoy la ficha no lo trae bien | LOW-MEDIUM | Del sitio oficial del Congreso. Dato factual, no valorativo |
| **Bio oficial: región/distrito o circunscripción** | Ubicación de representación, base de "mi parlamentario" | LOW | Del perfil oficial. Ya hay directorio /parlamentarios |
| **Periodos servidos** | Antigüedad/continuidad, factual | LOW | Perfil oficial |
| **Profesión / formación** | Contexto biográfico neutro | LOW | Perfil oficial |
| **Membresías de comisiones** | Todos los comparables lo muestran; clave para prensa | MEDIUM | Puede requerir ingesta nueva (fuente de comisiones). Verificar cobertura antes de UI |
| **Los carriles ya construidos** (votos, lobby, patrimonio, cruces, autoría) | Ya son el diferenciador; la bio los enmarca | — | Ya LIVE (v5.0 acordeones). v9.0 = enriquecer encabezado bio |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cross-links entre parlamentarios** (mismo partido / misma comisión / misma región) | Navegación lateral; el milestone lo pide ("relaciones entre parlamentarios"). Factual, no de afinidad | MEDIUM | Derivar de campos declarados (partido, comité, distrito). Reusa /red pero como cross-link textual, no grafo |
| **Co-autoría de proyectos** (quién co-firma con quién) | Relación factual verificable, muy usada por prensa | MEDIUM | Autoría ya poblada (F48). Co-autoría = firmas compartidas en el mismo boletín. NUNCA presentar como "alianza" |
| **Header bio above-fold + acordeones** | Lectura de 3 capas ya existe (v5.0) | LOW | Extender el resumen preatentivo con bio |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **"Voting summaries" que agrupan votos en una postura política** (estilo TheyWorkForYou "voted strongly for X") | Muy popular en UK | Es exactamente la insinuación LOCKED-prohibida: infiere postura desde votos | Mostrar votos individuales con fuente; NUNCA agregarlos en un juicio |
| **Score/ranking de parlamentarios** (asistencia como "buen/mal diputado") | comparación rápida | Editorializa mérito | Métrica descriptiva vs mediana de cámara, sin juicio (VIZ-COMP ya lo hace bien) |
| **"Con quién se alía"** derivado de co-voto/co-lobby | análisis de redes atractivo | Afinidad inferida = anti-feature existencial #2 | Solo relaciones DECLARADAS (mismo partido/comité), conteos factuales |
| **Foto/datos de familiares** | completar la ficha | Ley 21.719; PII de terceros | Solo lo que la fuente pública ya publica del parlamentario |

---

## Área 5 — Lobby / audiencias legibles

Comparable directo: **InfoLobby.cl** (busca por autoridad o por empresa/lobbista; muestra fecha, asistentes, temas tratados, viajes, regalos). El gap del producto: el "asunto solicitado" hoy no se lee bien y no se enlaza a PLs.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Título/materia completa de la audiencia** (no truncado) | InfoLobby lo muestra; el milestone dice "título completo de lo solicitado" | LOW-MEDIUM | Verificar que el crudo trae la materia completa (auditoría de campo antes de UI) |
| **Asistentes / contraparte legible** | Quién pidió la reunión | LOW | Ya vive en `lobby_contraparte`; identidad de terceros (v4.0) |
| **Fecha + link a la audiencia oficial** | Trazabilidad | LOW | Enlace a leylobby.gob.cl |
| **Búsqueda/navegación por parlamentario** | Patrón InfoLobby | LOW (ya existe) | Ya en la ficha (carril lobby) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Enlace audiencia → PL en movimiento** | El milestone lo pide explícito; NADIE en Chile lo hace bien. Alto valor periodístico | HIGH | Matching materia-audiencia ↔ boletín. Riesgoso: NO afirmar que la reunión "causó" el movimiento del PL. Presentar como "materia mencionada", con fuente, sin causalidad |
| **Materia normalizada/temática** | Agrupar audiencias por tema | MEDIUM | Etiquetado tipo cruces; eval propio |
| **Carril lobby × tramitación** (temporal, descriptivo) | Ya existe (v5.0 CRUCE2) | LOW | Reusar; reforzar leyenda anti-causal |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **"Este lobby influyó en este voto/proyecto"** | narrativa atractiva | Causalidad inventada = riesgo existencial #2 | "Audiencia sobre materia X el DD/MM; el boletín Y trata materia X" — coincidencia factual, leyenda "no implica causa" |
| **Contar audiencias como "score de influencia"** | ranking | Score de correlación prohibido | Conteo factual con fuente, sin agregación valorativa |

---

## Área 6 — Citaciones / calendario legislativo completo

Comparables: House "Bills This Week" / floor.docs.house.gov (por semana, filtrable por comité), Congress.gov floor calendars, GovTrack alerts por comité/tema. Workflow periodista: **"¿qué se discute HOY / esta semana y qué boletines se mueven?"**. El milestone exige **auditoría de cobertura de scraping ANTES de tocar UI** (sala + comisiones, ambas cámaras).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Cobertura completa: sala + comisiones, ambas cámaras** | Hoy /agenda es parcial (sala Cámara PDF + Senado). Falta comisiones | HIGH | Auditoría de scraping primero (el milestone lo ordena). Puede requerir conectores nuevos. Dependencia dura antes de UI |
| **Estructura por día** | Calendario legible | LOW-MEDIUM | Reagrupar /agenda existente por fecha |
| **Distinción sala vs comisión** | Estructura básica del trabajo legislativo | LOW | Etiqueta de tipo de sesión |
| **Boletines mencionados por sesión, enlazados** | Prensa quiere saltar del ítem al PL | MEDIUM | Ya hay `sesion_tabla_item`/`citacion_punto` con boletín; enlazar a ficha |
| **Buscador FTS de citaciones** | Ya existe | LOW (ya existe) | `buscar_citaciones` (mig 0032). Mantener |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Filtros: cámara / comisión / rango de fecha / boletín mencionado** | Workflow periodista directo del milestone | MEDIUM | Client-side sobre el set del rango cargado (mismo patrón que Área 2) |
| **Vista "esta semana" / "hoy"** | El uso #1 de prensa | LOW-MEDIUM | Default temporal a la semana en curso |
| **"Qué boletines se mueven" (agenda → tramitación)** | Cruce agenda × timeline; alto valor | MEDIUM | Reusa timeline cross-cámara existente |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **UI de agenda antes de auditar cobertura** | ganas de mostrar | Muestra calendario incompleto como si fuera completo → engaña a prensa | Auditar scraping (sala+comisiones×2 cámaras) PRIMERO; declarar cobertura honesta (patrón v6.1) |
| **Predicción "este proyecto se aprobará"** | engagement | Especulación, no fuente | Solo lo agendado, factual, con enlace oficial |

---

## Feature Dependencies

```
[Retrieval híbrido (Área 1)]
    └──requires──> [FTS spanish sobre título/nombre]  (existe idiom vía buscar_citaciones)
    └──requires──> [match determinista de nº boletín]  (nuevo, LOW)
    └──enhances──> [Ranking (Área 1b)] ──feeds──> [Filtros/sort client-side (Área 2)]

[Filtro por partido del autor (Área 2)]
    └──requires──> [Partido en ficha (Área 4)]  +  [Autoría F48 (LIVE)]

[Cross-links entre parlamentarios (Área 4)]
    └──requires──> [Bio oficial: partido/comité/distrito (Área 4 table stakes)]

[Co-autoría (Área 4)] ──requires──> [Autoría poblada F48 (LIVE)]

[Enlace audiencia → PL (Área 5)]
    └──requires──> [Materia completa de audiencia (auditoría de campo)]
    └──requires──> [Boletines enlazables (existe)]

[UI de citaciones (Área 6)]
    └──requires──> [Auditoría de cobertura scraping sala+comisiones×2]  (GATE antes de UI)

[Deep-link preciso (Área 3)] ──enhances──> todas las fichas
    └──conflicts──> [buildId hardcodeado del portal Senado]
```

### Dependency Notes

- **Filtro por partido (Área 2) requiere partido en ficha (Área 4):** por eso el milestone ordena búsqueda/PL en Pasada 1 pero el filtro por partido puede quedar detrás de la bio de Pasada 2, o adelantarse solo el dato partido.
- **UI de citaciones (Área 6) bloqueada por auditoría de cobertura:** LOCKED en el milestone — no tocar UI hasta saber qué falta (sala+comisiones, ambas cámaras).
- **Enlace audiencia→PL (Área 5) es el de mayor riesgo anti-causal:** debe presentarse como coincidencia de materia con fuente, jamás como influencia.
- **Retrieval (Área 1) es prerrequisito de todo lo demás de Pasada 1:** ranking y filtros operan sobre lo que el retrieval trae.

---

## MVP Definition (para v9.0, sobre app ya existente)

### Launch With (Pasada 1 — Búsqueda/PL)

- [ ] Retrieval híbrido con **cero-fallo en número de boletín y fragmento literal de título** — es el bug del producto estrella; inaceptable no resolverlo
- [ ] Suite de **golden queries** como gate (número, título literal, tema, NL)
- [ ] **Ranking explicable** (mensaje > moción, recencia) — no ML opaco
- [ ] **Filtros/sort client-side** sobre resultados ya obtenidos (estado, tipo iniciativa, año, cámara) con chips + counts + faceta-vacía deshabilitada
- [ ] **Deep-link de validación** por boletín al punto preciso oficial + fecha de captura (+ snapshot R2 como respaldo)

### Launch With (Pasada 2 — Personas/Agenda)

- [ ] **Bio oficial en ficha**: partido, región/distrito, periodos, profesión, comisiones
- [ ] **Cross-links factuales** (mismo partido/comité/región) + co-autoría — sin afinidad inferida
- [ ] **Lobby legible**: materia completa + enlace audiencia→PL como coincidencia de materia (leyenda anti-causal)
- [ ] **Auditoría de cobertura de citaciones** (sala+comisiones×2) → luego calendario por día con filtros (cámara/comité/fecha/boletín) y vista "esta semana"

### Add After Validation (v9.x)

- [ ] Filtro por tema/materia normalizada (retrieval + agenda)
- [ ] Indicador de frescura por-dato superficializado en cada carril
- [ ] Alertas/seguimiento por boletín o parlamentario (patrón GovTrack/Vota Inteligente) — futuro milestone

### Future Consideration (v10+)

- [ ] Grafo de influencia P6 (fuera de scope; ego-network /red ya cubre lo legible)
- [ ] Notificaciones push pre-votación (Vota Inteligente) — requiere cuentas de usuario

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Cero-fallo nº boletín + título literal (híbrido) | HIGH | MEDIUM | P1 |
| Golden queries gate | HIGH | MEDIUM | P1 |
| Filtros/sort client-side (estado/tipo/año/cámara) | HIGH | LOW | P1 |
| Deep-link validación preciso + snapshot R2 | HIGH | MEDIUM | P1 |
| Bio oficial en ficha (partido/distrito/comités) | HIGH | MEDIUM | P1 |
| Auditoría cobertura citaciones → calendario+filtros | HIGH | HIGH | P1 |
| Lobby: materia completa + enlace a PL | HIGH | HIGH | P1 |
| Ranking explicable (mensaje>moción, recencia) | MEDIUM | MEDIUM | P1 |
| Cross-links parlamentarios + co-autoría | MEDIUM | MEDIUM | P2 |
| Filtro por partido del autor | MEDIUM | MEDIUM | P2 |
| Filtro por tema/materia | MEDIUM | MEDIUM | P2 |
| Frescura por-dato superficial | LOW | LOW | P3 |

**Priority key:** P1 = must-have v9.0 · P2 = should-have si datos alcanzan · P3 = nice-to-have.

---

## Competitor Feature Analysis

| Feature | Congress.gov / GovTrack | TheyWorkForYou / OpenParliament.ca | InfoLobby.cl / Vota Inteligente | Our Approach |
|---------|-------------------------|-------------------------------------|----------------------------------|--------------|
| Búsqueda por nº/cita exacta | `cite:` zero-miss; `HR 123` | permalink por sección | básica | **Match determinista literal #1 + híbrido RRF** |
| Ranking | relevancia + sort (fecha/acción/nº/título) | por fecha | simple | **Reglas explicables (mensaje>moción, recencia), no ML** |
| Filtros | subject/status/chamber/sponsor/session | comité/partido | autoridad/empresa | **Client-side chips+counts sobre set ya traído** |
| Deep-link a fuente | texto oficial + status | Hansard permalink | link a audiencia | **Boletín→punto preciso + snapshot R2 (defensa legal)** |
| Ficha legislador | perfil + votos + comités | votos+discursos+**voting summaries** | votos+asistencia+comisiones+gastos | **Bio oficial + carriles factuales; SIN voting summaries (anti-insinuación)** |
| Relaciones entre legisladores | — | co-firma, comités | — | **Solo declaradas (partido/comité) + co-autoría factual; jamás afinidad** |
| Lobby/audiencias | (N/A) | — | fecha/asistentes/temas/viajes | **Materia completa + enlace a PL como coincidencia, leyenda anti-causal** |
| Calendario | Bills This Week, filtro comité | agenda de debates | — | **Sala+comisiones×2 (tras auditoría), por día, filtros periodista** |

**Nota rectora:** el mayor riesgo importado de los comparables es el patrón **"voting summaries"** de TheyWorkForYou ("voted strongly for X") — es justo la insinuación que este proyecto tiene LOCKED-prohibida. Adoptamos su UX de trazabilidad (permalinks, links a fuente) pero NUNCA su agregación valorativa de votos.

## Sources

- [GovTrack — General User Guide](https://www.govtrack.us/how-to-use) — bill number `HR 123`, comillas para frase exacta, advanced search — HIGH
- [Congress.gov — Introduction to Search](https://www.congress.gov/help/search-intro) / [Search Tools](https://www.congress.gov/help/search-tools-overview) — `cite:` para nº exacto, relevancia + sort (fecha/acción/nº/título/law) — HIGH
- [Congress.gov — Find Bills by Subject and Policy Area](https://www.congress.gov/help/find-bills-by-subject) — facetas por subject/policy area — HIGH
- [Open States — API v2 examples](https://docs.openstates.org/api-v2/examples/) / [Find Your Legislators](https://openstates.org/) — filtros state/session/subject/type/chamber/sponsor/updated — HIGH
- [TheyWorkForYou — Voting information](https://www.theyworkforyou.com/voting-information/) / [voting summaries update Jul 2026](https://www.mysociety.org/2026/07/01/theyworkforyou-voting-summaries-update-july-2026/) — votos individuales + summaries agrupados (ANTI-feature aquí) + comités — HIGH
- [OpenParliament.ca — About](https://openparliament.ca/about/) / [GitHub michaelmulley/openparliament](https://github.com/michaelmulley/openparliament) — MP bio, riding, comités, cross-link debates↔bills — MEDIUM
- [InfoLobby.cl](https://www.infolobby.cl/) / [Ley del Lobby](https://www.leylobby.gob.cl/) — búsqueda por autoridad/empresa; fecha, asistentes, temas, viajes, regalos — HIGH
- [Fundación Ciudadano Inteligente — Vota Inteligente](https://en.wikipedia.org/wiki/Fundaci%C3%B3n_Ciudadano_Inteligente) — bills en lenguaje simple, historial votos, asistencia, comisiones, gastos, alertas — MEDIUM
- [Bills This Week — docs.house.gov/floor](https://docs.house.gov/floor/) / [Floor Calendars — Congress.gov](https://www.congress.gov/calendars-and-schedules) — calendario semanal filtrable por comité — HIGH
- [Modern Search: Semantic, Hybrid, Faceted, Vector](https://medium.com/@linz07m/modern-search-what-is-semantic-hybrid-faceted-and-vector-search-7c68231d8179) / [How to Create Hybrid Search](https://oneuptime.com/blog/post/2026-01-30-hybrid-search/view) — RRF, keyword+semántico, faceted pairing — MEDIUM

---
*Feature research for: legislative-transparency platform (Chile Congress — ciudadanos + prensa)*
*Researched: 2026-07-21*
