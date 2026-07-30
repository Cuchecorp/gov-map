---
phase: 115
plan: 02
estado: cerrado
---

# 115 — Veredicto por patrón de link externo

Insumos: `115-PATRONES.md` (universo §1, exclusiones §2, manifiesto §4), `115-ROBOTS.txt`
(protocolo de exclusión + bloque `RETIRADOS:`), `115-MUESTRA.json` / `115-MUESTRA.txt`
(19 respuestas live del 2026-07-28, una sola pasada, delta mínimo intra-host 2589 ms).

## 1. Método del veredicto

Taxonomía **CERRADA** de 4 etiquetas. Cada patrón de §1 recibe **exactamente una**.

| etiqueta | criterio duro |
|----------|---------------|
| `OK` | el recurso responde **2xx** **Y** la `url_effective` conserva el parámetro que instancia el patrón (boletín / prmID / iddocto / id de audiencia): se llega al recurso **específico**. Un 2xx que aterriza en la portada del host **no** es `OK`. |
| `PATRON-MALO` | defecto **NUESTRO**: el patrón apunta a un recurso no-humano (XML crudo, API JSON, endpoint de ingesta), a una página genérica, o construye la URL **sin** el parámetro de fila. Se arregla en código (Plan 03). |
| `FUENTE-CAIDA-WAF` | 403 / 429 / 5xx o no resuelve, **con el patrón bien construido**. Se DECLARA con comando + respuesta; jamás se evade ni se reintenta agresivamente. |
| `OK-POR-CONSTRUCCION` | **no-probado-por-diseño**, jamás disfrazado de `OK` live. Admitida sólo para `partidoLegible` —que no emite href, luego no hay recurso que pedir— y para los ids del bloque `RETIRADOS:` de `115-ROBOTS.txt`, cada uno citando su directiva `Disallow: /` verbatim en la misma fila. Sin esa cita, la etiqueta es inválida. |

**Regla LOCKED.** Un `FUENTE-CAIDA-WAF` **no absuelve** a un patrón que además está mal
construido. Si el patrón apunta a `/wspublico/` y encima da 403, el veredicto es `PATRON-MALO`
con nota de WAF. La caída de la fuente nunca es excusa para no arreglar lo nuestro.

**Cómo se leyó cada respuesta.** El `http_code` y la `url_effective` son la prueba; el cuerpo
sólo se usa como corroboración. Para los cinco destinos de ficha del Senado, el snippet trae
`<input name="boletin_ini" ... value="<boletín>">`, que prueba que el servidor instanció **ese**
boletín y no una lista genérica.

**Nota sobre `FUENTE-CAIDA-WAF`: cero patrones la recibieron.** Los dos hosts que negaron su
`/robots.txt` con 403 (`www.leylobby.gob.cl`, `datos.cplt.cl`) **sí respondieron** las URLs de
caso: 200 en `P-13-c01` y `P-14-c01`, y 400 con un error de compilador SPARQL en `P-11-c01`.
Un WAF que bloquea `/robots.txt` pero sirve el recurso no constituye fuente caída. Ningún 403
ni 429 ni 5xx-de-servidor-inalcanzable apareció en la muestra: los cuatro 500 de
`opendata.camara.cl` son respuestas **deliberadas** del web service (`Falta el parámetro:
prmBoletin`), es decir, defecto de nuestra URL, no indisponibilidad del host.

**Nota sobre la clasificación propuesta.** La columna `clasificacion` de `115-MUESTRA.json` es
la heurística del runner, no este veredicto. Se corrigió un defecto suyo (un 400 caía a `OK`) y
se re-derivó de los mismos registros crudos, sin volver a consultar servidor alguno.

## 2. Veredicto por patrón

Una fila por cada `P-NN` de §1 de `115-PATRONES.md` (`P-03` aporta dos, una por rama, como en
§1). Cero patrones sin veredicto. `url_effective` acotada a lo que instancia el patrón.

| id | patrón | host | caso | http_code | url_effective (acotada) | veredicto | evidencia (115-MUESTRA.json) | acción |
|----|--------|------|------|-----------|--------------------------|-----------|------------------------------|--------|
| P-01 | `buildSenadoUrl` | tramitacion.senado.cl | P-01-c01 | 206 | `.../index.php?boletin_ini=10986-24` | OK | registro `P-01-c01`; snippet `value="10986-24"` | ninguna |
| P-02 | `buildCamaraUrl` | www.camara.cl | P-02-c01 | sin probe | `tramitacion.aspx?prmID=11502&prmBOLETIN=10986-24` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1); plantilla + parámetro en §1 | ninguna |
| P-03 rama-rewrite | `enlaceHumanoProyecto` → ficha Senado | tramitacion.senado.cl | P-03-c01 | 206 | `.../index.php?boletin_ini=14309-04` | OK | registro `P-03-c01`; snippet `value="14309-04"` | ninguna — el rewrite hace su trabajo |
| P-03 rama-verbatim | `enlaceHumanoProyecto` passthrough | opendata.camara.cl | P-03-c02 | 500 | `.../wscamaradiputados.asmx/getVotaciones_Boletin` | PATRON-MALO | registro `P-03-c02`; cuerpo `Falta el parámetro: prmBoletin` | A-3 |
| P-04 | `partidoLegible` | datos.bcn.cl | sin caso | sin probe | ninguna — no emite href | OK-POR-CONSTRUCCION | `partidoLegible` no construye link: extrae el slug y devuelve el nombre (invariante CERO URI en el DOM) | ninguna |
| P-05 | `arista.enlace` | www.camara.cl | P-05-c01 | sin probe | `listadodeaudiencias.aspx` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-06 | `citacion.enlace` | www.camara.cl | P-06-c01 | sin probe | `citaciones_semana.aspx` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-07 | `citacion.enlace` | web-back.senado.cl | P-07-c01 | 200 | `/api/commissions_citations?limit=100` | PATRON-MALO | registro `P-07-c01`; `content_type: application/json` | A-4 |
| P-08 | `comision.enlace` | www.camara.cl | P-08-c01 | sin probe | `comisiones_permanentes.aspx` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-09 | `comision_membresia.enlace` | www.camara.cl | P-09-c01 | sin probe | `comisiones_permanentes.aspx` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-10 | `cruce_senal.enlace` | www.camara.cl | P-10-c01 | sin probe | `listadodeaudiencias.aspx` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-11 | `declaracion*.enlace` (7 tablas) | datos.cplt.cl | P-11-c01 | 400 | `/sparql?query=alessandri%20vergara` | PATRON-MALO | registro `P-11-c01`; cuerpo `Virtuoso 37000 Error SP030: SPARQL compiler ... syntax error` | A-5 |
| P-12 | `lobby_audiencia.enlace` | www.camara.cl | P-12-c01 | sin probe | `listadodeaudiencias.aspx` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-13 | `lobby_audiencia.enlace` | www.leylobby.gob.cl | P-13-c01 | 200 | `/instituciones/AA001/audiencias/2024/663021` | OK | registro `P-13-c01`; título de la audiencia en el snippet | ninguna |
| P-14 | `lobby_audiencia.enlace_detalle` | www.leylobby.gob.cl | P-14-c01 | 200 | `/instituciones/AA001/audiencias/2024/663021/728817` | OK | registro `P-14-c01`; id de detalle conservado | ninguna |
| P-15 | `parlamentario.enlace` | opendata.camara.cl | P-15-c01 | 200 | `WSDiputado.asmx/retornarDiputadosPeriodoActual` | PATRON-MALO | registro `P-15-c01`; `content_type: text/xml`, cuerpo `<DiputadosPeriodoColeccion>` | A-4 |
| P-16 | `parlamentario.enlace` | tramitacion.senado.cl | P-16-c01 | 206 | `/wspublico/senadores_vigentes.php` | PATRON-MALO | registro `P-16-c01`; `content_type: application/xml`, cuerpo `<senadores>` | A-4 |
| P-17 | `proyecto.enlace` post-rewrite | tramitacion.senado.cl | P-17-c01 | 206 | `.../index.php?boletin_ini=9301-14` | OK | registro `P-17-c01`; snippet `value="9301-14"` | ninguna |
| P-18 | `proyecto.enlace` verbatim | opendata.camara.cl | P-18-c01 | 500 | `.../getVotaciones_Boletin` | PATRON-MALO | registro `P-18-c01`; cuerpo `Falta el parámetro: prmBoletin` | A-3 |
| P-19 | `proyecto_autor.enlace` post-rewrite | tramitacion.senado.cl | P-19-c01 | 206 | `.../index.php?boletin_ini=10986-24` | OK | registro `P-19-c01`; snippet `value="10986-24"` | ninguna |
| P-20 | `sesion_sala.enlace` | web-back.senado.cl | P-20-c01 | 200 | `/api/weekly_table?limit=100` | PATRON-MALO | registro `P-20-c01`; `content_type: application/json` | A-4 |
| P-21 | `sesion_sala.enlace` | www.camara.cl | P-21-c01 | sin probe | `verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` (no solicitada) | OK-POR-CONSTRUCCION | `Disallow: /` de www.camara.cl (115-ROBOTS.txt §1) | A-6 |
| P-22 | `tramitacion_evento.enlace` | www.senado.cl | P-22-c01 | 200 | `.../index.php?mo=tramitacion&ac=getDocto&iddocto=11240&tipodoc=ofic` | OK | registro `P-22-c01`; 2 redirects, `iddocto=11240` conservado, `content_type: application/msword` | ninguna — ver nota (a) |
| P-23 | `tramitacion_evento.enlace` | opendata.camara.cl | P-23-c01 | 500 | `.../getVotaciones_Boletin` | PATRON-MALO | registro `P-23-c01`; cuerpo `Falta el parámetro: prmBoletin` | A-3 |
| P-24 | `tramitacion_evento.enlace` sin rewrite | tramitacion.senado.cl | P-24-c01 | 206 | `/wspublico/votaciones.php` | PATRON-MALO | registro `P-24-c01`; `application/xml`, cuerpo `<votaciones> </votaciones>` | **A-2 (candidato #2)** |
| P-25 | `votacion.enlace` verbatim | opendata.camara.cl | P-25-c01 | 500 | `.../getVotaciones_Boletin` | PATRON-MALO | registro `P-25-c01`; cuerpo `Falta el parámetro: prmBoletin` | A-3 |
| P-26 | `votacion.enlace` post-rewrite | tramitacion.senado.cl | P-26-c01 | 206 | `.../index.php?boletin_ini=18384-08` | OK | registro `P-26-c01`; snippet `value="18384-08"` | ninguna |
| P-27 | `proyecto.enlace` CRUDO en `/buscar` | tramitacion.senado.cl | P-27-c01 | 206 | `/wspublico/tramitacion.php` | PATRON-MALO | registro `P-27-c01`; `application/xml`, cuerpo `<proyectos></proyectos>` | **A-1 (candidato #1)** |

**Nota (a) — P-22.** Es el único caso con redirección (2 saltos, de `www.senado.cl` a
`tramitacion.senado.cl`) y aun así **conserva `iddocto=11240`**: no aterriza en la portada, entrega
el oficio pedido. El `content_type: application/msword` significa que el navegador descarga un
documento en vez de mostrar una página — es el formato en que la fuente publica el oficio, no un
defecto de nuestro patrón. Se registra sin acción.

**Recuento de etiquetas.** `OK` 9 · `PATRON-MALO` 10 · `FUENTE-CAIDA-WAF` 0 · etiqueta sin-probe 9.
Total 28 filas (27 patrones; `P-03` aporta dos). La etiqueta sin-probe aparece **9** veces = 1
(`partidoLegible`) + 8 (ids del bloque `RETIRADOS:`), que es exactamente su límite, y cada una de
esas 9 filas cita su justificación en la propia fila.

## 3. Candidatos del inventario — resolución explícita

### Candidato #1 — `/buscar` pasa `proyecto.enlace` crudo

**Confirmado. Veredicto: `PATRON-MALO` (patrón P-27).**

`app/components/buscar-filtros.tsx:493` construye el `provenance` de cada resultado con
`sourceUrl: row.enlace ?? null` — el valor **crudo** de la columna, sin pasar por
`enlaceHumanoProyecto`. Los cuatro call-sites hermanos sí aplican el rewrite:
`ficha-header.tsx:70`, `autor-row.tsx:64`, `votacion-card.tsx:101` y `proyectos-similares.tsx:109`.
`/buscar` es la excepción, y es la superficie de entrada más transitada del sitio.

**Denominador verificado contra PROD** (query de conteo, `2026-07-28`):

```sql
select split_part(enlace,'/',3), count(*) from proyecto where enlace is not null group by 1 order by 2 desc;
-- tramitacion.senado.cl|3658
-- opendata.camara.cl|1
select count(*) from proyecto where enlace like '%/wspublico/%';
-- 3658
```

Las **3.658** filas de `tramitacion.senado.cl` son **todas** de path `/wspublico/`, es decir,
exactamente el caso que `enlaceHumanoProyecto` existe para reescribir. La respuesta live confirma
qué recibe hoy quien hace clic: `P-27-c01` → HTTP 206, `content_type: application/xml`, cuerpo
`<proyectos></proyectos>`. No es sólo XML crudo: es XML **vacío**, porque el endpoint no lleva
parámetro de fila.

**El fix no requiere threading nuevo.** `row.boletin` ya está disponible en el mismo `.map`
(`buscar-filtros.tsx:482-483`, donde alimenta `key` y el prop `boletin`). Basta envolver la
expresión de `:493`; no hace falta builder nuevo ni prop nueva. Acción **A-1**.

### Candidato #2 — timeline B5, `tramitacion_evento.enlace`

**Confirmado. Veredicto: `PATRON-MALO` (patrón P-24).**

**Conteo por SQL** (query verbatim, `like '%/wspublico/%'`, CONTEO jamás valores):

```sql
select count(*) from tramitacion_evento where enlace like '%/wspublico/%';
-- 982
select count(*) from tramitacion_evento where split_part(enlace,'/',3)='tramitacion.senado.cl';
-- 982
```

Las **982** filas de `tramitacion.senado.cl` son `/wspublico/` **todas** (982 = 982): no hay
subconjunto sano que preservar. Cruzado con la muestra: `P-24-c01` → HTTP 206,
`content_type: application/xml`, cuerpo `<votaciones> </votaciones>` — XML vacío, mismo cuadro que
el candidato #1.

`app/components/timeline-event.tsx:42` emite `<a href={evento.enlace}>` **sin** `enlaceHumanoProyecto`
y **sin** `safeExternalHref`, siendo que el resto de los href externos del proyecto pasan por ese
guard (`validacion-fuente.tsx:123-124`).

**Cadena de llamada real que el fix deberá tocar** (verificada en el árbol, no supuesta):

```
app/app/proyecto/[boletin]/page.tsx:525
  └─ TimelineView            app/components/timeline-view.tsx:220
       └─ TimelineEvent      app/components/timeline-view.tsx:243  (evento suelto)
       └─ TimelineEvent      app/components/timeline-view.tsx:252  (evento dentro de un período de urgencia)
            └─ <a href>      app/components/timeline-event.tsx:42
```

`timeline-view.tsx` es el intermediario obligado: `TimelineEvent` **no** se instancia en ningún
otro lugar, de modo que cualquier cambio de firma del componente obliga a tocar **ambos**
call-sites (`:243` y `:252`) — omitir el segundo dejaría sin arreglar los eventos que viven dentro
de un período de urgencia expandido.

**Corrección a la premisa del plan (evidencia, no impedimento).** El plan asumía que el fix exige
threadear el boletín desde `page.tsx` a través de `TimelineView`. **No es necesario**: el boletín
viaja **dentro de la fila**. `TramitacionEventoRow.boletin` es `string` no-nulable
(`app/lib/types.ts:32-33`) y PROD lo confirma:

```sql
select count(*) from tramitacion_evento where boletin is null;
-- 0
```

Luego `TimelineEvent` ya tiene `evento.boletin` en la mano y el fix es **local a
`timeline-event.tsx:42`**, sin cambio de firma y sin prop nueva en `timeline-view.tsx`. Esto no
exime de revisar `timeline-view.tsx:243,252`: la verificación del Plan 03 debe comprobar que
**ambas** rutas de render quedan cubiertas por el fix. Acción **A-2**.

## 4. Acciones para el Plan 03

Lista **CERRADA**. Deriva 1:1 de las 10 filas `PATRON-MALO` de §2.

1. **A-1 — `/buscar`: aplicar el rewrite existente (patrón P-27, 3.658 filas).**
   - Archivo:línea — `app/components/buscar-filtros.tsx:493`.
   - Fix — envolver la expresión con el builder que ya existe:
     `sourceUrl: row.enlace ? enlaceHumanoProyecto(row.enlace, row.boletin) : null`, importando
     `enlaceHumanoProyecto` de `@/components/validacion-fuente`. **Sin builder nuevo, sin prop
     nueva**: `row.boletin` ya está en el `.map` (`:482-483`).
   - Criterio de aceptación — para una fila cuyo `enlace` sea `.../wspublico/tramitacion.php`, el
     `sourceUrl` del badge es `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=<boletín>`;
     una fila con `enlace` de otro host se devuelve verbatim (rama passthrough intacta); test unitario
     que cubra ambas ramas; `tsc` en 0 y suite baseline sin regresión.

2. **A-2 — Timeline: aplicar rewrite + guard (patrón P-24, 982 filas).**
   - Archivo:línea — `app/components/timeline-event.tsx:42`.
   - Archivos intermediarios que el fix obliga a revisar — `app/components/timeline-view.tsx:243`
     y `app/components/timeline-view.tsx:252` (los dos únicos call-sites de `TimelineEvent`;
     el segundo es el de los períodos de urgencia expandidos), con
     `app/app/proyecto/[boletin]/page.tsx:525` como origen de la cadena. El boletín **no** se
     threadea: llega en `evento.boletin` (`app/lib/types.ts:32-33`, 0 nulos en PROD).
   - Fix — `href={safeExternalHref(enlaceHumanoProyecto(evento.enlace, evento.boletin))}`, con el
     guard `safeExternalHref` que hoy falta y que el resto de los href externos ya usa
     (`validacion-fuente.tsx:123-124`); si el guard devuelve nulo, no se renderiza el `<a>`.
   - Criterio de aceptación — un evento con `enlace` `/wspublico/votaciones.php` linkea a la ficha
     humana del boletín del evento; ambos call-sites de `timeline-view.tsx` quedan cubiertos por el
     test; ningún evento pierde su link por el guard salvo que el `enlace` sea inválido.

3. **A-3 — `opendata.camara.cl/...getVotaciones_Boletin` sin parámetro (patrones P-03 rama-verbatim,
   P-18, P-23, P-25).**
   - Evidencia — cuatro registros con HTTP 500 y cuerpo `Falta el parámetro: prmBoletin`. El host
     responde; el defecto es de la URL almacenada. `P-18` afecta 1 fila de `proyecto`; `P-23` 3.797
     de `tramitacion_evento`; `P-25` 3.806 de `votacion`.
   - Fix — **no hay rewrite reutilizable**: el destino humano de la Cámara es
     `buildCamaraUrl(boletin, prmId)`, que exige `prm_id_camara` no nulo, dato que no acompaña a
     `tramitacion_evento` ni a `votacion`. Añadir el parámetro al web service sólo devolvería XML,
     que sigue sin ser una página humana. Por tanto: **limitación declarada**, no fix de URL.
   - Archivo de UI donde iría la leyenda — `app/components/provenance-badge.tsx` (es el componente
     que renderiza el `sourceUrl` de todos estos call-sites).
   - Texto propuesto de la leyenda (el Plan 03 lo pasa por el linter anti-insinuación **antes** de
     escribirlo) — «La fuente oficial publica este dato como servicio de datos, no como página de
     consulta.»
   - Criterio de aceptación — la leyenda aparece cuando el destino es un servicio de datos; el
     linter anti-insinuación verde; cero afirmación de intención ni de causalidad.

4. **A-4 — Endpoints de datos sin equivalente humano derivable (patrones P-07, P-15, P-16, P-20).**
   - Evidencia — `P-07-c01` y `P-20-c01` responden 200 `application/json`; `P-15-c01` 200
     `text/xml`; `P-16-c01` 206 `application/xml`. Los cuatro **funcionan**: entregan lo que
     prometen, pero a una máquina. Filas: P-07 125, P-15 155, P-16 31, P-20 16.
   - Fix — ninguno posible con los datos en mano: no existe parámetro de fila almacenado del que
     derivar una URL humana (`?limit=100` es paginación, no identidad). Misma resolución que A-3:
     **limitación declarada**, mismo archivo (`app/components/provenance-badge.tsx`) y mismo texto
     propuesto.
   - Criterio de aceptación — idéntico a A-3.

5. **A-5 — `datos.cplt.cl`: la URL almacenada es una consulta SPARQL mal formada (patrón P-11,
   9.441 filas).**
   - Evidencia — `P-11-c01` → HTTP 400, cuerpo
     `Virtuoso 37000 Error SP030: SPARQL compiler, line 1: syntax error at 'alessandri' before 'vergara'`.
     El servidor está sano: rechaza **nuestra** consulta. `?query=alessandri%20vergara` es texto
     libre, no SPARQL.
   - Fix — el defecto está en la **ingesta** que persiste ese `enlace`, no en la UI, de modo que
     excede el alcance de esta fase (que arregla patrones de link, no conectores). El Plan 03
     **declara la limitación** en `app/components/provenance-badge.tsx` con el texto de A-3 y
     **registra la deuda de ingesta** en `deferred-items.md` de la fase, con el conteo (9.441 filas
     sobre 7 tablas `declaracion*`) y este registro como evidencia.
   - Criterio de aceptación — la deuda queda escrita con conteo y evidencia; cero cambio de
     conector en esta fase; ningún dato personal en el registro.

6. **A-6 — Patrones de `www.camara.cl` retirados por robots (P-02, P-05, P-06, P-08, P-09, P-10,
   P-12, P-21): NINGUNA acción de código.**
   - Se listan para cerrar la lista, no para trabajar. Su etiqueta es la de sin-probe y su
     justificación es la directiva `Disallow: /`, no una avería. El Plan 03 **no** debe intentar
     probarlos, ni cambiar el User-Agent, ni usar proxies para alcanzarlos.
   - Criterio de aceptación — el Plan 03 no emite ningún request a `www.camara.cl`.

**Ningún `FUENTE-CAIDA-WAF` que declarar.** Cero patrones recibieron esa etiqueta (§1, nota), de
modo que no hay leyenda de fuente caída que redactar. Las leyendas de A-3/A-4/A-5 son de
**recurso no-humano**, que es cosa distinta y así debe decirlo el copy.

## 5. Deploy diferido

Ningún fix de esta fase se observa contra el deploy real hasta la **Phase 125** (decisión LOCKED
de v12.0). Siguiendo el precedente de 114-03, el Plan 03 cierra con **PASS con limitación
declarada** —«verificado en código y en test; no observado en el deploy»— y jamás con un PASS
pelado. La re-verificación live de la muestra externa también viaja con 125, por respeto al
rate-limit: no se vuelve a consultar a estos servidores dentro de esta fase.
