---
phase: 20
plan: 02
subsystem: ingesta-tramitacion
tags: [deploy, ingesta, tramitacion, proyectos, votaciones, cloud]
requires:
  - "20-01 (maestra confirmada en cloud para el cruce de votos)"
  - "packages/tramitacion/src/ingest-cli.ts (conector Senado+Cámara)"
provides:
  - "proyecto (cloud): 74 filas reales (Leg-58, boletines 14309/18296 + rango 18300-18375)"
  - "tramitacion_evento: 316 eventos (timelines)"
  - "votacion: 10 + voto: 1389 (de los boletines votados 14309/18296)"
affects:
  - "Desbloquea 20-03 (embeddings sobre proyecto) y 20-04 (votos enriquecen votacion)"
tech-stack:
  added: []
  patterns:
    - "ingest-cli a la nube vía pnpm exec (evita el `--` que el CLI rechaza) + SUPABASE_LOCAL_URL=<cloud> + SUPABASE_LOCAL_SERVICE_KEY=<secret> por env"
    - "Boletines explícitos por base-number (el conector hace baseDe(), fetchea por base y toma el boletín real de la respuesta del WS)"
key-files:
  created:
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/20-02-SUMMARY.md"
  modified: []
decisions:
  - "El descubrimiento por sesiones (camara.descubrirBoletines, getSesiones) devuelve 0 LIVE en leg 56/57/58 → el WS no enumera por año/sesión actualmente. Workaround: boletines explícitos."
  - "Corpus = boletines validados (14309, 18296, votados) + rango reciente denso 18300-18375 (Leg-58, 2025) → 74 proyectos reales para que /buscar tenga corpus semántico"
  - "GOTCHA: ingest-run aplica slice(0, --limite) incluso a boletines explícitos (default 5) → hay que pasar --limite >= nº de boletines"
metrics:
  duration: "~12 min (3 corridas, rate-limit 2-3s)"
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 20 Plan 02: Ingesta de tramitación a la nube — Summary

`proyecto`, `votacion`, `tramitacion_evento` y `voto` del Supabase de la NUBE quedaron poblados con tramitación real de la legislatura vigente: **74 proyectos, 10 votaciones, 316 eventos de tramitación, 1389 votos individuales**, todo LIVE (`dbLoaded=true`), idempotente y con rate-limit 2-3s.

## What was built

- **ingest-cli apuntado a la nube.** Igual que seed-cli, el destino sale de `SUPABASE_LOCAL_URL`/`SUPABASE_LOCAL_SERVICE_KEY` (overridados al cloud). Se invocó por `pnpm --filter @obs/tramitacion exec tsx src/ingest-cli.ts` (la forma `pnpm run ingest -- ...` inserta un `--` literal que el CLI rechaza con "flag desconocido").
- **Corpus por boletines explícitos.** El descubrimiento por sesiones del WS de la Cámara devuelve 0 boletines LIVE hoy (probado leg 56/57/58). Se pasó una lista explícita: los validados con votos (14309, 18296) + el rango reciente y denso 18300-18375.
- **Verificación psql (cloud):** `proyecto=74`, `votacion=10`, `tramitacion_evento=316`, `voto=1389`.

## Deviations / notes

- **Errores aislados (3), no fatales** — corrida final exit 1 por: un `502 retryable` del WS Senado en 18316 (transitorio), y un bug pre-existente del conector en 18333 (`ON CONFLICT DO UPDATE command cannot affect row a second time` al upsert de `tramitacion_evento` con clave duplicada dentro del mismo boletín). 70 proyectos cargaron igual; coincide con el criterio del plan ("exit 1 por errores de boletines aislados con la mayoría cargada"). Re-correr es idempotente.
- **Votaciones=10 / votos=1389** provienen de 14309 y 18296 (boletines votados); los del rango 18300s son muy recientes y aún sin votaciones — esperado. Los votos se reverifican en 20-04.
- **Deuda anotada:** (a) discovery por sesiones roto en el WS Cámara; (b) bug ON-CONFLICT de eventos duplicados intra-boletín en el writer de tramitación. Ninguno bloquea el deploy; candidatos a follow-up.

## Self-Check: PASSED

- [x] `proyecto` (cloud) > 0 (74) verificado con psql
- [x] `tramitacion_evento` > 0 (316)
- [x] Corrida LIVE (no dry-run), idempotente, rate-limit respetado
