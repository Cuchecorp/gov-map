-- 0065_actualidad_senal.sql
-- SEÑALES P1b (SEN-02/03/04) — la superficie de datos del panel de actualidad COMO-Postgres.
-- Tabla DENY-BY-DEFAULT `actualidad_senal`, el proc full-rebuild transaccional
-- `actualidad.materializar_senales()` (SQL puro, security definer, invocado por pg_cron),
-- y el job pg_cron intradía L-V. Espeja 0039_cruce_senal.sql al pie de la letra en la
-- envoltura de seguridad y la forma del proc/cron.
--
-- La última migración APLICADA es 0064 (bounded RPCs statement_timeout). Esta es la 0065.
-- La RPC de lectura del panel (0066) y el CLI k-means (`agrupacion_materia`) NO viven aquí.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Plan 99-04, Pitfall 5): build/typecheck NO prueban
-- que Postgres ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0065_actualidad_senal.test.sql) corriendo contra un schema APLICADO. Aplicar por:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0065_actualidad_senal.sql
-- NUNCA `supabase db push` (drift schema_migrations). El BOM en `.env` rompe el CLI → pasar
-- `--db-url` explícito. La aplicación al remoto vive en Plan 99-04.
--
-- CONTRATO DEL SPIKE (98-SPIKE-FINDINGS §1/§2/§3/§4 — LOCKED):
--   * SOLO señales HONESTAS: velocity, nuevos_ingresos (2022-2026), urgencias,
--     agenda_citacion, agenda_sala, archivados. Cada una anclada a tramitacion_evento.fecha.
--   * 3 DEFECTOS DE DATOS aplicados en TODA agregación:
--       (D1) `fecha <= current_date` en todo max/ventana (mata 2 filas fecha='2626-05-25').
--       (D2) normalizar `camara` por `regexp_replace(camara,'\s+','','g')` antes de agrupar
--            (dos grafías vivas: C.Diputados / C. Diputados).
--       (D3) `camara IS NULL` (2.261 filas) → '(sin cámara)' literal, NUNCA repartido.
--   * REGLA DEL RELOJ: `fecha_captura` JAMÁS es un hecho legislativo (44.847 eventos comparten
--     fecha_captura=2026-07-10 por backfill). Se usa SOLO para frescura/hash-check. Toda señal
--     temporal se ancla a `tramitacion_evento.fecha`.
--   * SUPRESIÓN = FILA con `supresion_causa` (ausencia ≠ hecho). Nunca fila faltante, nunca
--     0-como-hecho. agenda_sala sin futuras → fila supresión. Fuente stale → fila supresión.
--   * ANTI-RANKING cross-cámara (T-52-13): PROHIBIDO order-by-conteo cross-cámara; framing
--     "N trámites en 7 días", nunca "top/los más". `cobertura_camara` declara el sesgo por fila.
--
-- UMBRAL STALE HARDCODEADO (Open Question A5): el umbral de frescura vive en TypeScript
--   (packages/freshness/src/catalog.ts) y NO es consultable desde el proc SQL. Se hardcodea
--   aquí como constante documentada: 7 días, tomando como REFERENCIA del NÚMERO el `umbralDias`
--   de las fuentes `leyes` y `agenda` en catalog.ts. WR-03: solo el NÚMERO se comparte — la
--   SEMÁNTICA difiere por diseño (catalog.ts mide MAX(fecha_captura)=frescura de scrape; este
--   proc mide MAX(evento.fecha)=recencia del hecho, regla del reloj §4). NO hay paridad de
--   medida. Si el número cambia en catalog.ts, ACTUALIZAR aquí (deriva documentada, SUMMARY 99-01).
--
-- DELETE ACOTADO (CRÍTICO — Pitfall 5 del research, race pg_cron↔GH Actions): el proc borra
--   SOLO los tipos_señal temporales; el tipo 'agrupacion_materia' lo posee el CLI k-means
--   (Plan 99-03). JAMÁS `delete from public.actualidad_senal` global.

-- ── actualidad_senal (SEÑAL materializada del panel de actualidad) ────────────
-- Forma propia: una fila por (señal, corte de cámara, ventana, cluster). La evidencia jsonb
-- lleva los items crudos con su enlace de fuente para trazabilidad por dato (D-09). Provenance
-- inline NOT NULL (FND-08). CHECK de 7 tipos como allow-list (6 temporales + agrupacion_materia).
create table actualidad_senal (
  id               bigint generated always as identity primary key,
  tipo_senal       text not null check (tipo_senal in
                     ('velocity','nuevos_ingresos','urgencias','agenda_citacion',
                      'agenda_sala','archivados','agrupacion_materia')),
  ventana          text,                              -- p.ej. '7d', '30d', '2022-2026'
  conteo           int  not null default 0,           -- número de hechos que sustentan la señal
  cobertura_camara text,                              -- normalizada; '(sin cámara)' | 'C.Diputados' | 'Senado' | …
  materia          text,                              -- label factual (clusters/agenda) / null
  cluster_id       int,                               -- solo agrupacion_materia (CLI); null aquí
  fecha_max        timestamptz,                        -- max(tramitacion_evento.fecha SANEADA) — reloj real
  supresion_causa  text,                              -- NULL = señal activa; texto = suprimida con causa
  evidencia        jsonb not null default '{}'::jsonb, -- items crudos con enlace de fuente (D-09)
  -- provenance inline NOT NULL (FND-08): per-row, heredada del bloque de origen.
  dataset          text not null,
  origen           text not null,
  fecha_captura    timestamptz not null default now(),
  enlace           text,
  -- idempotencia del rebuild: una señal por (tipo, cobertura_camara, ventana, cluster_id).
  unique (tipo_senal, cobertura_camara, ventana, cluster_id)
);
-- DENY-BY-DEFAULT (Ley 21.719, LEGAL-03; espejo 0039 L62-69): enable SIN policies.
-- DEFENSA EN PROFUNDIDAD: este proyecto concede por DEFAULT PRIVILEGES a anon/authenticated
-- sobre CADA tabla nueva en public. La RLS sin policy niega las FILAS; REVOCAR cierra el hueco
-- del PRIVILEGIO. El service_role (writer/owner) bypassa RLS; la RPC 0066 la lee. CERO grant.
alter table actualidad_senal enable row level security;
revoke all on actualidad_senal from anon, authenticated;
create index actualidad_senal_tipo_idx on actualidad_senal (tipo_senal);

-- ── actualidad.materializar_senales() (proc FULL REBUILD, invocado por pg_cron) ─
-- security definer: corre como owner para leer tramitacion_evento/citacion/sesion_sala
-- (público-read pero el proc no depende del rol del caller) y escribir actualidad_senal
-- (deny-by-default). set search_path = '' (V8): nombres calificados con schema.
-- El cuerpo lee SOLO tablas no-PII (tramitacion_evento/citacion/sesion_sala/proyecto);
-- NUNCA referencia partido ni rut (el pgTAP muerde el cuerpo).
-- Schema propio `actualidad` para los internals (NO reusar `cruces`/`net`/`grafo`).
create schema if not exists actualidad;

create or replace function actualidad.materializar_senales()
returns void language plpgsql security definer set search_path = '' as $$
declare
  -- Umbral de frescura HARDCODEADO (Open Question A5). SQL no puede leer TypeScript → el valor
  -- se replica aquí. Si catalog.ts cambia el NÚMERO, actualizar esta constante (deriva
  -- documentada en el SUMMARY 99-01).
  --
  -- WR-03 — PROVENANCE HONESTA (solo el NÚMERO se comparte, NO la semántica):
  --   * NÚMERO (7): tomado como referencia de packages/freshness/src/catalog.ts, fuentes `leyes`
  --     y `agenda` (ambas umbralDias:7). Es una referencia del valor, NO un acople verificado en
  --     runtime (nada enlaza los dos; el pgTAP siembra su propia staleness, no lee catalog.ts).
  --   * SEMÁNTICA (DISTINTA por diseño): catalog.ts mide frescura contra MAX(fecha_captura) — la
  --     fecha de SCRAPE. Este proc mide recencia contra MAX(tramitacion_evento.fecha) /
  --     MAX(citacion.fecha) — la fecha del EVENTO (regla del reloj, §4: fecha_captura JAMÁS es un
  --     hecho legislativo). El número coincide; la COLUMNA MEDIDA no. NO asumir paridad de medida.
  c_umbral_stale_dias constant int := 7;
  -- Frescura real de cada fuente = max(fecha SANEADA) (D1: fecha <= current_date). Ausencia de
  -- datos frescos → supresión-como-fila, JAMÁS "sin movimiento" (regla del reloj, §4).
  v_tram_max  date;
  v_cita_max  date;
begin
  -- FULL REBUILD ACOTADO a los tipos temporales (Pitfall 5): el CLI 99-03 posee 'agrupacion_materia'.
  -- JAMÁS `delete from public.actualidad_senal` global.
  delete from public.actualidad_senal
   where tipo_senal in ('velocity','nuevos_ingresos','urgencias',
                        'agenda_citacion','agenda_sala','archivados');

  -- Frescura de las fuentes (D1: solo fechas <= hoy; la fecha real del evento, NO fecha_captura).
  select max(fecha::date) into v_tram_max
    from public.tramitacion_evento where fecha <= current_date;
  select max(fecha::date) into v_cita_max
    from public.citacion where fecha::date <= current_date;

  -- ── (1) velocity — "N trámites en 7 días" por cámara NORMALIZADA ─────────────
  -- Framing conteo, NUNCA "top" (anti-ranking T-52-13). Aplica D1/D2/D3. cobertura_camara
  -- declara el sesgo por fila (nunca se ordena cross-cámara por conteo).
  -- Supresión por frescura (§4): si la fuente de tramitación está stale, se emite en su lugar
  -- una fila de supresión (más abajo) y NO las filas positivas de velocity.
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
    select 'velocity', '7d', count(*),
           coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), '(sin cámara)'),
           max(fecha), 'tramitacion', 'plataforma-tramitacion', now()
      from public.tramitacion_evento
     where fecha <= current_date                                   -- D1
       and fecha >= current_date - interval '7 days'
     group by coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), '(sin cámara)');  -- D2/D3
  else
    -- Supresión-como-fila (ausencia ≠ hecho): la fuente está stale o vacía.
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, supresion_causa,
       dataset, origen, fecha_captura)
    values ('velocity', '7d', 0, null, v_tram_max, 'sin datos frescos de esta fuente',
            'tramitacion', 'plataforma-tramitacion', now());
  end if;

  -- ── (2) nuevos_ingresos — primer-evento por boletín, ventana 7d, corpus 2022-2026 ─
  -- HONESTA-CONDICIONAL: primer-evento por boletín; EXCLUIR primer-evento pre-2022 (eventos
  -- históricos de proyectos viejos, no ingresos). JAMÁS fecha_captura (§4). Aplica D1. Sin
  -- corte por cámara (no aplica sesgo de cámara aquí).
  -- WR-02 (honestidad del label): la VENTANA REAL de conteo es 7 días (HAVING min(fecha) >=
  --   current_date - 7). El '2022-2026' es el PISO DE CORPUS (exclusión pre-2022), NO la
  --   ventana → `ventana='7d'` (la verdad temporal) y el corpus va en `cobertura_camara`.
  -- WR-01 (supresión ≠ 0-como-hecho): esta señal se ancla a tramitacion_evento; si la fuente
  --   está stale, emitir supresión-como-fila (NO conteo=0 con causa NULL). Y si la fuente está
  --   fresca pero no hubo ingresos en la ventana, TAMBIÉN emitir supresión-como-fila (el
  --   select sin GROUP BY devolvería una fila conteo=0/causa NULL = 0-como-hecho prohibido).
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
    select 'nuevos_ingresos', '7d', count(*), '2022-2026 (piso de corpus)', max(pe.primer),
           'tramitacion', 'plataforma-tramitacion', now()
      from (
        select boletin, min(fecha) as primer
          from public.tramitacion_evento
         where fecha <= current_date                               -- D1
         group by boletin
        having min(fecha) >= date '2022-01-01'                     -- EXCLUIR pre-2022 (piso corpus)
           and min(fecha) >= current_date - interval '7 days'      -- ingresados en la ventana 7d
      ) pe
     having count(*) > 0;                                          -- no 0-como-hecho
    if not found then
      insert into public.actualidad_senal
        (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, supresion_causa,
         dataset, origen, fecha_captura)
      values ('nuevos_ingresos', '7d', 0, '2022-2026 (piso de corpus)', v_tram_max,
              'sin nuevos ingresos fechados en la ventana',
              'tramitacion', 'plataforma-tramitacion', now());
    end if;
  else
    -- Supresión-como-fila (ausencia ≠ hecho): la fuente de tramitación está stale o vacía.
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, supresion_causa,
       dataset, origen, fecha_captura)
    values ('nuevos_ingresos', '7d', 0, '2022-2026 (piso de corpus)', v_tram_max,
            'sin datos frescos de esta fuente',
            'tramitacion', 'plataforma-tramitacion', now());
  end if;

  -- ── (3) urgencias — evento de urgencia FECHADO (nunca "vigente") ─────────────
  -- HONESTA: el HECHO fechado, no un juicio. Aplica D1. Ventana 30d. Sin corte de cámara
  -- por conteo (evita ranking cross-cámara); el conteo agregado es honesto.
  -- WR-01 (supresión ≠ 0-como-hecho): anclada a tramitacion_evento → gate de frescura como
  --   velocity; si stale, supresión-como-fila. Si fresca pero sin urgencias en la ventana,
  --   TAMBIÉN supresión-como-fila (el select sin GROUP BY daría conteo=0/causa NULL prohibido).
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
    select 'urgencias', '30d', count(*), null, max(fecha),
           'tramitacion', 'plataforma-tramitacion', now()
      from public.tramitacion_evento
     where tipo = 'urgencia'
       and fecha <= current_date                                   -- D1
       and fecha >= current_date - interval '30 days'
     having count(*) > 0;                                          -- no 0-como-hecho
    if not found then
      insert into public.actualidad_senal
        (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
      values ('urgencias', '30d', 0, v_tram_max,
              'sin urgencias fechadas en la ventana',
              'tramitacion', 'plataforma-tramitacion', now());
    end if;
  else
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
    values ('urgencias', '30d', 0, v_tram_max, 'sin datos frescos de esta fuente',
            'tramitacion', 'plataforma-tramitacion', now());
  end if;

  -- ── (4) agenda_citacion — citaciones FUTURAS reales (tz Chile date-only) ─────
  -- HONESTA: "coming up" real. `citacion.fecha` es date-only-midnight-UTC = día chileno
  -- (dia-calendario.ts LOCKED): comparar `fecha::date >= current_date` SIN at time zone.
  -- Corte de cámara declarado (cobertura_camara = citacion.camara CRUDA — 'camara'/'senado').
  -- WR-05 (falso negativo por captura stale): la DECISIÓN se basa en la PRESENCIA de filas
  --   FUTURAS, NO en max(fecha PASADA). Una citación futura real ya en la DB es un hecho
  --   ("coming up") aunque la fuente no se haya re-ingerido hace >7 días — v_cita_max mide
  --   el máximo evento PASADO y quedaría stale falsamente. Por eso el `if exists (futuras)`
  --   domina la decisión: si hay futuras → filas positivas SIEMPRE. Solo cuando NO hay
  --   futuras se distingue "fuente stale" (no re-ingerida) de "sin próximas" (hecho legítimo).
  if exists (select 1 from public.citacion where fecha::date >= current_date) then
    -- Hay citaciones futuras reales → emitir filas positivas SIEMPRE (hecho, no depende de frescura).
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
    select 'agenda_citacion', 'futuras', count(*),
           coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), '(sin cámara)'),
           max(fecha), 'agenda', 'plataforma-agenda', now()
      from public.citacion
     where fecha::date >= current_date                             -- tz Chile date-only (Pitfall 6)
     group by coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), '(sin cámara)');  -- D2/D3
  elsif v_cita_max is not null and v_cita_max >= current_date - c_umbral_stale_dias then
    -- Sin futuras pero la fuente es FRESCA → es un hecho: no hay nada agendado próximamente.
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
    values ('agenda_citacion', 'futuras', 0, v_cita_max,
            'sin citaciones agendadas en las fuentes consultadas',
            'agenda', 'plataforma-agenda', now());
  else
    -- Sin futuras Y fuente stale (o vacía) → no se puede afirmar "nada próximo": supresión por frescura.
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
    values ('agenda_citacion', 'futuras', 0, v_cita_max, 'sin datos frescos de esta fuente',
            'agenda', 'plataforma-agenda', now());
  end if;

  -- ── (5) agenda_sala — sesiones de sala FUTURAS; sin futuras → SUPRIMIR ────────
  -- HONESTA con supresión estricta (98-SPIKE §1: sesion_sala 16 filas / 0 futuras HOY).
  -- `sesion_sala` es el nombre real de la tabla (0010_agenda.sql L59), NO sesion_tabla_item
  -- (Open Question A4 resuelto). `fecha` es date-only-midnight-UTC = día chileno (sin tz).
  if exists (select 1 from public.sesion_sala where fecha::date >= current_date) then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
    select 'agenda_sala', 'futuras', count(*),
           coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), '(sin cámara)'),
           max(fecha), 'agenda', 'plataforma-agenda', now()
      from public.sesion_sala
     where fecha::date >= current_date                             -- tz Chile date-only
     group by coalesce(nullif(regexp_replace(camara, '\s+', '', 'g'), ''), '(sin cámara)');
  else
    -- Supresión-como-fila (ausencia ≠ hecho): 0 futuras NO se afirma como "no hay sesiones".
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
    values ('agenda_sala', 'futuras', 0,
            (select max(fecha) from public.sesion_sala where fecha <= current_date),
            'sin sesiones agendadas en las fuentes consultadas',
            'agenda', 'plataforma-agenda', now());
  end if;

  -- ── (6) archivados — movimiento de archivo/retiro FECHADO (por descripcion) ──
  -- HONESTA-CON-CAVEAT: filtrar por `descripcion` (evento fechado), NO por proyecto.estado
  -- (cuya fecha = fecha_captura mentirosa). EXCLUIR 'desarchiv%' y 'retira y hace presente%'
  -- (invierten el sentido — no son archivo/retiro). Framing "movimiento de archivo/retiro
  -- fechado", NO "proyectos actualmente archivados". Aplica D1. Ventana 30d.
  -- WR-01 (supresión ≠ 0-como-hecho): anclada a tramitacion_evento → gate de frescura como
  --   velocity; si stale, supresión-como-fila. Si fresca pero sin movimientos en la ventana,
  --   TAMBIÉN supresión-como-fila (el select sin GROUP BY daría conteo=0/causa NULL prohibido).
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
    select 'archivados', '30d', count(*), null, max(fecha),
           'tramitacion', 'plataforma-tramitacion', now()
      from public.tramitacion_evento
     where fecha <= current_date                                   -- D1
       and fecha >= current_date - interval '30 days'
       and (descripcion ilike '%archiv%' or descripcion ilike '%retira%')
       and descripcion not ilike '%desarchiv%'                     -- invierte el sentido
       and descripcion not ilike '%retira y hace presente%'        -- invierte el sentido
     having count(*) > 0;                                          -- no 0-como-hecho
    if not found then
      insert into public.actualidad_senal
        (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
      values ('archivados', '30d', 0, v_tram_max,
              'sin movimientos de archivo/retiro fechados en la ventana',
              'tramitacion', 'plataforma-tramitacion', now());
    end if;
  else
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, fecha_max, supresion_causa, dataset, origen, fecha_captura)
    values ('archivados', '30d', 0, v_tram_max, 'sin datos frescos de esta fuente',
            'tramitacion', 'plataforma-tramitacion', now());
  end if;
end;
$$;

-- ── cron.schedule (espejo 0039 L124-154: guard de versión pg_cron + assertion) ─
-- jobname 'actualidad-materializar', expr intradía L-V '7 11,14,17,20 * * 1-5' (offset :07
-- para no colisionar con la ventana de otros jobs; 4 corridas hábiles diarias).
do $$
declare
  v_ext_version text;
begin
  select extversion into v_ext_version
    from pg_extension where extname = 'pg_cron';

  if v_ext_version is null then
    raise exception 'pg_cron no esta instalado: no se puede programar la materializacion de actualidad';
  end if;

  perform cron.schedule(
    'actualidad-materializar',
    '7 11,14,17,20 * * 1-5',
    $cron$ select actualidad.materializar_senales(); $cron$
  );
end;
$$;

-- verificación post-migración: el job DEBE existir en cron.job. Si la programación falló
-- silenciosamente, esto rompe la migración en vez de dejar la señal sin materializar sin aviso.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'actualidad-materializar') then
    raise exception 'cron job actualidad-materializar no quedo registrado: materializacion no programada';
  end if;
end;
$$;
