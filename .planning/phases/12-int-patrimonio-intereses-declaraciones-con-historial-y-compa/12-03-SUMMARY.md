---
phase: 12-int-patrimonio-intereses-declaraciones-con-historial-y-compa
plan: 03
subsystem: frontend/ficha-parlamentario
tags: [nextjs, rsc, ui, patrimonio, intereses, historial, comparacion, content-gate, cc-by-40, shadcn-table, INT-04, INT-05]
requires:
  - "RPC declaraciones_de_parlamentario / comparar_declaraciones / probidad_ingesta_estado (0022, Plan 01)"
  - "shell apilable /parlamentario/[id] (Phase 10) + carril propio Phase 11"
  - "ProvenanceBadge (amber freshness) + IdentityMarker + format helpers (v1.0)"
provides:
  - "<section id=patrimonio> apilada en /parlamentario/[id] (carril propio, mt-12)"
  - "PatrimonioView (historial fechado) + DeclaracionComparacion (lado-a-lado SOLO datos) + PatrimonioSection (Server Component)"
  - "shadcn Table (grilla sobria de comparación, NO diff widget)"
  - "DeclaracionVersionRow / DeclaracionComparacionColumna / RPC row types (§10)"
  - "content-gate test que ejerce LISTA Y COMPARACIÓN (cierra la brecha representado de Phase 11)"
affects:
  - "Phases 14–16 (MONEY) apilan su sección siguiendo el mismo carril propio"
tech-stack:
  added:
    - "shadcn Table (@/components/ui/table) — registro oficial, único componente nuevo de la fase"
  patterns:
    - "Server Component end-to-end (sin use client); comparación SSR vía ?comparar=A,B (sin motor de diff cliente)"
    - "RPC → modelado en el Server Component (modelarVersiones/modelarColumnas); el UI NO computa delta/veredicto"
    - "fecha de presentación PROMINENTE (font-mono, labeled 'Presentada el …') + frescura ámbar + caveat histórico"
    - "atribución CC BY 4.0 visible en intro Y repetida en el caption de la comparación (vista derivada)"
    - "content-gate test sobre lista Y comparación: cero veredicto/delta/causal/conectivo, cero RUT/familiar"
key-files:
  created:
    - "app/components/ui/table.tsx"
    - "app/components/patrimonio-de-parlamentario.tsx"
    - "app/components/patrimonio-de-parlamentario.test.tsx"
  modified:
    - "app/lib/types.ts"
    - "app/app/parlamentario/[id]/page.tsx"
decisions:
  - "Comparación keyed por fecha_presentacion (identidad de columna); unión ordenada de etiquetas → una fila por campo; ausente = 'No declarado en esta versión' (HECHO), nunca '—' ni gap coloreado"
  - "Campos inline (escaneables, primeros 4) con disclosure server-driven ?ver=<id> para el detalle largo; el RPC de historial proyecta solo escalares (cargo/organismo) → campos[] modelado en el Server Component"
  - "es_historica derivada por umbral de dominio (>1 año), distinto del umbral 48h de frescura de captura del ProvenanceBadge"
  - "AtribucionCcBy con texto contiguo 'Datos bajo licencia CC BY 4.0.' + link 'Ver licencia ↗' (matchable por nodo de texto y por caption)"
metrics:
  duration: 9min
  completed: 2026-06-19
---

# Phase 12 Plan 03: Sección Patrimonio/Intereses con historial fechado y comparación SOLO-datos Summary

Apila una `<section id="patrimonio">` en su PROPIO carril (mt-12, sibling de `#lobby`) en `/parlamentario/[id]`, que renderiza (1) el HISTORIAL de versiones de declaraciones confirmadas con la fecha de presentación PROMINENTE (mono, "Presentada el …") + badge ámbar de frescura + caveat histórico — una vieja NUNCA se lee como actual (INT-04), y (2) la COMPARACIÓN lado-a-lado vía shadcn `Table` con SOLO valores literales, CERO veredicto/delta, campo ausente = "No declarado en esta versión" (INT-05). CC BY 4.0 visible en el intro Y en el caption de la comparación. Server Component end-to-end (comparación SSR `?comparar=A,B`, sin motor de diff cliente). El content-gate test ejerce TANTO la lista COMO la comparación — cierra la brecha `representado` de Phase 11.

## What Was Built

- **`app/components/ui/table.tsx`** — shadcn `Table` oficial (`pnpm dlx shadcn@latest add table`), con todos los exports estándar (`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`/`TableCaption`). Tabla de datos sobria — NO un widget de diff. Único componente nuevo de la fase (registro oficial, sin vetting de terceros).
- **`app/lib/types.ts`** — `DeclaracionVersionRow` (payload §10: `declaracion_id`/`version_id`/`tipo`/`fecha_presentacion`/identidad del declarante/`campos[]`/`origen`/`fecha_captura`/`enlace`/`licencia: "CC BY 4.0"`/`es_historica`), `DeclaracionComparacionColumna`, y las formas crudas de RPC `DeclaracionRpcRow` + `CompararDeclaracionRpcRow`. NUNCA RUT del parlamentario ni datos de familiares. `sourceLabel` ahora mapea probidad/cplt/transparencia → "InfoProbidad".
- **`app/components/patrimonio-de-parlamentario.tsx`**:
  - **`PatrimonioView`** (puro): intro muted + CC BY 4.0 visible; `<ul>` de versiones en orden `fecha_presentacion DESC` con fecha PROMINENTE (`font-mono text-base`, labeled "Presentada el …"), badge ámbar + caveat §6.4 si `es_historica`, tipo literal, `<dl>` de campos (NOUN label + valor verbatim), `ProvenanceBadge ml-auto` por versión; conteo neutro; paginación server-driven (`?patrimonioPage=N`, page size 10); disclosure server-driven `?ver=<id>` para campos largos.
  - **`DeclaracionComparacion`** (puro): shadcn `<Table>` con `<caption>` ("solo datos, sin cálculo ni interpretación" + CC BY 4.0 repetida), `<th scope="col">` columnas fechadas mono, `<th scope="row">` etiquetas de campo, celdas con valores literales; campo ausente → "No declarado en esta versión"; `ProvenanceBadge` por columna; selector oculto + hecho neutro si <2 versiones. CERO columna de delta/veredicto, sin color de valencia, sin estilo diff.
  - **`PatrimonioSection`** (Server Component): `createServerSupabase()` → `sb.rpc("declaraciones_de_parlamentario", {p_id})` (historial) + `sb.rpc("comparar_declaraciones", {p_id, fechas})` si `?comparar=A,B`; distingue error real de DB/red (throw) de "0 filas"; consulta `probidad_ingesta_estado` para `noIngestado` REAL (ausencia de fila); modela RPC → forma de vista (helpers puros `modelarVersiones`/`modelarColumnas`/`esHistorica`). El gate de contenido §9.1 está documentado en el encabezado del archivo (lista dura de términos prohibidos).
- **`app/components/patrimonio-de-parlamentario.test.tsx`** (17 tests RTL): carril aislado (sin voto/lobby/proyecto), fecha prominente + frescura, comparación SIN veredicto (valor cambiado + campo ausente → cero vocabulario de regla 1), CC BY 4.0 en intro Y caption, sin RUT/familiar, guarda de identidad, 3 estados honestos distintos, ProvenanceBadge por versión Y por columna, y el **gate-test mandate** que ejerce LISTA Y COMPARACIÓN.
- **`app/app/parlamentario/[id]/page.tsx`** — `<section id="patrimonio" className="mt-12">` apilada DESPUÉS de `#lobby` (sibling, nunca anidada), con su `<h2>` + `<Suspense>` + `PatrimonioSkeleton` (shape-matched). Cabecera, `#votos` y `#lobby` intactos.

## Tasks

1. **Task 1** (`c5adb34`): shadcn Table + `DeclaracionVersionRow` y tipos de payload (§10).
2. **Task 2** (RED `9bd80b5` → GREEN `395d754`): `PatrimonioView` + `DeclaracionComparacion` + `PatrimonioSection` + tests RTL con content-gate sobre lista Y comparación.
3. **Task 3** (`3255694`): apilar la sección en `/parlamentario/[id]` (carril propio, mt-12, Suspense, skeleton).

## TDD Gate Compliance

Task 2 siguió RED/GREEN: test commit (`9bd80b5`, falla con "Failed to resolve import ./patrimonio-de-parlamentario") → feat commit (`395d754`, 17/17 verde). Sin fase REFACTOR (código limpio en GREEN).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Atribución CC BY 4.0 partida entre nodos de texto rompía el matcher**
- **Found during:** Task 2 (GREEN)
- **Issue:** `AtribucionCcBy` renderizaba "Datos bajo licencia " + un `<a>CC BY 4.0 ↗</a>` separado → `getByText(/Datos bajo licencia CC BY 4.0/i)` no lo encontraba (texto partido entre elementos).
- **Fix:** Texto contiguo "Datos bajo licencia CC BY 4.0." en un solo nodo + link separado "Ver licencia ↗". La atribución sigue VISIBLE (intro + caption) con link a `creativecommons.org/licenses/by/4.0`.
- **Files modified:** app/components/patrimonio-de-parlamentario.tsx
- **Commit:** 395d754

**2. [Rule 1 - Bug] Campos ocultos por defecto tras disclosure → estado (c) no mostraba valores**
- **Found during:** Task 2 (GREEN)
- **Issue:** El disclosure server-driven (`?ver`) ocultaba TODOS los campos por defecto; en el estado (c) "con versiones" no se veía ningún valor literal hasta abrir el detalle, contradiciendo "escaneable".
- **Fix:** Campos inline por defecto (primeros 4), con el disclosure `?ver=<id>` reservado para el detalle largo (>4 campos). Valores siempre verbatim; el UI no computa nada.
- **Files modified:** app/components/patrimonio-de-parlamentario.tsx
- **Commit:** 395d754

### Adaptación de signatura (no es desviación de contrato)

`DeclaracionComparacion` recibe `{ id, columnas, totalVersiones }` (columnas ya resueltas a etiqueta→valor por `modelarColumnas`) en lugar de `{ id, versiones, seleccion }` del boceto del plan. El resultado renderizado es idéntico al contrato §3.5 (columnas fechadas, filas por campo, ausente = literal, CERO delta). El modelado RPC→columnas vive en el Server Component (helper puro testeable), respetando "el UI NO computa nada".

## Verification

- `pnpm --filter app exec vitest run components/patrimonio-de-parlamentario.test.tsx`: **17/17 PASS** (incluye el content-gate sobre lista Y comparación).
- `pnpm --filter app test` (suite completa): **110/110 PASS** (12 archivos) — nada roto.
- `pnpm --filter app build`: **PASS** (TypeScript de la app verde; sección renderizada en `/parlamentario/[id]`).
- Task 1 gate (grep types + table.tsx + sin RUT): PASS (`Task1 OK`).
- Task 3 gate (grep `id="patrimonio"`/`PatrimonioSection`/`PatrimonioSkeleton`/`mt-12` + sibling-DESPUÉS-de-lobby): PASS (`page OK`).
- `pnpm --filter app typecheck`: solo el error PRE-EXISTENTE y DEFERIDO en `lib/buscar.test.ts(156)` (documentado en context notes); CERO errores en los archivos nuevos/modificados de este plan.

## Deferred Issues

- **`lib/buscar.test.ts(156)` TS2532/TS2493** — error de typecheck PRE-EXISTENTE no relacionado con este plan (documentado en context notes). `next build` no lo toca (no compila tests). No se aborda aquí.

## Notes for Next Plans

- **Phases 14–16 (MONEY):** apilar su `<section id="dinero" className="mt-12">` como sibling tras `#patrimonio`, mismo patrón (carril propio, su `<h2>` + Suspense + empty honesto, NUNCA componer un dato de otro bloque). El placeholder en `page.tsx` ya apunta al siguiente bloque.
- El selector de comparación se invoca vía `?comparar=A,B` (SSR, deep-linkable); el wiring de anchors de selección desde la lista (checkbox por versión → href) quedó como afinación de UX futura — la vista de comparación funciona end-to-end por deep-link.

## Self-Check: PASSED

- Archivos creados: table.tsx, patrimonio-de-parlamentario.tsx, patrimonio-de-parlamentario.test.tsx → FOUND.
- Commits: c5adb34 (Task 1), 9bd80b5 (RED), 395d754 (GREEN), 3255694 (Task 3) → FOUND.
