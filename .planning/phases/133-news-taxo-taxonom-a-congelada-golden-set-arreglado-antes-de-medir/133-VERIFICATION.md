---
phase: 133-news-taxo (acto 133-a)
verified: 2026-08-06T15:20:00Z
status: passed
score: 11/11 ítems de alcance de 133-a verificados
verificador: Claude (gsd-verifier), goal-backward, stance FORCE
alcance_verificado: solo 133-a (SC1 + SC3 + esquema de SC4). SC2 y la ejecución de SC4 son 133-b.
warnings:
  - id: W-1
    item: "index.ts (barrel de eval/) no re-exporta thresholds.ts / caso-golden.ts / entrada-llm.ts"
    severidad: warning
    impacto: "Los tres módulos de los planes 03/04 solo se alcanzan por ruta relativa. No rompe nada hoy (tsc -b RC=0, todos los tests verdes); es deuda de wiring que la Phase 135 debe cerrar al construir el prompt desde la SSoT."
  - id: W-2
    item: "12 comentarios JSDoc de app/lib/anti-insinuacion-guard.test.ts siguen declarando 'si una ruta no existe, se salta sin fallar (tolerancia try/catch del bucle)'"
    severidad: warning
    impacto: "Documentación obsoleta que contradice el comportamiento real tras G3. Un futuro plan podría declarar una ruta aún inexistente confiando en esos comentarios y poner el guard rojo. Sin impacto funcional hoy."
  - id: W-3
    item: "La regla '< 95 % de cobertura ⇒ el límite sube antes de etiquetar' no está enforced por ningún guard"
    severidad: warning
    impacto: "coberturaTerminos() calcula la fracción y lanza sobre lista vacía, pero el umbral 0,95 no bloquea nada. Es correcto para 133-a (no hay casos), pero 133-b debe convertirlo en gate ejecutable o la regla queda siendo prosa."
---

# Phase 133-a: NEWS-TAXO — Reporte de verificación

**Goal de la fase:** *"Existe la vara antes que la medición"* — taxonomía congelada por hash,
thresholds pre-registrados y congelados, esquema re-runnable del caso golden, y guards que
convierten todo eso en cumplimiento y no en promesa.

**Alcance verificado:** **solo 133-a**. SC2 (golden set etiquetado) y la ejecución de SC4 son 133-b
y su ausencia se verifica como **cumplimiento de alcance**, no como hueco.

**Veredicto: PASSED (11/11)** — con 3 warnings de deuda, ninguno bloqueante.

---

## Disciplina de alcance — lo primero que se verificó

Un plan que hubiera etiquetado casos sería un defecto, no cobertura.

```
$ git ls-files packages/news | grep json
packages/news/package.json
packages/news/src/eval/canonicalizar-json.test.ts
packages/news/src/eval/canonicalizar-json.ts
packages/news/src/eval/taxonomia.json
packages/news/src/eval/thresholds.json
packages/news/tsconfig.json

$ grep -rn "caso_id" packages/news/src --include=*.json
(ninguno)
```

`golden-set.json` **NO existe**. Cero casos etiquetados en el repo. `caso-golden.ts` define la FORMA
(zod), sin un solo dato. `CONGELADO.md:24-25` declara la ausencia explícitamente en vez de
disimularla. **Alcance respetado.**

---

## Ítem por ítem del alcance de 133-a

### 1. `taxonomia.ts` — SSoT ejecutable (fidelidad a D-133-A2) — ✓ VERIFICADO

| Exigencia LOCKED | Evidencia |
|---|---|
| 5 clases sustantivas + `ambiguo` | `taxonomia.ts:58-129`, 6 entradas; `taxonomia.test.ts` "tiene 6 entradas" ✓ |
| `agenda_ejecutivo` AUSENTE (fusionada) | test explícito "agenda_ejecutivo no aparece"; el JSDoc `:12-15` documenta por qué murió (indecidible textualmente) y que su contenido vive en `politica_no_legislativa:100-104` ✓ |
| `ley_vigente` por MARCA TEXTUAL | `:91-93` lista las cinco marcas verbatim de D-133-A2 ✓ |
| SIN la cláusula "modificación en trámite" | test `ley_vigente.frontera no contiene 'modificación en trámite'` ✓ |
| Precedencia en el ORDEN DEL ARRAY | no existe campo numérico de precedencia; test compara `TAXONOMIA.map(c=>c.etiqueta)` contra el orden LOCKED ✓ |
| Enrutamiento 1,3→proyecto · 2→persona · 4,5,6→ninguna | `enruta_a` verificado clase a clase en el test "enruta_a mapea las 6 clases" ✓ |
| Congelación profunda en runtime | `congelarProfundo` congela cada objeto **y** el array; test de mutación `mutar TAXONOMIA[0].etiqueta LANZA` ✓ (no una anotación `readonly` puramente compile-time) |
| No nombra sujetos | ningún nombre propio/partido/boletín en ningún string ✓ |

`ETIQUETAS` se **deriva** de `TAXONOMIA` (`:132`), nunca se re-tipea.

### 2. `thresholds.json` — los 9 umbrales pre-registrados — ✓ VERIFICADO

Orden en el array: **T1, T2, T3, T4, T5, T9, T6, T7, T8** — exactamente el LOCKED. La justificación
está razonada y es correcta (`thresholds.ts:4-8`): `umbrales` es **array** precisamente porque el
canonicalizador ordena claves de objeto y T9 se movería antes de T6 alfabéticamente. Diseño que
protege el orden firmado, no accidente.

- **T9 presente** (`thresholds.json:59-67`): `precision_actividad_parlamentaria`, umbral **0.9**,
  `n_minimo: 25`, `efecto: veto`, con la nota de que protege el enrutamiento a ficha de persona. ✓
- **T3 es macro-promedio, no accuracy global**: `metrica: "exactitud_macro"`, nota *"Media de
  exactitud por clase, calculada solo sobre las clases con n>=8"*, y `n_minimo_condicion: "al menos
  3 clases con n >= 8"` — la condición compuesta preservada en un campo propio en vez de perderse. ✓
- **n mínimo por veto**: T4/T5/T9 = 25; T3 = 8 + condición; T1/T2 = `null` (correcto, D-133-D2 los da
  sin n). ✓
- **Regla de intervalos** (`:7-12`): cuatro cláusulas — cifras con n e IC95, vetos sobre la
  **estimación puntual**, `dentro-del-ruido` si el IC95 cruza, y desempate por **solapamiento de
  IC95** (la constante de 6 pp explícitamente descartada). ✓
- **Refutación pre-registrada** (`:3-6`) **y refutación parcial de T9** (`:4`): *"Si T9 falla, o
  queda no-medido por n<25, el enrutamiento a fichas de persona NO entra a producción, aunque el
  resto de los umbrales apruebe."* ✓

### 3. La congelación es REAL, no decorativa — ✓ VERIFICADO (la prueba central de la fase)

**a) Hashes re-calculados por el verificador:**

```
$ sha256sum packages/news/src/eval/{taxonomia,thresholds}.json
90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c *taxonomia.json
e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e *thresholds.json
```

Coinciden **byte a byte** con `CONGELADO.md:34-35` y con `congelado.test.ts:26-27`. ✓

**b) MUTACIÓN DE REORDENAMIENTO DE CLAVES SOBRE AMBOS JSON** — la prueba de que la comparación es de
bytes y no de objetos. Se invirtió recursivamente el orden de claves de los dos JSON (semánticamente
idénticos, bytes distintos) y se corrió el test:

```
mutado → taxonomia.json  ac58d0ea...  thresholds.json  206ca901...
$ pnpm --filter @obs/news exec vitest run src/eval/congelado.test.ts
 Test Files  1 failed (1)
      Tests  4 failed | 4 passed (8)     RC=1
```

**Los 4 que caen son exactamente los correctos:** (a) y (b) los hashes vivos, (c) y (d) la sincronía
byte a byte de **ambos** JSON. Si la comparación fuese `toEqual` sobre JSON parseado, los 4 habrían
salido verdes y toda la congelación sería teatro. **No lo es.** Archivos restaurados y hashes
re-verificados idénticos; `git status --short` limpio.

**c) La comparación es de strings, por construcción:** `congelado.test.ts:44,48` usan
`expect(canonicalizar(X)).toBe(rawEnDisco)` — igualdad estricta de strings, con el JSDoc `:7-10`
declarando explícitamente que el matcher profundo sería *"el falso verde nº1 de la fase"*.

**d) `.gitattributes` y LF:**

```
$ cat .gitattributes
packages/news/src/eval/**/*.json text eol=lf

$ git ls-files --eol packages/news/src/eval/
i/lf w/lf attr/text eol=lf   packages/news/src/eval/taxonomia.json
i/lf w/lf attr/text eol=lf   packages/news/src/eval/thresholds.json
```

Índice LF, working tree LF, atributo aplicado. ✓

**e) Control positivo de estabilidad del hash en CLON LIMPIO** (ejecutado por el verificador, no
leído del SUMMARY):

```
$ git clone --no-hardlinks <repo> clon && sha256sum clon/packages/news/src/eval/*.json
90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c *taxonomia.json
e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e *thresholds.json
$ file clon/.../taxonomia.json → JSON text data   (no "with CRLF line terminators")
```

Los hashes **sobreviven un checkout limpio en Windows**. Este era el gotcha exacto del `psql -tA`
con CRLF de v12.0 y está cerrado. ✓

**f) Higiene de bytes:** `congelado.test.ts:69-82` asserta cero `\r`, cero BOM y newline final sobre
**ambos** JSON, con control positivo apareado que difiere en una variable (mismo fixture con `\r`
inyectado). ✓

**g) `CONGELADO.md`:** el test (f) parte por `^### ` y asserta que la **última** entrada contiene los
dos hashes vigentes. El régimen de "un commit con las tres cosas" está escrito, y la limitación se
declara sin disimulo (`:18-22`): *"la firma es un string dentro de un markdown… el control real es el
commit en git"*. ✓

### 4. Los guards no son promesas — ✓ VERIFICADO (los tres mutados, los tres caen)

**Conteo de guards — 20, por NOMBRE, jamás por glob:**

```
$ NO_COLOR=1 pnpm guards
app/         → Test Files 11 passed (11)   Tests 351 passed (351)
@obs/dinero  → Test Files  3 passed  (3)   Tests  34 passed  (34)
@obs/llm     → Test Files  3 passed  (3)   Tests   7 passed   (7)
@obs/news    → Test Files  3 passed  (3)   Tests  18 passed  (18)
                            ────
                            20 archivos de guard
```

11 + 3 + 3 + 3 = **20**. Verificado en `package.json` que los 9 de `packages/` se enumeran **uno a
uno por nombre de archivo** — sin `src/*guard*.test.ts`, que saldría 0 sin correr nada. ✓

**Suite completa de `@obs/news`:** `Test Files 19 passed (19) · Tests 252 passed (252)` — conteo
impreso asserted, no exit code pelado. Los 7 archivos de `src/eval/` aportan **43 tests**.

**Mutación G1** (término prohibido inyectado en una glosa de `taxonomia.ts`):

```
$ pnpm --filter @obs/news exec vitest run src/eval/taxonomia-guard.test.ts
 Tests  1 failed | 4 passed (5)    RC=1
```

**CAE.** ✓ G1 extrae **por disco** (`readFileSync`, no import — no invierte la dirección
`app` → `packages` del monorepo), aplica `stripTsComments` sobre los dos archivos leídos, y tiene
pisos anti-cero-vacuo (≥90 términos, `NEGACIONES_LOCKED` inline `=== 2` exacto, `IDIOMS_APROBADOS`
≥4) más un `verificados === 30` (6 clases × 5 campos) que caza un `continue` colado. El alcance
honesto de lo que la extracción **no** cubre está declarado (las CINCO constantes en `.tsx`).

**Mutación G2** (`export const CLASE_X = "tramitacion_legislativa"` añadido a `app/lib/week-utils.ts`):

```
 Tests  1 failed | 4 passed (5)
 → Literal de etiqueta renderizado en app/: [lib\week-utils.ts → "tramitacion_legislativa"]
```

**CAE, y nombra el archivo exacto.** ✓ El walk es completo, **sin allowlist** (sobre-cobertura =
virtud: nunca falso verde). El case-sensitive es una decisión razonada y verificada en el propio test
con un par que difiere en **una letra** (`Ambiguo`/`ambiguo`), no una omisión.

**Mutación G3 — los DOS skips silenciosos, no uno.** Ruta muerta inyectada en `SUPERFICIES_PERSONAS`:

```
 Failed Tests 3
 × (1)  Guard — ninguna superficie de voto ni MONEY insinúa   → Superficie declarada inexistente
 × (1b) …                                                      → Superficie declarada inexistente
 × (1g) G3 no-hueco: toda ruta declarada existe en disco       → expected [Function] not to throw
```

**Caen los DOS antiguos sitios de salto silencioso — (1) y (1b) — más el anti-hueco (1g).** ✓
Confirmado estructuralmente: `grep -n "catch" app/lib/anti-insinuacion-guard.test.ts` devuelve **un
solo `catch` de código** (`:700`), dentro de `leerSuperficie`, y **relanza** con mensaje explícito
(*"un allowlist con una ruta muerta es un guard ciego que sale verde"*). Ambas lecturas
(`:778`, `:803`) pasan por él. No quedó ninguno abierto.

**Controles positivos apareados** presentes y ejecutados: (1h) ruta real devuelve contenido / (1i)
**la MISMA ruta + `.noexiste`** lanza — difieren en una sola variable.

`tsc -b` en todo el monorepo: **RC=0**. `git status --short`: limpio tras todas las mutaciones.

### 5. Step de CI para `@obs/news` — ✓ VERIFICADO

`.github/workflows/ci.yml:67-73`:

```yaml
- name: Test @obs/news (taxonomía congelada + guards de superficie)
  run: pnpm --filter @obs/news exec vitest run
```

Es `vitest run` **sin filtros** ⇒ corre los 252 tests, no un subconjunto. Los 206 tests de la Phase
132 que nunca habían corrido en CI ahora corren. La deuda de que solo 4 workspaces están en CI
(los demás siguen CI-dark) se **declara en el comentario del propio step** en vez de disimularse. ✓

### 6. El bug del pre-filtro — ✓ VERIFICADO, y el diff-cero es real (con matiz)

**El bug era real.** `git show 531d130` confirma que `.replace(/\S*$/, "")` corría **incondicional**:
sobre input ya despojado y foldeado (que nunca termina en espacio), arrancaba la última palabra del
**100 %** de las descripciones bajo el límite. En un pre-filtro declarado **recall-first** eso es
pérdida permanente de noticias — modo de fallo, no cosmética.

**El fix** (`prefiltro-lexico.ts:131-135`): `if (texto.length <= limite) return texto;` antes del
`slice`. Correcto y mínimo.

**Cobertura del fix** — tres tests, ninguno con número mágico (derivan el corte de
`limiteTruncadoParaTests()`):
- `:211` texto corto se devuelve **intacto** — el caso que el bug rompía;
- `:216` corte en frontera de palabra cuando SÍ trunca;
- `:244-258` propiedad del margen, incluyendo `casiLimite` (frontera exacta) y `largo ≤ limite`.

**Evaluación del "diff-cero" declarado — es honesto, no un eufemismo.** El SUMMARY y el JSDoc dicen
literalmente *"diff-cero preservado para el caso de truncado real (**el único que la suite
preexistente ejercita**)"*. Esa acotación es exacta y verificable: para `texto.length > limite`
la rama es byte-idéntica a la anterior (`slice` + `replace` sin cambios). Para el caso corto el
comportamiento **sí cambia — y ese cambio ES el fix**, declarado como tal en el mensaje de commit y
en el código. No se vendió "diff-cero total"; se acotó a la rama donde aplica. **Reporte honesto.**

Riesgo residual declarado aquí: el cambio implica que las decisiones de pre-filtro **históricas**
(pre-fix) difieren de las nuevas para descripciones cortas — siempre en dirección de **más** recall.
133-b debe ser consciente de esto al muestrear casos P sobre crudo de R2 anterior al fix.

### 7. `entrada_llm` importa la MISMA función + cobertura de términos — ✓ VERIFICADO

`entrada-llm.ts:15,35` importa `truncarDescripcion` de `../prefiltro-lexico.js` — **la función, no
una constante replicada**. `LIMITE_DESCRIPCION`/`MARGEN_TRUNCADO` siguen privados del módulo; el
único acceso de test es `limiteTruncadoParaTests()`, un derivado de solo lectura. La deuda de ICS en
miniatura queda cerrada. ✓

`coberturaTerminos()` (`:76-89`) calcula la fracción con **frontera de palabra sobre texto foldeado**
(`String.includes` prohibido por régimen — "ley" no puede darse por presente en "leyenda") y
**lanza sobre lista vacía**, jamás devuelve 1.0 sobre cero casos (cero vacuo cerrado). El umbral
0,95 está documentado pero no enforced — ver **W-3**.

### 8. Esquema del caso golden, sin ningún caso — ✓ VERIFICADO

`CasoGoldenSchema` cubre **todos** los campos de D-133-F2: `caso_id`, `procedencia` (6 campos),
`entrada`, `entrada_llm`, `estrato` con los **cuatro** valores incluido `P-dirigido`, `prefiltro`,
`etiqueta`, y `revision` con los **once** campos incluidos `modelo_a`, `modelo_b`,
`en_calibracion_humana`, `etiqueta_humana`, `resuelto_por ∈ {acuerdo, operador, no_arbitrado}`. ✓

`.strict()` en **todos** los objetos, con la razón correcta declarada: es el control de
copyright/PII — un campo extra sería la vía por la que el full-text entraría sin que nadie lo note.
El enum de etiquetas se **deriva** de `ETIQUETAS`, no se re-escribe. 7 tests verdes.

### 9. Test de sincronía `.ts` → `.json` byte a byte — ✓ VERIFICADO

`congelado.test.ts:43-49`, casos (c) y (d), con `toBe` sobre strings. Probado por la mutación del
ítem 3: ambos caen. ✓

### 10. Canonicalizador determinista — ✓ VERIFICADO

`canonicalizar-json.ts`: recursivo, `Object.keys().sort()` **sin comparador de locale** (un
comparador sensible al locale rompería la reproducibilidad entre máquinas — el JSDoc lo declara),
**arrays intactos** (su orden es semántico), indentación 2, newline final, sha256 sobre los bytes.
6 tests verdes. El hash se computa **solo sobre los JSON, jamás sobre el `.ts`**, evitando el drift
falso por formateo. ✓

### 11. Honestidad del reporte — ✓ VERIFICADO

No sale "sospechosamente verde":

- **El flake de `vsim-antiflip-guard` se reportó, se diagnosticó y NO se usó para justificar un
  verde.** `133-02-SUMMARY.md:115-122` lo clasifica como *"flake diagnosticado (no es deviation del
  código)"*, imprime el diagnóstico (1 archivo, 1 test, timeout 5000 ms), identifica la causa
  (contención de recursos en la corrida completa), demuestra que el guard no toca `app/lib/`, y
  **re-corre**: 20/20 en aislamiento y 1803/1803 en la corrida completa. **Verificación independiente
  del verificador:** en `pnpm guards` de hoy, `lib/vsim-antiflip-guard.test.ts (20 tests) 175ms` —
  verde. No hay fallo enmascarado. ✓
- Los SUMMARY declaran deviations reales (`133-02` §Deviations, `133-01` §Deviations con el mismo
  gotcha), declaran la deuda de CI-dark en vez de esconderla, y declaran alcances honestos dentro del
  propio código (las CINCO constantes `.tsx` fuera de G1 — con la nota de que declarar cuatro habría
  sido peor que no declarar nada).
- **Cero marcadores de deuda** (`TODO`/`FIXME`/`TBD`/`XXX`/`HACK`) en los archivos de la fase.
- Working tree limpio; ~20 commits atómicos, tests RED antes del feat en cada tarea.

---

## Success Criteria del ROADMAP

| SC | Estado | Evidencia |
|---|---|---|
| **SC1** Taxonomía definida y congelada por sha256 | ✓ **CUMPLIDO** | `taxonomia.json` = `90981888…`, verificado por re-cálculo, por clon limpio, y por mutación de reordenamiento de claves que hace caer 4 tests |
| **SC2** Golden set etiquetado y congelado | ⏭ **133-b** | Fuera de alcance por D-133-I; ausencia verificada como correcta, no como hueco |
| **SC3** Thresholds pre-registrados y congelados antes de medir | ✓ **CUMPLIDO** | `thresholds.json` = `e4285944…`, 9 umbrales en orden LOCKED con T9, congelados **antes** de que exista una sola medición — la anti-circularidad es real |
| **SC4** Input re-runnable | ◐ **ESQUEMA CUMPLIDO** | `CasoGoldenSchema` con puntero (`procedencia`) **y** payload (`entrada`/`entrada_llm`); la ejecución (poblar casos) es 133-b |

---

## Lo que NO quedó verificado

Sección obligatoria. Todo salió verde; esto es lo que ese verde **no** cubre.

1. **El acto 133-b entero, por diseño.** No existe un solo caso etiquetado, ni kappas, ni arbitraje,
   ni `golden-set.json`. Verifiqué que **no existen** (correcto), no que funcionen. La vara está
   construida; **nada la ha medido todavía**. Un hash correcto sobre una taxonomía que ningún caso
   real ha estresado sigue siendo una hipótesis: la decidibilidad textual de las 5 clases es
   **razonada, no medida**. Ese es el riesgo residual central para 133-b.

2. **La calidad semántica de las glosas.** Verifiqué que no contienen términos prohibidos, que no
   nombran sujetos y que están congeladas. **No puedo verificar que un humano y un modelo, leyendo
   solo titular + bajada, apliquen la misma frontera.** Eso es exactamente el kappa de 133-b — y es
   la lección de Is Chile Safe (su techo de 65,9 % era de labels, no de modelo). La frontera
   `politica_no_legislativa` / `no_legislativa` es la que más carga interpretativa lleva y la que más
   probablemente mueva el kappa hacia abajo.

3. **Los umbrales nunca se han evaluado contra datos.** T3 con `n≥8` en ≥3 clases y T4/T5/T9 con
   `n≥25` son exigencias fuertes sobre una muestra que aún no existe. Es previsible que varios queden
   **`no-medido`** en la primera pasada de 133-b — con la consecuencia ya pre-registrada de que la
   clase no enruta (y, para T9, que el enrutamiento a ficha de persona no entra a producción). Que
   eso ocurra sería el sistema funcionando, no un fallo; pero conviene decirlo **antes** de medir.

4. **La firma del operador no es criptográfica.** `CONGELADO.md` lo declara sin disimulo, y el
   verificador lo confirma: cualquiera con acceso de escritura puede editar el markdown. El control
   real es el commit en git. Verifiqué que el régimen está **escrito** y que el test asserta que la
   última entrada contiene los dos hashes vigentes; **no** verifiqué que un cambio ilegítimo sea
   imposible — no lo es, solo es visible.

5. **G2 no cubre superficies no-`.ts/.tsx`.** El walk excluye `.json`, `.md`, `.mdx` y cualquier copy
   que llegue desde la DB. Si la etiqueta llegara a la superficie **por dato** (una fila de Supabase
   renderizada), G2 no la vería. Fuera del alcance de 133-a, pero es el flanco a cubrir cuando 135
   escriba la etiqueta en la DB.

6. **El fix del pre-filtro cambia el comportamiento histórico.** Verificado que el fix es correcto y
   está cubierto, y que el "diff-cero" fue declarado con su acotación honesta. **No verifiqué** el
   impacto retroactivo: las decisiones de pre-filtro sobre crudo de R2 anterior a `531d130` difieren
   (siempre hacia más recall) de las que produciría el código de hoy. 133-b debe re-correr el
   pre-filtro sobre el crudo, nunca reutilizar un `paso`/`terminos` calculado antes del fix.

7. **CI no se ejecutó.** Verifiqué que el step existe y que su comando (`vitest run` sin filtros)
   corre los 252 tests. **No** corrí el workflow en GitHub Actions ni observé un run verde en el
   runner de CI. Un fallo específico de Linux/CI (rutas, `findWorkspaceRoot`, case-sensitivity del
   filesystem — G1 y G2 caminan el filesystem desde `app/`) no quedaría cazado por mi verificación
   local en Windows. **Este es el hueco más accionable del informe:** conviene confirmar el primer
   run verde de CI antes de arrancar 133-b.

8. **Los 3 warnings** (barrel incompleto, 12 comentarios obsoletos que aún prometen tolerancia a
   rutas muertas, y el umbral 0,95 sin enforcement) son deuda declarada, no fallos: ninguno rompe
   nada hoy, los tres tienen dueño natural en 135 / 133-b.

---

## Veredicto

**PASSED — 11/11 ítems del alcance de 133-a.**

La vara existe y **muerde**. Los tres puntos donde una fase así se cae en falso verde fueron probados
por mutación, no por lectura: (a) la congelación es de **bytes** — el reordenamiento de claves sobre
**ambos** JSON hace caer 4 tests; (b) los tres guards caen al inyectarles la violación, y G3 cerró
los **DOS** skips silenciosos, no uno; (c) los hashes **sobreviven un clon limpio en Windows**.

El alcance se respetó con disciplina: cero casos etiquetados, y la ausencia de `golden-set.json`
declarada en `CONGELADO.md` en vez de disimulada.

**Recomendación:** confirmar el primer run verde del step de CI de `@obs/news` antes de abrir 133-b
(punto 7 de "lo que NO quedó verificado"). Es la única verificación pendiente que puede fallar por
causas ajenas a lo que aquí se probó.

---

*Verificado: 2026-08-06 · Verificador: Claude (gsd-verifier), goal-backward, stance FORCE*
*Todas las mutaciones fueron revertidas; `git status --short` limpio y hashes re-verificados idénticos.*
