---
phase: 12-int-patrimonio-intereses-declaraciones-con-historial-y-compa
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (code) — DB-applied checks routed to operator
overrides_applied: 0
human_verification:
  - test: "Aplicar la migración 0022 al Supabase remoto y correr pgTAP 0022_probidad.test.sql contra el schema aplicado"
    expected: "psql aplica todos los CREATE/ALTER/GRANT/REVOKE/CREATE FUNCTION sin error; pgTAP reporta 34/34 PASS (declaracion_familiar deny-by-default + sin grant SELECT a anon; declaracion public-read; PK de versión = (fuente_id, fecha_presentacion); provenance + licencia NOT NULL; sin columna RUT en declaracion/declaracion_familiar; FK familiar→declaracion no a parlamentario; RPCs security-definer + execute anon)"
    why_human: "El DDL aplicado a Postgres remoto no es verificable por build/typecheck/grep (Pitfall 6). MEMORY del proyecto registra que el DDL remoto de Supabase está bloqueado en este entorno (probado 2026-06-18). El SUMMARY afirma 34/34 verde pero esa afirmación no es evidencia re-verificable aquí."
  - test: "Correr ingest-cli LIVE con la service key en env (sin --dry-run) contra datos.cplt.cl/sparql para un parlamentario sentado, y confirmar la persistencia en Supabase"
    expected: "Cada versión persiste en declaracion con provenance + CC BY 4.0 por fila; FK del declarante poblado SOLO en determinista (fila en identidad_audit); familiares en declaracion_familiar deny-by-default (anon no los lee); probidad_ingesta_estado marcado; re-run idempotente (conteos idénticos, versión vieja nunca sobreescrita); si InfoProbidad inalcanzable degradar a fixture, nunca fabricar"
    why_human: "La escritura real a Supabase remoto requiere la service key + acceso de escritura remoto, bloqueado en este entorno (MEMORY 2026-06-18). El camino de lectura+parse+versioning+reconciliación SÍ se ejecutó en vivo (probe + CLI dry-run: 10 versiones / 9 fechas / CC BY 4.0 por fila); solo el commit a DB queda como paso de operador."
  - test: "Cargar /parlamentario/[id] en el navegador para un parlamentario con declaraciones confirmadas y comparar dos versiones (?comparar=A,B)"
    expected: "La sección #patrimonio aparece en su propio carril bajo #lobby; el historial muestra cada fecha de presentación prominente (font-mono) con badge ámbar de frescura para las viejas; la comparación dispone las versiones lado-a-lado con SOLO valores literales, sin ningún veredicto/delta/color de valencia; CC BY 4.0 visible en intro y en el caption de la comparación"
    why_human: "Apariencia visual, frescura ámbar renderizada y el flujo de comparación SSR end-to-end requieren un navegador con datos reales; los tests RTL cubren el comportamiento puro pero no el render integrado con datos del RPC."
---

# Phase 12: INT Patrimonio/Intereses — Verification Report

**Phase Goal:** El ciudadano ve las declaraciones de patrimonio e intereses de un parlamentario, su historial de versiones y una comparación en el tiempo — literal, fechada y atribuida, sin ningún veredicto de enriquecimiento ni de conflicto.
**Verified:** 2026-06-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | INT-03 — `@obs/probidad` ingiere declaraciones LITERALMENTE de InfoProbidad SPARQL (estructurado, SIN LLM), CC BY 4.0 por fila + visible en vistas derivadas | ✓ VERIFIED | `parse-infoprobidad.ts` parsea SPARQL-JSON con zod sin LLM (`DeclaracionSchema.safeParse`, valores copiados verbatim); `LICENCIA_PROBIDAD = 'CC BY 4.0'` por fila; sin `@obs/llm` en deps ni source (solo en test como assertion); 30/30 tests probidad PASS incl. golden del fixture LIVE real. CC BY 4.0 viaja en columna `licencia` (migración) y se renderiza en intro + caption (componente). |
| 2 | INT-04 — historial fechado por fecha de presentación (prominente, frescura ámbar, vieja NUNCA como actual); enlace del declarante solo si confirmado | ✓ VERIFIED | Componente: `font-mono` "Presentada el …", `es_historica` → caveat ámbar "no representa el estado actual"; RPC `declaraciones_de_parlamentario` ordena `fecha_presentacion DESC` y filtra `parlamentario_id = p_id` (solo confirmadas); reconciliación mintea FK solo en `determinista`; 17 tests RTL PASS incl. tres estados honestos. |
| 3 | INT-05 — comparación lado-a-lado con CERO campo de enriquecimiento/conflicto/delta | ✓ VERIFIED | RPC `comparar_declaraciones` devuelve solo `etiqueta/valor` literales (UNION ALL, sin columna de delta); `DeclaracionComparacion` dispone columnas por fecha sin computar; campo ausente lee "No declarado en esta versión"; tests aseguran `PROHIBIDO_VEREDICTO`/`PROHIBIDO_CONECTIVO` no aparecen y sin clases red/green/diff. |
| 4 | data-routing gate (sin LLM/PII al modelo → moot) + drift bloqueante (cuarentena) | ✓ VERIFIED | El gate es moot por diseño: contenido estructurado, cero LLM en la ruta de ingesta (verificado por ausencia de import + dep). Drift bloqueante: `ingest-run.ts` pone `driftQuarantine=true` y emite 0 filas ante forma SPARQL-JSON inesperada o fingerprint cambiado (nunca filas vacías leídas como "no declara"); test (a) cuarentena PASS. |

**Score:** 4/4 truths verified at the code/test level.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0022_probidad.sql` | Tablas versionadas + familiar deny-by-default + RPCs sin delta + marcador | ✓ VERIFIED (code) | PK `(fuente_id, fecha_presentacion)`; `declaracion_familiar` RLS-on + cero policies + `revoke all from anon, authenticated`; RPCs security-definer con grant execute anon; CC BY 4.0 + provenance NOT NULL; sin RUT de persona natural. DDL aplicado = operador (human). |
| `supabase/tests/0022_probidad.test.sql` | pgTAP 34 assertions | ✓ VERIFIED (file) | `plan(34)`; cubre versión-key, familiar anon-denegada, public-read, provenance, sin RUT, FK familiar→declaracion, RPCs. Ejecución contra schema aplicado = operador (human). |
| `packages/probidad/src/parse-infoprobidad.ts` | Parser zod literal sin LLM | ✓ VERIFIED | 9.6 KB, agrupa por clave de versión, descarta drift, sin LLM. |
| `packages/probidad/src/reconciliar-declarante.ts` | Cruce name-only, EnlaceConfirmado solo determinista | ✓ VERIFIED | `confirmar()` solo en `case "determinista"`; resto NULL + mención cruda; familiares sin reconciliación. |
| `packages/probidad/src/writer-supabase.ts` | Writer versionado onConflict incluye fecha | ✓ VERIFIED | `onConflict: "fuente_id,fecha_presentacion"` en raíz y todas las sub-tablas (acumula, nunca colapsa). |
| `app/components/patrimonio-de-parlamentario.tsx` | Historial + comparación, Server Component | ✓ VERIFIED | 21.8 KB; lee 3 RPCs/marcador vía `sb.rpc`; tres estados; CC BY 4.0 intro+caption. |
| `app/components/patrimonio-de-parlamentario.test.tsx` | Content gate sobre lista Y comparación | ✓ VERIFIED | 17 tests; gate §9.1 ejerce `PatrimonioView` Y `DeclaracionComparacion` (cierra brecha `representado` de Phase 11). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `app/app/parlamentario/[id]/page.tsx` | `PatrimonioSection` | `<section id="patrimonio" className="mt-12">` tras #lobby | ✓ WIRED | Importado y renderizado como sibling de #lobby (mt-12 = frontera de carril). |
| `patrimonio-de-parlamentario.tsx` | `declaraciones_de_parlamentario` / `comparar_declaraciones` | `sb.rpc` | ✓ WIRED | Ambos RPCs invocados; errores lanzan (no se enmascaran como "sin datos"). |
| `reconciliar-declarante.ts` | `@obs/identity confirmar` | import + mint en rama determinista | ✓ WIRED | `confirmar(res.parlamentarioId, "determinista")` solo en determinista. |
| `connector-infoprobidad.ts` | `@obs/ingest` orden LOCKED | assertAllowedUrl→robots→rateLimiter→fetcher | ✓ WIRED | Orden LOCKED presente con delay 2-3s por host. |
| `writer-supabase.ts` | declaracion/familiar/ingesta_estado | upsert onConflict por clave de versión | ✓ WIRED | onConflict incluye fecha_presentacion; familiar = delete+insert (sin clave única). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PatrimonioSection` | `rpcData` / `cmpData` / `estadoData` | RPCs `declaraciones_de_parlamentario` / `comparar_declaraciones` + tabla `probidad_ingesta_estado` | RPC hace `select ... from public.declaracion` real (no static return); pero requiere filas en DB que solo existen tras la corrida LIVE del operador | ⚠️ Operator-gated — el camino de datos es real, pendiente de carga de DB (human item 2) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Parser literal + versioning + drift + idempotencia | `pnpm --filter @obs/probidad test` | 4 files / 30 tests PASS | ✓ PASS |
| Historial + comparación + content gate (lista Y comparación) | `pnpm --filter app test --run patrimonio` | 17 patrimonio tests PASS (110 app total) | ✓ PASS |
| LIVE SPARQL read + parse + versioning | (operador) probe + CLI dry-run contra datos.cplt.cl | 10 versiones / 9 fechas / CC BY 4.0 por fila (per SUMMARY) | ? SKIP — operador, no re-ejecutable aquí (rate-limited gov endpoint) |
| Migración aplicada + pgTAP | (operador) psql + supabase test | 34/34 (per SUMMARY) | ? SKIP — Supabase remoto bloqueado en este entorno (MEMORY) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INT-03 | 12-01, 12-02 | Ingesta literal InfoProbidad + CC BY 4.0 | ✓ SATISFIED (code) | Parser/writer + tests; DB write = operador |
| INT-04 | 12-01, 12-03 | Historial fechado, vieja nunca actual | ✓ SATISFIED | RPC DESC + frescura ámbar + caveat |
| INT-05 | 12-01, 12-03 | Comparación lado-a-lado sin veredicto | ✓ SATISFIED | RPC sin delta + componente + content gate |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `patrimonio-de-parlamentario.tsx` | 33 | "TODO" en comentario | ℹ️ Info | Falso positivo — "TODO campo renderizado" es español ("EVERY field"), no un debt marker. Ninguna acción. |

No `TBD`/`FIXME`/`XXX` debt markers. No stubs, empty handlers, ni returns estáticos en la ruta de datos.

### Human Verification Required

1. **Migración 0022 aplicada + pgTAP 34/34** — el DDL remoto no es verificable por grep/build (Pitfall 6); MEMORY registra Supabase remoto bloqueado en este entorno. El SUMMARY afirma 34/34 verde, pero esa afirmación no es re-verificable aquí.
2. **Corrida LIVE de ingesta con service key (persistencia a DB)** — el camino de lectura/parse/versioning corrió en vivo (10 versiones/9 fechas/CC BY 4.0); solo el commit a Supabase remoto queda como paso de operador.
3. **Render del navegador de /parlamentario/[id]#patrimonio** — apariencia, frescura ámbar y flujo de comparación SSR con datos reales.

### Gaps Summary

No se encontraron gaps de código ni de test. Los cuatro success criteria de ROADMAP están satisfechos al nivel verificable (código + 47 tests verdes: 30 probidad + 17 patrimonio). Las verificaciones que dependen de Postgres remoto aplicado (pgTAP 34/34) y de la escritura LIVE a Supabase son inherentemente checkpoints de operador — el entorno tiene el DDL/escritura remota de Supabase bloqueados (MEMORY 2026-06-18), por lo que NO son gaps de implementación sino items de verificación humana. El SUMMARY afirma que ambos se atendieron con éxito (pgTAP 34/34, LIVE 10 versiones), pero como verificador no puedo re-ejecutarlos aquí; quedan como `human_needed` con instrucciones explícitas.

Notas de robustez confirmadas por inspección directa:
- El content-gate cubre TANTO la lista (`PatrimonioView`) COMO la comparación (`DeclaracionComparacion`) — la lección `representado` de Phase 11 está cerrada.
- `declaracion_familiar` es deny-by-default REAL: RLS-on + cero policies + `revoke all from anon, authenticated` (no solo ausencia de policy).
- El writer NUNCA sobreescribe: `onConflict` siempre incluye `fecha_presentacion`; test de idempotencia (2× mismo input → conteos idénticos) PASS.
- El cruce del declarante es name-only y mintea `EnlaceConfirmado` SOLO en `determinista`; el resto deja FK NULL + mención cruda.

---

_Verified: 2026-06-19_
_Verifier: Claude (gsd-verifier)_
