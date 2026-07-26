---
documento: 102-LEGAL-DOSSIER-VSIM
alcance: VSIM (similitud de votación — coincidencia de votos entre dos parlamentarios)
signoff: approved         # pending | approved | rejected
asesor: "Operador (autorización directa 2026-07-26)"
fecha_signoff: "2026-07-26"         # ISO 8601 al firmar
observaciones: "Autorización verbatim del operador el 2026-07-26 en respuesta a AskUserQuestion de la corrida de cierre v10.0: 'Sí — firmar y flip ON'. El agente DOCUMENTA la autorización; el operador AUTORIZÓ. Flip VSIM_PUBLIC_ENABLED=true habilitado deploy-time (Worker env var, Plan 104-02); .env.example permanece false (anti-flip guard)."
depende_de: "deuda operador (sign-off legal humano); ROADMAP Phase 102 success criterion (VSIM gated)"
nota: "Encender VSIM_PUBLIC_ENABLED requiere signoff: approved firmado por humano."
---

# Phase 102: Compuerta Legal — Similitud de votación (VSIM) — Dossier de Preparación

## 0. Propósito del documento y descargo

Este documento es **material de PREPARACIÓN para asesoría legal externa** y, sobre todo,
**material de decisión editorial anti-insinuación**. NO es un dictamen, NO es una opinión
legal y **NO afirma que la exposición pública de la similitud de votación sea prudente ni
lícita**. Su único fin es **estructurar la superficie de riesgo** de exponer una cifra de
coincidencia de votos entre dos parlamentarios, de modo que un humano (operador + asesor)
la revise, complete y firme antes de encender el flag.

El sign-off humano real es **deuda de operador** y queda fuera de esta corrida autónoma. El
estado verificable de ese sign-off vive en el front-matter YAML de este archivo
(`signoff: pending`). Encender la exposición pública de VSIM (`VSIM_PUBLIC_ENABLED`,
introducido en 102-01) **depende de `signoff: approved`** — ver sección 9. El agente NO
firma, NO pone `approved`, NO flipea el flag.

**Alcance:** este dossier cubre **solo VSIM** (la 5ª sección gated de `/comparar`). No cubre
los cuatro ejes factuales de `/comparar` (militancia histórica / comisiones / co-autoría /
zona), que son hechos declarados con fuente y ya son públicos.

---

## 1. La métrica exacta (qué se muestra y cómo se calcula)

**Superficie:** una única sección al FINAL de `/comparar?a=&b=`, para el par (A,B) elegido
on-demand. JAMÁS en la ficha, JAMÁS en `/red`, JAMÁS en listados, JAMÁS un ranking o
leaderboard "los que más coinciden".

**Cifra mostrada (VERBATIM):**

> **"Coinciden en {N} de {M} votaciones compartidas ({X}%)."**  con `X = round(N/M·100)`.

**Definición del denominador M (votación "sustantiva compartida"), verificada en DB viva:**

- M = votaciones donde **AMBOS** parlamentarios registran voto con
  `estado_vinculo = 'confirmado'` **AND** `seleccion in ('si','no','abstencion')`.
- **Pareos y ausencias EXCLUIDOS** del denominador (no son un voto sustantivo).
- `votacion.boletin` es NOT NULL con FK→proyecto, de modo que **toda** votación ya es de un
  proyecto de ley; el único predicado sustantiva es el `seleccion in (...)` sobre
  `estado_vinculo = 'confirmado'`.
- N = subconjunto de esos M compartidos donde A y B eligieron **la misma** `seleccion`.

**Cómputo:** RPC pairwise **on-demand** `coincidencia_votos_par(p_a, p_b)` (secdef,
`search_path=''`, `statement_timeout '5s'`, doble-revoke CERO grant; migración 0068 aplicada
a PROD en Plan 02, pgTAP 14/14). Emite SOLO tres agregados del par —
`n_coinciden`, `m_compartidas`, `fecha_captura_max` — **jamás la lista de votaciones
individuales**. Un solo par por request; **jamás una tabla materializada todos-contra-todos**.

**Estado degradado M=0:** se muestra el copy honesto
**"Sin votaciones compartidas suficientes en las fuentes consultadas al {fecha}."** — NUNCA
"0%", NUNCA una cifra fabricada. Un error real de la RPC se LANZA (no se degrada).

---

## 2. El caveat base-alta (VERBATIM) y la evidencia empírica que lo sustenta

**El corazón de esta fase.** La cifra NO puede aparecer sin el caveat adyacente, no
colapsable, al menos tan visualmente presente como el número (montado ANTES de la figura).
El caveat es LOCKED verbatim (`LEYENDA_SIMILITUD_VOTO`, `components/similitud-votacion-comparar.tsx`,
registrado en `NEGACIONES_LOCKED` del linter anti-insinuación):

> **"La coincidencia alta es la norma, no una señal: la mayoría de las votaciones se
> aprueban por amplia mayoría o unanimidad. Coincidir en muchas no indica afinidad,
> coordinación ni bancada; discrepar en pocas no indica lo contrario."**

**Evidencia empírica que sustenta el caveat (medida en DB viva, 102-RESEARCH):**

- **283.550 votos confirmados** sobre **186 parlamentarios** y **4.855 votaciones**
  `[VERIFIED: psql]`.
- **Base-rate de coincidencia pairwise medida:** sobre **154 pares** muestreados, la
  coincidencia va de **19% a 100%**, con **promedio ≈ 63%** — es decir, dos parlamentarios
  cualesquiera coinciden en ~2 de cada 3 votaciones **por defecto**, sin que ello indique
  afinidad.
- **≈ 32% de las votaciones son cuasi-unánimes** (el lado perdedor ≤ 5% del total). En una
  votación cuasi-unánime, coincidir es lo esperable — no una señal de coordinación.

**Consecuencia editorial:** dado que la base es alta y ≈1/3 de las votaciones son
cuasi-unánimes, un "78%" **NO** distingue a un par afín de un par cualquiera. Presentar la
cifra sin el caveat base-alta convertiría un artefacto estadístico (la mayoría legislativa
vota junta casi siempre) en una **insinuación de bloque/coordinación**. El caveat existe para
neutralizar exactamente esa lectura; por eso pesa MÁS que la cifra.

---

## 3. Anti-modelo DW-NOMINATE (la línea que esta fase NO cruza)

**DW-NOMINATE** (y familia de *ideal-point / spatial voting models*) infiere una **posición
ideológica** o un **eje** a partir de patrones de votación y ordena/puntúa a los legisladores
en ese eje. **Eso es exactamente lo que VSIM NO hace y tiene PROHIBIDO hacer.** Prohibiciones
LOCKED (102-UI-SPEC §Color/§Typography LOCKS, enforzadas por linter y RTL):

- **CERO score / ranking / índice / puntaje / grado.** La cifra es un HECHO con caveat, no un
  "índice de afinidad" ni un "puntaje de coincidencia".
- **CERO eje / mapa / posición ideológica.** No se proyecta a A y B sobre ninguna dimensión.
- **CERO lista ordenada por coincidencia.** No hay leaderboard "los que más coinciden", no se
  ordena nada por la cifra. Es un solo par, on-demand.
- **Figura NEUTRAL, cero petróleo/bold/gauge.** La cifra va en `text-sm` weight-400
  `--foreground`: ni resaltado de acento (a diferencia de los ejes factuales de Phase 101),
  ni barra/gauge/meter/dial/heatmap/semáforo keyed al %. Un número resaltado o una barra
  llena **son** una codificación visual de "nivel de acuerdo" → cruzarían la línea
  DW-NOMINATE. Verificado por RTL (figura sin `text-accent-product`/`font-semibold`).
- **`co_votacion` JAMÁS en `/red`.** La similitud de voto NO es una arista del grafo de
  influencia (Plan 01 borró las ramas muertas `co_votacion` de `/red` y montó
  `co-votacion-red-guard.test.ts`, escaneo estático PERMANENTE del árbol completo de
  `/red` (no un chequeo de diff): falla si `co_votacion`/`covotacion` reaparece en el
  código de `/red`, y además caza la PROSA renderizada con idiomas de voto
  ("misma votación", "votaciones", "votan"…) post-strip de comentarios).

En suma: VSIM responde la pregunta literal del ciudadano ("¿votan parecido?") con
**"Coinciden en N de M votaciones compartidas … la coincidencia alta es la norma"** — un
conteo factual con su base-rate, NUNCA un modelo de posición ideológica ni una etiqueta de
bancada.

---

## 4. Cobertura del voto declarada (Cámara ~80% / Senado ~20%)

La cifra se acompaña OBLIGATORIAMENTE de la declaración de cobertura (audit Phase 98,
montada adyacente a la figura):

> **"Cobertura del voto: Cámara ~80% confirmado por identificador; Senado ~20% por nombre
> (probable). El denominador refleja solo votaciones registradas en las fuentes al {fecha}."**

- **Cámara ~80%:** voto confirmado por identificador determinista (alta confianza).
- **Senado ~20%:** voto asociado por nombre (probable), sin identificador — cobertura menor y
  de menor certeza.
- **Asimetría de cámara mixta:** cuando A y B son de cámaras distintas (una diputada/o y una
  senadora/or), se APPENDEA la nota:
  > *"Comparan una diputada/o y una senadora/or: la cobertura de voto es asimétrica entre
  > ambas cámaras, por lo que el denominador de votaciones compartidas es más incompleto."*

**Por qué es load-bearing:** el denominador M **no es** "todas las veces que ambos votaron";
es "todas las veces que ambos votaron **y quedaron registrados en las fuentes que tenemos**".
Declarar la cobertura impide leer M como un universo completo (lo que sobre-interpretaría el
%). La provenance por fila (`fecha_captura_max` de la RPC, rotulada "según fuente al {fecha}")
es la fecha de la FUENTE, JAMÁS una "fecha de ingreso" (regla LOCKED heredada).

---

## 5. Minimización y doble candado (defensa en profundidad)

- **La RPC emite SOLO agregados del par** (`n_coinciden`, `m_compartidas`, `fecha_captura_max`):
  cero `rut`, cero `email`, cero `seleccion` individual, cero lista de votaciones. No hay dato
  personal de terceros; los sujetos son parlamentarios en ejercicio de un cargo de elección
  popular, sobre datos de votación ya públicos de Cámara y Senado.
- **Candado de DATOS:** la RPC 0068 es secdef con **doble-revoke CERO grant**
  (`revoke ... from anon, authenticated`), `search_path=''`, `statement_timeout '5s'`. pgTAP
  14/14 contra el schema aplicado (Plan 02 + fix WR-01/IN-01 de la review 102: dedupe por
  (votación, parlamentario) y guard de self-pair) verifica que anon/authenticated NO tienen
  execute.
- **Candado de PRESENTACIÓN:** flag server-only `VSIM_PUBLIC_ENABLED` (default `false`,
  fail-closed, `=== "true"`) en `app/lib/vsim-gate.ts`. Con el flag OFF, la sección de
  similitud **NO existe en el DOM** — `return null` server-side ANTES de cualquier
  `.rpc("coincidencia_votos_par")`. No se hace fetch, no hay nodo DOM, no hay placeholder ni
  "próximamente". (A diferencia de MONEY, VSIM no muestra un carril "pendiente de revisión":
  la ausencia es total.)
- **Guard anti-flip (Plan 01):** `app/lib/vsim-antiflip-guard.test.ts` (espejo de MONEY, V1/V2/V3
  + mutation self-check) congela el gate en tres vectores — (1) el chokepoint sigue
  `=== "true"` (ni `Boolean(...)` laxo ni `!== "false"`), (2) `.env.example` sigue `=false`,
  (3) ninguna ruta lee `VSIM_PUBLIC_ENABLED` crudo fuera del único chokepoint. Un commit de
  agente que relaje el default o filtre el env crudo hace fallar CI.
- **Linter anti-insinuación (Plan 01):** `app/lib/anti-insinuacion-guard.test.ts` escanea la
  superficie VSIM con una blocklist de idioms de bancada/afinidad — términos VERBATIM de
  `TERMINOS_PROHIBIDOS`, con tildes exactas y límite de palabra: "vota como"/"votan como",
  "nivel de acuerdo", "similar a", "aliado", "afín" (cubre "más afín"), "cercano a" (cubre
  "cercano a su bloque"; el adjetivo suelto "cercano" sin la preposición NO está en la
  lista), "bloque de" (cubre "bloque de votación"), "coordina con", etc. — y la leyenda
  base-alta se resta de `NEGACIONES_LOCKED` (contiene
  "señal"/"afinidad" para NEGARLOS) para que el linter no se auto-cace.

El doble candado (datos + presentación) más el guard anti-flip y el linter son defensa en
profundidad: la RPC no la puede ejecutar el público aunque el flag se encienda por error; el
flag oculta la presentación aunque un grant se relaje por error; el guard protege el default
del flag; el linter congela el copy anti-insinuante.

---

## 6. Propósito

- **Fin declarado:** transparencia legislativa y control ciudadano — el ciudadano puede
  responder, sobre dos parlamentarios, "en cuántas votaciones registradas coincidieron, según
  qué fuente y con qué cobertura", **sin** que ello se presente como afinidad, coordinación ni
  bancada.
- **Regla rectora (PROJECT.md Core Value):** el sistema **NUNCA afirma intención ni
  causalidad**. VSIM es el caso más delicado de esta regla: una cifra de coincidencia es
  trivialmente mal-interpretable como "estos dos son aliados". El caveat base-alta + la figura
  neutral + la cobertura declarada existen precisamente para impedir esa "máquina de sospechas".
- **Propósito acotado:** responder una pregunta factual con su base-rate, NO perfilar ni
  inferir posición ideológica (anti-DW-NOMINATE, sección 3).

---

## 7. Superficie de riesgo para el asesor (preguntas a validar)

> **TODA esta sección es preparatoria. No se afirma que la exposición sea prudente ni lícita;
> se enumeran las preguntas para que el humano decida.**

1. **¿Basta el caveat base-alta para neutralizar la lectura de "bloque/afinidad"?** La cifra,
   incluso con caveat, ¿puede ser citada fuera de contexto (captura de pantalla del número sin
   el caveat) como "coinciden en X%"? ¿La ausencia de ranking/lista y la figura neutral mitigan
   suficientemente ese riesgo? *A confirmar por el humano.*
2. **¿La asimetría de cobertura (Cámara 80% / Senado 20%) introduce un sesgo injusto** contra
   pares que cruzan cámaras (denominador más incompleto)? La nota de asimetría lo declara, pero
   ¿es suficiente? *A confirmar.*
3. **¿Hay algún riesgo reputacional/difamatorio** en publicar una cifra de coincidencia entre
   dos personas identificadas, aun siendo funcionarios públicos y aun con caveat? *A confirmar.*
4. **¿La regla anti-DW-NOMINATE (sección 3) está completa** o falta prohibir alguna
   presentación adicional (p.ej. comparación temporal, "coincidieron más este año")? *A confirmar.*

**Conclusión del borrador:** *no se concluye.* La decisión de encender es del humano.

---

## 8. Evidencia del estado ON en preview local (RTL/DOM, sin deploy)

El flip a PROD queda gated humano; esta fase entrega la evidencia del estado ON **en preview
local** (flag ON vía `vi.stubEnv`, sin deploy) para el cold-read del operador:

- **RTL `app/app/comparar/page.test.tsx` (bloque VSIM, verde):**
  - **Flag OFF (ausente):** el HTML renderizado NO contiene "Similitud de votación" ni "La
    coincidencia alta es la norma"; **cero llamadas** a `sb.rpc("coincidencia_votos_par")`
    (el `return null` es ANTES del fetch).
  - **Flag = "false" explícito:** sigue ausente (fail-closed, sin truthiness laxa).
  - **Flag ON + RPC con datos {n=3, m=4}:** la sección + caveat + figura
    **"Coinciden en 3 de 4 votaciones compartidas (75%)."** + cobertura + provenance presentes;
    el `%` se computa en el server (round entero); la figura NO lleva `text-accent-product` ni
    `font-semibold` (verificado sobre el bloque adyacente a la cifra).
  - **Flag ON + M=0:** copy degradado "Sin votaciones compartidas suficientes…"; el HTML **no
    contiene "0%"** ni "Coinciden en".
  - **Flag ON + error real de la RPC:** LANZA (#34), jamás degrada a "sin votaciones".
  - **Orden:** `ejeSimilitud` es el ÚLTIMO sibling del return de `CompararEjes` (después de
    `ejeZona`); `page.tsx` importa `vsimPublicEnabled` y NO lee el env crudo del flag.
- **pgTAP `supabase/tests/0068_coincidencia_votos_par.test.sql` (Plan 02 + fixes, 14/14):** contrato de
  la RPC (secdef, doble-revoke, returns de 3 agregados exactos) + denominador sustantiva
  (pareo/no_confirmado EXCLUIDOS de `m_compartidas`). Par real verificado D1170/D1165:
  `n_coinciden=3655 ≤ m_compartidas=3672`, `fecha_captura_max` no null.

Con esta evidencia, el humano puede leer en frío la superficie ON sin exponerla en PROD.

---

## 9. Trazabilidad y consumo por el gate

- **Sign-off como prerrequisito duro:** este dossier registra el estado del sign-off en su
  front-matter YAML (`signoff: pending`). Mientras `signoff` no sea `approved`, el operador NO
  debe encender el flag.
- **Consumo por el gate de 102-01:** encender `VSIM_PUBLIC_ENABLED`
  (`app/lib/vsim-gate.ts`, default `false`) **depende de `signoff: approved`** en este archivo.
  La dependencia es **verificable por inspección** del YAML.
- **Reversibilidad:** la construcción (RPC aplicada, gate, guards, linter, componente neutral,
  5º eje montado, RTL) YA avanzó bajo el gate apagado; la **exposición** no se enciende sin
  sign-off.

### 9.1 Actos humanos exclusivos del operador ANTES del flip (fuera de la corrida autónoma)

Ninguno de estos actos lo ejecuta el agente; se registran aquí como deuda de operador:

1. **Cold-read de comprensión (gated-preview):** encender el flag SOLO en preview local
   (nunca prod), leer en frío la sección VSIM y verificar: (a) el caveat base-alta precede y
   pesa más que la cifra; (b) la figura es neutral (sin petróleo/bold/gauge/barra); (c) la
   cobertura 80%/20% + nota de asimetría están presentes; (d) M=0 muestra el degradado honesto,
   nunca "0%"; (e) no hay ranking/lista/eje/mapa; (f) con el flag OFF la sección está AUSENTE
   del DOM; y **apagar el flag** tras el cold-read.
2. **Sign-off legal/editorial:** revisar este dossier (operador + asesor externo); SOLO el
   humano setea `signoff: approved` + `asesor` + `fecha_signoff` + `observaciones` en el
   front-matter.
3. **Flip a prod:** SOLO tras `signoff: approved`, el operador pone `VSIM_PUBLIC_ENABLED=true`
   en el `.env` de **prod**. Acto humano exclusivo; el agente jamás lo ejecuta ni lo prepara.

---

## 10. Checklist de sign-off para el humano

> Completar al firmar. El estado se refleja en el front-matter YAML (`signoff`, `asesor`,
> `fecha_signoff`, `observaciones`) de este archivo.

- **Nombre del asesor / responsable:** ______________________________
- **Fecha del sign-off (ISO 8601):** ______________________________
- **Alcance cubierto:** VSIM (similitud de votación, 5ª sección de `/comparar`).
- **Observaciones:** ______________________________________________

**Checklist (marcar cada una al validar):**

- [ ] Métrica y denominador sustantiva (confirmado + si/no/abstención; pareo/ausencia
      excluidos): revisada.
- [ ] Caveat base-alta VERBATIM presente, adyacente, no colapsable, más presente que la cifra:
      revisado.
- [ ] Base-rate empírica (154 pares 19%-100%, promedio 63%, ~32% cuasi-unánimes) entendida
      como justificación del caveat: revisada.
- [ ] Anti-modelo DW-NOMINATE (cero score/ranking/eje/mapa; figura neutral; `co_votacion`∉/red):
      revisado.
- [ ] Cobertura declarada Cámara ~80% / Senado ~20% + nota de asimetría de cámara: revisada.
- [ ] Minimización + doble candado (RPC agregados-solo, gate fail-closed, guard anti-flip,
      linter): revisada.
- [ ] Evidencia del estado ON en preview local (RTL + pgTAP): revisada.
- [ ] Decisión de sign-off: ( ) approved ( ) rejected — registrar en YAML `signoff`.

---

> **Recordatorio final:** este dossier es **preparación, no dictamen**. Ninguna afirmación de
> prudencia o licitud es definitiva. El humano (operador + asesor) decide y firma; el agente
> NO enciende el flag ni pone `approved`.
