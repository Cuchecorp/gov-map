# Runbook: Fallback Local para Crons (WAF + Secrets)

Última actualización: 2026-07-08 (Phase 57)

Este runbook cubre dos casos: (1) corridas locales del conector `lobby-camara` que GH Actions
no puede ejecutar por el WAF de camara.cl, y (2) carga y mantenimiento de secrets en el repo
CI Cuchecorp/gov-map.

---

## 1. Prerequisitos

- Archivo `.env` en la raíz del repo con las siguientes variables:
  - `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
  - `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`
  - `DEEPSEEK_API_KEY`
- `pnpm` instalado globalmente (v9+).
- Node.js 22+ en el PATH.
- `gh` CLI autenticado: `gh auth status` debe mostrar `Cuchecorp/gov-map` accesible.
- `curl` disponible en el PATH.

Verificar antes de correr:

```bash
node --version   # >= 22
pnpm --version
gh auth status
```

---

## 2. Lobby Camara (WAF-bloqueado en GH Actions)

El WAF de `camara.cl` bloquea las IPs de GH Actions (detectado 2026-06-30, G7 audit Phase 56).
El CLI usa `--html-file` para leer el crudo ya descargado con `curl` (transporte anti-WAF).

**Pasos para corrida local:**

```bash
# Paso 1: Descargar el crudo con curl (UA identificatorio)
curl -sS -A 'Bot-Ciudadano/1.0' -o /tmp/lobby.html \
  'https://www.camara.cl/transparencia/listadodeaudiencias.aspx'

# Verificar que no fue interceptado por el WAF (debe ser > 10 KB)
SIZE=$(stat -c%s /tmp/lobby.html)
echo "lobby.html = $SIZE bytes"
if [ "$SIZE" -lt 10240 ]; then echo "WAF/respuesta < 10KB — abortando"; exit 1; fi

# Paso 2: Correr el CLI con el crudo (lee .env automáticamente)
pnpm --filter @obs/lobby exec tsx src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html
```

En Windows/PowerShell, reemplazar `stat -c%s` por `(Get-Item /tmp/lobby.html).Length`.

**Frecuencia sugerida:** Martes (equivale al schedule original del workflow).

**Verificar resultado:**

```bash
# Buscar en el output: audiencias=[1-9]
# Si la corrida fue exitosa, el CLI imprime algo como:
#   audiencias=42 confirmados=38
```

---

## 3. gh secret set Cookbook

IMPORTANTE: Los valores de los secrets NUNCA deben copiarse/pegarse en el terminal.
Usar siempre redirección de archivo o pipe. El historial de shell no debe quedar expuesto.

**Cargar o actualizar un secret desde .env (patrón seguro):**

```bash
# Patrón: leer el valor desde .env sin imprimirlo
gh secret set R2_ENDPOINT_URL --repo Cuchecorp/gov-map \
  < <(grep '^R2_ENDPOINT_URL=' .env | cut -d= -f2-)

gh secret set R2_ACCESS_KEY_ID --repo Cuchecorp/gov-map \
  < <(grep '^R2_ACCESS_KEY_ID=' .env | cut -d= -f2-)

gh secret set R2_SECRET_ACCESS_KEY --repo Cuchecorp/gov-map \
  < <(grep '^R2_SECRET_ACCESS_KEY=' .env | cut -d= -f2-)

gh secret set R2_BUCKET --repo Cuchecorp/gov-map \
  < <(grep '^R2_BUCKET=' .env | cut -d= -f2-)

gh secret set DEEPSEEK_API_KEY --repo Cuchecorp/gov-map \
  < <(grep '^DEEPSEEK_API_KEY=' .env | cut -d= -f2-)
```

En PowerShell (donde `<()` no es soportado):

```powershell
$envFile = Get-Content .env

foreach ($name in @('R2_ENDPOINT_URL','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET','DEEPSEEK_API_KEY')) {
  $val = ($envFile | Where-Object { $_ -match "^${name}=" }) -replace "^${name}=",''
  # Remover BOM y CRLF si los hay
  $val = $val.TrimStart([char]0xFEFF).TrimEnd("`r")
  $val | gh secret set $name --repo Cuchecorp/gov-map
  Remove-Variable val
}
```

**Verificar presencia (sin valores):**

```bash
gh secret list --repo Cuchecorp/gov-map
```

Los 5 nombres que deben aparecer:
- `R2_ENDPOINT_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `DEEPSEEK_API_KEY`

---

## 4. Re-enabling lobby-camara Schedule

Cuando el operador confirme que el WAF de camara.cl permite IPs de GH Actions nuevamente:

1. Editar `.github/workflows/lobby-camara-weekly.yml`.
2. Reemplazar el bloque `on:` por:

```yaml
on:
  schedule:
    - cron: "0 11 * * 2" # martes 11:00 UTC
  workflow_dispatch:
```

3. Hacer commit y push a master:

```bash
git add .github/workflows/lobby-camara-weekly.yml
git commit -m "ops: re-enable lobby-camara-weekly schedule (WAF resuelto)"
git push
```

4. Verificar en la pestaña Actions de https://github.com/Cuchecorp/gov-map/actions
   que el workflow aparece con schedule activo el próximo martes.

---

## 5. Verificacion Post-Corrida

**Revisar historial de corridas en GH Actions:**

```bash
gh run list --workflow agenda-weekly.yml --repo Cuchecorp/gov-map --limit 3
gh run list --workflow leyes-weekly.yml --repo Cuchecorp/gov-map --limit 3
gh run list --workflow probidad-weekly.yml --repo Cuchecorp/gov-map --limit 3
gh run list --workflow lobby-leylobby-weekly.yml --repo Cuchecorp/gov-map --limit 3
```

**Verificar counts en Supabase (via psql):**

```bash
# Audiencias de lobby Cámara
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM lobby_audiencia WHERE estado_vinculo = 'confirmado';"

# Snapshots de fuente por conector
psql "$DATABASE_URL" -c "SELECT fuente, MAX(fecha_captura) FROM source_snapshot GROUP BY fuente ORDER BY fuente;"
```

**Verificar que los logs contienen señales de corrida exitosa:**

```bash
# Para el run más reciente de leyes-weekly:
gh run view --log --repo Cuchecorp/gov-map $(gh run list --workflow leyes-weekly.yml --repo Cuchecorp/gov-map --limit 1 --json databaseId -q '.[0].databaseId') 2>/dev/null | grep -E '\[skip\]|upsertEventos|Etapa 1'
```
