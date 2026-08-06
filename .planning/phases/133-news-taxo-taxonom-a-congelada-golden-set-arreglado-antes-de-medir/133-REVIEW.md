---
phase: 133-news-taxo-taxonomia-congelada-golden-set
reviewed: 2026-08-06T00:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - packages/news/src/prefiltro-lexico.ts
  - packages/news/src/prefiltro-lexico.test.ts
  - packages/news/src/eval/taxonomia.ts
  - packages/news/src/eval/taxonomia.test.ts
  - packages/news/src/eval/thresholds.ts
  - packages/news/src/eval/canonicalizar-json.ts
  - packages/news/src/eval/canonicalizar-cli.ts
  - packages/news/src/eval/congelado.test.ts
  - packages/news/src/eval/CONGELADO.md
  - packages/news/src/eval/entrada-llm.ts
  - packages/news/src/eval/entrada-llm.test.ts
  - packages/news/src/eval/caso-golden.ts
  - packages/news/src/eval/caso-golden.test.ts
  - packages/news/src/eval/taxonomia-guard.test.ts
  - packages/news/src/eval/taxonomia-superficie-guard.test.ts
  - packages/news/src/eval/index.ts
  - app/lib/terminos-insinuacion.ts
  - app/lib/anti-insinuacion-guard.test.ts
  - .gitattributes
  - .github/workflows/ci.yml
  - package.json
findings:
  critical: 0
  blocker: 0
  warning: 8
  info: 5
  total: 13
status: issues_found
---

# Phase 133-a: Code Review Report

**Reviewed:** 2026-08-06
**Depth:** deep (cross-file: `packages/news` ↔ `app/`, ejecución de suites y sondas propias)
**Status:** issues_found — **0 CRITICAL**, 3 HIGH, 5 MEDIUM, 5 LOW

## Summary

El código de 133-a es de calidad alta y poco común: los guards tienen control positivo
apareado, pisos anti-cero-vacuo y declaraciones de alcance honestas; la congelación por
sha256 compara **bytes** (no objetos parseados) y el `.gitattributes` está verificado
(`git check-attr` → `text: set`, `eol: lf` sobre los dos JSON congelados); los dos skips
silenciosos de `anti-insinuacion-guard.test.ts` están efectivamente cerrados con par
positivo/negativo aislado en una sola variable. Suite `@obs/news`: **252/252 verde**
(19 archivos), corrida por mí.

**El ítem #1 (el bug de `.replace(/\S*$/, "")`) se confirma real y el fix se confirma
correcto.** Reproduje el bug y el fix con sondas propias (ver H-01 abajo). No introduce
un modo de fallo nuevo; los bordes (vacío, solo-espacios, exactamente-en-el-límite) se
comportan bien. **Medí además el impacto que el SUMMARY no midió: 0 flips de veredicto
sobre los 85 ítems de los 5 fixtures RSS reales.** Ese número debía estar en el SUMMARY y
no está.

Los hallazgos HIGH no son del fix: son (a) un esquema zod que acepta casos golden
internamente contradictorios, (b) un canonicalizador que pierde el determinismo en
silencio ante entradas que no son objetos-literales, y (c) una pérdida total de
descripción en `truncarDescripcion` para un caso de entrada plausible, con consecuencia
recall-first permanente.

---

## Warnings

### WR-01 (HIGH): `CasoGoldenSchema` acepta casos golden internamente contradictorios

**File:** `packages/news/src/eval/caso-golden.ts:61-88`

**Issue:** El esquema no tiene ni un `.refine`/`.superRefine`. Validan hoy, sin error:

- `acuerdo: true` con `etiqueta_a: "ambiguo"` y `etiqueta_b: "no_legislativa"` (desacuerdo
  declarado como acuerdo).
- `acuerdo: true` con `resuelto_por: "no_arbitrado"` (o `"operador"`).
- `etiqueta: "ley_vigente"` cuando ni `etiqueta_a`, ni `etiqueta_b`, ni `etiqueta_humana`
  la contienen — la etiqueta de verdad-terreno puede no venir de ninguna revisión.
- `en_calibracion_humana: true` con `etiqueta_humana: null` (calibración sin etiqueta).
- `prefiltro.paso: false` con `prefiltro.terminos: ["senado"]` (descartado, pero con
  términos que matchearon).

Este esquema es la **única** compuerta del golden set de 133-b, y el golden set es la vara
que decide T3/T4/T5/T9 (vetos de producción). Filas incoherentes no rompen nada
ruidosamente: corrompen la métrica en silencio, que es exactamente el modo de fallo que la
fase existe para prevenir.

**Fix:**
```ts
export const CasoGoldenSchema = z.object({ /* ... */ }).strict().superRefine((c, ctx) => {
  const { etiqueta_a, etiqueta_b, acuerdo, resuelto_por, en_calibracion_humana, etiqueta_humana } = c.revision;
  if (acuerdo !== (etiqueta_a === etiqueta_b))
    ctx.addIssue({ code: "custom", message: "acuerdo debe ser (etiqueta_a === etiqueta_b)" });
  if (acuerdo && resuelto_por !== "acuerdo")
    ctx.addIssue({ code: "custom", message: "acuerdo=true exige resuelto_por='acuerdo'" });
  if (!acuerdo && resuelto_por === "acuerdo")
    ctx.addIssue({ code: "custom", message: "desacuerdo no puede resolverse por 'acuerdo'" });
  if (en_calibracion_humana && etiqueta_humana === null)
    ctx.addIssue({ code: "custom", message: "en_calibracion_humana exige etiqueta_humana" });
  const candidatas = [etiqueta_a, etiqueta_b, etiqueta_humana].filter(Boolean);
  if (!candidatas.includes(c.etiqueta))
    ctx.addIssue({ code: "custom", message: "etiqueta debe provenir de la revisión" });
});
```
Cada regla con su test de mutación apareado.

---

### WR-02 (HIGH): `canonicalizar()` pierde el determinismo en SILENCIO ante objetos no-literales

**File:** `packages/news/src/eval/canonicalizar-json.ts:12-37`

**Issue:** `esObjetoPlano` exige `Object.getPrototypeOf(valor) === Object.prototype`.
Cualquier otro objeto cae a la rama "primitivo" (línea 36) y se devuelve **intacto** — y
luego `JSON.stringify` lo serializa **sin ordenar claves**. Verificado ejecutando el módulo
real:

| entrada | salida de `canonicalizar` |
|---|---|
| `Object.create(null)` con `b`,`a` | `{"b": 1, "a": 2}` ← **claves NO ordenadas** |
| `{x:[1, undefined, 3]}` | `{"x":[1, null, 3]}` ← `undefined` → `null` en silencio |
| `{d:new Date(0), m:new Map(...)}` | `{"d":"1970-...Z","m":{}}` ← Map se serializa como `{}` |

El JSDoc (líneas 40-43) promete "claves ordenadas recursivamente" sin condición. Hoy las
entradas son literales de `taxonomia.ts`/`thresholds.ts` y el hash es correcto, pero la
firma es `(valor: unknown)` y la función está exportada como canonicalizador general. El
día que `golden-set.json` (133-b) o cualquier artefacto futuro llegue con un `Map`, un
`Object.create(null)`, o de otro realm, se congelará un hash de contenido silenciosamente
degradado. Un canonicalizador que congela vidas de años debe **fallar ruidosamente**, no
degradar.

**Fix:** invertir el default — todo lo que no sea primitivo JSON, array u objeto-literal
lanza:
```ts
function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (esObjetoPlano(valor)) { /* ...igual... */ }
  if (valor === null) return null;
  const t = typeof valor;
  if (t === "string" || t === "number" || t === "boolean") return valor;
  throw new Error(`canonicalizar: valor no canonicalizable (${t}/${Object.prototype.toString.call(valor)})`);
}
```
Con tests de mutación para `Object.create(null)`, `Map`, `Date` y `undefined` en array.

---

### WR-03 (HIGH): `truncarDescripcion()` devuelve `""` (descripción entera perdida) si el texto no tiene espacios

**File:** `packages/news/src/prefiltro-lexico.ts:131-135`

**Issue:** Si `texto.length > limite` y el prefijo cortado no contiene **ningún** `\s`,
`/\S*$/` casa el slice completo y el retorno es la cadena vacía. Verificado ejecutando el
módulo real: `truncarDescripcion("a".repeat(700)).length === 0`.

No es teórico: `despojarHtml` deja pasar slugs/URLs largos, y la frontera de palabra del
pre-filtro es `[^a-z0-9]`, así que un blob sin espacios del estilo
`…/2026/08/05/reforma-previsional-aprobada…` **sí contiene** `reforma` con frontera limpia
— pero `truncarDescripcion` lo borra entero antes de que `esLegislativo` lo vea. Resultado:
falso negativo. Bajo el régimen declarado en `prefiltro-lexico.ts:4-9`, un falso negativo es
**pérdida permanente e irreversible** de la noticia.

Agravante de alcance: `entrada-llm.ts:35` ahora usa **la misma** función, así que ese ítem
llegaría al golden set con `entrada_llm.descripcion === ""` mientras `prefiltro.terminos` no
está vacío → `coberturaTerminos` lo contaría como no-cubierto sin explicar por qué.

Es un defecto **preexistente** (no lo introdujo 133-04), pero la extracción lo bendice como
función compartida sin caracterizarlo.

**Fix:** no borrar nunca todo — si la limpieza de cola vacía el resultado, devolver el slice
sin limpiar (recall-first: un fragmento parcial es estrictamente mejor que la nada):
```ts
export function truncarDescripcion(texto: string): string {
  const limite = LIMITE_DESCRIPCION + MARGEN_TRUNCADO;
  if (texto.length <= limite) return texto;
  const cortado = texto.slice(0, limite);
  const limpio = cortado.replace(/\S*$/, "");
  return limpio.length > 0 ? limpio : cortado; // jamás devolver "" con entrada no vacía
}
```
Con test: `expect(truncarDescripcion("a".repeat(limite+1))).not.toBe("")`.

---

### WR-04 (MEDIUM): "✅ Diff-cero de comportamiento" es una afirmación más fuerte que la evidencia

**File:** `.planning/phases/133-.../133-04-SUMMARY.md:136` (y el JSDoc que la espeja,
`packages/news/src/prefiltro-lexico.ts:126-129`)

**Issue:** El SUMMARY marca como criterio pasado "Diff-cero de comportamiento" y lo
justifica con "la suite preexistente sigue en verde". Eso es **diff-cero de la suite**, no
de comportamiento: el propio SUMMARY reconoce, dos párrafos más abajo (línea 158), que
"CUALQUIER descripción bajo el límite perdía su última palabra en producción" — o sea, el
comportamiento de producción sí cambió, para el 100% de las descripciones cortas (68 de 85
ítems en los fixtures). Una fase planificada "sin cambios de comportamiento en producción"
declara el fix como desviación (bien) pero **cierra el criterio de diff-cero como verde con
la definición conveniente**. Es exactamente el patrón de falso verde del catálogo del repo.

Lo que faltaba era un número, y no cuesta nada obtenerlo. **Lo medí:** re-corriendo
`esLegislativo` sobre los 85 ítems de los 5 fixtures RSS reales con la función vieja vs. la
nueva → **0 flips de veredicto** (68/85 descripciones caían bajo el límite). El fix es real
y su impacto observable sobre el corpus disponible es cero.

**Fix:** corregir la redacción del criterio a "diff-cero de la suite preexistente; el
comportamiento de producción cambia por diseño (bug fix)", y fijar la cifra medida
(0/85 flips sobre los fixtures) en el SUMMARY. Idealmente, convertir esa medición en un test
permanente en `prefiltro-lexico.test.ts` (no solo el unit de `truncarDescripcion`).

---

### WR-05 (MEDIUM): nada distingue las filas de `noticia` filtradas antes vs. después del fix

**File:** `packages/news/src/carga-run.ts:146` (`causa: "prefiltro_lexico"`)

**Issue:** El descarte se registra con una causa constante, sin versión del pre-filtro ni
hash del vocabulario/lógica de truncado. Las 25 filas de PROD se filtraron con la versión
con bug; cualquier re-derivación desde R2 en 133-b correrá la versión arreglada. El corpus
resultante mezclará dos semánticas de filtro sin que ninguna columna lo delate, y un
`estado='descarta'` viejo no será distinguible de uno nuevo. Para un proyecto cuyo principio
rector es la trazabilidad, es la trampa exacta que la pregunta #4 anticipa.

**Fix:** estampar una versión al escribir (`prefiltro_version` o `causa:
"prefiltro_lexico@v2"`), derivada en runtime del vocabulario + un contador manual de
semántica; y dejar escrito en el SUMMARY/handoff de 133-b que **las filas anteriores al fix
deben re-derivarse desde R2, no reutilizarse**.

---

### WR-06 (MEDIUM): `congelarProfundo` está duplicado con DOS semánticas distintas, y la de `thresholds.ts` no congela en profundidad

**Files:** `packages/news/src/eval/taxonomia.ts:49-52` y `packages/news/src/eval/thresholds.ts`
(función homónima, ~línea 60)

**Issue:** Dos funciones con el mismo nombre y contratos distintos:

- `taxonomia.ts`: congela cada item del array + el array. Correcto para su forma.
- `thresholds.ts`: si es array, congela sus items (1 nivel); si es objeto plano, **solo
  congela el objeto**, sin recorrer sus hijos. Hoy funciona por accidente: `REGLA_DE_INTERVALOS`
  y `REFUTACION` son planos y se congelaron por separado antes de armar `THRESHOLDS`. El día
  que alguien añada una clave anidada al objeto congelado (p.ej. `regla_de_intervalos.detalle:
  {...}`), quedará mutable en runtime y **el nombre de la función dirá lo contrario**.

Es literalmente la "deuda de ICS en miniatura" que esta fase existe para evitar: una
constante/función replicada con desviación silenciosa entre copias. Agravante: no hay
`thresholds.test.ts` — la congelación de `THRESHOLDS` no tiene ni un test de mutación
(`taxonomia.test.ts:47` sí lo tiene para la taxonomía).

**Fix:** una sola `congelarProfundo` recursiva real (en `canonicalizar-json.ts` o un
`freeze.ts` del directorio), importada por ambos módulos, y un `thresholds.test.ts` con el
mismo test de mutación que `taxonomia.test.ts:47` sobre una clave **anidada**.

---

### WR-07 (MEDIUM): el matcher de frontera de palabra está replicado entre `prefiltro-lexico.ts` y `entrada-llm.ts`

**Files:** `packages/news/src/prefiltro-lexico.ts:53-57,65-70` vs
`packages/news/src/eval/entrada-llm.ts:44-55`

**Issue:** `FRONTERA = "[^a-z0-9]"`, `escaparRegExp` y la construcción
`` `(^|${FRONTERA})${...}(${FRONTERA}|$)` `` están copiados verbatim en los dos módulos.
D-133-J1 se firmó precisamente para matar la constante replicada del límite de truncado —
y en el mismo commit se creó otra pareja replicada, del mismo tipo y con la misma
consecuencia (si mañana el pre-filtro cambia la frontera para incluir, digamos, la `ñ`, la
cobertura de `entrada-llm.ts` medirá contra una frontera distinta y dará un número falso).
Además, `entrada-llm.ts:51` compila la RegExp **dentro** del bucle, sin cache — contraste
deliberado con el `PATRONES` compilado a nivel de módulo del pre-filtro.

**Fix:** exportar desde `prefiltro-lexico.ts` un `contieneTerminoConFrontera(textoFoldeado,
terminoFoldeado)` (o el `FRONTERA` + `escaparRegExp`) y consumirlo desde `entrada-llm.ts`.
La dirección de dependencia ya existe (línea 15 ya importa de ahí), así que no cuesta nada.

---

### WR-08 (MEDIUM): el test de `.strict()` prueba solo el nivel superior, pero la garantía anti-full-text vive en los niveles anidados

**File:** `packages/news/src/eval/caso-golden.test.ts:80-85` (y el JSDoc que hace la promesa,
`packages/news/src/eval/caso-golden.ts:6-12`)

**Issue:** El JSDoc afirma que `.strict()` en **TODOS** los objetos es "el control de
copyright/PII... la vía por la que el full-text entraría al golden set". El único test de
mutación inyecta `texto_completo` en la **raíz** del caso. Pero el lugar natural donde un
full-text se colaría es `entrada` / `entrada_llm` / `procedencia`
(`caso.entrada.texto_completo`, `caso.procedencia.html_crudo`), y ninguno está ejercitado.
El test certifica menos de lo que su JSDoc reclama.

**Fix:** extender el `it` a los cuatro objetos anidados:
```ts
for (const ruta of ["entrada", "entrada_llm", "procedencia", "revision"] as const) {
  const c = casoValido() as any;
  c[ruta].texto_completo = "full-text prohibido";
  expect(CasoGoldenSchema.safeParse(c).success, ruta).toBe(false);
}
```

---

## Info

### IN-01 (LOW): `z.enum(ETIQUETAS as [string, ...string[]])` tira el tipado literal

**File:** `packages/news/src/eval/caso-golden.ts:17`
El cast a `[string, ...string[]]` hace que `CasoGolden["etiqueta"]` se infiera como `string`,
no como `Etiqueta`. El runtime sigue correcto (los valores salen de `ETIQUETAS`), pero
TypeScript deja de cazar un literal inválido en 133-b/135 en tiempo de compilación.
**Fix:** `z.enum(ETIQUETAS as unknown as readonly [Etiqueta, ...Etiqueta[]])`, o tipar
`ETIQUETAS` en `taxonomia.ts` como tupla no vacía.

### IN-02 (LOW): `_interno` es un export muerto

**File:** `packages/news/src/eval/entrada-llm.ts:92`
El comentario dice "Expuesto solo para el test comparativo de divergencia de cortes
(D-133-J1.4)", pero `entrada-llm.test.ts` no lo importa y `grep -rn "_interno"` sobre
`packages/` y `app/` da esa única línea. Es superficie de API pública muerta que documenta
un uso inexistente. **Fix:** borrarlo, o usarlo en el test que dice servir.

### IN-03 (LOW): `TERMINOS_PROHIBIDOS` se exporta como `string[]` mutable

**File:** `app/lib/terminos-insinuacion.ts` (las tres constantes)
Al extraerse a un módulo importable, las denylists pasaron de ser locales de un test a ser
exportadas y mutables. Un `TERMINOS_PROHIBIDOS.length = 0` en cualquier importador dejaría
el guard anti-insinuación verde y vacío. G1 lee por disco (inmune), pero el test `(1)` de
`anti-insinuacion-guard.test.ts` usa el array importado. **Fix:** `Object.freeze([...])` y
tipo `readonly string[]`.

### IN-04 (LOW): `justificacion_a`/`_b` admiten cadena vacía

**File:** `packages/news/src/eval/caso-golden.ts:65-66`
`z.string().max(200)` sin `.min(1)`: una justificación vacía valida. D-133-C2.2 exige que
cite el fragmento literal; el esquema permite certificar la omisión.
**Fix:** `z.string().min(1).max(200)`.

### IN-05 (LOW): el test de `CONGELADO.md` depende de un orden de entradas que el régimen nunca declara

**Files:** `packages/news/src/eval/congelado.test.ts:62-65`, `packages/news/src/eval/CONGELADO.md:27-36`
El test toma `entradas[entradas.length - 1]` (la **última** sección `###`). El régimen del
propio `CONGELADO.md` (líneas 6-16) exige "una entrada nueva" pero no dice si va al final o
al principio. Si un editor futuro prepone la entrada nueva (convención de changelog
habitual, "más reciente arriba"), el test validará la entrada **más antigua** y pasará o
fallará por la razón equivocada. Además exige que cada entrada repita **ambos** hashes
aunque el cambio toque un solo artefacto.
**Fix:** declarar explícitamente "las entradas se APENDIZAN al final" en la sección Régimen,
y/o buscar la entrada por los hashes vigentes en vez de por posición.

---

## Lo que está bien (verificado, no asumido)

- **El fix del ítem #1 es correcto.** Reproduje el bug (`"...una gran reforma"` como última
  palabra) y confirmé que con el código actual `esLegislativo` → `true`. Bordes verificados
  ejecutando el módulo: `""` → `""`, `"   "` → `"   "`, longitud exactamente `= limite` →
  intacto (`<=`, no `<`), `null` no llega nunca (`?? ""` en `construirTexto:149` y
  `entrada-llm.ts:34`). No introduce modo de fallo nuevo; el único borde feo es preexistente
  y está en WR-03.
- **La desviación SÍ está declarada** (`133-04-SUMMARY.md:151-169`) con causa, fix, archivos
  y commit. La objeción es de redacción de un criterio (WR-04), no de ocultamiento.
- **La canonicalización es determinista para las entradas reales**: claves ordenadas
  recursivamente por code unit UTF-16 (`{"A","a","z","é"}` sale en ese orden exacto —
  `sort()` sin comparador, sin locale), arrays intactos, 2 espacios, LF, sin BOM, newline
  final, `sha256` de `node:crypto` en utf8. `git check-attr` confirma `text: set` /
  `eol: lf` sobre los dos JSON, así que el hash aguanta un checkout en Windows.
- **`entrada-llm.ts` respeta el régimen**: cero `String.includes` en el matching (frontera de
  palabra por RegExp), `entrada_llm` se foldea antes de comparar contra `prefiltro.terminos`
  (que viene ya foldeado), `coberturaTerminos([])` **lanza** en vez de devolver 1.0
  (cero vacuo cerrado). El test de divergencia D-133-J1.4 mide sobre 5 fixtures reales,
  80 ítems, 17 divergentes, `terminos_perdidos = 0` — y su assert muerde de verdad.
- **`caso-golden.ts` tiene todos los campos LOCKED** que la revisión pedía: `resuelto_por` ∈
  {acuerdo, operador, no_arbitrado}, `justificacion_a/_b` ≤ 200, `estrato` con `P-dirigido`,
  `modelo_a`/`modelo_b`, `en_calibracion_humana`, `etiqueta_humana` nullable, `.strict()` en
  todos los objetos. Cero casos etiquetados (correcto: eso es 133-b).
- **G1** lee por disco (no invierte la dependencia `app`→`packages`), strippea comentarios
  sobre los dos archivos con el cuidado del `://`, cuenta 30 = 6×5 campos con assert
  anti-`continue`, y sus pisos son honestos y argumentados (>=90 medido 92 con margen; ===2
  exacto para un conjunto cerrado; >=4 para idioms **espejando** el piso LOCKED existente en
  vez de endurecerlo a 10 con margen cero). La declaración de alcance nombra las cinco
  constantes `.tsx` no cubiertas.
- **G2** lee `app/` por walk de filesystem, sin allowlist, sin strip de comentarios, con
  piso >100 archivos contra el `catch { return [] }` silencioso del walk, sanity sobre un
  archivo concreto, contador `escaneados === archivos.length`, control positivo apareado y
  un par que aísla **una sola letra** para justificar el case-sensitive. La decisión de no
  heredar el flag `i` está argumentada con el hit real que produciría.
- **G3**: los **dos** skips silenciosos (tests `(1)` y `(1b)`) están cerrados por
  `leerSuperficie`, que lanza; el fallo es duro y hay par positivo/negativo `(1h)`/`(1i)`
  que difiere en una sola variable. `(1g)` recorre las 63+ rutas declaradas.
- **Seguridad y régimen**: cero secretos, cero PII, cero red en los tests (todo `readFileSync`
  sobre fixtures del repo), cero `eval`, cero causalidad/intención en las glosas (G1 lo
  prueba sobre los 30 strings), cero literal de etiqueta en superficie de `app/` (G2, D-133-G).
  `eval/index.ts` no fue tocado por los planes 03/04, como exigía la disciplina de worktrees.
- **Suite completa `@obs/news`: 252 tests, 19 archivos, todo verde** (corrida propia). El
  script `guards` lista los 3 guards nuevos **por nombre** (nunca glob), respetando D-13.

---

## Veredicto global

**APROBAR CON CONDICIONES.** No hay blockers: nada aquí puede corromper datos de producción
hoy ni abre un agujero de seguridad, y el fix que motivó la revisión es correcto y está
declarado. Pero **WR-01, WR-02 y WR-03 deben cerrarse antes de que 133-b etiquete un solo
caso**: los tres apuntan al mismo riesgo — que la vara con la que se va a medir el modelo
(esquema del golden, hash de los congelados, input real del clasificador) degrade en
silencio en vez de fallar ruidosamente. Son precisamente el tipo de defecto que esta fase se
creó para no heredar.

WR-04 y WR-05 son deuda de **declaración**, no de código, y se pagan escribiendo dos números
y una frase (uno de esos números ya está medido en este informe: 0/85 flips).

---

_Reviewed: 2026-08-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
