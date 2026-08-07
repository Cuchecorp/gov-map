# 133-b — PREMORTEM de premisas

> **Modelo:** Opus. **Fecha:** 2026-08-07.
> **Método:** verificar premisas **ejecutando comandos** contra el repo, PROD y R2 — no leyendo
> documentos. Todas las cifras de abajo salieron de una corrida real; ninguna es proyección.
> El probe vivió en el scratchpad y en un archivo temporal ya **eliminado**
> (`git status` limpio verificado tras borrarlo). No quedó código de sonda en el repo.

---

## Veredicto

**Las tres premisas de capacidad que sostienen el plan de 133-b se CONFIRMAN, con margen.**
Ningún blocker de fondo. Un hallazgo nuevo (P-04) que el plan debe absorber, y una premisa
—la más peligrosa— que resultó **falsa a favor**: la cobertura de términos ya está en 100 %,
así que **el límite de truncado NO sube y no hay que re-etiquetar nada**.

---

## P-01 — ¿El crudo de R2 reconstruye la población de descartes? ✅ SÍ, biyección perfecta

**Por qué importa:** `noticia_url_vista` tiene seis columnas y **ninguna guarda el texto**
(`url_hash, url_canonica, outlet, estado, causa, primera_vista`). Los estratos `N-alea` y `N-sonda`
se construyen sobre descartados ⇒ si R2 no reconstruye, **esos dos estratos no existen** y el golden
se cae al piso de 74.

**Medido** — se leyeron los 15 snapshots de R2, se parsearon con `parseRss` y se recalculó el
`url_hash` con `urlHash`, la **misma función del cargador**:

| | |
|---|---|
| snapshots leídos | **15** (3 días × 5 feeds) |
| errores de parseo | **0** |
| ítems parseados (con duplicados entre días) | 735 |
| `url_hash` únicos reconstruidos | **579** |
| `url_hash` en `noticia_url_vista` | **579** |
| **en DB y reconstruidos** | **579 / 579 = 100,00 %** |
| en DB pero **no** en R2 | **0** |
| en R2 pero **no** en DB | **0** |

**Biyección exacta en las dos direcciones.** No es solo cobertura: no sobra ni falta un caso.

**Anti-cero-vacuo:** el conteo se comparó contra **579 medido en Postgres**, no contra sí mismo; y
el sanity de contenido da **579/579 con título no vacío**.

## P-02 — ¿La cobertura de `prefiltro.terminos` pasa el 95 %? ✅ SÍ, **100,00 %**

**Por qué importa:** es el chequeo D-133-F2.2 que **debe correr antes de etiquetar un solo caso**.
Si diera < 95 %, el límite de truncado tendría que subir **antes**; hacerlo después mueve el hash de
`golden-set.json` y obliga a re-etiquetar todo el golden. Era el riesgo más caro de la fase.

**Medido sobre el censo P completo** (`terminosQueMatchean` + `construirEntradaLlm` +
`coberturaTerminos`, las funciones reales de 133-a):

| | |
|---|---|
| casos P reconstruidos | **74 / 74** |
| casos con 0 términos (patología) | **0** |
| **cobertura** | **100,00 %** (umbral 95 %) |
| casos que no cubren | **0** |

⇒ **El límite de truncado se queda donde está** (`LIMITE_DESCRIPCION = 600` + margen). No hay
cambio de contrato antes de etiquetar. **El plan 133-b-03 pasa a ser confirmación, no remediación.**

### El control que hace que ese 100 % signifique algo

Un 100 % que no puede bajar es un falso verde. Se mutó el truncado y se midió si la métrica **cae**:

| Truncado de la descripción | Cobertura |
|---|---|
| actual (600 + margen) | **100,00 %** |
| 200 chars | 87,84 % |
| 80 chars | 54,05 % |
| 40 chars | 45,95 % |
| 0 chars (solo titular) | 40,54 % |
| entrada vacía | **0,00 %** |

Gradiente **monótono y fuerte**, con los dos extremos correctos. La métrica muerde. El 100 % es real.

**Y un dato que el plan debe usar:** a 200 chars la cobertura ya cae a 87,84 %, **bajo el umbral**.
El margen no es cómodo por casualidad — lo sostiene el límite actual. Nadie puede "optimizar" el
truncado en 134/135 sin invalidar el golden.

## P-03 — ¿Alcanzan los descartes para `N-sonda` (30) y `N-alea` (50)? ✅ SÍ bajo las tres reglas

> **⚠️ CORREGIDO 2026-08-07 tras la ronda 1 del checker (blocker B5).** La primera versión de este
> premortem publicó `elegiblesSonda = 68` **sin declarar la regla de matching**. El probe había usado
> `String.includes` pelado — que es precisamente lo que el régimen **PROHÍBE**
> (`prefiltro-lexico.ts:167`, `eval/entrada-llm.ts:41-42`). Un número correcto medido con la regla
> prohibida es un número inútil: nadie podía reproducirlo desde lo escrito. Re-medido con las tres
> reglas candidatas.

Medido sobre los 505 descartes reconstruidos, con los 8 tokens institucionales de D-133-B2 foldeados:

| Regla de matching | Elegibles `N-sonda` | ¿Reproducible? |
|---|---|---|
| `String.includes` pelado | 68 | ❌ **regla prohibida por régimen** |
| **prefijo con frontera IZQUIERDA** (`(^\|[^a-z0-9])<token>`) | **60** | ✅ **LA REGLA** |
| frontera completa (`contieneTerminoConFrontera`) | 57 | ❌ ver abajo |

### Por qué la regla es prefijo, y no frontera completa — el desglose lo decide

| token | completa | prefijo | substring |
|---|---|---|---|
| ministro | 7 | 8 | 16 |
| gobierno | 27 | 28 | 28 |
| la moneda | 4 | 4 | 4 |
| contraloria | 2 | 2 | 2 |
| presidente | 25 | 25 | 26 |
| **subsecretari** | **0** | **4** | 5 |
| oficialismo | 2 | 2 | 2 |
| oposicion | 2 | 2 | 2 |

**`subsecretari` con frontera completa matchea CERO.** No es casualidad: D-133-B2 lo escribió
**truncado a propósito** como stem, para cubrir `subsecretario`/`subsecretaria`/`subsecretaría`. Con
frontera derecha ese token **desaparece en silencio** del estrato — el sondeo de falso negativo
perdería una de sus ocho sondas sin que nada fallara. Por eso la regla correcta es **prefijo con
frontera izquierda**, y `contieneTerminoConFrontera` **no sirve** para este estrato (sí para
`coberturaTerminos`, donde los términos son palabras completas).

**Cifra congelada: `elegiblesSonda = 60`** bajo la regla de prefijo con frontera izquierda.

| Estrato | Disponible | Necesita | Holgura |
|---|---|---|---|
| `N-sonda` | **60** | 30 | 2,0× |
| `N-alea` (descartes restantes tras excluir sonda) | **445** | 50 | 8,9× |

La capacidad se cumple **bajo las tres reglas** (57, 60 y 68 superan 30), así que el blocker nunca
puso en riesgo el tamaño del golden — solo su reproducibilidad. La regla de disjunción de D-133b-2
(sonda primero, alea sobre el resto) no compromete el tamaño.

## P-04 — 🆕 HALLAZGO: 63 casos (10,9 %) no tienen descripción

**No estaba previsto en ningún documento.** De los 579 reconstruidos, **516 tienen descripción no
vacía y 63 no**. Para esos casos `entrada_llm.descripcion` es `""` y el anotador —y luego el
clasificador de 135— **ven solo el titular**.

Consecuencias que el plan debe absorber, no descubrir:

1. La regla de **decidibilidad textual** de D-133-A2 se vuelve más exigente en esos casos: si una
   clase no es decidible sobre el titular solo, esos casos serán `ambiguo` legítimamente.
2. **`justificacion` debe citar un fragmento literal** (D-133-C2.2). Con descripción vacía el
   fragmento solo puede salir del titular. Es cumplible, pero acota la longitud.
3. **Debe reportarse por separado**: `tasa_sin_descripcion` en el golden, y la exactitud debe poder
   leerse con y sin ese subconjunto. Si la exactitud cae mucho ahí, es un hallazgo sobre el
   **feed**, no sobre el modelo.
4. El muestreo de `N-alea` y de los **20 casos de calibración** no debe excluirlos ni concentrarlos:
   son parte honesta de la población.

**No es un blocker.** Es una limitación medida que se declara — y que, por D-133-B2.5, entra a la
página pública de la 137.

---

## Premisas que NO se pudieron verificar aquí, y por qué

| Premisa | Estado | Cuándo se resuelve |
|---|---|---|
| `tramitacion_legislativa` y `actividad_parlamentaria` llegan a **n ≥ 25** | **NO verificable antes de etiquetar** — es el huevo-y-gallina que D-133b-3 ordena | Plan 133-b-06, tras contar. Salida honesta escrita: la clase queda `no-medido` y **no enruta** |
| El par (acuerdo ≥ 0,80, κ ≥ 0,65) pasa | No verificable sin el operador | Planes 06/07, tras el checkpoint |
| Sonnet y Opus son suficientemente distintos | Se mide, no se asume | κ(h↔m) vs κ(m↔m), regla C2.1.3 |

Ninguna de las tres se puede adelantar sin fabricar el resultado que la fase existe para medir.

---

## Riesgos vivos para la ejecución

1. **`P-dirigido` saldrá de fixtures, no de la ventana** — el estrato P es un censo, así que el pool
   "restante de la ventana" está vacío por construcción (D-133b-3, paso 5). El plan debe tratar los
   fixtures como el camino **esperado**, no como el respaldo, y marcarlos como sobre-muestreo.
2. **La ceguera de los 20 casos se cumple por guard, no por promesa** (D-133b-5). Sin ese guard, el
   checkpoint más caro de la fase depende de que nadie mire un campo.
3. **El hash del golden se emite una sola vez, al final.** Cualquier cambio de semilla, límite o
   composición posterior obliga a re-etiquetar. Por eso P-02 se midió **ahora**.
4. **Determinismo del muestreo:** exigir el test de doble corrida **y** el control negativo con otra
   semilla. Sin el negativo, un muestreador que devuelve siempre los 50 primeros pasa como
   determinista.
5. **La ventana ya no crece sin que alguien la corra.** No hay cron hasta la Phase 136. Si 133-b se
   alarga, la ventana sigue siendo de 3 días salvo que se corra el conector — y **extenderla después
   de congelar la muestra invalida el golden**. La ventana queda **cerrada en 2026-08-07**.

---

## Cifras de entrada congeladas por este premortem

```
ventana:            2026-08-05 .. 2026-08-07  (3 días hábiles, CERRADA)
snapshots R2:       15  (5 feeds × 3 días, 0 errores de parseo)
noticia_url_vista:  579   (pasa 74 · descarta 505)
censo P:            74    latercera 50 · lacuarta 11 · exante 6 · biobiochile 6 · cooperativa 1
reconstrucción R2:  579/579 = 100,00 %  (biyectiva)
cobertura términos: 100,00 %  (umbral 95 %; a 200 chars caería a 87,84 %)
sin descripción:    63/579 = 10,9 %
N-sonda elegibles:  60   (necesita 30)  <- regla: PREFIJO con frontera izquierda
N-alea disponibles: 445  (necesita 50)
golden proyectado:  74 + 50 + 30 = 154 antes de P-dirigido   (piso duro 100 ✅)
```
