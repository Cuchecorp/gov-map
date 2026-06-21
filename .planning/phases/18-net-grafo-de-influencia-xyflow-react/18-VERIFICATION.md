---
phase: 18-net-grafo-de-influencia-xyflow-react
status: passed
verified: 2026-06-21
method: pgTAP remoto (13/13) + vitest RTL (246/246) + e2e producción (gate cerrado)
gated: true
note: "Mecanismo NET completo y gated-OFF. Exposición pública pendiente de sign-off legal F17. Grafo vacío por deuda de datos (lobby no_confirmado)."
---

# Phase 18 — Verification: NET — Grafo de influencia (gated-OFF)

**Verdict: PASSED (mecanismo)** — el grafo NET está construido end-to-end, verificado y desplegado
**gated-OFF**. No se expone públicamente hasta el sign-off legal F17 (correcto por diseño).

## Goal-backward: 4 success criteria

| SC | Criterio | Evidencia | Estado |
|----|----------|-----------|--------|
| SC1 | Modelo entidad/arista vía pg_cron + RPC CTE recursiva; provenance + ventana por arista; ambos extremos confirmado | Migración 0030 aplicada al remoto; `grafo.materializar_aristas()` (cron `17 3 * * *`); `subgrafo_red` CTE recursiva; FK a entidad (poblada solo de confirmados) = invariante both-confirmado; pgTAP 13/13 | ✅ mecanismo |
| SC2 | Exploración vía @xyflow/react client island, filtros por tipo + tiempo, fuente por arista trazable | Isla `red-graph.tsx` (`'use client'`, dist/style.css); filtros tipo+ventana; tooltip provenance (origen+ventana+enlace); 246/246 vitest | ✅ mecanismo (gated-OFF) |
| SC3 | Sin aristas LLM; ningún camino como acusación; copy sobrio ES sin causal/score | Taxonomía allow-list `co_lobby_contraparte` (check constraint); `co_votacion` excluida+documentada; negative-match grep limpio en isla+ruta+migración | ✅ |
| SC4 | CC BY 4.0 (InfoProbidad) propagada en nodos/tooltips | `licencia` per-row sin default; tooltip propaga CC BY cuando presente; en el MVP las aristas co-lobby derivan de leylobby (licencia NULL) → mecanismo listo para aristas InfoProbidad-derivadas | ✅ mecanismo |

## Gates técnicos
- **PII / LEGAL-03:** `entidad`/`arista` deny-by-default (RLS enabled, cero policies, revoke a anon); `subgrafo_red` security definer pero PII-safe (proyecta solo id/nombre/cámara; pgTAP afirma sin partido/rut; depth clamp 1..2; seed obligatorio). Partido nunca a anon.
- **Anti-insinuación HARD:** una sola arista (hecho discreto de lobby); sin score/ranking/afinidad/cercanía/causal/path-as-feature; `co_votacion` excluida (hairball conspirativo). Negative-match grep limpio.
- **Doble candado:** Candado A (RLS) + Candado B (`NET_PUBLIC_ENABLED` server-only default false). `/red` → 404 en producción.
- **Build/deploy:** Linux/Docker + wrangler (version 8c8d0f0b); xyflow aislado a la isla client; 6 rutas existentes 200; tests 246/246; tsc limpio.

## Deuda registrada (no bloquea el mecanismo)
1. **Sign-off legal F17 PENDIENTE** (humano) — `NET_PUBLIC_ENABLED` no se enciende hasta `17-LEGAL-DOSSIER` `signoff: approved`. NET está gated-OFF por diseño.
2. **Grafo vacío por deuda de DATOS** — 0 aristas (7 audiencias lobby todas `no_confirmado`). El mecanismo es correcto; faltan datos de lobby confirmados (pipeline de identidad/cobertura, deuda separada). Honest-state en la UI.
3. **co_votacion diferida** — agregar otra arista exige nueva migración (fricción correcta, anti-insinuación).

## human_verification
Ninguno bloqueante — el cierre de operador (apply 0030, pgTAP, build, deploy, e2e gate-cerrado) lo
ejecutó el orquestador. El único pendiente humano real es el **sign-off legal F17** (fuera del alcance
construible de esta fase).
