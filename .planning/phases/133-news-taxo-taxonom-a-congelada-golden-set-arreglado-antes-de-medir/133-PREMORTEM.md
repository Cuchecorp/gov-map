# Phase 133 — NEWS-TAXO · PREMORTEM

**Fecha:** 2026-08-05
**Documento bajo examen:** `133-ADJUDICACION.md` (D-133-A..F), escrita por Opus en sustitución de Fable, **NO ratificada**.
**Eje rector:** TRANSPARENCIA — el valor core literal de `.planning/PROJECT.md:9`.
**Método:** desconfiar. Este documento no mejora la redacción de la adjudicación; intenta refutarla.

> `.planning/PROJECT.md:9` — "La ciudadanía puede responder, sobre cualquier proyecto de ley o
> parlamentario, 'qué pasó, cuándo y según qué fuente' — cada dato mostrado lleva fuente, fecha y
> enlace original, **sin afirmar nunca intención ni causalidad**."

---

## 1. Tabla de premisas verificadas

| # | Premisa de la adjudicación | Método de verificación | Veredicto | Evidencia |
|---|---|---|---|---|
| P-01 | "el prompt del clasificador de 135 se CONSTRUYE desde `taxonomia.ts`, y **cualquier superficie UI de 137 importa de ahí**" (ADJ:74-77) es seguro respecto del linter anti-insinuación | Leer el guard y su raíz de escaneo | **FALSA — es un bypass** | `app/lib/anti-insinuacion-guard.test.ts:68` `const APP_ROOT = path.resolve(import.meta.dirname, "..")` → escanea SOLO `app/`. La lista de superficies (`TODAS_LAS_SUPERFICIES`, :864-881) es un **allowlist explícito**, no un glob, y los archivos faltantes se **saltan en silencio** (`try/catch continue`, :943-948). Nada bajo `packages/news/` se lintea. Confirmado: no existe guard anti-insinuación en `packages/news/`. |
| P-02 | Las etiquetas y sus glosas no pueden violar `NEGACIONES_LOCKED` / términos prohibidos | Leer `TERMINOS_PROHIBIDOS` y comparar con las 7 etiquetas | **VERDADERA HOY, NO GARANTIZADA** | `anti-insinuacion-guard.test.ts:623-757`. Ninguna de las 7 etiquetas actuales colisiona literalmente. Pero `"señal"`, `"los más"`, `"exprés"`, `"vinculado a"`, `"conflicto de interés"` **sí** están prohibidos (:695, :720, :715, :640, :639), y la glosa de la clase 2 ya bordea el terreno ("patrimonio e intereses, ética y sanciones"). Combinado con P-01, una edición futura de la glosa entra a la UI **sin que ningún test la vea**. |
| P-03 | El pre-filtro y el clasificador ven el mismo texto (premisa implícita de "el golden mide el PIPELINE COMPLETO", ADJ:115) | Leer el pre-filtro | **FALSA** | `packages/news/src/prefiltro-lexico.ts:50` `const LIMITE_DESCRIPCION = 600;` vs ADJ:381-383 `entrada_llm` **truncada a 300 chars por campo**. El pre-filtro decide sobre 600 chars; el clasificador y el golden ven 300. El campo `prefiltro.terminos` (ADJ:375) puede citar un término **ausente** de `entrada_llm`. |
| P-04 | La ventana de 3 días rinde ≈60-80 ítems en el estrato P (ADJ:122) | Proyección con los números reales + regla de dedup LOCKED | **NO VERIFICABLE — proyección lineal inválida** | El día 1 (245 vistas / 25 pasan) es una **cosecha de arranque en frío**: la ventana entera de los 5 feeds. D-13 (`132-CONTEXT.md:124`) impone dedup por URL exacta contra el ledger + canonicalización ⇒ días 2-3 aportan **solo el delta**, no otros 245. Rango honesto: P ∈ [40, 75], total golden ∈ [120, 155]. Ver §2-B1. |
| P-05 | 140 casos alcanzan para medir T4 (`recall_tramitacion_legislativa ≥ 0,85`) | Aritmética de composición por clase | **FALSA** | Ver §2-B5. n(`tramitacion_legislativa`) ≈ 12 (rango 6-20). A n=12 los valores alcanzables son 10/12=0,833 (FALLA) y 11/12=0,917 (PASA): **no existe ningún resultado cercano a 0,85**. El umbral que decide si NEWS-05 entra a producción se resuelve por **un solo ítem**. |
| P-06 | κ entre dos Sonnet mide acuerdo inter-anotador | Leer D-133-C:192-196 | **FALSA — falso verde estructural** | La prohibición escrita es "los etiquetadores NO pueden ser el mismo modelo **ni el mismo prompt que se evaluará en 135**". **No prohíbe que los dos etiquetadores sean el mismo modelo entre sí** — y la decisión los fija explícitamente como "dos agentes Sonnet". Dos corridas del mismo modelo con las mismas definiciones comparten priors y modos de fallo: eso es **auto-consistencia disfrazada de acuerdo**. |
| P-07 | El cap de 25 desacuerdos y el umbral de acuerdo ≥0,80 son compatibles | Aritmética | **FALSA — se contradicen** | D-133-C:206 (cap 25 ⇒ **detener**) vs D-133-C:211 (acuerdo ≥0,80 ⇒ **utilizable**). A n=140, acuerdo 0,80 admite **28** desacuerdos. Un golden con acuerdo 0,81 (aprueba la vara de calidad) queda **detenido por el cap**. Las reglas se cruzan en n=125. |
| P-08 | `agenda_ejecutivo` y `ley_vigente` son decidibles desde titular+bajada | Leer las definiciones y la precedencia | **FALSA** | ADJ:61-62. Clase 3 pierde contra 1 "si hay una modificación en trámite en el Congreso"; clase 4 exige que la iniciativa "**aún no** ha ingresado al Congreso". Ambos son **hechos del corpus**, no del texto. Y D-133-C:198-200 exige que cada etiqueta cite un **fragmento literal** del titular/bajada — imposible para una etiqueta cuyo hecho decisorio es externo. Contradicción interna A↔C. |
| P-09 | El veredicto v11.0 cubre a Granite para esta tarea | Leer el veredicto citado | **NO VERIFICABLE (extrapolación)** | ADJ:33/266-270 invoca "Granite APPROVED solo clasificación; extracción VETADA por es-CL". La aprobación fue sobre **otra tarea y otro dominio**; el veto fue por **es-CL**. Prensa chilena con farándula y jerga política es exactamente el terreno donde el es-CL falló. La adjudicación trata la aprobación como transferible sin evidencia. |
| P-10 | `.gitattributes` con `eol=lf` basta para estabilizar el hash | `git ls-files \| grep gitattributes` | **INCOMPLETA** | **No existe `.gitattributes` en ningún punto del árbol.** Hay que crearlo — y crearlo *después* de commitear los JSON exige `git add --renormalize`, o el índice conserva CRLF y el hash se mueve solo. Es literalmente el gotcha de v12.0 (`psql -tA` emitiendo CRLF) repetido. |
| P-11 | `CONGELADO.md` protege contra drift | Leer D-133-E:330-338 | **PARCIALMENTE FALSA** | Solo se hashean los 3 JSON. `CONGELADO.md` — que contiene el log de cambios **y la firma del operador** — no está hasheado ni verificado por ningún test. La "firma" es un string editable en un markdown. Aceptable como deuda declarada; no como garantía. |
| P-12 | D-133-D es coherente con lo ya LOCKED en 134 | Cruzar con ROADMAP | **FALSA — contradice un SC LOCKED** | ADJ:268-269: "el LLM **jamás** emite el número de boletín ni el nombre resuelto; eso lo hace `extraerBoletines`". `.planning/ROADMAP.md:232` SC1 de 134: "**El LLM emite boletín/nombre de la lista cerrada inyectada en el prompt** (3.675 boletines / 186 parlamentarios; jamás un id)". Son dos contratos distintos. |
| P-13 | `extraerBoletines` es reusable desde el carril news | Localizar el símbolo | **VERDADERA con costo arquitectónico no declarado** | `app/lib/boletin-en-materia.ts:58`. Vive en **`app/`**, no en `packages/`. Su fail-closed #2 es la RPC `lobby_menciones_de_boletin` (:29-33). "Reusarlo sin reescribirlo" desde `packages/news` invierte la dirección de dependencia del monorepo. La adjudicación lo da por resuelto. |
| P-14 | La taxonomía, los umbrales y la tasa de error son públicos | Buscar cualquier requisito de publicación | **FALSA** | Ninguno de D-133-A..F, ni el ROADMAP de 137, exige publicar la taxonomía, el umbral, la tasa de error ni la fecha del último eval en el **sitio**. Las honestidades de D-133-B:146-159 están redactadas para "el reporte de 135" — un `.md` interno. Ver §2-A4. |
| P-15 | `ambiguo` excluido del denominador no permite gaming | Razonar la métrica | **VERDADERA** | El denominador son los casos **humano-no-ambiguo**; un modelo que responde `ambiguo` ahí cuenta como error. La métrica no es gameable por esa vía. (Premisa que **sí** se sostiene.) |
| P-16 | El pre-filtro no se ablanda para conseguir muestra | Leer la prohibición citada | **VERDADERA** | `prefiltro-lexico.ts:6-9`, verbatim: "PROHIBIDO podar el vocabulario para ajustar ninguna métrica… jamás se quitan términos del vocabulario para forzarla a bajar." La cita de ADJ:134-135 es exacta. |
| P-17 | La fase puede ejecutarse hoy | Fecha del sistema vs ventana declarada | **FALSA** | Hoy es **2026-08-05**; la ventana es 2026-08-05 → **2026-08-07**. Los días 2 y 3 no existen. Ver §2-B7. |

---

## 2. Modos de fracaso, ordenados por daño

### BLOQUE A — daño a la transparencia y la credibilidad pública

---

#### A1 — El sitio publica una afirmación editorial de máquina con 1 error de cada 5, sin decirlo. `BLOCKER`

**Síntoma a 6 meses.** Un periodista abre la ficha de un parlamentario. La noticia "El revelador mensaje de
Marité Matus…" aparece bajo un chip que dice `Actividad parlamentaria`. O al revés: una noticia real sobre la
votación de la Megarreforma aparece marcada `No legislativa`. El chip no lleva fuente, ni fecha, ni margen de
error, ni la palabra "estimado". El periodista tuitea la captura. El sitio que exige "fuente, fecha y enlace
por cada dato" acaba de mostrar un **dato sin fuente**: la etiqueta no tiene autor declarado, y su autor es un
LLM barato.

**Causa raíz.** La adjudicación **nunca decide si la etiqueta se muestra**. D-133-A:69-71 la describe como
enrutamiento ("si esta noticia se cuelga de una ficha de proyecto, de una ficha de parlamentario, o de
ninguna"), pero ADJ:441-442 deja abierto "**si `agenda_ejecutivo` merece superficie propia en la UI de 137**",
lo que presupone que las etiquetas **sí** llegan a la UI. Y T3 = 0,80 (ADJ:256) significa, en castellano
ciudadano, **1 de cada 5 etiquetas mostradas es falsa**. La adjudicación argumenta 0,80 contra el 65,9 % de
ICS — una comparación entre máquinas — y nunca lo traduce a lo que ve el ciudadano.

Peor: dos de las siete etiquetas son **negativas por construcción**. `no_legislativa` y
`politica_no_legislativa` renderizadas en una ficha son el sitio diciéndole al lector "esto no es trabajo
legislativo de verdad". Eso es un **juicio editorial**, no un hecho fechado con fuente.

**Qué cambiar.**
- **D-133-A** — añadir una decisión explícita, congelada junto a la taxonomía: *la etiqueta es un valor de
  enrutamiento **interno**; no se renderiza como texto al ciudadano en 137.* Si el operador quiere mostrarla,
  entonces D-133-A debe congelar además una **capa de display separada** (`glosa_publica` por etiqueta,
  distinta del nombre técnico) y prohibir que `no_legislativa` / `politica_no_legislativa` / `ambiguo` tengan
  superficie pública — son decisiones de descarte, no hechos.
- **D-133-D** — si la etiqueta se muestra, T3 ≥ 0,80 es **insuficiente** para superficie pública. Un dato
  mostrado con 20 % de error exige o bien un umbral de publicación separado y mucho más alto, o bien una
  declaración visible de incertidumbre ("clasificación automática — exactitud medida X % al DD-MM-AAAA").

---

#### A2 — La única clase que aterriza en la página de una persona es la única sin umbral de precisión. `BLOCKER`

**Síntoma a 6 meses.** Un parlamentario aludido reclama: en su ficha aparecen tres noticias que no son sobre
él —lo mencionan de pasada, o son de otro Fulano homónimo, o son farándula— agrupadas bajo un rótulo que dice
"actividad parlamentaria". Su abogado pregunta con qué vara se decidió eso. La respuesta documentada es: con
ninguna.

**Causa raíz.** Aritmética de D-133-D. De los cinco vetos, **T4 protege el recall** de
`tramitacion_legislativa` (ficha de proyecto) y **T5 protege la precisión** de `no_legislativa` (basurero).
`actividad_parlamentaria` — la **única clase que la propia adjudicación enruta a la ficha de un
parlamentario** (ADJ:69-71), y por tanto la única con exposición reputacional y de PII — **no tiene ningún
umbral**. Queda cubierta solo por T3, la exactitud global, donde se diluye entre ~70 casos triviales de
`no_legislativa`.

La asimetría que la adjudicación argumenta para T4 (ADJ:257: "un **falso positivo** lo mata el resolver de 134
— boletín `null` ⇒ dead-letter") **no aplica a esta clase**: no hay boletín que resolver. El resolver
determinista de 134 filtra falsos positivos *de proyectos*, no *de personas*. Para `actividad_parlamentaria` la
red de seguridad citada **no existe**, y la adjudicación razona como si existiera.

Súmese el pre-filtro **recall-first por decisión LOCKED** (D-06, `prefiltro-lexico.ts:4-6`) que deja pasar
farándula a propósito, y `VOCABULARIO_LEGISLATIVO` conteniendo términos tan amplios como `"ley"`, `"sala"`,
`"reforma"`, `"diputado"` (`prefiltro-lexico.ts:16-47`): la vía "titular hostil de farándula → ficha de
parlamentario" está **abierta de punta a punta y sin vara**.

**Qué cambiar.** **D-133-D** — agregar un veto **T9: `precision_actividad_parlamentaria ≥ 0,90`**, con la
misma jerarquía que T5, y declarar por escrito la asimetría inversa: *en la clase que toca a una persona
identificable, el falso positivo es el daño irreversible.* Y agregar a D-133-B una **cuota mínima de estrato**
para esta clase (ver B5), o T9 es inmedible.

---

#### A3 — La ruta de copy que la adjudicación ORDENA es exactamente la que el linter no puede ver. `BLOCKER`

**Síntoma.** Alguien afina una glosa de la taxonomía en un milestone futuro y escribe "…señal de cercanía con
el oficialismo". `pnpm test` pasa verde. El texto sale al aire.

**Causa raíz.** D-133-A:74-77 ordena: "cualquier superficie UI de 137 **importa de ahí**. Prohibido re-escribir
las etiquetas a mano en el prompt o en el frontend." La intención es buena (mata la deuda de ICS). El efecto
lateral es que el copy visible pasa a vivir en `packages/news/src/eval/taxonomia.ts`, mientras el guard
anti-insinuación es un **escáner de texto fuente sobre un allowlist de rutas dentro de `app/`**
(`anti-insinuacion-guard.test.ts:68`, :864-881). Un componente que renderice `{TAXONOMIA[i].definicion}` no
contiene ningún literal escaneable: el guard lo lee y no ve nada. Y los archivos que faltan del allowlist se
**saltan sin fallar** (:943-948), así que ni siquiera hay un error ruidoso.

El precedente ya está documentado en el propio guard (:420-423): el template del digest de
`packages/notificaciones` quedó fuera de `APP_ROOT` y necesitó *su propio guard de paquete*. La adjudicación
recrea el mismo agujero y no lo menciona.

**Qué cambiar.** **D-133-A** — añadir como entregable congelado de esta fase un
`packages/news/src/eval/taxonomia-guard.test.ts` que corra `TERMINOS_PROHIBIDOS` sobre **cada string de
`taxonomia.ts`** (etiqueta, definición, frontera, y la `glosa_publica` de A1), con su prueba de mutación —
inyectar un término prohibido y demostrar que el test cae. Sin eso, la orden de importar desde `packages/news`
es un downgrade neto de la protección de copy.

---

#### A4 — El observatorio de transparencia clasifica con una vara que no publica. `BLOCKER`

**Síntoma a 6 meses.** Un investigador de transparencia pregunta: *¿con qué criterio decidieron que esta
noticia es "actividad parlamentaria"? ¿qué modelo? ¿con qué tasa de acierto? ¿medida cuándo, sobre qué
muestra?* No hay página que responder. La respuesta existe —en `CONGELADO.md`, `thresholds.json` y el reporte
de 135— pero vive en `.planning/` y en el repo, no en el sitio. El sitio que le exige trazabilidad al Congreso
resulta ser opaco sobre su propio juicio.

**Causa raíz.** D-133-B:146-159 es genuinamente honesto — declara que el golden **no permite afirmar** nada
sobre otros outlets, nada sobre estabilidad temporal, nada bajo n=8, y exige IC en toda cifra. Es la mejor
página de la adjudicación. Pero su destinatario declarado es "**el reporte de 135**": un artefacto interno. La
honestidad no viaja al ciudadano. El sesgo de 2 outlets y 3 días queda perfectamente documentado **donde nadie
lo lee**.

Esto no es un detalle de UX: es una **incoherencia de producto**. Un dato del Congreso lleva fuente, fecha y
enlace; un dato producido por el propio sitio (la etiqueta) no lleva nada.

**Qué cambiar.** **D-133-B y D-133-E** — congelar en esta fase la obligación de un artefacto público:
`taxonomia.json` + los umbrales + `exactitud_medida`, `n`, `IC`, `fecha_del_eval`, `modelo`, y las cinco
limitaciones de D-133-B:146-159, **servidos en una página del sitio** ("Cómo clasificamos las noticias"), con
el requisito escrito como entregable de 137 y ligado al hash de `CONGELADO.md`. Si la etiqueta no se muestra
(A1), esto se reduce; si se muestra, es condición de coherencia.

---

#### A5 — Dos clases exigen inferir un hecho que el input no contiene. `BLOCKER` (comparte raíz con B4)

Ver **B4** — es simultáneamente un defecto de transparencia y un defecto de medición, y lo trato allí para no
duplicarlo. Resumen de la cara pública: `agenda_ejecutivo` obliga al modelo a afirmar que una iniciativa **aún
no ingresó al Congreso** a partir de un titular. Cuando se equivoca, el sitio publica una afirmación sobre el
estado institucional de un proyecto que **contradice su propio corpus de 3.675 boletines**. Es la peor clase de
error para este producto: no es un chip feo, es un dato falso sobre tramitación.

---

### BLOQUE B — fracaso interno de ejecución

*(Escenario: 3 horas después de arrancar la Phase 133.)*

---

#### B1 — La ventana de 3 días no rinde lo proyectado, porque el día 1 fue arranque en frío. `HIGH`

**Síntoma.** Día 3: el estrato P tiene 42 casos, no 75. El golden total llega a 122. Está sobre el piso de 100
pero bajo el objetivo de 140, y la conversación se vuelve "¿extendemos y perdemos 2 días más, o firmamos algo
más chico?" — con los etiquetadores ya corriendo.

**Causa raíz.** ADJ:122 proyecta "≈60-80 con la ventana de 3 días" multiplicando el día 1 por 3. Pero el día 1
cosechó la **ventana completa** de los 5 feeds (245 ítems = ~49/feed, que es el tamaño típico de un RSS, no la
producción diaria de un medio). D-13 (`132-CONTEXT.md:124`) dedupea por URL exacta contra el ledger + URL
canónica, así que los días 2 y 3 aportan **solo ítems nuevos**. Cuenta explícita:

| Escenario | Vistas d2+d3 | Pasan d2+d3 | **P total** | **Golden total** | ¿140? | ¿piso 100? |
|---|---|---|---|---|---|---|
| Rotación total del feed (optimista) | ~490 | ~50 | **75** | **155** | sí | sí |
| Rotación 60 % | ~294 | ~30 | **55** | **135** | casi | sí |
| Rotación 30 % (pesimista) | ~147 | ~15 | **40** | **120** | **no** | sí |

El **piso de 100 sobrevive en los tres escenarios** — porque los 80 casos de los estratos N no dependen de la
rotación, salen de los 220 descartes que ya existen. El objetivo de 140 es una moneda al aire.

Y el "censo de los que pasan" con 3 de 5 outlets aportando cero: el censo sigue siendo censo (no se rompe
ninguna regla), pero convierte al estrato P en un **censo de latercera+lacuarta**, no de la prensa chilena. La
adjudicación ya lo declara (D-133-B:147-149) — lo que no hace es notarlo que ese sesgo **es estructural, no del
día 1**: si tres feeds aportan cero durante tres días, no es mala suerte, es el pre-filtro o el feed.

**Qué cambiar.** **D-133-B** — reemplazar la proyección lineal por una **regla de decisión medida al final del
día 2**: si el delta de P del día 2 es < 15, se sube `N-alea` de 50 a 70 y se declara el estrato P como
"censo de 2 outlets, n=X" en vez de extender la ventana. Congelar el piso 100 como el compromiso real y quitar
"140" del carácter de objetivo firmado.

---

#### B2 — `κ ≥ 0,65` entre dos Sonnet es un falso verde estructural. `BLOCKER`

**Síntoma.** Acuerdo bruto 0,91, κ 0,79. El golden se congela con honores. Seis meses después alguien descubre
que ambos etiquetadores metieron sistemáticamente los anuncios del Ejecutivo en `tramitacion_legislativa`, y
que el "techo" del clasificador era, otra vez, de etiquetas.

**Causa raíz.** D-133-C:192-196 prohíbe que los etiquetadores sean *el modelo que se evalúa en 135*, pero
**no prohíbe que los dos etiquetadores sean el mismo modelo entre sí** — y la decisión los fija como "dos
agentes Sonnet". Dos corridas del mismo modelo, con **las mismas definiciones de `taxonomia.ts`** en el prompt,
comparten pesos, priors y modos de fallo. Su acuerdo mide **estabilidad de muestreo**, no convergencia de dos
criterios. La adjudicación identifica correctamente el riesgo de circularidad **hacia 135** y lo cierra; deja
abierta la circularidad **dentro del propio protocolo**, que es la que produce el número que se publica como
"la vara sobre la vara".

Esto es exactamente el patrón de falso verde que este repo ya pagó y catalogó ("criterio pilar sobre un shim de
2 KB", "test que certificaba una omisión").

**Qué cambiar.** **D-133-C** — (a) los dos etiquetadores deben ser **modelos distintos** (p. ej. Sonnet + Opus,
o Sonnet + Fable cuando tenga créditos), no dos instancias del mismo; (b) **calibración humana obligatoria**:
el operador etiqueta a ciegas una submuestra estratificada de ~20 casos **antes** de ver ninguna etiqueta de
máquina, y se publica el κ humano↔máquina junto al κ máquina↔máquina. Si el κ humano es mucho menor, el κ
máquina es lo que siempre fue: auto-consistencia. Ese es el único control positivo apareado que hace
interpretable el número.

---

#### B3 — El cap de 25 y el umbral de acuerdo 0,80 se contradicen; el bucle de salida no existe. `BLOCKER`

**Síntoma (hora 3 del etiquetado).** Van 90 casos y hay 26 desacuerdos — tasa perfectamente normal para una
taxonomía de 7 clases estrenada hoy. La regla dice **detener** y volver a D-133-A. Se reescriben las
definiciones. Se re-etiqueta. Vuelve a haber 26. No hay criterio escrito para salir del bucle, ni presupuesto,
ni número máximo de vueltas, ni salida honesta declarada — a diferencia de D-133-D, que sí tiene su condición
de refutación pre-registrada.

**Causa raíz.** Dos números incompatibles:
- D-133-C:206 — cap **25 casos** escalados ⇒ detener.
- D-133-C:211 — acuerdo bruto **≥ 0,80** ⇒ golden utilizable.

A n=140, acuerdo 0,80 tolera **28** desacuerdos. Un golden con acuerdo 0,81 —que **aprueba** la vara de
calidad— es **detenido por el cap**. Las dos reglas se cruzan en n=125: bajo eso el cap es más laxo, sobre eso
es más estricto. Una de las dos sobra, y hoy la que muerde primero es la que se justifica por costo de
operador, no por calidad.

Además, la tasa esperable está mal calibrada: 25/140 = 18 % de desacuerdo es un piso **optimista** para una
taxonomía nueva con fronteras 1/2, 1/3 y 1/4 declaradamente finas (la propia D-133-A:104-105 anticipa que 1/2
concentrará el desacuerdo).

**Qué cambiar.** **D-133-C** — (a) eliminar el cap como criterio de calidad y dejar **solo** el par
(acuerdo ≥0,80, κ ≥0,65) como puerta; el cap pasa a ser un **presupuesto de sesión del operador**: si los
desacuerdos superan 25, se arbitran los 25 de mayor impacto (estratificados por clase) y el resto se marca
`ambiguo` **declarado como no-arbitrado**, contando contra `tasa_ambiguo_humano`; (b) escribir la **condición
de refutación del protocolo**, en simetría con D-133-D: *si tras dos rondas de re-definición el par
(acuerdo, κ) no pasa, la taxonomía se declara no-etiquetable sobre titular+bajada y la fase 133 reporta
fracaso* — en vez de un `goto A` sin fondo.

---

#### B4 — Dos clases no son decidibles desde el input, y la propia regla de justificación lo demuestra. `BLOCKER`

**Síntoma.** Los etiquetadores devuelven `ambiguo` en el 28 % de los casos (sobre el 20 % que D-133-A:101
declara como condición de re-adjudicación). O peor: **no** lo devuelven, porque adivinan bien —consultando lo
que saben del mundo— y el clasificador en producción, que no puede consultar nada, falla sistemáticamente en
esas mismas clases. El diagnóstico será "el modelo es malo". La causa será que **el golden se etiquetó con más
información de la que el clasificador va a tener**. Es la lección de ICS reproducida en espejo.

**Causa raíz.** ADJ:61-62:
- `ley_vigente` cede ante `tramitacion_legislativa` "**si hay una modificación en trámite en el Congreso**".
- `agenda_ejecutivo` aplica a una iniciativa que "**aún no** ha ingresado al Congreso".

Ambas condiciones son **estados del corpus**, no del texto. Y D-133-A:52-53 declara explícitamente que la
taxonomía "no nombra sujetos" y que el cruce con boletines es del resolver de 134 — es decir, el clasificador
**por diseño no consulta el corpus**. Se le pide entonces una etiqueta que solo el corpus decide.

La contradicción interna es limpia y verificable: **D-133-C:198-200** exige que cada etiqueta cite un
**fragmento literal** del titular o la bajada. Para una etiqueta cuyo hecho decisorio está fuera del texto,
**no existe fragmento citable**. Por la propia regla, "una etiqueta sin fragmento citable es un rechazo
automático del caso". Las reglas de precedencia 1>3 y 1>4 de D-133-A hacen automáticamente rechazables los
casos que ellas mismas gobiernan.

**Qué cambiar.** **D-133-A** — reescribir las clases 3 y 4 en términos **exclusivamente textuales**, o
fusionarlas:
- `ley_vigente` → definir por marca textual ("ley N.º…", "entra en vigencia", "publicada en el Diario
  Oficial"), **sin** la cláusula "si hay una modificación en trámite" (que se resuelve en 134, con el corpus,
  no en la etiqueta).
- `agenda_ejecutivo` → o bien definir por acto textual del Ejecutivo ("el Presidente anunció/firmó/comprometió")
  **sin** afirmar el estado de ingreso, o bien fusionarla con `politica_no_legislativa` desde ya. La propia
  adjudicación (ADJ:106-107) ya la marca como candidata a fusión si reúne <5 casos — y §B5 muestra que casi
  seguro reunirá <5. Fusionarla **antes** de congelar ahorra una re-congelación.

---

#### B5 — Los umbrales que deciden el milestone no son medibles con 140 casos. `BLOCKER`

**Síntoma.** Reporte de 135: `recall_tramitacion_legislativa = 0,833 (10/12, IC95 ±21 pp)` ⇒ **VETO**, NEWS-05
no entra a producción, el milestone entrega menos de lo prometido — **por un solo ítem**, dentro del ruido. O
al revés: 11/12 = 0,917 ⇒ aprueba, e igual no significa nada.

**Causa raíz — aritmética explícita.** Composición esperada de los 140 casos:

| Estrato | n | Contenido esperado |
|---|---|---|
| N-alea (50) | 50 | Descartados por el pre-filtro ⇒ no contienen **ninguno** de los 30 términos de `VOCABULARIO_LEGISLATIVO` (`prefiltro-lexico.ts:16-47`, que incluye `"ley"`, `"congreso"`, `"diputado"`, `"reforma"`, `"sala"`). Prácticamente todos `no_legislativa`. |
| N-sonda (30) | 30 | Descartados con tokens institucionales (`ministro`, `gobierno`, `Contraloría`…) ⇒ mayoría `politica_no_legislativa`, unos pocos legislativos (el hallazgo que la sonda busca). |
| P (≈60) | 60 | Los que pasan: mezcla real, con farándula por recall-first. |

Reparto por clase, estimación de trabajo:

| Clase | n esperado | ¿supera el piso n=8 de la propia adjudicación (ADJ:143)? | Umbral que la usa |
|---|---|---|---|
| `no_legislativa` | ~65-75 | sí | T5 (medible) |
| `politica_no_legislativa` | ~25-30 | sí | — |
| `tramitacion_legislativa` | **~12** (6-20) | sí, apenas | **T4 ≥ 0,85 (VETO)** |
| `actividad_parlamentaria` | **~10** (5-15) | frontera | ninguno (ver A2) |
| `ambiguo` | ~8-12 | sí | T8 informativo |
| `ley_vigente` | **~3-5** | **NO** | — |
| `agenda_ejecutivo` | **~2-4** | **NO** | — |

Consecuencias, todas verificables contra el propio texto:

1. **T4 es inmedible.** A n=12, los valores alcanzables alrededor del umbral son 0,833 y 0,917. **No existe
   ningún resultado posible cerca de 0,85.** El veto que decide si NEWS-05 va a producción se resuelve por un
   ítem, con IC95 ≈ ±21 pp — más ancho que los ±18 pp que la propia D-133-B:154 declara para n=20-30.
2. **Dos de las seis clases sustantivas nacen bajo el piso de n=8** y, por la regla anti-n-pequeño de
   ADJ:143-144, "se reportan pero no generan umbral bloqueante". Se congelaría una taxonomía en la que **un
   tercio de las clases no puede validarse**.
3. **T3 contradice a D-133-B.** D-133-B:140-141 escribe: "las métricas del golden son **por clase**, jamás
   accuracy global ponderada por la población real". Pero **T3 `exactitud_etiqueta` ES una accuracy global** —
   solo que ponderada por una composición **artificial** (55 % `no_legislativa` fácil por diseño de muestreo).
   Una accuracy global sobre una mezcla inventada no es más honesta que una sobre la población real: es
   *distinta de* honesta.

**Qué cambiar.**
- **D-133-B** — el diseño de muestreo debe garantizar los n que los umbrales necesitan, no descubrirlos.
  Añadir un **estrato P-dirigido**: si al cerrar la ventana `tramitacion_legislativa` o
  `actividad_parlamentaria` tienen n < 25, se completan con casos adicionales del pool de `noticia` de la
  ventana o del snapshot de fixtures (`packages/news/src/__fixtures__/*.xml`), declarando el sobre-muestreo.
  Con n=25 el IC95 baja a ~±14 pp y 0,85 pasa a tener valores alcanzables a su alrededor.
- **D-133-D** — (a) T3 se redefine como **macro-promedio de exactitud por clase sobre las clases con n≥8**,
  no como accuracy global; (b) T4 se re-expresa con su n mínimo requerido: *"recall ≥ 0,85 medido sobre
  n ≥ 25; si n < 25, T4 no veta y se reporta como no-medido"* — que es lo mismo que la adjudicación ya hace
  para las clases pequeñas, aplicado con consistencia a su propio umbral rector.
- **D-133-A** — fusionar `agenda_ejecutivo` **antes** de congelar (ver B4), en vez de después.

---

#### B6 — El pre-filtro ve 600 caracteres y el golden guarda 300. `HIGH`

**Síntoma.** Un caso del golden tiene `prefiltro: {paso: true, terminos: ["tramitacion"]}` y una `entrada_llm`
donde la palabra "tramitación" **no aparece** — quedó fuera del corte de 300. El etiquetador no puede citar el
fragmento que exige D-133-C:198-200. El clasificador de 135 falla ese caso, correctamente, porque la evidencia
no está en su input. El golden penaliza al modelo por información que le fue amputada.

**Causa raíz.** `prefiltro-lexico.ts:50` `const LIMITE_DESCRIPCION = 600` vs ADJ:381-383 `entrada_llm`
truncada a **300 chars por campo**. La adjudicación afirma medir "el PIPELINE COMPLETO" (ADJ:115) sobre una
entrada única, cuando sus dos etapas operan sobre **ventanas de texto distintas**. Agravante: el 300 carga tres
requisitos incompatibles a la vez —límite anti-prompt-injection, límite de cita por copyright, y ventana de
señal para clasificar— y la propia adjudicación reconoce en ADJ:421-422 que puede "destruir la señal", pero lo
deja como refutación *a posteriori*. Es orden de operaciones al revés: si el 300 resulta insuficiente
**después** del etiquetado, subirlo cambia `entrada_llm`, cambia el hash de `golden-set.json` y obliga a
**re-etiquetar los 140 casos**.

**Qué cambiar.** **D-133-F** — (a) alinear el truncado del golden con `LIMITE_DESCRIPCION = 600` del pre-filtro,
o justificar por escrito por qué difieren; (b) **validar el límite ANTES de etiquetar**, con un chequeo barato
y determinista: contar cuántos de los casos P tienen todos sus `prefiltro.terminos` presentes dentro de
`entrada_llm`. Si la cobertura es < 95 %, el límite sube antes de que se etiquete nada. Ese chequeo cuesta
minutos y evita re-etiquetar 140 casos.

---

#### B7 — La fase no puede completarse hoy: dos de sus tres días no existen. `HIGH`

**Síntoma (hora 3).** El ejecutor termina el andamiaje —`taxonomia.ts`, el script de canonicalización, el
`.gitattributes`— y se topa con que el golden set requiere datos del 2026-08-06 y 2026-08-07. Hoy es
**2026-08-05**. La fase queda bloqueada ≥48 h de wall-clock, y el checkpoint de operador (que por D-133-A debe
ocurrir **antes de medir**) se queda sin objeto que firmar: el golden no existe.

**Causa raíz.** ADJ:129 fija la ventana "2026-08-05 a 2026-08-07" y ADJ:132 admite "costo de wall-clock: 2
días, que se solapan con la planificación de 134" — pero el ROADMAP declara **134 `Depends on: Phase 133`**
(`.planning/ROADMAP.md:229`). El solapamiento propuesto es con una fase que, por contrato, no puede empezar.

**Qué cambiar.** **D-133-B** — separar la fase en dos actos con firma independiente:
**133-a** (hoy, sin datos nuevos): taxonomía, canonicalización, `.gitattributes`, guard de copy (A3), esquema
del caso golden, `thresholds.json` — **todo lo congelable sin muestra**, más la firma del operador sobre la
taxonomía y los umbrales, que es la firma que de verdad tiene que ocurrir antes de medir.
**133-b** (a partir del 08-07): construcción, etiquetado, arbitraje y congelación del golden.
Así el checkpoint valioso ocurre hoy y no se compra un bloqueo de 48 h.

---

#### B8 — El hash se mueve solo la primera vez. `MEDIUM`

**Síntoma.** `congelado.test.ts` pasa en la máquina del ejecutor y falla en CI (o al revés) sin ningún cambio
de contenido.

**Causa raíz.** **No existe `.gitattributes` en ningún punto del repositorio** (verificado). D-133-E:326-328 lo
da por un ajuste menor, pero: (a) hay que crearlo desde cero; (b) crearlo *después* de commitear los JSON exige
`git add --renormalize` o el índice conserva CRLF y el hash se mueve; (c) el patrón propuesto cubre
`packages/news/src/eval/*.json` y **no** cubre subdirectorios futuros; (d) `CONGELADO.md` —donde vive la firma
del operador y el log de cambios— **no está hasheado por nada**, así que el log que "delata el drift"
(ADJ:337-338) es él mismo editable sin dejar rastro.

**Qué cambiar.** **D-133-E** — la primera tarea del plan es crear `.gitattributes` con patrón
`packages/news/src/eval/**/*.json text eol=lf`, correr `git add --renormalize`, y **demostrar la estabilidad
del hash con un control positivo**: clonar limpio en un segundo directorio y verificar que los tres sha256
coinciden. Un hash cuya estabilidad se asume es peor que no tener hash (lo dice la propia D-133-E:354-356; solo
falta ejecutarlo como tarea, no como esperanza).

---

#### B9 — D-133-D contradice un Success Criterion LOCKED de la Phase 134. `BLOCKER`

**Síntoma.** Al planificar 134, el planner encuentra dos contratos incompatibles y elige uno en silencio.

**Causa raíz.** Verbatim:
- `133-ADJUDICACION.md:268-269` — "el LLM **jamás** emite el número de boletín ni el nombre resuelto; eso lo
  hace `extraerBoletines` context-gated fail-closed en la Phase 134."
- `.planning/ROADMAP.md:232` (SC1 de 134, LOCKED) — "**El LLM emite boletín/nombre de la lista cerrada
  inyectada en el prompt** (3.675 boletines / 186 parlamentarios; jamás un id)."

El ROADMAP describe una arquitectura de **allowlist inyectada + emisión restringida + resolver que mapea**;
D-133-D describe una arquitectura de **LLM sin contacto con identificadores + extracción puramente
determinista**. No son la misma. La segunda es más segura, pero **133 no es la fase que puede cambiar el SC de
134**.

Agravante arquitectónico no declarado: `extraerBoletines` vive en **`app/lib/boletin-en-materia.ts:58`**, no en
`packages/`. Su segundo fail-closed es la RPC `lobby_menciones_de_boletin`
(`boletin-en-materia.ts:29-33`). "Reusarlo sin reescribirlo" desde el carril news invierte la dirección de
dependencia del monorepo (`app` → `packages`, nunca al revés). La adjudicación afirma el reuso y no dice cómo.

**Qué cambiar.** **D-133-D** — borrar la frase que redefine el contrato de 134 y sustituirla por la única
afirmación que a 133 le corresponde: *"la taxonomía no nombra sujetos; el vínculo a boletines y personas es de
134 bajo su propio SC LOCKED"*. Si el operador **quiere** la arquitectura más estricta, eso es una **enmienda
explícita al SC1 de la Phase 134**, firmada como tal, no un párrafo dentro de la adjudicación de 133.

---

#### B10 — La aprobación de Granite se extrapola de dominio. `MEDIUM`

ADJ:266-270 trata "Granite APPROVED solo clasificación" (veredicto full-40 de v11.0) como cobertura suficiente
para clasificar **prensa chilena**. El veto del mismo veredicto fue **por es-CL** — jerga, nombres, giros
locales — que es precisamente lo que tiene un titular de La Cuarta. "Es clasificación, luego está aprobado"
confunde la **tarea** con el **dominio**.

**Qué cambiar.** **D-133-D** — mantener a Granite como candidato (correcto), pero escribir que **la aprobación
de v11.0 no se transfiere de dominio**: en 135 Granite se mide contra el golden como cualquier otro candidato,
y el veredicto que vale es el computado sobre prensa, no el heredado.

---

## 3. Veredicto

### `PREMORTEM: 8 BLOCKERS`

| # | Blocker | Decisión a cambiar | Bloque |
|---|---|---|---|
| **BL-1** | La adjudicación no decide si la etiqueta se muestra; T3 = 0,80 significa 1 de cada 5 etiquetas públicas falsa, sin fuente, fecha ni incertidumbre — contradice el valor core. | **D-133-A** (contrato de display + `glosa_publica`) y **D-133-D** | A |
| **BL-2** | `actividad_parlamentaria` es la única clase que aterriza en la ficha de una persona y la única sin umbral; la red de seguridad que D-133-D invoca (resolver ⇒ `null`) no existe para ella. | **D-133-D** (añadir T9 `precision_actividad_parlamentaria ≥ 0,90`) + cuota de estrato en **D-133-B** | A |
| **BL-3** | Importar el copy desde `packages/news` (ordenado por D-133-A:74-77) **bypassea estructuralmente** el linter anti-insinuación, anclado a `APP_ROOT` con allowlist y skip silencioso. | **D-133-A** (guard de copy propio del paquete + prueba de mutación) | A |
| **BL-4** | Taxonomía, umbrales, tasa de error y limitaciones **no se publican al ciudadano**; la honestidad de D-133-B vive en un `.md` interno. | **D-133-B** + **D-133-E** (artefacto público como entregable de 137) | A |
| **BL-5** | `ley_vigente` y `agenda_ejecutivo` exigen hechos del corpus ausentes del input — y la regla del fragmento literal (D-133-C:198-200) las vuelve auto-rechazables. | **D-133-A** (redefinir textualmente o fusionar `agenda_ejecutivo` ya) | A+B |
| **BL-6** | κ entre **dos Sonnet** es auto-consistencia disfrazada de acuerdo inter-anotador: falso verde estructural sobre la métrica que esta fase existe para producir. | **D-133-C** (modelos distintos + calibración humana ciega de ~20 casos) | B |
| **BL-7** | Cap 25 vs acuerdo ≥0,80 se **contradicen** a n>125; y el "vuelve a D-133-A" es un bucle sin condición de salida ni presupuesto. | **D-133-C** (cap = presupuesto, no puerta; escribir la refutación del protocolo) | B |
| **BL-8** | T4 es **inmedible** a n≈12 (solo 0,833 / 0,917 alcanzables); 2 de 6 clases nacen bajo el piso n=8; T3 es una accuracy global que **D-133-B prohíbe explícitamente**. Además D-133-D contradice el SC1 LOCKED de la Phase 134. | **D-133-B** (estrato dirigido), **D-133-D** (T3 macro-promedio, T4 con n mínimo, borrar la redefinición de 134) | B |

**No bloqueantes pero a corregir en el plan:** B1 (proyección lineal del golden ignora el dedup D-13 y el
arranque en frío), B6 (600 vs 300 chars), B7 (dos de los tres días no existen ⇒ partir la fase en 133-a/133-b),
B8 (`.gitattributes` inexistente + `--renormalize` + control positivo del hash), B10 (Granite: no extrapolar de
dominio).

**Lo que la adjudicación acierta y no hay que tocar** (para que la refutación no se lea como demolición):
- La sección "Lo que este golden NO permite afirmar" (D-133-B:146-159) es lo mejor del documento; el problema
  es su destinatario, no su contenido.
- La pre-registración de la hipótesis y la condición de refutación (D-133-D:272-291), incluida la cláusula de
  que bajar el umbral tras ver el número no es salida válida.
- Rechazar la taxonomía temática con la evidencia de `sector_id` al 1,8 %.
- Incluir descartados en el golden para que el modo de fallo permanente del pre-filtro recall-first sea visible.
- Puntero **Y** payload, con la jerarquía "el golden es la vara, el parser es lo que se mueve".
- Hashear la proyección canónica y no el `.ts`.

---

## 4. Lo que el operador debería firmar DISTINTO

La adjudicación pone cinco cosas en el checkpoint (ADJ:455-476). Mi revisión cambia **qué** se firma, **cuándo**
y **en qué orden**.

**1. Primero, una pregunta que la adjudicación no le hace: ¿la etiqueta se le muestra al ciudadano, sí o no?**
Es la decisión rectora de esta fase y no está en el documento. Todo lo demás cuelga de ella: si la etiqueta es
interna, T3 = 0,80 es defendible y BL-1/BL-4 se reducen mucho; si es pública, 0,80 es inaceptable sin
declaración de incertidumbre visible, y hacen falta la `glosa_publica`, el guard de copy del paquete y la
página "Cómo clasificamos". **No se puede firmar el umbral sin haber firmado esto.**

**2. La taxonomía, pero con `agenda_ejecutivo` ya fusionada y las clases 3/4 redefinidas en términos
textuales.** Firmar hoy las clases tal como están es firmar dos clases que el golden no podrá validar (n<8) y
una regla de precedencia que la propia regla de justificación vuelve inaplicable. Es una re-congelación
garantizada dentro de dos semanas.

**3. Los umbrales, pero con T9 incluido y con T3/T4 re-expresados.** Firmar T1-T5 tal como están es firmar que
la clase con exposición reputacional queda sin vara (BL-2) y que el veto rector se decide por un ítem (BL-8).
El operador debería firmar seis vetos, no cinco, y cada uno con su **n mínimo declarado al lado**.

**4. El protocolo de etiquetado con dos modelos DISTINTOS y con 20 casos etiquetados por él a ciegas ANTES de
ver nada.** Esos 20 casos son media hora y son la diferencia entre un κ interpretable y un número decorativo.
Es, además, el mismo patrón de "control positivo apareado" que este repo ya aprendió a exigir.

**5. Partir la fase en 133-a y 133-b, y firmar 133-a hoy.** La ventana declarada termina el 08-07: hoy no hay
golden que firmar. Lo que **sí** se puede congelar y firmar hoy es taxonomía + umbrales + formato + guard, que
es exactamente lo que tiene que estar firmado *antes de medir*. Firmar el golden viene después, y viene con sus
números de κ, n por clase e IC a la vista.

**6. Lo que NO debería firmarse aquí en absoluto:** la frase de D-133-D que redefine quién emite el boletín en
la Phase 134 (BL-9/B9). Si el operador quiere esa arquitectura —y es la más segura— corresponde una **enmienda
explícita al SC1 de la Phase 134**, con su propio texto y su propia firma. Una adjudicación de 133 no puede
cambiar en un párrafo lateral un Success Criterion LOCKED de otra fase; ese es exactamente el mecanismo por el
que un requisito se pierde sin que nadie lo decida.

**7. Sobre la ratificación de la sustitución (ADJ:472-476):** la adjudicación pide ratificar que la escribió
Opus en lugar de Fable. Mi recomendación es **ratificar la sustitución** —el documento es serio y sus aciertos
son reales— **y revocar seis de sus decisiones en los puntos anteriores**. Esperar a que Fable tenga créditos
para re-adjudicar de cero desperdiciaría el trabajo bueno; aceptarla entera propagaría ocho defectos a 134, 135
y 137.

---

*Phase 133 — NEWS-TAXO · Premortem escrito 2026-08-05. No modifica `133-ADJUDICACION.md`.*
