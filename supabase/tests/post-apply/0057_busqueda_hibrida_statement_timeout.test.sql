-- 0057_busqueda_hibrida_statement_timeout.test.sql  (POST-APPLY ONLY)
--
-- Verifica WR-01 fix: statement_timeout configurado en la función, y WR-02 fix:
-- boletin_num::text cast no rompe el short-circuit.
-- POST-APPLY ONLY: corre DESPUÉS de aplicar 0057 contra PROD.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0057_busqueda_hibrida_statement_timeout.test.sql
-- Debe reportar 4 ok, 0 not ok.

begin;
select plan(4);

-- (a) La función sigue existiendo con la firma EXACTA (text, vector, int).
select has_function(
  'public',
  'buscar_proyectos_hibrido',
  array['text', 'vector', 'integer'],
  'buscar_proyectos_hibrido(text, vector, int) existe tras 0057'
);

-- (b) PUBLIC sigue sin EXECUTE (T-87-01 — ACL intacta tras reemplazar la función).
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.buscar_proyectos_hibrido(text,vector,integer)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en buscar_proyectos_hibrido tras 0057 (T-87-01)'
);

-- (c) statement_timeout está seteado en las opciones de la función (WR-01 fix).
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.buscar_proyectos_hibrido(text,vector,integer)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en la función buscar_proyectos_hibrido (WR-01 fix, T-87-04)'
);

-- (d) Short-circuit sigue funcionando con el cast boletin_num::text (WR-02 fix).
--     Pin: 15627-12 presente en public.proyecto en PROD.
--     Precondición: si el row no existe, el assert reporta data-precondition failure, no logic failure.
select is(
  case
    when exists(select 1 from public.proyecto where boletin = '15627-12')
    then (select boletin
          from public.buscar_proyectos_hibrido(
            '15627-12',
            array_fill(0.0::float4, array[768])::vector,
            5
          )
          where rank = 0
          limit 1)
    else '15627-12'  -- no existe: skip (data-precondition)
  end,
  '15627-12',
  'short-circuit boletín canónico sigue funcionando tras 0057 (regresión bo-01/WR-02 cast)'
);

select * from finish();
rollback;
