-- 0032_agenda_search.sql
-- Buscador de citaciones de comisiones (Frente B): Full-Text Search en español sobre
-- `citacion`, NO pgvector (la agenda no embebe — eso es para proyectos). Da el RPC
-- `buscar_citaciones(q, limite)` que la /agenda consume para buscar por comisión, materia,
-- invitado o boletín.
--
-- Principios:
--   * FTS `spanish` sobre (comision || materia) como columna GENERADA + índice GIN. La columna
--     usa `to_tsvector('spanish'::regconfig, …)` (2 args, config LITERAL) — IMMUTABLE, requisito
--     de una generated column (la forma de 1 arg depende de `default_text_search_config` → STABLE,
--     no sirve).
--   * El RPC es SECURITY INVOKER (default) + `set search_path = ''` (#38): lee SOLO tablas
--     públicas (citacion / citacion_invitado / citacion_punto — RLS public-read de 0010), nunca
--     escala privilegios ni expone columnas no públicas. `q` viaja PARAMETRIZADO
--     (websearch_to_tsquery / ilike con bind param) — jamás se interpola en SQL.
--   * GRANT EXECUTE a anon sobre la firma EXACTA (igual que match_proyectos en 0011): sin él, el
--     frontend (rol anon) no podría buscar. Los invitados son terceros públicos (ya visibles en
--     las cards de /agenda) → el buscador NO expone PII nueva.
--   * El cruce a la ficha por boletín lo hace el atajo del data-layer (redirect a /proyecto/[bol]),
--     espejando /buscar; el RPC además matchea citacion_punto.boletin exacto por robustez.

-- ── Columna FTS generada + índice GIN ────────────────────────────────────────
alter table public.citacion
  add column if not exists busqueda_tsv tsvector
  generated always as (
    to_tsvector(
      'spanish'::regconfig,
      coalesce(comision, '') || ' ' || coalesce(materia, '')
    )
  ) stored;

create index if not exists citacion_busqueda_tsv_idx
  on public.citacion using gin (busqueda_tsv);

-- ── RPC buscar_citaciones: FTS spanish + match en hijos + boletín exacto ─────
-- Devuelve filas de `citacion` rankeadas (id, comisión, fecha, cámara, materia, semana,
-- estado, rank, primer boletín). Combina:
--   (a) FTS sobre comisión+materia (websearch_to_tsquery → tolera frases, OR, comillas);
--   (b) match `ilike` en nombre de invitado (terceros públicos) y materia de los puntos;
--   (c) boletín exacto NNNNN-NN en citacion_punto.boletin.
create or replace function public.buscar_citaciones(q text, limite int default 50)
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
set search_path = ''
as $$
  with consulta as (
    select
      websearch_to_tsquery('spanish', q) as tsq,
      -- boletín exacto NNNNN-NN para el match directo en los puntos.
      case when q ~ '^\d{3,6}-\d{1,2}$' then q else null end as bol,
      -- patrón ilike escapado (los comodines de q se neutralizan) para hijos.
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
  order by rank desc nulls last, c.fecha desc nulls last
  limit greatest(1, least(coalesce(limite, 50), 100));
$$;

-- GRANT EXECUTE del RPC a anon sobre la firma EXACTA (igual que 0011 / match_proyectos).
grant execute on function public.buscar_citaciones(text, int) to anon;
