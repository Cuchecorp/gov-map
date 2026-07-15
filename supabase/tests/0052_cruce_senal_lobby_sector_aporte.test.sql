-- 0052_cruce_senal_lobby_sector_aporte.test.sql
-- Verifica la migración 0052 (extiende cruces.materializar_cruces con la señal
-- `lobby_sector_aporte` como STUB ESTRUCTURAL) CONTRA UN SCHEMA APLICADO:
--   * el CHECK ampliado ADMITE el token 'lobby_sector_aporte' (insert directo NO viola 23514),
--   * la rama `lobby_sector_aporte` del materializador rinde 0 filas HONESTAS
--     correcto-por-construcción (la arista empresa→sector NO existe → CTE empresa_sector
--     vacía) AUNQUE haya un contrato confirmado sembrado — comportamiento ESPERADO, no fallo,
--   * la señal `lobby_sector` existente NO se perdió tras el FULL REBUILD (>=5 parlamentarios),
--   * el cuerpo de `materializar_cruces` sigue SIN partido/rut tras la extensión (no-PII,
--     LEGAL-03) — `rut_proveedor` NO trip el guard `\y(partido|rut)\y`,
--   * la evidencia de `lobby_sector_aporte` es PII-safe (sin rut ni donante_id),
--   * anon sigue SIN leer `cruce_senal` (deny-by-default intacto → 42501).
--
-- Corre vía `psql -tA -f` (vs schema APLICADO) (pgTAP). build/typecheck NO prueban que el DDL
-- se aplicó (falso positivo de CI, Pitfall 5). Espeja 0039_cruce_senal.test.sql. Requiere
-- 0023/0025/0038/0039 aplicadas (contrato/contratista + rut_proveedor + catálogo sector +
-- cruce_senal/materializar_cruces). NO vive en el glob de vitest (la suite globea .test.{ts,tsx});
-- lo corre el OPERADOR el día del apply. La APLICACIÓN a PROD + la corrida real = Plan 02.
--
-- NOTA RECTORA (stub estructural): la CTE `empresa_sector` de la migración es HONESTA-VACÍA
-- HOY (no hay columna de sector en la empresa) → la rama aporte rinde 0 filas
-- correcto-por-construcción AUNQUE el contrato confirmado esté sembrado. El test NO fuerza
-- filas de aporte poblando una columna de sector que no existe; codifica el vacío honesto
-- como el aserto rector (aserto 3).

begin;
-- 7 aserciones reales en este archivo (conteo exacto, sin off-by-one).
select plan(7);

-- ── Semilla (owner, bypassa RLS) ──────────────────────────────────────────────
-- (A) Lobby VERBATIM de 0039: cinco parlamentarios con audiencia confirmada + contraparte
--     clasificada en sector → CONSERVA el aserto lobby_sector >=5 tras el rebuild. El
--     partido/rut se siembran en la maestra para PROBAR que el materializador NO los toca.
insert into parlamentario
  (id, nombre_normalizado, nombres, apellido_paterno, camara, periodo, origen, enlace, partido, rut)
values
  ('CR1', 'cruce uno',   'Ana',   'Uno',    'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto A', '11.111.111-1'),
  ('CR2', 'cruce dos',   'Beto',  'Dos',    'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto B', '22.222.222-2'),
  ('CR3', 'cruce tres',  'Carla', 'Tres',   'senado',    '2022-2026', 'senado', 'http://x', 'Partido Secreto C', '33.333.333-3'),
  ('CR4', 'cruce cuatro','Dani',  'Cuatro', 'senado',    '2022-2026', 'senado', 'http://x', 'Partido Secreto D', '44.444.444-4'),
  ('CR5', 'cruce cinco', 'Edu',   'Cinco',  'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto E', '55.555.555-5');

insert into lobby_audiencia
  (identificador, institucion_codigo, parlamentario_id, mencion_sujeto, estado_vinculo, fecha, origen, enlace)
values
  ('AUD-CR1', 'INST', 'CR1', 'Ana Uno',     'confirmado', '2024-01-10', 'lobby', 'http://lobby/1'),
  ('AUD-CR2', 'INST', 'CR2', 'Beto Dos',    'confirmado', '2024-02-20', 'lobby', 'http://lobby/2'),
  ('AUD-CR3', 'INST', 'CR3', 'Carla Tres',  'confirmado', '2024-03-05', 'lobby', 'http://lobby/3'),
  ('AUD-CR4', 'INST', 'CR4', 'Dani Cuatro', 'confirmado', '2024-04-15', 'lobby', 'http://lobby/4'),
  ('AUD-CR5', 'INST', 'CR5', 'Edu Cinco',   'confirmado', '2024-05-25', 'lobby', 'http://lobby/5');

insert into lobby_contraparte (identificador, nombre, rol, origen, enlace, sector_id)
values
  ('AUD-CR1', 'Gestor Salud SpA',      'lobbista', 'lobby', 'http://lobby/1', 'salud'),
  ('AUD-CR2', 'Minera del Norte',      'lobbista', 'lobby', 'http://lobby/2', 'mineria_energia'),
  ('AUD-CR3', 'Banco Central de Lobby','lobbista', 'lobby', 'http://lobby/3', 'banca_finanzas'),
  ('AUD-CR4', 'TransLogística Ltda',   'lobbista', 'lobby', 'http://lobby/4', 'transporte'),
  ('AUD-CR5', 'EduTech Chile',         'lobbista', 'lobby', 'http://lobby/5', 'educacion');

-- (B) Dinero de la EMPRESA para ejercer la rama aporte y su vacío honesto. Un contratista con
--     rut_proveedor + un contrato CONFIRMADO ligado a CR1 por ese RUT, poblando todas las
--     columnas NOT NULL de contrato (fuente_id, fecha_corte, mencion_proveedor, origen, enlace)
--     + codigo_orden/fecha_oc/monto (VERBATIM string)/tipo_persona. AUNQUE este contrato
--     confirmado existe, la rama aporte rinde 0 filas porque empresa_sector es vacía (arista
--     empresa→sector ausente) — ese es el comportamiento ESPERADO (aserto 3, rector).
insert into contratista (rut_proveedor, nombre, tipo_persona, codigo_empresa, origen, enlace)
values ('76.000.000-0', 'Constructora Ejemplo SpA', 'juridica', 'CE-001', 'chilecompra', 'http://chilecompra/emp/76000000');

insert into contrato
  (fuente_id, fecha_corte, parlamentario_id, mencion_proveedor, estado_vinculo,
   codigo_orden, proveedor_nombre, tipo_persona, organismo, nombre_orden, monto, fecha_oc,
   origen, enlace, rut_proveedor)
values
  -- CONFIRMADO, ligado a CR1 por RUT-exacto de la empresa.
  ('OC-CONF-1', '2024-06-01', 'CR1', 'Constructora Ejemplo SpA', 'confirmado',
   'OC-CONF-1', 'Constructora Ejemplo SpA', 'juridica', 'Ministerio X', 'Servicio de obras',
   '$1.000.000', '2024-05-30', 'chilecompra', 'http://chilecompra/oc/OC-CONF-1', '76.000.000-0'),
  -- NO_CONFIRMADO (caso fail-closed): NUNCA debe entrar en la señal.
  ('OC-NOCONF-1', '2024-06-01', null, 'Proveedor Sin Enlace', 'no_confirmado',
   'OC-NOCONF-1', 'Proveedor Sin Enlace', 'juridica', 'Ministerio Y', 'Otro servicio',
   null, '2024-05-15', 'chilecompra', 'http://chilecompra/oc/OC-NOCONF-1', '77.000.000-K');

-- Poblar cruce_senal desde los hechos sembrados (FULL REBUILD).
select cruces.materializar_cruces();

-- ── (1) cruce_senal existe (candado deny-by-default intacto tras la extensión) ─
select has_table('public', 'cruce_senal', 'tabla cruce_senal existe');

-- ── (2) el CHECK ampliado ADMITE el token nuevo (insert directo NO viola 23514) ─
-- Este insert directo PRUEBA el CHECK; NO prueba la rama del materializador. Usa un
-- parlamentario existente (CR1) + sector del catálogo ('salud') + evidencia PII-safe.
-- (0039 rellenó la fila lobby de CR1/salud con tipo_senal='lobby_sector'; esta usa el token
--  nuevo, así que NO colisiona con el unique (parlamentario_id, sector_id, tipo_senal).)
select lives_ok(
  $$ insert into cruce_senal
       (parlamentario_id, sector_id, tipo_senal, conteo, evidencia, dataset, origen, enlace)
     values
       ('CR1', 'salud', 'lobby_sector_aporte', 0,
        jsonb_build_object('conteo', 0, 'items', jsonb_build_array()),
        'chilecompra', 'chilecompra', 'http://chilecompra/x') $$,
  'el CHECK ampliado admite tipo_senal=lobby_sector_aporte (insert directo no viola 23514)');

-- ── (3) ASERTO RECTOR — empty-honest correcto-por-construcción ────────────────
-- Tras materializar_cruces() con un contrato CONFIRMADO sembrado, el conteo de filas
-- lobby_sector_aporte MATERIALIZADAS por el proc es 0: la arista empresa→sector está vacía
-- (CTE empresa_sector `where false`). Se excluye la fila insertada a mano en (2) por su
-- `conteo=0` + evidencia vacía (el proc jamás emite conteo=0: `group by` produce >=1).
-- Predicado robusto: contar solo filas con provenance de proc (conteo > 0) → 0 esperadas.
select is(
  (select count(*)::int from cruce_senal
     where tipo_senal = 'lobby_sector_aporte' and conteo > 0),
  0,
  'la rama lobby_sector_aporte rinde 0 filas materializadas (empty-honest correcto-por-construcción: arista empresa→sector ausente)');

-- ── (4) señal lobby_sector preservada tras el rebuild (>=5 parlamentarios) ─────
select cmp_ok(
  (select count(distinct case when tipo_senal = 'lobby_sector' then parlamentario_id end)::int
     from cruce_senal),
  '>=', 5,
  'la señal lobby_sector existente sobrevive al FULL REBUILD (>=5 parlamentarios distintos)');

-- ── (5) no-PII: el cuerpo de materializar_cruces sigue SIN partido ni rut ──────
-- Se STRIPEAN los comentarios `--` antes de buscar y se exige límite de palabra (\y).
-- `rut_proveedor` NO trip el guard (el `_` tras `rut` rompe el boundary).
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cruces' and p.proname = 'materializar_cruces')
    !~* '\y(partido|rut)\y',
  'el cuerpo de materializar_cruces NO contiene partido ni rut tras la extensión (no-PII, LEGAL-03)');

-- ── (6) PII-safe: la evidencia de lobby_sector_aporte no lleva rut ni donante_id ─
-- coalesce(bool_and(...), true): sobre conjunto vacío (0 filas materializadas) el bool_and es
-- NULL → coalesce a true mantiene el aserto verde y honesto sobre el shape esperado.
select ok(
  (select coalesce(bool_and(evidencia::text !~* '\y(rut|donante_id)\y'), true)
     from cruce_senal where tipo_senal = 'lobby_sector_aporte'),
  'la evidencia de lobby_sector_aporte es PII-safe (sin rut ni donante_id)');

-- ── (7) anon NO lee cruce_senal directamente (deny-by-default → 42501) ─────────
set local role anon;
select throws_ok(
  $$ select id from cruce_senal $$,
  '42501',
  null,
  'anon NO lee cruce_senal directamente (revoke all → insufficient_privilege 42501)');
reset role;

select * from finish();
rollback;
