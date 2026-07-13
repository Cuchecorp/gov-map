# HANDOFF — /red sigue viéndose apiñado (rediseño visual + explicaciones detalladas)

**Fecha:** 2026-07-13 · **Origen:** feedback del operador post-v6.1 ("sigue viéndose apiñado; quiero una solución más visual y explicaciones más detalladas")

## Estado actual (verificado)

- **SÍ está en producción**: deploy `af1cfcaf` sirve la versión radial (leyenda "orden alfabético, no cercanía" + "Ver N vecinos más" confirmados vía curl 2026-07-13). El problema NO es deploy/caché.
- Lo que ve el usuario con `?seed=D1009`: seed al centro + **24 vecinos** en anillo(s) + **24 aristas convergiendo al centro** + labels 14px. A viewport típico eso sigue leyéndose denso/telaraña.
- Deuda ya flagged que explica esto (nadie la atacó — era P2/advisory):
  - **P2 de la lectura fría 62-03**: densidad del anillo a 772px de captura.
  - **UI-REVIEW 62 (21/24)**: `perRing=12` a `RING1_R=260px` está EXACTAMENTE en el techo de solapamiento del propio spec (~10-12 por anillo); recomendó RING1_R≈300 o perRing=10. Además IN-04: el anillo 2 arranca en el mismo ángulo que el 1 (nodo 13 se esconde tras nodo 1). Typography del island `.net-*` fuera de contrato (nombre 15px, banda 13px, font-medium) — nunca se corrigió.
  - **WR-06 diferido**: xyflow monta bajo `display:none` en móvil.

## Código relevante

- `app/components/red/red-graph.tsx` — `radialPos()` (trig pura), `CAP = 24`, `RING1_R=260/RING2_R=460`, `perRing=12`, memo `seedNeighbors` (alfabético es-locale), overflow `.net-vecinos-mas`, lista móvil `.net-vecinos`.
- `app/components/red/nodo-parlamentario.tsx` — nodo (borde cámara `--camara/senado-muted-foreground`, seed 2px `--foreground`).
- `app/components/red/arista-hecho.tsx` (o equivalente) — arista con hecho tipado + procedencia en DOM.
- `app/app/globals.css` — island `.net-*` (≈300 líneas, 2 media queries; cuidado: cascade vs Tailwind ya mordió 2 veces — usar `@media (min-width:48rem)` en rem y considerar `@layer components`).
- `app/app/red/page.tsx` — NO TOCAR salvo necesidad: `force-dynamic` load-bearing, gate `netPublicEnabled` primero, `PARLAMENTARIO_ID_RE`, RPC `subgrafo_red(p_id, p_depth:1)` (los ~93-136 vecinos son 1-hop GENUINOS, no un bug de profundidad).
- Tests: `red-graph.test.tsx` (37 tests, mock xyflow `vi.mock("@xyflow/react")`; jsdom NO evalúa cascada CSS — el gate visual real es BrowserOS sobre deploy).
- Evidencia previa: `.planning/milestones/v6.1-phases/62-red-grafo-de-relaciones-entendible/red-evidence/` (capturas antes/después + VEREDICTO.md).

## Invariantes LOCKED (no negociables)

1. **F18**: NUNCA force-simulation; la posición JAMÁS implica afinidad/cercanía (orden neutro = alfabético). Determinista.
2. Anti-insinuación: petróleo solo aristas/links/focus (nunca relleno de nodo), sin colores de partido, procedencia (fuente+fecha+enlace) siempre en DOM, estados vacíos honestos, vocabulario prohibido en leyenda/copy.
3. Cero DDL, cero flags (`NET_PUBLIC_ENABLED` no se toca), RPC intacta.
4. Gate de cierre: lectura fría BrowserOS (desktop + 390px, con y sin seed) sobre deploy real + re-captura post-fix. Deploy runbook 61-02 (Docker node:22-slim + robocopy C:/Temp + wrangler OAuth + MSYS_NO_PATHCONV).

## Direcciones candidatas (a evaluar en la sesión fresca — el operador pide "más visual" y "explicaciones más detalladas")

- **Bajar densidad de golpe**: cap 24→10-12 con "Ver más" expandible por página; o radios mayores + `perRing` 8-10 + offset angular del anillo 2 (fix IN-04).
- **Nodos-tarjeta en vez de puntos**: cards legibles (nombre + cámara + nº de hechos) tipo lista radial o layout de columnas (seed a la izquierda → vecinos en grilla/columna derecha con conectores curvos) — más "diagrama explicable" que "grafo".
- **Aristas**: curvas con fan-out (no todas al mismo punto), agregación por par ("N hechos en común" ya contemplada en UI-SPEC 62), hover/tap para destacar una arista y atenuar el resto (sin implicar afinidad).
- **Explicaciones más detalladas**: panel lateral/inferior al seleccionar vecino (qué hechos comparten, fechas, fuentes, links), leyenda expandida paso-a-paso, microcopy sobre qué ES una relación (hecho público tipado, no cercanía política).
- Herramienta disponible: `/gsd:sketch` para mockups HTML desechables ANTES de tocar el componente (el operador quiere elegir visualmente).

## Vehículo sugerido

Milestone v6.1 está CERRADO y archivado (REQUIREMENTS.md borrado). Esto es trabajo nuevo: o `/gsd:quick` (si se ataca como iteración acotada de UI) o fase 1 de un `/gsd:new-milestone` de pulido visual. Recomendado: **sketch primero** (2-3 propuestas visuales), el operador elige, luego quick/fase con el loop BrowserOS.
