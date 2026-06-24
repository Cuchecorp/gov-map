-- 0037_resolver_entidad_audit_fix.test.sql
-- Verifica el forward-fix de Issue 1 (35-05-SUMMARY.md, BLOCKER ENT-03/ENT-04): migracion 0037
-- anade identidad_audit.vinculo_entidad_id (FK → vinculo_entidad) + CHECK identidad_audit_un_solo_vinculo
-- (num_nonnulls <= 1) y reemplaza resolver_entidad para escribir la columna correcta.
--   (a) estructura: columna vinculo_entidad_id, FK → vinculo_entidad, CHECK existe.
--   (b) deny-by-default: anon/authenticated/public NO ejecutan resolver_entidad.
--   (c) regresion funcional: confirm-with-promote NO lanza 23503; el audit escribe
--       vinculo_entidad_id (non-null) y deja vinculo_id null (XOR correcto).
--   (d) CHECK dispara (23514) cuando ambas columnas son non-null.
--   (e) camino parlamentario intacto: insert con solo vinculo_id VIVE; un id de vinculo_entidad
--       puesto en vinculo_id (solo) falla 23503 — el FK parlamentario es el guard estructural.
-- pgTAP corre como superuser local en una sola transaccion begin…rollback.

begin;
select plan(12);

-- ── (a) asserts estructurales (1-3) ──
-- 1. columna vinculo_entidad_id existe
select has_column('public', 'identidad_audit', 'vinculo_entidad_id',
  'identidad_audit.vinculo_entidad_id presente (forward-fix 0037)');

-- 2. FK identidad_audit.vinculo_entidad_id → vinculo_entidad
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f'
      and src.relname = 'identidad_audit'
      and tgt.relname = 'vinculo_entidad'),
  1, 'identidad_audit.vinculo_entidad_id es FK a vinculo_entidad (guard estructural correcto)');

-- 3. CHECK identidad_audit_un_solo_vinculo existe
select ok(
  (select exists(select 1 from pg_constraint
                  where conname = 'identidad_audit_un_solo_vinculo')),
  'CHECK identidad_audit_un_solo_vinculo existe (defensa-en-profundidad num_nonnulls <= 1)');

-- ── (b) grant probes: anon/authenticated/public NO ejecutan resolver_entidad (4-6) ──
select ok(
  not has_function_privilege('anon',
    'public.resolver_entidad(bigint,text,text,text,timestamp with time zone,boolean,jsonb,text,text,text)', 'execute'),
  'anon NO puede ejecutar resolver_entidad (deny-by-default)');
select ok(
  not has_function_privilege('authenticated',
    'public.resolver_entidad(bigint,text,text,text,timestamp with time zone,boolean,jsonb,text,text,text)', 'execute'),
  'authenticated NO puede ejecutar resolver_entidad');
select ok(
  not has_function_privilege('public',
    'public.resolver_entidad(bigint,text,text,text,timestamp with time zone,boolean,jsonb,text,text,text)', 'execute'),
  'public NO puede ejecutar resolver_entidad');

-- ── seed para el caso funcional (ids en rango 910002 para evitar colision con 0036 test) ──
insert into entidad_tercero (id, nombre_normalizado, tipo_entidad, origen, enlace)
  values ('E0R002', 'rpc resolver dos audit', 'natural', 'test', 'http://y');
insert into revision_entidad (id, mencion_nombre, mencion_normalizada, tipo_entidad, estado, modelo_version)
  overriding system value
  values (910002, 'Rpc Dos Audit', 'rpc dos audit', 'natural', 'pendiente', 'minimax-mock');

-- 7. regresion funcional: confirm-with-promote lives_ok (no FK 23503)
select lives_ok(
  $f$ select resolver_entidad(910002, 'confirmado', 'ana', null, now(), true,
        jsonb_build_object('mencion_nombre','Rpc Dos Audit','mencion_normalizada','rpc dos audit',
          'tipo_entidad','natural','entidad_tercero_id','E0R002',
          'estado','confirmado','metodo','humano','origen','lobby','enlace',''),
        'confirmado','minimax-mock','natural') $f$,
  'confirm-with-promote does NOT raise FK violation (regression for Issue 1)');

-- 8. fila audit resultante: vinculo_entidad_id non-null
select isnt(
  (select vinculo_entidad_id from identidad_audit
    where decision = 'confirmado' and revisor_id = 'ana' and tipo_entidad = 'natural'),
  null, 'audit row has vinculo_entidad_id non-null after confirm-with-promote');

-- 9. fila audit resultante: vinculo_id null (XOR correcto)
select is(
  (select vinculo_id from identidad_audit
    where decision = 'confirmado' and revisor_id = 'ana' and tipo_entidad = 'natural'),
  null, 'audit row has vinculo_id null (correct XOR: vinculo_entidad_id is the correct column)');

-- ── seed de un vinculo_identidad para el lado FK del test de ambas columnas ──
-- omite estado (default no_confirmado per 0006 line 30 — setting confirmado triggers
-- el insert-guard de 0007 RAISE porque parlamentario_id es null).
insert into vinculo_identidad (mencion_nombre, mencion_normalizada, camara, periodo, metodo, origen, enlace)
  values ('Check Test', 'check test', 'senado', '2022-2026', 'determinista', 'test', 'http://z');

-- 10. CHECK enforcement: ambas columnas non-null lanza 23514
select throws_ok(
  $c$ insert into identidad_audit(vinculo_id, vinculo_entidad_id, metodo, decision, evidence, conflicts)
      select vi.id, ve.id, 'humano', 'confirmado', '[]'::jsonb, '[]'::jsonb
        from vinculo_identidad vi, vinculo_entidad ve
       where vi.mencion_normalizada = 'check test'
         and ve.tipo_entidad = 'natural' and ve.mencion_normalizada = 'rpc dos audit'
       limit 1 $c$,
  '23514', null,
  'CHECK identidad_audit_un_solo_vinculo fires when both vinculo_id and vinculo_entidad_id non-null');

-- 11. camino parlamentario lives_ok: insert con solo vinculo_id VIVE (fila seed presente desde assert 10)
select lives_ok(
  $p$ insert into identidad_audit(vinculo_id, metodo, decision, evidence, conflicts)
      select id, 'humano', 'confirmado', '[]'::jsonb, '[]'::jsonb
        from vinculo_identidad where mencion_normalizada = 'check test' $p$,
  'parliamentary audit path unbroken: insert with only vinculo_id succeeds');

-- 12. guard estructural del FK parlamentario: un id de vinculo_entidad puesto en vinculo_id (solo)
-- DEBE fallar 23503 — el FK parlamentario es el guard estructural, no el CHECK.
-- (El CHECK pasa aqui: num_nonnulls(vinculo_id=non-null, vinculo_entidad_id=null) = 1, <= 1.)
select throws_ok(
  $g$ insert into identidad_audit(vinculo_id, metodo, decision, evidence, conflicts)
      select id, 'humano', 'confirmado', '[]'::jsonb, '[]'::jsonb
        from vinculo_entidad where mencion_normalizada = 'rpc dos audit' limit 1 $g$,
  '23503', null,
  'parliamentary FK (vinculo_id → vinculo_identidad) rejects a vinculo_entidad id — structural guard confirmed');

select * from finish();
rollback;
