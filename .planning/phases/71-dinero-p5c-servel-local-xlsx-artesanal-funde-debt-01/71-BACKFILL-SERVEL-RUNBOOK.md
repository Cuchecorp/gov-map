---
phase: 71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01
plan: 03
tipo: runbook-operador-LOCAL
requirements: [MONEY-02, DEBT-01]
locked:
  - "Backfill SERVEL = LOCAL operador POR ELECCIÓN, NO GitHub Actions, NO cron (SERVEL no tiene feed estable)"
  - "Etapa 1 (colocar el .xlsx en R2 content-addressed) = ACTO HUMANO — SERVEL se descarga a mano, no hay API amable"
  - "Dos etapas: .xlsx→R2 (crudo inmutable) SIEMPRE antes de R2→Supabase; la Etapa 2 lee de R2, NUNCA de la fuente"
  - "Cruce candidato→parlamentario por NOMBRE determinista — SERVEL NO trae RUT; RUT-01 NO es prerrequisito de SERVEL"
  - "MONEY_PUBLIC_ENABLED se queda OFF — los aportes aterrizan en DB pero NO se presentan públicamente hasta el flip legal de Phase 73"
entry_point: packages/dinero/src/run-servel-local-cli.ts
---

# 71 — BACKFILL RUNBOOK (operador-LOCAL): financiamiento electoral SERVEL por elección

> **QUIÉN CORRE ESTO:** el operador, en su máquina LOCAL, **por elección**. **NO** el agente,
> **NO** GitHub Actions, **NO** un cron.
> **POR QUÉ LOCAL Y POR ELECCIÓN:** SERVEL **no publica un feed estable ni una API amable** — el
> crudo de financiamiento electoral es un `.xlsx` que se descarga **a mano** desde el portal de
> SERVEL, una elección a la vez. No hay barrido incremental que automatizar: cada elección es un
> acto humano puntual (obtener el archivo, colocarlo en R2, re-correr la Etapa 2). El agente que
> produjo este runbook **NO obtuvo/colocó ningún `.xlsx` real, NO tocó la fuente SERVEL, NO escribió
> a PROD y NO cambió `MONEY_PUBLIC_ENABLED`**.
>
> **NOTA CI:** correr esto en GitHub Actions está PROHIBIDO — SERVEL es toil manual por elección
> (no hay nada recurrente que schedulear), y CI quemaría minutos sin ganancia. Por eso **NO existe
> `servel-weekly.yml`** (y no debe crearse): la señal freshness `servel` reporta GH `n/d` honesto.

El wire de dos etapas de SERVEL ya está implementado y probado offline (Plan 71-01 + 71-02):
`runIngestServel` escribe PRIMERO los BYTES del `.xlsx` content-addressed a R2 (Etapa 1) y LUEGO
parsea/upsert (Etapa 2), con un modo LOCAL `--from-r2` que lee el `.xlsx` que el operador colocó
en R2 **sin tocar la fuente**. El CLI de operador (`run-servel-local-cli.ts`, Plan 71-02) construye
un `R2Store` real de `.env R2_*` y threadea ese modo LOCAL a `runIngestServel`. La señal freshness
`servel` (Plan 71-02) mide `aportes_ingesta_estado.ingestado_hasta`. Este runbook es el acto
deliberado del operador que consume ese wire.

**Diferencia dura con ChileCompra (Phase 70):** ChileCompra depende de **RUT-01** (universo de RUTs)
y de un **ticket con cuota** (10.000/día). **SERVEL no depende de ninguno de los dos**: el enlace
candidato→parlamentario es por **NOMBRE determinista** (SERVEL **NO trae RUT**), la fuente es un
GET/descarga anónima **sin ticket secreto**, y no hay cuota diaria. Por eso este runbook es más
simple — pero MONEY_PUBLIC_ENABLED sigue OFF igual (el gate legal es común, Phase 73).

**Flags reales del CLI** (verbatim de `packages/dinero/src/run-servel-local-cli.ts`):

```
tsx packages/dinero/src/run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path> [--anio YYYY] [--dry-run]
```

- `--eleccion <slug>` (**obligatorio**): identificador de la elección (entra en la clave del crudo LOCAL y en el `eleccion` visible por dato).
- `--r2-path <r2Path>` / `--from-r2 <r2Path>` (**obligatorio**, alias equivalentes): el `r2Path` del `.xlsx` que el operador colocó en R2 (modo LOCAL). Lee de R2, **0 fetch a la fuente**.
- `--anio YYYY` (opcional, 4 dígitos): año de la elección/corte para la ficha visible.
- `--dry-run`: writer InMemory, no escribe DB.
- Sin `--dry-run` y con `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY` en `.env` → writer = `SupabaseServelWriter` → **REMOTO (PROD)**.
- Sin DB en `.env` (o con `--dry-run`) → cae a **DRY-RUN InMemory** (NUNCA fabrica).
- `--r2-path`/`--from-r2` **exige R2 configurado** en `.env` (`R2_ACCESS_KEY_ID`+`R2_ENDPOINT_URL`); si falta, el CLI lanza `ServelLocalArgsError` y aborta ANTES de red/DB — por diseño.
- **A diferencia de ChileCompra NO hay ticket secreto** → no hay `redactarTicket`; SERVEL es GET anónimo.
- Idempotente por clave natural + hash-check R2 (`If-None-Match:*`, 412=existed=éxito): re-correr una elección ya cargada = no-op.

---

## 1. PRE-CHECKS OBLIGATORIOS (todos offline, antes de cualquier corrida)

Ejecutar en orden. Si alguno falla, **DETENER** — no correr el backfill.

1. **Suite offline del wire SERVEL verde** (Plan 71-01 + 71-02):
   ```bash
   pnpm --filter @obs/dinero test
   pnpm --filter @obs/dinero typecheck
   pnpm --filter @obs/freshness test
   ```
   Esperado: dinero **167 pass** (wire + CLI LOCAL + servel-frozen-guard + guards) + typecheck verde;
   freshness **37 pass** (incl. 6 casos servel). Si el `servel-frozen-guard` MUERDE (rojo), alguna de
   las 4 firmas LOCKED cambió (cruce por NOMBRE / `monto` string VERBATIM+`rutDonante` NULLABLE / gate
   de header `HEADER_ROW=4` / tabla `0024`) → **NO continuar** (un cambio ahí podría escribir un cruce
   por RUT falso o atribuir un aporte por nombre no-determinista).

2. **`MONEY_PUBLIC_ENABLED` NO seteado = OFF** (los aportes NO se presentan públicamente hasta el
   flip legal de Phase 73):
   ```bash
   grep -E '^MONEY_PUBLIC_ENABLED=' .env || echo "OK: MONEY_PUBLIC_ENABLED ausente = OFF"
   ```
   Si aparece `MONEY_PUBLIC_ENABLED=true`, **DETENER**: el backfill puebla aportes que NO deben ser
   públicos aún. El flip es un acto humano legal de Phase 73 — ni este runbook ni el operador lo
   flipean durante el backfill (T-71-10).

3. **`.env` tiene las credenciales necesarias** (verificar SOLO nombres, NUNCA loguear valores):
   - Etapa 1+2 (R2 crudo, LEE los bytes del `.xlsx`): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`.
     Sin `R2_ACCESS_KEY_ID`+`R2_ENDPOINT_URL` el CLI lanza `ServelLocalArgsError` (no hay de dónde leer el `.xlsx`).
   - Etapa 2 (write REMOTO): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`. Sin ellas → DRY-RUN InMemory.
   ```bash
   grep -oE '^(R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_ENDPOINT_URL|R2_BUCKET|SUPABASE_API_URL|SUPABASE_SECRET_KEY)=' .env
   ```
   Deben aparecer las 6 líneas (solo los nombres, sin exponer los valores).

4. **NO se requiere RUT-01.** A diferencia de ChileCompra, SERVEL **NO trae RUT** → el cruce
   candidato→parlamentario es por **NOMBRE determinista** (`reconciliar-aporte.ts`). RUT-01 (Phase 69)
   **NO es prerrequisito de SERVEL**. No derives un universo de RUTs, no cruces por RUT: el `.xlsx` de
   SERVEL trae nombres de candidatos y montos, y el pipeline enlaza por nombre (solo confirma en
   determinista; el resto queda `parlamentario_id NULL` en `no_confirmado`) — T-71-12.

---

## 2. ETAPA 1 — OBTENER + COLOCAR EL `.xlsx` EN R2 (acto humano, POR ELECCIÓN)

SERVEL no tiene feed: el crudo lo obtiene el operador a mano, una elección a la vez.

1. **Obtener el `.xlsx`** de financiamiento electoral de UNA elección desde el portal de SERVEL
   (descarga manual puntual — **respetando la fuente**: es una descarga puntual, NO una ráfaga; no
   hay cron ni scraping automatizado de SERVEL). Una elección = un `.xlsx`.

2. **Fijar la fecha de corte + la elección** ANTES de ingerir. Cada dato quedará etiquetado con
   `eleccion` (el slug) + `fecha_corte` (la fecha del `.xlsx`/elección). El operador **confirma
   ambas** para que el archivo viejo NUNCA se presente como vigente: la ficha mostrará
   "Financiamiento de la elección `<slug>` (corte `YYYY-MM-DD`)". Elegir un `--eleccion <slug>`
   estable y descriptivo (p.ej. `presidencial-2021`, `parlamentaria-2021-diputados`).

3. **Colocar el `.xlsx` en R2 content-addressed** bajo la clave:
   ```
   servel/<eleccion>/<fecha_corte>/<sha256(bytes)>.xlsx
   ```
   (verbatim del wire: `putImmutable("servel", tarea.eleccion, fechaCorte, sha256(bytes), "xlsx", bytes)`
   en `ingest-run-servel.ts`). Usar PUT `If-None-Match: *`: un **412** = ya existía = **éxito
   idempotente** (no re-subir). El `r2Path` resultante es lo que se pasa a `--r2-path` en la Etapa 2.

   > En modo LOCAL la Etapa 1 la hace el operador (el crudo YA está en R2): el wire **NO re-persiste**
   > el `.xlsx` (no re-fetchea ni re-sube). Solo lo LEE con `getObject(r2Path)`.

---

## 3. ETAPA 2 — CORRER EL PIPELINE (`--from-r2`, lee de R2, 0 fetch)

Para **cada** elección, con el `.xlsx` ya colocado en R2 (Etapa 1):

```bash
pnpm --filter @obs/dinero exec tsx src/run-servel-local-cli.ts \
  --eleccion presidencial-2021 \
  --r2-path servel/presidencial-2021/2021-12-19/<sha>.xlsx \
  --anio 2021
```

**ANTES de asumir que cargaste, verificar el destino en el log:**

- Debe imprimir `servel-local: R2Store construido de .env — modo LOCAL (lee el .xlsx que el operador colocó en R2)`
  y `servel-local: destino LOCAL — lee el .xlsx de R2 (<r2Path>), 0 fetch a la fuente`.
- Debe imprimir `servel-local: writer Supabase REMOTO (<url>) — destino LOCAL (lee de R2), upsert VERSIONADO idempotente`
  con la URL de PROD. Si dijera `DRY-RUN (in-memory…)` cuando esperabas escribir → falta DB en `.env`:
  **DETENER** y arreglar antes de asumir que cargaste.

**Qué esperar en la salida** (línea final del CLI):
```
servel-local LIVE (--from-r2 <r2Path>): aportes=N donantes=D parlamentariosMarcados=M \
  dbLoaded=true cuarentena=Q errores=E degradaciones=G
```
Más, si los hay, líneas `servel-local: ERROR [...]` y `servel-local: DEGRADA [...]`.

**El fetch al blob JAMÁS ocurre:** el CLI pasa un conector que LANZA si se le toca (defensa en
profundidad) — la única fuente de bytes es `getObject(r2Path)` de R2. Repetir por cada elección que
se decida poblar.

---

## 4. FAIL-SOFT POR ELECCIÓN (una elección mala NO aborta la corrida)

El pipeline degrada **por elección**, nunca aborta la corrida completa:

- **`.xlsx` bloqueado/inaccesible (`ServelBloqueadaError`):** ESA elección se cuarentena (0 filas),
  la corrida continúa con las demás.
- **Drift de header** (el `.xlsx` no tiene las columnas esperadas en `HEADER_ROW=4` /
  `EXPECTED_HEADERS`): `parseAportes` THROW → ESA elección va a cuarentena (0 filas), la corrida
  sigue. **Causa típica:** un `.xlsx` equivocado o un layout de SERVEL distinto. **Fix:** re-obtener
  el `.xlsx` correcto, re-colocarlo en R2 (Etapa 1) y re-correr esa elección.
- **Mismatch de completitud** (bytes/anclas locales no cuadran): degrada esa elección sin abortar.

Si una elección cae en `cuarentena` o `errores`, corregir su `.xlsx` y re-correr **solo esa
elección** (`--eleccion <slug> --r2-path <nuevo r2Path>`). El resto no se re-toca (idempotente).

---

## 5. FRESCURA POR DATO + FRESHNESS

**Cada fila lleva `eleccion` + `fecha_corte` visibles** — la ficha muestra
"Financiamiento de la elección `<slug>` (corte `YYYY-MM-DD`)", de modo que un `.xlsx` de una elección
antigua NUNCA se presenta como dato vigente. La fecha de corte la fija el operador en la Etapa 1 y
viaja con cada aporte.

Tras el backfill de al menos una elección con writer REAL, re-correr freshness:
```bash
pnpm freshness
```
Antes del backfill la fila `servel` reporta `—` / `STALE` (`aportes_ingesta_estado.ingestado_hasta`
null → sin barrido). Tras el backfill, `ingestado_hasta` avanza a una fecha real y la fila sale de
"n/d"/STALE (umbral 365d — ciclos electorales bianuales/cuatrienales). Esa transición `STALE → fresco`
es la evidencia de cobertura (marcador de barrido, NO conteo de aportes: espejo de `lobby-leylobby`).
La columna GH sigue mostrando `n/d` honesto porque **`servel-weekly.yml` no existe** (LOCAL sin cron).

---

## 6. VERIFICACIÓN POST-CORRIDA

Tras las corridas con writer REAL (no dry-run), consolidar contra la DB REMOTA:

1. **Conteos** (agregados → sin cap 1k):
   ```sql
   select count(*) as aportes from aporte;
   select count(distinct donante) as donantes from aporte;   -- ajustar al nombre real de la columna
   ```
2. **Ningún aporte atribuido por nombre NO-determinista:** los aportes cuyo candidato no resolvió a
   un parlamentario determinista deben quedar con `parlamentario_id NULL` en estado `no_confirmado`
   — NUNCA con una FK adivinada por name-match laxo (T-71-12). Verificar que no haya FKs sospechosas:
   ```sql
   -- los no-confirmados deben tener parlamentario_id NULL:
   select count(*) from aporte where estado_vinculo = 'no_confirmado' and parlamentario_id is not null;
   -- esperado: 0
   ```
3. **Elecciones cuarentenadas = 0** (o re-colocar el `.xlsx` correcto y re-correr esa elección).

---

## 7. CRITERIOS DE CIERRE + ROLLBACK + SEGURIDAD

### Criterios de cierre
Todos deben cumplirse para declarar el backfill de una elección hecho:

- [ ] El `.xlsx` de la elección obtenido a mano y colocado en R2 content-addressed (`servel/<eleccion>/<fecha_corte>/<sha>.xlsx`).
- [ ] `run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path>` corrido LIVE sin errores pendientes.
- [ ] Cobertura declarada: N aportes / D donantes / M parlamentarios marcados (números concretos), por elección.
- [ ] `eleccion` + `fecha_corte` visibles por dato (ficha "Financiamiento de la elección X (corte YYYY-MM-DD)").
- [ ] Elecciones cuarentenadas = 0 (o el `.xlsx` correcto re-colocado y re-corrido).
- [ ] `pnpm freshness` muestra la fila `servel` con un `ingestado_hasta` real (ya no STALE/n/d).
- [ ] Ningún aporte `no_confirmado` con `parlamentario_id` no-NULL (cruce por NOMBRE determinista respetado).
- [ ] `MONEY_PUBLIC_ENABLED` sigue **OFF** — los aportes están en DB pero NO públicos (flip = Phase 73).

**Señal de reanudación / cierre para el checkpoint del Plan:** el operador reporta
`"runbook recibido"` (dejando el backfill LIVE como deuda operador-LOCAL, igual que Phases 66/67/70),
o `"backfill corrido"` con la cobertura N/D/M por elección, o describe ajustes al runbook.

### ROLLBACK / SEGURIDAD
- **`.xlsx` equivocado cargado:** la elección se ata a un `sha256` distinto en R2; corregir =
  colocar el `.xlsx` correcto (nuevo `r2Path`) y re-correr esa elección. El upsert idempotente por
  clave natural + `eleccion`/`fecha_corte` versionados hacen reconstruible el estado desde R2.
- **Re-ingesta desde R2:** cualquier re-carga a Supabase (error de DB, cambio de schema, re-embed)
  se hace SIEMPRE con `--from-r2` desde el crudo en R2 — **NUNCA** se vuelve a molestar a SERVEL
  (regla LOCKED de dos etapas). R2 = verdad cruda versionada; Supabase = derivado reconstruible.
- **operador-LOCAL, NO GitHub Actions:** SERVEL es toil manual por elección; correrlo en CI está
  prohibido (sin ganancia recurrente, quema minutos). No existe `servel-weekly.yml`.
- **El gate MONEY no se toca:** el write NO cambia `MONEY_PUBLIC_ENABLED` — los aportes quedan en
  DB, privados, hasta el flip legal humano de Phase 73 (sign-off dossier legal 21.719). Ni este
  runbook ni el operador flipean el gate durante el backfill (T-71-10).

### SEGURIDAD DE CREDENCIALES
Este runbook referencia SOLO **nombres** de variables de entorno (`R2_ACCESS_KEY_ID`,
`SUPABASE_SECRET_KEY`, …), NUNCA valores. Las credenciales R2/Supabase viven SOLO en `.env`. SERVEL
es GET anónimo **sin ticket** → no hay secreto de fuente que redactar. El write NO cambia
`MONEY_PUBLIC_ENABLED`.
