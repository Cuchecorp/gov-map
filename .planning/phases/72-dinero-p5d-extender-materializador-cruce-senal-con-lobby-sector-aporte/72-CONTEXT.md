# Phase 72: DINERO P5d — Extender materializador `cruce_senal` con `lobby_sector_aporte` - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Mode:** Auto-generated (migración aditiva + materializador — discuss skipped; decisiones locked por anti-insinuación/anti-causalidad)

<domain>
## Phase Boundary

Sumar la señal `lobby_sector_aporte` a la capa de cruces (`cruce_senal`) como CONTEO FACTUAL — el token ya está RESERVADO en `cruces.materializar_cruces()` (migración 0039). Migración ADITIVA (nuevo CHECK del token + rama del insert) y materializador FULL REBUILD transaccional (patrón existente). La señal cuenta, vía RUT de empresas ligadas, parlamentarios con aporte por sector — como CONTEO con evidencia jsonb (enlaces de fuente), NUNCA un score de correlación ni afirmación causal. Depende de RUT-01 (Phase 69) y de los datos de dinero (Phase 70/71); sin RUT rinde VACÍO HONESTO, no falso. Todo dentro del régimen MONEY gated (no encendido hasta el flip legal Phase 73).

</domain>

<decisions>
## Implementation Decisions

### Anti-insinuación / anti-causalidad (LOCKED — rector)
- La señal es un CONTEO FACTUAL con evidencia jsonb (enlaces a la fuente). NUNCA un score de correlación, NUNCA una afirmación causal.
- PROHIBIDO en la señal Y en su etiqueta: "financió su voto", "a cambio de", "por eso votó", cualquier insinuación de causa/intención. El linter anti-insinuación (Phase 68) debe cazar el vocabulario.
- Descriptivo: "N aportes del sector X a empresas ligadas por RUT (con enlaces de fuente)". El ciudadano ve el hecho + la fuente; jamás una conclusión.

### Migración aditiva + FULL REBUILD (LOCKED)
- Aditiva: nuevo valor en el CHECK del token `tipo`/`token` + nueva rama del insert. NO altera señales existentes.
- Materializador transaccional FULL REBUILD (mismo patrón que las señales previas de 0039). Idempotente.

### Depende de RUT (LOCKED, fail-closed)
- Solo cuenta parlamentarios con RUT PRESENTE (via las empresas ligadas por RUT — ChileCompra/aporte por RUT). Sin RUT → vacío honesto (0 filas), nunca falso por nombre.
- El vínculo de dinero por RUT ya es fail-closed (Phase 69 brand / Phase 70). SERVEL (por nombre) no aporta RUT — su inclusión en esta señal, si aplica, respeta el determinista fail-closed.

### Gate MONEY
- Bajo el régimen `MONEY_PUBLIC_ENABLED` OFF; la señal existe materializada pero no se presenta hasta el flip legal (Phase 73). Guard anti-flip.

### Claude's Discretion
Detalles SQL de la rama aditiva dentro de las reglas; reusar el patrón de `cruces.materializar_cruces()` (0039) y el token reservado.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- `cruces.materializar_cruces()` (migración 0039) con el token `lobby_sector_aporte` RESERVADO (CHECK/enum) — la rama del insert es lo net-new.
- Tablas `cruce_senal` (conteo + evidencia jsonb), `contrato`/`contratista` (0023, Phase 70), `aporte` (0024, Phase 71), maestra con RUT (Phase 69).
- Patrón de señales previas en el materializador (FULL REBUILD transaccional).
- Linter anti-insinuación (Phase 68) + guard MONEY anti-flip.
- Supabase-ops discipline para migraciones (aditiva, low-riesgo, pero DDL → revisar).

</code_context>

<specifics>
## Specific Ideas

- Token: `lobby_sector_aporte` (ya reservado en 0039).
- Conteo por sector vía RUT de empresas ligadas; evidencia jsonb con enlaces de fuente.
- Vacío honesto si no hay RUT (0 filas), nunca falso.
- Etiqueta descriptiva sin causalidad; el linter la valida.
- Migración aditiva; materializador FULL REBUILD transaccional idempotente.

</specifics>

<deferred>
## Deferred Ideas

- Superficies MONEY + flip legal → Phase 73 (acto humano).
- Cruce dinero × voto × timeline (MONEYX-01), co-votación → v2 (máquina de sospechas, diferido).
- Aplicar la migración a PROD = acto controlado (db push / operador), no necesariamente esta corrida; el agente escribe + valida la migración.
</deferred>
