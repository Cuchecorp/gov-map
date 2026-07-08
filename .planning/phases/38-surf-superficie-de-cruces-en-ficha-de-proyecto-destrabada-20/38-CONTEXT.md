# Phase 38: SURF — Superficie de cruces en ficha de proyecto - Context

**Gathered:** 2026-07-07 (auto-generado en corrida autónoma autorizada por el operador — "continua"; decisiones derivadas del ROADMAP §38, del sign-off firmado y del patrón F55)
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir `cruces_de_proyecto(boletin)` (RPC nueva, ESCRITA con pgTAP; aplicar a PROD = checkpoint operador) + la `CrucesSection` de la ficha del proyecto: qué parlamentarios que votaron a favor del proyecto tienen cruces (reuniones de lobby) en el sector del proyecto. PII-safe (proyección vía `parlamentario_publico`, NUNCA rut/partido). El sign-off de señales de voto está FIRMADO (2026-07-07, `docs/legal/SIGNOFF-senales-voto.md`) bajo condiciones anti-insinuación: caveat anti-causal 1×/sección, negative-match de vocabulario causal, conteo neutro, trazabilidad por evidencia. El gate `crucesPublicEnabled()` ya está ON en PROD desde 2026-07-02 — NO se toca ningún flag.

</domain>

<decisions>
## Implementation Decisions

### RPC `cruces_de_proyecto(boletin text)` (idiom post-Camino A)
- Espejo del idiom 0047/0048 (patrón F52): `security definer`, `set search_path`, doble revoke (anon + authenticated), CERO grant (el sitio lee con service_role), agregada a la allowlist del lockdown-guard, pgTAP verificando contrato de columnas + deny de anon.
- Contenido: por sector del proyecto (mapeo sector existente de `cruce_senal`/materias), parlamentarios con voto A FAVOR en votaciones del boletín ∩ reuniones de lobby del sector — proyección PII-safe (nombre_normalizado/id vía `parlamentario_publico`), conteos neutros (nReuniones, nVotos), fecha_captura para frescura (lección WR-02/F41).
- La migración se ESCRIBE y committea; **aplicarla a PROD es checkpoint de operador** (patrón 52-06: psql --db-url + schema_migrations). El agente JAMÁS la aplica.

### CrucesSection en ficha de proyecto (hereda patrón F55)
- Se monta como sección del rail de proyecto existente (entrada "Cruces" en `ProyectoRail.navEntries`), con capa-1 al estilo F55 (marco petróleo, chips "sector · conteos", trigger primary "Explorar los N cruces" vía `DetalleColapsable triggerVariant="primary"`) — misma gramática visual que la ficha de parlamentario.
- **Degrade honesto pre-apply**: RPC ausente en PROD → PGRST202 → la sección devuelve null/no se monta (patrón 52-03 ya existente en el repo). El deploy del código puede preceder al apply de la DDL sin romper nada.
- Nombres con `formatNombre` (F54); nombre como LINK a la ficha del parlamentario (a diferencia del carril lobby×tramitación, aquí el sujeto ES el parlamentario público — el texto-plano LOCKED de 52-03 aplica a CONTRAPARTES de lobby, no a parlamentarios).
- Caveat anti-causal 1×/sección (condición del sign-off); copy factual sin verbo causal (negative-match en tests); conteo neutro sin ranking.

### Gates y verificación
- Suite completa (baseline 670) + tsc + lockdown-guard + banned-vocab verdes; pgTAP para la RPC (runner `psql -tA -f` local si hay DB, si no: tests escritos para post-apply en el patrón de 0042 si el runner no aplica pre-apply — seguir el precedente de F41/F52).
- Redeploy al cierre (patrón docker + wrangler autorizado); smoke; el checkpoint final presenta: (a) migración lista para aplicar con el comando exacto, (b) la sección degradando honesta en PROD pre-apply.

### Claude's Discretion
- Shape exacto de la RPC (columnas) siguiendo el análogo `cruces_de_parlamentario` (0040/0041) y los datos reales de `cruce_senal`.
- Umbral de truncado del detalle y microcopy factual.
- Si el mapeo proyecto→sector no existe en los datos (verificar en research contra el esquema real), degradar el alcance honestamente: construir la RPC sobre lo que exista (p.ej. materia de comisión/votación↔sector vía la clasificación ya materializada en `cruce_senal`) y documentar el límite — NUNCA fabricar la relación.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cruces_de_parlamentario` (migraciones 0040/0041/0042) — análogo directo del idiom; `cruce_senal` 781 filas (F52).
- F55: `DetalleColapsable` (triggerVariant primary), rail de proyecto ya montado en `app/app/proyecto/[boletin]/page.tsx`, `CrucesCapa1` como referencia visual.
- Patrón PGRST202 degrade (52-03), `formatNombre` (F54), lockdown-guard allowlist (`app/lib` guard tests), pgTAP idioms de F41 (`proargnames`, deny-asserts).
- Deploy: docker-cf-build.sh + wrangler (3 deploys hoy — patrón caliente).

### Established Patterns
- Suite 670 + tsc -b + lockdown-guard + banned-vocab; mt-12; tokens sin arbitrary values; server components default.
- DDL: `supabase/migrations/00NN_*.sql` + pgTAP en `supabase/tests/`; post-apply tests fuera del glob si corresponde (patrón 0042).

### Integration Points
- `app/app/proyecto/[boletin]/page.tsx` (sección + rail entry), `app/lib/types.ts` (row type), allowlist del guard, `supabase/migrations/`, `supabase/tests/`.

</code_context>

<specifics>
## Specific Ideas
- Requirement ID: SURF-02. El valor ciudadano: en la ficha de un proyecto, ver qué parlamentarios que lo votaron a favor se reunieron con el sector del proyecto — con fuente, fecha y cero insinuación.
</specifics>

<deferred>
## Deferred Ideas
- Encendido de MONEY (gated F39/F40); cruces por aportes (requiere RUT).
- F48 (autores de proyecto) sigue gated por datos.
</deferred>
