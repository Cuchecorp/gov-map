# Repo transfer → `Cuchecorp/gov-map` (checklist)

Mover `xenaquis/observatorio-congreso` → org **Cuchecorp**, renombrado **gov-map**.
El worker de Cloudflare **NO cambia** (sigue `observatorio-congreso`; `gov-map.com` ya está
bound a él). Esto es solo el repo + los crons (que correrán con los minutos de la org).

> ⚠️ **Los Actions secrets NO se transfieren con el repo** (GitHub los borra por seguridad).
> Hay que re-cargarlos en el repo nuevo, o los crons fallan silenciosamente.

---

## 1. Antes de apretar el botón
- [ ] Asegurate de tener **admin** sobre la org `Cuchecorp`.
- [ ] El repo está al día (`git push` hecho — ya en `master`).

## 2. Transfer (GitHub UI)
`Settings → General → Danger Zone → Transfer ownership` → owner `Cuchecorp`.
Luego renombrar a `gov-map` en `Settings → General → Repository name` (o renombrar durante el
transfer si la UI lo permite). GitHub deja **redirects automáticos** de las URLs/clone viejas.

## 3. Actualizar el remote local (post-transfer)
```bash
git remote set-url origin https://github.com/Cuchecorp/gov-map.git
git remote -v   # verificar
git fetch origin
```

## 4. Re-cargar los Actions secrets en el repo nuevo
**9 secrets vienen del `.env` local** → script helper (corré desde la raíz del repo, requiere
`gh auth login` con acceso a Cuchecorp):
```bash
# Lee el .env y setea los secrets en Cuchecorp/gov-map (NO imprime valores).
REPO=Cuchecorp/gov-map
for k in SUPABASE_API_URL SUPABASE_SECRET_KEY SUPABASE_URL \
         DEEPSEEK_API_KEY GEMINI_API_KEY \
         R2_ENDPOINT_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  v=$(grep "^$k=" .env | sed "s/^$k=//" | tr -d '"'"'"'\r')
  if [ -n "$v" ]; then printf '%s' "$v" | gh secret set "$k" --repo "$REPO" --body - && echo "set $k"; fi
done
```

**2 secrets son manuales** (no están en `.env`) — sacalos del dashboard de Cloudflare:
- [ ] `CLOUDFLARE_API_TOKEN`  (token con permiso *Edit Cloudflare Workers*)
- [ ] `CLOUDFLARE_ACCOUNT_ID`
```bash
gh secret set CLOUDFLARE_API_TOKEN  --repo Cuchecorp/gov-map
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Cuchecorp/gov-map
```

Verificar (lista nombres, no valores):
```bash
gh secret list --repo Cuchecorp/gov-map
```

## 5. Habilitar Actions en el repo nuevo
- [ ] `Settings → Actions → General` → permitir Actions (la org puede traerlas deshabilitadas).
- [ ] **Scheduled workflows solo corren desde la rama por defecto** (`master`) — confirmá que sigue siendo la default tras el transfer.
- [ ] GitHub **desactiva los cron tras 60 días sin actividad** en el repo; un push los re-arma.

## 6. Crons activos (todos minimalistas, semanales)
| Workflow | Cron (UTC) | Qué hace | Secrets |
|---|---|---|---|
| `backup-parlamentario.yml` | Lun 06:00 | re-siembra snapshot maestra + commit | (GITHUB_TOKEN auto; R2_* gated) |
| `agenda-weekly.yml` | Lun 11:00 | citaciones Cámara+Senado + tabla de sala (Senado + **Cámara DeepSeek-desde-PDF**) | SUPABASE_*, **DEEPSEEK_API_KEY**, **R2_*** |
| `leyes-weekly.yml` | **Vie 20:00** | proyectos de ley: tramitación + votaciones + votos (refresca el set de la DB) | SUPABASE_API_URL, SUPABASE_SECRET_KEY |
| `deploy-cloudflare.yml` | manual | build OpenNext + deploy | CLOUDFLARE_* |
| `backfill.yml`, `fichas-backfill.yml` | manual | backfills masivos puntuales | varios |

Disparo manual de cualquiera: `Actions → <workflow> → Run workflow`, o
`gh workflow run leyes-weekly.yml --repo Cuchecorp/gov-map`.

## 7. Cloudflare (sin cambios)
- `gov-map.com` ya está bound al worker `observatorio-congreso` → **nada que hacer**.
- El `name` en `app/wrangler.jsonc` se mantiene `observatorio-congreso` a propósito (renombrarlo
  obligaría a recrear el worker + re-bindear el dominio). El nombre del repo (gov-map) y el del
  worker son independientes.

## 8. Smoke post-transfer
```bash
gh workflow run agenda-weekly.yml --repo Cuchecorp/gov-map   # debería terminar verde
gh run list --repo Cuchecorp/gov-map --limit 3
```
- [ ] `https://gov-map.com/agenda` carga (sub-secciones Senado + Cámara).
- [ ] Buscador: `gov-map.com/agenda?q=medio ambiente` devuelve resultados.

---

**Nota:** las referencias a `xenaquis/observatorio-congreso` que quedan en `.planning/` son
historia (registro de fases) — no se reescriben. Lo operativo (remote, secrets, crons) está
cubierto arriba.
