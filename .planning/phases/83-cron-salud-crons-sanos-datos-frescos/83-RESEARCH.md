# Phase 83: CRON-SALUD — Crons sanos + datos frescos — Research

**Researched:** 2026-07-15
**Domain:** GitHub Actions cron health + ingesta de dos etapas (Deno/TS conectores) + frescura de datos visibles
**Confidence:** HIGH (root causes verificados con log de CI + lectura de código, no hipótesis)

## Summary

Phase 83 no es net-new: es **reparación quirúrgica** de dos crons rotos, un **cambio de cadencia** (viernes → diario L-V) sobre maquinaria de rotación que YA existe, y **cerrar un gap de refresco** de la fecha del roster. Los dos crons que fallan NO fallan por la fuente ni (en el caso de probidad) por el WAF: **fallan por un bug de path idéntico** — `const root = process.cwd()` en dos CLIs que se ejecutan vía `pnpm --filter @obs/<pkg> exec`, lo que pone el cwd en el directorio del paquete, no en la raíz del repo → `ENOENT` al leer `supabase/seeds/parlamentario.seed.json`. Los CLIs que SÍ funcionan (leyes, agenda, votos) usan `findWorkspaceRoot(process.cwd())` en su lugar.

El chip "Actualizado 20 jun · Senado" de las fichas viene de `parlamentario.fecha_captura` (RPC `parlamentario_publico` → `ParlamentarioHeader` → `ProvenanceBadge`). Ese campo lo escribe SOLO el seeder de identidad CON credenciales de escritura a DB (`SUPABASE_LOCAL_SERVICE_KEY`), y el único workflow que corre el seeder (`backup-parlamentario.yml`) **deliberadamente NO le pasa esa credencial** (commitea el snapshot a git, no escribe la DB). Por eso el roster de la DB quedó congelado en la última corrida LOCAL del operador (~20 jun). Ningún cron refresca ese campo.

La cadencia diaria L-V de votaciones es un **cambio de una línea de cron**: `run-tramitacion-prod-cli` ya trae round-robin incremental con cursor persistido (`leyes_rotacion_estado`, offset con wrap-around, corpus paginado anti-cap-1k) construido en Phase 74. Ponerlo diario no requiere tocar el CLI.

**Primary recommendation:** (1) Reemplazar `const root = process.cwd()` por `const root = findWorkspaceRoot(process.cwd())` en `run-probidad-todos-cli.ts`, `run-camara-lobby-cli.ts` y `run-probidad-bienes-cli.ts` — esto repara probidad de raíz. (2) lobby-camara tiene ADEMÁS el bloqueo WAF real → mantener schedule OFF + runbook local (ya existe), pero corregir su path bug para que el dispatch manual funcione. (3) Cambiar el cron de `leyes-weekly` a `0 20 * * 1-5` (L-V) — la máquina ya es incremental. (4) Refrescar `parlamentario.fecha_captura` con un workflow que SÍ escriba a DB (nueva credencial o `seed:live` con service key), o mapear la fuente correcta. (5) `docs/crons.md` con la matriz — la fuente de verdad ya está en `packages/freshness/src/catalog.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ingesta programada (votos/tramitación) | GitHub Actions (cron) | CLI @obs/tramitacion | Repo público = minutos ilimitados; el escape-hatch de crawls largos |
| Ingesta lobby-camara (WAF) | Operador LOCAL (curl) | GitHub Actions (dispatch) | WAF bloquea IPs de datacenter de GH → transporte local |
| Frescura del roster (chip fichas) | DB write (service key) | seeder @obs/identity | El chip lee `parlamentario.fecha_captura` de la DB, no del git snapshot |
| Monitoreo de frescura | CLI `pnpm freshness` (read-only) | catalog.ts | Fuente única de verdad fuente→tabla→umbral→workflow |
| Guard fail-loud de cada cron | GitHub Actions step (grep) | — | Un `exit 1` visible, nunca un no-op verde silencioso |

## User Constraints (from ROADMAP Phase 83 / CLAUDE.md)

> No hay CONTEXT.md para Phase 83 aún. Constraints derivados del ROADMAP (Success Criteria) y de las reglas LOCKED de CLAUDE.md.

### Locked Decisions (ROADMAP Phase 83 + CLAUDE.md Conventions)
- **Ingesta en DOS ETAPAS** siempre: Fuente → R2 (crudo content-addressed) → Supabase. Re-ingesta lee de R2, nunca re-molesta la fuente.
- **Hash-check ANTES de descargar** (ETag/If-None-Match/sha256); salir temprano si no hay novedades.
- **Rate-limit 2-3s/host, User-Agent identificatorio (`Bot-Ciudadano/1.0`), robots.txt, caché diaria.** Nunca ráfagas. El `HostRateLimiter` del conector lo aplica — NO añadir sleeps en CI.
- **Cadencia de novedades = diario L-V** minimizando minutos: lotes acotados incrementales, solo novedades, hash-check primero. MONEY/SERVEL fuera del cron mientras estén gated.
- **Backfill masivo = LOCAL** (operador), NO GitHub Actions.
- **NUNCA relajar guards fail-loud**: si la fuente bloquea CI, el fallback es runbook local documentado, NO un skip silencioso (ROADMAP Phase 83 Autonomy).
- **Minutos ILIMITADOS** (repo público Cuchecorp/gov-map) → la restricción de "semanal para ahorrar minutos" ya no aplica.

### Claude's Discretion
- Cron expression exacta de la cadencia diaria (hora UTC).
- Cómo refrescar `parlamentario.fecha_captura` (nuevo workflow vs extender backup-parlamentario vs credencial).
- Formato exacto de `docs/crons.md`.
- Tamaño del lote diario (`--limite`) de leyes.

### Deferred Ideas (OUT OF SCOPE)
- `chilecompra-weekly.yml` / `servel-weekly.yml`: NO crear mientras MONEY esté gated (catalog los referencia como "n/d" honesto — comportamiento correcto).
- Resolver el WAF de camara.cl con self-hosted runner o proxy pagado (fuera de alcance; el fallback local es la respuesta).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEMO-02 (a) | lobby-camara + probidad reparados o fail-loud+runbook | ROOT CAUSE de ambos = path bug `process.cwd()`; lobby-camara ADEMÁS WAF (schedule ya OFF + runbook existe) |
| DEMO-02 (b) | votaciones/tramitación cadencia diaria L-V | `leyes-weekly` cron `0 20 * * 5` → `0 20 * * 1-5`; máquina round-robin YA existe (Phase 74) |
| DEMO-02 (c) | fuente de "Actualizado 20 jun" identificada + refresco | `parlamentario.fecha_captura` vía `parlamentario_publico`; ningún cron escribe ese campo a DB |
| DEMO-02 (d) | toda fuente visible con refresco mapeado (matriz en docs) | `packages/freshness/src/catalog.ts` = fuente de verdad; falta plumbear a `docs/crons.md` |

## Root Causes (VERIFICADOS)

### RC-1 — probidad-weekly: path bug `process.cwd()` (NO es la fuente, NO es el WAF)

`[VERIFIED: gh run view 29023003267 --log-failed]` — el log de la corrida del 2026-07-09 dice literalmente:

```
probidad-todos FALLÓ: ENOENT: no such file or directory, open
'/home/runner/work/gov-map/gov-map/packages/probidad/supabase/seeds/parlamentario.seed.json'
##[error]Process completed with exit code 1.
```

**Causa:** `packages/probidad/src/run-probidad-todos-cli.ts:86` hace `const root = process.cwd()` y luego `cargarMaestra` lee `join(root, "supabase", "seeds", "parlamentario.seed.json")` (línea 81). Pero el workflow lo invoca con `pnpm --filter @obs/probidad exec tsx …`, y `pnpm --filter … exec` **pone el cwd en el directorio del paquete** (`packages/probidad/`). Así busca `packages/probidad/supabase/seeds/…` que NO existe (el seed vive en la raíz `supabase/seeds/`). El `main().catch` (línea 160) hace `process.exit(1)` con 0 output de negocio → el guard `grep -qE 'consultados=[1-9]'` no encuentra nada → `exit 1` con el mensaje "0 parlamentarios consultados".

**Nota engañosa:** el mensaje del guard ("0 parlamentarios consultados — posible error fatal") sugiere una consulta que devolvió 0. Es un falso rastro: el proceso muere ANTES de consultar nada. `runProbidadTodos` devuelve `parlamentariosConsultados: objetivos.length` (línea 178) — si la maestra cargara, `consultados` sería ~155 aunque TODAS las queries SPARQL fallaran (los errores por-parlamentario son tolerados, no abortan). Un `consultados=0` real solo ocurre si la maestra tiene 0 filas → aquí la maestra ni se carga.

**Historial:** `[VERIFIED: gh run list]` probidad-weekly solo tiene 2 corridas (2026-07-02, 2026-07-09), AMBAS failure. El schedule (jueves) + el guard `consultados` se añadieron en commit `f1a5f7f` (57-03); el path bug es latente desde entonces — probidad-weekly **nunca** pasó en schedule.

**Fix:** `const root = findWorkspaceRoot(process.cwd())` (exportado de `packages/tramitacion/src/ingest-cli.ts:149` — sube hasta `pnpm-workspace.yaml`). Es EXACTAMENTE lo que `run-tramitacion-prod-cli.ts:180` y `run-votos-masivo-cli.ts:52` ya hacen — por eso leyes/votos están verdes y probidad no. Confianza HIGH.

### RC-2 — lobby-camara-weekly: WAF real + MISMO path bug latente

`[VERIFIED: lobby-camara-weekly.yml + gotcha v3/G7 audit]` — dos problemas apilados:

1. **WAF (bloqueante externo, ya diagnosticado):** `www.camara.cl` bloquea las IPs de datacenter de GH Actions. `curl -A 'Bot-Ciudadano/1.0'` devuelve <10KB (respuesta WAF intercept) → el step de descarga falla en el gate `if [ "$SIZE" -lt 10240 ]`. El schedule YA está DESHABILITADO (solo `workflow_dispatch`) desde Phase 56 con comentario explícito y runbook (`docs/runbooks/cron-local-fallback.md`).

2. **Path bug latente (NO diagnosticado antes):** `packages/lobby/src/run-camara-lobby-cli.ts:72` tiene el MISMO `const root = process.cwd()` que probidad (línea 65-68 lee `join(root, "supabase", "seeds", …)`). Como el WAF gate falla ANTES de llegar al CLI, este bug nunca se manifestó — pero si el operador confía en el dispatch manual y el WAF deja pasar un día, el CLI fallaría con el mismo ENOENT. Debe corregirse igual (fail cleanly cuando el WAF sí permite).

**Fix:** (a) mantener schedule OFF + runbook (correcto, no relajar); (b) corregir el path bug para que el dispatch manual funcione de verdad; (c) considerar mejorar el guard/alerta (el runbook ya existe y es bueno). El runbook `cron-local-fallback.md` ya documenta el flujo curl→`--html-file` y la re-habilitación del schedule.

### RC-3 — "Actualizado 20 jun · Senado": `parlamentario.fecha_captura` sin cron de escritura a DB

`[VERIFIED: parlamentario-header.tsx:28-30 + page.tsx:116 + seed-cli.ts:216,277-281]`

Cadena del chip:
- `app/components/parlamentario-header.tsx:28` → `capturedAt = parlamentario.fecha_captura`, `sourceName = sourceLabel(parlamentario.origen)` (Senado/Cámara), pasado a `<ProvenanceBadge>`.
- `app/app/parlamentario/[id]/page.tsx:116` → `getParlamentarioPublico` = RPC `parlamentario_publico` (security definer, lee la maestra `parlamentario`).
- El `fecha_captura` de la tabla `parlamentario` lo escribe el seeder de identidad (`upsertMaestra` → `SupabaseMaestraWriter`, `writer-supabase.ts`).

`seed-cli.ts:216` carga a DB SOLO si hay `SUPABASE_LOCAL_SERVICE_KEY`; sin esa credencial imprime "carga a DB OMITIDA (snapshot git sigue siendo autoritativo)" (línea 279). El único workflow que corre el seeder — `backup-parlamentario.yml` — NO le pasa `SUPABASE_LOCAL_SERVICE_KEY` (comentario en línea 60-61: "SIN service key local en CI → la carga a DB se omite; el snapshot git es autoritativo"). Solo commitea `parlamentario.seed.json` a git.

**Conclusión:** el roster de la DB (y por tanto el chip) se congeló en la última vez que el operador corrió `seed:live` LOCALMENTE con service key (~20 jun 2026). El staleness threshold es 14 días (`app/lib/format.ts:10`) → el chip lleva ámbar desde ~4 jul.

**Nota importante:** el `origen`="senado" y `fecha_captura` NO reflejan votaciones ni actividad del parlamentario — son el metadato de cuándo se re-sembró el ROSTER (catálogo XML Senado/Cámara). El chip es correcto semánticamente (procedencia del roster), pero está viejo porque nada lo refresca en la DB.

**Fix options (Claude's discretion):**
- **Opción A (recomendada):** nuevo step/workflow `roster-weekly` (o extender `backup-parlamentario.yml`) que corra `seed:live --preserve-estado` CON `SUPABASE_LOCAL_SERVICE_KEY` (mapeado desde `SUPABASE_SECRET_KEY`) → escribe `fecha_captura` fresca a DB, preservando la compuerta humana (`--preserve-estado`, sin `--promote`). Riesgo: `seed:live` re-siembra desde catálogos oficiales; `--preserve-estado` protege `confirmado` (seed-cli.ts:288-320, ya probado).
- **Opción B:** aceptar que el chip refleja la fecha del snapshot y refrescarlo con cadencia (mismo efecto que A). NO inventar una fecha.

## Standard Stack

No hay librerías nuevas. Todo el stack ya está en el repo (CLAUDE.md):

| Componente | Uso en Phase 83 | Estado |
|------------|-----------------|--------|
| `findWorkspaceRoot` (`@obs/tramitacion/ingest-cli.ts:149`) | Fix del path bug en 3 CLIs | YA EXISTE, exportado |
| `run-tramitacion-prod-cli` (round-robin `leyes_rotacion_estado`) | Cadencia diaria L-V (solo cambia cron) | YA EXISTE (Phase 74) |
| `packages/freshness/src/catalog.ts` (`CATALOG`) | Fuente de verdad fuente→tabla→umbral→workflow | YA EXISTE (9 fuentes) |
| `pnpm freshness` (`packages/freshness/src/cli.ts`) | Verificación post-fix (read-only) | YA EXISTE |
| `docs/runbooks/cron-local-fallback.md` | Runbook lobby-camara + gh secret cookbook | YA EXISTE |

**No hay instalación de paquetes externos → sin Package Legitimacy Audit necesario.**

## Architecture Patterns

### Los 9 workflows (inventario completo)

| Workflow | Entry-point CLI | Fuentes | Secrets | Schedule actual | Guard fail-loud | Estado |
|----------|-----------------|---------|---------|-----------------|-----------------|--------|
| `leyes-weekly` | `@obs/tramitacion run-tramitacion-prod-cli` | opendata.camara.cl (WS JSON) + Senado XML | SUPABASE_API_URL/SECRET_KEY, R2_* | `0 20 * * 5` (vie) | `exit(errores>0)` en CLI | ✅ VERDE |
| `agenda-weekly` | `@obs/agenda run-agenda-prod-cli` | Cámara (curl+DeepSeek PDF) + Senado citaciones | +DEEPSEEK_API_KEY, R2_* | `0 11 * * 1` (lun) | CLI exit | ✅ VERDE |
| `probidad-weekly` | `@obs/probidad run-probidad-todos-cli` | datos.cplt.cl/sparql (InfoProbidad/CPLT) | SUPABASE_*, R2_* | `0 11 * * 4` (jue) | `grep consultados=[1-9]` | ❌ FALLA (RC-1) |
| `lobby-camara-weekly` | `@obs/lobby run-camara-lobby-cli --html-file` | www.camara.cl transparencia (WAF) | SUPABASE_*, R2_* | dispatch-only (schedule OFF) | `SIZE<10KB exit 1` + `grep audiencias` | ⚠️ WAF (RC-2) |
| `lobby-leylobby-weekly` | `@obs/lobby ingest-cli` | leylobby.gob.cl (ejecutivo) | SUPABASE_URL/SERVICE_KEY (renombrados) | `0 11 * * 3` (mié) | `grep audiencias\|degradaciones` | ✅ VERDE |
| `backup-parlamentario` | `@obs/identity seed:live --preserve-estado` | Senado XML + Cámara XML (roster) | R2_* (gated), contents:write | `0 6 * * 1` (lun) | commit-si-cambió | ✅ VERDE (pero NO escribe DB → RC-3) |
| `fichas-backfill` | `@obs/fichas pipeline-cli` | fichas + embeddings Gemini | SUPABASE_*, DEEPSEEK, GEMINI, R2_* | dispatch-only | CLI | ⚙️ manual (correcto) |
| `backfill` | Deno DummyConnector | (M1, no fuentes reales) | SUPABASE_*, R2_* | dispatch-only | — | ⚙️ legacy manual |
| `deploy-cloudflare` | `pnpm run deploy` (OpenNext) | — | CLOUDFLARE_API_TOKEN/ACCOUNT_ID | dispatch-only | build | ⚙️ manual |

### Pattern: guard fail-loud correcto (LOCKED — no relajar)
**Qué:** cada cron de ingesta termina con un `grep -qE 'metrica=[1-9]' || { echo "…"; exit 1; }` que convierte "0 filas / crash silencioso" en un fallo visible.
**Regla LOCKED:** NUNCA cambiar el guard a `|| true` ni bajar el umbral. Si la fuente bloquea, la respuesta es runbook local, no un skip. (ROADMAP Phase 83 Autonomy.)
**Sutileza:** el guard de probidad es correcto EN PRINCIPIO — el problema es que el CLI muere antes de emitir la métrica. Reparar el CLI hace que el guard vuelva a ser significativo.

### Pattern: cadencia incremental round-robin (leyes → diario)
**Qué:** `boletinesARefrescar` (run-tramitacion-prod-cli.ts:104-176) prioriza agenda (actividad reciente) + rota una ventana del corpus con `leyes_rotacion_estado.offset_rotacion` (wrap-around, cursor persistido). `DEFAULT_LIMITE=80`.
**Diario:** al correr L-V en vez de solo viernes, cada día cubre agenda fresca + una rebanada nueva del corpus → el corpus completo rota más rápido Y "Votado esta semana" captura votos Mon-Jue el mismo día. No requiere cambio de CLI. `[VERIFIED: run-tramitacion-prod-cli.ts:53,104-176]`
**Cron:** `0 20 * * 5` → `0 20 * * 1-5` (L-V 20:00 UTC ≈ 16:00 CL, cierre de jornada parlamentaria). Considerar hora más temprana si se quiere el dato el mismo día laboral; 20:00 UTC ya es fin de tarde CL.

### Anti-Patterns to Avoid
- **`const root = process.cwd()` en un CLI invocado por `pnpm --filter exec`:** el cwd es el dir del paquete, no la raíz. SIEMPRE `findWorkspaceRoot(process.cwd())` para leer artefactos de la raíz (seed, migraciones). Es la causa raíz de RC-1 y RC-2.
- **Relajar el guard fail-loud** para "arreglar" un cron rojo: enmascara el problema. Arreglar la causa.
- **Inventar la fecha del chip** o llenar "Votado esta semana" con placeholders: PROHIBIDO (REQUIREMENTS Out of Scope). El tile se llena con la cadencia real.
- **Crear `chilecompra-weekly.yml`/`servel-weekly.yml`:** MONEY gated → la señal "n/d" del catalog es honesta, no un bug.

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|--------------|------|---------|
| Encontrar la raíz del repo desde un CLI | `path.join(__dirname, "../../..")` frágil | `findWorkspaceRoot(process.cwd())` (ya exportado) | Sube hasta `pnpm-workspace.yaml`; robusto ante cwd variable |
| Matriz fuente→workflow→cadencia | Un doc a mano que se desincroniza | Derivar de `packages/freshness/src/catalog.ts` (fuente única) | El catalog YA mapea 9 fuentes con tabla/columna/umbral/workflowYml |
| Rotación del corpus para no diluir frescura | Recorrer todo cada día | `leyes_rotacion_estado` cursor (Phase 74) | Wrap-around persistido; cobertura garantizada sin ráfaga |
| Verificar frescura post-fix | Queries SQL ad-hoc | `pnpm freshness` (read-only, exit 1 si stale) | Ya existe; umbrales por fuente |

## Runtime State Inventory (refactor/cron-health phase)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `parlamentario.fecha_captura` en DB congelado ~20 jun (RC-3); `leyes_rotacion_estado.offset_rotacion` (cursor rotación, se auto-avanza) | RC-3: workflow que escriba `fecha_captura` a DB (data refresh, no code) |
| Live service config | GH Actions schedules embebidos en los `.yml` (no en DB): `leyes` vie, `probidad` jue OFF-efectivo, `lobby-camara` dispatch-only | Editar cron expressions en los `.yml` + commit |
| OS-registered state | Ninguno — todo el scheduling es GH Actions cron, no OS-level | None — verificado: no hay Task Scheduler/systemd para estos crons |
| Secrets/env vars | `SUPABASE_LOCAL_SERVICE_KEY` NO cargado en backup-parlamentario (por diseño → RC-3); `lobby-leylobby` usa nombres DIVERGENTES `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` mapeados desde los secrets reales | RC-3 fix: mapear `SUPABASE_SECRET_KEY`→`SUPABASE_LOCAL_SERVICE_KEY` en el workflow de roster |
| Build artifacts | Ninguno relevante | None |

**El WAF de camara.cl NO es runtime state del repo** — es infraestructura externa; la respuesta es transporte local (runbook), no una migración.

## Common Pitfalls

### Pitfall 1: "El guard dice 0 consultados → la fuente devolvió 0"
**Qué sale mal:** asumir que probidad falla porque el SPARQL de CPLT cambió o devuelve vacío.
**Por qué:** el mensaje del guard es un falso rastro; el proceso muere en ENOENT antes de consultar. `[VERIFIED: log CI]`
**Cómo evitar:** leer el log completo (`gh run view <id> --log-failed`), no solo el mensaje del guard. La línea real es "probidad-todos FALLÓ: ENOENT … parlamentario.seed.json".
**Señal temprana:** el step tarda ~29s (setup+install+crash inmediato), no los ~6-10 min de un barrido SPARQL real.

### Pitfall 2: Reparar probidad pero dejar el mismo bug en lobby-camara y probidad-bienes
**Qué sale mal:** arreglar solo `run-probidad-todos-cli.ts` y dejar `run-camara-lobby-cli.ts:72` y `run-probidad-bienes-cli.ts:37` con `process.cwd()`.
**Cómo evitar:** grep `const root = process.cwd()` en `packages/**/*-cli.ts` y corregir los TRES. `[VERIFIED: grep]` los afectados son exactamente esos tres (los demás ya usan `findWorkspaceRoot` o `deps.root`).

### Pitfall 3: Poner leyes diario pero olvidar que MONEY/SERVEL deben quedar fuera
**Qué sale mal:** el cron diario barre tablas gated.
**Por qué:** ya está resuelto — `boletinesARefrescar` solo lee `citacion_punto`/`sesion_tabla_item`/`proyecto` (comentario línea 102). No hay riesgo, pero verificar que ningún cambio lo rompa.

### Pitfall 4: `lobby-leylobby` usa nombres de env DIVERGENTES
**Qué sale mal:** copiar el patrón de env de leyes a leylobby.
**Por qué:** `ingest-cli.ts` de lobby lee `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`, NO `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`. El workflow ya mapea (líneas 60-61). No tocar sin verificar el CLI.

## Code Examples

### Fix del path bug (los 3 CLIs)
```typescript
// packages/probidad/src/run-probidad-todos-cli.ts:86 (y run-camara-lobby-cli.ts:72, run-probidad-bienes-cli.ts:37)
// ANTES (roto en pnpm --filter exec):
const root = process.cwd();
// DESPUÉS (patrón probado en run-tramitacion-prod-cli.ts:180):
import { findWorkspaceRoot } from "@obs/tramitacion"; // o helper local equivalente
const root = findWorkspaceRoot(process.cwd());
```
Nota: `findWorkspaceRoot` vive en `@obs/tramitacion/ingest-cli`. Para evitar una dependencia cruzada probidad→tramitacion, puede replicarse el helper (12 líneas: sube hasta `pnpm-workspace.yaml`) en `@obs/core` o local. Decisión del planner.

### Cadencia diaria L-V (leyes-weekly.yml)
```yaml
# ANTES:
on:
  schedule:
    - cron: "0 20 * * 5"    # solo viernes
# DESPUÉS:
on:
  schedule:
    - cron: "0 20 * * 1-5"  # lunes a viernes (repo público = minutos ilimitados)
```
Considerar renombrar el workflow a `leyes-daily` (opcional; cosmético). El `concurrency.group` ya previene solapes.

### Roster refresh a DB (extender backup-parlamentario o nuevo workflow)
```yaml
# El seeder escribe fecha_captura a DB SOLO con SUPABASE_LOCAL_SERVICE_KEY (seed-cli.ts:216).
- name: Refrescar roster en DB (preservando compuerta humana)
  env:
    SUPABASE_LOCAL_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}  # mapeo clave
    SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
  run: pnpm --filter @obs/identity run seed:live -- --preserve-estado
  # SIN --promote: la promoción confirmado sigue siendo humana (ID-01).
```
Verificar que `seed:live` con service key remota apunte al REMOTO correcto y que `--preserve-estado` (seed-cli.ts:288) proteja `confirmado`. Riesgo MEDIO → validar en dispatch manual antes de programar.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace pnpm) |
| Config file | por paquete (`vitest.config.ts`); root `pnpm test` corre workspace |
| Quick run command | `pnpm --filter @obs/probidad test` (unit del CLI/run) |
| Full suite command | `pnpm test` (suite completa, ~820 al cierre v7.0) |
| Cron verify (LIVE) | `gh workflow run <wf>.yml --repo Cuchecorp/gov-map` + `gh run watch` |
| Freshness verify | `pnpm freshness` (read-only, exit 1 si stale) |

### Phase Requirements → Test/Verify Map
| Req | Behavior | Verify Type | Command / Evidence |
|-----|----------|-------------|--------------------|
| DEMO-02a probidad | corrida verde por dispatch | LIVE dispatch | `gh workflow run probidad-weekly.yml` → `gh run watch` → busca `consultados=[1-9]` |
| DEMO-02a probidad | path bug fijo | unit | test que ejercite `cargarMaestra` con cwd = dir de paquete (regresión) |
| DEMO-02a lobby-camara | fail-loud + runbook | doc + dispatch | runbook `cron-local-fallback.md` presente; dispatch manual llega al CLI (no ENOENT) |
| DEMO-02b leyes diario | cron L-V + incremental | dispatch + freshness | `gh workflow run leyes-weekly.yml`; `pnpm freshness` leyes verde; "Votado esta semana" con dato entre semana |
| DEMO-02c roster | `fecha_captura` fresca en DB | LIVE dispatch + UI | tras el workflow de roster, chip ficha Senado < 14d (no ámbar) |
| DEMO-02d matriz | docs/crons.md coherente con catalog | doc test | matriz ⊇ las 9 fuentes de `catalog.ts` |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/<pkg> test` + `tsc`.
- **Per wave merge:** `pnpm test` (suite completa).
- **Phase gate:** cada cron reparado corre VERDE por `workflow_dispatch` (evidencia `gh run`), `pnpm freshness` sin stale inesperado, suite verde.

### Wave 0 Gaps
- [ ] Test de regresión del path bug: un unit que invoque el resolver de root simulando cwd = `packages/<pkg>` y verifique que resuelve la raíz (evita reintroducir RC-1/RC-2).
- [ ] `docs/crons.md` — no existe (solo `cron-local-fallback.md`); crear con la matriz.
- Framework install: ninguno (vitest ya presente).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | inputs de workflow por ENV (no interpolados en shell) — patrón ya aplicado (leyes/probidad validan `LIMITE` entero); mantener |
| V6 Cryptography | no | — |
| V7 Error Handling/Logging | yes | secrets NUNCA en claro; `gh secret set` vía archivo/pipe (runbook §3); `error.message` propagado, nunca la service key (run-tramitacion:113) |
| V14 Config | yes | schedules en `.yml` versionados; `contents: read` por defecto (backup-parlamentario necesita `contents: write` para commit — mínimo necesario) |

### Known Threat Patterns
| Pattern | STRIDE | Mitigación |
|---------|--------|------------|
| Inyección de comando vía input de workflow | Tampering | Inputs por `env:` (no interpolación en `run:`); validación entero en el shell — YA aplicado |
| Fuga de service key en logs | Info Disclosure | Solo `error.message`; guards imprimen métricas, no credenciales; `SUPABASE_SECRET_KEY` como `***` en log CI |
| Roster refresh que baja `confirmado`→`no_confirmado` | Tampering (integridad) | `--preserve-estado` sin `--promote` (seed-cli.ts:288-320) — la compuerta humana ID-01 se preserva |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pnpm --filter <pkg> exec` pone cwd en el dir del paquete | RC-1/RC-2 | BAJO — el path ENOENT del log (`packages/probidad/supabase/…`) lo confirma directamente |
| A2 | Mapear `SUPABASE_SECRET_KEY`→`SUPABASE_LOCAL_SERVICE_KEY` hace que `seed:live` escriba a la DB REMOTA correcta | RC-3 fix | MEDIO — validar en dispatch manual que apunta al remoto (no a un local) antes de programar; `seed:live` fue diseñado para local |
| A3 | Cadencia diaria no excede tiempo/recursos de GH Actions con `--limite 80` | DEMO-02b | BAJO — la corrida semanal tardó ~23 min; una diaria acotada debería ser menor (menos boletines nuevos/día) |
| A4 | El WAF de camara.cl sigue bloqueando IPs de GH Actions (2026-07) | RC-2 | BAJO — diagnosticado 2026-06-30; sin evidencia de cambio. El operador puede reintentar dispatch para confirmar |

## Open Questions

1. **¿Refrescar el roster (RC-3) con backup-parlamentario extendido o un workflow nuevo?**
   - Lo que sabemos: `seed:live --preserve-estado` con service key escribe `fecha_captura` a DB y preserva `confirmado`.
   - Lo que no está claro: si el operador prefiere separar "backup a git" (sin creds) de "refresh DB" (con creds) por seguridad/blast-radius.
   - Recomendación: workflow separado `roster-weekly` con la service key, dejando `backup-parlamentario` intacto (git-only). Menor acoplamiento; el discuss-phase/operador decide.

2. **¿Hora del cron diario?**
   - Lo que sabemos: 20:00 UTC (16:00 CL) captura el cierre de jornada. Diario podría querer más temprano para que el dato aparezca el mismo día laboral.
   - Recomendación: mantener 20:00 UTC L-V (consistente con el sweet-spot actual); ajustable.

3. **¿`findWorkspaceRoot` compartido o replicado?**
   - Recomendación: replicar el helper (12 líneas) en `@obs/core` o local por CLI para evitar que probidad/lobby dependan de `@obs/tramitacion`. El planner decide según el grafo de deps.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gh` CLI (Cuchecorp/gov-map) | verificar/lanzar corridas | ✓ | autenticado | — |
| GitHub Actions (repo público) | crons diarios | ✓ | minutos ilimitados | — |
| `curl` en runner GH | lobby-camara descarga | ✓ | — | (bloqueado por WAF → local) |
| Supabase remoto (service key) | escritura roster/ingesta | ✓ (secrets en repo) | — | dry-run degradado |
| `pnpm`/Node 22 | todos los CLIs | ✓ | — | — |

**Missing con fallback:** lobby-camara vía GH Actions (WAF) → fallback runbook local (existe).
**Missing sin fallback:** ninguno bloqueante para code-side.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| leyes semanal (viernes) | diario L-V (repo público, minutos ilimitados) | Phase 83 | "Votado esta semana" fresco entre semana |
| Frescura por umbral fijo 48h | umbral por cadence (14d ficha, 7d leyes) | v6.x (format.ts:10) | menos falsos ámbar; pero roster congelado NO se refresca (RC-3) |
| `process.cwd()` en CLIs | `findWorkspaceRoot(process.cwd())` | v7.0 (tramitacion/votos) | probidad/lobby quedaron atrás → RC-1/RC-2 |

**Deprecado/pendiente:**
- probidad-weekly nunca pasó en schedule (bug latente desde 57-03) — no es una regresión reciente, es un cron que jamás funcionó en CI.

## Sources

### Primary (HIGH confidence)
- `gh run view 29023003267 --log-failed` (Cuchecorp/gov-map) — ENOENT parlamentario.seed.json en probidad-weekly — HIGH
- `gh run list --workflow=probidad-weekly.yml` — 2 corridas, ambas failure, desde 2026-07-02 — HIGH
- `.github/workflows/*.yml` (los 9, leídos completos) — schedules, secrets, guards, entry-points — HIGH
- `packages/probidad/src/run-probidad-todos-cli.ts:86` + `run-probidad-todos.ts:178` — path bug + semántica de `consultados` — HIGH
- `packages/lobby/src/run-camara-lobby-cli.ts:72` — mismo path bug latente — HIGH
- `packages/tramitacion/src/run-tramitacion-prod-cli.ts:180,104-176` — round-robin incremental + findWorkspaceRoot (patrón correcto) — HIGH
- `app/components/parlamentario-header.tsx:28-30` + `app/app/parlamentario/[id]/page.tsx:116` + `packages/identity/src/seed-cli.ts:216,277-281` — cadena del chip roster + write-gate — HIGH
- `packages/freshness/src/catalog.ts` — matriz fuente→tabla→umbral→workflow (9 fuentes) — HIGH
- `app/components/actualidad-module.tsx:233-278` — "Votado esta semana" = votacion WHERE fecha>=inicioSemanaIso — HIGH
- `docs/runbooks/cron-local-fallback.md` — runbook lobby-camara + gh secret cookbook (existe) — HIGH

### Secondary (MEDIUM confidence)
- CLAUDE.md Conventions (ingesta dos etapas, hash-check, rate-limit, cadencia diaria L-V) — reglas LOCKED del proyecto — HIGH como constraint

### Tertiary (LOW confidence)
- Estado actual del WAF camara.cl (2026-07) — no re-verificado en vivo esta sesión; A4 lo marca

## Metadata

**Confidence breakdown:**
- Root cause probidad (RC-1): HIGH — log de CI literal
- Root cause lobby-camara (RC-2): HIGH — WAF diagnosticado + path bug leído
- Root cause chip roster (RC-3): HIGH — cadena código completa (UI→RPC→seeder→write-gate)
- Cadencia diaria: HIGH — máquina round-robin ya existe, solo cambia cron
- Fix roster a DB: MEDIUM — mapeo de service key requiere validación en dispatch (A2)

**Research date:** 2026-07-15
**Valid until:** 2026-08-15 (estable; el único ítem volátil es el estado del WAF camara.cl)
