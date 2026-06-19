-- 0018_piso_pii.sql
-- PISO de RLS deny-by-default para TODA PII nueva de v2.0 (LEGAL-03, Ley 21.719).
-- Convencion REUTILIZABLE que Phases 11/12/14/15 copian-pegan al introducir PII
-- (lobby de contraparte, declaracion de patrimonio/intereses, donantes, contratos).
--
-- PRINCIPIOS (espejo EXACTO de 0005_parlamentario.sql:60-64):
--   * Toda tabla con PII nace con `enable row level security` y CERO policies.
--     anon NUNCA lee la PII (ni RUT, ni email, ni dato de declaracion); solo el
--     service role (Edge Functions/CI). Sin `create policy ... to anon`, sin
--     `grant select ... to anon`. RLS habilitada SIN policy => deny-by-default
--     efectivo (Postgres niega todo a roles no privilegiados).
--   * Provenance INLINE NOT NULL en cada fila (FND-08): `origen`, `fecha_captura`,
--     `enlace`. Cada dato lleva su fuente, fecha y enlace original — principio
--     rector del proyecto (trazabilidad a la fuente).
--   * Las filas PUBLICAS llevan SOLO el FK `parlamentario_id` (nunca el RUT ni el
--     dato personal): la PII vive en una TABLA deny-by-default, NO como columna en
--     una tabla publica (RESEARCH §RLS migration convention; postura del proyecto).
--   * NUNCA fabricar identidad: el FK a `parlamentario` solo se puebla con un
--     enlace confirmado/determinista (IDENT-12); texto crudo si no hay match.
--
-- CONVENCION COPY-PASTE (plantilla para PII futura):
--   create table <pii_nueva> (
--     ...campos PII...,
--     parlamentario_id text references parlamentario(id),  -- FK, solo si confirmado
--     origen        text not null,
--     fecha_captura timestamptz not null default now(),
--     enlace        text not null
--   );
--   alter table <pii_nueva> enable row level security;
--   -- (intencionalmente NINGUN create policy; intencionalmente NINGUN grant a anon)
--
-- Esta migracion MATERIALIZA la convencion como una tabla-exemplar deny-by-default
-- (`pii_contraparte_declaracion`) que sirve de plantilla viva: lleva su provenance,
-- su FK opcional a `parlamentario`, su RLS habilitada SIN policies, y deja un RUT de
-- contraparte estrictamente interno (uso interno, jamas expuesto a anon ni al LLM).
--
-- La APLICACION del DDL + la corrida pgTAP NO se hacen aqui: son un checkpoint de
-- OPERADOR (Task 3). build/typecheck NO prueban que Postgres ejecuto la migracion
-- (falso positivo de CI, RESEARCH Pitfall 4). La unica prueba valida de LEGAL-03 es
-- el pgTAP (0018_piso_pii.test.sql) corriendo contra un schema APLICADO.

-- ── Tabla-exemplar de PII deny-by-default (plantilla para Phases 11/12/14/15) ───
-- PII de contraparte/declaracion: el dato personal de un tercero o del propio
-- parlamentario que NO puede leer anon. Espejo estructural de `parlamentario`:
-- columnas PII internas + provenance NOT NULL + FK opcional, RLS sin policies.
create table pii_contraparte_declaracion (
  id                 bigint generated always as identity primary key,
  -- FK al parlamentario SOLO cuando hay enlace confirmado/determinista (IDENT-12);
  -- nullable: si la identidad no esta confirmada, la fila guarda solo el texto crudo.
  parlamentario_id   text references parlamentario(id) on delete set null,
  -- ── Campos PII (uso INTERNO, jamas expuestos a anon ni a un LLM) ──
  nombre_contraparte text not null,            -- nombre del tercero/declarante (dato personal)
  rut_contraparte    text,                     -- NULLABLE, USO INTERNO: identificador duro; cruce determinista, nunca al prompt (FND-06)
  tipo_dato          text not null
                       check (tipo_dato in ('patrimonio', 'interes', 'lobby', 'donacion', 'contrato')),
                       -- el tipo de declaracion/PII; check para no admitir categorias libres.
  detalle            text,                     -- texto crudo de la declaracion (puede contener PII; nunca a anon)
  -- ── Provenance inline (FND-08): origen + fecha de captura + enlace de la fuente ──
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null
);

-- RLS deny-by-default (Ley 21.719, V4/V8): enable SIN policies.
-- anon NUNCA lee esta tabla (ni rut_contraparte, ni nombre, ni detalle); solo el
-- service role. Espejo EXACTO del patron de 0005_parlamentario.sql.
-- (intencionalmente NINGUN `create policy ... to anon`; NINGUN `grant select ... to anon`)
alter table pii_contraparte_declaracion enable row level security;

-- ── Re-asegurar el piso heredado: parlamentario sigue deny-by-default ──────────
-- Tras el backfill de RUT de 09-02, `parlamentario.rut` DEBE seguir oculto a anon.
-- RLS ya quedo habilitada por 0005; este `alter ... enable` es IDEMPOTENTE y
-- re-codifica explicitamente la invariante en el piso PII (anon nunca lee el RUT).
alter table parlamentario enable row level security;
