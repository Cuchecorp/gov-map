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
