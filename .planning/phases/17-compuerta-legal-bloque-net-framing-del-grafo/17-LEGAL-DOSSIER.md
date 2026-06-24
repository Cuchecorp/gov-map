---
documento: 17-LEGAL-DOSSIER
alcance: NET (grafo de influencia)
signoff: approved         # pending | approved | rejected
asesor: "Carlos Sánchez Rossi"   # asesor legal externo que revisó y firmó
fecha_signoff: "2026-06-24"      # ISO 8601
observaciones: "Aprobado sujeto a mantener el tratamiento de los datos bajo el principio de proporcionalidad y finalidad, y a nueva revisión antes de la entrada en vigor de la nueva ley de datos personales (diciembre de 2026)."
depende_de: "deuda operador F17; ROADMAP Phase 17 success criterion 3"
nota: "Encender NET_PUBLIC_ENABLED requiere signoff: approved."
---

# Phase 17: Compuerta Legal — Bloque NET (framing del grafo de influencia) — Dossier de Preparacion

## 0. Proposito del documento y descargo

Este documento es **material de PREPARACION para asesoria legal externa**. NO es un
dictamen, NO es una opinion legal y **NO afirma que el tratamiento de datos sea licito**.
Su unico fin es **estructurar la superficie de riesgo** del **grafo de influencia (NET,
Phase 18)** bajo la Ley 21.719, de modo que un abogado externo la revise, complete y firme.

El sign-off legal humano real es **deuda de operador (F17)** y queda fuera de esta corrida
autonoma. El estado verificable de ese sign-off vive en el front-matter YAML de este archivo
(`signoff: pending`). Encender la exposicion publica de NET (`NET_PUBLIC_ENABLED`, que
introducira Phase 18) **depende de `signoff: approved`** — ver seccion 8.

**Alcance:** este dossier cubre **solo NET** (el grafo y su framing). El bloque MONEY
(financiamiento SERVEL + contratos ChileCompra) tiene su propia compuerta — `13-LEGAL-DOSSIER`
/ LEGAL-01 / Phase 13 — y queda **fuera de alcance** aqui.

### Marco temporal de la Ley 21.719 — POR REFERENCIA

El marco temporal de la Ley 21.719 (norma, idNorma candidato, publicacion, vigencia
escalonada, alineacion GDPR, y la nota critica de confianza sobre el reglamento pendiente)
**se reusa por referencia del dossier MONEY**: ver `13-LEGAL-DOSSIER.md` §"Marco temporal de
la Ley 21.719" y su Anexo (supuestos A1, A2, A7). **No se re-litiga aqui.** Toda afirmacion
de calendario y de articulado de la Ley vive en ese dossier y comparte sus niveles de
confianza (MEDIA/BAJA mientras el reglamento siga pendiente).

> **Nota critica de confianza (heredada de 13):** El **reglamento** de la Ley 21.719 sigue
> pendiente de publicacion plena al momento de redactar. En consecuencia, **todo detalle
> operativo de este dossier es de confianza MEDIA/BAJA y debe validarlo el abogado** contra
> el texto oficial y el reglamento cuando este se publique. El dossier **estructura**, no
> concluye.

---

## 1. La superficie NET = relaciones DERIVADAS (no datos nuevos)

**Hecho central:** el grafo de influencia **NO añade ningun dato nuevo**. Cada nodo y cada
arista se **deriva de los tres bloques ya poblados**:

- **VOTE** (Phase 10) — votaciones nominales, ya publicas (Camara/Senado).
- **INT** (Phases 11-12) — lobby (audiencias `leylobby.gob.cl`) y patrimonio/intereses
  (InfoProbidad), ya tratados bajo su propia minimizacion deny-by-default.
- **MONEY** (Phases 14-16) — contratos ChileCompra + aportes SERVEL, ya gated bajo
  LEGAL-01 / Phase 13.

El grafo es un **consumidor puro**: re-presenta como **aristas tipadas** hechos que ya viven
en la base, cada uno con su fuente, su fecha y su enlace original.

**El riesgo NO es el dato — es la COMPOSICION.** Cada hecho individual (un voto, una reunion
de lobby, un aporte de campaña) es publico y trazable. Lo que el grafo introduce es el acto de
**juntar** esos hechos en una arista o en un camino visible. Componer "voto + dinero + reunion"
en una sola estructura visual puede **leerse como acusacion** aunque cada hecho, por separado,
sea publico y este con fuente. Esta es la diferencia juridica especifica de NET frente a los
bloques que lo alimentan: el **dato derivado de la composicion** puede insinuar conducta que
ningun dato fuente afirma.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** ¿la composicion de hechos publicos
en aristas/caminos del grafo constituye un **nuevo tratamiento** de dato personal (un dato
derivado) que requiera su propia base de licitud, distinta de la que habilita cada bloque
fuente? *A confirmar por el asesor.*

---

## 2. Riesgo NUCLEAR: la arista / el camino como acusacion

Esta es **la pregunta central del sign-off NET**. El producto mas insinuante del Observatorio
es precisamente este grafo: una arista que conecta un parlamentario con un donante, o un camino
que pasa por una reunion de lobby y termina en un contrato del Estado, **puede leerse como una
imputacion de conducta** — aunque el sistema solo este re-presentando hechos publicos.

**Pregunta NUCLEAR del sign-off (PENDIENTE DE VALIDACION LEGAL):** ¿el grafo, por el solo
hecho de **componer hechos publicos** en una arista o un camino, crea un **dato derivado que
insinua conducta** (afinidad, intencion, causalidad), excediendo la base de licitud que
habilita cada bloque fuente? Esta es **la** pregunta que el sign-off NET debe resolver
`[respuesta LOW — es precisamente lo que el abogado debe dictaminar]`. *A confirmar por el
asesor.*

**Garantias de framing que hacen el grafo DESCRIPTIVO (no acusatorio).** El diseño de Phase 18
incorpora, por construccion, las siguientes salvaguardas, que se entregan al asesor como
evidencia de que el framing es factual y no imputativo:

- **Aristas tipadas, con fuente.** Cada arista declara su **tipo** (voto, lobby, aporte,
  contrato) y arrastra su **provenance** (origen / fecha / enlace) verbatim de la fuente.
- **Ventana temporal por arista.** Cada arista lleva su **rango de fechas**; el grafo no
  presenta relaciones atemporales ni sugiere secuencia causal entre aristas.
- **Ambos extremos con identidad `confirmado`.** Una arista solo existe si **los dos nodos**
  que conecta tienen identidad `confirmado` (nunca `probable`, nunca crudo). Esto hereda el
  invariante de identidad de VOTE/INT/MONEY (ver §3).
- **SIN score de sospecha.** No existe ninguna puntuacion de persona, de afinidad, de
  influencia ni de "conflicto". El grafo cuenta hechos, no los pondera.
- **SIN path-finding como feature destacada.** El sistema **no ofrece** "encuentra el camino
  entre A y B" como funcion protagonista; no se construye una herramienta de descubrimiento de
  rutas que invite a leer un camino como cadena de causalidad.
- **SIN lenguaje causal.** El copy (en español, sobrio) **nunca** afirma intencion, motivo,
  afinidad ni causalidad — solo "que paso, cuando y segun que fuente" (PROJECT.md Core Value).
- **NINGUNA arista inferida por LLM.** Solo aristas con **fuente verificable**; el grafo no
  fabrica relaciones a partir de un modelo (ver §4 y REQUIREMENTS "Out of Scope").

> **PENDIENTE DE VALIDACION LEGAL.** Estas garantias se entregan como **insumo** para que el
> asesor evalue si bastan para que el framing sea descriptivo y no acusatorio. El dossier **no
> afirma** que sean suficientes. *A confirmar por el asesor.*

---

## 3. Datos sensibles en nodos y aristas

**Hecho:** el grafo expone, en sus nodos y aristas, datos que la Ley 21.719 trata con
proteccion reforzada o que corresponden a terceros privados:

- **Afiliacion politica (partido).** La Ley 21.719 **amplia** la definicion de dato sensible e
  **incluye expresamente la afiliacion politica** (ver `13-LEGAL-DOSSIER.md` §2 y Anexo A3, por
  referencia). El partido de un parlamentario es un atributo de nodo potencialmente sensible.
- **Sentido del voto.** Como atributo de una arista de tipo voto, el sentido (a favor / en
  contra / abstencion) es un hecho publico, pero su composicion con otras aristas intensifica
  el riesgo de lectura imputativa (§2).
- **Terceros privados como nodos.** Donantes (SERVEL) y contrapartes de lobby
  (`leylobby.gob.cl`) son **personas naturales o juridicas privadas** cuyos datos caen de lleno
  bajo la Ley 21.719.

**Postura del proyecto — heredada deny-by-default (0021/0022) + piso PII (0018):**

- **El partido NUNCA llega a `anon`.** El RPC publico del grafo es **PII-safe**: nunca emite
  partido ni RUT (mismo invariante que `parlamentario_publico` / `rebeldias_de_parlamentario`,
  LEGAL-03). El partido es atributo interno; el nodo publico no lo lleva.
- **Ambos extremos `confirmado`.** Toda arista exige identidad `confirmado` en sus dos nodos;
  ninguna arista enlaza un nodo `probable` o crudo. Esto hereda la postura de VOTE/INT/MONEY:
  el FK solo se puebla por enlace determinista/confirmado (IDENT-12, EnlaceConfirmado).
- **Terceros privados en sub-maestras deny-by-default.** Donantes y lobistas se guardan en las
  sub-maestras ya existentes (`lobby_contraparte`, sub-maestras de donante/contratista),
  **deny-by-default** (RLS on + cero policies + revoke all from anon/authenticated). El grafo
  **no** crea una nueva superficie de exposicion de terceros: hereda la minimizacion de los
  bloques fuente.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** ¿la herencia de la postura
deny-by-default (lobby/probidad) + el piso PII (partido nunca a `anon`, ambos extremos
confirmados) es suficiente para el tratamiento de partido, sentido de voto y terceros privados
**en el contexto del grafo**, o la composicion exige medidas adicionales (p.ej. tratar el
sentido de voto como atributo de arista no exponible, o una base de licitud distinta para el
nodo de tercero privado)? *A confirmar por el asesor.*

---

## 4. Minimizacion por diseño

La minimizacion del grafo esta prevista **por diseño** (Phase 18) y se documenta aqui como
evidencia tecnica para la revision:

- **NINGUNA arista inferida por LLM.** El grafo **solo** materializa aristas con **fuente
  verificable** (voto, lobby, aporte, contrato — cada una con provenance). No existe arista
  producida por un modelo de lenguaje. (REQUIREMENTS "Out of Scope": "Aristas inferidas por LLM
  en el grafo — solo aristas con fuente verificable").
- **NINGUN camino presentado como acusacion.** No hay path-finding destacado; un camino, si se
  visualiza, es una secuencia de hechos con fuente, sin sintesis causal ni veredicto.
- **Copy sobrio, sin causalidad ni score de persona.** El texto en español evita todo
  vocabulario de afinidad, influencia, conflicto, intencion o causalidad (mismo vocabulario
  prohibido VALLADO del DESIGN-SYSTEM, Phase 19).
- **Candado de DATOS (RLS).** Las tablas `entidad` / `arista` (Phase 18) nacen
  **deny-by-default** a `anon`: RLS on + cero policies + revoke all from anon/authenticated —
  mismo patron que 0018_piso_pii / 0021_lobby / 0022_probidad. El acceso publico al grafo pasa
  **solo** por un RPC `security definer` PII-safe (ambos extremos confirmados, nunca partido/rut).
- **Candado de PRESENTACION (flag).** Flag server-only **`NET_PUBLIC_ENABLED`** (default
  `false`, fail-closed) en `app/lib/net-gate.ts`, **espejo de `money-gate.ts`**; oculta la ruta
  NET (p.ej. `/red`) y el RPC del grafo mientras no se encienda (ver §6/§8).

El **doble candado** (datos + presentacion) es defensa en profundidad: la RLS protege el dato
aunque el flag se encienda por error; el flag oculta la presentacion aunque una policy RLS se
relaje por error. Es el mismo patron validado en MONEY (Phase 13).

---

## 5. Proposito acotado

- **Fin declarado:** transparencia legislativa y control ciudadano. El ciudadano puede
  responder, sobre cualquier proyecto o parlamentario, "que paso, cuando y segun que fuente".
- **Regla rectora (PROJECT.md / CLAUDE.md Core Value):** el sistema **NUNCA afirma intencion ni
  causalidad** — solo "que paso, cuando y segun que fuente", con trazabilidad a la fuente
  original. Se evita explicitamente la "maquina de sospechas". En el grafo, esta regla es
  **especialmente exigente**: la sola disposicion visual de aristas no debe inducir una lectura
  de motivo.
- El **proposito acotado** (transparencia, no acusacion) **refuerza** el test de interes
  legitimo de la seccion 7: el fin es de interes publico y no busca perfilar, puntuar ni inferir
  conducta — ni siquiera a traves de la topologia del grafo.

---

## 6. CC BY 4.0 — propagacion POR DATASET en nodos y aristas

> **CRITICO (misma correccion que `13-LEGAL-DOSSIER.md` §8):** **NO etiquetar todo el grafo
> como CC BY 4.0.** CC BY 4.0 aplica **solo** a los nodos/aristas derivados de **InfoProbidad**.
> Cada otro dataset arrastra su **propia** atribucion por fila.

| Origen del nodo / arista | Licencia / atribucion real | Como se propaga en el grafo | Confianza |
|--------------------------|----------------------------|------------------------------|-----------|
| **InfoProbidad** (patrimonio / intereses) | **CC BY 4.0** (ya en uso; columna `licencia` en 0022). | Atribucion **CC BY 4.0 visible en el nodo/tooltip** derivado de InfoProbidad. | **HIGH** (ya implementado) |
| **ChileCompra** (contratos) | **NO es CC BY 4.0.** Terminos exigen **"mencion de la fuente"**. | "Mencion de la fuente: ChileCompra" en la arista/tooltip — **NUNCA** CC BY 4.0. | **MEDIUM-HIGH** |
| **SERVEL** (aportes) | Sin licencia CC explicita ubicada — **terminos por verificar**. | "SERVEL — terminos de uso por verificar" en la arista/tooltip; **NO** CC BY 4.0. | **MEDIUM** |
| **Votos / tramitacion** (Camara / Senado) | Datos publicos institucionales. | Atribucion **Camara** / **Senado** en la arista de voto; **NO** CC BY 4.0. | **HIGH** |
| **Lobby** (`leylobby.gob.cl`) | Datos publicos institucionales. | Atribucion a la fuente de lobby en la arista; **NO** CC BY 4.0. | **MEDIUM-HIGH** |

**Nota explicita:** la atribucion por dataset debe **viajar con cada nodo/arista** (provenance
`origen` / `fecha_captura` / `enlace` / `licencia`) y renderizarse en el nodo o tooltip cuando
se exponga NET. **No** asignar `licencia text default 'CC BY 4.0'` a las tablas `entidad` /
`arista`: la licencia se hereda por fila del bloque fuente. CC BY 4.0 es **exclusivo de
InfoProbidad**.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** confirmar la forma de atribucion
exigida por cada dataset cuando se **compone** en una arista derivada (en particular, si la
composicion altera las obligaciones de atribucion de cada fuente). *A confirmar por el asesor.*

---

## 7. Base de licitud

> **TODA esta seccion es preparatoria. No se afirma que ninguna base sea suficiente; se reusa
> el borrador de 13 y se agrega el FACTOR ADICIONAL del riesgo de composicion para que el
> abogado lo valide.**

### 7.1 Bases disponibles

Las bases disponibles bajo la Ley 21.719 (consentimiento; obligacion legal; contrato; **interes
legitimo** con test de ponderacion documentado; obligaciones economicas; acciones judiciales) se
**reusan por referencia** de `13-LEGAL-DOSSIER.md` §7.1 — no se re-enumeran aqui.

### 7.2 Base candidata para el grafo NET

La base **candidata** es **interes legitimo** — transparencia legislativa / control ciudadano —
sobre datos **ya publicados** y **ya tratados** por los bloques fuente, con un **test de
ponderacion documentado**. El analisis base es el de `13-LEGAL-DOSSIER.md` §7.2-7.3, **con un
factor adicional propio de NET: el riesgo de composicion** (§2). *A confirmar por el asesor.*

### 7.3 Borrador de test de ponderacion — DELTA del grafo (sobre el borrador de 13)

Se reusa el borrador de test de `13-LEGAL-DOSSIER.md` §7.3. **El delta especifico de NET** que
el asesor debe ponderar:

1. **Fin legitimo:** identico al de MONEY (transparencia legislativa, control ciudadano).
2. **Necesidad:** el grafo es necesario para que el ciudadano **relacione** hechos ya publicos y
   dispersos entre VOTE/INT/MONEY; ninguna otra presentacion permite ver las relaciones de un
   parlamentario de un vistazo. *Pero* la composicion es tambien la fuente del riesgo — la
   necesidad debe ponderarse contra ese riesgo.
3. **Ponderacion frente a los derechos del titular — FACTOR ADICIONAL NET:**
   - a favor del fin: hechos ya publicos; sujetos de interes publico; proposito acotado sin
     inferencia; aristas tipadas/fechadas/con fuente; sin score; sin path-finding destacado.
   - a favor del titular: la **composicion** (arista/camino) puede leerse como acusacion aunque
     ningun hecho fuente la afirme (§2) — riesgo cualitativamente mayor que en MONEY; revelacion
     de afiliacion politica (dato sensible) y de terceros privados como nodos (§3).
   - salvaguardas aplicadas: minimizacion por diseño (§4: no-LLM, no-path-as-accusation, copy
     sobrio, doble candado), ambos extremos confirmados, partido nunca a `anon`, deny-by-default
     para terceros, gate de exposicion apagado hasta el sign-off.
4. **Conclusion del borrador:** *no se concluye.* El balance — y en particular si el riesgo de
   composicion inclina la ponderacion en contra del interes legitimo — lo dictamina el asesor.

> **PENDIENTE DE VALIDACION LEGAL.** El dossier **no afirma** que el interes legitimo sea base
> suficiente para el grafo ni que el test resulte favorable una vez incorporado el factor de
> composicion. *A confirmar por el asesor.*

---

## 8. Trazabilidad y consumo por el gate

- **Sign-off como prerrequisito duro:** este dossier registra el estado del sign-off en su
  front-matter YAML (`signoff: pending`). El sign-off humano real es **deuda de operador F17** y
  enlaza al **ROADMAP Phase 17, success criterion 3** ("El sign-off es prerrequisito duro:
  Phase 18 no se expone publicamente hasta su aprobacion").
- **Especificacion del gate `NET_PUBLIC_ENABLED` (lo implementa Phase 18):**
  - **Doble candado.**
    (a) **Datos:** las tablas `entidad` / `arista` nacen **deny-by-default** a `anon` por RLS
    (mismo patron 0018/0021/0022); el RPC publico del grafo es **PII-safe** (nunca emite
    partido/rut; ambos extremos `confirmado`).
    (b) **Presentacion:** flag server-only **`NET_PUBLIC_ENABLED`** (default `false`,
    fail-closed) en **`app/lib/net-gate.ts`**, espejo exacto de `money-gate.ts` (solo el literal
    `"true"` enciende; `undefined`/`""`/`"false"`/`"1"`/`"TRUE"` => `false`; `import "server-only"`
    en linea 1; **sin** prefijo `NEXT_PUBLIC_`). Oculta la ruta NET (p.ej. `/red`) y el RPC del
    grafo mientras no se encienda.
  - **Verificacion prevista (Phase 18):** pgTAP que afirma que `anon` no lee `entidad`/`arista`
    directamente; test que afirma `NET_PUBLIC_ENABLED` default `false`; test que afirma que el
    RPC del grafo solo devuelve aristas con **ambos extremos `confirmado`** y **sin partido**.
- **Consumo por el gate:** encender **`NET_PUBLIC_ENABLED`** **depende de `signoff: approved`**
  en este archivo. La dependencia es **verificable por inspeccion** del YAML: mientras `signoff`
  no sea `approved`, el operador **no** enciende el flag.
- **Reversibilidad:** la construccion de Phase 18 (modelo `entidad`/`arista`, RPC, UI
  `@xyflow/react`, tests) es reversible y avanza **bajo el gate apagado**; la **exposicion** no
  se enciende sin sign-off.

---

## 9. Checklist de sign-off para el asesor

> Completar al firmar. El estado se refleja en el front-matter YAML (`signoff`, `asesor`,
> `fecha_signoff`, `observaciones`) de este archivo y de su copia en `docs/legal/`.

- **Nombre del asesor:** ______________________________
- **Fecha del sign-off (ISO 8601):** ______________________________
- **Alcance cubierto:** NET (grafo de influencia). MONEY queda fuera (LEGAL-01 / Phase 13).
- **Observaciones:** ______________________________________________

**Checklist por seccion** (marcar cada una al validar):

- [ ] §1 Superficie NET = relaciones derivadas (composicion, no datos nuevos): revisada y
      validada.
- [ ] §2 Riesgo NUCLEAR — arista/camino como acusacion + garantias de framing descriptivo:
      revisada y validada.
- [ ] §3 Datos sensibles en nodos/aristas (partido / sentido de voto / terceros privados;
      partido nunca a anon; ambos extremos confirmados): revisada y validada.
- [ ] §4 Minimizacion (no-LLM, no-path-as-accusation, copy sobrio, doble candado): revisada y
      validada.
- [ ] §6 CC BY 4.0 por dataset (InfoProbidad = CC BY 4.0; el resto su propia atribucion; NO
      etiquetar todo como CC BY 4.0): confirmada.
- [ ] §7 Base de licitud (interes legitimo + test + **factor de composicion**): revisada y
      validada.
- [ ] §8 Gate `NET_PUBLIC_ENABLED` depende de `signoff: approved`: confirmada.
- [ ] Decision de sign-off: ( ) approved ( ) rejected — registrar en YAML `signoff`.

---

## Anexo — Supuestos a verificar antes de firmar

Los supuestos **A1-A8** sobre la Ley 21.719 (idNorma, calendario, afiliacion politica como dato
sensible, interes legitimo, atribucion por dataset, reglamento pendiente, distincion
acceso/republicacion) **se reusan por referencia** del Anexo de `13-LEGAL-DOSSIER.md` — no se
re-enumeran aqui. A ellos se agregan los **supuestos especificos del framing del grafo**:

| # | Afirmacion (especifica de NET) | Riesgo si es incorrecta |
|---|--------------------------------|-------------------------|
| N1 | La composicion de hechos publicos en aristas/caminos NO constituye, por si, un nuevo tratamiento que exija base de licitud propia | Si el asesor dicta que SI, el grafo necesita su propia base — el sign-off lo condiciona o rechaza |
| N2 | Las garantias de framing (aristas tipadas/fechadas/con fuente, sin score, sin path-finding destacado, sin lenguaje causal, sin LLM) bastan para que el framing sea descriptivo y no acusatorio | Si no bastan, hay que reforzar el diseño (o no exponer ciertas aristas) antes de encender el gate |
| N3 | Exigir ambos extremos `confirmado` + partido nunca a `anon` es minimizacion suficiente para los nodos sensibles del grafo | Puede requerirse minimizacion adicional (p.ej. ocultar sentido de voto como atributo de arista) |
| N4 | La atribucion por dataset se propaga correctamente fila-a-fila en nodos/aristas (InfoProbidad = CC BY 4.0; resto su propia atribucion) | Atribucion legalmente incorrecta si se etiqueta el grafo entero como CC BY 4.0 |
| N5 | El doble candado (RLS deny-by-default sobre `entidad`/`arista` + `NET_PUBLIC_ENABLED` default false) es defensa suficiente mientras el sign-off este pendiente | Si el candado tiene una fuga, el grafo podria exponerse antes del sign-off |

> **Recordatorio final:** este dossier es **preparacion, no dictamen**. Ninguna afirmacion de
> licitud es definitiva; cada base de licitud queda **PENDIENTE DE VALIDACION LEGAL**. El
> riesgo nuclear de NET — que la **composicion** de hechos publicos se lea como acusacion — es
> precisamente lo que el abogado externo debe dictaminar y firmar. El abogado dictamina y firma.
