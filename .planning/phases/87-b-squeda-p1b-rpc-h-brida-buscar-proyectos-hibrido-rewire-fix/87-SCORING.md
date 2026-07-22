# 87-SCORING — Gate de Dominancia RPC Real buscar_proyectos_hibrido

**Corrida:** 2026-07-22T02:05:31.980Z
**Golden set:** 32 casos

## Cobertura de Embeddings (LIVE)

| Métrica | Valor |
|---------|-------|
| proyecto (total) | 3659 |
| proyecto_embedding | 3100 |
| Cobertura | 84.7% |
| unaccent habilitado | true |

## Tabla Estrategia × Categoría

### 1. FTS-solo
`limit=50 unaccent=true`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 40.0% | 24.0% |
| boletin | 4 | 0.0% | 0.0% | 0.0% |
| normas | 5 | 0.0% | 0.0% | 0.0% |
| parafrasis-nl | 5 | 0.0% | 0.0% | 0.0% |
| similares | 5 | 0.0% | 0.0% | 0.0% |
| titulo-literal | 8 | 25.0% | 50.0% | 32.3% |
| **AGREGADO** | **32** | **9.4%** | **18.8%** | **11.8%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | — | ✗ |
| tl-03 | titulo-literal | 4 | ✓ |
| tl-04 | titulo-literal | — | ✗ |
| tl-05 | titulo-literal | — | ✗ |
| tl-06 | titulo-literal | 3 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | — | ✗ |
| nl-02 | parafrasis-nl | — | ✗ |
| nl-03 | parafrasis-nl | — | ✗ |
| nl-04 | parafrasis-nl | — | ✗ |
| nl-05 | parafrasis-nl | — | ✗ |
| nr-01 | normas | — | ✗ |
| nr-02 | normas | — | ✗ |
| nr-03 | normas | — | ✗ |
| nr-04 | normas | — | ✗ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | — | ✗ |
| bo-02 | boletin | — | ✗ |
| bo-03 | boletin | — | ✗ |
| bo-04 | boletin | — | ✗ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 5 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | — | ✗ |
| sm-02 | similares | — | ✗ |
| sm-03 | similares | — | ✗ |
| sm-04 | similares | — | ✗ |
| sm-05 | similares | — | ✗ |

</details>

### 2. Semántico-solo (match_proyectos)
`limit=50`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 20.0% | 20.0% |
| boletin | 4 | 0.0% | 0.0% | 0.0% |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 60.0% | 80.0% | 64.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 46.3% |
| **AGREGADO** | **32** | **34.4%** | **53.1%** | **40.3%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | 6 | ✓ |
| tl-03 | titulo-literal | 5 | ✓ |
| tl-04 | titulo-literal | 1 | ✓ |
| tl-05 | titulo-literal | 4 | ✓ |
| tl-06 | titulo-literal | 4 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | 1 | ✓ |
| nl-02 | parafrasis-nl | 1 | ✓ |
| nl-03 | parafrasis-nl | 1 | ✓ |
| nl-04 | parafrasis-nl | 11 | ✓ |
| nl-05 | parafrasis-nl | 2 | ✓ |
| nr-01 | normas | 2 | ✓ |
| nr-02 | normas | 1 | ✓ |
| nr-03 | normas | 11 | ✓ |
| nr-04 | normas | 9 | ✓ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | — | ✗ |
| bo-02 | boletin | — | ✗ |
| bo-03 | boletin | — | ✗ |
| bo-04 | boletin | — | ✗ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 7 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | 1 | ✓ |
| sm-02 | similares | 5 | ✓ |
| sm-03 | similares | 39 | ✓ |
| sm-04 | similares | 1 | ✓ |
| sm-05 | similares | 1 | ✓ |

</details>

### 3. RRF ad-hoc (spike 86 — baseline)
`rrf-k=50 limit=50 w-fts=1 w-sem=1 unaccent=true`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 40.0% | 25.0% |
| boletin | 4 | 100.0% | 100.0% | 100.0% |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 40.0% | 80.0% | 54.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 52.5% |
| **AGREGADO** | **32** | **43.8%** | **68.8%** | **53.6%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | 6 | ✓ |
| tl-03 | titulo-literal | 2 | ✓ |
| tl-04 | titulo-literal | 1 | ✓ |
| tl-05 | titulo-literal | 5 | ✓ |
| tl-06 | titulo-literal | 2 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | 1 | ✓ |
| nl-02 | parafrasis-nl | 1 | ✓ |
| nl-03 | parafrasis-nl | 1 | ✓ |
| nl-04 | parafrasis-nl | 11 | ✓ |
| nl-05 | parafrasis-nl | 2 | ✓ |
| nr-01 | normas | 2 | ✓ |
| nr-02 | normas | 1 | ✓ |
| nr-03 | normas | 11 | ✓ |
| nr-04 | normas | 9 | ✓ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | 1 | ✓ |
| bo-02 | boletin | 1 | ✓ |
| bo-03 | boletin | 1 | ✓ |
| bo-04 | boletin | 1 | ✓ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 4 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | 1 | ✓ |
| sm-02 | similares | 5 | ✓ |
| sm-03 | similares | 39 | ✓ |
| sm-04 | similares | 1 | ✓ |
| sm-05 | similares | 2 | ✓ |

</details>

### 4. rpc-real (buscar_proyectos_hibrido — PROD)
`limit=50 (RPC real buscar_proyectos_hibrido)`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 40.0% | 25.0% |
| boletin | 4 | **75.0%** | **75.0%** | **75.0%** |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 40.0% | 80.0% | 54.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 52.5% |
| **AGREGADO** | **32** | **40.6%** | **65.6%** | **50.5%** |

<details><summary>Detalle por caso</summary>

| id | categoría | rank | ok |
|----|-----------|------|----|
| tl-01 | titulo-literal | 1 | ✓ |
| tl-02 | titulo-literal | 6 | ✓ |
| tl-03 | titulo-literal | 2 | ✓ |
| tl-04 | titulo-literal | 1 | ✓ |
| tl-05 | titulo-literal | 5 | ✓ |
| tl-06 | titulo-literal | 2 | ✓ |
| tl-07 | titulo-literal | — | ✗ |
| tl-08 | titulo-literal | 1 | ✓ |
| nl-01 | parafrasis-nl | 1 | ✓ |
| nl-02 | parafrasis-nl | 1 | ✓ |
| nl-03 | parafrasis-nl | 1 | ✓ |
| nl-04 | parafrasis-nl | 11 | ✓ |
| nl-05 | parafrasis-nl | 2 | ✓ |
| nr-01 | normas | 2 | ✓ |
| nr-02 | normas | 1 | ✓ |
| nr-03 | normas | 11 | ✓ |
| nr-04 | normas | 9 | ✓ |
| nr-05 | normas | — | ✗ |
| bo-01 | boletin | 1 | ✓ |
| bo-02 | boletin | 1 | ✓ |
| bo-03 | boletin | — | ✗ |
| bo-04 | boletin | 1 | ✓ |
| at-01 | acentos-toponimos | — | ✗ |
| at-02 | acentos-toponimos | 1 | ✓ |
| at-03 | acentos-toponimos | 4 | ✓ |
| at-04 | acentos-toponimos | — | ✗ |
| at-05 | acentos-toponimos | — | ✗ |
| sm-01 | similares | 1 | ✓ |
| sm-02 | similares | 5 | ✓ |
| sm-03 | similares | 39 | ✓ |
| sm-04 | similares | 1 | ✓ |
| sm-05 | similares | 2 | ✓ |

</details>

## Resumen Comparativo

| Estrategia | hit@1 | hit@5 | MRR@5 |
|------------|-------|-------|-------|
| FTS-solo | 9.4% | 18.8% | 11.8% |
| Semántico-solo | 34.4% | 53.1% | 40.3% |
| RRF ad-hoc (baseline 86) | 43.8% | 68.8% | 53.6% |
| **rpc-real** | **40.6%** | **65.6%** | **50.5%** |

## DECISIÓN

**Registrada al cierre del plan 87-03 — 2026-07-22**

### Veredicto: NO DOMINA — default permanece OFF

**Criterio de victoria (86-SCORING §e):**

| Criterio | Requerido | rpc-real | Resultado |
|----------|-----------|----------|-----------|
| (a) boletín hit@1 | 100% (4/4) | 75% (3/4) | **FALLA** |
| (b) parafrasis-nl hit@5 | ≥ 80% | 80.0% | CUMPLE |
| (c) similares hit@5 | ≥ 80% | 80.0% | CUMPLE |
| (d) agregado hit@5 ≥ semántico | > 53.1% | 65.6% | CUMPLE |

**El criterio (a) NO se cumple:** bo-03 tiene rank — (miss) en la RPC real. Los otros 3 casos de boletín (bo-01, bo-02, bo-04) sí llegan a rank=1 por short-circuit determinista dentro de la función SQL. bo-03 escapa al short-circuit.

### Hallazgo: bo-03 no resuelto por el short-circuit de la RPC

El caso bo-03 del golden set falla en la RPC real (`buscar_proyectos_hibrido`) a pesar de funcionar en el harness RRF ad-hoc. Hipótesis de la causa:

- El short-circuit SQL dentro de `buscar_proyectos_hibrido` implementa la búsqueda de boletín con una lógica diferente a la del harness (`detectarBoletin` + `BOLETIN_EXACT_QUERY`). Posiblemente bo-03 tiene un formato especial (punteado, sin sufijo, o con prefijo distinto) que el corte SQL de la RPC no cubre, pero que `detectarBoletin` sí normaliza antes de llamar al SQL de exact-match.
- Para diagnosticar: inspeccionar la query de bo-03 en el golden set y la implementación del short-circuit dentro de la función `buscar_proyectos_hibrido` en la migración de Plan 01.

### Consecuencia operacional

- **`BUSQUEDA_HIBRIDA_ENABLED` queda en default OFF.** El rewire de `/buscar` permanece latente tras el flag hasta que:
  1. se diagnostique y corrija el short-circuit de bo-03 en la función SQL, Y
  2. se re-corra este gate y bo-03 llegue a rank=1.
- **`match_proyectos` (RPC existente) sigue sirviendo `/buscar`.** Sin regresión para el usuario.
- **El harness y la infraestructura de medición (Task 1) quedan como regresión permanente.** La próxima corrida solo requiere re-ejecutar el CLI y confirmar dominancia.

### Lo que la RPC real SÍ resuelve (progreso parcial)

Comparado con semántico-solo (baseline mínimo antes del gate):

- titulo-literal: 75% hit@5 vs 75% — igual (no regresiona)
- parafrasis-nl: 80% hit@5 vs 80% — igual (no regresiona)
- similares: 80% hit@5 vs 80% — igual (no regresiona)
- acentos-topónimos: 40% hit@5 vs 20% — MEJORA (unaccent activo en PROD)
- agregado: 65.6% hit@5 vs 53.1% — MEJORA +12.5 pp

La RPC domina al semántico en todo excepto en el short-circuit de boletín (bo-03). Es una regresión puntual en la lógica SQL, no una falla de arquitectura.

### Próximo paso para cerrar el gate

Diagnosticar bo-03: ver `packages/fichas/src/spike/golden-set.ts` (caso bo-03) e inspeccionar la función `buscar_proyectos_hibrido` en la migración de Plan 01 para encontrar la divergencia del short-circuit. Corregir la función SQL, aplicar la migración a PROD, y re-ejecutar:

```
node scripts/run-with-env.mjs pnpm --filter @obs/fichas exec tsx src/spike/retrieval-cli.ts \
  --report /tmp/87-SCORING-v2.md --rrf-k 50 --limit 50
```
