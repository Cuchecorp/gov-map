# DEBT-03 — CLOUDFLARE_API_TOKEN: nota de operador

**Fase:** 74 · **Plan:** 74-03 · **Requisito:** DEBT-03 · **Fecha:** 2026-07-14

## Hallazgo rector (el framing del requisito es impreciso)

`CLOUDFLARE_API_TOKEN` es un concern de **DEPLOY del frontend**, NO de la ingesta.
El requisito original insinúa que faltaría "cablear" el token en los crons; eso es
una **mala interpretación**. La deuda real es puramente de operador: el **VALOR** del
secret debe estar cargado en los ajustes de GitHub del repo `Cuchecorp/gov-map`. La
**referencia** (`${{ secrets.CLOUDFLARE_API_TOKEN }}`) ya está presente y es correcta
en el único lugar que la necesita.

## Evidencia (verificación estática, read-only)

Grep sobre `.github/workflows/`:

```
$ grep -rl 'CLOUDFLARE_API_TOKEN' .github/workflows/
.github/workflows/deploy-cloudflare.yml      ← ÚNICA ocurrencia

$ grep -rl 'CLOUDFLARE_API_TOKEN' .github/workflows/ | grep -v deploy-cloudflare.yml | wc -l
0                                            ← 0 crons de ingesta la referencian
```

- **Referencia presente y consumida** — `deploy-cloudflare.yml` (job `deploy`, step
  "Build + Deploy (OpenNext → Cloudflare Workers)"):

  ```yaml
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: pnpm run deploy
  ```

- **Crons de ingesta — NINGUNO la referencia (ni la necesita):**
  `agenda-weekly.yml`, `leyes-weekly.yml`, `lobby-camara-weekly.yml`,
  `lobby-leylobby-weekly.yml`, `probidad-weekly.yml`, `fichas-backfill.yml`.
  Estos crons **escriben a Supabase + R2**, NO a Cloudflare → corren verdes **sin**
  el token. Sus `env:` sólo llevan `SUPABASE_*` y `R2_*` (verificado en
  `leyes-weekly.yml:56-67`).

## Paso de OPERADOR (acto humano — el agente no tiene acceso a GH settings ni al valor)

En GitHub → repo **Cuchecorp/gov-map** → **Settings → Secrets and variables → Actions**:

1. Añadir/verificar el secret **`CLOUDFLARE_API_TOKEN`** — un token de Cloudflare con
   permiso **"Edit Cloudflare Workers"**.
2. Añadir/verificar el secret **`CLOUDFLARE_ACCOUNT_ID`** — id de la cuenta (el del
   endpoint R2, `10fb709d…`).
3. Confirmar que **GH Actions billing está activo** (memoria v6.0: activo; verificar
   que no volvió a bloquearse — si lo está, el deploy no arranca).
4. Disparar `deploy-cloudflare.yml` (**workflow_dispatch**) y confirmar que corre
   **VERDE** → deploy reproducible en CI, sin fallback a `wrangler` local.

El VALOR del token **vive sólo en GH settings**, NUNCA en git. Esta nota **no contiene
ningún valor de secret**.

## Aclaración anti-mal-interpretación (warning sign)

**NO** añadir `CLOUDFLARE_API_TOKEN` a ningún cron de ingesta. Un diff que agregue la
referencia a `agenda-weekly.yml` / `leyes-weekly.yml` / `lobby-*.yml` /
`probidad-weekly.yml` / `fichas-backfill.yml` es **incorrecto**: esos crons no tocan
Cloudflare y el token allí no haría nada útil (sólo ampliaría innecesariamente la
superficie de exposición del secret — T-74-10). El único consumidor legítimo es el job
`deploy` de `deploy-cloudflare.yml`.

## Estado

- [x] Referencia YAML verificada correcta (presente en `deploy-cloudflare.yml`, consumida por el step de deploy).
- [x] Ausencia verificada en los 6 crons de ingesta (grep = 0).
- [ ] **Operador:** cargar el VALOR de `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` en Cuchecorp/gov-map y disparar `deploy-cloudflare.yml` verde. (Checkpoint de operador — plan 74-03.)
