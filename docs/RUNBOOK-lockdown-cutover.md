# RUNBOOK — Cutover LOCKDOWN anon → web_reader

**Fase:** LOCKDOWN-04 (Phase 42)
**Fecha de redaccion:** 2026-06-24
**Autoridad:** `_FACTS-live-prod.md` + `42-RESEARCH.md` §4 (tabla de pasos)

---

## Resumen del cambio

| Antes | Despues |
|---|---|
| El servidor lee Supabase como `anon` (JWT Bearer = anon key) | El servidor lee como `web_reader` (JWT Bearer = token firmado con `SUPABASE_JWT_SECRET`) |
| La API publica Supabase acepta cualquier `apikey` + `Bearer anon` → datos publicos legibles por cualquiera | La API publica esta muerta para datos: anon y authenticated no tienen grants ni policies → `42501 permission denied` |
| PII protegido por RLS (no hay policy to anon en tablas PII) | PII protegido identicamente: RLS + sin grants → doble defensa |

El `apikey` (anon key enviado por Kong) SIGUE siendo valido para autenticar la peticion HTTP; solo el rol DB que extrae el Bearer cambia. PostgREST asigna el rol desde el claim `role` del JWT Bearer.

---

## PRE-CUTOVER — Paso 0: Obtener y verificar `SUPABASE_JWT_SECRET`

> **ABORTAR si este paso falla. No continuar.**

1. Ir a **Supabase Dashboard → Settings → API → JWT Settings → JWT Secret**.
   Copiar el valor. Es la clave simetrica HS256 del proyecto.

   > **NO confundir con `SUPABASE_SECRET_KEY`** (el `sb_secret_…` de 41 chars).
   > `SUPABASE_SECRET_KEY` es el service-role key que bypasea RLS — NO es el
   > secreto JWT y NO puede firmar un web_reader token.

2. Agregar a **`.env`** (local):
   ```
   SUPABASE_JWT_SECRET=<valor>
   ```

3. Agregar a **Cloudflare Pages env** (Settings → Environment variables → Production):
   ```
   SUPABASE_JWT_SECRET=<valor>
   ```

4. **Verificar offline** que el secreto es el correcto:
   El anon key del proyecto es un JWT HS256. Decodificar el header/payload (base64url):
   ```
   echo "<SUPABASE_ANON_KEY>" | cut -d. -f1 | base64 -d  # header: debe decir alg:HS256
   ```
   Luego re-firmar con el secreto y comparar que la firma del token resultado coincide
   con la firma del anon key (tercer segmento). Si la firma no coincide, el secreto
   esta mal — abortarh. Si coincide, el secreto esta correcto y `mintWebReaderToken()`
   producira tokens validos para PostgREST.

5. Si en `.env` aun no existe `SUPABASE_JWT_SECRET`, el servidor falla-cerrado al
   arrancar (`mintWebReaderToken()` lanza). Esto es intencional: nunca silencia la
   falta del secreto cayendo de vuelta al anon.

---

## Cutover ordenado (pasos 1 → 2 → 3)

> **ADVERTENCIA CRITICA: revocar (paso 3) ANTES de desplegar el servidor nuevo
> (paso 2) = SITIO CAIDO.** El servidor en ese momento todavia envía Bearer anon;
> sin grants anon el servidor recibe `42501` en cada query. El orden es carga
> estructural: no invertir.

| Paso | Accion | Quien | Efecto en PROD | Si falla |
|---|---|---|---|---|
| **1** | Aplicar `0043_lockdown_web_reader.sql` | Operador | `web_reader` creado, grants enumerados (26 tablas, 15 RPCs), 26 policies `_public_read_wr`. **anon sigue funcionando igual.** Ventana segura: ambos roles leen. | `drop role web_reader` (previa drop de sus 26 policies `_wr`). Nada mas tocado. |
| **2** | Deploy LOCKDOWN-03 a Cloudflare + smoke del sitio | Operador | Servidor envía `Bearer web_reader`; Kong sigue validando apikey=anon. Sitio lee como web_reader incluso mientras anon sigue con grants. | Redeploy del build anterior; anon sigue con grants → sitio vuelve solo. |
| **3** | Aplicar `0044_lockdown_revoke_anon.sql` ULTIMO | Operador | API publica anon muerta (42501). Sitio no afectado (web_reader). | **reverse-0044** (ver seccion Rollback paso 3). |

### Paso 1 — Aplicar `0043_lockdown_web_reader.sql`

```bash
# Cargar SUPABASE_DB_URL desde .env (con node para manejar BOM/encoding)
DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)")

PGCLIENTENCODING=UTF8 psql "$DB_URL" --single-transaction \
  -f supabase/migrations/0043_lockdown_web_reader.sql

# Registrar la migracion en schema_migrations
PGCLIENTENCODING=UTF8 psql "$DB_URL" -c \
  "INSERT INTO schema_migrations (version) VALUES ('0043_lockdown_web_reader') ON CONFLICT DO NOTHING;"
```

Verificar con pgTAP:
```bash
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA \
  -f supabase/tests/0043_web_reader.test.sql
```
Todos los tests deben decir `ok`. Si alguno dice `not ok`, abortar y revisar.

### Paso 2 — Deploy LOCKDOWN-03 a Cloudflare

1. Asegurarse de que `SUPABASE_JWT_SECRET` ya este en Cloudflare env (Paso 0).
2. Disparar el workflow **"deploy-cloudflare"** en GitHub Actions (Linux, build OpenNext).
   O desde local con Windows Developer Mode activo:
   ```bash
   cd app && pnpm run deploy
   ```
3. Una vez desplegado, cargar el sitio y verificar **todas las superficies** (lista en
   seccion "Smoke del sitio" mas abajo).
4. El servidor lee como web_reader — anon todavia tiene grants, por lo que el fallback
   sigue funcionando. Esta es la **ventana de seguridad**.

### Paso 3 — Aplicar `0044_lockdown_revoke_anon.sql` (ULTIMO)

```bash
DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)")

PGCLIENTENCODING=UTF8 psql "$DB_URL" --single-transaction \
  -f supabase/migrations/0044_lockdown_revoke_anon.sql

PGCLIENTENCODING=UTF8 psql "$DB_URL" -c \
  "INSERT INTO schema_migrations (version) VALUES ('0044_lockdown_revoke_anon') ON CONFLICT DO NOTHING;"
```

Verificar con pgTAP post-apply:
```bash
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA \
  -f supabase/tests/post-apply/0044_revoke_anon.test.sql
```
Todos los tests deben pasar. Luego ejecutar el **Probe Live** (seccion siguiente).

---

## Probe live post-0044 (operador)

Ejecutar estos cuatro comandos con la **anon key como AMBOS `apikey` y `Bearer`**
(simula un cliente externo sin web_reader JWT). Todos deben retornar error de
permiso (`42501` / `permission denied` / HTTP 401 o 403).

Reemplazar `<SUPABASE_URL>` y `<ANON_KEY>` con los valores reales.

### (a) RPC — `parlamentario_publico`

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "<SUPABASE_URL>/rest/v1/rpc/parlamentario_publico" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"p_id":"test"}'
```
Esperado: `401` o `403` (o body con `code: 42501`).

### (b) Tabla directa — `proyecto`

```bash
curl -s \
  "<SUPABASE_URL>/rest/v1/proyecto?select=boletin&limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```
Esperado: body con `{"code":"42501","message":"permission denied…"}` o HTTP 401.

### (c) Vista — `pg_all_foreign_keys`

```bash
curl -s \
  "<SUPABASE_URL>/rest/v1/pg_all_foreign_keys?limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```
Esperado: error 42501/401 (anon ya no tiene acceso a la vista pgTAP).

### (d) Tabla PII — `parlamentario`

```bash
curl -s \
  "<SUPABASE_URL>/rest/v1/parlamentario?select=rut&limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```
Esperado: error 42501/401. (Antes del lockdown anon podia intentar el query pero
RLS devolvía 0 filas; ahora ni siquiera llega al RLS check.)

> **Si CUALQUIERA de los cuatro devuelve datos reales → ROLLBACK inmediato (reverse-0044).**

---

## Smoke del sitio (despues del deploy paso 2 y post-0044)

Cargar el sitio en el navegador y confirmar que cada seccion renderiza datos reales
(no vacio, no error 500):

| Superficie | URL de ejemplo | Dato esperado |
|---|---|---|
| Parlamentarios | `/parlamentarios` | Lista de diputados/senadores |
| Ficha parlamentario | `/parlamentario/<id>` | Nombre, partido, imagen |
| Votaciones | `/parlamentario/<id>` → seccion votaciones | Votos reales |
| Lobby | `/parlamentario/<id>` → seccion lobby | Audiencias (si disponibles) |
| Patrimonio | `/parlamentario/<id>` → seccion patrimonio | Declaraciones (si disponibles) |
| Dinero/Aportes | `/parlamentario/<id>` → seccion financiamiento | Aportes (si disponibles) |
| Red (NET) | `/red` | Grafo de nodos (si gated ON) |
| Cruces | `/parlamentario/<id>` → seccion cruces | Cruces (si CRUCES_PUBLIC_ENABLED=true) |
| Buscar | `/buscar?q=agua` | Resultados de busqueda semantica |
| Agenda | `/agenda` | Citaciones de la semana |
| Ficha proyecto | `/proyecto/<boletin>` | Tramitacion + votaciones |

> **Exclusion de la superficie admin:** `createAdminSupabase()` usa
> `SUPABASE_SERVICE_KEY`, pero `.env` define `SUPABASE_SECRET_KEY` → el cliente
> admin esta mis-wired hoy y gated OFF. NO incluir `/admin/revisar-entidades`
> en el smoke para evitar falsa alarma; ese bug es deuda separada.

---

## Rollback por paso

### Rollback paso 1 — Deshacer creacion de web_reader

Aplicar SOLO si el paso 1 fallo y web_reader quedo parcialmente creado.
Anon sigue intacto; solo se deshace la creacion:

```sql
-- Bajar primero las policies _wr (26 tablas)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'aporte','aportes_ingesta_estado','citacion','citacion_invitado','citacion_punto',
    'contrato','contratos_ingesta_estado','declaracion','declaracion_accion_derecho',
    'declaracion_actividad','declaracion_bien_inmueble','declaracion_bien_mueble',
    'declaracion_pasivo','declaracion_valor','lobby_audiencia','lobby_ingesta_estado',
    'probidad_ingesta_estado','proyecto','proyecto_embedding','proyecto_ficha','sector',
    'sesion_sala','sesion_tabla_item','tramitacion_evento','votacion','voto'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_public_read_wr', t);
  END LOOP;
END$$;

REVOKE web_reader FROM authenticator;
DROP ROLE IF EXISTS web_reader;
```

### Rollback paso 2 — Revertir deploy del servidor

Redeploy del build anterior desde GitHub Actions (elegir el run exitoso previo
y hacer re-run, o desplegar desde el commit anterior). Anon sigue con sus grants
→ el sitio vuelve a funcionar automaticamente.

### Rollback paso 3 — reverse-0044 (mas alto leverage)

Si 0044 fue aplicado pero el sitio falla (p.ej. el deploy paso 2 no se hizo),
ejecutar `reverse-0044` para restaurar los grants de anon:

```sql
-- reverse-0044: restaurar acceso anon (ejecutar como operador en psql)
BEGIN;

-- 1. Recrear las 26 policies _public_read to anon
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'aporte','aportes_ingesta_estado','citacion','citacion_invitado','citacion_punto',
    'contrato','contratos_ingesta_estado','declaracion','declaracion_accion_derecho',
    'declaracion_actividad','declaracion_bien_inmueble','declaracion_bien_mueble',
    'declaracion_pasivo','declaracion_valor','lobby_audiencia','lobby_ingesta_estado',
    'probidad_ingesta_estado','proyecto','proyecto_embedding','proyecto_ficha','sector',
    'sesion_sala','sesion_tabla_item','tramitacion_evento','votacion','voto'
  ]) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I; CREATE POLICY %I ON %I FOR SELECT TO anon USING (true)',
      t || '_public_read', t, t || '_public_read', t
    );
  END LOOP;
END$$;

-- 2. Restaurar grants de SELECT en las 26 tablas para anon
GRANT SELECT ON
  aporte, aportes_ingesta_estado, citacion, citacion_invitado, citacion_punto,
  contrato, contratos_ingesta_estado, declaracion, declaracion_accion_derecho,
  declaracion_actividad, declaracion_bien_inmueble, declaracion_bien_mueble,
  declaracion_pasivo, declaracion_valor, lobby_audiencia, lobby_ingesta_estado,
  probidad_ingesta_estado, proyecto, proyecto_embedding, proyecto_ficha, sector,
  sesion_sala, sesion_tabla_item, tramitacion_evento, votacion, voto
TO anon;

-- 3. Restaurar EXECUTE en las 15 RPCs curadas
GRANT EXECUTE ON FUNCTION
  public.agregado_por_contraparte(text),
  public.aportes_de_parlamentario(text),
  public.bienes_de_parlamentario(text),
  public.buscar_citaciones(text, integer, text),
  public.comparar_declaraciones(text, date[]),
  public.contratos_de_parlamentario(text),
  public.cruces_de_parlamentario(text),
  public.declaraciones_de_parlamentario(text),
  public.lobby_de_parlamentario(text),
  public.match_proyectos(vector, integer, double precision, text),
  public.parlamentario_publico(text),
  public.parlamentarios_publico(),
  public.rebeldias_de_parlamentario(text),
  public.subgrafo_red(text, integer, text[], timestamptz, timestamptz),
  public.votos_de_parlamentario(text, integer, integer)
TO anon;

-- 4. Revertir el ALTER DEFAULT PRIVILEGES (FOR ROLE postgres)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;

COMMIT;
```

> Tras el rollback, volver al paso 2: desplegar el build anterior (sin web_reader JWT).

---

## Modos de falla y respuesta rapida

| Escenario | Sintoma | Accion |
|---|---|---|
| 0044 aplicado ANTES de paso 2 | Sitio 500 en todas las rutas con queries | reverse-0044 inmediato, luego retomar desde paso 2 |
| `SUPABASE_JWT_SECRET` ausente/erroneo en CF | Sitio falla en paso 2 (antes del revoke) | Agregar/corregir el secret en CF env, re-deploy. Anon sigue → sitio NO cayo. |
| pgTAP paso 1 falla | Algun grant de web_reader ausente | Revisar el error, re-aplicar 0043. Rollback paso 1 si necesario. |
| Probe live devuelve datos tras 0044 | Hueco de acceso residual | Rollback reverse-0044, investigar via pg_policies/information_schema |

---

## Riesgo residual + mantenimiento

### Lo que el guard CI NO cubre

El guard estatico `app/lib/lockdown-guard.test.ts` (Block A) escanea los archivos
`.sql` del directorio `supabase/migrations/` con numero > 0044 y falla si detecta
un `GRANT … TO anon` o `CREATE POLICY … TO anon`. Esto cubre las regresiones
introducidas por migraciones del **proyecto** (el gotcha historico del repo).

**Sin embargo, este guard NO detecta re-grants a anon a nivel de CATALOGO** que
ocurran por el default-ACL de `supabase_admin`. En Supabase, `supabase_admin`
posee sus propios `ALTER DEFAULT PRIVILEGES` que conceden acceso a objetos que
el crea (p.ej. extensiones, tipos internos). Esos objetos NO son creados por una
migracion del repo y por tanto no aparecen en el directorio `supabase/migrations/`
que escanea el guard. El `postgres` de conexion no puede alterar el default-ACL
de `supabase_admin` (dueño diferente).

### Backstop: pgTAP post-apply periodico

El unico control que detecta esa deriva es la re-corrida del test pgTAP
post-apply contra PROD:

```bash
DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)")
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA \
  -f supabase/tests/post-apply/0044_revoke_anon.test.sql
```

**Cadencia recomendada:**
- Tras cualquier migracion gestionada por Supabase (actualizaciones de la
  plataforma, nuevas extensiones habilitadas desde el dashboard).
- Trimestralmente como verificacion de rutina.
- Inmediatamente despues de cualquier incidente de acceso sospechoso.

Si el pgTAP falla (anon tiene EXECUTE en una RPC o SELECT en una tabla que no
deberia), investigar con:
```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon','authenticated') AND table_schema = 'public'
ORDER BY table_name;
```
Y aplicar revokes puntuales + regenerar reverse-0044 si la superficie cambio.
