---
phase: 72-dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte
plan: 02
tipo: runbook-operador-LOCAL
requirements: [MONEY-03]
locked:
  - "Aplicación de DDL al remoto PROD = operador-LOCAL por `psql --db-url --single-transaction`, NUNCA `supabase db push` (drift de schema_migrations)"
  - "El agente NO aplica el DDL a PROD (patrón operador-LOCAL de 0023/0038/0039/0049): build/typecheck son falso positivo; la única prueba válida es el pgTAP contra el schema APLICADO"
  - "MONEY_PUBLIC_ENABLED se queda OFF — la señal se materializa OFF-line pero NO se presenta públicamente hasta el flip legal de Phase 73 (acto humano exclusivo)"
  - "operador-LOCAL, NO GitHub Actions (no exponer la db-url PROD en logs de CI, no quemar minutos)"
depende_de:
  - "72-01 (migración 0052 + pgTAP escritos y validados offline contra scratch DB — 7/7 ok)"
entry_point: supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql
---

# 72 — APPLY RUNBOOK (operador-LOCAL): migración 0052 al remoto PROD + verificación pgTAP

> **QUIÉN CORRE ESTO:** el operador, en su máquina LOCAL, contra la Supabase **REMOTA (PROD)**.
> **NO** el agente, **NO** GitHub Actions.
> **POR QUÉ LOCAL:** aplicar DDL controlado a PROD por `psql --db-url` es un acto de operador por
> regla LOCKED (CLAUDE.md "Ingesta y Cron — LOCKED"; patrón repetido en 0023/0038/0039/0049). El
> agente que produjo este runbook (Plan 72-01 + 72-02) NO aplicó el DDL a PROD, NO tocó
> `schema_migrations`, NO corrió `cruces.materializar_cruces()` contra PROD y NO cambió
> `MONEY_PUBLIC_ENABLED`. La única prueba de que Postgres ejecutó el DDL es el pgTAP corriendo
> contra el schema **APLICADO** — que corre el operador (build/typecheck son falso positivo de CI,
> Pitfall 5).

La migración `0052` es **ADITIVA** (Plan 72-01, validada en vivo contra scratch DB — 7/7 `ok`):
amplía el CHECK `cruce_senal.tipo_senal` de `('lobby_sector')` a
`('lobby_sector', 'lobby_sector_aporte')` y re-emite `cruces.materializar_cruces()` con la rama
`lobby_sector` **byte-idéntica** a 0039 + una nueva rama `lobby_sector_aporte` que es un **STUB
ESTRUCTURAL correcto-por-construcción** (0 filas honestas hoy). Este runbook es el acto deliberado
del operador que la aplica a PROD.

**Archivos reales de esta corrida:**

- Migración: `supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql`
- pgTAP: `supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql`

---

## 1. PRE-CHECKS OBLIGATORIOS (todos offline, antes de aplicar a PROD)

Ejecutar en orden. Si alguno falla, **DETENER** — no aplicar 0052.

1. **pgTAP verde LOCALMENTE (7/7).** El Plan 72-01 ya validó el SQL de ambos archivos en vivo
   contra una scratch DB (7/7 `ok`, `plan(7)` exacto, `rollback` limpio). Confirmar que ambos
   archivos están en disco sin cambios pendientes:
   ```bash
   git status --short supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql \
     supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql
   ```
   Esperado: sin modificaciones sin commitear (los commits `a9bdcb1` feat + `e732cf0` test).

2. **La migración es ADITIVA (verificar por lectura).** 0052 solo AÑADE `'lobby_sector_aporte'` al
   allow-list del CHECK y hace `create or replace` del proc. No dropea columnas, no borra datos
   (el `delete from public.cruce_senal;` del proc es el FULL REBUILD transaccional de 0039, ÚNICO
   delete — la señal se reconstruye desde los hechos en la misma llamada). Confirmar que 0052 NO
   añade policies ni grants (el doble candado se hereda: RLS deny-by-default de 0039 + RPC 0040 sin
   grant a anon + gate de presentación MONEY OFF):
   ```bash
   grep -Eni 'grant|create policy|alter policy' supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql \
     && echo "DETENER: 0052 no debe tocar grants/policies" || echo "OK: sin grants/policies"
   ```

3. **`MONEY_PUBLIC_ENABLED` NO seteado = OFF** (la señal se materializa OFF-line pero NO se
   presenta hasta el flip legal de Phase 73):
   ```bash
   grep -E '^MONEY_PUBLIC_ENABLED=' .env || echo "OK: MONEY_PUBLIC_ENABLED ausente = OFF"
   ```
   Si aparece `MONEY_PUBLIC_ENABLED=true`, **DETENER**: aplicar 0052 NO debe coincidir con el flip.
   El flip es el sign-off legal 21.719 de **Phase 73** (acto humano exclusivo). Este runbook NO lo
   flipea.

4. **`.env` tiene la db-url remota** (verificar SOLO el nombre, NUNCA loguear el valor):
   ```bash
   grep -oE '^SUPABASE_DB_URL=' .env || echo "DETENER: SUPABASE_DB_URL ausente en .env"
   ```
   El operador suministra `SUPABASE_DB_URL` (la connection string directa de PROD). El **BOM UTF-8**
   al inicio del `.env` rompe el CLI: extraer el valor esquivando el BOM y pasar `--db-url`
   explícito (ver §2). NUNCA loguear la db-url completa.

---

## 2. APLICACIÓN A PROD (`psql --db-url --single-transaction`)

**Comando exacto** (aplicar UNA sola vez — ver la advertencia de idempotencia abajo):

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" \
  --single-transaction \
  -f supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql
```

- **`--single-transaction`**: envuelve todo el archivo en una transacción; si el `drop constraint`
  o el `create or replace` fallan, **nada** queda a medias (fail-atomic).
- **`PGCLIENTENCODING=UTF8`**: las tildes de los comentarios y de los sectores requieren UTF-8 en
  el cliente (gotcha repetido en la ingesta con tildes).
- **`$SUPABASE_DB_URL` esquivando el BOM del `.env`**: el BOM al inicio del archivo contamina la
  primera variable si se hace `source .env` ingenuo. Extraer el valor limpio, p.ej.:
  ```bash
  export SUPABASE_DB_URL="$(grep -a '^SUPABASE_DB_URL=' .env | sed 's/^\xEF\xBB\xBF//; s/^SUPABASE_DB_URL=//')"
  ```
  y pasar la db-url **explícita** a `psql` (`--db-url` explícito, nunca dependiendo del entorno con
  BOM).

> **PROHIBIDO `supabase db push`.** El `schema_migrations` del remoto tiene **drift** (migraciones
> aplicadas por `psql` directo históricamente, no por la CLI) → `db push` re-aplicaría o saltaría
> migraciones silenciosamente. Aplicar SOLO por `psql --db-url` directo.

> **ADVERTENCIA DE IDEMPOTENCIA — aplicar UNA vez.** El **Bloque 2** (`create or replace function`)
> es idempotente: re-ejecutarlo es inofensivo. El **Bloque 1** NO es re-ejecutable: es
> `drop constraint cruce_senal_tipo_senal_check` + `add constraint …`. Si 0052 ya se aplicó, el
> segundo `drop` de un constraint inexistente **falla**. Antes de re-aplicar, confirmar el estado
> del CHECK con la consulta de precondición del constraint (§2.1) y NO re-correr el Bloque 1 a
> ciegas.

### 2.1 Precondición del constraint (verificar el nombre real ANTES del drop)

El CHECK inline sin nombre de 0039 es nombrado por convención Postgres
`cruce_senal_tipo_senal_check`. Si un **forward-fix** lo renombró, el `drop constraint` de 0052
apuntaría a un nombre inexistente y fallaría. Verificar contra el schema **aplicado** ANTES de
aplicar 0052 (Pitfall A1):

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tAc \
  "select conname from pg_constraint where conrelid = 'public.cruce_senal'::regclass and contype = 'c';"
```

- Si devuelve exactamente `cruce_senal_tipo_senal_check` → aplicar 0052 tal cual.
- Si el nombre **difiere** (un forward-fix lo renombró) → **ajustar el `drop constraint` de 0052**
  al nombre real ANTES de aplicar (editar la línea del Bloque 1), y volver a verificar el pgTAP
  offline si se editó.

---

## 3. VERIFICACIÓN — pgTAP contra el schema APLICADO

Tras aplicar 0052, correr el pgTAP **contra el mismo remoto PROD**:

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql
```

- **Esperado: todas las líneas `ok`, 0 `not ok`** (7 aserciones, `plan(7)`). El archivo corre en su
  propia transacción con `rollback` al final (siembra su propio fixture — parlamentario/lobby/
  contrato — materializa, asevera, y revierte, sin dejar residuo en PROD).
- Las 7 aserciones: (1) `cruce_senal` existe; (2) el CHECK ampliado admite `lobby_sector_aporte`
  (insert directo NO viola 23514); (3) **ASERTO RECTOR** — la rama `lobby_sector_aporte` rinde
  **0 filas materializadas** (empty-honest correcto-por-construcción) AUNQUE haya un contrato
  confirmado sembrado; (4) la señal `lobby_sector` sobrevive al FULL REBUILD (>=5 parlamentarios);
  (5) no-PII: el cuerpo de `materializar_cruces` sigue sin `\y(partido|rut)\y` (`rut_proveedor` NO
  trip el guard); (6) la evidencia `lobby_sector_aporte` es PII-safe; (7) anon NO lee `cruce_senal`
  (deny-by-default → 42501).
- **build/typecheck NO prueban el DDL** (falso positivo de CI conocido, Pitfall 5). El pgTAP contra
  el schema aplicado es la ÚNICA prueba válida. Si sale un `not ok`, aplicar el **rollback** (§6) y
  reportar el fallo.

---

## 4. POST-APLICACIÓN — materializar + confirmar el vacío honesto de la señal

Tras el pgTAP verde, re-materializar los cruces desde los hechos de PROD y confirmar el estado de
la señal HOY:

```bash
# Re-materializar (FULL REBUILD). El cron `cruces-materializar` (0039, '23 3 * * *') ya invoca
# esta misma firma cada noche → hereda la rama nueva sin re-programarse; correrlo a mano solo
# adelanta esa materialización.
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tAc "select cruces.materializar_cruces();"

# Confirmar el vacío honesto:
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tAc \
  "select count(*) from cruce_senal where tipo_senal = 'lobby_sector_aporte';"
```

**Esperado: `0` filas HOY. Eso es CORRECTO (vacío honesto), NO un bug del materializador.** La
señal rinde `0` por **DOS razones honestas independientes**:

- **(a) ESTRUCTURAL — correcto-por-construcción.** La señal es un STUB estructural: el puente
  sector↔dinero es el RUT de la EMPRESA contratista (la arista `<company-rut → sector>` —
  `contrato.rut_proveedor → contratista.rut_proveedor → sector DE ESA EMPRESA`), NUNCA el
  `parlamentario_id` común entre dinero y lobby (esa yuxtaposición persona-nivel es la "máquina de
  sospechas" diferida — RECHAZADA). **Esa arista NO EXISTE en el schema hoy**: ninguna tabla de
  dinero/entidad (`contratista`/`contrato`/`entidad_tercero`) tiene un `sector_id` clasificado por
  empresa (`sector_id` vive SOLO en `proyecto_ficha`/`lobby_contraparte`/`donante`, ver 0038). La
  migración modela esa arista ausente como la CTE `empresa_sector` (`where false`) → la rama se une
  contra una relación honesta-vacía y produce 0 filas AUNQUE haya contratos confirmados.
- **(b) DE DATOS — pendiente.** Aunque existiera la arista, RUT-01 está a **0% de cobertura**
  (checkpoint operador de Phase 69, PENDIENTE) y el **backfill ChileCompra por RUT** es deuda de
  operador pendiente (runbook 70-03) → no hay contratos ligados por RUT que cruzar (STATE.md).

**La sustancia diferida de MONEY-03** — el trabajo real que poblará la señal — es **construir la
arista `<company-rut → sector>`**: añadir una columna `sector_id` en la entidad-empresa
(`contratista`/`entidad_tercero`) + su clasificador, y reemplazar el cuerpo de la CTE
`empresa_sector` por el mapeo real (documentado en mayúsculas en el comentario de la migración,
`0052:123-129`). Cuando (1) exista esa arista real de entidad-compartida empresa→sector, **Y** el
operador (2) aplique RUT-01 (Phase 69) + (3) el backfill ChileCompra por RUT (70-03) y corra
`select cruces.materializar_cruces();` (o espere al cron `cruces-materializar`), la señal se
poblará. **NO presentar el 0-filas actual como un bug.**

---

## 5. GATE MONEY — `MONEY_PUBLIC_ENABLED` permanece OFF

Esta fase materializa la señal OFF-line pero **NO la presenta**:

- `MONEY_PUBLIC_ENABLED` se queda **OFF**. El flip es el **sign-off legal 21.719 de Phase 73**
  (acto humano exclusivo). Este runbook, y el operador durante el apply, **NO tocan el flag**.
- Esta fase **NO añade grants ni policies** ni monta superficie. El doble candado se hereda:
  Candado A = RLS deny-by-default sobre `cruce_senal` (0039) + RPC 0040 sin grant a anon
  (verificado por el aserto pgTAP 7 → 42501). Candado B = gate de presentación
  `moneyPublicEnabled()`/`crucesPublicEnabled()` — OFF.
- El RPC `cruces_de_parlamentario` (0040, genérico por `tipo_senal`) **hereda** el token nuevo
  automáticamente pero **sigue sin grant a anon** — no se re-emite ni se toca aquí.

Confirmar OFF tras el apply (mismo check del pre-step 3):

```bash
grep -E '^MONEY_PUBLIC_ENABLED=' .env || echo "OK: MONEY_PUBLIC_ENABLED ausente = OFF"
```

---

## 6. ROLLBACK (si el pgTAP sale rojo o el materializador falla)

La migración es aditiva → el rollback es acotado y **MONEY se queda OFF** durante todo el proceso
(la señal nunca se presentó, así que revertir no expone ni oculta nada al público). Dos vías:

**A. Revertir el DDL en PROD (si ya se aplicó y hay que retroceder):**

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction <<'SQL'
-- 1) Revertir el CHECK a solo el token original.
alter table public.cruce_senal drop constraint cruce_senal_tipo_senal_check;
alter table public.cruce_senal
  add constraint cruce_senal_tipo_senal_check
  check (tipo_senal in ('lobby_sector'));
-- 2) Borrar cualquier fila del token nuevo (por si se materializó — hoy son 0).
delete from public.cruce_senal where tipo_senal = 'lobby_sector_aporte';
-- 3) Re-emitir cruces.materializar_cruces() SIN la rama aporte:
--    aplicar el Bloque 2 de 0039_cruce_senal.sql (la función previa, solo la rama lobby_sector).
SQL
```
Tras el paso 3, correr `psql "$SUPABASE_DB_URL" -f supabase/migrations/0039_cruce_senal.sql` (o
solo su `create or replace function cruces.materializar_cruces()`) para restaurar el proc de 0039
sin la rama aporte. Confirmar con el pgTAP de 0039.

**B. Revertir la rama en el repo (si el fallo se detecta antes de mergear/aplicar):** la migración
0052 es aditiva → la rama del branch puede revertirse (`git revert`/borrar el archivo antes del
apply) sin efecto sobre PROD. En cualquier caso **MONEY se queda OFF** (la señal no se presenta
hasta el flip legal de Phase 73).

---

## 7. CRITERIOS DE CIERRE + SEGURIDAD

### Criterios de cierre
Todos deben cumplirse para declarar el apply hecho:

- [ ] Constraint verificado: `cruce_senal_tipo_senal_check` (o el nombre real ajustado) confirmado
      contra `pg_constraint` ANTES del drop.
- [ ] 0052 aplicado por `psql --db-url --single-transaction` (NUNCA `supabase db push`), UNA vez.
- [ ] pgTAP `0052_cruce_senal_lobby_sector_aporte.test.sql` corrido contra el schema APLICADO:
      todas `ok`, 0 `not ok`.
- [ ] `select cruces.materializar_cruces();` corrido; `count(*) where tipo_senal='lobby_sector_aporte'`
      = **0** confirmado HOY (vacío honesto por arista ausente + datos pendientes, NO un bug).
- [ ] `MONEY_PUBLIC_ENABLED` sigue **OFF** (flip = Phase 73).

**Señal de reanudación / cierre para el checkpoint del Plan:** el operador escribe `"aplicado"`
(con el resultado del pgTAP y el `count=0` confirmado), o describe el fallo (nombre de constraint
distinto, error de aplicación, o pgTAP rojo → aplicar rollback §6).

### SEGURIDAD DE CREDENCIALES + OPERADOR-LOCAL
Este runbook referencia SOLO el **nombre** `SUPABASE_DB_URL`, NUNCA su valor. La db-url PROD vive
SOLO en `.env` (con BOM esquivado), **jamás en argv persistente ni en logs**. **operador-LOCAL, NO
GitHub Actions:** aplicar el DDL a PROD desde CI expondría la db-url en los logs de CI, quema
minutos y contradice la regla LOCKED. El apply es un acto controlado del operador en su máquina.
