---
status: partial
phase: 99-senales-p1b-materializador
source: [99-VERIFICATION.md]
started: 2026-07-24
updated: 2026-07-24
---

## Current Test

[awaiting operator confirmation]

## Tests

### 1. pg_cron 'actualidad-materializar' dispara en horario (intradía L-V) contra PROD
expected: el job registrado (schedule `7 11,14,17,20 * * 1-5`) ejecuta `actualidad.materializar_senales()` y refresca `actualidad_senal` sin error; verificable en `cron.job_run_details`.
result: [pending — operador verifica tras la próxima ventana horaria]

### 2. GH Actions actualidad-refresh.yml con secrets cargados (SUPABASE_API_URL + SUPABASE_SECRET_KEY)
expected: el workflow corre el CLI @obs/actualidad, escribe filas `agrupacion_materia`; requiere que el operador cargue los 2 secrets en el repo (billing GH activo). Sin secrets → job falla (esperado hasta carga).
result: [pending — operador carga secrets + confirma primera corrida verde]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
