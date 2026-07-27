#!/usr/bin/env bash
# check-inventario.sh — checklist re-ejecutable del artefacto rector 113-INVENTARIO.md
#
# Uso:
#   bash .planning/phases/113-inv-inventario-rector-de-superficies/check-inventario.sh
#   STRICT=1 bash .planning/phases/113-inv-inventario-rector-de-superficies/check-inventario.sh
#
# Régimen de STRICT:
#   STRICT=0 (default) — las waves 2-4 lo corren así: reporta faltas SIN fallar
#                        (las secciones 2/3/4 todavía no existen durante la construcción).
#   STRICT=1           — el Plan 05 (cierre de fase) lo corre así: cualquier falta => exit 1.
#
# Portabilidad: bash + POSIX grep. NO usa `grep -P` (no disponible en este entorno).
# Matching de rutas: SIEMPRE `grep -qF --` (literal), porque las rutas contienen
# `[id]` / `[boletin]`, que en BRE son clases de carácter y darían falsos positivos.
# La ruta raíz `/` matchea cualquier línea, así que se trata como CASO ESPECIAL:
# se busca su header de sección (`### 4.4 /`) en vez del string `/`.
#
# Corre en < 2 s. Read-only: no escribe nada.

set -u

STRICT=${STRICT:-0}

# Raíz del repo (el script vive en .planning/phases/113-.../)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
INV="$SCRIPT_DIR/113-INVENTARIO.md"

cd "$REPO_ROOT" || exit 1

FALTAS=0

falta() {
  FALTAS=$((FALTAS + 1))
  echo "FALTA $1"
}

if [ ! -f "$INV" ]; then
  echo "FALTA 113-INVENTARIO.md no existe en $SCRIPT_DIR"
  exit 1
fi

# ---------------------------------------------------------------------------
# Check 1 — cada ruta de `find app/app -name page.tsx` aparece en el inventario
# ---------------------------------------------------------------------------
n_rutas=0
faltan_rutas=0
for archivo in $(find app/app -name "page.tsx" | sort); do
  n_rutas=$((n_rutas + 1))
  ruta="${archivo#app/app}"
  ruta="${ruta%/page.tsx}"
  [ -z "$ruta" ] && ruta="/"
  if [ "$ruta" = "/" ]; then
    # Caso especial: `/` matchea cualquier línea. Se busca su header de sección.
    if ! grep -qE '^### 4\.[0-9]+ /[[:space:]]*$' "$INV"; then
      faltan_rutas=$((faltan_rutas + 1))
      falta "ruta / (header de sección '### 4.N /' ausente)"
    fi
  else
    if ! grep -qF -- "$ruta" "$INV"; then
      faltan_rutas=$((faltan_rutas + 1))
      falta "ruta $ruta ($archivo)"
    fi
  fi
done
if [ "$faltan_rutas" -eq 0 ]; then
  echo "OK check 1 — las $n_rutas rutas page.tsx están en el inventario"
else
  echo "-- check 1 — $faltan_rutas de $n_rutas rutas page.tsx ausentes"
fi

# ---------------------------------------------------------------------------
# Check 2 — cada `not-found.tsx` aparece en el inventario
# ---------------------------------------------------------------------------
n_nf=0
faltan_nf=0
for archivo in $(find app/app -name "not-found.tsx" | sort); do
  n_nf=$((n_nf + 1))
  if ! grep -qF -- "$archivo" "$INV"; then
    faltan_nf=$((faltan_nf + 1))
    falta "not-found $archivo"
  fi
done
if [ "$faltan_nf" -eq 0 ]; then
  echo "OK check 2 — las $n_nf not-found.tsx están apendizadas"
else
  echo "-- check 2 — $faltan_nf de $n_nf not-found.tsx ausentes"
fi

# ---------------------------------------------------------------------------
# Check 3 — los 4 builders de URL externa están citados
# ---------------------------------------------------------------------------
faltan_builders=0
for b in buildSenadoUrl buildCamaraUrl enlaceHumanoProyecto partidoLegible; do
  if ! grep -qF -- "$b" "$INV"; then
    faltan_builders=$((faltan_builders + 1))
    falta "builder $b no citado"
  fi
done
if [ "$faltan_builders" -eq 0 ]; then
  echo "OK check 3 — los 4 builders de URL externa están citados"
else
  echo "-- check 3 — $faltan_builders de 4 builders ausentes"
fi

# ---------------------------------------------------------------------------
# Check 4 — al menos 5 bloques ```sql (los 5 sujetos deterministas)
# ---------------------------------------------------------------------------
n_sql=$(grep -c '```sql' "$INV")
if [ "$n_sql" -ge 5 ]; then
  echo "OK check 4 — $n_sql bloques sql (>= 5 sujetos deterministas)"
else
  falta "bloques sql: $n_sql (se esperan >= 5)"
  echo "-- check 4 — solo $n_sql bloques sql"
fi

# ---------------------------------------------------------------------------
# Check 5 — la cobertura está declarada
# ---------------------------------------------------------------------------
if grep -qF -- "Cobertura" "$INV"; then
  echo "OK check 5 — declaración de Cobertura presente"
else
  falta "declaración de Cobertura"
  echo "-- check 5 — declaración de Cobertura ausente"
fi

# ---------------------------------------------------------------------------
echo "---"
if [ "$FALTAS" -eq 0 ]; then
  echo "RESULTADO: sin faltas (STRICT=$STRICT)"
  exit 0
fi

echo "RESULTADO: $FALTAS falta(s) (STRICT=$STRICT)"
if [ "$STRICT" -eq 1 ]; then
  exit 1
fi
echo "STRICT=0 => no falla (construcción en curso; el Plan 05 corre con STRICT=1)"
exit 0
