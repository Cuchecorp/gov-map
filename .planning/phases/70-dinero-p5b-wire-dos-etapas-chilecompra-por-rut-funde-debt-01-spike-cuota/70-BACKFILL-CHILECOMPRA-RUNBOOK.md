---
phase: 70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
plan: 03
tipo: runbook-operador-LOCAL
requirements: [MONEY-01, DEBT-01]
locked:
  - "Backfill masivo = LOCAL operador, NO GitHub Actions (minimizar minutos CI + evitar ráfagas contra el WAF)"
  - "Rate-limit 2-3s/host, UA identificatorio, serial, NUNCA ráfagas (WAF gubernamental)"
  - "Dos etapas: fuente→R2 (crudo inmutable) SIEMPRE antes de R2→Supabase"
  - "MONEY_PUBLIC_ENABLED se queda OFF — los contratos aterrizan en DB pero NO se presentan públicamente hasta el flip legal de Phase 73"
depende_de:
  - "RUT-01 (Phase 69) poblado en la maestra remota — bloqueante duro (sin RUTs no hay universo que consultar)"
entry_point: packages/dinero/src/run-dinero-masivo-cli.ts
---

# 70 — BACKFILL RUNBOOK (operador-LOCAL): contratos ChileCompra por RUT a escala

> **QUIÉN CORRE ESTO:** el operador, en su máquina LOCAL. **NO** el agente, **NO** GitHub Actions.
> **POR QUÉ LOCAL:** el backfill golpea el REST gubernamental `api.mercadopublico.cl` a escala
> bajo una **cuota no modificable de 10.000 requests/día** atada al ticket secreto de operador
> (rate-limit 2-3s LOCKED) y escribe a la Supabase **REMOTA (PROD)**. Ambas cosas son
> operador-LOCAL por regla LOCKED (CLAUDE.md "Ingesta y Cron — LOCKED"). El agente que
> produjo este runbook NO usó `MERCADOPUBLICO_TICKET`, NO consumió cuota, NO tocó el WAF, NO
> escribió a PROD y NO cambió `MONEY_PUBLIC_ENABLED`.
>
> **NOTA CI:** correr esto en GitHub Actions está PROHIBIDO — quema minutos, arriesga ráfagas
> contra el WAF, expone el ticket en logs de CI, y podría agotar la cuota diaria (T-70-09).

El wire de dos etapas de dinero ya está implementado y probado offline (Plan 70-01):
`runIngestDinero` reenvía `r2Store`/`snapshotWriter`/`fromR2`, el CLI de operador
(`run-dinero-masivo-cli.ts`) construye un `R2Store` real de `.env R2_*`, redacta el
`MERCADOPUBLICO_TICKET` en TODA salida, y acepta `--from-r2`. La señal freshness `chilecompra`
del catálogo (Plan 70-02) mide `contratos_ingesta_estado.ingestado_hasta`. Este runbook es el
acto deliberado del operador que consume ese wire.

**Flags reales del CLI** (verbatim de `packages/dinero/src/run-dinero-masivo-cli.ts`):

```
tsx packages/dinero/src/run-dinero-masivo-cli.ts [--dry-run] [--rut RUT]... [--dia DDMMAAAA]... [--ruts-file <ruta>] [--from-r2 <r2Path>]
```

- `--rut RUT` (repetible): un RUT de proveedor a consultar.
- `--dia DDMMAAAA` (repetible, 8 dígitos): día del barrido (paso 2). Default: **hoy**.
- `--ruts-file <ruta>`: un RUT por línea (la vía a escala; combina con `--dia` por lote).
- `--from-r2 <r2Path>`: re-ejecuta la Etapa 2 desde R2 **sin tocar la fuente** (0 fetch).
- `--dry-run`: writer InMemory, no escribe DB.
- Sin `--dry-run` y con `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY` en `.env` **y** `MERCADOPUBLICO_TICKET` presente → writer = `SupabaseDineroWriter` → **REMOTO (PROD)**.
- Sin ticket (y sin `--from-r2`) o sin DB → cae a **DRY-RUN InMemory** (NUNCA fabrica).
- El ticket sale **SOLO de env** (`MERCADOPUBLICO_TICKET`), **nunca de argv**. Todo log/error/degradación pasa por `redactarTicket` (CR-01).
- Idempotente por clave natural: re-correr un lote ya cargado = no-op de upsert.

---

## 1. PRE-CHECKS OBLIGATORIOS (todos offline, antes de cualquier corrida LIVE)

Ejecutar en orden. Si alguno falla, **DETENER** — no correr el backfill.

1. **DEPENDENCIA DURA — RUT-01 (Phase 69) poblado en la maestra REMOTA.**
   El universo de RUTs a consultar sale del cruce que RUT-01 puebla. **Sin RUTs cruzables el
   crawl no tiene universo** → un backfill vacío es silencioso. Verificar contra la DB REMOTA
   que hay RUTs de proveedores/entidades ligadas (paginar SIEMPRE, cap 1k PostgREST):
   ```bash
   psql "$SUPABASE_DB_URL" -tAc \
     "SELECT count(*) FROM entidad_tercero WHERE rut IS NOT NULL AND rut <> ''"
   ```
   Si el conteo es **0**, RUT-01 aún no fue aplicado (checkpoint operador PENDIENTE de Phase 69).
   **DETENER:** no hay nada que crawlear. Aplicar RUT-01 primero.

2. **Suite offline del wire dinero verde** (Plan 70-01 + 70-02):
   ```bash
   pnpm --filter @obs/dinero test
   pnpm --filter @obs/dinero typecheck
   pnpm --filter @obs/freshness test
   ```
   Esperado: dinero 115 pass (wire + CLI + CR-01 + guards) + typecheck verde; freshness 31 pass
   (incl. 5 casos ChileCompra). Si el guard `reconciler-frozen-guard` o el
   `name-match-rut-guard` muerden (rojo), el reconciliador jurídico RUT-only está debilitado →
   NO continuar (un name-match podría escribir un RUT falso).

3. **`MONEY_PUBLIC_ENABLED` NO seteado = OFF** (los contratos NO se presentan públicamente
   hasta el flip legal de Phase 73):
   ```bash
   grep -E '^MONEY_PUBLIC_ENABLED=' .env || echo "OK: MONEY_PUBLIC_ENABLED ausente = OFF"
   ```
   Si aparece `MONEY_PUBLIC_ENABLED=true`, **DETENER**: el backfill puebla contratos que NO deben
   ser públicos aún. El flip es un acto humano legal de Phase 73 — ni este runbook ni el operador
   lo flipean durante el backfill.

4. **`.env` tiene las credenciales necesarias** (verificar SOLO nombres, NUNCA loguear valores):
   - Ticket LIVE (paso 1+2 REST): `MERCADOPUBLICO_TICKET` (secreto de operador; NUNCA en argv).
   - Etapa 1 (R2 crudo): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`.
     Sin `R2_ACCESS_KEY_ID`+`R2_ENDPOINT_URL` la Etapa 1 se **omite con WARN** (degrada honesto,
     pero NO produce el crudo content-addressed ni permite `--from-r2` después).
   - Etapa 2 (write REMOTO): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`.
   - Verificación de destino / dependencia RUT-01: `SUPABASE_DB_URL`.
   ```bash
   grep -oE '^(MERCADOPUBLICO_TICKET|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_ENDPOINT_URL|R2_BUCKET|SUPABASE_API_URL|SUPABASE_SECRET_KEY)=' .env
   ```
   Deben aparecer las 7 líneas (solo los nombres, sin exponer los valores).

5. **Forma del endpoint LIVE confirmada por el probe** (opcional pero recomendado — el probe NO
   forma parte de la corrida del agente; el operador lo corre una vez para confirmar que la forma
   Zod de `model.ts` coincide con lo que devuelve el REST hoy):
   ```bash
   pnpm --filter @obs/dinero exec tsx src/live-chilecompra.probe.ts   # 1 RUT conocido, consumo mínimo de cuota
   ```
   Si la forma difiere de `model.ts`, DETENER y ajustar el modelo antes de escalar (evita cargar
   basura a PROD a escala).

---

## 2. DERIVAR EL UNIVERSO DE RUTs (`ruts.txt`)

Los RUTs a consultar salen de la maestra que RUT-01 puebla (entidades/proveedores ligados). Un
RUT por línea. **Paginar SIEMPRE** (cap 1k PostgREST — gotcha v6.1): con psql directo al REMOTO
basta un `ORDER BY` (psql corta a 1k por request vía PostgREST, no por `psql -tAc` sobre conexión
directa; aun así se ordena para reanudabilidad determinista):

```bash
psql "$SUPABASE_DB_URL" -tAc \
  "SELECT DISTINCT rut FROM entidad_tercero WHERE rut IS NOT NULL AND rut <> '' ORDER BY rut" \
  > ruts.txt

# ASSERT ruidoso: un backfill vacío es silencioso (T de la Pitfall del RESEARCH):
test "$(wc -l < ruts.txt)" -gt 0 || { echo "DETENER: ruts.txt vacío — RUT-01 no poblado"; exit 1; }
wc -l ruts.txt
```

> Si se lee vía supabase-js en vez de psql: paginar con `.order("rut").range(from, from+999)` en
> bucle hasta agotar (cap 1k PostgREST). NUNCA un `select` sin paginar.

---

## 3. PARTICIONAR PARA REANUDABLE (bajo la cuota de 10.000 requests/día)

**Costo por RUT** (ver `70-SPIKE-CUOTA-OCDS.md`): 1 request paso 1 (BuscarProveedor) + N requests
paso 2 (1 por día del rango). Para ~4 años de backfill, N puede llegar a ~1.460 días/RUT (el CLI
tiene un tope defensivo de **366 días por llamada** — `fechasEntre(maxDias=366)` en `query.ts`, así
que un rango largo se parte en varias ventanas). **Cota superior grosera:** ~6 RUTs completos/día
bajo la cuota si se barren 4 años; con **ventanas cortas** (solo días con actividad) baja mucho.

"Reanudable" NO usa un cursor persistente nuevo: se logra **particionando** el universo en lotes
`(RUTs × ventana de días)` que sumen **menos de 10.000 requests/día**, + el **hash-check en R2**
(cada envelope por-RUT es content-addressed, `If-None-Match:*`, 412=existed=éxito idempotente) que
**salta lo ya descargado**, + la **idempotencia por clave natural** del upsert (re-correr un lote =
no-op). Reanudar tras una interrupción = correr los lotes pendientes; los ya corridos no duplican.

```bash
# Partir ruts.txt en lotes de RUTs (ajustar el tamaño para que RUTs × días-por-RUT < 10k/día):
split -l 6 -d --additional-suffix=.txt ruts.txt ruts-lote-
ls ruts-lote-*.txt

# Y elegir la ventana de días del lote (paso 2). Un mes por corrida mantiene el conteo bajo:
#   días del lote = { 01012025 .. 31012025 } → pasar con --dia repetido o generar la ventana.
```

Llevar una **nota manual** de qué lote × ventana fue el último completado (el log del CLI declara
`contratos=… contratistas=… dbLoaded=… errores=… degradaciones=…` al final de cada corrida). El
límite diario obliga a repartir los lotes **en varios días** — es esperado y por diseño.

---

## 4. CORRIDA LIVE (Etapa 1 fuente→R2 + Etapa 2 R2→Supabase, lote por lote)

Para **cada** lote, en serie (NUNCA en paralelo, NUNCA ráfagas), respetando el presupuesto diario
de cuota:

```bash
pnpm --filter @obs/dinero exec tsx src/run-dinero-masivo-cli.ts \
  --ruts-file ruts-lote-00.txt \
  --dia 01012025 --dia 02012025   # … los días de la ventana del lote
```

> El `MERCADOPUBLICO_TICKET` **NUNCA** va en la línea de comando — sale de `.env`. El CLI lo lee de
> env y lo redacta en toda salida. Poner el ticket en argv lo filtraría al historial del shell y a
> los logs (T-70-10). NO hacerlo.

**ANTES de dejarlo correr, verificar el destino en el log (Pitfall 5):**

- Debe imprimir `dinero-masivo: R2Store construido de .env (Etapa 1 activa) — crudo content-addressed`.
  Si dice `[WARN] R2 no configurado … Etapa 1 omitida`, **DETENER** y arreglar `.env` (no se
  produciría el crudo ni el `--from-r2` posterior).
- Debe imprimir `dinero-masivo: writer Supabase REMOTO (<url>)` con la URL de PROD. Si dijera
  `DRY-RUN (in-memory…)` cuando esperabas escribir → falta ticket o falta DB en `.env`:
  **DETENER** y arreglar antes de asumir que cargaste.

**Reglas LOCKED durante la corrida:**
- **Rate-limit 2-3s por host**, serial. El `Fetcher`+`HostRateLimiter` ya lo imponen; NO meter
  `Promise.all`, NO bajar el delay (T-70-09: abuso → suspensión/bloqueo del ticket).
- **Dos etapas SIEMPRE:** cada RUT persiste su envelope crudo en R2 (content-addressed,
  `If-None-Match:*`, 412=existed=idempotente) **ANTES** de que la Etapa 2 escriba a Supabase. Un
  `putImmutable` no-412 que falla **gatea** la Etapa 2 de ese RUT (fail-closed, T-70-02).
- **Presupuesto de cuota:** llevar la cuenta de requests del día (≈ Σ RUTs × días-por-RUT del lote).
  Al acercarse a 10.000, **parar** y reanudar al día siguiente. NUNCA "empujar" sobre la cuota.
- Correr **un lote a la vez**; esperar a que termine antes de lanzar el siguiente.

Repetir para `ruts-lote-01.txt`, `-02.txt`, … repartidos en los días necesarios hasta agotar.

---

## 5. REPLAY ETAPA 2 (`--from-r2`) — sin re-tocar la fuente

Si un lote persistió el crudo en R2 (Etapa 1 OK) pero falló en la Etapa 2 (parse/DB — p.ej. un
error de conexión a Supabase), re-ejecutar **solo la Etapa 2** desde R2, SIN volver a golpear el
REST **ni consumir cuota**:

```bash
pnpm --filter @obs/dinero exec tsx src/run-dinero-masivo-cli.ts \
  --from-r2 dinero/<rut>/<fecha>/<sha>.json
```

- `--from-r2` requiere R2 configurado en `.env` (si no, el CLI lanza `DineroMasivoArgsError` y
  aborta — por diseño). NO exige `MERCADOPUBLICO_TICKET` (no toca la fuente).
- Lee el envelope crudo de R2 (`{ rut, buscarProveedor, ordenes: {[dia]} }`) y **deriva la tarea**
  del envelope (rut + `Object.keys(ordenes)`), montando un conector fake (0 fetch). Ideal para
  re-cargar Supabase tras un fallo de DB sin re-gastar cuota.

---

## 6. REPORTE DE COBERTURA + FRESHNESS

Tras las corridas con writer REAL (no dry-run), consolidar:

1. **Conteos** (agregados → sin cap 1k), contra la DB REMOTA:
   ```sql
   select count(*) as contratos            from contrato;
   select count(distinct rut) as contratistas from entidad_tercero where rut is not null;
   -- Degradaciones/cuarentena: revisar los conteos que imprime el CLI por lote.
   ```

2. **Freshness** — re-correr y confirmar que la señal ChileCompra deja de ser STALE:
   ```bash
   pnpm freshness
   ```
   Antes del backfill la fila `chilecompra` reporta `n/d … STALE` (`ingestado_hasta` null → sin
   barrido). Tras el backfill, `contratos_ingesta_estado.ingestado_hasta` avanza a una fecha real
   y la fila pasa a mostrar un `ingestado_hasta` concreto dentro del umbral de 30d. Esa transición
   `STALE → fresco` es la evidencia de cobertura (marcador de barrido, NO conteo de contratos: un
   RUT barrido sin contratos también avanza el marcador — espejo de `lobby-leylobby`).

---

## 7. CRITERIOS DE CIERRE + ROLLBACK + SEGURIDAD

### Criterios de cierre
Todos deben cumplirse para declarar el backfill hecho:

- [ ] RUT-01 (Phase 69) aplicado y `ruts.txt` no vacío (universo real derivado).
- [ ] Todos los lotes (`ruts-lote-*.txt` × sus ventanas de día) corridos LIVE sin errores pendientes.
- [ ] Cobertura declarada: N contratos / K contratistas (números concretos).
- [ ] Crudo por-RUT presente en R2 (envelopes content-addressed `dinero/<rut>/<fecha>/<sha>.json`).
- [ ] `pnpm freshness` muestra la fila `chilecompra` con un `ingestado_hasta` real (ya no STALE).
- [ ] Ningún lote quedó a medias (si alguno falló en Etapa 2, se resolvió por `--from-r2`).
- [ ] `MONEY_PUBLIC_ENABLED` sigue **OFF** — los contratos están en DB pero NO públicos (flip = Phase 73).

**Señal de reanudación / cierre para el checkpoint del Plan:** el operador reporta
`"runbook entregado"` (dejando el crawl LIVE como deuda operador-LOCAL, igual que Phases 66/67), o
`"backfill hecho"` con la cobertura N/K, o describe ajustes al runbook.

### ROLLBACK / SEGURIDAD ante fallos de red (WAF 429 / cuota agotada / 5xx)
- **429 / cuota-exhausted:** parar el lote en curso. Lo ya persistido en R2 (Etapa 1) **no se
  pierde**: reanudar la Etapa 2 con `--from-r2` para lo persistido, y **retomar los RUTs faltantes
  AL DÍA SIGUIENTE** cuando la cuota diaria se reinicie. La cuota de 10.000/día **no es modificable**
  (ver SPIKE) → la única salida es esperar el reset diario. NUNCA pedir un ticket paralelo para
  esquivar la cuota (riesgo de bloqueo permanente).
- **5xx sostenido del WAF:** backoff (el `Fetcher`/`HostRateLimiter` lo aplican); si degrada de
  forma sostenida, DETENER el lote y reanudar cuando el WAF se estabilice.
- **Reanudar tras interrupción:** re-correr los lotes pendientes. El hash-check en R2 + la
  idempotencia por clave natural hacen no-op lo ya hecho — sin duplicación.
- **NUNCA** aumentar la concurrencia ni bajar el rate-limit para "ir más rápido" (DoS auto-infligido,
  T-70-09). Serial + 2-3s es LOCKED.
- **operador-LOCAL, NO GitHub Actions:** el backfill masivo corre en la máquina del operador (regla
  LOCKED). Correrlo en CI quema minutos, arriesga ráfagas + fuga del ticket en logs de CI.

### SEGURIDAD DE CREDENCIALES
Este runbook referencia SOLO **nombres** de variables de entorno (`MERCADOPUBLICO_TICKET`,
`R2_ACCESS_KEY_ID`, `SUPABASE_SECRET_KEY`, …), NUNCA valores. El `MERCADOPUBLICO_TICKET` va SOLO en
`.env`, **jamás en argv/línea de comando** (evita el historial del shell y los logs, T-70-10); el
CLI lo redacta en toda salida vía `redactarTicket` (URLs con `&ticket=` salen como `ticket=***`).
Las credenciales R2/Supabase viven SOLO en `.env`. El write NO cambia `MONEY_PUBLIC_ENABLED`: los
contratos quedan en DB, privados, hasta el flip legal humano de Phase 73 (T-70-11).
