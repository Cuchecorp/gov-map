---
phase: 118
plan: 118-03
titulo: Checkpoint de operador — secrets ausentes en el repo remoto
fecha: 2026-07-28
repo_remoto: Cuchecorp/gov-map
gate: no-bloqueante
evidencia: 118-PROBES-RAW.md (P4 `gh secret list`, P3.b log del run 29027652583)
gaps_relacionados: [G8, G9]
higiene: >
  Este documento contiene NOMBRES de secrets, ubicaciones del dashboard y permisos mínimos.
  Cero valores, cero fragmentos de valores, cero plantillas para pegarlos.
---

# 118 — Checkpoint de operador

**El agente no carga esta credencial: es un acto de operador.**

El agente no tiene acceso al dashboard de GitHub ni al de Cloudflare, no ve valores de secrets
(`gh secret list` entrega NOMBRE y fecha de creación, nada más) y **no debe recibir el valor por
ningún canal** — ni en el chat, ni en un archivo, ni en un commit. Lo que sigue es la petición
completa para que el operador la ejecute por su cuenta.

**Esta petición se hace UNA sola vez y no bloquea el cierre de la fase** (`118-CONTEXT.md:37`,
LOCKED). Sin respuesta, los dos ítems quedan como gaps **P2 (deuda de operador)** en
[`118-CRON-VERDICTS.md`](./118-CRON-VERDICTS.md) §4 — **G8** y **G9** — y Phase 119 los hereda
como deuda, no como trabajo de agente.

**Ningún cron programado está bloqueado por esto.** Los 6 workflows con `schedule:` activo tienen
TODOS sus secrets presentes (P4, §1.4 del documento de veredictos). Los dos ítems de abajo afectan
sólo a workflows de **disparo manual**.

---

## (A) `deploy-cloudflare` — deuda 110-02, confirmada abierta al 2026-07-28

**Gap:** G8 · **Prioridad:** P2 (deuda de operador) · **Impacto:** el workflow de deploy falla;
el deploy real de producción **sigue funcionando** localmente con `wrangler` + OAuth, así que
nada del sitio está caído por esto.

### Evidencia

- `gh secret list --repo Cuchecorp/gov-map` (P4) → los dos nombres **no aparecen** entre los 7
  secrets del repo.
- Log del run `29027652583` (P3.b, 2026-07-09): las dos variables se expanden **vacías** en el
  bloque `env:` del runner —
  `✘ [ERROR] In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN
  environment variable for wrangler to work.`

### Secrets requeridos

| NOMBRE del secret | requerido por (`archivo:línea`) |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `.github/workflows/deploy-cloudflare.yml:59` (consumido por `pnpm run deploy`, `:61`) |
| `CLOUDFLARE_ACCOUNT_ID` | `.github/workflows/deploy-cloudflare.yml:60` |

### Dónde cargarlos

**GitHub → repo `Cuchecorp/gov-map` → Settings → Secrets and variables → Actions → New
repository secret.** (Es el repo espejo desplegado, NO este workspace.)

### Permiso mínimo del token

`CLOUDFLARE_API_TOKEN` debe crearse en **Cloudflare Dashboard → My Profile → API Tokens →
Create Token**, con el permiso **mínimo** necesario para el deploy:

- **Account → Workers Scripts → Edit** (plantilla "Edit Cloudflare Workers").
- Acotar el token a **la cuenta y la zona del proyecto**, no a "All accounts".
- **No** conceder permisos de DNS, de Zone Settings ni de facturación: el workflow sólo publica
  un Worker.
- Recomendado: fecha de expiración explícita y anotación del token en el gestor de credenciales
  del operador.

`CLOUDFLARE_ACCOUNT_ID` no es un token, es un identificador de cuenta; se obtiene en el mismo
dashboard de Cloudflare. Cárguese **sólo** como secret, nunca en un archivo del repo.

### Cómo se verifica después (sin exponer nada)

```bash
gh secret list --repo Cuchecorp/gov-map          # deben APARECER los dos NOMBRES
gh workflow run deploy-cloudflare.yml --repo Cuchecorp/gov-map
gh run list --repo Cuchecorp/gov-map --workflow deploy-cloudflare.yml --limit 1 \
  --json conclusion,createdAt                    # conclusion: success
```

---

## (B) `fichas-backfill` — un secret de operador y un posible remapeo de YAML

**Gap:** G9 · **Prioridad:** P2 · **Impacto:** hoy nulo — el workflow **no tiene ninguna corrida
registrada** (P2) y es de disparo manual por diseño (`fichas-backfill.yml:8`). Un
`workflow_dispatch` fallaría.

### Antes de cargar nada: uno de los dos puede NO ser un secret faltante

`SUPABASE_URL` aparece como requerido en `fichas-backfill.yml` **mientras el repo ya tiene**
`SUPABASE_API_URL`. Otros workflows resuelven exactamente eso **remapeando** en el bloque `env:`
—`lobby-leylobby-weekly.yml:57` mapea `secrets.SUPABASE_API_URL` → `SUPABASE_URL`—. Si el caso es
ése, **no hay nada que cargar**: es un fix de YAML de una línea que hará Phase 119 (G9, paso 1).
**Verifíquese primero**, para no duplicar un secret que ya existe con otro nombre.

### Secret que sí es acto de operador

| NOMBRE del secret | requerido por (`archivo:línea`) | permiso mínimo |
|---|---|---|
| `GEMINI_API_KEY` | `.github/workflows/fichas-backfill.yml` (bloque `env:` del paso `:81`, `src/pipeline-cli.ts`) | API key de **Google AI Studio** restringida al servicio **Generative Language API**; el proyecto sólo la usa para **embeddings** (`gemini-embedding-001`), no requiere permisos de facturación ni de otros productos de GCP |

**Dónde cargarlo:** mismo camino que (A) — **GitHub → `Cuchecorp/gov-map` → Settings → Secrets
and variables → Actions → New repository secret.**

### Cómo se verifica después

```bash
gh secret list --repo Cuchecorp/gov-map          # debe APARECER GEMINI_API_KEY
grep -n "SUPABASE_URL" .github/workflows/fichas-backfill.yml   # ¿remapeo presente?
```

---

## Lo que este checkpoint NO pide, y por qué

- **Los 4 secrets `NOTIF_*` / `RESEND_API_KEY` de `digest-daily`.** Ausentes, sí, pero es **estado
  esperado**: NOTIF está parked, el `schedule:` está comentado (`digest-daily.yml:17`, `:24-25`) y
  `notificacion_envio` tiene 0 filas (P7). Está registrado en §4.1 (estados esperados) del
  documento de veredictos, **no** como gap. Pedirlos ahora sería provisionar un producto apagado.
- **La rotación de credenciales (B26).** No es observable con las herramientas de esta fase:
  `gh secret list` expone nombre y fecha de creación, jamás el valor ni el historial. Declarado
  como límite 8 y como resolución *parcial* de OQ3 en §5. Si el operador la ejecuta, es un acto
  independiente de este checkpoint.
- **Cualquier valor.** No hay en este archivo un solo campo para pegar un secret, y eso es
  deliberado: un `TOKEN=____` invita a rellenarlo y a commitearlo.

---

## Señal de reanudación (opcional — la fase NO espera)

Si el operador ejecuta (A) y/o (B), basta con decir **"cargado"** indicando qué NOMBRES quedaron
cargados. El agente entonces re-corre `gh secret list` (nombres solamente) y, si procede, cierra
G8 / G9 en Phase 119. **Sin respuesta, la fase 118 cierra igual** y los gaps viajan a 119 como
deuda de operador declarada.
