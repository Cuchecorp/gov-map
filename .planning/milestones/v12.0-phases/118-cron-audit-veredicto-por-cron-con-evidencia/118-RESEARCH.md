# Phase 118: CRON-AUDIT — Veredicto por cron con evidencia - Research

**Researched:** 2026-07-28
**Domain:** Auditoría empírica de ingesta programada (GitHub Actions + pg_cron + freshness + R2)
**Confidence:** HIGH (todo el mapa proviene de lectura directa del repo y de probes `gh` read-only en vivo)

## Summary

Esta fase no necesita investigación de librerías: necesita un MAPA. El mapa está completo y verificado en esta sesión leyendo los 13 YAML, siguiendo cada comando `pnpm --filter … exec tsx …` hasta su archivo `.ts` real, extrayendo las tablas Supabase que cada entrypoint escribe (`.from("…")`), y enumerando los 4 jobs `pg_cron` declarados en migraciones. Existe además un precedente directo de formato: `56-CRON-AUDIT.md` (581 líneas, v6.0) — el documento 118 debe ser su sucesor, con la misma anatomía (tabla maestra → sección por workflow → gap-list numerada → "cómo re-verificar" por ítem) pero con la taxonomía nueva verde/stale/roto del CONTEXT.

**Tres hallazgos ya obtenidos en research que el plan debe incorporar como hipótesis a confirmar en ejecución, NO como veredicto:**
1. El CONTEXT dice "8 con schedule". El conteo real es **6**: `digest-daily.yml` y `roster-weekly.yml` tienen el bloque `schedule:` **comentado** (estreno gated por diseño, dispatch-only). El plan debe corregir esa cifra o el inventario cerrará mal.
2. `packages/freshness/src/catalog.ts` referencia dos workflows que **no existen** en `.github/workflows/`: `chilecompra-weekly.yml` y `servel-weekly.yml`. Es exactamente la "discrepancia entre freshness y realidad" que el CONTEXT declara hallazgo-en-sí-mismo (y coincide con MONEY/SERVEL gated: estado esperado, no gap — pero la señal freshness apunta a un YAML fantasma, y eso sí es gap de instrumentación).
3. `lobby-camara-weekly.yml` **no** es gap: el YAML declara explícitamente (líneas 14-17) que el schedule fue DESHABILITADO porque el WAF de camara.cl bloquea IPs de GH Actions desde 2026-06-30 (gap G7 del audit 56), con fallback local documentado. Es decisión deliberada — se registra como "no-cron por diseño, causa declarada en archivo".

**Primary recommendation:** El plan debe estructurarse como probe-matrix ejecutable: una fila por unidad-de-cron (13 workflows + 4 pg_cron + 2 platform-managed = 19), y por fila tres comandos concretos ya escritos en este research (gh / psql / freshness). El ejecutor NO improvisa queries: las toma de la tabla "Mapa YAML → entrypoint → tablas destino" de abajo.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Evidencia de corrida (pata 1) | GitHub Actions API vía `gh` CLI | — | Solo GH conoce conclusion/timestamp de runs; el YAML no |
| Evidencia de escritura (pata 2) | Postgres/Supabase vía psql read-only | — | Única verdad de "escribió filas" |
| Evidencia de frescura (pata 3) | CLI local `pnpm freshness` | Postgres | Agrega tablas + umbrales ya calibrados |
| Evidencia de crudo (pata 4, spot) | R2 + tabla `source_snapshot` | — | `source_snapshot` en DB es proxy barato del PUT a R2 (57-05) |
| Enumeración pg_cron | DB viva (`cron.job`) | migraciones (expectativa) | CONTEXT LOCKED: contra DB viva, no contra migraciones |
| Veredicto y causa | Documento `118-CRON-VERDICTS.md` | — | El deliverable ES el documento |

## Standard Stack

No se instala nada. Todas las herramientas ya están presentes y verificadas.

### Core
| Herramienta | Estado verificado | Propósito |
|---|---|---|
| `gh` CLI | autenticado como `xenaquis`, scopes `repo, workflow, read:org, gist` [VERIFIED: `gh auth status`] | Pata 1: runs + `gh secret list` |
| `psql` + `SUPABASE_DB_URL` | variable presente en `.env` (1 ocurrencia, valor jamás leído) [VERIFIED: `grep -c "^SUPABASE_DB_URL=" .env` → 1] | Pata 2 + enumeración `cron.job` |
| `pnpm freshness` | script raíz `tsx packages/freshness/src/cli.ts` [VERIFIED: package.json:12] | Pata 3 |

### Package Legitimacy Audit

**No aplica** — esta fase no instala ningún paquete. Es auditoría read-only con herramientas ya presentes en el entorno. Sección omitida por vacuidad, no por omisión.

## Mapa maestro: YAML → entrypoint → tablas destino

Esta es la entrega central del research. Cada fila fue verificada leyendo el YAML y luego el archivo `.ts` invocado.

| # | Workflow | Schedule real | Entrypoint invocado por el YAML (la verdad, gotcha 57-05) | Tablas escritas | Secrets referenciados (NOMBRES) |
|---|---|---|---|---|---|
| 1 | `actualidad-refresh.yml` | `0 11,14,17,20 * * 1-5` | `packages/actualidad/src/run-actualidad-prod-cli.ts` | `actualidad_senal` (escribe), `proyecto_embedding` (lee) | SUPABASE_API_URL, SUPABASE_SECRET_KEY |
| 2 | `agenda-weekly.yml` | `0 11 * * 1` (lun) | `packages/agenda/src/run-agenda-prod-cli.ts` **(NO `ingest-cli.ts` — dual)** | `citacion`, `citacion_invitado`, `citacion_punto`, `sesion_sala`, `sesion_tabla_item` | SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET |
| 3 | `backup-parlamentario.yml` | `0 6 * * 1` (lun) | `pnpm --filter @obs/identity run seed:live` → `packages/identity/src/seed-cli.ts` (dos pasos: `--preserve-estado`, luego `--r2`) | maestra de identidad (sin `.from()` literal; escribe vía capa identity) + backup a R2 | R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET |
| 4 | `leyes-weekly.yml` | `0 20 * * 1-5` (L–V) | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` **(NO `ingest-cli.ts` — dual; el gap original de 57-05)** | `proyecto`, `proyecto_autor`, `tramitacion_evento`, `votacion`, `voto`, `leyes_rotacion_estado` | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4) |
| 5 | `lobby-leylobby-weekly.yml` | `0 11 * * 3` (mié) | `packages/lobby/src/ingest-cli.ts` | `lobby_audiencia`, `lobby_contraparte`, `leylobby_cursor_estado`, `lobby_ingesta_estado` | SUPABASE_API_URL→`SUPABASE_URL`, SUPABASE_SECRET_KEY→`SUPABASE_SERVICE_KEY` (**remapeo de nombres — verificar que el CLI lea los nombres remapeados**) |
| 6 | `probidad-weekly.yml` | `0 11 * * 4` (jue) | `packages/probidad/src/run-probidad-todos-cli.ts` **(dual con `ingest-cli.ts` y `run-probidad-bienes-cli.ts`)** | `declaracion`, `declaracion_familiar`, `probidad_ingesta_estado` | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4) |
| 7 | `digest-daily.yml` | **schedule COMENTADO** (`# - cron: "0 12 * * 1-5"`) — dispatch-only, estreno gated | `run-confirmaciones-prod-cli.ts` **y luego** `run-digest-prod-cli.ts` (dos pasos) | `notificacion_envio`, `suscripcion` (lee `proyecto_autor`, `tramitacion_evento`) | SUPABASE_API_URL, SUPABASE_SECRET_KEY, RESEND_API_KEY, NOTIF_TOKEN_SECRET, NOTIF_BASE_URL, NOTIF_FROM |
| 8 | `roster-weekly.yml` | **schedule COMENTADO** (`# - cron: "0 10 * * 1"`) — dispatch-only, estreno gated | `@obs/identity run seed:live -- --preserve-estado` | maestra identidad | SUPABASE_SECRET_KEY→`SUPABASE_LOCAL_SERVICE_KEY`, SUPABASE_API_URL→`SUPABASE_LOCAL_URL` + SUPABASE_API_URL (**remapeo**) |
| 9 | `lobby-camara-weekly.yml` | **sin schedule — DESHABILITADO a propósito** (WAF camara.cl bloquea GH Actions, G7 del audit 56; fallback `docs/runbooks/cron-local-fallback.md`) | `packages/lobby/src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html` (curl previo por WAF) | `lobby_audiencia`, `lobby_contraparte` | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4) |
| 10 | `fichas-backfill.yml` | sin schedule (backfill manual) | `packages/fichas/src/pipeline-cli.ts` | `proyecto_ficha`, `proyecto_embedding` | SUPABASE_URL, SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, R2_* (4) |
| 11 | `backfill.yml` | sin schedule (snapshot inicial manual) | (dispatch, ingesta masiva) | varias | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4) |
| 12 | `ci.yml` | `push` + `pull_request` — no es cron | `pnpm --filter ./app test`, `tsc --noEmit`, vitest de `@obs/llm` y `@obs/cruces` | ninguna | ninguno |
| 13 | `deploy-cloudflare.yml` | sin schedule (deploy manual deliberado) | `pnpm run deploy` | ninguna | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (**deuda 110-02 conocida**) |

**Platform-managed extra (descubierto en probe, NO están en `.github/workflows/`):** `gh workflow list --repo Cuchecorp/gov-map` devuelve además **`Dependabot Updates`** (id 314034212) y **`CodeQL`** (id 301076402). Para cumplir "ningún workflow sin veredicto" el inventario debe enumerarlos y clasificarlos como *platform-managed, no-ingesta* — si no, el audit contra la realidad remota queda incompleto y el criterio de éxito #1 es defendible sólo contra el filesystem local.

## Jobs pg_cron esperados (declarados en migraciones)

La enumeración vinculante es contra la DB viva (CONTEXT LOCKED). Esto es la EXPECTATIVA contra la que contrastar:

| Job name | Schedule | Comando | Migración |
|---|---|---|---|
| `process-ingest-jobs` | `30 seconds` (o `* * * * *` si pg_cron < 1.5) | `select util.process_ingest_jobs();` | `0003_orchestration.sql:214/221` |
| `cleanup-net-http` | `*/15 * * * *` | `select util.cleanup_net_http();` | `0003_orchestration.sql:229` |
| `net-materializar-aristas` | `17 3 * * *` | `select grafo.materializar_aristas();` | `0030_net.sql:162` |
| `cruces-materializar` | `23 3 * * *` | `select cruces.materializar_cruces();` | `0039_cruce_senal.sql:138` |
| `actualidad-materializar` | `7 11,14,17,20 * * 1-5` | `select actualidad.materializar_senales();` | `0065_actualidad_senal.sql:326` |

Son **5**, no 4. Ojo: `0003` registra dos jobs distintos y su primer job tiene dos variantes según versión de pg_cron — el veredicto debe leer el schedule REAL de `cron.job`, porque cuál de las dos ramas se ejecutó depende de la versión desplegada. `0023_dinero.sql:46` y `0025_agregacion.sql:46` documentan explícitamente que **NO** registran cron (MONEY sin scheduler = estado esperado, no gap).

## Señal freshness: qué cubre y qué no

`packages/freshness/src/cli.ts` es read-only (SELECTs + lecturas gh), requiere `SUPABASE_DB_URL`, y sale con **exit 1 si alguna fuente está stale**, exit 2 si falta config. Emite cuatro tablas: frescura por fuente, cobertura corpus (BUSQ-03), cobertura voto (VOTO-05), cobertura RUT (RUT-01). `--json` manda JSON a stdout y las tablas a stderr → **usar `--json` en el audit** para capturar evidencia parseables sin ANSI.

Catálogo de fuentes (de `catalog.ts`), con su tabla/columna/umbral — estos son exactamente los pares que la pata 2 debe consultar por psql:

| fuente | tabla | columna | umbral | workflowYml declarado |
|---|---|---|---|---|
| leyes | `proyecto` | `fecha_captura` | 7d | leyes-weekly.yml |
| leyes-min-edad | `proyecto` | `fecha_captura` (agregado **MIN**) | 45d | leyes-weekly.yml |
| agenda | `citacion` | `fecha_captura` | 7d | agenda-weekly.yml |
| lobby-camara | `lobby_audiencia` | `fecha_captura` | 14d | lobby-camara-weekly.yml |
| lobby-leylobby | `lobby_ingesta_estado` | `ingestado_hasta` | 7d | lobby-leylobby-weekly.yml |
| probidad | `declaracion` | `fecha_captura` | 30d | probidad-weekly.yml |
| fichas | `proyecto` | `fecha_captura` | 30d | fichas-backfill.yml |
| chilecompra | `contratos_ingesta_estado` | `ingestado_hasta` | 30d | **`chilecompra-weekly.yml` — NO EXISTE** |
| servel | `aportes_ingesta_estado` | `ingestado_hasta` | 365d | **`servel-weekly.yml` — NO EXISTE** |

**Huecos de cobertura de freshness que el audit debe declarar:** no monitorea `actualidad-refresh` (`actualidad_senal`), ni `digest-daily` (`notificacion_envio`), ni `backup-parlamentario` (identidad/R2), ni ningún job pg_cron. Cuatro unidades de cron sin señal automatizada → la pata 3 no aplica ahí y el veredicto debe apoyarse en patas 1+2, declarándolo.

**Gotcha v8.1 (variante viva):** `cli.ts:296` usa `process.cwd()` como raíz para leer `.env`. Bajo `pnpm --filter <pkg> exec` el cwd es el directorio del paquete, no la raíz → `.env` no se encuentra. `pnpm freshness` desde la raíz funciona (script raíz). **El audit debe invocarlo SIEMPRE desde la raíz del repo**, y verificar variantes del mismo patrón en los otros CLIs que se ejecutan con `--filter` (agenda, tramitación, probidad, lobby, fichas, actualidad, notificaciones) — en CI los valores llegan por `process.env`, que sí tiene precedencia, así que el bug sólo muerde localmente.

## Comandos de probe (exactos, para el ejecutor)

Repo remoto verificado: **`Cuchecorp/gov-map`** (`git remote -v` → origin fetch/push). `--repo Cuchecorp/gov-map` es obligatorio en todo comando `gh`.

**Pata 1 — corridas:**
```bash
gh run list --repo Cuchecorp/gov-map --workflow <NAME>.yml --limit 5 \
  --json databaseId,conclusion,status,event,createdAt,displayTitle
gh run view <RUN_ID> --repo Cuchecorp/gov-map --log-failed | head -40   # solo si conclusion=failure
```
Inventario de workflows remotos (incluye los platform-managed):
```bash
gh workflow list --repo Cuchecorp/gov-map
```
Secrets — **nombres solamente, jamás valores**:
```bash
gh secret list --repo Cuchecorp/gov-map
```

**Pata 2 — última fila escrita (read-only, nunca imprimir la URL):**
```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
  "select 'proyecto', max(fecha_captura) from proyecto
   union all select 'citacion', max(fecha_captura) from citacion
   union all select 'lobby_audiencia', max(fecha_captura) from lobby_audiencia
   union all select 'declaracion', max(fecha_captura) from declaracion
   union all select 'actualidad_senal', max(creado_en) from actualidad_senal;"
```
Batchear en un solo `union all` por lote (discreción del CONTEXT) reduce round-trips. Verificar el nombre real de la columna temporal de `actualidad_senal` y `notificacion_envio` antes de asumir `creado_en`.

**pg_cron vivo:**
```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select jobid, jobname, schedule, active, command from cron.job order by jobid;"
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
  "select jobid, status, return_message, start_time from cron.job_run_details
   where start_time > now() - interval '14 days' order by start_time desc limit 50;"
```

**Pata 3 — freshness (desde la RAÍZ del repo):**
```bash
pnpm freshness --json > /tmp/freshness.json 2>/tmp/freshness.txt; echo "exit=$?"
```
Exit 1 = alguna stale (esperado, no error del probe). Exit 2 = config rota.

**Pata 4 — R2 spot-check barato vía DB:**
```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
  "select fuente, count(*), max(creado_en) from source_snapshot group by 1 order by 1;"
```
`source_snapshot` es el registro en DB de los PUT a R2 (introducido por 57-05). Es proxy suficiente para el spot-check sin credenciales R2 — preferirlo sobre SigV4 directo salvo que se requiera confirmar un objeto puntual.

## Don't Hand-Roll

| Problema | No construir | Usar en cambio | Por qué |
|---|---|---|---|
| Umbrales de staleness por fuente | tabla propia de umbrales en el doc | `packages/freshness/src/catalog.ts` | Ya calibrado y versionado; duplicarlo crea dos verdades |
| Parseo de salida de `gh` | regex sobre texto | `gh run list --json …` | La salida de texto cambia entre versiones |
| Formato del documento de veredictos | inventar anatomía nueva | clonar la de `56-CRON-AUDIT.md` | Precedente probado que 57 consumió como backlog directo; 119 hará lo mismo |
| Lectura de R2 | cliente SigV4 ad-hoc | `source_snapshot` en DB | Cero credenciales, misma señal |
| Enumeración pg_cron | leer migraciones | `select * from cron.job` | LOCKED en CONTEXT; migraciones ≠ estado desplegado |

**Key insight:** El único trabajo genuinamente nuevo de esta fase es *observar y juzgar*. Toda la instrumentación ya existe; construir instrumentación nueva sería desviación de alcance (y los fixes son de 119).

## Common Pitfalls

### Pitfall 1: Emitir veredicto sobre el entrypoint equivocado (gotcha 57-05)
**Qué sale mal:** `packages/tramitacion` tiene 4 CLIs, `probidad` 3, `agenda` 2, `lobby` 2. Auditar `ingest-cli.ts` cuando el YAML corre `run-*-prod-cli.ts` produce un veredicto sobre código que nunca se ejecuta — fue exactamente el gap "E2E verde pero R2 vacío" de v6.0.
**Cómo evitarlo:** usar la columna "Entrypoint invocado por el YAML" de la tabla maestra de arriba, ya resuelta. Citar `archivo:línea` del YAML como prueba.

### Pitfall 2: Contar 8 workflows con schedule
**Qué sale mal:** el CONTEXT lista digest-daily y roster-weekly entre los programados; ambos tienen el `cron:` comentado (estreno gated deliberado). Un inventario que los cuente como programados los declarará "stale" falsamente.
**Cómo evitarlo:** 6 programados / 7 no-programados. `digest-daily` y `roster-weekly` = "gated por diseño, causa en YAML:25 y YAML:30".

### Pitfall 3: Declarar gap donde hay decisión declarada
**Qué sale mal:** `lobby-camara-weekly` sin schedule y MONEY/SERVEL sin cron parecen gaps; son decisiones documentadas (WAF G7; gating legal MONEY).
**Cómo evitarlo:** antes de marcar gap, buscar comentario en el YAML o nota en la migración. Ambos casos tienen texto explícito.

### Pitfall 4: Confundir "sin novedades" con stale
**Qué sale mal:** una semana legislativa sin sesiones produce `[skip]` legítimo; el precedente 57-05 ya corrigió una assertion que fallaba con 0 declaraciones (T-57-05).
**Cómo evitarlo:** el veredicto verde admite skip legítimo con hash-check; exigir que la causa distinga "cursor detenido" de "fuente sin novedades" mirando la tabla `*_ingesta_estado`/`*_cursor_estado` correspondiente, no sólo el count de filas.

### Pitfall 5: Remapeo de nombres de secrets
**Qué sale mal:** `lobby-leylobby` inyecta `SUPABASE_API_URL` bajo el nombre `SUPABASE_URL`, y `roster-weekly` bajo `SUPABASE_LOCAL_URL`. Comparar `gh secret list` contra los nombres del `env:` da falsos "secret ausente".
**Cómo evitarlo:** comparar contra el nombre del lado `secrets.*` (derecho), no del lado `env` (izquierdo).

### Pitfall 6: Fuga de secreto en el documento
**Qué sale mal:** pegar salida de `psql` que incluya la URL, o un log de `gh run view` con un token.
**Cómo evitarlo:** `psql "$SUPABASE_DB_URL"` siempre por variable, nunca eco; revisar cada bloque de evidencia pegado; `gh secret list` sólo nombres+fechas.

## Runtime State Inventory

No aplica plenamente (no es fase de rename/refactor), pero el estado runtime ES el objeto de estudio:

| Categoría | Ítems | Acción |
|---|---|---|
| Datos almacenados | tablas destino de la tabla maestra + `source_snapshot` + `*_ingesta_estado` | leer (read-only) |
| Config de servicio vivo | `cron.job` en la DB de PROD; workflows en Cuchecorp/gov-map (incl. Dependabot/CodeQL no versionados) | enumerar contra lo vivo |
| Estado registrado por SO | ninguno | None — la ingesta corre en GH Actions y pg_cron, no en Task Scheduler |
| Secrets / env vars | secrets del repo remoto; `SUPABASE_DB_URL` local | listar NOMBRES; jamás valores |
| Artefactos de build | ninguno relevante | None |

## Project Constraints (from CLAUDE.md)

- **Dos etapas LOCKED:** fuente→R2 content-addressed, luego R2→Supabase. El audit debe evaluar compliance por conector (el precedente 56 tenía una subsección "DOS ETAPAS compliance" por workflow — conservarla).
- **Hash-check antes de descargar**, rate-limit 2–3 s/host, UA identificatorio, robots.txt.
- **Backfill masivo = LOCAL**, no GH Actions; cron de novedades diario L–V minimizando minutos.
- **Todas las API keys en `.env`**; el agente no imprime valores.
- **GSD:** trabajo vía comandos GSD; esta fase es read-only y su único artefacto es documentación.

## Environment Availability

| Dependencia | Requerida por | Disponible | Detalle | Fallback |
|---|---|---|---|---|
| `gh` CLI autenticado | Pata 1 | ✓ | cuenta `xenaquis`, scopes `repo, workflow, read:org, gist` | — |
| Acceso al repo remoto | Pata 1 | ✓ | `gh workflow list --repo Cuchecorp/gov-map` devolvió 15 workflows | — |
| `SUPABASE_DB_URL` en `.env` | Patas 2/4 + pg_cron | ✓ | presencia confirmada por conteo de clave; valor nunca leído | — |
| `psql` | Patas 2/4 | ✓ (asumido — usado en todas las fases previas) | — | `pnpm freshness` cubre parcialmente |
| `pnpm` + tsx | Pata 3 | ✓ | script raíz `freshness` presente | — |
| Credenciales R2 locales | Pata 4 exhaustiva | ✗/parcial | no verificadas en esta sesión | `source_snapshot` en DB (suficiente para spot-check) |
| Billing GH Actions | ejecución de crons | ? | histórico intermitente; se confirma con las conclusiones de runs | causa "billing" documentable |

**Sin fallback bloqueante:** ninguno. La fase puede cerrar aun sin respuesta del operador al checkpoint (CONTEXT lo declara explícitamente).

## Validation Architecture

El deliverable es un documento; su validación es **reproducibilidad de cada afirmación**.

### Regla de validación
Toda celda de "evidencia" en `118-CRON-VERDICTS.md` debe llevar (a) el comando exacto que la produjo y (b) la salida capturada (recortada, sin secretos ni URLs). Un veredicto sin comando citado es inválido y debe rechazarse en verificación.

### Requisitos → validación
| Criterio de éxito | Cómo se valida automáticamente |
|---|---|
| SC1 ningún cron sin veredicto | count de filas de la tabla maestra == (13 YAML locales + 2 platform-managed + N filas de `cron.job`); el doc declara los tres conteos |
| SC2 evidencia observada por cron | cada fila no-N/A cita ≥1 comando `gh` y ≥1 comando `psql` (o justifica por qué la pata no aplica) |
| SC3 causa apuntando a archivo o dato | cada veredicto ≠ verde incluye `archivo:línea` o timestamp/fila |
| SC4 gaps priorizados P0/P1/P2 | sección de gaps con id (G1..Gn), prioridad y pasos concretos, consumible por 119 |

### Comandos de gate
```bash
pnpm freshness --json      # exit 1 esperado si hay stale — no es fallo del audit
pnpm --filter ./app test -- --run   # suite intacta: la fase no debe tocar código
```
La suite no debería moverse (1560 al cierre de 117): fase read-only. Un delta en la suite es señal de que se editó código fuera de alcance.

### Wave 0 Gaps
Ninguno — no hay infraestructura de test que crear; la fase no produce código.

## Security Domain

| Riesgo | STRIDE | Mitigación |
|---|---|---|
| Fuga de valor de secreto en el documento | Information Disclosure | Sólo `gh secret list` (nombres+fecha); prohibido pegar valores; revisión del doc antes de commit |
| Fuga de `SUPABASE_DB_URL` (contiene password B26 sin rotar) | Information Disclosure | Siempre por variable de entorno; nunca en un bloque de salida; `set -a; source .env; set +a` sin eco |
| Escritura accidental en PROD | Tampering | Sólo `select`; prohibido `insert/update/delete/alter`; no invocar CLIs de ingesta durante el audit |
| Log de `gh run view` con datos sensibles | Information Disclosure | Recortar a las líneas de error; GH ya enmascara secrets pero no se confía ciegamente |

V2/V3/V4 (auth/sesión/acceso) no aplican: no hay superficie de aplicación en esta fase. V5 (validación de entrada) no aplica. V6 (cripto): sólo relevante como manejo de credenciales, cubierto arriba.

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|---|---|---|
| A1 | `psql` está instalado y en PATH | Environment | Pata 2 imposible → apoyarse en `pnpm freshness` (que usa su propio query-runner) |
| A2 | La columna temporal de `actualidad_senal`/`notificacion_envio` es `creado_en` | Comandos de probe | Query falla → verificar con `\d` antes de correr el lote |
| A3 | Los 5 jobs de migración están efectivamente activos en PROD | pg_cron | Sobra/falta un job → precisamente lo que la enumeración viva debe revelar (no es riesgo, es el hallazgo) |
| A4 | `backup-parlamentario`/`roster-weekly` escriben la maestra de identidad vía capa propia (sin `.from()` literal) | Mapa maestro | La pata 2 necesita otra query → leer `packages/identity/src/seed-cli.ts` en ejecución |
| A5 | Los secrets presentes siguen siendo sólo SUPABASE_API_URL + SUPABASE_SECRET_KEY (estado v6.0) | Deuda 110-02 | Puede haber mejorado; `gh secret list` lo resuelve en ejecución |

## Open Questions (RESOLVED)

Las cuatro recomendaciones fueron ADOPTADAS por los planes de la fase (118-01/02/03). Quedan aquí
con su resolución para que el documento de veredictos las cierre con evidencia, no las re-abra.

1. **¿Cuántos jobs pg_cron hay realmente activos en PROD?**
   Se sabe: 5 declarados en migraciones, con una rama condicional en 0003. No se sabe: cuáles quedaron activos.
   **RESOLVED:** primera query del audit (`118-01` Task 2, probes P6a/P6) — enumeración contra la DB
   viva, con pre-check de permisos y fallback a la expectativa de migraciones marcada
   `heredada: true` + gap P1 si el acceso está denegado. El delta migración↔vivo se declara en
   `118-02` §2 (secciones `### PG-`) y §3.3 como hallazgo de primera clase.
2. **¿Dependabot/CodeQL entran al inventario?**
   **RESOLVED: sí.** Enumerados como `### PM-<n>` con veredicto `no-cron` y clasificación
   "platform-managed, no-ingesta", causa "no versionado en `.github/workflows/`" (`118-02` Task 1).
   Entran al denominador de SC1 vía `conteo_platform_managed`.
3. **¿La deuda 110-02 sigue abierta?**
   Se sabe: al 2026-07-27 faltaban `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` y la rotación B26.
   **RESOLVED:** lo decide `gh secret list` en ejecución (probe P4, `118-01` Task 1). Si sigue
   abierta → `118-OPERATOR-CHECKPOINT.md` (`118-03` Task 2): se pide UNA vez, zero-credential-value,
   se registra como gap P2 y la fase cierra igual. Si no hay faltantes, se declara el resultado
   negativo fechado.
4. **¿Es gap que freshness apunte a `chilecompra-weekly.yml`/`servel-weekly.yml` inexistentes?**
   **RESOLVED: sí, gap de instrumentación P2** para 119 (quitar las entradas del catálogo o crear
   los YAML gated), registrado como gap SISTÉMICO en `118-03` §4 — explícitamente distinto de
   "MONEY/SERVEL gated", que va a §4.1 Estados esperados (NO son gaps).

## Sources

### Primarias (HIGH)
- Los 13 archivos `.github/workflows/*.yml` — leídos directamente en esta sesión
- `packages/freshness/src/cli.ts` y `catalog.ts` — leídos íntegros / por rangos
- `supabase/migrations/{0003,0030,0039,0065}.sql` — bloques `cron.schedule` extraídos
- `.planning/milestones/v6.0-phases/56-.../56-CRON-AUDIT.md` — precedente de formato y gaps G1–G7
- `.planning/milestones/v11.0-phases/110-.../110-02-OPERATOR-CHECKPOINT.md` — deuda de secrets
- `./CLAUDE.md` — reglas LOCKED de ingesta
- Probes vivos: `gh auth status`, `gh workflow list --repo Cuchecorp/gov-map`, `git remote -v`, `grep -c "^SUPABASE_DB_URL=" .env`

### Secundarias
- `.planning/milestones/v6.0-MILESTONE-AUDIT.md` — origen del gotcha 57-05

## Metadata

**Confianza:** stack N/A (no se instala nada) · mapa YAML→entrypoint→tablas HIGH (lectura directa) · pg_cron MEDIUM (migraciones = expectativa, no estado vivo) · pitfalls HIGH (precedentes documentados)

**Research date:** 2026-07-28
**Valid until:** ~14 días (los veredictos caducan rápido; el mapa estructural es estable)
