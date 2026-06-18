# Backlog — Observatorio del Congreso 360

Ideas y deuda técnica capturadas durante el desarrollo. Promovibles a un milestone con `/gsd:review-backlog`.

## Deuda técnica

### DEBT-01 — Tabla de sala de la Cámara: PDF → estructurado vía LLM barato
**Capturado:** 2026-06-18 (Fase 6) · **Prioridad:** media · **Origen:** decisión de degradación honesta en Fase 6 (TRAM-08)

**Contexto:** La Cámara NO publica su tabla semanal de sala (orden del día) como dato estructurado — solo como **PDF** (`https://www.camara.cl/...verDoc.aspx?prmTipo=TABLASEMANAL`, ~148KB, 2pp). En Fase 6 se degradó honestamente: la UI enlaza al PDF oficial y marca "no disponible como dato estructurado". (El Senado sí entrega `web-back.senado.cl/api/weekly_table` estructurado.)

**Deuda a saldar:** construir un extractor que transforme el PDF oficial de la tabla de sala de la Cámara en filas estructuradas (posición / parte de la sesión / materia / boletín / etapa), para igualar la cobertura del Senado.

**Enfoque propuesto:**
- Ingestar el PDF con el framework de `@obs/ingest` (provenance, caché), guardar crudo (R2 cuando haya cred).
- Extraer texto del PDF (capa de parsing PDF) y, si el layout es irregular, usar **DeepSeek V4 Flash** (ya integrado en `@obs/llm`, barato, `json_object` + prompt-cache) para mapear a la estructura `tabla_sala` con salida validada por zod.
- Reusar el modelo `tabla_sala` de Fase 6 (las filas Cámara dejan de ser "degradadas" y pasan a estructuradas con provenance al PDF).
- Golden/fixtures con un par de PDFs reales; validar que los boletines extraídos cruzan a las fichas de Fase 5.
- Mantener trazabilidad: cada fila enlaza al PDF fuente; si la extracción LLM tiene baja confianza, marcar como "derivado, ver PDF".

**Dependencias:** `@obs/llm` (DeepSeek), modelo `tabla_sala` (Fase 6). **No bloquea** el milestone actual.
