-- REGLA DE SELECCIÓN DEL TIMELINE (espejo documental de `construirItems`,
-- app/components/timeline-view.tsx:148-220) — H-06/D-03 (fase 131).
--
-- QUÉ ENTRA: TODO evento de `tramitacion_evento` del boletín. NADA se excluye del
--   render — la brecha entre "eventos del boletín" y líneas "Hito del" que el usuario
--   ve es 100% AGRUPACIÓN, cero filtrado. Cada evento aparece en el timeline, ya sea
--   como hito suelto o absorbido dentro de un período colapsado.
--
-- QUÉ SE AGRUPA: runs CONTIGUOS, en el ORDEN TOTAL declarado abajo, de eventos de
--   urgencia que NO son retiro y comparten `tipoUrgenciaKey` normalizada (tipo de
--   urgencia en minúsculas, o el texto tras "urgencia " en un trámite), con longitud
--   >= 2. Un run de longitud 1 (un evento-urgencia aislado, sin par) NO se colapsa:
--   se renderiza como hito normal.
--
-- QUÉ SE EXCLUYE: nada. Cero eventos se ocultan del render; sólo se re-empaquetan.
--
-- POR QUÉ: la renovación repetitiva de un mismo tipo de urgencia ("Suma" renovada
--   N veces) enterraba la señal estructural del timeline (Pitfall 3 LOCKED,
--   130-RESEARCH/131-RESEARCH). Un RETIRO de urgencia ("retira ... la urgencia") NO
--   es una renovación — corta el run y siempre se muestra como hito normal, nunca se
--   cuenta como parte de un período colapsado (espejo de `esRetiroUrgencia`).
--
-- ORDEN TOTAL DECLARADO: (fecha asc, id asc).
--   Sin desempate por `id` el resultado del `row_number()` NO es determinista: el
--   plan/heap/orden físico que Postgres entregue dentro de un mismo valor de `fecha`
--   puede variar entre corridas/vacuums, y como el colapso de urgencias exige
--   CONTIGÜIDAD, el número de líneas "Hito del" cambiaba entre corridas SIN que
--   cambiara un solo dato (medido en PROD: 14/12/16 eventos absorbidos según el
--   criterio de desempate usado — ver 131-RESEARCH.md §Open Questions Q1). `id` es
--   la única columna garantizada única de `tramitacion_evento` [VERIFIED PROD] ⇒
--   es la clave de desempate elegida. El espejo TS vive en
--   `app/app/proyecto/[boletin]/page.tsx` (Task 2 de este plan): la lectura encadena
--   `.order("fecha", { ascending: true }).order("id", { ascending: true })`.
--
-- RECONCILIACIÓN (fix W-2, plan-checker): el número "85" citado en
--   ROADMAP.md/REQUIREMENTS.md para el testigo 14309-04 fue medido bajo el orden
--   VIEJO (`fecha` sola, NO determinista, resultado dependiente del desempate físico
--   de Postgres). El número "H" que esta query mide y que congela
--   `app/components/__fixtures__/timeline-14309-04.esperado.json` es el resultado
--   BAJO EL ORDEN TOTAL DECLARADO `(fecha asc, id asc)`. Una diferencia entre 85 y H
--   NO es una regresión: es la CORRECCIÓN del defecto de determinismo (D-03). Repetir
--   esta misma nota en 131-01-SUMMARY.md para que el audit no lea la diferencia como
--   regresión.
--
-- FECHA: `tramitacion_evento.fecha` es `timestamptz` **date-only disfrazado**
--   (medianoche UTC = día chileno publicado). PROHIBIDO `at time zone
--   'America/Santiago'` en esta query — correría el día. La regla opera sobre ORDEN
--   de eventos, no sobre calendario: no necesita aislar la parte día.
--
-- SEDE ÚNICA DEL NÚMERO CONGELADO: `app/components/__fixtures__/timeline-14309-04.esperado.json`
--   (boletin, orden, medido_en, eventos_totales, eventos_absorbidos, periodos, hitos_del).
--   PROHIBIDO repetir el número literal en cualquier otro archivo (Pitfall 2 del research).
--
-- Uso (patrón obligatorio del repo, boletín parametrizado por variable psql — JAMÁS
-- interpolación de string):
--   set -a && . ./.env && set +a && export PGCLIENTENCODING=UTF8
--   psql "$SUPABASE_DB_URL" -tA -F'|' -v boletin=14309-04 -f supabase/queries/timeline-regla-de-seleccion.sql | tr -d '\r'
with e as (
  select *,
    (tipo = 'urgencia' or (tipo = 'tramite' and descripcion ~* 'urgencia')) as es_urg,
    (descripcion ~* 'retira')                                              as es_retiro,
    lower(trim(case
      when tipo = 'urgencia' then coalesce(descripcion, '')
      else coalesce((regexp_match(coalesce(descripcion,''), 'urgencia\s+([^.,;]+)', 'i'))[1],
                    'urgencia')
    end)) as ukey,
    row_number() over (order by fecha asc, id asc) as rn
  from public.tramitacion_evento
  where boletin = :'boletin'
), f as (
  select *, (es_urg and not es_retiro) as colapsable from e
), g as (
  select *, rn - row_number() over (partition by colapsable, ukey order by rn) as grp from f
), runs as (
  select ukey, grp, count(*) as n
  from g where colapsable
  group by ukey, grp
  having count(*) >= 2
)
select (select count(*) from e)                              as eventos_totales,
       coalesce((select sum(n) from runs), 0)                as eventos_absorbidos,
       (select count(*) from runs)                           as periodos,
       (select count(*) from e) - coalesce((select sum(n) from runs), 0) as hitos_del;
