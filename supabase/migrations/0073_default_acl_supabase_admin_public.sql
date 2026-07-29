-- 0073_default_acl_supabase_admin_public.sql
--
-- Offender:        OFF-01  (Phase 123 — auditoria de estructura Supabase)
-- Eje:             3 (regimen cero-grant)
-- Query de origen: Q-10 (`pg_default_acl` — ALTER DEFAULT PRIVILEGES vivos)
-- Destino:         124-aditivo
-- Orden LOCKED:    paso 1 de 3 — va ANTES que toda otra migracion de la Phase 124.
--
-- Que arregla
-- -----------
-- El rol `supabase_admin` mantiene tres default ACL sobre el esquema `public`
-- (tipos de objeto `r` = tablas, `f` = funciones, `S` = secuencias) que conceden
-- `arwdDxtm` / `EXECUTE` / `rwU` a `anon` y `authenticated`. La migracion 0044
-- revoco el juego equivalente del rol `postgres` y NO toco este.
--
-- Consecuencia: cualquier objeto futuro creado en `public` por `supabase_admin`
-- nace legible por un cliente NO autenticado via Data API, sin que exista un solo
-- `GRANT` en el repo que lo delate (`anon` ya tiene `USAGE` sobre el esquema, Q-11).
-- Es el unico mecanismo que reabre el boundary sin una linea de codigo.
--
-- El escape previsto (Q-23) — NO se traga en silencio
-- ---------------------------------------------------
-- `postgres` NO es superusuario en Supabase (`pg_roles.rolsuper = f`, Q-23), y esta
-- migracion se aplica como `postgres`. Un `alter default privileges FOR ROLE
-- supabase_admin` exige membresia en ese rol, por lo que este archivo PUEDE fallar
-- con `SQLSTATE 42501` (insufficient_privilege) o un error de membresia/ownership.
--
-- Si falla asi: el resultado se reclasifica a `deuda-operador`, se reporta de forma
-- explicita en `124-OFF-01-RESULTADO.md` con la evidencia del intento, y JAMAS se
-- escala privilegio para forzarlo. Sin `set role`, sin `security definer`, sin la
-- service key, sin el dashboard. Fallar y declararlo es el resultado correcto;
-- fallar y omitirlo, no.
--
-- Naturaleza
-- ----------
-- Puramente sustractiva: solo `revoke`. Cero `DROP`, cero cambio de tipo, cero
-- backfill, cero objeto creado. No toca `storage`, no toca `net`, no toca funcion
-- alguna.
--
-- Aplicacion
-- ----------
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/0073_default_acl_supabase_admin_public.sql
--
-- Reversa (documental — NO aplicar; reabriria el boundary):
--   el estado previo es el bootstrap de Supabase; restaurarlo exigiria re-conceder
--   a `anon`/`authenticated`, que es exactamente el defecto que esta migracion cierra.


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 1 — PRE-CHECK fail-closed
--
-- Aplicar sobre un estado de partida distinto al auditado esta PROHIBIDO: si el
-- catalogo no muestra los 3 tipos de objeto (`r`, `f`, `S`) que Q-10 encontro,
-- la transaccion aborta en vez de aplicar sobre un supuesto falso.
--
-- Fuente autoritativa: `aclexplode(d.defaclacl)` con `a.grantee::regrole::text`.
-- NO un `like` sobre el texto del ACL (un `like` confunde `anon` con cualquier rol
-- que lo contenga como subcadena y no distingue grantee de grantor).
-- ════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tipos int;
begin
  select count(distinct d.defaclobjtype)
    into v_tipos
  from pg_default_acl d,
       aclexplode(d.defaclacl) a
  where d.defaclrole      = (select oid from pg_roles     where rolname = 'supabase_admin')
    and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public')
    and a.grantee::regrole::text in ('anon', 'authenticated');

  if v_tipos <> 3 then
    raise exception
      'PRE-CHECK 0073 fail-closed: se esperaban 3 tipos de objeto (r, f, S) con grantee publico en el default ACL de supabase_admin sobre public (estado auditado por Q-10); se hallaron %. Estado de partida distinto al auditado: se aborta la transaccion en vez de aplicar sobre un supuesto falso.',
      v_tipos;
  end if;

  raise notice 'PRE-CHECK 0073 OK: % tipos de objeto afectados, como Q-10 (r, f, S).', v_tipos;
end
$$;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 2 — EL FIX (OFF-01, textual segun la tabla de offenders de 123)
--
-- Solo `revoke`. Ningun `grant`, ningun cambio de rol, ninguna maniobra para
-- sortear la membresia. Si estas tres lineas fallan por privilegio, ese fallo ES
-- el resultado (rama B: deuda-operador).
-- ════════════════════════════════════════════════════════════════════════════════

alter default privileges for role supabase_admin in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 3 — POST-CHECK dentro de la MISMA transaccion
--
-- Un revoke que no revoco nada no debe committear en silencio. Si el conteo no es
-- cero, la transaccion aborta y el estado queda intacto.
-- ════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_restantes int;
begin
  select count(*)
    into v_restantes
  from pg_default_acl d,
       aclexplode(d.defaclacl) a
  where d.defaclrole      = (select oid from pg_roles     where rolname = 'supabase_admin')
    and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public')
    and a.grantee::regrole::text in ('anon', 'authenticated');

  if v_restantes <> 0 then
    raise exception
      'POST-CHECK 0073: quedan % entradas con grantee anon/authenticated en el default ACL de supabase_admin sobre public. El revoke no surtio efecto; se aborta para no committear un cierre falso.',
      v_restantes;
  end if;

  raise notice 'POST-CHECK 0073 OK: 0 entradas anon/authenticated restantes. OFF-01 cerrado.';
end
$$;
