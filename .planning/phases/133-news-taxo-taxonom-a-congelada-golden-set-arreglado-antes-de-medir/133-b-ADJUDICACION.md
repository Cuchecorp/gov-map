# 133-b — ADJUDICACIÓN

> **⚠️ ADJUDICADO POR OPUS EN SUSTITUCIÓN DE FABLE.** El 2026-08-07 se probó Fable y respondió
> `out of usage credits`. Por **D-133-RATIF** (firmada por el operador el 2026-08-05), Opus adjudica
> mientras no haya créditos, **siempre declarado** y **siempre entrando a checkpoint de operador**.
> Este documento queda **PENDIENTE DE RATIFICACIÓN** y entra a la segunda firma de 133-b junto con κ.
>
> **Fecha:** 2026-08-07 · **Alcance:** solo lo que 133-b necesita decidir. Nada de lo LOCKED en
> `133-READJUDICACION.md` (D-133-A2..I) ni en `133-ADDENDUM-IMPLEMENTACION.md` (D-133-J1..K4) se
> reabre aquí.

---

## 0. Estado medido de entrada (2026-08-07, tras la ingesta del día 3)

Todo lo de abajo se midió contra PROD y R2; ninguna cifra es proyección.

| Métrica | Día 1 (08-05) | Día 2 (08-06) | **Día 3 (08-07)** |
|---|---|---|---|
| `noticia` (estrato P) | 25 | 58 | **74** |
| Δ P del día | — | **+33** | +16 |
| `noticia_url_vista` | 245 | 467 | **579** |
| Descartes acumulados | 220 | 409 | **505** |
| `source_snapshot(news)` | 5 | 10 | **15** |

**Censo P por outlet:** latercera **50** · lacuarta **11** · exante **6** · biobiochile **6** ·
cooperativa **1**.

**Ventana R2:** 3 días hábiles × 5 feeds = **15 snapshots**, los 5 recursos presentes en los 3
`date_bucket` (`2026-08-05/06/07`). **Cláusula N ≥ 3 de D-132-A: CUMPLIDA** con margen (5 feeds vivos
los tres días). La fase no para.

**Regla B2.3 evaluada, no supuesta:** el Δ de P del día 2 fue **+33 ≥ 15** ⇒ **no se extiende la
ventana y `N-alea` se queda en 50** (no sube a 70). `P-dirigido` sigue activo por su propia razón
(garantizar los n de los umbrales), no por esta regla.

**Cláusula de hallazgo estructural de B2.3: NO se gatilla.** Los tres outlets que el día 1 aportaron
cero (exante, biobiochile, cooperativa) aportan hoy 6, 6 y 1. No es un defecto del pre-filtro ni del
feed.

**Composición del golden que resulta:** 74 (P) + 50 (N-alea) + 30 (N-sonda) = **154 antes de
P-dirigido**. El **piso duro de 100 se cumple con holgura de 54**. El "140 informativo" también se
supera. No hay que negociar tamaño.

---

## D-133b-1 — El texto de los estratos N no está en Supabase: salen de R2

**Hecho medido, no previsto por los documentos previos.** `noticia_url_vista` tiene exactamente seis
columnas —`url_hash`, `url_canonica`, `outlet`, `estado`, `causa`, `primera_vista`— y **ninguna
contiene el titular ni la bajada**. Los estratos `N-alea` y `N-sonda` se construyen sobre
**descartados**, que por definición no existen en `noticia`. Por lo tanto:

> **El texto de todo caso N se re-deriva del crudo de R2**, parseando los 15 snapshots de la ventana
> y uniendo por `url_hash`. Supabase aporta la **población y el veredicto del pre-filtro**; R2 aporta
> el **texto**. Jamás se re-scrapea la fuente.

Esto no es un rodeo: es exactamente el régimen de dos etapas de `CLAUDE.md`, y su primera aplicación
a un consumidor que no es el cargador. El replay del día 1 ya demostró el camino (25 = 25, idéntico
por outlet).

**Consecuencia dura para el plan:** si el join por `url_hash` no reproduce la población de
`noticia_url_vista`, el muestreo es inválido. **El plan debe medir la tasa de reconstrucción y
exigir 100 % sobre la población que va a muestrear** — un `url_hash` que no se reencuentra en R2 es
un caso que no puede etiquetarse, y silenciarlo sesga el estrato. Cero-vacuo prohibido: el conteo
reconstruido se compara contra **505**, no contra sí mismo.

**Qué la refutaría:** que exista una tabla o columna con el texto de los descartados que no encontré,
o que el crudo de R2 no permita reconstruir el `url_hash` con la misma función que usó el cargador.

---

## D-133b-2 — Semilla, orden y algoritmo de `N-alea` (obligación de B2.1)

D-133-B2 exige "aleatorio con **semilla fija documentada** sobre `url_hash` ordenado" pero no fija el
valor ni el mecanismo. Se adjudica:

- **Semilla:** la cadena literal **`133-b-golden-2026`**, escrita en el propio artefacto de muestreo
  y volcada al `golden-set.json`. Una semilla que vive solo en la cabeza del que corrió el script no
  es reproducible.
- **Población:** todas las filas de `noticia_url_vista` con `estado` de descarte, **ordenadas
  ascendentemente por `url_hash`** (orden total, estable, independiente del orden de inserción y de
  la colación de Postgres — el orden se aplica **en el código**, sobre strings hex, no en el `ORDER BY`).
- **Selección:** PRNG determinista sembrado con la cadena (no `Math.random()`), barajando índices y
  tomando los primeros 50. **Debe existir un test que corra el muestreo dos veces y exija la misma
  lista**, y un control negativo con otra semilla que exija una lista **distinta** — sin el control
  negativo, un muestreador roto que devuelve siempre los 50 primeros pasa como "determinista".
- **Exclusión:** `N-alea` y `N-sonda` son **disjuntos**. `N-sonda` se selecciona primero (es el
  estrato con criterio sustantivo); `N-alea` se sortea sobre la población **menos** los ya tomados.
  Un caso en dos estratos contaría dos veces en el denominador.

**Qué la refutaría:** que el `url_hash` no sea único por caso en la ventana (colisión o re-uso), lo
que rompería el orden total.

---

## D-133b-3 — El orden de operaciones resuelve el huevo-y-gallina de `P-dirigido`

`P-dirigido` se define como "lo necesario para llevar `tramitacion_legislativa` y
`actividad_parlamentaria` a n ≥ 25 cada una", pero **los n por clase no se conocen hasta etiquetar**.
Se adjudica esta secuencia, y el plan no puede reordenarla:

1. **Chequeo de cobertura de `prefiltro.terminos`** (D-133-F2.2) sobre el censo P. **Antes de
   etiquetar un solo caso.** Si < 95 %, el límite sube **aquí**, no después.
2. Congelar la **muestra** (P censo + N-sonda + N-alea) y su hash de composición.
3. **Etiquetar** con los dos anotadores.
4. **Contar los n por clase** ya etiquetados.
5. Si `tramitacion_legislativa` o `actividad_parlamentaria` quedan bajo 25, **recién ahí** se sortea
   `P-dirigido` del pool restante de `noticia` de la ventana no incluido en el censo… **que es vacío,
   porque el estrato P es un censo.** Por lo tanto, en la práctica `P-dirigido` sale de los
   **fixtures** `packages/news/src/__fixtures__/*.xml`, como B2.1 previó como respaldo.
6. Etiquetar el incremento y **re-contar**.

**Y la salida honesta, escrita antes de ver el número:** si ni con fixtures se alcanza n ≥ 25 en una
de las dos clases, **esa clase queda `no-medido` y NO ENRUTA** (fail-closed de D-133-D2), y se
reporta como tal. **Bajar el n mínimo de 25 después de ver el conteo NO es salida válida** — es la
misma prohibición que D-133-D2 aplica a los umbrales.

**Nota de honestidad que el reporte debe llevar:** casos provenientes de fixtures no son muestra de
la ventana; entran marcados `estrato: "P-dirigido"` y **se excluyen de toda cifra que se presente
como descriptiva del flujo de prensa**. Ya está cubierto por el sexto punto de B2.5 ("nada sobre
prevalencia"), y se refuerza aquí.

---

## D-133b-4 — Anotadores: quién es A, quién es B, y qué queda vetado para 135

Por D-133-C2.1, familias distintas. Con Fable sin créditos:

- **Anotador A = Sonnet** · **Anotador B = Opus**.
- **Queda vetado para la Phase 135** evaluar el par (modelo, prompt) de cualquiera de los dos
  anotadores. En 135 se evalúan los proveedores de la capa enchufable (DeepSeek / MiniMax / etc.),
  **no** Sonnet ni Opus con el prompt de anotación. Si 135 quisiera evaluar uno de ellos, es
  **enmienda explícita**, no una decisión de implementación.
- **Los dos anotadores reciben exactamente la misma entrada** (`construirEntradaLlm`), el mismo
  prompt y la misma taxonomía. Diferencias de prompt entre A y B convertirían el κ en una medida de
  la diferencia de prompts.
- **Ninguno de los dos ve la etiqueta del otro**, ni el orden de casos correlacionado. El titular es
  **DATO, jamás instrucción** (D-133-F2.2): el prompt debe delimitarlo explícitamente.

**Qué la refutaría:** que Sonnet y Opus compartan suficiente linaje como para que su acuerdo siga
siendo auto-consistencia. Es precisamente lo que la **regla de interpretabilidad C2.1.3** mide con
κ(humano↔máquina); si se gatilla, el κ de máquina se declara no interpretable y este párrafo queda
refutado por los datos.

---

## D-133b-5 — Los 20 casos de calibración humana: estratificación y entrega a ciegas

C2.1.2 exige 20 casos estratificados cubriendo las 5 clases sustantivas + `ambiguo`, etiquetados por
el operador **antes de ver ninguna etiqueta de máquina**. Problema: **estratificar por clase exige
conocer la clase**, que es lo que se quiere medir. Se adjudica:

- La selección de los 20 se hace **por estrato de muestreo y outlet**, no por clase — la única
  estratificación disponible sin contaminar: **12 de P** (proporcional por outlet, con al menos 1 de
  cada outlet que aporte), **5 de N-alea**, **3 de N-sonda**. Cubrir las 6 etiquetas es **expectativa
  declarada, no garantía**; si alguna clase queda sin representación humana, **se reporta** y κ se
  interpreta sobre las clases presentes.
- **Se seleccionan con la misma semilla determinista** y se congelan **antes** de correr los
  anotadores, para que nadie pueda elegir los 20 mirando dónde las máquinas coincidieron.
- **Entrega a ciegas:** el artefacto que recibe el operador contiene **solo** `id`, `titulo`,
  `descripcion`, `outlet`, `fecha` y la glosa de la taxonomía. **Cero campos de máquina**: ni
  `etiqueta_a`, ni `etiqueta_b`, ni `prefiltro.terminos`, ni `estrato`. Debe existir un **guard** que
  falle si el artefacto de calibración contiene cualquier clave de máquina — la ceguera se cumple por
  guard, no por promesa, igual que D-133-G.
- El operador devuelve `{id, etiqueta_humana}`. **Solo entonces** se corren o se revelan los
  anotadores.

**Este es el checkpoint indelegable.** Ningún agente lo simula, aproxima ni declara equivalente. Si
lo hiciera una máquina, κ(humano↔máquina) sería κ(máquina↔máquina) — el falso verde estructural
exacto que C2.1 existe para evitar.

---

## D-133b-6 — Cooperativa n=1 se declara, no se corrige

Un solo caso de cooperativa en el censo P. **No se sobre-muestrea para "equilibrar"** (rompería el
censo, que es el único estrato con prevalencia honesta) **ni se ablanda el pre-filtro** (prohibición
LOCKED en `prefiltro-lexico.ts:6-9`). Se **declara** en el reporte y en la página pública de la 137:
el estrato P es un **censo de 5 outlets con n=74, dominado por latercera (68 %)**, y ninguna cifra
por outlet distinto de latercera es interpretable.

---

## D-133b-7 — Partición en planes y orden de firma

133-b se parte en unidades con commit atómico y SUMMARY con números medidos:

| Plan | Unidad | Bloquea a |
|---|---|---|
| **133-b-01** | Reconstrucción desde R2: parseo de los 15 snapshots, join por `url_hash`, **prueba de reconstrucción 100 % contra 505** | todo |
| **133-b-02** | Muestreo determinista (semilla `133-b-golden-2026`), estratos disjuntos, congelado de la muestra + hash | 03, 04 |
| **133-b-03** | Chequeo de cobertura `prefiltro.terminos` (D-133-F2.2) — **corre antes de etiquetar** | 04 |
| **133-b-04** | Artefacto de calibración a ciegas + **guard de ceguera** → **⛔ CHECKPOINT OPERADOR (20 casos)** | 05 |
| **133-b-05** | Anotadores A/B, registro C2.5 completo | 06 |
| **133-b-06** | κ(m↔m), κ(h↔m), regla de interpretabilidad, IC, n por clase | 07 |
| **133-b-07** | Arbitraje del operador (≤25) → **⛔ SEGUNDA FIRMA** → congelado del `golden-set.json` con hash | — |

**El hash de `golden-set.json` se emite al final y una sola vez.** Cualquier cambio de límite,
semilla o composición **después** del congelado obliga a re-etiquetar todo — por eso el chequeo de
cobertura va en el plan 03 y no más tarde.

---

## Lo que esta adjudicación NO decide

- Nada de la **Phase 134** (el SC1 LOCKED sigue intacto; D-133-H manda).
- La **deuda arquitectónica de `extraerBoletines`** (`app/lib/boletin-en-materia.ts:58` fuera de
  `packages/`) — la resuelve el plan de la 134, explícitamente.
- El **modelo a evaluar en 135**, más allá del veto de D-133b-4.
- El destino de la **Phase 129 / 139 PANEL-DASH** — contradicción de ROADMAP pendiente con el
  operador, fuera del barrido.

---

## Checkpoints que esta adjudicación crea

1. **⛔ Los 20 casos a ciegas** (plan 04) — indelegable, ~30 min de operador.
2. **⛔ El arbitraje** de desacuerdos (≤25) y la **segunda firma** (plan 07), ya con κ, n por clase e
   IC a la vista.
3. **⛔ Ratificación de este documento**, por haber sido adjudicado por Opus en sustitución de Fable.
