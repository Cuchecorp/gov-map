# Phase 24: LOBBY — Fuente camara.cl/transparencia + spike de estructura - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous — spike live realizado inline)

<domain>
## Phase Boundary

Ampliar la fuente del conector `@obs/lobby` a `camara.cl/transparencia` —la fuente REAL
de las audiencias de parlamentarios, ausentes de `leylobby.gob.cl`— validando primero la
estructura de la página con un spike LIVE antes de cablear el crawl a escala. Phase 24 =
spike + parser + conector. La corrida LIVE a escala + adjudicación de identidad es Phase 25.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Fuente real = `https://www.camara.cl/transparencia/listadodeaudiencias.aspx` (UNA página
  ~12 MB con TODO el dataset; sin paginación; NO `ley_de_lobby.aspx` que es solo un hub).
- Clave natural SINTETIZADA (`CAMARA-<sha256 16 hex>`) — la fuente NO trae id (la columna
  "Detalles" está HTML-comentada).
- `Lugar` NO se persiste (el modelo/0021 no tiene campo lugar; diferido para no abrir migración).
- El nombre del sujeto pasivo se preserva RAW (incl. el caso "Asesor(a) H.D. <diputado>");
  la extracción del H.D. + adjudicación es Phase 25.
</decisions>

<code_context>
## Existing Code Insights

- `@obs/lobby` ya tiene `LeylobbyConnector` + `parseLobbyAudiencias` (leylobby.gob.cl).
- El modelo `LobbyAudiencia`/`LobbyAsistente` (0021) se reusa tal cual; la fuente camara mapea
  asistentes = [Sujeto Pasivo, Lobbista].
- `camara.cl` ya está en el allowlist por defecto de `@obs/ingest` (otros conectores la usan).
</code_context>

<specifics>
## Specific Ideas

- Spike validado end-to-end contra la página real: 17.730 audiencias (dedup de 17.776),
  100% con fecha ISO, 526 sujetos-pasivos distintos, 1.184 filas vía "Asesor H.D.".
</specifics>

<deferred>
## Deferred Ideas

- Persistir `Lugar` (requiere migración a 0021).
- Extracción del diputado real desde "Asesor(a) H.D. <nombre>" → Phase 25 (adjudicación).
- Wiring de la corrida LIVE + writer + ingest-run para la fuente camara → Phase 25.
</deferred>
