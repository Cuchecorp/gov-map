---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
plan: 02
subsystem: tramitacion
tags: [tramitacion, parsers-xml, fast-xml-parser, camara-opendata, senado-wspublico, timeline, fechas-cl, provenance-inline, tdd, fixtures-reales]

# Dependency graph
requires:
  - "05-01: modelo común Proyecto/Votacion/Voto/TramitacionEvento + zod schemas (boletín = llave)"
  - "05-01: 5 fixtures XML reales cross-cámara (14309 / 18296)"
  - "@obs/core makeProvenance (FND-08) — provenance inline por fila"
provides:
  - "parseCamaraVotacion (getVotaciones_Boletin tempuri.org → Votacion[]) + parseCamaraVotoDetalle (retornarVotacionDetalle v1 → voto-a-voto por Diputado/Id)"
  - "parseCamaraSesion (retornarSesionesXLegislatura → SesionCamara[]) para descubrir sesiones Leg 58"
  - "parseSenadoTramitacion (tramitacion.php → Proyecto + TramitacionEvento[])"
  - "parseSenadoVotacion/parseSenadoVotaciones (votaciones.php → Votacion + voto-a-voto crudo por nombre)"
  - "parseFechaCL/toIso (dd/mm/yyyy + ISO explícito, Pitfall 3)"
  - "fusionarTimeline (cross-cámara cronológico, empate estable) + eventoDesdeVotacion"
  - "Tests 1-3 del slice E2E verdes (Test 4 sigue RED → ola 3)"
affects: [tramitacion, frontend-ficha]

# Tech tracking
tech-stack:
  added: []
  patterns: [parser-por-endpoint-zod, fecha-cl-explicita, provenance-inline, force-array-concat, timeline-merge-estable, tdd-red-green-por-parser]

key-files:
  created:
    - packages/tramitacion/src/fecha.ts
    - packages/tramitacion/src/fecha.test.ts
    - packages/tramitacion/src/parse-camara-votacion.ts
    - packages/tramitacion/src/parse-camara-votacion.test.ts
    - packages/tramitacion/src/parse-camara-sesion.ts
    - packages/tramitacion/src/parse-camara-sesion.test.ts
    - packages/tramitacion/src/parse-senado-tramitacion.ts
    - packages/tramitacion/src/parse-senado-tramitacion.test.ts
    - packages/tramitacion/src/parse-senado-votacion.ts
    - packages/tramitacion/src/parse-senado-votacion.test.ts
    - packages/tramitacion/src/timeline.ts
    - packages/tramitacion/src/timeline.test.ts
  modified:
    - packages/tramitacion/src/index.ts

key-decisions:
  - "Boletín-fixture (tempuri.org) usa TotalAfirmativos/TotalNegativos/TotalAbstenciones (NO TotalSi); el detalle (v1) usa TotalSi/TotalNo/TotalAbstencion — el parser lee ambos nombres (fixture = ground truth)"
  - "parseSenadoVotacion (singular, primera votación) honra el contrato del slice E2E que desestructura {votacion,votos}; parseSenadoVotaciones (plural) cubre N votaciones + caso vacío []"
  - "fusionarTimeline acepta TramitacionEvento[] O TramitacionEvento[][] (aplana) — el slice E2E llama fusionarTimeline([eventos])"
  - "Fechas inválidas/null → al FINAL del timeline en orden de inserción (no se descartan en silencio)"
  - "makeProvenance(source/sourceUrl/fetchedAt) adaptado a las columnas del modelo (origen/enlace/fecha_captura) en cada parser"

requirements-completed: [TRAM-01, TRAM-02, TRAM-03, TRAM-04, TRAM-05, TRAM-06, TRAM-09]

# Metrics
duration: 7min
completed: 2026-06-18
---

# Phase 5 Plan 02: Parsers XML (Cámara + Senado) + fechas CL + fusión de timeline Summary

**Construye los 4 parsers XML que mapean las respuestas reales de la Cámara (opendata, dos namespaces) y el Senado (wspublico) al modelo común por boletín, el helper de fechas `dd/mm/yyyy`→ISO, y la fusión cronológica cross-cámara del timeline; cada fila lleva provenance inline (TRAM-09) y valida contra los zod schemas — 49 tests verdes sobre fixtures reales y los Tests 1-3 del slice E2E pasan (Test 4/reconciliación sigue RED para la ola 3).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-18T16:25:31Z
- **Completed:** 2026-06-18T16:32:00Z
- **Tasks:** 3 (todas TDD, RED→GREEN validando contra los fixtures reales)
- **Files:** 13 creados, 1 modificado (barrel)

## Accomplishments

- **`fecha.ts` (Task 1, Pitfall 3 / T-05-04):** `parseFechaCL` parsea `dd/mm/yyyy` construyendo `new Date(yyyy, mm-1, dd)` (con guarda de overflow de calendario → null en `31/02`), pasa ISO `yyyy-mm-ddThh:mm:ss` directo, y devuelve `null` ante cualquier otro/Invalid. NUNCA `new Date("03/06/2026")` directo. `toIso` emite ISO 8601. 6 tests.
- **`parse-camara-votacion.ts` (Task 1, TRAM-01/06, Pitfall 4/5):** `parseCamaraVotacion` lee `getVotaciones_Boletin` (ns `tempuri.org`) → `Votacion[]` con `boletin` del `<Boletin>` ESTRUCTURADO (no regex), `id="camara:"+ID`, `camara="diputados"`, totales del boletín (`TotalAfirmativos/Negativos/Abstenciones`); `parseCamaraVotoDetalle` lee `retornarVotacionDetalle` (ns `v1`) → voto-a-voto `{diputadoId, opcion: Valor==='1'?'si':'no', nombreCrudo}` (cruce determinista por `Diputado/Id`). Si se aporta `detalleXml`, sus totales `TotalSi/No/Abstencion` pisan los de boletín por id. 8 tests.
- **`parse-camara-sesion.ts` (Task 1):** `parseCamaraSesion` lee `retornarSesionesXLegislatura` (ns v1) → `SesionCamara[]` (`id/numero/fechaInicio/fechaTermino/tipo/estado`) para que la ola 4 descubra las sesiones de la Leg 58. 2 tests.
- **`parse-senado-tramitacion.ts` (Task 2, TRAM-02/04/05):** `parseSenadoTramitacion` → `{proyecto, eventos}`. El `Proyecto` deriva `boletin` completo (`18296-05`) + `boletin_num` base (`18296`, sin sufijo, Pitfall 1), `titulo`, `iniciativa` (Mensaje/Moción), `camara_origen`, `estado` (trim — viene con espacio final), `etapa`/`subetapa`, `autores[]`. Los `eventos` fusionan las 4 secciones (`tramite`/`urgencia`/`informe`+LINK_INFORME/`oficio`+LINK_OFICIO) a `TramitacionEvento[]`, cada uno con fecha ISO y boletín completo. 9 tests.
- **`parse-senado-votacion.ts` (Task 2, TRAM-06, guarda de identidad):** `parseSenadoVotaciones` → `VotacionSenado[]` con totales `SI/NO/ABSTENCION/PAREO` + `quorum/tipo(TIPOVOTACION)/etapa`, y voto-a-voto `{mencionNombre (trim, Pitfall 3), seleccion}` mapeada (Si→si, No→no, Abstencion→abstencion, Pareo→pareo, case-insensitive). Boletín = el param recibido (NO el `<TEMA>` con puntos de millar, T-05-05). Vacío → `[]` sin lanzar (Pitfall 2). `parseSenadoVotacion` (singular) devuelve la primera votación (contrato slice E2E). NO reconcilia identidad (ola 3): solo `mencionNombre` crudo. 6 tests.
- **`timeline.ts` (Task 3, TRAM-05):** `fusionarTimeline(eventos | eventos[][])` ordena por fecha ASC; empate exacto → Cámara (`/diputados/i`) antes que Senado, estable; fechas null/inválidas al FINAL en orden de inserción. Función pura. `eventoDesdeVotacion(v)` materializa una `Votacion` como evento `tipo:'votacion'` (`descripcion` = resultado + totales) para que la ola 4 inyecte votaciones en el timeline. 6 tests.

## Task Commits

1. **Task 1: parsers de Cámara + fecha dd/mm/yyyy** — `f6fd6d1` (feat)
2. **Task 2: parsers del Senado (tramitación + votaciones nominales)** — `c25ada6` (feat)
3. **Task 3: fusión cronológica del timeline cross-cámara** — `57d269c` (feat)

## Files Created/Modified

Ver `key-files` en frontmatter. Destacados:
- `packages/tramitacion/src/parse-camara-votacion.ts` — dos namespaces (boletín estructurado + detalle voto-a-voto).
- `packages/tramitacion/src/parse-senado-tramitacion.ts` — Proyecto + 4 secciones del timeline materializadas.
- `packages/tramitacion/src/timeline.ts` — fusión cronológica estable cross-cámara.
- `packages/tramitacion/src/fecha.ts` — el helper que evita la trampa `dd/mm/yyyy`.

## Decisions Made

- **Nombres de totales por endpoint (fixture = ground truth):** el plan/RESEARCH mencionaba `TotalSi/TotalNo` para el boletín, pero el fixture REAL de `getVotaciones_Boletin` usa `TotalAfirmativos/TotalNegativos/TotalAbstenciones/TotalDispensados`; el de `retornarVotacionDetalle` usa `TotalSi/TotalNo/TotalAbstencion/TotalDispensado`. El parser lee ambos juegos de nombres (sin falsear el fixture). Validado contra los 58/81/0 reales del fixture.
- **`parseSenadoVotacion` singular + `parseSenadoVotaciones` plural:** el slice E2E desestructura `{votacion, votos}` (singular) de una sola llamada; el plan describía un array. Se exponen ambos: el singular honra el contrato E2E (primera votación), el plural cubre N votaciones + el caso vacío `[]` (Pitfall 2). Ambos exportados desde el barrel.
- **`fusionarTimeline` acepta arreglo-de-arreglos:** el slice E2E llama `fusionarTimeline([eventos])`; la función aplana `TramitacionEvento[][]` o acepta plano `TramitacionEvento[]`.
- **Adaptador de provenance:** `makeProvenance` de `@obs/core` devuelve `source/sourceUrl/fetchedAt`; el modelo persiste `origen/enlace/fecha_captura`. Cada parser hace el mapeo inline al construir la fila (no se redefinió `makeProvenance`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowing de `todas[0]` bajo `noUncheckedIndexedAccess`**
- **Found during:** Task 3 (`pnpm -w typecheck`)
- **Issue:** `parseSenadoVotacion` retornaba `todas[0]` tras un `length === 0` check, pero TS (con `noUncheckedIndexedAccess`) tipa el acceso indexado como `VotacionSenado | undefined` y no lo estrecha por el length check → `tsc -b` error TS2322.
- **Fix:** Asignar `const primera = todas[0]; if (primera === undefined) throw ...; return primera;` (estrechamiento explícito).
- **Files modified:** packages/tramitacion/src/parse-senado-votacion.ts
- **Verification:** `pnpm -w typecheck` exit 0.
- **Committed in:** `57d269c` (Task 3)

**Total deviations:** 1 auto-fixed (1 blocking). Sin scope creep.

## Threat Model Coverage

- **T-05-03 (DoS/Disclosure / fast-xml-parser):** mitigado — `XMLParser` sin expansión de entidades externas (default); fixtures < 50 KB; cada fila validada con `ProyectoSchema`/`VotacionSchema`/`TramitacionEventoSchema` antes de devolver.
- **T-05-04 (Tampering / fecha mal parseada):** mitigado — `parseFechaCL` explícito; test de borde `03/06/2026` y `17/06/2026`; overflow de calendario → null.
- **T-05-05 (Tampering / boletín de texto libre):** mitigado — Cámara usa `<Boletin>` estructurado; Senado usa el param de consulta (no el `<TEMA>` con puntos de millar).
- **T-05-SC (npm installs):** N/A — sin paquetes nuevos (`fast-xml-parser`/`zod`/`@obs/*` ya en uso).

## Known Stubs

- `reconciliarVotosSenado` NO existe aún por diseño — es la diana RED del slice E2E Test 4 que la **ola 3** (reconciliación de votos del Senado contra la maestra) implementa. No es un stub de datos que engañe a la UI; es el contrato walking-skeleton declarado. Los parsers de esta ola entregan `mencionNombre` crudo + `seleccion` exactamente como la ola 3 los consume.

## Verification

- `pnpm --filter @obs/tramitacion test`: 49/50 verdes; el único rojo es el slice E2E **Test 4** (`reconciliarVotosSenado is not a function`) — esperado, es la diana de la ola 3 (Tests 1-3 verdes).
- `pnpm -w typecheck`: exit 0.
- Parsers validados contra los 5 fixtures REALES (boletín 14309-04 estructurado; 35 votos Senado con trim; 12 tramites + 2 informes + 2 oficios + 1 urgencia; 155 votos detalle Cámara; 40 sesiones Leg 58).

## Next Phase Readiness

- **Ola 3 (reconciliación):** consume `parseSenadoVotacion(...).votos` (`mencionNombre` crudo) + `parseCamaraVotoDetalle` (`diputadoId` determinista) para `reconciliarVotosSenado` / vínculo por id, y vuelve verde el slice E2E Test 4.
- **Ola 4 (writer/ingesta):** consume `parseCamaraSesion` (descubrir sesiones Leg 58), `fusionarTimeline` + `eventoDesdeVotacion` (materializar `tramitacion_evento`), y los 4 parsers para el upsert idempotente.

## Self-Check: PASSED

Archivos declarados existen y los 3 commits están en el historial:
- Archivos: fecha(.test), parse-camara-votacion(.test), parse-camara-sesion(.test), parse-senado-tramitacion(.test), parse-senado-votacion(.test), timeline(.test), index.ts — todos FOUND.
- Commits: f6fd6d1 (T1), c25ada6 (T2), 57d269c (T3) — todos FOUND.

---
*Phase: 05-tramitaci-n-core-ficha-timeline-votaciones*
*Completed: 2026-06-18*
