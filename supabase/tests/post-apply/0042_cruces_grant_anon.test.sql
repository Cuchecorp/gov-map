-- 0042_cruces_grant_anon.test.sql  (POST-APPLY ONLY — corre tras aplicar 0042)
-- Espejo INVERTIDO de 0040 assert #3. Si pasa, Candado A está abierto → paso 4 (flip flag).
--
-- POST-APPLY ONLY: vive en supabase/tests/post-apply/ a propósito, FUERA del glob de la
-- suite. Asierta el estado OPUESTO al de 0040_cruces_rpc.test.sql assert #3 (anon NO execute)
-- → si la suite lo recogiera pre-encendido, FALLARÍA. El operador lo corre A MANO el día del
-- encendido, tras aplicar 0042 (psql -tA -f contra PROD aplicado). NO lo incluyas en ningún
-- runner automático.
begin;
select plan(2);
select ok(
  has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon TIENE EXECUTE sobre cruces_de_parlamentario (0042 aplicada — Candado A abierto)');
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'),
  true, 'cruces_de_parlamentario sigue security definer post-0042');
select * from finish();
rollback;
