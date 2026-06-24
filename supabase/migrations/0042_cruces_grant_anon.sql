-- 0042_cruces_grant_anon.sql
--
-- ████ MIGRACIÓN DE RELEASE — NO APLICAR EN CORRIDAS AUTÓNOMAS ████
--
-- Válvula de release del doble candado (Candado A). UNA SOLA acción: el
-- `grant execute ... to anon` que 0040 omite intencionalmente. Levanta el
-- deny-by-default SOLO tras el sign-off legal de cruces (CRUCEN-03, firma humana).
-- Espejo de 0030_net.sql:254 (subgrafo_red) y 0021 (lobby_de_parlamentario).
--
-- ORDEN DE DEPENDENCIA (CRÍTICO): aplicar DESPUÉS de 0041. 0041 dropea+recrea el
-- RPC → un grant aplicado antes de 0041 se PIERDE silenciosamente (el drop lo
-- descarta y el recreate re-revoca). El guard de abajo lo convierte en error duro.
--
-- NO APLICAR EN AUTÓNOMO: se commitea pero NO se aplica a PROD ni se registra en
-- schema_migrations durante el run de Phase 41. Apply = checkpoint humano/operador,
-- post-sign-off. Guard de regresión: 0040_cruces_rpc.test.sql (anon NO execute)
-- corre en la suite y fallaría ante una aplicación prematura.
--
-- ORDEN DE ENCENDIDO (documentado, NO ejecutado por el agente):
--   1. Firmar dossier CRUCEN-03 (humano → signoff: approved)
--   2. Aplicar esta migración: psql "$DATABASE_URL" --single-transaction -f
--      supabase/migrations/0042_cruces_grant_anon.sql  + fila en schema_migrations
--   3. Verificar: supabase/tests/post-apply/0042_cruces_grant_anon.test.sql
--   4. Flip CRUCES_PUBLIC_ENABLED=true en Cloudflare. Los 4 pasos juntos.
-- ████████████████████████████████████████████████████████████████████████████████

-- Precondición fail-loud: 0041 DEBE estar aplicada (fecha_captura en el retorno),
-- o el grant caería sobre una función que 0041 luego dropea.
do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'
       and 'fecha_captura' = any(p.proargnames)
  ) then
    raise exception '0042 abortada: 0041 no está aplicada (cruces_de_parlamentario sin columna fecha_captura). Aplicar 0041 primero.';
  end if;
end;
$$;

grant execute on function public.cruces_de_parlamentario(text) to anon;
