# Phase 92: PERSONAS P2c — Lobby legible + audiencia→PL fail-closed - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommendations auto-accepted per run directive)

<domain>
## Phase Boundary

Hacer LEGIBLE el lobby (la materia ya está ENTERA en DB — `lobby_audiencia.materia` verbatim; la falla es presentacional) y enlazar audiencia→PL SOLO por evidencia dura (mención explícita de número de boletín en la materia), con leyenda anti-causal y navegación bidireccional audiencia↔PL↔parlamentario. Requirements: LOB-01, LOB-02, LOB-03.

REGLA LOCKED: NUNCA regex de keywords/tema ni "coincidencia temática" afirmada — solo el patrón determinista de número de boletín cuenta como mención explícita. El cruce TEMPORAL existente (0048 lobby_en_tramitacion, misma semana ISO) es OTRA cosa y no se toca: la sección nueva es de MENCIÓN EXPLÍCITA, separada y rotulada distinto.

</domain>

<decisions>
## Implementation Decisions

### Materia legible (falla presentacional)
- La materia COMPLETA de cada audiencia visible y legible en la ficha del parlamentario, en AMBAS vistas (agrupada por contraparte y cronológica) — sin truncado CSS ni line-clamp que oculte texto; tipografía del design system (var(--text-*)), whitespace respetado.
- El dato NO se re-ingiere ni transforma: `lobby_audiencia.materia` se muestra verbatim (raw de la fuente).

### Audiencia→PL fail-closed (mención explícita)
- Criterio ÚNICO de enlace: la materia contiene un número de boletín según el patrón determinista de boletín (formatos `12345-06`, `12345`, `12.345-06` — espejo del detector de Phase 86/89, incluida la regla de separador de miles válido vs decimal). JAMÁS keywords, tema, o similitud.
- Fail-closed doble: (1) el patrón debe matchear estrictamente; (2) el boletín extraído debe EXISTIR en la tabla `proyecto` — si no existe, NO se emite link (mención se ignora, no se fabrica).
- Pueden mencionarse VARIOS boletines en una materia → todos los válidos se enlazan.

### Superficies y navegación bidireccional
- **Ficha parlamentario (lobby section):** cada audiencia cuya materia menciona boletín(es) válido(s) muestra chip/link "Menciona boletín N" → /proyecto/N. En ambas vistas.
- **Ficha proyecto:** sección nueva "Audiencias de lobby que mencionan este boletín" (RPC nueva bounded) con: fecha, parlamentario (link a ficha), contraparte, materia completa, enlace fuente. SEPARADA de la sección temporal 0048 existente ("Lobby del período") y rotulada de forma distinta para que no se confundan.
- **Leyenda anti-causal LOCKED (ambas superficies):** la mención del boletín en la materia de la audiencia es un hecho del registro público (Ley 20.730); no implica influencia en la tramitación ni relación causal. OJO: verificar contra TERMINOS_PROHIBIDOS del linter — si la leyenda contiene un término prohibido negado, va a NEGACIONES_LOCKED ANTES de añadir superficies al scan (lección del BLOCKER de 91).
- Navegación: audiencia→PL (chips), PL→audiencias (sección), audiencia→parlamentario (ya existe), parlamentario→PL vía chips.

### Implementación (canal de datos)
- Migración 0062: RPC(s) security-definer PII-safe `set search_path=''`, patrón doble-revoke 0055/0060 verbatim, LIMIT bounded, cero grant anon:
  - `lobby_menciones_de_boletin(p_boletin)` — audiencias cuya materia menciona el boletín (para ficha proyecto). Emite: identificador, fecha, materia, parlamentario_id + nombre público, contraparte(s) crudas si el patrón existente lo hace (espejo lobby_de_parlamentario — sin contraparte_id/RUT), enlace_detalle, provenance. Solo audiencias `estado_vinculo='confirmado'` con parlamentario_id (fail-closed identidad, espejo 0048).
  - Para la ficha del parlamentario: decidir en plan si el chip se calcula client/server-side sobre las filas que YA devuelve `lobby_de_parlamentario` (la materia viaja — extraer boletines en el server component y validar existencia vía UNA query batched a `proyecto`... OJO Block-B: el árbol público no puede .from() PII; `proyecto` NO es PII y ya se lee — verificar el patrón real del repo) o si se amplía la RPC. Elegir lo MENOS invasivo que respete Block-B y el cap 1k.
- El regex SQL de boletín en 0062 debe espejar el detector TS (mismos formatos, misma exclusión de decimales) y documentar la equivalencia (guard de equivalencia como WR-03 de 86 si es barato).
- pgTAP 0062 (deny/bounded/columnas), allowlist actualizado, apply a PROD por psql --single-transaction (precedente 0059/0060/0061).

### Operación
- Deploy Cloudflare al cierre (arrastra además los fixes UI de 91 que quedaron fuera del bundle e0c969af) + verificación BrowserOS: materia completa visible, chips de mención operando, sección en ficha proyecto con leyenda.
- Suite verde por plan; linter anti-insinuación extendido a las superficies nuevas con mutation self-check.

### Claude's Discretion
- Nombre exacto de RPCs y forma del regex SQL.
- Diseño del chip "Menciona boletín N" (consistente con chips existentes).
- Si el guard de equivalencia TS↔SQL del patrón de boletín es un test aparte o parte del pgTAP.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lobby_audiencia` (0021:30-49): materia raw completa; `lobby_de_parlamentario` RPC (0021:105-125) emite materia+contraparte cruda; `lobby_en_tramitacion` (0048, cruce TEMPORAL semana ISO — NO tocar).
- `app/components/lobby-de-parlamentario.tsx`: vistas agrupada/cronológica, caveat B11; leyendas anti-causal plantilla (:14-46).
- Detector de boletín TS: `app/lib/boletin-detector.ts` (formatos + exclusión decimales) — el regex SQL de 0062 lo espeja; guard de equivalencia espejo `packages/fichas/src/spike/boletin.test.ts`.
- Patrón RPC + doble-revoke: 0055/0060/0061; allowlist app/lib/lockdown-guard.test.ts; pgTAP plantillas 0060/0061.
- Ficha proyecto: app/app/proyecto/[boletin]/page.tsx — sección "Lobby del período" (0048) existente como referencia de layout/leyenda.
- PartidoChip/chips cívicos para el estilo del chip de mención.

### Established Patterns
- Leyendas negadas en NEGACIONES_LOCKED antes de añadir superficie al scan (lección BLOCKER 91).
- Counts honestos con total_n (0061) si hay truncamiento.
- 42P13: cambiar returns de RPC existente = drop+recreate+doble-revoke.

### Integration Points
- PROD: 5.106 audiencias confirmadas (v3.0); materia poblada verbatim.
- La sección temporal 0048 en ficha proyecto se mantiene; la nueva sección de mención explícita es ADICIONAL y separada.

</code_context>

<specifics>
## Specific Ideas

- Chip "Menciona boletín 14309-04" con link; si menciona varios, un chip por boletín válido.
- En ficha proyecto, la sección de menciones muestra count honesto y orden cronológico DESC.
- Medir en el SUMMARY cuántas audiencias en PROD tienen mención válida de boletín (dato de cobertura honesto).

</specifics>

<deferred>
## Deferred Ideas

- Identidad de contrapartes (contraparte_id) — placeholder 0021, fuera de alcance.
- Cruce temático asistido por LLM — PROHIBIDO por regla LOCKED (nunca).
- Notificaciones de nuevas audiencias por boletín — v10+.

</deferred>
