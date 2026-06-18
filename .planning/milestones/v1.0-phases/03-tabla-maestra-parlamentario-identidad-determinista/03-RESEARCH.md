# Phase 3: Tabla Maestra Parlamentario + Identidad Determinista - Research

**Researched:** 2026-06-18
**Domain:** Identidad de parlamentarios (siembra de catálogo real Cámara+Senado, normalización de nombres chilenos, match determinista sin LLM, respaldo fuera de Supabase)
**Confidence:** HIGH (endpoints sondeados EN VIVO 2026-06-18; framework Fase 1 leído del código; normalización/matcher son lógica pura testeable)

## Summary

Esta fase entrega el cimiento de identidad del Observatorio: una tabla maestra `parlamentario` sembrada con datos REALES de los catálogos oficiales de ambas cámaras, una función de normalización de nombres chilenos documentada y testeada, un matcher determinista (RUT / nombre-normalizado-sin-homónimo, **sin LLM**) implementado como función pura, y un respaldo de la maestra fuera de Supabase (snapshot JSON versionado en git, autoritativo HOY; R2 listo en código pero diferido por credenciales). Cubre ID-01, ID-02, ID-09.

El hallazgo crítico (endpoint del catálogo de diputados de la Cámara) quedó **resuelto en vivo**: `https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual` devuelve los **155 diputados vigentes del periodo 2026-2030** (legislatura 374 = Id 58, confirmado vía `retornarPeriodoLegislativoActual`), cada uno con `<Id>` estable + nombres + historial de `<Militancias>` (partido). Es XML, parseable con `fast-xml-parser` (el parser ya bendecido en STACK.md). El Senado ya estaba confirmado. **Ningún catálogo trae RUT** (campo `<RUT>` presente pero vacío) ni el de Cámara trae `distrito` — esos huecos se documentan abajo con su fallback.

**Primary recommendation:** Implementar un `SeederConnector` (no un `BaseConnector` de ingesta recurrente, sino un script one-off que **reutiliza** `Fetcher`/`RobotsGuard`/`HostRateLimiter`/`R2Store`/`assertAllowedUrl`/`makeProvenance` de `@obs/ingest`) que fetchea ambos catálogos, parsea XML con `fast-xml-parser@5`, normaliza nombres con una función pura `normalizarNombre`, hace upsert idempotente en `parlamentario`/`parlamentario_alias` (migración nueva 0005), corre el matcher determinista, y exporta un snapshot JSON versionado a git. Los tres artefactos lógicos (normalización, matcher, backup) son funciones puras unit-testables con fixtures del XML real capturado hoy.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ID-01 | Tabla maestra `Parlamentario` sembrada desde Cámara y Senado (`senadores_vigentes.php` con PARLID), confirmada por revisión humana (no auto-generada) | Endpoints LIVE confirmados (Senado 12.9KB / Cámara 179KB, 155 dip). DDL `parlamentario`+`parlamentario_alias` con provenance + `estado`. Compuerta de promoción a `confirmado` = aceptación del operador del lote sembrado (los catálogos oficiales son autoritativos para los vigentes). |
| ID-02 | Reconciliación por match determinista (RUT exacto / nombre normalizado dentro de cámara+periodo sin homónimo) sin invocar LLM | Matcher como función pura `matchDeterminista(mention, maestra)` con 3 ramas: RUT exacto → `confirmado`; nombre normalizado único en (cámara, periodo) → `confirmado`; else `no_confirmado`. Rama RUT implementada pero sin datos desde catálogos (RUT vacío) — aplica al cruzar con InfoProbidad (Fase 4+). |
| ID-09 | La tabla maestra de identidades se respalda fuera de Supabase | Job de export: snapshot JSON versionado en git (`supabase/seeds/parlamentario.seed.json` o `.planning/seeds/`) = respaldo autoritativo HOY; R2 vía `R2Store` gateado por credenciales válidas (diferido). Cadencia vía GitHub Actions / pg_cron. |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Siembra LIVE con el framework de Fase 1** (rate-limit, UA, provenance) trayendo el catálogo real:
  - **Senado**: `https://tramitacion.senado.cl/wspublico/senadores_vigentes.php` — XML CONFIRMADO live. Campos: `PARLID`, `PARLAPELLIDOPATERNO`, `PARLAPELLIDOMATERNO`, `PARLNOMBRE`, `REGION`, `CIRCUNSCRIPCION`, `PARTIDO`, `EMAIL`, `CURRICULUM` (+ `FONO`).
  - **Cámara**: catálogo de diputados vigentes con su ID, legislatura vigente (Id 58 / Leg 374). Endpoint exacto a fijar por research → **RESUELTO** (ver Architecture).
- **Estado inicial `confirmado` requiere revisión humana, NO auto-generado**: el seeder produce el dataset; la promoción a `confirmado` pasa por compuerta (en esta fase, el operador acepta el lote sembrado tras una corrida de verificación — los catálogos oficiales son autoritativos para los vigentes).
- **Realidad de credenciales (sondeada 2026-06-18):**
  - `.env` permite **LEER** catálogos en vivo.
  - **Supabase remoto NO aplicable**: `SUPABASE_SECRET_KEY` es `sb_secret_…` (service API key, no PAT `sbp_` de management), sin DB password/connection string → migraciones se aplican al **Supabase LOCAL** (docker, ya operativo). Push al remoto = paso de operador (requiere DB password o `supabase link`).
  - **R2 401**: credenciales S3 devuelven 401 contra el bucket → respaldo a R2 queda en código pero NO se ejecuta live (mantiene abierto el checkpoint R2 de Fase 1).
- **"Live now" concreto =** correr fetch real de ambos catálogos, normalizar, producir el **dataset maestro real como artefacto versionado en git** + cargarlo al Supabase **local**. Ese artefacto en git ES el respaldo fuera de Supabase (cumple ID-09).
- **Normalización (Q2 LOCKED)**: función `normalizarNombre` documentada + tests: fold de acentos (NFD + strip diacríticos) y mayúsculas; parsing de formatos del catálogo y de votaciones ("Apellido P., Nombre" del Senado, "Apellido Paterno Apellido Materno, Nombre" de la Cámara); apellidos compuestos y partículas (de, del, la); registro de variantes/alias. Produce `nombre_normalizado` estable + tokens para blocking (Fase 4).
- **Match determinista (Q3 LOCKED, ID-02)**: RUT exacto → `confirmado`; nombre normalizado dentro de (cámara+periodo) sin homónimo → `confirmado`; todo lo demás → `no_confirmado`/candidato, diferido a Fase 4. **Fail-closed: ante duda, no confirmar.**
- **Respaldo (Q4 LOCKED, ID-09)**: job que exporta la maestra a (a) snapshot JSON versionado en git (autoritativo) y (b) R2 (cuando funcionen credenciales) reusando `R2Store`. Periodicidad vía pg_cron/GitHub Actions.
- **Modelo de datos**: tabla `parlamentario` (`id` interno estable p.ej. P00001, `nombre_normalizado`, `nombres`, `apellido_paterno`, `apellido_materno`, `camara` diputados|senado, `periodo`/`legislatura`, `region`, `distrito`/`circunscripcion`, `partido`/`bancada`, `rut` nullable interno, `parlid_senado` nullable, `id_diputado_camara` nullable, `estado` confirmado|probable|no_confirmado, `email`, provenance) + tabla `parlamentario_alias`.

### Claude's Discretion

- Endpoint exacto del catálogo de diputados de la Cámara (research lo fija → RESUELTO).
- Nombres finos de columnas, formato del JSON de seed, mecánica del job de respaldo.

### Deferred Ideas (OUT OF SCOPE)

- Adjudicación LLM de casos dudosos, golden set, compuerta de revisión humana con UI → **Fase 4**.
- Push de migraciones + datos al Supabase REMOTO y respaldo a R2 live → pendiente de credencial válida; documentar como paso de operador.
- Conectores de votaciones/tramitación → **Fase 5+**.
- Tabla puente de reconciliación de registros foráneos / adjudicación → **Fase 4** (aquí basta maestra + matcher determinista como función + tests).
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch catálogos Cámara/Senado | Backend / Ingesta (Deno, reusa `@obs/ingest`) | — | WAF gubernamental + UA identificado + rate-limit viven en el framework; jamás desde navegador |
| Parseo XML → modelo `Parlamentario` | Backend / Procesamiento (Deno) | — | `fast-xml-parser@5`; lógica pura, idempotente |
| Normalización de nombres | Backend / lógica pura (`@obs/core` o `processing/identity`) | — | Función pura, sin red ni DB; unit-testable; consumida también por Fase 4 (blocking) |
| Match determinista (Etapa 0) | Subsistema Identidad (función pura) | — | Único componente que decide `estado`; aislado tras API interna (ARCHITECTURE.md) |
| Tabla maestra `parlamentario` + RLS | Database / Storage (Postgres local) | — | Patrón de migración + RLS deny-by-default de Fase 1 |
| Snapshot JSON de respaldo | Backend / job (Deno) → git (autoritativo) | R2 (`R2Store`, diferido) | Activo más caro de reconstruir nunca depende solo del free tier de Supabase |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | `5.9.2` (línea 5.x) `[VERIFIED: npm registry]` | Parsear XML del Senado (`senadores_vigentes.php`) y de la Cámara (`retornarDiputadosPeriodoActual`) | Parser XML puro JS, rápido, sin deps C/C++; bendecido en STACK.md; v6 experimental → quedarse en 5.x `[CITED: STACK.md]` |
| `@obs/ingest` (Fase 1) | workspace | `Fetcher`, `RobotsGuard`, `HostRateLimiter`, `PgHostThrottle`, `R2Store`, `assertAllowedUrl`, `DailyCache` | Reusar política de fetch respetuoso UNA sola vez; allowlist ya incluye `camara.cl`/`senado.cl` `[VERIFIED: codebase]` |
| `@obs/core` (Fase 1) | workspace | `Provenance` + `makeProvenance`; aquí viven los tipos `Parlamentario` + zod | Sin deps de runtime; tipos de dominio `[VERIFIED: codebase]` |
| `aws4fetch` | `^1.0.20` `[VERIFIED: codebase]` | SigV4 para R2 (vía `R2Store`) | Ya vetado en Fase 1; diferido por credencial 401 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cheerio` | `1.2.0` `[CITED: STACK.md]` | Parsear `www.camara.cl/diputados/diputados.aspx` para enriquecer **distrito** (ausente del WS) | SOLO si se decide enriquecer distrito en esta fase (ver Open Questions) |
| `zod` | `3.x/4.x` `[CITED: STACK.md]` | Validar shape del XML parseado antes de upsert (compuerta de contrato) | En el seeder, tras `fast-xml-parser`, antes de normalizar |
| `vitest` | `^3.0.0` `[VERIFIED: codebase]` | Unit tests de normalización, matcher, idempotencia, backup | Patrón establecido en Fase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `retornarDiputadosPeriodoActual` (XML) | `getBancadasXSesion` (sala doGet, JSON) | getBancadas trae bancada+integrantes pero con **logos como byte-arrays** (660KB), party a granularidad de "comité" y requiere `prmSesiId`; peor que el catálogo directo |
| Snapshot JSON en git | Solo R2 | R2 da 401 hoy; git es autoritativo e inmediato (ID-09 se cumple HOY sin R2) |
| `BaseConnector.run()` (caché diaria + snapshot R2) | Script seeder one-off que reusa colaboradores | El seeder es one-off, no ingesta recurrente; `BaseConnector` mete caché diaria + drift que aquí estorban. Reusar `Fetcher`/`RateLimiter`/`assertAllowedUrl` directamente |

**Installation:**
```bash
pnpm --filter @obs/ingest add fast-xml-parser@5   # o en un paquete nuevo @obs/identity
```

**Version verification (2026-06-18):**
- `fast-xml-parser` → `5.9.2` (dist-tags: latest=5.9.2, legacy=4.5.6). `[VERIFIED: npm registry]`
- `aws4fetch` → `1.0.20` (ya en lockfile). `[VERIFIED: codebase]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fast-xml-parser` | npm | establecido (5.x línea madura) | muy alto (estándar de facto) | github.com/NaturalIntelligence/fast-xml-parser | `[OK]` | Aprobado |
| `aws4fetch` | npm | establecido | alto | github.com/mhart/aws4fetch | (vetado Fase 1) | Aprobado (reuso) |
| `cheerio` | npm | establecido | muy alto | github.com/cheeriojs/cheerio | (vetado en STACK) | Aprobado (solo si se usa para distrito) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> slopcheck rated `fast-xml-parser` `[OK]` ("Name starts with 'fast-' — classic LLM naming pattern… but package is established"). Verificado además que **NO tiene `postinstall`** (su bloque `scripts` solo trae test/lint/bundle — sin código en install-time). `[VERIFIED: npm view fast-xml-parser scripts]`

## Architecture Patterns

### System Architecture Diagram

```
                         SEEDER (one-off, Deno) — reusa @obs/ingest
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                              ▼
  assertAllowedUrl + RobotsGuard + HostRateLimiter(2-3s) + Fetcher(UA id)
        │                                                              │
        ▼ GET                                                          ▼ GET
  Senado: tramitacion.senado.cl/                      Cámara: opendata.camara.cl/.../
   wspublico/senadores_vigentes.php (XML)              WSDiputado.asmx/retornarDiputadosPeriodoActual (XML)
        │  <senador> PARLID, apellidos, nombre,              │  <Diputado> Id, ApellidoP/M, Nombre,
        │  REGION, CIRCUNSCRIPCION, PARTIDO, EMAIL           │  Militancias→Partido(vigente). SIN RUT, SIN distrito
        └───────────────┬────────────────────────────────────┘
                        ▼ fast-xml-parser@5  →  zod (shape guard)
                ┌───────────────────────────────────────┐
                │  normalizarNombre()  [FUNCIÓN PURA]    │ NFD strip + casefold + parse formato
                │  → { nombre_normalizado, tokens[],     │ + apellidos compuestos/partículas + alias
                │      alias_capturados[] }              │
                └───────────────────┬───────────────────┘
                                    ▼
                ┌───────────────────────────────────────┐
                │  matchDeterminista()  [FUNCIÓN PURA]   │ RUT exacto → confirmado
                │  fail-closed (Etapa 0, SIN LLM)        │ nombre único en (cámara,periodo) → confirmado
                │  → estado ∈ {confirmado|no_confirmado} │ else → no_confirmado (defer Fase 4)
                └───────────────────┬───────────────────┘
                                    ▼ upsert idempotente (por clave natural)
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                        ▼
  Postgres LOCAL:                                       Backup (ID-09):
   parlamentario (RLS deny-by-default)                   exportMaestra() →
   parlamentario_alias                                    (a) supabase/seeds/parlamentario.seed.json  [git, AUTORITATIVO]
   provenance inline (origen, fecha_captura, enlace)      (b) R2Store.putImmutable()  [GATEADO por cred → DIFERIDO]
        ▲ revisión humana = compuerta de promoción a `confirmado`
```

### Recommended Project Structure

Siguiendo `processing/identity/` de ARCHITECTURE.md (subsistema aislado). Opción pragmática alineada al monorepo actual (`packages/`):

```
packages/
├── core/src/
│   ├── parlamentario.ts        # tipos Parlamentario + zod (vive en @obs/core)
│   └── nombre.ts               # normalizarNombre() — FUNCIÓN PURA (sin red/DB)
├── identity/                   # NUEVO paquete @obs/identity (subsistema aislado)
│   ├── src/
│   │   ├── deterministic.ts    # matchDeterminista() — FUNCIÓN PURA, fail-closed
│   │   ├── seeder.ts           # orquesta fetch→parse→normaliza→match→upsert
│   │   ├── parse-senado.ts     # XML <senador> → modelo
│   │   ├── parse-camara.ts     # XML <Diputado> + militancia vigente → modelo
│   │   ├── backup.ts           # exportMaestra() → JSON git (+ R2 gateado)
│   │   └── *.test.ts           # vitest, con fixtures reales
│   └── test/fixtures/
│       ├── senado-real.xml     # capturado LIVE 2026-06-18 (12.9KB)
│       └── camara-real.xml     # capturado LIVE 2026-06-18 (179KB, 155 dip)
supabase/
├── migrations/0005_parlamentario.sql
├── tests/0004_parlamentario.test.sql     # pgTAP
└── seeds/parlamentario.seed.json          # respaldo git (ID-09) + carga local
```

### Pattern 1: Seeder que reusa colaboradores (no `BaseConnector`)

**What:** Un script one-off que instancia `Fetcher`+`RobotsGuard`+`HostRateLimiter`+`assertAllowedUrl` directamente (no el flujo `BaseConnector.run` con caché diaria/drift, que está pensado para ingesta recurrente).
**When to use:** Siembra inicial idempotente.
**Example:**
```typescript
// Source: packages/ingest/src/index.ts (API real de Fase 1)
import { Fetcher, RobotsGuard, HostRateLimiter, assertAllowedUrl, IDENTIFIED_UA } from "@obs/ingest";
import { makeProvenance } from "@obs/core";
import { XMLParser } from "fast-xml-parser";

const SENADO_URL = "https://tramitacion.senado.cl/wspublico/senadores_vigentes.php";
const CAMARA_URL = "https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual";

async function fetchCatalog(url: string, fetcher: Fetcher, rl: HostRateLimiter, robots: RobotsGuard) {
  assertAllowedUrl(url);                          // deny-by-default + SSRF (CR-03)
  const host = new URL(url).host;
  if (!(await robots.isAllowed(url))) throw new Error("robots-disallow");
  await rl.wait(host);                            // 2-3s serial por host
  const body = await fetcher.get({ url, resource: "catalogo", key: "catalogo" });
  const prov = makeProvenance("senado|camara", url);   // FND-08 al momento del fetch
  return { xml: new TextDecoder().decode(body), prov };
}
```

### Pattern 2: Tomar la militancia VIGENTE de la Cámara

**What:** El catálogo de Cámara trae `<Militancias>` con TODO el historial de partidos; el partido actual es la `<Militancia>` cuyo rango `[FechaInicio, FechaTermino]` cubre hoy (o cuyo `FechaTermino` es nil).
**When to use:** Al parsear cada `<Diputado>`.
**Example:**
```typescript
// Elegir la militancia vigente (rango cubre la fecha de corte = hoy / inicio periodo 2026-03-11)
function partidoVigente(militancias: Militancia[], corte: Date): string | null {
  const activa = militancias.find(m =>
    new Date(m.FechaInicio) <= corte &&
    (m.FechaTermino == null || new Date(m.FechaTermino) >= corte));
  return activa?.Partido?.Alias ?? activa?.Partido?.Nombre ?? null;
}
```

### Pattern 3: Matcher determinista fail-closed (Etapa 0, sin LLM)

```typescript
// Función PURA sobre la maestra ya cargada. Único escritor de `estado`.
type Mention = { rut?: string; nombreNormalizado: string; camara: "diputados"|"senado"; periodo: string };
type Resolution = { id: string; metodo: "rut"|"nombre"; estado: "confirmado" }
                | { estado: "no_confirmado"; razon: string };

function matchDeterminista(m: Mention, maestra: Parlamentario[]): Resolution {
  // 1. RUT exacto (cuando exista — catálogos NO lo traen; aplica vs InfoProbidad Fase 4+)
  if (m.rut) {
    const byRut = maestra.filter(p => p.rut && normRut(p.rut) === normRut(m.rut!));
    if (byRut.length === 1) return { id: byRut[0].id, metodo: "rut", estado: "confirmado" };
  }
  // 2. Nombre normalizado ÚNICO dentro de (cámara, periodo) — sin homónimo
  const byNombre = maestra.filter(p =>
    p.camara === m.camara && p.periodo === m.periodo &&
    p.nombre_normalizado === m.nombreNormalizado);
  if (byNombre.length === 1) return { id: byNombre[0].id, metodo: "nombre", estado: "confirmado" };
  // 3. Fail-closed: homónimo / sin candidato / ambiguo → no se auto-acepta (Fase 4)
  return { estado: "no_confirmado", razon: byNombre.length > 1 ? "homonimo" : "sin-candidato" };
}
```

### Anti-Patterns to Avoid

- **Escribir `estado: confirmado` por fuzzy-match o similitud** → riesgo existencial #1 (PITFALLS.md). Solo RUT exacto o nombre único.
- **Hacer del seeder un `BaseConnector` con caché diaria** → la caché diaria saltaría la siembra en re-corridas del mismo día; el seeder es idempotente por clave natural, no por caché de día.
- **Meter el XML crudo en Postgres** → el crudo va a R2 (cuando haya credencial) o queda en fixtures; Postgres solo el modelo normalizado + provenance (ARCHITECTURE.md anti-pattern #2).
- **Exponer RUT en la capa pública** → uso interno only (Ley 21.719; Out of Scope en REQUIREMENTS.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parseo XML | Regex sobre el XML | `fast-xml-parser@5` | Entidades HTML (`&#225;`), atributos (`Sexo Valor=`), namespaces; regex se rompe |
| Rate-limit / UA / robots / SSRF | Delay y headers a mano | `@obs/ingest` (`Fetcher`/`RateLimiter`/`RobotsGuard`/`assertAllowedUrl`) | Ya implementado y testeado en Fase 1; WAF bloquea ráfagas |
| Provenance | Objeto ad-hoc | `makeProvenance()` de `@obs/core` | Captura `fetchedAt` al momento del fetch (FND-08) |
| Strip de acentos | Tabla de reemplazo manual | `String.prototype.normalize("NFD").replace(/\p{Diacritic}/gu,"")` | NFD + Unicode property escapes es el estándar; cubre ñ→n con cuidado (ver pitfall) |
| Firma R2 SigV4 | Firma manual | `R2Store` (aws4fetch) | Ya vetado Fase 1 |

**Key insight:** Toda la novedad de esta fase es **lógica pura de identidad** (normalización + matcher + backup). La infraestructura de fetch ya existe — el seeder es un *consumidor* del framework, no infraestructura nueva.

## Runtime State Inventory

> Esta fase NO es un rename/refactor — es greenfield de identidad. Sección incluida por completitud sobre el estado externo que la siembra toca.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguna maestra previa — tabla `parlamentario` se crea en 0005. Supabase **local** (docker) recibe la migración + seed. | Crear migración + cargar seed local |
| Live service config | Ninguno propio. Las fuentes externas (Cámara/Senado) son de solo-lectura, no se les escribe. | None |
| OS-registered state | Ninguno (no hay cron/task scheduler nuevo en esta fase; backup cron es discreción del planner, GitHub Actions preferido). | None |
| Secrets/env vars | `.env` ya provee `SUPABASE_*` (service key, no PAT) y `R2_*` (401). Se LEEN para fetch; remoto/R2 diferidos. | None (documentar limitación) |
| Build artifacts | Paquete nuevo `@obs/identity` requiere entrada en `pnpm-workspace.yaml` + `tsconfig` project references (como hizo Fase 1 con `@obs/ingest`). | Añadir al workspace |

**Verificado:** `pnpm-workspace.yaml` + `tsconfig.json` (raíz) ya tienen el patrón de project references usado por `@obs/ingest` (ver 01-02-SUMMARY.md). `[VERIFIED: codebase]`

## Common Pitfalls

### Pitfall 1: Homónimos auto-confirmados (RIESGO EXISTENCIAL #1)
**What goes wrong:** Dos parlamentarios con el mismo nombre normalizado se colapsan o se confirma el equivocado.
**Why it happens:** Apellidos comunes, familias políticas, "Walker P., Matías" en tres grafías (PITFALLS.md).
**How to avoid:** El matcher confirma SOLO si `byNombre.length === 1` dentro de (cámara, periodo). length>1 → `no_confirmado` con razón `homonimo`. Fail-closed.
**Warning signs:** Tasa de `confirmado` automático >90% sospechosamente alta; dos PARLID/Id distintos colapsados.

### Pitfall 2: `ñ` destruida por el strip de diacríticos
**What goes wrong:** NFD descompone `ñ` → `n` + tilde combinante; un strip naive de TODO diacrítico convierte "Muñoz" → "munoz" (deseable para folding) PERO si se aplica mal puede afectar comparaciones donde ñ≠n importa.
**Why it happens:** `ñ` es una letra propia en español, no una n acentuada.
**How to avoid:** Para `nombre_normalizado` (clave de comparación) se ACEPTA `ñ→n` como folding consistente (ambos lados se normalizan igual → comparable). Documentar la decisión y testear "Muñoz"/"Munoz" colapsan al mismo token. NO usar el normalizado para mostrar — el display usa los campos originales (`apellido_paterno`, etc.).
**Warning signs:** Test de "Núñez" falla; nombres con ñ no matchean su variante.

### Pitfall 3: Formatos de nombre divergentes entre catálogo y votaciones
**What goes wrong:** El catálogo da campos separados (`ApellidoPaterno`, `Nombre`); las votaciones del Senado dan "Apellido P., Nombre" (inicial del materno) — la normalización debe producir el MISMO `nombre_normalizado` desde ambas.
**Why it happens:** Cada fuente tiene su grafía.
**How to avoid:** `normalizarNombre` acepta tanto campos estructurados como string libre; ordena tokens de forma canónica (p.ej. `paterno materno nombres` ordenados), y captura la inicial del materno como caso especial. Testear que catálogo y formato-votación convergen. Guardar variantes en `parlamentario_alias`.
**Warning signs:** El mismo humano produce dos `nombre_normalizado` distintos según la fuente.

### Pitfall 4: Catálogo de Cámara SIN distrito ni RUT
**What goes wrong:** `parlamentario.distrito` y `.rut` quedan null para diputados; planes que asuman su presencia fallan.
**Why it happens:** `retornarDiputadosPeriodoActual` no incluye esos campos (verificado live).
**How to avoid:** Columnas nullable; `distrito` se enriquece (opcional, esta fase o Fase 5) parseando `www.camara.cl/diputados/diputados.aspx` (cheerio); `rut` se llena al cruzar con InfoProbidad (Fase 4+). La rama RUT del matcher se implementa pero no tiene datos desde catálogos.
**Warning signs:** NOT NULL constraint en distrito/rut revienta la siembra.

### Pitfall 5: Quirk de fecha en el catálogo de Cámara
**What goes wrong:** El nodo `<DiputadoPeriodo>` de los 155 vigentes muestra `<FechaInicio>2030-03-10` con `<FechaTermino xsi:nil="true"/>` (VIGENTE) — un valor de fecha contraintuitivo.
**Why it happens:** Particularidad del WS; lo determinante es `FechaTermino nil = vigente`, no el `FechaInicio` del nodo período.
**How to avoid:** Filtrar vigencia por `FechaTermino nil` (todos los 155 lo son), NO por `FechaInicio`. Para el PARTIDO usar la `<Militancia>` cuyo rango cubre la fecha de corte (inicio periodo 2026-03-11).
**Warning signs:** Se descartan diputados por filtrar mal la fecha del nodo período.

## Code Examples

### Normalización de nombre chileno (núcleo)
```typescript
// Source: patrón estándar NFD + Unicode property escapes (MDN String.normalize)
const PARTICULAS = new Set(["de","del","la","las","los","y","da","do"]);

export function normalizarNombre(input: {
  nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; libre?: string;
}): { nombre_normalizado: string; tokens: string[] } {
  const fold = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "")   // strip acentos (ñ→n consistente)
     .toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  // Catálogo: campos estructurados → orden canónico paterno+materno+nombres
  const partes = input.libre
    ? fold(input.libre).split(" ")
    : [input.apellidoPaterno, input.apellidoMaterno, input.nombres].filter(Boolean).map(fold).join(" ").split(" ");
  const tokens = partes.filter(t => t && !PARTICULAS.has(t));  // partículas fuera del token de blocking
  // nombre_normalizado: tokens ordenados (canónico, estable entre fuentes)
  const nombre_normalizado = [...tokens].sort().join(" ");
  return { nombre_normalizado, tokens };
}
```

### Parseo del XML del Senado
```typescript
// Source: forma real capturada LIVE 2026-06-18 (12.9KB)
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
const doc = parser.parse(xml);                       // { senadores: { senador: [...] } }
const senadores = [].concat(doc.senadores.senador);  // forzar array
// campos por senador: PARLID, PARLAPELLIDOPATERNO, PARLAPELLIDOMATERNO, PARLNOMBRE,
//                     REGION, CIRCUNSCRIPCION, PARTIDO, FONO, EMAIL, CURRICULUM
```

### Parseo del XML de la Cámara
```typescript
// Source: forma real capturada LIVE 2026-06-18 (179KB, 155 <Diputado>)
const doc = parser.parse(xml);  // { DiputadosPeriodoColeccion: { DiputadoPeriodo: [...] } }
const periodos = [].concat(doc.DiputadosPeriodoColeccion.DiputadoPeriodo);
const diputados = periodos.map(p => p.Diputado);     // cada uno: Id, Nombre, Nombre2,
//   ApellidoPaterno, ApellidoMaterno, FechaNacimiento, RUT(vacío), RUTDV(vacío),
//   Sexo, Militancias.Militancia[] → Partido { Id, Nombre, Alias }
// vigencia = FechaTermino nil; partido = militancia que cubre la fecha de corte
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `doGet.asmx` (sala) para diputados | `opendata.camara.cl/.../WSDiputado.asmx/retornarDiputadosPeriodoActual` | WS de opendata es el canal de catálogo | El sala doGet NO tiene método de catálogo de diputados; opendata sí (`retornarDiputado(s)`, `retornarDiputadosPeriodoActual`, `retornarDiputadosXPeriodo`) |
| Inferir partido de `getBancadasXSesion` | `<Militancias>` del propio diputado | catálogo lo trae | Evita los logos byte-array de 660KB y la granularidad "comité" |

**Deprecated/outdated:**
- `getBancadasXSesion` como fuente primaria de partido: trae logos enormes; usar `<Militancias>` del catálogo.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El folding `ñ→n` es aceptable para `nombre_normalizado` (clave de comparación), porque ambos lados se normalizan igual | Pitfall 2 / Code Examples | Bajo — es consistente; el display usa campos originales. Confirmar con operador en revisión del lote |
| A2 | El "periodo" del seed para diputados es "2026-2030" (Id 11 / Leg 374·58) y para senadores el periodo senatorial vigente | Matcher / DDL | Medio — si el modelo de periodo difiere entre cámaras, el matcher por (cámara,periodo) necesita una clave de periodo coherente. Planner debe fijar el valor exacto de `periodo`/`legislatura` por cámara |
| A3 | Enriquecer `distrito` vía scraping de `diputados.aspx` es OPCIONAL en esta fase (puede diferirse a Fase 5) | Pitfall 4 / Open Questions | Bajo — columna nullable; no bloquea ID-01/02/09 |
| A4 | Los 155 diputados con `FechaTermino nil` son exactamente los vigentes del periodo actual | Pitfall 5 | Bajo — verificado live (155 = dotación de la Cámara) |
| A5 | El `estado` inicial tras la siembra es `no_confirmado`/`probable` y el operador lo promueve a `confirmado` aceptando el lote (revisión humana = compuerta) | ID-01 | Bajo — alineado a CONTEXT Q1; el planner decide el estado intermedio exacto |

## Open Questions

1. **¿Se enriquece `distrito` (diputados) en esta fase o se difiere?**
   - What we know: el WS no trae distrito; `www.camara.cl/diputados/diputados.aspx` sí ("Distrito: Nº 10"), parseable con cheerio (HTTP 200, 256KB).
   - What's unclear: si vale el costo de un segundo scraper ASP.NET ahora.
   - Recommendation: columna nullable; enriquecimiento como tarea OPCIONAL/diferible (Fase 5 ya scrapea Cámara). ID-01/02/09 no lo requieren.

2. **Clave de `periodo` coherente entre cámaras para el matcher.**
   - What we know: Cámara = periodo 2026-2030 (Id 11). Senado tiene periodos senatoriales escalonados (no todos renuevan a la vez).
   - What's unclear: qué valor de `periodo` usar para senadores vigentes.
   - Recommendation: el planner fija una convención (p.ej. `periodo` = año de vigencia o etiqueta `senado-vigente-2026`); el matcher por (cámara,periodo) solo necesita que sea consistente DENTRO de cada cámara. Los senadores vigentes son un solo conjunto "vigentes hoy".

3. **¿Dónde vive el JSON de respaldo: `supabase/seeds/` o `.planning/seeds/`?**
   - What we know: `supabase/config.toml` tiene `[db.seed] sql_paths`, no json. La carga local podría ser un `.sql` generado o un script Deno que upserta.
   - Recommendation: snapshot autoritativo en `supabase/seeds/parlamentario.seed.json` (versionado git = ID-09); la carga local la hace el seeder (upsert idempotente), no `db.seed` (que es SQL). Discreción del planner.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Endpoint Senado `senadores_vigentes.php` | Siembra Senado (ID-01) | ✓ | XML 12.9KB, HTTP 200 | — |
| Endpoint Cámara `retornarDiputadosPeriodoActual` | Siembra Cámara (ID-01) | ✓ | XML 179KB, 155 dip, HTTP 200 | `retornarDiputadosXPeriodo?prmPeriodoId=11` (idéntico) |
| Página `diputados.aspx` (distrito) | Enriquecer distrito (opcional) | ✓ | HTML 256KB, HTTP 200 | diferir a Fase 5 |
| `fast-xml-parser@5` | Parseo XML | ✓ (a instalar) | 5.9.2 | — |
| Supabase LOCAL (docker) | Migración + carga | ✓ (Fase 1-2) | Postgres 17 | — |
| `supabase test db` (pgTAP) | Test de migración | ✓ (patrón Fase 1) | — | — |
| Supabase REMOTO (DDL/push) | Push de migración remota | ✗ | — | **Diferido** — service key, no PAT; paso de operador |
| R2 (bucket `observatorio`) | Backup a R2 | ✗ (401) | — | **Snapshot git** (autoritativo, cumple ID-09 hoy) |
| `.env` lectura catálogos | Fetch live | ✓ | — | — |

**Missing dependencies with no fallback:** ninguna que bloquee ID-01/02/09 (todo lo bloqueante está disponible localmente).
**Missing dependencies with fallback:**
- Supabase remoto → migración local + push diferido (operador).
- R2 → snapshot git autoritativo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^3.0.0` (TS unit) + pgTAP (`supabase test db`) |
| Config file | `vitest.config.ts` (raíz) + por-paquete; `supabase/tests/*.test.sql` |
| Quick run command | `pnpm --filter @obs/identity test` |
| Full suite command | `pnpm -w test && supabase test db` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ID-02 | `normalizarNombre`: NFD strip, casefold, ñ→n consistente, partículas, formato votación↔catálogo convergen | unit | `pnpm --filter @obs/identity test nombre` | ❌ Wave 0 |
| ID-02 | `matchDeterminista`: RUT exacto→confirmado; nombre único→confirmado; homónimo/sin-candidato→no_confirmado (fail-closed) | unit | `pnpm --filter @obs/identity test deterministic` | ❌ Wave 0 |
| ID-01 | Parseo del XML real (fixtures Senado/Cámara) → N senadores + 155 diputados con campos esperados | unit | `pnpm --filter @obs/identity test parse` | ❌ Wave 0 |
| ID-01 | Idempotencia de siembra: correr el upsert 2× produce el mismo estado (sin duplicados) | unit/integración | `pnpm --filter @obs/identity test seeder` | ❌ Wave 0 |
| ID-01 | Migración: `parlamentario` + `parlamentario_alias` existen, columnas + provenance, RLS deny-by-default | pgTAP | `supabase test db` | ❌ Wave 0 |
| ID-09 | `exportMaestra`: produce JSON estable y completo; round-trip (export→import) preserva la maestra | unit | `pnpm --filter @obs/identity test backup` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/identity test`
- **Per wave merge:** `pnpm -w test && supabase test db`
- **Phase gate:** suite completa verde + lote sembrado revisado por operador antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/identity/src/nombre.test.ts` (o en `@obs/core`) — ID-02 normalización
- [ ] `packages/identity/src/deterministic.test.ts` — ID-02 matcher fail-closed
- [ ] `packages/identity/src/parse-*.test.ts` — ID-01 parseo con fixtures reales
- [ ] `packages/identity/src/seeder.test.ts` — ID-01 idempotencia
- [ ] `packages/identity/src/backup.test.ts` — ID-09 round-trip
- [ ] `packages/identity/test/fixtures/{senado-real.xml, camara-real.xml}` — capturados LIVE 2026-06-18
- [ ] `supabase/tests/0004_parlamentario.test.sql` — pgTAP de la migración
- [ ] Workspace: alta de `@obs/identity` en `pnpm-workspace.yaml` + `tsconfig` references

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth nueva; siembra es backend/operador |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS deny-by-default en `parlamentario`/`parlamentario_alias` (enable RLS sin policies para anon — patrón Fase 1). `rut` jamás expuesto a anon |
| V5 Input Validation | yes | zod sobre el XML parseado antes de upsert; `assertAllowedUrl` (allowlist+SSRF) sobre las URLs de fetch |
| V6 Cryptography | no | Sin cripto nueva (R2 SigV4 vía aws4fetch, ya vetado) |
| V8/Privacy (Ley 21.719) | yes | `rut` y datos personales = uso interno; minimización por diseño; nunca capa pública |

### Known Threat Patterns for {seeder + Postgres + fuentes gubernamentales}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF vía URL de catálogo manipulada | Tampering/EoP | `assertAllowedUrl` (deny-by-default + bloqueo de IPs internas/metadata) — ya en `@obs/ingest` |
| Exposición de RUT a anon (RLS débil) | Information Disclosure | RLS enable sin policies; `rut` nullable interno; pgTAP verifica RLS en la tabla |
| Match equivocado publicado como hecho | Tampering (existencial #1) | Matcher fail-closed; solo `confirmado` (tras revisión humana) sería público — y eso es Fase 4/6 (ID-06) |
| WAF bloquea la siembra (ráfaga) | DoS (auto-inflingido) | `HostRateLimiter` 2-3s serial + `PgHostThrottle` durable + UA identificado (reuso Fase 1) |
| XML malformado / entidades / billion-laughs | DoS | `fast-xml-parser` (sin expansión de entidades externas); zod guard; tamaño acotado (catálogos < 200KB) |

## Sources

### Primary (HIGH confidence)
- **Sondeo LIVE 2026-06-18** (curl, UA `Bot-Ciudadano/1.0`, delay 2-3s):
  - `https://tramitacion.senado.cl/wspublico/senadores_vigentes.php` → HTTP 200, XML 12.9KB (campos PARLID, PARLAPELLIDOPATERNO/MATERNO, PARLNOMBRE, REGION, CIRCUNSCRIPCION, PARTIDO, FONO, EMAIL, CURRICULUM)
  - `https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual` → HTTP 200, XML 179KB, **155 `<Diputado>`** (Id, ApellidoPaterno/Materno, Nombre, Nombre2, FechaNacimiento, RUT vacío, RUTDV vacío, Sexo, Militancias→Partido{Id,Nombre,Alias})
  - `.../WSLegislativo.asmx/retornarPeriodoLegislativoActual` → periodo "2026-2030" Id 11, Legislatura Id 58 / Numero 374 (confirma CONTEXT)
  - `.../WSDiputado.asmx/retornarDiputadosXPeriodo?prmPeriodoId=11` → idéntico (179KB, 155 dip)
  - `https://www.camara.cl/diputados/diputados.aspx` → HTTP 200, 256KB, contiene "Distrito: Nº NN" (fallback distrito)
  - `https://www.camara.cl/sala/doGet.asmx` → método de catálogo de diputados AUSENTE; `getBancadasXSesion?prmSesiId=4791` devuelve bancadas con logos byte-array (660KB) — descartado como fuente primaria
- **Código Fase 1** (`packages/ingest/src/*`, `packages/core/src/*`, `supabase/migrations/0002`, `supabase/tests/0001`): API real de `@obs/ingest`, patrón de migración + RLS + pgTAP `[VERIFIED: codebase]`
- `.planning/research/ARCHITECTURE.md` / `PITFALLS.md` / CONTEXT.md — subsistema identidad, riesgo existencial #1, decisiones LOCKED
- `npm view fast-xml-parser` → 5.9.2; `slopcheck` → `[OK]`; sin `postinstall`

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md` (STACK.md embebido) — fast-xml-parser@5, cheerio@1.2.0, zod, R2/aws4fetch

### Tertiary (LOW confidence)
- Ninguna sin verificar — todos los endpoints clave se sondearon en vivo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — fast-xml-parser verificado en npm + slopcheck; resto reuso de Fase 1 verificado en código
- Architecture (endpoints): HIGH — ambos catálogos + periodo sondeados EN VIVO hoy; el unknown crítico (Cámara) quedó resuelto
- Normalización / matcher: HIGH (lógica pura) — diseño alineado a decisiones LOCKED; edge cases (ñ, homónimos, formato votación) documentados y testeables
- Pitfalls: HIGH — riesgo existencial #1 con mitigación fail-closed; quirks del WS (sin RUT/distrito, fecha 2030) verificados en la respuesta real

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (endpoints gubernamentales estables; re-verificar si cambia la legislatura o el portal de la Cámara)
