# Phase 132: NEWS-RSS — Conector RSS dos-etapas LOCKED - Research

**Researched:** 2026-08-05
**Domain:** Ingesta RSS de prensa sobre el framework `@obs/ingest` (TS/Node, Supabase, R2)
**Confidence:** HIGH (todo lo decisivo se verificó con fetch real y con la librería exacta del framework)

---

## ⛔ BLOCKER DE DISEÑO — LEER PRIMERO

**D-02 (Google News RSS Search) es INEJECUTABLE tal como está escrito.**

`https://news.google.com/robots.txt` (fetch real, HTTP 200, 484 bytes, 2026-08-05) declara para
`User-agent: *`:

```
User-agent: *
Disallow: /
Allow: /$
Allow: /?
Allow: /home$
Allow: /home?
Allow: /home/
Allow: /nwshp$
Allow: /topics/
Allow: /publications/
Allow: /stories/
Allow: /swg/
Allow: /about$
Allow: /about?
Allow: /about/
```

`/rss/` **no está en ninguna regla `Allow`** ⇒ cae bajo `Disallow: /`.

Verificado con **la misma librería que usa `RobotsGuard`** (`robots-parser@3.0.1`, instalada en
`packages/ingest/node_modules`), con el UA LOCKED `IDENTIFIED_UA`:

| URL | `isAllowed` |
|---|---|
| `https://news.google.com/rss/search?q=%22proyecto+de+ley%22+when:2d&hl=es-419&gl=CL&ceid=CL:es-419` | **`false`** |
| `https://news.google.com/rss/headlines` | **`false`** |
| `https://news.google.com/topics/x` | `true` |
| `https://news.google.com/` | `true` |

[VERIFIED: fetch real + `robots-parser@3.0.1` local, 2026-08-05]

Consecuencias directas:
1. En runtime, `BaseConnector.run()` ejecutaría el paso 2 (`robots.isAllowed`) → `false` →
   `log.skip(spec, "robots-disallow")` → **el feed de Google News nunca se descarga**. El SC4
   ("5 fuentes operan") sería **imposible de cumplir por construcción**, no por bug.
2. Cualquier "solución" que lo evite (UA spoofeado, saltarse `RobotsGuard`, allowlist que
   excluya el chequeo) **viola la regla LOCKED de CLAUDE.md §Ingesta** ("respeto robots.txt") y
   el propio SC1 de la fase. **No es una opción.**
3. El bloque adicional del mismo robots.txt lista explícitamente `anthropic-ai`, `ClaudeBot`,
   `Claude-Web`, `GPTBot`, `CCBot`, `PerplexityBot` con `Disallow: /` — señal de que Google
   endureció deliberadamente el acceso automatizado a `news.google.com`.

**Por eso NO se ejecutó el fetch de verificación #5 (Google News RSS Search).** Emitirlo habría
sido, en la misma sesión, violar el régimen que la fase existe para imponer. Es una omisión
deliberada, no un hueco de investigación.

**Escalamiento requerido (decisión de operador / Fable, no del planner):**

| Opción | Qué implica | Costo |
|---|---|---|
| **A. Descartar D-02** | 132 opera con los 4 medios directos verificados. SC4 se re-redacta a "4 fuentes". Se pierde el fan-out a 40+ outlets vía `<source>`; D-03 y D-04 (decoder base64url) quedan **sin objeto** y se borran de la fase. | Menos cobertura de outlets; **cero deuda de régimen**. Es la opción coherente con el resto de la fase. |
| **B. Sustituir Google News por N medios directos adicionales** | Ampliar el set de medios directos con feeds propios verificados (Ex-Ante verificó vivo — ver §Fuentes). Mantiene 5 fuentes. | Cada medio nuevo = un robots.txt + un feed que verificar; cobertura menor que el fan-out de Google News. |
| **C. Mantener D-02 con `[skip robots-disallow]` documentado** | El código queda escrito y el feed nunca corre. | **Falso verde**: un SC que dice "5 fuentes operan" con una que estructuralmente no opera. **Desaconsejado.** |

**Recomendación:** **Opción A**, con la puerta abierta a B como ampliación (los medios de la cola
legislativa entran como feeds directos, no vía Google News). Es la única que deja SC1 y SC4
simultáneamente verdaderos.

Efecto colateral bueno: con A, **D-04 (decoder base64url de URLs de Google News) desaparece**.
No hace falta investigar si el encoding `CBMi…` sigue decodificándose offline en 2026 — punto
que, además, es notoriamente inestable y habría sido el eslabón más frágil de la fase.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fuentes (NEWS-02)**
- **D-01: Los 4 medios directos parten con las 4 URLs PROBADAS de Is Chile Safe** (BioBioChile,
  Cooperativa, LaTercera, LaCuarta — `feeds.py:65-71` verificadas en producción ajena por meses).
  *Razón:* URLs verificadas > URLs supuestas; la cola de outlets legislativos (Ex-Ante, El
  Mostrador, Emol…) entra igual vía Google News `<source>` (40+ medios con 9 feeds en ICS).
  **Research PUEDE sustituir LaCuarta** por un medio de mayor densidad legislativa (Emol / El
  Mostrador / Ex-Ante) **solo si verifica su RSS vivo durante la investigación** (fetch real, no
  suposición). Si no se verifica, queda el set probado. El total queda en 4 — no se amplía.
- **D-02: Google News RSS Search con 3–5 queries legislativas**, builder heredado
  (`hl=es-419&gl=CL&ceid=CL:es-419`, `when:2d` en la query). Vocabulario de queries lo fija el
  plan (candidatos: `"proyecto de ley"`, `Congreso votación`, `boletín Senado|Cámara`,
  `urgencia legislativa`); las queries quedan congeladas en código con test.
  *Razón:* 5 queries fue suficiente en ICS para 40+ outlets; más queries = más carga al host
  sin señal nueva.
- **D-03: El outlet real de un ítem de Google News sale SIEMPRE del tag `<source>`** — jamás del
  título ni de la URL. (Patrón ICS `feeds.py:141-159`.)

**Decoder de URLs de Google News**
- **D-04: Solo decoder OFFLINE (base64url).** Prohibido el fallback por POST a `batchexecute`
  (endpoint interno no documentado de Google — contradice el régimen de ingesta respetuosa y es
  frágil por construcción). Si el decode offline falla: se conserva la URL de Google News y se
  marca `url_decodificada=false`. La URL canónica para dedup es la decodificada cuando existe,
  la de Google News cuando no.
  *Razón:* el contrato del sitio exige link a la fuente; un link vía Google News sigue siendo un
  link válido y trazable — no justifica un endpoint hack.

**Pre-filtro léxico legislativo (NEWS-02, SC4)**
- **D-05: El MECANISMO de ICS se hereda, el vocabulario se bota** (research doc §2): set
  determinista congelado en código, matching sobre titular+descripción normalizados
  (NFD → ascii → lowercase), cero LLM. Vocabulario legislativo nuevo: `proyecto de ley`,
  `boletín`, `sala`, `comisión`, `votación`, `indicación`, `veto`, `urgencia`, `moción`,
  `mensaje`, `Tribunal Constitucional`, `tramitación`, `promulgación`, `Senado`, `Cámara de
  Diputados`, `diputado/a`, `senador/a`… — lista exacta la fija el plan y queda con test.
- **D-06: El pre-filtro es RECALL-FIRST**: su trabajo es descartar lo obviamente no-legislativo,
  no clasificar. Falso positivo aceptable (lo filtra el clasificador de 135); falso negativo NO
  (esa noticia se pierde para siempre). Ante duda, pasa.
- **D-07: Todo descarte queda REGISTRADO y consultable**: URL vista → ledger en tabla Supabase
  con causa (`prefiltro_lexico`), jamás en el repo (lección ICS §5: `seen.json` de 887 KB
  commiteado es ruido). El conteo de descartes por corrida sale por query (`psql -tA`).

**Estructura del código**
- **D-08: Package nuevo `packages/news`** siguiendo el patrón de `packages/tramitacion` /
  `packages/agenda`. El conector **extiende `BaseConnector` de `@obs/ingest`** — el flujo
  invariante cache→robots→rate-limit→fetch→drift→R2→snapshot ya está construido y probado; el
  conector solo implementa los hooks (`endpoints`, `validateShape`, `fingerprint`).
  **Prohibido reimplementar rate-limit/robots/R2 dentro del package news.**
  *Razón:* los 4 huecos de ICS quedan cerrados POR CONSTRUCCIÓN al usar el framework — ningún
  código nuevo puede saltarse el régimen.
- **D-09: Etapa 2 (R2 → Supabase) es un módulo separado del conector** con CLI local
  (`run-news-cli` con flag `--from-r2`, patrón `ingest-cli` de tramitacion). El replay lee
  EXCLUSIVAMENTE de R2 — un test/corrida con red bloqueada (fetch inyectado que lanza) debe
  reproducir la carga completa.
- **D-10: Parser RSS con `fast-xml-parser@5`** (ya convención del stack para XML) — los feeds
  RSS/Atom son XML plano. Validación de forma con zod en la etapa 2.

**Schema Supabase (etapa 2)**
- **D-11: Nombres en español, singular** (convención del schema existente: `proyecto`,
  `citacion`). Tablas nuevas de 132: **`noticia`** (ítems que PASAN el pre-filtro: titular,
  outlet, fecha_pub, url original, url canónica, hash, referencia al crudo R2, estado del
  pipeline) y **`noticia_url_vista`** (seen-ledger: hash de url canónica, estado, causa,
  primera_vista — la idempotencia y el conteo de descartes viven acá).
  El detalle exacto de columnas lo fija el plan; estas dos tablas y su reparto de
  responsabilidades son LOCKED.
- **D-12: RLS habilitado deny-all en ambas tablas, cero policy `anon`, cero RPC pública** en
  132. El sitio no lee noticias hasta la 137 ⇒ no hay aguja nueva que pasar. Migración con el
  siguiente número libre por `ls supabase/migrations`, aplicada con
  `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (jamás `db push`).

**Dedup en 132**
- **D-13: Solo niveles 1-2 de ICS**: URL exacta contra el ledger + canonicalización (strip
  `utm_*` y tracking params). El id del ítem es `sha256(url_canonica)`. Similitud de títulos
  (nivel 3) y clustering de eventos (nivel 5) NO son de esta fase.

### Claude's Discretion
- Columnas exactas de las tablas, índices, nombres de archivos dentro de `packages/news`.
- Set exacto de keywords del pre-filtro y de queries de Google News (dentro de D-02/D-05),
  congelados con test.
- Manejo de encoding/CDATA en feeds heterogéneos.

### Deferred Ideas (OUT OF SCOPE)
- Full-text de artículos a bucket privado (restricción copyright ICS §8) → Phase 137.
- Clustering de eventos / similitud de títulos (nivel 3-5 de dedup ICS) → si alguna vez, spike
  posterior; no está en el roadmap.
- Warm-up anti-WAF Azure (ICS `cead/client.py`) — solo si un medio directo lo exige; no
  preconstruir.
- Cita APA-7 en español (`format_apa` de ICS) → útil recién en 137 (cita pública).

> **Nota del research:** D-02, D-03 y D-04 chocan con evidencia verificada (robots.txt de
> `news.google.com`). Ver ⛔ BLOCKER arriba. El planner **no puede** resolverlo por su cuenta:
> requiere adjudicación explícita.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción | Research Support |
|----|-------------|------------------|
| **NEWS-01** | Conector RSS en dos etapas LOCKED: robots.txt antes de cada host + rate-limit 2-3 s/host + UA identificatorio + RSS crudo content-addressed a R2 (`fuente/recurso/fecha/sha256.ext`, `If-None-Match: *`) → parseo SIEMPRE desde R2. Hash-check antes de descargar. | §Architecture Patterns (BaseConnector cubre los 4 huecos), §Don't Hand-Roll, §Pitfall 1 (allowlist SSRF bloquea los hosts de prensa), §Pitfall 3 (`decodeJson` y el crudo), §Pitfall 4 (cache-skip no loguea). Framework verificado línea a línea. |
| **NEWS-02** | Fuentes 100% RSS: 4 medios directos + Google News RSS Search; outlet real desde `<source>`; pre-filtro léxico legislativo determinista. | §Fuentes verificadas en vivo (4/4 medios directos HTTP 200, RSS 2.0, campos confirmados; densidad legislativa medida). **Google News: BLOQUEADO por robots.txt** — ver ⛔ BLOCKER. |
</phase_requirements>

## Summary

La fase es **ensamblaje sobre un framework ya construido y probado**, no infraestructura nueva.
`@obs/ingest` resuelve, con código verificado en este repo, exactamente los 4 huecos de régimen
de Is Chile Safe: `RobotsGuard` (hueco 1), `HostRateLimiter` + `PgHostThrottle` respaldado en
`util.reserve_host_slot` (hueco 2), `R2Store.putImmutable` content-addressed con
`If-None-Match: *` y 412=idempotente (huecos 3 y 4), y `DailyCache.hasToday` (hash-check antes de
descargar). `BaseConnector.run()` los encadena en un orden **no sobreescribible** — es la
evidencia estructural que pide el SC1.

La verificación en vivo confirma **los 4 medios directos de D-01**: los cuatro devuelven HTTP 200
con RSS 2.0 bien formado y los campos que la etapa 2 necesita (`title`, `link`, `guid`,
`pubDate`, `description`). Sus robots.txt permiten las rutas de feed. **No hay razón verificada
para sustituir LaCuarta**: Ex-Ante expone un RSS vivo y válido pero de solo 10 ítems y con 0/10
titulares legislativos en la muestra observada — cambiar un feed de 100 ítems por uno de 10 sería
un riesgo de cobertura con un cron diario, no una mejora.

El hallazgo grave es **`news.google.com/rss/` está prohibido por su robots.txt** para nuestro UA,
confirmado con la misma `robots-parser@3.0.1` del framework. D-02/D-03/D-04 requieren adjudicación
antes de planificar.

**Primary recommendation:** planificar 132 como conector `BaseConnector` sobre los **4 medios
directos verificados**, con los hosts de prensa entrando por `extraHosts` scoped al conector
(precedente `connector-servel.ts`) **jamás por `DEFAULT_ALLOWED_SUFFIXES`**, y escalar el bloqueo
de Google News a decisión de operador antes de escribir el plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Fetch de feeds RSS (robots, rate-limit, UA, SSRF) | `@obs/ingest` (framework) | — | La política vive UNA vez; el conector no puede saltarla (`BaseConnector.run` no es sobreescribible). |
| Persistencia de crudo content-addressed | `@obs/ingest` `R2Store` → Cloudflare R2 | — | Etapa 1 del régimen LOCKED. El crudo NUNCA entra a Postgres. |
| Rate-limit durable cross-invocación | Postgres (`util.reserve_host_slot`) | `HostRateLimiter` en proceso | Autoridad del 2-3 s/host es estado compartido, no memoria del isolate. |
| Provenance de la descarga | Postgres `source_snapshot` vía `SnapshotWriter` | — | Ya existe; el conector solo lo alimenta. |
| Parseo RSS + pre-filtro léxico + dedup | `packages/news` (Etapa 2, módulo separado) | — | D-09: lee de R2, nunca de la fuente. Determinista, testeable sin red. |
| Carga a `noticia` / `noticia_url_vista` | Postgres vía writer supabase-js (service_role) | — | D-11/D-12: deny-all, sin superficie pública. |
| Lectura pública de noticias | **Ninguno en 132** | — | D-12: el sitio no lee hasta la 137. |
| Clasificación LLM | **Fuera de fase** (135) | — | En 132 no se llama a ningún LLM. |

## Fuentes — verificación en vivo (2026-08-05)

Todas con `User-Agent: Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)`,
un request por recurso.

### robots.txt de los hosts de D-01

| Host | HTTP | Regla para `*` | Ruta del feed | Veredicto |
|---|---|---|---|---|
| `www.biobiochile.cl` | 200 | `User-agent: *` **sin reglas** (allow-all) | `/static/feed-rss` | ✅ PERMITIDO |
| `www.cooperativa.cl` | 200 | `Allow: /` + disallows específicos (`/xml/`, `/p4_noticias/`, `/cgi-bx/`, caches, `…/nuevataxport*`) | `/noticias/site/tax/port/all/rss_3_158__1.xml` | ✅ PERMITIDO (no cae bajo ningún `Disallow`) |
| `www.latercera.com` | 200 | `Allow: /`, `Disallow: /pf/api/v3/*`, `Disallow: /search/?q=*` | `/arc/outboundfeeds/rss/?outputType=xml` | ✅ PERMITIDO |
| `www.lacuarta.com` | 200 | `User-agent: *` / `Disallow:` (vacío = allow-all) | `/arc/outboundfeeds/rss/?outputType=xml` | ✅ PERMITIDO |
| `news.google.com` | 200 | `Disallow: /` + allowlist que **no incluye `/rss/`** | `/rss/search?...` | ⛔ **PROHIBIDO** |

[VERIFIED: fetch real 2026-08-05]

⚠️ **Cooperativa declara `Crawl-delay` en ningún grupo pero BioBioChile sí lo hace para `bingbot`
(`Crawl-delay: 1`)** — nuestro 2-3 s lo excede holgadamente. `robots-parser` expone
`getCrawlDelay(ua)`; **el framework hoy NO lo consulta**. No es blocker (2-3 s > cualquier
crawl-delay declarado aquí), pero conviene dejarlo escrito.

### Los 4 feeds directos

| Fuente | URL | HTTP | Content-Type | Bytes | Formato | Ítems |
|---|---|---|---|---|---|---|
| BioBioChile | `https://www.biobiochile.cl/static/feed-rss` | 200 | `application/octet-stream` | 224.577 | **RSS 2.0** (WordPress) | 20 |
| Cooperativa | `https://www.cooperativa.cl/noticias/site/tax/port/all/rss_3_158__1.xml` | 200 | `text/xml; charset=utf-8` | 42.997 | **RSS 2.0** | 15 |
| La Tercera | `https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml` | 200 | `application/xml; charset=utf-8` | 605.461 | **RSS 2.0** (Arc) | 100 |
| La Cuarta | `https://www.lacuarta.com/arc/outboundfeeds/rss/?outputType=xml` | 200 | `application/xml; charset=utf-8` | 590.283 | **RSS 2.0** (Arc) | 100 |

**Ninguno es Atom.** Cero `<entry>` en los cuatro. [VERIFIED: fetch real]

### Campos disponibles por ítem (medidos sobre el primer `<item>` real)

| Campo | BBCL | Cooperativa | La Tercera | La Cuarta |
|---|---|---|---|---|
| `<title>` | ✅ (con `&quot;` escapado) | ✅ CDATA | ✅ | ✅ |
| `<link>` | ✅ URL del artículo | ✅ | ✅ | ✅ |
| `<guid>` | ✅ pero es `?p=<id>` (**≠ link**) | ✅ **== link** | ✅ **== link** | ✅ **== link** |
| `<pubDate>` | ✅ `Wed, 05 Aug 2026 04:16:32 +0000` | ✅ `Tue, 04 Aug 2026 23:40:29 -0400` (**offset -0400**) | ✅ `+0000` | ✅ `+0000` |
| `<description>` | ✅ (HTML embebido) | ✅ | ✅ | ✅ |
| `<category>` | ✅ | ✅ | ✅ | ❌ |
| `<dc:creator>` | ✅ | ❌ (usa `<author>`) | ✅ | ✅ |
| `<content:encoded>` | ✅ | ❌ | ✅ | ✅ |
| `<media:content>` | ❌ | ❌ | ✅ | ✅ |
| No estándar | — | **`<timestamp>20260804234029`**, `<descent>` | — | — |

Notas de forma que el plan debe absorber:
- **`guid` NO sirve como identidad canónica** — BioBioChile emite `https://www.biobiochile.cl/?p=6912951`
  mientras el `<link>` es la URL SEO. D-13 dice `sha256(url_canonica)` derivado del **`<link>`**;
  correcto, mantenerlo así y **no** caer en la tentación de usar `guid`.
- `description` y `content:encoded` traen **HTML crudo con `<div>`, `<script>`, `<iframe>`, `<svg>`**
  (visto en BioBioChile y La Cuarta). El pre-filtro léxico debe normalizar/despojar tags antes de
  hacer matching, o `<script>` inflará falsos positivos.
- **Cooperativa emite `pubDate` con offset `-0400`** (hora de Chile) mientras los otros tres van en
  `+0000`. La columna de fecha debe ser `timestamptz` y el parseo debe respetar el offset del feed
  — **jamás** asumir UTC (gotcha rector v12.0/v9.0 del proyecto).
- Los cuatro declaran `<lastBuildDate>` en `<channel>`: cambia en cada corrida ⇒ **el sha256 del
  crudo cambiará casi siempre**, aunque no haya ítems nuevos. Ver Pitfall 5.

### Densidad legislativa (medida sobre los titulares de la corrida)

Regex de sondeo: `proyecto de ley|bolet|cámara de diputad|senad|diputad|congreso|comisión|votación|indicación|urgencia|moción|tramitación|tribunal constitucional|ministr`.

| Fuente | Titulares con léxico legislativo | Ítems |
|---|---|---|
| La Tercera | **12** | 100 |
| La Cuarta | **3** | 100 |
| BioBioChile | 1 | 20 |
| Cooperativa | 0 | 15 |

Ejemplos reales capturados en La Tercera: *"Senadores presentan bancada para impulsar proyecto de
indulto general…"*, *"Gobierno logra despachar a ley la megarreforma…"*. En La Cuarta: *"Congreso
despacha la Megarreforma del Gobierno: cómo votaron en el Senado…"*.

⇒ El pre-filtro descartará **~90-95 % de lo ingerido**. Es lo esperado y confirma D-07 (el conteo
de descartes debe ser observable) y D-06 (recall-first).

### Candidato a sustituir LaCuarta (D-01) — veredicto: **NO sustituir**

| Candidato | robots.txt | Feed probado | HTTP | Formato | Ítems | Léxico legislativo |
|---|---|---|---|---|---|---|
| **Ex-Ante** | 200, **cuerpo vacío** (allow-all) | `https://www.ex-ante.cl/feed/` | **200** | `application/rss+xml`, RSS 2.0, 79.609 B | **10** | **0/10** |
| El Mostrador | 200, `/feed/` no prohibido | `https://www.elmostrador.cl/feed/` | **404** (HTML) | — | 0 | — |
| El Mostrador | ídem | `https://www.elmostrador.cl/categoria/pais/feed/` | 200 pero devuelve **HTML del sitio**, no XML | — | 0 | — |
| Emol | 200, `/rss/` no prohibido | `https://www.emol.com/rss/rss.asp?canal=noticias` | 200 pero devuelve **HTML** (`<!DOCTYPE html>`) | — | 0 | — |

[VERIFIED: fetch real 2026-08-05]

**Ex-Ante es el único que verifica RSS vivo**, pero su ventana es de **10 ítems** frente a los 100
de La Cuarta, y en la muestra observada **ninguno** era legislativo. Con un cron diario, una
ventana de 10 ítems en un medio de publicación continua **pierde noticias entre corridas** — es el
mismo tipo de agujero silencioso que la fase existe para cerrar. **La Cuarta se queda** (D-01 por
defecto). Ex-Ante queda anotado como feed válido y verificado si en el futuro se amplía el set
(Opción B del blocker).

**No se hallaron rutas RSS vivas para Emol ni El Mostrador con los caminos probados.** Esto es un
"no lo encontré", no un "no existe" — [ASSUMED] que puedan existir bajo otras rutas.

## Standard Stack

### Core (todo ya en el repo — nada nuevo que instalar)

| Módulo | Fuente | Propósito | Por qué |
|---|---|---|---|
| `BaseConnector` | `@obs/ingest` (`base-connector.ts`) | Template Method del flujo invariante | Orden LOCKED no sobreescribible: cache → robots → hostThrottle → rateLimiter → fetch → shape → drift → R2 → snapshot. Es la evidencia del SC1. |
| `RobotsGuard` | `@obs/ingest` (`robots.ts`) | robots.txt por origin, cacheado, con `IDENTIFIED_UA` | Cierra hueco 1 de ICS. Fail-closed ante error de red; fail-open ante 404. |
| `HostRateLimiter` | `@obs/ingest` (`rate-limiter.ts`) | 2-3 s/host en proceso | Fast-path dentro del batch. |
| `PgHostThrottle` + `util.reserve_host_slot` | `@obs/ingest` + `supabase/migrations/0004_host_throttle.sql` | Autoridad durable del 2-3 s/host | Cierra hueco 2 de ICS de verdad (cross-invocación, no memoria del isolate). |
| `Fetcher` | `@obs/ingest` (`fetcher.ts`) | GET con UA identificatorio + allowlist SSRF; `RetryableError` en 429/5xx | UA identificatorio del SC1. |
| `R2Store.putImmutable` | `@obs/ingest` (`r2-store.ts`) | `{source}/{resource}/{date}/{sha256}.{ext}`, `If-None-Match: *`, 412=idempotente | Cierra huecos 3 y 4. **Literalmente la key que pide el SC2.** |
| `R2Store.getObject` | ídem | Lectura del crudo para el replay `--from-r2` | Base del SC3. |
| `DailyCache` | `@obs/ingest` (`cache.ts`) | `hasToday(source, resource, dateBucket)` contra `source_snapshot` | Hash-check "antes de descargar" del SC2 / `[skip]` de la re-corrida. |
| `SnapshotWriter` + `SupabaseSnapshotStore` | `@obs/ingest` | Provenance en `source_snapshot` | Ya existente; el conector lo alimenta. |
| `assertAllowedUrl` + `extraHosts` | `@obs/ingest` (`allowlist.ts`) | Deny-by-default SSRF | **Ver Pitfall 1 — sin esto los feeds de prensa NO pasan.** |
| `fast-xml-parser@5` | ya en el stack (Senado/BCN) | Parseo RSS 2.0 | D-10. Los 4 feeds son XML plano, sin namespaces complejos en la ruta crítica. |
| `zod` | ya en el stack | Validación de forma en Etapa 2 | D-10. |

**Instalación:** ninguna. `packages/news` declara `@obs/ingest`, `@obs/core`, `fast-xml-parser`,
`zod` y `@supabase/supabase-js` como deps de workspace, igual que `packages/tramitacion`.

### Alternativas consideradas

| En vez de | Se podría usar | Trade-off |
|---|---|---|
| `fast-xml-parser` | librería RSS dedicada (`rss-parser`, `feedparser`) | Dependencia nueva + salida opaca; los 4 feeds son RSS 2.0 plano y `fast-xml-parser` ya es convención LOCKED del stack. **No cambiar.** |
| `BaseConnector.run()` | orquestación a mano (patrón `connector-servel.ts`) | SERVEL evita `run()` **a propósito** porque su cache diaria saltaría re-corridas. Para news la cache diaria **es** el requisito (SC2 `[skip]`) ⇒ `run()` es el encaje correcto. |
| `<guid>` como identidad | — | BioBioChile emite `?p=<id>` ≠ link. D-13 (`sha256(url_canonica)` desde `<link>`) es correcto. |

## Package Legitimacy Audit

**No aplica.** La fase **no instala ningún paquete externo nuevo**: todas las dependencias
(`fast-xml-parser@5`, `zod`, `@supabase/supabase-js`, `aws4fetch`, `robots-parser@3.0.1`) ya están
instaladas y en uso en el repo. `slopcheck` no se ejecutó por ser innecesario — no hay superficie
de riesgo de slopsquatting en esta fase.

Si el plan introdujera algún paquete nuevo (no se prevé), debe correr el Package Legitimacy Gate
antes de instalarlo.

## Architecture Patterns

### Diagrama del sistema

```
                    ┌──────────── ETAPA 1: fuente → R2 (crudo) ────────────┐
                    │                                                      │
  run-news-cli ─────┤  NewsConnector extends BaseConnector<RssRaw>         │
  (local, operador) │        │                                             │
                    │        ▼  BaseConnector.run()  [ORDEN NO SOBREESCRIBIBLE]
                    │   ┌─────────────────────────────────────────┐        │
                    │   │ por cada endpoint (= 1 feed):           │        │
                    │   │  1. cache.hasToday(source,resource,hoy) │──sí──► [skip] (SC2)
                    │   │  2. robots.isAllowed(url)               │──no──► log.skip("robots-disallow")
                    │   │  3a. hostThrottle.reserve(host)  ◄──────┼────► Postgres util.reserve_host_slot
                    │   │  3b. rateLimiter.wait(host)  (2-3 s)    │        │
                    │   │  4. fetcher.get()  UA identificatorio   │──────► www.biobiochile.cl
                    │   │      + assertAllowedUrl (SSRF gate)     │──────► www.cooperativa.cl
                    │   │  5. validateShape + fingerprint         │──────► www.latercera.com
                    │   │  6. drift.check / alert (no bloquea)    │──────► www.lacuarta.com
                    │   │  7. sha256 → r2.putImmutable            │──────► R2  news/<feed>/<fecha>/<sha>.xml
                    │   │      If-None-Match:* ; 412 = idempotente│        │      (append-only, inmutable)
                    │   │  8. snapshot.write(provenance)          │──────► Postgres source_snapshot
                    │   └─────────────────────────────────────────┘        │
                    └───────────────────────┬──────────────────────────────┘
                                            │  SnapshotRef[] { r2Path, contentHash, ... }
                    ┌───────────────────────▼──── ETAPA 2: R2 → Supabase ──┐
                    │  run-news-cli --from-r2 <r2Path>                     │
                    │        │                                             │
                    │        ▼  r2Store.getObject(r2Path)  ── CERO RED A LA FUENTE
                    │   parseRss (fast-xml-parser@5)  →  items[]           │
                    │        ▼                                             │
                    │   canonicalizarUrl (strip utm_*, tracking)  [D-13]   │
                    │        ▼  id = sha256(url_canonica)                  │
                    │   ┌────────────────────────────────────┐             │
                    │   │ ¿ya en noticia_url_vista?          │──sí──► [dup] (no re-procesa)
                    │   └────────────────────────────────────┘             │
                    │        ▼  MARCAR VISTA ANTES DE CUALQUIER REJECT     │
                    │   preFiltroLexico(titulo + descripcion normalizados) │
                    │        │                                             │
                    │   ┌────┴─────┐                                       │
                    │  pasa      descarta ──► noticia_url_vista            │
                    │   │                      (causa='prefiltro_lexico')  │
                    │   ▼                        └─► conteo por psql -tA   │
                    │  noticia (titular, outlet, fecha_pub,                │
                    │           url, url_canonica, hash, r2_path, estado)  │
                    │  ── RLS deny-all, service_role-only [D-12] ──────────┘
                    │        └────► consumido por 134 / 135 / 137 (fases posteriores)
                    └──────────────────────────────────────────────────────┘
```

### Estructura de proyecto recomendada

```
packages/news/
├── package.json          # deps: @obs/ingest, @obs/core, fast-xml-parser, zod, @supabase/supabase-js
├── tsconfig.json         # references (NO paths a src — rompe `tsc -b`, gotcha Phase 43)
├── vitest.config.ts      # OBLIGATORIO: sin él el paquete queda CI-DARK (gotcha Phase 43)
└── src/
    ├── index.ts
    ├── feeds.ts               # set congelado de feeds (4 medios) + test que lo congela
    ├── connector-news.ts      # extends BaseConnector<RssRaw>; hooks endpoints/validateShape/fingerprint
    ├── parse-rss.ts           # fast-xml-parser → RssItem[]  (Etapa 2, puro, sin red)
    ├── model.ts               # zod schemas + tipos
    ├── canonicalizar-url.ts   # D-13 nivel 2 (strip utm_*, fbclid, gclid…)
    ├── prefiltro-lexico.ts    # D-05/D-06, set congelado + normalización NFD→ascii→lower
    ├── writer-supabase.ts     # noticia + noticia_url_vista (upsert idempotente)
    ├── writer.ts              # InMemory* para dry-run/tests
    ├── carga-run.ts           # Etapa 2 orquestada (lee de R2, escribe a Supabase)
    └── run-news-cli.ts        # CLI local: --dry-run, --from-r2, --service-key, --feeds
```

### Pattern 1: hosts de prensa vía `extraHosts` scoped al conector (NO en el default)

```ts
// packages/news/src/connector-news.ts
// Fuente: precedente literal en packages/dinero/src/connector-servel.ts:1-27
import { Fetcher, RobotsGuard, type AllowlistOptions } from "@obs/ingest";

/** Hosts EXACTOS de los feeds de prensa. Congelado + test. */
export const NEWS_HOSTS = [
  "www.biobiochile.cl",
  "www.cooperativa.cl",
  "www.latercera.com",
  "www.lacuarta.com",
] as const;

// extraHosts es EXACTO y scoped a este conector. JAMAS agregar a
// DEFAULT_ALLOWED_SUFFIXES: eso ampliaria la superficie SSRF de TODOS los
// conectores gubernamentales.
// CAVEAT (allowlist.ts:116-123): extraHosts admite TAMBIEN http => asercion
// https explicita, igual que connector-servel.ts:9.
const allowlist: AllowlistOptions = { extraHosts: NEWS_HOSTS };

const deps = {
  fetcher: new Fetcher({ allowlist }),
  robots: new RobotsGuard({ allowlist }), // #1: gatea el GET de robots.txt
  // ...
};
```

**Por qué así:** `assertAllowedUrl` es deny-by-default con
`DEFAULT_ALLOWED_SUFFIXES = [camara.cl, senado.cl, bcn.cl, leychile.cl, leylobby.gob.cl, cplt.cl,
infoprobidad.cl, mercadopublico.cl]`. Un feed de prensa **falla con `HostNotAllowedError
(host-no-allowlisted)`** si no se pasa allowlist. Y `RobotsGuard` con `allowlist` configurado
devolvería `HOST_BLOCKED` ⇒ `isAllowed=false` ⇒ el conector saltaría todos los feeds silenciosamente.

### Pattern 2: un `resource` distinto por feed

`DailyCache.hasToday(source, spec.resource, dateBucket)` cachea por **`(source, resource, fecha)`**,
y `source_snapshot` tiene unique `(source, resource, date_bucket)`. Si los 4 feeds comparten
`resource`, **solo el primero se descarga y los otros 3 salen `[skip]` para siempre**.

```ts
protected endpoints(): RequestSpec[] {
  return FEEDS.map((f) => ({
    url: f.url,
    resource: `rss-${f.slug}`,   // rss-biobiochile, rss-cooperativa, ...  UNICO por feed
    key: f.slug,
    ext: "xml",                  // el crudo es XML, no json (default)
  }));
}
```

`ext: "xml"` importa: el default de `RequestSpec.ext` es `"json"`, y el SC2 pide
`fuente/recurso/fecha/sha256.ext` con la extensión real.

### Pattern 3: replay `--from-r2` sin red (SC3)

```ts
// Espeja packages/tramitacion/src/ingest-cli.ts:221-266
if (opts.fromR2) {
  if (!r2Store) throw new NewsCliArgsError("--from-r2 requiere R2 configurado");
  const bytes = await r2Store.getObject(opts.fromR2);   // UNICA fuente de datos
  const items = parseRss(new TextDecoder().decode(bytes));
  return cargar({ items, writer, log });                 // cero fetch a medios
}
```

El test que lo prueba **debe inyectar un `fetch` que lanza**, no simplemente "no llamarlo":

```ts
const fetchQueExplota: typeof fetch = () => { throw new Error("RED PROHIBIDA EN REPLAY"); };
// ... y el test debe seguir pasando. Mutar el codigo (quitar --from-r2) => el test cae.
```

### Anti-patterns a evitar

- **Agregar hosts de prensa a `DEFAULT_ALLOWED_SUFFIXES`.** Amplía SSRF a todos los conectores.
  Usar `extraHosts` scoped (Pattern 1).
- **Reimplementar rate-limit/robots/R2 dentro de `packages/news`.** Prohibido por D-08 y anula
  la evidencia estructural del SC1.
- **Usar `<guid>` como identidad canónica.** BioBioChile emite `?p=<id>`.
- **Asumir UTC en `pubDate`.** Cooperativa emite `-0400`.
- **Un solo `resource` para los 4 feeds.** Ver Pattern 2.
- **`seen.json` (o cualquier ledger) commiteado al repo.** Lección ICS §5 / D-07.
- **Marcar la URL como vista DESPUÉS del reject.** ICS `scrape_news.py:292-296` es explícito:
  marcar **antes** de cualquier camino de rechazo, o los descartados se re-procesan eternamente.

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|---|---|---|---|
| Respetar robots.txt | parser propio de robots | `RobotsGuard` (`robots-parser@3.0.1`) | Longest-match, grupos por UA, fail-open/fail-closed ya resueltos y testeados. |
| 2-3 s entre requests al mismo host | `setTimeout` en el conector | `HostRateLimiter` + `PgHostThrottle` | El delay en proceso NO sobrevive entre invocaciones. La autoridad es Postgres. |
| Content-addressing en R2 | key a mano + PUT | `R2Store.putImmutable` | `If-None-Match: *` + 412=idempotente + firma SigV4 vía `aws4fetch` (nunca hand-roll de SigV4). |
| sha256 | librería de hash | `sha256Hex` (Web Crypto) | Nativo Node 22 / Deno, sin dependencia. |
| Defensa SSRF | validación ad-hoc de URL | `assertAllowedUrl` | Cubre loopback, RFC1918, link-local `169.254.169.254`, IPv6 ULA, IPv4-mapped, scheme. |
| Parseo XML | regex sobre el feed | `fast-xml-parser@5` | CDATA, entidades, namespaces, HTML embebido. |
| Extracción de boletines desde titulares | nuevo extractor | **`extraerBoletines` ya existe** (Phase 92, context-gated fail-closed) | Research doc §11: *"Reusarlo, no reescribirlo."* (Aunque su uso probablemente cae en 134/137, no en 132.) |
| Provenance | tabla nueva | `source_snapshot` + `SnapshotWriter` | Ya existe y es el contrato del framework. |

**Key insight:** en esta fase, **cada línea de infraestructura nueva es una regresión de régimen**.
El valor de 132 está en el ensamblaje correcto y en los tests que demuestran que el ensamblaje no
se puede eludir.

## Runtime State Inventory

Fase greenfield en su mayor parte, pero toca estado runtime existente. Las 5 categorías,
explícitas:

| Categoría | Encontrado | Acción requerida |
|---|---|---|
| **Datos almacenados** | `util_host_throttle` (fila nueva por cada host de prensa, creada sola). `source_snapshot` (filas nuevas con `source='news'`). Tablas `noticia`/`noticia_url_vista` **no existen** — las crea la migración 0084. | Ninguna migración de datos. Solo DDL nuevo. |
| **Config de servicio vivo** | **Ninguna en 132.** No hay cron nuevo (es Phase 136), no hay Edge Function nueva, no hay workflow de GitHub Actions. La corrida de verificación es **LOCAL por el operador** (CLAUDE.md §4: backfill masivo = LOCAL). | Ninguna. |
| **Estado registrado en el SO** | Ninguno — no se registran tareas ni procesos. | Ninguna. |
| **Secretos / env vars** | Reusa los existentes: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`, `SUPABASE_DB_URL`, `SUPABASE_LOCAL_SERVICE_KEY` / service key de PROD. **Cero secretos nuevos.** | Ninguna. |
| **Artefactos de build** | Paquete nuevo `packages/news` ⇒ requiere `pnpm install` para linkear el workspace, y `tsconfig` con `references` (no `paths` — rompe `tsc -b`). | `pnpm install` tras crear el package. |

**Namespace nuevo en R2:** `source='news'` bajo el bucket de crudo existente. No es un bucket
nuevo — verificar que la key `news/rss-<slug>/<fecha>/<sha>.xml` no colisione con nada previo
(no colisiona: ningún `source` actual se llama `news`).

## Common Pitfalls

### Pitfall 1 (CRÍTICO): la allowlist SSRF bloquea los hosts de prensa por defecto
**Qué sale mal:** el conector se escribe correctamente, corre, y todos los feeds fallan con
`HostNotAllowedError (host-no-allowlisted)` — o peor, `RobotsGuard` devuelve `HOST_BLOCKED` y los
4 feeds salen `[skip]` **silenciosamente**, dando un verde falso ("0 errores").
**Por qué pasa:** `DEFAULT_ALLOWED_SUFFIXES` (`allowlist.ts:19-28`) es solo gubernamental. Ningún
medio de prensa está ahí. [VERIFIED: lectura del código]
**Cómo evitarlo:** `extraHosts: NEWS_HOSTS` inyectado tanto en `Fetcher` **como** en `RobotsGuard`
(el guard gatea el GET de `robots.txt` con la misma allowlist, `robots.ts:105-111`). Más aserción
`https:` explícita porque `extraHosts` también permite `http` (`allowlist.ts:116-123`).
**Señal temprana:** una corrida que reporta 0 snapshots escritos y 0 errores.

### Pitfall 2 (CRÍTICO): `news.google.com/rss/` está prohibido por robots.txt
Ver ⛔ BLOCKER al inicio. **Señal temprana:** `log.skip(spec, "robots-disallow")` en la corrida.

### Pitfall 3: `BaseConnector.decodeJson` y qué recibe `validateShape`
**Qué sale mal:** el hook `validateShape(body)` recibe lo que devuelve `decodeJson`, que intenta
`JSON.parse` y ante fallo **devuelve el texto plano** (`base-connector.ts:189-198`). Para XML eso
significa que `validateShape` recibe un `string`, no un objeto.
**Cómo evitarlo:** `validateShape(body: unknown): RssRaw` debe tratar el input como `string` XML
y hacer un shape-guard **suave** (¿contiene `<rss` o `<feed`? ¿tiene al menos un `<item>`?), no un
zod estricto. El zod estricto vive en Etapa 2 (D-10).
**Ojo:** los bytes que van a R2 son `body` **crudo**, no lo que devuelve `validateShape`
(`base-connector.ts:159-169`) — correcto para el régimen. Confirmado.

### Pitfall 4: el skip por caché diaria NO se loguea
**Qué sale mal:** el SC2 pide que la re-corrida salga **`[skip]`**. `BaseConnector.run()` hace
`if (await cache.hasToday(...)) continue;` (`base-connector.ts:124`) — **sin llamar a
`log.skip`**. Solo el camino de robots loguea. La re-corrida saldría silenciosa y sin evidencia.
**Cómo evitarlo:** o el CLI compara `endpoints().length` contra `refs.length` y emite el `[skip]`
por diferencia, o se propone un cambio mínimo en `@obs/ingest` (añadir `log.skip(spec, "cache-hit")`)
**con test que caiga si se quita**. La primera opción no toca el framework compartido; **preferirla**.
**Señal temprana:** re-corrida con salida vacía en vez de `[skip]`.

### Pitfall 5: `<lastBuildDate>` hace que el sha256 cambie aunque no haya noticias nuevas
**Qué sale mal:** los 4 feeds emiten `<lastBuildDate>` (y La Tercera/La Cuarta `<ttl>1`,
`sy:updatePeriod hourly`) que cambia en cada request. El sha256 del crudo será distinto en cada
descarga ⇒ **`putImmutable` nunca devolverá 412** y R2 acumulará un objeto por corrida.
**Por qué no es blocker:** el hash-check "antes de descargar" del SC2 lo hace **`DailyCache`**
(por `(source, resource, fecha)`), no el sha256. La re-corrida del mismo día no descarga y por
tanto no calcula hash. El SC2 se cumple por la caché diaria, **no** por el 412.
**Cómo redactarlo:** la evidencia del SC2 es (a) el par corrida→re-corrida con `[skip]`, y (b) un
test unitario de `putImmutable` con el mismo body → `existed:true`. **No** prometer que la
re-corrida real produzca un 412 — no lo hará.
[VERIFIED: `<lastBuildDate>` presente y distinto en los 4 feeds, fetch real]

### Pitfall 6: `pubDate` con offsets distintos por medio
Cooperativa emite `-0400`; los otros tres `+0000`. Columna `timestamptz`, parseo que respete el
offset del feed. **Jamás** normalizar a una tz global (gotcha rector v12.0: eso fabricaría días).
Cooperativa además emite un `<timestamp>20260804234029` no estándar — **ignorarlo**, usar `pubDate`.

### Pitfall 7: `description`/`content:encoded` traen HTML crudo
BioBioChile y La Cuarta embeben `<div>`, `<script>`, `<iframe>`, `<svg>`, `<blockquote>`. El
pre-filtro léxico debe despojar tags antes de normalizar (NFD→ascii→lower), o palabras dentro de
atributos/scripts contaminan el matching. Además: **truncar** el texto que se indexa (ICS trunca a
300 chars por anti-prompt-injection; aquí no hay LLM, pero el truncado evita que un artículo largo
domine el matching).

### Pitfall 8: paquete nuevo CI-DARK
**Qué sale mal:** `packages/news` sin `vitest.config.ts` propio ⇒ **0 tests corren** y el CI sale
verde. Gotcha documentado en Phase 43 (memoria del proyecto).
**Cómo evitarlo:** `vitest.config.ts` en el paquete + verificar que el `pnpm test` de la raíz lo
incluye. Y `tsconfig` con `references`, **nunca** `paths` a `src` (rompe `tsc -b`).
**Señal temprana:** `vitest run` reporta `0 tests` con exit 0. Y ojo: `vitest run pkg/*algo*.test.ts`
sale 0 **sin correr nada** si el glob no matchea (gotcha v12.0).

### Pitfall 9: `process.cwd` bajo `pnpm --filter exec`
pnpm corre el script con `cwd` = directorio del paquete, no la raíz del workspace.
**Patrón establecido** (`packages/tramitacion/src/ingest-cli.ts:149-161`): `findWorkspaceRoot(start)`
sube desde `start` hasta encontrar `pnpm-workspace.yaml` y **lanza** si no lo halla. Copiarlo
literalmente en `run-news-cli.ts`. [VERIFIED: lectura del código]

### Pitfall 10: `--from-r2` que en realidad usa el parser en memoria
**Qué sale mal:** un "test de replay" que llama al parser con un fixture local y nunca toca
`r2Store.getObject` — certifica una omisión, no el replay.
**Cómo evitarlo:** el test debe (a) inyectar un `R2Store` fake que sirva bytes, (b) inyectar un
`fetch` que **lance**, y (c) **mutar el código** (quitar la rama `--from-r2`) y comprobar que el
test cae. Régimen v13.0.

### Pitfall 11: marcar la URL vista después del reject
Ver Anti-patterns. ICS lo documenta como bug que quema cuota indefinidamente. En 132 no hay cuota
LLM, pero el efecto es que el conteo de descartes de D-07 quedaría inflado/incorrecto y 135
re-clasificaría lo ya rechazado.

## Code Examples

### Hook `endpoints()` con `resource` único y `ext: "xml"`
```ts
// Fuente: contrato de packages/ingest/src/base-connector.ts:22-39 y 118-186
protected endpoints(): RequestSpec[] {
  return FEEDS.map((f) => ({
    url: f.url,          // el host se DERIVA de aqui (WR-01), spec.host se ignora
    resource: `rss-${f.slug}`,
    key: f.slug,
    ext: "xml",          // default es "json" -> hay que setearlo
  }));
}
```

### Shape-guard suave para XML (no zod aquí)
```ts
// decodeJson devuelve `string` cuando el body no es JSON (base-connector.ts:189-198)
protected validateShape(body: unknown): RssRaw {
  if (typeof body !== "string") throw new Error("news: crudo no textual");
  if (!/<rss[\s>]|<feed[\s>]/i.test(body)) throw new Error("news: no parece RSS/Atom");
  return { xml: body };
}
```

### Fingerprint estructural (drift) que ignora `lastBuildDate`
```ts
// El fingerprint alimenta drift.check, no la idempotencia. Debe reflejar la FORMA,
// no el contenido volatil: si lo calculamos sobre el XML completo, `lastBuildDate`
// dispara una alerta de drift en cada corrida (ruido puro).
protected async fingerprint(raw: RssRaw): Promise<string> {
  const tags = [...new Set([...raw.xml.matchAll(/<([a-zA-Z0-9:_-]+)[\s>/]/g)].map((m) => m[1]))]
    .sort()
    .join(",");
  return sha256Hex(new TextEncoder().encode(tags));
}
```

### `util.reserve_host_slot` — el gate durable ya en PROD
```sql
-- supabase/migrations/0004_host_throttle.sql (APLICADA; referenciada tambien por 0017)
-- Reserva atomica via INSERT ... ON CONFLICT DO UPDATE ... WHERE (guarda temporal).
-- Devuelve ms a esperar; 0 = puede pedir ya.
select util.reserve_host_slot('www.latercera.com', 2000);
```
`PgHostThrottle` lo consume vía `ReserveSlotRpc.reserveHostSlot(host, minIntervalMs)`
(`host-throttle.ts:19-21`), con `minIntervalMs` default 2000 y `maxWaitMs` 5000 →
`ThrottleDeferError` si el slot está más lejos. [VERIFIED: lectura de migración + código]

## State of the Art

| Antes (Is Chile Safe) | Ahora (Observatorio 132) | Impacto |
|---|---|---|
| robots.txt declarado pero **no implementado** (0 hits de `robots` en `pipeline/`) | `RobotsGuard` en el paso 2 del Template Method, no evitable | Hueco 1 cerrado — y es justamente lo que descubre el blocker de Google News |
| 9 requests RSS en ráfaga cada 6 h, sin delay | `hostThrottle.reserve` + `rateLimiter.wait` por request, host derivado de la URL | Hueco 2 cerrado, y **cross-invocación** (Postgres), no solo en proceso |
| RSS crudo parseado en memoria y **descartado** | `r2.putImmutable` del body crudo antes de cualquier parseo | Hueco 3 cerrado; habilita el replay del SC3 |
| Hash existía (`text_sha256`) pero key por id de URL | Key = `{source}/{resource}/{date}/{sha256}.{ext}` | Hueco 4 cerrado |
| `seen.json` de 887 KB commiteado al repo | `noticia_url_vista` en Postgres, deny-all | Repo limpio; conteos por `psql -tA` |
| Google News RSS Search operable (a la fecha de ICS) | **`Disallow: /` para `*`, sin `Allow` para `/rss/`** | ⛔ Cambio de estado del mundo que invalida D-02 |

**Deprecado/inválido:**
- El fallback `batchexecute` del decoder de Google News: ya prohibido por D-04 y ahora **moot**
  si se adopta la Opción A.
- Rutas RSS de Emol (`/rss/rss.asp?canal=noticias`) y El Mostrador (`/feed/`,
  `/categoria/pais/feed/`): devuelven HTML o 404 hoy. [VERIFIED: fetch real 2026-08-05]

## Project Constraints (from CLAUDE.md)

| Directiva | Cómo la cumple 132 |
|---|---|
| **Ingesta en DOS ETAPAS, siempre separadas y re-ejecutables** | Etapa 1 = `BaseConnector.run()` → R2. Etapa 2 = módulo separado que lee de R2 (D-09). |
| **Etapa 1: crudo content-addressed `fuente/recurso/fecha/sha256.ext`, `If-None-Match: *`, 412 = éxito** | `R2Store.putImmutable` literalmente implementa esa key y ese header. |
| **Etapa 2 lee de R2, NUNCA de la fuente** | `--from-r2` + test con `fetch` que lanza. |
| **Hash-check ANTES de descargar** | `DailyCache.hasToday` (paso 1, antes de robots y del fetch). Ver Pitfall 5 sobre qué evidencia sirve. |
| **Rate-limit 2-3 s/host, UA identificatorio, robots.txt, caché diaria. Nunca ráfagas** | Pasos 1-4 del Template Method, no sobreescribibles. |
| **Backfill masivo = LOCAL (operador), NO GitHub Actions** | `run-news-cli` es CLI local, patrón `ingest-cli`. Cero workflow nuevo en 132. |
| **Cron de novedades diario L-V** | Fuera de alcance (Phase 136). 132 no crea cron. |
| **Migraciones por `psql --single-transaction`, jamás `db push`** | D-12. Comando exacto en la cabecera de la migración (patrón 0070). |
| **`0073`/`0075` escritas y NO aplicadas — JAMÁS editarlas** | La migración de 132 es **0084** (siguiente libre; 0080-0083 tomadas). |
| **Tech stack TypeScript, `fast-xml-parser@5` para XML, `zod` para validación** | D-10. |
| **Todas las API keys en `.env`** | Cero secretos nuevos; reusa `R2_*` y `SUPABASE_*`. |
| **GSD workflow: no editar fuera de un comando GSD** | Research no escribe código de producción. |

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|---|---|---|---|---|
| Node | CLIs y tests | ✓ | 22.21.1 | — |
| `robots-parser` | `RobotsGuard` | ✓ | 3.0.1 (`packages/ingest/node_modules`) | — |
| `aws4fetch` | `R2Store` (SigV4) | ✓ | instalado en `packages/ingest` | — |
| `fast-xml-parser` | parseo RSS | ✓ (en uso por Senado/BCN) | 5.x | — |
| `zod` | validación Etapa 2 | ✓ | en el stack | — |
| Cloudflare R2 (`R2_*`) | Etapa 1 y replay | ✓ (memoria: token Read&Write validado) | — | Sin R2 el CLI degrada con `[WARN] R2 no configurado` — **no aceptable para 132**, R2 es el corazón del SC2/SC3 |
| `SUPABASE_DB_URL` (PROD) | migración 0084 | ✓ (memoria: DDL remoto vía psql funciona) | — | — |
| `psql` con `PGCLIENTENCODING=UTF8` | aplicar migración + conteos `-tA` | ✓ (uso recurrente en el proyecto) | — | — |
| `util.reserve_host_slot` en PROD | `PgHostThrottle` | ✓ (migración 0004, referenciada por 0017) | — | Opcional en `ConnectorDeps` (`hostThrottle?`) — sin él solo aplica el limiter en proceso |
| Red hacia los 4 medios | corrida de verificación | ✓ (los 4 respondieron 200 en esta sesión) | — | — |
| Red hacia `news.google.com/rss/` | D-02 | ⛔ **prohibida por robots.txt** | — | **Sin fallback legítimo** — ver BLOCKER |

**Dependencias faltantes sin fallback:** acceso permitido a `news.google.com/rss/` (bloquea D-02/D-03/D-04).
**Dependencias faltantes con fallback:** ninguna.

## Validation Architecture

### Test Framework
| Propiedad | Valor |
|---|---|
| Framework | **vitest** (convención del monorepo) |
| Config file | `packages/news/vitest.config.ts` — **no existe, Wave 0** |
| Quick run | `pnpm --filter @obs/news test` |
| Full suite | `pnpm test` (raíz) |
| pgTAP | `supabase/tests/0084_noticia.test.sql` — **no existe, Wave 0** |

### Phase Requirements → Test Map

| Req | Comportamiento | Tipo | Comando automatizado | ¿Existe? |
|---|---|---|---|---|
| NEWS-01 / SC1 | El conector pasa por `BaseConnector.run()` y el rate-limiter recibe `wait(host)` por cada request al mismo host | unit | `pnpm --filter @obs/news test -- connector-news` | ❌ Wave 0 |
| NEWS-01 / SC1 | robots-disallow ⇒ `log.skip` y **cero** `fetcher.get` | unit | ídem | ❌ Wave 0 |
| NEWS-01 / SC1 | El host usado por robots/rate-limit se deriva de `new URL(spec.url).host`, no de `spec.host` (WR-01) | unit | ídem | ❌ Wave 0 |
| NEWS-01 / SC1 | Los hosts de prensa pasan `assertAllowedUrl` con `extraHosts`, y un host arbitrario **no** | unit | `pnpm --filter @obs/news test -- allowlist-news` | ❌ Wave 0 |
| NEWS-01 / SC2 | Key R2 = `news/rss-<slug>/<fecha>/<sha256>.xml`; mismo body ⇒ `existed:true` (412) | unit | `pnpm --filter @obs/news test -- r2-key` | ❌ Wave 0 |
| NEWS-01 / SC2 | Segunda corrida del mismo día ⇒ `[skip]`, cero `fetcher.get` | unit | ídem | ❌ Wave 0 |
| NEWS-01 / SC2 | Corrida real + re-corrida inmediata contra los 4 feeds | **manual (operador, LOCAL)** | `pnpm --filter @obs/news exec tsx src/run-news-cli.ts` ×2 | ❌ Wave 0 |
| NEWS-01 / SC3 | Replay `--from-r2` con `fetch` que **lanza** reproduce la carga | unit | `pnpm --filter @obs/news test -- replay` | ❌ Wave 0 |
| NEWS-02 / SC4 | Parseo de los 4 feeds desde **fixtures reales** capturados hoy | unit | `pnpm --filter @obs/news test -- parse-rss` | ❌ Wave 0 |
| NEWS-02 / SC4 | Set de feeds congelado (test que cae si alguien cambia una URL) | unit | `pnpm --filter @obs/news test -- feeds` | ❌ Wave 0 |
| NEWS-02 / SC4 | Pre-filtro léxico: recall-first, casos positivos y negativos, normalización NFD | unit | `pnpm --filter @obs/news test -- prefiltro` | ❌ Wave 0 |
| NEWS-02 / SC4 | Conteo de descartes observable por query | integration | `psql -tA -c "select causa, count(*) from noticia_url_vista group by 1"` | ❌ Wave 0 |
| D-12 | RLS deny-all: `has_table_privilege('anon', 'noticia', 'select') = false`, ídem `authenticated` | pgTAP | `psql -tA -f supabase/tests/0084_noticia.test.sql` | ❌ Wave 0 |
| D-13 | `canonicalizarUrl` strip `utm_*`; `sha256(url_canonica)` estable | unit | `pnpm --filter @obs/news test -- canonicalizar` | ❌ Wave 0 |

### Sampling Rate
- **Por commit de tarea:** `pnpm --filter @obs/news test`
- **Por merge de wave:** `pnpm test` (raíz) + `tsc -b`
- **Gate de fase:** suite completa verde + pgTAP de 0084 contra el schema **aplicado** + corrida
  LIVE del operador con su re-corrida `[skip]`, antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/news/vitest.config.ts` — **sin esto el paquete es CI-DARK** (gotcha Phase 43)
- [ ] `packages/news/tsconfig.json` con `references` (nunca `paths` a `src`)
- [ ] `packages/news/package.json` + `pnpm install` para linkear el workspace
- [ ] `packages/news/src/__fixtures__/` — **capturar los 4 XML reales de esta corrida**
      (ya descargados; el plan debe re-capturarlos o recuperarlos, ver nota abajo)
- [ ] `supabase/tests/0084_noticia.test.sql` — pgTAP de RLS deny-all
- [ ] Verificar que el `pnpm test` de la raíz incluye `packages/news`

> **Fixtures:** los 4 feeds fueron descargados durante esta investigación a
> `…/scratchpad/{bbcl,coop,lt,lc}.xml` (+ `exante.xml`, `gn-robots.txt`). Son efímeros; el plan
> debe capturarlos como fixtures propios **en la corrida LIVE de la fase**, no re-descargarlos
> aparte (una descarga por recurso).

## Security Domain

### Categorías ASVS aplicables

| Categoría ASVS | Aplica | Control estándar |
|---|---|---|
| V2 Authentication | no | 132 no expone superficie de usuario; service_role-only |
| V3 Session Management | no | ídem |
| V4 Access Control | **sí** | RLS `enable row level security` **sin policy** en `noticia` y `noticia_url_vista`; cero grant a `anon`/`authenticated` (patrón 0070). El lockdown-guard (Block D y E) lo enforcea. |
| V5 Input Validation | **sí** | XML de terceros no confiable: `fast-xml-parser@5` (sin resolución de entidades externas) + zod en Etapa 2 + despojo de HTML antes del pre-filtro. |
| V6 Cryptography | **sí (indirecto)** | SigV4 vía `aws4fetch`; sha256 vía Web Crypto. **Nunca hand-roll** (T-01-05). |
| V12 Files/Resources (SSRF) | **sí, crítico** | `assertAllowedUrl` deny-by-default + `extraHosts` scoped. Ver Pitfall 1. |

### Patrones de amenaza para este stack

| Patrón | STRIDE | Mitigación estándar |
|---|---|---|
| SSRF vía URL de feed manipulada | Information Disclosure / EoP | `assertAllowedUrl`: bloquea loopback, RFC1918, `169.254.169.254`, IPv6 ULA, IPv4-mapped, scheme≠https. `extraHosts` **exactos**, nunca sufijos. |
| Ampliar `DEFAULT_ALLOWED_SUFFIXES` con hosts de prensa | EoP | Prohibido; usar `extraHosts` scoped al conector (precedente `connector-servel.ts:7-9`). |
| XXE / entity expansion en el XML del feed | DoS / Info Disclosure | `fast-xml-parser` no resuelve entidades externas por diseño. **No** cambiar a un DOM parser. |
| HTML/JS embebido en `description` llegando al sitio | XSS (diferido a 137) | En 132 no hay render público (D-12). Guardar el texto **despojado** y dejar el crudo en R2. |
| Redirect de un medio hacia un host interno | SSRF | `Fetcher` **no** re-valida por hop de redirect (ICS sí lo hace, `fulltext.py:58-115`). En 132 solo se piden feeds de hosts conocidos ⇒ riesgo bajo, pero **anotarlo**: si un feed empieza a redirigir, la validación solo ocurrió en la URL inicial. Deuda conocida del framework, no de esta fase. |
| Filtración de credenciales R2 en mensajes de error | Info Disclosure | Ya cubierto: `R2Store` lanza `R2 PUT ${status} para ${key}` sin credenciales (T-01-06). |

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|---|---|---|
| A1 | Los `pubDate` observados representan el formato estable de cada feed | Fuentes | Parseo de fechas falla en ítems no observados → fecha nula o corrida rota. Mitigar con parseo tolerante + test sobre fixtures reales. |
| A2 | Los 4 feeds mantienen sus ventanas (20/15/100/100 ítems) | Fuentes | Una ventana más chica con cron diario pierde noticias. Mitigar: 136 fija la frecuencia con este dato. |
| A3 | Emol y El Mostrador no exponen RSS bajo **otras** rutas no probadas | Fuentes | Solo afecta la Opción B del blocker. "No lo encontré" ≠ "no existe". |
| A4 | La corrida LIVE del operador ocurrirá desde una IP no bloqueada por los medios | Environment | Un WAF de medio podría responder 403 (precedente: WAF de camara.cl bloquea Node fetch pero no curl). **Los 4 feeds respondieron 200 a curl en esta sesión; no se probó con `fetch` de Node.** ⚠️ Riesgo real — el plan debería incluir una tarea temprana que valide con el `Fetcher` real. |
| A5 | El bucket R2 de crudo acepta el namespace `news/` sin configuración extra | Runtime State | Solo es prefijo de key; R2 no requiere crear "carpetas". Riesgo bajo. |
| A6 | El robots.txt de `news.google.com` no cambiará antes de ejecutar la fase | BLOCKER | Si Google reabriera `/rss/`, D-02 revive. **Re-verificar al ejecutar**, no confiar en este documento. |

> **A4 merece atención del planner.** La verificación de esta sesión usó `curl`, no el `Fetcher`
> de `@obs/ingest` (Node `fetch` + UA identificatorio). La memoria del proyecto documenta
> exactamente este falso verde con camara.cl. **Primera tarea del plan: probar UN feed con el
> `Fetcher` real antes de escribir el resto del conector.**

## Open Questions

1. **¿Google News se descarta (A), se sustituye por más medios directos (B), o se deja inerte (C)?**
   - Sabemos: `/rss/` está prohibido por robots.txt para nuestro UA, confirmado con la librería
     exacta del framework.
   - No está claro: cuánta cobertura de outlets legislativos se pierde con la Opción A.
   - Recomendación: **Opción A**, y que 137 evalúe ampliar medios directos si la cobertura resulta
     insuficiente. Requiere adjudicación de Fable/operador **antes** de planificar, porque cambia
     SC4 y borra D-03/D-04.

2. **¿El SC4 se re-redacta a "4 fuentes operan"?**
   - Consecuencia mecánica de la Opción A. El planner **no debe** escribir un plan cuyo SC sea
     inalcanzable por construcción (sería el patrón de falso verde que la memoria del proyecto
     documenta repetidamente).

3. **¿Se toca `@obs/ingest` para loguear el skip por caché (Pitfall 4)?**
   - Sabemos: `BaseConnector.run()` hace `continue` sin loguear.
   - Recomendación: **no tocar el framework compartido**; que el CLI derive el `[skip]` comparando
     `endpoints().length` vs `refs.length`. Si el planner prefiere tocar el framework, exige test
     que caiga al revertir + revisión de que no rompe conectores existentes.

4. **¿`fingerprint` sobre el XML completo o sobre la forma?**
   - `<lastBuildDate>` volátil dispararía `drift.alert` en cada corrida (ruido).
   - Recomendación: fingerprint estructural (set ordenado de tags), como en el ejemplo de §Code
     Examples. Es discreción del planner (D-08 solo fija que el hook existe).

5. **¿Los feeds responden igual al `Fetcher` de Node que a `curl`?**
   - Ver A4. Se resuelve con una tarea de verificación temprana, no con más research.

## Sources

### Primarias (HIGH)
- Lectura directa del código del repo: `packages/ingest/src/{base-connector,r2-store,robots,fetcher,cache,host-throttle,allowlist,index}.ts`
- `packages/tramitacion/src/ingest-cli.ts` (patrón CLI, `--from-r2`, `findWorkspaceRoot`)
- `packages/dinero/src/connector-servel.ts` (precedente `extraHosts` para host no gubernamental)
- `supabase/migrations/0004_host_throttle.sql` (RPC `util.reserve_host_slot`, aplicada)
- `supabase/migrations/0070_notificacion_envio.sql` (convención de tabla + RLS deny-all + comando de apply)
- `ls supabase/migrations` → último = `0083_coautoria_v2.sql` ⇒ **siguiente libre = 0084**
- `.planning/research/v13.0-is-chile-safe-ingesta.md` (diseño heredado y sus 4 huecos)
- Fetch real 2026-08-05 de: `news.google.com/robots.txt`, `www.biobiochile.cl/robots.txt`,
  `www.cooperativa.cl/robots.txt`, `www.latercera.com/robots.txt`, `www.lacuarta.com/robots.txt`,
  `www.emol.com/robots.txt`, `www.elmostrador.cl/robots.txt`, `www.ex-ante.cl/robots.txt`
- Fetch real 2026-08-05 de los 4 feeds de D-01 + `ex-ante.cl/feed/`, `elmostrador.cl/feed/`,
  `elmostrador.cl/categoria/pais/feed/`, `emol.com/rss/rss.asp?canal=noticias`
- Evaluación de `news.google.com/robots.txt` con `robots-parser@3.0.1` instalado en
  `packages/ingest/node_modules` y el UA `IDENTIFIED_UA` real

### Secundarias (MEDIUM)
- Memoria del proyecto (gotchas v8.1 `process.cwd`, Phase 43 CI-DARK/`paths`, v12.0 falsos verdes,
  v9.0/v12.0 fechas y tz, v3.0 WAF de camara.cl bloquea Node fetch pero no curl)

### Terciarias (LOW)
- Ninguna. **No se usó WebSearch**: todo lo decisivo se resolvió con fetch real y lectura de código.

### No consultadas deliberadamente
- `https://news.google.com/rss/search?...` — **prohibido por su robots.txt**. Consultarlo habría
  violado, en la misma sesión, el régimen que esta fase existe para imponer.

## Metadata

**Desglose de confianza:**
- **Blocker de Google News:** HIGH — fetch real + evaluación con la librería exacta del framework.
- **Stack estándar:** HIGH — todo leído línea a línea en el repo; cero dependencias nuevas.
- **Fuentes (4 medios):** HIGH — fetch real, HTTP 200, formato y campos confirmados sobre ítems reales.
- **Veredicto de sustitución de LaCuarta:** MEDIUM-HIGH — Ex-Ante verificado vivo; la densidad
  legislativa se midió sobre **una sola muestra** de cada feed.
- **Arquitectura / patrones:** HIGH — derivada del código, no de suposición.
- **Pitfalls:** HIGH para 1, 3, 4, 5, 6, 7, 9 (verificados en código o en los feeds); MEDIUM para
  8, 10, 11 (heredados de memoria del proyecto e ICS).
- **Riesgo A4 (`Fetcher` vs `curl`):** sin verificar — tarea explícita para el plan.

**Research date:** 2026-08-05
**Valid until:** 2026-08-12 (7 días — los robots.txt y los feeds de prensa son volátiles;
**re-verificar el robots.txt de `news.google.com` al ejecutar**)

---

*Phase: 132-NEWS-RSS — Conector RSS dos-etapas LOCKED*
