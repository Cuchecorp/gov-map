---
phase: 118
plan: 02
subsystem: auditoría de ingesta programada
tags: [cron, github-actions, pg_cron, freshness, dos-etapas, r2, read-only, audit]
requires:
  - 118-PROBES-RAW.md (P0…P10 — toda la evidencia)
  - 118-CRON-VERDICTS.md §1 (tabla maestra de 20 filas, plan 01)
  - .github/workflows/*.yml
  - packages/*/src/*-cli.ts (entrypoints REALES)
  - packages/freshness/src/catalog.ts
provides:
  - 118-CRON-VERDICTS.md §2 (20 secciones por unidad — 13 W + 2 PM + 5 PG)
  - 118-CRON-VERDICTS.md §3 (3.1 observabilidad · 3.2 frescura · 3.3 pg_cron vivo · 3.4 cursores)
affects:
  - 118-03 (gap-list priorizada — consume las etiquetas G-* de §2 y las observaciones de §3)
  - 119 (CRON-FIX — backlog directo con archivo:línea por fix)
tech-stack:
  added: []
  patterns:
    - "anatomía 56 + bloque NUEVO `#### Evidencia observada`: ninguna afirmación sin comando o id de probe"
    - "pata no aplicable DECLARADA con su razón, jamás omitida (si se omite, el lector no sabe si es incumplimiento o irrelevancia)"
    - "anatomía pg_cron construida por primera vez (sin analog en 56): job_run_details ↔ pata 1, vista materializada ↔ pata 2"
    - "umbrales CITADOS de catalog.ts con archivo:línea, nunca redefinidos en el documento"
    - "resultado negativo fechado: el delta CERO de pg_cron se escribe, no se omite"
key-files:
  created:
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-02-SUMMARY.md
  modified:
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-CRON-VERDICTS.md
decisions:
  - "El compliance DOS ETAPAS y la salud del cron son ejes INDEPENDIENTES, y el documento los reporta por separado. `lobby-leylobby` (W-5) tiene de los mejores compliance del inventario (Etapa-1 + Etapa-2 `--from-r2` + hash-check con `[skip]` + guard fail-closed) y aun así su veredicto es `stale`. Fundirlos habría producido el veredicto equivocado en las dos direcciones."
  - "El audit 56 emitió el veredicto de leyes-weekly citando `packages/tramitacion/src/ingest-cli.ts:16` ('R2/remoto diferidos'), que NO es lo que el cron corre. Auditado el entrypoint REAL (`run-tramitacion-prod-cli.ts`, `leyes-weekly.yml:75`), el resultado se invierte: es la ÚNICA cadena dos-etapas completa del proyecto (Etapa-1 + `--from-r2` + `existed`→skip + SnapshotWriter con 4.380 filas vivas). Gotcha 57-05 cerrado con consecuencia material, no ceremonial."
  - "La causa 'R2 secrets ausentes' que 56 usó para marcar agenda-weekly como no-op está MUERTA: los 4 `R2_*` existen desde 2026-07-09 (P4). Se re-emitió el veredicto contra el estado de hoy en vez de heredar el de 56."
  - "`deploy-cloudflare` tiene su corrida más reciente en `failure` y NO se clasifica `roto`: `roto` es un juicio sobre ingesta programada, y esta unidad no es ninguna de las dos cosas. Clasificarla `roto` habría inflado la cuenta de crons rotos con deuda de operador (110-02, P2) que además tiene vía alternativa funcionando (wrangler OAuth local)."
  - "PG-5 `actualidad-materializar`: el viernes hábil 2026-07-25 no registra corridas y la evidencia disponible NO permite decidir entre 'alta efectiva posterior' y 'cuatro ventanas perdidas'. Se declara como observación ABIERTA para 119 en vez de resolverse por inferencia; el veredicto sigue verde porque las dos jornadas hábiles completas posteriores dan 6/6."
  - "Se identificó un patrón de instrumentación que 119 puede aprovechar sin diseñarlo: la ÚNICA entrada de `catalog.ts` que apunta a una tabla de *cursor* (`lobby-leylobby` → `lobby_ingesta_estado`) es la única que detecta una avería real; las dos que dan 'verde prestado' (`lobby-camara`, `fichas`) miran tablas de *datos* llenadas por otro cron."
metrics:
  duration: ~40 min
  tasks: 2
  files: 1
  secciones_escritas: 20
  lineas_anadidas: ~1470
  completed: 2026-07-28
---

# Phase 118 Plan 02: Secciones por unidad y estado observado — Summary

Cuerpo completo de `118-CRON-VERDICTS.md`: **20 secciones por unidad de cron** (13 workflows
versionados + 2 platform-managed + 5 jobs de `pg_cron`), cada una con su evidencia observada,
su cadena de ingesta, su compliance de la regla LOCKED de dos etapas y su bloque de
re-verificación — más las **cuatro tablas de estado observado** con la fecha del probe en el
título.

## Qué se construyó

Todo dentro del artefacto existente `118-CRON-VERDICTS.md` (§1 quedó intacta):

**`## 2. Unidades de cron`** — una subsección por fila de la tabla maestra, en el mismo orden:

- `### W-1` … `### W-13` — los 13 YAML de `.github/workflows/`.
- `### PM-1` / `### PM-2` — `Dependabot Updates` y `CodeQL`.
- `### PG-1` … `### PG-5` — los 5 jobs vivos de `cron.job`, precedidos de una **nota de método**
  que explica la anatomía adaptada y declara el delta migración↔vivo.

**`## 3. Estado observado (ancla 2026-07-28)`** — `3.1` observabilidad de tablas, `3.2` frescura
baseline con umbrales citados de `catalog.ts`, `3.3` `cron.job` × `job_run_details`, `3.4`
cursores (el discriminante de `stale`), más un bloque de re-verificación de §3 completa.

## La anatomía, y el bloque que 118 añade

La plantilla base es la del audit 56 (`56-CRON-AUDIT.md:34-76`): YAML · Schedule · Veredicto ·
Causa raíz · Cadena de ingesta · DOS ETAPAS compliance · Gaps · Cómo re-verificar. Sobre ella,
este plan añadió dos cosas:

1. **`#### Evidencia observada`** — bloque nuevo, exigido por la regla de validación de 118: por
   cada pata, el comando o el id de probe con su salida. Es lo que separa este audit de una
   lectura de YAML.
2. **`**Entrypoint invocado:**`** con `archivo:línea` del YAML **y** ruta del `.ts`, nombrando el
   **CLI hermano NO ejecutado** donde el paquete tiene entrypoints duales.

## Hallazgos que sólo aparecieron al escribir las secciones

**1. El gotcha 57-05 cambia un veredicto, no sólo una cita.**
El audit 56 juzgó `leyes-weekly` contra `packages/tramitacion/src/ingest-cli.ts:16` ("R2/remoto
diferidos") y concluyó Etapa-1 ausente. Pero `leyes-weekly.yml:75` invoca
`run-tramitacion-prod-cli.ts`, no ese archivo. Auditado el entrypoint real, **W-4 resulta ser la
única cadena dos-etapas completa del proyecto**: `putImmutable` (`ingest-run.ts:309`), `existed`
→ `[skip] sin novedades` con salto de Etapa 2 (`:294`, `:330`), `--from-r2` (`ingest-cli.ts:200`)
y `SnapshotWriter` montado (`run-tramitacion-prod-cli.ts:215-218`) con **4.380 filas vivas** en
`source_snapshot`. Es la forma a la que 119 debería converger las demás.

**2. Una causa que 56 daba por viva está muerta.**
`agenda-weekly` estaba marcada "Etapa-1 no-op por secrets R2 ausentes". Los 4 `R2_*` existen
desde 2026-07-09 (P4). El veredicto se re-emitió contra el estado de hoy; el gap real de agenda
es otro (`existed` descartado en `ingest-run.ts:155`/`:291`, y sin `--from-r2`).

**3. Tres conectores comparten exactamente la misma omisión.**
`agenda` (`ingest-run.ts:155`), `probidad` (`run-probidad-todos.ts:149`) e `identity`
(`seed-cli.ts:201`) destructuran `const { r2Path } = await …putImmutable(…)` y **descartan el
`existed`**. La infraestructura de hash-check está completa aguas abajo
(`packages/ingest/src/r2-store.ts:71` manda `If-None-Match: *`, `:79` devuelve `existed` en 412)
y nadie la consulta. Es un fix mecánico de una línea por conector, y explica por qué "salir
temprano cuando no hay novedades" (`CLAUDE.md` regla 2) no se cumple pese a estar implementado.

**4. `lobby-camara-weekly` es el caso donde la regla LOCKED habría pagado sola su costo.**
Su Etapa-2 entra por `--html-file /tmp/lobby.html` (`lobby-camara-weekly.yml:67`), no por R2. Con
una Etapa-2 desde R2, el crudo de las corridas exitosas previas sería re-procesable **sin volver
a camara.cl**, que es justo lo que el WAF bloquea. La regla de `CLAUDE.md` no es ceremonia:
aquí resolvería el problema.

**5. La señal de freshness que acierta es la que mira el cursor.**
De las 9 entradas de `catalog.ts`, `lobby-leylobby` es la **única** que apunta a una tabla de
cursor (`lobby_ingesta_estado`, `catalog.ts:273`) en vez de a una de datos — y es la única que
detecta una avería real. Las dos de "verde prestado" (`lobby-camara`→`lobby_audiencia`,
`fichas`→`proyecto`) miran tablas llenadas por otro cron. El JSON incluso las delata en un campo
que **no participa del cálculo de `stale`**: `ghRun: "failure @ 2026-07-07"` y
`ghRun: "n/d (sin corridas)"`. La información existe; el algoritmo la ignora.

**6. `parlamentario` no tiene cron que la escriba.**
W-3 produce el snapshot git, W-8 está gated y la escritura del 2026-07-27 00:10 vino de fuera de
GH Actions (su corrida fue a las 10:04, diez horas después). La maestra de identidad depende hoy
de una acción de operador — declarado como control negativo, no inferido.

**7. La cuenta "3 fuentes stale" es la trampa de lectura más probable del audit.**
Sólo una es avería (`lobby-leylobby`); `chilecompra` y `servel` son gating legal declarado en
`0023_dinero.sql:46` y `0025_agregacion.sql:46`. §3.2 lo dice explícitamente para que 119 no las
tome como backlog.

## Patas no aplicables: declaradas, nunca omitidas

Es el requisito más fácil de incumplir en silencio. Casos y su razón escrita:

| unidad | pata declarada no aplicable | razón citada |
|---|---|---|
| W-1 `actualidad-refresh` | patas 3 y 4 + las **seis** viñetas de DOS ETAPAS | `run-actualidad-prod-cli.ts:15`: *"NO toca fuentes gubernamentales → sin R2, sin rate-limit, sin robots.txt. Solo Supabase."* |
| W-3, W-7, W-8 | pata 3 | no están en `packages/freshness/src/catalog.ts` (P9) |
| W-3 `backup-parlamentario` | pata 2 **sustituida** | no escribe Supabase (`backup-parlamentario.yml:60`); se auditó el destino real (commits del bot) |
| W-10 `backfill` | DOS ETAPAS **fuera de alcance** | es conector, pero nunca corrió desde CI; auditarlo por lectura sería juicio sin evidencia |
| W-12, W-13, PM-1, PM-2 | DOS ETAPAS completo | no son conectores de ingesta |
| PM-1, PM-2 | pata 1 **parcial, con la limitación del probe explicada** | `gh run list --workflow` indexa por archivo `.yml`, que no existe; evidencia indirecta vía el PR de Dependabot en `ci.yml` |
| los 5 `PG-*` | patas 3 y 4 | ningún job de `pg_cron` está en `catalog.ts`; todos operan intra-Postgres |

## Delta migración ↔ vivo de pg_cron: CERO, y escrito

Resultado **negativo fechado** (2026-07-28), declarado en texto explícito con nombres:

- Jobs esperados por migraciones que no están vivos: **ninguno**.
- Jobs vivos no declarados en migraciones: **ninguno** (`cron.job` = 5 filas exactas).
- Los 5 con `active = t`; mismo jobname, schedule y command que las migraciones.
- **Rama activa de `0003_orchestration.sql` = `:214`** (`30 seconds`, pg_cron ≥ 1.5), no el
  fallback `* * * * *` de `:221` — resuelto con `schedule` vivo, no con lectura del DDL.

Se escribe precisamente porque es cero: si un audit futuro encuentra delta, sabrá que el
2026-07-28 no lo había.

## Desviaciones del plan

**Ninguna.** No se requirieron probes complementarias: toda la evidencia salió de
`118-PROBES-RAW.md` (P0…P10). Las únicas lecturas nuevas fueron de **código versionado**
(`grep`/`sed` sobre `packages/`, `.github/workflows/`, `supabase/migrations/`) para poblar las
columnas `archivo:línea` de las tablas de cadena de ingesta y DOS ETAPAS — lectura pura, sin
ejecución de CLIs ni acceso a la DB, dentro del régimen del plan.

Dos anclas del plan se verificaron y **coincidieron**, así que no hubo diff que reportar:
`ls .github/workflows/*.yml | wc -l` = 13 = `grep -c '^### W-'`, y el nº de filas de `cron.job`
(5) = `grep -c '^### PG-'`.

## Régimen y seguridad

- **Cero escritura:** ninguna sentencia SQL ejecutada en este plan (toda la evidencia psql es de
  118-01); cero CLIs de ingesta; cero migraciones.
- **Cero archivo fuera de `.planning/phases/118-*/`:** `git diff --name-only | grep -v '^\.planning/'`
  devuelve únicamente `pnpm-workspace.yaml`, **ya modificado antes de iniciar la sesión** (consta
  en el `git status` inicial y en el SUMMARY de 118-01) y no tocado por esta fase.
- **Cero fuga (T-118-05):** gate anti-secreto y anti-URL → **0**. El único `return_message` no
  vacío (`job startup timeout`) ya venía recortado a 180 caracteres en origen. Ninguna URL de DB
  aparece: todas las líneas `psql` de los bloques de re-verificación usan `"$SUPABASE_DB_URL"` y
  van **comentadas con `#`** (idiom 56).
- **T-118-07 (repudio):** los 10 veredictos ≠ verde llevan `**Causa raíz del veredicto:**` con
  `archivo:línea` o dato fechado, verificado por conteo pareado.

## Verificación

| criterio | resultado |
|---|---|
| `grep -c '^### W-'` == `ls .github/workflows/*.yml \| wc -l` | 13 == 13 ✓ |
| `grep -c '^### PM-'` == 2 | 2 ✓ |
| `grep -c '^### PG-'` == filas de `cron.job` (§1, P6) | 5 == 5 ✓ |
| `grep -c '#### Cómo re-verificar'` ≥ 15 | 16 ✓ |
| `grep -c '#### Evidencia observada'` ≥ 15 | 16 ✓ |
| `grep -c '#### DOS ETAPAS compliance'` ≥ 9 | 16 ✓ |
| `grep -c '\*\*Entrypoint invocado:\*\*'` ≥ 13 | 15 ✓ |
| `Veredicto:` de sección seguido de `Causa raíz` | 20 / 20 pares alineados ✓ |
| `grep -c 'Veredicto: '` cuadra con §1 | 40 = 20 (tabla maestra) + 20 (secciones) ✓ |
| `### 3.1` / `3.2` / `3.3` / `3.4` presentes con fecha ancla en el título | 4 / 4 ✓ |
| §3.2 cita umbrales de `catalog.ts` sin redefinirlos | 9 filas, cada una con `catalog.ts:NNN` ✓ |
| delta migración↔vivo declarado en texto explícito | ✓ (nota de método de §2 + §3.3) |
| gate anti-secreto / anti-URL | 0 ✓ |
| `git diff --name-only \| grep -v '^\.planning/'` | sólo `pnpm-workspace.yaml`, preexistente ✓ |
| verify automatizado de Task 1 y Task 2 | `OK` ✓ |

## Notas para 118-03

- Las etiquetas `G-*` de §2 son **provisionales y descriptivas** (`G-cursor-lobby`,
  `G-snapshot-agenda`, `G-etapa2-probidad`, `G-freshness-enganosa-camara`,
  `G-freshness-enganosa-fichas`, `G-hashcheck-*`, `G-secrets-fichas`, `G-deuda-110-02`,
  `G-cobertura-freshness`, `G-etapa2-camara`, `G-snapshot-identity`, `G-snapshot-leylobby`).
  118-03 les asigna la numeración `G<n>` definitiva y la prioridad.
- **Candidato P1 único:** `G-cursor-lobby` — es el único veredicto `stale` del inventario y el
  único caso que cumple las tres condiciones de §3.4 (corridas verdes + marcador congelado +
  ninguna causa declarada).
- **Candidato P2 (deuda operador):** `G-deuda-110-02`, con su evidencia fechada lista en P3.b +
  P4 para el checkpoint de operador.
- **Familia de fix mecánico y barato** que 118-03 puede agrupar en un solo gap: los tres
  `existed` descartados (agenda, probidad, identity) y los cuatro `SnapshotWriter` no montados
  (agenda, leylobby, identity, fichas). El patrón de referencia ya existe en el repo
  (`run-tramitacion-prod-cli.ts:215-218`, `run-probidad-todos-cli.ts:147-150`).
- **Observación abierta, no gap:** el viernes 2026-07-25 sin corridas de PG-5. Requiere un dato
  que este audit no tiene (fecha de alta efectiva del job).
- §1.5 (estados esperados) sigue **fuera** de la gap-list, y §3.2 refuerza por qué: dos de las
  tres señales `stale: true` son gating legal.

## Self-Check: PASSED

Archivo verificado presente:
- `.planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-CRON-VERDICTS.md` — FOUND

Commits verificados en `git log`:
- `c3b00c9` — FOUND (Task 1: 13 W + 2 PM)
- `5f8dc7d` — FOUND (Task 2: 5 PG + §3)
