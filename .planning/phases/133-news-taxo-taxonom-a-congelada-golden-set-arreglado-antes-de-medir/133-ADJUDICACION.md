# Phase 133 — NEWS-TAXO · ADJUDICACIÓN

**Fecha:** 2026-08-05
**Fase:** 133 — NEWS-TAXO (taxonomía congelada + golden set arreglado ANTES de medir)
**Requirements:** NEWS-03 (alimenta NEWS-04 en 134 y NEWS-05 en 135)
**Estado:** ADJUDICADO — pendiente de ratificación del operador en el checkpoint de esta fase

---

## AVISO DE SUSTITUCIÓN

El régimen v13.0 LOCKED del operador asigna las decisiones a **Fable**. **Fable quedó sin créditos de
uso hoy (2026-08-05), así que esta adjudicación la hace Opus en sustitución.** Esto **NO es una
aprobación por silencio**: toda esta adjudicación entra al checkpoint de operador de esta fase (la
firma del golden set ANTES de medir) para que el operador la **ratifique o revoque**. Mientras no
haya firma explícita, ninguna de estas decisiones es LOCKED — son propuestas adjudicadas con razón
escrita, no hechos consumados.

---

## HECHOS SOBRE LOS QUE SE DECIDE (medidos hoy, PROD)

| Hecho | Valor |
|---|---|
| `noticia` (pasaron pre-filtro) | **25 filas** |
| `noticia_url_vista` | **245 filas** = 220 `descarta/prefiltro_lexico` + 25 `pasa` |
| Reparto de las 25 | latercera **18**, lacuarta **7** |
| Outlets con 0 ítems que pasan | biobiochile, cooperativa, exante (sí aportaron crudo) |
| Crudos en R2 | 5 XML en `news/rss-<slug>/2026-08-05/<sha256>.xml` — 245 ítems re-parseables sin red |
| Pre-filtro | RECALL-FIRST por D-06 (deja pasar falsos positivos a propósito) |
| Falsos positivos observados | farándula ("Marité Matus…", "Cony Capelli…") junto a Megarreforma y Ley de Lobby |
| Corpus | 3.675 boletines, 186 parlamentarios |
| Veredicto v11.0 vigente | Granite **APPROVED solo clasificación**; extracción **VETADA** por es-CL |

Las dos lecciones pagadas de Is Chile Safe que gobiernan esta fase:
1. **El techo de 65,9 % era de ETIQUETAS, no de modelo** (§4 del research). ⇒ el golden se arregla
   antes de medir, y su calidad se demuestra, no se asume.
2. **"Production incidents store only processed output ⇒ no sirven como golden inputs re-runnables"**
   ⇒ el caso golden guarda lo que el LLM VE, no lo que emitió.
Y la deuda ajena a no repetir (§9): *la definición formal de las familias vivía en el frontend TS,
lejos del clasificador Python.*

---

## D-133-A — LA TAXONOMÍA LEGISLATIVA

### Decisión

**Congelar UN eje mono-etiqueta de 6 clases sustantivas + 1 clase de escape, con precedencia
determinista para el desempate.** La taxonomía clasifica **el hecho que la noticia informa**, jamás
la intención de un actor ni un efecto causal. La taxonomía **NO nombra sujetos**: qué boletín y qué
parlamentario están involucrados es trabajo del resolver determinista de la Phase 134, no de la
etiqueta.

Etiquetas (literales, español, snake_case), en **orden de precedencia** (gana la primera que aplique):

| # | Etiqueta | Definición operativa (una línea) | Frontera — qué NO cae aquí |
|---|---|---|---|
| 1 | `tramitacion_legislativa` | La noticia informa un hecho ocurrido en la tramitación de una o más iniciativas en el Congreso: ingreso, comisión, sala, votación, indicación, urgencia, veto, despacho, requerimiento al TC. | Anuncios del Ejecutivo que aún no ingresan (→ 4). Normas ya publicadas (→ 3). Opinión de un parlamentario sobre un proyecto sin hecho de tramitación (→ 2). |
| 2 | `actividad_parlamentaria` | La noticia trata de la actuación pública de uno o más parlamentarios en ejercicio: declaraciones, comisiones investigadoras, lobby y audiencias, patrimonio e intereses, ética y sanciones, asistencia. | Un parlamentario mencionado solo como fuente de una cita sobre otro tema (→ la clase del tema). Candidatos que no son parlamentarios en ejercicio (→ 5). |
| 3 | `ley_vigente` | La noticia trata de una norma ya promulgada o publicada y su aplicación, reglamento, entrada en vigencia o efectos. | Si hay una modificación en trámite en el Congreso, gana 1. |
| 4 | `agenda_ejecutivo` | El Poder Ejecutivo anuncia, compromete o firma una iniciativa legislativa que **aún no** ha ingresado al Congreso, o anuncia urgencias sin hecho de tramitación consumado. | Si el texto informa el **ingreso** al Congreso, gana 1. |
| 5 | `politica_no_legislativa` | Política contingente sin hecho legislativo ni actuación parlamentaria: elecciones, partidos, gabinete, encuestas, municipios, tribunales no-TC. | Nada del Congreso ocurre en el hecho. |
| 6 | `no_legislativa` | Todo lo demás: farándula, deportes, policial, internacional, economía, servicio. **Se espera que sea la mayoría.** | — |
| 7 | `ambiguo` | El **titular + descripción del RSS** no alcanzan para decidir entre dos clases. No es "no sé": es "la evidencia disponible no basta". | Si una lectura razonable resuelve, NO es ambiguo. |

**Mono-etiqueta** (una y solo una por ítem). *Razón:* multi-etiqueta multiplica el espacio de
desacuerdo entre etiquetadores y hace incomparable cualquier métrica de exactitud con n≈120; y el
producto no necesita multi-etiqueta — necesita saber si esta noticia se cuelga de una ficha de
proyecto (1, 3, 4), de una ficha de parlamentario (2) o de ninguna (5, 6). La precedencia
1>2>3>4>5>6 hace el desempate **determinista y auditable**, que es lo que multi-etiqueta compra a
un costo mucho mayor.

**Single source of truth:** `packages/news/src/eval/taxonomia.ts` — array congelado con etiqueta,
definición y frontera, exportado. **El prompt del clasificador de 135 se CONSTRUYE desde ese módulo**
(la lista cerrada se serializa desde el mismo array), y cualquier superficie UI de 137 importa de
ahí. Prohibido re-escribir las etiquetas a mano en el prompt o en el frontend.

### Razón (por qué esta y no la alternativa obvia)

La alternativa obvia era una **taxonomía temática** (salud, seguridad, pensiones, tributario…),
espejo de las familias CEAD de ICS. Se rechaza por tres motivos medidos:
- El producto ya tiene eje temático y **murió por datos**: el tile de materia se descartó en v13.0
  porque `sector_id` cubre el 1,8 % del corpus. Una taxonomía temática sobre prensa no se podría
  cruzar con nada.
- El objetivo declarado es **vincular prensa a proyectos y parlamentarios**. El eje que sirve a eso
  es "qué tipo de hecho institucional se informa", no "de qué habla".
- ICS pagó exactamente ese error: su taxonomía era **heredada de un organismo externo** (CEAD) y no
  del uso; el resultado fue un techo de 65,9 % que era de etiquetas.

La segunda alternativa era **binario legislativo/no-legislativo**. Se rechaza porque colapsa la
distinción que el producto necesita (ficha de proyecto vs ficha de parlamentario) y porque un
binario no aporta nada sobre el pre-filtro léxico que ya existe — el LLM no se pagaría a sí mismo.

`ambiguo` existe como etiqueta de primera clase porque **solo tenemos titular + descripción**
(el full-text es privado por copyright, §8). Fingir que 300 caracteres siempre bastan es fabricar
etiquetas — el pecado exacto de ICS.

### Qué la refutaría

- Que en el etiquetado (D-133-C) más del **20 % de los casos caiga en `ambiguo`**: significaría que
  las fronteras están mal trazadas o que el insumo (titular+bajada) no soporta este eje ⇒ la
  taxonomía se re-adjudica antes de congelar.
- Que `actividad_parlamentaria` y `tramitacion_legislativa` concentren el desacuerdo
  inter-etiquetador: la frontera 1/2 sería ficticia y habría que fusionarlas.
- Que `agenda_ejecutivo` reúna <5 casos en el golden: sería una clase inventada por simetría, y se
  fusiona en `politica_no_legislativa` antes de congelar.

---

## D-133-B — EL GOLDEN SET

### Decisión

**El golden mide el PIPELINE COMPLETO (pre-filtro léxico + clasificador), no el clasificador solo.**
En consecuencia **incluye ítems que el pre-filtro descartó**.

Composición congelada:

| Estrato | Origen | n objetivo | Selección |
|---|---|---|---|
| **P — pasaron el pre-filtro** | `noticia`, ventana completa | **censo: TODOS** (≈25 del día 1, ≈60-80 con la ventana de 3 días) | sin muestreo — son pocos y son el núcleo |
| **N-alea — descartados, aleatorios** | `noticia_url_vista` estado `descarta` | **50** | muestreo aleatorio con **semilla fija documentada** sobre `url_hash` ordenado |
| **N-sonda — descartados, dirigidos** | ídem | **30** | descartados cuyo titular contiene tokens institucionales **fuera** del vocabulario congelado (`ministro`, `gobierno`, `La Moneda`, `Contraloría`, `presidente`, `subsecretari`, `oficialismo`, `oposición`) — **sonda de falso negativo del pre-filtro** |

**Tamaño objetivo: 140 casos. Piso duro: 100.** ICS usó 47; 140 es ~3× y sigue siendo etiquetable a
mano en una sesión.

**Ventana temporal: 3 días hábiles (2026-08-05 a 2026-08-07).** Costo en red: **5 requests/día × 3
días = 15 requests totales**, con el rate-limit 2-3 s/host, robots y hash-check que el conector de
132 ya aplica por construcción — es la corrida normal del conector, **no una corrida extra**. Costo
de wall-clock: **2 días**, que se solapan con la planificación de 134. Si al día 3 biobiochile /
cooperativa / exante siguen aportando cero ítems que pasen, **eso se declara como hallazgo del
pre-filtro y se sigue** — no se ablanda el pre-filtro para conseguir muestra (prohibición ya escrita
en `prefiltro-lexico.ts:6-9`).

**Proporción positivos/negativos ≈ 1:1,3** (≈60-80 P vs 80 N). *No* se busca reproducir la
proporción poblacional real (25:220 ≈ 1:9): con esa proporción, un clasificador que dijera
`no_legislativa` a todo sacaría 90 % y el umbral sería una farsa. Se sobre-muestrea la clase rara
deliberadamente y **se declara**: las métricas del golden son **por clase**, jamás accuracy global
ponderada por la población real.

**Regla anti-n-pequeño:** toda etiqueta con **menos de 8 casos** en el golden se **reporta** pero
**no genera umbral bloqueante**. Medir accuracy sobre n=2 es teatro.

### Lo que este golden NO permite afirmar (honestidad estadística, obligatorio en el reporte de 135)

1. **Nada sobre generalización a otros outlets.** El estrato P proviene de facto de 2 outlets
   (latercera, lacuarta). No se puede afirmar rendimiento en biobiochile, cooperativa ni exante.
2. **Nada sobre estabilidad temporal.** 3 días hábiles de una semana. Un receso legislativo, una
   semana distrital o una jornada de votación de reforma cambian radicalmente la mezcla. No se puede
   afirmar que el número se sostiene en el tiempo.
3. **Intervalos de confianza.** A n≈140, una exactitud puntual de 0,85 tiene un IC95 aproximado de
   **±6 pp**; por clase (n≈20-30) el IC se abre a **±18 pp**. **Toda cifra del reporte de 135 se
   publica con su n y su IC**, jamás pelada. Una diferencia de <6 pp entre dos modelos **no es una
   diferencia** — el desempate va por costo (D-133-D).
4. **Nada sobre el recall real del pre-filtro.** El estrato N-sonda es una **sonda**, no una
   estimación: encuentra falsos negativos si los hay, pero no mide cuántos hay.
5. **Nada sobre clases con <8 casos.**

### Razón

La alternativa obvia era **"solo los 25 que pasaron"**. Se rechaza: mediría el clasificador sobre un
insumo ya filtrado y dejaría **el pre-filtro sin vara** — y el pre-filtro es recall-first por decisión
LOCKED, o sea que su modo de fallo (falso negativo) es **permanente e invisible**: nadie vuelve a
scrapear el feed de anteayer. Un golden que no puede ver ese fallo es un golden ciego en el punto
exacto donde el daño es irreversible.

La otra alternativa era **esperar 2-3 semanas de RSS** para tener muestra multi-outlet y
multi-contexto. Se rechaza por costo de wall-clock: bloquearía 134, 135, 136 y 137 — el milestone
entero — para comprar precisión que igual habría que declarar limitada. La respuesta correcta al
sesgo no es esperar hasta que desaparezca, sino **declararlo con números** (arriba) y dejar el
golden **ampliable por diseño**: `golden-set.json` es una lista de casos con procedencia; ampliarlo
en un milestone futuro es aditivo y re-congelable.

### Qué la refutaría

- Que el estrato N-sonda arroje **más de 5 falsos negativos del pre-filtro** (noticias legislativas
  reales que el pre-filtro descartó): el problema urgente no sería el clasificador sino el
  vocabulario, y la Phase 133 tendría que ampliar `VOCABULARIO_LEGISLATIVO` (solo se AMPLÍA, nunca se
  poda) antes de medir nada.
- Que la ventana de 3 días no llegue a **100 casos** (piso duro): habría que extender la ventana,
  documentando los requests adicionales.

---

## D-133-C — EL PROTOCOLO DE ETIQUETADO

### Decisión

**Doble etiquetado independiente + arbitraje humano acotado, con justificación literal por caso.**

1. **Etiquetadores:** dos agentes Sonnet independientes (skill `sonnet-swarm`, sin costo API), cada
   uno con las definiciones de `taxonomia.ts` y el caso, **sin ver la etiqueta del otro** y sin ver
   ninguna salida del clasificador. **Prohibición dura: los etiquetadores NO pueden ser el mismo
   modelo ni el mismo prompt que se evaluará en 135.** Si lo fueran, el golden mediría
   auto-consistencia y el número sería circular por construcción.
2. **Justificación obligatoria por caso:** cada etiquetador emite `{etiqueta, justificacion}` donde
   `justificacion` (≤200 chars) **cita el fragmento literal** del titular o la descripción que
   sostiene la etiqueta. Una etiqueta sin fragmento citable es un rechazo automático del caso.
   *Esto es lo que SC2 llama "la revisión documentada por caso".*
3. **Acuerdo:** si ambos coinciden, el caso queda `resuelto_por: "acuerdo"` con ambas
   justificaciones conservadas (dos razones concordantes valen más que una).
4. **Desacuerdo → operador, nunca un tercer modelo.** Un tercer agente desempatando convertiría la
   decisión difícil en un voto de máquinas, que es exactamente donde ICS perdió sus etiquetas.
   **Cap: máximo 25 casos escalados al operador.** Si el desacuerdo supera 25 casos, **se detiene el
   etiquetado**: no es un problema de casos difíciles, es que las fronteras de la taxonomía están mal
   trazadas ⇒ vuelve a D-133-A.
5. **Métrica de calidad de la etiqueta (la vara sobre la vara):** se calcula y se publica el
   **acuerdo bruto inter-etiquetador** y **Cohen's κ**. Umbrales de proceso, congelados aquí:
   - acuerdo bruto **≥ 0,80** y **κ ≥ 0,65** ⇒ el golden es utilizable.
   - por debajo ⇒ **el golden no se congela**; se re-escriben las definiciones y se re-etiqueta.
   Este es el antídoto explícito al pecado de ICS: *antes de culpar al modelo por un techo, se
   demuestra que las etiquetas no son el techo.*
6. **Ambiguos:** `ambiguo` es una etiqueta legítima, no un descarte. Los casos `ambiguo` **se
   conservan en el golden**, **se excluyen del denominador de exactitud** y **se reportan aparte**
   como `tasa_ambiguo_humano`. En 135 se mide además si el modelo declara `ambiguo` donde el humano
   lo hizo (concordancia en la incertidumbre) — informativo, no bloqueante.

**Registro por caso (campos obligatorios):** `etiqueta`, `justificacion_a`, `justificacion_b`,
`etiqueta_a`, `etiqueta_b`, `acuerdo` (bool), `resuelto_por` (`acuerdo` | `operador`),
`revisado_en` (fecha ISO).

### Razón

La alternativa obvia era **un solo etiquetador (agente o humano) revisado por muestreo**. Se rechaza
porque **no produce ninguna medida de la calidad de la etiqueta** — y esa medida es literalmente el
entregable diferenciador de esta fase. Sin κ, "el golden está revisado" es una afirmación de fe, la
misma que ICS pudo hacer sobre sus 47 casos hasta que un spike descubrió que gs-001..003 estaban
mal etiquetados.

Etiquetar 140 casos a mano por el operador se rechaza por costo de operador (es el recurso más
escaso del proyecto); el diseño lo reduce a **≤25 arbitrajes**, que es una sesión corta y toca solo
los casos donde su criterio importa.

### Qué la refutaría

- κ < 0,65 con acuerdo bruto alto: señal de que una clase domina y el acuerdo es trivial ⇒ el
  balance del set está mal.
- Que el operador, al arbitrar, **discrepe de ambos etiquetadores en >8 de los 25 casos**: los
  etiquetadores comparten un sesgo sistemático y el doble etiquetado no lo detecta ⇒ hay que
  re-instruirlos y re-correr, no parchar caso a caso.

---

## D-133-D — LOS THRESHOLDS PRE-REGISTRADOS

### Decisión

**Congelar antes de la primera medición** (`thresholds.json`, hash en `CONGELADO.md`):

| # | Métrica | Umbral | Efecto | Justificación |
|---|---|---|---|---|
| T1 | `tasa_etiqueta_fuera_de_lista` | **= 0,00** | **VETO inmediato** | Es contrato, no calidad. ICS: `"robos_ violentos"` con espacio por artefacto de tokenizer, y `json_object` NO lo arregló. Cualquier etiqueta fuera del array congelado veta al modelo sin importar el resto. |
| T2 | `tasa_parse_fallido` | **≤ 0,02** | **VETO** | ICS midió Granite 0 % y DeepSeek 4,26 %. 2 % deja margen sobre el 0 % observado y excluye al que falla 1 de cada 23. |
| T3 | `exactitud_etiqueta` (casos no-`ambiguo`) | **≥ 0,80** | **VETO** | ICS: 100 % en el eje de lista cerrada (comuna) y 65,9 % en el eje semántico (familia) **con etiquetas rotas**. Con la taxonomía arreglada, 6 clases (menos que las 7-8 familias CEAD) y un eje institucional más nítido que uno temático, 0,80 es exigente pero alcanzable. **Debajo de 0,80 el clasificador no aporta sobre el pre-filtro** y no vale su costo ni su riesgo. |
| T4 | `recall_tramitacion_legislativa` | **≥ 0,85** | **VETO** | Es la clase que alimenta el producto. Asimetría dura: un **falso positivo** lo mata el resolver de 134 (boletín `null` ⇒ dead-letter, nada se publica); un **falso negativo** no lo recupera nadie. Por eso se exige recall alto en esta clase y no precisión. |
| T5 | `precision_no_legislativa` | **≥ 0,90** | **VETO** | De lo que el modelo mandó a la basura, el 90 % debe ser basura. Protege contra el modo de fallo silencioso de descartar noticias buenas. |
| T6 | `costo_usd_por_100_items` | **≤ 0,05** | informativo | Referencia ICS: Granite $0,05/$1M in. No veta; **desempata**. |
| T7 | `latencia_p50_ms` | **≤ 5.000** | informativo | Referencia ICS: Granite ~1.380 ms, DeepSeek 3.695 ms. No veta; desempata. |
| T8 | `tasa_ambiguo_modelo` vs `tasa_ambiguo_humano` | — | informativo | Concordancia en la incertidumbre. Se reporta, no bloquea. |

**Regla de elección entre modelos que aprueben (congelada):** gana el de **menor T6**; si la
diferencia de `exactitud_etiqueta` entre dos candidatos es **< 6 pp** se consideran **empatados**
(está dentro del IC95 a n≈140 — D-133-B punto 3) y decide el costo; a costo empatado, decide T4.

**Veredicto v11.0 aplicado:** Granite es **candidato legítimo** aquí — esto ES clasificación, y su
aprobación cubre exactamente eso. La **extracción sigue VETADA**: el LLM **jamás** emite el número de
boletín ni el nombre resuelto; eso lo hace `extraerBoletines` context-gated fail-closed en la Phase
134. La taxonomía y el resolver son piezas separadas por esta razón.

### Anti-circularidad — qué REFUTARÍA la hipótesis

**Hipótesis pre-registrada:** *"Un LLM de bajo costo puede etiquetar prensa chilena en la taxonomía
congelada con calidad suficiente para colgar noticias de fichas de proyecto y parlamentario."*

**La hipótesis queda REFUTADA si**, tras medir todos los candidatos del `TieredProvider`:
- ningún modelo alcanza T3 ≥ 0,80; **o**
- ningún modelo alcanza T4 ≥ 0,85; **o**
- el mejor modelo aprueba T3/T4 pero viola T1 (etiqueta fuera de lista).

**Consecuencia escrita ANTES de medir:** en caso de refutación, **NEWS-05 no entra a producción por
defecto ni por silencio**. Las salidas honestas, en este orden, son: (a) publicar solo el vínculo
determinista — noticias cuyo texto contiene un boletín explícito reconocido por `extraerBoletines` —
**sin etiqueta**; o (b) declarar la fase 135 fallida y reportarlo. **No es salida válida** bajar el
umbral después de ver el número.

**Regla de congelación del umbral:** modificar `thresholds.json` después de la primera medición
registrada en 135 exige (1) firma explícita del operador, (2) entrada en `CONGELADO.md` con el hash
anterior, y (3) que **el reporte cite AMBOS números** — el que se pre-registró y el que se aplicó.
Un umbral movido en silencio es fraude metodológico, y esta cláusula lo hace visible.

### Razón

El número 0,80 no es arbitrario ni heredado: se ancla en que el eje de lista cerrada de ICS dio
100 % y el semántico 65,9 % **con etiquetas defectuosas**. Nuestra taxonomía se arregla primero
(D-133-C lo demuestra con κ), y el eje es más nítido, así que exigir un punto medio alto es
razonable. La alternativa obvia — **fijar el umbral tras un piloto** — es exactamente la
circularidad que `clustering.py:66-78` de ICS documentó y evitó, y cuya práctica el research marcó
como *"vale copiar literalmente"*.

---

## D-133-E — EL FORMATO DE CONGELACIÓN

### Decisión

Artefactos, todos bajo **`packages/news/src/eval/`** (junto al clasificador, jamás en el frontend):

| Archivo | Rol | ¿Hasheado? |
|---|---|---|
| `taxonomia.ts` | **Fuente de verdad ejecutable**: etiquetas + definiciones + fronteras + precedencia. | no (se hashea su proyección) |
| `taxonomia.json` | Proyección canonicalizada de `taxonomia.ts`, **generada por script**. | **sí** |
| `golden-set.json` | Los casos etiquetados con su procedencia y sus justificaciones. | **sí** |
| `thresholds.json` | Métricas, umbrales, regla de desempate, hipótesis y condición de refutación. | **sí** |
| `CONGELADO.md` | Los tres sha256 + fecha + quién firmó + log de cambios. | — |

**Canonicalización (definida, no supuesta):**
- Serialización JSON con **claves ordenadas ascendentemente por code unit UTF-16** (`Array.sort()`
  por defecto sobre `Object.keys`), aplicada **recursivamente**.
- **Los arrays NO se reordenan** — su orden es semántico (la precedencia de la taxonomía vive en el
  orden del array).
- Indentación **2 espacios**, separador de línea **LF (`\n`)**, encoding **UTF-8 sin BOM**,
  **newline final**.
- El hash es **sha256 sobre los bytes del archivo así serializado**.
- **Gotcha del repo (Windows):** `.gitattributes` debe fijar `eol=lf` para
  `packages/news/src/eval/*.json`. Sin eso, un checkout en Windows inserta CRLF y **el hash cambia
  solo** — el mismo tipo de trampa que el `psql -tA` emitiendo CRLF documentado en v12.0.

**Dónde vive el hash:** en `CONGELADO.md` **y** en `congelado.test.ts`, que **re-calcula los tres
hashes y los compara**. Divergencia ⇒ CI roja.

**Cómo se distingue un cambio legítimo de un drift silencioso:** un **cambio legítimo** llega en un
**único commit** que contiene las tres cosas — el artefacto modificado, el hash actualizado en el
test, y una **entrada nueva en `CONGELADO.md`** con `hash_anterior → hash_nuevo`, fecha, razón y
firma del operador. Cualquier otra combinación es **drift**: un hash que no cuadra (CI lo caza), o
un test actualizado **sin** entrada en el log (lo caza el code-review, y el propio `CONGELADO.md`
lo delata porque el hash del test no aparece en ninguna entrada).

**Test de sincronía obligatorio:** `taxonomia.json` se regenera desde `taxonomia.ts` en el test y se
compara byte a byte. Divergencia ⇒ falla. Esto hace **estructuralmente imposible** la deuda de ICS
(definición formal en un archivo, clasificador en otro, divergiendo en silencio).

### Razón

La alternativa obvia era hashear directamente el `.ts`. Se rechaza: un `.ts` cambia por formateo,
comentarios, imports o prettier, y produciría **drift falso constante** — el mismo ruido que D-132-C
evitó al elegir fingerprint estructural en vez de bytes crudos del XML. Hashear una **proyección
canónica de datos** hace que el hash cambie si y solo si cambia el **contenido semántico**.

### Qué la refutaría

- Que el hash cambie entre dos checkouts limpios sin cambios de contenido: la canonicalización o el
  `.gitattributes` están mal ⇒ arreglar antes de firmar (un hash inestable es peor que no tener
  hash, porque enseña al equipo a ignorar la CI roja).

---

## D-133-F — RE-RUNNABILIDAD (SC4)

### Decisión

**Cada caso golden guarda AMBOS: el puntero de procedencia Y el payload embebido.** El puntero solo
NO basta.

Forma de un caso:

```
{
  "caso_id":        "<sha256(url_canonica)[:16]>",
  "procedencia":    { "r2_path", "url_hash", "url_canonica", "outlet", "fecha_captura", "fecha_pub" },
  "entrada":        { "titulo", "descripcion" },        // exactamente lo que el parser produjo
  "entrada_llm":    "<string exacto que se inyecta al prompt como DATO>",
  "estrato":        "P" | "N-alea" | "N-sonda",
  "prefiltro":      { "paso": bool, "terminos": [...] }, // salida real de prefiltro-lexico.ts
  "etiqueta":       "<de taxonomia.ts>",
  "revision":       { etiqueta_a, etiqueta_b, justificacion_a, justificacion_b, acuerdo, resuelto_por, revisado_en }
}
```

`entrada_llm` es el string **ya encapsulado como JSON y truncado a 300 chars por campo**, replicando
el anti-prompt-injection de ICS (`clustering.py:187-208`): *el texto de los titulares es DATO, nunca
instrucción.*

**Por qué el puntero `{r2_path + url_hash}` NO basta**, en orden de fuerza:
1. **El golden se movería solo bajo los pies del eval.** El crudo en R2 es el **XML del feed**, no el
   ítem. Recuperar el ítem exige re-parsear con `fast-xml-parser`, y cualquier cambio en el manejo
   de CDATA, entidades o encoding (`Claude's Discretion` explícita en D-132) produciría un `titulo`
   distinto **para el mismo `r2_path`**. La vara dejaría de ser fija — que es lo único que una vara
   tiene que ser.
2. **El eval corre en CI sin credenciales de R2 y sin red.** Régimen del repo: los tests nunca llaman
   una API (ICS `test_classifier_traffic.py`). Un golden que necesita R2 para materializarse no puede
   ser el gate bloqueante de CI que exige el SC1 de la Phase 135.
3. La rotación del feed vivo (24-48 h) **no** es el argumento fuerte: R2 es inmutable y
   content-addressed, así que ahí el ítem no se pierde. El argumento fuerte es (1) y (2).

**Por qué el puntero se conserva igual:** es la trazabilidad — el principio rector del proyecto. Sin
`r2_path` el caso es un texto huérfano sin fuente, y "según qué fuente" es el core value.

**Reconciliación puntero↔payload (test de deriva de parser):** `re-runnable.test.ts`, cuando hay
credenciales de R2 (**corrida local del operador, jamás CI**), re-descarga el crudo desde R2,
re-parsea y verifica que `titulo`/`descripcion` embebidos siguen siendo **byte-idénticos** a lo que
produce el parser actual. Si divergen, **no falla el golden**: emite un **reporte de deriva de
parser**. La jerarquía es explícita — **el golden es la vara; el parser es lo que se mueve.**

**Copyright y PII (restricciones LOCKED):**
- El golden contiene **solo titular + descripción del RSS**, con la descripción **truncada a 300
  chars** (el mismo límite anti-injection sirve de límite de cita). Es cita breve de un feed que el
  medio publica para redistribución — **no** un archivo de contenido de terceros. **Cero full-text**:
  eso vive solo en el bucket privado del operador (Phase 137).
- **Cero PII añadida**: no se agrega ningún dato de persona que no esté ya en el titular/descripción
  publicados. Cero RUT. El golden **no se cruza con la tabla `parlamentario`** — el vínculo a
  personas es de 134/137 y pasa por su carril PII.
- **Cero causalidad e intención**: ni las etiquetas ni las justificaciones afirman por qué un actor
  hizo algo. Las justificaciones citan el fragmento, no lo interpretan.

### Qué la refutaría

- Que el test de deriva encuentre divergencias en **>5 % de los casos** ya en la primera corrida: el
  parser no es determinista sobre estos feeds y hay un bug que arreglar antes de congelar nada.
- Que `entrada_llm` truncada a 300 chars destruya la señal (p. ej. que muchos casos queden
  indistinguibles): habría que subir el límite, con su consecuencia de copyright evaluada.

---

## Lo que esta adjudicación NO decide

Queda para research / plan de la fase, o para fases posteriores:

1. **El prompt exacto del clasificador de 135** — su redacción, el system prompt, cómo se serializa
   la lista cerrada. Solo se fija que **se construye desde `taxonomia.ts`**.
2. **Qué modelos entran al benchmark** y en qué orden de tier dentro de `TieredProvider`. Solo se
   fija que Granite es candidato legítimo y que la extracción sigue vetada.
3. **El schema Supabase de la etiqueta** (columna en `noticia` vs tabla `noticia_etiqueta` con
   historial) — es decisión de 135, con su migración y su pgTAP.
4. **Los nombres de archivo internos** de `packages/news/src/eval/` más allá de los cinco listados,
   y la forma exacta del script de canonicalización.
5. **La política de re-etiquetado cuando la taxonomía cambie** en un milestone futuro (¿se re-etiqueta
   todo el golden? ¿se versiona `taxonomia_version` por caso?). Hoy la taxonomía se congela por
   primera vez; el problema aún no existe.
6. **Si `agenda_ejecutivo` merece superficie propia** en la UI de 137, o se colapsa visualmente con
   `tramitacion_legislativa`.
7. **Ampliar `VOCABULARIO_LEGISLATIVO`** si el estrato N-sonda caza falsos negativos — la decisión de
   qué términos agregar es del plan, con test; la regla (solo se AMPLÍA, nunca se poda) ya es LOCKED.
8. **El presupuesto y ledger de llamadas** (T3 del SC de la Phase 135) — cap duro y observabilidad son
   de 135.

---

## Lo que requiere firma del operador

Este es **el checkpoint de la Phase 133**: la firma ocurre **ANTES de la primera medición**. Medir
primero y firmar después destruiría el valor entero de la fase.

**Qué debe firmar, exactamente:**

1. **La taxonomía literal (D-133-A)** — las 6 clases sustantivas + `ambiguo`, sus definiciones de una
   línea, sus fronteras y el orden de precedencia. *Por qué no puede auto-aprobarse:* define qué
   afirma el sitio sobre una noticia y queda LOCKED después; una etiqueta mal trazada se propaga a
   134, 135 y 137, y el linter anti-insinuación no puede cazar un error de taxonomía — solo caza
   copy.
2. **Los umbrales numéricos de D-133-D (T1-T5) y la condición de refutación.** *Por qué no puede
   auto-aprobarse:* un veredicto VETADO significa que NEWS-05 **no entra a producción** y el
   milestone entrega menos de lo prometido. Esa es una decisión de producto, no de ingeniería. Y
   una vez medido, el número ya no se puede mover sin circularidad — la ventana para firmarlo es
   ahora o nunca.
3. **El arbitraje del lote de desacuerdos inter-etiquetador (≤25 casos, D-133-C).** *Por qué no puede
   auto-aprobarse:* es exactamente el punto donde ICS perdió la calidad de sus etiquetas; delegarlo
   a un tercer modelo reintroduce el defecto que esta fase existe para evitar.
4. **La ventana de 3 días hábiles y sus 15 requests** (D-133-B) — es la única red adicional que esta
   fase toca; el operador confirma que se ejecuta dentro de la corrida normal del conector.
5. **Ratificar o revocar que esta adjudicación la hizo Opus en sustitución de Fable.** El régimen
   v13.0 LOCKED asigna las decisiones a Fable; **Fable quedó sin créditos hoy (2026-08-05)**. Esta
   sustitución **no está autorizada por silencio**: si el operador la revoca, la fase espera a que
   Fable tenga créditos y se re-adjudica. Ningún artefacto de 133 se congela ni se hashea hasta que
   esta ratificación esté escrita.

---

## RESUMEN EJECUTIVO

| # | Decisión | Núcleo |
|---|---|---|
| **D-133-A** | **Taxonomía** | Un eje **mono-etiqueta** de 6 clases + `ambiguo`, con **precedencia determinista**: `tramitacion_legislativa` > `actividad_parlamentaria` > `ley_vigente` > `agenda_ejecutivo` > `politica_no_legislativa` > `no_legislativa`; `ambiguo` como escape legítimo. Eje **institucional, no temático** (el temático murió con `sector_id` al 1,8 %). La taxonomía **no nombra sujetos** — eso es del resolver de 134. Single source of truth en `packages/news/src/eval/taxonomia.ts`, y el prompt de 135 se **construye** desde ahí. |
| **D-133-B** | **Golden set** | **140 casos objetivo, piso 100**, ventana **3 días hábiles** (15 requests, dentro de la corrida normal). Mide el **pipeline completo**: censo de los que pasan + **50 descartados aleatorios (semilla fija)** + **30 descartados dirigidos** como **sonda de falso negativo** del pre-filtro. Proporción **1:1,3** deliberada y declarada, métricas **por clase**. Se declara por escrito que **no permite afirmar** generalización a otros outlets, estabilidad temporal, ni nada bajo n=8; **toda cifra se publica con n e IC** (±6 pp global, ±18 pp por clase). |
| **D-133-C** | **Protocolo de etiquetado** | **Doble etiquetado independiente** (2 Sonnet, `sonnet-swarm`, **nunca el modelo que se evalúa** — evita circularidad) con **justificación que cita el fragmento literal** por caso. Desacuerdo → **operador**, jamás un tercer modelo; **cap 25 casos**, si se supera la taxonomía está mal y vuelve a A. **Vara sobre la vara**: acuerdo bruto ≥ 0,80 y **κ ≥ 0,65** o el golden **no se congela**. `ambiguo` se conserva, se excluye del denominador y se reporta aparte. |
| **D-133-D** | **Thresholds** | Congelados antes de medir: **T1** etiqueta fuera de lista = 0,00 (**veto duro**) · **T2** parse fallido ≤ 0,02 · **T3** exactitud ≥ **0,80** · **T4** recall `tramitacion_legislativa` ≥ **0,85** (asimetría: el FP lo mata el resolver, el FN no lo recupera nadie) · **T5** precisión `no_legislativa` ≥ 0,90 · **T6/T7** costo y latencia **desempatan, no vetan** (<6 pp = empate). **Refutación pre-registrada**: si ningún modelo alcanza T3 o T4, **NEWS-05 no entra a producción** — la salida honesta es vínculo determinista sin etiqueta, o fase fallida. Bajar el umbral tras ver el número **no es salida válida**. |
| **D-133-E** | **Congelación** | 5 artefactos en `packages/news/src/eval/`; se hashean **3 JSON canonicalizados** (claves ordenadas por code unit recursivamente, arrays **sin** reordenar, 2 espacios, **LF**, UTF-8 sin BOM, newline final) — nunca el `.ts` (drift falso por formateo). `.gitattributes` con `eol=lf` **obligatorio** o Windows mueve el hash solo. Hash en `CONGELADO.md` **y** en `congelado.test.ts`. Cambio legítimo = **un commit con las tres cosas**; cualquier otra combinación es drift y la CI o el log lo delata. Test que regenera `taxonomia.json` desde el `.ts` ⇒ la deuda de ICS (definición lejos del clasificador) queda **estructuralmente imposible**. |
| **D-133-F** | **Re-runnabilidad** | **Puntero Y payload**, no uno u otro. El puntero solo **no basta** porque (1) re-parsear el XML con un parser que evoluciona movería la vara bajo los pies del eval, y (2) el gate de CI corre **sin red y sin credenciales R2**. Se embebe `entrada_llm` **encapsulada como JSON y truncada a 300 chars** (anti-prompt-injection: el titular es DATO, nunca instrucción). Un test de **deriva de parser** (local, no CI) reconcilia ambos: si divergen, **el golden manda y el parser es lo que se mueve**. Solo titular+bajada del RSS, cero full-text, cero PII añadida, cero causalidad. |

**Sustitución declarada:** adjudicación hecha por **Opus en sustitución de Fable** (sin créditos hoy,
2026-08-05). **No es aprobación por silencio** — requiere ratificación explícita del operador junto
con los puntos 1-4 del checkpoint. Ningún artefacto se congela ni se hashea antes de esa firma.

---

*Phase 133 — NEWS-TAXO · Adjudicación escrita 2026-08-05*
