---
phase: 119-cron-fix-robustez-de-ingesta
plan: 01
subsystem: freshness
tags: [cron, freshness, instrumentacion, honestidad, G2, G4, G10]
requires:
  - "118-CRON-VERDICTS.md §4 (gap-list G2/G4/G10) como fuente de verdad"
provides:
  - "pnpm freshness arranca desde la raíz (tsx hoisteado)"
  - "workflowYml nullable = ausencia DECLARADA de workflow (sin 404 fabricados)"
  - "ghRun incorporado al cálculo de stale + motivoStale por fuente"
  - "lobby-camara y fichas miden tabla PROPIA de su cron"
affects:
  - "Phase 125 (E2E re-verifica freshness)"
  - "cierre del milestone v12.0 (todas las verificaciones que se apoyan en pnpm freshness)"
tech-stack:
  added: []
  patterns:
    - "fail-closed sobre el DATO, no sobre el medidor (gh caído ≠ cron averiado)"
    - "degradación honesta con tres cadenas distinguibles, no una sola 'n/d'"
key-files:
  created: []
  modified:
    - package.json
    - pnpm-lock.yaml
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/query-runner.ts
    - packages/freshness/src/evaluate.ts
    - packages/freshness/src/evaluate.test.ts
    - packages/freshness/src/cli.ts
decisions:
  - "G10 cerrado por vía (a) (tsx en la raíz); la vía (b) (pnpm --filter exec) se DESCARTÓ empíricamente porque mueve el cwd y rompe loadEnv del .env de la raíz"
  - "motivoStale se renderiza pegado a la columna Estado (última, sin pad) en vez de añadir una columna nueva: expone el porqué sin ensanchar el layout"
  - "ghRunEsAveria devuelve false para 'n/d' (gh falló): no se afirma avería del cron desde un fallo del instrumento"
metrics:
  tasks: 3
  commits: 4
  duration: ~35min
  completed: 2026-07-28
  tests: "packages/freshness 47 → 57; suite completa 1560 verde"
---

# Phase 119 Plan 01: Instrumento de frescura — G10/G2/G4 Summary

Cierra los tres gaps de INSTRUMENTO que 118 §4 detectó sobre `packages/freshness`: la herramienta no arrancaba (G10), fabricaba dos HTTP 404 por workflows inexistentes (G2), y mostraba `ghRun` sin usarlo mientras dos señales medían tablas que llena OTRO cron (G4, "verde prestado").

## Qué se hizo

### G10 — `pnpm freshness` arranca desde la raíz
`tsx ^4.22.4` declarado en `devDependencies` de la raíz. La versión es exactamente la que ya resolvía `packages/freshness` y ya estaba en `pnpm-lock.yaml`: el diff del lockfile son 3 líneas que solo declaran la dependencia existente en el importer `.`, sin agregar ningún paquete nuevo (T-119-SC respetado).

La vía (b) del plan (`pnpm --filter @obs/freshness exec tsx src/cli.ts`) se probó empíricamente y quedó **DESCARTADA**: `pnpm --filter exec` reporta `cwd = packages/freshness`, con lo que `cli.ts:296` (`loadEnv(process.cwd())`) dejaría de encontrar el `.env` de la raíz — el gotcha v8.1 exacto que G10 citaba. La constancia de la decisión vive en la clave `//tsx-raiz` de `package.json` (no se pudo poner dentro de `devDependencies`: pnpm rechaza claves `//x` ahí con `ERR_PNPM_INVALID_PACKAGE_NAME`).

### G2 — `workflowYml` nullable, sin 404 fabricados
`FuenteConfig.workflowYml` pasa a `string | null`. `chilecompra` y `servel` lo declaran `null`, conservando los comentarios que ya explicaban el gating legal MONEY/SERVEL. `query-runner.ts` omite la llamada a `gh run list` cuando es null y emite la cadena propia `"n/d (sin workflow)"`, explícitamente distinta de `"n/d (sin corridas)"` (el workflow existe y nunca corrió) y de `"n/d"` (la llamada a `gh` falló) — tres degradaciones distintas y honestas.

**Cero YAML creados.** `.github/workflows/chilecompra-weekly.yml` y `servel-weekly.yml` siguen sin existir. Ambas señales siguen reportando `stale:true` (estado esperado de §4.1, intacto).

### G4 — matar el verde prestado
Dos reapuntes de tabla, cada uno verificado por `psql` read-only contra el schema de PROD antes de commitear (lección A2 de 118 §5: las columnas temporales no son uniformes — ambas resultaron ser `fecha_captura`):
- `lobby-camara`: `lobby_audiencia` → `lobby_contraparte` (tabla propia del conector de Cámara, `upsertContrapartes`)
- `fichas`: `proyecto` → `proyecto_ficha` (tabla propia del pipeline de fichas)

En `evaluate.ts`, `ghRunEsAveria(ghRun)` (función pura exportada) devuelve `true` solo para `conclusion` distinta de `success`/`skipped` y para `"n/d (sin corridas)"`; `false` para `"n/d (sin workflow)"` y `"n/d"`. `stale = staleTemporal || ghRunEsAveria(ghRun)` — un OR, por lo que solo puede **añadir** stale honesto, nunca quitarlo. Se añadió `motivoStale: string | null` a `FuenteResult` (`"sin dato"` / `"dias>umbral"` / `"gh-failure"`), presente en `--json` y renderizado en la tabla ANSI pegado a la columna `Estado` (`STALE (gh-failure)`) — como `Estado` es la última columna y no lleva `pad`, el layout no se ensancha.

## Diff `--json` antes/después (criterio "ninguna señal pasa de stale a fresca")

```
fuente            antes   ahora   motivo         tabla                       gh
leyes             false   false   null           proyecto                    success @ 2026-07-27
leyes-min-edad    false   false   null           proyecto                    success @ 2026-07-27
agenda            false   false   null           citacion                    success @ 2026-07-27
lobby-camara      false   TRUE    dias>umbral    lobby_contraparte           failure @ 2026-07-07
lobby-leylobby    true    true    dias>umbral    lobby_ingesta_estado        success @ 2026-07-22
probidad          false   false   null           declaracion                 success @ 2026-07-23
fichas            false   TRUE    gh-failure     proyecto_ficha              n/d (sin corridas)
chilecompra       true    true    sin dato       contratos_ingesta_estado    n/d (sin workflow)
servel            true    true    sin dato       aportes_ingesta_estado      n/d (sin workflow)

REGRESION stale->fresh: []
```

El fix **muerde en producción**: `lobby-camara` estaba verde solo porque `lobby_audiencia` la refrescaba el conector leylobby (su `gh` lleva en `failure` desde 2026-07-07), y `fichas` estaba verde porque medía `proyecto`, que llena el cron de tramitación. Ambas caen a STALE honesto. Cero regresiones stale→fresh.

## Verificación

| Check | Resultado |
|-------|-----------|
| `pnpm freshness --json` primer carácter | `{` (exit 1 = hay stale, legítimo) |
| `pnpm freshness --help` | exit 0, sin `command not found: tsx` |
| `pnpm freshness 2>&1 >/dev/null \| grep -c 'HTTP 404'` | `2` → `0` |
| `grep -c 'workflowYml: null' catalog.ts` | `2` exacto |
| `ls .github/workflows/{chilecompra,servel}-weekly.yml` | sigue fallando (no existen) |
| `grep -c 'tabla: "lobby_audiencia"'` | `0` |
| `pnpm --filter @obs/freshness test` | 57/57 (47 antes) |
| `pnpm test` (suite completa) | 1560 verde, guards incluidos |
| `tsc -b` | exit 0 |

TDD gate de Task 3: commit `test(...)` RED (`51b9420`, 10 tests en rojo) → commit `feat(...)` GREEN (`1b2d364`, 57/57). REFACTOR no fue necesario.

## Reglas LOCKED

Este plan solo toca el INSTRUMENTO de medición: no hay conector, ingesta, ni escritura. Las dos etapas (fuente→R2→Supabase), el hash-check y el rate-limit 2-3s quedan intactos por no ser tocados. Toda la interacción con PROD fue `psql` read-only sobre `information_schema` para verificar nombres de columna; jamás se imprimió `SUPABASE_DB_URL` ni valor de secreto alguno.

Degradación honesta preservada y reforzada: no se creó ningún YAML para callar un 404 (eso habría sido fabricar cobertura de señal), y el fix de stale solo puede añadir stale, nunca quitarlo.

## Deviations from Plan

Dos ajustes menores, ambos dentro de Rule 3 (desbloqueo):

**1. [Rule 3 - Blocker] La constancia de la decisión de G10 no cabe en `devDependencies`**
- **Encontrado en:** Task 1
- **Problema:** pnpm rechaza una clave-comentario `"//tsx"` dentro de `devDependencies` con `ERR_PNPM_INVALID_PACKAGE_NAME`.
- **Fix:** la constancia se movió a la clave raíz `//tsx-raiz` de `package.json` (el plan permitía "package.json o SUMMARY"; queda en ambos).
- **Commit:** `9e640bc`

**2. [Rule 3 - Blocker] Dos tests preexistentes congelaban el nombre del `.yml` inexistente**
- **Encontrado en:** Task 2
- **Problema:** `evaluate.test.ts` aseveraba `workflowYml === "chilecompra-weekly.yml"` / `"servel-weekly.yml"` — el contrato viejo que G2 justamente deroga.
- **Fix:** actualizados a `toBeNull()` con comentario que explica el cambio de contrato. No se debilitó ninguna aserción: el resto del caso (tabla/columna/umbral/override) queda idéntico.
- **Commit:** `edfdf6d`

Un tercer ajuste de redacción: dos comentarios usaban la forma literal `workflowYml: null`, lo que hacía que `grep -c 'workflowYml: null'` devolviera 4 en vez de los 2 exigidos por el acceptance criterion. Se reescribieron a "el campo `workflowYml` va en nulo" para que el grep mida solo declaraciones reales.

## Known Stubs

Ninguno. Todo lo que este plan expone está cableado a datos reales.

## Gaps de 119 que este plan NO cierra

G1, G3, G5, G6, G7, G9 siguen abiertos (otros planes de la fase). G8 y el `GEMINI_API_KEY` de G9 son actos de operador con checkpoint ya emitido en 118 — no se re-piden. G11 requiere ≥2 semanas de observación.

## Self-Check: PASSED

- `packages/freshness/src/catalog.ts` FOUND
- `packages/freshness/src/evaluate.ts` FOUND (contiene `ghRunEsAveria`)
- `packages/freshness/src/query-runner.ts` FOUND
- `package.json` FOUND (contiene `freshness` y `tsx`)
- Commits `9e640bc`, `edfdf6d`, `51b9420`, `1b2d364` FOUND en `git log`
