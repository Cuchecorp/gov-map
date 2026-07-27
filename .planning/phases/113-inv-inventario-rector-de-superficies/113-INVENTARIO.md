---
phase: 113
titulo: Inventario rector de superficies
deploy_auditado: "observado 2026-07-27 23:04 UTC (Cloudflare no expone id de versión en headers; ver §5)"
gates_observados: { NET: ON, CRUCES: ON, VSIM: ON, MONEY: OFF, NOTIF: OFF }
base_url: https://observatorio-congreso.thevalis.workers.dev
fecha_corrida: 2026-07-27
estado: en construcción
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

_(pendiente — Plan 04. Se llena con una fila por cada una de las 15 rutas + las 4 sub-superficies
`not-found.tsx`; sin celdas vacías, cero rutas sin evidencia.)_

| ruta | links enumerados por | fechas enumeradas por | sujeto usado | ¿exhaustivo o muestra? | evidencia |
|------|----------------------|-----------------------|--------------|------------------------|-----------|
| _(pendiente — Plan 04)_ | _(pendiente — Plan 04)_ | _(pendiente — Plan 04)_ | _(pendiente — Plan 04)_ | _(pendiente — Plan 04)_ | _(pendiente — Plan 04)_ |

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

_(pendiente — Plan 06. Traza los 25 call-sites de `ProvenanceBadge` y las 15 expresiones `sourceUrl=`
hasta su columna de origen. Se registra la EXPRESIÓN del prop y la columna, **nunca** valores de URL
de filas reales.)_

### 3.2 Builders de URL externa

_(pendiente — Plan 06. Los 4 builders de §0.3: `buildSenadoUrl`, `buildCamaraUrl`,
`enlaceHumanoProyecto`, `partidoLegible`.)_

### 3.3 Familias de URL-desde-columna

_(pendiente — Plan 06. Hosts por `split_part(...,'/',3)` + `count(*)` contra PROD, sin `select` de
la columna completa.)_

## 4. Las 15 rutas

_(pendiente — Plan 02/03/04)_

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
| MONEY | `MONEY_PUBLIC_ENABLED` | `app/lib/money-gate.ts:30-34` (`moneyPublicEnabled`) | **OFF** | `curl -o /dev/null -w "%{http_code}" "$B/contraparte/c:76000000-0"` → **404**; `grep -c 'href="/contraparte/'` en `/parlamentario/D1165` y `/proyecto/14309-04` → **0** y **0**; la ficha emite en su lugar `<section id="financiamiento-pendiente" class="mt-12 opacity-60">` con el rótulo "Financiamiento y contratos" y `count: "pendiente"` | financiamiento / contratos / aportes **no emitidos en el deploy auditado**: cero links a `/contraparte/[id]`, cero links externos a mercadopublico/servel, cero fechas de esos bloques. La ruta `/contraparte/[id]` 404ea entera (gate como PRIMERA sentencia, `page.tsx:50-52`) |
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
