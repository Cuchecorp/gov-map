-- 0008_tramitacion.sql
-- Modelo común de Tramitación (TRAM-03): proyecto + votacion + voto + tramitacion_evento.
--
-- Principios:
--   * La LLAVE DE CRUCE entre ambas cámaras es el número de boletín (proyecto.boletin).
--   * provenance inline (origen, fecha_captura, enlace): cada fila lleva su fuente (FND-08/TRAM-09).
--   * `voto.parlamentario_id` NULLABLE + FK a la maestra: solo se puebla cuando el vínculo
--     es determinista/confirmado (Cámara por Diputado/Id, o Senado tras reconciliación
--     'confirmado'); en otro caso queda NULL y se conserva `mencion_nombre` crudo (T-05-02).
--   * Claves naturales para upsert idempotente de la ingesta (ola 4): unique en `voto`
--     y `tramitacion_evento`.
--   * RLS PÚBLICO-READ EXPLÍCITO (Pitfall 5 / T-05-01): las 4 tablas son datos públicos →
--     `create policy ... for select to anon using (true)`. El deny-by-default heredado de
--     Fases 1-4 bloquearía al frontend (anon leería 0 filas). NO se tocan policies de
--     insert/update/delete (el writer usa service key que bypassa RLS). `parlamentario`
--     queda intacta (deny-by-default: rut/email NUNCA al anon).

-- ── proyecto (PK = boletín completo) ─────────────────────────────────────────
create table proyecto (
  boletin        text primary key,             -- completo con sufijo, p.ej. "18296-05"
  boletin_num    text not null,                -- base sin sufijo, p.ej. "18296" (Pitfall 1)
  titulo         text not null,
  iniciativa     text check (iniciativa in ('Mensaje', 'Moción')),  -- nullable
  camara_origen  text,
  autores        text[] not null default '{}',
  materia        text,
  estado         text,
  etapa          text,
  subetapa       text,
  -- provenance inline (FND-08/TRAM-09)
  origen         text not null,
  fecha_captura  timestamptz not null default now(),
  enlace         text not null
);

-- ── votacion ─────────────────────────────────────────────────────────────────
create table votacion (
  id                text primary key,           -- "camara:89178" / "senado:<sesion>:<fecha>"
  boletin           text not null references proyecto(boletin),
  fecha             timestamptz,
  etapa             text,
  tipo              text,
  quorum            text,
  resultado         text,
  total_si          int not null default 0,
  total_no          int not null default 0,
  total_abstencion  int not null default 0,
  total_pareo       int not null default 0,
  camara            text not null check (camara in ('diputados', 'senado')),
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null
);

-- ── voto (desglose voto-a-voto) ──────────────────────────────────────────────
create table voto (
  id                bigint generated always as identity primary key,
  votacion_id       text not null references votacion(id),
  mencion_nombre    text not null,              -- nombre crudo de la fuente (display fallback)
  parlamentario_id  text references parlamentario(id),  -- NULLABLE: solo si determinista/confirmado
  seleccion         text not null check (seleccion in ('si', 'no', 'abstencion', 'pareo')),
  metodo            text check (metodo in ('determinista', 'llm', 'humano')),
  estado_vinculo    text check (estado_vinculo in ('confirmado', 'probable', 'no_confirmado')),
  -- clave natural para upsert idempotente (ola 4): un voto por (votacion, mención).
  unique (votacion_id, mencion_nombre)
);

-- ── tramitacion_evento (timeline materializado) ──────────────────────────────
create table tramitacion_evento (
  id             bigint generated always as identity primary key,
  boletin        text not null references proyecto(boletin),
  fecha          timestamptz,
  camara         text,
  tipo           text not null check (tipo in ('tramite', 'urgencia', 'informe', 'oficio', 'votacion')),
  descripcion    text,
  enlace         text,                          -- link al documento del evento (LINK_INFORME/OFICIO)
  -- provenance inline (FND-08/TRAM-09)
  origen         text not null,
  fecha_captura  timestamptz not null default now(),
  -- clave natural para upsert idempotente (ola 4).
  unique (boletin, fecha, camara, tipo, descripcion)
);

-- ── Índices para la ficha (lecturas por boletín) ─────────────────────────────
create index votacion_boletin_idx            on votacion (boletin);
create index voto_votacion_id_idx            on voto (votacion_id);
create index tramitacion_evento_boletin_idx  on tramitacion_evento (boletin, fecha);

-- ── RLS público-read EXPLÍCITO (Pitfall 5 / T-05-01) ─────────────────────────
-- Las 4 tablas son DATOS PÚBLICOS → anon (rol del frontend) DEBE poder SELECT.
-- Sin estas policies, el deny-by-default heredado dejaría la ficha en blanco.
-- NO hay policies de insert/update/delete: el writer usa service key (bypassa RLS).
alter table proyecto            enable row level security;
alter table votacion            enable row level security;
alter table voto                enable row level security;
alter table tramitacion_evento  enable row level security;

create policy proyecto_public_read            on proyecto            for select to anon using (true);
create policy votacion_public_read            on votacion            for select to anon using (true);
create policy voto_public_read                on voto                for select to anon using (true);
create policy tramitacion_evento_public_read  on tramitacion_evento  for select to anon using (true);

-- GRANT explícito de SELECT a anon: la policy RLS sin el privilegio de tabla no
-- expone nada (defensa en profundidad — el privilegio Y la policy deben coincidir).
grant select on proyecto            to anon;
grant select on votacion            to anon;
grant select on voto                to anon;
grant select on tramitacion_evento  to anon;
