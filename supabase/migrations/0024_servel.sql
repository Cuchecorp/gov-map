-- 0024_servel.sql
-- Destino de datos VERSIONADO de la Fase 15 (MONEY Financiamiento -- aportes de campana
-- SERVEL, verbatim): el hecho publico del aporte (`aporte`, VERSIONADO, con periodo
-- electoral NOT NULL y el nombre del candidato verbatim), la sub-maestra deny-by-default
-- de donantes (`donante`, keyed por id sintetico -- SERVEL NO publica RUT de donante --,
-- PII sensible: un aporte puede revelar afiliacion politica, Ley 21.719), el marcador de
-- ingesta por-parlamentario (`aportes_ingesta_estado`) y el RPC publico
-- `aportes_de_parlamentario` (historial agrupable por eleccion). Es la base sobre la que
-- escribe el conector SERVEL (@obs/dinero, Plan 02) y lee la ficha (Plan 03). Espejo
-- archivo-por-archivo de 0023_dinero.sql + 0022_probidad.sql + 0021_lobby.sql.
--
-- La ultima migracion APLICADA es 0023 (dinero). Esta es la 0024.
-- (Nota: existen `supabase/tests/0023_money_gate.test.sql` y `0024_dinero.test.sql` -- son
--  TESTS, NO migraciones; no hay `0024_*.sql` previo. El pgTAP de esta migracion usa el
--  numero libre 0025.)
--
-- APLICACION = CHECKPOINT DE OPERADOR (Pitfall 4): build/typecheck NO prueban que Postgres
-- ejecuto este DDL (falso positivo de CI, leccion 0023). La unica prueba valida es el pgTAP
-- (0025_servel.test.sql) corriendo contra un schema APLICADO. Por el BOM UTF-8 en `.env`,
-- la aplicacion + pgTAP pasan `--db-url` explicito al CLI (mismo camino que
-- 0018..0023, aplicadas con exito al remoto sa-east-1; extraer SUPABASE_DB_URL esquivando
-- el BOM).
--
-- GATE DE EXPOSICION (heredado de Phase 13): toda ruta publica MONEY nace detras de
-- `moneyPublicEnabled()` (default OFF, server-only, Plan 03) -- ese es el candado B
-- (presentacion). Este DDL es el candado A (datos): `donante` nace deny-by-default a
-- `anon` (RLS + revoke), y el RPC es el unico canal publico hacia los datos confirmados.
-- Nada se enciende hasta el sign-off legal real (deuda de operador F13).
--
-- LICENCIA: la atribucion de la fuente SERVEL es "terminos por verificar". NO es la licencia
-- CCBY de probidad/0022 ni la de-mencion-de-fuente de ChileCompra/0023. El default de
-- `licencia` es 'terminos por verificar' (research-confirmado, criterio de la fase).
--
-- ENLACE candidato->parlamentario (RE-RESUELTO A1, principio de finalidad del dato): SERVEL
-- NO trae RUT --ni de donante ni de candidato, solo NOMBRES--. El `parlamentario_id` se puebla
-- SOLO cuando el Plan 02 confirmo el candidato por NOMBRE via el pipeline de identidad
-- confirmado/auditado (determinista o humano-confirmado). Un `no_confirmado` deja
-- `parlamentario_id` NULL (fail-closed: un candidato sin confirmar JAMAS cuelga de un
-- parlamentario). A diferencia de contratos (0023) NO existe el estado 'cuarentena' del
-- RUT-DV: el enlace ya no es por RUT.
--
-- RUT DEL DONANTE: el RPC publico NUNCA proyecta `rut_donante`, `donante_id` ni columna
-- alguna de `donante` (Ley 21.719: el RUT del donante jamas sale al publico). El donante es
-- SIEMPRE verbatim e interno y NUNCA es llave de enlace.
--
-- CONVENCIONES ESPEJADAS (de 0021/0022/0023):
--   * `aporte` -> public-read explicito (espejo de `contrato`/0023), con CLAVE COMPUESTA
--     versionada (fuente_id, fecha_corte) y `eleccion` NOT NULL (load-bearing).
--   * `donante` -> DENY-BY-DEFAULT (copia VERBATIM la convencion de 0023: RLS habilitada,
--     CERO policies, SIN grant a anon, + REVOKE explicito). PII sensible (afiliacion).
--   * `aportes_de_parlamentario` -> RPC `security definer set search_path = ''` revocado de
--     public + grant execute a anon (espejo EXACTO de `contratos_de_parlamentario`/0023).
--     Unico canal publico; emite SOLO los campos que la fuente publica + `fecha_corte` +
--     `candidato_nombre_verbatim`; SIN `parlamentario_id` interno; SIN RUT de donante.
--   * Provenance INLINE NOT NULL en cada hecho (FND-08): origen, fecha_captura, enlace.
--
-- NOTA cron: ni 0021 ni 0022 ni 0023 registraron un job pg_cron en la migracion. Mismo
-- patron aqui: el barrido SERVEL programado queda como checkpoint de operador, NO se crea
-- en este DDL.

-- == aporte (HECHO PUBLICO, public-read, VERSIONADO -- espejo de `contrato`) =================
-- El hecho del aporte de campana: el donante, el candidato (por NOMBRE), la eleccion, el
-- monto literal y la fecha, con su enlace y la fuente. Datos publicos que SERVEL ya publica ->
-- anon DEBE poder leerlos (cuando el gate B este encendido) o la ficha queda en blanco. La
-- CLAVE INCLUYE la fecha de corte -> las versiones ACUMULAN: un re-run upserta la MISMA
-- version (idempotente), una nueva consulta (otra `fecha_corte`) es una FILA NUEVA. NUNCA
-- keyear por el parlamentario (colapsaria aportes distintos / atribuiria sin confirmar).
create table aporte (
  -- Clave natural ESTABLE: id sintetico del aporte (hash de la fila + eleccion; SERVEL no
  -- publica un id de aporte) + la fecha de corte de la consulta. Juntas son la CLAVE DE VERSION.
  fuente_id                 text not null,            -- id sintetico estable del aporte (derivado por el writer)
  fecha_corte               date not null,            -- fecha de corte de la consulta SERVEL
  -- parlamentario (enlace por NOMBRE via pipeline de identidad): FK SOLO si el candidato fue
  -- confirmado/auditado (determinista o humano-confirmado, RE-RESUELTO A1). NUNCA cuelga un
  -- no_confirmado. Nullable.
  parlamentario_id          text references parlamentario(id) on delete set null,
  -- Dominio del estado del vinculo: 'confirmado' (candidato confirmado por el pipeline) |
  -- 'no_confirmado' (sin confirmar -> parlamentario_id NULL) | null. SIN 'cuarentena': el
  -- enlace ya no es por RUT-DV. El CHECK lo enforce.
  estado_vinculo            text
    check (estado_vinculo in ('confirmado', 'no_confirmado')),
  -- LOAD-BEARING: periodo electoral verbatim. NOT NULL -- la UI-SPEC lo marca always-present
  -- (agrupa por eleccion); una fila sin eleccion es drift -> cuarentena aguas arriba, jamas
  -- llega aca.
  eleccion                  text not null,            -- periodo electoral verbatim (LOAD-BEARING)
  -- LLAVE del enlace por NOMBRE: el candidato como lo da SERVEL (la fuente NO trae RUT de
  -- candidato). Se guarda SIEMPRE, haya o no enlace confirmado.
  candidato_nombre_verbatim text,                     -- nombre del candidato verbatim (SERVEL)
  -- Columnas LITERALES de la fuente (sin computo; el monto es VERBATIM como string).
  donante_nombre            text,                     -- nombre del donante (raw, publicado)
  tipo_persona              text,                     -- 'natural' | 'juridica' (etiqueta verbatim)
  monto                     text,                     -- monto VERBATIM como string (NO numeric -- sin computar)
  fecha_aporte              date,                     -- fecha de transferencia del aporte (raw)
  tipo_aporte               text,                     -- tipo de aporte (raw, publicado)
  territorio                text,                     -- territorio electoral (raw, publicado)
  pacto                     text,                     -- pacto (raw, publicado)
  partido                   text,                     -- partido (raw, publicado)
  -- provenance inline NOT NULL (FND-08): cada dato lleva fuente, fecha y enlace original.
  origen                    text not null,            -- "servel"
  fecha_captura             timestamptz not null default now(),
  enlace                    text not null,            -- la URL / enlace del reporte SERVEL
  -- Atribucion SERVEL = "terminos por verificar" (NO la licencia CCBY, NO de-mencion-de-fuente).
  licencia                  text not null default 'terminos por verificar',
  primary key (fuente_id, fecha_corte)                -- la CLAVE DE VERSION (incluye la fecha de corte)
);

-- RLS public-read EXPLICITO (espejo de 0023): el deny-by-default heredado dejaria la ficha en
-- blanco. NO hay policies de insert/update/delete: el writer usa service key.
alter table aporte enable row level security;
create policy aporte_public_read on aporte for select to anon using (true);
-- GRANT explicito: la policy sin el privilegio de tabla no expone nada (defensa en profundidad).
grant select on aporte to anon;

create index aporte_parlamentario_idx on aporte (parlamentario_id);

-- == donante (SUB-MAESTRA, DENY-BY-DEFAULT -- copia VERBATIM 0023) ===========================
-- El donante keyed por un id sintetico estable (SERVEL NO publica RUT de donante; la PK NO es
-- el RUT). PII SENSIBLE: un aporte de campana puede revelar afiliacion politica (dato sensible
-- Ley 21.719). Espejo estructural de `contratista` (0023): RLS habilitada SIN policies, SIN
-- grant a anon, + REVOKE explicito. La agregacion por contraparte vive en Phase 16; aqui es
-- solo la sub-maestra cruda. El donante es SIEMPRE verbatim e interno y NUNCA es llave de enlace.
create table donante (
  donante_id    text primary key,           -- id sintetico estable (nombre normalizado + tipo, lo deriva el writer)
  rut_donante   text,                        -- NULLABLE: SERVEL no lo trae hoy; la columna queda lista por si una exportacion futura lo da
  nombre        text,                        -- nombre crudo del donante -- uso INTERNO, nunca publico
  tipo_persona  text,                        -- 'natural' | 'juridica'
  -- provenance inline NOT NULL (FND-08).
  origen        text not null,
  fecha_captura timestamptz not null default now(),
  enlace        text not null,
  -- Atribucion SERVEL = "terminos por verificar".
  licencia      text not null default 'terminos por verificar'
);

-- DENY-BY-DEFAULT (Ley 21.719, dato sensible): enable SIN policies.
-- (intencionalmente NINGUN `create policy ... to anon`; intencionalmente NINGUN
-- `grant select ... to anon`) -- RLS habilitada SIN policy => Postgres niega las filas a anon.
alter table donante enable row level security;

-- DEFENSA EN PROFUNDIDAD (la LECCION DE PHASE 11, reiterada por CR-01 de Phase 13): este
-- proyecto Supabase concede por DEFAULT PRIVILEGES todos los privilegios de tabla a
-- `anon`/`authenticated` sobre CADA tabla nueva en `public`. La RLS sin policy ya niega las
-- FILAS, pero el dato sensible exige que el PRIVILEGIO tampoco exista (el pgTAP lo codifica).
-- REVOCAR explicitamente todo de anon/authenticated cierra el hueco de los default privileges.
-- El service_role (writer) conserva sus privilegios y bypassa RLS.
revoke all on donante from anon, authenticated;

-- == aportes_ingesta_estado (marcador de ingesta por-parlamentario -- espejo de 0023) ========
-- Permite a la ficha distinguir (a) "no-ingestado" (FILA AUSENTE) de (b) "verificado-sin-
-- aportes" (FILA PRESENTE, cero aportes) de (c) "enlazado" (>=1 aporte). NO contiene PII (solo
-- un FK + fecha) -> public-read es correcto. El conector (Plan 02) la upserta al final de una
-- corrida que toco a ese parlamentario.
create table aportes_ingesta_estado (
  parlamentario_id text primary key references parlamentario(id) on delete cascade,
  ingestado_hasta  date,
  fecha_captura    timestamptz not null default now()
);
alter table aportes_ingesta_estado enable row level security;
create policy aportes_ingesta_estado_public_read on aportes_ingesta_estado for select to anon using (true);
grant select on aportes_ingesta_estado to anon;

-- == aportes_de_parlamentario(p_id) (RPC publico -- HISTORIAL, espejo de contratos_de_parlamentario) ==
-- security definer: corre con privilegios del owner para leer el universo, pero DEVUELVE SOLO
-- los campos que la fuente publica + `fecha_corte` + `candidato_nombre_verbatim` (sin
-- parlamentario_id interno; PROHIBIDO `rut_donante`/`donante_id`/columnas de `donante` -- Ley
-- 21.719, el RUT del donante jamas sale al publico). SOLO aportes CONFIRMADOS (parlamentario_id
-- = p_id, enlace por NOMBRE confirmado/auditado) -> un aporte no confirmado NUNCA aparece bajo
-- un parlamentario (estado honesto, fail-closed). Ordenados por eleccion DESC, luego
-- fecha_aporte DESC (UI-SPEC: grupo por eleccion DESC, dentro de grupo fecha DESC).
create function public.aportes_de_parlamentario(p_id text)
returns table (
  eleccion text, donante_nombre text, tipo_persona text, monto text, fecha_aporte date,
  tipo_aporte text, candidato_nombre_verbatim text, origen text, fecha_captura timestamptz,
  fecha_corte date, enlace text, licencia text
)
language sql stable security definer set search_path = '' as $$
  select a.eleccion, a.donante_nombre, a.tipo_persona, a.monto, a.fecha_aporte,
         a.tipo_aporte, a.candidato_nombre_verbatim, a.origen, a.fecha_captura, a.fecha_corte,
         a.enlace, a.licencia
  from public.aporte a
  where a.parlamentario_id = p_id
  -- UI-SPEC: agrupar por eleccion DESC; dentro de cada grupo, fecha DESC. fecha_aporte es
  -- nullable -> `nulls last` evita que las no-fechadas suban al tope en DESC.
  order by a.eleccion desc, a.fecha_aporte desc nulls last;
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo de 0023).
revoke execute on function public.aportes_de_parlamentario(text) from public;
grant execute on function public.aportes_de_parlamentario(text) to anon;
