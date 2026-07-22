import { readFileSync, writeFileSync } from "node:fs";

const path =
  "C:/Users/Carlo/OneDrive - pjud.cl/Documentos/GitHub/Observatorio/.planning/phases/87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix/87-SCORING.md";

let data = readFileSync(path, "utf8");

// Find the start of section 4 and replace everything from there
const marker = "\n### 4.";
const idx = data.indexOf(marker);
if (idx === -1) {
  console.error("MARKER NOT FOUND");
  process.exit(1);
}
const before = data.slice(0, idx);

const addition = `
### 4. rpc-real v1 (buscar_proyectos_hibrido — PROD antes de fix bo-03)
\`limit=50 (RPC real buscar_proyectos_hibrido, migración 0055)\`

| Categoría | N | hit@1 | hit@5 | MRR@5 |
|-----------|---|-------|-------|-------|
| acentos-toponimos | 5 | 20.0% | 40.0% | 25.0% |
| boletin | 4 | **75.0%** | **75.0%** | **75.0%** |
| normas | 5 | 20.0% | 40.0% | 30.0% |
| parafrasis-nl | 5 | 60.0% | 80.0% | 70.0% |
| similares | 5 | 40.0% | 80.0% | 54.0% |
| titulo-literal | 8 | 37.5% | 75.0% | 52.5% |
| **AGREGADO** | **32** | **40.6%** | **65.6%** | **50.5%** |

bo-03 fallaba (rank —): \`"14.309-04"\` no pasaba el regex \`^\\d{3,6}(-\\d{1,2})?$\` por el punto.

### 5. rpc-real v2 (buscar_proyectos_hibrido — PROD con fix bo-03, migración 0056)
\`limit=50 (RPC real buscar_proyectos_hibrido, 2026-07-22)\`

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

**Causa raíz:** \`runRpcHibrida\` pasa \`q\` crudo al SQL sin llamar \`detectarBoletin\`. El regex SQL original \`^\\d{3,6}(-\\d{1,2})?$\` no coincidía con el formato punteado \`"14.309-04"\` (el punto lo rompe). El harness RRF ad-hoc funciona porque llama \`detectarBoletin\` que normaliza antes del SQL.

**Fix:** Migración 0056 convierte la RPC de \`language sql\` a \`language plpgsql\` con normalización determinista: si \`q_trim ~ '^\\d{1,3}(\\.\\d{3})*(-\\d{1,2})?$'\` entonces \`q_norm = replace(q_trim, '.', '')\`. El regex punteado cubre \`14.309-04\`, \`14.309\`, no cubre \`12.34\` ni texto libre.

**pgTAP 5/5 verde** (0056_busqueda_hibrida_boletin_norm.test.sql): función existe, ACL intacta, canónico 15627-12, punteado 14.309-04, punteado-sin-sufijo 14.309.

### Estado del flag

- **\`BUSQUEDA_HIBRIDA_ENABLED\` default ON** (gate flippeado — \`busqueda-hibrida-gate.ts\`).
- **Rollback:** setear \`BUSQUEDA_HIBRIDA_ENABLED=false\` en Cloudflare → OFF inmediato sin redeploy.
- **Test suite:** 1009/1009 verde. tsc limpio.
`;

writeFileSync(path, before + addition, "utf8");
console.log("Written OK. Lines:", (before + addition).split("\n").length);
