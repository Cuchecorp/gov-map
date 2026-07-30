---
phase: 120-escalera-on-flip-clasificacion-escalera
plan: 02
subsystem: llm-escalera
tags: [flip, workers-ai, granite, deepseek, rollback, guards, cron-03]
requires:
  - "120-01: GATES 2-4 VERDES — EL FLIP PROCEDE"
  - packages/cruces/src/clasificar-fichas-cli.ts
provides:
  - "CLASIFICACION_ESCALERA=1 activo en el .env del operador (escalera ON en clasificación)"
  - "120-FLIP-RECORD.md cerrado: Gates 1-6 + '## Estado final CRON-03'"
  - "Evidencia en vivo del ciclo ON→OFF→ON (rollback-by-config)"
affects:
  - Phase 121 (ESCALERA-DOC)
  - Phase 125 (E2E flags — CLASIFICACION_ESCALERA es ON esperado, no familia *_PUBLIC_ENABLED)
tech-stack:
  added: []
  patterns: ["flip por env var local", "humo acotado dry-run con llamadas LLM reales", "guards de alcance corridos POST-flip"]
key-files:
  created:
    - .planning/phases/120-escalera-on-flip-clasificacion-escalera/120-02-SUMMARY.md
  modified:
    - .planning/phases/120-escalera-on-flip-clasificacion-escalera/120-FLIP-RECORD.md
    - ".env (NO commiteado — config local del operador)"
decisions:
  - "Los guards de alcance se corrieron DESPUÉS del flip, con la escalera encendida, para que probaran el régimen real y no un estado pre-flip"
  - "La divergencia de reparto asignados/abstenidos entre la corrida ON (2/1) y OFF (1/2) se registró como no-hallazgo: muestra de 3, la paridad se juzga en el Gate 3 (8/8) y el veredicto full-40"
metrics:
  duration: "~5 min"
  completed: 2026-07-28
requirements: [CRON-03]
---

# Phase 120 Plan 02: Flip `CLASIFICACION_ESCALERA=1` Summary

La escalera Granite→DeepSeek quedó **encendida en clasificación** con red de seguridad demostrada:
el flip es una línea de `.env`, el humo en vivo probó `provider=tiered:granite→deepseek` con
`procesados=3`, el ciclo ON→OFF→ON se ejerció con logs reales, y los guards que congelan
adjudicación de identidad y extracción strict-schema siguen verdes **con la escalera ya encendida**.

## Qué se hizo

| Gate | Resultado | Evidencia |
|------|-----------|-----------|
| 5 — Flip + humo | **PASS** | `provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)`, `procesados=3 asignados=2 abstenidos=1`, exit 0; sin `fallback… (Pitfall 2)` |
| 5b — Rollback inverso | **PASS** | ON `tiered:granite` → OFF `deepseek (default incumbente)` → ON `tiered:granite`, los tres exit 0 |
| 6 — Guards y suite | **PASS** | guards `@obs/llm` 7/7 + env-example `app` 16/16; `@obs/cruces` 42 passed, `@obs/llm` 158 passed; `tsc -b` exit 0 |

`## Estado final CRON-03` → **ESCALERA ENCENDIDA EN CLASIFICACIÓN**.

## Decisiones y hallazgos

- **Precondición verificada primero:** el registro traía `GATES 2-4 VERDES — EL FLIP PROCEDE`, así
  que la rama de cierre honesto sin flip no aplicó.
- **Humo concluyente, no solo resuelto:** `SUPABASE_URL` y `SUPABASE_SECRET_KEY` estaban en `.env`,
  así que el `--dry-run` leyó `proyecto_ficha` de verdad y `procesados=3 > 0`. Si hubiera dado
  `procesados=0` el provider se habría resuelto sin ejercerse nunca y el humo no probaría nada.
- **Falso negativo del shell evitado:** cada corrida abrió con `unset CLASIFICACION_ESCALERA` antes
  del `source .env`. Sin eso, la var exportada por la corrida anterior sobreviviría y el rollback
  parecería fallar aunque `.env` ya no la tuviera.
- **Guards corridos POST-flip a propósito:** con la escalera encendida son una prueba del régimen
  real (la escalera no alcanza adjudicación ni extracción), no de un estado anterior.
- **No-hallazgo registrado como tal:** ON dio 2 asignados/1 abstenido y OFF 1/2 sobre 3 fichas. Es
  una muestra de 3 comparando dos modelos; la paridad se juzgó en el Gate 3 (`acuerdo=8/8`) y en el
  veredicto full-40 (Δ0.0000). Se documentó explícitamente para no leerlo como regresión.
- **Alcance operativo:** clasificación no corre en ningún cron de CI; el flip vive en el `.env`
  local. Esta fase NO creó cron ni GH secret.

## Deviations from Plan

**1. [Rule 3 - Blocking] El verificador automático mordía la prosa del propio registro**

- **Found during:** Task 1
- **Issue:** el verify del plan falla si el registro contiene el literal `SUPABASE_URL ausente`. Mi
  redacción citaba esa cadena justamente para decir que NO había aparecido en la salida → falso
  positivo de "humo sin lectura DB".
- **Fix:** reformulé la frase en prosa ("la advertencia de URL de Supabase faltante") sin cambiar el
  hecho documentado. Cero cambio en el verificador y cero relajación del criterio.
- **Files modified:** `120-FLIP-RECORD.md`
- **Commit:** 8107500

## Secretos

Cero valores de secreto en el registro. El flip es un nombre de variable y el literal `1`, no un
secreto. `.env` nunca se volcó a consola ni se commiteó; `.env.example` sin diff. Gate anti-secreto
(regex `sk-…`/`sb_secret_…`/`eyJ…`) == 0 sobre el registro completo. El match de una regex ancha
inicial (`[A-Za-z0-9_-]{40,}`) resultó ser el nombre del directorio de fase, no un secreto.

## Known Stubs

Ninguno.

## Self-Check: PASSED

- `.planning/phases/120-escalera-on-flip-clasificacion-escalera/120-FLIP-RECORD.md` — FOUND
- `grep -c "^CLASIFICACION_ESCALERA=1" .env` == 1 — FOUND
- Commits 8107500, 827ac8f, 700b68d — FOUND
