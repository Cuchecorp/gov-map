-- 0076_revoke_execute_public_residual.sql
--
-- Phase 124 (SUPA-FIX), wave 3 — pasos 4 y 5 del orden LOCKED.
-- Offenders: OFF-4-01 (f_unaccent exec-anon), OFF-4-02 (7 funciones RETURNS trigger con
-- EXECUTE TO PUBLIC nunca revocado), OFF-5-01 (f_unaccent sin search_path fijado).
-- Ejes 4 y 5 de 123-SUPA-AUDIT.md. Queries de origen: Q-12, Q-15 (eje 4) y Q-16 (eje 5,
-- por ausencia: f_unaccent es la unica funcion de public sin search_path en un corpus
-- 28/28 secdef con search_path='').
--
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
--            -f supabase/migrations/0076_revoke_execute_public_residual.sql
-- NUNCA `supabase db push` (drift de schema_migrations).
--
-- ── QUE HACE ──────────────────────────────────────────────────────────────────────────
-- Migracion de ACL pura + un `alter function ... set search_path`. CERO grant, CERO drop,
-- CERO create or replace, CERO cambio de tipo de retorno, CERO DML. `alter function ... set`
-- NO cambia la firma => no hay 42P13, no hay re-arma de default privileges.
--
-- ── POR QUE ES SEGURO ─────────────────────────────────────────────────────────────────
-- (a) Las 7 funciones trigger no son invocables como RPC (PostgREST no las expone); el
--     revoke cierra la superficie ANTES de que un cambio futuro de tipo de retorno las
--     vuelva explotables en silencio.
-- (b) f_unaccent SI es alcanzable hoy por POST /rest/v1/rpc/f_unaccent. Es un wrapper
--     escalar IMMUTABLE STRICT sin acceso a tablas.
-- (c) f_unaccent NO sostiene el pipeline FTS: 0055 monta la busqueda sobre la CONFIG de
--     text-search public.es_unaccent (`with public.unaccent, spanish_stem`), no sobre el
--     wrapper; 0055:24 declara que el wrapper existe "para indices trgm futuros (fase 88)";
--     grep de supabase/ y app/ no encuentra ninguna referencia fuera de su definicion.
-- (d) `set search_path = ''` es inocuo porque el CUERPO YA CALIFICA:
--       select public.unaccent('public.unaccent', $1)
--
-- ── ACL REAL VERIFICADO CONTRA PROD 2026-07-29 (correccion RULE-1) ────────────────────
-- Q-15 del audit reporto el ACL de las 8 como "=X/postgres". El ACL vivo COMPLETO es:
--       =X/postgres | postgres=X/postgres | service_role=X/postgres
-- Es decir, ADEMAS del EXECUTE TO PUBLIC hay un grant EXPLICITO a service_role (herencia
-- del `alter default privileges for role postgres in schema public grant ... to
-- service_role`). Consecuencia: `revoke ... from public` NO le quita el EXECUTE a
-- service_role — y eso es CORRECTO: el sitio ejecuta con service_role (Camino A).
-- anon/authenticated NO tienen grant explicito => el revoke-from-public los deja a cero.
-- NO se emite ningun grant compensatorio.
--
-- ── ENGANCHE MECANICO CON EL GUARD (exigencia n.4 del gate de la Phase 123) ───────────
-- Esta migracion contiene `revoke execute on function public.f_unaccent(text) from public`.
-- El detector (A5) de app/lib/lockdown-guard.test.ts compara la lista de offenders contra
-- KNOWN_MISSING_REVOKE_FROM_PUBLIC por IGUALDAD, no por subconjunto: al aparecer este
-- revoke, la entrada "0055_busqueda_hibrida.sql: f_unaccent" DEBE borrarse de la baseline
-- o la suite se pone ROJA. Eso es el diseno, no un efecto colateral.
--
-- Verificar despues: supabase/tests/post-apply/0076_revoke_execute_public_residual.test.sql
-- ─────────────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PRE-CHECK FAIL-CLOSED — el estado de PROD debe ser el que auditó la Phase 123
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Leccion mecanica de la wave 2 (0075): un REVOKE sobre objetos que no son del ejecutor
-- NO falla — no-opea con `WARNING 01006 no privileges could be revoked`. El unico
-- mecanismo que separa un cierre real de un cierre falso es el post-check fail-closed.
do $$
declare
  v_exec_anon int;
  v_total     int;
  v_nombres   text;
begin
  select count(*) into v_exec_anon
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  select count(*) into v_total
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  select string_agg(p.proname, ',' order by p.proname) into v_nombres
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  if v_exec_anon <> 8 then
    raise exception 'PRE-CHECK 0076 FALLO: se esperaban 8 funciones propias de public exec-anon (Q-15), hay %. Nombres: %', v_exec_anon, coalesce(v_nombres, '(ninguna)');
  end if;

  if v_nombres <> 'entidad_tercero_estado_no_regresa,f_unaccent,identidad_audit_immutable,parlamentario_estado_no_regresa,vinculo_entidad_guarda,vinculo_entidad_guarda_insert,vinculo_identidad_guarda,vinculo_identidad_guarda_insert' then
    raise exception 'PRE-CHECK 0076 FALLO: el conjunto exec-anon no es el enumerado por Q-15. Hallado: %', v_nombres;
  end if;

  raise notice 'PRE-CHECK 0076 OK: 8 de % funciones propias de public son exec-anon, exactamente las de Q-15.', v_total;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- FIX — OFF-4-01 + OFF-5-01: f_unaccent(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Doble-revoke (patron del proyecto, espejo 0055:114-115 / 0045). Firma EXACTA.
-- NO se revoca a postgres (owner) ni a service_role (grant explicito, consumidor real).
revoke execute on function public.f_unaccent(text) from public;
revoke execute on function public.f_unaccent(text) from anon, authenticated;

-- OFF-5-01: unica funcion de public sin search_path. El cuerpo ya califica public.unaccent.
alter function public.f_unaccent(text) set search_path = '';


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- FIX — OFF-4-02: las 7 funciones RETURNS trigger (todas de CERO argumentos, verificado
-- contra pg_get_function_identity_arguments en PROD 2026-07-29, no asumido)
-- ═══════════════════════════════════════════════════════════════════════════════════════
revoke execute on function public.entidad_tercero_estado_no_regresa() from public;
revoke execute on function public.entidad_tercero_estado_no_regresa() from anon, authenticated;

revoke execute on function public.identidad_audit_immutable() from public;
revoke execute on function public.identidad_audit_immutable() from anon, authenticated;

revoke execute on function public.parlamentario_estado_no_regresa() from public;
revoke execute on function public.parlamentario_estado_no_regresa() from anon, authenticated;

revoke execute on function public.vinculo_entidad_guarda() from public;
revoke execute on function public.vinculo_entidad_guarda() from anon, authenticated;

revoke execute on function public.vinculo_entidad_guarda_insert() from public;
revoke execute on function public.vinculo_entidad_guarda_insert() from anon, authenticated;

revoke execute on function public.vinculo_identidad_guarda() from public;
revoke execute on function public.vinculo_identidad_guarda() from anon, authenticated;

revoke execute on function public.vinculo_identidad_guarda_insert() from public;
revoke execute on function public.vinculo_identidad_guarda_insert() from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- POST-CHECK FAIL-CLOSED — misma transaccion. Comprueba el ACL RESULTANTE, no que los
-- comandos "no hayan dado error" (que es exactamente lo que un REVOKE no-op no hace).
-- ═══════════════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_exec_anon  int;
  v_exec_auth  int;
  v_total      int;
  v_sp         boolean;
  v_restantes  text;
begin
  select count(*) into v_exec_anon
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  select count(*) into v_exec_auth
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  select count(*) into v_total
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  select string_agg(p.proname, ',' order by p.proname) into v_restantes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  if v_exec_anon <> 0 then
    raise exception 'POST-CHECK 0076 FALLO: quedan % funciones propias de public exec-anon (esperado 0). Restantes: %', v_exec_anon, v_restantes;
  end if;

  if v_exec_auth <> 0 then
    raise exception 'POST-CHECK 0076 FALLO: quedan % funciones propias de public exec-authenticated (esperado 0).', v_exec_auth;
  end if;

  -- Denominador vivo: un 0 sobre 0 funciones inspeccionadas seria un cero VACUO.
  if v_total < 40 then
    raise exception 'POST-CHECK 0076 FALLO: el denominador de funciones propias de public es % (esperado ~42). Cero vacuo.', v_total;
  end if;

  select exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) c
    where c like 'search_path=%'
  ) into v_sp
  from pg_proc p
  where p.oid = 'public.f_unaccent(text)'::regprocedure;

  if not coalesce(v_sp, false) then
    raise exception 'POST-CHECK 0076 FALLO: public.f_unaccent(text) sigue sin search_path en proconfig (OFF-5-01).';
  end if;

  raise notice 'POST-CHECK 0076 OK: 0 de % funciones propias de public son exec-anon/authenticated; f_unaccent tiene search_path fijado.', v_total;
end $$;
