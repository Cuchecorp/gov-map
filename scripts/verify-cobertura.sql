-- verify-cobertura.sql — conteos de cobertura del corpus de búsqueda (BUSQ-01/03).
--
-- Verifica la igualdad de counts (proyecto == proyecto_ficha == proyecto_embedding) o
-- reporta la diferencia POR CAUSA (estado/version/idea). Es la fuente única de verdad de
-- cobertura compartida por: la verificación manual del backfill (P03) y la señal de freshness.
--
-- Uso (operador, LOCAL, read-only):
--   psql "$SUPABASE_DB_URL" -At -f scripts/verify-cobertura.sql
--
-- Interpretación:
--   * proyecto        = universo total de proyectos ingeridos (techo del corpus actual).
--   * proyecto_ficha  = proyectos con fila de ficha (visibles al pipeline). Tras el seed
--                       idempotente debe IGUALAR a proyecto (gap BUSQ-01 cerrado).
--   * proyecto_embedding = proyectos indexados para /buscar (HNSW cosine 768). Es el N real
--                       que ve el usuario. La brecha vs proyecto = techo honesto (RUT/PDF/etc).
--   * sin_ficha       = proyectos SIN fila ficha (los invisibles al pipeline; debe ser 0 tras seed).
--   * por estado      = cobertura del pipeline (pendiente/procesando/embebido/error).
--   * con idea_matriz = techo honesto de "ideas" (< embebido: 8 RUT-bloqueados + 1 PDF + 5 sin idea).
--   * por version     = detecta embeddings 'v1' stale (title-only) que --reembed debe recuperar.

-- 1) Universo total de proyectos.
select 'proyecto' as tabla, count(*) as total from proyecto;

-- 2) Proyectos con fila de ficha (deben igualar a proyecto tras el seed).
select 'proyecto_ficha' as tabla, count(*) as total from proyecto_ficha;

-- 3) Proyectos indexados (N real de /buscar).
select 'proyecto_embedding' as tabla, count(*) as total from proyecto_embedding;

-- 4) Proyectos SIN fila ficha (gap BUSQ-01; debe ser 0 tras seedFichasPendientes).
select 'sin_ficha' as tabla, count(*) as total
from proyecto p
left join proyecto_ficha f on f.boletin = p.boletin
where f.boletin is null;

-- 5) Cobertura por estado del pipeline (embebido / error / pendiente / procesando).
select estado, count(*) as total from proyecto_ficha group by estado order by estado;

-- 6) Fichas con idea_matriz real (techo honesto de "ideas").
select 'con_idea_matriz' as tabla, count(*) as total
from proyecto_ficha
where idea_matriz is not null and idea_matriz <> '';

-- 7) Embeddings por versión (detecta 'v1' stale title-only que --reembed debe recuperar).
select embedding_version, count(*) as total
from proyecto_embedding
group by embedding_version
order by embedding_version;
