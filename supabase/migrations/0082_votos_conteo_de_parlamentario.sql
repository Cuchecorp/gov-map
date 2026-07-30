-- 0082_votos_conteo_de_parlamentario.sql
-- Phase 130 — VOTOS-REAL B-01 "el número falso muere" — Plan 01 (DEBT-01).
-- RPC agregada de CONTEO sobre el universo COMPLETO de votos confirmados, para
-- reemplazar el número falso derivado de las 1.000 filas que devuelve
-- `votos_de_parlamentario` (recortadas por su `order by fecha desc` + `limit`). Ejemplo
-- medido en PROD 2026-07-30: D1165 tiene 3.752 votos confirmados reales, no 1.000.
--
-- ── (a) ADITIVA — D-03 ────────────────────────────────────────────────────────────
-- Esta migración NO toca `public.votos_de_parlamentario` (firma viva
-- `(text, integer, integer)`, 0078 L185-206). Tocar su firma dispara 42P13 y rompe el
-- listado paginado que sigue vivo y en uso; el conteo agregado vive en una RPC nueva y
-- separada. `votos_de_parlamentario` queda intacta y se verifica en Plan 01 Task 2.
--
-- ── (b) ACL (Camino A, post-0044): CERO grant ────────────────────────────────────
-- El sitio ejecuta con service_role (bypassa ACL/RLS). Doble-revoke explícito al
-- final de este archivo, molde 0068 verbatim, para limpiar los DEFAULT PRIVILEGES
-- que Postgres re-concede sobre funciones nuevas de `public`. JAMÁS re-emitir grant.
--
-- ── (c) OMISIÓN DELIBERADA de `left join proyecto` / `left join proyecto_ficha` ──
-- `votos_de_parlamentario` (0078 L198-202) hace LEFT JOIN a `proyecto` y
-- `proyecto_ficha` por `boletin` para traer título/idea_matriz — sustancia que esta
-- RPC de conteo NO necesita (solo agrega por `seleccion`). Se midió en PROD el
-- 2026-07-30 que ambos joins son NO-FAN-OUT (cero boletines duplicados en
-- `proyecto` ni en `proyecto_ficha`), así que omitirlos no cambia la cardinalidad
-- HOY. Se omiten aquí por robustez: incluirlos crearía una dependencia silenciosa de
-- que esa unicidad se mantenga para siempre. El pgTAP (assert 9) mide exactamente
-- esa equivalencia con-join vs sin-join como centinela: si `proyecto` alguna vez
-- admite boletines duplicados, este assert se pone rojo ANTES de que listado y
-- conteo diverjan en silencio (clase de bug B-01).
--
-- ── Molde de la aguja completa (0068 verbatim) ────────────────────────────────────
-- drop-first anti-42P13, `security definer`, `set search_path = ''` con TODOS los
-- nombres schema-qualified (`public.voto`, `public.votacion` — con search_path=''
-- un `from voto` pelado falla en RUNTIME, no al crear: Pitfall 3), `statement_timeout
-- = '5s'` (cota DoS; un `create or replace` que omita esta cláusula la BORRA en
-- silencio — riesgo Nº1 de 0078 L93-96), `p_id` como parámetro tipado (T-51-05: cero
-- `format()`, cero concatenación), `limit 1000` (piso LOCKED del régimen; sobre 5
-- filas agrupadas por `seleccion` es trivialmente holgado), doble-revoke, y un
-- post-check dentro de la propia transacción que verifica `prosecdef` + `proconfig`
-- (Pitfall 4: si una cláusula `set` se pierde, la transacción aborta sola).
--
-- ── DOMINIO DE `seleccion` (Fable blocker 2 — M3 NO-DEDUPE, header) ──────────────
-- Esta RPC NO dedupea por (votacion, parlamentario) — a diferencia de 0068
-- (coincidencia_votos_par, que sí dedupea para comparar PARES y excluye conflictos),
-- esta RPC espeja el LISTADO (`votos_de_parlamentario`), que TAMPOCO dedupea: cada
-- fila confirmada de `voto` cuenta, sea o no duplicado de la misma persona en la
-- misma votación bajo otro `fuente_voter_id`. Se midió en PROD 2026-07-30 que hay
-- CERO duplicados globales sobre el universo confirmado (283.550 filas, dominio de
-- `seleccion` cerrado exacto sobre si/no/abstencion/pareo/ausente). Un lector futuro
-- NO debe "arreglar" esta RPC agregando dedupe hacia el molde 0068 — eso la
-- divergiría del listado que debe espejar (la paridad sum(n)==count(*) es el
-- contrato, no un accidente de implementación).
--
-- ── ORDEN DE APPLY / COMANDO (Plan 01 Task 2) ────────────────────────────────────
-- Última migración = 0081. Ésta es la 0082 y se aplica DESPUÉS:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0082_votos_conteo_de_parlamentario.sql
-- NUNCA `supabase db push` (drift de schema_migrations, precedente 0060/0061/0067/0068).
-- La ÚNICA prueba válida del DDL es el pgTAP contra el schema APLICADO (Pitfall 6).

drop function if exists public.votos_conteo_de_parlamentario(text);

create or replace function public.votos_conteo_de_parlamentario(p_id text)
returns table (seleccion text, n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select v.seleccion, count(*) as n
  from public.voto v
  join public.votacion vo on vo.id = v.votacion_id
  where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
  group by v.seleccion
  limit 1000;
$$;

revoke all on function public.votos_conteo_de_parlamentario(text) from public;
revoke all on function public.votos_conteo_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- POST-CHECK fail-closed — verifica el ESTADO RESULTANTE, no la ausencia de error
-- (lección v12: REVOKE sobre objetos ajenos no falla, no-opea con WARNING 01006)
-- ═══════════════════════════════════════════════════════════════════════════════════
do $postchk$
declare
  v_oid regprocedure;
  v_secdef boolean;
  v_proconfig text;
begin
  v_oid := 'public.votos_conteo_de_parlamentario(text)'::regprocedure;

  select p.prosecdef, array_to_string(p.proconfig, ',')
    into v_secdef, v_proconfig
  from pg_proc p
  where p.oid = v_oid::oid;

  if v_secdef is distinct from true then
    raise exception 'POST-CHECK 0082 FALLO: votos_conteo_de_parlamentario no es security definer.';
  end if;

  if v_proconfig is null or v_proconfig !~ 'search_path=' then
    raise exception 'POST-CHECK 0082 FALLO: perdio search_path= (proconfig=%).', coalesce(v_proconfig, 'NULL');
  end if;

  if v_proconfig !~ 'statement_timeout=5s' then
    raise exception 'POST-CHECK 0082 FALLO: perdio statement_timeout=5s (proconfig=%).', coalesce(v_proconfig, 'NULL');
  end if;
end;
$postchk$;
