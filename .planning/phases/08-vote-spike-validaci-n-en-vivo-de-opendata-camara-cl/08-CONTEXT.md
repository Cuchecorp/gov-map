# Phase 8: VOTE Spike — Validación en vivo de `opendata.camara.cl` - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Confirmar o replanificar el bloque VOTE validando EN VIVO, detrás del WAF gubernamental, que `opendata.camara.cl/wscamaradiputados.asmx` (`getVotaciones_Boletin` → `getVotacion_Detalle`) entrega el voto individual por diputado utilizable para enlace determinista. Es un spike de investigación: NO construye el conector de producción ni el modelo de datos, NO dimensiona historias VOTE aguas abajo. Termina en una decisión binaria registrada (confirmar/replanificar).

</domain>

<decisions>
## Implementation Decisions

### Método del spike
- **Muestra:** los 2 boletines cross-cámara ya usados en v1.0 (14309 / 18296) + 2-3 votaciones recientes de la legislatura vigente, para reusar fixtures conocidos y a la vez probar cobertura actual.
- **Código desechable:** script de spike aislado (p.ej. `packages/votos/spike/` o un script CLI temporal), sin tocar el modelo común ni crear el `@obs/votos` de producción. El conector real es Phase 10.
- **Registro del hallazgo:** documentar en el `08-*-SUMMARY.md` de la fase (con un FINDINGS conciso: shape del XML, campos poblados, mapeo `Diputado/Id` → `id_diputado_camara`, cobertura histórica, comportamiento de rate) y registrar la decisión binaria en STATE.md (Accumulated Context → Decisions).
- **Política de red:** reusar `@obs/ingest` (allowlist + robots + UA identificatorio + delay 2–3s LOCKED) incluso para el spike — nunca golpear el WAF con `fetch` a pelo.

### Criterio de la decisión binaria
- **Confirmar y construir Phase 10 tal cual** si: el detalle de votación devuelve el contenedor de votos por diputado con `Diputado` y `Opcion` poblados (no null), reconciliables contra los totales (`TotalAfirmativos/Negativos/Abstenciones/Dispensados` + `Pareos`), y `Diputado/Id` mapea al `id_diputado_camara` oficial de la maestra v1.0 (enlace determinista sin LLM).
- **Replanificar solo el bloque VOTE** (sin bloquear INT/MONEY) si el voto individual no viene, viene null, o el id no mapea determinísticamente.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/ingest` — política de red LOCKED (rate-limit 2–3s serial-por-host, robots, UA, allowlist SSRF, caché diaria, R2 inmutable). Se reusa en el orden LOCKED, sin `BaseConnector.run`, igual que los conectores de tramitación/agenda de v1.0.
- `fast-xml-parser@5` — ya en el stack para el XML del Senado/Cámara.
- Maestra `parlamentario` v1.0 con `id_diputado_camara` (155 diputados) — la diana del mapeo determinista.
- Patrón v1.0: la Cámara cruza el voto determinísticamente por `Diputado/Id` → `id_diputado_camara` (ya probado en `reconciliar`/tramitación de Phase 5).

### Established Patterns
- Conectores reusan `@obs/ingest` (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get), NO `BaseConnector`, para flujos acotados.
- `opendata.camara.cl` aún NO está en la allowlist SSRF (research dijo que leylobby/cplt/infoprobidad/mercadopublico sí, pero opendata.camara.cl hay que verificar/agregar).

### Integration Points
- Lectura: maestra `parlamentario` (campo `id_diputado_camara`) para validar el mapeo.
- El hallazgo alimenta el plan de Phase 10 (`@obs/votos`).

</code_context>

<specifics>
## Specific Ideas

- El spike es **confirm-or-replan**, no descubrimiento abierto: research ya indica que `getVotaciones_Boletin` documenta `Votos > Voto > {Diputado, Opcion}`. El objetivo es verificar en vivo que NO viene null (a diferencia de `doGet.asmx` donde `Votos=null`) y que el id mapea.
- Respetar el delay 2–3s es obligatorio (WAF). El spike debe ser deliberadamente acotado en número de requests.
- Nota memoria del proyecto: lectura de catálogos gov OK; DDL remoto Supabase y R2 S3 bloqueados (probado 2026-06-18) — el spike es solo lectura, no escribe DDL ni R2.

</specifics>

<deferred>
## Deferred Ideas

- Construcción del conector `@obs/votos` de producción, modelo de datos del voto individual, y la ficha → Phase 10.
- Agregar `opendata.camara.cl` a la allowlist como cambio permanente → Phase 10 (en el spike puede ir como edición acotada/temporal si hace falta para pasar el guard SSRF).

</deferred>
