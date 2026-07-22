-- 0055_busqueda_hibrida.test.sql  (POST-APPLY ONLY — corre tras aplicar 0055)
--
-- Verifica el schema aplicado de la migración 0055_busqueda_hibrida.sql.
-- POST-APPLY ONLY: vive fuera del glob regular (supabase/tests/) a propósito.
-- Pre-apply los asserts (b) y (e) FALLARÍAN. El operador lo corre A MANO tras aplicar:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0055_busqueda_hibrida.test.sql
-- contra PROD ya aplicado. Debe reportar 5 ok, 0 not ok.

begin;
select plan(6);

-- (a) La función existe con la firma EXACTA (text, vector, int).
--     Pitfall 4: la firma en regprocedure debe ser EXACTA o lanza "function does not exist" → rollback.
select has_function(
  'public',
  'buscar_proyectos_hibrido',
  array['text', 'vector', 'integer'],
  'buscar_proyectos_hibrido(text, vector, int) existe'
);

-- (b) PUBLIC (grantee = 0) NO tiene EXECUTE sobre la RPC.
--     T-87-01: aclexplode es la única forma correcta ('public' no es un rol real — Pitfall pgTAP).
--     Espejo de 0045_revoke_public_rpc_gap.test.sql:23-26.
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.buscar_proyectos_hibrido(text,vector,integer)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en buscar_proyectos_hibrido (T-87-01)'
);

-- (c) La extensión unaccent está creada en PROD.
select ok(
  exists(select 1 from pg_extension where extname = 'unaccent'),
  'extension unaccent presente en PROD'
);

-- (d) La config text-search public.es_unaccent existe.
select ok(
  exists(select 1 from pg_ts_config where cfgname = 'es_unaccent'),
  'text search config es_unaccent existe'
);

-- (e-pre) Precondición: el boletín pinneado debe existir (WR-04 fix).
select ok(
  exists(select 1 from public.proyecto where boletin = '15627-12'),
  'precondition: boletin 15627-12 existe en public.proyecto (re-pinnear si falta)'
);

-- (e) Short-circuit boletín: q='15627-12' devuelve boletin='15627-12' con rank=0.
--     Boletín pinneado: 15627-12 (boletin_num=15627), presente en public.proyecto en PROD
--     al momento de aplicar 0055. Si este row se borrara, el assert puede fallar; en ese
--     caso re-pinnear con cualquier boletín real de `select boletin from proyecto limit 1`.
--     El vector nulo (array de ceros) es inocuo para el short-circuit: la rama boletin_hit
--     se activa antes de evaluar la rama semántica.
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
  'short-circuit boletín 15627-12 → rank 0 (RETR-01)'
);

select * from finish();
rollback;
