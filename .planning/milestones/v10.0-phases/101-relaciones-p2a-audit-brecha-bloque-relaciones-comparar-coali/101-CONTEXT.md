# Phase 101: RELACIONES P2a — Audit brecha + bloque relaciones + /comparar + coalición empírica - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Sacar a la superficie las relaciones entre parlamentarios que YA existen en datos pero están enterradas, y añadir la comparación 1-a-1 que falta — todo factual, orden alfabético, jamás ranking. Cubre REL-01..REL-05: audit de brecha N/M, bloque "Relaciones con otros parlamentarios" above-the-fold en la ficha, página `/comparar` con ejes factuales NO-voto, relaciones nuevas derivadas de datos existentes (militancia histórica compartida, lobby misma contraparte condicionado), y evaluación empírica de coalición/pacto (Servel pactos / comités Senado). La similitud de votación NO entra aquí (Phase 102). Regla rectora LOCKED: todo dato con fuente+fecha, ausencia declarada, anti-insinuación extendido ANTES de todo copy nuevo, jamás score/ranking/eje ideológico.

</domain>

<decisions>
## Implementation Decisions

### Audit de brecha (REL-01)
- Formato: documento `.planning/phases/101-*/101-AUDIT-RELACIONES.md` con matriz N/M por relación (dato-disponible vs superficie-mostrada) y queries psql verbatim reproducibles — espejo del patrón 93-AUDITORIA-CITACIONES.
- Alcance: las 6+1 relaciones — partido, zona, comisiones, co-autoría (0061 existentes) + militancia histórica compartida + lobby misma contraparte (candidatas REL-04) + fila coalición (REL-05).
- Mide dato Y superficie: además de conteos SQL, el audit registra dónde/cómo se muestra hoy cada relación (posición real en la ficha, /red NET OFF con una sola arista) — como 93-02 midió wiring con evidencia.
- El audit GATEA el diseño: corre como Plan 01; sus N/M alimentan el copy de cobertura declarada de los planes UI posteriores.

### Bloque relaciones en la ficha (REL-02)
- Des-enterrar por composición, no rediseño: envolver los 4 bloques CrossLinkBloque existentes en una `<section id="relaciones">` con heading "Relaciones con otros parlamentarios", reubicada inmediatamente después del header/bio (above-the-fold). La lógica interna de CrossLinkBloque queda INTACTA (leyenda LOCKED, orden neutral, total_n honesto, límite visual 8, WR-01/02/05).
- Layout interno: grid 2×2 responsive (1 col móvil) de los 4 ejes — compacto; cada eje conserva su leyenda y conteo.
- Leyenda de grupo: una leyenda factual a nivel de sección (1×, reusa/complementa LEYENDA_CROSS_LINK) + cada bloque conserva la suya. Linter anti-insinuación extendido ANTES del copy nuevo (patrón Wave 0 de Phase 100).
- Ancla `#relaciones` deep-linkable + entrada en la navegación interna de la ficha si existe patrón.

### /comparar (REL-03)
- URL: `/comparar?a=<id>&b=<id>` con orden canónico alfabético para URL estable; sin params → selector vacío. Evita rutas dinámicas dobles.
- Selección: dos selectores server-friendly reutilizando el directorio existente (`parlamentarios_publico_v2`) con búsqueda por nombre; enlace "Comparar con…" desde la ficha pre-llena el slot A.
- Ejes y canal de datos: 4 ejes factuales no-voto — militancia (histórica completa, no solo vigente), comisiones compartidas, co-autoría (proyectos en común con enlace), zona. Leer RPCs existentes (militancias, comisiones, coautores) server-side y computar la intersección en el server; RPC nueva SOLO si la intersección no sale de las existentes.
- Render: tabla lado-a-lado A/B por eje con la intersección destacada factualmente ("comparten N comisiones: X, Y"), cada dato con fuente+fecha, vacíos honestos, orden alfabético, cero ranking/score.

### Relaciones nuevas + coalición (REL-04/REL-05)
- Militancia histórica compartida: RPC nueva `militancia_historica_compartida` sobre `parlamentario_militancia` siguiendo el patrón 0061 (security definer, search_path='', total_n, orden alfabético, doble-revoke CERO grant, PUBLIC_RPC_ALLOWLIST, pgTAP). Se muestra en `/comparar` y como 5º bloque en la ficha SOLO si el audit muestra datos con sustancia (48+315 militancias conocidas).
- Lobby misma contraparte: CONDICIONADO al audit (Plan 01). Si las `contraparte_id` confirmadas sostienen intersecciones con N razonable → RPC espejo con framing factual "audiencias registradas con la misma contraparte" + cobertura declarada (solo 5.106 audiencias confirmadas). Si el dato es ralo → DIFERIDA documentada en el audit.
- Coalición (REL-05): probe empírico DENTRO de la fase (curl/BrowserOS) sobre Servel pactos electorales + comités del Senado. Criterio de viabilidad: fuente oficial estable + machable por nombre determinista. Si viable → ingesta dos-etapas R2 mínima (crudo primero, parse desde R2). Si no → DIFERIDA documentada con evidencia en el audit. JAMÁS inferida desde votos.
- Superficie de coalición si viable: dato factual en la ficha (chip/campo junto a partido, con fuente+fecha) y eje en /comparar — sin mapa/agrupación visual de bloques.

### Claude's Discretion
- Detalles de estilo del grid y breakpoints (dentro de tokens/candados de régimen existentes: cero-hex, tipografía var(--text-*)).
- Nombre exacto de archivos/componentes nuevos siguiendo convención existente.
- Si la intersección de co-autoría pairwise exige RPC nueva o sale de `coautores_de_parlamentario` — decidir en research/plan con evidencia.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/components/cross-links-parlamentario.tsx` — CrossLinkBloque presentacional puro con LEYENDA_CROSS_LINK exportada (restada en NEGACIONES_LOCKED), límite visual 8, conteo honesto totalN, truncamiento declarado (WR-01/02), sin partido por fila (WR-05).
- Montaje actual: `app/app/parlamentario/[id]/page.tsx:284-293` — CrossLinkCopartidarios/MismaZona/CoComisionados/Coautores, cada uno con reader cacheado `crossLinkReader(rpc)`.
- RPCs 0061 en PROD: `copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario`, `coautores_de_parlamentario` (todas con total_n, orden neutral, bounded, doble-revoke).
- RPCs 0060 en PROD: `parlamentarios_publico_v2` (directorio con partido), `militancias_de_parlamentario`, `comisiones_de_parlamentario` (Phase 91 — 8 RPCs PII-safe).
- Tablas: `parlamentario_militancia` (315 dip + 48 sen), `comision`/`comision_membresia` (34 comisiones, 386 membresías), `proyecto_autor`, `lobby_audiencia` (5.106 confirmadas con contraparte).
- Linter anti-insinuación (`app/lib/anti-insinuacion-guard.test.ts`) con SUPERFICIES_* por dominio + NEGACIONES_LOCKED + mutation self-check — patrón para extender ANTES del copy.
- Patrón migración RPC segura: 0061/0064 (secdef, search_path='', statement_timeout 5s, LIMIT bounded, drop-before-create, doble-revoke, CERO grant, pgTAP).

### Established Patterns
- Server Components leen Supabase vía service_role + RPCs allowlisted (`PUBLIC_RPC_ALLOWLIST`); jamás fetch cliente.
- Migraciones a PROD por `psql --single-transaction` (nunca db push), PGCLIENTENCODING=UTF8, pgTAP contra schema aplicado.
- Ingesta dos-etapas LOCKED: fuente→R2 crudo content-addressed primero, R2→Supabase después; rate-limit 2-3s; WAF camara.cl exige curl/headers navegador.
- Copy/UI: candados de régimen (cero-hex, tokens tipográficos, orden alfabético anti-ranking T-52-13, leyendas factuales VERBATIM, secciones hermanas mt-12 anti-insinuación).
- Deploy: OpenNext Docker Linux + wrangler OAuth; gate BrowserOS sobre deploy real.

### Integration Points
- `app/app/parlamentario/[id]/page.tsx` — reubicación del bloque relaciones (los 4 componentes ya montados, moverlos + envolverlos).
- `app/app/comparar/` — ruta nueva (App Router, server component, force-dynamic si usa searchParams — gotcha Phase 45: notFound pre-searchParams hornea estático).
- `app/lib/anti-insinuacion-guard.test.ts` — SUPERFICIES nuevas (comparar + sección relaciones) ANTES del copy.
- `supabase/migrations/00XX_militancia_historica_compartida.sql` — si el audit la sostiene.
- `PUBLIC_RPC_ALLOWLIST` — RPCs nuevas allowlisted (guard Direction-B).

</code_context>

<specifics>
## Specific Ideas

- Brief del operador (2026-07-23): relaciones EXHAUSTIVAS (partido, coalición, comisiones, co-autoría) con base empírica; benchmark diseño→crítica→loop.
- "Comparar con…" desde la ficha pre-llena el slot A de /comparar.
- Cobertura declarada SIEMPRE: cada relación nueva declara su N/M del audit en el copy (patrón "en las fuentes consultadas al [fecha]").
- Anti-modelo explícito: nada estilo DW-NOMINATE, ni siquiera como easter egg — el bloqueo es de régimen, no estético.

</specifics>

<deferred>
## Deferred Ideas

- Similitud de votación pairwise → Phase 102 (gated legal, VSIM-01..03).
- `co_votacion` como arista de /red → PROHIBIDO permanente (explosión de clique + insinuación espacial).
- Coalición si el probe REL-05 concluye no-viable → queda con ruta de ingesta documentada (Future Requirements).

</deferred>
