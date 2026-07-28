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
