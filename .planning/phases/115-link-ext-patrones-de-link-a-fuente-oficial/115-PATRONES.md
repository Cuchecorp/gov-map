---
phase: 115
plan: 01
estado: borrador
---

# 115 — Universo de patrones de URL externa

## 0. Método y cobertura

**Universo** = §3.2 del inventario rector 113 (los **4 builders**) **+** las familias de
URL-desde-columna de §3.3.3 que **se emiten al DOM**. Nada más y nada menos: lo que la DB guarda
pero el DOM no muestra queda en §2 con su razón declarada.

**Regla de la fase (verbatim, decisión operador 2026-07-27):** validación **por construcción del
patrón** (plantilla + dato que la parametriza) **+ muestra estratificada ≥1 caso por patrón×host**;
**JAMÁS crawl exhaustivo**. Este documento cierra el denominador; la muestra live la corre el Plan 02.

**Ancla temporal.** `psql "$SUPABASE_DB_URL" -tA -c "select now()::date;"` → `2026-07-28`.
Los conteos `n` de §1 son los de §3.3.2 del inventario (`2026-07-27`) y se citan como tales; ninguna
cifra de este documento se re-inventa.

**Seguridad del método (heredada de 113, T-113-05/T-113-06).** Las queries de conteo devuelven sólo
`split_part(<col>,'/',3)` y `count(*)`. Para el **caso concreto** sí se lee el valor de la URL —es el
objeto de esta fase— pero únicamente de columnas **NO-PII**: prohibido `pii_contraparte_declaracion.*`
y toda columna de los dominios `infoprobidad/`, `servel/`, `money/`, `rut/`. `SUPABASE_DB_URL` se usa
como `psql "$SUPABASE_DB_URL" -tA -c ...` y **jamás** se ecoa ni se escribe.

**Orden LOCKED de la fase.** El `robots.txt` de cada host se pide **antes** que cualquier otro
recurso de ese host (artefacto `115-ROBOTS.txt`, Task 3). El runner impone ese orden por código.

### 0.1 Correcciones de partida (hallazgos de este plan)

**1. Ubicación de los builders.** El `115-CONTEXT.md` §Reusable Assets atribuye `enlaceHumanoProyecto`
a `app/lib/format.ts`. Lo real, verificado en el árbol:

- `buildSenadoUrl` → `app/components/validacion-fuente.tsx:60`
- `buildCamaraUrl` → `app/components/validacion-fuente.tsx:67`
- `enlaceHumanoProyecto` → `app/components/validacion-fuente.tsx:87`
- `partidoLegible` → `app/lib/format.ts:153-174` (**el único** de los cuatro que vive en `format.ts`)

El inventario 113 §3.2 ya lo tenía correcto; la desviación es del CONTEXT, y queda corregida aquí.

**2. Completitud del grep de §3.1.4.** El inventario enumeró call-sites con
`grep -rl "sourceUrl=" app/components app/app`, que sólo caza el **prop JSX**. El universo ampliado
(prop JSX **y** propiedad de objeto) se re-corrió verbatim:

```bash
grep -rn "sourceUrl[[:space:]]*[:=]" app/components app/app --include=*.tsx | grep -v "\.test\."
```

```text
app/components/agenda-filtros.tsx:373:                      sourceUrl: c.provenance.sourceUrl,
app/components/aportes-por-contraparte.tsx:199:          sourceUrl={a.enlace}
app/components/autor-row.tsx:64:        sourceUrl={enlaceHumanoProyecto(autor.enlace ..., autor.boletin) ... null}
app/components/buscar-filtros.tsx:493:                sourceUrl: row.enlace ?? null,
app/components/contratos-de-parlamentario.tsx:195:          sourceUrl={c.enlace}
app/components/contratos-por-contraparte.tsx:178:          sourceUrl={c.enlace}
app/components/cruces-de-parlamentario.tsx:197:                    sourceUrl={item.enlace_fuente}
app/components/cruces-de-proyecto.tsx:179:                sourceUrl={item.enlace_fuente}
app/components/ficha-header.tsx:70:          sourceUrl={
app/components/financiamiento-de-parlamentario.tsx:234:          sourceUrl={a.enlace}
app/components/lobby-de-parlamentario.tsx:212: * (`sourceUrl={a.enlace}`) es la fuente real y NO se toca — esto es solo el frame.
app/components/lobby-de-parlamentario.tsx:537:                  sourceUrl={a.enlace}
app/components/parlamentario-header.tsx:118:          sourceUrl={parlamentario.enlace ?? null}
app/components/patrimonio-de-parlamentario.tsx:446:            sourceUrl={version.enlace}
app/components/patrimonio-de-parlamentario.tsx:769:            sourceUrl={c.enlace}
app/components/provenance-badge.tsx:25:  sourceUrl: string | null;
app/components/proyectos-similares.tsx:109:            sourceUrl: enlaceHumanoProyecto(p.enlace ?? "", p.boletin) ... null,
app/components/votacion-card.tsx:101:            sourceUrl={
app/components/voto-ficha-row.tsx:136:          sourceUrl={voto.enlace ?? null}
app/components/voto-ficha-row.tsx:220:          sourceUrl={voto.enlace ?? null}
app/components/votos-por-parlamentario.tsx:547:                    sourceUrl={e.enlace ?? null}
app/app/agenda/page.tsx:463:        sourceUrl: c.enlace ?? null,
app/app/agenda/page.tsx:489:type SalaProvenance = { capturedAt: Date ... null; sourceName: string; sourceUrl: string ... null };
app/app/proyecto/[boletin]/page.tsx:404:          sourceUrl: null,
app/app/proyecto/[boletin]/page.tsx:506:            sourceUrl={null}
```

Nota de transcripción: las disyunciones lógicas de TypeScript y las uniones de tipo se sustituyeron
por `...` **sólo** en este bloque de código, para no introducir celdas vacías falsas en los gates de
tabla de este documento. El código en el árbol está intacto.

Call-sites que §3.1.4 **no** tenía y que este plan añade al universo:

| call-site | expresión | consecuencia |
|-----------|-----------|--------------|
| `app/components/buscar-filtros.tsx:493` | `sourceUrl: row.enlace ?? null` | **candidato #1**: pasa `proyecto.enlace` CRUDO, sin `enlaceHumanoProyecto` → patrón `P-27` |
| `app/components/proyectos-similares.tsx:109` | `sourceUrl: enlaceHumanoProyecto(p.enlace ?? "", p.boletin)` | SÍ pasa por el rewrite → cae bajo `P-03` rama-rewrite |
| `app/components/agenda-filtros.tsx:373` | `sourceUrl: c.provenance.sourceUrl` | re-transporte de `citacion.enlace` → `P-06`/`P-07` |
| `app/app/agenda/page.tsx:463` | `sourceUrl: c.enlace ?? null` | `citacion.enlace` → `P-06`/`P-07` |
| `app/app/agenda/page.tsx:504` | `sourceUrl: s.enlace ?? null` | `sesion_sala.enlace` → `P-20`/`P-21` |

El universo de esta fase es el **AMPLIADO**. La diferencia es de **denominador del grep**, no una
regresión del inventario: `grep -rl "sourceUrl="` es correcto para lo que buscaba (el prop JSX).

**3. Discrepancia 10-vs-11 en §3.3.5.** El encabezado de §3.3.3 dice *"Las **10** columnas con 0 filas
se listan en §3.3.5"*, pero la tabla de §3.3.5 trae **11** filas. Contadas nominalmente:
`actualidad_senal.enlace`, `aporte.enlace`, `contrato.enlace`, `contratista.enlace`,
`declaracion_familiar.enlace`, `donante.enlace`, `entidad_tercero.enlace`, `parlamentario_bio.enlace`,
`pii_contraparte_declaracion.enlace`, `vinculo_entidad.enlace`, `vinculo_identidad.enlace` → **11**.
El número correcto es **11** (el `10` del encabezado es un lapsus de redacción del inventario, no un
error de datos: 34 columnas descubiertas − 23 pares con `n > 0` agrupados en 23 familias ⇒ la tabla
de §3.3.5 es la que manda). **Esta fase usa 11.**

### 0.2 Hallazgo adicional — `cruce_senal.evidencia` no tiene la clave `enlace_fuente`

§3.1.4 filas 6-7 del inventario describen el prop `sourceUrl={item.enlace_fuente}` como
`cruce_senal.evidencia` jsonb, clave `enlace_fuente`. Medido en PROD:

```sql
select jsonb_object_keys(evidencia) from cruce_senal limit 20;
-- conteo
-- items
select count(*) from cruce_senal where evidencia ? 'enlace_fuente';
-- 0
```

Las claves de primer nivel de `evidencia` son `conteo` e `items`; `enlace_fuente` **no** es clave de
primer nivel (`0` filas). El origen real y medible de ese href es la columna
`cruce_senal.enlace` (**781** filas, `www.camara.cl`), que la RPC proyecta hacia el campo
`enlace_fuente` del registro que consume el componente. El patrón `P-10` se registra con ese origen.

## 1. Universo de patrones

Una fila por **patrón×host**. `n` = conteo de §3.3.2 del inventario (2026-07-27). `gate` = flag que
condiciona la emisión (`—` cuando no hay gate).

| id | origen | host | plantilla verbatim | parámetro que la instancia | emisor (E-NNN archivo:línea) | gate | caso real | n en PROD |
|----|--------|------|--------------------|----------------------------|------------------------------|------|-----------|----------:|
| P-01 | builder `buildSenadoUrl` (`app/components/validacion-fuente.tsx:60`) | `tramitacion.senado.cl` | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${encodeURIComponent(boletin)}` | `boletin` COMPLETO **con sufijo** (sin sufijo el Senado devuelve lista, no ficha) | E-027 `validacion-fuente.tsx:117` | — | `P-01-c01` boletín `10986-24` | 3658 (vía `proyecto.enlace`) |
| P-02 | builder `buildCamaraUrl` (`app/components/validacion-fuente.tsx:67`) | `www.camara.cl` | `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=${encodeURIComponent(prmId)}&prmBOLETIN=${encodeURIComponent(boletin)}` | `prmId` ← `proyecto.prm_id_camara` (**sólo si no es null**) + `boletin` | E-027 `validacion-fuente.tsx:119`, E-043 `ficha-header.tsx:82` | — | `P-02-c01` `prmID=11502` + `prmBOLETIN=10986-24` | 3659 proyectos, subconjunto con `prm_id_camara` no nulo |
| P-03 | builder `enlaceHumanoProyecto` **rama-rewrite** (`app/components/validacion-fuente.tsx:87`) | `tramitacion.senado.cl` | destino = `buildSenadoUrl(boletin)` (idéntica a P-01) cuando `hostname === "tramitacion.senado.cl"` **y** `pathname.includes("/wspublico/")` | `boletin` de la fila que acompaña al `enlace` crudo | E-035 `autor-row.tsx:64`, E-043 `ficha-header.tsx:71`, E-056 `votacion-card.tsx:102`, `proyectos-similares.tsx:109` | — | `P-03-c01` boletín `14309-04` | 24690 (3658 + 19983 + 1049) |
| P-03 | builder `enlaceHumanoProyecto` **rama-verbatim** (`app/components/validacion-fuente.tsx:87`) | host de la columna de origen (aquí `opendata.camara.cl`) | devuelve `enlace` **VERBATIM** en cualquier otro caso (host distinto, path sin `/wspublico/`, parseo fallido) | ninguno — passthrough del valor almacenado | mismos emisores que la rama-rewrite | — | `P-03-c02` `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin` | 3807 (1 + 3806) |
| P-04 | `partidoLegible` (`app/lib/format.ts:153-174`) | `datos.bcn.cl` | **NO construye link ni emite `<a>`**: extrae el slug de `datos.bcn.cl/.../partido-politico/{slug}` y devuelve el nombre en Title Case; nunca passthrough del URI | `parlamentario_militancia.enlace` (URI BCN) | E-019 `partido-chip.tsx`, E-054 `militancias-de-parlamentario.tsx` | invariante **CERO URI en el DOM** | **sin caso — no hay recurso que pedir**; se valida SÓLO por construcción | 48 |
| P-05 | `arista.enlace` | `www.camara.cl` | valor almacenado, emitido verbatim tras `safeExternalHref` | fila de `arista` | E-011 `red/red-graph.tsx:194` | **NET** | `P-05-c01` | 7394 |
| P-06 | `citacion.enlace` | `www.camara.cl` | valor almacenado verbatim | fila de `citacion` | E-033 `citacion-card.tsx`, E-004 `/agenda` (`agenda/page.tsx:463`, `agenda-filtros.tsx:373`) | — | `P-06-c01` | 164 |
| P-07 | `citacion.enlace` | `web-back.senado.cl` | valor almacenado verbatim | fila de `citacion` | E-033 `citacion-card.tsx`, E-004 `/agenda` | — | `P-07-c01` | 125 |
| P-08 | `comision.enlace` | `www.camara.cl` | valor almacenado verbatim | fila de `comision` | E-057 `comisiones-de-parlamentario.tsx` | — | `P-08-c01` | 34 |
| P-09 | `comision_membresia.enlace` | `www.camara.cl` | valor almacenado verbatim | fila de `comision_membresia` | E-057 `comisiones-de-parlamentario.tsx` | — | `P-09-c01` | 386 |
| P-10 | `cruce_senal.enlace` → proyectada por la RPC al campo `enlace_fuente` (ver §0.2) | `www.camara.cl` | valor almacenado verbatim | fila de `cruce_senal` | E-044 `cruces-de-parlamentario.tsx:197`, E-053 `cruces-de-proyecto.tsx:179` | **CRUCES** | `P-10-c01` | 781 |
| P-11 | `declaracion.enlace` (**agrupa las 7 tablas** `declaracion`, `declaracion_accion_derecho`, `declaracion_actividad`, `declaracion_bien_inmueble`, `declaracion_bien_mueble`, `declaracion_pasivo`, `declaracion_valor`) | `datos.cplt.cl` | valor almacenado verbatim | fila de la declaración (el badge usa el `enlace` de la versión) | E-005 `patrimonio-de-parlamentario.tsx:446,769` | — | `P-11-c01` | 9441 (1065 + 935 + 690 + 2841 + 1476 + 1820 + 614) |
| P-12 | `lobby_audiencia.enlace` | `www.camara.cl` | valor almacenado verbatim | fila de `lobby_audiencia` | E-002 `lobby-de-parlamentario.tsx:537` (mapeo `:601`) | — | `P-12-c01` | 17730 |
| P-13 | `lobby_audiencia.enlace` | `www.leylobby.gob.cl` | valor almacenado verbatim | fila de `lobby_audiencia` | E-002 `lobby-de-parlamentario.tsx:537` | — | `P-13-c01` | 32 |
| P-14 | `lobby_audiencia.enlace_detalle` | `www.leylobby.gob.cl` | valor almacenado verbatim | fila de `lobby_audiencia` | E-020 `lobby-menciones-de-boletin.tsx:111`, E-041 `lobby-en-tramitacion.tsx:124`, fallback de E-002 | — | `P-14-c01` | 32 |
| P-15 | `parlamentario.enlace` | `opendata.camara.cl` | valor almacenado verbatim | fila de `parlamentario` | E-059 `parlamentario-header.tsx:118` | — | `P-15-c01` | 155 |
| P-16 | `parlamentario.enlace` | `tramitacion.senado.cl` | valor almacenado verbatim (**no** pasa por `enlaceHumanoProyecto`) | fila de `parlamentario` | E-059 `parlamentario-header.tsx:118` | — | `P-16-c01` | 31 |
| P-17 | `proyecto.enlace` **post-rewrite** por `enlaceHumanoProyecto` | `tramitacion.senado.cl` | destino = `buildSenadoUrl(proyecto.boletin)` | `proyecto.boletin` | E-043 `ficha-header.tsx:70-73` | — | `P-17-c01` boletín `9301-14` | 3658 |
| P-18 | `proyecto.enlace` **verbatim** (host distinto ⇒ sin rewrite) | `opendata.camara.cl` | valor almacenado verbatim | fila de `proyecto` (boletín `15480-13`) | E-043 `ficha-header.tsx:70-73` | — | `P-18-c01` | 1 |
| P-19 | `proyecto_autor.enlace` **post-rewrite** por `enlaceHumanoProyecto` | `tramitacion.senado.cl` | destino = `buildSenadoUrl(proyecto_autor.boletin)` | `proyecto_autor.boletin` | E-035 `autor-row.tsx:64` | — | `P-19-c01` boletín `10986-24` | 19983 |
| P-20 | `sesion_sala.enlace` | `web-back.senado.cl` | valor almacenado verbatim | fila de `sesion_sala` | E-018 `sala-table-section.tsx` | — | `P-20-c01` | 16 |
| P-21 | `sesion_sala.enlace` | `www.camara.cl` | valor almacenado verbatim | fila de `sesion_sala` | E-018 `sala-table-section.tsx:151` | — | `P-21-c01` | 2 |
| P-22 | `tramitacion_evento.enlace` | `www.senado.cl` | valor almacenado verbatim (**esquema `http:`**, no `https:`) | fila de `tramitacion_evento` | E-038 `timeline-event.tsx:42` | — | `P-22-c01` | 5790 |
| P-23 | `tramitacion_evento.enlace` | `opendata.camara.cl` | valor almacenado verbatim | fila de `tramitacion_evento` | E-038 `timeline-event.tsx:42` | — | `P-23-c01` | 3797 |
| P-24 | `tramitacion_evento.enlace` | `tramitacion.senado.cl` | valor almacenado verbatim — **sin rewrite**, aunque el path es `/wspublico/` (§3.3.6 punto 4, candidato del inventario) | fila de `tramitacion_evento` | E-038 `timeline-event.tsx:42` | — | `P-24-c01` | 982 |
| P-25 | `votacion.enlace` **verbatim** (host distinto ⇒ sin rewrite) | `opendata.camara.cl` | valor almacenado verbatim | fila de `votacion` | E-056 `votacion-card.tsx:101-104`, E-058 `votos-por-parlamentario.tsx:547` | — | `P-25-c01` | 3806 |
| P-26 | `votacion.enlace` **post-rewrite** por `enlaceHumanoProyecto` | `tramitacion.senado.cl` | destino = `buildSenadoUrl(votacion.boletin)` | `votacion.boletin` | E-056 `votacion-card.tsx:101-104` | — | `P-26-c01` boletín `18384-08` | 1049 |
| P-27 | `proyecto.enlace` **CRUDO** en `/buscar` (`app/components/buscar-filtros.tsx:493`) | `tramitacion.senado.cl` | valor almacenado verbatim — **NO** pasa por `enlaceHumanoProyecto` (candidato #1 de la fase) | fila de resultado de búsqueda | `buscar-filtros.tsx:493` (call-site nuevo, §0.1 hallazgo 2) | — | `P-27-c01` | 3658 |

**Hosts emitidos (7):** `www.camara.cl`, `opendata.camara.cl`, `tramitacion.senado.cl`,
`www.senado.cl`, `web-back.senado.cl`, `www.leylobby.gob.cl`, `datos.cplt.cl`.
`datos.bcn.cl` es el octavo host de §3.3.2 pero **no se emite** (P-04 lo desactiva).

## 2. Exclusiones con razón

| origen | n | razón |
|--------|--:|-------|
| `lobby_contraparte.enlace` | 17681 | **no se emite al DOM**: la contraparte se muestra como texto crudo sin enlace (`lobby-de-parlamentario.tsx:272,289-290`). Columna presente en DB, cero hrefs |
| `source_snapshot.source_url` | 4383 | **no se emite al DOM**: su único call-site pasa `sourceUrl={null}` (`app/app/proyecto/[boletin]/page.tsx:404,506`; §3.1.4 fila 1). Alimenta `capturedAt` y el respaldo R2, nunca un `<a>` |
| `parlamentario_militancia.enlace` | 363 (`opendata.camara.cl` 315 + `datos.bcn.cl` 48) | **desactivadas por `partidoLegible`** (P-04): se renderiza el nombre legible del partido, jamás el URI. Cualquier URI BCN visible en el DOM sería una **regresión del invariante "CERO URI en el DOM"** |
| Las **11** columnas de §3.3.5 con **0** ocurrencias en PROD, de las cuales 4 son además dominio MONEY con gate OFF (`aporte.enlace`, `contrato.enlace`, `contratista.enlace`, `donante.enlace`) | 0 | sin filas ⇒ no hay URL que probar. Las 4 MONEY son un **subconjunto** de las 11, no un grupo adicional. Nota de §3.3.6 punto 5: **aunque el gate MONEY se encendiera, esas columnas están vacías, luego no habría link** |

Lista nominal de las 11: `actualidad_senal.enlace`, `aporte.enlace`, `contrato.enlace`,
`contratista.enlace`, `declaracion_familiar.enlace`, `donante.enlace`, `entidad_tercero.enlace`,
`parlamentario_bio.enlace`, `pii_contraparte_declaracion.enlace`, `vinculo_entidad.enlace`,
`vinculo_identidad.enlace`.

## 3. Casos reales — SQL verbatim

Todas las queries se corrieron con `psql "$SUPABASE_DB_URL" -tA -F '|' -f <archivo>` sobre PROD el
2026-07-28. `ORDER BY` determinista y `LIMIT 1` en todas. Salida inline bajo cada bloque.

```sql
-- P-01 (boletín para buildSenadoUrl) y P-27 (el valor CRUDO que /buscar emite)
select 'P-01/P-27' k, boletin, enlace from proyecto
 where enlace like 'https://tramitacion.senado.cl/wspublico/%' order by boletin limit 1;
-- P-01/P-27|10986-24|https://tramitacion.senado.cl/wspublico/tramitacion.php

-- P-02 (prmID + boletín para buildCamaraUrl)
select 'P-02' k, boletin, prm_id_camara from proyecto
 where prm_id_camara is not null order by boletin limit 1;
-- P-02|10986-24|11502

-- P-03 rama-rewrite (Sujeto C del inventario §1.3)
select 'P-03' k, boletin from proyecto where boletin='14309-04';
-- P-03|14309-04

-- P-05
select 'P-05' k, enlace from arista where enlace is not null order by enlace limit 1;
-- P-05|https://www.camara.cl/transparencia/listadodeaudiencias.aspx

-- P-06
select 'P-06' k, enlace from citacion where split_part(enlace,'/',3)='www.camara.cl' order by enlace limit 1;
-- P-06|https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx

-- P-07
select 'P-07' k, enlace from citacion where split_part(enlace,'/',3)='web-back.senado.cl' order by enlace limit 1;
-- P-07|https://web-back.senado.cl/api/commissions_citations?limit=100

-- P-08
select 'P-08' k, enlace from comision where enlace is not null order by enlace limit 1;
-- P-08|https://www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx

-- P-09
select 'P-09' k, enlace from comision_membresia where enlace is not null order by enlace limit 1;
-- P-09|https://www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx

-- P-10 (origen real: cruce_senal.enlace — ver §0.2)
select 'P-10' k, enlace from cruce_senal where enlace is not null order by enlace limit 1;
-- P-10|https://www.camara.cl/transparencia/listadodeaudiencias.aspx

-- P-11 (declaracion.enlace representa a las 7 tablas declaracion*)
select 'P-11' k, enlace from declaracion where split_part(enlace,'/',3)='datos.cplt.cl' order by enlace limit 1;
-- P-11|https://datos.cplt.cl/sparql?query=alessandri%20vergara

-- P-12
select 'P-12' k, enlace from lobby_audiencia where split_part(enlace,'/',3)='www.camara.cl' order by enlace limit 1;
-- P-12|https://www.camara.cl/transparencia/listadodeaudiencias.aspx

-- P-13
select 'P-13' k, enlace from lobby_audiencia where split_part(enlace,'/',3)='www.leylobby.gob.cl' order by enlace limit 1;
-- P-13|https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021

-- P-14
select 'P-14' k, enlace_detalle from lobby_audiencia where split_part(enlace_detalle,'/',3)='www.leylobby.gob.cl' order by enlace_detalle limit 1;
-- P-14|https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021/728817

-- P-15
select 'P-15' k, enlace from parlamentario where split_part(enlace,'/',3)='opendata.camara.cl' order by enlace limit 1;
-- P-15|https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual

-- P-16
select 'P-16' k, enlace from parlamentario where split_part(enlace,'/',3)='tramitacion.senado.cl' order by enlace limit 1;
-- P-16|https://tramitacion.senado.cl/wspublico/senadores_vigentes.php

-- P-17 (boletín distinto de P-01 para no repetir el mismo destino)
select 'P-17' k, boletin from proyecto
 where enlace like 'https://tramitacion.senado.cl/wspublico/%' order by boletin desc limit 1;
-- P-17|9301-14

-- P-18
select 'P-18' k, boletin, enlace from proyecto where split_part(enlace,'/',3)='opendata.camara.cl' order by boletin limit 1;
-- P-18|15480-13|https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin

-- P-19
select 'P-19' k, boletin, enlace from proyecto_autor
 where split_part(enlace,'/',3)='tramitacion.senado.cl' order by enlace, boletin limit 1;
-- P-19|10986-24|https://tramitacion.senado.cl/wspublico/tramitacion.php

-- P-20
select 'P-20' k, enlace from sesion_sala where split_part(enlace,'/',3)='web-back.senado.cl' order by enlace limit 1;
-- P-20|https://web-back.senado.cl/api/weekly_table?limit=100

-- P-21
select 'P-21' k, enlace from sesion_sala where split_part(enlace,'/',3)='www.camara.cl' order by enlace limit 1;
-- P-21|https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL

-- P-22
select 'P-22' k, enlace from tramitacion_evento where split_part(enlace,'/',3)='www.senado.cl' order by enlace limit 1;
-- P-22|http://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=11240&tipodoc=ofic

-- P-23
select 'P-23' k, enlace from tramitacion_evento where split_part(enlace,'/',3)='opendata.camara.cl' order by enlace limit 1;
-- P-23|https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin

-- P-24
select 'P-24' k, enlace from tramitacion_evento where split_part(enlace,'/',3)='tramitacion.senado.cl' order by enlace limit 1;
-- P-24|https://tramitacion.senado.cl/wspublico/votaciones.php

-- P-25
select 'P-25' k, boletin, enlace from votacion where split_part(enlace,'/',3)='opendata.camara.cl' order by enlace, boletin limit 1;
-- P-25|10986-24|https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin

-- P-26 (boletín para el destino post-rewrite)
select 'P-26' k, boletin from votacion where split_part(enlace,'/',3)='tramitacion.senado.cl' order by boletin desc limit 1;
-- P-26|18384-08
```

**Hallazgo de sustancia (para el Plan 02, no se juzga aquí):** la mayoría de los valores almacenados
en las columnas `enlace` son **endpoints de ingesta sin parámetro de fila** (`tramitacion.php`,
`getVotaciones_Boletin`, `listadodeaudiencias.aspx`, `comisiones_permanentes.aspx`), no deep-links al
recurso concreto. Varias familias comparten literalmente la misma URL. Eso hace que P-05, P-10 y P-12
apunten al mismo endpoint, y que P-08 y P-09 también. Se registra como dato; la clasificación
(`REDIR-GENERICA` vs `XML-CRUDO` vs `OK`) la produce la muestra live del Plan 02.

## 4. Manifiesto de la muestra

Agrupado **por host** (todos los casos de un host contiguos), en el orden en que el runner los
recorre. Ids en esquema LOCKED `P-NN-cNN`.

| id | host | url del caso | patrón | qué se espera del recurso | robots |
|----|------|--------------|--------|---------------------------|--------|
| P-02-c01 | www.camara.cl | `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=11502&prmBOLETIN=10986-24` | P-02 builder Cámara | ficha humana de tramitación del boletín 10986-24 | pendiente-Task-3 |
| P-05-c01 | www.camara.cl | `https://www.camara.cl/transparencia/listadodeaudiencias.aspx` | P-05 `arista.enlace` | listado de audiencias (endpoint genérico, no deep-link) | pendiente-Task-3 |
| P-06-c01 | www.camara.cl | `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx` | P-06 `citacion.enlace` | citaciones de la semana vigente | pendiente-Task-3 |
| P-08-c01 | www.camara.cl | `https://www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx` | P-08 `comision.enlace` | listado de comisiones permanentes | pendiente-Task-3 |
| P-09-c01 | www.camara.cl | `https://www.camara.cl/legislacion/comisiones/comisiones_permanentes.aspx` | P-09 `comision_membresia.enlace` | mismo endpoint que P-08 (comparten valor almacenado) | pendiente-Task-3 |
| P-10-c01 | www.camara.cl | `https://www.camara.cl/transparencia/listadodeaudiencias.aspx` | P-10 `cruce_senal.enlace` | mismo endpoint que P-05 (gate CRUCES) | pendiente-Task-3 |
| P-12-c01 | www.camara.cl | `https://www.camara.cl/transparencia/listadodeaudiencias.aspx` | P-12 `lobby_audiencia.enlace` | mismo endpoint que P-05 | pendiente-Task-3 |
| P-21-c01 | www.camara.cl | `https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` | P-21 `sesion_sala.enlace` | PDF de la tabla de sala de la semana vigente | pendiente-Task-3 |
| P-03-c02 | opendata.camara.cl | `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin` | P-03 rama-verbatim | web service SOAP/XML sin parámetro (no es página humana) | pendiente-Task-3 |
| P-15-c01 | opendata.camara.cl | `https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual` | P-15 `parlamentario.enlace` | web service XML del padrón de diputados | pendiente-Task-3 |
| P-18-c01 | opendata.camara.cl | `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin` | P-18 `proyecto.enlace` verbatim | mismo web service que P-03-c02 | pendiente-Task-3 |
| P-23-c01 | opendata.camara.cl | `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin` | P-23 `tramitacion_evento.enlace` | mismo web service | pendiente-Task-3 |
| P-25-c01 | opendata.camara.cl | `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin` | P-25 `votacion.enlace` verbatim | mismo web service | pendiente-Task-3 |
| P-01-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=10986-24` | P-01 builder Senado | ficha humana de tramitación del boletín | pendiente-Task-3 |
| P-03-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=14309-04` | P-03 rama-rewrite | ficha humana del Sujeto C | pendiente-Task-3 |
| P-16-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/wspublico/senadores_vigentes.php` | P-16 `parlamentario.enlace` | XML crudo del padrón de senadores (no página humana) | pendiente-Task-3 |
| P-17-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=9301-14` | P-17 `proyecto.enlace` post-rewrite | ficha humana del boletín 9301-14 | pendiente-Task-3 |
| P-19-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=10986-24` | P-19 `proyecto_autor.enlace` post-rewrite | mismo destino que P-01-c01 (el rewrite converge) | pendiente-Task-3 |
| P-24-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/wspublico/votaciones.php` | P-24 `tramitacion_evento.enlace` sin rewrite | XML crudo de votaciones (candidato de §3.3.6 punto 4) | pendiente-Task-3 |
| P-26-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=18384-08` | P-26 `votacion.enlace` post-rewrite | ficha humana del boletín 18384-08 | pendiente-Task-3 |
| P-27-c01 | tramitacion.senado.cl | `https://tramitacion.senado.cl/wspublico/tramitacion.php` | P-27 `proyecto.enlace` CRUDO en `/buscar` | XML crudo sin parámetro — **candidato #1** de la fase | pendiente-Task-3 |
| P-22-c01 | www.senado.cl | `http://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=11240&tipodoc=ofic` | P-22 `tramitacion_evento.enlace` | documento de tramitación (oficio); esquema `http:` | pendiente-Task-3 |
| P-07-c01 | web-back.senado.cl | `https://web-back.senado.cl/api/commissions_citations?limit=100` | P-07 `citacion.enlace` | API JSON de citaciones (no página humana) | pendiente-Task-3 |
| P-20-c01 | web-back.senado.cl | `https://web-back.senado.cl/api/weekly_table?limit=100` | P-20 `sesion_sala.enlace` | API JSON de la tabla semanal | pendiente-Task-3 |
| P-13-c01 | www.leylobby.gob.cl | `https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021` | P-13 `lobby_audiencia.enlace` | ficha humana de la audiencia (deep-link real) | pendiente-Task-3 |
| P-14-c01 | www.leylobby.gob.cl | `https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021/728817` | P-14 `lobby_audiencia.enlace_detalle` | detalle humano de la audiencia (deep-link real) | pendiente-Task-3 |
| P-11-c01 | datos.cplt.cl | `https://datos.cplt.cl/sparql?query=alessandri%20vergara` | P-11 `declaracion*.enlace` (7 tablas) | endpoint SPARQL con query — no página humana de declaración | pendiente-Task-3 |

**P-04 no tiene caso** en este manifiesto y su ausencia **no es una omisión**: `partidoLegible` no
emite href, luego no hay recurso que pedir. Se valida sólo por construcción (invariante "CERO URI en
el DOM"), sin probe.

CASOS_MANIFIESTO: 27
HOSTS_MANIFIESTO: 7
