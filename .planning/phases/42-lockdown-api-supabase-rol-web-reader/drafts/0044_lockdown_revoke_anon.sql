-- 0044_lockdown_revoke_anon.sql
--
-- ████ LOCKDOWN-02 — PASO 3 (ÚLTIMO) DEL CUTOVER. LEER ANTES DE APLICAR. ████
--
-- Mata el canal de API público de Supabase: anon y authenticated pierden TODOS sus
-- permisos sobre tablas, funciones y secuencias del schema public, y las 26 policies
-- `*_public_read` (to anon) son eliminadas. Tras esta migración, cualquier llamada
-- a la API PostgREST con la anon key devuelve `permission denied`/42501.
--
-- ORDEN DE CUTOVER (GATE 1 — CRÍTICO, CARGADOR DE SITIO):
--   1. Aplicar LOCKDOWN-01 (0043) — crea web_reader + le concede el set curado.
--   2. Deployar LOCKDOWN-03 (Cloudflare) — el servidor lee como web_reader.
--   3. Aplicar ESTA migración (0044) — revoca anon/authenticated. ← ESTÁS AQUÍ.
--
--   ⚠  Aplicar 0044 ANTES de que el servidor esté en web_reader = SITIO CAÍDO.
--   ⚠  No hay autoconfirmación de que el deploy de Cloudflare esté vivo: el
--      operador DEBE verificar el sitio (HTTP 200 en /parlamentarios, /agenda,
--      búsqueda, etc.) antes de correr este script.
--
-- ROLLBACK de emergencia (si algo sale mal post-apply):
--   Si el sitio cae, el rollback mínimo es re-conceder a anon:
--     GRANT SELECT ON TABLE <tablas> TO anon;
--     GRANT EXECUTE ON FUNCTION <RPCs> TO anon;
--     CREATE POLICY <tabla>_public_read ON <tabla> FOR SELECT TO anon USING (true);
--   Script de rollback completo: ver 0043_lockdown_web_reader.sql (replica el set).
--   Tras el rollback, el sitio vuelve al estado pre-0044 sin pérdida de datos.
--
-- DECISIÓN — USAGE ON SCHEMA public NO se revoca de anon:
--   Revocar USAGE haría que cualquier consulta de anon devuelva "schema no existe"
--   en vez del 42501 más informativo. Como anon no tiene grant sobre ningún objeto,
--   el USAGE vacío es inofensivo. Mantenerlo minimiza el blast radius y simplifica
--   el rollback (no hay que re-conceder USAGE). Esta decisión es revisable en una
--   migración posterior de higiene.
--
-- ALCANCE: solo anon y authenticated. service_role, web_reader y el path de ingesta
-- (cron/Edge Functions) NO se tocan.
--
-- Aplicar:
--   psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0044_lockdown_revoke_anon.sql
--   # + INSERT en schema_migrations (ver convención repo)
-- Verificar post-apply:
--   psql -tA -f supabase/tests/post-apply/0044_revoke_anon.test.sql
-- ████████████████████████████████████████████████████████████████████████████████


-- ── Guard: web_reader DEBE existir antes de revocar a anon ───────────────────────
-- Protege contra la aplicación en orden incorrecto (0044 antes de 0043).
-- Si web_reader aún no existe, el sitio quedaría caído sin remedio inmediato.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'web_reader') then
    raise exception
      '0044 abortada: el rol web_reader no existe. '
      'Aplicar LOCKDOWN-01 (0043) y deployar el servidor web_reader ANTES de este script.';
  end if;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN 1 — DROP de las 26 policies `*_public_read` (to anon)
--
-- Con RLS habilitada y sin ninguna policy permisiva FOR SELECT, Postgres niega
-- por defecto toda lectura de anon sobre estas tablas (deny-by-default efectivo).
-- Las policies `*_public_read_wr` (FOR SELECT TO web_reader) se conservan intactas.
-- Usar DROP POLICY IF EXISTS para idempotencia (re-aplicar no falla).
-- ════════════════════════════════════════════════════════════════════════════════

drop policy if exists aporte_public_read                   on public.aporte;
drop policy if exists aportes_ingesta_estado_public_read   on public.aportes_ingesta_estado;
drop policy if exists citacion_public_read                 on public.citacion;
drop policy if exists citacion_invitado_public_read        on public.citacion_invitado;
drop policy if exists citacion_punto_public_read           on public.citacion_punto;
drop policy if exists contrato_public_read                 on public.contrato;
drop policy if exists contratos_ingesta_estado_public_read on public.contratos_ingesta_estado;
drop policy if exists declaracion_public_read              on public.declaracion;
drop policy if exists declaracion_accion_derecho_public_read  on public.declaracion_accion_derecho;
drop policy if exists declaracion_actividad_public_read    on public.declaracion_actividad;
drop policy if exists declaracion_bien_inmueble_public_read on public.declaracion_bien_inmueble;
drop policy if exists declaracion_bien_mueble_public_read  on public.declaracion_bien_mueble;
drop policy if exists declaracion_pasivo_public_read       on public.declaracion_pasivo;
drop policy if exists declaracion_valor_public_read        on public.declaracion_valor;
drop policy if exists lobby_audiencia_public_read          on public.lobby_audiencia;
drop policy if exists lobby_ingesta_estado_public_read     on public.lobby_ingesta_estado;
drop policy if exists probidad_ingesta_estado_public_read  on public.probidad_ingesta_estado;
drop policy if exists proyecto_public_read                 on public.proyecto;
drop policy if exists proyecto_embedding_public_read       on public.proyecto_embedding;
drop policy if exists proyecto_ficha_public_read           on public.proyecto_ficha;
drop policy if exists sector_public_read                   on public.sector;
drop policy if exists sesion_sala_public_read              on public.sesion_sala;
drop policy if exists sesion_tabla_item_public_read        on public.sesion_tabla_item;
drop policy if exists tramitacion_evento_public_read       on public.tramitacion_evento;
drop policy if exists votacion_public_read                 on public.votacion;
drop policy if exists voto_public_read                     on public.voto;
-- Total: 26 policies — matches el inventario PROD (_FACTS-live-prod.md §"26 RLS SELECT policies").


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN 2 — REVOKE de grants de objeto (tablas, funciones, secuencias)
--
-- Revoca los privilegios concretos que anon/authenticated tienen HOY en PROD
-- (ALL sobre todas las tablas + EXECUTE sobre todas las funciones + USAGE sobre
-- secuencias — concedidos por los ALTER DEFAULT PRIVILEGES de Supabase en el
-- momento de la creación de cada objeto).
-- ════════════════════════════════════════════════════════════════════════════════

revoke all on all tables     in schema public from anon, authenticated;
revoke all on all routines   in schema public from anon, authenticated;
revoke all on all sequences  in schema public from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN 3 — ALTER DEFAULT PRIVILEGES (protección durable ante objetos futuros)
--
-- Sin esto, el próximo `CREATE TABLE` en schema public (por cualquier role cuyo
-- ALTER DEFAULT PRIVILEGES esté activo) re-concedería ALL a anon/authenticated
-- silenciosamente — el gotcha recurrente del repo documentado en el FACTS y en
-- memory/v4-cruces-progreso.md.
--
-- ADVERTENCIA — rol propietario de los ALTER DEFAULT PRIVILEGES en Supabase:
--   Los grants que hoy tiene anon (ALL on tables, EXECUTE on functions) fueron
--   creados por Supabase mediante `ALTER DEFAULT PRIVILEGES FOR ROLE postgres
--   IN SCHEMA public GRANT ... TO anon`. El revoke de default privileges SOLO
--   afecta a los privileges que creó EL ROL QUE EJECUTA ESTE BLOQUE.
--
--   Si esta migración corre como el rol de migraciones habitual del repo
--   (normalmente `postgres` o el propietario del schema, ver SUPABASE_DB_URL),
--   los tres REVOKE DEFAULT PRIVILEGES de abajo neutralizan los grants baked-in
--   de Supabase y protegen objetos futuros.
--
--   Si el runner NO es `postgres` (p.ej. un rol de app sin superuser), añadir:
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--       REVOKE ALL ON TABLES    FROM anon, authenticated;
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--       REVOKE ALL ON ROUTINES  FROM anon, authenticated;
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--       REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--   (con FOR ROLE postgres explícito).
--
--   FLAG PARA EL VALIDADOR OPUS: confirmar, en el entorno PROD (SUPABASE_DB_URL),
--   que `current_role` al momento de aplicar = `postgres`; si es otro, agregar el
--   bloque FOR ROLE postgres explícito (o ambos, no son excluyentes). Sin esto,
--   los objetos futuros creados por `postgres` seguirán re-concediendo a anon.
-- ════════════════════════════════════════════════════════════════════════════════

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on routines  from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
