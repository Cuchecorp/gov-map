---
phase: 127
slug: panel-mat-materializador-0080-puebla-los-sujetos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 127 — Validation Strategy

> Derivada de `127-RESEARCH.md` §Validation Architecture (verificada contra el repo 2026-07-30).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP contra el schema APLICADO (no hay harness JS para SQL; no existe runner — invocación directa por psql) |
| **Config file** | ninguno |
| **Quick run command** | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0080_actualidad_evidencia.test.sql \| tr -d '\r'` |
| **Full suite command** | ambos tests de la superficie: `0065_actualidad_senal.test.sql` (regresión, 17 asserts) + `0080_actualidad_evidencia.test.sql` (nuevo); más `pnpm test` en `app/` como control de no-regresión (cero archivos de app/ tocados) |
| **Estimated runtime** | pgTAP <10 s cada uno; suite app ~100 s |

**Gotchas LOCKED:** `\| tr -d '\r'` en todo pipe de psql (CRLF); JAMÁS ecoar `SUPABASE_DB_URL`; jamás REST (cap 1k); el linter anti-insinuación solo escanea `app/` ⇒ 0080 no lo dispara.

---

## Sampling Rate

- **After every task commit:** pgTAP del archivo tocado por nombre (quick run)
- **After every plan wave:** ambos pgTAP + `pnpm --filter ./app guards`
- **Before verify:** secuencia completa post-apply (baseline 0065 rojo-pre/verde-post como control apareado, materializar, Q3-Q7 del plan 03)
- **Max feedback latency:** 120 s

---

## Per-Task Verification Map

| Req | Comportamiento | Tipo | Comando | ¿Existe? | Status |
|-----|----------------|------|---------|----------|--------|
| PANEL-01 | Señal positiva ⇒ `evidencia` con `total`+`items` poblados | pgTAP | quick run 0080 | ❌ Wave 0 | ⬜ |
| PANEL-01 | Fila de supresión ⇒ `evidencia = '{}'` (assert estructural determinista, no dependiente de datos vivos — fix B-4 del checker) | pgTAP | ídem | ❌ Wave 0 | ⬜ |
| PANEL-01 (D-06) | Paridad `conteo == total == jsonb_array_length(items)` en toda positiva | pgTAP | ídem | ❌ Wave 0 | ⬜ |
| PANEL-01 (D-03) | Cero cap: ningún `items` truncado respecto de su `total` | pgTAP (mismo assert de paridad) | ídem | ❌ Wave 0 | ⬜ |
| PANEL-02/D-05 | Boletín fantasma sembrado ⇒ `en_corpus:false` + titulo/enlace null | pgTAP | ídem | ❌ Wave 0 | ⬜ |
| PANEL-06/D-07 | `cobertura_camara` ∈ {`Cámara de Diputados`,`Senado`,`(sin cámara)`,`2022-2026 (piso de corpus)`,null} | pgTAP | ídem | ❌ Wave 0 | ⬜ |
| PANEL-06 regresión | 0065 verde con grafía nueva (rojo PRE-apply = control apareado) | pgTAP | `psql -tA -f supabase/tests/0065_actualidad_senal.test.sql` | ⚠️ existe pero ROMPE pre-fix (assert L110-114) | ⬜ |
| D-04 | `consultado_al` presente == `current_date` en toda positiva | pgTAP | test 0080 | ❌ Wave 0 | ⬜ |
| no-PII | cuerpo del proc sin `partido`/`rut` | pgTAP | 0065 test L78-83 (ya muerde — heredado) | ✅ | ⬜ |
| D-12 | cron registrado tras el replace | pgTAP | 0065 test L86-88 (ya muerde) | ✅ | ⬜ |

---

## Wave 0 Requirements

- `supabase/tests/0080_actualidad_evidencia.test.sql` — nuevo (plan 127-02)
- Fix del assert de grafía en `supabase/tests/0065_actualidad_senal.test.sql` L110-114 (plan 127-02; la migración 0065 JAMÁS se edita)

## Security Domain (ASVS aplicable)

- **V4 Access Control — SÍ:** el proc es secdef; `create or replace` NO preserva los SET ⇒ restatear `security definer set search_path = ''` literal (D-09b) y verificar `proconfig` en PROD post-apply. Cero grants nuevos (replace preserva ACL). Sin RPC nueva, sin views (guard create-view de 126 vigila).
