# Phase 112: V7GATES P4c — Cold-reads + flip MONEY + audit/complete v7.0 + cierre quick tasks - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Mode:** Closing phase — cold-reads/verification + operator MONEY checkpoint + lifecycle + doc closure

<domain>
## Phase Boundary

Cerrar la pasada v7.0: (1) gates de comprensión/visuales sobre el deploy real (68 votos, 73 MONEY gated-preview, 75 /red no-regresión) con veredicto "comprensible"; (2) flip `MONEY_PUBLIC_ENABLED` SOLO tras sign-off 21.719 del operador en `docs/legal/13-LEGAL-DOSSIER.md` (o MONEY OFF declarado honesto); (3) `audit-milestone`→`complete-milestone v7.0` con deuda restante explícita; (4) marcador formal de cierre de las 5 quick tasks + STATE.md. Al cerrar la pasada: lifecycle v11.0 (audit → complete v11.0 → cleanup → tag → push).

</domain>

<decisions>
## Implementation Decisions (grounded in live facts 2026-07-27)

### MONEY flip — NOT viable this cycle → MONEY stays OFF (honest, SC2 path)
- Doblemente bloqueado: (a) `docs/legal/13-LEGAL-DOSSIER.md` `signoff: pending` (asesor vacío — sin firma legal); (b) datos MONEY VACÍOS (contrato 0, aporte 0 — backfills 70/71 diferidos en Phase 111). Encender expondría una feature vacía sin base legal.
- El agente NUNCA firma ni flipea. Presenta el checkpoint; el resultado esperado = "MONEY OFF declarado honesto". `.env.example` MONEY_PUBLIC_ENABLED=false intacto; anti-flip guard verde.

### Cold-reads (68/73/75)
- v11.0 pasadas 1-2 fueron backend/LLM; los backfills LIVE quedaron diferidos → NO hay superficie/datos nuevos que cold-readear vs v10.0. Sustituto estructural del agente: régime guards verdes (anti-insinuación, money-antiflip, lockdown en app 1428/1428), MONEY OFF verificado, sitio 200, /red no-regresión estructural. El veredicto humano "comprensible" queda abierto/diferido (patrón v7/v9/v10: gates del agente con evidencia, verdict humano abierto).

### Lifecycle
- v7.0 NO archivada (fases 64-75 = 12 dirs vivos en `.planning/phases/`). `complete-milestone v7.0` la archiva con deuda restante explícita (V7-02/03/04 LIVE + V7-07 secrets/rotación).
- v11.0: `audit-milestone` → `complete-milestone v11.0` → cleanup → tag v11.0 → push Cuchecorp/gov-map. Push = outward-facing → confirmación del operador antes de pushear/taggear.
- GOTCHA: los runbooks de v7.0 son load-bearing; si un comando de lifecycle borra `.planning/phases/`, `git restore` los recupera. Archivar es mover, no borrar.

### Quick tasks
- 5 quick tasks (260623-rtl, 260702-rbb, 260713-izo, 260715-bvd, 260722-eia) YA ejecutadas/deployadas en su momento; falta el marcador FORMAL de cierre en su dir + reflejo en STATE.md.

</decisions>

<code_context>
## Existing Code Insights
- `docs/legal/13-LEGAL-DOSSIER.md` — signoff YAML (single source of truth para el flip).
- `app/lib/money-gate.ts` — chokepoint `=== "true"`; anti-flip guard.
- Régime guards (app): anti-insinuación, money/vsim/notif-antiflip, lockdown, bento — verdes (111 run 1428/1428).
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev (200; v10.0 e89b79af, CSP ENFORCED).
- Runbooks cold-read: 68-BROWSEROS-GATE (votos), 73 (MONEY preview), 75 (/red).

</code_context>

<specifics>
## Specific Ideas
Cierre honesto: la pasada 3 cierra con deuda operador documentada (secrets/rotación 110; RUT-01+backfills 111; MONEY OFF 112). Patrón v7/v9/v10: checkpoint sin acción del operador = handoff documentado, la corrida CIERRA igual.

</specifics>

<deferred>
## Deferred Ideas
- Todos los LIVE writes (RUT-01, backfills, secrets, rotación) = deuda operador de 110/111.
- Encendido MONEY = tras sign-off legal + backfills (futuro).
</deferred>
