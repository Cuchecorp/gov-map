-- 0049_cruces_de_proyecto.sql
-- SURF-02 (Phase 38 — surf-superficie-de-cruces-en-ficha-de-proyecto) — RPC
-- `cruces_de_proyecto(p_boletin text)`: la única vía pública PII-safe que YUXTAPONE,
-- sobre la ficha de un proyecto, dos hechos de fuentes distintas:
--   (1) que un PARLAMENTARIO votó A FAVOR del boletín (`voto.seleccion='si'` sobre una
--       `votacion` de ese boletín, con `estado_vinculo='confirmado'`), y
--   (2) que ESE MISMO parlamentario registró reuniones de lobby EN EL SECTOR del
--       proyecto (`cruce_senal.sector_id` = `proyecto_ficha.sector_id`).
-- Es yuxtaposición PURA: la coincidencia es de SECTOR (temática), NUNCA causal. La RPC
-- solo devuelve hechos con su conteo, su evidencia fechada y su enlace; el caveat
-- anti-causal ("votó a favor y se reunió con el sector — coincidencia temática, no
-- implica relación") vive en la UI (Plan 02). NO hay flag nuevo (`*_PUBLIC_ENABLED`):
-- `crucesPublicEnabled()` ya está ON en PROD desde 2026-07-02 — este DDL NO lo toca.
--
-- POR QUÉ security definer (LEGAL-03, Ley 21.719): la RPC LEE INTERNAMENTE
-- `public.parlamentario` (deny-by-default: RLS on, cero policies, anon sin grant) para
-- resolver el nombre público del sujeto, y `public.cruce_senal` (tabla PII, deny-by-
-- default; solo el owner de la función puede tocarla). Pero el returns table SOLO emite
-- derivado público: `parlamentario_id` (= p.id, para el link /parlamentario/[id]) +
-- `nombre_normalizado` (proyección pública, espejo de parlamentario_publico/0020) +
-- catálogo público de sector + conteo neutro + evidencia jsonb PII-safe (nombre CRUDO de
-- contraparte, sin RUT — nace así en el materializador 0039). JAMÁS partido/rut/email.
-- CERO `create policy`, CERO `grant select` sobre `parlamentario`/`cruce_senal`.
--
-- RUTA DE SECTOR = Alternativa B `proyecto_ficha.sector_id` (VERIFIED psql PROD, 65/74
-- fichas pobladas, UN sector por proyecto). CERO fabricación: cuando `proyecto_ficha` no
-- existe para el boletín o `sector_id is null`, el CTE `sec` queda vacío → la RPC
-- devuelve 0 filas (empty honesto). NUNCA se inventa un sector vía comisión (mapeo
-- comisión→sector NO existe en el schema — descartado en RESEARCH §2).
--
-- SOLO votos CONFIRMADOS a favor (`seleccion='si'` + `estado_vinculo='confirmado'` +
-- `parlamentario_id` not null): un voto Senado por-nombre no confirmado NUNCA entra en el
-- set "a favor" (estado honesto, IDENT-12 — no se fabrica la intersección por adivinanza).
--
-- La última migración en disco es 0048_lobby_en_tramitacion.sql. Esta es la 0049.
-- La RPC es NUEVA; `drop function if exists` previo es idiom defensivo (gotcha 42P13).
--
-- ── ACL determinista (Camino A, espejo VERBATIM de 0047:101-102 / 0048:128-132) ──
-- Bajo Camino A (0044 APLICADA a PROD: `revoke all on all routines from anon,
-- authenticated`; anon REST muerta 401/42501) el sitio lee con service_role (bypassa
-- ACL) y anon quedó a CERO grants. El DOBLE revoke explícito (`from public` +
-- `from anon, authenticated`) limpia la concesión que los DEFAULT PRIVILEGES del rol de
-- aplicación (p.ej. supabase_admin) re-conceden sobre cada función NUEVA de public → deja
-- el ACL determinista SEA CUAL SEA ese rol. CERO grant: re-emitir uno re-abriría
-- superficie REST no autenticada y rompería el pgTAP post-apply de 0044 y el guard CI
-- Block-A (lockdown-guard.test.ts, sin excepciones).
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Plan 03, patrón 52-06): `tsc`/`pnpm test` NO
-- prueban que Postgres ejecutó este DDL (falso positivo conocido, ver 0028/0047/0048).
-- La única prueba válida es el pgTAP (0049_*.test.sql) contra el schema APLICADO vía
-- `psql -tA -f`. Aplicar por `psql --db-url --single-transaction`, NUNCA `supabase db
-- push` (drift schema_migrations). PGCLIENTENCODING=UTF8 en Windows. La UI (Plan 02)
-- degrada honesta pre-apply (la RPC aún no existe en PROD → PGRST202 → null).

-- La RPC es nueva; drop defensivo previo al create (idiom 42P13, re-armar revokes después).
drop function if exists public.cruces_de_proyecto(text);

create or replace function public.cruces_de_proyecto(p_boletin text)
returns table (
  parlamentario_id   text,        -- p.id → link /parlamentario/[id]
  nombre_normalizado text,        -- proyección pública (NUNCA rut/partido/email)
  sector_id          text,
  sector_etiqueta    text,        -- catálogo público public.sector.etiqueta
  tipo_senal         text,        -- 'lobby_sector' (degradar honesto otro valor)
  conteo             int,         -- reuniones (conteo NEUTRO, §9.1 — sin score/ranking)
  evidencia          jsonb,       -- {conteo, items[]} PII-safe de cruce_senal (0039)
  fecha_captura      timestamptz  -- frescura del rebuild diario (WR-02/F41)
)
language sql stable security definer set search_path = '' as $$
  -- Sector ÚNICO del proyecto vía materia clasificada (Alt B, cero fabricación).
  -- Boletín sin ficha o sin sector → CTE vacío → 0 filas (empty honesto).
  with sec as (
    select sector_id
    from public.proyecto_ficha
    where boletin = p_boletin
      and sector_id is not null
  ),
  -- Parlamentarios que votaron 'si' (a favor) en votaciones del boletín, SOLO
  -- confirmados (IDENT-12: no se arrastran votos Senado por-nombre no confirmados).
  afavor as (
    select distinct v.parlamentario_id
    from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
    where vo.boletin = p_boletin
      and v.seleccion = 'si'
      and v.estado_vinculo = 'confirmado'
      and v.parlamentario_id is not null
  )
  -- cruce_senal ya está agregado por (parlamentario, sector) → filtrar por el sector
  -- del proyecto y por los votantes a-favor da UNA fila por parlamentario coincidente.
  select cs.parlamentario_id,
         p.nombre_normalizado,   -- lee la maestra deny-by-default INTERNAMENTE; emite solo el derivado público
         cs.sector_id,
         s.etiqueta,
         cs.tipo_senal,
         cs.conteo,
         cs.evidencia,
         cs.fecha_captura
  from public.cruce_senal cs
  join sec on cs.sector_id = sec.sector_id
  join afavor a on a.parlamentario_id = cs.parlamentario_id
  join public.sector s on s.codigo = cs.sector_id
  join public.parlamentario p on p.id = cs.parlamentario_id
  order by cs.conteo desc, p.nombre_normalizado asc;
$$;

-- ── ACL determinista: lock-down sin grants (Camino A, espejo de 0047/0048) ──
-- Función NUEVA → los DEFAULT PRIVILEGES pueden conceder EXECUTE por defecto; el DOBLE
-- revoke explícito lo limpia. CERO grant a anon/public: el sitio lee con service_role.
revoke all on function public.cruces_de_proyecto(text) from public;
revoke all on function public.cruces_de_proyecto(text) from anon, authenticated;
