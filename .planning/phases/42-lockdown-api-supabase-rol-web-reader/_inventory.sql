\echo === TABLE GRANTS (anon) ===
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee='anon' and table_schema='public'
order by table_name, privilege_type;

\echo === TABLE GRANTS (authenticated) ===
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee='authenticated' and table_schema='public'
order by table_name, privilege_type;

\echo === ROUTINE GRANTS (anon) ===
select routine_schema, routine_name, privilege_type
from information_schema.role_routine_grants
where grantee='anon' and routine_schema='public'
order by routine_name;

\echo === ROUTINE GRANTS (authenticated) ===
select routine_schema, routine_name, privilege_type
from information_schema.role_routine_grants
where grantee='authenticated' and routine_schema='public'
order by routine_name;

\echo === POLICIES touching anon ===
select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where 'anon' = any(roles)
order by tablename, policyname;

\echo === POLICIES touching authenticated ===
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where 'authenticated' = any(roles)
order by tablename, policyname;

\echo === SEQUENCE GRANTS (anon) ===
select object_schema, object_name, privilege_type
from information_schema.role_usage_grants
where grantee='anon' and object_schema='public'
order by object_name;

\echo === EXISTING web_reader role? ===
select rolname, rolcanlogin from pg_roles where rolname in ('web_reader','authenticator','anon','authenticated','service_role') order by rolname;

\echo === SCHEMA USAGE grants (anon/authenticated) on public ===
select grantee, privilege_type from information_schema.role_usage_grants where object_name='public' and object_type='SCHEMA' and grantee in ('anon','authenticated','web_reader');
