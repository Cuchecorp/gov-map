# Sketch Manifest

## Design Direction
Rediseño cognitivo de las superficies ciudadanas (Phase 55 UXCOG). Corrección del operador (2026-07-07, rechazo del checkpoint T4 de F54): "información no organizada, difícil de leer, mucho texto muy genérico; énfasis UI y UX, usa estrategias visuales; que sea claro y uno pueda ir aumentando el detalle, viendo cruces; no tanta información; piensa de modo cognitivo". Arquitectura de 3 capas: (1) resumen VISUAL escaneable con atributos preatentivos, (2) detalle bajo demanda (progressive disclosure), (3) fuente/trazabilidad siempre presente pero sin competir por atención. Los cruces son el diferenciador → destino natural del drill-down. La estética NO cambia: crema + petróleo + civic Cámara/Senado (Phase 19, LOCKED) — cambia la ARQUITECTURA DE INFORMACIÓN.

## Reference Points
El propio sitio en PROD (https://observatorio-congreso.thevalis.workers.dev) como línea base a superar; evidencia del problema en `docs/demo/` (ficha parlamentario 28k px de listas crudas).

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | ficha-parlamentario-cognitiva | ¿Qué estructura capa-1 + disclosure hace legible la ficha sin perder datos? | **B: Informe con rail** (operador, 2026-07-07) | layout, ficha-parlamentario, progressive-disclosure |
| 002 | red-rediseno-visual | ¿Qué forma visual hace legible el ego-network de /red sin telaraña y con explicaciones detalladas? | **B: Diagrama seed → columna** (operador, 2026-07-13) | red, grafo, layout, anti-insinuacion |

## Decisión de dirección (cierra la exploración)

**Ganador: B "Informe con rail"** — rail izquierdo sticky con navegación local + conteos (scrollspy); cada sección siempre visible pero SOLO su capa-1 (números grandes mono + chart + botón "Ver detalle (N)" que expande inline); cruces con borde petróleo y chips sector·conteo. El operador eligió B y delegó el resto en autónomo ("continua autonomo desde ahi").

Las preguntas de los sketches 002 (compresión de tramitación del proyecto) y 003 (drill-down de cruce) se resuelven DENTRO del UI-SPEC de Phase 55 aplicando el patrón B: mismas reglas de capa-1/disclosure, stepper de etapas como capa-1 de tramitación, hitos repetitivos agrupados con conteo, evidencia de cruce como detalle inline.
