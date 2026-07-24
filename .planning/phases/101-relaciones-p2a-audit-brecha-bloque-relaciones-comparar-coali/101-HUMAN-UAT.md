---
status: partial
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
source: [101-VERIFICATION.md]
started: 2026-07-24T18:30:00Z
updated: 2026-07-24T18:30:00Z
---

## Current Test

[awaiting human testing — deploy-dependent BrowserOS checks; naturally covered by Phase 104 E2E o el próximo deploy]

## Tests

### 1. Grid de relaciones 5-bloques above-the-fold en la ficha
expected: `<section id="relaciones">` visible inmediatamente después del header/bio con los 5 bloques (partido, zona solo-Senado, comisiones, co-autoría, militancia histórica) en grid 2×2, sin doble-espaciado mt-12 dentro del grid (neutralización `[&>section]:mt-0` — solo verificable con getComputedStyle en deploy real).
result: [pending]

### 2. /comparar A/B con parlamentarios reales
expected: `/comparar?a=&b=` con dos reales muestra 4 ejes factuales con intersección honesta (incluye par con >20 co-autores → sin falsa ausencia; par diputado/senador con comisión homónima → NO "comparten"); dos diputados → zona "no aplica" honesto.
result: [pending]

### 3. CTA "Comparar con otro parlamentario" desde la ficha
expected: el CTA en la ficha navega a /comparar con slot A pre-llenado con ese parlamentario.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
