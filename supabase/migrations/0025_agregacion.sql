-- 0025_agregacion.sql
-- Capa de AGREGACION de la Fase 16 (MONEY Agregacion -- contratos/aportes por contraparte,
-- MONEY-05): el unico camino publico hacia los datos por contraparte. NO hay tablas nuevas,
-- NI conectores, NI ingesta -- esta migracion es consumidora pura de los hechos ya desplegados
-- en 0023 (`contrato`/`contratista`) y 0024 (`aporte`/`donante`). Define el RPC
-- `agregado_por_contraparte(p_id text)` (security definer, juridica-only). El RPC de listado
-- `contrapartes_listado()` queda DIFERIDO (WR-03): sin consumidor gated no se publica una
-- superficie de enumeracion a `anon`. Espejo archivo-por-archivo de 0024_servel.sql.
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
--
-- WR-05 (Phase 16): el payload `filas` esta ACOTADO a `agregado_por_contraparte_cap()`
-- filas (orden estable, las mas recientes primero). Antes `jsonb_agg` serializaba TODAS las
-- ordenes de una contraparte de alto volumen (un proveedor grande del Estado puede tener
-- miles), un payload jsonb sin cota que puede superar los limites de PostgREST/Postgres y
-- LANZARSE como error de RPC (route boundary #34) -- convirtiendo una contraparte legitima de
-- alta actividad en una pagina de error. El `conteo` sigue siendo el `count(*)` REAL (no
-- acotado), de modo que la linea de conteo neutral del UI sigue siendo veraz aunque `filas`
-- venga recortado. La paginacion en memoria del componente opera sobre este conjunto acotado.
create function public.agregado_por_contraparte_cap()
returns integer language sql immutable set search_path = '' as $$
  select 500;
$$;

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
  -- WR-05: `conteo` = count(*) REAL sobre todo el conjunto; `filas` = jsonb_agg ACOTADO a
  -- los primeros `cap` (subquery ordenada + LIMIT), para no serializar un payload sin cota.
  select
    'contrato'::text as facet,
    sub.proveedor_nombre as contraparte_nombre,
    'juridica'::text as tipo_persona,
    sub.conteo_total as conteo,
    jsonb_agg(
      jsonb_build_object(
        'codigo_orden',     sub.codigo_orden,
        'proveedor_nombre', sub.proveedor_nombre,
        'organismo',        sub.organismo,
        'nombre_orden',     sub.nombre_orden,
        'monto',            sub.monto,
        'fecha_oc',         sub.fecha_oc,
        'origen',           sub.origen,
        'fecha_captura',    sub.fecha_captura,
        'fecha_corte',      sub.fecha_corte,
        'enlace',           sub.enlace,
        'licencia',         sub.licencia
      )
      order by sub.fecha_oc desc nulls last, sub.codigo_orden desc
    ) as filas
  from (
    select
      c.codigo_orden, c.proveedor_nombre, c.organismo, c.nombre_orden, c.monto,
      c.fecha_oc, c.origen, c.fecha_captura, c.fecha_corte, c.enlace, c.licencia,
      count(*) over () as conteo_total
    from public.contrato c
    where left(p_id, 2) = 'c:'
      and c.tipo_persona = 'juridica'
      and c.rut_proveedor = substring(p_id from 3)
    order by c.fecha_oc desc nulls last, c.codigo_orden desc
    limit public.agregado_por_contraparte_cap()
  ) sub
  group by sub.proveedor_nombre, sub.conteo_total

  union all

  -- FACETA APORTES: solo cuando p_id viene con prefijo 'd:'; llave = donante_nombre.
  -- Nombre publico = aporte.donante_nombre (de la fila de hecho, juridica-only). La fila de
  -- hecho NO tiene la llave sintetica del donante (vive solo en la sub-maestra deny-by-default
  -- y jamas se proyecta). WR-05: mismo patron acotado que la faceta contratos.
  select
    'aporte'::text as facet,
    sub.donante_nombre as contraparte_nombre,
    'juridica'::text as tipo_persona,
    sub.conteo_total as conteo,
    jsonb_agg(
      jsonb_build_object(
        'eleccion',                  sub.eleccion,
        'candidato_nombre_verbatim', sub.candidato_nombre_verbatim,
        'donante_nombre',            sub.donante_nombre,
        'monto',                     sub.monto,
        'fecha_aporte',              sub.fecha_aporte,
        'tipo_aporte',               sub.tipo_aporte,
        'territorio',                sub.territorio,
        'pacto',                     sub.pacto,
        'partido',                   sub.partido,
        'origen',                    sub.origen,
        'fecha_captura',             sub.fecha_captura,
        'fecha_corte',               sub.fecha_corte,
        'enlace',                    sub.enlace,
        'licencia',                  sub.licencia
      )
      order by sub.eleccion desc, sub.fecha_aporte desc nulls last
    ) as filas
  from (
    select
      a.eleccion, a.candidato_nombre_verbatim, a.donante_nombre, a.monto, a.fecha_aporte,
      a.tipo_aporte, a.territorio, a.pacto, a.partido, a.origen, a.fecha_captura,
      a.fecha_corte, a.enlace, a.licencia,
      count(*) over () as conteo_total
    from public.aporte a
    where left(p_id, 2) = 'd:'
      and a.tipo_persona = 'juridica'
      and a.donante_nombre = substring(p_id from 3)
    order by a.eleccion desc, a.fecha_aporte desc nulls last
    limit public.agregado_por_contraparte_cap()
  ) sub
  group by sub.donante_nombre, sub.conteo_total;
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo de 0023/0024).
revoke execute on function public.agregado_por_contraparte(text) from public;
grant execute on function public.agregado_por_contraparte(text) to anon;

-- WR-05: el helper del cap es interno -- lo invoca la funcion SECURITY DEFINER como su
-- owner, asi que anon NO necesita (ni recibe) execute directo. Revocado de public.
revoke execute on function public.agregado_por_contraparte_cap() from public;

-- == contrapartes_listado() — DIFERIDO (WR-03 Phase 16) =============================
-- El RPC de LISTADO juridica-only se RETIRA de esta migracion: la pagina de listado esta
-- diferida (16-UI-SPEC §Reaching the route; solo /contraparte/[id] existe hoy), de modo que
-- el RPC no tenia consumidor y, GRANTeado a `anon`, era una superficie de enumeracion publica
-- (toda contraparte juridica + conteos) DESACOPLADA del gate `moneyPublicEnabled` y previa al
-- sign-off legal (deuda F13) — superficie nueva sin beneficio actual. El requisito de la fase
-- (MONEY-05) lo satisface `agregado_por_contraparte('[id]')` por si solo. Cuando aterrice la
-- pagina de listado, se reintroduce JUNTO a su consumidor gated en una migracion posterior.
