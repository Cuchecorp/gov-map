---
phase: 87
plan: "03"
subsystem: búsqueda
tags: [rpc, busqueda-hibrida, gate, boletin, sql-fix]
dependency_graph:
  requires: [87-01, 87-02]
  provides: [BUSQUEDA_HIBRIDA_ENABLED_ON, buscar_proyectos_hibrido_v2]
  affects: [/buscar, busqueda-hibrida-gate.ts]
tech_stack:
  added: [plpgsql, pgTAP-0056]
  patterns: [short-circuit-boletin-con-normalizacion-punteado]
key_files:
  created:
    - supabase/migrations/0056_busqueda_hibrida_boletin_norm.sql
    - supabase/tests/post-apply/0056_busqueda_hibrida_boletin_norm.test.sql
    - .planning/phases/87-.../87-03-SUMMARY.md
  modified:
    - app/lib/busqueda-hibrida-gate.ts
    - app/lib/busqueda-hibrida-gate.test.ts
    - .planning/phases/87-.../87-SCORING.md
decisions:
  - "buscar_proyectos_hibrido default ON — rpc-real v2 iguala RRF ad-hoc (43.8/68.8/53.6), todos los criterios cumplen"
  - "Normalización punteada en SQL (plpgsql) en vez de en el cliente — la RPC debe ser auto-suficiente"
  - "Rollback vía env var BUSQUEDA_HIBRIDA_ENABLED=false sin redeploy de código"
metrics:
  duration: "~25 min (corrida de continuación)"
  completed: "2026-07-22"
  tasks_completed: 2
  files_changed: 5
---

# Phase 87 Plan 03: Gate de Dominancia RPC — Fix bo-03 y Cierre SUMMARY

**One-liner:** Fix normalización boletín punteado en SQL (0056) + gate DOMINA → flag ON, rpc-real v2 iguala RRF ad-hoc 43.8/68.8/53.6.

## Lo que se construyó

Esta es la corrida de continuación del plan 87-03. La corrida anterior terminó con el veredicto NO DOMINA porque bo-03 (`"14.309-04"`) fallaba en la RPC real. Esta corrida diagnosticó la causa raíz, aplicó el fix, re-corrió el gate, confirmó dominancia y flippeó el flag a ON.

### Diagnóstico bo-03

**Causa raíz exacta:**

1. El golden-set tiene `bo-03.query = "14.309-04"` (formato punteado con punto de millar).
2. `runRpcHibrida` en `strategies.ts` pasa `q` crudo directamente a la RPC SQL — no llama `detectarBoletin` antes.
3. El short-circuit SQL en `buscar_proyectos_hibrido` (0055) usa el regex `q ~ '^\d{3,6}(-\d{1,2})?$'`. Este regex NO coincide con `"14.309-04"` porque el punto interrumpe la secuencia de dígitos.
4. El harness RRF ad-hoc funciona porque `runRrf` sí llama `detectarBoletin` que normaliza el punteado antes del SQL.

**Divergencia de diseño:** La RPC asumía que el caller normalizaría (comentario 0055: "El formato punteado se normaliza en buscar.ts ANTES de llamar a la RPC"). Pero el harness mide la RPC directamente con `q` crudo. La RPC debe ser auto-suficiente.

### Migración 0056

- Convierte `buscar_proyectos_hibrido` de `language sql` a `language plpgsql` para poder declarar variables.
- Normalización determinista: `q_trim := btrim(q)`. Si `q_trim ~ '^\d{1,3}(\.\d{3})*(-\d{1,2})?$'` (regex punteado — cubre `14.309-04`, `14.309`, no `12.34` ni texto libre) entonces `q_norm := replace(q_trim, '.', '')`.
- Todo el resto del cuerpo es idéntico a 0055 excepto que usa `q_norm` en el short-circuit y `q` (crudo) en FTS (websearch_to_tsquery tolera puntos).
- ACL idéntica: doble-revoke, CERO grant (T-87-01 intacto).

### pgTAP 0056 — 5/5 verde

| Test | Resultado |
|------|-----------|
| Función existe con firma exacta (text, vector, int) | ok |
| PUBLIC sin EXECUTE (T-87-01 intacto) | ok |
| Canónico "15627-12" → rank 0 (regresión bo-01/02/04) | ok |
| Punteado "14.309-04" → boletin "14309-04" rank 0 (bo-03 fix) | ok |
| Punteado sin sufijo "14.309" → boletin_num match rank 0 | ok |

### Gate de dominancia — rpc-real v2

| Criterio | Requerido | rpc-real v2 | Resultado |
|----------|-----------|-------------|-----------|
| (a) boletín hit@1 | 100% (4/4) | 100% (4/4) | CUMPLE |
| (b) parafrasis-nl hit@5 | ≥ 80% | 80.0% | CUMPLE |
| (c) similares hit@5 | ≥ 80% | 80.0% | CUMPLE |
| (d) agregado hit@5 > 53.1% | > semántico | 68.8% | CUMPLE |

**Veredicto: DOMINA.** rpc-real v2 iguala el RRF ad-hoc (43.8% hit@1, 68.8% hit@5, 53.6% MRR@5) exactamente.

### Flag flippeado a ON

`busqueda-hibrida-gate.ts` cambió de default OFF a default ON:
- Antes: `return env.BUSQUEDA_HIBRIDA_ENABLED === "true"` (solo "true" enciende)
- Después: `return env.BUSQUEDA_HIBRIDA_ENABLED !== "false"` (solo "false" apaga)
- Rollback: setear `BUSQUEDA_HIBRIDA_ENABLED=false` en Cloudflare → OFF inmediato sin redeploy de código.

Test suite actualizada al nuevo contrato (5 casos, espejo del cambio).

### Verificación final

- `pnpm test` (app): 1009/1009 passed — sin regresiones.
- `tsc -b --noEmit` (app): limpio.

## Deviaciones del plan

**Ninguna desviación arquitectónica.** El fix es exactamente el diagnóstico que el plan preveía como "próximo paso". La única diferencia respecto a la instrucción es que se usó `plpgsql` en vez de `sql` (necesario para variables locales), lo cual es un detalle de implementación, no una decisión arquitectónica.

## Tabla de commits

| Commit | Descripción |
|--------|-------------|
| bfb399a | fix(87-03): normalizar boletín punteado dentro de buscar_proyectos_hibrido |
| (este) | docs(87-03): SUMMARY + gate default ON + 87-SCORING final |

## Self-Check: PASSED

- `supabase/migrations/0056_busqueda_hibrida_boletin_norm.sql` — existe, aplicado a PROD (DROP FUNCTION + CREATE FUNCTION + 2x REVOKE).
- `supabase/tests/post-apply/0056_busqueda_hibrida_boletin_norm.test.sql` — existe, pgTAP 5/5 verde.
- `app/lib/busqueda-hibrida-gate.ts` — default ON, lógica `!== "false"`.
- `app/lib/busqueda-hibrida-gate.test.ts` — 5 tests, suite 1009 verde.
- `87-SCORING.md` — sección 5 + DECISIÓN FINAL DOMINA.
- Commit bfb399a confirmado en git log.
