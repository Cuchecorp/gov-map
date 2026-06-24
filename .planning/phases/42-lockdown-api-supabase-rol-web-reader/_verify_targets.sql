\pset format unaligned
\pset fieldsep '|'
\echo ===FUNCS_THAT_DO_NOT_RESOLVE===
with sigs(s) as (values
 ('public.agregado_por_contraparte(text)'),('public.aportes_de_parlamentario(text)'),
 ('public.bienes_de_parlamentario(text)'),('public.buscar_citaciones(text, integer, text)'),
 ('public.comparar_declaraciones(text, date[])'),('public.contratos_de_parlamentario(text)'),
 ('public.cruces_de_parlamentario(text)'),('public.declaraciones_de_parlamentario(text)'),
 ('public.lobby_de_parlamentario(text)'),
 ('public.match_proyectos(vector, integer, double precision, text)'),
 ('public.parlamentario_publico(text)'),('public.parlamentarios_publico()'),
 ('public.rebeldias_de_parlamentario(text)'),
 ('public.subgrafo_red(text, integer, text[], timestamptz, timestamptz)'),
 ('public.votos_de_parlamentario(text, integer, integer)'))
select s from sigs where to_regprocedure(s) is null;
\echo ===FUNCS_OK_COUNT===
select count(*) from (values
 ('public.agregado_por_contraparte(text)'),('public.aportes_de_parlamentario(text)'),
 ('public.bienes_de_parlamentario(text)'),('public.buscar_citaciones(text, integer, text)'),
 ('public.comparar_declaraciones(text, date[])'),('public.contratos_de_parlamentario(text)'),
 ('public.cruces_de_parlamentario(text)'),('public.declaraciones_de_parlamentario(text)'),
 ('public.lobby_de_parlamentario(text)'),
 ('public.match_proyectos(vector, integer, double precision, text)'),
 ('public.parlamentario_publico(text)'),('public.parlamentarios_publico()'),
 ('public.rebeldias_de_parlamentario(text)'),
 ('public.subgrafo_red(text, integer, text[], timestamptz, timestamptz)'),
 ('public.votos_de_parlamentario(text, integer, integer)')) v(s)
where to_regprocedure(s) is not null;
\echo ===END===
