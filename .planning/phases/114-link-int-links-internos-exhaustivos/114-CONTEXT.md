# Phase 114: LINK-INT — Links internos exhaustivos - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador en PROMPT-v12.0)

<domain>
## Phase Boundary

Verificar sobre el deploy real (https://observatorio-congreso.thevalis.workers.dev) que ningún link interno del sitio lleva a 404 ni a un ancla inexistente, usando como universo el inventario rector 113 (`.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md`, `estado: validado`). Corrida reproducible (script + salida guardada), fixes en código con evidencia antes/después. El deploy de los fixes NO ocurre en esta fase — viaja con la Phase 125 (decisión del prompt rector v12.0).

</domain>

<decisions>
## Implementation Decisions

### Método de verificación
- Script reproducible Node (`.mjs`) que solicita cada URL interna contra el deploy real y verifica anclas `#id` parseando el HTML servido (cheerio ya es dependencia del ecosistema del repo)
- Anclas que no aparezcan en el HTML SSR: fallback BrowserOS (MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`) — precedente v8.0: `section[id]`/scroll-margin solo lo cazó la inspección en deploy real
- Mesura contra el Worker propio: ejecución secuencial con delay 300-500ms entre requests (sin WAF propio, pero jamás ráfagas)
- Salida de la corrida GUARDADA como artefacto en el dir de la fase (antes y después de los fixes)

### Alcance
- Universo = links internos (Tabla A) de cada ruta del inventario 113 + chrome C-01..C-04 + not-found apendizados; rutas dinámicas instanciadas con los sujetos de §1 del inventario
- Emisores huérfanos E-003 (voto-ficha-row) y E-008 (actualidad-module) EXCLUIDOS — no se montan en ninguna ruta (evidencia 113)
- Rutas/links bajo gates OFF (MONEY, NOTIF): verificar AUSENCIA en el DOM (ausencia = pass); jamás encender flags
- `/cuenta` (auth) y `/notificaciones/*` (token): verificar según su naturaleza declarada en el inventario (respuesta no-404; contenido gated es esperado)
- `/contraparte/[id]` 404ea entera por gate MONEY (hallazgo 113) — verificar que NINGUNA superficie pública emite links hacia ella; su 404 no es defecto

### Fixes
- Todo link o ancla roto se corrige en el código de la app con evidencia antes/después (salida del script pre-fix y post-fix contra build local o razonamiento de código cuando el fix no sea observable sin deploy)
- Ancla rota: preferir corregir el emisor (href) salvo que el inventario muestre que el destino debía tener el id — criterio de intención, documentado por fix
- Deploy DIFERIDO a 125; la re-verificación final sobre deploy ocurre allí
- Suite + tsc + guards de régimen verdes tras cualquier fix

### Claude's Discretion
- Ubicación exacta del script (scripts/ reusable para 125 vs dir de fase) y formato de la salida guardada
- Cómo instanciar los sujetos en las URLs (leer §1 del inventario)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `113-INVENTARIO.md` — universo completo: Tablas A por ruta, chrome C-01..C-04, sujetos §1, gates §5
- `scripts/bros-cli.mjs` — wrapper BrowserOS (gotcha: screenshots en ráfaga tumban el MCP → sleep 8-10s; CDP timeout → reabrir página)
- `check-inventario.sh` (dir 113) — patrón de script de verificación con STRICT

### Established Patterns
- Evidencia reproducible: comando + salida guardada (precedente 93-02, 113)
- Baseline suite: 2.963 tests / 283 files (§0.5 del inventario)

### Integration Points
- Fixes de UI viajan al deploy con 125
- Hallazgos de anclas alimentan la re-verificación E2E de 125

</code_context>

<specifics>
## Specific Ideas

- Success criteria ROADMAP: cada link interno solicitado contra el deploy real → no-404; cada ancla `#id` existe en el DOM destino; todo roto corregido con evidencia; corrida reproducible
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev (deploy v10.0 e89b79af — el inventario ancló por fecha 2026-07-27 23:04 UTC, no hay hash en headers)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
