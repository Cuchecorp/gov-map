---
phase: 133-news-taxo
plan: b-01
subsystem: news-eval
tags: [golden-set, r2, reconstruccion, pool]
dependency-graph:
  requires: []
  provides: [pool-133b.json, construirPool, reconstruirPool]
  affects: [133-b-02]
tech-stack:
  added: []
  patterns: ["join puro snapshots-R2 x poblacion-DB", "fail-closed sobre reconstrucción parcial"]
key-files:
  created:
    - packages/news/src/eval/pool-r2.ts
    - packages/news/src/eval/pool-r2.test.ts
    - packages/news/src/eval/pool-r2-cli.ts
    - packages/news/src/eval/pool-r2-cli.test.ts
    - packages/news/src/eval/pool-133b.json
  modified:
    - packages/news/src/run-news-cli.ts
decisions: []
metrics:
  duration: "~50 min"
  completed: "2026-08-07"
---

# Phase 133 Plan b-01: pool-r2.ts + pool-r2-cli.ts — reconstrucción del texto de la ventana desde R2

Join puro (`construirPool`) + CLI de reconstrucción real (`reconstruirPool`) que re-derivan
titular+bajada de los 579 casos de la ventana 2026-08-05..07 desde el crudo de R2, congelados
en `pool-133b.json` — con reconstrucción medida 579/579 (100 %) contrastada contra Postgres.

## Qué NO se cumplió

Nada. Los 15 gates numéricos, los 3 asserts contra Postgres, las 5 mutaciones y el diff
acotado de `run-news-cli.ts` salieron todos verdes en la primera corrida, sin ajustar ningún
número esperado.

## Números medidos

**`SHA_BASE`** (antes de tocar nada): `aa800a4142593055e766e866d331da3d4ff1a5f8`

**Conteos de tests (NO_COLOR=1, conteo impreso, no exit code):**

| Momento | Tests | Delta |
|---|---|---|
| `N_ANTES` (antes del plan) | 268 | — |
| `N_T1` (tras Task 1 — pool-r2.ts) | 275 | +7 |
| `N_T2` (tras Task 2 — pool-r2-cli.ts) | 278 | +3 |
| **Total del plan** | | **+10** (coincide con el delta fijo declarado) |

**Línea `pool: ...` de la corrida real** (`pnpm --filter @obs/news exec tsx src/eval/pool-r2-cli.ts`):

```
pool: snapshots=15 itemsParseados=735 hashesUnicos=579 poblacion=579 reconstruidos=579
faltantes=0 sobrantes=0 sinDescripcion=63 erroresParseo=0 tituloVacio=0
pOutletLatercera=50 pOutletLacuarta=11 pOutletExante=6 pOutletBiobiochile=6
pOutletCooperativa=1 pTotal=74
```

Todas las cifras coinciden exactamente con `133-b-PREMORTEM.md` (15 snapshots, 579 población,
579 reconstruidos, 0 faltantes/sobrantes, 63 sin descripción, censo P 50/11/6/6/1=74). Ningún
número se ajustó — se citan tal cual salieron.

**Contraste independiente contra Postgres (`psql -tA | tr -d '\r'`):**

```
NP (noticia_url_vista)              = 579   → test "$NP" -eq 579        → OK
NS (source_snapshot source='news')  = 15    → test "$NS" -eq 15         → OK
NP == poblacion del CLI (579 == 579)         → test "$NP" -eq "$(get poblacion)" → OK
```

**Anti-project-ref (`cat f1 f2 | grep -cE`):** `project_ref_hits=0` (control positivo sobre
cadena de prueba dio `1`, confirmando que el patrón sí detecta cuando corresponde).

**Diff acotado de `run-news-cli.ts`** (B6, contra `SHA_BASE`): exactamente **2** líneas
añadidas:
```
+export function loadEnv(root: string): Record<string, string> {
+export function slugDesdeR2Path(r2Path: string): string | null {
```

**`pool-133b.json`:** `sha256=d1e6ed00d1ac1183049412fa767eca7cef4e3de724992e91d6ad60f28e40b754`
— **este NO es el hash del `golden-set.json`**; ese se emite una sola vez, al final, en el
plan 07. Confirmado byte-idéntico en una segunda corrida (mismo sha256). Los 579 casos validan
individualmente contra `PoolCasoSchema` (579 ok, 0 fallos).

## Mutaciones (las 5, todas rojas nombrando su `it`, todas revertidas)

| Mutación | Archivo | Resultado |
|---|---|---|
| A — `faltantes` fijo a `[]` | pool-r2.ts | rc≠0, log nombra `(b)` |
| B — quitar el `throw` de población vacía | pool-r2.ts | rc≠0, log nombra `(d)` |
| C — hash sin canonicalizar (`sha256Hex` directo sobre `item.link`) | pool-r2.ts | rc≠0, log nombra `(f)` |
| D — quitar `.strict()` de `PoolCasoSchema` | pool-r2.ts | rc≠0, log nombra `(g)` |
| E — fail-closed degradado a `console.warn` | pool-r2-cli.ts | rc≠0, log nombra `(c)` |

## Lo que sí se cumplió

- El texto de los 579 casos de la ventana existe fuera de Supabase, re-derivado del crudo de
  R2 (`pool-133b.json`), sin re-scrapear la fuente (`getObject` es la única entrada de red).
- Reconstrucción biyectiva: 579/579, 0 faltantes, 0 sobrantes, 0 errores de parseo, contrastada
  contra Postgres con `test`, no solo `echo`.
- Composición del censo P como gate ejecutable (50/11/6/6/1=74, `tituloVacio=0`).
- `sinDescripcion=63` registrado como población honesta, no como descarte.
- `run-news-cli.ts` tocado en exactamente 2 líneas (dos `export`), verificado con `git diff`.
- Cero `pnpm add`; `zod`/`fast-xml-parser`/`@supabase/supabase-js` ya eran dependencias
  directas.
- `pnpm --filter @obs/news exec tsc --noEmit` sin errores.

## Deviations from Plan

None — plan ejecutado exactamente como escrito. No hubo necesidad de escalar ninguna
discrepancia: todos los números cuadraron en la primera corrida.

## Known Stubs

Ninguno. `pool-133b.json` es el artefacto final de este plan (no un placeholder), consumido
por 133-b-02 para el muestreo.

## Threat Flags

Ninguno — la superficie de este plan coincide exactamente con lo declarado en el
`<threat_model>` de `133-b-01-PLAN.md` (T-133-30 a T-133-36, T-133-60, T-133-SC), todas
mitigadas y verificadas arriba.

## Self-Check: PASSED

- `packages/news/src/eval/pool-r2.ts` — FOUND
- `packages/news/src/eval/pool-r2.test.ts` — FOUND
- `packages/news/src/eval/pool-r2-cli.ts` — FOUND
- `packages/news/src/eval/pool-r2-cli.test.ts` — FOUND
- `packages/news/src/eval/pool-133b.json` — FOUND
- commit `a44b78c` (Task 1) — FOUND en `git log --oneline`
- commit `4cbf6eb` (Task 2) — FOUND en `git log --oneline`
