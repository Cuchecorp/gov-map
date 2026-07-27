---
phase: 113
plan: 03
subsystem: planning-artifacts
tags: [inventario, rutas-densas, links, fechas, fecha-captura, provenance-badge, gates]
requires:
  - "113-01: §1 sujetos deterministas, §5 gates + convención de la columna gate"
  - "113-02: §2 chrome C-01..C-04, §3 catálogo E-001..E-060"
  - "113-06: §3.1 call-sites de sourceUrl, §3.2 builders, §3.3 familias URL-desde-columna"
provides:
  - "113-INVENTARIO.md §4.1 /parlamentario/[id] (tablas A/B/C + 4.1.b not-found)"
  - "113-INVENTARIO.md §4.2 /proyecto/[boletin] con AMBOS boletines y el rewrite documentado (+ 4.2.b not-found con 2 externos)"
  - "113-INVENTARIO.md §4.3 /contraparte/[id] gated MONEY (+ 4.3.b not-found + 4.3.c nota de PII)"
  - "Régimen LOCKED de §4: 3 tablas de columnas fijas, cero celdas vacías, regla de badge DUAL"
affects: [113-04, 113-05, 114, 115, 116, 122, 125]
tech-stack:
  added: []
  patterns:
    - "una fila de Tabla B por cada instancia de ProvenanceBadge (chokepoint DUAL), aunque sourceUrl sea null"
    - "verificación de call-sites por grep de imports antes de asignar un emisor a una ruta"
key-files:
  created:
    - .planning/phases/113-inv-inventario-rector-de-superficies/113-03-SUMMARY.md
  modified:
    - .planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md
decisions:
  - "El link a Senado se registra POST-rewrite de enlaceHumanoProyecto, con la columna cruda declarada en la misma fila"
  - "Los badges con sourceUrl={null} aportan igual su fila en Tabla B, declarando que el <a> no se emite"
  - "El id de sonda sintético del gate MONEY se referencia desde §4.3 sin repetir el literal (criterio de RUT limpio en §4)"
requirements: [LINK-01]
metrics:
  duration: ~50 min
  completed: 2026-07-27
---

# Phase 113 Plan 03: Las 3 rutas dinámicas densas — Summary

Las tres rutas que concentran links externos a fuente y fechas con semántica de captura quedan
inventariadas con sujetos concretos de §1, tablas A/B/C de columnas fijas y sus `not-found.tsx`
como sub-superficie: **46 links internos, 26 links externos y 48 fechas**, cada fila con emisor
`archivo:línea` o referencia `E-NNN`.

## Qué se construyó

### Régimen LOCKED de §4 (encabezado nuevo de la sección)

Antes de la primera ruta se declaran las reglas transversales: 3 tablas fijas (A internos /
B externos / C fechas), chrome referenciado `→ C-0N` sin repetirse, componentes referenciados
`→ E-NNN`, `—` obligatorio en vez de celda vacía, marca literal `no emitido en el deploy auditado`
para gates OFF y la **regla de badge DUAL**: toda instancia de `ProvenanceBadge` aporta una fila en
Tabla B **y** una en Tabla C.

### §4.1 `/parlamentario/[id]` — sujetos `D1165` (diputado) y `S1338` (senador)

- **Tabla A: 20 filas.** Incluye la diferencia por sujeto: con `S1338` (0 lobby / 0 cruces /
  0 comisiones) la sección de cruces no pinta detalle y el rail no ofrece la entrada `#cruces`.
- **Tabla B: 10 filas.** 7 desde badge, 1 literal (CC BY 4.0 de patrimonio), 1 fila de
  `partidoLegible` registrada como **link desactivado a propósito** (invariante "CERO URI").
- **Tabla C: 21 filas.** 8 marcadas `fecha_captura` vía badge, más `partido_fecha_captura` que el
  chip formatea **fuera** del badge.
- `4.1.b not-found.tsx` con su único href.

### §4.2 `/proyecto/[boletin]` — sujetos `14309-04` (bicameral) y `17870-05` (solo-Senado)

- **Tabla A: 11 filas.** **Tabla B: 14 filas** (la ruta más densa en externos).
  **Tabla C: 21 filas.**
- El **rewrite** queda registrado con ambos estados: columna cruda
  (`proyecto.enlace` = `tramitacion.senado.cl/wspublico/...`) y href emitido
  (`buildSenadoUrl(boletin)`), en B1/B6/B7/B8. **B5 es la excepción declarada**:
  `tramitacion_evento.enlace` sale **verbatim, sin rewrite** (candidato #1 de 115).
- La **rama sin Cámara** queda explícita por sujeto: `buildCamaraUrl` solo emite con
  `prm_id_camara !== null` ⇒ el boletín `17870-05` **no** produce B2 ni B4 (fila ausente, sin
  placeholder — fail-honest).
- La **frescura** (C2) se marca `fecha_captura` y se describe como el `fecha_captura` MÁS RECIENTE
  del set de eventos; las fechas del hecho son `tramitacion_evento.fecha` / `citacion.fecha` /
  `sesion_tabla_item`. C8, C20 y C21 llevan su copy literal (`según {fuente} al {fecha}`,
  `Respaldo del {fecha} · Esto decía la fuente ese día`).
- `4.2.b not-found.tsx` con su **Tabla B propia**: 2 literales externos (senado.cl y camara.cl,
  ambos buscadores genéricos sin boletín) + 1 interno.

### §4.3 `/contraparte/[id]` — gated MONEY

- 3 + 2 + 6 filas, **todas** con la marca literal `no emitido en el deploy auditado`.
- Sujeto **no elegido** (degradación honesta de §1.5): cero id inventado.
- **Doble ausencia** registrada: gate OFF *y* `contrato.enlace` / `aporte.enlace` con 0 filas ⇒
  aunque MONEY se encendiera, el badge no emitiría `<a>`.
- `4.3.b not-found.tsx` (la única superficie real de esta ruta hoy) y **`4.3.c` nota de PII**.

## Hallazgos sustantivos

| Hallazgo | Evidencia | Impacto |
|----------|-----------|---------|
| **`E-048` atribuía mal el origen de la frescura de tramitación** | el `capturedAt` de `page.tsx:490` sale del `reduce` sobre `tramitacion_evento` (`page.tsx:478-482`), no de `source_snapshot`; `source_snapshot` solo alimenta el respaldo R2 (`validacion-fuente.tsx:189`) | Corregido en C2/C21 de §4.2. **116** habría auditado la fecha contra la tabla equivocada |
| **`VotoRow` (E-026) NO se monta en `/parlamentario/[id]`** | único llamante non-test: `voto-detalle.tsx:51` ← `votacion-card.tsx:108` ⇒ solo `/proyecto/[boletin]` | El catálogo lo listaba en ambas rutas; 114/125 no deben esperar ese href en la ficha de parlamentario |
| **`ParlamentarioResumen` (E-029) no llega al DOM de su ruta** | `page.tsx:7-10` importa solo `construirChips`; las anclas las emite `FichaRail` (`ficha-rail.tsx:59`) | Tercer emisor sin call-site de render, junto a los 2 huérfanos de §3.0.1 |
| **`partido-chip` muestra `fecha_captura` FUERA del badge** | `partido-chip.tsx:65-70` → `según {fuente} al {fecha}` con `partido_fecha_captura` | Candidato de **116**: es fecha de scraping formateada por un componente propio, no por el chokepoint |
| **`probidad_ingesta_estado` no renderiza fecha** | `.select("parlamentario_id")` (`patrimonio-de-parlamentario.tsx:989-991`) | A diferencia de sus hermanas MONEY (`contratos_ingesta_estado.ingestado_hasta`, `aportes_ingesta_estado.ingestado_hasta`, C16/C20), no aporta fila en Tabla C |
| **`verTodosHref` es `null` en los 5 bloques de relaciones** | `page.tsx:430,446,462,479,505` | La fila A5 existe en el código pero **no emite `<a>`** en esta ruta; 115 no debe perseguirla |
| **`/contraparte/[id]` no tiene inbound** | `grep -c 'href="/contraparte/'` → 0 y 0 en ambas fichas (§5) | Ni siquiera con el gate ON habría cómo llegar por navegación desde las fichas auditadas |

## Deviations from Plan

**1. [Rule 1 - Bug] Corrección del origen de `capturedAt` en `E-048`**

- **Found during:** Task 2
- **Issue:** el catálogo (§3.0, Plan 02) registra el `capturedAt` de
  `app/app/proyecto/[boletin]/page.tsx:490` como `tabla.source_snapshot`. El código lo deriva del
  `fecha_captura` más reciente de `tramitacion_evento` (`page.tsx:478-482`). Copiar el catálogo a
  ciegas habría dado a **116** una fecha con el origen equivocado.
- **Fix:** §4.2 registra C2 con origen `tabla.tramitacion_evento.fecha_captura` y C21 con
  `tabla.source_snapshot.fetched_at` (respaldo R2), más una nota explícita de la corrección al pie
  de la Tabla C. No se editó §3 (trabajo de otro plan): la corrección vive donde se usa.
- **Files modified:** `113-INVENTARIO.md` (§4.2)
- **Commit:** `27b3951`

**2. [Rule 2 - Correctness] Referencia al id de sonda sin repetir su literal**

- **Found during:** Task 3
- **Issue:** el acceptance criterion pide `grep -E '[0-9]{7,8}-[0-9kK]'` sin match. El archivo ya
  traía **un** match preexistente: el id de sonda sintético del comando `curl` que **prueba** el
  gate MONEY en §5 (Plan 01). Borrarlo destruiría la re-ejecutabilidad de la evidencia del gate;
  repetirlo en §4.3 habría multiplicado el match.
- **Fix:** §4.3.c declara la excepción **por referencia** (RUT de empresa con ceros, fila MONEY de
  §5) sin escribir el literal. Resultado: **cero matches del patrón de RUT en todo §4**; el único
  del archivo sigue siendo la evidencia verbatim de §5, declarada como sonda sintética y no PII
  (`contrato` tiene 0 filas en PROD).
- **Files modified:** `113-INVENTARIO.md` (§4.3.c)
- **Commit:** `695754d`

## Threat mitigations aplicadas

| Threat | Cómo |
|--------|------|
| T-113-02 | Solo ids públicos (`D1165`, `S1338`, `14309-04`, `17870-05`); contraparte **no elegida**. Cero RUT/email/monto individual en §4 (`grep -E '[0-9]{7,8}-[0-9kK]'` sobre §4.1-4.3 → **0**) |
| T-113-04 | 45 ocurrencias de la marca literal `no emitido en el deploy auditado` en el archivo; toda fila MONEY/NOTIF de §4 la lleva |
| T-113-07 | Cero filas sin emisor: cada una cita `archivo:línea` o `→ E-NNN` / `→ C-0N` |
| T-113-SC | Cero instalaciones de paquetes; el plan es puro análisis de código |

## Verificación

| Criterio | Comando | Resultado |
|----------|---------|-----------|
| Las 3 secciones existen | `grep -c '^### 4\.'` | **3** |
| Checklist | `STRICT=0 bash check-inventario.sh` | **exit 0** (las 2 faltas restantes son rutas de **Plan 04**: `/notificaciones/baja` y `/`) |
| Cero celdas vacías | `grep -nE '\|[[:space:]]*\|'` | **2 matches, ambos dentro de bloques de código** (operador `\|\|` de SQL en §1.5 y de TypeScript en §3.1.3) — cero celdas de tabla vacías |
| Cero RUT en §4 | `sed -n '/^### 4.1/,/^## 5/p' \| grep -cE '[0-9]{7,8}-[0-9kK]'` | **0** |
| Cero email en §4 | `sed ... \| grep -ciE '@[a-z]+\.(cl\|com)'` | **0** |
| Rewrite documentado | `grep -q 'enlaceHumanoProyecto'` | presente (§3.2 + §4.2 B1/B6/B7/B8) |
| `not-found.tsx` apendizadas | check 2 del script | **OK — las 4** |

## Para los Planes 04 / 05

- §4 ya trae su **encabezado de régimen LOCKED**: el Plan 04 escribe §4.4 en adelante con las
  **mismas** 3 tablas de columnas fijas y la misma regla de badge DUAL.
- El check 1 del script sigue reportando 2 faltas: la ruta `/` necesita su header
  `### 4.N /` (regex `^### 4\.[0-9]+ /$`) y falta `/notificaciones/baja`. Ambas son de Plan 04.
- La **Tabla D (§0.4)** sigue con celdas `_(pendiente — Plan 04)_`.
- Emisores que **no** deben perseguirse en el DOM: `E-003`, `E-008` (§3.0.1) y ahora también
  `E-029` en `/parlamentario/[id]`, más la fila A5 (`verTodosHref = null`).

## Commits

| Task | Commit | Descripción |
|------|--------|-------------|
| 1 | `eff10eb` | §4.1 `/parlamentario/[id]` + 4.1.b |
| 2 | `27b3951` | §4.2 `/proyecto/[boletin]` (ambos boletines, rewrite) + 4.2.b |
| 3 | `695754d` | §4.3 `/contraparte/[id]` (MONEY) + 4.3.b + nota de PII |

## Self-Check: PASSED

- Archivos declarados: 2/2 FOUND (`113-INVENTARIO.md`, `113-03-SUMMARY.md`)
- Commits declarados: 3/3 FOUND (`eff10eb`, `27b3951`, `695754d`)
