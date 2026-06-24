\pset format unaligned
\pset fieldsep '|'
\echo ===SELECT_TABLES_ANON===
select table_name from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type='SELECT' order by table_name;
\echo ===SELECT_TABLES_AUTHENTICATED===
select table_name from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and privilege_type='SELECT' order by table_name;
\echo ===ALL_PRIV_TYPES_ANON_DISTINCT===
select distinct privilege_type from information_schema.role_table_grants where grantee='anon' and table_schema='public' order by privilege_type;
\echo ===EXECUTE_ROUTINES_ANON===
select routine_name from information_schema.role_routine_grants where grantee='anon' and routine_schema='public' and privilege_type='EXECUTE' order by routine_name;
\echo ===EXECUTE_ROUTINES_AUTHENTICATED===
select routine_name from information_schema.role_routine_grants where grantee='authenticated' and routine_schema='public' and privilege_type='EXECUTE' order by routine_name;
\echo ===POLICIES_ALL===
select tablename||' :: '||policyname||' :: roles='||array_to_string(roles,',')||' :: cmd='||cmd||' :: qual='||coalesce(qual,'(null)') from pg_policies where schemaname='public' order by tablename, policyname;
\echo ===POLICIES_TOUCHING_ANON===
select tablename||' :: '||policyname||' :: '||array_to_string(roles,',')||' :: '||cmd from pg_policies where schemaname='public' and 'anon'=any(roles) order by tablename, policyname;
\echo ===ROLES===
select rolname||' login='||rolcanlogin from pg_roles where rolname in ('web_reader','authenticator','anon','authenticated','service_role') order by rolname;
\echo ===RLS_ENABLED_TABLES===
select relname||' rls='||relrowsecurity||' force='||relforcerowsecurity from pg_class where relkind='r' and relnamespace='public'::regnamespace order by relname;
\echo ===SEQ_GRANTS_ANON===
select object_name||' '||privilege_type from information_schema.role_usage_grants where grantee='anon' and object_schema='public' order by object_name;
\echo ===SCHEMA_USAGE===
select grantee||' '||privilege_type from information_schema.role_usage_grants where object_name='public' and object_type='SCHEMA' and grantee in ('anon','authenticated','web_reader','authenticator') order by grantee;
\echo ===COLUMN_GRANTS_ANON===
select table_name||'.'||column_name||' '||privilege_type from information_schema.role_column_grants where grantee='anon' and table_schema='public' order by table_name, column_name;
\echo ===END===
