---
phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
plan: 03
tipo: runbook-operador-LOCAL
requirements: [CIT-01]
locked:
  - "Backfill masivo = LOCAL operador, NO GitHub Actions (minimizar minutos CI)"
  - "Rate-limit 2-3s/host, UA/header-set navegador identificatorio, serial, NUNCA ráfagas (WAF Cloudflare de camara.cl)"
  - "Dos etapas: fuente→R2 (crudo inmutable content-addressed) SIEMPRE antes de R2→Supabase"
  - "Hash-check ANTES de descargar (sha256 / If-None-Match): si el crudo del día ya está en R2, no re-scrapear"
entry_point: packages/agenda/src/run-agenda-prod-cli.ts
---

# 93 — BACKFILL RUNBOOK (operador-LOCAL): histórico masivo de citaciones de Cámara

> **QUIÉN CORRE ESTO:** el operador, en su máquina LOCAL. **NO** el agente, **NO** GitHub Actions.
> **POR QUÉ LOCAL:** el backfill golpea `www.camara.cl` a escala (rate-limit 2-3s LOCKED,
> header-set anti-Cloudflare) y escribe a la Supabase **REMOTA (PROD)**. Ambas cosas son
> operador-LOCAL por regla LOCKED (CLAUDE.md "Ingesta y Cron — LOCKED"). El agente que produjo
> este runbook corrió SOLO un backfill **acotado** de 5 semanas (2026-W20…W24, §5 del reporte),
> con precedente 90-03/92-04; el histórico completo (∞ semanas desde el inicio del período) es
> el acto deliberado del operador descrito aquí.
>
> **NOTA CI:** correr esto en GitHub Actions está PROHIBIDO — quema minutos y arriesga ráfagas
> contra el WAF + escritura accidental a PROD desde CI. El cron `agenda-weekly.yml` corre solo
> "semana actual + próximas 2" (forward-looking); NO hace backfill histórico.

## 0. QUÉ CUBRE ESTE BACKFILL

**Objetivo:** ingerir el histórico masivo de **citaciones de comisiones de Cámara** por semana
ISO, desde el inicio del período legislativo vigente hasta hoy, para pasar la celda
`comisiones × Cámara` de THIN (§1.2 del reporte: hoy 6 semanas ISO tras el backfill acotado) a
cobertura histórica declarada. Es la ÚNICA celda con histórico navegable alcanzable (§3 NUEVO):

- **comisiones × Cámara** — histórico navegable por `prmSemana=AAAA-NN` (cualquier semana pasada
  devuelve 200 con `article.citaciones`). **← este runbook.**
- **comisiones × Senado** — forward-only por la FUENTE (no acepta fecha histórica). NO hay backfill
  posible; "al día en su ventana" es lo máximo honesto.
- **sala × Senado** — forward-only por la FUENTE. Idem.
- **sala × Cámara** — solo el PDF vigente (`prmId=0`); el histórico exigiría enumerar `prmId≠0`
  (fuera de alcance; no estructurado → DeepSeek). NO cubierto aquí.

## 1. FLAGS REALES DEL CLI

Verbatim de `packages/agenda/src/run-agenda-prod-cli.ts`:

```
tsx packages/agenda/src/run-agenda-prod-cli.ts [--dry-run] [--solo-senado] [--desde YYYY-Www] [--hasta YYYY-Www]
```

- Sin `--dry-run` y con `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY` en `.env` → writer =
  `SupabaseAgendaWriter` → **REMOTO (PROD)**. Con `--dry-run` (o sin esas dos vars) → InMemory
  (no escribe DB) — úsalo para verificar shape antes de cada bloque.
- `--desde/--hasta` acotan el rango de semanas ISO (`enumerarSemanas` lo expande, inclusive).
- `--solo-senado` omite Cámara — NO usar en este backfill (justamente se quiere Cámara).
- Idempotente por **clave natural** (el writer upserta): re-correr un bloque ya cargado = no-op.
- Rate-limit 2-3s + header-set anti-Cloudflare + robots + SSRF ya integrados (orden LOCKED de
  `@obs/ingest`); Cámara via `createCurlTransport` (PASA el WAF; fetch nativo recibe 403).

> **⚠️ GOTCHA cwd (LOCKED, verificado 93-03):** `loadEnv` lee el `.env` de `process.cwd()`.
> `pnpm --filter @obs/agenda exec tsx …` cambia el cwd al **dir del paquete** → NO encuentra el
> `.env` de la RAÍZ → cae a InMemory + `[WARN] R2 no configurado` (escribe a ninguna parte). Correr
> SIEMPRE desde la RAÍZ del repo con el binario local de tsx:
> ```bash
> ./node_modules/.bin/tsx packages/agenda/src/run-agenda-prod-cli.ts --desde 2026-Www --hasta 2026-Www
> ```
> Verificar en el log la línea `agenda: writer Supabase PROD (<url>)` ANTES de dejarlo escribir;
> si dice `DRY-RUN (in-memory…)` sin haber pasado `--dry-run`, DETENER y arreglar el cwd/`.env`.

## 2. PRE-CHECKS OBLIGATORIOS (offline, antes de cualquier corrida LIVE)

Ejecutar en orden. Si alguno falla, **DETENER** — no correr el backfill.

1. **Suite del paquete verde:**
   ```bash
   pnpm --filter @obs/agenda test
   pnpm --filter @obs/agenda typecheck
   ```
   Esperado: 113 pass (incluye los 3 tests de Etapa 1 R2 de citaciones) + typecheck verde.

2. **`.env` tiene las credenciales necesarias** (verificar NOMBRES, NUNCA valores):
   - Etapa 1 (R2 crudo): `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
     Sin las 4 → la Etapa 1 se **omite con `[WARN]`** (degrada honesto, PERO no produce el crudo
     content-addressed → se pierde el hash-check y el replay futuro). NO correr el masivo sin R2.
   - Etapa 2 (write REMOTO): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`.
   - Sala Cámara (opcional): `DEEPSEEK_API_KEY` (sin él la tabla de sala degrada honesto al PDF).
   - Verificación de destino/counts: `SUPABASE_DB_URL`.
   ```bash
   grep -oE '^(R2_ENDPOINT_URL|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET|SUPABASE_API_URL|SUPABASE_SECRET_KEY|SUPABASE_DB_URL)=' .env
   ```
   Deben aparecer las 7 líneas (solo los nombres).

3. **Endpoint UP con header-set navegador** (verificado 93-01, Probe 4/4b). Opcional: un `--dry-run`
   de una semana pasada conocida confirma fetch+parse sin escribir:
   ```bash
   ./node_modules/.bin/tsx packages/agenda/src/run-agenda-prod-cli.ts --dry-run --desde 2026-W20 --hasta 2026-W20
   ```
   Debe imprimir `ingest: Cámara 2026-W20 → N citaciones` con N>0 y `errores=0`.

## 3. N ANTES (counts de partida)

```bash
export PGCLIENTENCODING=UTF8
psql "$SUPABASE_DB_URL" -tA -c \
  "select count(*), count(distinct semana_iso) from citacion where camara='camara'"
psql "$SUPABASE_DB_URL" -tA -c \
  "select semana_iso, count(*) from citacion where camara='camara' group by semana_iso order by semana_iso"
```

Anotar el N y las semanas ISO ya presentes (tras el backfill acotado de 93-03: **164 / 6 semanas**
= W20,W21,W23,W24,W26,W28). Los bloques del backfill deben cubrir los HUECOS y el histórico previo
a W20 hasta el inicio del período.

## 4. PARTICIONAR EN BLOQUES REANUDABLES

"Reanudable" NO usa cursor persistente: se logra **particionando** el rango de semanas ISO en
bloques + la **idempotencia por clave natural**. Re-correr un bloque ya cargado es un no-op de
upsert. Reanudar tras una interrupción = correr los bloques pendientes.

Elegir bloques de ~4-6 semanas contiguas (pocas decenas de requests c/u, rate-limit 2-3s). Ej.
para el período que va del inicio (p.ej. 2026-W11) hasta hoy, en bloques hacia atrás:

```
Bloque A: --desde 2026-W15 --hasta 2026-W19   (rellena el hueco previo a W20)
Bloque B: --desde 2026-W11 --hasta 2026-W14   (inicio del período)
Bloque C: --desde 2026-W25 --hasta 2026-W27   (rellena huecos W25/W27 entre lo ya cargado)
...
```

(Ajustar la semana de inicio del período legislativo real; una semana con 0 citaciones es honesta,
no un error — ver W22 en §5 del reporte.)

## 5. CORRIDA LIVE (Etapa 1 fuente→R2 + Etapa 2 R2→Supabase, bloque por bloque)

Para **cada** bloque, en serie (NUNCA en paralelo, NUNCA ráfagas), desde la RAÍZ del repo:

```bash
./node_modules/.bin/tsx packages/agenda/src/run-agenda-prod-cli.ts --desde 2026-W15 --hasta 2026-W19
```

**ANTES de dejarlo correr, verificar en el log:**
- `agenda: writer Supabase PROD (<url PROD>)` — si dice `DRY-RUN (in-memory…)` sin `--dry-run`,
  DETENER (gotcha cwd §1): estarías escribiendo a ninguna parte.
- Por cada semana: `ingest: Cámara 2026-Www → HTML crudo en R2 (camara/citaciones-semana/….html)`
  seguido de `ingest: Cámara 2026-Www → N citaciones`. Si falta la línea R2 → la Etapa 1 se omitió
  (R2 mal configurado) → DETENER y arreglar `.env`.

**Reglas LOCKED durante la corrida:**
- **Rate-limit 2-3s por host, serial.** El `Fetcher`+`HostRateLimiter` ya lo imponen; NO meter
  `Promise.all`, NO bajar el delay.
- **Dos etapas SIEMPRE:** cada semana persiste su HTML crudo en R2 (content-addressed,
  `putImmutable` con `If-None-Match:*`, 412=existed=éxito idempotente) ANTES de que la Etapa 2
  escriba a Supabase. **Hash-check:** si el crudo del día ya está en R2 (mismo sha256), el
  `putImmutable` devuelve `existed:true` sin re-subir.
- Correr **un bloque a la vez**; esperar a que termine antes de lanzar el siguiente.

## 6. N DESPUÉS + CIERRE

Tras cada bloque (y al final):

```bash
psql "$SUPABASE_DB_URL" -tA -c \
  "select count(*), count(distinct semana_iso) from citacion where camara='camara'"
```

Consolidar: N Cámara antes → después, semanas ISO cubiertas → declarar el **rango de fechas/semanas
cubierto** (insumo directo de la DECLARACIÓN de cobertura de §7 del reporte, que 94 muestra como
banner/leyenda). NUNCA declarar la celda como "completa": declarar el rango real cubierto.

**Criterios de cierre:**
- [ ] Todos los bloques corridos LIVE sin errores pendientes (`errores=0` en cada log).
- [ ] N Cámara antes/después declarado (números concretos) + semanas ISO cubiertas.
- [ ] Crudo HTML de cada semana presente en R2 (`camara/citaciones-semana/<fecha>/<sha>.html`).
- [ ] El rango cubierto se refleja en la DECLARACIÓN de cobertura (§7) que consume 94.

## 7. EXTENSIÓN PENDIENTE (declarada — trabajo de 94/operador, NO de esta fase)

El dos-etapas de citaciones de Cámara quedó cableado a la mitad "fuente→R2" (Etapa 1 LIVE, 93-03).
Falta la mitad "R2→Supabase" como **replay**:

- **`--from-r2` NO existe hoy** para agenda. El `run-agenda-prod-cli.ts` no acepta `--from-r2`
  (a diferencia del CLI de votos de 66) y no hay lector que reconstruya la Etapa 2 desde el crudo
  R2 de Cámara citaciones. La cláusula `--from-r2` de SC#3 la satisface ESTE runbook futuro, no la
  fase 93. Trabajo de 94/operador: agregar un modo `--from-r2 <r2Path>` que lea el HTML crudo del
  envelope `camara/citaciones-semana/…` y re-corra `parseCamaraCitaciones`+upsert SIN tocar el WAF
  (espejo del `--from-r2` de votos), para re-ingestar ante cambios de schema/parse sin re-scrapear.
- **Senado (pasos 2-3) sin R2:** las citaciones y `weekly_table` del Senado NO van a R2 (API JSON
  forward-only, sin histórico). Threadear el envelope R2 al paso Senado es una extensión menor
  opcional (misma decisión de alcance que la auditoría). Estado por path: **camara/citaciones-semana
  ✓**, **camara/tabla-sala ✓**, **senado/* ✗ (pendiente)**.

## SEGURIDAD DE CREDENCIALES

Este runbook referencia SOLO **nombres** de variables de entorno (`R2_ACCESS_KEY_ID`,
`SUPABASE_SECRET_KEY`, …), NUNCA valores. El CLI loguea la URL de destino + conteos + r2Path,
jamás la service key ni filas PII. Las citaciones de comisión NO tocan RUT/PII: solo comisión,
fecha/hora, sala y boletín (dato público de tramitación).
