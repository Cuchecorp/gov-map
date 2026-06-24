-- 0039_cruce_senal.sql
-- CRUCE (CRUCE-03) — la señal materializada parlamentario↔sector COMO-Postgres.
-- Tabla DENY-BY-DEFAULT `cruce_senal`, el proc idempotente `cruces.materializar_cruces()`
-- (FULL REBUILD transaccional, invocado por pg_cron), y el cron offset. La señal es
-- LOBBY-PURA en el MVP (D-09): "N reuniones de lobby con gestores del sector X". La fusión
-- lobby+aporte (token 'lobby_sector_aporte') queda reservada para Phase 40 (gated por RUT-01).
--
-- La última migración APLICADA es 0037 (resolver_entidad audit fix). 0038 (sector) la
-- precede en este mismo plan. Esta es la 0039.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 5): build/typecheck NO prueban que
-- Postgres ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0039_cruce_senal.test.sql) corriendo contra un schema APLICADO. Aplicar por
-- `psql --db-url` DIRECTO, NUNCA `supabase db push` (drift schema_migrations). El BOM en
-- `.env` rompe el CLI → pasar `--db-url` explícito. La aplicación al remoto vive en Plan 04.
--
-- DOBLE CANDADO: Candado A = RLS deny-by-default sobre `cruce_senal` (esta migración) +
-- RPC sin grant a anon (0040). Candado B = gate de presentación `crucesPublicEnabled()`
-- (Plan de superficie, default OFF). Nada se expone públicamente hasta el sign-off legal
-- (Phase 39, firma humana exclusiva).
--
-- TOKEN DE SEÑAL CONFIRMADO POR EL OPERADOR (Task 1, Decisión B1 — LOCKED, Open Question 1):
--   `tipo_senal` = 'lobby_sector'. Semántica honesta lobby-pura. 'lobby_sector_aporte'
--   se RESERVA para Phase 40 (NO se usa aquí). El CHECK lo materializa como allow-list.
--
-- DEPARTURE vs 0030_net.sql (D-11): el materializador hace FULL REBUILD transaccional
--   (`delete from public.cruce_senal` + re-`insert`) en vez del `on conflict do nothing`
--   de NET. Razón: la señal de cruces es un AGREGADO (conteo + evidencia jsonb) que cambia
--   cuando llegan nuevas audiencias o re-clasificaciones de sector_id; un rebuild garantiza
--   que el conteo y la evidencia reflejen el estado actual completo, no un acumulado parcial.
--
-- CONVENCIONES ESPEJADAS:
--   * `cruce_senal` → DENY-BY-DEFAULT VERBATIM de 0021/0030: RLS habilitada, CERO policies,
--     `revoke all from anon, authenticated` (cierra el hueco de default privileges).
--   * `cruces.materializar_cruces()` → `security definer set search_path = ''` (lee
--     lobby_audiencia/lobby_contraparte deny-by-default; el cron lo invoca).
--   * `cron.schedule` + guard de versión pg_cron + assertion post-migración (espejo 0030).
--   * Provenance INLINE NOT NULL en cada fila (FND-08): dataset/origen/fecha_captura/enlace.
--   * El cuerpo NUNCA referencia partido ni rut (las tablas fuente de lobby no los traen).

-- ── cruce_senal (SEÑAL materializada parlamentario↔sector — forma D-09) ────────
-- Forma propia (NO espejo de arista): es una señal agregada por (parlamentario, sector),
-- no una relación binaria entre parlamentarios. La evidencia jsonb (D-09) lleva los items
-- crudos con su enlace de fuente para trazabilidad por dato.
create table cruce_senal (
  id               bigint generated always as identity primary key,
  parlamentario_id text not null references parlamentario(id) on delete cascade,
  sector_id        text not null references sector(codigo),
  -- allow-list LOCKED del token confirmado (B1). 'lobby_sector_aporte' se reserva a Phase 40.
  tipo_senal       text not null check (tipo_senal in ('lobby_sector')),
  conteo           int not null,                 -- número de hechos que sustentan la señal
  -- evidencia D-09: conteo + items[] crudos (cada item con su enlace de fuente). nombre CRUDO (D-10).
  evidencia        jsonb not null,
  -- provenance inline NOT NULL (FND-08): per-row, heredada del bloque de origen (lobby).
  dataset          text not null,                -- 'lobby'
  origen           text not null,
  fecha_captura    timestamptz not null default now(),
  enlace           text not null,
  -- idempotencia del rebuild: una señal por (parlamentario, sector, tipo).
  unique (parlamentario_id, sector_id, tipo_senal)
);
-- DENY-BY-DEFAULT (Ley 21.719, LEGAL-03; espejo 0021/0030): enable SIN policies.
-- DEFENSA EN PROFUNDIDAD: este proyecto concede por DEFAULT PRIVILEGES a anon/authenticated
-- sobre CADA tabla nueva en public. La RLS sin policy niega las FILAS; REVOCAR cierra el
-- hueco del PRIVILEGIO (lección 0021). El service_role (writer/owner) bypassa RLS.
alter table cruce_senal enable row level security;
revoke all on cruce_senal from anon, authenticated;
create index cruce_senal_parlamentario_idx on cruce_senal (parlamentario_id);
create index cruce_senal_sector_idx        on cruce_senal (sector_id);

-- ── cruces.materializar_cruces() (proc FULL REBUILD, invocado por pg_cron) ──────
-- security definer: corre como owner para leer `lobby_audiencia`/`lobby_contraparte`
-- (deny-by-default) y escribir `cruce_senal`. set search_path = '' (V8): nombres
-- calificados con schema. DEPARTURE D-11: delete-all + re-insert (NO on-conflict) → el
-- conteo y la evidencia reflejan el estado actual completo en cada corrida.
-- El cuerpo lee SOLO lobby_audiencia + lobby_contraparte (+ sector_id de la contraparte);
-- NUNCA referencia partido ni rut (las tablas fuente no los traen).
-- Schema propio `cruces` para los internals (NO reusar `net` de pg_net ni `grafo` de NET).
create schema if not exists cruces;

create or replace function cruces.materializar_cruces()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- FULL REBUILD transaccional (D-11): borra el estado previo y reconstruye desde los hechos.
  delete from public.cruce_senal;

  -- Señal LOBBY-PURA (D-09): por (parlamentario confirmado, sector de la contraparte) cuenta
  -- las audiencias de lobby y arma la evidencia jsonb con los items crudos (nombre CRUDO, D-10).
  -- Join lobby_audiencia ⨝ lobby_contraparte por identificador (la contraparte lleva sector_id,
  -- clasificado por Plan 02/03). Solo audiencias confirmadas con contraparte clasificada.
  insert into public.cruce_senal
    (parlamentario_id, sector_id, tipo_senal, conteo, evidencia,
     dataset, origen, fecha_captura, enlace)
  select
    a.parlamentario_id,
    c.sector_id,
    'lobby_sector',
    count(*),
    jsonb_build_object(
      'conteo', count(*),
      'items', jsonb_agg(
        jsonb_build_object(
          'tipo', 'reunion',
          'fecha', a.fecha,
          'contraparte_nombre_crudo', c.nombre,   -- nombre CRUDO (D-10), nunca normalizado/inferido
          'audiencia_id', a.identificador,
          'enlace_fuente', a.enlace
        ) order by a.fecha desc
      )
    ),
    'lobby',
    min(a.origen),
    now(),
    min(a.enlace)
  from public.lobby_audiencia a
  join public.lobby_contraparte c on c.identificador = a.identificador
  where a.estado_vinculo = 'confirmado'
    and a.parlamentario_id is not null
    and c.sector_id is not null
  group by a.parlamentario_id, c.sector_id;
end;
$$;

-- ── cron.schedule (espejo 0030: guard de versión pg_cron + assertion post-migración) ─
-- jobname 'cruces-materializar', expr '23 3 * * *' (offset de '17 3' de net-materializar
-- para evitar colisión de ventana off-peak).
do $$
declare
  v_ext_version text;
begin
  select extversion into v_ext_version
    from pg_extension where extname = 'pg_cron';

  if v_ext_version is null then
    raise exception 'pg_cron no esta instalado: no se puede programar la materializacion de cruces';
  end if;

  perform cron.schedule(
    'cruces-materializar',
    '23 3 * * *',
    $cron$ select cruces.materializar_cruces(); $cron$
  );
end;
$$;

-- verificación post-migración: el job DEBE existir en cron.job. Si la programación falló
-- silenciosamente, esto rompe la migración en vez de dejar la señal sin materializar sin aviso.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'cruces-materializar') then
    raise exception 'cron job cruces-materializar no quedo registrado: materializacion no programada';
  end if;
end;
$$;
