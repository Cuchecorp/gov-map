# DEBT-06 — rotación del DB password de Supabase (B26): nota de operador

**Fase:** 75 · **Plan:** 75-02 · **Requisito:** DEBT-06 · **Fecha:** 2026-07-15

## Hallazgo rector (el radio de impacto es MÁS acotado de lo que suena)

El "DB password" de Supabase (B26, credencial expuesta) vive **únicamente** dentro del
connection string `SUPABASE_DB_URL`. Rotarlo es un **acto de OPERADOR en el dashboard de
Supabase**: el agente **no tiene acceso** al dashboard, y rotar en vivo **rompe las
conexiones psql/CLI activas**. Por eso el agente **DOCUMENTA** el flujo (esta nota +
checkpoint) y **NO rota** la credencial.

La rotación invalida **SÓLO** a `SUPABASE_DB_URL` (los CLIs locales de DDL/bulk + los
runbooks de `psql`). Los crons de CI y el sitio desplegado **NO se ven afectados**: se
autentican con la **service_role key** (`SUPABASE_SECRET_KEY`) + `SUPABASE_API_URL` por
REST — credenciales **independientes** que esta rotación **no toca**.

## Evidencia (verificación estática, read-only)

`SUPABASE_DB_URL` es el único portador del password (por NOMBRE, nunca el valor):

```
# .env.example:26-29 — la ÚNICA ubicación del password (placeholder, sin valor real):
#   SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres
```

Grep sobre `.github/workflows/` → **0** referencias a `SUPABASE_DB_URL`:

```
$ grep -rl 'SUPABASE_DB_URL' .github/workflows/ | wc -l
0                                            ← 0 crons de ingesta lo referencian
```

- **Workflows que SÍ corren** (y NO usan `SUPABASE_DB_URL`): `agenda-weekly.yml`,
  `backfill.yml`, `backup-parlamentario.yml`, `deploy-cloudflare.yml`,
  `fichas-backfill.yml`, `leyes-weekly.yml`, `lobby-camara-weekly.yml`,
  `lobby-leylobby-weekly.yml`, `probidad-weekly.yml`. Su `env:` lleva `SUPABASE_SECRET_KEY`
  + `SUPABASE_API_URL` (service_role por REST) + `R2_*` — **nada** de `SUPABASE_DB_URL`.
- **Único consumidor del password** = CLIs locales de DDL/bulk + runbooks de `psql`, p.ej.
  el idiom establecido en `docs/RUNBOOK-lockdown-cutover.md:96-110`:

  ```
  DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)")
  PGCLIENTENCODING=UTF8 psql "$DB_URL" -c "select 1;"
  ```

## Qué rompe la rotación / qué NO

| Superficie | ¿Se ve afectada por rotar el DB password? |
|------------|-------------------------------------------|
| CLIs locales de DDL/bulk (lobby/dinero/probidad) + runbooks `psql` | **SÍ** — usan `SUPABASE_DB_URL`; fallan hasta re-cargar la nueva credencial. |
| Crons de CI (ingesta semanal, backfill, backup) | **NO** — usan `SUPABASE_SECRET_KEY` + REST (credencial independiente). |
| Sitio desplegado (Cloudflare / OpenNext) | **NO** — usa `SUPABASE_SECRET_KEY` + REST. |

Resumen: la rotación es un **evento local del operador**, no un evento de producción. La
plataforma sigue en pie mientras el operador re-carga `SUPABASE_DB_URL` en su `.env`.

## Pasos de OPERADOR (acto humano — el agente no tiene acceso al dashboard ni al valor)

1. **Rotar** — Supabase **Dashboard → Settings → Database → Reset database password**.
   Generar el nuevo password y copiar el nuevo connection string.
2. **Re-cargar local** — pegar el nuevo `SUPABASE_DB_URL` en el `.env` local (sólo esa
   variable). `.env` está gitignored → **NUNCA** commitear el nuevo password.
3. **Revisar el mirror desplegado (Q1)** — el repo `Cuchecorp/gov-map` **no es inspeccionable
   desde este workspace**. En **Cuchecorp/gov-map → Settings → Secrets and variables →
   Actions**, buscar/grep cualquier secret `*_DB_URL` (p.ej. `SUPABASE_DB_URL`). Si existe
   alguno que alimente un cron de DDL, **refrescarlo** con el nuevo valor. Default seguro:
   asumir que no hay ninguno; **verificar al momento de rotar**.
4. **Confirmar que el password VIEJO quedó inválido** — con la URL vieja:
   `PGCLIENTENCODING=UTF8 psql "<url-vieja>" -c "select 1;"` → **debe fallar con error de
   auth** (prueba de que la rotación realmente invalidó la credencial anterior).
5. **Confirmar que el password NUEVO funciona** —
   `DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)"); PGCLIENTENCODING=UTF8 psql "$DB_URL" -c "select 1;"`
   → debe devolver `1`.
6. **Confirmar no-afectación de CI + sitio** — verificar que los crons de CI + el sitio
   desplegado siguen **verdes** (usan el service_role key por REST; no debieron moverse).

El VALOR del password **vive sólo en el servidor de Supabase + el `.env` local (+ GH
secrets si aplica)**, NUNCA en git. Esta nota **no contiene ningún valor de secret**.

## Aclaración anti-mal-interpretación (warning signs)

- **NO** re-cargar `SUPABASE_SECRET_KEY` / `SUPABASE_API_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_JWT_SECRET` como parte de esta rotación. Son credenciales **independientes**,
  **no afectadas** por rotar el DB password. Un paso de runbook que las toque tras esta
  rotación es **incorrecto** (Pitfall 2): sólo `SUPABASE_DB_URL` cambia.
- **NO** commitear el nuevo `SUPABASE_DB_URL` en git: `.env` es gitignored
  (`.env.example:2` "NUNCA commitear `.env`"). El nuevo password se re-carga en `.env` +
  GH settings únicamente.
- **NO** delegar la rotación en el agente/CI: sin acceso al dashboard, y rotar en vivo
  rompe conexiones activas → acto **exclusivo de operador**.

## Estado

- [x] Radio de impacto verificado: password vive sólo en `SUPABASE_DB_URL`; grep = 0 crons lo referencian.
- [x] Consumidores identificados: CLIs locales DDL/bulk + runbooks `psql`; CI + sitio usan `SUPABASE_SECRET_KEY` + REST (no afectados).
- [x] Runbook zero-credential-values redactado (sin `postgresql://…:<password>@…` poblado, sin host, sin secret).
- [ ] **Operador:** rotar el DB password (Dashboard → Settings → Database), re-cargar el nuevo `SUPABASE_DB_URL` en `.env` local (+ revisar `*_DB_URL` en Cuchecorp/gov-map), confirmar url-vieja-FALLA + url-nueva-funciona, y confirmar CI + sitio verdes. **(Checkpoint de operador — plan 75-02, BLOCKING.)**
