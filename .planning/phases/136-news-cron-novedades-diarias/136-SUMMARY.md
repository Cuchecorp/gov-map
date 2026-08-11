---
phase: 136-news-cron
subsystem: news-cron
tags: [cron, github-actions, degradacion-honesta, pii-rut, dead-letter]
dependency-graph:
  requires: [135]
  provides: [news-daily.yml, runbook backfill, pii_rut_en_texto, 0088, 0089+backfill]
  affects: [137, 138]
decisions:
  - "RUT en texto = rechazo permanente con causa propia (pii_rut_en_texto) y CERO llamadas LLM — jamás bloqueo de cola ni envio al proveedor. Hallado por la PRIMERA corrida real, no por diseño previo."
metrics:
  completed: "2026-08-11"
---

# Phase 136 — NEWS-CRON: las noticias llegan solas, con degradación honesta

## Corridas reales observadas (SC4)

- **Run 1 (31460485324):** ingesta VERDE (5 feeds, 245 vistos, 40 cargados — lunes fresco);
  clasificación ABORTÓ por el guard de RUT de @obs/llm en una noticia policial — el fix H2
  de 135 hizo el aborto honesto (nada descartado, ledger registró las 14 llamadas
  consumidas). Fix inmediato: chequeo PII previo por ítem → dead-letter
  `pii_rut_en_texto` sin llamada (migración 0088 aplicada, pgTAP 3/3).
- **Run 2 (post-fix): VERDE end-to-end.** Ingesta `descargados=0 skips=5` — **el hash-check
  y la salida temprana [skip] observados EN Actions** (SC1). Clasificación: procesadas=40,
  clasificadas=38, rechazadas=2 (1 pii_rut, 1 confianza_bajo_umbral), cap=false.
- Estado final PROD: **112 clasificadas / 2 descartadas / 0 pendientes**; ledger por corrida
  consultable (39, 14, 0…); dead-letter con 2 causas consultables.

## SC

1. Cron L-V acotado e idempotente (`news-daily.yml`, 20:30 UTC, concurrency sin
   cancel-in-progress, cap 500) + `[skip]` demostrado en Actions ✓
2. Degradación honesta EJERCITADA: sin `DEEPSEEK_API_KEY` el CLI sale **exit 0** con log
   LOUD y cero datos fabricados (`CredencialAusenteError`) ✓
3. Runbook backfill LOCAL (`docs/runbooks/news-backfill-local.md`) + fila en `docs/crons.md` ✓
4. Corrida real verde con conteos reportados ✓ (run 2)

## Extra (adelanto de 137)

0089 aplicada (columna `boletines_detectados` + GIN) + backfill one-shot (114 filas,
**0 con boletín textual** — hallazgo: la prensa RSS chilena no cita números de boletín en
titular/bajada; el carril determinista nace vacío y honesto) + detección cableada a cada
corrida diaria.
