---
phase: 100-panel-p1c-landing-panel
plan: 04
status: complete
requirements: [PANEL-03, PANEL-04]
deploy_version: f9ad3364-6b03-42f1-9d81-d455ef6acc9d
key_files:
  created:
    - .planning/phases/100-panel-p1c-landing-panel/100-BENCHMARK.md
    - .planning/phases/100-panel-p1c-landing-panel/100-BROWSEROS-GATE.md
  modified: []
---

# 100-04 SUMMARY — Benchmark + deploy real + gate BrowserOS

**Cerrado por el orquestador** (tiene MCP BrowserOS + Docker/wrangler), no delegado a subagente: el gate interactivo y el deploy son acto del orquestador per el contrato de la corrida.

## PANEL-03 — Benchmark senado.cl / camara.cl
`100-BENCHMARK.md`: capturas BrowserOS de ambas portadas + crítica. Hallazgo unánime: **editorial + navegación por listas de enlaces, cero "qué pasó hoy" cuantitativo**. senado.cl = hero foto + "Noticias"; camara.cl = "Destacados" foto + columna de enlaces (Comisiones/Sala/Votaciones). Tabla EVITAR/SUPERAR: el panel supera con señales cuantitativas trazables legibles de un vistazo.

## PANEL-04 — Gate lectura fría sobre el deploy real: PASSED
`100-BROWSEROS-GATE.md`. Deploy `f9ad3364` (OpenNext Docker → wrangler global). Verificado en vivo sobre https://observatorio-congreso.thevalis.workers.dev:
- **Comprensible:** panel responde "qué pasó / cuándo / según qué fuente" — velocity por cámara (5 sin-cámara / 79 C.Diputados / 86 Senado, SIN ranking), urgencias 104 fechadas, agenda 7 citaciones próximas, archivados 2 — cada tile con "Fuente: … · datos al [fecha]".
- **Ausencia ≠ hecho:** agenda_sala y nuevos_ingresos renderizan su CAUSA de supresión, nunca lista vacía / 0 mudo.
- **Candados por getComputedStyle:** `unresolvedVars: 0`; colores resueltos de tokens hsl() (petróleo rgb(41,89,91), crema, cámara rgb(6,88,188), senado rgb(160,34,44)); Tailwind v4 [var(--t)] intacto; hero + chips byte-idénticos (Contract 1/2).
- **CSP intacta** (frame-ancestors/object-src 'none', connect-src no ampliado); URL/anchors/force-dynamic preservados.

## Deploy — gotchas pagados
- Mirror `C:/Temp/obs-build` inflado por `.pnpm-store` (847MB) → tar sobre bind-mount Windows→contenedor colgaba (11 min sin avanzar). Fix: purgar `.pnpm-store`+`.planning` del mirror (900MB→78MB); el contenedor hace install fresco.
- `MSYS_NO_PATHCONV=1` obligatorio en `docker run`/`docker cp` (Git Bash mangleaba `/host/...`).

## Self-Check: PASSED
Ambos criterios empíricos (#3 benchmark, #4 gate) cerrados con evidencia sobre el deploy real. No flag flip, no CSP widening.
