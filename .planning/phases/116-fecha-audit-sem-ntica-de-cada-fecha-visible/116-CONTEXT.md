# Phase 116: FECHA-AUDIT — Semántica de cada fecha visible - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva de la corrida v12.0)

<domain>
## Phase Boundary

Auditoría de SOLO LECTURA: para cada fecha que el sitio muestra (universo = inventario 113,
emisores E-001..E-060 con su columna "fechas que muestra"), emitir veredicto explícito
**hecho / captura / ambigua** con la columna/RPC de origen citada y archivo:línea.
Cruzar el veredicto contra el dato real en PROD (un sujeto concreto por superficie).
Esta fase NO corrige nada — todo fix de copy/formateo va a Phase 117.

</domain>

<decisions>
## Implementation Decisions

### Universo auditado
- Universo = TODAS las fechas del inventario 113 (§5 emisores E-001..E-060), incluyendo:
  - Emisores HUÉRFANOS (E-003 voto-ficha-row, E-008 actualidad-module): se auditan en código y se marca su condición de huérfano (no visible en deploy) — el veredicto vale si alguien los re-monta.
  - Emisores bajo gate MONEY (E-013..E-016): se auditan en código aunque "no emitido en el deploy auditado" — el inventario lo exige explícitamente ("116 sí debe saber que existe copy de fecha bajo gate que hoy no se ve"). El cruce PROD para gated se hace vía SQL directo (el DOM no los muestra), sin tocar flags.
- El chokepoint DUAL `ProvenanceBadge` (§3.1 del inventario) se audita UNA vez como componente compartido + verificación de que cada consumidor le pasa el campo correcto (`fecha_captura` vs fecha del hecho).

### Veredicto y formato del artefacto
- Artefacto único: `116-FECHAS-AUDIT.md` en el phase dir — tabla por emisor×fecha con: id emisor, archivo:línea, formatter, columna/RPC de origen, veredicto (hecho/captura/ambigua), etiqueta visible actual, ¿miente o ambigua? (hallazgo), evidencia PROD.
- Veredicto tri-estado LOCKED: **hecho** (fecha del acontecimiento según fuente), **captura** (reloj de scraping — `fecha_captura` o derivados), **ambigua** (el usuario no puede distinguir cuál es).
- Sección separada de HALLAZGOS numerados (F-01, F-02…) consumible por Phase 117: cada hallazgo con archivo:línea, superficie, qué dice hoy, por qué está mal, fix sugerido. "Sin hallazgos" también se declara por emisor (cobertura completa, cero excepciones silenciosas).

### Cruce contra PROD
- Un sujeto concreto por superficie, elegido determinista por SQL (precedente 93-02/113: psql read-only, `set -a; source .env; set +a`, JAMÁS imprimir la URL de conexión).
- Reutilizar los sujetos ya elegidos por el inventario 113 donde existan (misma evidencia, comparabilidad); solo elegir sujeto nuevo si 113 no fijó uno para esa superficie.
- Higiene de fechas (Pitfall 8 del inventario): PROD tiene fechas corruptas futuras (p.ej. `2626-05-25`) — filtrar `fecha <= current_date` en las consultas de verificación; si una fecha corrupta ES visible en el sitio, eso es hallazgo para 117.
- El cruce compara: valor en DB → lo que el formatter renderizaría → lo que la etiqueta afirma. Para superficies live (no gated), verificación contra el deploy real (fetch/curl del HTML SSR) cuando sea barato; el mínimo obligatorio es DB→código.

### Reglas LOCKED que gobiernan el veredicto
- `fecha_captura` es reloj de scraping y JAMÁS representa el hecho (Phase 98 "fecha_captura mentirosa"). Toda presentación de `fecha_captura` sin el idiom "según fuente al…" (o equivalente aprobado) = hallazgo.
- "captura" pelado en copy visible = PROHIBIDO (decisión v10.0) = hallazgo.
- `citacion.fecha` (y date-only análogas del Congreso) = medianoche UTC; la parte fecha UTC ES el día chileno — cualquier conversión de zona horaria sobre date-only = hallazgo (gotcha mayor v9.0 pasada 2). Verificar `diaCalendarioCitacion` y todo formatter que toque date-only.
- `Intl.DateTimeFormat` con timeZone implícita del runtime sobre timestamps reales (no date-only) se evalúa caso a caso: veredicto ambiguo solo si el render puede cambiar el día visible.

### Claude's Discretion
- Estructura interna exacta de la tabla del artefacto y agrupación (por ruta o por emisor) — mantener ids E-xxx del inventario como clave.
- Cuántas superficies verificar contra el deploy real además del mínimo DB→código (con mesura, Worker propio sin WAF).
- Herramientas del audit (grep/scripts ad-hoc en el phase dir estilo `check-inventario.sh` de 113).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `113-INVENTARIO.md` §5 — mapa exhaustivo emisor×fecha con origen ya citado (28 archivos formatean fechas; ids E-001..E-060). ES el universo; no re-descubrir.
- `113-INVENTARIO.md` §3.1 — `ProvenanceBadge` chokepoint dual de `fecha_captura` (`capturedAt` → `relativeTimeEs` + `esStale`).
- Formatters centrales: `fechaCorta`, `fechaCortaSegura`, `relativeTimeEs`, `diaCalendarioCitacion`, `Intl.DateTimeFormat("es-CL")` (grep del inventario, `app/lib`).
- Sujetos deterministas y SQL de 113 (p.ej. boletín 17870-05, `max(fecha)` con filtro `<= current_date`).
- `check-inventario.sh` (113) como patrón de corrida reproducible.

### Established Patterns
- Auditoría con evidencia archivo:línea + veredicto por ítem (precedente 113, 115-PATRONES.md).
- psql read-only contra PROD con .env sourced, PGCLIENTENCODING=UTF8 para tildes.
- Linter anti-insinuación y guards de régimen corren en suite — 116 no toca copy, pero los hallazgos deben anticipar el vocabulario que 117 usará ("según fuente al…").

### Integration Points
- Salida consumida por Phase 117 (FECHA-FIX): hallazgos numerados con fix sugerido.
- Phase 125 (E2E) re-verifica fechas sobre el deploy final usando este audit + inventario 113.

</code_context>

<specifics>
## Specific Ideas

- Success criteria del ROADMAP son el contrato: (1) veredicto por fecha del inventario con origen citado; (2) lista completa de ocurrencias `fecha_captura`-como-hecho con archivo:línea y superficie; (3) date-only verificadas contra el gotcha tz; (4) cruce contra dato real PROD (un sujeto por superficie).
- Requirement: FECHA-01.

</specifics>

<deferred>
## Deferred Ideas

- Correcciones de copy/formateo → Phase 117 (FECHA-FIX).
- Re-verificación sobre deploy final → Phase 125 (E2E).

</deferred>
