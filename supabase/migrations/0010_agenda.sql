-- 0010_agenda.sql
-- Modelo común de Agenda (TRAM-07 / TRAM-08): citaciones de comisiones
-- (Cámara + Senado) + tabla semanal de sala (orden del día del Senado).
--
-- Principios:
--   * La LLAVE DE CRUCE hacia la ficha de proyecto (Fase 5) es el número de boletín
--     (`citacion_punto.boletin` / `sesion_tabla_item.boletin` → `proyecto.boletin`).
--   * provenance inline (origen, fecha_captura, enlace): cada fila raíz lleva su fuente
--     (TRAM-09).
--   * GUARDA DE IDENTIDAD (T-06-02): `citacion_invitado` NO tiene `parlamentario_id` ni
--     reconciliación — los invitados son gestores de interés / terceros, texto crudo.
--   * Claves naturales TOTALES para upsert idempotente de la ingesta (olas siguientes).
--   * RLS PÚBLICO-READ EXPLÍCITO (Pitfall 5 / T-06-01): las 5 tablas son datos públicos →
--     `create policy ... for select to anon using (true)` + `grant select ... to anon`.
--     El deny-by-default heredado dejaría la /agenda en blanco (anon leería 0 filas).
--     `parlamentario` queda intacta (deny-by-default: rut/email NUNCA al anon).

-- ── citacion (raíz: una comisión convocada un día) ───────────────────────────
create table citacion (
  id             text primary key,            -- "camara:2026-W25:<comision>:<fecha>" / "senado:<ID_CITACION>"
  camara         text not null check (camara in ('camara', 'senado')),
  comision       text not null,
  fecha          timestamptz,
  horario        text,                        -- crudo de la fuente ("10:00 a 12:00")
  sala           text,
  materia        text,
  estado         text,                        -- "Suspendida"/"Sin efecto"/null
  semana_iso     text not null,               -- "YYYY-Www" (clave de navegación /agenda)
  -- provenance inline (TRAM-09)
  origen         text not null,
  fecha_captura  timestamptz not null default now(),
  enlace         text not null
);

-- ── citacion_invitado (tercero / gestor de interés — NO parlamentario) ────────
create table citacion_invitado (
  id             bigint generated always as identity primary key,
  citacion_id    text not null references citacion(id) on delete cascade,
  nombre         text not null,               -- crudo de la fuente
  calidad        text,                        -- rol/calidad crudo, nullable
  -- clave natural: un invitado por (citacion, nombre).
  unique (citacion_id, nombre)
);

-- ── citacion_punto (orden de la citación; boletín = cruce con la ficha) ───────
create table citacion_punto (
  id             bigint generated always as identity primary key,
  citacion_id    text not null references citacion(id) on delete cascade,
  posicion       int not null default 0,
  boletin        text,                        -- "NNNNN-NN" → proyecto.boletin (nullable)
  id_proyecto    bigint,
  materia        text,
  tipo_tramite   text,
  -- clave natural: un punto por (citacion, posicion).
  unique (citacion_id, posicion)
);

-- ── sesion_sala (raíz: una sesión de sala con su tabla) ───────────────────────
create table sesion_sala (
  id             text primary key,            -- = ID_SESION del Senado
  camara         text not null check (camara in ('camara', 'senado')),
  fecha          timestamptz,
  numero         text,
  hora_inicio    text,
  tipo           text,
  -- provenance inline (TRAM-09)
  origen         text not null,
  fecha_captura  timestamptz not null default now(),
  enlace         text not null
);

-- ── sesion_tabla_item (ítem del orden del día) ────────────────────────────────
create table sesion_tabla_item (
  id             bigint generated always as identity primary key,
  sesion_id      text not null references sesion_sala(id) on delete cascade,
  posicion       int not null,
  parte_sesion   text not null,               -- "ORDEN DEL DÍA"/"TIEMPO DE VOTACIONES"/...
  materia        text,
  boletin        text,                        -- "NNNNN-NN" → proyecto.boletin (nullable)
  id_proyecto    bigint,
  alias          text,
  quorum         text,
  -- clave natural: un ítem por (sesion, posicion).
  unique (sesion_id, posicion)
);

-- ── Índices de la /agenda (lecturas por semana / fecha / boletín) ─────────────
create index citacion_semana_iso_idx       on citacion (semana_iso);
create index citacion_fecha_idx            on citacion (fecha);
create index citacion_punto_boletin_idx    on citacion_punto (boletin);
create index sesion_tabla_item_boletin_idx on sesion_tabla_item (boletin);

-- ── RLS público-read EXPLÍCITO (Pitfall 5 / T-06-01) ─────────────────────────
-- Las 5 tablas son DATOS PÚBLICOS → anon (rol del frontend) DEBE poder SELECT.
-- Sin estas policies, el deny-by-default heredado dejaría la /agenda en blanco.
-- NO hay policies de insert/update/delete: el writer usa service key (bypassa RLS).
alter table citacion           enable row level security;
alter table citacion_invitado  enable row level security;
alter table citacion_punto     enable row level security;
alter table sesion_sala        enable row level security;
alter table sesion_tabla_item  enable row level security;

create policy citacion_public_read           on citacion           for select to anon using (true);
create policy citacion_invitado_public_read  on citacion_invitado  for select to anon using (true);
create policy citacion_punto_public_read     on citacion_punto     for select to anon using (true);
create policy sesion_sala_public_read        on sesion_sala        for select to anon using (true);
create policy sesion_tabla_item_public_read  on sesion_tabla_item  for select to anon using (true);

-- GRANT explícito de SELECT a anon: la policy RLS sin el privilegio de tabla no
-- expone nada (defensa en profundidad — el privilegio Y la policy deben coincidir).
grant select on citacion           to anon;
grant select on citacion_invitado  to anon;
grant select on citacion_punto     to anon;
grant select on sesion_sala        to anon;
grant select on sesion_tabla_item  to anon;
