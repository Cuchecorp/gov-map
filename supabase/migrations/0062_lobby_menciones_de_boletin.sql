-- 0062_lobby_menciones_de_boletin.sql
-- Phase 92 — PERSONAS P2c — Lobby legible + audiencia→PL fail-closed (LOB-02):
-- RPC `lobby_menciones_de_boletin(p_boletin)` para la ficha PROYECTO — audiencias de
-- lobby cuya MATERIA menciona EXPLÍCITAMENTE este boletín (mención explícita, NUNCA
-- keywords/tema/similitud). Foundation del Plan 03 (sección en ficha proyecto).
--
-- ── ORDEN DE APPLY / COMANDO ────────────────────────────────────────────────────────────
-- La última migración APLICADA es 0061. Esta es la 0062 y se aplica DESPUÉS. Es ADITIVA
-- (crea UNA función nueva; sin DROP de tabla, sin backfill, sin ALTER) → dentro de la
-- autoridad del agente para ESCRIBIR. El APPLY a PROD se difiere al Plan 04 (precedente
-- 0059-0061), por el AGENTE vía:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0062_lobby_menciones_de_boletin.sql
-- NUNCA `supabase db push` (drift de schema_migrations). Aplicar UNA vez. La única prueba
-- válida del DDL es el pgTAP (0062_lobby_menciones_de_boletin.test.sql) contra el schema
-- APLICADO (build/typecheck son falsos positivos para DDL).
--
-- ── ACL (Camino A, post-0044): CERO grant ──────────────────────────────────────────────
-- El sitio ejecuta con service_role (bypassa ACL/RLS). La RPC lleva el doble-revoke
-- VERBATIM de 0060/0061 (revoke all … from public; + from anon, authenticated;) para
-- limpiar los DEFAULT PRIVILEGES que Postgres re-concede sobre funciones nuevas de
-- `public`. NUNCA re-emitir grant. security definer set search_path = '' con nombres
-- schema-qualified; p_boletin parametrizado; LIMIT bounded. Cero rut/email/contraparte_id.
--
-- ── FAIL-CLOSED DOBLE (LOB-02) ──────────────────────────────────────────────────────────
--   (1) MENCIÓN EXPLÍCITA: la materia debe CONTENER el número de boletín según el MISMO
--       patrón determinista context-gated del extractor TS (app/lib/boletin-en-materia.ts).
--       Regla LOCKED espejada en SQL (guard de equivalencia — el pgTAP prueba filas
--       mencionadas vs no-mencionadas contra el fixture compartido FIXTURE_MATERIA):
--         (a) forma CON sufijo `{base}-{sufijo}` (punteada o plana) en cualquier posición
--             → inequívoca por el sufijo; O
--         (b) número SIN sufijo `{base}` (punteado o plano) SOLO si va PRECEDIDO por la
--             palabra "boletín"/"boletin"/"bol." dentro de ~3 tokens (gatillo léxico).
--       JAMÁS keywords/tema. Un número pelado sin gatillo ("Ley 20.730", "año 2024",
--       "20730" suelto, "$14.309") NO cuenta.
--   (2) EXISTENCIA: se hace `join public.proyecto` por el boletín de p_boletin → si el
--       boletín no existe en `proyecto`, la RPC no emite NADA (la función se llama SIEMPRE
--       con el boletín de una ficha real, así que (2) es la compuerta que impide fabricar
--       enlaces a boletines inexistentes cuando el consumidor pasa un p_boletin arbitrario).
--
-- ── FAIL-CLOSED IDENTIDAD (espejo 0021/0048) ────────────────────────────────────────────
--   SOLO audiencias `estado_vinculo = 'confirmado'` con `parlamentario_id is not null`.
--   Una audiencia no confirmada o sin sujeto pasivo NUNCA aparece.
--
-- ── PII-SAFE (espejo lobby_de_parlamentario/0021) ───────────────────────────────────────
--   Emite el nombre PÚBLICO del parlamentario (concat_ws, espejo 0061) + contraparte cruda
--   (nombre/rol/representado — como ya lo hace lobby_de_parlamentario) SIN contraparte_id ni
--   RUT. total_n = count(*) over () (conteo honesto, 0061). Orden fecha DESC, LIMIT bounded.

-- ── E.1 lobby_menciones_de_boletin (fail-closed doble + total_n + LIMIT bounded) ──────────
-- Función NUEVA (no existía) → basta create; el drop-if-exists mantiene idempotencia del
-- archivo por si se re-corre durante desarrollo (no dispara 42P13 porque es create-nuevo).
drop function if exists public.lobby_menciones_de_boletin(text);

create or replace function public.lobby_menciones_de_boletin(p_boletin text)
returns table (
  identificador text,
  fecha timestamptz,
  materia text,
  parlamentario_id text,
  parlamentario_nombre text,
  contraparte_nombre text,
  contraparte_rol text,
  representado text,
  enlace_detalle text,
  origen text,
  fecha_captura timestamptz,
  enlace text,
  total_n bigint
)
language sql stable security definer set search_path = '' as $$
  with req as (
    -- Normaliza p_boletin a (base sin puntos, sufijo opcional). p_boletin llega en forma
    -- canónica del extractor TS ("14309" | "14309-04") o punteada ("14.309-04").
    select
      replace(split_part(p_boletin, '-', 1), '.', '') as base,
      nullif(split_part(p_boletin, '-', 2), '')       as sufijo
  ),
  pat as (
    -- Construye los patrones SQL que ESPEJAN el extractor TS context-gated. `base_dot`
    -- matchea la base con puntos de miles opcionales (p.ej. 14309 o 14.309). El borde
    -- \m…\M (word-boundary de Postgres) delimita el número para no matchear substrings.
    select
      r.base,
      r.sufijo,
      -- base con separador de miles opcional entre cualquier trío: (\d{1,3}(\.\d{3})*|\d{3,6})
      -- pero anclada al valor concreto: aceptamos la base plana o su forma punteada canónica.
      '(' || r.base || '|' ||
        regexp_replace(r.base, '(\d{1,3})(\d{3})$', '\1.\2') || ')' as base_dot
    from req r
  )
  select d.identificador, d.fecha, d.materia, d.parlamentario_id,
         d.parlamentario_nombre, d.contraparte_nombre, d.contraparte_rol,
         d.representado, d.enlace_detalle, d.origen, d.fecha_captura, d.enlace,
         count(*) over () as total_n
  from (
    select a.identificador, a.fecha, a.materia, a.parlamentario_id,
           coalesce(
             nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
             p.nombre_normalizado
           ) as parlamentario_nombre,
           c.nombre  as contraparte_nombre,
           c.rol     as contraparte_rol,
           c.representado_text as representado,
           a.enlace_detalle, a.origen, a.fecha_captura, a.enlace
    from public.lobby_audiencia a
    -- FAIL-CLOSED #2 (existencia): el boletín debe existir en `proyecto`.
    join public.proyecto pr
      on pr.boletin = p_boletin
      or pr.boletin_num = (select base from req)
    join public.parlamentario p on p.id = a.parlamentario_id
    left join public.lobby_contraparte c on c.identificador = a.identificador
    cross join pat
    where a.estado_vinculo = 'confirmado'
      and a.parlamentario_id is not null   -- FAIL-CLOSED identidad (espejo 0048)
      and a.materia is not null
      and (
        -- (a) MENCIÓN CON sufijo -NN en cualquier posición (inequívoca). SOLO aplica cuando el
        --     boletín objetivo TIENE sufijo (p_boletin='14309-04'): la materia debe contener
        --     exactamente {base}-{sufijo}. Espejo del branch (a) del extractor TS.
        (pat.sufijo is not null
         and a.materia ~ ('\m' || pat.base_dot || '-' || pat.sufijo || '\M'))
        -- (b) MENCIÓN de la BASE pelada tras gatillo "boletín"/"boletin"/"bol.". Aplica SIEMPRE
        --     (con o sin sufijo en p_boletin): una materia que dice "boletín 14309" se refiere a
        --     la base 14309 y por tanto al proyecto 14309-04. Gatillo + 0-2 tokens INTERMEDIOS
        --     SIN dígitos (p.ej. "N°", "el") + la base. Los tokens intermedios se restringen a
        --     runs sin dígitos ([^[:space:][:digit:]]+) para que NUNCA consuman el propio número
        --     objetivo (robustez de backtracking) y para que un dígito intercalado corte el
        --     gatillo (espejo TS: la ventana de gatillo se mide en tokens, no salta números).
        --     El `(?!-)` negativo lo emula con `\M` seguido de la ausencia de sufijo:
        --     `base_dot` + `\M` matchea "14309" pelado; NO matchea "14309-04" (el guion rompe
        --     el word-boundary \M solo si hay dígitos; por eso además excluimos que siga `-\d`).
        or a.materia ~* ('(bolet[ií]n|bol\.)(\s+[^[:space:][:digit:]]+){0,2}\s+' || pat.base_dot || '\M(?!-[[:digit:]])')
      )
  ) d
  order by d.fecha desc nulls last
  limit 50;
$$;

revoke all on function public.lobby_menciones_de_boletin(text) from public;
revoke all on function public.lobby_menciones_de_boletin(text) from anon, authenticated;
