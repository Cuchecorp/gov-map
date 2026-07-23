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

### 4. rpc-real v1 (buscar_proyectos_hibrido — PROD antes de fix bo-03)
`limit=50 (RPC real buscar_proyectos_hibrido, migración 0055)`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 40.0% | 25.0% |
| boletin | 4 | **75.0%** | **75.0%** | **75.0%** |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 40.0% | 80.0% | 54.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 52.5% |
| **AGREGADO** | **32** | **40.6%** | **65.6%** | **50.5%** |

bo-03 fallaba (rank —): `"14.309-04"` no pasaba el regex `^\d{3,6}(-\d{1,2})?$` por el punto.

### 5. rpc-real v2 (buscar_proyectos_hibrido — PROD con fix bo-03, migración 0056)
`limit=50 (RPC real buscar_proyectos_hibrido, 2026-07-22)`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 40.0% | 25.0% |
| boletin | 4 | **100.0%** | **100.0%** | **100.0%** |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 40.0% | 80.0% | 54.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 52.5% |
| **AGREGADO** | **32** | **43.8%** | **68.8%** | **53.6%** |

<details><summary>Detalle por caso (v2)</summary>

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

## Resumen Comparativo (final)

| Estrategia | hit@1 | hit@5 | MRR@5 |
|------------|-------|-------|-------|
| FTS-solo | 9.4% | 18.8% | 11.8% |
| Semántico-solo | 34.4% | 53.1% | 40.3% |
| RRF ad-hoc (baseline 86) | 43.8% | 68.8% | 53.6% |
| rpc-real v1 (0055, bo-03 fail) | 40.6% | 65.6% | 50.5% |
| **rpc-real v2 (0056, bo-03 fix)** | **43.8%** | **68.8%** | **53.6%** |

## DECISIÓN FINAL

**Registrada al cierre del plan 87-03 — 2026-07-22**

### Veredicto: DOMINA — default flippeado a ON

**Criterio de victoria (86-SCORING §e):**

| Criterio | Requerido | rpc-real v2 | Resultado |
|----------|-----------|-------------|-----------|
| (a) boletín hit@1 | 100% (4/4) | 100% (4/4) | CUMPLE |
| (b) parafrasis-nl hit@5 | ≥ 80% | 80.0% | CUMPLE |
| (c) similares hit@5 | ≥ 80% | 80.0% | CUMPLE |
| (d) agregado hit@5 ≥ semántico | > 53.1% | 68.8% | CUMPLE |

**Todos los criterios se cumplen.** La RPC v2 iguala el RRF ad-hoc en todas las métricas.

### Fix bo-03 (migración 0056)

**Causa raíz:** `runRpcHibrida` pasa `q` crudo al SQL sin llamar `detectarBoletin`. El regex SQL original `^\d{3,6}(-\d{1,2})?$` no coincidía con el formato punteado `"14.309-04"` (el punto lo rompe). El harness RRF ad-hoc funciona porque llama `detectarBoletin` que normaliza antes del SQL.

**Fix:** Migración 0056 convierte la RPC de `language sql` a `language plpgsql` con normalización determinista: si `q_trim ~ '^\d{1,3}(\.\d{3})*(-\d{1,2})?$'` entonces `q_norm = replace(q_trim, '.', '')`. El regex punteado cubre `14.309-04`, `14.309`, no cubre `12.34` ni texto libre.

**pgTAP 5/5 verde** (0056_busqueda_hibrida_boletin_norm.test.sql): función existe, ACL intacta, canónico 15627-12, punteado 14.309-04, punteado-sin-sufijo 14.309.

### Estado del flag

- **`BUSQUEDA_HIBRIDA_ENABLED` default ON** (gate flippeado — `busqueda-hibrida-gate.ts`).
- **Rollback:** setear `BUSQUEDA_HIBRIDA_ENABLED=false` en Cloudflare → OFF inmediato sin redeploy.
- **Test suite:** 1009/1009 verde. tsc limpio.
