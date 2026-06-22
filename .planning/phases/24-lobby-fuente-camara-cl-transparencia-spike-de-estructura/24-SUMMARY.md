---
phase: 24-lobby-fuente-camara-cl-transparencia-spike-de-estructura
plan: 01
subsystem: lobby
tags: [lobby, camara, transparencia, spike, cheerio, parser, conector, ley-20730, identidad-pendiente]

# Dependency graph
requires:
  - phase: 11 (INT lobby)
    provides: "conector @obs/lobby + modelo LobbyAudiencia/LobbyAsistente (0021) + writer/ingest-run"
  - phase: 23 (OPS)
    provides: "esquema lobby aplicado al remoto (precondición de la corrida Phase 25)"
provides:
  - "spike LIVE de camara.cl/transparencia/listadodeaudiencias.aspx (estructura validada end-to-end)"
  - "parse-camara-lobby.ts (parser cheerio del listado → LobbyAudiencia[]) + parseFechaCamara"
  - "connector-camara-lobby.ts (CamaraLobbyConnector, fetch único en ORDEN LOCKED)"
  - "fixture real UTF-8 + 8 tests; clave natural sintetizada CAMARA-<sha256>"
affects: [Phase 25 (corrida LIVE + adjudicación de identidad + ficha poblada)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fuente de UNA sola página (~12 MB, 17.776 filas, sin paginación) → fetch único, NO crawl per-diputado: la 'corrida a escala' es PARSE + adjudicación, no red"
    - "Clave natural SINTETIZADA (sha256 sobre las 5 celdas normalizadas) cuando la fuente no expone id (la columna Detalles está HTML-comentada) → escrituras idempotentes + dedup"
    - "Nombre del sujeto pasivo preservado RAW (incl. 'Asesor(a) H.D. <diputado>') — la extracción/adjudicación se difiere a la fase de identidad"
    - "Mapeo a modelo existente sin migración: asistentes = [Sujeto Pasivo, Lobbista]; Lugar no se persiste (diferido)"

key-files:
  created:
    - packages/lobby/src/parse-camara-lobby.ts
    - packages/lobby/src/connector-camara-lobby.ts
    - packages/lobby/src/parse-camara-lobby.test.ts
    - packages/lobby/src/__fixtures__/camara-listadodeaudiencias.sample.html
    - .planning/phases/24-lobby-fuente-camara-cl-transparencia-spike-de-estructura/24-CONTEXT.md
    - .planning/phases/24-lobby-fuente-camara-cl-transparencia-spike-de-estructura/24-SUMMARY.md
  modified:
    - packages/lobby/src/index.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "La fuente REAL es listadodeaudiencias.aspx (no ley_de_lobby.aspx, que es un hub de enlaces). Una sola página entrega TODO el dataset de la Cámara"
  - "Spike validado end-to-end contra la página viva: 17.730 audiencias (dedup de 17.776), 100% con fecha ISO (parser de mes abreviado español robusto), 526 sujetos-pasivos distintos, 1.184 filas vía Asesor H.D., parse 12 MB en ~2.5s"
  - "La columna Detalles está HTML-comentada → no hay id ni link de detalle: se sintetiza la clave natural y se preserva el nombre RAW para que Phase 25 adjudique identidad (extrayendo el H.D.)"
  - "camara.cl ya está en el allowlist por defecto de @obs/ingest → no se requirió override SSRF"

# Metrics
metrics:
  duration: ~40min
  completed: 2026-06-22
---

# Phase 24 Plan 01: LOBBY — Fuente camara.cl/transparencia + spike Summary

Spike LIVE de la fuente real de lobby del Congreso (`camara.cl/transparencia`) + parser y
conector nuevos en `@obs/lobby`, dejando lista la ingesta de la fuente camara para que
Phase 25 la corra a escala y adjudique identidad.

## What was built / validated

- **Spike LIVE** de `https://www.camara.cl/transparencia/listadodeaudiencias.aspx`:
  - Es UNA página (~12 MB, 17.776 filas) con TODO el dataset; sin paginación.
  - Tabla de 5 columnas: Sujeto Pasivo | Fecha | Lobbista representado | Lugar | Materia.
    La columna "Detalles" está HTML-comentada (no hay id/link de detalle).
  - `ley_de_lobby.aspx` es solo un hub; la data vive en `listadodeaudiencias.aspx`.
- **`parse-camara-lobby.ts`**: `parseCamaraLobbyAudiencias` (cheerio) → `LobbyAudiencia[]`;
  salta cabeceras (`<th>`/`<tr id="mytr">`), exige ≥5 `<td>`, sintetiza la clave
  `CAMARA-<sha256(5 celdas).slice(0,16)>`, valida con `LobbyAudienciaSchema` (drift → warn+skip,
  nunca fabrica), dedup por identificador. `parseFechaCamara("26 jun. 2026")` → ISO UTC con
  guarda de overflow (31 feb → null). Lugar NO se persiste (diferido).
- **`connector-camara-lobby.ts`**: `CamaraLobbyConnector` (`fetchListado()` en el ORDEN LOCKED
  de @obs/ingest, UA `Bot-Ciudadano/1.0`, decode UTF-8, 403/503 → `CamaraLobbyBloqueadaError`).
- **`parse-camara-lobby.test.ts`** (8 tests) + fixture real UTF-8. Barril `index.ts` actualizado.

## Validación end-to-end (contra la página viva, no solo el fixture)

17.730 audiencias parseadas (dedup de 17.776), **100% con fecha ISO** (0 fallos), 526
sujetos-pasivos distintos, **1.184 filas vía "Asesor H.D."** (apoderado de un diputado),
parse de 12 MB en ~2.5s. Muestra: "Sofía González Cortés" / 2026-06-26 / "Cámara de Comercio
Quillota".

## Verification

- `pnpm --filter @obs/lobby test` → **33 passed** (5 files; 8 nuevos).
- `pnpm --filter @obs/lobby typecheck` (`tsc -b`) → limpio.

## Deviations from Plan

- Endurecimiento menor de `parseFechaCamara` (guarda de overflow de fecha imposible) — solo
  agrega rechazos, nunca fabrica.

## Hand-off a Phase 25

- Correr `CamaraLobbyConnector.fetchListado()` LIVE → crudo a R2 → parse → adjudicar identidad
  del sujeto pasivo (incl. extraer el diputado real desde "Asesor(a) H.D. <nombre>") por el
  pipeline de confirmación por nombre → escribir con la guarda `EnlaceConfirmado` → ficha poblada.
- Las 1.184 filas vía Asesor H.D. son el trabajo central de adjudicación de Phase 25.

## Self-Check: PASSED
