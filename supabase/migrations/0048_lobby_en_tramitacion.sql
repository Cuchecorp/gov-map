-- 0048_lobby_en_tramitacion.sql
-- SC2/SC5 (Phase 52 — CRUCE2) — RPC `lobby_en_tramitacion(p_boletin text)`: la única
-- vía pública PII-safe que YUXTAPONE dos hechos fechados de fuentes distintas:
--   (1) que una COMISIÓN vio un boletín en cierta semana ISO (`citacion.semana_iso`
--       × `citacion_punto.boletin`), y
--   (2) que un PARLAMENTARIO registró una AUDIENCIA de lobby (`lobby_audiencia.fecha`)
--       que cae en ESA MISMA semana ISO.
-- Es yuxtaposición PURA: la coincidencia es TEMPORAL (misma semana), NUNCA causal.
-- La RPC solo devuelve hechos con su fecha y su enlace; el caveat anti-causal
-- ("coincidieron en el tiempo, no implica relación") vive en la UI (52-03). NO hay
-- flag nuevo (`*_PUBLIC_ENABLED`), NO hay `cruce_senal`, NO hay tipo_senal — este
-- cruce no materializa señales: recomputa en cada llamada desde tablas ya pobladas.
--
-- POR QUÉ security definer (LEGAL-03, Ley 21.719): la RPC LEE INTERNAMENTE
-- `parlamentario` (deny-by-default: RLS on, cero policies, anon sin grant) para
-- resolver el nombre público del sujeto pasivo, y `lobby_audiencia` (public-read).
-- Pero el returns table SOLO emite derivado público: `nombre_normalizado` (proyección
-- pública, espejo de parlamentario_publico/0020) + `camara`. JAMÁS partido/rut/email.
-- CERO `create policy`, CERO `grant select` sobre `parlamentario`.
--
-- SEMÁNTICA DE LA SEMANA ISO (supuesto A1, load-bearing — Pitfall 2 timezone):
--   El conector pobló `citacion.semana_iso` como "IYYY-Www" (0010). Para que una
--   audiencia de lobby caiga en la MISMA semana ISO hay que normalizar su `fecha`
--   (timestamptz) a la MISMA convención de huso con que se derivó `semana_iso`: la
--   agenda es de instituciones chilenas → `at time zone 'America/Santiago'` ANTES de
--   `to_char(..., 'IYYY"-W"IW')`. Sin el `at time zone` explícito, una reunión de la
--   tarde/noche (UTC del día siguiente) podría saltar de semana ISO y perder o fabricar
--   una coincidencia. NO es posible confirmar contra un par real `(fecha, semana_iso)`
--   sin PROD (checkpoint operador 52-06) → el `at time zone` queda EXPLÍCITO y este
--   supuesto documentado. `IW`/`IYYY` (ISO week / ISO year) es load-bearing: `WW`
--   (semana no-ISO) NO coincidiría con el formato de `semana_iso`.
--
-- SOLO audiencias CONFIRMADAS (`estado_vinculo = 'confirmado'` + `parlamentario_id`
-- not null): una audiencia sin sujeto pasivo confirmado NUNCA aparece bajo un boletín
-- (estado honesto, IDENT-12 — no se fabrica identidad por adivinanza).
--
-- La última migración en disco es 0047_rebeldias_honestas.sql. Esta es la 0048.
-- Función NUEVA → SIN `drop function` previo (0047 dropeó SOLO por cambiar el returns
-- table de una función ya existente; aquí no hay firma previa que cambiar).
--
-- ── ACL determinista (Camino A, espejo VERBATIM de 0047:101-102) ───────────────
-- Bajo Camino A (0044 APLICADA a PROD: `revoke all on all routines from anon,
-- authenticated`; anon REST muerta 401/42501) el sitio lee con service_role (bypassa
-- ACL) y anon quedó a CERO grants. El DOBLE revoke explícito (`from public` +
-- `from anon, authenticated`) limpia la concesión que los DEFAULT PRIVILEGES del rol
-- de aplicación (p.ej. supabase_admin) re-conceden sobre cada función NUEVA de public
-- → deja el ACL determinista SEA CUAL SEA ese rol. CERO grant: re-emitir uno re-abriría
-- superficie REST no autenticada y rompería el pgTAP post-apply de 0044 y el guard CI
-- Block-A (lockdown-guard.test.ts, sin excepciones).
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (52-06, acumulable con 0047): `tsc`/`pnpm test`
-- NO prueban que Postgres ejecutó este DDL (falso positivo conocido, ver 0028/0047).
-- La única prueba válida es el pgTAP (0048_*.test.sql) contra el schema APLICADO vía
-- `psql -tA -f`. Aplicar por `psql --db-url --single-transaction`, NUNCA `supabase db
-- push` (drift schema_migrations). PGCLIENTENCODING=UTF8 en Windows. La UI (52-03)
-- degrada honesta pre-apply (la RPC aún no existe en PROD).

create or replace function public.lobby_en_tramitacion(p_boletin text)
returns table (
  parlamentario_nombre text,
  camara               text,
  materia              text,
  fecha_reunion        timestamptz,
  semana_iso           text,
  comision             text,
  enlace_detalle       text
)
language sql stable security definer set search_path = '' as $$
  select p.nombre_normalizado,   -- proyección pública (espejo de parlamentario_publico/0020)
         p.camara,
         a.materia,
         a.fecha,
         c.semana_iso,
         c.comision,
         a.enlace_detalle
  from public.citacion c
  join public.citacion_punto cp on cp.citacion_id = c.id
  -- coincidencia por SEMANA ISO: normaliza la fecha de la audiencia a la convención de
  -- huso con que se derivó citacion.semana_iso (A1, load-bearing). IW/IYYY = ISO week.
  join public.lobby_audiencia a
    on to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW') = c.semana_iso
  -- lee la maestra deny-by-default INTERNAMENTE (security definer); emite solo derivado público.
  join public.parlamentario p on p.id = a.parlamentario_id
  where cp.boletin = p_boletin
    and a.estado_vinculo = 'confirmado'      -- solo audiencias confirmadas (IDENT-12)
    and a.parlamentario_id is not null       -- sujeto pasivo confirmado (no se fabrica identidad)
  order by a.fecha desc nulls last;
$$;

-- ── ACL determinista: lock-down sin grants (Camino A, espejo de 0047:101-102) ──
-- Función NUEVA → los DEFAULT PRIVILEGES pueden conceder EXECUTE por defecto; el DOBLE
-- revoke explícito lo limpia. CERO grant a anon/public: el sitio lee con service_role.
revoke all on function public.lobby_en_tramitacion(text) from public;
revoke all on function public.lobby_en_tramitacion(text) from anon, authenticated;
