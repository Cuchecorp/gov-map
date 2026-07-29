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
