# Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default) - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Transcripción de **Fase 2.1** del diseño LOCKED `.planning/MILESTONE-v4-cruces.md`. Construir la capa derivada de cruces parlamentario↔sector — package nuevo `@obs/cruces` + migraciones `0038+` — que:
1. modela un catálogo `sector` y etiqueta `sector_id` en `proyecto_ficha`, `lobby_contraparte` y `donante`;
2. materializa señales factuales (conteos de evidencia, **sin score de correlación**) en `cruce_senal`;
3. expone un RPC `cruces_de_parlamentario` **sin grant a anon** y todo **deny-by-default**.

**Todo deny-by-default y NO publicable** — nada se enciende sin firma humana (Phase 39). El alcance es código + migraciones + golden/eval; cero exposición pública.

**Fuera de alcance (otras fases):** la superficie en ficha de parlamentario (Phase 37), la superficie en ficha de proyecto (Phase 38), el gate legal/firma (Phase 39), RUT-01 + ChileCompra/SERVEL (Phase 40). Las señales derivadas de voto arrancan **OFF** (chocan con 17-LEGAL-DOSSIER §2) hasta sign-off explícito.
</domain>

<decisions>
## Implementation Decisions

### Taxonomía de sectores
- **D-01:** Catálogo **custom curado** de ~12-15 macro-sectores legibles para ciudadano/prensa (NO CIIU/ISIC granular, NO data-driven por clustering). Versionado en seed.
- **D-02:** **Un solo catálogo compartido** para las tres entidades (`proyecto_ficha`, `lobby_contraparte`, `donante`) — habilita el cruce directo sector-a-sector. NO catálogos separados por entidad.
- **D-03:** **Claude (planner/researcher) propone** la lista concreta de ~12-15 sectores en el seed, basada en las materias reales del Congreso; **el operador la confirma** antes de aplicar. NO se dicta la lista en este discuss.
- **D-04:** **Estable + extensible aditivo:** agregar un sector es una migración aditiva; NUNCA renombrar/borrar códigos vivos (clave para el determinismo del golden). Estable durante el milestone, crecible después.
- **D-05:** **Sin calce → `sector_id` NULL** (honest-state, espejo de "literal o null"). NO existe sector cajón-sastre tipo "Otros".

### Golden de sector (eval propio, SEPARADO de la extracción literal SEM-02)
- **D-06:** Ground-truth construido por **LLM-propone + humano-valida** sobre **~40 casos** reales (proyectos + contrapartes); el set corregido es el golden, fijado en JSON versionado.
- **D-07:** **Single-label (top-1):** un sector primario por ítem; "correcto" = match exacto con el golden. Mantiene `cruce_senal` y el materializador simples y deterministas. NO multi-label, NO primario+secundarios en esta fase.
- **D-08:** **Política de abstención:** el clasificador devuelve NULL cuando no está seguro. En el gate ≥7/10, **NULL cuenta como no-cubierto** (baja cobertura) pero **NUNCA como error**; una asignación de sector **incorrecta SÍ es error**. Prefiere abstenerse a imputar. NO forzar siempre un sector.

### Contenido del jsonb `evidencia` (en `cruce_senal`)
- **D-09:** `evidencia` = **conteo + lista de eventos trazables**: `{ conteo, items: [{ tipo, fecha, contraparte_nombre_crudo, audiencia_id, enlace_fuente }] }`. La ficha (Phase 37) puede renderizar "N reuniones con gestores del sector X" + cada evidencia con su enlace original (FND-08) **sin re-query**. NO solo-conteo, NO solo-agregado.
- **D-10:** Contraparte se guarda como **nombre crudo** en la evidencia (independiente del estado de identidad — la clasificación de sector NO requiere `entidad_id` confirmado; maximiza cobertura honesta, conserva el patrón IdentityMarker en la superficie).
- **D-11:** `materializar_cruces()` hace **full rebuild transaccional** cada corrida (borra + reinserta dentro de una transacción, espejo de `materializar_aristas` en `0030_net.sql`). Sin filas stale/huérfanas; la evidencia siempre refleja el estado actual de lobby. NO upsert incremental, NO append versionado.

### Routing LLM (clasificación de sector)
- **D-12:** **Split por sensibilidad del input:** proyectos (idea matriz/materia = público) → **DeepSeek V4** (volumen, prompt-cache); contrapartes/donantes (sensible, Ley 21.719) → **MiniMax M3** con `sensitivity` ≠ `'public'` (FND-06 / `data-routing.ts`). NO un solo proveedor para todo.
- **D-13 (convención heredada, no re-discutida):** salida estructurada por el patrón del proyecto — DeepSeek `json_object` / MiniMax tool-calling forzado — con **compuerta zod** validando contra el enum del catálogo `sector`; RUT NUNCA cruza al LLM (`assertNoRutInLlmInput`, test-enforced). La clasificación corre en **CLI batch de `@obs/cruces`** (etapa derivada), NUNCA por fila dentro de `writer-supabase.ts`.

### Claude's Discretion
- Estrategia de prompt-cache/batch del clasificador, offset exacto del pg_cron (`~23 3 * * *` sugerido por diseño), forma precisa de columnas vs jsonb en `cruce_senal` más allá de D-09, y manejo de drift/throttle de fuente — a criterio del planner siguiendo patrones existentes (`materializar_aristas`, `pipeline-cli`, `money-gate`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diseño de la fase (fuente de verdad — NO re-diseñar)
- `.planning/MILESTONE-v4-cruces.md` §"FASE 2 — Cruces" / 2.1 — WHAT/WHY/REPO TARGETS/KEY NOTES/DEPENDS-ON/ACCEPTANCE de esta fase. **LOCKED.**
- `.planning/REQUIREMENTS.md` — CRUCE-01, CRUCE-02, CRUCE-03 (criterios de aceptación verbatim).
- `.planning/ROADMAP.md` §"v4.0" — mapeo Fase-doc→Phase, insight de ruta crítica, gates LOCKED.

### Patrones de espejo (migraciones y RPC)
- `supabase/migrations/0030_net.sql` — `materializar_aristas()` (security definer, `search_path=''`, full rebuild transaccional, pg_cron con offset) = patrón a espejar para `materializar_cruces()`. **OJO:** `cruce_senal` NO es espejo de `arista` (forma distinta — fila única parlamentario+sector+evidencia jsonb, no arista binaria).
- `supabase/migrations/0034_entidad_tercero.sql`, `0035_vinculo_entidad.sql`, `0036_entidad_fk.sql` — terceros resueltos (Phase 35) de donde sale `entidad_id`/contrapartes; FK `lobby_contraparte.contraparte_id`, columna `donante` para `sector_id`.

### Gates y data-routing (deny-by-default + PII)
- `packages/llm/src/data-routing.ts` — `assertNoRutInLlmInput` + `assertSensitivityAllowed` (FND-06); sensitivity de contrapartes ≠ `'public'`.
- `app/lib/money-gate.ts` / `app/lib/net-gate.ts` — patrón de flag server-only fail-closed (espejo para el futuro `crucesPublicEnabled()` en Phase 37; en Phase 36 solo importa el "sin grant a anon").
- `docs/legal/17-LEGAL-DOSSIER.md` §2 — exclusión de señales de voto/`co_votacion` (anti-insinuación); justifica señales de voto OFF.

### Pipeline/golden de fichas (a SEPARAR, no reusar)
- `packages/fichas/src/pipeline-cli.ts`, `extraer.ts`, `model.ts`, `prompt.ts`, `golden/` — flujo de extracción **literal** (SEM-02). El sector NO reusa este flujo (clasificar a taxonomía cerrada = imputación) — necesita schema/pipeline/golden propio en `@obs/cruces`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `materializar_aristas()` (0030_net.sql): patrón verbatim de security-definer + full-rebuild transaccional + pg_cron offset para `materializar_cruces()`.
- `packages/llm/src/data-routing.ts`: gates de PII/sensibilidad ya construidos — el clasificador de contrapartes los consume tal cual.
- Proveedores LLM enchufables (`packages/llm`, `packages/adjudication`): split DeepSeek/MiniMax ya en uso (extracción de fichas vs adjudicación de identidad).
- `packages/fichas/src/pipeline-cli.ts`: forma del CLI batch (dry-run, golden gate) a espejar — NO el contenido de extracción literal.

### Established Patterns
- **Deny-by-default REAL** (Phases 11/12/35): RLS-on + cero policies + `revoke all from anon, authenticated` — el proyecto concede por DEFAULT PRIVILEGES a anon en tablas nuevas de `public`, así que `cruce_senal` debe revocar explícitamente.
- **Apply por `psql --db-url`** (NUNCA `db push`, por schema_migrations drift); **pgTAP única prueba válida**. Última en PROD = `0037`.
- **Ingesta dos etapas** (Fuente→R2→Supabase): la clasificación de sector es etapa derivada separada, no inline en el writer.

### Integration Points
- `sector_id` se añade a `proyecto_ficha`, `lobby_contraparte`, `donante` (columna nueva, aditiva).
- `cruce_senal` lee de `lobby_audiencia` + `lobby_contraparte` (sector) para la señal MVP; el RPC `cruces_de_parlamentario` será consumido por `CrucesSection` en Phase 37.
</code_context>

<specifics>
## Specific Ideas

- Wording factual obligatorio en las señales: "N reuniones con gestores del sector X" — **sin verbo causal**. El linter de texto prohíbe "corrupción/influencia/benefició/a cambio de" (heredado del DESIGN-SYSTEM banned-vocab / 17-LEGAL-DOSSIER).
- El RPC `cruces_de_parlamentario` **nunca** proyecta `rut/partido/email/donante_id` (a verificar por pgTAP).
- Señal MVP a encender: **solo `lobby_sector_aporte`** (la menos insinuante); las derivadas de voto (`lobby_sector_voto`/`aporte_sector_voto`) quedan OFF.
</specifics>

<deferred>
## Deferred Ideas

- **Señales derivadas de voto** (`lobby_sector_voto`, `aporte_sector_voto`): construibles deny-by-default pero arrancan OFF; requieren re-justificación legal vs 17-LEGAL-DOSSIER §2 + sign-off (Phase 39). NO encender en Phase 36.
- **Multi-label / sector primario+secundarios:** diferido; arrancamos single-label top-1 (D-07).
- **Sector vía aportes/donantes reales (SERVEL):** depende de RUT-01 + ChileCompra/SERVEL (Phase 40) — la dimensión `aporte` del cruce no tiene evidencia poblada hasta entonces.

### Research Question (para gsd-phase-researcher — NO re-diseño)
- **Semántica de la señal MVP `lobby_sector_aporte`:** el nombre en CRUCE-03 sugiere lobby+aporte, pero los aportes (donantes/SERVEL) están gated hasta Phase 40 y el acceptance exige materializar "con datos de lobby actuales" → ≥1 fila para ≥5 parlamentarios. El researcher debe resolver si la señal MVP es **lobby-puro** ("N reuniones con gestores del sector X") y si el nombre/columna se ajusta, manteniendo el acceptance verificable solo con datos de lobby ya ingeridos (Phase 34).
</deferred>

---

*Phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default*
*Context gathered: 2026-06-24*
