---
phase: 66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
plan: 02
tipo: runbook-operador-LOCAL
requirements: [VOTO-01, DEBT-01]
locked:
  - "Backfill masivo = LOCAL operador, NO GitHub Actions (minimizar minutos CI)"
  - "Rate-limit 2-3s/host, UA identificatorio, serial, NUNCA ráfagas (WAF gubernamental)"
  - "Dos etapas: fuente→R2 (crudo inmutable) SIEMPRE antes de R2→Supabase"
entry_point: packages/votos/src/run-votos-masivo-cli.ts
---

# 66 — BACKFILL RUNBOOK (operador-LOCAL): voto individual de Cámara a escala

> **QUIÉN CORRE ESTO:** el operador, en su máquina LOCAL. **NO** el agente, **NO** GitHub Actions.
> **POR QUÉ LOCAL:** el backfill golpea el WS gubernamental `opendata.camara.cl` a escala
> (rate-limit 2-3s LOCKED) y escribe a la Supabase **REMOTA (PROD)**. Ambas cosas son
> operador-LOCAL por regla LOCKED (CLAUDE.md "Ingesta y Cron — LOCKED"). El agente que
> produjo este runbook NO invocó `VOTOS_LIVE=1`, NO tocó el WAF y NO escribió a PROD.
>
> **NOTA CI:** correr esto en GitHub Actions está PROHIBIDO — quema minutos y arriesga
> ráfagas contra el WAF + escritura accidental a PROD desde CI (T-66-02b, T-66-05b).

El wire de dos etapas de votos ya está implementado y probado offline (Plan 66-01):
`runCamaraVotos` reenvía `r2Store`/`snapshotWriter`/`fromR2` a `runIngest`, el CLI de
operador construye un `R2Store` real de `.env` y acepta `--from-r2`, y `reportarCobertura`
mide `estado_vinculo` + el invariante "0 DIPID-maestra no_confirmado". Este runbook es el
acto deliberado del operador que consume ese wire.

**Flags reales del CLI** (verbatim de `packages/votos/src/run-votos-masivo-cli.ts`):

```
tsx packages/votos/src/run-votos-masivo-cli.ts [--dry-run] [--limit N] [--boletines-file <ruta>] [--from-r2 <r2Path>]
```

- Sin `--dry-run` y con `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY` en `.env` → writer = `SupabaseTramitacionWriter` → **REMOTO (PROD)**.
- `--boletines-file <ruta>`: un boletín por línea (vía robusta; el descubrimiento por sesión da 0 — Pitfall 1).
- `--limit N`: acota el número de boletines (default 1000).
- `--from-r2 <r2Path>`: re-ejecuta la Etapa 2 desde R2 **sin tocar la fuente**.
- Idempotente por `(votacion_id, fuente_voter_id)`: re-correr = no-op de upsert.

---

## 1. PRE-CHECKS OBLIGATORIOS (todos offline, antes de cualquier corrida LIVE)

Ejecutar en orden. Si alguno falla, **DETENER** — no correr el backfill.

1. **Golden gate P65 verde** (cruce DIPID determinista fail-closed):
   ```bash
   pnpm --filter @obs/votos test golden-dipid
   ```
   Debe pasar. Si está rojo, el reconciliador está roto → un DIPID-maestra podría quedar
   `no_confirmado` al escalar (rompe el invariante de cierre). NO continuar.

2. **Suite offline del wire verde** (Plan 66-01):
   ```bash
   pnpm --filter @obs/votos test
   pnpm --filter @obs/votos typecheck
   ```
   Esperado: 26 pass (run-camara-votos 8, cobertura 4, golden-dipid 14) + typecheck verde.

3. **La DB REMOTA destino tiene la migración 0019 aplicada** — el CHECK de `voto.seleccion`
   debe incluir `'ausente'` (Pitfall 4). Verificar contra la DB REMOTA (usar `SUPABASE_DB_URL`
   de `.env`, que apunta al REMOTO):
   ```bash
   psql "$SUPABASE_DB_URL" -c "\d voto"
   ```
   El `Check constraints` de `voto_seleccion_check` DEBE listar `'ausente'` junto a
   `si,no,abstencion,pareo`. Si NO lo incluye → aplicar 0019 a la DB REMOTA ANTES del backfill
   (el primer voto `ausente` abortaría el upsert con
   `new row violates check constraint "voto_seleccion_check"`).

4. **`.env` tiene las credenciales necesarias** (verificar nombres, NUNCA loguear valores):
   - Etapa 1 (R2 crudo): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`.
     Sin `R2_ACCESS_KEY_ID`+`R2_ENDPOINT_URL` la Etapa 1 se **omite con WARN** (degrada honesto,
     pero NO produce los primeros snapshots de votos ni permite `--from-r2` después).
   - Etapa 2 (write REMOTO): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`.
   - Verificación de destino: `SUPABASE_DB_URL` (para el `\d voto` del punto 3).
   ```bash
   grep -oE '^(R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_ENDPOINT_URL|R2_BUCKET|SUPABASE_API_URL|SUPABASE_SECRET_KEY)=' .env
   ```
   Deben aparecer las 6 líneas (solo los nombres, sin exponer los valores).

5. **Endpoint UP** (Phase 64 lo verificó a escala, 5/5). Opcional: un `--dry-run` acotado
   con un único boletín conocido confirma fetch+parse sin escribir a DB:
   ```bash
   VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts --dry-run --boletines-file <(echo 14309-04)
   ```

---

## 2. DERIVAR EL ARCHIVO DE BOLETINES (`boletines.txt`)

El descubrimiento por sesión del WS suele dar 0 (Pitfall 1) → SIEMPRE derivar los boletines
de los proyectos ya trackeados en la DB REMOTA. Un boletín por línea.

```bash
# PostgREST/psql corta a 1k filas por request → paginar SIEMPRE con ORDER + LIMIT/OFFSET
# (o .order().range() si se lee vía supabase-js). Aquí vía psql directo al REMOTO:
psql "$SUPABASE_DB_URL" -tAc \
  "SELECT boletin FROM proyecto WHERE boletin IS NOT NULL ORDER BY boletin" \
  > boletines.txt

# ASSERT que hay boletines (Pitfall 1: un backfill vacío es silencioso):
test "$(wc -l < boletines.txt)" -gt 0 || { echo "DETENER: boletines.txt vacío"; exit 1; }
wc -l boletines.txt
```

> Si se lee vía supabase-js en vez de psql: paginar con `.order("boletin").range(from, from+999)`
> en bucle hasta agotar (cap 1k PostgREST — gotcha v6.1). NUNCA un `select` sin paginar.

---

## 3. PARTICIONAR PARA REANUDABLE

"Reanudable" NO usa un cursor persistente nuevo: se logra **particionando** `boletines.txt`
en lotes + la **idempotencia por clave natural** (`votacion_id, fuente_voter_id`). Re-correr
un lote ya cargado es un **no-op de upsert**. Reanudar tras una interrupción = correr los
lotes pendientes (los ya corridos no duplican si se re-corren).

```bash
# Lotes de 200 boletines: boletines-lote-aa.txt, -ab.txt, ...
split -l 200 -d --additional-suffix=.txt boletines.txt boletines-lote-
ls boletines-lote-*.txt
```

Llevar una nota manual de qué lote fue el último completado (el log del CLI declara
`votaciones=… votos=… dbLoaded=… errores=…` al final de cada corrida).

---

## 4. CORRIDA LIVE (Etapa 1 fuente→R2 + Etapa 2 R2→Supabase, lote por lote)

Para **cada** lote, en serie (NUNCA en paralelo, NUNCA ráfagas):

```bash
VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts \
  --boletines-file boletines-lote-aa.txt
```

**ANTES de dejarlo correr, verificar el destino en el log (Pitfall 5):**

- Debe imprimir `votos-masivo: R2Store construido de .env (Etapa 1 activa)` — si dice
  `[WARN] R2 no configurado … Etapa 1 omitida`, DETENER y arreglar `.env` (no se producirían
  los snapshots crudos de votos).
- Debe imprimir `votos-masivo: writer Supabase REMOTO (<url>)` con la URL de PROD. Si dijera
  `LOCAL (127.0.0.1…)` u otra URL inesperada → **DETENER**: estarías escribiendo a la DB
  equivocada. No es el caso de este CLI (lee `SUPABASE_API_URL` del `.env` = REMOTO), pero
  verificar siempre antes de escribir.

**Reglas LOCKED durante la corrida:**
- **Rate-limit 2-3s por host**, serial. El `Fetcher`+`HostRateLimiter` ya lo imponen; NO
  meter `Promise.all`, NO bajar el delay. (P64 midió ~3.2 s/fetch — correcto.)
- **Dos etapas SIEMPRE:** cada boletín persiste su crudo en R2 (content-addressed,
  `If-None-Match:*`, 412=existed=éxito idempotente) ANTES de que la Etapa 2 escriba a Supabase.
- Correr **un lote a la vez**; esperar a que termine antes de lanzar el siguiente.

Repetir para `boletines-lote-ab.txt`, `-ac.txt`, … hasta agotar los lotes.

---

## 5. REPLAY ETAPA 2 (`--from-r2`) — sin re-tocar la fuente

Si un lote persistió el crudo en R2 (Etapa 1 OK) pero falló en la Etapa 2 (parse/DB — p.ej.
un error de conexión a Supabase, o se aplicó 0019 tarde), re-ejecutar **solo la Etapa 2**
desde R2, SIN volver a golpear el WAF:

```bash
VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts \
  --from-r2 <r2Path-del-envelope>
```

- `--from-r2` requiere R2 configurado en `.env` (si no, el CLI lanza y aborta — por diseño).
- Lee el envelope crudo de R2 y monta conectores fake (0 fetch a la fuente).
- El crudo de votos vive DENTRO del envelope `tramitacion/<boletin>/…` (campos `votXml`
  + `detalles[]`), no en un namespace dedicado (decisión A1/D-R2-NS del Plan 01).

---

## 6. REPORTE DE COBERTURA (SC#4) + INVARIANTE DE CIERRE

Tras una corrida con writer REAL (no dry-run), el CLI imprime automáticamente:

```
votos-masivo cobertura: {"porEstado":{...},"dipidsMaestraNoConfirmados":N}
```

- `porEstado`: conteo por `estado_vinculo` (head+count, sin materializar filas → sin cap 1k).
- `dipidsMaestraNoConfirmados`: **DEBE ser 0.** Cuenta los `no_confirmado` cuyo
  `fuente_voter_id` está en la maestra vigente (por `.in()` en lotes, NUNCA name-match).

**Consolidación tras todos los lotes:** N confirmado / M total (cobertura absoluta) +
verificar `dipidsMaestraNoConfirmados === 0`.

> **Interpretación correcta de "el % confirmado no baja" (Pitfall 3):** al escalar a
> boletines históricos aparecen votos de DIPIDs de periodos que la maestra vigente no cubre →
> más `no_confirmado` **absolutos** por diseño fail-closed (correcto, NO un fallo). Lo que
> NO puede pasar es que un DIPID **de la maestra vigente** quede `no_confirmado`. Ese es el
> invariante duro; el golden gate P65 lo garantiza.

Query de verificación manual (verbatim del RESEARCH — agregado, sin paginación necesaria),
correr contra la DB REMOTA:

```sql
-- Cobertura por estado (agregado → pocas filas, sin cap 1k):
select estado_vinculo, count(*) as n
from voto
group by estado_vinculo
order by estado_vinculo;

-- Invariante duro SC#4: NINGÚN DIPID de la maestra vigente quedó no_confirmado → DEBE ser 0:
select count(*) as dipids_maestra_no_confirmados
from voto v
where v.estado_vinculo = 'no_confirmado'
  and v.fuente_voter_id in (
    select id_diputado_camara from parlamentario
    where camara='diputados' and periodo='2026-2030' and id_diputado_camara is not null
  );
```

**Si `dipids_maestra_no_confirmados > 0` → BUG que rompe P65: DETENER el cierre**, investigar
el reconciliador/golden. No declarar el backfill completo.

---

## 7. CRITERIOS DE CIERRE

Todos deben cumplirse para declarar el backfill hecho:

- [ ] Todos los lotes (`boletines-lote-*.txt`) corridos LIVE sin errores pendientes.
- [ ] Cobertura declarada: N confirmado / M total (números concretos).
- [ ] Invariante `dipidsMaestraNoConfirmados === 0` verificado (CLI + query manual).
- [ ] Crudo de votos presente en R2 (primeros snapshots content-addressed de votos, dentro
      del envelope `tramitacion/<boletin>/…`).
- [ ] Ningún lote quedó a medias (si alguno falló en Etapa 2, se resolvió por `--from-r2`).

**Señal de reanudación / cierre para el checkpoint del Plan:** el operador reporta
`"backfill hecho"` con la cobertura N/M y el conteo del invariante (esperado 0), o describe
el problema (p.ej. un DIPID-maestra quedó `no_confirmado` → BUG que detiene el cierre).

---

## ROLLBACK / SEGURIDAD ante fallos de red (WAF 429/5xx)

- **429 / 5xx del WAF:** el `Fetcher`/`HostRateLimiter` aplican backoff; si el WAF empieza a
  degradar de forma sostenida, **DETENER el lote en curso**. Lo ya persistido en R2 (Etapa 1)
  no se pierde: reanudar la Etapa 2 con `--from-r2` para lo persistido, y re-lanzar los
  boletines faltantes en un lote nuevo cuando el WAF se estabilice.
- **Reanudar tras interrupción:** re-correr los lotes pendientes. La idempotencia por
  `(votacion_id, fuente_voter_id)` hace no-op los boletines ya cargados — no hay duplicación.
- **NUNCA** aumentar la concurrencia ni bajar el rate-limit para "ir más rápido": eso provoca
  el ban del WAF (DoS, T-66-02b). Serial + 2-3s es LOCKED.
- **Escritura a PROD:** el destino REMOTO se verifica en el log ANTES de escribir (Pitfall 5).
  Si el log no dice `REMOTO (<url PROD>)`, no dejar correr.

## SEGURIDAD DE CREDENCIALES

Este runbook referencia SOLO **nombres** de variables de entorno (`R2_ACCESS_KEY_ID`,
`SUPABASE_SECRET_KEY`, …), NUNCA valores. El CLI loguea la URL de destino + conteos, jamás
la service key ni filas PII (T-66-06). Los votos NO tocan RUT/PII: solo DIPID (id oficial
público) + nombre público.
