---
fase: 122
fragmento: 01-relaciones-comparar
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (heredada de 122-CRUCES-SQL-00-METODO §0.0.1; TimeZone de sesión = UTC)"
grupos: [1, 2]
produce_para: [122-05, 122-06]
consume: [122-CRUCES-SQL-00-METODO.md]
---

# 122 — CRUCES × SQL · Fragmento 01: relaciones de ficha + `/comparar`

> Grupos **1** y **2** del universo cerrado de §0.3 del fragmento 00. Recalcula por **SQL verbatim
> read-only contra PROD** cada número que el deploy emite en (a) los 5 bloques de relaciones de
> `/parlamentario/[id]` + los conteos del resumen, y (b) los 4 ejes de `/comparar` + el literal VSIM.
>
> **Régimen heredado del fragmento 00 sin excepción:** cero DDL/DML, cero deploy, cero flags
> tocados, cero fixes de código (los fixes son 122-05), cero PII, cero requests a fuentes
> gubernamentales. `SUPABASE_DB_URL` aparece solo como **nombre de variable**.
>
> **Vocabulario de veredicto** (§0.1 del fragmento 00, LOCKED, 3 valores):
> `cuadra` · `discrepancia-corregida` · `discrepancia-declarada`.
> **Plantilla de fila** (§0.2): 8 columnas; la celda `query verbatim` lleva un identificador `Q-NN`
> que apunta a un bloque ```sql numerado en §6 de este mismo fragmento.

## 0. Cómo se leyó cada lado

**Lado SQL** — prefijo común a TODOS los bloques `Q-NN` de §6 (no se repite en cada bloque):

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
```

**Lado deploy** — SSR del Worker propio, capturado UNA vez por superficie y grepeado sobre el
archivo (para no repetir requests):

```bash
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165          > /tmp/d1165.html
curl -s https://observatorio-congreso.thevalis.workers.dev/parlamentario/S1338          > /tmp/s1338.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=S1338"   > /tmp/cmp_AS.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1117&b=D1177"   > /tmp/cmp_DD.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=D1170"   > /tmp/v_D1165D1170.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1009&b=D1012"   > /tmp/v_D1009D1012.html
curl -s "https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1009&b=S1110"   > /tmp/v_D1009S1110.html
```

> **Gotcha heredado (HALLAZGO B del fragmento 00):** React intercala `<!-- -->` entre el texto y los
> números. Todo grep de este fragmento usa patrones **tolerantes a los separadores**
> (`grep -o -E '.{N}<literal>.{M}'` y lectura de los dígitos), **jamás** el literal armado.
> Un `grep -F "Coinciden en 3655 de 3672"` devuelve 0 matches y se leería, falsamente, como
> "el sitio no emite el número".
>
> **Gotcha heredado (§2.1 del fragmento 00):** la URL de `/comparar` va SIEMPRE entre comillas
> dobles — sin ellas el `&` manda el comando a background.

**Cómo se separó el HTML renderizado del flight payload de RSC.** Cada literal aparece DOS veces en
la respuesta: una en el HTML SSR (`class="…">27 parlamentarios comparten…`) y otra escapada dentro
del payload de React (`\"children\":\"27 parlamentarios comparten…`). El **`nº deploy` registrado en
este fragmento es siempre el del HTML renderizado**; los greps se filtraron con `grep -v '\\"'`
cuando hizo falta. Ambos coincidieron en el 100 % de los casos leídos.

---

## 1. Relaciones entre parlamentarios (5 bloques de ficha)

Superficie `/parlamentario/[id]` (§4.1 de 113, filas A4/A5). Emisor **E-022**
`app/components/cross-links-parlamentario.tsx` (`:105` el `conteoTexto`, `:133` el `Ver los N`,
`:140` el `Mostrando los primeros N de M`). Readers en
`app/app/parlamentario/[id]/page.tsx:198-206` (lector genérico `crossLinkReader` en `:187-196`);
el conteo lo arma `totalReal(filas)` (`page.tsx:365-368`) leyendo la columna **`total_n`** que
0061/0067 proyectan con `count(*) over ()` **antes** del `limit 20`.

### 1.1 Sujeto A — `D1165` (diputado, rico)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 1.1 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:198` | `RPC:copartidarios_de_parlamentario` | `Q-01` / `Q-06` | `27` (`total_n`; filas devueltas `20`) | `27` | cuadra |
| 1.2 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:91` (E-022) · reader `page.tsx:199` | `RPC:de_la_misma_zona` | `Q-02` / `Q-07` | `0` (cero filas ⇒ `total_n` NULL) | `ausente del DOM` (`Q-D1` → `0`) | cuadra |
| 1.3 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:200` | `RPC:co_comisionados_de_parlamentario` | `Q-03` / `Q-08` | `24` (`total_n`; filas `20`) | `24` | cuadra |
| 1.4 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:201` | `RPC:coautores_de_parlamentario` | `Q-04` / `Q-09` | `48` (`total_n`; filas `20`) | `48` | cuadra |
| 1.5 | `/parlamentario/D1165` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:206` | `RPC:militancia_historica_compartida` | `Q-05` / `Q-10` | `2` (`total_n`; filas `2`) | `2` | cuadra |

**Literales del DOM (verbatim, HTML renderizado):**

```
27 parlamentarios comparten el partido de la militancia vigente.
24 parlamentarios comparten al menos una comisión.
48 parlamentarios han co-firmado al menos un proyecto de ley.
En las militancias registradas: 2 parlamentarios militaron en un mismo partido (en períodos posiblemente distintos).
```

**Verificación explícita `total_n` vs `.length` cap-eado (regla LOCKED WR-01/WR-02).** Los tres ejes
cap-eados (`27`, `24`, `48` con `limit 20` en el canal de datos) muestran el **`total_n` honesto**,
NO el `.length`. Además el truncamiento se **declara** (`CrossLinkBloque:140`), nunca es silencioso:

```bash
grep -o -E 'Mostrando los primeros[^\\]{0,40}' /tmp/d1165.html | sort -u
# → Mostrando los primeros <!-- -->8<!-- --> de <!-- -->24<!-- -->
# → Mostrando los primeros <!-- -->8<!-- --> de <!-- -->27<!-- -->
# → Mostrando los primeros <!-- -->8<!-- --> de <!-- -->48<!-- -->
```

**Ningún bloque de la ficha muestra `.length` con `total_n` mayor ⇒ cero `discrepancia-corregida` en
§1.** Los 3 números declarados (27/24/48) coinciden exactamente con las 3 queries de primeros
principios (`Q-06`, `Q-08`, `Q-09`) contra `parlamentario_militancia`, `comision_membresia` y
`proyecto_autor`.

**Bloque "De la misma zona" ausente — es correcto, no un bug** (hallazgo 101-01 re-confirmado hoy):
la Cámara **no** registra distrito en PROD. `Q-11` lo prueba en agregado y sin fabricar zona:

```
diputados|155|0|0     ← 155 diputados, 0 con distrito, 0 con circunscripción
senado|31|0|31        ← 31 senadores, todos con circunscripción
```

`de_la_misma_zona('D1165')` devuelve 0 filas ⇒ `CrossLinkBloque` retorna `null`
(`cross-links-parlamentario.tsx:91`) ⇒ la `<section>` entera se omite. Evidencia de la ausencia:

```bash
grep -c "De la misma zona" /tmp/d1165.html                                   # → 0
grep -c "zona electoral (distrito o circunscripción)" /tmp/d1165.html        # → 0
grep -c 'id="relaciones"' /tmp/d1165.html                                    # → 1  (la sección SÍ existe)
```

### 1.2 Sujeto B — `S1338` (senador)

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 1.6 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:198` | `RPC:copartidarios_de_parlamentario` | `Q-01` / `Q-06` | `9` | `9` | cuadra |
| 1.7 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:199` | `RPC:de_la_misma_zona` | `Q-02` / `Q-07` | `4` | `4` | cuadra |
| 1.8 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:91` (E-022) · reader `page.tsx:200` | `RPC:co_comisionados_de_parlamentario` | `Q-03` / `Q-08` | `0` (cero filas) | `ausente del DOM` (`Q-D2` → `0`) | cuadra |
| 1.9 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:201` | `RPC:coautores_de_parlamentario` | `Q-04` / `Q-09` | `21` (`total_n`; filas `20`) | `21` | cuadra |
| 1.10 | `/parlamentario/S1338` | `app/components/cross-links-parlamentario.tsx:105` (E-022) · reader `page.tsx:206` | `RPC:militancia_historica_compartida` | `Q-05` / `Q-10` | `2` | `2` | cuadra |

**Literales del DOM (verbatim):**

```
9 parlamentarios comparten el partido de la militancia vigente.
4 parlamentarios comparten la zona electoral (distrito o circunscripción).
21 parlamentarios han co-firmado al menos un proyecto de ley.
En las militancias registradas: 2 parlamentarios militaron en un mismo partido (en períodos posiblemente distintos).
Mostrando los primeros <!-- -->8<!-- --> de <!-- -->9<!-- -->.
Mostrando los primeros <!-- -->8<!-- --> de <!-- -->21<!-- -->.
```

Ausencia del bloque de co-comisión (0 filas ⇒ `return null`), probada:

```bash
grep -c "En la misma comisión" /tmp/s1338.html          # → 0
grep -c "comparten al menos una comisión" /tmp/s1338.html # → 0
grep -c 'id="relaciones"' /tmp/s1338.html                # → 1
```

### 1.3 [RULE-1] `S1338` **NO** es el caso de vacío honesto que asumía el plan

El plan 122-02 Task 1 pedía: *"Para S1338 verificar el contrato de vacío honesto: los 5 ejes en
`total_n = 0` ⇒ el deploy debe emitir la ausencia DECLARADA (`RelacionesSection vacio`)"*.
**La realidad de PROD lo contradice y manda la realidad:** `S1338` tiene **4 de 5 ejes con datos**
(9 / 4 / 0 / 21 / 2). El contrato `RelacionesSection vacio`
(`page.tsx:382-395`, dueño `RelacionesConDatos`) **no se dispara** para este sujeto — y no puede
dispararse para ninguno.

Se buscó por SQL, deterministamente, un sujeto con los 5 ejes en 0 (`Q-12`, `order by p.id asc`):

```
(0 filas)
```

**Ningún parlamentario de PROD tiene los 5 ejes en `total_n = 0` hoy.** El contrato de vacío honesto
de la sección de relaciones es, por lo tanto, **no observable en el deploy** con los datos actuales
— se declara como **LÍMITE** en §5, con la query que lo demuestra, en vez de fabricar un sujeto o de
afirmar que el contrato "funciona". Lo que **sí** quedó verificado es el vacío honesto **por bloque**
(`return null` cuando `total_n = 0`): dos casos independientes, `D1165 × de_la_misma_zona` (fila 1.2)
y `S1338 × co_comisionados` (fila 1.8).

---

## 2. Conteos del resumen de la ficha (chips above-the-fold)

Punto único de conteos: `app/lib/parlamentario-resumen-conteos.ts` (`contarCarriles` `:262-442`,
`derivarEstado` `:228-238`). **La lib NO tiene id `E-NNN` propio** (§0.3 del fragmento 00): se cita
por ruta, jamás se le fabrica un id.

### 2.0 [RULE-1] Dónde salen realmente los chips: E-029 **no emite DOM**

El plan asumía que los chips los renderiza **E-029** `app/components/parlamentario-resumen.tsx`
(`ResumenView`, `:73-80` el chip "Presente en N de M", `:84-86` el `<nav aria-label="Secciones de la
ficha">`). **En el código desplegado `ResumenView` no tiene call-site:**

```bash
grep -rn "ResumenView\|ParlamentarioResumen" app --include=*.tsx --include=*.ts \
  | grep -v "\.test\." | grep -v "components/parlamentario-resumen.tsx"
# → (sin resultados)

grep -n "parlamentario-resumen" app/app/parlamentario/\[id\]/page.tsx
# → 10:} from "@/components/parlamentario-resumen";   ← importa SOLO `construirChips` + el tipo `ResumenChip`
```

Y su marca en el DOM está ausente en ambas fichas:

```bash
grep -c 'aria-label="Secciones de la ficha"' /tmp/d1165.html   # → 0
grep -c 'aria-label="Secciones de la ficha"' /tmp/s1338.html   # → 0
```

Los chips que **sí** llegan al DOM los emite el **rail**: `ParlamentarioRail`
(`page.tsx:520-550`) consume `construirChips(conteos)` → `chipToRailEntry` (`page.tsx:108`) →
`FichaRail`. Es **la misma lib de conteos**, expuesta por otra superficie. El caso es el **mismo
patrón de emisor huérfano** de §0.4 del fragmento 00 (E-003/E-008): `ResumenView` existe en el
código y forma parte del denominador, pero **ninguno de sus números llega a producción**, así que no
tiene "nº deploy" contra el que cuadrar. Los emisores realmente auditados en §2 son:

| emisor real | archivo:línea | qué emite |
|-------------|---------------|-----------|
| rail (chips) | `app/app/parlamentario/[id]/page.tsx:520-550` vía `construirChips` (`parlamentario-resumen.tsx:128-161`) | los 4 conteos del rail |
| header de carril | `app/app/parlamentario/[id]/page.tsx:585-703` (`CarrilHeader conteo=`) | el conteo del `<h2>` de cada carril |
| disclosure | `app/components/detalle-colapsable.tsx` (`Ver detalle (N)`) | el mismo conteo del carril |
| asistencia | `app/components/votos-por-parlamentario.tsx:717-728` | `Presente en N de M … · Ausente en K` **o** `Emitió N votos registrados` |
| capa-1 votos | `app/components/capa1/votos-capa1.tsx:74-100` | desglose por sentido + `%` de asistencia |

### 2.1 Tabla de veredicto

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 2.1 | `/parlamentario/D1165` #votos | `page.tsx:586` + `detalle-colapsable` · conteo de `parlamentario-resumen-conteos.ts:279-291` | `RPC:votos_de_parlamentario` (`p_limit: 1000`) vs `voto.parlamentario_id` | `Q-13` / `Q-14` | **`3752`** (real, `estado_vinculo='confirmado'`) | **`1000`** (`Ver detalle (1000)`) | discrepancia-declarada (WR-03) |
| 2.2 | `/parlamentario/D1165` #lobby | `page.tsx:613` · `parlamentario-resumen-conteos.ts:326` | `RPC:lobby_de_parlamentario` → `count(distinct identificador)` vs `lobby_audiencia.identificador` | `Q-16` / `Q-17` | `112` | `112` (`Ver detalle (112)`) | cuadra |
| 2.3 | `/parlamentario/D1165` #patrimonio | `page.tsx` `CarrilHeader` · `parlamentario-resumen-conteos.ts:350` | `RPC:declaraciones_de_parlamentario` vs `declaracion.parlamentario_id` | `Q-18` / `Q-19` | `6` | `6` (`Ver detalle (6)`) | cuadra |
| 2.4 | `/parlamentario/D1165` #cruces | `page.tsx` `CarrilHeader` (chip "Lobby por sector") · `parlamentario-resumen-conteos.ts:387` | `RPC:cruces_de_parlamentario` vs `cruce_senal.parlamentario_id` | `Q-20` / `Q-21` | `11` | `11` | cuadra |
| 2.5 | `/parlamentario/D1165` #votos | `app/components/votos-por-parlamentario.tsx:717-724` | `voto.seleccion <> 'ausente'` sobre confirmados | `Q-15` | `3723` de `3752` | `973` de `1000` | discrepancia-declarada (hereda 2.1) |
| 2.6 | `/parlamentario/D1165` #votos (capa-1) | `app/components/capa1/votos-capa1.tsx:74-100` | `voto.seleccion` (desglose) | `Q-22` | `si 1764 · no 1772 · abstención 171 · pareo 16 · ausente 29` (Σ 3752); asistencia `99,2 %` | `A favor 469 · En contra 466 · Abstención 22 · Pareo 16 · Ausente 27` (Σ 1000); asistencia `97,3 %` | discrepancia-declarada (hereda 2.1) |
| 2.7 | `/parlamentario/S1338` #votos | `page.tsx:586` + `detalle-colapsable` | `RPC:votos_de_parlamentario` (`p_limit: 1000`) vs `voto.parlamentario_id` | `Q-13` / `Q-14` | `949` (bajo el cap) | `949` | cuadra |
| 2.8 | `/parlamentario/S1338` #lobby | `page.tsx:613` · `derivarEstado` (`:228-238`) | `RPC:lobby_de_parlamentario` + `lobby_ingesta_estado` | `Q-16` / `Q-17` / `Q-23` | `0` audiencias **y** `0` filas de marcador ⇒ estado `no_ingerido` | `—` | cuadra |
| 2.9 | `/parlamentario/S1338` #patrimonio | `page.tsx` `CarrilHeader` | `RPC:declaraciones_de_parlamentario` vs `declaracion.parlamentario_id` | `Q-18` / `Q-19` | `9` | `9` | cuadra |
| 2.10 | `/parlamentario/S1338` #cruces | `page.tsx` `CarrilHeader` (chip "Lobby por sector") | `RPC:cruces_de_parlamentario` vs `cruce_senal.parlamentario_id` | `Q-20` / `Q-21` | `0` **con** gate CRUCES ON ⇒ estado `vacio` | `sin registros` | cuadra |
| 2.11 | `/parlamentario/S1338` #votos (asistencia) | `app/components/votos-por-parlamentario.tsx:725-728` | `voto.seleccion <> 'ausente'` | `Q-15` / `Q-22` | `949` presentes de `949`; `0` ausentes | `Emitió 949 votos registrados.` (rama `ausentes = 0`) | cuadra |

### 2.2 WR-03 — el cap `p_limit: 1000` con AMBOS números

Es la discrepancia REAL más grande de este fragmento y se registra completa, con la query y los dos
números, **sin borrar el número erróneo** (§0.1, corolario).

| magnitud | nº SQL (PROD, `Q-13`/`Q-15`/`Q-22`) | nº deploy (`/parlamentario/D1165`) | delta |
|----------|------------------------------------:|-----------------------------------:|------:|
| votos confirmados | **3.752** | **1.000** | −2.752 |
| presentes | **3.723** | 973 | −2.750 |
| ausentes | **29** | 27 | −2 |
| a favor | 1.764 | 469 | −1.295 |
| en contra | 1.772 | 466 | −1.306 |
| abstención | 171 | 22 | −149 |
| pareo | 16 | 16 | 0 |
| asistencia (%) | **99,2 %** | **97,3 %** | −1,9 pp |

**Doble lectura, ejecutada:** la RPC devuelve exactamente `1000` filas para `D1165`
(`select count(*) from votos_de_parlamentario('D1165',1000,0)` → `1000`) mientras la query de
primeros principios devuelve `3752`. Confirmado en el DOM:

```bash
grep -o -E 'Votaciones</h2><span[^>]*>[^<]{0,20}' /tmp/d1165.html
# → Votaciones</h2><span class="text-sm text-muted-foreground">1000
grep -o -E 'Ver detalle \([0-9]+\)' /tmp/d1165.html
# → Ver detalle (1000)  |  Ver detalle (112)  |  Ver detalle (6)
grep -o -E 'Presente en.{0,140}' /tmp/d1165.html | grep -v '\\\\'
# → Presente en<!-- --> <span class="font-mono">973<!-- --> de <!-- -->1000</span> <!-- -->votaciones · Ausente en <span class="font-mono">27</span>.
```

**Hallazgo agravante que el plan no anticipaba:** el cap **no solo trunca el total**, sino que
distorsiona la **composición**. `votos_de_parlamentario` ordena `by vo.fecha desc` — el chip muestra
el desglose de las **1.000 votaciones más recientes** presentado como si fuera el histórico completo
del parlamentario. La `%` de asistencia mostrada (97,3 %) es la de esa ventana, no la real (99,2 %).
La ventana es además **inestable**: cada ingesta nueva cambia los 5 números sin que el total
mostrado (1000) se mueva.

**Clasificación `discrepancia-declarada` (NO `discrepancia-corregida`) — el porqué.** El criterio del
plan es explícito: `discrepancia-corregida` si el fix cabe en 122-05 **sin RPC nueva**;
`discrepancia-declarada` si exige un **RPC de conteo dedicado**. Aquí exige uno:

- El `1000` está **sincronizado byte-a-byte** en 3 superficies (chip del rail, `<h2>` del carril,
  `Ver detalle (N)`) más el desglose de capa-1 y la línea de asistencia, TODAS derivadas de las
  MISMAS filas ya leídas (`parlamentario-resumen-conteos.ts:271-278` lo documenta como decisión
  deliberada). Subir el `p_limit` "arregla" el número pero mueve ~3.752 filas por request a la ficha
  de un diputado — regresión de carga, no un fix.
- Presentar `1000+` exige cambiarlo simultáneamente en chip, header, disclosure, asistencia y capa-1
  para no desincronizarlos: 5 superficies a la vez.
- El fix real es un **RPC de conteo dedicado** (`count(*)` agregado, sin traer filas). Un RPC público
  nuevo es "aguja completa" por régimen del CONTEXT (cero-grant `>0044`, secdef PII-safe con
  `search_path`, `PUBLIC_RPC_ALLOWLIST`, bounded) ⇒ **fuera del alcance de 122-05**.

Queda registrado con ambos números y su query, para que 122-06 lo consolide y el milestone decida
dónde vive el RPC de conteo. **No se corrige en esta fase.**

### 2.3 Denominador de lobby — verificado, honesto en ambos sujetos

Requisito must-have del plan: *"Todo denominador de lobby excluye `estado_vinculo <> 'confirmado'` o
la desviación queda registrada"*.

`lobby_de_parlamentario` (definición leída de PROD) **NO filtra `estado_vinculo`** — selecciona toda
`lobby_audiencia` del parlamentario. El código dedupe por `identificador`
(`parlamentario-resumen-conteos.ts:326`). Se contrastaron las tres lecturas (`Q-16`, `Q-17`):

| sujeto | `count(distinct identificador)` **sin** filtro | `count(distinct identificador)` **con** `estado_vinculo='confirmado'` | vía RPC (lo que ve el sitio) | nº deploy |
|--------|----------------------------------------------:|----------------------------------------------------------------------:|------------------------------:|----------:|
| `D1165` | `112` | `112` | `112` | `112` |
| `S1338` | `0` | `0` | `0` | `—` |

**Los tres números coinciden**: hoy en PROD **no existe ninguna `lobby_audiencia` con
`estado_vinculo <> 'confirmado'` para estos sujetos**, así que el denominador mostrado es
honesto **de facto**. Se deja registrado que la garantía es **por los datos, no por el predicado**:
la RPC no lleva el filtro, de modo que una futura ingesta con audiencias no confirmadas inflaría el
denominador en silencio. Es un **riesgo latente, no una discrepancia observable hoy** — se pasa a
122-04 (Grupo 5, dueño del denominador de lobby) para que decida si el predicado se endurece.

### 2.4 Estados 3-valores verificados por SQL (no asumidos)

`derivarEstado` (`parlamentario-resumen-conteos.ts:228-238`) distingue `dato` / `vacio` /
`no_ingerido`. Los dos estados no-numéricos del deploy se verificaron contra los marcadores
(`Q-23`):

| chip | nº deploy | SQL | veredicto |
|------|-----------|-----|-----------|
| `S1338` · Reuniones de lobby | `—` (`no_ingerido`) | `lobby_audiencia` = 0 filas **y** `lobby_ingesta_estado` = **0** filas ⇒ `ingestado = false` | `cuadra` — "—" es el estado honesto correcto |
| `S1338` · Lobby por sector | `sin registros` (`vacio`) | `cruce_senal` = 0 filas, gate CRUCES **ON** ⇒ `ingestado = true` (cron global) | cuadra |
| `D1165` · Reuniones de lobby | `112` (`dato`) | `lobby_ingesta_estado` = **1** fila | cuadra |
| `S1338` · Declaraciones de patrimonio | `9` (`dato`) | `probidad_ingesta_estado` = **1** fila | cuadra |
| ambos · Financiamiento y contratos | `pendiente` | MONEY **OFF** (§2.2 fragmento 00) ⇒ cero RPC de dinero invocado | `cuadra` — LÍMITE B del fragmento 00 |

---

## 3. `/comparar` — los 4 ejes

Emisor **E-051** `app/app/comparar/page.tsx` (`CompararEjes` `:217-548`). Pares usados:

- **Par 1 (cross-cámara, estados de ausencia):** `A = D1165`, `B = S1338` — los sujetos deterministas
  del fragmento 00.
- **Par 2 (mismo-cámara, con datos):** `A = D1117`, `B = D1177` — **elegido por SQL** con desempate
  estable, query de selección `Q-24`:

```
D1117|D1177|2|20|t     ← n_comisiones=2, n_coproyectos=20, militancia histórica compartida = true
D1082|D1150|1|34|t
D1062|D1177|1|22|t
```

> **[RULE-1] Corrección al plan — el 4º eje NO es "partido vigente".** El plan 122-02 Task 2 pedía
> auditar *"el eje de partido vigente vía `parlamentarios_publico_v2`"*. En el código real
> (`page.tsx:446-492`) el 4º eje es **"Zona electoral"**, y `parlamentarios_publico_v2` es el
> **roster** del que sale `circunscripcion`/`distrito` (`zonaDe`, `:659-668`). No existe eje de
> partido vigente en `/comparar`. Se audita el eje que el deploy emite.
>
> **[RULE-1] Ningún par diputado-diputado puede "tener datos en los 4 ejes".** `Q-11` prueba que los
> **155** diputados de PROD tienen `distrito` **y** `circunscripcion` en NULL. Para cualquier par
> dip-dip el eje de zona sólo puede rendir ausencia declarada. El par 2 se eligió maximizando los
> **3 ejes determinables**, y el 4º queda como caso de ausencia honesta (que es lo correcto, no un
> defecto).

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 3.1 | `/comparar?a=D1165&b=S1338` · Militancia (histórica) | `app/app/comparar/page.tsx:627-638` (E-051) | `RPC:militancia_historica_compartida` | `Q-25` / `Q-10` | columnas `2` / `2`; par **ausente** en ambas direcciones (listas completas: 2<20 y 2<20) | columnas `2` / `2`; `…no registran militancia histórica compartida fuera del partido vigente.` | cuadra |
| 3.2 | `/comparar?a=D1165&b=S1338` · Comisiones | `app/app/comparar/page.tsx:334-391` (E-051) | `RPC:comisiones_de_parlamentario` | `Q-26` / `Q-27` | intersección `camara::nombre` = `0`; listas `2` y `0`, ambas < `CAP_RPC_COMISIONES` (50) ⇒ completas | `En las fuentes consultadas al 2026-07-29, no comparten comisiones.` | cuadra |
| 3.3 | `/comparar?a=D1165&b=S1338` · Co-autoría de proyectos | `app/app/comparar/page.tsx:641-652` + `:406-434` (E-051) | `RPC:coautores_de_parlamentario` | `Q-28` / `Q-29` | columnas `48` / `21`; boletines co-firmados = **`0`** (ausencia REAL) | columnas `48` / `21`; `…están truncadas (más de 20 registros…) y no permiten determinar si comparten proyectos co-firmados.` | discrepancia-declarada (fail-closed CR-01 — ver §3.1) |
| 3.4 | `/comparar?a=D1165&b=S1338` · Zona electoral | `app/app/comparar/page.tsx:454-492` + `:659-668` (E-051) | `RPC:parlamentarios_publico_v2` → `parlamentario.circunscripcion` / `.distrito` | `Q-30` | `D1165` zona NULL; `S1338` `Circunscripción 7` ⇒ no comparten | `Sin zona electoral registrada para …`; `Circunscripción 7`; `…no comparten zona` | cuadra |
| 3.5 | `/comparar?a=D1117&b=D1177` · Militancia (histórica) | `app/app/comparar/page.tsx:264-295` (E-051) | `RPC:militancia_historica_compartida` | `Q-25` / `Q-10` | columnas `2` / `44`; par **presente** (dirección A→B `true`, B→A `false`) | columnas `2` / `44`; `Militaron en un mismo partido (en períodos posiblemente distintos; sin compartir el partido vigente).` | cuadra |
| 3.6 | `/comparar?a=D1117&b=D1177` · Comisiones | `app/app/comparar/page.tsx:372-388` (E-051) | `RPC:comisiones_de_parlamentario` | `Q-26` / `Q-27` | intersección RPC = `2`; primeros principios (`comision_membresia`) = `2`; listas `3` y `3` (< 50 ⇒ completas) | `Comparten 2 comisiones` | cuadra |
| 3.7 | `/comparar?a=D1117&b=D1177` · Co-autoría de proyectos | `app/app/comparar/page.tsx:406-444` (E-051) | `RPC:coautores_de_parlamentario` (`n_proyectos`) | `Q-28` / `Q-29` | columnas `56` / `89`; `n_proyectos` del par = **`20`**; primeros principios (boletines confirmados compartidos) = **`20`** | columnas `56` / `89`; `Comparten 20 proyectos co-firmados.` | cuadra |
| 3.8 | `/comparar?a=D1117&b=D1177` · Zona electoral | `app/app/comparar/page.tsx:454-492` (E-051) | `RPC:parlamentarios_publico_v2` | `Q-30` | ambas zonas NULL ⇒ no comparten (NULL nunca hace match) | `Sin zona electoral registrada para …` ×2; `…no comparten zona` | cuadra |

### 3.1 Los 3 estados verificados (compartido / no compartido / eje ausente)

| estado | evidencia observada | filas |
|--------|---------------------|-------|
| **compartido** | `Comparten 2 comisiones` · `Comparten 20 proyectos co-firmados` · `Militaron en un mismo partido` | 3.5, 3.6, 3.7 |
| **no compartido** (ausencia DECLARADA con fuente y fecha) | `En las fuentes consultadas al 2026-07-29, no comparten comisiones.` · `…no comparten zona` · `…no registran militancia histórica compartida fuera del partido vigente.` | 3.1, 3.2, 3.4, 3.8 |
| **eje ausente / indeterminado** (declara el límite del canal, NO un 0) | `Las listas consultadas al 2026-07-29 están truncadas (más de 20 registros por parlamentario) y no permiten determinar si comparten proyectos co-firmados.` | 3.3 |

**Ningún eje emite un `0` pelado que se lea como "no comparten".** Los 8 ejes leídos usan siempre
una frase con fuente y fecha, o declaran la limitación.

**Disciplina de completitud, verificada.** Las columnas muestran `totalHonesto` = `total_n`
(`page.tsx:594-597`), NO el `.length` cap-eado: fila 3.7 lo prueba en el caso duro — `D1177` tiene
`total_n = 89` con la lista cap-eada en 20 filas, y el DOM emite **`89 co-autores registrados`**.

**El eje de comisiones NO emite `total_n`** (`page.tsx:580-583`): su única señal de completitud es
`length < CAP_RPC_COMISIONES` (50). **Ningún par auditado roza el cap** (`2`, `0`, `3`, `3`), así que
las dos afirmaciones de completitud (filas 3.2 y 3.6) son legítimas y el literal
`Lista posiblemente truncada` está **ausente** de ambos DOM:

```bash
grep -c "Lista posiblemente truncada" /tmp/cmp_AS.html   # → 0
grep -c "Lista posiblemente truncada" /tmp/cmp_DD.html   # → 0
```

⇒ **cero `discrepancia-corregida` por el cap de comisiones.**

**Fila 3.3 — por qué es `discrepancia-declarada` y no `cuadra` ni `discrepancia-corregida`.** El SQL
**determina el hecho**: `D1165` y `S1338` comparten **0** boletines co-firmados confirmados (`Q-29`).
El deploy **no lo afirma**: declara indeterminación porque ambas listas están truncadas (48>20 y
21>20) y `interseccionPar` (`page.tsx:605-618`) es **fail-closed** por diseño CR-01 — con ambas
listas cap-eadas prefiere declarar el límite antes que afirmar una ausencia que podría ser falsa.
Es la disciplina correcta y **no se toca**: el riesgo #1 del proyecto es una ausencia falsa con
atribución de fuente. Se registra igual, con ambos lados, porque la regla anti-"todo bien" exige que
toda divergencia entre SQL y deploy quede escrita. **No se corrige en 122-05.** El fix honesto sería
que la RPC emitiera membresía de par (o `total_n` + un `exists` del par) en vez de una lista
cap-eada — diseño de RPC nuevo, fuera de alcance.

---

## 4. VSIM — "Coinciden en N de M"

Emisor: `app/components/similitud-votacion-comparar.tsx:120` (inventariado en **§4.7 filas C3/C4**
de 113 — **sin id `E-NNN` propio**; jamás fabricar `E-051b`). Origen `RPC:coincidencia_votos_par`
(0068). Gate **VSIM ON** (§2.2 del fragmento 00).

**Los 3 pares son los del precedente 104-03**, nombrados verbatim en su SUMMARY
(`git show 8685e43:.planning/phases/104-…/104-03-SUMMARY.md`, línea 70):

> *"N/M cuadra contra SQL para **3 pares reales** (D1165/D1170=3655/3672; D1009/D1012=932/2495;
> M=0 D1009/S1110 → 'Sin votaciones compartidas suficientes')."*

⇒ no hizo falta elegirlos por SQL. Se re-verificaron los tres hoy contra PROD y contra el deploy.

**Denominador VSIM explícito** (0068, leído verbatim de la migración): sólo votaciones donde **ambos**
emitieron selección **sustantiva** `seleccion in ('si','no','abstencion')` sobre
`estado_vinculo = 'confirmado'`. **`pareo` y `ausente` están EXCLUIDOS** del numerador **y** del
denominador (VSIM-01). Además cada lado deduplica por `votacion_id` con
`having count(distinct seleccion) = 1`: un duplicado concordante colapsa a 1 fila, uno contradictorio
sale de N **y** de M.

| # | superficie (ruta) | emisor (archivo:línea) | origen (RPC o tabla.columna) | query verbatim | nº SQL | nº deploy | veredicto |
|---|-------------------|------------------------|------------------------------|----------------|--------|-----------|-----------|
| 4.1 | `/comparar?a=D1165&b=D1170` | `app/components/similitud-votacion-comparar.tsx:120` (113 §4.7 C3/C4) | `RPC:coincidencia_votos_par` | `Q-31` / `Q-32` | `n_coinciden = 3655`, `m_compartidas = 3672`, cociente real `99,537 %` | `Coinciden en 3655 de 3672 votaciones compartidas (100%).` | cuadra (ver §4.1) |
| 4.2 | `/comparar?a=D1009&b=D1012` | `app/components/similitud-votacion-comparar.tsx:120` (113 §4.7 C3/C4) | `RPC:coincidencia_votos_par` | `Q-31` / `Q-32` | `932` / `2495`, cociente real `37,355 %` | `Coinciden en 932 de 2495 votaciones compartidas (37%).` | cuadra |
| 4.3 | `/comparar?a=D1009&b=S1110` | `app/components/similitud-votacion-comparar.tsx:96-108` (113 §4.7 C3/C4) | `RPC:coincidencia_votos_par` | `Q-31` / `Q-32` | `0` / `0` / `fecha_captura_max` NULL (cross-cámara: cero votaciones compartidas) | `Sin votaciones compartidas suficientes en las fuentes consultadas al 2026-07-29.` — **sin figura, sin `0 %`** | cuadra |

**Literales del DOM, verbatim (HTML renderizado, con los separadores de React):**

```html
<p class="mt-4 text-sm">Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).</p>
<p class="mt-4 text-sm">Coinciden en <!-- --> 932<!-- --> de <!-- -->2495<!-- --> votaciones compartidas (<!-- --> 37<!-- -->%).</p>
Sin votaciones compartidas suficientes en las fuentes consultadas al 2026-07-29.
```

*(En la 2ª línea los espacios antes de `932`/`37` son del formateo de esta tabla, no del DOM; el
literal capturado es `Coinciden en <!-- -->932<!-- --> de <!-- -->2495<!-- --> votaciones compartidas (<!-- -->37<!-- -->%).`)*

**Doble lectura ejecutada en los 3 pares:** la RPC y la query de primeros principios (`Q-32`, escrita
contra `public.voto` reproduciendo el filtro sustantivo, el `estado_vinculo='confirmado'` y el dedupe
`having count(distinct seleccion)=1`) devuelven **exactamente los mismos N y M** en los tres casos.
Cero divergencia RPC ↔ primeros principios.

### 4.1 El lead heredado: `(100%)` sobre `3655/3672` — **adjudicado como `cuadra`**

El fragmento 00 dejó el lead **sin adjudicar** (§2.3, nota final). Se adjudica aquí con ambos números
sobre la mesa:

- **Cociente real:** `3655 / 3672 = 99,537 %` (`Q-32`, columna `round(…,3)`).
- **Número mostrado:** `100 %`.
- **Mecanismo exacto:** `page.tsx:518` — `const pct = m > 0 ? Math.round((n / m) * 100) : null;`
  `Math.round(99.537) = 100`. **No es floor, no es ceil, no es un bug de formato:** es
  `round` a entero, y el server es quien computa el `%` (el componente presentacional nunca lo
  calcula, `similitud-votacion-comparar.tsx:33-42`).
- **Es la cifra FIRMADA, no una desviación.** El dossier legal VSIM fija verbatim
  `X = round(N/M·100)` (§43) y declara la base-rate empírica observada de 19 % a 100 % (§83).
  El precedente **104-03** ya lo adjudicó explícitamente (decisión de frontmatter, línea 41):
  *"VSIM '(100%)' para 3655/3672 es dossier-compliant (X=round firmado §43; base-rate 19-100% §83;
  el caveat base-alta neutraliza la lectura) — NO se cambia round a floor/decimal"*.
- **La lectura deshonesta la neutraliza el caveat obligatorio adyacente**, que precede a la figura y
  no es colapsable. Verificado presente en los 3 pares:

```bash
grep -c "La coincidencia alta es la norma, no una señal" /tmp/v_D1165D1170.html   # → 1
grep -c "La coincidencia alta es la norma, no una señal" /tmp/v_D1009D1012.html   # → 1
grep -c "La coincidencia alta es la norma, no una señal" /tmp/v_D1009S1110.html   # → 1
```

**Veredicto `cuadra`.** Cambiar `round` → `floor`/decimal desviaría de una cifra legalmente firmada
sin ganancia de honestidad (sería Rule 4: decisión legal, no de agente). **No entra a 122-05.**
El cociente real (99,537 %) queda escrito aquí para que ningún auditor futuro tenga que recalcularlo.

### 4.2 Leyenda anti-DW-NOMINATE y provenance

**Leyenda presente en los 3 pares** (grep de arriba: `1` en cada uno) ⇒ **no hay
`discrepancia-declarada` de copy**. Verbatim leído del DOM (`LEYENDA_SIMILITUD_VOTO`,
`similitud-votacion-comparar.tsx:29-30`):

> *La coincidencia alta es la norma, no una señal: la mayoría de las votaciones se aprueban por
> amplia mayoría o unanimidad. Coincidir en muchas no indica afinidad, coordinación ni bancada;
> discrepar en pocas no indica lo contrario.*

**Cobertura y provenance** (pares con `M > 0`):

```
Cobertura del voto: Cámara ~80% confirmado por identificador; Senado ~20% por nombre (probable). …
Fuente: votaciones de Cámara y Senado · según fuente al 2026-07-28.
```

La fecha `2026-07-28` del DOM es exactamente el `fecha_captura_max` que emite la RPC
(`2026-07-28 21:34:00.132+00`, `Q-31`) — **es la fecha de la FUENTE, no una fecha de ingreso**, y el
idiom es el aprobado (`según fuente al …`; "captura" pelado prohibido). `cuadra`.

**Nota de asimetría cross-cámara:** el par 4.3 (`D1009 × S1110`) es cross-cámara y `camaraMixta` sería
`true`, pero cae en la rama `m === 0` (`similitud-votacion-comparar.tsx:96-108`) que **no renderiza la
línea de cobertura**. Comportamiento correcto: sin figura no hay denominador que acotar. Registrado
para que no se lea como leyenda faltante.

### 4.3 Par bonus: `D1117 × D1177` (el par 2 de §3)

No cuenta para el requisito de "exactamente 3 pares" de §4, pero su VSIM se leyó en el mismo `curl`
de §3 y se registra por completitud: SQL `2774 / 2917` (cociente `95,098 %`), deploy
`Coinciden en 2774 de 2917 votaciones compartidas (95%).` — `cuadra`, con `Math.round(95.098) = 95`.

---

## 5. Límites de este fragmento

Declarados con evidencia, no descubiertos a posteriori (patrón "vacío honesto", LÍMITE C del
fragmento 00). **Ningún número de este archivo es estimado, recordado ni redondeado a mano.**

**LÍMITE 1 — el contrato `RelacionesSection vacio` NO es observable en PROD.** El plan pedía
verificarlo con `S1338`; `S1338` tiene 4 de 5 ejes con datos. La búsqueda determinista de un sujeto
con los 5 ejes en `total_n = 0` (`Q-12`) devuelve **0 filas**: ningún parlamentario de PROD lo
cumple hoy. El contrato **no se declara verificado ni se declara roto** — se declara **no
observable**, con la query que lo demuestra. Lo que sí se verificó es el vacío honesto **por bloque**
(`return null` con `total_n = 0`), en dos casos independientes: filas 1.2 y 1.8.

**LÍMITE 2 — el eje de zona no es auditable en pares dip-dip.** `Q-11`: los 155 diputados de PROD
tienen `distrito` y `circunscripcion` en NULL. Para cualquier par diputado-diputado el eje sólo puede
rendir ausencia declarada. No es un defecto del cruce sino una brecha de datos de la fuente Cámara
(hallazgo 101-01, re-confirmado hoy en agregado). El eje se auditó igualmente (filas 3.4 y 3.8).

**LÍMITE 3 — `ResumenView` (E-029) no tiene "nº deploy".** §2.0: sin call-site, sus números no
llegan a ningún DOM (mismo patrón que E-003/E-008 en §0.4 del fragmento 00). Los conteos SÍ se
auditaron, en las superficies que realmente los emiten (rail, header de carril, disclosure,
asistencia, capa-1). **La superficie no se borra del denominador: se declara.**

**LÍMITE 4 — los `nº deploy` son PRE-fix** (LÍMITE A del fragmento 00). El deploy viaja agrupado con
la **Phase 125**; ninguna fila de este fragmento cambiará en producción antes de eso.

**LÍMITE 5 — MONEY/NOTIF fuera de este fragmento.** Ambos gates están **OFF**; el chip
`Financiamiento y contratos` emite `pendiente` (honest-state) en ambos sujetos y ningún RPC de dinero
se invoca. Es LÍMITE B del fragmento 00; el carril MONEY no pertenece a los grupos 1/2.

**Sin más límites: los 32 cruces del alcance (grupos 1 y 2) fueron recalculados.** Cobertura:
§1 = 10 filas · §2 = 11 filas · §3 = 8 filas · §4 = 3 filas ⇒ **32 filas de veredicto**
(`cuadra` = **28** · `discrepancia-declarada` = **4** · `discrepancia-corregida` = **0**).
Las 4 `discrepancia-declarada` son las filas **2.1**, **2.5**, **2.6** (una sola causa raíz: el cap
`p_limit: 1000`) y **3.3** (fail-closed CR-01). Recuento reproducible:

```bash
grep -E '^\| [0-9]+\.[0-9]+ \|' 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md \
  | grep -o -E '\| (cuadra|discrepancia-corregida|discrepancia-declarada)[^|]*\|$' | sort | uniq -c
# → 27 "| cuadra |" + 1 "| cuadra (ver §4.1) |" = 28
# → 1 "(WR-03)" + 2 "(hereda 2.1)" + 1 "(fail-closed CR-01 …)" = 4
```

---

## 6. Queries verbatim

Prefijo común a todos los bloques (§0): `set -a; source .env; set +a` +
`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"`.
Los placeholders `<SUJETO>` / `<A>` / `<B>` se sustituyen por el id literal de la fila.

### 6.1 §1 — relaciones (RPC)

**`Q-01` — copartidarios: filas devueltas + `total_n`**

```sql
select count(*), max(total_n) from public.copartidarios_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 20|27   ·   S1338 → 9|9
```

**`Q-02` — de la misma zona**

```sql
select count(*), max(total_n) from public.de_la_misma_zona('<SUJETO>');
-- observado 2026-07-29: D1165 → 0|NULL   ·   S1338 → 4|4
```

**`Q-03` — co-comisionados**

```sql
select count(*), max(total_n) from public.co_comisionados_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 20|24   ·   S1338 → 0|NULL
```

**`Q-04` — co-autores**

```sql
select count(*), max(total_n) from public.coautores_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 20|48   ·   S1338 → 20|21
```

**`Q-05` — militancia histórica compartida**

```sql
select count(*), max(total_n) from public.militancia_historica_compartida('<SUJETO>');
-- observado 2026-07-29: D1165 → 2|2   ·   S1338 → 2|2
```

### 6.2 §1 — relaciones (primeros principios, contra tablas base)

**`Q-06` — copartidarios = militancia VIGENTE compartida por `partido_alias`**

```sql
select count(distinct p2.id)
from public.parlamentario_militancia m1
join public.parlamentario_militancia m2
  on m2.partido_alias = m1.partido_alias and m2.es_actual
join public.parlamentario p2 on p2.id = m2.parlamentario_id
where m1.parlamentario_id = '<SUJETO>' and m1.es_actual and p2.id <> '<SUJETO>';
-- observado 2026-07-29: D1165 → 27   ·   S1338 → 9      (== total_n de Q-01)
```

**`Q-07` — misma zona = distrito o circunscripción coincidente (NULL nunca matchea)**

```sql
select count(*)
from public.parlamentario p1
join public.parlamentario p2
  on p2.id <> p1.id
 and ( (p1.distrito is not null       and p2.distrito = p1.distrito)
    or (p1.circunscripcion is not null and p2.circunscripcion = p1.circunscripcion) )
where p1.id = '<SUJETO>';
-- observado 2026-07-29: D1165 → 0   ·   S1338 → 4        (== total_n de Q-02)
```

**`Q-08` — co-comisionados = `comision_membresia` compartida**

```sql
select count(distinct cm2.parlamentario_id)
from public.comision_membresia cm1
join public.comision_membresia cm2 on cm2.comision_id = cm1.comision_id
where cm1.parlamentario_id = '<SUJETO>' and cm2.parlamentario_id <> '<SUJETO>';
-- observado 2026-07-29: D1165 → 24   ·   S1338 → 0       (== total_n de Q-03)
```

**`Q-09` — co-autores = `proyecto_autor` con `estado_vinculo='confirmado'` en AMBOS lados**

```sql
select count(distinct a2.parlamentario_id)
from public.proyecto_autor a1
join public.proyecto_autor a2
  on a2.boletin = a1.boletin
 and a2.estado_vinculo = 'confirmado'
 and a2.parlamentario_id is not null
 and a2.parlamentario_id <> '<SUJETO>'
join public.parlamentario p2 on p2.id = a2.parlamentario_id
where a1.parlamentario_id = '<SUJETO>' and a1.estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165 → 48   ·   S1338 → 21      (== total_n de Q-04)
```

**`Q-10` — militancia histórica NET-NEW-ONLY (cruce por `partido_alias`, excluyendo alias vigente compartido)**

```sql
select count(distinct p2.id)
from public.parlamentario_militancia m1
join public.parlamentario_militancia m2
  on m2.partido_alias = m1.partido_alias
 and m2.parlamentario_id <> m1.parlamentario_id
join public.parlamentario p2 on p2.id = m2.parlamentario_id
where m1.parlamentario_id = '<SUJETO>' and p2.id <> '<SUJETO>'
  and not exists (
    select 1
    from public.parlamentario_militancia mv1
    join public.parlamentario_militancia mv2
      on mv2.partido_alias = mv1.partido_alias
     and mv2.parlamentario_id = m2.parlamentario_id
     and mv2.es_actual
    where mv1.parlamentario_id = '<SUJETO>' and mv1.es_actual);
-- observado 2026-07-29: D1165 → 2   ·   S1338 → 2        (== total_n de Q-05)
```

**`Q-11` — cobertura de zona por cámara (agregado, cero PII)**

```sql
select camara, count(*) n, count(distrito) con_distrito, count(circunscripcion) con_circ
from public.parlamentario group by 1 order by 1;
-- observado 2026-07-29:
--   diputados|155|0|0
--   senado|31|0|31
```

**`Q-12` — ¿existe algún sujeto con los 5 ejes en `total_n = 0`? (contrato de vacío honesto)**

```sql
select p.id,
  coalesce((select max(total_n) from public.copartidarios_de_parlamentario(p.id)),0)      c1,
  coalesce((select max(total_n) from public.de_la_misma_zona(p.id)),0)                    c2,
  coalesce((select max(total_n) from public.co_comisionados_de_parlamentario(p.id)),0)    c3,
  coalesce((select max(total_n) from public.coautores_de_parlamentario(p.id)),0)          c4,
  coalesce((select max(total_n) from public.militancia_historica_compartida(p.id)),0)     c5
from public.parlamentario p
where coalesce((select max(total_n) from public.copartidarios_de_parlamentario(p.id)),0)   = 0
  and coalesce((select max(total_n) from public.de_la_misma_zona(p.id)),0)                 = 0
  and coalesce((select max(total_n) from public.co_comisionados_de_parlamentario(p.id)),0) = 0
  and coalesce((select max(total_n) from public.coautores_de_parlamentario(p.id)),0)       = 0
  and coalesce((select max(total_n) from public.militancia_historica_compartida(p.id)),0)  = 0
order by p.id asc            -- desempate estable por PK
limit 3;
-- observado 2026-07-29: (0 filas) → el contrato NO es observable en PROD
```

### 6.3 §2 — conteos del resumen

**`Q-13` — votos: primeros principios (el número REAL)**

```sql
select count(*)
from public.voto v
join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = '<SUJETO>' and v.estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165 → 3752   ·   S1338 → 949
-- (sin el filtro de estado_vinculo el total es idéntico: D1165 → 3752, S1338 → 949)
```

**`Q-14` — votos: la MISMA RPC que lee el sitio, con el mismo `p_limit`**

```sql
select count(*) from public.votos_de_parlamentario('<SUJETO>', 1000, 0);
-- observado 2026-07-29: D1165 → 1000  (CAP alcanzado)   ·   S1338 → 949  (bajo el cap)
```

**`Q-15` — asistencia (presentes = selección distinta de `ausente`)**

```sql
-- (a) primeros principios
select count(*)
from public.voto v join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = '<SUJETO>' and v.estado_vinculo = 'confirmado'
  and v.seleccion <> 'ausente';
-- observado 2026-07-29: D1165 → 3723   ·   S1338 → 949

-- (b) lo que ve el sitio (misma RPC, mismo cap)
select count(*) from public.votos_de_parlamentario('<SUJETO>', 1000, 0) where seleccion <> 'ausente';
-- observado 2026-07-29: D1165 → 973   ·   S1338 → 949
```

**`Q-16` — lobby: denominador honesto por `identificador`, con y sin el predicado**

```sql
select count(distinct identificador) from public.lobby_audiencia where parlamentario_id = '<SUJETO>';
-- observado 2026-07-29: D1165 → 112   ·   S1338 → 0

select count(distinct identificador) from public.lobby_audiencia
where parlamentario_id = '<SUJETO>' and estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165 → 112   ·   S1338 → 0     ⇒ el predicado NO cambia el número hoy
```

**`Q-17` — lobby vía la RPC que lee el sitio (dedupe por `identificador`, espejo del código)**

```sql
select count(distinct identificador) from public.lobby_de_parlamentario('<SUJETO>');
-- observado 2026-07-29: D1165 → 112   ·   S1338 → 0
```

**`Q-18` / `Q-19` — patrimonio: tabla base vs RPC**

```sql
select count(*) from public.declaracion where parlamentario_id = '<SUJETO>';          -- Q-18
-- observado 2026-07-29: D1165 → 6   ·   S1338 → 9
select count(*) from public.declaraciones_de_parlamentario('<SUJETO>');               -- Q-19
-- observado 2026-07-29: D1165 → 6   ·   S1338 → 9
```

**`Q-20` / `Q-21` — cruces: tabla base vs RPC**

```sql
select count(*) from public.cruce_senal where parlamentario_id = '<SUJETO>';          -- Q-20
-- observado 2026-07-29: D1165 → 11   ·   S1338 → 0
select count(*) from public.cruces_de_parlamentario('<SUJETO>');                      -- Q-21
-- observado 2026-07-29: D1165 → 11   ·   S1338 → 0
```

**`Q-22` — desglose REAL por selección (fuente única de "Cómo votó")**

```sql
select v.seleccion, count(*)
from public.voto v join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = '<SUJETO>' and v.estado_vinculo = 'confirmado'
group by 1 order by 1;
-- observado 2026-07-29:
--   D1165 → abstencion|171 · ausente|29 · no|1772 · pareo|16 · si|1764        (Σ 3752)
--   S1338 → abstencion|23  · no|157     · si|769                              (Σ 949)
```

**`Q-23` — marcadores de ingesta (deciden `vacio` vs `no_ingerido`)**

```sql
select count(*) from public.lobby_ingesta_estado    where parlamentario_id = '<SUJETO>';
-- observado 2026-07-29: D1165 → 1   ·   S1338 → 0
select count(*) from public.probidad_ingesta_estado where parlamentario_id = '<SUJETO>';
-- observado 2026-07-29: S1338 → 1
```

### 6.4 §3 — `/comparar`

**`Q-24` — selección determinista del par diputado-diputado (desempate estable por `(a, b)`)**

```sql
with com as (
  select cm1.parlamentario_id a, cm2.parlamentario_id b, count(distinct cm1.comision_id) n
  from public.comision_membresia cm1
  join public.comision_membresia cm2
    on cm2.comision_id = cm1.comision_id and cm2.parlamentario_id > cm1.parlamentario_id
  group by 1, 2),
coa as (
  select a1.parlamentario_id a, a2.parlamentario_id b, count(distinct a1.boletin) n
  from public.proyecto_autor a1
  join public.proyecto_autor a2
    on a2.boletin = a1.boletin and a2.parlamentario_id > a1.parlamentario_id
  where a1.estado_vinculo = 'confirmado' and a2.estado_vinculo = 'confirmado'
  group by 1, 2)
select com.a, com.b, com.n n_comisiones, coa.n n_coproyectos,
       exists(select 1 from public.militancia_historica_compartida(com.a) m where m.id = com.b) mil_hist
from com join coa on coa.a = com.a and coa.b = com.b
join public.parlamentario pa on pa.id = com.a and pa.camara = 'diputados'
join public.parlamentario pb on pb.id = com.b and pb.camara = 'diputados'
where exists(select 1 from public.militancia_historica_compartida(com.a) m where m.id = com.b)
order by com.n desc, coa.n desc, com.a asc, com.b asc
limit 3;
-- observado 2026-07-29:
--   D1117|D1177|2|20|t     ← par elegido
--   D1082|D1150|1|34|t
--   D1062|D1177|1|22|t
```

**`Q-25` — eje 1: columnas de militancia histórica + presencia del par en AMBAS direcciones**

```sql
select coalesce((select max(total_n) from public.militancia_historica_compartida('<A>')),0),
       coalesce((select max(total_n) from public.militancia_historica_compartida('<B>')),0),
       exists(select 1 from public.militancia_historica_compartida('<A>') where id = '<B>'),
       exists(select 1 from public.militancia_historica_compartida('<B>') where id = '<A>');
-- observado 2026-07-29: D1165×S1338 → 2|2|false|false   ·   D1117×D1177 → 2|44|true|false
```

**`Q-26` — eje 2: comisiones vía RPC (intersección por identidad COMPUESTA `camara::nombre`)**

```sql
select (select count(*) from public.comisiones_de_parlamentario('<A>')) len_a,
       (select count(*) from public.comisiones_de_parlamentario('<B>')) len_b,
       (select count(distinct x.nombre)
          from public.comisiones_de_parlamentario('<A>') x
          join public.comisiones_de_parlamentario('<B>') y
            on y.camara = x.camara and y.nombre = x.nombre) compartidas;
-- observado 2026-07-29: D1165×S1338 → 2|0|0   ·   D1117×D1177 → 3|3|2
-- CAP_RPC_COMISIONES = 50 → ninguna lista roza el cap ⇒ completitud afirmable
```

**`Q-27` — eje 2: primeros principios contra `comision_membresia`**

```sql
select count(distinct cm1.comision_id)
from public.comision_membresia cm1
join public.comision_membresia cm2 on cm2.comision_id = cm1.comision_id
where cm1.parlamentario_id = '<A>' and cm2.parlamentario_id = '<B>';
-- observado 2026-07-29: D1165×S1338 → 0   ·   D1117×D1177 → 2   (== Q-26)
```

**`Q-28` — eje 3: columnas (`total_n`) + `n_proyectos` del par en ambas direcciones**

```sql
select coalesce((select max(total_n) from public.coautores_de_parlamentario('<A>')),0),
       coalesce((select max(total_n) from public.coautores_de_parlamentario('<B>')),0),
       coalesce((select n_proyectos from public.coautores_de_parlamentario('<A>') where id = '<B>'),-1),
       coalesce((select n_proyectos from public.coautores_de_parlamentario('<B>') where id = '<A>'),-1);
-- observado 2026-07-29: D1165×S1338 → 48|21|-1|-1  (-1 = el par NO está en la lista cap-eada)
--                       D1117×D1177 → 56|89|20|-1
```

**`Q-29` — eje 3: primeros principios (boletines co-firmados confirmados por AMBOS)**

```sql
select count(distinct a1.boletin)
from public.proyecto_autor a1
join public.proyecto_autor a2 on a2.boletin = a1.boletin
where a1.parlamentario_id = '<A>' and a2.parlamentario_id = '<B>'
  and a1.estado_vinculo = 'confirmado' and a2.estado_vinculo = 'confirmado';
-- observado 2026-07-29: D1165×S1338 → 0   ·   D1117×D1177 → 20   (== n_proyectos de Q-28)
```

**`Q-30` — eje 4: zona desde el MISMO roster que lee el sitio**

```sql
select id, coalesce(circunscripcion,'NULL'), coalesce(distrito,'NULL')
from public.parlamentarios_publico_v2()
where id in ('D1165','S1338','D1117','D1177') order by id;
-- observado 2026-07-29:
--   D1117|NULL|NULL   ·   D1165|NULL|NULL   ·   D1177|NULL|NULL   ·   S1338|7|NULL
```

### 6.5 §4 — VSIM

**`Q-31` — la MISMA RPC que lee el sitio**

```sql
select n_coinciden, m_compartidas, fecha_captura_max
from public.coincidencia_votos_par('<A>', '<B>');
-- observado 2026-07-29:
--   D1165 × D1170 → 3655|3672|2026-07-28 21:34:00.132+00
--   D1009 × D1012 →  932|2495|2026-07-28 21:34:00.132+00
--   D1009 × S1110 →    0|   0|NULL
--   D1117 × D1177 → 2774|2917|2026-07-28 21:34:00.132+00   (par bonus, §4.3)
```

**`Q-32` — primeros principios: denominador VSIM-01 explícito**

Sustantiva = `seleccion in ('si','no','abstencion')` sobre `estado_vinculo='confirmado'`;
**`pareo` y `ausente` EXCLUIDOS** de N y de M; dedupe por `(votacion_id, parlamentario)` con
`having count(distinct seleccion) = 1` (un duplicado contradictorio sale de ambos).

```sql
with a as (
  select v.votacion_id, min(v.seleccion) s
  from public.voto v
  where v.parlamentario_id = '<A>'
    and v.estado_vinculo = 'confirmado'
    and v.seleccion in ('si','no','abstencion')
  group by 1 having count(distinct v.seleccion) = 1),
b as (
  select v.votacion_id, min(v.seleccion) s
  from public.voto v
  where v.parlamentario_id = '<B>'
    and v.estado_vinculo = 'confirmado'
    and v.seleccion in ('si','no','abstencion')
  group by 1 having count(distinct v.seleccion) = 1)
select count(*) filter (where a.s = b.s)                                  as n_coinciden,
       count(*)                                                           as m_compartidas,
       round(100.0 * count(*) filter (where a.s = b.s) / nullif(count(*),0), 3) as pct_real
from a join b using (votacion_id);
-- observado 2026-07-29:
--   D1165 × D1170 → 3655|3672|99.537    (el deploy muestra 100 % = round)
--   D1009 × D1012 →  932|2495|37.355    (el deploy muestra  37 %)
--   D1009 × S1110 → (0 filas del join)  ⇒ N = M = 0, empty-state honesto
--   D1117 × D1177 → 2774|2917|95.098    (el deploy muestra  95 %)
```

### 6.6 Greps de lectura del deploy (`nº deploy`)

**`Q-D1` — ausencia del bloque de zona en `D1165`**

```bash
grep -c "De la misma zona" /tmp/d1165.html                              # → 0
grep -c "zona electoral (distrito o circunscripción)" /tmp/d1165.html   # → 0
```

**`Q-D2` — ausencia del bloque de co-comisión en `S1338`**

```bash
grep -c "En la misma comisión" /tmp/s1338.html            # → 0
grep -c "comparten al menos una comisión" /tmp/s1338.html # → 0
```

**`Q-D3` — conteos de los bloques de relaciones (patrón tolerante a `<!-- -->`)**

```bash
grep -o -E '.{60}comparten el partido de la militancia vigente' /tmp/d1165.html
grep -o -E '.{60}comparten al menos una comisión'               /tmp/d1165.html
grep -o -E '.{60}han co-firmado al menos un proyecto'           /tmp/d1165.html
grep -o -E '.{80}militaron en un mismo partido'                 /tmp/d1165.html
grep -o -E 'Mostrando los primeros[^\\]{0,40}'                  /tmp/d1165.html | sort -u
```

**`Q-D4` — chips y conteos de carril**

```bash
grep -o -E '(Votaciones|Reuniones de lobby|Declaraciones de patrimonio|Lobby por sector|Financiamiento y contratos)</span><span class="ml-auto[^>]*>[^<]{0,20}' /tmp/d1165.html
grep -o -E 'Votaciones</h2><span[^>]*>[^<]{0,20}' /tmp/d1165.html
grep -o -E 'Ver detalle \([0-9]+\)'               /tmp/d1165.html
grep -o -E 'Presente en.{0,140}'                  /tmp/d1165.html | grep -v '\\\\'
grep -o -E 'A favor [0-9]+ · En contra [0-9]+ · [^<]{0,80}' /tmp/d1165.html | tail -1
grep -o -E '[0-9.,]+%?</span><span class="text-xs text-muted-foreground">asistencia' /tmp/d1165.html
```

**`Q-D5` — ejes de `/comparar`**

```bash
grep -o -E '.{60}militaron en un mismo partido que.{0,40}' /tmp/cmp_DD.html | grep -v '\\"'
grep -o -E '.{50}co-autores registrados.{0,10}'            /tmp/cmp_DD.html | grep -v '\\"'
grep -o -E '.{80}proyectos co-firmados.{0,10}'             /tmp/cmp_DD.html | grep -v '\\"'
grep -o -E 'Comparten <!-- -->[0-9]+</span>'               /tmp/cmp_DD.html | sort -u
grep -c  "Lista posiblemente truncada"                     /tmp/cmp_DD.html   # → 0
```

**`Q-D6` — literal VSIM (tolerante a los separadores de React)**

```bash
grep -o -E 'class="mt-4 text-sm">Coinciden en.{0,120}' /tmp/v_D1165D1170.html
grep -o -E 'Sin votaciones compartidas suficientes en las fuentes consultadas al[^<]{0,20}' /tmp/v_D1009S1110.html
grep -c  "La coincidencia alta es la norma, no una señal"  /tmp/v_D1165D1170.html   # → 1
grep -o -E 'Fuente: votaciones de Cámara y Senado.{0,120}' /tmp/v_D1165D1170.html | grep -v '\\"'
```

---

## 7. Resumen para 122-05 y 122-06

**Para 122-05 (fixes) — NADA.** Este fragmento produjo **cero** filas
`discrepancia-corregida`. Las 4 filas divergentes (**2 causas raíz**) son todas
`discrepancia-declarada` y ninguna cabe en 122-05:

| fila | divergencia | por qué NO entra a 122-05 |
|------|-------------|---------------------------|
| 2.1 / 2.5 / 2.6 | cap `p_limit: 1000` — `3752` real vs `1000` mostrado (+ asistencia y desglose derivados) | exige un **RPC de conteo dedicado** (aguja completa: cero-grant `>0044`, secdef PII-safe, `PUBLIC_RPC_ALLOWLIST`, bounded) y el cambio simultáneo de 5 superficies para no desincronizarlas |
| 3.3 | co-autoría `D1165×S1338`: SQL determina `0` compartidos, el deploy declara indeterminación | es la disciplina **fail-closed CR-01** deliberada (una ausencia falsa con atribución de fuente es el riesgo #1 del proyecto); el fix exige rediseñar la RPC para emitir membresía de par |

**Adjudicaciones cerradas en este fragmento:**

- **Lead VSIM `(100%)` sobre `3655/3672`** → **`cuadra`**. `Math.round(99,537) = 100`; cifra
  firmada en el dossier VSIM §43 (`X = round(N/M·100)`) y ya adjudicada por 104-03. No es
  redondeo-que-miente: el caveat base-alta obligatorio y adyacente la neutraliza. **No se toca.**
- **Denominador de lobby** → honesto **de facto** hoy (112 = 112 = 112); la RPC no lleva el
  predicado `estado_vinculo`. Riesgo latente **pasado a 122-04** (dueño del Grupo 5).

**Para 122-06 (consolidación):** §1–§5 completas, 32 filas de veredicto, 32 bloques de query
(`Q-01`…`Q-32`) + 6 greps de deploy (`Q-D1`…`Q-D6`). Ningún `cuadra` queda sin bloque ```sql
asociado (regla dura §0.1).
