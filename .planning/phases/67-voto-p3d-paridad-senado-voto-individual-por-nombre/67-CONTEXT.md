# Phase 67: VOTO P3d — Paridad Senado (voto individual por nombre) - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (wiring/execution phase — discuss skipped; decisions locked by two-stage + fail-closed rules)

<domain>
## Phase Boundary

Poblar el voto individual del SENADO a escala vía `votaciones.php` con la ingesta de DOS ETAPAS R2 (`--from-r2`), degradando FAIL-CLOSED donde solo hay nombre — SIN fabricar un FK confirmado. El vínculo Senado es por NOMBRE normalizado → `probable/no_confirmado` con `fuente_voter_id = seq:<n>`; jamás un `EnlaceConfirmado` inventado. `runIngest` degrada fail-closed si falta el provider Senado (no inventa votos). Componentes `connector-senado.ts` + `reconciliar-senado.ts` YA EXISTEN — esta fase los ejecuta/enruta por el wire dos-etapas de Phase 66, no crea el conector. La superficie ciudadana del voto (ficha) es Phase 68; aquí SC#4 es un INVARIANTE de disciplina de atribución (solo lo `confirmado` se presenta como voto de la persona), no construcción de UI.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (dentro de reglas LOCKED)
- Dos etapas SIEMPRE (fuente→R2 crudo content-addressed primero; R2→Supabase con `--from-r2` replay). Mismo wire que Phase 66; R2 Stage-1 falla → gatea Stage-2 (fail-closed, fix CR-01 de Phase 66).
- Senado por NOMBRE: el cruce NO es DIPID-determinista (el Senado no expone DIPID). Vínculo por nombre normalizado → estado `probable` o `no_confirmado`, NUNCA `confirmado` fabricado. `fuente_voter_id = seq:<n>` como identificador estable de la fila, no un FK a persona.
- Fail-closed: sin provider Senado, `runIngest` no inventa votos.
- Rate-limit 2-3s, UA identificatorio; backfill masivo LOCAL reanudable; paginar PostgREST `.range()`.
- Disciplina de atribución (SC#4): solo `confirmado` se muestra como voto atribuido a la persona; `probable/no_confirmado` no se presenta como “votó X”.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- `connector-senado.ts` (fetch `votaciones.php` XML), `reconciliar-senado.ts` (vínculo por nombre).
- Wire dos-etapas de Phase 66 (`runIngest` con r2Store/snapshotWriter/fromR2; fail-closed R2 Stage-1).
- Modelo `voto` (0019, incluye `ausente`), `estado_vinculo`, upsert `onConflict:'votacion_id,fuente_voter_id'`.
- `fast-xml-parser` para el XML del Senado (CLAUDE.md).

</code_context>

<specifics>
## Specific Ideas

- `fuente_voter_id = seq:<n>` para filas Senado (no fabricar FK).
- Estados válidos Senado: `probable` / `no_confirmado` (nunca `confirmado` por name-match).
- `--from-r2` replay para Etapa 2 sin re-tocar `votaciones.php`.
- Backfill LOCAL (operador), igual que Cámara (Phase 66).

</specifics>

<deferred>
## Deferred Ideas

- Superficie ciudadana del voto (ficha, sí/no/abstención/pareo/ausente con fuente/fecha/enlace) → Phase 68.
- Mejora del vínculo Senado a `confirmado` (requeriría un identificador estable del Senado, fuera de alcance).
</deferred>
