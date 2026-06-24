-- 0043_lockdown_web_reader.sql
--
-- ████ LOCKDOWN-01: CREAR ROL web_reader — SIN EFECTO SOBRE LA API ACTUAL ████
--
-- PASO 1 de 3 en el cutover de Phase 42. Este script:
--   * Crea el rol dedicado `web_reader` (NOLOGIN) y lo conecta al gateway
--     PostgREST vía `grant web_reader to authenticator`.
--   * Replica EXACTAMENTE el set efectivo que `anon` tiene hoy en PROD
--     (inventario auditado en _FACTS-live-prod.md, 2026-06-24).
--   * Recrea las 26 RLS policies `*_public_read` como políticas paralelas
--     `*_public_read_wr` apuntando a `web_reader`.
--   * NO REVOCA NADA de `anon` ni de `authenticated`.
--   * NO TIENE NINGÚN EFECTO SOBRE LA API PÚBLICA ACTUAL.
--
-- ORDEN DE CUTOVER (CRÍTICO — gate inviolable):
--   1. Aplicar ESTE script (0043) → web_reader existe + tiene grants.
--   2. Deployar LOCKDOWN-03 (servidor Next.js cambia a JWT web_reader en Cloudflare).
--   3. SOLO ENTONCES aplicar LOCKDOWN-02 (0044) → revoke anon/authenticated.
--   Aplicar 0044 antes del paso 2 = sitio caído (servidor sigue leyendo como anon).
--
-- APLICACIÓN:
--   psql "$SUPABASE_DB_URL" --single-transaction -f 0043_lockdown_web_reader.sql
--   + insertar fila en schema_migrations (ver convención CLAUDE.md).
--   Windows: PGCLIENTENCODING=UTF8
--
-- ████████████████████████████████████████████████████████████████████████████████

-- ── 1. Crear el rol web_reader (idempotente) ──────────────────────────────────
-- NOLOGIN: no puede conectarse directamente. PostgREST hace `set role web_reader`
-- porque authenticator es miembro → los requests con JWT { "role": "web_reader" }
-- corren bajo este rol y RLS le sigue aplicando (NO bypassa PII).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'web_reader') then
    create role web_reader nologin;
  end if;
end;
$$;

-- ── 2. Permitir que PostgREST haga SET ROLE web_reader ────────────────────────
-- authenticator es el rol de login de PostgREST en Supabase. Sin este grant,
-- los JWT con claim { "role": "web_reader" } serán rechazados por PostgREST.
grant web_reader to authenticator;

-- ── 3. Acceso al schema ───────────────────────────────────────────────────────
grant usage on schema public to web_reader;

-- ── 4. Grants amplios (espejo del set efectivo de anon en PROD) ───────────────
--
-- Decisión de diseño: usamos GRANT SELECT ON ALL TABLES + GRANT EXECUTE ON ALL
-- ROUTINES (en lugar de un subconjunto hand-picked) por las razones siguientes:
--
--   a) anon tiene ALL TABLE privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--      REFERENCES, TRIGGER) sobre TODAS las tablas de public por el DEFAULT
--      PRIVILEGE de Supabase. Los writes son inactivos (RLS no tiene policy
--      permisiva de escritura para anon). web_reader es read-only → solo SELECT.
--      GRANT SELECT ⊂ anon's effective set; los writes que anon "tiene" pero no
--      puede usar tampoco los necesita web_reader. Esto es más seguro, no menos.
--
--   b) anon tiene EXECUTE en TODAS las funciones de public, incluyendo las
--      funciones de pgvector (vector_*, halfvec_*, cosine_distance, <=>, etc.)
--      y los helpers pgTAP (_*, has_*, ok, is, ...). Sin EXECUTE en ALL ROUTINES,
--      los RPCs secdef=false (match_proyectos, buscar_citaciones, rebeldias_de_
--      parlamentario, votos_de_parlamentario, rebeldias_de_parlamentario) fallan
--      al invocar los operadores pgvector internamente → GRANT ON ALL ROUTINES
--      es necesario para que la funcionalidad sea idéntica a anon.
--
--   c) NO se conceden secuencias (USAGE ON ALL SEQUENCES): web_reader es
--      estrictamente read-only; las secuencias son para INSERT (irrelevante).
--      Esto es un subset más seguro que anon (anon tiene USAGE en 27 secuencias
--      por default privilege; no las necesita para leer).
--
-- EXCLUSIÓN EXPLÍCITA (ver bloque de revoke abajo): resolver_entidad.

grant select on all tables in schema public to web_reader;
grant execute on all routines in schema public to web_reader;

-- ── 5. Excluir resolver_entidad explícitamente ────────────────────────────────
--
-- FACTS confirman: `resolver_entidad` tiene anon=false (anon NO tiene EXECUTE).
-- El GRANT ON ALL ROUTINES de arriba SÍ lo concede a web_reader (más que anon).
-- Opción A: confiar en que resolver_entidad tiene su propia guarda interna de
--   admin → safe aunque web_reader lo invoque (defensivo, menor riesgo).
-- Opción B: revoke explícito para reflejar EXACTAMENTE el set de anon (gate 3).
--
-- DECISIÓN: opción B — revoke explícito. Principio: "exactamente el set de anon"
-- es más fácil de auditar y mantener. Si el cuerpo de resolver_entidad cambia,
-- no queremos que web_reader herede el acceso silenciosamente.
--
-- ⚠ VALIDADORES OPUS: confirmar firma exacta de resolver_entidad en PROD
-- (pg_proc.proargtypes). Se usa la forma genérica schema-qualified; si tiene
-- sobrecarga o firma distinta, este revoke puede no aplicar correctamente.
-- Alternativa: `revoke execute on all routines in schema public from web_reader`
-- + re-grant de las 15 RPCs individualmente (más verboso pero 100% exacto).
-- Recomendamos verificar con:
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'resolver_entidad';

revoke execute on function public.resolver_entidad(text) from web_reader;

-- ── 6. Políticas RLS paralelas para web_reader (las 26 tablas public_read) ────
--
-- RLS está habilitada en TODAS las tablas de public. A pesar del GRANT SELECT,
-- sin una policy permisiva FOR SELECT TO web_reader las tablas devuelven 0 filas
-- (deny-by-default de RLS). Se recrean las 26 policies `<tabla>_public_read`
-- como `<tabla>_public_read_wr` (sufijo _wr = web_reader) para evitar colisión
-- de nombres con las policies existentes de anon.
--
-- Cada policy es idempotente: drop-if-exists + create.
-- Inventario exacto = _FACTS-live-prod.md § "26 RLS SELECT policies".
-- Tablas PII (deny-by-default) NO reciben policy → anon/web_reader sigue leyendo
-- 0 filas en parlamentario, donante, pii_contraparte_declaracion, entidad, etc.

-- aporte
drop policy if exists aporte_public_read_wr on aporte;
create policy aporte_public_read_wr
  on aporte for select to web_reader using (true);

-- aportes_ingesta_estado
drop policy if exists aportes_ingesta_estado_public_read_wr on aportes_ingesta_estado;
create policy aportes_ingesta_estado_public_read_wr
  on aportes_ingesta_estado for select to web_reader using (true);

-- citacion
drop policy if exists citacion_public_read_wr on citacion;
create policy citacion_public_read_wr
  on citacion for select to web_reader using (true);

-- citacion_invitado
drop policy if exists citacion_invitado_public_read_wr on citacion_invitado;
create policy citacion_invitado_public_read_wr
  on citacion_invitado for select to web_reader using (true);

-- citacion_punto
drop policy if exists citacion_punto_public_read_wr on citacion_punto;
create policy citacion_punto_public_read_wr
  on citacion_punto for select to web_reader using (true);

-- contrato
drop policy if exists contrato_public_read_wr on contrato;
create policy contrato_public_read_wr
  on contrato for select to web_reader using (true);

-- contratos_ingesta_estado
drop policy if exists contratos_ingesta_estado_public_read_wr on contratos_ingesta_estado;
create policy contratos_ingesta_estado_public_read_wr
  on contratos_ingesta_estado for select to web_reader using (true);

-- declaracion
drop policy if exists declaracion_public_read_wr on declaracion;
create policy declaracion_public_read_wr
  on declaracion for select to web_reader using (true);

-- declaracion_accion_derecho
drop policy if exists declaracion_accion_derecho_public_read_wr on declaracion_accion_derecho;
create policy declaracion_accion_derecho_public_read_wr
  on declaracion_accion_derecho for select to web_reader using (true);

-- declaracion_actividad
drop policy if exists declaracion_actividad_public_read_wr on declaracion_actividad;
create policy declaracion_actividad_public_read_wr
  on declaracion_actividad for select to web_reader using (true);

-- declaracion_bien_inmueble
drop policy if exists declaracion_bien_inmueble_public_read_wr on declaracion_bien_inmueble;
create policy declaracion_bien_inmueble_public_read_wr
  on declaracion_bien_inmueble for select to web_reader using (true);

-- declaracion_bien_mueble
drop policy if exists declaracion_bien_mueble_public_read_wr on declaracion_bien_mueble;
create policy declaracion_bien_mueble_public_read_wr
  on declaracion_bien_mueble for select to web_reader using (true);

-- declaracion_pasivo
drop policy if exists declaracion_pasivo_public_read_wr on declaracion_pasivo;
create policy declaracion_pasivo_public_read_wr
  on declaracion_pasivo for select to web_reader using (true);

-- declaracion_valor
drop policy if exists declaracion_valor_public_read_wr on declaracion_valor;
create policy declaracion_valor_public_read_wr
  on declaracion_valor for select to web_reader using (true);

-- lobby_audiencia
drop policy if exists lobby_audiencia_public_read_wr on lobby_audiencia;
create policy lobby_audiencia_public_read_wr
  on lobby_audiencia for select to web_reader using (true);

-- lobby_ingesta_estado
drop policy if exists lobby_ingesta_estado_public_read_wr on lobby_ingesta_estado;
create policy lobby_ingesta_estado_public_read_wr
  on lobby_ingesta_estado for select to web_reader using (true);

-- probidad_ingesta_estado
drop policy if exists probidad_ingesta_estado_public_read_wr on probidad_ingesta_estado;
create policy probidad_ingesta_estado_public_read_wr
  on probidad_ingesta_estado for select to web_reader using (true);

-- proyecto
drop policy if exists proyecto_public_read_wr on proyecto;
create policy proyecto_public_read_wr
  on proyecto for select to web_reader using (true);

-- proyecto_embedding
drop policy if exists proyecto_embedding_public_read_wr on proyecto_embedding;
create policy proyecto_embedding_public_read_wr
  on proyecto_embedding for select to web_reader using (true);

-- proyecto_ficha
drop policy if exists proyecto_ficha_public_read_wr on proyecto_ficha;
create policy proyecto_ficha_public_read_wr
  on proyecto_ficha for select to web_reader using (true);

-- sector
drop policy if exists sector_public_read_wr on sector;
create policy sector_public_read_wr
  on sector for select to web_reader using (true);

-- sesion_sala
drop policy if exists sesion_sala_public_read_wr on sesion_sala;
create policy sesion_sala_public_read_wr
  on sesion_sala for select to web_reader using (true);

-- sesion_tabla_item
drop policy if exists sesion_tabla_item_public_read_wr on sesion_tabla_item;
create policy sesion_tabla_item_public_read_wr
  on sesion_tabla_item for select to web_reader using (true);

-- tramitacion_evento
drop policy if exists tramitacion_evento_public_read_wr on tramitacion_evento;
create policy tramitacion_evento_public_read_wr
  on tramitacion_evento for select to web_reader using (true);

-- votacion
drop policy if exists votacion_public_read_wr on votacion;
create policy votacion_public_read_wr
  on votacion for select to web_reader using (true);

-- voto
drop policy if exists voto_public_read_wr on voto;
create policy voto_public_read_wr
  on voto for select to web_reader using (true);

-- ── FIN LOCKDOWN-01 ───────────────────────────────────────────────────────────
-- web_reader ahora espeja el set efectivo de anon. La API pública sigue intacta.
-- Siguiente paso: LOCKDOWN-03 (deploy Cloudflare con JWT web_reader) → luego 0044.
