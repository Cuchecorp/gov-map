---
plan: 57-05
phase: 57
status: complete
gap_closure: true
completed: 2026-07-09
---

# Plan 57-05 Summary — Gap closure: R2 wiring en el prod CLI de leyes + registro source_snapshot

## Qué pasó

La verificación de Phase 59 descubrió que el backfill de autores corrió contra la FUENTE (504s transitorios lo delataron) porque R2 no tenía envelopes de tramitación — pese a que Phase 57 declaró G23 cerrado. Causa raíz: **57-03 cableó Etapa-1/`--from-r2` en `ingest-cli.ts`, pero `leyes-weekly.yml` invoca `run-tramitacion-prod-cli.ts`** (otro entrypoint, sin R2). Además NINGÚN conector registraba `source_snapshot` (la señal R2 del freshness CLI era permanentemente "n/d").

## Fix (commits)

- `535e136` docs(57): gap plan 57-05
- `57aa688` fix(57-05): run-tramitacion-prod-cli propaga R2_* env → ingest-cli.main() construye R2Store (WARN loud si falta) + SnapshotWriter LIVE (espejo probidad-cli) + ingest-run registra `source_snapshot` con `source='leyes'` (match exacto con el catálogo de freshness) tras putImmutable exitoso, best-effort no fatal. Tests: 129/129 tramitación.
- `e009dbf` ops(57-05): R2 secrets en leyes-weekly.yml (env block).
- Ejecutor original murió por límite de sesión; el orquestador (Fable) completó push + dispatch + verificación.

## Evidencia LIVE (2026-07-09)

- Dispatch `leyes-weekly` run **29008906330** → `completed success` (21m54s).
- `SELECT source, count(*), max(fetched_at) FROM source_snapshot GROUP BY 1` → **leyes | 80 | 2026-07-09 06:01:02** (antes: 0 filas).
- `pnpm freshness`: fila leyes muestra R2 snapshot real (`2026-07-09 06:01`), ya no "n/d". Suite 726/726 + typecheck verdes.

## Deuda registrada (no bloqueante de v6)

- Los demás conectores aún no registran `source_snapshot` (solo leyes); patrón listo para copiar (1 colaborador + 1 llamada best-effort). → backlog.
- `probidad-weekly` mostró `failure @ 2026-07-09` (corrida previa al push de fixes o causa nueva) — re-observar en la próxima ventana programada.
- `lobby-leylobby` STALE 17d (dato, no pipeline): `ingestado_hasta` no avanza pese a corridas verdes — investigar si la fuente publica con rezago o si el incremental no avanza el cursor.
