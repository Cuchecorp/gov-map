# Phase 100: PANEL P1c — Landing panel + benchmark senado/camara + gate BrowserOS - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning
**Mode:** Autonomous (frontend — decisions locked by ROADMAP + 98/99)

<domain>
## Phase Boundary

Reemplazar el bento producto-céntrico de la landing (`app/page.tsx`) por un PANEL de actualidad ("qué está pasando HOY en el Congreso") que lee las señales precomputadas de `actualidad_senal` (Phase 99) vía la RPC bounded `actualidad_senales_panel`, reusando BentoGrid/BentoTile/tokens y conservando TODOS los candados de régimen. Incluye: extender el linter home a `SUPERFICIES_PANEL` ANTES del copy nuevo, benchmark empírico BrowserOS de senado.cl/camara.cl (qué evitar/qué superar) con iteración diseño→crítica→loop, y el gate BrowserOS de lectura fría sobre el DEPLOY real (comprensible para periodista/tramitador/ciudadano).

NO cambia la URL de la home (SEO/anchors intactos). NO agrega agregación cara on-read (lee precomputado). NO enciende flags. NO toca el copy hero LOCKED sin autorización del operador.

</domain>

<decisions>
## Implementation Decisions

### Contenido del panel (del 99 materializado — LOCKED)
- Señales SEN validadas y ya materializadas: velocity ("N trámites en 7 días", NUNCA "top/los más" — T-52-13), urgencias vivas (fechadas), agenda próxima (citaciones futuras), agenda_sala (suprimida cuando no hay), archivados/retirados, agrupación por materia. Cada tile lee de la RPC bounded.
- Cada señal ya trae `cobertura_camara`, `supresion_causa`, `fecha_max`, `ventana`, `conteo` — el panel las MUESTRA, no recomputa.
- `agrupacion_materia` puede venir con label `(sin materia)` (proyecto.materia NULL en PROD — degradación honesta documentada en 99); el panel DEBE tolerarlo sin romper ni fabricar.

### Honestidad en UI (LOCKED, riesgo existencial #1)
- Cada tile/señal lleva fuente + fecha + estado vacío honesto: "en las fuentes consultadas al [fecha]". JAMÁS "sin movimiento" sin scrape.
- Señal con `supresion_causa` → renderiza la causa ("sin datos frescos de esta fuente" / "sin sesiones agendadas…"), NO una lista vacía ni un 0 mudo.
- Cobertura/sesgo por cámara declarado; PROHIBIDO ranking cross-cámara por conteo (T-52-13). Framing factual, cero insinuación de intención/causalidad.

### Candados de régimen (LOCKED — guards como contrato)
- Extender el linter home a `SUPERFICIES_PANEL` como PRIMER commit, ANTES de cualquier copy nuevo (Pitfall #6 + #3).
- cero-hex (tokens hsl() horneados), whitelist tipográfica, Tailwind v4 `[var(--t)]` obligatorio (bare `-[--var]` inválido, reaparecido 3×), `force-dynamic` en la home (sin él se hornea estática → 500).
- Copy hero LOCKED byte-idéntico salvo autorización explícita del operador (el operador ANULÓ cambios de copy antes — v8.1 D1). El panel reemplaza el CUERPO producto-céntrico, no necesariamente el hero.
- anti-insinuación: linter verde con vocabulario nuevo del panel ("último momento", "revivido", "exprés", "madrugada" NUNCA); extensión del denylist ANTES del copy.
- CSP ENFORCED: si el panel necesita un origen nuevo en connect-src (no debería — lee de Supabase server-side), ajuste MÍNIMO documentado; jamás quitar frame-ancestors/object-src.

### Benchmark + gate BrowserOS (LOCKED — criterios de éxito, no opcionales)
- Benchmark BrowserOS documentado de senado.cl y camara.cl (portada/actualidad/tablas ASP.NET densas): qué EVITAR (tablas densas, editorial) y qué SUPERAR. Iteración diseño→crítica→loop contra ese benchmark.
- Gate BrowserOS de lectura fría sobre el DEPLOY real (no local): veredicto "comprensible" para periodista/tramitador/ciudadano; candados verificados por getComputedStyle en el deploy. Si el MCP BrowserOS está caído, el orquestador (tiene MCP) cierra el gate.

### Arquitectura de datos (LOCKED)
- La home lee `actualidad_senal` vía la RPC bounded server-side (service_role, Camino A) — cero agregación on-read. Reusar el patrón de lectura de `actualidad-module.tsx` (los 3 tiles votado/urgencias/frescura son el germen).
- La URL de la home NO cambia; anchors/section[id] intactos (gotcha v8.0: scroll-margin en section[id]).

### Claude's Discretion
Layout fino del panel (nº de tiles, orden, responsive 390px), copy factual exacto (dentro del linter), cómo agrupar señales en el BentoGrid, estados de carga. Preferir reusar BentoGrid/BentoTile y los tokens existentes; el diseño lo valida el loop BrowserOS contra el benchmark.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/page.tsx` (landing bento actual) — se MODIFICA, se conserva estructura de candados.
- BentoGrid / BentoTile (primitivas v8.0) + tokens civic hsl() horneados.
- `actualidad-module.tsx` (3 tiles votado/urgencias/frescura) = germen a ampliar.
- RPC `actualidad_senales_panel(p_tipo)` (Phase 99) + tabla `actualidad_senal` con todas las columnas de cobertura/supresión.
- Linter home / anti-insinuación (201+ términos) + guard bento — se EXTIENDEN (SUPERFICIES_PANEL).
- Lectura server-side service_role (Camino A) patrón de las superficies existentes.
- Lógica tz Chile de `/agenda`.

### Established Patterns
- Deploy: OpenNext Docker node:22-slim, robocopy C:/Temp, wrangler global. Gate BrowserOS sobre workers.dev.
- Suite: app 1252 + packages + tsc + audit 0 verdes al cierre.
- BrowserOS: MCP 127.0.0.1:9200, wrapper scripts/bros-cli.mjs, sleep 8-10s entre screenshots, evaluate_script usa expression, click usa element.

### Integration Points
- `app/page.tsx` (home, URL raíz sin cambio) lee la RPC de Phase 99.
- PROD: https://observatorio-congreso.thevalis.workers.dev (v9.0 09f1d5c2 + fase 97 deploy 3952f9bc).

</code_context>

<specifics>
## Specific Ideas

- 4 success criteria del ROADMAP son el contrato; el gate BrowserOS de lectura fría (#4) y el benchmark (#3) son criterios de éxito, no opcionales.
- Requisitos: PANEL-01 (panel reemplaza bento + candados + SUPERFICIES_PANEL), PANEL-02 (fuente+fecha+estado vacío honesto + precomputado + URL intacta), PANEL-03 (benchmark), PANEL-04 (gate lectura fría deploy real).

</specifics>

<deferred>
## Deferred Ideas

- Similitud de voto / relaciones → Phases 101/102 (pasada 2).
- Notificaciones/suscripciones → Phase 103 (pasada 3).
- Leyes publicadas → SEN-06 futuro.

</deferred>
