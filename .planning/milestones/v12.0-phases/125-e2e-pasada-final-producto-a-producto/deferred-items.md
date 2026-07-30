# Deferred items — Phase 125

Hallazgos fuera del alcance del plan que los encontró. NO se arreglan aquí.

## 125-04 (gates)

- **`og:image` / `twitter:image` apuntan a `http://localhost:3000`** en el deploy `0ea5d97f`.
  Observado en el `<head>` de todas las rutas capturadas:
  `<meta property="og:image" content="http://localhost:3000/opengraph-image.png?...">`.
  Ajeno a los 5 gates y al alcance de 125-04 (cero fixes de código). Afecta previews en redes
  sociales, no la corrección de ningún gate. Requiere `metadataBase` en el layout.
