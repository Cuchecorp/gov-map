# Feature Research

**Domain:** Observatorio ciudadano de transparencia legislativa (civic-tech) — frente "proyectos de ley" (Milestone 1)
**Researched:** 2026-06-17
**Confidence:** HIGH para table stakes y anti-features (corroborado en GovTrack, OpenStates/Plural, TheyWorkForYou/mySociety, Congreso Visible y las reglas rectoras de PROJECT.md); MEDIUM para diferenciadores semánticos (corroborado en literatura académica de bill-similarity/embeddings, pero pocas plataformas ciudadanas en producción lo exponen).

> **Alcance.** Este documento se enfoca en el **frente "proyectos"** (M1: Fundaciones + P2 Tramitación + P1 Búsqueda semántica). El **frente "parlamentarios"** (perfiles 360, voto×tema, lobby, patrimonio, dinero) se menciona solo como contexto y está fuera de M1 — ver sección "Frente parlamentario (contexto, fuera de M1)".

## Panorama de referencia

| Plataforma | País | Aporta al modelo de M1 |
|------------|------|------------------------|
| **GovTrack.us** | EE.UU. | Ficha de proyecto con ciclo de vida (introducción→promulgación), texto del proyecto, alertas por bill/tema/comité, RSS. Estándar de oro de "ficha + tracker". |
| **Open States (Plural Policy)** | EE.UU. (50 estados) | Búsqueda full-text de proyectos, detalle con votos y patrocinios, scrapers multi-diarios, API/bulk. Estándar de "búsqueda + datos abiertos". |
| **TheyWorkForYou (mySociety)** | UK | Alertas por palabra/frase y por representante; rediseño 2025 de gestión de alertas complejas. Estándar de "monitoreo por keyword para prensa/ONG". |
| **Congreso Visible (Uniandes)** | Colombia | Consulta de iniciativas con autores, ponentes y estado de trámite desde 1998; agenda legislativa; citaciones/control político; votaciones. Referencia LatAm más cercana al caso chileno. |
| Literatura (LegisSearch, bill-similarity corpora, BGE embeddings) | — | Búsqueda semántica y "proyectos similares" por vecindad de embeddings; valida P1 como diferenciador técnicamente maduro. |

## Feature Landscape

### Table Stakes (sin esto el usuario se va)

Features que el usuario asume que existen. Faltar una = el producto "se siente roto" o no confiable.

| Feature | Por qué se espera | Complejidad | Notas |
|---------|--------------|------------|-------|
| **Búsqueda de proyectos** (por boletín, título, palabra clave) | Es la puerta de entrada; presente en GovTrack, Open States, Congreso Visible. Sin esto no hay producto. | MEDIUM | Full-text sobre título + idea matriz. Boletín como clave exacta. La búsqueda *semántica* es el diferenciador (abajo); pero debe existir un fallback léxico simple. |
| **Ficha de proyecto con estado/etapa actual** | El usuario quiere "¿en qué va este proyecto?" en un vistazo. GovTrack y Congreso Visible la centran. | MEDIUM | Estado normalizado (en comisión / sala / promulgado / archivado), cámara de origen, fecha del último movimiento. Cruza Cámara + Senado por boletín. |
| **Timeline de tramitación** (cronología de hitos) | Esperado para entender el recorrido del proyecto, no solo su estado final. | MEDIUM-HIGH | Hitos ordenados por fecha, cruzando `tramitacion.php` (Senado) y `doGet.asmx` (Cámara). Conciliar duplicados entre cámaras es el reto. |
| **Resultados de votación** | "¿Cómo se votó?" es pregunta central; Open States y Congreso Visible lo exponen. | MEDIUM | A nivel **agregado** (aprobado/rechazado, votos a favor/contra/abstención) está disponible. ⚠️ Voto **individual por diputado** NO está en `doGet.asmx` → vive en `opendata.camara.cl` (sin validar). El voto agregado es table stakes M1; el individual es P3 (M2). |
| **Indicador de frescura por fuente** | Diferenciador crítico del PROJECT.md ("qué pasó, cuándo, según qué fuente"). En civic-tech la confianza depende de saber qué tan actual es el dato. | LOW-MEDIUM | "Última actualización: X" por fuente/conector. Barato si el framework de conectores registra timestamp de snapshot. Es a la vez higiene de confianza y defensa jurídica. |
| **Enlace a la fuente original** | Trazabilidad como principio rector; permite verificación independiente (prensa). | LOW | Cada dato lleva enlace al endpoint/portal de origen (Senado, Cámara, BCN). Trivial si se persiste la URL de origen en el modelo. |
| **Texto íntegro / acceso al documento** | GovTrack permite "leer el texto del proyecto". Sin el texto, la idea matriz y la búsqueda semántica no tienen sustento verificable. | MEDIUM | Descarga de textos (links Senado + BCN `obtxml`). Es prerequisito de P1, pero también valor por sí mismo. |

### Differentiators (ventaja competitiva)

Features que distinguen al producto. Alineados con el Core Value (búsqueda semántica + trazabilidad).

| Feature | Propuesta de valor | Complejidad | Notas |
|---------|-------------------|------------|-------|
| **Búsqueda semántica en lenguaje natural** | El usuario pregunta "proyectos sobre arriendo de viviendas para adultos mayores" sin conocer la jerga legislativa. Ninguna referencia LatAm lo ofrece bien; GovTrack/Open States siguen siendo léxicas. | HIGH | Embeddings (Gemini) + pgvector. Corazón de P1. La literatura (LegisSearch, BGE) confirma madurez técnica. Riesgo: calidad de embeddings sobre texto legal en español. |
| **Fichas estructuradas por idea matriz + cuerpos legales** | Convierte texto legal denso en estructura comparable y buscable. Habilita búsqueda semántica y "similares". | HIGH | Extracción vía parsing + LLM con prompt-cache (DeepSeek). Depende del texto íntegro. Calidad de extracción = calidad de todo P1. |
| **"Proyectos similares"** (vecindad semántica) | "Muéstrame proyectos parecidos a este" — útil para prensa que rastrea iniciativas recurrentes/refritos. Validado en corpora de bill-similarity. | MEDIUM | Cae casi gratis una vez existen embeddings (kNN en pgvector). Alto valor percibido, bajo costo incremental sobre la búsqueda semántica. |
| **Alertas / suscripciones** | El feature más usado y valorado de GovTrack y TheyWorkForYou; convierte visitantes en usuarios recurrentes (prensa, ONG). | MEDIUM-HIGH | Por boletín, por tema/keyword, o por vecindad semántica. **Diferir post-M1**: requiere auth, jobs de notificación y email. Alto valor pero no es M1. |
| **Indicador de trazabilidad visible en cada dato** | Más fuerte que el de los competidores: no solo "fuente" sino fuente+fecha+enlace en cada afirmación. Es defensa jurídica y diferenciador de confianza. | LOW-MEDIUM | Es la materialización UI de la regla rectora. Diferenciador barato si el modelo persiste procedencia desde el día 1. |
| **Comparador de proyectos** | Ver dos proyectos lado a lado (idea matriz, estado, votación). Útil para prensa. | MEDIUM | Depende de fichas estructuradas. Post-M1. |
| **Visualizaciones de tramitación** | Timeline visual, mapa de etapas. Mejora comprensión para público general. | MEDIUM | Next.js es maduro para esto. Empezar con timeline simple en M1; visualizaciones ricas post-M1. |

### Anti-Features (NO construir — deliberado)

Estas son las reglas de diseño responsable del PROJECT.md (riesgo existencial #2: "máquina de sospechas"). No son opcionales: definen la defensa jurídica y ética del producto.

| Feature | Por qué se pide | Por qué es problemático | Alternativa |
|---------|---------------|-----------------|-------------|
| **Afirmaciones de causalidad / intención** ("votó así *porque*...", "presentó el proyecto *para favorecer*...") | Genera titulares; "explica" la política. | Riesgo existencial #2. El sistema no puede conocer intención; afirmarla es difamación potencial y destruye credibilidad. | Mostrar **correlación con contexto temporal y fuente**: "votó X el [fecha]; declaró interés Y el [fecha]" — el usuario interpreta, el sistema no concluye. |
| **Rankings de "culpabilidad" / scorecards morales** | Los scorecards de advocacy (AFL-CIO, Chamber) son populares y simples de consumir. | Codifican un juicio de valor con apariencia de objetividad; sesgan según quién define el criterio; convierten datos neutros en acusación. | Métricas **descriptivas y neutrales** con metodología transparente (ej. "asistencia a votaciones", "proyectos presentados") sin etiqueta de bueno/malo. Y eso es frente parlamentario, no M1. |
| **Exposición pública de RUT** | Es la llave de cruce más fuerte; tentador exponerla. | Dato personal protegido (Ley 21.719, vigencia 01/12/2026); "fuente de acceso público" no exime cumplimiento; el dato derivado del cruce queda protegido. | RUT **solo uso interno** para reconciliación de identidad; minimización por diseño; nunca en UI pública. |
| **Exposición de datos de familiares** | Aparecen en patrimonio/intereses; "completan" el perfil. | Mismo marco legal; daño reputacional a terceros no electos. | No exponer. Uso interno acotado solo si es estrictamente necesario para reconciliación, con minimización. |
| **Cruces que insinúan trama sin contexto** (grafos de "red de influencia" presentados como prueba) | Visualmente impactantes, "revelan conexiones". | Insinúan conspiración; el grafo sugiere causalidad que los datos no respaldan. P6 explícitamente diferido. | Cuando se haga (P6, lejano), presentar conexiones como **hechos atribuibles con fuente**, nunca como narrativa de intención. |
| **Conclusiones automáticas del LLM presentadas como hechos** | El LLM puede "resumir" o "concluir". | La reconciliación/extracción LLM puede fallar en silencio (riesgo existencial #1) → afirmación falsa pero creíble. | LLM para extracción estructurada con **compuerta de validación + revisión humana + golden set**; nunca para conclusiones editoriales sin fuente. |

## Feature Dependencies

```
[Framework de conectores] (rate-limit, caché, snapshots, procedencia)
    └──requires──> [Indicador de frescura por fuente]
    └──requires──> [Enlace a fuente original]
    └──requires──> [Resultados de votación]
    └──requires──> [Timeline de tramitación]
                        └──requires──> [Ficha con estado/etapa]
                                            └──requires──> [Búsqueda de proyectos]

[Descarga de texto íntegro]
    └──requires──> [Extracción idea matriz + cuerpos legales (LLM)]
            └──requires──> [Embeddings + pgvector]
                    ├──requires──> [Búsqueda semántica en lenguaje natural]
                    └──requires──> ["Proyectos similares"]

[Búsqueda semántica] / [Ficha de proyecto] ──enable──> [Alertas/suscripciones] (post-M1, +auth +jobs +email)
[Fichas estructuradas] ──enable──> [Comparador] (post-M1)
[Tabla maestra Parlamentario + reconciliación] ──enable──> [Frente parlamentario 360] (M2+)
```

### Dependency Notes

- **Todo depende del framework de conectores:** frescura, enlace a fuente y procedencia deben capturarse en la ingesta, no agregarse después. Construirlos al final obliga a reprocesar todo.
- **La cadena semántica es lineal y frágil:** texto íntegro → extracción LLM → embeddings → búsqueda. Cada eslabón hereda la calidad del anterior. La extracción de idea matriz es el cuello de botella de calidad de P1.
- **"Proyectos similares" es casi gratis tras los embeddings:** kNN sobre pgvector. Alto valor, bajo costo incremental — incluir en M1.
- **Voto individual NO bloquea M1:** el voto agregado (table stakes) sí está disponible. El individual por diputado (opendata.camara.cl, sin validar) bloquea P3 (M2), no M1.
- **Alertas dependen de auth + notificaciones:** alto valor pero introduce superficie nueva (cuentas, email, jobs). Diferir post-M1 pese a ser el feature estrella de GovTrack/TheyWorkForYou.

## MVP Definition

### Launch With (M1 — frente "proyectos" completo)

- [ ] **Framework de conectores con procedencia** — base de toda la trazabilidad; sin esto nada es confiable
- [ ] **Búsqueda de proyectos** (semántica + fallback léxico por boletín/título) — puerta de entrada
- [ ] **Ficha de proyecto con estado/etapa** — la pregunta #1 del usuario
- [ ] **Timeline de tramitación** (Cámara + Senado por boletín) — entender el recorrido
- [ ] **Resultados de votación agregados** — "¿cómo se votó?"
- [ ] **Indicador de frescura por fuente** — confianza + defensa jurídica
- [ ] **Enlace a fuente original en cada dato** — regla rectora de trazabilidad
- [ ] **Fichas estructuradas por idea matriz + cuerpos legales** — corazón del diferenciador
- [ ] **Búsqueda semántica en lenguaje natural** — el diferenciador central
- [ ] **"Proyectos similares"** — casi gratis tras embeddings, alto valor

### Add After Validation (v1.x, post-M1)

- [ ] **Alertas/suscripciones** (por boletín, keyword, vecindad) — cuando haya tráfico que retener y auth lista
- [ ] **Voto individual por diputado** — cuando se valide `opendata.camara.cl` (P3/M2)
- [ ] **Comparador de proyectos** — cuando las fichas estructuradas estén maduras
- [ ] **Visualizaciones ricas de tramitación** — iterar sobre el timeline base

### Future Consideration (M2+, frente parlamentario)

- [ ] **Perfil 360 de parlamentario** — requiere tabla maestra + reconciliación poblada
- [ ] **Cómo vota el Congreso** (voto × parlamentario × tema) — P3
- [ ] **Lobby + patrimonio + dinero** (P4-P5) — requiere política de datos del LLM y conectores frágiles (SERVEL)
- [ ] **Observatorio de redes / grafo** (P6) — solo con modelo poblado y bajo reglas anti-causalidad

## Feature Prioritization Matrix

| Feature | Valor usuario | Costo impl. | Prioridad |
|---------|------------|---------------------|----------|
| Framework de conectores + procedencia | HIGH | MEDIUM | P1 |
| Búsqueda de proyectos | HIGH | MEDIUM | P1 |
| Ficha con estado/etapa | HIGH | MEDIUM | P1 |
| Timeline de tramitación | HIGH | MEDIUM-HIGH | P1 |
| Votación agregada | HIGH | MEDIUM | P1 |
| Frescura por fuente | MEDIUM | LOW | P1 |
| Enlace a fuente | MEDIUM | LOW | P1 |
| Fichas por idea matriz | HIGH | HIGH | P1 |
| Búsqueda semántica NL | HIGH | HIGH | P1 |
| Proyectos similares | HIGH | LOW (post-embeddings) | P1 |
| Alertas/suscripciones | HIGH | MEDIUM-HIGH | P2 |
| Voto individual diputado | HIGH | HIGH (fuente sin validar) | P2 |
| Comparador | MEDIUM | MEDIUM | P3 |
| Visualizaciones ricas | MEDIUM | MEDIUM | P3 |

**Clave:** P1 = imprescindible para M1 · P2 = agregar tras validar · P3 = futuro.

## Competitor Feature Analysis

| Feature | GovTrack | Open States | Congreso Visible | TheyWorkForYou | Nuestro enfoque |
|---------|----------|-------------|------------------|----------------|-----------------|
| Búsqueda de proyectos | Léxica + filtros | Full-text | Por iniciativa/autor | Por debate | **Semántica NL** + fallback léxico |
| Ficha de proyecto | Ciclo de vida completo | Detalle + votos | Estado + ponentes | — | Estado + timeline + votación + **idea matriz estructurada** |
| Votación | Sí (con voto individual) | Sí | Sí | — | Agregada en M1; individual en M2 |
| Alertas | Sí (estrella) | Vía API | — | Sí (estrella, por keyword) | Diferido post-M1 |
| Proyectos similares | No | No | No | No | **Sí (diferenciador)** |
| Trazabilidad por dato | Parcial | Datos abiertos | Fuente | Enlace a Hansard | **Fuente+fecha+enlace en cada dato (rector)** |
| Scorecards/rankings | Estadísticas (ideología) | No | Balances | No | **NO (anti-feature)** |

## Frente parlamentario (contexto, fuera de M1)

Para que el roadmap entienda hacia dónde apunta el producto, sin construirlo en M1:

- **Perfil 360:** proyectos presentados, patrón de votación, lobby, patrimonio/intereses, financiamiento. Depende de la tabla maestra `Parlamentario` y la reconciliación de identidad (sembradas en M1 Fundaciones, pobladas después).
- **Reglas anti-feature aplican con MÁS fuerza aquí:** es donde la "máquina de sospechas" es tentadora. Todo dato parlamentario debe ser descriptivo y atribuido, nunca acusatorio. RUT y familiares solo uso interno.
- **Por qué M1 siembra identidad pero no la usa públicamente:** la reconciliación es el subsistema crítico (riesgo existencial #1); debe estar madura con golden set + revisión humana antes de exponer cualquier afirmación sobre una persona.

## Sources

- [GovTrack.us — About](https://www.govtrack.us/about) y [How to use](https://www.govtrack.us/how-to-use) — ficha, alertas, tracker lists, RSS (HIGH)
- [Open States / Plural Policy](https://open.pluralpolicy.com/) y [API v3 docs](https://docs.openstates.org/api-v3/) — búsqueda full-text, detalle con votos, scrapers multi-diarios (HIGH)
- [TheyWorkForYou — A richer view of Parliament (mySociety, 2025)](https://www.mysociety.org/2025/10/23/theyworkforyou-update-a-richer-view-of-parliament/) y [Improving email alerts](https://www.mysociety.org/2025/10/23/improving-theyworkforyou-email-alerts/) — alertas por keyword/representante (HIGH)
- [Congreso Visible (Uniandes)](https://congresovisible.uniandes.edu.co/) y [Red Latinoamericana por la Transparencia Legislativa](https://transparencialegislativa.org/portfolio/congreso-visible/) — iniciativas, agenda, votaciones, citaciones LatAm (HIGH)
- [LegisSearch: navigating legislation with graphs and LLMs (Springer, 2025)](https://link.springer.com/article/10.1007/s10506-025-09482-6) — búsqueda semántica legislativa (MEDIUM)
- [Learning Bill Similarity with Annotated and Augmented Corpora of Bills (arXiv)](https://arxiv.org/pdf/2109.06527) — "proyectos similares" por embeddings (MEDIUM)
- [Legislative scorecard (Wikipedia)](https://en.wikipedia.org/wiki/Legislative_scorecard) — contexto de por qué los rankings son anti-feature (MEDIUM)
- `.planning/PROJECT.md` — reglas rectoras de diseño responsable, marco legal Ley 21.719, riesgos existenciales (HIGH, autoritativo)

---
*Feature research for: observatorio de transparencia legislativa — frente proyectos (M1)*
*Researched: 2026-06-17*
