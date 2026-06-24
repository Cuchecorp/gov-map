-- 0044_lockdown_revoke_anon.sql
--
-- ████ LOCKDOWN-02 — PASO 3 DE 3 (ÚLTIMO) DEL CUTOVER. LEER ANTES DE APLICAR. ████
--
-- Mata el canal de API público de Supabase: anon y authenticated pierden TODOS sus
-- permisos sobre tablas, funciones y secuencias del schema public, y las 26 policies
-- `*_public_read` (to anon) son eliminadas. Tras esta migración, cualquier llamada
-- a la API PostgREST con la anon key devuelve `permission denied`/42501.
--
-- ORDEN DE CUTOVER (GATE 1 — CRÍTICO, CARGADOR DE SITIO):
--   1. Aplicar LOCKDOWN-01 (0043) — crea web_reader + le concede el set curado.
--   2. Deployar LOCKDOWN-03 (Cloudflare) — el servidor lee como web_reader.
--      Verificar que el SITIO ESTÉ VIVO (HTTP 200 en /parlamentarios, /agenda,
--      búsqueda, votaciones, lobby, patrimonio, dinero, NET, cruces, proyecto).
--   3. Aplicar ESTA migración (0044) — revoca anon/authenticated. ← ESTÁS AQUÍ.
--
--   ⚠  SITIO CAÍDO si 0044 se aplica ANTES de que el servidor esté en web_reader.
--   ⚠  El operador DEBE verificar el sitio antes de correr este script.
--
-- ROLLBACK de emergencia — reverse-0044 (si el sitio cae tras aplicar):
--   Recrear las 26 policies _public_read to anon:
--     CREATE POLICY aporte_public_read ON public.aporte FOR SELECT TO anon USING (true);
--     CREATE POLICY aportes_ingesta_estado_public_read ON public.aportes_ingesta_estado FOR SELECT TO anon USING (true);
--     CREATE POLICY citacion_public_read ON public.citacion FOR SELECT TO anon USING (true);
--     CREATE POLICY citacion_invitado_public_read ON public.citacion_invitado FOR SELECT TO anon USING (true);
--     CREATE POLICY citacion_punto_public_read ON public.citacion_punto FOR SELECT TO anon USING (true);
--     CREATE POLICY contrato_public_read ON public.contrato FOR SELECT TO anon USING (true);
--     CREATE POLICY contratos_ingesta_estado_public_read ON public.contratos_ingesta_estado FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_public_read ON public.declaracion FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_accion_derecho_public_read ON public.declaracion_accion_derecho FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_actividad_public_read ON public.declaracion_actividad FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_bien_inmueble_public_read ON public.declaracion_bien_inmueble FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_bien_mueble_public_read ON public.declaracion_bien_mueble FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_pasivo_public_read ON public.declaracion_pasivo FOR SELECT TO anon USING (true);
--     CREATE POLICY declaracion_valor_public_read ON public.declaracion_valor FOR SELECT TO anon USING (true);
--     CREATE POLICY lobby_audiencia_public_read ON public.lobby_audiencia FOR SELECT TO anon USING (true);
--     CREATE POLICY lobby_ingesta_estado_public_read ON public.lobby_ingesta_estado FOR SELECT TO anon USING (true);
--     CREATE POLICY probidad_ingesta_estado_public_read ON public.probidad_ingesta_estado FOR SELECT TO anon USING (true);
--     CREATE POLICY proyecto_public_read ON public.proyecto FOR SELECT TO anon USING (true);
--     CREATE POLICY proyecto_embedding_public_read ON public.proyecto_embedding FOR SELECT TO anon USING (true);
--     CREATE POLICY proyecto_ficha_public_read ON public.proyecto_ficha FOR SELECT TO anon USING (true);
--     CREATE POLICY sector_public_read ON public.sector FOR SELECT TO anon USING (true);
--     CREATE POLICY sesion_sala_public_read ON public.sesion_sala FOR SELECT TO anon USING (true);
--     CREATE POLICY sesion_tabla_item_public_read ON public.sesion_tabla_item FOR SELECT TO anon USING (true);
--     CREATE POLICY tramitacion_evento_public_read ON public.tramitacion_evento FOR SELECT TO anon USING (true);
--     CREATE POLICY votacion_public_read ON public.votacion FOR SELECT TO anon USING (true);
--     CREATE POLICY voto_public_read ON public.voto FOR SELECT TO anon USING (true);
--   Re-conceder grants a anon:
--     GRANT SELECT ON TABLE public.aporte, public.aportes_ingesta_estado, public.citacion,
--       public.citacion_invitado, public.citacion_punto, public.contrato,
--       public.contratos_ingesta_estado, public.declaracion, public.declaracion_accion_derecho,
--       public.declaracion_actividad, public.declaracion_bien_inmueble,
--       public.declaracion_bien_mueble, public.declaracion_pasivo, public.declaracion_valor,
--       public.lobby_audiencia, public.lobby_ingesta_estado, public.probidad_ingesta_estado,
--       public.proyecto, public.proyecto_embedding, public.proyecto_ficha, public.sector,
--       public.sesion_sala, public.sesion_tabla_item, public.tramitacion_evento,
--       public.votacion, public.voto TO anon, authenticated;
--     GRANT EXECUTE ON FUNCTION
--       public.agregado_por_contraparte(text),
--       public.aportes_de_parlamentario(text),
--       public.bienes_de_parlamentario(text),
--       public.buscar_citaciones(text, integer, text),
--       public.comparar_declaraciones(text, date[]),
--       public.contratos_de_parlamentario(text),
--       public.declaraciones_de_parlamentario(text),
--       public.lobby_de_parlamentario(text),
--       public.match_proyectos(vector, integer, double precision, text),
--       public.parlamentario_publico(text),
--       public.parlamentarios_publico(),
--       public.rebeldias_de_parlamentario(text),
--       public.subgrafo_red(text, integer, text[], timestamptz, timestamptz),
--       public.votos_de_parlamentario(text, integer, integer)
--     TO anon, authenticated;
--     GRANT EXECUTE ON FUNCTION public.cruces_de_parlamentario(text) TO anon;
--   Reversar el ALTER DEFAULT PRIVILEGES (re-grant):
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
--
-- DECISIÓN — USAGE ON SCHEMA public NO se revoca de anon:
--   Revocar USAGE devolvería "schema no existe" en vez del 42501 informativo. Con cero
--   grants de objeto, el USAGE vacío es inofensivo. Minimiza blast radius y simplifica
--   rollback. Revisable en migración de higiene posterior.
--
-- ALCANCE: solo anon y authenticated. service_role, web_reader y el path de ingesta
-- (cron/Edge Functions) NO se tocan.
--
-- Aplicar (SOLO DESPUÉS de 0043 aplicada y LOCKDOWN-03 deployado+verificado):
--   psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0044_lockdown_revoke_anon.sql
--   # + INSERT en schema_migrations versión 0044 (convención repo)
-- Verificar post-apply:
--   psql -tA -f supabase/tests/post-apply/0044_revoke_anon.test.sql
-- ████████████████████████████████████████████████████████████████████████████████


-- ── Guard: web_reader DEBE existir antes de revocar a anon ───────────────────────
-- Protege contra la aplicación en orden incorrecto (0044 antes de 0043 + deploy 03).
-- Si web_reader aún no existe, el sitio quedaría caído sin remedio inmediato.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'web_reader') then
    raise exception
      '0044 abortada: el rol web_reader no existe. '
      'Aplicar LOCKDOWN-01 (0043) y deployar el servidor web_reader (LOCKDOWN-03) ANTES de este script.';
  end if;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN 1 — DROP de las 26 policies `*_public_read` (to anon)
--
-- Con RLS habilitada y sin ninguna policy permisiva FOR SELECT, Postgres niega
-- por defecto toda lectura de anon sobre estas tablas (deny-by-default efectivo).
-- Las policies `*_public_read_wr` (FOR SELECT TO web_reader) se conservan intactas.
-- DROP POLICY IF EXISTS garantiza idempotencia (re-aplicar no falla).
-- ════════════════════════════════════════════════════════════════════════════════

drop policy if exists aporte_public_read                      on public.aporte;
drop policy if exists aportes_ingesta_estado_public_read      on public.aportes_ingesta_estado;
drop policy if exists citacion_public_read                    on public.citacion;
drop policy if exists citacion_invitado_public_read           on public.citacion_invitado;
drop policy if exists citacion_punto_public_read              on public.citacion_punto;
drop policy if exists contrato_public_read                    on public.contrato;
drop policy if exists contratos_ingesta_estado_public_read    on public.contratos_ingesta_estado;
drop policy if exists declaracion_public_read                 on public.declaracion;
drop policy if exists declaracion_accion_derecho_public_read  on public.declaracion_accion_derecho;
drop policy if exists declaracion_actividad_public_read       on public.declaracion_actividad;
drop policy if exists declaracion_bien_inmueble_public_read   on public.declaracion_bien_inmueble;
drop policy if exists declaracion_bien_mueble_public_read     on public.declaracion_bien_mueble;
drop policy if exists declaracion_pasivo_public_read          on public.declaracion_pasivo;
drop policy if exists declaracion_valor_public_read           on public.declaracion_valor;
drop policy if exists lobby_audiencia_public_read             on public.lobby_audiencia;
drop policy if exists lobby_ingesta_estado_public_read        on public.lobby_ingesta_estado;
drop policy if exists probidad_ingesta_estado_public_read     on public.probidad_ingesta_estado;
drop policy if exists proyecto_public_read                    on public.proyecto;
drop policy if exists proyecto_embedding_public_read          on public.proyecto_embedding;
drop policy if exists proyecto_ficha_public_read              on public.proyecto_ficha;
drop policy if exists sector_public_read                      on public.sector;
drop policy if exists sesion_sala_public_read                 on public.sesion_sala;
drop policy if exists sesion_tabla_item_public_read           on public.sesion_tabla_item;
drop policy if exists tramitacion_evento_public_read          on public.tramitacion_evento;
drop policy if exists votacion_public_read                    on public.votacion;
drop policy if exists voto_public_read                        on public.voto;
-- Total: 26 policies — coincide con el inventario PROD (_FACTS-live-prod.md §"26 RLS SELECT policies").
-- Las policies `*_public_read_wr` (to web_reader) NO se tocan.


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN 2 — REVOKE de grants de objeto (tablas, funciones, secuencias)
--
-- Revoca los privilegios concretos que anon/authenticated tienen HOY en PROD
-- (ALL sobre todas las tablas + EXECUTE sobre todas las funciones + USAGE sobre
-- secuencias — concedidos por los ALTER DEFAULT PRIVILEGES de Supabase al crear
-- cada objeto). El catch-all es correcto y requerido: anon/authenticated tienen
-- SELECT en 35 tablas + 2 vistas (no solo las 26) — ver VALIDATION B1.
-- ════════════════════════════════════════════════════════════════════════════════

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all routines  in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN 3 — ALTER DEFAULT PRIVILEGES FOR ROLE postgres (protección durable)
--
-- Sin esto, el próximo `CREATE TABLE/FUNCTION` creado por el rol `postgres`
-- re-concedería ALL a anon/authenticated silenciosamente — el gotcha recurrente
-- del repo (documentado en _FACTS-live-prod.md, 42-VALIDATION.md BLOCKER 2,
-- memory/v4-cruces-progreso.md).
--
-- FOR ROLE postgres EXPLÍCITO (BLOCKER 2 resuelto):
--   La conexión al aplicar esta migración es `postgres` (ver _FACTS §"connection
--   role = postgres"). Los grants actuales de anon fueron creados por Supabase
--   mediante `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ...
--   TO anon`. Para revertirlos se requiere `FOR ROLE postgres` EXPLÍCITO; sin él,
--   el revoke afectaría solo los default privileges del rol de conexión actual,
--   que podría diferir. Ver 42-VALIDATION.md BLOCKER 2.
--
--   El rol `supabase_admin` tiene default ACLs propios pero sobre objetos internos
--   de Supabase (no datos del proyecto), y postgres no puede alterarlos; el guard
--   de CI cubre esa superficie.
-- ════════════════════════════════════════════════════════════════════════════════

alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on routines  from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
