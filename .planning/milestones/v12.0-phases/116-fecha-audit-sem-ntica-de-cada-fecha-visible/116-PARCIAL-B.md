---
phase: 116
plan: 03
grupo: B
consumido_por: [116-04]
regimen: solo-lectura
fecha_corrida: 2026-07-28
base_compartida: 116-FORMATTERS.md
---

# 116-PARCIAL-B — Veredicto por emisor×fecha del grupo B

Grupo B del catálogo `113-INVENTARIO.md` §3.0: carril proyecto (`/proyecto/[boletin]`), `/agenda`,
home `/` y `/buscar`. **19 ids.**

**Régimen: SOLO LECTURA.** Cero cambio de código de producto, cero flag tocado. Todo fix va a
Phase 117. El veredicto de CAPA de cada formatter y el del chokepoint `ProvenanceBadge` se
**aplican desde `116-FORMATTERS.md`** (§1.1 y §2.2); no se re-derivan aquí.

---

## B.0 Reglas de decisión (LOCKED, aplicadas sin excepción en B.1 y B.2)

Declaradas verbatim para que este documento sea legible por sí solo (idénticas a `116-PARCIAL-A.md`
§A.0):

1. Toda fecha que llega vía la prop `capturedAt` del `ProvenanceBadge` → **captura** por REGLA
   LOCKED (113 §3.1.1), sin más análisis. El veredicto por call-site ya está emitido en
   `116-FORMATTERS.md` §2.2: se **referencia**, no se recalcula.
2. Toda OTRA fecha exige rastreo explícito hasta su columna o RPC. Si el rastreo no llega a una
   columna concreta → **ambigua**, causa `origen no rastreable estáticamente`. Jamás se adivina.
3. Fecha cuyo origen es `fecha_captura` (o derivado: `fechaCaptura`, `capturedAt`,
   `ingestado_hasta`) presentada SIN el idiom "según fuente al…" (o equivalente aprobado) →
   **captura** + `¿miente?` = `sí — presentada como el hecho`. Hallazgo para 117.
4. Palabra "captura" **pelada** en copy visible → `sí — término prohibido (v10.0)`.
5. Fecha date-only sometida a conversión de zona → `sí — conversión tz sobre date-only`
   (gotcha mayor v9.0 pasada 2).

Conjunto cerrado de VEREDICTO: `hecho` | `captura` | `ambigua`.

**Nota de capa heredada de `116-FORMATTERS.md` §1.1** (se arrastra a toda fila que use
`fechaCorta`): `fechaCorta` (`app/lib/format.ts:21`) **no fija `timeZone`** — su corrección
depende de que el runtime sea UTC. `fechaCortaSegura` (`format.ts:121`) es `seguro` para el
contrato date-only (recorta el ISO antes de `new Date`), pero cuando su entrada es un
**`timestamptz` real** ese recorte devuelve el **día UTC**, no el día chileno.

**Nota de tipos LOCKED para este grupo** (verificada en el schema, no supuesta):

| columna | tipo real | evidencia |
|---|---|---|
| `tramitacion_evento.fecha` | `timestamptz` | `supabase/migrations/0008_tramitacion.sql:72` |
| `votacion.fecha` | `timestamptz` | `supabase/migrations/0008_tramitacion.sql:40` |
| `lobby_audiencia.fecha` | `timestamptz` | `supabase/migrations/0021_lobby.sql:41` |
| `lobby_en_tramitacion.fecha_reunion` | `timestamptz` | `supabase/migrations/0048_lobby_en_tramitacion.sql:82` |
| `lobby_menciones_de_boletin.fecha` | `timestamptz` | `supabase/migrations/0063_lobby_menciones_una_fila_por_audiencia.sql:57` |
| `cruces_de_proyecto.evidencia[].fecha` | `timestamptz` serializado a `jsonb` (de `lobby_audiencia.fecha`) | `supabase/migrations/0049_cruces_de_proyecto.sql:67,98` |
| `citacion.fecha`, `sesion_sala.fecha`, `sesion_tabla_item` | **date-only medianoche UTC** | ver `### B.2.1` |

⇒ El **HALLAZGO MAYOR del grupo A se propaga al grupo B**: todo `timestamptz` de hecho renderizado
con `fechaCorta` (runtime UTC, sin `timeZone`) o con `fechaCortaSegura` (slice ISO UTC) muestra el
**día UTC**, así que un hecho chileno posterior a las 21:00 CL se rinde con el **día siguiente**.
Esto es ambigüedad de DÍA, no de semántica: el veredicto sigue siendo `hecho`, y la columna
`¿miente?` lo registra.

---

## B.1 Carril /proyecto/[boletin]

Columnas: `id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO |
etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate`.

| id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO | etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate |
|---|---|---|---|---|---|---|---|---|
| E-010 | `/proyecto/[boletin]` | `timeline-view.tsx:29` (helper `mesAnio` `:33`, render vía `periodoLinea` `:221,:222`) | `mesAnioFormatter` (`Intl` es-CL `month:"short"`+`year:"numeric"`, **sin `timeZone`**) | `tabla.tramitacion_evento.fecha` (`timestamptz`) vía `PeriodoUrgencia.desde/hasta` (`:101,:102`), construidos con `fechaValida` (`:39`) | hecho | `Urgencia {tipo}: {N} eventos en {mesX}` o `… entre {mesX} y {mesY}` (`:219,:223`); si el run no tiene fecha válida el rango se OMITE (`:220`, honest-state) | sí — ambigüedad de MES en el borde: `mesAnioFormatter` no fija `timeZone` (veredicto de capa `ambiguo`, `116-FORMATTERS.md` §1.1) y la entrada es `timestamptz`; un evento del último instante de mes en Chile cae en el mes UTC siguiente | — |
| E-020 | `/proyecto/[boletin]#lobby` | `lobby-menciones-de-boletin.tsx:129` (fecha derivada en `:110` `const fecha = fechaValida(row.fecha)`) | `fechaCorta` (import `:4`) | `RPC:lobby_menciones_de_boletin.fecha` ← `tabla.lobby_audiencia.fecha` (`timestamptz`) | hecho | `(sin rótulo)` — `{fechaCorta(fecha)} · ` en `<span className="font-mono text-sm text-muted-foreground">` (`:128-130`), abriendo la línea antes del nombre del parlamentario | sí — ambigüedad de DÍA: origen `timestamptz` con hora real + `fechaCorta` sin `timeZone` (runtime UTC) → audiencia vespertina chilena se rinde con el día siguiente. Mismo defecto que E-002 (grupo A) | — |
| E-041 | `/proyecto/[boletin]#lobby` | `lobby-en-tramitacion.tsx:144` (fecha derivada en `:123` `const fecha = fechaValida(row.fecha_reunion)`) | `fechaCorta` (import `:2`) | `RPC:lobby_en_tramitacion.fecha_reunion` (`timestamptz`, `0048:82`) ← `tabla.lobby_audiencia.fecha` | hecho | `Reunión registrada el {fechaCorta(fecha)} · semana {row.semana_iso}` (`:144`); sin fecha parseable: `Reunión registrada · semana {…}` (`:145`, honest-state) | sí — misma ambigüedad de DÍA (origen `timestamptz`, `fechaCorta` sin `timeZone`). El rótulo del hecho SÍ es explícito y sin verbo causal (comentario `:136-139`) | — |
| E-027 | `/proyecto/[boletin]` (sección "Valida este dato en la fuente") | `validacion-fuente.tsx:226` (llamada `toLocaleDateString`; `timeZone: "America/Santiago"` en `:230`; helper `formatFechaCaptura` `:224`; valor calculado en `:127`, render en `:140`) | `formatFechaCaptura` (`toLocaleDateString("es-CL")`, `timeZone` **explícita** `America/Santiago`) | `tabla.proyecto.fecha_captura` — llega por prop `fecha_captura` (`:32`, doc `:31` "ISO string de fecha_captura del proyecto"), pasada desde `app/proyecto/[boletin]/page.tsx:691` | captura | `según fuente al {fechaDisplay}` — `<p className="text-xs text-muted-foreground">` (`:138-141`); el valor va en `<span className="font-mono">` | **no** — es el ÚNICO emisor del carril proyecto que usa el **idiom aprobado "según fuente al…"** (regla 3 satisfecha). **Tipo del valor: `timestamp` real, NO date-only** (`proyecto.fecha_captura` = `timestamptz` de scraping) ⇒ convertir a `America/Santiago` es CORRECTO y no viola la regla LOCKED de date-only. Veredicto de capa `seguro` (`116-FORMATTERS.md` §1.1) | — |
| E-027 | `/proyecto/[boletin]` (bloque "Respaldo R2") | `validacion-fuente.tsx:239` (llamada `toLocaleDateString`; `timeZone: "America/Santiago"` en `:243`; helper `formatFetchedAt` `:237`; render en `:190`) | `formatFetchedAt` (`toLocaleDateString("es-CL")`, `timeZone` explícita `America/Santiago`) | `props.snapshot.fetched_at` (`:22`) ← `tabla.source_snapshot.fetched_at`, resuelto en `page.tsx` | captura | `Respaldo del {formatFetchedAt(respaldo.fetched_at)} · hash {…}` (`:188-196`) seguido de `Esto decía la fuente ese día.` (`:198`) | no — `fetched_at` es reloj de scraping y el copy lo declara como tal sin fingir que es el hecho: "Respaldo del …" + "Esto decía la fuente ese día" es equivalente aprobado del idiom. **Tipo: `timestamp` real** ⇒ la conversión a `America/Santiago` es correcta. Sin "captura" pelado (regla 4 satisfecha) | — |
| E-035 | `/proyecto/[boletin]#autores` | `autor-row.tsx:58` (expresión `:58-60`) | `relativeTimeEs` vía `ProvenanceBadge`, `densidad="lista"` (`:57`) | `tabla.proyecto_autor.fecha_captura` (`:31`) — ver `116-FORMATTERS.md` §2.2 fila 3 | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`); en `densidad="lista"` la leyenda viaja en tooltip | sí — idiom no aprobado del chokepoint ("Actualizado" sugiere que el dato cambió, no que lo miramos). Candidato transversal de `116-FORMATTERS.md` §2 | — |
| E-035 | `/proyecto/[boletin]#autores` | `autor-row.tsx` (archivo completo, 69 líneas) | `(ninguno)` | `tabla.proyecto_autor` — el JSX solo emite `autor.autor_crudo` (`:45,:52`); `tabla.proyecto.enlace` se usa como `sourceUrl` (`:66`), **no como fecha** | — | `(sin otra fecha renderizada)` | no — se declara para cerrar el ítem: `AutorRow` NO emite ninguna fecha del hecho; su única fecha es la del badge (fila anterior) | — |
| E-038 | `/proyecto/[boletin]` (timeline capa-2) | `timeline-event.tsx:82` (import `:4`; fecha derivada en `:47` `const fecha = evento.fecha ? new Date(evento.fecha) : null`) | `fechaCorta` | `tabla.tramitacion_evento.fecha` (`timestamptz`, `0008:72`) | hecho | `(sin rótulo)` — `{fechaCorta(fecha)}` en `<span className="font-mono text-sm text-muted-foreground leading-none">` (`:81-83`), junto al `CamaraChip`; sin fecha, el span se omite entero | sí — ambigüedad de DÍA: `timestamptz` + `fechaCorta` sin `timeZone` (runtime UTC) → evento chileno vespertino se rinde con el día siguiente | — |
| E-043 | `/proyecto/[boletin]` (header) | `ficha-header.tsx:66` (`capturedAt` derivado en `:19-21`) | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.proyecto.fecha_captura` — ver `116-FORMATTERS.md` §2.2 fila 8 | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint | — |
| E-043 | `/proyecto/[boletin]` (header) | `ficha-header.tsx` (archivo completo, 94 líneas) | `(ninguno)` | `tabla.proyecto` — el header emite etapa, cámara, título, boletín, chips y autores; **cero fecha del hecho** | — | `(sin fecha del hecho renderizada)` | no — se declara para cerrar el ítem: la única fecha del header es la del badge (fila anterior) | — |
| E-044 | `/proyecto/[boletin]#cruces` | `cruces-de-proyecto.tsx:168` (import `:5`) | `fechaCortaSegura` | `RPC:cruces_de_proyecto.evidencia[].fecha` (jsonb, `0049:67,98`) ← `tabla.cruce_senal.evidencia` ← `tabla.lobby_audiencia.fecha` (`timestamptz`) | hecho | `Reunión registrada el {fechaCortaSegura(item.fecha)}` (`:168`) en `<span className="font-mono text-xs text-muted-foreground">`; si la fuente no publica fecha, la línea se OMITE entera (`:167`, honest-state; comentario `:164-166`) | sí — ambigüedad de DÍA: `fechaCortaSegura` es `seguro` para date-only, pero aquí su entrada es un **`timestamptz` serializado**, y el `slice(0,10)` devuelve el **día UTC** (mismo defecto que E-001 del grupo A). El rótulo del hecho es explícito y sin verbo causal | CRUCES (ON — superficie viva) |
| E-044 | `/proyecto/[boletin]#cruces` | `cruces-de-proyecto.tsx:178` (comentario `:173-174`) | `relativeTimeEs` vía `ProvenanceBadge`, `densidad="lista"` (`:177`) | `RPC:cruces_de_proyecto.fecha_captura` ← `tabla.cruce_senal.fecha_captura` — ver `116-FORMATTERS.md` §2.2 fila 7 | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint, **agravado en este bloque**: la `fecha_captura` es la del **FULL REBUILD diario del pipeline de cruces** (`0049:67` "frescura del rebuild diario (WR-02/F41)"), no la de la fuente original ni la de la reunión ⇒ "Actualizado hace 2 h" describe el rebuild, no la fuente; un "según fuente al…" literal aquí también sería impreciso. El llamante ya evitó el error (a): el comentario `:173-174` declara `NO item.fecha` | CRUCES (ON — superficie viva) |
| E-045 | `/proyecto/[boletin]` (stepper capa-1) | `tramitacion-stepper.tsx:99` (import `:1`; `d` derivado en `:79` `const d = fechaValida(evento.fecha)`) | `fechaCorta` | `tabla.tramitacion_evento.fecha` (`timestamptz`) | hecho | `(sin rótulo)` — `{fechaCorta(d)}` en `<span className="ml-2 font-mono text-xs text-muted-foreground">` (`:98-100`), pegada a `{evento.descripcion}`; omisión honesta si la fecha no es válida (comentario `:96`) | sí — ambigüedad de DÍA (`timestamptz` + `fechaCorta` sin `timeZone`, runtime UTC) | — |
| E-045 | `/proyecto/[boletin]` (stepper capa-1, línea de urgencia vigente) | `tramitacion-stepper.tsx:194` | `fechaCorta` | `estado.urgenciaVigente.desde` ← derivado de `tabla.tramitacion_evento.fecha` (`timestamptz`) del evento de urgencia vigente | hecho | `Urgencia {estado.urgenciaVigente.tipo} vigente desde el {fechaCorta(estado.urgenciaVigente.desde)}.` (`:192-196`), con el valor en `<span className="font-mono">` | sí — misma ambigüedad de DÍA. Semántica **distinta** de la fila anterior (inicio de vigencia de urgencia vs fecha del hito), por eso lleva fila propia; el rótulo del hecho es explícito | — |
| E-048 | `/proyecto/[boletin]` (bloque idea matriz) | `app/proyecto/[boletin]/page.tsx:398` (badge renderizado por `idea-matriz-block.tsx:49`) | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.proyecto_ficha.fecha_captura` (`ficha?.fecha_captura`, leída por `leerFicha`) | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) + `{sourceName}`. **Contexto que lo rodea:** `<blockquote>` con la cita literal de la idea matriz — el badge afirma la frescura de la **extracción de la ficha**, no la del texto legal citado. `sourceUrl: null` por diseño (comentario `:400-403`: `texto_r2_path` es key R2 interna, no enlace público) | sí — idiom no aprobado del chokepoint, **agravado por el contexto**: junto a una cita textual, "Actualizado hace X" se lee como "esta cita cambió hace X", cuando la cita es inmutable y lo que cambió es cuándo la extrajimos | — |
| E-048 | `/proyecto/[boletin]` (heading "Tramitación") | `app/proyecto/[boletin]/page.tsx:504` | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.tramitacion_evento.fecha_captura` **máxima** del set (`masReciente`, reduce en `:492-497`) — ver `116-FORMATTERS.md` §2.2 fila 1, que lo cataloga como `tabla.source_snapshot`; **DIFERENCIA DECLARADA**, ver nota ¹ | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`), a la derecha del `<h2>Tramitación</h2>` (`:499-508`). `sourceUrl={null}` (`:506`) ⇒ **badge sin link** (el link vive por evento, comentario `:488-491`) | sí — idiom no aprobado del chokepoint, **agravado por ser un MÁXIMO de un set**: la fecha declara la frescura del evento más recientemente scrapeado, no la de toda la tramitación; un evento antiguo re-scrapeado hoy hace que la sección entera diga "Actualizado hace 0 min" | — |
| E-056 | `/proyecto/[boletin]#votaciones` | `votacion-card.tsx:39` (import `:12`; `fecha` derivada en `:22` `const fecha = votacion.fecha ? new Date(votacion.fecha) : null`) | `fechaCorta` | `tabla.votacion.fecha` (`timestamptz`, `0008:40`) | hecho | `(sin rótulo)` — `{fechaCorta(fecha)}` en `<span className="font-mono text-sm text-muted-foreground leading-none">` (`:38-40`), junto al `CamaraChip`; sin fecha, el span se omite | sí — ambigüedad de DÍA: `votacion.fecha` es `timestamptz` y `fechaCorta` no fija `timeZone` (runtime UTC) → una votación chilena de la tarde-noche se rinde con el día UTC siguiente. **Mismo defecto que E-001** (grupo A, `votos-por-parlamentario.tsx:528`): es la MISMA columna vista desde dos carriles | — |
| E-056 | `/proyecto/[boletin]#votaciones` | `votacion-card.tsx:97` (`capturedAt` derivado en `:23-25`) | `relativeTimeEs` vía `ProvenanceBadge`, `densidad="lista"` (`:95`) | `tabla.votacion.fecha_captura` — ver `116-FORMATTERS.md` §2.2 fila 14 | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint. Nota positiva: la fecha del HECHO (`:39`) se rinde **fuera** del badge — separación correcta, cero `HECHO-COMO-CAPTURA` | — |
| E-058 | `/proyecto/[boletin]` (bloque idea matriz) | `idea-matriz-block.tsx:49` (`<ProvenanceBadge {...provenance} />`; prop declarada en `:25`) | `relativeTimeEs` vía `ProvenanceBadge` (consumidor de props) | `props.provenance` ← construido por el llamante `app/proyecto/[boletin]/page.tsx:396-405` ⇒ `tabla.proyecto_ficha.fecha_captura`. **El veredicto vive en la fila de E-048 `:398`**; aquí no se duplica | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`), montado bajo el `<blockquote>` (`:47-51`). El componente **no emite copy de fecha propio** | no — propagación sin copy propio; el hallazgo efectivo es el de E-048 `:398` | — |
| E-058 | `/proyecto/[boletin]` (rama degradada) | `idea-matriz-block.tsx:29-41` (archivo completo, 53 líneas) | `(ninguno)` | `tabla.proyecto_ficha.idea_matriz` — rama `null` | — | `Idea matriz no disponible` + `El texto íntegro de este proyecto no pudo obtenerse de la fuente oficial, por lo que no se ha extraído su idea matriz. Puedes consultar el proyecto completo en la fuente original.` (`:34-39`) | no — **cero fecha en la rama degradada** (ni badge: `provenance` solo se usa cuando hay cita). Se declara para cerrar el ítem: la degradación honesta no fabrica fecha | — |

¹ **Diferencia declarada respecto de `116-FORMATTERS.md` §2.2 fila 1.** El documento base atribuye
`page.tsx:504` a `tabla.source_snapshot.fecha_captura`. El rastreo vivo del 2026-07-28 muestra que
el valor es `masReciente.fecha_captura`, donde `masReciente` es un `reduce` sobre `eventos:
TramitacionEventoRow[]` (`page.tsx:492-497`) ⇒ la columna real es
**`tabla.tramitacion_evento.fecha_captura`**. El veredicto (`captura correcta`, cero
`HECHO-COMO-CAPTURA`) NO cambia; cambia la columna citada. Se registra para que el plan 04 corrija
la atribución.

### B.1.1 Notas de anchors re-localizados (diferencias vs. el plan)

Todo anchor de esta sección fue re-localizado el 2026-07-28 con
`grep -nE "fechaCorta|fechaCortaSegura|relativeTimeEs|Intl\.DateTimeFormat|toLocaleDateString|capturedAt|fecha_captura|mesAnioFormatter" <archivo>`.

| símbolo | línea en `116-03-PLAN.md` | línea OBSERVADA | naturaleza |
|---|---|---|---|
| `mesAnioFormatter` (`timeline-view.tsx`) | `:29` | **`:29`** (constructor); render real en `:221,:222` vía `periodoLinea` | el plan ancló el formatter, no el render; **ambos se citan** |
| `fechaCorta` (`timeline-event.tsx`) | `:82` (import `:4`) | **idénticas** | sin diferencia |
| `fechaCorta` (`lobby-menciones-de-boletin.tsx`) | `:129` | **`:129`** | sin diferencia; se añade `:110` (derivación de `fecha`) |
| `fechaCorta` (`lobby-en-tramitacion.tsx`) | `:144` | **`:144`** | sin diferencia; **el origen NO es `.fecha` sino `row.fecha_reunion`** (`:123`) — diferencia SUSTANTIVA respecto del plan, que citaba `RPC:lobby_en_tramitacion.fecha` |
| `toLocaleDateString` (`validacion-fuente.tsx`) | `:226,:239` (`timeZone` `:230,:243`) | **idénticas** | sin diferencia (el plan ya incorporó la corrección de `116-FORMATTERS.md` §1.2) |
| `props` (`autor-row.tsx`) | `:57` | **`:57`** es `densidad="lista"`; el `capturedAt` real está en **`:58-60`** | off-by-one: el plan ancló la línea anterior del mismo JSX |
| `props` (`ficha-header.tsx`) | `:66` | **`:66`** (`capturedAt={capturedAt}`); derivación en `:19-21` | sin diferencia |
| `fechaCortaSegura` (`cruces-de-proyecto.tsx`) | `:168` ; `capturedAt` `:178` (comentario `:173`) | **idénticas** (`:168`, `:178`, comentario `:173-174`) | sin diferencia |
| `fechaCorta` (`tramitacion-stepper.tsx`) | `:99`, `:194` | **idénticas**; `d` derivado en `:79` | sin diferencia |
| `capturedAt` (`page.tsx`) | `:398`, `:504` | **idénticas** | sin diferencia de línea; **sí** de columna atribuida en `:504` (nota ¹) |
| `fechaCorta` / `capturedAt` (`votacion-card.tsx`) | `:39`, `:23`, `:97` | **idénticas** | sin diferencia |
| `idea-matriz-block.tsx` | "archivo completo" | badge en **`:49`**, prop en **`:25`** | el plan no dio anchor; se fija aquí |

**Sin hallazgos:** E-027 (ambas filas — único emisor del carril con idiom aprobado en las dos), y
las filas declarativas sin fecha renderizada de E-035, E-043 y E-058 (rama degradada).
Todos los demás ids del carril proyecto (E-010, E-020, E-038, E-041, E-044, E-045, E-048, E-056,
E-058 badge) llevan al menos un `sí` en la columna `¿miente o es ambigua?`.

---

## B.2 /agenda, home, /buscar y estado-actual

Misma tabla de 9 columnas y **mismas reglas de decisión de `## B.0`** (no se re-declaran).

| id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO | etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate |
|---|---|---|---|---|---|---|---|---|
| E-032 | `/proyecto/[boletin]` (bloque "¿Dónde está hoy?") | `estado-actual-block.tsx:397` | `fechaCorta` (import `:2`) | `tabla.tramitacion_evento.fecha` (`timestamptz`) vía `ultimoHito.fecha` | hecho | `Último hito: {ultimoHito.descripcion} — {fechaCorta(ultimoHito.fecha)}` (`:395-398`), fecha en `<span className="font-mono">` | sí — ambigüedad de DÍA (`timestamptz` + `fechaCorta` sin `timeZone`, runtime UTC) | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:413` | `fechaCorta` | `tabla.tramitacion_evento.fecha` vía `urgenciaEstado.desde` (derivado en `:326`) | hecho | `Urgencia {tipo} vigente desde el {fechaCorta(urgenciaEstado.desde)} (…)` (`:411-415`) | sí — misma ambigüedad de DÍA | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:417` | `relativeTimeEs` (import `:2`) | mismo `urgenciaEstado.desde` ← `tabla.tramitacion_evento.fecha` | hecho | `(` + `{relativeTimeEs(urgenciaEstado.desde)}` + `).` (`:416-420`) — paréntesis relativo tras la fecha absoluta | sí — **uso de `relativeTimeEs` sobre una fecha del HECHO**, no sobre `fecha_captura`. El formatter existe para el reloj de scraping (`116-FORMATTERS.md` §1.1: "el nombre del parámetro `capturedAt` es load-bearing") y a ≥7 d delega en `fechaCorta`, duplicando la misma fecha absoluta ya mostrada en `:413`. Semánticamente no miente (el paréntesis califica el hecho), pero reutiliza el vocabulario de captura sobre un hecho ⇒ ambigüedad de registro | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:429` | `fechaCorta` | **`tabla.tramitacion_evento.fecha_captura`** — máxima del set (`urgenciaFuente.fechaCaptura`, derivada en `:332-338`) | **captura** | `según {sourceLabel(urgenciaFuente.origen)} al {fechaCorta(urgenciaFuente.fechaCaptura)}.` (`:426-433`), en `<span className="text-sm text-muted-foreground">`, valor en `font-mono` | **no** — **RESULTADO CONTRARIO AL ESPERADO POR EL PLAN.** El copy usa **exactamente el idiom aprobado "según {fuente} al {fecha}"** (regla 3 satisfecha), y el comentario `:405` lo declara. La `fecha_captura` NO se presenta como el hecho: la línea del hecho ("vigente desde el …", `:413`) es una oración separada. **Cero "captura" pelado** (regla 4 satisfecha). Único matiz para 117: es un **máximo** sobre el set de eventos, así que la coletilla afirma la frescura del evento más recientemente scrapeado, no la del dato de urgencia en sí | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:445` | `fechaCorta` | `tabla.citacion.fecha` (**DATE-ONLY** medianoche UTC) vía `citacionVigente.fecha`, embed `citacion_punto × citacion` (`:544`) | hecho | `Citado en {citacionVigente.comision} el {fechaCorta(citacionVigente.fecha)}.` (`:442-449`) | sí — **date-only formateada con un formatter sin `timeZone`**. Ver `### B.2.1`: hoy el runtime es UTC y el día NO se corre, pero el archivo prohíbe explícitamente este patrón en su propio comentario (`:145-150`) y usa `diaCalendarioCitacion` para la MISMA columna en `:189/:221`. Inconsistencia interna = riesgo latente | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:460` | `fechaCorta` | `tabla.citacion.fecha` (**DATE-ONLY**) vía `citacionesPasadas[].fecha` | hecho | `Citado el {fechaCorta(c.fecha)} en {c.comision} (sesión pasada)` (`:456-466`) | sí — mismo patrón date-only↔`fechaCorta` de la fila anterior (`### B.2.1`) | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:475` | `fechaCorta` | `tabla.sesion_sala.fecha` (**DATE-ONLY**) vía `enTablaSala[0].fecha`, embed `sesion_tabla_item × sesion_sala` (`:552`) | hecho | `En tabla de sala de la {camaraNombre(...)} del {fechaCorta(enTablaSala[0].fecha)} ver en la agenda` (`:473-483`) — caso de UNA aparición | sí — mismo patrón date-only↔`fechaCorta` (`### B.2.1`) | — |
| E-032 | `/proyecto/[boletin]` (**texto de `aria-label`**) | `estado-actual-block.tsx:479` | `fechaCorta` | `tabla.sesion_sala.fecha` (**DATE-ONLY**) | hecho | `aria-label={`En tabla de sala de la ${camaraNombre(enTablaSala[0].camara)} del ${fechaCorta(enTablaSala[0].fecha)} — ver en la agenda`}` (`:479`) — **leído por lectores de pantalla** | sí — mismo patrón date-only↔`fechaCorta`; el defecto se propaga al canal accesible, donde además es la ÚNICA forma en que el usuario recibe el contexto del link | — |
| E-032 | `/proyecto/[boletin]` (**texto de `aria-label`**) | `estado-actual-block.tsx:494` | `fechaCorta` | `tabla.sesion_sala.fecha` (**DATE-ONLY**) | hecho | `aria-label={`En tabla de sala de la ${camaraNombre(s.camara)} del ${fechaCorta(s.fecha)} — ver en la agenda`}` (`:494`) — rama de N apariciones | sí — idem fila anterior | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:497` | `fechaCorta` | `tabla.sesion_sala.fecha` (**DATE-ONLY**) | hecho | `{camaraNombre(s.camara)}, {fechaCorta(s.fecha)}` (`:496-497`), dentro del `<a>` de cada semana; encabezado `En tabla de sala {enTablaSala.length} veces:` (`:487`) | sí — mismo patrón date-only↔`fechaCorta` (`### B.2.1`) | — |
| E-032 | `/proyecto/[boletin]` (lógica, no render) | `estado-actual-block.tsx:189` | `diaCalendarioCitacion` (import `:3`) | `tabla.citacion.fecha` (**DATE-ONLY**) | hecho | `(sin render — predicado)`: filtra `diaCalendarioCitacion(x.d)! >= hoyChile` para elegir la citación vigente/futura | no — **uso CORRECTO** del contrato date-only (comentario `:188`); veredicto de capa `seguro` (`116-FORMATTERS.md` §1). El día publicado se compara contra el día-Chile del instante actual, cada uno con su formatter correcto | — |
| E-032 | `/proyecto/[boletin]` (lógica, no render) | `estado-actual-block.tsx:221` | `diaCalendarioCitacion` | `tabla.citacion.fecha` (**DATE-ONLY**) | hecho | `(sin render — predicado)`: `diaCalendarioCitacion(x.d)! < hoyChile` para las citaciones pasadas | no — uso correcto (comentario `:220`) | — |
| E-032 | `/proyecto/[boletin]` (lógica, no render) | `estado-actual-block.tsx:237` | `diaCalendarioCitacion` (helper `semanaIsoChile`, `:236`) | `tabla.sesion_sala.fecha` (**DATE-ONLY**) | hecho | `(sin render directo)`: el día publicado alimenta `isoWeekOf` → la `semanaIso` que viaja al href `/agenda?semana=…` (`:477,:492`) | no — uso correcto y documentado (`:229-234`: convertir a tz Chile "retrocedería un día y podría corrimiento de semana ISO") | — |
| E-032 | `/proyecto/[boletin]` (lógica, no render) | `estado-actual-block.tsx:270` | `diaCalendarioCitacion` | `tabla.sesion_sala.fecha` (**DATE-ONLY**) | hecho | `(sin render — clave de deduplicación)`: `${x.f.camara}:${diaCalendarioCitacion(x.d)}` (WR-02) | no — uso correcto (comentario `:267-268`) | — |
| E-032 | `/proyecto/[boletin]` (lógica, no render) | `estado-actual-block.tsx:152` (`timeZone: "America/Santiago"` en `:153`) | `DIA_CALENDARIO_CHILE_HOY` (`Intl` `en-CA`) | **el INSTANTE ACTUAL** (`hoy = new Date()`, `:182` y `:210`) — **NO** una columna de la DB | hecho | `(sin render — se usa como `hoyChile`, término de comparación)` | no — **uso CORRECTO y es el ejemplo canónico de la distinción**: su entrada es un timestamp real, no date-only, y el JSDoc `:144-151` declara explícitamente que "las FECHAS de citación/sala NO se convierten con esto … convertirlas de zona fabricaría el día anterior". Veredicto de capa `seguro` (`116-FORMATTERS.md` §1.1) | — |
| E-004 | `/agenda` | `app/agenda/page.tsx:257,:258` | `dayLabelCitacion` (import `:29`) | `tabla.citacion.fecha` (**DATE-ONLY**) | hecho | `{dayLabelCitacion(c.fecha)}` en `<span>` dentro de la meta gris del `<li>` (`:257-259`) ⇒ p. ej. `Lunes 20 de julio`; si no parsea, el span se omite | no — `dayLabelCitacion` delega en `diaCalendarioCitacion` y reconstruye a **mediodía UTC** (`dia-calendario.ts:114-115`); veredicto de capa `seguro`. Rótulo del hecho (día de la citación) sin ambigüedad | — |
| E-004 | `/agenda` (cobertura de la Cámara) | `app/agenda/page.tsx:334,:335` | `diaCalendarioCitacion` (import `:28`) | `tabla.citacion.fecha` (**DATE-ONLY**) — `min(fecha)` y `max(fecha)` del set Cámara | hecho | `(sin render directo en este anchor)`: `camaraMin`/`camaraMax` alimentan `semanasEntre(...)` (`:339`) y viajan como `camaraMin`/`camaraMax` (`:340-341`) al copy de cobertura | no — uso correcto del contrato date-only, declarado en el comentario `:332-333` ("no una conversión de zona (que retrocedería un día)") | — |
| E-004 | `/agenda` | `app/agenda/page.tsx:438,:439` | `diaCalendarioCitacion` + `dayLabelCitacion` | `tabla.citacion.fecha` (**DATE-ONLY**) | hecho | `dayKey` (clave de agrupación, no visible) y `dayLabel` — este último SÍ visible como cabecera de día en el island; degradación honesta `"Sin fecha asignada"` (`:439`) cuando no parsea | no — uso correcto y **calculado en el SERVER** (comentario `:430-437`), sin duplicar lógica de zona en el navegador | — |
| E-004 | `/agenda` | `app/agenda/page.tsx:461` | `relativeTimeEs` vía `ProvenanceBadge` (prop `capturedAt` del slice) | `tabla.citacion.fecha_captura` | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint (`116-FORMATTERS.md` §2) | — |
| E-004 | `/agenda` (tabla de sala) | `app/agenda/page.tsx:502` | `relativeTimeEs` vía `ProvenanceBadge` (`SalaProvenance`, tipo en `:489`) | `tabla.sesion_sala.fecha_captura` | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`), montado por `SalaTableSection` | sí — idiom no aprobado del chokepoint | — |
| E-033 | `/agenda` | `citacion-card.tsx:67` (import `:6`; render en `:76-78`) | `badgeFechaCitacion` | `props.fecha` ← `tabla.citacion.fecha` (**DATE-ONLY**) | hecho | `{[fechaLabel, horario].filter(Boolean).join(" · ")}` (`:77`) en `<span className="font-mono text-sm text-muted-foreground">` ⇒ p. ej. `20-jul · 15:00`; sin rótulo textual | no — `badgeFechaCitacion` delega en `diaCalendarioCitacion` (veredicto de capa `seguro`) y el comentario `:48-53` documenta la regla LOCKED con el ejemplo exacto (`2026-07-20T00:00Z` NO debe rendir `19-jul`). La hora real vive en `horario`, columna aparte — separación correcta | — |
| E-033 | `/agenda` | `citacion-card.tsx` (prop `provenance`, `:45`) | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.citacion.fecha_captura` (pasada por E-004 `page.tsx:461`) | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint; **el veredicto efectivo vive en la fila de E-004 `:461`** (consumidor de props, sin copy propio) | — |
| E-018 | `/agenda` (tabla semanal de sala) | `sala-table-section.tsx` (archivo completo, 162 líneas) | `(ninguno)` | `tabla.sesion_tabla_item` (`posicion`, `parte_sesion`, `materia`, `boletin`, `:20-26`) — **cero columna de fecha en `SalaTablaItem`** | — | `(sin fecha renderizada por el componente)`; la referencia temporal es `weekLabel` (`:34`, `:41`), una etiqueta de SEMANA provista por el llamante, no una fecha formateada | no — **el emisor NO formatea ninguna fecha**: el grep vivo de los seis formatters devuelve **cero** ocurrencias en el archivo. Su única fecha llega vía `provenance` (fila siguiente). Se declara para cerrar el ítem sin descartarlo | — |
| E-018 | `/agenda` (tabla semanal de sala) | `sala-table-section.tsx:33` (prop `provenance`; render en `:59`) | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.sesion_sala.fecha_captura` (pasada por E-004 `page.tsx:502`) | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint; veredicto efectivo en la fila de E-004 `:502` | — |
| E-055 | `/` (home, panel de actualidad) | `panel-actualidad.tsx:104` (helper `rotuloFecha` `:100`; render en `:166` y `:187`) | `diaCalendarioCitacion` (import `:3`) | `RPC:actualidad_senales_panel.fecha_max` para `tipo ∈ {agenda_citacion, agenda_sala}` (`TIPOS_AGENDA`, `:85`) ← `tabla.citacion.fecha` / `tabla.sesion_sala.fecha` (**DATE-ONLY**) | hecho | `{rotulo}` — el día publicado en formato ISO `YYYY-MM-DD` dentro del tile de la señal | no — **ruteo por tipo CORRECTO**: las señales `agenda_*` son las date-only y reciben `diaCalendarioCitacion`; el contrato está documentado en `:82-85` y `:95-98`. Nota menor para 117: el rótulo sale en ISO crudo (`2026-07-20`), no en formato humano es-CL — no es mentira, es legibilidad | — |
| E-055 | `/` (home, panel de actualidad) | `panel-actualidad.tsx:107` | `fechaCorta` (import `:2`) | `RPC:actualidad_senales_panel.fecha_max` para el RESTO de tipos (`velocity`, `archivados`, `urgencias`, `nuevos_ingresos`, `agrupacion_materia`) ← `timestamptz` reales | hecho | `{rotulo}` — la fecha formateada es-CL dentro del tile de la señal; `null` ⇒ el rótulo se OMITE (`:107`, honest-state) | sí — ambigüedad de DÍA heredada de la capa: `fechaCorta` no fija `timeZone` (runtime UTC) sobre `timestamptz` reales. El **ruteo** entre ambos formatters es correcto (cero señal date-only enviada a `fechaCorta` ni viceversa); el defecto es el de la capa, no el del ruteo | — |
| E-008 | `—` (**HUÉRFANO**) | `actualidad-module.tsx:202,:203` | `fechaCorta` (import `:4`) | `tabla.votacion.fecha` (`timestamptz`) | hecho | `{fechaCorta(it.fecha)} · {camaraLabel(it.camara)}` (`:202`) o, sin cámara, `Votación del {fechaCorta(it.fecha)}` (`:203`), en `<p className="mt-1 font-mono text-xs text-muted-foreground">` | sí — ambigüedad de DÍA (`timestamptz` + `fechaCorta` sin `timeZone`); mismo defecto que E-056 y E-001 sobre la misma columna | `— (EMISOR HUÉRFANO, superseded por E-055)` |
| E-008 | `—` (**HUÉRFANO**) | `actualidad-module.tsx:318` | `fechaCorta` | `tabla.tramitacion_evento.fecha` (`timestamptz`) vía `it.desde` (urgencias vigentes, `:418`) | hecho | `desde {fechaCorta(it.desde)}` (`:317-319`) en `<p className="mt-0.5 font-mono text-xs text-muted-foreground">` | sí — misma ambigüedad de DÍA | `— (EMISOR HUÉRFANO, superseded por E-055)` |
| E-008 | `—` (**HUÉRFANO**) | `actualidad-module.tsx:451` | `fechaCorta` | **`max(fecha_captura)`** de seis tablas NO-PII (`FUENTES_FRESCURA`, `:461-468`; query en `:479-482`, parseo en `:491`) | **captura** | `Última actualización de datos` (`:437`) + por fuente: `{it.fuente}` + `{fechaCorta(it.fecha)}` (`:449-452`) ⇒ p. ej. `Votaciones 27 jul 2026` | sí — **presentada como el hecho**: "Última actualización de datos" afirma que el DATO cambió, cuando lo que se mide es el último scraping (regla LOCKED 1, "fecha_captura mentirosa"). Es la misma familia que "Actualizado hace X" del chokepoint, en copy propio y con el agravante de encabezar un strip de transparencia. Sin "captura" pelado (regla 4 satisfecha) | `— (EMISOR HUÉRFANO, superseded por E-055)` |
| E-008 | `—` (**HUÉRFANO**) | `actualidad-module.tsx:46` (`timeZone` en `:47`) | `FECHA_CHILE` (`Intl` `en-CA`) | **el INSTANTE ACTUAL** (`hoy = new Date()`, `:77`) — no una columna | hecho | `(sin render — término de cálculo del lunes ISO)` | no — entrada es timestamp real ⇒ convertir a `America/Santiago` es correcto; veredicto de capa `seguro` (`116-FORMATTERS.md` §1.1). **Cero date-only alimenta este formatter** (verificado: su única entrada es `hoy`) | `— (EMISOR HUÉRFANO, superseded por E-055)` |
| E-008 | `—` (**HUÉRFANO**) | `actualidad-module.tsx:53` (`timeZone` en `:54`) | `DOW_CHILE` (`Intl` `en-US`, `weekday:"short"`) | **el INSTANTE ACTUAL** (`hoy`, `:72`) | hecho | `(sin render — weekday para hallar el lunes ISO)` | no — idem fila anterior; el JSDoc `:58-66` justifica el anclaje a Santiago | `— (EMISOR HUÉRFANO, superseded por E-055)` |
| E-008 | `—` (**HUÉRFANO**) | `actualidad-module.tsx:95` (`timeZone` en `:96`) | `fmt` (`Intl` `sv-SE`) | `new Date(mediodia)` sintético (`Date.UTC(...)`, `:91`) | hecho | `(sin render — mide el offset de Santiago)` | no — su salida no se muestra; veredicto de capa `seguro` | `— (EMISOR HUÉRFANO, superseded por E-055)` |
| E-028 | `/buscar` | `search-result-card.tsx:66,:71` (prop `anio` declarada en `:39`, desestructurada en `:50`) | `(ninguno — `String(anio)`)` | `props.anio` — documentado en `:35-38` como "Año derivado del primer evento de tramitación (proxy de ingreso)" ⇒ `tabla.tramitacion_evento.fecha` (año del primer evento) | **ambigua** | `{anio != null ? String(anio) : "Sin dato"}` (`:71`) — chip sin rótulo que diga de qué es el año | sí — **ambigüedad de SEMÁNTICA declarada en el propio JSDoc**: es un *proxy de ingreso*, no la fecha de ingreso del proyecto; el chip lo muestra como un año pelado, así que el usuario lee "año del proyecto". No es `fecha_captura` (regla 3 no aplica) y el estado vacío es honesto (`"Sin dato"`). **Rastreo incompleto:** ningún call-site de producción pasa `anio=` (grep vivo en `app/buscar/` ⇒ cero) ⇒ el chip está **hoy inerte** (`anio === undefined` ⇒ `:66` no renderiza) | — |
| E-028 | `/buscar` | `search-result-card.tsx:27` (prop `provenance`) | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:match_proyectos` / `RPC:buscar_proyectos_hibrido` → `tabla.proyecto.fecha_captura` (construido por el llamante `app/buscar/page.tsx`) | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint (`116-FORMATTERS.md` §2). El componente no emite copy de fecha propio para la procedencia | — |
| E-028 | `/buscar` | `search-result-card.tsx` (archivo completo, 98 líneas) | `(ninguno)` | — | — | `(sin otra fecha)` — el JSDoc `:17-20` y `:37` prohíben LOCKED mostrar score/cosine/rank | no — se declara para cerrar el ítem: cero formatter de fecha en el archivo (grep vivo ⇒ cero ocurrencias de los seis formatters) | — |

### B.2.1 Auditoría date-only (gotcha LOCKED v9.0)

Regla dura: `citacion.fecha` y análogas se almacenan a **medianoche UTC**; **la parte fecha UTC ES
el día chileno**. Cualquier conversión de zona sobre ellas fabrica el día anterior ⇒ hallazgo.

Enumeración de **todas** las columnas date-only que el grupo B toca (no solo las tres citadas en el
plan), con el veredicto por emisor:

| columna date-only | emisor(es) | formatter | ¿se convierte de zona? (sí/no + evidencia de línea) | veredicto |
|---|---|---|---|---|
| `citacion.fecha` | E-004 (`agenda/page.tsx:257,:258,:438,:439`), E-033 (`citacion-card.tsx:67`) | `dayLabelCitacion` / `diaCalendarioCitacion` / `badgeFechaCitacion` | **no** — los tres delegan en `diaCalendarioCitacion`, cuyo cuerpo es `d.toISOString().slice(0,10)` (`dia-calendario.ts:42`): cero `Intl`, cero `timeZone`, cero `getDate()` local. `dayLabelCitacion` reconstruye a **mediodía UTC** (`:114`) y lee `getUTCDay()` (`:115`) | **correcto** — honra la regla LOCKED |
| `citacion.fecha` (cobertura Cámara) | E-004 (`agenda/page.tsx:334,:335`) | `diaCalendarioCitacion` sobre `min(fecha)`/`max(fecha)` | **no** — comentario `:332-333` declara la razón ("no una conversión de zona (que retrocedería un día)") | **correcto** |
| `citacion.fecha` (predicados de vigencia) | E-032 (`estado-actual-block.tsx:189,:221`) | `diaCalendarioCitacion` comparado contra `DIA_CALENDARIO_CHILE_HOY.format(hoy)` (`:152`) | **no** para la citación (día publicado UTC); **sí, y correctamente,** para `hoy` (timestamp real ⇒ `America/Santiago`, `:153`). Los dos lados de la comparación usan el formatter que su tipo exige | **correcto** — es el ejemplo canónico de la distinción (JSDoc `:144-151`) |
| `citacion.fecha` (**render**) | E-032 (`estado-actual-block.tsx:445`, `:460`) | **`fechaCorta`** (`format.ts:21`, `Intl` es-CL **sin `timeZone`**) | **no HOY, sí latente** — `fechaCorta` no fija zona: hereda el huso del runtime. En producción el server corre **UTC**, así que la medianoche UTC se rinde con su propio día y el resultado coincide con el día publicado. Pero **no hay garantía en el código**: basta un runtime en `America/Santiago` (o cualquier huso negativo) para que `2026-07-20T00:00Z` se rinda `19-jul` | **HALLAZGO (riesgo latente + inconsistencia interna)** — el MISMO archivo declara la prohibición en `:145-150` y usa `diaCalendarioCitacion` para esta columna en `:189/:221`. Fix natural para 117: `badgeFechaCitacion`/`dayLabelCitacion` en `:445` y `:460` |
| `sesion_sala.fecha` (lógica) | E-032 (`estado-actual-block.tsx:237` vía `semanaIsoChile`, `:270` como clave de dedup) | `diaCalendarioCitacion` | **no** — comentario `:229-234` explica que convertir "retrocedería un día y podría corrimiento de semana ISO"; `isoWeekOf` recibe `Date.UTC(y, m-1, d)` (`:239`) | **correcto** |
| `sesion_sala.fecha` (**render**) | E-032 (`estado-actual-block.tsx:475`, `:479` aria-label, `:494` aria-label, `:497`) | **`fechaCorta`** | **no HOY, sí latente** — misma causa que la fila `citacion.fecha (render)`: formatter sin `timeZone` sobre date-only-medianoche-UTC | **HALLAZGO (riesgo latente + inconsistencia interna)** — agravado porque dos de las cuatro ocurrencias viven en `aria-label`, el único canal por el que un lector de pantalla recibe la fecha |
| `sesion_tabla_item` (× `sesion_sala`) | E-018 (`sala-table-section.tsx`), E-032 (embed `:551-553`) | `(ninguno en E-018)` — `SalaTablaItem` (`:20-26`) no expone columna de fecha; la fecha vive en el `sesion_sala` padre, consumido por E-032 | **no** — E-018 no formatea fecha alguna (grep vivo ⇒ cero) | **correcto por ausencia** — el emisor no puede convertir lo que no renderiza |
| `citacion.fecha` / `sesion_sala.fecha` agregadas (`fecha_max`) | E-055 (`panel-actualidad.tsx:104`) | `diaCalendarioCitacion` para `tipo ∈ TIPOS_AGENDA` (`:85`) | **no** — ruteo por tipo verificado contra el contrato documentado en `:82-85` y `:95-98`; cero señal `agenda_*` cae en la rama `fechaCorta` (`:107`) | **correcto** |

**Conteo:** 8 filas de datos. **Conversiones de zona activas sobre date-only: 0.** **Hallazgos de
riesgo latente por formatter sin `timeZone` sobre date-only: 2** (ambos en `estado-actual-block.tsx`,
6 líneas de render: `:445`, `:460`, `:475`, `:479`, `:494`, `:497`).

**Sin hallazgos:** E-004 (todas sus filas de día publicado; sus dos `sí` son del chokepoint
`ProvenanceBadge`, no del emisor), E-033 (fila `badgeFechaCitacion`), E-018 (fila declarativa sin
fecha), E-055 (fila `diaCalendarioCitacion`), y las filas de instante-actual de E-008
(`:46`, `:53`, `:95`) y E-032 (`:152`, `:189`, `:221`, `:237`, `:270`, y **`:429`** — el idiom
aprobado ya está en producción).

---

## B.3 Cierre del grupo B

Los **19** ids del grupo (12 de `## B.1` + 7 de `## B.2`) y su conteo de filas de veredicto:

| id | sección | filas | ≥1 fila |
|---|---|---|---|
| E-004 | B.2 | 5 | sí |
| E-008 | B.2 | 6 | sí |
| E-010 | B.1 | 1 | sí |
| E-018 | B.2 | 2 | sí |
| E-020 | B.1 | 1 | sí |
| E-027 | B.1 | 2 | sí |
| E-028 | B.2 | 3 | sí |
| E-032 | B.2 | **15** | sí |
| E-033 | B.2 | 2 | sí |
| E-035 | B.1 | 2 | sí |
| E-038 | B.1 | 1 | sí |
| E-041 | B.1 | 1 | sí |
| E-043 | B.1 | 2 | sí |
| E-044 | B.1 | 2 | sí |
| E-045 | B.1 | 2 | sí |
| E-048 | B.1 | 2 | sí |
| E-055 | B.2 | 2 | sí |
| E-056 | B.1 | 2 | sí |
| E-058 | B.1 | 2 | sí |

**Conteo declarado: 19/19 ids con al menos una fila. Cero excepción silenciosa.** Total de filas de
veredicto del grupo B: **57** (20 en `## B.1`, 33 en `## B.2`, más las 4 filas declarativas
"sin fecha renderizada" que cierran E-035, E-043, E-058 y E-028).

`E-032` supera el mínimo de 12 filas exigido (15) y la fila de `:429` lleva VEREDICTO **`captura`**.

**Corrección de anchor sobre el catálogo 113 §3.0:** la fila de E-032 en el inventario lista
`fechaCorta(...)` en `:397,413,429,445,460,475,497` — **omite `:479` y `:494`**, las dos ocurrencias
dentro de `aria-label`. El bloque `<interfaces>` de `116-03-PLAN.md` sí las incluye. Este documento
las audita con fila propia; el plan 04 debe propagar la corrección al inventario.

**Diferencias de anchor declaradas en `## B.2`** (re-localizadas el 2026-07-28):

| símbolo | línea en `116-03-PLAN.md` | línea OBSERVADA | naturaleza |
|---|---|---|---|
| `fechaCorta` ×9, `relativeTimeEs`, `diaCalendarioCitacion` ×4 (`estado-actual-block.tsx`) | `:397,:413,:429,:445,:460,:475,:479,:494,:497` / `:417` / `:189,:221,:237,:270` | **idénticas (14/14)** | sin diferencia |
| `Intl` con `timeZone` (`estado-actual-block.tsx`) | `:153` | **`:152`** (constructor `DIA_CALENDARIO_CHILE_HOY`); `:153` es su `timeZone:` | off-by-one, ya declarado en `116-FORMATTERS.md` §1.2 |
| `diaCalendarioCitacion` (`agenda/page.tsx`) | `:334,:335,:438` | **idénticas**; se añade `:439` (`dayLabelCitacion`) y `:257,:258` (`dayLabelCitacion` visible, **no citado por el plan**) | anchors AÑADIDOS: el plan no listaba el render de `dayLabelCitacion` en `:257-258` |
| `capturedAt` (`agenda/page.tsx`) | no citado | **`:461`** (slice de citaciones), **`:502`** (`SalaProvenance`) | anchors AÑADIDOS |
| `Intl` día-Chile (`actualidad-module.tsx`) | `:46,:53,:95` | **idénticas** | sin diferencia (el plan ya incorporó la corrección de `116-FORMATTERS.md` §1.2) |
| `fechaCorta` (`actualidad-module.tsx`) | `:202,:203,:451` y `:318` | **idénticas** | sin diferencia |
| `diaCalendarioCitacion` / `fechaCorta` (`panel-actualidad.tsx`) | `:104` / `:107` (contrato `:96-97`) | **idénticas**; render real en `:166` y `:187` vía `rotuloFecha` (`:100`) | el plan ancló el helper, no el render; **ambos se citan** |
| `props` (`citacion-card.tsx`) | "props" sin línea | **`:67`** (`badgeFechaCitacion`), render `:76-78`, prop `provenance` `:45` | anchors fijados aquí |
| `props` (`sala-table-section.tsx`) | "props" sin línea | **cero formatter**; prop `provenance` en **`:33`**, render en **`:59`** | anchor fijado aquí; **diferencia SUSTANTIVA**: el inventario atribuye a E-018 fechas de `sesion_sala`/`sesion_tabla_item` que el componente **no renderiza** |
| `props` (`search-result-card.tsx`) | "props" sin línea | **cero formatter**; `anio` en **`:39,:50,:66,:71`**, `provenance` en **`:27`** | anchor fijado aquí; **diferencia SUSTANTIVA**: el inventario no menciona el chip `anio`, que sí es una fecha visible (y hoy inerte) |

---

## B.4 Residual detectado

Al recorrer `113-INVENTARIO.md` §3.0 emisor por emisor, la unión de los grupos particionados es
**A (18 ids, `116-PARCIAL-A.md`) + B (19 ids, este documento) = 37 ids**. Comparada contra el
conjunto de filas de §3.0 cuya columna "fechas que muestra" **no** empieza por `—`, queda **un
residual**:

| id | archivo | por qué quedó fuera de A y de B | dónde está auditado |
|---|---|---|---|
| **E-040** | `app/components/provenance-badge.tsx` | Es el **chokepoint DUAL** de `fecha_captura`, no un emisor de carril: §3.0 lo lista con `relativeTimeEs(capturedAt) + esStale` y remite a §3.1. Los planes 02 y 03 particionaron por carril, así que ningún grupo lo reclama | **`116-FORMATTERS.md` §2** (Wave 1) lo audita completo: 9 propiedades con línea observada, las 4 cadenas visibles verbatim, veredicto de dato `captura` y veredicto de copy `candidato a hallazgo`, más los 17 call-sites de §2.2 |

**No hay residual sin auditar.** E-040 se registra aquí explícitamente —en vez de descartarse en
silencio— para que el plan 04 verifique que su veredicto viaja desde `116-FORMATTERS.md` §2 al
artefacto consolidado, y no se pierda por no pertenecer a ninguna de las dos particiones de carril.
