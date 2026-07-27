# Phase 68: VOTO P3e — Superficies de voto + linter anti-insinuación + cobertura + gate BrowserOS - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Cerrar el 360 del voto en la ficha del parlamentario: montar las superficies de voto individual (historial por sesión/proyecto, con enlace a la votación y al proyecto), DESCRIPTIVAS y con provenance inline — NUNCA como "alineamiento", "disciplina", "rebeldía" ni "motivo". Extender el linter anti-vocabulario-insinuante a los componentes de voto nuevos. Declarar la cobertura del voto individual (N/M sesiones, techo por causa) en la UI y en `pnpm freshness`. Cerrar con un gate de comprensión BrowserOS ("comprensible"). Componentes YA EXISTEN (`votos-chart`, `voto-detalle`, `votos-por-parlamentario`, RPC `votos_de_parlamentario`) — esta fase los MONTA + gate, no los crea.

</domain>

<decisions>
## Implementation Decisions

### Anti-insinuación (LOCKED — rector del proyecto)
- Un voto es un HECHO OBSERVABLE. Cada superficie lleva leyenda anti-insinuación: "un voto es un hecho observable; ausente/pareo ≠ en contra; no medimos disciplina ni motivo".
- `pareo` y `ausente` en slate NEUTRO, NUNCA fundidos visualmente con "en contra".
- Provenance inline (fuente/fecha/enlace) en cada superficie de voto.
- Prohibido: vista "parlamentarios que votan como X", matriz de similitud, comparativo con mayoría de bancada, "rebeldía"/"disciplina"/"alineamiento".

### RPC `rebeldias_de_parlamentario` — NO SURFACEAR
- El concepto "rebeldía" es EXACTAMENTE el ítem diferido VOTOX (v2, alto riesgo de insinuación — 17-LEGAL-DOSSIER; STATE Deferred Items). Aunque el RPC exista en la DB, esta fase NO lo monta en ninguna superficie ciudadana. Si es necesario, dejarlo inerte/no-referenciado; el linter debe cazar cualquier uso del término.

### Cobertura honesta
- N/M sesiones cubiertas + techo por causa (RUT-bloqueado, PDF escaneado, sin dato) declarado en la UI Y en `pnpm freshness`.
- Cobertura confirmado/no_confirmado del voto (Cámara determinista, Senado por nombre) visible; no presentar `probable/no_confirmado` como voto atribuido a la persona.

### Claude's Discretion
Layout/densidad de las superficies dentro de las reglas anti-insinuación y del sistema de diseño existente (ficha del parlamentario ya montada en fases previas). Reusar componentes existentes; no re-inventar.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research + UI-SPEC. YA EXISTEN:
- Componentes: `votos-chart`, `voto-detalle`, `votos-por-parlamentario`.
- RPCs: `votos_de_parlamentario` (montar), `rebeldias_de_parlamentario` (NO montar — diferido).
- Ficha del parlamentario (Next.js App Router, Server Components) ya montada.
- Linter anti-insinuación existente (extender a los componentes de voto).
- `pnpm freshness` (declarar cobertura del voto).
- Datos de voto: Cámara (Phase 66, determinista) + Senado (Phase 67, por nombre) — poblados por backfill operador-LOCAL.

</code_context>

<specifics>
## Specific Ideas

- Leyenda anti-insinuación textual exacta en cada superficie.
- Estados visuales: sí / no / abstención / pareo / ausente — pareo y ausente en slate neutro.
- Enlace a la votación y al proyecto (boletín) desde cada voto.
- Gate BrowserOS: veredicto "comprensible" en lectura fría ciudadana.

</specifics>

<deferred>
## Deferred Ideas

- VOTOX-01 (comparativo voto vs mayoría bancada), VOTOX-02 (votos cruzados), matriz de similitud, "rebeldía" → v2 (alto riesgo insinuación, tras sign-off legal). NO en esta fase.
</deferred>
