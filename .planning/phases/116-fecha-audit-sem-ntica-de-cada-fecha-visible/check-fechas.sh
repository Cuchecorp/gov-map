#!/usr/bin/env bash
# check-fechas.sh — checklist re-ejecutable de completitud del artefacto 116-FECHAS-AUDIT.md
#
# Uso:
#   bash .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh
#   STRICT=1 bash .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh
#
# Régimen de STRICT:
#   STRICT=0 (default) — reporta faltas SIN fallar (exit 0 siempre). Modo reporte.
#   STRICT=1           — cualquier falta => exit 1. Es el modo del cierre de fase.
#
# Portabilidad: bash + POSIX grep/awk. NO usa la opción PCRE de grep (no disponible aquí).
# Read-only: no escribe nada, no toca la DB, no toca la red. Corre en segundos.
#
# El denominador de ids NO está hardcodeado: se deriva de 113-INVENTARIO.md §3.0 con la
# regla de celda LOCKED (ver check 1). El número 38 es un ANCLA de sanidad, no la fuente:
# si el awk devuelve otro número el script lo REPORTA con el diff de ids. Jamás se ajusta
# el esperado para que pase.

set -u

STRICT=${STRICT:-0}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)

INV="$REPO_ROOT/.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md"
AUD="$SCRIPT_DIR/116-FECHAS-AUDIT.md"

# Ancla de sanidad del denominador derivado (ver check 1).
ESPERADO=38

cd "$REPO_ROOT" || exit 1

FALTAS=0

falta() {
  FALTAS=$((FALTAS + 1))
  echo "FALTA $1"
}

if [ ! -f "$INV" ]; then
  echo "FALTA 113-INVENTARIO.md no existe (denominador no derivable)"
  exit 1
fi
if [ ! -f "$AUD" ]; then
  echo "FALTA 116-FECHAS-AUDIT.md no existe en $SCRIPT_DIR"
  exit 1
fi

# ---------------------------------------------------------------------------
# Check 1 — denominador DERIVADO de 113-INVENTARIO.md §3.0 (no hardcodeado)
#
# Regla de celda LOCKED: una celda de "fechas que muestra" cuenta como *sin fecha*
# si su contenido, TRAS eliminar espacios, tabs y backticks, EMPIEZA por `—` (U+2014).
# Todo lo demás cuenta como *con fecha*.
#
#   - `$5` es la columna "fechas que muestra" contando el campo vacío inicial que
#     produce el `|` de apertura de la fila.
#   - `substr(c,1,3)` porque en UTF-8 el guion largo ocupa 3 bytes y el awk de este
#     entorno es byte-oriented.
#   - el id se extrae por match de patrón (`E-[0-9][0-9][0-9]`), no por recorte posicional.
#
# CUIDADO: comparar la celda por IGUALDAD contra `—` da 51 ids en vez de 38, porque las
# celdas "sin fecha" llevan backticks y paréntesis explicativos (el primer emisor del
# catálogo, p. ej., tiene `—` (el chrome no muestra fechas)). Con esa regla ingenua los
# checks 2 y 3 exigirían veredicto para 13 emisores que no muestran ninguna fecha => 13
# declaraciones falsas de "sin hallazgos", y la fase perdería su valor.
# Ver la prueba negativa completa, con los 13 falsos positivos, en §7.2 del artefacto.
# ---------------------------------------------------------------------------
derivar_ids() {
  awk -F'|' '/^\| E-/{
    c = $5
    gsub(/[ \t`]/, "", c)
    if (substr(c, 1, 3) != "—") {
      if (match($0, /E-[0-9][0-9][0-9]/)) print substr($0, RSTART, RLENGTH)
    }
  }' "$INV" | sort -u
}

IDS=$(derivar_ids)
N_IDS=$(printf '%s\n' "$IDS" | grep -c 'E-[0-9]')

if [ "$N_IDS" -eq "$ESPERADO" ]; then
  echo "OK check 1 — denominador derivado de 113-INVENTARIO §3.0 = $N_IDS (esperado $ESPERADO)"
else
  falta "check 1 — denominador $N_IDS, esperado $ESPERADO"
  echo "     ids derivados: $(printf '%s ' $IDS)"
  echo "     una desviación significa (a) que el inventario cambió — legítimo, decláralo — o"
  echo "     (b) que la regla de celda se rompió — bug, arréglalo. JAMÁS ajustar ESPERADO."
fi

# ---------------------------------------------------------------------------
# Check 2 — cobertura: cada id del denominador aparece en 116-FECHAS-AUDIT.md
# ---------------------------------------------------------------------------
faltan_cob=0
for id in $IDS; do
  if ! grep -qF -- "$id" "$AUD"; then
    faltan_cob=$((faltan_cob + 1))
    falta "check 2 — $id ausente de 116-FECHAS-AUDIT.md"
  fi
done
if [ "$faltan_cob" -eq 0 ]; then
  echo "OK check 2 — los $N_IDS ids del denominador aparecen en el artefacto"
else
  echo "-- check 2 — $faltan_cob de $N_IDS ids ausentes del artefacto"
fi

# ---------------------------------------------------------------------------
# Check 3 — veredicto declarado: cada id vive en `## 3. HALLAZGOS` o en `## 4. Cobertura`
# Cero excepciones silenciosas: estar en el documento no basta.
# ---------------------------------------------------------------------------
SEC34=$(awk '/^## 3\. HALLAZGOS/{ok=1} /^## 5\. Trazabilidad/{ok=0} ok' "$AUD")

faltan_ver=0
for id in $IDS; do
  if ! printf '%s\n' "$SEC34" | grep -qF -- "$id"; then
    faltan_ver=$((faltan_ver + 1))
    falta "check 3 — $id sin veredicto: ausente de '## 3. HALLAZGOS' y de '## 4. Cobertura'"
  fi
done
if [ "$faltan_ver" -eq 0 ]; then
  echo "OK check 3 — los $N_IDS ids tienen veredicto en '## 3.' o en '## 4.'"
else
  echo "-- check 3 — $faltan_ver de $N_IDS ids sin veredicto declarado"
fi

# ---------------------------------------------------------------------------
# Check 4 — conjunto cerrado de veredictos en la tabla de `### 1.4`
# Toda celda de VEREDICTO pertenece a {hecho, captura, ambigua}.
# ---------------------------------------------------------------------------
FUERA=$(awk -F'|' '
  /^### 1\.4 /{ok=1}
  /^## 2\. Cruce/{ok=0}
  ok && /^\| E-/{
    v = $7
    gsub(/[ *]/, "", v)
    if (v != "hecho" && v != "captura" && v != "ambigua") print v
  }' "$AUD" | sort -u)

N_VER=$(awk '/^### 1\.4 /{ok=1} /^## 2\. Cruce/{ok=0} ok && /^\| E-/{n++} END{print n+0}' "$AUD")

if [ -z "$FUERA" ]; then
  echo "OK check 4 — las $N_VER celdas de VEREDICTO de '### 1.4' están en {hecho, captura, ambigua}"
else
  falta "check 4 — veredictos fuera del conjunto cerrado: $(printf '%s ' $FUERA)"
fi

# ---------------------------------------------------------------------------
# Check 5 — higiene del artefacto
# ---------------------------------------------------------------------------
n_creds=$(grep -cE 'postgres(ql)?://' "$AUD")
n_rut=$(grep -cE '[0-9]{7,8}-[0-9kK]' "$AUD")
n_tbd=$(grep -cE 'TBD|TODO|FIXME' "$AUD")
# Celdas vacías: filas de tabla con dos `|` consecutivos (permitiendo espacios),
# excluyendo las filas separadoras (`|---|---|`).
n_vacias=$(grep -nE '^\|.*\|[[:space:]]*\|' "$AUD" | grep -vE '\|[[:space:]]*:?-+:?[[:space:]]*\|' | grep -c . )

hig=0
[ "$n_creds" -ne 0 ] && { falta "check 5 — $n_creds credencial(es) postgres:// en el artefacto"; hig=1; }
[ "$n_rut" -ne 0 ]   && { falta "check 5 — $n_rut posible(s) RUT en el artefacto"; hig=1; }
[ "$n_tbd" -ne 0 ]   && { falta "check 5 — $n_tbd marcador(es) de trabajo pendiente"; hig=1; }
[ "$n_vacias" -ne 0 ] && { falta "check 5 — $n_vacias fila(s) de tabla con celda vacía"; hig=1; }
if [ "$hig" -eq 0 ]; then
  echo "OK check 5 — higiene: 0 credenciales, 0 RUT, 0 marcadores pendientes, 0 celdas vacías"
fi

# ---------------------------------------------------------------------------
# Check 6 — régimen solo-lectura: la fase no toca código de producto
# ---------------------------------------------------------------------------
DIRTY=$(git status --porcelain app/ packages/ 2>/dev/null)
if [ -z "$DIRTY" ]; then
  echo "OK check 6 — régimen solo-lectura: git status --porcelain app/ packages/ vacío"
else
  falta "check 6 — código de producto modificado:"
  printf '%s\n' "$DIRTY" | sed 's/^/       /'
fi

# ---------------------------------------------------------------------------
echo "---"
if [ "$FALTAS" -eq 0 ]; then
  echo "RESULTADO: sin faltas (STRICT=$STRICT)"
  exit 0
else
  echo "RESULTADO: $FALTAS falta(s)"
  [ "$STRICT" = "1" ] && exit 1
  exit 0
fi
