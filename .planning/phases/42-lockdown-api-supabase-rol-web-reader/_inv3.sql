\pset format unaligned
\pset fieldsep '|'
\echo ===PGVECTOR_PUBLIC_ACL===
-- Does PUBLIC (grantee with empty/0) have EXECUTE on key pgvector funcs? acl entries: =X/ means PUBLIC has EXECUTE.
select p.proname, coalesce(array_to_string(p.proacl,' ; '),'(null acl = owner+PUBLIC default)') as acl
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname in ('cosine_distance','l2_distance','inner_product','vector_negative_inner_product','vector_l2_squared_distance','l2_normalize','vector_dims')
order by p.proname;
\echo ===PUBLIC_HAS_EXEC_via_implicit===
-- has_function_privilege for 'public' pseudo-role is not allowed; instead test a brand-new probe: does a role with zero grants get EXECUTE? We check if acl is null (null => default => PUBLIC EXECUTE for funcs).
select p.proname, (p.proacl is null) as acl_is_null_means_public_exec
from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('cosine_distance','match_proyectos','vector_dims') order by p.proname;
\echo ===MATCH_PROYECTOS_DEF===
select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='match_proyectos';
\echo ===RELKIND_pgtap_views===
select relname, relkind from pg_class where relnamespace='public'::regnamespace and relname in ('pg_all_foreign_keys','tap_funky','proyecto','votacion') order by relname;
\echo ===ANON_SELECT_RELKIND_BREAKDOWN===
-- all relations anon has SELECT on, with relkind (r=table, v=view, m=matview), to see views
select c.relkind, count(*) from information_schema.role_table_grants g join pg_class c on c.relname=g.table_name and c.relnamespace='public'::regnamespace where g.grantee='anon' and g.table_schema='public' and g.privilege_type='SELECT' group by c.relkind order by c.relkind;
\echo ===ANON_SELECT_VIEWS_LIST===
select c.relname, c.relkind from information_schema.role_table_grants g join pg_class c on c.relname=g.table_name and c.relnamespace='public'::regnamespace where g.grantee='anon' and g.table_schema='public' and g.privilege_type='SELECT' and c.relkind in ('v','m') order by c.relname;
\echo ===RPC_IDENTITY_ARGS===
select p.proname||' :: '||pg_get_function_identity_arguments(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('agregado_por_contraparte','aportes_de_parlamentario','bienes_de_parlamentario','buscar_citaciones','comparar_declaraciones','contratos_de_parlamentario','cruces_de_parlamentario','declaraciones_de_parlamentario','lobby_de_parlamentario','match_proyectos','parlamentario_publico','parlamentarios_publico','rebeldias_de_parlamentario','subgrafo_red','votos_de_parlamentario') order by p.proname;
\echo ===CURRENT_ROLE===
select current_user, current_role;
\echo ===DEFAULT_ACL===
select pg_get_userbyid(defaclrole) as owner_role, defaclobjtype, array_to_string(defaclacl,' ; ') as acl from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public' order by defaclobjtype;
\echo ===END===
