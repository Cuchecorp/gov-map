---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 02
fecha: 2026-07-29
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
commit_bundle: b4882e9
worker: observatorio-congreso
url: https://observatorio-congreso.thevalis.workers.dev
regimen: read-only (cero DDL/DML, cero deploy, cero flags, cero fixes de codigo)
---

# 125-E2E-A-FICHAS — Recorrido E2E de las rutas densas sobre el deploy real

Evidencia DOM por superficie de `/parlamentario/[id]` y `/proyecto/[boletin]` medida **contra el
deploy `0ea5d97f-a172-436e-aad0-add95940ee0e`** (§2 de `125-DEPLOY-RUNBOOK.md`), más el cierre de
los **2 ítems post-deploy** que la verificación de 122 dejó `human_needed`.

## §0 Método y su precio

**Régimen de request:** `curl` **secuencial**, **1 s** entre requests, User-Agent identificatorio,
**sólo** contra el Worker propio. **Cero** requests a fuentes gubernamentales. SQL: `psql -tA`
read-only con las queries **verbatim** de 122; `SUPABASE_DB_URL` nunca expandida ni ecoada.

**Los conteos usan `grep -o … | wc -l`, NUNCA `grep -c`.** El HTML del Worker es **una sola línea**
(`wc -l` = 1 en las 5 rutas medidas) ⇒ `grep -c` topa en **1** y es inservible para contar. El
`125-01` pagó este error leyendo `0` para marcadores que sí estaban.

**El DOM real vive DUPLICADO.** Cada literal aparece **dos veces** en la respuesta: una en el
**payload de RSC/flight** (escapado como JSON: `\",\"children\":\"…`) y otra en el **HTML servido**
(etiquetas reales). Los fragmentos citados abajo son siempre de la **segunda** ocurrencia (HTML
real). Se registra porque un grep ingenuo duplica todo conteo de copy.

**React intercala `<!-- -->`** entre texto y dígitos interpolados
(`<span class="font-mono">1</span> <!-- -->audiencia registrada menciona<!-- -->`), por lo que
ningún literal pelado con número matchea. Método usado en todo el documento: `grep -bo` sobre un
marcador **literal estable** → recorte de vecindad con `tail -c +N | head -c M` → extracción del
dígito con `grep -oE "[0-9]+"` → comparación **numérica**.

**Control inerte declarado:** `Actualizado hace` ya era **0 antes** del deploy (el build viejo
renderizaba `Actualizado <fecha absoluta>`). Se mide porque el plan lo pide, pero **no prueba nada**;
el discriminante real del fix de 117 es el par `Actualizado` 318→0 / `según fuente al ` 0→32, ya
medido en `125-DEPLOY-RUNBOOK.md` §3.2.

---

## §1 Los 2 ítems post-deploy heredados de 122 — CERRADOS

### §1.0 PASO 0 — precondición de frescura (BLOQUEANTE): **PASADA**

| # | control | resultado |
|---|---|---|
| 1 | `VERSIÓN DESPLEGADA` declarada en `125-DEPLOY-RUNBOOK.md` §2 | `0ea5d97f-a172-436e-aad0-add95940ee0e` ✓ |
| 2 | Marcador `3,8` en `/proyecto/14309-04` (literal que **sólo** existe tras el fix de 122) | **2** ocurrencias ✓ |
| 3 | ¿Parar y escalar? | **No** — el Worker sirve el bundle nuevo |

```bash
curl -s -A "$UA" "$B/proyecto/14309-04" -o p14309.html -w "HTTP %{http_code} bytes=%{size_download}\n"
# HTTP 200 bytes=1281964
grep -o "3,8" p14309.html | wc -l
# 2
```

Códigos de las 6 rutas de este plan, todas en una pasada secuencial:

| ruta | HTTP | bytes |
|---|---:|---:|
| `/proyecto/14309-04` | **200** | 1.281.964 |
| `/parlamentario/S1338` | **200** | 218.583 |
| `/parlamentario/D1165` | **200** | 850.150 |
| `/proyecto/16849-12` | **200** | 560.311 |
| `/proyecto/17870-05` | **200** | 8.158.027 |
| `/parlamentario/NOEXISTE` | **404** | 15.864 |
| `/proyecto/00000-00` | **404** | 16.479 |

### §1.1 Control (a) — `/parlamentario/S1338`: las DOS ausencias (cierre de CR-01)

El bloque de lobby se aísla por offsets literales: `id="lobby"` en **101630**, siguiente sección
`id="patrimonio"` en **101890** ⇒ el bloque son **260 bytes**, `[101630, 101890)`. Todo grep de este
control se declara **con ese alcance**, no sobre la página.

```bash
grep -bo 'id="lobby"' s1338.html        # 101630
grep -bo 'id="patrimonio"' s1338.html   # 101890
tail -c +101622 s1338.html | head -c 269   # bloque completo, desde el '<section'
```

**Fragmento DOM verbatim del bloque completo:**

```html
<section id="lobby" class="mt-12"><div class="flex flex-wrap items-baseline justify-between gap-2 mb-4"><h2 class="text-xl font-semibold">Reuniones de lobby</h2><span class="text-sm text-muted-foreground">—</span></div><div class="space-y-3"></div></section>
```

**Ausencia 1 — ningún dígito de conteo.** Texto visible del bloque (etiquetas removidas):
`Reuniones de lobby—`. El encabezado sigue en **`—`**.

```bash
tail -c +101622 s1338.html | head -c 269 | sed 's/<[^>]*>//g' | grep -o "[0-9]" | wc -l
# 0
```

**Ausencia 2 — ninguna frase «en las fuentes consultadas» en el bloque de lobby.**

```bash
tail -c +101622 s1338.html | head -c 269 | grep -o "en las fuentes consultadas" | wc -l
# 0
```

**Alcance declarado con honestidad:** la frase **sí existe 6 veces en la página** — y ninguna cae en
el bloque de lobby. Offsets medidos: **95232**, **107864**, **196397**, **196600**, **217897**,
**218069**. Las dos primeras acotan el bloque por ambos lados (95232 < 101630 y 107864 > 101890, ya
dentro de `id="cruces"` @107141); las cuatro restantes están en el payload de flight. Por eso el
`grep -c` global del `<automated>` del plan **no** puede ser el criterio: el criterio es la ausencia
**en la capa-1 de lobby**, que es lo que CR-01 arreglaba (un estado `no_ingerido` no puede afirmar
una ausencia en la fuente).

⇒ **Ítem 1 de 122 CERRADO.** El fix de tipo `no_ingerido` ≠ `0 reuniones` llegó al deploy: `S1338`
no muestra conteo **ni** afirma ausencia en fuente.

### §1.2 Control (b) — `/parlamentario/D1165`: no-regresión, **112**

```bash
for s in relaciones votos lobby patrimonio cruces; do grep -bo "id=\"$s\"" d1165.html; done
# relaciones:71056  votos:118622  lobby:121789  patrimonio:127544  cruces:131942
tail -c +121781 d1165.html | head -c 300
```

```html
<section id="lobby" class="mt-12"><div class="flex flex-wrap items-baseline justify-between gap-2 mb-4"><h2 class="text-xl font-semibold">Reuniones de lobby</h2><span class="text-sm text-muted-foreground">112</span></div><div class="space-y-3">…
```

Dígito **extraído** del texto visible y comparado numéricamente: **112**. Coincide con `Q-72`/`Q-73`
de 122 (`D1165|112|112|112|112|1`). El fix de capa-1 **no** tocó el camino `dato`. ✓ no-regresión.

### §1.3 Control (c) — línea de cobertura: presencia **y ORDEN**

Se prueba el **orden**, no la presencia: `offset(leyenda) < offset(cobertura) < offset(conteo)`,
con `grep -bo` sobre marcadores literales y comparación numérica.

```bash
grep -bo "La materia de estas audiencias menciona" $f.html                              # leyenda
grep -bo "195 de las 5.106 audiencias registradas" $f.html                              # cobertura
grep -boE "audiencia registrada menciona|audiencias registradas mencionan|Se muestran las" $f.html  # conteo
```

| ruta | ocurrencia | leyenda | cobertura | conteo | orden |
|---|---|---:|---:|---:|:---:|
| `/proyecto/14309-04` | flight | 835.439 | 835.771 | 836.152 | ✓ |
| `/proyecto/14309-04` | **HTML real** | **1.231.587** | **1.231.877** | **1.232.183** | **✓** |
| `/proyecto/16849-12` | flight | 492.998 | 493.330 | 493.712 | ✓ |
| `/proyecto/16849-12` | **HTML real** | **517.731** | **518.021** | **518.328** | **✓** |

`grep -o "(3,8 %), según fuente al 29 jul 2026" | wc -l` → **2** en cada ruta (flight + HTML): la
cifra viaja **con su fecha**, como exige el régimen del copy.

**Fragmento DOM verbatim (HTML real) de `/proyecto/14309-04`:**

```html
<p class="rounded-md bg-muted p-4 text-sm text-muted-foreground mb-4">La materia de estas audiencias menciona el número de este boletín en el registro público de la Ley del Lobby (Ley 20.730). La mención es un dato del registro; no implica influencia en la tramitación ni relación causal con el proyecto.</p><p class="text-sm text-muted-foreground mb-4">195 de las 5.106 audiencias registradas con parlamentario identificado y materia publicada citan el número de un boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte del registro.</p><p class="text-base leading-relaxed"><span class="font-mono">1</span> <!-- -->audiencia registrada menciona<!-- --> <!-- -->este boletín.</p>
```

**Fragmento DOM verbatim (HTML real) de `/proyecto/16849-12`** (conteo plural, 13):

```html
…(3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte del registro.</p><p class="text-base leading-relaxed"><span class="font-mono">13</span> <!-- -->audiencias registradas mencionan<!-- --> <!-- -->este boletín.</p>
```

Nota de sujeto: `16849-12` **no** es sujeto determinista del inventario 113. Se mide porque el propio
artefacto de 122 lo nombra en §"Qué queda pendiente de observar sobre el deploy real" como segundo
caso de la fila 5.12 (tiene menciones y ejercita el mismo camino de render, además del **plural**).
Por esa razón y ninguna otra.

⇒ **Ítem 2 de 122 CERRADO.** La línea de cobertura renderiza verbatim, con `3,8 %` y `29 jul 2026`,
y en el orden `leyenda → cobertura → conteo` en **ambos** boletines y en **ambas** copias del DOM.

### §1.4 Control (d) — `Q-74` re-ejecutada: la cifra horneada **sigue vigente**

Query **verbatim** de `122-CRUCES-SQL.md` §6 (con la sustitución ya declarada allí `bolet[ií]n` →
`bolet.n`, superset estricto), read-only:

```
5106|195|82|3.82
```

| esperado (122) | observado (125-02) | veredicto |
|---|---|:---:|
| `5106\|195\|82\|3.82` | `5106\|195\|82\|3.82` | **idéntico** ✓ |

⇒ **No hay que actualizar `COBERTURA_MENCIONES_LOBBY` ni `COBERTURA_OBSERVADA_EL`.** No se escala:
la condición de escalada del plan (cifra cambiada ⇒ cambio de código ⇒ re-deploy) **no se cumple**.

**`Q-69` sobre los sujetos de este plan** (la RPC que el sitio invoca, `filas|total_n`):

| boletín | `Q-69` | conteo en el DOM | veredicto |
|---|---|---|:---:|
| `14309-04` | `1\|1` | `1` audiencia registrada menciona | **cuadra** |
| `16849-12` | `13\|13` | `13` audiencias registradas mencionan | **cuadra** |
| `17870-05` | `0\|0` | (ver §3) | — |

---

## §2 `/parlamentario/[id]` — barrido de `D1165` y `S1338`

### §2.1 Secciones presentes (`grep -o 'id="…"' | wc -l`)

| ancla | `D1165` | `S1338` | contraste con inventario §4.1 |
|---|:---:|:---:|---|
| `id="relaciones"` | 1 | 1 | ✓ |
| `id="votos"` | 1 | 1 | ✓ (fila `4.1-A3-votos` de `114-ANCLAS.md`) |
| `id="lobby"` | 1 | 1 | ✓ |
| `id="patrimonio"` | 1 | 1 | ✓ |
| `id="cruces"` | 1 | **1** | ✓ presente en **ambos** — ver §2.6 nota 1 |
| `id="dinero"` | **0** | **0** | ✓ MONEY **OFF** ⇒ nodo ausente (A19 / C14-C17) |
| `id="financiamiento"` | **0** | **0** | ✓ MONEY **OFF** ⇒ nodo ausente (A20 / C18-C21). `S1338` emite en su lugar `id="financiamiento-pendiente"` (banda `opacity-60`): la ausencia **declarada**, no relleno |

Las 4 anclas del rail (`votos`, `lobby`, `patrimonio`, `cruces`) están **1 vez cada una** en ambas
fichas ⇒ ningún `href="#…"` del rail apunta a un destino inexistente.

### §2.2 Chips del rail (above-the-fold)

`grep -o 'aria-label="Secciones de la ficha"' | wc -l` → **0** en ambas fichas ⇒ **E-029 `ResumenView`
sigue huérfano** (re-confirmado). Los chips que llegan al DOM los emite el **rail**
(`page.tsx:520-550` vía `construirChips`). Método: offset de `href="#{ancla}"` → recorte de 900 B →
texto visible.

| chip | `D1165` (deploy) | `S1338` (deploy) | 122 §2.4.1 / §2.4.4 | veredicto |
|---|---|---|---|---|
| Votaciones | **1000** | **949** | `1000` / `949` | `discrepancia-declarada` (2.1) / `cuadra` (2.7) |
| Reuniones de lobby | **112** | **—** | `112` / `—` (`no_ingerido`) | `cuadra` (2.2 / 2.8) |
| Declaraciones de patrimonio | **6** | **9** | `6` / `9` | `cuadra` (2.3 / 2.9) |
| ◆ Lobby por sector | **11** | **sin registros** | `11` / `sin registros` (`vacio`) | `cuadra` (2.4 / 2.10) |
| Financiamiento y contratos | **pendiente** | **pendiente** | `pendiente` (MONEY OFF) | `cuadra` |

Los 3 estados-valores (`dato` / `vacio` / `no_ingerido`) se distinguen en el DOM y **ninguno se
rellena**: `112`, `—` y `sin registros` son tres cosas distintas y así se ven.

### §2.3 Relaciones — conteos honestos y truncamiento declarado

Todos los números SQL fueron **re-ejecutados hoy** (no copiados de 122):

| # (122) | superficie | RPC | SQL hoy (`filas\|total_n`) | DOM (deploy) | veredicto |
|---|---|---|---|---|:---:|
| 1.1 | `D1165` copartidarios | `copartidarios_de_parlamentario` | `20\|27` | `27 parlamentarios comparten el partido de la militancia vigente.` | `cuadra` |
| 1.2 | `D1165` misma zona | `de_la_misma_zona` | `0\|NULL` | **ausente del DOM** (cero literal de zona) | `cuadra` — vacío honesto por bloque |
| 1.3 | `D1165` co-comisionados | `co_comisionados_de_parlamentario` | `20\|24` | `24 parlamentarios comparten al menos una comisión.` | `cuadra` |
| 1.4 | `D1165` co-autores | `coautores_de_parlamentario` | `20\|48` | `48 parlamentarios han co-firmado al menos un proyecto de ley.` | `cuadra` |
| 1.5 | `D1165` militancia histórica | `militancia_historica_compartida` | `2\|2` | `En las militancias registradas: 2 parlamentarios militaron en un mismo partido (en períodos posiblemente distintos).` | `cuadra` |
| 1.6 | `S1338` copartidarios | `copartidarios_de_parlamentario` | `9\|9` | `9 parlamentarios comparten el partido de la militancia vigente.` | `cuadra` |
| 1.7 | `S1338` misma zona | `de_la_misma_zona` | `4\|4` | `4 parlamentarios comparten la zona electoral (distrito o circunscripción).` | `cuadra` |
| 1.8 | `S1338` co-comisionados | `co_comisionados_de_parlamentario` | `0\|NULL` | **ausente del DOM** (cero literal de comisión) | `cuadra` — vacío honesto por bloque |
| 1.9 | `S1338` co-autores | `coautores_de_parlamentario` | `20\|21` | `21 parlamentarios han co-firmado al menos un proyecto de ley.` | `cuadra` |
| 1.10 | `S1338` militancia histórica | `militancia_historica_compartida` | `2\|2` | mismo literal que 1.5 | `cuadra` |

**Los 3 literales de `D1165`** (regla WR-01/WR-02: el truncamiento se **declara**, nunca es
silencioso, y el número mostrado es el `total_n` honesto, no el `.length`):

```html
>Mostrando los primeros <!-- -->8<!-- --> de <!-- -->27<!-- -->.</p>
>Mostrando los primeros <!-- -->8<!-- --> de <!-- -->24<!-- -->.</p>
>Mostrando los primeros <!-- -->8<!-- --> de <!-- -->48<!-- -->.</p>
```

**Los 2 de `S1338`:**

```html
>Mostrando los primeros <!-- -->8<!-- --> de <!-- -->9<!-- -->.</p>
>Mostrando los primeros <!-- -->8<!-- --> de <!-- -->21<!-- -->.</p>
```

**Idénticos a los de 122 §2.1/§2.2** (`8 de 27`, `8 de 24`, `8 de 48`; `8 de 9`, `8 de 21`) y
coherentes con el `total_n` re-ejecutado. **Cero `discrepancia-corregida` en relaciones.**

### §2.4 Votos — el canario de 124: **1000, NO 3752**

Método obligado (el dígito va interpolado; se usó el método por offset para no depender de la suerte
de que un literal concreto sea un template JS sin `<!-- -->`):

```bash
grep -bo "Ver detalle" d1165.html          # 120666 = dentro de id="votos" [118622, 121789)
tail -c +120661 d1165.html | head -c 90    # recorte de vecindad
# → dden">Ver detalle (1000)</span>…   ⇒ dígito EXTRAÍDO = 1000 ⇒ comparación NUMÉRICA 1000 == 1000
```

| # (122) | superficie | SQL hoy | DOM (deploy) | veredicto |
|---|---|---|---|:---:|
| 2.1 | `D1165` #votos `Ver detalle (N)` | `Q-16` primeros principios = **3752** · `Q-17` RPC `p_limit=1000` = **1000** | **1000** | **`discrepancia-declarada` — SIGUE DECLARADA** |
| 2.5 | `D1165` #votos asistencia | `Q-18` real = `3723 de 3752` | `Presente en 973 de 1000 votaciones · Ausente en 27.` | **`discrepancia-declarada` — SIGUE DECLARADA** |
| 2.6 | `D1165` #votos capa-1 | `Q-25` real Σ 3752, asistencia 99,2 % | `A favor: 469, En contra: 466, Abstención: 22, Pareo: 16, Ausente: 27` (Σ **1000**) | **`discrepancia-declarada` — SIGUE DECLARADA** |
| 2.7 | `S1338` #votos `Ver detalle (N)` | `Q-16` = **949** · `Q-17` = **949** (bajo el cap) | **949** | `cuadra` |
| 2.11 | `S1338` #votos asistencia | `Q-18` `949` de `949`, 0 ausentes | `Emitió 949 votos registrados.` (rama `ausentes = 0`) | `cuadra` |

**Fragmentos DOM verbatim:**

```html
dden">Ver detalle (1000)</span><span class="hidden group-data-[state=open]:inline">Ocultar
mt-1">Presente en<!-- --> <span class="font-mono">973<!-- --> de <!-- -->1000</span> <!-- -->votaciones · Ausente en <span class="font-mono">27</span>.</p>
mt-1">Emitió <!-- -->949<!-- --> votos registrados.</p>
```

**El canario se explica hasta el fondo, no se asume.** `0078` **sí** aterrizó — el clamp está en el
cuerpo de la función en PROD:

```sql
select case when pg_get_functiondef(p.oid) ilike '%least(coalesce(p_limit%'
       then 'clamp least(coalesce(p_limit,20),4000) PRESENTE' else 'clamp AUSENTE' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'votos_de_parlamentario';
-- clamp least(coalesce(p_limit,20),4000) PRESENTE
```

Firma real leída de PROD: `votos_de_parlamentario(p_id text, p_limit integer DEFAULT 20, p_offset
integer DEFAULT 0)`. El clamp topa en **4000**, pero el **call-site del sitio sigue pasando 1.000**
⇒ `Q-17` devuelve exactamente `1000` y el DOM muestra `1000`. **`B-01` (exactitud) sigue abierto y
fuera del alcance de 124.** **Cero hallazgo, cero escalada:** `1000` es exactamente lo esperado.

### §2.5 Cruces de parlamentario y fechas

| # (122) | superficie | SQL hoy (`Q-49`) | DOM (deploy) | veredicto |
|---|---|---|---|:---:|
| 3.b-1 / 3.b-2 | `D1165` #cruces | **11** | `Ver las 11 señales de lobby por sector` + chip `◆ Lobby por sector 11` | `cuadra` |
| 3.b-7 | `S1338` #cruces | **0** | `sin registros` + *"Aún no se registran reuniones de lobby en las fuentes consultadas."*, **sección presente** | `cuadra` — el cero se presenta como cero |
| 3.b-9 | `S1338` empty-state de E-053 | `0` | **no emitido** (E-053 sólo se monta con `tipo === "dato"`) | **`discrepancia-declarada` — SIGUE DECLARADA** (código muerto, no dato erróneo) |

`<section id="cruces">` de `S1338`, verbatim, **byte-idéntica** a la citada por 122 §4.3:

```html
<section id="cruces" class="mt-12"><div class="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3"><h2 class="flex items-center gap-2 text-lg font-semibold text-accent-product"><span>¿Con qué sectores tuvo reuniones de lobby?</span><span class="ml-auto text-sm font-normal text-muted-foreground">sin registros</span></h2><p class="text-xs text-muted-foreground">Sectores de las contrapartes registradas bajo la Ley del Lobby (Ley 20.730). El número indica cuántas reuniones aparecen en el registro oficial; solo muestra hechos públicos, no establece relación entre una reunión y ninguna otra actuación del parlamentario.</p><p class="text-sm text-muted-foreground">Aún no se registran reuniones de lobby en las fuentes consultadas.</p></div></section>
```

**Nota de alcance de §1.1:** esta frase *"…en las fuentes consultadas"* es una de las 6 ocurrencias de
la página (offset 107864, dentro de `id="cruces"` @107141) y es **legítima**: cruces tiene estado
`vacio` (cron global ⇒ `ingestado = true`), a diferencia de lobby que es `no_ingerido`. Ésa es
exactamente la distinción que CR-01 arregló, y por eso el control de §1.1 se acota al bloque de lobby.

**Fechas visibles (117) — `grep -o … | wc -l`:**

| marcador | `D1165` | `S1338` | criterio | veredicto |
|---|---:|---:|---|:---:|
| `según fuente al ` (idiom LOCKED F-01) | **14** | **20** | presente | ✓ |
| `recalculado por el Observatorio al ` | **180** | **0** | presente donde aplica | ✓ (`S1338` no tiene derivados de cruce) |
| `Actualizado hace` | **0** | **0** | 0 | ✓ pero **control INERTE** (§0) |
| `Actualizado` (idiom viejo, discriminante real) | **0** | **0** | 0 | ✓ el reemplazo llegó |
| `corte al` | **0** | **0** | 0 | ✓ (C15/C19 son MONEY, OFF) |
| `captura` pelado (`grep -oiE "(^\|[^a-záéíóúñ])captura([^a-záéíóúñ]\|$)"`, 117 §3) | **0** | **0** | 0 | ✓ `fecha_captura` jamás se presenta como el hecho (L-6 de 122) |

⇒ Las 21 filas de la Tabla C de §4.1 se resuelven así: **C1** (cabecera) ya no dice
`Actualizado {hace X}` sino el idiom `según fuente al `; **C2, C6, C8, C10, C11, C13** (las de
`fecha_captura` vía badge) viajan bajo el mismo idiom; **C3, C4, C5, C7, C9, C12** (fechas de
**hecho**) no llevan idiom de captura, como manda 117; **C14-C21** no emiten (MONEY OFF).

### §2.6 `not-found` y emisores huérfanos

**`/parlamentario/NOEXISTE` → HTTP 404** ✓ (y `/proyecto/00000-00` → **404** ✓).

**[RULE-1 · HALLAZGO-125-02-01] El copy de `not-found` NO viaja en el HTML servido, sólo en el payload
de RSC.** Medido, no supuesto:

```bash
grep -o "<main" nf_proy.html | wc -l                                                            # 0
grep -o '<h1 class="text-xl font-semibold">Proyecto no encontrado</h1>' nf_proy.html | wc -l     # 0
grep -o "Proyecto no encontrado" nf_proy.html | wc -l                                           # 1  ← en el payload
grep -o "NEXT_HTTP_ERROR_FALLBACK;404" nf_parl.html | wc -l                                     # 1
```

Fragmento del payload de `/parlamentario/NOEXISTE` (**byte-idéntico** al fuente de E-049
`app/app/parlamentario/[id]/not-found.tsx:11-14`):

```
notFound\":[[\"$\",\"main\",null,{\"className\":\"max-w-[1120px] mx-auto px-4 md:px-8 py-16 text-center\",\"children\":[[\"$\",\"h1\",null,{\"className\":\"text-xl font-semibold\",\"children\":\"Parlamentario no encontrado\"}],[\"$\",\"p\",null,{\"className\":\"text-base leading-relaxed text-muted-foreground mt-4\",\"children\":\"No encontramos a este parlamentario en el registro. Es posible que el identificador sea incorrecto.\"}],…
```

**Disposición honesta:** el criterio del plan (**404**) se cumple, el copy correcto **sí se entrega** y
se hidrata en cliente, y **nada se fabrica**. Pero el `<main>` de E-049/E-023 **no está en el HTML
SSR**: el shell servido sólo trae chrome (wordmark) y el `notFound` se resuelve tras hidratación
(`digest: NEXT_HTTP_ERROR_FALLBACK;404`). Severidad **baja** (no es dato erróneo ni relleno; el status
HTTP es correcto y el contenido llega). **Cero fix aquí** — este plan es read-only por régimen.
Handoff: catálogo 113 (anotar que E-049/E-023 son cliente-hidratados) y, si se quisiera SSR, un plan
de código futuro.

**Emisores huérfanos de esta ruta — se DECLARAN, no se buscan en el DOM** (§0.4/§0.5 y L-3 de 122):

| emisor | archivo | por qué es huérfano | evidencia |
|---|---|---|---|
| **E-029** `ResumenView` / `ParlamentarioResumen` | `app/components/parlamentario-resumen.tsx` | `page.tsx` importa **sólo** `construirChips` + el tipo `ResumenChip`; `ResumenView` no tiene call-site | `grep -o 'aria-label="Secciones de la ficha"' \| wc -l` → **0** en `D1165` y `S1338` |
| **E-053** (empty-state) | `app/components/cruces-de-parlamentario.tsx:128-139` | sólo se monta con `conteos.cruces.tipo === "dato"` (`page.tsx:682`) ⇒ su rama de vacío es inalcanzable | fila 3.b-9, `discrepancia-declarada` |
| **E-003** · **E-008** `actualidad-module.tsx` | — | sin call-site en esta ruta | no se buscan (L-3) |

**Nota 1 — corrección al inventario 113 §4.1 ("Diferencia por sujeto").** El inventario afirma que con
`S1338` *"A3 no ofrece la entrada `#cruces`"*. **El deploy lo contradice:**
`grep -o 'href="#cruces"' s1338.html | wc -l` → **1** y `grep -o 'id="cruces"' s1338.html | wc -l` →
**1**. Es coherente con 122 §2.4.4 (el chip existe con estado `vacio` = `sin registros`, porque el
cron de cruces es global ⇒ `ingestado = true`), que ya había superado ese supuesto. Se registra como
**corrección de catálogo**, sin acción de código.

**Nota 2 — `S1338` no es el caso de vacío total** (LÍMITE 1 de 122, re-confirmado hoy por SQL): tiene
**4 de 5** ejes con datos (`9 / 4 / 0 / 21 / 2`). El contrato `RelacionesSection vacio` no se dispara
para ningún sujeto de PROD. Lo verificado es el vacío honesto **por bloque** (filas 1.2 y 1.8).

---

## §3 `/proyecto/[boletin]` — `14309-04` (bicameral) y `17870-05` (zona solo-Senado)

### §3.0 Los dos sujetos, confirmados por SQL (no asumidos)

```sql
select p.boletin || ' | prm_id_camara=' || coalesce(prm_id_camara::text,'NULL') from public.proyecto
where boletin in ('14309-04','17870-05') order by boletin;
-- 14309-04 | prm_id_camara=14891
-- 17870-05 | prm_id_camara=NULL      ← el sujeto D de 113 §1.4, zona solo-Senado
```

| boletín | `prm_id_camara` | votaciones | eventos de tramitación |
|---|---|---:|---:|
| `14309-04` | **14891** | 7 | 99 |
| `17870-05` | **NULL** | 256 | 355 |

### §3.1 Anclas emitidas — **las mismas 12 en ambas rutas**

```bash
grep -o 'id="[a-z-]*"' $f.html | sort -u
```

`autores` · `cruces` · `cuerpos-legales` · `estado` · `estado-actual` · `idea-matriz` ·
`lobby-menciones` · `lobby-tramitacion` · `similares` · `timeline` · `validacion-fuente` ·
`votaciones` — **12/12 en las dos rutas**. La ruta solo-Senado **no oculta secciones**: degrada
**dentro** de ellas (§3.4).

**Gotcha de Suspense confirmado en vivo:** en `17870-05` la mayoría de secciones llega al shell como
placeholder (`<!--$?--><template id="B:8">` + `animate-pulse`) y el contenido real vive en
`<div hidden id="S:8">` más adelante (offset 1.026.807 para cruces, 1.032.629 para validación de
fuente). **Leer sólo el shell habría reportado "sección vacía" en 11 de 12 secciones.** Todos los
fragmentos de abajo salen del `div hidden` resuelto.

### §3.2 Cruces de proyecto — re-calculados contra SQL

```sql
select count(*) from public.cruces_de_proyecto('<boletin>');
-- 14309-04 → 47   ·   17870-05 → 0   ·   18296-05 → 30 (runner-up de 122, control)
```

| # (122) | superficie | SQL hoy | DOM (deploy) | veredicto |
|---|---|---:|---|:---:|
| 3.a-1 | `14309-04` encabezado de cruces | **47** | `…con el sector del proyecto</span><span class="…tabular-nums…">47 parlamentarios</span>` | `cuadra` |
| 3.a-2 | `14309-04` disclosure | **47** | `dden">Explorar los 47 cruces</span>` | `cuadra` |
| — | `17870-05` encabezado de cruces | **0** | `sin registros` + copy de cero declarado (§3.4) | `cuadra` — el cero se presenta como cero |

El número vivo se registra, no el recordado: **`47` sigue siendo `47`** y sigue siendo el techo del
universo (fila 3.a-6: la RPC **no** tiene `LIMIT`, `tiene_limit = f`) ⇒ ningún cap alcanzable.

### §3.3 Tramitación, timeline y fechas — contrastados con la disposición de 117

**F-03 — badge con `notaAgregacion="evento más reciente"`.** Presente en **ambas** rutas (4
ocurrencias cada una = 2 en HTML + 2 en payload), y la fecha **cuadra con el SQL**:

| ruta | DOM verbatim | `max(fecha_captura)` de `tramitacion_evento` | veredicto |
|---|---|---|:---:|
| `14309-04` | `según fuente al <!-- -->09 jul 2026<!-- --> (evento más reciente)` | `2026-07-09` | `cuadra` |
| `17870-05` | `según fuente al <!-- -->10 jul 2026<!-- --> (evento más reciente)` | `2026-07-10` | `cuadra` |

El calificador está presente ⇒ el badge **no** presenta un agregado (`max`) como si fuera la captura
de la ficha entera. Es exactamente el fix F-03.

**F-05 / F-07 — rótulos de hito, con la divergencia de 117 §2(f) DECLARADA, no leída como
inconsistencia.** 117 cerró F-07 de **dos** formas según la adyacencia real del layout, y ambas
aparecen en el deploy:

| variante | superficie | forma | HTML real `14309-04` | HTML real `17870-05` |
|---|---|---|---:|---:|
| A — separador `{" — "}` (U+2014), cero rótulo nuevo | `capa1/tramitacion-stepper.tsx` | la fecha vive en el MISMO `<p>` que la descripción | ` — ` × 24 (total) | ` — ` × 525 (total) |
| B — rótulo `Hito del {fecha}` | `timeline-event.tsx:102` (`fechaHechoCorta`) | la fecha vive en el header junto al `CamaraChip` | **85** (`>Hito del <span`) | **355** (`>Hito del <span`) |
| — rótulo `Votada el {fecha}` | `votacion-card.tsx:48` | tarjeta de votación | **7** (`>Votada el<!-- -->`) | **256** (`>Votada el<!-- -->`) |

**Cuadre exacto contra la base:** `Votada el` en HTML = **7** = `votacion` de `14309-04`; = **256** =
`votacion` de `17870-05`. `Hito del` en HTML de `17870-05` = **355** = `tramitacion_evento` de
`17870-05`. Cuadre **1 a 1**, sin sobra ni falta.

**Observación abierta (no se cierra, no se fabrica):** en `14309-04` hay **85** `Hito del` contra
**99** eventos en `tramitacion_evento`. Se muestran **menos**, nunca más ⇒ no hay relleno ni
invención; pero este plan **no** audita la regla de selección del timeline (F-03/F-07 sólo gobiernan
el **rótulo** y el **helper**, no la cardinalidad). Se registra como pendiente de un plan que audite
la selección de eventos del timeline, en vez de declararlo `cuadra` sin la query que lo demuestre.

**F-09 / gotcha rector "date-only disfrazado de `timestamptz`" — probado con un caso real.** La
última votación real de `17870-05` (Pitfall 8 de 113: filtrar `fecha <= current_date` porque PROD
tiene fechas corruptas en el futuro):

```sql
select max(fecha)::text from public.votacion where boletin='17870-05' and fecha <= current_date;
-- 2025-11-26 20:32:50+00
```

y el DOM rinde:

```html
t-sm text-muted-foreground leading-none">Votada el<!-- --> <span class="font-mono">26 nov 2025</span></span>
```

**`26`, no `25`.** Si el render aplicara una conversión de zona global sobre una fecha que ya es el
día chileno, habría mostrado `25 nov 2025`. El helper de hecho (`fechaHechoCorta`) preserva el día.
Es el gotcha rector de v12.0 (una tz global fabricaría ~45k días equivocados) y aquí **no muerde**.

**Rótulo de hito de `17870-05`, verbatim:**

```html
-2"><span class="text-sm text-muted-foreground leading-none">Hito del <span class="font-mono">05 ene 2026</span></span></div><p class="text-sm font-semibold mt-1 capitalize">tramite</p><p class="text-base leading-relaxed mt-1">Cuenta, Ofici…
```

**Controles de fecha prohibida — `grep -o … | wc -l`:**

| marcador | `14309-04` | `17870-05` | criterio | veredicto |
|---|---:|---:|---|:---:|
| `según fuente al ` | **32** | **527** | presente | ✓ idiom LOCKED F-01 |
| `recalculado por el Observatorio al ` | **288** | **0** | presente donde aplica | ✓ |
| `Actualizado hace` | **0** | **0** | **0** | ✓ (control INERTE, §0) |
| `Actualizado` (idiom viejo) | **0** | **0** | **0** | ✓ discriminante real: 318→0 |
| `corte al` | **0** | **0** | **0** | ✓ |
| `captura` pelado (117 §3) | **0** | **0** | **0** | ✓ |

**[RULE-1] Falso negativo propio, corregido y declarado.** La primera pasada midió `Votada el ` **con
espacio final** y leyó **0** en ambas rutas — habría reportado "el rótulo de votación no llega al
deploy", que es **falso**. La causa es la misma familia de gotcha que el plan advierte: el fuente es
`Votada el{" "}` (`votacion-card.tsx:48`), que React rinde como `Votada el<!-- --> <span…`, así que el
espacio **nunca** sigue al literal. Valor correcto: **7** y **256**. Se deja constancia del error y su
corrección en vez de publicar sólo el número bueno.

### §3.4 Zona solo-Senado (`17870-05`) — degradación honesta, copy verbatim

**El discriminante duro: cero links construidos a la Cámara.**

```bash
grep -o 'href="https://[a-z0-9.-]*' $f.html | sort -u
# p14309 → creativecommons.org  opendata.camara.cl  tramitacion.senado.cl  www.camara.cl
# p17870 → creativecommons.org  opendata.camara.cl  tramitacion.senado.cl
```

| host | `14309-04` | `17870-05` | lectura |
|---|---:|---:|---|
| `www.camara.cl` (**construido** por `buildCamaraUrl` desde `prm_id_camara`) | **146** | **0** | ✓ la rama sin `prm_id_camara` **no** se ejecuta |
| `opendata.camara.cl` (**columna** `votacion.enlace`, no builder) | 12 | 220 | ✓ dato de columna, ajeno a `prm_id_camara` |
| `tramitacion.senado.cl` | 9 | 279 | ✓ |

Es exactamente la expectativa declarada en 113 §1.4. Y **no** se emite un link roto ni un
`href="#"`: el nodo simplemente **no existe**.

**Copy verbatim de la degradación en «Valida este dato en la fuente»** — misma sección, `<ul>` con
**un solo** `<li>` en lugar de dos:

```html
hidden id="S:c"><div class="rounded-lg border border-border bg-card p-6 space-y-4"><h2 class="text-xl font-semibold">Valida este dato en la fuente</h2><p class="text-xs text-muted-foreground">según fuente al<!-- --> <span class="font-mono">10 de julio de 2026</span></p><ul class="space-y-3"><li><a href="https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=17870-05" target="_blank" rel="noopener noreferrer" aria-label="Ver en el Senado (abre en nueva pestaña)" …><span class="text-sm font-normal">Ver en el Senado ↗</span><span class="text-xs text-muted-foreground no-underline">Ficha de tramitación oficial</span></a></li></ul><div class="pt-2 border-t border-border space-y-1"><p class="text-xs text-muted-foreground">Respaldo del<!-- --> <span class="font-mono">10-07-2026</span> · <!-- -->hash<!-- --> <span class="font-mono">ed19eb5942c2<!-- -->…</span></p><p class="text-xs text-muted-foreground">Esto decía la fuente ese día.</p></div></div>
```

**Contraste bicameral de `14309-04`** (mismo bloque, **dos** `<li>`; el `prmID=14891` del href es
exactamente el `prm_id_camara` leído de la base):

```html
…<li><a href="https://tramitacion.senado.cl/…?boletin_ini=14309-04" … aria-label="Ver en el Senado (abre en nueva pestaña)">…</a></li><li><a href="https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=14891&amp;prmBOLETIN=14309-04" … aria-label="Ver en la Cámara (abre en nueva pestaña)">…
```

⇒ **Cero relleno.** La ausencia es un nodo ausente, no un placeholder, no un "no disponible", no un
link a ninguna parte. `<ul>` con 1 `<li>` vs `<ul>` con 2 `<li>`.

**Cruces de `17870-05`, cero declarado, verbatim** (del `div hidden` resuelto, no del placeholder):

```html
hidden id="S:8"><div class="rounded-lg border-[1.5px] border-accent-product bg-card p-4 space-y-3"><h2 class="flex items-center gap-2 text-lg font-semibold text-accent-product"><span>Cruces con el sector del proyecto</span><span class="ml-auto font-mono text-sm font-normal tabular-nums text-muted-foreground">sin registros</span></h2>…
```

`sin registros` (estado `vacio`) con la sección **presente** — no se oculta, no se rellena, no se
declara falsamente "no ingerido". Mismo contrato que `S1338` en §2.5.

### §3.5 Fila 5.5 (vigilancia) — la rama truncada de lobby sigue sin caso real

`Q-71` re-ejecutada **verbatim** (prefijo de `Q-68` hasta la CTE `bol`):

```
max_total_n | boletines_evaluados
         13 | 82
```

| esperado (122) | observado (125-02) | techo de la RPC | veredicto |
|---|---|---|:---:|
| `max(total_n) = 13` sobre **82** boletines | `13` sobre **82** | `LIMIT 50` | **sin cambio** |

`13` está a **37** del límite ⇒ la rama `mostradas < total_n` (`Se muestran las N … de M`) **sigue
sin caso real en PROD** y por tanto **no es observable**. `grep -o "Se muestran las"` → **0** en las
rutas medidas, coherente. **No se verifica una rama inalcanzable**; se registra que el techo no se
movió. `Q-69` de los sujetos confirma la rama neutra: `14309-04 → 1|1`, `16849-12 → 13|13`,
`17870-05 → 0|0`.

### §3.6 `not-found` de proyecto

`/proyecto/00000-00` → **HTTP 404** ✓. El copy de **E-023** es byte-idéntico al fuente y viaja en el
payload de RSC (mismo HALLAZGO-125-02-01 de §2.6, aquí re-confirmado para la ruta de proyecto):
`Proyecto no encontrado` · *"No encontramos el proyecto solicitado. Es posible que aún no haya sido
ingresado. Puedes buscarlo directamente en las fuentes oficiales:"* + `Senado ↗` + `Cámara ↗` +
`Volver al inicio`. `grep -o "<main" nf_proy.html | wc -l` → **0** (no está en el HTML SSR).

### §3.7 Estado de las filas `discrepancia-declarada` — TODAS SIGUEN DECLARADAS

Las **8** filas que 122 dejó como `discrepancia-declarada`, re-comprobadas sobre el deploy nuevo:

| fila (122) | superficie | qué exige seguir viendo | observado hoy | estado |
|---|---|---|---|:---:|
| **2.1** | `D1165` #votos `Ver detalle (N)` | `1000` (no `3752`) | **1000** | **SIGUE DECLARADA** ✓ |
| **2.5** | `D1165` #votos asistencia | `973 de 1000` (no `3723 de 3752`) | **`Presente en 973 de 1000 … Ausente en 27`** | **SIGUE DECLARADA** ✓ |
| **2.6** | `D1165` #votos capa-1 | Σ `1000` (no Σ `3752`) | **`469 / 466 / 22 / 16 / 27`** (Σ 1000) | **SIGUE DECLARADA** ✓ |
| **3.3** | `/comparar` eje | (fuera de las rutas de este plan) | no medida aquí — **plan 03/04** | fuera de alcance |
| **3.b-9** | `S1338` empty-state de E-053 | **no emitido** (código muerto) | **no emitido** | **SIGUE DECLARADA** ✓ |
| **4-14** | panel de actualidad | (fuera de las rutas de este plan) | no medida aquí — **plan 04** | fuera de alcance |
| **4-15** | panel de actualidad | (fuera de las rutas de este plan) | no medida aquí — **plan 04** | fuera de alcance |
| **5.5** | rama truncada de lobby (`LIMIT 50`) | sin caso real (`max(total_n)` < 50) | **`13` sobre 82** | **SIGUE DECLARADA** ✓ |

**Ninguna de las 5 filas que viven en estas rutas se cerró sola** ⇒ **cero hallazgo de cierre
espontáneo, cero escalada.** Las 3 restantes (3.3, 4-14, 4-15) viven en `/comparar` y en el panel de
actualidad y son territorio de los planes 03/04, que corren en paralelo — este plan **no** las mide y
**no** afirma nada sobre ellas.

---

## §4 Cierre

| criterio del plan | resultado |
|---|---|
| PASO 0 de frescura (uuid + marcador `3,8`) **antes** de medir | ✓ §1.0 — `0ea5d97f…`, `3,8` × 2 |
| Ítem 1 de 122: `S1338` sin dígito **y** sin frase de ausencia en lobby | ✓ **CERRADO** — 0 y 0, alcance declarado |
| Ítem 2 de 122: cobertura tras la leyenda y antes del conteo | ✓ **CERRADO** — orden por offsets en 2 boletines × 2 copias del DOM |
| `D1165` no-regresión `112` | ✓ §1.2 |
| `Q-74` re-ejecutada | ✓ `5106\|195\|82\|3.82`, **sin cambio** ⇒ cifra horneada vigente |
| Canario de 124: `Ver detalle` = `1000` | ✓ §2.4 — con el clamp de `0078` verificado en PROD y el call-site explicado |
| Las 8 filas `discrepancia-declarada` siguen declaradas | ✓ §3.7 — las 5 de estas rutas SIGUEN; 3 fuera de alcance (planes 03/04) |
| `grep "Actualizado hace"` → 0 en las 4 rutas | ✓ (control declarado INERTE) |
| `corte al` → 0 · `captura` pelado → 0 | ✓ §2.5 y §3.3 |
| `17870-05` degradación honesta, copy verbatim | ✓ §3.4 — `www.camara.cl` **0**, `<ul>` de 1 `<li>` vs 2 |
| `Q-71` re-ejecutada, `max(total_n)` vs 13 | ✓ **`13` sobre 82**, sin cambio |
| `/parlamentario/NOEXISTE` y `/proyecto/00000-00` → 404 | ✓ ambos **404** |
| Huérfanos declarados sin fragmento DOM | ✓ §2.6 — E-029, E-053 (empty-state), E-003, E-008 |
| Régimen: 0 DDL/DML · 0 deploy · 0 flags · 0 fixes · 0 PII | ✓ sólo `SELECT`; `SUPABASE_DB_URL` jamás expandida; cero RUT y cero datos de terceros en los fragmentos |

**Desviaciones RULE-1 registradas:** (1) HALLAZGO-125-02-01 — copy de `not-found` sólo en payload RSC
(severidad baja, handoff a catálogo 113); (2) corrección de catálogo 113 §4.1 — `S1338` **sí** ofrece
la entrada `#cruces`; (3) falso negativo propio de medición (`Votada el ` con espacio final) corregido
y declarado en §3.3; (4) observación abierta `85` `Hito del` vs `99` eventos en `14309-04`, declarada
sin cerrar por falta de query que gobierne la cardinalidad del timeline.
