-- 0053_leylobby_cursor_estado — cursor incremental DURABLE del conector leylobby (DEBT-02).
--
-- El conector leylobby (packages/lobby) tenía hash-check R2 por-recurso (ingest-run.ts: existed
-- → [skip] sin novedades) pero la CLI fijaba `año=actual, página=1` cada corrida (ingest-cli.ts:
-- 141-143) → nunca avanzaba al histórico y re-pedía la misma página 1 contra un servidor volátil
-- (leylobby: Laravel/Azure, 403/503). Esta tabla marcador registra "hasta qué (año, página) llegó"
-- por institución; la CLI la LEE antes de derivar la tarea y la AVANZA tras una corrida exitosa.
--
-- Espeja la FORMA del marcador `lobby_ingesta_estado` (0021) / `aportes_ingesta_estado` (0024)
-- PERO con una diferencia deliberada de superficie: este cursor es USO INTERNO del cron (la ficha
-- NO lo consulta, a diferencia de lobby_ingesta_estado que sí es public-read porque la ficha
-- distingue los 3 estados). Por eso: RLS habilitada SIN policy `to anon` y SIN grant a anon
-- (deny-by-default; T-74-04 — no exponer superficie innecesaria). El writer server-side usa la
-- service key (bypassa RLS), como el resto de los writers de ingesta.

create table leylobby_cursor_estado (
  institucion_codigo text primary key,
  anio               int not null,
  pagina             int not null,
  fecha_captura      timestamptz not null default now()
);

-- Deny-by-default: RLS habilitada y SIN policy `to anon` (uso interno de cron, no ficha).
-- NO se otorga `grant select ... to anon` a propósito (T-74-04).
alter table leylobby_cursor_estado enable row level security;
