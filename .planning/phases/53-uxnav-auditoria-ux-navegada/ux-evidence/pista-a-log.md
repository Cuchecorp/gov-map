# Pista A — log crudo de navegación funcional (BrowserOS directo, ~772px nativo)

**Fecha:** 2026-07-06 · **Sitio:** https://observatorio-congreso.thevalis.workers.dev (versión ee6b7544)
**Mecánica:** `scripts/bros-cli.mjs`, página oculta reutilizada con `navigate_page`. Console con `clear:true` por ruta.

> Este archivo es el insumo crudo del informe `53-UX-AUDIT.md`. Registra console logs, inventario
> de links y estructura de headings por ruta, más las interacciones reales verificadas.

## Baseline de consola (TODAS las rutas)

Cada ruta emite **exactamente 2 warnings idénticos** (nivel `warning`, source `browser`):

```
The resource /_next/static/media/797e433ab948586e-...woff2 was preloaded using link preload
  but not used within a few seconds from the window's load event...
The resource /_next/static/media/caa3a2e1cccd8315-...woff2 was preloaded ... (idéntico, 2ª fuente)
```

- Presentes en `/`, `/buscar`, `/proyecto/*`, `/parlamentarios`, `/parlamentario/*`, `/red`, `/agenda`.
- **Cero errores** (`level:error`) en ninguna ruta. Cero excepciones de app.
- Clasificación: **P2 · ruido de performance** (preload de fuentes no consumido a tiempo). No rompe función, no desorienta. → F54/backlog, NO P0.
- Nota: el research citó "/red console = 0 entradas"; hoy `/red` también emite los 2 woff2 (mismo baseline global). Discrepancia inmaterial (nivel/timing de medición).

## Journey 1 — `/` (landing)

- **Console:** limpio (0, salvo baseline woff2).
- **h1:** "Qué pasó con cada proyecto de ley y cada parlamentario." + subtítulo "Con la fuente a la vista."
- **Affordances (snapshot):** `searchbox "Buscar proyectos de ley"` + `button "Buscar proyectos"` + 4 chips de ejemplo (`protección de datos personales`, `delitos económicos y medio ambiente`, `40 horas / jornada laboral`, `14309-04`) + link "¿Cómo leer esto?".
- **Links salida:** nav (Buscar, Parlamentarios, Agenda, Sobre / Metodología) + footer (Metodología, Contacto, CC BY). NO dead-end.
- **Nav header (inventario literal):** `Buscar · Parlamentarios · Agenda · Sobre / Metodología` — **4 ítems, SIN "Red"**, label 4 largo ("Sobre / Metodología").

## Journey 2 — proyecto por idea → ficha

- **`/buscar` (sin query):** h1 "Buscar proyectos de ley" (visible) + searchbox + prompt "Escribe una idea o un número de boletín…". Console: baseline. Nav "Buscar" activo.
- **Affordance SearchBox:** `fill`+`click` sintético NO navegó (input controlado React no registra value programático — artefacto de tooling, NO bug de sitio). Ruta canónica URL-driven `?q=` verificada OK.
- **`/buscar?q=14309-04`:** el atajo de boletín produce tarjeta de resultado con links `/proyecto/14309-04...` + similares (`18305-04`, `18328-05`). (El tool `links` a11y no capta links envueltos en tarjeta; `search_dom a[href*='/proyecto/']` sí → 9 matches.)
- **`/buscar?q=protección de datos personales`:** **búsqueda semántica funcional** — "Resultados 1–20+" con ~20 tarjetas (18326-18, 18318-19, …). ⚠️ La respuesta llega por streaming del Suspense; tarda **6–9 s** (embed Gemini server-side). Durante ese lapso se ve el **skeleton** (4 tarjetas `aria-hidden`). Lecturas tempranas (<6 s) parecen "vacías" — es artefacto de medición, NO dead-end.
- **`/buscar?q=jornada laboral 40 horas`:** 13 resultados. OK.
- **Empty-state (código `buscar/page.tsx:80-90`):** renderiza "Sin resultados · No se encontraron proyectos para "{q}". Prueba con otras palabras, o ingresa un número de boletín." (verificado en fuente; en vivo aparece tras completar el streaming).
- **`/proyecto/14309-04` (ficha):** Console baseline. **h1 = título del proyecto** ("Establece un sistema de subvenciones para la modalidad educativa de reingreso"). Secciones h2: ¿Dónde está hoy? · Tramitación · Votaciones · Reuniones de lobby registradas en el mismo período · Idea matriz · Cuerpos legales afectados · Proyectos similares.
  - **Links salida:** múltiples "Ver fuente oficial ↗" (provenance), "ver todas" (timeline), "Ver la idea matriz completa", 5 proyectos similares → `/proyecto/*`. NO dead-end.
  - **Cross-links `/parlamentario/*`:** 0 en esta ficha (roll-call sin vínculos `confirmado` enlazables / carril lobby×tramitación texto plano LOCKED). Legal.
  - **Orientación:** NINGÚN ítem del nav queda activo (no existe ítem "Proyectos"; `/proyecto/*` no matchea prefijo). Sin breadcrumb. → **gap de orientación** (remedio contratado: breadcrumb).

## Journey 3 — parlamentario 360

- **`/parlamentarios`:** Console baseline. h1 "Parlamentarios". **186 links** `/parlamentario/*` (directorio poblado). Nav "Parlamentarios" activo.
- **`/parlamentario/D1012`:** Console **limpio** (0). **h1 = "Boris Barrera Moreno"**. h2: Votaciones (141) · Reuniones de lobby (107) · Declaraciones de patrimonio e intereses (10) · Cruces con sectores (12) · Financiamiento y contratos del Estado (pendiente). Sin empty-states (ficha con datos ricos). Link "Ver relaciones" → `/red?seed=D1012` presente.
  - **Orientación:** nav "Parlamentarios" **NO** activo (`/parlamentario/D1012` no matchea prefijo `/parlamentarios`). Sin breadcrumb. → **gap de orientación** (remedio: breadcrumb).
- **`/red?seed=D1012`:** Console baseline. **h1 = "Relaciones entre parlamentarios"**. Grafo presente (HAS-GRAPH, no empty). `main a` = 0 links internos (grafo SVG/canvas + selector), pero header nav presente → no dead-end estricto.
  - **Orientación:** `/red` NO está en el nav → para LLEGAR a `/red` hay que pasar por una ficha de parlamentario (≥2 clicks). → **gap de navegabilidad** (remedio contratado: ítem de nav "Red").

## Journey 4 — transversal

- **`/agenda`:** Console 3 warnings (baseline woff2 + 1 extra inocuo). h1 "Agenda legislativa"; h2 "Citaciones de comisiones", "Tabla de sala". **36 links** `/proyecto/*` (cross-links boletín→ficha OK). Nav "Agenda" activo.
- **`/contraparte/1`:** **HTTP 404** (curl confirmado). Página not-found personalizada: h1 "Contraparte no encontrada" + "No encontramos esta página. Es posible que el identificador sea incorrecto." + link **"Volver al inicio"** + header nav completo. → **GATED** (MONEY gate OFF → `notFound()`), NO P0. Ningún link ciudadano apunta a `/contraparte` (verificado: 0 en fichas).
- **Transversalidad (criterio ≤2 clicks):** el header nav (wordmark→home + 4 ítems) está presente en TODA superficie navegada (home, buscar, fichas, parlamentarios, red, agenda, 404). Desde cualquier página se llega a home/otras secciones en **1 click**. Único punto sin acceso directo desde el nav: `/red` (fix = añadirlo al nav).

## Interacciones reales verificadas

| Acción | Resultado |
|--------|-----------|
| `fill` searchbox + `click` "Buscar" en `/buscar` | Ejecutó (typed 19 chars, click), pero NO navegó (input controlado React; artefacto sintético). Ruta URL-driven es la reproducible. |
| `navigate_page url` a las 8 rutas de los 4 journeys | OK, contenido real por ruta. |
| `curl` `/contraparte/1` | 404 (gate MONEY OFF). |

## Notas de mecánica (para la Wave 3 / re-walkthrough)

- El tool `get_page_links` (árbol a11y) NO capta links envueltos en tarjeta grande; usar `search_dom "a[href*='...']"` para inventario fiable de cross-links.
- La página oculta puede perderse ante un hiccup del MCP (`fetch failed` → `Unknown page N`): reabrir y continuar.
- `fill`/`click` usan el parámetro `element` (no `elementId`).
