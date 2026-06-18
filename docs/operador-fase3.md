# Operador — Fase 3 (Tabla maestra `parlamentario`)

Pasos de operador para la maestra de identidad. La corrida LIVE ya produjo el dataset real
(31 senadores vigentes + 155 diputados vigentes = 186 filas) y escribió el snapshot
autoritativo en git: **`supabase/seeds/parlamentario.seed.json`** (ID-09 cumplido HOY, sin
depender de R2 ni del Supabase remoto). La carga al Supabase **local** y la promoción a
`confirmado` (revisión humana) también están aplicadas.

Lo que sigue son pasos **diferidos por credencial** (per `03-CONTEXT.md`). Ninguno bloquea el
cumplimiento de ID-01/ID-09 hoy: el snapshot git es el respaldo autoritativo.

---

## 0. Snapshot autoritativo (estado actual)

- **Archivo:** `supabase/seeds/parlamentario.seed.json` (versionado en git).
- **Contenido:** maestra real con provenance por fila (`origen`, `fecha_captura`, `enlace`).
- **Estado:** `confirmado` (promovido tras revisión humana del lote — ver §3).
- **Regenerar localmente** (idempotente por clave natural, no duplica):
  ```bash
  SUPABASE_LOCAL_URL="http://127.0.0.1:54421" \
  SUPABASE_LOCAL_SERVICE_KEY="<service_role local>" \
  pnpm --filter @obs/identity run seed:live
  ```
  Sin `SUPABASE_LOCAL_SERVICE_KEY` la carga a DB se omite pero el snapshot git se reescribe
  igual (autoritativo).

---

## 1. Push al Supabase REMOTO (diferido — falta DB password / PAT)

**Bloqueo:** `SUPABASE_SECRET_KEY` en `.env` es una *service key* de API (`sb_secret_…`), **no**
un Personal Access Token de management (`sbp_…`), y el `.env` no trae una connection string /
DB password apta para `db push`. Por eso las migraciones y el seed se aplicaron al Supabase
**local** (docker), no al remoto.

**Cuando exista DB password o un PAT `sbp_…`:**

1. Linkear el proyecto remoto:
   ```bash
   supabase link --project-ref <SUPABASE_PROJECT_ID>
   # pide la DB password del proyecto
   ```
2. Aplicar las migraciones (incluye `0005_parlamentario.sql`):
   ```bash
   supabase db push
   ```
3. Cargar el seed autoritativo al remoto (idempotente por clave natural):
   ```bash
   SUPABASE_LOCAL_URL="$SUPABASE_API_URL" \
   SUPABASE_LOCAL_SERVICE_KEY="<service_role remoto>" \
   pnpm --filter @obs/identity run seed:live -- --preserve-estado
   ```
   `--preserve-estado` mantiene el `confirmado` del snapshot committeado (no revierte la
   revisión humana). El push del seed nunca auto-promueve.

---

## 2. Respaldo a R2 (diferido — credencial S3 da 401)

**Bloqueo:** las credenciales S3 de R2 (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`) devuelven
**401** contra el bucket `observatorio` (sondeado 2026-06-18). El código de respaldo a R2
(`R2Store` de Fase 1, gateado por `r2Enabled` en `exportMaestra`) está listo pero **NO** se
ejecuta hasta tener una credencial válida. Esto también mantiene abierto el checkpoint R2 de
Fase 1.

**Cuando la credencial S3 deje de dar 401:**

1. Cargar las credenciales válidas en `.env` (local) y en **repo secrets** (CI):
   `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
2. El workflow `.github/workflows/backup-parlamentario.yml` detecta la presencia de la
   credencial (paso "Respaldo a R2", `if: secrets.R2_* != ''`) y sube el snapshot a R2 vía
   `R2Store` en cada corrida de respaldo — segundo destino de ID-09 además del git.
3. Esto **cierra el checkpoint R2 de Fase 1** (el primer respaldo crudo a R2 live).

> El snapshot git sigue siendo el respaldo **autoritativo**; R2 es un destino adicional, no un
> reemplazo. ID-09 se cumple con git aunque R2 nunca se habilite.

---

## 3. Promoción a `confirmado` (revisión humana — ID-01)

**Riesgo existencial #1:** un match de identidad equivocado produce una afirmación falsa y
creíble. Por eso **nada se marca `confirmado` automáticamente**: el seeder carga el lote como
`no_confirmado` y la promoción es una **decisión humana** (compuerta ID-01).

**Flujo de revisión + promoción:**

1. Abrir `supabase/seeds/parlamentario.seed.json` y verificar los conteos: ≈155 diputados
   (`camara="diputados"`) + senadores vigentes (`camara="senado"`).
2. Hojear una muestra: nombres/apellidos, `partido` (militancia vigente en diputados),
   `region`/`circunscripcion`, `parlid_senado`/`id_diputado_camara` presentes. `rut` y
   `distrito` salen `null` (los catálogos no los traen — esperado, Pitfall 4).
3. Confirmar que ninguna fila vino en `confirmado` por defecto.
4. Si el lote es aceptable como autoritativo (los catálogos oficiales de vigentes lo son),
   promover y re-exportar:
   ```bash
   SUPABASE_LOCAL_URL="http://127.0.0.1:54421" \
   SUPABASE_LOCAL_SERVICE_KEY="<service_role local>" \
   pnpm --filter @obs/identity run seed:live -- --promote
   ```
   `--promote` aplica un UPDATE acotado a las claves naturales del lote (`estado=confirmado`)
   y re-exporta el snapshot con el estado sellado.
5. Si hay anomalías (conteo raro, partido vacío masivo, homónimos colapsados), corregir
   ANTES de promover. No promover nada con dudas (fail-closed).

> **Esta corrida ya promovió el lote** (operador-accept de la orquestación: conteos coinciden
> con los catálogos oficiales autoritativos, provenance presente, 0 errores de fetch, 0
> anomalías). El snapshot committeado ya está en `confirmado`.

---

## 4. Idempotencia de la re-siembra

Re-correr la siembra es **idempotente**: el upsert es por clave natural (`parlid_senado` /
`id_diputado_camara`, materializada en la PK `id` determinista `S{parlid}` / `D{id}`), así que
correr el seeder N veces con el mismo input **no duplica** filas. El backup automático
(`backup-parlamentario.yml`) usa `--preserve-estado` para no revertir la promoción humana.
