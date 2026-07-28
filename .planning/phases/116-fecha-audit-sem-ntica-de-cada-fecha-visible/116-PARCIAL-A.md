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
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:528` | `fechaCortaSegura` | `RPC:votos_de_parlamentario.fecha` ← `tabla.votacion.fecha` | hecho | `(sin rótulo)` — la fecha va sola en `<span className="font-mono text-muted-foreground">`, entre la etapa (`:525`) y `· el proyecto fue {e.resultado}` (`:533`) | no — es la fecha del hecho (la votación) y el contexto sintáctico es la votación; `fechaCortaSegura` es `seguro` (§1.1) | — |
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:287` (formateo), render en `:446,:450,:451` | `mesAnioFormatter` (`Intl` es-CL, `timeZone:"UTC"` en `:290`) | min/max de `RPC:votos_de_parlamentario.fecha` vía `parseFechaVotoSegura` (`:218-220`, slice ISO UTC) | hecho | `en {mesInicio}` (`:446`) o `entre {mesInicio} y {mesFin}` (`:450-451`), dentro de la línea-resumen del arco | no — rango de meses del HECHO; `timeZone:"UTC"` explícita + base UTC en construcción (`Date.UTC`, `:298`), veredicto de capa `seguro` (§1.1) | — |
| E-001 | `/parlamentario/[id]` | `votos-por-parlamentario.tsx:546` | `relativeTimeEs` vía `ProvenanceBadge` | `RPC:votos_de_parlamentario.fecha_captura` ← `tabla.votacion.fecha_captura` | captura | `Actualizado {relativeTimeEs(capturedAt)}` (`provenance-badge.tsx:90`) | sí — idiom no aprobado: "Actualizado" sugiere que el dato cambió, no que lo miramos (§2 de FORMATTERS, candidato transversal) | — |
| E-002 | `/parlamentario/[id]#lobby` (vista agrupada) | `lobby-de-parlamentario.tsx:153` (render en `:441`) | `fechaCorta(new Date(a.fecha))` | `RPC:lobby_de_parlamentario.fecha` ← `tabla.lobby_audiencia.fecha` | hecho | `(sin rótulo)` — `{r.fechaTexto}` en `<span className="font-mono text-sm text-muted-foreground">` (`:441`), abriendo el `<li>` de cada reunión; fallback `a.fecha_raw ?? "Fecha no publicada"` (`:154`) | no — fecha de la audiencia (el hecho); riesgo latente de capa por `fechaCorta` sin `timeZone` (ver A.2.1) | — |
| E-002 | `/parlamentario/[id]#lobby` (vista cronológica) | `lobby-de-parlamentario.tsx:478` (render en `:487`) | `fechaCorta(new Date(a.fecha))` | `RPC:lobby_de_parlamentario.fecha` ← `tabla.lobby_audiencia.fecha` | hecho | `(sin rótulo)` — comentario del código la nombra "Fecha de la audiencia (mono)" (`:485`), pero al usuario le llega pelada; fallback `"Fecha no publicada"` | no — fecha del hecho; misma nota de capa que la fila anterior | — |
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
`116-FORMATTERS.md` §2; **ninguno tiene defecto en sus fechas propias** (todas las fechas del hecho
de estos seis emisores salen limpias, con rótulo explícito o contexto inequívoco). E-053 suma un
agravante propio: su `fecha_captura` es el `now()` del FULL REBUILD del pipeline, no de la fuente, y
eso solo está declarado en comentario (`:184-193`), invisible al usuario.
</content>
</invoke>
