-- 0038_sector.sql
-- CRUCE (CRUCE-01) — catálogo `sector` (taxonomía macro-sectorial public-read) + columnas
-- `sector_id` aditivas sobre las tres tablas que el clasificador (Plan 02/03) etiquetará:
-- `proyecto_ficha`, `lobby_contraparte` y `donante`. Es el cimiento sobre el cual el
-- materializador de cruces (0039) deriva la señal parlamentario↔sector y el RPC (0040)
-- la lee. Esta migración NO clasifica datos: solo establece el modelo.
--
-- La última migración APLICADA es 0037 (resolver_entidad audit fix). Esta es la 0038.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 5): build/typecheck NO prueban que
-- Postgres ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0038_sector.test.sql) corriendo contra un schema APLICADO. Aplicar por `psql --db-url`
-- DIRECTO, NUNCA `supabase db push`: el `schema_migrations` remoto tiene drift → `db push`
-- re-aplicaría/saltaría migraciones. El BOM en `.env` rompe el CLI → pasar `--db-url`
-- explícito (mismo camino que 0018–0037). La aplicación al remoto vive en Plan 04 (BLOCKING).
--
-- CONVENCIONES ESPEJADAS:
--   * `sector` → public-read EXPLÍCITO (espejo de `lobby_audiencia` en 0021:52-56:
--     RLS habilitada + policy for select to anon using(true) + grant select to anon).
--     El catálogo es dato público de referencia: la ciudadanía lo ve para entender la
--     taxonomía de la señal de cruces. NO contiene PII.
--   * Columnas `sector_id` → ALTER aditivos, NULLABLE (NULL = "honest no-match", D-05): un
--     proyecto/contraparte/donante sin sector clasificado lleva NULL, nunca un catch-all.
--   * `codigo` = CLAVE ESTABLE (D-04): JAMÁS se renombra ni borra. El golden del clasificador
--     (Plan 02) y el SECTOR_CODIGOS de TS se construyen contra ESTOS códigos verbatim.
--   * SIN catch-all 'otros' (D-05): la ausencia de sector se modela con NULL en la fila
--     clasificada, no con una fila-paraguas que invente cobertura.
--
-- TAXONOMÍA CONFIRMADA POR EL OPERADOR (Task 1, Decisión A1 — LOCKED, D-03/D-04):
--   13 macro-sectores anclados en las comisiones permanentes del Congreso, legibles para
--   ciudadano/prensa. Los `codigo` son claves estables; nunca se renombran ni borran.

-- ── sector (CATÁLOGO de taxonomía, public-read — espejo de lobby_audiencia/0021) ──
-- codigo = clave estable (D-04, jamás renombrar/borrar); etiqueta = rótulo legible.
create table sector (
  codigo   text primary key,   -- clave ESTABLE (D-04): nunca renombrar ni borrar
  etiqueta text not null        -- rótulo legible para ciudadano/prensa
);

-- Seed CONFIRMADO en Task 1 (Decisión A1, LOCKED). SIN catch-all 'otros' (D-05).
insert into sector (codigo, etiqueta) values
  ('salud',                'Salud y farmacéutica'),
  ('educacion',            'Educación'),
  ('mineria_energia',      'Minería y energía'),
  ('medio_ambiente',       'Medio ambiente y recursos hídricos'),
  ('trabajo_prevision',    'Trabajo y previsión social'),
  ('vivienda_urbanismo',   'Vivienda, urbanismo y obras públicas'),
  ('transporte',           'Transporte y telecomunicaciones'),
  ('agricultura_pesca',    'Agricultura, pesca y alimentos'),
  ('banca_finanzas',       'Banca, finanzas y seguros'),
  ('comercio_industria',   'Comercio, industria y retail'),
  ('tecnologia',           'Tecnología y economía digital'),
  ('seguridad_justicia',   'Seguridad, justicia y defensa'),
  ('gremios_trabajadores', 'Gremios, sindicatos y asociaciones');

-- RLS público-read EXPLÍCITO (espejo de lobby_audiencia/0021:52-56). El catálogo es
-- referencia pública; el deny-by-default heredado lo dejaría invisible. NO hay policies
-- de insert/update/delete: el catálogo se administra por DDL (service key/owner).
alter table sector enable row level security;
create policy sector_public_read on sector for select to anon using (true);
-- GRANT explícito: la policy sin el privilegio de tabla no expone nada (defensa en profundidad).
grant select on sector to anon;

-- ── columnas sector_id aditivas (Half B) — NULLABLE, NULL = honest no-match (D-05) ──
-- Tres ALTER aditivos sobre las tablas que el clasificador (Plan 02/03) etiquetará. El FK
-- apunta a sector(codigo) (la clave estable). NULL es first-class: un registro sin sector
-- clasificado lo deja NULL, nunca un catch-all.
alter table proyecto_ficha    add column sector_id text references sector(codigo);
alter table lobby_contraparte add column sector_id text references sector(codigo);
alter table donante           add column sector_id text references sector(codigo);
