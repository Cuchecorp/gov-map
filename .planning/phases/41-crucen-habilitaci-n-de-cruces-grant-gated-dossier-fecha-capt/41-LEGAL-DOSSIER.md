---
documento: 41-LEGAL-DOSSIER-CRUCES
alcance: CRUCES (señales parlamentario↔sector)
signoff: approved         # pending | approved | rejected
asesor: "Carlos Sánchez Rossi"   # asesor legal externo que revisó y firmó
fecha_signoff: "2026-06-24"      # ISO 8601
observaciones: "Aprobado sujeto a mantener el tratamiento de los datos bajo el principio de proporcionalidad y finalidad, y a nueva revisión antes de la entrada en vigor de la nueva ley de datos personales (diciembre de 2026)."
depende_de: "deuda operador Phase 39; CRUCEN-03 deliverable de Phase 41"
nota: "Para encender crucesPublicEnabled se requiere la firma legal (estado aprobado) y aplicar el grant 0042."
---

# Phase 41: Compuerta Legal — Bloque CRUCES (señales parlamentario↔sector) — Dossier de Preparacion

## 0. Proposito del documento y descargo

Este documento es **material de PREPARACION para asesoria legal externa**. NO es un
dictamen, NO es una opinion legal y **NO afirma que el tratamiento de datos sea licito**.
Su unico fin es **estructurar la superficie de riesgo** de las **señales de cruce
parlamentario↔sector (CRUCES)** bajo la Ley 21.719, de modo que un abogado externo la
revise, complete y firme.

El sign-off legal humano real es **deuda de operador (Phase 39)** y queda fuera de esta
corrida autonoma. El estado verificable de ese sign-off vive en el front-matter YAML de este
archivo (`signoff: pending`). Encender la exposicion publica de los cruces
(`crucesPublicEnabled` / `CRUCES_PUBLIC_ENABLED`, en `app/lib/cruces-gate.ts`) **depende de
la firma legal (estado aprobado) y de aplicar el grant `0042`** — ver seccion 8.

**Alcance:** este dossier cubre **solo CRUCES** (las señales de cruce parlamentario↔sector
materializadas en `cruce_senal` y expuestas por el RPC `cruces_de_parlamentario`). Los
bloques MONEY (`13-LEGAL-DOSSIER` / Phase 13) y NET (el grafo de influencia,
`17-LEGAL-DOSSIER` / Phase 17) tienen sus propias compuertas y quedan **fuera de alcance**
aqui.

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

## 1. La superficie CRUCES = composicion INTRA-bloque (lobby agregado por sector)

**Hecho central:** la señal de cruce **NO añade ningun dato nuevo**. Cada señal se construye
**a partir de un solo bloque ya poblado** — el **lobby** (audiencias de la Ley del Lobby,
Ley 20.730, registradas en `leylobby.gob.cl` y `camara.cl`):

- La señal es **LOBBY-PURA**: `tipo_senal = 'lobby_sector'`. El materializador
  (`cruces.materializar_cruces()`, migracion `0039`) cuenta, por
  **(parlamentario confirmado, sector de la contraparte)**, las audiencias de lobby ya
  registradas, y arma una **evidencia jsonb** con los items crudos y su enlace de fuente.
- La fusion lobby+aporte (`tipo_senal = 'lobby_sector_aporte'`) esta **reservada a Phase 40**
  (gated por RUT-01) y **NO** forma parte de esta superficie. El CHECK de `cruce_senal` la
  excluye hoy.

**Diferencia con NET (importante para el asesor):** a diferencia del grafo de influencia
(NET, `17-LEGAL-DOSSIER`), **CRUCES NO compone tres bloques** (VOTE / INT / MONEY) ni
construye **aristas, caminos ni relaciones de dos nodos**. La señal de cruce es un **agregado
intra-bloque**: un **conteo neutro** de hechos de lobby agrupados por sector economico para
**un** parlamentario. No hay segundo extremo, no hay arista, no hay topologia. Las **señales
de voto arrancan OFF** (ver `17-LEGAL-DOSSIER` §2): este dossier no introduce voto alguno en
la superficie.

**El riesgo NO es el dato — es la AGREGACION.** Cada audiencia de lobby individual es publica
y trazable. Lo que la señal introduce es el acto de **agrupar por sector** esas audiencias en
un conteo unico. Agregar "N reuniones con gestores del sector X" puede **leerse como
insinuacion de afinidad o captura** aunque cada reunion, por separado, sea publica y este con
fuente. Esta es la diferencia juridica especifica de CRUCES frente al bloque de lobby que lo
alimenta: el **dato derivado de la agregacion por sector** puede insinuar conducta que ningun
dato fuente afirma.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** ¿la agregacion por sector de
hechos publicos de lobby constituye un **nuevo tratamiento** de dato personal (un dato
derivado) que requiera su propia base de licitud, distinta de la que habilita el bloque de
lobby fuente? *A confirmar por el asesor.*

---

## 2. Riesgo NUCLEAR: la agregacion por sector como insinuacion de afinidad / captura

Esta es **la pregunta central del sign-off CRUCES**. El producto mas insinuante de esta
superficie es precisamente el conteo agregado: "N reuniones con gestores del sector X"
**puede leerse como una imputacion de afinidad, captura o conflicto de interes** — aunque el
sistema solo este re-presentando, agrupado por sector, hechos publicos de lobby.

**Pregunta NUCLEAR del sign-off (PENDIENTE DE VALIDACION LEGAL):** ¿la señal, por el solo
hecho de **agregar por sector** reuniones de lobby ya publicas, crea un **dato derivado que
insinua conducta** (afinidad, captura, intencion, conflicto), excediendo la base de licitud
que habilita el bloque de lobby fuente? Esta es **la** pregunta que el sign-off CRUCES debe
resolver `[respuesta LOW — es precisamente lo que el abogado debe dictaminar]`. *A confirmar
por el asesor.*

**Garantias de framing que hacen la señal DESCRIPTIVA (no acusatoria).** El diseño de la
superficie (`app/components/cruces-de-parlamentario.tsx`, GATE DE CONTENIDO §9.1) incorpora,
por construccion, las siguientes salvaguardas, que se entregan al asesor como evidencia de
que el framing es factual y no imputativo:

- **Conteo NEUTRO como unico agregado.** La señal cuenta hechos ("N reuniones con gestores
  del sector X"); **no** los pondera, **no** computa score, indice, ranking ni flag de
  "conflicto de interes". El conteo es el unico agregado permitido.
- **SIN aristas, SIN caminos, SIN relaciones de dos nodos.** A diferencia de NET, la señal no
  conecta dos personas ni traza una ruta; es un agregado de un parlamentario por sector. No
  hay topologia que invite a leer un camino como cadena de causalidad.
- **SIN lenguaje causal ni de afinidad.** El copy (en español, sobrio) **nunca** afirma
  intencion, motivo, afinidad ni causalidad — prohibido "se reunio para", "a cambio de",
  "antes de votar", "cercano a", "vinculado a", "aliado de" (GATE §9.1, items 2-5).
- **Carril aislado.** La señal de cruce **NUNCA** comparte un `<article>`/`<li>` con un voto,
  boletin, proyecto o declaracion; vive en su propio `<section id="cruces">` separado por
  `mt-12` (GATE §9.1, item 1). No se compone con voto ni con dinero.
- **Contraparte CRUDA + IdentityMarker, NUNCA enlazada.** El nombre de la contraparte de
  lobby se muestra **verbatim** de la fuente (dato D-10), con la marca de identidad no
  verificada, y **jamas** se enlaza ni se le asocia un RUT (GATE §9.1, items 6-7).
- **Provenance por evidencia (FND-08).** Cada item de evidencia arrastra su **enlace de
  fuente** y la señal arrastra su fecha de captura; el `ProvenanceBadge` viaja con cada
  evidencia (GATE §9.1, item 8).
- **Un vacio es un HECHO, no una virtud.** La ausencia de cruces se presenta como estado
  honesto ("No se registran cruces de sector ... con los datos actuales"), **NUNCA** como
  "limpio" ni "transparente" (GATE §9.1, item 9).

> **PENDIENTE DE VALIDACION LEGAL.** Estas garantias se entregan como **insumo** para que el
> asesor evalue si bastan para que el framing sea descriptivo y no acusatorio. El dossier **no
> afirma** que sean suficientes. *A confirmar por el asesor.*

---

## 3. Datos sensibles y de terceros en la señal

**Hecho:** la señal expone, en su evidencia, datos que corresponden a **terceros privados**
(las contrapartes de lobby) bajo la Ley 21.719:

- **Contrapartes de lobby como terceros privados.** Los gestores de interes / contrapartes
  registrados en `leylobby.gob.cl` son **personas naturales o juridicas privadas** cuyos
  datos caen de lleno bajo la Ley 21.719. La señal los presenta como **nombre CRUDO**
  (verbatim de la fuente) + IdentityMarker, sin enlace y sin RUT.
- **El patron por sector como dato derivado.** El conteo agrupado por sector es un dato
  **derivado** de las audiencias publicas; su tratamiento debe cubrirse por la base de
  licitud (seccion 7).

**Lo que la señal NO emite (distincion frente a NET):** el RPC `cruces_de_parlamentario`
(`0040`, ampliado en `0041`) devuelve **solo** columnas nombradas —
`sector_id`, `sector_etiqueta`, `tipo_senal`, `conteo`, `evidencia`, `fecha_captura` — y la
evidencia jsonb contiene **solo** `tipo` / `fecha` / `contraparte_nombre_crudo` /
`audiencia_id` / `enlace_fuente`. **NO emite `partido`. NO emite sentido de voto. NO emite
`rut` ni `donante_id`.** A diferencia de un §3 copiado de NET, esta superficie **no tiene**
afiliacion politica ni atributo de voto: invocarlos seria **inventar atributos que la
superficie no posee** y tergiversar el alcance ante el abogado.

**Postura del proyecto — heredada deny-by-default (0039/0040) + piso PII (LEGAL-03):**

- **El RPC es PII-safe.** Nunca emite `rut`, `partido`, `email` ni `donante_id` (mismo
  invariante que `lobby_de_parlamentario` / `parlamentario_publico`, LEGAL-03); el cuerpo del
  RPC une **solo** a `sector` (catalogo publico) para resolver la etiqueta legible. El pgTAP
  de `0041` asierta que el cuerpo no referencia `partido|rut|email|donante_id`.
- **Contraparte siempre cruda.** La contraparte **nunca** se confirma ni se enlaza (el RPC no
  emite `contraparte_id` ni `estado_vinculo`); es texto crudo + IdentityMarker.
- **Terceros en sub-maestra deny-by-default.** Las contrapartes de lobby viven en
  `lobby_contraparte` (deny-by-default: RLS on + cero policies + revoke all from
  anon/authenticated). La señal **no** crea una nueva superficie de exposicion de terceros:
  hereda la minimizacion del bloque de lobby.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** ¿la herencia de la postura
deny-by-default (lobby) + el piso PII (sin rut/partido/donante_id; contraparte cruda nunca
enlazada) es suficiente para el tratamiento de las contrapartes de lobby **en el contexto de
la agregacion por sector**, o la composicion exige medidas adicionales (p.ej. una base de
licitud distinta para el tercero privado, o no exponer ciertas contrapartes)? *A confirmar
por el asesor.*

---

## 4. Minimizacion por diseño y DOBLE CANDADO

La minimizacion de la señal esta prevista **por diseño** y se documenta aqui como evidencia
tecnica para la revision. El **doble candado** (datos + presentacion) es defensa en
profundidad — mismo patron validado en MONEY (Phase 13) y NET (Phase 17):

| Candado | Parte | Mecanismo | Estado |
|---------|-------|-----------|--------|
| **A — DATOS** | Parte 1: tabla | `cruce_senal` nace **deny-by-default** a `anon`: RLS on + cero policies + `revoke all from anon, authenticated` (migracion `0039`). El service_role (writer) bypassa RLS. | Aplicado (PROD). |
| **A — DATOS** | Parte 2: canal de lectura | El RPC `cruces_de_parlamentario` (`0040`/`0041`) **NO** concede `execute` a `anon` (KEEP `revoke from public` + `revoke from anon, authenticated`; intencionalmente SIN `grant`). El grant gated vive **separado** en `0042_cruces_grant_anon.sql`, **NO aplicado**. | RPC deny-by-default (PROD); `0042` **inerte**. |
| **B — PRESENTACION** | Flag server-only | `crucesPublicEnabled()` (`app/lib/cruces-gate.ts`), **default OFF / fail-closed** (solo el literal `"true"` enciende; `undefined`/`""`/`"false"`/`"1"`/`"TRUE"` => `false`); `import "server-only"` linea 1; sin prefijo `NEXT_PUBLIC_`. Con OFF, la `<section id="cruces">` queda **ausente del HTML** y el RPC nunca se invoca. | OFF (default). |

Detalles de minimizacion adicionales:

- **Sin `rut`, sin `partido`, sin `donante_id`.** La proyeccion del RPC es PII-safe por
  construccion (seccion 3); el nombre de la contraparte es **crudo**, nunca normalizado ni
  inferido por LLM.
- **NINGUNA señal inferida por LLM.** La señal se materializa **solo** desde audiencias de
  lobby con fuente verificable (`materializar_cruces()` no llama a ningun modelo); no existe
  señal producida por un modelo de lenguaje.
- **FULL REBUILD transaccional.** La señal se reconstruye en cada corrida del materializador
  (cron `'23 3 * * *'`): el conteo y la evidencia reflejan el estado actual completo, no un
  acumulado parcial.

El **doble candado** garantiza que la RLS protege el dato aunque el flag se encienda por
error, y el flag oculta la presentacion aunque una policy RLS se relaje por error. Ambos
candados se abren **solo** tras el sign-off legal (firma humana, Phase 39) + aplicar `0042`
(operador) + flip del flag (operador).

---

## 5. Proposito acotado

- **Fin declarado:** transparencia legislativa y control ciudadano. El ciudadano puede
  responder, sobre cualquier parlamentario, "que paso, cuando y segun que fuente".
- **Regla rectora (PROJECT.md / CLAUDE.md Core Value):** el sistema **NUNCA afirma intencion
  ni causalidad** — solo "que paso, cuando y segun que fuente", con trazabilidad a la fuente
  original. Se evita explicitamente la "maquina de sospechas". En la señal de cruce, esta
  regla es **especialmente exigente**: el solo agregado por sector no debe inducir una lectura
  de afinidad o captura.
- El **proposito acotado** (transparencia, no acusacion) **refuerza** el test de interes
  legitimo de la seccion 7: el fin es de interes publico y no busca perfilar, puntuar ni
  inferir conducta — ni siquiera a traves del conteo agrupado por sector.

---

## 6. Atribucion — fuente UNICA: lobby

> **Distincion frente a NET/MONEY:** esta superficie tiene **una sola fuente** — el **lobby**.
> **NO** etiquetar la señal como **CC BY 4.0**. La unica fuente CC BY 4.0 del proyecto es
> **InfoProbidad**, que **no esta** en esta superficie. No hay aqui multiples datasets que
> componer; la tabla de 5 filas de NET se **colapsa** a una sola.

| Origen de la señal | Licencia / atribucion real | Como se propaga | Confianza |
|--------------------|----------------------------|------------------|-----------|
| **Lobby** (`leylobby.gob.cl` institucional / `camara.cl`) | Datos publicos institucionales. **NO es CC BY 4.0.** | Atribucion a la fuente de lobby por **evidencia** (provenance inline: `dataset='lobby'` / `origen` / `fecha_captura` / `enlace`), renderizada en el `ProvenanceBadge` de cada item. | **MEDIUM-HIGH** |

**Nota explicita:** la atribucion debe **viajar con cada evidencia** (provenance
`origen` / `fecha_captura` / `enlace_fuente`) y renderizarse por item cuando se exponga la
señal. **No** etiquetar la tabla `cruce_senal` ni el RPC como CC BY 4.0: la fuente es el
bloque de lobby, dato publico institucional con **mencion de fuente**, no CC BY 4.0.

**Pregunta para el asesor (PENDIENTE DE VALIDACION LEGAL):** confirmar la forma de atribucion
exigida por la fuente de lobby cuando sus hechos se **agregan por sector** en una señal
derivada (en particular, si la agregacion altera las obligaciones de atribucion de la
fuente). *A confirmar por el asesor.*

---

## 7. Base de licitud

> **TODA esta seccion es preparatoria. No se afirma que ninguna base sea suficiente; se reusa
> el borrador de 13 y se agrega el FACTOR ADICIONAL del riesgo de agregacion por sector para
> que el abogado lo valide.**

### 7.1 Bases disponibles

Las bases disponibles bajo la Ley 21.719 (consentimiento; obligacion legal; contrato;
**interes legitimo** con test de ponderacion documentado; obligaciones economicas; acciones
judiciales) se **reusan por referencia** de `13-LEGAL-DOSSIER.md` §7.1 — no se re-enumeran
aqui.

### 7.2 Base candidata para la señal CRUCES

La base **candidata** es **interes legitimo** — transparencia legislativa / control ciudadano
— sobre datos **ya publicados** y **ya tratados** por el bloque de lobby fuente, con un **test
de ponderacion documentado**. El analisis base es el de `13-LEGAL-DOSSIER.md` §7.2-7.3, **con
un factor adicional propio de CRUCES: el riesgo de agregacion por sector** (§2). *A confirmar
por el asesor.*

### 7.3 Borrador de test de ponderacion — DELTA de la señal (sobre el borrador de 13)

Se reusa el borrador de test de `13-LEGAL-DOSSIER.md` §7.3. **El delta especifico de CRUCES**
que el asesor debe ponderar:

1. **Fin legitimo:** identico al de MONEY (transparencia legislativa, control ciudadano).
2. **Necesidad:** la señal es necesaria para que el ciudadano **lea de un vistazo** la
   composicion de la actividad de lobby de un parlamentario por sector economico; la lista
   plana de audiencias dispersas no permite ver esa composicion. *Pero* la agregacion es
   tambien la fuente del riesgo — la necesidad debe ponderarse contra ese riesgo.
3. **Ponderacion frente a los derechos del titular — FACTOR ADICIONAL CRUCES:**
   - a favor del fin: hechos ya publicos de lobby; sujetos de interes publico; proposito
     acotado sin inferencia; conteo neutro unico; sin aristas/caminos; sin score; contraparte
     cruda con fuente.
   - a favor del titular: la **agregacion por sector** puede leerse como insinuacion de
     afinidad / captura aunque ninguna audiencia fuente la afirme (§2); revelacion de
     terceros privados (contrapartes de lobby) en la evidencia (§3).
   - salvaguardas aplicadas: minimizacion por diseño (§4: no-LLM, conteo neutro, copy sobrio,
     carril aislado, doble candado), contraparte cruda nunca enlazada, sin rut/partido,
     deny-by-default para la señal y el RPC, gate de presentacion apagado hasta el sign-off.
4. **Conclusion del borrador:** *no se concluye.* El balance — y en particular si el riesgo de
   agregacion por sector inclina la ponderacion en contra del interes legitimo — lo dictamina
   el asesor.

> **PENDIENTE DE VALIDACION LEGAL.** El dossier **no afirma** que el interes legitimo sea base
> suficiente para la señal ni que el test resulte favorable una vez incorporado el factor de
> agregacion por sector. *A confirmar por el asesor.*

---

## 8. Trazabilidad y consumo por el gate

- **Sign-off como prerrequisito duro:** este dossier registra el estado del sign-off en su
  front-matter YAML (`signoff: pending`). El sign-off humano real es **deuda de operador
  (Phase 39)**, espejo del patron F17/NET (firma humana exclusiva).
- **Especificacion del gate `crucesPublicEnabled` (ya implementado, `app/lib/cruces-gate.ts`):**
  - **Doble candado** (ver §4).
    (a) **Datos:** `cruce_senal` nace **deny-by-default** a `anon` por RLS (migracion `0039`);
    el RPC `cruces_de_parlamentario` es **PII-safe** (nunca emite partido/rut/donante_id) y
    **sin grant a anon** (`0040`/`0041`).
    (b) **Presentacion:** flag server-only **`crucesPublicEnabled()`** (default `false`,
    fail-closed) en **`app/lib/cruces-gate.ts`**, espejo de `money-gate.ts` / `net-gate.ts`.
    Oculta la `<section id="cruces">` de la ficha y el RPC mientras no se encienda.
  - **Verificacion existente:** pgTAP `0041` (la señal emite `fecha_captura`; orden posicional
    exacto; **anon NO execute** sobre el RPC; cuerpo sin partido/rut/email/donante_id); test
    del gate (`crucesPublicEnabled` default `false`); tests anti-insinuacion del componente.
- **Consumo por el gate — los tres pasos de encendido (documentados, NO ejecutados por el
  agente):**
  1. **Firmar** el dossier CRUCEN-03 (humano → estado aprobado en el YAML) — Phase 39.
  2. **Aplicar** el grant gated **`0042_cruces_grant_anon.sql`** (operador, `psql --db-url
     --single-transaction -f` + fila en `schema_migrations`). `0042` lleva una precondicion
     fail-loud: aborta si `0041` no esta aplicada. Verificar con el pgTAP de encendido en
     `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql`.
  3. **Flip** `CRUCES_PUBLIC_ENABLED=true` (operador, Cloudflare).
  Los tres juntos. Encender **`crucesPublicEnabled`** **depende de la firma legal (estado
  aprobado) y de aplicar `0042`**. La dependencia es **verificable por inspeccion** del YAML:
  mientras `signoff` no sea aprobado, el operador **no** aplica `0042` ni enciende el flag.
- **Reversibilidad:** la construccion de la superficie (señal, RPC, componente, gate, tests)
  es reversible y avanza **bajo el gate apagado**; la **exposicion** no se enciende sin
  sign-off.

---

## 9. Checklist de sign-off para el asesor

> Completar al firmar. El estado se refleja en el front-matter YAML (`signoff`, `asesor`,
> `fecha_signoff`, `observaciones`) de este archivo y de su copia en `docs/legal/`.

- **Nombre del asesor:** Carlos Sánchez Rossi
- **Fecha del sign-off (ISO 8601):** 2026-06-24
- **Alcance cubierto:** CRUCES (señales parlamentario↔sector). MONEY queda fuera
  (`13-LEGAL-DOSSIER` / Phase 13); NET/grafo queda fuera (`17-LEGAL-DOSSIER` / Phase 17).
- **Observaciones:** Aprobado sujeto a mantener el tratamiento de los datos bajo el principio de proporcionalidad y finalidad, y a nueva revisión antes de la entrada en vigor de la nueva ley de datos personales (diciembre de 2026).

**Checklist por seccion** (marcar cada una al validar):

- [x] §1 Superficie CRUCES = composicion intra-bloque (lobby agregado por sector, no datos
      nuevos; señal lobby-pura `lobby_sector`): revisada y validada.
- [x] §2 Riesgo NUCLEAR — agregacion por sector como insinuacion de afinidad/captura +
      garantias de framing descriptivo (conteo neutro, sin aristas/caminos): revisada y
      validada.
- [x] §3 Datos sensibles y de terceros (contrapartes de lobby crudas; SIN partido, SIN
      sentido de voto, SIN rut/donante_id; contraparte nunca enlazada): revisada y validada.
- [x] §4 Minimizacion + doble candado (no-LLM, conteo neutro, carril aislado; Candado A =
      RLS deny-by-default `0039` + RPC sin grant `0040`/`0041` + grant gated `0042` no
      aplicado; Candado B = `crucesPublicEnabled` default OFF): revisada y validada.
- [x] §6 Atribucion fuente unica = lobby (mencion de fuente; NO CC BY 4.0): confirmada.
- [x] §7 Base de licitud (interes legitimo + test + **factor de agregacion por sector**):
      revisada y validada.
- [x] §8 Gate `crucesPublicEnabled` depende de la firma legal (estado aprobado) + aplicar
      `0042_cruces_grant_anon`: confirmada.
- [x] Decision de sign-off: (x) approved ( ) rejected — registrado en YAML `signoff: approved`.

---

## Anexo — Supuestos a verificar antes de firmar

Los supuestos **A1-A8** sobre la Ley 21.719 (idNorma, calendario, afiliacion politica como
dato sensible, interes legitimo, atribucion por dataset, reglamento pendiente, distincion
acceso/republicacion) **se reusan por referencia** del Anexo de `13-LEGAL-DOSSIER.md` — no se
re-enumeran aqui. A ellos se agregan los **supuestos especificos de la señal de cruce**:

| # | Afirmacion (especifica de CRUCES) | Riesgo si es incorrecta |
|---|-----------------------------------|-------------------------|
| C1 | La agregacion por sector de hechos publicos de lobby NO constituye, por si, un nuevo tratamiento que exija base de licitud propia | Si el asesor dicta que SI, la señal necesita su propia base — el sign-off lo condiciona o rechaza |
| C2 | Las garantias de framing (conteo neutro, sin aristas/caminos, sin lenguaje causal/afinidad, carril aislado, sin LLM) bastan para que el agregado sea descriptivo y no insinue afinidad/captura | Si no bastan, hay que reforzar el diseño (o no exponer ciertas señales) antes de encender el gate |
| C3 | La contraparte cruda + IdentityMarker (nunca enlazada, sin rut) es minimizacion suficiente para el tercero privado en la evidencia | Puede requerirse minimizacion adicional (p.ej. no exponer ciertas contrapartes) |
| C4 | La atribucion de la fuente de lobby (mencion de fuente, NO CC BY 4.0) se propaga correctamente por evidencia | Atribucion legalmente incorrecta si se etiqueta la señal como CC BY 4.0 |
| C5 | El doble candado (RLS deny-by-default sobre `cruce_senal` + RPC sin grant + `crucesPublicEnabled` default false + `0042` no aplicado) es defensa suficiente mientras el sign-off este pendiente | Si el candado tiene una fuga, la señal podria exponerse antes del sign-off |

> **Recordatorio final:** este dossier es **preparacion, no dictamen**. Ninguna afirmacion de
> licitud es definitiva; cada base de licitud queda **PENDIENTE DE VALIDACION LEGAL**. El
> riesgo nuclear de CRUCES — que la **agregacion por sector** de hechos publicos de lobby se
> lea como insinuacion de afinidad o captura — es precisamente lo que el abogado externo debe
> dictaminar y firmar. El abogado dictamina y firma.
