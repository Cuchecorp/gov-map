-- 0021_lobby.sql
-- Destino de datos de la Fase 11 (INT Lobby — Ley 20.730): el hecho público de la
-- audiencia de lobby (`lobby_audiencia`), la sub-maestra deny-by-default de contrapartes
-- (`lobby_contraparte`), el RPC público `lobby_de_parlamentario` y un marcador de ingesta
-- por-parlamentario (`lobby_ingesta_estado`). Es la base sobre la que escribe el conector
-- (@obs/lobby, Plan 02) y lee la ficha (/parlamentario/[id], Plan 03).
--
-- La última migración APLICADA es 0020 (parlamentario_publico). Esta es la 0021.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 5): build/typecheck NO prueban que
-- Postgres ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0021_lobby.test.sql) corriendo contra un schema APLICADO. Por el BOM en `.env`, la
-- aplicación + pgTAP pasan `--db-url` explícito al CLI (mismo camino que 0018/0019/0020,
-- aplicadas con éxito al remoto sa-east-1 en Phases 9/10).
--
-- CONVENCIONES ESPEJADAS:
--   * `lobby_audiencia`  → public-read explícito (espejo de `citacion` en 0010).
--   * `lobby_contraparte`→ DENY-BY-DEFAULT (copia VERBATIM la convención de 0018:
--     RLS habilitada, CERO policies, SIN grant a anon). Tercero privado (Ley 21.719).
--   * `lobby_de_parlamentario` → RPC `security definer set search_path = ''` revocado de
--     public + grant execute a anon (espejo EXACTO de parlamentario_publico/0020 y
--     votos_de_parlamentario/0019). Único canal público a la contraparte deny-by-default.
--   * Provenance INLINE NOT NULL en cada hecho (FND-08): origen, fecha_captura, enlace.
--   * NUNCA fabricar identidad: el FK del sujeto pasivo a `parlamentario` se puebla SOLO
--     con un enlace confirmado/determinista (IDENT-12); texto crudo si no hay match.

-- ── lobby_audiencia (HECHO PÚBLICO, public-read — espejo de `citacion` en 0010) ───
-- El hecho de la reunión: fecha, materia, el enlace del detalle y la fuente. Datos
-- públicos que la fuente ya publica → anon DEBE poder leerlos o la ficha queda en blanco.
create table lobby_audiencia (
  -- Clave natural ESTABLE: el cell `Identificador` de leylobby ("{INST}AW{N}", p.ej.
  -- "AQ001AW1442944"). NUNCA el número de URL del listado (Pitfall 1: es un artefacto
  -- de la página de listado, no la identidad de la audiencia).
  identificador      text primary key,
  institucion_codigo text not null,            -- código de institución (p.ej. el de Cámara/Senado)
  -- FK del SUJETO PASIVO (el parlamentario): NULLABLE. Se fija SOLO si el enlace es
  -- confirmado/determinista (IDENT-12, Phase 9); on delete set null preserva el hecho.
  parlamentario_id   text references parlamentario(id) on delete set null,
  mencion_sujeto     text not null,            -- nombre crudo del sujeto pasivo como lo publica la fuente
  estado_vinculo     text,                     -- 'confirmado' | 'no_confirmado' | null
  fecha              timestamptz,              -- parseado; raw conservado si el parseo falla
  fecha_raw          text,                     -- string fuente ("2023-12-26 13:00:00-03") — nunca fabricar
  materia            text,                     -- resumen de materia (raw)
  enlace_detalle     text,                     -- link "Ver Detalle" (NO se scrapea el acta en P11)
  -- provenance inline NOT NULL (FND-08): cada dato lleva fuente, fecha y enlace original.
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null
);

-- RLS público-read EXPLÍCITO (espejo de 0010): el deny-by-default heredado dejaría la
-- ficha en blanco. NO hay policies de insert/update/delete: el writer usa service key.
alter table lobby_audiencia enable row level security;
create policy lobby_audiencia_public_read on lobby_audiencia for select to anon using (true);
-- GRANT explícito: la policy sin el privilegio de tabla no expone nada (defensa en profundidad).
grant select on lobby_audiencia to anon;

create index lobby_audiencia_parlamentario_idx on lobby_audiencia (parlamentario_id);

-- ── lobby_contraparte (SUB-MAESTRA, DENY-BY-DEFAULT — copia VERBATIM de 0018) ─────
-- Lobistas / gestores de interés: TERCEROS PRIVADOS. PII por minimización (Ley 21.719).
-- Espejo estructural de `pii_contraparte_declaracion` (0018): RLS habilitada SIN policies
-- y SIN grant a anon. La única vía pública es la proyección curada del RPC de abajo.
create table lobby_contraparte (
  id                bigint generated always as identity primary key,
  -- FK a la audiencia (NO a parlamentario): la contraparte se enlaza al HECHO, no a una persona.
  identificador     text not null references lobby_audiencia(identificador) on delete cascade,
  nombre            text not null,             -- nombre crudo del tercero como lo publica la fuente
  rol               text not null default '',  -- rol crudo (lobbista/gestor/asesor/...); '' si ausente
  representado_text text,                       -- firma/entidad representada (raw), nullable
  -- contraparte_id: enlace a una identidad de contraparte SOLO ante un id-exacto autoritativo.
  -- En P11 es esencialmente SIEMPRE NULL (no hay cross-key de tercero). NO es un FK a
  -- parlamentario. NUNCA se puebla por adivinanza de nombre (Pitfall 4); su existencia es
  -- para que un futuro registro autoritativo (NET) adjunte una identidad por id exacto.
  contraparte_id    text,                       -- nullable; uso interno; default NULL
  -- provenance inline NOT NULL (FND-08).
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  -- clave natural para upsert idempotente (un 2× run produce conteos idénticos).
  unique (identificador, nombre, rol)
);
-- NO existe columna RUT de contraparte en P11 (no se almacena RUT de terceros —
-- minimización Ley 21.719). Si una columna sensible se agregara aquí en el futuro, la
-- RLS deny-by-default la protege por construcción.

-- DENY-BY-DEFAULT (Ley 21.719, LEGAL-03): enable SIN policies.
-- (intencionalmente NINGÚN `create policy ... to anon`; intencionalmente NINGÚN
-- `grant select ... to anon`) — RLS habilitada SIN policy => Postgres niega las filas a anon.
alter table lobby_contraparte enable row level security;

-- DEFENSA EN PROFUNDIDAD: este proyecto Supabase concede por DEFAULT PRIVILEGES todos
-- los privilegios de tabla a `anon`/`authenticated` sobre CADA tabla nueva en `public`
-- (verificado: anon hereda SELECT sin que esta migración lo otorgue). La RLS sin policy
-- ya niega las FILAS, pero LEGAL-03 exige que el PRIVILEGIO tampoco exista (el pgTAP lo
-- codifica). REVOCAR explícitamente todo de anon/authenticated cierra el hueco de los
-- default privileges. El service_role (writer) conserva sus privilegios y bypassa RLS.
revoke all on lobby_contraparte from anon, authenticated;

-- ── lobby_de_parlamentario(p_id) (RPC público — espejo de parlamentario_publico/0020) ─
-- security definer: corre con privilegios del owner para leer la sub-maestra deny-by-default
-- internamente, pero DEVUELVE SOLO los campos que la fuente ya publica (sin contraparte_id,
-- sin RUT). SOLO audiencias CONFIRMADAS (parlamentario_id = p_id) → una audiencia no
-- confirmada NUNCA aparece bajo un parlamentario (estado honesto).
create function public.lobby_de_parlamentario(p_id text)
returns table (
  identificador text, fecha timestamptz, fecha_raw text, materia text,
  enlace_detalle text, origen text, fecha_captura timestamptz, enlace text,
  contraparte_nombre text, contraparte_rol text, representado text
)
language sql stable security definer set search_path = '' as $$
  select a.identificador, a.fecha, a.fecha_raw, a.materia, a.enlace_detalle,
         a.origen, a.fecha_captura, a.enlace,
         c.nombre, c.rol, c.representado_text
  from public.lobby_audiencia a
  left join public.lobby_contraparte c on c.identificador = a.identificador
  where a.parlamentario_id = p_id
  order by a.fecha desc nulls last;
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo de 0019/0020).
-- NO se añade ninguna policy ni grant select sobre `lobby_contraparte` (sigue deny-by-default;
-- el RPC nunca emite contraparte_id ni RUT).
revoke execute on function public.lobby_de_parlamentario(text) from public;
grant execute on function public.lobby_de_parlamentario(text) to anon;

-- ── lobby_ingesta_estado (marcador de ingesta por-parlamentario — Open Question 3) ─
-- Resuelve el gap real de `VotosView.noIngestado` hardcodeado a false: permite a la ficha
-- distinguir el estado (a) "no ingestado todavía" (FILA AUSENTE) de (b) "ingestado, cero
-- confirmadas" (FILA PRESENTE, cero audiencias). NO contiene PII (solo un FK + fecha) →
-- public-read es correcto. El conector (Plan 02) la upserta al final de una corrida que
-- tocó a ese parlamentario.
create table lobby_ingesta_estado (
  parlamentario_id text primary key references parlamentario(id) on delete cascade,
  ingestado_hasta  date,
  fecha_captura    timestamptz not null default now()
);
alter table lobby_ingesta_estado enable row level security;
create policy lobby_ingesta_estado_public_read on lobby_ingesta_estado for select to anon using (true);
grant select on lobby_ingesta_estado to anon;
