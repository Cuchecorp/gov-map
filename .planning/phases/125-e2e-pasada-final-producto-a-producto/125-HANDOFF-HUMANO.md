---
fase: 125-e2e-pasada-final-producto-a-producto
plan: 07
tipo: handoff
fecha: 2026-07-29
items_cerrados_en_la_fase: 3
items_de_juicio_humano_pendientes: 1
hallazgos_escalados: 3
deuda_de_operador_renombrada: 9
aprobados_por_silencio: 0
deliverable_padre: 125-E2E.md
---

# Phase 125 · Handoff humano — lo que esta fase **NO** cierra

Mismo régimen de `124-HANDOFF-EXACTITUD.md`: **cada ítem lleva sus cinco campos obligatorios** —
**qué es** · **evidencia** · **forma del cierre** · **destino nombrado** · **quién lo cierra**. Un ítem
sin destino sería un ítem cerrado en silencio.

**Regla rectora de este documento: cero aprobados por silencio.** Un ítem de juicio humano sólo figura
como aprobado si existe **respuesta verbatim del operador**. La ausencia de respuesta produce un
**handoff con destino escrito**, nunca un PASS. La corrida CIERRA igual (patrón v7/v9/v10/v11).

---

## 0. Índice

| ítem | clase | estado | destino | quién |
|---|---|---|---|---|
| **C-1** | ítem post-deploy de 122 | **CERRADO** en el Plan 02 | — | — |
| **C-2** | ítem post-deploy de 122 | **CERRADO** en el Plan 02 | — | — |
| **C-3** | juicio de copy de 122 + gate del Plan 06 | **CERRADO — APROBADO** (verbatim) | — | operador (ya respondió) |
| **P-1** | lectura fría de las 82 filas de `122-CRUCES-SQL.md` | **PENDIENTE — opcional, NO ejercido** | lectura fría de operador, cuando se quiera | operador |
| **H-01** | hallazgo escalado | **ABIERTO** | fase de código futura (exige re-deploy) | agente |
| **H-03** (`4.9-A1`) | hallazgo escalado | **ABIERTO** — `NOT OBSERVED` | verificación manual / fase de DOM futura | operador o agente |
| **H-06** | hallazgo escalado | **ABIERTO** | fase que audite la selección del timeline | agente |
| **OP-1**, **OP-4** | deuda de operador (124) | 🔴 **ELEVADA**, viva | checkpoint de operador · `supabase-architect` | operador → architect |
| **B-01**, **B-02**, **B-03** | backlog de exactitud (124) | vivos; **síntoma observado en esta pasada** | próxima auditoría de régimen | agente |
| **CF secrets + `GEMINI`** | deuda de operador (118) | viva | `118-OPERATOR-CHECKPOINT.md` | operador |
| **identidad local** | deuda de operador | viva | operador | operador |
| **flip MONEY** | deuda de operador / legal | viva; gatea F-08 y `D-01` de 124 | checkpoint de operador (Ley 21.719) | operador |
| **provisión NOTIF** | deuda de operador | viva | checkpoint de operador | operador |
| **rotación B26** | deuda de operador | viva | operador | operador |
| **catálogo 113** | corrección documental | 2 ítems pendientes de anotar | catálogo `113-INVENTARIO.md` | agente, fase futura |
| **fila `3.3`** (122) | backlog de exactitud — **añadida por la auditoría de cierre 2026-07-29** | viva; destino a 124 **no llegó** | próxima auditoría de régimen | agente |
| **fila `4-15`** (122) | defecto **D2** del materializador `0065` — **añadida por la auditoría de cierre 2026-07-29** | viva; destino a 124 **no llegó** | próxima fase que toque `0065` | agente |

---

## 1. Los 2 ítems post-deploy de 122 — **CERRADOS** (no viajan)

`122-VERIFICATION.md` dejó **4** ítems de `human_verification`. **Dos** eran post-deploy, es decir
esperaban exactamente esta fase, y **el Plan 02 los cerró midiendo el deploy**. Se registran aquí como
cerrados —con el fragmento DOM que los cierra— y **no** viajan al handoff.

### C-1 — `/parlamentario/S1338` sin dígito en capa-1 de lobby, y sin afirmar ausencia

- **Qué es.** El fix CR-01 de 122 (`no_ingerido` ≠ `0 reuniones`): un estado no ingerido **no puede**
  mostrar un conteo ni afirmar una ausencia en la fuente.
- **Evidencia (fragmento DOM que lo cierra).** `125-E2E-A-FICHAS.md` §1.1, bloque de lobby aislado por
  offsets (`id="lobby"` @101630 → `id="patrimonio"` @101890, **260 bytes**), verbatim:
  ```html
  <section id="lobby" class="mt-12">…<h2 class="text-xl font-semibold">Reuniones de lobby</h2><span class="text-sm text-muted-foreground">—</span></div><div class="space-y-3"></div></section>
  ```
  Texto visible: `Reuniones de lobby—`. Dígitos en el bloque: **0**. Frase `en las fuentes consultadas`
  en el bloque: **0** (existe **6** veces en la página, ninguna dentro del bloque — alcance declarado).
  Confirmado **hidratado** en `125-E2E-D-BROWSEROS.md` §1.2-A3. No-regresión de `D1165`: **112**.
- **Forma del cierre.** Ya cerrado por medición sobre el deploy `0ea5d97f`.
- **Destino nombrado.** Ninguno — **cerrado**.
- **Quién lo cierra.** Cerrado por el **Plan 02** (agente).

### C-2 — línea de cobertura antes del conteo en `/proyecto/14309-04`

- **Qué es.** El fix 5.12 de 122: la línea de cobertura del canal lobby↔PL debe renderizar **después
  de la leyenda y antes del conteo**, con su cifra y su fecha.
- **Evidencia (fragmento DOM que lo cierra).** `125-E2E-A-FICHAS.md` §1.3: orden probado **por
  offsets** en el HTML real, `1.231.587 < 1.231.877 < 1.232.183`, y en el payload de flight, en **dos**
  boletines (`14309-04` y `16849-12`). Verbatim:
  ```
  195 de las 5.106 audiencias registradas con parlamentario identificado y materia publicada citan el
  número de un boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa
  parte del registro.
  ```
  `Q-74` re-ejecutada: `5106|195|82|3.82` ⇒ **la cifra horneada sigue vigente**, no hay que actualizar
  `COBERTURA_MENCIONES_LOBBY`.
- **Forma del cierre.** Ya cerrado por medición sobre el deploy.
- **Destino nombrado.** Ninguno — **cerrado**.
- **Quién lo cierra.** Cerrado por el **Plan 02** (agente).

---

## 2. C-3 — juicio de copy (ítem 2 de 122 + gate del Plan 06): **CERRADO, APROBADO verbatim**

- **Qué es.** El juicio editorial sobre la línea de cobertura horneada `COBERTURA_MENCIONES_LOBBY`
  (`app/components/lobby-menciones-de-boletin.tsx:135`) y sobre el carril de lobby de un senador:
  ¿describen el recorte del canal **sin insinuar ocultamiento ni causalidad**? ¿el parcial se lee como
  parcial y nunca como total?
- **Evidencia.** `125-E2E-D-BROWSEROS.md` §3.3, respuesta **verbatim del operador**:
  ```
  Aprobado — cierro el gate
  ```
  Enunciado aprobado, verbatim: *«el copy pasa — describe el recorte del canal sin insinuar que se
  esconde algo, y el 3,8 % se lee como cobertura parcial declarada»*. **Fecha:** 2026-07-29.
  **Vía:** acto explícito del operador transmitido por el orquestador — **no** inferido del silencio
  (T-125-18 respetada: la versión previa del artefacto decía `SIN RESPUESTA DEL OPERADOR — handoff` y
  sólo se sustituyó al llegar la respuesta real).
  El ítem 2 del gate (carril `Reuniones de lobby—` de `S1338`: em-dash, **sin número**, **sin afirmar
  ausencia en la fuente**) queda **cubierto por la misma aprobación**, tal como se le presentó.
- **Forma del cierre.** Cerrado. **Nada que hacer.**
- **Destino nombrado.** Ninguno — **cerrado en el Plan 06**.
- **Quién lo cierra.** El **operador** (ya lo hizo).

> **Alcance de esta aprobación, escrito para que no se sobre-lea.** El operador juzgó **COPY**: dos
> líneas de texto. Su aprobación **no** convierte `H-01`, **no** convierte `H-03` (`4.9-A1`), **no**
> convierte `H-06`, y **no** ejerció el ítem opcional `P-1`. Ninguno de los ítems de §3 y §4 cambia de
> estado por el cierre de este gate.

---

## 3. P-1 — lectura fría de las 82 filas de `122-CRUCES-SQL.md`: **PENDIENTE, no aprobado**

- **Qué es.** Ítem 1 de los cuatro `human_verification` de `122-VERIFICATION.md`: *«Lectura fría del
  artefacto `122-CRUCES-SQL.md` (2.700 líneas) por un humano sin abrir el código: ¿puede auditar las
  82 filas sin ayuda?»*. `why_human` de origen: *«Auditabilidad por un lector es juicio humano, no
  verificable por grep»*.
- **Evidencia.** Se presentó como **Pregunta 3, explícitamente opcional**, en el gate del Plan 06
  (`125-E2E-D-BROWSEROS.md` §3.2). El operador respondió a la Pregunta 1 y **no ejerció** la 3. La
  tabla de disposición del propio artefacto lo dice verbatim: *«**OPCIONAL — NO EJERCIDO.** Era
  opcional por diseño; el operador no lo ejerció y **no** se declara aprobado ni rechazado»*.
- **Forma del cierre.** Un humano lee `122-CRUCES-SQL.md` de principio a fin **sin abrir el código** y
  responde si las 82 filas se auditan solas (cada fila con su query, sus dos números y su veredicto de
  3 valores). Es lectura, no ejecución: cero comandos, cero riesgo.
- **Destino nombrado.** **Lectura fría de operador**, cuando el operador quiera ejercerla. No gatea
  nada de esta fase ni del cierre del milestone: el requirement `E2E-01` no depende de él, y el
  artefacto de 122 ya está `validado` por su propio verificador.
- **Quién lo cierra.** El **operador**. **Prohibido** marcarlo como aprobado por silencio: hoy figura
  como **PENDIENTE — no ejercido**, que es lo que es.

---

## 4. Hallazgos de esta pasada escalados a fase futura

Los tres llevan su id de §4 de `125-E2E.md`.

### H-01 — error transitorio hidratado en `/comparar`

- **Qué es.** `/comparar?a=D1170&b=D1165` renderizó un error boundary visible **sólo tras
  hidratación**: `No pudimos cargar la portada / Ocurrió un error al consultar los datos. Esto es una
  falla técnica, no una ausencia de información: no asumas que no hay registros. / Reintentar`.
- **Evidencia.** `125-E2E-D-BROWSEROS.md` §1.6, con captura preservada
  (`captures/comparar-D1170-D1165-HALLAZGO-error-transitorio.png`). Caracterización: `curl` de **5**
  variantes → **0** ocurrencias, HTTP 200 en las cinco ⇒ **el HTML servido está limpio** y ningún plan
  de wave 2 podía verlo. Re-test con BrowserOS: `h1 = Comparar dos parlamentarios` en **3/3** ⇒
  **transitorio, no reproducible** (1 de 2 observaciones del mismo par). Severidad **baja**.
  Observación de copy adyacente: dice *"la portada"* en `/comparar`, lo que sugiere un error-boundary
  con texto reutilizado — es observación, **no** la causa.
- **Forma del cierre.** Reproducir bajo carga / instrumentar el error boundary de `/comparar`, y —si se
  confirma— corregir la consulta de datos en cliente/RSC. Un fix exige **re-deploy**, y esta fase ya
  desplegó su bundle: meterlo aquí rompería la trazabilidad de la versión auditada.
- **Destino nombrado.** **Fase de código futura** (la primera que vuelva a desplegar `app/`).
- **Quién lo cierra.** Agente, en esa fase. **ABIERTO.**

### H-03 (`4.9-A1`) — el href `/red?seed=<vecinoId>` no se observó en el DOM

- **Qué es.** El caso `4.9-A1` del manifiesto de links pide que `/red?seed=D1165` emita
  `href="/red?seed=…"`. El emisor real es `red-graph.tsx:210` (`"use client"`), y el href se genera
  **por vecino**, no por la semilla.
- **Evidencia.** `125-E2E-D-BROWSEROS.md` §1.5: `a[href^="/red?seed="]` = **0** antes de interactuar,
  **0** después del `click` en `button "Vecino: Alejandra Valdebenito Torres"`. El click se ejecutó
  (`Clicked [137] at (531, 336)`) pero la tarjeta **no expandió** bajo página oculta, y la captura la
  muestra aún colapsada (`2 hechos →`). Lo que **sí** quedó probado: el contenedor está vivo e
  interactivo (10 botones `Vecino:` con nombre accesible, paginación, filtros).
  Además `125-RE-VERIFICACION.md` §1.4 (`H-125-05-A`) registró que el **caso está mal instanciado**:
  se instanció con el propio seed, el único id que jamás será vecino de sí mismo.
- **Forma del cierre.** Observar el href con la tarjeta del vecino **realmente expandida** (página
  visible, no oculta), o corregir la instanciación del caso en el manifiesto de 114 —que esta fase
  tenía **prohibido** modificar—. **Fabricar la revelación vía `$RC` o DOM sintético sigue
  prohibido**: sería inventar la evidencia.
- **Destino nombrado.** **Verificación manual** (un humano abre `/red?seed=D1165`, expande un vecino y
  confirma el enlace `Ver la red de esta persona →`) **o** fase futura de DOM que corrija el caso del
  manifiesto.
- **Quién lo cierra.** Operador (verificación manual) o agente (corrección del manifiesto).
  **ABIERTO — `NOT OBSERVED`: ni PASS ni defecto.**

### H-06 — `85` `Hito del` contra `99` eventos en `14309-04`

- **Qué es.** El timeline de `/proyecto/14309-04` rinde **85** rótulos `Hito del` contra **99** filas
  en `tramitacion_evento`. Se muestran **menos**, nunca más ⇒ **cero relleno, cero invención**.
- **Evidencia.** `125-E2E-A-FICHAS.md` §3.3. Cuadre 1 a 1 en los demás casos (`Hito del` = **355** =
  eventos de `17870-05`; `Votada el` = **7** / **256** = votaciones de cada boletín), lo que aísla el
  caso: no es un defecto de rótulo ni de helper.
- **Forma del cierre.** Escribir la query que gobierne la **regla de selección** de eventos del
  timeline y compararla con el DOM. 117 fijó el **rótulo** (F-07) y el **helper** (F-05), **no** la
  cardinalidad; declarar `cuadra` sin esa query sería afirmar lo que no se midió.
- **Destino nombrado.** **Fase que audite la selección de eventos del timeline** (auditoría, no fix).
- **Quién lo cierra.** Agente. **ABIERTO.**

---

## 5. Deuda de operador viva — re-nombrada para que no se pierda

Esta fase **no toca** ninguno de estos ítems. Se re-nombran con su origen porque una pasada E2E es
exactamente el momento en que la deuda se vuelve visible.

| ítem | qué es | evidencia / origen | forma del cierre | destino nombrado | quién |
|---|---|---|---|---|---|
| **`OP-1`** 🔴 | probe REST read-only con la anon key contra `pg_version`, `runtests`, `col_is_null` | `124-HANDOFF-EXACTITUD.md` §6; `LIM-6-01`/`LIM-6-02` de 123 siguen abiertos | 3 requests REST, sin escritura, con la respuesta HTTP registrada | **checkpoint de operador** | operador |
| **`OP-4`** 🔴 | decidir el destino de `pgtap` en PROD y de las 7 suites pgTAP que dependen de ella | `124-HANDOFF-EXACTITUD.md` §7; `OFF-6-01` (1.079 funciones exec-`anon` en `public`) | decisión + migración diseñada, con el destino de las suites resuelto **antes** de tocar la extensión | **`supabase-architect` + checkpoint de operador** | operador → architect |
| **`B-01`** | cap de **1.000** en votos, con distorsión de composición (`fecha desc`) | `124-HANDOFF-EXACTITUD.md` §1. **Síntoma observado en esta pasada:** el botón dice literalmente `Ver detalle (1000)` en el DOM hidratado, con `973 de 1000` y Σ `1000`, mientras `Q-16` da **3752**. El clamp de `0078` está en PROD y topa en **4000**, pero el **call-site sigue pasando 1.000** | RPC de conteo dedicada, aditiva (no altera la firma de `votos_de_parlamentario`) | **próxima auditoría de régimen** (backlog de exactitud) | agente |
| **`B-02`** | el tile *Por materia* agrupa **3.100 de 3.675** (84,4 %) sin declarar cobertura | `124-HANDOFF-EXACTITUD.md` §2. **Síntoma observado:** 10 filas `N proyectos`, **cero denominador** en el DOM (fila 4-14, `125-E2E-B` §2.2) | firma v2 paralela que emita el denominador (precedente `0060`) | **próxima auditoría de régimen** + su cambio de UI | agente |
| **`B-03`** | aserción de guard para vistas nuevas en `public` sin `security_invoker` | `124-HANDOFF-EXACTITUD.md` §3. Hoy **cero vacuo** (0 vistas en `public`) | test estático en `lockdown-guard.test.ts`; **cero DDL** | **próxima auditoría de régimen** (fase de guards) | agente |
| **CF secrets + `GEMINI`** | provisión de secrets de Cloudflare y de la key de Gemini para los crons | `118-OPERATOR-CHECKPOINT.md` | cargar los secrets en el dashboard / `wrangler secret put` (acto de operador) | **`118-OPERATOR-CHECKPOINT.md`** | operador |
| **identidad local** | corrida de identidad en local (operador) | deuda viva desde 118 | corrida local, idempotente | operador | operador |
| **flip MONEY** | `MONEY_PUBLIC_ENABLED` tras la revisión legal (Ley 21.719) | `125-E2E-C-GATES.md` §6 ítems 1-2; **secret AUSENTE = OFF** verificado en esta fase. **Gatea F-08 de 117** (su copy no es observable con el bloque sin emitir) y **`D-01` de 124** (los techos de `aportes`/`contratos` se fijaron sobre tablas vacías: `4 × 0 = 0` no es un techo) | revisión legal → `wrangler secret put` → re-medición `M-PARL` + migración si el máximo real supera 5.000 | **checkpoint de operador** | operador → agente |
| **provisión NOTIF** | `NOTIF_PUBLIC_ENABLED` + los 8 ítems de provisión de v10.0 | `125-E2E-C-GATES.md` §6 ítem 3; secret **AUSENTE = OFF**; `/cuenta` sirve `Las suscripciones no están disponibles en este momento.` (200, no 500) | provisión + flip | **checkpoint de operador** | operador |
| **rotación B26** | rotación de credenciales pendiente | deuda viva desde v11.0 | rotación en el dashboard | operador | operador |

### Añadidos por la auditoría de cierre del milestone (2026-07-29)

> **Por qué se añaden aquí y no estaban.** La auditoría de cierre de v12.0
> (`.planning/v12.0-MILESTONE-AUDIT.md` §3) encontró que las filas **`3.3`** y **`4-15`** de la
> Phase 122 están declaradas en el cuerpo de [`125-E2E.md`](./125-E2E.md) §3 pero **ausentes del
> índice §0 y de las tablas de este handoff**: salían del milestone **sin dueño**, lo que contradice
> la regla rectora de este documento (*«un ítem sin destino sería un ítem cerrado en silencio»*). El
> destino que 122 les escribió era la **Phase 124**, y **no llegó** a ninguna de las dos. Se
> recuperan aquí con sus cinco campos. **No estaban desde el principio** — esta nota existe para que
> quede la traza.

| ítem | qué es | evidencia | forma del fix | destino nombrado | quién |
|---|---|---|---|---|---|
| **fila `3.3`** (122) | co-autoría de `/comparar` **truncada a 20**: el SQL de PROD dice **0** co-firmados compartidos y el sitio **declara indeterminación** en vez de afirmar el cero. Es el **fail-closed de CR-01, deliberado** — no un bug de render: la RPC no emite membresía de par, así que el sitio no puede distinguir "no comparten" de "no lo sé" y elige no saber | `122-CRUCES-SQL.md` fila `3.3`; declarada también en `125-E2E.md` §3. Destino que 122 le escribió: *«Phase 124 (rediseño de RPC)»* — **no llegó** | **rediseñar la RPC para que emita membresía de par** (no maquillar el cliente); mientras no exista, la indeterminación declarada es la lectura honesta y **se queda** | **próxima auditoría de régimen** (junto a `B-01`/`B-02`/`B-03`) | agente |
| **fila `4-15`** (122) | **dos grafías de cámara conviviendo en la landing**: `Senado` / `C.Diputados` (normalizadas) junto a `senado` / `camara` (crudas). Es el defecto **D2** del materializador, `0065:233,261` | `122-CRUCES-SQL.md` fila `4-15`; defecto **D2** LOCKED desde 98-01 (*«normalizar camara dos grafias»*), emisor `0065:233,261`. Destino que 122 le escribió: *«Phase 124 (corrección en 0065)»* — **no llegó** | corregir **en el materializador `0065`**, **NO maquillar en el cliente** (adjudicación ya escrita por 122). Migración **aditiva nueva**; `0065` no se edita. **Es la más barata de las dos** | **próxima fase que toque `0065`** | agente |

---

## 6. Correcciones documentales pendientes (agente, fase futura)

| ítem | qué es | evidencia | forma del cierre | destino nombrado | quién |
|---|---|---|---|---|---|
| **H-02** | el catálogo 113 §4.1 afirma que con `S1338` *"A3 no ofrece la entrada `#cruces`"*; **el deploy lo contradice** | `125-E2E-A` §2.6 nota 1: `href="#cruces"` → **1** y `id="cruces"` → **1** en `S1338`. Coherente con 122 §2.4.4 (chip con estado `vacio` = `sin registros`) | anotar la corrección en `113-INVENTARIO.md` §4.1 | **catálogo `113-INVENTARIO.md`** | agente, fase futura |
| **H-04** | `E-049`/`E-023` sirven su copy **sólo en el payload RSC**: `grep -o "<main"` → **0** en el HTML SSR (HTTP 404 correcto, contenido hidratado confirmado) | `125-E2E-A` §2.6 / §3.6 · `125-E2E-D` §2.2-C1/C2 | anotar en el catálogo que ambos son **cliente-hidratados**; si se quisiera SSR, plan de código aparte | **catálogo `113-INVENTARIO.md`** | agente, fase futura |
| **H-07** | `og:image` / `twitter:image` apuntan a `http://localhost:3000/opengraph-image.png` en el deploy (falta `metadataBase`) | `125-E2E-C` §6 ítem 4; registrado en `deferred-items.md` | añadir `metadataBase` en el layout | **fase de código futura** (ajeno a los 5 gates) | agente |
| **H-08** | los `not-found` de contraparte y red comparten copy genérico **sin salida a la fuente**; sólo el de proyecto distingue "no ingresado aún" de "id incorrecto" y ofrece `Senado ↗` / `Cámara ↗` | `125-E2E-D` §2.2 nota de calidad | juicio editorial + copy; **no** fue parte de las 3 preguntas del gate aprobado | **fase de copy futura** | agente (con juicio de operador si se quiere) |
| **H-05** | `www.senado.cl` devolvió **520** el 2026-07-29T21:42Z para el caso `P-22-c01` (en 115 daba **200** con `content_type: application/msword`) | `125-RE-VERIFICACION` §2.4. **Fuente caída**, no patrón malo: cero reintento, cero evasión, cero cambio para forzar un 200 | re-probar el caso en la próxima corrida de links externos; si persiste, escalar como fuente indisponible | **próxima re-verificación de links externos** | agente |
| **M-1…M-6** | límites de instrumento de BrowserOS que el proyecto hereda: `bros-cli` **sale con 0** tras `CDP request timeout`; `get_page_content`/`innerText` **ciegos** a Suspense; `take_snapshot` sub-reporta interactivos; `grep -i`+`-F` = falso cero; `pipefail`+`grep -q` = exit 141; `git commit --amend` **inseguro** en waves paralelas sobre un mismo checkout | `125-E2E-D` §0.10 · `125-E2E-C` §0.2/§0.3 · `125-E2E.md` §0.4 (G-1…G-10) | quedan **como están**: son hallazgos de método, documentados para que ninguna fase futura los vuelva a pagar. Los commits atómicos por plan exigirían **worktrees separados** | **memoria de método del proyecto** | agente, cualquier fase que use estas herramientas |

---

## Cierre

**3 ítems cerrados en la fase · 1 ítem de juicio humano pendiente con destino escrito · 3 hallazgos
escalados · 9 deudas de operador re-nombradas · 6 correcciones documentales con destino · 0 aprobados
por silencio.**

Ningún ítem de este documento dice "más adelante". Cada uno dice **checkpoint de operador**,
**`supabase-architect`**, **próxima auditoría de régimen**, **catálogo 113**, **fase de código futura**
o **lectura fría de operador** — y nombra a quién le toca.

Deliverable padre: **[`125-E2E.md`](./125-E2E.md)**.
