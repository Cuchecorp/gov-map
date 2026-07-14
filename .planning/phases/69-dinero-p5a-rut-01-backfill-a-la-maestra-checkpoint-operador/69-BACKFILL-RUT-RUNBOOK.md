---
phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
plan: 03
tipo: runbook-operador-LOCAL
requirements: [RUT-01]
locked:
  - "La ESCRITURA REMOTA del RUT a la maestra es checkpoint de OPERADOR (bloqueante duro de TODO P5). El agente NO la ejecuta, NO toca db-url, NO fabrica ni puebla RUTs."
  - "NUNCA fabricar un RUT ni poner placeholders: DV-gate módulo-11 (isRutValido) OBLIGATORIO + provenance NOT NULL (0005) por cada RUT antes de escribir."
  - "Track B (seed curado) = default de ESCRITURA; Track A (SERVEL/ChileCompra) SOLO corrobora un RUT ya presente, NUNCA sobre-escribe a ciegas (canal harvest = CandidatoCosechaRut)."
  - "Un name-match NUNCA escribe el `rut` de la maestra (corte CR-01, guard Plan 01); un binding nombre↔RUT sin RUT-exacto va a cola de revisión humana."
  - "El RUT es PII interna: nunca a anon, nunca a un LLM, nunca a una ruta/RPC/proyección pública. RLS deny-by-default se mantiene. Reporte counts-only."
  - "Backfill = LOCAL operador, NO GitHub Actions (CLAUDE.md: minimizar minutos CI + evitar escritura accidental a PROD desde CI)."
entry_point: "GAP — ver §0. No existe HOY un CLI operador que lea el seed Track B y corra runBackfillRut con un writer REMOTO. El mecanismo (runBackfillRut + SupabaseMaestraWriter.updateRut) EXISTE y está testeado; el invocador remoto es la pieza que el operador debe montar/correr LOCAL vía db-url."
---

# 69 — BACKFILL RUT RUNBOOK (operador-LOCAL): escritura del `rut` a la maestra + reporte de cobertura

> **QUIÉN CORRE ESTO:** el operador, en su máquina **LOCAL**. **NO** el agente, **NO** GitHub Actions.
>
> **POR QUÉ ES ACTO EXCLUSIVO DEL OPERADOR:**
> 1. **PII real:** los RUTs reales son PII que el agente no posee; solo el operador provee RUTs
>    DV-válidos con provenance (declaraciones InfoProbidad / diario oficial / etc.).
> 2. **Credencial ausente por diseño:** el write remoto usa **db-url** (MEMORY: write DB remoto
>    solo vía `db push --db-url`; la service key API ≠ PAT `sbp_`). El `.env` HOY **NO** tiene una
>    DB password apta para push remoto — es intencional. El operador provee la credencial al
>    momento de escribir; este runbook referencia **solo NOMBRES** de credenciales, nunca valores.
> 3. **Bloqueante duro de TODO P5:** sin RUT presente, el cruce de dinero (Phases 70/71/72) rinde
>    `null` o —peor— **FALSO por name-match**. Por eso la escritura es una compuerta deliberada.
>
> **DECLARACIÓN DEL AGENTE:** el agente que produjo este runbook **NO** ejecutó la escritura
> remota, **NO** tocó db-url, **NO** fabricó ni pobló RUTs, y validó TODO offline con un writer
> espía in-memory (`SpyRutWriter`/mocks). Pitfall LOCKED del research: **CI verde ≠ escritura
> remota probada.** El mecanismo existe y está testeado; la corrida LIVE es del operador.

---

## 0. ESTADO DEL ENTRYPOINT — GAP EXPLÍCITO (leer ANTES de nada)

El mecanismo de escritura de RUT **ya existe y está testeado offline**:

- `runBackfillRut(filas: FilaRutCruda[], writer: RutBackfillWriter): ResultadoBackfill`
  (`packages/identity/src/backfill-rut.ts`) — DV-gate `isRutValido` (módulo-11) + provenance
  NOT NULL + fail-closed; devuelve `{ escritas, rechazadas[] }`. Idempotente por `id`. Una fila
  DV-inválida → `rechazadas["dv-invalido"]`; sin provenance → `rechazadas["provenance-faltante"]`;
  **NUNCA fabrica un RUT**.
- `SupabaseMaestraWriter` (`packages/identity/src/writer-supabase.ts`) **implementa**
  `RutBackfillWriter` → su `updateRut(rows)` hace `.update({ rut, origen, fecha_captura, enlace }).eq("id", …)`
  **por fila** (nunca `.in()` que fijaría el mismo valor a todo el lote), en lotes de 100.
- `runHarvestRut` (`packages/dinero/src/harvest-rut.ts`) es el **canal de corroboración (Track A)**:
  solo recibe `CandidatoCosechaRut`, que `reconciliar-contrato` emite EXCLUSIVAMENTE cuando la
  maestra YA tenía un `rut` que coincide (no-op de confirmación). Un name-only **nunca** llega
  aquí; viaja al canal separado de revisión humana. El guard del Plan 01 congela ese corte.

**LO QUE FALTA (GAP):** NO existe hoy un CLI de operador que (a) **lea `supabase/seeds/parlamentario-rut.seed.json`
(Track B)**, (b) corra `runBackfillRut` con un `SupabaseMaestraWriter` **apuntado al REMOTO** y
(c) reporte `ResultadoBackfill`. Además, por diseño **`SupabaseMaestraWriter` apunta al Supabase
LOCAL** (docstring `writer-supabase.ts` L18-21: "apunta SIEMPRE al LOCAL; el push al REMOTO es
paso de operador diferido"). El operador **debe montar/correr ese invocador LOCAL** apuntando la
URL/credencial al remoto vía db-url. Molde a copiar: `packages/identity/src/backfill-entidad-cli.ts`
(`loadEnv` BOM-safe + `buildWriterFromEnv` que devuelve `null` sin credencial → modo solo-custodia).

> **Este gap es intencional y seguro:** sin el invocador remoto, es *estructuralmente imposible*
> que CI escriba un RUT al remoto (fail-closed). El operador lo activa deliberadamente.

**Forma del invocador que el operador corre LOCAL (esqueleto — el operador lo materializa):**

```
# LOCAL, operador. NO en GitHub Actions.
# 1. Cargar filas de Track B (seed curado) → FilaRutCruda[]
# 2. Construir SupabaseMaestraWriter con URL+credencial REMOTAS de .env (db-url / service remoto)
# 3. const res = await runBackfillRut(filas, writer)   // DV-gate + provenance + idempotente por id
# 4. Loguear SOLO counts: res.escritas / res.rechazadas["dv-invalido"] / res.rechazadas["provenance-faltante"]
#    (NUNCA imprimir el RUT en claro)
```

Repetir análogamente para `entidad_tercero` con `SupabaseEntidadWriter`/`writer-entidad-supabase.ts`
si se pobló un seed de RUT jurídico (universo cruzable por RUT exacto — Plan 02).

---

## 1. PRE-CHECKS OBLIGATORIOS (todos OFFLINE, antes de cualquier write remoto)

Ejecutar en orden. Si alguno falla, **DETENER** — no correr el backfill.

1. **Mecanismo verde** (DV-gate + provenance + idempotencia; harvest = corroboración):
   ```bash
   pnpm --filter @obs/identity test    # backfill-rut: dv-invalido/provenance-faltante/idempotencia
   pnpm --filter @obs/dinero test      # harvest-rut + reconciliar-contrato (Track A corrobora)
   ```
   Deben pasar. Si `backfill-rut` está rojo, el DV-gate/fail-closed no es de fiar → NO escribir.

2. **Guard name-match≠write-rut verde** (corte CR-01, Plan 01 — el que MUERDE ante refactors):
   ```bash
   pnpm --filter ./app test -- name-match-rut-guard          # guard ESTÁTICO (fs + mutation self-check)
   pnpm --filter @obs/dinero test -- name-match-rut-guard.behavior   # companion de COMPORTAMIENTO
   ```
   Ambos verde. El estático aserta que `revisionesRut` NUNCA es argumento de
   `runBackfillRut`/`runHarvestRut`/`updateRut` y que todo `cosechas.push` vive dentro del bloque
   de corroboración. El companion ejercita `reconciliarContrato`: name-only → 0 cosechas /
   1 revisión; corroboración → 1 cosecha. Si están rojos, el corte se rompió → **DETENER**.

3. **Las maestras destino tienen RLS deny-by-default y NO exponen `rut` a anon** — verificar
   contra la DB **REMOTA** (usar `SUPABASE_DB_URL` de `.env`, que apunta al REMOTO; solo el NOMBRE):
   ```bash
   psql "$SUPABASE_DB_URL" -c "\d parlamentario"      # 0005: rut NULLABLE, uso interno
   psql "$SUPABASE_DB_URL" -c "\d entidad_tercero"    # 0034: rut + RLS + revoke
   ```
   Confirmar que las policies RLS deniegan a `anon` (0005 L15/L61: "anon NUNCA lee `rut`").
   Además, correr el lockdown-guard para confirmar que **ninguna ruta pública/RPC proyecta `rut`**:
   ```bash
   pnpm --filter ./app test -- lockdown-guard
   ```

4. **Credencial de write remoto presente (solo NOMBRES, NUNCA valores)** — recordar que el
   db-url **NO está en `.env` por diseño**; el operador lo provee en el momento del write:
   ```bash
   # Verificar solo la PRESENCIA de nombres (no imprime valores):
   grep -oE '^(SUPABASE_DB_URL|SUPABASE_API_URL|SUPABASE_SECRET_KEY)=' .env
   ```
   - `SUPABASE_DB_URL`: usado en el punto 3 para el `\d` contra el REMOTO. Si se usa como
     credencial de write (db-url), el operador confirma que apunta al REMOTO/PROD, NO al LOCAL.
   - Si la escritura va por `SupabaseMaestraWriter` con URL+service key: el operador apunta esa
     URL al REMOTO explícitamente (por defecto el writer va al LOCAL — §0).
   - Si NINGUNA credencial remota apta está presente → el invocador degrada a modo solo-custodia /
     LOCAL. **DETENER** y proveer la credencial remota antes de escribir a la maestra.

5. **Cobertura baseline HOY (techo honesto ≈ 0/M)** — leer la señal del Plan 02 ANTES de poblar:
   ```bash
   pnpm freshness
   ```
   Debe aparecer el encabezado **COBERTURA_RUT** con dos sub-tablas (parlamentario + entidad).
   HOY, con el seed vacío: parlamentarios **0/M = 0%** (cero REAL declarado, no n/d); entidades
   jurídicas **n/d** si su universo es 0. Ese es el techo verídico de partida.

---

## 2. POBLAR EL SEED (Track B) — acto del operador, RUTs reales DV-válidos

El default de ESCRITURA es Track B: `supabase/seeds/parlamentario-rut.seed.json` (HOY `"filas": []`).
El operador lo llena con filas de la forma **`{ id, rut, origen, fecha_captura, enlace }`**:

- `id` = PK estable de la maestra (matchea `supabase/seeds/parlamentario.seed.json` — `S{parlid}`/`D{id_camara}`).
- `rut` = RUT real con DV válido (con o sin puntos/guión; se normaliza con `normRut` al escribir).
- `origen` / `fecha_captura` (ISO) / `enlace` = **provenance OBLIGATORIA** (0005 NOT NULL).

**ADVERTENCIAS LOCKED:**
- **NUNCA fabricar RUTs ni poner placeholders.** El DV-gate rechaza inválidos a
  `rechazadas["dv-invalido"]` (fail-closed) y los que faltan provenance a
  `rechazadas["provenance-faltante"]` — NUNCA llegan al writer. Un placeholder "para pasar la
  corrida" es exactamente lo que el gate está diseñado para rechazar.
- **Track A (SERVEL/ChileCompra) SOLO corrobora**, no sobre-escribe a ciegas. Un RUT matcheado por
  NOMBRE es un **CANDIDATO, no un hecho**: viaja por el canal de revisión humana. Solo cuando el
  RUT ya presente en la maestra coincide con el harvested, `runHarvestRut` lo re-escribe (no-op de
  confirmación). El guard del Plan 01 hace imposible que un name-only escriba un RUT nuevo.
- Para `entidad_tercero`: solo `tipo_entidad='juridica'` es el universo cruzable por RUT exacto
  (Plan 02). Las personas naturales de lobby no traen RUT y no son el universo cruzable.

---

## 3. CORRIDA LIVE (write remoto, gated) — VERIFICAR DESTINO ANTES DE ESCRIBIR

Correr el invocador (§0) **LOCAL**, con el writer apuntado al **REMOTO** vía la credencial db-url:

- **ANTES de dejarlo escribir, verificar el destino en el log.** Si el log no dice inequívocamente
  **REMOTO/PROD** (la URL de PROD), o dice `LOCAL (127.0.0.1…)` u otra URL inesperada → **DETENER**:
  estarías escribiendo a la DB equivocada (espejo Pitfall 5 del runbook 66). Recordar que
  `SupabaseMaestraWriter` va al LOCAL por defecto — el operador DEBE apuntar la URL al remoto.
- Cada RUT pasa el **DV-gate módulo-11** (`isRutValido`) + **provenance NOT NULL** dentro de
  `runBackfillRut`; los inválidos van a `rechazadas`, NUNCA al writer.
- **Idempotente por `id`:** re-correr la misma lista = no-op semántico (mismo `rut`+provenance por
  `id`). Reanudar tras una interrupción = re-correr; no duplica.
- Correr para **AMBAS maestras** si se pobló su seed (`parlamentario` + `entidad_tercero`).
- **PII discipline durante la corrida:** loguear **SOLO counts** (`escritas` / `rechazadas`), jamás
  el RUT en claro; jamás a un archivo de salida compartido, jamás a un LLM.

---

## 4. REPORTE DE COBERTURA (RUT-01) — techo honesto, ambas maestras

Tras el write remoto, re-leer la señal del Plan 02:

```bash
pnpm freshness
```

- Leer la tabla **COBERTURA_RUT**: **N/M** de RUT presente (DV-válido) por maestra
  (`parlamentario` cruzable + `entidad_tercero` jurídica). La N debe **haber subido honestamente**
  respecto del baseline del paso 1.5.
- Reportar también, del `ResultadoBackfill` de la corrida: `escritas`,
  `rechazadas["dv-invalido"]`, `rechazadas["provenance-faltante"]` (counts).
- **Interpretación honesta (LOCKED):** "sin dato de RUT" **≠** "sin vínculos". El techo se
  **declara**, no se infla: N=0/M>0 → 0% REAL (no n/d); M=0 (sin universo) → n/d (no 0% fingido);
  psql degradado → n/d. La señal NO finge 100% ni 0% (T-69-07).

---

## 5. CRITERIOS DE CIERRE

Todos deben cumplirse para declarar el backfill hecho:

- [ ] Mecanismo verde (`@obs/identity` + `@obs/dinero` tests).
- [ ] Guard name-match≠write-rut verde (estático + companion de comportamiento, Plan 01).
- [ ] Seed Track B poblado con RUTs reales DV-válidos + provenance (NUNCA fabricados).
- [ ] Write remoto corrido LOCAL con destino REMOTO verificado en el log.
- [ ] Cobertura declarada vía `pnpm freshness`: **N/M** concreto por maestra (subió honestamente).
- [ ] `rut` NO legible por anon en la DB REMOTA (RLS) + lockdown-guard verde (ninguna ruta pública
      lo proyecta).

**Señal de reanudación / cierre del checkpoint (Task 2 del Plan):** el operador reporta
`"backfill hecho"` con la cobertura **N/M** concreta, **o** `"mecanismo entregado, write remoto
diferido"` (el checkpoint queda como deuda de operador sin bloquear el cierre del mecanismo), **o**
describe el problema (p.ej. un RUT falló el DV → revisar la fila; un name-match intentó escribir →
va a cola de revisión humana, NO se escribe).

---

## 6. ROLLBACK / SEGURIDAD

- **Idempotencia:** re-correr el mismo seed = no-op por `id` (mismo `rut`+provenance). No hay
  duplicación; reanudar tras interrupción = re-correr las filas pendientes.
- **RUT que falla el DV:** `runBackfillRut` lo manda a `rechazadas["dv-invalido"]` y NUNCA lo
  escribe (fail-closed). El operador corrige la fila del seed (RUT correcto + provenance) y
  re-corre. **Nunca** relajar el DV-gate para "que pase".
- **Un name-match que intenta escribir un RUT nuevo:** estructuralmente imposible por el corte
  CR-01 (guard Plan 01). El binding nombre↔RUT sin RUT-exacto va a **cola de revisión humana**
  (`CandidatoRevisionRut` → `enqueueRevision`), NO al writer.
- **PII:** el RUT nunca a logs (counts-only), nunca a anon, nunca a un LLM, nunca a una
  ruta/RPC/proyección pública. RLS deny-by-default se mantiene intacta.
- **Operador-LOCAL, NO GitHub Actions:** correr esto en CI está PROHIBIDO (quema minutos + arriesga
  escritura accidental a PROD desde CI — T-69-08).

## SEGURIDAD DE CREDENCIALES

Este runbook referencia SOLO **nombres** de variables de entorno (`SUPABASE_DB_URL`,
`SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`), **NUNCA valores**. El db-url de write remoto no está en
`.env` por diseño — el operador lo provee al momento de escribir. Ningún comando de este runbook
imprime la credencial ni un RUT en claro; el invocador loguea solo la URL de destino + counts
(T-69-09, T-69-10).
