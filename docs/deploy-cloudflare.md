# Deploy del frontend a Cloudflare Workers

Frontend Next.js 16 (`app/`) → Cloudflare Workers vía **`@opennextjs/cloudflare`**.
El adaptador transforma el build de Next a un Worker. Configuración ya en el repo:
`app/wrangler.jsonc`, `app/open-next.config.ts`, `app/next.config.ts`, scripts en
`app/package.json`, y el workflow `.github/workflows/deploy-cloudflare.yml`.

> **Por qué CI y no local:** el build de OpenNext usa symlinks que Windows bloquea
> sin Developer Mode (falla con `EPERM: symlink`). El deploy corre en **GitHub
> Actions (Linux)** — reproducible y sin ese problema. `pnpm --filter app build`
> (solo Next) sí funciona en Windows y ya se verificó verde.

## Estado de verificación

- ✅ `pnpm --filter app build` (Next 16 + Turbopack) — pasa limpio.
- ✅ Build de OpenNext — llega hasta el bundling y falla SOLO por el symlink de
  Windows (EPERM). En Linux/CI completa.
- ⏳ Deploy real — requiere las credenciales de Cloudflare (abajo).

## Requisitos de DATOS (sin esto el sitio sale vacío)

El frontend lee del **Supabase de producción** por `anon` key (RLS public-read).
Antes (o después) del deploy hay que **poblar la nube** con el corpus v1.0
(proyectos, votaciones, embeddings). Hoy los conectores corrieron LIVE en lectura;
el write a la nube es paso de operador (deuda v1.0/v2.0). Sin datos, las rutas
`/buscar`, `/proyecto/[boletin]`, etc. responden vacío honestamente.

## Paso 1 — Credenciales de Cloudflare

1. **Account ID**: Cloudflare dashboard → cualquier dominio/Workers → barra
   lateral derecha "Account ID" (es el `10fb709d…` del endpoint R2, misma cuenta).
2. **API Token**: dashboard → My Profile → API Tokens → Create Token →
   plantilla **"Edit Cloudflare Workers"** (o un token custom con `Workers
   Scripts: Edit` + `Account: Read`). Cópialo (se muestra una vez).

## Paso 2 — Secrets del repo (GitHub Actions)

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | el token del Paso 1 |
| `CLOUDFLARE_ACCOUNT_ID` | el account id del Paso 1 |

## Paso 3 — Secrets de RUNTIME del Worker (una sola vez)

El Worker lee estas variables en runtime (NO en build). Se setean una vez por
Worker con `wrangler` (desde cualquier máquina con el token, o vía un job CI):

```bash
cd app
# autentica: export CLOUDFLARE_API_TOKEN=...  (o `npx wrangler login`)
npx wrangler secret put SUPABASE_URL          # URL del proyecto Supabase de PROD
npx wrangler secret put SUPABASE_ANON_KEY     # ANON key (NUNCA el service/secret key)
npx wrangler secret put GEMINI_API_KEY        # embeddings de /buscar
```

> **Importante:** `SUPABASE_ANON_KEY` debe ser el **anon** key, no el service/secret.
> El frontend lee con RLS public-read; el service key bypassearía RLS. El anon key
> de prod lo sacas de Supabase dashboard → Project Settings → API → `anon public`.

## Paso 4 — Deploy

**Opción A (recomendada) — GitHub Actions:**
Actions → "deploy-cloudflare" → Run workflow. Corre `pnpm run deploy` en Linux
(build de OpenNext + `wrangler deploy`).

**Opción B — local (requiere Windows Developer Mode ON para los symlinks):**
```bash
cd app
pnpm run deploy        # (NO `pnpm deploy` — colisiona con el comando built-in de pnpm)
```

## Paso 5 — Dominio

Por defecto queda en `observatorio-congreso.<tu-subdominio>.workers.dev`.
Para dominio propio: Cloudflare dashboard → Workers & Pages → el Worker → Settings
→ Domains & Routes → Add custom domain.

## Notas

- **Cache ISR (R2):** desactivado en MVP (`open-next.config.ts` sin
  `r2IncrementalCache`) porque R2 da 401 hoy. Cuando el token R2 funcione,
  habilitar el override + el binding `NEXT_INC_CACHE_R2_BUCKET` en `wrangler.jsonc`.
  La mayoría de rutas son dinámicas, así que el ISR es opcional.
- **`.dev.vars`** (gitignored): para `pnpm --filter app run preview` (Worker local).
  Plantilla en `app/.dev.vars.example`.
- **Var names:** el app usa `SUPABASE_URL`/`SUPABASE_ANON_KEY` (no `SUPABASE_API_URL`
  ni el service key del `.env` de ingesta — son contratos distintos a propósito:
  ingesta usa service key server-side; el frontend usa anon key).
