---
status: complete
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
source: [101-VERIFICATION.md]
started: 2026-07-24T18:30:00Z
updated: 2026-07-26T00:00:00Z
closed_by: 104-03 E2E (deploy v95a9c858, evidencia en 104-E2E-EVIDENCIA.md)
---

## Current Test

[cerrado — los 3 tests deploy-dependientes quedaron cubiertos por el inventario E2E de Phase 104 (Plan 104-03) sobre el deploy real v95a9c858; evidencia por superficie en 104-E2E-EVIDENCIA.md]

## Tests

### 1. Grid de relaciones 5-bloques above-the-fold en la ficha
expected: `<section id="relaciones">` visible inmediatamente después del header/bio con los 5 bloques (partido, zona solo-Senado, comisiones, co-autoría, militancia histórica) en grid 2×2, sin doble-espaciado mt-12 dentro del grid (neutralización `[&>section]:mt-0` — solo verificable con getComputedStyle en deploy real).
result: pass
evidence: `/parlamentario/D1074` y `/parlamentario/S1110` (deploy v95a9c858) renderizan `<section id="relaciones">` above-the-fold con los bloques presentes (D1074: Del mismo partido, En la misma comisión, co-autoría 94, Militaron en el mismo partido; S1110: + De la misma zona por ser senador). Conteos == total_n de cada RPC (co-autoría D1074=94, S1110=28; militancia S1110=11), truncamiento >20 declarado ("Mostrando los primeros 8 de 94"), orden alfabético. Ver 104-E2E-EVIDENCIA.md §2.

### 2. /comparar A/B con parlamentarios reales
expected: `/comparar?a=&b=` con dos reales muestra 4 ejes factuales con intersección honesta (incluye par con >20 co-autores → sin falsa ausencia; par diputado/senador con comisión homónima → NO "comparten"); dos diputados → zona "no aplica" honesto.
result: pass
evidence: `/comparar?a=D1009&b=D1074` (dos diputados) muestra los 4 ejes factuales (Militancia histórica, Comisiones, Co-autoría, Zona electoral) con fuente+fecha. Cross-cámara `/comparar?a=D1074&b=S1110` → "En las fuentes consultadas al 2026-07-26, no comparten comisiones" (identidad compuesta cámara+nombre, NO fabrica "comparten"). Ver 104-E2E-EVIDENCIA.md §3.

### 3. CTA "Comparar con otro parlamentario" desde la ficha
expected: el CTA en la ficha navega a /comparar con slot A pre-llenado con ese parlamentario.
result: pass
evidence: `/parlamentario/D1074` (deploy v95a9c858) contiene el CTA "Comparar con otro parlamentario" con `href="/comparar?a=D1074"` → navega a /comparar con el slot A pre-llenado con D1074. Verificado en el DOM servido. Ver 104-E2E-EVIDENCIA.md §3.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Ninguno. Los 3 tests deploy-dependientes cerraron con evidencia DOM sobre el deploy real (v95a9c858) durante el inventario E2E de Phase 104-03. Nota: durante el E2E se detectó y corrigió un defecto URI-como-partido (S1344, senador con URI RDF de BCN en `partido`) — fix + redeploy documentados en 104-E2E-EVIDENCIA.md §6; no afecta a estos 3 tests (verificados sobre el deploy ya corregido).
