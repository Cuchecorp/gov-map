-- 0056_busqueda_hibrida_boletin_norm.test.sql  (POST-APPLY ONLY)
--
-- Verifica el bugfix bo-03: boletín punteado "14.309-04" → short-circuit rank 0.
-- POST-APPLY ONLY: corre DESPUÉS de aplicar 0056 contra PROD.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0056_busqueda_hibrida_boletin_norm.test.sql
-- Debe reportar 5 ok, 0 not ok.

begin;
select plan(7);

-- (a) La función sigue existiendo con la firma EXACTA (text, vector, int).
select has_function(
  'public',
  'buscar_proyectos_hibrido',
  array['text', 'vector', 'integer'],
  'buscar_proyectos_hibrido(text, vector, int) existe tras 0056'
);

-- (b) PUBLIC sigue sin EXECUTE (T-87-01 — ACL intacta tras reemplazar la función).
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.buscar_proyectos_hibrido(text,vector,integer)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en buscar_proyectos_hibrido tras 0056 (T-87-01)'
);

-- (c) Short-circuit canónico sigue funcionando: "15627-12" → rank 0.
--     Pin bo-01/bo-02/bo-04: verifica que el fix no rompe el caso sin punto.
select is(
  (select boletin
   from public.buscar_proyectos_hibrido(
     '15627-12',
     array_fill(0.0::float4, array[768])::vector,
     5
   )
   where rank = 0
   limit 1),
  '15627-12',
  'short-circuit boletín canónico 15627-12 → rank 0 (regresión bo-01/02/04)'
);

-- (d-pre) Precondición: el boletín pinneado debe existir antes del assert (WR-04 fix).
--     Si falta, reporta data-precondition failure (no logic failure).
select ok(
  exists(select 1 from public.proyecto where boletin = '14309-04'),
  'precondition: boletin 14309-04 existe en public.proyecto (re-pinnear si falta)'
);

-- (d) SHORT-CIRCUIT PUNTEADO — caso bo-03 (Pitfall #5, pin A3).
--     "14.309-04" debe normalizarse a "14309-04" dentro de la RPC y devolver rank 0.
--     Boletín pinneado: 14309-04 presente en public.proyecto en PROD al momento de aplicar 0056.
--     Si el boletín se borrara, re-pinnear con `select boletin from proyecto limit 1`.
select is(
  (select boletin
   from public.buscar_proyectos_hibrido(
     '14.309-04',
     array_fill(0.0::float4, array[768])::vector,
     5
   )
   where rank = 0
   limit 1),
  '14309-04',
  'short-circuit boletín punteado "14.309-04" → boletin 14309-04 rank 0 (bo-03 fix)'
);

-- (e-pre) Precondición compartida con (d): mismo boletín (WR-04 fix).
--     (La precondición ya está cubierta por (d-pre) si ambas están en el mismo plan.)
select ok(
  exists(select 1 from public.proyecto where boletin_num::text = '14309'),
  'precondition: boletin_num=14309 existe en public.proyecto (cubre el assert (e))'
);

-- (e) Boletín punteado sin sufijo: "14.309" → short-circuit por boletin_num.
--     Verifica que la normalización cubre el caso base sin "-NN".
select is(
  (select boletin
   from public.buscar_proyectos_hibrido(
     '14.309',
     array_fill(0.0::float4, array[768])::vector,
     5
   )
   where rank = 0
   limit 1),
  '14309-04',
  'short-circuit boletín punteado sin sufijo "14.309" → boletin_num match rank 0'
);

select * from finish();
rollback;
