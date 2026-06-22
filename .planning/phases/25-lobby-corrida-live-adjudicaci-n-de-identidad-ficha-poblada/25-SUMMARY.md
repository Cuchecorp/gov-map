---
phase: 25-lobby-corrida-live-adjudicaci-n-de-identidad-ficha-poblada
plan: 01
subsystem: lobby
tags: [lobby, camara, live, identidad, adjudicacion, deterministic, r2, supabase, net, ficha-poblada, waf]

# Dependency graph
requires:
  - phase: 24
    provides: "parser+conector camara (parseCamaraLobbyAudiencias, CamaraLobbyConnector)"
  - phase: 23
    provides: "esquema lobby + grafo aplicado al remoto"
  - phase: 11
    provides: "reconciliarSujeto + SupabaseLobbyWriter + guarda IDENT-12"
provides:
  - "5.106 audiencias de lobby CONFIRMADAS en prod (136/155 diputados) — fichas lobby pobladas (eran 0)"
  - "17.730 audiencias + 17.681 contrapartes en prod; crudo en R2 content-addressed"
  - "NET materializado: 136 nodos + 7.394 aristas co_lobby_contraparte (grafo ya NO vacío; sigue gated-OFF hasta F17)"
  - "extraer-sujeto-camara (extrae el diputado real de un asesor H.D./H.S.) + run-camara-lobby + CLI operador"
  - "reconciliarSujeto: opts camara + nombreParaCruce (backward-compatible)"
affects: [Phase 31 (sign-off F17 — el grafo ya tiene aristas), Phase 32 (verificación prod)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Match de identidad por TOKEN-SET COMPLETO (incl. materno) recomputando nombre_normalizado de la maestra SOLO para este cruce: más estricto que el materno-less, único en (cámara,periodo), fail-closed, SIN tocar el núcleo de identidad"
    - "WAF de www.camara.cl bloquea Node fetch (403, TLS/HTTP-fingerprint, cualquier header) pero permite curl → escape hatch --html-file: operador baja el crudo con curl y el runner corre Etapa 1 (R2) + Etapa 2 (parse→reconcile→write) desde él (alineado con LOCKED: Etapa 2 lee del crudo)"
    - "deterministic-only suficiente: 0 homónimos entre los 155 diputados actuales (0 colisiones de clave completa) → el LLM no aporta; no-match quedan no_confirmado honestos"
    - "El sujeto pasivo asesor cruza por el diputado extraído (H.D./H.S.); mención almacenada = RAW (trazabilidad); independientes vía nombreParaCruce"

key-files:
  created:
    - packages/lobby/src/extraer-sujeto-camara.ts
    - packages/lobby/src/extraer-sujeto-camara.test.ts
    - packages/lobby/src/run-camara-lobby.ts
    - packages/lobby/src/run-camara-lobby.test.ts
    - packages/lobby/src/run-camara-lobby-cli.ts
    - .planning/phases/25-lobby-corrida-live-adjudicaci-n-de-identidad-ficha-poblada/25-CONTEXT.md
    - .planning/phases/25-lobby-corrida-live-adjudicaci-n-de-identidad-ficha-poblada/25-SUMMARY.md
  modified:
    - packages/lobby/src/reconciliar-sujeto.ts
    - packages/lobby/src/index.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "ROOT CAUSE del lobby vacío histórico (parte 2, identidad): el cruce nunca casaba porque la maestra es materno-LESS (2 tokens) y el nombre de lobby es completo (3-4 tokens). Fix: clave de match = token-set completo (incl. materno) → 5.106 confirmadas, 0 ambiguas, 0 mis-link (clave completa única entre los 155)"
  - "deterministic-only: sin provider LLM. La guarda IDENT-12 solo confirma determinista de todos modos; sin homónimos actuales el LLM no cambia el resultado"
  - "WAF camara.cl: Node fetch 403 (curl 200) → --html-file con crudo bajado por curl; el conector real queda para fuentes sin WAF"
  - "12.631 no_confirmado (ex-diputados/variantes no en la maestra 2026-2030) se ESCRIBEN igual (honest-state, FK null → no aparecen en ninguna ficha; habilitan revisión futura) — mismo patrón que leylobby"
  - "NET: tras confirmar lobby se corrió grafo.materializar_aristas() → 136 nodos + 7.394 aristas; el grafo deja de estar vacío (sigue gated-OFF hasta F17)"

# Metrics
metrics:
  duration: ~75min
  completed: 2026-06-22
---

# Phase 25 Plan 01: LOBBY — Corrida LIVE + adjudicación de identidad + ficha poblada Summary

Las fichas de lobby pasaron de VACÍAS a 5.106 audiencias confirmadas en 136 diputados, cerrando
la doble causa raíz del lobby vacío (fuente, Phase 24 + identidad, esta fase) y desbloqueando el
grafo NET (136 nodos / 7.394 aristas).

## What was built / run

- **`extraer-sujeto-camara.ts`** — `extraerNombreSujetoCamara`: extrae el diputado real de un
  sujeto pasivo asesor ("X (Asesor(a) H.D. <Diputado>)" → "<Diputado>"); else raw.
- **`reconciliar-sujeto.ts`** — opts `camara?` (default "senado") y `nombreParaCruce?` (default =
  sujetoPasivoDe), backward-compatible: el nombre de CRUCE y la mención ALMACENADA (RAW) se desacoplan.
- **`run-camara-lobby.ts`** — orquestación: fetch → Etapa 1 R2 (best-effort) → parse → reconcile
  (camara="diputados", periodo="2026-2030", cruce por diputado extraído, **maestra de clave
  completa**) → writer idempotente. La maestra se recompone a token-set completo (incl. materno)
  para el match — el fix de la causa raíz de identidad.
- **`run-camara-lobby-cli.ts`** — runner de operador (env BOM-safe, seed, R2+Supabase reales,
  `--dry-run`, `--html-file` WAF-bypass).
- **Corrida LIVE a prod:** crudo en R2 (`camara-lobby/listadodeaudiencias/2026-06-22/<sha>.html`);
  17.730 audiencias + 17.681 contrapartes upsertadas; 136 diputados marcados confirmados.
- **NET:** `grafo.materializar_aristas()` → 136 nodos + 7.394 aristas `co_lobby_contraparte`.

## Verificación (remoto)

- `lobby_audiencia`: 17.737 total / **5.106 confirmadas** / 12.631 no_confirmado.
- 136 parlamentarios distintos con audiencias confirmadas; 17.681 contrapartes; 136 ingesta_estado.
- Fichas muestra: René García 338, Diego Schalper 229, Francesca Muñoz 192, Gael Yeomans 170, Pamela Jiles 159.
- `entidad`=136, `arista`=7.394 (co_lobby_contraparte).
- `pnpm --filter @obs/lobby test` → 43 passed; typecheck limpio.

## Deviations from Plan

- **Causa raíz de identidad descubierta y corregida** (match por token-set completo) — sin ella el
  confirm rate era 0 (la maestra materno-less nunca casaba el nombre completo del lobby).
- **WAF camara.cl** obligó al escape hatch `--html-file` (Node fetch 403, curl 200).

## Hand-off

- Phase 31 (F17): el grafo ya tiene aristas reales → encenderlo dependerá del sign-off legal humano.
- Phase 32: verificación en prod de la sección lobby poblada.
- Re-corridas: bajar crudo con curl → `tsx run-camara-lobby-cli.ts --html-file <ruta>` (idempotente).

## Self-Check: PASSED
