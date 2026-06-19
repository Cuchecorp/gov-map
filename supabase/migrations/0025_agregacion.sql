-- 0025_agregacion.sql
-- Capa de AGREGACION de la Fase 16 (MONEY Agregacion -- contratos/aportes por contraparte,
-- MONEY-05): el unico camino publico hacia los datos por contraparte. NO hay tablas nuevas,
-- NI conectores, NI ingesta -- esta migracion es consumidora pura de los hechos ya desplegados
-- en 0023 (`contrato`/`contratista`) y 0024 (`aporte`/`donante`). Define el RPC
-- `agregado_por_contraparte(p_id text)` (security definer, juridica-only) y, opcionalmente,
-- el RPC de listado `contrapartes_listado()`. Espejo archivo-por-archivo de 0024_servel.sql.
--
-- La ultima migracion APLICADA es 0024 (servel). Esta es la 0025.
-- (Nota: el pgTAP de esta migracion usa el numero libre 0026 -- 0025_servel.test.sql es el TEST
--  mas alto existente; los `0023_money_gate`/`0024_dinero`/`0025_servel` en tests/ son TESTS, no
--  migraciones.)
--
-- APLICACION = CHECKPOINT DE OPERADOR (Pitfall 2): build/typecheck NO prueban que Postgres
-- ejecuto este DDL (falso positivo de CI). La unica prueba valida es el pgTAP
-- (0026_agregacion.test.sql) corriendo contra un schema APLICADO. Por el BOM UTF-8 en `.env`,
-- la aplicacion + pgTAP pasan `--db-url` explicito al CLI (mismo camino que 0018..0024,
-- aplicadas con exito al remoto sa-east-1; extraer SUPABASE_DB_URL esquivando el BOM).
--
-- GATE DE EXPOSICION (heredado de Phase 13): toda ruta publica MONEY nace detras de
-- `moneyPublicEnabled()` (default OFF, server-only, Plan 16-02) -- ese es el candado B
-- (presentacion). Este DDL es el candado A (datos): el RPC es el unico canal publico hacia los
-- datos por contraparte; las sub-maestras siguen deny-by-default a `anon`. Nada se enciende
-- hasta el sign-off legal real (deuda de operador F13).
--
-- PII (Ley 21.719, regla rectora dura): SOLO persona JURIDICA (empresas) se agrega con nombre
-- -- son entidades publicas que contratan con el Estado / financian campanas. Una persona
-- NATURAL privada JAMAS se expone por nombre. El RPC filtra `tipo_persona = 'juridica'` sobre
-- la FILA DE HECHO (contrato/aporte, ya public-read), proyecta UNICAMENTE el nombre publico de
-- la fila de hecho (contrato.proveedor_nombre / aporte.donante_nombre) y NUNCA referencia las
-- sub-maestras contratista/donante, NUNCA proyecta donante_id, rut_donante ni RUT de donante
-- alguno. Conteo NEUTRAL -- los montos van VERBATIM por fila, SIN sumar (monto es text verbatim,
-- hoy null en contratos). El pgTAP introspecciona el cuerpo y lo hace verificable, no convencion.
--
-- O1 RESOLUTION (reconciliacion writer<->migracion): el writer ya desplegado persiste
-- `contrato.rut_proveedor` (writer-supabase.ts:54) pero la migracion 0023 omitio la columna ->
-- writer y schema estan desincronizados. El arreglo honesto (NO una tabla nueva): 0025 AGREGA
-- la columna para que el RPC pueda agrupar contratos por RUT del proveedor y la columna que el
-- writer ya escribe aterrice en algo real. `aporte` NO tiene donante_id en la fila de hecho
-- (solo en la sub-maestra deny-by-default) -> la llave de contraparte de aportes es
-- `donante_nombre` (el nombre publico de la fila de hecho).
--
-- NOTA cron: ni 0021..0024 registraron un job pg_cron en la migracion. Mismo patron aqui: la
-- vista materializada esta DIFERIDA (MVP = RPC en runtime; el volumen no la exige). NO se crea
-- ningun cron.schedule en este DDL.

-- == O1: reconciliacion de contrato.rut_proveedor (sin tabla nueva) =================
-- El writer ya desplegado escribe esta columna; la migracion 0023 la omitio. La agregamos
-- idempotentemente para que el GROUP BY del RPC tenga una llave real de RUT del proveedor.
alter table public.contrato add column if not exists rut_proveedor text;
create index if not exists contrato_rut_proveedor_idx on public.contrato (rut_proveedor);

-- == agregado_por_contraparte(p_id) (RPC publico -- AGREGACION por contraparte) =====
-- Despacho por prefijo del id: 'c:<rut_proveedor>' -> faceta CONTRATOS (llave rut_proveedor);
-- 'd:<donante_nombre>' -> faceta APORTES (llave donante_nombre). UNION ALL de las dos facetas,
-- cada una FILTRADA a `tipo_persona = 'juridica'` sobre la fila de hecho. Devuelve la faceta,
-- el nombre de la juridica (de la fila de hecho), el tipo_persona, el conteo NEUTRAL y las filas
-- subyacentes como jsonb (cada objeto lleva su provenance: origen/fecha_captura/fecha_corte/
-- enlace/licencia + los campos publicos verbatim de la faceta). NUNCA referencia las
-- sub-maestras contratista/donante; NUNCA proyecta donante_id/rut_donante/RUT de donante; NUNCA
-- suma ni castea monto (monto va verbatim por fila). El conteo es la "X aparece N veces" neutral.
create function public.agregado_por_contraparte(p_id text)
returns table (
  facet              text,
  contraparte_nombre text,
  tipo_persona       text,
  conteo             bigint,
  filas              jsonb
)
language sql stable security definer set search_path = '' as $$
  -- FACETA CONTRATOS: solo cuando p_id viene con prefijo 'c:'; llave = rut_proveedor.
  -- Nombre publico = contrato.proveedor_nombre (de la fila de hecho, juridica-only).
  select
    'contrato'::text as facet,
    c.proveedor_nombre as contraparte_nombre,
    'juridica'::text as tipo_persona,
    count(*)::bigint as conteo,
    jsonb_agg(
      jsonb_build_object(
        'codigo_orden',     c.codigo_orden,
        'proveedor_nombre', c.proveedor_nombre,
        'organismo',        c.organismo,
        'nombre_orden',     c.nombre_orden,
        'monto',            c.monto,
        'fecha_oc',         c.fecha_oc,
        'origen',           c.origen,
        'fecha_captura',    c.fecha_captura,
        'fecha_corte',      c.fecha_corte,
        'enlace',           c.enlace,
        'licencia',         c.licencia
      )
      order by c.fecha_oc desc nulls last, c.codigo_orden desc
    ) as filas
  from public.contrato c
  where left(p_id, 2) = 'c:'
    and c.tipo_persona = 'juridica'
    and c.rut_proveedor = substring(p_id from 3)
  group by c.proveedor_nombre

  union all

  -- FACETA APORTES: solo cuando p_id viene con prefijo 'd:'; llave = donante_nombre.
  -- Nombre publico = aporte.donante_nombre (de la fila de hecho, juridica-only). La fila de
  -- hecho NO tiene la llave sintetica del donante (vive solo en la sub-maestra deny-by-default
  -- y jamas se proyecta).
  select
    'aporte'::text as facet,
    a.donante_nombre as contraparte_nombre,
    'juridica'::text as tipo_persona,
    count(*)::bigint as conteo,
    jsonb_agg(
      jsonb_build_object(
        'eleccion',                  a.eleccion,
        'candidato_nombre_verbatim', a.candidato_nombre_verbatim,
        'donante_nombre',            a.donante_nombre,
        'monto',                     a.monto,
        'fecha_aporte',              a.fecha_aporte,
        'tipo_aporte',               a.tipo_aporte,
        'territorio',                a.territorio,
        'pacto',                     a.pacto,
        'partido',                   a.partido,
        'origen',                    a.origen,
        'fecha_captura',             a.fecha_captura,
        'fecha_corte',               a.fecha_corte,
        'enlace',                    a.enlace,
        'licencia',                  a.licencia
      )
      order by a.eleccion desc, a.fecha_aporte desc nulls last
    ) as filas
  from public.aporte a
  where left(p_id, 2) = 'd:'
    and a.tipo_persona = 'juridica'
    and a.donante_nombre = substring(p_id from 3)
  group by a.donante_nombre;
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo de 0023/0024).
revoke execute on function public.agregado_por_contraparte(text) from public;
grant execute on function public.agregado_por_contraparte(text) to anon;

-- == contrapartes_listado() (RPC publico -- LISTADO juridica-only) ==================
-- Listado para llegar a la ruta /contraparte/[id]: contrapartes DISTINTAS, juridica-only, con
-- su id prefijado ('c:'||rut_proveedor para contratos, 'd:'||donante_nombre para aportes), el
-- nombre de la contraparte, la faceta y un conteo NEUTRAL. NO cambia el gate (la pagina sigue
-- 404 cuando OFF). Mismo clause security-definer + revoke/grant. NUNCA referencia
-- contratista/donante; NUNCA proyecta donante_id/rut_donante.
create function public.contrapartes_listado()
returns table (
  id                 text,
  facet              text,
  contraparte_nombre text,
  tipo_persona       text,
  conteo             bigint
)
language sql stable security definer set search_path = '' as $$
  select
    'c:' || c.rut_proveedor as id,
    'contrato'::text as facet,
    c.proveedor_nombre as contraparte_nombre,
    'juridica'::text as tipo_persona,
    count(*)::bigint as conteo
  from public.contrato c
  where c.tipo_persona = 'juridica'
    and c.rut_proveedor is not null
  group by c.rut_proveedor, c.proveedor_nombre

  union all

  select
    'd:' || a.donante_nombre as id,
    'aporte'::text as facet,
    a.donante_nombre as contraparte_nombre,
    'juridica'::text as tipo_persona,
    count(*)::bigint as conteo
  from public.aporte a
  where a.tipo_persona = 'juridica'
    and a.donante_nombre is not null
  group by a.donante_nombre;
$$;

revoke execute on function public.contrapartes_listado() from public;
grant execute on function public.contrapartes_listado() to anon;
