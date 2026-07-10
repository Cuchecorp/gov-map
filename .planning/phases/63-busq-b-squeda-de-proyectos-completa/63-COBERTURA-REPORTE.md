# 63 — Reporte de cobertura del corpus de búsqueda (BUSQ-01/02/03)

**Fecha:** 2026-07-10 (EN CURSO — backfill LOCAL de tramitación corriendo en background)
**Fuente de conteos:** `scripts/verify-cobertura.sql` (`psql "$SUPABASE_DB_URL"`, PGCLIENTENCODING=UTF8).
**Alcance:** ver `63-ALCANCE-HISTORICO.md` — período vigente 2022→2026 (3.648 únicos; 3.506 net-new), lotes por año.

---

## 1. Baseline (antes del backfill, 2026-07-10)

| Conteo | Valor |
|--------|------:|
| proyecto | 156 |
| proyecto_ficha | 74 |
| proyecto_embedding | 74 |
| sin_ficha (gap BUSQ-01) | 82 |
| estado=embebido | 66 |
| estado=error | 8 |
| con_idea_matriz | 60 |
| embedding_version=v1 (stale) | 8 |
| embedding_version=v1-reembed | 66 |

---

## 2. Ingesta de tramitación (Etapa-1 R2 → proyecto) — POR AÑO

Todo LOCAL, rate-limit 2-3s, R2 content-addressed primero (Etapa-1), upsert idempotente (Etapa-2).
La Etapa-1 R2 usa `If-None-Match` (existed=true = skip idempotente); re-correr NO re-descarga.

| Año | net-new a ingerir | Estado | proyectos LIVE | votaciones | votos | errores |
|-----|------------------:|--------|---------------:|-----------:|------:|--------:|
| 2026 | 311 | ✅ COMPLETO | 308 | 183 | 22.097 | 0 |
| 2025 | 682 | ⏳ EN CURSO (chunks 250) | — | — | — | 0 |
| 2024 | 785 | ⏳ pendiente (encolado) | — | — | — | — |
| 2023 | 885 | ⏳ pendiente (encolado) | — | — | — | — |
| 2022 | 843 | ⏳ pendiente (encolado) | — | — | — | — |

**Evidencia de las DOS ETAPAS LOCKED + hash-check:**
- 2026: 308 crudos escritos a R2 (`tramitacion/<boletin>/2026-07-10/<sha256>.json`) ANTES del parseo a Supabase.
- Los 2 boletines del smoke-test aparecieron como `[skip] sin novedades` en la corrida 2026 → hash-check R2 evitó re-descarga (idempotencia probada).
- **0 errores, 0 bloqueos del WAF** en 619+ boletines procesados hasta ahora (rate-limit 2-3s respetado, sin ráfagas).

**Snapshot de conteos (mid-ingesta, 2026-07-10):** proyecto=579, proyecto_ficha=74, sin_ficha=505.
El gap `sin_ficha` crece con la ingesta (esperado) — se cierra con el SEED (paso siguiente) y se llena con el PIPELINE (Task 4).

### Deviación aplicada (Rule 3 — blocking-issue auto-fix)

**Tope de línea de comandos de Windows (~32KB) excedido** al pasar años completos (682-890 boletines) como un solo `--boletines` CSV → `"La línea de comandos es demasiado larga"`. **Fix:** driver `run-backfill-chunks.sh` que divide cada año en chunks de 250 boletines (bajo el tope; el batch 2026 de 311 sí cupo) y los corre EN SERIE, reanudable vía R2 hash-check. El batch 2026 (311, un solo CSV) sí cupo bajo el tope y se corrió directo. Sin este fix el backfill de 2022-2025 fallaba silenciosamente al arranque.

---

## 3. Seed + Pipeline + reembed — PENDIENTE (Task 4)

Tras completar la ingesta de tramitación de los 4 años restantes:
1. `seed-fichas-cli.ts` → abre fila `proyecto_ficha estado='pendiente'` para TODO proyecto sin ficha (cierra el gap → `count(proyecto)==count(proyecto_ficha)`).
2. `pipeline-cli.ts --limite N` en lotes reanudables → PDF + DeepSeek (idea matriz) + Gemini (embedding 768) hasta agotar `pendiente`.
3. `pipeline-cli.ts --reembed` → re-embebe los 8 `v1` stale (title-only).
4. `verify-cobertura.sql` final → igualdad de counts O diferencia 100% explicada por causa/boletín.

**Techo honesto conocido (NO reintentar al LLM):** 8 RUT-bloqueados (permanente, `assertNoRutInLlmInput` LOCKED), 1 PDF escaneado, ~3-5 sin idea literal / schema-fail (reintento único). La lista definitiva por boletín/causa va en la sección final tras el pipeline.

---

## 4. Cron acotado — PENDIENTE (Task 5)

Verificar (leyendo el código) que `leyes-weekly.yml` usa `run-tramitacion-prod-cli.ts` con `--limite 80`, que el enumerador histórico (`run-enumerar-historico-cli.ts`) NO está en ningún YAML, y que el cron NO re-backfilla el histórico.

---

_Este reporte se completa en Task 4/5 con los counts finales y el techo honesto por causa._
