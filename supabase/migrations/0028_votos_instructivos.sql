-- 0028_votos_instructivos.sql
-- Extiende el RPC `votos_de_parlamentario` (Phase 22, votaciones instructivas) para que
-- cada fila confirmada traiga su SUSTANCIA (título del proyecto + idea matriz) y su
-- DESENLACE (resultado/totales/quórum de la votación) — sin N+1 joins en el server
-- component. Habilita SC1 (sustancia por voto), SC2 (desenlace por votación) y SC4
-- (agrupar por proyecto) a nivel de datos.
--
-- ADITIVO, SIN PII (mismo gate LEGAL-03 que 0019/0020/0026):
--   * El RPC sigue siendo `security INVOKER` (language sql stable, default): toca SOLO
--     tablas público-read — `voto`, `votacion`, `proyecto`, `proyecto_ficha`. NO escala
--     privilegios, NO lee `parlamentario` (partido/rut/email siguen deny-by-default).
--   * La FIRMA DE PARÁMETROS no cambia: votos_de_parlamentario(text, int, int).
--     Solo CRECE el `returns table` con 8 columnas nuevas (titulo, idea_matriz,
--     resultado, total_si, total_no, total_abstencion, total_pareo, quorum), después de
--     las 9 existentes y en el mismo orden.
--   * NINGUNA `create policy` ni `grant select` sobre `parlamentario`; NO se toca
--     `rebeldias_de_parlamentario`; NUNCA se emite partido/rut/email.
--
-- LEFT JOIN (no INNER) a `proyecto` y `proyecto_ficha`: un proyecto sin idea matriz
-- (17/74 hoy) devuelve `idea_matriz` NULL pero NUNCA descarta la fila del voto
-- (honest-state aguas arriba; NUNCA fabricar). El WHERE conserva
-- `estado_vinculo = 'confirmado'` (solo filas confirmadas).
--
-- Cambiar el `returns table` exige DROP + recreate (no basta `create or replace`).
--
-- La APLICACIÓN del DDL + la corrida pgTAP NO se hacen aquí: son un checkpoint de
-- OPERADOR (Task 3). build/typecheck NO prueban que Postgres ejecutó la migración
-- (los tipos vienen del config generado, no de la DB viva → riesgo de falso positivo,
-- ver schema_push_requirement de 22-CONTEXT). Pasar `--db-url` explícito (BOM en .env).

-- Cambiar el returns table requiere drop previo (la firma de parámetros se conserva).
drop function if exists votos_de_parlamentario(text, int, int);

-- ── RPC votos_de_parlamentario extendido — lista paginada con sustancia + desenlace ──
-- security INVOKER (default de `language sql`): lee solo tablas público-read; no escala.
-- Devuelve el boletín COMPLETO (con sufijo) y el enlace de la votación tal cual, porque la
-- ficha enlaza a `/proyecto/[boletin]` con ese valor. Solo filas confirmadas.
create or replace function votos_de_parlamentario(
  p_id text, p_limit int default 20, p_offset int default 0
)
returns table (
  -- columnas existentes (orden intacto)
  votacion_id text, boletin text, fecha timestamptz,
  seleccion text, etapa text, camara text,
  origen text, fecha_captura timestamptz, enlace text,
  -- columnas nuevas (sustancia + desenlace)
  titulo text, idea_matriz text,
  resultado text, total_si int, total_no int,
  total_abstencion int, total_pareo int, quorum text
)
language sql stable
as $$
  select v.votacion_id, vo.boletin, vo.fecha, v.seleccion, vo.etapa, vo.camara,
         vo.origen, vo.fecha_captura, vo.enlace,
         -- sustancia: título del proyecto + extracto de idea matriz (LEFT → null honesto)
         pr.titulo, pf.idea_matriz,
         -- desenlace: tomado de la votación ya joinada
         vo.resultado, vo.total_si, vo.total_no,
         vo.total_abstencion, vo.total_pareo, vo.quorum
  from voto v
  join votacion vo on vo.id = v.votacion_id
  -- LEFT: un proyecto sin idea matriz no descarta la fila del voto (honest-state).
  left join proyecto pr on pr.boletin = vo.boletin
  left join proyecto_ficha pf on pf.boletin = vo.boletin
  where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
  order by vo.fecha desc nulls last
  limit p_limit offset p_offset;
$$;

-- grant execute a anon sobre la firma EXACTA (sin esto el frontend no invoca el RPC).
-- NO se añade ninguna policy ni grant select sobre `parlamentario` (LEGAL-03).
grant execute on function votos_de_parlamentario(text, int, int) to anon;
