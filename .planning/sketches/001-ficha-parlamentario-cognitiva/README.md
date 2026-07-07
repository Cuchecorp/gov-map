---
sketch: 001
name: ficha-parlamentario-cognitiva
question: "¿Qué estructura de capa-1 (resumen visual) + disclosure hace legible la ficha de parlamentario sin perder datos?"
winner: "B"
tags: [layout, ficha-parlamentario, progressive-disclosure, phase-55]
---

# Sketch 001: Ficha parlamentario cognitiva

## Design Question
La ficha actual apila 28.048px de listas crudas (141 votaciones + 107 reuniones completas). ¿Cómo comunica su resumen en el primer viewport y deja el detalle bajo demanda — con los cruces elevados como destino del drill-down?

## How to View
open .planning/sketches/001-ficha-parlamentario-cognitiva/index.html

## Variants
- **A: Panel de indicadores** — dashboard de 6 tarjetas KPI (asistencia, cómo votó, cruces destacados en petróleo, lobby top-materias, patrimonio, financiamiento) + secciones colapsadas (accordion) con resumen de 1 línea en el header.
- **B: Informe con rail** — rail izquierdo sticky con navegación local y conteos (scrollspy); cada sección siempre visible pero SOLO su capa-1 (números grandes + chart + botón "ver detalle" que expande inline).
- **C: Tabs drill-down** — strip de KPIs que ES la barra de tabs; una sección a la vez con filtro; la página nunca excede ~2 viewports.

## What to Look For
1. ¿Cuál te deja entender "quién es y qué hace" en <5 segundos sin scroll?
2. ¿El camino al detalle se siente natural ("ir aumentando el detalle")?
3. ¿Los cruces destacan como el lugar interesante (petróleo ◆)?
4. ¿Cuál escala mejor a móvil? (probar con el botón 📱 del toolbar)
5. Nada de datos se pierde: en las 3 variantes todo sigue accesible, cambia el DEFAULT.
