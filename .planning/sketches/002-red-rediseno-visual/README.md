---
sketch: 002
name: red-rediseno-visual
question: "¿Qué forma visual hace legible el ego-network de /red sin telaraña y con explicaciones detalladas?"
winner: "B"
tags: [red, grafo, layout, progressive-disclosure, anti-insinuacion]
---

# Sketch 002: /red rediseño visual

## Design Question

La versión radial en PROD (seed + 24 vecinos en anillos 260/460px + 24 aristas con etiqueta completa convergiendo al centro) sigue leyéndose apiñada. El operador pide una solución MÁS VISUAL con EXPLICACIONES MÁS DETALLADAS — no otro ajuste de parámetros. ¿Cuál de estas tres arquitecturas visuales resuelve densidad + comprensión?

## How to View

open .planning/sketches/002-red-rediseno-visual/index.html

Toolbar abajo-derecha: botones 390 / 768 / Full para probar la variante móvil.

## Variants

- **A: Fichas paginadas** — abandona el dibujo de grafo: seed arriba + grilla de tarjetas legibles (8 por página, orden alfabético), cada tarjeta expande inline sus hechos con procedencia completa. Cero líneas → cero telaraña.
- **B: Diagrama seed → columna** — seed fijo a la izquierda, vecinos en columna a la derecha (10 por página); conectores curvos fan-out (parten repartidos del borde del seed, NO convergen a un punto); clic destaca la línea y expande el detalle inline.
- **C: Radial liviano + panel** — conserva el radial pero descargado: 10 vecinos máx en un solo anillo holgado, nodos-tarjeta (no puntos), SIN etiquetas sobre las aristas; el detalle completo (hechos + fechas + fuentes) vive en un panel lateral que se abre al pulsar un vecino. Resto de vecinos en lista honesta debajo.

## Invariantes respetados en las tres

- Posición/orden = alfabético declarado, determinista, nunca force-simulation (F18).
- Petróleo SOLO en conectores/links/focus; nodos con borde civic por cámara (azul Cámara / rojo Senado), nunca relleno ni color de partido.
- Procedencia (fuente + periodo + registro + enlace) siempre en el DOM del detalle.
- Overflow honesto: ningún vecino se descarta en silencio; conteos verdaderos.
- Copy de hechos calcado del componente real (`etiquetaHecho` / `ventanaTexto`).

## What to Look For

- ¿Cuál se siente menos apiñada a primera vista con 24 vecinos reales?
- ¿Dónde se entienden mejor las explicaciones: inline bajo cada tarjeta (A/B) o en panel dedicado (C)?
- ¿Cuánto "grafo" hace falta conservar para que siga sintiéndose una RED y no un listado?
- Variante 390px: A y B degradan a lista/columna; C reemplaza el dibujo por lista con detalle inline.
- La leyenda "Cómo leer" paso a paso: ¿abierta por defecto (A/B) o colapsada (C)?
