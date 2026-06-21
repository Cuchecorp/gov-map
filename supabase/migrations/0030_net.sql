-- 0030_net.sql
-- NET (NET-01) — grafo de influencia COMO-Postgres. Candado A (datos) del doble candado NET.
-- Dos tablas DENY-BY-DEFAULT (`entidad` nodos, `arista` aristas), el proc idempotente
-- `grafo.materializar_aristas()` invocado por `pg_cron`, y el RPC público `subgrafo_red`
-- con CTE recursiva PII-safe. NET es CONSUMIDOR PURO de los bloques ya poblados
-- (VOTE/INT): no ingiere datos nuevos; deriva aristas de hechos públicos ya verificados.
--
-- La última migración APLICADA es 0028 (votos instructivos). 0029 es el pgTAP de votos
-- (un test, no una migración forward) → NET arranca en 0030.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 5): build/typecheck NO prueban que
-- Postgres ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0030_net.test.sql) corriendo contra un schema APLICADO. Aplicar por `psql --db-url`
-- DIRECTO, NUNCA `supabase db push`: el `schema_migrations` remoto tiene drift (registra
-- ≤0025) → `db push` re-aplicaría/saltaría migraciones. El BOM en `.env` rompe el CLI →
-- pasar `--db-url` explícito (mismo camino que 0018–0028).
--
-- DOBLE CANDADO: Candado A = RLS deny-by-default sobre `entidad`/`arista` (esta migración).
-- Candado B = flag de presentación `NET_PUBLIC_ENABLED` (app/lib/net-gate.ts, Plan 02).
-- Nada se expone públicamente hasta el sign-off legal F17 (17-LEGAL-DOSSIER signoff: approved).
--
-- TAXONOMÍA DEL MVP — UNA SOLA ARISTA `co_lobby_contraparte`:
--   El MVP emite SOLO la arista `co_lobby_contraparte` (dos parlamentarios confirmados que
--   cada uno recibió audiencia de la MISMA contraparte de lobby). Es un hecho discreto,
--   individualmente publicado en leylobby, esparso (sin hairball), con la contraparte
--   nombrada y con fuente.
--   `co_votacion` queda EXCLUIDO del MVP por decisión bloqueada (17-LEGAL-DOSSIER §2,
--   anti-insinuación): cada votación con N votantes confirmados produce N·(N-1)/2 aristas
--   (~12.000 aristas para un roll-call de 155 diputados; millones de filas a escala) y el
--   grafo resultante se lee como una telaraña conspirativa — exactamente la insinuación que
--   el dossier teme. Agregar otro tipo de arista exige una nueva migración (fricción correcta).
--
-- CONVENCIONES ESPEJADAS:
--   * `entidad`/`arista` → DENY-BY-DEFAULT VERBATIM de 0018/0021: RLS habilitada, CERO
--     policies, `revoke all from anon, authenticated` (cierra el hueco de default privileges).
--   * `grafo.materializar_aristas()` → `security definer set search_path = ''` (lee tablas
--     deny-by-default internamente; el cron lo invoca).
--   * `cron.schedule` + guard de versión pg_cron + assertion post-migración (espejo 0003).
--   * `subgrafo_red` → `security definer set search_path = ''` revocado de public + grant a
--     anon, proyecta SOLO id/nombre/camara (NUNCA partido/rut/email — espejo 0019/0020).
--   * Provenance INLINE NOT NULL en cada arista (FND-08): dataset/origen/fecha_captura/enlace.
--   * `licencia` per-row SIN default (17-DOSSIER §6): NUNCA `default 'CC BY 4.0'`. En el MVP
--     la arista co-lobby deriva de leylobby (no de InfoProbidad) → licencia NULL.

-- ── entidad (NODO: parlamentario confirmado únicamente) ───────────────────────
-- El nodo es identidad-only: id + tipo. SIN columnas partido/rut/email (piso PII 0018).
-- La provenance del nodo vive en la maestra `parlamentario`; no se duplica aquí.
create table entidad (
  id               text primary key,                       -- = parlamentario.id (D####/S####)
  parlamentario_id text not null references parlamentario(id) on delete cascade,
  tipo             text not null default 'parlamentario',  -- tipo de nodo (extensible; MVP = parlamentario)
  fecha_captura    timestamptz not null default now(),
  unique (parlamentario_id)
);
-- DENY-BY-DEFAULT (Ley 21.719, LEGAL-03): enable SIN policies.
alter table entidad enable row level security;
-- DEFENSA EN PROFUNDIDAD: este proyecto Supabase concede por DEFAULT PRIVILEGES todos los
-- privilegios a anon/authenticated sobre CADA tabla nueva en public. La RLS sin policy ya
-- niega las FILAS, pero REVOCAR explícitamente cierra el hueco del PRIVILEGIO (lección 0021).
revoke all on entidad from anon, authenticated;

-- ── arista (ARISTA: hecho público tipado, ambos extremos confirmado) ──────────
-- Garantía estructural "both-confirmado": extremo_a/extremo_b son FK a `entidad`, y `entidad`
-- se puebla SOLO de identidades confirmadas en el proc → una arista NO PUEDE referenciar un
-- nodo no-confirmado (el FK es el invariante; el proc filtra confirmado además, belt-and-suspenders).
create table arista (
  id            bigint generated always as identity primary key,
  -- allow-list de UN SOLO tipo en el MVP. Agregar otro exige migración (fricción correcta).
  tipo          text not null check (tipo in ('co_lobby_contraparte')),
  extremo_a     text not null references entidad(id) on delete cascade,
  extremo_b     text not null references entidad(id) on delete cascade,
  contexto_clave   text not null,    -- objeto compartido normalizado (nombre contraparte: lower(trim))
  contexto_detalle text,             -- nombre contraparte legible (raw)
  -- ventana temporal por arista (17-DOSSIER §2 obligatoria).
  desde         timestamptz,
  hasta         timestamptz,
  -- provenance inline NOT NULL (FND-08): per-row, heredada del bloque de origen.
  dataset       text not null,                           -- 'lobby'
  origen        text not null,
  fecha_captura timestamptz not null default now(),
  enlace        text not null,
  licencia      text,                                    -- per-row; NULL salvo que la fila fuente la traiga
  -- orientación canónica para que (A,B)==(B,A): extremo_a < extremo_b al escribir.
  check (extremo_a < extremo_b),
  -- idempotencia: una arista por (tipo, par ordenado, objeto compartido).
  unique (tipo, extremo_a, extremo_b, contexto_clave)
);
-- DENY-BY-DEFAULT (espejo 0018/0021).
alter table arista enable row level security;
revoke all on arista from anon, authenticated;
create index arista_extremo_a_idx on arista (extremo_a);
create index arista_extremo_b_idx on arista (extremo_b);
create index arista_tipo_idx      on arista (tipo);

-- ── grafo.materializar_aristas() (proc idempotente, invocado por pg_cron) ───────
-- security definer: corre como owner para leer `lobby_audiencia`/`lobby_contraparte`
-- (deny-by-default) y escribir `entidad`/`arista`. set search_path = '' (V8): nombres
-- calificados con schema. ON CONFLICT DO NOTHING → un 2× run produce conteos idénticos
-- (los hechos de lobby son append-only; idempotencia simple).
-- Schema propio `grafo` para los internals de NET. NO usar el schema `net`: pertenece a
-- la extensión pg_net (http_get/http_request_queue) — reusarlo colisiona y un reinstall
-- de pg_net podría arrastrar nuestros objetos.
create schema if not exists grafo;

create or replace function grafo.materializar_aristas()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- 1) refrescar el set de nodos: cada parlamentario que aparezca CONFIRMADO en un hecho fuente.
  --    En el MVP la única fuente de aristas es lobby → el nodo nace de una audiencia confirmada.
  insert into public.entidad (id, parlamentario_id, tipo)
  select p.id, p.id, 'parlamentario'
  from public.parlamentario p
  where exists (
    select 1 from public.lobby_audiencia a
    where a.parlamentario_id = p.id and a.estado_vinculo = 'confirmado'
  )
  on conflict (id) do nothing;

  -- 2) aristas CO-LOBBY-CONTRAPARTE: dos parlamentarios confirmados que cada uno recibió
  --    audiencia de la MISMA contraparte. Hecho = "ambos recibieron audiencia de la contraparte Y".
  --    Join-key de contraparte = lower(trim(nombre)).
  --    LIMITACIÓN CONOCIDA (Open Question 3): `lobby_contraparte` no tiene un contraparte_id
  --    autoritativo en P11 (es NULL por diseño) → el único join estable es por nombre
  --    normalizado `lower(trim(nombre))`. Esto NO funde variantes ("Fundación X" vs
  --    "Fundacion X A.G." quedan separadas) ni distingue homónimos. Un futuro registro
  --    autoritativo de contrapartes (id exacto) tensaría esto; el pgTAP pinea ambos casos.
  insert into public.arista (tipo, extremo_a, extremo_b, contexto_clave, contexto_detalle,
                             desde, hasta, dataset, origen, fecha_captura, enlace, licencia)
  select 'co_lobby_contraparte',
         least(aa.parlamentario_id, ab.parlamentario_id),
         greatest(aa.parlamentario_id, ab.parlamentario_id),
         lower(trim(ca.nombre)),
         ca.nombre,
         least(aa.fecha, ab.fecha),
         greatest(aa.fecha, ab.fecha),
         'lobby', aa.origen, now(), aa.enlace, null
  from public.lobby_audiencia aa
  join public.lobby_contraparte ca on ca.identificador = aa.identificador
  join public.lobby_contraparte cb on lower(trim(cb.nombre)) = lower(trim(ca.nombre))
  join public.lobby_audiencia ab on ab.identificador = cb.identificador
                                 and aa.parlamentario_id < ab.parlamentario_id
  where aa.estado_vinculo = 'confirmado' and ab.estado_vinculo = 'confirmado'
    and aa.parlamentario_id is not null and ab.parlamentario_id is not null
  on conflict (tipo, extremo_a, extremo_b, contexto_clave) do nothing;
  -- NO existe bloque co_votacion (excluido del MVP por explosión de clique / anti-insinuación).
end;
$$;

-- ── cron.schedule (espejo 0003: guard de versión pg_cron + assertion post-migración) ─
do $$
declare
  v_ext_version text;
begin
  select extversion into v_ext_version
    from pg_extension where extname = 'pg_cron';

  if v_ext_version is null then
    raise exception 'pg_cron no esta instalado: no se puede programar la materializacion de aristas';
  end if;

  -- schedule diario off-peak (5 campos estándar; no requiere sub-minuto → no necesita pg_cron 1.5).
  perform cron.schedule(
    'net-materializar-aristas',
    '17 3 * * *',
    $cron$ select grafo.materializar_aristas(); $cron$
  );
end;
$$;

-- verificación post-migración: el job DEBE existir en cron.job. Si la programación falló
-- silenciosamente, esto rompe la migración en vez de dejar el grafo sin materializar sin aviso.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'net-materializar-aristas') then
    raise exception 'cron job net-materializar-aristas no quedo registrado: materializacion no programada';
  end if;
end;
$$;

-- ── subgrafo_red(...) (RPC público — CTE recursiva PII-safe, depth-clamped) ───
-- security definer: corre como owner para leer `entidad`/`arista` (deny-by-default) y la
-- maestra `parlamentario` (partido/rut deny-by-default), pero DEVUELVE SOLO id/nombre/camara
-- de cada nodo (NUNCA partido/rut/email — espejo de parlamentario_publico/0020). set search_path = ''.
-- REQUIERE una semilla `p_id`: NO hay variante seedless whole-graph (evita enumeración de
-- todos los nodos — espejo del diferimiento de listado WR-03 en 0025).
create or replace function public.subgrafo_red(
  p_id    text,                     -- nodo semilla (parlamentario id) — OBLIGATORIO
  p_depth int default 1,            -- cota DURA (clamp 1..2 in-SQL; NUNCA unbounded)
  p_tipos text[] default null,      -- filtro por tipo de arista (null = todos los tipos permitidos)
  p_desde timestamptz default null, -- filtro de ventana temporal
  p_hasta timestamptz default null
)
returns jsonb
language sql stable security definer set search_path = '' as $$
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
    select case when a.extremo_a = w.node_id then a.extremo_b else a.extremo_a end, w.nivel + 1
    from walk w
    join public.arista a on (a.extremo_a = w.node_id or a.extremo_b = w.node_id)
    where w.nivel < (select d from bound)
      and (p_tipos is null or a.tipo = any(p_tipos))
      and (p_desde is null or a.hasta is null or a.hasta >= p_desde)
      and (p_hasta is null or a.desde is null or a.desde <= p_hasta)
  ),
  nodos as (
    select distinct w.node_id from walk w
  ),
  aristas as (
    select a.* from public.arista a
    where a.extremo_a in (select node_id from nodos)
      and a.extremo_b in (select node_id from nodos)
      and (p_tipos is null or a.tipo = any(p_tipos))
      and (p_desde is null or a.hasta is null or a.hasta >= p_desde)
      and (p_hasta is null or a.desde is null or a.desde <= p_hasta)
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
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo 0019/0020/0021).
-- NO se añade ninguna policy ni grant select sobre entidad/arista/parlamentario (siguen
-- deny-by-default; el RPC nunca emite partido/rut y es el único canal público al grafo).
revoke execute on function public.subgrafo_red(text, int, text[], timestamptz, timestamptz) from public;
grant execute on function public.subgrafo_red(text, int, text[], timestamptz, timestamptz) to anon;
