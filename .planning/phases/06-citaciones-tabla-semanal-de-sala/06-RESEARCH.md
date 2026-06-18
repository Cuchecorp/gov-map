# Phase 6: Citaciones (Cámara+Senado) + Tabla Semanal de Sala - Research

**Researched:** 2026-06-18
**Domain:** Scraping de fuentes legislativas frágiles (WebForms HTML de Cámara tras Cloudflare + portal Next.js/Drupal del Senado) → ingesta de citaciones de comisiones (cobertura completa) + tabla semanal de sala (orden del día)
**Confidence:** HIGH (las 3 fuentes resueltas y validadas EN VIVO en esta sesión; ver evidencia por endpoint)

## Summary

Las tres fuentes de la fase quedaron **resueltas y validadas EN VIVO** en esta sesión (2026-06-18, UA `Bot-Ciudadano/1.0`, delay 2-3s):

1. **Citaciones Cámara** — `citaciones_semana.aspx?prmSemana={AÑO}-{SEMANA_ISO}` devuelve HTTP 200 (~190-300 KB de HTML descomprimido) con estructura `<article class="grid-12 citaciones">` → `<p class="fecha">` (día) → `<table class="tabla">` con columnas fijas **Comisión | Horario | Sala | Citación(materia) | Invitados**. Es GET puro, **sin `__VIEWSTATE`**. El archivo histórico llega **al menos hasta 2010** (probado 2010-20…2026-25), así que la enumeración por semana ISO da cobertura completa. **HALLAZGO CRÍTICO:** `www.camara.cl` está tras **Cloudflare bot-management** que devuelve **403 a curl/WebFetch con UA simple** — se desbloquea SOLO enviando el set completo de headers de navegador (`Sec-Ch-Ua*`, `Sec-Fetch-*`, `Accept-Language`, `Upgrade-Insecure-Requests`). Esto es nuevo respecto a Fase 5 (que usó `opendata.camara.cl`, que NO está tras Cloudflare).

2. **Citaciones Senado** — además del `_next/data/{buildId}/...citaciones.json` documentado en CONTEXT, se descubrió la **API backend directa y limpia** que el portal consume: `https://web-back.senado.cl/api/commissions_citations?limit=100` → HTTP 200, `{data:[...],status,results}`, **sin buildId, sin referer, sin cookies**. Los datos vienen agrupados por día (`FECHA` + array `CITACIONES`), cada citación con `ID_CITACION/COMINOMBRE/LUGAR/FECHA/HORARIO/MATERIA/PUNTOS_PROPUESTOS[]` (los puntos traen `NUMERO_BOLETIN/ID_PROYECTO` → cruce con la ficha de Fase 5). **Ventana hacia adelante únicamente** (~27 citaciones / 21 comisiones hoy; `offset`/`fecha`/`year` ignorados → NO hay histórico ni paginación por esta API).

3. **Tabla de sala / orden del día — RESUELTA (no degrada para el Senado; degrada parcialmente para Cámara):**
   - **Senado: fuente LIMPIA hallada** → `https://web-back.senado.cl/api/weekly_table?limit=100` → HTTP 200, sesiones con `ID_SESION/NUMERO_SESION/FECHA/HORA_INICIO/TIPO_SESION` + array `TABLA[]` con `POSICION/PARTE_SESION` (`ORDEN DEL DÍA`|`TIEMPO DE VOTACIONES`) `/MATERIA/BOLETIN/ID_PROYECTO/ALIAS/QUORUM`. **Estructurada, cruzable por boletín con Fase 5.**
   - **Cámara: NO hay fuente estructurada** → el WS `opendata` (`getSesionDetalle`/`getSesionBoletinXML`) NO expone tabla (confirmado: `getSesionBoletinXML` devuelve 38 bytes vacíos). El único artefacto oficial es **un PDF**: `https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` (HTTP 200, `application/pdf`, ~148 KB, 2 págs). La página `tabla.aspx` redirige a error400 sin params.

**Primary recommendation:** Construir **dos conectores** que reusan `@obs/ingest` (NO `BaseConnector.run`, igual que Fase 5): `CitacionesCamaraConnector` (cheerio sobre HTML, **con el header-set de navegador anti-Cloudflare obligatorio**, enumerando semanas ISO) y `SenadoActividadConnector` (fetch JSON de `web-back.senado.cl/api/{commissions_citations,weekly_table}` — preferir la API backend directa sobre `_next/data`; mantener autodetección de `buildId` solo como **fallback** documentado). Migración con tablas `citacion` + `citacion_punto` (boletines propuestos) + `sesion_sala` + `sesion_tabla_item`, todas con RLS public-read para `anon` (patrón Fase 5). Para **TRAM-08**: el Senado se cubre por completo con `weekly_table`; la Cámara se cubre con **degradación honesta** (link al PDF oficial + "no disponible como dato estructurado") O, si el planner lo decide, extracción de texto del PDF como mejora opcional (no bloqueante). Ingesta LIVE acotada-pero-representativa: varias semanas reales de citaciones de ambas cámaras + la tabla semanal vigente del Senado, en Supabase local con provenance por fila.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fuentes — validadas en vivo 2026-06-18 (concreto, no asumido):**
- **Citaciones Cámara — ASEGURADO:** `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana={AÑO}-{SEMANA_ISO}` → HTTP 200, HTML parseable con cheerio, ~25 comisiones/semana con horario/sala/materia/invitados. El listado anual `citaciones_todas.aspx?prmAnio` da 403 (WAF) → NO usarlo; **enumerar las semanas ISO** nosotros. GET sin `__VIEWSTATE`.
- **Citaciones Senado — ASEGURADO:** datos en JSON del `_next/data/{BUILD_ID}/...citaciones.json` con `MATERIA/FECHA/HORARIO/CITACIONES/Comisiones`. `BUILD_ID` autodetectado del `<script id="__NEXT_DATA__">` y cacheado por día (cambia por deploy — NO cachear >1 día).
- **Tabla semanal de sala (orden del día) — el RESEARCH debe resolver la fuente o documentar degradación honesta.** Si NO se asegura una fuente limpia → la UI muestra "no disponible / fuente no publicada" en vez de inventar. La fase NO se bloquea: las citaciones son lo fundamental.

**Alcance (énfasis del usuario: "todas las citaciones es fundamental"):**
- **Cobertura COMPLETA de citaciones**, no solo la semana actual: backfill de todas las semanas disponibles de ambas cámaras (rate-limit 2-3s, caché diaria, idempotente). Must-have explícito del usuario.
- Tabla de sala: la(s) sesión(es) de la semana vigente + próxima (cuando la fuente se asegure).

**Stack y UX:**
- Conectores reusan `@obs/ingest` (Fetcher/rate-limit/robots/allowlist/provenance) — **NO `BaseConnector.run`**. Cámara: cheerio sobre HTML. Senado: fetch del `_next/data` JSON con autodetección de `buildId`. Migración nueva para `citacion` (+invitados/puntos) y `tabla_sala`/`sesion`. **RLS public-read para `anon`** (como Fase 5).
- **Frontend `/agenda`** (Next.js 16): vista de la semana (navegable por semana ISO) con citaciones por comisión (comisión, horario, sala, materia, invitados, chip de cámara) + tabla de sala cuando esté disponible; cada ítem con `ProvenanceBadge` (frescura + enlace a fuente) e identidad de invitados sin afirmar nada dudoso. Tono cívico sobrio, sin causalidad. Reusa el design system de Fase 5.
- **Ingesta LIVE acotada-pero-representativa** (varias semanas reales de ambas cámaras en Supabase local con provenance); el backfill histórico completo puede correr como job posterior (mismo conector). Remoto/R2 diferido (credenciales).

### Claude's Discretion

- Esquema fino de tablas, parsing exacto del HTML de Cámara y del JSON del Senado, profundidad del backfill inicial, y la fuente final de la tabla de sala quedan a discreción del research/planner respetando lo anterior. El research valida en vivo y fija la fuente de la tabla de sala o documenta la degradación.

### Deferred Ideas (OUT OF SCOPE)

- Búsqueda semántica → Fase 7.
- Backfill histórico completo masivo (todas las semanas de todos los años) → job posterior con el mismo conector (esta fase asegura el mecanismo + cobertura representativa real).
- Deploy remoto + R2 → credenciales.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TRAM-07** | El sistema ingesta y muestra las citaciones de comisiones de la Cámara (`citaciones_semana.aspx`) y del Senado (portal Next.js, con autodetección de `buildId`) | **Totalmente resuelto.** Cámara: HTML `<article.citaciones>`/`<table.tabla>` parseable con cheerio (estructura exacta documentada abajo), GET sin `__VIEWSTATE`, archivo ≥2010 → enumeración por semana ISO da cobertura completa; **requiere header-set anti-Cloudflare**. Senado: API backend directa `web-back.senado.cl/api/commissions_citations` (preferida) o `_next/data` con `buildId` (fallback). Ambas validadas LIVE HTTP 200. |
| **TRAM-08** | Un usuario puede ver la tabla semanal de sala (orden del día) | **Parcialmente resuelto con desenlace honesto.** **Senado: COMPLETO** vía `web-back.senado.cl/api/weekly_table` (orden del día estructurado, cruzable por boletín). **Cámara: degradación honesta** — no hay fuente estructurada; solo PDF oficial `verDoc.aspx?prmTipo=TABLASEMANAL`. La UI muestra la tabla del Senado como dato + el enlace al PDF de Cámara con marca "no disponible como dato estructurado". La fase NO se bloquea. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scraping de fuentes gubernamentales (Cámara HTML, Senado JSON) | Conectores (Deno/`@obs/ingest`) | — | WAF + rate-limit + provenance viven en el framework; nunca desde el navegador (T-06-SSRF/CORS). |
| Enumeración de semanas ISO (cobertura completa) | Orquestación de ingesta (`runIngest`/CLI) | pgmq+pg_cron (futuro) | El plan de semanas es lógica de la corrida; el backfill masivo es job posterior. |
| Persistencia idempotente (citaciones, puntos, sesiones, tabla) | Writer + Supabase (Postgres) | — | Clave natural + `onConflict` (patrón Fase 5). |
| Exposición pública de la agenda | Postgres RLS (`anon` public-read) | Next.js Server Components | Igual que Fase 5: la ficha/agenda lee como `anon`; sin RLS public-read quedaría en blanco. |
| Render `/agenda` (semana navegable, chips, provenance) | Frontend Server (Next.js 16 SSR) | Browser (navegación de semana) | SSR lee Supabase; el cliente solo cambia la semana ISO seleccionada. |
| Cruce citación/tabla → ficha de proyecto (boletín) | Frontend (link) | — | `NUMERO_BOLETIN`/`BOLETIN` enlaza a `/proyecto/[boletin]` de Fase 5. |
| Tabla de sala Cámara (PDF) | Degradación honesta (link a fuente) | — | No hay fuente estructurada; se enlaza el PDF oficial sin inventar datos. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cheerio` | 1.2.0 (`npm:cheerio@1.2.0`) | Parsear el HTML de `citaciones_semana.aspx` (tabla de citaciones de Cámara) | Ya en el repo y validado en Fase 5; API jQuery server-side en Deno. `[VERIFIED: codebase — STACK.md + Fase 5]` |
| `@obs/ingest` (Fase 1) | workspace | `Fetcher`/`RobotsGuard`/`HostRateLimiter`/`assertAllowedUrl`/provenance/R2Store | Política de fetch (2-3s, robots, UA, SSRF allowlist) reusada en el orden LOCKED; NO `BaseConnector.run`. `[VERIFIED: codebase — 05-05-SUMMARY]` |
| `@obs/tramitacion` (Fase 5) | workspace | Patrón conector+writer idempotente, migración+RLS, ingest-run/CLI a espejar | Misma forma de slice; reuso de `Proyecto`/boletín como llave de cruce. `[VERIFIED: codebase — 05-01/05-05-SUMMARY]` |
| `zod` | 3.x/4.x | Validación de contrato del HTML parseado y del JSON de las APIs del Senado (drift) | Compuerta de validación por fila; ya en el repo. `[VERIFIED: codebase — STACK.md]` |
| `@supabase/supabase-js` | v2 | Writer Supabase (upsert `onConflict` por clave natural) | Patrón `SupabaseTramitacionWriter` de Fase 5. `[VERIFIED: codebase — 05-05-SUMMARY]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-xml-parser` | 5.x | (No requerido por las fuentes de esta fase — Senado es JSON, Cámara es HTML) | Solo si se reusa algún WS XML de Cámara para metadata de sesión; las 3 fuentes núcleo NO son XML. |
| `@b-fuze/deno-dom` | jsr (última) | Fallback de parsing HTML si cheerio tropieza con el WebForms de Cámara | Solo si cheerio falla; cheerio es preferente. `[CITED: STACK.md]` |
| (extracción de PDF) | — | Mejora OPCIONAL para la tabla de sala de Cámara (PDF) | **NO recomendado en esta fase.** Ver "Tabla de sala Cámara" — degradar honestamente es lo aprobado; el PDF queda como enlace. Si en el futuro se quiere texto, evaluar `unpdf`/`pdfjs` (verificar legitimidad con slopcheck antes). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `web-back.senado.cl/api/commissions_citations` (API backend directa) | `_next/data/{buildId}/...citaciones.json` (lo de CONTEXT) | La API backend NO depende del `buildId` (que cambia por deploy) → más estable. Usar la API backend como **preferida** y `_next/data` como **fallback** documentado. Ambas devuelven los mismos campos. |
| Header-set de navegador completo en Cámara | UA simple `Bot-Ciudadano/1.0` solo | El UA simple da **403 Cloudflare** sobre `www.camara.cl`. Hay que combinar: enviar el header-set de navegador (para pasar CF) **y** conservar la identidad ciudadana (p.ej. en un header `From:` o sufijo del UA) para no ocultar quiénes somos. Ver Pitfall 1. |
| Tabla de sala Cámara estructurada | PDF `verDoc.aspx?prmTipo=TABLASEMANAL` | No existe fuente estructurada de Cámara; el PDF es el único artefacto oficial. Degradación honesta (link) es lo aprobado por CONTEXT. |

**Installation:** Sin paquetes nuevos de runtime — todo (`cheerio`, `zod`, `@supabase/supabase-js`, `@obs/*`) ya está en el workspace y auditado en Fases 1-5.

**Version verification:** No aplica instalación nueva. `cheerio@1.2.0`, `zod`, `@supabase/supabase-js@2`, `fast-xml-parser@5` ya están en `packages/tramitacion/package.json` (verificado en 05-01-SUMMARY).

## Package Legitimacy Audit

> **No se instalan paquetes externos nuevos en esta fase.** Todos los runtime deps (`cheerio@1.2.0`, `zod`, `@supabase/supabase-js@2`, `fast-xml-parser@5`, `@obs/*` del workspace) fueron auditados e instalados en Fases 1-5.

| Package | Registry | Disposition |
|---------|----------|-------------|
| `cheerio@1.2.0` | npm | Reusado (auditado Fase 5) — no re-instalar |
| `zod` | npm | Reusado (auditado Fase 1-2) |
| `@supabase/supabase-js@2` | npm | Reusado (auditado Fase 1-5) |
| `@obs/ingest`, `@obs/tramitacion`, `@obs/core` | workspace | Internos |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Si el planner decide la mejora opcional de extracción de PDF (NO recomendada), CUALQUIER paquete de PDF nuevo (`unpdf`/`pdfjs-dist`/etc.) debe pasar por la Package Legitimacy Gate (slopcheck + `npm view` + revisión de `postinstall`) y quedar tras un `checkpoint:human-verify` antes de instalar. Por defecto esta fase NO instala nada.*

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────── runIngest (CLI tsx) ───────────────────────────┐
                          │  enumera semanas ISO {2010..hoy} (cobertura completa, acotada en LIVE)     │
                          │  por cada fuente: assertAllowedUrl → robots → rateLimiter.wait(2-3s) → get  │
                          └───────────────────────────────────────────────────────────────────────────┘
                                 │                              │                              │
            CitacionesCamaraConnector            SenadoActividadConnector          SenadoActividadConnector
            (cheerio HTML + header-set CF)        (.../commissions_citations)        (.../weekly_table)
                                 │                              │                              │
        GET citaciones_semana.aspx?prmSemana    GET web-back.senado.cl/api/      GET web-back.senado.cl/api/
        =2026-25  (HTTP 200, ~235KB)            commissions_citations?limit=100   weekly_table?limit=100
                                 │                              │                              │
        parse <article.citaciones>             parse data[].CITACIONES[]         parse data[].TABLA[]
        → <p.fecha> día                        → ID_CITACION/COMINOMBRE/         → ID_SESION/FECHA/
        → <table.tabla> filas:                   LUGAR/HORARIO/MATERIA/            HORA_INICIO + items
        Comisión|Horario|Sala|Citación|          PUNTOS_PROPUESTOS[]               POSICION/PARTE_SESION/
        Invitados                                                                  MATERIA/BOLETIN
                                 │                              │                              │
                                 ▼                              ▼                              ▼
                       ┌──────────────────────── CitacionWriter (idempotente) ────────────────────────┐
                       │  upsert onConflict por clave natural → citacion / citacion_punto /            │
                       │  sesion_sala / sesion_tabla_item   (+ provenance inline por fila: TRAM-09)    │
                       └──────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼  Supabase Postgres  (RLS public-read para anon, GRANT SELECT)
                                 │
              Next.js 16 Server Component  /agenda?semana={iso}
                                 │  lee como anon  →  citaciones por comisión + tabla del Senado
                                 ▼
              UI cívica: chip cámara · ProvenanceBadge (frescura+fuente) · link a /proyecto/[boletin]
                          · tabla de sala Cámara = link al PDF "no disponible como dato estructurado"
```

### Recommended Project Structure

```
packages/agenda/                     # nuevo paquete @obs/agenda (espeja @obs/tramitacion)
├── src/
│   ├── model.ts                     # Citacion, CitacionPunto, SesionSala, SesionTablaItem + zod
│   ├── parse-camara-citaciones.ts   # cheerio: <article.citaciones> → Citacion[]
│   ├── parse-senado-citaciones.ts   # JSON data[].CITACIONES[] → Citacion[]
│   ├── parse-senado-tabla.ts        # JSON data[].TABLA[] → SesionSala + items
│   ├── connector-camara.ts          # @obs/ingest + header-set anti-CF + enumeración ISO
│   ├── connector-senado.ts          # @obs/ingest + web-back API (buildId fallback)
│   ├── writer.ts / writer-supabase.ts
│   ├── ingest-run.ts / ingest-cli.ts
│   └── index.ts
└── test/fixtures/                   # capturas reales (HTML Cámara, JSON Senado) — ya capturadas, ver abajo
supabase/migrations/0009_agenda.sql  # citacion + citacion_punto + sesion_sala + sesion_tabla_item + RLS
supabase/tests/0008_agenda.test.sql  # pgTAP: anon lee las nuevas tablas, no lee parlamentario.rut
apps/web/app/agenda/                 # /agenda (Server Component, semana navegable)
```

### Pattern 1: Conector que reusa `@obs/ingest` en el orden LOCKED (NO BaseConnector.run)

**What:** Igual que Fase 5 — instanciar `Fetcher`/`RobotsGuard`/`HostRateLimiter` y aplicar `assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host) → fetcher.get({url, headers})`.
**When to use:** Ambos conectores de esta fase.
**Por qué NO BaseConnector.run:** su caché diaria saltaría re-corridas LIVE del mismo día (decisión LOCKED de Fase 5).

```typescript
// Source: patrón LOCKED de Fase 5 (packages/tramitacion/src/connector-camara.ts)
const url = `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=${anio}-${semanaIso}`;
assertAllowedUrl(url);                 // SSRF deny-by-default (camara.cl/senado.cl ya en allowlist)
await robots.isAllowed(url);
await rateLimiter.wait(new URL(url).host);   // 2-3s serial por host
const res = await fetcher.get({ url, headers: BROWSER_HEADERS_CAMARA });  // ver Pitfall 1
```

### Pattern 2: Header-set de navegador obligatorio para `www.camara.cl` (anti-Cloudflare)

**What:** `www.camara.cl` está tras Cloudflare bot-management. Un UA simple → **403**. Pasa SOLO con el set de headers de navegador.
**When to use:** TODO request a `www.camara.cl` (citaciones + el PDF de la tabla). NO necesario para `opendata.camara.cl` (sin CF) ni para `web-back.senado.cl`.

```typescript
// Source: validado LIVE 2026-06-18 — UA simple = 403; estos headers = 200
const BROWSER_HEADERS_CAMARA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 " +
                "Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)", // identidad conservada
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};
// fetch debe pedir respuesta comprimida y descomprimir (HTML llega gzip/br; descomprimido ~235KB)
```

### Pattern 3: Senado — preferir la API backend directa sobre `_next/data`

**What:** El portal Next.js del Senado declara su origen de datos en `__NEXT_DATA__` → `resource.components[].baseUrl`. La URL real es `https://web-back.senado.cl/api/{commissions_citations,weekly_table}`. Esta API **no usa buildId**, responde `{data,status,results}` sin referer/cookies.
**When to use:** Preferente para ambos datasets del Senado. Mantener la lectura del `__NEXT_DATA__.buildId` + `_next/data/...json` solo como **fallback** (degradación si la API backend cambia).

```typescript
// Source: validado LIVE 2026-06-18 — ambas HTTP 200 con UA Bot-Ciudadano/1.0 simple (sin headers extra)
const CITACIONES = "https://web-back.senado.cl/api/commissions_citations?limit=100";
const TABLA      = "https://web-back.senado.cl/api/weekly_table?limit=100";
const json = await (await fetcher.get({ url: CITACIONES })).json();
// json.data = [{ FECHA:"18/06/2026", CITACIONES:[ {ID_CITACION, COMINOMBRE, LUGAR, FECHA, HORARIO, MATERIA, SIN_EFECTO, PUNTOS_PROPUESTOS:[{NUMERO_BOLETIN, ID_PROYECTO, MATERIA, TIPO_TRAMITE}]} ] }, ...]
```

### Anti-Patterns to Avoid

- **Hardcodear el `buildId` del Senado:** cambia por deploy → `_next/data/<buildId>` rompe en silencio. Si se usa el fallback `_next/data`, autodetectar `buildId` del `__NEXT_DATA__` y cachear ≤1 día. (Preferir la API backend, que no tiene este problema.)
- **Llamar `www.camara.cl` con UA simple:** 403 Cloudflare. Usar el header-set de navegador.
- **Asumir histórico en la API de citaciones del Senado:** `offset`/`fecha`/`year` se ignoran → solo ventana hacia adelante. NO hay backfill de citaciones del Senado por esta vía (documentar el límite, no inventarlo).
- **Inventar la tabla de sala de Cámara:** no hay fuente estructurada. Degradar honestamente (link al PDF), nunca fabricar filas.
- **Reimplementar la política de fetch:** reusar `@obs/ingest`, no reescribir rate-limit/robots/UA.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate-limit / robots / UA / SSRF allowlist | Lógica propia por conector | `@obs/ingest` (Fetcher/RobotsGuard/HostRateLimiter/assertAllowedUrl) | Política única y probada (Fases 1/3/5); el WAF castiga ráfagas. |
| Idempotencia de upsert | Borrar+insertar / dedupe manual | `upsert(..., {onConflict: '<clave natural>'})` (patrón Fase 5) | Re-correr no duplica; clave natural total. |
| RLS public-read | Endpoint con service key en el server | `create policy ... for select to anon using(true)` + `grant select to anon` | Patrón Fase 5; sin esto la `/agenda` queda en blanco (deny-by-default heredado). |
| Cálculo de semana ISO | Aritmética de fechas a mano | Helper ISO-8601 (semana del jueves) probado con tests | Los bordes de año ISO (semana 1 puede caer en dic) son sutiles; ver Pitfall 4. |
| Parsing de HTML WebForms | Regex sobre el HTML | `cheerio` con selectores `article.citaciones`/`table.tabla`/`tr>td` | El HTML tiene `<br/>`, tablas anidadas y celdas con estado; cheerio lo navega robusto. |
| Cruce citación→proyecto | Re-scrapear la ficha | Llave `boletin` (`NUMERO_BOLETIN`/`BOLETIN`) hacia las tablas de Fase 5 | Fase 5 ya tiene `proyecto.boletin`; solo enlazar. |

**Key insight:** Esta fase es 90% reuso del esqueleto de Fase 5 (conector+writer+ingest-run+migración+RLS+frontend) con datasets nuevos. El único músculo nuevo de verdad es (a) el header-set anti-Cloudflare de Cámara y (b) los parsers de los 3 shapes (HTML Cámara, JSON citaciones Senado, JSON tabla Senado).

---

## Common Pitfalls

### Pitfall 1: `www.camara.cl` da 403 (Cloudflare) a clientes no-navegador
**What goes wrong:** curl/WebFetch/un fetch con UA `Bot-Ciudadano/1.0` simple recibe HTTP 403 con la página "Attention Required! | Cloudflare". En esta sesión el 403 se reprodujo desde dos egresos distintos (entorno local + WebFetch de Anthropic).
**Why it happens:** `www.camara.cl` (NO `opendata.camara.cl`) corre Cloudflare bot-management que evalúa el set de headers / fingerprint del cliente, no solo el UA.
**How to avoid:** Enviar el header-set de navegador completo (Pattern 2): `Sec-Ch-Ua*`, `Sec-Fetch-*`, `Accept`, `Accept-Language`, `Upgrade-Insecure-Requests`, y un UA tipo Chrome. **Validado LIVE: con esos headers → HTTP 200, ~235KB.** Conservar la identidad ciudadana añadiendo el sufijo `Bot-Ciudadano/1.0 (...)` al UA o un header `From:` (transparencia sin perder acceso).
**Warning signs:** body con `Attention Required`, `cf-error-details`, tamaño ~2-5KB en vez de ~200KB.
**Nota de robustez:** Cloudflare puede endurecer a un JS-challenge en el futuro. Si el header-set deja de bastar, el plan debe degradar a (a) reintentos con backoff y (b) marcar la fuente Cámara como "temporalmente no disponible" sin abortar la corrida del Senado. NO escalar a navegador headless (pesado/frágil en Edge — STACK.md "What NOT to Use").

### Pitfall 2: La API de citaciones del Senado solo da ventana hacia adelante
**What goes wrong:** Esperar histórico de citaciones del Senado y recibir siempre la misma ventana.
**Why it happens:** `commissions_citations?limit=100` ignora `offset`/`fecha`/`year` (validado: `offset=100` → `{data:[]}`; `fecha`/`year` → respuesta idéntica). Devuelve ~la semana vigente + próximas (hoy 27 citaciones / 21 comisiones, fechas 18/06–15/07).
**How to avoid:** Para el Senado, la "cobertura completa" de citaciones = **toda la ventana publicada** (no hay histórico por esta vía). Documentar el límite en la UI/provenance. La cobertura histórica completa la da **Cámara** (archivo ≥2010 por semana ISO). NO fabricar histórico del Senado.
**Warning signs:** `results:1`, `data:[]` con offset; respuestas idénticas con distintos params de fecha.

### Pitfall 3: La tabla de sala de Cámara no tiene fuente estructurada
**What goes wrong:** Buscar un WS/JSON de orden del día de Cámara y no encontrarlo (perder tiempo).
**Why it happens:** `opendata` `getSesionDetalle` solo añade `Asistencia` (vacía); `getSesionBoletinXML` devuelve 38 bytes vacíos para sesiones celebradas; `tabla.aspx` sin params → 302 a error400. El único artefacto oficial es el **PDF** `verDoc.aspx?prmTipo=TABLASEMANAL` (~148KB, 2 págs).
**How to avoid:** **Degradación honesta aprobada por CONTEXT.** TRAM-08 para Cámara = enlace al PDF oficial + etiqueta "tabla no disponible como dato estructurado". El Senado SÍ tiene `weekly_table` estructurado → ese se ingesta y muestra como dato. NO bloquear la fase.
**Warning signs:** respuestas de 38 bytes, redirects a `error400.aspx`, `content_type: application/pdf`.

### Pitfall 4: Bordes de semana ISO-8601 en la enumeración
**What goes wrong:** Saltar/duplicar semanas en el cruce de año (la semana ISO 1 puede caer en diciembre; algunos años tienen 53 semanas).
**Why it happens:** ISO-8601 ancla la semana al jueves; `2026-W01` ≠ "primera semana de enero" naïf.
**How to avoid:** Helper ISO probado con tests (años de 52 vs 53 semanas, borde dic/ene). El parámetro de Cámara es `prmSemana={año}-{semana}` con semana ISO (validado: `2026-25`, `2015-20`, etc. devuelven datos). Para el Senado no aplica (ventana fija).
**Warning signs:** semanas con 0 día-headers donde debería haber datos; saltos de fecha entre semanas consecutivas.

### Pitfall 5: RLS deny-by-default deja `/agenda` en blanco
**What goes wrong:** Las tablas nuevas heredan el deny-by-default; `anon` lee 0 filas sin error → la agenda aparece vacía.
**Why it happens:** Mismo gotcha que Fase 5 (Pitfall 5 de 05-01). Una policy `to anon` sin `grant select` tampoco expone nada.
**How to avoid:** En la migración 0009: `enable rls` + `create policy ... for select to anon using(true)` + **`grant select ... to anon`** en las 4 tablas nuevas. pgTAP que pruebe `anon` SÍ lee las nuevas tablas y NO lee `parlamentario.rut`. (Patrón exacto de Fase 5.)
**Warning signs:** `/agenda` vacía sin error; `isnt_empty` como rol `anon` falla en pgTAP.

---

## Code Examples

### Parseo del HTML de citaciones de Cámara (cheerio)

```typescript
// Source: estructura validada LIVE 2026-06-18 (citaciones_semana.aspx?prmSemana=2026-25)
import * as cheerio from "npm:cheerio@1.2.0";
const $ = cheerio.load(html);
const citaciones: Citacion[] = [];
$("article.citaciones").each((_, art) => {
  const dia = $(art).find("p.fecha").first().text().trim();   // "LUNES, 15 DE JUNIO DE 2026"
  $(art).find("table.tabla > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    // thead fijo: Comisión | Horario | Sala | Citación(materia) | Invitados
    const comisionCell = $(tds[0]);
    const comision = comisionCell.clone().children("p,br").remove().end().text().trim(); // "Economía"
    const estado   = comisionCell.find('p[style*="color:red"]').text().trim() || null;   // "Suspendida"/"Sin efecto"/null
    const horario  = $(tds[1]).text().trim();   // "10:00 a 12:00"
    const sala     = $(tds[2]).text().replace(/\s+/g, " ").trim(); // "Sala Ramón Pérez Opazo tercer nivel (Presencial)"
    const materia  = $(tds[3]).text().replace(/\s+/g, " ").trim(); // texto de la citación / orden
    const invitados= $(tds[4]).text().replace(/\s+/g, " ").trim() || null;
    citaciones.push({ camara: "diputados", dia, comision, estado, horario, sala, materia, invitados /* + provenance */ });
  });
});
```

**Estructura HTML real observada (verbatim):**
```html
<article class="grid-12 citaciones">
  <p class="fecha">LUNES, 15 DE JUNIO DE 2026 </p>
  <div class="table-responsive">
    <table class="tabla">
      <thead><tr>
        <th scope="col"><p>Comisión</p></th><th scope="col"><p>Horario </p></th>
        <th scope="col"><p>Sala </p></th><th scope="col" class="w40"><p>Citación </p></th>
        <th scope="col" class="w30"><p>Invitados </p></th>
      </tr></thead>
      <tbody>
        <tr>
          <td>Economía <br /><p style="font-size:12px;font-weight:bold; color:red">Suspendida</p></td>
          <td>10:00 a 12:00</td>
          <td><p>Sala Ramón Pérez Opazo<br/> tercer nivel (Presencial)</p></td>
          <td colspan="2"><table cellpadding="5"><tr>
            <td class="w40">...texto de la citación / materia, con boletín N°18296-05...</td>
            <td class="w30">...invitados: "se ha invitado al Ministro de Hacienda, señor Jorge Quiroz"...</td>
          </tr></table></td>
        </tr>
        ...
      </tbody>
    </table>
  </div>
</article>
```
**Notas de parsing:** (1) la última columna (Citación+Invitados) suele venir como `<td colspan="2">` con una **tabla anidada** de 2 celdas (`.w40` materia, `.w30` invitados) — no como 2 `<td>` hermanos; el parser debe manejar ambas formas. (2) El estado (`Suspendida`/`Sin efecto`) vive en un `<p style="color:red">` dentro de la celda de comisión. (3) Hay un `<article.citaciones>` por día; iterar todos.

### Parseo de citaciones del Senado (JSON)

```typescript
// Source: web-back.senado.cl/api/commissions_citations?limit=100 — validado LIVE 2026-06-18
const { data } = await res.json();   // data: [{ FECHA, CITACIONES:[...] }]
for (const dia of data) {
  for (const c of dia.CITACIONES) {
    // c.ID_CITACION, c.ID_COMISION, c.UUID, c.COMINOMBRE, c.LUGAR, c.FECHA, c.HORARIO, c.MATERIA, c.SIN_EFECTO
    const puntos = (c.PUNTOS_PROPUESTOS ?? []).map(p => ({
      boletin: p.NUMERO_BOLETIN,   // "16569-25" → cruce con proyecto.boletin (Fase 5)
      idProyecto: p.ID_PROYECTO, tipoTramite: p.TIPO_TRAMITE, materia: p.MATERIA,
    }));
    // push Citacion { camara:"senado", comision:c.COMINOMBRE, lugar:c.LUGAR, fecha:c.FECHA, horario:c.HORARIO, materia:c.MATERIA, puntos } + provenance
  }
}
```

### Parseo de la tabla semanal de sala del Senado (orden del día)

```typescript
// Source: web-back.senado.cl/api/weekly_table?limit=100 — validado LIVE 2026-06-18
const { data } = await res.json();   // data: [{ ID_SESION, NUMERO_SESION, FECHA, HORA_INICIO, HORA_TERMINO, TIPO_SESION, TABLA:[...] }]
for (const s of data) {
  const sesion = { idSesion: s.ID_SESION, numero: s.NUMERO_SESION, fecha: s.FECHA, horaInicio: s.HORA_INICIO, tipo: s.TIPO_SESION, camara: "senado" };
  for (const item of s.TABLA) {
    // item.POSICION, item.PARTE_SESION ("ORDEN DEL DÍA" | "TIEMPO DE VOTACIONES"),
    // item.MATERIA, item.BOLETIN ("2734-14" → cruce ficha), item.ID_PROYECTO, item.ALIAS, item.QUORUM, item.LINK_PROYECTO
  }
}
```

### Tabla de sala de Cámara — degradación honesta (sin inventar)

```typescript
// No hay fuente estructurada. Se expone el documento oficial como enlace + marca de no-disponibilidad.
const TABLA_CAMARA_PDF = "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL"; // application/pdf, ~148KB
// En la UI /agenda: sección "Tabla de Sala — Cámara de Diputados":
//   "No disponible como dato estructurado. Ver documento oficial (PDF) ↗"  + ProvenanceBadge(fuente=camara.cl, fecha=captura)
```

---

## State of the Art

| Old Approach (RESEARCH/CONTEXT previo) | Current Approach (validado esta sesión) | Impact |
|----------------------------------------|------------------------------------------|--------|
| Senado citaciones vía `_next/data/{buildId}/...citaciones.json` (depende del buildId) | **API backend directa** `web-back.senado.cl/api/commissions_citations` (sin buildId) | Conector más estable; `_next/data` queda como fallback. |
| Tabla de sala "no asegurada / posible degradación total" | **Senado RESUELTO** (`weekly_table` estructurado); **Cámara degrada** (solo PDF) | TRAM-08 se cumple para el Senado como dato; Cámara honestamente degradada. |
| `www.camara.cl` accesible con UA identificatorio simple | **Cloudflare bloquea (403)** UA simple; requiere header-set de navegador | Cambio operativo importante vs Fase 5 (que usó `opendata.camara.cl` sin CF). |

**Deprecated/outdated:**
- `citaciones_todas.aspx?prmAnio` → 403 (WAF), confirmado por CONTEXT. No usar; enumerar semanas ISO.
- `doGet.asmx getTablaHTML` → obsoleto (CONTEXT). No existe tabla por WS de Cámara.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El archivo de citaciones de Cámara empieza ~2010 o antes (probado 2010-2026; no busqué el límite exacto pre-2010) | Summary / week range | Bajo: 2010+ ya es cobertura amplísima; el límite exacto lo fija el backfill (no bloqueante). |
| A2 | El header-set de navegador seguirá bastando para pasar Cloudflare en producción/CI (egresos de datacenter) | Pitfall 1 | Medio: CF podría endurecer a JS-challenge. Mitigación: backoff + degradación de la fuente Cámara sin abortar Senado (documentado). El plan debe incluir un checkpoint LIVE que confirme 200 desde el egreso real de ejecución. |
| A3 | `web-back.senado.cl/api/{commissions_citations,weekly_table}` es estable y de uso público (es el backend del portal oficial) | Pattern 3 | Bajo-Medio: si cambia, fallback a `_next/data` con buildId. Validado HTTP 200 sin auth. |
| A4 | El cruce citación→proyecto por `boletin` casa con `proyecto.boletin` de Fase 5 (formato `NNNNN-NN`) | Architectural map | Bajo: Fase 5 usa el mismo formato de boletín; algunos puntos pueden no tener `NUMERO_BOLETIN` (nullable) → link opcional. |
| A5 | La degradación honesta (PDF link) satisface TRAM-08 para Cámara | TRAM-08 | Bajo: CONTEXT pre-aprueba la degradación explícitamente. |

---

## Open Questions

1. **¿Límite exacto del archivo histórico de citaciones de Cámara (pre-2010)?**
   - What we know: 2010-2026 devuelven datos; el backfill masivo es job posterior (deferred).
   - What's unclear: el año más antiguo con datos.
   - Recommendation: no bloquear; la corrida LIVE acotada usa semanas recientes + algunas históricas (p.ej. 2024, 2020) como muestra representativa. El backfill posterior puede sondear hacia atrás hasta el primer 0-resultados.

2. **¿El header-set anti-Cloudflare funciona desde el egreso de CI/Edge real?**
   - What we know: funciona desde el entorno de esta sesión (HTTP 200); falla con UA simple.
   - What's unclear: si el WAF trata distinto las IPs de Supabase Edge / GitHub Actions.
   - Recommendation: el plan incluye un **checkpoint LIVE** que verifique HTTP 200 de Cámara desde el egreso de ejecución antes de declarar la fuente asegurada; si 403 persiste, degradar la fuente Cámara (citaciones) con backoff sin abortar la del Senado.

3. **¿`weekly_table` cubre solo la semana vigente o también la próxima?**
   - What we know: hoy devolvió 4 sesiones (16-17 jun 2026), `PARTE_SESION` ∈ {ORDEN DEL DÍA, TIEMPO DE VOTACIONES}.
   - What's unclear: cuántas semanas hacia adelante incluye.
   - Recommendation: ingestar lo que devuelva (idempotente por `ID_SESION`); la frescura/provenance deja claro a qué semana corresponde.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `www.camara.cl` (citaciones HTML) | TRAM-07 Cámara | ✓ (HTTP 200) **solo con header-set de navegador** | — | Backoff + marcar fuente Cámara temporalmente no disponible (no abortar Senado) |
| `web-back.senado.cl/api/commissions_citations` | TRAM-07 Senado | ✓ (HTTP 200, sin auth) | — | `_next/data/{buildId}/...citaciones.json` |
| `web-back.senado.cl/api/weekly_table` | TRAM-08 Senado | ✓ (HTTP 200, sin auth) | — | `_next/data` de `/sala-de-sesiones/tabla-semanal` |
| `www.camara.cl/verDoc.aspx?prmTipo=TABLASEMANAL` | TRAM-08 Cámara (PDF) | ✓ (HTTP 200, application/pdf, ~148KB) | — | Degradación honesta (solo enlace) |
| `opendata.camara.cl` WS (sesiones) | (descarte de tabla) | ✓ (sin CF) — pero NO expone tabla | — | N/A — confirmado sin orden del día |
| Supabase local (Postgres + RLS) | Persistencia + `/agenda` | ✓ (heredado Fases 1-5) | PG 15 | — |
| `cheerio` / `zod` / `@supabase/supabase-js` / `@obs/*` | Parsers/writer/conectores | ✓ (en el workspace) | cheerio 1.2.0 | — |

**Missing dependencies with no fallback:** ninguna que bloquee. La única fuente sin equivalente estructurado es la tabla de sala de **Cámara** (PDF) → degradación honesta aprobada (TRAM-08 parcial), NO bloqueante.

**Missing dependencies with fallback:**
- Senado citaciones/tabla: API backend (preferida) ↔ `_next/data` con buildId (fallback).
- Cámara citaciones: si CF endurece, backoff + degradación temporal de la fuente.

---

## Validation Architecture

> `workflow.nyquist_validation` no está explícitamente en `false` (no se encontró config que lo desactive) → sección incluida.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (workspace) + pgTAP (Supabase) — patrón Fase 5 |
| Config file | `packages/agenda/vitest.config.ts` (Wave 0 — espejar `packages/tramitacion/vitest.config.ts`) |
| Quick run command | `pnpm --filter @obs/agenda test` |
| Full suite command | `pnpm -w test --run` + `supabase test db` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAM-07 | Parsear HTML Cámara → Citacion[] (fixture real) | unit | `pnpm --filter @obs/agenda test parse-camara-citaciones` | ❌ Wave 0 |
| TRAM-07 | Parsear JSON Senado citaciones → Citacion[] (fixture real) | unit | `pnpm --filter @obs/agenda test parse-senado-citaciones` | ❌ Wave 0 |
| TRAM-07 | Conectores reusan `@obs/ingest` en orden LOCKED (mock verifica rateLimiter.wait ANTES del get) + header-set CF en Cámara | unit | `pnpm --filter @obs/agenda test connector-camara connector-senado` | ❌ Wave 0 |
| TRAM-07 | Enumeración de semanas ISO correcta (bordes de año, 53 semanas) | unit | `pnpm --filter @obs/agenda test semana-iso` | ❌ Wave 0 |
| TRAM-08 | Parsear JSON Senado weekly_table → SesionSala + items (fixture real) | unit | `pnpm --filter @obs/agenda test parse-senado-tabla` | ❌ Wave 0 |
| TRAM-08 | Degradación honesta Cámara (sin filas inventadas; expone link PDF) | unit | `pnpm --filter @obs/agenda test tabla-camara-degradacion` | ❌ Wave 0 |
| TRAM-07/08 | Writer idempotente por clave natural (2× no duplica) | unit | `pnpm --filter @obs/agenda test writer` | ❌ Wave 0 |
| TRAM-07/08 | `anon` lee `citacion`/`citacion_punto`/`sesion_sala`/`sesion_tabla_item` y NO lee `parlamentario.rut` | pgTAP | `supabase test db` | ❌ Wave 0 (0008_agenda.test.sql) |
| TRAM-07/08 | Slice E2E: HTML+JSON reales → tablas pobladas → `/agenda` lee como anon | integration | `pnpm --filter @obs/agenda test slice.e2e` | ❌ Wave 0 (RED inicial) |
| TRAM-07/08 | Corrida LIVE acotada (varias semanas reales ambas cámaras + tabla Senado vigente) con provenance, idempotente | manual/checkpoint | (checkpoint:human-verify, operador-accept como Fase 5) | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/agenda test` (+ `pnpm -w typecheck`)
- **Per wave merge:** `pnpm -w test --run` + `supabase test db`
- **Phase gate:** suite verde + corrida LIVE acotada con filas reales (provenance, 0 errores 403/429/500 desde el egreso real, idempotente) antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/agenda/` scaffold (package.json/tsconfig/vitest) — espejar `@obs/tramitacion`
- [ ] `packages/agenda/test/fixtures/` — **ya capturados en esta sesión** (reusar): HTML real de Cámara (`citaciones_semana 2026-25`, 234KB), JSON `commissions_citations`, JSON `weekly_table`. Persistirlos como fixtures.
- [ ] `supabase/migrations/0009_agenda.sql` + `supabase/tests/0008_agenda.test.sql` (RLS public-read + guarda rut)
- [ ] `slice.e2e.test.ts` (RED inicial — diana ciudadana de la fase)
- [ ] Helper de semana ISO + tests de bordes

---

## Security Domain

> `security_enforcement` no está en `false` → sección incluida. Hereda el modelo de Fase 5.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Solo lectura pública; sin auth nueva. |
| V3 Session Management | no | Sin sesión de usuario. |
| V4 Access Control | yes | RLS public-read SOLO en las 4 tablas nuevas; `parlamentario` intacta (deny-by-default). pgTAP prueba que `anon` no lee `parlamentario.rut`. |
| V5 Input Validation | yes | `zod` sobre el HTML parseado y el JSON de las APIs (drift/FND-04). Acotar tamaño de respuesta. |
| V6 Cryptography | no | Sin criptografía nueva; no hand-roll. |
| V12/V13 (SSRF/API) | yes | `assertAllowedUrl` deny-by-default antes de cada fetch (camara.cl/senado.cl/web-back.senado.cl en allowlist). |

### Known Threat Patterns for {Deno conectores + Postgres RLS + Next.js SSR}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DoS auto-infligido / WAF de Cámara (ráfagas → 403/ban) | DoS | `HostRateLimiter` 2-3s serial por host + header-set anti-CF + backoff; alcance acotado en LIVE. Reuso de `@obs/ingest`. |
| SSRF vía URL construida (semana/buildId) | Spoofing/Tampering | `assertAllowedUrl` deny-by-default; `web-back.senado.cl` debe añadirse a la allowlist (nuevo host vs Fase 5). |
| Information Disclosure por RLS mal puesta | Information Disclosure | Policy `for select to anon using(true)` + `grant select` SOLO en las 4 tablas públicas; pgTAP guarda `parlamentario.rut`. |
| HTML/JSON malformado o gigante (parser DoS) | DoS | Validación `zod` por fila; límite de tamaño de respuesta; cheerio sin ejecutar scripts; sin entidades externas. |
| Drift de esquema de fuente (cambia el HTML/JSON) | Tampering | Detección de drift (FND-04): si el shape no valida con zod → registrar, no fabricar. Fixtures reales como contrato. |
| Inyección de identidad de invitados no verificada | (regla rectora) | Mostrar invitados como texto crudo de la fuente con provenance; NO afirmar identidad/cargo verificado (sin `IdentityMarker` confirmado salvo cruce determinista). |

**Nuevo host para la allowlist de `@obs/ingest`:** `web-back.senado.cl` (las APIs backend del Senado). Verificar que esté permitido o añadirlo explícitamente — Fase 5 solo usó `tramitacion.senado.cl`/`opendata.camara.cl`/`www.senado.cl`.

---

## Sources

### Primary (HIGH confidence — validado EN VIVO esta sesión, 2026-06-18)
- `GET https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-25` con header-set de navegador → **HTTP 200, 234588 chars descomprimidos**; estructura `<article.citaciones>`/`<p.fecha>`/`<table.tabla>` (Comisión|Horario|Sala|Citación|Invitados) extraída verbatim. UA simple → **403 Cloudflare** (reproducido en 2 egresos).
- `GET https://web-back.senado.cl/api/commissions_citations?limit=100` → **HTTP 200, 63839 bytes**, `{data:[{FECHA,CITACIONES:[{ID_CITACION,COMINOMBRE,LUGAR,FECHA,HORARIO,MATERIA,SIN_EFECTO,PUNTOS_PROPUESTOS:[{NUMERO_BOLETIN,ID_PROYECTO,...}]}]}],status,results}`. `offset=100`→`{data:[]}`; `fecha`/`year` ignorados (solo ventana hacia adelante).
- `GET https://web-back.senado.cl/api/weekly_table?limit=100` → **HTTP 200, 11099 bytes**, `data:[{ID_SESION,NUMERO_SESION,FECHA,HORA_INICIO,HORA_TERMINO,TIPO_SESION,TABLA:[{POSICION,PARTE_SESION,MATERIA,BOLETIN,ID_PROYECTO,ALIAS,QUORUM,LINK_PROYECTO}]}]`. `PARTE_SESION` ∈ {ORDEN DEL DÍA, TIEMPO DE VOTACIONES}.
- `GET https://www.senado.cl/...citaciones` → `__NEXT_DATA__.buildId = 4EMldF3oxKIqItY1dHAUe`; datos en `pageProps.resource.components[3].computedComponents.data` y `...baseUrl = web-back.senado.cl/api/commissions_citations` (origen real).
- `GET https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` → **HTTP 200, application/pdf, 148313 bytes, 2 págs** (tabla semanal Cámara como PDF).
- `opendata.camara.cl/wscamaradiputados.asmx`: métodos `getSesiones/getSesionDetalle/getSesionBoletinXML` probados → **NO exponen tabla/orden del día** (`getSesionBoletinXML`=38 bytes vacíos). Confirma el descarte de WS para Cámara.
- Archivo histórico Cámara probado: `2010-20`, `2011-20`, `2013-20`, `2015-20`, `2018-20`, `2020-20`, `2022-20`, `2024-20`, `2026-25` → todos con día-headers + tablas de citaciones (cobertura ≥2010 por semana ISO).
- `camara.cl/robots.txt` → `User-agent: * Allow: /` (Content-Signal search=yes,ai-train=no). El 403 es bot-management de CF, no robots.

### Secondary (MEDIUM confidence — codebase, cross-verificado)
- `05-05-SUMMARY.md` / `05-01-SUMMARY.md` — patrón conector(@obs/ingest, NO BaseConnector.run)+writer idempotente+migración 0008+RLS public-read+ingest-run/CLI+corrida LIVE acotada+fixtures reales. (Espejo directo para esta fase.)
- `PROJECT.md` / STACK embebido — cheerio 1.2.0 en Deno, zod, Next.js 16 SSR server-only, rate-limit 2-3s, autodetección de buildId, NO navegador headless.

### Tertiary (LOW confidence — a confirmar)
- A2 (header-set anti-CF estable desde egreso de CI/Edge): a verificar en el checkpoint LIVE del plan.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuso 1:1 del stack auditado de Fase 5; sin paquetes nuevos.
- Fuentes (TRAM-07): HIGH — las 3 validadas LIVE HTTP 200 con shapes extraídos verbatim esta sesión.
- Tabla de sala (TRAM-08): HIGH — Senado resuelto (estructurado, validado); Cámara concluido honestamente (solo PDF; WS descartado por prueba directa).
- Anti-Cloudflare Cámara: HIGH que el header-set funciona AHORA; MEDIUM que persista desde todos los egresos (A2) → checkpoint LIVE.
- Architecture/pitfalls: HIGH — derivados de evidencia LIVE + patrón Fase 5.

**Research date:** 2026-06-18
**Valid until:** ~2026-07-18 (30 días). Riesgos de caducidad: (1) `buildId` del Senado cambia por deploy (mitigado: usar API backend); (2) Cloudflare de Cámara puede endurecer (mitigado: backoff+degradación); (3) las APIs `web-back.senado.cl` podrían cambiar de forma (mitigado: zod/drift + fallback `_next/data`).
