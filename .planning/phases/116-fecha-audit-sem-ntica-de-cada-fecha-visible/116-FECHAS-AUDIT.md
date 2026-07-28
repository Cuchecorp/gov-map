---
phase: 116
titulo: Auditoría semántica de fechas
requirement: FECHA-01
consumido_por: [117, 125]
regimen: solo-lectura
ancla_temporal: 2026-07-28
timezone_del_servidor_prod: UTC
gates_observados:
  # Copiados de 113-INVENTARIO.md §5. La observación es HEREDADA del 2026-07-27;
  # esta fase NO tocó ningún flag para re-observarlos.
  fuente: "113-INVENTARIO.md §5"
  fecha_de_esa_observacion: 2026-07-27
  heredada: true
  MONEY: "OFF — /contraparte/[id] 404ea entera; contrato y aporte con 0 filas en PROD"
  NOTIF: "OFF — /cuenta inerte; suscripcion y consentimiento con 0 filas en PROD"
  CRUCES: "ON — superficie viva desde v4.0"
  VSIM: "ON — dossier firmado en v10.0"
fuentes:
  - 116-FORMATTERS.md
  - 116-PARCIAL-A.md
  - 116-PARCIAL-B.md
  - 113-INVENTARIO.md
---

# 116-FECHAS-AUDIT — Auditoría semántica de cada fecha visible

Artefacto rector de la Phase 116. Consolida el veredicto de código de los planes 01/02/03 y lo
**cruza contra el dato real de PROD**. **Régimen: SOLO LECTURA.** Cero DDL, cero DML, cero flag
tocado, cero cambio en `app/` ni en `packages/`. Todo fix va a Phase 117.

---

## 0. Método y régimen

### 0.1 Qué se auditó

**Universo:** los ids `E-xxx` del catálogo `113-INVENTARIO.md` §3.0 cuya columna *"fechas que
muestra"* **no** empieza por `—`. Con el inventario del 2026-07-27 eso da **38 ids**: los 18 del
grupo A (`116-PARCIAL-A.md`), los 19 del grupo B (`116-PARCIAL-B.md`) y **E-040**
(`provenance-badge.tsx`), el chokepoint, que no pertenece a ningún carril y lo audita
`116-FORMATTERS.md` §2.

La regla de celda que deriva ese denominador está LOCKED y la implementa `check-fechas.sh`
(check 1); ver `## 7.`

### 0.2 Cómo

1. **Análisis de código** — grep vivo de los seis formatters (`fechaCorta`, `fechaCortaSegura`,
   `relativeTimeEs`, `diaCalendarioCitacion`, `Intl.DateTimeFormat`, `toLocaleDateString`) con
   re-localización de **todo** anchor el 2026-07-28; cero anchor heredado sin verificar.
2. **psql read-only contra PROD** — cruce del veredicto de código contra el dato real, un sujeto
   concreto por superficie (`## 2.`). Cero DDL, cero DML, cero flag tocado.

### 0.3 Qué NO hace

Esta fase **no corrige nada**. No modifica `app/`, no modifica `packages/`, no toca `.env` ni
ningún flag, no aplica migraciones. Todo fix va a **Phase 117**. Un hallazgo aquí es un encargo
consumible, no un cambio aplicado.

### 0.4 Las tres reglas LOCKED (verbatim de `116-CONTEXT.md` §Reglas LOCKED)

1. > `fecha_captura` es reloj de scraping y JAMÁS representa el hecho (Phase 98 "fecha_captura
   > mentirosa"). Toda presentación de `fecha_captura` sin el idiom "según fuente al…" (o
   > equivalente aprobado) = hallazgo.

2. > "captura" pelado en copy visible = PROHIBIDO (decisión v10.0) = hallazgo.

3. > `citacion.fecha` (y date-only análogas del Congreso) = **medianoche UTC**; la parte fecha UTC
   > ES el día chileno — cualquier conversión de zona horaria sobre date-only = hallazgo (gotcha
   > mayor v9.0 pasada 2). Verificar `diaCalendarioCitacion` y todo formatter que toque date-only.

Regla auxiliar (mismo bloque), usada para separar `ambigua` de `seguro`:

> `Intl.DateTimeFormat` con timeZone implícita del runtime sobre timestamps reales (no date-only) se
> evalúa caso a caso: veredicto ambiguo solo si el render puede cambiar el día visible.

**Conjunto cerrado de VEREDICTO:** `hecho` | `captura` | `ambigua`.

### 0.5 Comandos re-ejecutables

```bash
# 1) Universo de archivos con formateo de fecha (28 archivos al 2026-07-28)
grep -rlE "toLocaleDateString|Intl\.DateTimeFormat|fechaCorta|relativeTimeEs|diaCalendarioCitacion|fechaCortaSegura" \
  app/app app/components app/lib --include=*.tsx --include=*.ts | grep -v "\.test\."

# 2) Call-sites del chokepoint (17 ocurrencias en 15 archivos de producción)
grep -rn "capturedAt=" app/app app/components --include=*.tsx | grep -v "\.test\."

# 3) Cruce contra PROD (read-only; la URL jamás se imprime)
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select now()::date, current_setting('TimeZone');"

# 4) Completitud del propio audit
STRICT=1 bash .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh
```

---

## 1. Veredicto por emisor × fecha

### 1.0 Semántica por formatter

Importada verbatim de `116-FORMATTERS.md` §1.1 para que este artefacto sea autocontenido.
Columnas: `formatter | archivo:línea | tipo de entrada | timeZone efectiva | ¿puede cambiar el día
visible? | veredicto de la capa`.

| formatter | archivo:línea | tipo de entrada | timeZone efectiva | ¿puede cambiar el día visible? | veredicto de la capa |
|---|---|---|---|---|---|
| `fechaCorta` | `app/lib/format.ts:21` (formatter en `:12`) | `Date` ya construido por el llamante | **implícita del runtime** (`Intl` es-CL sin `timeZone`; el server corre UTC) | **sí** — sobre timestamp real cercano a medianoche; sobre date-only-medianoche-UTC en runtime UTC el día NO cambia | `ambiguo-por-construcción` ⇒ **F-10** |
| `fechaCortaSegura` | `app/lib/format.ts:121` | date-only: `raw.slice(0,10)` validado `^\d{4}-\d{2}-\d{2}$` antes de `new Date(iso)` | UTC de facto (`new Date("YYYY-MM-DD")` = medianoche UTC, ES2015) | **no** en runtime UTC para date-only; **sí** si la entrada es un `timestamptz` real (el slice da el día UTC) | `seguro` para el contrato date-only; hereda la dependencia de runtime de `fechaCorta` |
| `relativeTimeEs` | `app/lib/format.ts:33` | timestamp real (`capturedAt: Date`) + `now` | ninguna hasta `≥7d`, donde delega en `fechaCorta` | **no** para el tramo relativo; **sí** en el tramo `≥7d` | `seguro` en día visible; el nombre del parámetro (`capturedAt`) es load-bearing: existe **para el reloj de scraping** (regla 1) |
| `esStale` | `app/lib/format.ts:65` (umbral en `:10`) | timestamp real + `now` | ninguna (aritmética de ms) | **no** — devuelve `boolean` | `seguro`. Umbral REAL = **14 días**, no 48 h ⇒ **F-11** (documental) |
| `diaCalendarioCitacion` | `app/lib/dia-calendario.ts:34` (comentario en `:41`) | date-only-medianoche-UTC | **UTC explícita**: `d.toISOString().slice(0,10)` (`:42`) | **no** | `seguro` — **honra la regla 3**; cuerpo verificado, no solo el comentario |
| `badgeFechaCitacion` | `app/lib/dia-calendario.ts:91` | date-only (delega en `diaCalendarioCitacion`) | UTC heredada; mes de tabla local `MESES_ES_CORTO` (`:45`) | **no** | `seguro` — honra la regla 3 por delegación |
| `dayLabelCitacion` | `app/lib/dia-calendario.ts:107` | date-only (delega en `diaCalendarioCitacion`) | UTC explícita: `Date.UTC(y,m-1,d,12)` (`:114`) + `getUTCDay()` (`:115`) | **no** — el mediodía UTC blinda el weekday | `seguro` — idiom correcto para weekday sin tz |
| `diaFmt` (WeekNav) | `app/lib/week-utils.ts:110` (`timeZone:"UTC"` en `:113`) | `Date` de borde de semana ISO | **UTC explícita** | **no** | `seguro` |
| `diaMesAnioFmt` (WeekNav) | `app/lib/week-utils.ts:115` (`timeZone:"UTC"` en `:119`) | `Date` de borde de semana ISO | **UTC explícita** | **no** | `seguro` |
| `FECHA_CHILE` | `app/components/actualidad-module.tsx:46` (`timeZone` en `:47`) | timestamp real — `hoy = new Date()` (`:77`) | **`America/Santiago` explícita** | **sí, y es lo correcto** (instante actual) | `seguro` para su entrada; emisor HUÉRFANO E-008 |
| `DOW_CHILE` | `app/components/actualidad-module.tsx:53` (`timeZone` en `:54`) | timestamp real — `hoy` (`:72`) | **`America/Santiago` explícita** | **sí, y es lo correcto** | `seguro`; emisor HUÉRFANO E-008 |
| `fmt` (offset sv-SE) | `app/components/actualidad-module.tsx:95` (`timeZone` en `:96`) | timestamp real sintético (`Date.UTC(...)`, `:91`) | **`America/Santiago` explícita** | **no** — su salida no se muestra (mide el offset) | `seguro`; emisor HUÉRFANO E-008 |
| `DIA_CALENDARIO_CHILE_HOY` | `app/components/estado-actual-block.tsx:152` (`timeZone` en `:153`) | timestamp real — el instante "hoy" | **`America/Santiago` explícita** | **sí, y es lo correcto** | `seguro` — el JSDoc `:145-150` declara la regla 3. Ejemplo canónico de la distinción |
| `formatFechaCaptura` | `app/components/validacion-fuente.tsx:224` (`toLocaleDateString` en `:226`, `timeZone` en `:230`) | timestamp real — `fecha_captura` ISO con hora | **`America/Santiago` explícita** | **sí, y es lo correcto** | `seguro` en el eje tz; el copy que lo rodea (E-027) sí usa el idiom aprobado |
| `formatFetchedAt` | `app/components/validacion-fuente.tsx:237` (`toLocaleDateString` en `:239`, `timeZone` en `:243`) | timestamp real — momento de fetch del snapshot | **`America/Santiago` explícita** | **sí, y es lo correcto** | `seguro` en el eje tz; copy equivalente aprobado ("Respaldo del …") |
| `mesAnioFormatter` (votos) | `app/components/votos-por-parlamentario.tsx:287` (`timeZone:"UTC"` en `:290`) | `Date` sintético `Date.UTC(anio,mes0,1)` (`:298`) | **UTC explícita** | **no** | `seguro` — comentario WR-01 documenta la elección |
| `mesAnioFormatter` (timeline) | `app/components/timeline-view.tsx:29` | `Date` construido por el llamante (`fechaValida`, `:42`) | **implícita del runtime** | **sí en teoría** — solo emite `month`+`year`, el riesgo vive en el borde de mes | `ambiguo` ⇒ **F-10** |
| `fechaConsultaHoy` | `app/app/comparar/page.tsx:54` (`Intl` en `:55`, `timeZone` en `:56`) | timestamp real — `new Date()` por request (`force-dynamic`) | **`America/Santiago` explícita**, locale `en-CA` | **sí, y es lo correcto** | `seguro`. **NO es `fecha_captura`**: es fecha de CONSULTA; comentario `:45-52` declara el idiom "consultado al" |
| `fechaCorta` (local de `/cuenta`) | `app/app/cuenta/page.tsx:90` (`Intl` en `:91`, `timeZone` en `:92`) | timestamp real de un acto del usuario | **`America/Santiago` explícita**, locale `en-CA` | **sí, y es lo correcto** | `seguro`. **Colisión de nombres** con `format.ts:21`, semántica DISTINTA |

**19 filas de datos, cero celdas vacías.**

### 1.1 Chokepoint `ProvenanceBadge` (E-040)

Importado de `116-FORMATTERS.md` §2.1. Anchors re-localizados el 2026-07-28; **todos coinciden**
con los citados en `116-01-PLAN.md`.

| propiedad | línea OBSERVADA | contenido |
|---|---|---|
| prop `capturedAt` | `:38` | `capturedAt: Date \| null;` — doc `:37`: "Momento de captura. `null` → procedencia desconocida." |
| prop `sourceUrl` | `:42` | `sourceUrl: string \| null;` — cara B, auditada por 115 |
| frescura | `:66` | `const stale = capturedAt !== null && esStale(capturedAt);` — umbral REAL **14 días** |
| `displaySource` | `:67` | `capturedAt === null ? "fuente desconocida" : sourceName` |
| guard de href | `:70` | `const safeUrl = safeExternalHref(sourceUrl);` |
| **formatter de la fecha** | `:90` | `<span>Actualizado {relativeTimeEs(capturedAt)}</span>` |
| degradación `null` | `:92` | `<span>Sin fecha de actualización</span>` |
| omisión del tooltip | `:114` | `if (capturedAt === null && safeUrl === null) { return badge; }` — el badge **nunca** se omite |
| tooltip | `:128` | `{capturedAt !== null && <div>{capturedAt.toISOString()}</div>}` |

**Texto VISIBLE exacto** (verificado con `grep -F`): `:90` `Actualizado ` + `relativeTimeEs(...)`;
`:92` `Sin fecha de actualización`; `:95` `{displaySource}` (rama `null` ⇒ `fuente desconocida`);
`:106` `fuente oficial ↗`.

**Veredicto de dato: `captura`** — la única fecha que el badge renderiza llega por `capturedAt`.
**Veredicto de copy: hallazgo** ⇒ **F-01**. La regla 2 **NO** se viola (cero "captura" pelado en
texto visible).

**Denominador de call-sites (grep vivo 2026-07-28): 17 ocurrencias en 15 archivos de producción.**
Los 17 pasan una columna `fecha_captura` genuina ⇒ **cero `HECHO-COMO-CAPTURA`** y **cero
`captura-como-hecho`**. Bajo gate: 5 (4 × MONEY ⇒ no emitido; 2 × CRUCES, sí emitidos). Huérfanos: 2
(`voto-ficha-row.tsx`, E-003).

| # | id | archivo:línea | columna/RPC de origen | veredicto | gate |
|---|---|---|---|---|---|
| 1 | E-048 | `app/app/proyecto/[boletin]/page.tsx:504` | `tabla.tramitacion_evento.fecha_captura` (MAX del set) — ver `### 1.2` | `captura correcta` | — |
| 2 | E-016 | `aportes-por-contraparte.tsx:198` | `tabla.aporte.fecha_captura` | `captura correcta` | MONEY |
| 3 | E-035 | `autor-row.tsx:58` | `tabla.proyecto_autor.fecha_captura` | `captura correcta` | — |
| 4 | E-015 | `contratos-de-parlamentario.tsx:194` | `tabla.contrato.fecha_captura` | `captura correcta` | MONEY |
| 5 | E-014 | `contratos-por-contraparte.tsx:177` | `tabla.contrato.fecha_captura` | `captura correcta` | MONEY |
| 6 | E-053 | `cruces-de-parlamentario.tsx:196` | `tabla.cruce_senal.fecha_captura` (= `now()` del rebuild) | `captura correcta` | CRUCES |
| 7 | E-044 | `cruces-de-proyecto.tsx:178` | `tabla.cruce_senal.fecha_captura` | `captura correcta` | CRUCES |
| 8 | E-043 | `ficha-header.tsx:66` | `tabla.proyecto.fecha_captura` | `captura correcta` | — |
| 9 | E-013 | `financiamiento-de-parlamentario.tsx:233` | `tabla.aporte.fecha_captura` | `captura correcta` | MONEY |
| 10 | E-002 | `lobby-de-parlamentario.tsx:536` | `tabla.lobby_audiencia.fecha_captura` | `captura correcta` | — |
| 11 | E-059 | `parlamentario-header.tsx:116` | `tabla.parlamentario.fecha_captura` | `captura correcta` | — |
| 12 | E-005 | `patrimonio-de-parlamentario.tsx:445` | `tabla.declaracion.fecha_captura` | `captura correcta` | — |
| 13 | E-005 | `patrimonio-de-parlamentario.tsx:769` | `tabla.declaracion.fecha_captura` | `captura correcta` | — |
| 14 | E-056 | `votacion-card.tsx:97` | `tabla.votacion.fecha_captura` | `captura correcta` | — |
| 15 | E-003 | `voto-ficha-row.tsx:135` | `tabla.votacion.fecha_captura` | `captura correcta` | HUÉRFANO |
| 16 | E-003 | `voto-ficha-row.tsx:220` | `tabla.votacion.fecha_captura` | `captura correcta` | HUÉRFANO |
| 17 | E-001 | `votos-por-parlamentario.tsx:546` | `tabla.votacion.fecha_captura` | `captura correcta` | — |

### 1.2 Reconciliación de divergencias

Divergencias entre los tres documentos fuente sobre un mismo emisor o formatter, resueltas leyendo
el código y, donde aplica, el schema de PROD.

| # | divergencia | quién dijo qué | resolución (evidencia) | efecto sobre el veredicto |
|---|---|---|---|---|
| 1 | Origen de `page.tsx:504` | `116-FORMATTERS.md` §2.2 fila 1 ⇒ `tabla.source_snapshot.fecha_captura`; `116-PARCIAL-B.md` nota ¹ ⇒ `tabla.tramitacion_evento.fecha_captura` | **Gana el parcial B.** El `reduce` de `page.tsx:492-497` corre sobre `TramitacionEventoRow[]`. Además PROD confirma que `source_snapshot` **no tiene** columna `fecha_captura` ni `proyecto_id` (solo `fetched_at`, `resource`, `cache_key`) ⇒ la atribución de FORMATTERS era imposible | **ninguno** — sigue siendo `captura correcta`; cambia la columna citada. Se propaga a `### 1.1` fila 1 |
| 2 | Columna de `lobby-en-tramitacion.tsx:144` | `116-03-PLAN.md` `<interfaces>` ⇒ `RPC:lobby_en_tramitacion.fecha`; `116-PARCIAL-B.md` §B.1.1 ⇒ `row.fecha_reunion` (`:123`) | **Gana el parcial B.** El código lee `fechaValida(row.fecha_reunion)`; la columna existe como `timestamptz` en `0048_lobby_en_tramitacion.sql:82` | **ninguno** — `hecho`; cambia la columna citada |
| 3 | E-026 y E-057 sin veredicto del conjunto cerrado | `113-INVENTARIO.md` §3.0 los lista con origen de dato; `116-PARCIAL-A.md` §A.1.bis los declara **sin fecha renderizada** (grep ⇒ 0 matches en ambos archivos) | **Gana el parcial A.** El conjunto cerrado `{hecho, captura, ambigua}` solo tiene sentido sobre una fecha visible | ambos cuentan como **cubiertos por declaración de ausencia** ⇒ van a `## 4.`, no a `## 3.` |
| 4 | Residual E-040 | ningún grupo lo reclamó (partición por carril); `116-PARCIAL-B.md` §B.4 lo declara residual | **Absorbido**: su veredicto viaja desde `116-FORMATTERS.md` §2 a `### 1.1` y a **F-01** de este artefacto | E-040 aparece en `## 3.` como cualquier otro emisor |
| 5 | Umbral de frescura de `esStale` | `113-INVENTARIO.md` §3.1.1, `116-01-PLAN.md` y el JSDoc `provenance-badge.tsx:18` ⇒ **48 h**; `116-FORMATTERS.md` §1.1 ⇒ **14 días** (`format.ts:10`) | **Gana el código:** `STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000` con justificación en `:6-9` (cadence de ingesta semanal) | hallazgo **documental** ⇒ **F-11** |
| 6 | Anchors `:479` y `:494` de `estado-actual-block.tsx` | `113-INVENTARIO.md` §3.0 los **omite**; `116-03-PLAN.md` y `116-PARCIAL-B.md` los incluyen | **Gana el parcial B**: ambas ocurrencias existen dentro de `aria-label` | dos filas más de E-032; 117 debe propagar la corrección al inventario |
| 7 | "Hallazgo de DÍA" de `lobby_audiencia.fecha` | `116-PARCIAL-A.md` §A.2.1 y `116-PARCIAL-B.md` §B.0 lo dan por cierto desde el tipo `timestamptz` | **Gana el dato de PROD** (`## 2.` §2.1): drift **0 / 17.762** — todas las filas a las 04:00 UTC = 00:00 Chile | degradado de hallazgo de dato a **riesgo latente de capa** (F-10). El defecto de copy (sin rótulo) sigue vivo como F-07 |
| 8 | Tipo de `cruces_de_parlamentario.fecha` (`pendiente de confirmar por SQL`) | `116-PARCIAL-A.md` §A.2.1 última fila | **Resuelto por PROD**: `cruce_senal.evidencia` es un objeto con `items[]`, cada uno con `fecha` heredada de `lobby_audiencia.fecha` (04:00 UTC). 2.713 ítems, drift **0** | **cumple** — cero conversión de zona. Sin pendiente |
| 9 | Magnitud del "hallazgo de DÍA" de `votacion.fecha` / `tramitacion_evento.fecha` | ambos parciales lo declaran sin cuantificar | **Cuantificado por PROD**: 27 + 27 filas con hora real que cruzan medianoche UTC; el resto del drift bruto son filas a medianoche UTC (date-only disfrazada) | **CONFIRMADO y acotado** ⇒ **F-05**, con la advertencia de que convertir a Chile rompería 45.618 filas |
| 10 | `estado-actual-block.tsx:429` esperado como hallazgo | el plan lo anticipaba como `captura` presentada como hecho | **Contraejemplo confirmado**: el copy es `según {fuente} al {fecha}.` — idiom aprobado, declarado en el comentario `:405` | **sin hallazgo**; único matiz (MAX del set) se registra en F-03 |

### 1.3 Auditoría date-only (gotcha LOCKED v9.0)

Fusión de `116-PARCIAL-A.md` §A.2.1 (10 filas) y `116-PARCIAL-B.md` §B.2.1 (8 filas), con la
columna de resolución añadida desde la evidencia de PROD de `## 2.` §2.1. Toda fila que los
parciales dejaron `pendiente de confirmar por SQL` queda **resuelta aquí**.

| columna date-only | emisor(es) | formatter | ¿se convierte de zona? | veredicto (resuelto con PROD) |
|---|---|---|---|---|
| `parlamentario_militancia.desde` (`date`, `0059:67`) | E-054 | `fechaCorta(new Date(desde))` (`militancias-de-parlamentario.tsx:26`) | **no** — `new Date("YYYY-MM-DD")` = medianoche UTC; runtime UTC preserva el día | **cumple**; riesgo latente de runtime (F-10). PROD: sujeto D1165 ⇒ `2022-03-11` y `2026-03-11` |
| `parlamentario_militancia.hasta` (`date`, `0059:68`, NULL si vigente) | E-054 | `fechaCorta(new Date(hasta))` (`:27`) / literal `vigente` | **no** — con `null` no se construye `Date` alguno | **cumple**; ausencia honesta verificada. PROD: D1165 no tiene `hasta` NULL (ambos períodos cerrados) |
| `declaracion.fecha_presentacion` (`date not null`, `0022:83`) | E-005 | `fechaCortaSegura` (`patrimonio-de-parlamentario.tsx:418,688,702,729`) | **no** — slice ISO antes de `new Date` | **cumple**. PROD confirma tipo `date`: `2026-03-31` (D1165, 6 filas) |
| `votacion.fecha` (**`timestamptz`**, `0008:40` — NO date-only) | E-001 (`:528`, buckets `:218-220`), E-056 (`votacion-card.tsx:39`), E-008 (`actualidad-module.tsx:202,203`) | `fechaCortaSegura` / `fechaCorta` / `Date.UTC` | **sí, implícitamente a UTC** | **HALLAZGO DE DÍA CONFIRMADO Y ACOTADO** ⇒ **F-05**. PROD: 1.049 de 4.855 filas están a medianoche UTC (date-only disfrazada); solo **27** tienen hora real que cruza el día. Ejemplo: `2023-11-17 00:14:41+00` se rinde `17 nov 2023`, día chileno real **16 nov 2023** |
| `tramitacion_evento.fecha` (**`timestamptz`**, `0008:72` — NO date-only) | E-010, E-032 (`:397,:413`), E-038 (`:82`), E-045 (`:99,:194`), E-008 (`:318`) | `fechaCorta` / `mesAnioFormatter` | **sí, implícitamente a UTC** | **HALLAZGO DE DÍA CONFIRMADO Y ACOTADO** ⇒ **F-05**. PROD: 44.569 de 48.366 a medianoche UTC; drift real **27**. **Convertir a Chile rompería 44.569 filas** |
| `lobby_audiencia.fecha` (**`timestamptz`**, `0021:41`) | E-002 (`:153,:478`), E-020 (`:129`), E-041 (`:144`, vía `fecha_reunion`) | `fechaCorta` sin `timeZone` | **no en la práctica** | **REFUTADO por PROD**: drift **0 / 17.762**; todas las filas a las 04:00 UTC (= 00:00 Chile). Degradado a **riesgo latente** (F-10). El defecto vivo es de copy (F-07) |
| `cruce_senal.evidencia->'items'[].fecha` (heredada de `lobby_audiencia.fecha`) | E-053 (`:178`), E-044 (`:168`) | `fechaCorta` / `fechaCortaSegura` | **no** | **RESUELTO — cumple.** PROD: 2.713 ítems, drift **0**. Cierra el `pendiente de confirmar por SQL` de A.2.1 |
| `contrato.fecha_oc` (`date`, `0023:79`) | E-014 (`:136`), E-015 (`:135`) | `fechaCorta(new Date(...))` | **no** — date-only, runtime UTC preserva el día | **cumple**; riesgo latente de runtime (F-10). PROD: **0 filas** en `contrato` ⇒ respaldado solo por schema |
| `aporte.fecha_aporte` (`date`, `0024:93`) | E-013 (`:176`), E-016 (`:149`) | `fechaCorta(new Date(...))` | **no** | **cumple**; idem. PROD: **0 filas** en `aporte` |
| `contrato.fecha_corte` (`date not null`, `0023:61`) / `aporte.fecha_corte` (`date not null`, `0024:72`) | E-013 (`:179`), E-014 (`:139`), E-015 (`:138`), E-016 (`:152`) | `fechaCorta(new Date(...))` | **no** | **cumple en el eje tz**; el defecto es **de categoría** ⇒ **F-08** |
| `aportes_ingesta_estado.ingestado_hasta` (`date`, `0024:165`) / `contratos_ingesta_estado.ingestado_hasta` (`date`, `0023:136`) | E-013 (`:356`), E-015 (`:226`) | `fechaCorta(new Date(...))` | **no** | **cumple en el eje tz**; defecto de categoría ⇒ **F-08** |
| `citacion.fecha` (render de agenda) | E-004 (`agenda/page.tsx:257,258,438,439`), E-033 (`citacion-card.tsx:67`) | `dayLabelCitacion` / `diaCalendarioCitacion` / `badgeFechaCitacion` | **no** — los tres delegan en `d.toISOString().slice(0,10)` (`dia-calendario.ts:42`) | **correcto** — honra la regla LOCKED. **PROD confirma el contrato: 272/272 filas a medianoche UTC** |
| `citacion.fecha` (cobertura Cámara) | E-004 (`agenda/page.tsx:334,335`) | `diaCalendarioCitacion` sobre `min`/`max` | **no** — comentario `:332-333` declara la razón | **correcto** |
| `citacion.fecha` (predicados de vigencia) | E-032 (`estado-actual-block.tsx:189,221`) | `diaCalendarioCitacion` vs `DIA_CALENDARIO_CHILE_HOY` (`:152`) | **no** para la citación; **sí, y correctamente,** para `hoy` | **correcto** — ejemplo canónico de la distinción (JSDoc `:144-151`) |
| `citacion.fecha` / `sesion_sala.fecha` (**render** en estado-actual) | E-032 (`:445`, `:460`, `:475`, `:479` aria-label, `:494` aria-label, `:497`) | **`fechaCorta`** (sin `timeZone`) | **no HOY, sí latente** — en runtime UTC coincide; basta un runtime en huso negativo para rendir el día anterior | **HALLAZGO** ⇒ **F-09**. Inconsistencia interna: el MISMO archivo prohíbe el patrón en `:145-150` y usa `diaCalendarioCitacion` para la misma columna en `:189/:221`. PROD confirma que las columnas son 100 % medianoche UTC (272/272 y 16/16) ⇒ el patrón es exactamente el que la regla 3 protege |
| `sesion_sala.fecha` (lógica) | E-032 (`:237` vía `semanaIsoChile`, `:270` clave de dedup) | `diaCalendarioCitacion` | **no** — comentario `:229-234` | **correcto** |
| `sesion_tabla_item` (× `sesion_sala`) | E-018 (`sala-table-section.tsx`), E-032 (embed `:551-553`) | `(ninguno en E-018)` — `SalaTablaItem` no expone columna de fecha | **no** — E-018 no formatea fecha alguna | **correcto por ausencia** |
| `citacion.fecha` / `sesion_sala.fecha` agregadas (`actualidad_senal.fecha_max`) | E-055 (`panel-actualidad.tsx:104` vs `:107`) | `diaCalendarioCitacion` para `tipo ∈ TIPOS_AGENDA`; `fechaCorta` para el resto | **no** — ruteo por tipo verificado | **correcto en el ruteo**. **Matiz nuevo de PROD:** *todas* las señales tienen `fecha_max` a medianoche UTC (no solo las `agenda_*`) ⇒ la rama `fechaCorta` está formateando date-only de facto ⇒ riesgo latente (F-10). El `fecha_max` NULL de `agrupacion_materia` se omite honestamente |

**18 filas de datos.** **Conversiones de zona activas sobre date-only: 0** (regla LOCKED 3 respetada
en todo el árbol). **Pendientes sin resolver: 0** — los dos `pendiente de confirmar por SQL` de los
parciales quedaron cerrados con evidencia de PROD.

### 1.4 Tabla única de veredictos por emisor × fecha

Fusión de `116-PARCIAL-A.md` §A.1 + §A.2 y `116-PARCIAL-B.md` §B.1 + §B.2, ordenada por id `E-xxx`
ascendente, con las 9 columnas conservadas. La columna `¿miente o es ambigua?` lleva el puntero
`F-xx` al hallazgo de `## 3.`; el razonamiento largo vive en los parciales, que siguen en el repo.

| id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO | etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate |
|---|---|---|---|---|---|---|---|---|
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:528` | `fechaCortaSegura` | `RPC:votos_de_parlamentario.fecha` ← `votacion.fecha` | hecho | `(sin rótulo)` — fecha sola en `font-mono` entre la etapa y `· el proyecto fue {resultado}` | sí — F-07 (sin rótulo) + F-05 (día UTC, 27 filas en PROD) | — |
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:287` (render `:446,450,451`) | `mesAnioFormatter` (`timeZone:"UTC"`) | min/max de `RPC:votos_de_parlamentario.fecha` | hecho | `en {mesInicio}` / `entre {mesInicio} y {mesFin}` | no — `timeZone:"UTC"` explícita + base `Date.UTC` | — |
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:546` | `relativeTimeEs` vía `ProvenanceBadge` | `votacion.fecha_captura` | captura | `Actualizado {relativeTimeEs(capturedAt)}` | sí — F-01 (idiom no aprobado) | — |
| E-002 | `/parlamentario/[id]#lobby` (agrupada) | `lobby-de-parlamentario.tsx:153` (render `:441`) | `fechaCorta(new Date(a.fecha))` | `RPC:lobby_de_parlamentario.fecha` ← `lobby_audiencia.fecha` | hecho | `(sin rótulo)` — `{r.fechaTexto}` en `font-mono`; fallback `Fecha no publicada` | sí — F-07. El hallazgo de DÍA queda **refutado** por PROD (drift 0/17.762) | — |
| E-002 | `/parlamentario/[id]#lobby` (cronológica) | `lobby-de-parlamentario.tsx:478` (render `:487`) | `fechaCorta(new Date(a.fecha))` | `RPC:lobby_de_parlamentario.fecha` | hecho | `(sin rótulo)` — comentario `:485` la nombra "Fecha de la audiencia (mono)"; fallback `Fecha no publicada` | sí — F-07 | — |
| E-002 | `/parlamentario/[id]#lobby` | `lobby-de-parlamentario.tsx:536` | `relativeTimeEs` vía badge | `lobby_audiencia.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | — |
| E-003 | `—` (HUÉRFANO) | `voto-ficha-row.tsx:135` | `relativeTimeEs` vía badge | `RPC:votos_de_parlamentario.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 (vale si alguien re-monta el componente) | HUÉRFANO |
| E-003 | `—` (HUÉRFANO) | `voto-ficha-row.tsx:220` | `relativeTimeEs` vía badge | `RPC:votos_de_parlamentario.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | HUÉRFANO |
| E-003 | `—` (HUÉRFANO) | `voto-ficha-row.tsx:174` | `(ninguno)` | `RPC:votos_de_parlamentario.fecha` reenviada, **sin render** | ambigua | `(sin render)` | no — cierra el par `.fecha`/`.fecha_captura`: `.fecha` nunca llega a un render | HUÉRFANO |
| E-004 | `/agenda` | `agenda/page.tsx:257,:258` | `dayLabelCitacion` | `citacion.fecha` (date-only, 272/272 medianoche UTC en PROD) | hecho | `{dayLabelCitacion(c.fecha)}` ⇒ p. ej. `Lunes 22 de junio` | no — delega en `diaCalendarioCitacion`, mediodía UTC para el weekday | — |
| E-004 | `/agenda` (cobertura Cámara) | `agenda/page.tsx:334,:335` | `diaCalendarioCitacion` | `min(citacion.fecha)` / `max(citacion.fecha)` | hecho | `(sin render directo)` — alimenta `semanasEntre(...)` | no — uso correcto, comentario `:332-333` | — |
| E-004 | `/agenda` | `agenda/page.tsx:438,:439` | `diaCalendarioCitacion` + `dayLabelCitacion` | `citacion.fecha` | hecho | `dayLabel` visible como cabecera de día; degradación `Sin fecha asignada` | no — uso correcto, calculado en el SERVER | — |
| E-004 | `/agenda` | `agenda/page.tsx:461` | `relativeTimeEs` vía badge | `citacion.fecha_captura` | captura | `Actualizado {…}` | sí — F-01 | — |
| E-004 | `/agenda` (tabla de sala) | `agenda/page.tsx:502` | `relativeTimeEs` vía badge | `sesion_sala.fecha_captura` | captura | `Actualizado {…}` | sí — F-01 | — |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:418` (render `:453`, `:458`) | `fechaCortaSegura` | `RPC:declaraciones_de_parlamentario.fecha_presentacion` (`date`) | hecho | `Presentada el {fechaTexto}`; histórica: `Esta es una declaración histórica, presentada el {fechaTexto}. No representa necesariamente el estado actual.` | no — rótulo explícito del hecho | — |
| E-005 | `/parlamentario/[id]` (form de comparación) | `patrimonio-de-parlamentario.tsx:688`, `:702` | `fechaCortaSegura` | `.fecha_presentacion` (lista `fechasDisponibles`) | hecho | `Presentada el {fechaCortaSegura(f)}` en cada `<option>` | no — idem | — |
| E-005 | `/parlamentario/[id]` (tabla comparativa) | `patrimonio-de-parlamentario.tsx:729` | `fechaCortaSegura` | `RPC:comparar_declaraciones.fecha_presentacion` | hecho | `Presentada el {fechaCortaSegura(c.fecha_presentacion)}` en `<TableHead>` | no — idem | — |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:445` | `relativeTimeEs` vía badge | `declaracion.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | — |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:769` | `relativeTimeEs` vía badge | `RPC:comparar_declaraciones` ← `declaracion.fecha_captura` | captura | `Actualizado {…}` (un badge por columna comparada) | sí — F-01 | — |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:989` | `(ninguno)` | `tabla.probidad_ingesta_estado` — el `select` es `parlamentario_id`, **cero columna de fecha** | hecho | `(sin fecha renderizada)` — la frescura se usa como booleano `noIngestado` | no — el anchor no emite fecha alguna | — |
| E-008 | `—` (HUÉRFANO) | `actualidad-module.tsx:202,:203` | `fechaCorta` | `votacion.fecha` (`timestamptz`) | hecho | `{fechaCorta(it.fecha)} · {camaraLabel(it.camara)}` / `Votación del {fechaCorta(it.fecha)}` | sí — F-05 (día UTC) | HUÉRFANO |
| E-008 | `—` (HUÉRFANO) | `actualidad-module.tsx:318` | `fechaCorta` | `tramitacion_evento.fecha` vía `it.desde` | hecho | `desde {fechaCorta(it.desde)}` | sí — F-05 | HUÉRFANO |
| E-008 | `—` (HUÉRFANO) | `actualidad-module.tsx:451` | `fechaCorta` | **`max(fecha_captura)`** de seis tablas NO-PII (`FUENTES_FRESCURA`) | **captura** | `Última actualización de datos` + `{it.fuente}` `{fechaCorta(it.fecha)}` ⇒ p. ej. `Votaciones 27 jul 2026` | sí — **F-06**: afirma que el DATO cambió cuando mide el último scraping (regla LOCKED 1) | HUÉRFANO |
| E-008 | `—` (HUÉRFANO) | `actualidad-module.tsx:46` | `FECHA_CHILE` (`timeZone` explícita) | el INSTANTE ACTUAL (`hoy`) | hecho | `(sin render — término de cálculo del lunes ISO)` | no — timestamp real ⇒ convertir a Chile es correcto | HUÉRFANO |
| E-008 | `—` (HUÉRFANO) | `actualidad-module.tsx:53` | `DOW_CHILE` (`timeZone` explícita) | el INSTANTE ACTUAL (`hoy`) | hecho | `(sin render — weekday para hallar el lunes ISO)` | no — idem; JSDoc `:58-66` justifica el anclaje | HUÉRFANO |
| E-008 | `—` (HUÉRFANO) | `actualidad-module.tsx:95` | `fmt` (`sv-SE`, `timeZone` explícita) | `new Date(mediodia)` sintético | hecho | `(sin render — mide el offset de Santiago)` | no — su salida no se muestra | HUÉRFANO |
| E-010 | `/proyecto/[boletin]` | `timeline-view.tsx:29` (render `:221,:222`) | `mesAnioFormatter` **sin `timeZone`** | `tramitacion_evento.fecha` vía `PeriodoUrgencia.desde/hasta` | hecho | `Urgencia {tipo}: {N} eventos en {mesX}` / `… entre {mesX} y {mesY}`; sin fecha válida el rango se OMITE | sí — F-10 (bucket mes/año depende del huso del runtime) | — |
| E-012 | `/parlamentarios` | `parlamentario-directory-row.tsx:48` | `(ninguno — propaga)` | `RPC:parlamentarios_publico_v2.partido_fecha_captura` → prop `fechaCaptura` | captura | `(sin rótulo propio)` — el veredicto efectivo es el de E-019 | no — propagación sin copy propio | — |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:176` (render `:213`) | `fechaCorta` | `RPC:aportes_de_parlamentario.fecha_aporte` ← `aporte.fecha_aporte` (`date`) | hecho | `<dt>Fecha del aporte:</dt>` + `<dd>{fechaAporteTexto}</dd>`; sin valor ⇒ `Fecha no publicada` | no — NOUN-label explícito del hecho | MONEY — no emitido |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:179` (render `:223-224`) | `fechaCorta` | `aporte.fecha_corte` (`date not null`) | ambigua | `Consultado por nombre del candidato, corte al {fechaCorteTexto}.` | sí — **F-08** (ambigua por categoría) | MONEY — no emitido |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:356` (render `:363-365`) | `fechaCorta` | `aportes_ingesta_estado.ingestado_hasta` (`date`) | ambigua | `Consultamos SERVEL por este candidato (corte al {fechaTexto}) y no se registran aportes asociados a ese candidato a esa fecha.` | sí — **F-08** (cobertura de ingesta bajo el rótulo de `fecha_corte`) | MONEY — no emitido |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:233` | `relativeTimeEs` vía badge | `aporte.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | MONEY — no emitido |
| E-014 | `/contraparte/[id]` | `contratos-por-contraparte.tsx:136` (render `:159`) | `fechaCorta` | `RPC:agregado_por_contraparte` ← `contrato.fecha_oc` (`date`) | hecho | `<dt>Fecha de la orden:</dt>` + `<dd>{fechaOcTexto}</dd>` | no — NOUN-label explícito del hecho | MONEY — no emitido |
| E-014 | `/contraparte/[id]` | `contratos-por-contraparte.tsx:139` (render `:167-168`) | `fechaCorta` | `contrato.fecha_corte` (`date not null`) | ambigua | `Consolidado, corte al {fechaCorteTexto}.` | sí — **F-08**, agravada: "Consolidado" no dice de QUÉ es el corte ni quién consolidó | MONEY — no emitido |
| E-014 | `/contraparte/[id]` | `contratos-por-contraparte.tsx:177` | `relativeTimeEs` vía badge | `contrato.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | MONEY — no emitido |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:135` (render `:176`) | `fechaCorta` | `RPC:contratos_de_parlamentario.fecha_oc` ← `contrato.fecha_oc` (`date`) | hecho | `<dt>Fecha de la orden:</dt>` + `<dd>{fechaOcTexto}</dd>` | no — NOUN-label explícito del hecho | MONEY — no emitido |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:138` (render `:184-185`) | `fechaCorta` | `contrato.fecha_corte` (`date not null`) | ambigua | `Consultado por RUT, corte al {fechaCorteTexto}.` | sí — **F-08** | MONEY — no emitido |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:226` (render `:233-235`) | `fechaCorta` | `contratos_ingesta_estado.ingestado_hasta` (`date`) | ambigua | `Consultamos ChileCompra por el RUT de este parlamentario (corte al {fechaTexto}) y no se registran contratos asociados a ese RUT a esa fecha.` | sí — **F-08** | MONEY — no emitido |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:194` | `relativeTimeEs` vía badge | `contrato.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | MONEY — no emitido |
| E-016 | `/contraparte/[id]` | `aportes-por-contraparte.tsx:149` (render `:178`) | `fechaCorta` | `RPC:agregado_por_contraparte` ← `aporte.fecha_aporte` (`date`) | hecho | `<dt>Fecha del aporte:</dt>` + `<dd>{fechaAporteTexto}</dd>` | no — NOUN-label explícito del hecho | MONEY — no emitido |
| E-016 | `/contraparte/[id]` | `aportes-por-contraparte.tsx:152` (render `:188-189`) | `fechaCorta` | `aporte.fecha_corte` (`date not null`) | ambigua | `Consolidado, corte al {fechaCorteTexto}.` | sí — **F-08** | MONEY — no emitido |
| E-016 | `/contraparte/[id]` | `aportes-por-contraparte.tsx:198` | `relativeTimeEs` vía badge | `aporte.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 | MONEY — no emitido |
| E-018 | `/agenda` (tabla semanal de sala) | `sala-table-section.tsx` (archivo completo, 162 líneas) | `(ninguno)` | `sesion_tabla_item` — **cero columna de fecha** en `SalaTablaItem` | hecho | `(sin fecha renderizada)`; la referencia temporal es `weekLabel`, etiqueta de SEMANA | no — el emisor no formatea fecha alguna (grep vivo ⇒ 0) | — |
| E-018 | `/agenda` (tabla semanal de sala) | `sala-table-section.tsx:33` (render `:59`) | `relativeTimeEs` vía badge | `sesion_sala.fecha_captura` (pasada por E-004 `:502`) | captura | `Actualizado {…}` | sí — F-01 (veredicto efectivo en E-004 `:502`) | — |
| E-019 | `/parlamentarios`, `/parlamentario/[id]` | `partido-chip.tsx:65` (rótulo `:73` / `:112-116`) | `fechaCorta` | `partido_fecha_captura` (militancia vigente) | captura | `según {fuente} al {fecha}`; sin fecha: `según {fuente}`; `aria-label` = `Partido: {nombre}, {provenance}` | **no — usa el idiom aprobado**; jamás fabrica fecha. Nota de capa: `fechaCorta` sin `timeZone` (F-10) | — |
| E-020 | `/proyecto/[boletin]#lobby` | `lobby-menciones-de-boletin.tsx:129` (derivación `:110`) | `fechaCorta` | `RPC:lobby_menciones_de_boletin.fecha` ← `lobby_audiencia.fecha` | hecho | `(sin rótulo)` — `{fechaCorta(fecha)} · ` en `font-mono` antes del nombre | sí — F-07. El hallazgo de DÍA queda **refutado** por PROD (drift 0) | — |
| E-026 | `/proyecto/[boletin]`, `/parlamentario/[id]` | `voto-row.tsx` (archivo completo, 63 líneas) | `(ninguno)` | `votacion.fecha` **no llega al JSX** | hecho | `(sin fecha renderizada)` — el componente emite nombre + `Badge` de selección | no — **declaración de ausencia** (grep ⇒ 0 matches en 63 líneas). Ver `### 1.2` fila 3 | — |
| E-027 | `/proyecto/[boletin]` ("Valida este dato en la fuente") | `validacion-fuente.tsx:226` (render `:140`) | `formatFechaCaptura` (`timeZone: America/Santiago`) | `proyecto.fecha_captura` (`timestamptz` real) | captura | `según fuente al {fechaDisplay}` | **no — idiom aprobado**; timestamp real ⇒ convertir a Chile es correcto | — |
| E-027 | `/proyecto/[boletin]` (bloque "Respaldo R2") | `validacion-fuente.tsx:239` (render `:190`) | `formatFetchedAt` (`timeZone: America/Santiago`) | `source_snapshot.fetched_at` (`timestamptz`) | captura | `Respaldo del {fetched_at} · hash {…}` + `Esto decía la fuente ese día.` | **no — equivalente aprobado del idiom**; declara el scraping como scraping | — |
| E-028 | `/buscar` | `search-result-card.tsx:66,:71` | `(ninguno — `String(anio)`)` | `props.anio` — JSDoc `:35-38`: "Año derivado del primer evento de tramitación (proxy de ingreso)" | **ambigua** | `{anio != null ? String(anio) : "Sin dato"}` — chip sin rótulo | sí — **F-12**: proxy presentado como año pelado; además **inerte** (ningún call-site de producción pasa `anio=`) | — |
| E-028 | `/buscar` | `search-result-card.tsx:27` | `relativeTimeEs` vía badge | `RPC:match_proyectos` / `RPC:buscar_proyectos_hibrido` → `proyecto.fecha_captura` | captura | `Actualizado {…}` | sí — F-01 | — |
| E-028 | `/buscar` | `search-result-card.tsx` (archivo completo, 98 líneas) | `(ninguno)` | `—` (sin otra columna de fecha) | hecho | `(sin otra fecha)` — el JSDoc `:17-20` y `:37` prohíben LOCKED mostrar score/cosine/rank | no — declaración de ausencia (grep ⇒ 0) | — |
| E-032 | `/proyecto/[boletin]` ("¿Dónde está hoy?") | `estado-actual-block.tsx:397` | `fechaCorta` | `tramitacion_evento.fecha` vía `ultimoHito.fecha` | hecho | `Último hito: {descripcion} — {fechaCorta(ultimoHito.fecha)}` | sí — F-05 (día UTC) + **F-04** (aquí se rinde el `2626-05-25` corrupto) | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:413` | `fechaCorta` | `tramitacion_evento.fecha` vía `urgenciaEstado.desde` | hecho | `Urgencia {tipo} vigente desde el {fechaCorta(urgenciaEstado.desde)} (…)` | sí — F-05 | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:417` | `relativeTimeEs` | mismo `urgenciaEstado.desde` ← `tramitacion_evento.fecha` | hecho | `({relativeTimeEs(urgenciaEstado.desde)}).` | sí — **F-13**: vocabulario de captura aplicado a un hecho, y a ≥7 d duplica la fecha absoluta de `:413` | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:429` | `fechaCorta` | **`tramitacion_evento.fecha_captura`** (MAX del set) | **captura** | `según {sourceLabel(urgenciaFuente.origen)} al {fechaCorta(urgenciaFuente.fechaCaptura)}.` | **no — idiom aprobado ya en producción** (contraejemplo confirmado). Único matiz: MAX del set ⇒ F-03 | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:445` | `fechaCorta` | `citacion.fecha` (**date-only**, 272/272 medianoche UTC en PROD) | hecho | `Citado en {comision} el {fechaCorta(citacionVigente.fecha)}.` | sí — **F-09** (date-only con formatter sin `timeZone`, contra el propio JSDoc `:145-150`) | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:460` | `fechaCorta` | `citacion.fecha` (**date-only**) | hecho | `Citado el {fechaCorta(c.fecha)} en {c.comision} (sesión pasada)` | sí — **F-09** | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:475` | `fechaCorta` | `sesion_sala.fecha` (**date-only**, 16/16 medianoche UTC en PROD) | hecho | `En tabla de sala de la {camaraNombre(...)} del {fechaCorta(...)} ver en la agenda` | sí — **F-09** | — |
| E-032 | `/proyecto/[boletin]` (**`aria-label`**) | `estado-actual-block.tsx:479` | `fechaCorta` | `sesion_sala.fecha` (**date-only**) | hecho | `En tabla de sala de la ${camaraNombre(...)} del ${fechaCorta(...)} — ver en la agenda` | sí — **F-09**, propagado al canal accesible (única vía por la que el lector de pantalla recibe el contexto) | — |
| E-032 | `/proyecto/[boletin]` (**`aria-label`**) | `estado-actual-block.tsx:494` | `fechaCorta` | `sesion_sala.fecha` (**date-only**) | hecho | `En tabla de sala de la ${camaraNombre(s.camara)} del ${fechaCorta(s.fecha)} — ver en la agenda` | sí — **F-09** | — |
| E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:497` | `fechaCorta` | `sesion_sala.fecha` (**date-only**) | hecho | `{camaraNombre(s.camara)}, {fechaCorta(s.fecha)}` bajo `En tabla de sala {N} veces:` | sí — **F-09** | — |
| E-032 | `/proyecto/[boletin]` (lógica) | `estado-actual-block.tsx:189` | `diaCalendarioCitacion` | `citacion.fecha` (date-only) | hecho | `(sin render — predicado de vigencia)` | no — uso CORRECTO del contrato date-only | — |
| E-032 | `/proyecto/[boletin]` (lógica) | `estado-actual-block.tsx:221` | `diaCalendarioCitacion` | `citacion.fecha` (date-only) | hecho | `(sin render — predicado de citaciones pasadas)` | no — uso correcto | — |
| E-032 | `/proyecto/[boletin]` (lógica) | `estado-actual-block.tsx:237` | `diaCalendarioCitacion` (`semanaIsoChile`) | `sesion_sala.fecha` (date-only) | hecho | `(sin render directo)` — alimenta `isoWeekOf` → `/agenda?semana=…` | no — uso correcto y documentado (`:229-234`) | — |
| E-032 | `/proyecto/[boletin]` (lógica) | `estado-actual-block.tsx:270` | `diaCalendarioCitacion` | `sesion_sala.fecha` (date-only) | hecho | `(sin render — clave de deduplicación WR-02)` | no — uso correcto | — |
| E-032 | `/proyecto/[boletin]` (lógica) | `estado-actual-block.tsx:152` | `DIA_CALENDARIO_CHILE_HOY` (`timeZone` explícita) | el INSTANTE ACTUAL (`hoy = new Date()`) | hecho | `(sin render — término de comparación `hoyChile`)` | no — uso CORRECTO; ejemplo canónico de la distinción (JSDoc `:144-151`) | — |
| E-033 | `/agenda` | `citacion-card.tsx:67` (render `:76-78`) | `badgeFechaCitacion` | `citacion.fecha` (**date-only**) | hecho | `{[fechaLabel, horario].filter(Boolean).join(" · ")}` ⇒ p. ej. `20-jul · 15:00` | no — delega en `diaCalendarioCitacion`; la hora real vive en `horario`, columna aparte | — |
| E-033 | `/agenda` | `citacion-card.tsx:45` (prop `provenance`) | `relativeTimeEs` vía badge | `citacion.fecha_captura` (pasada por E-004 `:461`) | captura | `Actualizado {…}` | sí — F-01 (veredicto efectivo en E-004 `:461`) | — |
| E-035 | `/proyecto/[boletin]#autores` | `autor-row.tsx:58` | `relativeTimeEs` vía badge, `densidad="lista"` | `proyecto_autor.fecha_captura` | captura | `Actualizado {…}`; en `densidad="lista"` la leyenda viaja en tooltip | sí — F-01 | — |
| E-035 | `/proyecto/[boletin]#autores` | `autor-row.tsx` (archivo completo, 69 líneas) | `(ninguno)` | `proyecto_autor` — el JSX solo emite `autor.autor_crudo` | hecho | `(sin otra fecha renderizada)` | no — declaración de ausencia | — |
| E-038 | `/proyecto/[boletin]` (timeline capa-2) | `timeline-event.tsx:82` (derivación `:47`) | `fechaCorta` | `tramitacion_evento.fecha` (`timestamptz`) | hecho | `(sin rótulo)` — `{fechaCorta(fecha)}` en `font-mono` junto al `CamaraChip`; sin fecha el span se omite | sí — F-07 + F-05 + **F-04** (renderiza el `2626-05-25`) | — |
| E-040 | **transversal — 15 archivos de producción, 17 call-sites** | `provenance-badge.tsx:90` (degradación `:92`, tooltip `:128`) | `relativeTimeEs` | prop `capturedAt` ← `fecha_captura` de 9 tablas distintas | **captura** | `Actualizado {relativeTimeEs(capturedAt)}` ⇒ p. ej. `Actualizado hace 3 días`; rama `null`: `Sin fecha de actualización` + `fuente desconocida` | sí — **F-01** (idiom no aprobado sobre reloj de scraping) y **F-11** (JSDoc `:18` miente sobre el umbral). Regla 2 satisfecha: cero "captura" pelado | — |
| E-041 | `/proyecto/[boletin]#lobby` | `lobby-en-tramitacion.tsx:144` (derivación `:123`) | `fechaCorta` | `RPC:lobby_en_tramitacion.fecha_reunion` ← `lobby_audiencia.fecha` — ver `### 1.2` fila 2 | hecho | `Reunión registrada el {fechaCorta(fecha)} · semana {row.semana_iso}`; sin fecha: `Reunión registrada · semana {…}` | no — **rótulo explícito del hecho, sin verbo causal**; el hallazgo de DÍA queda refutado por PROD (drift 0) | — |
| E-043 | `/proyecto/[boletin]` (header) | `ficha-header.tsx:66` (derivación `:19-21`) | `relativeTimeEs` vía badge | `proyecto.fecha_captura` | captura | `Actualizado {…}` | sí — F-01 | — |
| E-043 | `/proyecto/[boletin]` (header) | `ficha-header.tsx` (archivo completo, 94 líneas) | `(ninguno)` | `proyecto` — el header emite etapa, cámara, título, boletín, chips y autores | hecho | `(sin fecha del hecho renderizada)` | no — declaración de ausencia | — |
| E-044 | `/proyecto/[boletin]#cruces` | `cruces-de-proyecto.tsx:168` | `fechaCortaSegura` | `RPC:cruces_de_proyecto.evidencia[].fecha` ← `lobby_audiencia.fecha` | hecho | `Reunión registrada el {fechaCortaSegura(item.fecha)}`; sin fecha, la línea se OMITE entera | no — rótulo explícito del hecho; PROD confirma drift **0** sobre 2.713 ítems | CRUCES (ON) |
| E-044 | `/proyecto/[boletin]#cruces` | `cruces-de-proyecto.tsx:178` (comentario `:173-174`) | `relativeTimeEs` vía badge, `densidad="lista"` | `cruce_senal.fecha_captura` (FULL REBUILD diario) | captura | `Actualizado {…}` | sí — F-01 + **F-02** (la captura es del rebuild, no de la fuente). El llamante ya evitó el error (a): comentario declara `NO item.fecha` | CRUCES (ON) |
| E-045 | `/proyecto/[boletin]` (stepper capa-1) | `tramitacion-stepper.tsx:99` (derivación `:79`) | `fechaCorta` | `tramitacion_evento.fecha` (`timestamptz`) | hecho | `(sin rótulo)` — `{fechaCorta(d)}` en `font-mono` pegada a `{evento.descripcion}`; omisión honesta si no es válida | sí — F-07 + F-05 + **F-04** | — |
| E-045 | `/proyecto/[boletin]` (urgencia vigente) | `tramitacion-stepper.tsx:194` | `fechaCorta` | `estado.urgenciaVigente.desde` ← `tramitacion_evento.fecha` | hecho | `Urgencia {tipo} vigente desde el {fechaCorta(...)}.` | sí — F-05; rótulo del hecho explícito | — |
| E-048 | `/proyecto/[boletin]` (bloque idea matriz) | `app/app/proyecto/[boletin]/page.tsx:398` (badge en `idea-matriz-block.tsx:49`) | `relativeTimeEs` vía badge | `proyecto_ficha.fecha_captura` | captura | `Actualizado {…}` + `{sourceName}`, junto a un `<blockquote>` con la cita literal de la idea matriz | sí — F-01, **agravado por el contexto**: junto a una cita textual "Actualizado hace X" se lee como "esta cita cambió" | — |
| E-048 | `/proyecto/[boletin]` (heading "Tramitación") | `app/app/proyecto/[boletin]/page.tsx:504` | `relativeTimeEs` vía badge | `tramitacion_evento.fecha_captura` **MAX** del set (reduce `:492-497`) — ver `### 1.2` fila 1 | captura | `Actualizado {…}` a la derecha del `<h2>Tramitación</h2>`; `sourceUrl={null}` ⇒ badge sin link | sí — F-01 + **F-03** (MAX de un set: un evento antiguo re-scrapeado hoy hace que la sección entera diga "Actualizado hace 0 min") | — |
| E-051 | `/comparar` | `comparar/page.tsx:524-525` (render `similitud-votacion-comparar.tsx:134-135`) | `String(...).slice(0,10)` | `RPC:coincidencia_votos_par.fecha_captura_max` | captura | `Fuente: votaciones de Cámara y Senado · según fuente al {fechaCaptura}.` | **no — idiom aprobado**; PROD confirma que es MAX de capturas (2026-07-27) ≠ MAX del hecho (2026-07-22) | VSIM (ON) |
| E-051 | `/comparar` | `comparar/page.tsx:54` (valor `:234`) | `fechaConsultaHoy` (`en-CA`, `timeZone: America/Santiago`) | `new Date()` por request — **fecha de CONSULTA**, no una columna | hecho | `Fuente: BCN · consultado al {fechaConsulta}`; `Fuente: Cámara/Senado · consultado al {fechaConsulta}`; degradado VSIM: `Sin votaciones compartidas suficientes en las fuentes consultadas al {fechaConsulta}.` | no — el hecho ES la consulta y el idiom lo dice literalmente | VSIM |
| E-051 | `/comparar` (eje comisiones) | `comparar/page.tsx:318-325` | `.slice(0,10)` + guard ISO + `sort().at(-1)` | `RPC:comisiones_de_parlamentario.fecha_captura` (máx. entre A y B) | captura | `Fuente: Cámara/Senado · según fuente al {fechaFuenteComisiones}`; sin filas cae a `… · consultado al {fechaConsulta}` | no — idiom aprobado y degradación honesta | — |
| E-052 | `/cuenta` | `cuenta/page.tsx:90` (render `:282`) | `fechaCorta` local (`timeZone: America/Santiago`) | `consentimiento.created_at` (`timestamptz`, 0 filas en PROD) | hecho | `Consentimiento registrado el {fecha} · versión {version_texto} del texto informado.` | no — el hecho ES el acto del propio usuario; tz explícita ⇒ día chileno correcto | NOTIF — no emitido |
| E-052 | `/cuenta` | `cuenta/page.tsx:90` (render `:310`) | `fechaCorta` local | `suscripcion.created_at` (`timestamptz`, 0 filas en PROD) | hecho | `Suscrito el {fecha}` | no — idem | NOTIF — no emitido |
| E-053 | `/parlamentario/[id]` | `cruces-de-parlamentario.tsx:178` | `fechaCorta(new Date(item.fecha))` | `RPC:cruces_de_parlamentario.fecha` ← `cruce_senal.evidencia` ← `lobby_audiencia.fecha` | hecho | `Reunión registrada el {fechaCorta(new Date(item.fecha))}`; sin fecha la línea se omite entera | no — rótulo explícito del hecho; PROD: drift **0** sobre 2.713 ítems | CRUCES (ON) |
| E-053 | `/parlamentario/[id]` | `cruces-de-parlamentario.tsx:196` | `relativeTimeEs` vía badge | `cruce_senal.fecha_captura` (= `now()` del FULL REBUILD diario) | captura | `Actualizado {…}`, `densidad="lista"` | sí — F-01 + **F-02**. PROD: min = max al microsegundo (`2026-07-28 03:23:00.035505+00`) ⇒ es el reloj del pipeline | CRUCES (ON) |
| E-054 | `/parlamentario/[id]` | `militancias-de-parlamentario.tsx:26` (render `:64`, `:89`) | `fechaCorta(new Date(desde))` | `parlamentario_militancia.desde` (`date`) | hecho | Vigente: `{desde} – vigente`; histórica: `{desde} – {hasta}`; sin `desde` ⇒ literal `sin fecha` | no — fecha del hecho; riesgo latente de capa (F-10) | — |
| E-054 | `/parlamentario/[id]` | `militancias-de-parlamentario.tsx:27` (render `:64`, `:89`) | `fechaCorta(new Date(hasta))` / literal | `parlamentario_militancia.hasta` (`date`) | hecho | Con `hasta`: la fecha en `font-mono`. **Sin `hasta`: literal `vigente`** — cero `new Date()` | no — **ausencia honesta verificada**: no se fabrica fecha cuando `hasta` es `null` | — |
| E-055 | `/` (home, panel de actualidad) | `panel-actualidad.tsx:104` (render `:166`, `:187`) | `diaCalendarioCitacion` | `RPC:actualidad_senales_panel.fecha_max` para `tipo ∈ TIPOS_AGENDA` (date-only) | hecho | `{rotulo}` — el día publicado en ISO `YYYY-MM-DD` dentro del tile | no en el ruteo (correcto) — pero sí **F-14**: el rótulo sale en ISO crudo, no en formato humano es-CL | — |
| E-055 | `/` (home, panel de actualidad) | `panel-actualidad.tsx:107` | `fechaCorta` | `actualidad_senal.fecha_max` para el resto de tipos | hecho | `{rotulo}` formateado es-CL; `null` ⇒ el rótulo se OMITE (honest-state) | sí — F-10. **PROD añade matiz:** *todas* las señales tienen `fecha_max` a medianoche UTC ⇒ esta rama formatea date-only de facto | — |
| E-056 | `/proyecto/[boletin]#votaciones` | `votacion-card.tsx:39` (derivación `:22`) | `fechaCorta` | `votacion.fecha` (`timestamptz`) | hecho | `(sin rótulo)` — `{fechaCorta(fecha)}` en `font-mono` junto al `CamaraChip` | sí — F-07 + F-05 (misma columna que E-001, vista desde el otro carril) | — |
| E-056 | `/proyecto/[boletin]#votaciones` | `votacion-card.tsx:97` (derivación `:23-25`) | `relativeTimeEs` vía badge, `densidad="lista"` | `votacion.fecha_captura` | captura | `Actualizado {…}` | sí — F-01. Nota positiva: la fecha del hecho se rinde **fuera** del badge (separación correcta) | — |
| E-057 | `/parlamentario/[id]` | `comisiones-de-parlamentario.tsx` (archivo completo, 73 líneas) | `(ninguno)` | `RPC:comisiones_de_parlamentario` — usa `nombre`, `tipo`, `cargo` | hecho | `(sin fecha renderizada)` — `lineaComision` compone `nombre · tipo · cargo`; el empty-state tampoco lleva fecha | no — **declaración de ausencia** (grep ⇒ 0 matches). Ver `### 1.2` fila 3 | — |
| E-058 | `/proyecto/[boletin]` (bloque idea matriz) | `idea-matriz-block.tsx:49` (prop `:25`) | `relativeTimeEs` vía badge (consumidor de props) | `props.provenance` ← `proyecto_ficha.fecha_captura` (construido en `page.tsx:396-405`) | captura | `Actualizado {…}` bajo el `<blockquote>`; el componente **no emite copy de fecha propio** | no — propagación sin copy propio; el hallazgo efectivo es el de E-048 `:398` | — |
| E-058 | `/proyecto/[boletin]` (rama degradada) | `idea-matriz-block.tsx:29-41` | `(ninguno)` | `proyecto_ficha.idea_matriz` — rama `null` | hecho | `Idea matriz no disponible` + `El texto íntegro de este proyecto no pudo obtenerse de la fuente oficial, por lo que no se ha extraído su idea matriz. Puedes consultar el proyecto completo en la fuente original.` | no — **cero fecha en la rama degradada** (ni badge). La degradación honesta no fabrica fecha | — |
| E-059 | `/parlamentario/[id]` | `parlamentario-header.tsx:116` (valor `:37-39`) | `relativeTimeEs` vía badge | `RPC:parlamentario_publico_v2.fecha_captura` ← `parlamentario.fecha_captura` | captura | `Actualizado {…}` (badge de cabecera, densidad por defecto) | sí — F-01. PROD: D1165 ⇒ `2026-07-22`, S1338 ⇒ `2026-07-27` | — |
| E-060 | `/contraparte/[id]` | `contraparte/[id]/page.tsx:19` (gate `:50-51`) | `(ninguno)` | `RPC:agregado_por_contraparte` — la página no formatea ninguna fecha; delega en E-014/E-016 | ambigua | `(sin render propio)` — su único match de `ProvenanceBadge` es un COMENTARIO de docstring | no — no hay copy propio que pueda mentir. Verificado sin encender flag: `notFound()` es la primera sentencia ⇒ la ruta 404ea entera | MONEY — no emitido |

**100 filas de datos, cero celdas vacías.** Filas con `VEREDICTO = captura` y `¿miente?` = `sí`:
**25** (ver la sub-lista de SC2 en `## 5.`). Conteo reproducible:

```bash
awk -F'|' '/^### 1.4 /{ok=1} /^## 2\. Cruce/{ok=0}
  ok && /^\| E-/{v=$7; gsub(/[ *]/,"",v); m=$9; sub(/^ +/,"",m);
    if(v=="captura" && m ~ /^sí/) c++} END{print c}' 116-FECHAS-AUDIT.md
```

---

## 2. Cruce contra el dato real de PROD

### 2.0 Régimen de la consulta

- Invocación verbatim, una sola vez por lote:

  ```bash
  set -a; source .env; set +a
  PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
  ```

- El valor de `SUPABASE_DB_URL` **jamás se imprime ni se escribe** en este archivo ni en ningún otro.
- **Cero DDL, cero DML**: todas las sentencias de esta sección son `SELECT`.
- **Todo conteo va por `psql -tA`**, nunca por REST (cap PostgREST de 1.000 filas).
- **Pitfall 8 (113 §1.4):** PROD tiene fechas corruptas en el futuro. Toda consulta de verificación
  del pasado filtra `fecha <= current_date`. Las consultas que auditan el futuro lo hacen
  explícitamente (`fecha > current_date`) y se declaran como tales — ver `### 2.6`.
- **Cero PII**: sobre `suscripcion`, `consentimiento`, `declaracion` y `contrato` solo se consultó
  `count(*)` y metadatos de columna. Cero `email`, cero `user_id`, cero RUT, cero monto individual.
- **Ancla temporal:** `select now()::date` ⇒ `2026-07-28`.
- **Zona horaria del servidor PROD:** `select current_setting('TimeZone')` ⇒ `UTC`. Esto es
  load-bearing para todo el veredicto de capa: los formatters sin `timeZone` explícita heredan UTC.
- **Cero requests a fuentes gubernamentales.** No se usó `curl` contra el deploy (refuerzo opcional
  del plan, no ejecutado); el mínimo obligatorio DB→código sí está completo. Declarado en `## 6.`.

### 2.1 Hallazgo estructural del cruce: el patrón "date-only disfrazado de `timestamptz`"

Este es el resultado que **reordena** los veredictos de los parciales A y B, y por eso se declara
antes de la tabla.

Los parciales dedujeron del schema que `votacion.fecha`, `tramitacion_evento.fecha` y
`lobby_audiencia.fecha` son `timestamptz` y concluyeron un "hallazgo de DÍA" masivo. PROD dice otra
cosa: **la mayoría de esas filas no lleva hora real**.

| columna | tipo real (PROD) | filas a medianoche UTC | filas con hora | total (`fecha <= current_date`) |
|---|---|---|---|---|
| `votacion.fecha` | `timestamp with time zone` | 1.049 | 3.806 | 4.855 |
| `tramitacion_evento.fecha` | `timestamp with time zone` | 44.569 | 3.797 | 48.366 |
| `lobby_audiencia.fecha` | `timestamp with time zone` | 0 (todas a las 04:00 UTC o más) | 17.762 | 17.762 |
| `citacion.fecha` | `timestamp with time zone` | 272 | 0 | 272 |
| `sesion_sala.fecha` | `timestamp with time zone` | 16 | 0 | 16 |
| `declaracion.fecha_presentacion` | `date` | n/a (tipo `date`) | n/a | 6 (sujeto D1165) |
| `parlamentario_militancia.desde` / `.hasta` | `date` | n/a (tipo `date`) | n/a | 2 (sujeto D1165) |

Query verbatim del patrón horario (repetida por tabla):

```sql
select count(*) filter (where fecha::time = '00:00:00') as medianoche_utc,
       count(*) filter (where fecha::time <> '00:00:00') as con_hora,
       count(*) as total
from votacion where fecha <= current_date;
```

**Cuantificación del corrimiento de día** (query verbatim):

```sql
select count(*) filter (where (fecha at time zone 'UTC')::date
                          <> (fecha at time zone 'America/Santiago')::date) as drift,
       count(*) as total
from votacion where fecha <= current_date;
```

| columna | `drift` bruto | de ese drift, filas **con hora real** | lectura |
|---|---|---|---|
| `votacion.fecha` | 1.076 / 4.855 | **27** | 1.049 del drift son las filas a medianoche UTC: convertirlas a Chile **fabricaría el día anterior**. Solo **27 filas** (0,56 %) son votaciones nocturnas reales cuyo día visible hoy corre |
| `tramitacion_evento.fecha` | 44.596 / 48.366 | **27** | idéntico patrón: 44.569 son medianoche UTC (date-only disfrazada) |
| `lobby_audiencia.fecha` | **0** / 17.762 | 0 | las audiencias se almacenan a las 04:00 UTC (= 00:00 en Chile). El día UTC **coincide siempre** con el día chileno |
| `citacion.fecha` | 272 / 272 | 0 | 100 % medianoche UTC ⇒ el contrato date-only LOCKED está confirmado por el dato |
| `sesion_sala.fecha` | 16 / 16 | 0 | idem |
| `cruce_senal.evidencia->'items'[].fecha` | **0** / 2.713 ítems | 0 | hereda `lobby_audiencia.fecha` (mismas 04:00 UTC). **Resuelve el `pendiente de confirmar por SQL` de `116-PARCIAL-A.md` §A.2.1** |

Query verbatim del último caso:

```sql
select count(*) as n_items,
       count(*) filter (where (e->>'fecha')::timestamptz::date
                          <> ((e->>'fecha')::timestamptz at time zone 'America/Santiago')::date) as drift
from cruce_senal cs, lateral jsonb_array_elements(cs.evidencia->'items') e
where e ? 'fecha' and coalesce(e->>'fecha','') <> '';
```

**Consecuencias para los veredictos heredados:**

1. El "hallazgo de DÍA" de **E-002 / E-020 / E-041 / E-053 / E-044** (`lobby_audiencia.fecha` y su
   derivada en `cruce_senal`) **NO se materializa en PROD**: drift = 0 sobre 17.762 + 2.713 filas.
   Se degrada de hallazgo a **riesgo latente de capa** (`fechaCorta` sin `timeZone`).
2. El "hallazgo de DÍA" de **E-001 / E-056 / E-008** (`votacion.fecha`) **sí existe pero es acotado**:
   **27 filas**, todas votaciones que cruzaron la medianoche UTC. Ejemplo verificable
   (`boletin` 16330-05, `2023-11-17 00:14:41+00`): el sitio muestra `17 nov 2023`, el día chileno del
   hecho fue el **16 de noviembre de 2023**.
3. El mismo caso aplica a **E-010 / E-032 / E-038 / E-045** (`tramitacion_evento.fecha`): 27 filas.
4. **Convertir de zona estas columnas sería PEOR que no hacerlo**: rompería las 44.569 + 1.049 filas
   almacenadas a medianoche UTC (regla LOCKED 3). El fix de 117 **no** es "aplicar `America/Santiago`";
   es distinguir por presencia de hora, o normalizar el dato en ingesta.

### 2.2 Tabla de cruce por superficie

Columnas: `superficie (ruta) | sujeto | fecha auditada | query verbatim | valor observado en PROD |
lo que el formatter renderiza | etiqueta que el sitio afirma | ¿coincide la semántica?`

| superficie (ruta) | sujeto | fecha auditada (columna/RPC) | query verbatim | valor observado en PROD | lo que el formatter renderiza | etiqueta que el sitio afirma | ¿coincide la semántica? |
|---|---|---|---|---|---|---|---|
| `/parlamentario/[id]` | **D1165** (113 §1) | `votacion.fecha` vía `voto` | `select count(*), min(v.fecha)::text, max(v.fecha)::text, max(v.fecha_captura)::text from voto vo join votacion v on v.id=vo.votacion_id where vo.parlamentario_id='D1165' and v.fecha <= current_date;` | `3752 \| 2022-03-22 13:16:49+00 \| 2026-07-22 19:18:29+00 \| 2026-07-27 21:38:09.718+00` | `fechaCortaSegura` ⇒ `22 jul 2026` (día UTC) | `(sin rótulo)` — la fecha va sola en `font-mono` (`votos-por-parlamentario.tsx:528`) | **sí** para este sujeto: las 3.752 votaciones de D1165 no incluyen ninguna de las 27 nocturnas. La ausencia de rótulo es debilidad de copy, no de dato |
| `/parlamentario/[id]` | **D1165** | `votacion.fecha_captura` (badge) | misma query, columna 4 | `2026-07-27 21:38:09.718+00` | `relativeTimeEs` ⇒ `Actualizado hace 1 día` | `Actualizado {…}` (`provenance-badge.tsx:90`) | **no** — la captura del 27-jul describe cuándo miramos, no cuándo se votó (el hecho más reciente es del 22-jul). Distancia real observada: **5 días**. Hallazgo F-01 |
| `/parlamentario/[id]` | **D1165** | `lobby_audiencia.fecha` | `select count(*), max(fecha)::text, max(fecha_captura)::text, count(*) filter (where (fecha at time zone 'UTC')::date <> (fecha at time zone 'America/Santiago')::date) as drift from lobby_audiencia where parlamentario_id='D1165' and fecha <= current_date;` | `112 \| 2026-06-12 04:00:00+00 \| 2026-06-22 19:17:48.929+00 \| 0` | `fechaCorta` ⇒ `12 jun 2026` | `(sin rótulo)` (`lobby-de-parlamentario.tsx:441`) | **sí** — drift 0/112. El 04:00 UTC es medianoche chilena: el día UTC ES el día del hecho. El hallazgo de DÍA que dedujo el parcial A **queda refutado por el dato** |
| `/parlamentario/[id]` | **D1165** | `declaracion.fecha_presentacion` (`date`) | `select count(*), max(fecha_presentacion)::text, max(fecha_captura)::text from declaracion where parlamentario_id='D1165' and fecha_presentacion <= current_date;` | `6 \| 2026-03-31 \| 2026-07-23 12:29:45.683+00` | `fechaCortaSegura` ⇒ `31 mar 2026` | `Presentada el {fecha}` | **sí** — tipo `date` puro, rótulo explícito del hecho. Sin hallazgo |
| `/parlamentario/[id]` | **D1165** | `parlamentario_militancia.desde` / `.hasta` (`date`) | `select desde::text, coalesce(hasta::text,'NULL-vigente') from parlamentario_militancia where parlamentario_id='D1165' order by desde;` | `2022-03-11 \| 2026-03-10` y `2026-03-11 \| 2030-03-10` | `fechaCorta` ⇒ `11 mar 2022 – 10 mar 2026` | `{desde} – {hasta}` / `{desde} – vigente` | **sí** — tipo `date`. **Nota:** ninguna de las 2 militancias tiene `hasta` NULL, así que la rama honesta `vigente` no se ejercita con este sujeto; el `hasta` de la vigente es una fecha **futura** (2030-03-10), correcta por ser el término del período |
| `/parlamentario/[id]` | **D1165** | `cruce_senal.fecha_captura` | `select count(*), min(fecha_captura)::text, max(fecha_captura)::text from cruce_senal where parlamentario_id='D1165';` | `11 \| 2026-07-28 03:23:00.035505+00 \| 2026-07-28 03:23:00.035505+00` | `relativeTimeEs` ⇒ `Actualizado hace 10 h` | `Actualizado {…}` | **no** — min = max al microsegundo: es el `now()` de un **FULL REBUILD** del pipeline, no de la fuente. El badge dice "actualizado hace 10 h" de un cruce cuya reunión ocurrió el 2025-04-10. Hallazgo F-02 |
| `/parlamentario/[id]` | **D1165** | `cruce_senal.evidencia->'items'[].fecha` (hecho) | ver query de `### 2.1` (último bloque) | `2713 ítems \| drift 0`; muestra `"2025-04-10T04:00:00+00:00"` | `fechaCorta` ⇒ `10 abr 2025` | `Reunión registrada el {fecha}` | **sí** — hereda las 04:00 UTC de lobby. Resuelve el `pendiente` de A.2.1 |
| `/parlamentario/[id]` | **D1165** | `parlamentario.fecha_captura` (header) | `select id, fecha_captura::text from parlamentario where id in ('D1165','S1338') order by id;` | `D1165 \| 2026-07-22 13:36:10.214+00` | `relativeTimeEs` ⇒ `Actualizado hace 6 días` | `Actualizado {…}` (`parlamentario-header.tsx:116`) | **no** — mismo idiom no aprobado del chokepoint. Hallazgo F-01 |
| `/parlamentario/[id]` | **S1338** (senador, estados vacíos) | conteo por bloque | `select (select count(*) from voto vo join votacion v on v.id=vo.votacion_id where vo.parlamentario_id='S1338' and v.fecha<=current_date) as votos, (select count(*) from lobby_audiencia where parlamentario_id='S1338' and fecha<=current_date) as lobby, (select count(*) from declaracion where parlamentario_id='S1338') as declaraciones, (select count(*) from cruce_senal where parlamentario_id='S1338') as cruces, (select count(*) from parlamentario_militancia where parlamentario_id='S1338') as militancias;` | `949 \| 0 \| 9 \| 0 \| 1` | bloques `lobby` y `cruces`: **cero fecha renderizada** (empty-state) | empty-state honesto, sin fecha fabricada | **sí** — la degradación no inventa fecha. Coincide con 113 §1 (PK `'S1338'`, jamás `1338`) |
| `/parlamentario/[id]` | **S1338** | `parlamentario.fecha_captura` | misma query que la fila 8 | `S1338 \| 2026-07-27 00:10:53.196+00` | `relativeTimeEs` ⇒ `Actualizado hace 1 día` | `Actualizado {…}` | **no** — hallazgo F-01, idéntico a D1165 |
| `/proyecto/[boletin]` | **14309-04** (bicameral) | `tramitacion_evento.fecha` + `.fecha_captura` | `select (select count(*) from tramitacion_evento where boletin='14309-04' and fecha<=current_date), (select max(fecha)::text from tramitacion_evento where boletin='14309-04' and fecha<=current_date), (select max(fecha_captura)::text from tramitacion_evento where boletin='14309-04');` | `99 \| 2026-07-07 00:00:00+00 \| 2026-07-09 04:37:00.302+00` | hecho: `fechaCorta` ⇒ `7 jul 2026`; badge: `relativeTimeEs(max(fecha_captura))` | hecho `(sin rótulo)`; badge `Actualizado {…}` junto a `<h2>Tramitación</h2>` | hecho **sí** (93/99 a medianoche UTC, 0 drift real); badge **no** — es un **MAX de capturas** del set: hallazgo F-03 |
| `/proyecto/[boletin]` | **14309-04** | `votacion.fecha` / `.fecha_captura` | `select count(*), max(fecha)::text, max(fecha_captura)::text from votacion where boletin='14309-04' and fecha<=current_date;` (+ query de drift de `### 2.1` filtrada por boletín) | `7 \| 2026-05-11 19:21:07+00 \| 2026-07-09 04:37:00.302+00`; **drift real = 0** | `fechaCorta` ⇒ `11 may 2026` | `(sin rótulo)` (`votacion-card.tsx:39`) | **sí** para este sujeto — 0 de sus 7 votaciones cae en las 27 nocturnas |
| `/proyecto/[boletin]` | **14309-04** | `source_snapshot.fetched_at` | `select count(*) from source_snapshot where resource like '%14309-04%';` | **`0` filas — este boletín no tiene snapshot en `source_snapshot`** | el bloque "Respaldo R2" **no se renderiza** | ninguna | **sí — degradación honesta**: sin snapshot no hay fecha que mostrar y el componente omite el bloque. Causa declarada, no sustituida por otro sujeto |
| `/proyecto/[boletin]` | **14309-04** | `proyecto.fecha_captura` (header + validación) | `select fecha_captura::text from proyecto where boletin='14309-04';` | `2026-07-09 04:36:36.089+00` | `formatFechaCaptura` (`timeZone: America/Santiago`) ⇒ `9 jul 2026` | `según fuente al {fecha}` (`validacion-fuente.tsx:140`) | **sí** — único emisor del carril proyecto con el idiom aprobado. `timestamptz` real ⇒ convertir a Chile es correcto. Sin hallazgo |
| `/proyecto/[boletin]` | **17870-05** (solo-Senado) | `tramitacion_evento.fecha` | `select count(*), max(fecha)::text from tramitacion_evento where boletin='17870-05' and fecha<=current_date;` + `select boletin, count(*) filter (where fecha::time='00:00:00'), count(*) from tramitacion_evento where boletin in ('14309-04','17870-05') and fecha<=current_date group by boletin;` | `355 \| 2026-01-05 00:00:00+00`; patrón `245` a medianoche de `355` | `fechaCorta` ⇒ `5 ene 2026` | `Último hito: {descripcion} — {fecha}` (`estado-actual-block.tsx:397`) | **sí** — rótulo explícito del hecho; 0 drift real en el sujeto |
| `/proyecto/[boletin]` | **17870-05** | `votacion.fecha` (256 votaciones) | `select count(*), max(fecha)::text from votacion where boletin='17870-05' and fecha<=current_date;` | `256 \| 2025-11-26 20:32:50+00` | `fechaCorta` ⇒ `26 nov 2025` | `(sin rótulo)` | **sí** — drift real 0/256 (query de `### 2.1` filtrada por boletín) |
| `/proyecto/[boletin]` | **17870-05** | `proyecto.prm_id_camara` (control del sujeto) + `.fecha_captura` | `select boletin, prm_id_camara is null as sin_prm, camara_origen from proyecto where boletin in ('14309-04','17870-05');` y `select fecha_captura::text from proyecto where boletin='17870-05';` | `17870-05 \| t \| C.Diputados`; captura `2026-07-10 08:48:50.781+00` | `formatFechaCaptura` ⇒ `10 jul 2026` | `según fuente al {fecha}` | **sí** — el sujeto es el solo-Senado esperado por 113 §1 (`prm_id_camara IS NULL`) |
| `/proyecto/[boletin]` | **17870-05** | `source_snapshot.fetched_at` | `select resource, count(*), max(fetched_at)::text from source_snapshot where resource like '%17870-05%' group by resource;` | `17870-05 \| 1 \| 2026-07-10 08:54:26.531+00` | `formatFetchedAt` ⇒ `10 jul 2026` | `Respaldo del {fecha} · hash {…}` + `Esto decía la fuente ese día.` | **sí** — equivalente aprobado del idiom: declara el scraping como scraping. Sin hallazgo |
| `/proyecto/[boletin]` | **14309-04** / **17870-05** | fecha de urgencia (`estado-actual-block.tsx:429`) | `select max(fecha_captura)::text from tramitacion_evento where boletin='14309-04';` | `2026-07-09 04:37:00.302+00` | `fechaCorta(urgenciaFuente.fechaCaptura)` | `según {fuente} al {fecha}.` | **sí** — **contraejemplo CONFIRMADO**: el idiom aprobado ya está en producción. Único matiz: es un MAX del set (mismo eje que F-03) |
| `/agenda` | **2026-W26** (sujeto nuevo: semana ISO con más citaciones con `fecha <= current_date`; desempate por `semana_iso desc`) | `citacion.fecha` | `select semana_iso, count(*) as n, min(fecha)::text, max(fecha)::text, count(*) filter (where fecha::time='00:00:00') as medianoche_utc from citacion where fecha <= current_date group by semana_iso order by n desc, semana_iso desc limit 3;` | `2026-W26 \| 53 \| 2026-06-22 00:00:00+00 \| 2026-06-24 00:00:00+00 \| 53` | `dayLabelCitacion` ⇒ `Lunes 22 de junio` | `{dayLabel}` como cabecera de día | **sí** — **el tipo de columna es `timestamp with time zone`, pero el 100 % de los valores está a medianoche UTC**: es date-only de facto. `diaCalendarioCitacion` (`toISOString().slice(0,10)`) devuelve exactamente el día publicado. Regla LOCKED 3 confirmada por el dato |
| `/agenda` | **2026-W26** | `citacion.fecha_captura` / `sesion_sala.fecha_captura` | `select count(*) filter (where fecha::time='00:00:00'), count(*), count(*) filter (where (fecha at time zone 'UTC')::date <> (fecha at time zone 'America/Santiago')::date) from sesion_sala where fecha <= current_date;` | `sesion_sala: 16 \| 16 \| 16` (100 % medianoche UTC) | `relativeTimeEs` vía badge | `Actualizado {…}` | **no** — idiom no aprobado del chokepoint. Hallazgo F-01 |
| `/` (home) | panel de actualidad | `actualidad_senal.fecha_max` por tipo | `select tipo_senal, count(*), max(fecha_max)::text, max(fecha_captura)::text, count(*) filter (where fecha_max::time='00:00:00') from actualidad_senal group by tipo_senal order by 1;` | `agenda_citacion 1 \| 2026-08-10 …` (1/1 medianoche); `agenda_sala 1 \| 2026-08-05 …` (1/1); `agrupacion_materia 10 \| (fecha_max NULL) \| 0`; `archivados 1 \| 2026-07-06` (1/1); `nuevos_ingresos 1 \| 2026-07-27` (1/1); `urgencias 1 \| 2026-07-22` (1/1); `velocity 3 \| 2026-07-27` (3/3) | `agenda_*` ⇒ `diaCalendarioCitacion` (ISO `2026-08-10`); resto ⇒ `fechaCorta`; `agrupacion_materia` ⇒ rótulo **omitido** (`fecha_max` NULL) | `{rotulo}` dentro del tile | **sí** en el ruteo: cero señal `agenda_*` cae en `fechaCorta`. **Hallazgo de dato:** **todas** las señales, no solo las `agenda_*`, tienen `fecha_max` a medianoche UTC ⇒ el ruteo por tipo es correcto pero la rama `fechaCorta` está formateando date-only de facto (riesgo latente). El `null` de `agrupacion_materia` se omite honestamente |
| `/buscar` | `q = "educación"` (determinista, acotado a `titulo ilike`) | `proyecto.fecha_captura` que alimenta `RPC:match_proyectos` / `RPC:buscar_proyectos_hibrido` | `select count(*), min(fecha_captura)::text, max(fecha_captura)::text from proyecto where titulo ilike '%educación%';` | `134 \| 2026-07-09 04:41:15.331+00 \| 2026-07-10 18:34:34.404+00` | `relativeTimeEs` ⇒ `Actualizado 9 jul 2026` (≥7 d ⇒ delega en `fechaCorta`) | `Actualizado {…}` en cada `SearchResultCard` | **no** — idiom no aprobado. Hallazgo F-01. Además el chip `anio` de `search-result-card.tsx:71` **no recibe valor de ningún call-site de producción** ⇒ inerte (F-08) |
| `/comparar` | par **D1165** + **D1012** (113 §5) | `coincidencia_votos_par.fecha_captura_max` | `select count(*) as votaciones_compartidas, max(v.fecha_captura)::text as fecha_captura_max, max(v.fecha)::text as fecha_hecho_max from votacion v where v.id in (select vo.votacion_id from voto vo where vo.parlamentario_id='D1165') and v.id in (select vo.votacion_id from voto vo where vo.parlamentario_id='D1012');` | `3692 \| 2026-07-27 21:38:09.718+00 \| 2026-07-22 19:18:29+00` | `String(...).slice(0,10)` ⇒ `2026-07-27` | `Fuente: votaciones de Cámara y Senado · según fuente al {fecha}.` | **sí** — **confirmado por SQL que `fecha_captura_max` es un MAX de fechas de CAPTURA, no de votación**: 2026-07-27 (captura) ≠ 2026-07-22 (último hecho). Y el copy usa el idiom aprobado. Sin hallazgo |
| `/contraparte/[id]` | **no elegible** (113 §1 sujeto E) | `contrato.fecha_oc`, `contrato.fecha_corte`, `aporte.fecha_aporte`, `aporte.fecha_corte`, `*_ingesta_estado.ingestado_hasta` | `select 'contrato' t, count(*) from contrato union all select 'aporte', count(*) from aporte;` | `contrato \| 0` y `aporte \| 0` | ninguna — la ruta **404ea entera** con MONEY OFF (`contraparte/[id]/page.tsx:50-51`) | ninguna | **degradación honesta declarada**: `0 filas — contrato y aporte vacíos en PROD`. El veredicto de **E-013, E-014, E-015, E-016, E-060** queda **respaldado solo por código**. Verificado **sin tocar ningún flag** y sin pedir la ruta al deploy. Límite registrado en `## 6.` |
| `/cuenta` | gate NOTIF OFF | `suscripcion.created_at`, `consentimiento.created_at` — **solo TIPO y conteo agregado** | `select table_name\|\|'.'\|\|column_name\|\|' = '\|\|data_type from information_schema.columns where table_schema='public' and (table_name,column_name) in (('suscripcion','created_at'),('consentimiento','created_at'));` y `select 'suscripcion' t, count(*) from suscripcion union all select 'consentimiento', count(*) from consentimiento;` | tipos: ambos `timestamp with time zone`; conteos: `suscripcion \| 0`, `consentimiento \| 0` | `fechaCorta` local de `/cuenta` (`timeZone: America/Santiago`, locale `en-CA`) | `Consentimiento registrado el {fecha}` / `Suscrito el {fecha}` | **sí** por tipo — `timestamptz` real de un acto del propio usuario ⇒ convertir a Chile es correcto. **Cero PII consultada**: no se seleccionó `email`, `user_id` ni valor de fila alguno. Sin filas que cruzar; veredicto respaldado por código + tipo |

### 2.3 Cierre del cruce

- Superficies obligatorias del plan: **10**. Superficies con al menos una fila: **10**. Omitidas: **0**.
- Filas de cruce: **26**. Filas con valor `—` sin causa declarada: **0**.
- Sujetos de 113 §1 reutilizados: **D1165, S1338, 14309-04, 17870-05** y el par **D1165 + D1012**.
- Sujeto nuevo elegido (solo donde 113 no fijó uno): **`/agenda` ⇒ semana ISO `2026-W26`**, criterio
  determinista `order by count(*) desc, semana_iso desc`.
- Sujeto declarado **no elegible**: `/contraparte/[id]` (113 §1 sujeto E) — 0 filas en PROD.
- Queries que devolvieron `0 filas`: **3** (`source_snapshot` de 14309-04; `contrato`/`aporte`;
  `suscripcion`/`consentimiento`). Las tres se registran con su causa; **ninguna** se sustituyó por
  otro sujeto.

### 2.4 Veredictos de los parciales que el cruce MODIFICA

| veredicto heredado | fuente | qué dice PROD | resolución |
|---|---|---|---|
| `lobby_audiencia.fecha` ⇒ "hallazgo de DÍA" | `116-PARCIAL-A.md` §A.2.1 (E-002) y `116-PARCIAL-B.md` §B.0 (E-020, E-041) | drift **0 / 17.762** — todas las filas a las 04:00 UTC = 00:00 Chile | **degradado a riesgo latente de capa**. No es hallazgo de dato; el copy sin rótulo sí sigue siendo hallazgo aparte (F-06) |
| `cruces_de_parlamentario.fecha` ⇒ `pendiente de confirmar por SQL` | `116-PARCIAL-A.md` §A.2.1 última fila | `evidencia->'items'[].fecha`: 2.713 ítems, drift **0**; hereda lobby | **RESUELTO: cumple.** Cero conversión de zona, cero corrimiento |
| `votacion.fecha` ⇒ "hallazgo de DÍA" (magnitud desconocida) | `116-PARCIAL-A.md` §A.2.1 (E-001), `116-PARCIAL-B.md` (E-056) | drift real acotado a **27 filas** de 4.855 | **CONFIRMADO y cuantificado** ⇒ F-05 |
| `tramitacion_evento.fecha` ⇒ ambigüedad de DÍA | `116-PARCIAL-B.md` §B.0 | 44.569 / 48.366 a medianoche UTC; drift real **27** | **CONFIRMADO y cuantificado** ⇒ F-05. Con la advertencia dura de que convertir a Chile rompería 44.569 filas |
| `page.tsx:504` ⇐ `source_snapshot.fecha_captura` | `116-FORMATTERS.md` §2.2 fila 1 | el `reduce` de `page.tsx:492-497` corre sobre `TramitacionEventoRow[]`; además `source_snapshot` **no tiene columna `proyecto_id`** ni `fecha_captura` (solo `fetched_at`), así que la atribución era imposible | **atribución corregida a `tabla.tramitacion_evento.fecha_captura`**, según `116-PARCIAL-B.md` nota ¹. Ver `### 1.2` |
| `lobby_en_tramitacion` lee `.fecha` | `116-03-PLAN.md` `<interfaces>` | el código lee `row.fecha_reunion` (`lobby-en-tramitacion.tsx:123`) | **corregido**: la columna es `lobby_en_tramitacion.fecha_reunion`. Ver `### 1.2` |

### 2.5 Verificación de higiene de esta sección

| compuerta | comando | resultado |
|---|---|---|
| cero credenciales | `grep -cE 'postgres(ql)?://' 116-FECHAS-AUDIT.md` | `0` |
| cero RUT | `grep -cE '[0-9]{7,8}-[0-9kK]' 116-FECHAS-AUDIT.md` | `0` (los boletines `14309-04` / `17870-05` tienen 5 dígitos ⇒ no matchean) |
| cero email de persona natural | `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' 116-FECHAS-AUDIT.md \| sort -u` | sin match |
| cero código de producto tocado | `git status --porcelain app/ packages/` | vacío |
| cero flag movido | `git diff --quiet -- .env .env.example` | limpio |

### 2.6 Fechas futuras encontradas (Pitfall 8)

Query verbatim (auditoría explícita del futuro, complementaria al filtro `fecha <= current_date`):

```sql
select 'tramitacion_evento' t, count(*) from tramitacion_evento where fecha > current_date
union all select 'votacion', count(*) from votacion where fecha > current_date
union all select 'citacion', count(*) from citacion where fecha > current_date
union all select 'lobby_audiencia', count(*) from lobby_audiencia where fecha > current_date;
```

| tabla | filas con `fecha > current_date` | ¿corrupta o legítima? |
|---|---|---|
| `citacion` | 17 | **legítimas** — `select min(fecha)::text, max(fecha)::text, count(*) from citacion where fecha > current_date;` ⇒ `2026-08-03 … \| 2026-08-10 … \| 17`, semanas `2026-W32` y `2026-W33`. `/agenda` **debe** mostrar el futuro: es su función. Filtrarlas sería el bug |
| `tramitacion_evento` | 2 | **CORRUPTAS** — `select boletin, fecha::text from tramitacion_evento where fecha > current_date order by fecha desc limit 5;` ⇒ 2 filas del boletín `18232-25` con fecha `2626-05-25 00:00:00+00`. Es el Pitfall 8 canónico. **Y SÍ es visible**: `tramitacion_evento` alimenta el timeline, el stepper y `estado-actual-block`, ninguno de los cuales filtra por `fecha <= current_date` ⇒ hallazgo **F-04** |
| `votacion` | 0 | — |
| `lobby_audiencia` | 0 | — |

---

## 3. HALLAZGOS

Sección que **Phase 117 consume sin re-investigar**. Cada hallazgo lleva los 8 campos poblados.
Severidad: `miente` (afirma el hecho siendo captura, o rinde un día que no es el del hecho) o
`ambigua` (el usuario no puede distinguir de qué es la fecha). Orden: `miente` primero.

### F-01 — El chokepoint rotula la captura como "Actualizado"

- **id:** F-01
- **superficie:** transversal — `/parlamentario/[id]`, `/proyecto/[boletin]`, `/agenda`, `/buscar`,
  `/contraparte/[id]` (gated). 15 archivos de producción, **17 call-sites**
- **emisor:** **E-040** (chokepoint) y los emisores que lo montan: E-001, E-002, E-003, E-004,
  E-005, E-013, E-014, E-015, E-016, E-018, E-028, E-033, E-035, E-043, E-044, E-048, E-053,
  E-056, E-059
- **archivo:línea:** `app/components/provenance-badge.tsx:90`
- **qué dice hoy:** `Actualizado {relativeTimeEs(capturedAt)}` ⇒ p. ej. `Actualizado hace 3 días`
  o, a ≥ 7 días, `Actualizado 14 may 2026`
- **por qué está mal:** viola la **regla LOCKED 1** ("`fecha_captura` es reloj de scraping y JAMÁS
  representa el hecho… toda presentación sin el idiom 'según fuente al…' = hallazgo"). "Actualizado"
  se lee como "el dato cambió"; lo que la cadena mide es cuándo lo miramos nosotros. Un dato
  inmutable desde 2019 re-scrapeado hoy dice `Actualizado hace 0 min`. **Confirmado en PROD:** para
  D1165 la última votación es del `2026-07-22` y el badge dice `hace 1 día` sobre una captura del
  `2026-07-27` — 5 días de distancia entre lo que el usuario lee y el hecho
- **fix sugerido:** sustituir el rótulo de `:90` por el idiom aprobado —
  `según {sourceName} al {fechaCorta(capturedAt)}` — conservando `relativeTimeEs` solo para el
  `title`/tooltip si se quiere mantener la señal de recencia. **Un solo cambio arregla los 17
  call-sites.** Mantener intacta la rama `null` (`Sin fecha de actualización`), que ya es honesta
- **severidad:** `miente`

### F-02 — El badge de cruces presenta el reloj del pipeline como si fuera el de la fuente

- **id:** F-02
- **superficie:** `/parlamentario/[id]` (bloque cruces), `/proyecto/[boletin]#cruces`
- **emisor:** E-053, E-044
- **archivo:línea:** `app/components/cruces-de-parlamentario.tsx:196` y
  `app/components/cruces-de-proyecto.tsx:178`
- **qué dice hoy:** `Actualizado {relativeTimeEs(capturedAt)}`, con `capturedAt` ⇐
  `cruce_senal.fecha_captura`
- **por qué está mal:** regla LOCKED 1, agravada. `cruce_senal.fecha_captura` **no es la captura de
  la fuente**: es el `now()` del FULL REBUILD diario del pipeline de cruces. **Confirmado en PROD:**
  las 11 señales de D1165 tienen `min(fecha_captura) = max(fecha_captura) =
  2026-07-28 03:23:00.035505+00`, idénticas al microsegundo — es un reloj de proceso, no de
  observación. La reunión que respalda esa señal ocurrió el `2025-04-10`. El usuario lee "actualizado
  hace 10 h" sobre un hecho de hace 15 meses. La distinción solo está declarada en un comentario de
  código (`cruces-de-parlamentario.tsx:184-193`), invisible
- **fix sugerido:** copy propio para este bloque, distinto del genérico de F-01, del tipo
  `cruces recalculados al {fecha}` — que nombra el rebuild como rebuild. No usar "según fuente al…"
  aquí, porque también sería impreciso: la fuente no publicó nada ese día
- **severidad:** `miente`

### F-03 — El badge de sección declara la frescura de un MAX como si fuera la de todo el set

- **id:** F-03
- **superficie:** `/proyecto/[boletin]` (heading "Tramitación"; y el matiz en el bloque de urgencia)
- **emisor:** E-048 (y, como matiz menor, E-032 `:429`)
- **archivo:línea:** `app/app/proyecto/[boletin]/page.tsx:504` (reduce en `:492-497`);
  matiz en `app/components/estado-actual-block.tsx:429` (derivación `:332-338`)
- **qué dice hoy:** `Actualizado {relativeTimeEs(capturedAt)}` a la derecha de `<h2>Tramitación</h2>`,
  con `capturedAt` = `max(tramitacion_evento.fecha_captura)` del set. En `:429`, el copy sí usa el
  idiom aprobado: `según {sourceLabel(...)} al {fechaCorta(...)}.`
- **por qué está mal:** regla LOCKED 1 más un defecto de agregación. Un solo evento antiguo
  re-scrapeado hoy hace que **la sección entera** afirme estar fresca. **Confirmado en PROD:** para
  el boletín 14309-04, `max(fecha_captura) = 2026-07-09 04:37:00.302+00` sobre **99 eventos** cuyo
  hecho más reciente es del `2026-07-07`; el badge no distingue el evento fresco de los 98 restantes
- **fix sugerido:** en `:504`, cambiar el rótulo al idiom aprobado **y** calificar la agregación:
  `según Cámara/Senado al {fecha} (evento más reciente)`. En `:429` basta añadir el calificador de
  agregación; el idiom ya está correcto y **no debe tocarse**
- **severidad:** `miente`

### F-04 — Fecha corrupta del año 2626 renderizada sin filtro

- **id:** F-04
- **superficie:** `/proyecto/[boletin]` — timeline capa-2, stepper capa-1 y bloque "¿Dónde está hoy?"
  del boletín `18232-25`
- **emisor:** E-038, E-045, E-032 (los tres consumen `tramitacion_evento.fecha` sin filtro temporal)
- **archivo:línea:** `app/components/timeline-event.tsx:82`,
  `app/components/tramitacion-stepper.tsx:99`, `app/components/estado-actual-block.tsx:397`
- **qué dice hoy:** `{fechaCorta(fecha)}` ⇒ `25 may 2626`; en el bloque de estado,
  `Último hito: {descripcion} — 25 may 2626`
- **por qué está mal:** no viola una de las 3 reglas LOCKED de semántica, pero **rompe la premisa
  rectora del proyecto** (trazabilidad honesta: cada dato con fuente y fecha creíbles) y es el
  Pitfall 8 de `113-INVENTARIO.md` §1.4 materializado en superficie. **Confirmado en PROD:**
  `select boletin, fecha::text from tramitacion_evento where fecha > current_date;` ⇒ **2 filas**
  del boletín `18232-25` con `2626-05-25 00:00:00+00`. Ningún componente del carril proyecto filtra
  por `fecha <= current_date`, así que la fecha llega al DOM. Peor: al ser la máxima del set, gana
  el cálculo de "último hito"
- **fix sugerido:** dos capas. (a) en el render, un guard de rango plausible en `fechaValida` /
  `fechaCorta` que devuelva `null` (⇒ omisión honesta, patrón ya usado por estos mismos componentes)
  para fechas fuera de `[1990-01-01, hoy + 5 años]`; (b) reportar las 2 filas a la fase de ingesta
  para saneamiento en origen. **No** silenciar con un `where fecha <= current_date` global: eso
  rompería `/agenda`, que legítimamente muestra el futuro (17 citaciones futuras verificadas en PROD)
- **severidad:** `miente`

### F-05 — 27 votaciones y 27 eventos nocturnos se rinden con el día siguiente

- **id:** F-05
- **superficie:** `/parlamentario/[id]`, `/proyecto/[boletin]`, `/` (home, emisor huérfano)
- **emisor:** E-001, E-056, E-008 (`votacion.fecha`); E-010, E-032, E-038, E-045
  (`tramitacion_evento.fecha`)
- **archivo:línea:** `votos-por-parlamentario.tsx:528`, `votacion-card.tsx:39`,
  `actualidad-module.tsx:202,203,318`, `timeline-view.tsx:29`, `timeline-event.tsx:82`,
  `tramitacion-stepper.tsx:99,194`, `estado-actual-block.tsx:397,413`
- **qué dice hoy:** `(sin rótulo)` — la fecha va sola en `font-mono`; p. ej. `17 nov 2023`
- **por qué está mal:** el día visible no es el día chileno del hecho. `fechaCorta` no fija
  `timeZone` y `fechaCortaSegura` recorta el ISO **UTC**; el server PROD corre en `UTC`
  (`select current_setting('TimeZone')` ⇒ `UTC`), así que un hecho posterior a las 21:00 CL se rinde
  con el día siguiente. **Cuantificado en PROD:** `votacion` ⇒ **27 filas** con hora real que cruzan
  el día (de 4.855); `tramitacion_evento` ⇒ **27 filas** (de 48.366). Ejemplo verificable: boletín
  16330-05, `2023-11-17 00:14:41+00`, el sitio muestra `17 nov 2023`, el día chileno real fue el
  **16 de noviembre de 2023**
- **fix sugerido:** **NO aplicar `timeZone: "America/Santiago"` a ciegas.** PROD demuestra que
  1.049 filas de `votacion` y **44.569** de `tramitacion_evento` están almacenadas a medianoche UTC
  (date-only disfrazada de `timestamptz`): convertirlas fabricaría el día anterior en 45.618 filas —
  exactamente lo que la regla LOCKED 3 prohíbe. El fix correcto es un helper que **ramifique por
  presencia de hora**: si `fecha::time = 00:00:00` ⇒ tratar como date-only (día UTC, sin conversión);
  si tiene hora real ⇒ convertir a `America/Santiago`. Alternativa de fondo, para 117 o para una
  fase de datos: normalizar el tipo en ingesta y dejar de mezclar dos semánticas en una columna
- **severidad:** `miente`

### F-06 — "Última actualización de datos" presenta el scraping como cambio del dato

- **id:** F-06
- **superficie:** `—` (emisor **HUÉRFANO**, superseded por E-055; el veredicto vale si se re-monta)
- **emisor:** E-008
- **archivo:línea:** `app/components/actualidad-module.tsx:451` (encabezado en `:437`, fuentes en
  `:461-468`, query en `:479-482`)
- **qué dice hoy:** `Última actualización de datos` + por fuente `{it.fuente}` `{fechaCorta(it.fecha)}`
  ⇒ p. ej. `Votaciones 27 jul 2026`
- **por qué está mal:** viola la **regla LOCKED 1** en copy **propio** (no heredado del chokepoint):
  el valor es `max(fecha_captura)` de seis tablas NO-PII, y el rótulo afirma que el DATO se
  actualizó. Agravante: encabeza un strip que se presenta como de transparencia, que es justo donde
  la afirmación falsa cuesta más. La regla 2 sí se respeta (cero "captura" pelado)
- **fix sugerido:** `Última consulta a las fuentes` o `Datos según fuente al {fecha}`, con la
  aclaración de que la fecha mide la consulta y no la publicación. Si 117 confirma que el componente
  sigue huérfano, la alternativa legítima es **eliminarlo** en vez de arreglarlo
- **severidad:** `miente`

### F-07 — Fechas del hecho renderizadas sin rótulo alguno

- **id:** F-07
- **superficie:** `/parlamentario/[id]`, `/proyecto/[boletin]#lobby`, `/proyecto/[boletin]#votaciones`
- **emisor:** E-001, E-002, E-020, E-038, E-045, E-056
- **archivo:línea:** `votos-por-parlamentario.tsx:528`, `lobby-de-parlamentario.tsx:441` y `:487`,
  `lobby-menciones-de-boletin.tsx:129`, `timeline-event.tsx:82`, `tramitacion-stepper.tsx:99`,
  `votacion-card.tsx:39`
- **qué dice hoy:** la fecha **sola**, en `<span className="font-mono text-sm text-muted-foreground">`,
  sin ninguna palabra que diga de qué es. P. ej. `12 jun 2026 ·` abriendo un `<li>` de reunión
- **por qué está mal:** no viola una regla LOCKED de forma literal, pero deja al usuario sin poder
  distinguir la fecha del hecho de la de captura cuando **ambas conviven en la misma fila** (el badge
  "Actualizado hace X" está a centímetros). Es el defecto de desambiguación que la fase debe cazar:
  el sitio muestra dos fechas de naturaleza distinta y no nombra ninguna. Los emisores hermanos que
  **sí** rotulan (`Reunión registrada el …` en E-041/E-044/E-053, `Presentada el …` en E-005,
  `Fecha del aporte:` en E-013/E-016) demuestran que el idiom existe y es barato
- **fix sugerido:** añadir el NOUN-label del hecho, siguiendo el patrón ya presente en el árbol:
  `Votada el {fecha}` (E-001, E-056), `Reunión del {fecha}` (E-002, E-020),
  `{descripcion} — {fecha}` (E-038, E-045). Cero cambio de formatter
- **severidad:** `ambigua`

### F-08 — `fecha_corte` e `ingestado_hasta` comparten el rótulo "corte al" siendo cosas distintas

- **id:** F-08
- **superficie:** `/parlamentario/[id]`, `/contraparte/[id]` — **ambas bajo gate MONEY OFF**
- **emisor:** E-013, E-014, E-015, E-016
- **archivo:línea:** `financiamiento-de-parlamentario.tsx:179` y `:356`,
  `contratos-por-contraparte.tsx:139`, `contratos-de-parlamentario.tsx:138` y `:226`,
  `aportes-por-contraparte.tsx:152`
- **qué dice hoy:** `Consolidado, corte al {fechaCorteTexto}.` /
  `Consultado por RUT, corte al {fechaCorteTexto}.` /
  `Consultado por nombre del candidato, corte al {fechaCorteTexto}.` /
  `Consultamos ChileCompra por el RUT de este parlamentario (corte al {fechaTexto}) y no se
  registran contratos asociados a ese RUT a esa fecha.`
- **por qué está mal:** el mismo rótulo "corte al" cubre **dos columnas de naturaleza distinta**:
  `fecha_corte` (borde del periodo que la FUENTE cubre) e `ingestado_hasta` (borde de lo que
  NOSOTROS ingerimos). Y ninguna de las dos es el hecho ni la captura, pero conviven en la misma
  fila que un badge "Actualizado hace X" (F-01) ⇒ el usuario ve dos o tres fechas y no puede decir
  cuál acota qué. "Consolidado" empeora el caso: no dice de qué es el corte ni quién consolidó
- **fix sugerido:** separar los rótulos por categoría. Para `fecha_corte`:
  `la fuente cubre hasta el {fecha}`. Para `ingestado_hasta`:
  `nuestra ingesta llega hasta el {fecha}`. Y nombrar el sujeto de "Consolidado"
  (`Consolidado por el Observatorio, …`). **Debe resolverse ANTES de cualquier flip del gate MONEY**:
  hoy no se ve, pero es deuda de copy que se haría pública el día del flip
- **severidad:** `ambigua`

### F-09 — Seis renders date-only con un formatter que el propio archivo prohíbe

- **id:** F-09
- **superficie:** `/proyecto/[boletin]` (bloque "¿Dónde está hoy?"), incluidos **dos `aria-label`**
- **emisor:** E-032
- **archivo:línea:** `app/components/estado-actual-block.tsx:445`, `:460`, `:475`,
  `:479` (aria-label), `:494` (aria-label), `:497`
- **qué dice hoy:** `Citado en {comision} el {fechaCorta(citacionVigente.fecha)}.`;
  `Citado el {fechaCorta(c.fecha)} en {c.comision} (sesión pasada)`;
  `En tabla de sala de la {camaraNombre(...)} del {fechaCorta(...)} ver en la agenda`;
  `{camaraNombre(s.camara)}, {fechaCorta(s.fecha)}`
- **por qué está mal:** **regla LOCKED 3** (date-only medianoche UTC, jamás convertir tz).
  `citacion.fecha` y `sesion_sala.fecha` son date-only —**PROD lo confirma: 272/272 y 16/16 filas a
  medianoche UTC**— y `fechaCorta` (`format.ts:21`) no fija `timeZone`: hereda el huso del runtime.
  Hoy el server corre UTC y el día coincide, pero **no hay garantía en el código**: basta un runtime
  en huso negativo para que `2026-07-20T00:00Z` se rinda `19-jul`. **Inconsistencia interna dura:**
  el MISMO archivo prohíbe el patrón en su JSDoc `:145-150` y usa `diaCalendarioCitacion` para las
  MISMAS columnas en `:189`, `:221`, `:237` y `:270`. Agravante de accesibilidad: dos de las seis
  ocurrencias viven en `aria-label`, el único canal por el que un lector de pantalla recibe la fecha
- **fix sugerido:** sustituir `fechaCorta` por `badgeFechaCitacion` (o `dayLabelCitacion` donde se
  quiera el weekday) en las seis líneas. Ambos delegan en `diaCalendarioCitacion`, ya importado en
  `:3`. Cambio mecánico, cero lógica nueva
- **severidad:** `ambigua`

### F-10 — Formatters sin `timeZone` explícita: la corrección depende del huso del runtime

- **id:** F-10
- **superficie:** transversal — toda ruta que use `fechaCorta` o el `mesAnioFormatter` de
  `timeline-view`
- **emisor:** E-040 (capa), y por herencia E-002, E-010, E-019, E-020, E-041, E-053, E-054, E-055
- **archivo:línea:** `app/lib/format.ts:21` (`Intl` en `:12`) y
  `app/components/timeline-view.tsx:29`
- **qué dice hoy:** ambos construyen `new Intl.DateTimeFormat("es-CL", {...})` **sin la clave
  `timeZone`**, así que formatean en el huso del proceso
- **por qué está mal:** riesgo latente sobre la regla LOCKED 3. Hoy PROD corre en `UTC`
  (verificado: `select current_setting('TimeZone')` ⇒ `UTC`) y todas las date-only se rinden con su
  día correcto — pero por **configuración del entorno**, no por contrato del código. Un cambio de
  runtime, un render en cliente o un entorno de preview en otro huso corromperían silenciosamente el
  día visible de decenas de emisores. **PROD añade alcance:** *todas* las señales de
  `actualidad_senal` (no solo las `agenda_*`) tienen `fecha_max` a medianoche UTC, así que la rama
  `fechaCorta` de `panel-actualidad.tsx:107` también está formateando date-only de facto
- **fix sugerido:** fijar `timeZone: "UTC"` explícita en `format.ts:12` y en `timeline-view.tsx:29`
  — **UTC, no `America/Santiago`**: preserva el comportamiento actual (correcto) y lo convierte en
  contrato del código en vez de accidente del entorno. Los timestamps reales que sí necesitan huso
  chileno ya tienen su formatter propio con `timeZone` explícita (`FECHA_CHILE`,
  `DIA_CALENDARIO_CHILE_HOY`, `formatFechaCaptura`, `fechaConsultaHoy`) y no deben tocarse
- **severidad:** `ambigua`

### F-11 — El umbral de frescura documentado (48 h) no es el real (14 días)

- **id:** F-11
- **superficie:** transversal — el estilo `stale` (amber) del badge en las 15 rutas
- **emisor:** E-040
- **archivo:línea:** `app/components/provenance-badge.tsx:18` (JSDoc); origen del error propagado a
  `113-INVENTARIO.md` §3.1.1 y al bloque `<interfaces>` de `116-01-PLAN.md`. Código real:
  `app/lib/format.ts:10`
- **qué dice hoy:** el JSDoc afirma *"Si el dato tiene más de 48h se marca en amber"*. El código dice
  `STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000` (**14 días**), con justificación en `:6-9`
  (cadence de ingesta semanal)
- **por qué está mal:** no es una mentira al usuario (el render es consistente consigo mismo), pero
  es una mentira a quien mantiene: cualquier auditoría futura que lea el JSDoc concluirá que un dato
  de 3 días está en amber, y no lo está. Ya causó un error de arrastre en el inventario rector 113 y
  en el plan 01 de esta misma fase
- **fix sugerido:** corregir el JSDoc de `provenance-badge.tsx:18` a "más de 14 días" y propagar la
  corrección a `113-INVENTARIO.md` §3.1.1. Cero cambio de comportamiento
- **severidad:** `ambigua`

### F-12 — Chip de año "proxy de ingreso": ambiguo y además inerte

- **id:** F-12
- **superficie:** `/buscar`
- **emisor:** E-028
- **archivo:línea:** `app/components/search-result-card.tsx:66` y `:71` (prop declarada en `:39`,
  desestructurada en `:50`, JSDoc en `:35-38`)
- **qué dice hoy:** `{anio != null ? String(anio) : "Sin dato"}` — un año pelado en un chip, **sin
  rótulo** que diga de qué año se trata
- **por qué está mal:** el propio JSDoc lo define como *"Año derivado del primer evento de
  tramitación (**proxy de ingreso**)"*, es decir una **aproximación**, y el chip la muestra como un
  año a secas: el usuario lee "el año del proyecto". No es `fecha_captura` (la regla 1 no aplica) y
  el estado vacío (`Sin dato`) es honesto. Hallazgo secundario de rastreo: **ningún call-site de
  producción pasa `anio=`** (grep vivo en `app/buscar/` ⇒ cero) ⇒ el chip está **hoy inerte**
- **fix sugerido:** decidir primero si el chip vuelve. Si vuelve, rotularlo por lo que es:
  `primer trámite {anio}` (o eliminar el proxy y usar la fecha real de ingreso cuando exista). Si no
  vuelve, borrar la prop y el JSX muertos. **No** dejar código que renderiza una fecha ambigua a la
  espera de que alguien le pase datos
- **severidad:** `ambigua`

### F-13 — `relativeTimeEs` aplicado a una fecha del hecho

- **id:** F-13
- **superficie:** `/proyecto/[boletin]` (bloque de urgencia vigente)
- **emisor:** E-032
- **archivo:línea:** `app/components/estado-actual-block.tsx:417` (fecha absoluta hermana en `:413`)
- **qué dice hoy:** `Urgencia {tipo} vigente desde el {fechaCorta(urgenciaEstado.desde)} (…)` seguido
  de `({relativeTimeEs(urgenciaEstado.desde)}).`
- **por qué está mal:** `relativeTimeEs` existe **para el reloj de scraping** — su parámetro se llama
  literalmente `capturedAt` (`format.ts:33`) y es el formatter del chokepoint. Aplicarlo a una fecha
  del HECHO importa a la superficie el vocabulario de la captura, justo donde la fase intenta
  separarlos. Semánticamente el paréntesis no miente (califica el hecho), pero a ≥ 7 días
  `relativeTimeEs` delega en `fechaCorta` y **duplica la misma fecha absoluta ya mostrada en `:413`**,
  produciendo `vigente desde el 22 jul 2026 (22 jul 2026)`
- **fix sugerido:** o bien un helper de delta explícito para hechos (p. ej. `hace 6 días` sin
  fallback a fecha absoluta), o bien eliminar el paréntesis de `:417` y dejar solo la fecha absoluta
  de `:413`. Renombrar el parámetro de `relativeTimeEs` a algo neutro **no** es el fix: el punto es
  no reutilizar el vocabulario de captura sobre hechos
- **severidad:** `ambigua`

### F-14 — El panel de actualidad rinde el día publicado en ISO crudo

- **id:** F-14
- **superficie:** `/` (home, panel de actualidad)
- **emisor:** E-055
- **archivo:línea:** `app/components/panel-actualidad.tsx:104` (helper `rotuloFecha` en `:100`,
  render en `:166` y `:187`)
- **qué dice hoy:** `{rotulo}` = la salida cruda de `diaCalendarioCitacion` ⇒ `2026-08-10`
- **por qué está mal:** no es una mentira semántica — el ruteo por tipo es **correcto** y está
  documentado (`:82-85`, `:95-98`), y PROD lo confirma (las señales `agenda_*` son date-only a
  medianoche UTC y reciben el formatter que su tipo exige). El defecto es de legibilidad en la
  superficie de mayor tráfico: el resto del sitio muestra `10 ago 2026` en es-CL y aquí aparece un
  ISO técnico, lo que hace la fecha menos comprensible para público general y prensa
- **fix sugerido:** pasar la salida de `diaCalendarioCitacion` por `badgeFechaCitacion`
  (`dia-calendario.ts:91`), que formatea `YYYY-MM-DD` a mes corto es-CL **sin** tocar la zona.
  Cero riesgo sobre la regla LOCKED 3
- **severidad:** `ambigua`

### 3.1 Índice de hallazgos

| id | severidad | emisores | superficie | archivo principal |
|---|---|---|---|---|
| F-01 | miente | E-040 + 19 emisores (17 call-sites) | transversal | `provenance-badge.tsx:90` |
| F-02 | miente | E-053, E-044 | ficha parlamentario + ficha proyecto | `cruces-de-parlamentario.tsx:196` |
| F-03 | miente | E-048, E-032 (matiz) | `/proyecto/[boletin]` | `proyecto/[boletin]/page.tsx:504` |
| F-04 | miente | E-038, E-045, E-032 | `/proyecto/[boletin]` | `timeline-event.tsx:82` |
| F-05 | miente | E-001, E-056, E-008, E-010, E-032, E-038, E-045 | 3 rutas | `format.ts:21` (capa) |
| F-06 | miente | E-008 | huérfano | `actualidad-module.tsx:451` |
| F-07 | ambigua | E-001, E-002, E-020, E-038, E-045, E-056 | 3 rutas | `votacion-card.tsx:39` |
| F-08 | ambigua | E-013, E-014, E-015, E-016 | gated MONEY | `contratos-de-parlamentario.tsx:138` |
| F-09 | ambigua | E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:445` |
| F-10 | ambigua | E-040 + 8 emisores por herencia | transversal | `format.ts:21` |
| F-11 | ambigua | E-040 | transversal (documental) | `provenance-badge.tsx:18` |
| F-12 | ambigua | E-028 | `/buscar` | `search-result-card.tsx:71` |
| F-13 | ambigua | E-032 | `/proyecto/[boletin]` | `estado-actual-block.tsx:417` |
| F-14 | ambigua | E-055 | `/` (home) | `panel-actualidad.tsx:104` |

**14 hallazgos: 6 `miente`, 8 `ambigua`.** Emisores citados en `## 3.`: **28** de los 38 del
denominador.

---

## 4. Cobertura — sin hallazgos declarados

Los ids `E-xxx` con fecha del catálogo 113 §3.0 que **no** generaron hallazgo. Cero excepciones
silenciosas: un emisor que no aparezca ni en `## 3.` ni aquí es un fallo de cobertura, y
`check-fechas.sh` (check 3) lo muerde.

- **E-012 — sin hallazgos.** `parlamentario-directory-row.tsx:48` propaga `partido_fecha_captura` a
  `PartidoChip` sin emitir copy de fecha propio; el veredicto efectivo vive en E-019, que sí usa el
  idiom aprobado.
- **E-019 — sin hallazgos.** `partido-chip.tsx:65` emite `según {fuente} al {fecha}` (y
  `según {fuente}` sin fecha): **usa el idiom aprobado** de la regla LOCKED 1 y jamás fabrica fecha.
  Es el patrón que F-01 propone generalizar.
- **E-026 — sin hallazgos.** `voto-row.tsx` **no renderiza ninguna fecha**: grep de los seis
  formatters ⇒ 0 matches en 63 líneas. Cubierto por declaración de ausencia (`### 1.2` fila 3).
- **E-027 — sin hallazgos.** `validacion-fuente.tsx:226` emite `según fuente al {fecha}` y `:239`
  emite `Respaldo del {fecha} · hash {…}` + `Esto decía la fuente ese día.` — idiom aprobado y
  equivalente aprobado. Además, sus dos entradas son `timestamptz` reales, así que la conversión a
  `America/Santiago` es correcta (regla 3 no aplica).
- **E-051 — sin hallazgos.** `/comparar` distingue explícitamente `según fuente al …` (captura) de
  `consultado al …` (consulta), con el razonamiento en el comentario `comparar/page.tsx:45-52`.
  PROD confirma que `fecha_captura_max` es un MAX de capturas (`2026-07-27`) y no del hecho
  (`2026-07-22`).
- **E-052 — sin hallazgos.** `/cuenta` rotula actos del propio usuario
  (`Consentimiento registrado el …`, `Suscrito el …`) con `timeZone: America/Santiago` explícita.
  No es scraping ni hecho del Congreso. Gate NOTIF OFF; 0 filas en PROD.
- **E-054 — sin hallazgos.** `militancias-de-parlamentario.tsx:26-27` rinde `desde`/`hasta` (`date`)
  con rótulo de período y **ausencia honesta verificada**: con `hasta = null` emite el literal
  `vigente`, cero `new Date()` de relleno.
- **E-057 — sin hallazgos.** `comisiones-de-parlamentario.tsx` **no renderiza ninguna fecha**: grep
  ⇒ 0 matches en 73 líneas. Cubierto por declaración de ausencia (`### 1.2` fila 3).
- **E-058 — sin hallazgos.** `idea-matriz-block.tsx:49` es consumidor de props sin copy de fecha
  propio (el hallazgo efectivo es el de E-048 `:398`), y su rama degradada (`:29-41`) **no fabrica
  fecha alguna**.
- **E-060 — sin hallazgos.** `contraparte/[id]/page.tsx` no formatea ninguna fecha; su único match de
  `ProvenanceBadge` es un comentario de docstring. Verificado sin encender ningún flag: `notFound()`
  es la primera sentencia (`:50-51`) ⇒ la ruta 404ea entera con MONEY OFF.

**10 ids sin hallazgo + 28 ids con hallazgo = 38.** Denominador cerrado.

---

## 5. Trazabilidad a los Success Criteria del ROADMAP

| SC | dónde se satisface | evidencia |
|---|---|---|
| **SC1** — cada fecha del inventario 113 tiene veredicto explícito con su columna de origen citada | `### 1.4` (tabla única, 100 filas), apoyada en `### 1.0` (19 formatters) y `### 1.1` (chokepoint + 17 call-sites) | Los 38 ids del denominador aparecen en `## 3.` (28) o en `## 4.` (10). Cada fila lleva `columna/RPC de origen`. `check-fechas.sh` checks 1-4 lo prueban |
| **SC2** — toda ocurrencia de `fecha_captura` presentada como el hecho, listada con archivo:línea y superficie | sub-lista de `### 5.1` | **25 entradas**, extraídas de `### 1.4` filtrando `VEREDICTO = captura` **y** `¿miente?` = `sí`. El conteo coincide con el del comando reproducible al pie de `### 1.4` |
| **SC3** — las date-only del Congreso verificadas contra el gotcha LOCKED de zona horaria | `### 1.3 Auditoría date-only (gotcha LOCKED v9.0)` | **18 filas**, unión de `116-PARCIAL-A.md` §A.2.1 (militancia `desde`/`hasta`, `declaracion.fecha_presentacion`, `votacion.fecha`, `lobby_audiencia.fecha`, `fecha_oc`, `fecha_aporte`, `fecha_corte`, `ingestado_hasta`, `cruces.fecha`) **y** `116-PARCIAL-B.md` §B.2.1 (`citacion.fecha`, `sesion_sala.fecha`, `sesion_tabla_item`, `actualidad_senal.fecha_max`). **Conversiones de zona activas sobre date-only: 0. Pendientes sin resolver: 0** |
| **SC4** — el veredicto cruzado contra el dato real de PROD, un sujeto concreto por superficie | `## 2. Cruce contra el dato real de PROD` | **26 filas** cubriendo las **10** superficies obligatorias, cada una con query verbatim y valor observado. Sujetos: D1165, S1338, 14309-04, 17870-05, par D1165+D1012, semana `2026-W26`; degradaciones honestas para `/contraparte/[id]` y `/cuenta` |

### 5.1 SC2 — ocurrencias de `fecha_captura` presentadas como el hecho

Filas de `### 1.4` con `VEREDICTO = captura` y `¿miente?` = `sí`. **25 entradas.**

| # | id | archivo:línea | superficie | columna de origen |
|---|---|---|---|---|
| 1 | E-040 | `app/components/provenance-badge.tsx:90` | transversal (15 archivos de producción) | prop `capturedAt` ← `fecha_captura` de 9 tablas |
| 2 | E-001 | `app/components/votos-por-parlamentario.tsx:546` | `/parlamentario/[id]` | `votacion.fecha_captura` |
| 3 | E-002 | `app/components/lobby-de-parlamentario.tsx:536` | `/parlamentario/[id]#lobby` | `lobby_audiencia.fecha_captura` |
| 4 | E-003 | `app/components/voto-ficha-row.tsx:135` | huérfano | `votacion.fecha_captura` |
| 5 | E-003 | `app/components/voto-ficha-row.tsx:220` | huérfano | `votacion.fecha_captura` |
| 6 | E-004 | `app/app/agenda/page.tsx:461` | `/agenda` | `citacion.fecha_captura` |
| 7 | E-004 | `app/app/agenda/page.tsx:502` | `/agenda` (tabla de sala) | `sesion_sala.fecha_captura` |
| 8 | E-005 | `app/components/patrimonio-de-parlamentario.tsx:445` | `/parlamentario/[id]` | `declaracion.fecha_captura` |
| 9 | E-005 | `app/components/patrimonio-de-parlamentario.tsx:769` | `/parlamentario/[id]` | `declaracion.fecha_captura` |
| 10 | E-008 | `app/components/actualidad-module.tsx:451` | huérfano | `max(fecha_captura)` de 6 tablas NO-PII |
| 11 | E-013 | `app/components/financiamiento-de-parlamentario.tsx:233` | `/parlamentario/[id]` (MONEY OFF) | `aporte.fecha_captura` |
| 12 | E-014 | `app/components/contratos-por-contraparte.tsx:177` | `/contraparte/[id]` (MONEY OFF) | `contrato.fecha_captura` |
| 13 | E-015 | `app/components/contratos-de-parlamentario.tsx:194` | `/parlamentario/[id]` (MONEY OFF) | `contrato.fecha_captura` |
| 14 | E-016 | `app/components/aportes-por-contraparte.tsx:198` | `/contraparte/[id]` (MONEY OFF) | `aporte.fecha_captura` |
| 15 | E-018 | `app/components/sala-table-section.tsx:33` (render `:59`) | `/agenda` | `sesion_sala.fecha_captura` |
| 16 | E-028 | `app/components/search-result-card.tsx:27` | `/buscar` | `proyecto.fecha_captura` |
| 17 | E-033 | `app/components/citacion-card.tsx:45` | `/agenda` | `citacion.fecha_captura` |
| 18 | E-035 | `app/components/autor-row.tsx:58` | `/proyecto/[boletin]#autores` | `proyecto_autor.fecha_captura` |
| 19 | E-043 | `app/components/ficha-header.tsx:66` | `/proyecto/[boletin]` (header) | `proyecto.fecha_captura` |
| 20 | E-044 | `app/components/cruces-de-proyecto.tsx:178` | `/proyecto/[boletin]#cruces` | `cruce_senal.fecha_captura` (rebuild) |
| 21 | E-048 | `app/app/proyecto/[boletin]/page.tsx:398` | `/proyecto/[boletin]` (idea matriz) | `proyecto_ficha.fecha_captura` |
| 22 | E-048 | `app/app/proyecto/[boletin]/page.tsx:504` | `/proyecto/[boletin]` (Tramitación) | `max(tramitacion_evento.fecha_captura)` |
| 23 | E-053 | `app/components/cruces-de-parlamentario.tsx:196` | `/parlamentario/[id]` (cruces) | `cruce_senal.fecha_captura` (rebuild) |
| 24 | E-056 | `app/components/votacion-card.tsx:97` | `/proyecto/[boletin]#votaciones` | `votacion.fecha_captura` |
| 25 | E-059 | `app/components/parlamentario-header.tsx:116` | `/parlamentario/[id]` (header) | `parlamentario.fecha_captura` |

**Nota de alcance:** las 25 entradas comparten una única causa raíz —el rótulo del chokepoint
(F-01)—, salvo la #10 (E-008), que tiene copy propio (F-06). Arreglar `provenance-badge.tsx:90`
cierra 24 de las 25.

---

## 6. Límites

Lo que esta fase **no** pudo cerrar, y por qué. Un límite declarado es un resultado válido; uno
silenciado, no.

1. **Emisores bajo gate MONEY sin datos en PROD.** `contrato` y `aporte` tienen **0 filas**
   (`select 'contrato' t, count(*) from contrato union all select 'aporte', count(*) from aporte;`)
   y `/contraparte/[id]` 404ea entera con el flag apagado. El veredicto de **E-013, E-014, E-015,
   E-016 y E-060** queda **respaldado solo por código y schema**, no por dato observado. F-08 debe
   resolverse **antes** de cualquier flip del gate. No se encendió ningún flag para cerrar este
   límite: hacerlo habría violado el régimen de la fase.
2. **Emisores bajo gate NOTIF sin datos en PROD.** `suscripcion` y `consentimiento` tienen **0
   filas**. De **E-052** solo se verificó el **tipo** de columna (`timestamp with time zone` en
   ambas) y el conteo agregado. **Cero PII consultada** por diseño: no se seleccionó `email`,
   `user_id` ni valor de fila alguno, y ese es un límite deliberado, no una omisión.
3. **Superficies no observadas contra el deploy real.** El plan permitía un `curl` opcional contra
   el Worker propio como refuerzo; **no se ejecutó**. Todo el veredicto de esta fase es
   DB → código → copy leído del JSX. La verificación end-to-end contra el HTML renderizado la hace
   **Phase 125**.
4. **`source_snapshot` del boletín 14309-04: 0 filas.** El bloque "Respaldo R2" de E-027 quedó
   cruzado solo con el sujeto 17870-05 (1 snapshot, `fetched_at = 2026-07-10 08:54:26.531+00`). No
   se sustituyó el sujeto bicameral por otro "que diera bonito": la ausencia se registra como el
   resultado honesto.
5. **Emisores huérfanos.** **E-003** (`voto-ficha-row.tsx`, 2 call-sites) y **E-008**
   (`actualidad-module.tsx`, 6 filas de veredicto) no se renderizan en ninguna ruta. Sus veredictos
   —incluido F-06, que es `miente`— valen **si alguien los re-monta**. 117 debe decidir
   explícitamente entre arreglarlos o eliminarlos; dejarlos como están es la única opción que este
   artefacto no avala.
6. **El fix de F-05 excede el alcance de un cambio de copy.** PROD demuestra que
   `votacion.fecha` y `tramitacion_evento.fecha` mezclan **dos semánticas en una sola columna**
   (45.618 filas date-only a medianoche UTC vs 7.603 con hora real). La corrección de fondo es de
   **ingesta**, no de presentación; 117 puede mitigarlo en el render (helper que ramifica por
   presencia de hora), pero la deuda de datos queda abierta y no pertenece a esta fase.
7. **Las 2 filas corruptas de F-04 no se sanearon.** Régimen solo-lectura: se detectaron
   (`18232-25`, `2626-05-25`) y se reportan. Ni el saneamiento en origen ni el guard de render se
   aplicaron aquí.
8. **Los gates se declaran heredados.** `gates_observados` del front-matter viene de
   `113-INVENTARIO.md` §5, observado el **2026-07-27**. Esta fase **no** los re-observó contra el
   deploy porque hacerlo habría requerido tocar flags o pedir rutas gated. Se marca
   `heredada: true` en vez de presentarlo como observación propia.

---

## 7. Verificación de cierre

### 7.1 Salida verbatim de `check-fechas.sh` con `STRICT=1`

```
$ STRICT=1 bash .planning/phases/116-fecha-audit-sem-ntica-de-cada-fecha-visible/check-fechas.sh
OK check 1 — denominador derivado de 113-INVENTARIO §3.0 = 38 (esperado 38)
OK check 2 — los 38 ids del denominador aparecen en el artefacto
OK check 3 — los 38 ids tienen veredicto en '## 3.' o en '## 4.'
OK check 4 — las 100 celdas de VEREDICTO de '### 1.4' están en {hecho, captura, ambigua}
OK check 5 — higiene: 0 credenciales, 0 RUT, 0 marcadores pendientes, 0 celdas vacías
OK check 6 — régimen solo-lectura: git status --porcelain app/ packages/ vacío
---
RESULTADO: sin faltas (STRICT=1)
EXIT=0
```

`STRICT=0 bash check-fechas.sh` ⇒ **exit 0** (modo reporte, verificado).

### 7.2 Prueba negativa de la regla de celda — **con una desviación que se REPORTA**

Al relajar la regla LOCKED a una comparación **por igualdad** contra `—` (en vez de "empieza por"),
el denominador se infla:

```bash
# regla RELAJADA (incorrecta)
awk -F'|' '/^\| E-/{c=$5; gsub(/[ \t`]/,"",c); if(c!="—"){...}}' 113-INVENTARIO.md | sort -u | wc -l
```

| regla | denominador observado |
|---|---|
| LOCKED ("empieza por `—`" tras quitar espacios/tabs/backticks) | **38** |
| relajada (igualdad exacta contra `—`) | **51** |
| total de filas `\| E-` en 113 §3.0 (referencia) | **60** |

**Desviación respecto del plan, declarada y no silenciada:** `116-04-PLAN.md` (acceptance del Task 3)
afirma que la regla relajada "salta a **60**". El valor observado es **51**. El **60** del plan es el
**total de filas** `E-xxx` del catálogo §3.0, no el resultado de la regla relajada — se confundieron
dos magnitudes. El **fondo del argumento del plan se sostiene y se refuerza**: la regla relajada
introduce **13 falsos positivos**, es decir 13 emisores que no muestran ninguna fecha y para los que
los checks 2 y 3 exigirían un veredicto ⇒ 13 declaraciones falsas de "sin hallazgos".

Falsos positivos exactos (en la regla relajada, ausentes de la LOCKED):

`E-006` `E-007` `E-009` `E-017` `E-023` `E-024` `E-025` `E-029` `E-036` `E-039` `E-047` `E-049` `E-050`

**`E-006` y `E-039` NO están en el denominador LOCKED**, tal como exige la acceptance del plan
(sus celdas empiezan por `—` tras quitar backticks). Verificado.

El check 1 **reporta** la desviación en vez de continuar cuando el denominador derivado difiere del
ancla `ESPERADO=38`; el ancla no se ajusta jamás para que el script pase.

### 7.3 Mutación de prueba — el script MUERDE

Se borraron temporalmente todas las líneas que mencionan `E-057` en una copia de trabajo de
`116-FECHAS-AUDIT.md` y se re-corrió el script en `STRICT=1`:

```
OK check 1 — denominador derivado de 113-INVENTARIO §3.0 = 38 (esperado 38)
FALTA check 2 — E-057 ausente de 116-FECHAS-AUDIT.md
-- check 2 — 1 de 38 ids ausentes del artefacto
FALTA check 3 — E-057 sin veredicto: ausente de '## 3. HALLAZGOS' y de '## 4. Cobertura'
-- check 3 — 1 de 38 ids sin veredicto declarado
OK check 4 — las 99 celdas de VEREDICTO de '### 1.4' están en {hecho, captura, ambigua}
OK check 5 — higiene: 0 credenciales, 0 RUT, 0 marcadores pendientes, 0 celdas vacías
OK check 6 — régimen solo-lectura: git status --porcelain app/ packages/ vacío
---
RESULTADO: 2 falta(s)
EXIT=1
```

Los checks 2 **y** 3 mordieron y el exit fue **1**. El archivo se **restauró** desde la copia previa;
`git status --porcelain` sobre el artefacto quedó vacío y la corrida siguiente volvió a
`RESULTADO: sin faltas (STRICT=1)`. La completitud de este audit es, por tanto, una **propiedad
probada**, no una afirmación.

### 7.4 Compuertas de higiene y no-regresión

| compuerta | comando | resultado |
|---|---|---|
| credenciales | `grep -cE 'postgres(ql)?://' 116-FECHAS-AUDIT.md` | `0` |
| RUT | `grep -cE '[0-9]{7,8}-[0-9kK]' 116-FECHAS-AUDIT.md` | `0` |
| marcadores pendientes | check 5 del script (los tres marcadores de trabajo inconcluso) | `0` |
| celdas de tabla vacías | check 5 del script | `0` |
| email de persona natural | `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' \| sort -u` | sin match |
| código de producto | `git status --porcelain app/ packages/` | vacío |
| flags / entorno | `git diff --quiet -- .env .env.example` | limpio |

**Suite de tests: NO se corrió `pnpm test`, y el motivo se declara explícitamente.** Esta fase es de
auditoría en régimen solo-lectura: no modifica una sola línea de `app/` ni de `packages/`
(compuerta anterior, vacía). Sin cambio de código no hay regresión posible que la suite pueda
detectar, así que correrla sería ruido, no verificación. La suite vuelve a ser obligatoria en
**Phase 117**, que sí toca código.

### 7.5 Cierre

| criterio | estado |
|---|---|
| SC1 — veredicto por fecha con origen citado | `### 1.4` — 100 filas, 38/38 ids cubiertos |
| SC2 — lista de `fecha_captura`-como-hecho con archivo:línea y superficie | `### 5.1` — 25 entradas |
| SC3 — date-only verificadas contra el gotcha tz | `### 1.3` — 18 filas, 0 conversiones activas, 0 pendientes |
| SC4 — cruce contra PROD, un sujeto por superficie | `## 2.` — 26 filas, 10/10 superficies |
| completitud probada por script que muerde | `## 7.1`–`## 7.3` — 6/6 checks OK, mutación mordida |
| hallazgos consumibles por Phase 117 sin re-investigar | `## 3.` — F-01..F-14, 8 campos poblados cada uno |
