# Phase 102: RELACIONES P2b — Similitud de votación (gated legal) - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Añadir el eje "coinciden en N de M votaciones compartidas" que el operador re-pide, con caveat de base-alta OBLIGATORIO y detrás de flag deny-by-default — el dato está listo (283.550 votos confirmados, Phase 98), el encendido es acto humano. Cubre VSIM-01..03: métrica factual pairwise con denominador honesto, gate `VSIM_PUBLIC_ENABLED` fail-closed + guard CI anti-flip + dossier legal, linter anti-insinuación extendido ANTES del copy, y verificación permanente de que `co_votacion` JAMÁS entra a /red. Anti-modelo explícito: DW-NOMINATE (score/ranking/eje ideológico/mapa) PROHIBIDO. El flip a `true` NO ocurre en esta fase.

</domain>

<decisions>
## Implementation Decisions

### Métrica y denominador (VSIM-01)
- "Votación sustantiva" = votaciones de proyectos de ley (con boletín asociado) donde AMBOS parlamentarios registran voto explícito afirmativo/en-contra/abstención; pareos y ausencias EXCLUIDOS del denominador. El criterio SQL exacto se fija en research con evidencia de la DB (283.550 confirmados / 4.852 votaciones — cifras Phase 98).
- Cómputo: RPC pairwise ON-DEMAND para el par A/B de /comparar (bounded, secdef, patrón 0067) — un solo par por request. JAMÁS tabla materializada todos-contra-todos (eso ES la matriz DW-NOMINATE).
- Presentación: "Coinciden en N de M votaciones compartidas (X%)" + caveat base-alta VERBATIM obligatorio adyacente ("la coincidencia alta es la norma, no una señal") + cobertura de voto DECLARADA (Cámara confirmado determinista ~80%, Senado por nombre ~20% — cifras del audit 98).
- Superficie: SOLO /comparar como eje adicional gated — jamás en ficha, jamás en /red, jamás en listados (previene ranking implícito).

### Gate deny-by-default + anti-flip (VSIM-02)
- Flag `VSIM_PUBLIC_ENABLED` leído SOLO vía `vsimPublicEnabled()` en `app/lib/vsim-gate.ts` — espejo byte-a-byte del patrón `money-gate.ts` (`=== "true"` fail-closed).
- Guard CI `vsim-antiflip-guard.test.ts` espejo de `money-antiflip-guard.test.ts`: 3 vectores (nada `=true` committeado; `.env.example` trae `VSIM_PUBLIC_ENABLED=false`; ningún `process.env.VSIM_PUBLIC_ENABLED` crudo fuera del chokepoint) + mutation self-check.
- Dossier legal `docs/legal/102-LEGAL-DOSSIER-VSIM.md` con la métrica, el caveat, el anti-modelo DW-NOMINATE y campo `signoff: pending` — el flip requiere `approved` firmado por humano (patrón dossier 13/17/41).
- Flag OFF ⇒ el eje similitud AUSENTE del DOM por completo (return null server-side) — sin placeholder ni teaser; verificable por BrowserOS "flags OFF ausentes" (E2E-01, Phase 104).

### Linter anti-insinuación + co_votacion (VSIM-03)
- Wave 0 ANTES del copy: idioms vetados "votan juntos", "aliados", "más afín"/"afín a", "tasa de coincidencia" (como ranking), "bloque de votación", "votan parecido"/"votan igual" + variantes con tildes exactas, en superficies VSIM y globales.
- Leyenda del caveat base-alta = constante única exportada VERBATIM (contendrá términos que NIEGA) → restada vía `NEGACIONES_LOCKED` antes del match (patrón LEYENDA_CROSS_LINK/MONEY).
- Mutation self-check: el linter extendido prueba EN MEMORIA que MUERDE con cada idiom nuevo inyectado (patrón 68-01/100-01).
- Test estático PERMANENTE: ningún archivo de /red (`app/app/red/`, componentes NET, schema grafo) contiene `co_votacion`/`covotacion` — verificable en diff y suite, no solo en revisión.

### Integración en /comparar + datos
- Posición: eje 5º al FINAL de /comparar, en sección hermana SEPARADA (mt-12 frontera anti-insinuación) con su propia leyenda — nunca mezclado con los 4 ejes factuales no-voto de Phase 101.
- RPC nueva `coincidencia_votos_par(p_a, p_b)` en migración 0068: secdef, search_path='', statement_timeout '5s', doble-revoke CERO grant, returns agregado del par (n_coinciden, m_compartidas, fecha_captura_max) — NUNCA lista de votaciones individuales en esta RPC. Allowlist Direction-B en Wave 0 (lección 101-02: el allowlist exige la migración escrita).
- Estados degradados: M=0 o cobertura insuficiente → "sin votaciones compartidas suficientes en las fuentes consultadas" (jamás 0% fabricado); asimetría de cobertura Cámara/Senado declarada cuando el par es mixto.
- Preview gated: el eje renderiza con flag ON en entorno local/preview para el cold-read del dossier (patrón MONEY gated-preview) — la fase entrega evidencia DOM del estado ON en local; PROD queda OFF.

### Claude's Discretion
- Definición SQL exacta de "sustantiva" (con evidencia de research sobre los tipos de votación reales en la DB).
- Si el % se muestra redondeado o con decimales; formato exacto del bloque.
- Estructura interna del dossier (siguiendo el molde de 13/17/41).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/money-gate.ts` + `money-gate.test.ts` — patrón chokepoint de flag fail-closed a espejar (también net-gate, cruces-gate, admin-gate).
- `app/lib/money-antiflip-guard.test.ts` — guard CI anti-flip 3 vectores + mutation self-check a espejar para VSIM.
- `app/app/comparar/page.tsx` — la página donde se monta el eje gated (Phase 101; force-dynamic, searchParams primero, intersección 3-estados, `PARLAMENTARIO_ID_RE`).
- `app/lib/anti-insinuacion-guard.test.ts` — SUPERFICIES_RELACIONES ya cubre comparar; extender con idioms VSIM + leyenda en NEGACIONES_LOCKED.
- Migraciones 0064/0067 — molde RPC bounded (secdef, search_path='', statement_timeout '5s', drop-before-create, doble-revoke, pgTAP).
- Datos: `voto` con `estado_vinculo` (confirmado 283.550 / 186 parlamentarios / 4.852 votaciones — Phase 98); votacion↔proyecto por boletín.
- `docs/legal/13-LEGAL-DOSSIER.md`, `41-LEGAL-DOSSIER-CRUCES` — molde de dossier con signoff.

### Established Patterns
- Fail-closed flags: `=== "true"`, default OFF; flip = acto humano exclusivo tras dossier `approved`.
- Wave 0 SIEMPRE: guards + allowlist ANTES de copy/montaje; el allowlist exige migración escrita (Direction-B, lección 101-02).
- PROD DDL por `psql --single-transaction` (nunca db push), pgTAP contra schema aplicado; el agente PUEDE aplicar migraciones aditivas (precedente 0059-0067).
- Secciones hermanas mt-12 = frontera anti-insinuación; leyendas VERBATIM restadas de NEGACIONES_LOCKED.
- Cifras de cobertura salen de audits con queries reproducibles, nunca inventadas.

### Integration Points
- `app/app/comparar/page.tsx` — montaje del eje gated (sección hermana al final).
- `app/lib/vsim-gate.ts` (NUEVO) + `app/lib/vsim-antiflip-guard.test.ts` (NUEVO).
- `app/lib/anti-insinuacion-guard.test.ts` — idioms + leyenda VSIM.
- `supabase/migrations/0068_coincidencia_votos_par.sql` (NUEVO) + pgTAP.
- `PUBLIC_RPC_ALLOWLIST` (lockdown-guard) — entrada `coincidencia_votos_par`.
- `.env.example` — `VSIM_PUBLIC_ENABLED=false`.
- `docs/legal/102-LEGAL-DOSSIER-VSIM.md` (NUEVO).
- Test estático co_votacion ∉ /red (ubicación a discreción, junto a guards).

</code_context>

<specifics>
## Specific Ideas

- El operador pidió explícitamente "si votan parecido" — la respuesta del régimen es "coinciden en N de M" factual con caveat, nunca un score.
- Caveat base-alta obligatorio: "la coincidencia alta es la norma, no una señal" (la mayoría de las votaciones son unánimes o cuasi-unánimes).
- Cobertura asimétrica declarada: el backfill v7.0 sigue pendiente en parte (deuda operador 66/67) — las cifras del denominador deben reflejar solo lo confirmado en DB hoy.
- Evidencia del estado ON (preview local) viaja con el dossier para el cold-read del operador.

</specifics>

<deferred>
## Deferred Ideas

- Flip de `VSIM_PUBLIC_ENABLED` a true — acto humano exclusivo tras sign-off legal (fuera de toda fase de agente).
- Comparativo voto vs mayoría de bancada (VOTOX-01) y votos cruzados (VOTOX-02) — v2, alto riesgo insinuación.
- `co_votacion` como arista de /red — PROHIBIDO permanente.
- Detalle por votación individual del par (lista de en cuáles coinciden) — fuera de alcance de la RPC 0068; evaluar solo tras sign-off y con diseño propio.

</deferred>
