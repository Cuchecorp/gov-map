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
