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
-- ORDEN TOTAL DECLARADO: (plausibilidad de fecha desc, fecha asc, id asc).
--   La PRIMERA clave (WR-01, ver comentario en el `row_number()` abajo) espeja
--   `fechaValida()`/`fechaPlausible` del builder: las fechas nulas, no parseables o
--   fuera del rango [1990-01-01, now+5 años] van AL FINAL en ambos lados. Sin ella,
--   un typo de siglo bajo iba primero en SQL y último en el render. Las otras dos
--   claves son el desempate cronológico:
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
-- RECONCILIACIÓN (fix W-2, plan-checker): el número de "Hito del" citado en
--   ROADMAP.md §131 para el testigo 14309-04 fue medido bajo el orden VIEJO
--   (`fecha` sola, NO determinista, resultado dependiente del desempate físico de
--   Postgres). El número "H" que esta query mide y que congela
--   `app/components/__fixtures__/timeline-14309-04.esperado.json` es el resultado
--   BAJO EL ORDEN TOTAL DECLARADO `(fecha asc, id asc)`. Que ambos coincidan
--   numéricamente (ver *.esperado.json para el valor) es COINCIDENCIA de esta
--   corrida, NO garantía: el punto de D-03 es que H queda FIJO por el orden total,
--   ya no a merced del desempate físico que citó ROADMAP. Una diferencia entre el
--   número viejo y H NO sería una regresión: sería la CORRECCIÓN del defecto de
--   determinismo. Repetir esta misma nota en 131-01-SUMMARY.md para que el audit
--   no lea una eventual diferencia futura como regresión.
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
-- QUÉ CUENTA `hitos_del` — PRECONDICIONES (WR-02, para que Phase 138 no lea un
--   mismatch como regresión). `hitos_del` = ítems `kind:"evento"` que emite
--   `construirItems` (= eventos_totales − eventos_absorbidos). Eso IGUALA el conteo
--   DOM de `Hito del` en el HTML renderizado SÓLO bajo dos precondiciones:
--     1. SIN `?urgencias=uN` en la URL. Ese parámetro EXPANDE un período colapsado y
--        renderiza sus eventos como `TimelineEvent` (timeline-view.tsx:305-310) ⇒ el
--        DOM pasa a `hitos_del + n(uN)`. El default de la ficha es colapsado.
--     2. TODOS los eventos con fecha PLAUSIBLE. `TimelineEvent` sólo emite el
--        `<span>Hito del …</span>` si `fecha && fechaPlausible(fecha)`
--        (timeline-event.tsx:101) ⇒ un ítem `kind:"evento"` con fecha nula o
--        implausible SÍ cuenta en `hitos_del` pero NO aparece en el HTML.
--   Ambas VERIFICADAS para el testigo 14309-04 (cero fechas nulas/implausibles). Para
--   CUALQUIER otro boletín hay que re-verificarlas antes de comparar contra el DOM.
--
-- Uso (patrón obligatorio del repo, boletín parametrizado por variable psql — JAMÁS
-- interpolación de string):
--   set -a && . ./.env && set +a && export PGCLIENTENCODING=UTF8
--   psql "$SUPABASE_DB_URL" -tA -F'|' -v boletin=14309-04 -f supabase/queries/timeline-regla-de-seleccion.sql | tr -d '\r'
with e as (
  select *,
    -- CR-01 (131-REVIEW): `coalesce(descripcion,'')` OBLIGATORIO antes de comparar.
    -- `descripcion` es NULLABLE (0008_tramitacion.sql:75) y en lógica trivaluada
    -- `NULL ~* 'retira'` = NULL ⇒ `colapsable = es_urg and not es_retiro` = NULL, que
    -- el `where colapsable` de la CTE `runs` DESCARTA. El espejo TS
    -- (`esRetiroUrgencia`) hace `/retira/i.test(e.descripcion ?? "")` → `false`, o sea
    -- el evento de urgencia sin descripción SÍ es colapsable (con `ukey = ""`). Sin el
    -- coalesce la query mide `eventos_absorbidos` MENOR que el builder y además rompe
    -- la contigüidad de los runs vecinos (el evento sale de su partición y une dos
    -- islas que en TS están cortadas). El testigo 14309-04 tiene CERO descripciones
    -- nulas ⇒ el defecto era invisible en el número congelado (99|14|5|85 idéntico
    -- antes y después de este fix, re-medido contra PROD), pero la query se declaraba
    -- "espejo" y no lo era para CUALQUIER OTRO boletín. El mismo riesgo era simétrico
    -- y latente en `es_urg` (`tipo='tramite' and NULL` = NULL): convergía con TS por
    -- accidente del `where colapsable`, no por diseño. Ahora ambos son por diseño.
    (tipo = 'urgencia' or (tipo = 'tramite' and coalesce(descripcion, '') ~* 'urgencia')) as es_urg,
    (coalesce(descripcion, '') ~* 'retira')                                              as es_retiro,
    lower(trim(case
      when tipo = 'urgencia' then coalesce(descripcion, '')
      else coalesce((regexp_match(coalesce(descripcion,''), 'urgencia\s+([^.,;]+)', 'i'))[1],
                    'urgencia')
    end)) as ukey,
    -- WR-01 (131-REVIEW): el orden total NO es `(fecha asc, id asc)` a secas — el
    -- builder TS re-ordena con `fechaValida()` (timeline-view.tsx:64-69), que devuelve
    -- `null` para fecha ausente, no parseable, o FUERA DEL RANGO PLAUSIBLE
    -- (`fechaPlausible`, lib/format.ts:170-177 — piso `1990-01-01` UTC, techo
    -- `now + 5 años`) y las manda AL FINAL, en orden de entrada (sort estable ES2019).
    -- Postgres, en cambio, ordena por el valor CRUDO: un typo de siglo BAJO
    -- (`0202-05-25`, `1907-…`) quedaba PRIMERO en la query y ÚLTIMO en el render ⇒
    -- runs distintos ⇒ `eventos_absorbidos`/`hitos_del` distintos. El typo real
    -- conocido de PROD (`2626-05-25`, boletín 18232-25 — 2 filas por encima del techo
    -- [VERIFIED PROD 2026-07-30]) convergía sólo porque es el máximo: por accidente.
    -- Aquí se espeja la plausibilidad como PRIMERA clave del orden total. Dentro del
    -- grupo implausible se conserva `(fecha, id)`, que es exactamente el orden de
    -- entrada que el sort estable de TS preserva (la lectura de page.tsx entrega
    -- (fecha asc, id asc)) ⇒ paridad también en la cola.
    --
    -- LÍMITE DECLARADO (deuda conocida, NO cerrable aquí): el techo de plausibilidad
    -- es MÓVIL (`now + 5 años`) en ambos lados ⇒ el orden depende del RELOJ. Un evento
    -- fechado a >5 años vista hoy entra al orden cronológico dentro de 5 años y cambia
    -- H sin que cambie un solo dato — el mismo no-determinismo que D-03 vino a cerrar,
    -- en otro eje. Se deja espejado (query y builder se mueven JUNTOS, que es lo que
    -- la paridad exige) y declarado; congelar el techo exigiría rediseñar
    -- `fechaPlausible`, que es transversal a toda la app.
    row_number() over (
      order by (fecha is not null
                and fecha >= timestamptz '1990-01-01'
                and fecha <= now() + interval '5 years') desc,
               fecha asc, id asc) as rn
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
