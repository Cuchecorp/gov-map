# Deferred items — Phase 99

## 99-03 (CLI k-means)

- **`proyecto.materia` está NULL para las 3.659 filas en PROD** (verificado 2026-07-24: `count(*) where materia is not null` = 0). El pipeline de ingesta (@obs/tramitacion) NUNCA pobló la columna `materia` (existe en el schema 0008 L26 pero se ingiere null). Consecuencia: `labelCluster` devuelve honestamente `'(sin materia)'` para todos los clusters — es el comportamiento CORRECTO (jamás fabrica un label), pero los clusters no tienen etiqueta temática útil hasta que se pueble `materia`.
  - **NO es un bug de 99-03:** el join `proyecto_embedding → proyecto(materia)` funciona (shape verificado), el k-means es determinista, el label es factual. En cuanto `materia` se pueble, los labels pasan a ser materia real sin tocar este CLI.
  - **Fuera de alcance de 99-03:** poblar `materia` es trabajo del conector de ingesta (extraer la materia de la ficha del proyecto / taxonomía oficial). Candidato a un plan futuro o quick.
  - **Impacto en el panel (Phase 100):** los clusters agrupan por cercanía semántica (correcto) pero se muestran como `(sin materia)`; el panel debe tolerar ese label o Phase 100 gatea sobre poblar materia primero.
