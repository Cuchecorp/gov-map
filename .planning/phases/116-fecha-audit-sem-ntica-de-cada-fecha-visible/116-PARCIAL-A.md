---
phase: 116
plan: 02
grupo: A
consumido_por: [116-04]
regimen: solo-lectura
fecha_corrida: 2026-07-28
base_compartida: 116-FORMATTERS.md
---

# 116-PARCIAL-A — Veredicto por emisor×fecha del grupo A

Grupo A del catálogo `113-INVENTARIO.md` §3.0: carril parlamentario (ficha 360, directorio,
`/comparar`, `/cuenta`) + los emisores bajo gate MONEY. **18 ids.**

**Régimen: SOLO LECTURA.** Cero cambio de código de producto, cero flag tocado. Todo fix va a
Phase 117. El veredicto de CAPA de cada formatter y el del chokepoint `ProvenanceBadge` se **aplican
desde `116-FORMATTERS.md`** (§1.1 y §2.2); no se re-derivan aquí.

---

## A.0 Reglas de decisión (LOCKED, aplicadas sin excepción en A.1 y A.2)

1. Toda fecha que llega vía la prop `capturedAt` del `ProvenanceBadge` → **captura** por REGLA
   LOCKED (113 §3.1.1), sin más análisis. El veredicto por call-site ya está emitido en
   `116-FORMATTERS.md` §2.2: se **referencia**, no se recalcula.
2. Toda OTRA fecha exige rastreo explícito hasta su columna o RPC. Si el rastreo no llega a una
   columna concreta → **ambigua**, causa `origen no rastreable estáticamente`. Jamás se adivina.
3. Fecha cuyo origen es `fecha_captura` (o derivado: `fecha_captura_max`, `fechaCaptura`,
   `capturedAt`, `ingestado_hasta`) presentada SIN el idiom "según fuente al…" (o equivalente
   aprobado) → **captura** + `¿miente?` = `sí — presentada como el hecho`. Hallazgo para 117.
4. Palabra "captura" **pelada** en copy visible → `sí — término prohibido (v10.0)`.
5. Fecha date-only sometida a conversión de zona → `sí — conversión tz sobre date-only`
   (gotcha mayor v9.0 pasada 2).

Conjunto cerrado de VEREDICTO: `hecho` | `captura` | `ambigua`.

**Nota de capa heredada de `116-FORMATTERS.md` §1.1** (se arrastra a toda fila que use `fechaCorta`):
`fechaCorta` (`app/lib/format.ts:21`) **no fija `timeZone`** — su corrección depende de que el
runtime sea UTC. Sobre date-only-medianoche-UTC en runtime UTC el día NO cambia, así que hoy no hay
conversión observable; queda como **riesgo latente** registrado en `### A.2.1`, no como mentira de
copy. `fechaCortaSegura` (`format.ts:121`) es `seguro` por construcción (slice ISO antes de `new Date`).

---

## A.1 Carril ficha parlamentario

Columnas: `id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO |
etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate`.

| id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO | etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate |
|---|---|---|---|---|---|---|---|---|
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:528` | `fechaCortaSegura` | `RPC:votos_de_parlamentario.fecha` ← `tabla.votacion.fecha` | hecho | `(sin rótulo)` — la fecha va sola en `<span className="font-mono text-muted-foreground">`, entre la etapa (`:525`) y `· el proyecto fue {e.resultado}` (`:533`) | sí — ambigüedad de DÍA (no de semántica): `votacion.fecha` es **`timestamptz`** (`0008_tramitacion.sql:40`), no date-only; `fechaCortaSegura` recorta el ISO **UTC** (`format.ts:121`), así que una votación chilena de la tarde-noche se rinde con el día UTC siguiente. Ver `### A.2.1` | — |
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:287` (formateo), render en `:446,:450,:451` | `mesAnioFormatter` (`Intl` es-CL, `timeZone:"UTC"` en `:290`) | min/max de `RPC:votos_de_parlamentario.fecha` vía `parseFechaVotoSegura` (`:218-220`, slice ISO UTC) | hecho | `en {mesInicio}` (`:446`) o `entre {mesInicio} y {mesFin}` (`:450-451`), dentro de la línea-resumen del arco | no — rango de meses del HECHO; `timeZone:"UTC"` explícita + base UTC en construcción (`Date.UTC`, `:298`), veredicto de capa `seguro` (§1.1) | — |
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:546` | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:votos_de_parlamentario.fecha_captura` ← `tabla.votacion.fecha_captura` | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado: "Actualizado" sugiere que el dato cambió, no que lo miramos (§2 de FORMATTERS, candidato transversal) | — |
| E-002 | `/parlamentario/[id]#lobby` (vista agrupada) | `lobby-de-parlamentario.tsx:153` (render en `:441`) | `fechaCorta(new Date(a.fecha))` | `RPC:lobby_de_parlamentario.fecha` ← `tabla.lobby_audiencia.fecha` | hecho | `(sin rótulo)` — `{r.fechaTexto}` en `<span className="font-mono text-sm text-muted-foreground">` (`:441`), abriendo el `<li>` de cada reunión; fallback `a.fecha_raw ?? "Fecha no publicada"` (`:154`) | sí — ambigüedad de DÍA: `lobby_audiencia.fecha` es **`timestamptz`** con hora real (`0021_lobby.sql:41`; `fecha_raw` ejemplo `"2023-12-26 13:00:00-03"`, `:42`) y `fechaCorta` no fija `timeZone` (runtime UTC) → una audiencia vespertina chilena se rinde con el día siguiente. Ver `### A.2.1` | — |
| E-002 | `/parlamentario/[id]#lobby` (vista cronológica) | `lobby-de-parlamentario.tsx:478` (render en `:487`) | `fechaCorta(new Date(a.fecha))` | `RPC:lobby_de_parlamentario.fecha` ← `tabla.lobby_audiencia.fecha` | hecho | `(sin rótulo)` — comentario del código la nombra "Fecha de la audiencia (mono)" (`:485`), pero al usuario le llega pelada; fallback `"Fecha no publicada"` | sí — misma ambigüedad de DÍA que la fila anterior (mismo origen `timestamptz`, mismo formatter sin `timeZone`) | — |
| E-002 | `/parlamentario/[id]#lobby` | `lobby-de-parlamentario.tsx:536` | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:lobby_de_parlamentario` ← `tabla.lobby_audiencia.fecha_captura` (`captured`, `:476`) | captura | `Actualizado {…}` (`provenance-badge.tsx:90`), `densidad="lista"` (`:535`) | sí — mismo idiom no aprobado del chokepoint | — |
| E-003 | `—` (**HUÉRFANO**) | `voto-ficha-row.tsx:135` | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:votos_de_parlamentario.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` (`:134`) | sí — idiom no aprobado del chokepoint (vale si alguien re-monta el componente) | `— (EMISOR HUÉRFANO, no renderizado en ninguna ruta)` |
| E-003 | `—` (**HUÉRFANO**) | `voto-ficha-row.tsx:220` | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:votos_de_parlamentario.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` (`:219`) — segunda rama de render del mismo componente | sí — idem fila anterior | `— (EMISOR HUÉRFANO, no renderizado en ninguna ruta)` |
| E-003 | `—` (**HUÉRFANO**) | `voto-ficha-row.tsx:174` | `(ninguno — no se formatea)` | `RPC:votos_de_parlamentario.fecha` pasada a `SustanciaYDesenlace`… **no**: `:174` la reenvía dentro del objeto `voto` a `VotoRow`/detalle, que **no la renderiza** (ver A.1.bis) | ambigua | `(sin render)` — `.fecha` entra al componente pero ningún JSX la emite | no — no hay copy que pueda mentir; se declara para cerrar el par `.fecha`/`.fecha_captura` del inventario: **`:135` y `:220` reciben `.fecha_captura`; `.fecha` nunca llega a un render** | `— (EMISOR HUÉRFANO, no renderizado en ninguna ruta)` |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:418` (render en `:453` y `:458`) | `fechaCortaSegura` | `RPC:declaraciones_de_parlamentario.fecha_presentacion` ← `tabla.declaracion.fecha_presentacion` | hecho | `Presentada el {fechaTexto}` (`:453`) y, si `es_historica`, `Esta es una declaración histórica, presentada el {fechaTexto}. No representa necesariamente el estado actual.` (`:457-459`) | no — rótulo explícito del hecho (presentación de la declaración); `fechaCortaSegura` es `seguro` | — |
| E-005 | `/parlamentario/[id]` (form de comparación) | `patrimonio-de-parlamentario.tsx:688`, `:702` | `fechaCortaSegura` | `RPC:declaraciones_de_parlamentario.fecha_presentacion` (lista `fechasDisponibles`, `:981-987`) | hecho | `Presentada el {fechaCortaSegura(f)}` — texto de cada `<option>` de los dos `<select>` (A y B) | no — mismo rótulo explícito del hecho | — |
| E-005 | `/parlamentario/[id]` (tabla comparativa) | `patrimonio-de-parlamentario.tsx:729` | `fechaCortaSegura` | `RPC:comparar_declaraciones.fecha_presentacion` | hecho | `Presentada el {fechaCortaSegura(c.fecha_presentacion)}` — cabecera `<TableHead scope="col">` de cada columna comparada | no — idem | — |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:445`, `:769` | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.declaracion.fecha_captura` (`:414` y `c.fecha_captura`) | captura | `Actualizado {…}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado del chokepoint | — |
| E-005 | `/parlamentario/[id]` | `patrimonio-de-parlamentario.tsx:989` | `(ninguno)` | `tabla.probidad_ingesta_estado` — el `select` es `parlamentario_id` (`:992`), **cero columna de fecha** | hecho | `(sin fecha renderizada)` — la frescura se usa solo como booleano `noIngestado` (`:1000`) para elegir el empty-state | no — el anchor `:989` del inventario NO emite fecha alguna; se declara para cerrar el ítem | — |
| E-012 | `/parlamentarios` | `parlamentario-directory-row.tsx:48` | `(ninguno — propaga)` | `RPC:parlamentarios_publico_v2.partido_fecha_captura` → prop `fechaCaptura` de `PartidoChip` | captura | `(sin rótulo propio)` — la fila no emite copy de fecha; **el veredicto efectivo es el de E-019** (ver fila siguiente) | no — propagación sin copy propio; el veredicto vive en E-019 | — |
| E-019 | `/parlamentarios`, `/parlamentario/[id]` | `partido-chip.tsx:65` (rótulo en `:73` / `:112-116`) | `fechaCorta` | `props.fechaCaptura` ← `RPC:parlamentarios_publico_v2.partido_fecha_captura` / `RPC:parlamentario_publico_v2.partido_fecha_captura` (militancia vigente) | captura | Variante plana (`title`/`aria-label`, `:73`): `según {fuente} al {fecha}`; sin fecha: `según {fuente}`. Variante tooltip (`:112-116`): `según {fuente}` + `" al "` + `{fecha}` en `font-mono`. `aria-label` = `Partido: {nombre}, {provenance}` (`:76`) | no — **usa el idiom aprobado "según fuente al …"** (regla 3 satisfecha) y jamás fabrica fecha; nota de capa: `fechaCorta` sin `timeZone` (A.2.1) | — |
| E-026 | `/proyecto/[boletin]`, `/parlamentario/[id]` | `voto-row.tsx` (archivo completo, 63 líneas) | `(ninguno)` | `tabla.votacion.fecha` **no llega al JSX** | — | ver `### A.1.bis` | — | — |
| E-053 | `/parlamentario/[id]` | `cruces-de-parlamentario.tsx:178` | `fechaCorta(new Date(item.fecha))` | `RPC:cruces_de_parlamentario.fecha` ← evidencia de `tabla.cruce_senal` | hecho | `Reunión registrada el {fechaCorta(new Date(item.fecha))}` (`:178`); si no hay fecha la línea se omite entera (`:176`, honest-state) | no — rótulo explícito del hecho, sin verbo causal; el comentario `:172-175` declara la separación respecto de la frescura | CRUCES (ON — superficie viva) |
| E-053 | `/parlamentario/[id]` | `cruces-de-parlamentario.tsx:196` | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:cruces_de_parlamentario` ← `tabla.cruce_senal.fecha_captura` (`= now()` del FULL REBUILD diario) | captura | `Actualizado {…}`, `densidad="lista"` (`:195`) | sí — idiom no aprobado; agravante propio: la captura es del **rebuild del pipeline**, no de la fuente (declarado solo en comentario `:184-193`, invisible al usuario) | CRUCES (ON — superficie viva) |
| E-054 | `/parlamentario/[id]` | `militancias-de-parlamentario.tsx:26` (render en `:64` y `:89`) | `fechaCorta(new Date(desde))` | `RPC:militancias_de_parlamentario.desde` ← `tabla.parlamentario_militancia.desde` | hecho | Vigente (`:64-66`): `{desde} – vigente` en `font-mono` seguido de ` · ` + `Vigente`. Histórica (`:89`): `{desde} – {hasta}` en `font-mono`. Sin `desde` → literal `sin fecha` (`:26`) | no — fecha del hecho (inicio de militancia); riesgo latente de capa (A.2.1) | — |
| E-054 | `/parlamentario/[id]` | `militancias-de-parlamentario.tsx:27` (render en `:64` y `:89`) | `fechaCorta(new Date(hasta))` / literal | `RPC:militancias_de_parlamentario.hasta` ← `tabla.parlamentario_militancia.hasta` | hecho | Con `hasta`: la fecha en `font-mono`. **Sin `hasta`: literal `vigente`** (`:27`) — cero `new Date()`, cero fecha inventada | no — **ausencia honesta**: verificado que no se fabrica fecha alguna cuando `hasta` es `null` | — |
| E-057 | `/parlamentario/[id]` | `comisiones-de-parlamentario.tsx` (archivo completo, 73 líneas) | `(ninguno)` | `RPC:comisiones_de_parlamentario` — el componente usa `nombre`, `tipo`, `cargo` (`:24`) | — | ver `### A.1.bis` | — | — |
| E-059 | `/parlamentario/[id]` | `parlamentario-header.tsx:116` (valor en `:37-39`) | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:parlamentario_publico_v2.fecha_captura` ← `tabla.parlamentario.fecha_captura` | captura | `Actualizado {…}` (`provenance-badge.tsx:90`), badge de cabecera (densidad por defecto) | sí — idiom no aprobado del chokepoint | — |

**22 filas de datos.** Los ids `E-026` y `E-057` aparecen con veredicto en `### A.1.bis` (no emiten
fecha; sus dos filas de arriba son punteros y no llevan veredicto del conjunto cerrado).

### A.1.bis Emisores del grupo A que NO renderizan ninguna fecha

Hallazgo de cobertura: dos ids que el plan clasificó en el grupo A **no emiten fecha al DOM**. Se
declaran aquí en vez de forzarlos al conjunto cerrado {`hecho`,`captura`,`ambigua`}, que solo tiene
sentido sobre una fecha visible. Ambos coinciden con lo que ya decía `113-INVENTARIO.md` (§3.0 los
lista con origen de dato pero **sin formatter**).

| id E-xxx | archivo | evidencia de ausencia | condición registrada |
|---|---|---|---|
| E-026 | `app/components/voto-row.tsx` | `grep -nE "fechaCorta\|Intl\|toLocaleDateString\|capturedAt\|new Date" voto-row.tsx` → **0 matches** en 63 líneas. El componente emite nombre + `Badge` de selección (`:59`) y nada más | **no emite fecha**. El inventario lo ancla a `tabla.votacion.fecha` *vía E-056* (`votacion-card.tsx:39`), que es quien la renderiza — auditado en el grupo B (plan 03) |
| E-057 | `app/components/comisiones-de-parlamentario.tsx` | mismo grep → **0 matches** en 73 líneas. `lineaComision` (`:22-27`) compone `nombre · tipo · cargo`; el empty-state (`:49`) tampoco lleva fecha | **no emite fecha**. La fecha de su superficie la pone el `ProvenanceBadge` del header (E-059, `parlamentario-header.tsx:116`), no este componente |

Sin hallazgos: E-012, E-019, E-026, E-054, E-057.

Emisores CON hallazgo en `## A.1`: **E-001, E-002, E-003, E-005, E-053, E-059** — en los seis, el
único defecto es el **mismo idiom transversal del chokepoint** `ProvenanceBadge` ("Actualizado hace
X" sobre `fecha_captura`, `provenance-badge.tsx:90`), ya emitido como candidato por
`116-FORMATTERS.md` §2. Además, **dos emisores tienen defecto propio de DÍA** (no de semántica):
**E-001** (`votacion.fecha`, `timestamptz`, recortado en UTC) y **E-002** (`lobby_audiencia.fecha`,
`timestamptz` con hora real, formateado sin `timeZone`) — en ambos el día visible puede correr un
día respecto del día chileno del hecho; detalle y evidencia de tipo en `### A.2.1`. E-053 suma un
agravante propio: su `fecha_captura` es el `now()` del FULL REBUILD del pipeline, no de la fuente, y
eso solo está declarado en comentario (`:184-193`), invisible al usuario.

---

## A.2 /comparar, /cuenta y gate MONEY

Misma tabla de 9 columnas y **mismas reglas de decisión** que `## A.1` (declaradas en `## A.0`; no se
re-declaran aquí). Los call-sites de `capturedAt` de esta sección ya tienen veredicto de badge en
`116-FORMATTERS.md` §2.2 (filas 2, 4, 5, 9): se referencian, no se recalculan.

| id E-xxx | ruta(s) | archivo:línea | formatter | columna/RPC de origen | VEREDICTO | etiqueta visible actual (verbatim) | ¿miente o es ambigua? | gate |
|---|---|---|---|---|---|---|---|---|
| E-051 | `/comparar` | `comparar/page.tsx:524-525` (valor), render en `similitud-votacion-comparar.tsx:134-135` | `String(...).slice(0,10)` — sin `Intl`; el valor ya viene ISO del RPC | `RPC:coincidencia_votos_par.fecha_captura_max` (máximo de `fecha_captura` de las filas del par) | captura | `Fuente: votaciones de Cámara y Senado · según fuente al ` + `{fechaCaptura}` en `font-mono` + `.` (`similitud-votacion-comparar.tsx:133-136`) | no — **usa el idiom aprobado "según fuente al …"** (regla 3 satisfecha). El comentario `:127-133` documenta que el idiom se adoptó justamente porque "captura" pelada está en `TERMINOS_PROHIBIDOS` (regla 4 satisfecha por diseño) | VSIM (ON — superficie viva) |
| E-051 | `/comparar` | `comparar/page.tsx:54` (`Intl` en `:55`, `timeZone` en `:56`), valor en `:234` | `fechaConsultaHoy` — `Intl` locale `en-CA` (⇒ ISO `YYYY-MM-DD`), `timeZone: "America/Santiago"` explícita | `new Date()` por request (ruta `force-dynamic`, `:43`) — no es una columna: es la fecha de CONSULTA | hecho | `Fuente: BCN · consultado al {fechaConsulta}` (`:293`); `Fuente: Cámara/Senado · consultado al {fechaConsulta}` (`:325,:442,:490` — `:325` es la rama de fallback del eje comisiones); en el eje VSIM degradado, `Sin votaciones compartidas suficientes en las fuentes consultadas al {fechaConsulta}.` (`similitud-votacion-comparar.tsx:104-105`) | no — el hecho es **la consulta**, y el idiom "consultado al" lo dice literalmente; `timeZone` explícita ⇒ día chileno correcto (§1.1 `seguro`). El comentario `:45-52` declara la distinción "consultado al" vs "según fuente al" | VSIM (el eje de similitud) |
| E-051 | `/comparar` (eje comisiones) | `comparar/page.tsx:318-325` | `.slice(0,10)` + guard regex ISO (`:319-320`), `sort().at(-1)` (`:321-322`) | `RPC:comisiones_de_parlamentario.fecha_captura` (máx. entre A y B) | captura | `Fuente: Cámara/Senado · según fuente al {fechaFuenteComisiones}` (`:324`); sin filas cae a `… · consultado al {fechaConsulta}` (`:325`) | no — idiom aprobado, y la degradación a "consultado al" es honesta (no fabrica fecha de fuente) | — |
| E-052 | `/cuenta` | `cuenta/page.tsx:90` (`Intl` en `:91`, `timeZone` en `:92`), render en `:282` | `fechaCorta` local de /cuenta (homónimo de `format.ts:21` con semántica distinta: fija `timeZone: "America/Santiago"`, locale `en-CA`) | `tabla.consentimiento.created_at` (`timestamptz not null default now()`; leída en `:216`) | hecho | `Consentimiento registrado el {fechaCorta(consentimiento.created_at)} · versión {consentimiento.version_texto} del texto informado.` (`:282-283`) | no — el hecho ES el acto del propio usuario (dar el consentimiento); no es scraping ni hecho del Congreso. `timeZone` explícita ⇒ día chileno correcto | NOTIF — no emitido en el deploy auditado (NOTIF OFF) |
| E-052 | `/cuenta` | `cuenta/page.tsx:90` (`Intl` en `:91`), render en `:310` | `fechaCorta` local de /cuenta | `tabla.suscripcion.created_at` (`timestamptz`; leída en `:211`) | hecho | `Suscrito el {fechaCorta(suscripcion.created_at)}` (`:310`) | no — hecho = el acto de suscribirse del propio usuario; idem tz explícita | NOTIF — no emitido en el deploy auditado (NOTIF OFF) |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:176` (valor `:175-177`, render `:213`) | `fechaCorta` | `RPC:aportes_de_parlamentario.fecha_aporte` ← `tabla.aporte.fecha_aporte` (**`date`**, `0024_servel.sql:93`) | hecho | `<dt>Fecha del aporte:</dt>` + `<dd className="text-base font-mono">{fechaAporteTexto}</dd>` (`:212-213`); sin valor → literal `Fecha no publicada` (`:177`) | no — NOUN-label explícito del hecho (la transferencia del aporte); date-only sin conversión observable en runtime UTC (A.2.1) | MONEY — no emitido en el deploy auditado |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:179` (valor `:178-180`, render `:223-224`) | `fechaCorta` | `RPC:aportes_de_parlamentario.fecha_corte` ← `tabla.aporte.fecha_corte` (**`date not null`**, `0024_servel.sql:72`, comentada "fecha de corte de la consulta SERVEL") | ambigua | `Consultado por nombre del candidato, corte al ` + `{fechaCorteTexto}` en `font-mono` + `.` (`:223-224`) | sí — **ambigua por categoría**: `fecha_corte` no es el hecho ni el reloj de scraping, es el **borde del periodo cubierto por la fuente**. El copy la nombra "corte al", que es literal, pero el usuario no puede distinguirla del "Actualizado hace X" del badge de la misma fila (dos fechas de naturaleza distinta, sin explicación de cuál acota qué). Hallazgo de DESAMBIGUACIÓN para 117 | MONEY — no emitido en el deploy auditado |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:356` (valor `:355-357`, render `:363-365`) | `fechaCorta` | `tabla.aportes_ingesta_estado.ingestado_hasta` (**`date`**, `0024_servel.sql:165`; leída en `:518`) | ambigua | `Consultamos SERVEL por este candidato (corte al {fechaTexto}) y no se registran aportes asociados a ese candidato a esa fecha.` (`:363-366`); sin valor, el literal `la fecha de corte` (`:356`) | sí — mismo eje que la fila anterior: `ingestado_hasta` es **cobertura de ingesta**, presentada bajo el mismo rótulo "corte al" que `fecha_corte` (columna distinta, misma etiqueta). El resto del empty-state es honesto | MONEY — no emitido en el deploy auditado |
| E-013 | `/parlamentario/[id]` | `financiamiento-de-parlamentario.tsx:233` (valor `:170`) | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:aportes_de_parlamentario` ← `tabla.aporte.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` (`:232`) | sí — idiom no aprobado del chokepoint (§2 de FORMATTERS) | MONEY — no emitido en el deploy auditado |
| E-014 | `/contraparte/[id]` | `contratos-por-contraparte.tsx:136` (valor `:135-137`, render `:159`) | `fechaCorta` | `RPC:agregado_por_contraparte` (rama contratos) ← `tabla.contrato.fecha_oc` (**`date`**, `0023_dinero.sql:79`) | hecho | `<dt>Fecha de la orden:</dt>` + `<dd>` con `{fechaOcTexto}` (`:158-159`) | no — NOUN-label explícito del hecho (orden de compra) | MONEY — no emitido en el deploy auditado |
| E-014 | `/contraparte/[id]` | `contratos-por-contraparte.tsx:139` (valor `:138-140`, render `:167-168`) | `fechaCorta` | `tabla.contrato.fecha_corte` (**`date not null`**, `0023_dinero.sql:61`) | ambigua | `Consolidado, corte al ` + `{fechaCorteTexto}` en `font-mono` + `.` (`:167-168`) | sí — misma ambigüedad de categoría que E-013 `fecha_corte`, agravada: "Consolidado" no dice de QUÉ es el corte ni quién consolidó | MONEY — no emitido en el deploy auditado |
| E-014 | `/contraparte/[id]` | `contratos-por-contraparte.tsx:177` (valor `:132`) | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.contrato.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` (`:176`) | sí — idiom no aprobado del chokepoint | MONEY — no emitido en el deploy auditado |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:135` (valor `:134-136`, render `:176`) | `fechaCorta` | `RPC:contratos_de_parlamentario.fecha_oc` ← `tabla.contrato.fecha_oc` (**`date`**) | hecho | `<dt>Fecha de la orden:</dt>` + `<dd>` con `{fechaOcTexto}` (`:175-176`) | no — NOUN-label explícito del hecho | MONEY — no emitido en el deploy auditado |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:138` (valor `:137-139`, render `:184-185`) | `fechaCorta` | `tabla.contrato.fecha_corte` (**`date not null`**) | ambigua | `Consultado por RUT, corte al ` + `{fechaCorteTexto}` en `font-mono` + `.` (`:184-185`) | sí — misma ambigüedad de categoría (`fecha_corte` ≠ hecho ≠ captura), en la misma fila que un badge "Actualizado hace X" | MONEY — no emitido en el deploy auditado |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:226` (valor `:225-227`, render `:233-235`) | `fechaCorta` | `tabla.contratos_ingesta_estado.ingestado_hasta` (**`date`**, `0023_dinero.sql:136`; leída en `:354`) | ambigua | `Consultamos ChileCompra por el RUT de este parlamentario (corte al {fechaTexto}) y no se registran contratos asociados a ese RUT a esa fecha.` (`:233-235`); sin valor, literal `la fecha de corte` (`:227`) | sí — `ingestado_hasta` (cobertura de ingesta) bajo el mismo rótulo "corte al" que `fecha_corte`; el usuario no puede separarlas | MONEY — no emitido en el deploy auditado |
| E-015 | `/parlamentario/[id]` | `contratos-de-parlamentario.tsx:194` (valor `:127`) | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:contratos_de_parlamentario` ← `tabla.contrato.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` (`:193`) | sí — idiom no aprobado del chokepoint | MONEY — no emitido en el deploy auditado |
| E-016 | `/contraparte/[id]` | `aportes-por-contraparte.tsx:149` (valor `:148-150`, render `:178`) | `fechaCorta` | `RPC:agregado_por_contraparte` (rama aportes) ← `tabla.aporte.fecha_aporte` (**`date`**) | hecho | `<dt>Fecha del aporte:</dt>` + `<dd>` con `{fechaAporteTexto}` (`:177-178`) | no — NOUN-label explícito del hecho | MONEY — no emitido en el deploy auditado |
| E-016 | `/contraparte/[id]` | `aportes-por-contraparte.tsx:152` (valor `:151-153`, render `:188-189`) | `fechaCorta` | `tabla.aporte.fecha_corte` (**`date not null`**) | ambigua | `Consolidado, corte al ` + `{fechaCorteTexto}` en `font-mono` + `.` (`:188-189`) | sí — idéntica a E-014: "Consolidado" no declara de qué es el corte | MONEY — no emitido en el deploy auditado |
| E-016 | `/contraparte/[id]` | `aportes-por-contraparte.tsx:198` (valor `:147`) | `relativeTimeEs` vía `ProvenanceBadge` | `tabla.aporte.fecha_captura` | captura | `Actualizado {…}`, `densidad="lista"` (`:197`) | sí — idiom no aprobado del chokepoint | MONEY — no emitido en el deploy auditado |
| E-060 | `/contraparte/[id]` | `contraparte/[id]/page.tsx:19` (comentario), gate en `:50-51` | `(ninguno)` | `RPC:agregado_por_contraparte` — la página no formatea ninguna fecha; delega en E-014/E-016 | ambigua | `(sin render propio)` — su único match de `ProvenanceBadge` es el COMENTARIO de docstring `:19` ("cada fila trazada (ProvenanceBadge + fecha + enlace)"), no un JSX | no — no hay copy propio que pueda mentir; se declara para cerrar el id. Verificado **sin encender ningún flag ni tocar el deploy**: `if (!moneyPublicEnabled(process.env))` + `notFound();` son la PRIMERA sentencia (`:50-51`) ⇒ la ruta entera 404ea con MONEY OFF | MONEY — no emitido en el deploy auditado |

**20 filas de datos** en `## A.2`.

Sin hallazgos: E-051, E-052, E-060.

`E-013`, `E-014`, `E-015` y `E-016` SÍ tienen hallazgo — todos bajo `MONEY — no emitido en el deploy
auditado`, así que hoy no se ven: son deuda de copy que 117 debe resolver ANTES de cualquier flip del
gate. `E-060` no emite fecha propia, por eso queda sin hallazgo pese a vivir bajo MONEY.

### A.2.1 Auditoría date-only (gotcha LOCKED v9.0)

Regla dura: sobre date-only, **la parte fecha UTC ES el día chileno**; cualquier conversión de zona
es hallazgo. Se audita también el corolario opuesto: una columna que **no** es date-only (timestamp
real) formateada **sin** `timeZone` explícita puede correr el día visible.

Formato alineado con `### B.2.1` del plan 03 para que el plan 04 pueda unir ambas tablas.

| columna date-only | emisor(es) | formatter | ¿se convierte de zona? (sí/no + evidencia de línea) | veredicto |
|---|---|---|---|---|
| `parlamentario_militancia.desde` (**`date`**, `0059_bio_comisiones.sql:67`) | E-054 | `fechaCorta(new Date(desde))` (`militancias-de-parlamentario.tsx:26`) | **no** — `new Date("YYYY-MM-DD")` ⇒ medianoche UTC (ES2015) y `fechaCorta` (`format.ts:21`) formatea con `Intl` es-CL sin `timeZone`: en runtime UTC el día NO cambia. Cero aritmética de zona en `:26` | **cumple** hoy; **riesgo latente**: la corrección depende del huso del runtime, no del código (candidato de capa ya emitido en `116-FORMATTERS.md` §1.1) |
| `parlamentario_militancia.hasta` (**`date`**, `0059_bio_comisiones.sql:68`, "NULL si vigente") | E-054 | `fechaCorta(new Date(hasta))` (`:27`) / literal `vigente` | **no** — mismo mecanismo que `desde`; con `null` no se construye `Date` alguno (`:27` devuelve el literal `vigente`) | **cumple**; ausencia honesta verificada (cero `new Date()` de relleno) |
| `declaracion.fecha_presentacion` (**`date not null`**, `0022_probidad.sql:83`) | E-005 | `fechaCortaSegura` (`patrimonio-de-parlamentario.tsx:418,688,702,729`) | **no** — `fechaCortaSegura` (`format.ts:121`) recorta `raw.slice(0,10)` y valida el patrón ISO ANTES de `new Date`: el valor formateado nunca lleva hora | **cumple** — patrón correcto para date-only (`seguro` en `116-FORMATTERS.md` §1.1) |
| `votacion.fecha` (**`timestamptz`**, `0008_tramitacion.sql:40` — NO es date-only) | E-001 (render `:528`; buckets mes/año `:218-220`) | `fechaCortaSegura` (`:528`) y `parseFechaVotoSegura` + `Date.UTC` (`:218-220,:298`) | **sí, implícitamente a UTC** — ambos caminos leen la parte fecha del ISO que emite PostgREST, que serializa `timestamptz` en UTC. Una votación chilena posterior a las 21:00 CL cae en el día UTC siguiente | **hallazgo de DÍA** — pendiente de confirmar por SQL en el plan 04 si los valores reales llevan hora significativa o son medianoche (si son medianoche UTC, el render es correcto y el riesgo es teórico) |
| `lobby_audiencia.fecha` (**`timestamptz`**, `0021_lobby.sql:41` — NO es date-only; `fecha_raw` ejemplo `"2023-12-26 13:00:00-03"`, `:42`) | E-002 (`:153,:478`) | `fechaCorta(new Date(a.fecha))` — sin `timeZone` | **sí** — el `Date` lleva hora real y `fechaCorta` lo rinde en el huso del runtime (UTC): una audiencia de las 21:00 CL se muestra con el día siguiente | **hallazgo de DÍA** — la fuente publica hora con offset `-03` explícito (`fecha_raw`), así que el día chileno es conocible; el render lo pierde. Confirmar magnitud por SQL en el plan 04 |
| `contrato.fecha_oc` (**`date`**, `0023_dinero.sql:79`) | E-014 (`:136`), E-015 (`:135`) | `fechaCorta(new Date(c.fecha_oc))` | **no** — date-only ⇒ medianoche UTC ⇒ runtime UTC preserva el día | **cumple**; mismo riesgo latente de runtime que `militancia.desde` |
| `aporte.fecha_aporte` (**`date`**, `0024_servel.sql:93`) | E-013 (`:176`), E-016 (`:149`) | `fechaCorta(new Date(a.fecha_aporte))` | **no** — idem | **cumple**; mismo riesgo latente de runtime |
| `contrato.fecha_corte` (**`date not null`**, `0023_dinero.sql:61`) / `aporte.fecha_corte` (**`date not null`**, `0024_servel.sql:72`) | E-013 (`:179`), E-014 (`:139`), E-015 (`:138`), E-016 (`:152`) | `fechaCorta(new Date(...))` | **no** — date-only, sin conversión observable en runtime UTC | **cumple en el eje tz**; el defecto de estas columnas es **de categoría, no de zona** (ver las filas `ambigua` de `## A.2`) |
| `aportes_ingesta_estado.ingestado_hasta` (**`date`**, `0024_servel.sql:165`) / `contratos_ingesta_estado.ingestado_hasta` (**`date`**, `0023_dinero.sql:136`) | E-013 (`:356`), E-015 (`:226`) | `fechaCorta(new Date(fechaCorte))` | **no** — date-only; sin conversión observable en runtime UTC | **cumple en el eje tz**; defecto de categoría (cobertura de ingesta rotulada "corte al", igual que `fecha_corte`) |
| `RPC:cruces_de_parlamentario.fecha` (tipo **no determinable estáticamente**: la evidencia viaja en JSONB y la RPC la re-tipa) | E-053 (`:178`) | `fechaCorta(new Date(item.fecha))` | **pendiente de confirmar por SQL en el plan 04** — si el origen último es `lobby_audiencia.fecha` (`timestamptz`), hereda el hallazgo de DÍA de E-002; si llega ya recortada a `date`, cumple | **pendiente de confirmar por SQL en el plan 04** — jamás se adivina el tipo |

**10 filas de datos.** Ninguna fecha date-only del grupo A sufre conversión de zona (regla LOCKED 3
respetada en todo el carril). Los dos hallazgos de DÍA (`votacion.fecha`, `lobby_audiencia.fecha`)
son el caso inverso: timestamps reales renderizados como si fueran date-only, perdiendo el huso
chileno.

---

## A.3 Cierre del grupo A

Los **18 ids** del grupo A y su cobertura de veredicto:

| # | id | sección | filas de veredicto | condición |
|---|---|---|---|---|
| 1 | E-001 | A.1 | 3 | — |
| 2 | E-002 | A.1 | 3 | — |
| 3 | E-003 | A.1 | 3 | **HUÉRFANO** (no renderizado en ninguna ruta) |
| 4 | E-005 | A.1 | 5 | — |
| 5 | E-012 | A.1 | 1 | propaga a E-019 (sin copy propio) |
| 6 | E-013 | A.2 | 4 | MONEY — no emitido en el deploy auditado |
| 7 | E-014 | A.2 | 3 | MONEY — no emitido en el deploy auditado |
| 8 | E-015 | A.2 | 4 | MONEY — no emitido en el deploy auditado |
| 9 | E-016 | A.2 | 3 | MONEY — no emitido en el deploy auditado |
| 10 | E-019 | A.1 | 1 | — |
| 11 | E-026 | A.1.bis | 1 (declaración de ausencia) | no emite fecha |
| 12 | E-051 | A.2 | 3 | VSIM (ON) |
| 13 | E-052 | A.2 | 2 | NOTIF — no emitido en el deploy auditado |
| 14 | E-053 | A.1 | 2 | CRUCES (ON — superficie viva) |
| 15 | E-054 | A.1 | 2 | — |
| 16 | E-057 | A.1.bis | 1 (declaración de ausencia) | no emite fecha |
| 17 | E-059 | A.1 | 1 | — |
| 18 | E-060 | A.2 | 1 | MONEY — no emitido en el deploy auditado |

**Cada uno de los 18 ids tiene al menos una fila de veredicto.** Cero omisiones silenciosas: los dos
emisores sin fecha (E-026, E-057) están declarados con evidencia de ausencia en `### A.1.bis`; el
huérfano (E-003) y los cinco gated (E-013..E-016, E-060) están auditados en código con su condición
en la columna `gate`.

**Régimen verificado al cierre:** `git status --porcelain app/ packages/` vacío y
`git diff --quiet -- .env .env.example` limpio en ambas tasks — cero código de producto tocado, cero
flag movido. Todo fix va a Phase 117.
