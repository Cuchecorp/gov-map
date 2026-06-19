-- 0019_voto_asistencia_y_ficha.sql
-- Base de DB para la ficha del parlamentario (VOTE-03/04/05). Tres piezas acopladas:
--   (a) `ausente` al CHECK de `voto.seleccion` — habilita la ASISTENCIA first-class
--       (No Vota/dispensado del roster → fila `voto` con seleccion='ausente'). Sin esto
--       un ausente se confundiría con "no-ingestado" (rompe el estado (c) honesto).
--   (b) índice PARCIAL `voto(parlamentario_id)` — la ficha filtra por parlamentario_id;
--       sin él la query hace seq-scan (Pitfall 2). Parcial porque las filas no-confirmadas
--       (Senado por nombre / DIPID fuera de la maestra) son null y no estorban.
--   (c) RPC `votos_de_parlamentario` (security INVOKER, lista paginada — lee SOLO tablas
--       público-read) y RPC `rebeldias_de_parlamentario` (security DEFINER — lee
--       `parlamentario.partido` INTERNAMENTE y emite SOLO el derivado público).
--
-- POR QUÉ rebeldías es `security definer` y votos NO (LEGAL-03, Ley 21.719):
--   `partido` es AFILIACIÓN POLÍTICA (dato sensible) → `parlamentario` es deny-by-default
--   (RLS on, cero policies; anon NUNCA lee `partido`). El cómputo de "votó distinto a su
--   bancada" NECESITA `partido` y la opción modal de la bancada → no puede vivir en el
--   cliente ni en una query anon. `rebeldias_de_parlamentario` corre con los privilegios
--   del owner (`security definer set search_path = ''`) para leer `partido` internamente,
--   pero DEVUELVE SOLO datos públicos derivados (votacion_id + selección propia + mayoría),
--   nunca la bancada cruda de nadie, cero score, cero etiqueta de juicio.
--   `votos_de_parlamentario` toca solo `voto`/`votacion` (público-read) → security invoker
--   basta; no escala privilegios.
--
-- PROHIBIDO en esta migración (violaría LEGAL-03): NINGUNA `create policy` sobre
-- `parlamentario`, NINGÚN `grant select` que exponga `partido` a anon. El ÚNICO canal a
-- `partido` es el cuerpo del `security definer`.
--
-- La APLICACIÓN del DDL + la corrida pgTAP NO se hacen aquí: son un checkpoint de OPERADOR
-- (Task 3). build/typecheck NO prueban que Postgres ejecutó la migración (RESEARCH Pitfall 5:
-- BOM en .env rompe el CLI → pasar --db-url explícito).

-- ── (a) `ausente` al CHECK de voto.seleccion ─────────────────────────────────
-- 0008 crea el CHECK inline `seleccion text not null check (seleccion in (...))`; el nombre
-- por defecto de Postgres es `voto_seleccion_check`. Drop + add para ensanchar el dominio.
alter table voto drop constraint voto_seleccion_check;
alter table voto add constraint voto_seleccion_check
  check (seleccion in ('si', 'no', 'abstencion', 'pareo', 'ausente'));

-- ── (b) índice PARCIAL por parlamentario_id (query de la ficha, Pitfall 2) ────
create index if not exists voto_parlamentario_id_idx
  on voto (parlamentario_id)
  where parlamentario_id is not null;

-- ── (c1) RPC votos_de_parlamentario — lista paginada (VOTE-03) ────────────────
-- security INVOKER (default de `language sql`): lee solo tablas público-read; no escala.
-- Devuelve el boletín COMPLETO (con sufijo) y el enlace de la votación tal cual, porque la
-- ficha enlaza a `/proyecto/[boletin]` con ese valor (Pitfall 6). Solo filas confirmadas.
create or replace function votos_de_parlamentario(
  p_id text, p_limit int default 20, p_offset int default 0
)
returns table (
  votacion_id text, boletin text, fecha timestamptz,
  seleccion text, etapa text, camara text,
  origen text, fecha_captura timestamptz, enlace text
)
language sql stable
as $$
  select v.votacion_id, vo.boletin, vo.fecha, v.seleccion, vo.etapa, vo.camara,
         vo.origen, vo.fecha_captura, vo.enlace
  from voto v
  join votacion vo on vo.id = v.votacion_id
  where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
  order by vo.fecha desc nulls last
  limit p_limit offset p_offset;
$$;

-- ── (c2) RPC rebeldias_de_parlamentario — conteo+lista derivada (VOTE-05) ─────
-- security DEFINER: corre con privilegios del owner para leer `public.parlamentario.partido`
-- internamente (anon NO puede). `set search_path = ''` (V8): nombres calificados con schema.
-- Devuelve SOLO datos públicos derivados (votacion_id + boletín + fecha + selección propia +
-- opción mayoritaria de la bancada en ESA votación) donde el parlamentario difirió. CERO
-- score, cero etiqueta de juicio. La mayoría se computa solo sobre votos confirmados.
create or replace function rebeldias_de_parlamentario(p_id text)
returns table (
  votacion_id text, boletin text, fecha timestamptz,
  seleccion_propia text, mayoria_bancada text
)
language sql stable security definer set search_path = '' as $$
  with yo as (
    select partido from public.parlamentario where id = p_id
  ),
  mayoria as (  -- opción modal de la bancada por votación (solo votos confirmados)
    select v.votacion_id,
           mode() within group (order by v.seleccion) as mayoria
    from public.voto v
    join public.parlamentario p on p.id = v.parlamentario_id
    where p.partido = (select partido from yo)
      and v.estado_vinculo = 'confirmado'
    group by v.votacion_id
  )
  select v.votacion_id, vo.boletin, vo.fecha, v.seleccion, m.mayoria
  from public.voto v
  join mayoria m on m.votacion_id = v.votacion_id
  join public.votacion vo on vo.id = v.votacion_id
  where v.parlamentario_id = p_id
    and v.estado_vinculo = 'confirmado'
    and v.seleccion <> m.mayoria;   -- difirió de la mayoría de su bancada
$$;

-- ── grants execute a anon sobre las firmas EXACTAS (Pitfall: firma exacta) ────
-- Sin esto, el frontend (rol anon) no podría invocar los RPCs de la ficha.
-- NO se añade ninguna policy ni grant select sobre `parlamentario.partido` (LEGAL-03).
grant execute on function votos_de_parlamentario(text, int, int) to anon;
grant execute on function rebeldias_de_parlamentario(text) to anon;
