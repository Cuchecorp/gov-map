---
phase: 116-fecha-audit-sem-ntica-de-cada-fecha-visible
verified: 2026-07-28T13:05:00Z
status: passed
score: 17/17 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
warnings:
  - item: "F-04 cita `app/components/tramitacion-stepper.tsx:99`; la ruta real es `app/components/capa1/tramitacion-stepper.tsx:99`"
    severity: warning
    impact: "1 de 31 rutas completas del artefacto no resuelve. Línea y contenido citados SON correctos (`{fechaCorta(d)}`). Phase 117 lo resuelve con un glob por basename."
  - item: "SC2 entrada #16 cita `app/components/search-result-card.tsx:27`, que es `camaraOrigen: string | null;`"
    severity: warning
    impact: "Off-by-one: la declaración de la prop `provenance` está en `:28` y el render de `<ProvenanceBadge>` en `:93`. El emisor E-028 y su semántica son correctos."
---

# Phase 116: FECHA-AUDIT — Semántica de cada fecha visible · Verification Report

**Phase Goal:** Se sabe, para cada fecha que el sitio muestra, si representa el hecho o la captura — y cuáles están mal etiquetadas.
**Verified:** 2026-07-28
**Status:** passed
**Re-verification:** No — verificación inicial

## Goal Achievement

### Success Criteria del ROADMAP

| # | Success Criterion | Status | Evidencia |
|---|---|---|---|
| SC1 | Cada fecha del inventario 113 con veredicto hecho/captura/ambigua y columna de origen citada | ✓ VERIFIED | `### 1.4` con 100 filas de veredicto. Denominador 38 ids **derivado** de 113 §3.0, no hardcodeado. Recalculé de forma independiente: 60 filas `E-` − 22 celdas «sin fecha» = **38** ✓. Los 38 tienen veredicto en `## 3.` (30) o `## 4.` (11) |
| SC2 | Toda ocurrencia de `fecha_captura` presentada como el hecho, con archivo:línea y superficie | ✓ VERIFIED | `### 5.1`, 25 entradas. Validé las 25 por script: 24 apuntan a línea con `capturedAt`/`fecha_captura`/`provenance`; la excepción (#10, E-008) es la documentada por tener copy propio (F-06) |
| SC3 | Date-only del Congreso verificadas contra el gotcha tz LOCKED | ✓ VERIFIED | `### 1.3`, 18 filas. **Conversiones de zona activas sobre date-only: 0**. Confirmé en PROD: `citacion` 272/272 a medianoche UTC, `sesion_sala` 16/16, `lobby_audiencia` drift **0/17.762** |
| SC4 | Veredicto cruzado contra dato real de PROD, un sujeto por superficie | ✓ VERIFIED | `## 2.`, 26 filas cubriendo las 10 superficies. **Re-ejecuté las queries contra PROD yo mismo — todos los números coinciden exactamente** (ver abajo) |

### Verificación independiente contra PROD

No acepté los valores del artefacto: los volví a consultar con `psql` read-only.

| Afirmación del artefacto | Mi consulta independiente | ¿Coincide? |
|---|---|---|
| `votacion`: drift real **27** de **4.855**; **1.049** a medianoche UTC | `27` / `4855` / `1049` | ✓ exacto |
| `tramitacion_evento`: drift real **27** de **48.366**; **44.569** a medianoche UTC | `27` / `48366` / `44569` | ✓ exacto |
| F-04: **2 filas** futuras, boletín `18232-25`, `2626-05-25` | 2 filas, `18232-25`, `2626-05-25 00:00:00+00` | ✓ exacto |
| `lobby_audiencia`: drift **0 / 17.762** | `0` / `17762` | ✓ exacto |
| `citacion`: **272/272** a medianoche UTC | `272` / `272` | ✓ exacto |
| `sesion_sala`: **16/16** a medianoche UTC | `16` / `16` | ✓ exacto |
| TimeZone del servidor PROD = `UTC` (load-bearing) | `UTC` | ✓ exacto |

La descomposición no trivial también se sostiene: mi query ingenua de drift da 1.076 (`votacion`) y 44.596 (`tramitacion_evento`); restando las filas a medianoche UTC quedan exactamente **27** y **27**. El artefacto distinguió correctamente «drift aparente» de «drift real», que es justo el error que la regla LOCKED 3 previene.

### Must-haves de los PLAN (17 truths)

| Plan | Truth | Status | Evidencia |
|---|---|---|---|
| 01 | Semántica declarada por formatter | ✓ | `116-FORMATTERS.md` (248 líneas), 19 formatters en `### 1.0` |
| 01 | Chokepoint `ProvenanceBadge` auditado una vez, regla LOCKED | ✓ | `### 1.1`; `provenance-badge.tsx:90` = `Actualizado {relativeTimeEs(capturedAt)}` verificado literal |
| 01 | N call-sites de `capturedAt` verificados uno por uno (N del grep vivo) | ✓ | Artefacto declara **17 call-sites en 15 archivos**. Mi grep independiente: **17** ocurrencias en **15** archivos ✓ |
| 01 | Grupos A y B reciben tabla común sin re-derivarla | ✓ | `116-PARCIAL-A/B.md` referencian `116-FORMATTERS` |
| 02 | Veredicto del carril parlamentario con origen citado | ✓ | `116-PARCIAL-A.md` (203 líneas) |
| 02 | Emisores MONEY auditados sin tocar flags | ✓ | E-013..E-016, E-060 marcados «respaldado solo por código»; límite 1 de `## 6.` |
| 02 | Emisor huérfano E-003 auditado | ✓ | SC2 entradas #4/#5, `voto-ficha-row.tsx:135` verificado literal |
| 02 | «Sin hallazgos» explícito, cero excepciones silenciosas | ✓ | `## 4.`, 11 ids; check 3 lo muerde |
| 02 | Date-only del grupo A contra gotcha tz | ✓ | `### 1.3` filas 1-11 |
| 03 | Veredicto carril proyecto/agenda/home/buscar | ✓ | `116-PARCIAL-B.md` (270 líneas) |
| 03 | Ninguna conversión tz sobre date-only pasa sin hallazgo | ✓ | 0 conversiones activas; F-09/F-10 levantan los riesgos latentes |
| 03 | `estado-actual-block.tsx:429` resuelto | ✓ | Verificado literal: `{fechaCorta(urgenciaFuente.fechaCaptura)}`; veredicto = contraejemplo con idiom aprobado |
| 03 | Emisor huérfano E-008 auditado | ✓ | F-06 + límite 5 de `## 6.` |
| 04 | Artefacto único sin emisor sin veredicto | ✓ | `116-FECHAS-AUDIT.md` (1.099 líneas); check 2 y 3 en verde |
| 04 | Cada veredicto cruzado contra PROD con query y valor | ✓ | `## 2.`, queries verbatim; re-ejecutadas por mí |
| 04 | Hallazgos F-01..F-NN consumibles por 117 | ✓ | F-01..F-14, cada uno con archivo:línea, qué dice hoy, por qué está mal, fix sugerido, severidad. 2 anchors menores con defecto (ver WARNINGs) |
| 04 | Script reproducible prueba completitud, denominador derivado | ✓ | `check-fechas.sh` (188 líneas). `STRICT=1` ⇒ **exit 0, 6/6 checks** |

**Score:** 17/17 truths verificadas + 4/4 Success Criteria.

### Artefactos

| Artefacto | Líneas (min) | contains | Status |
|---|---|---|---|
| `116-FORMATTERS.md` | 248 (≥80) | `diaCalendarioCitacion` ×6 | ✓ VERIFIED |
| `116-PARCIAL-A.md` | 203 (≥60) | `E-013` ×11 | ✓ VERIFIED |
| `116-PARCIAL-B.md` | 270 (≥60) | `diaCalendarioCitacion` ×20 | ✓ VERIFIED |
| `116-FECHAS-AUDIT.md` | 1.099 (≥200) | `F-01` ×39 | ✓ VERIFIED |
| `check-fechas.sh` | 188 (≥60) | `STRICT` ×7 | ✓ VERIFIED |

### Ejecución del script de completitud

| Check | Resultado |
|---|---|
| 1 — denominador derivado de 113 §3.0 = 38 | OK |
| 2 — los 38 ids aparecen en el artefacto | OK |
| 3 — los 38 tienen veredicto en `## 3.` o `## 4.` | OK |
| 4 — las 100 celdas de VEREDICTO ∈ {hecho, captura, ambigua} | OK |
| 5 — higiene: 0 credenciales, 0 RUT, 0 marcadores, 0 celdas vacías | OK |
| 6 — régimen solo-lectura: `git status app/ packages/` vacío | OK |

`STRICT=1 bash check-fechas.sh` ⇒ **exit 0**, `RESULTADO: sin faltas`.

**Auditoría del propio script:** verifiqué que el denominador NO está hardcodeado — `derivar_ids()` parsea `113-INVENTARIO.md` con la regla de celda y `38` es solo ancla de sanidad que el script *reporta* si diverge. Reproduje la derivación por mi cuenta con un awk distinto: 38 ✓. Inspeccioné las 22 celdas excluidas: todas son emisores que legítimamente no muestran fecha (chrome, copy estático, o delegan en otro emisor).

### Régimen solo-lectura (restricción rectora de la fase)

| Verificación | Resultado |
|---|---|
| Archivos tocados en los 15 commits de la fase | **Solo** `.planning/` — ni un archivo de `app/`, `packages/` o `supabase/` |
| `git status --porcelain` | Limpio |
| DDL/DML contra PROD | Cero — solo `SELECT` |
| Flags/gates tocados | Cero (MONEY y NOTIF quedaron OFF; límites 1-2 declarados) |

### Anti-Patterns

| Archivo | Patrón | Severidad | Nota |
|---|---|---|---|
| `check-fechas.sh:154` | `TBD\|TODO\|FIXME` | ℹ️ Info | Falso positivo: es la regex de detección del propio check 5 |

0 credenciales, 0 RUT, 0 marcadores de deuda reales en los 4 artefactos de contenido.

### Requirements Coverage

| Requirement | Descripción | Status | Evidencia |
|---|---|---|---|
| FECHA-01 | Cada fecha visible auditada semánticamente; `fecha_captura` jamás presentada como el hecho | ✓ SATISFIED | 38/38 emisores con veredicto; las 25 ocurrencias donde `fecha_captura` SÍ se presenta como el hecho están listadas en `### 5.1` con archivo:línea. REQUIREMENTS.md:17 `[x]` y :64 `Complete` |

Sin requirements huérfanos: FECHA-01 es el único ID mapeado a Phase 116 y los 4 planes lo declaran.

### Warnings (no bloquean el goal)

**W-1 — ruta incorrecta en F-04.** El artefacto cita `app/components/tramitacion-stepper.tsx:99`; la ruta real es `app/components/capa1/tramitacion-stepper.tsx:99`. Validé las 31 rutas completas del artefacto: **30 resuelven**, esta no. La línea y el contenido citados son correctos (`{fechaCorta(d)}` en `:99`, `{fechaCorta(estado.urgenciaVigente.desde)}` en `:194`), y las otras citas del mismo archivo usan el basename pelado, que sí es inequívoco.

**W-2 — off-by-one en SC2 #16.** `search-result-card.tsx:27` es `camaraOrigen: string | null;`. La declaración de la prop `provenance` está en `:28` y el render `<ProvenanceBadge {...provenance} />` en `:93`. El emisor (E-028), la superficie (`/buscar`) y la columna de origen son correctos.

Ambos son defectos de anclaje, no de veredicto. Sugerido: corregirlos al inicio de Phase 117.

### Human Verification Required

Ninguna. Todo el contrato de esta fase es documental y verificable programáticamente; lo re-verifiqué contra PROD y contra el código fuente. Los ítems que requieren juicio humano (flip del gate MONEY, saneamiento de las 2 filas corruptas, decisión sobre los emisores huérfanos E-003/E-008) están correctamente **declarados como límites** y **diferidos a Phase 117/125**, no silenciados.

### Gaps Summary

Sin gaps. El goal —«se sabe, para cada fecha que el sitio muestra, si representa el hecho o la captura, y cuáles están mal etiquetadas»— está alcanzado y es auditable:

- **Se sabe:** 38/38 emisores con fecha tienen veredicto explícito en {hecho, captura, ambigua} con columna de origen.
- **Cuáles están mal:** 14 hallazgos F-01..F-14 con archivo:línea, severidad y fix sugerido; 25 ocurrencias de `fecha_captura`-como-hecho listadas; 11 emisores declaran «sin hallazgos» explícitamente.
- **Contra el dato, no solo el código:** re-ejecuté 7 consultas clave contra PROD y **todas** coincidieron al dígito, incluida la distinción no trivial entre drift aparente (1.076 / 44.596) y drift real (27 / 27).

Lo más valioso de la fase es que el cruce contra PROD **refutó y corrigió** veredictos de sus propios parciales (`lobby_audiencia` degradado de hallazgo a riesgo latente; `cruce_senal` resuelto; atribución de `page.tsx:504` corregida) en vez de ratificarlos — señal de auditoría genuina, no de narrativa.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
