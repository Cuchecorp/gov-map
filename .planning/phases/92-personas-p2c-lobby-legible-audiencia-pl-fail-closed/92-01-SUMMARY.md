---
phase: 92-personas-p2c-lobby-legible-audiencia-pl-fail-closed
plan: 01
subsystem: lobby / audiencia→PL fail-closed (canal de datos)
tags: [LOB-02, extractor, boletin, rpc, fail-closed, pgtap, equivalencia-ts-sql]
requires:
  - app/lib/boletin-detector.ts (portada del formato de boletín)
  - supabase/migrations/0021_lobby.sql (lobby_audiencia + lobby_contraparte)
  - supabase/migrations/0008_tramitacion.sql (proyecto.boletin / boletin_num)
  - supabase/migrations/0061_*.sql (patrón doble-revoke + total_n + LIMIT)
provides:
  - extraerBoletines(materia) — extractor puro context-gated de boletines en texto libre
  - RPC public.lobby_menciones_de_boletin(p_boletin) — fail-closed doble, PII-safe, bounded
  - FIXTURE_MATERIA compartido (guard de equivalencia TS↔SQL)
affects:
  - Plan 02 (chips "Menciona boletín N" en ficha parlamentario)
  - Plan 03 (sección "Audiencias que mencionan este boletín" en ficha proyecto)
  - Plan 04 (apply 0062 a PROD + pgTAP contra schema aplicado)
tech-stack:
  added: []
  patterns:
    - "context-gated extraction: sufijo -NN inequívoco | base pelada SOLO tras gatillo léxico"
    - "guard de equivalencia TS↔SQL vía fixture compartido asertado en vitest Y pgTAP"
    - "doble-revoke VERBATIM + CERO grant (Camino A) + total_n honesto + LIMIT bounded"
key-files:
  created:
    - app/lib/boletin-en-materia.ts
    - app/lib/boletin-en-materia.test.ts
    - supabase/migrations/0062_lobby_menciones_de_boletin.sql
    - supabase/tests/0062_lobby_menciones_de_boletin.test.sql
  modified:
    - app/lib/lockdown-guard.test.ts (PUBLIC_RPC_ALLOWLIST += lobby_menciones_de_boletin)
decisions:
  - "REGLA LOCKED context-gated: número pelado NO es boletín salvo (a) sufijo -NN o (b) gatillo léxico boletín/bol. ≤3 tokens antes — DIVERGENCIA deliberada vs detectarBoletin (query completa)"
  - "branch (b) de la RPC aplica SIEMPRE (con o sin sufijo en p_boletin): 'boletín 14309' pelado refiere a la base y por tanto al proyecto 14309-04; \\M(?!-[[:digit:]]) evita doble-conteo del mismo con-sufijo"
  - "tokens intermedios del gatillo restringidos a runs sin dígitos [^[:space:][:digit:]]+ → robustez de backtracking + un dígito intercalado corta la ventana (espejo TS)"
  - "0062 NO aplicada a PROD (aditiva, dentro de autoridad del agente; apply = Plan 04)"
metrics:
  duration: ~14min
  completed: 2026-07-22
---

# Phase 92 Plan 01: Extractor context-gated + RPC lobby_menciones_de_boletin Summary

**One-liner:** Canal de datos fail-closed audiencia→PL: extractor puro `extraerBoletines`
que enlaza SOLO por mención EXPLÍCITA de número de boletín (sufijo `-NN` inequívoco o base
pelada tras gatillo léxico "boletín"/"bol.", JAMÁS keywords), + RPC 0062
`lobby_menciones_de_boletin` con fail-closed doble (patrón + existencia en `proyecto`),
con guard de equivalencia TS↔SQL demostrado (14/14 fixtures espejados en Postgres efímero).

## What Was Built

### Task 1 — `extraerBoletines(materia): string[]` (extractor puro)
- **Regla LOCKED context-gated** (riesgo #1 de la fase, dirimido por el orquestador):
  - (a) formas CON sufijo `-NN` en cualquier posición (`14309-04`, `14.309-04`) → inequívocas.
  - (b) números SIN sufijo (pelados/punteados, 3-6 dígitos) SOLO si van precedidos por
    "boletín"/"boletin"/"bol." dentro de ≤3 tokens (case-insensitive).
  - Rechazos LOCKED: `"Ley 20.730" → []`, `"año 2024" → []`, `"20730" suelto → []`,
    `"$14.309" → []` (separador decimal / dinero).
- Salida canónica `base` | `base-sufijo` (guion, puntos colapsados), dedupe, orden asc.
- Función pura, sin imports de runtime. La compuerta de EXISTENCIA (fail-closed #2) NO vive
  aquí — documentada en el JSDoc como responsabilidad del consumidor (RPC / query batched).
- **Guard de equivalencia** (patrón WR-03): fixture compartido `FIXTURE_MATERIA` + copia
  inline en el test que asegura salida idéntica → caza drift. 17 tests, todos verdes.

### Task 2 — Migración 0062 `lobby_menciones_de_boletin(p_boletin)` + pgTAP
- RPC `language sql stable security definer set search_path = ''`, nombres schema-qualified,
  `p_boletin` parametrizado. Doble-revoke VERBATIM (public + anon,authenticated), CERO grant.
- **Fail-closed doble:**
  1. **Patrón:** regex SQL context-gated que ESPEJA el extractor TS (branch a sufijo, branch
     b base pelada tras gatillo). Equivalencia documentada en comentario + probada por pgTAP.
  2. **Existencia:** `join public.proyecto` por `boletin`/`boletin_num` → menciones a
     boletines inexistentes NO se emiten.
- **Fail-closed identidad:** SOLO `estado_vinculo='confirmado'` con `parlamentario_id is not null`.
- **PII-safe:** nombre público (`concat_ws`, espejo 0061), contraparte cruda (nombre/rol/
  representado — espejo `lobby_de_parlamentario`) SIN `contraparte_id`/RUT. Provenance
  (origen/fecha_captura/enlace_detalle). `total_n = count(*) over ()` honesto. Orden fecha
  DESC, `LIMIT 50` bounded.
- **pgTAP** (espejo 0060/0061): has_function firma text, is security definer, anon SIN
  execute, emite total_n, NO filtra rut/email/contraparte_id, + 7 tests de comportamiento
  fail-closed doble (mencionada con sufijo / con gatillo, vs "Ley 20.730" / pelado-suelto /
  boletín-inexistente / no_confirmado / sin-parlamentario_id).
- `lobby_menciones_de_boletin` añadido a `PUBLIC_RPC_ALLOWLIST` (lockdown-guard).

## Verification

- **Suite app:** 1129 tests / 89 archivos VERDE (17 nuevos de boletin-en-materia). `tsc --noEmit` exit 0.
- **lockdown-guard VERDE:** 0062 (>0044) no re-expone anon; allowlist consistente.
- **Guard de equivalencia TS↔SQL DEMOSTRADO** (más allá del criterio de done): apliqué 0062
  a un Postgres efímero LOCAL (miniconda, puerto 55492, esquema mínimo) y probé los 14 casos
  del fixture compartido con `p_boletin` real. TODOS espejan `extraerBoletines`:
  - `boletín 14309-04` → mencionada; `boletín N° 14309` (pelado+gatillo) → mencionada.
  - `Ley 20.730` → NO; `14309 pelado suelto` → NO; `año 2024` → NO; `ley N° 20.730` → NO.
  - boletín inexistente `99999-99` → 0 filas; no_confirmado / sin-FK → NO; `total_n` = 2 honesto.
  - `boletines 14309-04 y 15000-07` → ambos bajo sus fichas; `12345` pelado-sin-gatillo → NO.
  - DB efímera detenida y borrada; CERO contacto con PROD.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] branch (b) de la RPC no matcheaba menciones peladas cuando p_boletin tenía sufijo**
- **Found during:** Task 2 (validación local en Postgres efímero).
- **Issue:** el primer diseño gateaba branch (b) con `pat.sufijo is null`, de modo que para
  una ficha `14309-04` una audiencia que dice "boletín 14309" (pelado) NO se emitía — perdía
  menciones válidas de la misma base.
- **Fix:** branch (b) aplica SIEMPRE (con o sin sufijo en p_boletin), con `\M(?!-[[:digit:]])`
  para no doble-contar la forma con-sufijo (que ya cubre branch a). Los tokens intermedios se
  restringieron a runs sin dígitos `[^[:space:][:digit:]]+` para robustez de backtracking y
  para cortar la ventana ante un dígito intercalado (espejo del conteo por tokens del TS).
- **Files modified:** supabase/migrations/0062_lobby_menciones_de_boletin.sql
- **Commit:** e7f1f07

## Known Stubs

Ninguno. Ambos artefactos son sustantivos y probados. La RPC no está montada en ninguna
superficie todavía (eso es Plan 02/03), pero eso es secuenciación de la fase, no un stub.

## Deferred (por diseño de la fase)

- **Apply 0062 a PROD + pgTAP contra schema aplicado:** Plan 04 (por el agente vía
  `psql --single-transaction`, precedente 0059-0061). Aquí NO se tocó PROD.
- **Métrica de cobertura honesta** ("cuántas audiencias en PROD tienen mención válida de
  boletín", pedida por el CONTEXT §specifics): requiere PROD → se mide en el Plan 04 tras
  aplicar la RPC, o en Plan 03 al montar la sección. No calculable sin la RPC aplicada.

## Self-Check: PASSED

- FOUND: app/lib/boletin-en-materia.ts
- FOUND: app/lib/boletin-en-materia.test.ts
- FOUND: supabase/migrations/0062_lobby_menciones_de_boletin.sql
- FOUND: supabase/tests/0062_lobby_menciones_de_boletin.test.sql
- FOUND commit: 185f53d (Task 1 — extractor + guard equivalencia)
- FOUND commit: e7f1f07 (Task 2 — 0062 RPC + pgTAP + allowlist)
