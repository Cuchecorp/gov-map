#!/usr/bin/env bash
# run-backfill-chunks — driver LOCAL del backfill de tramitación por chunks (Rule 3 fix del plan
# 63-03: la línea de comandos de Windows tiene tope ~32KB, y los años completos (682-890 boletines)
# lo exceden como un solo --boletines CSV). Divide en chunks de 250 (bajo el tope, tamaño probado
# con el batch 2026 de 311) y los corre EN SERIE. Reanudable: la Etapa-1 R2 es content-addressed
# (skip idempotente) y el upsert es idempotente — re-correr saltea lo ya en R2.
#
# Uso (LOCAL, operador): bash run-backfill-chunks.sh <year1> [year2 ...]
#   PGCLIENTENCODING=UTF8 bash .planning/phases/63-*/run-backfill-chunks.sh 2025 2024 2023 2022
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOL="$DIR/boletines-historico"
LOGS="$DIR/logs"
mkdir -p "$LOGS"

cd "$ROOT" || exit 1
export PGCLIENTENCODING=UTF8

for y in "$@"; do
  for chunk in "$BOL"/_chunk_${y}_*.txt; do
    [ -f "$chunk" ] || continue
    name="$(basename "$chunk" .txt)"
    n=$(grep -cE '^[0-9]' "$chunk")
    list=$(paste -sd, "$chunk")
    echo "=== $name ($n boletines) $(date -u +%H:%M:%S) ==="
    pnpm --filter @obs/tramitacion exec tsx src/run-tramitacion-prod-cli.ts \
      --boletines "$list" --limite "$n" >> "$LOGS/ingesta-$y.log" 2>&1
    echo "  $name exit=$? R2writes=$(grep -c 'crudo en R2' "$LOGS/ingesta-$y.log") errors=$(grep -c 'ERROR' "$LOGS/ingesta-$y.log")"
  done
done
echo "=== backfill-chunks DONE $(date -u +%H:%M:%S) ==="
