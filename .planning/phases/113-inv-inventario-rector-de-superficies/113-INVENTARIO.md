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

_(pendiente — Plan 02/03/04)_

## 3. Catálogo de emisores

_(pendiente — Plan 02/03/04)_

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
