---
phase: 113
titulo: Inventario rector de superficies
deploy_auditado: "pendiente — se registra en §5 tras observar el deploy"
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
| _(pendiente — Plan 04)_ | | | | | |

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

_(pendiente — Task 2 de este plan.)_

## 2. Chrome compartido

_(pendiente — Plan 02/03/04)_

## 3. Catálogo de emisores

_(pendiente — Plan 02/03/04)_

## 4. Las 15 rutas

_(pendiente — Plan 02/03/04)_

## 5. Gates y su estado

_(pendiente — Task 3 de este plan.)_
