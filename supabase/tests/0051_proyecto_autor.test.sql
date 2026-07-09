-- pgTAP tests para la tabla proyecto_autor (AUTOR-01).
-- Verifican: existencia, columnas nullable/not-null, índice, y policy RLS.
-- Correr contra la DB remota (PROD) vía:
--   psql -tA -f 0051_proyecto_autor.test.sql "$DATABASE_URL"

BEGIN;
SELECT plan(6);

SELECT has_table('public', 'proyecto_autor', 'tabla proyecto_autor existe');

SELECT col_is_nullable('public', 'proyecto_autor', 'parlamentario_id', 'parlamentario_id nullable');

SELECT col_not_null('public', 'proyecto_autor', 'autor_crudo', 'autor_crudo not null');

SELECT col_not_null('public', 'proyecto_autor', 'boletin', 'boletin not null');

SELECT has_index('public', 'proyecto_autor', 'proyecto_autor_boletin_idx', 'indice boletin existe');

SELECT policies_are('public', 'proyecto_autor', ARRAY['proyecto_autor_public_read'], 'RLS policy public_read');

SELECT finish();
ROLLBACK;
