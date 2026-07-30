#!/usr/bin/env bash
# check-crons.sh — checklist re-ejecutable de completitud del artefacto 118-CRON-VERDICTS.md
#
# Uso:
#   bash .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/check-crons.sh
#   STRICT=1 bash .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/check-crons.sh
#
# Régimen de STRICT:
#   STRICT=0 (default) — reporta faltas SIN fallar (exit 0 siempre). Modo reporte.
#   STRICT=1           — cualquier falta => exit 1. Es el modo del cierre de fase.
#
# Portabilidad: bash + POSIX grep/awk. NO usa la opción PCRE de grep (no disponible aquí).
# Read-only: no escribe nada, no toca la DB, no toca la red. Corre en segundos.
#
# REGLA DE ORO (heredada de check-fechas.sh): el denominador NO está hardcodeado. Se DERIVA
# en cada corrida de `ls .github/workflows/*.yml`. El número 13 es un ANCLA de sanidad, no la
# fuente: si la derivación da otro número el script lo REPORTA con el diff explícito. Jamás se
# ajusta el esperado para que pase.
#
# HIGIENE DEL PROPIO GATE: este script contiene, en su código, los mismos patrones de secreto
# que busca (C6). Por eso TODAS las comprobaciones se aplican a los ARTEFACTOS, nunca a
# check-crons.sh mismo — que ni siquiera aparece en la lista de archivos escaneados.

set -u

STRICT=${STRICT:-0}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)

AUD="$SCRIPT_DIR/118-CRON-VERDICTS.md"
RAW="$SCRIPT_DIR/118-PROBES-RAW.md"
CHK="$SCRIPT_DIR/118-OPERATOR-CHECKPOINT.md"

# Ancla de sanidad del denominador derivado (ver C1a). Se REPORTA, jamás se ajusta.
ESPERADO=13

cd "$REPO_ROOT" || exit 1

FALTAS=0

falta() {
  FALTAS=$((FALTAS + 1))
  echo "FALTA $1"
}

for f in "$AUD" "$RAW" "$CHK"; do
  if [ ! -f "$f" ]; then
    echo "FALTA artefacto inexistente: $f"
    exit 1
  fi
done

# Regiones del documento. Se extraen una vez y se reutilizan, para que ningún conteo
# se contamine con los bloques de código del propio §7 (que citan estos mismos greps).
REG_MAESTRA=$(awk '/^### 1\.3 /,/^### 1\.4 /' "$AUD")
REG_UNIDADES=$(awk '/^## 2\. Unidades/,/^## 3\. Estado/' "$AUD")
REG_GAPS=$(awk '/^## 4\. Gaps/,/^## 5\./' "$AUD")

echo "=== check-crons.sh — gate de 118-CRON-VERDICTS.md"
echo

# ---------------------------------------------------------------------------
# C1 (SC1) — el universo está cerrado y los tres conteos cuadran.
# TODO derivado y cross-checkeado contra fuentes independientes. Nada hardcodeado.
# ---------------------------------------------------------------------------
echo "--- C1 · universo cerrado y conteos derivados"

# (a) denominador local: derivado AHORA del filesystem, contra el declarado en §1.1
DERIVADO_LOCAL=$(ls .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
DECL_LOCAL=$(grep -E '^conteo_workflows_locales: [0-9]+$' "$AUD" | head -1 | awk '{print $2}')
DECL_LOCAL=${DECL_LOCAL:-0}

echo "C1a workflows locales: derivado=$DERIVADO_LOCAL declarado=$DECL_LOCAL ancla=$ESPERADO"
if [ "$DERIVADO_LOCAL" != "$DECL_LOCAL" ]; then
  falta "C1a el conteo declarado no coincide con el derivado (derivado=$DERIVADO_LOCAL declarado=$DECL_LOCAL)"
fi
if [ "$DERIVADO_LOCAL" != "$ESPERADO" ]; then
  # NO es una falta del documento: es deriva del repo. Se REPORTA con el diff.
  echo "AVISO C1a el denominador derivado ($DERIVADO_LOCAL) difiere del ancla de sanidad ($ESPERADO)."
  echo "      El ancla NO se ajusta. Workflows presentes hoy:"
  ls .github/workflows/*.yml 2>/dev/null | sed 's/^/        /'
  echo "      Si la deriva es legítima, el audit debe RE-CORRERSE, no re-anclarse."
fi

# (b) pg_cron: declarado en §1.1, cross-checkeado contra DOS fuentes independientes —
#     las secciones ### PG- del documento y las filas de cron.job capturadas en P6.
DECL_PG=$(grep -E '^conteo_pg_cron_vivos: [0-9]+$' "$AUD" | head -1 | awk '{print $2}')
DECL_PG=${DECL_PG:-0}
SECCIONES_PG=$(grep -c '^### PG-[0-9]' "$AUD")
PROBE_PG=$(awk '/^## P6 —/,/^## P7/' "$RAW" | grep -cE '^[0-9]+\|[a-z0-9-]+\|')

echo "C1b pg_cron vivos: declarado=$DECL_PG secciones=$SECCIONES_PG probe(P6)=$PROBE_PG"
if [ "$DECL_PG" != "$SECCIONES_PG" ]; then
  falta "C1b declarado($DECL_PG) != secciones ### PG- ($SECCIONES_PG)"
fi
if [ "$DECL_PG" != "$PROBE_PG" ]; then
  # Única excepción admitida: P6a registró denegación de permisos y las cifras son heredadas.
  if grep -q '^  heredada: true' "$AUD"; then
    echo "AVISO C1b cifras de pg_cron marcadas 'heredada: true' (P6a denegó permisos) — aceptado."
  else
    falta "C1b declarado($DECL_PG) != filas de cron.job en P6 ($PROBE_PG) y el documento NO las marca heredadas"
  fi
fi

# (c) el total es la SUMA de los tres sumandos, y hay exactamente un veredicto por unidad.
DECL_PM=$(grep -E '^conteo_platform_managed: [0-9]+$' "$AUD" | head -1 | awk '{print $2}')
DECL_PM=${DECL_PM:-0}
DECL_TOTAL=$(grep -E '^conteo_total_unidades: [0-9]+$' "$AUD" | head -1 | awk '{print $2}')
DECL_TOTAL=${DECL_TOTAL:-0}
SUMA=$((DECL_LOCAL + DECL_PM + DECL_PG))

echo "C1c total: $DECL_LOCAL + $DECL_PM + $DECL_PG = $SUMA · declarado=$DECL_TOTAL"
if [ "$SUMA" != "$DECL_TOTAL" ]; then
  falta "C1c conteo_total_unidades($DECL_TOTAL) != suma de los tres sumandos ($SUMA)"
fi

# Un veredicto por unidad, contado POR REGIÓN (no en todo el archivo): cada unidad aparece
# dos veces por diseño — una fila en la tabla maestra §1.3 y una sección en §2 — así que el
# conteo global daría 2N. Contar por región es la comprobación honesta, y además es más
# fuerte: obliga a que las dos regiones estén completas por separado.
VER_MAESTRA=$(printf '%s\n' "$REG_MAESTRA" | grep -c 'Veredicto: ')
VER_UNIDADES=$(printf '%s\n' "$REG_UNIDADES" | grep -c 'Veredicto: ')
echo "C1c veredictos: tabla maestra=$VER_MAESTRA · secciones §2=$VER_UNIDADES · unidades=$DECL_TOTAL"
if [ "$VER_MAESTRA" != "$DECL_TOTAL" ]; then
  falta "C1c la tabla maestra §1.3 tiene $VER_MAESTRA veredictos, se esperaban $DECL_TOTAL"
fi
if [ "$VER_UNIDADES" != "$DECL_TOTAL" ]; then
  falta "C1c §2 tiene $VER_UNIDADES veredictos, se esperaban $DECL_TOTAL"
fi

# Y las secciones de §2 cubren las tres familias sin hueco.
SEC_W=$(grep -c '^### W-' "$AUD")
SEC_PM=$(grep -c '^### PM-' "$AUD")
SEC_TOTAL=$((SEC_W + SEC_PM + SECCIONES_PG))
echo "C1c secciones §2: W=$SEC_W PM=$SEC_PM PG=$SECCIONES_PG total=$SEC_TOTAL"
if [ "$SEC_TOTAL" != "$DECL_TOTAL" ]; then
  falta "C1c secciones de §2 ($SEC_TOTAL) != unidades inventariadas ($DECL_TOTAL)"
fi
echo

# ---------------------------------------------------------------------------
# C2 (SC2) — evidencia OBSERVADA, no lectura de YAML.
# ---------------------------------------------------------------------------
echo "--- C2 · evidencia observada por unidad"
EVID=$(grep -c '^#### Evidencia observada' "$AUD")
echo "C2 bloques '#### Evidencia observada'=$EVID · secciones de unidad=$SEC_TOTAL"
if [ "$EVID" -lt "$SEC_TOTAL" ]; then
  falta "C2 hay $EVID bloques de evidencia para $SEC_TOTAL unidades"
fi

GH_CMDS=$(printf '%s\n' "$REG_UNIDADES" | grep -c 'gh run list\|gh workflow list\|gh secret list\|gh run view')
PSQL_CMDS=$(printf '%s\n' "$REG_UNIDADES" | grep -c 'psql ')
echo "C2 comandos citados en §2: gh=$GH_CMDS psql=$PSQL_CMDS"
if [ "$GH_CMDS" -lt 1 ]; then
  falta "C2 §2 no cita ningún comando 'gh'"
fi
if [ "$PSQL_CMDS" -lt 1 ]; then
  falta "C2 §2 no cita ningún comando 'psql'"
fi
echo

# ---------------------------------------------------------------------------
# C3 (SC3) — los gaps apuntan a archivo:línea reales, no a verbos genéricos.
# ---------------------------------------------------------------------------
echo "--- C3 · punteros archivo:línea en los gaps"
PUNTEROS=$(grep -cE 'G[0-9]+.*\.(ts|yml|sql):[0-9]+' "$AUD")
echo "C3 punteros=$PUNTEROS (mínimo 10)"
if [ "$PUNTEROS" -lt 10 ]; then
  falta "C3 sólo $PUNTEROS punteros archivo:línea asociados a gaps (mínimo 10)"
fi
echo

# ---------------------------------------------------------------------------
# C4 (SC4) — gap-list priorizada y accionable.
# ---------------------------------------------------------------------------
echo "--- C4 · gap-list priorizada"
if ! grep -q '^## 4\. Gaps priorizados' "$AUD"; then
  falta "C4 no existe la sección '## 4. Gaps priorizados'"
fi
# La prioridad puede llevar un calificativo entre paréntesis (P2 (deuda de operador),
  # P2 (instrumentación)…): se acepta cualquier sufijo dentro de la misma celda.
FILAS_DETALLE=$(printf '%s\n' "$REG_GAPS" | grep -cE '^\| G[0-9]+ \| .* \| \*\*P[012]\*\*[^|]*\|')
SIN_PRIO=$(printf '%s\n' "$REG_GAPS" | grep -E '^\| G[0-9]+ \|' | grep -vcE 'P[012]')
echo "C4 filas de detalle con prioridad P0|P1|P2=$FILAS_DETALLE · filas sin prioridad=$SIN_PRIO"
if [ "$FILAS_DETALLE" -lt 1 ]; then
  falta "C4 la tabla de detalle no tiene ninguna fila con prioridad **P0|P1|P2**"
fi
if [ "$SIN_PRIO" -gt 0 ]; then
  falta "C4 hay $SIN_PRIO filas de gap sin prioridad asignada"
fi
# La última columna (fix propuesto) no puede estar vacía: se exige que cada fila de detalle
# cite la fase que la ejecuta o un paso numerado.
SIN_FIX=$(printf '%s\n' "$REG_GAPS" | grep -E '^\| G[0-9]+ \| .* \| \*\*P[012]\*\*[^|]*\|' | grep -vc '1)\|Acto de operador\|No se cierra por inferencia')
if [ "$SIN_FIX" -gt 0 ]; then
  falta "C4 hay $SIN_FIX filas de detalle sin pasos concretos en la columna de fix"
fi
# Estados esperados separados de los gaps.
if ! grep -q '^### 4.1 Estados esperados' "$AUD"; then
  falta "C4 no existe '### 4.1 Estados esperados — NO son gaps'"
fi
# §5 y §6 presentes, con sus mínimos.
FILAS_A_OQ=$(awk '/^## 5\./,/^## 6\./' "$AUD" | grep -cE '^\| (A[1-5]|OQ[1-4]) \|')
echo "C4 filas de §5 (A1-A5 + OQ1-OQ4)=$FILAS_A_OQ (mínimo 9)"
if [ "$FILAS_A_OQ" -lt 9 ]; then
  falta "C4 §5 cubre $FILAS_A_OQ de las 9 asunciones/preguntas del RESEARCH"
fi
LIMITES=$(awk '/^## 6\. Límites/,/^## 7\./' "$AUD" | grep -cE '^[0-9]+\. ')
echo "C4 límites numerados=$LIMITES (mínimo 5)"
if [ "$LIMITES" -lt 5 ]; then
  falta "C4 §6 tiene $LIMITES límites numerados (mínimo 5)"
fi
echo

# ---------------------------------------------------------------------------
# C5 — el audit es reproducible: cada unidad dice cómo re-verificarse.
# ---------------------------------------------------------------------------
echo "--- C5 · reproducibilidad"
REVERIF=$(grep -c '^#### Cómo re-verificar' "$AUD")
echo "C5 bloques '#### Cómo re-verificar'=$REVERIF · unidades=$DECL_TOTAL"
if [ "$REVERIF" -lt "$DECL_TOTAL" ]; then
  falta "C5 hay $REVERIF bloques de re-verificación para $DECL_TOTAL unidades"
fi
echo

# ---------------------------------------------------------------------------
# C6 — ANTI-SECRETO. Obligatorio. Se aplica a los TRES artefactos y NUNCA a este script.
# El patrón cubre tokens OpenAI/GitHub (sk/ghp/gho), JWT (eyJ), las keys Supabase
# sb_secret_ / sb_publishable_ y los tokens hex de 40. Más las URL de base de datos.
# ---------------------------------------------------------------------------
echo "--- C6 · anti-secreto (sobre los artefactos, jamás sobre este script)"
PAT_SECRET='(sk|ghp|gho|eyJ|sb_secret_|sb_publishable_)[-_a-z0-9]{12,}|[0-9a-f]{40}'
PAT_DBURL='postgres(ql)?://'
for f in "$AUD" "$RAW" "$CHK"; do
  b=$(basename "$f")
  N_SEC=$(grep -icE "$PAT_SECRET" "$f")
  N_URL=$(grep -icE "$PAT_DBURL" "$f")
  echo "C6 $b: patrones de secreto=$N_SEC · urls de DB=$N_URL"
  if [ "$N_SEC" -ne 0 ]; then
    falta "C6 $b contiene $N_SEC línea(s) que casan con un patrón de secreto"
  fi
  if [ "$N_URL" -ne 0 ]; then
    falta "C6 $b contiene $N_URL línea(s) con una URL de base de datos"
  fi
done
echo

# ---------------------------------------------------------------------------
# C7 — correspondencia bidireccional de ids G<n> entre §2 y §4.
# Nota: el patrón exige G pegado a dígito, así que 'PG-1' (job de pg_cron) NO casa.
# ---------------------------------------------------------------------------
echo "--- C7 · ids G<n> bidireccionales §2 <-> §4"
IDS_2=$(printf '%s\n' "$REG_UNIDADES" | grep -oE '\bG[0-9]+\b' | sort -u)
IDS_4=$(printf '%s\n' "$REG_GAPS" | grep -oE '\bG[0-9]+\b' | sort -u)
SOLO_2=$(comm -23 <(printf '%s\n' "$IDS_2") <(printf '%s\n' "$IDS_4") | tr '\n' ' ')
SOLO_4=$(comm -13 <(printf '%s\n' "$IDS_2") <(printf '%s\n' "$IDS_4") | tr '\n' ' ')
echo "C7 §2=[$(printf '%s' "$IDS_2" | tr '\n' ' ')] §4=[$(printf '%s' "$IDS_4" | tr '\n' ' ')]"
if [ -n "${SOLO_2// /}" ]; then
  falta "C7 ids citados en §2 y ausentes de la gap-list §4: $SOLO_2"
fi
if [ -n "${SOLO_4// /}" ]; then
  falta "C7 ids de la gap-list §4 nunca citados desde §2: $SOLO_4"
fi
echo

# ---------------------------------------------------------------------------
echo "=== RESULTADO: $FALTAS falta(s) · STRICT=$STRICT"
if [ "$FALTAS" -gt 0 ] && [ "$STRICT" = "1" ]; then
  exit 1
fi
exit 0
