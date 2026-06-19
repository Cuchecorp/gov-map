# Phase 11: INT Lobby — Reuniones de lobby + sub-maestra de contrapartes - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

El ciudadano ve las reuniones de lobby de un parlamentario (Ley del Lobby, leylobby.gob.cl) con la contraparte trazable a la fuente. Primera sección multi-dataset de la ficha → fija las reglas anti-insinuación para todo el frente parlamentario. Entrega: conector `@obs/lobby` + sub-maestra de contrapartes (lobistas/gestores) + sección de lobby en `/parlamentario/[id]`. NO toca patrimonio/intereses (Phase 12), dinero (14-16) ni grafo (18).

</domain>

<decisions>
## Implementation Decisions

### INT Lobby
- **Acceso a leylobby.gob.cl (research-gated):** bulk CSV/descarga masiva preferente (research v2.0 vio 503 → re-validar la ruta y estructura del archivo en el research de fase); fallback `cheerio` sobre HTML por-registro. Reusa `@obs/ingest` en el orden LOCKED (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get; `leylobby.gob.cl` ya en la allowlist v1.0). Provenance por fila.
- **Sub-maestra de contrapartes:** tabla propia (lobistas/gestores de interés), construida EN ESTE BLOQUE (no diferida a NET). Keyed por el id estable de leylobby si existe; si no, por nombre normalizado (reusa `normalizarNombre`). La contraparte se muestra como TEXTO CRUDO; solo se enlaza a una identidad si está confirmada.
- **Enlace reunión→parlamentario:** solo con match `determinista`/`confirmado` vía `correrPipeline` (el parlamentario "audiencia/sujeto pasivo" cruza contra la maestra); cada decisión deja una fila en `identidad_audit`. El FK se fija vía el invariante tipado `EnlaceConfirmado` (Phase 9). `probable`/`revision`/`no_confirmado` → NULL + mención cruda + IdentityMarker.
- **Regla anti-insinuación (UI, LOCKED para todo el frente):** la sección de lobby vive en su propio carril en `/parlamentario/[id]`; NINGUNA unidad de UI compone una reunión de lobby junto a un voto (u otro dataset) como una sola unidad destacada. Sin lenguaje causal/afinidad. Cada fila con fuente/fecha/enlace (ProvenanceBadge).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/ingest` — política LOCKED; `leylobby.gob.cl` ya allowlisted (research ARCHITECTURE).
- `@obs/agenda` (v1.0) — patrón de conector + writer idempotente + modelo zod por fila; espejo cercano (citaciones también son "quién se reúne"). Reusar su estructura.
- `@obs/adjudication` `correrPipeline` + `identidad_audit` inmutable; `@obs/identity` `EnlaceConfirmado` + `normalizarNombre`.
- Piso RLS/PII de Phase 9 (migración 0018 convención deny-by-default) — la tabla de reuniones y la sub-maestra reusan la convención; columnas sensibles ocultas a anon.
- Ficha `/parlamentario/[id]` (Phase 10) con shell apilable — agregar una `<section>` de lobby; design system v1.0 (ProvenanceBadge, IdentityMarker, CamaraChip).
- `cheerio@1.2.0` (ya instalado) / `fast-xml-parser` / CSV parsing.

### Established Patterns
- Conectores reusan `@obs/ingest` (NO BaseConnector.run); writer idempotente por clave natural; corrida LIVE acotada; degrada honesto (no fabrica filas).
- Server Components, anon, RLS public-read en lo público; PII oculta a anon.
- Migración numerada (última 0020); aplicación al remoto es paso de operador (remoto alcanzable, .env BOM Pitfall 5).

### Integration Points
- Nueva migración (≥0021): tabla `lobby_audiencia` (o similar) + sub-maestra `lobby_contraparte`, con RLS (público lo no-sensible, deny-by-default lo sensible).
- Nueva `<section>` en `/parlamentario/[id]`.
- Cruce del parlamentario sujeto-pasivo vía `correrPipeline`.

</code_context>

<specifics>
## Specific Ideas

- Esta fase establece el PATRÓN de sección multi-dataset que Phase 12/14-16 reusan: carril propio, sin composición cruzada, provenance siempre visible.
- La contraparte (lobista/empresa) es un tercero privado → texto crudo, sin enlazar a una persona salvo identidad confirmada; sin exponer RUT de terceros.
- Corrida LIVE acotada; si leylobby no es alcanzable en el entorno, degradar a fixture + documentar como human_verification, sin fabricar reuniones.

</specifics>

<deferred>
## Deferred Ideas

- Patrimonio/intereses (InfoProbidad) → Phase 12.
- Dinero (SERVEL/ChileCompra) → Phases 14-16.
- Grafo NET (las aristas lobby↔parlamentario alimentan NET, pero el grafo se construye en Phase 18).
- Cruces inter-bloque (lobby junto a voto/dinero) → diferido por regla anti-insinuación + legal.

</deferred>
