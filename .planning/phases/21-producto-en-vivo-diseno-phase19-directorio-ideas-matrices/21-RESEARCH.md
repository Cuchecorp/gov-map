# Phase 21: Producto en vivo — Diseño Phase 19 + directorio de parlamentarios + ideas matrices - Research

**Researched:** 2026-06-20
**Domain:** Frontend wiring (Next 16 App Router) + RPC público RLS-safe + backfill de pipeline LLM (texto fuente → idea matriz) + redeploy Cloudflare Workers vía Docker/Linux
**Confidence:** HIGH (todo verificado contra el código del monorepo; un punto `[ASSUMED]` en cobertura de `link_mensaje_mocion` en vivo)

## Summary

Esta fase NO abre decisiones nuevas: el diseño está cerrado (19-UI-SPEC.md + DESIGN-SYSTEM.md + mockup) y la infra está viva (Phase 20). Es una fase de **cableado + backfill + redeploy**. Los 5 SC se resuelven con código existente del repo más tres piezas faltantes concretas, todas localizadas en archivos específicos.

El hallazgo más importante es **SC3 (ideas matrices)**: la causa raíz exacta de `idea_matriz = 0/74` es que `SupabaseFichasWriter.leerPendientes()` **hardcodea `link_mensaje_mocion: null`** (`packages/fichas/src/writer-supabase.ts:143`), por lo que el pipeline SIEMPRE degrada a "título+materia". El link al texto íntegro SÍ existe en la fuente: el XML del Senado lo trae en `<descripcion><link_mensaje_mocion>` (verificado en fixture: apunta a `senado.cl/appsenado/index.php?...tipodoc=mensaje_mocion`, host **ya allowlisted**). Pero ese link nunca se persistió a la tabla `proyecto` (migración 0008 no tiene la columna). El parser del Senado lo extrae como sidecar (`parse-senado-tramitacion.ts:83`) pero el writer de tramitación lo descarta. Toda la maquinaria de descarga (`obtenerTextoFuente`), extracción (DeepSeek), embedding y upsert idempotente ya existe y está testeada — solo falta **alimentar el link real** al pipeline.

**Primary recommendation:** (SC1) Extender `globals.css` con los tokens crema/petróleo en formato HSL crudo (space-separated, como ya hace el archivo) + montar `GlobalHeader` en `layout.tsx`. (SC2) Crear un RPC `parlamentarios_publico()` (sin `p_id`) espejo de `0020`, emitiendo solo columnas no-PII (`camara/region/distrito/circunscripcion/periodo`), + ruta `/parlamentarios`. (SC3) Cablear el link real al pipeline — re-fetch del XML Senado por boletín O backfill de columna — y correr `@obs/fichas --reembed` LIVE. (SC5) Redeploy SOLO vía `docker-cf-build.sh` (Linux) → `docker cp` → `wrangler deploy`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Diseño/tokens crema-petróleo (SC1) | Frontend Server (RSC `globals.css`/`layout.tsx`) | Browser (CSS vars) | Tokens viven en CSS global cargado por el layout SSR; no hay lógica de cliente |
| GlobalHeader (SC1) | Frontend Server (`layout.tsx`) | — | Componente server-only persistente; sin estado salvo menú móvil (island opcional) |
| Directorio parlamentarios (SC2) | API/Backend (RPC `security definer`) | Frontend Server (RSC fetch) | El set público debe salir de un RPC que respete deny-by-default; la UI solo lee |
| Listado/filtro directorio (SC2) | Frontend Server (RSC + searchParams) | Browser (form GET) | Filtro server-side por `camara`/búsqueda; sin exponer PII |
| Backfill ideas matrices (SC3) | Connector/Batch (`@obs/fichas` CLI, local operador) | Database (proyecto_ficha) | Corrida LIVE local (no Edge); escribe a Supabase con service key |
| Obtención texto fuente (SC3) | Connector (`@obs/ingest` policy) | CDN/Storage (R2 gated) | SSRF+robots+rate-limit; link Senado allowlisted |
| Render idea matriz (SC3) | Frontend Server (RSC ficha) | Database | `proyecto_ficha.idea_matriz` ya se lee en `proyecto/[boletin]/page.tsx` |
| Redeploy (SC5) | Build/CI (Docker Linux) + Edge (Worker) | — | Build Windows 500ea en runtime; Linux obligatorio |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Diseño (autoritativo, NO re-abrir):**
- Fuente de verdad: `19-UI-SPEC.md` + `DESIGN-SYSTEM.md` (CLOSED) + `mockup/landing.html`. Implementar VERBATIM; ninguna decisión de diseño se re-abre.
- Tokens 60/30/10 — fondo crema `hsl(40 33% 97%)`, card `hsl(40 30% 99%)`, muted `hsl(40 20% 93%)`, acento petróleo `hsl(183 38% 26%)` (light) / `hsl(183 34% 46%)` (dark). EXTENDER `app/app/globals.css`; **NO tocar** `app/app/styles/civic-tokens.css`.
- Voz editorial ES + vocabulario prohibido (anti-insinuación) en DESIGN-SYSTEM §6; honest-states §7; invariantes HARD §8 (numeración del CONTEXT; en el doc canónico es §8/§9/§10).

**Directorio de parlamentarios:**
- Nueva ruta (sugerido `/parlamentarios`) que liste los 186 con búsqueda/filtro por cámara/región/distrito. Cada item enlaza a `/parlamentario/<id>`. Ids reales `D####`/`S####`. Header global da acceso al directorio y a /buscar.
- RPC nuevo (público, RLS-safe, **SIN partido/rut/email**) que devuelva el set, respetando LEGAL-03. Patrón: `supabase/migrations/0020_parlamentario_publico.sql`.

**Ideas matrices:**
- Causa raíz (diagnosticada con psql): `proyecto_ficha` 74 filas, `idea_matriz=0`, `texto_r2_path=0`. Hay que ingerir el texto del proyecto y re-correr la extracción.
- Investigar el camino de texto (BCN obtxml y/o doc del proyecto Senado/Cámara), cablear el fetch, re-correr `@obs/fichas` (sin `--dry-run`; `--reembed` si cambia contenido), verificar `count(idea_matriz) > 0`.
- Honestidad: sin texto → honest-state, NUNCA inventar idea matriz.

### Claude's Discretion
- Estructura exacta de componentes del header/directorio; el RPC del listado; el orden del re-embed.

### Deferred Ideas (OUT OF SCOPE)
- Fuente de lobby/patrimonio ligada a parlamentarios (hoy AA001/bianchi no son del Congreso).
- gov-map.com custom domain (operador).
- Flip a indexable (`PUBLIC_INDEXABLE=true`) — SOLO tras pasada legal Ley 21.719.
- MONEY/NET (gated, Phases 14-18).
- Corpus de proyectos más amplio (hoy 74).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| (sin REQ de datos nuevo) | Fase de PRODUCTO/UI: eleva el sitio ya desplegado al diseño cerrado + cierra 2 brechas de contenido | No mapea a un REQ de v2.0; reusa SEM-01/02/03 (búsqueda/fichas, v1.0) ya implementados. La idea matriz dormida es deuda v1.0 explícita (STATE.md Deferred Items: "Persistir `link_mensaje_mocion` end-to-end") |

## Standard Stack

Sin paquetes nuevos. Todo el stack ya está instalado y verificado en el repo.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.9 | Frontend SSR (App Router) | Instalado; `[VERIFIED: app/node_modules/next/package.json]` |
| React | 19.x | UI | Viene con Next 16 |
| @supabase/supabase-js | v2 | Cliente DB anon (server-only) + writer service-key | `app/lib/supabase.ts`, `packages/fichas/src/writer-supabase.ts` `[VERIFIED: codebase]` |
| Tailwind CSS | v4 (`@import "tailwindcss"`) | Estilos | `app/app/globals.css:1` `[VERIFIED: codebase]` |
| shadcn (vendored) | manual | UI primitives | `app/components/ui/` = badge, button, card, input, separator, skeleton, table, tooltip `[VERIFIED: ls]` |

### Supporting (pipeline de fichas, SC3)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@obs/ingest` | workspace | `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get → R2Store` | Descarga del texto fuente (allowlist ya incluye `senado.cl`/`bcn.cl`/`leychile.cl`) `[VERIFIED: packages/ingest/src/allowlist.ts:19]` |
| `@obs/llm` DeepSeekProvider | workspace | Extracción literal idea matriz + cuerpos legales | `pipeline.extraer()` `[VERIFIED: packages/fichas/src/pipeline.ts:135]` |
| `@obs/llm` GeminiEmbeddingProvider | workspace | Embedding 768-dim L2 versionado | `embedFicha` `[VERIFIED: codebase]` |
| `@obs/tramitacion` | workspace | Parser XML Senado (extrae `link_mensaje_mocion` sidecar) | `parse-senado-tramitacion.ts:83` `[VERIFIED: codebase]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Link Senado (`link_mensaje_mocion`) | BCN `obtxml?opt=7&idNorma=` | BCN es el texto de la **norma promulgada** (solo proyectos ya ley); el link Senado es el **mensaje/moción** (todos los proyectos en tramitación). Para idea matriz el Senado es la fuente PRIMARIA; BCN secundaria. Además requiere resolver boletín→idNorma (no trivial, no implementado). **Usar el link Senado.** `[CITED: 07-RESEARCH.md Pitfall 1 + Open Q2]` |
| RPC nuevo de listado | Reusar `parlamentario_publico(p_id)` en bucle | El RPC actual toma un id único; iterar 186 veces = 186 round-trips. Un RPC sin parámetro que devuelva el set es la solución correcta. |

**Installation:** Ninguna. Todos los símbolos existen. (Verificación de versión Next ejecutada: `16.2.9`.)

## Package Legitimacy Audit

> No se instala ningún paquete externo nuevo en esta fase. La sección de auditoría no aplica. Si el planner introdujera un paquete (p.ej. un extractor de PDF/markdown para cuerpos del `obtxml`), DEBE pasar la Package Legitimacy Gate + un `checkpoint:human-verify` antes de instalar.

## Architecture Patterns

### System Architecture Diagram

```
SC1 — Diseño (cableado, sin lógica nueva)
  layout.tsx (RSC) ──► <GlobalHeader/> (nuevo, server-only)
        │              └─ wordmark→/ · Buscar · Parlamentarios · Agenda · Sobre/Metodología
        ▼
  globals.css :root/.dark  ──► --background crema · --accent-product petróleo · --ring petróleo
        │  (EXTENDER, no romper Slate; civic-tokens.css INTACTO)
        ▼
  cada page.tsx ya usa max-w-3xl/5xl + mt-12 + text-xl → heredan tokens nuevos

SC2 — Directorio
  Browser (form GET ?camara=&q=) ──► /parlamentarios/page.tsx (RSC)
        │                                   │
        │                                   ▼
        │                          sb.rpc("parlamentarios_publico")  ──► RPC security definer
        │                                   │                              (0026 nueva migración)
        │                                   ▼                              emite: id,nombre,camara,
        │                          filtro server-side (camara, nombre)     region,distrito,circunscripcion,
        ▼                                   ▼                              periodo — NUNCA partido/rut/email
  ParlamentarioDirectoryRow ──► link /parlamentario/[id]

SC3 — Ideas matrices (backfill LOCAL operador)
  proyecto rows (74, en la nube)
        │  ┌─────────────────────────────────────────────────────────────┐
        ▼  │  pipeline-cli (LIVE, service key)  --reembed                 │
  leerPendientes()  │   1. link real ──► obtenerTextoFuente(link)         │
   [HOY null ✗]     │      (Senado XML <descripcion>)  @obs/ingest policy  │
   [FIX: link real] │   2. DeepSeek extraer(texto) ──► idea_matriz literal │
        │           │   3. GeminiEmbedding 768 ──► proyecto_embedding      │
        ▼           │   4. upsertFicha(idea_matriz) + upsertEmbedding      │
  proyecto_ficha.idea_matriz > 0  ◄──────────────────────────────────────┘
        ▼
  proyecto/[boletin]/page.tsx IdeaMatrizSection ──► ya renderiza (sin cambios)

SC5 — Redeploy
  docker start -a obsbuild ──► opennext cf-build (Linux) ──► /build/app/.open-next
        │ (borrar app/.open-next del host primero)
        ▼
  docker cp obsbuild:/build/app/.open-next host ──► cd app && npx wrangler deploy
        ▼
  Worker observatorio-congreso (noindex activo, MONEY/NET off)
```

### Component Responsibilities

| File | Responsibility | Change in Phase 21 |
|------|----------------|--------------------|
| `app/app/globals.css` | Tokens de diseño | EXTENDER `:root`/`.dark` con crema + `--accent-product` + retune `--ring` |
| `app/app/layout.tsx` | Shell raíz, metadata noindex | Añadir `<GlobalHeader/>` + className de fondo si aplica; NO tocar `generateMetadata` |
| `app/components/global-header.tsx` | Header persistente (NEW spec §11.0) | CREAR |
| `app/app/parlamentarios/page.tsx` | Directorio (NEW ruta §11.6) | CREAR |
| `app/components/parlamentario-directory-row.tsx` | Item del directorio | CREAR |
| `supabase/migrations/0026_*.sql` | RPC listado público | CREAR (espejo de 0020) |
| `packages/fichas/src/writer-supabase.ts` | `leerPendientes` | CABLEAR el link real (hoy `null` en línea 143) |
| `packages/tramitacion/src/writer-supabase.ts` | persiste `proyecto` | (Opción B) persistir `link_mensaje_mocion` si se elige columna |
| `app/app/proyecto/[boletin]/page.tsx` | Render idea matriz | SIN cambios (ya lee `proyecto_ficha.idea_matriz`) |

### Recommended Project Structure (sin reorganizar — el repo ya está así)
```
app/app/
├── layout.tsx              # + GlobalHeader
├── globals.css             # + tokens crema/petróleo
├── parlamentarios/page.tsx # NEW directorio
├── page.tsx                # landing (aplica tokens)
├── buscar/ proyecto/ parlamentario/ agenda/ contraparte/
app/components/
├── global-header.tsx       # NEW
├── parlamentario-directory-row.tsx  # NEW
supabase/migrations/
└── 0026_parlamentarios_publico_listado.sql  # NEW
packages/fichas/src/        # writer-supabase.ts (cablear link)
```

### Pattern 1: Token wiring en globals.css (formato HSL crudo)
**What:** Los tokens se definen como HSL **space-separated SIN `hsl()`** y se consumen con `hsl(var(--x))`. El mockup y el globals.css actual ya usan este formato.
**When to use:** Al extender `:root`/`.dark`.
**Example:**
```css
/* Source: app/app/globals.css:5-26 (formato actual) + mockup/landing.html:40-48 (valores LOCKED) */
:root {
  --background: 40 33% 97%;        /* crema — reemplaza 0 0% 100% */
  --card: 40 30% 99%;
  --muted: 40 20% 93%;
  --muted-foreground: 222 14% 42%;
  --border: 40 16% 86%;
  --foreground: 222 47% 11%;       /* near-black, AA+ sobre crema */
  --accent-product: 183 38% 26%;   /* petróleo — NEW */
  --ring: 183 38% 26%;             /* retune a petróleo (foco teclado) */
}
.dark {
  --background: 222 28% 7%;
  --card: 222 24% 12%;
  --muted: 222 20% 16%;
  --accent-product: 183 34% 46%;
}
```
**Crítico:** `civic-tokens.css` (importado en línea 51) queda INTACTO. `--camara`/`--senado` NO se tocan (son identidad de dato, no marca).

### Pattern 2: RPC público de listado (espejo de 0020)
**What:** RPC `security definer` SIN parámetro que lee la maestra deny-by-default y emite SOLO columnas seguras.
**When to use:** SC2 directorio.
**Example:**
```sql
-- Source: espejo EXACTO de supabase/migrations/0020_parlamentario_publico.sql
create or replace function parlamentarios_publico()
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text
)
language sql stable security definer set search_path = '' as $$
  select p.id,
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara, p.region, p.distrito, p.circunscripcion, p.periodo
  from public.parlamentario p
  order by p.apellido_paterno nulls last, p.nombre_normalizado;  -- orden NEUTRAL (§10.5)
$$;
grant execute on function parlamentarios_publico() to anon;
-- PROHIBIDO: ninguna policy/grant sobre `parlamentario`; partido/rut/email NUNCA emitidos (LEGAL-03)
```
**Filtro:** la cámara y la búsqueda por nombre se aplican server-side en el RSC (sobre el set devuelto, 186 filas = barato) o como argumentos opcionales del RPC. Región/distrito están disponibles para filtro **pero son nullable** (la Cámara/Senado no los trae para todos — `0005_parlamentario.sql:27`).

### Pattern 3: Cablear el link real al pipeline (SC3) — DOS opciones
**What:** El pipeline degrada porque `leerPendientes` entrega `link_mensaje_mocion: null`. Hay que entregarle el link real.

**Opción A (re-fetch en vivo, sin DDL):** En el CLI/`leerPendientes`, por cada boletín pendiente, re-fetchear el XML del Senado (`SenadoConnector.fetchTramitacion(boletinBase)`) y extraer `parseSenadoTramitacion(xml).linkMensajeMocion`. Respeta rate-limit 2-3s (ya en el connector). Ventaja: cero migración. Costo: 74 fetches al Senado (acotado, idempotente, rate-limited). Cumple "ingesta respetuosa".

**Opción B (persistir columna, recomendada a largo plazo):** Añadir `link_mensaje_mocion text` a `proyecto` (migración 0026/0027), persistirlo en `SupabaseTramitacionWriter` (hoy lo descarta), backfillear las 74 filas re-corriendo el ingest de tramitación, luego `leerPendientes` lo lee con un simple JOIN. Ventaja: el link queda en DB, futuras corridas de fichas no tocan el Senado. Costo: DDL remoto (checkpoint operador) + re-ingest.

**Recomendación:** Opción A para esta fase (menor blast-radius, sin DDL remoto bloqueante; el corpus es 74). El planner puede ofrecer B como mejora persistente si el operador prefiere.
**Source:** `packages/fichas/src/writer-supabase.ts:120-148` (hardcode null), `packages/tramitacion/src/parse-senado-tramitacion.ts:83` (extrae link), `packages/tramitacion/src/connector-senado.ts:45` (fetch). `[VERIFIED: codebase]`

### Pattern 4: Correr el backfill LIVE
```bash
# Source: packages/fichas/src/pipeline-cli.ts flags (verificados líneas 8-17, 67-117)
# LOCAL operador (CLAUDE.md: backfill masivo = LOCAL, no GH Actions). Env via ~/obs_env.sh.
# --reembed re-procesa TODAS (no solo 'pendiente') y bumpea embedding_version a v1-reembed.
tsx packages/fichas/src/pipeline-cli.ts --reembed --service-key "$SUPABASE_SECRET_KEY"
# Sin --service-key (y sin --dry-run) → degrada a DRY-RUN con aviso (NO escribe). El operador DEBE pasar la key.
# Verificación: psql count(idea_matriz) > 0
```
**Crítico (#42):** un boletín que falla la extracción se marca `estado='error'` (no se reintenta a ciegas). `--reembed` lo recupera. La degradación honesta se mantiene: boletín sin link/sin texto → `idea_matriz=null` (NUNCA fabricado).

### Pattern 5: Redeploy LOCKED (SC5)
```bash
# Source: docker-cf-build.sh (verificado) + 21-CONTEXT.md <code_context> build/deploy gotcha
# 1. Build en Linux (Windows 500ea: "Dynamic require of middleware-manifest.json")
docker start -a obsbuild        # reusa node_modules del contenedor named (rápido)
# 2. Borrar el .open-next del host (PowerShell) ANTES del cp
#    Remove-Item -Recurse -Force app/.open-next
# 3. Copiar el bundle Linux al host (MSYS_NO_PATHCONV evita la mangling de la ruta)
MSYS_NO_PATHCONV=1 docker cp obsbuild:/build/app/.open-next "<host>/app/.open-next"
# 4. Deploy (OAuth ya autenticado). NOTA: 'pnpm --filter app run deploy' (con 'run'); sin 'run' colisiona con builtin.
cd app && npx wrangler deploy
```
El contenedor `obsbuild` existe sin `--rm` (reiniciable). El script corre `pnpm --filter app run cf-build` (no `deploy`) — el deploy es paso aparte con wrangler.

### Anti-Patterns to Avoid
- **Tocar `civic-tokens.css`:** queda intacto (LOCKED). Los tokens nuevos van solo en `globals.css`.
- **Build en Windows:** 500ea en runtime. SIEMPRE Docker/Linux.
- **Exponer `partido`/`rut`/`email` en el RPC de listado:** viola LEGAL-03 (deny-by-default). El RPC solo emite columnas de cabecera.
- **Fabricar idea matriz cuando no hay texto:** degradación honesta obligatoria — `idea_matriz=null` + honest-state en la ficha.
- **Usar `hsl(...)` dentro del valor del token:** el formato del repo es space-separated crudo; consumido con `hsl(var(--x))`. Mezclar formatos rompe Tailwind v4.
- **`response_format: json_schema` en LLM:** ya resuelto en DeepSeekProvider (`json_object` + zod). No re-introducir.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Descarga del texto fuente | fetch a mano | `obtenerTextoFuente` + `@obs/ingest` policy | SSRF guard, robots, rate-limit 2-3s, R2 gated — todo testeado |
| Extracción idea matriz | prompt ad-hoc | `pipeline.extraer()` (DeepSeek + golden gate) | Gate de fidelidad literal ≥0.95 ya bloquea CI |
| RPC público de la maestra | `select *` con anon | RPC `security definer` espejo de 0020 | anon NO lee `parlamentario` directo (deny-by-default); el RPC es el único canal seguro |
| Validación de id en path | regex nuevo | `PARLAMENTARIO_ID_RE` de `app/lib/buscar.ts:38` | Fuente ÚNICA `/^[DSP]\d{3,5}$/` (#36) |
| Build del bundle CF | `opennext build` en Windows | `docker-cf-build.sh` | Windows produce bundle que 500ea |

**Key insight:** Casi nada se construye en esta fase — se CABLEA lo que ya existe. El único "código nuevo de lógica" es el RPC de listado (12 líneas SQL) y el componente del directorio; lo demás es wiring de tokens, montaje de header y una corrida de backfill.

## Runtime State Inventory

> Fase con un componente de backfill/re-ingest (SC3) — inventario relevante.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `proyecto_ficha` (74 filas, en la nube `bctyygbmqcvizyplktuw`): `idea_matriz=0/74`, `texto_r2_path=0/74`, `cuerpos_legales`=placeholder. `proyecto_embedding`=74 (sobre título+materia, degradado) | **Data migration:** re-correr `@obs/fichas --reembed` LIVE → re-extrae idea_matriz + re-embebe (bump a `v1-reembed`). Verificar `count(idea_matriz)>0` con psql |
| Live service config | Worker `observatorio-congreso` (CF account `10fb709d…`): secrets `SUPABASE_URL/ANON_KEY/GEMINI_API_KEY` ya seteados; toggles `PUBLIC_INDEXABLE` (noindex), `MONEY_PUBLIC_ENABLED` (off). NO en git | Ninguno salvo redeploy (mismos secrets). NO encender toggles |
| OS-registered state | Contenedor Docker `obsbuild` (named, sin `--rm`) con node_modules cacheados | Reusar con `docker start -a obsbuild` (no recrear) |
| Secrets/env vars | `.env` Windows con BOM/CRLF → cargar vía `~/obs_env.sh` (parser python, single-quoted). `SUPABASE_DB_URL` para psql (bypassa RLS); `SUPABASE_SECRET_KEY` para el writer LIVE; `DEEPSEEK_API_KEY`/`GEMINI_API_KEY` para el pipeline | Pre-flight: regenerar `~/obs_env.sh` BOM-safe |
| Build artifacts | `app/.open-next` del host (stale tras cada build); `.next` de Windows (NO desplegar) | Borrar `app/.open-next` del host ANTES del `docker cp` |

**Nada que renombrar/migrar de strings:** esta NO es una fase de rename. El único "movimiento de datos" es re-poblar `idea_matriz` (extracción, no rename).

## Common Pitfalls

### Pitfall 1: El link al texto íntegro existe en la fuente pero nunca se persistió
**What goes wrong:** Se asume que el corpus "no tiene texto fuente" y se va a BCN `obtxml` a resolver boletín→idNorma (complejo, no implementado).
**Why it happens:** `proyecto` (0008) no tiene columna `link_mensaje_mocion`; `leerPendientes` lo entrega `null` (línea 143) → el pipeline siempre degrada. Pero el XML del Senado SÍ trae el link en `<descripcion><link_mensaje_mocion>` (host `senado.cl`, ya allowlisted).
**How to avoid:** Usar el link Senado (Opción A re-fetch o B columna). BCN obtxml es secundario (norma promulgada).
**Warning signs:** El pipeline reporta `degradados` ≈ total y `idea_matriz` sigue null tras la corrida.

### Pitfall 2: Corrida de fichas degrada a DRY-RUN silenciosamente
**What goes wrong:** Sin `--service-key` (o sin `SUPABASE_SECRET_KEY` en env) y sin `--dry-run` explícito, el CLI degrada a dry-run con un log de aviso — el operador cree haber escrito y la DB sigue 0/74.
**Why it happens:** `decidirDryRun` (`pipeline-cli.ts:123`) hace dry-run si no hay key (gating defensivo).
**How to avoid:** Pasar `--service-key "$SUPABASE_SECRET_KEY"` explícito. Verificar el log final `LIVE: ... dbLoaded=true` Y `count(idea_matriz)>0` con psql.
**Warning signs:** Log dice `DRY-RUN` / `dbLoaded=false`.

### Pitfall 3: Build de Windows desplegado → 500 en runtime
**What goes wrong:** `Dynamic require of "/.next/server/middleware-manifest.json" is not supported` en producción.
**How to avoid:** SOLO `docker-cf-build.sh` (Linux). Borrar `app/.open-next` del host antes del `docker cp`. `[VERIFIED: docker-cf-build.sh:2-3 + 21-CONTEXT.md]`

### Pitfall 4: Romper los tokens Slate al extender globals.css
**What goes wrong:** Reemplazar el bloque `:root` entero rompe `--primary`/`--secondary`/`--radius` que shadcn consume.
**How to avoid:** EXTENDER (sobrescribir solo `--background`/`--card`/`--muted`/`--border`/`--foreground`, AÑADIR `--accent-product`, retune `--ring`). Dejar el resto. `civic-tokens.css` import (línea 51) intacto.

### Pitfall 5: RPC de listado filtra por columnas nullable
**What goes wrong:** Filtrar por `distrito`/`region` y perder senadores (distrito null) o filas sin región.
**Why it happens:** `0005_parlamentario.sql:27` — `distrito`/`circunscripcion`/`region` son NULLABLE (la fuente no los trae para todos).
**How to avoid:** Filtro principal por `camara` (NOT NULL) + búsqueda por nombre; región/distrito como filtros opcionales que toleran null. Orden neutral (alfabético) + `MethodologyCaveat` si hay cualquier orden por métrica (§10.5).

### Pitfall 6: Next 16 no es el Next del entrenamiento
**What goes wrong:** Usar APIs de Pages Router o asumir `params` síncronos.
**Why it happens:** `app/AGENTS.md`: "This is NOT the Next.js you know" → `params`/`searchParams` son Promises (ya visible en las páginas existentes: `await params`).
**How to avoid:** Leer `app/node_modules/next/dist/docs/01-app/` antes de tocar APIs nuevas. Espejar el patrón de las páginas existentes (RSC + `await params` + Suspense + skeleton).

## Code Examples

### Render de idea matriz (ya implementado — NO cambiar, solo se "enciende" al poblar la DB)
```tsx
// Source: app/app/proyecto/[boletin]/page.tsx:95-112 [VERIFIED]
async function IdeaMatrizSection({ boletin }: { boletin: string }) {
  const ficha = await leerFicha(boletin);          // lee proyecto_ficha.idea_matriz
  const ideaMatriz = ficha?.idea_matriz ?? null;   // hoy null (0/74) → honest empty
  const provenance = ideaMatriz !== null ? {
    capturedAt: ficha?.fecha_captura ? new Date(ficha.fecha_captura) : null,
    sourceName: sourceLabel(ficha?.origen ?? null),
    sourceUrl: null,  // texto_r2_path es key interna, no href público
  } : undefined;
  return <IdeaMatrizBlock ideaMatriz={ideaMatriz} provenance={provenance} />;
}
// Tras el backfill, ideaMatriz != null → IdeaMatrizBlock renderiza el texto.
// MEJORA opcional: si se persiste el link_mensaje_mocion, sourceUrl podría apuntar al doc Senado real.
```

### Patrón de página RSC (espejar para el directorio)
```tsx
// Source: app/app/parlamentario/[id]/page.tsx (estructura) [VERIFIED]
// El directorio reusa: max-w-5xl, Suspense+skeleton, RSC fetch vía rpc, honest empty (§9).
export default async function ParlamentariosPage({ searchParams }: {
  searchParams: Promise<{ camara?: string; q?: string }>;
}) {
  const sp = await searchParams;  // Next 16: Promise
  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Parlamentarios</h1>
      <Suspense fallback={<DirectorySkeleton/>}>
        <DirectoryList camara={sp.camara} q={sp.q} />
      </Suspense>
    </main>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `idea_matriz` dormida (deuda v1.0) | Backfill vía link Senado real | Phase 21 | 0/74 → >0/74 |
| Solo `/parlamentario/[id]` por id directo | Directorio `/parlamentarios` navegable | Phase 21 | Descubrimiento desde la UI |
| Frontend v1.0 plano (Slate blanco) | Diseño Phase 19 (crema+petróleo) | Phase 21 | Producto comparable a refs |
| Deploy directo wrangler (Phase 20) | Build Docker/Linux obligatorio | Phase 20→21 | Evita 500ea de Windows |

**Deprecated/outdated:**
- BCN `obtenerinfoley` → obsoleto (404). Usar `obtxml?opt=7&idNorma=` SI se va a BCN. Pero para esta fase el link Senado es la fuente primaria. `[CITED: CLAUDE.md + 07-RESEARCH.md:462]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<descripcion><link_mensaje_mocion>` está presente para la mayoría de los 74 boletines del corpus en vivo (visto en fixture, no en los 74 reales) | Pattern 3, SC3 | Algunos boletines degradan a `idea_matriz=null` (aceptable, honest-state) pero el recall de ideas matrices baja. Mitigar: medir cuántos traen link tras la corrida; reportar cobertura real | `[ASSUMED from fixture]` |
| A2 | El link Senado `getDocto&tipodoc=mensaje_mocion` devuelve texto legible (no PDF binario) parseable por DeepSeek | Pattern 3 | Si devuelve PDF, `obtenerTextoFuente` baja bytes pero el texto sería basura → idea matriz mala/degradada. Mitigar: smoke test sobre 1-2 boletines ANTES del backfill completo; si es PDF, descartar esos o añadir extracción | `[ASSUMED]` |
| A3 | El corpus en la nube tiene los 74 `proyecto_ficha` en estado tal que `--reembed` los re-procesa (no bloqueados en `error`) | Pattern 4 | `--reembed` procesa TODOS los pendientes (`pipeline.ts:114`), recupera incluso `error`; riesgo bajo | `[ASSUMED]` |

## Open Questions

1. **Opción A (re-fetch) vs Opción B (columna persistida) para el link**
   - What we know: A no requiere DDL remoto (bloqueante operador); B deja el link en DB.
   - What's unclear: si el operador prefiere persistir para el futuro.
   - Recommendation: A para esta fase (74 boletines, rate-limited, idempotente). Ofrecer B como mejora.

2. **Formato del texto del link Senado (HTML/PDF/texto plano)**
   - What we know: el link va a `senado.cl/appsenado/index.php?...getDocto`.
   - What's unclear: si entrega HTML, PDF o texto. `obtenerTextoFuente` hace `TextDecoder().decode` (asume texto/HTML).
   - Recommendation: smoke test 1-2 boletines antes del backfill (A2). Si HTML, puede necesitar limpieza (cheerio) antes de DeepSeek.

3. **Filtros del directorio: región/distrito nullable**
   - What we know: `camara` NOT NULL; `region`/`distrito`/`circunscripcion` nullable.
   - Recommendation: filtro primario `camara` + búsqueda nombre; región/distrito opcionales tolerando null.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker (contenedor `obsbuild`) | Build Linux (SC5) | ✓ (named, Phase 20) | — | Ninguno — Windows 500ea |
| wrangler (OAuth `sanchez.rossi@gmail.com`) | Deploy (SC5) | ✓ | — | — |
| Next.js | Frontend (SC1/SC2) | ✓ | 16.2.9 | — |
| Supabase nube (`bctyygbmqcvizyplktuw`) | RPC + backfill | ✓ | Postgres 15 | — |
| psql (`/c/Users/Carlo/miniconda3/Library/bin/psql`) | Verificación SC3 | ✓ (Phase 20) | — | — |
| DEEPSEEK_API_KEY | Extracción fichas (SC3) | ⚠ verificar en .env | — | Sin ella el pipeline falla la extracción → operador la provee |
| GEMINI_API_KEY | Embedding (SC3) + búsqueda | ✓ (secret del Worker; en .env para CLI) | — | — |
| SUPABASE_SECRET_KEY | Writer LIVE (SC3) | ⚠ verificar | — | Sin ella → DRY-RUN (no escribe) |
| R2 (texto crudo) | Respaldo opcional (SC3) | ⚠ gated | — | r2Enabled=false → texto en memoria, `texto_r2_path=null` (degradación honesta, OK) |

**Missing/uncertain con fallback:** DEEPSEEK_API_KEY y SUPABASE_SECRET_KEY deben confirmarse en `.env` antes del backfill — el planner debe insertar un `checkpoint:human-action` de pre-flight (regenerar `~/obs_env.sh` + confirmar keys presentes).

## Validation Architecture

> `workflow.nyquist_validation` no encontrado explícitamente como `false` → sección incluida.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend `app/**/*.test`) + Vitest (packages) |
| Config file | `app/vitest.config.ts`, `packages/fichas/vitest.config.ts`, raíz `vitest.config.ts` |
| Quick run command | `pnpm --filter @obs/fichas test` / `pnpm --filter app test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC1 | Tokens + header montados | visual (browseros vs mockup) | `python .planning/phases/19-*/refs/bros.py` (shot+compare) | manual/visual |
| SC2 | RPC listado RLS-safe (sin partido/rut/email) | pgTAP | `supabase test db --db-url <url>` (assertion: anon no lee partido) | ❌ Wave 0 (nuevo 0026 test) |
| SC2 | Directorio renderiza 186 + filtro | RTL | `pnpm --filter app test -t "parlamentarios"` | ❌ Wave 0 |
| SC3 | `leerPendientes` entrega link real (no null) | unit | `pnpm --filter @obs/fichas test -t "writer-supabase"` | ✅ existe (extender) |
| SC3 | `idea_matriz > 0` tras backfill | manual (psql) | `psql -c "select count(idea_matriz) from proyecto_ficha"` | gate operador |
| SC4 | Honest-states correctos (no consultado/sin resultados/error distintos) | RTL | existing section tests | ✅ parcial |
| SC5 | e2e producción (diseño/directorio/idea matriz/noindex/MONEY off) | browseros | `bros.py` nav+read en prod | manual/visual |

### Sampling Rate
- **Per task commit:** `pnpm --filter <pkg> test` del paquete tocado.
- **Per wave merge:** `pnpm -r test` (suite completa) verde.
- **Phase gate:** suite verde + psql `count(idea_matriz)>0` + browseros e2e en prod antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `supabase/migrations/0026_*` + su `*.test.sql` pgTAP — RPC listado no expone partido/rut/email
- [ ] `app/app/parlamentarios/page.test.tsx` — render + filtro + honest empty
- [ ] Extender `packages/fichas/src/writer-supabase.test.ts` — `leerPendientes` entrega link real
- [ ] (si Opción B) test del writer de tramitación persistiendo `link_mensaje_mocion`

## Security Domain

> `security_enforcement` no marcado `false` → incluido.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Producto read-only, sin cuentas |
| V3 Session Management | no | Sin sesión |
| V4 Access Control | **yes** | RLS deny-by-default sobre `parlamentario`; RPC `security definer` es el ÚNICO canal público; NUNCA policy/grant que exponga partido/rut/email (LEGAL-03) |
| V5 Input Validation | **yes** | `PARLAMENTARIO_ID_RE` en path; `searchParams` (camara/q) tratados como input no confiable; `.rpc()` parametriza; cap de query |
| V6 Cryptography | no | Sin crypto nueva |
| V10 (SSRF) | **yes** | `assertAllowedUrl` en `obtenerTextoFuente` — solo hosts gubernamentales; el link Senado pasa, cualquier otro degrada |

### Known Threat Patterns for {Next 16 RSC + Supabase RLS + connector LLM}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exposición de PII (partido/rut/email) por el RPC de listado | Information Disclosure | RPC emite SOLO columnas de cabecera; pgTAP que asierta anon no lee partido |
| SSRF vía link_mensaje_mocion manipulado | Tampering/SSRF | `assertAllowedUrl` (allowlist gubernamental + bloqueo de IP privada/metadata) ANTES de cualquier fetch |
| Inyección en path/searchParams del directorio | Tampering | Regex de id + `.rpc()` parametrizado; validar `camara ∈ {diputados,senado}` |
| RUT/PII al LLM en el pipeline | Information Disclosure | El pipeline de fichas procesa TEXTO DE PROYECTO (público), no PII de parlamentarios; sin cruce con la maestra. data-routing gate (`assertNoRutInLlmInput`) ya existe en @obs/llm |
| Fuga de service key en logs | Information Disclosure | Writer nunca interpola la key en errores (solo `error.message` de PostgREST) `[VERIFIED: writer-supabase.ts:87]` |

## Sources

### Primary (HIGH confidence — código del repo)
- `packages/fichas/src/writer-supabase.ts` (líneas 120-148, 143) — `leerPendientes` hardcodea `link_mensaje_mocion: null` = causa raíz SC3
- `packages/fichas/src/pipeline.ts` + `pipeline-cli.ts` + `texto-fuente.ts` — pipeline completo, flags `--reembed`/`--dry-run`/`--service-key`, degradación honesta
- `packages/tramitacion/src/parse-senado-tramitacion.ts:83` + `connector-senado.ts:45` — link extraído como sidecar + fetch del XML
- `packages/tramitacion/test/fixtures/senado-tramitacion.xml:15` — `link_mensaje_mocion` real (host senado.cl)
- `packages/ingest/src/allowlist.ts:19-28` — `senado.cl`/`bcn.cl`/`leychile.cl` ya allowlisted
- `supabase/migrations/0020_parlamentario_publico.sql` — patrón RPC security definer; `0005_parlamentario.sql` — columnas (camara NOT NULL, region/distrito nullable, partido/rut/email PII); `0008_tramitacion.sql` — `proyecto` sin columna link
- `app/app/layout.tsx`, `globals.css`, `proyecto/[boletin]/page.tsx`, `parlamentario/[id]/page.tsx`, `page.tsx`, `lib/buscar.ts` — wiring frontend actual
- `docker-cf-build.sh` — contrato de build Linux (verificado)
- `mockup/landing.html:40-48` — tokens LOCKED en formato HSL crudo
- `19-UI-SPEC.md` + `DESIGN-SYSTEM.md` (en `19-*/`) — diseño cerrado
- Next.js `16.2.9` verificado (`app/node_modules/next/package.json`); docs en `app/node_modules/next/dist/docs/`

### Secondary (MEDIUM — verificado con fuente oficial)
- `.planning/milestones/v1.0-phases/07-*/07-RESEARCH.md` — confirma link Senado primario, BCN obtxml secundario, `obtenerinfoley` obsoleto

### Tertiary (LOW — web, solo confirmación de endpoint secundario)
- BCN obtxml `opt=7&idNorma=` confirmado vigente (ver Sources web abajo) — secundario, no usado en el camino primario

## Metadata

**Confidence breakdown:**
- SC1 (diseño wiring): HIGH — globals.css/layout.tsx/mockup todos leídos; formato de token confirmado
- SC2 (directorio + RPC): HIGH — patrón 0020 + columnas 0005 verificados; filtros nullable documentados
- SC3 (ideas matrices): HIGH en el diagnóstico (causa raíz exacta localizada), MEDIUM en cobertura en vivo (A1/A2 sobre formato/presencia del link)
- SC5 (deploy): HIGH — docker-cf-build.sh + CONTEXT gotcha verificados
- Seguridad: HIGH — LEGAL-03 deny-by-default + SSRF allowlist verificados en código

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (estable; el riesgo es drift del formato del link Senado y de los portales gubernamentales)

Sources web (confirmación BCN obtxml secundario):
- [LeyChile obtxml opt=7 idNorma (ejemplo)](http://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=236862)
- [BCN acceso a normas desde otros sistemas (PDF)](https://www.leychile.cl/esquemas/accesoLeyesChilenas4.pdf)
