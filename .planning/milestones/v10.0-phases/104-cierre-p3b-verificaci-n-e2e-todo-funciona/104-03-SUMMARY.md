---
phase: 104-cierre-p3b-verificaci-n-e2e-todo-funciona
plan: 03
subsystem: testing
tags: [e2e, verification, vsim, relaciones, panel, cloudflare, opennext, partido]

requires:
  - phase: 104-02
    provides: "deploy v10.0 (v3cd2511d, arrastra 101+102+103) + flip VSIM ON"
  - phase: 102
    provides: "eje VSIM /comparar + RPC coincidencia_votos_par (0068) + dossier firmado"
  - phase: 101
    provides: "bloque relaciones above-the-fold + /comparar 4 ejes + 101-HUMAN-UAT"
  - phase: 100
    provides: "panel de actualidad (señales vivas)"
provides:
  - "Inventario E2E v10.0 por superficie con cross-check SQL sobre el deploy real (104-E2E-EVIDENCIA.md)"
  - "101-HUMAN-UAT cerrado (3/3 pass, status complete)"
  - "Fix URI-como-partido (partidoLegible) — 3 sitios de render saneados + 3 redeploys"
  - "Versión en producción tras el E2E: b467d41a"
affects: [milestone-close, v10.0, new-milestone]

tech-stack:
  added: []
  patterns:
    - "partidoLegible(): saneamiento display-only de URI RDF de BCN → nombre del slug (cero tildes fabricadas)"
    - "Clave de filtro RAW / label saneado: la faceta partido sanea el label pero conserva la clave de agrupación cruda (identidad de grupo intacta)"

key-files:
  created:
    - ".planning/phases/104-cierre-p3b-verificaci-n-e2e-todo-funciona/104-E2E-EVIDENCIA.md"
  modified:
    - "app/lib/format.ts (partidoLegible + tests)"
    - "app/components/partido-chip.tsx"
    - "app/components/militancias-de-parlamentario.tsx"
    - "app/components/parlamentarios-filtro.tsx"
    - ".planning/phases/101-.../101-HUMAN-UAT.md (cerrado)"
    - ".planning/phases/104-.../104-DEPLOY-RUNBOOK.md (redeploys)"

key-decisions:
  - "VSIM '(100%)' para 3655/3672 es dossier-compliant (X=round firmado §43; base-rate 19-100% §83; caveat base-alta neutraliza la lectura) — NO se cambia round a floor/decimal"
  - "URI-como-partido (S1344): fix display-only en las 3 superficies de render; la clave de filtro serializada se deja RAW (no-visible) para no fusionar partidos de URI distinta"

patterns-established:
  - "partidoLegible(): un solo helper enchufado en cada chokepoint de render de partido"
  - "Redeploy targeted: copiar solo los archivos cambiados al mirror C:\\Temp\\obs-build (evita robocopy /MIR y su re-escritura de helper scripts)"

requirements-completed: [E2E-01]

duration: ~120min
completed: 2026-07-26
---

# Phase 104 Plan 03: Inventario E2E v10.0 Summary

**Inventario E2E de cada superficie nueva de v10.0 × dato real × cross-check SQL sobre el deploy real; VSIM cuadra contra recálculo `coincidencia_votos_par` para 3 pares; defecto URI-como-partido detectado, corregido en 3 superficies de render y re-desplegado (v`b467d41a`), 101-HUMAN-UAT cerrado.**

## Performance

- **Duration:** ~120 min (3 ciclos build+deploy Docker incluidos)
- **Started:** 2026-07-26 (post 104-02)
- **Completed:** 2026-07-26
- **Tasks:** 3
- **Files modified:** 6 (4 código + 2 docs) + 1 doc creado

## Accomplishments

- **Panel:** 6 tipos de señal vivos (SQL) reflejados en home con Fuente+fecha por tile, supresión-como-fila honesta ("sin nuevos ingresos… en las fuentes consultadas al…", NO "sin movimiento"), cero ranking, cero "captura" pelado, sin cifra 548k.
- **Relaciones en ficha:** `<section id="relaciones">` above-the-fold en D1074 (alto) y S1110 (bajo); cada conteo del DOM == `total_n` de la RPC (co-autoría D1074=94, S1110=28; militancia S1110=11); truncamiento >20 declarado ("Mostrando los primeros 8 de 94"); orden alfabético.
- **/comparar:** 4 ejes factuales honestos (cross-cámara → "no comparten comisiones"); **VSIM ON** con caveat base-alta VERBATIM adyacente + cobertura 80/20 + figura neutral; N/M cuadra contra SQL para **3 pares reales** (D1165/D1170=3655/3672; D1009/D1012=932/2495; M=0 D1009/S1110 → "Sin votaciones compartidas suficientes").
- **Flags OFF:** NOTIF ausente del DOM (Seguir/`/cuenta`=0), `/cuenta` gated 200; MONEY sin datos (solo placeholder legal "Pendiente de revisión legal Ley 21.719").
- **101-HUMAN-UAT cerrado:** 3/3 tests pass (grid above-the-fold, /comparar 4 ejes, CTA "Comparar con otro parlamentario" con `href="/comparar?a=D1074"` = slot A pre-llenado).
- **Guards + suite verdes post-deploy:** 9 guards de régimen 209 tests + suite app 1424 tests, tsc 0.

## Task Commits

1. **Task 1 fix (Rule 1): URI-partido en PartidoChip** — `a6f4057` (fix)
2. **Task 1/2 fix (Rule 1): URI-partido en MilitanciasDeParlamentario** — `34e4df2` (fix)
3. **Task 1/2 fix (Rule 1): URI-partido en label faceta directorio** — `2b86707` (fix)
4. **Tasks 1-3 evidencia + cierre UAT + runbook** — `d800a09` (docs)

**Plan metadata:** (final commit docs 104-03)

## Files Created/Modified

- `104-E2E-EVIDENCIA.md` — Inventario E2E por superficie (URL, SQL vs DOM, tabla resumen).
- `app/lib/format.ts` — `partidoLegible()` (+ 6 tests) — sanea URI RDF de BCN → nombre del slug.
- `app/components/partido-chip.tsx` — usa `partidoLegible` (chip ficha + directorio).
- `app/components/militancias-de-parlamentario.tsx` — `partidoLegible` en vigente + histórico.
- `app/components/parlamentarios-filtro.tsx` — `partidoLegible` en el label de la faceta (clave RAW).
- `101-HUMAN-UAT.md` — 3/3 pass, status complete.
- `104-DEPLOY-RUNBOOK.md` — registro de los 3 redeploys del E2E (v final `b467d41a`).

## Decisions Made

- **VSIM "(100%)" para 3655/3672 NO es defecto:** el dossier legal VSIM fija la cifra VERBATIM `X = round(N/M·100)` (§43) y declara la base-rate empírica "19% a 100%" (§83) → 100% es un valor esperado y firmado (~32% de pares cuasi-unánimes). La lectura deshonesta la neutraliza el caveat base-alta obligatorio adyacente. Cambiar `round`→`floor`/decimal desviaría de una cifra legalmente firmada (Rule 4) sin ganancia de honestidad. Se conserva `round`.
- **URI-como-partido:** fix display-only en las 3 superficies de render; la clave de filtro serializada en el payload RSC se deja RAW (no-visible) para no arriesgar fusionar partidos de URI distinta que colapsen al mismo label.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] URI-como-partido en 3 superficies de render**
- **Found during:** Task 1 (E2E relaciones/ficha) — detectado por SQL scan (`partido like 'http%'` → S1344, 1 fila) + confirmado en DOM del deploy.
- **Issue:** `/parlamentario/S1344` (Matías Walker) y `/parlamentarios` renderizaban el recurso RDF crudo de BCN `http://datos.bcn.cl/.../partido-democratas-chile` **como valor de partido**. Causa raíz: gap del parser BCN de senadores (Phase 90) que guardó el URI RDF en vez de la etiqueta en 1 fila de militancia; se propaga a `parlamentario.partido`. Viola "cero URI-como-partido en el DOM".
- **Fix:** `partidoLegible()` (display-only, deriva el nombre del propio slug del URI, sin tildes fabricadas; nombre legible pasa verbatim) enchufado en los 3 chokepoints de render de partido: `PartidoChip`, `MilitanciasDeParlamentario`, `ParlamentariosFiltro` (label).
- **Files modified:** app/lib/format.ts, app/components/partido-chip.tsx, app/components/militancias-de-parlamentario.tsx, app/components/parlamentarios-filtro.tsx.
- **Verification:** 6 tests `partidoLegible` + chip/ficha/directorio verdes; tsc 0; guards 209; suite 1424. DOM post-redeploy final (v`b467d41a`): `/parlamentario/S1344` URI=0 (renderiza "Partido Democratas Chile"); `/parlamentarios` URI-visible=0.
- **Committed in:** `a6f4057` + `34e4df2` + `2b86707`.

---

**Total deviations:** 1 defecto auto-corregido (Rule 1, 3 sitios de render → 3 commits + 3 redeploys).
**Impact on plan:** Fix necesario para la corrección de una superficie ciudadana (viola aceptación E2E). Sin scope creep — display-only, cero cambio de datos/schema, cero paquete nuevo.

## Issues Encountered

- El fix requirió **3 iteraciones** porque el valor de partido se renderiza en 3 sitios independientes (chip, bloque militancias, label de faceta), cada uno bypasseando al anterior. Cada uno se detectó re-verificando el DOM tras el redeploy previo. Resuelto: los 3 chokepoints ahora usan `partidoLegible`.
- Ocurrencia residual de `datos.bcn.cl` (1) en `/parlamentarios`: es la clave de filtro serializada en el payload RSC del island (no-visible), RAW por diseño — documentado en 104-E2E-EVIDENCIA.md §6.

## User Setup Required

None — el redeploy usó el runbook existente (Docker + wrangler OAuth ya provisionado). Sin nuevos secretos ni servicios.

## Next Phase Readiness

- **Milestone v10.0 verificado E2E** sobre el deploy real (v`b467d41a`): panel, relaciones, /comparar+VSIM, flags OFF, empty states honestos, cero URI-como-partido visible. El operador tiene el inventario "todo funciona" que pidió.
- Listo para `/gsd:audit-milestone` / `/gsd:complete-milestone` v10.0.
- Deuda pre-existente sin cambios (backfills operador-LOCAL, gates v7.0, provisión NOTIF/auth operador) — no bloquean el cierre E2E.
- Nota de datos para un milestone futuro: 3 filas de `parlamentario_militancia` traen URI RDF de BCN en vez de etiqueta (gap parser Phase 90); el fix es display-only — la limpieza en origen (parser BCN senadores) queda como mejora de datos futura.

## Self-Check: PASSED

- Archivos: 104-E2E-EVIDENCIA.md (188 líneas ≥60), 104-03-SUMMARY.md, 101-HUMAN-UAT.md — todos presentes.
- Commits: a6f4057, 34e4df2, 2b86707, d800a09 — todos en git log.
- 101-HUMAN-UAT: 3 × `result: pass`.

---
*Phase: 104-cierre-p3b-verificaci-n-e2e-todo-funciona*
*Completed: 2026-07-26*
