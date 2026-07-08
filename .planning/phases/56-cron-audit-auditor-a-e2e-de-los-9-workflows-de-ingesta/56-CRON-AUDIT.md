# Auditoría E2E de Ingesta — Phase 56 CRON-AUDIT

Fecha: 2026-07-08
Repo remoto: Cuchecorp/gov-map
Auditor: Claude (Sonnet 4.6) + probes live gh CLI / psql / R2 (SigV4 directo)
Fase siguiente: Phase 57 (CRON-FIX) — la gap-list es su backlog directo.

---

## Tabla resumen — 9 workflows

| # | Workflow | Schedule | Trigger | Secrets requeridos | Secrets presentes | Última corrida real | Veredicto |
|---|----------|----------|---------|-------------------|-------------------|---------------------|-----------|
| 1 | agenda-weekly | Mon 11:00 UTC (`0 11 * * 1`) | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET | 2/7 | 2026-07-06 (success) | CORRE-CON-GAPS |
| 2 | leyes-weekly | Fri 20:00 UTC (`0 20 * * 5`) | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY | 2/2 | 2026-07-03 (failure) | NO-CORRE |
| 3 | lobby-camara-weekly | Tue 11:00 UTC (`0 11 * * 2`) | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET | 2/6 | 2026-07-07 (failure) | NO-CORRE |
| 4 | lobby-leylobby-weekly | Wed 11:00 UTC (`0 11 * * 3`) | schedule + dispatch | SUPABASE_API_URL→SUPABASE_URL, SUPABASE_SECRET_KEY→SUPABASE_SERVICE_KEY | 2/2 | 2026-07-08 (success) | CORRE-CON-GAPS |
| 5 | probidad-weekly | Thu 11:00 UTC (`0 11 * * 4`) | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (opt) | 2/6 | 2026-07-02 (failure) | NO-CORRE |
| 6 | fichas-backfill | — (manual only) | workflow_dispatch | SUPABASE_URL, SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET | 2/9 | never triggered | NO-APLICA-CRON |
| 7 | backup-parlamentario | Mon 06:00 UTC (`0 6 * * 1`) | schedule + dispatch | R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (opt, if-gated) | 0/4 opt | 2026-07-06 (success sched) / 2026-07-08 (failure push) | CORRE-CON-GAPS |
| 8 | backfill | — (manual only) | workflow_dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET | 2/6 | never triggered | NO-APLICA-CRON |
| 9 | deploy-cloudflare | — (manual only) | workflow_dispatch | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | 0/2 | never triggered | NO-APLICA-CRON |

**Secrets confirmados en repo** (probe P2 — `gh secret list --repo Cuchecorp/gov-map`, 2026-07-08):
- `SUPABASE_API_URL` (creado 2026-06-23T14:06:11Z)
- `SUPABASE_SECRET_KEY` (creado 2026-06-23T14:06:12Z)

Todos los demás secrets referenciados en los YAML están **ausentes del repo**.

---

## Secciones por workflow

### W-1: agenda-weekly

**YAML:** `.github/workflows/agenda-weekly.yml`
**Schedule:** `0 11 * * 1` (lunes 11:00 UTC)
Veredicto: CORRE-CON-GAPS
**Causa raíz del veredicto:** Corre sin errores fatales, pero Etapa-1 (R2) es no-op porque faltan 5 secrets (DEEPSEEK_API_KEY + 4 R2) y la ruta Etapa-2-from-R2 no existe.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Parcial | No-op (R2 secrets ausentes en repo) | `packages/agenda/src/ingest-run.ts:218` |
| Etapa-2 desde R2 | No | No implementada (lee resultado en memoria) | `packages/agenda/src/ingest-run.ts` (sin ruta R2-read) |
| Hash-check pre-descarga | Parcial | Comprueba clave ISO-semana, no sha256/ETag | `packages/agenda/src/ingest-run.ts` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** parcial — código presente (`TablaR2Target.putImmutable` en `packages/agenda/src/ingest-run.ts:218`), pero silenciado: R2 secrets ausentes del repo.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — Etapa-2 lee de resultado en memoria del fetch, no de R2. Re-ingestar requeriría volver a la fuente.
- **Hash-check:** parcial — cache por clave ISO-semana (`packages/agenda/src/ingest-run.ts`), no sha256/ETag por archivo; no hay salida temprana si no hubo cambios.
- **Rate-limit 2-3s:** cumple — `HostRateLimiter` inyectado en `packages/agenda/src/run-agenda-prod-cli.ts`.
- **UA identificatorio:** cumple — `Bot-Ciudadano/1.0` en paso curl (`agenda-weekly.yml`); `Fetcher` UA para Senado.
- **robots.txt:** cumple — `RobotsGuard` inyectado en `packages/agenda/src/run-agenda-prod-cli.ts`.

#### Gaps de este workflow

G1, G2, G3 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Corrida más reciente:
gh run list --repo Cuchecorp/gov-map --workflow agenda-weekly.yml --limit 5

# Fallo más reciente (si aplica):
gh run view <LAST_RUN_ID> --repo Cuchecorp/gov-map --log-failed | head -30

# Probe de código (sin ejecutar ingesta):
grep -n "putImmutable\|TablaR2Target\|hasToday" packages/agenda/src/ingest-run.ts

# Secrets presentes:
gh secret list --repo Cuchecorp/gov-map
```

---

### W-2: leyes-weekly

**YAML:** `.github/workflows/leyes-weekly.yml`
**Schedule:** `0 20 * * 5` (viernes 20:00 UTC)
Veredicto: NO-CORRE
**Causa raíz del veredicto:** Bug crítico en upsert batch — `ON CONFLICT DO UPDATE command cannot affect row a second time` en `tramitacion_evento`; 2 corridas consecutivas fallidas (2026-06-26, 2026-07-03).

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | No | Ausente — comentario "R2/remoto diferidos" | `packages/tramitacion/src/ingest-cli.ts:16` |
| Etapa-2 desde R2 | No | No implementada | — |
| Hash-check pre-descarga | No | Ninguno; solo upsert idempotente sin early-exit | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** no cumple — nunca implementada. Comentario explícito en `packages/tramitacion/src/ingest-cli.ts:16`: "R2/remoto diferidos."
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — no aplica al no tener Etapa-1.
- **Hash-check:** no cumple — sin verificación previa a la descarga; sin early-exit cuando no hay cambios.
- **Rate-limit 2-3s:** cumple — `HostRateLimiter` en `packages/tramitacion/src/run-tramitacion-prod-cli.ts`.
- **UA identificatorio:** cumple — `Fetcher` UA por defecto.
- **robots.txt:** cumple — `RobotsGuard` inyectado.

#### Gaps de este workflow

G4 (CRITICAL), G5, G6 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Corrida más reciente (debe mostrar 2 failures consecutivos):
gh run list --repo Cuchecorp/gov-map --workflow leyes-weekly.yml --limit 5

# Log del fallo (buscar "ON CONFLICT DO UPDATE"):
gh run view <LAST_RUN_ID> --repo Cuchecorp/gov-map --log-failed | grep -A5 "CONFLICT"

# Probe de código — confirmar ausencia de R2:
grep -n "R2Store\|putImmutable\|R2_" packages/tramitacion/src/ingest-cli.ts

# Confirmar bug upsert:
grep -n "onConflict\|ON CONFLICT\|upsert" packages/tramitacion/src/writer-supabase.ts
```

---

### W-3: lobby-camara-weekly

**YAML:** `.github/workflows/lobby-camara-weekly.yml`
**Schedule:** `0 11 * * 2` (martes 11:00 UTC)
Veredicto: NO-CORRE
**Causa raíz del veredicto:** WAF de `camara.cl` bloquea IPs de GitHub Actions incluso vía curl — respuesta es 5463 bytes (página de error WAF), que no supera la comprobación de tamaño mínimo de 10 KB del YAML (línea 54). El paso de descarga sale con código 1 antes de ejecutar el CLI.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Parcial | No-op (R2 secrets ausentes; WAF impide obtener HTML) | `packages/lobby/src/run-camara-lobby.ts:85-103` |
| Etapa-2 desde R2 | No | No implementada (lee `/tmp/lobby.html` en memoria, no R2) | `packages/lobby/src/run-camara-lobby.ts` |
| Hash-check pre-descarga | No | Paso curl no verifica ETag/sha256 | `lobby-camara-weekly.yml:49-54` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** parcial — código presente (`run-camara-lobby.ts:85-103`, `opts.r2Store.putImmutable`), pero doble no-op: WAF impide obtener el HTML y R2 secrets ausentes del repo.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — CLI lee de archivo en memoria (`/tmp/lobby.html`), no de R2.
- **Hash-check:** no cumple — paso curl no comprueba If-None-Match ni sha256 previo a la descarga.
- **Rate-limit 2-3s:** cumple (en CLI; curl es request único por corrida).
- **UA identificatorio:** cumple — `curl -A 'Bot-Ciudadano/1.0'` en `lobby-camara-weekly.yml:49`.
- **robots.txt:** cumple — `RobotsGuard` inyectado en CLI.

#### Gaps de este workflow

G7 (CRITICAL), G8, G9 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Corridas más recientes (ambas failure por WAF):
gh run list --repo Cuchecorp/gov-map --workflow lobby-camara-weekly.yml --limit 5

# Log de fallo (buscar "5463 bytes" o "10240"):
gh run view <LAST_RUN_ID> --repo Cuchecorp/gov-map --log-failed | head -30

# Probe de código — Etapa-1:
grep -n "putImmutable\|r2Store" packages/lobby/src/run-camara-lobby.ts

# Probe de código — gate de tamaño en YAML:
grep -n "wc -c\|10240\|min_size" .github/workflows/lobby-camara-weekly.yml
```

---

### W-4: lobby-leylobby-weekly

**YAML:** `.github/workflows/lobby-leylobby-weekly.yml`
**Schedule:** `0 11 * * 3` (miércoles 11:00 UTC)
Veredicto: CORRE-CON-GAPS
**Causa raíz del veredicto:** Corre verde (2 éxitos recientes: 2026-07-01 y 2026-07-08), pero sin Etapa-1 R2 implementada y sin hash-check; los datos de leylobby.gob.cl no tienen crudo versionado.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | No | Ausente — sin importación de R2Store | `packages/lobby/src/ingest-cli.ts` (sin import R2Store) |
| Etapa-2 desde R2 | No | No aplica (sin Etapa-1) | — |
| Hash-check pre-descarga | No | Sin verificación previa a la descarga | `packages/lobby/src/ingest-run.ts` |

#### Nota sobre env vars

El workflow mapea `SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}` y `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}` — nombres distintos del resto de los workflows. El CLI lee `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` (documentado en `lobby-leylobby-weekly.yml:56-61`). El mapeo es correcto e intencional.

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** no cumple — nunca implementada en `packages/lobby/src/ingest-cli.ts`.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — no aplica sin Etapa-1.
- **Hash-check:** no cumple — sin `cache.hasToday()` en `packages/lobby/src/ingest-run.ts`.
- **Rate-limit 2-3s:** cumple — `HostRateLimiter` + `Fetcher` inyectados.
- **UA identificatorio:** cumple — `Fetcher` UA por defecto.
- **robots.txt:** cumple — `RobotsGuard` inyectado.

#### Gaps de este workflow

G10, G11 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Corridas más recientes (deben mostrar 2 successes):
gh run list --repo Cuchecorp/gov-map --workflow lobby-leylobby-weekly.yml --limit 5

# Probe de código — confirmar ausencia de R2:
grep -n "R2Store\|putImmutable" packages/lobby/src/ingest-cli.ts packages/lobby/src/ingest-run.ts

# Confirmar env var mapping:
grep -n "SUPABASE_URL\|SUPABASE_SERVICE_KEY" .github/workflows/lobby-leylobby-weekly.yml
```

---

### W-5: probidad-weekly

**YAML:** `.github/workflows/probidad-weekly.yml`
**Schedule:** `0 11 * * 4` (jueves 11:00 UTC)
Veredicto: NO-CORRE
**Causa raíz del veredicto:** Aserción `declaraciones>0 OR confirmados>0` al final del CLI disparó en la única corrida registrada (2026-07-02); `probidad_ingesta_estado` muestra última ingesta 2026-06-22, con 0 filas escritas después del 2026-07-01, confirmando que el run no produjo datos nuevos.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Parcial | No-op (R2 secrets ausentes en repo) | `packages/probidad/src/run-probidad-todos.ts:143-147` |
| Etapa-2 desde R2 | No | No implementada (lee desde resultado SPARQL en memoria) | `packages/probidad/src/run-probidad-todos.ts` |
| Hash-check pre-descarga | No | Rate-limiter presente; sin sha256/ETag gate | `packages/probidad/src/run-probidad-todos.ts` |

#### Resolución A1

**Claim:** probidad 2026-07-02 falló por 0 resultados SPARQL o 0 identity matches.
**Resultado (probe P4):** La tabla `probidad_ingesta_estado` tiene 136 filas (136 parlamentarios registrados), todas con `ingestado_hasta = 2026-06-22` y `fecha_captura = 2026-06-22`. Cero filas nuevas después del 2026-07-01. Esto confirma que el run 2026-07-02 NO escribió ninguna fila en `probidad_ingesta_estado`, lo que implica que el CLI falló antes de completar cualquier parlamentario — probablemente en la fase de aserción pre-loop o por un error en la query SPARQL que devolvió 0 resultados. La tabla `declaracion` tiene 1060 filas todas capturadas antes del 2026-07-02. El log del run no está disponible vía `gh run view --log-failed` (sin acceso a logs de secrets mascarados); la causa exacta entre "SPARQL 503" y "0 identity matches" no es distinguible desde DB. **A1 parcialmente resuelto: se confirma que 0 parlamentarios fueron procesados en el run 2026-07-02; causa raíz exacta (SPARQL vs identity) irresolvable sin log completo.**

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** parcial — código presente (`R2Store` + `SnapshotWriter` en `run-probidad-todos.ts:143-147`), pero no-op: R2 secrets ausentes del repo.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — lee de resultado SPARQL en memoria.
- **Hash-check:** no cumple — sin verificación sha256/ETag antes de consultar SPARQL.
- **Rate-limit 2-3s:** cumple — `HostRateLimiter` inyectado.
- **UA identificatorio:** cumple — `Fetcher` UA por defecto.
- **robots.txt:** cumple — `RobotsGuard` inyectado.

#### Gaps de este workflow

G12, G13 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Corrida más reciente (failure 2026-07-02):
gh run list --repo Cuchecorp/gov-map --workflow probidad-weekly.yml --limit 5

# Log de fallo (buscar aserción o error SPARQL):
gh run view <LAST_RUN_ID> --repo Cuchecorp/gov-map --log-failed | head -50

# Estado en DB (read-only):
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM probidad_ingesta_estado WHERE fecha_captura > '2026-07-01';"

# Probe de código — aserción:
grep -n "assert\|declaraciones\|confirmados" packages/probidad/src/run-probidad-todos-cli.ts
```

---

### W-6: fichas-backfill

**YAML:** `.github/workflows/fichas-backfill.yml`
**Schedule:** ninguno
**Trigger:** `workflow_dispatch` (manual only)
Veredicto: NO-APLICA-CRON
**Causa raíz del veredicto:** Diseñado como backfill manual de fichas LLM; nunca disparado en el historial del repo. Si se disparara, fallaría: ausentes `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, y los 4 secrets R2.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Parcial | No-op (R2 secrets ausentes; LLM secrets ausentes) | `packages/fichas/src/texto-fuente.ts:7` (`TextoR2Target.putImmutable`) |
| Etapa-2 desde R2 | No | No implementada | — |
| Hash-check pre-descarga | Parcial | Allowlist check solamente | `packages/fichas/src/pipeline-cli.ts` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** parcial — código presente (`TextoR2Target.putImmutable` en `packages/fichas/src/texto-fuente.ts:7`), pero no-op: R2 secrets ausentes.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** no cumple — sin ruta de lectura R2.
- **Hash-check:** parcial — allowlist check presente; no sha256/ETag completo.
- **Rate-limit 2-3s:** cumple — `HostRateLimiter` + `RobotsGuard` en `packages/fichas/src/pipeline-cli.ts`.
- **UA identificatorio:** cumple.
- **robots.txt:** cumple.

#### Gaps de este workflow

G14, G15, G16, G17 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Confirmar que nunca ha corrido:
gh run list --repo Cuchecorp/gov-map --workflow fichas-backfill.yml --limit 5

# Probe de código — R2:
grep -n "TextoR2Target\|putImmutable" packages/fichas/src/texto-fuente.ts

# Probe de código — secrets necesarios:
grep -n "DEEPSEEK_API_KEY\|GEMINI_API_KEY\|SUPABASE_URL" .github/workflows/fichas-backfill.yml
```

---

### W-7: backup-parlamentario

**YAML:** `.github/workflows/backup-parlamentario.yml`
**Schedule:** `0 6 * * 1` (lunes 06:00 UTC)
Veredicto: CORRE-CON-GAPS
**Causa raíz del veredicto:** Las corridas programadas corren exitosamente (2026-06-29, 2026-07-06); el paso R2 existe pero se omite legítimamente porque R2 secrets están ausentes (gated por `if: env.R2_ACCESS_KEY_ID != ''`). La corrida 2026-07-08 falló con `startup_failure` por push (no por schedule).

#### Cadena de ingesta

Este workflow NO es un workflow de ingesta de datos: realiza un seed de identidades (backup del catálogo Cámara + Senado XML a `supabase/seeds/parlamentario.seed.json`) y hace commit con `contents: write`. No aplica DOS ETAPAS en el sentido estricto de ingesta de datos públicos.

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Seed XML→JSON git commit | Sí | Activa (funciona en corridas programadas) | `packages/identity/src/seed-cli.ts` |
| R2 backup secundario | Parcial | Omitido (`if: env.R2_ACCESS_KEY_ID != ''` es falso) | `backup-parlamentario.yml:85` |

#### Resolución A2

**Claim:** `startup_failure` 2026-07-08 = YAML syntax error desde push event.
**Resultado (probe P3):** `gh run view 28980585955 --repo Cuchecorp/gov-map` retorna "This run likely failed because of a workflow file issue." y log no disponible (`log not found`). El run fue disparado por push (no por schedule). Las corridas scheduled inmediatamente anteriores (2026-07-06, 2026-06-29) son exitosas, confirmando que no es un problema recurrente. **A2 resuelto: startup_failure es episódico, originado por un push que introdujo un issue de YAML — no afecta la salud del schedule. Log detallado irrecuperable desde CLI.**

#### DOS ETAPAS compliance (aplicado a seed de identidad)

- **Rate-limit 2-3s:** cumple — `HostRateLimiter` + `RobotsGuard` en `packages/identity/src/seed-cli.ts`.
- **UA identificatorio:** cumple.
- **robots.txt:** cumple.

#### Gaps de este workflow

G18, G19 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Corridas recientes (debe mostrar éxito schedule 2026-07-06 y failure push 2026-07-08):
gh run list --repo Cuchecorp/gov-map --workflow backup-parlamentario.yml --limit 5

# Detalle del startup_failure push:
gh run view 28980585955 --repo Cuchecorp/gov-map

# Probe de código — R2 step if-gate:
grep -n "R2_ACCESS_KEY_ID\|if:" .github/workflows/backup-parlamentario.yml | head -10
```

---

### W-8: backfill

**YAML:** `.github/workflows/backfill.yml`
**Schedule:** ninguno
**Trigger:** `workflow_dispatch` (manual only)
Veredicto: NO-APLICA-CRON
**Causa raíz del veredicto:** Workflow de prueba/placeholder (Milestone 1); usa `DummyConnector` contra `dummy.local`, no fuentes reales. Nunca disparado en historial del repo. No es un workflow de producción.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | En BaseConnector (DummyConnector) | No-op (R2 secrets ausentes; fuente ficticia) | `packages/@obs/ingest/src/base-connector.ts` |
| Etapa-2 desde R2 | No | BaseConnector no tiene ruta de lectura R2 | — |
| Hash-check pre-descarga | Sí (en BaseConnector) | `cache.hasToday()` presente | `packages/@obs/ingest/src/base-connector.ts:124` |

#### DOS ETAPAS compliance

No aplica — `DummyConnector` no toca fuentes reales.

#### Gaps de este workflow

G20 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Confirmar que nunca ha corrido:
gh run list --repo Cuchecorp/gov-map --workflow backfill.yml --limit 5

# Confirmar DummyConnector:
grep -n "DummyConnector\|dummy.local" .github/workflows/backfill.yml supabase/functions/ingest-worker/backfill.ts
```

---

### W-9: deploy-cloudflare

**YAML:** `.github/workflows/deploy-cloudflare.yml`
**Schedule:** ninguno
**Trigger:** `workflow_dispatch` (manual only)
Veredicto: NO-APLICA-CRON
**Causa raíz del veredicto:** Workflow de deploy del frontend Next.js a Cloudflare Workers. No es un workflow de ingesta. Si se disparara, fallaría: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` ausentes del repo.

#### Cadena de ingesta

No aplica — deploy de frontend, no ingesta de datos.

#### DOS ETAPAS compliance

No aplica.

#### Gaps de este workflow

G21, G22 (ver sección Gap-list)

#### Cómo re-verificar

```bash
# Confirmar que nunca ha corrido:
gh run list --repo Cuchecorp/gov-map --workflow deploy-cloudflare.yml --limit 5

# Probe de código — secrets necesarios:
grep -n "CLOUDFLARE_API_TOKEN\|CLOUDFLARE_ACCOUNT_ID" .github/workflows/deploy-cloudflare.yml
```

---

## Gap-list consolidada

| # | Gap | Severidad | Workflow | Archivo:Línea | Fix propuesto (Phase 57) |
|---|-----|-----------|----------|---------------|--------------------------|
| G4 | `tramitacion_evento` upsert `ON CONFLICT DO UPDATE command cannot affect row a second time` — batch contiene claves duplicadas | CRITICAL | leyes-weekly | `packages/tramitacion/src/writer-supabase.ts` (lógica batch); `packages/tramitacion/src/writer.ts:8` (definición clave única) | Deduplicar eventos por clave compuesta antes del batch upsert, o usar INSERT ... ON CONFLICT DO NOTHING + merge posterior |
| G7 | WAF `camara.cl` bloquea IPs de GitHub Actions vía curl — respuesta 5463 bytes < gate 10 KB | CRITICAL | lobby-camara-weekly | `.github/workflows/lobby-camara-weekly.yml:49-54` | Investigar endpoint alternativo (API `doGet.asmx`), proxy residencial, o Cloudflare IP allowlist con camara.cl |
| G1 | `DEEPSEEK_API_KEY` ausente del repo → extracción de tabla sala degrada a enlace PDF | HIGH | agenda-weekly | `.github/workflows/agenda-weekly.yml:58` | Cargar secret `DEEPSEEK_API_KEY` en Cuchecorp/gov-map repo secrets |
| G2 | R2 secrets ausentes → Etapa-1 es no-op en agenda (sin crudo versionado ni `source_snapshot`) | HIGH | agenda-weekly | `.github/workflows/agenda-weekly.yml:60-61` | Cargar 4 secrets R2 (`R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) |
| G5 | Etapa-1 completamente ausente en tramitacion — nunca implementada | HIGH | leyes-weekly | `packages/tramitacion/src/ingest-cli.ts:16` | Implementar escritura R2 (comentario "R2/remoto diferidos" indica deuda conocida) |
| G8 | R2 secrets ausentes → Etapa-1 sería no-op en lobby-camara aun si WAF resuelto | HIGH | lobby-camara-weekly | `.github/workflows/lobby-camara-weekly.yml:61-64` | Cargar 4 secrets R2 (mismos que G2) |
| G10 | Etapa-1 completamente ausente en leylobby — sin importación de R2Store | HIGH | lobby-leylobby-weekly | `packages/lobby/src/ingest-cli.ts:1` (sin import R2Store en ninguna línea) | Implementar escritura R2 en `packages/lobby/src/ingest-cli.ts` |
| G12 | Aserción `declaraciones>0 OR confirmados>0` disparó en 2026-07-02 — causa raíz ambigua (SPARQL 503 vs 0 identity matches) | HIGH | probidad-weekly | `.github/workflows/probidad-weekly.yml:69-70` (grep assert); `packages/probidad/src/run-probidad-todos-cli.ts:149-153` (output) | Agregar logging explícito de conteo de resultados SPARQL antes del identity matching; distinguir "0 resultados SPARQL" de "0 identity matches" |
| G13 | R2 secrets ausentes → Etapa-1 es no-op en probidad (código presente pero silenciado) | HIGH | probidad-weekly | `.github/workflows/probidad-weekly.yml:58-63` | Cargar 4 secrets R2 (mismos que G2; código ya implementado) |
| G14 | `DEEPSEEK_API_KEY` ausente → extracción LLM de fichas fallaría al ejecutar | HIGH | fichas-backfill | `.github/workflows/fichas-backfill.yml:66` | Cargar secret `DEEPSEEK_API_KEY` antes del próximo run manual |
| G15 | `GEMINI_API_KEY` ausente → generación de embeddings fallaría al ejecutar | HIGH | fichas-backfill | `.github/workflows/fichas-backfill.yml:67` | Cargar secret `GEMINI_API_KEY` antes del próximo run manual |
| G16 | `SUPABASE_URL` ausente (secret distinto de `SUPABASE_API_URL` en fichas-backfill) | HIGH | fichas-backfill | `.github/workflows/fichas-backfill.yml:63` | Cargar secret `SUPABASE_URL` o verificar si CLI usa `SUPABASE_API_URL` como fallback y deprecar el ref en YAML |
| G17 | R2 secrets ausentes → Etapa-1 no-op en fichas | HIGH | fichas-backfill | `.github/workflows/fichas-backfill.yml:69-72` | Cargar 4 secrets R2 (mismos que G2) |
| G21 | `CLOUDFLARE_API_TOKEN` ausente → deploy-cloudflare fallaría si se dispara | HIGH | deploy-cloudflare | `.github/workflows/deploy-cloudflare.yml:59` | Cargar secret antes de próximo deploy; no urgente (deploy es manual y poco frecuente) |
| G22 | `CLOUDFLARE_ACCOUNT_ID` ausente → deploy-cloudflare fallaría si se dispara | HIGH | deploy-cloudflare | `.github/workflows/deploy-cloudflare.yml:60` | Cargar secret junto con G21 |
| G23 | Sistémico: ningún conector implementa ruta R2→Supabase de re-ingesta (Etapa-2). Re-ingestar requiere volver a la fuente gubernamental — viola regla LOCKED | HIGH | TODOS los conectores activos | `packages/agenda/src/ingest-run.ts:218`; `packages/lobby/src/run-camara-lobby.ts:85`; `packages/probidad/src/run-probidad-todos.ts:143`; `packages/fichas/src/pipeline-cli.ts:174` (ninguno tiene GetObject/readFromR2) | Phase 57: diseñar e implementar ruta de lectura R2→parse→Supabase en cada conector como segunda etapa separable |
| G3 | Etapa-2-from-R2 re-ingest path ausente en agenda — sin ruta de lectura R2 al re-ingestar | MEDIUM | agenda-weekly | `packages/agenda/src/ingest-run.ts:218` (solo write, nunca read-back) | Implementar en Phase 57 (parte de G23) |
| G6 | Sin hash-check antes de descargar ni early-exit en tramitacion | MEDIUM | leyes-weekly | `packages/tramitacion/src/run-tramitacion-prod-cli.ts:1` (sin `cache.hasToday()` en ninguna línea) | Agregar verificación sha256/ETag antes de descarga de Cámara WS y Senado XML |
| G9 | Etapa-2-from-R2 re-ingest path ausente en lobby-camara — sin ruta de lectura R2 | MEDIUM | lobby-camara-weekly | `packages/lobby/src/run-camara-lobby.ts:85` (solo write, nunca read-back) | Implementar en Phase 57 (parte de G23) |
| G11 | Sin hash-check antes de descargar en leylobby | MEDIUM | lobby-leylobby-weekly | `packages/lobby/src/ingest-run.ts:1` (sin `cache.hasToday()` en ninguna línea) | Agregar verificación sha256/ETag o check de fecha_bucket existente antes de descargar |
| G18 | backup-parlamentario R2 step omitido (cadencia ID-09 — segundo destino) porque R2 secrets ausentes | MEDIUM | backup-parlamentario | `.github/workflows/backup-parlamentario.yml:85` | Cargar 4 secrets R2 para activar paso de backup a R2 |
| G19 | backup-parlamentario push-triggered `startup_failure` 2026-07-08 — YAML con issue sin diagnosticar | MEDIUM | backup-parlamentario | `.github/workflows/backup-parlamentario.yml:1` (YAML validity post-commit — run ID 28980585955) | Verificar YAML con `actionlint` o `gh workflow validate`; commit responsable: push 2026-07-08T22:37 UTC |
| G20 | `backfill` workflow usa `DummyConnector` — no puede backfill real de datos de producción | LOW | backfill | `.github/workflows/backfill.yml:7-9` | Repurpose para un conector real (tramitacion o agenda) o retirar el workflow |

---

## DOS ETAPAS — Mapa de cumplimiento sistémico

| Connector | Etapa-1 fuente→R2 | Etapa-2 R2→Supabase | Hash-check | Rate-limit 2-3s | UA identificatorio | robots.txt |
|-----------|:-----------------:|:-------------------:|:----------:|:---------------:|:-----------------:|:----------:|
| agenda (`run-agenda-prod-cli`) | Parcial (código presente, no-op por secrets) | NO | Parcial (ISO-semana, no sha256) | SI | SI | SI |
| tramitacion (`run-tramitacion-prod-cli`) | NO (no implementada) | NO | NO | SI | SI | SI |
| lobby-camara (`run-camara-lobby-cli`) | Parcial (código presente, doble no-op) | NO | NO | SI | SI | SI |
| lobby-leylobby (`ingest-cli`) | NO (no implementada) | NO | NO | SI | SI | SI |
| probidad (`run-probidad-todos-cli`) | Parcial (código presente, no-op por secrets) | NO | NO | SI | SI | SI |
| fichas (`pipeline-cli`) | Parcial (código presente, no-op por secrets) | NO | Parcial (allowlist) | SI | SI | SI |
| backup-parlamentario (`seed-cli`) | Parcial (código presente, if-gated) | N/A (seed, no ingest) | N/A | SI | SI | SI |
| backfill (`DummyConnector`) | En BaseConnector (fuente ficticia) | NO | SI (`cache.hasToday()`) | SI | SI | SI |

**Hallazgo sistémico:** Ningún conector implementa la ruta R2→Supabase de re-ingesta (Etapa-2). Re-ingestar a Supabase (por error de schema, cambio de modelo, re-embedding) requeriría re-tocar el servidor de la fuente gubernamental, violando la convención LOCKED del proyecto. Esta es una brecha arquitectónica sistémica documentada como G23. El único conector con hash-check completo es `BaseConnector` (usado solo por `DummyConnector`, no por ningún conector de producción activo).

---

## Observabilidad — Estado de tablas

| Tabla | Definida en | Escrita por | Estado actual | Última entrada (probe 2026-07-08) |
|-------|------------|-------------|---------------|----------------------------------|
| `ingest_run` | `supabase/migrations/0002_control_tables.sql:11` | No escrita por CLIs activos (schema existe, CLIs no pasan run_id) | 0 filas | — |
| `source_snapshot` | `supabase/migrations/0002_control_tables.sql:22` | `SnapshotWriter` vía `@obs/ingest` (probidad, BaseConnector); gateado por R2 secrets | 0 filas | — |
| `drift_alert` | `supabase/migrations/0002_control_tables.sql:40` | `BaseConnector drift.alert()`; sin uso en CLIs Node activos | no verificado (tablas) | — |
| `lobby_ingesta_estado` | `supabase/migrations/0021_lobby.sql:133` | `SupabaseLobbyWriter` | 136 filas activas | `ingestado_hasta = 2026-06-22` (max) |
| `probidad_ingesta_estado` | `supabase/migrations/0022_probidad.sql:361` | `SupabaseProbidadWriter` | 136 filas activas | `ingestado_hasta = 2026-06-22` (max) |

**Nota:** `source_snapshot` tiene 0 filas a pesar de existir el schema. Los SnapshotWriter solo escriben cuando R2 está disponible (secrets presentes), lo cual nunca ha ocurrido en el repo de CI.

---

## Frescura baseline (2026-07-08)

| Fuente / Tabla | Última fecha observada | Probe |
|----------------|----------------------|-------|
| citacion | 2026-07-06 14:29:11 UTC | `SELECT max(fecha_captura) FROM citacion` |
| lobby_audiencia | 2026-07-08 12:27:42 UTC | `SELECT max(fecha_captura) FROM lobby_audiencia` |
| declaracion | 2026-06-22 23:22:01 UTC | `SELECT max(fecha_captura) FROM declaracion` |
| proyecto | 2026-07-03 21:11:26 UTC | `SELECT max(fecha_captura) FROM proyecto` |
| source_snapshot | NULL (0 filas) | `SELECT max(date_bucket) FROM source_snapshot` |
| lobby_ingesta_estado | 2026-06-22 (ingestado_hasta) | `SELECT max(ingestado_hasta) FROM lobby_ingesta_estado` |
| probidad_ingesta_estado | 2026-06-22 (ingestado_hasta) | `SELECT max(ingestado_hasta) FROM probidad_ingesta_estado` |
| R2 (último objeto por prefijo) | camara-lobby: 2026-06-22 / camara/tabla-sala: 2026-06-23 / fichas: 2026-06-20 | `R2 ListObjectsV2 --bucket observatorio` (SigV4 directo) |

**Observaciones de frescura:**
- `lobby_audiencia` es la tabla más fresca: actualizada hoy (2026-07-08) por `lobby-leylobby-weekly`.
- `citacion` actualizada 2026-07-06 por `agenda-weekly`.
- `proyecto` actualizada 2026-07-03 (última corrida de `leyes-weekly` falló, pero los datos del run previo llegaron).
- `declaracion` (probidad) estancada en 2026-06-22 — 16 días sin actualización.
- R2 tiene solo objetos de corridas manuales locales (backfill de fichas 2026-06-20, camara-lobby 2026-06-22, tabla-sala 2026-06-23). Ningún objeto de corridas CI (confirmando no-op R2 en CI).
- `source_snapshot`: 0 filas — observabilidad de ingesta completamente ciega.

---

## Estado de billing GitHub Actions

Evidencia: 11 corridas programadas (`event: schedule`) ejecutadas exitosamente en los últimos ~14 días (2026-06-25 a 2026-07-08):
- agenda-weekly: 2 éxitos (2026-06-29, 2026-07-06)
- backup-parlamentario: 2 éxitos (2026-06-29, 2026-07-06)
- lobby-leylobby-weekly: 2 éxitos (2026-07-01, 2026-07-08)
- leyes-weekly: 2 failures (2026-06-26, 2026-07-03) — bug G4, no billing
- lobby-camara-weekly: 2 failures (2026-06-30, 2026-07-07) — WAF G7, no billing
- probidad-weekly: 1 failure (2026-07-02) — assert G12, no billing

Conclusión: Billing NO bloqueado al 2026-07-08. El gotcha de 2026-06-23 (billing bloqueado) está resuelto. Las corridas programadas se ejecutan normalmente.

Evidencia reproducible: `gh api repos/Cuchecorp/gov-map/actions/runs --jq '.workflow_runs[] | select(.event=="schedule") | {conclusion, created_at, name}'`

---

## Assumptions resueltas

| ID | Claim original | Resultado | Evidencia |
|----|---------------|-----------|-----------|
| A1 | probidad 2026-07-02: 0 resultados SPARQL vs 0 identity matches | Parcialmente resuelto: 0 parlamentarios procesados confirmado (0 filas en `probidad_ingesta_estado` con `fecha_captura > 2026-07-01`); causa exacta (SPARQL vs identity) irresolvable sin log CLI completo | `SELECT COUNT(*) FROM probidad_ingesta_estado WHERE fecha_captura > '2026-07-01'` → 0 |
| A2 | backup-parlamentario 2026-07-08: `startup_failure` = YAML push-trigger episódico | Resuelto: confirmado push-triggered (no schedule); runs schedule previas (2026-07-06, 2026-06-29) exitosas; log no disponible (`log not found`) | `gh run view 28980585955 --repo Cuchecorp/gov-map` → "workflow file issue" vía push |
| A3 | `SUPABASE_URL` en fichas-backfill es un secret distinto de `SUPABASE_API_URL` | Resuelto: `gh secret list` confirma que solo `SUPABASE_API_URL` y `SUPABASE_SECRET_KEY` están presentes; `SUPABASE_URL` está ausente — G16 es un gap real | `gh secret list --repo Cuchecorp/gov-map` → 2 secrets presentes, `SUPABASE_URL` ausente |

---

## Cómo reproducir esta auditoría

```bash
# 1. Run history (todos los workflows):
gh run list --repo Cuchecorp/gov-map --limit 40

# 2. Secrets inventory (nombres only, sin valores):
gh secret list --repo Cuchecorp/gov-map

# 3. Código — R2 write presence:
grep -rn "putImmutable\|R2Store" packages/ --include="*.ts"

# 4. Código — R2 read-back absence (Etapa-2 sistémica):
grep -rn "GetObject\|getObject\|readFromR2\|from_r2" packages/ --include="*.ts"

# 5. Supabase frescura (PGCLIENTENCODING=UTF8 requerido en Windows):
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "SELECT max(fecha_captura) FROM citacion;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "SELECT max(fecha_captura) FROM lobby_audiencia;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM probidad_ingesta_estado WHERE fecha_captura > '2026-07-01';"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM source_snapshot;"

# 6. R2 freshness (requiere AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY del .env local):
# aws s3 ls s3://$R2_BUCKET/ --endpoint-url $R2_ENDPOINT_URL --recursive --human-readable 2>&1 | tail -20
# (o SigV4 directo via Node si aws CLI no disponible)

# 7. Grep de validación del documento:
grep -cE "Veredicto: (VERDE|CORRE-CON-GAPS|NO-CORRE|NO-APLICA-CRON)" .planning/phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md
# → debe ser 9

grep -cE "G[0-9]+.*\.(ts|yml|sql):[0-9]+" .planning/phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md
# → debe ser ≥ 20

# Verificación de no-secrets: grep por prefijos de clave AWS/OpenAI/token en el documento
# Patrón: sk[-]XXXX | AK[IA] | Bear[er]  — debe retornar 0 matches
grep -icE "sk.{1}[a-z0-9-]{10,}" .planning/phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md
# → debe ser 0 (ningún valor de secret real en el documento)

grep -c "Cómo re-verificar" .planning/phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md
# → debe ser ≥ 9
```

---

*Documento generado por Phase 56 CRON-AUDIT — 2026-07-08. Probes: gh CLI (run list + secret list + run view), psql SELECTs read-only (PGCLIENTENCODING=UTF8), R2 ListObjectsV2 (SigV4 directo via Node). Ningún valor de secret fue impreso en este documento.*
