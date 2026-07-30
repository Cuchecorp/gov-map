---
phase: 116
slug: fecha-audit-sem-ntica-de-cada-fecha-visible
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 116 — Validation Strategy

> Research se saltó: §5 del inventario 113 (validado por Opus) ES el universo de fechas (E-001..E-060, 28 archivos con formatters). Fase de auditoría de solo lectura: la validación es la completitud del artefacto contra el inventario + el cruce con PROD.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Auditoría estática (grep/lectura archivo:línea) + psql read-only contra PROD + script de completitud estilo `check-inventario.sh` (113) |
| **Quick run command** | verificación de un emisor (grep + SELECT del sujeto) |
| **Full suite command** | check de completitud: todo E-xxx con fecha en 113 §5 tiene fila de veredicto en `116-FECHAS-AUDIT.md` |
| **Estimated runtime** | check de completitud ~seg; queries PROD ~min (una por superficie) |

---

## Sampling Rate

- **After every task commit:** check de completitud parcial sobre los emisores cubiertos por la tarea
- **After every plan wave:** artefacto `116-FECHAS-AUDIT.md` consistente (cero emisores sin veredicto en el rango cubierto)
- **Before `/gsd:verify-work`:** completitud 100% (todo emisor con fecha del inventario tiene veredicto) + cada hallazgo con archivo:línea verificable
- **Max feedback latency:** segundos (grep) / minutos (psql)

---

## Per-Task Verification Map

| Task | Requirement | Verificación | Automated Command | Status |
|------|-------------|--------------|-------------------|--------|
| Veredicto por emisor×fecha | FECHA-01 SC1 | Toda fecha de 113 §5 tiene veredicto hecho/captura/ambigua con origen citado | script de completitud (diff ids E-xxx 113 vs 116) | pending |
| Lista fecha_captura-como-hecho | FECHA-01 SC2 | Cada ocurrencia con archivo:línea y superficie; grep reproduce la lista | grep -n fecha_captura/capturedAt sobre app/ | pending |
| Date-only tz LOCKED | FECHA-01 SC3 | `citacion.fecha` y análogas verificadas sin conversión tz; formatters date-only auditados | grep formatters + lectura | pending |
| Cruce PROD | FECHA-01 SC4 | Un sujeto por superficie con query y valor registrados en el artefacto | psql read-only (fecha <= current_date) | pending |

---

## Reglas LOCKED que la validación hace cumplir

- `fecha_captura` JAMÁS como el hecho (Phase 98); "captura" pelado PROHIBIDO (v10.0); idiom "según fuente al…".
- Date-only medianoche UTC = día chileno; JAMÁS convertir tz (v9.0 pasada 2).
- Solo lectura: esta fase NO modifica código ni copy (fixes → Phase 117).
- psql: `set -a; source .env; set +a`, JAMÁS imprimir la URL; filtrar `fecha <= current_date` (Pitfall 8).
