# 63 — Reporte de cobertura del corpus de búsqueda (BUSQ-01/02/03)

**Fecha:** 2026-07-10 (INGESTA COMPLETA + SEED CERRADO — pipeline de fichas corriendo en background)
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

Cada año se dividió en chunks de 250 boletines (tope de línea de comandos de Windows ~32KB) y se
corrieron EN SERIE con `run-backfill-chunks.sh`. R2writes es acumulativo dentro del log del año.

| Año | net-new a ingerir | Estado | R2writes (acum.) | errores puntuales |
|-----|------------------:|--------|-----------------:|------------------:|
| 2026 | 311 | ✅ COMPLETO | 308 | 0 |
| 2025 | 682 | ✅ COMPLETO | — | ~0 |
| 2024 | 785 | ✅ COMPLETO | 785 | 0 |
| 2023 | 885 | ✅ COMPLETO | 883 | 6 |
| 2022 | 843 | ✅ COMPLETO | 841 | 6 |

**Marcador de cierre:** `driver.log` → `=== backfill-chunks DONE 18:34:49 ===` (2026-07-10). Los 4 años
restantes (2022-2025) se ingirieron completos tras el checkpoint T3 ("esperar y continuar").

**Errores puntuales (~22 en total sobre >3.500 boletines):** fallos aislados por boletín (timeout/parse
de fuente viva), NO bloqueo sostenido del WAF. La Etapa-1 R2 content-addressed hace el backfill
reanudable: re-correr saltea lo ya en R2 (hash-check `If-None-Match`). No se martilló la fuente.

**Evidencia de las DOS ETAPAS LOCKED + hash-check:**
- Cada boletín escribe el crudo a R2 (`tramitacion/<boletin>/2026-07-10/<sha256>.json`) ANTES del parseo a Supabase.
- Los 2 boletines del smoke-test aparecieron como `[skip] sin novedades` en la corrida 2026 → hash-check R2 evitó re-descarga (idempotencia probada).
- rate-limit 2-3s/host respetado en todos los años, sin ráfagas.

### Cierre del gap por el SEED (BUSQ-01)

Tras completar la ingesta se re-corrió `seed-fichas-cli.ts`. **Fix aplicado (commit `6b1ebd8`, orquestador):**
`seedFichasPendientes` paginaba mal los `select` (PostgREST recorta a ~1000 filas) → el Set-diff comparaba
páginas desalineadas y el seed no cerraba el gap a >1k. Con la paginación corregida el seed abrió una fila
`proyecto_ficha estado='pendiente'` por CADA proyecto sin ficha.

**Conteos post-ingesta + post-seed (2026-07-10, `verify-cobertura.sql`):**

| Conteo | Valor |
|--------|------:|
| proyecto | 3.657 |
| proyecto_ficha | 3.657 |
| sin_ficha (gap BUSQ-01) | **0** ✅ |
| pendiente | 3.583 |
| embebido | 66 |
| error | 8 |
| proyecto_embedding | 74 |

**`count(proyecto) == count(proyecto_ficha)` = 3.657 == 3.657 → gap CERRADO** (criterio Task 2/3 cumplido).
Los 3.583 `pendiente` son la cola que consume el pipeline (Task 4).

### Deviación aplicada (Rule 3 — blocking-issue auto-fix)

**Tope de línea de comandos de Windows (~32KB) excedido** al pasar años completos (682-890 boletines) como un solo `--boletines` CSV → `"La línea de comandos es demasiado larga"`. **Fix:** driver `run-backfill-chunks.sh` que divide cada año en chunks de 250 boletines (bajo el tope; el batch 2026 de 311 sí cupo) y los corre EN SERIE, reanudable vía R2 hash-check. El batch 2026 (311, un solo CSV) sí cupo bajo el tope y se corrió directo. Sin este fix el backfill de 2022-2025 fallaba silenciosamente al arranque.

---

## 3. Pipeline fichas+embeddings + reembed — EN CURSO (Task 4)

El pipeline corre en background con `run-pipeline-chunks.sh` (driver LOCAL reanudable).

### Driver `run-pipeline-chunks.sh` — diseño

- **Lotes de 100 vía `--boletines` EXPLÍCITO** (consultados por psql), NO la auto-detección de pendientes.
  **Porqué:** `leerPendientes()` sin `--boletines` lee TODOS los pendientes en una query PostgREST (tope
  ~1000 filas) y resuelve el link del Senado por cada uno (re-fetch XML, rate-limit 2-3s) ANTES de que
  `--limite N` recorte. Con 3.583 pendientes, `--limite 100` resolvería ~1000 links (~50 min) para procesar
  100 → derroche masivo. El driver consulta los 100 boletines `pendiente` por psql y los pasa como
  `--boletines`: el CLI resuelve links SOLO para ese lote.
- **Loop hasta `pendiente`=0** (re-query psql entre lotes; cada boletín procesado sale de la cola).
- **Tope de seguridad `MAX_ITERS=45`** + **stall-detection** (mismo conteo 3× seguidas → `=== pipeline-chunks STALLED ===`).
- **`exit=1` del CLI es NORMAL, no señal de parada:** el CLI sale non-zero si CUALQUIER boletín erra, y casi
  todo lote de 100 contiene ≥1 RUT-bloqueado. El driver ignora el exit code y loopea sobre el CONTEO de
  pendientes (única señal de avance real).
- **Pasada `--reembed`** tras agotar la cola → recupera los 8 `v1` stale (title-only).
- **Marcador final:** `=== pipeline-chunks DONE ===` en `logs/pipeline.log`.

### Smoke test (3 pendientes, ruta `--boletines` real) — ✅ end-to-end verde

| Boletín | Resultado | Evidencia |
|---------|-----------|-----------|
| 10986-24 | `embebido`, idea_matriz presente | R2 texto → DeepSeek idea → Gemini embedding (768) |
| 11929-13 | `embebido`, idea_matriz presente | pipeline literal completo |
| 12712-24 | `error` | `assertNoRutInLlmInput` LOCKED disparó: "input contains a RUT; RUT must never be sent to an LLM" → estado='error' honesto, NO fabricó (T-63-08) |

`procesados=3 embebidos=2 degradados=0 errores=1`. Pacing confirmado: `HostRateLimiter` 2-3s/host aplica
a link-resolve + texto-fetch (2 fetches por boletín). RUT-bloqueado NO se reintenta (solo se leen 'pendiente').

**Techo honesto conocido (NO reintentar al LLM):** 8 RUT-bloqueados (permanente, `assertNoRutInLlmInput` LOCKED),
1 PDF escaneado, ~3-5 sin idea literal / schema-fail (reintento único). La lista definitiva por boletín/causa
va en la sección final tras que el pipeline termine (SUMMARY).

_Estado al 2026-07-10T18:55Z: driver lanzado, `pendientes iniciales: 3580`, ITER 1/45 en curso._

---

## 4. Cron acotado — ✅ VERIFICADO (Task 5, criterio 5)

Verificado leyendo el código (sin re-correr el cron):

- **`leyes-weekly.yml` usa `run-tramitacion-prod-cli.ts`** (2 referencias en el YAML) — entrypoint correcto,
  el MISMO que corrió el backfill histórico. No hay deriva de entrypoint (MEMORY gotcha "dos entrypoints CLI").
- **`DEFAULT_LIMITE = 80`** en `run-tramitacion-prod-cli.ts:48`; el YAML solo agrega `--limite` cuando el
  operador pasa un input manual (`workflow_dispatch`), así que el cron programado corre con el default 80.
  El cron NO re-backfilla el histórico — refresca solo un set acotado de novedades (agenda/recientes primero).
- **`run-enumerar-historico-cli.ts` (nuevo, de P02) NO está en NINGÚN YAML** (grep = 0 en los 9 workflows).
  El histórico fue one-shot LOCAL (`run-backfill-chunks.sh`), fuera del cron.
- **`fichas-backfill.yml` es dispatch-only** (`on: workflow_dispatch`, sin `schedule`) — no corre solo;
  es el escape-hatch manual para re-correr el pipeline en CI si hiciera falta, con inputs `limite`/`reembed`/`boletines`.

**Conclusión (criterio 5):** el corpus creció de 156→3.657 proyectos, pero el cron sigue acotado a --limite 80
sobre novedades; el histórico no se re-backfilla en cada corrida semanal.

---

_Sección 3 (counts finales de embeddings + techo honesto por boletín/causa) se completa en el SUMMARY cuando
`=== pipeline-chunks DONE ===` aparezca en `logs/pipeline.log`._
