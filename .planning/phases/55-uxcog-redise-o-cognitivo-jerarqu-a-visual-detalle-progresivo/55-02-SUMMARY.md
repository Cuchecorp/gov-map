---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
plan: 02
subsystem: frontend-ui
tags: [ui, capa-1, progressive-disclosure, tokens, anti-insinuacion, no-leak, tdd]
requires:
  - "55-01 primitivas (DetalleColapsable, FichaRail, useScrollspy, bg-accent-product-soft)"
  - "parlamentario-resumen-conteos.ts (RPCs allowlisted ya invocados)"
provides:
  - "ConteoCarriles extendido: votosBreakdown + lobbyTopMaterias + crucesSectores + patrimonioPorDeclaracion + rangoAnios (desde filas ya leídas, sin RPC nueva)"
  - "productores puros: resumirVotos / rankearMaterias / agruparSectores / mapearPatrimonio"
  - "VotosCapa1 (5 cifras Mono + barra Cómo votó, colores semánticos)"
  - "LobbyCapa1 (barras materia neutras + conteo)"
  - "PatrimonioCapa1 (mini-columnas por año, sin montos)"
  - "CrucesCapa1 (petróleo-framed + CTA Explorar los N cruces)"
affects:
  - "55-03 cablea las 4 capa-1 en la página del parlamentario (fuera del disclosure)"
tech-stack:
  added: []
  patterns:
    - "pure-view / server-fetch split (espejo ResumenView/VotosView)"
    - "Capa-1 mini-visuals = CSS on tokens (sin chart lib)"
    - "colores semánticos = paleta Tailwind (green/red/amber/slate), petróleo reservado a cruces"
    - "guarda ISO ^\\d{4}$ espejo de seriePatrimonio/esHistorica (año no parseable EXCLUIDO)"
key-files:
  created:
    - app/components/capa1/votos-capa1.tsx
    - app/components/capa1/votos-capa1.test.tsx
    - app/components/capa1/lobby-capa1.tsx
    - app/components/capa1/lobby-capa1.test.tsx
    - app/components/capa1/patrimonio-capa1.tsx
    - app/components/capa1/patrimonio-capa1.test.tsx
    - app/components/capa1/cruces-capa1.tsx
    - app/components/capa1/cruces-capa1.test.tsx
  modified:
    - app/lib/parlamentario-resumen-conteos.ts
    - app/lib/parlamentario-resumen-conteos.test.ts
decisions:
  - "Colores de voto = paleta Tailwind (bg-green-500/bg-red-500/bg-amber-400/bg-slate-*, espejo de BAR_SEGMENT) — los tokens --color-favor/contra/... del UI-SPEC NO existen aún; la paleta NO es arbitrary color value y ya es la convención del repo. Nunca petróleo."
  - "nVotos de cruces: nReuniones desde tipo_senal==='lobby_sector', nVotos desde tipo_senal.startsWith('voto') (hoy 0); tipos futuros desconocidos se IGNORAN (omisión honesta, no se fabrica una dimensión)."
  - "Empates de ranking (lobby/cruces) se desempatan alfabéticamente (localeCompare es) para orden estable."
metrics:
  duration: ~12min
  completed: 2026-07-07
  tasks: 3
  files: 10
---

# Phase 55 Plan 02: Capa-1 del parlamentario (resumen preatentivo) Summary

Los productores REALES de las cuatro capa-1 en el servicio de conteos (desglose de votos, ranking de materias de lobby, sectores de cruces, declaraciones de patrimonio + rango — todo derivado de las MISMAS filas que el módulo ya lee, sin RPC nueva ni montos) + cuatro vistas puras capa-1 (votos, lobby, patrimonio sin montos, cruces petróleo-framed) hechas con CSS sobre tokens, colores disciplinados y anti-insinuación intacta. Las cablea el plan 55-03 en la página.

## What Was Built

### Task 1 — Productores capa-1 en `parlamentario-resumen-conteos.ts` (TDD, RED `eed1cc8` → GREEN `20b59eb`)
- Cuatro funciones PURAS exportadas y testeadas: `resumirVotos` (desglose por selección, fuente única de "Cómo votó"), `rankearMaterias` (top-8 desc, dedupe por `identificador`, omite materia null/vacía), `agruparSectores` (nReuniones desde `lobby_sector`, nVotos reservado, orden nReuniones desc), `mapearPatrimonio` (año/tipo con guarda ISO `^\d{4}$`, excluye no-parseable, + rango o null).
- `ConteoCarriles` extendido con `votosBreakdown`, `lobbyTopMaterias`, `crucesSectores`, `patrimonioPorDeclaracion`, `rangoAnios`. Todo desde las filas YA leídas — se cambió el TIPO de `lobbyFilas`/`crucesFilas`/`patrFilas` para leer `.materia`/campos reales/`fecha_presentacion`+`tipo`, sin un segundo fetch, sin RPC nueva, sin tocar `bienes_de_parlamentario`, sin montos.
- `conteosDesconocidos()` incluye las cinco formas vacías honestas (breakdown en ceros, arrays `[]`, `rangoAnios: null`).
- `import "server-only"` (línea 1) intacto; lockdown-guard Block B verde.
- Test: pure fns + integración mockeando `sb.rpc` por nombre (5 productores desde las mismas filas + throw #34 en error).

### Task 2 — `VotosCapa1` + `LobbyCapa1` (TDD, RED `918276c` → GREEN `ee087ed`)
- `VotosCapa1`: 5 cifras Mono (`text-2xl font-semibold font-mono`, 4 sentidos + asistencia %) con color solo en el número (verde/rojo/ámbar/slate) + barra apilada "Cómo votó" (CSS, colores semánticos). Omisión honesta de la asistencia si no derivable (nunca un % fabricado). Petróleo PROHIBIDO.
- `LobbyCapa1`: barras horizontales top-5 por materia (asunto verbatim) en color NEUTRO (`bg-muted-foreground`) + conteo total neutro; degradación honesta si no hay materias. Sin vocab causal.
- Ambas puras (sin runtime Supabase).

### Task 3 — `PatrimonioCapa1` + `CrucesCapa1` (TDD, RED `a923abf` → GREEN `9f5155d`)
- `PatrimonioCapa1`: tira de mini-columnas por año (altura ∝ CONTEO de declaraciones del año, `data-anio`/`data-conteo`), rotuladas por año + tipos en `title`; resumen "N declaraciones · min–max" Mono; degradación honesta <2 (marco de CONTEO, nunca "tendencia"). CERO montos, CERO conteo de ítems (F46). Petróleo PROHIBIDO.
- `CrucesCapa1`: ÚNICA superficie con petróleo — marco 1.5px (`border-accent-product`), `<h2>` `text-accent-product`, botón PRIMARIO `bg-accent-product` "Explorar los {N} cruces"; chips neutros "sector · N reuniones", "· M votos" SOLO cuando M>0 (omisión honesta, nunca frase causal); caveat de cruces 1× (texto LOCKED).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Los tokens semánticos de voto `--color-favor/contra/abstencion/ausente` no existen**
- **Found during:** Task 2
- **Issue:** El plan/UI-SPEC pide colores por token `--color-favor…`, pero esos tokens NO están definidos (ni en `civic-tokens.css` ni en `globals.css`). Usarlos produciría clases muertas; los arbitrary color values están vedados (LOCKED).
- **Fix:** Reusar la paleta Tailwind semántica que YA usa "Cómo votó" (`bg-green-500`/`bg-red-500`/`bg-amber-400`/`bg-slate-*`, espejo de `BAR_SEGMENT`) — no es un arbitrary color value y es la convención vigente del repo. Verde=a favor, rojo=en contra, ámbar=abstención, slate=ausente/pareo; nunca petróleo. Mismo criterio para los facts (`text-green-600` etc.).
- **Files modified:** app/components/capa1/votos-capa1.tsx
- **Commit:** ee087ed

**2. [Rule 1 - Copy] Colisión de texto en la degradación honesta de lobby**
- **Found during:** Task 2
- **Issue:** La copy de degradación decía "…para estas reuniones", chocando con el conteo total "N reuniones" (dos matches de `/reuniones/`).
- **Fix:** Copy ajustada a "Aún no hay materias publicadas en las fuentes consultadas." (misma honestidad, sin colisión).
- **Files modified:** app/components/capa1/lobby-capa1.tsx
- **Commit:** ee087ed

Nota: los ajustes de expectativas en tests (orden alfabético de empates, aserción sobre `textContent` normalizado para cifras Mono en spans) fueron correcciones de MIS PROPIAS fixtures durante el ciclo RED→GREEN, no cambios de contrato.

## Verification

- `cd app && npx vitest run` → **643 tests verdes** (baseline 614; +29: 12 conteos productores + 8 votos/lobby + 8 patrimonio/cruces, netos tras extender el test existente). Nunca decrece.
- `pnpm typecheck` (root, `tsc -b`) → limpio.
- `cd app && npx vitest run lib/lockdown-guard.test.ts` → verde (Block B escanea el módulo; CERO `.from(PII)`, CERO RPC fuera del allowlist, CERO `bienes_de_parlamentario`).
- Anti-insinuación: negative-match §9.1 verde en lobby y cruces; caveat de cruces 1×; petróleo SOLO en cruces-capa1; CERO montos en patrimonio-capa1 (test asevera ausencia de `$`/`CLP`/`UF`/`pesos`).

## TDD Gate Compliance

Las tres tasks (`tdd="true"`) respetaron RED→GREEN en git log: `test(55-02): …` (falla) seguido de `feat(55-02): …` (verde) por cada task.

## Self-Check: PASSED

- app/lib/parlamentario-resumen-conteos.ts — FOUND
- app/components/capa1/votos-capa1.tsx — FOUND
- app/components/capa1/lobby-capa1.tsx — FOUND
- app/components/capa1/patrimonio-capa1.tsx — FOUND
- app/components/capa1/cruces-capa1.tsx — FOUND
- commits eed1cc8, 20b59eb, 918276c, ee087ed, a923abf, 9f5155d — FOUND
