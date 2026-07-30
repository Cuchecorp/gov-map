---
phase: 116
plan: 01
tipo: base-compartida
consumido_por: [116-02, 116-03, 116-04]
regimen: solo-lectura
fecha_corrida: 2026-07-28
---

# 116-FORMATTERS — Semántica de la capa de formateo de fechas

Base compartida de la Phase 116. Los planes 02 (grupo A) y 03 (grupo B) **aplican** este veredicto
por emisor; **no re-derivan** la semántica de un formatter ni la del badge. El plan 04 convierte los
`candidato a hallazgo` de este documento en `F-xx`.

**Régimen:** SOLO LECTURA. Este documento no propone ni aplica cambios de código. Todo fix va a
Phase 117.

---

## 0. Reglas LOCKED aplicadas

Las tres reglas que gobiernan todo veredicto de este documento, citadas verbatim del
`116-CONTEXT.md` §Reglas LOCKED:

1. > `fecha_captura` es reloj de scraping y JAMÁS representa el hecho (Phase 98 "fecha_captura
   > mentirosa"). Toda presentación de `fecha_captura` sin el idiom "según fuente al…" (o
   > equivalente aprobado) = hallazgo.

2. > "captura" pelado en copy visible = PROHIBIDO (decisión v10.0) = hallazgo.

3. > `citacion.fecha` (y date-only análogas del Congreso) = **medianoche UTC**; la parte fecha UTC
   > ES el día chileno — cualquier conversión de zona horaria sobre date-only = hallazgo (gotcha
   > mayor v9.0 pasada 2). Verificar `diaCalendarioCitacion` y todo formatter que toque date-only.

Regla auxiliar (`116-CONTEXT.md`, mismo bloque), usada para separar `ambiguo` de `seguro`:

> `Intl.DateTimeFormat` con timeZone implícita del runtime sobre timestamps reales (no date-only) se
> evalúa caso a caso: veredicto ambiguo solo si el render puede cambiar el día visible.

---

## 1. Semántica por formatter

### 1.0 Universo (grep vivo, no heredado)

Comando re-corrido el **2026-07-28** (verbatim del universo de `113-INVENTARIO.md` §0.2):

```bash
grep -rlE "toLocaleDateString|Intl\.DateTimeFormat|fechaCorta|relativeTimeEs|diaCalendarioCitacion|fechaCortaSegura" \
  app/app app/components app/lib --include=*.tsx --include=*.ts | grep -v "\.test\."
```

**Conteo observado: 28 archivos.** Coincide con el conteo de 113 del 2026-07-27 (28). Sin
diferencia que declarar en el denominador de archivos.

Los `Intl.DateTimeFormat` del árbol (grep independiente, mismo día) son **11**: `format.ts:12`,
`week-utils.ts:110,115`, `comparar/page.tsx:55`, `cuenta/page.tsx:91`,
`actualidad-module.tsx:46,53,95`, `estado-actual-block.tsx:152`, `timeline-view.tsx:29`,
`votos-por-parlamentario.tsx:287`. Los dos `toLocaleDateString` viven en
`validacion-fuente.tsx:226,239`.

### 1.1 Tabla

Columnas: `formatter | archivo:línea | tipo de entrada | timeZone efectiva | ¿puede cambiar el día
visible? | veredicto de la capa`.

| formatter | archivo:línea | tipo de entrada | timeZone efectiva | ¿puede cambiar el día visible? | veredicto de la capa |
|---|---|---|---|---|---|
| `fechaCorta` | `app/lib/format.ts:21` (formatter en `:12`) | `Date` ya construido por el llamante | **implícita del runtime** (`Intl` es-CL sin `timeZone`; el server corre UTC) | **sí** — un `Date` de timestamp real cercano a medianoche se rinde en el huso del runtime; si el runtime dejara de ser UTC el día cambiaría. Sobre date-only-medianoche-UTC en runtime UTC el día NO cambia | `ambiguo-por-construcción` — el día correcto depende de que el runtime sea UTC, no del código. `candidato a hallazgo`: "fechaCorta no fija timeZone; su corrección depende del huso del runtime" |
| `fechaCortaSegura` | `app/lib/format.ts:121` | **date-only**: recorta `raw.slice(0,10)` y valida `^\d{4}-\d{2}-\d{2}$` antes de `new Date(iso)` | **UTC de facto** — `new Date("YYYY-MM-DD")` se parsea como medianoche UTC (ES2015), y luego pasa por `fechaCorta` | **no** en runtime UTC — el slice descarta la hora, así que el día es siempre el día publicado. **sí** si el runtime no fuera UTC (heredado de `fechaCorta`) | `seguro` para el contrato date-only (honra la regla 3 por construcción: cero aritmética de zona sobre el valor recortado); hereda la dependencia de runtime de `fechaCorta` |
| `relativeTimeEs` | `app/lib/format.ts:33` | **timestamp real** (`capturedAt: Date`) + `now` | ninguna hasta `≥7d`, donde delega en `fechaCorta` | **no** para el tramo relativo (`hace X min/h/días` es aritmética de deltas, no de calendario); **sí** en el tramo `≥7d` vía `fechaCorta` | `seguro` en cuanto a día visible; el nombre del parámetro (`capturedAt`) es load-bearing: **este formatter existe para el reloj de scraping** (regla 1) |
| `esStale` | `app/lib/format.ts:65` (umbral en `:10`) | **timestamp real** (`capturedAt: Date`) + `now` | ninguna (aritmética de milisegundos) | **no** — devuelve `boolean`, no emite fecha | `seguro`. **Divergencia documental declarada:** el umbral REAL es `STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000` (**14 días**, `format.ts:10`), no las 48 h que afirman `113-INVENTARIO.md` §3.1.1 y el bloque `<interfaces>` de `116-01-PLAN.md`. `candidato a hallazgo` (documental, no de render) |
| `diaCalendarioCitacion` | `app/lib/dia-calendario.ts:34` (comentario "Cero aritmética de zona" en `:41`) | **date-only-medianoche-UTC** (`citacion.fecha` / `sesion_sala.fecha`) | **UTC explícita por construcción**: `d.toISOString().slice(0,10)` | **no** — devuelve literalmente la parte fecha UTC del ISO | `seguro`. **CUERPO verificado, no solo el comentario**: `:42` es `return d.toISOString().slice(0, 10);` — cero `Intl`, cero `timeZone`, cero `getDate()` local. **Honra la regla 3.** |
| `badgeFechaCitacion` | `app/lib/dia-calendario.ts:91` | **date-only-medianoche-UTC** (delega en `diaCalendarioCitacion`) | UTC heredada del helper; el mes sale de la tabla local `MESES_ES_CORTO` (`:45`), sin `Intl` | **no** — formatea sobre el string `YYYY-MM-DD` ya resuelto (`:96-97`) | `seguro` — honra la regla 3 por delegación |
| `dayLabelCitacion` | `app/lib/dia-calendario.ts:107` | **date-only-medianoche-UTC** (delega en `diaCalendarioCitacion`) | UTC explícita: reconstruye con `Date.UTC(y, m-1, d, 12)` (`:114`) y lee `getUTCDay()` (`:115`) | **no** — el mediodía UTC blinda el weekday contra cruce de huso | `seguro` — honra la regla 3; el mediodía es el idiom correcto para derivar weekday sin tz |
| `diaFmt` (WeekNav) | `app/lib/week-utils.ts:110` (`timeZone: "UTC"` en `:113`) | `Date` de borde de semana ISO construido por `getWeekBounds` | **UTC explícita** | **no** — timeZone fijada | `seguro` |
| `diaMesAnioFmt` (WeekNav) | `app/lib/week-utils.ts:115` (`timeZone: "UTC"` en `:119`) | `Date` de borde de semana ISO construido por `getWeekBounds` | **UTC explícita** | **no** — timeZone fijada | `seguro` |
| `FECHA_CHILE` | `app/components/actualidad-module.tsx:46` (`timeZone` en `:47`) | **timestamp real** — `hoy = new Date()` (instante actual, `:77`) | **`America/Santiago` explícita** | **sí, y es lo correcto**: el instante actual SÍ debe leerse en Chile (el server corre UTC; a las 21:00 CL ya es el día UTC siguiente) | `seguro` para su entrada (instante actual), **con la condición** de que nunca reciba date-only. `nota para 02/03`: emisor HUÉRFANO E-008 |
| `DOW_CHILE` | `app/components/actualidad-module.tsx:53` (`timeZone` en `:54`) | **timestamp real** — `hoy` (`:72`) | **`America/Santiago` explícita** | **sí, y es lo correcto** (weekday del instante actual en Chile) | `seguro` para su entrada; emisor HUÉRFANO E-008 |
| `fmt` (offset sv-SE) | `app/components/actualidad-module.tsx:95` (`timeZone` en `:96`) | **timestamp real** sintético — `new Date(mediodia)` con `mediodia = Date.UTC(...)` (`:91`) | **`America/Santiago` explícita** | **no** — su salida no se muestra: se usa solo para medir el offset y derivar el lunes ISO | `seguro`; emisor HUÉRFANO E-008 |
| `DIA_CALENDARIO_CHILE_HOY` | `app/components/estado-actual-block.tsx:152` (`timeZone` en `:153`) | **timestamp real** — el instante "hoy" | **`America/Santiago` explícita** | **sí, y es lo correcto** para "hoy" | `seguro` — y el comentario `:145-150` declara EXPLÍCITAMENTE la regla 3 ("las FECHAS de citación/sala NO se convierten con esto"). Es el ejemplo canónico de la distinción |
| `formatFechaCaptura` | `app/components/validacion-fuente.tsx:224` (`toLocaleDateString` en `:226`, `timeZone` en `:230`) | **timestamp real** — `fecha_captura` ISO con hora | **`America/Santiago` explícita** | **sí, y es lo correcto** (timestamp real ⇒ se convierte de zona) | `seguro` en el eje tz. **`candidato a hallazgo` de COPY, no de tz**: el nombre y el uso son `fecha_captura` ⇒ la etiqueta que lo rodea debe pasar la regla 1 (idiom "según fuente al…"). El veredicto de la etiqueta lo emite el plan 02/03 sobre E-027 |
| `formatFetchedAt` | `app/components/validacion-fuente.tsx:237` (`toLocaleDateString` en `:239`, `timeZone` en `:243`) | **timestamp real** — momento de fetch del snapshot | **`America/Santiago` explícita** | **sí, y es lo correcto** (timestamp real) | `seguro` en el eje tz; mismo `candidato a hallazgo` de COPY que la fila anterior (es reloj de scraping, regla 1) |
| `mesAnioFormatter` (votos) | `app/components/votos-por-parlamentario.tsx:287` (`timeZone: "UTC"` en `:290`, comentario WR-01) | `Date` sintético `Date.UTC(anio, mes0, 1)` (`:298`) | **UTC explícita** | **no** — base UTC en construcción y en formateo; coincide con el bucket de trimestre | `seguro` — el comentario WR-01 (`:290`) documenta la elección |
| `mesAnioFormatter` (timeline) | `app/components/timeline-view.tsx:29` | `Date` ya construido por el llamante (vía `fechaValida`, `:42`) | **implícita del runtime** (sin `timeZone`) | **sí en teoría** — pero solo emite `month`+`year` (`:30-31`), así que un corrimiento de horas solo cruzaría etiqueta en el borde exacto de mes | `ambiguo` — granularidad mes/año amortigua el riesgo, pero no lo elimina en el primer/último instante del mes. `candidato a hallazgo`: "mesAnioFormatter de timeline-view no fija timeZone; el bucket mes/año depende del huso del runtime" |
| `fechaConsultaHoy` | `app/app/comparar/page.tsx:54` (`Intl` en `:55`, `timeZone` en `:56`) | **timestamp real** — `new Date()` por request (ruta `force-dynamic`) | **`America/Santiago` explícita**, locale `en-CA` (emite ISO `YYYY-MM-DD`) | **sí, y es lo correcto** (día calendario chileno del instante de consulta) | `seguro`. **NO es `fecha_captura`**: es la fecha de CONSULTA, y el comentario `:45-52` ya declara la distinción y el idiom ("consultado al" vs "según fuente al"). Sin hallazgo de capa |
| `fechaCorta` (local de /cuenta) | `app/app/cuenta/page.tsx:90` (`Intl` en `:91`, `timeZone` en `:92`) | **timestamp real** — `new Date(iso)` de una fila de suscripción/consentimiento | **`America/Santiago` explícita**, locale `en-CA` | **sí, y es lo correcto** (timestamp real de un acto del usuario) | `seguro` en el eje tz. **Nota de colisión de nombres:** homónimo local de `format.ts:21` con semántica DISTINTA (fija tz, emite ISO). Los planes 02/03 no deben confundirlos |

**19 filas de datos, cero celdas vacías.**

### 1.2 Notas de anchors re-localizados (diferencias vs. el plan)

Todo anchor fue re-localizado con `grep -n '<símbolo>' <archivo>` el 2026-07-28. Diferencias
respecto a los números citados en `116-01-PLAN.md`:

| símbolo | línea en el plan | línea OBSERVADA | naturaleza |
|---|---|---|---|
| `diaCalendarioCitacion` | `dia-calendario.ts:41` | **`:34`** (la declaración). `:41` SÍ contiene el comentario "Cero aritmética de zona" | el plan ancló el comentario, no la función; ambos anchors son reales |
| `FECHA_CHILE` / `DOW_CHILE` / `fmt` | `actualidad-module.tsx:47,54,96` | **`:46,53,95`** | off-by-one: el plan citó la línea `timeZone:`, no la del constructor `Intl.DateTimeFormat` |
| `DIA_CALENDARIO_CHILE_HOY` | `estado-actual-block.tsx:153` | **`:152`** (constructor); `:153` es su `timeZone:` | off-by-one, misma causa |
| `mesAnioFormatter` (votos) | `votos-por-parlamentario.tsx:290` | **`:287`** (constructor); `:290` es su `timeZone: "UTC"` | off-by-one, misma causa |
| `toLocaleDateString` (validación) | `validacion-fuente.tsx:230,243` | **`:226,239`** (las llamadas); `:230,243` son sus `timeZone:` | off-by-one, misma causa |
| `fechaCorta` de /cuenta | `cuenta/page.tsx:90-91` | **`:90`** (función), **`:91`** (`Intl`) | rango correcto, se desagrega |
| `fechaCorta`, `relativeTimeEs`, `esStale`, `fechaCortaSegura` | `format.ts:21,33,65,121` | **idénticas** | sin diferencia |
| `diaFmt` / `diaMesAnioFmt` | `week-utils.ts:113,119` | **`:110,115`** (constructores); `:113,119` son sus `timeZone: "UTC"` | off-by-one, misma causa |
| `mesAnioFormatter` (timeline) | `timeline-view.tsx:29` | **idéntica** | sin diferencia |
| `fechaConsultaHoy` | `comparar/page.tsx:55` | **`:54`** (función), **`:55`** (`Intl`) | off-by-one |

**Anchor stale sustantivo (no de línea):** `113-INVENTARIO.md` §3.1.1 y el bloque `<interfaces>`
del plan afirman que `esStale` usa un **umbral de 48 h**. El código dice **14 días**
(`app/lib/format.ts:10`, con justificación en `:6-9`: cadence de ingesta semanal). Se declara aquí
y se arrastra como `candidato a hallazgo` documental al plan 04.

---

## 2. Chokepoint ProvenanceBadge (E-040)

### 2.1 El componente

Archivo: `app/components/provenance-badge.tsx`. Anchors re-localizados el 2026-07-28 con
`grep -n '<símbolo>' app/components/provenance-badge.tsx`; **todos coinciden** con los citados en el
plan (cero diferencia de línea que declarar en esta subsección).

| propiedad | línea OBSERVADA | contenido |
|---|---|---|
| prop `capturedAt` | `:38` | `capturedAt: Date \| null;` — doc en `:37`: "Momento de captura. `null` → procedencia desconocida." |
| prop `sourceUrl` | `:42` | `sourceUrl: string \| null;` — cara B del chokepoint (auditada por 115, aquí solo se registra) |
| frescura | `:66` | `const stale = capturedAt !== null && esStale(capturedAt);` — umbral REAL **14 días** (`format.ts:10`), NO 48 h |
| `displaySource` | `:67` | `const displaySource = capturedAt === null ? "fuente desconocida" : sourceName;` |
| guard de href | `:70` | `const safeUrl = safeExternalHref(sourceUrl);` |
| formatter de la fecha | `:90` | `<span>Actualizado {relativeTimeEs(capturedAt)}</span>` |
| degradación `null` | `:92` | `<span>Sin fecha de actualización</span>` |
| rama de omisión del tooltip | `:114` | `if (capturedAt === null && safeUrl === null) { return badge; }` — el **badge nunca se omite**; lo que se omite es el tooltip |
| tooltip | `:128` | `{capturedAt !== null && <div>{capturedAt.toISOString()}</div>}` — el instante crudo de scraping |

**Texto VISIBLE exacto emitido alrededor de la fecha** (leído del JSX, no parafraseado):

- `:90` — `Actualizado ` + salida de `relativeTimeEs(capturedAt)` ⇒ p. ej. `Actualizado hace 3 días`
  o, a ≥7 días, `Actualizado 14 may 2026`.
- `:92` — `Sin fecha de actualización` (rama `capturedAt === null`).
- `:95` — `{displaySource}`, que en la rama `null` es el literal `fuente desconocida` (`:67`).
- `:106` — `fuente oficial ↗` (texto del `<a>`, cara B).

Las cuatro cadenas fueron verificadas verbatim con `grep -F "<texto>" app/components/provenance-badge.tsx`.

**Veredicto del componente (semántica del dato): `captura`.** Por construcción, la única fecha que
el badge renderiza llega por `capturedAt` y se formatea con `relativeTimeEs`, cuyo parámetro se
llama literalmente `capturedAt` (`format.ts:33`). Es el reloj de scraping (**regla LOCKED 1**),
jamás el hecho. Ninguna fecha del badge es candidata a "fecha del hecho" en ninguna ruta.

**Veredicto de COPY: `candidato a hallazgo`.**

- El idiom aprobado por la regla 1 es **"según fuente al…"** (o equivalente). El badge dice
  **"Actualizado hace X"**, que **no** es ese idiom: "Actualizado" se lee como "el dato cambió" /
  "la fuente publicó algo nuevo", cuando lo que la cadena mide es **cuándo lo miramos nosotros**.
  Un dato inmutable desde 2019 re-scrapeado hoy dice "Actualizado hace 0 min". Ese es exactamente
  el defecto que la regla 1 nombra ("fecha_captura mentirosa", Phase 98).
- La regla 2 **NO** se viola: la palabra "captura" **no aparece pelada** en ningún texto visible
  (`:90/:92/:95/:106`); solo vive en nombres de identificadores y comentarios, que no se renderizan.
- Texto propuesto para que el plan 04 lo convierta en `F-xx`:
  *"El chokepoint `ProvenanceBadge` (`provenance-badge.tsx:90`) rotula la fecha de captura como
  'Actualizado hace X'. No usa el idiom aprobado 'según fuente al…' y sugiere actualización del
  dato donde solo hay recencia de scraping (regla LOCKED 1). Superficie: transversal — 17
  call-sites en 15 archivos de producción."*
- Segundo `candidato a hallazgo` (documental): el JSDoc del componente (`:18`) afirma *"Si el dato
  tiene más de 48h se marca en amber"*; el umbral real es de **14 días** (`format.ts:10`). El
  comentario miente sobre el comportamiento y es la fuente del error heredado por
  `113-INVENTARIO.md` §3.1.1.

### 2.2 Veredicto por call-site de `capturedAt`

**Denominador vivo** (re-corrido 2026-07-28, NO heredado de 113):

```bash
grep -rn "capturedAt=" app/app app/components --include=*.tsx | grep -v "\.test\."
```

⇒ **17 ocurrencias** en **15 archivos de producción**.

**Reconciliación con 113 §3.1.4:** 113 contó **15 archivos de producción** para el prop hermano
`sourceUrl`. **No hay diferencia de universo**: son los mismos 15 archivos. La diferencia 17 vs 15
es de *denominador*, no de cobertura — 113 agrupó las ocurrencias múltiples por archivo en una fila
(`voto-ficha-row.tsx` ×2, y `patrimonio-de-parlamentario.tsx` aparecía ya desagregado en 2 filas).
Aquí se listan **ocurrencias**, no archivos, porque el veredicto de fecha es por call-site.

**Regla de decisión (declarada al abrir la tabla, LOCKED, 113 §3.1.1):** toda fecha que llega por
`capturedAt` se **MARCA como `captura` sin más análisis**. El hallazgo aparece por dos vías, ambas
chequeadas en cada fila:

- **(a)** el llamante pasa por `capturedAt` una fecha que **no** es `fecha_captura` (p. ej. la fecha
  del hecho) ⇒ hallazgo `HECHO-COMO-CAPTURA`;
- **(b)** el llamante presenta `fecha_captura` **fuera** del badge, en copy propio, sin el idiom
  aprobado ⇒ se anota como **pista** en la columna `nota` para los planes 02/03 (no se resuelve aquí).

| # | id E-xxx | archivo:línea | expresión del prop verbatim | columna/RPC de origen | ¿es `fecha_captura`? | veredicto | gate | nota |
|---|---|---|---|---|---|---|---|---|
| 1 | E-048 | `app/app/proyecto/[boletin]/page.tsx:504` | `capturedAt={new Date(masReciente.fecha_captura)}` | `tabla.source_snapshot.fecha_captura` (reduce por `max` en `:495`) | sí | `captura correcta` | — | `sourceUrl={null}` (`:506`): badge sin link por diseño. Vía (b): ninguna fecha de captura fuera del badge en este bloque |
| 2 | E-016 | `app/components/aportes-por-contraparte.tsx:198` | `capturedAt={captured}` (← `:147` `const captured = a.fecha_captura ? new Date(a.fecha_captura) : null;`) | `RPC:agregado_por_contraparte` (rama aportes) ← `tabla.aporte.fecha_captura` | sí | `captura correcta` | **MONEY** | `no emitido en el deploy auditado`. Vía (b): `:188` emite "Consolidado, corte al {fechaCorteTexto}" ← `fecha_corte` — es **corte de la fuente**, no captura; pista para el plan 03 |
| 3 | E-035 | `app/components/autor-row.tsx:58` | `capturedAt={` `autor.fecha_captura ? new Date(autor.fecha_captura) : null` `}` | `tabla.proyecto_autor.fecha_captura` | sí | `captura correcta` | — | `densidad="lista"` (`:57`): la leyenda viaja en tooltip. Vía (b): sin fecha propia fuera del badge |
| 4 | E-015 | `app/components/contratos-de-parlamentario.tsx:194` | `capturedAt={captured}` (← `:127`) | `RPC:contratos_de_parlamentario` ← `tabla.contrato.fecha_captura` | sí | `captura correcta` | **MONEY** | `no emitido en el deploy auditado`. Vía (b): "Consultado por RUT, corte al {fechaCorteTexto}" (`:184`, valor en `:185`) ← `fecha_corte`; pista plan 03 |
| 5 | E-014 | `app/components/contratos-por-contraparte.tsx:177` | `capturedAt={captured}` (← `:132`) | `RPC:agregado_por_contraparte` (rama contratos) ← `tabla.contrato.fecha_captura` | sí | `captura correcta` | **MONEY** | `no emitido en el deploy auditado`. Vía (b): "Consolidado, corte al {fechaCorteTexto}" (`:167`, valor en `:168`); pista plan 03 |
| 6 | E-053 | `app/components/cruces-de-parlamentario.tsx:196` | `capturedAt={new Date(s.fecha_captura)}` | `RPC:cruces_de_parlamentario` ← `tabla.cruce_senal.fecha_captura` (`= now()` del FULL REBUILD diario) | sí | `captura correcta` | **CRUCES** | La captura es del **rebuild del pipeline**, no de la fuente/reunión — declarado en el comentario `:188-192`. Sigue siendo captura (regla 1); la honestidad del matiz la evalúa el plan 03 |
| 7 | E-044 | `app/components/cruces-de-proyecto.tsx:178` | `capturedAt={new Date(row.fecha_captura)}` | `RPC:cruces_de_proyecto` ← `tabla.cruce_senal.fecha_captura` (nivel señal) | sí | `captura correcta` | **CRUCES** | El comentario `:173-174` declara explícitamente `NO item.fecha` (WR-02/F41) — el llamante ya evitó el error (a). `fechaCortaSegura(item.fecha)` (`:168`, el hecho) va aparte, fuera del badge |
| 8 | E-043 | `app/components/ficha-header.tsx:66` | `capturedAt={capturedAt}` (← `:19` `const capturedAt = proyecto.fecha_captura ? new Date(...) : null;`) | `tabla.proyecto.fecha_captura` | sí | `captura correcta` | — | Fila C1 de 113 §6. Vía (b): sin fecha de captura propia fuera del badge |
| 9 | E-013 | `app/components/financiamiento-de-parlamentario.tsx:233` | `capturedAt={captured}` (← `:170`) | `RPC:aportes_de_parlamentario` ← `tabla.aporte.fecha_captura` | sí | `captura correcta` | **MONEY** | `no emitido en el deploy auditado`. Vía (b): "Consultado por nombre del candidato, corte al {fechaCorteTexto}" (`:223`, valor en `:224`) + cobertura `ingestado_hasta` (`:519,539`); pistas plan 03 |
| 10 | E-002 | `app/components/lobby-de-parlamentario.tsx:536` | `capturedAt={captured}` (← `:476` `const captured = a.fecha_captura ? new Date(a.fecha_captura) : null;`) | `RPC:lobby_de_parlamentario` ← `tabla.lobby_audiencia.fecha_captura` | sí | `captura correcta` | — | `densidad="lista"` (`:535`), badge por fila. La fecha del hecho (audiencia) se rinde aparte, fuera del badge |
| 11 | E-059 | `app/components/parlamentario-header.tsx:116` | `capturedAt={capturedAt}` (← `:37` `const capturedAt = parlamentario.fecha_captura ? new Date(...) : null;`) | `RPC:parlamentario_publico_v2.fecha_captura` ← `tabla.parlamentario.fecha_captura` | sí | `captura correcta` | — | Vía (b): sin fecha de captura propia fuera del badge |
| 12 | E-005 | `app/components/patrimonio-de-parlamentario.tsx:445` | `capturedAt={captured}` (← `:414` `const captured = version.fecha_captura ? new Date(version.fecha_captura) : null;`) | `RPC:declaraciones_de_parlamentario` ← `tabla.declaracion.fecha_captura` | sí | `captura correcta` | — | Badge por versión de declaración, `densidad="lista"` (`:444`) |
| 13 | E-005 | `app/components/patrimonio-de-parlamentario.tsx:769` | `capturedAt={c.fecha_captura ? new Date(c.fecha_captura) : null}` | `RPC:comparar_declaraciones` ← `tabla.declaracion.fecha_captura` | sí | `captura correcta` | — | Un badge por columna comparada (`columnas.map`, `:765`) |
| 14 | E-056 | `app/components/votacion-card.tsx:97` | `capturedAt={capturedAt}` (← `:23` `const capturedAt = votacion.fecha_captura ? new Date(...) : null;`) | `tabla.votacion.fecha_captura` | sí | `captura correcta` | — | Fila C12 de 113 §6. La fecha del HECHO (`fechaCorta(fecha)`, `:39`, fila C11) se rinde fuera del badge — separación correcta |
| 15 | E-003 | `app/components/voto-ficha-row.tsx:135` | `capturedAt={voto.fecha_captura ? new Date(voto.fecha_captura) : null}` | `RPC:votos_de_parlamentario.fecha_captura` ← `tabla.votacion.fecha_captura` | sí | `captura correcta` | — | **HUÉRFANO** (E-003, 113 §3.0.1: cero imports non-test de `VotoFichaRow`). El veredicto vale si alguien lo re-monta |
| 16 | E-003 | `app/components/voto-ficha-row.tsx:220` | `capturedAt={voto.fecha_captura ? new Date(voto.fecha_captura) : null}` | `RPC:votos_de_parlamentario.fecha_captura` ← `tabla.votacion.fecha_captura` | sí | `captura correcta` | — | **HUÉRFANO** — segunda ocurrencia del mismo prop en el mismo componente (rama de render distinta) |
| 17 | E-001 | `app/components/votos-por-parlamentario.tsx:546` | `capturedAt={e.fecha_captura ? new Date(e.fecha_captura) : null}` | `RPC:votos_de_parlamentario.fecha_captura` ← `tabla.votacion.fecha_captura` | sí | `captura correcta` | — | `densidad="lista"` (`:545`). La fecha del hecho de la etapa se rinde aparte con `fechaCorta` |

**Resultado del eje (a):** **cero** `HECHO-COMO-CAPTURA` y **cero** `captura-como-hecho` en los 17
call-sites. Los 17 pasan una columna `fecha_captura` genuina. Dos llamantes (filas 6 y 7) documentan
explícitamente en comentario por qué NO pasan la fecha del hecho — el error (a) fue considerado y
evitado en origen.

**Resultado del eje (b):** 4 pistas para el plan 03, todas en superficies **MONEY OFF** (filas 2, 4,
5, 9): el copy "…, corte al {fecha}" ("Consolidado" en 2 y 5; "Consultado por RUT" en 4; "Consultado por nombre del candidato" en 9) presenta `fecha_corte` fuera del badge. `fecha_corte`
es **corte de la fuente**, no captura, así que la regla 1 no aplica directamente; queda registrado
para que el plan 03 verifique que la etiqueta no se confunda con captura ni con el hecho.

### 2.3 Cierre del denominador

- Call-sites observados por el grep vivo: **17**.
- Filas en la tabla de §2.2: **17**.
- Call-sites sin veredicto: **0**.
- Veredictos usados, todos dentro del conjunto cerrado
  {`captura correcta`, `HECHO-COMO-CAPTURA`, `captura-como-hecho`, `ambigua`}: **17 ×
  `captura correcta`**.
- Bajo gate: **5** (4 × `MONEY` ⇒ `no emitido en el deploy auditado`; 2 × `CRUCES`, filas 6 y 7 —
  éstas sí se emiten en el deploy auditado, el gate CRUCES está abierto desde v4.0).
- **HUÉRFANO**: 2 ocurrencias (filas 15 y 16, `voto-ficha-row.tsx`, E-003).
- Archivos de producción cubiertos: **15/15**.

**Candidatos a hallazgo emitidos por esta sección** (insumo del plan 04, sin numerar aquí):

1. Copy del chokepoint: "Actualizado hace X" en `provenance-badge.tsx:90` no usa el idiom aprobado
   "según fuente al…" para una fecha que es reloj de scraping (regla LOCKED 1). Alcance transversal.
2. Documentación mentirosa del umbral de frescura: `provenance-badge.tsx:18` y
   `113-INVENTARIO.md` §3.1.1 dicen 48 h; `format.ts:10` dice 14 días.
3. `fechaCorta` (`format.ts:21`) y `mesAnioFormatter` de `timeline-view.tsx:29` no fijan `timeZone`:
   el día/mes visible depende del huso del runtime (§1.1).

</content>
