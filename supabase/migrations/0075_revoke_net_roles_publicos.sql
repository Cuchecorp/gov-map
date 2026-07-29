-- 0075_revoke_net_roles_publicos.sql
--
-- Offender:        OFF-6-03  (Phase 123 — auditoria de estructura Supabase)
-- Eje:             6 (buckets · keys · superficie Data API)
-- Queries origen:  Q-22  (`net` con usage_anon = t — la fila inesperada)
--                  Q-22b (`net` lleva ademas el grantee vacio `=U` = USAGE TO PUBLIC)
--                  Q-24b (superficie de funciones de extension alcanzable por anon)
-- Destino:         124-aditivo
-- Orden LOCKED:    paso 3 de 3.
--
-- El gate SUBIO su severidad
-- --------------------------
-- Veredicto del gate de la Phase 123, verbatim: *"Apliquenlo en 124 sin esperar al
-- architect"*. Verificado por el gate: `net.http_get` / `net.http_post` tienen
-- `EXECUTE` para `anon`. Encadenado con la familia `lives_ok` de `pgtap` (tambien en
-- `public`, tambien ejecutable por `anon`) seria **SSRF real por la Data API**:
-- `lives_ok('select net.http_post(...)')`. Hoy eso esta bloqueado solo por el
-- accidente de que `pgtap` no nombra sus argumentos — el propio gate lo califico de
-- *"mitigante fragil y no intencional"*. Esta migracion corta la cadena en su origen,
-- de modo que siga cortada AUNQUE ese mitigante desaparezca.
--
-- Alcance real: SON 12 FUNCIONES, no 2
-- ------------------------------------
-- El verificador de 123 hallo 12 funciones en `net`, no 2, incluidas `http_delete` y
-- `worker_restart`. Enumeracion viva contra PROD (2026-07-29) — 12, confirma el audit:
--   _await_response, _encode_url_with_params_array, _http_collect_response,
--   _urlencode_string, check_worker_is_up, http_collect_response, http_delete,
--   http_get, http_post, wait_until_running, wake, worker_restart
-- Las 12 tienen hoy `EXECUTE` para `anon` y para `authenticated`.
--
-- Por que NO rompe la ingesta
-- ---------------------------
-- `pg_net` es infraestructura de `pg_cron`; ningun rol publico lo necesita. Los 5 jobs
-- activos de `cron.job` (process-ingest-jobs, cleanup-net-http, net-materializar-aristas,
-- cruces-materializar, actualidad-materializar) corren como `postgres`/`service_role`,
-- NO como rol publico. Esta migracion no toca el ownership ni los privilegios de
-- `postgres` / `service_role` / `supabase_admin` sobre `net`.
--
-- Los TRES frentes, los tres necesarios
-- -------------------------------------
-- Revocar solo a `anon` y `authenticated` NO basta: por `Q-22b`, el `nspacl` de `net`
-- contiene la entrada de grantee vacio `=U/supabase_admin`, es decir `USAGE TO PUBLIC`
-- ⇒ cualquier rol presente o futuro entraria igual. De ahi el `from public` explicito,
-- tanto sobre el esquema como sobre las funciones.
--
-- RAMA DE FALLO — es la PROBABLE aqui, no una formalidad
-- ------------------------------------------------------
-- El esquema `net` y sus 12 funciones pertenecen a la extension `pg_net`, **poseida por
-- `supabase_admin`** (verificado: `nspowner = supabase_admin`, `extowner = supabase_admin`),
-- y los grants vigentes fueron otorgados POR `supabase_admin` (`=U/supabase_admin`).
-- `revoke` exige ser el propietario o el otorgante. Es el MISMO escape que `OFF-01`:
--   Rama A (exit 0)                        -> APLICADO.
--   Rama B (exit != 0 con SQLSTATE 42501 o
--           error de membresia/ownership)  -> DEUDA-OPERADOR. NO reintentar, NO escalar
--                                             privilegio (sin `set role`, sin `security
--                                             definer`, sin service key, sin dashboard).
--   Rama C (exit != 0 por otra causa)      -> PARAR y reportar.
-- La adjudicacion va en `124-OFF-6-03-RESULTADO.md` con frontmatter `veredicto:`.
--
-- Naturaleza
-- ----------
-- Puramente sustractiva: solo `revoke`. Ningun `grant`, ninguna sentencia que borre o
-- reubique la extension (mover `pg_net` fuera de `public` es `OFF-6-01`, destino
-- `architect + checkpoint`, FUERA de esta fase), ningun `set role`.
--
-- Aplicacion
-- ----------
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/0075_revoke_net_roles_publicos.sql
--
-- Reversa (documental — NO aplicar; reabriria la cadena SSRF).


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 1 — PRE-CHECK fail-closed
--
-- Si el estado de partida ya estuviera cerrado, NO es el estado auditado: se aborta
-- en vez de aplicar sobre un supuesto falso.
-- ════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_exec_anon int;
  v_total     int;
begin
  if not has_schema_privilege('anon', 'net', 'USAGE') then
    raise exception
      'PRE-CHECK 0075 fail-closed: has_schema_privilege(anon, net, USAGE) ya es FALSE. El estado de partida NO es el auditado por Q-22 (que lo hallo TRUE); se aborta la transaccion.';
  end if;

  select count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')),
         count(*)
    into v_exec_anon, v_total
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'net';

  if v_exec_anon <= 0 then
    raise exception
      'PRE-CHECK 0075 fail-closed: se esperaban > 0 funciones de net con EXECUTE para anon (estado auditado por Q-24b); se hallaron % sobre % totales. Se aborta.',
      v_exec_anon, v_total;
  end if;

  raise notice 'PRE-CHECK 0075 OK: % de % funciones de net tienen EXECUTE para anon, y anon tiene USAGE sobre el esquema (estado auditado).', v_exec_anon, v_total;
end
$$;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 2 — EL FIX (OFF-6-03) — los CUATRO revokes
--
-- 1) esquema  -> anon, authenticated
-- 2) esquema  -> public          (imprescindible por Q-22b: `=U` = USAGE TO PUBLIC)
-- 3) funciones-> anon, authenticated
-- 4) funciones-> public
-- ════════════════════════════════════════════════════════════════════════════════

revoke all     on schema net from anon, authenticated;
revoke usage   on schema net from public;
revoke execute on all functions in schema net from anon, authenticated;
revoke execute on all functions in schema net from public;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCION 3 — POST-CHECK dentro de la MISMA transaccion
-- ════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_exec_anon int;
  v_exec_auth int;
begin
  if has_schema_privilege('anon', 'net', 'USAGE') then
    raise exception 'POST-CHECK 0075: anon SIGUE con USAGE sobre net. Se aborta para no committear un cierre falso.';
  end if;

  if has_schema_privilege('authenticated', 'net', 'USAGE') then
    raise exception 'POST-CHECK 0075: authenticated SIGUE con USAGE sobre net. Se aborta para no committear un cierre falso.';
  end if;

  select count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')),
         count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    into v_exec_anon, v_exec_auth
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'net';

  if v_exec_anon <> 0 or v_exec_auth <> 0 then
    raise exception
      'POST-CHECK 0075: quedan % funciones de net con EXECUTE para anon y % para authenticated. Se aborta.',
      v_exec_anon, v_exec_auth;
  end if;

  raise notice 'POST-CHECK 0075 OK: ningun rol publico alcanza net (0 USAGE, 0 EXECUTE). OFF-6-03 cerrado.';
end
$$;
