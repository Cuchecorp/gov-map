\pset format unaligned
\pset fieldsep '|'
\echo ===CURATED_RPC_GRANTS===
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
       array_to_string(p.proargnames,',') as args,
       p.prosecdef as secdef
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.proname in ('match_proyectos','votos_de_parlamentario','rebeldias_de_parlamentario',
    'parlamentario_publico','parlamentarios_publico','declaraciones_de_parlamentario',
    'comparar_declaraciones','bienes_de_parlamentario','lobby_de_parlamentario',
    'aportes_de_parlamentario','agregado_por_contraparte','contratos_de_parlamentario',
    'buscar_citaciones','subgrafo_red','cruces_de_parlamentario','resolver_entidad')
order by p.proname;
\echo ===NONPGTAP_PUBLIC_FUNCS_GRANTED_ANON===
select p.proname
from pg_proc p
where p.pronamespace='public'::regnamespace
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and p.proname not like '\_%'
  and p.proname not in ('runtests','lives_ok','throws_ok','results_eq','results_ne','is','isnt',
    'ok','plan','finish','pass','fail','diag','todo','skip','has_table','has_column','col_is_pk',
    'has_index','has_function','function_returns','is_definer','isa_ok','bag_has','set_eq','cmp_ok',
    'matches','alike','unalike','throws_like','lives_like','col_type_is','col_not_null','col_is_null',
    'fk_ok','has_pk','has_fk','index_is_unique','col_default_is','function_privs_are','table_privs_are',
    'has_role','hasnt_role','policy_cmd_is','policies_are','is_empty','row_eq','schema_privs_are')
order by p.proname;
\echo ===END===
