---
phase: 116-fecha-audit-sem-ntica-de-cada-fecha-visible
plan: 03
subsystem: auditoria-fechas
tags: [audit, solo-lectura, fechas, date-only, provenance]
requires: [116-01 (116-FORMATTERS.md), 113-INVENTARIO.md §3.0]
provides: [116-PARCIAL-B.md]
affects: [116-04 (consolidación y numeración F-xx), 117 (FECHA-FIX)]
tech-stack:
  added: []
  patterns: [auditoria con evidencia archivo-linea, veredicto tri-estado, re-localizacion de anchors por simbolo]
key-files:
  created:
    - .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/116-PARCIAL-B.md
  modified: []
decisions:
  - "estado-actual-block.tsx:429 (urgenciaFuente.fechaCaptura) NO es hallazgo: ya usa el idiom aprobado 'según {fuente} al {fecha}' — resultado contrario al esperado por el plan"
  - "Hallazgo nuevo del grupo B: 6 líneas de estado-actual-block.tsx formatean date-only del Congreso con fechaCorta (sin timeZone), violando el comentario del propio archivo"
  - "Residual E-040 (ProvenanceBadge) declarado en B.4: no pertenece a A ni a B; su auditoría vive en 116-FORMATTERS.md §2"
metrics:
  duration: ~35 min
  completed: 2026-07-28
---

# Phase 116 Plan 03: Veredicto de fechas del grupo B Summary

Auditoría solo-lectura que emite veredicto `hecho`/`captura`/`ambigua` para las **57 fechas
visibles** de los **19 emisores** del grupo B (carril proyecto, `/agenda`, home y `/buscar`), con
origen (columna o RPC) citado, anchor re-localizado por símbolo y etiqueta visible verbatim.

## Qué se construyó

`116-PARCIAL-B.md` (≈120 líneas de tabla + secciones), estructurado en:

- `B.0` — reglas de decisión LOCKED declaradas verbatim (documento auto-legible) + **tabla de tipos
  reales verificada en el schema**, no supuesta.
- `B.1` — carril `/proyecto/[boletin]`: 12 ids, 20 filas.
- `B.2` — `/agenda`, home, `/buscar` y `estado-actual`: 7 ids, 33 filas (E-032 con 15).
- `B.2.1` — auditoría date-only del gotcha LOCKED v9.0: 8 columnas date-only enumeradas.
- `B.3` — cierre 19/19 con conteo de filas por id.
- `B.4` — residual E-040 registrado, no descartado.

## Hallazgos sustantivos

1. **El hallazgo esperado número uno de la fase NO se confirmó.** `estado-actual-block.tsx:429`
   renderiza `urgenciaFuente.fechaCaptura` dentro del copy `según {fuente} al {fecha}.` (`:426-433`)
   — el **idiom aprobado**. Veredicto `captura`, `¿miente?` = **no**. Único matiz para 117: la fecha
   es un `max()` sobre el set de eventos, así que declara la frescura del evento más recientemente
   scrapeado, no la del dato de urgencia.

2. **Hallazgo nuevo, no anticipado: date-only formateada con `fechaCorta`.** Seis líneas de render
   de `estado-actual-block.tsx` (`:445`, `:460`, `:475`, `:479`, `:494`, `:497`) pasan
   `citacion.fecha` / `sesion_sala.fecha` (date-only medianoche UTC) por `fechaCorta`, que **no fija
   `timeZone`**. Hoy el runtime es UTC y el día no se corre, pero el **mismo archivo** prohíbe el
   patrón en su JSDoc (`:145-150`) y usa `diaCalendarioCitacion` para esas columnas en `:189`/`:221`.
   Dos de las seis viven en `aria-label` — el defecto llega al canal de lectores de pantalla.

3. **Conversiones de zona activas sobre date-only: cero.** Los ocho contratos date-only enumerados
   en `B.2.1` (E-004, E-033, E-018, E-055 y la lógica de E-032) honran la regla LOCKED.

4. **El hallazgo mayor del grupo A se propaga.** `tramitacion_evento.fecha`, `votacion.fecha`,
   `lobby_audiencia.fecha` y `lobby_en_tramitacion.fecha_reunion` son `timestamptz`; renderizadas
   con `fechaCorta` (runtime UTC) o `fechaCortaSegura` (slice ISO UTC) muestran el **día UTC**, así
   que un hecho chileno posterior a las 21:00 CL se rinde con el día siguiente. Afecta a E-010,
   E-020, E-038, E-041, E-044, E-045, E-056, E-008 y E-055.

5. **`actualidad-module.tsx:451` (E-008, huérfano)** rotula `max(fecha_captura)` de seis tablas bajo
   el encabezado `Última actualización de datos` — presenta captura como el hecho (regla LOCKED 1),
   en copy propio y no vía el chokepoint.

6. **`search-result-card.tsx:71` (E-028)** muestra un chip de año pelado documentado en su propio
   JSDoc como *"proxy de ingreso"* ⇒ veredicto **`ambigua`**. Además está **inerte**: ningún
   call-site de producción pasa `anio=`. El inventario 113 no lo registraba.

## Diferencias declaradas vs. el plan y el inventario

- `page.tsx:504` lee **`tramitacion_evento.fecha_captura`** (reduce por `max`, `:492-497`), no
  `source_snapshot` como afirma `116-FORMATTERS.md` §2.2 fila 1. Veredicto inalterado.
- `lobby-en-tramitacion.tsx:144` lee **`row.fecha_reunion`** (`:123`), no la columna `fecha` de la RPC.
- 113 §3.0 omite `:479` y `:494` de E-032 (las dos de `aria-label`).
- 113 atribuye a E-018 fechas que el componente **no renderiza** (cero formatter en el archivo).
- 113 no menciona el chip `anio` de E-028.
- Anchor corregido durante la verificación: prop `provenance` de `sala-table-section.tsx` está en
  `:33` (render `:59`), no en `:32`.

## Deviations from Plan

Ninguna desviación de régimen. `git status --porcelain app/ packages/` vacío en ambas tasks: cero
código de producto tocado, cero flag, cero `.env`.

Una corrección de anchor propia (`sala-table-section.tsx:32` → `:33`) detectada por la verificación
`sed -n '<linea>p' | grep -qF '<símbolo>'` exigida por el plan, aplicada antes del commit de Task 2.

## Known Stubs

Ninguno. El artefacto es documentación de auditoría; no introduce código ni datos placeholder.

## Tasks y commits

| Task | Nombre | Commit |
| ---- | ------ | ------ |
| 1 | Veredicto del carril `/proyecto/[boletin]` (12 ids, B.1) | `3169e9e` |
| 2 | `/agenda`, home, `/buscar`, `estado-actual` + date-only (7 ids, B.2–B.4) | `2553f51` |

## Verificación

- `OK-B1` y `OK-B2` (compuertas automated del plan) → pasan.
- 19/19 ids del grupo B presentes; E-032 con 15 filas (mínimo 12); `:429` con veredicto `captura`.
- `B.2.1` con 8 filas de datos, cada una con `¿se convierte de zona?` resuelta con evidencia.
- `grep -cE '[0-9]{7,8}-[0-9kK]'` → **0**; `grep -cE 'postgres(ql)?://'` → **0** (T-116-07).
- `git status --porcelain app/ packages/` → vacío (T-116-08).
- 20 anchors verificados por símbolo con `sed -n '<n>p' | grep -qF '<símbolo>'` → 20/20 tras la
  corrección de `sala-table-section.tsx`.

## Self-Check: PASSED

- `116-PARCIAL-B.md` existe en el phase dir.
- Commits `3169e9e` y `2553f51` resuelven en `git log --all`.
- Cero caracteres invisibles (rango `U+200B..U+200F`, `U+2060`, `U+FEFF`) en ambos artefactos.
