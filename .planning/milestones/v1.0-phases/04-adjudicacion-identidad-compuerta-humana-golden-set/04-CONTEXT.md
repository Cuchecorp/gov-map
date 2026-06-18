# Phase 4: Adjudicación de Identidad + Compuerta Humana + Golden Set - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Cierra el subsistema crítico de identidad (riesgo existencial #1): toma los casos que el match determinista de Fase 3 dejó en `no_confirmado`/dudoso, los adjudica con LLM crítico (MiniMax-M3), escala a revisión humana bajo umbral conservador, audita cada decisión en log inmutable, y corre un golden set como test de regresión que bloquea el deploy si la precisión baja del umbral. Cubre ID-03 (adjudicación LLM con JSON validado), ID-04 (compuerta de validación → revisión humana, fail-closed), ID-05 (revisor confirma/rechaza/corrige con registro), ID-06 (estados confirmado/probable/no_confirmado; solo confirmado público), ID-07 (golden set bloquea deploy), ID-08 (procedencia/audit por match). NO incluye conectores de votaciones/tramitación (esos producen los registros foráneos a reconciliar — Fase 5+); aquí se construye el pipeline + se valida con casos sintéticos/golden. Es un subsistema AISLADO: el único escritor de `parlamentario_id` reconciliado.
</domain>

<decisions>
## Implementation Decisions

### Umbral, adjudicación LLM, revisión humana y golden set
- **Umbral de confianza = 0.90, asimétrico (preferir falso negativo):** la compuerta enruta a revisión humana todo `decision=match` con `confidence < 0.90`, **o** con `conflicts` no vacío, **o** inconsistencia de cámara/periodo, **o** `decision=uncertain`. **Nada bajo el umbral se auto-acepta.** Ante duda, no confirmar.
- **Adjudicación LLM = MiniMax-M3** (modelo crítico) vía `@obs/llm` (`LLMProvider`, tool calling forzado, temp baja). Una call por registro dudoso. Pipeline:
  - **Etapa 0** (ya en Fase 3): atajo determinista — RUT exacto / nombre normalizado único en (cámara,periodo) → confirmado sin LLM.
  - **Etapa 1 — candidatos por blocking:** apellido + cámara + periodo + región (reusa `normalizarNombre`/tokens de Fase 3) → lista corta de candidatos de la maestra.
  - **Etapa 2 — adjudicación LLM:** se pasa el registro foráneo + candidatos; el modelo devuelve JSON validado con zod contra el schema:
    `{ "decision": "match|no_match|uncertain", "chosen_id": "P00123|null", "confidence": 0.0-1.0, "evidence": [...], "conflicts": [...] }`.
  - **Etapa 3 — compuerta automática:** aplica las reglas duras del umbral; enruta a revisión humana o auto-acepta (solo si supera todo).
  - El RUT/dato personal NUNCA se envía al LLM (al modelo solo van nombres, cámara, periodo, región, candidatos — minimización por diseño; data-routing de Fase 2 aplica).
- **Revisión humana = cola en Postgres + CLI de revisor** (ID-05): tabla `revision_identidad` (registro foráneo, candidatos, salida del modelo, estado); un CLI permite confirmar/rechazar/corregir, registrando `revisor_id` + timestamp. UI web rica diferida a Fase 5+ (aquí basta CLI + cola). 
- **Audit log inmutable (ID-08):** cada match guarda procedencia: `metodo` (determinista|llm|humano), `confidence`, `timestamp`, `modelo_version`, `revisor_id` (si aplica). Append-only (sin update/delete; RLS deny-by-default; trigger o tabla append-only).
- **Estados (ID-06):** cada vínculo nombre→id es `confirmado`/`probable`/`no_confirmado`. **Solo `confirmado` se muestra como hecho en la capa pública**; `probable`/`no_confirmado` nunca como hecho sin marca visible (la capa pública es Fase 5+, pero el modelo de estado + la garantía se fijan aquí).
- **Golden set (ID-07):** conjunto etiquetado de casos difíciles (homónimos, nombres de casada, abreviaturas tipo "Walker P., Matías", cambios de grafía) con su match correcto. Corre como **test de regresión** en cada cambio de prompt/modelo/lógica. Trackea precisión/recall. **Si la precisión baja del umbral, bloquea el deploy** (test que falla / gate en CI).

### Claude's Discretion
- Esquema fino de las tablas (`revision_identidad`, `match_audit`/`identidad_log`), prompt exacto del adjudicador, valor del umbral de precisión del golden set (sugerido alto, p.ej. ≥0.95 en el set), tamaño inicial del golden set, y forma del CLI quedan a discreción del planner respetando lo anterior.
- La adjudicación LLM se testea con mock (sin red/cuota) + un smoke LIVE opcional gated por env contra el golden set para medir precisión real de MiniMax-M3.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/llm` (Fase 2): `LLMProvider` (MiniMax-M3 tool calling, zod gate, router por criticidad/sensibilidad), data-routing (RUT-never-LLM, PII fail-closed). La adjudicación es un consumidor de esto.
- `@obs/identity` (Fase 3): `normalizarNombre`, `matchDeterminista`, tipos `Parlamentario`/`EstadoIdentidad`, la maestra poblada (186 reales) — la fuente de candidatos.
- `@obs/core`: tipos + zod. Migraciones 0001-0005 + pgTAP + RLS deny-by-default.

### Established Patterns
- TDD con vitest + mock fetch; pgTAP para migraciones; RLS deny-by-default; provenance.
- MiniMax-M3 verificado (model id `MiniMax-M3`, tool calling). Tests con mock; smoke live gated por env.

### Integration Points
- Fases 5-7 producen los registros foráneos (votos por nombre del Senado, etc.) que este subsistema reconcilia contra la maestra antes de atribuir nada a una persona.
- La capa pública (Fase 5+) solo mostrará vínculos `confirmado`.
</code_context>

<specifics>
## Specific Ideas

- "Walker P., Matías" es el caso canónico (voto del Senado por nombre sin id) — debe estar en el golden set.
- Un match equivocado NO da error: produce una afirmación falsa creíble. Por eso fail-closed + golden set como gate de deploy.
- El subsistema es el único escritor de `parlamentario_id` reconciliado; los normalizadores (Fase 5+) solo escriben la MENCIÓN cruda.
</specifics>

<deferred>
## Deferred Ideas

- UI web de revisión humana → Fase 5+ (aquí CLI + cola).
- Conectores que generan los registros foráneos (votaciones/tramitación/lobby) → Fase 5+.
- Adjudicación live a escala (cuota MiniMax) → se ejercita contra el golden set; el volumen real llega con los conectores.
</deferred>
