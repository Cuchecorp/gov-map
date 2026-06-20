# Phase 19: Producto + Diseño — Brief y cierre de diseño del frontend - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autónomo) + estudio visual browseros en contexto orquestador

<domain>
## Phase Boundary

Fase de **diseño/producto**, no de features nuevas. Produce artefactos **implementation-ready y CERRADOS**:
brief de producto, design system, UI-SPEC por pantalla clave, catálogo de estados honestos, guía de voz
editorial ES, y 1 mockup HTML/Tailwind throwaway del landing como ancla visual. Saca el **máximo de la data
YA disponible** (v1.0 búsqueda semántica + ficha tramitación + timeline + votaciones; v2.0 parlamentario 360 +
MONEY gated) — **no inventa features ni datos**. Al terminar, el diseño queda cerrado: la implementación
posterior sigue el brief sin re-abrir decisiones.

**Fuera de alcance:** implementar las features de producción; tocar conectores/DB/RLS; encender MONEY;
construir el grafo NET (Phase 18). Lo "lindo pero sin data" → idea diferida marcada, no se diseña como real.

**Superficies existentes (rutas reales):** `/` (landing-búsqueda), `/buscar`, `/proyecto/[boletin]`,
`/parlamentario/[id]`, `/agenda`, `/contraparte/[id]` (gated).
</domain>

<decisions>
## Implementation Decisions

### Marca y visual (Área 1 — Aceptar todo)
- **Fondo crema/papel cálido** como base (familia TributaLab), no el blanco shadcn clínico. Mantener modo claro como primario; dark mode coherente.
- **Headline display grande con UNA frase-acento en itálica** (patrón "Sin alucinaciones.") para hero/landing; confiado pero sobrio.
- **Acento de producto = petróleo/teal neutro** para el "chrome" (búsqueda, CTAs, links, focus ring). Los **civic tokens (azul-Cámara `--camara`, burdeos-Senado `--senado`) quedan EXCLUSIVAMENTE para identificar dato/cámara institucional** — nunca como color de marca ni de UI general (evita lectura política).
- **Tipografía:** Geist Sans (cuerpo + display por peso), Geist Mono para metadata dura (boletín, RUT, fechas, IDs). Sin serif nuevo.

### Landing y búsqueda-como-hero (Área 2 — Aceptar todo)
- **Búsqueda semántica de proyectos = único hero** del landing, con **pills de ejemplo** (2–3 ideas-matriz + 1 nº de boletín). Sin stats fabricadas (solo `count(*)` real, o nada).
- **Motivo de grafo ambiental DIFERIDO.** En su lugar, textura tipográfica/papel. El grafo real es Phase 18; un grafo decorativo de personas rozaría la insinuación.
- **Línea de confianza** bajo el hero: "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad" (equivalente al "Fuentes oficiales · Trazabilidad · Cero respuestas inventadas" de la familia).
- **Onboarding inline** (pills + micro-affordances "¿cómo leer esto?"), sin modal ni tour.

### Arquitectura de información y navegación (Área 3 — Aceptar todo)
- **Header global mínimo persistente:** wordmark→home, Buscar, Parlamentarios, Agenda, Sobre/Metodología.
- **Directorio de parlamentarios:** se DISEÑA (spec ahora, implementación después). Respaldado por data REAL (maestra ~186 filas: 31 senadores + 155 diputados). Sin foto, sin partido (LEGAL-03).
- **ProvenanceBadge = patrón canónico** "fuente · fecha · enlace" en TODAS las superficies; se formaliza en el design system.
- **Carril anti-insinuación documentado** como invariante del DS: secciones `mt-12` hermanas (nunca anidadas); una reunión/declaración/contrato/aporte y un voto JAMÁS comparten `<article>/<Card>/<li>/<tr>`.

### Entregable y cierre (Área 4 — Aceptar todo)
- **Entregables:** `BRIEF.md` (producto) + `DESIGN-SYSTEM.md` (tokens/componentes/voz/estados) + **UI-SPEC por pantalla clave** + **1 mockup HTML/Tailwind throwaway del landing** como ancla visual.
- **Catálogo de estados honestos** vacío/carga/error por superficie (que nunca se lean como "limpio"): distinguir "no consultado" ≠ "consultado sin resultados" ≠ "error".
- **Guía de voz editorial ES:** neutral, factual; sin lenguaje causal/afinidad/score; montos de dinero verbatim; literal y fechado.
- **Cierre consolidado:** todo revisado y marcado **CERRADO**; cualquier implementación posterior sigue el brief sin re-abrir decisiones.

### Claude's Discretion
- Nombres exactos de archivos de entregable, orden de secciones, y detalle de tokens (valores HSL del acento petróleo, escala de espaciado) quedan a discreción, consistentes con lo ya shippeado.
- Elección de qué 2–3 ideas-matriz usar como pills de ejemplo (deben ser plausibles y reales).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (design system ya shippeado)
- **Tokens base:** shadcn Default/Slate en `app/app/globals.css` (`--primary` azul 221°, `--radius` 0.5rem, dark mode completo).
- **Civic semantic tokens** en `app/app/styles/civic-tokens.css`: `--camara` (azul institucional `hsl(213 94% 38%)`), `--senado` (burdeos `hsl(355 65% 38%)`), `--provenance-*`, `--identity-warn-*`. Explícitamente "drawn from official institutional identity, NOT political parties".
- **Tipografía:** Geist Sans + Geist Mono (`app/app/layout.tsx`, vars `--font-geist-sans/mono`); Tailwind `font-sans/mono` ya mapeados.
- **Componentes UI:** shadcn `badge, card, separator, skeleton, tooltip, button, input, table`.
- **Componentes de dominio:** `ProvenanceBadge` (fuente·fecha·enlace), `IdentityMarker` (vínculo no confirmado), `EtapaBadge`, `CamaraChip`, `FichaHeader`, `ParlamentarioHeader`, `TimelineView/Event`, `VotacionBar/Card`, `VotoRow/Detalle`, `SearchBox`, `SearchResultCard`, `IdeaMatrizBlock`, `CuerposLegalesList`, `ProyectosSimilares`, `CitacionCard`, `WeekNav`, `SalaTableSection`, y carriles `Lobby/Patrimonio/Contratos/Financiamiento/Votos -DeParlamentario`, `Contratos/AportesPorContraparte`.
- **UI-SPECs previos** (patrón consolidable): `05/06/07` (v1.0) y `10/11/12/14/15/16` (v2.0) — el vocabulario §x.y ya existe.

### Established Patterns
- Server Components por defecto; islas cliente puntuales (`SearchBox`). Llamadas a fuentes server-only.
- Anchos: `max-w-3xl mx-auto px-4 md:px-8`; padding vertical `py-8 md:py-16` (landing `py-16 md:py-24`).
- Secciones apilables en ficha: `<section className="mt-12">` con `<h2>` + `Suspense` + skeleton shape-matched + empty honesto.
- **Gate MONEY:** `moneyPublicEnabled(process.env)` envuelve la `<section>` entera (heading incluido) → OFF = nodo ausente del HTML; en `/contraparte/[id]` el gate es a nivel de página (`notFound()`).
- Sin score/puntaje nunca (búsqueda ordena por relevancia implícita). Mono para boletín/IDs.
- **AGENTS.md app:** "This is NOT the Next.js you know" — Next 16 con cambios; leer `node_modules/next/dist/docs/` antes de codear (relevante para la fase de implementación, no para el diseño).

### Integration Points
- Tokens nuevos → `globals.css` + `civic-tokens.css` (extender, no romper). Header global → `layout.tsx`.
- El mockup HTML throwaway vive en el dir de la fase (no en `app/`), es desechable.
</code_context>

<specifics>
## Specific Ideas — Estudio visual browseros (LOCKED, alimenta el UI-SPEC)

Screenshots en `./refs/` (home + flujo clave de cada referencia). Veredicto adoptar/adaptar/evitar:

### TributaLab (tributalab.com — el referente más fuerte, misma familia/autor)
> Nota: el apex `tributalab.com` daba Cloudflare 522 (origin down); estudiado en el deploy vivo `tributalab-web.thevalis.workers.dev`.
- **Home** (`refs/tributalab-home.jpg`): fondo **crema/papel**; headline display gigante "Un atlas del derecho tributario chileno. *Sin alucinaciones.*" (acento teal en itálica); **motivo de grafo ambiental** de fondo (nodos = normas/fallos conectados a un nodo central); búsqueda como hero "Escribe una consulta tributaria…" + botón teal "Explorar el atlas"; pills de ejemplo; línea de confianza "■ Fuentes oficiales · ■ Trazabilidad línea por línea · ● Cero respuestas inventadas".
- **Resultados** (`refs/tributalab-resultados.jpg`): barra de búsqueda persistente; banner "**Analizar resultados [IA] · Síntesis IA sobre estas fuentes · la fuente original queda íntegra**"; toggle "Vista general / Mapa de la norma"; header "20 fuentes · 10 centrales · 10 relacionadas · ordenadas por relevancia"; tabs por tipo (Todo/Normas/SII/Jurisprudencia/Doctrina); divisor "CENTRAL" con barra de acento; cards `NORMA` + pill `Vigente` + `CONTEXTO` con texto verbatim; sidebar **"Mapa de fuentes"** mini-grafo shape+count-coded.
- **Veredicto:** **ADOPTAR** — fondo crema, hero display+acento, búsqueda-hero+pills, línea de confianza, IA-con-fuente-íntegra-al-lado, tabs por tipo de fuente, mono para metadata. **ADAPTAR** — el grafo de fondo se DIFIERE en el Observatorio (riesgo insinuación con personas; OK solo normas/documentos en Phase 18). **EVITAR** — nada relevante.

### LegalAtlas (legalatlas.cl)
- **Home** (`refs/legalatlas-home.jpg`): hero centrado minimal, logo ◇, "Busca leyes… en lenguaje natural. Cada resultado enlaza al permalink oficial de la BCN"; search + botón; pills de tipo (Normas/Jurisprudencia/TC/Contraloría/Doctrina/Papers/Autoacordadas); "PRUEBA CON" ejemplos; footer "Por Carlos Sánchez Rossi · Proyecto independiente"; "Beta abierta — todo gratis".
- **Ficha de artículo** (`refs/legalatlas-ficha-articulo.jpg`): breadcrumb; badge `NORMA`; título serif "Artículo 22"; **callout "Resumen IA del estado de la regulación · Generado a partir de la norma y sus anotaciones. La fuente queda íntegra debajo"** con chips `MODELO deepseek-v4-flash · SCOPE closed-book · FUENTES 5 bloques`; layout 2 columnas: norma (izq) / **Anotaciones** (der) con tabs (Todas/Jurisprudencia/TC/Doctrina/Dictámenes), cada anotación con **barra de relevancia %**, badge `RELACIONADO`, tribunal·rol·fecha, extracto, acciones **Ver fuente / Expandir extracto / Copiar APA**.
- **Veredicto:** **ADOPTAR** — el patrón de **resumen IA etiquetado con procedencia** (modelo/scope/fuentes) + "la fuente queda íntegra"; breadcrumb; acciones "Ver fuente"; "Beta abierta" honesto. **ADAPTAR** — barras de relevancia % al Observatorio NO (decisión existente: nunca mostrar score); usar orden implícito. **EVITAR** — porcentaje de coincidencia visible.

### ischilesafe.com (Chile Safety Map)
- **Home** (`refs/ischilesafe-home.jpg`): data-forward; título bold "Is Chile Safe? Official CEAD Crime Data…"; subtítulo "**ranked by reported rate, not editorial opinion**"; search "Find your commune"; dos tablas lado a lado "Lowest/Highest Reported Rate" con columnas Commune/Rate per 100k (con tooltip ?)/National rank/**Trend ↑Rising ↓Declining →Stable** coloreado.
- **Rankings** (`refs/ischilesafe-rankings.jpg`): framing metodológico fuerte "based on reported incidence rates per 100,000… **treat all figures as reported counts, not absolute measures of risk**"; listas por commune/crime type/region; "**Source: CEAD… See Methodology for data definitions and caveats**".
- **Veredicto:** **ADOPTAR** — honestidad metodológica explícita (caveats + "Source · Methodology"), tablas comparativas densas con tooltips de definición, tendencia coloreada literal. **ADAPTAR** — el "ranking" en el Observatorio es delicado: ordenar por hechos neutrales (p.ej. rebeldías observables) sí, pero con caveat anti-juicio y sin convertirlo en "tabla de los peores". **EVITAR** — cualquier framing que se lea como veredicto/acusación.

### Síntesis de DNA común a adoptar
Búsqueda-como-hero · trazabilidad a la fuente como principio visible · IA con la fuente original íntegra al lado y etiquetada (modelo/scope/fuentes) · "cero inventado / not editorial opinion" · densidad de datos con comparación literal + caveats metodológicos · mono para metadata · pills de ejemplo · fondo crema cálido (TributaLab).

### Driver HTTP browseros
`refs/bros.py` — driver mínimo JSON-RPC a `127.0.0.1:9200/mcp` (workaround: el cliente MCP de Claude Code quedó con la lista de tools vieja tras el upgrade del server a v0.0.119; API nueva = `tabs/navigate/snapshot/screenshot/read`). Reutilizable si se necesitan más capturas.
</specifics>

<deferred>
## Deferred Ideas

- **Grafo de influencia (NET)** — Phase 18; el motivo ambiental de grafo en el landing también se difiere.
- **Motivo de grafo ambiental decorativo** — si se quisiera, SOLO de normas/documentos, nunca rostros de personas (riesgo insinuación).
- **Mockups HTML de TODAS las pantallas** (no solo landing) — el usuario eligió 1 mockup HTML (landing) + UI-SPEC por pantalla; HTML de las demás queda como mejora opcional.
- **"Ranking" de parlamentarios por métrica** (estilo ischilesafe lowest/highest) — riesgo de leerse como tabla acusatoria; cualquier ordenamiento debe ser por hecho neutral observable + caveat, evaluar con cuidado fuera de esta fase.
- **Implementación de producción** del brief (header global real, fondo crema en `globals.css`, directorio de parlamentarios) — fase posterior que SIGUE este brief.
</deferred>
