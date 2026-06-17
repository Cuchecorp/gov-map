# Phase 1: Framework de Conectores + Almacenamiento + Orquestación - Research

**Researched:** 2026-06-17
**Domain:** Greenfield TypeScript/Deno monorepo · connector framework (rate-limit/cache/drift/provenance) · Supabase (Postgres + R2 raw storage) · pgmq + pg_cron orchestration
**Confidence:** HIGH (stack pre-verified in STACK.md/ARCHITECTURE.md; orchestration pattern confirmed against Supabase docs; package legitimacy verified on correct npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Layout del repo — Monorepo**: `/app` (Next.js 16, App Router), `/supabase` (migraciones SQL + Edge Functions en Deno), `/packages/ingest` (framework de conectores TS compartido), `/packages/core` (tipos compartidos, esquemas zod, interfaces de providers). Un solo lenguaje (TypeScript) en todo el stack.
- **Ejecución de la ingesta** — Edge Functions (Deno) dirigidas por **pgmq + pg_cron** para jobs incrementales del día a día; **GitHub Actions** como escape hatch para backfill masivo que excede el límite de ~400s de Edge Functions. El patrón de worker/cola se construye una sola vez aquí y se reutiliza.
- **Detección de drift — fingerprint de forma**: por cada fuente×snapshot se computa un fingerprint estructural (set de paths/keys presentes + sus tipos). Al ingestar, se compara contra el último fingerprint conocido de esa fuente; si difiere, se inserta una fila `drift_alert` y se loguea, en lugar de corromper en silencio o fallar duro. La validación zod estricta queda para los normalizadores (Fase 5+), no para la capa de ingesta cruda.
- **Caché / no-re-pedir** — llave de caché = hash de (fuente, endpoint, params normalizados, date-bucket diario). Misma llave dentro del día → se sirve el snapshot cacheado, no se re-pide a la fuente. El crudo se guarda en R2 content-addressed por `sha256` (append-only, inmutable); Postgres guarda solo la referencia (`r2_path`, `hash`) + metadatos de `source_snapshot` / `ingest_run`.

**Políticas no negociables (de PROJECT.md / research):**
- Rate-limit 2–3s entre requests al MISMO origen, User-Agent identificatorio (`Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)`), respeto de robots.txt. El WAF gubernamental bloquea ráfagas.
- Todas las llamadas a fuentes externas corren en backend (CORS), nunca desde el navegador.
- Backoff exponencial + cola ante 429.
- Procedencia (origen, fecha de captura, enlace original) capturada en el momento de ingesta, no agregada después.

### Claude's Discretion
- Forma concreta de la interfaz `Connector` (métodos fetch/parse/normalize), nombres de tablas/columnas de control, librería HTTP cliente en Deno, estructura interna de `/packages/ingest`, y mecánica exacta del fingerprint de drift.
- Política de retención de snapshots en R2 a largo plazo: default razonable (conservar todo) salvo que el plan sugiera lo contrario.

### Deferred Ideas (OUT OF SCOPE)
- Conectores concretos por fuente (Cámara doGet.asmx, Senado wspublico, BCN obtxml, WebForms, Next.js __NEXT_DATA__) → Fases 5–7. **No implementar conectores reales en esta fase.**
- Providers LLM/Embeddings (interfaces y adaptadores reales) → Fase 2. *(Interfaces stub OK aquí si el plan las quiere como contrato; adaptadores reales NO.)*
- Mecanismo concreto de respaldo de la tabla de identidades fuera de Supabase → Fase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Ingesta respetuosa: rate-limit 2–3s por origen, User-Agent identificatorio, respeto robots.txt | Token-bucket/serial rate-limiter por host (Pattern 1); `robots-parser` para robots.txt; UA constante en `fetcher.ts` (§3, Code Examples) |
| FND-02 | Crudo en R2 append-only, content-addressed sha256; Postgres solo referencia | `aws4fetch` → R2 S3 API; key scheme `{source}/{resource}/{date}/{sha256}.{ext}`; `If-None-Match: *` para enforcement de inmutabilidad (§4, DDL) |
| FND-03 | Caché diaria + snapshots versionados para re-procesamiento | Cache key = sha256(source+endpoint+normalized-params+date-bucket); lookup en `source_snapshot` antes de fetch (Pattern 2, DDL) |
| FND-04 | Drift detection por fingerprint estructural, registra en vez de fallar | Algoritmo de fingerprint (path-set + tipos) para JSON/XML/HTML; `drift_alert` table; compara vs último fingerprint por (source,resource) (§6) |
| FND-05 | Cola pgmq + pg_cron + chunking + backoff exponencial ante 429, dead-letter | Patrón canónico Supabase "automatic embeddings": pg_cron → `util.process_*()` → pgmq.read(vt) → pg_net.http_post → Edge Function worker; backoff via visibility timeout + `set_vt`; DLQ via `pgmq.archive` (§7) |
| FND-08 | Procedencia capturada al ingestar (origen, fecha captura, enlace original) | Tipo `Provenance` de primera clase en `/packages/core`; escrito en `source_snapshot` en el momento del fetch (DDL, Pattern 2) |
</phase_requirements>

## Summary

Esta fase es **greenfield de fundaciones**: establece el monorepo TypeScript, el plano de datos de control (Postgres + R2), el framework de conectores reutilizable, y el patrón de orquestación por cola — pero **cero conectores concretos**. El éxito se mide porque cualquier conector futuro hereda política (rate-limit, caché, drift, provenance) sin reescribirla, y porque un job pesado corre dirigido por cola con backoff, no como un run largo que revienta el límite de ~400s de Edge Functions.

Tres decisiones técnicas concretas que el planner debe fijar, más allá de lo ya bloqueado en CONTEXT.md: **(1) pnpm workspaces como tooling de monorepo** (ya instalado, 11.3.0; turbo opcional y diferible — no aporta en M1 con un solo paquete buildeado); **(2) `aws4fetch` en lugar de `@aws-sdk/client-s3` para R2 desde Edge Functions Deno** — refinamiento sobre STACK.md, porque aws-sdk v3 es pesado y frágil en el runtime Deno/edge mientras aws4fetch usa fetch+SubtleCrypto nativos; **(3) compartir TS entre Next.js (Node) y Edge Functions (Deno) vía un import map de Supabase + alias `npm:`**, no via build step — Deno consume `/packages/core` por path relativo o por `imports` en `supabase/functions/deno.json`.

El patrón de orquestación FND-05 está **completamente especificado** por la guía oficial de Supabase "automatic embeddings": pg_cron dispara cada N segundos una función SQL (`util.process_*`) que lee lotes de pgmq con visibility timeout, los agrupa, e invoca la Edge Function vía `pg_net.http_post`; los jobs que fallan reaparecen al expirar el vt (backoff natural), y los venenosos se archivan a DLQ. El planner debe reusar exactamente este esqueleto, parametrizado para "ingest jobs" en vez de "embedding jobs".

**Primary recommendation:** pnpm workspaces + `supabase init` + migraciones SQL que habilitan `vector`/`pg_cron`/`pg_net`/`pgmq` y crean `ingest_run`/`source_snapshot`/`drift_alert`; framework `/packages/ingest` con `BaseConnector` (Template Method) + rate-limiter por-host + `aws4fetch` a R2 content-addressed; orquestación pgmq+pg_cron clonando el patrón "automatic embeddings".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch respetuoso (rate-limit, UA, robots) | Connector framework (Deno `/packages/ingest`) | — | Política única; corre server-only por WAF/CORS |
| Almacenamiento de crudo inmutable | Cloudflare R2 (object storage) | Edge Function (escritor) | Crudo fuera de Postgres (límite 8 GB); R2 append-only content-addressed |
| Metadatos de ingesta / referencias | Database (Supabase Postgres) | — | `ingest_run`/`source_snapshot`/`drift_alert`; solo refs + provenance, nunca crudo |
| Caché diaria (no re-pedir) | Database (lookup) + R2 (payload) | Connector framework | Clave en `source_snapshot`; payload servido desde R2 |
| Drift detection | Connector framework (compute) + Database (store/compare) | — | Fingerprint computado en TS; histórico y alerta en Postgres |
| Orquestación / scheduling | Database (pg_cron + pgmq + pg_net) | Edge Function (worker) | Todo en Supabase; cron y cola en Postgres, ejecución en Deno |
| Backfill masivo (escape hatch) | CI (GitHub Actions, Deno) | Connector framework (mismo código) | Sin límite de 400s; mismo conector TS/Deno |
| Provenance capture | `/packages/core` (tipo) + Connector framework (escritura) | Database (persistencia) | Tipo de primera clase; escrito al momento del fetch |

## Standard Stack

> El stack base ya está fijado en STACK.md y CLAUDE.md. Esta sección lista **solo lo que esta fase instala/usa**, con dos refinamientos respecto a STACK.md marcados como `[REFINAMIENTO]`.

### Core (ya decididos — versiones verificadas en entorno)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno | 2.3.1 (instalado) | Runtime de Edge Functions y conectores | `[VERIFIED: deno --version]` Runtime de Supabase Edge Functions; `npm:`/`jsr:` nativos |
| Node.js | 22.21.1 (instalado) | Runtime de Next.js y tooling de monorepo | `[VERIFIED: node --version]` LTS; soporta pnpm workspaces |
| pnpm | 11.3.0 (instalado) | **Tooling de monorepo (workspaces)** | `[VERIFIED: pnpm --version]` Ver §1. Workspaces nativos, sin build orchestration extra en M1 |
| Supabase CLI | 2.98.2 (instalado) | `supabase init`, migraciones, dev local, deploy de functions | `[VERIFIED: supabase --version]` Estándar para bootstrap del proyecto |
| Supabase Postgres | 15+ con pgvector 0.8.x | Plano de control + (futuro) vectores | `[CITED: STACK.md]` pg_cron/pg_net/pgmq integrados |
| Next.js | 16.x (App Router) | Frontend (scaffold solo en esta fase) | `[CITED: STACK.md]` Server Components, server-only fetch |
| TypeScript | 5.x (Deno trae 5.8.3) | Lenguaje único | `[VERIFIED: deno --version → typescript 5.8.3]` |

### Supporting (esta fase instala estos)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **aws4fetch** | 1.0.20 | **`[REFINAMIENTO]` Cliente S3-compat a R2 desde Deno/Edge** | `[VERIFIED: npm registry]` Reemplaza `@aws-sdk/client-s3` para el writer de R2. fetch + SubtleCrypto nativos, peso mínimo, idóneo en edge. Ver §4. |
| **robots-parser** | 3.0.1 | Parsing y evaluación de robots.txt (FND-01) | `[VERIFIED: npm registry]` `isAllowed(url, ua)`; soporta wildcards. Usable via `npm:robots-parser@3` en Deno. Ver §3. |
| zod | 3.x / 4.x | Validación de forma cruda esperada (guard de drift, no estricta) | `[CITED: STACK.md]` En ingesta solo como shape-guard suave; validación estricta es Fase 5+ |
| @supabase/supabase-js | v2 | Cliente DB/Storage desde Edge Functions worker | `[CITED: STACK.md]` |
| @aws-sdk/client-s3 | 3.x | **Alternativa de fallback** a aws4fetch (solo si aws4fetch falla) | `[VERIFIED: npm registry]` Más pesado; usar solo como escape hatch. Ver Alternatives. |

### Diferibles (NO instalar en esta fase salvo que el plan lo justifique)
| Library | Version | Purpose | Why Defer |
|---------|---------|---------|-----------|
| turbo | 2.9.18 | Build/task orchestration de monorepo | `[VERIFIED: npm registry]` Innecesario en M1: un solo paquete buildeable (`/app`); Deno no se buildea. Añade config sin payoff. Adoptar cuando haya múltiples builds Node interdependientes. |
| openai / @google/genai | 5.x / GA | Adaptadores LLM/Embedding | Fase 2 (deferred). Solo interfaces stub aquí si el plan las quiere como contrato. |
| cheerio / fast-xml-parser | 1.2.0 / 5.9.x | Parsers de conectores concretos | Fases 5–7 (deferred). El framework define el *hook* de parseo, no parsers reales. |

**Installation (lo que esta fase instala):**
```bash
# Monorepo root (Node side — Next.js scaffold + shared deps)
pnpm init                                  # crea package.json raíz
# pnpm-workspace.yaml define: app, packages/*

# Frontend scaffold
pnpm create next-app@latest app            # Next.js 16, App Router

# Shared packages (instalados donde se usen)
pnpm add -D typescript                      # raíz
pnpm --filter @obs/core add zod
pnpm --filter @obs/ingest add robots-parser # uso Node (tests/CI); en Deno via npm:

# Supabase
supabase init                               # crea supabase/ con config.toml

# Edge Functions (Deno — sin install; imports directos):
#   import { AwsClient } from "npm:aws4fetch@1";
#   import robotsParser from "npm:robots-parser@3";
#   import { z } from "npm:zod";
#   import { createClient } from "jsr:@supabase/supabase-js@2";
```

**Version verification realizada (2026-06-17):**
- `robots-parser` → 3.0.1 (latest), modificado 2023-02-21. `[VERIFIED: npm view]`
- `aws4fetch` → 1.0.20, modificado 2024-08-28. `[VERIFIED: npm view]`
- `turbo` → 2.9.18, modificado 2026-06-17. `[VERIFIED: npm view]`
- `@aws-sdk/client-s3` → 3.1071.0. `[VERIFIED: npm view]`

## Package Legitimacy Audit

> slopcheck **auto-detectó el ecosistema equivocado** en la primera corrida (PyPI en vez de npm) y marcó `aws4fetch`/`robots-parser` como `[SLOP]` falso-positivo — son paquetes **npm**, no Python. Esto es exactamente la confusión cross-ecosystem que el protocolo advierte (~9% de tasa). Re-corrido con `-e npm`, ambos son `[OK]`. El registro npm es la verificación autoritativa aquí.

| Package | Registry | Age | Source Repo | slopcheck (npm) | Disposition |
|---------|----------|-----|-------------|-----------------|-------------|
| aws4fetch | npm | ~lanzado 2020, v1.0.20 (2024) | github.com/mhart/aws4fetch | [OK] (con `-e npm`) | Approved |
| robots-parser | npm | v3.0.1 (2023), proyecto maduro | github.com/samclarke/robots-parser | [OK] (con `-e npm`) | Approved |
| turbo | npm | v2.9.18 (2026) | github.com/vercel/turborepo | [OK] | Approved pero DIFERIDO (no instalar en M1) |
| @aws-sdk/client-s3 | npm | v3.x oficial AWS | github.com/aws/aws-sdk-js-v3 | not re-run (oficial AWS) | Approved (fallback only) |

**Packages removed due to slopcheck [SLOP] verdict:** none (los `[SLOP]` fueron falsos positivos por ecosistema incorrecto; confirmados `[OK]` en npm).
**Packages flagged as suspicious [SUS]:** none.

**Nota operacional:** la corrida `slopcheck install` (default PyPI) instaló accidentalmente un paquete Python `turbo-0.5.1` (servidor web Tornado, NO el monorepo tool de Vercel). No tiene relación con este proyecto Node/Deno y puede ignorarse/desinstalarse; no afecta el repo.

## Architecture Patterns

### System Architecture Diagram (data flow de esta fase)

```
                    ┌─────────────────────────────────────────────┐
   pg_cron (sched)──┤  Postgres (plano de control)                │
        │           │  ingest_run · source_snapshot · drift_alert │
        │ select    │  pgmq queues: ingest_jobs / ingest_dlq      │
        ▼           └──────────┬──────────────────────────────────┘
  util.process_ingest()        │ pgmq.read(vt=N, qty=batch)
        │                       │ → agrupa en lotes
        │ pg_net.http_post ─────┘
        ▼
  Edge Function "ingest-worker" (Deno)
        │  usa /packages/ingest:
        │   BaseConnector.run(spec):
        │     1. cache.hasToday(key)? ──yes──▶ skip (sirve snapshot)
        │     2. robots.isAllowed(url, UA)? ──no──▶ skip + log
        │     3. rateLimiter.wait(host)  (2–3s + jitter, por host)
        │     4. fetcher.get(url, UA)    ──429──▶ throw → vt expira → retry (backoff)
        │     5. fingerprint(body) vs último ──difiere──▶ insert drift_alert
        │     6. sha256(body) ──▶ R2.put({source}/{res}/{date}/{hash}, If-None-Match:*)
        │     7. insert source_snapshot(r2_path, hash, provenance, fetched_at)
        │     8. pgmq.delete(msg_id)   (éxito) | archive→dlq (veneno)
        ▼
   Cloudflare R2 (crudo inmutable, append-only, content-addressed)
        {source}/{resource}/{YYYY-MM-DD}/{sha256}.{ext}

   [Escape hatch] GitHub Actions (Deno) corre el MISMO BaseConnector
   para backfill masivo que excede ~400s, con el mismo rate-limit.
```

> Trazá el caso primario siguiendo las flechas: cron → process → read queue → http_post → worker corre el connector (cache→robots→rate-limit→fetch→drift→R2→snapshot) → ack en la cola.

### Recommended Project Structure (monorepo)

```
/                                  # raíz pnpm workspace
├── pnpm-workspace.yaml            # packages: ["app", "packages/*"]
├── package.json                   # scripts raíz (lint, typecheck)
├── tsconfig.base.json             # config TS compartida
├── .env / .env.example            # secrets (ya existe .env)
├── app/                           # Next.js 16 (scaffold; sin features M1)
│   └── ...
├── packages/
│   ├── core/                      # @obs/core — tipos + zod + interfaces
│   │   ├── src/
│   │   │   ├── provenance.ts      # tipo Provenance {source,fetchedAt,sourceUrl,snapshotRef}
│   │   │   ├── domain.ts          # tipos de control (IngestRun, SourceSnapshot…)
│   │   │   └── providers/         # interfaces stub LLMProvider/EmbeddingProvider (opcional)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ingest/                    # @obs/ingest — framework de conectores
│       ├── src/
│       │   ├── base-connector.ts  # Template Method: run() invariante
│       │   ├── rate-limiter.ts    # por-host, 2–3s + jitter (token bucket)
│       │   ├── fetcher.ts         # UA identificado, robots, retry/backoff
│       │   ├── robots.ts          # wrapper sobre robots-parser
│       │   ├── cache.ts           # caché diaria (clave: hash(src,endpoint,params,date))
│       │   ├── r2-store.ts        # aws4fetch → R2 content-addressed
│       │   ├── snapshot.ts        # escribe source_snapshot + provenance
│       │   └── drift.ts           # fingerprint + compare + alert
│       ├── package.json
│       └── tsconfig.json
└── supabase/
    ├── config.toml                # supabase init
    ├── migrations/                # SQL: extensions + tablas de control + cron/queues
    │   ├── 0001_extensions.sql    # vector, pg_cron, pg_net, pgmq
    │   ├── 0002_control_tables.sql# ingest_run, source_snapshot, drift_alert
    │   └── 0003_orchestration.sql # pgmq queues + util.* + pg_cron schedule
    ├── functions/
    │   ├── deno.json              # import map: alias @obs/* a ../packages/*/src
    │   └── ingest-worker/
    │       └── index.ts           # consume pgmq batch, corre BaseConnector
    └── seed.sql                   # opcional
```

### Pattern 1: BaseConnector — Template Method (FND-01..04, FND-08)
**What:** Clase base define el flujo invariante (cache → robots → rate-limit → fetch → drift → R2 → snapshot); cada conector futuro implementa solo hooks (`endpoints`, `validateShape`, `fingerprint`). Política una sola vez.
**When to use:** Toda fuente externa. Es el núcleo de la fase. Ningún conhello debe poder saltarse `rateLimiter.wait`.
**Example:**
```typescript
// Source: ARCHITECTURE.md Pattern 1 (adaptado) — /packages/ingest/src/base-connector.ts
abstract class BaseConnector<Raw> {
  protected abstract sourceId: string;
  protected abstract endpoints(): RequestSpec[];
  protected abstract validateShape(body: unknown): Raw;   // shape-guard suave (no zod estricto)
  protected abstract fingerprint(raw: Raw): string;        // para drift (ver §6)

  async run(ctx: IngestRun): Promise<SnapshotRef[]> {
    const refs: SnapshotRef[] = [];
    for (const spec of this.endpoints()) {
      const key = this.cache.dailyKey(this.sourceId, spec); // hash(src,endpoint,params,date-bucket)
      if (await this.cache.hasToday(key)) continue;          // FND-03 caché diaria
      if (!await this.robots.isAllowed(spec.url)) {          // FND-01 robots
        await this.log.skip(spec, "robots-disallow"); continue;
      }
      await this.rateLimiter.wait(spec.host);                // FND-01 2–3s por host
      const body = await this.fetcher.get(spec, IDENTIFIED_UA); // throws en 429 → retry por vt
      const raw = this.validateShape(body);
      const fp = this.fingerprint(raw);
      const drift = await this.drift.check(this.sourceId, spec.key, fp); // FND-04
      if (drift.changed) await this.drift.alert(drift);       // registra, NO falla
      const hash = await sha256(body);
      const r2path = await this.r2.putImmutable(this.sourceId, spec, hash, body); // FND-02
      refs.push(await this.snapshot.write({                   // FND-08 provenance al ingestar
        sourceId: this.sourceId, key, r2path, hash,
        provenance: { source: this.sourceId, fetchedAt: now(), sourceUrl: spec.url },
      }));
    }
    return refs;
  }
}
```

### Pattern 2: Raw-immutable / normalized-derived (FND-02, FND-03)
**What:** R2 es la fuente de verdad inmutable (append-only, content-addressed); Postgres guarda solo `source_snapshot(r2_path, hash, provenance)`. Re-procesar = re-leer R2, sin re-scrapear.
**When to use:** Siempre. Es lo que hace barato el re-proceso y defendible la trazabilidad.
**Example:**
```
Ingesta:  fuente → R2://{source}/{resource}/{YYYY-MM-DD}/{sha256}.{ext}  (+ If-None-Match:*)
                → Postgres source_snapshot(source, resource, r2_path, hash, fetched_at, provenance)
Cache hit: source_snapshot tiene fila para (source,resource,date) → sirve r2_path, no re-pide
Re-proceso: re-encolar snapshot_ids → leer R2 → normalizar (Fase 5+), cero red externa
```

### Pattern 3: Cola pgmq + pg_cron + worker (FND-05) — clon de "automatic embeddings"
**What:** pg_cron dispara `util.process_ingest_jobs()`; ésta lee lotes de pgmq con visibility timeout e invoca la Edge Function via `pg_net.http_post`. Fallos reaparecen al expirar el vt (backoff natural); venenosos → DLQ.
**When to use:** Todo trabajo de ingesta pesado/recurrente. Es el patrón canónico documentado por Supabase.
**Example:** ver §7 y Code Examples (SQL).

### Anti-Patterns to Avoid
- **Rate-limit por-conector copy-pasteado** → divergencia y baneos por WAF. El limiter vive en el framework, por host, una sola vez.
- **Crudo en Postgres** → revienta 8 GB; mezcla inmutable con derivado. Crudo siempre a R2.
- **`@aws-sdk/client-s3` cargado en cada invocación de Edge Function** → cold-start pesado y problemas de compat en Deno. Usar `aws4fetch`.
- **Un solo run largo para backfill** → topa el límite ~400s de Edge Functions. Chunking + cola desde el día 1; backfill masivo → GitHub Actions.
- **Validación zod estricta en la capa de ingesta cruda** → la ingesta debe capturar el crudo aunque el esquema cambie (drift se registra, no se rechaza). zod estricto es para normalizadores (Fase 5+).
- **Hardcodear `buildId`/parsers de fuentes concretas aquí** → fuera de scope (Fases 5–7). El framework solo define los hooks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cola durable con reintentos | Tabla `jobs` + polling casero + locking | **pgmq** (`pgmq.send/read/delete/archive`) | Visibility timeout, exactly-once, DLQ vía archive — resuelto y testeado en Postgres |
| Scheduler | setInterval en un proceso / cron de OS | **pg_cron** | Vive en Postgres, sobrevive a reinicios, observabilidad en `cron.job_run_details` |
| HTTP async desde SQL | — | **pg_net** (`net.http_post`) | Único modo soportado para que cron invoque Edge Functions |
| Firma S3 v4 para R2 | Implementar AWS SigV4 a mano (HMAC, canonical request) | **aws4fetch** | SigV4 es notoriamente fácil de romper; aws4fetch lo hace con SubtleCrypto |
| Parsing/evaluación de robots.txt | Regex sobre el archivo | **robots-parser** | Wildcards, precedencia de reglas, `crawl-delay`, casos borde RFC 9309 |
| Content-addressing | — | **`crypto.subtle.digest("SHA-256")`** (Web Crypto, nativo Deno) | Nativo en Deno y Node 22; no instalar librería de hashing |
| Inmutabilidad de objetos | Check "existe?" + GET antes de PUT (race) | **`If-None-Match: *`** en el PUT a R2 | R2 soporta conditional PUT; atómico, sin race |

**Key insight:** Todo el plano de jobs (cola, scheduler, HTTP async, reintentos, DLQ) ya existe dentro de Postgres/Supabase. Construir cualquier pieza casera de orquestación en M1 contradice "todo en Supabase" y reintroduce la infra (Redis/proceso persistente) que el proyecto evitó a propósito.

## Runtime State Inventory

> Greenfield, pero la fase **crea estado runtime que fases posteriores heredarán**. Se inventaría para que el planner lo trate explícitamente.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguno preexistente (greenfield). Esta fase **crea**: tablas `ingest_run`/`source_snapshot`/`drift_alert` y objetos R2 content-addressed. | Migraciones SQL + bucket R2 (crear vía dashboard/API) |
| Live service config | **pg_cron schedules y pgmq queues viven en la DB de Supabase, NO en git** salvo que se definan vía migración SQL. | **Definir cron + queues vía migración SQL** (`cron.schedule(...)`, `pgmq.create(...)`) para que sean reproducibles y versionadas, no clickeadas en el dashboard |
| OS-registered state | Ninguno (no hay Task Scheduler/systemd; GitHub Actions se define por YAML en repo) | Workflow YAML en `.github/workflows/` versionado |
| Secrets/env vars | `.env` ya existe con: `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `DEEPSEEK_API_KEY`, claves `R*` (R2: account id, access key, secret, bucket, endpoint/token), `DB*`, `SUPABASE_PROJECT_ID`, `SUPABASE_SECRET_KEY`, `SUPABASE_API_URL`. **Los nombres exactos de las claves R2 deben confirmarse al leer `.env`** — aparecen parcialmente truncados (`R`, `TOKEN_VALUE_R`). | (1) Crear `.env.example` sin valores. (2) Cargar secrets en Edge Functions vía `supabase secrets set`. (3) Cargar en GitHub Actions vía repo secrets. Ver §8 |
| Build artifacts | Ninguno aún. `pnpm install` creará `node_modules`/`.pnpm`; Deno cacheará `npm:` deps. | `.gitignore` adecuado desde el scaffold |

**Confirmación pendiente para el planner:** los nombres exactos de las variables R2 en `.env` (account ID, access key ID, secret access key, bucket, endpoint) — la lectura de nombres salió truncada (`R`, `R`, `R`, `R`, `TOKEN_VALUE_R`). El plan debe leer `.env` directamente y mapear los nombres reales al `r2-store.ts`. `[ASSUMED]` que cubren las 5 piezas necesarias para aws4fetch.

## Common Pitfalls

### Pitfall 1: Edge Function topa el límite de ~400s en backfill
**What goes wrong:** Un run que procesa muchos endpoints en serie con delay 2–3s supera fácilmente los ~400s de wall-clock de las Edge Functions (plan Pro) y se corta a la mitad.
**Why it happens:** Tentación de "procesar todo de una". Con 2–3s/request, ~130–200 requests ya agotan la ventana.
**How to avoid:** Chunking obligatorio: cada invocación procesa un lote pequeño (p.ej. 5–10 mensajes), hace ack, y el siguiente tick del cron sigue. Backfill masivo → GitHub Actions (sin límite). `[CITED: ARCHITECTURE.md — ~400s plan Pro]`
**Warning signs:** Functions que terminan en timeout; jobs a medio procesar; logs cortados en ~400s.

### Pitfall 2: WAF gubernamental bloquea ráfagas
**What goes wrong:** Paralelismo o falta de delay → 403/429 → IP de Edge Functions baneada.
**Why it happens:** Default de HTTP es ir rápido; `Promise.all` sobre una lista = ráfaga. Nunca se gatilla en dev (pocos requests).
**How to avoid:** Rate-limiter **serial por host** en el framework (no por conector), 2–3s + jitter; backoff exponencial ante 429 vía vt de pgmq; caché diaria; respeto robots.txt. **Criterio de aceptación de la fase: un backfill completo sin un solo 403/429.** `[CITED: PITFALLS.md Pitfall 3]`
**Warning signs:** Primer 403/429/captcha; funciona en local y falla en prod.

### Pitfall 3: Drift silencioso corrompe sin avisar
**What goes wrong:** La fuente cambia su esquema; el parser sigue "funcionando" pero produce basura o nulls sin error.
**Why it happens:** Endpoints gubernamentales cambian esquema sin aviso; validación estricta rechazaría (pierde el crudo) y validación nula corrompe.
**How to avoid:** Fingerprint estructural por (source,resource); comparar contra el último; si difiere → `drift_alert` + log, **sin detener la ingesta** (el crudo igual se guarda en R2). zod en ingesta solo como shape-guard suave. `[CITED: CONTEXT.md decisión drift; PITFALLS.md Pitfall — validación de esquema]`
**Warning signs:** `drift_alert` vacía cuando una fuente cambió; conteos de campos que caen a cero.

### Pitfall 4: Race de inmutabilidad en R2 (check-then-put)
**What goes wrong:** Dos workers escriben el mismo objeto; un "¿existe? luego PUT" tiene race y puede sobrescribir.
**Why it happens:** Inmutabilidad implementada con GET+PUT en vez de conditional PUT.
**How to avoid:** Content-addressing (mismo contenido = misma key sha256 = idempotente) + `If-None-Match: *` en el PUT (R2 falla si ya existe). Append-only por diseño. `[ASSUMED]` (R2 soporta conditional PUT; confirmar en docs R2 al planificar).
**Warning signs:** Objetos sobrescritos con timestamp distinto; hashes que no cuadran con el contenido.

### Pitfall 5: Config de cron/queues fuera de git (no reproducible)
**What goes wrong:** `cron.schedule` y `pgmq.create` ejecutados a mano en el SQL editor del dashboard → no están en migraciones → un proyecto nuevo no los tiene.
**Why it happens:** Es más rápido clickear que escribir la migración.
**How to avoid:** Toda la orquestación (extensions, queues, schedules, funciones util) en archivos de migración SQL versionados. `[CITED: Runtime State Inventory]`
**Warning signs:** El cron funciona en prod pero `supabase db reset` local no reproduce los jobs.

## Code Examples

### Habilitar extensiones (migración SQL) — FND-05
```sql
-- Source: STACK.md / Supabase docs — supabase/migrations/0001_extensions.sql
create extension if not exists vector;     -- pgvector 0.8.x (para Fase 7; barato habilitar ya)
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgmq;       -- Supabase Queues
```

### Crear queue + cola DLQ + schedule (migración SQL) — FND-05
```sql
-- Source: Supabase "Automatic Embeddings" pattern (adaptado) — 0003_orchestration.sql
select pgmq.create('ingest_jobs');
select pgmq.create('ingest_dlq');

-- cron dispara el dispatcher cada 30s (ajustar)
select cron.schedule(
  'process-ingest-jobs',
  '30 seconds',
  $$ select util.process_ingest_jobs(); $$
);
```

### Dispatcher SQL que lee lotes e invoca la Edge Function — FND-05
```sql
-- Source: Supabase Automatic Embeddings (util.process_embeddings adaptado)
create or replace function util.process_ingest_jobs(
  batch_size int default 5,
  max_requests int default 4,
  timeout_ms int default 300000           -- vt = 5 min; job que no acka, reaparece (backoff)
) returns void language plpgsql as $$
declare
  job record;
  batch jsonb := '[]'::jsonb;
begin
  for job in
    select * from pgmq.read('ingest_jobs', (timeout_ms/1000)::int, batch_size * max_requests)
  loop
    batch := batch || to_jsonb(job);
  end loop;
  if jsonb_array_length(batch) = 0 then return; end if;

  -- invoca la Edge Function (pg_net async). El worker hace pgmq.delete en éxito.
  perform net.http_post(
    url     := util.project_url() || '/functions/v1/ingest-worker',
    body    := batch,
    headers := jsonb_build_object('Authorization', 'Bearer ' || util.service_key()),
    timeout_milliseconds := timeout_ms
  );
end; $$;
```
> El visibility timeout = backoff natural: un 429 que hace fallar el worker deja el mensaje sin `delete`; reaparece al expirar el vt y el próximo tick lo reintenta. Para backoff exponencial explícito, el worker puede `pgmq.set_vt(queue, msg_id, offset_creciente)` antes de soltar. Mensajes con `read_ct` alto → `pgmq.archive` (DLQ). `[VERIFIED: Supabase pgmq docs]`

### Worker Edge Function (Deno) — esqueleto — FND-01,02,04,08
```typescript
// Source: Supabase Edge Functions + ARCHITECTURE.md — supabase/functions/ingest-worker/index.ts
import { z } from "npm:zod";
import { createClient } from "jsr:@supabase/supabase-js@2";
// import { runConnector } from "../../packages/ingest/src/base-connector.ts"; // via import map

Deno.serve(async (req) => {
  const batch = z.array(z.object({ msg_id: z.number(), message: z.unknown() }))
    .parse(await req.json());
  const sb = createClient(Deno.env.get("SUPABASE_API_URL")!, Deno.env.get("SUPABASE_SECRET_KEY")!);
  for (const job of batch) {
    try {
      // await runConnector(job.message);          // cache→robots→rate-limit→fetch→drift→R2→snapshot
      await sb.rpc("pgmq_delete", { queue: "ingest_jobs", msg_id: job.msg_id }); // ack
    } catch (_e) {
      // no ack → vt expira → retry. read_ct alto se archiva a DLQ en el dispatcher.
    }
  }
  return new Response("ok", { status: 200 });
});
```

### R2 content-addressed writer con aws4fetch — FND-02
```typescript
// Source: Cloudflare R2 aws4fetch docs (adaptado) — /packages/ingest/src/r2-store.ts
import { AwsClient } from "npm:aws4fetch@1";

const r2 = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,     // confirmar nombre real en .env
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
});
const ENDPOINT = Deno.env.get("R2_ENDPOINT")!;         // https://<accountid>.r2.cloudflarestorage.com
const BUCKET = Deno.env.get("R2_BUCKET")!;

export async function putImmutable(
  source: string, resource: string, date: string, sha: string, ext: string, body: Uint8Array,
): Promise<string> {
  const key = `${source}/${resource}/${date}/${sha}.${ext}`;   // content-addressed
  const url = `${ENDPOINT}/${BUCKET}/${key}`;
  const res = await r2.fetch(url, {
    method: "PUT", body,
    headers: { "If-None-Match": "*" },                 // falla si ya existe → inmutable
  });
  if (!res.ok && res.status !== 412) throw new Error(`R2 PUT ${res.status}`);
  return key;                                          // 412 = ya existía (idempotente, OK)
}
```

### Fingerprint estructural para drift — FND-04
```typescript
// Source: ARCHITECTURE.md drift-detector (concretado) — /packages/ingest/src/drift.ts
// Fingerprint = set ordenado de (path, tipo) sobre la estructura, hasheado.
function structuralPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null) return [`${prefix}:null`];
  if (Array.isArray(obj)) return obj.length ? structuralPaths(obj[0], `${prefix}[]`) : [`${prefix}[]:empty`];
  if (typeof obj === "object") {
    return Object.keys(obj).sort().flatMap((k) =>
      structuralPaths((obj as Record<string, unknown>)[k], `${prefix}.${k}`));
  }
  return [`${prefix}:${typeof obj}`];
}
export async function fingerprint(raw: unknown): Promise<string> {
  const paths = [...new Set(structuralPaths(raw))].sort().join("\n");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(paths));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// XML/HTML: parsear primero (fast-xml-parser/cheerio en Fases 5+) y aplicar el mismo algoritmo
// sobre el objeto resultante; en M1 el framework expone el hook, no el parser concreto.
```

### DDL del plano de control — FND-02,03,04,08
```sql
-- Source: ARCHITECTURE.md modelo + CONTEXT.md decisiones — 0002_control_tables.sql
create table ingest_run (
  id            bigint generated always as identity primary key,
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running',  -- running|ok|error
  stats         jsonb default '{}'::jsonb,
  error         text
);

create table source_snapshot (
  id            bigint generated always as identity primary key,
  ingest_run_id bigint references ingest_run(id),
  source        text not null,
  resource      text not null,                     -- endpoint/recurso lógico
  cache_key     text not null,                     -- hash(source,endpoint,params,date-bucket)
  r2_path       text not null,                     -- {source}/{resource}/{date}/{sha}.{ext}
  content_hash  text not null,                     -- sha256 del crudo
  fingerprint   text not null,                     -- fingerprint estructural (FND-04)
  -- Provenance (FND-08) capturada al ingestar:
  source_url    text not null,
  fetched_at    timestamptz not null default now(),
  date_bucket   date not null,
  unique (source, resource, date_bucket)           -- caché diaria: 1 snapshot por día
);
create index on source_snapshot (cache_key);
create index on source_snapshot (content_hash);

create table drift_alert (
  id              bigint generated always as identity primary key,
  source          text not null,
  resource        text not null,
  prev_fingerprint text,
  new_fingerprint  text not null,
  detected_at     timestamptz not null default now(),
  snapshot_id     bigint references source_snapshot(id),
  acknowledged    boolean not null default false
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ + Redis para colas | pgmq dentro de Postgres | Supabase Queues GA | Cero infra extra; todo en Supabase |
| `@aws-sdk/client-s3` en edge | aws4fetch (fetch + SubtleCrypto) | Práctica edge 2024+ | Cold-start menor, compat Deno/Workers nativa |
| Cron de OS / proceso persistente | pg_cron + pg_net invoca Edge Functions | Patrón Supabase | Scheduling versionado en SQL |
| turborepo para todo monorepo | pnpm workspaces solo (turbo cuando haya múltiples builds) | — | Menos config en M1 |

**Deprecated/outdated en el contexto de esta fase:**
- `@aws-sdk/client-s3` como default para R2 desde Edge Functions: relegado a fallback (no deprecado, pero subóptimo en edge).
- turbo en M1: innecesario hasta que existan múltiples paquetes Node con builds interdependientes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Las variables R2 en `.env` cubren accountId/endpoint/accessKey/secret/bucket con nombres mapeables a aws4fetch | Runtime State, §4 | El writer R2 falla en runtime; el plan debe leer `.env` y mapear nombres reales |
| A2 | R2 soporta `If-None-Match: *` (conditional PUT) para enforcement atómico de inmutabilidad | Pitfall 4, §4 | Si no, usar content-addressing (key=sha) como idempotencia + política bucket; aún seguro |
| A3 | `npm:aws4fetch@1` y `npm:robots-parser@3` resuelven sin problemas dentro del runtime Deno de Edge Functions | §3, §4 | Si robots-parser falla en Deno, usar `robotstxt-ts-port` (RFC 9309, TS puro) o fetch+parse propio |
| A4 | pgmq en Supabase expone las funciones `pgmq.send/read/delete/archive/set_vt` con las firmas documentadas | §7 | Verificado contra docs; bajo riesgo |
| A5 | turbo no aporta en M1 (un solo build Node) | Standard Stack | Si el plan añade múltiples apps Node, reconsiderar — decisión barata de revertir |
| A6 | `MINIMAX_API_KEY` corresponde a "MiniMax M3" de PROJECT.md (la familia/modelo exacto se fija en Fase 2) | .env | No afecta esta fase; los adaptadores son Fase 2 |

## Open Questions

1. **Nombres exactos de las variables R2 en `.env`**
   - Qué sabemos: existen claves `R*` y `TOKEN_VALUE_R` en `.env`; el proyecto usa Cloudflare R2.
   - Qué falta: los nombres exactos (la lectura salió truncada).
   - Recomendación: el plan lee `.env` directamente como primer paso y fija los nombres en `r2-store.ts` + `.env.example`.

2. **¿Crear el bucket R2 manualmente o vía IaC?**
   - Qué sabemos: aws4fetch escribe objetos, no crea buckets.
   - Qué falta: si el bucket ya existe (dashboard) o hay que crearlo.
   - Recomendación: asumir bucket creado vía dashboard Cloudflare (paso humano); documentar en el plan como `checkpoint:human-verify`.

3. **¿Interfaces stub de LLMProvider/EmbeddingProvider en `/packages/core` ahora?**
   - Qué sabemos: Fase 2 las implementa; CONTEXT.md las difiere.
   - Qué falta: si conviene declarar el *contrato* (interface TS vacía) ya en M1.
   - Recomendación: opcional y barato — declarar solo las interfaces (sin adaptadores) si reduce churn en Fase 2; no obligatorio.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, pnpm tooling | ✓ | 22.21.1 | — |
| pnpm | Monorepo workspaces | ✓ | 11.3.0 | npm workspaces |
| Deno | Edge Functions, conectores | ✓ | 2.3.1 | — |
| Supabase CLI | init, migraciones, deploy | ✓ | 2.98.2 | — |
| git | Versionado | ✓ | 2.53.0 | — |
| Cuenta Supabase (proyecto remoto) | Deploy de migraciones/functions | ⚠ (`.env` tiene `SUPABASE_PROJECT_ID`) | — | Dev local con `supabase start` (Docker) |
| Cuenta Cloudflare R2 (bucket) | FND-02 storage | ⚠ (`.env` tiene claves R2) | — | — (sin fallback; bloquea FND-02 si falta bucket) |
| Docker | `supabase start` (Postgres local) | ? (no probado) | — | Usar proyecto Supabase remoto directamente |

**Missing dependencies with no fallback:**
- Bucket R2 existente y credenciales válidas — bloquea FND-02. Verificar como checkpoint humano.

**Missing dependencies with fallback:**
- Docker para Supabase local: si no está, desarrollar contra el proyecto remoto (`SUPABASE_PROJECT_ID` en `.env`). El plan debe probar `docker info` y decidir local vs remoto.

## Validation Architecture

> `nyquist_validation: true` en config. Esta fase es altamente testeable: la corrección de ingesta, el cumplimiento del rate-limit, la inmutabilidad de R2 y la detección de drift son todos verificables con tests automatizados (la mayoría sin tocar fuentes reales, usando fixtures).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Deno test** (`deno test`) para `/packages/ingest` y Edge Functions (runtime real); **Vitest** opcional para `/packages/core` (Node) si el plan lo prefiere |
| Config file | none — crear en Wave 0 (`deno.json` con tasks; `vitest.config.ts` si se usa) |
| Quick run command | `deno test packages/ingest/ --allow-none` (unit, fixtures, sin red) |
| Full suite command | `deno test --allow-net --allow-env` (incluye integración contra Supabase local/remoto) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | rate-limiter respeta ≥2s entre requests al mismo host | unit (fake timers) | `deno test packages/ingest/rate-limiter.test.ts` | ❌ Wave 0 |
| FND-01 | robots disallow → skip + log, no fetch | unit (robots fixture) | `deno test packages/ingest/robots.test.ts` | ❌ Wave 0 |
| FND-02 | sha256 estable; key content-addressed; `If-None-Match` en PUT | unit (mock fetch) | `deno test packages/ingest/r2-store.test.ts` | ❌ Wave 0 |
| FND-03 | misma cache_key dentro del día → no re-fetch | unit | `deno test packages/ingest/cache.test.ts` | ❌ Wave 0 |
| FND-04 | fingerprint difiere ante cambio de esquema → drift_alert | unit (2 fixtures) | `deno test packages/ingest/drift.test.ts` | ❌ Wave 0 |
| FND-05 | worker hace ack en éxito; no-ack en fallo (mensaje reaparece) | integration (Supabase local) | `deno test --allow-net supabase/functions/ingest-worker/` | ❌ Wave 0 |
| FND-05 | migraciones aplican y crean extensions/queues/cron | integration | `supabase db reset && supabase db lint` | ❌ Wave 0 |
| FND-08 | source_snapshot graba provenance (source/fetched_at/source_url) al ingestar | unit | `deno test packages/ingest/snapshot.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `deno test packages/ingest/ --allow-none` (unit, < 5s, sin red)
- **Per wave merge:** `deno test --allow-net --allow-env` + `supabase db reset`
- **Phase gate:** suite completa verde + migraciones aplican limpias antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `deno.json` (tasks de test + import map) — framework de test
- [ ] `packages/ingest/test/fixtures/` — JSON/XML/HTML de muestra para drift y parsing-hook
- [ ] `packages/ingest/test/_helpers.ts` — fake timers, mock fetch, robots fixtures
- [ ] Tests por requisito (8 archivos arriba) — todos ❌, crear en Wave 0
- [ ] Decisión local-vs-remoto para tests de integración (probar `docker info`)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`. Esta fase no expone endpoints de usuario, pero maneja **secrets** (claves R2/LLM/Supabase) y hace **requests salientes** a fuentes externas — eso define su superficie.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin login de usuario en esta fase |
| V3 Session Management | no | — |
| V4 Access Control | parcial | RLS en Supabase desde el inicio; tablas de control no expuestas a `anon` (solo service role) |
| V5 Input Validation | yes | zod como shape-guard sobre respuestas de fuentes; validar el batch que recibe el worker |
| V6 Cryptography | yes | `crypto.subtle` (Web Crypto) para sha256; SigV4 vía aws4fetch — **nunca hand-roll** |
| V7 Error Handling/Logging | yes | `ingest_run.error`, `drift_alert` como log estructurado; no loguear secrets |
| V8 Data Protection | yes | Secrets solo en `.env`/`supabase secrets`/GitHub secrets; nunca en cliente ni git. `.env.example` sin valores. Crudo en R2 es público-derivado (legislativo), sin dato personal en M1 |

### Known Threat Patterns for {TS/Deno + Supabase + R2 ingest}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret en repo / cliente (claves R2/LLM/service-role) | Information Disclosure | `.env` + `supabase secrets set` + GitHub repo secrets; `.gitignore` `.env`; `.env.example` sin valores |
| Service-role key filtrada al frontend | Elevation of Privilege | Service key solo en Edge Functions/CI; frontend usa anon + RLS |
| SSRF / abuso del fetcher (URL no confiable) | Tampering | Allow-list de hosts de fuentes en el framework; el worker no fetchea URLs arbitrarias de la cola sin validar host |
| Tablas de control legibles por `anon` | Information Disclosure | RLS deny-by-default; `ingest_run`/`source_snapshot`/`drift_alert` solo service role |
| Firma S3 mal implementada | Spoofing/Tampering | aws4fetch (SigV4 probado), no implementación propia |
| Poison message satura la cola (DoS interno) | Denial of Service | `read_ct` máximo → `pgmq.archive` a DLQ; el worker no entra en loop infinito |

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — stack verificado (cheerio, fast-xml-parser, pgmq, pg_cron, pgvector, openai SDK), versiones, patrones — HIGH
- `.planning/research/ARCHITECTURE.md` — pipeline de procedencia, BaseConnector, modelo de control, límite ~400s Edge Functions — HIGH
- `.planning/research/PITFALLS.md` — WAF, drift silencioso, free tier, looks-done-but-isn't checklist — HIGH
- [Supabase Automatic Embeddings (pg_cron + pgmq + pg_net + Edge Function)](https://supabase.com/docs/guides/ai/automatic-embeddings) — patrón canónico de orquestación (`util.process_*`, `util.invoke_edge_function`, vt retry) — HIGH `[VERIFIED]`
- [Supabase Queues / PGMQ](https://supabase.com/docs/guides/queues/pgmq) — firmas `pgmq.create/send/read/pop/delete/archive/set_vt` — HIGH `[VERIFIED]`
- Entorno local — `deno 2.3.1`, `node 22.21.1`, `pnpm 11.3.0`, `supabase 2.98.2` `[VERIFIED: tool --version]`
- npm registry — versiones de `robots-parser@3.0.1`, `aws4fetch@1.0.20`, `turbo@2.9.18`, `@aws-sdk/client-s3@3.x` `[VERIFIED: npm view]`; legitimidad `[OK]` en npm vía slopcheck `-e npm`

### Secondary (MEDIUM confidence)
- [aws4fetch · Cloudflare R2 docs](https://developers.cloudflare.com/r2/examples/aws/aws4fetch/) — aws4fetch recomendado para edge/Workers/Deno sobre aws-sdk — MEDIUM
- [robots-parser — npm](https://www.npmjs.com/package/robots-parser) + [robotstxt-ts-port (RFC 9309)](https://github.com/trybyte-app/robotstxt-ts-port) — opciones de parsing robots.txt en TS/Deno — MEDIUM

### Tertiary (LOW confidence)
- Conocimiento de dominio sobre `If-None-Match: *` en R2 conditional PUT — confirmar en docs R2 al planificar (A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versiones verificadas en entorno y npm; refinamientos (aws4fetch, turbo-defer) con fuente
- Architecture / orchestration: HIGH — patrón pgmq+pg_cron+pg_net confirmado contra docs oficiales de Supabase
- Pitfalls: HIGH — heredados de PITFALLS.md (fuente primaria del proyecto) + límite 400s de ARCHITECTURE.md
- R2 specifics (nombres de env, conditional PUT): MEDIUM — requieren confirmación al planificar (A1, A2)

**Tooling note:** Context7/ctx7 no disponible en el entorno (ctx7 MISSING) — documentación obtenida vía WebFetch sobre docs oficiales de Supabase/Cloudflare. slopcheck disponible pero auto-detectó ecosistema PyPI; verificación autoritativa hecha con `-e npm` + `npm view`.

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stack estable; re-verificar versiones de Deno/Supabase CLI y disponibilidad de pgmq APIs si pasa el mes)
