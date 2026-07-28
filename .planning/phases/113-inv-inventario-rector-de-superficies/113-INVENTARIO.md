---
phase: 113
titulo: Inventario rector de superficies
deploy_auditado: "observado 2026-07-27 23:04 UTC (Cloudflare no expone id de versión en headers; ver §5)"
gates_observados: { NET: ON, CRUCES: ON, VSIM: ON, MONEY: OFF, NOTIF: OFF }
base_url: https://observatorio-congreso.thevalis.workers.dev
fecha_corrida: 2026-07-27
estado: validado
validacion: "113-VALIDACION-OPUS.md — validador Opus independiente, ronda 1 (2026-07-27): PASS en los 7 criterios; 2 hallazgos no bloqueantes remediados en el Plan 05 Task 3 (§4.8 comando del grep, §4.3.c nota obsoleta). Sin límites pendientes."
consumido_por: [114, 115, 116, 122, 125]
---

# 113 — Inventario rector de superficies

> Artefacto rector del milestone v12.0. Enumera, por ruta pública del sitio: los links
> internos que emite, los links externos clasificados por fuente, y cada fecha visible con
> su columna/RPC de origen (marcando las que provienen de `fecha_captura`).
>
> **Régimen:** esta fase **no corrige** nada. Solo inventaría. Los arreglos son 114 (links
> internos), 115 (patrones externos), 117 (fechas) y 122 (cruces).

## 0. Método y cobertura

### 0.1 Régimen declarado

| Propiedad | Valor |
|-----------|-------|
| Método | **ANÁLISIS DE CÓDIGO** (filesystem + grep sobre este repo) + SQL read-only a PROD para elegir sujetos |
| Verificación contra DOM real | **NO** es de esta fase — es 114 (links internos) y 125 (E2E) |
| ¿Corrige algo? | **No.** El documento **no corrige** nada; declarar la brecha es el entregable. Un fix aquí rompería el "antes/después" de 114/115/117 |
| Requests a fuentes gubernamentales | **cero** (camara.cl / senado.cl / BCN / leylobby no se golpean) ⇒ el rate-limit 2-3 s de CLAUDE.md **no aplica** a esta fase |
| Acceso a PROD Postgres | solo `SELECT` read-only. Cero DDL, cero DML |
| Invocación psql | `set -a; source .env; set +a` y luego `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"` — **jamás se ecoa ni se escribe el valor de `SUPABASE_DB_URL`** |
| PII | **cero**: ni RUT, ni email, ni monto individual. Se registran *nombres de columna*, nunca valores de columnas PII |
| Superficies gated | nunca se presentan como públicas: `/admin/revisar-entidades` figura EXCLUIDA (§4) y todo bloque con gate OFF se marca `no emitido en el deploy auditado` (§5) |
| Conteo por REST | prohibido (PostgREST capa a 1.000 filas) — todo conteo va por `psql -tA` |

### 0.2 Comandos verbatim (método re-ejecutable)

Universo de rutas — el filesystem es la fuente de verdad del App Router; cero rutas asumidas:

```bash
find app/app -name "page.tsx" | sort          # → 15 archivos (universo LOCKED)
find app/app -name "not-found.tsx" | sort     # → 4 archivos (sub-superficies 404)
```

Route handlers — **evidencia por vacío**, no suposición:

```bash
find app/app -name "route.ts" | wc -l         # → 0
```

`0` archivos cierra por vacío la decisión LOCKED del CONTEXT *"route handlers / API no son
superficies"*: **no existe ninguno bajo `app/app`**. Queda registrado como evidencia, no como
supuesto.

Emisores de links (archivos que emiten `<Link>` / `href=`) con su carga:

```bash
for f in $(find app/app app/components -name "*.tsx" -not -name "*.test.tsx" | sort); do
  n=$(grep -c "<Link\|href=" "$f"); [ "$n" -gt 0 ] && echo "$n $f";
done | sort -rn                                # → 50 archivos emiten links
```

Fechas visibles y su formatter:

```bash
grep -rn "Intl.DateTimeFormat\|toLocaleDateString\|toLocaleString\|fechaCorta\|relativeTimeEs\|fechaCortaSegura\|diaCalendario" \
  app/app app/components app/lib --include=*.tsx --include=*.ts | grep -v "\.test\."
# → 28 archivos non-test renderizan o formatean fechas
```

Chokepoint DUAL de `fecha_captura` + link externo (`ProvenanceBadge`):

```bash
grep -rln "ProvenanceBadge" app/app app/components | grep -v "\.test\."   # → 25 archivos
grep -rl "sourceUrl=" app/components app/app                              # → 16 archivos
```

El badge renderiza la fecha de captura (`capturedAt` → `relativeTimeEs` + `esStale`) **y** un
link externo (`<a href={safeExternalHref(sourceUrl)}>`, `provenance-badge.tsx:25,37,62`). Por eso
alimenta la Tabla B *y* la Tabla C de cada ruta.

Origen del dato (RPCs y tablas — vocabulario cerrado del inventario):

```bash
grep -rn "\.rpc(" app/app app/lib app/components --include=*.tsx --include=*.ts | grep -v "\.test\."
# → 44 call-sites .rpc(
grep -rhno "\.from(\"[a-z_]*\"" app/app app/components app/lib --include=*.tsx --include=*.ts \
  | sed 's/.*from("//;s/"//' | sort | uniq -c | sort -rn
# → 18 tablas distintas leídas directo
```

La columna "origen" de cada fecha se llena con `RPC:<nombre>.<campo>` o `tabla.<columna>`; ambos
vocabularios salen de estas dos listas — el inventario **no inventa** nombres de RPC ni de tabla.

### 0.3 Límite declarado del método (crítico para 115)

**Los links externos NO se construyen mayoritariamente en TSX.** Solo **4 constructores** viven en
código (`buildSenadoUrl`, `buildCamaraUrl`, `enlaceHumanoProyecto`, `partidoLegible` — este último
*desactiva* URIs de partido en vez de construir link). El resto de los hrefs externos son **valores
almacenados en columnas de la DB** (`proyecto.enlace`, `url_fuente`, `enlace_fuente`, `link_*`,
`enlace`/`enlace_detalle` de audiencias de lobby) que llegan al DOM pasando por el guard único
`safeExternalHref` (`lib/utils.ts`).

Señal que lo delata: hosts como `leylobby.gob.cl`, `mercadopublico.cl`, `servel.cl`,
`datos.cplt.cl`, `infoprobidad.cl` y `opendata.camara.cl` aparecen **solo en fixtures de test**, no
en los componentes → en runtime vienen de la DB.

**Consecuencia:** enumerar links externos únicamente desde el código produciría un inventario
**incompleto**. Por eso la Tabla B lleva la columna *"builder o columna"*, y el Plan 02 descubre las
columnas de URL por catálogo (`information_schema.columns` con `column_name ~ 'url|enlace|link'`),
no por lista adivinada.

### 0.4 Cobertura método × ruta (Tabla D)

Una fila por cada una de las **15 rutas** del universo LOCKED + una por cada una de las **4
sub-superficies `not-found.tsx`** = **19 filas de datos**. Cero celdas vacías, cero rutas sin
evidencia, cero rutas asumidas.

**Vocabulario CERRADO de las columnas *"links enumerados por"* y *"fechas enumeradas por"*** — solo
estos tres valores son admisibles:

| valor | significado |
|-------|-------------|
| `código (grep del árbol de componentes)` | enumeración **exhaustiva** por análisis estático del árbol de componentes de la ruta (`<Link>`, `href=`, `<a>`, formatters de fecha). Es el método por defecto |
| `código + psql (columnas de URL)` | además del grep, las **familias de host** de los hrefs que vienen de columnas de la DB se enumeraron por `psql` (§3.3). Aplica a toda ruta cuyo Tabla B tenga al menos una fila con *builder o `columna`* = `columna` |
| `n/a — EXCLUIDA` | la ruta **no se inventaría** por decisión LOCKED del CONTEXT (§4.15) |

**Columna *"sujeto usado"***: cita el **id exacto** de §1 (`D1165`, `S1338`, `14309-04`, `17870-05`)
o `—` cuando la ruta no depende de ningún sujeto.
**Columna *"¿exhaustivo o muestra?"***: `exhaustivo (código)` cuando el denominador es el árbol de
componentes completo; `exhaustivo (código) + muestra (sujeto)` cuando además se instanció con
sujetos concretos para ejercitar ramas condicionales; `n/a` para la EXCLUIDA.

| ruta | links enumerados por | fechas enumeradas por | sujeto usado | ¿exhaustivo o muestra? | evidencia |
|------|----------------------|-----------------------|--------------|------------------------|-----------|
| `/parlamentario/[id]` | `código + psql (columnas de URL)` | `código (grep del árbol de componentes)` | `D1165` (diputado) + `S1338` (senador) | `exhaustivo (código) + muestra (sujeto)` | §4.1 (20 filas A, 10 B, 21 C); `app/app/parlamentario/[id]/page.tsx` + E-001/002/005/013/015/019/022/029/030/039/042/053/059 |
| `/proyecto/[boletin]` | `código + psql (columnas de URL)` | `código (grep del árbol de componentes)` | `14309-04` (bicameral) + `17870-05` (solo-Senado) | `exhaustivo (código) + muestra (sujeto)` | §4.2; `app/app/proyecto/[boletin]/page.tsx` + E-010/018/020/026/027/032/035/038/041/043/044/045/048/056/058 |
| `/contraparte/[id]` | `código + psql (columnas de URL)` | `código (grep del árbol de componentes)` | `—` (§1.5: **no elegible**, `contrato` y `aporte` con 0 filas) | `exhaustivo (código)` — **sin muestra**: la ruta 404ea entera (gate MONEY, `page.tsx:50-52`) | §4.3; `app/app/contraparte/[id]/page.tsx` + E-014/016/060; §5 fila MONEY |
| `/` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` | `exhaustivo (código)` | §4.4; `app/app/page.tsx:110,146` + `app/components/panel-actualidad.tsx:100-108,227` |
| `/agenda` | `código + psql (columnas de URL)` | `código (grep del árbol de componentes)` | `—` (la semana viene de `searchParams` o del reloj) | `exhaustivo (código)` | §4.5; `app/app/agenda/page.tsx` + E-007/018/033; hosts de `citacion.enlace` / `sesion_sala.enlace` en §3.3.3 |
| `/buscar` | `código + psql (columnas de URL)` | `código (grep del árbol de componentes)` | `—` (los resultados dependen de `q`) | `exhaustivo (código)` | §4.6; `app/app/buscar/page.tsx:119,160,263,272` + `buscar-filtros.tsx:481-493` + E-028; hosts de `proyecto.enlace` en §3.3.3 |
| `/comparar` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `D1165` + `S1338` | `exhaustivo (código) + muestra (sujeto)` | §4.7; `app/app/comparar/page.tsx:54,187,318-325,502-533` + `similitud-votacion-comparar.tsx:132-135`; §5 fila VSIM |
| `/parlamentarios` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (lista el universo; `D1165`/`S1338` son destinos) | `exhaustivo (código)` | §4.8; `app/app/parlamentarios/page.tsx:47,69-71,117` + E-012/019 |
| `/red` | `código + psql (columnas de URL)` | `código (grep del árbol de componentes)` | `D1165` (con vecindario) + `S1338` (grafo vacío honesto) | `exhaustivo (código) + muestra (sujeto)` | §4.9; `app/app/red/page.tsx:52-54,90-129` + `red/red-graph.tsx:159,194,210,436` + `red/arista-hecho.tsx:15-20`; `arista.enlace` en §3.3.3; §5 fila NET |
| `/metodologia` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` | `exhaustivo (código)` | §4.10; `app/app/metodologia/page.tsx:93,119,129`; `grep` de `rpc(`/`from(` → sin match |
| `/sobre` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` | `exhaustivo (código)` | §4.11; `app/app/sobre/page.tsx:62,70,78,94,107` |
| `/cuenta` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (ruta de sesión, naturaleza **auth OTP**) | `exhaustivo (código)` — **sin muestra**: gate NOTIF OFF, `no emitido en el deploy auditado` | §4.12; `app/app/cuenta/page.tsx:90-96,106-115,210-217,282,310`; §5 fila NOTIF |
| `/notificaciones/baja` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (naturaleza **token-based**; **no se inventó ningún token**) | `exhaustivo (código)` — **sin muestra**: feature inerte con NOTIF OFF | §4.13; `app/app/notificaciones/baja/page.tsx:35-36,71-90,110-116` |
| `/notificaciones/confirmar` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (naturaleza **token-based**; **no se inventó ningún token**) | `exhaustivo (código)` — **sin muestra**: feature inerte con NOTIF OFF | §4.14; `app/app/notificaciones/confirmar/page.tsx:27-28,59-71,88-94`; §5 fila NOTIF (200 sin efecto útil) |
| `/admin/revisar-entidades` | `n/a — EXCLUIDA` | `n/a — EXCLUIDA` | `—` (no aplica: la ruta no se inventaría) | `n/a` | §4.15; decisión LOCKED del CONTEXT §Alcance de rutas; mitigación T-113-04 |
| `app/app/parlamentario/[id]/not-found.tsx` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (404 de la ruta padre) | `exhaustivo (código)` | §4.1.b; E-049 `app/app/parlamentario/[id]/not-found.tsx:17` |
| `app/app/proyecto/[boletin]/not-found.tsx` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (404 de la ruta padre) | `exhaustivo (código)` | §4.2.b; E-023 `app/app/proyecto/[boletin]/not-found.tsx:18,27,37` |
| `app/app/contraparte/[id]/not-found.tsx` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (404 del gate MONEY **y** de id inexistente) | `exhaustivo (código)` — es **lo único que este deploy sirve** en `/contraparte/[id]` | §4.3.b; E-050 `app/app/contraparte/[id]/not-found.tsx:19` |
| `app/app/red/not-found.tsx` | `código (grep del árbol de componentes)` | `código (grep del árbol de componentes)` | `—` (404 del gate NET **y** de semilla inválida) | `exhaustivo (código)` | §4.9.b; E-047 `app/app/red/not-found.tsx:19` |

**Cierre del denominador:** 15 rutas + 4 `not-found.tsx` = **19 filas**, exactamente las que
devuelven `find app/app -name "page.tsx"` (15) y `find app/app -name "not-found.tsx"` (4) en §0.2.
`check-inventario.sh` verifica esa correspondencia en cada corrida (checks 1 y 2).

### 0.4.1 Los tres LÍMITES declarados del método

**LÍMITE 1 — los links externos desde columnas se enumeran por familia de host, no por plantilla.**
El grueso de los hrefs externos **no** se construye en TSX: son **valores almacenados en columnas de
la DB** (§0.3 y §3.3). Por eso la Tabla B lleva la columna *"builder o `columna`"* y las familias se
descubren por catálogo + `psql` (host + `count(*)`), **nunca** por plantilla en el código. El conteo
por host es **a la fecha de la corrida (2026-07-27)** y **puede crecer** con cada ingesta: 115 debe
re-correr las queries de §3.3.2, no confiar en los números congelados aquí. Este documento **no
registra ninguna URL de fila real** (solo host + conteo).

**LÍMITE 2 — la verificación contra el DOM real NO es parte de esta fase.** Todo §4 se derivó por
**análisis de código**. Que un `<Link>` exista en el árbol de componentes **no** prueba que llegue
al DOM del deploy (ver los **emisores huérfanos** de §3.0.1: 13 hrefs que no se renderizan en
ninguna ruta). La comprobación contra DOM es **114** (links internos) y **125** (E2E). Lo único
observado contra el deploy vivo en esta fase es el **estado de los 5 gates** (§5), por `curl` + grep.

**LÍMITE 3 — los bloques con gate OFF se inventarían desde el código y NO están en el deploy
auditado.** `MONEY` y `NOTIF` están **OFF** (§5). Sus bloques figuran igual en §3 y §4 —son parte
del **denominador**— pero llevan la cadena literal **`no emitido en el deploy auditado`**. Afecta a
`/contraparte/[id]` (404 entera), a los carriles de financiamiento/contratos de
`/parlamentario/[id]`, a `/cuenta` y a `/notificaciones/*`. 114/115/125 **no** deben perseguir esos
links; 116 sí debe saber que existe copy de fecha bajo gate que hoy no se ve.

### 0.5 Baseline de suite (pre-fase)

Corrida de no-regresión ejecutada **una vez**, antes de escribir nada, el **2026-07-27** con
`pnpm test` (root = `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`).
Exit code **0**. Conteos exactos observados:

| Workspace | Test files | Tests passed | Skipped |
|-----------|-----------:|-------------:|--------:|
| `app` | 107 | **1428** | 0 |
| `packages/*` (18 paquetes) | 176 | **1535** | 11 |
| **Total** | **283** | **2963** | 11 |

Desglose por paquete (tests passed): core 21, actualidad 7, freshness 44, llm 158, notificaciones
40, ingest 68, llm-bench 131, cruces 42, identity 110, agenda 113, adjudication 89, bio 70, lobby
68, probidad 46, tramitacion 171, dinero 167, votos 31, fichas 159.

> El Plan 05 compara contra **estos números observados**, no contra una cifra recordada. Esta fase
> no toca código, así que cualquier desviación sería regresión ajena a 113.

### 0.6 Checklist automatizable

`check-inventario.sh` (mismo directorio) corre en < 2 s y verifica: (1) las 15 rutas `page.tsx`
están; (2) las 4 `not-found.tsx` están; (3) los 4 builders citados; (4) ≥ 5 bloques de código SQL
(uno por sujeto determinista); (5) la Cobertura declarada. Las waves 2-4 lo corren con `STRICT=0` (reporta sin fallar); el Plan 05
con `STRICT=1` (falla ante cualquier falta).

### 0.7 Verificación de cierre — Plan 05, ronda 1 (2026-07-27)

**Checklist estricto** — `STRICT=1 bash check-inventario.sh` → **exit 0**, los 5 checks en OK:

```
OK check 1 — las 15 rutas page.tsx están en el inventario
OK check 2 — las 4 not-found.tsx están apendizadas
OK check 3 — los 4 builders de URL externa están citados
OK check 4 — 8 bloques sql (>= 5 sujetos deterministas)
OK check 5 — declaración de Cobertura presente
---
RESULTADO: sin faltas (STRICT=1)
```

**Higiene de seguridad y privacidad** (T-113-01, T-113-02, T-113-08):

| # | Verificación | Comando | Resultado |
|---|--------------|---------|-----------|
| H1 | cero credenciales de conexión | `grep -nE 'postgres(ql)?://' 113-INVENTARIO.md` | **sin match** (exit 1) |
| H2 | cero RUT | `grep -nE '[0-9]{7,8}-[0-9kK]' 113-INVENTARIO.md` | **sin match** (exit 1) tras el cierre del hallazgo del §5, abajo |
| H3 | cero celdas de tabla vacías | `grep -nE '^\|.*\|[[:space:]]*\|' 113-INVENTARIO.md` menos separadoras | **sin match** — ver el límite documentado abajo |
| H4 | cero ids `E-NNN` duplicados | `grep -oE '^\| ?\*?\*?E-[0-9]{3}' \| sort \| uniq -d` | **vacío** — 60 definiciones, 60 ids únicos (`E-001`…`E-060`) |
| H5 | cero email de persona natural | `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' \| sort -u` | una sola dirección: `contacto@observatoriocongreso.cl`, el **buzón institucional público** del footer (§2, fila B2) |

**H2 — hallazgo cerrado en esta ronda.** La evidencia del gate MONEY (§5) probaba la ruta con un id
con forma de RUT (`c:` + un RUT de empresa sintético; el valor **no se reproduce aquí**, justamente
porque reproducirlo volvería a disparar la compuerta). Era un valor **sintético** (en PROD `contrato` y `aporte` tienen
0 filas, §1 sujeto E ⇒ no existe contraparte real que nombrar), pero igual matcheaba el patrón de la
compuerta H2. Se sustituyó por `c:sujeto-inexistente`. La evidencia **no pierde poder**: el gate es
la PRIMERA sentencia de `app/app/contraparte/[id]/page.tsx:50-52`, así que cualquier id 404ea —
comprobado el 2026-07-27 corriendo `curl` con **ambos** ids contra el deploy vivo, **404 y 404**.

**H3 — límite documentado (heredado del Plan 04).** El patrón amplio `grep -nE '\|[[:space:]]*\|'`
devuelve **2 matches irreducibles**, ambos **FUERA de toda tabla**, dentro de bloques de código
citados **verbatim**: el `||` de concatenación SQL del Sujeto E (`select 'c:' || c.rut_proveedor …`)
y el `||` lógico del cuerpo de `safeExternalHref` (`proto === "https:" || proto === "http:"`).
Alterarlos rompería la re-ejecutabilidad de la evidencia, que es el bien que protege el régimen de
§0.1. La verificación válida es la **acotada a filas de tabla** (`^\|.*\|[[:space:]]*\|`, menos las
separadoras) → **cero matches**, que es lo que la compuerta realmente busca: celdas vacías.

**No-regresión de la suite** — `pnpm test` → **exit 0**, idéntico al baseline de §0.5:

| Workspace | Test files | Tests passed | Skipped | vs. baseline |
|-----------|-----------:|-------------:|--------:|--------------|
| `app` | 107 | 1428 | 0 | **=** |
| `packages/*` (18) | 176 | 1535 | 11 | **=** |
| **Total** | **283** | **2963** | **11** | **=** |

Cero fallos nuevos, cero desviación de conteo. Consistente con el régimen: la fase **no toca código
de producto** (`git status --porcelain app/ packages/` → vacío).

### 0.8 Veredicto del validador y cierre — ronda 1 + ronda 2 (2026-07-27)

**Ronda 1 — validador Opus independiente** (contexto fresco, read-only, juez separado de quien
escribió el inventario): **PASS en los 7 criterios**, con verificación empírica. Veredicto completo
por criterio en **`113-VALIDACION-OPUS.md`** (mismo directorio). El juez no modificó este documento.

Dos hallazgos **no bloqueantes**, ambos **cerrados en el inventario** (Plan 05, Task 3):

| # | Hallazgo | Dónde | Disposición |
|---|----------|-------|-------------|
| 1 | §4.8 afirmaba que `grep "ProvenanceBadge"` sobre los 3 archivos de `/parlamentarios` daba "sin match", pero `partido-chip.tsx:27` **sí** matchea (es un **comentario**, no un render) | §4.8 | **cerrado en el inventario** — se corrigió el **comando**, no la conclusión: se declara el 1 match-comentario y se añade la verificación que separa mención de uso (`import.*ProvenanceBadge\|<ProvenanceBadge` → sin match) |
| 2 | §4.3.c quedó obsoleta tras el cierre de H2: seguía declarando una "excepción" de un id con forma de RUT en §5 y afirmando que era "el único match del patrón" | §4.3.c | **cerrado en el inventario** — la nota se reescribió al estado actual: no hay excepción, el patrón tiene **0 matches** en todo el archivo |

**Ronda 2 — verificación mecánica post-cierre.** Las dos remediaciones son **documentales y en el
sentido seguro** (precisan un comando y retiran una excepción ya inexistente); no reabren ninguno de
los 7 criterios. Re-corrida completa tras los cierres:

| Compuerta | Resultado |
|-----------|-----------|
| `STRICT=1 bash check-inventario.sh` | **exit 0** — 5/5 OK |
| `grep -cE '[0-9]{7,8}-[0-9kK]'` (RUT) | **0** |
| `grep -cE 'postgres(ql)?://'` | **0** |
| celdas vacías en filas de tabla | **0** |
| ids `E-NNN` duplicados | **0** |
| `git status --porcelain app/ packages/` | **vacío** (la fase no tocó código de producto) |

**Estado final: `validado`** (front-matter). Los 7 criterios en PASS, cero hallazgos abiertos, cero
límites diferidos a otra fase. El inventario queda LOCKED como denominador de 114/115/116/122/125.

## 1. Sujetos deterministas

**Ancla temporal:** `select now()::date` → **`2026-07-27`** (corrida de esta fase).
**Deploy auditado:** ver §5 (observado, no copiado de STATE). Base:
`https://observatorio-congreso.thevalis.workers.dev`.

Todas las queries son re-ejecutables verbatim con
`set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "..."`
(el valor de `SUPABASE_DB_URL` nunca se imprime ni se escribe aquí). Todo `ORDER BY` lleva
**desempate estable** por la PK, para que dos corridas den el mismo sujeto. Los conteos van por
`psql`, nunca por REST (cap 1.000). Criterio de riqueza = **bloques VISIBLES**: MONEY está OFF
(§5), así que contratos y aportes **no cuentan** como riqueza.

### 1.1 Sujeto A — Parlamentario diputado con máxima riqueza de bloques visibles

```sql
with base as (
  select p.id, p.camara,
    (select count(*) from voto v                    where v.parlamentario_id  = p.id) n_votos,
    (select count(*) from lobby_audiencia l         where l.parlamentario_id  = p.id
                                                      and l.estado_vinculo = 'confirmado') n_lobby,
    (select count(*) from declaracion d             where d.parlamentario_id  = p.id) n_patrimonio,
    (select count(*) from cruce_senal c             where c.parlamentario_id  = p.id) n_cruces,
    (select count(*) from comision_membresia cm     where cm.parlamentario_id = p.id) n_comisiones,
    (select count(*) from parlamentario_militancia m where m.parlamentario_id = p.id) n_militancias
  from parlamentario p where p.camara = 'diputados'
)
select id, n_votos, n_lobby, n_patrimonio, n_cruces, n_comisiones, n_militancias,
  (case when n_votos>0 then 1 else 0 end)+(case when n_lobby>0 then 1 else 0 end)
 +(case when n_patrimonio>0 then 1 else 0 end)+(case when n_cruces>0 then 1 else 0 end)
 +(case when n_comisiones>0 then 1 else 0 end)+(case when n_militancias>0 then 1 else 0 end) bloques
from base
order by bloques desc,
         (n_votos+n_lobby+n_patrimonio+n_cruces+n_comisiones+n_militancias) desc,
         id asc                       -- desempate estable por PK
limit 1;
-- D1165|3752|112|6|11|2|2|6      (votos|lobby|patrimonio|cruces|comisiones|militancias|bloques)
```

- **Sujeto:** `D1165` — id en formato **PK string** (el `href` usa este id, nunca un numérico).
- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165`
- **Expectativa declarada:** ficha 360 con los **6** bloques visibles poblados — votos (3.752),
  lobby confirmado (112), patrimonio/declaraciones (6), cruces (11), comisiones (2), militancias
  (2). Financiamiento/contratos/aportes **no emitidos en el deploy auditado** (MONEY OFF, §5).

### 1.2 Sujeto B — Parlamentario senador con máxima riqueza de bloques visibles

```sql
with base as (
  select p.id,
    (select count(*) from voto v                    where v.parlamentario_id  = p.id) n_votos,
    (select count(*) from lobby_audiencia l         where l.parlamentario_id  = p.id
                                                      and l.estado_vinculo = 'confirmado') n_lobby,
    (select count(*) from declaracion d             where d.parlamentario_id  = p.id) n_patrimonio,
    (select count(*) from cruce_senal c             where c.parlamentario_id  = p.id) n_cruces,
    (select count(*) from comision_membresia cm     where cm.parlamentario_id = p.id) n_comisiones,
    (select count(*) from parlamentario_militancia m where m.parlamentario_id = p.id) n_militancias
  from parlamentario p where p.camara = 'senado'
)
select id, n_votos, n_lobby, n_patrimonio, n_cruces, n_comisiones, n_militancias,
  (case when n_votos>0 then 1 else 0 end)+(case when n_lobby>0 then 1 else 0 end)
 +(case when n_patrimonio>0 then 1 else 0 end)+(case when n_cruces>0 then 1 else 0 end)
 +(case when n_comisiones>0 then 1 else 0 end)+(case when n_militancias>0 then 1 else 0 end) bloques
from base
order by bloques desc,
         (n_votos+n_lobby+n_patrimonio+n_cruces+n_comisiones+n_militancias) desc,
         id asc                       -- desempate estable por PK
limit 1;
-- S1338|949|0|9|0|0|1|3
```

- **Sujeto:** `S1338` — **PK bio en formato string**. Ojo gotcha 105-02: existe además
  `parlamentario.parlid_senado = 1338` numérico; el href y la URL usan **`S1338`**, jamás `1338`.
- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/parlamentario/S1338`
- **Expectativa declarada:** ficha con votos (949), patrimonio (9) y militancia (1). **Cero lobby,
  cero cruces, cero comisiones** — y esto NO es un bug de wiring: el mejor senador de PROD tiene
  `n_lobby = 0` y `n_cruces = 0`. Sirve justamente como sujeto de **estados vacíos honestos** para
  114/116/122. (`lobby_audiencia.parlamentario_id` confirmado es hoy exclusivo de diputados.)

### 1.3 Sujeto C — Boletín A: con votaciones + similares + cruces (bicameral)

```sql
select p.boletin,
       (select count(*) from votacion vo          where vo.boletin = p.boletin) n_votaciones,
       (select count(*) from proyecto_embedding e where e.boletin  = p.boletin) n_embedding,
       (select count(*) from cruces_de_proyecto(p.boletin))                     n_cruces,
       (p.prm_id_camara is not null)                                            tiene_camara
from proyecto p
where exists (select 1 from proyecto_ficha f
               where f.boletin = p.boletin and f.sector_id is not null)
  and p.prm_id_camara is not null
  and exists (select 1 from proyecto_embedding e where e.boletin = p.boletin)
order by (select count(*) from cruces_de_proyecto(p.boletin)) desc,
         (select count(*) from votacion vo where vo.boletin = p.boletin) desc,
         p.boletin asc                -- desempate estable por PK
limit 1;
-- 14309-04|7|1|47|t
select boletin, etapa, estado, prm_id_camara,
       split_part(enlace,'/',3) as host, split_part(enlace,'/',4) as path1
  from proyecto where boletin = '14309-04';
-- 14309-04|Comisión Mixta por rechazo de modificaciones (Senado)|En tramitación|14891|tramitacion.senado.cl|wspublico
```

- **Sujeto:** boletín `14309-04` (con sufijo COMPLETO — sin él `buildSenadoUrl` devuelve lista, no
  ficha). `prm_id_camara = 14891` ⇒ ejercita la rama **con** `buildCamaraUrl`.
- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/proyecto/14309-04`
- **Expectativa declarada:** 7 votaciones, 1 embedding (bloque "proyectos similares"), **47 cruces**
  y ambos links de validación de fuente (Senado + Cámara). `proyecto.enlace` apunta a
  `tramitacion.senado.cl/wspublico/...` (XML crudo, roto para humanos) ⇒ **`enlaceHumanoProyecto`
  debe reescribirlo** a `buildSenadoUrl('14309-04')`. El inventario registra el link
  **post-rewrite**, no el crudo.

### 1.4 Sujeto D — Boletín B: zona solo-Senado (sin `prm_id_camara`)

```sql
select p.boletin,
       (select count(*) from votacion vo           where vo.boletin = p.boletin) n_votaciones,
       (select count(*) from proyecto_embedding e  where e.boletin  = p.boletin) n_embedding,
       (select count(*) from tramitacion_evento t  where t.boletin  = p.boletin) n_eventos,
       split_part(p.enlace,'/',3) as host
from proyecto p
where p.prm_id_camara is null
order by (select count(*) from votacion vo where vo.boletin = p.boletin) desc,
         (select count(*) from tramitacion_evento t where t.boletin = p.boletin) desc,
         p.boletin asc                -- desempate estable por PK
limit 1;
-- 17870-05|256|1|355|tramitacion.senado.cl
select count(*) from proyecto where prm_id_camara is null;   -- 1110
select max(fecha)::date from votacion
 where boletin = '17870-05' and fecha <= current_date;       -- 2025-11-26
```

- **Sujeto:** boletín `17870-05`, uno de los **1.110** proyectos sin `prm_id_camara`.
- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/proyecto/17870-05`
- **Expectativa declarada:** ejercita la rama **sin** `buildCamaraUrl` — la validación de fuente
  debe emitir **solo** el link a `tramitacion.senado.cl` y **ningún** link a `www.camara.cl`. 256
  votaciones y 355 eventos de tramitación (timeline denso).
- **Higiene de fechas (Pitfall 8):** el `max(fecha)` va filtrado con `fecha <= current_date` porque
  PROD tiene filas con fechas corruptas en el futuro (p. ej. `2626-05-25`). El resultado
  `2025-11-26` es la última votación **real**.

### 1.5 Sujeto E — Contraparte: **no elegible** (degradación honesta)

```sql
select 'c:' || c.rut_proveedor as contraparte_id, count(*) as n
  from contrato c where c.tipo_persona = 'juridica'
 group by 1
 order by n desc, contraparte_id asc      -- desempate estable por la llave
 limit 1;
-- (0 filas)
select count(*) from contrato;   -- 0
select count(*) from aporte;     -- 0
```

**`contraparte no elegida — causa:` las tablas de hecho que alimentan
`agregado_por_contraparte` (`contrato`, `aporte`) tienen CERO filas en PROD, y además la ruta
`/contraparte/[id]` está **gated MONEY**: `app/app/contraparte/[id]/page.tsx:50-52` hace
`if (!moneyPublicEnabled(process.env)) notFound();` como PRIMERA sentencia ⇒ con MONEY OFF la ruta
**entera** devuelve 404 (§5).**

- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/contraparte/<id>` —
  **`no emitido en el deploy auditado`** (404 por gate MONEY).
- **Consecuencia para las fases consumidoras:** 114/116/122/125 **no** deben perseguir links ni
  fechas de `/contraparte/[id]`. La ruta se inventaría igual desde el código (§4), con su columna
  `gate = MONEY` y la marca `no emitido en el deploy auditado`. No se inventó ningún id de
  contraparte: no existe ninguno real que elegir.

## 2. Chrome compartido

**Alcance LOCKED:** las 4 piezas de esta sección se montan en `app/app/layout.tsx` (o son
invocadas desde las fichas) y por lo tanto aplican a **las 15 rutas** del universo de §4 — incluida
`/admin/revisar-entidades` (EXCLUIDA del inventario público) y `/contraparte/[id]` (que hoy 404ea
por gate MONEY: el 404 igual renderiza el chrome de `layout.tsx`).

**Regla de no-repetición:** §4 **NO** repite estos hrefs ruta por ruta; los referencia por id
(`C-01`..`C-04`). Un href que aparezca en §4 es, por definición, específico de esa ruta.

Números de línea re-verificados por `grep -n` contra el árbol actual (2026-07-27), no copiados del
research.

### C-01 — `app/app/layout.tsx` (footer global)

| # | href | tipo | emisor (archivo:línea) | condicional/gate |
|---|------|------|------------------------|------------------|
| 1 | `https://creativecommons.org/licenses/by/4.0/deed.es` | externo | `app/app/layout.tsx:58` | — (siempre; `target="_blank"` + `rel="noopener noreferrer"`) |
| 2 | `/metodologia` | interno | `app/app/layout.tsx:70-71` | — |
| 3 | `/sobre` | interno | `app/app/layout.tsx:76-77` | — |
| 4 | `mailto:contacto@observatoriocongreso.cl` | mailto | `app/app/layout.tsx:83` | — |

Nota: el link CC BY 4.0 es el ÚNICO link externo del chrome, y es **estático en TSX** — no pasa por
`safeExternalHref` ni por una columna de la DB (contraste con §0.3). El footer declara SCOPE-CAVEAT:
la licencia cubre la compilación propia, no re-afirma términos por-dataset.

### C-02 — `app/components/header-nav.tsx` (nav principal, `"use client"`)

Los 5 ítems se declaran en la constante `NAV_ITEMS` (`header-nav.tsx:36-42`) y se renderizan en un
único `<Link href={item.href}>` (`header-nav.tsx:72-73`).

| # | href | tipo | emisor (archivo:línea) | condicional/gate |
|---|------|------|------------------------|------------------|
| 1 | `/buscar` | interno | `app/components/header-nav.tsx:37` (render `:72-73`) | — |
| 2 | `/parlamentarios` | interno | `app/components/header-nav.tsx:38` (render `:72-73`) | — |
| 3 | `/agenda` | interno | `app/components/header-nav.tsx:39` (render `:72-73`) | — |
| 4 | `/red` | interno | `app/components/header-nav.tsx:40` (render `:72-73`) | **NET** — el ítem se FILTRA del array cuando el gate está OFF (`header-nav.tsx:61-63`, `NAV_ITEMS.filter((item) => item.href !== "/red")`); con NET OFF el nodo está **AUSENTE del DOM**, nunca un link a 404 |
| 5 | `/sobre` | interno | `app/components/header-nav.tsx:41` (render `:72-73`) | — |

Nota de gate (LOCKED): el flag crudo `NET_PUBLIC_ENABLED` **jamás** llega a este islote cliente. Se
lee server-side en `global-header.tsx:30` (`netPublicEnabled(process.env)`) y baja como el boolean
no-sensible `showRed` (`global-header.tsx:43` → `header-nav.tsx:56,59`). En el deploy auditado NET
está **ON** (§5) ⇒ los 5 ítems se emiten.

### C-03 — `app/components/global-header.tsx` (wordmark)

| # | href | tipo | emisor (archivo:línea) | condicional/gate |
|---|------|------|------------------------|------------------|
| 1 | `/` | interno | `app/components/global-header.tsx:35-36` (wordmark `gov-map` + `BrandIcon`) | — |

### C-04 — `app/components/breadcrumbs.tsx` (migaja de ruta)

`Breadcrumbs` es un Server Component presentacional **puro**: no emite hrefs propios; renderiza los
`items` LITERALES que le pasa cada página. Call-sites non-test: `app/app/parlamentario/[id]/page.tsx`,
`app/app/proyecto/[boletin]/page.tsx`, `app/app/contraparte/[id]/page.tsx` (gate MONEY) y
`app/components/parlamentario-header.tsx`.

| # | href | tipo | emisor (archivo:línea) | condicional/gate |
|---|------|------|------------------------|------------------|
| 1 | `{item.href}` (dinámico, provisto por la página llamante) | interno | `app/components/breadcrumbs.tsx:38-39` | — (se emite solo si `item.href` está definido) |

**Nota de comportamiento (no es un href):** el **último ítem va SIN href** — es el segmento actual y
se renderiza como `<span aria-current="page">` (`breadcrumbs.tsx:44-50`), nunca como link. Contrato
documentado en el propio componente (`breadcrumbs.tsx:12-14`). N ítems ⇒ N-1 separadores. Por eso
§4 registra los hrefs de breadcrumb **en la fila de la ruta llamante**, no aquí.

## 3. Catálogo de emisores

**Qué es:** el índice canónico de *quién* emite links y *quién* muestra fechas. §4 (las 15 rutas)
referencia estos ids `E-NNN` en vez de re-derivar la misma semántica 15 veces.

**Regeneración (comandos de §0.2, re-corridos 2026-07-27):**

| comando | resultado observado |
|---------|---------------------|
| loop de conteo `<Link\|href=` sobre `app/app` + `app/components` (non-test) | **50** archivos emiten links |
| `grep -rl` de formatters de fecha sobre `app/app app/components app/lib` (non-test) | **28** archivos formatean/renderizan fechas |
| `grep -rln "ProvenanceBadge" \| grep -v .test.` | **25** archivos |
| `grep -rl "sourceUrl="` (non-test) | **15** archivos (14 call-sites + el propio `provenance-badge.tsx` recibe el prop) |
| `grep -rhno '.from("[a-z_]*"'` | **18** tablas distintas |

Los **50** emisores de links son `E-001`..`E-050` (orden **densidad descendente** del loop, desempate
por el `sort` del propio comando); los **10** emisores que no emiten hrefs propios pero sí muestran
fechas o alimentan el badge son `E-051`..`E-060`. Total **60** ids.

### Vocabulario de la columna *origen*

Cerrado a las dos listas de §0.2. **Ampliación declarada con evidencia** (autorizada por el plan):
el `grep -rn "\.rpc("` expone 7 RPCs de datos que la lista del research no traía porque su nombre
llega por variable o por segundo argumento multilínea. Se añaden con su `archivo:línea` probatorio:

| RPC añadida | evidencia (archivo:línea) |
|-------------|---------------------------|
| `votos_de_parlamentario` | `app/components/votos-por-parlamentario.tsx:992`, `app/lib/parlamentario-resumen-conteos.ts:280` |
| `lobby_de_parlamentario` | `app/components/lobby-de-parlamentario.tsx:718`, `app/lib/parlamentario-resumen-conteos.ts:313` |
| `declaraciones_de_parlamentario` | `app/components/patrimonio-de-parlamentario.tsx:949`, `app/lib/parlamentario-resumen-conteos.ts:338` |
| `bienes_de_parlamentario` | `app/components/patrimonio-de-parlamentario.tsx:963` |
| `comparar_declaraciones` | `app/components/patrimonio-de-parlamentario.tsx:1011` |
| `contratos_de_parlamentario` | `app/components/contratos-de-parlamentario.tsx:326`, `app/lib/parlamentario-resumen-conteos.ts:404` |
| `aportes_de_parlamentario` | `app/components/financiamiento-de-parlamentario.tsx:488`, `app/lib/parlamentario-resumen-conteos.ts:413` |
| `buscar_proyectos_hibrido` | `app/lib/buscar.ts:213` |
| `copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario` | `app/app/parlamentario/[id]/page.tsx:198-200` (vía `crossLinkReader(rpc)`, `:187-190`) |

Cero nombres inventados: **todo** valor de la columna origen sale o de la lista de §0.2 o de esta
tabla de ampliación probada por grep.

### Convenciones de lectura

- `→ ver §3.1` en las columnas *hrefs* y/o *fechas* = el emisor renderiza `<ProvenanceBadge>`; el
  trazado de sus props `capturedAt`/`sourceUrl` hasta su columna de origen lo escribe el **Plan 06**
  en §3.1, para no duplicarlo 25 veces.
- Columna `gate`: lista cerrada de §5.1 (`—` | `NET` | `CRUCES` | `VSIM` | `MONEY` | `NOTIF`).
- `—` = no aplica. **Nunca** una celda vacía.
- `props` = componente presentacional: no consulta la DB; su origen es el del llamante, citado.

### 3.0 Catálogo

| id | componente (archivo) | hrefs que emite | fechas que muestra (formatter → origen) | gate | rutas donde aparece |
|----|----------------------|-----------------|------------------------------------------|------|---------------------|
| E-001 | `app/components/votos-por-parlamentario.tsx` | `/proyecto/{boletin}` (`:483,490`), `buildVotosVerHref(...)` (`:561`), `/parlamentarios` (`:597`), `buildHref(id,{materia})` (`:726,739,819,835`) → ver §3.1 | `fechaCortaSegura(e.fecha)` (`:528`) → `RPC:votos_de_parlamentario.fecha`; `Intl.DateTimeFormat("es-CL")` mes-año (`:287`) → mismo campo → ver §3.1 | — | `/parlamentario/[id]` |
| E-002 | `app/components/lobby-de-parlamentario.tsx` | `/parlamentario/{id}#lobby` (`:255`), `/parlamentario/{id}?vista=cronologica#lobby` (`:262`), `/buscar` (`:352,376`), `buildHref(id,page±1,"cronologica")` (`:552,565`) → ver §3.1 | `fechaCorta(new Date(a.fecha))` (`:153,478`) → `RPC:lobby_de_parlamentario.fecha` → ver §3.1 | — | `/parlamentario/[id]` |
| E-003 | `app/components/voto-ficha-row.tsx` | `/proyecto/{voto.boletin}` (`:119,126,199,206`) → ver §3.1 | `props` → `RPC:votos_de_parlamentario.fecha` / `.fecha_captura` (`:134,218`) → ver §3.1 | — | **ninguna — emisor HUÉRFANO** (cero imports non-test de `VotoFichaRow`; ver §3.0.1) |
| E-004 | `app/app/agenda/page.tsx` | `/agenda` (`:120`), `href(o.value)` filtros (`:180`), `/proyecto/{c.boletin}` (`:268`), `/buscar` (`:414`) | `diaCalendarioCitacion(...)` (`:334,335,438`) → `tabla.citacion.fecha` (date-only medianoche UTC — jamás convertir tz) | — | `/agenda` |
| E-005 | `app/components/patrimonio-de-parlamentario.tsx` | `CC_BY_40_URL` externo (`:215`), `buildVerHref(id,version_id)` (`:502`), `buildHistorialHref(id,page±1)` (`:595,608`) → ver §3.1 | `fechaCortaSegura(version.fecha_presentacion)` (`:418,687,701,728`) → `RPC:declaraciones_de_parlamentario.fecha_presentacion`; comparación vía `RPC:comparar_declaraciones` y detalle vía `RPC:bienes_de_parlamentario`; frescura vía `tabla.probidad_ingesta_estado` (`:989`) → ver §3.1 | — | `/parlamentario/[id]` |
| E-006 | `app/app/layout.tsx` | **ver §2 C-01** (CC BY 4.0, `/metodologia`, `/sobre`, `mailto:`) | `—` (el chrome no muestra fechas) | — | las 15 rutas |
| E-007 | `app/components/week-nav.tsx` | `/agenda?semana={semanaIsoKey(...)}` (`:30,41`) | `—` (deriva la semana ISO de la URL, no de la DB) | — | `/agenda` |
| E-008 | `app/components/actualidad-module.tsx` | `href` de señal (`:207`), `/proyecto/{it.boletin}` (`:216,321`) | `fechaCorta(it.fecha)` (`:202,203,451`), `fechaCorta(it.desde)` (`:318`) → `tabla.votacion.fecha` / `tabla.tramitacion_evento.fecha`; `Intl.DateTimeFormat` día-Chile (`:46,53,95`) | — | **ninguna — emisor HUÉRFANO** (superseded por `panel-actualidad.tsx`, E-055; ver §3.0.1) |
| E-009 | `app/app/sobre/page.tsx` | `/buscar` (`:62`), `/agenda` (`:70`), `/parlamentarios` (`:78`), CC BY 4.0 externo (`:94`), `/` (`:107`) | `—` (copy estático) | — | `/sobre` |
| E-010 | `app/components/timeline-view.tsx` | `buildUrgenciasHref(boletin,p.id,true\|false)` (`:256,273`) | `Intl.DateTimeFormat("es-CL")` mes-año (`:22`) → `tabla.tramitacion_evento.fecha` | — | `/proyecto/[boletin]` |
| E-011 | `app/components/red/red-graph.tsx` | `enlaceSeguro` externo vía `safeExternalHref` (`:194`), `/red?seed={vecinoId}` (`:210`), `/parlamentarios` (`:436`) | `—` | **NET** | `/red` |
| E-012 | `app/components/parlamentario-directory-row.tsx` | `/parlamentario/{p.id}` (`:40`) | `props` → `RPC:parlamentarios_publico_v2` (fecha vía E-019 `partido-chip`) | — | `/parlamentarios` |
| E-013 | `app/components/financiamiento-de-parlamentario.tsx` | `buildHref(id,page±1)` (`:420,433`) → ver §3.1 | `fechaCorta(a.fecha_aporte)` (`:176`), `fechaCorta(a.fecha_corte)` (`:179,355`) → `RPC:aportes_de_parlamentario`; frescura vía `tabla.aportes_ingesta_estado` (`:517`) → ver §3.1 | **MONEY** | `/parlamentario/[id]` — `no emitido en el deploy auditado` |
| E-014 | `app/components/contratos-por-contraparte.tsx` | `buildHref(id,page±1)` (`:238,251`) → ver §3.1 | `fechaCorta(c.fecha_oc)` (`:136`), `fechaCorta(c.fecha_corte)` (`:139`) → `RPC:agregado_por_contraparte` → ver §3.1 | **MONEY** | `/contraparte/[id]` — `no emitido en el deploy auditado` |
| E-015 | `app/components/contratos-de-parlamentario.tsx` | `buildHref(id,page±1)` (`:268,281`) → ver §3.1 | `fechaCorta(c.fecha_oc)` (`:135`), `fechaCorta(c.fecha_corte)` (`:138,225`) → `RPC:contratos_de_parlamentario`; frescura vía `tabla.contratos_ingesta_estado` (`:353`) → ver §3.1 | **MONEY** | `/parlamentario/[id]` — `no emitido en el deploy auditado` |
| E-016 | `app/components/aportes-por-contraparte.tsx` | `buildHref(id,page±1)` (`:290,303`) → ver §3.1 | `fechaCorta(a.fecha_aporte)` (`:149`), `fechaCorta(a.fecha_corte)` (`:152`) → `RPC:agregado_por_contraparte` → ver §3.1 | **MONEY** | `/contraparte/[id]` — `no emitido en el deploy auditado` |
| E-017 | `app/app/buscar/page.tsx` | `/agenda` (`:120`), `/buscar?q=...&page=±1` (`:263,272`) | `—` (las fechas del resultado las pone E-028) | — | `/buscar` |
| E-018 | `app/components/sala-table-section.tsx` | `/proyecto/{item.boletin}` (`:94`), `camaraPdfUrl` externo (`:151`) → ver §3.1 | `props` → `tabla.sesion_sala` / `tabla.sesion_tabla_item` → ver §3.1 | — | `/agenda` |
| E-019 | `app/components/partido-chip.tsx` | `partidoLegible` **desactiva** URIs de partido (no emite href de partido); chip sin link salvo el badge → ver §3.1 | `fechaCorta(...)` (`:65`) → `props` ← `RPC:parlamentarios_publico_v2` / `RPC:parlamentario_publico_v2` (militancia vigente) → ver §3.1 | — | `/parlamentarios`, `/parlamentario/[id]` |
| E-020 | `app/components/lobby-menciones-de-boletin.tsx` | `/parlamentario/{row.parlamentario_id}` (`:138`), `href` externo de la audiencia (`:164`) | `fechaCorta(fecha)` (`:129`) → `RPC:lobby_menciones_de_boletin.fecha` | — | `/proyecto/[boletin]` |
| E-021 | `app/components/header-nav.tsx` | **ver §2 C-02** (`/buscar`, `/parlamentarios`, `/agenda`, `/red`, `/sobre`) | `—` | **NET** (sólo la fila `/red`) | las 15 rutas |
| E-022 | `app/components/cross-links-parlamentario.tsx` | `/parlamentario/{p.id}` (`:112`), `verTodosHref` (`:130`) | `—` | — | `/parlamentario/[id]` |
| E-023 | `app/app/proyecto/[boletin]/not-found.tsx` | `senado.cl/appsenado/...getDetalleProyecto` externo (`:18`), `camara.cl/legislacion/ProyectosDeLey/...` externo (`:27`), `/` (`:37`) | `—` (copy estático) | — | sub-superficie 404 de `/proyecto/[boletin]` |
| E-024 | `app/app/page.tsx` | `/sobre` (`:110`), `card.href` de los bento tiles (`:146`) | `—` (las fechas del panel las pone E-055) | — | `/` |
| E-025 | `app/app/metodologia/page.tsx` | CC BY 4.0 externo (`:93`), `mailto:contacto@observatoriocongreso.cl` (`:119`), `/` (`:129`) | `—` (copy estático) | — | `/metodologia` |
| E-026 | `app/components/voto-row.tsx` | `/parlamentario/{voto.parlamentario_id}` (`:43`) | `props` → `tabla.votacion.fecha` (vía E-056) / `RPC:votos_de_parlamentario` | — | `/proyecto/[boletin]`, `/parlamentario/[id]` (anidado en E-001, E-003, `voto-detalle.tsx`) |
| E-027 | `app/components/validacion-fuente.tsx` | `senadoUrl` = `buildSenadoUrl(boletin)` (`:149`), `camaraUrl` = `buildCamaraUrl(boletin, prm_id_camara)` (`:167`) → ver §3.1 | `toLocaleDateString("es-CL")` (`:226,239`) → `tabla.proyecto` (`boletin`, `prm_id_camara`) y `props` de fecha del llamante → ver §3.1 | — | `/proyecto/[boletin]` (y anidado en E-032, E-035, E-043, E-057) |
| E-028 | `app/components/search-result-card.tsx` | `/proyecto/{boletin}` (`:80`) → ver §3.1 | `props` → `RPC:match_proyectos` / `RPC:buscar_proyectos_hibrido` → ver §3.1 | — | `/buscar`, `/proyecto/[boletin]` (bloque de similares) |
| E-029 | `app/components/parlamentario-resumen.tsx` | anclas internas `#{carril}` vía `ch.href` (`:91`) | `—` (los conteos vienen de `app/lib/parlamentario-resumen-conteos.ts`: `RPC:votos_de_parlamentario`, `lobby_de_parlamentario`, `declaraciones_de_parlamentario`, `cruces_de_parlamentario`, `contratos_de_parlamentario`, `aportes_de_parlamentario`) | — | `/parlamentario/[id]` |
| E-030 | `app/components/mencion-boletin-chip.tsx` | `/proyecto/{boletin}` (`:41`) | `—` | — | `/parlamentario/[id]` (anidado en E-002) |
| E-031 | `app/components/global-header.tsx` | **ver §2 C-03** (`/`) | `—` | — | las 15 rutas |
| E-032 | `app/components/estado-actual-block.tsx` | `/agenda?semana={semanaIso}` (`:477,492`) | `fechaCorta(...)` (`:397,413,429,445,460,475,497`), `relativeTimeEs(...)` (`:417`), `diaCalendarioCitacion(...)` (`:189,221,237,270`) → `tabla.tramitacion_evento.fecha`, `tabla.citacion.fecha`, `tabla.citacion_punto` (`:541`), `tabla.sesion_tabla_item` (`:551`). **`:429` = `urgenciaFuente.fechaCaptura`** ⇒ fecha de *scraping*, jamás el hecho | — | `/proyecto/[boletin]`, `/` |
| E-033 | `app/components/citacion-card.tsx` | `/proyecto/{boletin}` (`:130`) → ver §3.1 | `props` → `tabla.citacion.fecha` → ver §3.1 | — | `/agenda` |
| E-034 | `app/components/breadcrumbs.tsx` | **ver §2 C-04** (hrefs dinámicos; último ítem sin href) | `—` | — | `/parlamentario/[id]`, `/proyecto/[boletin]`, `/contraparte/[id]` |
| E-035 | `app/components/autor-row.tsx` | `/parlamentario/{autor.parlamentario_id}` (`:44`), `enlaceHumanoProyecto(autor.enlace, autor.boletin)` externo (`:64`) → ver §3.1 | `props` (`:57`) → `tabla.proyecto_autor` + `tabla.proyecto.enlace` → ver §3.1 | — | `/proyecto/[boletin]` |
| E-036 | `app/app/parlamentario/[id]/page.tsx` | `/comparar?a={id}` (`:305`), `/red?seed={id}` (`:328`) | `—` (las fechas las ponen los bloques hijos) | **NET** (sólo la fila `/red?seed=`) | `/parlamentario/[id]` |
| E-037 | `app/components/ui/button.tsx` | primitiva `asChild`: no emite href propio, lo hereda del hijo `<Link>`/`<a>` | `—` | — | transversal (primitiva de UI) |
| E-038 | `app/components/timeline-event.tsx` | `evento.enlace` externo (`:42`) → ver §3.1 | `fechaCorta(fecha)` (`:32`) → `tabla.tramitacion_evento.fecha` → ver §3.1 | — | `/proyecto/[boletin]` (anidado en E-010) |
| E-039 | `app/components/seguir-button.tsx` | `/cuenta?next={encodeURIComponent(next)}` (`:73`) | `—` (lee `tabla.suscripcion` en `:50` sin renderizar fecha) | **NOTIF** | `/parlamentario/[id]`, `/proyecto/[boletin]` — `no emitido en el deploy auditado` |
| E-040 | `app/components/provenance-badge.tsx` | `safeUrl` = `safeExternalHref(sourceUrl)` (`:62`) — **chokepoint DUAL, ver §3.1** | `relativeTimeEs(capturedAt)` + `esStale` (`:52`) → **`fecha_captura` de la tabla/RPC de cada call-site — ver §3.1** | — | transversal (25 archivos lo renderizan) |
| E-041 | `app/components/lobby-en-tramitacion.tsx` | `href` externo de la audiencia (`:150`) | `fechaCorta(fecha)` (`:144`) → `RPC:lobby_en_tramitacion.fecha` | — | `/proyecto/[boletin]` |
| E-042 | `app/components/ficha-rail.tsx` | anclas internas `#{e.id}` (`:59`) | `—` | — | `/parlamentario/[id]`, `/proyecto/[boletin]` |
| E-043 | `app/components/ficha-header.tsx` | `buildCamaraUrl(proyecto.boletin, proyecto.prm_id_camara)` externo (`:82`) → ver §3.1 | `props` (`:66`) → `tabla.proyecto` → ver §3.1 | — | `/proyecto/[boletin]` |
| E-044 | `app/components/cruces-de-proyecto.tsx` | `/parlamentario/{row.parlamentario_id}` (`:130`) → ver §3.1 | `fechaCortaSegura(item.fecha)` (`:168`) → `RPC:cruces_de_proyecto.fecha`; `capturedAt = row.fecha_captura` (`:177`) → ver §3.1 | **CRUCES** | `/proyecto/[boletin]` |
| E-045 | `app/components/capa1/tramitacion-stepper.tsx` | `href` del paso (`:133`) | `fechaCorta(d)` (`:99`), `fechaCorta(estado.urgenciaVigente.desde)` (`:194`) → `tabla.tramitacion_evento.fecha` | — | `/proyecto/[boletin]` |
| E-046 | `app/components/bento/bento-tile.tsx` | `href` recibido por prop del llamante (E-024, E-008, E-055) | `—` | — | `/` |
| E-047 | `app/app/red/not-found.tsx` | `/` (`:19`) | `—` (copy estático) | **NET** | sub-superficie 404 de `/red` |
| E-048 | `app/app/proyecto/[boletin]/page.tsx` | ancla `#idea-matriz` (`:568`) → ver §3.1 | `capturedAt = masReciente.fecha_captura` (`:490`, con `sourceUrl={null}`) → `tabla.source_snapshot` (`:649`); datos de `tabla.proyecto_ficha` (`:364`), `tabla.proyecto_autor` (`:589`) → ver §3.1 | — | `/proyecto/[boletin]` |
| E-049 | `app/app/parlamentario/[id]/not-found.tsx` | `/` (`:17`) | `—` (copy estático) | — | sub-superficie 404 de `/parlamentario/[id]` |
| E-050 | `app/app/contraparte/[id]/not-found.tsx` | `/` (`:19`) | `—` (copy estático) | **MONEY** | sub-superficie 404 de `/contraparte/[id]` — `no emitido en el deploy auditado` |
| E-051 | `app/app/comparar/page.tsx` | `—` (0 hrefs propios) | `Intl.DateTimeFormat("en-CA")` (`:55`) → `RPC:coincidencia_votos_par` (`fecha_captura_max` del par); ejes vía `RPC:militancia_historica_compartida`, `RPC:comisiones_de_parlamentario`, `RPC:coautores_de_parlamentario`, `RPC:parlamentarios_publico_v2` | **VSIM** (sólo el eje de similitud de votación) | `/comparar` |
| E-052 | `app/app/cuenta/page.tsx` | `—` (0 hrefs propios) | `fechaCorta` local `Intl.DateTimeFormat("en-CA")` (`:90-91`) usado en `:282` y `:310` → `tabla.consentimiento.created_at` (`:215`) y `tabla.suscripcion.created_at` (`:210`) | **NOTIF** | `/cuenta` — `no emitido en el deploy auditado` |
| E-053 | `app/components/cruces-de-parlamentario.tsx` | `—` (0 hrefs propios) → ver §3.1 | `fechaCorta(item.fecha)` (`:178`) → `RPC:cruces_de_parlamentario.fecha`; `capturedAt = s.fecha_captura` (`:195`) → ver §3.1 | **CRUCES** | `/parlamentario/[id]` |
| E-054 | `app/components/militancias-de-parlamentario.tsx` | `—` (0 hrefs propios; `partidoLegible` desactiva las URIs de partido) | `fechaCorta(desde)` / `fechaCorta(hasta)` (`:26,27`) → `RPC:militancias_de_parlamentario.desde` / `.hasta` (sin `hasta` ⇒ el copy dice "vigente", nunca una fecha inventada) | — | `/parlamentario/[id]` |
| E-055 | `app/components/panel-actualidad.tsx` | `—` (delega el href a E-046) | `diaCalendarioCitacion(iso)` para `agenda_*` (`:104`) y `fechaCorta(d)` para el resto (`:107`) → `RPC:actualidad_senales_panel` (contrato documentado en `:96-97`) | — | `/` |
| E-056 | `app/components/votacion-card.tsx` | `—` (delega los links a E-027) → ver §3.1 | `fechaCorta(fecha)` (`:39`) → `tabla.votacion.fecha`; `capturedAt` (`:96`) → `tabla.votacion.fecha_captura` → ver §3.1 | — | `/proyecto/[boletin]` |
| E-057 | `app/components/comisiones-de-parlamentario.tsx` | `—` (0 hrefs propios) → ver §3.1 | `RPC:comisiones_de_parlamentario` → ver §3.1 | — | `/parlamentario/[id]` (anidado en E-059) |
| E-058 | `app/components/idea-matriz-block.tsx` | `—` (0 hrefs propios) → ver §3.1 | `tabla.proyecto_ficha` (leída por E-048) → ver §3.1 | — | `/proyecto/[boletin]` |
| E-059 | `app/components/parlamentario-header.tsx` | `—` (delega a E-034 y E-019) → ver §3.1 | `capturedAt` (`:116`) y `sourceUrl={parlamentario.enlace}` (`:118`) → `RPC:parlamentario_publico_v2` → ver §3.1 | — | `/parlamentario/[id]` |
| E-060 | `app/app/contraparte/[id]/page.tsx` | `—` (0 hrefs propios; delega a E-034, E-014, E-016) → ver §3.1 | `RPC:agregado_por_contraparte` (`:` llamada única con `{ p_id: id }`); **su match de `ProvenanceBadge` es sólo un COMENTARIO** (`:19`), no un render — el badge real lo ponen E-014/E-016 → ver §3.1 | **MONEY** | `/contraparte/[id]` — `no emitido en el deploy auditado` (404 entero, `page.tsx:50-52`) |

### 3.0.1 Emisores huérfanos (hallazgo)

`E-003` (`voto-ficha-row.tsx`, 8 hrefs) y `E-008` (`actualidad-module.tsx`, 5 hrefs) aparecen en el
loop de conteo pero **ningún archivo non-test los importa**:

```bash
grep -rn "VotoFichaRow\|ActualidadModule" app --include=*.tsx --include=*.ts | grep -v "\.test\."
# → sólo definiciones propias, tipos en app/lib/types.ts y menciones en comentarios; cero call-sites
```

Consecuencia para las fases consumidoras: **114/125 no deben perseguir esos 13 hrefs en el DOM** —
no se renderizan en ninguna de las 15 rutas. Se inventarían igual porque existen en el código y son
parte del denominador (misma regla que un bloque gated OFF). `panel-actualidad.tsx` (E-055) es el
near-clone vivo que reemplazó a `actualidad-module.tsx` en `/`.

### 3.1 Chokepoints (`ProvenanceBadge`: `capturedAt` + `sourceUrl`)

`app/components/provenance-badge.tsx` es un chokepoint **DUAL**. No es decoración: es a la vez el
único punto por donde pasa la fecha de captura y el **mayor emisor de links externos del sitio**.

#### 3.1.1 Cara A — fecha (`capturedAt`)

| propiedad | valor |
|-----------|-------|
| prop | `capturedAt: Date \| null` (`provenance-badge.tsx:21`) |
| formatter | `relativeTimeEs(capturedAt)` (`:52`) + `esStale(capturedAt)` (`:33`, umbral **14 días** → amber) — corregido en Phase 117 (F-11): el valor real es `STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000` en `app/lib/format.ts:10`, elegido por la cadence de ingesta semanal. El inventario decía 48 h por propagación del JSDoc erróneo del badge; el comportamiento nunca cambió. |
| `null` | renderiza **"Sin fecha de actualización"** (`:54`) y `sourceName` se degrada a `"fuente desconocida"` (`:34`) — el badge **nunca** se omite (UI-SPEC §6.3) |
| tooltip | `capturedAt.toISOString()` (`:86`) — el instante crudo de *scraping* |

> **REGLA LOCKED:** toda fecha que llega a la UI vía `capturedAt` se **MARCA como `fecha_captura`**
> sin más análisis — es el reloj del scraping, jamás el hecho (gotcha Phase 98). Toda **otra** fecha
> renderizada exige rastreo explícito hasta su columna/RPC en §4. Consecuencia para 116: las fechas
> del badge NO son candidatas a "fecha del hecho" en ninguna ruta.

#### 3.1.2 Cara B — link externo (`sourceUrl`)

| propiedad | valor |
|-----------|-------|
| prop | `sourceUrl: string \| null` (`provenance-badge.tsx:25`) |
| guard | `const safeUrl = safeExternalHref(sourceUrl)` (`:37`) |
| render | `<a href={safeUrl} target="_blank" rel="noopener noreferrer">` (`:61-69`) con el texto literal **`fuente oficial ↗`** (`:68`) y `aria-label` `Fuente oficial: {displaySource} (abre en nueva pestaña)` (`:66`) |
| degradación | si `safeExternalHref` devuelve `null`, el `<a>` **no se emite** (`:58` `{safeUrl !== null && ...}`) — el badge queda "sin enlace", nunca un href roto ni un `javascript:` inyectado |
| tooltip | `{safeUrl}` (`:87`) — el href post-guard, no el valor crudo |

> **REGLA LOCKED:** el badge es el **mayor emisor de links externos del sitio** (15 call-sites
> non-test, ver tabla). 115 debe tratarlo como **superficie de primera clase**, no como decoración:
> validar el patrón de link externo del badge cubre más hrefs externos que los 4 builders juntos.

#### 3.1.3 `safeExternalHref` — guard único de href externo (chokepoint de LINK-03)

```ts
// app/lib/utils.ts:15-23
export function safeExternalHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const proto = new URL(url).protocol;
    return proto === "https:" || proto === "http:" ? url : null;
  } catch {
    return null;
  }
}
```

Semántica: **allowlist de esquema** (`http:` / `https:` únicamente); cualquier otra cosa
(`javascript:`, `data:`, string vacío, URL no parseable) → `null` ⇒ **no se emite `<a>`**.
Es **fail-closed** y no reescribe la URL: la devuelve verbatim o nada. Todo href externo del sitio
—badge, builders de §3.2, hrefs desde columna de §3.3— pasa por aquí. **Chokepoint de LINK-03.**

#### 3.1.4 Tabla de call-sites de `sourceUrl`

Universo (re-corrido 2026-07-27): `grep -rl "sourceUrl=" app/components app/app | wc -l` → **16**
archivos (15 de producción + 1 de test). El propio `provenance-badge.tsx` **no** aparece en este
grep porque *declara* el prop, no lo *pasa*; se contabiliza aparte como E-040.

Convención: `origen` cita el vocabulario cerrado de §0.2 + la tabla de ampliación de §3
(`RPC:<nombre>.<campo>` ← `tabla.<columna>`). Los hosts de la columna *fuente* salen de §3.3 —
esta tabla **no** registra ningún valor de URL de fila real (T-113-10).

| # | archivo:línea | expresión del prop (verbatim) | columna/RPC de origen | fuente | gate |
|---|---------------|-------------------------------|-----------------------|--------|------|
| 1 | `app/app/proyecto/[boletin]/page.tsx:492` | `sourceUrl={null}` | — (literal `null`; el badge sólo lleva `capturedAt` ← `tabla.source_snapshot.fecha_captura`) | ninguna — **badge sin link** por diseño | — |
| 2 | `app/components/aportes-por-contraparte.tsx:199` | `sourceUrl={a.enlace}` | `RPC:agregado_por_contraparte` (rama aportes) ← `tabla.aporte.enlace` | otro (Servel) — **0 filas en PROD** (§3.3) | **MONEY** — `no emitido en el deploy auditado` |
| 3 | `app/components/autor-row.tsx:64` | `sourceUrl={enlaceHumanoProyecto(autor.enlace \|\| "", autor.boletin) \|\| null}` | `tabla.proyecto_autor.enlace` + `.boletin`, **post-rewrite** por `enlaceHumanoProyecto` (§3.2) | senado (`tramitacion.senado.cl`) | — |
| 4 | `app/components/contratos-de-parlamentario.tsx:195` | `sourceUrl={c.enlace}` | `RPC:contratos_de_parlamentario` ← `tabla.contrato.enlace` | otro (Mercado Público) — **0 filas en PROD** (§3.3) | **MONEY** — `no emitido en el deploy auditado` |
| 5 | `app/components/contratos-por-contraparte.tsx:178` | `sourceUrl={c.enlace}` | `RPC:agregado_por_contraparte` (rama contratos) ← `tabla.contrato.enlace` | otro (Mercado Público) — **0 filas en PROD** (§3.3) | **MONEY** — `no emitido en el deploy auditado` |
| 6 | `app/components/cruces-de-parlamentario.tsx:197` | `sourceUrl={item.enlace_fuente}` | `RPC:cruces_de_parlamentario` → `cruce_senal.evidencia` jsonb, clave `enlace_fuente` ← `tabla.lobby_audiencia.enlace` (`0039_cruce_senal.sql:107`, `0052_...sql:99`) / `tabla.contrato.enlace` (`0052_...sql:154`) | camara (`www.camara.cl`) + leylobby | **CRUCES** |
| 7 | `app/components/cruces-de-proyecto.tsx:179` | `sourceUrl={item.enlace_fuente}` | `RPC:cruces_de_proyecto` → misma `evidencia.enlace_fuente` que la fila 6 | camara (`www.camara.cl`) + leylobby | **CRUCES** |
| 8 | `app/components/ficha-header.tsx:70-73` | `sourceUrl={` `enlaceHumanoProyecto(proyecto.enlace \|\| "", proyecto.boletin) \|\|` `null` `}` | `tabla.proyecto.enlace` + `.boletin`, **post-rewrite** por `enlaceHumanoProyecto` (§3.2) | senado (`tramitacion.senado.cl`) | — |
| 9 | `app/components/financiamiento-de-parlamentario.tsx:234` | `sourceUrl={a.enlace}` | `RPC:aportes_de_parlamentario` ← `tabla.aporte.enlace` | otro (Servel) — **0 filas en PROD** (§3.3) | **MONEY** — `no emitido en el deploy auditado` |
| 10 | `app/components/lobby-de-parlamentario.tsx:537` | `sourceUrl={a.enlace}` — donde `a.enlace` se arma en `:601` como `enlace: f.enlace ?? f.enlace_detalle` | `RPC:lobby_de_parlamentario` ← `tabla.lobby_audiencia.enlace` con **fallback** a `tabla.lobby_audiencia.enlace_detalle` | camara (`www.camara.cl`) + **leylobby** (`www.leylobby.gob.cl`) | — |
| 11 | `app/components/parlamentario-header.tsx:118` | `sourceUrl={parlamentario.enlace ?? null}` | `RPC:parlamentario_publico_v2.enlace` ← `tabla.parlamentario.enlace` | camara (`opendata.camara.cl`) + senado (`tramitacion.senado.cl`) | — |
| 12 | `app/components/patrimonio-de-parlamentario.tsx:446` | `sourceUrl={version.enlace}` | `RPC:declaraciones_de_parlamentario` ← `tabla.declaracion.enlace` | otro (CPLT, `datos.cplt.cl`) | — |
| 13 | `app/components/patrimonio-de-parlamentario.tsx:769` | `sourceUrl={c.enlace}` (una por columna comparada, `columnas.map`) | `RPC:comparar_declaraciones` ← `tabla.declaracion.enlace` | otro (CPLT, `datos.cplt.cl`) | — |
| 14 | `app/components/votacion-card.tsx:101-104` | `sourceUrl={` `enlaceHumanoProyecto(votacion.enlace \|\| "", votacion.boletin) \|\|` `null` `}` | `tabla.votacion.enlace` + `.boletin`, **post-rewrite** por `enlaceHumanoProyecto` (§3.2) | camara (`opendata.camara.cl`) + senado (`tramitacion.senado.cl`) | — |
| 15 | `app/components/voto-ficha-row.tsx:136` y `:220` | `sourceUrl={voto.enlace ?? null}` (dos veces, mismo prop) | `RPC:votos_de_parlamentario.enlace` ← `tabla.votacion.enlace` | camara + senado | — (**emisor HUÉRFANO**, E-003/§3.0.1: no se renderiza en ninguna ruta) |
| 16 | `app/components/votos-por-parlamentario.tsx:547` | `sourceUrl={e.enlace ?? null}` | `RPC:votos_de_parlamentario.enlace` ← `tabla.votacion.enlace` | camara (`opendata.camara.cl`) + senado (`tramitacion.senado.cl`) | — |
| 17 | `app/components/provenance-badge.test.tsx:15,35,46,60` | literales de test (`"https://www.camara.cl/fuente"`, `"https://www.senado.cl/fuente"`, `null`, `"javascript:alert(1)"`) | — (fixture; **no** es superficie) | — | — |

**Conteo:** 17 filas ≥ 16 archivos del grep (la fila 17 es el archivo de test, listado para que el
denominador cierre; las filas 1-16 son los 15 archivos de producción, con `voto-ficha-row.tsx`
agrupando sus dos ocurrencias en una fila). Cero orígenes `indeterminado`: los 16 se rastrearon
estáticamente hasta columna o literal.

**Reconciliación con §3.0** (corrección de esta corrida): la fila del cuadro de regeneración de §3
decía *"15 archivos"* usando el denominador **non-test**. El grep del plan (`app/components app/app`,
sin filtro) devuelve **16**. Ambos números son correctos con su denominador: **16 archivos totales =
15 de producción + 1 de test**; `provenance-badge.tsx` (E-040) queda fuera de ambos porque declara
el prop en vez de pasarlo.

**Nota de gate:** 4 de los 15 call-sites de producción (filas 2, 4, 5, 9) están bajo **MONEY OFF** ⇒
`no emitido en el deploy auditado`. Y sus columnas de respaldo (`aporte.enlace`, `contrato.enlace`)
tienen **0 filas** en PROD (§3.3): aunque MONEY se encendiera, el badge no emitiría link. 115/125 no
deben perseguirlos.

### 3.2 Constructores de URL externa

Los **4** constructores de §0.3, con plantilla **verbatim** del código. Ninguno emite `<a>` por sí
mismo: el `<a>` lo pone el llamante, siempre detrás de `safeExternalHref` (§3.1.3).

| # | builder (archivo:línea) | plantilla verbatim | precondición | llamantes |
|---|-------------------------|--------------------|--------------|-----------|
| 1 | `buildSenadoUrl` (`app/components/validacion-fuente.tsx:60-62`) | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${encodeURIComponent(boletin)}` | **boletín COMPLETO con sufijo** — sin sufijo el Senado devuelve *lista*, no ficha (`:57-58`) | `validacion-fuente.tsx:117` (E-027); `enlaceHumanoProyecto:94` |
| 2 | `buildCamaraUrl` (`app/components/validacion-fuente.tsx:67-69`) | `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=${encodeURIComponent(prmId)}&prmBOLETIN=${encodeURIComponent(boletin)}` | **SOLO si `prm_id_camara != null`** (fail-honest, `:65`); `validacion-fuente.tsx:118-119` lo condiciona con `prm_id_camara !== null` | `validacion-fuente.tsx:119` (E-027); `ficha-header.tsx:82` (E-043) |
| 3 | `enlaceHumanoProyecto` (`app/components/validacion-fuente.tsx:87-100`) | **rewrite por host+path**: si `new URL(enlace)` parsea **y** `url.hostname.toLowerCase() === "tramitacion.senado.cl"` **y** `url.pathname.toLowerCase().includes("/wspublico/")` → devuelve `buildSenadoUrl(boletin)`; en **cualquier** otro caso (host distinto, path sin `/wspublico/`, parseo fallido) → devuelve `enlace` **VERBATIM** | detección por **host+path SIEMPRE**, nunca por substring suelto (`:82-84`): un boletín o el literal `wspublico` en el query de otro host no debe gatillar el rewrite | `autor-row.tsx:64` (E-035), `ficha-header.tsx:71` (E-043), `votacion-card.tsx:102` (E-056) |
| 4 | `partidoLegible` (`app/lib/format.ts:153-174`) | **NO construye link.** Si el valor matchea `/^https?:\/\/datos\.bcn\.cl\/.*\/partido-politico\//i` extrae el slug con `/\/partido-politico\/(.+?)\/?$/i` y lo devuelve en Title Case; si el URI es reconocible pero el slug queda vacío → `null`, **nunca** passthrough del URI crudo. Cualquier otro valor pasa **verbatim** como nombre legible | invariante **"CERO URI en el DOM"**: *desactiva* los URIs `datos.bcn.cl/.../partido-politico/{slug}`. Scheme+host case-**INSENSITIVE** (RFC 3986) — sin la flag `i` un host en mayúsculas filtraría el URI al DOM | `partido-chip.tsx` (E-019), `militancias-de-parlamentario.tsx` (E-054) |

**Registro del link post-rewrite (LOCKED):** para `enlaceHumanoProyecto` el inventario y las fases
consumidoras registran **el link resultante**, no el `proyecto.enlace` crudo. En el Sujeto C
(`14309-04`, §1.3) el crudo es `tramitacion.senado.cl/wspublico/...` (XML, roto para humanos) y el
link efectivo es `buildSenadoUrl('14309-04')`.

**Fuera de estos 4:** todo el resto de los hrefs externos son **valores almacenados en columnas** —
inventariados en §3.3.

### 3.3 Familias de URL almacenadas en columnas

Cierra el hallazgo rector de §0.3: la mayoría de los hrefs externos **no** se construyen en TSX —
son valores de columnas de la DB. El universo de columnas se **descubre por catálogo**, nunca por
lista adivinada: el patrón de nombres `url_fuente|enlace_fuente|link_*` del research **omitía**
`enlace`/`enlace_detalle` de `lobby_audiencia`, que es justamente donde vive **leylobby**.

**Restricciones de seguridad aplicadas (T-113-05 / T-113-06):** todas las queries devuelven
únicamente `split_part(<col>,'/',3)` (el **host**) y `count(*)`. **Cero** `select <col>` completo,
cero URLs fila a fila, cero credenciales; `SUPABASE_DB_URL` nunca se ecoa ni se escribe. Tampoco se
listan keys de `r2_path`: sólo el prefijo `tramitacion/` está allowlistado por `esR2PathPermitido`
(`validacion-fuente.tsx:46-52`), y los dominios PII (`infoprobidad/`, `servel/`, `money/`, `rut/`)
quedan fuera por completo. Ancla temporal: `select now()::date` → **2026-07-27**.

#### 3.3.1 Paso 1 — descubrimiento por catálogo

Query del plan, **verbatim**, con su resultado inline:

```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and data_type like '%char%'
  and column_name ~ 'url|enlace|link'
order by table_name, column_name;
-- (0 filas)
```

**Hallazgo (corrección de la query, Rule 1):** el filtro `data_type like '%char%'` devuelve **cero
filas** porque en Postgres las columnas `text` reportan `data_type = 'text'`, no
`'character varying'` — y **todas** las columnas de URL de este esquema son `text`. Usar esa query
tal cual habría producido un §3.3 vacío y un falso "no hay URLs en columnas". Query corregida
(predicado de tipo ampliado; el resto idéntico) con su resultado inline:

```sql
select table_name, column_name, data_type from information_schema.columns
where table_schema='public'
  and data_type in ('text','character varying','character')
  and column_name ~ 'url|enlace|link'
order by table_name, column_name;
-- actualidad_senal|enlace|text
-- aporte|enlace|text
-- arista|enlace|text
-- citacion|enlace|text
-- comision|enlace|text
-- comision_membresia|enlace|text
-- contratista|enlace|text
-- contrato|enlace|text
-- cruce_senal|enlace|text
-- declaracion|enlace|text
-- declaracion_accion_derecho|enlace|text
-- declaracion_actividad|enlace|text
-- declaracion_bien_inmueble|enlace|text
-- declaracion_bien_mueble|enlace|text
-- declaracion_familiar|enlace|text
-- declaracion_pasivo|enlace|text
-- declaracion_valor|enlace|text
-- donante|enlace|text
-- entidad_tercero|enlace|text
-- lobby_audiencia|enlace|text
-- lobby_audiencia|enlace_detalle|text
-- lobby_contraparte|enlace|text
-- parlamentario|enlace|text
-- parlamentario_bio|enlace|text
-- parlamentario_militancia|enlace|text
-- pii_contraparte_declaracion|enlace|text
-- proyecto|enlace|text
-- proyecto_autor|enlace|text
-- sesion_sala|enlace|text
-- source_snapshot|source_url|text
-- tramitacion_evento|enlace|text
-- vinculo_entidad|enlace|text
-- vinculo_identidad|enlace|text
-- votacion|enlace|text
-- (34 filas)
```

**34 columnas** en **33 tablas** (`lobby_audiencia` aporta dos). Nótese que **ninguna** se llama
`url_fuente`, `enlace_fuente` ni `link_*`: el patrón de nombres del research habría descubierto
**cero**. `enlace_fuente` existe sólo como **clave dentro del jsonb** `cruce_senal.evidencia`
(§3.1.4 filas 6-7), no como columna.

#### 3.3.2 Paso 2 — familias por host

Por cada columna descubierta, con `<tabla>`/`<col>` sustituidos:

```sql
select split_part(<col>,'/',3) as host, count(*)
  from <tabla> where <col> is not null
 group by 1 order by 2 desc, 1 asc;
```

Resultados inline (34 corridas, 2026-07-27):

```text
actualidad_senal.enlace              (0 filas)
aporte.enlace                        (0 filas)
arista.enlace                        www.camara.cl|7394
citacion.enlace                      www.camara.cl|164 ; web-back.senado.cl|125
comision.enlace                      www.camara.cl|34
comision_membresia.enlace            www.camara.cl|386
contratista.enlace                   (0 filas)
contrato.enlace                      (0 filas)
cruce_senal.enlace                   www.camara.cl|781
declaracion.enlace                   datos.cplt.cl|1065
declaracion_accion_derecho.enlace    datos.cplt.cl|935
declaracion_actividad.enlace         datos.cplt.cl|690
declaracion_bien_inmueble.enlace     datos.cplt.cl|2841
declaracion_bien_mueble.enlace       datos.cplt.cl|1476
declaracion_familiar.enlace          (0 filas)
declaracion_pasivo.enlace            datos.cplt.cl|1820
declaracion_valor.enlace             datos.cplt.cl|614
donante.enlace                       (0 filas)
entidad_tercero.enlace               (0 filas)
lobby_audiencia.enlace               www.camara.cl|17730 ; www.leylobby.gob.cl|32
lobby_audiencia.enlace_detalle       www.leylobby.gob.cl|32
lobby_contraparte.enlace             www.camara.cl|17681
parlamentario.enlace                 opendata.camara.cl|155 ; tramitacion.senado.cl|31
parlamentario_bio.enlace             (0 filas)
parlamentario_militancia.enlace      opendata.camara.cl|315 ; datos.bcn.cl|48
pii_contraparte_declaracion.enlace   (0 filas)
proyecto.enlace                      tramitacion.senado.cl|3658 ; opendata.camara.cl|1
proyecto_autor.enlace                tramitacion.senado.cl|19983
sesion_sala.enlace                   web-back.senado.cl|16 ; www.camara.cl|2
source_snapshot.source_url           tramitacion.senado.cl|4380 ; datos.cplt.cl|3
tramitacion_evento.enlace            www.senado.cl|5790 ; opendata.camara.cl|3797 ; tramitacion.senado.cl|982
vinculo_entidad.enlace               (0 filas)
vinculo_identidad.enlace             (0 filas)
votacion.enlace                      opendata.camara.cl|3806 ; tramitacion.senado.cl|1049
```

**8 hosts distintos** en total. `pii_contraparte_declaracion.enlace` se consultó con el mismo
`split_part`+`count(*)` (host y conteo, jamás valores) y devolvió **0 filas** — no se expuso nada.

#### 3.3.3 Tabla de familias

Sólo las columnas con `n > 0`. Las 10 columnas con 0 filas se listan en §3.3.5.

| tabla.columna | host | n | fuente | emisor que la renderiza |
|---------------|------|--:|--------|--------------------------|
| `arista.enlace` | `www.camara.cl` | 7394 | camara | E-011 `red/red-graph.tsx:194` (`safeExternalHref`) — gate **NET** |
| `citacion.enlace` | `www.camara.cl` | 164 | camara | E-033 `citacion-card.tsx` / E-004 `/agenda` |
| `citacion.enlace` | `web-back.senado.cl` | 125 | senado | E-033 `citacion-card.tsx` / E-004 `/agenda` |
| `comision.enlace` | `www.camara.cl` | 34 | camara | E-057 `comisiones-de-parlamentario.tsx` (vía `RPC:comisiones_de_parlamentario`) |
| `comision_membresia.enlace` | `www.camara.cl` | 386 | camara | E-057 `comisiones-de-parlamentario.tsx` |
| `cruce_senal.enlace` | `www.camara.cl` | 781 | camara | columna **no renderizada directo**; lo que llega al DOM es `evidencia->enlace_fuente` → §3.1.4 filas 6-7 (E-044/E-053, gate **CRUCES**) |
| `declaracion.enlace` | `datos.cplt.cl` | 1065 | otro (CPLT) | §3.1.4 filas 12-13 (E-005 `patrimonio-de-parlamentario.tsx:446,769`) |
| `declaracion_accion_derecho.enlace` | `datos.cplt.cl` | 935 | otro (CPLT) | E-005 — detalle vía `RPC:bienes_de_parlamentario`; el badge usa el `enlace` de la versión |
| `declaracion_actividad.enlace` | `datos.cplt.cl` | 690 | otro (CPLT) | E-005 — ídem |
| `declaracion_bien_inmueble.enlace` | `datos.cplt.cl` | 2841 | otro (CPLT) | E-005 — ídem |
| `declaracion_bien_mueble.enlace` | `datos.cplt.cl` | 1476 | otro (CPLT) | E-005 — ídem |
| `declaracion_pasivo.enlace` | `datos.cplt.cl` | 1820 | otro (CPLT) | E-005 — ídem |
| `declaracion_valor.enlace` | `datos.cplt.cl` | 614 | otro (CPLT) | E-005 — ídem |
| `lobby_audiencia.enlace` | `www.camara.cl` | 17730 | camara | §3.1.4 fila 10 (E-002 `lobby-de-parlamentario.tsx:537`, mapeo `:601`) |
| `lobby_audiencia.enlace` | `www.leylobby.gob.cl` | 32 | **leylobby** | §3.1.4 fila 10 (E-002) |
| `lobby_audiencia.enlace_detalle` | `www.leylobby.gob.cl` | 32 | **leylobby** | E-020 `lobby-menciones-de-boletin.tsx:111`, E-041 `lobby-en-tramitacion.tsx:124` (ambos `safeExternalHref(row.enlace_detalle)`); y fallback de E-002 (`:601` `f.enlace ?? f.enlace_detalle`) |
| `lobby_contraparte.enlace` | `www.camara.cl` | 17681 | camara | **ninguno** — la contraparte se muestra como TEXTO CRUDO sin enlace (`lobby-de-parlamentario.tsx:272,289-290`); columna presente en DB, **no** emitida al DOM |
| `parlamentario.enlace` | `opendata.camara.cl` | 155 | camara | §3.1.4 fila 11 (E-059 `parlamentario-header.tsx:118`) |
| `parlamentario.enlace` | `tramitacion.senado.cl` | 31 | senado | §3.1.4 fila 11 (E-059) |
| `parlamentario_militancia.enlace` | `opendata.camara.cl` | 315 | camara | E-054 `militancias-de-parlamentario.tsx` — **no emite href**; `partidoLegible` (§3.2 #4) desactiva URIs |
| `parlamentario_militancia.enlace` | `datos.bcn.cl` | 48 | **BCN** | E-054 / E-019 `partido-chip.tsx` — **no emite href**: `partidoLegible` deriva el nombre legible del slug (invariante "CERO URI en el DOM") |
| `proyecto.enlace` | `tramitacion.senado.cl` | 3658 | senado | §3.1.4 fila 8 (E-043 `ficha-header.tsx:70-73`), **post-rewrite** `enlaceHumanoProyecto` (el path es `/wspublico/`, XML crudo) |
| `proyecto.enlace` | `opendata.camara.cl` | 1 | camara | E-043 — pasa **verbatim** (host ≠ `tramitacion.senado.cl` ⇒ sin rewrite) |
| `proyecto_autor.enlace` | `tramitacion.senado.cl` | 19983 | senado | §3.1.4 fila 3 (E-035 `autor-row.tsx:64`), **post-rewrite** |
| `sesion_sala.enlace` | `web-back.senado.cl` | 16 | senado | E-018 `sala-table-section.tsx` (`camaraPdfUrl` / enlace de sesión) |
| `sesion_sala.enlace` | `www.camara.cl` | 2 | camara | E-018 `sala-table-section.tsx:151` |
| `source_snapshot.source_url` | `tramitacion.senado.cl` | 4380 | senado | **no renderizada como href**: E-048 pasa `sourceUrl={null}` (§3.1.4 fila 1); el snapshot sólo alimenta `capturedAt` y el respaldo R2 (`esR2PathPermitido`, prefijo `tramitacion/`) |
| `source_snapshot.source_url` | `datos.cplt.cl` | 3 | otro (CPLT) | ídem — no emitida al DOM |
| `tramitacion_evento.enlace` | `www.senado.cl` | 5790 | senado | E-038 `timeline-event.tsx:42` (anidado en E-010) |
| `tramitacion_evento.enlace` | `opendata.camara.cl` | 3797 | camara | E-038 `timeline-event.tsx:42` |
| `tramitacion_evento.enlace` | `tramitacion.senado.cl` | 982 | senado | E-038 `timeline-event.tsx:42` — **sin rewrite**: `enlaceHumanoProyecto` no se aplica aquí (candidato a revisar en 115 si el path es `/wspublico/`) |
| `votacion.enlace` | `opendata.camara.cl` | 3806 | camara | §3.1.4 fila 14 (E-056 `votacion-card.tsx:101-104`), **post-rewrite** |
| `votacion.enlace` | `tramitacion.senado.cl` | 1049 | senado | §3.1.4 fila 14 (E-056), **post-rewrite** a `buildSenadoUrl(boletin)` |

#### 3.3.4 Criterio duro de cierre — las 4 clases del ROADMAP

| clase | ¿resuelta? | evidencia |
|-------|------------|-----------|
| **camara** | **SÍ** — 4 hosts | `www.camara.cl` (arista 7394, lobby_audiencia 17730, lobby_contraparte 17681, cruce_senal 781, comision_membresia 386, citacion 164, comision 34, sesion_sala 2) · `opendata.camara.cl` (votacion 3806, tramitacion_evento 3797, parlamentario_militancia 315, parlamentario 155, proyecto 1) |
| **senado** | **SÍ** — 3 hosts | `tramitacion.senado.cl` (proyecto_autor 19983, source_snapshot 4380, proyecto 3658, votacion 1049, tramitacion_evento 982, parlamentario 31) · `www.senado.cl` (tramitacion_evento 5790) · `web-back.senado.cl` (citacion 125, sesion_sala 16) |
| **BCN** | **SÍ** — 1 host, y **jamás como href** | `datos.bcn.cl` en `parlamentario_militancia.enlace` → **48** filas. Query de respaldo: `select split_part(enlace,'/',3) host, count(*) from parlamentario_militancia where enlace like '%bcn.cl%' group by 1;` → `datos.bcn.cl\|48`. Estas 48 son URIs `.../partido-politico/{slug}` que `partidoLegible` (§3.2 #4) **desactiva**: se renderiza el nombre legible, **nunca** el URI. Cero hrefs a BCN en el DOM |
| **leylobby** | **SÍ** — 1 host, 2 columnas | `www.leylobby.gob.cl` en `lobby_audiencia.enlace` (**32**) y `lobby_audiencia.enlace_detalle` (**32**). Búsqueda por VALOR de respaldo: `select 'lobby_audiencia.enlace', count(*) from lobby_audiencia where enlace like '%leylobby%' union all select 'lobby_audiencia.enlace_detalle', count(*) from lobby_audiencia where enlace_detalle like '%leylobby%';` → `lobby_audiencia.enlace\|32` y `lobby_audiencia.enlace_detalle\|32`. **Ninguna** de las dos columnas matchea el patrón `url_fuente\|enlace_fuente\|link_*` del research — de ahí el descubrimiento por catálogo |

Las 4 clases quedan **resueltas con host + conteo**; ninguna requirió la declaración de cero.

#### 3.3.5 Columnas descubiertas con cero ocurrencias en PROD al 2026-07-27

| tabla.columna | n | fuente esperada | causa |
|---------------|--:|-----------------|-------|
| `actualidad_senal.enlace` | 0 | otro | el panel de actualidad arma su `href` interno en `panel-actualidad.tsx` (E-055), no desde esta columna |
| `aporte.enlace` | 0 | otro (Servel) | tabla vacía (`select count(*) from aporte` → **0**, §1.5); gate **MONEY** OFF |
| `contrato.enlace` | 0 | otro (Mercado Público) | tabla vacía (`select count(*) from contrato` → **0**, §1.5); gate **MONEY** OFF |
| `contratista.enlace` | 0 | otro (Mercado Público) | sin filas — dominio MONEY sin poblar |
| `declaracion_familiar.enlace` | 0 | otro (CPLT) | sin filas con enlace |
| `donante.enlace` | 0 | otro (Servel) | sin filas — dominio MONEY sin poblar |
| `entidad_tercero.enlace` | 0 | otro | sin filas |
| `parlamentario_bio.enlace` | 0 | camara/senado | el enlace vive en `parlamentario.enlace`, no en la bio |
| `pii_contraparte_declaracion.enlace` | 0 | otro | sin filas — **dominio PII**: sólo se consultó host+conteo, jamás valores |
| `vinculo_entidad.enlace` | 0 | otro | sin filas |
| `vinculo_identidad.enlace` | 0 | otro | sin filas |

#### 3.3.6 Consecuencias para 115

1. Validar sólo los 4 builders de §3.2 cubriría **~24.700** hrefs de un universo de **~78.000**
   valores de URL almacenados. El grueso llega **desde columna**, vía `safeExternalHref`.
2. `lobby_contraparte.enlace` (17.681) y `source_snapshot.source_url` (4.383) existen en DB pero
   **no se emiten al DOM** — 115/125 no deben perseguirlas.
3. `datos.bcn.cl` (48) es el único host que el producto **desactiva a propósito**: cualquier URI BCN
   visible en el DOM es una regresión del invariante "CERO URI".
4. `tramitacion_evento.enlace` tiene **982** filas en `tramitacion.senado.cl` que **no** pasan por
   `enlaceHumanoProyecto` (E-038). Si su path fuera `/wspublico/`, serían links a XML crudo:
   **candidato #1 de 115**, registrado aquí sin corregir (esta fase no arregla).
5. Los 4 call-sites MONEY de §3.1.4 tienen columnas de respaldo **vacías**: aunque el gate se
   encendiera, no habría link. Cero valor en perseguirlos.

## 4. Las 15 rutas

**Régimen de §4 (LOCKED).** Cada ruta se inventaría con **tres tablas de columnas fijas**:
**A** = links internos, **B** = links externos, **C** = fechas. Reglas transversales:

- El **chrome NO se repite**: se referencia `→ C-01`..`C-04` (§2). Los componentes no se
  re-describen: se referencian `→ E-NNN` (§3).
- **Cero celdas vacías**: `—` cuando no aplica.
- Bloques con gate OFF se inventarían igual y llevan la cadena literal
  `no emitido en el deploy auditado` (§5.1).
- **Regla de badge (LOCKED, §3.1):** `ProvenanceBadge` es chokepoint **DUAL**. Toda instancia
  aporta **una fila en Tabla C** (fecha `capturedAt`) **y una fila en Tabla B** (link `sourceUrl`
  vía `safeExternalHref`). Un badge que solo aparezca en Tabla C es un defecto de inventario.
  Cuando `sourceUrl` es `null` por diseño, la fila B lo declara: el `<a>` **no se emite**.
- Toda fecha que llegue por prop `capturedAt` se marca `sí` en *¿es fecha_captura?* sin más
  análisis. Los nombres de origen salen de las listas cerradas de §0.2 + la ampliación de §3.

### 4.1 `/parlamentario/[id]` — ficha 360

**Tipo:** pública, **dinámica** (`app/app/parlamentario/[id]/page.tsx`; `[id]` validado contra
`PARLAMENTARIO_ID_RE` **antes** de tocar la DB, `page.tsx:215-217`).

**Sujetos usados** (§1, ids verbatim — nunca el `parlid_senado` numérico):

| sujeto | id | URL PROD | qué ejercita |
|--------|----|----------|--------------|
| A — diputado | `D1165` | `https://observatorio-congreso.thevalis.workers.dev/parlamentario/D1165` | los 6 bloques con dato: votos, lobby, patrimonio, cruces, comisiones, militancias |
| B — senador | `S1338` | `https://observatorio-congreso.thevalis.workers.dev/parlamentario/S1338` | la rama de **estados vacíos honestos**: 0 lobby, 0 cruces, 0 comisiones (§1.2) |

**Chrome:** `→ C-01` (footer), `→ C-02` (nav), `→ C-03` (wordmark), `→ C-04` (breadcrumbs,
montado por `parlamentario-header.tsx:73-79` con `Inicio` → `/` y `Parlamentarios` →
`/parlamentarios`; el último ítem es `<span aria-current="page">`, no link). **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/comparar?a={id}` | → E-036 `app/app/parlamentario/[id]/page.tsx:305` | — | siempre (navegación pura) | `/comparar` |
| A2 | `/red?seed={id}` | → E-036 `app/app/parlamentario/[id]/page.tsx:328` | — | **NET** (ON) — nodo AUSENTE del DOM si OFF (`page.tsx:325`) | `/red` |
| A3 | `#{carril}` (`#votos`, `#lobby`, `#patrimonio`, `#cruces`) | → E-042 `app/components/ficha-rail.tsx:59` | **sí** — coincide con el `id` de cada `<section>` | entradas gate-aware vía `construirChips` (`page.tsx:527`) | misma ruta (scroll) |
| A4 | `/parlamentario/{p.id}` (filas de los 5 bloques de relaciones) | → E-022 `app/components/cross-links-parlamentario.tsx:112` | — | `RelacionesConDatos` (`page.tsx:382-418`): si los 5 `total_n` son 0 → vacío DECLARADO y cero filas | `/parlamentario/[id]` |
| A5 | `verTodosHref` | → E-022 `app/components/cross-links-parlamentario.tsx:130` | — | **`null` en los 5 bloques de esta ruta** (`page.tsx:430,446,462,479,505`) ⇒ el `<a>` NO se emite | — |
| A6 | `/proyecto/{grupo.boletin}` | → E-001 `app/components/votos-por-parlamentario.tsx:483,490` | — | dentro de `DetalleColapsable` (cerrado por defecto, presente en el DOM) | `/proyecto/[boletin]` |
| A7 | `buildVotosVerHref(id, boletin, abierto)` | → E-001 `app/components/votos-por-parlamentario.tsx:561` | **sí** (`#votos`) | expandir/colapsar grupo de votación | misma ruta |
| A8 | `/parlamentarios` | → E-001 `app/components/votos-por-parlamentario.tsx:597` | — | siempre | `/parlamentarios` |
| A9 | `buildHref(id, { materia })` (filtro de materia + limpiar filtro) | → E-001 `app/components/votos-por-parlamentario.tsx:726,739` | **sí** (`#votos`) | solo si hay materias | misma ruta |
| A10 | `buildHref(id, { votosPage ± 1 })` | → E-001 `app/components/votos-por-parlamentario.tsx:819,835` | **sí** (`#votos`) | paginación server; el botón inexistente no se emite | misma ruta |
| A11 | `/parlamentario/{id}#lobby` | → E-002 `app/components/lobby-de-parlamentario.tsx:255` | **sí** (`#lobby`) | conmutador de vista | misma ruta |
| A12 | `/parlamentario/{id}?vista=cronologica#lobby` | → E-002 `app/components/lobby-de-parlamentario.tsx:262` | **sí** (`#lobby`) | conmutador de vista | misma ruta |
| A13 | `/buscar` | → E-002 `app/components/lobby-de-parlamentario.tsx:352,376` | — | empty-states del carril de lobby (los ejercita el **sujeto B**, 0 audiencias) | `/buscar` |
| A14 | `buildHref(id, page ± 1, "cronologica")` | → E-002 `app/components/lobby-de-parlamentario.tsx:552,565` | **sí** (`#lobby`) | paginación server | misma ruta |
| A15 | `/proyecto/{boletin}` (chips de boletines mencionados) | → E-030 `app/components/mencion-boletin-chip.tsx:41`, montado en `lobby-de-parlamentario.tsx:450,529` | — | solo si la audiencia menciona boletines | `/proyecto/[boletin]` |
| A16 | `buildVerHref(id, version.version_id)` | → E-005 `app/components/patrimonio-de-parlamentario.tsx:502` | **sí** (`#patrimonio`) | abrir el detalle de una declaración | misma ruta |
| A17 | `buildHistorialHref(id, page ± 1)` | → E-005 `app/components/patrimonio-de-parlamentario.tsx:595,608` | **sí** (`#patrimonio`) | paginación del historial | misma ruta |
| A18 | `/cuenta?next={encodeURIComponent("/parlamentario/{id}")}` | → E-039 `app/components/seguir-button.tsx:73` (montado en `page.tsx:246-250`) | — | **NOTIF** (OFF) — `no emitido en el deploy auditado` | `/cuenta` |
| A19 | `buildHref(id, page ± 1)` (paginación de contratos) | → E-015 `app/components/contratos-de-parlamentario.tsx:268,281` | **sí** (`#dinero`) | **MONEY** (OFF) — `no emitido en el deploy auditado` | misma ruta |
| A20 | `buildHref(id, page ± 1)` (paginación de aportes) | → E-013 `app/components/financiamiento-de-parlamentario.tsx:420,433` | **sí** (`#financiamiento`) | **MONEY** (OFF) — `no emitido en el deploy auditado` | misma ruta |

**Diferencia por sujeto:** con `S1338` (0 lobby / 0 cruces / 0 comisiones) las filas A11-A15 quedan
reducidas a los empty-states (A13 sí se emite), la `<section id="cruces">` no pinta detalle
(`conteos.cruces.tipo !== "dato"`, `page.tsx:682`) y por tanto A3 no ofrece la entrada `#cruces`.

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | camara (`opendata.camara.cl`) / senado (`tramitacion.senado.cl`) | `RPC:parlamentario_publico_v2.enlace` ← `tabla.parlamentario.enlace` | `columna` (sin builder), vía `safeExternalHref` | `parlamentario.enlace ?? null` | **badge** → E-059 `app/components/parlamentario-header.tsx:115-118` (§3.1.4 fila 11) | — |
| B2 | camara (`www.camara.cl`) + **leylobby** (`www.leylobby.gob.cl`) | `RPC:lobby_de_parlamentario` ← `tabla.lobby_audiencia.enlace` con fallback a `.enlace_detalle` (`lobby-de-parlamentario.tsx:601`) | `columna` | `sourceUrl={a.enlace}` | **badge** → E-002 `app/components/lobby-de-parlamentario.tsx:534-537` (§3.1.4 fila 10) | — |
| B3 | otro (CPLT, `datos.cplt.cl`) | `RPC:declaraciones_de_parlamentario` ← `tabla.declaracion.enlace` | `columna` | `sourceUrl={version.enlace}` | **badge** → E-005 `app/components/patrimonio-de-parlamentario.tsx:443-446` (§3.1.4 fila 12) | — |
| B4 | otro (CPLT, `datos.cplt.cl`) | `RPC:comparar_declaraciones` ← `tabla.declaracion.enlace` | `columna` | `sourceUrl={c.enlace}` (una por columna comparada) | **badge** → E-005 `app/components/patrimonio-de-parlamentario.tsx:765-769` (§3.1.4 fila 13) | — |
| B5 | camara (`opendata.camara.cl`) + senado (`tramitacion.senado.cl`) | `RPC:votos_de_parlamentario.enlace` ← `tabla.votacion.enlace` | `columna` | `sourceUrl={e.enlace ?? null}` | **badge** → E-001 `app/components/votos-por-parlamentario.tsx:544-547` (§3.1.4 fila 16) | — |
| B6 | camara (`www.camara.cl`) + leylobby | `RPC:cruces_de_parlamentario` → `cruce_senal.evidencia` jsonb, clave `enlace_fuente` | `columna` (jsonb) | `sourceUrl={item.enlace_fuente}` | **badge** → E-053 `app/components/cruces-de-parlamentario.tsx:194-197` (§3.1.4 fila 6) | **CRUCES** (ON) |
| B7 | otro (Creative Commons) | literal `CC_BY_40_URL = "https://creativecommons.org/licenses/by/4.0/"` (`patrimonio-de-parlamentario.tsx:67`) | literal en código (no builder, no columna) | — | → E-005 `app/components/patrimonio-de-parlamentario.tsx:215` | — |
| B8 | otro (Mercado Público) — **0 filas en PROD** (§3.3) | `RPC:contratos_de_parlamentario` ← `tabla.contrato.enlace` | `columna` | `sourceUrl={c.enlace}` | **badge** → E-015 `app/components/contratos-de-parlamentario.tsx:192-195` (§3.1.4 fila 4) | **MONEY** (OFF) — `no emitido en el deploy auditado` |
| B9 | otro (Servel) — **0 filas en PROD** (§3.3) | `RPC:aportes_de_parlamentario` ← `tabla.aporte.enlace` | `columna` | `sourceUrl={a.enlace}` | **badge** → E-013 `app/components/financiamiento-de-parlamentario.tsx:231-234` (§3.1.4 fila 9) | **MONEY** (OFF) — `no emitido en el deploy auditado` |
| B10 | ninguna — **link desactivado a propósito** | `RPC:parlamentario_publico_v2.partido` / `RPC:militancias_de_parlamentario.partido` ← URIs `datos.bcn.cl/.../partido-politico/{slug}` | `partidoLegible` (§3.2 nº 4): **NO construye link**, extrae el slug | — | → E-019 `app/components/partido-chip.tsx`, → E-054 `app/components/militancias-de-parlamentario.tsx` | — (invariante "CERO URI en el DOM") |

**Ningún badge de esta ruta pasa `sourceUrl={null}`**: los 7 badges (B1-B6, B8, B9) llevan columna
de origen. Los 4 chrome-links externos (CC BY 4.0 y `mailto:` del footer) viven en `C-01`.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | `Actualizado {hace X}` (cabecera) | `relativeTimeEs` + `esStale` (**14 días** → amber; `STALE_THRESHOLD_MS`, `app/lib/format.ts:10` — corregido en 117/F-11) | `RPC:parlamentario_publico_v2.fecha_captura` | **sí** | **sí** | — | → E-059 `app/components/parlamentario-header.tsx:37,116` |
| C2 | `según {fuente} al {fecha}` (tooltip del chip de partido) | `fechaCorta` | `RPC:parlamentario_publico_v2.partido_fecha_captura` | **sí** | **no** — el chip la formatea por su cuenta | — | → E-019 `app/components/partido-chip.tsx:65-70` |
| C3 | rango de militancia `{desde} – {hasta \| "vigente"}` | `fechaCorta` | `RPC:militancias_de_parlamentario.desde` / `.hasta` | no (hecho declarado) | no | — | → E-054 `app/components/militancias-de-parlamentario.tsx:26,27` |
| C4 | fecha de la votación | `fechaCortaSegura` | `RPC:votos_de_parlamentario.fecha` | no (el hecho) | no | — | → E-001 `app/components/votos-por-parlamentario.tsx:528` |
| C5 | mes-año de agrupación de votaciones | `Intl.DateTimeFormat("es-CL")` | `RPC:votos_de_parlamentario.fecha` | no (el hecho) | no | — | → E-001 `app/components/votos-por-parlamentario.tsx:287` |
| C6 | `Actualizado {hace X}` (por votación) | `relativeTimeEs` | `RPC:votos_de_parlamentario.fecha_captura` | **sí** | **sí** | — | → E-001 `app/components/votos-por-parlamentario.tsx:544-545` |
| C7 | fecha de la audiencia de lobby | `fechaCorta` | `RPC:lobby_de_parlamentario.fecha` | no (el hecho) | no | — | → E-002 `app/components/lobby-de-parlamentario.tsx:153,478` |
| C8 | `Actualizado {hace X}` (por audiencia) | `relativeTimeEs` | `RPC:lobby_de_parlamentario.fecha_captura` (`:476`) | **sí** | **sí** | — | → E-002 `app/components/lobby-de-parlamentario.tsx:534-535` |
| C9 | fecha de presentación de la declaración | `fechaCortaSegura` | `RPC:declaraciones_de_parlamentario.fecha_presentacion` | no (el hecho) | no | — | → E-005 `app/components/patrimonio-de-parlamentario.tsx:418,687,701,728` |
| C10 | `Actualizado {hace X}` (por declaración) | `relativeTimeEs` | `RPC:declaraciones_de_parlamentario.fecha_captura` (`:414`) | **sí** | **sí** | — | → E-005 `app/components/patrimonio-de-parlamentario.tsx:443-444` |
| C11 | `Actualizado {hace X}` (por columna comparada) | `relativeTimeEs` | `RPC:comparar_declaraciones.fecha_captura` (`:767`) | **sí** | **sí** | — | → E-005 `app/components/patrimonio-de-parlamentario.tsx:765-767` |
| C12 | fecha de la señal de cruce | `fechaCorta` | `RPC:cruces_de_parlamentario.fecha` | no (el hecho) | no | **CRUCES** (ON) | → E-053 `app/components/cruces-de-parlamentario.tsx:178` |
| C13 | `Actualizado {hace X}` (por señal) | `relativeTimeEs` | `RPC:cruces_de_parlamentario.fecha_captura` (`:195`) | **sí** | **sí** | **CRUCES** (ON) | → E-053 `app/components/cruces-de-parlamentario.tsx:194-195` |
| C14 | fecha de la orden de compra | `fechaCorta` | `RPC:contratos_de_parlamentario.fecha_oc` | no (el hecho) | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-015 `app/components/contratos-de-parlamentario.tsx:135` |
| C15 | fecha de corte del dato | `fechaCorta` | `RPC:contratos_de_parlamentario.fecha_corte` | no (corte de la fuente) | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-015 `app/components/contratos-de-parlamentario.tsx:138` |
| C16 | cobertura de ingesta de contratos | `fechaCorta` | `tabla.contratos_ingesta_estado.ingestado_hasta` (`:354,375`) | no (cobertura de ingesta, **no** captura) | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-015 `app/components/contratos-de-parlamentario.tsx:225` |
| C17 | `Actualizado {hace X}` (por contrato) | `relativeTimeEs` | `RPC:contratos_de_parlamentario.fecha_captura` (`:127`) | **sí** | **sí** | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-015 `app/components/contratos-de-parlamentario.tsx:192-193` |
| C18 | fecha del aporte | `fechaCorta` | `RPC:aportes_de_parlamentario.fecha_aporte` | no (el hecho) | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-013 `app/components/financiamiento-de-parlamentario.tsx:176` |
| C19 | fecha de corte del dato | `fechaCorta` | `RPC:aportes_de_parlamentario.fecha_corte` | no (corte de la fuente) | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-013 `app/components/financiamiento-de-parlamentario.tsx:179` |
| C20 | cobertura de ingesta de aportes | `fechaCorta` | `tabla.aportes_ingesta_estado.ingestado_hasta` (`:518,538`) | no (cobertura de ingesta, **no** captura) | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-013 `app/components/financiamiento-de-parlamentario.tsx:355` |
| C21 | `Actualizado {hace X}` (por aporte) | `relativeTimeEs` | `RPC:aportes_de_parlamentario.fecha_captura` (`:170`) | **sí** | **sí** | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-013 `app/components/financiamiento-de-parlamentario.tsx:231-232` |

**Correspondencia badge ↔ tablas (verificación de la regla LOCKED):** los 7 badges de la ruta
—`parlamentario-header:115`, `votos-por-parlamentario:544`, `lobby-de-parlamentario:534`,
`patrimonio-de-parlamentario:443` y `:765`, `cruces-de-parlamentario:194`,
`contratos-de-parlamentario:192`, `financiamiento-de-parlamentario:231` (8 instancias, 7 archivos)—
aportan **B1-B6, B8, B9** en Tabla B y **C1, C6, C8, C10, C11, C13, C17, C21** en Tabla C.
Cero badges solo-C.

**Notas de esta ruta (hallazgos de instanciación):**

1. **`probidad_ingesta_estado` NO renderiza fecha.** El `select` es
   `.select("parlamentario_id")` (`patrimonio-de-parlamentario.tsx:989-991`): sirve para
   distinguir "no ingestado" de "sin declaraciones", no para mostrar frescura. Por eso **no**
   tiene fila en Tabla C (a diferencia de sus hermanas MONEY, C16 y C20).
2. **`ParlamentarioResumen` (E-029) no se monta en esta ruta.** `page.tsx` importa sólo
   `construirChips` (`:7-10`) y las anclas las emite `FichaRail` (A3). El `<a href={ch.href}>` de
   `parlamentario-resumen.tsx:91` no llega al DOM de `/parlamentario/[id]` en el deploy auditado.
3. **`VotoRow` (E-026) no se monta en esta ruta.** Su único llamante non-test es
   `voto-detalle.tsx:51`, montado por `votacion-card.tsx:108` — es decir, `/proyecto/[boletin]`.
   El catálogo lo listaba en ambas rutas; aquí queda corregido por evidencia de import.

#### 4.1.b `app/app/parlamentario/[id]/not-found.tsx`

Es la **misma ruta en estado 404** (la dispara `HeaderSection` con `notFound()` cuando el RPC
devuelve 0 filas, `page.tsx:864-866`, y también el guard de `PARLAMENTARIO_ID_RE`, `:215-217`).
Renderiza el chrome (`C-01`..`C-03`; **sin** breadcrumbs) más un único link.

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/` | → E-049 `app/app/parlamentario/[id]/not-found.tsx:17` | — | siempre | `/` |

Tabla B: **sin links externos**. Tabla C: **sin fechas** (copy estático).

### 4.2 `/proyecto/[boletin]` — la ruta más densa en links externos

**Tipo:** pública, **dinámica** (`app/app/proyecto/[boletin]/page.tsx`; `[boletin]` validado contra
`BOLETIN_RE` **antes** de tocar la DB, `page.tsx:60-62`).

**Sujetos usados** (§1, ambos con `enlace` = `tramitacion.senado.cl/wspublico/...` ⇒ ambos
ejercitan el rewrite de `enlaceHumanoProyecto`):

| sujeto | boletín | URL PROD | qué ejercita |
|--------|---------|----------|--------------|
| C — boletín A (bicameral) | `14309-04` | `https://observatorio-congreso.thevalis.workers.dev/proyecto/14309-04` | 7 votaciones, 1 embedding (similares), **47 cruces**, `prm_id_camara=14891` ⇒ **rama CON `buildCamaraUrl`** |
| D — boletín B (zona solo-Senado) | `17870-05` | `https://observatorio-congreso.thevalis.workers.dev/proyecto/17870-05` | 256 votaciones, 355 eventos de tramitación, `prm_id_camara IS NULL` ⇒ **rama SIN `buildCamaraUrl`** |

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`, `→ C-04` (breadcrumbs montados por `page.tsx:79-85`:
`Inicio` → `/`, `Proyectos` → `/buscar`, y `Boletín {boletin}` **sin href**). **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `#{seccion}` (`#estado`, `#timeline`, `#votaciones`, `#autores`, `#lobby-tramitacion`, `#lobby-menciones`, `#cruces`, `#idea-matriz`, `#cuerpos-legales`, `#similares`, `#validacion-fuente`) | → E-042 `app/components/ficha-rail.tsx:59`, entradas armadas en `page.tsx:290-337` | **sí** | `#autores` solo si hay autores (`page.tsx:301-303`); `#cruces` solo con **CRUCES** ON (`:317-319`) ⇒ 10 entradas ON / 9 OFF | misma ruta (scroll) |
| A2 | `#idea-matriz` ("Ver la idea matriz completa") | → E-048 `app/app/proyecto/[boletin]/page.tsx:568` | **sí** | solo si `ficha.idea_matriz != null` (`:564`) | misma ruta |
| A3 | `/agenda?semana={semanaIso}` | → E-032 `app/components/estado-actual-block.tsx:477,492` | — | solo si el boletín está en tabla de sala | `/agenda` |
| A4 | `buildUrgenciasHref(boletin, p.id, true\|false)` | → E-010 `app/components/timeline-view.tsx:256,273` | — | dentro de `DetalleColapsable` de tramitación; expande/colapsa un período de urgencia (`?urgencias=<id>`) | misma ruta |
| A5 | `href` del paso del stepper | → E-045 `app/components/capa1/tramitacion-stepper.tsx:133` | **sí** | solo pasos con destino derivable | misma ruta |
| A6 | `/parlamentario/{voto.parlamentario_id}` | → E-026 `app/components/voto-row.tsx:43`, montado por `voto-detalle.tsx:51` ← `votacion-card.tsx:108` | — | **solo si la mención está `confirmado`** (guarda de identidad); desglose solo en votaciones con `voto(*)` | `/parlamentario/[id]` |
| A7 | `/parlamentario/{autor.parlamentario_id}` | → E-035 `app/components/autor-row.tsx:44` | — | **solo si el autor está confirmado**; si no, `IdentityMarker` sin link (`:51-53`) | `/parlamentario/[id]` |
| A8 | `/parlamentario/{row.parlamentario_id}` (menciones de lobby) | → E-020 `app/components/lobby-menciones-de-boletin.tsx:138` | — | LOB-03; la sección degrada a `null` si la RPC 0062 no está | `/parlamentario/[id]` |
| A9 | `/parlamentario/{row.parlamentario_id}` (cruces) | → E-044 `app/components/cruces-de-proyecto.tsx:130` | — | **CRUCES** (ON); contraparte de lobby en texto plano, **nunca** enlazada (52-03) | `/parlamentario/[id]` |
| A10 | `/proyecto/{boletin}` (tarjetas de proyectos similares) | → E-028 `app/components/search-result-card.tsx:80`, montado por `proyectos-similares.tsx:98` | — | solo si hay vecinos kNN; sin embedding → estado vacío honesto | `/proyecto/[boletin]` |
| A11 | `/cuenta?next={encodeURIComponent("/proyecto/{boletin}")}` | → E-039 `app/components/seguir-button.tsx:73` (montado en `page.tsx:112-116`) | — | **NOTIF** (OFF) — `no emitido en el deploy auditado` | `/cuenta` |

**Diferencia por sujeto:** el boletín D (`17870-05`, 355 eventos) hace pesado el `DetalleColapsable`
de tramitación (A4); el boletín C (`14309-04`, 47 cruces) es el que ejercita A9 con volumen.
Ninguna fila de la Tabla A depende de `prm_id_camara`.

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | senado (`tramitacion.senado.cl`) | **columna** `tabla.proyecto.enlace` = `https://tramitacion.senado.cl/wspublico/...` (XML) → **href emitido POST-rewrite** = `buildSenadoUrl(boletin)` = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini={boletin}` | `enlaceHumanoProyecto` (§3.2 nº 3) sobre `columna` | `enlaceHumanoProyecto(proyecto.enlace \|\| "", proyecto.boletin) \|\| null` | **badge** → E-043 `app/components/ficha-header.tsx:65,70-73` (§3.1.4 fila 8) | — |
| B2 | camara (`www.camara.cl`) | `buildCamaraUrl(proyecto.boletin, proyecto.prm_id_camara)` (§3.2 nº 2) | **builder** | `prm_id_camara` + `boletin` | → E-043 `app/components/ficha-header.tsx:82` | — · **solo si `prm_id_camara !== null`** (`ficha-header.tsx:78`) ⇒ **C sí (`prmID=14891`), D NO** |
| B3 | senado (`tramitacion.senado.cl`) | `buildSenadoUrl(boletin)` (§3.2 nº 1) | **builder** | `boletin` COMPLETO con sufijo | → E-027 `app/components/validacion-fuente.tsx:117,149` | — · SIEMPRE (si supera `safeExternalHref`) |
| B4 | camara (`www.camara.cl`) | `buildCamaraUrl(boletin, prm_id_camara)` (§3.2 nº 2) | **builder** | `prm_id_camara` + `boletin` | → E-027 `app/components/validacion-fuente.tsx:118-119,167` | — · **solo si `prm_id_camara !== null`** ⇒ **C sí, D NO** (fail-honest: fila ausente, sin placeholder) |
| B5 | senado / camara — **sin `enlaceHumanoProyecto`** | **columna** `tabla.tramitacion_evento.enlace` **VERBATIM** (982 filas en `tramitacion.senado.cl`, §3.3.6 nº 4) | `columna` (sin builder, sin rewrite) | `evento.enlace` | → E-038 `app/components/timeline-event.tsx:42` | — · **candidato #1 de 115** |
| B6 | camara (`opendata.camara.cl`) + senado (`tramitacion.senado.cl`) | **columna** `tabla.votacion.enlace` + `.boletin` → **href POST-rewrite** | `enlaceHumanoProyecto` sobre `columna` | `enlaceHumanoProyecto(votacion.enlace \|\| "", votacion.boletin) \|\| null` | **badge** → E-056 `app/components/votacion-card.tsx:95,101-104` (§3.1.4 fila 14) | — |
| B7 | senado (`tramitacion.senado.cl`) | **columna** `tabla.proyecto_autor.enlace` + `.boletin` → **href POST-rewrite** | `enlaceHumanoProyecto` sobre `columna` | `enlaceHumanoProyecto(autor.enlace \|\| "", autor.boletin) \|\| null` | **badge** → E-035 `app/components/autor-row.tsx:56,64` (§3.1.4 fila 3) | — |
| B8 | senado (`tramitacion.senado.cl`) | **columna** `tabla.proyecto.enlace` de cada vecino kNN → **href POST-rewrite** | `enlaceHumanoProyecto` sobre `columna` | `enlaceHumanoProyecto(p.enlace ?? "", p.boletin) \|\| null` | **badge** → E-028 `app/components/search-result-card.tsx:93` ← `proyectos-similares.tsx:106-109` | — |
| B9 | camara (`www.camara.cl`) + leylobby (`www.leylobby.gob.cl`) | **columna** `RPC:lobby_en_tramitacion` ← `tabla.lobby_audiencia.enlace` | `columna` | `href` de la audiencia | → E-041 `app/components/lobby-en-tramitacion.tsx:150` | — |
| B10 | camara (`www.camara.cl`) + leylobby (`www.leylobby.gob.cl`) | **columna** `RPC:lobby_menciones_de_boletin` ← `tabla.lobby_audiencia.enlace` | `columna` | `href` de la audiencia | → E-020 `app/components/lobby-menciones-de-boletin.tsx:164` | — |
| B11 | camara (`www.camara.cl`) + leylobby | **columna** `RPC:cruces_de_proyecto` → `cruce_senal.evidencia` jsonb, clave `enlace_fuente` | `columna` (jsonb) | `sourceUrl={item.enlace_fuente}` | **badge** → E-044 `app/components/cruces-de-proyecto.tsx:176,179` (§3.1.4 fila 7) | **CRUCES** (ON) |
| B12 | **ninguna — badge SIN link por diseño** | `sourceUrl={null}` literal; el badge sólo lleva `capturedAt` | — (ni builder ni columna) | `null` | **badge** → E-048 `app/app/proyecto/[boletin]/page.tsx:489,492` (§3.1.4 fila 1) | — |
| B13 | **ninguna — badge SIN link por diseño** | `sourceUrl: null` literal (`page.tsx:390`): `texto_r2_path` es key R2 interna, **jamás** href público | — (ni builder ni columna) | `null` | **badge** → E-058 `app/components/idea-matriz-block.tsx:48` ← `page.tsx:381-392` | — |
| B14 | **ninguna — key R2 nunca se enlaza** | `tabla.source_snapshot.r2_path` (allowlist de prefijo `tramitacion/*`) se muestra como **fecha + hash abreviado**, sin `<a>` | — | — | → E-027 `app/components/validacion-fuente.tsx:186-201` (comentario LOCKED en `:200`) | — |

**Registro del rewrite (LOCKED, §3.2):** en B1, B6, B7 y B8 el inventario registra el **href
finalmente emitido**, no el valor crudo de la columna. Para ambos sujetos el valor de
`proyecto.enlace` es `https://tramitacion.senado.cl/wspublico/...` (host `tramitacion.senado.cl` +
path `/wspublico/` ⇒ **la condición del rewrite se cumple**) y el href emitido es
`buildSenadoUrl('14309-04')` / `buildSenadoUrl('17870-05')`. **B5 es la excepción**: pasa la
columna verbatim, sin rewrite.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | `Actualizado {hace X}` (cabecera de la ficha) | `relativeTimeEs` + `esStale` | `tabla.proyecto.fecha_captura` | **sí** | **sí** | — | → E-043 `app/components/ficha-header.tsx:19,66` |
| C2 | `Actualizado {hace X}` (heading "Tramitación") — **frescura del set de eventos** | `relativeTimeEs` + `esStale` | `tabla.tramitacion_evento.fecha_captura` **MÁS RECIENTE** del set (`page.tsx:478-482`) | **sí** | **sí** | — | → E-048 `app/app/proyecto/[boletin]/page.tsx:489-490` |
| C3 | fecha de cada evento de tramitación | `fechaCorta` | `tabla.tramitacion_evento.fecha` — **el hecho** | no | no | — | → E-038 `app/components/timeline-event.tsx:32` |
| C4 | mes-año de agrupación del timeline | `Intl.DateTimeFormat("es-CL")` | `tabla.tramitacion_evento.fecha` — el hecho | no | no | — | → E-010 `app/components/timeline-view.tsx:22` |
| C5 | fecha de hito del stepper / inicio de urgencia vigente | `fechaCorta` | `tabla.tramitacion_evento.fecha` — el hecho | no | no | — | → E-045 `app/components/capa1/tramitacion-stepper.tsx:99,194` |
| C6 | fecha del último hito | `fechaCorta` | `tabla.tramitacion_evento.fecha` — el hecho | no | no | — | → E-032 `app/components/estado-actual-block.tsx:397` |
| C7 | inicio de la urgencia vigente (`{fecha}` + `hace X`) | `fechaCorta` + `relativeTimeEs` | `tabla.tramitacion_evento.fecha` (evento de presentación de urgencia) — el hecho | no | no | — | → E-032 `app/components/estado-actual-block.tsx:413,417` |
| C8 | `según {fuente} al {fecha}` (coletilla del token de urgencia) | `fechaCorta` | `tabla.tramitacion_evento.fecha_captura` MÁS RECIENTE (`estado-actual-block.tsx:332-339`) | **sí** | **no** — el bloque la formatea por su cuenta | — | → E-032 `app/components/estado-actual-block.tsx:429` |
| C9 | fecha de la citación vigente / próximas | `fechaCorta` + `diaCalendarioCitacion` | `tabla.citacion.fecha` (date-only medianoche UTC: la parte fecha UTC **es** el día chileno) vía `tabla.citacion_punto` (`:541`) | no (el hecho) | no | — | → E-032 `app/components/estado-actual-block.tsx:189,221,237,270,445,460` |
| C10 | fecha en tabla de sala | `fechaCorta` | `tabla.sesion_tabla_item` (`:551`) → fecha de la sesión — el hecho | no | no | — | → E-032 `app/components/estado-actual-block.tsx:475,497` |
| C11 | fecha de la votación | `fechaCorta` | `tabla.votacion.fecha` — el hecho | no | no | — | → E-056 `app/components/votacion-card.tsx:39` |
| C12 | `Actualizado {hace X}` (por votación) | `relativeTimeEs` | `tabla.votacion.fecha_captura` (`:23`) | **sí** | **sí** | — | → E-056 `app/components/votacion-card.tsx:95-96` |
| C13 | `Actualizado {hace X}` (por autor) | `relativeTimeEs` | `tabla.proyecto_autor.fecha_captura` | **sí** | **sí** | — | → E-035 `app/components/autor-row.tsx:56-58` |
| C14 | `Actualizado {hace X}` (idea matriz) | `relativeTimeEs` | `tabla.proyecto_ficha.fecha_captura` (`page.tsx:384`) | **sí** | **sí** | — | → E-058 `app/components/idea-matriz-block.tsx:48` |
| C15 | `Actualizado {hace X}` (por proyecto similar) | `relativeTimeEs` | `tabla.proyecto.fecha_captura` del vecino (`proyectos-similares.tsx:106`) | **sí** | **sí** | — | → E-028 `app/components/search-result-card.tsx:93` |
| C16 | `Reunión registrada el {fecha}` (lobby del período) | `fechaCorta` | `RPC:lobby_en_tramitacion.fecha` — el hecho | no | no | — | → E-041 `app/components/lobby-en-tramitacion.tsx:144` |
| C17 | fecha de la audiencia (menciones de lobby) | `fechaCorta` | `RPC:lobby_menciones_de_boletin.fecha` — el hecho | no | no | — | → E-020 `app/components/lobby-menciones-de-boletin.tsx:129` |
| C18 | `Reunión registrada el {fecha}` (cruces) | `fechaCortaSegura` | `RPC:cruces_de_proyecto.fecha` — el hecho | no | no | **CRUCES** (ON) | → E-044 `app/components/cruces-de-proyecto.tsx:168` |
| C19 | `Actualizado {hace X}` (por señal de cruce) | `relativeTimeEs` | `RPC:cruces_de_proyecto.fecha_captura` (`:177`) | **sí** | **sí** | **CRUCES** (ON) | → E-044 `app/components/cruces-de-proyecto.tsx:176-177` |
| C20 | `según fuente al {fecha}` (validación de fuente) | `toLocaleDateString("es-CL", { timeZone: "America/Santiago" })` (`formatFechaCaptura`, `:224-233`) | `tabla.proyecto.fecha_captura` (`page.tsx:677`) | **sí** | **no** — el bloque la formatea por su cuenta | — | → E-027 `app/components/validacion-fuente.tsx:139-141` |
| C21 | `Respaldo del {fecha} · hash {…}` | `toLocaleDateString("es-CL", { timeZone: "America/Santiago" })` (`formatFetchedAt`, `:236-246`) | `tabla.source_snapshot.fetched_at` (`page.tsx:650`) — momento del **snapshot en R2** | **sí** (reloj de scraping) | **no** | — | → E-027 `app/components/validacion-fuente.tsx:189-191` |

**La frescura NUNCA se presenta como el hecho.** C2, C8, C20 y C21 son relojes de captura/scraping
y su copy lo dice literalmente: `Actualizado hace X`, `según {fuente} al {fecha}`,
`Respaldo del {fecha} · Esto decía la fuente ese día`. Las fechas del **hecho** de tramitación son
C3-C7 y C9-C10, todas desde `tramitacion_evento.fecha` / `citacion.fecha` / `sesion_tabla_item`.

**Correspondencia badge ↔ tablas (verificación de la regla LOCKED):** los 7 badges de la ruta
—`ficha-header:65`, `page.tsx:489`, `votacion-card:95`, `autor-row:56`, `idea-matriz-block:48`,
`search-result-card:93`, `cruces-de-proyecto:176`— aportan **B1, B6, B7, B8, B11, B12, B13** en
Tabla B (los dos últimos declarando `sourceUrl={null}`) y **C1, C2, C12, C13, C14, C15, C19** en
Tabla C. Cero badges solo-C.

**Nota de esta ruta (corrección del catálogo):** `E-048` registraba el `capturedAt` de `page.tsx:490`
como `tabla.source_snapshot`. La evidencia del código es otra: `masReciente` sale del `reduce` sobre
los eventos de `tramitacion_evento` (`page.tsx:478-482`), y `source_snapshot` sólo alimenta el
respaldo R2 de `validacion-fuente` (C21). Queda corregido en C2/C21.

#### 4.2.b `app/app/proyecto/[boletin]/not-found.tsx`

Es la **misma ruta en estado 404** (la disparan el guard `BOLETIN_RE`, `page.tsx:60-62`, y
`FichaSection` cuando `leerProyecto` devuelve 0 filas, `:429-431`). Emite **3 hrefs**, dos de ellos
**externos** — 115 debe validarlos igual que los de la ficha viva.

Tabla A (internos):

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/` | → E-023 `app/app/proyecto/[boletin]/not-found.tsx:37` | — | siempre | `/` |

Tabla B (externos):

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | **senado** (`www.senado.cl`) | literal `https://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDetalleProyecto` | literal en código (ni builder ni columna) | — (buscador genérico, sin boletín) | → E-023 `app/app/proyecto/[boletin]/not-found.tsx:18` | — |
| B2 | **camara** (`www.camara.cl`) | literal `https://www.camara.cl/legislacion/ProyectosDeLey/proyectos_ley.aspx` | literal en código (ni builder ni columna) | — (buscador genérico, sin boletín) | → E-023 `app/app/proyecto/[boletin]/not-found.tsx:27` | — |

Tabla C: **sin fechas** (copy estático).

### 4.3 `/contraparte/[id]`

**Tipo:** ruta pública **dinámica** en el código, **404 entera en el deploy auditado**. El gate
`MONEY` es la **PRIMERA sentencia** de la page (`app/app/contraparte/[id]/page.tsx:50-52`, ANTES de
`await params` y de cualquier RPC o heading): con `MONEY_PUBLIC_ENABLED` distinto de `"true"` la
ruta sirve `not-found.tsx` y **no se filtra ni el `<h1>` ni un heading de carril al HTML**.
Toda la ruta lleva por tanto la marca literal **`no emitido en el deploy auditado`**.

Se inventaría igual porque **existe en el código** y es parte del denominador: su copy de fecha lo
audita **116**, y 115/125 necesitan saber que no deben perseguir estos links.

**Sujeto usado** (§1.5 — **degradación honesta**):

| sujeto | id | URL PROD | causa |
|--------|----|----------|-------|
| E — contraparte | **no elegido** | `no emitido en el deploy auditado` | `select count(*) from contrato` → **0** y `from aporte` → **0** (§1.5): no existe ninguna contraparte real en PROD que elegir, y la ruta 404ea por gate. **No se inventó ningún id.** La observación de §5 se hizo con un id de sonda sintético, no con un sujeto |

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03` en el 404 servido hoy. Con el gate ON, `→ C-04`
(breadcrumbs montados por `page.tsx:145`: `Inicio` → `/` y el nombre de la empresa **sin href**;
crumb 2 OMITIDO porque no existe listado de contrapartes). **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/` (breadcrumb) | → E-034 / `→ C-04` `app/app/contraparte/[id]/page.tsx:145` | — | **MONEY** (OFF) — `no emitido en el deploy auditado` | `/` |
| A2 | `buildHref(id, page ± 1)` (paginación de contratos) | → E-014 `app/components/contratos-por-contraparte.tsx:238,251` | **sí** (`#contratos`) | **MONEY** (OFF) — `no emitido en el deploy auditado` | misma ruta |
| A3 | `buildHref(id, page ± 1)` (paginación de aportes) | → E-016 `app/components/aportes-por-contraparte.tsx:290,303` | **sí** (`#aportes`) | **MONEY** (OFF) — `no emitido en el deploy auditado` | misma ruta |

**Ningún link entra a esta ruta desde fuera:** `grep -c 'href="/contraparte/'` en
`/parlamentario/D1165` y `/proyecto/14309-04` → **0** y **0** (§5). Es una ruta sin inbound.

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | otro (Mercado Público / ChileCompra) — **columna con 0 filas en PROD** (§3.3) | **columna** `RPC:agregado_por_contraparte` (rama contratos) ← `tabla.contrato.enlace` | `columna` (sin builder), vía `safeExternalHref` | `sourceUrl={c.enlace}` | **badge** → E-014 `app/components/contratos-por-contraparte.tsx:175,178` (§3.1.4 fila 5) | **MONEY** (OFF) — `no emitido en el deploy auditado` |
| B2 | otro (Servel) — **columna con 0 filas en PROD** (§3.3) | **columna** `RPC:agregado_por_contraparte` (rama aportes) ← `tabla.aporte.enlace` | `columna` (sin builder), vía `safeExternalHref` | `sourceUrl={a.enlace}` | **badge** → E-016 `app/components/aportes-por-contraparte.tsx:196,199` (§3.1.4 fila 2) | **MONEY** (OFF) — `no emitido en el deploy auditado` |

**Doble ausencia (§3.3.6 nº 5):** aunque MONEY se encendiera, `contrato.enlace` y `aporte.enlace`
tienen **0 filas** en PROD ⇒ el badge no emitiría `<a>`. Cero valor en perseguir B1/B2 desde 115.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | fecha de la orden de compra | `fechaCorta` | `RPC:agregado_por_contraparte.fecha_oc` ← `tabla.contrato.fecha_oc` — el hecho | no | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-014 `app/components/contratos-por-contraparte.tsx:135-136` |
| C2 | fecha de corte del dato | `fechaCorta` | `RPC:agregado_por_contraparte.fecha_corte` ← `tabla.contrato.fecha_corte` — corte de la fuente | no | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-014 `app/components/contratos-por-contraparte.tsx:138-139` |
| C3 | `Actualizado {hace X}` (por contrato) | `relativeTimeEs` + `esStale` | `RPC:agregado_por_contraparte.fecha_captura` ← `tabla.contrato.fecha_captura` (`:132`; tipado `fecha_captura: string` en `:80`) | **sí** | **sí** | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-014 `app/components/contratos-por-contraparte.tsx:175-176` |
| C4 | fecha del aporte | `fechaCorta` | `RPC:agregado_por_contraparte.fecha_aporte` ← `tabla.aporte.fecha_aporte` — el hecho | no | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-016 `app/components/aportes-por-contraparte.tsx:148-149` |
| C5 | fecha de corte del dato | `fechaCorta` | `RPC:agregado_por_contraparte.fecha_corte` ← `tabla.aporte.fecha_corte` — corte de la fuente | no | no | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-016 `app/components/aportes-por-contraparte.tsx:151-152` |
| C6 | `Actualizado {hace X}` (por aporte) | `relativeTimeEs` + `esStale` | `RPC:agregado_por_contraparte.fecha_captura` ← `tabla.aporte.fecha_captura` (`:147`; tipado `fecha_captura: string` en `:82`) | **sí** | **sí** | **MONEY** (OFF) — `no emitido en el deploy auditado` | → E-016 `app/components/aportes-por-contraparte.tsx:196-197` |

**Correspondencia badge ↔ tablas:** los 2 badges de la ruta —`contratos-por-contraparte:175`,
`aportes-por-contraparte:196`— aportan **B1, B2** en Tabla B y **C3, C6** en Tabla C.
Cero badges solo-C. (`E-060` recuerda que el match de `ProvenanceBadge` en
`app/app/contraparte/[id]/page.tsx:19` es un **comentario**, no un render.)

#### 4.3.b `app/app/contraparte/[id]/not-found.tsx`

Doble función: 404 por id inexistente/no-jurídica **y** 404 del gate OFF. Por diseño **no contiene
ningún heading MONEY ni dato de contraparte** (`not-found.tsx:4-10`). Es lo único que este deploy
sirve realmente en esta ruta.

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/` | → E-050 `app/app/contraparte/[id]/not-found.tsx:19` | — | siempre (es lo que se sirve con **MONEY** OFF) | `/` |

Tabla B: **sin links externos**. Tabla C: **sin fechas** (copy estático).

#### 4.3.c Nota de PII del inventario (T-113-02 / T-113-06)

Este documento cita **nombres de columna** de tablas con PII (`contrato.rut_proveedor`,
`aporte.donante_nombre`, `pii_contraparte_declaracion.enlace`, `lobby_contraparte.enlace`) porque el
nombre de la columna es metadato de esquema. **Sus VALORES nunca se citan.** En consecuencia el
inventario **no contiene** ningún RUT real, email, nombre de persona natural ni monto individual: las
queries de §3.3 devuelven sólo `split_part(<col>,'/',3)` (host) + `count(*)`, y §4.1-4.3 registran
la **expresión** del prop, jamás el valor de una fila.

**Excepción declarada — CERRADA en el Plan 05 (ronda 1).** Esta nota decía antes que §5 conservaba
verbatim, como *única* excepción, un id de sonda con forma de RUT (empresa sintética) en el comando
de observación del gate MONEY, y que ese era el único match del patrón de RUT en todo el archivo.
**Ya no hay excepción:** el Plan 05 sustituyó ese id por `c:sujeto-inexistente` (§0.7, hallazgo H2),
sin pérdida de poder probatorio — el gate es la PRIMERA sentencia de
`app/app/contraparte/[id]/page.tsx:50-52`, así que **cualquier** id 404ea (verificado el 2026-07-27
con ambos ids contra el deploy vivo: 404 y 404). Hoy
`grep -cE '[0-9]{7,8}-[0-9kK]' 113-INVENTARIO.md` → **0** en TODO el archivo, sin excepciones que
declarar.

### 4.4 /

_(la raíz del sitio; el header va sin comillas para que `check-inventario.sh` lo matchee con
`^### 4\.[0-9]+ /[[:space:]]*$` — la ruta `/` matchearía cualquier línea con `grep -F`.)_

**Tipo:** pública, **estática en el archivo pero `force-dynamic`** (`app/app/page.tsx:15`): el panel
de actualidad lee la RPC en cada request. **Sin `searchParams`** — la portada no acepta parámetros.

**Sujeto usado:** `—` (ruta sin sujeto; no depende de un id de §1).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/`

**Chrome:** `→ C-01` (footer), `→ C-02` (nav), `→ C-03` (wordmark). **Sin** `C-04` (no hay
breadcrumbs en la portada). **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/sobre` (accent tile "¿Cómo leer esto?") | → E-024 `app/app/page.tsx:110` (tile `asChild` sobre `BentoTile`, → E-046) | — | siempre | `/sobre` |
| A2 | `/buscar` (entry tile "Proyectos de ley") | → E-024 `app/app/page.tsx:146`, href literal en `ENTRY_CARDS` (`page.tsx:62`) | — | siempre | `/buscar` |
| A3 | `/parlamentarios` (entry tile "Parlamentarios 360") | → E-024 `app/app/page.tsx:146`, href literal en `ENTRY_CARDS` (`page.tsx:68`) | — | siempre | `/parlamentarios` |
| A4 | `/agenda` (entry tile "Agenda de la semana") | → E-024 `app/app/page.tsx:146`, href literal en `ENTRY_CARDS` (`page.tsx:74`) | — | siempre | `/agenda` |

**No es un href (registro explícito):** el `SearchBox` del hero es un `<form method="get"
action="/buscar">` (`app/components/search-box.tsx:89-92`) — navega a `/buscar` **sin emitir
`<a>`**. 114/125 no deben buscarlo como link; sí es una arista de navegación para 125 (E2E).

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | ninguna — **la ruta no emite ningún link externo propio** | — | — | — | — (los únicos externos visibles son el CC BY 4.0 y el `mailto:` del footer, `→ C-01`) | — |

**Cero `ProvenanceBadge` en esta ruta:** `grep -n "ProvenanceBadge" app/app/page.tsx
app/components/panel-actualidad.tsx app/components/bento/bento-tile.tsx` → **sin match**. Por eso
Tabla B queda sin filas de badge (la regla de badge DUAL se cumple por vacío).

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | `Fuente: {fuente} · datos al {fecha}` (tiles de agenda: `agenda_citacion`, `agenda_sala`) | `diaCalendarioCitacion` (`panel-actualidad.tsx:104`) — date-only medianoche UTC, **sin** conversión de zona | `RPC:actualidad_senales_panel.fecha_max` | **no** — es el máximo del **hecho** (citación/sesión), no el reloj de scraping | no | — | → E-055 `app/components/panel-actualidad.tsx:100-108,227` |
| C2 | `Fuente: {fuente} · datos al {fecha}` (resto de tiles: `velocity`, `urgencias`, `nuevos_ingresos`, `archivados`, `agrupacion_materia`) | `fechaCorta` (`panel-actualidad.tsx:107`) | `RPC:actualidad_senales_panel.fecha_max` | **no** — el hecho (`votacion.fecha` / `tramitacion_evento.fecha` agregados por la RPC 0066) | no | — | → E-055 `app/components/panel-actualidad.tsx:100-108,227` |
| C3 | `{supresion_causa} — en las fuentes consultadas al {fecha}` (tile suprimido) | mismo `rotuloFecha` que C1/C2 | `RPC:actualidad_senales_panel.fecha_max` | **no** | no | — | → E-055 `app/components/panel-actualidad.tsx:166,176-178` |

**Hallazgo de instanciación (corrección del plan, Rule 1 — evidencia por grep):** el plan anticipaba
`fecha_captura` en el módulo de actualidad. **En el deploy auditado `/` NO emite ninguna
`fecha_captura`.** Dos evidencias: (1) `grep -n "fecha_captura" app/components/panel-actualidad.tsx`
→ **sin match** (el contrato de 9 columnas de la RPC, `:35-45`, ni siquiera la trae); (2) el módulo
que **sí** tenía ese comportamiento, `actualidad-module.tsx` (**E-008**), es un **emisor huérfano**
(§3.0.1) — fue superseded por `panel-actualidad.tsx`. Consecuencia para **116**: en `/` no hay
ninguna fecha candidata a "fecha de captura mostrada como el hecho"; el riesgo de esta ruta es el
inverso — `fecha_max` es un **agregado** de la RPC y 116 debe verificar que la 0066 lo derive del
hecho y no del reloj.

**Hallazgo de catálogo (corrección, Rule 1):** el catálogo §3.0 lista **E-032**
(`estado-actual-block.tsx`) en las rutas `/proyecto/[boletin]` **y `/`**, y **E-046**
(`bento-tile.tsx`) como receptor de `href` desde **E-055**. Ambas son inexactas para esta ruta:
`grep -rn "EstadoActualBlock" app --include=*.tsx | grep -v "\.test\."` → el único call-site es
`app/app/proyecto/[boletin]/page.tsx:9,128`; y `PanelActualidad`/`TileSenal` montan `BentoTile`
**sin** prop `href` (`panel-actualidad.tsx:155`, `:288-292`) ⇒ el panel **no emite ningún link**.
Los `href` de bento tiles de `/` salen exclusivamente de E-024 (A1-A4). Registrado aquí por
evidencia de import; el catálogo se lee con esta corrección.

### 4.5 `/agenda`

**Tipo:** pública, **dinámica por `searchParams`** (`app/app/agenda/page.tsx`).

| searchParam | forma | validación | degradación |
|-------------|-------|-----------|-------------|
| `semana` | `YYYY-Www` | `parseISOWeek` (`page.tsx:75`) valida `\d{4}-W\d{2}` | ausente/malformado → semana ISO actual, **sin redirect** (T-06-10) |
| `q` | texto libre | `trim` + cap `MAX_QUERY_CHARS` (`page.tsx:78-79`) | `q` que matchea `BOLETIN_RE` → `redirect("/proyecto/{q}")` (`page.tsx:83-85`) |
| `camara` | `camara` \| `senado` | `parseCamaraFiltro` (`page.tsx:62-64`) | cualquier otro valor → `undefined` (ambas) |

**Sujeto usado:** `—` (ruta sin sujeto de §1; la semana se resuelve por `searchParams` o por reloj).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/agenda`

**GOTCHA LOCKED de fecha (registro, no corrección):** `citacion.fecha` y `sesion_sala.fecha` son
**date-only medianoche UTC** — la **parte fecha UTC ES el día chileno publicado por la fuente**.
Convertir a `America/Santiago` fabrica el día anterior (regresión live Phase 94). El contrato lo
codifican los helpers **`diaCalendario`** (`app/lib/dia-calendario.ts`: `diaCalendarioCitacion` /
`dayLabelCitacion`), documentado en `agenda/page.tsx:66-70` y `:432-436`. **El inventario REGISTRA
el origen; no convierte ninguna fecha.**

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/agenda` ("← Volver a la vista semanal") | → E-004 `app/app/agenda/page.tsx:119-120` | — | solo en la rama `buscando` (`q` no vacío) | `/agenda` |
| A2 | `/agenda?q={q}&camara={value}` (chips Ambas/Cámara/Senado) | → E-004 `app/app/agenda/page.tsx:171-172` (render `:178-180`) | — | solo en la rama `buscando`; 3 opciones, la activa lleva `aria-current` | `/agenda` |
| A3 | `/proyecto/{c.boletin}` (resultado de búsqueda) | → E-004 `app/app/agenda/page.tsx:267-268` | — | solo si la citación resultante trae `boletin` | `/proyecto/[boletin]` |
| A4 | `/buscar` (empty-state de la semana sin citaciones) | → E-004 `app/app/agenda/page.tsx:413-415` | — | solo si `citaciones.length === 0` | `/buscar` |
| A5 | `/agenda?semana={semanaIsoKey(prev)}` | → E-007 `app/components/week-nav.tsx:29-30` | — | solo en la vista semanal (no en `buscando`) | `/agenda` |
| A6 | `/agenda?semana={semanaIsoKey(next)}` | → E-007 `app/components/week-nav.tsx:40-41` | — | solo en la vista semanal | `/agenda` |
| A7 | `/proyecto/{boletin}` (tarjeta de citación) | → E-033 `app/components/citacion-card.tsx:129-130`, montada por `app/components/agenda-filtros.tsx:346-373` | — | solo si la citación tiene un `citacion_punto` con boletín (`primerBoletin`, `page.tsx:480-486`) | `/proyecto/[boletin]` |
| A8 | `/proyecto/{item.boletin}` (fila de la tabla de sala) | → E-018 `app/components/sala-table-section.tsx:93-94` | — | modo `available`; solo si el ítem de tabla trae boletín | `/proyecto/[boletin]` |

**No es un href:** el buscador de citaciones es un `<form role="search" action="/agenda"
method="get">` (`page.tsx:94`) y el filtro de cámara viaja como `<input type="hidden" name="camara">`
(`:103`). SSR-first: funciona sin JS y **no emite `<a>`**.

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | camara (`www.camara.cl`, 164) + senado (`web-back.senado.cl`, 125) — §3.3.3 | `tabla.citacion.enlace` | `columna` (sin builder), vía `safeExternalHref` | `sourceUrl: c.enlace ?? null` (`app/app/agenda/page.tsx:463`, re-hidratado en `agenda-filtros.tsx:373`) | **badge** → E-033 `app/components/citacion-card.tsx:140` | — |
| B2 | senado (`web-back.senado.cl`, 16) + camara (`www.camara.cl`, 2) — §3.3.3 | `tabla.sesion_sala.enlace` | `columna` (sin builder), vía `safeExternalHref` | `sourceUrl: s.enlace ?? null` (`app/app/agenda/page.tsx:504`) | **badge** → E-018 `app/components/sala-table-section.tsx:59` | — |
| B3 | camara (`www.camara.cl`) | literal `CAMARA_TABLA_PDF_URL = "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL"` (`app/lib/agenda-types.ts:84-85`) | literal en código (ni builder ni columna) | `camaraPdfUrl` (`page.tsx:627`) | → E-018 `app/components/sala-table-section.tsx:150-151` (`target="_blank" rel="noopener noreferrer"`) | — — **solo en modo `degraded`** (la Cámara no publica tabla estructurada) |

**Nota de B3 (gotcha LOCKED de agenda):** `prmId=0` **no** es un placeholder roto — es la **semana
vigente** del `verDoc.aspx` de la Cámara. El invariante declarado en `agenda-types.ts:82` exige que
coincida **verbatim** con el `CAMARA_TABLA_PDF_URL` del conector (`packages/agenda/src/connector-camara.ts`)
para que el link que ve el usuario sea exactamente el que el sistema validó.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | encabezado de día del listado (p. ej. `martes 22 de julio`) | `dayLabelCitacion` (**`diaCalendario`**, date-only UTC) | `tabla.citacion.fecha` | no (el hecho: el día citado) | no | — | → E-004 `app/app/agenda/page.tsx:439` (agrupación `:438`), render → `app/components/agenda-filtros.tsx:346-349` |
| C2 | día de la citación en resultados de búsqueda | `dayLabelCitacion` (**`diaCalendario`**) | `RPC:buscar_citaciones.fecha` ← `tabla.citacion.fecha` | no (el hecho) | no | — | → E-004 `app/app/agenda/page.tsx:257-258` |
| C3 | `Actualizado {hace X}` (por citación) | `relativeTimeEs` + `esStale` | `tabla.citacion.fecha_captura` (`page.tsx:461`) | **sí** | **sí** | — | → E-033 `app/components/citacion-card.tsx:140` |
| C4 | `Actualizado {hace X}` (por sesión de sala) | `relativeTimeEs` + `esStale` | `tabla.sesion_sala.fecha_captura` (`page.tsx:502`) | **sí** | **sí** | — | → E-018 `app/components/sala-table-section.tsx:59` |
| C5 | rango de cobertura declarada de la Cámara (`{min}` – `{max}`) | `diaCalendarioCitacion` (**`diaCalendario`**) | `tabla.citacion.fecha` (min y max vía `.order().limit(1)`, `page.tsx:305-315,334-335`) | no (extremos del hecho) | no | — | → E-004 `app/app/agenda/page.tsx:334-335` → `app/components/agenda-cobertura.tsx` |
| C6 | rótulo de la semana (`weekLabel`) | `formatWeekLabel` (`app/lib/week-utils.ts`) | **derivado del `searchParam` `semana`** (o del reloj si ausente) — **no** viene de la DB | no | no | — | → E-004 `app/app/agenda/page.tsx:560`, consumido por E-018 `sala-table-section.tsx` |

**Correspondencia badge ↔ tablas:** los 2 badges de la ruta —`citacion-card:140`,
`sala-table-section:59`— aportan **B1, B2** en Tabla B y **C3, C4** en Tabla C. Cero badges solo-C.

### 4.6 `/buscar`

**Tipo:** pública, **dinámica por `searchParams`** (`app/app/buscar/page.tsx`).

| searchParam | forma | validación | degradación |
|-------------|-------|-----------|-------------|
| `q` | texto libre | `trim` + cap `MAX_QUERY_CHARS` = 300 (`page.tsx:47`, `lib/buscar.ts:58`) | `q` vacío → prompt sin lista ni error (`page.tsx:72-76`); `q` que matchea `BOLETIN_RE` → `redirect("/proyecto/{q}")` (`page.tsx:52-54`) |
| `page` | entero | `clampPage` (`page.tsx:37`): `[1, MAX_PAGE]` | no parseable → `1` |

**Sujeto usado:** `—` (ruta sin sujeto de §1; los resultados dependen de `q`).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/buscar?q=...`

**COMENTARIO LOCKED de fecha (registro literal, T-88-10):** el **año** que muestra cada tarjeta sale
de **`min(tramitacion_evento.fecha)`** (evento de ingreso) y **JAMÁS de `fecha_captura`**. El código
lo declara verbatim en `app/app/buscar/page.tsx:160`: *"T-88-10: año solo de min(fecha) de
tramitacion_evento; JAMÁS de fecha_captura"*. La derivación filtra fechas no parseables **antes** de
tomar el mínimo (`:196`, WR-03) y prefiere el evento de tipo ingreso (`:200`).

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/agenda` (empty-state "Sin resultados") | → E-017 `app/app/buscar/page.tsx:119-120` | — | solo si `pageSlice.length === 0` | `/agenda` |
| A2 | `/buscar?q={q}&page={page - 1}` | → E-017 `app/app/buscar/page.tsx:263` | — | solo si `page > 1` (el botón inexistente no se emite) | `/buscar` |
| A3 | `/buscar?q={q}&page={page + 1}` | → E-017 `app/app/buscar/page.tsx:272` | — | solo si `hayMas` | `/buscar` |
| A4 | `/proyecto/{boletin}` (título de cada tarjeta) | → E-028 `app/components/search-result-card.tsx:79-80`, montada por `app/components/buscar-filtros.tsx:481` | — | una por resultado de la página | `/proyecto/[boletin]` |

**No es un href:** `SearchBox` es un `<form method="get" action="/buscar">`
(`app/components/search-box.tsx:89-92`); las *pills* de ejemplo de `/` también navegan por form, no
por `<a>`.

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | senado (`tramitacion.senado.cl`, 3658) + camara (`opendata.camara.cl`, 1) — §3.3.3 | `tabla.proyecto.enlace` — **CRUDO, sin `enlaceHumanoProyecto`** | `columna` (sin builder), vía `safeExternalHref` | `sourceUrl: row.enlace ?? null` (`app/components/buscar-filtros.tsx:493`, alimentado por `app/app/buscar/page.tsx:237`) | **badge** → E-028 `app/components/search-result-card.tsx:93` | — |

**Hallazgo rector para 115 (registro, no corrección):** `/buscar` es la **única** superficie que
pasa `proyecto.enlace` al badge **sin** el rewrite de `enlaceHumanoProyecto` (§3.2 nº 3). En
`/proyecto/[boletin]` el mismo valor pasa por `ficha-header.tsx:70-73` y se convierte en
`buildSenadoUrl(boletin)`; aquí llega **verbatim**. Como **3.658** de las 3.659 filas de
`proyecto.enlace` apuntan a `tramitacion.senado.cl/wspublico/...` (XML crudo, ilegible para
humanos), el "fuente oficial ↗" de cada tarjeta de resultado apunta hoy al XML. **Candidato #2 de
115** (junto a `tramitacion_evento.enlace`, §3.3.6 nº 4). Esta fase **no lo arregla**.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | chip de **año** del proyecto (`{anio}` o `Sin dato`) | `deriveAnio` sobre `min(fecha)` (año entero, no `Intl`) | **`min(tabla.tramitacion_evento.fecha)`** — evento de ingreso; **JAMÁS `fecha_captura`** (`page.tsx:160`) | **no** — y está prohibido que lo sea | no | — | → E-028 `app/components/search-result-card.tsx:68-77`; derivación en `app/app/buscar/page.tsx:188-200,231` |
| C2 | `Actualizado {hace X}` (por resultado) | `relativeTimeEs` + `esStale` | `tabla.proyecto.fecha_captura` (`page.tsx:237` → `buscar-filtros.tsx:491`) | **sí** | **sí** | — | → E-028 `app/components/search-result-card.tsx:93` |

**Correspondencia badge ↔ tablas:** el único badge de la ruta —`search-result-card:93`— aporta
**B1** en Tabla B y **C2** en Tabla C. Cero badges solo-C.

### 4.7 `/comparar`

**Tipo:** pública, **dinámica por `searchParams`** (`app/app/comparar/page.tsx`). Los ids `a` y `b`
se validan contra **`PARLAMENTARIO_ID_RE`** (`page.tsx:187`, importado de `lib/buscar.ts`) **ANTES**
de cualquier `.rpc()` — un id que no matchea se descarta sin tocar la DB.

**Sujetos usados** (§1, ids verbatim):

| sujeto | id | URL PROD | qué ejercita |
|--------|----|----------|--------------|
| A — diputado | `D1165` | `https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=S1338` | columna A con datos en los 4 ejes no-gated |
| B — senador | `S1338` | `https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1165&b=S1338` | columna B con **ausencias declaradas** (0 comisiones, 0 lobby) |

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | **ninguno propio** — la ruta emite **0 hrefs** fuera del chrome | → E-051 `app/app/comparar/page.tsx` (0 hrefs); `grep -n "href=\|<Link" app/components/comparar-selector.tsx app/components/relaciones-eje-comparar.tsx app/components/similitud-votacion-comparar.tsx` → **sin match** | — | — | — |

**No es un href:** `CompararSelector` navega por `searchParams` (`?a=`/`?b=`), no por `<a>`. La
entrada a esta ruta viene de `/parlamentario/[id]` (`A1` de §4.1, `/comparar?a={id}`).

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | ninguna — **la ruta no emite ningún link externo propio** | — | — | — | — (los externos visibles son el CC BY 4.0 y el `mailto:` del footer, `→ C-01`) | — |

**Cero `ProvenanceBadge` en esta ruta:** la procedencia de cada eje se emite como **micro-texto**
(`provenance: string`, `relaciones-eje-comparar.tsx:52-53,79-80`), no como badge ⇒ **cero
`sourceUrl`** y cero links externos. La regla de badge DUAL se cumple por vacío.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | `En las fuentes consultadas al {fecha}` (ejes Militancia, Co-autoría, Zona y todos los empty-states) | `Intl.DateTimeFormat("en-CA")` (`page.tsx:54-55`) | **reloj del request** (`force-dynamic`), **no** una columna de la DB | **no** — es fecha de **consulta**, no de captura ni el hecho | no | — | → E-051 `app/app/comparar/page.tsx:234,279,283,344,361,381,428,463,486` |
| C2 | `Fuente: Cámara/Senado · según fuente al {fecha}` (eje Comisiones) | `String(...).slice(0,10)` sobre el **máximo** de las filas de A y B | `RPC:comisiones_de_parlamentario.fecha_captura` (`page.tsx:318-322`) | **sí** | no — micro-texto del eje | — | → E-051 `app/app/comparar/page.tsx:323-325` |
| C3 | `Fuente: votaciones de Cámara y Senado · según fuente al {fecha}` (eje Similitud de votación) | `String(...).slice(0,10)` (`page.tsx:524-525`) | **`RPC:coincidencia_votos_par.fecha_captura_max`** (agregado del **par**; contrato tipado en `page.tsx:556`) | **sí** — es `fecha_captura` (máxima del par) | no — micro-texto del eje | **VSIM** (ON, §5) | → E-051 `app/app/comparar/page.tsx:524-533` → `app/components/similitud-votacion-comparar.tsx:132-135` |
| C4 | `Cobertura del voto: … solo votaciones registradas en las fuentes al {fecha}` (nota de cobertura del eje VSIM) | `Intl.DateTimeFormat("en-CA")` (heredado de `fechaConsulta`) | **reloj del request** | no (fecha de consulta) | no | **VSIM** (ON) | → E-051 → `app/components/similitud-votacion-comparar.tsx:55-56,105` |

**Nota LOCKED de C3 (§102-REVIEW, registrada verbatim en el código):** el copy dice **"según fuente
al {fecha}"** y **no** "captura al {fecha}" — la palabra "captura" pelada está vetada por el guard
de vocabulario (`similitud-votacion-comparar.tsx:124-131`). Sigue siendo, semánticamente, la
`fecha_captura` máxima del par: por eso C3 se marca **`sí`** en la columna *¿es fecha_captura?*.

**Nota de gate:** con `VSIM` OFF, `page.tsx:502` devuelve **antes** del `.rpc("coincidencia_votos_par")`
⇒ C3/C4 llevarían la marca `no emitido en el deploy auditado`. En el deploy auditado **VSIM está ON**
(§5, evidencia: el `<h2>` "Similitud de votación" está presente), así que se emiten.

### 4.8 `/parlamentarios`

**Tipo:** pública, **dinámica por `searchParams`** (`app/app/parlamentarios/page.tsx`).

| searchParam | forma | validación | degradación |
|-------------|-------|-----------|-------------|
| `q` | texto libre | `trim` + cap `MAX_QUERY_CHARS` (`page.tsx:47`) + `maxLength` en el input (`:81`) | filtro en memoria por `nombre.toLowerCase().includes(needle)` (`:127-129`); sin match → empty honesto (`:132-142`) |
| `camara` | `diputados` \| `senado` | filtro server sobre la columna NOT NULL (`page.tsx:124`) | ausente → ambas cámaras |

**Sujeto usado:** `—` (la ruta lista el universo completo; no depende de un id de §1). Los sujetos A
(`D1165`) y B (`S1338`) aparecen aquí como **destinos** de A1.
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/parlamentarios`

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/parlamentario/{p.id}` (**la fila entera es el anchor**, WR-04) | → E-012 `app/components/parlamentario-directory-row.tsx:40`, montada por el island `ParlamentariosFiltro` (`page.tsx:146-149`) | — | una por fila del slice ya filtrado (cámara + `q`) | `/parlamentario/[id]` |

**No es un href:** el filtro server es un `<form action="/parlamentarios" method="get">`
(`page.tsx:69-71`); el filtro por partido es un island **en memoria** que **nunca** re-consulta
Supabase (contrato FichaRail, `page.tsx:145-146`).

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | ninguna — **link desactivado a propósito** (mismo caso que B10 de §4.1) | `RPC:parlamentarios_publico_v2.partido` ← URIs `datos.bcn.cl/.../partido-politico/{slug}` (48 filas, §3.3.3) | **`partidoLegible`** (§3.2 nº 4): **NO construye link**, extrae el slug en Title Case | — | → E-019 `app/components/partido-chip.tsx:60` (`partidoLegible(partido)`) | — (invariante **"CERO URI en el DOM"**) |

**Cero `ProvenanceBadge` renderizado en esta ruta.** El comando
`grep -n "ProvenanceBadge" app/app/parlamentarios/page.tsx
app/components/parlamentario-directory-row.tsx app/components/partido-chip.tsx` devuelve **un (1)
match**, y es un **comentario, no un render**: `partido-chip.tsx:27` documenta que el subtexto
"según {fuente} al {fecha}" vive en un Tooltip Radix *"(idiom ProvenanceBadge)"* — es decir, el chip
**imita el idiom** sin importar ni montar el componente. Verificación que separa mención de uso:
`grep -n "import.*ProvenanceBadge\|<ProvenanceBadge" <los 3 archivos>` → **sin match** (cero import,
cero JSX).

⚠️ Precisión introducida en el Plan 05 (ronda 1 del validador Opus): la redacción anterior decía
"→ **sin match**" a secas, lo cual era **falso a nivel del comando** aunque la conclusión fuese
correcta. Se corrige el comando, no la conclusión.

La procedencia del chip viaja en `title`/`aria-label` (`partido-chip.tsx:74`), **no** en un badge ⇒
cero `sourceUrl` y cero links externos emitidos. Regla de badge DUAL cumplida por vacío.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | `según {fuente} al {fecha}` (procedencia del chip de partido, en `title` + `aria-label`) | `fechaCorta` (`partido-chip.tsx:64-68`) | `RPC:parlamentarios_publico_v2.partido_fecha_captura` (pasada como prop en `parlamentario-directory-row.tsx:48`) | **sí** | **no** — el chip la formatea por su cuenta (variante `tooltip={false}`, plana) | — | → E-019 `app/components/partido-chip.tsx:64-74` |

**Nota (degradación honesta):** sin `partido_fecha_captura` el chip muestra `según {fuente}` a secas
(`partido-chip.tsx:71-73`) — **jamás fabrica una fecha**. Y sin `partido` legible el chip **no se
renderiza** (`:61`), en vez de mostrar un URI.

### 4.9 `/red`

**Tipo:** pública, **dinámica** (`app/app/red/page.tsx`, `export const dynamic = "force-dynamic"`).
Gate **`NET`** como **PRIMERA sentencia** (`page.tsx:52-54`, ANTES de `searchParams` y de cualquier
RPC/heading): con `NET` OFF la ruta **entera** sirve `not-found.tsx` y **cero DOM de NET** se filtra.
En el deploy auditado **NET está ON** (§5), así que la superficie se emite.

| searchParam | forma | validación | degradación |
|-------------|-------|-----------|-------------|
| `seed` | id de parlamentario | `PARLAMENTARIO_ID_RE` **antes** de tocar la DB (paso 4 del gate, `page.tsx:24-26`) | ausente → **selector** server-rendered JS-free (`<form action="/red">`, `:90-129`); inválido → `notFound()` |

**Sujetos usados** (§1): `D1165` (con vecindario de lobby) y `S1338` (**0 lobby confirmado** ⇒
ejercita el grafo vacío como **estado honesto**, nunca un error).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/red?seed=D1165`

**Chrome:** `→ C-01`, `→ C-02` (el ítem `/red` del nav **sí** se emite con NET ON), `→ C-03`.
**Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/red?seed={vecinoId}` ("Ver la red de esta persona →") | → E-011 `app/components/red/red-graph.tsx:210` | — | **NET** (ON) — una por vecino con detalle abierto | `/red` |
| A2 | `/parlamentarios` (empty-state de grafo sin aristas) | → E-011 `app/components/red/red-graph.tsx:435-436` | — | **NET** (ON) — solo si `aristas.length === 0` (rama del sujeto **B**, `S1338`) | `/parlamentarios` |

**No es un href:** el selector de semilla es un `<form method="get" action="/red">` con
`<select name="seed">` agrupado por cámara (`page.tsx:90-129`). Es deliberadamente JS-free y **no
emite `<a>`**; además **nunca** se consulta el grafo entero (`subgrafo_red` exige semilla — evita
enumeración de todos los nodos).

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | camara (`www.camara.cl`, **7394** filas — §3.3.3) | `RPC:subgrafo_red` → arista `enlace` ← `tabla.arista.enlace` | `columna` (sin builder), vía `safeExternalHref` (`red-graph.tsx:159`) | `href={enlaceSeguro}` con el texto `Ver fuente oficial ↗` (`:194-201`) | → E-011 `app/components/red/red-graph.tsx:159,189-205` | **NET** (ON) |

**Degradación:** si `safeExternalHref` devuelve `null` la fila de procedencia del enlace **no se
emite** (`red-graph.tsx:189`), igual que en el badge (§3.1.2) — nunca un href roto. Nótese que `/red`
**no** usa `ProvenanceBadge`: emite su propia `<dl class="net-prov">` con Fuente / Periodo /
Registro / Licencia + enlace (`:167-205`). Por eso su fila B1 **no** tiene contraparte en Tabla C
vía badge, y la regla de badge DUAL no aplica aquí.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | ventana del hecho: `entre {desde} y {hasta}` / `el {d}` / `desde {d}` / `hasta {d}` | **`fechaLiteral`** (`app/components/red/arista-hecho.tsx:15-20`): toma la parte `yyyy-mm-dd` **verbatim**, sin reinterpretar zona | `RPC:subgrafo_red` → arista `desde` / `hasta` ← `tabla.arista.desde` / `.hasta` | no — es la ventana del **hecho** (audiencia de lobby) | no | **NET** (ON) | → E-011 `app/components/red/red-graph.tsx:158,166-168`, `:180-183` (fila `Periodo`) |

**Nota de método:** `/red` es la única superficie que formatea fechas **sin** `Intl` ni `fechaCorta`:
`fechaLiteral` extrae la parte de fecha con un regex y la muestra tal cual (`arista-hecho.tsx:17-19`).
116 debe tratarla como un formatter propio, no asumir el pipeline común.

#### 4.9.b `app/app/red/not-found.tsx`

Sirve **dos** casos: el 404 del gate `NET` OFF y una semilla inválida
(`PARLAMENTARIO_ID_RE`). Por diseño **no contiene ningún heading ni dato de NET** (cero filtración
de DOM mientras el gate está OFF). Renderiza el chrome (`C-01`..`C-03`; **sin** breadcrumbs) más un
único link.

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/` | → E-047 `app/app/red/not-found.tsx:19` | — | siempre | `/` |

Tabla B: **sin links externos**. Tabla C: **sin fechas** (copy estático).

### 4.10 `/metodologia`

**Tipo:** pública, **estática** (`app/app/metodologia/page.tsx`, copy fijo con
`export const metadata` en `:15`). **Sin `searchParams`, sin lectura de DB**
(`grep -n "rpc(\|from(" app/app/metodologia/page.tsx` → **sin match**).

**Sujeto usado:** `—`.
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/metodologia`

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.** Nótese que el
footer (`C-01`) ya emite `/metodologia`, `/sobre`, el CC BY 4.0 y el `mailto:`; abajo solo van los
links **propios de la página**.

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/` ("Volver al inicio") | → E-025 `app/app/metodologia/page.tsx:129` | — | siempre | `/` |

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | otro (Creative Commons) | literal `https://creativecommons.org/licenses/by/4.0/deed.es` | literal en código (ni builder ni columna) | — | → E-025 `app/app/metodologia/page.tsx:93` | — |
| B2 | otro (`mailto:`, no es http) | literal `mailto:contacto@observatoriocongreso.cl` — **buzón institucional público**, no PII de persona natural | literal en código | — | → E-025 `app/app/metodologia/page.tsx:119` | — |

**Nota:** B1 duplica en la página el link de licencia que el footer ya emite (`C-01` nº 1) — es un
link **propio** de esta página (distinta línea, distinto emisor) y por eso se registra aquí; no es
una repetición de chrome. Es el mismo caso de B2 con el `mailto:`.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | ninguna — **copy estático, cero fechas renderizadas** | — | — | — | — | — | → E-025 `app/app/metodologia/page.tsx` (`grep` de formatters → sin match) |

### 4.11 `/sobre`

**Tipo:** pública, **estática** (`app/app/sobre/page.tsx`, `export const metadata` en `:14`). **Sin
`searchParams`, sin lectura de DB.**

**Sujeto usado:** `—`.
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/sobre`

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | `/buscar` | → E-009 `app/app/sobre/page.tsx:62` | — | siempre | `/buscar` |
| A2 | `/agenda` | → E-009 `app/app/sobre/page.tsx:70` | — | siempre | `/agenda` |
| A3 | `/parlamentarios` | → E-009 `app/app/sobre/page.tsx:78` | — | siempre | `/parlamentarios` |
| A4 | `/` ("Volver al inicio") | → E-009 `app/app/sobre/page.tsx:107` | — | siempre | `/` |

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | otro (Creative Commons) | literal `https://creativecommons.org/licenses/by/4.0/deed.es` | literal en código (ni builder ni columna) | — | → E-009 `app/app/sobre/page.tsx:94` | — |

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | ninguna — **copy estático, cero fechas renderizadas** | — | — | — | — | — | → E-009 `app/app/sobre/page.tsx` (menciona "fecha" en prosa, `:33,52`, sin renderizar ninguna) |

### 4.12 `/cuenta`

**Naturaleza:** **auth (OTP por email)** — no es una superficie de datos públicos. Se inventaría
porque está en el universo LOCKED del CONTEXT, marcando su naturaleza.
**Gate:** **`NOTIF`** (**OFF** en el deploy auditado, §5). El gate es la **primera** decisión tras
leer `searchParams` (`app/app/cuenta/page.tsx:106-115`) y devuelve un `<main>` con el `H1` + el copy
`NO_INDISPONIBLE`; **no** hay `notFound()` (la ruta responde 200 con un estado honesto, nunca 404).
⇒ **Toda la superficie de datos de esta ruta lleva la marca `no emitido en el deploy auditado`.**

**Sujeto usado:** `—` (ruta de sesión; no depende de ningún id de §1).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/cuenta`

**REGLA DE PRIVACIDAD APLICADA (T-113-08):** este documento **no registra ningún email**. El campo
`email` se cita como **nombre de input/columna** (`page.tsx:152-154`, `:171-173`), jamás un valor.
El código mismo lo prohíbe: *"NUNCA renderizar el email crudo ni el token"* (`page.tsx:27`).

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | **ninguno propio** — la ruta emite **0 hrefs** fuera del chrome | → E-052 `app/app/cuenta/page.tsx` (`grep -n "href=\|<Link" app/app/cuenta/page.tsx` → **sin match**) | — | **NOTIF** (OFF) — con el gate ON tampoco emitiría links: la interacción es por Server Actions | — |

**No es un href:** login y baja son `<form action={serverAction}>` con Server Actions
(`page.tsx:129-141`, `:313` `accionBaja`). **Inbound:** el único link *hacia* esta ruta es
`/cuenta?next=...` desde `SeguirButton` (→ E-039, §4.1 A1 8), que con **NOTIF OFF** tampoco se emite.

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | ninguna — **la ruta no emite ningún link externo propio** | — | — | — | — (los externos visibles son los del footer, `→ C-01`) | **NOTIF** (OFF) — `no emitido en el deploy auditado` |

**Cero `ProvenanceBadge`:** `grep -n "ProvenanceBadge" app/app/cuenta/page.tsx` → sin match.

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | `Consentimiento registrado el {fecha}` | `fechaCorta` **local** (`Intl.DateTimeFormat("en-CA")`, `page.tsx:90-96`) — homónimo del helper de `lib/format`, definido en la propia página | `tabla.consentimiento.created_at` (`page.tsx:215-217`) | no — es el **acto del usuario** (aceptación), no scraping | no | **NOTIF** (OFF) — `no emitido en el deploy auditado` | → E-052 `app/app/cuenta/page.tsx:282` |
| C2 | `Suscrito el {fecha}` (por suscripción) | mismo `fechaCorta` local | `tabla.suscripcion.created_at` (`page.tsx:210-213`) | no — el acto del usuario | no | **NOTIF** (OFF) — `no emitido en el deploy auditado` | → E-052 `app/app/cuenta/page.tsx:310` |

**Nota para 116:** C1 y C2 son las **únicas** fechas del sitio que describen un acto del **usuario**
(no de la fuente gubernamental). No son `fecha_captura` ni "el hecho legislativo": son datos
personales de la propia cuenta. Con **NOTIF OFF** ninguna se emite hoy.

### 4.13 `/notificaciones/baja`

**Naturaleza:** **token-based** (login-less) + **`noindex`**. `export const metadata = { robots:
{ index: false, follow: false } }` (`app/app/notificaciones/baja/page.tsx:35-36`).
**Gate:** ninguno a nivel de ruta — la página responde 200 siempre; con **NOTIF OFF** la feature es
**inerte** (§5: nadie recibe el digest que emite estos links, así que en la práctica el token no
existe). Se marca la superficie útil como `no emitido en el deploy auditado`.

**Sujeto usado:** `—` (ruta de token; **no se eligió ni se inventó ningún token**).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/notificaciones/baja?t=<token>` —
el placeholder `<token>` es literal; **este documento no contiene ningún token real ni de ejemplo**.

**Mecanismo de token (descripción, cero secretos — T-113-08):** el `?t=` viaja **crudo en el link**
y **nunca** se persiste crudo. Dos formas conviven (`page.tsx:12-27,71-90`):

| forma | verificación | lookup en DB |
|-------|--------------|--------------|
| token **por-usuario** (el que emite el digest) | firma **HMAC** con `NOTIF_TOKEN_SECRET` vía `verifyUserBajaToken` — **fail-loud** si falta el secreto | **ninguno** — no hay búsqueda por token |
| token **por-suscripción** (legado) | se **hashea** el `?t=` (`hashToken`) y se compara contra la columna | `tabla.suscripcion.baja_token_hash` (helper `service_role` dedicado) |

En DB vive **solo el hash**, jamás el token. Un token ausente / inválido / ya usado → copy
`Enlace no válido` (`page.tsx:110-116`), nunca un error ni una filtración.

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | **ninguno propio** — la ruta emite **0 hrefs** fuera del chrome | `grep -n "href=\|<Link" app/app/notificaciones/baja/page.tsx` → **sin match** | — | **NOTIF** (OFF) — feature inerte, `no emitido en el deploy auditado` | — |

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | ninguna — **la ruta no emite ningún link externo propio** | — | — | — | — (los externos visibles son los del footer, `→ C-01`) | **NOTIF** (OFF) — `no emitido en el deploy auditado` |

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | ninguna — **copy fijo (`OK_*` / `INVALID_COPY`), cero fechas renderizadas** | — | — | — | — | **NOTIF** (OFF) — `no emitido en el deploy auditado` | → `app/app/notificaciones/baja/page.tsx:92-118` |

**Dato mostrado (no es fecha):** con token válido por-suscripción la página muestra
`suscripcion.objetivo_id` (`page.tsx:88,102-105`) — un **id de parlamentario o boletín**, público
por definición. Cero PII.

### 4.14 `/notificaciones/confirmar`

**Naturaleza:** **token-based** (doble opt-in, login-less) + **`noindex`** (`export const metadata =
{ robots: { index: false, follow: false } }`, `app/app/notificaciones/confirmar/page.tsx:27-28`).
**Gate:** ninguno a nivel de ruta (responde 200; §5 verificó `/notificaciones/confirmar?token=x` →
**200** sin efecto útil). Con **NOTIF OFF** la superficie útil lleva `no emitido en el deploy
auditado`.

**Sujeto usado:** `—` (**no se eligió ni se inventó ningún token**).
**URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/notificaciones/confirmar?t=<token>`
— `<token>` es un placeholder literal.

**Mecanismo de token (descripción, cero secretos):** el `?t=` opaco viaja **crudo en el link** y en
DB vive **solo su hash**: se hashea con `hashToken` y se busca por `tabla.suscripcion.confirm_token_hash`
vía helper `service_role` (`page.tsx:11-18,59`). Además hay **ventana de expiración**
(`confirm_expira_at`) re-validada **en el write** (`marcarConfirmada`, `page.tsx:62-71`) para cerrar
la race entre lectura y update. Token ausente / inválido / expirado → copy `Enlace no válido`
(`page.tsx:88-94`).

**Chrome:** `→ C-01`, `→ C-02`, `→ C-03`. **Sin** `C-04`. **No se repiten aquí.**

#### Tabla A — links internos

| # | href (plantilla) | emisor (archivo:línea o → E-NNN) | ancla #id? | condicional/gate | ruta destino |
|---|------------------|----------------------------------|-----------|------------------|--------------|
| A1 | **ninguno propio** — la ruta emite **0 hrefs** fuera del chrome | `grep -n "href=\|<Link" app/app/notificaciones/confirmar/page.tsx` → **sin match** | — | **NOTIF** (OFF) — feature inerte, `no emitido en el deploy auditado` | — |

#### Tabla B — links externos

| # | fuente | plantilla o columna de origen | builder o `columna` | parámetro | emisor (archivo:línea o → E-NNN) | gate |
|---|--------|-------------------------------|---------------------|-----------|----------------------------------|------|
| B1 | ninguna — **la ruta no emite ningún link externo propio** | — | — | — | — (los externos visibles son los del footer, `→ C-01`) | **NOTIF** (OFF) — `no emitido en el deploy auditado` |

#### Tabla C — fechas

| # | etiqueta visible | formatter | origen (RPC.campo / tabla.columna) | ¿es fecha_captura? | ¿vía ProvenanceBadge? | gate | emisor |
|---|------------------|-----------|------------------------------------|--------------------|-----------------------|------|--------|
| C1 | ninguna — **copy fijo, cero fechas renderizadas**; `confirm_expira_at` se **usa** en la lógica pero **nunca se muestra** (`page.tsx:61-65`) | — | `tabla.suscripcion.confirm_expira_at` (**leída, no renderizada**) | no | no | **NOTIF** (OFF) — `no emitido en el deploy auditado` | → `app/app/notificaciones/confirmar/page.tsx:61-71` |

### 4.15 `/admin/revisar-entidades` — **EXCLUIDA**

| ruta | estado en el inventario | razón |
|------|-------------------------|-------|
| `/admin/revisar-entidades` (`app/app/admin/revisar-entidades/page.tsx`) | **EXCLUIDA** | **gated admin, no pública (decisión LOCKED del CONTEXT, §Alcance de rutas)**. Se **LISTA** para que el denominador de 15 rutas cierre, pero **no se inventaría**: cero Tabla A, cero Tabla B, cero Tabla C, cero enumeración de su superficie (mitigación T-113-04, ASVS V4 — no exponer el mapa de una superficie administrativa en un documento público) |

**Consecuencia para las fases consumidoras:** 114 / 115 / 116 / 122 / 125 **no** persiguen links,
fechas ni cruces de esta ruta. Su chrome sí la alcanza (§2 declara que `C-01`..`C-04` aplican a las
15 rutas), pero eso es una propiedad del layout, no una enumeración de la ruta.

**Lo único que se registra de ella** (metadato de esquema, no superficie): es la **única** ruta del
universo que **escribe** en la DB — `sb.rpc("resolver_entidad", …)` (`page.tsx:132`) y un
`fecha_captura` **fabricado en el momento de la revisión** (`new Date().toISOString()`,
`page.tsx:126`). Se anota porque 116 debe saber que existe una `fecha_captura` cuyo origen es el
**reloj del revisor**, no el scraping — y que **no se muestra en ninguna superficie pública**.

## 5. Gates y su estado

**Método:** estado **OBSERVADO** contra el deploy vivo el **2026-07-27**, con `curl -s` + grep del
HTML de superficies testigo (los sujetos de §1). **Prohibido copiar el estado de STATE.md** — el
research lo tenía como assumption A1 y aquí queda cerrada por evidencia.

**Deploy auditado:** base `https://observatorio-congreso.thevalis.workers.dev`, observada
`2026-07-27 23:04 UTC`. La respuesta incluye `x-opennext: 1` y `server: cloudflare`; **el
identificador de versión de Cloudflare NO se expone en los headers**, así que el deploy se ancla
por fecha/hora de observación, no por hash. (STATE menciona `e89b79af`; eso NO se usa como
evidencia aquí.)

Los **5 gates son server-only**: ninguno lleva prefijo `NEXT_PUBLIC_`, y cada módulo abre con
`import "server-only"` ⇒ **el flag jamás llega al bundle del navegador**. La única lectura de cada
env var es su función de gate (chokepoint); ninguna ruta lee `process.env.<FLAG>` crudo. Todos son
fail-closed: solo el literal `"true"` enciende (`env.X === "true"`).

| gate | env var | chokepoint (archivo:línea) | estado observado | evidencia (comando + resultado) | efecto en links/fechas |
|------|---------|----------------------------|------------------|---------------------------------|------------------------|
| NET | `NET_PUBLIC_ENABLED` | `app/lib/net-gate.ts:35-39` (`netPublicEnabled`) | **ON** | `curl -s "$B/" \| grep -o 'href="/red"' \| wc -l` → **1**; `curl -o /dev/null -w "%{http_code}" "$B/red"` → **200** | `/red` es superficie pública real; el ítem `/red` del nav (`header-nav.tsx:63`) SÍ se emite; el grafo emite links a fichas |
| CRUCES | `CRUCES_PUBLIC_ENABLED` | `app/lib/cruces-gate.ts:37-41` (`crucesPublicEnabled`) | **ON** | `curl -s "$B/proyecto/14309-04" \| grep -o '<section id="cruces"'` → **presente**; en `/parlamentario/D1165` la sección `id="cruces"` (rotulada "Lobby por sector", `count: 11`) → **presente** | los bloques de cruces emiten links y `ProvenanceBadge` (fecha de captura del FULL REBUILD diario) en ambas fichas |
| VSIM | `VSIM_PUBLIC_ENABLED` | `app/lib/vsim-gate.ts:33-37` (`vsimPublicEnabled`) | **ON** | `curl -s "$B/comparar?a=D1165&b=D1012" \| grep -o '<h2[^>]*>[^<]*</h2>'` → incluye **"Similitud de votación"**, con `1054 de 3609 votaciones compartidas (29%)` | `/comparar` emite el eje `coincidencia_votos_par` y su `fecha_captura_max` del par |
| MONEY | `MONEY_PUBLIC_ENABLED` | `app/lib/money-gate.ts:30-34` (`moneyPublicEnabled`) | **OFF** | `curl -o /dev/null -w "%{http_code}" "$B/contraparte/c:sujeto-inexistente"` → **404** (el id es un **placeholder sintético, jamás un RUT**: el gate es la PRIMERA sentencia de `page.tsx:50-52`, así que **cualquier** id 404ea idéntico — verificado 2026-07-27 con dos ids distintos, ambos **404**); `grep -c 'href="/contraparte/'` en `/parlamentario/D1165` y `/proyecto/14309-04` → **0** y **0**; la ficha emite en su lugar `<section id="financiamiento-pendiente" class="mt-12 opacity-60">` con el rótulo "Financiamiento y contratos" y `count: "pendiente"` | financiamiento / contratos / aportes **no emitidos en el deploy auditado**: cero links a `/contraparte/[id]`, cero links externos a mercadopublico/servel, cero fechas de esos bloques. La ruta `/contraparte/[id]` 404ea entera (gate como PRIMERA sentencia, `page.tsx:50-52`) |
| NOTIF | `NOTIF_PUBLIC_ENABLED` | `app/lib/notif-gate.ts:35-39` (`notifPublicEnabled`) | **OFF** | `curl -s "$B/parlamentario/D1165" \| grep -oic 'Seguir'` → **0** (el `SeguirButton` está ausente del DOM); `/notificaciones/confirmar?token=x` responde **200** pero sin efecto útil (feature inerte) | ningún botón de seguir ⇒ cero links de suscripción; `/cuenta` y `/notificaciones/*` existen como rutas pero no emiten superficie útil |

### 5.1 Convención LOCKED de la columna `gate`

- **Toda** fila de las secciones **3 (catálogo de emisores)** y **4 (las 15 rutas)** lleva una
  columna `gate` con valor de la **lista cerrada**: `—` | `NET` | `CRUCES` | `VSIM` | `MONEY` |
  `NOTIF`. `—` significa "sin gate: se emite siempre".
- Un bloque cuyo gate está **OFF se inventaría igual** (existe en el código y es parte del
  denominador), pero se marca con la cadena literal **`no emitido en el deploy auditado`**.
  Así 114/115/125 no persiguen links inexistentes y 116 sabe que existe copy de fecha bajo MONEY
  que hoy no se ve.
- Si una observación resultara ambigua, se registra `estado observado: indeterminado` con su causa.
  **Nunca se inventa el estado de un gate.** (En esta corrida ninguno quedó indeterminado: los 5
  se resolvieron por evidencia directa.)
- Consecuencia inmediata para el inventario: `/contraparte/[id]` (MONEY) es hoy una ruta **404** y
  `/admin/revisar-entidades` está **EXCLUIDA** por decisión LOCKED del CONTEXT — ninguna de las dos
  se presenta como superficie pública viva.

---

**Régimen (cierre):** Este documento inventaría; no corrige. Los fixes son 114 (links internos),
115 (patrones externos) y 117 (fechas). Los cruces son 122 y la verificación E2E contra DOM real es
125. Cualquier cambio de código motivado por un hallazgo de aquí pertenece a esas fases, no a 113.
