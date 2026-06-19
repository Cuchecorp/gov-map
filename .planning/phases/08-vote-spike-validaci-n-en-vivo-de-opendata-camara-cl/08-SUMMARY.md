---
phase: 08-vote-spike-validaci-n-en-vivo-de-opendata-camara-cl
type: phase-findings
requirement: VOTE-01
decision: CONFIRMAR
live_run: true
live_run_date: "2026-06-19"
---

# Phase 8: VOTE Spike — FINDINGS y decisión binaria

## TL;DR

**DECISIÓN: CONFIRMAR.** La corrida LIVE contra `opendata.camara.cl/wscamaradiputados.asmx`
(`getVotaciones_Boletin` → `getVotacion_Detalle`) entregó, para la muestra LOCKED, el voto
individual por diputado con `Diputado/DIPID` y `Opcion` poblados (no null), totales que
reconcilian exactamente, y un mapeo determinista `DIPID → id_diputado_camara` del **100%**
sobre las 6 votaciones de la muestra. Los 4 criterios de VOTE-01 pasan. **Se construye Phase 10
(`@obs/votos` de producción) tal cual** — el pipeline v1.0 reusado se confirma operativo sobre
datos frescos de la legislatura vigente (Leg 58).

## Corrida LIVE (2026-06-19)

Comando: `VOTE_SPIKE_LIVE=1 pnpm --filter @obs/votos test` — suite completa verde (5/5),
incluyendo el bloque LIVE. Política de red LOCKED de `@obs/ingest` (allowlist SSRF + robots +
UA identificatorio + delay 2–3s serial-por-host), reusando los símbolos v1.0 verbatim
(`CamaraConnector` + `parseCamaraVotacion` + `parseCamaraVotoDetalle` + `reconciliarVotosCamara`).

### FINDINGS observado

```
Cobertura: 2/2 boletines con detalle; 6 votaciones evaluadas.
Campos poblados (DIPID+Opcion no null): 6/6 votaciones.
Totales reconcilian (count(si)===total_si & count(no)===total_no): 6/6.
Ratio mapeo DIPID->id_diputado_camara minimo en la muestra: 100.0%.
Rate: 8 requests, 0 errores; latencia 306-3361ms (incluye delay 2-3s LOCKED del HostRateLimiter).
```

| Votación | Boletín | si (det/tot) | no (det/tot) | Reconcilia | Mapeo DIPID | Poblado |
|----------|---------|--------------|--------------|------------|-------------|---------|
| camara:88813 | 14309-04 | 58/58 | 81/81 | ✓ | 139/139 (100%) | ✓ |
| camara:88812 | 14309-04 | 67/67 | 72/72 | ✓ | 139/139 (100%) | ✓ |
| camara:88811 | 14309-04 | 116/116 | 0/0 | ✓ | 116/116 (100%) | ✓ |
| camara:89180 | 18296-05 | 72/72 | 74/74 | ✓ | 146/146 (100%) | ✓ |
| camara:89179 | 18296-05 | 73/73 | 73/73 | ✓ | 146/146 (100%) | ✓ |
| camara:89178 | 18296-05 | 94/94 | 52/52 | ✓ | 146/146 (100%) | ✓ |

### Shape del XML confirmado en vivo

- Método REAL: `getVotacion_Detalle?prmVotacionId=<id>` (casing `prmVotacionId`), namespace
  `http://tempuri.org/`, raíz única `<Votacion>` (no lista `<Votaciones>`).
- Voto-a-voto: `Votos > Voto > Diputado/DIPID` + `Opcion Codigo` poblados NO NULL
  (vs `doGet.asmx` donde `Votos=null`). Códigos: `1`=Afirmativo→si, `0`=En Contra→no,
  `4`=No Vota (omitido como no-nominal, correcto fail-closed).
- `getVotaciones_Boletin?prmBoletin=<base>` devolvió 6 votaciones para 14309 y 3 para 18296,
  con totales `TotalAfirmativos`/`TotalNegativos` que coinciden con el conteo nominal del detalle.

## Criterios VOTE-01 — veredicto

| # | Criterio | Resultado |
|---|----------|-----------|
| (a) | Voto por diputado con DIPID+Opcion no null | ✅ 6/6 votaciones, todos poblados |
| (b) | Totales reconcilian (count(si)===total_si, count(no)===total_no) | ✅ 6/6 |
| (c) | DIPID mapea a `id_diputado_camara` determinista (≥0.95) | ✅ 100% en las 6 (mínimo 100%) |
| (d) | Cobertura + comportamiento de rate (delay 2–3s LOCKED) | ✅ 8 requests, 0 errores, latencia 306–3361ms refleja el delay serial |

## DECISIÓN BINARIA

**CONFIRMAR y construir Phase 10 tal cual.** `getVotacion_Detalle` entrega DIPID+Opcion no-null,
los totales reconcilian, y el DIPID mapea determinísticamente (sin LLM) al `id_diputado_camara`
oficial de la maestra v1.0 al 100% sobre la muestra Leg-58. No hay evidencia de bloqueo: el
endpoint responde tras el WAF reusando la política LOCKED, sin 429 ni RetryableError.

Notas para Phase 10 (no se actúan aquí — spike throwaway):
- El allowlist NO requiere edición: `camara.cl` ya está como sufijo y `opendata.camara.cl` pasa.
- El mapeo 100% sugiere que en producción podrá afirmarse `estado_vinculo='confirmado'` para la
  inmensa mayoría de los votos nominales; los misses (si aparecieran con DIPIDs de periodos
  anteriores) quedan fail-closed (`parlamentario_id=null`, `no_confirmado`), sin fabricar vínculo.
- No se construyó conector de producción, modelo de voto, migración ni ficha — eso es Phase 10.

## Verification

- `pnpm --filter @obs/votos test` → 4 passed, 1 skipped (LIVE en skip sin la flag).
- `VOTE_SPIKE_LIVE=1 pnpm --filter @obs/votos test` → 5 passed (LIVE incluido), corrida única
  deliberada el 2026-06-19 con el delay 2–3s LOCKED.
