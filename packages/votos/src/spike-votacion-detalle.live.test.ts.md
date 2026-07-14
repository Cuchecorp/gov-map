# SPIKE `getVotacion_Detalle` LIVE — hallazgos (Phase 64, Plan 02)

**Corrida LIVE:** 2026-07-14 · `opendata.camara.cl/wscamaradiputados.asmx/getVotacion_Detalle`
**Gate:** `VOTOS_LIVE=1` (SKIP por defecto; excluido del glob de vitest normal). Corrida deliberada:
`VOTOS_LIVE=1 pnpm --filter @obs/votos exec vitest run --config vitest.live.config.ts src/spike-votacion-detalle.live.test.ts`
**Muestra:** `prmVotacionId ∈ {89178, 89179, 89180, 88813, 89000}` — 5 votaciones, recorrido SERIAL
(rate-limit 2-3s LOCKED del `HostRateLimiter`, sin `Promise.all`). Duración 16 s (~3.2 s/votación).

Documento técnico factual. Sin lenguaje causal ni insinuante — es un registro de forma y semántica del endpoint.

---

## (a) Estado del endpoint a escala — UP

Las 5 votaciones respondieron **HTTP 200** con roster voto-a-voto completo (ns `http://tempuri.org/`).
El cross-check Σ(roster) == `Total*` del header **cuadró en las 5** (ver tabla). El endpoint está **UP y
estable a la escala probada** — consistente con RESEARCH (probed 200, 2026-07-13). Confianza: la muestra
son 5 votaciones consecutivas de Leg-58; para el backfill masivo (Phase 66) re-probar rangos más antiguos.

| prmVotacionId | si | no | abs | pareo | Afirm | Neg | Abst | Disp | cross-check |
|---------------|----|----|-----|-------|-------|-----|------|------|-------------|
| 89178 | 94 | 52 | 1 | 4 | 94 | 52 | 1 | 0 | ✅ |
| 89179 | 73 | 73 | 1 | 4 | 73 | 73 | 1 | 0 | ✅ |
| 89180 | 72 | 74 | 1 | 4 | 72 | 74 | 1 | 0 | ✅ |
| 88813 | 58 | 81 | 0 | 10 | 58 | 81 | 0 | 0 | ✅ |
| 89000 | 105 | 46 | 0 | 2 | 105 | 46 | 0 | 0 | ✅ |

Un mismatch en cualquier bucket habría hecho `expect`-fail RUIDOSO (SC#3 LIVE) — no ocurrió.

## (b) Mapeo confirmado LIVE

Fijado por test (Plan 01) y validado contra la fuente viva (Plan 02):

| `Opcion Codigo` | Label roster | `Seleccion` | Confirmación |
|-----------------|--------------|-------------|--------------|
| `1` | Afirmativo | `si` | LIVE (Σ==TotalAfirmativos, 5/5) |
| `0` | En Contra | `no` | LIVE (Σ==TotalNegativos, 5/5) |
| `2` | Abstencion | `abstencion` | LIVE (Σ==TotalAbstenciones, 5/5) |
| `4` | No Vota | `ausente` | LIVE (roster; ver Dispensado abajo) |

**Pareo — desde el bloque hermano `<Pareos>`, NO código 3 (A1b RESUELTO LIVE).** El pareo se observó en
**las 5 votaciones**. El parser (`parseCamaraVotoDetalle`) recolecta los DIPID de `<Pareos><Pareo>`
(`Diputado1.DIPID` / `Diputado2.DIPID`) y RE-ETIQUETA a `pareo` las filas del roster que esos DIPID traen
como "No Vota" (código 4). Verificado por assert: cada DIPID pareado → `opcion === "pareo"`.

- 89178/89179/89180: DIPID pareados `1117, 1025, 1107, 1075` (4)
- 88813: `1240, 1082, 1259, 1142, 1039, 1131, 1015, 1217, 1107, 1219` (10)
- 89000: `1217, 1207` (2)

> Nota vs RESEARCH: RESEARCH (2026-07-13) NO observó pareo en la muestra y lo dejó como residual. Este
> SPIKE (2026-07-14) SÍ lo observó LIVE en 5/5 — **A1b queda confirmado contra la fuente**, no solo offline.
> NUNCA se promovió un `Opcion Codigo=3` a verificado (no existe en el roster real).

**Dispensado — NO observado en la ventana (fail-closed, no fabricado).** `TotalDispensados=0` en las 5
votaciones → no se pudo discriminar si "Dispensado" es una `Opcion` propia o se pliega a "No Vota" (código
4). Se registra como **no observado**; NO se assert-a ni se fabrica un bucket. Re-probe en Phase 66 buscando
una votación con `TotalDispensados>0`.

## (c) Crudo persistido a R2 (STAGE 1, dos-etapas LOCKED) — SC#1

Cada respuesta LIVE se persistió PRIMERO a R2 content-addressed vía `R2Store.putImmutable`
(`camara-opendata/getVotacion_Detalle/<fecha>/<sha256>.xml`, `If-None-Match:*`, 412=idempotente).
Las 5 retornaron `existed=false` (escritura fresca). R2 = verdad cruda; el parse es derivado reconstruible.

```
camara-opendata/getVotacion_Detalle/2026-07-14/fd8a4b3f1726c8d8b93fd18c89d30ee13c00f30e53d243aa0f84f75b9c6c1161.xml   # 89178
camara-opendata/getVotacion_Detalle/2026-07-14/b3bead09ab77414bb35ce3aecb5b64e9a71692e6379243a576ce448f2090f449.xml   # 89179
camara-opendata/getVotacion_Detalle/2026-07-14/188cede5bc4a94026f5c93dfc935aa07f16363373fabc8ab1f095383257fa8af.xml   # 89180
camara-opendata/getVotacion_Detalle/2026-07-14/ed18a32bd9555ff0e43306f7a9274d6d541d6df14a7b2760b8e9468a63baf234.xml   # 88813
camara-opendata/getVotacion_Detalle/2026-07-14/4eb387c6538dcccde3d144ab93b3456dd68815cb42d86a85f2993f46c55fa7ec.xml   # 89000
```

## (d) Decisión de fallback (SC#4) — `getVotaciones_Boletin` como contingencia

**Plan actual para Phase 66:** el detalle voto-a-voto (`getVotacion_Detalle`) es la **vía primaria** — está
UP a escala, el cross-check cuadra, y preserva el voto individual por DIPID (cruce determinista, riesgo #1).

**Contingencia (NO el plan de hoy):** si en el backfill de Phase 66 el detalle **degradara a escala** (5xx/WAF
sostenido en rangos antiguos o grandes), el **fallback honesto es `getVotaciones_Boletin`** (agregado):
- Se **pierde** el voto individual (no hay roster por diputado).
- Se **conservan** los totales `Total*` de la votación (Afirmativos/Negativos/Abstenciones/Dispensados).
- El endpoint agregado quedó probado UP (RESEARCH 2026-07-13) → el fallback es viable.
- **Gatilla un re-plan del bloque VOTO:** la cobertura de voto individual se declara honestamente como
  parcial para los rangos afectados (VOTO-05), y la ficha muestra el agregado con su provenance, sin
  inventar votos por diputado.

El conector ya expone `CamaraConnector.fetchVotacionesBoletin(boletinBase)` — el fallback no requiere
código nuevo, solo la decisión de ruta en el runner de Phase 66.

## Preguntas abiertas para Phase 66 (nunca fabricadas)

1. **Dispensado bucket** — buscar una votación con `TotalDispensados>0` y determinar si "Dispensado" es una
   `Opcion` distinta o se pliega a "No Vota" (código 4). No observado en esta ventana.
2. **Escala de backfill** — probar el detalle en rangos más antiguos/grandes de Leg-58 (y legislaturas
   previas) para decidir detalle-directo vs fallback agregado por rango.
3. **Pareo en legislaturas antiguas** — confirmar que el bloque `<Pareos>` está presente en el shape de
   legislaturas anteriores (aquí confirmado en Leg-58, 5/5).
