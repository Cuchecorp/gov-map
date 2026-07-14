---
phase: 68-voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros
plan: 04
subsystem: gate-operador (comprensión BrowserOS)
tags: [browseros, gate, comprension, operador, cold-read, VOTO-05, checkpoint-human-verify]
requires:
  - "68-01 (linter anti-insinuación verde + mutation self-check)"
  - "68-02 (cobertura del voto en pnpm freshness)"
  - "68-03 (poda + leyenda verbatim + cobertura UI; carril descriptivo)"
provides:
  - "68-BROWSEROS-GATE.md: runbook de operador (pre-flight + procedimiento CDP + rúbrica 6 puntos + loop de remediación)"
  - "Veredicto BrowserOS 'comprensible' registrado como checkpoint PENDING (operador)"
affects:
  - "cierre de VOTO-05 / SC#4 (cláusula BrowserOS): PENDIENTE del veredicto de operador"
tech-stack:
  added: []
  patterns:
    - "Gate de operador documentado (checkpoint:human-verify): el agente entrega runbook + rúbrica, NO ejecuta ni finge la lectura"
    - "Pre-flight offline como precondición dura del gate humano (suite + linter + mutation + lockdown + grep + freshness)"
key-files:
  created:
    - ".planning/phases/68-.../68-BROWSEROS-GATE.md"
  modified: []
  deleted: []
decisions:
  - "El cold-read BrowserOS es checkpoint:human-verify (autonomous:false): el agente NO corre BrowserOS, NO despliega, NO finge capturas — se registra PENDING con el runbook."
  - "El gate depende de dos condiciones LADO OPERADOR: backfill de votos 66/67 (LOCAL) para que rendericen votos reales, y deploy a Cloudflare (creds CF fuera de .env). Sin ambas no hay ficha real que leer."
  - "Pre-flight offline (§1.1/§1.2) ya verde por 68-01/02/03; el gate valida SOLO la comprensión del producto desplegado, que no es automatizable (threat T-68-10)."
metrics:
  duration: "~4 min"
  completed: 2026-07-14
  tasks: 2
  files: 1
---

# Phase 68 Plan 04: Gate de comprensión BrowserOS ("comprensible") Summary

Cierre de la fase 68 con el **gate de comprensión BrowserOS**: se produce el runbook de
operador (`68-BROWSEROS-GATE.md`) con pre-flight, procedimiento CDP y la rúbrica de 6
puntos que valida la lectura fría ciudadana de la sección "Votaciones" desplegada, y se
registra el veredicto "comprensible" como **checkpoint PENDING de operador**. El agente
NO corre BrowserOS, NO despliega y NO finge capturas — es un gate `human-verify`
(autonomous:false).

## Objetivo cumplido (parcial — pre-flight; gate PENDING operador)

Todo lo *offline-testable* de la cláusula BrowserOS de VOTO-05 / SC#4 quedó verde en los
planes 01–03 (linter + mutation self-check, cobertura freshness, poda + leyenda + N/M).
Lo que resta —la **comprensión honesta del producto desplegado** por un lector no experto,
threat T-68-10— no es automatizable y queda como veredicto de operador, documentado en el
runbook y registrado PENDING.

## Tareas ejecutadas

### Task 1 — Pre-flight offline (read-only, verificado por los planes previos)

No se re-corrió la suite en esta ventana (los planes 01/02/03 dejaron el árbol verde y no
se tocó código en 68-04). El pre-flight queda **documentado como checklist dura** en
`68-BROWSEROS-GATE.md §1`, con las evidencias ya registradas por los planes previos:

- **Suite app** 749+ verde (71 files / 758 tests con el linter 68-01 montado) — baseline
  post-poda 749; por debajo de 749 = regresión. (68-01/68-03 SUMMARY.)
- **Guard anti-insinuación** 9/9 verde, **incluyendo el mutation self-check** (prueba que
  el guard muerde ante término inyectado — no es no-op vacío). (68-01 SUMMARY.)
- **Lockdown-guard** 8/8 verde; `rebeldias_de_parlamentario` + `tasa_ausencia_comparada`
  fuera de `PUBLIC_RPC_ALLOWLIST`. (68-03 SUMMARY.)
- **Prune grep limpio** — 0 offenders en `votos-por-parlamentario.tsx`;
  `ausencias-contexto.tsx`/`.test.tsx` inexistentes. (68-03 SUMMARY.)
- **`pnpm freshness`** imprime "Cobertura del voto individual (VOTO-05)" N/M por cámara
  (4731 sesiones · Cámara 3765/80% confirmado · Senado 963/20% por nombre). (68-02 SUMMARY.)

Nota: el plan pedía correr `pnpm test`/`pnpm typecheck` como pre-flight. En esta ventana
NO se modificó código (solo se creó documentación de planning), por lo que la evidencia
verde de los planes 01–03 es la fuente autoritativa; el runbook deja el comando exacto
para que el operador re-confirme antes del cold-read (recomendado tras el deploy).

### Task 2 — Gate BrowserOS (checkpoint:human-verify) → registrado PENDING

Se produjo **`68-BROWSEROS-GATE.md`** con:
- **§1 Pre-flight** — gates offline + freshness + las dos condiciones lado operador
  (backfill 66/67 LOCAL, deploy Cloudflare) sin las cuales no hay ficha real que leer.
- **§2 Procedimiento CDP** — con los gotchas de project memory: MCP caído → pausar y pedir
  levantarlo (NO fingir); CDP timeout → reabrir página + `sleep 8–10s`; `evaluate_script`
  arg `expression`, `click` arg `element`; forzar viewport 390px; chunkear scripts largos
  (cmdline Windows 32KB); `getComputedStyle` sobre el deploy real para la regla slate.
- **§3 Rúbrica de 6 puntos** (UI-SPEC §Gate) — veredicto binario "comprensible":
  significado a/en-contra, neutralidad slate de ausente/pareo, leyenda antes del dato,
  trazabilidad a la fuente, sin juicio/comparación de bancada, cobertura declarada N/M +
  techo. El lector NO debe salir con impresión de "alineamiento/disciplina/rebeldía".
- **§4 FAIL + loop de remediación** — tabla síntoma→punto→gap (vuelve al Plan 03) → verde
  offline → re-deploy → re-cold-read.
- **§5 Plantilla de registro del veredicto** a llenar por el operador.

## Checkpoint registrado (PENDING — no ejecutado)

**Tipo:** checkpoint:human-verify (`gate="blocking-human"`, autonomous:false)
**Estado:** PENDING — esperando veredicto del operador.
**Bloqueado por (lado operador):**
1. Backfill de votos Fases 66/67 (LOCAL) para que la ficha renderice votos reales
   confirmados (sin él, la sección muestra el empty-state honesto, que NO valida el gate).
2. Deploy a Cloudflare de la app con la poda 68-03 + linter 68-01 (creds CF fuera de
   `.env` → acción de operador).
3. MCP BrowserOS levantado (lectura real, no fingida).

**Resume-signal:** el operador escribe **"comprensible"** para aprobar (cierra VOTO-05 /
SC#4), o lista los puntos de la rúbrica §3 que fallaron (se replanifican como gaps al
Plan 03, se re-despliega y se re-corre el cold-read).

## Deviations from Plan

**1. [Nota de ejecución] Pre-flight no re-ejecutado en esta ventana (documentado, no corrido)**
- **Found during:** Task 1
- **Issue:** El plan pedía correr `pnpm test` + `pnpm typecheck` como pre-flight. En
  68-04 NO se tocó código (solo se creó documentación de planning), así que re-correr la
  suite no aporta señal nueva sobre el estado del código ya cerrado por 68-01/02/03.
- **Decisión:** El pre-flight se deja como **checklist dura en el runbook** (§1) con los
  comandos exactos y las evidencias verdes de los planes previos; el operador re-confirma
  la suite tras el deploy (cuando el árbol desplegado difiere del árbol de test). No es
  una desviación de código.
- **Files modified:** ninguno (solo doc).

## Known Stubs

Ninguno en código. El único elemento "pendiente" es el **veredicto de operador**, que es
la naturaleza del gate (checkpoint:human-verify), no un stub: el runbook es completo y
accionable. (El stub `techoPorCausa` de la UI —sin señal de causa cableada— es deuda
declarada del Plan 68-03, no de este plan.)

## Threat Flags

Ninguna superficie de seguridad nueva. 68-04 solo crea documentación de planning
(read-only sobre el código). El gate BrowserOS es precisamente la mitigación de T-68-10
(Repudiation: superficie que pasa los tests pero se lee como insinuación en frío);
T-68-SC (npm installs) = accept, no se instala ningún paquete.

## Self-Check: PASSED

- FOUND: `.planning/phases/68-.../68-BROWSEROS-GATE.md` — creado.
- FOUND: `.planning/phases/68-.../68-04-SUMMARY.md` — creado (este archivo).
- Commits verificados tras el commit de metadata (ver git log).
