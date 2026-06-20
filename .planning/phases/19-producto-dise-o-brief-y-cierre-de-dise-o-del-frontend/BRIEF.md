# Observatorio del Congreso 360 — Product Brief (CLOSED)

> **Status: CLOSED.** This is the product brief for the Observatorio frontend. It is derived from the approved master design contract `19-UI-SPEC.md` and the locked user decisions in `19-CONTEXT.md`. The companion visual contract — tokens, component catalogue, editorial voice, honest-states, anti-insinuación invariants — lives in `DESIGN-SYSTEM.md` (Plan 19-01). Implementation phases that follow this brief MUST NOT re-open any decision recorded here.
>
> Scope reminder: this is a **product/design** artifact. It describes only data that already ships (v1.0: semantic search, project ficha, cross-chamber timeline, votaciones; v2.0: parlamentario 360 with votos/lobby/patrimonio + MONEY carriles gated OFF). It invents no feature and no datum. "Nice but no data" is marked DEFERRED, never described as real.

---

## 1. Core value & audience

**Core value.** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente". Cada dato mostrado lleva **fuente, fecha y enlace** a su origen, y la plataforma **no afirma intención ni causalidad**. La trazabilidad a la fuente es el principio rector, no un adorno: la ausencia de una procedencia implicaría falsamente que el dato no tiene origen.

**Audience.** Público general y prensa. La lectura es de nivel ciudadano (sin jerga legislativa innecesaria), pero cada dato es citable por un periodista hasta su fuente oficial.

**Dos frentes de igual peso.** El producto sostiene dos entradas equivalentes, ninguna subordinada a la otra:

| Frente | Pregunta que responde | Data que explota (ya shippeada) |
|--------|-----------------------|---------------------------------|
| **Seguimiento de proyectos de ley** | ¿En qué etapa está un proyecto, cómo se ha votado, qué proyectos se le parecen? | búsqueda semántica (HNSW), ficha de tramitación, timeline cruzando ambas cámaras, votaciones |
| **Análisis de parlamentarios 360** | ¿Qué presenta, cómo vota, con quién se reúne, qué declara en patrimonio, qué dinero lo rodea? | votos, reuniones de lobby, patrimonio/intereses; contratos y financiamiento (MONEY gated OFF hasta sign-off legal) |

**Invariantes de producto (no negociables, ver DESIGN-SYSTEM.md §8–§10):**

- `ProvenanceBadge` (fuente · fecha · enlace) en **cada** dato, en **toda** superficie.
- Anti-insinuación dura: una reunión / declaración / contrato / aporte y un voto **jamás** comparten una misma unidad de UI; los carriles son secciones hermanas (`mt-12`), nunca anidadas. Ningún voto se compone con dinero o lobby.
- MONEY permanece **gated OFF** por defecto (nodo ausente del HTML, no oculto por CSS) hasta el sign-off legal.
- Sin foto y sin partido del parlamentario (LEGAL-03): identidad = texto + chip institucional de cámara.

---

## 2. Information architecture & global navigation

### 2.1 Global header (`GlobalHeader`, NEW spec-only — `layout.tsx`)

Header mínimo, persistente, fondo crema, borde inferior sutil. Sin login (no hay cuentas). Toques ≥44px.

| Entrada | Destino | Racional |
|---------|---------|----------|
| Wordmark "Observatorio del Congreso 360" | `/` (home) | Vuelta al hero de búsqueda desde cualquier punto. |
| **Buscar** | `/buscar` (o el hero `/`) | El frente proyectos-de-ley empieza por descubrimiento semántico; es la acción protagonista. |
| **Parlamentarios** | `/parlamentario` (directorio) | Punto de entrada por personas: el frente parlamentarios-360 necesita una puerta navegable, no solo URLs profundas. |
| **Agenda** | `/agenda` | Punto de entrada por tiempo: qué se cita esta semana en sala y comisiones. |
| **Sobre / Metodología** | `/sobre`, `/metodologia` | Postura de dato, principios anti-insinuación, fuentes y atribución, honestidad "Beta abierta". |

La entrada activa se subraya en petróleo. Civic colours (azul-Cámara, burdeos-Senado) **nunca** se usan en el chrome de navegación — solo identifican el dato/cámara.

### 2.2 Surface map (rutas reales)

| Ruta | Superficie | Estado |
|------|-----------|--------|
| `/` | Landing — búsqueda semántica como hero | shippeada |
| `/buscar` | Resultados de búsqueda | shippeada |
| `/proyecto/[boletin]` | Ficha de proyecto (tramitación 360) | shippeada |
| `/parlamentario/[id]` | Ficha de parlamentario 360 | shippeada |
| `/parlamentario` | Directorio de parlamentarios | **NEW** (spec ahora, implementación después) |
| `/agenda` | Agenda semanal (sala + citaciones) | shippeada |
| `/contraparte/[id]` | Ficha de contraparte (empresa) | shippeada, **gated** (MONEY OFF → 404) |
| `/sobre` + `/metodologia` | Postura de dato + metodología | informacional |

**Jerarquía de navegación:**

- **Descubrimiento primero por búsqueda** — el hero de `/` y la barra persistente de `/buscar` son la vía principal hacia un proyecto.
- **Directorio de parlamentarios** como entrada por personas hacia cada ficha 360.
- **Agenda** como entrada por tiempo hacia las citaciones de la semana.

---

## 3. Landing / hero — semantic project search as the single protagonist

El landing tiene **un solo protagonista: la búsqueda semántica de proyectos.** No hay secciones de marketing, ni testimonios, ni cifras fabricadas. Layout `max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24` sobre fondo crema.

| Elemento | Especificación (LOCKED) |
|----------|--------------------------|
| **Headline display** | 36→48px, Geist Sans semibold, leading-tight, con **exactamente UNA** frase-acento en itálica en color petróleo. Sobrio y confiado; sin estadísticas fabricadas. Nunca más de una frase en itálica. |
| **SearchBox (hero)** | El `SearchBox` es el protagonista, con autofocus, focus ring petróleo y submit petróleo **"Buscar proyectos"**. Ordena por relevancia implícita (distancia HNSW cruda); nunca expone una cifra de relevancia por resultado. |
| **Example pills** | Las 4 pills LOCKED, debajo de la caja; al hacer click se rellena la búsqueda y se envía. |
| **Trust line** | La línea de confianza LOCKED, muteada, separada por bullets, bajo las pills. |
| **Onboarding inline** | Micro-affordance "¿Cómo leer esto?" (sin modal, sin tour). |
| **Fondo** | Solo textura tipográfica/papel. |

**Las 4 example pills (LOCKED — ideas-matriz reales/plausibles + 1 boletín):**

1. protección de datos personales
2. delitos económicos y medio ambiente
3. 40 horas / jornada laboral
4. Boletín nº `15234-07` (renderizado en Mono)

Las pills 1–3 ejercen la búsqueda semántica de ideas-matriz; la pill 4 demuestra el camino por número de boletín. Solo explotan data ya shippeada (búsqueda semántica + lookup de boletín). Si se mostrara algún conteo, sería un `count(*)` real; de lo contrario, nada.

**Trust line (LOCKED, bajo el hero):**

> Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad.

**DEFERRED en el landing:** el **motivo de grafo ambiental** queda DEFERRED — el grafo real es Phase 18 (NET), y un grafo decorativo de personas rozaría la insinuación. El fondo es solo textura tipográfica/papel. Cualquier grafo decorativo futuro sería SOLO de normas/documentos, nunca de rostros.

---

## 4. Onboarding / primer uso

Onboarding **inline únicamente**, sin fricción:

- Las **example pills** son el onboarding principal: muestran qué se puede preguntar y, al hacer click, ejecutan la búsqueda — son la consulta, no un tutorial.
- Micro-affordance **"¿Cómo leer esto?"** (`OnboardingHints`, inline, adaptado del hint bar "¿Cómo leer el mapa?" de TributaLab) en el hero y en los resultados.
- **No hay modal de bienvenida ni tour guiado.** El primer uso se aprende usando.

---

## 5. Per-surface value — squeezing the REAL data

Cada superficie exprime al máximo la data **ya shippeada**, sin inventar features ni datos. La postura de dato se aplica en TODAS: `ProvenanceBadge` por dato; guarda de identidad (enlace solo si `confirmado`); PII (RUT/partido/email) nunca renderizada; MONEY gated; atribución por dataset.

### 5.1 `/buscar` (resultados)

**Valor:** del lenguaje natural a los proyectos relevantes, con la composición de fuentes a la vista y sin un solo número editorializado.

- Orden por **relevancia implícita** (distancia HNSW cruda ASC, server-side) — **sin** cifra por resultado.
- **`SourceTypeTabs`** (Todo / Proyectos / otros tipos reales) — conteos reales o ausentes, nunca falseados.
- **`MapaDeFuentes`** (sidebar desktop): resumen de composición por tipo de fuente, count/shape-coded — nunca un grafo de personas (DEFERRED), nunca una cifra de relevancia.
- Banner AI opcional ("Analizar resultados · síntesis sobre estas fuentes · la fuente original queda íntegra") — etiquetado, nunca reemplaza la fuente.
- **Result cards** (`SearchResultCard`): boletín en Mono, `EtapaBadge`, `CamaraChip`, título, `ProvenanceBadge`. Sin barra de relevancia.

### 5.2 `/proyecto/[boletin]` (ficha de proyecto)

**Valor:** "qué pasó con este proyecto, cuándo y según qué fuente" en una sola lectura cronológica.

- `FichaHeader`: título, boletín (Mono), `EtapaBadge`, `CamaraChip`(s), `ProvenanceBadge`.
- Carriles apilados (`mt-12` hermanos, cada uno con su `<h2>` + Suspense + skeleton + empty honesto):
  - **Idea matriz** (`IdeaMatrizBlock`) — si está presente; contenido AI-extraído → `AiSummaryCallout` con chips modelo/scope/fuentes y la **fuente íntegra** debajo.
  - **Cuerpos legales** (`CuerposLegalesList`).
  - **Timeline de tramitación** (`TimelineView`) cruzando ambas cámaras, coloreado por civic token de cámara.
  - **Votaciones** (`VotacionCard` / `VotoRow`) — paleta de resultado (A favor / En contra / Abstención / Pareo / Ausente), guarda de identidad en los nombres.
  - **Proyectos similares** (`ProyectosSimilares`) — por similitud de embedding, **sin cifra**, enmarcado como "proyectos relacionados".

### 5.3 `/parlamentario/[id]` (ficha 360)

**Valor:** el frente parlamentarios-360, con cada carril en su propio terreno y jamás compuesto con un voto.

- `ParlamentarioHeader`: nombre, cámara (`CamaraChip`), período (Mono). **No foto. No partido** (LEGAL-03).
- Carriles en **orden LOCKED**, cada uno un `<section class="mt-12">` hermano (h2 + Suspense + skeleton + 3 estados honestos):
  1. **`#votos`** — Votaciones: lista de votos, asistencia, rebeldías como dato neutral (sin juicio), vista por-tema (reusa embeddings). Guarda de identidad aplicada.
  2. **`#lobby`** — Reuniones de lobby: contraparte como texto crudo + `IdentityMarker`, nunca enlazada; `ProvenanceBadge` por fila.
  3. **`#patrimonio`** — Declaraciones de patrimonio e intereses: historial de versiones, comparación solo-datos (sin veredicto/delta), "Presentada el {fecha}" prominente en Mono + caveat histórico ámbar, CC BY 4.0 visible en intro y caption.
  4. **`#dinero`** — Contratos del Estado asociados al RUT — **gated** (`moneyPublicEnabled` envuelve la sección entera incl. h2; OFF → ausente). Atribución "mención de la fuente" (NO CC BY 4.0).
  5. **`#financiamiento`** — Aportes de campaña registrados en SERVEL — **gated**. Agrupado por elección + caveat ámbar de candidaturas previas; el donante es su propio sujeto ("Aporta:"), RUT del donante NUNCA renderizado; "asociado por nombre confirmado al candidato" (nunca "por RUT").
- Anti-insinuación: ningún carril se compone con `#votos`; la separación `mt-12` nunca se colapsa.

### 5.4 `/parlamentario` (directorio — NEW)

**Valor:** la puerta navegable por personas, respaldada por data real, sin convertirse en una tabla de juicio.

- Respaldado por la **maestra real ~186 filas** (31 senadores + 155 diputados) vía un RPC public-read (espejo de `parlamentario_publico`, solo campos de cabecera).
- Cada entrada: nombre + cámara (`CamaraChip`) + período (Mono). Sin foto y sin partido: **no foto, no partido** (LEGAL-03). Enlaza a `/parlamentario/[id]`.
- Filtros: por cámara, búsqueda por nombre. **Orden neutral** (alfabético por defecto) + `MethodologyCaveat`. Cualquier orden por hecho observable lleva su caveat anti-juicio.
- Es explícitamente **NO** una tabla de veredicto. (El nombre prohibido para esa anti-feature se cita vallado en §7.)

### 5.5 `/agenda`

**Valor:** la entrada por tiempo — qué se cita esta semana, con las definiciones a un tooltip de distancia.

- `WeekNav` (semana anterior/siguiente), fechas prominentes en Mono.
- `SalaTableSection`: tabla comparativa densa con tooltips de definición de columna, `ProvenanceBadge` por fuente.
- `CitacionCard` por cámara; invitados renderizados como **texto crudo** (terceros, nunca enlazados/reconciliados).
- Empty honesto: "No hay citaciones para esta semana." (distinto de error).

### 5.6 `/contraparte/[id]` (gated)

**Valor (cuando MONEY ON):** la empresa (persona jurídica) como sujeto propio, con su rastro de contratos y aportes — sin un solo dato de voto cerca.

- **Gate a nivel de página:** `moneyPublicEnabled(process.env) → notFound()` como primera sentencia (OFF → ruta entera 404, sirve not-found.tsx). Permanece OFF hasta LEGAL-01.
- **Con ON:** header (empresa) + DOS carriles `mt-12` hermanos: contratos (ChileCompra) + aportes (SERVEL), cada fila trazada (`ProvenanceBadge`).
- Anti-insinuación dura: cero dato de voto, cero lenguaje causal, conteo neutral (sin SUM/orden de juicio), montos verbatim, RUT del donante nunca renderizado.
- Atribución por dataset (ChileCompra "mención de la fuente" / SERVEL "términos de uso por verificar"; nunca CC BY 4.0).

### 5.7 `/sobre` + `/metodologia`

**Valor:** la honestidad como superficie — la postura de dato es parte del producto, no letra chica.

- Postura de dato (minimización + trazabilidad), principios anti-insinuación, lista de fuentes + atribución por dataset, honestidad "Beta abierta".
- Enlazada desde el header global y desde cada `MethodologyCaveat` ("Fuente · Metodología").
- Superficie informacional, no un carril de dato.

---

## 6. Reference verdicts applied — browseros study (SC1 evidence)

Estudio visual de tres referencias, cada veredicto respaldado por su captura **en disco** bajo `refs/`. Estas seis capturas son la **evidencia de SC1**.

| Referencia | ADOPT (en este producto) | ADAPT | AVOID | Evidencia (refs/) |
|------------|--------------------------|-------|-------|-------------------|
| **TributaLab** | Fondo crema/papel; headline display + frase-acento en itálica; búsqueda-como-hero + pills; trust line; AI-con-fuente-íntegra-al-lado etiquetada; tabs por tipo de fuente; Mono para metadata; hint inline "¿Cómo leer?" | Motivo de grafo ambiental → **DEFERRED** (grafo de personas = riesgo insinuación; Phase 18, solo normas) | — | `refs/tributalab-home.jpg`, `refs/tributalab-resultados.jpg` |
| **LegalAtlas** | Resumen AI etiquetado con modelo/scope/fuentes + "la fuente queda íntegra"; breadcrumb; acciones "Ver fuente"; honestidad "Beta abierta" | Barras de relevancia → **OUT** (sin cifra por resultado, nunca); headlines serif → Geist Sans display | Cifra de coincidencia visible | `refs/legalatlas-home.jpg`, `refs/legalatlas-ficha-articulo.jpg` |
| **ischilesafe** | Honestidad metodológica explícita + caveats + "Fuente · Metodología"; tablas comparativas densas con tooltips de definición; tendencia coloreada literal (paleta de resultado de voto) | "Ranking" → solo orden por hecho observable neutral + caveat anti-juicio; nunca una tabla de "los peores" | Cualquier framing que se lea como veredicto o acusación | `refs/ischilesafe-home.jpg`, `refs/ischilesafe-rankings.jpg` |

**Trazas a decisiones del Observatorio:** crema → fondo del producto (DESIGN-SYSTEM.md §1); búsqueda-como-hero + pills → §3 de este brief; trust line → §1/§3; AI-con-fuente-íntegra → `AiSummaryCallout`; tabs por tipo → `SourceTypeTabs`; caveats metodológicos → `MethodologyCaveat`. El motivo de grafo y las barras de relevancia quedan ADAPTADOS AFUERA; cualquier framing de veredicto/acusación queda EVITADO.

> SC1 está MET solo si las seis capturas existen en disco. Las seis fueron verificadas presentes en tiempo de ejecución (ver Self-Check del SUMMARY).

---

## 7. Deferred ideas

Ideas reconocidas pero NO diseñadas como features reales en esta fase:

- **DEFERRED — Grafo de influencia (NET):** Phase 18; el motivo de grafo ambiental del landing también se difiere. Razón: el grafo real es otra fase y un grafo de personas rozaría la insinuación.
- **DEFERRED — Motivo de grafo ambiental decorativo:** si alguna vez se usara, SOLO de normas/documentos, nunca rostros de personas. Razón: riesgo de insinuación.
- **DEFERRED — Mockups HTML de TODAS las pantallas:** solo el landing se materializa como mockup; las demás quedan como UI-SPEC. Razón: decisión de alcance del usuario (1 mockup + spec por pantalla).
- **DEFERRED — Ordenamiento por métrica del directorio de parlamentarios** como una <!-- BANNED-VOCAB-START -->"ranking de los peores"<!-- BANNED-VOCAB-END -->: cualquier orden debe ser por hecho neutral observable + caveat. Razón: una tabla así se leería como veredicto acusatorio (riesgo de insinuación), se evalúa con cuidado fuera de esta fase.
- **DEFERRED — Implementación de producción del brief** (header global real, fondo crema en `globals.css`, directorio de parlamentarios): fase posterior que SIGUE este brief sin re-abrir decisiones.

---
