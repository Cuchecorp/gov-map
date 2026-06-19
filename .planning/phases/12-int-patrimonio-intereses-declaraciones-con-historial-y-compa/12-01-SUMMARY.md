---
phase: 12-int-patrimonio-intereses-declaraciones-con-historial-y-compa
plan: 01
subsystem: schema/data-destination
tags: [migration, rls, pii, deny-by-default, versioned, rpc, infoprobidad, pgtap]
requires:
  - "parlamentario(id) (0004) — FK del declarante"
  - "convención deny-by-default + revoke (0018/0021)"
  - "patrón security-definer RPC (0019/0020/0021)"
provides:
  - "tabla declaracion (public-read, VERSIONADA por (fuente_id, fecha_presentacion))"
  - "6 sub-tablas de bienes public-read (inmueble/mueble/actividad/pasivo/accion_derecho/valor)"
  - "tabla declaracion_familiar (deny-by-default + revoke anon/authenticated)"
  - "RPC declaraciones_de_parlamentario(text) — historial DESC"
  - "RPC comparar_declaraciones(text, date[]) — lado-a-lado SIN delta"
  - "tabla probidad_ingesta_estado (marcador public-read)"
affects:
  - "@obs/probidad writer (Plan 02) escribe aquí"
  - "ficha /parlamentario/[id] sección patrimonio (Plan 03) lee vía RPCs"
tech-stack:
  added: []
  patterns:
    - "clave de versión compuesta (fuente_id=URI nodo Declaracion, fecha_presentacion) — versiones acumulan"
    - "deny-by-default REAL = RLS-on + cero policies + revoke all from anon,authenticated"
    - "RPC comparación = layout-only (etiqueta/valor literal en filas), CERO columna de delta/veredicto"
    - "atribución CC BY 4.0 por fila (licencia) que viaja a la vista derivada"
key-files:
  created:
    - "supabase/migrations/0022_probidad.sql"
    - "supabase/tests/0022_probidad.test.sql"
  modified: []
decisions:
  - "OQ1: fuente_id = URI del nodo Declaracion (única), NO identificadorFuente (colisiona 170562/118624)"
  - "OQ2: columnas de sub-tablas pineadas a predicados literales enumerados en vivo por clase de bien"
  - "OQ3: tipo guarda el rdfs:label resuelto (o URI cruda si falta — nunca fabricar)"
  - "AccionDerecho.rutJuridica = RUT de empresa declarada (contenido del bien), NO RUT de persona natural"
metrics:
  duration: 18min
  completed: 2026-06-19
---

# Phase 12 Plan 01: Destino de datos VERSIONADO de Patrimonio/Intereses (migración 0022) Summary

Migración 0022 que crea el destino VERSIONADO de InfoProbidad: `declaracion` keyed por `(URI-del-nodo-Declaracion, fecha_presentacion)` (las versiones acumulan, nunca se sobreescriben), 6 sub-tablas de bienes public-read con columnas literales pineadas a predicados SPARQL reales, `declaracion_familiar` deny-by-default + revoke explícito de anon (lección Phase 11), los RPCs `declaraciones_de_parlamentario` (historial DESC) y `comparar_declaraciones` (lado-a-lado con CERO delta/veredicto), y el marcador `probidad_ingesta_estado` — aplicada al remoto sa-east-1 con pgTAP 34/34 verde.

## What Was Built

- **`declaracion` (public-read, VERSIONADA):** PK compuesta `(fuente_id, fecha_presentacion)`. `fuente_id` es la URI del nodo `Declaracion` (resuelto en OQ1 como la clave única estable). `parlamentario_id` nullable (FK solo si confirmado/determinista, IDENT-12). `licencia text not null default 'CC BY 4.0'` viaja con la fila. Provenance inline NOT NULL.
- **6 sub-tablas de bienes public-read** (`declaracion_bien_inmueble`, `_bien_mueble`, `_actividad`, `_pasivo`, `_accion_derecho`, `_valor`): cada una FK `(fuente_id, fecha_presentacion)` on delete cascade, columnas LITERALES pineadas a los predicados enumerados en vivo (OQ2), `unique` por clave natural para upsert idempotente, provenance + licencia.
- **`declaracion_familiar` (deny-by-default):** RLS on + CERO policies + `revoke all from anon, authenticated`. Sin columna RUT de persona natural. Sin FK a `parlamentario` (FK solo a la versión `declaracion`).
- **`declaraciones_de_parlamentario(text)`:** RPC security-definer, ordena `fecha_presentacion DESC`, proyecta solo campos publicados + licencia, solo declaraciones confirmadas. `revoke execute from public` + `grant execute to anon`.
- **`comparar_declaraciones(text, date[])`:** RPC security-definer que devuelve `(fecha_presentacion, etiqueta, valor, origen, fecha_captura, enlace, licencia)` en filas — campos escalares + bienes como pares etiqueta/valor literales. CERO columna de delta/variación/enriquecimiento/veredicto.
- **`probidad_ingesta_estado`:** marcador public-read `(parlamentario_id, ingestado_hasta, fecha_captura)` para los 3 estados honestos.
- **pgTAP `plan(34)`:** existencia, RLS, PK de versión = `(fuente_id, fecha_presentacion)`, family deny-by-default (cero policies + sin grant anon), public-read de declaracion + sub-tabla, provenance + licencia NOT NULL, sin columna RUT, FK familiar→declaracion (no a parlamentario), FK declarante nullable, ambos RPCs security-definer + grant execute anon.

## Open Questions resueltas EN VIVO (SPARQL `datos.cplt.cl/sparql`, 2026-06-19, delay 2-3s + UA)

- **OQ1 (clave de versión):** `ip:identificadorFuente` **NO es único** — 170.562 `Declaracion` vs **118.624** identificadorFuente distintos → colisiona. La URI del nodo `Declaracion` SÍ es única (170.562). **Decisión: `fuente_id` = URI del nodo Declaracion**, clave de versión `(fuente_id, fecha_presentacion)`.
- **OQ2 (predicados literales de bienes):** enumerados vía `SELECT DISTINCT ?p WHERE { ?x a ip:<Clase> ; ?p ?o . FILTER(isLiteral(?o)) }`. BienInmueble: anioInmueble/esSuDomicilio/fojasInmueble/numInscripcion/rolAvaluo/ubicadoEn. BienMueble: nombreMueble/descripcion/modelo/anioFabricacion/matricula/numeroInscripcion/anioInscripcion/tonelaje. Actividad: objeto/vinculo/remunerado/haceDoceMeses. Pasivo: tipoObligacion/acreedor/montoDeuda. AccionDerecho: fechaAdquisicion/cantidadAcciones/esControlador/gravamenes/rutJuridica. Valores: entidadEmisora/tipoAccionDerecho/cantidadRepresenta/valorPlaza/paisQueEmite/fechaAdquisicion/tipoGravamen.
- **OQ3 (labels de tipoDeclaracion):** `?tipo rdfs:label ?l` SÍ resuelve. _1="PRIMERA DECLARACIÓN (POR ASUNCIÓN DE CARGO)", _2="ACTUALIZACIÓN PERIÓDICA (MARZO)", _3="POR CESE DE FUNCIONES", _4/_5 rectificación/presentación a requerimiento, _6 actualización voluntaria, _7 declaración voluntaria, _8 cese y asunción simultánea, _9 rectificación voluntaria, _10 actualización periódica (septiembre). El conector resuelve el label; URI cruda si falta (nunca fabricar).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `AccionDerecho.rutJuridica` documentado como RUT de empresa, no de persona natural**
- **Found during:** Task 1 (OQ2 enumeration)
- **Issue:** La enumeración SPARQL reveló `ip:rutJuridica` en `AccionDerecho`. El research afirma "no RUT en la fuente" (refiriéndose a persona natural). Una columna `rut_*` podría disparar la assertion pgTAP "sin columna RUT".
- **Fix:** La columna `rut_juridica` vive SOLO en `declaracion_accion_derecho` (contenido publicado del bien: el RUT de la empresa cuyas acciones se declaran), comentada explícitamente. La assertion pgTAP de "sin RUT" se acota a `declaracion` y `declaracion_familiar` (las tablas de persona natural), donde efectivamente no existe.
- **Files modified:** supabase/migrations/0022_probidad.sql, supabase/tests/0022_probidad.test.sql
- **Commit:** 2194d50 / acfc7cd

### Operator checkpoint (Task 3) — RESUELTO en el mismo entorno (no diferido)

El checkpoint de operador (aplicar + pgTAP) se ATENTÓ y tuvo ÉXITO en este entorno:
- `psql --single-transaction` aplicó 0022 al remoto sa-east-1 (extraído `SUPABASE_DB_URL` con node esquivando el BOM): todos los CREATE/ALTER/GRANT/REVOKE/CREATE FUNCTION OK.
- pgTAP `0022_probidad.test.sql` contra el schema aplicado: **34/34 PASS, 0 fallos.**
- Verificación operacional adicional: como `anon`, `select count(*) from declaracion` PERMITE (public-read); `select from declaracion_familiar` → `ERROR: permission denied for table declaracion_familiar` (deny-by-default + revoke confirma la lección Phase 11 a nivel de PRIVILEGIO).

## Verification

- Gates de grep Task 1 y Task 2: PASS (`0022 OK`, `pgTAP 0022 OK`).
- Migración aplicada al remoto sa-east-1: PASS (sin errores en transacción única).
- pgTAP contra schema aplicado: **34/34 PASS**.
- anon-deny operacional sobre `declaracion_familiar`: PASS (permission denied).
- anon-read operacional sobre `declaracion`: PASS.

## Notes for Next Plans

- **Plan 02 (@obs/probidad writer):** usa `onConflict 'fuente_id,fecha_presentacion'` para la versión; resuelve el `tipo` label vía SPARQL (OQ3) y guarda URI cruda si falta; `fuente_id` = URI del nodo `Declaracion` (no identificadorFuente). Los familiares van a `declaracion_familiar` (sin reconciliación, sin link a persona).
- **Plan 03 (ficha):** lee vía `declaraciones_de_parlamentario` (historial) y `comparar_declaraciones` (comparación). El RPC de comparación NO computa delta — el UI dispone lado-a-lado y muestra "No declarado en esta versión" para campos ausentes. La licencia CC BY 4.0 viaja por fila → renderizarla visible incluso en la vista de comparación. `probidad_ingesta_estado` distingue "no ingestado" (fila ausente) de "ingestado, cero" (fila presente).

## Self-Check: PASSED
