# Phase 133 — NEWS-TAXO · RE-ADJUDICACIÓN (133-a)

**Fecha:** 2026-08-05
**Adjudica:** **Opus**, bajo **D-133-RATIF** (sustitución de Fable RATIFICADA por el operador
mientras Fable no tenga créditos).
**Reemplaza a:** `133-ADJUDICACION.md` en todo lo que el premortem refutó. Lo no tocado aquí sigue
vigente tal como está escrito allí.
**Insumos:** `133-ADJUDICACION.md` (D-133-A..F), `133-PREMORTEM.md` (8 blockers), decisiones de
operador **D-133-RATIF**, **D-133-G**, **D-132-A**.
**Estado:** ✅ **FIRMADO POR EL OPERADOR el 2026-08-06** (*"consideralo firmado."*) — D-133-A2, B2,
C2, D2, E2, F2, H e I son **LOCKED**. Los artefactos de 133-a pueden congelarse y hashearse. El
golden set (133-b) conserva su segunda firma, con κ, n por clase e IC a la vista.

---

## 0. Qué cambia y qué no

| Decisión original | Estado | Documento que manda |
|---|---|---|
| D-133-A taxonomía | **REVOCADA y re-adjudicada** → **D-133-A2** | este |
| D-133-B golden set | **REVOCADA y re-adjudicada** → **D-133-B2** | este |
| D-133-C protocolo de etiquetado | **REVOCADA y re-adjudicada** → **D-133-C2** | este |
| D-133-D thresholds | **REVOCADA y re-adjudicada** → **D-133-D2** | este |
| D-133-E formato de congelación | **ENMENDADA** → **D-133-E2** (núcleo intacto) | este |
| D-133-F re-runnabilidad | **ENMENDADA** → **D-133-F2** (solo el límite de truncado) | este |
| — | **NUEVA D-133-H** — reconciliación con el SC1 LOCKED de la Phase 134 | este |
| — | **NUEVA D-133-I** — partición 133-a / 133-b y regla de intervalos | este |

**Se conserva íntegro y no se re-discute** (el premortem lo declaró acertado): el rechazo de la
taxonomía temática con la evidencia de `sector_id` al 1,8 %; incluir descartados en el golden para
hacer visible el fallo permanente del pre-filtro recall-first; la sección "lo que este golden NO
permite afirmar"; la pre-registración de la hipótesis y la cláusula de que **bajar el umbral después
de ver el número no es salida válida**; puntero **Y** payload con la jerarquía "el golden es la vara,
el parser es lo que se mueve"; y hashear la **proyección canónica**, jamás el `.ts`.

---

## D-133-A2 — LA TAXONOMÍA (resuelve BL-5, BL-3; consistente con D-133-G)

### A2.1 — Regla rectora nueva, y la razón por la que la anterior falló

**REGLA DE DECIDIBILIDAD TEXTUAL (LOCKED):** *una clase de esta taxonomía es legal si y solo si un
lector puede decidirla leyendo únicamente el titular y la bajada del ítem RSS.* Una clase cuyo hecho
decisorio vive en el corpus (¿está en trámite?, ¿ya ingresó?) es **ilegal por construcción**, porque
el clasificador de 135 **por diseño no consulta el corpus** — el cruce con boletines y personas es
del resolver determinista de 134.

Esta regla es el antídoto general al defecto: la adjudicación anterior escribió dos clases
(`ley_vigente`, `agenda_ejecutivo`) cuyas fronteras exigían un hecho externo, y simultáneamente
exigió (D-133-C:198-200) **citar un fragmento literal** que las sostuviera. No existe tal fragmento
⇒ esos casos se auto-rechazaban. La contradicción A↔C no se parcha caso a caso: se elimina la
categoría de clase que la produce.

### A2.2 — La taxonomía congelada: 5 clases sustantivas + 1 escape

Mono-etiqueta, **precedencia determinista** (gana la primera que aplique), decidible sobre
titular+bajada:

| # | Etiqueta | Definición operativa (textual) | Marca decisoria en el texto | Frontera |
|---|---|---|---|---|
| 1 | `tramitacion_legislativa` | El texto informa un hecho ocurrido en la tramitación de una iniciativa en el Congreso. | Menciona explícitamente un acto de tramitación: ingreso, comisión, sala, votación, indicación, urgencia, veto, despacho, requerimiento al TC, o el boletín. | Si el texto **no** nombra un acto de tramitación, no cae aquí — aunque el lector sepa que el proyecto existe. |
| 2 | `actividad_parlamentaria` | El texto trata la actuación pública de un parlamentario **en ejercicio**, nombrado en el texto. | Nombra a la persona **y** un acto suyo: declaración, comisión investigadora, lobby/audiencia, patrimonio e intereses, ética y sanciones, asistencia. | Un parlamentario citado de pasada como fuente sobre otro tema → la clase del tema. Candidatos que no ejercen → 4. Si además hay acto de tramitación → 1. |
| 3 | `ley_vigente` | El texto trata una norma **ya promulgada o publicada**, su reglamento, su entrada en vigencia o sus efectos. | Marca textual: "ley N.º…", "entra en vigencia", "publicada en el Diario Oficial", "el reglamento de la ley", "desde hoy rige". | **Ya no** contiene la cláusula "si hay una modificación en trámite" (indecidible). Si el mismo texto nombra un acto de tramitación, gana 1 — y eso también es textual. |
| 4 | `politica_no_legislativa` | Política contingente sin acto de tramitación ni actuación parlamentaria: elecciones, partidos, gabinete, encuestas, municipios, tribunales no-TC, **y los anuncios o compromisos del Ejecutivo que el texto no vincula a un acto de tramitación**. | — | Si el texto informa el **ingreso** o cualquier otro acto de tramitación, gana 1. |
| 5 | `no_legislativa` | Todo lo demás: farándula, deportes, policial, internacional, economía, servicio. **Se espera que sea la mayoría.** | — | — |
| 6 | `ambiguo` | Titular + bajada no alcanzan para decidir entre dos clases. No es "no sé": es "la evidencia disponible no basta". | — | Si una lectura razonable resuelve, NO es ambiguo. |

**Precedencia:** `1 > 2 > 3 > 4 > 5`; `ambiguo` es escape, no nivel de precedencia.

**`agenda_ejecutivo` MUERE antes de congelar.** Razón doble y ambas medibles: (a) su definición era
indecidible ("aún no ha ingresado al Congreso" es estado del corpus); (b) el premortem proyecta n≈2-4
en el golden — **bajo el piso n=8 de la propia adjudicación** ⇒ nacería sin poder validarse. La
adjudicación anterior ya la marcaba como candidata a fusión "si reúne <5 casos"; fusionarla **ahora**
ahorra una re-congelación garantizada. Su contenido se absorbe en 4, cuyo enrutamiento (ninguna
ficha) es el correcto: sin acto de tramitación no hay boletín del que colgar.

**Enrutamiento (el único uso de la etiqueta, por D-133-G):**

| Clase | Cuelga de |
|---|---|
| 1 `tramitacion_legislativa`, 3 `ley_vigente` | ficha de **proyecto** (si 134 resuelve boletín; `null` ⇒ dead-letter) |
| 2 `actividad_parlamentaria` | ficha de **persona** (si 134 resuelve parlamentario; `null` ⇒ dead-letter) |
| 4, 5, 6 | **ninguna ficha** |

### A2.3 — Qué noticia puede colgar de la ficha de una persona (resuelve la mitad de BL-2)

Regla explícita, congelada, **acumulativa** (deben cumplirse las tres):

1. La etiqueta es `actividad_parlamentaria`.
2. El **titular o la bajada nombran** a la persona — no basta que el cuerpo o el contexto la
   impliquen; el golden solo contiene titular+bajada, así que solo eso puede sostener el vínculo.
3. El resolver determinista de 134 mapea ese nombre contra la lista cerrada de 186 parlamentarios en
   ejercicio **sin ambigüedad**. Homónimo, apellido suelto, o coincidencia parcial ⇒ `null` ⇒
   dead-letter ⇒ **no cuelga**.

**Fail-closed de clase:** si en el golden `actividad_parlamentaria` no alcanza n ≥ 25 (D-133-B2), su
umbral T9 queda **no-medido** y **la clase no enruta a fichas de persona en producción** hasta que
exista la medición. Se prefiere no publicar a publicar sin vara: es la única clase con exposición
reputacional de una persona identificable, y la red de seguridad que la adjudicación anterior
invocaba para tolerar falsos positivos (**"el resolver los mata: boletín `null`"**) **no existe
aquí** — no hay boletín que resolver.

### A2.4 — El copy de la taxonomía y el agujero del linter (resuelve BL-3)

Con **D-133-G** la etiqueta no se renderiza jamás. Eso reduce el riesgo pero **no lo cierra**: el
cumplimiento va por guard, no por promesa. Tres entregables congelados de 133-a, cada uno **con
control positivo apareado que difiere en UNA sola variable**:

- **G1 — `packages/news/src/eval/taxonomia-guard.test.ts`.** Corre `TERMINOS_PROHIBIDOS` /
  `NEGACIONES_LOCKED` del guard anti-insinuación sobre **cada string** de `taxonomia.ts` (etiqueta,
  definición, marca decisoria, frontera). Prueba de mutación obligatoria: inyectar un término
  prohibido en una glosa y **demostrar que el test cae**.
- **G2 — guard de superficie (el que exige D-133-G).** Falla si **cualquier literal de etiqueta de
  la taxonomía** aparece en una superficie renderizada de `app/`. Control positivo apareado: un
  fixture con el literal presente debe fallar; el mismo fixture sin el literal debe pasar.
- **G3 — cierre del skip silencioso.** `app/lib/anti-insinuacion-guard.test.ts:943-948` **salta sin
  fallar** los archivos de su allowlist que no encuentra (`try/catch continue`), y su propio
  comentario (`:421-423`) ya documenta el agujero para `packages/notificaciones`. Se cambia a
  **fallo duro**: un archivo del allowlist que no existe es un guard ciego, y un guard ciego que sale
  verde es el falso verde de manual. Se ajusta el allowlist en el mismo commit si algún archivo se
  movió legítimamente.

G3 no es alcance añadido por gusto: sin él, G2 hereda exactamente el mismo modo de fallo que hace
inútil al guard existente.

### Qué refutaría D-133-A2

- Que en el etiquetado >20 % de los casos caiga en `ambiguo` ⇒ las fronteras siguen mal trazadas o
  titular+bajada no soportan este eje ⇒ re-adjudicar antes de congelar.
- Que el desacuerdo inter-anotador se concentre en la frontera 1/2 ⇒ la frontera es ficticia y las
  clases se fusionan (con la consecuencia de que se pierde el enrutamiento a fichas de persona).
- Que `ley_vigente` reúna <8 casos ⇒ se reporta sin umbral; si además concentra desacuerdo, se
  fusiona en 4 en la próxima congelación.

---

## D-133-B2 — EL GOLDEN SET (resuelve BL-8 parcial, B1, y la parte de muestreo de BL-2)

### B2.1 — Composición

Se conserva: el golden mide el **pipeline completo** (pre-filtro + clasificador) e **incluye
descartados**, porque el modo de fallo del pre-filtro recall-first es **permanente e invisible**.

| Estrato | Origen | n | Selección |
|---|---|---|---|
| **P — pasaron** | `noticia`, ventana completa | censo: **todos** | sin muestreo |
| **N-alea** | `noticia_url_vista` `descarta` | **50** (→ **70** si se gatilla la regla B2.3) | aleatorio, **semilla fija documentada** sobre `url_hash` ordenado |
| **N-sonda** | ídem | **30** | descartados con tokens institucionales fuera del vocabulario (`ministro`, `gobierno`, `La Moneda`, `Contraloría`, `presidente`, `subsecretari`, `oficialismo`, `oposición`) — sonda de falso negativo |
| **P-dirigido** *(nuevo)* | pool de `noticia` de la ventana; si no alcanza, fixtures `packages/news/src/__fixtures__/*.xml` | lo necesario para llevar `tramitacion_legislativa` y `actividad_parlamentaria` a **n ≥ 25 cada una** | dirigido, **declarado como sobre-muestreo** en cada caso (`estrato: "P-dirigido"`) |

**P-dirigido existe porque el diseño de muestreo debe GARANTIZAR los n que los umbrales necesitan, no
descubrirlos.** A n≈12 (la proyección real del premortem para `tramitacion_legislativa`) los únicos
valores alcanzables alrededor de 0,85 son 0,833 y 0,917: el veto que decide si NEWS-05 entra a
producción se resolvería **por un solo ítem**. A n=25 el IC95 baja a ~±14 pp y existen valores
alcanzables alrededor del umbral.

El sobre-muestreo dirigido **rompe la prevalencia** — por eso todas las métricas de clase son **por
clase** y T3 deja de ser una accuracy global (D-133-D2).

### B2.2 — Tamaño: el piso es el compromiso

**Piso duro: 100 casos. El "140" deja de ser objetivo firmado** y pasa a ser expectativa informativa.
Razón medida: el día 1 (245 vistas / 25 pasan) fue **arranque en frío** — la ventana completa de los
5 feeds, no la producción diaria. Con el dedup de D-13 (URL exacta + canónica contra el ledger) los
días 2-3 aportan **solo delta**. Proyección honesta: **P ∈ [40, 75]**, total **∈ [120, 155]** antes
de P-dirigido. **El piso de 100 sobrevive en los tres escenarios** porque los 80 casos de los
estratos N salen de los 220 descartes que ya existen y no dependen de la rotación.

### B2.3 — Regla de decisión al cierre del día 2 (en vez de proyección lineal)

Si el **delta de P del día 2 es < 15**: no se extiende la ventana. Se sube `N-alea` de 50 a 70, se
activa `P-dirigido`, y el estrato P se declara por escrito como **"censo de N outlets, n=X"**. Nunca
se ablanda el pre-filtro para conseguir muestra (`prefiltro-lexico.ts:6-9`, prohibición LOCKED).

Y una lectura que la adjudicación anterior no hizo: si biobiochile, cooperativa y exante aportan cero
ítems que pasen **durante los tres días**, eso no es mala suerte del día 1 — es un **hallazgo
estructural** del pre-filtro o del feed, y se reporta como tal.

### B2.4 — Ventana

**3 días hábiles**, 5 requests/día = **15 requests totales**, dentro de la corrida normal del
conector (rate-limit 2-3 s/host, robots.txt, hash-check antes de descargar). No es una corrida extra.
Por **D-132-A** operan 5 medios directos; cláusula **N ≥ 3**: bajo tres feeds vivos, la fase PARA.

### B2.5 — Lo que este golden NO permite afirmar

Se conserva **verbatim** de D-133-B (los cinco puntos: nada sobre otros outlets, nada sobre
estabilidad temporal, IC obligatorio en toda cifra, la sonda no estima el recall del pre-filtro, nada
bajo n=8), con dos enmiendas:

- Se agrega un sexto punto: **nada sobre prevalencia**. La composición es artificial por diseño
  (sobre-muestreo deliberado de la clase rara + P-dirigido) ⇒ ninguna cifra de este golden describe
  la mezcla real del flujo de prensa.
- **Su destinatario deja de ser solo el reporte interno.** Por BL-4 residual, estas limitaciones más
  la taxonomía, los umbrales, `exactitud_medida`, `n`, `IC`, `fecha_del_eval` y `modelo` son
  entregable **público** de la Phase 137: página **"Cómo clasificamos las noticias"**, ligada al hash
  de `CONGELADO.md`. Un observatorio de transparencia publica su propia vara aunque no muestre la
  etiqueta (D-133-G lo deja explícito).

---

## D-133-C2 — EL PROTOCOLO DE ETIQUETADO (resuelve BL-6, BL-7)

### C2.1 — Anotadores de familias distintas + calibración humana ciega

1. **Dos anotadores de modelos DISTINTOS.** La prohibición anterior ("no el mismo modelo ni el mismo
   prompt que se evaluará en 135") cerraba la circularidad **hacia 135** y dejaba abierta la
   circularidad **dentro del protocolo**: dos corridas de Sonnet comparten pesos, priors y modos de
   fallo ⇒ su acuerdo mide **estabilidad de muestreo**, no convergencia de criterios. Eso es
   auto-consistencia disfrazada de κ inter-anotador, sobre la métrica que la fase existe para
   producir. Composición: **Sonnet + Opus** (Fable en lugar de Opus si recupera créditos). Sigue
   prohibido que cualquiera de los dos sea el modelo/prompt evaluado en 135.
2. **Calibración humana ciega, obligatoria.** El operador etiqueta **20 casos estratificados**
   (cubriendo las 5 clases sustantivas + `ambiguo`) **antes de ver ninguna etiqueta de máquina**.
   Se publican **dos** kappas: κ(máquina↔máquina) y κ(humano↔máquina).
3. **Regla de interpretabilidad (el control positivo apareado):** si
   **κ(humano↔máquina) < κ(máquina↔máquina) − 0,15**, el κ de máquina se declara
   **no interpretable como acuerdo inter-anotador** y no puede citarse como "la vara sobre la vara".
   El golden no se congela hasta re-instruir a los anotadores y re-correr.

Los 20 casos son ~media hora de operador y son la diferencia entre un κ interpretable y un número
decorativo.

### C2.2 — Justificación literal por caso

Se conserva: cada anotador emite `{etiqueta, justificacion}` con `justificacion` ≤200 chars que
**cita el fragmento literal** del titular o la bajada. Ahora es una regla **cumplible**, porque
D-133-A2 eliminó las clases cuyo hecho decisorio era externo al texto. Para `ambiguo` la
justificación cita **los dos fragmentos** que compiten.

### C2.3 — Desacuerdo: el cap deja de ser puerta (resuelve BL-7)

La puerta de calidad es **solo** el par **acuerdo bruto ≥ 0,80 y κ ≥ 0,65**. El cap de 25 pasa a ser
**presupuesto de sesión del operador**, no criterio de calidad. Razón aritmética: a n=140, acuerdo
0,80 admite **28** desacuerdos ⇒ un golden con acuerdo 0,81 —que **aprueba** la vara— quedaba
**detenido por el cap**. Las dos reglas se cruzaban en n=125 y mordía primero la que se justifica por
costo de operador, no por calidad.

- Si los desacuerdos ≤ 25: el operador los arbitra todos.
- Si superan 25: se arbitran los **25 de mayor impacto**, estratificados y priorizando
  `tramitacion_legislativa` y `actividad_parlamentaria` (las dos clases con veto y con enrutamiento a
  ficha). El resto se marca `ambiguo_no_arbitrado`, se **excluye del denominador de exactitud**, y se
  **reporta contando aparte** — nunca se resuelve con un tercer modelo.
- **Desacuerdo → operador, jamás un tercer modelo.** Se conserva: delegar el desempate a una máquina
  es exactamente donde ICS perdió sus etiquetas.

### C2.4 — Condición de refutación del protocolo (el bucle tenía salida vacía)

En simetría con la refutación pre-registrada de D-133-D:

> **Si tras DOS rondas de re-definición de las glosas el par (acuerdo ≥0,80, κ ≥0,65) no pasa —o la
> regla de interpretabilidad C2.1.3 se gatilla dos veces— la taxonomía se declara NO ETIQUETABLE
> sobre titular+bajada y la Phase 133 reporta FRACASO.**

Salidas honestas en ese caso, escritas antes: (a) el carril news publica solo el **vínculo
determinista** —noticias cuyo texto contiene un boletín explícito reconocido por el resolver de
134— **sin etiqueta ni enrutamiento a fichas de persona**; o (b) se reporta 133 fallida y 135 no se
ejecuta. **No es salida válida** relajar la puerta después de ver el κ.

### C2.5 — Registro por caso

`etiqueta`, `etiqueta_a`, `etiqueta_b`, `justificacion_a`, `justificacion_b`, `acuerdo` (bool),
`resuelto_por` (`acuerdo` | `operador` | `no_arbitrado`), `modelo_a`, `modelo_b` (nuevos: sin ellos
el κ no es auditable), `en_calibracion_humana` (bool), `etiqueta_humana` (solo los 20),
`revisado_en` (ISO).

`ambiguo` se conserva en el golden, se excluye del denominador de exactitud y se reporta aparte como
`tasa_ambiguo_humano`.

---

## D-133-D2 — LOS THRESHOLDS PRE-REGISTRADOS (resuelve BL-2, BL-8, B10)

Congelados **antes de la primera medición**, en `thresholds.json` con hash en `CONGELADO.md`.
**Cada veto lleva su n mínimo al lado** — un umbral sin n mínimo es inmedible por diseño.

| # | Métrica | Umbral | n mínimo | Efecto |
|---|---|---|---|---|
| **T1** | `tasa_etiqueta_fuera_de_lista` | **= 0,00** | — | **VETO**. Es contrato, no calidad (ICS: `"robos_ violentos"` por artefacto de tokenizer; `json_object` no lo arregló). |
| **T2** | `tasa_parse_fallido` | **≤ 0,02** | — | **VETO**. |
| **T3** | `exactitud_macro` = **media de la exactitud por clase sobre las clases con n ≥ 8** | **≥ 0,80** | ≥3 clases con n≥8 | **VETO**. |
| **T4** | `recall_tramitacion_legislativa` | **≥ 0,85** | **n ≥ 25** | **VETO si n ≥ 25**; si n < 25 ⇒ **no veta, se reporta `no-medido`** y la clase **no enruta a ficha de proyecto** en producción. |
| **T5** | `precision_no_legislativa` | **≥ 0,90** | n ≥ 25 | **VETO** con la misma cláusula de n. |
| **T9** *(nuevo)* | `precision_actividad_parlamentaria` | **≥ 0,90** | **n ≥ 25** | **VETO** con la misma cláusula de n; si `no-medido`, la clase **no enruta a ficha de persona**. |
| T6 | `costo_usd_por_100_items` | ≤ 0,05 | — | informativo, **desempata** |
| T7 | `latencia_p50_ms` | ≤ 5.000 | — | informativo, **desempata** |
| T8 | `tasa_ambiguo_modelo` vs `tasa_ambiguo_humano` | — | — | informativo |

**T3 deja de ser accuracy global.** D-133-B escribía "las métricas del golden son por clase, jamás
accuracy global ponderada por la población real" y a la vez definía T3 como accuracy global —
ponderada por una composición **artificial** (≈55 % `no_legislativa` fácil por diseño de muestreo).
Una accuracy global sobre una mezcla inventada no es más honesta que una sobre la población real: es
**distinta de** honesta. Macro-promedio sobre clases con n≥8 es la única lectura consistente con el
propio diseño de estratos.

**T9 y la asimetría inversa, escrita.** En `tramitacion_legislativa` el falso positivo lo mata el
resolver (boletín `null` ⇒ dead-letter ⇒ nada se publica) y el falso negativo no lo recupera nadie —
por eso T4 protege **recall**. En `actividad_parlamentaria` **esa red no existe**: no hay boletín que
resolver, y el daño irreversible es el **falso positivo** — una noticia hostil colgada de la ficha de
una persona identificable. Por eso T9 protege **precisión**. Con D-133-G la etiqueta no se ve, así
que **no hay salvedad a la vista** que matice el error: la única protección es la vara.

**Granite: no se extrapola de dominio (B10).** Granite sigue siendo **candidato legítimo** —esto es
clasificación, que es lo que el veredicto full-40 de v11.0 aprobó—, pero se escribe que **esa
aprobación no se transfiere de dominio**: el veto de v11.0 fue **por es-CL**, y prensa chilena con
jerga y farándula es exactamente ese terreno. En 135 Granite se mide contra el golden como cualquier
otro candidato; **el veredicto que vale es el computado sobre prensa, no el heredado.**

### Regla de intervalos, uniforme (resuelve la inconsistencia D-133-B↔D-133-D)

El intervalo importa **para las dos cosas**, y se aplica así:

1. **Toda cifra se publica con su `n` y su IC95.** Sin excepción, jamás pelada.
2. **Los vetos se evalúan sobre la estimación puntual.** Un umbral evaluado sobre el borde del IC no
   sería un umbral.
3. **Zona de ruido declarada:** si el IC95 **cruza** el umbral, el veredicto se publica marcado
   `dentro-del-ruido` con ambos números. Aprueba o veta igual (regla 2), pero el reporte **no puede
   presentarlo como resultado limpio**. Los n mínimos de la tabla existen para que esa zona sea
   angosta.
4. **El desempate entre modelos usa solapamiento de IC95**, no la constante mágica de 6 pp. Los 6 pp
   eran el IC a n≈140 global y no sobreviven a métricas por clase. Si los IC95 de
   `exactitud_macro` de dos candidatos se solapan, están **empatados** y decide T6; a costo empatado,
   decide T4.

### Hipótesis y refutación pre-registradas (se conservan)

> *"Un LLM de bajo costo puede etiquetar prensa chilena en la taxonomía congelada con calidad
> suficiente para colgar noticias de fichas de proyecto y parlamentario."*

**REFUTADA si**, tras medir todos los candidatos: ningún modelo alcanza T3; **o** ningún modelo
alcanza T4 con n≥25; **o** el mejor aprueba T3/T4 pero viola T1. **Refutación parcial:** si T9 falla
o queda `no-medido`, el enrutamiento a fichas de persona **no entra a producción** aunque el resto
apruebe — la fase entrega el carril de proyectos y **declara** el de personas no habilitado.

**Consecuencia escrita ANTES de medir:** NEWS-05 no entra a producción por defecto ni por silencio.
Salidas honestas: (a) publicar solo el vínculo determinista sin etiqueta; (b) declarar 135 fallida y
reportarlo. **Bajar el umbral después de ver el número no es salida válida.** Moverlo exige firma del
operador + entrada en `CONGELADO.md` con el hash anterior + que el reporte **cite ambos números**.

---

## D-133-E2 — FORMATO DE CONGELACIÓN (enmienda de D-133-E; resuelve B8, P-11)

Se conserva el núcleo: 5 artefactos en `packages/news/src/eval/`; se hashean los **3 JSON
canonicalizados** (`taxonomia.json`, `golden-set.json`, `thresholds.json`); **nunca el `.ts`**
(daría drift falso por formateo); canonicalización definida (claves ordenadas por code unit
recursivamente, **arrays sin reordenar**, 2 espacios, **LF**, UTF-8 sin BOM, newline final); test que
**regenera `taxonomia.json` desde `taxonomia.ts`** y compara byte a byte (hace estructuralmente
imposible la deuda de ICS); cambio legítimo = **un commit con las tres cosas** (artefacto + hash en
el test + entrada en `CONGELADO.md` con `hash_anterior → hash_nuevo`, fecha, razón, firma).

**Enmiendas:**

1. **`.gitattributes` es la PRIMERA tarea del plan, con control positivo.** No existe en ningún punto
   del árbol (verificado). Crearlo *después* de commitear los JSON exige `git add --renormalize` o el
   índice conserva CRLF y **el hash se mueve solo** — es el gotcha del `psql -tA` con CRLF de v12.0
   repetido. Patrón: `packages/news/src/eval/**/*.json text eol=lf` (con `**` para cubrir
   subdirectorios futuros). **Control positivo obligatorio:** clonar limpio en un segundo directorio
   y verificar que los tres sha256 coinciden. Un hash cuya estabilidad se **asume** es peor que no
   tener hash: enseña al equipo a ignorar la CI roja.
2. **`CONGELADO.md` entra al test.** No estaba hasheado por nada, así que el log que "delata el
   drift" era él mismo editable sin rastro. `congelado.test.ts` ahora también asserta que **la última
   entrada de `CONGELADO.md` contiene exactamente los tres hashes vigentes**. Limitación residual
   declarada: la **firma** sigue siendo un string en un markdown; el control real es el commit
   firmado en git, y se dice así en vez de fingir garantía.
3. **El test asserta el conteo impreso, no el exit code.** `passWithNoTests: true` está activo y los
   args de `vitest run` son **filtros de nombre, no rutas** ⇒ un `<automated>` puede salir 0 sin
   correr nada. Todo criterio de aceptación de esta fase verifica `Tests N passed`.

---

## D-133-F2 — RE-RUNNABILIDAD (enmienda de D-133-F; resuelve B6)

Se conserva íntegro: **puntero Y payload**; el puntero solo no basta porque (1) re-parsear el XML con
un parser que evoluciona movería la vara bajo los pies del eval y (2) el gate de CI corre **sin red y
sin credenciales R2**; el puntero se conserva porque la trazabilidad es el core value; el test de
deriva de parser corre **local, jamás en CI**, y si diverge **no falla el golden**: emite reporte —
**el golden es la vara, el parser es lo que se mueve**. Copyright y PII sin cambios: solo titular +
descripción del RSS, cero full-text, cero PII añadida, cero cruce con `parlamentario`, cero
causalidad ni intención.

**Enmienda única — el truncado se alinea con el pre-filtro:**

El pre-filtro decide sobre `LIMITE_DESCRIPCION = 600` (`packages/news/src/prefiltro-lexico.ts:50`)
mientras `entrada_llm` se truncaba a **300** ⇒ `prefiltro.terminos` podía citar un término **ausente**
del input del clasificador, el anotador no podría citar el fragmento que C2.2 exige, y el golden
penalizaría al modelo por información **amputada**. Un golden que mide "el pipeline completo" no puede
tener dos etapas mirando ventanas de texto distintas.

1. **`entrada_llm` usa la MISMA función de truncado que el pre-filtro**, importada de
   `prefiltro-lexico.ts` — no una constante replicada. Una constante copiada es la deuda de ICS en
   miniatura; el import la hace estructuralmente imposible.
2. **Validación ANTES de etiquetar** (minutos, determinista): contar qué fracción de los casos P
   tiene **todos** sus `prefiltro.terminos` presentes dentro de `entrada_llm`. **Cobertura < 95 % ⇒
   el límite sube antes de que se etiquete un solo caso.** El orden importa: subirlo *después* cambia
   `entrada_llm`, cambia el hash de `golden-set.json` y obliga a **re-etiquetar todo**.
3. Se mantiene el encapsulado anti-prompt-injection: el titular es **DATO, nunca instrucción**. 600
   chars de una descripción RSS que el medio publica para redistribución sigue siendo cita breve; se
   declara el cambio de límite y su razón en `CONGELADO.md`.

---

## D-133-H — RECONCILIACIÓN CON EL SC1 LOCKED DE LA PHASE 134 (resuelve B9)

**Se BORRA de la adjudicación de 133 la frase que redefinía el contrato de 134** (`133-ADJUDICACION.md:268-269`:
*"el LLM jamás emite el número de boletín ni el nombre resuelto"*). Contradice un criterio ya
congelado: `ROADMAP.md:232`, SC1 de la Phase 134, dice literalmente *"El LLM emite boletín/nombre de
la lista cerrada inyectada en el prompt (3.675 boletines / 186 parlamentarios; jamás un id)"*.

Son dos arquitecturas distintas: **allowlist inyectada + emisión restringida + resolver que mapea**
(ROADMAP) vs **LLM sin contacto con identificadores + extracción puramente determinista** (la frase
borrada). La segunda es más estricta, pero **133 no es la fase que puede cambiar un SC LOCKED de
otra fase** — ese es justamente el mecanismo por el que un requisito se pierde sin que nadie lo
decida.

**Lo único que 133 afirma sobre esto, y que la sustituye:**

> *La taxonomía no nombra sujetos. El vínculo a boletines y personas es de la Phase 134, bajo su
> propio SC1 LOCKED.*

**Si el operador quiere la arquitectura más estricta**, corresponde una **enmienda explícita al SC1
de la Phase 134**, con su texto propio y su firma propia — no un párrafo lateral en la adjudicación
de 133. **No se propone aquí**; se deja señalado.

**Deuda arquitectónica declarada (no resuelta en 133):** `extraerBoletines` vive en
`app/lib/boletin-en-materia.ts:58`, no en `packages/`, y su segundo fail-closed es la RPC
`lobby_menciones_de_boletin` (`:29-33`). "Reusarlo sin reescribirlo" desde `packages/news`
**invertiría la dirección de dependencia del monorepo** (`app` → `packages`, nunca al revés). La
adjudicación anterior lo daba por resuelto. **Es problema de la Phase 134** y su plan debe resolverlo
explícitamente (mover el símbolo a `packages/` conservando diff-cero de comportamiento, o invocar el
carril desde `app/`) — se registra aquí para que 134 no lo descubra a mitad de camino.

---

## D-133-I — PARTICIÓN DE LA FASE Y ORDEN DE FIRMA (resuelve B7)

La Phase 133 se ejecuta en **dos actos con firma independiente**:

**133-a — HOY, sin datos nuevos.** Todo lo congelable sin muestra: `taxonomia.ts` + su proyección
canónica, `thresholds.json`, el esquema del caso golden, el script de canonicalización,
`.gitattributes` + control positivo del hash, los guards G1/G2/G3, y la validación de cobertura del
límite de truncado. **Cierra con la firma del operador sobre la taxonomía y los umbrales — que es
exactamente la firma que debe preceder a cualquier medición.**

**133-b — DESDE EL 2026-08-07.** Construcción del golden, calibración humana ciega, doble etiquetado,
arbitraje, cómputo de los dos kappas, y congelación con hash. Cierra con la segunda firma, ya **con
κ, n por clase e IC a la vista**.

Razón: la ventana de 3 días es **tiempo de calendario, no trabajo pendiente** — el RSS no da
histórico y el conector acumula el crudo con su corrida normal. La adjudicación anterior proponía
solapar la espera con "la planificación de 134", pero el ROADMAP declara **134 `Depends on: Phase 133`**
(`ROADMAP.md:229`): el solapamiento era con una fase que por contrato no puede empezar. Partir la
fase entrega hoy el checkpoint valioso en vez de comprar un bloqueo de 48 h.

---

## Lo que esta re-adjudicación NO decide

Sin cambios respecto de la lista original, menos el punto 6 (que muere con `agenda_ejecutivo`):

1. El prompt exacto del clasificador de 135 — solo se fija que **se construye desde `taxonomia.ts`**.
2. Qué modelos entran al benchmark y en qué orden de tier — solo que Granite es candidato y que su
   aprobación **no se transfiere de dominio**.
3. El schema Supabase de la etiqueta (columna vs tabla con historial) — es de 135, con su migración y
   su pgTAP.
4. Los nombres de archivo internos más allá de los cinco listados y la forma exacta del script de
   canonicalización.
5. La política de re-etiquetado cuando la taxonomía cambie en un milestone futuro.
6. Ampliar `VOCABULARIO_LEGISLATIVO` si N-sonda caza falsos negativos — la regla (**solo se AMPLÍA,
   nunca se poda**) ya es LOCKED; qué términos, es del plan con test.
7. El presupuesto y ledger de llamadas — de 135.
8. La forma exacta de la página pública "Cómo clasificamos las noticias" — es de 137; aquí solo se
   congela **que existe y qué debe contener**.

---

## Lo que requiere firma del operador — CHECKPOINT 133-a

> ### ✅ FIRMADO POR EL OPERADOR — 2026-08-06
>
> **Verbatim:** *"consideralo firmado."*
>
> Alcance de la firma: **los puntos 2 a 7 de la tabla siguiente**, es decir la totalidad de
> D-133-A2, D-133-B2, D-133-C2, D-133-D2, D-133-E2, D-133-F2, D-133-H y D-133-I.
> A partir de esta firma esas decisiones son **LOCKED**: no se re-abren, y los artefactos de 133-a
> pueden congelarse y hashearse. El golden set (133-b) conserva su **segunda firma**, que ocurre
> después con κ, n por clase e IC a la vista.
>
> Compromisos de operador que la firma activa:
> - **20 casos etiquetados a ciegas** por el operador antes de ver cualquier etiqueta de máquina
>   (D-133-C2.1.2) — en 133-b.
> - **Sesión de arbitraje** de hasta 25 desacuerdos (D-133-C2.3) — en 133-b.

En este orden. Los puntos 0 y 1 ya estaban firmados; 2-7 quedan firmados el 2026-08-06.

| # | Qué firma | Estado |
|---|---|---|
| 0 | **D-133-RATIF** — Opus adjudica mientras Fable no tenga créditos | ✅ FIRMADO 2026-08-05 |
| 1 | **D-133-G** — la etiqueta es interna, jamás se muestra | ✅ FIRMADO 2026-08-05 |
| 2 | **La taxonomía de D-133-A2** — 5 clases + `ambiguo`, con `agenda_ejecutivo` **fusionada** en `politica_no_legislativa`, `ley_vigente` redefinida en términos textuales, la **regla de decidibilidad textual**, y la regla de qué cuelga de la ficha de una persona (A2.3). | ✅ FIRMADO 2026-08-06 |
| 3 | **Los umbrales de D-133-D2** — **seis vetos, no cinco**: T1, T2, T3 (macro-promedio), T4 (n≥25), T5, **T9 nuevo**; cada uno con su n mínimo; la regla de intervalos; y la refutación pre-registrada, incluida la **refutación parcial** que deja el carril de personas fuera de producción si T9 no se mide. | ✅ FIRMADO 2026-08-06 |
| 4 | **El protocolo de D-133-C2** — dos anotadores de **modelos distintos**, y **20 casos que el operador etiqueta a ciegas ANTES** de ver cualquier etiqueta de máquina (~30 min, es el control positivo apareado que hace interpretable el κ). | ✅ FIRMADO 2026-08-06 |
| 5 | **La ventana de 3 días y sus 15 requests** (D-133-B2), dentro de la corrida normal del conector, con la regla de decisión del día 2 y el **piso 100 como compromiso real** (el 140 deja de ser objetivo firmado). | ✅ FIRMADO 2026-08-06 |
| 6 | **D-133-H** — que 133 **no** redefine el SC1 de 134; y si quiere la arquitectura más estricta, que se tramite como **enmienda explícita al SC1 de la Phase 134**, aparte. | ✅ FIRMADO 2026-08-06 |
| 7 | **D-133-I** — partición 133-a / 133-b; se firma **hoy** lo congelable sin muestra, y el golden se firma después con sus números a la vista. | ✅ FIRMADO 2026-08-06 |

**Nada se congela ni se hashea antes de esta firma.** Congelar un artefacto que el operador puede
revocar es fabricar una vara falsa.

---

## RESUMEN EJECUTIVO

| # | Decisión | Núcleo |
|---|---|---|
| **D-133-A2** | **Taxonomía** | **Regla de decidibilidad textual**: una clase que exige un hecho del corpus es ilegal (el clasificador no consulta el corpus). ⇒ **`agenda_ejecutivo` muere** (indecidible + n<8 proyectado) y `ley_vigente` se redefine por marca textual. Quedan **5 clases + `ambiguo`**, precedencia `1>2>3>4>5`. Regla explícita de qué cuelga de la ficha de una **persona** (etiqueta + nombre en el texto + resolución sin ambigüedad; si no, dead-letter). Copy: **G1** guard de términos prohibidos sobre `taxonomia.ts`, **G2** guard de superficie de D-133-G, **G3** el skip silencioso del guard existente pasa a **fallo duro** — los tres con control positivo apareado. |
| **D-133-B2** | **Golden set** | **Piso 100 = el compromiso; 140 deja de ser objetivo firmado** (el día 1 fue arranque en frío; con dedup los días 2-3 son delta: P ∈ [40,75]). Nuevo estrato **P-dirigido**: el muestreo **garantiza** n≥25 en `tramitacion_legislativa` y `actividad_parlamentaria`, no los descubre. Regla de decisión al día 2 (delta<15 ⇒ N-alea 50→70, sin extender ventana, sin ablandar el pre-filtro). Se agrega "**nada sobre prevalencia**" a las limitaciones, y estas pasan a ser **entregable público** de 137. |
| **D-133-C2** | **Protocolo** | Anotadores de **modelos distintos** (Sonnet + Opus) — dos Sonnet medían auto-consistencia. **Calibración humana ciega de 20 casos** antes de ver nada, con dos kappas publicados y regla de interpretabilidad (Δκ > 0,15 ⇒ el κ de máquina no vale). El **cap de 25 deja de ser puerta** (contradecía acuerdo ≥0,80, que a n=140 admite 28) y pasa a presupuesto de sesión; el resto se marca `ambiguo_no_arbitrado` y se reporta. **Condición de refutación escrita**: dos rondas y se declara la taxonomía no etiquetable ⇒ 133 reporta fracaso. |
| **D-133-D2** | **Thresholds** | **Seis vetos**. **T9 `precision_actividad_parlamentaria ≥ 0,90`** nuevo, con la **asimetría inversa** escrita: ahí no hay resolver que mate el falso positivo, y con D-133-G no hay etiqueta a la vista que lo matice. **T3 pasa a macro-promedio por clase** (era una accuracy global sobre una mezcla artificial, que D-133-B prohibía). **Cada veto con su n mínimo (25)**: bajo eso no veta, se reporta `no-medido` y **la clase no enruta** — fail-closed. **El intervalo importa para ambas cosas**: vetos sobre la puntual pero marcados `dentro-del-ruido` si el IC cruza, y el desempate por **solapamiento de IC**, no por los 6 pp. Granite candidato, **sin transferencia de dominio**. |
| **D-133-E2** | **Congelación** | Núcleo intacto (3 JSON canónicos hasheados, nunca el `.ts`; test que regenera la proyección). **`.gitattributes` es la primera tarea** —no existe en el repo— con `**/*.json text eol=lf`, `git add --renormalize` y **control positivo: clon limpio y los tres sha256 coinciden**. `CONGELADO.md` entra al test (su última entrada debe contener los tres hashes vigentes); la firma-en-markdown se declara como limitación, no como garantía. Todo criterio asserta **`Tests N passed`**, no el exit code. |
| **D-133-F2** | **Re-runnabilidad** | Puntero **Y** payload sin cambios. **`entrada_llm` se alinea a los 600 chars del pre-filtro importando su misma función de truncado** (300 vs 600 hacía que el golden penalizara al modelo por texto amputado). **Validación de cobertura ANTES de etiquetar**: si <95 % de los `prefiltro.terminos` está dentro de `entrada_llm`, el límite sube antes de etiquetar un solo caso — después obliga a re-etiquetar todo. |
| **D-133-H** | **Reconciliación 134** | Se **borra** la frase que redefinía quién emite el boletín. 133 solo afirma: *la taxonomía no nombra sujetos; el vínculo es de 134 bajo su SC1 LOCKED*. La arquitectura más estricta, si se quiere, es **enmienda explícita al SC1 de 134**. Deuda declarada para 134: `extraerBoletines` vive en `app/`, y reusarlo desde `packages/news` invertiría la dependencia del monorepo. |
| **D-133-I** | **Partición** | **133-a hoy** (taxonomía + umbrales + formato + guards + `.gitattributes`, y la firma que precede a toda medición); **133-b desde el 2026-08-07** (golden, etiquetado, kappas, congelación). La ventana es calendario, no trabajo pendiente, y 134 no puede solaparse porque depende de 133. |

---

*Phase 133 — NEWS-TAXO · Re-adjudicación escrita por Opus, 2026-08-05, bajo D-133-RATIF.
No modifica `133-ADJUDICACION.md` ni `133-PREMORTEM.md`.*
