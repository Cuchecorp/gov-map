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

</content>
