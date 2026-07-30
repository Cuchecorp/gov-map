#!/usr/bin/env bash
# check-escalera-doc.sh — gate re-ejecutable de completitud de 121-ESCALERA-ESTADO.md
#
# Uso:
#   bash .planning/phases/121-escalera-doc-extension-solo-con-benchmark/check-escalera-doc.sh
#
# Régimen: corre TODAS las comprobaciones y las reporta juntas. `set -u` a secas,
# SIN `set -e` ni `pipefail`: con -e la primera falta abortaría y el operador vería un
# solo problema por corrida en vez del cuadro completo. Acumulador FAILS + exit 1 al final.
#
# Portabilidad: bash + POSIX grep/awk. NO usa `grep -P` (no disponible en este entorno).
# Locale: se fuerza LC_ALL=C y NINGÚN patrón usa clases de caracteres con acentos —
# `[eé]` en una bracket-expression multibyte NO casa bajo locale C (é son 2 bytes) y
# daría un falso FAIL. Donde hace falta una vocal acentuada se usa `.\{1,2\}`.
#
# Read-only sobre el repo: no escribe nada dentro del árbol de trabajo, no toca DB ni red.
# Los únicos temporales son los dos fixtures del self-check anti-secreto, que viven FUERA
# del repo (scratchpad / TMPDIR) y se borran con trap EXIT.
#
# HIGIENE DEL PROPIO GATE (lección de check-crons.sh, Phase 118): este script contiene en su
# código los mismos patrones de secreto que busca. Por eso TODAS las comprobaciones se aplican
# al ARTEFACTO (121-ESCALERA-ESTADO.md), y check-escalera-doc.sh JAMÁS aparece en ninguna
# lista de archivos escaneados.

set -u
export LC_ALL=C

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

DOC="$SCRIPT_DIR/121-ESCALERA-ESTADO.md"

FAILS=0

pass() { echo "PASS $1"; }
fail() { FAILS=$((FAILS + 1)); echo "FAIL $1"; }

echo "=== check-escalera-doc.sh — gate de 121-ESCALERA-ESTADO.md"
echo "repo: $REPO_ROOT"
echo

# ---------------------------------------------------------------------------
# C1 — el artefacto existe.
# ---------------------------------------------------------------------------
echo "--- C1 · el documento existe"
if [ -f "$DOC" ]; then
  pass "C1 121-ESCALERA-ESTADO.md presente"
else
  fail "C1 121-ESCALERA-ESTADO.md AUSENTE ($DOC)"
  echo
  echo "=== RESULTADO: $FAILS falta(s) — sin documento no hay nada más que comprobar"
  exit 1
fi
echo

# Región de la tabla maestra. Se extrae UNA vez y se reutiliza para que ningún conteo de
# estados se contamine con el glosario de "Cómo leer los estados" (que enumera los tres
# valores en prosa) ni con las secciones por tarea. FILTRO DECLARADO: todo conteo de
# estados mide CELDAS de la tabla maestra, nunca menciones en prosa.
REG_MAESTRA=$(awk '/^## Tabla maestra/,/^## C.*mo leer los estados/' "$DOC")

# ---------------------------------------------------------------------------
# C2 — las 5 tareas LLM están nombradas en la tabla maestra.
# (patrones sin acentos: 'clasificaci', 'extracci', 'adjudicaci')
# ---------------------------------------------------------------------------
echo "--- C2 · las 5 tareas LLM están nombradas"
for t in routing clasificaci juez extracci adjudicaci; do
  if printf '%s\n' "$REG_MAESTRA" | grep -qi "$t"; then
    pass "C2 tarea presente en la tabla maestra: $t"
  else
    fail "C2 tarea AUSENTE de la tabla maestra: $t"
  fi
done
echo

# ---------------------------------------------------------------------------
# C3 — cada tarea tiene estado explícito del vocabulario CERRADO.
# Reparto esperado: 1 EXTENDIDA + 3 NO EXTENDIDA + 1 INTOCABLE = 5 filas de tarea.
# El patrón exige el estado SOLO en su celda (sin adornos): '| ESTADO |'.
# ---------------------------------------------------------------------------
echo "--- C3 · estado explícito por tarea (vocabulario cerrado, celdas de la tabla maestra)"
EX=$(printf '%s\n' "$REG_MAESTRA" | grep -c '^|.*| *EXTENDIDA *|')
NE=$(printf '%s\n' "$REG_MAESTRA" | grep -c '^|.*| *NO EXTENDIDA *|')
IN=$(printf '%s\n' "$REG_MAESTRA" | grep -c '^|.*| *INTOCABLE *|')
TOT=$((EX + NE + IN))
echo "C3 celdas de estado -> EXTENDIDA=$EX · NO EXTENDIDA=$NE · INTOCABLE=$IN · total=$TOT"
[ "$EX" -eq 1 ] && pass "C3 exactamente 1 celda EXTENDIDA" || fail "C3 se esperaba 1 celda EXTENDIDA, hay $EX"
[ "$NE" -eq 3 ] && pass "C3 exactamente 3 celdas NO EXTENDIDA" || fail "C3 se esperaban 3 celdas NO EXTENDIDA, hay $NE"
[ "$IN" -eq 1 ] && pass "C3 exactamente 1 celda INTOCABLE" || fail "C3 se esperaba 1 celda INTOCABLE, hay $IN"
[ "$TOT" -eq 5 ] && pass "C3 la tabla maestra tiene 5 filas de tarea con estado" || fail "C3 la tabla maestra tiene $TOT filas de tarea con estado (se esperaban 5)"
# Los tres valores del vocabulario deben además estar DEFINIDOS en el glosario.
if grep -q '^## C.*mo leer los estados' "$DOC"; then
  pass "C3 existe la sección 'Cómo leer los estados'"
else
  fail "C3 no existe la sección 'Cómo leer los estados'"
fi
echo

# ---------------------------------------------------------------------------
# C4 — cada estado lleva ≥1 cita verificable.
# ---------------------------------------------------------------------------
echo "--- C4 · citas verificables"
for cita in "107-VEREDICTO-LIVE-FULL-2026-07-27" "be0b1b9" "120-FLIP-RECORD"; do
  N=$(grep -c "$cita" "$DOC")
  if [ "$N" -ge 1 ]; then
    pass "C4 cita presente ($N ocurrencia(s)): $cita"
  else
    fail "C4 cita AUSENTE: $cita"
  fi
done
# La adjudicación no cita métricas: su justificante es la decisión de diseño SEED-001.
if grep -q "SEED-001" "$DOC"; then
  pass "C4 la adjudicación referencia SEED-001 (decisión de diseño, no métrica)"
else
  fail "C4 falta la referencia SEED-001 para la adjudicación"
fi
# Cada fila de la tabla maestra debe citar un archivo de origen O declarar la decisión.
SIN_CITA=$(printf '%s\n' "$REG_MAESTRA" \
  | grep -E '^\|.*\| *(EXTENDIDA|NO EXTENDIDA|INTOCABLE) *\|' \
  | grep -vc '107-VEREDICTO-LIVE-FULL-2026-07-27\|120-FLIP-RECORD\|SEED-001')
if [ "$SIN_CITA" -eq 0 ]; then
  pass "C4 las 5 filas de la tabla maestra citan una fuente"
else
  fail "C4 hay $SIN_CITA fila(s) de la tabla maestra sin cita a una fuente"
fi
echo

# ---------------------------------------------------------------------------
# C5 — subparte "qué evidencia … extendería" para las 4 pendientes + el N/A de adjudicación.
# `qu.\{1,2\} evidencia` es deliberadamente locale-independiente (ver cabecera).
# ---------------------------------------------------------------------------
echo "--- C5 · subparte 'qué evidencia … la extendería'"
N_QE=$(grep -ci 'qu.\{1,2\} evidencia' "$DOC")
echo "C5 ocurrencias de 'qué evidencia'=$N_QE (mínimo 5)"
if [ "$N_QE" -ge 5 ]; then
  pass "C5 las 5 tareas declaran qué evidencia las extendería"
else
  fail "C5 sólo $N_QE tarea(s) declaran qué evidencia las extendería (mínimo 5)"
fi
if grep -q 'N/A por dise' "$DOC"; then
  pass "C5 adjudicación responde N/A por diseño (presencia, no omisión)"
else
  fail "C5 falta el 'N/A por diseño' de la adjudicación"
fi
echo

# ---------------------------------------------------------------------------
# C6 — ANTI-SECRETO. Se aplica al ARTEFACTO, jamás a este script.
#
# Dos ramas independientes:
#   (a) asignación de credencial con valor -> NOMBRE_CON_TOKEN|KEY|SECRET|PASSWORD|ACCOUNT_ID = algo
#   (b) blob suelto que parece credencial -> hex >=32 o base64ish >=40 sin '=' delante
#
# Excepción declarada y ÚNICA: `CLASIFICACION_ESCALERA=1` (nombre de flag interno + literal 1,
# no es un secreto). Se filtra ANTES de evaluar la rama (a) — un `grep -c` desnudo con `== 0`
# como gate está prohibido por el régimen del proyecto: todo gate de ausencia filtra y declara.
# ---------------------------------------------------------------------------
PAT_ASSIGN='[A-Z0-9_]*(TOKEN|KEY|SECRET|PASSWORD|ACCOUNT_ID)[A-Z0-9_]*=[^[:space:]`"'"'"'|]'
PAT_BLOB='[0-9a-fA-F]{32,}|[A-Za-z0-9+/]{40,}'
# Placeholders redactados admitidos como valor: *** , <ALGO> , ${ALGO}
PAT_REDACTED='=(\*\*\*|<[A-Za-z_]|\$\{)'

detectar_secretos() {
  # $1 = archivo. Imprime las líneas sospechosas (vacío = limpio).
  grep -nE "$PAT_ASSIGN" "$1" \
    | grep -v 'CLASIFICACION_ESCALERA=1' \
    | grep -vE "$PAT_REDACTED"
  grep -nE "$PAT_BLOB" "$1"
}

echo "--- C6 · anti-secreto (sobre el artefacto, jamás sobre este script)"
HALLAZGOS=$(detectar_secretos "$DOC")
N_HALL=$(printf '%s' "$HALLAZGOS" | grep -c . )
echo "C6 filtro aplicado: se excluye 'CLASIFICACION_ESCALERA=1' y los placeholders redactados (*** / <X> / \${X})"
if [ "$N_HALL" -eq 0 ]; then
  pass "C6 cero patrones de secreto en 121-ESCALERA-ESTADO.md"
else
  fail "C6 $N_HALL línea(s) sospechosa(s) en 121-ESCALERA-ESTADO.md (números de línea abajo)"
  printf '%s\n' "$HALLAZGOS" | cut -d: -f1 | sed 's/^/      línea /'
fi
echo

# ---------------------------------------------------------------------------
# C7 — SELF-CHECK: probar que el detector MUERDE.
# Un detector que no muerde es peor que ninguno: da falsa confianza.
# DOS fixtures, porque son DOS ramas distintas del detector.
# Los valores son claramente FALSOS e INVENTADOS. Jamás se copia un valor real de .env.
# Los temporales viven FUERA del repo (para que un fallo a medias no deje un archivo con
# pinta de secreto en el árbol de trabajo) y se borran con trap EXIT.
# ---------------------------------------------------------------------------
echo "--- C7 · self-check anti-secreto (dos fixtures inventados, fuera del repo)"
TMP_BASE=${GSD_SCRATCHPAD:-${TMPDIR:-/tmp}}
TMP_A=$(mktemp "$TMP_BASE/escalera-selfcheck-a-XXXXXX") || TMP_A="$TMP_BASE/escalera-selfcheck-a.$$"
TMP_B=$(mktemp "$TMP_BASE/escalera-selfcheck-b-XXXXXX") || TMP_B="$TMP_BASE/escalera-selfcheck-b.$$"
trap 'rm -f "$TMP_A" "$TMP_B"' EXIT

# Fixture A — rama (a): asignación de credencial con valor falso.
{
  echo "texto inocuo antes"
  echo "WORKERS_AI_API_TOKEN=valor-falso-inventado-para-el-self-check"
  echo "texto inocuo despues"
} > "$TMP_A"

# Fixture B — rama (b): blob hex suelto de 40 caracteres, SIN '=' delante.
{
  echo "salida transcrita de ejemplo:"
  echo "  deadbeefcafe0123456789abcdef0123456789ab"
} > "$TMP_B"

A_HITS=$(detectar_secretos "$TMP_A" | grep -c . )
B_HITS=$(detectar_secretos "$TMP_B" | grep -c . )
echo "C7 fixture A (asignación con valor): hits=$A_HITS · fixture B (blob hex suelto): hits=$B_HITS"
if [ "$A_HITS" -ge 1 ]; then
  pass "C7 el detector MUERDE la rama de asignación con valor"
else
  fail "C7 el detector NO mordió el fixture A — la rama de asignación está ciega"
fi
if [ "$B_HITS" -ge 1 ]; then
  pass "C7 el detector MUERDE la rama de blob que parece credencial"
else
  fail "C7 el detector NO mordió el fixture B — la rama de blob está ciega"
fi
# Control negativo: el filtro de la excepción no debe abrir un agujero general.
CTRL="$TMP_B.ctrl"
printf 'CLASIFICACION_ESCALERA=1\nOTRO_API_TOKEN=valor-falso-2\n' > "$CTRL"
CTRL_HITS=$(detectar_secretos "$CTRL" | grep -c . )
rm -f "$CTRL"
if [ "$CTRL_HITS" -eq 1 ]; then
  pass "C7 la excepción CLASIFICACION_ESCALERA=1 no abre agujero (control: 1 hit, el otro token)"
else
  fail "C7 control negativo dio $CTRL_HITS hits (se esperaba exactamente 1)"
fi
echo

# ---------------------------------------------------------------------------
echo "=== RESULTADO: $FAILS falta(s)"
if [ "$FAILS" -gt 0 ]; then
  echo "=== GATE ROJO"
  exit 1
fi
echo "=== GATE VERDE"
exit 0
