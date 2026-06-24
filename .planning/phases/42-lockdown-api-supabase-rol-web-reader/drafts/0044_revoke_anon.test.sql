-- 0044_revoke_anon.test.sql  (POST-APPLY ONLY — corre tras aplicar 0044)
--
-- Verifica el estado FINAL del lockdown de anon:
--   * anon y authenticated NO tienen EXECUTE sobre ninguno de los 15 RPCs curados.
--   * anon NO tiene SELECT sobre tablas representativas de las 26.
--   * las 26 policies `*_public_read` (to anon) ya no existen.
--   * las 26 policies `*_public_read_wr` (to web_reader) SIGUEN existiendo.
--   * web_reader SÍ tiene EXECUTE en los 15 RPCs (regresión: el revoke no lo tocó).
--   * web_reader SÍ tiene SELECT en tablas representativas.
--   * service_role mantiene acceso (sanity — Supabase lo concede vía superuser bypass).
--
-- POST-APPLY ONLY: vive en .planning/.../drafts/ durante el draft; mover a
-- supabase/tests/post-apply/0044_revoke_anon.test.sql antes de aplicar 0044.
-- FUERA del glob de la suite regular (supabase/tests/*.test.sql) a propósito:
-- si la suite lo recogiera pre-lockdown, todos los asserts de "anon NO tiene"
-- fallarían (estado pre-0044 es el opuesto). El operador lo corre A MANO:
--   psql -tA -f supabase/tests/post-apply/0044_revoke_anon.test.sql
-- contra PROD ya aplicado.
--
-- plan(137):
--   15 × anon NOT EXECUTE (RPCs)          = 15
--   15 × authenticated NOT EXECUTE (RPCs) = 15
--   4  × anon NOT SELECT (tablas muestra) = 4
--   26 × policy _public_read ya no existe = 26
--   26 × policy _public_read_wr sí existe = 26
--   15 × web_reader SÍ EXECUTE (RPCs)     = 15
--   4  × web_reader SÍ SELECT (tablas)    = 4
--   2  × service_role sanity              = 2
--                                   TOTAL = 107
--   (corrección: 15+15+4+26+26+15+4+2 = 107)

begin;
select plan(107);


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN A — anon NO tiene EXECUTE sobre ninguno de los 15 RPCs curados
-- Fuente del inventario: _FACTS-live-prod.md §"15 curated public RPCs"
-- ════════════════════════════════════════════════════════════════════════════════

select ok(
  not has_function_privilege('anon', 'public.agregado_por_contraparte(text)', 'execute'),
  'anon NO tiene EXECUTE sobre agregado_por_contraparte');

select ok(
  not has_function_privilege('anon', 'public.aportes_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre aportes_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.bienes_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre bienes_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.buscar_citaciones(text)', 'execute'),
  'anon NO tiene EXECUTE sobre buscar_citaciones');

select ok(
  not has_function_privilege('anon', 'public.comparar_declaraciones(text, text)', 'execute'),
  'anon NO tiene EXECUTE sobre comparar_declaraciones');

select ok(
  not has_function_privilege('anon', 'public.contratos_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre contratos_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre cruces_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.declaraciones_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre declaraciones_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.lobby_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre lobby_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.match_proyectos(vector)', 'execute'),
  'anon NO tiene EXECUTE sobre match_proyectos');

select ok(
  not has_function_privilege('anon', 'public.parlamentario_publico(text)', 'execute'),
  'anon NO tiene EXECUTE sobre parlamentario_publico');

select ok(
  not has_function_privilege('anon', 'public.parlamentarios_publico()', 'execute'),
  'anon NO tiene EXECUTE sobre parlamentarios_publico');

select ok(
  not has_function_privilege('anon', 'public.rebeldias_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre rebeldias_de_parlamentario');

select ok(
  not has_function_privilege('anon', 'public.subgrafo_red(text, integer)', 'execute'),
  'anon NO tiene EXECUTE sobre subgrafo_red');

select ok(
  not has_function_privilege('anon', 'public.votos_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre votos_de_parlamentario');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN B — authenticated NO tiene EXECUTE sobre ninguno de los 15 RPCs
-- ════════════════════════════════════════════════════════════════════════════════

select ok(
  not has_function_privilege('authenticated', 'public.agregado_por_contraparte(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre agregado_por_contraparte');

select ok(
  not has_function_privilege('authenticated', 'public.aportes_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre aportes_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.bienes_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre bienes_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.buscar_citaciones(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre buscar_citaciones');

select ok(
  not has_function_privilege('authenticated', 'public.comparar_declaraciones(text, text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre comparar_declaraciones');

select ok(
  not has_function_privilege('authenticated', 'public.contratos_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre contratos_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.cruces_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre cruces_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.declaraciones_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre declaraciones_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.lobby_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre lobby_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.match_proyectos(vector)', 'execute'),
  'authenticated NO tiene EXECUTE sobre match_proyectos');

select ok(
  not has_function_privilege('authenticated', 'public.parlamentario_publico(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre parlamentario_publico');

select ok(
  not has_function_privilege('authenticated', 'public.parlamentarios_publico()', 'execute'),
  'authenticated NO tiene EXECUTE sobre parlamentarios_publico');

select ok(
  not has_function_privilege('authenticated', 'public.rebeldias_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre rebeldias_de_parlamentario');

select ok(
  not has_function_privilege('authenticated', 'public.subgrafo_red(text, integer)', 'execute'),
  'authenticated NO tiene EXECUTE sobre subgrafo_red');

select ok(
  not has_function_privilege('authenticated', 'public.votos_de_parlamentario(text)', 'execute'),
  'authenticated NO tiene EXECUTE sobre votos_de_parlamentario');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN C — anon NO tiene SELECT sobre tablas representativas de las 26
-- Muestra: proyecto, votacion, declaracion, lobby_audiencia (4 tablas)
-- ════════════════════════════════════════════════════════════════════════════════

select ok(
  not has_table_privilege('anon', 'public.proyecto', 'select'),
  'anon NO tiene SELECT sobre proyecto (tabla pública principal)');

select ok(
  not has_table_privilege('anon', 'public.votacion', 'select'),
  'anon NO tiene SELECT sobre votacion');

select ok(
  not has_table_privilege('anon', 'public.declaracion', 'select'),
  'anon NO tiene SELECT sobre declaracion');

select ok(
  not has_table_privilege('anon', 'public.lobby_audiencia', 'select'),
  'anon NO tiene SELECT sobre lobby_audiencia');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN D — las 26 policies `*_public_read` (to anon) ya NO existen
-- ════════════════════════════════════════════════════════════════════════════════

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'aporte_public_read' $$,
  'policy aporte_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'aportes_ingesta_estado_public_read' $$,
  'policy aportes_ingesta_estado_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'citacion_public_read' $$,
  'policy citacion_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'citacion_invitado_public_read' $$,
  'policy citacion_invitado_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'citacion_punto_public_read' $$,
  'policy citacion_punto_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'contrato_public_read' $$,
  'policy contrato_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'contratos_ingesta_estado_public_read' $$,
  'policy contratos_ingesta_estado_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_public_read' $$,
  'policy declaracion_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_accion_derecho_public_read' $$,
  'policy declaracion_accion_derecho_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_actividad_public_read' $$,
  'policy declaracion_actividad_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_bien_inmueble_public_read' $$,
  'policy declaracion_bien_inmueble_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_bien_mueble_public_read' $$,
  'policy declaracion_bien_mueble_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_pasivo_public_read' $$,
  'policy declaracion_pasivo_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_valor_public_read' $$,
  'policy declaracion_valor_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'lobby_audiencia_public_read' $$,
  'policy lobby_audiencia_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'lobby_ingesta_estado_public_read' $$,
  'policy lobby_ingesta_estado_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'probidad_ingesta_estado_public_read' $$,
  'policy probidad_ingesta_estado_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'proyecto_public_read' $$,
  'policy proyecto_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'proyecto_embedding_public_read' $$,
  'policy proyecto_embedding_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'proyecto_ficha_public_read' $$,
  'policy proyecto_ficha_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'sector_public_read' $$,
  'policy sector_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'sesion_sala_public_read' $$,
  'policy sesion_sala_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'sesion_tabla_item_public_read' $$,
  'policy sesion_tabla_item_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'tramitacion_evento_public_read' $$,
  'policy tramitacion_evento_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'votacion_public_read' $$,
  'policy votacion_public_read eliminada');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'voto_public_read' $$,
  'policy voto_public_read eliminada');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN E — las 26 policies `*_public_read_wr` (to web_reader) SIGUEN existiendo
-- Regresión: el DROP POLICY de 0044 NO debe haber tocado las policies _wr.
-- (Estas policies las crea LOCKDOWN-01 / 0043.)
-- ════════════════════════════════════════════════════════════════════════════════

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'aporte_public_read_wr' $$,
  'policy aporte_public_read_wr (web_reader) intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'aportes_ingesta_estado_public_read_wr' $$,
  'policy aportes_ingesta_estado_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'citacion_public_read_wr' $$,
  'policy citacion_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'citacion_invitado_public_read_wr' $$,
  'policy citacion_invitado_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'citacion_punto_public_read_wr' $$,
  'policy citacion_punto_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'contrato_public_read_wr' $$,
  'policy contrato_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'contratos_ingesta_estado_public_read_wr' $$,
  'policy contratos_ingesta_estado_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_public_read_wr' $$,
  'policy declaracion_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_accion_derecho_public_read_wr' $$,
  'policy declaracion_accion_derecho_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_actividad_public_read_wr' $$,
  'policy declaracion_actividad_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_bien_inmueble_public_read_wr' $$,
  'policy declaracion_bien_inmueble_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_bien_mueble_public_read_wr' $$,
  'policy declaracion_bien_mueble_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_pasivo_public_read_wr' $$,
  'policy declaracion_pasivo_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'declaracion_valor_public_read_wr' $$,
  'policy declaracion_valor_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'lobby_audiencia_public_read_wr' $$,
  'policy lobby_audiencia_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'lobby_ingesta_estado_public_read_wr' $$,
  'policy lobby_ingesta_estado_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'probidad_ingesta_estado_public_read_wr' $$,
  'policy probidad_ingesta_estado_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'proyecto_public_read_wr' $$,
  'policy proyecto_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'proyecto_embedding_public_read_wr' $$,
  'policy proyecto_embedding_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'proyecto_ficha_public_read_wr' $$,
  'policy proyecto_ficha_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'sector_public_read_wr' $$,
  'policy sector_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'sesion_sala_public_read_wr' $$,
  'policy sesion_sala_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'sesion_tabla_item_public_read_wr' $$,
  'policy sesion_tabla_item_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'tramitacion_evento_public_read_wr' $$,
  'policy tramitacion_evento_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'votacion_public_read_wr' $$,
  'policy votacion_public_read_wr intacta');

select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and policyname = 'voto_public_read_wr' $$,
  'policy voto_public_read_wr intacta');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN F — web_reader SÍ tiene EXECUTE sobre los 15 RPCs (regresión)
-- El revoke de 0044 NO debe haber afectado a web_reader.
-- ════════════════════════════════════════════════════════════════════════════════

select ok(
  has_function_privilege('web_reader', 'public.agregado_por_contraparte(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre agregado_por_contraparte');

select ok(
  has_function_privilege('web_reader', 'public.aportes_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre aportes_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.bienes_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre bienes_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.buscar_citaciones(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre buscar_citaciones');

select ok(
  has_function_privilege('web_reader', 'public.comparar_declaraciones(text, text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre comparar_declaraciones');

select ok(
  has_function_privilege('web_reader', 'public.contratos_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre contratos_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.cruces_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre cruces_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.declaraciones_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre declaraciones_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.lobby_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre lobby_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.match_proyectos(vector)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre match_proyectos');

select ok(
  has_function_privilege('web_reader', 'public.parlamentario_publico(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre parlamentario_publico');

select ok(
  has_function_privilege('web_reader', 'public.parlamentarios_publico()', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre parlamentarios_publico');

select ok(
  has_function_privilege('web_reader', 'public.rebeldias_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre rebeldias_de_parlamentario');

select ok(
  has_function_privilege('web_reader', 'public.subgrafo_red(text, integer)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre subgrafo_red');

select ok(
  has_function_privilege('web_reader', 'public.votos_de_parlamentario(text)', 'execute'),
  'web_reader SÍ tiene EXECUTE sobre votos_de_parlamentario');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN G — web_reader SÍ tiene SELECT sobre tablas representativas (regresión)
-- ════════════════════════════════════════════════════════════════════════════════

select ok(
  has_table_privilege('web_reader', 'public.proyecto', 'select'),
  'web_reader SÍ tiene SELECT sobre proyecto');

select ok(
  has_table_privilege('web_reader', 'public.votacion', 'select'),
  'web_reader SÍ tiene SELECT sobre votacion');

select ok(
  has_table_privilege('web_reader', 'public.declaracion', 'select'),
  'web_reader SÍ tiene SELECT sobre declaracion');

select ok(
  has_table_privilege('web_reader', 'public.lobby_audiencia', 'select'),
  'web_reader SÍ tiene SELECT sobre lobby_audiencia');


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN H — service_role: sanity check (acceso intacto, no tocado por 0044)
-- service_role es superuser-equiv en Supabase → bypassa grants vía pg_class owner;
-- has_function_privilege / has_table_privilege devuelven true independientemente
-- del REVOKE sobre objects. Si fallan, algo muy grave ocurrió.
-- ════════════════════════════════════════════════════════════════════════════════

select ok(
  has_function_privilege('service_role', 'public.parlamentario_publico(text)', 'execute'),
  'service_role mantiene EXECUTE sobre parlamentario_publico (sanity)');

select ok(
  has_table_privilege('service_role', 'public.proyecto', 'select'),
  'service_role mantiene SELECT sobre proyecto (sanity)');


select * from finish();
rollback;
