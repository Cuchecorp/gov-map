-- 0033_agenda_search_camara.sql
-- Fix (revisión pre-transfer): el filtro por cámara de /agenda?q=&camara= se aplicaba en JS
-- DESPUÉS del LIMIT del RPC (0032) → si una consulta devolvía ≥limite filas sesgadas a una
-- cámara, las de la otra cámara más allá del límite se perdían silenciosamente. Solución:
-- empujar el filtro al RPC para que el LIMIT se aplique DESPUÉS de restringir por cámara.
--
-- Cambia la firma a buscar_citaciones(q, limite, p_camara default null). Se DROPea la firma de
-- 2 args (0032) y se crea la de 3; PostgREST resuelve `.rpc("buscar_citaciones", {q, limite})`
-- contra la nueva (p_camara toma su default null). Mismo SECURITY INVOKER + search_path=''.
-- Requiere: 0010 (RLS public-read + grant select a anon en citacion/citacion_invitado/citacion_punto).

drop function if exists public.buscar_citaciones(text, int);

create function public.buscar_citaciones(
  q text,
  limite int default 50,
  p_camara text default null   -- 'camara' | 'senado' | null (ambas)
)
returns table (
  id         text,
  camara     text,
  comision   text,
  fecha      timestamptz,
  materia    text,
  semana_iso text,
  estado     text,
  rank       real,
  boletin    text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with consulta as (
    select
      websearch_to_tsquery('spanish', q) as tsq,
      case when q ~ '^\d{3,6}-\d{1,2}$' then q else null end as bol,
      '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as patron
  )
  select
    c.id, c.camara, c.comision, c.fecha, c.materia, c.semana_iso, c.estado,
    ts_rank(c.busqueda_tsv, consulta.tsq) as rank,
    (
      select p.boletin
      from public.citacion_punto p
      where p.citacion_id = c.id and p.boletin is not null
      order by p.posicion
      limit 1
    ) as boletin
  from public.citacion c, consulta
  where
    (p_camara is null or c.camara = p_camara)
    and (
      (consulta.tsq is not null and c.busqueda_tsv @@ consulta.tsq)
      or exists (
        select 1 from public.citacion_invitado i
        where i.citacion_id = c.id and i.nombre ilike consulta.patron
      )
      or exists (
        select 1 from public.citacion_punto p
        where p.citacion_id = c.id
          and (
            p.materia ilike consulta.patron
            or (consulta.bol is not null and p.boletin = consulta.bol)
          )
      )
    )
  order by rank desc nulls last, c.fecha desc nulls last
  limit greatest(1, least(coalesce(limite, 50), 100));
$$;

grant execute on function public.buscar_citaciones(text, int, text) to anon;
