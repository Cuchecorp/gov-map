---
phase: 16-money-agregaci-n-contratos-aportes-por-contraparte
plan: 02
subsystem: frontend
tags: [money, nextjs, route, gate, anti-insinuacion, ui, rtl, contraparte, juridica]
status: autonomous-complete
requirements: [MONEY-05]
requires:
  - RPC agregado_por_contraparte(text) (Plan 16-01, security-definer, juridica-only, prefix-dispatched c:/d:)
  - app/lib/money-gate.ts moneyPublicEnabled() (Phase 13, default OFF, fail-closed)
  - app/components/provenance-badge.tsx + sourceLabel() (chilecompra/servel branches existentes)
  - ContratoRpcRow/AporteRpcRow (app/lib/types.ts) — reusados para las filas verbatim
  - patron three-part View/Section/Fila (contratos-de-parlamentario.tsx / financiamiento-de-parlamentario.tsx)
provides:
  - CONTRAPARTE_ID_RE (app/lib/buscar.ts) — valida 'c:<rut_proveedor>'/'d:<donante_nombre>' ANTES de tocar la DB
  - AgregadoContraparteRpcRow (app/lib/types.ts) — forma del output del RPC, dispatch por facet
  - ContratosPorContraparteSection/View + AportesPorContraparteSection/View (carriles MONEY por contraparte)
  - ruta gateada /contraparte/[id] (page.tsx + not-found.tsx) con gate a NIVEL DE PAGINA (notFound OFF)
  - RTL: 15 tests de carril + 7 tests de ruta (gate + defensa juridica de la cabecera)
affects:
  - completa el slice vertical MONEY-05 (UI): el ciudadano lee contratos + aportes de una empresa, trazados, tras el gate OFF
  - habilita app/**/*.test.{ts,tsx} en vitest.config (primer test de ruta del repo)
tech-stack:
  added: []
  patterns: [page-level notFound gate, RPC facet-dispatch en el Section, RTL de ruta via mock de next/navigation + supabase, anti-insinuacion por composicion (carriles mt-12 hermanos, cero voto)]
key-files:
  created:
    - app/components/contratos-por-contraparte.tsx
    - app/components/aportes-por-contraparte.tsx
    - app/components/contratos-por-contraparte.test.tsx
    - app/components/aportes-por-contraparte.test.tsx
    - app/app/contraparte/[id]/page.tsx
    - app/app/contraparte/[id]/not-found.tsx
    - app/app/contraparte/[id]/page.test.tsx
    - .planning/phases/16-money-agregaci-n-contratos-aportes-por-contraparte/deferred-items.md
  modified:
    - app/lib/buscar.ts
    - app/lib/types.ts
    - app/vitest.config.ts
decisions:
  - "CONTRAPARTE_ID_RE = /^[cd]:[A-Za-z0-9 .\\-_]+$/ — admite el 'c:'/'d:' prefijo del RPC y un donante_nombre con espacios/punto/guion, pero NO '/', '\\\\', saltos de linea ni control chars (anti path-traversal, T-16-08)"
  - "gate a NIVEL DE PAGINA: moneyPublicEnabled(process.env)->notFound() es la PRIMERA sentencia, antes de await params / RPC / heading; con OFF la ruta entera 404 (sirve not-found.tsx), sin filtracion de DOM MONEY"
  - "HeaderSection lee agregado_por_contraparte y toma la fila[0]; sin fila -> notFound (id desconocido); tipo_persona NO 'jur' -> notFound (defensa en profundidad sobre el filtro juridica del RPC, T-16-07)"
  - "el Section despacha el RPC por facet (find(a=>a.facet==='contrato'|'aporte')); ausencia de faceta -> 'no_consultado'; faceta presente con 0 filas -> 'consultado_sin_X'; con filas -> 'con_X'"
  - "la FILA foregrounda el lado contraparte (organismo comprador / candidato receptor), NO el nombre de la empresa: la empresa es el sujeto de pagina (h1), no se repite por fila (16-UI-SPEC §Row Layout)"
  - "aportes agrupados por eleccion DESC; el identificador tributario del donante NUNCA se renderiza (Ley 21.719); la palabra 'RUT' no aparece en el carril aportes (test lo asserta)"
  - "CERO computo: solo conteo neutral ('N contrato(s)/aporte(s) registrado(s).'); montos verbatim o 'No publicado'; jamas SUM/::numeric/ranking/%"
  - "atribucion por dataset: ChileCompra 'mencion de la fuente' / SERVEL 'terminos de uso por verificar'; NUNCA una licencia CC-BY (grep gate lo prohibe)"
  - "vitest.config: anadido app/**/*.test.{ts,tsx} al include para descubrir el primer test de ruta del repo"
  - "carril confirmado-parlamentario (16-UI-SPEC §enlaces) DIFERIDO: el RPC 16-01 no expone enlaces confirmados hoy; el carril esta AUSENTE cuando no hay enlace (correcto por diseno)"
  - "pagina de listado /contraparte/page.tsx DIFERIDA (16-UI-SPEC §Reaching the route): la ruta [id] es directamente direccionable; el listado no es requisito de MONEY-05"
metrics:
  duration: ~13min
  completed: 2026-06-19
  tasks_autonomous: 3
  files_created: 8
  files_modified: 3
  tests_added: 22
---

# Phase 16 Plan 02: Ruta gateada /contraparte/[id] (carriles contratos + aportes) Summary

La mitad UI del slice vertical MONEY-05: la pagina ciudadana `/contraparte/[id]` que muestra los hechos MONEY agregados de UNA contraparte persona **juridica** (empresa) — contratos (ChileCompra) y aportes (SERVEL) en DOS carriles HERMANOS separados por `mt-12`, cada fila trazada (ProvenanceBadge + fecha + enlace), con estados honestos de 3 vias, conteo neutral (cero suma de montos), y CERO insinuacion (ningun dato de voto, ningun lenguaje causal/afinidad). El gate de exposicion se enforza a NIVEL DE PAGINA: `moneyPublicEnabled(process.env) -> notFound()` es la PRIMERA sentencia, asi con OFF (default) la ruta entera 404 y nada filtra al HTML. Consumidor puro del RPC `agregado_por_contraparte` (Plan 16-01) y de los componentes ya embarcados; cero paquetes nuevos, cero DB, cero conector. Las 3 tareas autonomas estan completas y verificadas: 174/174 tests del suite verdes (22 nuevos), greps LOCKED verdes, tsc limpio en todos los archivos de Phase 16, sin BOM, sin unicode invisible.

## What Was Built

### Task 1 — regex + tipo + tests RTL (RED) (commit `131080b`, TDD RED)

- **`app/lib/buscar.ts`:** `export const CONTRAPARTE_ID_RE = /^[cd]:[A-Za-z0-9 .\-_]+$/;` — mirror de `PARLAMENTARIO_ID_RE`, valida los ids prefijados `c:<rut_proveedor>` / `d:<donante_nombre>` que emite el RPC, ANTES de tocar la DB (V5 / T-16-08); charset ancho para `donante_nombre` pero sin control chars / path-traversal.
- **`app/lib/types.ts`:** `export interface AgregadoContraparteRpcRow` — `facet: 'contrato'|'aporte'`, `contraparte_nombre`, `tipo_persona`, `conteo: number`, `filas: ContratoRpcRow[] | AporteRpcRow[]` (reusa los tipos de fila existentes; el consumidor estrecha por faceta).
- **Dos test files RTL** (`contratos-por-contraparte.test.tsx` / `aportes-por-contraparte.test.tsx`) importando los Views aun NO existentes (RED): conteo neutral, ProvenanceBadge por fila (ChileCompra/SERVEL), estados honestos distintos, atribucion por dataset, **negativa explicita** de vocabulario causal/afinidad y de licencia CC-BY, y (aportes) que el identificador tributario del donante NUNCA aparece.

### Task 2 — los dos componentes de carril (GREEN) (commit `209f9a7`, TDD GREEN)

- **`app/components/contratos-por-contraparte.tsx`** — `ContratosPorContraparteView` (puro, RTL) + `ContratosPorContraparteSection` (server: gate defensa-en-profundidad -> `agregado_por_contraparte` RPC -> dispatch faceta `contrato` -> View). Estados `no_consultado`/`consultado_sin_contratos`/`con_contratos`; conteo neutral; fila foregrounda el **organismo comprador** + nombre/monto/fecha/codigo verbatim + ProvenanceBadge; paginacion `?contratosPage=` `#contratos`. Atribucion "mencion de la fuente".
- **`app/components/aportes-por-contraparte.tsx`** — `AportesPorContraparteView` + `AportesPorContraparteSection` (dispatch faceta `aporte`). Estados `no_consultado`/`consultado_sin_aportes`/`con_aportes`; agrupado por **eleccion DESC**; cada fila muestra el **candidato receptor** como hecho muted SEPARADO ("Registrado a la campaña de {candidato}."), el identificador tributario del donante NUNCA renderizado (la palabra "RUT" no aparece); ProvenanceBadge SERVEL; paginacion `?aportesPage=` `#aportes`. Atribucion "terminos de uso por verificar".
- Ambos: `if (rpcError) throw` (#34, jamas degrada a "sin datos"); CERO `sum(`/`::numeric`/ranking/%.

### Task 3 — ruta gateada + not-found (commit `7cc36d8`)

- **`app/app/contraparte/[id]/page.tsx`** (Server Component async, Next 16 Promise params). Orden LOAD-BEARING: (1) `if (!moneyPublicEnabled(process.env)) notFound();` PRIMERO; (2) `const { id } = await params;`; (3) `if (!CONTRAPARTE_ID_RE.test(id)) notFound();`. Layout `max-w-3xl ... py-8 md:py-16` con `HeaderSection` (Suspense) + dos `<section>` HERMANAS: `#contratos` y `#aportes className="mt-12"` (la frontera de carril anti-insinuacion), cada una con su `<h2>` verbatim del UI-SPEC + Suspense + Skeleton shape-matched. `HeaderSection` (exportada para RTL) lee el RPC: error real -> throw (#34); sin fila -> notFound; `tipo_persona` NO juridica -> notFound (T-16-07); else h1 = nombre + badge "Persona juridica" + intro muted. **NINGUN** import/render de votos.
- **`app/app/contraparte/[id]/not-found.tsx`** — 404 sobrio ("Contraparte no encontrada" + "Volver al inicio"), sin heading MONEY; sirve tambien el 404 del gate OFF.
- **`app/app/contraparte/[id]/page.test.tsx`** (7 tests) — gate OFF -> notFound antes de tocar la DB (sin cliente, sin RPC); id invalido -> notFound antes de la DB; id valido -> la pagina no 404; HeaderSection: id desconocido -> notFound, no-juridica -> notFound, error real -> throw (#34), juridica valida -> h1+badge sin voto/causal.
- **`app/vitest.config.ts`** — anadido `app/**/*.test.{ts,tsx}` al `include` (primer test de ruta del repo).

## Output Notes (lo que el plan pidio reportar)

- **CONTRAPARTE_ID_RE final:** `/^[cd]:[A-Za-z0-9 .\-_]+$/` (sin flag `g`, stateless; admite espacios para `donante_nombre`).
- **Carril confirmado-parlamentario:** **DIFERIDO** — el RPC `agregado_por_contraparte` (16-01) no proyecta enlaces confirmados hoy; el carril esta AUSENTE cuando no hay enlace (correcto por diseno, 16-UI-SPEC §enlaces). MVP no lo requiere.
- **Pagina de listado `/contraparte/page.tsx`:** **DIFERIDA** — la ruta `[id]` es directamente direccionable; el listado no es requisito de MONEY-05 (16-UI-SPEC §Reaching the route, recomendacion: "ship the [id] page first; defer the listing").
- **Ajustes de forma del RPC vs 16-01:** ninguno. El RPC devuelve `(facet, contraparte_nombre, tipo_persona, conteo, filas jsonb)` por contraparte; el Section lo consume tal cual via `find(a=>a.facet===...)`. `AgregadoContraparteRpcRow` calza con el `Return Shape` del 16-01-SUMMARY. La cabecera usa la primera fila para `contraparte_nombre`+`tipo_persona`; cada carril toma su faceta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aserciones RTL de Task 1 demasiado laxas / atadas al sujeto equivocado**
- **Found during:** Task 2 (GREEN) — 4 tests fallaban.
- **Issue (a):** la negativa `queryByText(/contrato registrado|contratos registrados/i)` hacia match contra el intro ("Contratos registrados en ChileCompra..."), no solo contra la linea de conteo. (b) tres tests asertaban que el **nombre** de la empresa (`Constructora Andes SpA` / `Inmobiliaria del Sur SpA`) aparecia en una FILA — pero por 16-UI-SPEC §Row Layout la empresa es el sujeto de PAGINA (h1), y la fila foregrounda el lado contraparte (organismo / candidato), NO el nombre de la empresa.
- **Fix:** (a) anclar la negativa del conteo a `/\d+ (contrato|aporte)s? registrados?\./i` (forma con digito, que el intro nunca produce). (b) reapuntar las aserciones al contenido real de la fila: organismo+nombre_orden (contratos), candidato receptor + h3 de grupo por eleccion (aportes). Los componentes ya eran correctos; el bug estaba en las aserciones RED.
- **Files modified:** app/components/contratos-por-contraparte.test.tsx, app/components/aportes-por-contraparte.test.tsx
- **Commit:** 209f9a7 (corregido dentro del GREEN).

**2. [Rule 3 - Blocking] "CC BY 4.0" literal en comentarios/titulos de test rompia el grep gate `! grep -rq "CC BY 4.0"`**
- **Found during:** Task 1 (verify gate).
- **Issue:** los `it(...)` y comentarios decian `NUNCA 'CC BY 4.0'` verbatim; el grep gate trata cualquier ocurrencia del literal como fallo (no distingue comentario de copy renderizable).
- **Fix:** reword de comentarios/titulos a "una licencia CC-BY"; la asercion real conserva el regex `/CC BY 4\.0/i` (que NO contiene el literal por el backslash). Intento del test intacto.
- **Files modified:** app/components/{contratos,aportes}-por-contraparte.test.tsx
- **Commit:** 131080b (corregido antes del commit RED).

### Decisiones dentro de la discrecion del plan (no son deviations)
- **Test de ruta + export de `HeaderSection`:** el plan pide en el output "RTL: gate-off -> notFound; non-juridica -> notFound". El Server Component no se monta trivial en RTL, asi que (a) se testea la funcion `ContrapartePage` directamente para el gate de pagina (mock de `next/navigation`/`money-gate`/`supabase`), y (b) se exporta `HeaderSection` para probar por comportamiento la defensa juridica (T-16-07) + #34. Esto introduce el primer test de ruta del repo (de ahi el cambio de `vitest.config`).
- **Carril confirmado-parlamentario y listado: diferidos** (ver Output Notes).

### Out of scope (logged, NO fixed)
- **DI-16-01** (`deferred-items.md`): error tsc PRE-EXISTENTE en `app/lib/buscar.test.ts:156` (`mock.calls[0][0][0]`, TS2532/TS2493), de phase 07 (`86073bf`), presente ya en el HEAD de 16-01 (`4037694`). Cero diff de 16-02 a ese archivo. Todos los archivos de Phase 16 typechequean limpio. No se toca (SCOPE BOUNDARY).

## Authentication Gates
Ninguno. UI-only; cero credenciales, cero red externa, cero install.

## Local Verification Results

- **RTL completo:** `npx vitest run` -> **174/174 verdes** (18 files), incluidos los 15 de carril + 7 de ruta nuevos. Cero regresiones en el suite existente (votos/lobby/patrimonio/contratos-de-parlamentario/financiamiento/buscar/format/etc.).
- **Tipos:** `npx tsc --noEmit -p app/tsconfig.json` -> el UNICO error es el pre-existente `lib/buscar.test.ts:156` (DI-16-01, fuera de scope). CERO errores en page.tsx, los dos componentes, los tres tests, types.ts, buscar.ts.
- **Greps LOCKED (Task 3):** `moneyPublicEnabled(process.env)` presente; `notFound()` presente; `CONTRAPARTE_ID_RE` presente; `className="mt-12"` presente; AUSENTES `votos|voto-|VotosSection` y `CC BY 4.0` en page.tsx.
- **Anti-insinuacion sweep:** cero vocabulario causal/afinidad (`a cambio de|favoreci|influy|cercano a|su voto|correlaci|financió su elección`) en los dos componentes + page + not-found; cero `CC BY 4.0` en los archivos shipped (no-test).
- **Higiene de archivos:** sin BOM (primeros 3 bytes != `efbbbf`) y sin NBSP/zero-width en page.tsx / not-found.tsx / page.test.tsx / vitest.config.ts.
- **TDD gate:** `test(16-02)` (131080b) precede a `feat(16-02)` (209f9a7) precede a `feat(16-02)` ruta (7cc36d8) en el log.

## Threat Surface Mapping (del threat_model del plan)

- **T-16-06** (leak de heading/DOM con gate OFF): mitigado — `moneyPublicEnabled(process.env)->notFound()` PRIMERA sentencia; RTL prueba que con OFF no se construye cliente Supabase ni se llama el RPC; grep verifica la presencia del gate.
- **T-16-07** (persona natural renderizada si el RPC se filtra): mitigado — `tipo_persona !== 'jur' -> notFound()` en HeaderSection; RTL `non-juridica -> notFound`.
- **T-16-08** (id malicioso/oversized a la DB): mitigado — `CONTRAPARTE_ID_RE` validado ANTES del RPC; RTL `'../etc/passwd' -> notFound` sin tocar la DB.
- **T-16-09** (insinuacion money<->voto / copy causal): mitigado por COMPOSICION (carriles `mt-12` hermanos, cero carril de voto, cero import de votos) Y por COPY (sweep sin vocabulario causal; RTL asserta `not.toMatch` causal en cada View y en la cabecera).
- **T-16-10** (atribucion equivocada "CC BY 4.0"): mitigado — strings por dataset (ChileCompra "mencion de la fuente" / SERVEL "terminos de uso por verificar"); grep gate prohibe "CC BY 4.0".
- **T-16-SC** (instalaciones npm): n/a — cero paquetes instalados (consumidor puro de componentes shipped).

Sin superficie de amenaza nueva fuera del threat_model del plan.

## Self-Check: PASSED
