# 43-validation-tests — Adversarial validation (Opus, 1-by-1)

**Fecha:** 2026-06-24
**Validador:** Opus, modo adversarial (re-lectura file:line de cada hallazgo).
**Baseline verificado en esta sesión:**
- `pnpm --filter ./app test` → **316 passed (32 files)**, verde.
- `pnpm -r --filter "./packages/*" test` → **todos los packages verdes** (core 21, llm 78, cruces 14, ingest 63, identity 110, agenda 110, adjudication 89, lobby 48, probidad 46, tramitacion 104, fichas 66, votos 3 +1 file skipped).
- `votos`: el `*.live.test.ts` se carga pero queda como **1 test file skipped** (`describe.skip`), no ejecuta cuerpo; suite offline corre en 24 ms (el `testTimeout:120_000` es un techo, no un piso).

**Contexto load-bearing descubierto:** `deploy-cloudflare.yml` dispara SOLO en `workflow_dispatch` (manual). **No existe deploy automático en push a `main`.** Por tanto la narrativa "una regresión llega a PROD al mergear" (TEST-01/02/07) está **sobre-estimada**: no hay ruta automatizada a producción; el deploy es un paso de operador. Esto refuerza tratar el *standing-up* de CI como decisión de operador (gasto de Actions-minutes), no como hygiene autónoma.

---

## TEST-01 — Suite `app/` (~316 tests) excluida de root y de CI

- **REAL.** `package.json:9` → `"test": "pnpm -r --filter \"./packages/*\" test"` (filtro excluye `./app`). `vitest.config.ts` raíz:6 → `include: ["packages/**/*.test.ts"]`. `app/package.json:10` tiene su propio `"test": "vitest run"` que **nadie invoca** desde la raíz. Confirmado file:line.
- **Root cause:** el filtro `./packages/*` y el glob raíz omiten `app/` por construcción; nunca se cableó.
- **What breaks:** una regresión en componentes/páginas de `app/` (incl. gates `cruces-gate`, `money-gate`, `net-gate`, `lockdown-guard`, `web-reader-jwt`) no falla `pnpm test` en la raíz. (Matiz: el operador SÍ corre la suite app manualmente — memoria "suite 316/316".)
- **Protecting mechanism:** ninguno automatizado; solo la corrida manual del operador.
- **VERDICT: FIX-NOW** (parte root-script) — cablear `app` al script `test` de la raíz es config-hygiene, additive, y **provablemente verde ahora** (acabo de correr ambas suites verdes).
- **Cambio mínimo exacto:**
  ```json
  // package.json raíz
  "test": "pnpm -r --filter \"./packages/*\" test && pnpm --filter ./app test"
  ```
  (Encadenar `&&` mantiene el comportamiento de packages intacto y añade app al final. Alternativa `pnpm -r test` también incluiría app, pero `&&` explícito es más legible y no cambia el orden ya validado.)
- **Cómo se prueba verde:** `pnpm test` en la raíz → packages (todos verdes arriba) + app (316/316 verde arriba). Sin tocar fuente. Cero riesgo de regresión.
- **NOTA:** la *otra mitad* del proposed fix ("crear `ci.yml` que corra `pnpm -r test`") NO es parte de este FIX-NOW → ver TEST-02.

---

## TEST-02 — Ningún workflow CI ejecuta tests ni typecheck

- **REAL.** 9 workflows en `.github/workflows/` (agenda-weekly, backfill, backup-parlamentario, deploy-cloudflare, fichas-backfill, leyes-weekly, lobby-camara-weekly, lobby-leylobby-weekly, probidad-weekly). Grep `vitest|tsc|typecheck|pg_prove`: único hit = `fichas-backfill.yml:54 continue-on-error: true` + `:58 vitest run src/embed-ficha.test.ts` (smoke opcional, no bloqueante). Ningún `tsc`/`typecheck` en ningún workflow. Confirmado.
- **Root cause:** los 9 workflows son de ingesta/deploy (cron + `workflow_dispatch`); nunca se creó un workflow de calidad.
- **What breaks:** PRs/push a `main` no tienen barrera de calidad. PERO: `deploy-cloudflare.yml` es `workflow_dispatch`-only → **no hay merge→PROD automático**; la barrera real hoy es el operador.
- **Protecting mechanism:** ninguno; mitigado por deploy manual gated.
- **VERDICT: CHECKPOINT-OPERADOR.** Crear `ci.yml` es un cambio que el agente *puede* escribir, pero:
  1. Consume Actions-minutes — la memoria del proyecto documenta minimización explícita de minutos CI (backfill LOCAL, crons mínimos). Un CI en cada PR/push es una **decisión de política de gasto del operador**.
  2. Una barrera real implica branch-protection (que el operador configura en GitHub, fuera del repo) — sin ella, `ci.yml` informa pero no bloquea, dando falsa sensación de seguridad.
  3. No hay deploy automático que el CI deba proteger; el ROI inmediato es bajo.
- **Recomendación para el operador (si aprueba minutos):** `ci.yml` SOLO en `pull_request` (no `push`, para no gastar en cada commit a ramas), sin secrets, pasos `pnpm install --frozen-lockfile --ignore-scripts` → `pnpm -r typecheck` → `pnpm test` (ya incluye app tras TEST-01). Es additive y no toca PROD. Pero la decisión de encenderlo (y de atarlo a branch-protection) es del operador. **No aplicar autónomamente.**

---

## TEST-03 — `votos` incluye `*.live.test.ts` en glob principal con timeout 120 s

- **REAL pero SOBRE-ESTIMADO.** `packages/votos/vitest.config.ts:6` `include:["src/**/*.test.ts"]` → matchea `run-camara-votos.live.test.ts`. El bloque vivo está gateado `(LIVE ? describe : describe.skip)` con `LIVE = process.env.VOTOS_LIVE === "1"` (líneas 17, 26). En la corrida verde de esta sesión aparece como **1 file skipped** y la suite offline corre en **24 ms** — el `testTimeout:120_000` es un **techo**, no contamina la duración de tests rápidos. La afirmación "alarga CI / contamina TODOS los tests" es incorrecta: un timeout alto no ralentiza tests que pasan rápido.
- **Root cause:** archivo live comparte glob con los unitarios; gating por env en vez de por exclusión de glob.
- **What breaks (riesgo real, acotado):** si `VOTOS_LIVE=1` se filtra al runner (secret/env mal heredado), el test golpea el WAF de `opendata.camara.cl` desde IP de GitHub. Hoy improbable: ningún workflow corre `votos` ni setea `VOTOS_LIVE`.
- **Protecting mechanism:** el gate `describe.skip` por env (fail-closed por defecto).
- **VERDICT: FIX-NOW** (defensa-en-profundidad, additive, provablemente verde) — excluir el live del glob por defecto es seguro y mantiene la suite verde.
- **Cambio mínimo exacto** (`packages/votos/vitest.config.ts`):
  ```ts
  include: ["src/**/*.test.ts"],
  exclude: ["**/*.live.test.ts", "node_modules/**"],
  ```
  (Añadir `exclude` explícito. NO renombrar el archivo — eso rompería la convención `VOTOS_LIVE` documentada y el comentario del config; un `exclude` es menos invasivo.)
- **Cómo se prueba verde:** `pnpm --filter @obs/votos test` → la suite offline (3 tests) sigue verde; el file live ya no se colecta (antes: skipped; ahora: excluido). El operador que quiera correrlo usa `vitest run src/run-camara-votos.live.test.ts` directo. Cero cambio de comportamiento offline.
- **Matiz de severidad:** el discovery lo marca `high`; el riesgo efectivo es `medium` (gate ya existe; ningún workflow lo dispara). El fix es barato igual.

---

## TEST-04 — `cruces/writer-supabase.ts` sin test

- **REAL** (con imprecisión fáctica). `packages/cruces/src/writer-supabase.ts` no tiene `.test.ts` homólogo (solo `clasificar.test.ts` + `golden/golden-set.test.ts`). **CORRECCIÓN al discovery:** el writer NO toca `lobby_audiencia` ni `contrato`; hace `UPDATE sector_id` sobre **`proyecto_ficha`** y **`lobby_contraparte`** (líneas 96-97, 113-115). El discovery cita las tablas equivocadas. El writer acepta `client?` inyectable (línea 49, 80-83) — diseñado para mock.
- **Root cause:** writer nuevo (Fase 41) sin test homólogo.
- **What breaks:** un cambio de tabla/columna objetivo o de la clave del UPDATE pasa sin detección. Toca visibilidad pública (cruces ENCENDIDOS en PROD).
- **Protecting mechanism:** ninguno unitario; pgTAP-vs-PROD manual.
- **VERDICT: FIX-NOW** (test nuevo additive, espejo directo de `fichas/src/writer-supabase.test.ts`). El `client?` inyectable hace trivial el fake; no requiere fixtures profundos.
- **Cambio mínimo exacto:** crear `packages/cruces/src/writer-supabase.test.ts` con un fake client encadenable (`from().update().eq()...→{error}`) que capture tabla/columna/eq, espejando el patrón de `fichas`. Asserts: (a) `actualizarSectorFicha` → `from('proyecto_ficha').update({sector_id}).eq('boletin',…)`; (b) `actualizarSectorContraparte` → `from('lobby_contraparte')` con `.eq('rol')` solo si `rol!==undefined`; (c) `dedupePorClave` last-write-wins en los batch; (d) lote vacío → no-op; (e) `error.message` propagado SIN la service key. NO se toca `writer-supabase.ts`.
- **Cómo se prueba verde:** `pnpm --filter @obs/cruces test`. Como el writer ya expone su superficie y el fake es local, el test es determinista. (Los CLIs `clasificar-*-cli.ts` que el discovery también menciona quedan FUERA: orquestan LLM+env+args y su test pediría fixtures pesados → no incluir aquí, scope-creep.)

---

## TEST-05 — `dinero/ingest-run.ts` (ChileCompra) sin test

- **REAL.** `packages/dinero/src/ingest-run.ts` sin `.test.ts` homólogo (existe `ingest-run-servel.test.ts` para la variante SERVEL, no para ChileCompra). `runIngestDinero` (línea 83) tiene paths ricos: RUT inválido→cuarentena (98-107), drift `BuscarProveedor`→cuarentena (115-124), sin `CodigoEmpresa`→0 filas (128-132), `ChileCompraBloqueadaError`→degradación (134-145), drift paso-2→cuarentena del día (175-184).
- **Root cause:** orquestador sin test; el de SERVEL no lo cubre.
- **What breaks:** un refactor que silencie filas de contratos reales o rompa la cuarentena/degradación no se detecta. Toca visibilidad pública (ficha 360).
- **Protecting mechanism:** ninguno directo; cubierto indirectamente por `reconciliar-contrato.test.ts`, `parse-chilecompra.test.ts`, `connector-chilecompra.test.ts` (las piezas, no la orquestación).
- **VERDICT: FIX-NOW, pero ACOTADO** — feasible (existe el molde `ingest-run-servel.test.ts` con `fakeConnector`+`SpyWriter`; el `runIngestDinero` recibe `conector`/`writer`/`maestra` inyectables), aunque pide MÁS andamiaje que TEST-04 (fake `ChileCompraConnector` con `buscarProveedor`+`ordenesDeCompra`, spy `DineroWriter`, maestra fixture con RUT válido módulo-11, `ticket` dummy).
- **Cambio mínimo exacto:** crear `packages/dinero/src/ingest-run.test.ts` cubriendo los paths que NO requieren red real: (a) RUT inválido→`cuarentenados` contiene el RUT, 0 upserts, `degradacion.cuarentena===true`; (b) `BuscarProveedor` forma drift→cuarentena; (c) `ChileCompraBloqueadaError`→degradación honesta sin cuarentena, continúa; (d) sin `CodigoEmpresa`→0 contratos + marca. Usar un RUT con DV válido (p.ej. `"76.000.000-K"` validado por `isRutValido`). NO se toca fuente.
- **Cómo se prueba verde:** `pnpm --filter @obs/dinero test`. Riesgo: el path "feliz" (con `reconciliarContrato` real + maestra) puede pedir afinar el fixture de RUT/maestra; **si el path feliz resulta frágil, limitar el test a los 4 paths de degradación/cuarentena** (que son los de mayor valor y no dependen de matching). Mantener el test acotado a esos paths lo deja determinista y verde. **Si al implementar el andamiaje excede ~espejo-de-servel, degradar a DEFERRED** (no forzar fixtures profundos).

---

## TEST-06 — Supabase siempre mockeado en `app/`; `supabase.ts`/`supabase-admin.ts` sin test

- **REAL pero de BAJO VALOR.** `app/lib/supabase.ts` (`createServerSupabase`, líneas 33-51) y `supabase-admin.ts` sin test; todas las páginas mockean `@/lib/supabase`. La fábrica real (`createClient` con `accessToken`/`persistSession:false`) no se ejerce. PERO: la pieza con lógica real, `web-reader-jwt.ts` (mint JWT HS256 fail-closed), **SÍ está testeada** (`web-reader-jwt.test.ts`). `createServerSupabase` es casi pasamanos: lee env, throw si falta, delega a `createClient` del SDK.
- **Root cause:** la fábrica es thin-wrapper; un test "de forma" solo verificaría que se llamó a `createClient` del SDK (poco valor — es código de terceros).
- **What breaks:** un cambio de config de auth (anon key/JWT setup) no falla la suite `app`. La memoria confirma: bugs tipo "CR-01/ENT FK" solo los pilló pgTAP-vs-PROD, no la suite unitaria. Esto es **estructural** (frontera real = pgTAP en PROD), no un gap unitario que un mock cierre.
- **Protecting mechanism:** `web-reader-jwt.test.ts` (la lógica), + pgTAP-vs-PROD (la integración).
- **VERDICT: WON'T-FIX (now) / DEFERRED.** El proposed fix ("smoke que instancie el cliente y verifique la forma del objeto") es **mock-heavy de bajo valor**: re-verifica el SDK de Supabase, no nuestra lógica. La lógica testeable (mint JWT) YA tiene test. Lo que falta de verdad (integración cliente↔PostgREST↔RLS) NO lo cubre un mock unitario — lo cubre pgTAP (ver TEST-07). Añadir un smoke da falsa cobertura.
  - *Único FIX-NOW barato opcional (no obligatorio):* un test del path `throw` cuando faltan `SUPABASE_URL`/`SUPABASE_ANON_KEY` (líneas 37-42) — determinista, sin mockear el SDK. Bajo valor pero additive y verde. Lo dejo como opcional, no como cierre del hallazgo.
  - El cierre real de TEST-06 es **documentar** que la frontera de integración es pgTAP (parte de TEST-07), no inflar mocks. Severidad efectiva: `medium`, no `high`.

---

## TEST-07 — pgTAP exclusivamente manual; sin CI de migraciones/RPCs

- **REAL.** Ningún workflow corre `pg_prove`/`psql` contra una DB de test (grep confirma 0 hits). La memoria documenta runner manual `psql -tA -f` vs PROD.
- **Root cause:** levantar pgTAP en CI requiere infra (service container Postgres o Supabase CLI local + aplicar todas las migraciones + extensiones + `pg_prove`).
- **What breaks:** un cambio de schema que rompa una RPC pública (`cruces_de_parlamentario`, `parlamentario_publico`, `buscar_citaciones`) o un grant/RLS no tiene barrera automatizada pre-PROD.
- **Protecting mechanism:** corrida manual del operador vs PROD (riesgosa: header "supabase test db" stale per memoria).
- **VERDICT: CHECKPOINT-OPERADOR.** Standing-up de un Postgres service container + aplicar migraciones + extensiones (pgvector, pgcrypto, etc.) + `pg_prove` es infra no trivial, consume Actions-minutes (contra la política documentada de minimización), y es propenso a drift con el entorno Supabase real (extensiones/roles que el container no replica 1:1). No es hygiene autónoma. Decisión de gasto/infra del operador. **No es WON'T-FIX** (es valioso y eventualmente correcto), pero **no aplicar autónomamente**: pertenece al mismo `ci.yml` que TEST-02, gated por aprobación de minutos.

---

## TEST-08 — `admin-gate.ts` sin test

- **REAL y es el mejor candidato a FIX-NOW de los missing-test.** `app/lib/admin-gate.ts` es función pura: `adminRevisionEnabled(env) => env.ADMIN_REVISION_ENABLED === "true"` (línea 25). Es **idéntica en forma** a `money-gate.ts`/`net-gate.ts`/`cruces-gate.ts`, que **SÍ tienen test** (`money-gate.test.ts`, `net-gate.test.ts`, `cruces-gate.test.ts` confirmados). `admin-gate.test.ts` **no existe** — asimetría pura.
- **Root cause:** se añadió el gate de admin sin clonar el test del patrón hermano.
- **What breaks:** un cambio que rompa el fail-closed (p.ej. truthiness laxa que deje pasar `"false"`/`"1"`) montaría `/admin/revisar-entidades` (PII de la cola `revision_entidad`) sin alerta.
- **Protecting mechanism:** ninguno unitario (a diferencia de sus hermanos).
- **VERDICT: FIX-NOW.** Test nuevo additive, espejo byte-por-byte de `money-gate.test.ts`. Función pura sin deps → determinista, sin mocks (ni siquiera mockear `auth.getUser`: el gate NO llama auth, solo lee env — el discovery sugiere "mock de auth.getUser" por error; no hace falta).
- **Cambio mínimo exacto:** crear `app/lib/admin-gate.test.ts` con los 5 casos del patrón hermano: ausente→false, `"false"`→false, `"1"`→false, `"TRUE"`→false, `"true"`→true. Import `import { adminRevisionEnabled } from "./admin-gate"` (el `import "server-only"` se resuelve al stub vacío vía el alias del `app/vitest.config.ts`, como en los hermanos). NO se toca fuente.
- **Cómo se prueba verde:** `pnpm --filter ./app test` → +5 tests, verde (la función ya cumple esos casos por construcción).

---

## TEST-08b — `utils.ts` (`safeExternalHref`) sin test [sub-hallazgo, no en la tabla original]

- **REAL.** `app/lib/utils.ts` tiene `safeExternalHref` (líneas 15-23): guard de seguridad que bloquea `javascript:`/`data:`/`vbscript:` en `href` derivados de fuente externa. Sin test. (El discovery lo menciona de pasada en TEST-08 como "posibles helpers de formato" pero no lo desarrolla.)
- **VERDICT: FIX-NOW.** Es un guard de seguridad (XSS via href) puro y determinista → test additive de alto valor. Casos: `https://`/`http://`→pasa; `javascript:alert(1)`→null; `data:…`→null; `null`/`undefined`/`""`→null; URL malformada→null. NO se toca fuente. `cn()` (clsx+twMerge) no necesita test (terceros).
- **Prueba verde:** `pnpm --filter ./app test`.

---

## TEST-09 — `vitest.config.ts` raíz duplica config sin uso efectivo

- **REAL.** El script `test` usa `pnpm -r --filter "./packages/*" test` (cada package con su propio config); el `vitest.config.ts` raíz (`include:["packages/**/*.test.ts"]`, `environment:"node"`) **no lo invoca el script**. Solo importaría si alguien corre `vitest run` desnudo en la raíz, donde usaría `node` sin los `setupFiles`/aliases de cada package.
- **Root cause:** artefacto huérfano; el script real delega a los configs por-package.
- **What breaks:** falsa sensación de cobertura si alguien corre `vitest run` en raíz creyendo que cubre todo. Riesgo bajo.
- **Protecting mechanism:** n/a.
- **VERDICT: FIX-NOW (documentación) o WON'T-FIX (borrado).** Matiz importante: si se aplica TEST-01 vía un futuro `pnpm -r test` o vía un runner raíz, este config podría volverse relevante — pero con el fix `&&` propuesto en TEST-01 NO se usa. **Recomendado: añadir un comentario de cabecera** aclarando que es un fallback no usado por `pnpm test` (el script delega a los configs por-package), para evitar el malentendido. Borrarlo es también válido pero quita el fallback de "correr todo packages desde un solo config"; el comentario es menos destructivo.
- **Cambio mínimo exacto:** prepend en `vitest.config.ts` raíz:
  ```ts
  // NOTA: `pnpm test` (root) delega a los vitest.config de cada package vía
  // `pnpm -r --filter ./packages/* test` + `pnpm --filter ./app test`. Este config
  // NO se usa por ese script; es un fallback para `vitest run` desnudo en la raíz
  // (entorno node, sin los setupFiles/aliases por-package). No confiar en él para cobertura.
  ```
- **Prueba verde:** comentario puro, sin efecto runtime.

---

## TEST-10 — `provenance.test.ts` usa `Date.now()` real (potencial flaky)

- **REAL pero severidad mínima.** `packages/core/src/provenance.test.ts:6-21`: `before=Date.now()` / `after=Date.now()` rodean `makeProvenance`, y `parsed=Date.parse(prov.fetchedAt)` se asserta en `[before, after]`. `fetchedAt` es ISO (precisión ms); `before`/`after` también ms. El window es amplio y en la práctica estable; flake solo bajo clock skew/runner extremo.
- **Root cause:** assertion temporal sobre reloj real en vez de fake timers.
- **What breaks:** flake esporádica en CI lento (`parsed > after` por redondeo/skew). Probabilidad muy baja.
- **Protecting mechanism:** el window amplio.
- **VERDICT: FIX-NOW** (endurecimiento determinista trivial, additive, no cambia comportamiento del SUT).
- **Cambio mínimo exacto** — la opción de menor riesgo (no introduce fake timers que podrían afectar otros asserts): ampliar el margen 1 ms en `provenance.test.ts`:
  ```ts
  expect(parsed).toBeGreaterThanOrEqual(before - 1);
  expect(parsed).toBeLessThanOrEqual(after + 1);
  ```
  (Absorbe redondeo/skew sub-ms sin debilitar la intención del test —sigue verificando que `fetchedAt` se captura en el momento del fetch—.) Alternativa `vi.useFakeTimers()+setSystemTime` es más "pura" pero toca más superficie; el ±1 ms es suficiente y mínimo.
- **Prueba verde:** `pnpm --filter @obs/core test` (21 tests, ya verdes; el cambio solo afloja cotas).

---

## Síntesis de aplicación (orden recomendado, todo additive/hygiene, cero PROD/deploy/crons)

FIX-NOW agrupados (provablemente verdes con las baselines de esta sesión):
1. **TEST-01**: `&&` app al script `test` raíz.
2. **TEST-08**: `app/lib/admin-gate.test.ts` (espejo de money-gate).
3. **TEST-08b**: tests de `safeExternalHref` en `app/lib/` (guard XSS).
4. **TEST-04**: `packages/cruces/src/writer-supabase.test.ts` (espejo de fichas).
5. **TEST-03**: `exclude` del live test en `packages/votos/vitest.config.ts`.
6. **TEST-10**: margen ±1 ms en `provenance.test.ts`.
7. **TEST-09**: comentario de cabecera en `vitest.config.ts` raíz.
8. **TEST-05**: `packages/dinero/src/ingest-run.test.ts` (ACOTADO a paths de degradación/cuarentena; degradar a DEFERRED si el fixture del path feliz resulta frágil).

CHECKPOINT-OPERADOR (no aplicar autónomamente — gasto de Actions-minutes / branch-protection / infra):
- **TEST-02** (crear `ci.yml`): decisión de minutos + branch-protection del operador.
- **TEST-07** (pgTAP en CI): infra service-container no trivial; mismo `ci.yml`, gated.

WON'T-FIX / DEFERRED:
- **TEST-06** (smoke del cliente Supabase): mock-heavy de bajo valor; la lógica real (mint JWT) ya está testeada; la frontera real es pgTAP (TEST-07). Documentar, no inflar mocks.

**Gates respetados:** ninguna aplicación toca PROD, deploya, ni enciende crons/secrets. Ningún cambio de comportamiento de fuente sin test protector (los únicos edits de no-test son: script `test` raíz [hygiene], `exclude` de glob [defensa-en-profundidad], comentario [doc], margen de assert [endurecimiento]).
