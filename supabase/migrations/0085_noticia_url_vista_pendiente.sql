-- 0085_noticia_url_vista_pendiente.sql
--
-- ████ Gap closure Phase 132 (132-09) — CR-02: el ledger no puede mentir ████
--
-- CR-02 (132-REVIEW.md): `carga-run.ts` escribía `estado='descarta', causa='prefiltro_lexico'`
-- como marcado PROVISIONAL, antes de saber si el ítem realmente pasaba el pre-filtro. Si el
-- ítem SÍ pasaba pero el `upsertNoticias`/`marcarVistas` final fallaba (error transitorio de
-- red, 5xx de PostgREST, timeout), la fila quedaba con una causa de descarte FALSA y PERMANENTE:
-- la corrida siguiente la contaba como duplicado (dedup nivel 1) y jamás la re-evaluaba. Eso es
-- pérdida definitiva del dato — el falso negativo que D-06 declara inaceptable — y además infla
-- artificialmente la métrica de `prefiltro_lexico` del SC4.
--
-- Esta migración amplía `noticia_url_vista.estado` con un tercer valor: `'pendiente'`. Es el
-- marcado PROVISIONAL neutro (sin causa: `causa` permanece `null`) que se escribe ANTES de
-- evaluar el pre-filtro. La causa FINAL (`prefiltro_lexico`) solo se escribe DESPUÉS de que la
-- decisión se tomó y el destino (fila en `noticia`, o descarte confirmado) quedó resuelto. Una
-- fila `pendiente` es re-evaluable en la corrida siguiente (el código de `carga-run.ts`/132-09
-- Task 2 la trata como NO vista); una fila con `estado` resuelto (`pasa`/`descarta`) no lo es.
--
-- Por qué NO se agrega `'error_carga'` a `causa` (alternativa sugerida en el review): con
-- `estado='pendiente'` + `causa=null` el ítem ya es re-evaluable sin falta de un vocabulario de
-- causas de error que después nadie consulta. `causa` sigue significando exclusivamente "por qué
-- se descartó" (un veredicto), nunca "qué falló en el proceso" (un evento operacional).
--
-- ADITIVA/compatible: PROD hoy tiene `noticia_url_vista`=245 filas, todas con `estado` en
-- ('pasa','descarta'). El nuevo check SOLO amplía el dominio — ninguna fila existente lo viola.
--
-- ── ORDEN DE APPLY / COMANDO (régimen LOCKED) ───────────────────────────────────
-- Última migración APLICADA antes de esta: 0084. `0073`/`0075` siguen ESCRITAS y NO aplicadas —
-- JAMÁS se editan ni se reordenan; esta migración es puramente aditiva.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0085_noticia_url_vista_pendiente.sql
-- NUNCA `supabase db push` (drift del ledger). pgTAP contra el schema APLICADO = única prueba.
--
-- El nombre de la constraint a reemplazar se descubrió ANTES de escribir esta migración con:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid='public.noticia_url_vista'::regclass and contype='c';
-- Resultado: `noticia_url_vista_estado_check` (nombre autogenerado por Postgres para el check
-- inline de 0084). Se usa el nombre LITERAL, sin `if exists`, para que un nombre equivocado
-- falle ruidosamente dentro de la transacción en vez de no-opear en silencio.
--
-- ████████████████████████████████████████████████████████████████████████████████

alter table noticia_url_vista drop constraint noticia_url_vista_estado_check;

alter table noticia_url_vista add constraint noticia_url_vista_estado_check
  check (estado in ('pasa', 'descarta', 'pendiente'));

-- La consulta de dedup (urlsYaVistas, contrato 132-09) filtra por estado resuelto
-- (`in ('pasa','descarta')`) para excluir los `pendiente` re-evaluables.
create index if not exists noticia_url_vista_estado_idx on noticia_url_vista (estado);

-- ── FIN 0085 ───────────────────────────────────────────────────────────────────
-- ledger: insert into supabase_migrations.schema_migrations (version) values ('0085');
-- (esquema calificado — en esta base el ledger vive en supabase_migrations, NO en public)
