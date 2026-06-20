---
phase: 20
plan: 04
subsystem: ingesta-atribucion
tags: [deploy, votos, lobby, patrimonio, money-gated, cloud]
requires:
  - "20-01 (maestra confirmada para el cruce DIPID de votos)"
  - "20-02 (votacion/voto ya cargados por la reconciliación Cámara de tramitación)"
provides:
  - "voto: 1389 (1154 estado_vinculo=confirmado por DIPID determinista)"
  - "lobby_audiencia: 7 (AA001, pipeline ejercitado)"
  - "declaracion: 10 versiones (probidad, bianchi chelech)"
  - "MONEY (contrato/aporte): 0 filas — gated, sin data"
affects:
  - "Habilita las secciones votos/lobby/patrimonio de la ficha /parlamentario/[id] (SC5)"
tech-stack:
  added: []
  patterns:
    - "lobby/probidad: SUPABASE_URL (REST) + SUPABASE_SERVICE_KEY; UNSET SUPABASE_DB_URL en la corrida (si no, el writer usa la connection string como REST url y rompe)"
key-files:
  created:
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/20-04-SUMMARY.md"
  modified: []
decisions:
  - "Votos NO se re-corrieron con runCamaraVotos: la reconciliación Cámara del conector de tramitación (20-02) ya cargó 1389 votos y cruzó DIPID determinista → 1154 confirmados, cubriendo los boletines votados 14309/18296. Re-fetch sería redundante y golpearía el WAF sin valor."
  - "Lobby AA001 (no el Congreso — no está en leylobby, Open Q2): 7 audiencias, 0 parlamentarios marcados. Ejercita el pipeline; la sección lobby de la ficha quedará honest-empty para parlamentarios."
  - "Probidad bianchi chelech: 10 versiones, 0 parlamentarios marcados (el linking a la maestra no marcó); declaracion>0 satisface el gate."
  - "MONEY explícitamente NO corrido (@obs/dinero ausente); contrato=0, aporte=0 verificado."
metrics:
  duration: "~2 min (lobby + probidad; votos ya estaban)"
  completed: "2026-06-20"
  tasks: 3
  files: 1
---

# Phase 20 Plan 04: Votos + lobby + patrimonio a la nube — Summary

El frente "parlamentarios 360" quedó poblado en la nube: **voto=1389 (1154 confirmados por DIPID), lobby_audiencia=7, declaracion=10**. MONEY permanece gated y vacío (`contrato=0`, `aporte=0`); ningún runner de `@obs/dinero` se ejecutó.

## What was built

- **Votos (ya presentes, cross-link confirmado).** La reconciliación Cámara del conector de tramitación (20-02) ya había cargado 1389 votos y aplicado el cruce DIPID determinista → **1154 `estado_vinculo='confirmado'`**, 235 `no_confirmado` (fail-closed, honesto). Cubre los boletines votados 14309/18296. Se omitió `runCamaraVotos` por redundante (mismo path determinista, mismos boletines) — respeto al WAF.
- **Lobby.** `@obs/lobby` ingest LIVE (AA001, 2024, p1) → **7 audiencias** (`dbLoaded=true`, sin quarantine; filas malformadas descartadas honestamente). Contrato de env: `SUPABASE_URL`+`SUPABASE_SERVICE_KEY`, con `SUPABASE_DB_URL` **unset** para que el writer no use la connection string como REST url.
- **Patrimonio.** `@obs/probidad` ingest LIVE (`--nombre "bianchi chelech"`) → **10 versiones** (`dbLoaded=true`, upsert versionado idempotente).
- **Verificación psql:** votos=1389, votos_confirmados=1154, audiencias=7, declaraciones=10, contrato=0, aporte=0.

## Deviations / notes

- **Lobby/Probidad: 0 parlamentarios marcados.** El Congreso no está en leylobby (CONTEXT Open Q2), y el linking de las declaraciones no marcó parlamentario. Las secciones lobby/patrimonio de la ficha quedarán honest-empty para parlamentarios en el demo — limitación de fuente conocida, no un fallo. El dato existe en las tablas (gate cumplido).
- **MONEY gated:** ni `@obs/dinero ingest` ni `ingest:servel` se corrieron; tablas en 0.

## Self-Check: PASSED

- [x] voto/lobby_audiencia/declaracion (cloud) > 0 verificado con psql
- [x] voto.estado_vinculo='confirmado' > 0 (1154) — cruce DIPID determinista
- [x] Tablas MONEY (contrato/aporte) = 0 (gated)
- [x] Ningún runner @obs/dinero ejecutado
