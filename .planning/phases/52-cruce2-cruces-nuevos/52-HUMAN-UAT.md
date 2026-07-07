---
status: partial
phase: 52-cruce2-cruces-nuevos
source: [52-VERIFICATION.md]
started: 2026-07-06T20:25:00Z
updated: 2026-07-06T20:25:00Z
---

## Current Test

[awaiting human testing — deploy Cloudflare EJECUTADO 2026-07-06 (versión 0742841e); smoke HTTP verde en las 3 superficies: carril lobby con caveat+filas en /proyecto/16743-04, "Citado en" en /proyecto/18216-05, 3 bloques actualidad en /. Falta solo la validación VISUAL del operador en https://observatorio-congreso.thevalis.workers.dev]

## Tests

### 1. Carril lobby×tramitación en ficha de proyecto (post-deploy)
expected: En /proyecto/16743-04, el carril "Reuniones de lobby registradas en el mismo período" renderiza las 5 audiencias vivas con caveat anti-causal 1×, nombres en texto plano y "Ver fuente oficial ↗" por fila (cuando hay enlace).
result: [pending]

### 2. Módulo de actualidad en home (post-deploy)
expected: En /, bajo el hero, 3 bloques ("Votado esta semana", "Urgencias vigentes", "Última actualización de datos") con datos reales o empty-state honesto, sin 500; hero intacto.
result: [pending]

### 3. Línea de citación en "¿Dónde está hoy?" (post-deploy)
expected: En una ficha con citación vigente/futura aparece "Citado en {comisión} el {fecha}."; se omite (sin "—") donde no hay citación próxima.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
