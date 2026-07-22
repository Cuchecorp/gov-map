# Phase 93: AGENDA P2d — AUDITORÍA de cobertura de citaciones (GATE duro de 94) - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommendations auto-accepted per run directive)

<domain>
## Phase Boundary

Medir qué se scrapea hoy vs qué publica cada fuente ANTES de tocar UI (LOCKED) — un calendario parcial mostrado como completo engaña a la prensa. La auditoría es DISCOVERY con medición, no supuestos. Gatea 94. Requirement: CIT-01.

INCLUYE (reporte del operador 2026-07-22, registrado en STATE): el wiring FRONTEND de citaciones (sala y comisiones) y tablas de sesión está mal — la auditoría debe medir también qué muestran /agenda y la ficha del proyecto vs qué hay en DB, iterando con BrowserOS sobre PROD. Los FIXES de UI van en 94; aquí se DECLARA la brecha con evidencia.

Esta fase NO toca UI (regla LOCKED "antes de tocar UI").

</domain>

<decisions>
## Implementation Decisions

### Matriz de auditoría (medir, no asumir)
- Celdas: {sala, comisiones} × {Cámara, Senado}. Por celda: qué publica la fuente (universo M, medido en vivo curl-first), qué hay en DB (N, medido por psql), N/M declarado con fechas de rango.
- Estado DB HOY (medido 2026-07-22): citacion=138, citacion_punto con boletín=133, sesion_tabla_item=46 — thin; el universo real por fuente se mide en esta fase.
- Hallazgos previos a CONFIRMAR o refutar con medición: (a) Senado comisiones forward-only (sin histórico); (b) Cámara sala thin (PDF→DeepSeek, 1 sesión/19 ítems según memoria v6); (c) comisiones unidas/especiales presentes o ausentes en cada fuente.
- Wiring frontend: medir con BrowserOS sobre PROD qué renderizan /agenda y la ficha del proyecto (secciones estado/tramitación) vs los counts de DB; declarar los gaps concretos (p.ej. "citaciones de comisión del Senado no aparecen en /agenda", "tabla de sala no enlaza boletines") con evidencia DOM.

### Endpoints candidatos (curl-first, WAF, rate-limit 2-3s, UA identificatorio)
- Senado PHP clásico: `https://www.senado.cl/...?mo=comisiones&ac=citacionesComision` (SIN buildId — más estable que el portal Next.js; descubrir la URL exacta en vivo).
- Cámara: `citaciones_semana.aspx?prmSemana=AAAA-NN` (ViewState two-step si POST) + `getComisiones_Vigentes` (opendata — puede seguir en mantención, medir).
- Senado portal Next.js `__NEXT_DATA__` como fallback documentado (buildId volátil — jamás hardcodear).
- Cada endpoint: veredicto UP/DOWN/parcial con evidencia (HTTP code + muestra recortada), y si trae histórico o solo forward.

### Backfill (dos-etapas LOCKED)
- Lo faltante identificado se ingiere por dos-etapas fuente→R2→Supabase con `--from-r2` replay; hash-check antes de descargar; NUNCA ráfagas.
- Corrida ACOTADA por el agente (p.ej. semanas del rango reciente/vigente, pocas decenas de requests, 2-3s); backfill masivo histórico = runbook operador-LOCAL (espejo 66/67/70).
- Reusar conectores existentes (packages/agenda, parse-camara-sesion, tabla Senado, DeepSeek tabla Cámara) — extender solo si la fuente nueva lo exige; schema nuevo SOLO si aditivo e imprescindible (el modelo citacion/citacion_punto/sesion_tabla_item ya es genérico).

### Salida (insumo del gate de 94)
- `93-AUDITORIA-CITACIONES.md`: matriz N/M por celda con fechas, veredicto por endpoint, confirmación/refutación de los 3 hallazgos previos, gaps de wiring frontend con evidencia BrowserOS, y la DECLARACIÓN de cobertura parcial (qué se mostrará como cobertura declarada en 94 — p.ej. "comisiones Senado: desde 2026-W20; sala Cámara: solo sesiones con PDF procesado").
- Cobertura parcial DECLARADA, nunca presentada como completa.

### Claude's Discretion
- Rango exacto del backfill acotado del agente.
- Forma de la evidencia (tablas del reporte).
- Si el freshness CLI gana señales nuevas de citaciones aquí o en 94.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- packages/agenda: conectores citaciones existentes (Cámara citaciones_semana ViewState + Senado); run-agenda-prod-cli (memoria 2026-06-23: citacion=58, tabla Senado=6 en su momento); tabla sala Cámara vía DeepSeek-desde-PDF (buscador FTS 0032/0033).
- Tablas: citacion (0010:19-33, con estado "Suspendida"/"Sin efecto"), citacion_punto (boletín), sesion_tabla_item (0010:73-85), citacion_invitado (0016).
- pnpm freshness (packages/freshness) — señales de cobertura declarativas.
- app/app/agenda/page.tsx (lee citacion completa + invitados + puntos); estado-actual-block.tsx:248-254 (citaciones por boletín en ficha).
- scripts/bros-cli.mjs + MCP BrowserOS para el wiring audit.
- Patrón dos-etapas + R2Store + rate-limit (packages/ingest).

### Established Patterns
- Runbooks operador-LOCAL para masivo (66/67/70/71); corridas acotadas por agente (90-03, 92-04).
- WAF camara.cl bloquea fetch Node → curl-first / --html-file.
- PGCLIENTENCODING=UTF8 psql para queries con tildes.

### Integration Points
- La cobertura declarada de esta auditoría es el INSUMO DIRECTO del banner/leyenda de cobertura de /agenda en 94.
- Los gaps de wiring frontend alimentan los fixes de UI de 94 (no se tocan aquí).

</code_context>

<specifics>
## Specific Ideas

- Medir el universo de la semana vigente + 2 pasadas en cada fuente para estimar M sin crawl masivo.
- El reporte incluye la query psql verbatim de cada N.
- Anotar qué % de citaciones en DB tienen estado de cancelación/reagendo poblado (insumo del modelado honesto de 94).

</specifics>

<deferred>
## Deferred Ideas

- Backfill histórico masivo completo (runbook operador-LOCAL).
- Ingesta de actas/resultados de comisiones — v10.
- Fixes de UI (94).

</deferred>
