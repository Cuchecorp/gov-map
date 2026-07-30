# Phase 113: INV — Inventario rector de superficies - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador en PROMPT-v12.0)

<domain>
## Phase Boundary

Producir el artefacto rector único del milestone v12.0: un inventario exhaustivo de toda ruta pública del sitio (deploy https://observatorio-congreso.thevalis.workers.dev) que enumere, por ruta: (a) links internos que emite, (b) links externos clasificados por fuente (camara.cl, senado.cl, BCN, leylobby), (c) cada fecha visible con su columna/RPC de origen, marcando las que provienen de `fecha_captura`. Las rutas dinámicas se instancian con sujetos concretos reales elegidos por SQL determinista contra PROD. El inventario declara método y cobertura. Las fases 114/115/116/122/125 consumen este artefacto; su completitud la valida un Opus ANTES de avanzar. Esta fase NO arregla nada — solo inventaría.

</domain>

<decisions>
## Implementation Decisions

### Alcance de rutas
- Universo = las 15 rutas `app/app/**/page.tsx`: `/`, `/agenda`, `/buscar`, `/comparar`, `/contraparte/[id]`, `/cuenta`, `/metodologia`, `/notificaciones/baja`, `/notificaciones/confirmar`, `/parlamentario/[id]`, `/parlamentarios`, `/proyecto/[boletin]`, `/red`, `/sobre`, `/admin/revisar-entidades`
- `/admin/revisar-entidades` se LISTA como EXCLUIDA del inventario público con razón (gated/no pública); `/cuenta` y `/notificaciones/*` se incluyen marcando su naturaleza (auth/token-based)
- Route handlers / API no son superficies; solo se apendizan si emiten links visibles

### Método de enumeración
- Links por ruta: análisis de código exhaustivo del árbol de componentes de cada ruta (`<Link>`, `href`, `<a>`, construcción de URLs externas) — la verificación contra DOM real es trabajo de 114 (internos) y 125 (E2E), no de esta fase
- Fechas por ruta: rastreo de cada fecha renderizada hasta su columna/RPC de origen (formatters, props); las que provienen de `fecha_captura` quedan MARCADAS explícitamente
- Cobertura declarada en tabla método×ruta: qué se enumeró exhaustivo (código) vs por muestra (sujetos SQL); cero rutas "asumidas" sin evidencia

### Sujetos dinámicos por SQL
- Sujetos deterministas elegidos por SQL contra PROD (precedente 93-02): 2 parlamentarios (1 diputado + 1 senador con datos ricos — lobby/patrimonio/votos), 2 boletines (1 con votaciones+similares+cruces, 1 zona solo-Senado), 1 contraparte real
- Criterio: ORDER BY determinista + máxima riqueza de datos (más bloques visibles); query verbatim registrada en el inventario
- Queries read-only vía `set -a; source .env; set +a` + psql; JAMÁS imprimir la URL de conexión

### Artefacto
- Un solo archivo `113-INVENTARIO.md` en el dir de la fase: 1 sección por ruta con tablas (links internos / externos por fuente / fechas con origen), sección de método+cobertura, sección de sujetos SQL
- Validación de completitud por agente Opus ANTES de cerrar la fase (el inventario es rector de 114/115/116/122/125)

### Claude's Discretion
- Estructura exacta de las tablas y granularidad de componentes compartidos (header/footer/nav se inventarían una vez y se referencian)
- Cómo agrupar links repetidos entre rutas (deduplicación con referencia)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/app/**/page.tsx` — 15 rutas descubiertas por filesystem
- Precedente 93-02: sujetos deterministas por psql contra PROD
- `.env` con `SUPABASE_DB_URL` (pooler IPv4, ref bctyygbmqcvizyplktuw)

### Established Patterns
- Fases de auditoría previas (98 spike-findings, 116/122 consumirán este formato): documento por fase con evidencia archivo:línea
- Gotcha LOCKED: `fecha_captura` es reloj de scraping, jamás el hecho (Phase 98)
- PK bio `id=S1344` pero `parlid_senado=1344` numérico (gotcha 105-02)

### Integration Points
- 114 (links internos), 115 (patrones externos), 116 (fechas), 122 (cruces), 125 (E2E) leen `113-INVENTARIO.md`

</code_context>

<specifics>
## Specific Ideas

- Success criteria del ROADMAP: lector ve cada ruta sin leer código; links clasificados int/ext por fuente; fechas con columna/RPC de origen y marca `fecha_captura`; método y cobertura declarados
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev (último deploy v10.0 e89b79af)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
