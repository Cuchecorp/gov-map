# Phase 126: PANEL-GUARDS — Wave-0 de guards - Context

**Gathered:** 2026-07-30 (modo autónomo — decisiones adjudicadas con recomendación logged; régimen v13.0 LOCKED)
**Status:** Ready for planning

<domain>
## Phase Boundary

El régimen muerde ANTES de que exista un solo archivo de copy o la primera vista del milestone:
(1) `SUPERFICIES_PANEL` extendida con los archivos previstos del rediseño + anti-drift,
(2) `NEGACIONES_LOCKED` extendida con los idioms nuevos aprobados + self-check de no-hueco,
(3) guard `create view` sin `security_invoker` (B-03) con control positivo apareado,
(4) suite `app/` completa + guards de régimen verdes por nombre explícito.

Requirements: PANEL-08, DEBT-02. NO incluye: copy del panel (128), migración 0080 (127),
vistas nuevas (ninguna fase las crea aún — el guard B-03 existe justamente ANTES).

</domain>

<decisions>
## Implementation Decisions

### Guard B-03 — create view sin security_invoker (DEBT-02)
- **D-01:** Archivo dedicado `app/lib/create-view-guard.test.ts` (precedente `*-antiflip-guard.test.ts`), NO extender `lockdown-guard.test.ts`. Nombre explícito auditable; corre en `pnpm test` (CI ya corre la suite completa del workspace).
- **D-02:** Guard ESTÁTICO: detector puro `string SQL → violaciones[]` que escanea `supabase/migrations/*.sql`. Matchea `create [or replace] view` (y `create materialized view` — las matviews NO soportan `security_invoker` ⇒ toda matview en `public` es violación a decidir explícitamente vía allowlist vacía inicial). Solo schema `public` (no calificado o `public.`-calificado).
- **D-03:** Control positivo apareado = tests unitarios del detector con fixtures STRING inline: fixture de vista sin `security_invoker` → detector reporta; misma vista con `security_invoker = true` (u `on`) → verde. JAMÁS un archivo .sql fixture dentro de `supabase/migrations/` (contaminaría el ledger y la numeración).
- **D-04:** Hoy hay CERO views en migrations (verificado por grep 2026-07-30) — el cero del escaneo real es vacuo; el control positivo del detector es lo que lo hace no-vacuo. Ambos asserts en el mismo archivo.

### SUPERFICIES_PANEL — alta preventiva + anti-drift (PANEL-08)
- **D-05:** Prefijo de naming CONGELADO para todo componente nuevo del rediseño del panel: `components/panel-*.tsx`. La Phase 128 DEBE nombrar sus archivos con ese prefijo (regla escrita para el planner de 128).
- **D-06:** Alta preventiva ahora (el loader TOLERA archivos faltantes — try/catch continue, patrón Wave-0 Phase 100): `components/panel-tile-sala.tsx`, `panel-tile-comisiones.tsx`, `panel-tile-urgencias.tsx`, `panel-tile-movimiento.tsx`, `panel-tile-votaciones.tsx`, `panel-tile-ingresos.tsx`, `panel-item-proyecto.tsx`. `components/panel-actualidad.tsx` YA está declarado — no duplicar (Pitfall 4 DEDUPE).
- **D-07:** Assert anti-drift NUEVO en el guard: todo archivo REAL del filesystem que matchee `app/components/panel-*.tsx` debe estar declarado en `SUPERFICIES_PANEL` (glob del fs comparado contra el array). Cierra el hueco "archivo nuevo con nombre imprevisto se salta el scan". Si 128 crea un archivo fuera de la lista D-06 pero con prefijo `panel-`, el guard muerde y obliga el alta en el mismo commit.
- **D-08:** El helper central de links internos (Phase 128, PANEL-02) NO entra a SUPERFICIES_PANEL: emite hrefs, no copy renderizado. Si termina emitiendo labels visibles, 128 lo suma (el anti-drift D-07 no lo cubre — vive en `lib/`; regla anotada para el plan de 128).

### NEGACIONES_LOCKED + idioms aprobados (PANEL-08)
- **D-09:** Doble registro: (a) los stems FIJOS de los 4 idioms (`Citado el`, `vigente desde`, `En tabla de sala de la Cámara del`, `según fuente al`) entran a `NEGACIONES_LOCKED` con comentario "idiom aprobado v13.0 — no niega término prohibido; registrado por mandato PANEL-08" (satisface el criterio verbatim; la resta es inocua porque ningún stem contiene término prohibido); (b) export single-source `IDIOMS_APROBADOS` en el mismo guard para que 128 los importe verbatim.
- **D-10:** Self-check de no-hueco (criterio 2): (i) assert de que NINGÚN idiom/stem contiene término de `TERMINOS_PROHIBIDOS` (si un idiom futuro lo contuviera, el registro exige decisión explícita); (ii) mutation: fixture que contiene un idiom + término prohibido inyectado adyacente → `detectarInsinuaciones` SIGUE reportando (la resta del stem no enmascara). Cubre el riesgo real de toda entrada nueva a NEGACIONES_LOCKED: resta amplia que rompa una frase prohibida multi-palabra.
- **D-11:** Los stems se registran SIN las partes variables (fechas/grados) — literales fijos exactos. El detector normaliza whitespace antes de restar (mecánica existente IN-03), así que JSX line-wrapped calza.

### Mutation self-check carril PANEL (criterio 1)
- **D-12:** Extender el mutation self-check existente (Test 2 del guard) con el trío explícito del criterio: `señal`, `exprés`, `los más` inyectados en fixture representativo de superficie panel → cada uno produce FAIL del detector. Los tres YA están en TERMINOS_PROHIBIDOS (carriles VSIM/PANEL) — el self-check prueba que MUERDEN, no los re-agrega.

### Runner por nombre explícito (criterio 4)
- **D-13:** Script `pnpm guards` en `app/package.json` con la lista EXPLÍCITA de archivos guard (`vitest run lib/anti-insinuacion-guard.test.ts lib/lockdown-guard.test.ts lib/create-view-guard.test.ts …` — los 14+ por nombre). Mata el glob-trap (`vitest run lib/*guard*.test.ts` sale 0 sin correr nada — gotcha v12 §9 pagado). La verificación de la fase usa ese script + `pnpm test` completo.
- **D-14:** El plan debe contar los guards de régimen existentes (14+ según v12) y listar cada nombre en el script; si el conteo real difiere del esperado, documentarlo — jamás "los que matchee el glob".

### Claude's Discretion
- Forma exacta del detector B-03 (regex vs statement-split) — decisión del executor mientras el control positivo apareado pase y no haya falsos positivos sobre comentarios SQL (strip de `--` y `/* */` antes de matchear, precedente stripTsComments).
- Ubicación del assert anti-drift D-07 (dentro de anti-insinuacion-guard.test.ts junto a SUPERFICIES_PANEL, recomendado) vs archivo aparte.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Régimen y roadmap
- `.planning/ROADMAP.md` §Phase 126 — success criteria verbatim (4 criterios)
- `.planning/REQUIREMENTS.md` — PANEL-08, DEBT-02
- `.planning/PROMPT-v13.0-build-autonomo.md` §Reglas LOCKED + §Gotchas — reglas inviolables y gotchas de instrumento pagados

### Código a extender (leído en scout 2026-07-30)
- `app/lib/anti-insinuacion-guard.test.ts` — SUPERFICIES_PANEL (L308), TERMINOS_PROHIBIDOS (L601, carril PANEL L678-708, trío señal/exprés/los más ya presente), NEGACIONES_LOCKED (L743), detector `detectarInsinuaciones` (L861), TODAS_LAS_SUPERFICIES (L829), patrón loader-tolera-faltantes (L295-298)
- `app/lib/lockdown-guard.test.ts` — precedente de guard sobre migraciones (Bloque A); NO se toca en esta fase
- `app/lib/vsim-antiflip-guard.test.ts` (o cualquier `*-antiflip-guard`) — precedente de archivo guard dedicado
- `.github/workflows/ci.yml` L44-48 — CI corre `pnpm test` (suite completa) — el guard nuevo entra gratis

### Insumos del milestone
- `.planning/spikes/v13.0-editorial-portada.md` §3.2 — los 6 tiles previstos (origen de los nombres D-06) + idioms aprobados
- `milestones/v12.0-MILESTONE-AUDIT.md` §9 — gotchas de método (glob-trap, cero vacuo, control positivo apareado)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectarInsinuaciones` / `detectarTerminos` / `buildTermRegex` / `stripTsComments` (anti-insinuacion-guard.test.ts): el self-check D-10/D-12 los ejercita directamente — cero código detector nuevo para el carril PANEL.
- Patrón "loader tolera archivos faltantes" (try/catch continue): la alta preventiva D-06 es exactamente el patrón Wave-0 de Phase 100 documentado en el propio archivo (L295-298).
- Patrón fixture-string + control positivo: los tests de mutación existentes (Test 2) muestran la forma.

### Established Patterns
- Guards estáticos (leen src, no la red/DB) — B-03 sigue esto: escanea `supabase/migrations/*.sql`, jamás la DB viva.
- Wave-0 LOCKED (orden 68-01/100-01/101-02/103-03): vocabulario y superficies ANTES del copy. Esta fase ES ese patrón para v13.0.
- CI sin secrets de DB para guards (ci.yml L48).

### Integration Points
- `app/package.json` scripts — nuevo script `guards` (D-13).
- `SUPERFICIES_PANEL` + `NEGACIONES_LOCKED` + Test 2 en anti-insinuacion-guard.test.ts — extensiones in-place.
- `app/lib/create-view-guard.test.ts` — archivo nuevo.

</code_context>

<specifics>
## Specific Ideas

- Cero vacuo vs cero fuerte (lección v12): el escaneo real de B-03 da 0 views hoy — SOLO el control positivo apareado del detector lo convierte en cero fuerte. Sin fixture que muerda, el criterio 3 NO está cumplido.
- El "14+ guards" del criterio 4 se resuelve CONTANDO los guards reales al planear (D-14), no asumiendo 14.

</specifics>

<deferred>
## Deferred Ideas

- Guard equivalente B-03 contra la DB viva (pg_views de PROD) — valor marginal mientras las views solo puedan nacer por migración; si algún día se crea una view fuera del ledger, eso es deuda de operador, no de guard estático.
- Sumar `lib/links-internos.ts` (helper 128) al scan si emite labels visibles — decisión anotada para el plan de 128 (D-08).

</deferred>

---

*Phase: 126-PANEL-GUARDS — Wave-0 de guards*
*Context gathered: 2026-07-30*
