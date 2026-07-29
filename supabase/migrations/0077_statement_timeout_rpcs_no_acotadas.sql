-- 0077_statement_timeout_rpcs_no_acotadas.sql
-- Phase 124 (SUPA-FIX) — wave 4 — paso 6 del orden LOCKED.
--
-- Offenders que cierra (parte de CONFIGURACION unicamente):
--   OFF-4-03 — 17 RPCs de negocio sin statement_timeout (12 sin LIMIT ni techo,
--              3 con techo sin timeout, 2 con LIMIT sin techo)
--   OFF-4-04 — subgrafo_red (walk recursivo con fan-out sin cota)
-- Eje 4 del audit. Query de origen: Q-13bis (123-SUPA-AUDIT.md:449-475).
--
-- Por que importa: pg_db_role_setting da anon=3s, authenticated=8s y service_role
-- SIN setconfig alguno. El sitio entra con service_role (Camino A, 0044) => la ruta
-- que el sitio efectivamente usa es la UNICA sin techo de tiempo. El gate de la
-- Phase 123 fue explicito sobre este offender: "confirmo, y NO lo bajen".
--
-- ALCANCE ESTRICTO: esta migracion es PURAMENTE `alter function ... set`.
--   * NO redefine ningun cuerpo    * NO cambia ninguna firma (=> cero 42P13)
--   * NO crea ni destruye objetos  * NO emite grant/revoke/set role
-- `alter function ... set` no altera la firma, por lo que NO hay drop, NO hay
-- re-arma de default privileges y NO hay que re-emitir revokes.
-- La parte de CUERPO (cotas duras de parametro y LIMIT explicito) va en 0078/0079
-- (planes 124-05 y 124-06), separada a proposito: distinto riesgo, distinto rollback.
--
-- Valor: '5s' — el mismo que ya llevan las 13 funciones bounded de 0064/0066/0067.
-- No se inventa un valor nuevo: se replica el precedente vivo del repo.
--
-- Aplicar:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
--     -f supabase/migrations/0077_statement_timeout_rpcs_no_acotadas.sql
-- NUNCA supabase db push (drift de schema_migrations).
--
-- ── ARITMETICA DEL ENCUADRE (leer antes de tocar los pre/post-check) ──────────────
-- El corpus propio de public son 42 funciones. Q-13bis las parte en:
--     13  ya acotadas con statement_timeout (0064/0066/0067)           -> no se tocan
--     11  acotadas POR CONSTRUCCION                                     -> no se tocan
--     18  offenders (17 de OFF-4-03 + subgrafo_red de OFF-4-04)         -> las de aqui
--     --
--     42
-- Contar "funciones de public sin statement_timeout" da 29, NO 18, porque incluye
-- las 11 acotadas por construccion. Por eso el pre-check opera sobre el CONJUNTO
-- ENUMERADO de las 18 (lista literal de regprocedure), jamas sobre el total.
--
-- Las 11 acotadas por construccion, por nombre y razon (quedan legitimamente sin
-- timeout tras esta migracion; no son residuo mudo):
--   agregado_por_contraparte_cap()          — constante (devuelve el cap 500)
--   f_unaccent(text)                        — escalar puro, sin acceso a tablas
--   resolver_identidad(...)                 — admin-write, ruta no publica
--   resolver_entidad(...)                   — admin-write, ruta no publica
--   entidad_tercero_estado_no_regresa()     — RETURNS trigger (1 fila, por PK)
--   identidad_audit_immutable()             — RETURNS trigger
--   parlamentario_estado_no_regresa()       — RETURNS trigger
--   vinculo_entidad_guarda()                — RETURNS trigger
--   vinculo_entidad_guarda_insert()         — RETURNS trigger
--   vinculo_identidad_guarda()              — RETURNS trigger
--   vinculo_identidad_guarda_insert()       — RETURNS trigger
--
-- El predicado de conteo es el de Q-13bis VERBATIM: acepta statement_timeout en
-- prosrc O en proconfig. Usar solo proconfig daria un conteo falso si alguna de las
-- 13 previas lo llevara en el cuerpo.

-- ═══════════════════════════════════════════════════════════════════════════════════
-- PRE-CHECK fail-closed — sobre el CONJUNTO ENUMERADO de las 18, no sobre el total
-- ═══════════════════════════════════════════════════════════════════════════════════
do $prechk$
declare
  v_sigs text[] := array[
    -- OFF-4-03 · 12 sin LIMIT ni timeout
    'public.aportes_de_parlamentario(text)',
    'public.bienes_de_parlamentario(text)',
    'public.comparar_declaraciones(text, date[])',
    'public.contratos_de_parlamentario(text)',
    'public.cruces_de_parlamentario(text)',
    'public.cruces_de_proyecto(text)',
    'public.declaraciones_de_parlamentario(text)',
    'public.lobby_de_parlamentario(text)',
    'public.lobby_en_tramitacion(text)',
    'public.parlamentarios_publico()',
    'public.rebeldias_de_parlamentario(text)',
    'public.tasa_ausencia_comparada(text)',
    -- OFF-4-03 · 3 con techo, sin timeout
    'public.agregado_por_contraparte(text)',
    'public.buscar_citaciones(text, integer, text)',
    'public.parlamentario_publico(text)',
    -- OFF-4-03 · 2 con LIMIT sin techo
    'public.match_proyectos(vector, integer, double precision, text)',
    'public.votos_de_parlamentario(text, integer, integer)',
    -- OFF-4-04
    'public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)'
  ];
  v_sig  text;
  v_oid  oid;
  v_faltan  text := '';
  v_ya_tienen text := '';
  v_con_timeout int;
  v_total int;
begin
  if array_length(v_sigs, 1) <> 18 then
    raise exception 'PRE-CHECK 0077 ABORTA: el conjunto enumerado tiene % entradas, se esperaban 18',
      array_length(v_sigs, 1);
  end if;

  foreach v_sig in array v_sigs loop
    v_oid := to_regprocedure(v_sig);           -- NULL si no existe (no lanza)
    if v_oid is null then
      v_faltan := v_faltan || ' ' || v_sig;
    elsif array_to_string(coalesce((select p.proconfig from pg_proc p where p.oid = v_oid), '{}'), ',')
          like '%statement_timeout%' then
      v_ya_tienen := v_ya_tienen || ' ' || v_sig;
    end if;
  end loop;

  if v_faltan <> '' then
    raise exception 'PRE-CHECK 0077 ABORTA: no existen en public:%', v_faltan;
  end if;
  if v_ya_tienen <> '' then
    raise exception 'PRE-CHECK 0077 ABORTA: ya tenian statement_timeout en proconfig:%', v_ya_tienen;
  end if;

  -- Control de encuadre (predicado Q-13bis verbatim: prosrc O proconfig)
  select count(*) into v_con_timeout
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and (lower(p.prosrc) like '%statement_timeout%'
         or array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout%');

  select count(*) into v_total
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  if v_con_timeout <> 13 then
    raise exception 'PRE-CHECK 0077 ABORTA: funciones de public con statement_timeout = %, se esperaban 13', v_con_timeout;
  end if;
  if v_total <> 42 then
    raise exception 'PRE-CHECK 0077 ABORTA: corpus propio de public = %, se esperaban 42', v_total;
  end if;

  raise notice 'PRE-CHECK 0077 OK: las 18 del conjunto enumerado existen y ninguna tiene statement_timeout. Encuadre vivo: 13 con timeout + 18 offenders + 11 acotadas por construccion = 42.';
end
$prechk$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- FIX — 18 x `alter function ... set statement_timeout = '5s'`, sobre firma exacta.
-- Cada una con su lista de argumentos explicita (hay homonimos con distinta aridad
-- en este schema: parlamentario_publico vs parlamentario_publico_v2, etc.).
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ── OFF-4-03 · 12 sin LIMIT ni timeout ────────────────────────────────────────────
alter function public.aportes_de_parlamentario(text) set statement_timeout = '5s';
alter function public.bienes_de_parlamentario(text) set statement_timeout = '5s';
alter function public.comparar_declaraciones(text, date[]) set statement_timeout = '5s';
alter function public.contratos_de_parlamentario(text) set statement_timeout = '5s';
alter function public.cruces_de_parlamentario(text) set statement_timeout = '5s';
alter function public.cruces_de_proyecto(text) set statement_timeout = '5s';
alter function public.declaraciones_de_parlamentario(text) set statement_timeout = '5s';
alter function public.lobby_de_parlamentario(text) set statement_timeout = '5s';
alter function public.lobby_en_tramitacion(text) set statement_timeout = '5s';
alter function public.parlamentarios_publico() set statement_timeout = '5s';
alter function public.rebeldias_de_parlamentario(text) set statement_timeout = '5s';
alter function public.tasa_ausencia_comparada(text) set statement_timeout = '5s';

-- ── OFF-4-03 · 3 con techo duro en el cuerpo, pero sin timeout ────────────────────
alter function public.agregado_por_contraparte(text) set statement_timeout = '5s';
alter function public.buscar_citaciones(text, integer, text) set statement_timeout = '5s';
alter function public.parlamentario_publico(text) set statement_timeout = '5s';

-- ── OFF-4-03 · 2 con LIMIT de parametro (cardinalidad elegida por el cliente) ─────
alter function public.match_proyectos(vector, integer, double precision, text) set statement_timeout = '5s';
alter function public.votos_de_parlamentario(text, integer, integer) set statement_timeout = '5s';

-- ── OFF-4-04 · walk recursivo con fan-out sin cota ────────────────────────────────
alter function public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone) set statement_timeout = '5s';

-- ═══════════════════════════════════════════════════════════════════════════════════
-- POST-CHECK fail-closed — misma transaccion.
-- Lecccion de la wave 2: se verifica el ESTADO RESULTANTE, no la ausencia de error.
-- ═══════════════════════════════════════════════════════════════════════════════════
do $postchk$
declare
  v_sigs text[] := array[
    'public.aportes_de_parlamentario(text)',
    'public.bienes_de_parlamentario(text)',
    'public.comparar_declaraciones(text, date[])',
    'public.contratos_de_parlamentario(text)',
    'public.cruces_de_parlamentario(text)',
    'public.cruces_de_proyecto(text)',
    'public.declaraciones_de_parlamentario(text)',
    'public.lobby_de_parlamentario(text)',
    'public.lobby_en_tramitacion(text)',
    'public.parlamentarios_publico()',
    'public.rebeldias_de_parlamentario(text)',
    'public.tasa_ausencia_comparada(text)',
    'public.agregado_por_contraparte(text)',
    'public.buscar_citaciones(text, integer, text)',
    'public.parlamentario_publico(text)',
    'public.match_proyectos(vector, integer, double precision, text)',
    'public.votos_de_parlamentario(text, integer, integer)',
    'public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)'
  ];
  v_sig text;
  v_ok  int := 0;
  v_sin text := '';
  v_con_timeout int;
  v_total int;
begin
  foreach v_sig in array v_sigs loop
    if exists (
      select 1 from pg_proc p
      where p.oid = to_regprocedure(v_sig)
        and array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout=5s%'
    ) then
      v_ok := v_ok + 1;
    else
      v_sin := v_sin || ' ' || v_sig;
    end if;
  end loop;

  if v_ok <> 18 then
    raise exception 'POST-CHECK 0077 ABORTA: solo % de 18 quedaron con statement_timeout=5s. Sin techo:%', v_ok, v_sin;
  end if;

  select count(*) into v_con_timeout
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and (lower(p.prosrc) like '%statement_timeout%'
         or array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout%');

  select count(*) into v_total
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  if v_con_timeout <> 31 then
    raise exception 'POST-CHECK 0077 ABORTA: funciones de public con statement_timeout = %, se esperaban 31 (13 previas + 18 nuevas)', v_con_timeout;
  end if;
  if v_total <> 42 then
    raise exception 'POST-CHECK 0077 ABORTA: corpus propio de public = %, se esperaban 42 (esta migracion no crea ni destruye objetos)', v_total;
  end if;

  raise notice 'POST-CHECK 0077 OK: las 18 con statement_timeout=5s. 31 de 42 funciones propias de public con techo; las 11 restantes son las acotadas por construccion enumeradas en la cabecera.';
end
$postchk$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Ledger
-- ═══════════════════════════════════════════════════════════════════════════════════
insert into supabase_migrations.schema_migrations (version, name)
values ('0077', 'statement_timeout_rpcs_no_acotadas')
on conflict (version) do nothing;
