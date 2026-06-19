---
documento: 13-LEGAL-DOSSIER
alcance: MONEY (financiamiento SERVEL + contratos ChileCompra)
signoff: pending          # pending | approved | rejected
asesor: ""                # nombre del asesor legal externo (vacio hasta firmar)
fecha_signoff: ""         # ISO 8601 al firmar
observaciones: ""
depende_de: "deuda operador F13; ROADMAP success criterion 3"
nota: "Encender MONEY_PUBLIC_ENABLED requiere signoff: approved."
---

# Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719) — Dossier de Preparacion

## 0. Proposito del documento y descargo

Este documento es **material de PREPARACION para asesoria legal externa**. NO es un
dictamen, NO es una opinion legal y **NO afirma que el tratamiento de datos sea licito**.
Su unico fin es **estructurar la superficie de riesgo** de los datos MONEY (financiamiento
de campana publicado por SERVEL + contratos del Estado publicados por ChileCompra) bajo la
Ley 21.719, de modo que un abogado externo la revise, complete y firme.

El sign-off legal humano real es **deuda de operador (F13)** y queda fuera de esta corrida
autonoma. El estado verificable de ese sign-off vive en el front-matter YAML de este archivo
(`signoff: pending`). Encender la exposicion publica de MONEY (`MONEY_PUBLIC_ENABLED`,
introducido en 13-01) **depende de `signoff: approved`** — ver seccion 9.

**Alcance:** este dossier cubre **solo MONEY**. El framing del grafo de influencia (NET) es
materia de LEGAL-02 / Phase 17 y queda **fuera de alcance** aqui.

### Marco temporal de la Ley 21.719

- **Norma:** Ley 21.719, "regula la proteccion y el tratamiento de los datos personales y
  crea la Agencia de Proteccion de Datos Personales (APDP)". idNorma BCN candidato:
  **1209272** `[POR VERIFICAR contra bcn.cl/leychile/Navegar?idNorma=1209272 o via
  obtxml?opt=7&idNorma=1209272 — Assumption A1]`. La pagina BCN es JS-rendered; el idNorma
  exacto debe confirmarse contra el texto oficial antes de firmar.
- **Publicacion:** Diario Oficial, **diciembre 2024** `[POR VERIFICAR fecha exacta del dia —
  Assumption A2; fuentes secundarias]`.
- **Vigencia escalonada:** la fase operativa mas relevante (obligaciones del responsable)
  entra a fines de **2026** (PROJECT.md fija **2026-12-01** como "plena vigencia"); el
  regimen sancionatorio pleno se cita hacia **diciembre 2027** `[POR VERIFICAR contra los
  articulos transitorios del texto oficial — Assumption A2; MEDIUM]`.
- **Alineacion:** modelada sobre el GDPR europeo (derechos ARCO+, encargado/subencargado,
  notificacion de brecha en 72h a la APDP) `[POR VERIFICAR — Assumption, fuentes
  secundarias; MEDIUM]`.

> **Nota critica de confianza:** El **reglamento** de la Ley 21.719 **sigue pendiente** de
> publicacion plena al momento de redactar `[Assumption A7]`. En consecuencia, **todo detalle
> operativo de este dossier es de confianza MEDIA/BAJA y debe validarlo el abogado** contra
> el texto oficial y el reglamento cuando este se publique. El dossier **estructura**, no
> concluye.

---

## 1. Superficie (a) — Republicacion de datos publicos del Estado

**Hecho:** los datos MONEY ya son publicos: ChileCompra publica los contratos adjudicados y
SERVEL publica los aportes de campana. El Observatorio los **republica con tratamiento**
(normalizacion, cruce por RUT interno, agregacion, presentacion en ficha).

**Postura del proyecto:** "ser fuente de acceso publico **NO exime** del cumplimiento"
(PROJECT.md L75). La Ley exige informar de que fuente provienen los datos (y si son de fuente
de acceso publico), pero ser fuente publica no es por si una autorizacion ilimitada de
tratamiento `[POR VERIFICAR — concepto general de la Ley; Assumption, MEDIUM]`.

**Distincion de planos juridicos a validar:** la Ley 20.285 (Transparencia) regula el
**acceso** a la informacion publica; la Ley 21.719 regula la **republicacion con
tratamiento** de datos personales. Son planos distintos: que un dato sea accesible bajo
20.285 no resuelve por si la licitud de su tratamiento bajo 21.719 `[POR VERIFICAR — la
distincion juridica debe confirmarla el abogado; Assumption A8]`.

**Dato derivado del cruce:** el dato producido por el cruce/agregacion (p.ej. el total de
aportes asociado a un parlamentario, o la suma de contratos en torno a un RUT) **tambien
queda protegido** (PROJECT.md L75); la base de licitud (seccion 7) debe cubrir tanto el dato
fuente como el dato derivado.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** dado que el dato fuente ya es
publico, que base de licitud habilita su **republicacion con tratamiento** por un tercero
(el Observatorio), y cubre esa base tambien el dato derivado del cruce? *A confirmar por el
asesor.*

---

## 2. Superficie (b) — Datos sensibles: afiliacion politica

**Hecho:** la Ley 21.719 **amplia** la definicion de dato sensible e **incluye expresamente
la afiliacion politica** (junto a origen etnico/racial, afiliacion sindical, etc.) `[POR
VERIFICAR contra el texto oficial — Assumption A3; consenso de fuentes secundarias, MEDIUM-
HIGH]`. Los datos sensibles tienen proteccion reforzada y solo pueden tratarse en situaciones
especificas y justificadas.

**Implicancia para MONEY:** el dato de financiamiento de campana (un aporte declarado en
SERVEL) puede **revelar la afiliacion o posicion politica** de un tercero donante, lo que lo
acerca a la categoria de dato sensible. El cruce y la agregacion podrian intensificar esa
revelacion.

**Pregunta NUCLEAR del sign-off (PENDIENTE DE VALIDACION LEGAL):** la publicacion/agregacion
de aportes (ya publicados por SERVEL) **reactiva** un tratamiento de dato sensible que exija
una base de licitud **mas fuerte** que el interes legitimo? Esta es la pregunta central que
el sign-off MONEY debe resolver `[respuesta LOW — es precisamente lo que el abogado debe
dictaminar; Open Question 1 del research]`. *A confirmar por el asesor.*

---

## 3. Superficie (c) — Terceros privados: donantes / lobistas

**Hecho:** desde la Ley 20.900/2016 **solo personas naturales** pueden aportar a campanas
(se prohiben aportes de personas juridicas) `[POR VERIFICAR — Assumption, fuentes
secundarias; MEDIUM-HIGH]`. Donantes y contrapartes de lobby son **terceros privados** cuyos
datos personales caen de lleno bajo la Ley 21.719.

**Postura del proyecto — YA IMPLEMENTADA (lobby/probidad):** el tercero privado se guarda en
una sub-maestra **deny-by-default** (`lobby_contraparte`, `declaracion_familiar`), **NUNCA**
se enlaza a una persona del padron salvo confirmacion, y el **RPC publico nunca lo emite**.
`[VERIFIED — supabase/migrations/0021_lobby.sql y 0022_probidad.sql leidas: RLS habilitada,
cero policies a anon, revoke all from anon/authenticated]`.

**MONEY hereda esta postura:** las sub-maestras de contratistas/donantes que se construyan en
Phases 14-16 nacen deny-by-default; el donante/lobista se trata por minimizacion; solo se
expone lo que la fuente ya publica, **sin enriquecer ni inferir**.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** la postura de minimizacion +
deny-by-default heredada de lobby/probidad es suficiente para el tratamiento de donantes y
contrapartes de lobby bajo la Ley 21.719, o requiere medidas adicionales (p.ej. base de
licitud distinta para terceros privados)? *A confirmar por el asesor.*

---

## 4. Minimizacion

La minimizacion esta implementada **por diseno** y se documenta aqui como evidencia tecnica
para la revision:

- **RUT y datos de familiares = INTERNOS.** Se usan solo para reconciliacion de identidad;
  **nunca se exponen** publicamente (PROJECT.md L21, L63).
- **El RUT nunca cruza a un prompt LLM.** La compuerta fail-closed
  `assertPiiDocumentSafeForLlm` / `assertNoRutInLlmInput` impide que un RUT entre a la
  entrada de un modelo (`packages/llm/src/data-routing.ts`, LEGAL-03 / Phase 9).
  `[VERIFIED — packages/llm/src/data-routing.ts leido]`.
- **Candado de DATOS:** RLS deny-by-default + `revoke all from anon, authenticated` sobre las
  tablas sensibles (migraciones 0018_piso_pii.sql, 0021_lobby.sql, 0022_probidad.sql). Las
  tablas MONEY de Phases 14-16 heredan esta convencion.
- **Candado de PRESENTACION:** flag server-only `MONEY_PUBLIC_ENABLED` (default `false`,
  fail-closed) en `app/lib/money-gate.ts` (introducido en 13-01); oculta las secciones MONEY
  de la ficha y del RPC publico mientras no se encienda.

El doble candado (datos + presentacion) es defensa en profundidad: la RLS protege el dato
aunque el flag se encienda por error; el flag protege la presentacion aunque una policy RLS
se relaje por error.

---

## 5. Proposito

- **Fin declarado:** transparencia legislativa y control ciudadano. El ciudadano puede
  responder, sobre cualquier proyecto o parlamentario, "que paso, cuando y segun que fuente".
- **Regla rectora (PROJECT.md Core Value):** el sistema **NUNCA afirma intencion ni
  causalidad** — solo "que paso, cuando y segun que fuente", con trazabilidad a la fuente
  original. Se evita explicitamente la "maquina de sospechas".
- El **proposito acotado** (transparencia, no acusacion) refuerza el test de interes legitimo
  de la seccion 7: el fin es de interes publico y no busca perfilar ni inferir conducta.

---

## 6. (reservado)

> La numeracion sigue el orden de las superficies; la base de licitud se desarrolla en la
> seccion 7 para mantener juntos el analisis de licitud y su cierre PENDIENTE.

---

## 7. Base de licitud

> **TODA esta seccion es preparatoria. No se afirma que ninguna base sea suficiente; se
> enumeran las bases y se propone una candidata con un BORRADOR de test de ponderacion para
> que el abogado lo valide.**

### 7.1 Bases disponibles bajo la Ley 21.719

- **Art. 12 — Consentimiento** del titular `[POR VERIFICAR articulo exacto — Assumption,
  fuentes secundarias; MEDIUM]`.
- **Art. 13 — cinco bases adicionales** `[POR VERIFICAR articulo exacto — Assumption; MEDIUM]`:
  1. cumplimiento de una obligacion legal del responsable;
  2. ejecucion o celebracion de un contrato;
  3. **interes legitimo** del responsable o de un tercero, con un **test de ponderacion
     documentado**;
  4. cumplimiento de obligaciones economicas, financieras, bancarias o comerciales;
  5. ejercicio de acciones judiciales o administrativas.

### 7.2 Base candidata para el Observatorio

La base **candidata** es **interes legitimo** (Art. 13) — transparencia legislativa / control
ciudadano — sobre datos **ya publicados por el Estado**, con un **test de ponderacion
documentado** que pondere el fin de interes publico contra los derechos del titular `[POR
VERIFICAR la suficiencia — Assumption A4; la base es plausible, la suficiencia es decision del
abogado; MEDIUM]`.

### 7.3 Borrador de test de ponderacion (para validacion del asesor)

1. **Fin legitimo:** transparencia legislativa y control ciudadano sobre el ejercicio de
   cargos publicos — fin de interes publico reconocido.
2. **Necesidad:** el tratamiento (republicacion + cruce por RUT interno + agregacion) es
   necesario para que el ciudadano pueda relacionar parlamentarios con contratos del Estado y
   financiamiento de campana ya publicos; no existe un medio menos invasivo que cumpla el fin
   (la dispersion entre ChileCompra y SERVEL hace inviable el control sin el cruce).
3. **Ponderacion frente a los derechos del titular:**
   - a favor del fin: datos ya publicos por el Estado; sujetos de interes publico (cargos de
     eleccion popular y, para donantes/contratistas, su relacion con el gasto publico);
     proposito acotado sin inferencia de intencion.
   - a favor del titular: posible revelacion de afiliacion politica (dato sensible, seccion 2)
     en el caso de donantes; riesgo de lectura como acusacion.
   - salvaguardas aplicadas: minimizacion (seccion 4), trazabilidad a la fuente, sin
     causalidad, deny-by-default para terceros, gate de exposicion apagado hasta el sign-off.
4. **Conclusion del borrador:** *no se concluye.* El balance lo dictamina el asesor.

> **PENDIENTE DE VALIDACION LEGAL.** Este borrador de test de ponderacion se entrega para que
> el asesor lo complete, corrija y valide. El dossier **no afirma** que el interes legitimo
> sea base suficiente ni que el test resulte favorable. *A confirmar por el asesor.*

---

## 8. Licencia y atribucion POR DATASET

> **CRITICO:** la afirmacion generica "CC BY 4.0 para los datasets MONEY" (presente en
> CLAUDE.md y en CONTEXT) es **imprecisa** y queda **corregida por dataset** en esta tabla
> `[Assumption A5 / Pitfall 1 del research]`. **NO etiquetar ChileCompra ni SERVEL como CC
> BY 4.0.** CC BY 4.0 aplica solo a InfoProbidad (que no es MONEY).

| Dataset | Licencia / terminos reales | Atribucion requerida | Confianza |
|---------|----------------------------|----------------------|-----------|
| **ChileCompra** (contratos / Mercado Publico) | **NO declara una licencia CC formal.** Sus terminos de uso exigen **"mencionar la fuente"** al reproducir/publicar. **NO es CC BY 4.0.** | Citar a **ChileCompra** como fuente (mencion de fuente). | **MEDIUM-HIGH** (terminos leidos directo: chilecompra.cl/terminos-y-condiciones-de-uso/) |
| **SERVEL** (aportes / Ley 19.884) | Publica los aportes periodicamente (Sistema de Recepcion de Aportes). **No se ubico una declaracion de licencia CC explicita.** Terminos del dataset puntual **[POR VERIFICAR — Assumption A6]**. | Citar **SERVEL** + **Ley 19.884** como marco. | **MEDIUM** (sin pagina de licencia ubicada; verificar) |
| **InfoProbidad** (referencia, **NO MONEY**) | **CC BY 4.0** (ya en uso; columna `licencia` en migracion 0022). | Atribucion **CC BY 4.0** visible (componente `AtribucionCcBy`). | **HIGH** (ya implementado) |

**Nota explicita:** la atribucion por dataset (mencion de fuente para ChileCompra; SERVEL por
verificar; CC BY 4.0 solo para InfoProbidad) debe **viajar con cada fila** (columna
provenance `origen`/`fecha_captura`/`enlace`/`licencia`) y renderizarse en la ficha cuando se
exponga MONEY. **No** asignar `licencia text default 'CC BY 4.0'` a tablas de contratos
ChileCompra ni de aportes SERVEL sin verificar el dataset especifico.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** confirmar los terminos de reuso
de cada dataset (en particular SERVEL, sin pagina de licencia ubicada) y la forma de
atribucion exigida. *A confirmar por el asesor.*

---

## 9. Trazabilidad y consumo por el gate

- **Sign-off como prerrequisito duro:** este dossier registra el estado del sign-off en su
  front-matter YAML (`signoff: pending`). El sign-off humano real es **deuda de operador F13**
  y enlaza al **ROADMAP Phase 13, success criterion 3** ("el sign-off es un prerrequisito
  duro y verificable: ninguna ruta publica de MONEY (Phases 14-16) se expone hasta que esta
  compuerta este aprobada").
- **Consumo por el gate de 13-01:** encender el flag **`MONEY_PUBLIC_ENABLED`**
  (`app/lib/money-gate.ts`, default `false`) **depende de `signoff: approved`** en este
  archivo. La dependencia es **verificable por inspeccion** del YAML: mientras `signoff` no
  sea `approved`, el operador no debe encender el flag.
- **Reversibilidad:** la construccion de Phases 14-16 (ingesta, esquema DB, conector, cruce
  RUT interno, tests) es reversible y puede avanzar bajo el gate apagado; la **exposicion** no
  se enciende sin sign-off.

---

## 10. Checklist de sign-off para el asesor

> Completar al firmar. El estado se refleja en el front-matter YAML (`signoff`, `asesor`,
> `fecha_signoff`, `observaciones`) de este archivo y de su copia en `docs/legal/`.

- **Nombre del asesor:** ______________________________
- **Fecha del sign-off (ISO 8601):** ______________________________
- **Alcance cubierto:** MONEY (financiamiento SERVEL + contratos ChileCompra). NET/grafo
  queda fuera (LEGAL-02 / Phase 17).
- **Observaciones:** ______________________________________________

**Checklist por superficie y seccion** (marcar cada una al validar):

- [ ] Superficie (a) — Republicacion de datos publicos del Estado: revisada y validada.
- [ ] Superficie (b) — Datos sensibles: afiliacion politica (pregunta nuclear): revisada y
      validada.
- [ ] Superficie (c) — Terceros privados: donantes / lobistas: revisada y validada.
- [ ] Minimizacion (RUT/familiares internos; RUT nunca al LLM; doble candado): revisada y
      validada.
- [ ] Base de licitud (interes legitimo + test de ponderacion): revisada y validada.
- [ ] Licencia por dataset (ChileCompra = mencion de fuente; SERVEL = verificada;
      InfoProbidad = CC BY 4.0): confirmada.
- [ ] Decision de sign-off: ( ) approved ( ) rejected — registrar en YAML `signoff`.

---

## Anexo — Supuestos a verificar antes de firmar (del research)

| # | Afirmacion | Riesgo si es incorrecta |
|---|------------|-------------------------|
| A1 | idNorma de Ley 21.719 = 1209272 | Cita BCN incorrecta; verificar contra BCN / obtxml |
| A2 | Publicacion dic-2024; plena vigencia 2026-12-01; sanciones dic-2027 | Calendario mal fechado; verificar articulos transitorios |
| A3 | Afiliacion politica = dato sensible bajo 21.719 | La superficie de aportes se evalua distinto si no |
| A4 | Interes legitimo (con test) viable para republicar datos publicos del Estado | Base insuficiente; el sign-off lo rechaza |
| A5 | "CC BY 4.0 para MONEY" es impreciso: ChileCompra exige mencion de fuente | Atribucion legalmente incorrecta si se copia a ciegas |
| A6 | SERVEL no declara licencia CC explicita | Terminos de reuso de SERVEL sin confirmar |
| A7 | Reglamento de la Ley 21.719 sigue pendiente | Si ya se publico, algunos detalles cambian |
| A8 | Ley 20.285 regula acceso, no republicacion con tratamiento | Distincion juridica a validar con el abogado |

> **Recordatorio final:** este dossier es **preparacion, no dictamen**. Ninguna afirmacion de
> licitud es definitiva; cada base de licitud queda **PENDIENTE DE VALIDACION LEGAL**. El
> abogado externo dictamina y firma.
