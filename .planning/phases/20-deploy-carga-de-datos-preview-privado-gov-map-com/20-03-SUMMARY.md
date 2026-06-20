---
phase: 20
plan: 03
subsystem: fichas-embeddings
tags: [deploy, embeddings, busqueda-semantica, gemini, pgvector, cloud]
requires:
  - "20-02 (proyecto poblado en cloud — fuente de los proyecto_ficha)"
  - "packages/fichas/src/pipeline-cli.ts (pipeline DeepSeek + Gemini 768)"
provides:
  - "proyecto_ficha: 74 filas (seedadas pendientes desde proyecto, luego embebidas)"
  - "proyecto_embedding: 74 vectores vector(768) en cloud → /buscar funcional"
affects:
  - "Habilita la búsqueda semántica (/buscar) del sitio desplegado (SC5)"
tech-stack:
  added: []
  patterns:
    - "Seed de proyecto_ficha pendientes vía psql (INSERT ... SELECT FROM proyecto ON CONFLICT DO NOTHING) — el pipeline solo procesa filas pendientes existentes"
    - "pipeline-cli ya apunta al cloud por env (SUPABASE_URL/API_URL + SUPABASE_SECRET_KEY) — no requiere override de destino (a diferencia de seed/tramitacion)"
key-files:
  created:
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/20-03-SUMMARY.md"
  modified: []
decisions:
  - "El vector(768) vive en proyecto_embedding (PK boletin), NO en proyecto_ficha — verify apunta a proyecto_embedding (fix del plan-checker)"
  - "Los 74 embeddings salieron 'degradados' (título+materia) porque los proyectos recientes (18300s) no traen texto fuente íntegro aún — degradación honesta; la búsqueda funciona sobre título+materia"
metrics:
  duration: "~3 min (74 fichas: extracción DeepSeek + embedding Gemini 768)"
  completed: "2026-06-20"
  tasks: 3
  files: 1
---

# Phase 20 Plan 03: Embeddings de búsqueda a la nube — Summary

`proyecto_embedding` quedó poblada con **74 vectores `vector(768)`** (Gemini `gemini-embedding-001`, dim 768 MRL) en el Supabase de la nube; `proyecto_ficha` tiene las 74 fichas en estado `embebido`. La búsqueda semántica `/buscar` ya tiene corpus vectorial real.

## What was built

- **Seed de pendientes (gate previo, fix del plan-checker).** El pipeline solo procesa `proyecto_ficha` con `estado='pendiente'`, y nada las crea — así que se sembraron desde `proyecto`: `INSERT INTO proyecto_ficha (boletin, estado, origen) SELECT boletin,'pendiente',origen FROM proyecto ON CONFLICT (boletin) DO NOTHING` → **74 pendientes**.
- **Pipeline LIVE al cloud.** `pnpm --filter @obs/fichas exec tsx src/pipeline-cli.ts --limite 80`. pipeline-cli lee `SUPABASE_URL/API_URL` + `SUPABASE_SECRET_KEY` del entorno (ya cloud), más `GEMINI_API_KEY`/`DEEPSEEK_API_KEY`. Resultado: `procesados=74 embebidos=74 dbLoaded=true errores=0`.
- **Verificación psql:** `proyecto_embedding=74`, `proyecto_ficha estado='embebido'=74`.

## Deviations / notes

- **74/74 degradados (título+materia).** Los proyectos recientes (rango 18300s) no exponen el texto íntegro de la idea matriz todavía, así que el pipeline embebió título+materia en vez del cuerpo completo — degradación honesta y esperada por el plan; la búsqueda semántica funciona igual. Cuando esos proyectos publiquen texto, un `--reembed` los re-embeddiza.

## Self-Check: PASSED

- [x] `proyecto_embedding` (cloud) > 0 (74) verificado con psql
- [x] `proyecto_ficha` pendientes sembradas antes del pipeline (74)
- [x] Corrida LIVE (no DRY-RUN), `dbLoaded=true`, idempotente
