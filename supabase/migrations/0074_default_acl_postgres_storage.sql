-- 0074_default_acl_postgres_storage.sql
--
-- Offender:        OFF-6-04  (Phase 123 — auditoria de estructura Supabase)
-- Eje:             6 (buckets · keys · superficie Data API)
-- Query de origen: Q-10 (`pg_default_acl` — ALTER DEFAULT PRIVILEGES vivos)
--                  + Q-20 / Q-21 (0 buckets, 0 policies — por que hoy es INERTE
--                    y por que el orden de aplicacion es load-bearing)
-- Destino:         124-aditivo
-- Orden LOCKED:    paso 2 de 3 — ANTES de crear cualquier bucket (crear uno es OP-3,
--                  acto de operador, jamas acto de agente).
--
-- Que arregla
-- -----------
-- El rol `postgres` mantiene tres default ACL sobre el esquema `storage`
-- (tipos `r` = tablas, `f` = funciones, `S` = secuencias) que conceden
-- `arwdDxtm` / `EXECUTE` / `rwU` a `anon` y `authenticated`.
--
-- Hoy el defecto es INERTE, y se dice por que: `Q-20` da 0 buckets y `Q-21` da
-- 0 policies sobre `storage.objects` — un CERO VACUO. En el momento en que el
-- operador cree el bucket de `OP-3`, ese cero se vuelve un agujero: el objeto
-- nuevo nace con grants a los roles publicos sin que exista un solo `GRANT` en el
-- repo que lo delate, y `anon` ya tiene `USAGE` sobre el esquema `storage` (Q-22).
-- Por eso el orden es correctitud, no preferencia: primero se cierra el default,
-- despues se crea el bucket.
--
-- Escape previsto (identico a OFF-01 / 0073) — NO se traga en silencio
-- --------------------------------------------------------------------
-- A diferencia de `0073`, aqui el `defaclrole` es **`postgres`**, que es la propia
-- identidad de la conexion de las migraciones ⇒ hay ownership y la rama de fallo es
-- IMPROBABLE. Aun asi queda escrita antes de correr: si `psql` sale con
-- `SQLSTATE 42501` o un error de membresia/ownership, el resultado se reclasifica a
-- `deuda-operador` en `124-OFF-6-04-RESULTADO.md` con la evidencia del intento, y
-- JAMAS se escala privilegio (sin `set role`, sin `security definer`, sin service
-- key, sin dashboard). Cualquier otro error ⇒ PARAR.
--
-- Naturaleza
-- ----------
-- Puramente sustractiva: solo `revoke`. Cero `DROP`, cero cambio de tipo, cero
-- backfill, cero objeto creado. NO se toca `storage.objects`, NO se crea ningun
-- bucket, NO se escribe ninguna policy (eso es `OP-3`, acto de operador).
--
-- Aplicacion
-- ----------
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/0074_default_acl_postgres_storage.sql
--
-- Reversa (documental — NO aplicar; reabriria el boundary):
--   restaurar el estado previo exigiria re-conceder a `anon`/`authenticated`, que es
--   exactamente el defecto que esta migracion cierra.


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 1 — PRE-CHECK fail-closed
--
-- Fuente autoritativa: `aclexplode(d.defaclacl)` con `a.grantee::regrole::text`.
-- NO un `like` sobre el texto del ACL (confunde subcadenas y no distingue grantee
-- de grantor).
-- ════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tipos int;
begin
  select count(distinct d.defaclobjtype)
    into v_tipos
  from pg_default_acl d,
       aclexplode(d.defaclacl) a
  where d.defaclrole      = (select oid from pg_roles     where rolname = 'postgres')
    and d.defaclnamespace = (select oid from pg_namespace where nspname = 'storage')
    and a.grantee::regrole::text in ('anon', 'authenticated');

  if v_tipos <> 3 then
    raise exception
      'PRE-CHECK 0074 fail-closed: se esperaban 3 tipos de objeto (r, f, S) con grantee publico en el default ACL de postgres sobre storage (estado auditado por Q-10); se hallaron %. Estado de partida distinto al auditado: se aborta la transaccion en vez de aplicar sobre un supuesto falso.',
      v_tipos;
  end if;

  raise notice 'PRE-CHECK 0074 OK: % tipos de objeto afectados, como Q-10 (r, f, S).', v_tipos;
end
$$;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 2 — EL FIX (OFF-6-04, textual segun la tabla de offenders de 123)
--
-- Solo `revoke`. Ningun `grant`, ningun bucket, ninguna policy, ningun `set role`.
-- ════════════════════════════════════════════════════════════════════════════════

alter default privileges for role postgres in schema storage revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema storage revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema storage revoke all on sequences from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 3 — POST-CHECK dentro de la MISMA transaccion
--
-- Un revoke que no revoco nada no debe committear en silencio.
-- ════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_restantes int;
begin
  select count(*)
    into v_restantes
  from pg_default_acl d,
       aclexplode(d.defaclacl) a
  where d.defaclrole      = (select oid from pg_roles     where rolname = 'postgres')
    and d.defaclnamespace = (select oid from pg_namespace where nspname = 'storage')
    and a.grantee::regrole::text in ('anon', 'authenticated');

  if v_restantes <> 0 then
    raise exception
      'POST-CHECK 0074: quedan % entradas con grantee anon/authenticated en el default ACL de postgres sobre storage. El revoke no surtio efecto; se aborta para no committear un cierre falso.',
      v_restantes;
  end if;

  raise notice 'POST-CHECK 0074 OK: 0 entradas anon/authenticated restantes. OFF-6-04 cerrado.';
end
$$;
