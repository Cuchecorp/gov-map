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
