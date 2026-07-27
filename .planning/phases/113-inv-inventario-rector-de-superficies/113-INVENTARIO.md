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

`app/components/provenance-badge.tsx` es un chokepoint **DUAL**. No es decoración: es a la vez el
único punto por donde pasa la fecha de captura y el **mayor emisor de links externos del sitio**.

#### 3.1.1 Cara A — fecha (`capturedAt`)

| propiedad | valor |
|-----------|-------|
| prop | `capturedAt: Date \| null` (`provenance-badge.tsx:21`) |
| formatter | `relativeTimeEs(capturedAt)` (`:52`) + `esStale(capturedAt)` (`:33`, umbral 48 h → amber) |
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
| C1 | `Actualizado {hace X}` (cabecera) | `relativeTimeEs` + `esStale` (48 h → amber) | `RPC:parlamentario_publico_v2.fecha_captura` | **sí** | **sí** | — | → E-059 `app/components/parlamentario-header.tsx:37,116` |
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
