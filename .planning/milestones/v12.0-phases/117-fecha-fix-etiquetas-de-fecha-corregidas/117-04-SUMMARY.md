---
phase: 117-fecha-fix-etiquetas-de-fecha-corregidas
plan: 04
subsystem: frontend / home + /buscar · artefacto rector de cierre
tags: [FECHA-02, F-05, F-06, F-11, F-12, F-14, disposicion, cierre-de-fase]
requires:
  - "117-01 — fechaHechoCorta + idiom LOCKED 'según fuente al' en el chokepoint"
  - "117-02 / 117-03 — antes/después verbatim de 11 hallazgos"
  - "116-FECHAS-AUDIT.md §3 (los 14 hallazgos) y §6 (los 8 límites)"
provides:
  - "117-DISPOSICION.md — F-01..F-14 con disposición explícita, evidencia y commit"
  - "strip de transparencia de la home con el idiom LOCKED (F-06)"
  - "panel de la home en es-CL, sin ISO crudo (F-14)"
  - "chip de año de /buscar rotulado 'primer trámite {año}' (F-12)"
  - "113-INVENTARIO.md con el umbral REAL de 14 días (F-11 propagado)"
affects:
  - "Phase 125 — consume 117-DISPOSICION.md para re-verificar sobre el deploy"
tech-stack:
  added: []
  patterns:
    - "rótulo compuesto SOLO en la rama no-nula del ternario (mismo patrón que el lobby de 117-03)"
    - "premisa del audit VERIFICADA en el árbol antes de aplicar el fix sugerido"
    - "literales verificables por grep se mantienen fuera de la prosa de comentarios y docs"
key-files:
  created:
    - .planning/phases/117-fecha-fix-etiquetas-de-fecha-corregidas/117-DISPOSICION.md
  modified:
    - app/components/actualidad-module.tsx
    - app/components/actualidad-module.test.tsx
    - app/components/panel-actualidad.tsx
    - app/components/panel-actualidad.test.tsx
    - app/components/search-result-card.tsx
    - app/components/search-result-card.test.tsx
    - app/components/buscar-filtros.tsx
    - .planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md
decisions:
  - "F-12 se cierra ROTULANDO, no borrando: el grep vivo refutó la premisa 'chip inerte' del audit (buscar-filtros.tsx:495 pasa anio={row.anio})"
  - "el legend de la faceta de año se alinea al mismo idiom ('Año' → 'Año del primer trámite'): 'Año' pelado reproducía la misma ambigüedad que F-12 cierra"
  - "actualidad-module se corrige de copy pero NO se elimina: el veredicto de la fase debe valer si alguien re-monta el huérfano"
  - "el strip de frescura conserva fechaCorta (jamás fechaHechoCorta): su rama de hora real convertiría a la zona de Chile y correría el día de una fecha_captura"
metrics:
  duration: ~35 min
  tasks: 4
  files: 9
  completed: 2026-07-28
---

# Phase 117 Plan 04: Home, /buscar y el artefacto rector de disposición

Cierre de la fase: F-06, F-14, F-12 y el resto de F-05 corregidos, F-11 propagado al inventario
rector, y `117-DISPOSICION.md` con las 14 filas que hacen imposible una excepción silenciosa — cada
hallazgo del audit queda *corregido con evidencia* o *declarado con causa y destino*.

## Qué se hizo, por hallazgo (antes/después verbatim)

### F-06 — el strip de transparencia afirmaba que el dato había cambiado

`app/components/actualidad-module.tsx`, encabezado `:441` (el audit lo citó como `:437`;
re-localizado por grep) y render por fuente `:450-451`.

**Antes:**

```tsx
<span className="text-[13px] font-semibold text-foreground mr-1.5">
  Última actualización de datos
</span>
…
<span className="font-mono text-[13px] text-foreground">
  {fechaCorta(it.fecha)}
</span>
```

**Después:**

```tsx
<span className="text-[13px] font-semibold text-foreground mr-1.5">
  Última consulta a las fuentes
</span>
…
<span className="text-[13px] text-foreground">
  según fuente al{" "}
  <span className="font-mono">{fechaCorta(it.fecha)}</span>
</span>
…
<p className="w-full text-[13px] text-muted-foreground">
  Esta fecha indica cuándo consultamos cada fuente, no cuándo la fuente
  publicó o modificó el dato.
</p>
```

La columna leída son seis `max(fecha_captura)` de tablas NO-PII: el reloj de NUESTRO scraping. El
strip ahora lo dice. `fechaCorta` se **conserva** (jamás `fechaHechoCorta`: su rama de hora real
convertiría a la zona de Chile y correría el día de una `fecha_captura` — el defecto preciso que la
fase existe para impedir). La palabra prohibida no entró en el copy: el guard anti-insinuación queda
verde y hay un assert negativo por regex sobre el `textContent` renderizado.

El test asserta el nombre de la fuente y el idiom **por separado** — el separador del strip es un
`<span aria-hidden>` hermano, así que `{fuente} · según fuente al {fecha}` no existe como substring
contiguo del `textContent`.

**Commits:** `649fde3` (RED) · `ff59771` (GREEN)

### F-05 (resto) — las fechas del hecho del módulo huérfano

| línea | antes | después |
|---|---|---|
| `:202-203` (votación) | `` `${fechaCorta(it.fecha)} · ${camaraLabel(it.camara)}` `` / `` `Votación del ${fechaCorta(it.fecha)}` `` | los mismos con `fechaHechoCorta(it.fecha)` |
| `:318` (urgencia, `tramitacion_evento.fecha` vía `it.desde`) | `desde {fechaCorta(it.desde)}` | `desde {fechaHechoCorta(it.desde)}` |

Asserts vivos: `2023-11-17T00:14:41Z` → **16 nov 2023** (día chileno real); `2026-07-22T00:00:00Z`
(date-only disfrazada) → **22 jul 2026**, sin corrimiento. Los formatters `FECHA_CHILE` `:46`,
`DOW_CHILE` `:53` y `fmt` `:95` son correctos (timestamp real, tz explícita) y **no se tocaron**.

**Commit:** `ff59771`

### F-06 (parte declarativa) — el huérfano queda declarado en su propio JSDoc

Se añadió al JSDoc de cabecera:

> ESTADO (Phase 117, F-06): este componente está **HUÉRFANO** — la home lo tiene superseded por
> `panel-actualidad.tsx` (E-055 del inventario 113) y hoy no lo monta ninguna ruta. 117 corrige
> igualmente su copy de fechas porque el veredicto de la fase debe valer si alguien lo re-monta; su
> ELIMINACIÓN se DECLARA fuera de alcance (117-CONTEXT §Deferred Ideas).

El componente **no se borró**.

### F-14 — el panel de la home rendía un ISO técnico a público general y prensa

`app/components/panel-actualidad.tsx`, `rotuloFecha` `:100-108`.

**Antes:** `return diaCalendarioCitacion(iso);` ⇒ el tile rendía literalmente
`Fuente: Agenda del Congreso · datos al 2026-08-10` (capturado por el test RED).

**Después:** `return badgeFechaCitacion(iso);` ⇒ `datos al 10-ago`.

El **ruteo por tipo no se tocó** (el audit lo declara correcto y documentado) y el `null` sigue siendo
omisión honesta: una señal con `fecha_max` NULL (`agrupacion_materia`) omite el rótulo, no lo rellena.
Al comentario `:95-98` se le sumó el matiz que PROD aportó: **todas** las señales llegan a medianoche
UTC —no sólo las `agenda_*`—, así que la rama `fechaCorta` formatea date-only de facto, y lo que la
mantiene correcta es el `timeZone: "UTC"` explícito de 117-01, no el huso del entorno.

**Commits:** `1047bfa` (RED) · `1a9200b` (GREEN)

### F-12 — el chip de año de /buscar decía un año pelado

**Premisa del audit CORREGIDA, verificada en el árbol:** el audit lo declaró "hoy inerte" porque su
grep se limitó a `app/buscar/`. El grep vivo lo refuta — `buscar-filtros.tsx:495` **sí** pasa
`anio={row.anio}` a `SearchResultCard`, y la misma columna alimenta el orden (`:71-76`) y la faceta
de filtro (`:177`, `:201-202`). La rama "borrar la prop muerta" **no aplicó**.

**Antes** (`search-result-card.tsx:71`): `{anio != null ? String(anio) : "Sin dato"}`

**Después:** `` {anio != null ? `primer trámite ${anio}` : "Sin dato"} ``

El rótulo se compone **sólo en la rama no-nula** del ternario —mismo tratamiento que el rótulo de
lobby en 117-03— con assert negativo obligatorio `not.toMatch(/primer trámite Sin dato/)`. El estado
vacío no se tocó: ya era honesto (`grep -c "Sin dato"` = 2, sin cambios). El JSDoc `:35-38` ahora
nombra el rótulo renderizado. El idiom ya estaba en el fixture `(1d)` del linter (117-01).

`grep -c "primer trámite" search-result-card.tsx` = **1** (sólo el JSX; la prosa del JSDoc no
re-introduce el literal).

**Commits:** `b9ce5dc` (RED) · `828e87f` (GREEN)

### F-11 — la propagación documental al inventario rector

`113-INVENTARIO.md` tenía el umbral erróneo en dos lugares (`:663` de la ficha del badge y `:1069` de
la tabla C1), heredado del JSDoc que 117-01 corrigió. Ambos citan ahora **14 días** con el código
real (`STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000`, `app/lib/format.ts:10`) y su razón (cadence de
ingesta semanal). **Cero cambio de comportamiento.**

**Commits:** `fe286cf` · `be66bb9`

### El artefacto rector — `117-DISPOSICION.md`

195 líneas, front-matter (`phase: 117`, `requirement: FECHA-02`, `consumido_por: [125]`), y:

- **§1** tabla con **las 14** filas (`id | severidad | disposición | archivo:línea | ANTES | DESPUÉS | commit`), verbatim tomados de los tres SUMMARY previos y del trabajo de este plan. Auto-check: 14 ids distintos, **0** celdas vacías.
- **§2** ocho declarados con causa y destino: F-04 (DML de las 2 filas `2626-05-25` → deuda de ingesta), F-05 (dos semánticas en una columna → ingesta), F-06/E-003/E-008 (huérfanos no se eliminan), F-08 (verificación contra dato real pendiente del flip MONEY), F-11 (14 días = decisión de producto), **F-07 (la divergencia de dos layouts, dos fixes, DECLARADA)**, **F-12 (corrección de premisa, para que 125 no la re-descubra)** y **FECHA-117-OFFENDER-01 con la decisión A del orquestador espejada verbatim**.
- **§3** verificación de cierre con los comandos y sus salidas.
- **§4** SC1..SC4 del ROADMAP, cada uno con evidencia.
- **§5** límites: el deploy viaja con 125; la verificación sobre HTML renderizado la hace 125.

**Commit:** `e07a13a`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Bloqueante] la ruta del inventario del plan no existía**

- **Found during:** Task 4 (a).
- **Issue:** el plan apunta a `.planning/phases/113-inventario-de-superficies/113-INVENTARIO.md`; el directorio real es `113-inv-inventario-rector-de-superficies/`. El grep de F-11 fallaba con "No such file".
- **Fix:** ruta re-localizada con `find`. El archivo correcto se corrigió en sus dos ocurrencias (`:663`, `:1069`) — el plan citaba §3.1.1, pero el error estaba propagado en dos filas de tablas distintas, y se corrigieron **ambas**.
- **Files modified:** `.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md`
- **Commit:** `fe286cf`

**2. [Rule 3 — Bloqueante] el criterio `grep -ciE "48 *h"` = 0 mordía la prosa de la propia corrección**

- **Found during:** Task 4, verificación de acceptance criteria.
- **Issue:** la nota que explica *por qué* el valor viejo era erróneo citaba el literal, así que el criterio devolvía 1 con el documento ya corregido. Mismo modo de falla que las desviaciones de 117-01/02/03.
- **Fix:** la mención en prosa pasó a "un umbral de dos días", sin perder la explicación. El criterio queda en 0 y sigue siendo verificable por grep.
- **Files modified:** `113-INVENTARIO.md`
- **Commit:** `be66bb9`

**3. [Rule 2 — Funcionalidad faltante] el `legend` de la faceta de año reproducía la ambigüedad de F-12**

- **Found during:** Task 3.
- **Issue:** el plan permite tocar `buscar-filtros.tsx` "sólo si la etiqueta de la faceta también muestra el año pelado en superficie ciudadana". La faceta SÍ estaba rotulada… con `Año` pelado, que es exactamente la lectura que F-12 cierra ("el año del proyecto"). Rotular el card y dejar la faceta ambigua habría dejado dos rótulos contradictorios sobre la misma columna en la misma pantalla.
- **Fix:** `<legend>Año</legend>` → `<legend>Año del primer trámite</legend>`, alineado al mismo idiom. Los chips de la faceta (incluido `Sin dato`) no se tocaron.
- **Files modified:** `app/components/buscar-filtros.tsx`
- **Commit:** `828e87f`

Ninguna desviación requirió decisión de arquitectura (cero Rule 4). Ningún paquete se instaló.

## Verificación

| Check | Resultado |
|---|---|
| `pnpm test` (raíz: app + 18 paquetes) | **exit 0** — app **1543/1543** verde en 107 archivos (base 1530 tras 117-03 → +13) |
| `pnpm -r exec tsc -b` | **exit 0** |
| linter anti-insinuación | **40/40** verde con `SUPERFICIES_FECHA` sumado |
| `grep -c "Última actualización de datos" actualidad-module.tsx` | **0** |
| `grep -c "Última consulta a las fuentes" actualidad-module.tsx` | **1** |
| `fechaCorta(it.fecha)` no-comentado en `actualidad-module.tsx` | **1** — y es el strip de frescura; los renders de hecho usan `fechaHechoCorta` |
| `grep -c "badgeFechaCitacion" panel-actualidad.tsx` | **4** (≥ 1) |
| `grep -c "primer trámite" search-result-card.tsx` | **1** |
| `grep -c "Sin dato" search-result-card.tsx` | **2** (sin cambios respecto al estado previo) |
| `grep -n "anio=" buscar-filtros.tsx` | `:495` — el call-site vivo NO se eliminó |
| `grep -ciE "48 *h" 113-INVENTARIO.md` | **0**; aparece **14 días** con cita a `app/lib/format.ts:10` |
| ids distintos en `117-DISPOSICION.md` | **14** (`F-01`..`F-14`) |
| celdas vacías en §1 | **0** |
| `grep -rn "Actualizado"` (no-test, no-comentario) en `app/components` + `app/app` | **vacío** |
| `grep -rn "corte al"` (no-test) en `app/components` | **vacío** |
| `grep -rn "según fuente al"` (no-test) en `app/components` | **13** (≥ 1) |
| `grep -rniE "captura" pelado` (no-test) | sólo identificadores `fecha_captura` y comentarios — cero copy renderizado |
| `git diff --name-only d560d64..HEAD \| grep -iE "\.env\|gate"` | **NINGUNO** |
| `git diff --diff-filter=D` sobre los 8 commits | cero archivos eliminados |

## Commits

| Hash | Gate | Mensaje |
|---|---|---|
| `649fde3` | Task 1 RED | asserts de F-06 y F-05 en el emisor huérfano |
| `ff59771` | Task 1 GREEN | strip `Última consulta a las fuentes` + idiom LOCKED + `fechaHechoCorta` |
| `1047bfa` | Task 2 RED | `rotuloFecha` de `agenda_*` debe rendir `10-ago` |
| `1a9200b` | Task 2 GREEN | `badgeFechaCitacion` en la rama de agenda |
| `b9ce5dc` | Task 3 RED | rótulo del chip de año + negativo `primer trámite Sin dato` |
| `828e87f` | Task 3 GREEN | `primer trámite {año}` + legend de la faceta alineado |
| `fe286cf` | Task 4 (a) | F-11 propagado: 14 días en el inventario rector |
| `be66bb9` | Task 4 (a) fix | evitar el literal del umbral viejo en la prosa |
| `e07a13a` | Task 4 (b) | `117-DISPOSICION.md` con los 14 hallazgos |

## Known Stubs

Ninguno. Lo que queda abierto está **declarado con causa y destino** en `117-DISPOSICION.md` §2 y es
deuda de ingesta, de producto o de otra fase — no un stub de esta:

- las 2 filas corruptas de `tramitacion_evento` (`2626-05-25`) siguen en la base; 117 sólo las filtra
  del render;
- la columna `tramitacion_evento.fecha` sigue mezclando dos semánticas; 117 mitiga en presentación;
- `actualidad-module.tsx` (E-008) y E-003 siguen en el árbol como huérfanos, con su estado declarado
  en el JSDoc;
- F-08 quedó corregido con el gate MONEY OFF: `contrato` y `aporte` tienen 0 filas en PROD, así que
  su verificación contra dato real es del flip;
- el umbral de 14 días se conserva: cambiarlo es decisión de producto.

## Threat Flags

Ninguna. El diff es presentacional + tests + documentación: cero superficie de red, auth, acceso a
archivos o schema. T-117-10 mitigado (auto-check de 14 ids distintos + cero celdas vacías en §1);
T-117-11 mitigado (F-11 propagado con cita al código real); T-117-SC respetado (ningún paquete
instalado en toda la fase).

## Self-Check: PASSED

Los 9 commits (`649fde3`, `ff59771`, `1047bfa`, `1a9200b`, `b9ce5dc`, `828e87f`, `fe286cf`,
`be66bb9`, `e07a13a`) existen en el árbol de git; `117-DISPOSICION.md` existe en disco con 195 líneas
y los 14 ids; los 8 archivos declarados como modificados existen en disco.
