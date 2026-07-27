---
phase: 70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
plan: 02
subsystem: freshness + dinero (guard)
tags: [MONEY-01, DEBT-01, freshness, staleness, guard, frozen, chilecompra, gate-off]
requires:
  - "packages/freshness/src/catalog.ts (patrón CATALOG declarativo, 6 fuentes previas)"
  - "packages/freshness/src/evaluate.ts (evaluador staleness — reusado tal cual)"
  - "supabase/migrations/0023_dinero.sql (tabla contratos_ingesta_estado, columna ingestado_hasta — EXISTENTE)"
  - "packages/dinero/src/reconciliar-contrato.ts + model.ts (firmas LOCKED — protegidas, no tocadas)"
  - "app/lib/money-gate.ts (gate OFF — re-verificado, no tocado)"
provides:
  - "señal freshness ChileCompra (staleness sobre contratos_ingesta_estado.ingestado_hasta, umbral 30d)"
  - "reconciler-frozen-guard.test.ts (guard que MUERDE si reconciliar-contrato/model/0023 se debilitan)"
affects:
  - "pnpm freshness (ahora cubre 7 fuentes; ChileCompra reporta STALE honesto ≈ 0 cobertura hoy)"
tech-stack:
  added: []
  patterns:
    - "CATALOG declarativo: añadir una entrada basta; queryFreshness + evaluate la consumen sin cambios"
    - "guard-como-test (vitest): detector puro + mutation self-check EN MEMORIA (espejo Phase 69)"
key-files:
  created:
    - "packages/dinero/src/reconciler-frozen-guard.test.ts"
  modified:
    - "packages/freshness/src/catalog.ts"
    - "packages/freshness/src/evaluate.test.ts"
decisions:
  - "ChileCompra mide contratos_ingesta_estado.ingestado_hasta (marcador de barrido), NO contrato.fecha_captura — espejo lobby-leylobby: distingue 'consultado sin contratos' de 'no consultado'"
  - "Cero migraciones nuevas: columna EXISTENTE de 0023 (Pitfall 6 respetado)"
  - "El guard frozen-reconciler es ESTÁTICO (fs + regex sobre texto) + mutation self-check; complementa el corte CR-01 de Phase 69 a nivel de archivo-intacto"
  - "MONEY gate re-verificado OFF sin flip; anti-flip Phase 69 verde"
metrics:
  duration: "~6 min"
  tasks: 2
  files: 3
  completed: "2026-07-14"
---

# Phase 70 Plan 02: ChileCompra freshness staleness + frozen-reconciler guard + MONEY-gate-OFF re-verify Summary

Señal de staleness de ChileCompra añadida al catálogo de `pnpm freshness` (staleness declarativa sobre `contratos_ingesta_estado.ingestado_hasta`, umbral 30d, degradación honesta ≈ 0 hoy) + un guard que MUERDE si el reconciliador jurídico RUT-only / el `monto` VERBATIM / la migración 0023 se debilitan; el gate `MONEY_PUBLIC_ENABLED` re-verificado OFF sin flip.

## What Was Built

### Task 1 — Señal CATALOG ChileCompra (`feat(70-02)` → `a2187a4`)
- Nueva entrada en `CATALOG` (`packages/freshness/src/catalog.ts`): `fuente:"chilecompra"`, `tabla:"contratos_ingesta_estado"`, `columna:"ingestado_hasta"`, `umbralDias:30`, `overrideEnv:"FRESHNESS_UMBRAL_CHILECOMPRA"`, `workflowYml:"chilecompra-weekly.yml"`.
- **Decisión clave (resuelta del RESEARCH Open Question 1):** se mide `contratos_ingesta_estado.ingestado_hasta` (marcador de barrido por-parlamentario, 0023) y NO `contrato.fecha_captura` — MISMO patrón que `lobby-leylobby`: el marcador distingue "consultado sin contratos" (barrido al día, 0 filas en `contrato`) de "no consultado" (marcador null/viejo). Un `MAX(contrato.fecha_captura)` no puede distinguir esos dos casos.
- El evaluador `evaluate.ts` se **reusa TAL CUAL** — la entrada declarativa basta; `queryFreshness` genera `SELECT MAX(ingestado_hasta) FROM contratos_ingesta_estado` automáticamente.
- `workflowYml:"chilecompra-weekly.yml"` aún NO existe (el flip MONEY vive en Phase 73) → la señal de GH Actions figura `n/d` (comportamiento honesto, no error).
- `evaluate.test.ts`: 5 casos ChileCompra nuevos (entrada existe; stale-null; stale > umbral; fresh <= umbral; override). Test "6 catalog entries" → "7".
- **Cero migraciones** (columna existente de 0023). `git diff supabase/migrations/` → exit 0.

### Task 2 — Guard frozen-reconciler + re-verify MONEY OFF (`test(70-02)` → `f547efe`)
- `packages/dinero/src/reconciler-frozen-guard.test.ts` (nuevo): guard-como-test (misma suite que `name-match-rut-guard.behavior.test.ts` de Phase 69) con detector PURO `detectarDebilitamientos` + mutation self-check EN MEMORIA + no-falsos-positivos. Congela TRES firmas LOCKED:
  - **LOCKED-1 (reconciliar-contrato.ts — rama jurídica RUT-only):** la guarda `c.tipoPersona !== "natural"` retorna ANTES de `correrPipeline`; la resolución de entidad jurídica va por `resolverEntidadProveedor`/`matchDeterministaEntidad` (solo RUT). Aserción estructural: `correrPipeline` DEBE aparecer DESPUÉS de la guarda jurídica (si aparece antes → una jurídica se name-linkearía → offender LOCKED-1c).
  - **LOCKED-2 (model.ts — monto VERBATIM):** `monto: string | null` (interfaz) + `monto: z.string().nullable()` (Zod); ni `number` ni `z.number()`. Protege CR-02 (el monto se preserva literal, sin cómputo).
  - **LOCKED-3 (0023_dinero.sql — header + tabla intactos):** header `-- 0023_dinero.sql` + `create table contratos_ingesta_estado` + columna `ingestado_hasta`.
- **MONEY gate re-verificado OFF:** `moneyPublicEnabled` = `env.MONEY_PUBLIC_ENABLED === "true"` (solo el literal "true" enciende); `.env.example` = `false`; `money-gate.ts` NO tocado. Anti-flip de Phase 69 (`name-match-rut-guard`) verde.

## Deviations from Plan

None — el plan se ejecutó exactamente como fue escrito. Se añadió una aserción extra "la entrada chilecompra existe" y un caso de override en Task 1 (cobertura de firma más explícita, no un cambio de alcance).

## What Each Guard Assertion Protects (mutation self-check descrito)

| Firma LOCKED | Aserción del guard | Qué rompe / MUERDE |
|--------------|--------------------|--------------------|
| LOCKED-1a | existe `c.tipoPersona !== "natural"` (guarda de salida temprana) | borrar la guarda → jurídica cae al fallback `correrPipeline` (name-link) |
| LOCKED-1b | existen `resolverEntidadProveedor` + `matchDeterministaEntidad` | perder la resolución determinista por RUT de entidad jurídica |
| LOCKED-1c | `correrPipeline` aparece DESPUÉS de la guarda jurídica | mover `correrPipeline` antes → jurídica al LLM por nombre |
| LOCKED-2a/b/c | `monto: string \| null` + `z.string().nullable()`; nunca `number`/`z.number()` | cambiar `monto` a numeric → cómputo sobre un no-monto (CR-02) |
| LOCKED-3a | header `-- 0023_dinero.sql` | re-numerar/alterar la migración (checkpoint operador aplicado) |
| LOCKED-3b | `create table contratos_ingesta_estado` + `ingestado_hasta` | borrar la tabla/columna sobre la que mide la señal freshness |

El mutation self-check (5 fixtures EN MEMORIA que rompen cada eje) confirma que el detector NO es un no-op verde: cada firma rota produce ≥1 offender. La "base válida" produce 0 offenders (no es un falso-positivo permanente).

## Verification Results

- `pnpm --filter @obs/freshness test` → **31 passed** (incl. 5 ChileCompra).
- `pnpm --filter @obs/freshness typecheck` (`tsc -b`) → **verde**.
- `pnpm --filter @obs/dinero test` → **128 passed / 16 files** (incl. `reconciler-frozen-guard` 13 tests).
- `pnpm --filter ./app test money-gate` → **5 passed** (gate OFF salvo literal "true").
- `pnpm --filter ./app test name-match-rut-guard` → **15 passed** (anti-flip Phase 69 sin regresión).
- `pnpm freshness` → **corre**; imprime la fila `chilecompra | — | ? | 30 | n/d | n/d (sin snapshots) | STALE` — staleness honesta ≈ 0 cobertura hoy (sin crawl LIVE, `ingestado_hasta` null → STALE fail-closed). Exit 1 = comportamiento de diseño del CLI (`process.exit(anyStale ? 1 : 0)`), no un crash.
- `git diff --exit-code -- packages/dinero/src/reconciliar-contrato.ts packages/dinero/src/model.ts supabase/migrations/0023_dinero.sql app/lib/money-gate.ts` → **exit 0** (archivos LOCKED intactos).
- `git diff --exit-code -- supabase/migrations/` → **exit 0** (cero migraciones nuevas).

## Threat Model Coverage

- **T-70-06 (Tampering — refactor rompe corte RUT-only / monto VERBATIM):** mitigado por `reconciler-frozen-guard.test.ts` (LOCKED-1/2, muerde con mutation self-check).
- **T-70-07 (EoP — flip accidental del gate MONEY):** mitigado; `money-gate` re-corrido OFF + anti-flip Phase 69 verde; `money-gate.ts` no tocado.
- **T-70-08 (Info Disclosure — señal freshness expone contrato/RUT):** mitigado; la señal mide `ingestado_hasta` (agregado de barrido, MAX de una fecha), NUNCA proyecta monto/RUT/contrato — counts/timestamps only.

## Known Stubs

`chilecompra-weekly.yml` (workflow GH Actions) aún NO existe intencionalmente — el flip MONEY (encendido de la ingesta + gate) es un checkpoint humano de **Phase 73** (sign-off legal 21.719). Hasta entonces la señal de GH Actions figura `n/d` (honesto). No es un stub de datos: es la degradación esperada declarada por el RESEARCH.

## Self-Check: PASSED

- FOUND: packages/dinero/src/reconciler-frozen-guard.test.ts
- FOUND (modificado): packages/freshness/src/catalog.ts (entrada chilecompra)
- FOUND (modificado): packages/freshness/src/evaluate.test.ts (5 casos ChileCompra)
- FOUND: commit a2187a4 (feat 70-02)
- FOUND: commit f547efe (test 70-02)
