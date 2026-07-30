---
phase: 118
titulo: Auditoría de ingesta programada
requirement: CRON-01
consumido_por: [119]
regimen: solo-lectura
ancla_temporal: 2026-07-28
repo_remoto: Cuchecorp/gov-map
caducidad: ~14 días
auditor: agente GSD (executor 118-01)
patas_de_evidencia:
  - "pata 1 — corrida: gh run list / gh run view --log-failed"
  - "pata 2 — última fila escrita: psql read-only sobre la tabla destino del entrypoint REAL"
  - "pata 3 — señal freshness: packages/freshness/src/cli.ts --json"
  - "pata 4 — crudo: source_snapshot en DB (proxy del PUT a R2, sin credenciales R2)"
fuentes:
  - .github/workflows/*.yml
  - cron.job (DB viva)
  - packages/freshness/src/catalog.ts
  - 118-PROBES-RAW.md
cifras_heredadas:
  # Ninguna. Los tres conteos de §1 y los 20 veredictos provienen de probes corridas
  # el 2026-07-28 y registradas en 118-PROBES-RAW.md.
  heredada: false
---

# 118-CRON-VERDICTS — Auditoría de ingesta programada

**Fecha del audit:** 2026-07-28
**Repo remoto:** `Cuchecorp/gov-map`
**Auditor:** agente GSD (executor del plan 118-01)
**Bitácora de evidencia:** [`118-PROBES-RAW.md`](./118-PROBES-RAW.md) — cada fila de la tabla
maestra cita el id de probe (`P0`…`P10`) de donde sale su dato.
**Fase siguiente:** Phase 119 (CRON-FIX) — la gap-list es su backlog directo.

Las cuatro patas de evidencia declaradas en el front-matter se corrieron íntegras. Ningún
juicio de este documento se apoya en la lectura del YAML solamente: el YAML aporta el
*entrypoint* y la *cadencia esperada*, nunca el estado.

---

## 0. Método

### 0.1 Qué se auditó

El universo se **deriva**, no se hardcodea. Son tres sumandos, cada uno contado contra su
fuente viva:

1. **Workflows locales** = archivos `.yml` en `.github/workflows/` (probe **P0**).
2. **Workflows platform-managed** = los que `gh workflow list` reporta en el repo remoto y
   que NO existen como archivo versionado (probe **P1**).
3. **Jobs de `pg_cron`** = filas de `cron.job` en la DB de producción (probe **P6**), no las
   declaradas en migraciones.

Ninguna unidad queda sin clasificar: los workflows que no son cron (CI, deploy, backfills
manuales, estrenos gated) reciben `no-cron` con la causa declarada, en vez de quedar fuera
del inventario.

### 0.2 Cómo

| pata | herramienta | qué prueba | probes |
|---|---|---|---|
| 1 — corrida | `gh run list` / `gh run view --log-failed` | que el scheduler dispare y el runner termine | P1, P2, P3, P5 |
| 2 — escritura | `psql` read-only sobre la tabla destino del entrypoint REAL | que la corrida produzca dato | P6, P7, P8 |
| 3 — frescura | `packages/freshness/src/cli.ts --json` | umbrales ya calibrados por fuente | P9 |
| 4 — crudo | `source_snapshot` en DB (proxy del PUT a R2) | compliance dos-etapas | P10 |

Los umbrales de staleness NO se duplican aquí: los posee `packages/freshness/src/catalog.ts`
y se citan desde P9.

### 0.3 Qué NO hace este documento

Régimen **solo lectura**. Cero DDL, cero DML (`insert/update/delete/alter`), cero migración
aplicada, cero invocación de CLIs de ingesta, cero edición de `app/`, `packages/`,
`.github/workflows/`, `supabase/migrations/` o `.env`. Los únicos archivos escritos por esta
fase viven bajo `.planning/phases/118-*/`. **Todo fix es de Phase 119.** Tampoco se pide ni se
carga ningún valor de secreto: `gh secret list` entrega nombres y fechas (P4), y `psql` recibe
la URL por variable de entorno, que jamás se imprime.

### 0.4 Taxonomía LOCKED

Citada VERBATIM de `118-CONTEXT.md` §Taxonomía de veredictos:

> - **verde**: corrió en su ventana esperada Y escribió/verificó datos frescos (o `[skip] sin
>   novedades` legítimo con hash-check).
> - **stale**: corre pero no produce filas nuevas más allá de su cadencia esperada sin causa
>   legítima declarada, o lleva N ventanas sin correr.
> - **roto**: falla la corrida (exit no-cero, secret ausente, entrypoint equivocado, WAF) o
>   escribe basura.
> - Cadencia esperada se deriva del cron expression del YAML + naturaleza de la fuente
>   (semanal legislativo ≠ diario). Skip legítimo (semana sin sesiones) NO es stale — el
>   veredicto distingue "sin novedades honesto" de "cursor detenido".
> - Causa por veredicto no-verde: apuntar a archivo:línea (YAML o CLI) o a dato (fila/timestamp
>   psql, log de gh run).

Se añade una cuarta etiqueta, **`no-cron`**, para las unidades que existen en el inventario
pero no son ingesta programada (CI, deploy manual, backfill de dispatch, estreno gated,
platform-managed). No es un juicio de salud: es una clasificación, y siempre lleva su causa
en `archivo:línea`. Sin ella, el criterio "ninguna unidad sin clasificar" sería inalcanzable.

**Cómo se aplicó la regla "skip legítimo NO es stale"** en esta corrida: el discriminante
operativo es la tabla `*_ingesta_estado` / `*_cursor_estado` (probe P8), no el conteo de
filas. Una fuente sin novedades deja el cursor avanzando con datos nuevos ausentes; un
cursor detenido deja el marcador congelado aunque la corrida sea verde. Ese contraste es lo
que produjo el único `stale` de este audit.

### 0.5 Comandos re-ejecutables

```bash
# --- pata 1 (GitHub Actions) — --repo es obligatorio -------------------------------
gh workflow list --repo Cuchecorp/gov-map
gh run list --repo Cuchecorp/gov-map --workflow <NAME>.yml --limit 5 \
  --json databaseId,conclusion,status,event,createdAt,displayTitle
gh run view <RUN_ID> --repo Cuchecorp/gov-map --log-failed | head -40   # solo si failure
gh secret list --repo Cuchecorp/gov-map                                # NOMBRES, jamás valores

# --- patas 2 y 4 (psql read-only) --------------------------------------------------
# La URL de la DB viaja por variable de entorno y jamás se imprime.
# set -a; source .env; set +a
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select jobid, jobname, schedule, active, command from cron.job order by jobid;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select j.jobname, d.status, count(*), max(d.start_time)
#      from cron.job_run_details d left join cron.job j on j.jobid=d.jobid
#     where d.start_time > now() - interval '14 days' group by 1,2 order by 1,2;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select 'proyecto', max(fecha_captura) from proyecto
#     union all select 'citacion', max(fecha_captura) from citacion
#     union all select 'lobby_audiencia', max(fecha_captura) from lobby_audiencia
#     union all select 'declaracion', max(fecha_captura) from declaracion
#     union all select 'actualidad_senal', max(fecha_captura) from actualidad_senal;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select source, count(*), max(fetched_at) from source_snapshot group by 1 order by 1;"

# --- pata 3 (freshness) — SIEMPRE desde la raíz del repo ---------------------------
# `pnpm freshness` no resuelve `tsx` en este entorno (ver P9); binario efectivo:
./packages/freshness/node_modules/.bin/tsx packages/freshness/src/cli.ts --json \
  > /tmp/fresh.json 2>/tmp/fresh.err; echo "exit=$?"   # exit=1 esperado si hay stale
```

> **Nota de columnas (corrige al RESEARCH).** `creado_en` no existe en las tablas relevantes:
> `actualidad_senal` usa `fecha_captura`, `notificacion_envio` usa `created_at`, y
> `source_snapshot` usa `source` + `fetched_at`. Verificado en P7 y P10 antes de correr los
> lotes.

---

## 1. Inventario y tabla maestra

### 1.1 Universo cerrado — los tres sumandos

- **Workflows locales:** 13 archivos `.yml` en `.github/workflows/` (P0). De ellos, **6
  tienen `schedule:` ACTIVO** y 7 no.
- **Workflows platform-managed:** 2 — `Dependabot Updates` (id 314034212) y `CodeQL`
  (id 301076402), presentes en el repo remoto y ausentes del filesystem (P1).
- **Jobs de `pg_cron` vivos:** 5 filas en `cron.job`, las 5 con `active = t` (P6).

**Total de unidades de cron inventariadas: 13 + 2 + 5 = 20.** Cada una recibe exactamente un
veredicto en la tabla de §1.3.

Líneas máquina-parseables (el denominador se DERIVA de estas, no se hardcodea):

conteo_workflows_locales: 13
conteo_platform_managed: 2
conteo_pg_cron_vivos: 5
conteo_total_unidades: 20

Sanidad de los conteos:

- `conteo_workflows_locales` = 13 coincide con `ls .github/workflows/*.yml | wc -l` = 13 (P0).
  **Sin diff.**
- `conteo_pg_cron_vivos` = 5 coincide con las filas de `cron.job` capturadas en P6, y con el
  `count(*)` del pre-check P6a. **Sin diff**, y además delta CERO contra los 5 jobs esperados
  por migraciones.
- `conteo_platform_managed` = 2 = 15 workflows remotos (P1) − 13 versionados.

### 1.2 Corrección al CONTEXT: 6 programados, no 8

`118-CONTEXT.md:18` afirma que 8 workflows tienen `schedule:` e incluye `digest-daily` y
`roster-weekly` entre ellos. **La observación dice 6.** El bloque `schedule:` de esos dos está
**comentado**: `digest-daily.yml:24-25` y `roster-weekly.yml:29-30`, en ambos casos con el
comentario de estreno gated ("descomentar SOLO tras corrida manual VERDE"). La cifra que rige
en este documento es la observada, **6 programados / 7 no-programados** (P0), con su
`archivo:línea`:

| workflow | línea del `- cron:` activo | expresión |
|---|---|---|
| `actualidad-refresh.yml` | `:17` | `0 11,14,17,20 * * 1-5` |
| `agenda-weekly.yml` | `:15` | `0 11 * * 1` |
| `backup-parlamentario.yml` | `:21` | `0 6 * * 1` |
| `leyes-weekly.yml` | `:19` | `0 20 * * 1-5` |
| `lobby-leylobby-weekly.yml` | `:16` | `0 11 * * 3` |
| `probidad-weekly.yml` | `:16` | `0 11 * * 4` |

La cifra del CONTEXT no se ajustó a la observación ni al revés: se registra el diff y manda
el dato.

### 1.3 Tabla maestra — un veredicto por unidad

La columna **entrypoint invocado** es la verdad operativa (gotcha 57-05): es lo que el YAML
ejecuta de verdad, no el CLI que uno supondría por el nombre del paquete. Su `archivo:línea`
es la prueba.

| # | unidad de cron | tipo | schedule real | entrypoint invocado (`archivo:línea`) | tabla destino | pata 1 (última corrida) | pata 2 (última fila) | pata 3 (freshness) | VEREDICTO | causa (`archivo:línea` o dato) | probe |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `actualidad-refresh` | GH workflow | `0 11,14,17,20 * * 1-5` (`actualidad-refresh.yml:17`) | `src/run-actualidad-prod-cli.ts` (`actualidad-refresh.yml:64`) | `actualidad_senal` | success 2026-07-28T16:07:47Z | `actualidad_senal` 2026-07-28 16:08:28 (18 filas) | no cubierto por el catálogo | Veredicto: verde | corrida y escritura en la MISMA ventana (16:07 → 16:08) | P2, P7, P9 |
| 2 | `agenda-weekly` | GH workflow | `0 11 * * 1` (`agenda-weekly.yml:15`) | `src/run-agenda-prod-cli.ts` (`agenda-weekly.yml:71`) | `citacion`, `citacion_punto`, `sesion_sala`, `sesion_tabla_item` | success 2026-07-27T13:40:16Z | `citacion` 2026-07-27 13:41:24; `sesion_sala` 2026-07-27 13:41:29 | `agenda` stale=false (1 d / umbral 7) | Veredicto: verde | tres patas concordantes | P2, P7, P9 |
| 3 | `backup-parlamentario` | GH workflow | `0 6 * * 1` (`backup-parlamentario.yml:21`) | `@obs/identity run seed:live -- --preserve-estado` (`backup-parlamentario.yml:63`; paso `--r2` en `:86`) | **no escribe Supabase** — destino real `supabase/seeds/parlamentario.seed.json` (`backup-parlamentario.yml:60`) | success 2026-07-27T10:04:05Z | commit del bot `5782d8c` 2026-07-27 10:05:12 (y 07-20, 07-13) | no cubierto por el catálogo | Veredicto: verde | artefacto producido 1 min después de cada corrida, 3 lunes seguidos | P2, P7 |
| 4 | `leyes-weekly` | GH workflow | `0 20 * * 1-5` (`leyes-weekly.yml:19`) | `src/run-tramitacion-prod-cli.ts` (`leyes-weekly.yml:75`) | `proyecto`, `tramitacion_evento`, `votacion`, `leyes_rotacion_estado` | success 2026-07-27T21:09:03Z | `proyecto` 2026-07-27 21:38:06; `tramitacion_evento`/`votacion` 21:38:09 | `leyes` stale=false (0 d / 7); `leyes-min-edad` stale=false (19 d / 45) | Veredicto: verde | cursor `leyes_rotacion_estado` = `16851-14` @ 2026-07-27 21:09; `source_snapshot` source=`leyes` 4380 @ 21:38 | P2, P7, P8, P9, P10 |
| 5 | `lobby-leylobby-weekly` | GH workflow | `0 11 * * 3` (`lobby-leylobby-weekly.yml:16`) | `src/ingest-cli.ts` (`lobby-leylobby-weekly.yml:70`; remapeo de env declarado en `:57`) | `lobby_audiencia`, `leylobby_cursor_estado`, `lobby_ingesta_estado` | success 2026-07-22T12:43:27Z | `lobby_audiencia` 2026-07-22 12:44:05; **`lobby_ingesta_estado.ingestado_hasta` = 2026-06-22 (36 d)** | `lobby-leylobby` **stale=true** (36 d / umbral 7) | Veredicto: stale | cursor detenido, no fuente sin novedades: la corrida es verde y `lobby_audiencia` recibió filas el 2026-07-22, pero `lobby_ingesta_estado` sigue en 2026-06-22 mientras `leylobby_cursor_estado` sí avanzó (2026-07-22 12:44:06) — dos cursores desincronizados | P2, P7, P8, P9 |
| 6 | `probidad-weekly` | GH workflow | `0 11 * * 4` (`probidad-weekly.yml:16`) | `src/run-probidad-todos-cli.ts` (`probidad-weekly.yml:74`) | `declaracion`, `probidad_ingesta_estado` | success 2026-07-23T12:26:11Z | `declaracion` 2026-07-23 12:37:05 (1065 filas) | `probidad` stale=false (5 d / umbral 30) | Veredicto: verde | cursor `probidad_ingesta_estado.ingestado_hasta` = 2026-07-23; `source_snapshot` source=`infoprobidad` @ 2026-07-23 12:37:12 | P2, P7, P8, P9, P10 |
| 7 | `digest-daily` | GH workflow | **comentado** (`digest-daily.yml:24-25`) — dispatch-only | `src/run-confirmaciones-prod-cli.ts` (`digest-daily.yml:69`) y luego `src/run-digest-prod-cli.ts` (`:85`) | `notificacion_envio`, `suscripcion` | sin corridas (`[]`) | `notificacion_envio` 0 filas | no cubierto por el catálogo | Veredicto: no-cron | estreno gated por diseño: `digest-daily.yml:17` ("ESTRENO GATED… schedule comentado"); NOTIF parked, faltan `RESEND_API_KEY`/`NOTIF_*` en secrets | P2, P4, P7 |
| 8 | `roster-weekly` | GH workflow | **comentado** (`roster-weekly.yml:29-30`) — dispatch-only | `@obs/identity run seed:live -- --preserve-estado` (`roster-weekly.yml:71`) | maestra de identidad (`parlamentario`) | success 2026-07-15T21:47:55Z (`workflow_dispatch`) | `parlamentario` 2026-07-27 00:10:53 — **no atribuible a este workflow** (última corrida 07-15) | no cubierto por el catálogo | Veredicto: no-cron | estreno gated por diseño: `roster-weekly.yml:16` ("ESTRENO GATED: workflow_dispatch SOLO"). La escritura del 2026-07-27 proviene de una ejecución fuera de GH Actions | P2, P7 |
| 9 | `lobby-camara-weekly` | GH workflow | **sin schedule — deshabilitado a propósito** (`lobby-camara-weekly.yml:14-17`) | `src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html` (`lobby-camara-weekly.yml:67`), precedido de `curl` (`:52`) | `lobby_audiencia`, `lobby_contraparte` | failure 2026-07-07T13:17:09Z (y 2026-06-30) | `lobby_audiencia` 2026-07-22 12:44:05 (escrito por la fila #5, no por éste) | `lobby-camara` stale=false (6 d / umbral 14) — pero mide una tabla que llena otro cron | Veredicto: no-cron | decisión declarada, NO gap: WAF de camara.cl (`lobby-camara-weekly.yml:14-17`, gap G7 del audit 56). Log del fallo: `lobby.html = 5463 bytes` → guard `< 10240` → exit 1. Fallback local en `docs/runbooks/cron-local-fallback.md` | P2, P3, P7, P9 |
| 10 | `backfill` | GH workflow | sin schedule (`backfill.yml:11-12`) | `deno run … ingest-worker/backfill.ts` (`backfill.yml:50-54`) | varias (snapshot inicial) | sin corridas (`[]`) | n/a | n/a | Veredicto: no-cron | dispatch manual por diseño: `backfill.yml:7` ("Disparo manual (workflow_dispatch) — NO programado"); CLAUDE.md manda backfill masivo LOCAL | P2 |
| 11 | `fichas-backfill` | GH workflow | sin schedule (`fichas-backfill.yml:10-11`) | `src/pipeline-cli.ts` (`fichas-backfill.yml:81`) | `proyecto_ficha`, `proyecto_embedding` | sin corridas (`[]`) | `proyecto` 2026-07-27 21:38:06 (escrito por la fila #4) | `fichas` stale=false (0 d / 30) — mide `proyecto`, que llena `leyes-weekly` | Veredicto: no-cron | backfill manual por diseño: `fichas-backfill.yml:8` ("NO programado"). Faltan `GEMINI_API_KEY` y `SUPABASE_URL` en secrets (irrelevante mientras no corra) | P2, P4, P9 |
| 12 | `ci` | GH workflow | `push` + `pull_request` (`ci.yml:11-14`) | `pnpm --filter ./app test` (`ci.yml:49`), `tsc --noEmit` (`:52`), vitest `@obs/llm` (`:60`) y `@obs/cruces` (`:65`) | ninguna | success 2026-07-27T19:20:26Z | n/a — no escribe datos | n/a | Veredicto: no-cron | no es ingesta: se dispara por eventos de repositorio, no por reloj (`ci.yml:11-14`) | P2 |
| 13 | `deploy-cloudflare` | GH workflow | sin schedule (`deploy-cloudflare.yml:19-20`) | `pnpm run deploy` (`deploy-cloudflare.yml:61`) | ninguna | **failure** 2026-07-09T14:59:38Z | n/a — no escribe datos | n/a | Veredicto: no-cron | deploy manual por diseño (`deploy-cloudflare.yml:6`). Su fallo es deuda de operador 110-02, no un cron roto: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` se expanden VACÍOS en el runner → `✘ [ERROR] … it's necessary to set a CLOUDFLARE_API_TOKEN`. El deploy real de PROD se hace localmente con wrangler OAuth | P2, P3, P4 |
| 14 | `Dependabot Updates` (id 314034212) | platform-managed | gestionado por GitHub | n/a — no versionado en `.github/workflows/` | ninguna | n/a (no expone runs por archivo `.yml`) | n/a | n/a | Veredicto: no-cron | platform-managed, no-ingesta: existe en el repo remoto y NO tiene archivo en `.github/workflows/` | P1 |
| 15 | `CodeQL` (id 301076402) | platform-managed | gestionado por GitHub | n/a — no versionado en `.github/workflows/` | ninguna | n/a (no expone runs por archivo `.yml`) | n/a | n/a | Veredicto: no-cron | platform-managed, no-ingesta: análisis de seguridad de la plataforma, sin archivo en el repo | P1 |
| 16 | `process-ingest-jobs` (jobid 1) | pg_cron | `30 seconds` | `select util.process_ingest_jobs();` (`0003_orchestration.sql:214`) | cola de ingesta (`util`) | 40.238 success + 1 failed en 14 d; última 2026-07-28 16:22:10 | n/a (procesa cola, no tabla-destino propia) | ningún job pg_cron está en el catálogo | Veredicto: verde | 99.998 % de éxito; el único fallo es `job startup timeout` @ 2026-07-27 18:25:29. Rama activa = pg_cron ≥ 1.5 (`:214`), no el fallback `* * * * *` de `:221` | P6 |
| 17 | `cleanup-net-http` (jobid 2) | pg_cron | `*/15 * * * *` | `select util.cleanup_net_http();` (`0003_orchestration.sql:229`) | tablas de `net` (limpieza) | 1344 success en 14 d; última 2026-07-28 16:15:00 | n/a (job de limpieza) | ningún job pg_cron está en el catálogo | Veredicto: verde | 1344 observadas vs 1344 teóricas — cadencia exacta, cero fallos | P6 |
| 18 | `net-materializar-aristas` (jobid 3) | pg_cron | `17 3 * * *` | `select grafo.materializar_aristas();` (`0030_net.sql:162`) | `grafo.*` (aristas materializadas) | 14 success en 14 d; última 2026-07-28 03:17:00 | n/a (materialización interna) | ningún job pg_cron está en el catálogo | Veredicto: verde | 14/14 días, cero fallos | P6 |
| 19 | `cruces-materializar` (jobid 4) | pg_cron | `23 3 * * *` | `select cruces.materializar_cruces();` (`0039_cruce_senal.sql:138`) | `cruces.*` (señales materializadas) | 14 success en 14 d; última 2026-07-28 03:23:00 | n/a (materialización interna) | ningún job pg_cron está en el catálogo | Veredicto: verde | 14/14 días, cero fallos | P6 |
| 20 | `actualidad-materializar` (jobid 5) | pg_cron | `7 11,14,17,20 * * 1-5` | `select actualidad.materializar_senales();` (`0065_actualidad_senal.sql:326`) | `actualidad_senal` | 8 success; **primera corrida registrada 2026-07-24 17:07** (historial completo = 8 filas) | `actualidad_senal` 2026-07-28 16:08:28 | ningún job pg_cron está en el catálogo | Veredicto: verde | job en servicio desde el 2026-07-24; cadencia post-arranque 100 % (2026-07-27 lunes 4/4 ventanas, 2026-07-28 martes 2/2 transcurridas, fin de semana correctamente omitido por `* * 1-5`). Las 8 corridas NO son poda de `job_run_details`: `cleanup-net-http` conserva sus 1344 filas del mismo período | P6, P7 |

**Resumen de veredictos:** 10 verde · 1 stale · 0 roto · 9 no-cron = **20 unidades**, igual a
`conteo_total_unidades`.

De los **6 workflows con `schedule:` activo**, 5 están verdes y 1 stale. **Ningún cron
programado está roto.**

### 1.4 Secrets confirmados (nombres + fecha de creación)

Salida de `gh secret list --repo Cuchecorp/gov-map` (P4) — **7 secrets presentes**, sin
ningún valor:

| secret (NOMBRE) | creado |
|---|---|
| `DEEPSEEK_API_KEY` | 2026-07-09T00:10:04Z |
| `R2_ACCESS_KEY_ID` | 2026-07-09T00:10:01Z |
| `R2_BUCKET` | 2026-07-09T00:10:03Z |
| `R2_ENDPOINT_URL` | 2026-07-09T00:09:53Z |
| `R2_SECRET_ACCESS_KEY` | 2026-07-09T00:10:02Z |
| `SUPABASE_API_URL` | 2026-06-23T14:06:11Z |
| `SUPABASE_SECRET_KEY` | 2026-06-23T14:06:12Z |

La comparación se hizo contra el lado **`secrets.*`** de cada `env:` (Pitfall 5), no contra el
nombre de la variable de entorno — `lobby-leylobby-weekly.yml:57` remapea `SUPABASE_API_URL`
a `SUPABASE_URL`, y `roster-weekly` a `SUPABASE_LOCAL_URL`; compararlos por el lado izquierdo
habría producido falsos "secret ausente".

**Ausentes, todos en workflows de disparo manual:**

| workflow | secrets ausentes | impacto |
|---|---|---|
| `deploy-cloudflare` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | deuda de operador 110-02, confirmada abierta al 2026-07-28 (P3.b) |
| `digest-daily` | `RESEND_API_KEY`, `NOTIF_TOKEN_SECRET`, `NOTIF_BASE_URL`, `NOTIF_FROM` | esperado: NOTIF parked, flag OFF |
| `fichas-backfill` | `GEMINI_API_KEY`, `SUPABASE_URL` | backfill manual, no corre hoy |

**Los 6 workflows con `schedule:` activo tienen TODOS sus secrets presentes** — ninguno de los
crons programados está bloqueado por credencial ausente. Esto corrige la asunción A5 del
RESEARCH, que esperaba encontrar sólo los dos secrets de Supabase.

### 1.5 Estados esperados que NO son gaps

Registrados aquí para que Phase 119 no los tome como backlog:

- **MONEY / SERVEL sin cron.** `contratos_ingesta_estado` y `aportes_ingesta_estado` tienen
  **0 filas** (P8) y las migraciones declaran explícitamente que no registran job:
  `0023_dinero.sql:46` ("el pg_cron del barrido por RUT queda como checkpoint de operador, NO
  se crea en este DDL") y `0025_agregacion.sql:46` ("NO se crea ningun cron.schedule en este
  DDL"). Gating legal, decisión declarada.
- **`lobby-camara-weekly` sin schedule.** Causa en `lobby-camara-weekly.yml:14-17` (WAF).
- **`digest-daily` y `roster-weekly` con schedule comentado.** Estreno gated por diseño
  (`digest-daily.yml:17`, `roster-weekly.yml:16`).
- **`notificacion_envio` con 0 filas.** Coherente con NOTIF parked.

### 1.6 Hallazgos que SÍ alimentan a Phase 119

Se enuncian aquí sin priorizar (la gap-list numerada y priorizada la construye el plan 118-03):

1. **Cursor `lobby_ingesta_estado` detenido en 2026-06-22** pese a corridas verdes semanales
   (fila #5). Dos cursores desincronizados para la misma fuente.
2. **Instrumentación de freshness apuntando a YAML fantasma:** `catalog.ts:313` declara
   `chilecompra-weekly.yml` y `:337` declara `servel-weekly.yml`; ninguno existe. Los dos 404
   se capturaron en vivo en P9. Distinto de "MONEY/SERVEL gated" (§1.5): lo gated es el
   *dato*; esto es el *catálogo* apuntando a un archivo inexistente.
3. **Huecos de cobertura de freshness:** el catálogo (9 entradas) no cubre
   `actualidad-refresh`, `digest-daily`, `backup-parlamentario` ni **ninguno** de los 5 jobs
   de `pg_cron`. Esas 8 unidades se auditaron sin pata 3.
4. **`source_snapshot` sólo registra 2 fuentes** — `leyes` (4380) e `infoprobidad` (3) (P10).
   Ausentes `agenda`, `lobby-leylobby`, `lobby-camara`, `bio`, `fichas`, `actualidad`:
   conectores sin traza en DB del PUT a R2 (compliance dos-etapas de `CLAUDE.md`).
5. **`pnpm freshness` no resuelve `tsx`** en el entorno local (P9): variante viva del gotcha
   v8.1. El binario está en `packages/freshness/node_modules/.bin/tsx`, no en la raíz.
6. **Deuda de operador 110-02 abierta:** `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
   ausentes (P4, P3.b).
7. **Señales de freshness que miden una tabla que llena OTRO cron:** `lobby-camara` mide
   `lobby_audiencia` (que llena `lobby-leylobby`) y `fichas` mide `proyecto` (que llena
   `leyes-weekly`). Ambas reportan `stale=false` por el trabajo de un cron distinto del que
   la entrada nombra — la señal es estructuralmente incapaz de detectar la avería del cron
   que dice vigilar.

### 1.7 Preguntas cerradas con evidencia

- **Billing de GitHub Actions: NO bloqueado** al 2026-07-28 (P5). Corridas `schedule` con
  `conclusion: success` el mismo día del audit. "Billing" queda retirado como causa candidata
  de esta corrida.
- **¿Cuántos jobs pg_cron activos?** 5, delta CERO contra migraciones; rama activa de
  `0003_orchestration.sql` = `:214` (`30 seconds`, pg_cron ≥ 1.5) (P6a, P6).
- **¿Dependabot/CodeQL al inventario?** Sí, filas #14 y #15.
- **¿110-02 abierta?** Sí (P3.b, P4).
- **¿El catálogo apuntando a YAML inexistentes es gap?** Sí, §1.6 punto 2.

---

## 2. Unidades de cron

Una subsección por unidad, en el mismo orden de la tabla maestra de §1.3: `W-1`…`W-13` para los
13 workflows versionados, `PM-1`/`PM-2` para los platform-managed, `PG-1`…`PG-5` para los jobs de
`pg_cron` vivos. **Fila a fila, sin huecos.**

Convenciones de esta sección:

- La anatomía es la del audit 56 (`56-CRON-AUDIT.md:34-76`) **más un bloque nuevo**,
  `#### Evidencia observada`, que 118 exige: ninguna afirmación sin comando o id de probe.
- Cuando una pata **no aplica**, se declara por qué. Nunca se omite (regla de validación de 118).
- `#### DOS ETAPAS compliance` sólo aparece en las unidades de ingesta (las que tocan una fuente
  externa o escriben crudo). En CI, deploy y platform-managed se declara su no-aplicabilidad en
  una línea, en vez de fabricar un bloque vacío.
- Las líneas `psql` de los bloques `#### Cómo re-verificar` van **comentadas con `#`** (idiom 56):
  requieren `set -a; source .env; set +a` y nadie debe pegarlas a ciegas.

---

### W-1: actualidad-refresh

**YAML:** `.github/workflows/actualidad-refresh.yml`
**Schedule:** `0 11,14,17,20 * * 1-5` (`actualidad-refresh.yml:17`) — L–V, cuatro ventanas
intradía. Activo.
**Entrypoint invocado:** `actualidad-refresh.yml:64` →
`pnpm --filter @obs/actualidad exec tsx src/run-actualidad-prod-cli.ts` →
`packages/actualidad/src/run-actualidad-prod-cli.ts`. El paquete no tiene CLI hermano de
ingesta; el entrypoint es único.
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. (Ancla: corrida `success` 2026-07-28T16:07:47Z y
escritura en `actualidad_senal` 2026-07-28 16:08:28, misma ventana.)

#### Evidencia observada

- **Pata 1 (corrida) — P2.** `gh run list --workflow actualidad-refresh.yml`:
  `success @ 2026-07-28T16:07:47Z`, `event: schedule`; las 5 corridas más recientes son las
  cinco `success` por `schedule`. Cero fallos en la ventana observada.
- **Pata 2 (escritura) — P7.** `actualidad_senal`: 18 filas, `max(fecha_captura)` =
  `2026-07-28 16:08:28.275+00` — **41 segundos después** del arranque de la corrida.
- **Pata 3 (freshness) — no aplica.** La fuente no está en `packages/freshness/src/catalog.ts`:
  el catálogo tiene 9 entradas y ninguna apunta a `actualidad_senal` (P9, hueco de cobertura
  confirmado en ejecución). El veredicto se apoya en patas 1+2, que son concordantes y
  contemporáneas.
- **Pata 4 (crudo R2) — no aplica.** El job no toca ninguna fuente gubernamental (ver DOS ETAPAS
  abajo), luego no hay crudo que persistir. `source_snapshot` no registra `actualidad` (P10) y
  eso es lo ESPERADO, no un gap.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | No aplica | No hay fuente externa: lee `proyecto_embedding` de Supabase | `packages/actualidad/src/run-actualidad-prod-cli.ts:15` |
| Etapa-2 desde R2 | No aplica | El insumo ya vive en Supabase (derivado de derivado) | `run-actualidad-prod-cli.ts:9-13` |
| Hash-check pre-descarga | No aplica | Sin descarga: cero requests HTTP a terceros | `run-actualidad-prod-cli.ts:15` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **no aplica, declarado en código.**
  `packages/actualidad/src/run-actualidad-prod-cli.ts:15` dice literalmente: *"NO toca fuentes
  gubernamentales → sin R2, sin rate-limit, sin robots.txt. Solo Supabase."* Es una capa de
  agrupación por materia (k-means determinista) sobre embeddings ya ingeridos.
- **Etapa-2 (R2→Supabase):** no aplica por lo mismo — su insumo es `proyecto_embedding`, que ya
  es producto de la cadena de `leyes-weekly` + `fichas`.
- **Hash-check:** no aplica (sin descarga).
- **Rate-limit 2-3s:** no aplica — cero requests a hosts externos.
- **UA identificatorio:** no aplica — cero requests a hosts externos.
- **robots.txt:** no aplica — cero requests a hosts externos.

> Esta unidad es el ejemplo canónico de "pata no aplicable **declarada**": las seis viñetas
> podrían haberse omitido, y entonces el lector no sabría si el conector incumple la regla LOCKED
> de `CLAUDE.md` o si la regla no le concierne. Concierne a quien toca fuentes; éste no.

#### Gaps de esta unidad

Ninguno propio. Contribuye a **G3** (`G-cobertura-freshness`, §1.6 punto 3): el catálogo no la
cubre, así que una avería silenciosa de este cron no dispararía ninguna señal. Comparte además el
*instrumento* averiado con **G2** (catálogo apuntando a YAML inexistentes, §1.6 punto 2) y **G10**
(`pnpm freshness` no resuelve `tsx`, §1.6 punto 5): las tres son fallas del medidor, no del medido.
Numeración consolidada en §4.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow actualidad-refresh.yml --limit 5 \
  --json databaseId,conclusion,status,event,createdAt
# set -a; source .env; set +a
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select count(*), max(fecha_captura) from actualidad_senal;"
grep -n "NO toca fuentes gubernamentales" packages/actualidad/src/run-actualidad-prod-cli.ts
```

---

### W-2: agenda-weekly

**YAML:** `.github/workflows/agenda-weekly.yml`
**Schedule:** `0 11 * * 1` (`agenda-weekly.yml:15`) — lunes 11:00 UTC. Activo.
**Entrypoint invocado:** `agenda-weekly.yml:71` → `src/run-agenda-prod-cli.ts` →
`packages/agenda/src/run-agenda-prod-cli.ts`. **CLI hermano NO ejecutado:** el paquete expone
también `packages/agenda/src/ingest-run.ts` como módulo de orquestación (`runIngest`), que el
CLI de producción importa (`run-agenda-prod-cli.ts:28`) pero que **no es** el entrypoint del
YAML. El veredicto se emite sobre el CLI, no sobre el módulo (gotcha 57-05).
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. Las tres patas concuerdan.

#### Evidencia observada

- **Pata 1 — P2.** `success @ 2026-07-27T13:40:16Z`, `event: schedule`. Las **5** corridas más
  recientes son `success` y caen en lunes consecutivos: 07-27, 07-20, 07-13, 07-06, 06-29.
  Cadencia semanal sin hueco.
- **Pata 2 — P7.** `citacion`: 289 filas, `max(fecha_captura)` = `2026-07-27 13:41:24.416+00`
  (68 s tras el arranque). `sesion_sala`: 18 filas, `2026-07-27 13:41:29.72+00`.
  *Nota de método:* la tabla que el RESEARCH proponía (`sesion_tabla_item`) **no tiene**
  `fecha_captura` — error literal `column "fecha_captura" does not exist` registrado en P7 — y
  se sustituyó por `sesion_sala`, que sí la tiene y también es escrita por este cron.
- **Pata 3 — P9.** Entrada `agenda` del catálogo (`catalog.ts:255-259`, tabla `citacion`,
  `umbralDias: 7`): `diasDesdeUpsert: 1`, `stale: false`, `ghRun: "success @ 2026-07-27"`.
- **Pata 4 — P10.** `source_snapshot` **no** registra `agenda`. La Etapa-1 corre (ver abajo) pero
  no deja traza en DB: es el hallazgo §1.6 punto 4, no un fallo de este veredicto.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Sí | Operativa — los 4 `R2_*` están presentes desde 2026-07-09 (P4) | `packages/agenda/src/ingest-run.ts:155`, `:291` (`putImmutable`) |
| Etapa-2 desde R2 | No | El parseo lee el resultado en memoria del fetch; no hay ruta `--from-r2` | `packages/agenda/src/run-agenda-prod-cli.ts` (sin flag de replay) |
| Hash-check pre-descarga | Parcial | `putImmutable` devuelve `existed`, pero el llamador **lo descarta** (`const { r2Path: key } = …`) → no hay short-circuit "sin novedades" | `packages/agenda/src/ingest-run.ts:155`, `:291` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **cumple** — `packages/agenda/src/ingest-run.ts:155` y `:291` llaman a
  `putImmutable` sobre el `TablaR2Target`, y el `R2Store` se construye con credenciales reales en
  `run-agenda-prod-cli.ts:137-138`. **Cambio respecto del audit 56**, que la marcó "no-op por
  secrets ausentes": los 4 `R2_*` **existen hoy** (P4, creados 2026-07-09). Esa causa está muerta.
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** **no cumple** — no existe modo de replay.
  Re-ingestar exigiría volver a la fuente, que es exactamente lo que la regla LOCKED de
  `CLAUDE.md` prohíbe. Compárese con `tramitacion` (`ingest-cli.ts:200`) y `lobby`
  (`ingest-cli.ts:161`), que sí exponen `--from-r2`.
- **Hash-check:** **parcial** — la infraestructura está (`R2Store.putImmutable` usa
  `If-None-Match: *` y devuelve `existed=true` en 412, `packages/ingest/src/r2-store.ts:71`,
  `:79`), pero el conector de agenda **descarta el `existed`** y sigue parseando igual. El
  comentario de `ingest-run.ts:152` reconoce el asunto. No hay "salir temprano cuando no hay
  novedades" (`CLAUDE.md`, regla 2).
- **Rate-limit 2-3s:** **cumple** — `new HostRateLimiter()` en
  `packages/agenda/src/run-agenda-prod-cli.ts:99`, inyectado al `Fetcher` (`:104`) y al conector
  (`:109`). El default de la clase es `minDelayMs: 2000` + jitter, dentro de la banda 2-3 s
  (`packages/ingest/src/rate-limiter.test.ts:50`, "LOCKED 2-3s").
- **UA identificatorio:** **cumple** — `Bot-Ciudadano/1.0 (consulta ciudadana Chile;
  contacto@dominio.cl)` (`packages/ingest/src/robots.ts:13`, referenciado desde
  `packages/ingest/src/fetcher.ts:5`).
- **robots.txt:** **cumple** — `new RobotsGuard({ allowlist: {} })` en
  `run-agenda-prod-cli.ts:100`.

#### Gaps de esta unidad

**G7** (`G-etapa2-agenda`, sin ruta `--from-r2`), **G6** (`G-hashcheck-agenda`, `existed`
descartado), **G5** (`G-snapshot-agenda`, §1.6 punto 4: sin fila en `source_snapshot`).
Numeración consolidada en §4.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow agenda-weekly.yml --limit 5 \
  --json conclusion,event,createdAt
grep -n "putImmutable" packages/agenda/src/ingest-run.ts        # 155, 291 — ver si `existed` se usa
grep -n "HostRateLimiter\|RobotsGuard\|R2Store" packages/agenda/src/run-agenda-prod-cli.ts
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select 'citacion', count(*), max(fecha_captura) from citacion
#     union all select 'sesion_sala', count(*), max(fecha_captura) from sesion_sala;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select source, count(*) from source_snapshot where source='agenda' group by 1;"   # hoy: vacío
```

---

### W-3: backup-parlamentario

**YAML:** `.github/workflows/backup-parlamentario.yml`
**Schedule:** `0 6 * * 1` (`backup-parlamentario.yml:21`) — lunes 06:00 UTC. Activo.
**Entrypoint invocado:** `backup-parlamentario.yml:63` →
`@obs/identity run seed:live -- --preserve-estado` → `packages/identity/src/seed-cli.ts`;
paso de respaldo a R2 en `backup-parlamentario.yml:86`. **Mismo entrypoint que `roster-weekly`
(W-8)** — dos workflows distintos sobre el mismo CLI, distinguidos por su destino y su gating.
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. El artefacto se produce 1 minuto después de cada
corrida, tres lunes seguidos (P7: commits `5782d8c` 2026-07-27 10:05, `0377ca8` 07-20 09:30,
`40eaf18` 07-13 09:42).

#### Evidencia observada

- **Pata 1 — P2.** `success @ 2026-07-27T10:04:05Z` (`schedule`), precedido de `success` 07-20 y
  07-13, ambos `schedule`. El único `failure` del histórico visible (2026-07-08T22:37:30Z) fue
  disparado por `push`, no por reloj.
- **Pata 2 — SUSTITUIDA, y la sustitución es el hallazgo.** Este workflow **no escribe Supabase**.
  Su bloque `env:` mapea únicamente los 4 `R2_*` (`backup-parlamentario.yml:38-42`, confirmado en
  P4: los `secrets.*` requeridos son sólo `R2_*`) y el propio YAML declara: *"SIN service key
  local en CI → la carga a DB se omite; el snapshot git es autoritativo"*. La pata 2 se corrió
  entonces contra el **destino real** (`backup-parlamentario.yml:60`):
  ```
  5782d8c|2026-07-27 10:05:12 +0000|github-actions[bot]|chore(backup): refrescar snapshot parlamentario (ID-09 cadencia)
  0377ca8|2026-07-20 09:30:11 +0000|github-actions[bot]|…
  40eaf18|2026-07-13 09:42:10 +0000|github-actions[bot]|…
  ```
  Corrida → commit: 10:04→10:05, 09:29→09:30, 09:41→09:42.
  **Control negativo:** la fila `parlamentario` de la DB (`2026-07-27 00:10:53`, P7) **no** es
  atribuible a este cron — su corrida fue a las 10:04, diez horas después. Eso confirma por
  observación que el job no escribe la DB, en vez de asumirlo.
- **Pata 3 — no aplica.** `backup-parlamentario` no está en `packages/freshness/src/catalog.ts`
  (P9: el catálogo cubre 9 fuentes y ninguna es ésta).
- **Pata 4 — parcial.** El paso `:86` sube el seed a R2 (`seed-cli.ts:195` construye el `R2Store`,
  `:201` hace `putImmutable("identity", "parlamentario-seed", date, sha, "json", body)`), pero
  `source_snapshot` no registra fuente `identity` (P10): sin `SnapshotWriter`, el PUT no deja
  traza en DB. La verificación directa del bucket exigiría credenciales R2, fuera del régimen
  de este audit.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Sí | Operativa — `sha256Hex` + `putImmutable` content-addressed | `packages/identity/src/seed-cli.ts:195`, `:201` |
| Etapa-2 desde R2 | No aplica | El destino autoritativo es el snapshot git, no Supabase | `backup-parlamentario.yml:60` |
| Hash-check pre-descarga | Parcial | `existed` (412) se descarta en el destructuring `const { r2Path } = …` | `packages/identity/src/seed-cli.ts:201` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **cumple** — `seed-cli.ts:201`, clave
  `identity/parlamentario-seed/<date>/<sha256>.json`, exactamente el formato
  `fuente/recurso/fecha/sha256.ext` que manda `CLAUDE.md`.
- **Etapa-2 (R2→Supabase):** **no aplica declarado** — el YAML afirma que el snapshot git es
  autoritativo (`:60`) y que la carga a DB se omite por ausencia de service key. Es una decisión
  declarada, no un gap.
- **Hash-check:** **parcial** — el `existed` de `putImmutable` se descarta; no hay short-circuit.
  Inocuo aquí (el seed se regenera igual), pero es la misma omisión que en agenda y probidad.
- **Rate-limit 2-3s:** **cumple** — `HostRateLimiter` inyectado (`seed-cli.ts:5-6`, cabecera:
  *"colaboradores REALES de `@obs/ingest` (Fetcher + HostRateLimiter + RobotsGuard) — política de
  fetch respetuosa (rate-limit 2-3s + UA identificado…)"*).
- **UA identificatorio:** **cumple** — `Bot-Ciudadano/1.0` (`packages/ingest/src/robots.ts:13`).
- **robots.txt:** **cumple** — `RobotsGuard` inyectado (`seed-cli.ts:28`).

#### Gaps de esta unidad

**G5** (`G-snapshot-identity`, PUT a R2 sin traza en `source_snapshot`),
**G3** (`G-cobertura-freshness`, no cubierto por el catálogo). Consolidación en §4.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow backup-parlamentario.yml --limit 5 \
  --json conclusion,event,createdAt
git log -3 --format='%h|%ad|%an|%s' --date=iso -- supabase/seeds/parlamentario.seed.json
grep -n "putImmutable\|sha256Hex" packages/identity/src/seed-cli.ts
grep -n "service key local\|snapshot git" .github/workflows/backup-parlamentario.yml
```

---

### W-4: leyes-weekly

**YAML:** `.github/workflows/leyes-weekly.yml`
**Schedule:** `0 20 * * 1-5` (`leyes-weekly.yml:19`) — L–V 20:00 UTC. Activo.
**Entrypoint invocado:** `leyes-weekly.yml:75` →
`pnpm --filter @obs/tramitacion exec tsx src/run-tramitacion-prod-cli.ts` →
`packages/tramitacion/src/run-tramitacion-prod-cli.ts`. **CLI hermano NO ejecutado:**
`packages/tramitacion/src/ingest-cli.ts` — es el gotcha 57-05 en su forma original. El audit 56
emitió su veredicto citando `ingest-cli.ts:16` ("R2/remoto diferidos"), que **no es lo que el
cron corre**; este audit lo emite sobre `run-tramitacion-prod-cli.ts`, y el resultado cambia.
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. Cinco patas concordantes, incluida la única cadena
dos-etapas completa del proyecto.

#### Evidencia observada

- **Pata 1 — P2.** `success @ 2026-07-27T21:09:03Z` (`schedule`); las 5 más recientes son todas
  `success` por `schedule` en días hábiles consecutivos (07-27, 07-24, 07-23, 07-22, 07-21).
  **Es la unidad con más corridas verdes seguidas del inventario.**
- **Pata 2 — P7.** `proyecto`: 3.659 filas, `max(fecha_captura)` = `2026-07-27 21:38:06.135+00`.
  `tramitacion_evento`: 48.368 filas y `votacion`: 4.855 filas, ambas
  `2026-07-27 21:38:09.718+00`. Escritura ~29 min después del arranque (round-robin acotado).
- **Pata 2b (cursor) — P8.** `leyes_rotacion_estado` singleton con `ultimo_boletin = 16851-14`,
  `fecha_captura` `2026-07-27 21:09:34.69+00` — el cursor de round-robin **gira**. Éste es el
  contraste que hace defendible el veredicto verde frente al `stale` de W-5.
- **Pata 3 — P9.** Dos entradas del catálogo: `leyes` (`catalog.ts:222-226`, tabla `proyecto`,
  `umbralDias: 7`) → `diasDesdeUpsert: 0`, `stale: false`; y `leyes-min-edad`
  (`catalog.ts:246-250`, `umbralDias: 45`) → `19 d`, `stale: false`. Ambas verdes.
- **Pata 4 — P10.** `source_snapshot` source `leyes`: **4.380 filas**, `max(fetched_at)` =
  `2026-07-27 21:38:22.834+00` — 16 segundos después de la última escritura a `tramitacion_evento`.
  Es la **única fuente del proyecto con traza de crudo abundante y al día**.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Sí | Operativa y trazada — `putImmutable` + `SnapshotWriter` | `packages/tramitacion/src/ingest-run.ts:309`; writer en `run-tramitacion-prod-cli.ts:215-218` |
| Etapa-2 desde R2 | Sí | Modo replay `--from-r2` disponible | `packages/tramitacion/src/ingest-cli.ts:200` |
| Hash-check pre-descarga | Sí | `existed=true` (412) → `[skip] sin novedades` y **salto de Etapa 2** | `packages/tramitacion/src/ingest-run.ts:294`, `:330` (contrato en `:90-91`) |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **cumple** — `ingest-run.ts:309` persiste el crudo content-addressed
  **antes** de parsear, y `run-tramitacion-prod-cli.ts:213-218` monta el `SnapshotWriter` sobre
  `SupabaseSnapshotStore` para dejar la traza en `source_snapshot` (comentario del propio archivo:
  *"SnapshotWriter (source_snapshot / FND-08 / CRON-02): solo LIVE con creds Supabase"*).
  Verificado en dato vivo: 4.380 filas (P10).
- **Etapa-2 (R2→Supabase, re-ingest sin tocar fuente):** **cumple** — `ingest-cli.ts:200` documenta
  el `R2Store` como "(Etapa 1, hash-check, `--from-r2`)". Re-ingestar no requiere volver a la
  fuente. **Es la única unidad del inventario que satisface esta regla de punta a punta.**
- **Hash-check:** **cumple** — `ingest-run.ts:294` comenta *"Si existed=true → el contenido no
  cambió → skip Etapa 2 para este…"* y `:330` ejecuta el `if (existed)`. El log emitido es
  `[skip] sin novedades — tramitacion <boletin>` (`:91`). Esto es literalmente el "skip legítimo
  con hash-check" que la taxonomía de §0.4 acepta como **verde**.
- **Rate-limit 2-3s:** **cumple** — `HostRateLimiter` ensamblado en el CLI de producción.
- **UA identificatorio:** **cumple** — `Bot-Ciudadano/1.0` (`packages/ingest/src/robots.ts:13`).
- **robots.txt:** **cumple** — `RobotsGuard` inyectado.

#### Gaps de esta unidad

**Ninguno.** Es la unidad de referencia: cualquier fix de dos-etapas que 119 aplique a las demás
debería converger a esta forma (`putImmutable` con `existed` usado + `SnapshotWriter` +
`--from-r2`).

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow leyes-weekly.yml --limit 5 \
  --json conclusion,event,createdAt
grep -n "existed" packages/tramitacion/src/ingest-run.ts          # 294, 307, 309, 330
grep -n "from-r2" packages/tramitacion/src/ingest-cli.ts          # 200
grep -n "SnapshotWriter" packages/tramitacion/src/run-tramitacion-prod-cli.ts
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select 'proyecto', count(*), max(fecha_captura) from proyecto
#     union all select 'tramitacion_evento', count(*), max(fecha_captura) from tramitacion_evento;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select source, count(*), max(fetched_at) from source_snapshot where source='leyes' group by 1;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select ultimo_boletin, fecha_captura from leyes_rotacion_estado;"
```

---

### W-5: lobby-leylobby-weekly

**YAML:** `.github/workflows/lobby-leylobby-weekly.yml`
**Schedule:** `0 11 * * 3` (`lobby-leylobby-weekly.yml:16`) — miércoles 11:00 UTC. Activo.
**Entrypoint invocado:** `lobby-leylobby-weekly.yml:70` → `src/ingest-cli.ts` →
`packages/lobby/src/ingest-cli.ts`. **CLI hermano NO ejecutado:**
`packages/lobby/src/run-camara-lobby-cli.ts` — el mismo paquete `@obs/lobby` sirve a **dos**
workflows (éste y W-9) con **entrypoints distintos**. Confundirlos invertiría los dos veredictos.
El YAML además **remapea env** (`:57`): `secrets.SUPABASE_API_URL` → `SUPABASE_URL` (Pitfall 5).
Veredicto: **stale**
**Causa raíz del veredicto:** **cursor detenido, no fuente sin novedades.**
`lobby_ingesta_estado.ingestado_hasta` = **2026-06-22** (36 días al 2026-07-28, P8) pese a que la
corrida del **2026-07-22** fue `success` (P2) y `lobby_audiencia` recibió filas ese mismo día
(`2026-07-22 12:44:05.343+00`, P7). El cursor que **sí** avanzó es
`leylobby_cursor_estado` (`fecha_captura` `2026-07-22 12:44:06.340612+00`, P8): dos cursores para
la misma fuente, desincronizados. El código explica por qué son dos y no uno —
`packages/lobby/src/cursor-leylobby.ts:3` y `:8`: *"Cursor y hash-check son complementarios"*—
pero nada mantiene `lobby_ingesta_estado` al día.

#### Evidencia observada

- **Pata 1 — P2.** `success @ 2026-07-22T12:43:27Z` (`schedule`). Las 4 corridas del histórico son
  **todas** `success`, en miércoles consecutivos: 07-22, 07-15, 07-08, 07-01. **La corrida no es
  el problema.** (Al 2026-07-28, martes, el miércoles siguiente —07-29— aún no llegaba: no hay
  ventana perdida.)
- **Pata 2 — P7 + P8, y aquí es donde se rompe.** `lobby_audiencia`: 17.762 filas,
  `max(fecha_captura)` = `2026-07-22 12:44:05.343+00` → **hay escritura fresca**. Pero
  `lobby_ingesta_estado`: 136 filas, `max(ingestado_hasta)` = `2026-06-22`, `max(fecha_captura)` =
  `2026-06-22 19:18:08.428172+00` → **el marcador lleva 36 días congelado**.
- **Discriminante Pitfall 4 aplicado.** El contraste que resuelve "skip legítimo vs cursor
  detenido" es interno a la propia fuente: `leylobby_cursor_estado` avanzó el 07-22 y
  `lobby_ingesta_estado` no. Si la fuente no hubiera tenido novedades, **ninguno** de los dos
  habría avanzado. Que uno avance y el otro no descarta "sin novedades honesto".
  Contraprueba positiva en W-6: `probidad_ingesta_estado.ingestado_hasta` = 2026-07-23, el día de
  su corrida — el mismo tipo de tabla, actualizada correctamente por otro conector.
- **Pata 3 — P9.** Entrada `lobby-leylobby` (`catalog.ts:271-275`, tabla **`lobby_ingesta_estado`**,
  `umbralDias: 7`): `ultimoUpsert: "2026-06-22"`, `diasDesdeUpsert: 36`, **`stale: true`**,
  `ghRun: "success @ 2026-07-22"`. **Sin discrepancia freshness↔fila real**: la señal lee
  exactamente la tabla congelada, y por eso acierta. Es la única de las 9 entradas del catálogo
  que apunta a una tabla de *cursor* en vez de a una tabla de *datos* — y es la única que detecta
  una avería real. Contrástese con `lobby-camara` (W-9) y `fichas` (W-11), que miran tablas de
  datos llenadas por otro cron y por eso reportan verde en falso.
- **Pata 4 — P10.** `source_snapshot` **no** registra `lobby-leylobby`, pese a que el conector sí
  hace `putImmutable` (ver abajo). PUT sin traza: §1.6 punto 4.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Sí | Operativa (sin `SnapshotWriter` → sin traza en DB) | `packages/lobby/src/ingest-run.ts:138`; store en `ingest-cli.ts:161-174` |
| Etapa-2 desde R2 | Sí | Modo `--from-r2` disponible | `packages/lobby/src/ingest-cli.ts:161` |
| Hash-check pre-descarga | Sí | `existed=true` → `[skip] sin novedades — leylobby <clave>` + salto de Etapa 2 | `packages/lobby/src/ingest-run.ts:132`, `:146-147` (contrato en `:65`) |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **cumple** — `ingest-run.ts:138` (`putImmutable`), con `R2Store`
  construido desde env en `ingest-cli.ts:161-174` y **guard fail-closed** en `:174`
  (`if (!r2Store && !dryRun)`), que impide correr en vivo sin crudo. Buen patrón.
- **Etapa-2 (R2→Supabase):** **cumple** — `ingest-cli.ts:161` documenta `--from-r2`; el replay
  existe.
- **Hash-check:** **cumple** — `ingest-run.ts:132` (*"Si existed=true → el contenido no cambió →
  skip Etapa 2 para esta tarea"*), `:146-147` emite `[skip] sin novedades`.
- **Rate-limit 2-3s:** **cumple** — `new HostRateLimiter()` en `ingest-cli.ts:183`.
- **UA identificatorio:** **cumple** — `Bot-Ciudadano/1.0` (`packages/ingest/src/robots.ts:13`).
- **robots.txt:** **cumple** — `new RobotsGuard({ allowlist: {} })` en `ingest-cli.ts:184`.

> **Lectura importante:** el compliance dos-etapas de esta unidad es de los mejores del inventario
> y aun así su veredicto es `stale`. Cumplir la regla LOCKED no garantiza que el cron esté sano:
> son ejes independientes, y por eso el documento los reporta por separado.

#### Gaps de esta unidad

**G1** (`G-cursor-lobby`, **P1**, el hallazgo central del audit) — `lobby_ingesta_estado` sin
avanzar desde 2026-06-22; **G5** (`G-snapshot-leylobby`) — Etapa-1 sin `SnapshotWriter`.
Priorización en §4.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow lobby-leylobby-weekly.yml --limit 5 \
  --json conclusion,event,createdAt
# El corazón del veredicto: los DOS cursores, lado a lado.
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select 'lobby_ingesta_estado', count(*)::text, max(ingestado_hasta)::text, max(fecha_captura)::text
#      from lobby_ingesta_estado
#     union all select 'leylobby_cursor_estado', count(*)::text, null, max(fecha_captura)::text
#      from leylobby_cursor_estado
#     union all select 'lobby_audiencia', count(*)::text, null, max(fecha_captura)::text
#      from lobby_audiencia;"
grep -n "existed\|skip. sin novedades" packages/lobby/src/ingest-run.ts
grep -n "cursor" packages/lobby/src/cursor-leylobby.ts | head
```

---

### W-6: probidad-weekly

**YAML:** `.github/workflows/probidad-weekly.yml`
**Schedule:** `0 11 * * 4` (`probidad-weekly.yml:16`) — jueves 11:00 UTC. Activo.
**Entrypoint invocado:** `probidad-weekly.yml:74` → `src/run-probidad-todos-cli.ts` →
`packages/probidad/src/run-probidad-todos-cli.ts` (que orquesta
`packages/probidad/src/run-probidad-todos.ts`). El paquete no expone CLI hermano de ingesta.
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. Cursor **avanzando**, que es justo lo que le falta a W-5.

#### Evidencia observada

- **Pata 1 — P2.** `success @ 2026-07-23T12:26:11Z` (`schedule`), precedido de `success` 07-16
  (`schedule`) y 07-15 (`workflow_dispatch`). Hay **dos `failure` más antiguos** (2026-07-09 y
  2026-07-02, ambos `schedule`) que la corrida verde posterior deja superados: el histórico
  muestra recuperación, no avería vigente.
  *Ventana:* su día es jueves; al 2026-07-28 (martes) el jueves siguiente —07-30— aún no llegaba.
  Cero ventanas perdidas.
- **Pata 2 — P7.** `declaracion`: 1.065 filas, `max(fecha_captura)` = `2026-07-23 12:37:05.518+00`
  (11 min tras el arranque).
- **Pata 2b (cursor) — P8.** `probidad_ingesta_estado`: 136 filas,
  `max(ingestado_hasta)` = **`2026-07-23`**, coincidente con el día de la corrida. **El marcador
  avanza.** Es la contraprueba directa del `stale` de W-5: misma familia de tabla
  (`*_ingesta_estado`), mismo día de lectura, comportamiento opuesto.
  *(Nota de lectura: el `max(fecha_captura)` de esa tabla marca 2026-06-22 19:42 — es la fecha de
  poblado inicial de las 136 filas; la columna que registra el avance del barrido es
  `ingestado_hasta`, y es la que el catálogo y este veredicto usan.)*
- **Pata 3 — P9.** Entrada `probidad` (`catalog.ts:279-283`, tabla `declaracion`,
  `umbralDias: 30`): `diasDesdeUpsert: 5`, `stale: false`, `ghRun: "success @ 2026-07-23"`.
- **Pata 4 — P10.** `source_snapshot` source `infoprobidad`: **3 filas**, `max(fetched_at)` =
  `2026-07-23 12:37:12.157+00` — 7 segundos después de la escritura a `declaracion`. Es la
  **segunda y última** fuente con traza de crudo en DB.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Sí | Operativa y **trazada** (`SnapshotWriter` montado) | `packages/probidad/src/run-probidad-todos.ts:149`; writer en `run-probidad-todos-cli.ts:147-150` |
| Etapa-2 desde R2 | No | Sin ruta de replay `--from-r2` | `packages/probidad/src/run-probidad-todos-cli.ts` (sin flag) |
| Hash-check pre-descarga | Parcial | `existed` descartado: `({ r2Path } = await opts.r2Store.putImmutable(…))` | `packages/probidad/src/run-probidad-todos.ts:149` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **cumple** — `run-probidad-todos.ts:145` (`if (opts.r2Store)`) y `:149`
  (`putImmutable`); `R2Store` construido en `run-probidad-todos-cli.ts:135-143` y
  `SnapshotWriter`/`SupabaseSnapshotStore` en `:147-150`, con el comentario *"Provenance run-level
  (source_snapshot) — solo LIVE y con creds Supabase"*. **Confirmado en dato vivo** (3 filas, P10).
- **Etapa-2 (R2→Supabase):** **no cumple** — no hay `--from-r2`. Re-ingestar exigiría volver a
  infoprobidad. Mismo gap que agenda (W-2).
- **Hash-check:** **parcial** — el `existed` de `putImmutable` se descarta en el destructuring
  (`run-probidad-todos.ts:149`); no hay `[skip] sin novedades`. Compárese con `tramitacion`
  (`ingest-run.ts:330`) y `lobby` (`ingest-run.ts:146`), que sí lo usan.
- **Rate-limit 2-3s:** **cumple** — `new HostRateLimiter()` en `run-probidad-todos-cli.ts:114`.
- **UA identificatorio:** **cumple** — `Bot-Ciudadano/1.0` (`packages/ingest/src/robots.ts:13`).
- **robots.txt:** **cumple** — `new RobotsGuard({ allowlist: {} })` en `run-probidad-todos-cli.ts:115`.

#### Gaps de esta unidad

**G7** (`G-etapa2-probidad`, sin `--from-r2`), **G6** (`G-hashcheck-probidad`, `existed` descartado).
Ninguno afecta el veredicto verde: son deuda de arquitectura de ingesta, no de salud del cron.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow probidad-weekly.yml --limit 5 \
  --json conclusion,event,createdAt
grep -n "putImmutable\|r2Store" packages/probidad/src/run-probidad-todos.ts
grep -n "SnapshotWriter\|HostRateLimiter\|RobotsGuard" packages/probidad/src/run-probidad-todos-cli.ts
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select count(*), max(fecha_captura) from declaracion;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select max(ingestado_hasta) from probidad_ingesta_estado;"   # debe seguir a la última corrida
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select source, count(*), max(fetched_at) from source_snapshot where source='infoprobidad' group by 1;"
```

---

### W-7: digest-daily

**YAML:** `.github/workflows/digest-daily.yml`
**Schedule:** **sin schedule activo — bloque COMENTADO** en `digest-daily.yml:24-25`
(`# schedule:` / `#   - cron: "0 12 * * 1-5"  # L-V 12:00 UTC — descomentar SOLO tras corrida
manual VERDE`). Trigger real: `workflow_dispatch: {}` (`:23`).
**Entrypoint invocado:** dos pasos encadenados — `digest-daily.yml:69` →
`src/run-confirmaciones-prod-cli.ts`, y `digest-daily.yml:85` → `src/run-digest-prod-cli.ts`
(ambos en `packages/notificaciones/src/`).
Veredicto: no-cron
**Causa raíz del veredicto:** **estreno gated por diseño**, declarado en
`digest-daily.yml:17`: *"ESTRENO GATED (mirror roster-weekly): se estrena con workflow_dispatch
SOLO (schedule…)"*. Refuerzo independiente: los 4 secrets `NOTIF_*`/`RESEND_API_KEY` **no están
cargados** en el repo (P4) — el workflow no podría correr aunque se descomentara.

#### Evidencia observada

- **Pata 1 — P2.** `gh run list --workflow digest-daily.yml` devuelve **`[]`**: cero corridas
  registradas. Es dato observado, no fallo del probe (`backfill.yml` y `fichas-backfill.yml`
  devuelven lo mismo).
- **Pata 2 — P7.** `notificacion_envio`: **0 filas**, `max(created_at)` vacío. Coherente con el
  gating: nunca se envió un digest.
  *Nota de columna:* el RESEARCH asumía `creado_en`; la columna real es `created_at`
  (`information_schema` en P7). Se corrigió antes de correr el lote.
- **Pata 3 — no aplica.** `digest-daily` no está en `packages/freshness/src/catalog.ts` (P9). Aquí
  la ausencia es coherente: no hay ingesta que vigilar.
- **Pata 4 — no aplica.** No toca fuentes externas: lee Supabase y envía correo vía Resend.
- **Secrets — P4.** Requeridos: `NOTIF_BASE_URL`, `NOTIF_FROM`, `NOTIF_TOKEN_SECRET`,
  `RESEND_API_KEY`, `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`. **Ausentes los cuatro primeros.**
  Estado esperado (NOTIF parked, flag OFF), registrado en §1.5.

#### DOS ETAPAS compliance

**No aplica** — `digest-daily` no es un conector de ingesta: no descarga de ninguna fuente
gubernamental ni persiste crudo. Consume datos ya ingeridos y produce correo. Las seis viñetas
(Etapa-1 / Etapa-2 / hash-check / rate-limit / UA / robots.txt) carecen de objeto, y se declara
así en vez de omitir el bloque.

#### Gaps de esta unidad

Ninguno **como cron**. Su pendiente (`NOTIF_*` + descomentar el schedule) es del milestone de
notificaciones, no de 119. Registrado en §1.5 como estado esperado precisamente para que 119 no
lo tome como backlog.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow digest-daily.yml --limit 5 --json conclusion,createdAt
sed -n '17,26p' .github/workflows/digest-daily.yml      # el schedule comentado, verbatim
gh secret list --repo Cuchecorp/gov-map                  # NOMBRES; los NOTIF_* deben seguir ausentes
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select count(*), max(created_at) from notificacion_envio;"   # hoy: 0 |
```

---

### W-8: roster-weekly

**YAML:** `.github/workflows/roster-weekly.yml`
**Schedule:** **sin schedule activo — bloque COMENTADO** en `roster-weekly.yml:29-30`
(`# schedule:` / `#   - cron: "0 10 * * 1"  # lunes 10:00 UTC — añadir SOLO tras corrida manual
VERDE`). Trigger real: `workflow_dispatch: {}` (`:28`).
**Entrypoint invocado:** `roster-weekly.yml:71` → `@obs/identity run seed:live --
--preserve-estado` → `packages/identity/src/seed-cli.ts`. **Mismo CLI que W-3**, distinguido por
el remapeo de env (`secrets.SUPABASE_API_URL` → `SUPABASE_LOCAL_URL`, P4) y por el destino.
Veredicto: no-cron
**Causa raíz del veredicto:** **estreno gated por diseño**, declarado en `roster-weekly.yml:16`:
*"ESTRENO GATED: workflow_dispatch SOLO (sin schedule). Validar con corrida manual VERDE."*

#### Evidencia observada

- **Pata 1 — P2.** Dos corridas en todo el histórico, ambas `workflow_dispatch`:
  `success @ 2026-07-15T21:47:55Z` y, dos minutos antes, `failure @ 2026-07-15T21:45:40Z`
  (el patrón típico de un estreno: falla, se corrige, verde). **Ninguna corrida `schedule`.**
- **Pata 2 — P7, con control negativo explícito.** `parlamentario`: 186 filas,
  `max(fecha_captura)` = `2026-07-27 00:10:53.196+00`; `parlamentario_militancia`: 363 filas,
  misma marca. **Esa escritura NO es atribuible a este workflow**: su última corrida fue el
  2026-07-15, doce días antes. Proviene de una ejecución fuera de GH Actions (operador local).
  Se declara el no-atribuible en vez de contar la fila como evidencia a favor — es justo el error
  que la regla "veredicto sólo con evidencia observada" busca evitar.
- **Pata 3 — no aplica.** No está en `packages/freshness/src/catalog.ts` (P9).
- **Pata 4 — parcial.** Comparte con W-3 la Etapa-1 de `seed-cli.ts:195`/`:201`; sin
  `SnapshotWriter`, sin traza en `source_snapshot` (P10).
- **Secrets — P4.** `SUPABASE_API_URL` y `SUPABASE_SECRET_KEY`, **ambos presentes**, remapeados a
  `SUPABASE_LOCAL_URL`/`SUPABASE_LOCAL_SERVICE_KEY` en el bloque `env:`. Comparar por el nombre de
  la variable de entorno (y no por el lado `secrets.*`) habría producido un falso "secret ausente"
  — Pitfall 5 evitado.

#### DOS ETAPAS compliance

Hereda íntegramente el análisis de **W-3** (mismo `seed-cli.ts`): Etapa-1 **cumple**
(`seed-cli.ts:201`), Etapa-2 **no aplica** (snapshot git autoritativo), hash-check **parcial**
(`existed` descartado), rate-limit / UA / robots.txt **cumplen** (`seed-cli.ts:5-6`, `:27-29`).
No se repite el detalle para no duplicar la fuente de verdad.

#### Gaps de esta unidad

Ninguno **como cron** (gating declarado). Contribuye a **G5** (`G-snapshot-identity`), compartido
con W-3.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow roster-weekly.yml --limit 5 \
  --json conclusion,event,createdAt
sed -n '16,31p' .github/workflows/roster-weekly.yml     # el gating y el schedule comentado
grep -n "secrets\." .github/workflows/roster-weekly.yml # el remapeo de env (Pitfall 5)
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select 'parlamentario', count(*), max(fecha_captura) from parlamentario;"
#   # si la marca NO coincide con una corrida de gh, la escritura viene de fuera de Actions
```

---

### W-9: lobby-camara-weekly

**YAML:** `.github/workflows/lobby-camara-weekly.yml`
**Schedule:** **sin `schedule:` — deshabilitado a propósito**, causa declarada en
`lobby-camara-weekly.yml:14-17`. Trigger real: `workflow_dispatch:` (`:19`). El nombre dice
"weekly" y el archivo no tiene reloj: el CONTEXT (`118-CONTEXT.md:71`) lo marcó como candidato a
gap y **la observación lo resuelve como decisión declarada**.
**Entrypoint invocado:** `lobby-camara-weekly.yml:67` →
`src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html`, precedido de un paso `curl`
(`:52`). **CLI hermano NO ejecutado:** `packages/lobby/src/ingest-cli.ts` (el de W-5). Mismo
paquete, entrypoint distinto.
Veredicto: no-cron
**Causa raíz del veredicto:** **decisión declarada, NO gap.** `lobby-camara-weekly.yml:14-17`
documenta el WAF de camara.cl como razón para retirar el `schedule:`; el fallback operativo vive
en `docs/runbooks/cron-local-fallback.md`. Es el gap G7 del audit 56, ya convertido en decisión.

#### Evidencia observada

- **Pata 1 — P2 + P3.a.** Sólo **dos** corridas en el histórico, ambas `failure` y ambas
  `schedule`: 2026-07-07T13:17:09Z y 2026-06-30T13:08:36Z. **Desde entonces, cero corridas** —
  consistente con la deshabilitación del `schedule:` tras el segundo fallo.
  Log del fallo (P3.a, recortado a las líneas de error):
  ```
  lobby-camara  … echo "lobby.html = $SIZE bytes"
  lobby-camara  … if [ "$SIZE" -lt 10240 ]; then echo "WAF/respuesta < 10KB"; exit 1; fi
  lobby-camara  … lobby.html = 5463 bytes
  lobby-camara  … WAF/respuesta < 10KB
  lobby-camara  … ##[error]Process completed with exit code 1.
  ```
  El guard del propio YAML detectó el intercept del WAF (5.463 bytes ≠ página real) y abortó
  **antes** del CLI. La causa observada coincide exactamente con la causa declarada en `:14-17`.
- **Pata 2 — P7, y aquí está el hallazgo estructural.** `lobby_audiencia`:
  `max(fecha_captura)` = `2026-07-22 12:44:05.343+00` — **fresca, pero escrita por W-5**, no por
  esta unidad, cuya última (fallida) corrida fue el 2026-07-07 y ni siquiera llegó al CLI.
- **Pata 3 — P9, señal engañosa.** Entrada `lobby-camara` (`catalog.ts:263-267`, tabla
  **`lobby_audiencia`**, `umbralDias: 14`): `diasDesdeUpsert: 6`, **`stale: false`** — pero el
  mismo objeto JSON trae `ghRun: "failure @ 2026-07-07"`. La señal reporta verde **gracias al
  trabajo de otro cron**: mide una tabla que llena `lobby-leylobby`. Es estructuralmente incapaz
  de detectar la avería del cron que dice vigilar (§1.6 punto 7). Sólo el campo `ghRun` delata el
  problema, y no participa del cálculo de `stale`.
- **Pata 4 — P10.** `source_snapshot` no registra `lobby-camara` (nunca llegó a descargar nada).
- **Secrets — P4.** Requeridos: 4 `R2_*` + `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`.
  **Todos presentes.** El bloqueo es de red (WAF), no de credencial: se descarta esa hipótesis
  con dato, no por descarte lógico.

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Parcial | Código presente; inalcanzable en CI porque el WAF corta antes del CLI | `packages/lobby/src/run-camara-lobby.ts:102`; store en `run-camara-lobby-cli.ts:112-114` |
| Etapa-2 desde R2 | No | El CLI lee `--html-file /tmp/lobby.html`, no R2 | `.github/workflows/lobby-camara-weekly.yml:67` |
| Hash-check pre-descarga | Parcial | El `curl` del YAML no manda `If-None-Match`/`If-Modified-Since`; el `[skip]` existe pero río abajo | `lobby-camara-weekly.yml:52`; skip en `run-camara-lobby.ts:102` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **parcial** — `R2Store` se construye en `run-camara-lobby-cli.ts:112-114`
  y se inyecta en `:138`; el `[skip] sin novedades — camara-lobby listadodeaudiencias` de
  `run-camara-lobby.ts:102` prueba que la ruta de crudo existe. Pero en CI nunca se ejecuta: el
  paso `curl` falla primero.
- **Etapa-2 (R2→Supabase):** **no cumple** — el flujo entra por `--html-file` (archivo local
  producido por `curl`), no por R2. Re-ingestar exigiría volver a camara.cl… que es precisamente
  lo bloqueado. **Aquí la regla LOCKED de `CLAUDE.md` habría pagado sola su costo:** con una
  Etapa-2 desde R2, el crudo de las corridas exitosas anteriores sería re-procesable sin tocar la
  fuente.
- **Hash-check:** **parcial** — el `curl` de `:52` descarga incondicionalmente; el hash-check vive
  después, en el CLI.
- **Rate-limit 2-3s:** **cumple** — `new HostRateLimiter()` en `run-camara-lobby-cli.ts:103`
  (cabecera `:4-5`: *"colaboradores REALES … en el ORDEN LOCKED"*); el `curl` es un request único
  por corrida.
- **UA identificatorio:** **cumple** — `curl -sS -A 'Bot-Ciudadano/1.0'`
  (`lobby-camara-weekly.yml:52`, documentado en `:8`).
- **robots.txt:** **cumple** — `new RobotsGuard({ allowlist: {} })` en `run-camara-lobby-cli.ts:104`.

#### Gaps de esta unidad

**G4** (`G-freshness-enganosa-camara`, §1.6 punto 7: la señal mide `lobby_audiencia`, llenada por
W-5) y **G7** (`G-etapa2-camara`, entrada por `--html-file` en vez de R2, que dejaría el fallback
local re-procesable). El WAF en sí **no** es gap: es decisión declarada (§1.5).

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow lobby-camara-weekly.yml --limit 5 \
  --json conclusion,event,createdAt                      # 2 filas, ambas failure, ninguna nueva
gh run view 28869169412 --repo Cuchecorp/gov-map --log-failed | \
  grep -iE "##\[error\]|bytes|WAF" | head -12
sed -n '14,17p' .github/workflows/lobby-camara-weekly.yml   # la causa declarada
sed -n '52,54p' .github/workflows/lobby-camara-weekly.yml   # el guard de 10240 bytes
grep -n "workflowYml\|tabla" packages/freshness/src/catalog.ts | sed -n '/26[0-9]/p'  # ~263-267
```

---

### W-10: backfill

**YAML:** `.github/workflows/backfill.yml`
**Schedule:** sin `schedule:` — `on: workflow_dispatch:` (`backfill.yml:11-12`).
**Entrypoint invocado:** `backfill.yml:50-54` → `deno run … ingest-worker/backfill.ts`. Es la
**única unidad que corre Deno** en vez de tsx/pnpm.
Veredicto: no-cron
**Causa raíz del veredicto:** **dispatch manual por diseño**, declarado en `backfill.yml:7`:
*"snapshot inicial. Disparo manual (workflow_dispatch) — NO programado."* Refuerzo normativo:
`CLAUDE.md` §Ingesta y Cron regla 4 manda **"Backfill masivo = LOCAL (operador), NO GitHub
Actions (minimizar minutos)"**. Este workflow no sólo no está programado: no *debe* estarlo.

#### Evidencia observada

- **Pata 1 — P2.** `gh run list --workflow backfill.yml` → **`[]`**. Cero corridas en todo el
  histórico. Consistente con la regla 4 de `CLAUDE.md`: el backfill se hace localmente.
- **Pata 2 — no aplica.** Sin corridas no hay escritura que atribuir. Las tablas que tocaría
  (`proyecto` et al.) están pobladas por `leyes-weekly` (W-4) y por backfills locales del
  operador; ninguna fila es atribuible a esta unidad.
- **Pata 3 — no aplica.** No está en `packages/freshness/src/catalog.ts` (P9).
- **Pata 4 — no aplica.** Sin corridas, sin crudo producido por esta vía.
- **Secrets — P4.** Requeridos: 4 `R2_*` + `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`.
  **Todos presentes** — está listo para dispararse si el operador lo decidiera; no corre por
  política, no por falta de credencial.

#### DOS ETAPAS compliance

**Declarado por su naturaleza:** el worker de backfill sí es un conector de ingesta (Deno,
`ingest-worker/backfill.ts`), pero **no se ha ejecutado nunca desde CI** y `CLAUDE.md` lo destina
a corrida local. Auditar su compliance dos-etapas por lectura de código sería emitir juicio sin
evidencia observada — exactamente lo que el criterio de éxito de 118 prohíbe. Se declara
**fuera de alcance de este audit** y se deja como nota para 119, que puede auditarlo bajo régimen
de corrida local.

#### Gaps de esta unidad

Ninguno. La ausencia de schedule es cumplimiento de `CLAUDE.md`, no omisión.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow backfill.yml --limit 5 --json conclusion,createdAt  # []
sed -n '5,13p' .github/workflows/backfill.yml     # "Disparo manual … NO programado"
grep -n "Backfill masivo = LOCAL" CLAUDE.md
```

---

### W-11: fichas-backfill

**YAML:** `.github/workflows/fichas-backfill.yml`
**Schedule:** sin `schedule:` — `on: workflow_dispatch:` (`fichas-backfill.yml:10-11`).
**Entrypoint invocado:** `fichas-backfill.yml:81` → `src/pipeline-cli.ts` →
`packages/fichas/src/pipeline-cli.ts`.
Veredicto: no-cron
**Causa raíz del veredicto:** **backfill manual por diseño**, declarado en
`fichas-backfill.yml:8`: *"(workflow_dispatch) — NO programado. Todos los secrets vía
`${{ secrets.* }}`, jamás en claro."*

#### Evidencia observada

- **Pata 1 — P2.** `gh run list --workflow fichas-backfill.yml` → **`[]`**. Cero corridas.
- **Pata 2 — P7, no atribuible.** Las tablas del pipeline (`proyecto_ficha`,
  `proyecto_embedding`) tienen datos —P9 reporta cobertura de fichas 3.657/3.659, idea matriz
  1.504/3.659 (41 %), embeddings 3.100/3.659 (85 %)— pero **ninguna fila procede de este
  workflow**, que nunca corrió. Provienen de corridas locales del operador (memoria de proyecto:
  pipeline por `--boletines` explícito).
- **Pata 3 — P9, señal engañosa (segundo caso).** Entrada `fichas` (`catalog.ts:287-291`, tabla
  **`proyecto`**, `umbralDias: 30`, `workflowYml: "fichas-backfill.yml"`): `diasDesdeUpsert: 0`,
  **`stale: false`**, y sin embargo `ghRun: "n/d (sin corridas)"`. Mide `proyecto`, que llena
  `leyes-weekly` (W-4). Verde prestado (§1.6 punto 7).
- **Pata 4 — P10.** `source_snapshot` no registra `fichas`.
- **Secrets — P4.** Requeridos: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, 4 `R2_*`,
  `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`.
  **Ausentes: `GEMINI_API_KEY` y `SUPABASE_URL`.** Irrelevante mientras no corra, pero significa
  que **un dispatch hoy fallaría**: dato útil para 119, registrado sin inflarlo a veredicto
  `roto` (un workflow que nunca se dispara no puede estar roto en el sentido de la taxonomía).

#### Cadena de ingesta

| Etapa | Implementada | Estado | Archivo:Línea |
|-------|-------------|--------|---------------|
| Etapa-1 fuente→R2 | Sí (código) | Nunca ejercitada desde CI | `packages/fichas/src/pipeline-cli.ts:181` (`new R2Store`); target en `packages/fichas/src/texto-fuente.ts:45` |
| Etapa-2 desde R2 | No | Sin ruta `--from-r2` | `packages/fichas/src/pipeline-cli.ts` (sin flag) |
| Hash-check pre-descarga | Parcial | El target expone `existed`, sin short-circuit observado | `packages/fichas/src/texto-fuente.ts:45` |

#### DOS ETAPAS compliance

- **Etapa-1 (fuente→R2):** **cumple en código, no ejercitada** — `pipeline-cli.ts:181` construye
  el `R2Store` y `texto-fuente.ts:45` declara el contrato
  `Promise<{ r2Path: string; existed: boolean }>`. Sin corridas en CI, no hay evidencia observada
  de que funcione en ese entorno; el juicio se limita a lo verificable.
- **Etapa-2 (R2→Supabase):** **no cumple** — sin modo replay.
- **Hash-check:** **parcial** — `existed` disponible en el contrato, sin uso observado.
- **Rate-limit 2-3s:** **cumple** — `new HostRateLimiter()` en `pipeline-cli.ts:161`, inyectado al
  `SenadoConnector` (`:168`) y al resto (`:220`).
- **UA identificatorio:** **cumple** — `Bot-Ciudadano/1.0` (`packages/ingest/src/robots.ts:13`).
- **robots.txt:** **cumple** — `new RobotsGuard({ allowlist: {} })` en `pipeline-cli.ts:162`.

#### Gaps de esta unidad

**G4** (`G-freshness-enganosa-fichas`, §1.6 punto 7) y **G9** (`G-secrets-fichas`,
`GEMINI_API_KEY` / `SUPABASE_URL` ausentes ⇒ un dispatch fallaría). Consolidación en §4.

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow fichas-backfill.yml --limit 5 --json conclusion  # []
gh secret list --repo Cuchecorp/gov-map | grep -E "GEMINI|SUPABASE_URL"   # hoy: sin coincidencias
grep -n "R2Store\|HostRateLimiter\|RobotsGuard" packages/fichas/src/pipeline-cli.ts
sed -n '285,292p' packages/freshness/src/catalog.ts     # la entrada `fichas` → tabla `proyecto`
```

---

### W-12: ci

**YAML:** `.github/workflows/ci.yml`
**Schedule:** ninguno — `on: push:` (`ci.yml:11-12`) + `pull_request:` (`:14`). **Disparo por
eventos de repositorio, no por reloj.**
**Entrypoint invocado:** `ci.yml:49` (`pnpm --filter ./app test`), `:52` (`tsc --noEmit`),
`:60` (vitest `@obs/llm`), `:65` (vitest `@obs/cruces`). No hay entrypoint de ingesta.
Veredicto: no-cron
**Causa raíz del veredicto:** no es ingesta programada — su bloque `on:` (`ci.yml:11-14`) no
contiene `schedule:`. Se dispara por `push`/`pull_request`.

#### Evidencia observada

- **Pata 1 — P2.** `success @ 2026-07-27T19:20:26Z`, `event: pull_request`
  (`displayTitle: "chore(deps): bump actions/checkout from 4.3.1 to 7.0.1"` — un PR de Dependabot,
  es decir de PM-1). Las 5 más recientes son `success`, mezcla de `pull_request` y `push`.
  **Doble utilidad:** además de clasificar esta unidad, estas corridas son parte de la evidencia
  de que el billing de GH Actions **no** está bloqueado (P5).
- **Pata 2 — no aplica.** CI no escribe datos: corre tests y typecheck. No hay tabla destino.
- **Pata 3 — no aplica.** No está ni debe estar en `packages/freshness/src/catalog.ts`.
- **Pata 4 — no aplica.** No descarga nada de ninguna fuente.
- **Secrets — P4.** **Ninguno requerido** (`grep -oE 'secrets\.[A-Z0-9_]+' ci.yml` → vacío):
  la suite corre sin credenciales, que es lo correcto para CI de un repo público.

#### DOS ETAPAS compliance

**No aplica** — no es un conector. Las seis viñetas carecen de objeto.

#### Gaps de esta unidad

Ninguno en el alcance de este audit (la salud de la suite de tests no es materia de CRON-01).

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow ci.yml --limit 5 \
  --json conclusion,event,createdAt,displayTitle
sed -n '11,15p' .github/workflows/ci.yml           # `on:` sin schedule
grep -oE 'secrets\.[A-Z0-9_]+' .github/workflows/ci.yml | sort -u   # vacío
```

---

### W-13: deploy-cloudflare

**YAML:** `.github/workflows/deploy-cloudflare.yml`
**Schedule:** sin `schedule:` — `on: workflow_dispatch:` (`deploy-cloudflare.yml:19-20`).
**Entrypoint invocado:** `deploy-cloudflare.yml:61` → `pnpm run deploy` (wrangler). No es
ingesta.
Veredicto: no-cron
**Causa raíz del veredicto:** **deploy manual por diseño**, declarado en
`deploy-cloudflare.yml:6`: *"reproducibles. Disparo MANUAL (workflow_dispatch), deliberado…"*.

> **Distinción que importa:** esta unidad tiene la corrida más reciente en `failure`, y aun así
> **no** es `roto`. `roto` es un juicio sobre *ingesta programada*; ésta no es ninguna de las dos
> cosas. Su fallo es **deuda de operador (110-02)**, y así se clasifica — evitando inflar la
> cuenta de crons rotos con un problema que no lo es.

#### Evidencia observada

- **Pata 1 — P2 + P3.b.** Una sola corrida en el histórico:
  **`failure` @ 2026-07-09T14:59:38Z**, `event: workflow_dispatch`.
  Log (P3.b, recortado):
  ```
  deploy  …   CLOUDFLARE_API_TOKEN:
  deploy  …   CLOUDFLARE_ACCOUNT_ID:
  deploy  … ✘ [ERROR] In a non-interactive environment, it's necessary to set a
          CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
  deploy  … ERROR Wrangler deploy command failed:
  deploy  … ##[error]Process completed with exit code 1.
  ```
  Las dos primeras líneas muestran el **nombre seguido de nada**: las variables se expanden
  vacías. No hay valor que redactar porque no existe.
- **Pata 2 — no aplica.** Un deploy no escribe tablas de datos.
- **Pata 3 — no aplica.** No está en el catálogo de freshness (ni corresponde).
- **Pata 4 — no aplica.** No descarga de fuentes.
- **Secrets — P4.** Requeridos: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.
  **Ambos ausentes.** Esto **cierra la Open Question 3 del RESEARCH con dato fechado: la deuda
  de operador 110-02 sigue ABIERTA al 2026-07-28.**
- **Contexto que evita el falso alarmismo:** el deploy real de producción se hace **localmente**
  con wrangler vía OAuth (memoria de proyecto: "creds CF NO en .env"). El sitio no está caído por
  esto; lo que falta es la vía automatizada.

#### DOS ETAPAS compliance

**No aplica** — no es un conector de ingesta.

#### Gaps de esta unidad

**G8** (`G-deuda-110-02`) — clasificación **P2 (deuda de operador)**, no P0/P1: no bloquea ninguna
ingesta y tiene vía alternativa funcionando. Es el insumo del checkpoint de operador de 118-03,
que ya tiene su evidencia fechada lista (P3.b + P4).

#### Cómo re-verificar

```bash
gh run list --repo Cuchecorp/gov-map --workflow deploy-cloudflare.yml --limit 5 \
  --json conclusion,event,createdAt
gh run view 29027652583 --repo Cuchecorp/gov-map --log-failed | tail -18
gh secret list --repo Cuchecorp/gov-map | grep -i cloudflare   # hoy: sin coincidencias
sed -n '5,8p' .github/workflows/deploy-cloudflare.yml          # "Disparo MANUAL … deliberado"
```

---

### PM-1: Dependabot Updates (id 314034212)

**YAML:** **ninguno** — no versionado en `.github/workflows/`. Gestionado por la plataforma
GitHub a partir de la configuración de Dependabot del repositorio.
**Schedule:** gestionado por GitHub; no expresable como `cron:` en un archivo del repo.
**Entrypoint invocado:** n/a — no hay entrypoint versionado que auditar.
Veredicto: no-cron
**Causa raíz del veredicto:** **platform-managed, no-ingesta.** Aparece en `gh workflow list`
(P1, id 314034212) y **no existe como archivo** en `.github/workflows/` (P0 lista los 13 y no lo
incluye). No descarga datos de fuentes gubernamentales ni escribe ninguna tabla.

#### Evidencia observada

- **Pata 1 — parcial, y se declara por qué.** `gh workflow list --repo Cuchecorp/gov-map` lo
  reporta `active` (P1). No se enumeraron sus corridas porque `gh run list --workflow` toma el
  **nombre de archivo `.yml`**, que aquí no existe; el probe P2 iteró sobre
  `.github/workflows/*.yml` y por construcción no podía cubrirlo. La evidencia **indirecta** de
  que opera está en P2: la corrida de `ci.yml` del 2026-07-27T19:20:26Z lleva
  `displayTitle: "chore(deps): bump actions/checkout from 4.3.1 to 7.0.1"`, es decir **un PR
  abierto por Dependabot ese mismo día**.
- **Pata 2 — no aplica.** No escribe tablas: abre pull requests.
- **Pata 3 — no aplica.** Fuera del catálogo de freshness por definición.
- **Pata 4 — no aplica.** No toca fuentes ni R2.

#### DOS ETAPAS compliance

**No aplica** — no es un conector de ingesta y no hay código versionado que auditar.

#### Gaps de esta unidad

Ninguno. Se inventaría para cerrar el universo (sin PM-1/PM-2 el inventario sería defendible sólo
contra el filesystem local, no contra el repo remoto).

#### Cómo re-verificar

```bash
gh workflow list --repo Cuchecorp/gov-map          # 15 filas; "Dependabot Updates" al final
ls .github/workflows/ | grep -i dependabot         # sin coincidencias → platform-managed
ls .github/dependabot.yml 2>/dev/null              # la config, si existe, no es un workflow
```

---

### PM-2: CodeQL (id 301076402)

**YAML:** **ninguno** — no versionado en `.github/workflows/`. Análisis de seguridad gestionado
por la plataforma (default setup).
**Schedule:** gestionado por GitHub.
**Entrypoint invocado:** n/a — no hay entrypoint versionado que auditar.
Veredicto: no-cron
**Causa raíz del veredicto:** **platform-managed, no-ingesta.** Presente en `gh workflow list`
(P1, id 301076402) y ausente del filesystem (P0). Es análisis estático de seguridad; no ingiere
ni escribe datos del Congreso.

#### Evidencia observada

- **Pata 1 — parcial, declarado.** `active` en P1. Igual que PM-1, no expone corridas indexables
  por archivo `.yml`, así que P2 no podía alcanzarlo. Se registra la limitación del probe en vez
  de presentarlo como "sin corridas".
- **Pata 2 — no aplica.** No escribe tablas.
- **Pata 3 — no aplica.** Fuera del catálogo de freshness.
- **Pata 4 — no aplica.** No toca fuentes ni R2.

#### DOS ETAPAS compliance

**No aplica** — no es un conector de ingesta.

#### Gaps de esta unidad

Ninguno dentro de CRON-01. (La cobertura de CodeQL sobre el código es materia de seguridad, no
de auditoría de ingesta programada.)

#### Cómo re-verificar

```bash
gh workflow list --repo Cuchecorp/gov-map          # 15 filas; "CodeQL" al final
ls .github/workflows/ | grep -i codeql             # sin coincidencias → platform-managed
```

---

### Jobs de `pg_cron` — nota de método

Las cinco subsecciones `PG-n` que siguen tienen una anatomía **adaptada**, porque un job de
`pg_cron` no es un workflow: no tiene YAML, no tiene runner y no tiene `gh run list`. Los
`118-PATTERNS.md` lo declaran explícitamente bajo *"No Analog Found"* — el audit 56 auditó nueve
workflows y **ningún** job de `pg_cron`, así que esta anatomía se construye aquí por primera vez.
Las sustituciones son:

| pata de workflow | equivalente en `pg_cron` | fuente |
|---|---|---|
| pata 1 — `gh run list` | `cron.job_run_details` (status + `return_message` + `start_time`) | P6 |
| pata 2 — tabla destino del CLI | la tabla/vista que **materializa** el `command` | P6, P7 |
| pata 3 — freshness | **no aplica en los 5** — `packages/freshness/src/catalog.ts` no tiene ninguna entrada de `pg_cron` (P9) | P9 |
| pata 4 — crudo en R2 | **no aplica en los 5** — ningún job toca una fuente externa; todos operan intra-Postgres | P10 |

Además, el `schedule` que se reporta es siempre **el leído de `cron.job` (DB viva)**, no el de la
migración: la migración es la *expectativa*, y el delta entre ambas es hallazgo en sí mismo.

#### Delta migración ↔ vivo (Open Question 1, cerrada)

**El delta es CERO, y se declara como resultado negativo fechado (2026-07-28), no se omite.**

- **Jobs esperados por migraciones que NO están vivos:** **ninguno**. Los cinco declarados
  —`process-ingest-jobs` (`0003_orchestration.sql:214`/`:221`), `cleanup-net-http`
  (`0003_orchestration.sql:229`), `net-materializar-aristas` (`0030_net.sql:162`),
  `cruces-materializar` (`0039_cruce_senal.sql:138`) y `actualidad-materializar`
  (`0065_actualidad_senal.sql:326`)— aparecen en `cron.job` (P6).
- **Jobs vivos NO declarados en migraciones:** **ninguno**. `cron.job` devuelve exactamente 5
  filas (P6a: `count(*)` = 5) y las 5 corresponden a las migraciones anteriores, con el **mismo
  jobname, el mismo schedule y el mismo command**.
- **Rama activa de `0003_orchestration.sql`:** el `schedule` real de `process-ingest-jobs` es
  **`30 seconds`**, es decir la rama de **pg_cron ≥ 1.5 (`:214`)**, NO el fallback `* * * * *`
  de `:221`. Resuelto con dato vivo, no por lectura del DDL.
- **Las 5 filas con `active = t`.** Ninguna quedó registrada-pero-apagada.

Un job vivo no declarado —o un job declarado y ausente— sería hallazgo P1 como mínimo. Aquí no
hay ninguno de los dos casos, y **por eso conviene dejarlo escrito**: si un audit futuro
encuentra delta, sabrá que el 2026-07-28 no lo había.

---

### PG-1: process-ingest-jobs

**Job:** `process-ingest-jobs` · **jobid** 1
**Schedule real (`cron.job`):** `30 seconds` — **leído de la DB** (P6), no de la migración.
**Declarado en:** `supabase/migrations/0003_orchestration.sql:214` (rama pg_cron ≥ 1.5). La rama
alternativa `:221` (`* * * * *`, fallback para pg_cron < 1.5) **no** es la activa.
**Comando:** `select util.process_ingest_jobs();`
**active:** `t`
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. 40.238 `succeeded` frente a **1** `failed` en 14 días
(99,998 %); el fallo es un `job startup timeout` @ 2026-07-27 18:25:29.

#### Evidencia observada

- **Pata 1 sustituida (`cron.job_run_details`) — P6.**
  ```
  process-ingest-jobs|succeeded|40238|2026-07-28 16:22:10.267844+00
  process-ingest-jobs|failed|1|2026-07-27 18:25:29.460307+00
  ```
  Último run: **succeeded** @ 2026-07-28 16:22:10, minutos antes del cierre del audit.
- **Cadencia observada vs teórica.** 40.239 disparos observados contra ~40.320 teóricos
  (`30 s` × 14 d) = **99,8 %**. La diferencia es indistinguible del jitter de arranque del
  scheduler.
- **`return_message` del único fallo (recortado a 180 caracteres, P6):**
  ```
  2026-07-27 18:25:29.460307+00|job startup timeout
  ```
  Un `job startup timeout` sobre 40.239 disparos = **0,002 %**: ruido de scheduler bajo carga, no
  avería. No se reintenta manualmente ni se escala.
- **Pata 2 sustituida (qué materializa) — no hay tabla-destino propia.** El comando drena la
  **cola de ingesta** del schema `util`; su efecto es procesar trabajos encolados, no llenar una
  tabla identificable. Se declara así en vez de forzar un `max(fecha_captura)` sobre una tabla
  que este job no posee.
- **Pata 3 — no aplica** (ningún job de `pg_cron` está en `catalog.ts`, P9).
- **Pata 4 — no aplica** (intra-Postgres, sin fuente externa).

#### Cómo re-verificar

```bash
# set -a; source .env; set +a
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select jobid, jobname, schedule, active, command from cron.job where jobid=1;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select d.status, count(*), max(d.start_time) from cron.job_run_details d
#     where d.jobid=1 and d.start_time > now() - interval '14 days' group by 1 order by 1;"
sed -n '210,225p' supabase/migrations/0003_orchestration.sql   # las DOS ramas; :214 es la activa
```

---

### PG-2: cleanup-net-http

**Job:** `cleanup-net-http` · **jobid** 2
**Schedule real (`cron.job`):** `*/15 * * * *` (P6)
**Declarado en:** `supabase/migrations/0003_orchestration.sql:229`
**Comando:** `select util.cleanup_net_http();`
**active:** `t`
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. **1.344 observadas contra 1.344 teóricas: cadencia
exacta, cero fallos.**

#### Evidencia observada

- **Pata 1 sustituida — P6.**
  ```
  cleanup-net-http|succeeded|1344|2026-07-28 16:15:00.016645+00
  ```
  **Ninguna fila con `status = 'failed'`** en la ventana de 14 días.
- **Cadencia.** `*/15` × 24 h × 14 d = 1.344. Observadas: 1.344. **Coincidencia exacta** — el
  único job del inventario que no pierde ni un disparo.
- **Valor probatorio adicional.** Estas 1.344 filas son la **prueba de que
  `cron.job_run_details` NO se poda** en la ventana de 14 días. Sin ellas, las 8 filas de
  `actualidad-materializar` (PG-5) podrían leerse como historial truncado; con ellas, la lectura
  honesta es "job nuevo", no "job con ventanas perdidas". Es un control que sostiene el veredicto
  de **otra** unidad.
- **Pata 2 sustituida — limpieza, sin tabla-destino de datos.** Purga las tablas del schema `net`
  (respuestas HTTP asíncronas de `pg_net`). Su producto es la *ausencia* de filas, no su
  presencia: verificarlo por `max(fecha)` sería contradictorio.
- **Pata 3 — no aplica** (fuera de `catalog.ts`, P9). **Pata 4 — no aplica** (intra-Postgres).

#### Cómo re-verificar

```bash
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select d.status, count(*), max(d.start_time) from cron.job_run_details d
#     where d.jobid=2 and d.start_time > now() - interval '14 days' group by 1;"
#   # 1344 succeeded / 0 failed = cadencia exacta; sirve además de control anti-poda
sed -n '226,232p' supabase/migrations/0003_orchestration.sql
```

---

### PG-3: net-materializar-aristas

**Job:** `net-materializar-aristas` · **jobid** 3
**Schedule real (`cron.job`):** `17 3 * * *` (P6) — diario 03:17 UTC.
**Declarado en:** `supabase/migrations/0030_net.sql:162`
**Comando:** `select grafo.materializar_aristas();`
**active:** `t`
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. 14 corridas en 14 días, cero fallos.

#### Evidencia observada

- **Pata 1 sustituida — P6.**
  ```
  net-materializar-aristas|succeeded|14|2026-07-28 03:17:00.027846+00
  ```
  Sin filas `failed`. Último run 2026-07-28 03:17:00, **17 milisegundos** de desviación respecto
  del minuto programado.
- **Cadencia.** Diario × 14 d = 14 teóricas; 14 observadas. **Exacto.**
- **Pata 2 sustituida — materializa `grafo.*`** (aristas del grafo de influencia). Es una
  materialización interna: su insumo son tablas ya ingeridas por los workflows de W-4/W-5/W-6, y
  su salida vive en el schema `grafo`. **No se sondeó el conteo de aristas**: el veredicto de
  *cadencia* se sostiene con `job_run_details`, y añadir un `count(*)` sobre `grafo` sin un
  baseline con el que comparar no habría probado nada. Se declara la elección en vez de fingir
  una pata que no discrimina.
- **Pata 3 — no aplica** (fuera de `catalog.ts`, P9). **Pata 4 — no aplica** (intra-Postgres).

#### Cómo re-verificar

```bash
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select d.status, count(*), max(d.start_time) from cron.job_run_details d
#     where d.jobid=3 and d.start_time > now() - interval '14 days' group by 1;"
sed -n '158,166p' supabase/migrations/0030_net.sql
```

---

### PG-4: cruces-materializar

**Job:** `cruces-materializar` · **jobid** 4
**Schedule real (`cron.job`):** `23 3 * * *` (P6) — diario 03:23 UTC, seis minutos después de
PG-3 (orden deliberado: los cruces consumen el grafo).
**Declarado en:** `supabase/migrations/0039_cruce_senal.sql:138`
**Comando:** `select cruces.materializar_cruces();`
**active:** `t`
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. 14 corridas en 14 días, cero fallos.

#### Evidencia observada

- **Pata 1 sustituida — P6.**
  ```
  cruces-materializar|succeeded|14|2026-07-28 03:23:00.035462+00
  ```
  Sin filas `failed`.
- **Cadencia.** 14 teóricas / 14 observadas. **Exacto.** Y el orden respecto de PG-3 se cumple
  todos los días: 03:17 → 03:23.
- **Pata 2 sustituida — materializa `cruces.*`** (señales de cruce entre lobby, patrimonio,
  votaciones y proyectos). Misma consideración que PG-3: sin baseline, un conteo no discrimina;
  la cadencia sí.
- **Pata 3 — no aplica** (fuera de `catalog.ts`, P9). **Pata 4 — no aplica** (intra-Postgres).

#### Cómo re-verificar

```bash
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select d.status, count(*), max(d.start_time) from cron.job_run_details d
#     where d.jobid=4 and d.start_time > now() - interval '14 days' group by 1;"
sed -n '134,142p' supabase/migrations/0039_cruce_senal.sql
```

---

### PG-5: actualidad-materializar

**Job:** `actualidad-materializar` · **jobid** 5
**Schedule real (`cron.job`):** `7 11,14,17,20 * * 1-5` (P6) — L–V, cuatro ventanas intradía,
**7 minutos antes** de cada ventana de `actualidad-refresh` (W-1, `:00`). Los dos escriben
`actualidad_senal` por vías distintas y disjuntas.
**Declarado en:** `supabase/migrations/0065_actualidad_senal.sql:326`
**Comando:** `select actualidad.materializar_senales();`
**active:** `t`
Veredicto: verde
**Causa raíz del veredicto:** n/a — verde. **Job nuevo, no job con ventanas perdidas:** su
primera corrida registrada es **2026-07-24 17:07** y desde entonces la cadencia es 100 %.

#### Evidencia observada

- **Pata 1 sustituida — P6, y aquí hubo que descartar una lectura falsa.** El agregado de 14 días
  da **8** corridas contra ~40 teóricas (4/día × 10 días hábiles), lo que *parecería* un job
  perdiendo el 80 % de sus ventanas. La historia completa lo refuta:
  ```
  select min(start_time), count(*) from cron.job_run_details where jobid=5;
  → 2026-07-24 17:07:00.134404+00|8
  ```
  El `count(*)` **sin ventana temporal** también da 8: esas 8 filas **son** el historial completo.
  El job entró en servicio el 2026-07-24 a media jornada.
- **Descarte de la hipótesis de poda.** Si `cron.job_run_details` se podara, PG-2 no conservaría
  sus 1.344 filas del mismo período. Las conserva ⇒ no hay poda ⇒ las 8 filas son reales.
  **Hipótesis alternativa eliminada con dato, no por conveniencia.**
- **Cadencia post-arranque, corrida a corrida (P6):**

  | fecha | ventanas esperadas | observadas | lectura |
  |---|---|---|---|
  | 2026-07-24 (jue) | 4 | 2 (17:07, 20:07) | arranque a media jornada — 11:07 y 14:07 son anteriores al alta del job |
  | 2026-07-25 (vie) | 4 | 0 | **discrepancia declarada, ver abajo** |
  | 2026-07-26 (sáb) | 0 | 0 | fin de semana, correctamente omitido por `* * 1-5` |
  | 2026-07-27 (lun) | 4 | 4 (11:07, 14:07, 17:07, 20:07) | **4/4** |
  | 2026-07-28 (mar) | 2 transcurridas al cierre del audit | 2 (11:07, 14:07) | **2/2** |

  *Discrepancia declarada honestamente:* el 2026-07-25 fue **viernes hábil** y no registra
  corridas, pese a que el job ya estaba activo desde el jueves. Con la evidencia disponible no se
  puede decidir entre "alta efectiva del job posterior al viernes" y "cuatro ventanas realmente
  perdidas". **No se resuelve por inferencia**: se registra como observación abierta para 119
  (**G11**, §4), y
  el veredicto sigue siendo verde porque las dos jornadas hábiles completas posteriores (lunes y
  martes) dan 6/6. Un solo día ambiguo, con el job recién nacido, no alcanza el umbral de `stale`
  de §0.4 ("N ventanas sin correr" sin causa) cuando la cadencia posterior es perfecta.
- **Pata 2 sustituida — materializa `actualidad_senal` — P7.** 18 filas,
  `max(fecha_captura)` = `2026-07-28 16:08:28.275+00`. **Atribución cuidadosa:** esa marca
  corresponde a la corrida de **W-1** (16:07), no a este job, cuya última ventana fue 14:07. Los
  dos escriben la misma tabla en `tipo_senal` **disjuntos** (`run-actualidad-prod-cli.ts:10-12`:
  full-rebuild acotado a `tipo_senal='agrupacion_materia'`, *"disjunto del set temporal del proc
  SQL 0065; NUNCA delete global"*). Se declara la atribución en vez de contar la fila dos veces.
- **Pata 3 — no aplica** (fuera de `catalog.ts`, P9). **Pata 4 — no aplica** (intra-Postgres).

#### Cómo re-verificar

```bash
# Historia COMPLETA (sin ventana) — es lo que distingue "job nuevo" de "ventanas perdidas":
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select min(start_time), count(*) from cron.job_run_details where jobid=5;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select d.start_time, d.status from cron.job_run_details d where d.jobid=5
#     order by d.start_time desc limit 20;"
# Control anti-poda (debe seguir conservando ~1344):
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
#   "select count(*) from cron.job_run_details where jobid=2
#     and start_time > now() - interval '14 days';"
sed -n '322,330p' supabase/migrations/0065_actualidad_senal.sql
```

---

## 3. Estado observado (ancla 2026-07-28)

Las cuatro tablas de esta sección son la **fotografía** contra la que se emitieron los veredictos
de §2. Todas llevan la fecha del probe **en el título** (idiom `56-CRON-AUDIT.md:489`) porque
caducan: la propia cabecera del documento declara `caducidad: ~14 días`. Leer §3 sin mirar su
ancla temporal es el modo más fácil de convertir este audit en una afirmación falsa.

### 3.1 Observabilidad — Estado de tablas (probe 2026-07-28)

| Tabla | Definida en | Escrita por (unidad de cron) | Estado actual | Última entrada (probe) |
|---|---|---|---|---|
| `proyecto` | `0008_tramitacion.sql:19` | W-4 `leyes-weekly` | poblada — 3.659 filas | `2026-07-27 21:38:06.135+00` (P7) |
| `tramitacion_evento` | `0008_tramitacion.sql:69` | W-4 `leyes-weekly` | poblada — 48.368 filas | `2026-07-27 21:38:09.718+00` (P7) |
| `votacion` | `0008_tramitacion.sql:37` | W-4 `leyes-weekly` | poblada — 4.855 filas | `2026-07-27 21:38:09.718+00` (P7) |
| `citacion` | `0010_agenda.sql:19` | W-2 `agenda-weekly` | poblada — 289 filas | `2026-07-27 13:41:24.416+00` (P7) |
| `sesion_sala` | `0010_agenda.sql:59` | W-2 `agenda-weekly` | poblada — 18 filas | `2026-07-27 13:41:29.72+00` (P7) |
| `lobby_audiencia` | `0021_lobby.sql:30` | W-5 `lobby-leylobby-weekly` (**no** W-9) | poblada — 17.762 filas | `2026-07-22 12:44:05.343+00` (P7) |
| `declaracion` | `0022_probidad.sql:79` | W-6 `probidad-weekly` | poblada — 1.065 filas | `2026-07-23 12:37:05.518+00` (P7) |
| `actualidad_senal` | `0065_actualidad_senal.sql:50` | W-1 `actualidad-refresh` + PG-5 (`tipo_senal` disjuntos) | poblada — 18 filas | `2026-07-28 16:08:28.275+00` (P7) |
| `parlamentario` | `0005_parlamentario.sql:17` | **ninguna unidad de GH Actions** — escritura local del operador | poblada — 186 filas | `2026-07-27 00:10:53.196+00` (P7) |
| `parlamentario_militancia` | `0005_parlamentario.sql` | ídem `parlamentario` | poblada — 363 filas | `2026-07-27 00:10:53.196+00` (P7) |
| `notificacion_envio` | `0070_notificacion_envio.sql:37` | W-7 `digest-daily` (gated, sin corridas) | **vacía — 0 filas** | — (P7) · estado ESPERADO (§1.5) |
| `source_snapshot` | `0002_control_tables.sql:22` | W-4 (`leyes`) y W-6 (`infoprobidad`) **solamente** | parcial — 2 fuentes de 8 conectores | `leyes` 4.380 @ `2026-07-27 21:38:22.834+00`; `infoprobidad` 3 @ `2026-07-23 12:37:12.157+00` (P10) |

**Observaciones de observabilidad:**

- **`source_snapshot` es la tabla que peor cumple su propósito.** Es la única traza en DB del PUT
  a R2 (Etapa-1 de la regla LOCKED de `CLAUDE.md`) y sólo dos conectores la alimentan. Los que
  hacen `putImmutable` **sin** montar `SnapshotWriter` —agenda (W-2), lobby-leylobby (W-5),
  identity (W-3/W-8), fichas (W-11)— escriben crudo sin dejar rastro consultable. El fix es
  mecánico (montar `SnapshotWriter`, como hacen `run-tramitacion-prod-cli.ts:215-218` y
  `run-probidad-todos-cli.ts:147-150`), pero es de Phase 119.
- **`lobby_audiencia` tiene dos escritores potenciales y sólo uno real.** La fila la llena W-5;
  W-9 lleva sin llegar al CLI desde el 2026-07-07. Cualquier lectura de "la tabla está fresca"
  como salud de W-9 es un error de atribución — y es exactamente el que comete el catálogo de
  freshness (§3.2).
- **`parlamentario` no tiene cron que la escriba.** W-3 produce el snapshot git y W-8 está gated;
  la escritura del 2026-07-27 00:10 vino de fuera de GH Actions. La maestra de identidad depende
  hoy de una acción de operador.

### 3.2 Frescura baseline (probe 2026-07-28)

Los umbrales **se citan** de `packages/freshness/src/catalog.ts`; este documento **no los
redefine**. Un umbral duplicado aquí se desincronizaría del código en la primera edición, y
entonces el audit mentiría con aire de autoridad.

| Fuente / Tabla | Umbral (`catalog.ts`) | Última fecha observada | Veredicto freshness | Probe SQL / origen |
|---|---|---|---|---|
| `leyes` / `proyecto` | 7 d (`catalog.ts:224`) | `2026-07-27 21:38:06.135+00` (0 d) | `stale: false` | P9 · `max(fecha_captura) from proyecto` |
| `leyes-min-edad` / `proyecto` | 45 d (`catalog.ts:248`) | `2026-07-09 04:34:43.901+00` (19 d) | `stale: false` | P9 · `min(fecha_captura) from proyecto` |
| `agenda` / `citacion` | 7 d (`catalog.ts:257`) | `2026-07-27 13:41:24.416+00` (1 d) | `stale: false` | P9 · `max(fecha_captura) from citacion` |
| `lobby-camara` / `lobby_audiencia` | 14 d (`catalog.ts:265`) | `2026-07-22 12:44:05.343+00` (6 d) | `stale: false` ⚠️ **verde prestado** | P9 · `max(fecha_captura) from lobby_audiencia` |
| `lobby-leylobby` / `lobby_ingesta_estado` | 7 d (`catalog.ts:273`) | `2026-06-22` (36 d) | **`stale: true`** | P9 + P8 · `max(ingestado_hasta) from lobby_ingesta_estado` |
| `probidad` / `declaracion` | 30 d (`catalog.ts:281`) | `2026-07-23 12:37:05.518+00` (5 d) | `stale: false` | P9 · `max(fecha_captura) from declaracion` |
| `fichas` / `proyecto` | 30 d (`catalog.ts:289`) | `2026-07-27 21:38:06.135+00` (0 d) | `stale: false` ⚠️ **verde prestado** | P9 · `max(fecha_captura) from proyecto` |
| `chilecompra` / `contratos_ingesta_estado` | 30 d (`catalog.ts:311`) | `null` (tabla vacía) | `stale: true` — **esperado**, MONEY gated (§1.5) | P9 + P8 · tabla con 0 filas |
| `servel` / `aportes_ingesta_estado` | 365 d (`catalog.ts:335`) | `null` (tabla vacía) | `stale: true` — **esperado**, SERVEL gated (§1.5) | P9 + P8 · tabla con 0 filas |

**Observaciones de frescura:**

- **Sólo una de las tres señales `stale: true` es una avería.** `lobby-leylobby` lo es;
  `chilecompra` y `servel` son gating legal declarado en las migraciones
  (`0023_dinero.sql:46`, `0025_agregacion.sql:46`) y están registradas en §1.5 para que 119 no
  las tome como backlog. **Leer "3 fuentes stale" como "3 problemas" sería el error de lectura
  más probable de este audit.**
- **Dos señales dan verde prestado (§1.6 punto 7).** `lobby-camara` mide `lobby_audiencia`, que
  llena W-5; `fichas` mide `proyecto`, que llena W-4. Ambas reportan `stale: false` **gracias al
  trabajo de otro cron**, y son por construcción incapaces de detectar la avería del cron que
  nombran. El propio JSON las delata en un campo que **no** participa del cálculo:
  `lobby-camara` trae `ghRun: "failure @ 2026-07-07"` y `fichas` trae
  `ghRun: "n/d (sin corridas)"`. La información existe; el veredicto de `stale` la ignora.
- **La discrepancia freshness ↔ fila real, buscada explícitamente, aparece una sola vez y con
  signo favorable.** El CONTEXT (`118-CONTEXT.md:25`) declara que una discrepancia entre lo que
  reporta `pnpm freshness` y la última fila real es hallazgo en sí mismo. En `lobby-leylobby`
  **no hay discrepancia**: la señal lee `lobby_ingesta_estado` (la tabla de cursor) y ve 36 días,
  igual que P8. Acierta precisamente porque es la **única** de las 9 entradas que apunta a una
  tabla de *cursor* en vez de a una de *datos*. La discrepancia real del audit es de otro tipo:
  `lobby_audiencia` está fresca (2026-07-22) mientras el cursor de la misma fuente lleva 36 días
  parado — dato fresco y marcador muerto conviviendo.
- **Recomendación implícita para 119** (no es fix, es lectura): el patrón que funciona es el de
  `lobby-leylobby` —medir el **cursor**, no la tabla de datos—, y es el que las dos señales de
  verde prestado no siguen.
- **La herramienta misma tiene una avería de invocación.** `pnpm freshness` **no resuelve `tsx`**
  en el entorno local (P9): `package.json:12` invoca `tsx` y el binario sólo existe en
  `packages/freshness/node_modules/.bin/tsx`. Variante viva del gotcha v8.1 (`process.cwd` bajo
  `pnpm --filter exec`). Se documentó y **no se arregló** (régimen read-only); es §1.6 punto 5.
- **Ocho de las veinte unidades se auditaron sin pata 3.** El catálogo tiene 9 entradas y no
  cubre W-1 `actualidad-refresh`, W-7 `digest-daily`, W-3 `backup-parlamentario` ni **ninguno**
  de los 5 jobs de `pg_cron`. Para ésas el veredicto se apoya en patas 1+2, y así se declara en
  cada sección de §2.

### 3.3 pg_cron vivo × `job_run_details` (probe 2026-07-28)

| jobid | jobname | schedule (vivo) | active | último run | status | `return_message` (recortado) | esperado en migración |
|---|---|---|---|---|---|---|---|
| 1 | `process-ingest-jobs` | `30 seconds` | `t` | `2026-07-28 16:22:10.267844+00` | `succeeded` (40.238 en 14 d) | — | sí · `0003_orchestration.sql:214` (rama ≥1.5 **activa**; `:221` no) |
| 1 | ↳ único fallo del período | — | — | `2026-07-27 18:25:29.460307+00` | `failed` (1 en 14 d) | `job startup timeout` | — |
| 2 | `cleanup-net-http` | `*/15 * * * *` | `t` | `2026-07-28 16:15:00.016645+00` | `succeeded` (1.344 en 14 d) | — | sí · `0003_orchestration.sql:229` |
| 3 | `net-materializar-aristas` | `17 3 * * *` | `t` | `2026-07-28 03:17:00.027846+00` | `succeeded` (14 en 14 d) | — | sí · `0030_net.sql:162` |
| 4 | `cruces-materializar` | `23 3 * * *` | `t` | `2026-07-28 03:23:00.035462+00` | `succeeded` (14 en 14 d) | — | sí · `0039_cruce_senal.sql:138` |
| 5 | `actualidad-materializar` | `7 11,14,17,20 * * 1-5` | `t` | `2026-07-28 14:07:00.016294+00` | `succeeded` (8 en total; primera 2026-07-24 17:07) | — | sí · `0065_actualidad_senal.sql:326` |

**Delta migración ↔ vivo: CERO** — ningún job esperado falta, ningún job vivo sobra. Detalle y
nombres en la nota de método de §2 (*"Delta migración ↔ vivo"*).

**Higiene (T-118-05):** el único `return_message` no vacío del período se pegó recortado a 180
caracteres en origen (`left(d.return_message,180)`, P6) y resultó ser un texto de cuatro
palabras sin dato sensible. Los demás vienen vacíos por ser corridas exitosas.

### 3.4 Cursores — el discriminante de `stale` (probe 2026-07-28)

Ésta es la tabla que **sostiene o refuta** cada veredicto `stale` (Pitfall 4). El conteo de filas
de una tabla de datos no distingue "sin novedades honesto" de "cursor detenido"; el marcador de
avance sí.

| tabla de estado | columna de avance | valor observado | interpretación |
|---|---|---|---|
| `lobby_ingesta_estado` (`0021_lobby.sql:133`) | `ingestado_hasta` | **`2026-06-22`** (136 filas; `fecha_captura` `2026-06-22 19:18:08+00`) | **cursor detenido — 36 días.** La corrida del 2026-07-22 fue `success` y `lobby_audiencia` recibió filas ese día: si la fuente no tuviera novedades, el cursor tampoco estaría fresco *y* la tabla de datos tampoco. Que una avance y el otro no descarta "sin novedades". **Sostiene el único `stale` del audit** (W-5). |
| `leylobby_cursor_estado` (`0053_leylobby_cursor_estado.sql:16`) | `fecha_captura` | `2026-07-22 12:44:06.340612+00` (1 fila) | **avanzando.** Es el cursor que el CLI **sí** actualiza. Su contraste con la fila anterior es la prueba de la desincronización: dos cursores para la misma fuente, uno vivo y otro muerto. |
| `probidad_ingesta_estado` (`0022_probidad.sql:361`) | `ingestado_hasta` | **`2026-07-23`** (136 filas) | **avanzando correctamente** — coincide con el día de la corrida de W-6. **Contraprueba positiva:** misma familia de tabla que `lobby_ingesta_estado`, mismo día de lectura, comportamiento opuesto. Demuestra que el patrón `*_ingesta_estado` funciona y que lo roto es el conector de lobby, no el diseño. |
| `leyes_rotacion_estado` (`0054_leyes_rotacion_estado.sql:25`) | `ultimo_boletin` | `16851-14`; `fecha_captura` `2026-07-27 21:09:34.69+00` (1 fila) | **round-robin girando.** El cursor no es una fecha sino la posición del barrido; se movió en la corrida del 2026-07-27. Sostiene el verde de W-4. |
| `contratos_ingesta_estado` (`0023_dinero.sql:134`) | `ingestado_hasta` | **0 filas** (sin valor) | **nunca se barrió — estado ESPERADO.** `0023_dinero.sql:46` declara que *"el pg_cron del barrido por RUT queda como checkpoint de operador, NO se crea en este DDL"*. Gating legal, no cursor detenido (§1.5). |
| `aportes_ingesta_estado` (`0024_servel.sql:163`) | `ingestado_hasta` | **0 filas** (sin valor) | **nunca se barrió — estado ESPERADO.** `0025_agregacion.sql:46`: *"NO se crea ningun cron.schedule en este DDL"*. Ídem anterior (§1.5). |

**Cómo leer esta tabla:** una fila con avance congelado sólo es `stale` si **además** hay
evidencia de corrida exitosa en el período (si no, el problema es la corrida, y el veredicto sería
`roto`) y **no** hay causa legítima declarada (si la hay, es §1.5). `lobby_ingesta_estado` cumple
las tres condiciones: corridas verdes, marcador congelado, ninguna decisión declarada que lo
explique. Es el único caso del inventario.

#### Cómo re-verificar §3 completa

```bash
# set -a; source .env; set +a
# --- 3.1 observabilidad
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c "
# select 'proyecto', count(*)::text, max(fecha_captura)::text from proyecto
# union all select 'citacion', count(*)::text, max(fecha_captura)::text from citacion
# union all select 'lobby_audiencia', count(*)::text, max(fecha_captura)::text from lobby_audiencia
# union all select 'declaracion', count(*)::text, max(fecha_captura)::text from declaracion
# union all select 'actualidad_senal', count(*)::text, max(fecha_captura)::text from actualidad_senal
# union all select 'notificacion_envio', count(*)::text, max(created_at)::text from notificacion_envio;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select source, count(*), max(fetched_at) from source_snapshot group by 1 order by 1;"
#
# --- 3.2 frescura (SIEMPRE desde la raíz del repo; `pnpm freshness` no resuelve tsx, ver P9)
./packages/freshness/node_modules/.bin/tsx packages/freshness/src/cli.ts --json \
  > /tmp/fresh.json 2>/tmp/fresh.err; echo "exit=$?"    # exit=1 esperado si hay stale
grep -n "umbralDias\|workflowYml\|tabla:" packages/freshness/src/catalog.ts   # los umbrales VIVEN aquí
#
# --- 3.3 pg_cron vivo
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select jobid, jobname, schedule, active, command from cron.job order by jobid;"
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
#   "select j.jobname, d.status, count(*), max(d.start_time)
#      from cron.job_run_details d left join cron.job j on j.jobid=d.jobid
#     where d.start_time > now() - interval '14 days' group by 1,2 order by 1,2;"
#
# --- 3.4 cursores (el discriminante de stale)
# PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c "
# select 'lobby_ingesta_estado', count(*)::text, max(ingestado_hasta)::text from lobby_ingesta_estado
# union all select 'probidad_ingesta_estado', count(*)::text, max(ingestado_hasta)::text from probidad_ingesta_estado
# union all select 'contratos_ingesta_estado', count(*)::text, max(ingestado_hasta)::text from contratos_ingesta_estado
# union all select 'aportes_ingesta_estado', count(*)::text, max(ingestado_hasta)::text from aportes_ingesta_estado
# union all select 'leylobby_cursor_estado', count(*)::text, max(fecha_captura)::text from leylobby_cursor_estado
# union all select 'leyes_rotacion_estado', count(*)::text, max(ultimo_boletin)::text from leyes_rotacion_estado;"
```

---

## 4. Gaps priorizados (backlog de Phase 119)

Escala **LOCKED** (`118-CONTEXT.md:40`): **P0** = roto accionable · **P1** = stale accionable ·
**P2** = deuda (de operador o de instrumentación). Los ids `G<n>` son estables y están citados
desde las secciones de §2; el mnemónico entre paréntesis es el nombre con que §2 los nombró
antes de la consolidación.

### Índice compacto

| Gn | prio | unidad de cron | pata que lo detectó | archivo principal |
|---|---|---|---|---|
| G1 | P1 | W-5 `lobby-leylobby-weekly` | pata 2 (cursor, P8) + pata 3 (P9) | `packages/lobby/src/ingest-cli.ts` |
| G2 | P2 | *sistémico* — instrumento de frescura | pata 3 (404 en vivo, P9) | `packages/freshness/src/catalog.ts` |
| G3 | P2 | *sistémico* — 8 unidades sin pata 3 | pata 3 (cobertura del catálogo, P9) | `packages/freshness/src/catalog.ts` |
| G4 | P1 | W-9 `lobby-camara-weekly` + W-11 `fichas-backfill` | pata 3 contrastada con pata 1 (P9 vs P2) | `packages/freshness/src/catalog.ts` |
| G5 | P1 | *sistémico* — W-2, W-3/W-8, W-5, W-11 | pata 4 (`source_snapshot`, P10) | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` (referencia) |
| G6 | P1 | *sistémico* — W-2, W-6, W-3/W-8 | lectura de código anclada a pata 4 | `packages/ingest/src/r2-store.ts` |
| G7 | P1 | *sistémico* — W-2, W-6, W-9 | compliance dos-etapas (`CLAUDE.md`) | `packages/tramitacion/src/ingest-cli.ts` (referencia) |
| G8 | P2 | W-13 `deploy-cloudflare` | pata 1 (log, P3.b) + `gh secret list` (P4) | `.github/workflows/deploy-cloudflare.yml` |
| G9 | P2 | W-11 `fichas-backfill` | `gh secret list` (P4) | `.github/workflows/fichas-backfill.yml` |
| G10 | P2 | *sistémico* — herramienta de auditoría | pata 3 (fallo de invocación, P9) | `package.json` |
| G11 | P2 | PG-5 `actualidad-materializar` | pata 1 sustituida (`job_run_details`, P6) | `supabase/migrations/0065_actualidad_senal.sql` |

**11 gaps: 0 P0, 5 P1, 6 P2.**

**Ningún gap es P0** — y eso es un resultado, no un hueco del audit: de los 6 workflows con
`schedule:` activo, 5 están verdes y 1 stale, y ninguno falla su corrida (§1.3). Los dos
`failure` del inventario (`lobby-camara-weekly`, `deploy-cloudflare`) son unidades `no-cron`:
uno por decisión declarada (WAF), otro por deuda de operador con vía alternativa viva.

### Detalle — ordenado por prioridad

| # | Gap | Prioridad | Unidad | Archivo:Línea o dato | Fix propuesto (Phase 119) |
|---|---|---|---|---|---|
| G1 | Cursor `lobby_ingesta_estado` detenido en 2026-06-22 pese a corridas `success` semanales: el CLI actualiza `leylobby_cursor_estado` pero no el `*_ingesta_estado` de la misma fuente (dos cursores desincronizados) | **P1** | W-5 `lobby-leylobby-weekly` | `packages/lobby/src/ingest-cli.ts:161` (entrypoint real del YAML, `lobby-leylobby-weekly.yml:70`); cursores en `packages/lobby/src/cursor-leylobby.ts:3`, `:8`; dato: `lobby_ingesta_estado.ingestado_hasta = 2026-06-22` vs `leylobby_cursor_estado.fecha_captura = 2026-07-22 12:44:06` (P8) | 1) En `ingest-cli.ts`, tras cada lote confirmado, hacer `upsert` de `lobby_ingesta_estado.ingestado_hasta` con la fecha máxima ingerida — el conector de probidad ya lo hace (`packages/probidad/src/run-probidad-todos.ts`, cursor al día en P8: úsese como plantilla). 2) Decidir explícitamente si los dos cursores conviven o si uno se deriva del otro, y **documentar la decisión en el propio archivo** — hoy nada explica por qué son dos. 3) Test de regresión: tras una corrida simulada, `max(ingestado_hasta)` debe avanzar. 4) Verificación de cierre: `pnpm freshness` debe pasar `lobby-leylobby` a `stale:false` (hoy 36 d / umbral 7, `catalog.ts:273`) |
| G4 | Señales de freshness con **verde prestado**: dos entradas miden una tabla que llena OTRO cron, luego son estructuralmente incapaces de detectar la avería del cron que nombran | **P1** | W-9 `lobby-camara-weekly`, W-11 `fichas-backfill` | `packages/freshness/src/catalog.ts:265` (`lobby-camara` → `lobby_audiencia`, que llena W-5) y `catalog.ts:289` (`fichas` → `proyecto`, que llena W-4). Dato delator ya presente y NO usado en el cálculo: `ghRun: "failure @ 2026-07-07"` y `ghRun: "n/d (sin corridas)"` (P9) | 1) Reapuntar cada entrada a una tabla **propia** del cron que nombra: `lobby-camara` → `lobby_contraparte` (o un `*_ingesta_estado` propio si se crea); `fichas` → `proyecto_ficha` / `proyecto_embedding`, no `proyecto`. 2) Incorporar `ghRun` al cálculo de `stale` (hoy se muestra y se ignora): una `conclusion: failure` o `sin corridas` debe poder producir `stale:true` por sí sola. 3) Test: con `lobby_audiencia` fresca y W-9 en `failure`, la señal `lobby-camara` debe dar `stale:true` |
| G5 | Etapa-1 `putImmutable` **sin `SnapshotWriter`**: cuatro conectores escriben crudo a R2 sin dejar traza consultable en `source_snapshot` (2 fuentes registradas de 8 conectores) | **P1** | W-2 `agenda-weekly`, W-3/W-8 `identity`, W-5 `lobby-leylobby`, W-11 `fichas` | Falta el writer en `packages/agenda/src/run-agenda-prod-cli.ts:137-138`, `packages/identity/src/seed-cli.ts:195`, `packages/lobby/src/ingest-cli.ts:161`. Referencias que SÍ lo montan: `packages/tramitacion/src/run-tramitacion-prod-cli.ts:215-218` y `packages/probidad/src/run-probidad-todos.ts:147-150`. Dato: `source_snapshot` sólo tiene `leyes` (4.380) e `infoprobidad` (3) (P10) | 1) Montar `SnapshotWriter` sobre `SupabaseSnapshotStore` en cada uno de los tres CLIs, copiando literalmente el ensamblado de `run-tramitacion-prod-cli.ts:215-218`. 2) Confirmar que la fila incluye `source`, `resource`, `r2_path`, `content_hash`, `fetched_at` (columnas reales verificadas en P10). 3) Verificación de cierre: tras la primera corrida de cada cron, `select source, count(*) from source_snapshot group by 1` debe pasar de 2 a 5 fuentes |
| G6 | `putImmutable` devuelve `existed` (412 de `If-None-Match: *`) y **tres llamadores lo descartan** en el destructuring ⇒ no hay short-circuit "sin novedades" y se re-parsea siempre (viola `CLAUDE.md` regla 2, "salir temprano cuando no hay novedades") | **P1** | W-2 `agenda-weekly`, W-6 `probidad-weekly`, W-3/W-8 `identity` | Contrato en `packages/ingest/src/r2-store.ts:71`, `:79`. Descartes: `packages/agenda/src/ingest-run.ts:155` y `:291`, `packages/probidad/src/run-probidad-todos.ts:149`, `packages/identity/src/seed-cli.ts:201`. Referencia correcta: `packages/tramitacion/src/ingest-run.ts:294`, `:330` (`if (existed)` → `[skip] sin novedades`) | 1) Cambiar los tres destructurings a `const { r2Path, existed } = await …`. 2) Añadir el guard `if (existed) { log("[skip] sin novedades — <fuente> <recurso>"); continue; }` inmediatamente después, calcado de `tramitacion/src/ingest-run.ts:330`. 3) Test unitario por conector: con el store devolviendo `existed:true`, el parser NO debe invocarse. 4) Ojo con el caso de `identity` (el seed se regenera igual): el skip debe saltar la carga, no el commit del snapshot git |
| G7 | Sin ruta de **Etapa-2 (`--from-r2`)**: re-ingestar exige volver a la fuente, exactamente lo que la regla LOCKED de `CLAUDE.md` prohíbe | **P1** | W-2 `agenda-weekly`, W-6 `probidad-weekly`, W-9 `lobby-camara-weekly` | Ausente en `packages/agenda/src/run-agenda-prod-cli.ts` (sin flag de replay) y en el CLI de probidad; W-9 entra por `--html-file` (`lobby-camara-weekly.yml:67`) en vez de por R2. Referencias que sí lo exponen: `packages/tramitacion/src/ingest-cli.ts:200` y `packages/lobby/src/ingest-cli.ts:161` | 1) Añadir flag `--from-r2 <fecha|sha>` a los tres CLIs, con la misma firma que `tramitacion/src/ingest-cli.ts:200`. 2) En W-9, sustituir `--html-file /tmp/lobby.html` por un `putImmutable` del HTML del `curl` + parseo desde R2: eso hace el **fallback local** (`docs/runbooks/cron-local-fallback.md`) re-procesable sin volver a chocar con el WAF. 3) Test: correr el parseo dos veces desde el mismo objeto R2 debe ser idempotente |
| G2 | El catálogo de frescura declara dos `workflowYml` **inexistentes** ⇒ dos HTTP 404 en cada corrida de `freshness`. Distinto de "MONEY/SERVEL gated" (§4.1): lo gated es el *dato*; esto es el *catálogo* apuntando a un archivo que no existe | **P2** (instrumentación) | *sistémico* — `chilecompra`, `servel` | `packages/freshness/src/catalog.ts:313` (`chilecompra-weekly.yml`) y `catalog.ts:337` (`servel-weekly.yml`); el propio `catalog.ts:304` ya comenta que aún no existen. 404 capturados en vivo en P9 | Elegir UNA de las dos, no ambas: (a) poner `workflowYml: null` en esas dos entradas y que el cliente omita la llamada a la API de Actions cuando sea `null`; o (b) crear los dos YAML **gated** (sin `schedule:`, sólo `workflow_dispatch`) como hacen `digest-daily`/`roster-weekly`. Recomendación: (a) — crear YAML vacíos para callar un 404 es fabricar cobertura. Verificación: `freshness` sin líneas `HTTP 404` en stderr |
| G3 | **Hueco de cobertura de freshness:** el catálogo tiene 9 entradas y no cubre 8 de las 20 unidades ⇒ una avería silenciosa de esas 8 no dispara ninguna señal | **P2** (instrumentación) | *sistémico* — W-1, W-3, W-7 y los 5 jobs de `pg_cron` | Sin entrada en `packages/freshness/src/catalog.ts` para `actualidad_senal` (W-1), snapshot git/R2 (W-3), `notificacion_envio` (W-7) ni ninguno de `0003_orchestration.sql:214`, `0003_orchestration.sql:229`, `0030_net.sql:162`, `0039_cruce_senal.sql:138`, `0065_actualidad_senal.sql:326`. Confirmado en ejecución (P9) | 1) Añadir entrada para `actualidad-refresh` (tabla `actualidad_senal`, umbral 2 d por su cadencia intradía). 2) Añadir una comprobación de `pg_cron` distinta de las de tabla: `max(start_time)` por `jobid` desde `cron.job_run_details`, con umbral derivado del `schedule` — un job diario stale a 3 días es señal, uno de `30 seconds` stale a 1 hora también. 3) W-3 y W-7 pueden quedar deliberadamente fuera: si se decide así, **declararlo en el propio `catalog.ts`** con comentario, para que el hueco sea decisión y no olvido |
| G8 | `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` ausentes en el repo remoto ⇒ el workflow de deploy falla al expandirlos vacíos. **No bloquea ninguna ingesta** (el deploy real de PROD se hace localmente con wrangler OAuth) | **P2** (deuda de operador) | W-13 `deploy-cloudflare` | `.github/workflows/deploy-cloudflare.yml:61` (`pnpm run deploy`); log de la corrida 29027652583: `✘ [ERROR] … it's necessary to set a CLOUDFLARE_API_TOKEN` (P3.b); ausencia confirmada en `gh secret list` (P4) | **Acto de operador, no de agente.** Pasos exactos y permiso mínimo en [`118-OPERATOR-CHECKPOINT.md`](./118-OPERATOR-CHECKPOINT.md). 119 no puede cerrarlo por sí misma: sólo puede re-verificar con `gh secret list --repo Cuchecorp/gov-map` y re-disparar el workflow. Es la deuda 110-02, confirmada abierta al 2026-07-28 |
| G9 | `GEMINI_API_KEY` y `SUPABASE_URL` ausentes ⇒ un `workflow_dispatch` de `fichas-backfill` fallaría. Hoy inocuo: el workflow no tiene ninguna corrida registrada | **P2** (deuda de operador) | W-11 `fichas-backfill` | `.github/workflows/fichas-backfill.yml:81` (entrypoint `src/pipeline-cli.ts`); faltantes confirmados en P4. Nótese que `SUPABASE_URL` ya existe como `SUPABASE_API_URL`: puede ser un **remapeo faltante**, no un secret faltante | 1) Verificar primero si `SUPABASE_URL` se resuelve remapeando `secrets.SUPABASE_API_URL` en el bloque `env:`, como hace `lobby-leylobby-weekly.yml:57` — si es así, es un fix de YAML de una línea y **no** deuda de operador. 2) `GEMINI_API_KEY` sí es acto de operador: ver `118-OPERATOR-CHECKPOINT.md`. 3) Cerrar con un dispatch de prueba acotado |
| G10 | `pnpm freshness` **no resuelve `tsx`** en el entorno local: el script raíz lo invoca pero el binario sólo existe en el `node_modules` del paquete. Variante viva del gotcha v8.1 (`process.cwd` bajo `pnpm --filter exec`) | **P2** (instrumentación) | *sistémico* — herramienta de auditoría | `package.json:12` (`tsx packages/freshness/src/cli.ts`); binario efectivo en `packages/freshness/node_modules/.bin/tsx`; `.env` se resuelve desde el cwd en `packages/freshness/src/cli.ts:296`. Error literal en P9 | 1) Añadir `tsx` como `devDependency` de la raíz **o** cambiar el script a `pnpm --filter @obs/freshness exec tsx src/cli.ts` cuidando que el cwd siga siendo la raíz (si no, `cli.ts:296` no encuentra `.env` — ése es exactamente el gotcha v8.1). 2) Verificación de cierre: `pnpm freshness --json` desde la raíz debe emitir el JSON, con `exit=1` sólo por fuentes stale, nunca por binario ausente |
| G11 | PG-5 `actualidad-materializar` no registra corridas el **viernes 2026-07-25**, día hábil, con el job ya activo desde el jueves. Con la evidencia disponible no se distingue "alta efectiva posterior" de "cuatro ventanas perdidas" | **P2** (observación abierta) | PG-5 `actualidad-materializar` | `supabase/migrations/0065_actualidad_senal.sql:326` (`7 11,14,17,20 * * 1-5`); historial completo = 8 filas desde `2026-07-24 17:07` (P6). Control anti-poda: PG-2 conserva 1.344 filas del mismo período | **No se cierra por inferencia, se cierra por observación nueva.** 119 debe volver a mirar `cron.job_run_details` para `jobid=5` con ≥2 semanas de cadencia acumulada: si desde el 2026-07-28 no hay más huecos en días hábiles, se declara "arranque" y se cierra el gap; si aparece otro viernes vacío, hay patrón y pasa a P1 con investigación de `job startup timeout` (el único fallo observado en PG-1 fue de ese tipo) |

### 4.1 Estados esperados — NO son gaps

Registrados con su cita para que Phase 119 no los tome como backlog. La diferencia entre un gap y
un estado esperado es que el segundo tiene **una decisión declarada en el código o en el YAML**:

- **MONEY / SERVEL sin scheduler.** `supabase/migrations/0023_dinero.sql:46` (*"el pg_cron del
  barrido por RUT queda como checkpoint de operador, NO se crea en este DDL"*) y
  `supabase/migrations/0025_agregacion.sql:46` (*"NO se crea ningun cron.schedule en este DDL"*).
  Sus tablas de cursor tienen 0 filas (P8) y `freshness` las marca `stale:true` (P9): **esas dos
  señales stale no son averías.** Gating legal.
- **`lobby-camara-weekly` sin `schedule:`.** `.github/workflows/lobby-camara-weekly.yml:14-17` —
  WAF de camara.cl. El fallo observado (5.463 bytes < guard de 10.240, P3.a) es el guard
  funcionando, no el cron rompiéndose. El fallback local está en
  `docs/runbooks/cron-local-fallback.md`.
- **`digest-daily` con `schedule:` comentado.** `.github/workflows/digest-daily.yml:17` y
  `:24-25` — estreno gated. Sus 4 secrets `NOTIF_*`/`RESEND_*` ausentes (P4) y
  `notificacion_envio` con 0 filas (P7) son coherentes con NOTIF parked.
- **`roster-weekly` con `schedule:` comentado.** `.github/workflows/roster-weekly.yml:16` y
  `:29-30` — estreno gated, `workflow_dispatch` SOLO.
- **`backfill` y `fichas-backfill` sin `schedule:`.** `.github/workflows/backfill.yml:7` y
  `.github/workflows/fichas-backfill.yml:8`. `CLAUDE.md` manda backfill masivo **LOCAL**: la
  ausencia de schedule es cumplimiento, no omisión.
- **`ci` y `deploy-cloudflare` no son ingesta.** `.github/workflows/ci.yml:11-14` (eventos de
  repositorio) y `.github/workflows/deploy-cloudflare.yml:6` (disparo manual deliberado).
- **`Dependabot Updates` y `CodeQL` platform-managed.** Sin archivo en `.github/workflows/`;
  se inventarían para cerrar el universo, no para auditarlos como ingesta.

---

## 5. Assumptions y preguntas abiertas — resolución

Las cinco asunciones (`118-RESEARCH.md` §Assumptions Log) y las cuatro preguntas abiertas
(§Open Questions) del RESEARCH, cerradas contra observación. Cuando el dato no alcanza se dice
**parcialmente resuelto** con la razón: sobre-afirmar aquí contaminaría el backlog de 119.

| ID | Claim original | Resultado | Evidencia (probe / archivo:línea) |
|---|---|---|---|
| A1 | `psql` está instalado y en PATH | **CONFIRMADA.** Todas las probes de pata 2 y 4 corrieron con `psql` real; no hizo falta el fallback por `freshness` | P6a (`select count(*) from cron.job` → `5`), P7, P8, P10 |
| A2 | La columna temporal de `actualidad_senal`/`notificacion_envio` es `creado_en` | **REFUTADA en los tres casos.** `actualidad_senal` usa `fecha_captura`, `notificacion_envio` usa `created_at`, `source_snapshot` usa `fetched_at`. El lote del RESEARCH habría fallado; se corrigió ANTES de correrlo. Bonus: `sesion_tabla_item` no tiene `fecha_captura` (error literal observado) → se sustituyó por `sesion_sala` | P7 (query a `information_schema.columns`), P10 (columnas de `source_snapshot`); nota de columnas en §0.5 |
| A3 | Los 5 jobs de migración están efectivamente activos en PROD | **CONFIRMADA con delta CERO.** Los 5 vivos, los 5 con `active = t`, mismo nombre, mismo schedule y mismo comando que las migraciones. Ninguno sobra, ninguno falta | P6 y P6a; `0003_orchestration.sql:214`, `:229`, `0030_net.sql:162`, `0039_cruce_senal.sql:138`, `0065_actualidad_senal.sql:326`; tabla §3.3 |
| A4 | `backup-parlamentario`/`roster-weekly` escriben la maestra de identidad vía capa propia | **REFUTADA, y la refutación es hallazgo.** `backup-parlamentario` **no escribe Supabase**: su `env:` sólo mapea los 4 `R2_*` y el YAML declara *"SIN service key local en CI → la carga a DB se omite; el snapshot git es autoritativo"*. La pata 2 se sustituyó por el commit del bot. **Control negativo:** la fila `parlamentario` (2026-07-27 00:10:53) es 10 h anterior a la corrida (10:04) ⇒ no atribuible al cron | P7 (`git log … supabase/seeds/parlamentario.seed.json`); `backup-parlamentario.yml:38-42`, `:60`; `packages/identity/src/seed-cli.ts:195`, `:201` |
| A5 | Los secrets presentes siguen siendo sólo `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` (estado v6.0) | **REFUTADA — el estado MEJORÓ.** Hay **7** secrets: los 2 de Supabase (2026-06-23) más `DEEPSEEK_API_KEY` y los 4 `R2_*` (2026-07-09). Consecuencia de primera clase: la causa *"Etapa-1 no-op por secrets R2 ausentes"* que el audit 56 usó para `agenda` **está muerta** | P4 (`gh secret list`, NOMBRES y fechas); §1.4; W-2 §DOS ETAPAS |
| OQ1 | ¿Cuántos jobs `pg_cron` activos hay realmente en PROD, y qué rama de `0003` quedó viva? | **RESUELTA.** 5 jobs, los 5 activos. La rama viva es **pg_cron ≥ 1.5** (`schedule = 30 seconds`, `0003_orchestration.sql:214`), NO el fallback `* * * * *` de `:221`. Pre-check de permisos PASÓ ⇒ cifras vivas, no heredadas (`cifras_heredadas.heredada: false` en el front-matter) | P6a, P6; §1.7; §3.3 |
| OQ2 | ¿Dependabot/CodeQL entran al inventario? | **RESUELTA: sí.** Enumerados como PM-1 (id 314034212) y PM-2 (id 301076402), veredicto `no-cron`, causa "platform-managed, no versionado en `.github/workflows/`". Entran al denominador vía `conteo_platform_managed: 2` | P1 (`gh workflow list` → 15 remotos vs 13 locales); §1.1; §2 PM-1/PM-2 |
| OQ3 | ¿La deuda 110-02 sigue abierta? | **RESUELTA: sí, abierta al 2026-07-28.** `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` ausentes del repo y expandidos **vacíos** en el runner. Registrada como **G8 (P2)** y emitida al operador una sola vez. **Parcialmente resuelto lo secundario:** la *rotación B26* mencionada en la deuda original NO es verificable desde `gh secret list`, que sólo expone nombre y fecha de creación — las fechas más antiguas son 2026-06-23, dato que **no** basta para afirmar si hubo rotación | P3.b (log literal del run 29027652583), P4; [`118-OPERATOR-CHECKPOINT.md`](./118-OPERATOR-CHECKPOINT.md) |
| OQ4 | ¿Es gap que `freshness` apunte a `chilecompra-weekly.yml`/`servel-weekly.yml` inexistentes? | **RESUELTA: sí, gap de instrumentación** — **G2 (P2)**, con los dos HTTP 404 capturados en vivo. Explícitamente **distinto** de "MONEY/SERVEL gated", que es estado esperado y vive en §4.1 | P9 (stderr con los dos 404); `packages/freshness/src/catalog.ts:304`, `:313`, `:337` |

---

## 6. Límites

Un límite declarado es un resultado válido; uno silenciado, no. Lo que sigue acota exactamente
hasta dónde llega la autoridad de este documento.

1. **El checkpoint de operador se emite, no se responde.** G8 y G9 requieren un acto humano
   (cargar secrets en el dashboard de GitHub). El agente no los carga ni los ve: pide una vez,
   zero-credential-value, en [`118-OPERATOR-CHECKPOINT.md`](./118-OPERATOR-CHECKPOINT.md), y la
   fase **cierra igual** (`118-CONTEXT.md:37`, LOCKED). Al momento de este cierre la petición
   está **sin responder**, y por tanto la deuda 110-02 sigue abierta.
2. **Ocho de las veinte unidades se auditaron sin pata 3.** W-1, W-3, W-7 y los 5 jobs de
   `pg_cron` no están en `packages/freshness/src/catalog.ts` (G3). Sus veredictos se apoyan en
   patas 1+2, que en todos los casos fueron concordantes y contemporáneas — pero **dos patas no
   son tres**, y así se declara en cada sección de §2 en vez de presentarlas como cobertura
   completa.
3. **Los logs de `gh run view` no son recuperables indefinidamente.** GitHub retiene los logs de
   corridas por tiempo limitado. Los dos logs de fallo citados (P3.a run 28869169412 del
   2026-07-07; P3.b run 29027652583 del 2026-07-09) se transcribieron **literalmente** a
   `118-PROBES-RAW.md` precisamente porque el enlace no sobrevive: quien re-verifique dentro de
   meses tendrá la transcripción, no el log vivo.
4. **R2 se verificó sólo por proxy.** La pata 4 lee `source_snapshot` en Postgres, que es la
   *traza en DB* del PUT, no el bucket. **No se hizo ninguna llamada SigV4 a R2**: exigiría
   credenciales, y el régimen de la fase lo prohíbe. Consecuencia honesta: cuando §2 dice "sin
   traza en `source_snapshot`" (G5) **no** está probando que el objeto no exista en R2 — está
   probando que no es consultable desde la DB. Son cosas distintas y el gap está redactado sobre
   la segunda.
5. **Los veredictos caducan a ~14 días** (`caducidad` del front-matter). Todo §3 lleva la fecha
   del probe en el título por esta razón. `actualidad-refresh` corre 4 veces al día y
   `leyes-weekly` 5 veces por semana: un veredicto verde del 2026-07-28 no dice nada sobre el
   2026-08-15. Re-correr `check-crons.sh` **no** refresca los datos — sólo comprueba la
   integridad del documento; refrescar exige re-correr las probes de §0.5.
6. **No se encendió ningún flag ni se corrió ninguna ingesta para cerrar un límite.** Habría
   sido trivial disparar `fichas-backfill` para saber si falla por `GEMINI_API_KEY`, o descomentar
   un `schedule:` para observar una corrida. **Hacerlo habría violado el régimen read-only de la
   fase** (§0.3) y habría convertido una auditoría en una intervención. Cada vez que la evidencia
   se acabó, el documento lo dice en vez de fabricarla.
7. **Un día ambiguo queda ambiguo.** El viernes 2026-07-25 sin corridas de PG-5 (G11) no se
   resolvió: la evidencia disponible admite dos lecturas y **no se eligió la conveniente**. Se
   registró como observación abierta con el criterio exacto que la cerrará en 119.
8. **La rotación de credenciales no es observable con las herramientas de esta fase.**
   `gh secret list` expone nombre y fecha de creación, nunca el valor ni el historial. Cualquier
   afirmación sobre si un secret fue rotado sería inferencia sobre una fecha — ver OQ3, declarada
   *parcialmente resuelta* por esto mismo.
9. **El inventario es del repo `Cuchecorp/gov-map` y del filesystem local en el commit auditado.**
   Un workflow añadido después del 2026-07-28, o un job de `pg_cron` creado por migración
   posterior, no está aquí. El denominador se deriva en cada corrida de `check-crons.sh`
   precisamente para que esa deriva se detecte como diff, en vez de pasar inadvertida.

---

## 7. Verificación de cierre

El documento se auto-verifica. El gate re-ejecutable vive en
[`check-crons.sh`](./check-crons.sh) — read-only, sin red, sin DB, corre en segundos:

```bash
cd .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia
bash check-crons.sh              # modo reporte: imprime todo, exit 0 siempre
STRICT=1 bash check-crons.sh     # modo cierre de fase: cualquier falta => exit 1
```

Los greps van **embebidos aquí** para que el gate no dependa del script: si mañana
`check-crons.sh` desapareciera, el documento seguiría siendo verificable a mano.

```bash
# C1a — denominador DERIVADO del filesystem, contra el declarado en §1.1.
#       El ancla ESPERADO=13 se REPORTA con el diff si difiere; jamás se ajusta.
ls .github/workflows/*.yml | wc -l                                  # 13
grep -E '^conteo_workflows_locales: [0-9]+$' 118-CRON-VERDICTS.md    # 13

# C1b — pg_cron cross-checkeado contra DOS fuentes independientes.
grep -E '^conteo_pg_cron_vivos: [0-9]+$' 118-CRON-VERDICTS.md        # 5
grep -c '^### PG-[0-9]' 118-CRON-VERDICTS.md                         # 5  (secciones)
awk '/^## P6 —/,/^## P7/' 118-PROBES-RAW.md | grep -cE '^[0-9]+\|[a-z0-9-]+\|'   # 5 (probe)

# C1c — el total es la SUMA, y hay un veredicto por unidad EN CADA REGIÓN.
#       Ojo: el conteo global de "Veredicto: " da 40, no 20 — cada unidad aparece dos
#       veces por diseño (fila en §1.3 + sección en §2). Se cuenta por región.
grep -E '^conteo_total_unidades: [0-9]+$' 118-CRON-VERDICTS.md       # 20 = 13 + 2 + 5
awk '/^### 1\.3 /,/^### 1\.4 /' 118-CRON-VERDICTS.md | grep -c 'Veredicto: '        # 20
awk '/^## 2\. Unidades/,/^## 3\. Estado/' 118-CRON-VERDICTS.md | grep -c 'Veredicto: ' # 20

# C2 — evidencia observada, no lectura de YAML.
grep -c '^#### Evidencia observada' 118-CRON-VERDICTS.md             # 20 >= 20 unidades

# C3 — punteros archivo:línea asociados a gaps.
grep -cE 'G[0-9]+.*\.(ts|yml|sql):[0-9]+' 118-CRON-VERDICTS.md       # 12 >= 10

# C4 — gap-list priorizada + §5 completa + §6 con límites numerados.
grep -cE '^\| G[0-9]+ \| .* \| \*\*P[012]\*\*[^|]*\|' 118-CRON-VERDICTS.md          # 11
awk '/^## 5\./,/^## 6\./' 118-CRON-VERDICTS.md | grep -cE '^\| (A[1-5]|OQ[1-4]) \|' # 9
awk '/^## 6\. Límites/,/^## 7\./' 118-CRON-VERDICTS.md | grep -cE '^[0-9]+\. '       # 9

# C5 — reproducibilidad por unidad.
grep -c '^#### Cómo re-verificar' 118-CRON-VERDICTS.md               # 21 >= 20

# C6 — ANTI-SECRETO sobre los TRES artefactos. Ambos deben dar 0.
grep -icE '(sk|ghp|gho|eyJ|sb_secret_|sb_publishable_)[-_a-z0-9]{12,}|[0-9a-f]{40}' \
  118-CRON-VERDICTS.md 118-PROBES-RAW.md 118-OPERATOR-CHECKPOINT.md
grep -icE 'postgres(ql)?://' \
  118-CRON-VERDICTS.md 118-PROBES-RAW.md 118-OPERATOR-CHECKPOINT.md

# C7 — ids G<n> bidireccionales §2 <-> §4 (el patrón exige G pegado a dígito:
#      'PG-1' no casa, así que los jobs de pg_cron no contaminan el conteo).
awk '/^## 2\. Unidades/,/^## 3\. Estado/' 118-CRON-VERDICTS.md | grep -oE '\bG[0-9]+\b' | sort -u
awk '/^## 4\. Gaps/,/^## 5\./'           118-CRON-VERDICTS.md | grep -oE '\bG[0-9]+\b' | sort -u
```

**Higiene del propio gate.** `check-crons.sh` contiene en su código los mismos patrones de
secreto que busca; por eso C6 se aplica **a los tres artefactos y nunca al script**, que ni
siquiera figura en la lista de archivos escaneados. El patrón se validó contra un fixture
temporal creado **fuera del repo** y borrado tras la prueba: detectó los seis casos positivos
(`sk`, `ghp`, `gho`, `eyJ`, `sb_secret_`/`sb_publishable_`, hex-40) más la URL de DB, y no marcó
el falso positivo obvio del castellano (`skip legítimo`). Los conteos que se hacen sobre el
documento se toman **por región** (`awk` de §1.3, §2, §4, §5, §6) precisamente para que los
bloques de código de este §7 no se cuenten a sí mismos.

**Estado al cierre:** `STRICT=1 bash check-crons.sh` → **0 faltas, exit 0**.

---

### Firma de cierre

Auditoría cerrada el **2026-07-28** sobre `Cuchecorp/gov-map`, con **20 unidades de cron**
inventariadas (13 workflows locales + 2 platform-managed + 5 jobs de `pg_cron`) y un veredicto
por unidad: **10 verde · 1 stale · 0 roto · 9 no-cron**. Backlog para Phase 119: **11 gaps —
0 P0, 5 P1, 6 P2**.

**Probes usadas:** P0 (inventario local), P1 (`gh workflow list` remoto), P2 (última corrida por
workflow), P3.a/P3.b (logs de los dos `failure`), P4 (`gh secret list`, NOMBRES), P5 (billing),
P6a/P6 (`cron.job` + `job_run_details` vivos), P7 (última fila por tabla destino), P8 (cursores),
P9 (`freshness --json`), P10 (`source_snapshot` como proxy de R2). Bitácora literal en
[`118-PROBES-RAW.md`](./118-PROBES-RAW.md).

**Ningún valor de secret fue impreso en este documento.**
