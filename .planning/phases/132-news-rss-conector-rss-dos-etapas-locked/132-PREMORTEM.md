# Phase 132 — PREMORTEM

**Fecha:** 2026-08-05
**Pregunta rectora:** son 3 horas después y la Phase 132 fracasó — ¿por dónde?
**Método:** verificación de premisas contra el repo y contra PROD (solo lectura). No se editó ningún plan.

---

## 1. Tabla de premisas verificadas

| # | Premisa del plan | Método | Veredicto | Evidencia |
|---|---|---|---|---|
| 1 | `0084` es el número de migración libre | `ls supabase/migrations` | **VERDADERA** | último = `0083_coautoria_v2.sql`; `0073`/`0075` presentes (no tocar) |
| 2 | `BaseConnector` exportado con hooks `endpoints`/`validateShape`/`fingerprint` y `run()` no sobreescrito | `packages/ingest/src/index.ts` + `base-connector.ts:118-190` | **VERDADERA** | orden LOCKED literal: `cache.hasToday → robots → hostThrottle → rateLimiter.wait → fetcher.get → validateShape(decodeJson) → fingerprint → drift → sha256 → r2.putImmutable → snapshot.write`; `const host = new URL(spec.url).host` |
| 3 | `R2Store.putImmutable` y `R2Store.getObject(r2Path): Promise<Uint8Array>` existen | `r2-store.ts:56,88` | **VERDADERA** | firmas coinciden con lo que asume el plan 06 |
| 4 | `RobotsGuard`, `PgHostThrottle`, `Fetcher`, `DailyCache`, `SupabaseSnapshotStore`, `HostRateLimiter`, `sha256Hex`, `assertAllowedUrl`, `DEFAULT_ALLOWED_SUFFIXES` exportados del barrel | barrel `@obs/ingest` | **VERDADERA** | todos presentes; además `extraHostsFromEnv` (no usado por los planes) |
| 5 | `RobotsGuard` con `allowlist: {}` bloquea hosts de prensa (Pitfall 1) | `robots.ts:105-111` | **VERDADERA** | `this.allowlist !== undefined` ⇒ `assertAllowedUrl` ⇒ `HOST_BLOCKED` ⇒ `isAllowed=false`. Con `undefined` NO se gatea (fail-open) |
| 6 | `util.reserve_host_slot` existe en PROD | `psql -tA` sobre `pg_proc`/`pg_namespace` | **VERDADERA** | `util.reserve_host_slot` (+ `process_ingest_jobs`, `project_url`, `worker_secret`, `cleanup_net_http`) |
| 7 | `noticia` / `noticia_url_vista` NO existen aún en PROD | `information_schema.tables` | **VERDADERA** | 0 filas; 59 tablas en `public` |
| 8 | El root `pnpm test` recorre paquetes nuevos automáticamente | `package.json:10` + `pnpm-workspace.yaml` | **VERDADERA CON CONDICIÓN** | `pnpm -r --filter "./packages/*" test` ⇒ recorre por glob del workspace, **pero solo si el `package.json` del paquete tiene script `test`**. Plan 01 lo crea y además exige la prueba de falla inducida — correcto. Los 18 paquetes actuales tienen `"test": "vitest run"` |
| 9 | `packages/news/vitest.config.ts` propio es correcto (no CI-DARK) | `packages/tramitacion/vitest.config.ts` | **VERDADERA** (plan 01) — **pero `132-VALIDATION.md` dice lo contrario** | VALIDATION §Wave 0: "scaffold … **sin config propio** — gotcha Phase 43". El plan 01 y el 07 dicen "con config propio". Contradicción interna ya señalada por el plan 07, pero un ejecutor que lea VALIDATION primero hará lo opuesto |
| 10 | `files_modified` no colisionan dentro de cada wave | lectura de los 7 frontmatters | **VERDADERA** | W1: 01 (`packages/news/*` + `tsconfig.json`) vs 02 (`supabase/*`) — disjuntos. W2: 03 (`connector-news*`) vs 04 (`model/parse-rss/canonicalizar/prefiltro`) — disjuntos. W3=05, W4=06, W5=07 seriales |
| 11 | Ningún plan transcribe project-ref ni credenciales (B26) | `grep -rEn "[a-z]{15,}\.supabase\.co\|eyJ[A-Za-z0-9]{10}"` sobre la carpeta de la fase | **VERDADERA** | única aparición de `supabase.co` es la palabra en un criterio de grep (132-02:196) |
| 12 | Env vars asumidas existen en `.env` | `grep -oE '^[A-Z_0-9]+=' .env` (solo NOMBRES) | **VERDADERA** | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`. Los analogs usan `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY` (prod) y `SUPABASE_LOCAL_*` (local) — el plan 05 nombra ambos, consistente |
| 13 | **`schema_migrations` es accesible sin calificar** (plan 02 Task 2, paso 2) | `select table_schema from information_schema.tables where table_name='schema_migrations'` | **FALSA** | Solo existe en `supabase_migrations.schema_migrations`, `auth.*` y `realtime.*`. `select count(*) from schema_migrations` ⇒ `ERROR: relation "schema_migrations" does not exist`. Además el ledger va en `0079` (0080-0083 aplicadas y **no registradas** — drift preexistente) |
| 14 | Una tabla nueva queda deny-all para `anon`/`authenticated` sin REVOKE explícito | `pg_default_acl` en `public` + `current_user` | **VERDADERA POR SUERTE, FRÁGIL** | `SUPABASE_DB_URL` conecta como **postgres**; el default ACL de `postgres` para relaciones da solo `postgres`+`service_role`. Pero el default ACL de **`supabase_admin`** da `arwdDxtm` a `anon` y `authenticated`. Si la migración se aplicara con otra conexión, el pgTAP del plan 02 caería (y esa es exactamente la deuda que `0073`/`0074` cubren y **`0073` no está aplicada**) |
| 15 | `pgtap` disponible en PROD para el test del plan 02 | `pg_extension` | **VERDADERA** | 1 fila (deuda conocida: vive en `public`) |
| 16 | El `--dry-run` del plan 07 paso 1 "no escribe a Supabase" | `base-connector.ts:170-185` + `cache.ts:54-58` | **FALSA** | Etapa 1 **siempre** hace `snapshot.write` (`source_snapshot`), y `DailyCache.hasToday` consulta exactamente esa tabla. `--dry-run` solo cambia el writer de Etapa 2 (plan 06). Ver modo de fracaso #2 |
| 17 | El 412 de R2 no ocurrirá en re-corridas (evidencia del SC2 = caché diaria) | D-132-C + `<lastBuildDate>` | **VERDADERA y bien documentada** | los planes 06/07 lo dicen explícitamente y prohíben redactar la evidencia sobre el 412. Buen trabajo del planner |

---

## 2. Modos de fracaso, ordenados por daño

### F-1 — El checkpoint bloqueante del plan 02 falla por un `insert` a una tabla que no existe  🔴 BLOCKER
- **Síntoma a las 3 h:** la migración `0084` quedó **aplicada** a PROD, pero el paso 2 del checkpoint devuelve `ERROR: relation "schema_migrations" does not exist`. El ejecutor está frente a un gate `blocking` cuyo `acceptance_criteria` exige `select version from schema_migrations where version='0084'` ⇒ `0084`. Criterio inalcanzable ⇒ o se declara falso verde ("no aplica"), o se para. La fase queda con schema aplicado y ledger sin registrar (más drift).
- **Causa raíz:** el plan copió el comando del analog sin verificar el esquema del ledger. En PROD el ledger es `supabase_migrations.schema_migrations` y su última entrada es `0079` (0080-0083 ya están aplicadas sin registrar).
- **Cambio concreto:** en `132-02-PLAN.md` Task 2 `<how-to-verify>` paso 2 y en el `acceptance_criteria`, calificar el esquema: `insert into supabase_migrations.schema_migrations (version) values ('0084') on conflict do nothing;` — y **antes**, verificar las columnas obligatorias de esa tabla (tiene más que `version`). Alternativa honesta: reconocer el drift preexistente (0080-0083 sin registrar) y bajar el registro del ledger a "nice-to-have documentado", no a criterio de un gate bloqueante.

### F-2 — El `--dry-run` del paso 1 envenena la caché diaria y la corrida real no descarga nada  🔴 BLOCKER
- **Síntoma a las 3 h:** paso 1 (`--dry-run`) imprime 5 descargas felices. Paso 2 (corrida real) imprime `descargados=0 skips=5`, `refs=[]`, Etapa 2 no recibe ningún `SnapshotRef` ⇒ `noticia` queda **vacía**. Los criterios `count(*) from noticia > 0`, la query de `causa` con `prefiltro_lexico > 0` y "`pasa + prefiltro_lexico` == ítems parseados" son todos inalcanzables. Y no hay forma de reintentar hoy sin borrar filas de `source_snapshot` en PROD — algo que ningún plan autoriza.
- **Causa raíz:** el plan 07 asume que `--dry-run` "no escribe a Supabase". Falso: `BaseConnector.run()` escribe `source_snapshot` incondicionalmente, y `DailyCache.hasToday` lee de ahí. El plan lo intuye a medias ("o `skips=5` si el dry-run ya llenó la caché… hay que decirlo así") pero **no ve que en ese caso la Etapa 2 nunca corre** y SC4 queda sin evidencia.
- **Cambio concreto:** en `132-07-PLAN.md` `<how-to-verify>`, o bien (a) **eliminar el paso 1** y hacer que la corrida real sea la primera y única pasada de red del día, o bien (b) exigir que `--dry-run` inyecte un `SnapshotStore` in-memory (cambio en `132-06-PLAN.md` Task 1: el tri-estado debe cubrir *snapshot store*, no solo el writer de Etapa 2). Además, en `132-06`, la Etapa 2 debe poder alimentarse de los `source_snapshot` **ya existentes del día** (no solo de los `refs` de la corrida), o el par "dry-run + real" es estructuralmente incompatible con SC4.

### F-3 — La fase se detiene en la Wave 1 esperando a un operador que no está  🔴 BLOCKER (de calendario)
- **Síntoma a las 3 h:** `132-02` es `autonomous: false` con `checkpoint:human-verify gate="blocking"` y está en la **Wave 1**. `132-05` depende de `132-02`. En una sesión sin operador (el modo declarado en `132-DISCUSSION-LOG.md`, y el precedente de la Phase 129 que cerró en `AUSENTE-HANDOFF`), la ejecución se para tras ~30 min con un solo plan terminado.
- **Causa raíz:** un DDL nuevo, aditivo, deny-all, sobre tablas que no existen y que nada lee (D-12) está gateado como si fuera destructivo. El régimen ya ejecuta migraciones por `psql --single-transaction` de forma rutinaria.
- **Cambio concreto:** en `132-02-PLAN.md`, degradar Task 2 de `checkpoint:human-verify` a `auto` con las mismas verificaciones (apply + pgTAP + control positivo invertido), y dejar el gate humano **solo** para el plan 07 Task 2/3 (corrida LIVE + decisión de alcance). Si el gate debe quedarse, mover `132-02` a una wave posterior para que 01/03/04 avancen antes de bloquear.

### F-4 — El pre-filtro léxico dispara el criterio de banda 2-35% por matching de subcadenas  🟠 ALTO
- **Síntoma a las 3 h:** `prefiltro-lexico.test.ts` reporta 61% de paso sobre los 245 ítems de los fixtures. El ejecutor, para poner verde el criterio, ensancha la banda o poda el vocabulario — y poda es exactamente lo que D-06 (recall-first) prohíbe.
- **Causa raíz:** `VOCABULARIO_LEGISLATIVO.some(t => texto.includes(t))` con términos cortos: `sala` matchea *ensalada, salario, sala de urgencias*; `ley` matchea *leyenda, Bradley, Beverley*; `veto` matchea *veterano* no, pero `mensaje`, `urgencia`, `reforma`, `congreso` y `ley` sobre `titulo + 600 chars de descripción` disparan constantemente. La banda 2-35% se derivó de la densidad medida a mano (12/100, 3/100, 1/20, 0/15, 0/10 ≈ 6,5%), no de lo que hace el algoritmo especificado.
- **Cambio concreto:** en `132-04-PLAN.md` Task 3, especificar matching **con frontera de palabra** (`new RegExp("(^|[^a-z0-9])" + t + "([^a-z0-9]|$)")` sobre texto foldeado) y marcar los términos de una sola palabra corta (`ley`, `sala`, `veto`) como *requieren frontera obligatoria*. Y separar el criterio: el test de banda debe ser un **reporte registrado**, no un assert de rango — o fijar la banda contra la medición real del propio algoritmo tras la primera corrida, documentada.

### F-5 — Falsos verdes en los comandos de verificación  🟠 ALTO
- **Síntoma a las 3 h:** criterios "cumplidos" que no probaron nada. Catálogo concreto encontrado:
  1. `132-06` `<verify>`: `bash -c 'pnpm ... tsc -b && pnpm ... tsx src/run-news-cli.ts --flag-inexistente; test $? -eq 2'` — si **`tsc -b` falla con código 2** (lo hace en varios escenarios), el `&&` corta, `$?` vale 2 y el `test` sale **verde con el CLI nunca ejecutado**.
  2. `132-06` acceptance: `git diff --name-only` NO incluye `packages/ingest/` — bajo GSD cada tarea commitea de forma atómica, así que el working tree está limpio y el criterio pasa **siempre**, incluso si se tocó `@obs/ingest`. Debe ser `git diff --name-only <base-de-la-fase>..HEAD`.
  3. `132-01` Task 2 acceptance: el criterio de "ningún feed con host google" está redactado a medias (`grep -c "google" … | …` seguido de "`node -e` no aplica; usar el test") — es texto inejecutable; el ejecutor lo declarará cumplido a ojo.
  4. `132-03` acceptance: "Ningún test usa red: `grep -Ec "fetch\(|https?://(www|news)\." …`" — **sin valor esperado**. Criterio sin umbral = verde automático.
  5. `132-04` Task 1: "`grep -Ec "fetch\(|http[s]?://" parse-rss.ts` == 0 **salvo en comentarios**" — autocontradictorio; `grep -c` no distingue comentarios.
  6. `132-07` Task 1: "el conteo total de tests de `pnpm test` es estrictamente mayor que el de la rama base (`git stash`)". `pnpm -r` emite un conteo **por paquete**, no un total; y `git stash` no revierte un paquete ya commiteado. Criterio no operable.
- **Cambio concreto:** reescribir esos seis criterios con umbral numérico explícito y comandos que no puedan cortocircuitar (separar los `&&` en pasos con `set -e` y capturar el exit code de la invocación correcta en una variable).

### F-6 — La mutación #3 del plan 03 (RobotsGuard con `{allowlist:{}}`) no es testeable como está especificada  🟠 ALTO
- **Síntoma a las 3 h:** el ejecutor escribe el test; en el estado **correcto** (`allowlistNews()`), `RobotsGuard.isAllowed()` intenta un `fetch` real a `https://www.biobiochile.cl/robots.txt` dentro de un unit test. O bien el test hace red (prohibido y flaky), o bien el ejecutor lo reduce a probar solo el lado `{}` — un test que **certifica una ausencia**, exactamente el falso verde catalogado del proyecto.
- **Causa raíz:** `buildNewsDeps` según lo especificado en `132-03` no acepta un `fetchFn` inyectable, aunque `RobotsGuardOptions.fetchFn` existe en el framework.
- **Cambio concreto:** en `132-03-PLAN.md` Task 1, exigir que la fábrica acepte `fetchFn` (pasado a `RobotsGuard` y a `Fetcher`) y en Task 2 que el test use un `fetchFn` doble que sirva un `robots.txt` allow-all, con **control positivo apareado**: con `allowlistNews()` ⇒ `isAllowed=true` y el doble **fue llamado**; con `{}` ⇒ `isAllowed=false` y el doble **no fue llamado**.

### F-7 — El riesgo A4 (WAF/403 al `Fetcher` de Node) no tiene rama de fallo ejecutable  🟡 MEDIO
- **Síntoma a las 3 h:** La Tercera o BioBioChile devuelven 403 al `Fetcher`. `132-01` Task 3 dice "PARAR y escalar", pero el plan es `autonomous: true` y **no tiene un `<task type="checkpoint">`** donde parar. El ejecutor o improvisa (headers de navegador — prohibido), o marca el plan fallido y arrastra 6 planes que dependen de fixtures inexistentes (03, 04, 05, 06 usan `__fixtures__/*.xml`).
- **Causa raíz:** la escalación se declara en prosa, no en la estructura del plan.
- **Cambio concreto:** en `132-01-PLAN.md`, convertir Task 3 en `<task type="checkpoint:human-verify" gate="blocking">` **condicional**, o añadir una rama explícita: "si un host devuelve 403/406, retirarlo de `FEEDS`, dejar constancia, seguir con N-1 feeds y marcar SC4 como *parcialmente cumplido*" — con el número mínimo de feeds que aún hace la fase válida escrito (¿3? ¿4?).

### F-8 — La corrida de red no es "una" corrida  🟡 MEDIO
- **Síntoma a las 3 h:** el régimen dice una pasada de verificación. En la práctica hay **dos pulls vivos distintos**: `probe-feeds.ts` (plan 01 Task 3, 5 requests) y el paso 1/2 del plan 07 (5 requests más), separados por horas y sin caché compartida (el probe no escribe `source_snapshot`). Más los reintentos si algo del medio falla.
- **Cambio concreto:** documentarlo explícitamente en `132-07` (`total de requests de la fase = 10, 1 por host por pasada, ≥3 s de separación`) o hacer que el probe del plan 01 **sea** la primera pasada, guardando ya su crudo en R2 y su `source_snapshot`.

### F-9 — ~1 MB de contenido de medios comerciales commiteado como fixtures  🟡 MEDIO
- **Síntoma a las 3 h:** `packages/news/src/__fixtures__/latercera.xml` (≈605 KB según el research) y otros 4 quedan en el repo. El régimen ICS §8 restringió el full-text por copyright y la fase misma difiere el full-text a la 137; los `<description>` de RSS son extractos, pero es contenido de terceros versionado indefinidamente.
- **Cambio concreto:** en `132-01-PLAN.md` Task 3, recortar los fixtures a los primeros N ítems (p. ej. 10 por feed) más un fixture sintético mínimo, y ajustar los conteos congelados del plan 04 en consecuencia. O dejar constancia escrita de la decisión de commitearlos enteros con su razón.

### F-10 — El deny-all del plan 02 es verdadero por el rol de conexión, no por la migración  🟡 MEDIO
- **Síntoma a las 3 h:** el pgTAP pasa. Nadie sabe que pasó porque `SUPABASE_DB_URL` conecta como `postgres` (cuyo `pg_default_acl` para relaciones da solo `postgres`+`service_role`). El `pg_default_acl` de **`supabase_admin`** en `public` sigue dando `arwdDxtm` a `anon` y `authenticated`, y `0073` (que lo cierra) **está escrita y no aplicada**.
- **Cambio concreto:** en `132-02-PLAN.md`, añadir `revoke all on table noticia, noticia_url_vista from anon, authenticated;` explícito al final de la migración (idempotente, no-op bajo el rol actual) y registrar en el SUMMARY que el deny-all no depende del rol de conexión.

---

## 3. Lo que el plan hace BIEN (para no romperlo en la corrección)

- La enmienda D-132-A (Google News descartado por robots.txt) es la decisión correcta y está documentada con evidencia reproducible.
- La nota honesta sobre el 412 de R2 que **no** ocurrirá y la instrucción explícita de redactar la evidencia del SC2 sobre la caché diaria — es exactamente el tipo de falso verde que este proyecto ha pagado antes.
- El anti-vacuo CI-DARK del plan 01 (test que falla a propósito y verificar que la suite raíz cae) es la prueba correcta, no un grep.
- El control positivo del pgTAP (aserción invertida ⇒ `not ok`) y las mutaciones obligatorias con nombre de test registrado.
- El "marcar vista ANTES del reject" (Pitfall 11) verificado sobre la **traza ordenada**, no sobre el estado final.

---

## 4. Veredicto

**PREMORTEM: 3 BLOCKERS**

1. **F-1** — `132-02` Task 2: `insert into schema_migrations` sobre una relación que **no existe** en PROD (es `supabase_migrations.schema_migrations`). Criterio inalcanzable dentro de un gate bloqueante.
2. **F-2** — `132-07` paso 1 (`--dry-run`) llena `source_snapshot` ⇒ la corrida real sale `skips=5`, la Etapa 2 no recibe refs y `noticia` queda vacía ⇒ SC2 y SC4 sin evidencia posible y sin camino de reintento el mismo día.
3. **F-3** — `132-02` es `autonomous: false` con gate bloqueante en la **Wave 1**, y `132-05` depende de él: en sesión sin operador la fase se detiene con 1 de 7 planes hechos.

**Altos no bloqueantes (arreglar antes de ejecutar):** F-4 (banda 2-35% vs matching por subcadena), F-5 (seis criterios que pueden salir verdes sin probar nada), F-6 (mutación de `RobotsGuard` no testeable sin red).

**Medios:** F-7 (A4 sin rama de fallo estructural), F-8 (dos pasadas de red, no una), F-9 (fixtures de terceros en el repo), F-10 (deny-all cierto por el rol, no por la migración).

**Contradicción documental a resolver:** `132-VALIDATION.md` §Wave 0 dice "**sin** config propio"; `132-01` crea `packages/news/vitest.config.ts`. El plan 01 tiene razón (analog literal de `tramitacion`); corregir VALIDATION antes, no después.
