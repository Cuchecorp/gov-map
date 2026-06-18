-- 0012_parlamentario_estado_guarda.sql
-- #2 (code-review v1.0): guarda anti-regresión de `parlamentario.estado`.
--
-- El writer de la maestra (packages/identity/src/writer-supabase.ts) hace
-- `upsert(rows, { onConflict: 'id', ignoreDuplicates: false })`, que reescribe
-- TODAS las columnas on-conflict, incluida `estado`. El seeder carga el lote como
-- 'no_confirmado'; si una fila ya estaba 'confirmado' por un `--promote` previo, el
-- upsert masivo la DEGRADABA en silencio. `preserveEstado` (seed-cli) repara el
-- snapshot en memoria pero NO re-escribe la DB. La maestra en git es la fuente
-- autoritativa (ID-09) y se auto-cura al próximo `--promote`, pero esa divergencia
-- transitoria es evitable y peligrosa en un subsistema de identidad.
--
-- DISEÑO — coerción silenciosa, NO RAISE (a diferencia de vinculo_identidad/0007):
-- el upsert de la maestra es MASIVO y reescribe a TODOS como 'no_confirmado' en cada
-- corrida; un trigger que lanzara abortaría el lote entero. Aquí, si la fila YA era
-- 'confirmado' y el UPDATE intenta degradarla, se PRESERVA 'confirmado' y el lote
-- continúa. La promoción a 'confirmado' (promoteToConfirmado) y cualquier cambio
-- sobre filas no-confirmadas pasan intactos.
--
-- `set search_path = ''`: la función solo referencia OLD/NEW y literales (sin objetos
-- shadowables), así que es seguro y consistente con la postura del proyecto (#38).

create function parlamentario_estado_no_regresa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'confirmado' and new.estado <> 'confirmado' then
    -- Preserva la confirmación previa: el upsert masivo no degrada una identidad
    -- ya confirmada. Silencioso para no abortar el lote del seeder.
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

create trigger parlamentario_estado_no_regresa
  before update on parlamentario
  for each row
  execute function parlamentario_estado_no_regresa();
