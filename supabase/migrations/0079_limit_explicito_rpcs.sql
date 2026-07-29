-- 0079_limit_explicito_rpcs.sql
-- Phase 124 (SUPA-FIX) — wave 6 — paso 6 del orden LOCKED (ultimo tramo de CUERPO).
--
-- Offender que CIERRA:
--   OFF-4-03 — el tramo de las 12 RPCs que NO tienen NINGUN `LIMIT`:
--     aportes_de_parlamentario, bienes_de_parlamentario, comparar_declaraciones,
--     contratos_de_parlamentario, cruces_de_parlamentario, cruces_de_proyecto,
--     declaraciones_de_parlamentario, lobby_de_parlamentario, lobby_en_tramitacion,
--     parlamentarios_publico, rebeldias_de_parlamentario, tasa_ausencia_comparada.
--   El audit lo dice sin adornos: "una peticion puede barrer una tabla completa
--   (parlamentarios_publico = directorio entero; tasa_ausencia_comparada = cohorte de
--   una camara sobre voto)".
-- Eje 4 del audit. Origen: Q-13bis (123-SUPA-AUDIT.md) + revision manual de
-- pg_get_functiondef VIVO. 0077 les puso techo de TIEMPO; esto les pone techo de FILAS.
-- Con esta migracion, OFF-4-03 queda CERRADO por completo (0077 configuracion,
-- 0078 las 2 de parametro, 0079 estas 12).
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- LOS TECHOS SALEN DE UNA MEDICION ESCRITA, NO DE UN NUMERO ELEGIDO A OJO
-- ────────────────────────────────────────────────────────────────────────────────────
-- Justificacion completa, con la consulta de medicion de cada funcion, el dominio
-- barrido y el margen:
--     .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-CARDINALIDAD-MEDIDA.md
--
-- Criterio: techo >= 4x el maximo medido sobre el DOMINIO COMPLETO del argumento, y
-- nunca menor a 1000. Medido 2026-07-29 por `psql -tA` contra PROD (conteo por REST
-- PROHIBIDO: PostgREST capa a 1.000 filas y mentiria justo en el rango que importa).
--
--   funcion                          clase      maximo medido   techo    margen
--   ------------------------------   --------   -------------   ------   ------
--   aportes_de_parlamentario         FILAS      0 (*)           20000    n/a
--   bienes_de_parlamentario          FILAS      610             5000     8.2x
--   comparar_declaraciones           FILAS      658             5000     7.6x
--   contratos_de_parlamentario       FILAS      0 (*)           20000    n/a
--   cruces_de_parlamentario          FILAS      13              1000     76.9x
--   cruces_de_proyecto               FILAS      47              1000     21.3x
--   declaraciones_de_parlamentario   FILAS      20              1000     50.0x
--   lobby_de_parlamentario           FILAS      338             2000     5.9x
--   lobby_en_tramitacion             FILAS      219             1000     4.6x
--   parlamentarios_publico           FILAS      186             1000     5.4x
--   rebeldias_de_parlamentario       FILAS      1461            6000     4.1x
--   tasa_ausencia_comparada          AGREGADO   155 (cohorte)   1000     6.5x
--
--   (*) public.aporte y public.contrato tienen CERO filas hoy porque el gate MONEY esta
--       OFF, no porque el dato sea pequeno. `4 x 0 = 0` no es un techo. Se eligio 20000
--       (20x el piso) y queda REGISTRADO como deuda: el dia del flip MONEY hay que
--       re-medir y, si el maximo real supera 5000, subir el techo con una migracion NUEVA.
--
-- LO QUE LA ASERCION NO PRUEBA (dicho antes de venderla): con el techo derivado del
-- maximo medido, `medido < techo` NO PUEDE FALLAR HOY — es tautologica por construccion.
-- Su valor es cazar deriva futura y errores de transcripcion entre este archivo y el .md.
-- Lo que de verdad protege contra el truncamiento es que el maximo se midio sobre el
-- DOMINIO COMPLETO (186 parlamentarios / 3.683 boletines, 100%), no sobre una muestra.
--
-- FUNDAMENTO del techo generoso (verificado vivo antes de escribir esto):
--   has_function_privilege sobre las 12 => anon=f, authenticated=f, public=f,
--                                          service_role=t.
--   Las 12 estan cerradas a anon/authenticated/public. El UNICO llamador posible es el
--   servidor del propio sitio via service_role (Camino A, 0044). El techo protege contra
--   un BUG PROPIO, no contra un atacante externo. Lo que cierra el offender es que el
--   LIMIT deje de ser INEXISTENTE, no que el numero sea pequeno. (Precedente 0078.)
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- CLASE FILAS vs AGREGADO — donde va el LIMIT y por que
-- ────────────────────────────────────────────────────────────────────────────────────
--   FILAS (11 de 12): la funcion devuelve un conjunto => el `limit` va en la CONSULTA
--     TERMINAL, despues del `order by` existente.
--   AGREGADO (1 de 12: tasa_ausencia_comparada): devuelve 1 fila (n, m, tasa, mediana,
--     k, camara) => el `limit` NO puede ir al final (recortaria a 1 fila lo que ya es
--     1 fila y no acotaria nada). Va DENTRO de la subconsulta que materializa el conjunto
--     grande: el CTE `per_parl`, que es 1 fila por parlamentario de la camara del sujeto
--     sobre las 549.739 filas de `voto`. Anotado en el cuerpo.
--
--   CORRECCION RULE-1 al enunciado del plan: el plan anticipaba comparar_declaraciones
--   (y las agregado-like) como clase AGREGADO. El pg_get_functiondef VIVO la desmiente:
--   devuelve TABLE(fecha_presentacion, etiqueta, valor, ...) — un union all de 10 ramas
--   con `order by 1 desc, 2` terminal, SIN agregacion. Es FILAS. La unica AGREGADO real
--   de las 12 es tasa_ausencia_comparada.
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- SEPARACION LOCKED — lo que esta migracion NO toca
-- ────────────────────────────────────────────────────────────────────────────────────
-- Esto es SEGURIDAD (DoS). `B-01` — el cap de 1.000 sobre los votos, que trunca y ademas
-- DISTORSIONA la composicion del desglose por `order by fecha desc` — es EXACTITUD y
-- sigue FUERA de la Phase 124 (ver 124-07). NO se absorbe aqui.
-- NINGUN `order by` cambia: alterar el orden cambiaria QUE filas se devuelven bajo el
-- nuevo `limit`, no solo cuantas — eso seria exactitud, fuera de alcance.
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- ALCANCE Y RIESGO
-- ────────────────────────────────────────────────────────────────────────────────────
--   * `create or replace` de firma IDENTICA => cero 42P13, cero drop, cero re-arma de
--     default privileges. Las firmas y los cuerpos se transcriben literalmente del
--     pg_get_functiondef VIVO, no de las migraciones del repo (el ledger miente).
--   * RIESGO Nº1 HEREDADO DE LA WAVE 4/5: un `create or replace` que omita una clausula
--     la BORRA EN SILENCIO. Las 12 llevan `security definer`, `set search_path = ''` y
--     `set statement_timeout = '5s'` (este ultimo puesto por 0077): los 12 cuerpos los
--     REPITEN integros y el post-check los verifica uno a uno. Ademas, tras aplicar hay
--     que RE-CORRER supabase/tests/post-apply/0077_*.test.sql (debe seguir 20/20 con el
--     assert 19 en 31/42).
--   * Doble-revoke por funcion re-emitida: el guard (A5) de app/lib/lockdown-guard.test.ts
--     matchea `create or replace function`, asi que cada funcion re-emitida DEBE llevar su
--     `revoke execute ... from public` en el MISMO archivo. 12 funciones => 24 revokes.
--     Verificado vivo: las 12 ya estaban cerradas a anon/authenticated/public, de modo que
--     los revokes son no-op de ACL y NO cambian ninguna superficie.
--
-- Aplicar:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
--     -f supabase/migrations/0079_limit_explicito_rpcs.sql
-- NUNCA supabase db push (drift de schema_migrations).

-- ═══════════════════════════════════════════════════════════════════════════════════
-- PRE-CHECK fail-closed
-- ═══════════════════════════════════════════════════════════════════════════════════
do $prechk$
declare
  v_faltante text;
  v_sin_timeout text;
begin
  select string_agg(f, ', ' order by f) into v_faltante
  from (values
    ('public.aportes_de_parlamentario(text)'),
    ('public.bienes_de_parlamentario(text)'),
    ('public.comparar_declaraciones(text, date[])'),
    ('public.contratos_de_parlamentario(text)'),
    ('public.cruces_de_parlamentario(text)'),
    ('public.cruces_de_proyecto(text)'),
    ('public.declaraciones_de_parlamentario(text)'),
    ('public.lobby_de_parlamentario(text)'),
    ('public.lobby_en_tramitacion(text)'),
    ('public.parlamentarios_publico()'),
    ('public.rebeldias_de_parlamentario(text)'),
    ('public.tasa_ausencia_comparada(text)')
  ) t(f)
  where to_regprocedure(f) is null;

  if v_faltante is not null then
    raise exception
      'PRE-CHECK 0079 FALLO: no existe(n) con la firma esperada: %. Aplicar fuera de orden esta prohibido.',
      v_faltante;
  end if;

  -- 0077 debe estar aplicada: sin su statement_timeout, estos create or replace lo
  -- reintroducirian "por casualidad" y perderiamos la trazabilidad del paso previo.
  select string_agg(f, ', ' order by f) into v_sin_timeout
  from (values
    ('public.aportes_de_parlamentario(text)'),
    ('public.bienes_de_parlamentario(text)'),
    ('public.comparar_declaraciones(text, date[])'),
    ('public.contratos_de_parlamentario(text)'),
    ('public.cruces_de_parlamentario(text)'),
    ('public.cruces_de_proyecto(text)'),
    ('public.declaraciones_de_parlamentario(text)'),
    ('public.lobby_de_parlamentario(text)'),
    ('public.lobby_en_tramitacion(text)'),
    ('public.parlamentarios_publico()'),
    ('public.rebeldias_de_parlamentario(text)'),
    ('public.tasa_ausencia_comparada(text)')
  ) t(f)
  where not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure(t.f)::oid
      and coalesce(p.proconfig, '{}') && array['statement_timeout=5s']
  );

  if v_sin_timeout is not null then
    raise exception
      'PRE-CHECK 0079 FALLO: sin statement_timeout=5s (0077 no aplicada?): %.',
      v_sin_timeout;
  end if;

  raise notice 'PRE-CHECK 0079 OK: las 12 existen con firma exacta y con statement_timeout=5s de 0077.';
end
$prechk$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 1/12 — aportes_de_parlamentario · FILAS · techo 20000 (tabla vacia por gate MONEY)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.aportes_de_parlamentario(p_id text)
 RETURNS TABLE(eleccion text, donante_nombre text, tipo_persona text, monto text, fecha_aporte date, tipo_aporte text, candidato_nombre_verbatim text, origen text, fecha_captura timestamp with time zone, fecha_corte date, enlace text, licencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select a.eleccion, a.donante_nombre, a.tipo_persona, a.monto, a.fecha_aporte,
         a.tipo_aporte, a.candidato_nombre_verbatim, a.origen, a.fecha_captura, a.fecha_corte,
         a.enlace, a.licencia
  from public.aporte a
  where a.parlamentario_id = p_id
  -- UI-SPEC: agrupar por eleccion DESC; dentro de cada grupo, fecha DESC. fecha_aporte es
  -- nullable -> `nulls last` evita que las no-fechadas suban al tope en DESC.
  order by a.eleccion desc, a.fecha_aporte desc nulls last
  limit 20000;   -- OFF-4-03: techo de filas. aporte=0 filas hoy (gate MONEY OFF) => re-medir tras el flip
$function$;

revoke execute on function public.aportes_de_parlamentario(text) from public;
revoke execute on function public.aportes_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 2/12 — bienes_de_parlamentario · FILAS · techo 5000 (>= 4 x 610)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.bienes_de_parlamentario(p_id text)
 RETURNS TABLE(fuente_id text, fecha_presentacion date, tipo_bien text, contenido jsonb, origen text, fecha_captura timestamp with time zone, enlace text, licencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select b.fuente_id, b.fecha_presentacion, 'inmueble'::text,
    jsonb_strip_nulls(jsonb_build_object(
      'ubicadoEn', b.ubicado_en, 'rolAvaluo', b.rol_avaluo, 'numInscripcion', b.num_inscripcion,
      'fojas', b.fojas, 'anio', b.anio, 'esSuDomicilio', b.es_su_domicilio)),
    b.origen, b.fecha_captura, b.enlace, b.licencia
    from public.declaracion_bien_inmueble b
    join public.declaracion d on d.fuente_id = b.fuente_id and d.fecha_presentacion = b.fecha_presentacion
   where d.parlamentario_id = p_id
  union all
  select b.fuente_id, b.fecha_presentacion, 'mueble'::text,
    jsonb_strip_nulls(jsonb_build_object(
      'nombre', b.nombre, 'descripcion', b.descripcion, 'modelo', b.modelo,
      'anioFabricacion', b.anio_fabricacion, 'matricula', b.matricula,
      'numeroInscripcion', b.numero_inscripcion, 'anioInscripcion', b.anio_inscripcion, 'tonelaje', b.tonelaje)),
    b.origen, b.fecha_captura, b.enlace, b.licencia
    from public.declaracion_bien_mueble b
    join public.declaracion d on d.fuente_id = b.fuente_id and d.fecha_presentacion = b.fecha_presentacion
   where d.parlamentario_id = p_id
  union all
  select a.fuente_id, a.fecha_presentacion, 'actividad'::text,
    jsonb_strip_nulls(jsonb_build_object(
      'objeto', a.objeto, 'vinculo', a.vinculo, 'remunerado', a.remunerado, 'haceDoceMeses', a.hace_doce_meses)),
    a.origen, a.fecha_captura, a.enlace, a.licencia
    from public.declaracion_actividad a
    join public.declaracion d on d.fuente_id = a.fuente_id and d.fecha_presentacion = a.fecha_presentacion
   where d.parlamentario_id = p_id
  union all
  select pa.fuente_id, pa.fecha_presentacion, 'pasivo'::text,
    jsonb_strip_nulls(jsonb_build_object(
      'tipoObligacion', pa.tipo_obligacion, 'acreedor', pa.acreedor, 'montoDeuda', pa.monto_deuda)),
    pa.origen, pa.fecha_captura, pa.enlace, pa.licencia
    from public.declaracion_pasivo pa
    join public.declaracion d on d.fuente_id = pa.fuente_id and d.fecha_presentacion = pa.fecha_presentacion
   where d.parlamentario_id = p_id
  union all
  select ac.fuente_id, ac.fecha_presentacion, 'accion_derecho'::text,
    jsonb_strip_nulls(jsonb_build_object(
      'rutJuridica', ac.rut_juridica, 'cantidadAcciones', ac.cantidad_acciones,
      'fechaAdquisicion', ac.fecha_adquisicion, 'esControlador', ac.es_controlador, 'gravamenes', ac.gravamenes)),
    ac.origen, ac.fecha_captura, ac.enlace, ac.licencia
    from public.declaracion_accion_derecho ac
    join public.declaracion d on d.fuente_id = ac.fuente_id and d.fecha_presentacion = ac.fecha_presentacion
   where d.parlamentario_id = p_id
  union all
  select vl.fuente_id, vl.fecha_presentacion, 'valor'::text,
    jsonb_strip_nulls(jsonb_build_object(
      'entidadEmisora', vl.entidad_emisora, 'tipoAccionDerecho', vl.tipo_accion_derecho,
      'cantidadRepresenta', vl.cantidad_representa, 'valorPlaza', vl.valor_plaza,
      'paisQueEmite', vl.pais_que_emite, 'fechaAdquisicion', vl.fecha_adquisicion, 'tipoGravamen', vl.tipo_gravamen)),
    vl.origen, vl.fecha_captura, vl.enlace, vl.licencia
    from public.declaracion_valor vl
    join public.declaracion d on d.fuente_id = vl.fuente_id and d.fecha_presentacion = vl.fecha_presentacion
   where d.parlamentario_id = p_id
  order by 2 desc, 3
  limit 5000;   -- OFF-4-03: techo de filas (>= 4 x 610 medido sobre los 186 parlamentarios)
$function$;

revoke execute on function public.bienes_de_parlamentario(text) from public;
revoke execute on function public.bienes_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 3/12 — comparar_declaraciones · FILAS · techo 5000 (>= 4 x 658)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- CLASE: FILAS. Devuelve un conjunto (union all de 10 ramas), NO una agregacion.
CREATE OR REPLACE FUNCTION public.comparar_declaraciones(p_id text, fechas date[])
 RETURNS TABLE(fecha_presentacion date, etiqueta text, valor text, origen text, fecha_captura timestamp with time zone, enlace text, licencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select d.fecha_presentacion, 'tipo'::text, d.tipo, d.origen, d.fecha_captura, d.enlace, d.licencia
    from public.declaracion d where d.parlamentario_id = p_id and d.fecha_presentacion = any(fechas)
  union all
  select d.fecha_presentacion, 'cargo'::text, d.cargo, d.origen, d.fecha_captura, d.enlace, d.licencia
    from public.declaracion d where d.parlamentario_id = p_id and d.fecha_presentacion = any(fechas)
  union all
  select d.fecha_presentacion, 'organismo'::text, d.organismo, d.origen, d.fecha_captura, d.enlace, d.licencia
    from public.declaracion d where d.parlamentario_id = p_id and d.fecha_presentacion = any(fechas)
  union all
  select b.fecha_presentacion, 'bien_inmueble'::text, coalesce(b.ubicado_en, ''), b.origen, b.fecha_captura, b.enlace, b.licencia
    from public.declaracion_bien_inmueble b
    join public.declaracion d on d.fuente_id = b.fuente_id and d.fecha_presentacion = b.fecha_presentacion
   where d.parlamentario_id = p_id and b.fecha_presentacion = any(fechas)
  union all
  select b.fecha_presentacion, 'bien_mueble'::text, coalesce(nullif(b.nombre,''), b.descripcion, ''), b.origen, b.fecha_captura, b.enlace, b.licencia
    from public.declaracion_bien_mueble b
    join public.declaracion d on d.fuente_id = b.fuente_id and d.fecha_presentacion = b.fecha_presentacion
   where d.parlamentario_id = p_id and b.fecha_presentacion = any(fechas)
  union all
  select a.fecha_presentacion, 'actividad'::text, coalesce(a.objeto, ''), a.origen, a.fecha_captura, a.enlace, a.licencia
    from public.declaracion_actividad a
    join public.declaracion d on d.fuente_id = a.fuente_id and d.fecha_presentacion = a.fecha_presentacion
   where d.parlamentario_id = p_id and a.fecha_presentacion = any(fechas)
  union all
  select pa.fecha_presentacion, 'pasivo'::text, coalesce(pa.tipo_obligacion, ''), pa.origen, pa.fecha_captura, pa.enlace, pa.licencia
    from public.declaracion_pasivo pa
    join public.declaracion d on d.fuente_id = pa.fuente_id and d.fecha_presentacion = pa.fecha_presentacion
   where d.parlamentario_id = p_id and pa.fecha_presentacion = any(fechas)
  union all
  select ac.fecha_presentacion, 'accion_derecho'::text, coalesce(nullif(ac.rut_juridica,''), ac.cantidad_acciones, ''), ac.origen, ac.fecha_captura, ac.enlace, ac.licencia
    from public.declaracion_accion_derecho ac
    join public.declaracion d on d.fuente_id = ac.fuente_id and d.fecha_presentacion = ac.fecha_presentacion
   where d.parlamentario_id = p_id and ac.fecha_presentacion = any(fechas)
  union all
  select vl.fecha_presentacion, 'valor'::text, coalesce(vl.entidad_emisora, ''), vl.origen, vl.fecha_captura, vl.enlace, vl.licencia
    from public.declaracion_valor vl
    join public.declaracion d on d.fuente_id = vl.fuente_id and d.fecha_presentacion = vl.fecha_presentacion
   where d.parlamentario_id = p_id and vl.fecha_presentacion = any(fechas)
  order by 1 desc, 2
  limit 5000;   -- OFF-4-03: techo de filas (>= 4 x 658 medido con TODAS las fechas del sujeto)
$function$;

revoke execute on function public.comparar_declaraciones(text, date[]) from public;
revoke execute on function public.comparar_declaraciones(text, date[]) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 4/12 — contratos_de_parlamentario · FILAS · techo 20000 (tabla vacia por gate MONEY)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.contratos_de_parlamentario(p_id text)
 RETURNS TABLE(codigo_orden text, proveedor_nombre text, tipo_persona text, organismo text, nombre_orden text, monto text, fecha_oc date, origen text, fecha_captura timestamp with time zone, fecha_corte date, enlace text, licencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select c.codigo_orden, c.proveedor_nombre, c.tipo_persona, c.organismo,
         c.nombre_orden, c.monto, c.fecha_oc, c.origen, c.fecha_captura, c.fecha_corte, c.enlace, c.licencia
  from public.contrato c
  where c.parlamentario_id = p_id
  -- WR-03: fecha_oc es nullable; el default NULLS FIRST en DESC subiria las no-fechadas al tope
  -- (invirtiendo "mas reciente primero"). `nulls last` + desempate estable por codigo_orden.
  order by c.fecha_oc desc nulls last, c.codigo_orden desc
  limit 20000;   -- OFF-4-03: techo de filas. contrato=0 filas hoy (gate MONEY OFF) => re-medir tras el flip
$function$;

revoke execute on function public.contratos_de_parlamentario(text) from public;
revoke execute on function public.contratos_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 5/12 — cruces_de_parlamentario · FILAS · techo 1000 (piso; maximo medido 13)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cruces_de_parlamentario(p_id text)
 RETURNS TABLE(sector_id text, sector_etiqueta text, tipo_senal text, conteo integer, evidencia jsonb, fecha_captura timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select
    cs.sector_id,
    s.etiqueta,           -- etiqueta del catálogo público (dato no-PII)
    cs.tipo_senal,
    cs.conteo,
    cs.evidencia,         -- jsonb PII-safe (nombre crudo + enlace_fuente; sin rut, sin donante_id)
    cs.fecha_captura      -- nivel SEÑAL: todos los items de una señal comparten esta fecha
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
  where cs.parlamentario_id = p_id
  order by cs.conteo desc, cs.sector_id asc
  limit 1000;   -- OFF-4-03: techo de filas (piso de 1000; maximo medido 13 sobre los 186)
$function$;

revoke execute on function public.cruces_de_parlamentario(text) from public;
revoke execute on function public.cruces_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 6/12 — cruces_de_proyecto · FILAS · techo 1000 (piso; maximo medido 47)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cruces_de_proyecto(p_boletin text)
 RETURNS TABLE(parlamentario_id text, nombre_normalizado text, sector_id text, sector_etiqueta text, tipo_senal text, conteo integer, evidencia jsonb, fecha_captura timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  -- Sector ÚNICO del proyecto vía materia clasificada (Alt B, cero fabricación).
  -- Boletín sin ficha o sin sector → CTE vacío → 0 filas (empty honesto).
  with sec as (
    select sector_id
    from public.proyecto_ficha
    where boletin = p_boletin
      and sector_id is not null
  ),
  -- Parlamentarios que votaron 'si' (a favor) en votaciones del boletín, SOLO
  -- confirmados (IDENT-12: no se arrastran votos Senado por-nombre no confirmados).
  afavor as (
    select distinct v.parlamentario_id
    from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
    where vo.boletin = p_boletin
      and v.seleccion = 'si'
      and v.estado_vinculo = 'confirmado'
      and v.parlamentario_id is not null
  )
  -- cruce_senal ya está agregado por (parlamentario, sector) → filtrar por el sector
  -- del proyecto y por los votantes a-favor da UNA fila por parlamentario coincidente.
  select cs.parlamentario_id,
         p.nombre_normalizado,   -- lee la maestra deny-by-default INTERNAMENTE; emite solo el derivado público
         cs.sector_id,
         s.etiqueta,
         cs.tipo_senal,
         cs.conteo,
         cs.evidencia,
         cs.fecha_captura
  from public.cruce_senal cs
  join sec on cs.sector_id = sec.sector_id
  join afavor a on a.parlamentario_id = cs.parlamentario_id
  join public.sector s on s.codigo = cs.sector_id
  join public.parlamentario p on p.id = cs.parlamentario_id
  -- Orden NEUTRO alfabético (sign-off cond. 3 / UI-SPEC anti-insinuación inv. 5):
  -- NO ordenar por conteo — rankear parlamentarios distintos por volumen de lobby
  -- ("los más reunidos") es la insinuación que el sign-off prohíbe. El conteo se
  -- muestra por-fila como hecho neutro, jamás como criterio de ranking entre sujetos.
  order by p.nombre_normalizado asc
  limit 1000;   -- OFF-4-03: techo de filas (piso de 1000; maximo medido 47 sobre 3.683 boletines)
$function$;

revoke execute on function public.cruces_de_proyecto(text) from public;
revoke execute on function public.cruces_de_proyecto(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 7/12 — declaraciones_de_parlamentario · FILAS · techo 1000 (piso; maximo medido 20)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.declaraciones_de_parlamentario(p_id text)
 RETURNS TABLE(fuente_id text, fecha_presentacion date, tipo text, cargo text, organismo text, origen text, fecha_captura timestamp with time zone, enlace text, licencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select d.fuente_id, d.fecha_presentacion, d.tipo, d.cargo, d.organismo,
         d.origen, d.fecha_captura, d.enlace, d.licencia
  from public.declaracion d
  where d.parlamentario_id = p_id
  order by d.fecha_presentacion desc
  limit 1000;   -- OFF-4-03: techo de filas (piso de 1000; maximo medido 20 sobre los 186)
$function$;

revoke execute on function public.declaraciones_de_parlamentario(text) from public;
revoke execute on function public.declaraciones_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 8/12 — lobby_de_parlamentario · FILAS · techo 2000 (>= 4 x 338)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.lobby_de_parlamentario(p_id text)
 RETURNS TABLE(identificador text, fecha timestamp with time zone, fecha_raw text, materia text, enlace_detalle text, origen text, fecha_captura timestamp with time zone, enlace text, contraparte_nombre text, contraparte_rol text, representado text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select a.identificador, a.fecha, a.fecha_raw, a.materia, a.enlace_detalle,
         a.origen, a.fecha_captura, a.enlace,
         c.nombre, c.rol, c.representado_text
  from public.lobby_audiencia a
  left join public.lobby_contraparte c on c.identificador = a.identificador
  where a.parlamentario_id = p_id
  order by a.fecha desc nulls last
  limit 2000;   -- OFF-4-03: techo de filas (>= 4 x 338 medido sobre los 186 parlamentarios)
$function$;

revoke execute on function public.lobby_de_parlamentario(text) from public;
revoke execute on function public.lobby_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 9/12 — lobby_en_tramitacion · FILAS · techo 1000 (>= 4 x 219)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.lobby_en_tramitacion(p_boletin text)
 RETURNS TABLE(parlamentario_nombre text, camara text, materia text, fecha_reunion timestamp with time zone, semana_iso text, comision text, enlace_detalle text, audiencia_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  -- DISTINCT (load-bearing): un boletín citado 2+ veces en la MISMA semana/comisión
  -- (p.ej. sesiones martes y miércoles) multiplicaría cada audiencia por citación e
  -- inflaría el conteo neutro "N audiencias" de la UI. La unidad semántica del cruce
  -- es (audiencia × semana coincidente), no (audiencia × citación). Con a.identificador
  -- en la proyección (WR-07) el distinct dedupe por IDENTIDAD de audiencia: dos
  -- audiencias REALES del mismo (parlamentario, día, materia) ya NO colapsan (en filas
  -- Cámara enlace_detalle es siempre null y la fecha es date-only — la tupla de 7 era
  -- lossy), mientras la multiplicidad por citación sigue colapsando (mismo identificador).
  select distinct
         p.nombre_normalizado,   -- proyección pública (espejo de parlamentario_publico/0020)
         p.camara,
         a.materia,
         a.fecha,
         c.semana_iso,
         c.comision,
         -- FND-08 (trazabilidad, UI-REVIEW 52 BLOCKER): en filas Cámara `enlace_detalle`
         -- es SIEMPRE null (la fuente no publica detalle por audiencia) pero `enlace`
         -- (provenance del registro: la página oficial del listado) está poblado al 100%.
         -- coalesce garantiza que NINGUNA fila salga sin link a fuente oficial.
         coalesce(a.enlace_detalle, a.enlace),
         a.identificador         -- clave estable por-audiencia (WR-07)
  from public.citacion c
  join public.citacion_punto cp on cp.citacion_id = c.id
  -- coincidencia por SEMANA ISO: normaliza la fecha de la audiencia a la convención de
  -- huso con que se derivó citacion.semana_iso (A1, load-bearing). IW/IYYY = ISO week.
  join public.lobby_audiencia a
    on to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW') = c.semana_iso
  -- lee la maestra deny-by-default INTERNAMENTE (security definer); emite solo derivado público.
  join public.parlamentario p on p.id = a.parlamentario_id
  where cp.boletin = p_boletin
    and a.estado_vinculo = 'confirmado'      -- solo audiencias confirmadas (IDENT-12)
    and a.parlamentario_id is not null       -- sujeto pasivo confirmado (no se fabrica identidad)
  order by a.fecha desc nulls last
  limit 1000;   -- OFF-4-03: techo de filas (>= 4 x 219 medido sobre 3.683 boletines)
$function$;

revoke execute on function public.lobby_en_tramitacion(text) from public;
revoke execute on function public.lobby_en_tramitacion(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 10/12 — parlamentarios_publico · FILAS · techo 1000 (>= 4 x 186)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- El audit la nombra explicitamente: "barria el directorio entero".
CREATE OR REPLACE FUNCTION public.parlamentarios_publico()
 RETURNS TABLE(id text, nombre text, camara text, region text, distrito text, circunscripcion text, periodo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select p.id,
         -- nombre legible: usa el normalizado como respaldo si no hay desglose.
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara,
         -- region/distrito/circunscripcion/periodo son NULLABLE (0005): se emiten
         -- tal cual; el filtro que los excluye vive en el RSC, no aquí (Pitfall 5).
         p.region, p.distrito, p.circunscripcion, p.periodo
  from public.parlamentario p
  order by p.apellido_paterno nulls last, p.nombre_normalizado  -- orden NEUTRAL (§10.5)
  limit 1000;   -- OFF-4-03: techo de filas (>= 4 x 186; cubre >5 legislaturas de roster)
$function$;

revoke execute on function public.parlamentarios_publico() from public;
revoke execute on function public.parlamentarios_publico() from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 11/12 — rebeldias_de_parlamentario · FILAS · techo 6000 (>= 4 x 1461 = 5844)
-- ═══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rebeldias_de_parlamentario(p_id text)
 RETURNS TABLE(votacion_id text, boletin text, titulo text, etapa text, fecha timestamp with time zone, seleccion_propia text, mayoria_bancada text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  with yo as (
    select partido from public.parlamentario where id = p_id
  ),
  mayoria as (  -- opción MAYORITARIA ÚNICA de la bancada por votación, EXCLUYENDO
                -- ausencias (a). NO se usa mode(): ante empate de frecuencias mode()
                -- devuelve un valor arbitrario y fabricaría una "mayoría de bancada"
                -- inexistente (insinuación falsa). Sin mayoría única → la votación
                -- se EXCLUYE (having count(*) = 1: exactamente UNA opción con rank 1).
                -- La frecuencia rankeada cuenta PARLAMENTARIOS DISTINTOS, no filas:
                -- con filas duplicadas de bancada (dato sucio real, ver (c)) un
                -- count(*) crudo rompería un empate real o voltearía la mayoría —
                -- la misma fabricación que motivó eliminar mode() (CR-04).
    select votacion_id, min(seleccion) as mayoria
    from (
      select v.votacion_id, v.seleccion,
             rank() over (partition by v.votacion_id
                          order by count(distinct v.parlamentario_id) desc) as rk
      from public.voto v
      join public.parlamentario p on p.id = v.parlamentario_id
      where p.partido = (select partido from yo)
        and v.estado_vinculo = 'confirmado'
        and v.seleccion <> 'ausente'
      group by v.votacion_id, v.seleccion
    ) conteos
    where rk = 1
    group by votacion_id
    having count(*) = 1
  )
  select distinct on (v.votacion_id)     -- (c) dedupe por votación
         v.votacion_id, vo.boletin, pr.titulo, vo.etapa, vo.fecha, v.seleccion, m.mayoria
  from public.voto v
  join mayoria m on m.votacion_id = v.votacion_id
  join public.votacion vo on vo.id = v.votacion_id
  left join public.proyecto pr on pr.boletin = vo.boletin   -- (d) título, null honesto
  where v.parlamentario_id = p_id
    and v.estado_vinculo = 'confirmado'
    and v.seleccion <> 'ausente'         -- (b) una ausencia PROPIA no es "votó distinto"
    and v.seleccion <> m.mayoria         -- difirió de la mayoría de su bancada
  order by v.votacion_id
  limit 6000;   -- OFF-4-03: techo de filas (>= 4 x 1461 = 5844, el maximo mas alto de las 12)
$function$;

revoke execute on function public.rebeldias_de_parlamentario(text) from public;
revoke execute on function public.rebeldias_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 12/12 — tasa_ausencia_comparada · AGREGADO · techo 1000 en la SUBCONSULTA per_parl
-- ═══════════════════════════════════════════════════════════════════════════════════
-- CLASE AGREGADO — la unica de las 12. Devuelve 1 fila, asi que un `limit` al final NO
-- acotaria nada: el conjunto grande que hay que acotar es el CTE `per_parl` (1 fila por
-- parlamentario de la camara del sujeto, calculado sobre las 549.739 filas de `voto`),
-- que es lo que el audit describe como "cohorte de una camara sobre voto".
-- El `order by parlamentario_id` dentro del CTE NO cambia el resultado (per_parl solo
-- alimenta agregaciones): existe unicamente para que, el dia que el techo se alcance, el
-- recorte sea DETERMINISTA en vez de arbitrario.
-- El techo (1000) es >= 6.5x la cohorte maxima medida (155), de modo que hoy no recorta
-- a nadie y la mediana publicada no cambia. Probado por VALOR en el pgTAP (un count(*)
-- daria 1 pase lo que pase y seria una asercion vacua).
CREATE OR REPLACE FUNCTION public.tasa_ausencia_comparada(p_parlamentario_id text)
 RETURNS TABLE(n_ausencias integer, m_votaciones integer, tasa_propia numeric, mediana_camara numeric, k_parlamentarios integer, camara text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  -- Cámara del sujeto (deny-by-default: se lee INTERNAMENTE, jamás se emite el resto de
  -- la fila). Sujeto inexistente → CTE vacío → 0 filas (empty honesto).
  with subj as (
    select p.camara
    from public.parlamentario p
    where p.id = p_parlamentario_id
  ),
  -- Cohorte: una fila por parlamentario de la MISMA cámara del sujeto, con su conteo de
  -- ausencias y de votaciones. SOLO confirmados + parlamentario_id not null (IDENT-12:
  -- no se arrastran votos Senado por-nombre no confirmados). `having count(*) >= 1`
  -- garantiza m_votaciones >= 1 → n/m nunca divide por cero (empty honesto si M=0).
  per_parl as (
    select v.parlamentario_id,
           count(*)::int                                        as m,
           count(*) filter (where v.seleccion = 'ausente')::int as n
    from public.voto v
    join public.parlamentario p on p.id = v.parlamentario_id
    join subj on subj.camara = p.camara
    where v.estado_vinculo = 'confirmado'
      and v.parlamentario_id is not null
    group by v.parlamentario_id
    having count(*) >= 1
    -- OFF-4-03: techo de la SUBCONSULTA grande (la cohorte). 1000 >= 6.5x el maximo
    -- medido (155). `order by` solo para que el recorte sea determinista si se alcanza.
    order by v.parlamentario_id
    limit 1000
  ),
  -- Propio: la fila del sujeto dentro de la cohorte (0 filas si M=0 → empty honesto).
  propio as (
    select n, m
    from per_parl
    where parlamentario_id = p_parlamentario_id
  ),
  -- Referencia de la cámara: mediana de la tasa (ratio [0,1]) y tamaño de la cohorte.
  -- IMPORTANTE (IN-03): `mediana_camara` es la mediana de las TASAS INDIVIDUALES
  -- (n/m por parlamentario), NO la tasa agregada/pooled (Σn/Σm). Es la tasa del
  -- colega mediano — lo que un lector intuye por "mediana de su cámara". NO cambiar a
  -- pooled: alteraría silenciosamente toda mediana publicada cuando los m difieren.
  cohorte as (
    select
      percentile_cont(0.5) within group (order by n::numeric / m) as mediana,
      count(*)::int                                              as k
    from per_parl
  )
  select
    propio.n                       as n_ausencias,
    propio.m                       as m_votaciones,
    (propio.n::numeric / propio.m) as tasa_propia,     -- m >= 1 por el having → sin div/0
    cohorte.mediana                as mediana_camara,
    cohorte.k                      as k_parlamentarios,
    subj.camara                    as camara
  from propio
  cross join cohorte
  cross join subj;
$function$;

revoke execute on function public.tasa_ausencia_comparada(text) from public;
revoke execute on function public.tasa_ausencia_comparada(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- POST-CHECK fail-closed — verifica el ESTADO RESULTANTE, no la ausencia de error
-- (leccion de la wave 2: REVOKE sobre objetos ajenos no falla, no-opea con WARNING 01006)
-- ═══════════════════════════════════════════════════════════════════════════════════
do $postchk$
declare
  v_msg text;
  v_n integer;
begin
  create temporary table if not exists tmp_0079_firmas(f text) on commit drop;
  delete from tmp_0079_firmas;
  insert into tmp_0079_firmas(f) values
    ('public.aportes_de_parlamentario(text)'),
    ('public.bienes_de_parlamentario(text)'),
    ('public.comparar_declaraciones(text, date[])'),
    ('public.contratos_de_parlamentario(text)'),
    ('public.cruces_de_parlamentario(text)'),
    ('public.cruces_de_proyecto(text)'),
    ('public.declaraciones_de_parlamentario(text)'),
    ('public.lobby_de_parlamentario(text)'),
    ('public.lobby_en_tramitacion(text)'),
    ('public.parlamentarios_publico()'),
    ('public.rebeldias_de_parlamentario(text)'),
    ('public.tasa_ausencia_comparada(text)');

  -- (a) las 12 siguen existiendo con la MISMA firma (si no, el create or replace habria
  --     creado un overload nuevo en vez de reemplazar)
  select string_agg(f, ', ' order by f) into v_msg
  from tmp_0079_firmas where to_regprocedure(f) is null;
  if v_msg is not null then
    raise exception 'POST-CHECK 0079 FALLO: firma perdida en: %.', v_msg;
  end if;

  -- (b) ninguna se duplico: exactamente 12 procs con esos nombres
  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('aportes_de_parlamentario','bienes_de_parlamentario',
      'comparar_declaraciones','contratos_de_parlamentario','cruces_de_parlamentario',
      'cruces_de_proyecto','declaraciones_de_parlamentario','lobby_de_parlamentario',
      'lobby_en_tramitacion','parlamentarios_publico','rebeldias_de_parlamentario',
      'tasa_ausencia_comparada');
  if v_n <> 12 then
    raise exception 'POST-CHECK 0079 FALLO: se esperaban 12 procs, hay % (overload creado?).', v_n;
  end if;

  -- (c) las 12 conservan statement_timeout=5s (RIESGO Nº1: un create or replace que
  --     omita el `set` lo BORRA en silencio y reabre lo que 0077 cerro)
  select string_agg(f, ', ' order by f) into v_msg
  from tmp_0079_firmas t
  where not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure(t.f)::oid
      and coalesce(p.proconfig, '{}') && array['statement_timeout=5s']
  );
  if v_msg is not null then
    raise exception 'POST-CHECK 0079 FALLO: perdio statement_timeout=5s (regresion de 0077): %.', v_msg;
  end if;

  -- (d) las 12 conservan security definer + search_path (las 12 lo tenian ANTES)
  select string_agg(f, ', ' order by f) into v_msg
  from tmp_0079_firmas t
  where not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure(t.f)::oid
      and p.prosecdef
      and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  );
  if v_msg is not null then
    raise exception 'POST-CHECK 0079 FALLO: perdio security definer o search_path en: %.', v_msg;
  end if;

  -- (e) exposicion: cero EXECUTE para anon/authenticated/public
  select string_agg(f, ', ' order by f) into v_msg
  from tmp_0079_firmas t
  where has_function_privilege('anon', to_regprocedure(t.f)::oid, 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure(t.f)::oid, 'EXECUTE')
     or has_function_privilege('public', to_regprocedure(t.f)::oid, 'EXECUTE');
  if v_msg is not null then
    raise exception 'POST-CHECK 0079 FALLO: exec reabierto a anon/authenticated/public en: %.', v_msg;
  end if;

  -- (f) service_role CONSERVA EXECUTE (es la ruta viva del sitio — Camino A)
  select string_agg(f, ', ' order by f) into v_msg
  from tmp_0079_firmas t
  where not has_function_privilege('service_role', to_regprocedure(t.f)::oid, 'EXECUTE');
  if v_msg is not null then
    raise exception 'POST-CHECK 0079 FALLO: service_role perdio EXECUTE (rompe el Camino A) en: %.', v_msg;
  end if;

  raise notice 'POST-CHECK 0079 OK: 12 funciones con techo de filas; firmas, security definer, search_path, statement_timeout=5s y ACL de service_role intactos; cero exec anon/authenticated/public.';
end
$postchk$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Ledger
-- ═══════════════════════════════════════════════════════════════════════════════════
insert into supabase_migrations.schema_migrations (version, name)
values ('0079', 'limit_explicito_rpcs')
on conflict (version) do nothing;
