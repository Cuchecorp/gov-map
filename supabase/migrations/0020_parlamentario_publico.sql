-- 0020_parlamentario_publico.sql
-- Cabecera pública de la ficha del parlamentario (VOTE-03, ficha /parlamentario/[id]).
--
-- POR QUÉ existe (gap descubierto al construir la ficha, Plan 03):
--   `parlamentario` es deny-by-default (0005/0018): RLS habilitada, CERO policies,
--   anon NO lee NINGUNA columna directamente. La ficha del parlamentario necesita
--   renderizar su cabecera (`<h1>` nombre + cámara + cargo + provenance) pero un
--   `select * from parlamentario where id = ...` con el rol anon devuelve 0 filas
--   (RLS niega) → la página haría `notFound()` para un parlamentario que SÍ existe.
--
-- SOLUCIÓN (espejo EXACTO de `rebeldias_de_parlamentario` en 0019):
--   RPC `security definer` que corre con privilegios del owner para leer la maestra
--   internamente, pero DEVUELVE SOLO los campos públicos-seguros de la cabecera.
--   NUNCA emite `partido` (afiliación política, dato SENSIBLE Ley 21.719), `rut`
--   ni `email` — esos quedan estrictamente internos (LEGAL-03). El chip de bancada/
--   partido de UI-SPEC §3.1 queda OMITIDO en la UI en consecuencia: no es
--   anon-readable y exponerlo violaría el piso de PII.
--
-- PROHIBIDO en esta migración (violaría LEGAL-03): NINGUNA `create policy` sobre
-- `parlamentario`, NINGÚN `grant select` que exponga `partido`/`rut`/`email` a anon.
-- El único canal a la maestra es el cuerpo de este `security definer`, y solo emite
-- columnas públicas. `set search_path = ''` (V8): nombres calificados con schema.
--
-- La APLICACIÓN del DDL + la corrida pgTAP NO se hacen aquí: son un checkpoint de
-- OPERADOR (igual que 0018/0019). build/typecheck NO prueban que Postgres ejecutó la
-- migración (RESEARCH Pitfall 5: BOM en .env rompe el CLI → pasar --db-url explícito).

create or replace function parlamentario_publico(p_id text)
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text,
  origen text, fecha_captura timestamptz, enlace text
)
language sql stable security definer set search_path = '' as $$
  select p.id,
         -- nombre legible: usa el normalizado como respaldo si no hay desglose.
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara,
         p.region, p.distrito, p.circunscripcion, p.periodo,
         p.origen, p.fecha_captura, p.enlace
  from public.parlamentario p
  where p.id = p_id;
$$;

-- grant execute a anon sobre la firma EXACTA (sin esto la ficha no lee la cabecera).
-- NO se añade ninguna policy ni grant select sobre `parlamentario` (partido/rut/email
-- siguen deny-by-default; el RPC nunca los emite).
grant execute on function parlamentario_publico(text) to anon;
