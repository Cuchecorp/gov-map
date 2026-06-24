-- 0022_probidad.test.sql
-- Verifica la migración 0022 (INT Patrimonio/Intereses) CONTRA UN SCHEMA APLICADO:
--   * las tablas (declaracion + sub-tablas de bienes + declaracion_familiar + probidad_ingesta_estado) existen con RLS habilitada,
--   * `declaracion` es VERSIONADA: su PK son (fuente_id, fecha_presentacion) (las versiones acumulan, Pitfall 1),
--   * `declaracion_familiar` es DENY-BY-DEFAULT (cero policies + sin grant SELECT a anon),
--   * `declaracion` + sub-tablas de bienes son PUBLIC-READ (policy SELECT para anon + grant SELECT a anon),
--   * provenance + licencia NOT NULL (FND-08 + CC BY 4.0),
--   * NINGUNA tabla tiene columna RUT de persona natural (la fuente no la expone — research),
--   * `declaracion_familiar` NO tiene FK a parlamentario (su única FK saliente es a declaracion),
--   * el FK del declarante es nullable,
--   * los RPCs `declaraciones_de_parlamentario(text)` / `comparar_declaraciones(text, date[])` existen, son SECURITY DEFINER y anon tiene EXECUTE.
-- Corre vía `psql -tA -f` (vs PROD aplicado) (pgTAP). build/typecheck NO prueban que el DDL se aplicó
-- (falso positivo de CI, Pitfall 6). Espeja 0021_lobby.test.sql + 0018_piso_pii.test.sql.

begin;
select plan(34);

-- ── Las tablas existen ──────────────────────────────────────────────────────────
select has_table('public', 'declaracion',                  'tabla declaracion existe');
select has_table('public', 'declaracion_bien_inmueble',    'tabla declaracion_bien_inmueble existe');
select has_table('public', 'declaracion_bien_mueble',      'tabla declaracion_bien_mueble existe');
select has_table('public', 'declaracion_actividad',        'tabla declaracion_actividad existe');
select has_table('public', 'declaracion_pasivo',           'tabla declaracion_pasivo existe');
select has_table('public', 'declaracion_accion_derecho',   'tabla declaracion_accion_derecho existe');
select has_table('public', 'declaracion_valor',            'tabla declaracion_valor existe');
select has_table('public', 'declaracion_familiar',         'tabla declaracion_familiar existe');
select has_table('public', 'probidad_ingesta_estado',      'tabla probidad_ingesta_estado existe');

-- ── RLS habilitada (en la pública versionada, en la familiar PII y en el marcador) ─
select is(
  (select count(*)::int from pg_class
     where relname = 'declaracion' and relrowsecurity = true),
  1, 'RLS enabled en declaracion');
select is(
  (select count(*)::int from pg_class
     where relname = 'declaracion_familiar' and relrowsecurity = true),
  1, 'RLS enabled en declaracion_familiar');
select is(
  (select count(*)::int from pg_class
     where relname = 'probidad_ingesta_estado' and relrowsecurity = true),
  1, 'RLS enabled en probidad_ingesta_estado');

-- ── declaracion VERSIONADA: la PK son EXACTAMENTE (fuente_id, fecha_presentacion) ──
-- Codifica "las versiones acumulan, nunca se sobreescriben" (Pitfall 1). La PK DEBE incluir
-- fecha_presentacion; si la PK fuera solo fuente_id, un re-run colapsaría el historial.
select is(
  (select string_agg(a.attname, ',' order by array_position(con.conkey, a.attnum))
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey)
    where c.relname = 'declaracion' and con.contype = 'p'),
  'fuente_id,fecha_presentacion',
  'la PK de declaracion es (fuente_id, fecha_presentacion) — versionada (Pitfall 1)');

-- ── declaracion_familiar DENY-BY-DEFAULT: cero policies + sin grant SELECT a anon ──
select is(
  (select count(*)::int from pg_policies where tablename = 'declaracion_familiar'),
  0, 'declaracion_familiar sin policies (deny-by-default, espejo 0018/0021)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'declaracion_familiar' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre declaracion_familiar (tercero privado, Ley 21.719 + revoke Phase 11)');

-- ── declaracion PUBLIC-READ: policy SELECT para anon + grant SELECT a anon ─────────
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'declaracion' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'declaracion tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'declaracion' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre declaracion (public-read)');

-- ── Una sub-tabla de bienes también es PUBLIC-READ (contenido publicado, CC BY 4.0) ─
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'declaracion_bien_inmueble' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'declaracion_bien_inmueble tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'declaracion_bien_inmueble' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre declaracion_bien_inmueble (public-read)');

-- ── Provenance + licencia NOT NULL (FND-08 + CC BY 4.0 PITFALLS D4) ────────────────
select col_not_null('public', 'declaracion',         'origen',   'declaracion.origen NOT NULL (provenance)');
select col_not_null('public', 'declaracion',         'enlace',   'declaracion.enlace NOT NULL (provenance)');
select col_not_null('public', 'declaracion',         'licencia', 'declaracion.licencia NOT NULL (CC BY 4.0)');
select col_not_null('public', 'declaracion_familiar', 'origen',  'declaracion_familiar.origen NOT NULL (provenance)');
select col_not_null('public', 'declaracion_familiar', 'enlace',  'declaracion_familiar.enlace NOT NULL (provenance)');

-- ── Sin columna RUT de persona natural en declaracion ni declaracion_familiar ──────
-- La fuente no expone RUT de persona natural (research: filtro CONTAINS → cero). Ninguna
-- columna cuyo nombre contenga 'rut' debe existir en la declaración ni en los familiares.
select is(
  (select count(*)::int from information_schema.columns
     where table_schema = 'public'
       and table_name in ('declaracion', 'declaracion_familiar')
       and lower(column_name) like '%rut%'),
  0, 'ni declaracion ni declaracion_familiar tienen columna RUT de persona natural (minimización)');

-- ── FK de familiar a la VERSIÓN, no a parlamentario (Pitfall 4) ────────────────────
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f'
      and src.relname = 'declaracion_familiar'
      and tgt.relname = 'parlamentario'),
  0, 'declaracion_familiar NO tiene FK a parlamentario (tercero nunca enlazado a persona)');
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f'
      and src.relname = 'declaracion_familiar'
      and tgt.relname = 'declaracion'),
  1, 'declaracion_familiar tiene FK a la VERSIÓN declaracion (enlazada al hecho, no a la persona)');

-- ── FK del declarante nullable (la columna admite NULL, FK solo si confirmado) ─────
select col_is_null('public', 'declaracion', 'parlamentario_id',
  'declaracion.parlamentario_id es nullable (FK solo si confirmado, IDENT-12)');

-- ── RPCs: existen, security definer, anon tiene EXECUTE ────────────────────────────
select has_function('public', 'declaraciones_de_parlamentario', ARRAY['text'],
  'función declaraciones_de_parlamentario(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'declaraciones_de_parlamentario'),
  true,
  'declaraciones_de_parlamentario es security definer');
select ok(
  has_function_privilege('anon', 'public.declaraciones_de_parlamentario(text)', 'execute'),
  'anon tiene EXECUTE sobre declaraciones_de_parlamentario');

select has_function('public', 'comparar_declaraciones', ARRAY['text', 'date[]'],
  'función comparar_declaraciones(text, date[]) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'comparar_declaraciones'),
  true,
  'comparar_declaraciones es security definer');
select ok(
  has_function_privilege('anon', 'public.comparar_declaraciones(text, date[])', 'execute'),
  'anon tiene EXECUTE sobre comparar_declaraciones');

select * from finish();
rollback;
