---
phase: 132-news-rss-conector-rss-dos-etapas-locked
reviewed: 2026-08-05T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - packages/news/src/allowlist-news.ts
  - packages/news/src/allowlist-news.test.ts
  - packages/news/src/canonicalizar-url.ts
  - packages/news/src/canonicalizar-url.test.ts
  - packages/news/src/carga-run.ts
  - packages/news/src/carga-run.test.ts
  - packages/news/src/connector-news.ts
  - packages/news/src/connector-news.test.ts
  - packages/news/src/feeds.ts
  - packages/news/src/feeds.test.ts
  - packages/news/src/fixtures.test.ts
  - packages/news/src/index.ts
  - packages/news/src/model.ts
  - packages/news/src/parse-rss.ts
  - packages/news/src/parse-rss.test.ts
  - packages/news/src/prefiltro-lexico.ts
  - packages/news/src/prefiltro-lexico.test.ts
  - packages/news/src/probe-feeds.ts
  - packages/news/src/replay.test.ts
  - packages/news/src/run-news-cli.ts
  - packages/news/src/run-news-cli.test.ts
  - packages/news/src/writer-supabase.ts
  - packages/news/src/writer.ts
  - packages/news/package.json
  - packages/news/tsconfig.json
  - packages/news/vitest.config.ts
  - supabase/migrations/0084_noticia.sql
  - supabase/tests/0084_noticia.test.sql
findings:
  critical: 2
  warning: 17
  info: 6
  total: 25
status: issues_found
---

# Phase 132: Code Review Report

**Reviewed:** 2026-08-05
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

El ensamblaje sobre `BaseConnector` está bien hecho: ningún archivo de `packages/news`
reimplementa robots/rate-limit/R2, la allowlist es scoped (no toca `DEFAULT_ALLOWED_SUFFIXES`),
la migración 0084 es deny-all real con pgTAP `has_table_privilege(...)=false`, no hay project-ref
ni credenciales hardcodeadas (B26 limpio), y `--from-r2` efectivamente no puede tocar la red
(único origen de datos: `r2Store.getObject`, probado con `fetch` que lanza y con aserción sobre
las llamadas al doble). Etapa 2 nunca lee de la fuente.

Dicho eso, la fase entrega dos defectos de comportamiento serios: (1) el hash-check previo a
descargar — regla LOCKED de CLAUDE.md — **no existe en el camino real** (`cache.hasToday` es un
doble no-op cableado en producción), de modo que el cron de 136 re-descargaría los 5 medios cada
día; y (2) un fallo transitorio de DB deja la URL marcada para siempre como
`descarta/prefiltro_lexico`, con pérdida definitiva del ítem y causa falsa en el ledger. A eso se
suma una batería de flags de CLI que no hacen lo que documentan (`--feeds` no reduce la red,
`--etapa2` es un no-op silencioso, `--dry-run` igual golpea medios y escribe R2), inconsistencia
del valor de `outlet` ya materializada en PROD, y `contarPorCausa` sujeta al cap de 1.000 filas
de PostgREST que el propio repo documenta como gotcha.

No se aportaron `<structural_findings>` para esta revisión.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: El hash-check previo a descargar no existe en el camino de producción (`cache.hasToday` no-op cableado)

**File:** `packages/news/src/connector-news.ts:115-118`, `packages/news/src/run-news-cli.ts:314-334`
**Issue:** `buildNewsDeps()` deja `cache: { dailyKey: async () => "", hasToday: async () => false }`
como default, y `run-news-cli.ts` **nunca** sobreescribe `cache` (solo pasa `r2` y `snapshot`).
`BaseConnector.run()` evalúa `if (await this.deps.cache.hasToday(...)) continue;`
(`packages/ingest/src/base-connector.ts:124`), que por construcción siempre es `false` ⇒ cada
corrida hace fetch completo a los 5 medios. Esto viola la regla LOCKED de CLAUDE.md §Ingesta
punto 2 ("Hash-check ANTES de descargar… si no cambió, NO re-descargar") y el SC2 de la fase;
está confirmado empíricamente en 132-07 (la re-corrida gastó 5 requests reales contra medios).
El `[skip]` derivado (D-132-B) es entonces código inalcanzable en producción: `todosRefs` siempre
trae los 5 slugs. Cuando 136 encienda el cron diario, esto se convierte en tráfico recurrente
innecesario contra terceros. Nótese además que `SupabaseSnapshotStore` **no implementa**
`SnapshotLookup.hasSnapshot` (no existe en todo el repo), así que el wire exige escribir esa
consulta — no es solo "pasar el objeto".
**Fix (acotado, sin tocar `@obs/ingest`):** implementar el lookup en `packages/news` y cablearlo:

```ts
// packages/news/src/snapshot-lookup-supabase.ts (nuevo)
import type { SnapshotLookup } from "@obs/ingest";
export class SupabaseSnapshotLookup implements SnapshotLookup {
  constructor(private readonly client: SupabaseClient) {}
  async hasSnapshot(source: string, resource: string, dateBucket: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("source_snapshot")
      .select("id")
      .eq("source", source).eq("resource", resource).eq("date_bucket", dateBucket)
      .maybeSingle();
    if (error) throw new Error(`hasSnapshot falló: ${error.message}`);
    return data != null;
  }
}

// run-news-cli.ts, dentro de buildNewsDeps({...}):
...(url && serviceKey
  ? { cache: new DailyCache(new SupabaseSnapshotLookup(createClient(url, serviceKey))) }
  : {}),
```

Y un test apareado: con un lookup que devuelve `true` para los 5 recursos ⇒ `fetcher.get` 0 veces
y 5 líneas `[skip]`; con el mismo lookup devolviendo `false` ⇒ 5 fetches (control positivo).
Mutar el lookup a `async () => false` debe hacer caer el primer caso.

### CR-02: Un fallo transitorio de DB marca el ítem como descartado por pre-filtro PARA SIEMPRE (pérdida de dato + causa falsa)

**File:** `packages/news/src/carga-run.ts:101-163`
**Issue:** El marcado provisional escribe el **estado y la causa FINALES de descarte**
(`estado: "descarta", causa: "prefiltro_lexico"`) antes de evaluar `esLegislativo`. Si el ítem SÍ
pasa el pre-filtro pero `upsertNoticias` (línea 142) o el `marcarVistas` final (línea 153) lanzan
—error de red, 5xx de PostgREST, timeout—, el `continue` deja la fila del ledger con
`descarta/prefiltro_lexico`. En la corrida siguiente el dedup nivel 1
(`urlsYaVistas`, línea 87) lo cuenta como duplicado y **jamás vuelve a evaluarlo ni a cargarlo**:
la noticia se pierde definitivamente (exactamente el falso negativo que D-06 declara inaceptable)
y el conteo de descartes por causa —la evidencia del SC4— queda inflado con una causa que nunca
ocurrió. El test de degradación honesta (`carga-run.test.ts:223-248`) verifica que el lote no
aborta, pero **no** verifica el estado del ledger tras el fallo, por eso el defecto pasó los gates.
**Fix:** el marcado provisional no debe llevar la causa final. Usar un estado/causa neutro y
convertir la causa definitiva en la escritura final:

```ts
const provisional: UrlVistaRow = {
  url_hash: hash, url_canonica: urlCanonica, outlet: item.outlet,
  estado: "descarta", causa: null,        // provisional: sin causa
};
...
if (!pasa) {
  await writer.marcarVistas([{ ...provisional, causa: "prefiltro_lexico" }]);
  descartados += 1; continue;
}
```

y, en los `catch` de `upsertNoticias`/`marcarVistas-final`, revertir el ledger (borrar/marcar
`causa: null` + estado retryable) para que el ítem pueda reintentarse. Requiere migración menor:
`causa` ya es nullable, pero conviene añadir el valor `'error_carga'` al `check` de 0084 y un test
que, con un writer que revienta en `upsertNoticias`, verifique que el `url_hash` NO queda con
`causa='prefiltro_lexico'`.

## Warnings

### WR-01: `--feeds` no reduce la red — el conector siempre golpea los 5 medios

**File:** `packages/news/src/run-news-cli.ts:19`, `:246-254`, `:335-339`
**Issue:** La documentación del flag dice literalmente "subconjunto de FEEDS por slug (para no
golpear los 5 innecesariamente)", pero `NewsConnector.endpoints()` devuelve siempre `FEEDS`
completo (`connector-news.ts:49-56`) y el filtro se aplica **después**, sobre los `refs`. Un
operador que corra `--feeds latercera` hace 5 requests a terceros creyendo hacer 1 — contradice el
espíritu de CLAUDE.md ("minimizando minutos, lotes acotados") y el presupuesto de red declarado en
132-07.
**Fix:** inyectar el subconjunto en el conector:
```ts
export class NewsConnector extends BaseConnector<RssRaw> {
  constructor(deps: ConnectorDeps, private readonly feeds: readonly FeedDef[] = FEEDS) { super(deps); }
  protected endpoints(): RequestSpec[] { return this.feeds.map(...); }
}
// run-news-cli: new NewsConnector(deps, feedsPedidos)
```
más un test que verifique `fetcher.get` llamado 1 vez con `--feeds latercera`.

### WR-02: `--etapa2` solo es un no-op silencioso; `--etapa1 --etapa2` juntos no corren nada

**File:** `packages/news/src/run-news-cli.ts:267-272`, `:372`
**Issue:** Con `soloEtapa2 = true`, `correrEtapa1` es `false` ⇒ `refs` queda `[]` ⇒ el bloque de
Etapa 2 (`if (correrEtapa2 && refs.length > 0)`) nunca entra y el CLI sale exit 0 con
`descargados=0` sin decir que no hizo nada. Con ambos flags, `correrEtapa1` y `correrEtapa2` son
ambos `false` y la corrida es vacía, también con exit 0. Un operador puede creer que re-cargó.
**Fix:** validar en `parseArgs`: `if (opts.soloEtapa1 && opts.soloEtapa2) throw new NewsCliArgsError(...)`;
y hacer que `--etapa2` exija `--from-r2` (o liste los `r2Path` del día desde `source_snapshot`),
fallando con mensaje explícito si no hay nada que cargar.

### WR-03: Sin delay cross-host en el CLI (el probe sí lo tiene) — SC1 "delay entre feeds observable" no se cumple

**File:** `packages/news/src/run-news-cli.ts:349` vs `packages/news/src/probe-feeds.ts:37-41`
**Issue:** `HostRateLimiter` serializa por host; con 5 hosts distintos ninguno paga `minDelayMs`.
La corrida LIVE midió gaps de 1.858s / 1.709s / 1.517s (132-07). Literalmente CLAUDE.md exige
"2–3s/host" y eso sí se cumple (1 request por host), por lo que **no es BLOCKER**; pero el criterio
del ROADMAP SC1 ("delay entre feeds observable") no se cumple, el probe ya había resuelto el mismo
problema con `sleep(3000)` explícito, y el riesgo crece con más feeds/host compartido (Copesa
sirve latercera y lacuarta desde el mismo CDN).
**Fix:** en `run-news-cli.ts`, envolver el rateLimiter inyectado con un gate global, sin tocar
`@obs/ingest`:
```ts
const globalGate = (() => { let last = 0;
  return { async wait(host: string) { const d = 2500 - (Date.now() - last);
    if (d > 0) await new Promise(r => setTimeout(r, d)); last = Date.now(); await rl.wait(host); } };
})();
buildNewsDeps({ rateLimiter: globalGate, ... })
```
con un test de traza que verifique que entre dos `get:` consecutivos de HOSTS DISTINTOS hubo un
`wait` global.

### WR-04: `noticia.outlet` guarda el nombre display, contra lo que documentan el modelo y la migración

**File:** `packages/news/src/run-news-cli.ts:281`, `:379`; `packages/news/src/model.ts:31`; `supabase/migrations/0084_noticia.sql:49`
**Issue:** El CLI pasa `feed.outlet` (p.ej. `"La Tercera"`) a `parseRss`, y ese valor termina en
`noticia.outlet` / `noticia_url_vista.outlet`. Pero `model.ts:31` dice "Slug del feed (p.ej.
'biobiochile'), NO el nombre display" y el comentario de la migración enumera
`(biobiochile|cooperativa|latercera|lacuarta|exante)`. PROD ya tiene `La Tercera=18, La Cuarta=7`
(132-07 paso 5). Peor: en `--from-r2`, si el slug no está en `FEEDS` el fallback guarda el **slug**
(`feed?.outlet ?? slug ?? "desconocido"`), así que la misma columna mezcla dos vocabularios. Las
fases 134/135/137 que hagan join o filtren por outlet romperán.
**Fix:** decidir uno (recomendado: el slug, como dice el schema), pasar `feed.slug` a `parseRss`,
guardar el display name en `feeds.ts` para la UI, y añadir `check (outlet in (...))` o un test que
falle si el valor no es un slug de `FEEDS`. Requiere UPDATE de las 25 filas ya en PROD.

### WR-05: `contarPorCausa` cae en el cap de 1.000 filas de PostgREST y devuelve conteos silenciosamente falsos

**File:** `packages/news/src/writer-supabase.ts:82-93`
**Issue:** `.from("noticia_url_vista").select("causa")` sin `range()` devuelve como máximo 1.000
filas (gotcha v6.1, que el propio archivo cita en `QUERY_CHUNK` para `urlsYaVistas` pero olvida
aquí). Con 245 filas hoy funciona; a partir de la primera semana de cron el conteo de descartes —la
métrica del SC4— será un número falso sin ningún aviso. Precedente directo: el `Ver detalle (1000)`
de v12.0.
**Fix:** usar el conteo del servidor en vez de traer filas:
```ts
const { count, error } = await this.client
  .from("noticia_url_vista").select("*", { count: "exact", head: true }).eq("causa", causa);
```
iterando sobre las causas conocidas, o paginar con `.order("url_hash").range(...)`. Añadir test con
>1.000 filas simuladas contra un cliente doble que respete el cap.

### WR-06: `--dry-run` hace fetch real a los 5 medios y escribe en R2

**File:** `packages/news/src/run-news-cli.ts:260-265`, `:317-324`
**Issue:** `--dry-run` solo cambia el writer de Etapa 2. La Etapa 1 corre completa: `fetcher.get`
contra los 5 medios y `r2Store.putImmutable` sobre el bucket real (`r2` se cablea si hay `r2Store`,
sin mirar `dryRun`). Está documentado en la cabecera, pero el nombre del flag invita al error
opuesto y, una vez arreglado CR-01, un `--dry-run` **consumirá la caché diaria** del día real.
**Fix:** o renombrar a `--no-db`, o (mejor) en `dryRun` no cablear `r2` real y exigir `--from-r2`
para pruebas locales; en cualquier caso imprimir al inicio `dry-run: SÍ toca red y R2`.

### WR-07: `assertFeedUrl` (única aserción https) no se usa en el camino real de fetch

**File:** `packages/news/src/allowlist-news.ts:21-27`; `packages/news/src/connector-news.ts:110-111`
**Issue:** El `Fetcher`/`RobotsGuard` se construyen con `allowlistNews()`, que admite http para los
`extraHosts` (lo dice el propio JSDoc). La aserción https vive solo en `assertFeedUrl`, que ningún
código de producción invoca (solo su test). Hoy los 5 feeds son https, pero la defensa es
decorativa: agregar un feed http pasaría el guard.
**Fix:** llamar `assertFeedUrl(f.url)` dentro de `NewsConnector.endpoints()` (o al construir
`FEEDS`), de modo que una URL http falle en tiempo de corrida, y añadir un test con un `FEEDS`
mutado a http que verifique que `endpoints()` lanza.

### WR-08: argumentos desconocidos que no empiezan con `--` se ignoran en silencio

**File:** `packages/news/src/run-news-cli.ts:153-157`
**Issue:** El `default` del switch solo lanza si `a.startsWith("--")`. Un typo habitual (`-dry-run`,
`—dry-run` con guion largo copiado de la doc, `dry-run`) se descarta sin ruido y el CLI corre en
modo **LIVE contra PROD y contra los 5 medios**. Para un CLI cuyo modo por defecto escribe en la base
real, fallar cerrado es obligatorio.
**Fix:** `default: throw new NewsCliArgsError(\`argumento no reconocido: ${a}\`)` (salvo `--`), con
test para `-dry-run`.

### WR-09: `--from-r2` acepta cualquier clave de objeto sin validar

**File:** `packages/news/src/run-news-cli.ts:275-294`
**Issue:** El valor de argv se pasa tal cual a `r2Store.getObject`. No hay path traversal hacia el
FS (es una key S3), pero permite leer cualquier objeto del bucket de crudo (que contiene los
snapshots de todas las fuentes) y cargarlo como si fuera un feed de prensa, con `outlet:
"desconocido"` y `contenido_hash: ""` escritos en `noticia`. El regex del SC ya existe en el plan;
no está en el código.
**Fix:**
```ts
const R2_PATH_RE = /^news\/rss-(biobiochile|cooperativa|latercera|lacuarta|exante)\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{64}\.xml$/;
if (!R2_PATH_RE.test(opts.fromR2)) throw new NewsCliArgsError(`--from-r2 con clave inválida: ${opts.fromR2}`);
```
(derivar la alternancia de `FEEDS` para que no se desincronice) y pasar `contenidoHash` derivado del
sha256 del path, no `""`.

### WR-10: R2Store se construye con secret/bucket vacíos si faltan variables

**File:** `packages/news/src/run-news-cli.ts:230-237`
**Issue:** La condición es `ak && ep`; `R2_SECRET_ACCESS_KEY` y `R2_BUCKET` caen a `""` sin fallar.
Resultado: el fallo duro T-132-17 no dispara y en su lugar sale un error opaco del SDK S3 a mitad de
la Etapa 1, ya con requests hechos a los medios. El mensaje de `NewsR2RequeridoError` además solo
nombra 2 de las 4 variables.
**Fix:** exigir las cuatro (`ak && sk && ep && bk`) y listar en el mensaje las que faltan (por
nombre, nunca por valor).

### WR-11: `slugDesdeR2Path` solo reconoce slugs `[a-z]+` — cualquier slug con guion o dígito se pierde en silencio

**File:** `packages/news/src/run-news-cli.ts:207-210`
**Issue:** `/\/rss-([a-z]+)\//`. Si mañana se agrega `ex-ante`, `t13` o `elmostrador2`, el slug no
matchea ⇒ el `SnapshotRef` se filtra fuera de `refs` (línea 351), el feed aparece como `[skip]`
falso y **Etapa 2 nunca lo carga**, todo con exit 0. El repo ya evitó la trampa una vez nombrando
`exante` en vez de `ex-ante` para un host `www.ex-ante.cl` — es un acoplamiento no declarado.
**Fix:** `/\/rss-([a-z0-9-]+)\//` y, mejor, dejar de derivar del path: propagar el `resource`/`key`
en el `SnapshotRef` o mantener el mapa `r2Path → feed` construido al pedir los endpoints. Añadir un
test con un slug con guion.

### WR-12: `parsePubDate` devuelve `null` para variantes RFC 822 legítimas, sin registrar el error

**File:** `packages/news/src/parse-rss.ts:66-88`
**Issue:** El regex exige `HH:MM:SS` de dos dígitos y offset numérico o `GMT|UT|Z`. RFC 822 permite
`HH:MM` sin segundos, hora de un dígito y zonas nombradas (`EST`, `PDT`). Cualquiera de esas cae a
`fechaPub: null` y el ítem se persiste **sin fecha**, sin entrada en `errores[]`, sin log — pérdida
silenciosa de un campo que 137 necesita para ordenar.
**Fix:** aceptar segundos opcionales y hora de 1-2 dígitos, y cuando el `pubDate` viene presente
pero no parsea, empujar a `errores[]` (`pubDate no parseable: "<raw>"`) para que el CLI lo logee.

### WR-13: Truncar la descripción a 600 chars puede cortar un término y producir un falso negativo

**File:** `packages/news/src/prefiltro-lexico.ts:50`, `:104`
**Issue:** `slice(0, LIMITE_DESCRIPCION)` corta a mitad de palabra; si "proyecto de ley" queda
partido en la frontera, el ítem se descarta para siempre (D-06 declara el falso negativo
inaceptable). El corte además es sobre texto ya foldeado, no sobre el original, lo que hace el
límite dependiente del contenido.
**Fix:** cortar en la última frontera de palabra dentro del límite
(`d.slice(0, LIMITE).replace(/\S*$/, "")`) o simplemente subir el límite/eliminarlo (el matching
es regex sobre unos pocos KB, el costo es despreciable). Test: descripción con "…proyecto de ley"
cruzando el char 600 debe pasar.

### WR-14: `validateShape` acepta Atom (`<feed>`) pero `parseRss` solo entiende `rss.channel.item`

**File:** `packages/news/src/connector-news.ts:68`; `packages/news/src/parse-rss.ts:117-119`
**Issue:** Contrato contradictorio entre etapas. Hoy no explota porque `validateShape` además exige
`<item>` (Atom usa `<entry>`), pero eso significa que un medio que migre a Atom hará **fallar la
Etapa 1 entera** con "RSS sin `<item>`" en vez de degradar honestamente, y que el `<feed>` del
primer regex es letra muerta.
**Fix:** o quitar `<feed` del regex y documentar "RSS 2.0 únicamente", o soportar `feed.entry` en
`parseRss`. En cualquier caso, que un feed que no valida no tumbe los demás: hoy
`BaseConnector.run()` no captura la excepción de `validateShape`, así que un medio roto aborta la
corrida completa antes de procesar los siguientes.

### WR-15: `SupabaseNewsWriter` no tiene ningún test

**File:** `packages/news/src/writer-supabase.ts:49-108`
**Issue:** Es el único componente que escribe en PROD y no aparece en ningún archivo `*.test.ts`
salvo el chequeo `toBeDefined()` del barrel (`run-news-cli.test.ts:170-193`). El `onConflict`, el
`dedupePorClave` (defensa contra `ON CONFLICT DO UPDATE cannot affect row a second time`), el
chunking y el manejo de `error.message` no están cubiertos por nada — su corrección se apoya
únicamente en la corrida LIVE única de 132-07.
**Fix:** tests con un cliente doble (`from().upsert()` que registre argumentos): verificar
`onConflict: "url_hash"`, que 1.200 filas se parten en 3 lotes, que dos filas con el mismo
`url_hash` llegan como una sola, y que un `error` de PostgREST se convierte en throw con el mensaje.

### WR-16: Cada ítem cargado hace 2-3 round-trips independientes; ledger y `noticia` pueden divergir

**File:** `packages/news/src/carga-run.ts:109`, `:142`, `:153`
**Issue:** `marcarVistas` se invoca **por ítem** (no por lote), y `upsertNoticias` también. Los 245
ítems de la corrida real produjeron ~270 requests a PostgREST, cada uno en su propia transacción:
si el proceso muere entre el upsert de `noticia` y el `marcarVistas` final, la noticia queda cargada
pero el ledger la reporta como descartada (misma familia que CR-02). El writer ya soporta lotes
(`filas: NoticiaRow[]`, chunking de 500) — la capacidad existe y no se usa.
**Fix:** acumular las filas y hacer un `marcarVistas(provisionales)` por lote, un
`upsertNoticias(filas)` por lote y un `marcarVistas(finales)` por lote; o mover ambas escrituras a
una RPC transaccional. Mantener el ORDEN LOCKED (provisional antes del reject) a nivel de lote.

### WR-17: Se persiste HTML crudo en `descripcion`, contra lo que declara la migración

**File:** `packages/news/src/model.ts:29`; `packages/news/src/carga-run.ts:137`; `supabase/migrations/0084_noticia.sql:52`
**Issue:** El comentario de la columna dice "texto despojado de HTML y truncado", pero lo que se
guarda es `item.descripcion`, HTML crudo del feed (el despojo solo ocurre dentro del pre-filtro, en
memoria). La 137 mostrará este campo en el sitio; si alguien confía en el comentario del schema y lo
renderiza sin escapar, es un XSS almacenado de origen tercero.
**Fix:** o guardar `despojarHtml(item.descripcion)` (y actualizar el modelo), o corregir el
comentario de 0084 a "HTML crudo del feed — NUNCA renderizar sin escapar" y dejar una nota para 137.
La primera opción es preferible.

## Info

### IN-01: Test vacuo de "cero red"

**File:** `packages/news/src/carga-run.test.ts:251-257`
**Issue:** `expect(typeof cargar).toBe("function")` no puede fallar por la razón que dice probar; no
hay stub de `fetch` que explote en ese archivo, así que no controla nada.
**Fix:** instalar el mismo `vi.stubGlobal("fetch", ...)` que lanza (patrón de `replay.test.ts`) y
correr un `cargar()` completo bajo él.

### IN-02: El test del `[skip]` derivado prueba un escenario que la producción no puede producir

**File:** `packages/news/src/run-news-cli.test.ts:66-112`
**Issue:** El doble devuelve menos `refs` de los pedidos — situación que, con el cableado actual
(CR-01), nunca ocurre. El test es correcto sobre la derivación, pero se usó como evidencia de SC2
y dio confianza falsa hasta la corrida real.
**Fix:** al cerrar CR-01, reemplazar/ampliar con un test que pase por `buildNewsDeps` con un
`SnapshotLookup` doble que devuelva `true`, verificando `fetcher.get` 0 veces.

### IN-03: Exportes muertos (`contarPorCausa`, `assertFeedUrl`)

**File:** `packages/news/src/writer-supabase.ts:82`; `packages/news/src/allowlist-news.ts:21`
**Issue:** Ningún consumidor fuera de `packages/news/src` los invoca; `contarPorCausa` además es
parte obligatoria de la interfaz `NewsWriter` sin que nadie la llame (el CLI no reporta por causa,
el conteo del SC4 salió por `psql`).
**Fix:** usar `contarPorCausa` en el resumen final del CLI (es el conteo observable que pide D-07)
y cablear `assertFeedUrl` según WR-07; si no, eliminarlos.

### IN-04: `errores[].urlHash` contiene la URL cruda en la rama de canonicalización

**File:** `packages/news/src/carga-run.ts:72-77`
**Issue:** El campo declarado como `urlHash` recibe `item.link`. Confunde a cualquiera que
correlacione errores con el ledger.
**Fix:** renombrar el campo a `ref` o poner `urlHash: ""` y agregar `url: item.link`.

### IN-05: `canonicalizarUrl` elimina `ref` y `source`, que son parámetros de contenido en varios CMS

**File:** `packages/news/src/canonicalizar-url.ts:15-23`
**Issue:** A diferencia de `utm_*`/`fbclid`, `ref` y `source` aparecen como parámetros funcionales
en algunos sitios; dos artículos distintos podrían colapsar al mismo `url_hash` y uno se perdería
como "duplicado". Está congelado por diseño (cambiarlo invalida el ledger), por eso queda como Info.
**Fix:** documentar el riesgo en la cabecera y, si aparece un caso real, resolverlo con una lista
por host en vez de global.

### IN-06: Los fixtures de latercera/lacuarta están recortados a 20 ítems sin marca en el archivo

**File:** `packages/news/src/parse-rss.test.ts:16-18`; `packages/news/src/fixtures.test.ts:15-18`
**Issue:** El recorte (F-9) solo consta en un comentario del test; `fixtures.test.ts` verifica
cantidad de archivos y nombres, no que el contenido corresponda al feed vivo. Un fixture recortado a
mano puede quedar estructuralmente inválido (p.ej. sin `</channel>`) y nadie lo notaría hasta la
próxima corrida real.
**Fix:** añadir al `fixtures.test.ts` un `parseRss(fixture, slug)` por archivo asertando
`errores === []` e `items.length > 0`, y una nota en cada fixture recortado (`<!-- recortado a 20
ítems, F-9 -->`).

---

_Reviewed: 2026-08-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
