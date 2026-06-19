-- 0022_probidad.sql
-- Destino de datos VERSIONADO de la Fase 12 (INT Patrimonio/Intereses — InfoProbidad,
-- CPLT/Contraloría, CC BY 4.0): el hecho público de la declaración (`declaracion`,
-- VERSIONADA), sus sub-tablas de bienes públicas, la sub-maestra deny-by-default de
-- familiares (`declaracion_familiar`, terceros PII), los RPCs públicos
-- `declaraciones_de_parlamentario` (historial) / `comparar_declaraciones` (lado-a-lado, SIN
-- delta) y un marcador de ingesta por-parlamentario (`probidad_ingesta_estado`). Es la base
-- sobre la que escribe el conector (@obs/probidad, Plan 02) y lee la ficha (Plan 03).
--
-- La última migración APLICADA es 0021 (lobby). Esta es la 0022.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 6): build/typecheck NO prueban que Postgres
-- ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0022_probidad.test.sql) corriendo contra un schema APLICADO. Por el BOM UTF-8 en `.env`,
-- la aplicación + pgTAP pasan `--db-url` explícito al CLI (mismo camino que 0018/0019/0020/0021,
-- aplicadas con éxito al remoto sa-east-1 en Phases 9/10/11; extraer SUPABASE_DB_URL con node
-- esquivando el BOM).
--
-- CONVENCIONES ESPEJADAS (de 0010/0018/0021):
--   * `declaracion` + sub-tablas de bienes → public-read explícito (espejo de `lobby_audiencia`
--     en 0021 / `citacion` en 0010), pero con CLAVE COMPUESTA versionada.
--   * `declaracion_familiar` → DENY-BY-DEFAULT (copia VERBATIM la convención de 0018/0021:
--     RLS habilitada, CERO policies, SIN grant a anon, + REVOKE explícito). Tercero privado
--     (Ley 21.719).
--   * `declaraciones_de_parlamentario` / `comparar_declaraciones` → RPC
--     `security definer set search_path = ''` revocado de public + grant execute a anon
--     (espejo EXACTO de `lobby_de_parlamentario`/0021). Único canal público; emiten SOLO los
--     campos que la fuente publica + la licencia CC BY 4.0; NUNCA datos de familiares.
--   * Provenance INLINE NOT NULL en cada hecho (FND-08): origen, fecha_captura, enlace.
--   * Atribución CC BY 4.0 que VIAJA con la fila (`licencia`), incluso a la vista derivada
--     de comparación (PITFALLS D4 / decisión CONTEXT "incluso en vistas derivadas").
--   * NUNCA fabricar identidad: el FK del declarante a `parlamentario` se puebla SOLO con un
--     enlace confirmado/determinista (IDENT-12); texto crudo si no hay match.
--
-- ── OPEN QUESTIONS resueltas EN VIVO contra https://datos.cplt.cl/sparql (2026-06-19,
--    delay 2-3s + UA identificatorio; Accept: application/sparql-results+json) ───────────────
--
--   OQ1 — CLAVE DE VERSIÓN (Assumption A1): `ip:identificadorFuente` NO es único por versión.
--     Consulta de conteo: 170.562 instancias de `ip:Declaracion` pero solo 118.624 valores
--     DISTINCT de `ip:identificadorFuente` → colisiona. La URI del nodo `Declaracion` SÍ es
--     única (170.562 = COUNT(DISTINCT ?declaracion)). Por tanto `fuente_id` = la URI del nodo
--     `Declaracion` (estable y única), y la clave de versión es (fuente_id, fecha_presentacion).
--     NUNCA keyear por el declarante solo (Pitfall 1: colapsa el historial).
--
--   OQ2 — PREDICADOS LITERALES de las sub-entidades de bienes (Assumption A3), enumerados por
--     `SELECT DISTINCT ?p WHERE { ?x a ip:<Clase> ; ?p ?o . FILTER(isLiteral(?o)) }`:
--       BienInmueble : anioInmueble, esSuDomicilio, fojasInmueble, numInscripcion, rolAvaluo, ubicadoEn
--       BienMueble   : nombreMueble, descripcion, modelo, anioFabricacion, matricula, numeroInscripcion, anioInscripcion, tonelaje
--       Actividad    : objeto, vinculo, remunerado, haceDoceMeses
--       Pasivo       : tipoObligacion, acreedor, montoDeuda
--       AccionDerecho: fechaAdquisicion, cantidadAcciones, esControlador, gravamenes, rutJuridica
--       Valores      : entidadEmisora, tipoAccionDerecho, cantidadRepresenta, valorPlaza, paisQueEmite, fechaAdquisicion, tipoGravamen
--     Las columnas de las sub-tablas se PINEAN a estos predicados LITERALES (sin valores
--     computados; un monto/rol/avalúo se guarda VERBATIM como string como lo da la fuente).
--     Nota `AccionDerecho.rutJuridica`: es el RUT de la PERSONA JURÍDICA (empresa) cuyo paquete
--     accionario se declara — contenido publicado del bien declarado, NO un RUT de persona
--     natural (declarante/familiar). La fuente NO expone RUT de persona natural (verificado en
--     research: filtro CONTAINS sobre todos los predicados → cero); ninguna columna RUT de
--     persona natural se crea aquí.
--
--   OQ3 — LABELS de tipoDeclaracion (Assumption A6): `?tipo rdfs:label ?l` SÍ resuelve labels.
--     tipoDeclaracion_1 = "PRIMERA DECLARACIÓN (POR ASUNCIÓN DE CARGO)";
--     _2 = "ACTUALIZACIÓN PERIÓDICA (MARZO)"; _3 = "POR CESE DE FUNCIONES";
--     _4 = "RECTIFICACIÓN A REQUERIMIENTO DE ÓRGANO FISCALIZADOR";
--     _5 = "PRESENTACIÓN A REQUERIMIENTO DE ÓRGANO FISCALIZADOR";
--     _6 = "ACTUALIZACIÓN VOLUNTARIA"; _7 = "DECLARACIÓN VOLUNTARIA";
--     _8 = "CESE Y ASUNCIÓN SIMULTÁNEA DE FUNCIONES (REELECTOS / REDESIGNADOS)";
--     _9 = "RECTIFICACIÓN VOLUNTARIA"; _10 = "ACTUALIZACION PERIODICA (SEPTIEMBRE)".
--     El conector (Plan 02) resuelve el label vía el SDK SPARQL y lo guarda en `tipo`. Si para
--     alguna URI no hubiera label, almacenar la URI CRUDA verbatim (NUNCA fabricar un label).

-- ── declaracion (HECHO PÚBLICO, public-read, VERSIONADA — espejo de `lobby_audiencia`) ──────
-- El hecho de la declaración: fecha de presentación, tipo, cargo, organismo, el enlace de la
-- fuente y la licencia. Datos públicos (CC BY 4.0) que la fuente ya publica → anon DEBE poder
-- leerlos o la ficha queda en blanco. La CLAVE INCLUYE la fecha → las versiones ACUMULAN:
-- un re-run upserta la MISMA versión (idempotente), una nueva `fechaDeclaracion` es una FILA
-- NUEVA. NUNCA keyear por el declarante solo (Pitfall 1: colapsa versiones, muestra una vieja
-- como actual).
create table declaracion (
  -- Clave natural ESTABLE: la URI del nodo `Declaracion` (única — OQ1), NO `identificadorFuente`
  -- (colisiona). + la fecha de presentación. Juntas son la clave de VERSIÓN.
  fuente_id          text not null,            -- URI del nodo ip:Declaracion (estable, única)
  fecha_presentacion date not null,            -- ip:fechaDeclaracion — LA fecha de presentación (INT-03/04)
  -- declarante (el oficial): FK SOLO si enlace confirmado/determinista (IDENT-12, Phase 9).
  parlamentario_id   text references parlamentario(id) on delete set null,  -- nullable
  mencion_declarante text not null,            -- nombre crudo del declarante como lo publica la fuente
  estado_vinculo     text,                     -- 'confirmado' | 'no_confirmado' | null
  tipo               text,                     -- ip:tipoDeclaracion (label resuelto en OQ3, o URI cruda)
  cargo              text,                     -- ip:poseeCargo (raw, publicado)
  organismo          text,                     -- ip:organismoFuente (raw, publicado)
  -- provenance inline NOT NULL (FND-08): cada dato lleva fuente, fecha y enlace original.
  origen             text not null,            -- "infoprobidad-sparql"
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,            -- la URL / enlace de la declaración en la fuente
  -- Atribución CC BY 4.0 que viaja con la fila (PITFALLS D4): visible incluso en vistas derivadas.
  licencia           text not null default 'CC BY 4.0',
  primary key (fuente_id, fecha_presentacion)  -- la CLAVE DE VERSIÓN (incluye la fecha)
);

-- RLS public-read EXPLÍCITO (espejo de 0010/0021): el deny-by-default heredado dejaría la
-- ficha en blanco. NO hay policies de insert/update/delete: el writer usa service key.
alter table declaracion enable row level security;
create policy declaracion_public_read on declaracion for select to anon using (true);
-- GRANT explícito: la policy sin el privilegio de tabla no expone nada (defensa en profundidad).
grant select on declaracion to anon;

create index declaracion_parlamentario_idx on declaracion (parlamentario_id);

-- ── Sub-tablas de bienes (PÚBLICAS — contenido publicado de la declaración, CC BY 4.0) ─────
-- Cada fila cuelga de la VERSIÓN (fuente_id, fecha_presentacion) por FK on delete cascade.
-- Columnas LITERALES de los predicados pineados en OQ2 (sin valores computados; un monto se
-- guarda VERBATIM como string como la fuente lo da — categoría/rango/texto). `unique` por la
-- clave natural de la fila del bien para upsert idempotente.

-- BienInmueble (OQ2): anioInmueble, esSuDomicilio, fojasInmueble, numInscripcion, rolAvaluo, ubicadoEn
create table declaracion_bien_inmueble (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  ubicado_en         text,                     -- ip:ubicadoEn (comuna/ubicación, raw)
  rol_avaluo         text,                     -- ip:rolAvaluo (rol de avalúo, raw)
  num_inscripcion    text,                     -- ip:numInscripcion (raw)
  fojas              text,                     -- ip:fojasInmueble (raw)
  anio               text,                     -- ip:anioInmueble (raw)
  es_su_domicilio    text,                     -- ip:esSuDomicilio (raw)
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  licencia           text not null default 'CC BY 4.0',
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade,
  unique (fuente_id, fecha_presentacion, ubicado_en, rol_avaluo, num_inscripcion)
);
alter table declaracion_bien_inmueble enable row level security;
create policy declaracion_bien_inmueble_public_read on declaracion_bien_inmueble for select to anon using (true);
grant select on declaracion_bien_inmueble to anon;

-- BienMueble (OQ2): nombreMueble, descripcion, modelo, anioFabricacion, matricula, numeroInscripcion, anioInscripcion, tonelaje
create table declaracion_bien_mueble (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  nombre             text,                     -- ip:nombreMueble (raw)
  descripcion        text,                     -- ip:descripcion (raw)
  modelo             text,                     -- ip:modelo (raw)
  anio_fabricacion   text,                     -- ip:anioFabricacion (raw)
  matricula          text,                     -- ip:matricula (raw)
  numero_inscripcion text,                     -- ip:numeroInscripcion (raw)
  anio_inscripcion   text,                     -- ip:anioInscripcion (raw)
  tonelaje           text,                     -- ip:tonelaje (raw)
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  licencia           text not null default 'CC BY 4.0',
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade,
  unique (fuente_id, fecha_presentacion, nombre, modelo, matricula, numero_inscripcion)
);
alter table declaracion_bien_mueble enable row level security;
create policy declaracion_bien_mueble_public_read on declaracion_bien_mueble for select to anon using (true);
grant select on declaracion_bien_mueble to anon;

-- Actividad (OQ2): objeto, vinculo, remunerado, haceDoceMeses
create table declaracion_actividad (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  objeto             text,                     -- ip:objeto (raw)
  vinculo            text,                     -- ip:vinculo (raw)
  remunerado         text,                     -- ip:remunerado (raw)
  hace_doce_meses    text,                     -- ip:haceDoceMeses (raw)
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  licencia           text not null default 'CC BY 4.0',
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade,
  unique (fuente_id, fecha_presentacion, objeto, vinculo)
);
alter table declaracion_actividad enable row level security;
create policy declaracion_actividad_public_read on declaracion_actividad for select to anon using (true);
grant select on declaracion_actividad to anon;

-- Pasivo (OQ2): tipoObligacion, acreedor, montoDeuda
create table declaracion_pasivo (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  tipo_obligacion    text,                     -- ip:tipoObligacion (raw)
  acreedor           text,                     -- ip:acreedor (raw)
  monto_deuda        text,                     -- ip:montoDeuda (raw, VERBATIM — sin computar)
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  licencia           text not null default 'CC BY 4.0',
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade,
  unique (fuente_id, fecha_presentacion, tipo_obligacion, acreedor, monto_deuda)
);
alter table declaracion_pasivo enable row level security;
create policy declaracion_pasivo_public_read on declaracion_pasivo for select to anon using (true);
grant select on declaracion_pasivo to anon;

-- AccionDerecho (OQ2): fechaAdquisicion, cantidadAcciones, esControlador, gravamenes, rutJuridica
-- `rut_juridica` = RUT de la PERSONA JURÍDICA (empresa) declarada — contenido del bien, NO un
-- RUT de persona natural (la fuente no expone RUT de persona natural — research).
create table declaracion_accion_derecho (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  rut_juridica       text,                     -- ip:rutJuridica (RUT de la EMPRESA declarada, raw)
  cantidad_acciones  text,                     -- ip:cantidadAcciones (raw)
  fecha_adquisicion  text,                     -- ip:fechaAdquisicion (raw)
  es_controlador     text,                     -- ip:esControlador (raw)
  gravamenes         text,                     -- ip:gravamenes (raw)
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  licencia           text not null default 'CC BY 4.0',
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade,
  unique (fuente_id, fecha_presentacion, rut_juridica, fecha_adquisicion, cantidad_acciones)
);
alter table declaracion_accion_derecho enable row level security;
create policy declaracion_accion_derecho_public_read on declaracion_accion_derecho for select to anon using (true);
grant select on declaracion_accion_derecho to anon;

-- Valores (OQ2): entidadEmisora, tipoAccionDerecho, cantidadRepresenta, valorPlaza, paisQueEmite, fechaAdquisicion, tipoGravamen
create table declaracion_valor (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  entidad_emisora    text,                     -- ip:entidadEmisora (raw)
  tipo_accion_derecho text,                    -- ip:tipoAccionDerecho (raw)
  cantidad_representa text,                    -- ip:cantidadRepresenta (raw)
  valor_plaza        text,                     -- ip:valorPlaza (raw, VERBATIM — sin computar)
  pais_que_emite     text,                     -- ip:paisQueEmite (raw)
  fecha_adquisicion  text,                     -- ip:fechaAdquisicion (raw)
  tipo_gravamen      text,                     -- ip:tipoGravamen (raw)
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  licencia           text not null default 'CC BY 4.0',
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade,
  unique (fuente_id, fecha_presentacion, entidad_emisora, tipo_accion_derecho, fecha_adquisicion)
);
alter table declaracion_valor enable row level security;
create policy declaracion_valor_public_read on declaracion_valor for select to anon using (true);
grant select on declaracion_valor to anon;

-- ── declaracion_familiar (TERCEROS PII, DENY-BY-DEFAULT — copia VERBATIM 0018/0021) ─────────
-- Familiares declarados (cónyuge, hijos, …): TERCEROS PRIVADOS (Ley 21.719). PII por
-- minimización. Espejo estructural de `lobby_contraparte` (0021) / `pii_contraparte_declaracion`
-- (0018): RLS habilitada SIN policies, SIN grant a anon, + REVOKE explícito.
create table declaracion_familiar (
  id                 bigint generated always as identity primary key,
  -- FK a la VERSIÓN de la declaración (NO a parlamentario): el familiar se enlaza al HECHO de
  -- la declaración, NUNCA a una persona del padrón. on delete cascade preserva la integridad.
  fuente_id          text not null,
  fecha_presentacion date not null,
  relacion           text,                     -- esConyugeDe / esHijoDe / esMadreDe / … (raw)
  nombre             text,                     -- nombre crudo del tercero — uso INTERNO, nunca público
  -- provenance inline NOT NULL (FND-08).
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade
);
-- NO existe columna RUT de familiar (la fuente no expone RUT de persona natural — verificado
-- en research; minimización por la fuente misma). NINGUNA FK a `parlamentario` (Pitfall 4:
-- el tercero NUNCA se enlaza a una persona del padrón).

-- DENY-BY-DEFAULT (Ley 21.719, LEGAL-03): enable SIN policies.
-- (intencionalmente NINGÚN `create policy ... to anon`; intencionalmente NINGÚN
-- `grant select ... to anon`) — RLS habilitada SIN policy => Postgres niega las filas a anon.
alter table declaracion_familiar enable row level security;

-- DEFENSA EN PROFUNDIDAD (la LECCIÓN DE PHASE 11): este proyecto Supabase concede por DEFAULT
-- PRIVILEGES todos los privilegios de tabla a `anon`/`authenticated` sobre CADA tabla nueva en
-- `public` (verificado en 11-01: anon hereda SELECT sin que la migración lo otorgue). La RLS
-- sin policy ya niega las FILAS, pero LEGAL-03 exige que el PRIVILEGIO tampoco exista (el pgTAP
-- lo codifica). REVOCAR explícitamente todo de anon/authenticated cierra el hueco de los
-- default privileges. El service_role (writer) conserva sus privilegios y bypassa RLS.
revoke all on declaracion_familiar from anon, authenticated;

-- ── declaraciones_de_parlamentario(p_id) (RPC público — HISTORIAL, espejo de lobby_de_parlamentario) ─
-- security definer: corre con privilegios del owner para leer el universo deny-by-default, pero
-- DEVUELVE SOLO los campos que la fuente publica (sin parlamentario_id interno, sin familiares,
-- sin RUT). SOLO declaraciones CONFIRMADAS (parlamentario_id = p_id) → una declaración no
-- confirmada NUNCA aparece bajo un parlamentario (estado honesto). Ordenadas por
-- fecha_presentacion DESC: la más reciente primero; una vieja NUNCA se marca "actual" (INT-04).
create function public.declaraciones_de_parlamentario(p_id text)
returns table (
  fuente_id text, fecha_presentacion date, tipo text, cargo text, organismo text,
  origen text, fecha_captura timestamptz, enlace text, licencia text
)
language sql stable security definer set search_path = '' as $$
  select d.fuente_id, d.fecha_presentacion, d.tipo, d.cargo, d.organismo,
         d.origen, d.fecha_captura, d.enlace, d.licencia
  from public.declaracion d
  where d.parlamentario_id = p_id
  order by d.fecha_presentacion desc;
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo de 0021).
revoke execute on function public.declaraciones_de_parlamentario(text) from public;
grant execute on function public.declaraciones_de_parlamentario(text) to anon;

-- ── comparar_declaraciones(p_id, fechas[]) (RPC público — COMPARACIÓN lado-a-lado, INT-05) ──
-- Devuelve los campos declarados LITERALES (etiqueta/valor) de las versiones pedidas, EN FILAS.
-- CERO columna de delta/variación/enriquecimiento/conflicto/veredicto (PITFALLS B3/E2; LOCKED).
-- El UI las dispone lado-a-lado; el RPC NO computa NADA. Si un campo está ausente en una
-- versión, el UI muestra "No declarado en esta versión" (no el RPC). La `licencia` viaja por
-- fila (la atribución llega a la vista derivada). security definer + solo p_id confirmado.
create function public.comparar_declaraciones(p_id text, fechas date[])
returns table (
  fecha_presentacion date, etiqueta text, valor text,
  origen text, fecha_captura timestamptz, enlace text, licencia text
)
language sql stable security definer set search_path = '' as $$
  -- Campos escalares de la declaración (etiqueta = nombre del campo; valor = literal publicado).
  select d.fecha_presentacion, 'tipo'::text      as etiqueta, d.tipo      as valor,
         d.origen, d.fecha_captura, d.enlace, d.licencia
    from public.declaracion d
   where d.parlamentario_id = p_id and d.fecha_presentacion = any(fechas)
  union all
  select d.fecha_presentacion, 'cargo'::text      as etiqueta, d.cargo     as valor,
         d.origen, d.fecha_captura, d.enlace, d.licencia
    from public.declaracion d
   where d.parlamentario_id = p_id and d.fecha_presentacion = any(fechas)
  union all
  select d.fecha_presentacion, 'organismo'::text  as etiqueta, d.organismo as valor,
         d.origen, d.fecha_captura, d.enlace, d.licencia
    from public.declaracion d
   where d.parlamentario_id = p_id and d.fecha_presentacion = any(fechas)
  -- Sub-tablas de bienes: cada fila del bien es una etiqueta/valor literal por versión.
  union all
  select b.fecha_presentacion, 'bien_inmueble'::text as etiqueta,
         coalesce(b.ubicado_en, '') as valor, b.origen, b.fecha_captura, b.enlace, b.licencia
    from public.declaracion_bien_inmueble b
    join public.declaracion d on d.fuente_id = b.fuente_id and d.fecha_presentacion = b.fecha_presentacion
   where d.parlamentario_id = p_id and b.fecha_presentacion = any(fechas)
  union all
  select a.fecha_presentacion, 'actividad'::text as etiqueta,
         coalesce(a.objeto, '') as valor, a.origen, a.fecha_captura, a.enlace, a.licencia
    from public.declaracion_actividad a
    join public.declaracion d on d.fuente_id = a.fuente_id and d.fecha_presentacion = a.fecha_presentacion
   where d.parlamentario_id = p_id and a.fecha_presentacion = any(fechas)
  union all
  select pa.fecha_presentacion, 'pasivo'::text as etiqueta,
         coalesce(pa.tipo_obligacion, '') as valor, pa.origen, pa.fecha_captura, pa.enlace, pa.licencia
    from public.declaracion_pasivo pa
    join public.declaracion d on d.fuente_id = pa.fuente_id and d.fecha_presentacion = pa.fecha_presentacion
   where d.parlamentario_id = p_id and pa.fecha_presentacion = any(fechas)
  order by 1 desc, 2;
$$;

revoke execute on function public.comparar_declaraciones(text, date[]) from public;
grant execute on function public.comparar_declaraciones(text, date[]) to anon;

-- ── probidad_ingesta_estado (marcador de ingesta por-parlamentario — espejo de lobby_ingesta_estado) ─
-- Permite a la ficha distinguir (a) "no ingestado todavía" (FILA AUSENTE) de (b) "ingestado,
-- cero confirmadas" (FILA PRESENTE, cero declaraciones). NO contiene PII (solo un FK + fecha) →
-- public-read es correcto. El conector (Plan 02) la upserta al final de una corrida que tocó a
-- ese parlamentario.
create table probidad_ingesta_estado (
  parlamentario_id text primary key references parlamentario(id) on delete cascade,
  ingestado_hasta  date,
  fecha_captura    timestamptz not null default now()
);
alter table probidad_ingesta_estado enable row level security;
create policy probidad_ingesta_estado_public_read on probidad_ingesta_estado for select to anon using (true);
grant select on probidad_ingesta_estado to anon;
