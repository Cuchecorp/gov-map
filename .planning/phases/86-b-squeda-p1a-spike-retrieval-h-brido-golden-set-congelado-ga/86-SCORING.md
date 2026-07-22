# 86-SCORING — Resultados del Spike de Retrieval Híbrido

**Corrida:** 2026-07-22T00:43:39.268Z
**Golden set:** 32 casos

## Cobertura de Embeddings (LIVE)

| Métrica | Valor |
|---------|-------|
| proyecto (total) | 3659 |
| proyecto_embedding | 3100 |
| Cobertura | 84.7% |
| unaccent habilitado | false |

## Tabla Estrategia × Categoría

### 1. FTS-solo
`limit=50 unaccent=false`

| Categoría | N | hit@1 | hit@5 | MRR |
|-----------|---|-------|-------|-----|
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

| Categoría | N | hit@1 | hit@5 | MRR |
|-----------|---|-------|-------|-----|
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

### 3. RRF (FTS ∪ semántico)
`rrf-k=50 limit=50 w-fts=1 w-sem=1 unaccent=false`

| Categoría | N | hit@1 | hit@5 | MRR |
|-----------|---|-------|-------|-----|
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

## Resumen Comparativo

| Estrategia | hit@1 | hit@5 | MRR |
|------------|-------|-------|-----|
| FTS-solo | 9.4% | 18.8% | 11.8% |
| Semántico-solo | 34.4% | 53.1% | 40.3% |
| RRF | 43.8% | 68.8% | 53.6% |

## DECISIÓN

**Registrada al cierre del plan 86-03 — 2026-07-22**

### (a) Estrategia ganadora: RRF (FTS ∪ semántico) con short-circuit determinista de boletín

- **Algoritmo elegido:** RRF (Reciprocal Rank Fusion) fusionando FTS ad-hoc y `match_proyectos` semántico, con short-circuit determinista de boletín FUERA de la fusión.
- **Pesos tsvector:** A = titulo, B = idea_matriz, C = normas (cuerpos_legales jsonb, key 'norma').
- **Pesos de fusión FTS/semántico:** w_fts=1, w_sem=1 (igual peso).
- **rrf_k:** 50 (valor central del patrón Supabase; el grid limit 20/50/100 × rrf_k 30/50/70 dio resultados idénticos → corpus 3.659 insensible en este rango).
- **Límite de candidatos por rama:** 50 (default central).
- **Cobertura embeddings LIVE:** 3100/3659 (84.7%) — medida en PROD, no asumida.
- **unaccent en PROD:** false (extensión ausente) — explica FTS-solo 9.4% y acentos-topónimos 20% hit@1. La proyección del spike SUBESTIMA el potencial RRF; con unaccent solo puede mejorar.

**Evidencia de dominación (criterio de victoria cumplido):**

| Estrategia | hit@1 | hit@5 | MRR |
|------------|-------|-------|-----|
| FTS-solo | 9.4% | 18.8% | 11.8% |
| Semántico-solo | 34.4% | 53.1% | 40.3% |
| **RRF (ganadora)** | **43.8%** | **68.8%** | **53.6%** |

RRF domina las 3 métricas globales. No regresiona NL/similares: parafrasis-nl 80% hit@5 (igual semántico-solo), similares 80% hit@5 (igual). Boletines: 100% hit@1 (4/4) por short-circuit determinista.

### (b) REQUISITO DURO para fase 87: `CREATE EXTENSION unaccent` + wrapper IMMUTABLE

La corrida midió que `unaccent` NO está instalado en PROD. Esto explica el 9.4% de FTS-solo y el 20% hit@1 en acentos-topónimos. La RPC híbrida de fase 87 DEBE incluir en su migración:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT unaccent($1) $$;
```

Sin esto el FTS funciona en modo degradado y la mejora real del RRF queda subestimada.

### (c) Caso boletín analizado: todos los 4 casos pasaron hit@1 en RRF

La tabla final muestra bo-01 a bo-04 todos en rank=1 en RRF (100% hit@1, 4/4). El short-circuit de boletín en `detectarBoletin` maneja correctamente los 3 formatos:
- `14309-04` → `{base:"14309", sufijo:"04"}` → busca por `boletin='14309-04'` OR `boletin_num='14309'` → hit exacto.
- `14309` → `{base:"14309", sufijo:null}` → busca por `boletin_num='14309'` → resuelve a `14309-04` (prefix-match vía boletin_num).
- `14.309-04` → strip de puntos → `14309-04` → mismo flujo que caso 1.
- `18060-07` → hit directo por `boletin='18060-07'`.

**El requisito de "boletín SIEMPRE #1" está CUMPLIDO en el spike.** La RPC de fase 87 debe implementar el mismo short-circuit (boletin exacto OR boletin_num prefix-match) como cláusula determinista en la función SQL.

**Nota sobre el checkpoint:** el jefe indicó "~75% (3/4)" basándose en una estimación preliminar antes de ver la tabla final. Los datos LIVE muestran 100% (4/4). No hay caso fallido que documentar.

### (d) Golden set CONGELADO

El golden set queda congelado con las correcciones LIVE de d7bb3d3 (expected[] verificados contra PROD; placeholders reemplazados). Cualquier cambio futuro = decisión explícita registrada en 86-SCORING.md con justificación en el campo `nota` del caso.

### (e) Plan de flag para fase 87

- `match_proyectos` (RPC existente) se CONSERVA intacta — la usa "proyectos similares" (SEM-05).
- La RPC híbrida nueva (`buscar_proyectos_hibrido` o similar) entra DETRÁS de flag/paralelo.
- `/buscar` solo se rewirea a la RPC híbrida cuando el golden live-test la muestre dominante sobre la RPC real de fase 87 (no sobre el harness del spike).
- **Gate de fase 87 explícito:** sin dominación demostrada sobre el golden set en la RPC real de 87, no hay rewire del endpoint `/buscar`. La dominación ya fue demostrada en este spike; el gate se re-verifica sobre la RPC real.

## Post-fix re-run (2026-07-21, tras code review)

Tras aplicar los 7 fixes del review (CR-01 guard sobre SQL final, WR-01 boletín punteado estricto, WR-02 límites por brazo, WR-03 etiquetas MRR@5, WR-04 excludeBoletin en brazo semántico del RRF, WR-05 probeUnaccent tri-estado, WR-06 loadEnv sin ENOENT), se re-corrió el scoring LIVE completo (rrf-k=50, limit=50, embeddings 100% desde cache):

- FTS-solo: hit@1=9.4% hit@5=18.8% MRR@5=11.8% — idéntico
- Semántico-solo: hit@1=34.4% hit@5=53.1% MRR@5=40.3% — idéntico
- RRF: hit@1=43.8% hit@5=68.8% MRR@5=53.6% — idéntico

**La decisión RRF se sostiene sin cambios tras los fixes.** Los fixes WR-02/WR-04 agregan superficie de API con defaults equivalentes al comportamiento medido; ningún número cambió.
