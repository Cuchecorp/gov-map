-- 0054_leyes_rotacion_estado — cursor de ROTACIÓN DURABLE del cron leyes-weekly (DEBT-04).
--
-- run-tramitacion-prod-cli (boletinesARefrescar) refresca cada semana la unión de
-- proyecto ∪ citacion_punto ∪ sesion_tabla_item, prioriza la agenda (actividad reciente)
-- y recorta a `limite` (80). Dos defectos silenciosos: (a) leía `proyecto` SIN `.range()`
-- → PostgREST recorta a ~1000 de 3.657 (cap 1k oculto), y (b) hacía `.slice(0, 80)` sobre
-- el MISMO prefijo cada viernes → la COLA de proyectos sin actividad de agenda NUNCA rotaba
-- (~2.657 proyectos jamás refrescados; frescura diluida sin ruido).
--
-- Esta tabla marcador es un SINGLETON (una sola fila de estado del cron de leyes): guarda el
-- `offset_rotacion` sobre la cola del corpus. La CLI lee el offset antes de seleccionar la
-- ventana y lo AVANZA tras la corrida → sucesivas corridas cubren rebanadas DISTINTAS
-- round-robin, garantizando cobertura de TODO el corpus a lo largo de las semanas sin cambiar
-- la cadencia del cron (lotes acotados, minutos CI intactos).
--
-- Espeja la FORMA del cursor `leylobby_cursor_estado` (0053) / `lobby_ingesta_estado` (0021)
-- pero con una diferencia deliberada de superficie: es USO INTERNO del cron (la ficha NO lo
-- consulta). Por eso: RLS habilitada SIN policy `to anon` y SIN grant a anon (deny-by-default;
-- T-74-04/T-74-05 — no exponer superficie innecesaria). El writer server-side usa la service
-- key (bypassa RLS), como el resto de los writers de ingesta.
--
-- Singleton reforzado en el schema: `id int primary key default 1 check (id = 1)` → una sola
-- fila posible. El writer upserta `id=1` (onConflict: "id").

create table leyes_rotacion_estado (
  id               int primary key default 1 check (id = 1),
  offset_rotacion  int not null default 0 check (offset_rotacion >= 0),
  ultimo_boletin   text,
  fecha_captura    timestamptz not null default now()
);

-- Deny-by-default: RLS habilitada y SIN policy `to anon` (uso interno de cron, no ficha).
-- NO se otorga `grant select ... to anon` a propósito (T-74-04 / T-74-05).
alter table leyes_rotacion_estado enable row level security;
