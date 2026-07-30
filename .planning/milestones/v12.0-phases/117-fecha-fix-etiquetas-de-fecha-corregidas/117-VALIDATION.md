---
phase: 117
slug: fecha-fix-etiquetas-de-fecha-corregidas
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 117 — Validation Strategy

> Research se saltó: `116-FECHAS-AUDIT.md` §3 (F-01..F-14, validado por verifier Opus 17/17) ES el contrato. Fase de fixes de copy/formateo: la validación es suite + guards + disposición completa por hallazgo.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest existente (app ~1428 + packages) + `tsc -b` + guards de régimen en suite |
| **Quick run command** | `pnpm --filter app test -- <archivo.test>` del componente tocado |
| **Full suite command** | `pnpm test` + `pnpm -r exec tsc -b` (o el idiom del repo) |
| **Estimated runtime** | suite completa ~min; test por archivo ~seg |

---

## Sampling Rate

- **After every task commit:** tests del componente tocado + grep del copy nuevo (idiom "según fuente al…", cero "captura" pelado)
- **After every plan wave:** suite completa + tsc + guards verdes
- **Before `/gsd:verify-work`:** tabla de disposición F-01..F-14 completa (cero hallazgos sin fila) + suite verde
- **Max feedback latency:** segundos (grep/test archivo) / minutos (suite)

---

## Per-Task Verification Map

| Task | Requirement | Verificación | Automated Command | Status |
|------|-------------|--------------|-------------------|--------|
| Fixes de copy por hallazgo | FECHA-02 SC1 | Cada F-xx corregido o declarado en 117-DISPOSICION.md con evidencia antes/después | diff de disposición vs lista F-01..F-14 del audit | pending |
| Idiom LOCKED | FECHA-02 SC2 | Copy de captura usa "según fuente al…"; grep de "captura" pelado en copy visible = 0 | grep -rn sobre app/ (excluyendo tests/comentarios según linter) | pending |
| Guards de régimen | FECHA-02 SC3 | Linter anti-insinuación + guards verdes; extensión ANTES del copy si vocabulario nuevo | suite (guards integrados) | pending |
| Suite + typecheck | FECHA-02 SC4 | app + packages + tsc verdes con los cambios | `pnpm test` + `tsc -b` | pending |

---

## Reglas LOCKED que la validación hace cumplir

- `fecha_captura` JAMÁS como el hecho; "captura" pelado PROHIBIDO; idiom "según fuente al…".
- Date-only: JAMÁS conversión tz (usar `diaCalendarioCitacion`).
- F-05/F-10: PROHIBIDO `timeZone: "America/Santiago"` global (fabricaría ~45.618 días erróneos); fix por hallazgo según el audit.
- Flags NO se tocan (MONEY sigue OFF); deploy viaja con 125.
