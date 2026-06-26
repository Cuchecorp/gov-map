-- 0046 — Camino A (post-legacy): DROP del rol `web_reader` (ya sin uso)
--
-- CONTEXTO: bajo Camino A (cero secreto simetrico) el sitio publico lee con la
-- SERVICE key (service_role), NO con un JWT `web_reader` auto-firmado. El rol
-- `web_reader` creado en 0043 (LOCKDOWN-01) queda SIN USO: nadie presenta un JWT
-- con `role: web_reader`, asi que `authenticator` jamas hace SET ROLE web_reader.
-- Esta migracion lo elimina limpiamente.
--
-- ORDEN (load-bearing): aplicar SOLO despues de que deploy03 (service key) este
-- vivo y 0044+0045 esten aplicados. Dropear web_reader antes dejaria el sitio sin
-- identidad de lectura SI todavia dependiera del JWT web_reader. Bajo Camino A el
-- sitio ya no depende de el, pero se mantiene el orden por seguridad:
--   deploy03(service key) -> 0044 -> 0045 -> 0046.
--
-- NO APLICAR EN AUTONOMO. Apply = checkpoint de operador (como todo DDL del repo):
--   psql "$DATABASE_URL" --single-transaction -f supabase/migrations/0046_drop_web_reader.sql
--   psql "$DATABASE_URL" -tA -f supabase/tests/post-apply/0046_drop_web_reader.test.sql
--
-- IDEMPOTENTE: si `web_reader` ya no existe, sale limpio sin error.
--
-- ROLLBACK: re-aplicar 0043 (recrea el rol + grants + policies _wr). Inocuo bajo
-- Camino A (el rol queda inerte de nuevo).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'web_reader') then
    raise notice '0046: rol web_reader no existe — nada que dropear (idempotente).';
    return;
  end if;

  -- 1. Drop de las 26 policies paralelas `*_public_read_wr` (dependen del rol).
  --    Dinamico para no enumerar las 26 tablas a mano.
  declare
    r record;
  begin
    for r in
      select schemaname, tablename, policyname
      from pg_policies
      where policyname like '%\_public\_read\_wr' escape '\'
    loop
      execute format(
        'drop policy if exists %I on %I.%I',
        r.policyname, r.schemaname, r.tablename
      );
    end loop;
  end;

  -- 2. Revoca TODO privilegio concedido A web_reader (SELECT en 26 tablas,
  --    EXECUTE en 15 RPCs, USAGE en schema) + cualquier objeto que poseyera.
  drop owned by web_reader;

  -- 3. Quita la membresia (authenticator era miembro de web_reader).
  if exists (
    select 1
    from pg_auth_members m
    join pg_roles parent on parent.oid = m.roleid
    join pg_roles child on child.oid = m.member
    where parent.rolname = 'web_reader' and child.rolname = 'authenticator'
  ) then
    revoke web_reader from authenticator;
  end if;

  -- 4. Drop del rol (ya sin dependencias).
  drop role web_reader;

  raise notice '0046: web_reader eliminado (policies _wr + grants + membresia + rol).';
end $$;
