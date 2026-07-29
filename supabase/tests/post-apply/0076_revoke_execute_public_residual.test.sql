-- 0076_revoke_execute_public_residual.test.sql   (POST-APPLY ONLY)
--
-- Verifica OFF-4-01, OFF-4-02 (eje 4, queries de origen Q-12/Q-15) y OFF-5-01
-- (eje 5, Q-16 por ausencia) de 123-SUPA-AUDIT.md contra el SCHEMA APLICADO,
-- nunca contra el archivo de migracion.
--
-- POST-APPLY ONLY: vive fuera del glob de la suite regular (`supabase/tests/*.test.sql`)
-- a proposito: pre-apply sus aserciones son las OPUESTAS al estado real y darian rojo.
-- Se corre A MANO, DESPUES de aplicar 0076:
--
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0076_revoke_execute_public_residual.test.sql
--
-- (`$SUPABASE_DB_URL` se usa por NOMBRE; su valor jamas se ecoa ni se transcribe.)
--
-- Debe reportar 5 ok, 0 not ok.
--
-- plan(5):
--   (A) 0 funciones propias de public con EXECUTE para `anon`, CON DENOMINADOR EXPLICITO
--       dentro de la MISMA asercion (anti-cero-vacuo, nota Q-17 vs Q-18 del audit): un
--       cero por desaparicion de las funciones NO es el mismo cero que un cero por revoke.
--   (B) idem para `authenticated` = 0.
--   (C) f_unaccent(text) NOMBRADA: exec-`anon` = false. Es la unica de las 8 realmente
--       invocable por REST (POST /rest/v1/rpc/f_unaccent); las otras 7 son RETURNS
--       trigger y PostgREST no las expone.
--   (D) f_unaccent(text) tiene search_path en su proconfig (OFF-5-01).
--   (E) EXPOSICION RESIDUAL ADJUDICADA, NO SUPUESTA: el otorgamiento a PUBLIC (grantee 0)
--       desaparecio del ACL de f_unaccent.
--
-- Ademas, FUERA del conteo del plan, un control funcional (F) fail-loud por excepcion:
-- invoca f_unaccent como owner y compara contra el literal sin tildes, probando que
-- `set search_path = ''` no rompio la resolucion de public.unaccent en el cuerpo.
--
-- ── NOTA RULE-1: correccion de la premisa de (E) ──────────────────────────────────────
-- El plan 124-03 asumia, siguiendo la transcripcion de Q-15 ("ACL =X/postgres"), que el
-- UNICO otorgamiento de f_unaccent era el EXECUTE TO PUBLIC, y que por tanto tras el
-- revoke solo el owner (postgres) podria ejecutarla => service_role = false.
--
-- El ACL vivo capturado contra PROD ANTES del apply (2026-07-29) lo refuta:
--       =X/postgres | postgres=X/postgres | service_role=X/postgres
-- Hay un grant EXPLICITO a service_role (herencia del `alter default privileges for role
-- postgres in schema public ... grant to service_role`), presente en las 8 funciones.
-- `revoke ... from public` NO lo toca. ACL despues del apply:
--       postgres=X/postgres | service_role=X/postgres
--
-- Por eso (E) NO asierta `service_role = false`: eso habria sido falso y habria empujado
-- a emitir un revoke extra sobre service_role que el plan prohibe explicitamente. Lo que
-- (E) prueba es lo que de verdad importa: que el grantee PUBLIC desaparecio, dejando el
-- residual adjudicado a {owner postgres, service_role} y a nadie mas. Es el estado
-- correcto y el que el proyecto quiere (Camino A: el sitio ejecuta con service_role).
-- NO se emitio ningun grant compensatorio: habria sido reabrir superficie.
--
-- Read-only: envuelto en begin/rollback, no muta nada.

begin;
select plan(5);


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- (A) OFF-4-01 + OFF-4-02: cero funciones propias de public exec-`anon`, con denominador
--     declarado DENTRO de la asercion (el cero es fuerte, no vacuo).
-- ═══════════════════════════════════════════════════════════════════════════════════════
select is(
  (select (count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')))::text
          || ' de ' ||
          (case when count(*) >= 40 then 'un corpus vivo >= 40' else 'DENOMINADOR ROTO: ' || count(*)::text end)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  '0 de un corpus vivo >= 40',
  '(A) OFF-4-01/02: cero funciones propias de public ejecutables por anon (Q-12/Q-15; eran 8 de 42), con denominador vivo declarado'
);


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- (B) Lo mismo para `authenticated`
-- ═══════════════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  0,
  '(B) cero funciones propias de public ejecutables por authenticated'
);


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- (C) f_unaccent NOMBRADA: la unica de las 8 realmente invocable por REST
-- ═══════════════════════════════════════════════════════════════════════════════════════
select is(
  has_function_privilege('anon', 'public.f_unaccent(text)'::regprocedure, 'EXECUTE'),
  false,
  '(C) OFF-4-01: public.f_unaccent(text) ya NO es ejecutable por anon via POST /rest/v1/rpc/'
);


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- (D) OFF-5-01: search_path fijado
-- ═══════════════════════════════════════════════════════════════════════════════════════
select is(
  (select exists (
     select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
   )
   from pg_proc p
   where p.oid = 'public.f_unaccent(text)'::regprocedure),
  true,
  '(D) OFF-5-01: public.f_unaccent(text) tiene search_path en proconfig (unica grieta del corpus, cerrada)'
);


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- (E) Exposicion residual ADJUDICADA (ver NOTA RULE-1 en la cabecera).
--     grantee 0 = PUBLIC en aclexplode. Fuente autoritativa: el ACL, no un `like`.
-- ═══════════════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.f_unaccent(text)'::regprocedure
     and a.grantee = 0),
  0,
  '(E) el otorgamiento a PUBLIC desaparecio del ACL de f_unaccent; el residual queda adjudicado a {postgres owner, service_role}, sin grant compensatorio'
);


-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CONTROL FUNCIONAL (F): fuera del conteo del plan, fail-loud por excepcion.
-- Lectura pura: escalar, sin acceso a tablas, sin PII.
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Cadena con tildes construida por codepoint (chr()) para que el resultado NO dependa de
-- la codificacion del archivo ni del cliente: "Biõxido" no, sino literalmente
-- B i U+00F3 x i d o   d e   U+00C1 c i d o   e n   U+00D1 u U+00F1 o a
do $$
declare
  v_in  text := 'Bi' || chr(243) || 'xido de ' || chr(193) || 'cido en '
                || chr(209) || 'u' || chr(241) || 'oa';   -- Bióxido de Ácido en Ñuñoa
  v_out text;
begin
  select public.f_unaccent(v_in) into v_out;
  if v_out <> 'Bioxido de Acido en Nunoa' then
    raise exception '(F) REGRESION: f_unaccent(%) devolvio "%" (esperado "Bioxido de Acido en Nunoa"); fijar search_path rompio la resolucion de public.unaccent', v_in, v_out;
  end if;
  raise notice '(F) OK: f_unaccent resuelve public.unaccent bajo search_path fijado -> %', v_out;
end $$;

select * from finish();
rollback;
