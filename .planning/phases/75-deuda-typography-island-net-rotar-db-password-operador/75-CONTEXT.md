# Phase 75: DEUDA — Typography island `.net-*` + rotar DB password (operador) - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (deuda cosmética/operacional — discuss skipped)

<domain>
## Phase Boundary

Cerrar la deuda cosmética/operacional restante:
1. **Typography island `.net-*` (DEBT-05):** alinear la typography del island `.net-*` al design system (hoy FUERA de contrato: nombre 15px, banda 13px) → usar los tokens/roles tipográficos del sistema. Frontend cosmético.
2. **Rotar DB password (DEBT-06, B26):** el DB password de Supabase queda ROTADO por el OPERADOR en el dashboard, con la acción documentada. Credencial expuesta (acto de operador, no del agente).
NO regresionar el layout radial de `/red` (F18 LOCKED intacto).

</domain>

<decisions>
## Implementation Decisions

### Typography al contrato (LOCKED)
- El island `.net-*` (nombre 15px, banda 13px) se alinea a los roles/tokens tipográficos existentes del design system (Phase 19/21 crema/petróleo). No inventar nuevos tamaños; usar los roles ya definidos.
- El cambio NO debe regresionar el layout radial de `/red` (F18 LOCKED) ni el layout B seed→columna (quick 260713-izo). Verificable en `/red`.

### DB password = acto operador (LOCKED)
- La rotación del DB password de Supabase (B26) la ejecuta el OPERADOR en el dashboard de Supabase. El agente NO rota la credencial (no tiene acceso al dashboard; y rotar rompería conexiones activas). El agente DOCUMENTA la acción (runbook/checkpoint) para el operador.
- Tras rotar, el operador re-carga la nueva credencial en `.env` local + GH secrets (Cuchecorp/gov-map).

### Claude's Discretion
Detalles de la alineación tipográfica dentro del design system; reusar tokens/roles existentes.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- Island/clases `.net-*` en el frontend (`/red` grafo, tipografía fuera de contrato) — memoria: "deuda: typography .net-*".
- Design system tokens/roles (Phase 19/21, crema/petróleo; globals.css / civic-tokens.css / tailwind config).
- `/red` layout radial F18 LOCKED + layout B seed→columna (quick 260713-izo).
- DB password de Supabase (B26) expuesto — rotación = acto operador (memoria: "DEUDA ÚNICA: rotar DB password").

</code_context>

<specifics>
## Specific Ideas

- `.net-*` nombre 15px → rol tipográfico del sistema; banda 13px → rol del sistema.
- Verificar `/red` (radial F18 + layout B) sin regresión tras el cambio.
- Runbook/checkpoint operador para rotar el DB password + re-cargar credencial.

</specifics>

<deferred>
## Deferred Ideas

- Ninguna — última fase de v7.0, deuda acotada.
- La rotación real del password = acto operador (checkpoint), no esta corrida.
</deferred>
