---
phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
plan: 02
subsystem: agenda / wiring frontend (auditoría)
tags: [auditoria, wiring, browseros, citaciones, agenda, ficha-proyecto]
requires:
  - 93-01 (matriz N/M + veredictos endpoints en 93-AUDITORIA-CITACIONES.md)
  - PROD deploy fa4d4369 live
  - BrowserOS MCP (http://127.0.0.1:9200/mcp) + scripts/bros-cli.mjs
  - psql SUPABASE_DB_URL (.env)
provides:
  - 93-WIRING-EVIDENCIA.md (gaps de wiring frontend con evidencia DOM PROD + causa raíz en código)
  - gap #1 (citacionVigente forward-only) CONFIRMADO con DOM
  - gap #2 (sesion_tabla_item no leído en la ficha) CONFIRMADO con DOM
affects:
  - Phase 94 (fix de /agenda + wiring en ficha) — consume esta evidencia
  - Plan 93-03 (DECLARACIÓN de cobertura) — consume esta evidencia
tech-stack:
  added: []
  patterns:
    - "BrowserOS new_hidden_page (no interfiere con navegador del operador) → get_page_content/take_snapshot sobre deploy PROD real"
    - "sujetos deterministas por psql (past-only citation / sala-only boletín) para aislar cada gap sin confundir carriles"
    - "control positivo (citación de HOY) para aislar que el gap es el filtro, no el canal de datos"
key-files:
  created:
    - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-WIRING-EVIDENCIA.md
  modified: []
decisions:
  - "gap #1 forward-only vive en el DERIVADOR citacionVigente (estado-actual-block.tsx:122-129), NO en la query (:311-315 trae todas las citaciones sin filtro de fecha)"
  - "gap #2: EstadoActualBlock (:290-315) NO consulta sesion_tabla_item; el interface EstadoActual (:21-45) no tiene campo de sala — solo /agenda SalaTableServer lo lee"
  - "/agenda citaciones NO es forward-only (navega por semana_iso): W26 muestra 53 pasadas de ambas cámaras → refuta sospecha de sesgo a futuro en /agenda"
metrics:
  duration: ~7 min
  tasks: 2
  files: 1
  completed: 2026-07-22
---

# Phase 93 Plan 02: Auditoría de WIRING frontend de citaciones (BrowserOS/PROD) Summary

Auditoría DOM sobre el deploy PROD real (`fa4d4369`) que CONFIRMA con evidencia BrowserOS los dos gaps de wiring de citaciones reportados por el operador: la ficha del proyecto oculta citaciones PASADAS (filtro forward-only `citacionVigente`) y no declara la presencia del proyecto en la tabla de sala (`sesion_tabla_item` no se lee en la ficha) — cada uno con un boletín/semana concreto reproducible por Phase 94.

## Qué se construyó

`93-WIRING-EVIDENCIA.md` con 4 secciones:

- **§0 Sujetos de prueba (Task 1):** elegidos por psql con queries verbatim — `2026-W26` (semana pasada poblada, 53 citaciones), `2026-W30` (vigente, control), `18193-06` (citación solo-pasada + 0 sala → aísla gap forward-only), `13665-07` (en sala + 0 citación → aísla gap sala-en-ficha). Cada sujeto con su query y su URL PROD.
- **§1 Capturas /agenda (Task 2):** W26 renderiza 53 citaciones pasadas de ambas cámaras (acordeón día 12+19+22, snapshot verbatim) + tabla de sala Senado/Cámara → **WIRING OK**. W30 degrada honesto (Cámara PDF, Senado "no hay tabla") → gap **DATOS**.
- **§2 Capturas ficha:** `18193-06` → "Citado" = 0 ocurrencias (gap #1); control positivo `11929-13` (citación hoy) SÍ muestra "Citado en …". `13665-07` → "tabla de sala"/"orden del día" = 0 (gap #2); contraste `/agenda?semana=2026-W28` muestra la fila `| 5 | N°13665-07 | … | ORDEN DEL DÍA |`.
- **§3 Gaps declarados:** gap #1 y gap #2 CONFIRMADOS con DOM + causa raíz en código (archivo:línea) + clasificación WIRING vs DATOS. Nota A3 resuelta (token urgencia 260722-eia live, filtro forward-only NO tocado). Cero fixes propuestos.

## Evidencia clave (DOM PROD real)

| Captura | Sujeto | DB esperado | DOM mostrado | Veredicto |
|---------|--------|-------------|--------------|-----------|
| 1 | /agenda W26 | 53 (32 Cám + 21 Sen) | 3 días 12+19+22=53, ambas cámaras | WIRING OK |
| 2 | /agenda W30 | 28 Sen, 0 Cám | 28 Sen, Cámara ausente, sala degrada a PDF | WIRING OK (gap DATOS) |
| 3 | ficha 18193-06 | "Citado en de Economía el 21 jul" | "Citado" = 0 ocurrencias | **GAP #1 WIRING** |
| 3-control | ficha 11929-13 | "Citado …" (cita hoy) | "Citado en de Trabajo y Previsión Social el 22 jul 2026." presente | canal OK (aísla el filtro) |
| 4 | ficha 13665-07 | "en tabla de sala Senado W28/W29" | "tabla de sala"=0, "orden del día"=0 | **GAP #2 WIRING** |
| 4-contraste | /agenda W28 | 13665-07 en sala | `\| 5 \| N°13665-07 \| … \| ORDEN DEL DÍA \|` | data existe, ficha no la lee |

## Causa raíz por gap (para Phase 94)

- **Gap #1** — `app/components/estado-actual-block.tsx:122-129`: `citacionVigente` filtra `x.d.toISOString().slice(0,10) >= hoyChile` (solo fecha >= hoy). La query (`:311-315`) trae TODAS las citaciones sin filtro de fecha → el sesgo forward-only vive puramente en el derivador. Línea de render afectada: `:271-278`.
- **Gap #2** — `app/components/estado-actual-block.tsx:290-315`: `EstadoActualBlock` NO consulta `sesion_tabla_item`; el interface `EstadoActual` (`:21-45`) no tiene campo de sala. Solo `app/app/agenda/page.tsx:453-564` (`SalaTableServer`) lee `sesion_tabla_item`.

## Deviations from Plan

None - plan executed exactly as written. El pin de ruta (MINOR-2) se resolvió leyendo `app/app/proyecto/[boletin]` (ruta confirmada `/proyecto/<boletin>`); el plan ya pedía confirmarla y coincide.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sujetos de prueba deterministas (psql) | ba1b409 | 93-WIRING-EVIDENCIA.md |
| 2 | Capturas DOM BrowserOS + gaps declarados | b0b2722 | 93-WIRING-EVIDENCIA.md |

## Notas para 94 (fixes, NO ejecutados aquí)

- Fix gap #1: la ficha debe mostrar la citación PASADA más reciente (o un carril "histórico de citaciones") sin regresionar el token "vigente/futura" ni fabricar vigencia (research §Pitfall 1: "estado ausente ≠ vigente confirmado").
- Fix gap #2: leer `sesion_tabla_item` en la ficha para declarar "está en la tabla de sala de la semana X" (hecho de tramitación; carril propio, nunca compone con lobby/voto — misma disciplina que `citacionVigente`).
- Ambos son gaps de WIRING (la data está en DB). Los gaps de DATOS/cobertura (Cámara W30 vacío, sala forward-only) son cobertura, no wiring.

## Self-Check: PASSED

- FOUND: 93-WIRING-EVIDENCIA.md
- FOUND: 93-02-SUMMARY.md
- FOUND commit ba1b409 (Task 1)
- FOUND commit b0b2722 (Task 2)
