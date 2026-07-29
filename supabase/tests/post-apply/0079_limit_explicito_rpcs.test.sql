-- 0079_limit_explicito_rpcs.test.sql  (POST-APPLY ONLY)
--
-- Verifica el cierre del ultimo tramo de OFF-4-03: las 12 RPCs que no tenian NINGUN
-- `LIMIT` ahora tienen techo de filas, y ese techo NO trunca ningun resultado legitimo.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql
-- Debe reportar 26 ok, 0 not ok.
--
-- ── LA ASERCION POR CLASE (lo que evita fabricar un B-01 nuevo) ───────────────────
-- Las 12 NO se asertan igual, porque un `count(*)` es vacuo justo donde el LIMIT es
-- peligroso:
--   * FILAS (11 de 12) — el `limit` esta en la consulta TERMINAL. Se invoca la funcion
--     en su PEOR CASO MEDIDO (dominio completo, ver 124-CARDINALIDAD-MEDIDA.md) y se
--     asierta que el conteo devuelto es ESTRICTAMENTE MENOR que el techo.
--   * AGREGADO (1 de 12: tasa_ausencia_comparada) — devuelve 1 fila, asi que un
--     `count(*)` daria 1 PASE LO QUE PASE y la asercion pasaria verde MIENTRAS la
--     mediana publicada cambia en silencio. Su asercion (12) es por IGUALDAD DEL VALOR
--     DEVUELTO contra la captura PRE-APPLY, sobre los 186 sujetos.
--
-- ── LO QUE ESTAS ASERCIONES NO PRUEBAN (dicho, no escondido) ──────────────────────
-- Los techos se derivaron del maximo medido con margen >= 4x, asi que `medido < techo`
-- NO PUEDE FALLAR HOY: es tautologico por construccion. Su valor es cazar DERIVA FUTURA
-- (el dia que la ingesta acerque los datos al techo) y errores de transcripcion entre
-- 124-CARDINALIDAD-MEDIDA.md y la migracion. Lo que de verdad protege del truncamiento
-- es que el maximo se midio sobre el DOMINIO COMPLETO. La unica asercion con poder de
-- caza real sobre el modo de fallo B-01 es la (12).
-- Las (1) y (4) son ademas VERDES PERO VACIAS hoy: public.aporte y public.contrato
-- tienen CERO filas por el gate MONEY. Estan escritas para que el dia del flip empiecen
-- a medir de verdad; hasta entonces no prueban nada y aqui se dice.
--
-- PII: cero. Conteos, hashes y metadatos de firma. Los identificadores que aparecen
-- (D1176, S1120, 14309-04...) son los IDs publicos que ya viajan en las URLs del sitio,
-- los mismos que el pgTAP de 0078 usa. Ninguna fila de datos se transcribe.
--
-- Las 12 son de LECTURA (STABLE), por eso aqui SI se invocan. Jamas se invoca una RPC
-- de escritura desde un test.
--
-- NOTA DE DURACION: la asercion (12) barre los 186 sujetos (~70 s). Es deliberado: la
-- captura pre-apply se hizo sobre el dominio completo y comparar sobre una muestra
-- degradaria la unica asercion que tiene poder de caza.

begin;
select plan(26);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (1..11) NO-TRUNCAMIENTO — clase FILAS: peor caso medido < techo (estricto)
-- ═══════════════════════════════════════════════════════════════════════════════════

select ok(
  (select count(*) from public.aportes_de_parlamentario('S1120')) < 20000,
  'aportes_de_parlamentario [FILAS] peor caso < techo 20000 (VACUA HOY: public.aporte=0 filas por el gate MONEY; re-medir tras el flip)');

select ok(
  (select count(*) from public.bienes_de_parlamentario('S1120')) < 5000,
  'bienes_de_parlamentario [FILAS] peor caso medido (610, S1120) < techo 5000: el LIMIT no trunca');

select ok(
  (select count(*) from public.comparar_declaraciones('S1120',
     coalesce((select array_agg(distinct d.fecha_presentacion) from public.declaracion d
               where d.parlamentario_id = 'S1120'), '{}'::date[]))) < 5000,
  'comparar_declaraciones [FILAS] peor caso medido (658 = TODAS las fechas del sujeto) < techo 5000: el LIMIT no trunca');

select ok(
  (select count(*) from public.contratos_de_parlamentario('S1120')) < 20000,
  'contratos_de_parlamentario [FILAS] peor caso < techo 20000 (VACUA HOY: public.contrato=0 filas por el gate MONEY; re-medir tras el flip)');

select ok(
  (select count(*) from public.cruces_de_parlamentario('D1075')) < 1000,
  'cruces_de_parlamentario [FILAS] peor caso medido (13, D1075) < techo 1000: el LIMIT no trunca');

select ok(
  (select count(*) from public.cruces_de_proyecto('14309-04')) < 1000,
  'cruces_de_proyecto [FILAS] peor caso medido (47, boletin 14309-04 sobre los 3.683) < techo 1000: el LIMIT no trunca');

select ok(
  (select count(*) from public.declaraciones_de_parlamentario('S1320')) < 1000,
  'declaraciones_de_parlamentario [FILAS] peor caso medido (20, S1320) < techo 1000: el LIMIT no trunca');

select ok(
  (select count(*) from public.lobby_de_parlamentario('D843')) < 2000,
  'lobby_de_parlamentario [FILAS] peor caso medido (338, D843) < techo 2000: el LIMIT no trunca');

select ok(
  (select count(*) from public.lobby_en_tramitacion('17337-07')) < 1000,
  'lobby_en_tramitacion [FILAS] peor caso medido (219, boletin 17337-07 sobre los 3.683) < techo 1000: el LIMIT no trunca');

select ok(
  (select count(*) from public.parlamentarios_publico()) < 1000,
  'parlamentarios_publico [FILAS] directorio entero medido (186) < techo 1000: el LIMIT no trunca el roster');

select ok(
  (select count(*) from public.rebeldias_de_parlamentario('D1176')) < 6000,
  'rebeldias_de_parlamentario [FILAS] peor caso medido (1461, D1176 — el maximo mas alto de las 12) < techo 6000: el LIMIT no trunca');

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (12) NO-TRUNCAMIENTO — clase AGREGADO: IGUALDAD DEL VALOR contra la captura pre-apply
-- ═══════════════════════════════════════════════════════════════════════════════════
-- tasa_ausencia_comparada devuelve 1 fila: un count(*) daria 1 aunque el LIMIT de la
-- cohorte `per_parl` recortara la muestra y moviera la MEDIANA publicada. Por eso se
-- compara el VALOR devuelto (n, m, tasa, mediana, k, camara) sobre los 186 sujetos
-- contra el hash capturado ANTES del apply (124-CARDINALIDAD-MEDIDA.md).
-- Si el LIMIT hubiera recortado la cohorte, la mediana cambiaria y este hash cambiaria.
select is(
  (select md5(string_agg(fila, '|' order by fila)) from (
     select p.id || '>' || coalesce((
        select r.n_ausencias||','||r.m_votaciones||','||r.tasa_propia||','||
               r.mediana_camara||','||r.k_parlamentarios||','||r.camara
        from public.tasa_ausencia_comparada(p.id) r), 'EMPTY') as fila
     from public.parlamentario p) s),
  '266340984d66b98e7f590dd555dd4cfb',
  'tasa_ausencia_comparada [AGREGADO] valor identico al pre-apply sobre los 186 sujetos: el LIMIT de la cohorte per_parl NO cambio la mediana (un count(*) aqui seria vacuo — daria 1 pase lo que pase)');

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (13..24) CONTRATO — firma identity + tipo de retorno identicos al pre-apply
-- Las cadenas son las capturadas del pg_get_functiondef VIVO antes del apply.
-- ═══════════════════════════════════════════════════════════════════════════════════

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.aportes_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(eleccion text, donante_nombre text, tipo_persona text, monto text, fecha_aporte date, tipo_aporte text, candidato_nombre_verbatim text, origen text, fecha_captura timestamp with time zone, fecha_corte date, enlace text, licencia text)',
  'aportes_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.bienes_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(fuente_id text, fecha_presentacion date, tipo_bien text, contenido jsonb, origen text, fecha_captura timestamp with time zone, enlace text, licencia text)',
  'bienes_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.comparar_declaraciones(text, date[])'::regprocedure),
  'p_id text, fechas date[] -> TABLE(fecha_presentacion date, etiqueta text, valor text, origen text, fecha_captura timestamp with time zone, enlace text, licencia text)',
  'comparar_declaraciones conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.contratos_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(codigo_orden text, proveedor_nombre text, tipo_persona text, organismo text, nombre_orden text, monto text, fecha_oc date, origen text, fecha_captura timestamp with time zone, fecha_corte date, enlace text, licencia text)',
  'contratos_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.cruces_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(sector_id text, sector_etiqueta text, tipo_senal text, conteo integer, evidencia jsonb, fecha_captura timestamp with time zone)',
  'cruces_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.cruces_de_proyecto(text)'::regprocedure),
  'p_boletin text -> TABLE(parlamentario_id text, nombre_normalizado text, sector_id text, sector_etiqueta text, tipo_senal text, conteo integer, evidencia jsonb, fecha_captura timestamp with time zone)',
  'cruces_de_proyecto conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.declaraciones_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(fuente_id text, fecha_presentacion date, tipo text, cargo text, organismo text, origen text, fecha_captura timestamp with time zone, enlace text, licencia text)',
  'declaraciones_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.lobby_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(identificador text, fecha timestamp with time zone, fecha_raw text, materia text, enlace_detalle text, origen text, fecha_captura timestamp with time zone, enlace text, contraparte_nombre text, contraparte_rol text, representado text)',
  'lobby_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.lobby_en_tramitacion(text)'::regprocedure),
  'p_boletin text -> TABLE(parlamentario_nombre text, camara text, materia text, fecha_reunion timestamp with time zone, semana_iso text, comision text, enlace_detalle text, audiencia_id text)',
  'lobby_en_tramitacion conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.parlamentarios_publico()'::regprocedure),
  ' -> TABLE(id text, nombre text, camara text, region text, distrito text, circunscripcion text, periodo text)',
  'parlamentarios_publico conserva firma identity (sin argumentos) y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.rebeldias_de_parlamentario(text)'::regprocedure),
  'p_id text -> TABLE(votacion_id text, boletin text, titulo text, etapa text, fecha timestamp with time zone, seleccion_propia text, mayoria_bancada text)',
  'rebeldias_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply');

select is(
  (select pg_get_function_identity_arguments(oid) || ' -> ' || pg_get_function_result(oid)
   from pg_proc where oid = 'public.tasa_ausencia_comparada(text)'::regprocedure),
  'p_parlamentario_id text -> TABLE(n_ausencias integer, m_votaciones integer, tasa_propia numeric, mediana_camara numeric, k_parlamentarios integer, camara text)',
  'tasa_ausencia_comparada conserva firma identity y tipo de retorno identicos al pre-apply');

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (25) EXPOSICION — cero exec-anon en TODO el corpus propio de public
-- Los 12 create or replace no reabrieron EXECUTE por default ACL.
-- ═══════════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'cero funciones propias de public ejecutables por anon: los 12 create or replace no reabrieron nada');

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (26) DENOMINADOR + NO-REGRESION DE LA RUTA VIVA
-- El corpus propio sigue en 42 (no se creo ni destruyo ningun objeto) Y service_role
-- CONSERVA EXECUTE sobre las 12 — `create or replace` preserva el ACL, pero eso hay que
-- PROBARLO, no suponerlo: el doble-revoke de esta misma migracion toca public/anon/
-- authenticated, y si hubiera rozado service_role tumbaria el Camino A del sitio.
-- ═══════════════════════════════════════════════════════════════════════════════════
select is(
  (select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))::text
       || '/' ||
          (select count(*) from (values
             ('public.aportes_de_parlamentario(text)'),
             ('public.bienes_de_parlamentario(text)'),
             ('public.comparar_declaraciones(text, date[])'),
             ('public.contratos_de_parlamentario(text)'),
             ('public.cruces_de_parlamentario(text)'),
             ('public.cruces_de_proyecto(text)'),
             ('public.declaraciones_de_parlamentario(text)'),
             ('public.lobby_de_parlamentario(text)'),
             ('public.lobby_en_tramitacion(text)'),
             ('public.parlamentarios_publico()'),
             ('public.rebeldias_de_parlamentario(text)'),
             ('public.tasa_ausencia_comparada(text)')
           ) t(f)
           where has_function_privilege('service_role', to_regprocedure(t.f)::oid, 'EXECUTE'))::text),
  '42/12',
  'el corpus propio de public sigue siendo 42 (0079 no creo ni destruyo objetos) Y service_role CONSERVA EXECUTE sobre las 12 (la ruta viva del sitio, Camino A, intacta)');

select * from finish();
rollback;
