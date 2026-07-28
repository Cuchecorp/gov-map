# Phase 115: LINK-EXT — Patrones de link a fuente oficial - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador en PROMPT-v12.0)

<domain>
## Phase Boundary

Validar todo enlace a fuente oficial que el sitio genera SIN martillar los servidores gubernamentales: por construcción del patrón (plantilla + dato que lo parametriza: boletín, prmID, idNorma, id audiencia) + muestra live estratificada ≥1 caso por patrón×host. Universo = §3.1/§3.2/§3.3 del inventario 113. Patrón malo (defecto nuestro) se arregla en código; fuente caída/WAF se declara con evidencia, jamás se evade. Deploy de fixes viaja con 125.

</domain>

<decisions>
## Implementation Decisions

### Universo de patrones
- Patrones = los 4 builders del inventario §3.2 (buildSenadoUrl, buildCamaraUrl, enlaceHumanoProyecto, partidoLegible) + las familias de URL-desde-columna de §3.3 que SE EMITEN al DOM (34 columnas / 8 hosts descubiertos por information_schema)
- EXCLUIDOS con razón declarada: `lobby_contraparte.enlace` (17.681 filas, no se emite al DOM), `source_snapshot.source_url` (4.383, no se emite), columnas bajo gate MONEY (vacías en PROD, call-sites gated)
- Casos de muestra elegidos con datos reales de PROD (query verbatim por caso, ORDER BY determinista); ≥1 caso por patrón×host
- JAMÁS crawl exhaustivo — decisión operador 2026-07-27 verbatim (patrón + muestra estratificada)

### Probing live
- curl-first SIEMPRE (gotcha pagado: WAF camara.cl bloquea Node fetch; curl OK); GET con límite de bytes/`--max-time`, no HEAD (servers gubernamentales lo rechazan a veces)
- Rate-limit 2-3s POR HOST, User-Agent identificatorio, robots.txt de cada host chequeado ANTES de la muestra (y registrado)
- Fuente caída / WAF / 403: se DECLARA con evidencia (comando + respuesta), jamás se evade, jamás reintentos agresivos
- Corrida reproducible: script + salida guardada como artefacto de fase
- Gotcha buildId Senado: si algún patrón toca el portal Next.js del Senado, JAMÁS hardcodear `/_next/data/<buildId>/` — leer `__NEXT_DATA__.buildId` de la página (o evitar rutas de datos)

### Fixes
- Candidatos ya detectados por 113/114 (verificar y arreglar): (1) `/buscar` pasa `proyecto.enlace` crudo al badge — 3.658/3.659 filas apuntan a `tramitacion.senado.cl/wspublico/...` (XML crudo para humanos) sin pasar por `enlaceHumanoProyecto`; (2) `tramitacion_evento.enlace` en timeline (B5 de §4.2, E-038 timeline-event.tsx:42) — 982 filas al mismo host XML
- Patrón malo NUESTRO → fix en código reutilizando `enlaceHumanoProyecto` (transformación existente); deploy DIFERIDO a 125
- Patrón sin fix posible (el recurso oficial no tiene URL humana) → limitación declarada honestamente en la UI, sin causalidad, linter anti-insinuación verde (extensión ANTES del copy si toca vocabulario nuevo)
- Suite baseline (app 1431 / packages 1535+176) + tsc 0 + guards verdes tras fixes

### Claude's Discretion
- Formato del artefacto de patrones (tabla patrón×host×plantilla×parámetro×caso×respuesta)
- Orden de la muestra y agrupación por host para respetar el rate-limit

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `113-INVENTARIO.md` §3.1 (17 call-sites sourceUrl), §3.2 (4 builders verbatim), §3.3 (34 columnas URL / 8 hosts con conteos)
- `app/lib/format.ts` — `enlaceHumanoProyecto` (rewrite wspublico→página humana del Senado)
- `scripts/verificar-links-internos.mjs` — molde de runner (UA, delay, salida guardada); OJO: para externos usar curl, no fetch
- Precedente v3.0: WAF camara.cl bloquea Node fetch → curl OK

### Established Patterns
- Evidencia: comando + salida guardada; queries PROD verbatim con ORDER BY determinista
- prmID Cámara PERSISTIDO en DB (v9.0: prmID 2549/3659) — no re-derivar

### Integration Points
- Fixes de UI viajan al deploy con 125; re-verificación de muestra externa en 125 (rate-limit)

</code_context>

<specifics>
## Specific Ideas

- Success criteria ROADMAP: patrones enumerados con fuente/plantilla/parámetro + probados por construcción con casos reales; muestra live ≥1 por patrón×host registrada con rate-limit/UA/robots; roto o genérico corregido o declarado; distinguir patrón-malo vs fuente-caída
- Hosts conocidos de §3.3: tramitacion.senado.cl, senado.cl, camara.cl, opendata.camara.cl, bcn.cl/leychile, leylobby.gob.cl, y otros (~8)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
