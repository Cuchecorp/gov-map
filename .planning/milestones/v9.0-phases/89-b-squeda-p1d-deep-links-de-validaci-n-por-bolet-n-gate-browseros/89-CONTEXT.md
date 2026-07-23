# Phase 89: BÚSQUEDA P1d — Deep-links de validación por boletín + gate BrowserOS - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador, PROMPT-v9.0)

<domain>
## Phase Boundary

Trazabilidad accionable en la ficha de proyecto: deep-links al punto PRECISO de cada fuente oficial (Senado/Cámara/BCN), fecha de captura visible, y respaldo de snapshot R2 — más el DEPLOY de la pasada 1 completa (87+88+89) y el gate BrowserOS empírico ("valida el dato"). Incluye plumbing de ingesta (persistir `prmID` de Cámara). NO entrega: P2 (personas/agenda), cambios al retrieval.

</domain>

<decisions>
## Implementation Decisions

### Deep-links por fuente (patrones verificados live 2026-07-21, research v9.0)
- **Senado**: `?boletin_ini={boletín-COMPLETO-con-sufijo}` — sin sufijo devuelve lista, no ficha. URL exacta del patrón en research/STACK.md.
- **Cámara**: `tramitacion.aspx?prmID={ID}&prmBOLETIN={boletín}` — REQUIERE persistir `prmID` (plumbing de ingesta, no solo UI). Research debe responder: ¿dónde aparece prmID en los datos ya ingeridos/crudos R2 (doGet.asmx JSON, HTML)? Columna nueva aditiva en `proyecto` (p.ej. `prm_id_camara`) + backfill LOCAL vía dos-etapas (R2 primero; solo tocar fuente si el crudo no lo trae, rate-limit 2-3s + curl-first por WAF).
- **BCN/LeyChile**: `idNorma` — SOLO cuando el dato exista (¿viene en `cuerpos_legales` jsonb?); si no hay idNorma, NO se inventa ni se linkea búsqueda genérica.
- **Fail-honest en todos**: sin dato → sin link (jamás link genérico presentado como preciso). Cada link con etiqueta de fuente clara.
- **Jamás**: rutas `/_next/data/{buildId}`, URLs de sesión, links construidos con IDs adivinados.

### Fecha de captura + snapshot R2 (TRACE-03)
- `fecha_captura` (provenance inline ya existente) visible junto a los links: "según fuente al {fecha}".
- Snapshot R2: el acceso NO puede exponer el bucket crudo (PII cruda vive en R2 por diseño — minimización 21.719). Diseño requerido: resolución de key SERVER-side a partir del boletín (cero input de key del usuario), sirviendo SOLO recursos de tramitación pública (allowlist de prefijos). Research decide con evidencia: (a) ¿existe registro DB/manifiesto de keys de snapshot por boletín?, (b) ¿helper R2 existente en packages? Si NO hay camino seguro y barato → degradación honesta: mostrar fecha + procedencia + hash del snapshot SIN descarga pública, y dejar la descarga como deuda documentada (95/96 la endurecería). La seguridad gana al feature.
- Leyenda anti-causal/honesta: "esto decía la fuente ese día".

### Gate BrowserOS + deploy (cierre de la pasada 1)
- DEPLOY a Cloudflare con el runbook probado (Docker node:22-slim, robocopy a C:/Temp/obs-build, wrangler local OAuth, pnpm 11 dangerouslyAllowAllBuilds). Con el deploy queda LIVE: búsqueda híbrida (flag default ON), filtros island (88) y deep-links (89).
- Gate empírico en deploy real: (1) /buscar con query literal y boletín punteado → encuentra; (2) filtros/orden operables; (3) ficha → deep-links Senado/Cámara abren la página oficial del boletín correcto (HTTP 200 + content-match del boletín en el HTML — validación curl-first para Cámara por WAF); (4) evidencia visual BrowserOS (screenshots desktop + móvil 390px vía iframe same-origin).
- BrowserOS MCP en `http://127.0.0.1:9200/mcp` (wrapper scripts/bros-cli.mjs; save_screenshot en ráfaga tumba el MCP → sleep 8-10s). Si está caído: pedir al operador levantarlo; si no responde, documentar handoff con el resto de evidencia (curl content-match) y cerrar (patrón v7) — JAMÁS fingir capturas.
- Validación empírica de deep-links ADEMÁS por script (curl HTTP 200 + content-match) para una muestra de boletines — reproducible, no solo ojos.

### Ingesta/plumbing
- Dos-etapas LOCKED: si prmID está en el crudo R2 existente → extraer con `--from-r2`, cero requests a fuente. Backfill masivo LOCAL.
- Migración aditiva para la(s) columna(s) nueva(s) (patrón >0044, sin grants); RPC/lecturas: `proyecto` es tabla pública ya servida — el campo nuevo viaja por los reads existentes.

### Claude's Discretion
- Nombre de columna(s) y ubicación exacta del componente UI en la ficha (patrón de la ficha actual — sección fuentes/validación).
- Muestra de boletines para la validación empírica (≥10, incluyendo casos del golden set).
- Si idNorma no existe en datos: documentar y acotar BCN a "cuando exista" sin bloquear la fase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/app/proyecto/[boletin]/page.tsx` — ficha actual (dónde montar la sección de validación; ya muestra fuente/enlace genérico).
- `proyecto.enlace` + `fecha_captura` (0008) — provenance inline ya persistida.
- Conectores Cámara/Senado en packages (tramitacion, agenda) + crudo R2 content-addressed (`fuente/recurso/fecha/sha256`).
- `packages/*/src/*r2*` — cliente S3/R2 existente (@aws-sdk/client-s3).
- Runbook deploy: milestones/v6.0-phases/61-*/61-02-SUMMARY.md; BrowserOS wrapper scripts/bros-cli.mjs.
- research/STACK.md v9.0 — patrones URL exactos verificados live.

### Established Patterns
- Dos-etapas fuente→R2→Supabase con replay `--from-r2`; hash-check antes de descargar.
- curl-first contra camara.cl (WAF bloquea fetch de Node).
- Migraciones psql UTF8 --single-transaction + ledger.
- Server-only reads; jamás fuentes desde el navegador.

### Integration Points
- `proyecto` (boletin PK) — columna prmID nueva.
- `proyecto_ficha.cuerpos_legales` jsonb — ¿trae idNorma?
- Ficha `[boletin]` — sección nueva de validación; /buscar cards podrían linkear la ficha (ya lo hacen).

</code_context>

<specifics>
## Specific Ideas

- TRACE-01 (deep-link preciso por fuente), TRACE-02 (validación empírica HTTP 200 + content-match, jamás buildId), TRACE-03 (fecha captura + snapshot como respaldo).
- El gate BrowserOS de esta fase es criterio de éxito de la PASADA 1 completa (87+88+89 en deploy real), no solo de los deep-links.

</specifics>

<deferred>
## Deferred Ideas

- Descarga pública de snapshots si el diseño seguro no es barato ahora (documentar deuda → 95/96).
- P2 personas/agenda (90-94); seguridad final (95-96).

</deferred>
