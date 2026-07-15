-- 0052_cruce_senal_lobby_sector_aporte.sql
-- CRUCE / DINERO (MONEY-03) — extiende el materializador de cruces (0039) con la señal
-- `lobby_sector_aporte` como STUB ESTRUCTURAL correcto-por-construcción. Migración ADITIVA:
--   Bloque 1 — amplía el CHECK de `cruce_senal.tipo_senal` de ('lobby_sector') a
--              ('lobby_sector', 'lobby_sector_aporte') vía drop+add del constraint.
--   Bloque 2 — `create or replace function cruces.materializar_cruces()` re-emitiendo el
--              cuerpo COMPLETO: el mismo FULL REBUILD (`delete from public.cruce_senal;` —
--              ÚNICO delete), la rama `lobby_sector` de 0039 CONSERVADA BYTE-IDÉNTICA, y a
--              continuación la NUEVA rama `lobby_sector_aporte`.
--
-- La última migración APLICADA/en disco es 0051. Esta es la 0052.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 5): build/typecheck NO prueban que Postgres
-- ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0052_cruce_senal_lobby_sector_aporte.test.sql) corriendo contra un schema APLICADO.
-- Aplicar por `psql --db-url` DIRECTO con `--single-transaction`, NUNCA `supabase db push`
-- (el `schema_migrations` remoto tiene drift → `db push` re-aplicaría/saltaría migraciones).
-- El BOM UTF-8 en `.env` rompe el CLI → extraer `SUPABASE_DB_URL` esquivando el BOM y pasar
-- `--db-url` explícito; `PGCLIENTENCODING=UTF8`. La aplicación al remoto PROD vive en el
-- Plan 02 (operador, autonomous:false) — este plan es offline-válido (se escribe y valida).
--
-- ── DISEÑO CORREGIDO (operador 2026-07-14) — LEER ANTES DE EDITAR ─────────────────
-- La señal `lobby_sector_aporte` es un STUB ESTRUCTURAL correcto-por-construcción: un cruce
-- dinero×sector keyed por el RUT de la EMPRESA contratista (ENTIDAD COMPARTIDA), NO por
-- `parlamentario_id`. La arista `<company-rut → sector>` NO EXISTE hoy en el schema (ni
-- `contratista`, ni `contrato`, ni `entidad_tercero` tienen columna de sector; `sector_id`
-- vive SOLO en proyecto_ficha/lobby_contraparte/donante — ver 0038). Por eso la rama se une
-- contra esa arista AUSENTE y rinde 0 filas HONESTAS (correcto-por-construcción, NO un fake).
--
-- PROHIBIDO puentear dinero×lobby por `parlamentario_id` común (contratos del parlamentario ×
-- los sectores de SUS PROPIAS lobby-contrapartes): esa yuxtaposición persona-nivel es la
-- "máquina de sospechas" diferida — RECHAZADA. El puente sector↔dinero es y solo es el RUT de
-- la EMPRESA; `parlamentario_id` en la rama aporte SOLO restringe el universo a contratos ya
-- ligados por RUT-exacto (Phase 70 confirmado), NUNCA es el bridge.
--
-- RINDE 0 FILAS HOY por DOS razones honestas independientes: (a) la arista empresa→sector no
-- existe (razón estructural, correcto-por-construcción), y (b) RUT-01 a 0% + backfill
-- ChileCompra pendiente (razón de datos). Es CORRECTO por requisito, no un bug. SERVEL
-- (aportes por nombre, SIN RUT) queda FUERA de esta señal (fail-closed "RUT presente").
--
-- DOBLE CANDADO heredado (esta migración NO añade policies ni grants): Candado A = RLS
-- deny-by-default sobre `cruce_senal` (0039) + RPC 0040 sin grant a anon. Candado B = gate de
-- presentación `moneyPublicEnabled()`/`crucesPublicEnabled()` — MONEY OFF. El flip legal es
-- acto humano de Phase 73. El cron `cruces-materializar` (0039) y el RPC 0040 (genérico por
-- `tipo_senal`) HEREDAN automáticamente el nuevo token: NO se re-emiten aquí.
--
-- NO-PII (LEGAL-03, Ley 21.719): el cuerpo del proc NO referencia el token `partido` ni el
-- token `rut` bajo el aserto pgTAP `\y(partido|rut)\y` de 0039. El RUT de la empresa se
-- referencia SOLO como `rut_proveedor` (el `_` tras `rut` rompe el límite de palabra → NO
-- trip `\yrut\y`). La evidencia jsonb lleva SOLO enlaces de fuente + campos públicos de la
-- fila de hecho (codigo_orden/monto_verbatim/enlace/fecha); NUNCA rut ni donante_id.
-- SIN lenguaje causal (frases que insinúen intención o contraprestación entre dinero y voto)
-- en ninguna parte: la señal es un conteo factual con enlaces, nunca una insinuación.

-- ── Bloque 1 — ampliar el CHECK allow-list del token de señal ────────────────────
-- Pitfall A1: el CHECK inline SIN nombre de 0039:50 es nombrado por convención Postgres
-- `cruce_senal_tipo_senal_check`. Si un forward-fix lo renombró, el operador lo verifica con
--   select conname from pg_constraint
--   where conrelid = 'public.cruce_senal'::regclass and contype = 'c';
-- ANTES del drop (Plan 02). Aditivo: solo AÑADE 'lobby_sector_aporte' al allow-list.
alter table public.cruce_senal drop constraint cruce_senal_tipo_senal_check;
alter table public.cruce_senal
  add constraint cruce_senal_tipo_senal_check
  check (tipo_senal in ('lobby_sector', 'lobby_sector_aporte'));

-- ── Bloque 2 — re-emitir cruces.materializar_cruces() (FULL REBUILD + rama nueva) ─
-- `create or replace`: el cron `cruces-materializar` (0039) sigue invocando esta MISMA firma
-- → hereda la rama nueva sin re-programarse. security definer set search_path = '' VERBATIM
-- de 0039 (lee lobby_audiencia/lobby_contraparte/contrato/contratista deny-by-default y
-- escribe cruce_senal). Todos los nombres calificados con schema (public./cruces.).
create or replace function cruces.materializar_cruces()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- FULL REBUILD transaccional (D-11): ÚNICO delete. Borra el estado previo y reconstruye
  -- desde los hechos. NO añadir un segundo delete: dropear la rama lobby vaciaría la señal.
  delete from public.cruce_senal;

  -- ══ Rama lobby_sector (CONSERVADA BYTE-IDÉNTICA de 0039:91-120) ══════════════════
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

  -- ══ Rama lobby_sector_aporte (STUB ESTRUCTURAL empresa-RUT→sector, MONEY-03) ═════
  -- Cruce de ENTIDAD-COMPARTIDA: cuenta los contratos de EMPRESAS de un sector ligadas al
  -- parlamentario (con enlaces de fuente). El puente sector↔dinero es el RUT de la EMPRESA
  -- contratista (contrato.rut_proveedor → contratista.rut_proveedor → sector DE ESA EMPRESA),
  -- NUNCA el `parlamentario_id` común entre dinero y lobby (esa yuxtaposición persona-nivel
  -- es la "máquina de sospechas" diferida — RECHAZADA; por eso lobby_audiencia/lobby_contraparte
  -- NO aparecen en esta rama). Aquí `parlamentario_id` SOLO acota el universo a contratos ya
  -- ligados por RUT-exacto (Phase 70 confirmado) — NO es el bridge.
  --
  -- ARISTA FALTANTE <company-rut → sector>: LA SUSTANCIA DIFERIDA DE MONEY-03. HOY NINGUNA
  -- TABLA DE DINERO/ENTIDAD TIENE UN sector_id CLASIFICADO POR EMPRESA (verificado contra
  -- 0023/0025/0034/0038). LA CTE `empresa_sector` MODELA ESA ARISTA COMO RELACIÓN
  -- HONESTA-VACÍA (where false → 0 filas, tipos correctos). CUANDO EXISTA UN sector CLASIFICADO
  -- POR EMPRESA (columna sector_id en contratista/entidad_tercero + su clasificador), REEMPLAZAR
  -- EL CUERPO DE ESTA CTE POR EL MAPEO REAL; HASTA ENTONCES LA SEÑAL ES VACÍA HONESTA POR
  -- CONSTRUCCIÓN. El join a esta CTE garantiza 0 filas materializadas hoy.
  with empresa_sector as (
    -- tipos correctos, 0 filas correcto-por-construcción (arista ausente).
    select
      ct2.rut_proveedor as rut_empresa,
      null::text        as sector_id
    from public.contratista ct2
    where false
  )
  insert into public.cruce_senal
    (parlamentario_id, sector_id, tipo_senal, conteo, evidencia,
     dataset, origen, fecha_captura, enlace)
  select
    ct.parlamentario_id,
    es.sector_id,
    'lobby_sector_aporte',
    count(*),
    jsonb_build_object(
      'conteo', count(*),
      'items', jsonb_agg(
        jsonb_build_object(
          'tipo', 'contrato',
          'fecha', ct.fecha_oc,
          'monto_verbatim', ct.monto,          -- text VERBATIM (D: nunca sumar/castear)
          'codigo_orden', ct.codigo_orden,
          'enlace_fuente', ct.enlace
        ) order by ct.fecha_oc desc nulls last
      )
    ),
    'chilecompra',
    min(ct.origen),
    now(),
    min(ct.enlace)
  -- entidad-compartida por RUT de la EMPRESA: contrato ⨝ contratista por rut_proveedor,
  -- luego ⨝ empresa_sector (la arista ausente) por el mismo RUT de la empresa.
  from public.contrato ct
  join public.contratista cta on cta.rut_proveedor = ct.rut_proveedor
  join empresa_sector es       on es.rut_empresa   = cta.rut_proveedor
  where ct.estado_vinculo = 'confirmado'         -- fail-closed (IDENT-12, espejo de 0049)
    and ct.parlamentario_id is not null          -- solo contratos ya ligados (acota universo)
    and es.sector_id is not null                 -- sin catch-all (0038 D-05): NULL no entra
  group by ct.parlamentario_id, es.sector_id;
end;
$$;

-- NOTA: el bloque `cron.schedule` de 0039 (job 'cruces-materializar') NO se re-emite — el
-- `create or replace` de arriba basta para que el job existente ejecute la rama nueva.
-- NO se añaden policies ni grants sobre `cruce_senal` (deny-by-default heredado, V4 ASVS).
-- El RPC 0040 (`cruces_de_parlamentario`) es genérico por `tipo_senal` → hereda el token
-- automáticamente; NO se toca aquí.
