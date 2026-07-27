---
phase: 70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
plan: 03
subsystem: dinero (runbook operador-LOCAL + SPIKE)
tags: [dinero, chilecompra, backfill, runbook, spike, cuota, ocds, MONEY-01, DEBT-01, operador-local]
requires:
  - "run-dinero-masivo-cli.ts + runIngestDinero (wire dos-etapas + --from-r2, Plan 70-01)"
  - "señal freshness chilecompra sobre contratos_ingesta_estado.ingestado_hasta (Plan 70-02)"
  - "RUT-01 (Phase 69) poblado en la maestra remota — DEPENDENCIA DURA (checkpoint operador PENDIENTE)"
provides:
  - "70-BACKFILL-CHILECOMPRA-RUNBOOK.md: procedimiento operador-LOCAL end-to-end del crawl LIVE cuota-limitado reanudable"
  - "70-SPIKE-CUOTA-OCDS.md: registro cuota 10k/día no modificable + OCDS bulk deferred"
affects:
  - "Wave 2 operador-LOCAL: el crawl LIVE ChileCompra (PENDIENTE, no ejecutado por el agente)"
  - "MONEY-01 SC#4 (partición multi-día) documentado; MONEY-01 NO cerrado (crawl LIVE pendiente + flip Phase 73)"
tech-stack:
  added: []
  patterns:
    - "Runbook operador-LOCAL espejo de 66/67-BACKFILL: 7 secciones (pre-checks offline, derivar universo, particionar reanudable, corrida LIVE 2 etapas, replay --from-r2, reporte+freshness, cierre+rollback+seguridad)"
    - "Cuota 10k/día NO modificable → partición LOCAL multi-día reanudable OBLIGATORIA (hash-check R2 salta lo hecho, upsert clave-natural = no-op)"
    - "Ticket MERCADOPUBLICO_TICKET SOLO en .env (nunca argv), redactado en logs (CR-01)"
key-files:
  created:
    - .planning/phases/70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota/70-BACKFILL-CHILECOMPRA-RUNBOOK.md
    - .planning/phases/70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota/70-SPIKE-CUOTA-OCDS.md
  modified: []
decisions:
  - "El crawl LIVE ChileCompra NO se ejecutó (autonomous:false): consume cuota + ticket secreto + requiere RUT-01 poblado → deuda operador-LOCAL como en Phases 66/67"
  - "MONEY-01 NO se cierra: la partición multi-día (SC#4) queda DOCUMENTADA, pero la corrida LIVE + write PROD + el flip legal (Phase 73) siguen pendientes"
  - "OCDS bulk documentado como opción futura DEFERRED (parser fuera de alcance) — NO construido"
metrics:
  duration: "~9 min"
  completed: "2026-07-14"
  tasks: 2
  files: 2
---

# Phase 70 Plan 03: Runbook backfill ChileCompra operador-LOCAL + SPIKE cuota/OCDS Summary

Los dos documentos operativos que cierran la porción **documental** de MONEY-01 SC#4: un
**runbook operador-LOCAL end-to-end** para el crawl LIVE de contratos de ChileCompra a escala
(partición multi-día reanudable bajo la cuota de 10.000/día, replay `--from-r2` para la Etapa 2), y
el **registro del SPIKE** de cuota + mecánica bulk OCDS. El agente **NO** corrió el crawl LIVE,
**NO** consumió cuota, **NO** tocó `MERCADOPUBLICO`, **NO** escribió a PROD y **NO** flipeó
`MONEY_PUBLIC_ENABLED`. El crawl LIVE queda como **checkpoint bloqueante operador-LOCAL PENDIENTE**
(igual que Phases 66/67). **MONEY-01 NO se cierra.**

## What Was Built

**Task 1 — `70-BACKFILL-CHILECOMPRA-RUNBOOK.md` (281 líneas):** espejo de `66-BACKFILL-RUNBOOK.md`
adaptado a dinero, con 7 secciones y flags **reales** verificados contra
`packages/dinero/src/run-dinero-masivo-cli.ts` (`--rut`/`--dia`/`--ruts-file`/`--from-r2`/`--dry-run`;
`@obs/dinero` es el filtro pnpm):
1. **PRE-CHECKS offline** — (1) la **DEPENDENCIA DURA RUT-01** (Phase 69): sin RUTs cruzables el
   crawl no tiene universo → `count(entidad_tercero.rut) > 0` o DETENER; (2) suite dinero 115 +
   freshness 31 verdes + guards frozen no muerden; (3) `MONEY_PUBLIC_ENABLED` OFF; (4) `.env` con
   `MERCADOPUBLICO_TICKET`+R2_*+SUPABASE_*; (5) probe opcional de forma.
2. **DERIVAR EL UNIVERSO DE RUTs** — paginado (cap 1k PostgREST) + ASSERT ruidoso (backfill vacío
   es silencioso).
3. **PARTICIONAR PARA REANUDABLE** — costo por RUT (1 paso 1 + N paso 2, tope 366 días/llamada);
   lotes `(RUTs × ventana)` < 10.000 req/día; hash-check R2 salta lo hecho; idempotencia clave-natural.
4. **CORRIDA LIVE** — Etapa 1 fuente→R2 (put-gatea-upsert, fail-closed) + Etapa 2 R2→Supabase, lote
   por lote, **rate-limit 2-3s LOCKED**, ticket NUNCA en argv, verificación de destino REMOTO en log.
5. **REPLAY `--from-r2`** — Etapa 2 desde R2 sin re-tocar la fuente ni consumir cuota (deriva la
   tarea del envelope).
6. **REPORTE + freshness** — conteos + `pnpm freshness` mostrando la fila `chilecompra` pasar de
   STALE (n/d) a un `ingestado_hasta` real.
7. **CIERRE + ROLLBACK + SEGURIDAD** — 429/cuota-agotada → reanudar al día siguiente (cuota NO
   modificable); operador-LOCAL / NOT GitHub Actions; ticket solo en `.env` redactado; R2 creds solo
   en `.env`; `MONEY_PUBLIC_ENABLED` se queda OFF (flip = Phase 73).

**Task 2 — `70-SPIKE-CUOTA-OCDS.md` (97 líneas):** registra (a) cuota **10.000/día NO modificable**
`[ayuda.mercadopublico.cl]`; (b) costo por RUT + cota grosera ~6 RUTs/día bajo cuota (ventanas
cortas bajan mucho); (c) partición LOCAL multi-día obligatoria (→ runbook); (d) **OCDS bulk** JSONL
mensual `[datos-abiertos.chilecompra.cl]` esquiva la cuota (descarga de archivos, no API) PERO su
parser difiere del REST ya parseado → **DEFERRED / fuera de alcance** (opción futura, no construida);
(e) universo de RUTs depende de **RUT-01** (checkpoint operador pendiente); (f) el **LIVE NO se probó
en sesión** (ticket secreto; consumir cuota sería irrespetuoso; el probe es herramienta del operador).

## Verification Results

- `70-BACKFILL-CHILECOMPRA-RUNBOOK.md` — **281 líneas** (≥60), `grep run-dinero-masivo-cli` OK.
- `70-SPIKE-CUOTA-OCDS.md` — **97 líneas** (≥30), `grep OCDS` OK, `grep defer|fuera de alcance` OK.
- Flags del CLI verificados **verbatim** contra `run-dinero-masivo-cli.ts` (no inventados):
  `--rut`/`--dia` (8 dígitos)/`--ruts-file`/`--from-r2`/`--dry-run`; ticket de env vía
  `env.MERCADOPUBLICO_TICKET`; `--from-r2` lanza `DineroMasivoArgsError` sin R2.
- 100% documental: **cero** fetch LIVE, cero consumo de cuota, `MONEY_PUBLIC_ENABLED` no tocado,
  RUT-01 no escrito.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Las Tasks 1 y 2 se commitearon juntas en
`45f5bfc` (ambos son docs de la misma unidad; el plan pide `docs(70-03)` para cada una y ambas
comparten el mismo tipo/scope de commit).

## BLOCKING Operator Checkpoint (Task 3 — human-action, PENDING)

El crawl LIVE de ChileCompra es un **checkpoint `human-action` bloqueante, operador-LOCAL, NO
ejecutado por el agente** (autonomous:false). Queda PENDIENTE con dos dependencias:

- **RUT-01 (Phase 69):** debe estar poblado en la maestra remota ANTES del crawl (sin RUTs no hay
  universo). Checkpoint operador de Phase 69 aún PENDIENTE (bloqueante duro de todo P5).
- **Ticket + cuota:** el crawl consume `MERCADOPUBLICO_TICKET` (secreto de operador) bajo la cuota
  de 10.000/día. El agente no dispone del ticket ni debe gastar cuota.

Cuando el operador decida ejecutarlo: seguir `70-BACKFILL-CHILECOMPRA-RUNBOOK.md` end-to-end y
reportar cobertura (N contratos / K contratistas) + `pnpm freshness` con ChileCompra fresco.
**`MONEY_PUBLIC_ENABLED` sigue OFF** — los contratos aterrizan en DB pero NO se presentan
públicamente hasta el flip legal de **Phase 73**.

**MONEY-01 NO se cierra en este plan.** La partición multi-día (SC#4) queda documentada; la corrida
LIVE + write PROD + el flip legal siguen pendientes. **Resume-signal:** el operador escribe
`"runbook entregado"` (deja el crawl como deuda operador-LOCAL, como Phases 66/67), o describe
ajustes al runbook.

## Known Stubs

None — los documentos referencian símbolos y flags **reales** (CLI `run-dinero-masivo-cli.ts` con
flags verificados; señal freshness `chilecompra` de Plan 70-02; `entidad_tercero.rut` de RUT-01). No
hay valores placeholder ni datos fabricados: los datos reales los produce el crawl LIVE operador.

## Threat Flags

Ninguno. Los documentos no introducen superficie de seguridad nueva (no ejecutan nada). Refuerzan
los mitigate del register: **T-70-09** (abuso de cuota → runbook documenta partición < 10k/día,
rate-limit 2-3s LOCKED, hash-check reanudable; el agente no corre el crawl); **T-70-10** (ticket en
argv/logs → runbook instruye ticket SOLO en `.env`, `redactarTicket` cubre logs); **T-70-11**
(encendido prematuro de MONEY → runbook confirma `MONEY_PUBLIC_ENABLED` OFF; el flip es Phase 73,
acto humano legal; ni el agente ni el runbook lo flipean).

## Self-Check: PASSED

- FOUND: .planning/phases/70-.../70-BACKFILL-CHILECOMPRA-RUNBOOK.md (281 líneas)
- FOUND: .planning/phases/70-.../70-SPIKE-CUOTA-OCDS.md (97 líneas)
- FOUND commit 45f5bfc (docs runbook + spike)
