# Phase 73: DINERO P5e — Superficies MONEY gated OFF + linter + GATE LEGAL humano - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Montar TODAS las superficies de dinero DETRÁS del gate deny-by-default `moneyPublicEnabled(process.env)` (fail-closed, literal `"true"`, OFF por defecto). El agente construye HASTA el gate; el ENCENDIDO (flip a `"true"`) es un ACTO HUMANO EXCLUSIVO con sign-off legal 21.719 (dossier 13), provisto por el operador. Cada superficie de dinero lleva procedencia inline + leyenda anti-insinuación; el vínculo "empresa ligada" se afirma SOLO con base RUT-EXACTA (nunca name-match/LLM), conteos factuales. Extender el linter anti-insinuación (Phase 68) a las superficies MONEY. Un guard CI impide que un commit de agente cambie el flag/default a `"true"`. Cierre con veredicto BrowserOS "comprensible" en modo gated-preview. Componentes `money-gate.ts::moneyPublicEnabled` + superficies (`contratos-de-parlamentario`, `financiamiento-de-parlamentario`, `aportes/contratos-por-contraparte`) YA EXISTEN — esta fase los MONTA + gate + linter + dossier, no los crea.

</domain>

<decisions>
## Implementation Decisions

### Gate deny-by-default (LOCKED — rector)
- TODA superficie MONEY se renderiza SOLO vía `moneyPublicEnabled(process.env)` (fail-closed, `=== "true"`). OFF por defecto. NINGUNA ruta lee la env cruda.
- Guard CI anti-flip: un commit de AGENTE no puede cambiar el flag/default a `"true"` ni relajar el gate. El flip requiere `signoff: approved` en el dossier legal 13 — acto humano exclusivo del operador.

### Anti-insinuación MONEY (LOCKED, defamación)
- "empresa ligada" se afirma SOLO con base RUT-EXACTA (ChileCompra por RUT, Phase 70). NUNCA name-match/LLM. SERVEL (por nombre) NO afirma "empresa ligada por RUT".
- Conteos FACTUALES con procedencia inline (fuente/fecha/enlace + monto VERBATIM). NUNCA "empresa ligada a" como insinuación de vínculo indebido, ni causalidad ("financió", "a cambio de").
- El linter anti-insinuación (Phase 68) se EXTIENDE a las superficies MONEY (mismo patrón `stripTsComments` + blocklist).
- Frescura declarada por dato (elección/corte SERVEL, fecha contrato) — nunca dato viejo como actual.

### Legal gate (LOCKED — acto humano)
- El dossier legal 13 (sign-off 21.719) es requisito del flip. El agente ESCRIBE el dossier para revisión; NO lo firma ni flipea. `signoff: approved` lo provee el humano.

### BrowserOS gated-preview
- Veredicto "comprensible" sobre las superficies MONEY en modo gated-preview (flag ON solo en preview local/operador, nunca en prod hasta el flip). Operador-gated.

### Claude's Discretion
Layout/densidad de las superficies MONEY dentro de las reglas anti-insinuación y el sistema de diseño (ficha ya montada). Reusar componentes existentes.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research + UI-SPEC. YA EXISTEN:
- `money-gate.ts::moneyPublicEnabled` (fail-closed `=== "true"`) — el chokepoint del gate.
- Superficies: `contratos-de-parlamentario`, `financiamiento-de-parlamentario`, `aportes/contratos-por-contraparte`.
- Datos: contratos ChileCompra por RUT (Phase 70), aportes SERVEL por nombre (Phase 71), señal cruce_senal (Phase 72, empty-honest).
- Linter anti-insinuación (Phase 68, `anti-insinuacion-guard.test.ts`) — extender a MONEY.
- Guards existentes (lockdown, money-gate) + patrón dossier legal (Candado A/B fases previas).
- Brand `FilaRutCorroborada` (Phase 69) — RUT-exacto fail-closed.

</code_context>

<specifics>
## Specific Ideas

- Leyenda anti-insinuación MONEY textual + procedencia inline por dato.
- "empresa ligada" SOLO por RUT-exacto; conteos factuales; monto VERBATIM.
- Guard CI anti-flip (agente no flipea; requiere signoff dossier 13).
- Dossier legal 13 escrito para sign-off humano (21.719).
- BrowserOS "comprensible" gated-preview (operador).

</specifics>

<deferred>
## Deferred Ideas

- El FLIP real (encendido MONEY) = acto humano exclusivo con sign-off legal — NO esta corrida.
- Cruce dinero × voto × timeline (MONEYX-01) → v2 (máquina de sospechas).
- El BrowserOS cold-read real requiere deploy/preview + datos (backfills operador) — operador-gated.
</deferred>
