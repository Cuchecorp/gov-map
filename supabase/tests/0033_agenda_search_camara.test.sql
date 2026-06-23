-- 0033_agenda_search_camara.test.sql
-- Verifica que el filtro por cámara vive DENTRO del RPC (p_camara) y que la firma de 2 args de
-- 0032 ya no existe (fue reemplazada por la de 3). Corre vía `supabase test db` (pgTAP).

begin;
select plan(4);

-- La firma vieja de 2 args ya NO existe (la dropeó 0033).
select hasnt_function('public', 'buscar_citaciones', ARRAY['text', 'integer'],
  'la firma buscar_citaciones(text, int) de 0032 fue reemplazada');
-- La nueva de 3 args existe con grant a anon.
select has_function('public', 'buscar_citaciones', ARRAY['text', 'integer', 'text'],
  'buscar_citaciones(text, int, text) existe (p_camara)');

-- Semilla: una citación de cada cámara que matchea la misma consulta.
insert into citacion (id, camara, comision, fecha, horario, materia, semana_iso, origen, enlace)
  values
    ('t:cam', 'camara', 'Comisión de Hacienda', '2026-06-23T10:00:00Z', '10:00', 'reforma tributaria', '2026-W26', 'test', 'http://x'),
    ('t:sen', 'senado', 'Comisión de Hacienda', '2026-06-23T10:00:00Z', '10:00', 'reforma tributaria', '2026-W26', 'test', 'http://x');

set local role anon;

-- p_camara filtra DENTRO del RPC: solo la fila de Cámara.
select results_eq(
  $$ select camara from public.buscar_citaciones('hacienda', 50, 'camara') $$,
  $$ values ('camara'::text) $$,
  'p_camara=camara restringe el resultado a la Cámara (filtro en el RPC, antes del LIMIT)');

-- Sin p_camara (default null) → ambas cámaras.
select is(
  (select count(*)::int from public.buscar_citaciones('hacienda', 50, null)),
  2,
  'p_camara null devuelve ambas cámaras');

reset role;

select * from finish();
rollback;
