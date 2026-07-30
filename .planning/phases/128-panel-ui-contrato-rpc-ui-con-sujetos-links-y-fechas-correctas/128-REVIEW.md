---
phase: 128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/lib/idioms-panel.ts
  - app/lib/links-internos.ts
  - app/lib/panel-camara.ts
  - app/lib/panel-evidencia.ts
  - app/components/panel-item-proyecto.tsx
  - app/components/panel-tile-sala.tsx
  - app/components/panel-tile-comisiones.tsx
  - app/components/panel-tile-urgencias.tsx
  - app/components/panel-tile-movimiento.tsx
  - app/components/panel-tile-votaciones.tsx
  - app/components/panel-tile-ingresos.tsx
  - app/components/panel-actualidad.tsx
  - app/components/actualidad-module.tsx
findings:
  critical: 4
  warning: 13
  info: 0
  total: 17
status: fixed
fixed_at: 2026-07-30
fixed:
  critical: 4
  warning: 13
  total: 17
skipped: 0
---

# Phase 128: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

El parse defensivo de `panel-evidencia.ts` es sólido (cero `as`, degradación a `null`/`[]`,
tolera `evidencia = '{}'`), el guard `en_corpus` de `panel-item-proyecto.tsx` no emite `/proyecto`
en ningún path (incluidos puntos/tabla anidados), el orden `?query#hash` es correcto y `"datos al"`
tiene 0 ocurrencias en código de producción. La suite de la fase pasa (64/64 en los 4 archivos
ejecutados).

Los defectos están en los bordes que los tests no cubren: una lectura de `votacion` que puede
declarar falsamente "Sin votaciones fechadas", un tile fuera del sistema bento, y dos violaciones
de D-02/PANEL-07 donde el código contradice su propio docblock (fuente hardcodeada, "tercer origen"
que sí desaparece en silencio).

## Critical Issues

### CR-01: `order by fecha desc` en `votacion` trae NULLS FIRST → el tile puede declarar "Sin votaciones fechadas" siendo falso

**File:** `app/components/panel-tile-votaciones.tsx:121-149`
**Issue:** `votacion.fecha` es nullable (research §L4). En Postgres `ORDER BY ... DESC` es
`NULLS FIRST` por defecto, y PostgREST respeta ese default. Si existen filas con `fecha IS NULL`,
ocupan las primeras posiciones del `.limit(4)`; el bucle posterior las descarta
(`if (!f.fecha) continue`) y el tile renderiza *"Sin votaciones fechadas en las fuentes
consultadas."* con 4.855 votaciones vivas en la tabla. Es exactamente la clase de defecto
"número/afirmación falsa en portada" que el milestone existe para cerrar: el filtro se aplica en
TS después del `limit`, no en la query.
**Fix:**
```ts
const { data, error } = await sb
  .from("votacion")
  .select("id, boletin, fecha, resultado, total_si, total_no, total_abstencion, camara")
  .not("fecha", "is", null)                       // el hecho fechado se exige en la QUERY
  .order("fecha", { ascending: false, nullsFirst: false })
  .order("id", { ascending: false })
  .limit(maxItems);
```

### CR-02: `PanelTileVotaciones` renderiza fuera del sistema bento (sin `BentoTile`, sin span)

**File:** `app/components/panel-tile-votaciones.tsx:70-108`
**Issue:** Los otros 5 tiles envuelven su `<section>` en `<BentoTile variant="default" span={2|4} asChild>`.
Este devuelve un `<section className="p-6">` pelado como hijo directo de `<BentoGrid>`
(`md:grid-cols-6`): sin `md:col-span-N` cae a **1 de 6 columnas**, y sin `BentoTile` pierde
`bg-card`, `border`, `rounded-[var(--radius-tile)]` y el `focus-visible:ring`. No es un ajuste
estético de 129 — es un tile estructuralmente fuera de la grilla y sin la superficie de tarjeta.
**Fix:**
```tsx
return (
  <BentoTile variant="default" span={4} asChild>
    <section className="p-6">…</section>
  </BentoTile>
);
```

### CR-03: la cobertura L7 descarta en silencio cualquier origen fuera de las dos cámaras — el docblock afirma lo contrario

**File:** `app/components/panel-tile-comisiones.tsx:19-43, 121-130, 199-201`
**Issue:** El docblock declara (FIX W-5) que *"un tercer origen NO desaparece en silencio: si
aparece una fila con `cobertura_camara` fuera de `CAMARAS_CORPUS`, se declara igual (verbatim)"*.
El código acumula ese tercer origen en `conteoPorCamara`, pero el molde renderizado sólo itera
`ORDEN_COBERTURA` (Senado + Cámara, hardcodeado): el conteo del tercer origen se acumula y **nunca
se imprime**. Peor: se afirma "…en las fuentes consultadas" sobre un denominador incompleto, que es
justo lo que PANEL-07 prohíbe. Una fila con `cobertura_camara: null` también se pierde sin declararse.
**Fix:**
```tsx
const extras = [...conteoPorCamara.entries()]
  .filter(([k]) => !ORDEN_COBERTURA.some((c) => c.full === k))
  .map(([k, n]) => `${n} de ${k}`);           // verbatim, sin mapa
const segmentos = [
  ...ORDEN_COBERTURA.map((c) => c.molde(conteoPorCamara.get(c.full) ?? 0, true)),
  ...extras,
];
// … {`${segmentos.join(" · ")} en las fuentes consultadas`}
```
(Y sumar el conteo de filas con `cobertura_camara === null` como segmento propio, no omitirlo.)

### CR-04: `Fuente:` hardcodeada en sala y comisiones — D-02 exige la etiqueta DESDE EL DATO

**File:** `app/components/panel-tile-sala.tsx:143` · `app/components/panel-tile-comisiones.tsx:135`
**Issue:** `if (ev.fuente.dataset) etiquetaFuenteTile = "Agenda del Congreso";` — se lee el dato sólo
como bandera booleana y se emite un literal fijo. Si el materializador cambia `dataset` (o emite un
tercer dataset), el footer seguirá afirmando "Agenda del Congreso": una atribución de fuente falsa,
que es el mapa hardcodeado que D-02 mandó matar con `fuenteLabel`. El helper correcto
(`etiquetaFuente()` de `panel-evidencia.ts`, ya usado por urgencias/movimiento/ingresos) queda
muerto en estos dos tiles.
**Fix:**
```ts
import { etiquetaFuente } from "@/lib/panel-evidencia";
// …
etiquetaFuenteTile = etiquetaFuenteTile ?? etiquetaFuente(ev.fuente);
```

## Warnings

### WR-01: el remanente "y N más" no está atado a lo realmente mostrado

**File:** `app/components/panel-tile-sala.tsx:169-171` · `app/components/panel-tile-comisiones.tsx:156-159`
**Issue:** `restantes = totalPuntos - maxItems` asume que se pintaron exactamente `maxItems` ítems.
Cuando el total declarado (`tabla_total`/`puntos_total`, calculado con un `count(*)` independiente
en 0081) supera la longitud del array de ítems, se muestran menos de 4 y el remanente queda
subdeclarado. El invariante honesto es "total − mostrados".
**Fix:** `const restantes = totalPuntos - visibles.length;` (en sala, contar los puntos realmente
emitidos, no `maxItems`).

### WR-02: sala pinta encabezados de sesión con lista vacía cuando el presupuesto ya se agotó

**File:** `app/components/panel-tile-sala.tsx:173-207`
**Issue:** `vistos` se muta durante el render y el `map` sobre `bloques` sigue emitiendo el
`EncabezadoSesion` de cada sesión aunque todos sus puntos devuelvan `null`. El resultado visible es
"En tabla de sala de la Cámara del 3 ago 2026 · tabla semanal" seguido de un `<ul>` vacío — se lee
como "esa sesión no tiene puntos", que es falso. Además, mutar estado durante el render es frágil
ante re-render/Suspense.
**Fix:** aplanar y recortar ANTES del JSX (`const visibles = puntosAplanadosGlobal.slice(0, maxItems)`)
y renderizar sólo los bloques con al menos un punto visible.

### WR-03: `EncabezadoSesion` produce "Sesión  — Ordinaria" y descarta `numero` si `tipo` es null

**File:** `app/components/panel-tile-sala.tsx:80-87`
**Issue:** `item.tipo ? \`Sesión ${item.numero ?? ""} — ${item.tipo}\`.trim() : null` — con
`numero` null y `tipo` presente sale doble espacio interior (`.trim()` no toca el interior); con
`tipo` null y `numero` presente, el número desaparece del copy aunque la fuente lo informe.
**Fix:** construir el segmento por partes: `["Sesión", item.numero, item.tipo && \`— ${item.tipo}\`].filter(Boolean).join(" ")`,
omitiendo "Sesión" si no hay ni número ni tipo.

### WR-04: hechos con verbo que quedan sin complemento cuando la fecha o el grado son null

**File:** `app/components/panel-tile-urgencias.tsx:183-185` · `panel-tile-movimiento.tsx:124` · `panel-tile-ingresos.tsx:171,216-218` · `panel-tile-sala.tsx:116`
**Issue:** `fechaCivilCorta()` devuelve `null` ante fecha no parseable, y el JSX lo interpola igual:
salen literales colgados "Urgencia Suma fechada el ", "Trámite del ", "Ingresado el ",
"Archivo o retiro fechado el ". En el chip L5 el grado puede ser `""`
(`gradoUrgencia(...) ?? it.descripcion ?? ""`, `panel-evidencia.ts:298`) → "Urgencia  fechada el 6 jul 2026".
Un verbo sin hecho es exactamente lo que el régimen de fechas prohíbe.
**Fix:** calcular el string antes y omitir el detalle completo si falta la fecha o el grado:
```tsx
const dia = fechaCivilCorta(b.fecha);
detalle={dia && b.grado ? <>Urgencia {b.grado} fechada el {dia}</> : null}
```

### WR-05: `idiomaOMuere` lanza en carga de módulo → un stem mal escrito tumba el panel entero en runtime

**File:** `app/components/panel-tile-sala.tsx:26-39` · `panel-tile-comisiones.tsx:45-57`
**Issue:** El invariante es 100% estático (array literal del mismo repo), pero se verifica con un
`throw` en tiempo de import. El módulo lo importa `panel-actualidad.tsx`, así que el fallo
propaga a los 6 tiles y a `/` (500), no al tile afectado. Es fail-fragile: paga en producción un
error que pertenece al compilador. Además `IDIOMS_APROBADOS: string[]` está tipado como `string[]`,
lo que borra los literales y es la razón por la que hizo falta el chequeo en runtime.
**Fix:** mover el invariante al tipo y borrar los `throw`:
```ts
// idioms-panel.ts
export const IDIOMS_APROBADOS = ["Citado el", "vigente desde", …] as const;
export type Idiom = (typeof IDIOMS_APROBADOS)[number];
// tile
const STEM_FECHADA_EL: Idiom = "fechada el"; // stem inexistente = error de compilación
```

### WR-06: copy del panel que usa stems NO registrados en el single-source

**File:** `app/components/panel-tile-movimiento.tsx:124` · `panel-tile-ingresos.tsx:171,216` · `panel-tile-urgencias.tsx:183`
**Issue:** `idioms-panel.ts` declara (W-3) que el inventario incluye *todas* las variantes que el
copy emite, y sala/comisiones lo hacen cumplir con `idiomaOMuere`. Pero "Trámite del",
"Ingresado el" y el literal "Urgencia … fechada el" de urgencias se escriben inline, sin pasar por
`IDIOMS_APROBADOS`. El single-source queda a medias: tres tiles cumplen y tres no.
**Fix:** dar de alta "Trámite del" e "Ingresado el" en `IDIOMS_APROBADOS` y consumir los stems desde
el módulo en los tres tiles restantes (o desde el tipo `Idiom` de WR-05).

### WR-07: movimiento/urgencias/ingresos calculan el remanente sobre `items.length`, ignorando `evidencia.total`

**File:** `panel-tile-movimiento.tsx:81-82` · `panel-tile-urgencias.tsx:158-160` · `panel-tile-ingresos.tsx:134-135`
**Issue:** `parseEvidenciaProyectos` ya devuelve `total` (el `count(*)` de la señal) y estos tiles
lo descartan. Si el array de ítems se acotara alguna vez (o si un ítem sin boletín se filtra, como
hace `agruparPorBoletin`), el "N más" queda por debajo del universo real. Sala/comisiones usan el
total declarado; el criterio debería ser único.
**Fix:** usar `Math.max(total ?? 0, items.length) - mostrados.length` y documentar la fuente del total.

### WR-08: `PanelTileIngresos` sin filas produce dos listas vacías, sin estado honesto

**File:** `app/components/panel-tile-ingresos.tsx:158-176, 192-230`
**Issue:** El path de supresión está bien resuelto, pero si `ingresos`/`archivados` llegan como `[]`
(la señal no vino en la RPC, distinto de "vino suprimida"), se renderiza el `<h3>` seguido de un
`<ul>` vacío. Regla C exige "nunca lista vacía": el ciudadano lee ausencia sin causa.
**Fix:** cuando no hay ni causa ni ítems, emitir el vacío con causa declarada
("sin filas para esta ventana en las fuentes consultadas") en vez de un `<ul>` mudo.

### WR-09: `Fuente: {fuente ?? "Tramitación"}` fabrica una procedencia cuando no hay dato

**File:** `panel-tile-urgencias.tsx:203` · `panel-tile-movimiento.tsx:143` · `panel-tile-ingresos.tsx:233`
**Issue:** Si `evidencia.fuente.dataset` falta (`evidencia = '{}'`, fila suprimida), el footer
afirma igual "Fuente: Tramitación". Es una atribución no respaldada por dato — el mismo defecto que
CR-04 en versión fallback.
**Fix:** omitir la línea `Fuente:` completa cuando `fuente === null`; conservar sólo
"según fuente al {d}" si hay fecha.

### WR-10: `enlaceFuente` se emite en `href` sin validar el esquema (vector `javascript:`)

**File:** `app/components/panel-item-proyecto.tsx:76-85`
**Issue:** El valor viene del jsonb (`proyecto.enlace` / `citacion.enlace`), campo de origen
scrapeado. React sólo advierte ante `href="javascript:…"`; no lo bloquea. `rel="noopener noreferrer"`
está bien puesto, pero no cubre el esquema.
**Fix:**
```ts
function hrefExternoSeguro(u: string | null | undefined): string | null {
  if (!u) return null;
  try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:" ? u : null; }
  catch { return null; }
}
```

### WR-11: los links internos del panel usan `<a>` en vez de `next/link`

**File:** `panel-item-proyecto.tsx:52` · `panel-tile-votaciones.tsx:87` · `panel-tile-sala.tsx:209` · `panel-tile-comisiones.tsx:191`
**Issue:** Todo el resto del árbol (`citacion-card`, `search-result-card`, `tramitacion-stepper`)
usa `<Link>`. Con `<a>` cada navegación desde la portada es un full reload del App Router, sin
prefetch — regresión de comportamiento respecto de los call-sites existentes que este panel sustituye.
**Fix:** `import Link from "next/link"` para los hrefs internos (`hrefProyecto`/`hrefAgenda`);
mantener `<a target="_blank">` sólo para enlaces externos de fuente.

### WR-12: un fallo de lectura de `votacion` tumba el panel completo

**File:** `app/components/panel-actualidad.tsx:186` · `panel-tile-votaciones.tsx:129-131`
**Issue:** `PanelTileVotaciones` es un async component hermano, sin `<Suspense>` ni error boundary
propio. Su `throw` (#34, correcto en sí) sube al mismo árbol que los 5 tiles ya resueltos y borra
la portada entera por una tabla secundaria. Antes de 128 esa lectura no existía en el panel.
**Fix:** envolver el tile en su propio `<Suspense>` + `error.tsx`/boundary de segmento, o degradar
a un estado declarado ("no se pudo leer la fuente de votaciones") sin tumbar los demás tiles.

### WR-13: lógica muerta y contradictoria en la derivación de `semanaParaHref`

**File:** `app/components/panel-tile-sala.tsx:157-163`
**Issue:** El bloque condiciona la asignación a `tabla_total > 0` y acto seguido la reasigna
incondicionalmente con la MISMA expresión (`if (!semanaParaHref) semanaParaHref = semanaIsoDeFecha(item.fecha)`),
anulando el condicional. Además la semana sale del primer bloque con fecha, que puede ser el de la
otra cámara cuando se listan dos sesiones.
**Fix:** dejar una sola línea (`semanaParaHref ??= semanaIsoDeFecha(item.fecha)`) y documentar
explícitamente que la semana del "y N más" es la del primer bloque.

### WR-14: el tile L4 puede mostrar menos de 4 votaciones sin declararlo, y omite `total_pareo`

**File:** `app/components/panel-tile-votaciones.tsx:139-166`
**Issue:** (a) El filtro de fecha se aplica después del `limit`, así que la lista puede quedar en 1-3
ítems sin ninguna declaración de cobertura (relacionado con CR-01). (b) El detalle informa
si/no/abstención y omite `total_pareo`, que existe en la tabla — un conteo parcial presentado como
el conteo de la votación.
**Fix:** filtrar en la query (CR-01) y añadir el pareo al detalle, o declarar explícitamente que el
pareo no se muestra.

### WR-15: en el carril de hechos pasados el footer prefiere `consultado_al` sobre `fecha_max`

**File:** `panel-tile-urgencias.tsx:111` · `panel-tile-movimiento.tsx:67` · `panel-tile-ingresos.tsx:105`
**Issue:** D-05 asigna `fecha_max` a los hechos pasados y `consultado_al` a la agenda futura. Estos
tres tiles (urgencias/velocity/archivados = pasado) hacen `ev.consultado_al ?? f.fecha_max`, así que
el footer dirá "según fuente al 30 jul 2026" cuando el último hecho de la fuente es del 22 jul.
No es falso ("según fuente al" es la fecha de consulta), pero se aparta de la regla escrita y
mezcla dos semánticas en el mismo pie de tile.
**Fix:** invertir la precedencia en los tiles de hechos pasados (`f.fecha_max ?? ev.consultado_al`) o
enmendar D-05 explícitamente en el SUMMARY.

### WR-16: un ítem `en_corpus:false` CON boletín muestra el boletín pelado y descarta `materia`

**File:** `app/components/panel-item-proyecto.tsx:47, 69-75`
**Issue:** `etiqueta = titulo ?? boletin` se evalúa también en la rama no-corpus. Un punto de
citación con boletín que no está en el corpus (el caso exacto del guard 404) se renderiza como
"18258-07" sin ningún texto descriptivo, porque `textoAlterno` (la `materia`) sólo se usa cuando
`etiqueta` es null. El guard de link funciona; el contenido informativo se pierde.
**Fix:** en la rama no-corpus, preferir `materia` como etiqueta y usar el boletín como
complemento: `{extractoIdea(textoAlterno ?? titulo ?? boletin, 120)}`.

### WR-17: `gradoUrgencia` devuelve el literal CON el paréntesis cuando el grado es desconocido

**File:** `app/lib/panel-evidencia.ts:274-282`
**Issue:** El `replace` de paréntesis sólo se aplica a la copia usada para hacer match; el fallback
devuelve `descripcion` completo. Un literal no reconocido (p.ej. `"URGENCIA X (04.08.2026)"`)
llegaría al chip incluyendo la fecha entre paréntesis, cuya semántica R7 declara NO verificada y
prohíbe afirmar.
**Fix:** `return sinParentesis || descripcion;` — el fallback honesto es el literal sin el
paréntesis de semántica desconocida.

---

## Fixes Applied

**Fecha:** 2026-07-30 · **Aplicados:** 17/17 (4 Critical + 13 Warnings) · **Omitidos:** 0

### Verificación

| Gate | Resultado |
|------|-----------|
| Suite de la fase (10 archivos) | 168/168 verde |
| `pnpm test` | **1776** passed / 118 archivos (umbral >1774) |
| `pnpm guards` | **11 passed** / 347 tests |
| `tsc --noEmit` | limpio |
| Volcado DOM + 5 greps | **NO ejecutado** (requiere deploy; ver Pendiente) |

### Commits

| Commit | Findings |
|--------|----------|
| `4556e22` | WR-05, WR-06 — `idioms-panel.ts` |
| `58a2725` | CR-01, CR-02, WR-11, WR-12, WR-14 — votaciones |
| `9f67d74` | CR-03, CR-04, WR-01, WR-04, WR-05, WR-11 — comisiones |
| `decb1d2` | CR-04, WR-01, WR-02, WR-03, WR-04, WR-05, WR-11, WR-13 — sala |
| `71e0063` | WR-10, WR-11, WR-16 — `panel-item-proyecto.tsx` |
| `6a1bbba` | WR-17 — `panel-evidencia.ts` |
| `2a515d0` | WR-04, WR-06, WR-07, WR-08, WR-09, WR-15 — urgencias/movimiento/ingresos |

### Notas de aplicación (donde el fix ejecutado difiere del sugerido)

- **WR-07 aplicado SOLO a movimiento.** El fix sugerido
  (`Math.max(total, items.length) - mostrados.length`) es correcto en `velocity`,
  donde la unidad del listado es el ÍTEM. En **urgencias** y **archivados** la
  unidad es el **BOLETÍN** (`agruparPorBoletin`) mientras que `evidencia.total`
  cuenta **EVENTOS**: aplicarlo ahí produciría un "N más" sobre un universo de
  eventos junto a ítems que son proyectos — exactamente el defecto D-01/T-128-11
  que esos tiles existen para matar ("95 urgencias" cuando son 71 boletines
  distintos). El motivo queda documentado en el código, no solo aquí.
- **WR-12 resuelto por degradación, no por Suspense.** El tile devuelve un estado
  DECLARADO ("No se pudo leer la fuente de votaciones") en vez de `throw`. Un
  error de lectura sigue sin confundirse con ausencia de hecho (regla D), pero ya
  no borra los otros 5 tiles.
- **WR-16 acotado al caso reportado.** La materia solo gana la etiqueta cuando NO
  hay `titulo`; con título presente el copy no cambia.
- **CR-03 amplía el fix sugerido:** además del tercer origen verbatim, las filas
  con `cobertura_camara === null` se declaran como segmento propio
  ("N sin cámara informada"), que el REVIEW pedía entre paréntesis.

### Tres tests actualizados (expectativas, NO relajación de asserts)

Los tres fallaban **porque el fix corrigió el defecto que el test congelaba**:

1. `panel-tile-sala.test.tsx` — `"y 21 más →"` → `"y 24 más →"`. La fixture declara
   `tabla_total: 25` y trae **1** punto: el test daba por pintados 4 ítems
   inexistentes. Es literalmente el escenario que WR-01 describe.
2. `panel-tile-urgencias.test.tsx` — `"según fuente al 21 jul 2026"` →
   `"20 jul 2026"` (`fecha_max`, no `consultado_al`). Es WR-15.
3. `panel-tile-votaciones.test.tsx` — el detalle ahora incluye `", 0 pareos"` (WR-14).

Ningún assert fue debilitado ni borrado; los tres siguen siendo igualdades exactas.

### Pendiente para el operador

- **Volcado DOM + los 5 greps** (`datos_al==0` apareado, `materia==0`, `captura==0`,
  `links>=1`) **no se re-ejecutaron**: requieren deploy/render real, fuera del
  alcance de esta pasada. Los invariantes están cubiertos por el guard
  anti-insinuación (57 tests) y por la suite de la fase, pero el control positivo
  apareado sobre DOM real sigue debiendo correrse antes del cierre de 128.

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
