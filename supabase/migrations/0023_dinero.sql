-- 0023_dinero.sql
-- Destino de datos VERSIONADO de la Fase 14 (MONEY Contratos del Estado por RUT —
-- ChileCompra/Mercado Publico): el hecho publico del contrato (`contrato`, VERSIONADO),
-- la sub-maestra deny-by-default de contratistas (`contratista`, keyed por RUT del
-- proveedor, PII potencial de persona natural), el marcador de ingesta por-parlamentario
-- (`contratos_ingesta_estado`) y el RPC publico `contratos_de_parlamentario` (historial).
-- Es la base sobre la que escribe el conector (@obs/dinero, Plan 02) y lee la ficha
-- (Plan 03). Espejo archivo-por-archivo de 0022_probidad.sql + 0021_lobby.sql.
--
-- La ultima migracion APLICADA es 0022 (probidad). Esta es la 0023.
-- (Nota: existe `supabase/tests/0023_money_gate.test.sql` — es un TEST de Phase 13, NO una
--  migracion; no hay `0023_*.sql`. El pgTAP de esta migracion usa el numero libre 0024.)
--
-- APLICACION = CHECKPOINT DE OPERADOR (Pitfall 3): build/typecheck NO prueban que Postgres
-- ejecuto este DDL (falso positivo de CI). La unica prueba valida es el pgTAP
-- (0024_dinero.test.sql) corriendo contra un schema APLICADO. Por el BOM UTF-8 en `.env`,
-- la aplicacion + pgTAP pasan `--db-url` explicito al CLI (mismo camino que
-- 0018/0019/0020/0021/0022, aplicadas con exito al remoto sa-east-1 en Phases 9/10/11/12;
-- extraer SUPABASE_DB_URL esquivando el BOM).
--
-- GATE DE EXPOSICION (heredado de Phase 13): toda ruta publica MONEY nace detras de
-- `moneyPublicEnabled()` (default OFF, server-only, Plan 03) — ese es el candado B
-- (presentacion). Este DDL es el candado A (datos): `contratista` nace deny-by-default a
-- `anon` (RLS + revoke), y el RPC es el unico canal publico hacia los datos confirmados.
-- Nada se enciende hasta el sign-off legal real (deuda de operador F13).
--
-- LICENCIA: la atribucion de la fuente ChileCompra es "mencion de la fuente", NO `CC BY 4.0`
-- (a diferencia de 0022/probidad). El default de `licencia` es 'mencion de la fuente' y NUNCA
-- el 'CC BY 4.0' de probidad (criterio de exito de la fase).
--
-- CONVENCIONES ESPEJADAS (de 0021/0022):
--   * `contrato` → public-read explicito (espejo de `declaracion`/0022 y `lobby_audiencia`/0021),
--     pero con CLAVE COMPUESTA versionada (fuente_id, fecha_corte).
--   * `contratista` → DENY-BY-DEFAULT (copia VERBATIM la convencion de 0021/0022: RLS
--     habilitada, CERO policies, SIN grant a anon, + REVOKE explicito). Tercero PII potencial
--     (RUT de persona natural; Ley 21.719).
--   * `contratos_de_parlamentario` → RPC `security definer set search_path = ''` revocado de
--     public + grant execute a anon (espejo EXACTO de `declaraciones_de_parlamentario`/0022 y
--     `lobby_de_parlamentario`/0021). Unico canal publico; emite SOLO los campos que la fuente
--     publica + `fecha_corte`; SIN `parlamentario_id` interno; SIN `rut_proveedor` crudo por
--     defecto (OQ3/A4: PII pendiente de sign-off legal F13 — no emitir hasta entonces).
--   * Provenance INLINE NOT NULL en cada hecho (FND-08): origen, fecha_captura, enlace.
--   * NUNCA fabricar identidad: el FK del contrato a `parlamentario` se puebla SOLO con un
--     enlace confirmado RUT-EXACTO (EnlaceConfirmado, Phase 9); texto crudo si no hay match.
--
-- NOTA cron (Open Question 2): ni 0021 ni 0022 registraron un `cron.schedule` en la
-- migracion. Mismo patron aqui: el pg_cron del barrido por RUT queda como checkpoint de
-- operador, NO se crea en este DDL.

-- == contrato (HECHO PUBLICO, public-read, VERSIONADO — espejo de `declaracion`) ============
-- El hecho del contrato/orden de compra: el proveedor, el organismo, el monto literal y la
-- fecha de la orden, con su enlace y la fuente. Datos publicos que ChileCompra ya publica →
-- anon DEBE poder leerlos (cuando el gate B este encendido) o la ficha queda en blanco. La
-- CLAVE INCLUYE la fecha de corte → las versiones ACUMULAN: un re-run upserta la MISMA version
-- (idempotente), una nueva consulta (otra `fecha_corte`) es una FILA NUEVA. NUNCA keyear por el
-- parlamentario solo NI por el proveedor solo (Pitfall: colapsaria ordenes distintas).
create table contrato (
  -- Clave natural ESTABLE: el codigo unico de la orden de compra ChileCompra (fuente_id) + la
  -- fecha de corte de la consulta por RUT. Juntas son la CLAVE DE VERSION.
  fuente_id          text not null,            -- codigo unico de la orden de compra (ChileCompra)
  fecha_corte        date not null,            -- fecha de corte de la consulta por RUT
  -- parlamentario (enlace RUT-EXACTO): FK SOLO si enlace confirmado/determinista por RUT
  -- (EnlaceConfirmado, Phase 9). NUNCA por nombre (Pitfall 4). Nullable.
  parlamentario_id   text references parlamentario(id) on delete set null,
  mencion_proveedor  text not null,            -- nombre crudo del proveedor como lo da la fuente
  estado_vinculo     text,                     -- 'confirmado' | 'no_confirmado' | null
  -- Columnas LITERALES de la fuente (sin computo; el monto es VERBATIM como string).
  codigo_orden       text,                     -- codigo de la orden de compra (raw, publicado)
  proveedor_nombre   text,                     -- nombre del proveedor (raw, publicado)
  tipo_persona       text,                     -- 'natural' | 'juridica' (etiqueta por tipo/umbral RUT)
  organismo          text,                     -- organismo comprador (raw, publicado)
  monto              text,                     -- monto VERBATIM como string (NO numeric — sin computar)
  fecha_oc           date,                     -- fecha de la orden de compra (raw, publicada)
  -- provenance inline NOT NULL (FND-08): cada dato lleva fuente, fecha y enlace original.
  origen             text not null,            -- "chilecompra"
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,            -- la URL / enlace de la orden en la fuente
  -- Atribucion ChileCompra = "mencion de la fuente" (NO CC BY 4.0). Viaja con la fila.
  licencia           text not null default 'mencion de la fuente',
  primary key (fuente_id, fecha_corte)         -- la CLAVE DE VERSION (incluye la fecha de corte)
);

-- RLS public-read EXPLICITO (espejo de 0021/0022): el deny-by-default heredado dejaria la
-- ficha en blanco. NO hay policies de insert/update/delete: el writer usa service key.
alter table contrato enable row level security;
create policy contrato_public_read on contrato for select to anon using (true);
-- GRANT explicito: la policy sin el privilegio de tabla no expone nada (defensa en profundidad).
grant select on contrato to anon;

create index contrato_parlamentario_idx on contrato (parlamentario_id);

-- == contratista (SUB-MAESTRA, DENY-BY-DEFAULT — copia VERBATIM 0021/0022) ==================
-- El contratista (entidad proveedora) keyed por RUT del proveedor: PII POTENCIAL (RUT de
-- persona natural; Ley 21.719). Espejo estructural de `declaracion_familiar` (0022) /
-- `lobby_contraparte` (0021): RLS habilitada SIN policies, SIN grant a anon, + REVOKE
-- explicito. La agregacion por contraparte vive en Phase 16; aqui es solo la sub-maestra cruda.
create table contratista (
  rut_proveedor     text primary key,          -- RUT del proveedor (ya DV-validado por el writer)
  nombre            text,                       -- nombre crudo del proveedor — uso INTERNO, nunca publico
  tipo_persona      text,                       -- 'natural' | 'juridica'
  codigo_empresa    text,                       -- CodigoEmpresa de ChileCompra (resuelto en el paso 1)
  -- provenance inline NOT NULL (FND-08).
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  -- Atribucion ChileCompra = "mencion de la fuente" (NO CC BY 4.0).
  licencia          text not null default 'mencion de la fuente'
);

-- DENY-BY-DEFAULT (Ley 21.719, LEGAL-03): enable SIN policies.
-- (intencionalmente NINGUN `create policy ... to anon`; intencionalmente NINGUN
-- `grant select ... to anon`) — RLS habilitada SIN policy => Postgres niega las filas a anon.
alter table contratista enable row level security;

-- DEFENSA EN PROFUNDIDAD (la LECCION DE PHASE 11): este proyecto Supabase concede por DEFAULT
-- PRIVILEGES todos los privilegios de tabla a `anon`/`authenticated` sobre CADA tabla nueva en
-- `public` (verificado en 11-01: anon hereda SELECT sin que la migracion lo otorgue). La RLS
-- sin policy ya niega las FILAS, pero LEGAL-03 exige que el PRIVILEGIO tampoco exista (el pgTAP
-- lo codifica). REVOCAR explicitamente todo de anon/authenticated cierra el hueco de los
-- default privileges. El service_role (writer) conserva sus privilegios y bypassa RLS.
revoke all on contratista from anon, authenticated;

-- == contratos_ingesta_estado (marcador de ingesta por-parlamentario — espejo de probidad) ==
-- Permite a la ficha distinguir (a) "no consultado todavia" (FILA AUSENTE) de (b) "consultado
-- sin contratos" (FILA PRESENTE, cero contratos confirmados) de (c) "enlazado" (>=1 contrato).
-- NO contiene PII (solo un FK + fecha) → public-read es correcto. El conector (Plan 02) la
-- upserta al final de una corrida que toco a ese parlamentario.
create table contratos_ingesta_estado (
  parlamentario_id text primary key references parlamentario(id) on delete cascade,
  ingestado_hasta  date,
  fecha_captura    timestamptz not null default now()
);
alter table contratos_ingesta_estado enable row level security;
create policy contratos_ingesta_estado_public_read on contratos_ingesta_estado for select to anon using (true);
grant select on contratos_ingesta_estado to anon;

-- == contratos_de_parlamentario(p_id) (RPC publico — HISTORIAL, espejo de declaraciones_de_parlamentario) ==
-- security definer: corre con privilegios del owner para leer el universo, pero DEVUELVE SOLO
-- los campos que la fuente publica + `fecha_corte` (sin parlamentario_id interno; SIN
-- rut_proveedor crudo — OQ3/A4: PII pendiente de sign-off legal F13, no emitir hasta entonces).
-- SOLO contratos CONFIRMADOS (parlamentario_id = p_id, enlace RUT-EXACTO) → un contrato no
-- confirmado NUNCA aparece bajo un parlamentario (estado honesto). Ordenados por fecha_oc DESC.
create function public.contratos_de_parlamentario(p_id text)
returns table (
  codigo_orden text, proveedor_nombre text, tipo_persona text, organismo text,
  monto text, fecha_oc date, origen text, fecha_captura timestamptz,
  fecha_corte date, enlace text, licencia text
)
language sql stable security definer set search_path = '' as $$
  select c.codigo_orden, c.proveedor_nombre, c.tipo_persona, c.organismo,
         c.monto, c.fecha_oc, c.origen, c.fecha_captura, c.fecha_corte, c.enlace, c.licencia
  from public.contrato c
  where c.parlamentario_id = p_id
  order by c.fecha_oc desc;
$$;

-- revoke from public + grant execute a anon sobre la firma EXACTA (espejo de 0021/0022).
revoke execute on function public.contratos_de_parlamentario(text) from public;
grant execute on function public.contratos_de_parlamentario(text) to anon;
