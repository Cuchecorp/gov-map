# Phase 60: BRAND — Ícono/identidad visual gov-map - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Diseño dirigido por Fable (orquestador) — las 3 propuestas las diseña el modelo principal, NO se delegan a ejecutores; la integración técnica sí se delega.

<domain>
## Phase Boundary

Ícono/logo propio de gov-map: 3 propuestas conceptuales distintas (SVG puro), selección del operador, variantes (mono/invertido/favicon), e integración completa (favicon multi-res, apple-touch-icon, og:image, header, manifest). Deploy real = Phase 61 (junto al barrido BrowserOS). BRAND-01 + BRAND-02.

</domain>

<decisions>
## Implementation Decisions

### Dirección de diseño (LOCKED por el pedido del operador)
- Simple, serio, interesante, public-policy oriented. PROHIBIDO: wordmark con fuentes mezcladas estilo-IA, gradientes sintéticos, sombras/glow, mascotas, 3D.
- Geometría plana, un solo color primario: petróleo `hsl(183 38% 26%)` sobre crema `hsl(40 33% 97%)` (tokens existentes del design system). Variante mono = currentColor; invertido = crema sobre petróleo.
- Legible a 16×16 (favicon): máximo ~3 elementos geométricos, sin texto dentro del símbolo.
- El símbolo puede convivir con el nombre "gov-map" en Geist Sans (la tipografía YA es del sitio — un lockup horizontal símbolo+texto para el header), pero el ÍCONO debe funcionar solo.

### Las 3 propuestas conceptuales (diseñadas por Fable)
- **A "Hemiciclo"**: arco de puntos/escaños en semicírculo — parlamento visto desde arriba + puntos de datos. Lectura: el Congreso como conjunto de datos observables.
- **B "Pin-grafo"**: pin de mapa cuyo interior es un mini-grafo (nodos+arista) — "mapa del gobierno", red de relaciones localizada. Lectura literal del nombre gov-map.
- **C "Capas que se cruzan"**: dos planos/romboides superpuestos con intersección marcada — los cruces verificables (lobby×votos×dinero) que son el diferenciador del producto.

### Selección
- AskUserQuestion al operador con las 3 propuestas + preview HTML en `.planning/sketches/60-brand-icons.html` (abre en navegador, muestra cada ícono a 16/32/64/128px, mono/invertido, y lockup de header). La selección y su razón quedan registradas en 60-SELECTION.md.
- Si el operador no responde (corrida desatendida), fallback documentado: se integra la recomendación de Fable dejando las otras 2 en repo para swap de 1 línea.

### Integración (post-selección, delegable)
- `app/`: favicon.ico multi-res (16/32/48) generado desde el SVG, `icon.svg`, `apple-touch-icon.png` (180×180), `og:image` (1200×630 con símbolo + "gov-map" + tagline sobria), header del sitio (lockup símbolo+nombre reemplaza el texto actual), `manifest.json` icons 192/512.
- Generación de PNGs desde SVG: usar sharp/resvg vía script Node one-off (devDep temporal o script), NUNCA borrar el SVG maestro. Los binarios se commitean.
- `pnpm build` del app verde; deploy real en Phase 61.

### Claude's Discretion
- Ajustes finos de geometría/óptica (grid 24×24, stroke vs fill), nombre de archivos, tagline del og:image (sobria, no-causal: p.ej. "Datos públicos del Congreso, con la fuente a la vista").

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Design system: crema/petróleo tokens en `app/app/globals.css` (`--accent-product hsl(183 38% 26%)`), Geist Sans/Mono, DESIGN-SYSTEM.md (v2 19-01).
- Header actual: GlobalHeader server component (nav 5 destinos) — el lockup entra ahí.
- Next.js App Router file conventions: `app/icon.svg`, `app/apple-icon.png`, `app/opengraph-image.png` o metadata explícita.

### Established Patterns
- Sketches throwaway en `.planning/sketches/` (gsd-sketch).
- Build OpenNext = Docker Linux; deploy wrangler local (Phase 61).

### Integration Points
- Phase 61 verifica favicon/OG/header EN VIVO con BrowserOS.

</code_context>

<specifics>
## Specific Ideas
- El operador pidió explícitamente NO el estilo típico hecho-con-IA. La prueba de fuego: ¿parece diseñado por un estudio de diseño cívico sobrio (think: institutos de políticas públicas, periodismo de datos) o por un generador?
</specifics>

<deferred>
## Deferred Ideas
- Sistema de identidad completo (papelería, social kit) — fuera de alcance.
- Dark mode del sitio — el invertido queda listo pero el theme oscuro no se implementa.
</deferred>
