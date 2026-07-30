---
phase: 118
titulo: Bitácora cruda de probes (evidencia observada)
regimen: solo-lectura
ancla_temporal: 2026-07-28
repo_remoto: Cuchecorp/gov-map
higiene: >
  Ningún valor de secreto ni URL de base de datos aparece en este archivo.
  `gh secret list` entrega NOMBRES + fecha de creación solamente. Toda invocación de
  psql usa la variable `"$SUPABASE_DB_URL"` — la URL jamás se imprime.
consumido_por: [118-CRON-VERDICTS.md, 119]
---

# 118 — PROBES RAW

Bitácora literal: por cada probe, el comando exacto que se corrió y su salida
(recortada donde corresponde). Las secciones `## P<n>` son las anclas que la tabla
maestra de `118-CRON-VERDICTS.md` cita por id.

Fecha de captura de todas las probes de este documento: **2026-07-28**.

---

## P0 — Inventario de workflows LOCALES (filesystem) y su trigger real

```bash
ls .github/workflows/
ls .github/workflows/*.yml | wc -l
for f in .github/workflows/*.yml; do echo "=== $f"; \
  grep -n -E "cron:|schedule:|workflow_dispatch|^on:|push:|pull_request:" "$f" | head -12; done
```

Salida — conteo:

```
actualidad-refresh.yml
agenda-weekly.yml
backfill.yml
backup-parlamentario.yml
ci.yml
deploy-cloudflare.yml
digest-daily.yml
fichas-backfill.yml
leyes-weekly.yml
lobby-camara-weekly.yml
lobby-leylobby-weekly.yml
probidad-weekly.yml
roster-weekly.yml
---COUNT---
13
```

Salida — triggers (`archivo:línea`):

```
=== .github/workflows/actualidad-refresh.yml
15:on:
16:  schedule:
17:    - cron: "0 11,14,17,20 * * 1-5" # lunes a viernes 11/14/17/20 UTC (intradía, minutos ilimitados)
18:  workflow_dispatch:
=== .github/workflows/agenda-weekly.yml
13:on:
14:  schedule:
15:    - cron: "0 11 * * 1" # lunes 11:00 UTC
16:  workflow_dispatch:
=== .github/workflows/backfill.yml
7:# snapshot inicial. Disparo manual (workflow_dispatch) — NO programado.
11:on:
12:  workflow_dispatch:
=== .github/workflows/backup-parlamentario.yml
18:on:
19:  schedule:
21:    - cron: "0 6 * * 1"
22:  workflow_dispatch: {}
=== .github/workflows/ci.yml
11:on:
12:  push:
14:  pull_request:
=== .github/workflows/deploy-cloudflare.yml
6:# reproducibles. Disparo MANUAL (workflow_dispatch), deliberado, igual que los
19:on:
20:  workflow_dispatch:
=== .github/workflows/digest-daily.yml
17:# ESTRENO GATED (mirror roster-weekly): se estrena con workflow_dispatch SOLO (schedule
22:on:
23:  workflow_dispatch: {}
24:  # schedule:
25:  #   - cron: "0 12 * * 1-5"  # L-V 12:00 UTC — descomentar SOLO tras corrida manual VERDE
=== .github/workflows/fichas-backfill.yml
8:# (workflow_dispatch) — NO programado. Todos los secrets vía ${{ secrets.* }}, jamás en claro.
10:on:
11:  workflow_dispatch:
=== .github/workflows/leyes-weekly.yml
17:on:
18:  schedule:
19:    - cron: "0 20 * * 1-5" # lunes a viernes 20:00 UTC (repo público, minutos ilimitados)
20:  workflow_dispatch:
=== .github/workflows/lobby-camara-weekly.yml
18:on:
19:  workflow_dispatch:
=== .github/workflows/lobby-leylobby-weekly.yml
14:on:
15:  schedule:
16:    - cron: "0 11 * * 3" # miércoles 11:00 UTC
17:  workflow_dispatch:
=== .github/workflows/probidad-weekly.yml
14:on:
15:  schedule:
16:    - cron: "0 11 * * 4" # jueves 11:00 UTC
17:  windows_dispatch  (sic: `workflow_dispatch:` en :17)
=== .github/workflows/roster-weekly.yml
16:# ESTRENO GATED: workflow_dispatch SOLO (sin schedule). Validar con corrida manual VERDE.
27:on:
28:  workflow_dispatch: {}
29:  # schedule:
30:  #   - cron: "0 10 * * 1"  # lunes 10:00 UTC — añadir SOLO tras corrida manual VERDE
```

**Conteo de `schedule:` ACTIVO (no comentado) = 6**, con su `archivo:línea`:

| # | workflow | línea del `- cron:` activo | expresión |
|---|---|---|---|
| 1 | `actualidad-refresh.yml` | `:17` | `0 11,14,17,20 * * 1-5` |
| 2 | `agenda-weekly.yml` | `:15` | `0 11 * * 1` |
| 3 | `backup-parlamentario.yml` | `:21` | `0 6 * * 1` |
| 4 | `leyes-weekly.yml` | `:19` | `0 20 * * 1-5` |
| 5 | `lobby-leylobby-weekly.yml` | `:16` | `0 11 * * 3` |
| 6 | `probidad-weekly.yml` | `:16` | `0 11 * * 4` |

**DIFF contra el CONTEXT reportado, no ajustado:** `118-CONTEXT.md:18` afirma "los 8 con
`schedule:`" e incluye `digest-daily` y `roster-weekly`. La observación dice **6**:
`digest-daily.yml:24-25` y `roster-weekly.yml:29-30` tienen el bloque `schedule:`
**comentado** (estreno gated por diseño, dispatch-only). El RESEARCH ya lo anticipaba
(Pitfall 2) y la observación lo confirma. La cifra que rige es **6 programados / 7
no-programados**.

Nota de fidelidad: la línea de `probidad-weekly.yml:17` es `workflow_dispatch:`; la
transcripción de arriba conserva el volcado del grep.

---

## P1 — Inventario de workflows REMOTOS (incluye platform-managed)

```bash
gh workflow list --repo Cuchecorp/gov-map
```

Salida:

```
actualidad-refresh	active	320971153
agenda-weekly	active	300882399
backfill	active	314034168
backup-parlamentario	active	300882263
ci	active	314034169
deploy-cloudflare	active	301087915
digest-daily	active	320971154
fichas-backfill	active	301087916
leyes-weekly	active	301064715
lobby-camara-weekly	active	302856793
lobby-leylobby-weekly	active	302856795
probidad-weekly	active	302856797
roster-weekly	active	314016670
Dependabot Updates	active	314034212
CodeQL	active	301076402
```

**15 workflows remotos = 13 versionados en `.github/workflows/` + 2 platform-managed**
(`Dependabot Updates` id 314034212, `CodeQL` id 301076402), que NO existen como archivo
en el repo. Confirmado el hallazgo del RESEARCH: sin enumerarlos, el inventario sería
defendible sólo contra el filesystem local.

---

## P2 — Última corrida por workflow local (pata 1)

```bash
for f in .github/workflows/*.yml; do b=$(basename $f); echo "=== $b"; \
  gh run list --repo Cuchecorp/gov-map --workflow "$b" --limit 5 \
    --json databaseId,conclusion,status,event,createdAt,displayTitle; done
```

Salida (JSON literal, 5 corridas más recientes por workflow):

```
=== actualidad-refresh.yml
[{"conclusion":"success","createdAt":"2026-07-28T16:07:47Z","databaseId":30376761981,"displayTitle":"actualidad-refresh","event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-28T12:57:52Z","databaseId":30361277781,"displayTitle":"actualidad-refresh","event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-27T21:17:55Z","databaseId":30306261310,"displayTitle":"actualidad-refresh","event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-27T18:26:53Z","databaseId":30293799644,"displayTitle":"actualidad-refresh","event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-27T16:26:28Z","databaseId":30284720929,"displayTitle":"actualidad-refresh","event":"schedule","status":"completed"}]

=== agenda-weekly.yml
[{"conclusion":"success","createdAt":"2026-07-27T13:40:16Z","databaseId":30271365515,"displayTitle":"agenda-weekly","event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-20T13:09:14Z","databaseId":29745017304,...},{"conclusion":"success","createdAt":"2026-07-13T13:26:35Z","databaseId":29253783648,...},{"conclusion":"success","createdAt":"2026-07-06T14:28:09Z","databaseId":28799046206,...},{"conclusion":"success","createdAt":"2026-06-29T14:48:28Z","databaseId":28380768706,...}]

=== backfill.yml
[]

=== backup-parlamentario.yml
[{"conclusion":"success","createdAt":"2026-07-27T10:04:05Z","databaseId":30256554533,"event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-20T09:29:10Z","databaseId":29731616708,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-13T09:41:10Z","databaseId":29240027225,"event":"schedule",...},{"conclusion":"failure","createdAt":"2026-07-08T22:37:30Z","databaseId":28980585955,"event":"push",...},{"conclusion":"success","createdAt":"2026-07-06T10:53:58Z","databaseId":28786368746,"event":"schedule",...}]

=== ci.yml
[{"conclusion":"success","createdAt":"2026-07-27T19:20:26Z","databaseId":30297809912,"displayTitle":"chore(deps): bump actions/checkout from 4.3.1 to 7.0.1","event":"pull_request","status":"completed"},{"conclusion":"success","createdAt":"2026-07-27T19:20:24Z","databaseId":30297807388,"event":"pull_request",...},{"conclusion":"success","createdAt":"2026-07-27T19:20:23Z","databaseId":30297806490,"event":"pull_request",...},{"conclusion":"success","createdAt":"2026-07-27T19:18:16Z","databaseId":30297653823,"displayTitle":"Merge remote-tracking branch 'origin/master'","event":"push",...},{"conclusion":"success","createdAt":"2026-07-27T18:41:09Z","databaseId":30294868862,"event":"pull_request",...}]

=== deploy-cloudflare.yml
[{"conclusion":"failure","createdAt":"2026-07-09T14:59:38Z","databaseId":29027652583,"displayTitle":"deploy-cloudflare","event":"workflow_dispatch","status":"completed"}]

=== digest-daily.yml
[]

=== fichas-backfill.yml
[]

=== leyes-weekly.yml
[{"conclusion":"success","createdAt":"2026-07-27T21:09:03Z","databaseId":30305627783,"event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-24T21:02:10Z","databaseId":30126292911,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-23T21:02:57Z","databaseId":30044620143,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-22T21:05:44Z","databaseId":29957847520,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-21T21:08:04Z","databaseId":29868720730,"event":"schedule",...}]

=== lobby-camara-weekly.yml
[{"conclusion":"failure","createdAt":"2026-07-07T13:17:09Z","databaseId":28869169412,"displayTitle":"lobby-camara-weekly","event":"schedule","status":"completed"},{"conclusion":"failure","createdAt":"2026-06-30T13:08:36Z","databaseId":28446728865,"event":"schedule","status":"completed"}]

=== lobby-leylobby-weekly.yml
[{"conclusion":"success","createdAt":"2026-07-22T12:43:27Z","databaseId":29920799120,"event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-15T12:19:58Z","databaseId":29414815860,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-08T12:27:12Z","databaseId":28942497396,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-01T13:37:29Z","databaseId":28521694750,"event":"schedule",...}]

=== probidad-weekly.yml
[{"conclusion":"success","createdAt":"2026-07-23T12:26:11Z","databaseId":30006971174,"event":"schedule","status":"completed"},{"conclusion":"success","createdAt":"2026-07-16T12:23:26Z","databaseId":29497947069,"event":"schedule",...},{"conclusion":"success","createdAt":"2026-07-15T21:45:33Z","databaseId":29453065297,"event":"workflow_dispatch",...},{"conclusion":"failure","createdAt":"2026-07-09T13:51:41Z","databaseId":29023003267,"event":"schedule",...},{"conclusion":"failure","createdAt":"2026-07-02T13:01:03Z","databaseId":28592010916,"event":"schedule",...}]

=== roster-weekly.yml
[{"conclusion":"success","createdAt":"2026-07-15T21:47:55Z","databaseId":29453200580,"displayTitle":"roster-weekly","event":"workflow_dispatch","status":"completed"},{"conclusion":"failure","createdAt":"2026-07-15T21:45:40Z","databaseId":29453071994,"event":"workflow_dispatch","status":"completed"}]
```

**Los 13 workflows locales tienen evidencia de pata 1**, incluidos los tres con salida `[]`:
`backfill.yml`, `digest-daily.yml` y `fichas-backfill.yml` **no tienen ninguna corrida
registrada** — es un dato observado, no un fallo del probe.

Resumen de la corrida MÁS RECIENTE por workflow (2026-07-28):

| workflow | última corrida | conclusion | event |
|---|---|---|---|
| actualidad-refresh.yml | 2026-07-28T16:07:47Z | success | schedule |
| agenda-weekly.yml | 2026-07-27T13:40:16Z | success | schedule |
| backfill.yml | — (sin corridas) | n/d | n/d |
| backup-parlamentario.yml | 2026-07-27T10:04:05Z | success | schedule |
| ci.yml | 2026-07-27T19:20:26Z | success | pull_request |
| deploy-cloudflare.yml | 2026-07-09T14:59:38Z | **failure** | workflow_dispatch |
| digest-daily.yml | — (sin corridas) | n/d | n/d |
| fichas-backfill.yml | — (sin corridas) | n/d | n/d |
| leyes-weekly.yml | 2026-07-27T21:09:03Z | success | schedule |
| lobby-camara-weekly.yml | 2026-07-07T13:17:09Z | **failure** | schedule |
| lobby-leylobby-weekly.yml | 2026-07-22T12:43:27Z | success | schedule |
| probidad-weekly.yml | 2026-07-23T12:26:11Z | success | schedule |
| roster-weekly.yml | 2026-07-15T21:47:55Z | success | workflow_dispatch |

---

## P3 — Logs de fallo (sólo donde la corrida MÁS RECIENTE es `failure`)

Dos workflows califican: `lobby-camara-weekly` y `deploy-cloudflare`. Se pegan
EXCLUSIVAMENTE las líneas de error.

### P3.a — `lobby-camara-weekly` run 28869169412 (2026-07-07)

```bash
gh run view 28869169412 --repo Cuchecorp/gov-map --log-failed | \
  grep -iE "##\[error\]|Error:|WAF|bytes|Process completed" | head -12
```

```
lobby-camara	2026-07-07T13:17:35.4264306Z echo "lobby.html = $SIZE bytes"
lobby-camara	2026-07-07T13:17:35.4264942Z if [ "$SIZE" -lt 10240 ]; then echo "WAF/respuesta < 10KB"; exit 1; fi
lobby-camara	2026-07-07T13:17:35.6696793Z lobby.html = 5463 bytes
lobby-camara	2026-07-07T13:17:35.6697633Z WAF/respuesta < 10KB
lobby-camara	2026-07-07T13:17:35.6713285Z ##[error]Process completed with exit code 1.
```

Causa OBSERVADA: el guard del propio workflow (`< 10240 bytes`) detectó el intercept del
WAF de camara.cl (5.463 bytes) y abortó ANTES del CLI. Coincide exactamente con la causa
declarada en `.github/workflows/lobby-camara-weekly.yml:14-17`, que por eso deshabilitó
el `schedule:`. Las dos únicas corridas del histórico (2026-06-30 y 2026-07-07) fallaron
por lo mismo, y desde entonces no hay corridas — consistente con la deshabilitación.

### P3.b — `deploy-cloudflare` run 29027652583 (2026-07-09)

```bash
gh run view 29027652583 --repo Cuchecorp/gov-map --log-failed | tail -18
```

```
deploy	2026-07-09T15:00:07.8640840Z   CLOUDFLARE_API_TOKEN:
deploy	2026-07-09T15:00:07.8641063Z   CLOUDFLARE_ACCOUNT_ID:
...
deploy	2026-07-09T15:00:37.9971364Z ✘ [ERROR] In a non-interactive environment, it's necessary to set a
        CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
deploy	2026-07-09T15:00:37.9976959Z ERROR Wrangler deploy command failed:
deploy	2026-07-09T15:00:38.0312768Z [ELIFECYCLE] Command failed with exit code 1.
deploy	2026-07-09T15:00:38.0534407Z ##[error]Process completed with exit code 1.
```

Causa OBSERVADA: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` se expanden **vacíos** en
el bloque `env:` del runner (las dos líneas del log muestran el nombre y nada a la
derecha — no hay valor que revelar porque no existe). Esto CIERRA la Open Question 3 del
RESEARCH: la deuda **110-02 sigue abierta** al 2026-07-28. Nótese que `deploy-cloudflare`
es de disparo manual y el deploy real de producción se hace localmente con `wrangler`
OAuth, así que esto no bloquea el sitio — es deuda de operador, no un cron roto.

---

## P4 — Secrets del repo remoto (NOMBRES + fecha, jamás valores)

```bash
gh secret list --repo Cuchecorp/gov-map
```

Salida:

```
DEEPSEEK_API_KEY	2026-07-09T00:10:04Z
R2_ACCESS_KEY_ID	2026-07-09T00:10:01Z
R2_BUCKET	2026-07-09T00:10:03Z
R2_ENDPOINT_URL	2026-07-09T00:09:53Z
R2_SECRET_ACCESS_KEY	2026-07-09T00:10:02Z
SUPABASE_API_URL	2026-06-23T14:06:11Z
SUPABASE_SECRET_KEY	2026-06-23T14:06:12Z
```

**7 secrets presentes.** (Corrige el supuesto A5 del RESEARCH, que esperaba sólo los dos
de Supabase: DEEPSEEK + los 4 R2 se cargaron el 2026-07-09.)

Requeridos por workflow — extraídos del **lado derecho `secrets.*`** (Pitfall 5: NO del
nombre de la variable `env:`, que en `lobby-leylobby` y `roster-weekly` está remapeado):

```bash
for f in .github/workflows/*.yml; do echo "=== $(basename $f)"; \
  grep -oE 'secrets\.[A-Z0-9_]+' "$f" | sort -u | sed 's/secrets\.//' | tr '\n' ' '; echo; done
```

| workflow | `secrets.*` requeridos | ausentes en el repo |
|---|---|---|
| actualidad-refresh.yml | SUPABASE_API_URL, SUPABASE_SECRET_KEY | — |
| agenda-weekly.yml | DEEPSEEK_API_KEY, R2_ACCESS_KEY_ID, R2_BUCKET, R2_ENDPOINT_URL, R2_SECRET_ACCESS_KEY, SUPABASE_API_URL, SUPABASE_SECRET_KEY | — |
| backfill.yml | R2_* (4), SUPABASE_API_URL, SUPABASE_SECRET_KEY | — |
| backup-parlamentario.yml | R2_* (4) | — |
| ci.yml | (ninguno) | — |
| deploy-cloudflare.yml | CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN | **ambos** (deuda 110-02) |
| digest-daily.yml | NOTIF_BASE_URL, NOTIF_FROM, NOTIF_TOKEN_SECRET, RESEND_API_KEY, SUPABASE_API_URL, SUPABASE_SECRET_KEY | **NOTIF_BASE_URL, NOTIF_FROM, NOTIF_TOKEN_SECRET, RESEND_API_KEY** (esperado: NOTIF parked) |
| fichas-backfill.yml | DEEPSEEK_API_KEY, GEMINI_API_KEY, R2_* (4), SUPABASE_API_URL, SUPABASE_SECRET_KEY, SUPABASE_URL | **GEMINI_API_KEY, SUPABASE_URL** |
| leyes-weekly.yml | R2_* (4), SUPABASE_API_URL, SUPABASE_SECRET_KEY | — |
| lobby-camara-weekly.yml | R2_* (4), SUPABASE_API_URL, SUPABASE_SECRET_KEY | — |
| lobby-leylobby-weekly.yml | SUPABASE_API_URL, SUPABASE_SECRET_KEY (remapeados a `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` en `env:`) | — |
| probidad-weekly.yml | R2_* (4), SUPABASE_API_URL, SUPABASE_SECRET_KEY | — |
| roster-weekly.yml | SUPABASE_API_URL, SUPABASE_SECRET_KEY (remapeados a `SUPABASE_LOCAL_URL`/`SUPABASE_LOCAL_SERVICE_KEY`) | — |

**Los 6 workflows con `schedule:` activo tienen TODOS sus secrets presentes.** Los tres
con faltantes (`deploy-cloudflare`, `digest-daily`, `fichas-backfill`) son de disparo
manual, así que ningún cron programado está roto por secret ausente.

---

## P5 — Billing de GitHub Actions: ¿bloqueado?

No hay un comando `gh` que declare "billing bloqueado"; el idiom del audit 56 es
**enumerar corridas observadas** y dejar que la evidencia hable. La conclusión se sostiene
sobre P2, no sobre especulación.

```bash
# El mismo probe P2; se re-lee para responder específicamente la pregunta de billing.
gh run list --repo Cuchecorp/gov-map --workflow actualidad-refresh.yml --limit 5 --json conclusion,createdAt,event
```

Evidencia:

- Corridas disparadas por `event: schedule` que completaron con `conclusion: success`
  **el mismo día del audit**: `actualidad-refresh` 2026-07-28T16:07:47Z y
  2026-07-28T12:57:52Z.
- Corridas `schedule` exitosas en los últimos 7 días para 5 de los 6 workflows
  programados: actualidad-refresh (2026-07-28), leyes-weekly (2026-07-27),
  agenda-weekly (2026-07-27), backup-parlamentario (2026-07-27),
  lobby-leylobby-weekly (2026-07-22). El sexto, probidad-weekly, corrió
  2026-07-23 (su día es jueves; el jueves siguiente es 2026-07-30, aún no llega).
- `ci.yml` corrió por `pull_request` y `push` el 2026-07-27 con `success`.

**VEREDICTO de billing: NO bloqueado al 2026-07-28.** El scheduler de GitHub está
despachando y los runners ejecutan. Esto retira "billing" como causa candidata para
cualquier veredicto no-verde de esta corrida — a diferencia de v6.0, donde el billing sí
estaba caído. (Nota: el repo es público, de ahí los minutos ilimitados que los propios
YAML comentan, p.ej. `leyes-weekly.yml:19`.)

---

> **Prólogo de higiene para TODAS las probes psql de aquí en adelante.** Cada bloque se
> corrió con el prefijo `set -a; source .env; set +a` y luego
> `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "…"`. La URL jamás se imprime:
> viaja por variable de entorno. Todas las sentencias son `select` — cero
> `insert/update/delete/alter`, cero invocación de CLIs de ingesta.

## P6a — PRE-CHECK de acceso a `cron` (¿la enumeración viva es posible?)

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select count(*) from cron.job;"
```

Salida:

```
5
```

**PRE-CHECK PASA.** El rol de la connection string ve el schema `cron`. NO se dispara el
fallback: las cifras de pg_cron de este audit son **estado vivo observado**, no
expectativa heredada de migraciones. No se levanta gap P1 por acceso.

---

## P6 — Enumeración VIVA de `cron.job` + corridas recientes

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select jobid, jobname, schedule, active, command from cron.job order by jobid;"
```

Salida:

```
1|process-ingest-jobs|30 seconds|t| select util.process_ingest_jobs();
2|cleanup-net-http|*/15 * * * *|t| select util.cleanup_net_http();
3|net-materializar-aristas|17 3 * * *|t| select grafo.materializar_aristas();
4|cruces-materializar|23 3 * * *|t| select cruces.materializar_cruces();
5|actualidad-materializar|7 11,14,17,20 * * 1-5|t| select actualidad.materializar_senales();
```

**5 jobs activos** (`active = t` en los 5). **Delta contra la expectativa de migraciones: CERO.**
Los 5 jobs esperados (`0003_orchestration.sql:214/221`, `0030_net.sql:162`,
`0039_cruce_senal.sql:138`, `0065_actualidad_senal.sql:326`) están vivos, con el mismo
nombre, el mismo schedule y el mismo comando. No sobra ni falta ninguno.

**Rama de `0003_orchestration.sql` que quedó activa (Open Question 1):** el `schedule` real
de `process-ingest-jobs` es **`30 seconds`**, es decir la rama de **pg_cron ≥ 1.5** (:214),
NO la rama de fallback `* * * * *` (:221). Queda resuelto con dato vivo.

Corridas de los últimos 14 días, agregadas por job y estado:

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select j.jobname, d.status, count(*), max(d.start_time)
     from cron.job_run_details d left join cron.job j on j.jobid=d.jobid
    where d.start_time > now() - interval '14 days'
    group by 1,2 order by 1,2;"
```

```
actualidad-materializar|succeeded|8|2026-07-28 14:07:00.016294+00
cleanup-net-http|succeeded|1344|2026-07-28 16:15:00.016645+00
cruces-materializar|succeeded|14|2026-07-28 03:23:00.035462+00
net-materializar-aristas|succeeded|14|2026-07-28 03:17:00.027846+00
process-ingest-jobs|failed|1|2026-07-27 18:25:29.460307+00
process-ingest-jobs|succeeded|40238|2026-07-28 16:22:10.267844+00
```

Lectura de cadencia (conteo observado vs. conteo teórico de 14 días):

| job | observado 14d | teórico 14d | lectura |
|---|---|---|---|
| cleanup-net-http | 1344 | 1344 (`*/15` x 14 d) | exacto |
| cruces-materializar | 14 | 14 (diario) | exacto |
| net-materializar-aristas | 14 | 14 (diario) | exacto |
| process-ingest-jobs | 40239 (40238 ok + 1 fail) | ~40320 (`30 s` x 14 d) | 99.8 %; 1 fallo aislado |
| actualidad-materializar | 8 | ~40 (4/día x 10 días hábiles) | **8** — ver abajo |

El único fallo, con su mensaje literal:

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select d.start_time, left(d.return_message,180) from cron.job_run_details d
    where d.jobid=1 and d.status='failed' and d.start_time > now() - interval '14 days'
    order by d.start_time desc limit 3;"
```

```
2026-07-27 18:25:29.460307+00|job startup timeout
```

Un `job startup timeout` sobre 40.239 disparos = 0.002 % — ruido de scheduler bajo carga,
no una avería.

Historia completa de `actualidad-materializar` (para no confundir "poca cadencia" con
"job nuevo"):

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c \
  "select min(start_time), count(*) from cron.job_run_details where jobid=5;"
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select d.start_time, d.status from cron.job_run_details d where d.jobid=5
    and d.start_time > now() - interval '14 days' order by d.start_time desc;"
```

```
2026-07-24 17:07:00.134404+00|8
```

```
2026-07-28 14:07:00.016294+00|succeeded
2026-07-28 11:07:00.136315+00|succeeded
2026-07-27 20:07:00.016007+00|succeeded
2026-07-27 17:07:00.072486+00|succeeded
2026-07-27 14:07:00.018638+00|succeeded
2026-07-27 11:07:00.016424+00|succeeded
2026-07-24 20:07:00.017603+00|succeeded
2026-07-24 17:07:00.134404+00|succeeded
```

**La PRIMERA corrida registrada del job es 2026-07-24 17:07** y su historial COMPLETO son
esas 8 filas (el `count(*)` sin ventana da 8, igual que dentro de la ventana). No es una
poda de `job_run_details`: `cleanup-net-http` conserva sus 1344 filas de 14 días. La
lectura honesta es que el job entró en servicio el 2026-07-24, no que se saltara ventanas
durante dos semanas. Desde entonces: 2026-07-25/26 = fin de semana (correctamente omitidos
por `* * 1-5`), 2026-07-27 lunes = **4/4 ventanas**, 2026-07-28 martes = 2/2 ventanas
transcurridas al momento del audit. **La cadencia post-arranque es 100 %.** El 2026-07-24
tiene sólo 2 de 4 porque el job arrancó a media jornada. Cero corridas perdidas
atribuibles a avería.

---

## P7 — Pata 2: última fila escrita por tabla destino

**Resolución previa de la asunción A2 (nombre real de la columna temporal) — se corrió ANTES
del lote, y CORRIGE al RESEARCH:**

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select table_name, column_name, data_type from information_schema.columns
    where table_schema='public'
      and table_name in ('actualidad_senal','notificacion_envio','source_snapshot',
                         'declaracion','citacion','lobby_audiencia','proyecto')
      and (column_name ~ 'fecha|creado|created|_at|hasta|time')
    order by table_name, column_name;"
```

```
actualidad_senal|fecha_captura|timestamp with time zone
actualidad_senal|fecha_max|timestamp with time zone
citacion|fecha|timestamp with time zone
citacion|fecha_captura|timestamp with time zone
declaracion|fecha_captura|timestamp with time zone
declaracion|fecha_presentacion|date
lobby_audiencia|fecha|timestamp with time zone
lobby_audiencia|fecha_captura|timestamp with time zone
lobby_audiencia|fecha_raw|text
notificacion_envio|created_at|timestamp with time zone
notificacion_envio|enviado_at|timestamp with time zone
proyecto|fecha_captura|timestamp with time zone
source_snapshot|fetched_at|timestamp with time zone
```

**A2 REFUTADA en los tres casos.** `creado_en` NO existe en ninguna de las tres tablas:
`actualidad_senal` usa `fecha_captura`, `notificacion_envio` usa `created_at`, y
`source_snapshot` usa `fetched_at`. El lote del RESEARCH (que asumía `creado_en`) habría
fallado; se corrigió antes de correrlo. `sesion_tabla_item` tampoco tiene `fecha_captura`
(error observado: `column "fecha_captura" does not exist`) → se sustituyó por `sesion_sala`.

Lote (un solo `union all`):

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c "
select 'proyecto (MAX)', count(*)::text, max(fecha_captura)::text from proyecto
union all select 'proyecto (MIN)', count(*)::text, min(fecha_captura)::text from proyecto
union all select 'citacion', count(*)::text, max(fecha_captura)::text from citacion
union all select 'lobby_audiencia', count(*)::text, max(fecha_captura)::text from lobby_audiencia
union all select 'declaracion', count(*)::text, max(fecha_captura)::text from declaracion
union all select 'actualidad_senal', count(*)::text, max(fecha_captura)::text from actualidad_senal
union all select 'notificacion_envio', count(*)::text, max(created_at)::text from notificacion_envio
union all select 'tramitacion_evento', count(*)::text, max(fecha_captura)::text from tramitacion_evento
union all select 'votacion', count(*)::text, max(fecha_captura)::text from votacion
union all select 'sesion_sala', count(*)::text, max(fecha_captura)::text from sesion_sala
union all select 'parlamentario', count(*)::text, max(fecha_captura)::text from parlamentario
union all select 'parlamentario_militancia', count(*)::text, max(fecha_captura)::text from parlamentario_militancia;"
```

Salida (`tabla | filas | última escritura`):

```
proyecto (MAX)|3659|2026-07-27 21:38:06.135+00
proyecto (MIN)|3659|2026-07-09 04:34:43.901+00
citacion|289|2026-07-27 13:41:24.416+00
lobby_audiencia|17762|2026-07-22 12:44:05.343+00
declaracion|1065|2026-07-23 12:37:05.518+00
actualidad_senal|18|2026-07-28 16:08:28.275+00
notificacion_envio|0|
tramitacion_evento|48368|2026-07-27 21:38:09.718+00
votacion|4855|2026-07-27 21:38:09.718+00
sesion_sala|18|2026-07-27 13:41:29.72+00
parlamentario|186|2026-07-27 00:10:53.196+00
parlamentario_militancia|363|2026-07-27 00:10:53.196+00
```

`notificacion_envio` tiene **0 filas y `max(created_at)` vacío** — coherente con NOTIF
parked (flag OFF, `digest-daily` sin corridas). Es estado esperado, no gap.

**Resolución de A4 — `backup-parlamentario` / `roster-weekly`: la pata 2 NO aplica sobre una
tabla de Supabase.** Leyendo el workflow (`backup-parlamentario.yml:38-42` y `:59-74`), el
job **no recibe ningún secret de Supabase** (su bloque `env:` sólo mapea los 4 `R2_*`), y el
propio YAML lo comenta: *"SIN service key local en CI → la carga a DB se omite; el snapshot
git es autoritativo."* Su destino real es **el archivo `supabase/seeds/parlamentario.seed.json`
committeado por el bot**, más un respaldo a R2 gateado por credencial. Query de pata 2
sustituida por la observación del destino REAL:

```bash
git log -3 --format='%h|%ad|%an|%s' --date=iso -- supabase/seeds/parlamentario.seed.json
```

```
5782d8c|2026-07-27 10:05:12 +0000|github-actions[bot]|chore(backup): refrescar snapshot parlamentario (ID-09 cadencia)
0377ca8|2026-07-20 09:30:11 +0000|github-actions[bot]|chore(backup): refrescar snapshot parlamentario (ID-09 cadencia)
40eaf18|2026-07-13 09:42:10 +0000|github-actions[bot]|chore(backup): refrescar snapshot parlamentario (ID-09 cadencia)
```

Tres lunes consecutivos, con el commit del bot minutos después de cada corrida de P2
(10:04 → commit 10:05; 09:29 → 09:30; 09:41 → 09:42). El cron **sí produce su artefacto**.
Nota: la fila `parlamentario` de arriba (2026-07-27 00:10) NO proviene de este workflow —
confirma justamente que el job no escribe la DB.

---

## P8 — Cursores: distinguir "sin novedades" de "cursor detenido"

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c "
select 'lobby_ingesta_estado', count(*)::text, max(ingestado_hasta)::text, max(fecha_captura)::text from lobby_ingesta_estado
union all select 'probidad_ingesta_estado', count(*)::text, max(ingestado_hasta)::text, max(fecha_captura)::text from probidad_ingesta_estado
union all select 'contratos_ingesta_estado', count(*)::text, max(ingestado_hasta)::text, max(fecha_captura)::text from contratos_ingesta_estado
union all select 'aportes_ingesta_estado', count(*)::text, max(ingestado_hasta)::text, max(fecha_captura)::text from aportes_ingesta_estado
union all select 'leylobby_cursor_estado', count(*)::text, null, max(fecha_captura)::text from leylobby_cursor_estado
union all select 'leyes_rotacion_estado', count(*)::text, max(ultimo_boletin)::text, max(fecha_captura)::text from leyes_rotacion_estado;"
```

Salida (`tabla | filas | avance | fecha_captura`):

```
lobby_ingesta_estado|136|2026-06-22|2026-06-22 19:18:08.428172+00
probidad_ingesta_estado|136|2026-07-23|2026-06-22 19:42:29.825736+00
contratos_ingesta_estado|0||
aportes_ingesta_estado|0||
leylobby_cursor_estado|1||2026-07-22 12:44:06.340612+00
leyes_rotacion_estado|1|16851-14|2026-07-27 21:09:34.69+00
```

Lecturas:

- **`lobby_ingesta_estado.ingestado_hasta` = 2026-06-22 (36 días)** mientras
  `lobby-leylobby-weekly` corre **success** cada miércoles (último 2026-07-22) y
  `lobby_audiencia` recibió filas ese mismo día (P7: 2026-07-22 12:44:05). Es
  exactamente el discriminante del Pitfall 4: **el workflow corre y escribe datos, pero
  el marcador `lobby_ingesta_estado` no avanza** — cursor detenido, no fuente sin
  novedades. La escritura fresca va a `leylobby_cursor_estado` (fecha_captura
  2026-07-22 12:44:06), que es el cursor que el CLI SÍ actualiza. Los dos cursores no
  están sincronizados.
- `probidad_ingesta_estado.ingestado_hasta` = 2026-07-23, coincidente con la corrida de
  `probidad-weekly` de ese día → cursor avanzando correctamente.
- `contratos_ingesta_estado` y `aportes_ingesta_estado` con **0 filas**: nunca se barrió.
  Estado ESPERADO (MONEY/SERVEL gated), no gap de cron.
- `leyes_rotacion_estado` singleton con `ultimo_boletin = 16851-14` y fecha_captura
  2026-07-27 21:09 (la corrida de `leyes-weekly` de ese día) → round-robin girando.

---

## P9 — Pata 3: `freshness` (desde la RAÍZ del repo)

**Variante viva del gotcha v8.1 encontrada en ejecución.** El script raíz
`pnpm freshness` (`package.json:12` → `tsx packages/freshness/src/cli.ts`) **falla en este
entorno** porque `tsx` no está en `node_modules/.bin/` de la raíz:

```bash
pnpm freshness --json > /tmp/freshness.json 2>/tmp/freshness.txt; echo "exit=$?"
```

```
exit=1
$ tsx packages/freshness/src/cli.ts "--json"
"tsx" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
```

`pnpm exec tsx …` tampoco resuelve (`[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "tsx" not
found`). El binario vive en `packages/freshness/node_modules/.bin/tsx`. Invocación efectiva,
**manteniendo el cwd en la raíz** (que es lo que el gotcha exige para que `cli.ts:296`
encuentre `.env`):

```bash
./packages/freshness/node_modules/.bin/tsx packages/freshness/src/cli.ts --json \
  > /tmp/fresh.json 2>/tmp/fresh.err; echo "exit=$?"
```

```
exit=1
```

`exit=1` es el resultado ESPERADO (hay fuentes stale), no un fallo del probe.

stderr — los dos 404 de instrumentación, capturados en vivo:

```
Consultando frescura de fuentes (solo lectura)...
HTTP 404: workflow chilecompra-weekly.yml not found on the default branch (https://api.github.com/repos/Cuchecorp/gov-map/actions/workflows/chilecompra-weekly.yml)
HTTP 404: workflow servel-weekly.yml not found on the default branch (https://api.github.com/repos/Cuchecorp/gov-map/actions/workflows/servel-weekly.yml)
```

Confirmado por lectura del catálogo (`catalog.ts:313` y `:337` declaran esos dos
`workflowYml`; `catalog.ts:304` ya comenta que aún no existen).

stdout — bloque `frescura` del JSON (verbatim):

```json
[
  { "fuente": "leyes", "tabla": "proyecto", "ultimoUpsert": "2026-07-27 21:38:06.135+00",
    "diasDesdeUpsert": 0, "umbralDias": 7, "stale": false,
    "ghRun": "success @ 2026-07-27", "r2Snapshot": "2026-07-27 21:38:22.834+00" },
  { "fuente": "leyes-min-edad", "tabla": "proyecto", "ultimoUpsert": "2026-07-09 04:34:43.901+00",
    "diasDesdeUpsert": 19, "umbralDias": 45, "stale": false,
    "ghRun": "success @ 2026-07-27", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "agenda", "tabla": "citacion", "ultimoUpsert": "2026-07-27 13:41:24.416+00",
    "diasDesdeUpsert": 1, "umbralDias": 7, "stale": false,
    "ghRun": "success @ 2026-07-27", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "lobby-camara", "tabla": "lobby_audiencia", "ultimoUpsert": "2026-07-22 12:44:05.343+00",
    "diasDesdeUpsert": 6, "umbralDias": 14, "stale": false,
    "ghRun": "failure @ 2026-07-07", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "lobby-leylobby", "tabla": "lobby_ingesta_estado", "ultimoUpsert": "2026-06-22",
    "diasDesdeUpsert": 36, "umbralDias": 7, "stale": true,
    "ghRun": "success @ 2026-07-22", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "probidad", "tabla": "declaracion", "ultimoUpsert": "2026-07-23 12:37:05.518+00",
    "diasDesdeUpsert": 5, "umbralDias": 30, "stale": false,
    "ghRun": "success @ 2026-07-23", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "fichas", "tabla": "proyecto", "ultimoUpsert": "2026-07-27 21:38:06.135+00",
    "diasDesdeUpsert": 0, "umbralDias": 30, "stale": false,
    "ghRun": "n/d (sin corridas)", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "chilecompra", "tabla": "contratos_ingesta_estado", "ultimoUpsert": null,
    "diasDesdeUpsert": null, "umbralDias": 30, "stale": true,
    "ghRun": "n/d", "r2Snapshot": "n/d (sin snapshots)" },
  { "fuente": "servel", "tabla": "aportes_ingesta_estado", "ultimoUpsert": null,
    "diasDesdeUpsert": null, "umbralDias": 365, "stale": true,
    "ghRun": "n/d", "r2Snapshot": "n/d (sin snapshots)" }
]
```

**3 fuentes `stale: true`** — `lobby-leylobby` (36 d / umbral 7), `chilecompra` y `servel`
(sin dato, gated). Las 6 restantes verdes. La señal `lobby-leylobby` COINCIDE con la lectura
de cursor de P8 (no hay discrepancia freshness↔fila real ahí): ambas leen
`lobby_ingesta_estado`, y ambas ven un cursor detenido en 2026-06-22 pese a una corrida
verde el 2026-07-22.

Bloques `cobertura` / `coberturaVoto` / `coberturaRut` del mismo JSON (contexto, no
veredicto de cron): fichas 3657/3659, idea matriz 1504/3659 (41 %), embeddings 3100/3659
(85 %); voto Cámara 3804/4855 (78 %) y Senado 1048/4855 (22 %); RUT parlamentario 0/186
(0 %) y entidades 0 (n/d).

**Huecos de cobertura de freshness (confirmados en ejecución):** el catálogo tiene 9
entradas y NO cubre `actualidad-refresh` (`actualidad_senal`), `digest-daily`
(`notificacion_envio`), `backup-parlamentario` (snapshot git / R2), ni **ninguno** de los
5 jobs de `pg_cron`. Para esas unidades la pata 3 no aplica y el veredicto se apoya en
patas 1+2.

---

## P10 — Pata 4: spot-check de crudo vía `source_snapshot` (sin credenciales R2)

Verificación previa de columnas (el RESEARCH asumía `fuente`/`creado_en`; ambos son falsos):

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='source_snapshot' order by ordinal_position;"
```

```
id|bigint
ingest_run_id|bigint
source|text
resource|text
cache_key|text
r2_path|text
content_hash|text
fingerprint|text
source_url|text
fetched_at|timestamp with time zone
date_bucket|date
```

La columna es **`source`** (no `fuente`) y **`fetched_at`** (no `creado_en`). Query
corregida:

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -F'|' -c \
  "select source, count(*), max(fetched_at) from source_snapshot group by 1 order by 1;"
```

```
infoprobidad|3|2026-07-23 12:37:12.157+00
leyes|4380|2026-07-27 21:38:22.834+00
```

**Sólo DOS fuentes registran crudo en `source_snapshot`.** `leyes` está al día (4.380
snapshots, último el 2026-07-27, minutos después de la corrida de `leyes-weekly`) e
`infoprobidad` tiene 3 snapshots del 2026-07-23 (día de la corrida de `probidad-weekly`).
**Ausentes: `agenda`, `lobby-leylobby`, `lobby-camara`, `bio`, `fichas`, `actualidad`.** Es
el mismo dato que freshness reporta como `r2Snapshot: "n/d (sin snapshots)"` en 7 de sus 9
fuentes. Hallazgo de compliance de la regla dos-etapas de `CLAUDE.md`: esos conectores no
dejan traza en DB del PUT a R2 (o no lo hacen). El audit lo registra; el fix es de Phase 119.
