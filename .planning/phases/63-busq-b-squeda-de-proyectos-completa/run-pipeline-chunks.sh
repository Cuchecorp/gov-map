#!/usr/bin/env bash
# run-pipeline-chunks — driver LOCAL del pipeline de fichas+embeddings por lotes (Task 4 del
# plan 63-03). Corre `pipeline-cli.ts` sobre los proyecto_ficha estado='pendiente' en lotes
# REANUDABLES hasta agotar la cola, y luego la pasada `--reembed` que recupera los 8 v1 stale.
#
# POR QUÉ --boletines EXPLÍCITO (no la auto-detección de pendientes):
#   `leerPendientes()` sin --boletines lee TODOS los pendientes en UNA query PostgREST (tope
#   ~1000 filas) y resuelve el link del Senado por CADA uno (re-fetch XML, rate-limit 2-3s)
#   ANTES de que `--limite N` recorte. Con 3.583 pendientes, un `--limite 100` resolvería ~1000
#   links (~50 min) para procesar 100 → derroche masivo. En cambio, este driver CONSULTA los N
#   boletines pendientes vía psql y los pasa como --boletines: el CLI resuelve links SOLO para
#   ese lote. La ruta --boletines ignora el filtro estado, pero la lista viene de psql filtrada
#   por estado='pendiente', así que solo se procesan pendientes (los 'embebido'/'error' quedan).
#
# REANUDABLE: cada boletín procesado pasa a 'embebido' (o 'error' si falla) → la próxima query
#   psql ya no lo devuelve. Re-correr el driver continúa donde quedó. Los 'error' (8 RUT-bloqueados
#   permanentes + PDF escaneado + schema-fail) NO se reintentan: leerPendientes solo lee 'pendiente'
#   y aquí solo pasamos boletines con estado='pendiente'.
#
# TECHO HONESTO: RUT-bloqueados NUNCA van al LLM (assertNoRutInLlmInput LOCKED); quedan estado='error'
#   y este driver no los toca (no aparecen en la query 'pendiente').
#
# Uso (LOCAL, operador): bash run-pipeline-chunks.sh
#   Env: exporta .env (SUPABASE_*, DEEPSEEK_API_KEY, GEMINI_API_KEY, R2_*) antes de correr.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$DIR/logs"
LOG="$LOGS/pipeline.log"
mkdir -p "$LOGS"

cd "$ROOT" || exit 1

# Carga .env al entorno (los CLIs leen process.env directo; tsx NO auto-carga .env).
set -a
# shellcheck disable=SC1091
. "$ROOT/.env"
set +a
export PGCLIENTENCODING=UTF8

BATCH=100          # lote por iteración (instrucción Task 4)
MAX_ITERS=45       # tope de seguridad: nunca loop infinito
STALL_LIMIT=3      # 3 conteos 'pendiente' iguales consecutivos = sin progreso → abortar

pend() {
  # count actual de proyecto_ficha estado='pendiente' (fuente de avance).
  psql "$SUPABASE_DB_URL" -tAc "select count(*) from proyecto_ficha where estado='pendiente';" 2>>"$LOG" | tr -d '[:space:]'
}

log() { echo "$*" | tee -a "$LOG"; }

log "=== pipeline-chunks START $(date -u +%Y-%m-%dT%H:%M:%SZ) (batch=$BATCH max_iters=$MAX_ITERS) ==="
START_PEND="$(pend)"
log "pendientes iniciales: $START_PEND"

prev_pend=""
stall=0
iter=0
while :; do
  iter=$((iter + 1))
  if [ "$iter" -gt "$MAX_ITERS" ]; then
    log "=== pipeline-chunks CAPPED (alcanzó MAX_ITERS=$MAX_ITERS, pendientes=$(pend)) $(date -u +%H:%M:%S) ==="
    break
  fi

  remaining="$(pend)"
  if [ -z "$remaining" ]; then
    log "ITER $iter: psql no devolvió conteo (¿DB caída?) → reintento en la próxima iteración"
    sleep 5
    continue
  fi
  if [ "$remaining" -eq 0 ]; then
    log "ITER $iter: pendientes=0 → cola agotada"
    break
  fi

  # Stall-detection: mismo conteo 3 veces seguidas = ningún boletín avanzó (todos re-fallan).
  if [ "$remaining" = "$prev_pend" ]; then
    stall=$((stall + 1))
  else
    stall=0
  fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    log "=== pipeline-chunks STALLED (pendientes=$remaining sin avance en $STALL_LIMIT iteraciones) $(date -u +%H:%M:%S) ==="
    break
  fi
  prev_pend="$remaining"

  # Lista explícita de los próximos BATCH pendientes (orden estable por boletín).
  list=$(psql "$SUPABASE_DB_URL" -tAc \
    "select boletin from proyecto_ficha where estado='pendiente' order by boletin limit $BATCH;" \
    2>>"$LOG" | paste -sd, -)
  if [ -z "$list" ]; then
    log "ITER $iter: sin lista de pendientes (conteo=$remaining) → reintento"
    sleep 5
    continue
  fi
  n=$(echo "$list" | tr ',' '\n' | grep -cE '^[0-9]')

  log "--- ITER $iter/$MAX_ITERS: procesando $n boletines (pendientes restantes: $remaining) $(date -u +%H:%M:%S) ---"
  batch_out="$LOGS/pipeline-iter-$(printf '%02d' "$iter").log"
  pnpm --filter @obs/fichas exec tsx src/pipeline-cli.ts \
    --boletines "$list" --limite "$n" >"$batch_out" 2>&1
  rc=$?

  proc=$(grep -oE 'procesados=[0-9]+' "$batch_out" | tail -1 | cut -d= -f2)
  emb=$(grep -oE 'embebidos=[0-9]+' "$batch_out" | tail -1 | cut -d= -f2)
  degr=$(grep -oE 'degradados=[0-9]+' "$batch_out" | tail -1 | cut -d= -f2)
  errs=$(grep -oE 'errores=[0-9]+' "$batch_out" | tail -1 | cut -d= -f2)
  after="$(pend)"
  log "  ITER $iter exit=$rc procesados=${proc:-?} embebidos=${emb:-?} degradados=${degr:-?} errores=${errs:-?} | pendientes ahora: $after"
done

# ── Pasada de reembed: recupera los 8 v1 stale (title-only) + cualquier stale (Task 4) ──────────
log "--- REEMBED (recupera v1 stale) $(date -u +%H:%M:%S) ---"
reembed_out="$LOGS/pipeline-reembed.log"
pnpm --filter @obs/fichas exec tsx src/pipeline-cli.ts --reembed >"$reembed_out" 2>&1
rc=$?
remb=$(grep -oE 'embebidos=[0-9]+' "$reembed_out" | tail -1 | cut -d= -f2)
log "  REEMBED exit=$rc embebidos=${remb:-?} (detalle: $reembed_out)"

# ── Conteos finales ─────────────────────────────────────────────────────────────────────────────
log "--- CONTEOS FINALES $(date -u +%H:%M:%S) ---"
psql "$SUPABASE_DB_URL" -tAc \
  "select 'proyecto', count(*) from proyecto
   union all select 'proyecto_ficha', count(*) from proyecto_ficha
   union all select 'proyecto_embedding', count(*) from proyecto_embedding
   union all select 'pendiente', count(*) from proyecto_ficha where estado='pendiente'
   union all select 'embebido', count(*) from proyecto_ficha where estado='embebido'
   union all select 'error', count(*) from proyecto_ficha where estado='error'
   union all select 'con_idea', count(*) from proyecto_ficha where idea_matriz is not null and idea_matriz <> '';" \
  2>>"$LOG" | tee -a "$LOG"
log "--- versiones de embedding ---"
psql "$SUPABASE_DB_URL" -tAc \
  "select embedding_version, count(*) from proyecto_embedding group by 1 order by 1;" \
  2>>"$LOG" | tee -a "$LOG"

log "=== pipeline-chunks DONE $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
