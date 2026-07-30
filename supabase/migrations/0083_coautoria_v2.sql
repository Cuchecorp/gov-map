-- 0083_coautoria_v2.sql
-- Phase 131 (DEBT-FICHA) — fila 3.3 / DEBT-04: la co-autoría de /comparar deja de truncar en
-- silencio a 20 y emite membresía de par COMPLETA.
--
-- ── DECISIÓN RECTORA ──────────────────────────────────────────────────────────────────────
-- `coautores_de_parlamentario(text)` (VIVA, definida en 0064_bounded_rpc_statement_timeout.sql,
-- previamente en 0060_bio_partido_publico.sql) queda INTACTA: cambiar su `returns table`
-- dispara 42P13 y re-arma los default privileges (superficie REST re-abierta). Esta migración
-- crea una firma NUEVA PARALELA (precedente 0060: `parlamentario_publico_v2` y análogas) que
-- SÍ emite la membresía de par completa (limit 1000 en vez de 20). La vieja sigue en uso por
-- `app/app/parlamentario/[id]/page.tsx` (molde WR-01: muestra 20 de M declarando M honesto) y
-- por eso NO se dropea.
--
-- ── TECHO DERIVADO DE MEDICIÓN (criterio de 0079: >= 4x el máximo medido, nunca < 1000) ────
--   función                          clase   máximo medido   techo   margen   dominio
--   ------------------------------   -----   -------------   -----   ------   -------------------
--   coautores_de_parlamentario_v2    FILAS   101             1000    9.9x     180 parlamentarios
--                                                                              (100%, no muestra)
--
-- Medición: psql -tA contra PROD, 2026-07-30. Máximo real de coautores por parlamentario = 101;
-- 153 de 180 parlamentarios (85.0%) superan el cap viejo de 20; ninguno supera 1000.
-- Criterio: 4 × 101 = 404 < 1000 ⇒ techo = 1000 (el piso de 0079), margen 9.9x.
--
-- LO QUE LA ASERCIÓN NO PRUEBA (dicho antes de venderla, honestidad de 0079): con el techo
-- derivado del máximo medido, `medido < techo` es TAUTOLÓGICO hoy — no puede fallar. Su valor
-- es cazar DERIVA futura (crecimiento del corpus de co-autoría), no probar corrección presente.
--
-- ── ACL (Camino A): CERO grant ──────────────────────────────────────────────────────────────
-- El sitio ejecuta las RPCs con service_role (bypassa ACL/RLS). Doble-revoke explícito (from
-- public; from anon, authenticated) para limpiar los DEFAULT PRIVILEGES que Postgres re-concede
-- sobre funciones nuevas de `public`. Cero grant. Cero cron.schedule. Cero DML (función stable,
-- sólo lectura).

drop function if exists public.coautores_de_parlamentario_v2(text);

create or replace function public.coautores_de_parlamentario_v2(p_id text)
returns table (id text, nombre text, camara text, n_proyectos int, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select p2.id,
         coalesce(
           nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.nombre_normalizado
         ) as nombre,
         p2.camara,
         count(distinct a2.boletin)::int as n_proyectos,
         count(*) over () as total_n
  from public.proyecto_autor a1
  join public.proyecto_autor a2
    on a2.boletin = a1.boletin
   and a2.estado_vinculo = 'confirmado'
   and a2.parlamentario_id is not null
   and a2.parlamentario_id <> p_id
  join public.parlamentario p2 on p2.id = a2.parlamentario_id
  where a1.parlamentario_id = p_id
    and a1.estado_vinculo = 'confirmado'
  group by p2.id, p2.nombres, p2.apellido_paterno, p2.apellido_materno,
           p2.nombre_normalizado, p2.camara
  order by nombre
  limit 1000;
$$;

revoke all on function public.coautores_de_parlamentario_v2(text) from public;
revoke all on function public.coautores_de_parlamentario_v2(text) from anon, authenticated;
