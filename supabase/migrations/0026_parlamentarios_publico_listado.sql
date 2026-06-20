-- 0026_parlamentarios_publico_listado.sql
-- Directorio público de parlamentarios (SC2, ruta /parlamentarios).
--
-- POR QUÉ existe (brecha de descubrimiento expuesta por el deploy de Phase 20):
--   hoy solo existe `/parlamentario/[id]` por id directo (D####/S####) — el
--   ciudadano no puede DESCUBRIR un parlamentario sin conocer su id. El directorio
--   necesita LISTAR los 186, pero `parlamentario` es deny-by-default (0005/0018):
--   RLS habilitada, CERO policies, anon NO lee NINGUNA columna directamente. Un
--   `select * from parlamentario` con el rol anon devuelve 0 filas (RLS niega).
--
-- SOLUCIÓN (espejo EXACTO de `parlamentario_publico` en 0020):
--   RPC `security definer` SIN parámetro que corre con privilegios del owner para
--   leer la maestra internamente, pero DEVUELVE SOLO las 7 columnas de cabecera
--   públicas-seguras. NUNCA emite `partido` (afiliación política, dato SENSIBLE
--   Ley 21.719), `rut` ni `email` — esos quedan estrictamente internos (LEGAL-03).
--   Frente a 0020: (1) se ELIMINA el parámetro `p_id text` y el `where p.id = p_id`;
--   (2) se AÑADE un `order by` NEUTRAL (§10.5 — orden alfabético estable, jamás un
--   "ranking"); (3) se OMITEN las columnas de provenance (origen/fecha_captura/
--   enlace) — el listado no las usa (las renderiza la ficha individual, no la fila).
--
-- PROHIBIDO en esta migración (violaría LEGAL-03): NINGUNA `create policy` sobre
-- `parlamentario`, NINGÚN `grant select` que exponga `partido`/`rut`/`email` a anon.
-- El único canal a la maestra es el cuerpo de este `security definer`, y solo emite
-- columnas públicas. `set search_path = ''` (V8): nombres calificados con schema.
--
-- La APLICACIÓN del DDL + la corrida pgTAP NO se hacen aquí: son un checkpoint de
-- OPERADOR (igual que 0018/0019/0020). build/typecheck NO prueban que Postgres
-- ejecutó la migración (BOM en .env rompe el CLI → pasar --db-url explícito).

create or replace function parlamentarios_publico()
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text
)
language sql stable security definer set search_path = '' as $$
  select p.id,
         -- nombre legible: usa el normalizado como respaldo si no hay desglose.
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara,
         -- region/distrito/circunscripcion/periodo son NULLABLE (0005): se emiten
         -- tal cual; el filtro que los excluye vive en el RSC, no aquí (Pitfall 5).
         p.region, p.distrito, p.circunscripcion, p.periodo
  from public.parlamentario p
  order by p.apellido_paterno nulls last, p.nombre_normalizado;  -- orden NEUTRAL (§10.5)
$$;

-- grant execute a anon sobre la firma EXACTA (sin esto el directorio no lista nada).
-- NO se añade ninguna policy ni grant select sobre `parlamentario` (partido/rut/email
-- siguen deny-by-default; el RPC nunca los emite).
grant execute on function parlamentarios_publico() to anon;
