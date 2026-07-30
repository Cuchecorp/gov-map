-- 0081_actualidad_evidencia_fix.sql
-- ADITIVA. Cierra los hallazgos del code-review de la Phase 127 sobre 0080 (que ya está APLICADA
-- a PROD e INTOCABLE): `create or replace` de `actualidad.grafia_camara(text)` y de
-- `actualidad.materializar_senales()`. CERO DDL de tabla, CERO RPC, CERO grant/revoke, CERO
-- cambio de firma (misma prohibición de ACL de D-09 que rigió 0080).
--
-- La última migración APLICADA es 0080. Esta es la 0081. `0073`/`0075` están ESCRITAS y NO
-- aplicadas — JAMÁS se editan ni se reordenan.
--
-- Hallazgos cerrados aquí:
--
-- CR-01 — `grafia_camara` podía PARTIR EN DOS el conteo de una misma cámara (defecto clase B-01).
--   La whitelist de 0080 comparaba contra un conjunto CERRADO sin acentos completos
--   ('camaradediputados' sí, 'cámaradediputados' NO) ⇒ cualquier variante decorada o de otra caja
--   ('CÁMARA DE DIPUTADOS', 'H. Cámara de Diputados', 'C. de Diputados') caía al `else` y se
--   convertía en un bucket propio de `cobertura_camara`; como `velocity`/`agenda_*` agrupan por
--   esta función, la misma cámara se repartía en DOS filas de `actualidad_senal` y el panel de 128
--   habría mostrado un N menor que la realidad, con dos filas compitiendo — exactamente el defecto
--   B-01 de v12.0. Agravante: el `else` no hacía `btrim`, así que ' Senado ' y 'Senado ' eran
--   buckets distintos entre sí.
--   FIX: normalización robusta para COMPARAR (colapso de espacios + strip de acentos vía
--   `translate` + `lower`) y match por SUBSTRING ('diputad' / 'senado') en vez de whitelist
--   cerrada. La rama `else` conserva el valor de la fuente (JAMÁS descartar) pero SIEMPRE
--   trimmeado y con espacios colapsados, de modo que la decoración de whitespace no fabrique
--   buckets. La función sigue `immutable` (solo funciones de pg_catalog, sin acceso a tablas) y
--   sigue SIN `set search_path` (bloquearía el inlining; no hay nombres calificables en el cuerpo).
--
-- CR-02 — los sub-selects anidados de `puntos`/`tabla` recortaban la lista en silencio.
--   0080 filtraba `where cp.boletin is not null` / `sti.boletin is not null`. Ambas columnas son
--   NULLABLE POR DISEÑO (0010_agenda.sql:45-56, :72-88): los puntos de tabla que son materia sin
--   boletín (nombramientos, cuentas, proyectos que la fuente no boletinó) DESAPARECÍAN del jsonb
--   sin dejar rastro — una lista incompleta presentada como completa. Ese `is not null` es un
--   inner join disfrazado a nivel anidado, justo lo que el guard 404 (D-05) prohíbe.
--   DECISIÓN (documentada aquí, como pide el review): se emiten TODOS los ítems, sin filtro. El
--   ítem sin boletín viaja con `boletin: null`, `titulo`/`enlace` null y `en_corpus: false` — la
--   misma forma que ya tiene el ítem fuera-de-corpus, así que la UI de 128 no necesita un tercer
--   caso. Es la opción coherente con:
--     * D-05 ("el ítem se emite SIEMPRE con `en_corpus`; JAMÁS inner join"),
--     * D-06 (la paridad se mide en el nivel SUPERIOR — la unidad es la citación / la sesión — y
--       por tanto emitir más ítems anidados NO la altera), y
--     * la honestidad "N de M" de 128: para que 128 pueda decir "N de M enlazables" necesita el
--       denominador REAL, que es justamente lo que el filtro destruía.
--   Además se añade un `puntos_total` / `tabla_total` anidado por citación/sesión: el total es
--   redundante hoy (== length del array, porque ya no hay recorte) pero lo hace VERIFICABLE por
--   assert y deja el contrato listo si algún día hubiera que cappear por tamaño de payload (D-03:
--   si se cappea, el `total` real va declarado aparte).
--
-- WR-03 — el proc dependía de la zona horaria de la SESIÓN que lo invoca.
--   0080 fijaba `search_path = ''` pero NO `timezone`. `citacion.fecha` y `sesion_sala.fecha` son
--   `timestamptz` con valor date-only-midnight-UTC (regla LOCKED: la parte fecha UTC ES el día
--   chileno, jamás convertir tz). `fecha::date` y `current_date` se resolvían con el `TimeZone` del
--   caller: bajo pg_cron (UTC) correcto, pero bajo un `psql` de operador con TimeZone=America/
--   Santiago una citación de mañana 00:00Z se leía como HOY y el `'fecha'` de cada ítem salía con
--   un día menos. La mitigación de 0080 era una nota en prosa (M3: "no correr el proc a mano entre
--   00:00-04:00 UTC") — un control humano donde cabe un `SET`.
--   FIX: `set timezone = 'UTC'` en la definición del proc. El `SET` por función anula el de la
--   sesión y se restaura al salir ⇒ cierra el agujero para cron, psql y cualquier invocación
--   futura, y HORNEA la semántica date-only que el proyecto ya asume. La nota M3 de 0080 queda
--   OBSOLETA: el proc ya se puede correr a mano a cualquier hora.
--
-- WR-04 — `delete` + `insert` sin aislamiento: dos corridas solapadas abortaban con `23505`.
--   Bajo READ COMMITTED, si B empieza mientras A está en vuelo, el DELETE de B no ve las filas que
--   A insertó después de su snapshot y las deja vivas; cuando A commitea y B llega a su INSERT,
--   choca contra `unique (tipo_senal, cobertura_camara, ventana, cluster_id)` (0065:69) y la
--   corrida ENTERA de B se pierde. No es teórico: el cron dispara 4×/día y el régimen incluye
--   materializaciones manuales de operador.
--   FIX: `pg_advisory_xact_lock` (BLOQUEANTE, no `try_`) al inicio del proc. Se eligió el
--   bloqueante sobre el `try_ + return` que sugería el review porque una invocación OMITIDA es una
--   materialización silenciosamente saltada — el bloqueante SERIALIZA (la segunda corrida espera y
--   luego reconstruye), que es el comportamiento honesto para un full-rebuild idempotente. El lock
--   es `xact`: se libera solo al COMMIT/ROLLBACK, sin necesidad de unlock explícito ni de manejo
--   de excepciones.
--
-- WR-05 — el guard 404 es estructuralmente inerte en los 4 bloques de tramitación. PROSA
--   CORREGIDA (el código se mantiene: el left join es correcto y barato). `tramitacion_evento.
--   boletin` es `not null references proyecto(boletin)` (0008_tramitacion.sql:69) y
--   `proyecto.titulo`/`.enlace` son `not null` ⇒ en velocity/nuevos_ingresos/urgencias/archivados
--   `en_corpus` NO PUEDE ser falso jamás: ahí el guard es una tautología que la FK ya garantiza, no
--   una cobertura. El guard 404 con EFECTO REAL vive SOLO en los sub-selects anidados
--   (`citacion_punto` / `sesion_tabla_item`, nullable y SIN foreign key). La cabecera de 0080
--   (:20-22) vendía cobertura universal; esta es la lectura correcta y la que 128 debe asumir si
--   usa `en_corpus` como criterio de "enlazable".
--
-- IN-02 — la columna `enlace` de `actualidad_senal` (0065:67, nullable) queda DELIBERADAMENTE
--   vacía a nivel de fila: la trazabilidad de esta señal es PER-ÍTEM (cada ítem del jsonb lleva su
--   `enlace` de ficha y, cuando aplica, su `enlace_evento`). No hay un "enlace de portada" honesto
--   para una señal que agrega N hechos de N fuentes distintas; poblarla con uno sería elegir
--   arbitrariamente un sujeto. La RPC 0066 puede re-emitirla siempre NULL sin que eso sea un bug.
--
-- IN-03 — orden no determinista en empates dentro de `jsonb_agg`. Las fechas son date-only ⇒
--   `order by te.fecha desc` deja los empates (que son muchos) a merced del plan: el mismo dato
--   podía renderizarse en orden distinto entre corridas del cron. FIX: desempate por clave estable
--   en los 6 aggs (`, te.boletin, te.id` / `, c.id` / `, s.id` / `, cp.id` / `, sti.id`).
--
-- NO se cierran aquí (deliberado):
--   IN-04 (`grafia_camara` con EXECUTE a PUBLIC): un `revoke` SERÍA el cambio de ACL que D-09
--   prohíbe, y esta migración no toca ACLs por ningún otro motivo. Riesgo ≈ 0 (el schema
--   `actualidad` no concede USAGE a anon/authenticated y la función es pura). Queda como deuda de
--   higiene para la primera migración que sí tenga que tocar ACLs.
--   IN-01 (numeración de comentarios del pgTAP): es del archivo de test, se corrige ahí.
--
-- D-12: el bloque `cron.schedule` de `0065:312-342` NO se re-emite. `cron.schedule` guarda el
-- TEXTO SQL `select actualidad.materializar_senales();`, resuelto por NOMBRE en cada corrida — el
-- REPLACE del proc es transparente para el job ya programado.
--
-- D-09b (riesgo de `create or replace`): REPLACE preserva `proowner` y `proacl` del proc secdef
-- pero NO preserva los `SET` de la definición ⇒ este archivo restatea LITERALMENTE
-- `security definer set search_path = ''` (y ahora también `set timezone = 'UTC'`). Omitirlo
-- reabriría el vector de inyección de search_path (V8) contra un proc security definer.
--
-- Aplicación (D-10) — igual que 0065/0080, NUNCA `supabase db push` (drift de schema_migrations):
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0081_actualidad_evidencia_fix.sql

-- ── grafia_camara (PANEL-06/D-07) — single-source de la grafía ciudadana de cámara ──
-- CR-01: la normalización de COMPARACIÓN colapsa espacios, hace strip de acentos y baja a
-- minúsculas; el match es por SUBSTRING, no por whitelist cerrada, para que ninguna variante
-- decorada de la fuente fabrique un bucket propio. La rama `else` conserva el valor de fuente
-- (nunca descartar) pero normalizado en whitespace.
-- `immutable`: solo referencia funciones de pg_catalog (siempre resolubles) y no toca ninguna
-- tabla — indexable/inlineable por el planner. NO se le pone `set search_path`: eso bloquearía el
-- inlining y aquí no hace falta (sin nombres calificables de otros schemas dentro del cuerpo).
create or replace function actualidad.grafia_camara(p_camara text)
returns text language sql immutable as $$
  with n as (
    select
      -- clave de comparación: sin espacios, sin acentos, minúscula
      lower(translate(regexp_replace(coalesce(p_camara, ''), '\s+', '', 'g'),
                      'áéíóúüñÁÉÍÓÚÜÑ', 'aeiounAEIOUN')) as k,
      -- valor de salida del fallback: espacios colapsados y trimmeado (CR-01, agravante)
      btrim(regexp_replace(coalesce(p_camara, ''), '\s+', ' ', 'g')) as raw
  )
  select case
    when n.raw = ''        then '(sin cámara)'                       -- D-08 (cubre NULL vía coalesce)
    when n.k like '%diputad%' then 'Cámara de Diputados'             -- c.diputados, cámaradediputados, h.cámaradediputados, c.dediputados…
    when n.k = 'camara'    then 'Cámara de Diputados'                -- 'camara' a secas = la Cámara (grafía histórica de la fuente)
    when n.k like '%senado%'  then 'Senado'
    else n.raw                                                       -- nunca descartar, pero SIEMPRE trimmeado
  end
  from n;
$$;

-- ── actualidad.materializar_senales() (proc FULL REBUILD, invocado por pg_cron) ─
-- security definer: corre como owner para leer tramitacion_evento/citacion/sesion_sala
-- (público-read pero el proc no depende del rol del caller) y escribir actualidad_senal
-- (deny-by-default). set search_path = '' (V8): nombres calificados con schema.
-- set timezone = 'UTC' (WR-03): hornea la semántica date-only del proyecto — `fecha::date` y
-- `current_date` dejan de depender del TimeZone de la sesión que invoca.
-- El cuerpo lee SOLO tablas no-PII (tramitacion_evento/citacion/sesion_sala/proyecto);
-- NUNCA referencia tablas ni columnas de identidad/afiliación política de personas (el pgTAP
-- muerde el cuerpo del proc para asegurar la ausencia de esa superficie).
create or replace function actualidad.materializar_senales()
returns void language plpgsql security definer
  set search_path = ''
  set timezone = 'UTC'
as $$
declare
  -- Umbral de frescura HARDCODEADO (Open Question A5). SQL no puede leer TypeScript → el valor
  -- se replica aquí. Si catalog.ts cambia el NÚMERO, actualizar esta constante (deriva
  -- documentada en el SUMMARY 99-01).
  --
  -- PROVENANCE HONESTA (solo el NÚMERO se comparte, NO la semántica):
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
  -- WR-04 — AISLAMIENTO: serializa las corridas solapadas (cron 4×/día + corridas manuales de
  -- operador). Sin este lock, el DELETE de la corrida B no ve las filas que A insertó tras su
  -- snapshot (READ COMMITTED) y el INSERT de B choca contra la unique key → 23505 → corrida
  -- entera perdida. Lock BLOQUEANTE (no `try_`): una invocación omitida sería una materialización
  -- silenciosamente saltada; el full rebuild es idempotente, así que esperar y reconstruir es el
  -- comportamiento honesto. `xact` ⇒ se libera solo en COMMIT/ROLLBACK, sin unlock explícito.
  perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext('actualidad.materializar_senales')::bigint);

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
  -- WR-05: aquí `en_corpus` es TAUTOLÓGICAMENTE true (te.boletin es NOT NULL con FK a proyecto);
  -- se conserva el left join por uniformidad y baratura, pero el guard 404 con efecto real vive
  -- solo en los sub-selects anidados de agenda.
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
                      ) order by te.fecha desc, te.boletin, te.id), '[]'::jsonb)  -- IN-03: desempate estable
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
                      ) order by pe.primer desc, pe.boletin), '[]'::jsonb)          -- IN-03: desempate estable
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
  -- dato. Coherente con el mismo campo en archivados. Los ~95 eventos van completos: cero
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
                      ) order by te.fecha desc, te.boletin, te.id), '[]'::jsonb)  -- IN-03: desempate estable
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
  -- (dia-calendario.ts LOCKED): comparar `fecha::date >= current_date` SIN conversión de zona
  -- horaria — y ahora con `timezone = 'UTC'` fijado en el proc (WR-03), sin depender del caller.
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
  -- CR-02: el sub-select ya NO filtra `cp.boletin is not null`. Van TODOS los puntos del orden
  -- del día; el punto sin boletín (materia sin boletinar, nombramiento, cuenta) viaja con
  -- boletin/titulo/enlace null y en_corpus:false. `puntos_total` declara el total del sub-select
  -- para que 128 pueda decir "N de M enlazables" con el denominador REAL.
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
                        'puntos_total', (
                          select count(*) from public.citacion_punto cpt
                           where cpt.citacion_id = c.id
                        ),
                        'puntos', (
                          select coalesce(jsonb_agg(jsonb_build_object(
                                   'boletin', cp.boletin,
                                   'titulo', p2.titulo,
                                   'materia', cp.materia,
                                   'posicion', cp.posicion,
                                   'enlace', p2.enlace,
                                   'en_corpus', (p2.boletin is not null)
                                 ) order by cp.posicion, cp.id), '[]'::jsonb)   -- IN-03: desempate estable
                            from public.citacion_punto cp
                            left join public.proyecto p2 on p2.boletin = cp.boletin
                           where cp.citacion_id = c.id                          -- CR-02: SIN `is not null`
                        )
                      ) order by c.fecha, c.id), '[]'::jsonb)                   -- IN-03: desempate estable
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
  -- CR-02: el sub-select ya NO filtra `sti.boletin is not null` — van TODOS los ítems de la
  -- tabla de la sesión, con `tabla_total` declarando el denominador real.
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
                        'tabla_total', (
                          select count(*) from public.sesion_tabla_item stt
                           where stt.sesion_id = s.id
                        ),
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
                                 ) order by sti.posicion, sti.id), '[]'::jsonb)  -- IN-03: desempate estable
                            from public.sesion_tabla_item sti
                            left join public.proyecto p3 on p3.boletin = sti.boletin
                           where sti.sesion_id = s.id                            -- CR-02: SIN `is not null`
                        )
                      ) order by s.fecha, s.id), '[]'::jsonb)                    -- IN-03: desempate estable
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
                      ) order by te.fecha desc, te.boletin, te.id), '[]'::jsonb)  -- IN-03: desempate estable
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
