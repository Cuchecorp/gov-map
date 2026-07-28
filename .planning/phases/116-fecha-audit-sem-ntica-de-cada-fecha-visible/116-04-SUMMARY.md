---
phase: 116
plan: 04
subsystem: auditoria-fechas
tags: [audit, fechas, semantica, prod-crosscheck, solo-lectura]
requires:
  - 116-FORMATTERS.md (wave 1)
  - 116-PARCIAL-A.md (grupo A)
  - 116-PARCIAL-B.md (grupo B)
  - 113-INVENTARIO.md §3.0 (denominador)
provides:
  - 116-FECHAS-AUDIT.md (artefacto rector de la fase)
  - check-fechas.sh (completitud reproducible)
  - F-01..F-14 (hallazgos consumibles por Phase 117 sin re-investigar)
affects:
  - Phase 117 (fixes de copy y de formatter)
  - Phase 125 (verificación E2E contra el deploy)
tech-stack:
  added: []
  patterns:
    - "denominador derivado del catálogo, no hardcodeado, con ancla de sanidad que reporta desviaciones"
    - "cruce DB → formatter → etiqueta, un sujeto determinista por superficie"
    - "degradación honesta declarada cuando la query devuelve 0 filas"
key-files:
  created:
    - .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-FECHAS-AUDIT.md
    - .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh
  modified: []
decisions:
  - "El fix de F-05 NO es aplicar timeZone America/Santiago: PROD demuestra que 45.618 filas son date-only disfrazadas de timestamptz y convertirlas fabricaría el día anterior"
  - "El hallazgo de DÍA de lobby_audiencia queda REFUTADO por el dato (drift 0/17.762), no confirmado como suponían ambos parciales"
  - "E-026 y E-057 se cierran por declaración de ausencia, no forzándolos al conjunto cerrado de veredictos"
  - "F-10 se arregla fijando timeZone UTC (no Santiago): preserva el comportamiento correcto actual y lo vuelve contrato del código"
metrics:
  duration: ~2 h
  completed: 2026-07-28
  tasks: 3
  commits: 3
  hallazgos: 14
  ids_cubiertos: 38
---

# Phase 116 Plan 04: Cierre de la auditoría semántica de fechas — Summary

Artefacto rector `116-FECHAS-AUDIT.md` (1.068 líneas) que fusiona los tres parciales, los cruza
contra PROD con un sujeto determinista por superficie, y emite 14 hallazgos numerados accionables
por Phase 117; su completitud (38/38 ids) la prueba `check-fechas.sh`, que muerde.

## Qué se construyó

| Task | Entregable | Commit |
|---|---|---|
| 1 | `116-FECHAS-AUDIT.md` front-matter + `## 2. Cruce contra el dato real de PROD` (26 filas, 10 superficies) | `a1c8a35` |
| 2 | `## 0.` método, `## 1.` veredicto (1.0 formatters, 1.1 chokepoint, 1.2 reconciliación, 1.3 date-only, 1.4 tabla única de 100 filas), `## 3.` hallazgos F-01..F-14, `## 4.` cobertura, `## 5.` trazabilidad, `## 6.` límites | `14cc5eb` |
| 3 | `check-fechas.sh` (188 líneas, 6 checks) + `## 7. Verificación de cierre` | `5e3149a` |

## Hallazgos del cruce contra PROD (lo que el código solo no podía decir)

El cruce **reordenó** conclusiones de los parciales. Los tres resultados que más pesan:

1. **Patrón "date-only disfrazado de `timestamptz`".** `tramitacion_evento.fecha` tiene **44.569 de
   48.366** filas a medianoche UTC; `votacion.fecha`, **1.049 de 4.855**. El drift bruto de zona es
   masivo (44.596 y 1.076) pero casi todo es artefacto de ese patrón: el **drift real** —filas con
   hora significativa que cruzan el día— es de **27 y 27**. Consecuencia dura: aplicar
   `timeZone: "America/Santiago"` como fix "obvio" fabricaría el día anterior en **45.618 filas**.
   Queda escrito en F-05 para que 117 no cometa ese error.
2. **El hallazgo de DÍA de lobby queda REFUTADO.** Ambos parciales dedujeron del tipo `timestamptz`
   que `lobby_audiencia.fecha` corría el día. PROD: **drift 0 / 17.762** — todas las filas están a
   las 04:00 UTC, que es medianoche chilena. Lo mismo para su derivada en `cruce_senal`
   (**2.713 ítems, drift 0**), lo que además **cierra el `pendiente de confirmar por SQL`** que
   `116-PARCIAL-A.md` §A.2.1 había dejado abierto.
3. **La regla LOCKED 3 queda confirmada por el dato, no solo por el comentario.** `citacion.fecha`
   es 272/272 medianoche UTC y `sesion_sala.fecha` 16/16. El contrato date-only del gotcha v9.0 es
   real, y por eso F-09 (seis renders con `fechaCorta` en `estado-actual-block.tsx`) importa.

Hallazgo colateral: **fecha corrupta `2626-05-25`** en 2 filas de `tramitacion_evento` (boletín
18232-25), **visible** porque ningún componente del carril proyecto filtra por `fecha <= current_date`
⇒ F-04. Se verificó que las 17 citaciones futuras **no** son corrupción sino agenda legítima
(semanas 2026-W32/W33), así que un filtro global habría sido el bug.

## Los 14 hallazgos

**6 `miente`:** F-01 (chokepoint "Actualizado hace X" sobre `fecha_captura`, transversal, 17
call-sites), F-02 (badge de cruces muestra el `now()` del rebuild — verificado: min = max al
microsegundo), F-03 (badge de sección sobre un MAX del set), F-04 (fecha del año 2626 renderizada),
F-05 (27+27 filas con el día corrido), F-06 ("Última actualización de datos" en copy propio).

**8 `ambigua`:** F-07 (fechas del hecho sin rótulo), F-08 (`fecha_corte` e `ingestado_hasta` bajo el
mismo "corte al"), F-09 (6 renders date-only contra el JSDoc del propio archivo), F-10 (formatters
sin `timeZone`), F-11 (JSDoc dice 48 h, código dice 14 días), F-12 (chip año proxy e inerte),
F-13 (`relativeTimeEs` sobre un hecho), F-14 (rótulo ISO crudo en el panel de home).

**Apalancamiento para 117:** 24 de las 25 ocurrencias de SC2 comparten causa raíz — arreglar
`provenance-badge.tsx:90` las cierra todas.

## Cobertura

**38 ids** del denominador derivado de `113-INVENTARIO.md` §3.0: **28 con hallazgo** (`## 3.`) +
**10 sin hallazgo declarado** (`## 4.`). Cero excepciones silenciosas. Los 4 Success Criteria del
ROADMAP están trazados en `## 5.` a secciones concretas del propio artefacto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] La prueba negativa del plan citaba 60; el valor real es 51**

- **Found during:** Task 3
- **Issue:** la acceptance del plan afirma que relajar la regla de celda a igualdad contra `—` hace
  saltar el denominador "a 60". Observado: **51**. El 60 es el **total de filas** `E-xxx` de §3.0,
  no el resultado de la regla relajada — se confundieron dos magnitudes.
- **Fix:** se **reportó** la desviación en `## 7.2` con las tres magnitudes (38 LOCKED / 51 relajada
  / 60 total) y la lista exacta de los **13 falsos positivos**, en vez de silenciarla o de ajustar
  la prueba para que "cuadrara". El fondo del argumento del plan se sostiene y se refuerza: la regla
  relajada produciría 13 declaraciones falsas de "sin hallazgos". El comentario del script se
  corrigió al valor observado.
- **Files modified:** `116-FECHAS-AUDIT.md` §7.2, `check-fechas.sh` (comentario del check 1)
- **Commit:** `5e3149a`

**2. [Rule 1 - Bug] El script mordió su propia documentación**

- **Found during:** Task 3
- **Issue:** el check 5 detecta marcadores de trabajo pendiente en el artefacto. Al pegar la salida
  verbatim del script en `## 7.`, el propio mensaje de éxito del check 5 —que enumeraba esos
  marcadores— hacía fallar el check. Circularidad real, no falso positivo.
- **Fix:** se reescribió el **mensaje del script** para que su salida sea citable
  (`0 marcadores pendientes`), y se reformuló la celda de la tabla de higiene. **Jamás se relajó la
  compuerta** ni se doctoreó la salida pegada.
- **Files modified:** `check-fechas.sh`, `116-FECHAS-AUDIT.md` §7.1/§7.3/§7.4
- **Commit:** `5e3149a`

**3. [Rule 2 - Correctitud] Cadenas prohibidas por la acceptance dentro del propio script**

- **Found during:** Task 3
- **Issue:** la acceptance exige que `check-fechas.sh` no contenga la cadena de la opción PCRE de
  grep ni ids `E-0NN` enumerados. Ambas aparecían en **comentarios explicativos**.
- **Fix:** reformulados los comentarios sin perder la advertencia de portabilidad ni la explicación
  de la regla de celda. Verificado: ambos greps ⇒ 0.
- **Commit:** `5e3149a`

### Correcciones que los parciales mandaron propagar (todas aplicadas)

| encargo | dónde quedó |
|---|---|
| `page.tsx:504` lee `tramitacion_evento`, no `source_snapshot` | `### 1.2` fila 1 — reforzado: PROD confirma que `source_snapshot` **no tiene** columna `fecha_captura` ni `proyecto_id`, así que la atribución original era imposible |
| `lobby-en-tramitacion.tsx:144` lee `row.fecha_reunion` | `### 1.2` fila 2 y fila de E-041 en `### 1.4` |
| E-026 y E-057 cubiertos por declaración de ausencia | `### 1.2` fila 3 y `## 4.` |
| Residual E-040 absorbido desde `116-FORMATTERS.md` §2 | `### 1.1`, fila propia en `### 1.4`, y F-01/F-11 |
| Los 9 hallazgos acumulados del contexto | F-01 (badge), F-11 (umbral), F-10 (tz), F-05 (cuantificado), F-09 (6 renders), F-06 (E-008), F-12 (chip año), F-08 (`fecha_corte`), y el contraejemplo `:429` declarado **sin hallazgo** en `## 4.`/`### 1.2` fila 10 |

## Límites declarados (`## 6.`)

8 límites, entre ellos: emisores MONEY y NOTIF sin datos en PROD (0 filas ⇒ veredicto respaldado
solo por código y schema); el `curl` opcional contra el deploy **no ejecutado** (lo cubre Phase 125);
`source_snapshot` del boletín bicameral con 0 filas; los 2 emisores huérfanos; y que el fix de fondo
de F-05 es de **ingesta**, no de presentación.

## Régimen verificado

- `git status --porcelain app/ packages/` ⇒ vacío. Cero código de producto tocado.
- `git diff --quiet -- .env .env.example` ⇒ limpio. Cero flag movido.
- PROD: solo `SELECT`. Cero DDL, cero DML. `SUPABASE_DB_URL` jamás impreso ni escrito.
- Cero PII: sobre `suscripcion`/`consentimiento`/`declaracion`/`contrato` solo `count(*)` y
  metadatos de columna.
- **`pnpm test` NO se corrió**, y el motivo está declarado en `## 7.4`: sin cambio de código no hay
  regresión que la suite pueda detectar. Vuelve a ser obligatoria en Phase 117.

## Known Stubs

Ninguno. Esta fase produce documentación de auditoría, no código; no hay valores vacíos, mocks ni
placeholders. Los `TBD`/`TODO`/`FIXME` están en cero por compuerta automática (check 5).

## Self-Check: PASSED

Archivos declarados como creados:

- `FOUND: .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-FECHAS-AUDIT.md`
- `FOUND: .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh`

Commits declarados:

- `FOUND: a1c8a35` — docs(116-04): cruce contra PROD
- `FOUND: 14cc5eb` — docs(116-04): ensamblar el artefacto único + F-01..F-14
- `FOUND: 5e3149a` — test(116-04): check-fechas.sh + §7

Verificación funcional: `STRICT=1 bash check-fechas.sh` ⇒ **exit 0**, 6/6 checks OK.
