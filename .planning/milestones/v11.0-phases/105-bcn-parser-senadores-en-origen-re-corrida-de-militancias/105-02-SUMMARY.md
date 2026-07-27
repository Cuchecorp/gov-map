---
phase: 105-bcn-parser-senadores-en-origen-re-corrida-de-militancias
plan: 02
subsystem: bio (re-corrida militancias senadores + reconciliación dato PROD)
tags: [bcn, militancia, senadores, from-r2, dos-etapas, uri-a-label, reconciliacion, BCN-01, BCN-02]
requires:
  - "105-01 (parser corregido en el árbol: resolverPartido URI→label fail-closed)"
  - "crudo R2 bio/envelope/2026-07-22/1fab3cb0…json (senadoresSparql — mismo envelope de 105-01)"
  - "PROD Supabase bctyygbmqcvizyplktuw (parlamentario_militancia + parlamentario.partido)"
provides:
  - "Militancias de senadores re-corridas a PROD desde R2 (upsert idempotente, labels limpios)"
  - "parlamentario_militancia + parlamentario con CERO URI-como-partido (verificado post-borrado)"
  - "Decisión BCN-02 documentada con evidencia: partidoLegible() CONSERVADO como defensa en profundidad"
affects:
  - "app/lib/format.ts partidoLegible() (104-03): conservado sin cambios; ya no debería activarse (dato limpio en origen)"
  - "Cruce por partido /parlamentarios: sin regresión (25 grupos, cero URI en la clave de agrupación)"
tech-stack:
  added: []
  patterns:
    - "Dos-etapas LOCKED: re-corrida vía --from-r2 (Etapa 2 relee el crudo R2, CERO red a BCN)"
    - "Reconciliación de valor conocido-malo: DELETE acotado al patrón URI tras el upsert-only"
key-files:
  created:
    - ".planning/phases/105-bcn-parser-senadores-en-origen-re-corrida-de-militancias/105-02-SUMMARY.md"
  modified: []
decisions:
  - "El upsert-only (onConflict parlamentario_id,partido_alias,desde) deja la fila URI vieja stale cuando el alias cambia (URI→label) → se BORRA explícitamente por patrón URI tras el upsert"
  - "Testigo resuelto por PATRÓN URI (robusto), no por id concreta: en PROD la PK id='S1344' y parlid_senado='1344' (numérico, sin prefijo S) — la query del plan por parlid_senado='S1344' da 0 (dato registrado)"
  - "BCN-02: CONSERVAR partidoLegible() como cinturón display-only (defensa en profundidad); NO se retira código"
metrics:
  duration: "~11 min"
  tasks: 4
  files: 1
  completed: "2026-07-27"
---

# Phase 105 Plan 02: Re-corrida de militancias de senadores + reconciliación del dato PROD Summary

Cierra el defecto "URI-como-partido" en el DATO de PROD (no solo en el código): re-corre las militancias de senadores desde el crudo R2 (`--from-r2`, dos-etapas, SIN re-molestar a BCN) con el parser ya corregido por 105-01, BORRA las filas de militancia URI-stale que el upsert-only deja atrás, y verifica CERO URI-como-partido en ambas tablas DESPUÉS del borrado. Documenta la decisión BCN-02 (conservar `partidoLegible()` como defensa en profundidad) con la evidencia post-re-corrida.

## What Was Built

- **Task 1** — Localización + validación del envelope R2 vigente para el replay (dry-run `--from-r2`).
- **Task 2** — Re-corrida REAL `--from-r2` contra PROD (upsert idempotente de militancias limpias + `actualizarPartidoParlamentario` en sitio).
- **Task 3** — Reconciliación del defecto: DELETE acotado al patrón URI de las filas de militancia URI-stale + verificación CERO URI en ambas tablas.
- **Task 4** — Documentación de la decisión BCN-02 + suite verde.

## Task 1 — Envelope R2 identificado y validado

**Key R2 usada (SIN exponer endpoint/credenciales):**
`bio/envelope/2026-07-22/1fab3cb0939333c45cb01b20dcdd9232ca3e584f8d6a78aa2e02589ca4329549.json`

Es el MISMO crudo que 105-01 Task 1 inspeccionó para fundar el mapa URI→label (`senadoresSparql`, 27 URIs). Validado por dry-run `--from-r2` (InMemoryBioWriter, CERO contacto PROD):

```
bio from-r2 (dry-run): militancias=48 partidosActualizados=31 sinMatch=85
```

- **48 militancias** producidas por el parser corregido (labels limpios), **31 partidos** a actualizar.
- **85 sinMatch = `SEN:<parlid>`** (identidad, NO partido): senadores históricos de BCN cuyo `parlid_senado` no está en la maestra de 186 (documentado en 90-03: "85 históricos BCN sin match = fail-closed"). NO fabrica FK.
- **CERO omisiones de partido**: ningún reporte `partidosDesconocidos`/`SIN_LABEL`. Confirma la predicción de 105-01: el mapa cubre las 27 URIs de este envelope → **URIs-del-crudo vs mapa-105-01 = cobertura completa, cero URI no-cubierta** → no hay militancia omitida por partido desconocido.

**Testigo (S1344 / S1328):** ninguno aparece en el sinMatch → ambos se enlazan y re-emiten con label limpio.

## Task 2 — Re-corrida REAL `--from-r2` a PROD

Ejecutada sin `--dry-run` (writer Supabase, Etapa 2 desde R2, CERO red a BCN):

```
bio from-r2 (LIVE): militancias=48 partidosActualizados=31 sinMatch=85
```

**Baseline PRE-re-corrida (PROD):**

| Tabla | `partido ~* '^https?://'` (pre) |
|---|---|
| `parlamentario_militancia` | **3** |
| `parlamentario` | **1** |

**Filas URI stale (pre), acotadas por patrón (PII-safe, sin nombres):**

| parlamentario_id | partido (trunc) | desde | es_actual |
|---|---|---|---|
| S1328 | `…/partido-politico/pa…` | 2021-08-01 | f |
| S1328 | `…/partido-politico/pa…` | 2024-06-05 | f |
| S1344 | `…/partido-politico/pa…` | 2022-11-02 | **t** |

**Verificación parcial POST-upsert (pre-Task 3):**

- **(b) `parlamentario` URI count == 0** — la columna de la tabla persona se limpió EN SITIO (`.update().eq(id)`).
- `parlamentario_militancia` URI count = **3** (aún stale — el upsert-only NO borra; el alias cambió → clave natural distinta → coexisten fila limpia + fila URI vieja). Es el defecto que reconcilia Task 3.
- **Testigo S1344** (resuelto por id — ver nota abajo): `parlamentario.partido` = **"Partido Demócratas de Chile"** (legible, no URI). Militancia vigente insertada limpia: `Partido Demócratas de Chile | PD | 2022-11-02 | es_actual=t`, junto a la URI vieja (misma `desde`, alias = URI entero).

**Nota de resolución del testigo (dato registrado):** en PROD la PK es `parlamentario.id = 'S1344'` y `parlamentario.parlid_senado = '1344'` (numérico, SIN prefijo `S`). Por eso la query del plan `where parlid_senado = 'S1344'` devuelve 0. Se resolvió el testigo por el **PATRÓN URI** (robusto) y se corroboró por `id`, como el plan exige ("resolver por el patrón, NUNCA asumiendo que la PK es S1344"). El re-corrida enlaza a S1344/S1328 por `parlid_senado` numérico (`1344`/`1328` ausentes del sinMatch).

**No-regresión del cruce por partido:** `/parlamentarios` sigue agrupando — **25 grupos** de partido sobre 186 parlamentarios, CERO URI en la clave de agrupación:

```
grupos_partido=25  con_partido=186  URI_en_partido=0
Top: Partido Republicano 28 · Independientes 25 · Frente Amplio 16 · Partido de la Gente 14 · UDI 13 …
```

## Task 3 — Reconciliación de filas URI-stale (DELETE acotado) + verificación CERO URI

Reconciliación de un VALOR CONOCIDO-MALO (un URI donde va un label de partido) — NO fabricación. El upsert de Task 2 ya insertó la fila LIMPIA; la vieja URI persistía por clave natural distinta.

**PRE-borrado:** `count(*) parlamentario_militancia where partido ~* '^https?://'` = **3** (testigo del defecto).

**Borrado** (`--single-transaction`, ACOTADO al patrón URI, sin imprimir la URL):

```sql
delete from parlamentario_militancia where partido ~* '^https?://';   -- DELETE 3
```

**POST-borrado — verificación CERO URI (evidencia):**

| Verificación | Resultado |
|---|---|
| (a) `parlamentario_militancia` URI count | **0** ✅ |
| (b) `parlamentario` URI count | **0** ✅ (ya de Task 2) |

**Testigo POST-borrado:**

- **S1344**: solo militancias limpias — vigente `Partido Demócratas de Chile | PD | 2022-11-02 | es_actual=t` + histórica `Partido Demócrata Cristiano | PDC | 2010-03-11`. **0 filas URI**; **exactamente 1** militancia vigente (antes había 2 por el duplicado URI).
- **S1328**: las 2 URIs stale (`partido-republicano-de-chile`, `partido-social-cristiano`) quedaron reemplazadas por labels limpios (`Partido Republicano de Chile | PR`, `Partido Social Cristiano | PSC`); vigente `Independiente` (2025-04-29). **0 filas URI**.

**URIs desconocidas omitidas por el parser:** **ninguna** en este envelope (cero `partidosDesconocidos` — el mapa de 105-01 cubre las 27 URIs). Por tanto ninguna militancia quedó sin re-emitir por partido desconocido; el DELETE cubrió exactamente las 3 filas del defecto original.

## Task 4 — Decisión BCN-02 (partidoLegible)

**Decisión LOCKED (operador, CONTEXT.md): CONSERVAR `app/lib/format.ts:153 partidoLegible()`** como cinturón display-only de **defensa en profundidad**. NO se elimina código en este plan.

**Justificación con evidencia post-re-corrida:** dado que el dato en PROD quedó limpio (CERO URI en `parlamentario_militancia` Y `parlamentario` tras el upsert + la reconciliación de filas stale), `partidoLegible()` **ya NO debería activarse en la práctica** (no hay URI que derivar). Se conserva como protección barata e idempotente ante una regresión futura del parser o un dato BCN nuevo que reintrodujera un URI.

- `app/lib/format.ts` **NO fue modificado** (confirmado por `git status` limpio).
- Sus tests permanecen verdes: `lib/format.test.ts` **42/42** (incluye los tests de `partidoLegible`).
- Sus 3 consumidores intactos: `partido-chip.tsx`, `militancias-de-parlamentario.tsx`, `parlamentarios-filtro.tsx`.
- **Deferred**: retiro definitivo de `partidoLegible()` solo si evidencia futura lo justifica (CONTEXT.md deferred).

## Verification

| Check | Resultado |
|---|---|
| Re-corrida `--from-r2` a PROD (Etapa 2 desde R2, sin re-scrapear BCN) | ✅ militancias=48, partidosActualizados=31 |
| `parlamentario_militancia` `partido ~* '^https?://'` (post-borrado) | **0** ✅ |
| `parlamentario` `partido ~* '^https?://'` (post-upsert) | **0** ✅ |
| Testigo (S1344) militancia vigente legible, sin URI, 1 vigente | ✅ |
| Cruce por partido `/parlamentarios` sin regresión | ✅ 25 grupos, 0 URI |
| `@obs/bio` tests | **70/70** ✅ + tsc EXIT 0 |
| `app` suite | **1428/1428** ✅ (2 flakes de timeout bajo carga full-suite en la 1ª pasada; verdes al re-correr — patrón pre-existente STATE.md) |
| `lib/format.test.ts` (partidoLegible) | **42/42** ✅ |
| `tsc -b` (root) | EXIT 0 ✅ |
| `app/lib/format.ts` sin cambios | ✅ (git status limpio) |

## Deviations from Plan

**1. [Rule 1 — Dato] La query del testigo del plan por `parlid_senado = 'S1344'` no resuelve; se usó el patrón URI (robusto) + `id`.**
- **Found during:** Task 2/3.
- **Issue:** En PROD la PK es `parlamentario.id = 'S1344'` y `parlamentario.parlid_senado = '1344'` (numérico, sin prefijo `S`). La query literal del plan (`where parlid_senado = 'S1344'`) devuelve 0 filas — no es un bug del dato, es que el plan asumió una forma de la id distinta a la real.
- **Fix:** El plan ya mandaba resolver el testigo/borrado por el PATRÓN URI, NUNCA por una id concreta. Se siguió esa vía (robusta): el DELETE y la verificación se acotan por `partido ~* '^https?://'`, y el testigo se corrobora por `id='S1344'`. Cero id hardcodeada en la lógica de borrado.
- **Files modified:** ninguno (solo la forma de las consultas de verificación).
- **Commit:** N/A (acción DB + verificación, sin cambio de código).

Fuera de eso: plan ejecutado como fue escrito. La re-corrida, el DELETE y las verificaciones dieron exactamente los conteos predichos por 105-01 (3 filas URI, cero omisiones de partido).

## Authentication Gates

None. R2 (lectura del crudo) y Supabase PROD (write de datos + read-only checks) usaron las credenciales de `.env`; la URL/keys NUNCA se imprimieron. El write de militancias + el DELETE son acciones de DATOS permitidas al agente (NO flag `*_PUBLIC_ENABLED`, NO sign-off legal, NO write de RUT).

## Known Stubs

None. Los 85 `SEN:<parlid>` sin match son senadores históricos BCN fuera de la maestra actual (fail-closed por diseño, no un stub); no producen fila en PROD.

## Self-Check: PASSED

- FOUND: .planning/phases/105-bcn-parser-senadores-en-origen-re-corrida-de-militancias/105-02-SUMMARY.md
- VERIFIED: `parlamentario_militancia where partido ~* '^https?://'` == 0 (PROD, post-borrado)
- VERIFIED: `parlamentario where partido ~* '^https?://'` == 0 (PROD)
- VERIFIED: app/lib/format.ts sin cambios (git status limpio) — partidoLegible conservado (BCN-02)
- VERIFIED: @obs/bio 70/70 + tsc 0; app 1428/1428; tsc -b 0
