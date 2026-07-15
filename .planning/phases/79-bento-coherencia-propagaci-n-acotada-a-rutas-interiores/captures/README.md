# Phase 79 — Evidencia visual BrowserOS antes/después

**Capturado:** 2026-07-15, por el orquestador (BrowserOS MCP, ventana ~1552px).

## Estructura

- `antes/` — dev local en commit `3094ef6` (pre-ejecución de 79). **Caveat:** la primera sesión de dev corrió SIN credenciales Supabase → las rutas de datos (/parlamentarios, fichas, /agenda) muestran el error state honesto; /buscar, /sobre, /metodologia y el chrome son representativos.
- `antes-prod/` — PROD pre-v8 (https://observatorio-congreso.thevalis.workers.dev, versión 6534fe9f) para las 4 rutas de datos con contenido real: parlamentarios, parlamentario-S1110, proyecto-14309-04, agenda. Referencia "antes" válida para container/radius (PROD no tiene nada de v8).
- `despues/` — dev local post-merge de 79-01/79-02/79-03 (HEAD 4e4842e) CON credenciales (.env raíz cargado) → datos reales.

## Qué verificar (criterio: solo cambia radio/contenedor)

| Ruta | Antes | Después | Delta esperado |
|------|-------|---------|----------------|
| /buscar | antes/buscar.png | despues/buscar.png | container 3xl→1120px; form igual |
| /parlamentarios | antes-prod/parlamentarios.png | despues/parlamentarios.png | container 5xl→1120px; rows radius 16px; datos idénticos (186) |
| /agenda | antes-prod/agenda.png | despues/agenda.png | container 3xl→1120px; li radius |
| /sobre | antes/sobre.png | despues/sobre.png | container only (prosa) |
| /metodologia | antes/metodologia.png | despues/metodologia.png | container only |
| /parlamentario/S1110 | antes-prod/parlamentario-S1110.png | despues/parlamentario-S1110.png | container 5xl→1120px; paneles exteriores; interiores byte-idénticos |
| /proyecto/14309-04 | antes-prod/proyecto-14309-04.png | despues/proyecto-14309-04.png | ídem + scroll-mt reconciliado (no visible en captura) |
| /red | antes/red.png | despues/red.png | SIN cambio (excluido, invariante 4) — verificación px final con getComputedStyle en deploy (Phase 81) |

## Observaciones del orquestador (lectura de pares)

- /parlamentarios después: 186 parlamentarios, container 1120px, rows con radio tile, header sticky — datos y copy idénticos a PROD.
- /parlamentario/S1110 después: rail izquierdo intacto, votaciones 491 con barra, breadcrumb, "fuente oficial ↗" — solo cambió el ancho del contenedor.
- /red: island .net-* sin cambio de ancho (max-w-3xl conservado, guard test dec92a3 lo fija).
- Gotcha operativo: save_screenshot tumba el CDP con ráfagas — pausas de 10-12s + retry tras probe a http://127.0.0.1:9200/mcp.
