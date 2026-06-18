# Phase 6: Citaciones + Tabla Semanal de Sala - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Un ciudadano puede ver la agenda legislativa: TODAS las citaciones de comisiones de Cámara y Senado (núcleo fundamental, cobertura completa) y la tabla semanal de sala (orden del día), con los conectores más frágiles del proyecto (WebForms HTML de Cámara, portal Next.js con `buildId` dinámico del Senado). Cubre TRAM-07 (citaciones Cámara+Senado) y TRAM-08 (tabla semanal de sala). NO incluye búsqueda semántica (Fase 7).
</domain>

<decisions>
## Implementation Decisions

### Fuentes — VALIDADAS EN VIVO 2026-06-18 (concreto, no asumido)
- **Citaciones Cámara — ✅ ASEGURADO:** `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana={AÑO}-{SEMANA_ISO}` → HTTP 200, ~235KB HTML, ~25 comisiones por semana con horario/sala/materia/invitados (parseable con cheerio). El listado anual `citaciones_todas.aspx?prmAnio` da **403 (WAF)** → NO usarlo; en su lugar **enumerar las semanas ISO** (año-semana) nosotros mismos. `citaciones_semana.aspx` por GET no requiere `__VIEWSTATE`.
- **Citaciones Senado — ✅ ASEGURADO:** la página `https://www.senado.cl/actividad-legislativa/comisiones/citaciones` es SSR Next.js; los datos vienen en el JSON `https://www.senado.cl/_next/data/{BUILD_ID}/actividad-legislativa/comisiones/citaciones.json` → HTTP 200, ~143KB, con `MATERIA`/`FECHA`/`HORARIO`/`CITACIONES`/`Comisiones`. El `BUILD_ID` se autodetecta del `<script id="__NEXT_DATA__">` (`buildId`, hoy `4EMldF3oxKIqItY1dHAUe`) y se cachea por día (cambia con cada deploy — NO cachear >1 día).
- **Tabla semanal de sala (orden del día) — ⚠️ NO ASEGURADA TODAVÍA:** `WSSala.asmx` de opendata solo expone sesiones (`retornarSesionesXLegislatura`/`XAnno`/`SesionAsistencia`), NO una tabla/orden del día; el `doGet.asmx getTablaHTML` está obsoleto. El RESEARCH de Fase 6 debe hacer el deep-dive (posibles fuentes: detalle de sesión de la Cámara, sitio HTML `camara.cl/trabajamos/sala...`, orden del día del Senado, o el WS del Senado). **Si NO se asegura una fuente limpia → DEGRADACIÓN HONESTA:** la UI muestra la tabla de sala como "no disponible / fuente no publicada" en vez de inventar. La fase NO se bloquea por esto: las citaciones (lo fundamental) están aseguradas.

### Alcance (énfasis del usuario: "todas las citaciones es fundamental")
- **Cobertura COMPLETA de citaciones**, no solo la semana actual: backfill de todas las semanas disponibles de ambas cámaras (con rate-limit 2-3s, caché diaria, idempotente). El usuario fue explícito: todas las citaciones de Cámara y Senado es must-have.
- Tabla de sala: la(s) sesión(es) de la semana vigente + próxima (cuando la fuente se asegure).

### Stack y UX
- Conectores reusan `@obs/ingest` (Fetcher/rate-limit/robots/allowlist/provenance) — NO `BaseConnector.run`. Cámara: cheerio sobre HTML. Senado: fetch del `_next/data` JSON con autodetección de `buildId` (parsear `__NEXT_DATA__` de la página, cachear buildId del día). Migración nueva para `citacion` (+ `citacion_invitado`?) y `tabla_sala`/`sesion`. RLS public-read para anon (como Fase 5).
- **Frontend `/agenda`** (Next.js 16): vista de la semana (navegable por semana ISO) con las citaciones por comisión (comisión, horario, sala, materia, invitados, cámara chip) + la tabla de sala cuando esté disponible; cada ítem con `ProvenanceBadge` (frescura + enlace a fuente) e identidad de invitados sin afirmar nada dudoso. Tono cívico sobrio, sin causalidad. Reusa el design system de Fase 5 (UI-SPEC).
- **Ingesta LIVE acotada-pero-representativa** en esta fase (varias semanas reales de ambas cámaras en Supabase local con provenance); el backfill completo histórico puede correr como job posterior (mismo conector). Remoto/R2 diferido (credenciales).

### Claude's Discretion
- Esquema fino de tablas, parsing exacto del HTML de Cámara y del JSON del Senado, profundidad del backfill inicial, y la fuente final de la tabla de sala quedan a discreción del research/planner respetando lo anterior. El research valida en vivo y fija la fuente de la tabla de sala o documenta la degradación.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/ingest` (Fase 1): Fetcher (rate-limit/UA/robots/SSRF allowlist — ya incluye camara.cl/senado.cl), R2Store, provenance, cola. `@obs/tramitacion` (Fase 5): patrón de conector+writer idempotente, parsers, migración+RLS public-read, ingest-run/CLI.
- Frontend Next.js 16 + shadcn + design tokens cívicos + ProvenanceBadge/IdentityMarker (Fase 5, UI-SPEC) — reusar.
- cheerio (HTML) y fast-xml-parser ya en el repo.

### Established Patterns
- Conectores reusan primitivas de @obs/ingest, NO BaseConnector.run. Fixtures reales capturados. RLS public-read explícito para anon. ProvenanceBadge por dato.

### Integration Points
- Fase 7 (búsqueda semántica) es independiente. La agenda enlaza a la ficha de proyecto de Fase 5 cuando una citación menciona un boletín.
</code_context>

<specifics>
## Specific Ideas

- "Todas las citaciones de Cámara y Senado" es el corazón fundamental de esta fase (énfasis del usuario) — asegurado en vivo.
- La tabla de sala es secundaria y puede degradarse honestamente si la fuente no se asegura.
- Trazabilidad sobre interpretación: cada ítem con fuente/fecha/enlace.
</specifics>

<deferred>
## Deferred Ideas

- Búsqueda semántica → Fase 7.
- Backfill histórico completo masivo (todas las semanas de todos los años) → job posterior con el mismo conector (esta fase asegura el mecanismo + una cobertura representativa real).
- Deploy remoto + R2 → credenciales.
</deferred>
