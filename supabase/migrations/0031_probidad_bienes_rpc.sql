-- 0031_probidad_bienes_rpc.sql
-- Expone los BIENES declarados (patrimonio/intereses) en la ficha del parlamentario.
--
-- POR QUÉ: las 6 sub-tablas de bienes (0022: declaracion_bien_inmueble/_mueble/_actividad/
-- _pasivo/_accion_derecho/_valor) son DENY-BY-DEFAULT (RLS, anon NO lee). El RPC público
-- `declaraciones_de_parlamentario` (0022) solo devuelve metadata (tipo/cargo/organismo) → la ficha
-- mostraba CUÁNDO declaró pero NO QUÉ declaró, y "comparar versiones" solo cubría 3/6 tipos.
--
-- Este RPC `bienes_de_parlamentario` es el espejo de `declaraciones_de_parlamentario`: security
-- definer (lee las sub-tablas deny-by-default internamente) que DEVUELVE SOLO los bienes de las
-- declaraciones del parlamentario pedido (un FK `parlamentario_id` solo se puebla en match
-- CONFIRMADO — IDENT-12 — así que filtrar por p_id ya restringe a lo confirmado). Cada bien viaja
-- como `contenido` jsonb con sus campos LITERALES (claves camelCase = modelo), más procedencia +
-- licencia por fila. NUNCA emite familiares (terceros PII, deny-by-default) ni nada de la maestra.
-- `set search_path = ''` (V8): nombres calificados con schema.
--
-- Además EXTIENDE `comparar_declaraciones` (0022) a los 3 tipos que faltaban (mueble, accion_derecho,
-- valor) para que la comparación lado-a-lado cubra los 6 tipos. CERO delta/veredicto (LOCKED).
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR: aplicar por `psql --db-url` DIRECTO (drift schema_migrations
-- remoto ≤0025; NUNCA `supabase db push`). BOM en .env → pasar --db-url explícito.

-- ── bienes_de_parlamentario(p_id) — los 6 tipos de bien, contenido jsonb por versión ──────────
create or replace function public.bienes_de_parlamentario(p_id text)
returns table (
  fuente_id text, fecha_presentacion date, tipo_bien text, contenido jsonb,
  origen text, fecha_captura timestamptz, enlace text, licencia text
)
language sql stable security definer set search_path = '' as $$
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
  order by 2 desc, 3;
$$;

revoke execute on function public.bienes_de_parlamentario(text) from public;
grant execute on function public.bienes_de_parlamentario(text) to anon;

-- ── comparar_declaraciones EXTENDIDA a los 6 tipos (agrega mueble, accion_derecho, valor) ──────
-- CREATE OR REPLACE: misma firma/return → reemplaza el cuerpo añadiendo 3 UNIONs. CERO veredicto.
create or replace function public.comparar_declaraciones(p_id text, fechas date[])
returns table (
  fecha_presentacion date, etiqueta text, valor text,
  origen text, fecha_captura timestamptz, enlace text, licencia text
)
language sql stable security definer set search_path = '' as $$
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
  order by 1 desc, 2;
$$;

revoke execute on function public.comparar_declaraciones(text, date[]) from public;
grant execute on function public.comparar_declaraciones(text, date[]) to anon;
