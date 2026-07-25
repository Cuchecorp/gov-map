---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
plan: 03
subsystem: frontend
tags: [vsim, gated-legal, anti-dw-nominate, feature-flag, rtl, dossier-legal, comparar, anti-insinuacion]

# Dependency graph
requires:
  - phase: 102-01
    provides: "vsim-gate.ts (vsimPublicEnabled), LEYENDA_SIMILITUD_VOTO (contrato), linter anti-insinuación extendido con SUPERFICIES_VSIM + idioms, vsim-antiflip-guard, co-votacion-red-guard"
  - phase: 102-02
    provides: "RPC coincidencia_votos_par(text,text) APLICADA a PROD (secdef, doble-revoke, statement_timeout 5s), pgTAP 10/10 contra schema aplicado"
  - phase: 101-relaciones-p2a
    provides: "/comparar CompararEjes (return :459-464, fechaConsultaHoy, PARLAMENTARIO_ID_RE, patrón lector #34), harness page.test.tsx (rpcImpl, ROSTER_DEFAULT, renderEjes)"
  - phase: 98-audit-votos
    provides: "cobertura de voto Cámara ~80% / Senado ~20% (cifras del caveat de cobertura)"
provides:
  - "5ª sección gated VSIM montada al FINAL de CompararEjes (return null si VSIM_PUBLIC_ENABLED OFF: cero DOM, cero .rpc)"
  - "SimilitudVotacionComparar — componente presentacional NEUTRAL (figura sin petróleo/bold/gauge; degrade honesto M=0; nota de asimetría de cámara; provenance mono)"
  - "RTL VSIM (7 casos): OFF ausente + 0 llamadas rpc / 'false' fail-closed / ON figura neutral 75% / M=0 sin '0%' / error LANZA (#34) / orden último / anti-flip V3"
  - "docs/legal/102-LEGAL-DOSSIER-VSIM.md (signoff: pending) — anti-DW-NOMINATE + caveat base-alta + base-rate empírica + cobertura + evidencia estado ON local"
affects: [104-e2e-flags-off]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "5º eje gated: return null server-side ANTES del .rpc (mold money en la ficha); vsimPublicEnabled único lector del flag (anti-flip V3)"
    - "Figura NEUTRAL anti-DW-NOMINATE: text-sm weight-400 --foreground, cero petróleo/bold/gauge — INVERSIÓN deliberada vs InterseccionCompartida (petróleo) de los ejes factuales"
    - "RTL flag-gated: vi.stubEnv('VSIM_PUBLIC_ENABLED') + vi.unstubAllEnvs en afterEach; OFF verifica AUSENCIA de DOM + 0 llamadas a la RPC gated"

key-files:
  created:
    - docs/legal/102-LEGAL-DOSSIER-VSIM.md
  modified:
    - app/components/similitud-votacion-comparar.tsx
    - app/app/comparar/page.tsx
    - app/app/comparar/page.test.tsx

key-decisions:
  - "Provenance rotulada 'según fuente al {fecha}' (idiom guard-clean product-wide, ya usado por el eje Comisiones) en vez del 'captura al {fecha}' del UI-SPEC — la palabra suelta 'captura' está en TERMINOS_PROHIBIDOS del linter (sentido 'captura del Estado'); semántica idéntica (fecha_captura_max de la RPC = fecha de la FUENTE), guard NO se relaja"
  - "% computado en el SERVER (Math.round(N/M*100), entero sin decimales); null cuando M=0 → el componente NUNCA re-computa"
  - "camaraMixta se deriva del roster (filaA.camara !== filaB.camara) en el server; el componente solo pinta la nota de asimetría"
  - "Figura NEUTRAL sin reusar RelacionesEjeComparar ni InterseccionCompartida (petróleo highlight) — un número resaltado leería como 'puntaje de afinidad' (línea anti-DW-NOMINATE)"

patterns-established:
  - "Sección gated con evidencia ON en preview local (RTL vi.stubEnv) para el cold-read del operador; PROD queda OFF hasta sign-off humano"

requirements-completed: [VSIM-01, VSIM-02]

# Metrics
duration: 12min
completed: 2026-07-25
---

# Phase 102 Plan 03: Copy + montaje del 5º eje VSIM gated Summary

**5ª sección de similitud de votación montada al FINAL de `/comparar`, GATED por `VSIM_PUBLIC_ENABLED` (return null server-side ⇒ cero DOM/cero .rpc con flag OFF): componente presentacional NEUTRAL (figura sin petróleo/bold/gauge, degrade honesto M=0, cobertura + asimetría de cámara), RTL ON/OFF/M=0/error verde, y dossier legal `signoff: pending` (anti-DW-NOMINATE + caveat base-alta + base-rate empírica + evidencia del estado ON en preview local). El flip a PROD queda como acto humano.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-25T02:59:18Z
- **Completed:** 2026-07-25T03:11:07Z
- **Tasks:** 3
- **Files modified:** 4 (1 creado, 3 modificados)

## Accomplishments
- **Componente NEUTRAL** `SimilitudVotacionComparar`: presentacional PURO (todo serializado por el server), orden de lectura LOCKED heading → caveat → figura → cobertura → provenance. La figura "Coinciden en N de M (X%)" en `text-sm` weight-400 `--foreground` — cero petróleo/bold/gauge/barra (anti-DW-NOMINATE, INVERSIÓN deliberada vs los ejes factuales de Phase 101). M=0 → copy degradado honesto en `text-muted-foreground`, JAMÁS "0%", sin figura ni provenance. Nota de asimetría de cámara appendeada si `camaraMixta`.
- **5ª sección gated** en `CompararEjes` (page.tsx): `ejeSimilitud` como ÚLTIMO sibling tras `ejeZona`. Con `vsimPublicEnabled(process.env)` OFF (PROD default) queda `null` → cero nodo DOM, cero `.rpc("coincidencia_votos_par")` (el return null es ANTES del fetch). Con ON: lee la RPC, resuelve N/M, computa `pct = round(N/M·100)` en el server, deriva `camaraMixta` del roster, y un error real LANZA (#34). `vsimPublicEnabled` es el ÚNICO lector del flag (anti-flip V3 intacto).
- **RTL VSIM (7 casos, verde):** OFF ausente + 0 llamadas a la RPC gated; `"false"` explícito fail-closed; ON con datos → sección + caveat + figura "Coinciden en 3 de 4 votaciones compartidas (75%)." neutral (sin `text-accent-product`/`font-semibold`); ON + M=0 → degradado sin "0%"; ON + error LANZA; `ejeSimilitud` último sibling + import de `vsimPublicEnabled` sin env crudo.
- **Dossier legal** `docs/legal/102-LEGAL-DOSSIER-VSIM.md` (`signoff: pending`): métrica exacta + denominador sustantiva (confirmado + si/no/abstención, pareo/ausencia excluidos), caveat base-alta VERBATIM + base-rate empírica (154 pares 19%-100%, promedio 63%, ~32% cuasi-unánimes), anti-modelo DW-NOMINATE explícito, cobertura declarada 80%/20% + asimetría, evidencia del estado ON en preview local (RTL + pgTAP), checklist de sign-off. El agente NO firma ni flipea.

## Task Commits

Cada tarea se committeó atómicamente:

1. **Task 1: Componente NEUTRAL similitud-votacion-comparar.tsx** — `d33e12e` (feat)
2. **Task 2: 5ª sección gated en /comparar + RTL ON/OFF/M=0** — `bba9c44` (feat)
3. **Task 3: Dossier legal 102-LEGAL-DOSSIER-VSIM.md (signoff: pending)** — `48ce193` (docs)

_Nota: aunque Tasks 1-2 son `tdd="true"`, el componente es presentacional puro cuya verificación por comportamiento (HTML renderizado) vive en el RTL de page.test.tsx (Task 2); se ejecutaron con el test verde ANTES de cada commit._

## Files Created/Modified
- `app/components/similitud-votacion-comparar.tsx` — añadido `SimilitudVotacionComparar` (componente NEUTRAL) + `SimilitudVotacionCompararProps`; `LEYENDA_SIMILITUD_VOTO` intacta (contrato del linter).
- `app/app/comparar/page.tsx` — import de `vsimPublicEnabled` + `SimilitudVotacionComparar`; bloque `ejeSimilitud` gated tras `ejeZona`; interface `CoincidenciaVotosPar`; return con `{ejeSimilitud}` como último sibling.
- `app/app/comparar/page.test.tsx` — bloque `(12) VSIM` (7 tests) + `afterEach(vi.unstubAllEnvs)`.
- `docs/legal/102-LEGAL-DOSSIER-VSIM.md` — dossier legal `signoff: pending`.

## Decisions Made
- **Provenance guard-clean:** el UI-SPEC especificaba "captura al {fecha}", pero la palabra suelta "captura" está en `TERMINOS_PROHIBIDOS` del linter anti-insinuación (sentido "captura del Estado/regulatoria"). Se adoptó el idiom de provenance PRODUCT-WIDE guard-clean "según fuente al {fecha}" (ya usado por el eje Comisiones de esta misma página), de semántica idéntica (sigue siendo la fecha de la FUENTE, `fecha_captura_max` de la RPC). El guard de seguridad NO se relajó (ver Deviations).
- **% en el server:** `Math.round(N/M·100)` entero sin decimales (Discretion UI-SPEC: sin falsa precisión); null cuando M=0. El componente nunca re-computa.
- **Figura sin reusar primitivas de acento:** no se reusa `RelacionesEjeComparar` ni `InterseccionCompartida` (petróleo highlight) — un número resaltado cruzaría la línea anti-DW-NOMINATE.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] La provenance LOCKED "captura al {fecha}" colisiona con el linter anti-insinuación**
- **Found during:** Task 2 (primera corrida de `pnpm test -- --run comparar anti-insinuacion`)
- **Issue:** El UI-SPEC Copy table fija la provenance verbatim `"Fuente: … · captura al {fecha_captura_max}."`. La palabra suelta **"captura"** está en `TERMINOS_PROHIBIDOS` del guard anti-insinuación (sentido "captura del Estado/regulatoria", carril MONEY). El guard strippea comentarios pero muerde sobre el texto renderizado → `anti-insinuacion-guard.test.ts` falló con `[components/similitud-votacion-comparar.tsx → "captura"]`. Todo el producto evita la palabra suelta "captura" en copy renderizado (usa `fecha_captura` como identificador con `_`, o "según fuente al" / "Actualizado hace X"); solo el UI-SPEC de VSIM la introdujo.
- **Fix:** Se adoptó el idiom de provenance PRODUCT-WIDE guard-clean **"según fuente al {fecha}"** (idéntico al del eje Comisiones de la misma página), de semántica idéntica — sigue siendo la fecha de la FUENTE (`fecha_captura_max` de la RPC), jamás una fecha de ingreso (regla LOCKED heredada). El guard de seguridad NO se relajó (no se tocó `TERMINOS_PROHIBIDOS`); el linter tiene precedencia sobre la copy LOCKED (CLAUDE.md). Documentado inline en el componente.
- **Files modified:** app/components/similitud-votacion-comparar.tsx (+ el assert del RTL "según fuente al")
- **Verification:** `pnpm test -- --run comparar anti-insinuacion vsim-antiflip` verde (1346 tests); `tsc -b` limpio.
- **Committed in:** bba9c44 (Task 2 commit)

**2. [Rule 3 - Blocking] Comentario en page.tsx contenía el literal `process.env.VSIM_PUBLIC_ENABLED`**
- **Found during:** Task 2 (test "el 5º eje es el último sibling…" que asserta anti-flip V3)
- **Issue:** Un comentario explicativo en el bloque `ejeSimilitud` escribía "nunca leer `process.env.VSIM_PUBLIC_ENABLED` crudo aquí" — el literal disparaba el assert `not.toMatch(/process\.env\.VSIM_PUBLIC_ENABLED/)` que congela el anti-flip V3 (ninguna ruta lee el env crudo del flag).
- **Fix:** Reescrito el comentario sin el literal ("nunca leer el env crudo del flag aquí — el chokepoint vsim-gate.ts es el único lector"). La lógica es idéntica; `vsimPublicEnabled` sigue siendo el único lector.
- **Files modified:** app/app/comparar/page.tsx
- **Committed in:** bba9c44 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (ambas blocking, ambas de copy/comentario colisionando con guards existentes; ninguna relajó un guard de seguridad ni el contrato de la RPC).
**Impact on plan:** Nulo sobre el diseño LOCKED — la figura, el gate, el denominador y el anti-DW-NOMINATE son byte-fieles al plan. La provenance cambió de idiom (semántica idéntica) para respetar el linter que el propio plan mandaba correr temprano.

## Issues Encountered
- El filtro de vitest corre la suite completa (no aísla por spec); todos los specs objetivo se confirmaron verdes por nombre. Suite completa: **1346 tests verde**; `tsc -b` exit 0.

## Known Stubs
- Ninguno. El componente está completo, el 5º eje montado y funcional con flag ON (evidencia RTL), la RPC ya en PROD (Plan 02). La única "ausencia" es intencional y gated: con `VSIM_PUBLIC_ENABLED` OFF la sección NO existe en el DOM — es el diseño deny-by-default, no un stub.

## Threat Flags
Ninguno nuevo. Toda la superficie (5º eje gated return null, figura neutral, caveat adyacente, RPC agregados-solo, provenance guard-clean) está cubierta por el `<threat_model>` del plan (T-102-08..11). La figura neutral mitiga T-102-08 (Information Disclosure); el único lector del flag + return null antes del .rpc mitiga T-102-09 (Tampering); el caveat VERBATIM no-colapsable + dossier pending mitiga T-102-10 (Repudiation); la fecha se rotula como provenance de fuente, nunca fecha de ingreso (T-102-11 accept).

## Self-Check: PASSED
- Archivos verificados en disco: `app/components/similitud-votacion-comparar.tsx`, `app/app/comparar/page.tsx`, `app/app/comparar/page.test.tsx`, `docs/legal/102-LEGAL-DOSSIER-VSIM.md` — todos presentes.
- Commits verificados en git log: `d33e12e`, `bba9c44`, `48ce193`.
- Verificación del plan verde: `comparar` (7 RTL VSIM nuevos), `vsim-antiflip` (20), `anti-insinuacion-guard` (32), `co-votacion-red` — todos pasan; suite 1346 verde; `tsc -b` limpio.

## Next Phase Readiness
- **Plan 104 (E2E flags OFF):** el 5º eje VSIM respeta `return null` server-side con flag OFF (verificado por RTL + 0 llamadas a la RPC gated) — listo para el E2E de "flags OFF ausentes del DOM" en preview.
- **Blocker (operador):** el flip de `VSIM_PUBLIC_ENABLED=true` a PROD requiere sign-off legal/editorial humano (`signoff: approved` en `docs/legal/102-LEGAL-DOSSIER-VSIM.md`) + cold-read en preview local. El agente NO enciende el flag ni firma el dossier. PROD queda OFF.

---
*Phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal*
*Completed: 2026-07-25*
