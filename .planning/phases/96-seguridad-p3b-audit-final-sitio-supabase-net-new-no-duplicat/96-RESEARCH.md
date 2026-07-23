# Phase 96: SEGURIDAD P3b — Audit final sitio + Supabase - Research

**Researched:** 2026-07-23
**Domain:** Security audit of a PUBLIC-repo civic-transparency app + live Supabase DB (hostile-subject threat model); CSP Report-Only→enforced; secret-history scan; dependency hygiene; operator-credential handoff.
**Confidence:** HIGH (todo verificado contra el repo VIVO y la DB VIVA en esta sesión — no training data)

## Summary

Esta fase es un **audit**, no un feature. La mayoría de las superficies YA están endurecidas por fases previas (Camino A/0044-0045, guards de 95, error boundaries genéricos, headers de seguridad de 85). El valor de la fase está en **verificar sobre lo VIVO** (git history + DB PROD, no migraciones) y en cerrar los tres ítems abiertos: CSP enforced (deploy), `pnpm audit` (HOY está SUCIO), y la re-derivación del allowlist contra pg_proc vivo.

Corrí las verificaciones concretas en esta sesión. Tres hallazgos **cambian el plan**: (1) **`pnpm audit --prod` NO está limpio** — 14 advisories (8 high / 6 moderate), dominados por **Next.js 16.2.9 < 16.2.11** (8 advisories, fix = bump a ≥16.2.11) más `brace-expansion`/`protobufjs`/`sharp` (transitivos, fix vía overrides — precedente 260715-bvd). (2) **pgvector vivo = 0.8.0, y Supabase gestionado NO ofrece ≥0.8.2** (`pg_available_extension_versions` topa en 0.8.0) → el criterio "pgvector ≥0.8.2 (CVE-2026-3172)" NO se puede cumplir con `alter extension update`; es un **upgrade de plataforma Postgres = handoff de operador**, exactamente como CONTEXT anticipó ("NO forzar"). (3) **gitleaks encontró 4 leaks en el historial, pero los 4 son FALSOS POSITIVOS** (constantes de test `S3CR3T-TICKET-...` + un fixture HTML) → cero rotación real requerida por gitleaks; B26 (DB password) sigue siendo el único secreto real ya-expuesto, ya cubierto por su runbook.

El resto está VERDE en la DB viva: **0 tablas de app con RLS deshabilitada, 0 policies to anon, 0 funciones de app ejecutables por anon, 0 grants de tabla de app a anon**. El ruido de pgTAP (1201 funciones + 28 grants a anon) debe filtrarse por `pg_depend deptype='e'` — es la trampa central de las queries de audit.

**Primary recommendation:** Estructurar en 3 planes — (01) repo público [gitleaks-triage + `.env.example` guard + errores + `pnpm audit` con bump Next + overrides], (02) DB viva [queries verbatim ya validadas + allowlist drift + pgvector→handoff], (03) CSP enforced + deploy + verificación empírica BrowserOS + `96-OPERATOR-HANDOFF.md`. Toda query de DB usa el idiom read-only con `not exists (pg_depend deptype='e')` para filtrar pgTAP.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scan de secretos (historial completo)**
- Herramienta: `gitleaks` 8.30.1 YA instalado local (`gitleaks git` sobre todo el historial, default rules). trufflehog NO disponible — gitleaks basta.
- Salida: reporte SIN valores (redactar: archivo, commit, rule-id, NUNCA el secreto). Lo alguna vez commiteado → tabla de rotación en el handoff de operador. El DB password ya-expuesto es B26 (checkpoint existente, no duplicar).
- Falsos positivos esperables (hashes, sha256 content-addressed, JWT de EJEMPLO en docs): triage explícito con razón por descarte.

**.env.example + errores genéricos**
- `.env.example`: assert de solo-placeholders. Guard como test vitest (espejo de los guards existentes en app/lib o scripts) que muerda si un valor parece real.
- Errores genéricos: auditar route handlers / páginas de error / catch de RPCs en app/; ningún `error.message` de Postgres/PostgREST al cliente; mensaje genérico + log server-side. Si hay leaks, fix mínimo.

**CSP Report-Only → ENFORCED (el ítem riesgoso)**
- Política enforced pragmática Next.js App Router estático-SSR sobre OpenNext/Cloudflare: `script-src 'self' 'unsafe-inline'` (Next hidrata con inline scripts sin nonce en este setup) + `object-src 'none'` + `base-uri 'self'` + `frame-ancestors 'none'` + `default-src 'self'` + `connect-src` limitado a self + Supabase URL + `img-src self+data:` + `style-src self+'unsafe-inline'`. Es estrictamente MEJOR que Report-Only-forever.
- Validación EMPÍRICA obligatoria: deploy → BrowserOS/DOM del deploy real (hidratación viva, cero errores CSP en console) + `curl -sI` de headers. Si rompe hidratación: degradar honesto (nunca quitar frame-ancestors/object-src) y re-verificar; documentar trade-off.
- Deploy usa runbook LOCKED: OpenNext en Docker node:22-slim (NUNCA alpine/Windows), robocopy a C:/Temp/obs-build, wrangler OAuth local. Arrastra fixes latentes 94.

**Supabase DB VIVA**
- Splinter: correr los lints de Supabase sobre la DB viva (queries vía psql; salida = findings con severidad y triage).
- Grants/RLS reales: psql PROD — enumerar (a) funciones public con ACLs (pg_proc + aclexplode: ninguna ejecutable por anon/authenticated fuera de diseño), (b) tablas con RLS deshabilitada o policies `to anon` inesperadas, (c) grants de tabla a anon/authenticated (CERO post-0044/0045).
- Re-derivación allowlist: PUBLIC_RPC_ALLOWLIST (26) vs pg_proc VIVO — drift PROD-vs-repo. Complementa Direction-B de 95 (repo-only).
- pgvector: `select extversion from pg_extension where extname='vector'` ≥ 0.8.2 (CVE-2026-3172). Si <0.8.2: `alter extension vector update` es DDL sobre PROD gestionado — documentar como nota de operador si Supabase no expone la versión objetivo; NO forzar.
- SUPABASE_DB_URL en .env (cargar con set -a source, jamás imprimir). Solo SELECT/lints — cero DDL en esta fase (0064 fue la última).

**pnpm audit + golden gate**
- `pnpm audit --prod` (y completo): limpio o parchado vía overrides en pnpm-workspace.yaml (precedente quick 260715-bvd). Si un advisory no tiene fix upstream: documentar triage con severidad y exposición real.
- Golden gate identidad: re-correr los golden sets (packages/adjudication golden-set.test.ts, cruces golden, gate DIPID de votos en CI) — `pnpm test` de packages verde ES la evidencia; citar counts.

**B26 y handoff**
- B26: NO rotar. Actualizar/citar el runbook 75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md en el handoff + cualquier secreto nuevo hallado por gitleaks se SUMA a la tabla de rotación.
- Handoff de cierre de milestone (B26, sign-offs F13/F17, gates v7.0) se consolida en `96-OPERATOR-HANDOFF.md`.

**Gates que JAMÁS se cruzan:** flags `*_PUBLIC_ENABLED` (MONEY/NET como estén), sign-offs legales, rotar credenciales, imprimir secrets.

### Claude's Discretion
- Estructura exacta de los planes (probable: 01 repo público, 02 DB viva, 03 CSP enforced + deploy + handoff).
- Política CSP exacta connect-src/img-src (leer el Report-Only actual y ajustar).
- Si `pnpm audit` requiere overrides: qué versión pin.
- Formato del reporte de auditoría (un 96-AUDIT.md por plan o consolidado).

### Deferred Ideas (OUT OF SCOPE)
- Nonce-based CSP (requiere dynamic rendering per-request en el worker) — post-milestone.
- Rate-limiting a nivel Cloudflare Worker/WAF propio — fuera de milestone.
- Rotación efectiva de credenciales halladas — acto de operador (handoff).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-02 | Audit sitio/repo público: scan de secretos todo el historial, `.env.example` sin valores reales, mensajes de error genéricos, headers verificados, CSP Report-Only→enforced | gitleaks 8.30.1 corrido (4 FP triados); `.env.example` verificado 40 entradas todas placeholder-vacías; error boundaries genéricos verificados (`error.message` solo en `throw`, no en render, no llega al cliente en prod); CSP Report-Only actual leído (política casi lista, solo falta `object-src`); deploy runbook localizado |
| SEC-03 | Audit Supabase: Splinter + grants/RLS DB VIVA, re-derivación allowlist, pgvector ≥0.8.2, `pnpm audit` limpio | Queries live corridas: 0 offenders de app (RLS/policies/grants/execute); allowlist 26 vs 25 secdef vivos (drift = 2 RPCs pruned-by-design + 2 invoker); **pgvector 0.8.0 vivo, ≥0.8.2 NO disponible en Supabase → handoff**; **`pnpm audit` SUCIO (14 advisories) → bump Next ≥16.2.11 + overrides** |
| SEC-04 | Rotación DB password (B26) — checkpoint operador documentado; agente no rota | Runbook 75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md leído (zero-credential-values, completo); solo re-citar en `96-OPERATOR-HANDOFF.md` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Secret-history scan | Repo/CI (local git) | — | gitleaks corre sobre `.git` local; no toca runtime |
| `.env.example` placeholder guard | CI (vitest en app/) | — | espejo de money-antiflip-guard; lee `../.env.example` desde APP_ROOT |
| Error-message genericness | Frontend Server (Next SSR) | — | error boundaries + throws viven en el árbol RSC de app/ |
| CSP header | Frontend Server (Next config → OpenNext Worker) | CDN/Static | `next.config.ts headers()` lo emite el Worker en todas las rutas |
| Grants/RLS/allowlist audit | Database (Postgres vivo) | — | pg_proc/pg_policies/aclexplode read-only vía psql |
| pgvector version | Database (extensión gestionada) | Platform/Operator | update = platform Postgres upgrade, no `alter extension` |
| `pnpm audit` + fix | Repo (dep tree) | — | overrides en pnpm-workspace.yaml + bump Next en app/ |
| DB password rotation (B26) | Operator (Supabase dashboard) | — | agente sin acceso al dashboard; documenta, no rota |

## Standard Stack

### Core (todo YA instalado — esta fase no añade dependencias net-new salvo el bump de Next)
| Herramienta | Versión (verificada HOY) | Propósito | Notas |
|-------------|--------------------------|-----------|-------|
| gitleaks | 8.30.1 [VERIFIED: `gitleaks version`] | Scan de secretos historial completo | 1723 commits, ~30 MB, scan ~4s |
| psql | 17.9 [VERIFIED: `psql --version`] | Audit read-only DB viva | client 17.9 contra Postgres gestionado |
| pnpm | 11.x (repo) | `pnpm audit` + overrides | `pnpm audit --prod` exit 0 pero reporta advisories |
| Next.js | **16.2.9 instalado** → bump a **≥16.2.11** [VERIFIED: `next/package.json` + advisories] | Frontend; fix de 8 advisories | patched ≥16.2.11 |
| vitest | (app/ tiene vitest.config.ts) | guards + golden gates | `pnpm --filter ./app test` / `pnpm -r --filter "./packages/*" test` |

**Installation (fix de audit):**
```bash
# 1) Bump Next en app/ (cierra 8 de 14 advisories)
cd app && pnpm add next@^16.2.11   # verificar versión exacta disponible al ejecutar
# 2) Overrides transitivos en pnpm-workspace.yaml (precedente 260715-bvd)
#    brace-expansion >=2.1.2 ; protobufjs >=7.6.5 ; sharp >=0.35.0
```

**Version verification (ejecutar en el plan antes de fijar los pins):**
```bash
npm view next version                    # confirmar la última ≥16.2.11 (compat React 19.2)
npm view brace-expansion version
npm view protobufjs version
npm view sharp version
```

## Package Legitimacy Audit

> Esta fase NO instala paquetes net-new de fuentes no-autoritativas. El único cambio de dependencia es **bumpear paquetes YA presentes** (Next, y transitivos vía override) a versiones parcheadas. No hay superficie de slopsquatting: todos son paquetes ya en el lockfile con años de historia y millones de descargas.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| next | npm | ~9 yrs | ~8M/wk | github.com/vercel/next.js | N/A (ya en lockfile) | Bump a ≥16.2.11 |
| brace-expansion | npm | ~12 yrs | ~90M/wk | github.com/juliangruber/brace-expansion | N/A (transitivo) | Override ≥2.1.2 |
| protobufjs | npm | ~10 yrs | ~15M/wk | github.com/protobufjs/protobuf.js | N/A (transitivo) | Override ≥7.6.5 |
| sharp | npm | ~9 yrs | ~10M/wk | github.com/lovell/sharp | N/A (transitivo) | Override ≥0.35.0 |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck no aplica: no hay descubrimiento de paquetes nuevos, solo actualización de pins existentes verificables con `npm view`.*

## Live Audit Findings (verified this session, read-only)

> Estos son resultados REALES de queries corridas HOY contra la DB PROD y el repo. El plan puede citarlos verbatim; el agente los re-correrá para confirmar cero deriva (patrón 93-AUDITORIA).

### DB viva — todo VERDE en la superficie de app

| Query | Resultado (filtrado por app, excl. pgTAP) | Raw (con ruido pgTAP) |
|-------|-------------------------------------------|-----------------------|
| Funciones public EXECUTABLE por anon | **0** [VERIFIED] | 1201 (todo pgTAP) |
| Tablas de app con grant a anon/authenticated | **0** [VERIFIED] | 28 (`pg_all_foreign_keys`, `tap_funky` = pgTAP) |
| Tablas public con RLS deshabilitada | **0** [VERIFIED] | 0 |
| Policies `to anon` en public | **0** [VERIFIED] | 0 |

**La trampa central del audit:** pgTAP instala 1200+ funciones y 2 vistas en `public` con EXECUTE/grants a anon. TODA query naive de audit las cuenta como offenders. Filtrar SIEMPRE con:
```sql
and not exists (select 1 from pg_depend d where d.objid = <obj>.oid and d.deptype = 'e')
```
(excluye objetos que dependen de una extensión). Sin este filtro el reporte da 1201/28 falsos positivos.

### Allowlist drift (PUBLIC_RPC_ALLOWLIST=26 vs pg_proc vivo)

**Funciones SECURITY DEFINER de app vivas (non-extension): 25.** Cruce contra la allowlist (26 entradas en `app/lib/lockdown-guard.test.ts:165-192`):

| Categoría | Funciones | Interpretación |
|-----------|-----------|----------------|
| En allowlist Y secdef vivas | 23 de las 26 | OK — coinciden repo↔PROD |
| En allowlist pero INVOKER (no secdef) vivas | `buscar_citaciones`, `match_proyectos` | OK — reads PII-safe como invoker; siguen allowlisted legítimamente |
| Secdef vivas NO en allowlist (drift) | `rebeldias_de_parlamentario`, `tasa_ausencia_comparada` | **Esperado, no un hueco:** son las RPCs del carril de voto PODADO (Phase 68-03: "RPCs inertes en DB, fuera de PUBLIC_RPC_ALLOWLIST por diseño"). Confirmado: NO ejecutables por anon (count=0). El plan las DOCUMENTA como "inertes-por-diseño, exclusión deliberada", no las agrega al allowlist ni las dropea. |

**Conclusión del drift:** cero drift no-explicado. Las 2 secdef fuera de allowlist son intencionales y ya inertes. El allowlist repo está en sync con la superficie viva ejecutable.

### pgvector — GAP real, resuelto por handoff

- `select extversion from pg_extension where extname='vector'` → **`0.8.0`** [VERIFIED]
- `pg_available_extension_versions` para `vector` → topa en **`0.8.0`** (`default_version='0.8.0'`) [VERIFIED]
- **Implicación:** `alter extension vector update` NO puede alcanzar ≥0.8.2 hoy — la plataforma gestionada de Supabase no publica esa versión. Subir a ≥0.8.2 (CVE-2026-3172) requiere un **upgrade de la versión de Postgres/plataforma en el dashboard de Supabase** (acto de operador con posible downtime), NO un DDL de esta fase.
- **Acción del plan:** documentar el gap en `96-OPERATOR-HANDOFF.md` como checkpoint de operador (espejo de B26). El success criterion "pgvector ≥0.8.2 confirmado" se cumple con **exposición honesta del gap + ruta de remediación**, no forzándolo. Ver la nota CVE abajo para evaluar exposición real.

### gitleaks — 4 findings, TODOS falsos positivos

`gitleaks git --redact --report-format json` → **4 leaks** en 1705 commits. Triage (redactado, sin valores):

| # | rule | file | commit | Veredicto |
|---|------|------|--------|-----------|
| 1 | generic-api-key | `packages/dinero/src/run-dinero-masivo-cli.test.ts` | 18f1dcae | **FP** — constante de test `S3CR3T-TICKET-MASIVO-70` (fixture del guard de redacción de ticket) |
| 2 | generic-api-key | `packages/dinero/src/ingest-run.test.ts` | 16ffe62c | **FP** — constante de test `S3CR3T-TICKET-NO-LEAK-70` |
| 3 | generic-api-key | `packages/dinero/src/connector-chilecompra.test.ts` | 91de0f47 | **FP** — constante de test `S3CR3T-TICKET-NO-LEAK-9f2a` (test explícito de que el ticket NUNCA se filtra) |
| 4 | generic-api-key | `packages/agenda/test/fixtures/camara-citaciones-semana.html` | 9798a057 | **FP** — fixture HTML scrapeado de WebForms (token `__VIEWSTATE` de ejemplo, no un secreto propio) |

**Conclusión:** cero secretos reales en el historial según gitleaks. B26 (DB password) sigue siendo el ÚNICO secreto real ya-expuesto (identificado en v7, no por gitleaks) y ya tiene su runbook. El plan puede opcionalmente añadir un `.gitleaks.toml` con allowlist de estos 4 paths para que un scan futuro dé limpio, o triarlos en el reporte — decisión de discreción.

### `pnpm audit` — SUCIO hoy (14 advisories)

`pnpm audit --prod` → **6 moderate + 8 high** [VERIFIED]:

| Severidad | Paquete | Título (resumido) | Vuln | Patched | Fix |
|-----------|---------|-------------------|------|---------|-----|
| high×3 / moderate×5 | **next** | 8 advisories (middleware bypass, SSRF Server Actions, DoS, cache confusion, image DoS, endpoint disclosure) | `>=16.0.0 <16.2.11` | `>=16.2.11` | **bump `next` a ≥16.2.11 en app/** |
| high | brace-expansion | DoS regex `{}` | `<2.1.2` | `>=2.1.2` | override |
| moderate | protobufjs | DoS `.proto` parsing | `<=7.6.4` | `>=7.6.5` | override |
| high | sharp | libvips CVEs | `<0.35.0` | `>=0.35.0` | override |

Un solo bump de Next cierra 8/14. Los 3 transitivos van por override (precedente exacto 260715-bvd). Ninguno es "sin fix upstream" → el criterio "audit limpio" es ALCANZABLE en esta fase. **Riesgo a validar:** el bump de Next 16.2.9→16.2.11 es un patch dentro de 16.2.x (bajo riesgo), pero DEBE re-verificarse compat con React 19.2 + OpenNext + el build Docker antes del deploy (el deploy empírico de plan 03 lo caza).

## Architecture Patterns

### System Architecture Diagram (superficie de audit)

```
                         ┌─────────────────────────────────────────┐
   git .git local ──────▶│ gitleaks (historial completo, --redact) │──▶ 96-AUDIT (FP triage)
                         └─────────────────────────────────────────┘
                         ┌─────────────────────────────────────────┐
   .env.example ────────▶│ vitest guard (placeholder-only detector)│──▶ CI gate (nuevo test)
   (repo root)           └─────────────────────────────────────────┘
                         ┌─────────────────────────────────────────┐
   app/ RSC tree ───────▶│ error boundaries (throw→boundary→genérico│──▶ (ya OK; verificar)
   (throws con msg)      │ + console.error server-side)             │
                         └─────────────────────────────────────────┘
                         ┌─────────────────────────────────────────┐
   next.config.ts ──────▶│ CSP Report-Only → ENFORCED  ────────────│──▶ deploy → BrowserOS + curl -sI
                         └─────────────────────────────────────────┘
   .env SUPABASE_DB_URL  ┌─────────────────────────────────────────┐
   (set -a source) ─────▶│ psql read-only (pg_proc/pg_policies/     │──▶ 96-AUDIT (0 offenders app)
                         │ aclexplode/pg_class) + filtro pg_depend  │
                         │ deptype='e' (excluir pgTAP)              │
                         └─────────────────────────────────────────┘
   pnpm-workspace.yaml ─▶ pnpm audit → bump Next + overrides ───────▶ audit limpio
   Supabase dashboard ──▶ [OPERADOR] pgvector≥0.8.2 + B26 rotación ─▶ 96-OPERATOR-HANDOFF.md
```

### Pattern 1: Guard vitest con detector PURO + mutation self-check (para el `.env.example` guard)
**What:** Test vitest que lee `../.env.example` desde `APP_ROOT`, con detector puro exportado y un self-check en memoria que prueba que el guard MUERDE.
**When to use:** El nuevo guard SEC-02 de placeholders (espejo EXACTO de `money-antiflip-guard.test.ts`).
**Example:**
```typescript
// Fuente: app/lib/money-antiflip-guard.test.ts (patrón verificado en repo)
const APP_ROOT = process.cwd();                     // app/
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");

// detector PURO (ejercible en memoria):
export function detectarValorNoPlaceholder(envSrc: string): string[] {
  // heurística: KEY=<algo que parece real>. Placeholder = vacío tras '=' o un
  // booleano/slug conocido (false/true/crudo-servel/1). Real = sb_secret_, ey.J
  // (JWT), hex largo, postgresql://...:<algo>@, R2 endpoint con .r2.cloudflarestorage.com
  ...
}
// (4) mutation self-check: inyectar "SUPABASE_SECRET_KEY=sb_secret_realvalue" → debe morder.
```
**Ubicación:** `app/lib/env-example-guard.test.ts` (NO en scripts/; los guards viven en `app/lib/*` y corren en la suite vitest de app/ que ya está en CI — un test nuevo entra gratis, precedente lockdown/money/anti-insinuacion).
**Ojo (heurística):** `.env.example` HOY tiene 3 líneas con valores no-vacíos que son LEGÍTIMOS y NO son secretos: `BACKFILL_ITERATIONS=1`, `MONEY_PUBLIC_ENABLED=false`, `ADMIN_REVISION_ENABLED=false`, `PUBLIC_INDEXABLE=false`, `SERVEL_CRUDO_BUCKET=crudo-servel`. El detector debe allowlistar booleanos/enteros/slugs de config y morder SOLO ante formatos de secreto (sb_secret_, JWT eyJ, hex ≥32, connection strings con password). El money-antiflip-guard YA asertó `MONEY_PUBLIC_ENABLED=false` — no colisionar.

### Pattern 2: psql read-only con filtro pg_depend (para todas las queries de DB)
```bash
# idiom LOCKED (verificado): set -a source, jamás imprimir la URL
DB_URL=$(node -e "const fs=require('fs');console.log(fs.readFileSync('.env','utf8').match(/^SUPABASE_DB_URL=(.+)$/m)[1].trim())")
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA -c "<query con: and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')>"
```

### Anti-Patterns to Avoid
- **Query de audit sin filtro pg_depend:** reporta 1201 funciones + 28 grants pgTAP como offenders → conclusión falsa "la DB está abierta". SIEMPRE filtrar extensiones.
- **`alter extension vector update` para el CVE:** falla silenciosamente en 0.8.0 (no hay target ≥0.8.2 en la plataforma). Es un upgrade de plataforma = operador.
- **Renderizar `error.message` en un error boundary:** hoy los boundaries NO lo hacen (solo `console.error`); NO introducirlo al "mejorar" el UX de error.
- **Poner el guard en scripts/ en vez de app/lib/:** rompe el precedente y no corre en la suite CI de app.
- **Añadir `rebeldias_de_parlamentario`/`tasa_ausencia_comparada` al allowlist:** son inertes-por-diseño; agregarlas revertiría la poda de 68-03.

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|-------------|------|---------|
| Scan de secretos historial | regex casero sobre `git log` | gitleaks 8.30.1 (ya instalado) | reglas mantenidas, redacción nativa, cobertura de entropía |
| Parche de deps transitivas | fork/patch manual | pnpm overrides en pnpm-workspace.yaml | precedente 260715-bvd; pnpm 11 lee overrides ahí |
| Enforcement de error genérico | try/catch por página | Next error boundaries (`error.tsx`) YA existentes | ya capturan el throw y no filtran el message al cliente en prod |
| Lints de seguridad DB | inventar checks | queries Splinter + pg_catalog directas (validadas aquí) | Splinter es el linter oficial de Supabase; las queries base ya están escritas y corridas |

**Key insight:** casi todo el endurecimiento ya existe. La tentación es "construir un guard nuevo grande"; la realidad es que 3 de los 4 sub-ítems de SEC-02 están VERDES y solo hay que VERIFICARLOS y documentarlos; el trabajo real net-new es (a) el guard `.env.example`, (b) el fix de `pnpm audit`, (c) el flip de CSP + deploy.

## Runtime State Inventory

> Fase de audit (no rename/refactor). Esta sección mapea "estado vivo que un grep de repo no encuentra" — relevante porque el audit ES sobre estado vivo.

| Categoría | Ítems encontrados | Acción requerida |
|-----------|-------------------|-------------------|
| Stored data | pgvector 0.8.0 en la extensión gestionada (no en migraciones) | handoff operador (platform upgrade para CVE) |
| Live service config | 25 funciones secdef vivas + ACLs reales (no solo migraciones); allowlist 26 en repo | verificar drift (hecho: 2 inertes-por-diseño, cero drift no-explicado) |
| OS-registered state | DB password B26 vive en Supabase server + `.env` local + posible GH secret mirror | handoff operador (rotación, NO agente) — runbook 75 ya existe |
| Secrets/env vars | `.env` local poblado (SUPABASE_DB_URL presente, verificado sin imprimir); `.env` gitignored (`.gitignore:2`) | ninguno — jamás imprimir; solo referenciar por nombre |
| Build artifacts | Next 16.2.9 instalado en `app/node_modules` (< 16.2.11 parcheado) | bump + reinstall + rebuild antes del deploy |

## Common Pitfalls

### Pitfall 1: pgTAP contamina toda query de audit
**Qué sale mal:** `aclexplode` / `role_table_grants` reportan 1201 funciones y 28 grants a anon → parece que la DB está totalmente abierta.
**Por qué:** pgTAP instala su suite en `public` con EXECUTE/grants amplios a anon.
**Cómo evitarlo:** filtrar `and not exists (select 1 from pg_depend d where d.objid=<obj>.oid and d.deptype='e')`. Con el filtro: 0 funciones, 0 grants de app.
**Señal de alerta:** un count de audit en los cientos/miles. La superficie de app es de decenas.

### Pitfall 2: Asumir que `error.message` en un `throw` filtra Postgres al cliente
**Qué sale mal:** hay 24 `throw new Error(...: ${error.message})` en app/ que interpolan texto de PostgREST/Postgres.
**Por qué NO es un leak:** esos throws suben al error boundary (`error.tsx`), que hace `console.error(error)` (server-side) y renderiza copy genérico. En **producción, Next.js NO envía el `error.message` al cliente** — solo el `digest` (hash opaco). El texto de Postgres queda en logs del Worker, no en el HTML.
**Cómo verificarlo (en el plan):** en el deploy real, provocar un error y confirmar por DOM/console que el cliente recibe copy genérico + digest, nunca `relation "x" does not exist`. NO son route handlers JSON (no hay `route.ts` en app/) — solo páginas SSR con boundaries.
**Señal de alerta:** un `error.tsx` o un componente que renderice `{error.message}` en JSX (hoy: cero — verificado).

### Pitfall 3: Bump de Next que rompe el build OpenNext
**Qué sale mal:** subir Next puede desalinear `@opennextjs/cloudflare` o el build Docker.
**Cómo evitarlo:** bump dentro de 16.2.x (patch), correr `pnpm --filter ./app build` local o en el Docker node:22-slim ANTES del deploy; el deploy empírico (plan 03) es el gate final. Verificar `npm view @opennextjs/cloudflare peerDependencies` si hay duda.

### Pitfall 4: CSP enforced rompe hidratación en el Worker
**Qué sale mal:** quitar `'unsafe-inline'` de script-src rompe la hidratación de Next (inline bootstrap sin nonce).
**Cómo evitarlo:** mantener `script-src 'self' 'unsafe-inline'` (el setup no soporta nonce sin dynamic-per-request). Añadir `object-src 'none'` (falta hoy) + conservar `frame-ancestors 'none'`/`base-uri 'self'`. Validar en deploy real con BrowserOS (cero errores CSP en console) + `curl -sI`.

## Code Examples

### Query: allowlist drift (secdef vivos vs allowlist)
```bash
# Fuente: validado esta sesión contra PROD
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA -c "
select p.proname from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef=true
and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
order by 1;"
# → 25 filas; 23 en allowlist, 2 inertes-por-diseño (rebeldias_/tasa_ausencia_)
```

### Query: pgvector version + disponibilidad de update
```bash
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA -c "select extversion from pg_extension where extname='vector';"          # → 0.8.0
PGCLIENTENCODING=UTF8 psql "$DB_URL" -tA -c "select default_version from pg_available_extensions where name='vector';"  # → 0.8.0 (no ≥0.8.2)
```

### CSP enforced propuesta (para next.config.ts)
```typescript
// Reemplaza el key "Content-Security-Policy-Report-Only" por "Content-Security-Policy":
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",   // Next hidrata con inline sin nonce en OpenNext estático
    "connect-src 'self'",                   // el navegador NO habla con Supabase directo (todo server-side) — 'self' basta; verificar en deploy que no hay fetch cross-origin del cliente
    "object-src 'none'",                    // NET-NEW vs la política actual
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
}
```
**Nota connect-src:** el sitio lee Supabase **server-side** (service key, `app/lib/supabase.ts` con `import "server-only"`). El navegador NO hace fetch a `*.supabase.co`. Por eso `connect-src 'self'` debería bastar; CONTEXT sugiere "self + Supabase URL" como red de seguridad. **Verificar empíricamente en el deploy:** si el console reporta violación de connect-src hacia supabase.co, añadir el origen; si no, `'self'` es más estricto y correcto. (Confirmar que no hay Client Components haciendo fetch a Supabase — el modelo Camino A dice que no.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSP Report-Only (protege cero) | CSP enforced pragmática (`'unsafe-inline'` script + object-src none) | esta fase | protección real de injection |
| Next 16.2.9 | Next ≥16.2.11 | esta fase | cierra 8 advisories |
| Overrides en package.json `pnpm` field | Overrides en pnpm-workspace.yaml | pnpm 11 (260715-bvd) | el campo `pnpm` de package.json se ignora |

**Deprecated/outdated:**
- `alter extension vector update` como vía para el CVE de pgvector: inviable en Supabase gestionado hoy (no publica ≥0.8.2) → platform upgrade.
- Agente `supabase-reviewer`: NO existe en el repo (`.claude/agents/` ausente). Las queries van directas por psql (ya validadas aquí); no depender de un agente inexistente.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | En producción Next.js NO filtra `error.message` al cliente (solo `digest`) | Pitfall 2 | Si un build filtra el message, habría disclosure — MITIGADO por verificación empírica en el deploy (plan 03) |
| A2 | pgvector ≥0.8.2 no está disponible en Supabase gestionado (verificado: default_version=0.8.0 HOY) | pgvector | Podría publicarse más adelante; el plan debe re-correr `pg_available_extensions` al ejecutar, no asumir |
| A3 | Los 4 gitleaks findings son FP (constantes de test verificadas en 3/4; el 4º es fixture HTML) | gitleaks | Bajo — 3/4 leídos directamente; el 4º es un `test/fixtures/*.html` de scraping, no un secreto propio |
| A4 | CVE-2026-3172 de pgvector: severidad/exposición real en 0.8.0 NO verificada contra el advisory oficial | pgvector | Si es RCE crítico explotable sin auth, el handoff sube de prioridad — VER Open Question 1 |
| A5 | Bump Next 16.2.9→16.2.11 no rompe OpenNext/React 19.2 | Pitfall 3 | Patch dentro de minor; el deploy empírico lo caza |

## Open Questions

1. **CVE-2026-3172 (pgvector): ¿cuál es la exposición real en 0.8.0 y qué versión exacta la fixea?**
   - Lo que sabemos: SEC-03 pide ≥0.8.2; vivo es 0.8.0; Supabase no ofrece ≥0.8.2 hoy.
   - Lo que falta: el detalle del advisory (vector de ataque, si requiere auth, qué versión mínima parchea). No lo verifiqué contra fuente oficial en esta sesión.
   - Recomendación: el plan (o discuss) debe consultar el advisory oficial de pgvector/GitHub para clasificar la urgencia del handoff. Si el vector requiere ejecutar SQL arbitrario (que anon NO puede — 0 funciones anon-executable), la exposición práctica es baja y el handoff es "cuando Supabase lo publique". Documentar con esa matización.

2. **¿Añadir `.gitleaks.toml` con allowlist de los 4 FP, o solo triarlos en el reporte?**
   - Recomendación (discreción): añadir `.gitleaks.toml` con los 4 paths allowlisted deja el scan futuro limpio (mejor señal de regresión). Es aditivo y no toca secretos.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| gitleaks | scan historial (SEC-02) | ✓ | 8.30.1 | — |
| psql | audit DB viva (SEC-03) | ✓ | 17.9 | — |
| SUPABASE_DB_URL | queries PROD | ✓ (poblado en .env) | — | — (sin él, plan 02 bloquea) |
| pnpm | audit + overrides | ✓ | 11.x | — |
| Docker node:22-slim | build/deploy CSP (plan 03) | ✓ (precedente v6.0) | node 22 | — |
| wrangler (global, OAuth) | deploy | ✓ (precedente) | 4.x | GH Actions (bloqueado: CF token no en repo) |
| BrowserOS MCP | verificación empírica CSP | ✓ | `http://127.0.0.1:9200/mcp` | — |

**Missing dependencies with no fallback:** ninguna para el audit; el único gap es **pgvector ≥0.8.2 no disponible en la plataforma** → no es una dependencia local, es un platform upgrade de operador.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (app/ tiene `app/vitest.config.ts`; packages tienen los suyos) |
| Config file | `app/vitest.config.ts` (guards viven en `app/lib/*.test.ts`) |
| Quick run command | `pnpm --filter ./app test` (guards) |
| Full suite command | `pnpm test` (= `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-02 | `.env.example` solo placeholders | unit (guard) | `pnpm --filter ./app test env-example-guard` | ❌ Wave 0 (crear, espejo money-antiflip) |
| SEC-02 | Error genérico, sin Postgres al cliente | manual + empírico | verificación BrowserOS DOM en deploy (provocar error) | manual-only (justificado: solo verificable en prod) |
| SEC-02 | Secret-history scan limpio (tras FP triage) | script | `gitleaks git --redact` (exit + triage doc) | ✓ (herramienta) |
| SEC-02 | CSP enforced sin romper hidratación | empírico | BrowserOS console (0 CSP errors) + `curl -sI` | manual-only (deploy) |
| SEC-03 | 0 offenders de app en DB viva | script (psql) | queries verbatim con filtro pg_depend | ✓ (validadas esta sesión) |
| SEC-03 | Allowlist sin drift no-explicado | script (psql) | secdef-vivos vs allowlist 26 | ✓ (validada; 2 inertes doc) |
| SEC-03 | `pnpm audit` limpio | script | `pnpm audit --prod` exit + 0 advisories tras fix | ✓ (herramienta) |
| SEC-03 | Golden gate identidad verde | unit | `pnpm -r --filter "./packages/*" test` (adjudication + cruces golden) | ✓ (`packages/adjudication/src/golden/golden-set.test.ts`, `packages/cruces/src/golden/golden-set.test.ts`) |
| SEC-04 | B26 documentado (no rotado) | doc | `96-OPERATOR-HANDOFF.md` cita runbook 75 | ❌ Wave 0 (crear doc) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test` (guards + suite app)
- **Per wave merge:** `pnpm test` (packages golden gates + app)
- **Phase gate:** `pnpm test` verde + `pnpm audit --prod` limpio + deploy CSP verificado por BrowserOS antes de cerrar.

### Wave 0 Gaps
- [ ] `app/lib/env-example-guard.test.ts` — cubre SEC-02 (.env.example placeholders); espejo de `money-antiflip-guard.test.ts` con detector puro + mutation self-check
- [ ] `96-OPERATOR-HANDOFF.md` — consolida B26 + pgvector-gap + sign-offs pendientes (cubre SEC-04)
- [ ] (opcional, discreción) `.gitleaks.toml` — allowlist de los 4 FP para scan limpio futuro
- Framework: ya instalado (vitest en app/ y packages) — sin install net-new.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Threat model repo-público + service_role-bypass + sujeto-hostil (documentado, Pitfall 12) |
| V2 Authentication | no | El sitio público no autentica usuarios; anon está muerto (Camino A) |
| V3 Session Management | no | Sin sesiones de usuario en la superficie pública |
| V4 Access Control | yes | Allowlist RPC + 0 grants anon (verificado vivo); service_role = boundary por RPC |
| V5 Input Validation | parcial | RPCs bounded de 95 (SEC-01, fase anterior); esta fase verifica no-regresión |
| V6 Cryptography | no | Sin cripto propia; JWT/keys gestionados por Supabase |
| V7 Error Handling | yes | Error genérico + log server-side (verificar en deploy) |
| V9 Communications | yes | HSTS + CSP enforced + HTTPS (Cloudflare Worker) |
| V14 Configuration | yes | `.env.example` placeholders + secret-history scan + `pnpm audit` |

### Known Threat Patterns for {repo-público civic app + Supabase service_role}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secreto en git history (repo público) | Information Disclosure | gitleaks full-history + rotación (B26 documentado; 4 FP triados) |
| `.env.example` con valor real | Information Disclosure | guard vitest placeholder-only (nuevo) |
| Postgres error text al cliente hostil | Information Disclosure | error boundary genérico + digest-only (Next prod) |
| RPC nueva no-allowlisted bajo service_role | Elevation of Privilege | re-derivación allowlist vs pg_proc vivo (0 drift no-explicado) |
| CSP Report-Only = 0 protección | Tampering (injection) | flip a enforced con política probada |
| Dependencia vulnerable (Next SSRF/DoS) | DoS / SSRF | `pnpm audit` + bump ≥16.2.11 + overrides |
| pgvector CVE-2026-3172 | (por clasificar, ver OQ1) | platform upgrade (operador) — exposición mitigada por 0 funciones anon-executable |

## Sources

### Primary (HIGH confidence — verificado esta sesión)
- DB PROD vía psql 17.9 (read-only) — pgvector 0.8.0, 0 offenders de app, allowlist drift, extension versions — VERIFIED
- `gitleaks git --redact` sobre 1705 commits — 4 findings, todos FP — VERIFIED
- `pnpm audit --prod --json` — 14 advisories deduplicados — VERIFIED
- `app/next.config.ts`, `app/lib/supabase.ts`, `app/app/**/error.tsx`, `app/lib/money-antiflip-guard.test.ts`, `app/lib/lockdown-guard.test.ts:165-192`, `.env.example`, `pnpm-workspace.yaml` — leídos directamente — VERIFIED
- `.planning/phases/75-.../75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` — runbook B26 — VERIFIED
- `.planning/milestones/v6.0-phases/61-.../61-02-SUMMARY.md` — deploy runbook — VERIFIED

### Secondary (MEDIUM confidence)
- Advisories de Next.js / brace-expansion / protobufjs / sharp — reportados por `pnpm audit` (fuente: GitHub advisory DB) — MEDIUM (confirmar patched exacto con `npm view` al ejecutar)

### Tertiary (LOW confidence — requiere validación)
- CVE-2026-3172 (pgvector): severidad/vector/versión-fix exactos NO verificados contra advisory oficial — LOW (Open Question 1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo verificado contra el repo/DB vivos
- Architecture (audit surface): HIGH — queries corridas, superficies leídas
- Pitfalls: HIGH — pgTAP-noise y error-boundary-safety confirmados empíricamente
- pgvector CVE urgency: LOW — advisory oficial pendiente de consulta

**Research date:** 2026-07-23
**Valid until:** 2026-08-06 (14 días — el estado de `pnpm audit` y las versiones disponibles de pgvector/Next pueden moverse; re-correr al planificar)
