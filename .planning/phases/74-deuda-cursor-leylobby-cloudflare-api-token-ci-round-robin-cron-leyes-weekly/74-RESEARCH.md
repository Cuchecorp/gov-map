# Phase 74: DEUDA — Cursor leylobby + `CLOUDFLARE_API_TOKEN` CI + round-robin cron leyes-weekly - Research

**Researched:** 2026-07-14
**Domain:** Ingesta incremental (cursor/marcador), CI wiring de secrets GH Actions, rotación de cron sobre corpus, frescura por fuente
**Confidence:** HIGH (todo es código EXISTENTE en el repo; sin dependencias externas nuevas)

## Summary

Los tres ítems (DEBT-02/03/04) son deuda de **wiring sobre código que ya existe** — no net-new. La investigación confirma cada ubicación exacta:

- **DEBT-02 (cursor leylobby):** el conector (`packages/lobby/src/connector-leylobby.ts`) y su orquestador (`ingest-run.ts` + `ingest-cli.ts`) SÍ tienen hash-check por-recurso vía R2 (`putImmutable` → `existed=true` → `[skip] sin novedades`), pero la CLI **siempre corre `year = añoActual, page = 1`** (`ingest-cli.ts:141-143`). No hay cursor que **avance a través de corridas** (páginas siguientes / años previos), y no hay un marcador persistente `lobby_ingesta_estado`-style que registre "hasta dónde llegó leylobby". El patrón a espejar ya existe en el repo: el marcador `lobby_ingesta_estado` (0021), `contratos_ingesta_estado` (0023), `aportes_ingesta_estado` (0024).
- **DEBT-03 (`CLOUDFLARE_API_TOKEN` CI):** **HALLAZGO RECTOR — el framing del requisito es impreciso.** El token CF solo aparece en `deploy-cloudflare.yml:59` (deploy del frontend), NO en los crons de ingesta (leyes/agenda/lobby/probidad), que escriben a Supabase+R2 y **no tocan Cloudflare**. Los crons de novedades NO necesitan `CLOUDFLARE_API_TOKEN` para correr verdes. La deuda real es: (a) el secreto está **ausente del repo Cuchecorp/gov-map** → el deploy CI (manual `workflow_dispatch`) falla; (b) la **referencia YA existe y es correcta** en el workflow. El trabajo del agente es verificar/documentar la referencia; el VALOR es acto de operador.
- **DEBT-04 (round-robin leyes-weekly):** la dilución está en `run-tramitacion-prod-cli.ts:92-134` (`boletinesARefrescar`): ordena agenda-primero, luego proyectos ya ingeridos, y hace `.slice(0, limite)` (default 80). Sobre 3.657 proyectos, el **mismo prefijo de 80** se refresca cada viernes → la cola (proyectos sin actividad de agenda) NUNCA rota. Falta un **cursor de rotación** que avance el offset semana a semana. **Bug adicional confirmado:** `boletinesARefrescar` lee `proyecto`/`citacion_punto`/`sesion_tabla_item` **sin `.range()`** → PostgREST recorta a ~1000 filas (gotcha registrado en memoria v6.1); con 3.657 proyectos, la lectura ya está truncada a 1k.

**Primary recommendation:** Espejar el patrón de **marcador de ingesta** existente (`lobby_ingesta_estado` / `aportes_ingesta_estado`) para ambos cursores. Para DEBT-02, un cursor por (institución) que avance página/año. Para DEBT-04, un cursor de rotación (offset persistido) sobre el corpus ordenado por `boletin`, priorizando agenda pero rotando la cola con `.range()` paginado. Para DEBT-03, verificar/documentar la referencia en `deploy-cloudflare.yml` (ya presente) y dejar la carga del secreto como checkpoint de operador.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cursor incremental leylobby (DEBT-02) | Conector/orquestador (Deno/TS `@obs/lobby`) | Postgres (marcador) / R2 (hash-check) | La lógica de "hasta dónde llegué" vive en el runner; el estado durable va en una tabla marcador (ya hay precedente) o en R2 |
| `CLOUDFLARE_API_TOKEN` CI (DEBT-03) | CI/CD (GitHub Actions YAML) | Operador (GH repo secrets) | Es wiring de deploy, no de datos; el valor lo carga el operador |
| Round-robin leyes-weekly (DEBT-04) | CLI de ingesta (`run-tramitacion-prod-cli`) | Postgres (cursor de rotación) | La selección de qué boletines refrescar es lógica de CLI; el offset persistido va en Postgres |
| Frescura refleja rotación (SC#4) | `@obs/freshness` (evaluate + catalog) | Postgres (columnas `fecha_captura`/marcador) | La señal de staleness lee las mismas tablas/columnas; la rotación se ve si la señal usa MIN, no solo MAX |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Respeto al servidor + minimizar minutos CI (LOCKED):** cursor incremental con hash-check / última-marca antes de descargar; salir temprano si no hay novedades; rate-limit 2-3s. Cron de novedades diario L–V, lotes acotados incrementales, solo novedades, hash-check primero. Round-robin sobre el corpus para que ningún proyecto quede sin refrescar (evitar la dilución cron de v6.1). **MONEY/SERVEL FUERA del cron mientras gated.**
- **CI secret = referencia, no valor (LOCKED):** el agente cablea el workflow para USAR `CLOUDFLARE_API_TOKEN` (verifica que la referencia exista + el job lo consuma). El VALOR del secreto es acto de OPERADOR (GH repo settings de Cuchecorp/gov-map). No hardcodear secretos.
- **Sin regresión v6.0 (LOCKED):** los conectores leyes/lobby/probidad de v6.0 no deben regresionar; `pnpm freshness` sigue verde para ellos + refleja la rotación.

### Claude's Discretion
- Detalles del cursor/rotación/wiring dentro de las reglas; reusar los conectores + crons existentes.

### Deferred Ideas (OUT OF SCOPE)
- Typography island `.net-*` + rotar DB password → **Phase 75**.
- La carga real del secreto CF en GH settings + habilitar billing GH si aplica = **acto operador**.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-02 | El conector leylobby usa cursor incremental (no re-scrapea todo el histórico en cada corrida) | Cursor a añadir en `ingest-cli.ts`/`ingest-run.ts`; espejar marcador `lobby_ingesta_estado` (0021); hash-check R2 ya existe (`ingest-run.ts:133-154`) pero NO avanza páginas/años entre corridas |
| DEBT-03 | `CLOUDFLARE_API_TOKEN` cargado en CI → crons de novedades verdes en GitHub Actions sin fallback local manual | Referencia YA presente en `deploy-cloudflare.yml:59`; **ausente de crons de ingesta porque no la necesitan** (no tocan Cloudflare). Deuda = secreto ausente del repo + verificar/documentar referencia |
| DEBT-04 | El cron `leyes-weekly` rota round-robin sobre el corpus 3.657 (hoy 80/sem deja proyectos sin refrescar) | Dilución en `run-tramitacion-prod-cli.ts:92-134` (`boletinesARefrescar` + `.slice(0,limite)`); añadir cursor de rotación + `.range()` paginado (bug 1k-cap confirmado) |

## Standard Stack

**Sin librerías nuevas.** Todo el trabajo usa el stack YA presente. Sin `npm install`.

### Core (ya en el repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | v2 | Cliente DB para leer/escribir el marcador de cursor y paginar con `.range()` | Ya usado en todos los CLIs de ingesta [VERIFIED: codebase — `run-tramitacion-prod-cli.ts:30`] |
| `@obs/ingest` | workspace | `R2Store.putImmutable` (hash-check), `HostRateLimiter`, `RobotsGuard`, orden LOCKED | Base de toda ingesta [VERIFIED: codebase — `connector-leylobby.ts:22-29`] |
| `@obs/freshness` | workspace | `evaluate` + `CATALOG` (señal de staleness por fuente) | Ya monitorea leyes/lobby-leylobby [VERIFIED: codebase — `catalog.ts:211-243`] |
| `vitest` | ^3.0.0 | Test runner (raíz + por-paquete) | Config existente `packages/lobby/vitest.config.ts`, `packages/tramitacion/vitest.config.ts` [VERIFIED: codebase] |
| `tsx` | (dev) | Entry-point de los CLIs en CI (`pnpm --filter … exec tsx …`) | Ya invocado por los workflows [VERIFIED: codebase — `leyes-weekly.yml:72`] |

**Package Legitimacy Audit:** N/A — no se instalan paquetes externos nuevos. Todo es workspace/existente.

## Architecture Patterns

### System Architecture Diagram

```
DEBT-04 (round-robin leyes-weekly)
─────────────────────────────────
  pg_cron / GH schedule (vie 20:00 UTC)
        │
        ▼
  run-tramitacion-prod-cli.ts
        │
        ├─► boletinesARefrescar()  ◄── HOY: agenda + proyectos, .slice(0,80), SIN .range() (1k-cap)
        │        │
        │        ▼  PROPUESTO: leer cursor de rotación (offset persistido)
        │   [proyecto_rotacion_estado.offset]  ── round-robin ──►  siguiente ventana de N
        │        │                                                 (paginado .range(), orden por boletin)
        │        ▼
        │   unión: agenda (prioridad) ∪ ventana-rotada del corpus
        │        │
        │        ▼  al terminar: avanzar offset  → persistir cursor
        ▼
  ingestMain() → Cámara WS + Senado XML → upsert (fecha_captura=now) → Supabase
        │
        ▼
  pnpm freshness ── MIN(fecha_captura) refleja el proyecto MÁS viejo (no solo MAX)

DEBT-02 (cursor leylobby)
─────────────────────────
  lobby-leylobby-weekly (mié 11:00 UTC)
        │
        ▼
  ingest-cli.ts  ◄── HOY: institución=AA001, año=actual, page=1 (fijo, no avanza)
        │
        ├─► leer cursor: lobby_ingesta_estado-style (o R2 marker) → (institución, año, página) siguiente
        │
        ▼
  LeylobbyConnector.fetchAudiencias → R2 putImmutable (existed? → [skip]) → detalle → upsert
        │
        ▼  al terminar: avanzar cursor (página+1 o año-1) → persistir

DEBT-03 (CLOUDFLARE_API_TOKEN CI)
─────────────────────────────────
  deploy-cloudflare.yml (manual workflow_dispatch)
        env: CLOUDFLARE_API_TOKEN = ${{ secrets.CLOUDFLARE_API_TOKEN }}  ◄── referencia YA presente
        │
        ▼  operador carga el VALOR en GH repo secrets (Cuchecorp/gov-map)
  wrangler deploy → verde
  (crons de ingesta NO usan este token — no tocan Cloudflare)
```

### Component Responsibilities

| Archivo | Responsabilidad | Cambio para Phase 74 |
|---------|-----------------|----------------------|
| `packages/lobby/src/ingest-cli.ts` | Entry-point leylobby; fija año/página | **DEBT-02:** leer cursor → derivar (institución, año, página) siguiente; avanzar tras corrida |
| `packages/lobby/src/ingest-run.ts` | Orquesta el crawl; ya tiene hash-check R2 | **DEBT-02:** (opcional) exponer "hasta dónde llegó" para el cursor |
| `packages/lobby/src/writer-supabase.ts` | `marcarIngestado` ya escribe `lobby_ingesta_estado` | **DEBT-02:** patrón a espejar para el cursor (o extender) |
| `packages/tramitacion/src/run-tramitacion-prod-cli.ts` | `boletinesARefrescar` + slice(80) | **DEBT-04:** cursor de rotación + `.range()` paginado |
| `packages/freshness/src/catalog.ts` + `evaluate.ts` | Señal de staleness por fuente | **SC#4:** confirmar que la señal MIN (no solo MAX) refleja la rotación; NO regresionar |
| `.github/workflows/deploy-cloudflare.yml` | Referencia `CLOUDFLARE_API_TOKEN` (ya OK) | **DEBT-03:** verificar/documentar; sin cambio de código necesario si la referencia ya consume el secret |
| `.github/workflows/leyes-weekly.yml` | Cron leyes; pasa `--limite`/`--boletines` | **DEBT-04:** (posible) añadir input/flag para el modo rotación si no es automático |

### Pattern 1: Marcador de ingesta persistente (cursor durable)
**What:** Tabla `*_ingesta_estado` con PK + `ingestado_hasta` (date) + `fecha_captura`. Distingue "no barrido" (fila ausente/vieja) de "barrido, cero filas" (fila al día).
**When to use:** Estado de cursor que debe sobrevivir entre corridas de cron.
**Example:**
```sql
-- Source: supabase/migrations/0024_servel.sql:163-167 (VERIFIED codebase)
create table aportes_ingesta_estado (
  parlamentario_id text primary key references parlamentario(id) on delete cascade,
  ingestado_hasta  date,
  fecha_captura    timestamptz not null default now()
);
```
Para DEBT-04 el análogo sería un cursor de rotación (una fila-singleton o por-fuente con un `offset`/`ultimo_boletin`). Para DEBT-02, un cursor por institución con `(anio, pagina)` alcanzados.

### Pattern 2: Lectura paginada PostgREST (evita el cap 1k)
**What:** `.order(<clave-natural>).range(from, from+PAGE-1)` en loop hasta que `filas.length < PAGE`.
**When to use:** SIEMPRE que se lea una tabla con >1000 filas (3.657 proyectos → hoy truncado).
**Example:**
```typescript
// Source: packages/fichas/src/writer-supabase.ts:124-143 (VERIFIED codebase)
const PAGE = 1000;
const todos: string[] = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await client.from(tabla).select("boletin")
    .order("boletin", { ascending: true })       // orden estable → páginas deterministas
    .range(from, from + PAGE - 1);
  if (error) throw new Error(`… falló: ${error.message}`);
  const filas = (data ?? []) as Array<{ boletin: string }>;
  todos.push(...filas.map((f) => f.boletin));
  if (filas.length < PAGE) break;
}
```

### Pattern 3: Hash-check R2 (novelty-skip por recurso) — YA EXISTE
**What:** `putImmutable` con `If-None-Match: *`; `existed=true` (412) → sin novedades → skip Etapa 2.
**When to use:** Ya activo en leylobby por (institución/año/página). El cursor de DEBT-02 lo COMPLEMENTA (decide QUÉ recurso pedir), no lo reemplaza.
**Example:**
```typescript
// Source: packages/lobby/src/ingest-run.ts:138-149 (VERIFIED codebase)
const { r2Path, existed } = await opts.r2Store.putImmutable(
  "leylobby", clave, date, sha, "html", bytes);
if (existed) { log(`[skip] sin novedades — leylobby ${clave}`); continue; }
```

### Anti-Patterns to Avoid
- **Leer `proyecto` sin `.range()`:** PostgREST recorta a ~1000; con 3.657 el round-robin nunca vería la cola. (Bug actual en `boletinesARefrescar`.) → paginar.
- **Cursor sin orden estable:** sin `.order(clave)`, PostgREST no garantiza orden entre requests HTTP → offset inconsistente. → ordenar por `boletin`.
- **Cablear `CLOUDFLARE_API_TOKEN` en crons de ingesta:** no lo necesitan (no tocan Cloudflare) → ruido/confusión. Mantenerlo solo en `deploy-cloudflare.yml`.
- **Encender MONEY/SERVEL vía cron:** LOCKED fuera. `chilecompra-weekly.yml`/`servel-weekly.yml` NO existen a propósito (freshness reporta `n/d`, honesto). No crearlos.
- **Falso positivo de "verde":** una lectura fallida (RLS/red) NO debe parecer "DB vacía / nada que rotar". El código actual ya LANZA en ese caso (`run-tramitacion-prod-cli.ts:109-118`) — preservar esa semántica fail-loud.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Estado de cursor durable | Un archivo local / variable de proceso | Tabla marcador `*_ingesta_estado` (0021/0023/0024) | Precedente probado; sobrevive entre corridas de cron; visible a freshness |
| Novelty-skip de leylobby | Comparar HTML a mano | `R2Store.putImmutable` (ya integrado) | Content-addressed, idempotente, Etapa 1 LOCKED |
| Leer >1k filas | Un solo `.select()` | `.order().range()` paginado (fichas writer) | PostgREST cap 1k; patrón ya en el repo |
| Rate-limit / robots / SSRF | Delays manuales | Orden LOCKED de `@obs/ingest` (`fetcher`+`rateLimiter`+`robots`+`assertAllowedUrl`) | Ya lo usa el conector; no reinventar |

**Key insight:** Los tres ítems son wiring sobre infraestructura madura. El riesgo NO es técnico sino de regresión: no romper el hash-check, el fail-loud, ni la señal de freshness existentes.

## Runtime State Inventory

> Esta fase toca **ingesta/cron/CI**, no un rename. Aun así hay estado de runtime relevante.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Cursor de rotación (DEBT-04):** no existe hoy → dónde vive es decisión (tabla marcador singleton/por-fuente vs. R2). **Cursor leylobby (DEBT-02):** hoy solo `lobby_ingesta_estado` por-parlamentario (marca "tocado", no "hasta qué página/año"). | Nueva columna/tabla marcador de rotación + cursor leylobby (data migration = ninguna existente que migrar; solo DDL nuevo) |
| Live service config | **Secreto `CLOUDFLARE_API_TOKEN` en Cuchecorp/gov-map:** AUSENTE del repo (confirmado en `56-CRON-AUDIT.md` + `61-02-SUMMARY.md` + `62-03-SUMMARY.md`). Vive en GH repo settings, NO en git. | Carga del VALOR = acto operador (checkpoint). Referencia en YAML ya presente. |
| OS-registered state | GH Actions schedules (`leyes-weekly` vie 20:00, `lobby-leylobby-weekly` mié 11:00) — definidos en YAML versionado. | Ninguno (ya en git). Posible ajuste de cadencia L–V si el plan lo requiere. |
| Secrets/env vars | Crons de ingesta consumen `SUPABASE_API_URL/SECRET_KEY` + `R2_*` (ya referenciados). `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` solo en deploy. | Verificar referencias (agente); cargar valores (operador). |
| Build artifacts | `packages/*/dist/*` compilados (p.ej. `packages/fichas/dist/writer-supabase.js`) — pueden quedar stale tras editar `.ts`. | Reejecutar build/test del paquete tras el cambio; los crons corren `tsx` sobre `.ts` (no dist) así que no bloquea el cron. |

**Verificado explícitamente:** no hay tabla de cursor de rotación preexistente que migrar (es DDL nuevo); no hay `chilecompra-weekly.yml`/`servel-weekly.yml` (a propósito).

## Common Pitfalls

### Pitfall 1: DEBT-03 malinterpretado como "cablear el token en los crons de ingesta"
**What goes wrong:** El requisito dice "crons de novedades verdes … sin fallback local manual", lo que sugiere que a los crons de ingesta les falta `CLOUDFLARE_API_TOKEN`. **NO es así.** Los crons de ingesta (leyes/agenda/lobby/probidad) escriben a Supabase+R2 y no tocan Cloudflare; corren verdes SIN ese token.
**Why it happens:** El "fallback local manual" real es el **DEPLOY** del frontend (v6.0/v6.1 lo hicieron con wrangler local OAuth porque el secret CF faltaba en el repo — ver `61-02`, `62-03`).
**How to avoid:** Interpretar DEBT-03 como: (1) verificar que `deploy-cloudflare.yml` referencia y consume `CLOUDFLARE_API_TOKEN` (ya lo hace, línea 59); (2) documentar el checkpoint de operador para cargar el valor; (3) NO añadir el token a los crons de ingesta. **Confirmar el alcance exacto con el plan antes de tocar YAMLs.**
**Warning signs:** un diff que añade `CLOUDFLARE_API_TOKEN` a `leyes-weekly.yml` = señal de mala interpretación.

### Pitfall 2: Round-robin sin paginar → la cola nunca aparece
**What goes wrong:** `boletinesARefrescar` lee `proyecto` sin `.range()`; con 3.657 filas PostgREST devuelve solo ~1000. El "corpus" que rota es en realidad el primer 1k → la rotación deja fuera 2.657 proyectos permanentemente.
**Why it happens:** Gotcha PostgREST 1k-cap (registrado en memoria v6.1: "paginar `.order().range()` SIEMPRE").
**How to avoid:** Paginar la lectura del corpus (Pattern 2) ANTES de aplicar la rotación.
**Warning signs:** count del corpus ≈ 1000 exacto en logs.

### Pitfall 3: Freshness "verde" que oculta la dilución
**What goes wrong:** La señal `leyes` usa `MAX(proyecto.fecha_captura)` (agregado). Un solo proyecto refrescado hoy pone la señal verde aunque 3.000 lleven meses sin tocar. La rotación no se "ve".
**Why it happens:** `evaluate.ts` mira el último upsert (MAX), no el proyecto más viejo (MIN).
**How to avoid:** Para que la frescura REFLEJE la rotación (SC#4), considerar una señal complementaria de `MIN(fecha_captura)` o "N proyectos con fecha_captura > umbral". Verificar sin regresionar la señal MAX existente (que otras fuentes usan). **Decisión de plan:** si SC#4 exige "reflejar la rotación", se necesita una señal de cobertura/edad-mínima, no solo el MAX actual.
**Warning signs:** freshness verde con corpus mayoritariamente stale.

### Pitfall 4: Cursor que re-scrapea o salta silenciosamente
**What goes wrong:** Un cursor mal avanzado puede (a) re-pedir la misma página infinitamente (no avanza) o (b) saltarse páginas (pierde datos). En leylobby el hash-check R2 mitiga (a) para el fetch, pero el cursor debe avanzar deterministamente.
**How to avoid:** Cursor con orden estable + avance idempotente; persistir DESPUÉS de la corrida exitosa (no antes). Degradación honesta: un 403/503 de leylobby NO debe avanzar el cursor como si hubiera datos.
**Warning signs:** `ingestado_hasta` avanza pero `audiencias=0` sistemáticamente.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| leylobby fija año/página=1 cada corrida | (Phase 74) cursor incremental que avanza | ahora | No re-scrapea histórico; respeta servidor |
| leyes-weekly slice(80) del mismo prefijo | (Phase 74) round-robin con offset persistido | ahora | Ningún proyecto queda indefinidamente stale |
| Deploy CF con wrangler local (fallback) | (Phase 74) secret CF en repo → deploy CI verde | ahora (operador carga valor) | Deploy reproducible en CI |

**Deprecated/outdated:** ninguno relevante; el trabajo es aditivo.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DEBT-03 = deploy CF (no crons de ingesta); los crons de ingesta corren verdes sin CF token | DEBT-03 / Pitfall 1 | Si el operador quiere el token en otro workflow, el plan cablea de más. **Confirmar alcance en el plan.** |
| A2 | El cursor de rotación (DEBT-04) puede vivir en una tabla marcador nueva (patrón 0024) | Runtime State / Pattern 1 | Si se prefiere R2 o un enfoque sin DDL, cambia el diseño. Discreción de Claude por CONTEXT. |
| A3 | SC#4 "reflejar la rotación" requiere una señal de edad-mínima (MIN), no solo el MAX actual | Pitfall 3 | Si "reflejar" solo significa "no regresionar", el cambio de freshness es menor. **Aclarar el criterio de SC#4.** |
| A4 | GH billing de Cuchecorp/gov-map está ACTIVO (memoria v6.0: "billing ACTIVO, 5 secrets cargados") | DEBT-03 | Si billing volvió a bloquearse, el cron CI no corre aunque el wiring sea correcto → operador. |

## Open Questions

1. **¿Dónde vive el cursor de rotación de DEBT-04?**
   - Qué sabemos: hay 3 precedentes de tabla marcador (`lobby_ingesta_estado`, `contratos_ingesta_estado`, `aportes_ingesta_estado`).
   - Qué falta: si es una fila-singleton (`proyecto_rotacion_estado`) con un `offset`/`ultimo_boletin`, o por-fuente.
   - Recomendación: tabla marcador nueva con `ultimo_boletin` (reanudable, orden por `boletin`); DDL mínimo, RLS deny-by-default (uso interno de cron).

2. **¿DEBT-03 toca algún workflow además de `deploy-cloudflare.yml`?**
   - Qué sabemos: el token solo se usa ahí; los crons de ingesta no lo necesitan.
   - Qué falta: si el requisito espera que el agente añada algo a los crons (no debería).
   - Recomendación: verificar/documentar la referencia existente + checkpoint operador; NO tocar los crons de ingesta.

3. **¿La cadencia del cron leyes-weekly cambia a L–V?**
   - Qué sabemos: hoy es viernes 20:00 UTC (semanal). CONTEXT dice "cron de novedades diario L–V".
   - Qué falta: si DEBT-04 implica cambiar el schedule a diario, o solo rotar dentro del pase semanal.
   - Recomendación: el plan debe decidir; rotar sobre el corpus funciona con cualquier cadencia (más pases = rotación más rápida). Minimizar minutos CI (LOCKED) favorece lotes acotados.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase remoto (PROD) | Cursor read/write, corpus read | ✓ (creds en `.env`) | Postgres 15+ | dry-run local |
| R2 (S3) | Hash-check leylobby (ya activo) | ✓ (`.env` R2_*) | — | Etapa 1 se omite con WARN |
| GH Actions (Cuchecorp/gov-map) | Correr crons + deploy | ✓ (billing activo, memoria v6.0) | — | ejecución LOCAL del CLI |
| `CLOUDFLARE_API_TOKEN` (repo secret) | Deploy CI verde (DEBT-03) | ✗ (ausente del repo) | — | deploy local wrangler OAuth |
| `tsx` / pnpm 11 | Entry-point CLI en CI | ✓ | — | — |

**Missing dependencies with no fallback:** ninguno bloquea el DESARROLLO (el código es offline-testable).
**Missing dependencies with fallback:** `CLOUDFLARE_API_TOKEN` — fallback = deploy local; su carga es acto de operador (checkpoint).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | `vitest.config.ts` (raíz) + `packages/lobby/vitest.config.ts` + `packages/tramitacion/vitest.config.ts` |
| Quick run command | `pnpm --filter @obs/lobby test` / `pnpm --filter @obs/tramitacion test` / `pnpm --filter @obs/freshness test` |
| Full suite command | `pnpm test` (`pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-02 | Cursor leylobby avanza (página/año) entre corridas; no re-scrapea; degradación honesta no avanza cursor | unit | `pnpm --filter @obs/lobby test` | ❌ Wave 0 (nuevo test de cursor; existen `ingest-run.test.ts`, `ingest-cli.test.ts` a extender) |
| DEBT-02 | Hash-check R2 sigue haciendo skip sin novedades (no regresión) | unit | `pnpm --filter @obs/lobby test` | ✅ (cubierto por `ingest-run.test.ts`) |
| DEBT-04 | Round-robin selecciona ventana rotada distinta según cursor; corpus paginado (>1k) | unit | `pnpm --filter @obs/tramitacion test` | ❌ Wave 0 (nuevo test de `boletinesARefrescar` con cursor; `ingest-cli.test.ts` existe) |
| DEBT-04 | Fail-loud ante lectura fallida (no "DB vacía" silenciosa) — no regresión | unit | `pnpm --filter @obs/tramitacion test` | ⚠️ verificar cobertura actual |
| DEBT-03 | La referencia `CLOUDFLARE_API_TOKEN` existe y el job la consume | lint/estático | grep del YAML (`deploy-cloudflare.yml:59`) — verificación estática, no runtime | ✅ (verificable con Grep) |
| SC#4 | `pnpm freshness` refleja la rotación sin regresión de leyes/lobby/probidad | unit | `pnpm --filter @obs/freshness test` | ✅ `evaluate.test.ts` existe; extender si se añade señal MIN |

### Sampling Rate
- **Per task commit:** `pnpm --filter <paquete-tocado> test` (lobby / tramitacion / freshness).
- **Per wave merge:** `pnpm test` (suite completa).
- **Phase gate:** suite verde antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/lobby/src/ingest-cli.test.ts` o nuevo `cursor-leylobby.test.ts` — cubre DEBT-02 (avance de cursor, no-avance en degradación).
- [ ] `packages/tramitacion/src/*.test.ts` — cubre DEBT-04 (rotación determinista + paginación >1k, inyectando un cliente Supabase fake que devuelva >1000 filas en páginas).
- [ ] (si aplica A3) extender `packages/freshness/src/evaluate.test.ts` para la señal de edad-mínima.
- [ ] Fixture/fake de cliente Supabase con soporte `.order().range()` para simular el 1k-cap en test.

## Offline-testable vs Operator

| Item | Offline-testable (agente) | Operator |
|------|---------------------------|----------|
| DEBT-02 cursor logic | ✓ avance/no-avance, degradación, hash-check (unit, sin red) | corrida LIVE real contra leylobby.gob.cl |
| DEBT-03 referencia YAML | ✓ grep/lint de `deploy-cloudflare.yml` | cargar el VALOR del secret en GH; deploy CI real; billing GH |
| DEBT-04 round-robin selection | ✓ rotación determinista + paginación (unit con fake Supabase) | corrida LIVE del cron en CI |
| SC#4 freshness | ✓ `evaluate.test.ts` (lógica pura, sin I/O) | `pnpm freshness` contra PROD real |

## Project Constraints (from CLAUDE.md)

- **Ingesta en DOS ETAPAS (LOCKED):** Fuentes → R2 (crudo, content-addressed, `If-None-Match: *`, 412=éxito) → Supabase lee del crudo. El cursor NO debe romper esto (ya respetado por leylobby).
- **Hash-check ANTES de descargar (LOCKED):** el cursor complementa el hash-check, no lo reemplaza.
- **Respeto al servidor:** rate-limit 2–3s/host, UA identificatorio, robots.txt, caché diaria. Nunca ráfagas.
- **Backfill masivo = LOCAL** (operador), NO GH Actions. El cron es solo novedades acotadas.
- **Cron de novedades = diario L–V**, lotes acotados, solo novedades, hash-check primero. Frecuencia exacta TBD. **MONEY/SERVEL fuera del cron mientras gated.**
- **GSD workflow enforcement:** editar solo dentro de un comando GSD.
- **Sin secretos hardcodeados:** `CLOUDFLARE_API_TOKEN` = referencia `${{ secrets.* }}`, valor por operador.

## Sources

### Primary (HIGH confidence — codebase verificado)
- `packages/lobby/src/connector-leylobby.ts` — conector leylobby, orden LOCKED, año/página como args
- `packages/lobby/src/ingest-run.ts:133-236` — hash-check R2 (`putImmutable`/`existed`), drift bloqueante, `marcarIngestado`
- `packages/lobby/src/ingest-cli.ts:140-144` — fija institución/año/página=1 (sin cursor de avance)
- `packages/lobby/src/writer-supabase.ts:113-123` — `marcarIngestado` → `lobby_ingesta_estado`
- `packages/tramitacion/src/run-tramitacion-prod-cli.ts:47-134` — `boletinesARefrescar`, `.slice(0,limite)`, lectura sin `.range()`
- `packages/fichas/src/writer-supabase.ts:124-143` — patrón `.order().range()` paginado (fix 1k-cap)
- `packages/freshness/src/catalog.ts:211-243` — señal `leyes` (MAX fecha_captura) + `lobby-leylobby` (marcador)
- `packages/freshness/src/evaluate.ts:29-76` — evaluación de staleness (MAX, fail-closed)
- `supabase/migrations/0021_lobby.sql:127-135` / `0024_servel.sql:163-167` — patrón marcador de ingesta
- `.github/workflows/deploy-cloudflare.yml:59` — `CLOUDFLARE_API_TOKEN` (única referencia)
- `.github/workflows/leyes-weekly.yml` / `lobby-leylobby-weekly.yml` — crons, inputs, env
- `.planning/milestones/v6.0-phases/56-cron-audit-.../56-CRON-AUDIT.md:445` (G21) — CF token ausente del repo
- `.planning/milestones/v6.0-phases/61-.../61-02-SUMMARY.md` / `62-03-SUMMARY.md` — deploy CI bloqueado por CF token ausente
- `.planning/STATE.md:92-97` — freshness señales voto/RUT/chilecompra (patrón evaluate reusado)
- CONTEXT.md + REQUIREMENTS.md (DEBT-02/03/04) — restricciones LOCKED

### Secondary (MEDIUM confidence)
- Memoria (MEMORY.md) — PostgREST cap 1k "paginar SIEMPRE"; billing GH activo v6.0; dilución cron round-robin como deuda v6.1

### Tertiary (LOW confidence)
- Ninguno — todo verificado en codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo workspace/existente, sin instalar nada.
- Architecture: HIGH — ubicaciones exactas confirmadas por lectura de código.
- Pitfalls: HIGH — el 1k-cap y el mal-framing de DEBT-03 se confirmaron directamente en el código y auditorías previas.
- Cursor design (dónde vive): MEDIUM — hay precedente claro pero la decisión final es del plan (Open Question 1).

**Research date:** 2026-07-14
**Valid until:** ~30 días (código estable; deuda de wiring interno)

## RESEARCH COMPLETE

**Phase:** 74 - DEUDA (cursor leylobby + CLOUDFLARE_API_TOKEN CI + round-robin leyes-weekly)
**Confidence:** HIGH

### Key Findings
- **DEBT-02:** leylobby YA tiene hash-check R2 por-recurso, pero la CLI fija `año=actual, página=1` sin avanzar entre corridas (`ingest-cli.ts:141-143`). Falta un cursor durable; espejar el patrón marcador `lobby_ingesta_estado`/`aportes_ingesta_estado`.
- **DEBT-03 (RECTOR):** `CLOUDFLARE_API_TOKEN` es un concern de DEPLOY (`deploy-cloudflare.yml:59`), NO de los crons de ingesta (que corren verdes sin él). La referencia YA existe; la deuda real = secreto ausente del repo Cuchecorp/gov-map (valor = operador). NO cablear el token en los crons de ingesta.
- **DEBT-04:** dilución en `boletinesARefrescar` (`.slice(0,80)` sobre el mismo prefijo) + **bug 1k-cap** (lee `proyecto` sin `.range()` → truncado a 1000 de 3.657). Falta cursor de rotación + paginación (patrón `fichas/writer-supabase.ts:124-143`).
- **SC#4:** freshness `leyes` usa MAX(fecha_captura) → un solo refresh la pone verde ocultando la dilución. "Reflejar la rotación" probablemente requiere una señal de edad-mínima (MIN) sin regresionar el MAX.
- Offline-testable: lógica de cursor, rotación+paginación, referencia YAML, evaluate. Operator: cargar el secret CF, billing GH, corridas LIVE.

### File Created
`.planning/phases/74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly/74-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Todo workspace/existente; cero instalación |
| Architecture | HIGH | Ubicaciones exactas leídas en código |
| Pitfalls | HIGH | 1k-cap y mal-framing DEBT-03 confirmados en código/auditorías |

### Open Questions
1. Dónde vive el cursor de rotación (tabla marcador nueva vs R2) — Open Question 1.
2. Alcance exacto de DEBT-03 (solo deploy vs. algo más) — Open Question 2 / Assumption A1.
3. ¿SC#4 exige señal MIN de freshness o solo "no regresionar"? — Assumption A3.
4. ¿Cadencia cambia a L–V o rota dentro del pase semanal? — Open Question 3.

### Ready for Planning
Research completa. El planner puede crear PLAN.md; debe resolver las 4 open questions (especialmente el alcance de DEBT-03 y la ubicación del cursor de rotación).
