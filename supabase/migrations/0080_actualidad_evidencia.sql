-- 0080_actualidad_evidencia.sql
-- ADITIVA (D-09): `create or replace` de `actualidad.materializar_senales()` (0065:88-310) que
-- añade una columna `evidencia` jsonb por INSERT POSITIVO (los sujetos del hecho: boletín,
-- título, fecha, enlace, en_corpus) más la función `grafia_camara(text)` (schema `actualidad`) que unifica
-- la grafía de cámara en un único punto (PANEL-06/D-07). Purpose: PANEL-01 — la UI de la Phase
-- 128 necesita nombrar los sujetos del hecho, no solo un conteo.
--
-- La última migración APLICADA es 0079. Esta es la 0080. `0073`/`0075` están ESCRITAS y NO
-- aplicadas — JAMÁS se editan ni se reordenan; 0080 es puramente aditiva sobre 0065.
--
-- Arquitectura Opción A adjudicada por spike, NO se re-abre: esta migración NO cambia la firma
-- de la RPC `0066`, cero allowlist nueva, cero DDL de tabla nueva, cero grant/revoke.
--
-- Anti-B-01 (D-03): CERO cap por recencia. `evidencia->>'total'` == número de ítems, siempre.
-- Si algún día hiciera falta cappear la lista de items por tamaño de payload, se hace **por
-- grado** y con el `total` real declarado aparte (umbral documentado, NO implementado aquí).
-- Motivo: `order by fecha desc` + cap silencioso fue exactamente el defecto B-01 de v12.0 (un
-- número mostrado que no correspondía a la composición real de los datos).
--
-- Guard 404 (D-05): todo bloque que emita boletines hace left join contra `public.proyecto`; el ítem
-- se emite SIEMPRE con `en_corpus` (boolean, calculado por el left join); JAMÁS inner join
-- (un inner join divergiría el conteo del bloque respecto al `count(*)` ya materializado).
--
-- Unidad de la evidencia = unidad del conteo (D-02/D-06): eventos de tramitación en
-- velocity/nuevos_ingresos/urgencias/archivados; **citaciones** en `agenda_citacion` (con
-- `puntos` anidados por sub-select correlacionado); **sesiones** en `agenda_sala` (con `tabla`
-- anidada, porque 0065:260-265 cuenta `sesion_sala`, NO `sesion_tabla_item`).
--
-- Supresión conserva `'{}'` (D-09): ningún INSERT de supresión de 0065 lista la columna
-- `evidencia` en esta migración — el default `'{}'::jsonb` de la tabla se mantiene intacto.
--
-- D-09b (riesgo de `create or replace`): REPLACE preserva `proowner` y `proacl` del proc
-- secdef, pero **NO preserva los `SET` de la definición** (search_path). Por eso este archivo
-- restatea LITERALMENTE la cláusula security-definer + search_path vacío al re-declarar el proc —
-- omitirlo reabriría el vector de inyección de search_path (V8) contra un proc security
-- definer. Cero grants/revokes en este archivo: la ACL ya existente se conserva por el propio
-- REPLACE, y declarar grants/revokes aquí SERÍA el cambio de ACL que D-09 prohíbe.
--
-- D-12: el bloque `cron.schedule` de `0065:312-342` NO se re-emite en 0080. `cron.schedule`
-- guarda el TEXTO SQL `select actualidad.materializar_senales();`, resuelto por NOMBRE en cada
-- corrida — el REPLACE del proc es transparente para el job ya programado.
--
-- Aplicación (D-10) — igual que 0065, NUNCA `supabase db push` (drift de schema_migrations):
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0080_actualidad_evidencia.sql
-- Este plan (127-01) NO aplica nada a PROD — eso vive en el plan 127-03.
--
-- Notas del gate Fable (2026-07-30), para que queden escritas junto al código que gatearon:
--   M3: `consultado_al = current_date` es correcto a las horas del cron (11/14/17/20 UTC = ya
--   es día chileno en Postgres al momento de correr). Una materialización MANUAL corrida entre
--   00:00-04:00 UTC estamparía el día chileno SIGUIENTE en `consultado_al` — NO correr el proc
--   a mano en esa franja horaria.
--   M5: `grafia_camara` nace con EXECUTE-to-PUBLIC por default (comportamiento estándar de
--   Postgres para funciones nuevas). Riesgo ≈ 0: el schema `actualidad` no tiene USAGE
--   concedido a `anon`/`authenticated`, y la función es pura (sin side effects, sin acceso a
--   datos). Se deja anotado, sin revoke — añadir un revoke aquí SERÍA el cambio de ACL que D-09
--   prohíbe.
--   M4 (convención): en los comentarios de este archivo la función se nombra `grafia_camara` a
--   secas (sin el prefijo del schema); el nombre calificado completo (schema + función)
--   solo aparece en código ejecutable (definición + llamadas), nunca en prosa de comentario.

-- ── grafia_camara (PANEL-06/D-07) — single-source de la grafía ciudadana de cámara ──
-- Unifica en un único punto la normalización que antes vivía repetida (regexp_replace inline)
-- en cada bloque del proc. `immutable`: solo referencia funciones de pg_catalog (siempre
-- resolubles) y no toca ninguna tabla — indexable/inlineable por el planner. NO se le pone
-- `set search_path`: eso bloquearía el inlining y aquí no hace falta (sin nombres calificables
-- de otros schemas dentro del cuerpo).
create or replace function actualidad.grafia_camara(p_camara text)
returns text language sql immutable as $$
  select case
    when p_camara is null or btrim(p_camara) = '' then '(sin cámara)'              -- D-08
    when lower(regexp_replace(p_camara, '\s+', '', 'g')) in
         ('c.diputados', 'camara', 'cámara', 'diputados', 'camaradediputados')
      then 'Cámara de Diputados'
    when lower(regexp_replace(p_camara, '\s+', '', 'g')) in ('senado')
      then 'Senado'
    else regexp_replace(p_camara, '\s+', ' ', 'g')                                 -- nunca descartar
  end;
$$;

-- ── actualidad.materializar_senales() (proc FULL REBUILD, invocado por pg_cron) ─
-- security definer: corre como owner para leer tramitacion_evento/citacion/sesion_sala
-- (público-read pero el proc no depende del rol del caller) y escribir actualidad_senal
-- (deny-by-default). set search_path = '' (V8): nombres calificados con schema.
-- El cuerpo lee SOLO tablas no-PII (tramitacion_evento/citacion/sesion_sala/proyecto);
-- NUNCA referencia tablas ni columnas de identidad/afiliación política de personas (el pgTAP
-- muerde el cuerpo del proc para asegurar la ausencia de esa superficie).
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
  -- evidencia (D-01..D-09): unidad = evento de tramitación (mismo conteo que `conteo`); grafía
  -- vía grafia_camara — MISMA expresión en select y group by (Pitfall 1).
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia, dataset, origen, fecha_captura)
    select 'velocity', '7d', count(*),
           actualidad.grafia_camara(te.camara),
           max(te.fecha),
           jsonb_build_object('total', count(*),
             'consultado_al', current_date,
             'fuente', jsonb_build_object('dataset','tramitacion','origen','plataforma-tramitacion'),
             'items', coalesce(jsonb_agg(jsonb_build_object(
                        'boletin', te.boletin,
                        'titulo', p.titulo,
                        'fecha', te.fecha::date,
                        'enlace', p.enlace,
                        'enlace_evento', te.enlace,
                        'en_corpus', (p.boletin is not null)
                      ) order by te.fecha desc), '[]'::jsonb)
           ),
           'tramitacion', 'plataforma-tramitacion', now()
      from public.tramitacion_evento te
      left join public.proyecto p on p.boletin = te.boletin
     where te.fecha <= current_date                                   -- D1
       and te.fecha >= current_date - interval '7 days'
     group by actualidad.grafia_camara(te.camara);                    -- D2/D3, misma expresión que el select
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
  -- cobertura_camara sigue siendo el literal '2022-2026 (piso de corpus)' — NO es una cámara,
  -- NO pasa por grafia_camara.
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia, dataset, origen, fecha_captura)
    select 'nuevos_ingresos', '7d', count(*), '2022-2026 (piso de corpus)', max(pe.primer),
           jsonb_build_object('total', count(*),
             'consultado_al', current_date,
             'fuente', jsonb_build_object('dataset','tramitacion','origen','plataforma-tramitacion'),
             'items', coalesce(jsonb_agg(jsonb_build_object(
                        'boletin', pe.boletin,
                        'titulo', p.titulo,
                        'fecha', pe.primer::date,
                        'enlace', p.enlace,
                        'en_corpus', (p.boletin is not null)
                      ) order by pe.primer desc), '[]'::jsonb)
           ),
           'tramitacion', 'plataforma-tramitacion', now()
      from (
        select boletin, min(fecha) as primer
          from public.tramitacion_evento
         where fecha <= current_date                               -- D1
         group by boletin
        having min(fecha) >= date '2022-01-01'                     -- EXCLUIR pre-2022 (piso corpus)
           and min(fecha) >= current_date - interval '7 days'      -- ingresados en la ventana 7d
      ) pe
      left join public.proyecto p on p.boletin = pe.boletin
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
  -- por conteo (evita ranking cross-cámara); el conteo agregado es honesto. cobertura_camara
  -- sigue siendo null (anti-ranking, no tocar).
  -- WR-01 (supresión ≠ 0-como-hecho): anclada a tramitacion_evento → gate de frescura como
  --   velocity; si stale, supresión-como-fila. Si fresca pero sin urgencias en la ventana,
  --   TAMBIÉN supresión-como-fila (el select sin GROUP BY daría conteo=0/causa NULL prohibido).
  -- Fable blocker 3: la clave del ítem es `descripcion` (NO `grado`) — el valor es la
  -- descripción completa del evento, verbatim de fuente, que puede no ser un grado tipificado
  -- del dominio; prometer `grado` y entregar una frase libre sería editorialización-desde-el-
  -- dato. Coherente con el mismo campo en archivados. Si la Phase 128 necesita un grado
  -- tipificado, lo deriva ahí — JAMÁS fabricado en 0080. Los ~95 eventos van completos: cero
  -- `limit`, cero cap (Anti-B-01).
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia, dataset, origen, fecha_captura)
    select 'urgencias', '30d', count(*), null, max(te.fecha),
           jsonb_build_object('total', count(*),
             'consultado_al', current_date,
             'fuente', jsonb_build_object('dataset','tramitacion','origen','plataforma-tramitacion'),
             'items', coalesce(jsonb_agg(jsonb_build_object(
                        'boletin', te.boletin,
                        'titulo', p.titulo,
                        'descripcion', te.descripcion,
                        'fecha', te.fecha::date,
                        'enlace', p.enlace,
                        'enlace_evento', te.enlace,
                        'en_corpus', (p.boletin is not null)
                      ) order by te.fecha desc), '[]'::jsonb)
           ),
           'tramitacion', 'plataforma-tramitacion', now()
      from public.tramitacion_evento te
      left join public.proyecto p on p.boletin = te.boletin
     where te.tipo = 'urgencia'
       and te.fecha <= current_date                                   -- D1
       and te.fecha >= current_date - interval '30 days'
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
  -- (dia-calendario.ts LOCKED): comparar `fecha::date >= current_date` SIN conversión de zona horaria.
  -- Corte de cámara declarado vía grafia_camara (misma expresión en select y group by).
  -- WR-05 (falso negativo por captura stale): la DECISIÓN se basa en la PRESENCIA de filas
  --   FUTURAS, NO en max(fecha PASADA). Una citación futura real ya en la DB es un hecho
  --   ("coming up") aunque la fuente no se haya re-ingerido hace >7 días — v_cita_max mide
  --   el máximo evento PASADO y quedaría stale falsamente. Por eso el `if exists (futuras)`
  --   domina la decisión: si hay futuras → filas positivas SIEMPRE. Solo cuando NO hay
  --   futuras se distingue "fuente stale" (no re-ingerida) de "sin próximas" (hecho legítimo).
  -- Unidad de la evidencia = la CITACIÓN (mismo conteo que `conteo`). `puntos` va anidado vía
  -- sub-select correlacionado (Pitfall 5: un join plano contra citacion_punto multiplicaría el
  -- count(*)). Orden externo `order by c.fecha` ASCENDENTE: D-01 fija `desc` como orden de
  -- presentación para hechos PASADOS; en agenda FUTURA la presentación correcta es "lo más
  -- próximo primero" — no es un cap, van todas.
  if exists (select 1 from public.citacion where fecha::date >= current_date) then
    -- Hay citaciones futuras reales → emitir filas positivas SIEMPRE (hecho, no depende de frescura).
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia, dataset, origen, fecha_captura)
    select 'agenda_citacion', 'futuras', count(*),
           actualidad.grafia_camara(c.camara),
           max(c.fecha),
           jsonb_build_object('total', count(*),
             'consultado_al', current_date,
             'fuente', jsonb_build_object('dataset','agenda','origen','plataforma-agenda'),
             'items', coalesce(jsonb_agg(jsonb_build_object(
                        'fecha', c.fecha::date,
                        'comision', c.comision,
                        'horario', c.horario,
                        'enlace', c.enlace,
                        'semana_iso', c.semana_iso,
                        'puntos', (
                          select coalesce(jsonb_agg(jsonb_build_object(
                                   'boletin', cp.boletin,
                                   'titulo', p2.titulo,
                                   'materia', cp.materia,
                                   'posicion', cp.posicion,
                                   'enlace', p2.enlace,
                                   'en_corpus', (p2.boletin is not null)
                                 ) order by cp.posicion), '[]'::jsonb)
                            from public.citacion_punto cp
                            left join public.proyecto p2 on p2.boletin = cp.boletin
                           where cp.citacion_id = c.id and cp.boletin is not null
                        )
                      ) order by c.fecha), '[]'::jsonb)
           ),
           'agenda', 'plataforma-agenda', now()
      from public.citacion c
     where c.fecha::date >= current_date                             -- tz Chile date-only (Pitfall 6)
     group by actualidad.grafia_camara(c.camara);                    -- D2/D3, misma expresión que el select
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
  -- `sesion_sala` es el nombre real de la tabla (0010_agenda.sql L59), NO sesion_tabla_item.
  -- `fecha` es date-only-midnight-UTC = día chileno (sin tz). D-02b: la unidad es la SESIÓN
  -- (0065:260-265 cuenta sesion_sala) — los ítems de `sesion_tabla_item` van ANIDADOS en
  -- `tabla`, nunca como ítems de primer nivel (si fueran de primer nivel se rompería la
  -- paridad D-06: 19 ítems vs 1-2 sesiones). PROHIBIDO fabricar `urgencia`:
  -- `sesion_tabla_item` no la tiene (D-02 enmendado) — se emite `quorum`/`parte_sesion`, que es
  -- lo que la fuente trae. `numero`/`hora_inicio`/`tipo` van tal cual y serán NULL en la fila
  -- sintética `camara:sesion:2026-W31` — no inventarlos. Orden externo `order by s.fecha`
  -- ascendente (misma justificación que el bloque 4: agenda futura, más próximo primero).
  if exists (select 1 from public.sesion_sala where fecha::date >= current_date) then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia, dataset, origen, fecha_captura)
    select 'agenda_sala', 'futuras', count(*),
           actualidad.grafia_camara(s.camara),
           max(s.fecha),
           jsonb_build_object('total', count(*),
             'consultado_al', current_date,
             'fuente', jsonb_build_object('dataset','agenda','origen','plataforma-agenda'),
             'items', coalesce(jsonb_agg(jsonb_build_object(
                        'fecha', s.fecha::date,
                        'numero', s.numero,
                        'hora_inicio', s.hora_inicio,
                        'tipo', s.tipo,
                        'enlace', s.enlace,
                        'tabla', (
                          select coalesce(jsonb_agg(jsonb_build_object(
                                   'boletin', sti.boletin,
                                   'titulo', p3.titulo,
                                   'materia', sti.materia,
                                   'posicion', sti.posicion,
                                   'quorum', sti.quorum,
                                   'parte_sesion', sti.parte_sesion,
                                   'enlace', p3.enlace,
                                   'en_corpus', (p3.boletin is not null)
                                 ) order by sti.posicion), '[]'::jsonb)
                            from public.sesion_tabla_item sti
                            left join public.proyecto p3 on p3.boletin = sti.boletin
                           where sti.sesion_id = s.id and sti.boletin is not null
                        )
                      ) order by s.fecha), '[]'::jsonb)
           ),
           'agenda', 'plataforma-agenda', now()
      from public.sesion_sala s
     where s.fecha::date >= current_date                             -- tz Chile date-only
     group by actualidad.grafia_camara(s.camara);
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
  -- Ítem: descripcion literal de la fuente (no derivar un "grado" tipificado aquí, igual
  -- razonamiento que urgencias/Fable blocker 3).
  if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
    insert into public.actualidad_senal
      (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia, dataset, origen, fecha_captura)
    select 'archivados', '30d', count(*), null, max(te.fecha),
           jsonb_build_object('total', count(*),
             'consultado_al', current_date,
             'fuente', jsonb_build_object('dataset','tramitacion','origen','plataforma-tramitacion'),
             'items', coalesce(jsonb_agg(jsonb_build_object(
                        'boletin', te.boletin,
                        'titulo', p.titulo,
                        'descripcion', te.descripcion,
                        'fecha', te.fecha::date,
                        'enlace', p.enlace,
                        'enlace_evento', te.enlace,
                        'en_corpus', (p.boletin is not null)
                      ) order by te.fecha desc), '[]'::jsonb)
           ),
           'tramitacion', 'plataforma-tramitacion', now()
      from public.tramitacion_evento te
      left join public.proyecto p on p.boletin = te.boletin
     where te.fecha <= current_date                                   -- D1
       and te.fecha >= current_date - interval '30 days'
       and (te.descripcion ilike '%archiv%' or te.descripcion ilike '%retira%')
       and te.descripcion not ilike '%desarchiv%'                     -- invierte el sentido
       and te.descripcion not ilike '%retira y hace presente%'        -- invierte el sentido
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
