---
phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre
plan: 02
tipo: runbook-operador-LOCAL
requirements: [VOTO-01]
locked:
  - "Backfill masivo = LOCAL operador, NO GitHub Actions (minimizar minutos CI)"
  - "Rate-limit 2-3s/host, UA identificatorio, serial, NUNCA ráfagas (WAF gubernamental)"
  - "Dos etapas: fuente→R2 (crudo inmutable) SIEMPRE antes de R2→Supabase"
  - "Senado por NOMBRE → probable/no_confirmado; determinista único = confirmado (D-A1); nunca FK ambiguo"
entry_point: packages/votos/src/run-votos-masivo-cli.ts
---

# 67 — BACKFILL RUNBOOK (operador-LOCAL): voto individual del Senado a escala

> **QUIÉN CORRE ESTO:** el operador, en su máquina LOCAL. **NO** el agente, **NO** GitHub Actions.
> **POR QUÉ LOCAL:** el backfill golpea el WAF gubernamental `tramitacion.senado.cl`
> (`wspublico/votaciones.php`) a escala (rate-limit 2-3s LOCKED) y escribe a la Supabase
> **REMOTA (PROD)**. Ambas cosas son operador-LOCAL por regla LOCKED
> (CLAUDE.md "Ingesta y Cron — LOCKED"). El agente que produjo este runbook NO invocó
> `VOTOS_LIVE=1`, NO tocó el WAF y NO escribió a PROD.
>
> **NOTA CI:** correr esto en GitHub Actions está PROHIBIDO — quema minutos y arriesga
> ráfagas contra el WAF + escritura accidental a PROD desde CI (T-67-04, T-67-05).

El wire de dos etapas del Senado ya está implementado y probado offline (Plan 67-01):
el envelope R2 de la Etapa 1 ahora carga **`votXmlSenado`** (el crudo de `votaciones.php`),
el `senadoFake.fetchVotaciones()` del modo `--from-r2` lo sirve, y `mapSeleccion` **falla
ruidoso** ante un token `<SELECCION>` desconocido (aparece en `errores`, NO se pierde el
voto en silencio). Este runbook es el acto deliberado del operador que consume ese wire.

**Flags reales del CLI** (verbatim de `packages/votos/src/run-votos-masivo-cli.ts`):

```
tsx packages/votos/src/run-votos-masivo-cli.ts [--dry-run] [--limit N] [--boletines-file <ruta>] [--from-r2 <r2Path>]
```

- Sin `--dry-run` y con `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY` en `.env` → writer = `SupabaseTramitacionWriter` → **REMOTO (PROD)**.
- `--boletines-file <ruta>`: un boletín por línea (vía robusta; el descubrimiento por sesión da 0 — Pitfall 1). El mismo CLI cubre el path Senado (`buildSenadoConnector()` ya está threadeado).
- `--limit N`: acota el número de boletines (default 1000; entero > 0 o el CLI lanza — WR-04).
- `--from-r2 <r2Path>`: re-ejecuta la Etapa 2 desde R2 **sin tocar la fuente**. Con 67-01, ahora **reconstruye los votos del Senado** (antes los descartaba).
- Idempotente por `(votacion_id, fuente_voter_id)` con `fuente_voter_id = seq:<n>`: re-correr = no-op de upsert.

> **El Senado no tiene DIPID.** El voto individual del Senado se reconcilia por **NOMBRE**
> vía `reconciliar-senado.ts` (D-A1): match determinista único → `confirmado`; ambiguo /
> homónimo / ausente en la maestra → `probable` / `no_confirmado`, con `parlamentario_id`
> NULL. **Nunca** se vincula a la ficha por match ambiguo (guarda LOCKED IDENT-12).

---

## 1. PRE-CHECKS OBLIGATORIOS (todos offline, antes de cualquier corrida LIVE)

Ejecutar en orden. Si alguno falla, **DETENER** — no correr el backfill.

1. **Suite Senado verde** (wire dos-etapas + fail-loud, Plan 67-01):
   ```bash
   pnpm --filter @obs/votos test run-camara-votos
   pnpm --filter @obs/tramitacion test parse-senado-votacion
   pnpm --filter @obs/votos typecheck
   pnpm --filter @obs/tramitacion typecheck
   ```
   Esperado (67-01): `@obs/tramitacion` 150 pass (17 files), `@obs/votos` 31 pass (3 files),
   `tsc -b` verde en ambos. Los tests clave: replay Senado reconstruye `seq:<n>` sin fetch
   (`votXmlSenado`), D-A1 ambos lados (único→confirmado / ausente→no_confirmado), token
   `<SELECCION>` desconocido → throw con el token crudo. Si están rojos, el path Senado está
   roto → NO continuar.

2. **La DB REMOTA destino tiene la migración 0019 aplicada** — el CHECK de `voto.seleccion`
   debe incluir `'ausente'`. Verificar contra la DB REMOTA (usar `SUPABASE_DB_URL` de `.env`,
   que apunta al REMOTO):
   ```bash
   psql "$SUPABASE_DB_URL" -c "\d voto"
   ```
   El `Check constraints` de `voto_seleccion_check` DEBE listar `'ausente'` junto a
   `si,no,abstencion,pareo`. Si NO lo incluye → aplicar 0019 a la DB REMOTA ANTES del backfill
   (un voto `ausente` del Senado abortaría el upsert con
   `new row violates check constraint "voto_seleccion_check"`).

3. **`.env` tiene las credenciales necesarias** (verificar SOLO nombres, NUNCA loguear valores):
   - Etapa 1 (R2 crudo): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`.
     Sin `R2_ACCESS_KEY_ID`+`R2_ENDPOINT_URL` la Etapa 1 se **omite con WARN** (degrada honesto,
     pero NO persiste el crudo `votaciones.php` ni permite `--from-r2` después — el envelope
     `votXmlSenado` no se escribe y el replay reconstruiría 0 votos Senado).
   - Etapa 2 (write REMOTO): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`.
   - Verificación de destino: `SUPABASE_DB_URL` (para el `\d voto` del punto 2).
   ```bash
   grep -oE '^(R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_ENDPOINT_URL|R2_BUCKET|SUPABASE_API_URL|SUPABASE_SECRET_KEY)=' .env
   ```
   Deben aparecer las 6 líneas (solo los nombres, sin exponer los valores).

4. **Endpoint Senado alcanzable.** Un `--dry-run` acotado contra 1-2 boletines Senado con
   votaciones conocidas confirma fetch+parse sin escribir a DB (sirve también como semilla del
   SPIKE de tokens del §2):
   ```bash
   VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts --dry-run --boletines-file <(echo 18296)
   ```
   > El Senado se consulta con el boletín **BASE sin sufijo** (`18296`, no `18296-05`);
   > `runIngest` ya aplica `baseDe(boletinFull)`. En `--dry-run` NO se escribe a PROD.

---

## 2. SPIKE LIVE GATED — fijar los tokens `<SELECCION>` del Senado (A4 / Open Q2)

Los tokens exactos que `votaciones.php` emite en `<SELECCION>` NO fueron confirmados LIVE
(A4). `mapSeleccion` matchea por prefijo (`si|sí|no|abst|pareo`); si el Senado emite un token
distinto (p.ej. `"A FAVOR"`, `"EN CONTRA"`, un código numérico), con el **fail-loud de 67-01**
ese token **LANZA con el token crudo exacto** y queda registrado en `errores` (etapa
`senado-votaciones`) — **NO se pierde el voto en silencio**. Hay que fijarlo ANTES del masivo.

Procedimiento (operador, gated, sin write PROD):

1. Correr el `--dry-run` del §1.4 contra 1-2 boletines Senado con votaciones nominales conocidas.
2. La Etapa 1 (si R2 configurado) persiste el crudo `votaciones.php` en R2 (`votXmlSenado`
   dentro del envelope). Capturar ese XML e **INSPECCIONAR los tokens `<SELECCION>` reales**.
3. **Si el log/`errores` registra un token desconocido** (fail-loud de 67-01): NO ignorarlo.
   Mapearlo en `mapSeleccion` (`packages/tramitacion/src/parse-senado-votacion.ts`) y fijarlo
   con un **test de fixture** ANTES del backfill masivo. Nunca degradar a "abstención" ni
   descartar el voto — es una mentira de cobertura.
4. Repetir hasta que un `--dry-run` sobre la muestra corra con `errores=0` de tokens
   `<SELECCION>`. Solo entonces proceder al masivo.

> Con el fail-loud, un token nuevo es **RUIDOSO** (visible en `errores`), no silencioso. El
> SPIKE convierte ese ruido en un fixture fijado — el masivo no pierde votos por un token
> inesperado.

---

## 3. DERIVAR EL ARCHIVO DE BOLETINES SENADO (`boletines-senado.txt`)

El descubrimiento por sesión suele dar 0 → SIEMPRE derivar los boletines de los proyectos ya
trackeados en la DB REMOTA. Un boletín por línea. El Senado usa el boletín BASE.

```bash
# PostgREST/psql corta a 1k filas por request → paginar SIEMPRE con ORDER + LIMIT/OFFSET
# (o .order().range() vía supabase-js). Aquí vía psql directo al REMOTO:
psql "$SUPABASE_DB_URL" -tAc \
  "SELECT boletin FROM proyecto WHERE boletin IS NOT NULL ORDER BY boletin" \
  > boletines-senado.txt

# ASSERT que hay boletines (un backfill vacío es silencioso):
test "$(wc -l < boletines-senado.txt)" -gt 0 || { echo "DETENER: boletines-senado.txt vacío"; exit 1; }
wc -l boletines-senado.txt
```

> Si se lee vía supabase-js en vez de psql: paginar con `.order("boletin").range(from, from+999)`
> en bucle hasta agotar (cap 1k PostgREST — gotcha v6.1). NUNCA un `select` sin paginar.
> No hace falta despojar el sufijo aquí: `runIngest` normaliza con `baseDe()` antes de golpear
> el Senado.

---

## 4. PARTICIONAR PARA REANUDABLE

"Reanudable" NO usa un cursor persistente nuevo: se logra **particionando**
`boletines-senado.txt` en lotes + la **idempotencia por clave natural**
(`votacion_id, fuente_voter_id` con `fuente_voter_id = seq:<n>`). Re-correr un lote ya cargado
es un **no-op de upsert**. Dos homónimos NO colapsan porque el discriminador es `seq:<n>` por
posición en la votación (CR-02), no el nombre.

```bash
# Lotes de 200 boletines: boletines-senado-lote-aa.txt, -ab.txt, ...
split -l 200 -d --additional-suffix=.txt boletines-senado.txt boletines-senado-lote-
ls boletines-senado-lote-*.txt
```

Llevar una nota manual de qué lote fue el último completado (el log del CLI declara
`votaciones=… votos=… dbLoaded=… errores=…` al final de cada corrida).

---

## 5. CORRIDA LIVE (Etapa 1 fuente→R2 + Etapa 2 R2→Supabase, lote por lote)

Para **cada** lote, en serie (NUNCA en paralelo, NUNCA ráfagas):

```bash
VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts \
  --boletines-file boletines-senado-lote-aa.txt
```

**ANTES de dejarlo correr, verificar el destino en el log (Pitfall 5):**

- Debe imprimir `votos-masivo: R2Store construido de .env (Etapa 1 activa)` — si dice
  `[WARN] R2 no configurado … Etapa 1 omitida`, DETENER y arreglar `.env` (sin la Etapa 1 no
  se persiste `votXmlSenado` → no habrá replay `--from-r2` del Senado).
- Debe imprimir `votos-masivo: writer Supabase REMOTO (<url>)` con la URL de PROD. Si dijera
  `LOCAL (127.0.0.1…)` u otra URL inesperada → **DETENER**: estarías escribiendo a la DB
  equivocada. El CLI lee `SUPABASE_API_URL` del `.env` (= REMOTO), pero verificar siempre
  antes de escribir.

**Reglas LOCKED durante la corrida:**
- **Rate-limit 2-3s por host**, serial. El `Fetcher`+`HostRateLimiter` ya lo imponen; NO
  meter `Promise.all`, NO bajar el delay. `tramitacion.senado.cl` tiene WAF — ráfaga = ban.
- **Dos etapas SIEMPRE:** cada boletín persiste su crudo `votaciones.php` en R2
  (content-addressed, `If-None-Match:*`, 412=existed=éxito idempotente) dentro del envelope
  `tramitacion/<boletin>/…` con el campo `votXmlSenado` (67-01), ANTES de que la Etapa 2
  escriba a Supabase.
- Correr **un lote a la vez**; esperar a que termine antes de lanzar el siguiente.

Efecto en la DB: cada votación Senado gana una fila `votacion` (`id='senado:...'`) y filas
`voto` con `fuente_voter_id=seq:<n>`, `mencion_nombre`, `seleccion`, `estado_vinculo`, y
`parlamentario_id` NULL salvo match determinista único. Repetir para
`boletines-senado-lote-ab.txt`, `-ac.txt`, … hasta agotar los lotes.

---

## 6. REPLAY ETAPA 2 (`--from-r2`) — sin re-tocar la fuente

Si un lote persistió el crudo en R2 (Etapa 1 OK) pero falló en la Etapa 2 (parse/DB — p.ej.
error de conexión a Supabase, o se aplicó 0019 tarde), re-ejecutar **solo la Etapa 2** desde
R2, SIN volver a golpear el WAF:

```bash
VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts \
  --from-r2 <r2Path-del-envelope>
```

- `--from-r2` requiere R2 configurado en `.env` (si no, el CLI lanza y aborta — por diseño).
- Lee el envelope crudo de R2 y monta conectores fake (0 fetch a la fuente).
- **Con 67-01, el `senadoFake.fetchVotaciones()` sirve `envelope.votXmlSenado`** → el replay
  RECONSTRUYE los votos del Senado (antes devolvía `""` y descartaba 0 votos).
- Retro-compat: un envelope viejo (P66) sin `votXmlSenado` no rompe el replay — reconstruye 0
  votos Senado sin lanzar (`?? ""`). Si un envelope Senado da 0 votos en replay, verificar que
  fue escrito por una corrida ≥67-01.

---

## 7. REPORTE DE COBERTURA SENADO (SC#4) — por `porEstado`, SIN el invariante DIPID-maestra

Tras una corrida con writer REAL (no dry-run), el CLI imprime automáticamente:

```
votos-masivo cobertura: {"porEstado":{...},"dipidsMaestraNoConfirmados":N}
```

- `porEstado`: conteo por `estado_vinculo` (head+count, sin materializar filas → sin cap 1k).
  **Esta es la métrica de cobertura del Senado** (Open Q3): `confirmado` / `probable` /
  `no_confirmado`.
- **`dipidsMaestraNoConfirmados` es Cámara-ONLY** — cuenta DIPIDs de la maestra vigente de
  diputados. **El Senado NO tiene DIPID**, así que NO se aplica ese invariante a las filas
  Senado. No forzarlo: colapsaría (Open Q3). Para el Senado, la disciplina de cierre es SC#4
  (abajo), no el invariante DIPID.

**Consolidación tras todos los lotes (query contra la DB REMOTA, agregada → sin cap 1k):**

```sql
-- Cobertura Senado por estado (filtrar votaciones Senado por el prefijo de id):
select estado_vinculo, count(*) as n
from voto v
join votacion vt on vt.id = v.votacion_id
where vt.id like 'senado:%'
group by estado_vinculo
order by estado_vinculo;
```

**SC#4 — disciplina de atribución (invariante Senado):**
- **Solo `confirmado` puebla `parlamentario_id`.** `probable` / `no_confirmado` DEBEN tener
  `parlamentario_id` NULL — nunca se presentan como votos atribuidos a un parlamentario.
- **D-A1 (LEGÍTIMO, no fabricación):** un match determinista único → `confirmado` es paridad
  Cámara (VOTO-03), NO una invención. Lo que está prohibido es `confirmado` por match
  **ambiguo** (homónimo). Verificar:

```sql
-- SC#4: NINGÚN voto Senado no-confirmado tiene FK a la ficha → DEBE ser 0:
select count(*) as senado_no_confirmado_con_fk
from voto v
join votacion vt on vt.id = v.votacion_id
where vt.id like 'senado:%'
  and v.estado_vinculo <> 'confirmado'
  and v.parlamentario_id is not null;
```

**Si `senado_no_confirmado_con_fk > 0` → BUG de atribución: DETENER el cierre**, investigar
`reconciliar-senado.ts` (debe estar intacto — `git diff` vacío por D-A1). No declarar el
backfill completo.

---

## 8. CRITERIOS DE CIERRE + SEÑAL DE REANUDACIÓN

Todos deben cumplirse para declarar el backfill Senado hecho:

- [ ] SPIKE de tokens `<SELECCION>` cerrado: `--dry-run` sobre la muestra corre con 0 tokens
      desconocidos en `errores` (o los nuevos quedaron fijados con fixture + test).
- [ ] Todos los lotes (`boletines-senado-lote-*.txt`) corridos LIVE sin errores pendientes.
- [ ] Cobertura Senado declarada por `porEstado`: N confirmado / M probable / K no_confirmado
      (números concretos).
- [ ] SC#4 verificado: `senado_no_confirmado_con_fk === 0` (solo `confirmado` atribuido).
- [ ] Crudo `votaciones.php` presente en R2 dentro del envelope `tramitacion/<boletin>/…`
      (campo `votXmlSenado`), reconstruible por `--from-r2`.
- [ ] Ningún lote quedó a medias (si alguno falló en Etapa 2, se resolvió por `--from-r2`).

**Señal de reanudación / cierre para el checkpoint del Plan:** el operador reporta
`"backfill Senado hecho"` con la cobertura por estado (N confirmado / M probable / K
no_confirmado) y confirma que los tokens `<SELECCION>` LIVE quedaron fijados (o describe
cualquier token nuevo detectado por el fail-loud). Alternativamente, `"diferir backfill"` para
cerrar la fase con el código + runbook listos y la corrida LIVE pendiente.

---

## ROLLBACK / SEGURIDAD ante fallos de red (WAF 429/5xx)

- **429 / 5xx del WAF:** el `Fetcher`/`HostRateLimiter` aplican backoff; si `tramitacion.senado.cl`
  empieza a degradar de forma sostenida, **DETENER el lote en curso**. Lo ya persistido en R2
  (Etapa 1) no se pierde: reanudar la Etapa 2 con `--from-r2` para lo persistido (ahora
  reconstruye votos Senado), y re-lanzar los boletines faltantes en un lote nuevo cuando el WAF
  se estabilice.
- **Reanudar tras interrupción:** re-correr los lotes pendientes. La idempotencia por
  `(votacion_id, fuente_voter_id)` (con `seq:<n>`) hace no-op los boletines ya cargados — sin
  duplicación.
- **NUNCA** aumentar la concurrencia ni bajar el rate-limit para "ir más rápido": eso provoca
  el ban del WAF (DoS, T-67-04). Serial + 2-3s es LOCKED.
- **Escritura a PROD:** el destino REMOTO se verifica en el log ANTES de escribir (Pitfall 5).
  Si el log no dice `REMOTO (<url PROD>)`, no dejar correr.
- **Operador-LOCAL, NO GitHub Actions:** correr en CI está PROHIBIDO (quema minutos + arriesga
  ráfagas y write PROD accidental desde CI — T-67-04/T-67-05).

## SEGURIDAD DE CREDENCIALES

Este runbook referencia SOLO **nombres** de variables de entorno (`R2_ACCESS_KEY_ID`,
`SUPABASE_SECRET_KEY`, …), NUNCA valores. El CLI loguea la URL de destino + conteos, jamás la
service key ni filas (T-67-07). Los votos del Senado NO tocan RUT/PII: solo nombre público
(`mencion_nombre`) + selección pública. El match a la ficha es determinista único
(`confirmado`); un match ambiguo NUNCA vincula a un parlamentario real.
