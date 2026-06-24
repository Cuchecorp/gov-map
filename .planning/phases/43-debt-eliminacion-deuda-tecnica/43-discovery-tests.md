# 43-discovery-tests — Premortem: Tests / Coverage / CI

**Fecha de exploración:** 2026-06-24
**Alcance:** monorepo raíz (`package.json`, `vitest.config.ts`), `app/`, `packages/*`, `.github/workflows/*`

---

## Resumen ejecutivo

El seed confirmado es correcto: el script `test` de la raíz **nunca corre la suite de `app/`** (~316 tests de componentes y páginas), y **ningún workflow de CI ejecuta tests de ningún tipo** —ni de `app/` ni de `packages/`. El único paso de vitest en CI es el smoke opcional de `fichas-backfill.yml`, que corre con `continue-on-error: true`. No existe un workflow de CI/CD orientado a calidad (test + typecheck) en el repositorio. La regresión de 2027 habría ocurrido porque el merge a main no tiene ninguna barrera automatizada.

---

## TEST-01: La suite de `app/` (~316 tests) nunca corre desde la raíz ni en CI

- **File:** `package.json` (raíz):9 y `vitest.config.ts` (raíz):7
- **Evidence:**
  ```json
  // package.json raíz
  "test": "pnpm -r --filter \"./packages/*\" test"
  ```
  ```ts
  // vitest.config.ts raíz
  include: ["packages/**/*.test.ts"],
  ```
  `app/` no está en el filtro `./packages/*` ni en el glob del config raíz. La suite de `app/` tiene su propio `vitest.config.ts` y `package.json scripts.test = "vitest run"`, pero **nadie lo invoca en CI**.
- **Repro:** `pnpm test` en la raíz no corre ningún test de `app/`. Un regression en un componente (p. ej. `VotacionBar`, `CrucesSection`) nunca falla la suite de CI.
- **Severity:** critical
- **Blast radius:** Los 22 archivos `.test.tsx` y 8 `lib/*.test.ts` de `app/` — incluyendo gates de seguridad (`cruces-gate`, `money-gate`, `net-gate`, `lockdown-guard`, `web-reader-jwt`) — nunca ejercen la barrera CI. Un flip de gate o un bug en renderizado de ficha parlamentaria pasa desapercibido.
- **Proposed fix:** Añadir `pnpm --filter "./app" test` al script raíz `test`, o crear un workflow `ci.yml` que corra `pnpm -r test` (incluyendo `app`).

---

## TEST-02: No existe ningún workflow CI de calidad (tests + typecheck)

- **File:** `.github/workflows/` (todos los 9 workflows)
- **Evidence:** Ningún workflow contiene los pasos `pnpm test`, `vitest run` (sin `continue-on-error`), ni `tsc`/`typecheck`. El único vitest en CI es:
  ```yaml
  # fichas-backfill.yml:58
  continue-on-error: true
  run: pnpm --filter @obs/fichas exec vitest run src/embed-ficha.test.ts
  ```
  Este paso no bloquea el workflow si falla. Los 9 workflows son exclusivamente de ingesta/deploy, disparados manualmente o con cron.
- **Repro:** Cualquier PR o push a `main` —si es que se usa— no tiene barrera de calidad automatizada. Ni tests ni typecheck bloquean el merge.
- **Severity:** critical
- **Blast radius:** Cualquier regresión en packages o app puede llegar a producción sin detección. Incluye bugs en parsers XML, writers Supabase, gates de seguridad, y el pipeline de embeddings.
- **Proposed fix:** Crear `.github/workflows/ci.yml` en disparo `push`/`pull_request` que ejecute: `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm -r typecheck`, `pnpm -r test` (incluyendo app).

---

## TEST-03: `packages/votos` incluye `*.live.test.ts` en el glob de CI con timeout de 120 s

- **File:** `packages/votos/vitest.config.ts`:7-10
- **Evidence:**
  ```ts
  include: ["src/**/*.test.ts"],
  testTimeout: 120_000,
  ```
  `run-camara-votos.live.test.ts` matchea el glob `src/**/*.test.ts`. Aunque el bloque LIVE está gateado por `process.env.VOTOS_LIVE === "1"` (`describe.skip` si no está activo), el archivo se carga y el `describe` externo vacío se registra. El timeout de 120 s contamina TODOS los tests del paquete (incluidos los unitarios), alargando CI si en algún momento la variable se setea por error.
- **Repro:** Si `VOTOS_LIVE=1` se filtra en CI (secret mal nombrado, env heredado), el test hace requests reales al WAF gubernamental desde el runner de GitHub con delay 2-3 s — quema cuota y puede colgar el job.
- **Severity:** high
- **Blast radius:** Exposición del WAF de `opendata.camara.cl` desde IP de GitHub Actions; timeout extendido enmascara tests lentos reales en el paquete.
- **Proposed fix:** Mover `run-camara-votos.live.test.ts` a un glob excluido (p. ej. renombrar a `*.live-probe.ts` y excluirlo en el `include` del vitest.config), o separarlo en un vitest config propio con `exclude` explícito en el config principal. El `testTimeout` de 120 s debe aplicarse solo al config del live-probe.

---

## TEST-04: `packages/cruces` — solo 1 test file para 10 archivos fuente; `writer-supabase.ts` sin test

- **File:** `packages/cruces/src/writer-supabase.ts` (sin test homólogo); `packages/cruces/src/clasificar.ts` (sin test unitario directo — solo a través de `clasificar.test.ts` con mock-provider)
- **Evidence:**
  ```
  packages/cruces/src/
    clasificar-fichas-cli.ts   — sin test
    clasificar-lobby-cli.ts    — sin test
    clasificar.ts              — sin test unitario aislado (golden-set lo toca con mock)
    writer-supabase.ts         — sin test
    prompt-lobby.ts            — sin test
    sector.ts                  — sin test unitario
  ```
  Solo `clasificar.test.ts` y `golden/golden-set.test.ts` existen. El writer hace `UPDATE sector_id` en tres tablas (`lobby_audiencia`, `contrato`, `proyecto_ficha`) y no tiene ningún test.
- **Repro:** Un cambio en el batch-update o en la columna objetivo silently falla sin test que lo detecte. El writer de cruces afecta la visibilidad pública de los cruces (Fase 41 ENCENDIDA en PROD).
- **Severity:** high
- **Blast radius:** Regresión silenciosa en el pipeline de etiquetado de sector → rows en PROD quedan sin `sector_id` sin alerta.
- **Proposed fix:** Añadir `writer-supabase.test.ts` con Supabase mock (espejo de `packages/fichas/src/writer-supabase.test.ts`); añadir tests para los CLIs de clasificación.

---

## TEST-05: `packages/dinero` — `ingest-run.ts` (orquestador de ChileCompra) sin test

- **File:** `packages/dinero/src/ingest-run.ts` (sin test homólogo)
- **Evidence:**
  ```
  packages/dinero/src/
    ingest-run.ts        — sin test (11 test files existen pero ninguno cubre ingest-run)
    ingest-cli.ts        — sin test
  ```
  `ingest-run-servel.test.ts` cubre la variante SERVEL, pero `ingest-run.ts` (ChileCompra, la fuente de contratos) carece de test.
- **Repro:** La lógica de cuarentena por RUT inválido, el manejo de bloqueados y la degradación honesta en `ingest-run.ts` no están exercised. Un refactor silencia filas de contratos reales.
- **Severity:** high
- **Blast radius:** La ingesta de contratos de mercado público (visibilidad pública en la ficha 360) puede emitir filas incorrectas o silenciar contratos sin alerta.
- **Proposed fix:** Añadir `ingest-run.test.ts` con `fetchFn` mock, ejerciendo los path: RUT inválido→cuarentena, proveedor no encontrado→0 filas, drift→cuarentena.

---

## TEST-06: `app/lib/supabase.ts` y `app/lib/supabase-admin.ts` sin tests; Supabase siempre mockeado en `app/`

- **File:** `app/lib/supabase.ts`, `app/lib/supabase-admin.ts` (sin test), y todos los tests de `app/` que mockean `@/lib/supabase`
- **Evidence:** Todos los tests de páginas en `app/` usan `vi.mock("@/lib/supabase", ...)`. La fábrica real de cliente Supabase (con configuración de `accessToken`, JWT, `persistSession:false`) nunca se ejerce en tests. En la suite de packages, el mismo patrón: los writers mockean el cliente.
  ```ts
  // app/app/parlamentario/[id]/page.test.tsx:102
  vi.mock("@/lib/supabase", () => ({
  ```
  La memoria del proyecto nota que bugs como "CR-01/ENT FK" solo fueron capturados por pgTAP-vs-PROD, no por la suite unitaria, por esta razón.
- **Repro:** Un cambio en la configuración del cliente Supabase (p. ej. cambio de `anon key`, mal setup de JWT en `web-reader-jwt.ts`) no falla ningún test de `app/`. Solo se detecta en PROD.
- **Severity:** high
- **Blast radius:** Configuración de autenticación rota llega a PROD sin detección. La lógica de `web-reader-jwt.ts` (JWT HS256 fail-closed) está testeada unitariamente en `app/lib/web-reader-jwt.test.ts`, pero la integración entre el cliente y el JWT real nunca se toca en CI.
- **Proposed fix:** Añadir al menos un test de integración smoke que instancie el cliente con credenciales de test y verifique la forma del objeto. Marcar en docs que la barrera final son pgTAP en PROD.

---

## TEST-07: pgTAP no está en ningún workflow CI — es exclusivamente manual (psql vs PROD)

- **File:** `.github/workflows/` (ninguno); memoria del proyecto
- **Evidence:** La memoria del proyecto indica: "runner real=`psql -tA -f` vs PROD (header 'supabase test db'=stale)". No existe ningún workflow que corra `pg_prove` ni `psql` contra una DB de test. Los 316 tests de suite se reportan en memoria como "suite 316/316 verde", pero eso es una corrida manual.
- **Repro:** Un cambio de schema (nueva migración) que rompe una RPC pública (`cruces_de_parlamentario`, `parlamentario_publico`, `buscar_citaciones`) no tiene barrera automatizada de pgTAP antes de llegar a PROD.
- **Severity:** high
- **Blast radius:** Regresión en RPCs públicas (que las páginas del frontend consumen directamente vía mock-libre) puede llegar a PROD sin detección automatizada. La RLS y los grants de Supabase tampoco se ejercen en CI.
- **Proposed fix:** Añadir un job en `ci.yml` que levante una DB Postgres de test (GitHub Actions service containers o Supabase CLI local), aplique las migraciones y corra `pg_prove` sobre los archivos pgTAP. Marcado como "needs validation" por complejidad de setup.

---

## TEST-08: `app/lib/utils.ts` y `app/lib/types.ts` sin test — posibles helpers de formato

- **File:** `app/lib/utils.ts`, `app/lib/types.ts`, `app/lib/agenda-types.ts` (sin test)
- **Evidence:**
  ```
  app/lib/
    utils.ts          — sin test
    types.ts          — sin test (solo types, aceptable)
    agenda-types.ts   — sin test (solo types, aceptable)
    admin-gate.ts     — sin test
  ```
  `admin-gate.ts` controla el acceso al panel de admin; sin test.
- **Repro:** Un cambio en `admin-gate.ts` que rompa la lógica de verificación de email no tiene cobertura.
- **Severity:** medium
- **Blast radius:** El panel `/admin/revisar-entidades` podría volverse accesible sin autenticación si `admin-gate.ts` se rompe silenciosamente.
- **Proposed fix:** Añadir test unitario para `admin-gate.ts` (mock de `auth.getUser`).

---

## TEST-09: Root `vitest.config.ts` incluye `packages/**/*.test.ts` — duplica lo que cada package ya declara, con entorno incorrecto

- **File:** `vitest.config.ts` (raíz):7
- **Evidence:**
  ```ts
  include: ["packages/**/*.test.ts"],
  environment: "node",
  ```
  El script raíz invoca `pnpm -r --filter "./packages/*" test`, que a su vez ejecuta el `vitest.config.ts` de cada package. El `vitest.config.ts` de la raíz existe separado pero no es invocado por el script. Si se invocara directamente (`vitest run` en la raíz), usaría entorno `node` pero no carga los `setupFiles` ni aliases de cada package — podría enmascarar fallos de configuración en packages que tienen alias especiales.
- **Repro:** Bajo (`pnpm -r test` no usa el config raíz). Riesgo solo si alguien corre `vitest run` en la raíz directamente creyendo que cubre todo.
- **Severity:** low
- **Blast radius:** Falsa sensación de cobertura si se usan los dos mecanismos de forma inconsistente.
- **Proposed fix:** Eliminar o documentar claramente el `vitest.config.ts` raíz (actualmente es un artefacto sin uso efectivo en el script `test`).

---

## TEST-10: `packages/core/src/provenance.test.ts` — assertions de tiempo real con `Date.now()` (no fake timers)

- **File:** `packages/core/src/provenance.test.ts`:7-12
- **Evidence:**
  ```ts
  const before = Date.now();
  const prov = makeProvenance("dummy", "https://example.cl/recurso");
  const after = Date.now();
  expect(parsed).toBeGreaterThanOrEqual(before);
  expect(parsed).toBeLessThanOrEqual(after);
  ```
  El test usa `Date.now()` real en lugar de fake timers. En la práctica es estable (el assertion window es amplio), pero en un runner extremadamente lento o con clock skew podría fallar con `parsed > after`.
- **Repro:** Probabilidad muy baja en práctica; documentado por completitud.
- **Severity:** low
- **Blast radius:** Flakiness esporádica en CI lento — test en `@obs/core` que podría reportar falso fallo.
- **Proposed fix:** Usar `vi.useFakeTimers()` + `vi.setSystemTime()` para hacer el test determinista, o ampliar el window añadiendo 1 ms de margen: `expect(parsed).toBeLessThanOrEqual(after + 1)`.

---

## Tabla resumen

| ID | Título | Severidad |
|----|--------|-----------|
| TEST-01 | Suite `app/` (~316 tests) excluida de root y de CI | **critical** |
| TEST-02 | Ningún workflow CI ejecuta tests ni typecheck | **critical** |
| TEST-03 | `votos` incluye live test en glob principal con timeout 120 s | **high** |
| TEST-04 | `cruces` — 10 src files, 1 test file; `writer-supabase.ts` sin test | **high** |
| TEST-05 | `dinero/ingest-run.ts` (ChileCompra) sin test | **high** |
| TEST-06 | Supabase siempre mockeado en `app/`; bugs de integración solo visibles en PROD | **high** |
| TEST-07 | pgTAP es exclusivamente manual; no hay CI de migraciones/RPCs | **high** |
| TEST-08 | `admin-gate.ts` sin test; acceso a panel admin sin cobertura | **medium** |
| TEST-09 | `vitest.config.ts` raíz duplica configuración sin uso efectivo | **low** |
| TEST-10 | `provenance.test.ts` usa `Date.now()` real — potencialmente flaky | **low** |
