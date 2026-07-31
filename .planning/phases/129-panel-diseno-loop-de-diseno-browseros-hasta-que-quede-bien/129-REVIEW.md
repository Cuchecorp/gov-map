---
phase: 129-panel-diseno-loop-de-diseno-browseros-hasta-que-quede-bien
reviewed: 2026-07-30T21:20:00Z
depth: deep
diff_range: fba1298..c73bc4e
files_reviewed: 17
files_reviewed_list:
  - app/lib/plural.ts
  - app/lib/plural.test.ts
  - app/app/comparar/page.tsx
  - app/app/comparar/page.test.tsx
  - app/components/comparar-selector.tsx
  - app/components/comparar-selector.test.tsx
  - app/components/panel-actualidad.test.tsx
  - app/components/panel-tile-sala.tsx
  - app/components/panel-tile-movimiento.tsx
  - app/components/panel-tile-movimiento.test.tsx
  - app/components/panel-tile-comisiones.tsx
  - app/components/panel-tile-comisiones.test.tsx
  - app/components/panel-tile-urgencias.tsx
  - app/components/panel-tile-urgencias.test.tsx
  - app/components/panel-tile-votaciones.tsx
  - app/components/panel-tile-votaciones.test.tsx
  - app/components/panel-tile-ingresos.test.tsx
findings:
  critical: 2
  warning: 10
  info: 3
  total: 15
status: issues_found
---

# Phase 129: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** deep (lectura por archivo + trazado cross-módulo + **mutation testing** sobre los fixes)
**Files Reviewed:** 17 (`git diff fba1298..HEAD -- app/`)
**Status:** issues_found

## Summary

Los fixes funcionales de la fase son, en su mayoría, **correctos y bien acotados**. Verifiqué y
confirmo positivamente lo siguiente:

- **Contrato LOCKED #34 INTACTO.** El único cambio en `app/app/comparar/page.tsx` es el formato de
  fecha (3 sitios) + un `import`. Los `throw` de `coincidencia_votos_par` y de los lectores de ejes
  no se tocaron (`git diff` no muestra una sola línea de manejo de errores).
- **Archivos PROHIBIDOS INTACTOS.** `git diff --stat fba1298..HEAD -- supabase/ .env app/next.config.ts
  app/public/_headers app/middleware.ts app/wrangler.jsonc app/lib/idioms-panel.ts app/components/bento/`
  devuelve **vacío**. Ni migraciones, ni CSP, ni `idioms-panel.ts`, ni el sistema bento.
- **`plural.ts` es correcto y general.** `n === 1 ? singular : plural` — n=0 → plural (correcto en
  es-CL), n negativo/fraccionario → plural, sin heurística morfológica, tilde preservada. Los 4
  moldes objetivo (`citación`, `proyecto`, `abstención`, `pareo`) lo consumen.
- **El fix de spans es un verde REAL.** Mutación aplicada (`panel-tile-sala.tsx` span 6→4) ⇒ el test
  `C-01` **falla**. El test detecta lo que dice detectar.
- **La suma de la grilla cierra en producción.** hero(4)+accent(2) | sala(6) | comisiones(4)+urgencias(2)
  | movimiento(6) | votaciones(4)+ingresos(2) | entry(2)×3 = 6 filas exactas, cero huecos interiores.
  A <md todos los spans son `md:`-prefijados ⇒ 390px colapsa a 1 columna sin cambio.
- **Cero secretos en `app/`.** Ningún archivo de código nuevo/modificado contiene project-ref, host,
  pooler ni credenciales.

Dicho eso, la ola de tests **contiene falsos verdes demostrados** y el fix de fechas dejó un sitio
sin protección de regresión en la ruta que en PROD está **encendida** (VSIM ON). Además, la fase
añadió un test que **certifica como correcto** un comportamiento que viola la invariante de
honestidad H del propio panel.

---

## Critical Issues

### CR-01: El fix C-03 del eje VSIM sobrevive a la mutación — CERO tests lo cubren, y el test que dice cubrirlo es vacuo en esa ruta

**File:** `app/app/comparar/page.tsx:544-546` · `app/app/comparar/page.test.tsx:539-546`

**Issue (demostrado por mutación, no por lectura):** revertí el fix a su forma pre-fase

```ts
const fechaCaptura = fila?.fecha_captura_max
  ? String(fila.fecha_captura_max).slice(0, 10)   // ← ISO otra vez
  : null;
```

y corrí `npx vitest run app/comparar/page.test.tsx` ⇒ **34/34 tests PASAN**. El fix no tiene una
sola aserción que lo respalde.

Peor: el test nuevo `C-03: CERO fechas ISO en el DOM de los ejes` (`page.test.tsx:539`) **afirma una
cobertura que no tiene**. `renderEjes` corre sin `vi.stubEnv("VSIM_PUBLIC_ENABLED", ...)`, y
`CompararEjes` construye `ejeSimilitud` sólo dentro de `if (vsimPublicEnabled(process.env))`
(`page.tsx:518`). Con el flag OFF ese eje **no existe en el DOM**, así que el
`expect(html).not.toMatch(/20\d{2}-\d{2}-\d{2}/)` no puede ver el único sitio donde el ISO seguía
siendo posible. Y según MEMORY, **en PROD el flag VSIM está ON** — es decir, la ruta blindada por el
test es la que no se sirve, y la ruta servida es la no cubierta.

Los 4 tests VSIM-ON existentes (`page.test.tsx:635-675`) sólo asertan `toContain("según fuente al")`
— pasarían igual con el ISO pegado detrás.

Este es exactamente el patrón "cero vacuo" que el propio proyecto tiene registrado como gotcha.

**Fix:**
```ts
// app/app/comparar/page.test.tsx — dentro del describe (12) VSIM
it("C-03: con el flag ON, la provenance del 5º eje va en fecha civil, jamás ISO", async () => {
  vi.stubEnv("VSIM_PUBLIC_ENABLED", "true");
  setRpcConVsim({ n_coinciden: 3, m_compartidas: 4, fecha_captura_max: "2026-07-24" });
  const html = await renderEjes("D1001", "D1002");
  // Control positivo apareado: el eje SÍ se montó y SÍ trae la provenance.
  expect(html).toContain("Similitud de votación");
  expect(html).toContain("24 jul 2026");
  // …y el cero de abajo es fuerte.
  expect(html).not.toMatch(/20\d{2}-\d{2}-\d{2}/);
});
```
Y renombrar el test de `page.test.tsx:539` a algo veraz (`"…en los 4 ejes no gated"`) o stubear el
flag ON dentro de él, para que el nombre y el alcance coincidan.

---

### CR-02: La subsección "Nuevos ingresos" trunca a 4 SIN declarar el remanente — y el test nuevo de la fase lo certifica como correcto

**File:** `app/components/panel-tile-ingresos.tsx:175` · `app/components/panel-tile-ingresos.test.tsx:213-233`

**Issue:** `seccionIngresos.items.slice(0, maxItems)` corta la lista y **no emite ningún "N más"**:
no hay `restanteIngresos` en el archivo (compárese con `restanteArchivados`, líneas 145 y 254-257).
La RPC `actualidad_senales_panel` emite los ingresos de la ventana 7d **sin cap** (`0081`, §(2)),
así que en producción el ciudadano puede ver 4 ítems de N y **nada en el DOM le dice que hay más**.

Esto contradice frontalmente la invariante **H** declarada en el propio orquestador
(`panel-actualidad.tsx:63-64`):

> "PRESUPUESTO (O-7): 4 ítems por tile + **remanente declarado** respaldado por el total real del
> jsonb (`*_total`), nunca `items.length` a secas."

Lo grave para esta review: el test añadido en 129-04 **no reporta el hueco, lo fija**:

```ts
it("129-04 densidad (nuevos ingresos): … el tile NO declara remanente en esta subsección", () => {
  …
  expect(container.textContent).not.toMatch(/\d+ más/);   // ← certifica la omisión
});
```

El comentario lo llama "Control HONESTO del hueco … fija el comportamiento REAL para que la tabla de
densidad no lo invente". Documentar un defecto no lo convierte en contrato: ahora cualquiera que
arregle la omisión rompe un test verde y creerá que introdujo una regresión.

**Fix:** emitir el remanente en la subsección de ingresos, con el mismo idiom que archivados, y
convertir el test en su control positivo:

```tsx
// panel-tile-ingresos.tsx
const mostradosIngresos = seccionIngresos.items.slice(0, maxItems);
const restanteIngresos = seccionIngresos.items.length - mostradosIngresos.length;
…
    </ul>
    {restanteIngresos > 0 && (
      <p className="mt-3 text-[13px] text-muted-foreground">{restanteIngresos} más</p>
    )}
```
```ts
// panel-tile-ingresos.test.tsx:213 — invertir la aserción
expect(container.textContent).toContain("2 más");   // 6 − 4
```
Si por decisión editorial el remanente NO debe declararse aquí, entonces la excepción tiene que
quedar arbitrada explícitamente contra la invariante H en `panel-actualidad.tsx` (y el test debe
citar esa arbitración), no vivir sólo como comentario en un test.

---

## Warnings

### WR-01: El fix de fecha del eje VSIM puede **borrar** la provenance entera; los otros dos sitios sí tienen fallback

**File:** `app/app/comparar/page.tsx:544-546`
**Issue:** `fechaCivilCorta` devuelve `string | null`. Los otros dos sitios del mismo commit usan
`?? valorOriginal` (`page.tsx:60`, `page.tsx:340`); éste no. Si el valor no es parseable,
`fechaCaptura` pasa a `null` y `SimilitudVotacionComparar` lo renderiza con
`{fechaCaptura ? (…) : null}` (`similitud-votacion-comparar.tsx:132`) ⇒ **la línea "según fuente al …"
desaparece por completo**. Antes de la fase, `slice(0,10)` siempre devolvía un string y la
provenance siempre salía. Un dato mostrado sin fuente trazable es exactamente lo que el proyecto
prohíbe.
**Fix:**
```ts
const fechaCapturaIso = fila?.fecha_captura_max ? String(fila.fecha_captura_max).slice(0, 10) : null;
const fechaCaptura = fechaCapturaIso ? (fechaCivilCorta(fechaCapturaIso) ?? fechaCapturaIso) : null;
```

### WR-02: `fechaCivilCorta` aplicado a `fecha_captura_max`, que es un timestamp REAL — misuso del helper date-only

**File:** `app/app/comparar/page.tsx:545`
**Issue:** `lib/dia-calendario.ts` se documenta a sí mismo como "el ÚNICO punto que codifica" la
distinción date-only vs timestamp real, y dice explícitamente: *"La regla LOCKED 'renderizar en tz
America/Santiago' aplica a TIMESTAMPS REALES CON HORA (lobby, tramitación, **fecha_captura**)"*.
`fecha_captura_max` es precisamente uno de esos. El código toma su parte fecha **UTC** y luego la
pasa por el helper date-only. Una captura a `2026-01-01T02:00:00Z` es el **31-dic-2025 21:00** en
Chile y se rinde como "01 ene 2026". El día equivocado ya se venía mostrando (el `.slice(0,10)` es
pre-fase), pero la fase lo **cementó** enrutándolo por el helper que documenta lo contrario, y sin
dejar constancia del trade-off.
**Fix:** o bien formatear con el helper de timestamps reales (`fechaCorta` con tz explícita), o dejar
un comentario en `page.tsx:544` que declare que se prefiere el día UTC deliberadamente y por qué —
hoy el comentario dice "mismo DÍA que antes", que es cierto pero elude la pregunta.

### WR-03: El skeleton del Suspense quedó desalineado con el nuevo span del primer tile

**File:** `app/app/page.tsx:137` (`<Suspense fallback={<BloqueSkeleton span={4} />}>`)
**Issue:** C-01 subió `panel-tile-sala` de span 4 a 6, pero el fallback que ocupa su lugar mientras
la RPC resuelve sigue en span 4. Durante el streaming la fila es `skeleton(4) + entry(2)` y al
resolver salta a `sala(6) …`, con **reflow de toda la mitad inferior de la portada** (CLS). Además,
con el fallback montado los 3 entry tiles quedan `4+2 | 2+2` ⇒ remanente de 2 al final. El fix C-01
razonó sobre el panel resuelto y no sobre el estado de carga.
**Fix:** `<Suspense fallback={<BloqueSkeleton span={6} />}>` (o un fallback compuesto que replique
`6 | 4+2 | 6 | 4+2`).

### WR-04: El test de spans valida una RÉPLICA del orquestador, no el orquestador ni la grilla real

**File:** `app/components/panel-actualidad.test.tsx:334-368` (helper `construirPanel`, líneas 53-107)
**Issue:** tres desacoples que dejan el invariante sin protección real:
1. `construirPanel` **reimplementa** el ruteo y el orden de `PanelActualidad`. Si alguien reordena
   los tiles en `panel-actualidad.tsx:181-188`, el test sigue verde sobre la copia.
2. Monta `PanelTileVotacionesView` en vez del wrapper `PanelTileVotaciones`. Hoy ambos comparten
   `span={4}` porque el `BentoTile` vive en la vista, pero nada lo garantiza.
3. Sólo cubre los 6 tiles del panel. El invariante que de verdad importa —cero huecos interiores en
   **la grilla completa**— depende de `hero(4)+accent(2)` en `app/page.tsx:87,108` y de los 3 entry
   tiles. Cambiar el hero a span 6 reintroduce el defecto C-01 con este test en verde.
**Fix:** añadir en `app/app/page.test.tsx` un test que renderice `<Home />` y aplique la misma
aritmética de cierre de filas sobre **todos** los `md:col-span-N` del DOM (contando el fallback del
Suspense), y anotar en `construirPanel` que es una réplica que debe seguir a `panel-actualidad.tsx`.

### WR-05: Aserción vacua en el test de densidad de archivados

**File:** `app/components/panel-tile-ingresos.test.tsx:205-210`
**Issue:**
```ts
// Ni el largo del array ni maxItems se cuelan como N.
expect(container.textContent).not.toContain("7 más");
```
La fixture `filaEvidencia` (línea 42) setea `total: items.length`, y `restanteArchivados` se computa
como `listaArchivados.length − mostrados.length` = 7 − 4 = **3**, que es *exactamente* el número
derivado del largo del array. El test no puede distinguir la fuente del N; el comentario afirma lo
contrario. Compárese con el test hermano de movimiento (`panel-tile-movimiento.test.tsx:132`), que
sí fuerza `total = 9 ≠ items.length = 6` y por eso es un verde real.
**Fix:** o forzar la divergencia (`(fila.evidencia as {total?:number}).total = 12` y esperar `8 más`
si se adopta el `total` del jsonb), o borrar el comentario y las dos aserciones negativas, que hoy
prometen una discriminación que la fixture no permite.

### WR-06: `restanteArchivados` deriva del largo del array y descarta el `total` del jsonb

**File:** `app/components/panel-tile-ingresos.tsx:145` (y `seccionSubtitulo`, línea 118, que no
devuelve `ev.total`)
**Issue:** `parseEvidenciaProyectos` expone `total` (`lib/panel-evidencia.ts:120`), pero
`seccionSubtitulo` lo tira. Hoy no miente porque la RPC no capea `items` para `archivados` — pero
la invariante H ordena respaldar el remanente con el total real, y el día que se añada un `limit` al
`jsonb_agg` (que es lo esperable cuando la ventana crezca) el "N más" empezará a **subdeclarar en
silencio**, sin ningún test que lo cace. Nota: el `total` de `archivados` cuenta **eventos** y la
lista agrupa por **boletín**, así que el fix no es un swap directo.
**Fix:** propagar `total` desde `seccionSubtitulo` y, o bien usarlo con `Math.max(total, lista.length)`
como hace `panel-tile-movimiento.tsx:92-93`, o documentar en el archivo por qué archivados es la
excepción (total=eventos ≠ unidad de lista=proyectos).

### WR-07: El helper `plural` no se adoptó en dos sitios con la misma lógica inline

**File:** `app/components/panel-tile-ingresos.tsx:222-225` · `app/components/agenda-filtros.tsx:350`
**Issue:** la fase creó `plural()` para matar la concordancia ad-hoc, pero dejó vivos:
```tsx
{totalEventosArchivados === 1 ? "evento" : "eventos"} de {totalProyectosArchivados}{" "}
{totalProyectosArchivados === 1 ? "proyecto" : "proyectos"}
```
y `` `${rows.length} ${rows.length === 1 ? "citación" : "citaciones"}` ``. Son exactamente los mismos
sustantivos (`proyecto`, `citación`) que el helper ya cubre en los tiles hermanos. Queda un patrón
duplicado y dos convenciones conviviendo en el mismo panel.
**Fix:** `plural(totalEventosArchivados, "evento", "eventos")`, `plural(totalProyectosArchivados,
"proyecto", "proyectos")`, `plural(rows.length, "citación", "citaciones")`.

### WR-08: El `toEqual` exacto vuelve código muerto al bucle de "cierre de filas" que le sigue

**File:** `app/components/panel-actualidad.test.tsx:352-367`
**Issue:** `expect(spans).toEqual([6, 4, 2, 6, 4, 2])` ya fija la secuencia completa; el bucle
posterior (con `throw` dentro del `it`, idiom inusual en esta suite, que usa `expect`) no puede
fallar nunca sin que el `toEqual` haya fallado antes. Es lógica de verificación inalcanzable
disfrazada de invariante general — y, al mismo tiempo, el `toEqual` hace el test frágil ante
cualquier reordenamiento legítimo que **sí** cierre filas.
**Fix:** quedarse con el bucle (que es el invariante real) y bajar el `toEqual` a un
`expect(spans).toHaveLength(6)`; o quedarse con el `toEqual` y borrar el bucle. Si se conserva el
bucle, sustituir el `throw` por `expect(acumulado + s, \`hueco interior en ${spans.join("·")}\`)
.toBeLessThanOrEqual(6)`.

### WR-09: El project-ref de Supabase que B26 redactó sigue vivo dentro de la propia carpeta de la Phase 129

**File:** `.planning/phases/129-…/129-03-PLAN.md:233, 235, 245, 250, 258, 287`
**Issue:** el commit `6bf22d4` redactó project-ref, host y pooler en `07-01-SUMMARY.md`, pero el plan
que ordenó esa redacción **transcribe los tres literales en claro** seis veces, en la misma carpeta
de fase. Es el incidente exacto que el brief describe. (Contexto atenuante verificado: el ref aparece
en 48 archivos `.planning/` preexistentes, y el propio `129-03-SUMMARY.md` publica el alcance
restante como 49 — la exposición no es net-new. Pero la remediación queda auto-anulada a un
directorio de distancia, y el criterio de cierre del plan sólo medía un archivo.)
**Fix:** aplicar la misma redacción (`<PROJECT_REF_REDACTADO>` / `<SUPABASE_HOST_REDACTADO>` /
`<POOLER_HOST_REDACTADO>`) a `129-03-PLAN.md`, y cambiar el criterio de cierre de B26 de "0 en
`07-01-SUMMARY.md`" a "0 en `.planning/phases/129-*/`". Rotación no aplica: un project-ref no es una
credencial.

### WR-10: C-02 (`comparar-selector.tsx`) cambia un token de color LOCKED §Color con justificación sólo en comentario

**File:** `app/components/comparar-selector.tsx:22-31, 86-93`
**Issue:** el archivo declaraba como CANDADO DE RÉGIMEN "petróleo SOLO en focus-visible", y la fase
**reescribió el propio candado** para admitir el CTA. El razonamiento (conteo `bg-accent-product` en
17 archivos vs `bg-foreground` en 2) es defendible, pero la reinterpretación de una regla marcada
LOCKED queda registrada en un comentario del componente y en un SUMMARY, no en la spec (§Color /
101-UI-SPEC) que la fijó. El siguiente que lea la spec verá una contradicción sin árbitro. Además,
el cambio queda fuera del alcance de archivos declarado para la fase.
**Fix:** anotar la excepción en la spec de color (o abrir el ADR correspondiente) citando
`search-box.tsx:129-130` como precedente del rol "CTA primario"; el comentario del componente debe
apuntar a esa fuente, no ser la fuente.

---

## Info

### IN-01: Parámetro `primero: boolean` muerto en el molde de cobertura

**File:** `app/components/panel-tile-comisiones.tsx:33-46`
**Issue:** la firma es `(n: number, primero: boolean) => string`, se invoca con `i === 0`
(línea 140), y **ninguno de los dos moldes lo usa**. Ruido que sugiere una variación de copy que no
existe.
**Fix:** eliminar el parámetro de la firma y del call-site, o usarlo.

### IN-02: `plural()` con `n` no numérico no está acotado por tipos en el call-site de votaciones

**File:** `app/components/panel-tile-votaciones.tsx:67-70`
**Issue:** `VotacionRow.total_abstencion` está tipado `number` (`lib/types.ts:71`) pero la columna es
nullable en las variantes de la misma tabla (`lib/types.ts:341`). Con un `null` real desde PostgREST,
la línea rinde `"null abstenciones"`. Defecto preexistente que el fix no empeora (`plural(null,…)` →
forma plural, correcto), pero el molde sigue sin guarda.
**Fix:** `const abst = item.abstencion ?? null;` y omitir el segmento cuando sea `null`, en línea con
el criterio WR-04 del resto del panel ("cero verbo sin complemento").

### IN-03: `String(x).slice(0, 10)` redundante antes de `fechaCivilCorta`

**File:** `app/app/comparar/page.tsx:545`
**Issue:** `fechaCivilCorta` ya hace `toISOString().slice(0,10)` internamente vía
`diaCalendarioCitacion`. El slice externo no cambia el resultado y oscurece la intención.
**Fix:** decidir uno de los dos y comentar por qué (ver WR-02, donde el slice externo es justamente
el que fija el día en UTC).

---

## Verificaciones NEGATIVAS explícitas (nada que reportar)

- **Bugs en `plural.ts`:** ninguno. n=0, n negativo, n fraccionario y la preservación de tildes están
  cubiertos por `plural.test.ts` y el comportamiento es el correcto en es-CL.
- **Ruptura de breakpoints por el cambio de spans:** ninguna. Todos los spans son `md:`-prefijados
  (`bento-tile.tsx:38-42`), `app/page.test.tsx:268` ya guarda contra `col-span-N` sin prefijo, y a
  390px la grilla es `grid-cols-1`. La suma cierra en `md` y no hay variantes `lg`.
- **Reimplementación manual de formato de fecha en `/comparar`:** ninguna. Los 3 sitios pasan por
  `fechaCivilCorta` del helper central (las objeciones son WR-01/WR-02, no reimplementación).
- **Conversión de tz sobre un date-only:** ninguna introducida. `fechaConsultaHoy` convierte tz sobre
  `new Date()`, que es un instante real (correcto); `fechaCivilCorta` no vuelve a convertir.
- **Secretos en código:** cero en los 17 archivos de `app/` revisados.
- **Violaciones del contrato #34 y de la invariante anti-agregación de votaciones:** ninguna. El
  manejo de errores de `/comparar` no fue tocado; `panel-tile-votaciones.tsx` mantiene una línea por
  votación.
- **Suite:** 114/114 verdes en las 9 rutas de la fase (`vitest run`).

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (con mutation testing sobre `panel-tile-sala.tsx` y `app/comparar/page.tsx`)_
