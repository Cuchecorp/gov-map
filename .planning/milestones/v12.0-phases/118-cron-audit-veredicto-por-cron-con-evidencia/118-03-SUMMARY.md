---
phase: 118
plan: 03
subsystem: auditoría de ingesta programada
tags: [cron, audit, gaps, freshness, secrets, gate]
requires:
  - "118-01: inventario + probes P0-P10 (118-PROBES-RAW.md)"
  - "118-02: §0-§3 de 118-CRON-VERDICTS.md (20 veredictos con evidencia)"
provides:
  - "gap-list P0/P1/P2 con ids G1..G11 estables, punteros archivo:línea y pasos concretos — backlog directo de Phase 119"
  - "resolución de A1-A5 y OQ1-OQ4 del RESEARCH"
  - "§6 Límites declarados (9)"
  - "118-OPERATOR-CHECKPOINT.md — petición zero-credential-value, no bloqueante"
  - "check-crons.sh — gate re-ejecutable del propio documento (C1-C7, STRICT=0/1)"
affects:
  - "Phase 119 (CRON-FIX): consume §4 tal cual"
tech-stack:
  added: []
  patterns:
    - "gate de artefacto con denominador DERIVADO + ancla que se REPORTA (heredado de check-fechas.sh)"
    - "conteos por REGIÓN para que los bloques de código del propio §7 no se auto-cuenten"
    - "anti-secreto aplicado a los artefactos, jamás al script que contiene los patrones"
key-files:
  created:
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-OPERATOR-CHECKPOINT.md
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/check-crons.sh
  modified:
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-CRON-VERDICTS.md
decisions:
  - "Cero gaps P0: ningún cron programado está roto, y se declara como resultado en vez de fabricar urgencia"
  - "Los ids mnemónicos de §2 (G-cursor-lobby…) se consolidaron a G<n> conservando el mnemónico entre paréntesis: correspondencia bidireccional exacta sin perder trazabilidad"
  - "OQ3 se cierra sólo parcialmente: la rotación B26 no es observable con gh secret list (nombre + fecha, nunca valor ni historial)"
  - "C1c cuenta veredictos por región (20+20) en vez de globalmente (40): cada unidad aparece por diseño en §1.3 y en §2"
metrics:
  duration: ~1 h
  completed: 2026-07-28
  tasks: 3
  commits: 4
---

# Phase 118 Plan 03: Cierre de la auditoría de crons — Summary

Gap-list de **11 gaps priorizados (0 P0, 5 P1, 6 P2)** con ids estables y pasos ejecutables,
assumptions y open questions del RESEARCH cerradas contra observación, 9 límites declarados,
checkpoint de operador zero-credential-value emitido una sola vez, y un gate re-ejecutable
(`check-crons.sh`) que verifica el documento entero en segundos — **STRICT=1 verde, 0 faltas**.

## Qué se construyó

**Task 1 — §4, §4.1, §5, §6 de `118-CRON-VERDICTS.md`** (commit `ce817ec`)

- **§4** índice compacto + tabla de detalle **ordenada por prioridad**, con el conteo en negrita:
  **11 gaps: 0 P0, 5 P1, 6 P2.**
  - **P1 (accionables):** G1 cursor `lobby_ingesta_estado` detenido (el hallazgo central);
    G4 señales de freshness con *verde prestado* (`lobby-camara` y `fichas` miden tablas que
    llena otro cron); G5 `putImmutable` sin `SnapshotWriter` en 4 conectores; G6 el `existed`
    del hash-check descartado en 3 llamadores; G7 sin ruta `--from-r2` en 3 conectores.
  - **P2 (deuda):** G2 catálogo apuntando a `chilecompra-weekly.yml`/`servel-weekly.yml`
    inexistentes; G3 hueco de cobertura (8 de 20 unidades sin pata 3); G8 deuda de operador
    110-02; G9 secrets de `fichas-backfill`; G10 `pnpm freshness` sin resolver `tsx`;
    G11 el viernes ambiguo de PG-5.
  - Cada fila lleva **pasos numerados**, no un verbo: 119 puede ejecutarla sin re-investigar.
    Dos gaps son SISTÉMICOS (idiom G23 del audit 56): una fila transversal con varios
    `archivo:línea`.
- **§4.1** los estados esperados que NO son gaps, cada uno con su cita
  (`0023_dinero.sql:46`, `0025_agregacion.sql:46`, `lobby-camara-weekly.yml:14-17`,
  `digest-daily.yml:17`, `roster-weekly.yml:16`, `backfill.yml:7`, `fichas-backfill.yml:8`).
- **§5** las 9 filas: A1-A5 + OQ1-OQ4. Tres asunciones **refutadas** (A2 columnas, A4
  `backup-parlamentario` no escribe Supabase, A5 hay 7 secrets no 2 — lo que mata la causa
  "Etapa-1 no-op por secrets ausentes" que el audit 56 le atribuía a `agenda`).
- **§6** 9 límites numerados, incluidos los que el plan exigía: checkpoint sin responder,
  8 unidades sin pata 3, logs de GH no recuperables, R2 verificado sólo por proxy, caducidad
  ~14 días, y —el que más importa— que **no se encendió ningún flag ni se corrió ninguna
  ingesta** para cerrar un límite: hacerlo habría convertido la auditoría en intervención.
- **§2** los ids mnemónicos se consolidaron a `G<n>`. Correspondencia bidireccional **exacta**:
  los 11 ids de §2 == los 11 de §4.

**Task 2 — `118-OPERATOR-CHECKPOINT.md`** (commit `f1145c9`)

Encabezado *"El agente no carga esta credencial: es un acto de operador."* Por secret faltante:
NOMBRE exacto, `archivo:línea` que lo requiere, ruta del dashboard y **permiso mínimo**
(para `CLOUDFLARE_API_TOKEN`: Account → Workers Scripts → Edit, acotado a la cuenta, sin DNS ni
facturación). **Cero valores, cero plantillas con placeholders** — un `TOKEN=____` invita a
rellenarlo y a commitearlo. Declara además lo que **no** pide y por qué: los 4 `NOTIF_*` son
estado esperado (producto parked) y la rotación B26 no es observable.

Un matiz que evita trabajo inútil en 119: `SUPABASE_URL` de `fichas-backfill` puede no ser un
secret faltante sino un **remapeo de YAML** ausente (el repo ya tiene `SUPABASE_API_URL`, y
`lobby-leylobby-weekly.yml:57` hace exactamente ese remapeo). Se pide verificar eso **antes** de
cargar nada.

**Task 3 — `check-crons.sh` + §7** (commit `7a31b98`)

Gate con el contrato de `check-fechas.sh`: `set -u`, `STRICT=0/1`, POSIX grep, read-only.
C1 (universo cerrado), C2 (evidencia observada), C3 (punteros), C4 (gaps priorizados + §5 + §6),
C5 (reproducibilidad), C6 (anti-secreto), C7 (ids bidireccionales). Salida al cierre:

```
C1a workflows locales: derivado=13 declarado=13 ancla=13
C1b pg_cron vivos: declarado=5 secciones=5 probe(P6)=5
C1c total: 13 + 2 + 5 = 20 · declarado=20 · veredictos 20 (§1.3) / 20 (§2)
C3 punteros=12 · C4 filas con prioridad=11 · C5 re-verificar=21 · C6 0/0/0
=== RESULTADO: 0 falta(s) · STRICT=1
```

## Decisiones de ejecución que valen registro

- **Cero P0 es un resultado, no un hueco.** De los 6 workflows con `schedule:` activo, 5 verdes
  y 1 stale; los dos `failure` del inventario son unidades `no-cron` (uno por WAF declarado, otro
  deuda de operador con vía alternativa viva). Se declaró explícitamente en vez de inflar algún
  P1 a P0 para que la lista "pareciera" seria.
- **El conteo global de `Veredicto: ` da 40, no 20** — cada unidad aparece por diseño en la tabla
  maestra §1.3 **y** en su sección de §2. El plan pedía `grep -c "Veredicto: " == 20`. En vez de
  tocar el documento para que el grep ingenuo cuadrara, el gate cuenta **por región** y exige 20
  en cada una: es más fuerte (obliga a que las dos regiones estén completas por separado) y es
  honesto. Documentado en §7 con la advertencia del 40.
- **C4 casi mintió por regex.** La primera versión exigía la celda `| **P2** |` exacta y contaba
  5 de 11 filas, porque las P2 llevan calificativo (`**P2** (instrumentación)`). Se corrigió el
  patrón —no las filas— y pasó a 11. Un gate que sub-cuenta en silencio es peor que no tenerlo.
- **El patrón anti-secreto se validó con fixture, no por confianza.** Fichero temporal creado
  **fuera del repo** (scratchpad), con los 6 casos positivos (`sk`, `ghp`, `gho`, `eyJ`,
  `sb_secret_`/`sb_publishable_`, hex-40) más una URL de DB: detectó los 7, no marcó el falso
  positivo obvio del castellano (`skip legítimo`), y se borró tras la prueba.
- **Higiene del gate:** `check-crons.sh` contiene los patrones que busca, así que C6 escanea los
  tres artefactos y **nunca** el script; los conteos sobre el documento se toman por región para
  que los bloques de código de §7 no se cuenten a sí mismos.

## Deviations from Plan

Ninguna que altere el alcance. Tres ajustes de método, todos hacia mayor rigor:

1. **`grep -c "Veredicto: " == conteo_total_unidades` → conteo por región.** Ver arriba: el
   literal del plan era insatisfacible sin degradar el documento; se implementó la versión
   estricta y se documentó el porqué en §7.
2. **C2 "un `gh` y un `psql` por región de unidad"** se implementó como: bloques
   `#### Evidencia observada` ≥ nº de unidades (20/20, exacto) **más** presencia de comandos
   `gh` (30) y `psql` (20) en la región §2. Un `psql` por unidad sería falso como exigencia:
   PM-1/PM-2 (platform-managed) y varias unidades `no-cron` no tienen tabla destino, y §2 declara
   esa no-aplicabilidad en vez de fabricar un bloque vacío.
3. **PG-5 no tiene bloque `#### Gaps de esta unidad`** (las secciones `PG-` no lo usan); G11 se
   citó desde el párrafo de la discrepancia del viernes, que es donde el lector la encuentra.

Sin auto-fixes de Rules 1-3: la fase es read-only sobre el producto y no se tocó una línea de
código.

## Verificación

```
STRICT=1 bash check-crons.sh                     → 0 faltas, exit 0
grep anti-secreto sobre los 3 artefactos         → 0 y 0
git status --short | grep -v '^.. \.planning/'   → sólo pnpm-workspace.yaml (PRE-EXISTENTE,
                                                    modificado antes de esta sesión, no tocado)
pnpm --filter ./app test -- --run                → 107 files, 1560 passed — delta CERO vs 117
```

## Known Stubs

Ninguno. Los artefactos son documentación y un script de verificación; no hay superficie de UI
ni datos mockeados.

## Notas para Phase 119

- **§4 es el backlog literal.** Empezar por **G1** (único `stale` del inventario) usando
  `packages/probidad/src/run-probidad-todos.ts` como plantilla del cursor que sí funciona.
- **G5, G6 y G7 convergen a la misma forma de referencia:** `tramitacion` es la única cadena
  dos-etapas completa del proyecto (`putImmutable` con `existed` usado + `SnapshotWriter` +
  `--from-r2`). Es un solo patrón replicado a 3-4 conectores, no cuatro problemas distintos.
- **G8/G9 no son trabajo de agente.** 119 sólo puede re-verificar con `gh secret list`; el acto
  es del operador y ya está pedido.
- **Los veredictos caducan ~14 días** (§6.5). Si 119 arranca después del 2026-08-11, re-correr
  las probes de §0.5 antes de fiarse de un verde.

## Self-Check: PASSED

Los 4 archivos declarados existen en disco; los 3 commits de tarea (`ce817ec`, `f1145c9`,
`7a31b98`) existen en el historial.
