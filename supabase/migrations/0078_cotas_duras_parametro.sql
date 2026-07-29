-- 0078_cotas_duras_parametro.sql
-- Phase 124 (SUPA-FIX) — wave 5 — paso 6 del orden LOCKED (parte de CUERPO).
--
-- Offenders que cierra (la mitad de CUERPO; la de CONFIGURACION la cerro 0077):
--   OFF-4-03 — las 2 funciones con `LIMIT` cuyo valor lo elige el LLAMADOR:
--              match_proyectos (limit match_count) y votos_de_parlamentario (limit p_limit).
--              Un LIMIT que el cliente elige NO es una cota.
--   OFF-4-04 — subgrafo_red: walk recursivo con profundidad acotada (clamp 1..2) pero
--              fan-out por nivel SIN cota => una semilla muy conectada puede materializar
--              un jsonb arbitrariamente grande.
-- Eje 4 del audit. Origen: Q-13bis (123-SUPA-AUDIT.md:449-475) + revision manual de
-- pg_get_functiondef. 0077 ya les puso techo de TIEMPO; esto les pone techo de CARDINALIDAD.
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- SEPARACION LOCKED — lo que esta migracion NO toca
-- ────────────────────────────────────────────────────────────────────────────────────
-- `votos_de_parlamentario` cae en DOS casillas del audit y son DOS arreglos distintos:
--   * `p_limit` sin techo            => SEGURIDAD / DoS  => OFF-4-03 => ES ESTA MIGRACION
--   * el cap de 1.000 que la superficie aplica, que trunca y ademas DISTORSIONA la
--     composicion del desglose por `order by vo.fecha desc` => EXACTITUD => backlog B-01
--     => FUERA de la Phase 124 (ver 124-07)
-- Esta migracion impone SOLO el techo. NO cambia el default del parametro (sigue 20),
-- NO cambia el `order by`, NO cambia el `offset`. B-01 queda intacto y sin absorber.
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- COTAS: MEDIDAS contra PROD, no inventadas (criterio >= 4x el maximo real medido)
-- ────────────────────────────────────────────────────────────────────────────────────
-- ADJUDICACION DEL OPERADOR: techo 4000 para match_proyectos y votos_de_parlamentario.
--
-- El audit prescribia textualmente 100 y 200. La medicion viva demostro que AMBOS valores
-- estan POR DEBAJO de la demanda real de los llamadores del sitio, de modo que aplicarlos
-- no habria acotado un abuso: habria roto dos superficies en silencio.
--
--   match_proyectos        — el llamador vivo pasa PAGE_SIZE*page+1 = hasta 1001
--                            (app/app/buscar/page.tsx:27,33,89 — PAGE_SIZE=20, MAX_PAGE=50).
--                            Un techo de 100 rompe /buscar desde la pagina 6.
--   votos_de_parlamentario — dos llamadores vivos pasan p_limit:1000
--                            (app/components/votos-por-parlamentario.tsx:1010,
--                             app/lib/parlamentario-resumen-conteos.ts:280).
--                            Un techo de 200 recorta 1000->200 filas para los 186
--                            parlamentarios (todos tienen >200 votos) y desincroniza
--                            el chip "Emitio N votos", el desglose y la asistencia.
--
-- Consultas de medicion (re-ejecutables):
--   -- demanda real de votos, dominio completo:
--   select count(*) as parlamentarios, max(c) as max_votos,
--          count(*) filter (where c > 4000) as sobre_4000
--   from (select parlamentario_id, count(*) c from public.voto
--         where estado_vinculo='confirmado' group by 1) t;
--   -- resultado 2026-07-29: parlamentarios=186  max_votos=3773  p99=3752  sobre_4000=0
--   select count(*) from public.proyecto_embedding;   -- 3100 (corpus embebido completo)
--
-- Techo elegido = 4000: >= 4x el argumento maximo del llamador vivo (1001 / 1000 -> 4004
-- ~ 4000) y por encima del maximo real del dato (3.100 embeddings, 3.773 votos), de modo
-- que `sobre_4000 = 0` prueba que hoy no trunca a nadie. Se prefirio la holgura >=4x sobre
-- el minimo que preserva (1100/1000) porque sin holgura cualquier crecimiento del corpus se
-- convertiria en truncamiento silencioso — justo el modo de fallo que se esta cerrando.
--
-- FUNDAMENTO del techo generoso (verificado vivo antes de escribir esto):
--   has_function_privilege sobre las 3 => anon=false, authenticated=false,
--                                         public=false, service_role=true.
--   Las 3 estan cerradas a anon y authenticated. El UNICO llamador posible es el servidor
--   del propio sitio via service_role (Camino A, 0044). Por tanto el techo protege contra
--   un BUG PROPIO, no contra un atacante externo. Un techo agresivo compraria poca
--   seguridad a cambio de exactitud real. Lo que cierra el offender es que el LIMIT deje
--   de ser ilimitado, no que el numero sea pequeno.
--
-- subgrafo_red — cotas medidas sobre el DOMINIO COMPLETO de semillas (136 entidades x
--   profundidades 1 y 2), consultas re-ejecutables:
--     select max(g) from (select nodo, count(*) g from
--       (select extremo_a nodo from public.arista union all select extremo_b from public.arista) x
--       group by nodo) t;                                  -- grado_max = 391  (fan-out por nodo)
--     select max(jsonb_array_length(public.subgrafo_red(e.id,2)->'nodos')),
--            max(jsonb_array_length(public.subgrafo_red(e.id,2)->'aristas'))
--     from public.entidad e;                               -- max_nodos = 134, max_aristas = 7394
--   Cotas (>= 4x): fan-out por nodo 2000 (>=4x391), nodos 1000 (>=4x134),
--                  aristas 40000 (>=4x7394).
--   Validado en transaccion revertida contra PROD: las 272 combinaciones
--   (136 semillas x profundidades 1,2) devuelven un conjunto IDENTICO al pre-apply
--   (iguales_nodos=272, iguales_aristas=272, DIFERENTES=0). La cota NO recorta el grafo real.
--   Nota: el `limit` va dentro de un `cross join lateral`, no sobre el termino recursivo.
--   Postgres prohibe ORDER BY/LIMIT sobre el termino recursivo mismo, pero SI los admite
--   dentro de una lateral — es la unica forma de acotar el fan-out POR NIVEL.
--
-- ────────────────────────────────────────────────────────────────────────────────────
-- ALCANCE Y RIESGO
-- ────────────────────────────────────────────────────────────────────────────────────
--   * `create or replace` de firma IDENTICA => cero 42P13, cero borrado previo de la
--     funcion, cero re-arma de default privileges. Las firmas se transcriben literalmente del
--     pg_get_functiondef VIVO, no de las migraciones originales del repo.
--   * Cada cuerpo re-emitido CONSERVA lo que ya tenia: volatilidad, security definer,
--     search_path y el `set statement_timeout = '5s'` que puso 0077. Un create or replace
--     que omita una clausula la BORRA en silencio; por eso el post-check las verifica.
--   * NO se anade `search_path=''` a match_proyectos ni a votos_de_parlamentario.
--     RAZON (que nadie la "arregle" despues): sus cuerpos referencian proyecto_embedding,
--     voto, votacion, proyecto y proyecto_ficha SIN CALIFICAR, y con search_path=''
--     se romperian. Ninguna de las dos es SECURITY DEFINER, asi que no hay escalada.
--     (Correccion al audit: OFF-5-01 afirma que f_unaccent era la unica de public sin
--      search_path; vivo, f_unaccent ya lo tiene y las dos que quedan son justo estas.
--      Registrado para 124-07 como correccion del audit, no bloqueante.)
--   * Doble-revoke por funcion re-emitida: el guard (A5) de app/lib/lockdown-guard.test.ts
--     matchea `create or replace function`, asi que cada funcion re-emitida DEBE llevar su
--     `revoke execute ... from public` en el MISMO archivo o la suite de app/ se pone roja.
--
-- Aplicar:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
--     -f supabase/migrations/0078_cotas_duras_parametro.sql
-- NUNCA supabase db push (drift de schema_migrations).

-- ═══════════════════════════════════════════════════════════════════════════════════
-- PRE-CHECK fail-closed
-- ═══════════════════════════════════════════════════════════════════════════════════
do $prechk$
declare
  v_faltante text;
  v_sin_timeout text;
begin
  select string_agg(f, ', ' order by f) into v_faltante
  from (values
    ('public.match_proyectos(vector, integer, double precision, text)'),
    ('public.votos_de_parlamentario(text, integer, integer)'),
    ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
  ) t(f)
  where to_regprocedure(f) is null;

  if v_faltante is not null then
    raise exception
      'PRE-CHECK 0078 FALLO: no existe(n) con la firma esperada: %. Aplicar fuera de orden esta prohibido.',
      v_faltante;
  end if;

  -- 0077 debe estar aplicada: sin su statement_timeout, este create or replace lo
  -- reintroduciria "por casualidad" y perderiamos la trazabilidad del paso previo.
  select string_agg(f, ', ' order by f) into v_sin_timeout
  from (values
    ('public.match_proyectos(vector, integer, double precision, text)'),
    ('public.votos_de_parlamentario(text, integer, integer)'),
    ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
  ) t(f)
  where not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure(t.f)::oid
      and coalesce(p.proconfig, '{}') && array['statement_timeout=5s']
  );

  if v_sin_timeout is not null then
    raise exception
      'PRE-CHECK 0078 FALLO: sin statement_timeout=5s (0077 no aplicada?): %.',
      v_sin_timeout;
  end if;

  raise notice 'PRE-CHECK 0078 OK: las 3 existen con firma exacta y con statement_timeout=5s de 0077.';
end
$prechk$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 1/3 — match_proyectos: techo duro 4000 al match_count elegido por el llamador
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Cuerpo transcrito del pg_get_functiondef vivo. UNICO cambio: la linea del `limit`.
-- Sin search_path a proposito (ver cabecera). Sin security definer (no lo era).
CREATE OR REPLACE FUNCTION public.match_proyectos(query_embedding vector, match_count integer DEFAULT 20, match_threshold double precision DEFAULT 0.0, exclude_boletin text DEFAULT NULL::text)
 RETURNS TABLE(boletin text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET statement_timeout TO '5s'
AS $function$
  select e.boletin,
         1 - (e.embedding <=> query_embedding) as similarity
  from proyecto_embedding e
  where (exclude_boletin is null or e.boletin <> exclude_boletin)
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding   -- distancia cruda ASC = mejor primero; usa HNSW
  limit least(coalesce(match_count, 20), 4000);   -- OFF-4-03: techo duro del servidor
$function$;

revoke execute on function public.match_proyectos(vector, integer, double precision, text) from public;
revoke execute on function public.match_proyectos(vector, integer, double precision, text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 2/3 — votos_de_parlamentario: techo duro 4000 al p_limit elegido por el llamador
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Cuerpo transcrito del pg_get_functiondef vivo. UNICO cambio: la linea del `limit`.
-- El default (20), el `order by vo.fecha desc nulls last` y el `offset` quedan INTACTOS:
-- eso es B-01 (exactitud) y esta fuera de la Phase 124.
CREATE OR REPLACE FUNCTION public.votos_de_parlamentario(p_id text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(votacion_id text, boletin text, fecha timestamp with time zone, seleccion text, etapa text, camara text, origen text, fecha_captura timestamp with time zone, enlace text, titulo text, idea_matriz text, resultado text, total_si integer, total_no integer, total_abstencion integer, total_pareo integer, quorum text)
 LANGUAGE sql
 STABLE
 SET statement_timeout TO '5s'
AS $function$
  select v.votacion_id, vo.boletin, vo.fecha, v.seleccion, vo.etapa, vo.camara,
         vo.origen, vo.fecha_captura, vo.enlace,
         -- sustancia: título del proyecto + extracto de idea matriz (LEFT → null honesto)
         pr.titulo, pf.idea_matriz,
         -- desenlace: tomado de la votación ya joinada
         vo.resultado, vo.total_si, vo.total_no,
         vo.total_abstencion, vo.total_pareo, vo.quorum
  from voto v
  join votacion vo on vo.id = v.votacion_id
  -- LEFT: un proyecto sin idea matriz no descarta la fila del voto (honest-state).
  left join proyecto pr on pr.boletin = vo.boletin
  left join proyecto_ficha pf on pf.boletin = vo.boletin
  where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
  order by vo.fecha desc nulls last
  limit least(coalesce(p_limit, 20), 4000) offset p_offset;   -- OFF-4-03: techo duro del servidor
$function$;

revoke execute on function public.votos_de_parlamentario(text, integer, integer) from public;
revoke execute on function public.votos_de_parlamentario(text, integer, integer) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Fix 3/3 — subgrafo_red: cota explicita de fan-out por nivel + de nodos/aristas
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Cuerpo transcrito del pg_get_functiondef vivo. Cambios: la rama recursiva pasa a
-- `cross join lateral (... order by a.id limit 2000)` para acotar el fan-out POR NODO,
-- y los CTE `nodos`/`aristas` reciben su cota determinista. El clamp de profundidad 1..2
-- se preserva. security definer + search_path='' + statement_timeout='5s' se preservan.
CREATE OR REPLACE FUNCTION public.subgrafo_red(p_id text, p_depth integer DEFAULT 1, p_tipos text[] DEFAULT NULL::text[], p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_hasta timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  with recursive bound as (
    -- clamp de profundidad 1..2: ni un walk unbounded (DoS + cadenas profundas que se leen
    -- como insinuación), ni una semilla aislada (mínimo 1).
    select least(greatest(coalesce(p_depth, 1), 1), 2) as d
  ),
  walk as (
    select e.id as node_id, 0 as nivel
    from public.entidad e
    where e.id = p_id
    union
    -- OFF-4-04: cota de FAN-OUT POR NODO. El limit va dentro de la lateral porque
    -- Postgres prohibe ORDER BY/LIMIT sobre el termino recursivo mismo.
    -- 2000 >= 4x el grado maximo medido (391) sobre el dominio completo.
    select x.vecino, w.nivel + 1
    from walk w
    cross join lateral (
      select case when a.extremo_a = w.node_id then a.extremo_b else a.extremo_a end as vecino
      from public.arista a
      where (a.extremo_a = w.node_id or a.extremo_b = w.node_id)
        and (p_tipos is null or a.tipo = any(p_tipos))
        and (p_desde is null or a.hasta is null or a.hasta >= p_desde)
        and (p_hasta is null or a.desde is null or a.desde <= p_hasta)
      order by a.id
      limit 2000
    ) x
    where w.nivel < (select d from bound)
  ),
  nodos as (
    -- cota de NODOS materializados: 1000 >= 4x el maximo medido (134).
    select w.node_id from (select distinct node_id from walk) w order by w.node_id limit 1000
  ),
  aristas as (
    select a.* from public.arista a
    where a.extremo_a in (select node_id from nodos)
      and a.extremo_b in (select node_id from nodos)
      and (p_tipos is null or a.tipo = any(p_tipos))
      and (p_desde is null or a.hasta is null or a.hasta >= p_desde)
      and (p_hasta is null or a.desde is null or a.desde <= p_hasta)
    -- cota de ARISTAS materializadas: 40000 >= 4x el maximo medido (7394).
    order by a.id
    limit 40000
  )
  select jsonb_build_object(
    'nodos', (
      -- PII-SAFE: id + nombre público + cámara ÚNICAMENTE. NUNCA partido/rut/email
      -- (espejo parlamentario_publico/0020). El nombre usa el normalizado como respaldo.
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre', coalesce(
          nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
          p.nombre_normalizado
        ),
        'camara', p.camara
      )), '[]'::jsonb)
      from nodos n join public.parlamentario p on p.id = n.node_id
    ),
    'aristas', (
      -- cada arista: tipo + extremos + contexto + ventana + provenance (sin score, sin afinidad).
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', a.tipo, 'a', a.extremo_a, 'b', a.extremo_b,
        'contexto', a.contexto_detalle, 'desde', a.desde, 'hasta', a.hasta,
        'dataset', a.dataset, 'origen', a.origen, 'enlace', a.enlace, 'licencia', a.licencia
      )), '[]'::jsonb)
      from aristas a
    )
  );
$function$;

revoke execute on function public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone) from public;
revoke execute on function public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- POST-CHECK fail-closed — verifica el ESTADO RESULTANTE, no la ausencia de error
-- (leccion de la wave 2: REVOKE sobre objetos ajenos no falla, no-opea con WARNING 01006)
-- ═══════════════════════════════════════════════════════════════════════════════════
do $postchk$
declare
  v_msg text;
  v_n integer;
begin
  -- (a) las 3 siguen existiendo con la MISMA firma (si no, el create or replace habria
  --     creado un overload nuevo en vez de reemplazar => 42P13 evitado pero firma cambiada)
  select string_agg(f, ', ' order by f) into v_msg
  from (values
    ('public.match_proyectos(vector, integer, double precision, text)'),
    ('public.votos_de_parlamentario(text, integer, integer)'),
    ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
  ) t(f)
  where to_regprocedure(f) is null;
  if v_msg is not null then
    raise exception 'POST-CHECK 0078 FALLO: firma perdida en: %.', v_msg;
  end if;

  -- (b) ninguna se duplico: exactamente 1 proc por nombre
  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('match_proyectos', 'votos_de_parlamentario', 'subgrafo_red');
  if v_n <> 3 then
    raise exception 'POST-CHECK 0078 FALLO: se esperaban 3 procs, hay % (overload creado?).', v_n;
  end if;

  -- (c) las 3 conservan statement_timeout=5s (un create or replace que omita el `set`
  --     lo BORRA en silencio y reabre el offender que 0077 acaba de cerrar)
  select string_agg(f, ', ' order by f) into v_msg
  from (values
    ('public.match_proyectos(vector, integer, double precision, text)'),
    ('public.votos_de_parlamentario(text, integer, integer)'),
    ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
  ) t(f)
  where not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure(t.f)::oid
      and coalesce(p.proconfig, '{}') && array['statement_timeout=5s']
  );
  if v_msg is not null then
    raise exception 'POST-CHECK 0078 FALLO: perdio statement_timeout=5s (regresion de 0077): %.', v_msg;
  end if;

  -- (d) subgrafo_red conserva security definer + search_path=''; las otras dos NO son
  --     secdef y NO llevan search_path (a proposito: referencian tablas sin calificar)
  if not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')::oid
      and p.prosecdef
      and exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
      )
  ) then
    raise exception 'POST-CHECK 0078 FALLO: subgrafo_red perdio security definer o search_path=''''.';
  end if;

  if exists (
    select 1 from pg_proc p
    where p.oid in (
      to_regprocedure('public.match_proyectos(vector, integer, double precision, text)')::oid,
      to_regprocedure('public.votos_de_parlamentario(text, integer, integer)')::oid
    ) and p.prosecdef
  ) then
    raise exception 'POST-CHECK 0078 FALLO: match_proyectos/votos_de_parlamentario se volvieron SECURITY DEFINER (no lo eran).';
  end if;

  -- (e) exposicion: cero EXECUTE para anon/authenticated/public; service_role INTACTO
  --     (es la ruta viva del sitio — Camino A)
  select string_agg(f, ', ' order by f) into v_msg
  from (values
    ('public.match_proyectos(vector, integer, double precision, text)'),
    ('public.votos_de_parlamentario(text, integer, integer)'),
    ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
  ) t(f)
  where has_function_privilege('anon', to_regprocedure(t.f)::oid, 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure(t.f)::oid, 'EXECUTE')
     or has_function_privilege('public', to_regprocedure(t.f)::oid, 'EXECUTE');
  if v_msg is not null then
    raise exception 'POST-CHECK 0078 FALLO: exec reabierto a anon/authenticated/public en: %.', v_msg;
  end if;

  select string_agg(f, ', ' order by f) into v_msg
  from (values
    ('public.match_proyectos(vector, integer, double precision, text)'),
    ('public.votos_de_parlamentario(text, integer, integer)'),
    ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
  ) t(f)
  where not has_function_privilege('service_role', to_regprocedure(t.f)::oid, 'EXECUTE');
  if v_msg is not null then
    raise exception 'POST-CHECK 0078 FALLO: service_role perdio EXECUTE (rompe el Camino A) en: %.', v_msg;
  end if;

  raise notice 'POST-CHECK 0078 OK: 3 funciones con cota dura de cardinalidad; firmas, security definer, search_path, statement_timeout=5s y ACL de service_role intactos; cero exec anon/authenticated/public.';
end
$postchk$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Ledger
-- ═══════════════════════════════════════════════════════════════════════════════════
insert into supabase_migrations.schema_migrations (version, name)
values ('0078', 'cotas_duras_parametro')
on conflict (version) do nothing;
