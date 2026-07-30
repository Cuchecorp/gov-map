# Phase 126: PANEL-GUARDS — Wave-0 de guards - Research

**Researched:** 2026-07-30
**Domain:** Guards estáticos de régimen (vitest sobre árbol `app/` + `supabase/migrations/`) — fase 100 % codebase-internal
**Confidence:** HIGH (todo verificado ejecutando la suite y leyendo el código; cero investigación web necesaria)

## Summary

Esta fase no introduce tecnología nueva: extiende un guard existente (`app/lib/anti-insinuacion-guard.test.ts`, 1.586 líneas, 42 tests) y crea un archivo guard dedicado nuevo (`app/lib/create-view-guard.test.ts`) siguiendo el molde establecido `*-antiflip-guard.test.ts`. Todo el detector que el carril PANEL necesita YA existe (`detectarInsinuaciones`, `detectarTerminos`, `buildTermRegex`, `stripTsComments`) y el trío `señal` / `exprés` / `los más` YA está en `TERMINOS_PROHIBIDOS` — el trabajo es *probar que muerden*, no agregarlos.

Baseline medido hoy (2026-07-30, corrida real): la suite `app/` completa está **VERDE en 107 archivos / 1.590 tests / 58 s**; los guards por nombre explícito (10 archivos) están **VERDES en 304 tests / 5,3 s**. `supabase/migrations/` tiene **77 archivos .sql, la última es `0079_limit_explicito_rpcs.sql`, y CERO ocurrencias de `create view` / `create materialized view` / `security_invoker`** — confirma D-04: el escaneo real es un cero vacuo y solo el control positivo apareado lo vuelve cero fuerte.

Hallazgo que el planner DEBE resolver (D-14): el criterio 4 habla de "14+ guards de régimen" pero en `app/` hay **10 archivos guard**, no 14. La cifra de 14+ solo cierra contando también los 6 guards de `packages/` (dinero ×3, llm ×3) → **16 archivos guard en el monorepo**. Alternativamente, los 10 archivos de `app/` contienen **42 bloques `describe`**. El plan debe documentar el conteo real elegido, jamás asumir 14.

**Primary recommendation:** 3 unidades de trabajo — (1) extender in-place `anti-insinuacion-guard.test.ts` (SUPERFICIES_PANEL + anti-drift + NEGACIONES_LOCKED + IDIOMS_APROBADOS + 2 tests de mutación), (2) crear `app/lib/create-view-guard.test.ts` con detector puro + control positivo apareado inline, (3) agregar script `guards` a `app/package.json` con los 10 (o 16) nombres explícitos. Cero dependencias nuevas, cero cambios de config.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Guard B-03 — create view sin security_invoker (DEBT-02)**
- **D-01:** Archivo dedicado `app/lib/create-view-guard.test.ts` (precedente `*-antiflip-guard.test.ts`), NO extender `lockdown-guard.test.ts`. Nombre explícito auditable; corre en `pnpm test` (CI ya corre la suite completa del workspace).
- **D-02:** Guard ESTÁTICO: detector puro `string SQL → violaciones[]` que escanea `supabase/migrations/*.sql`. Matchea `create [or replace] view` (y `create materialized view` — las matviews NO soportan `security_invoker` ⇒ toda matview en `public` es violación a decidir explícitamente vía allowlist vacía inicial). Solo schema `public` (no calificado o `public.`-calificado).
- **D-03:** Control positivo apareado = tests unitarios del detector con fixtures STRING inline: fixture de vista sin `security_invoker` → detector reporta; misma vista con `security_invoker = true` (u `on`) → verde. JAMÁS un archivo .sql fixture dentro de `supabase/migrations/` (contaminaría el ledger y la numeración).
- **D-04:** Hoy hay CERO views en migrations (verificado por grep 2026-07-30) — el cero del escaneo real es vacuo; el control positivo del detector es lo que lo hace no-vacuo. Ambos asserts en el mismo archivo.

**SUPERFICIES_PANEL — alta preventiva + anti-drift (PANEL-08)**
- **D-05:** Prefijo de naming CONGELADO para todo componente nuevo del rediseño del panel: `components/panel-*.tsx`. La Phase 128 DEBE nombrar sus archivos con ese prefijo (regla escrita para el planner de 128).
- **D-06:** Alta preventiva ahora (el loader TOLERA archivos faltantes — try/catch continue, patrón Wave-0 Phase 100): `components/panel-tile-sala.tsx`, `panel-tile-comisiones.tsx`, `panel-tile-urgencias.tsx`, `panel-tile-movimiento.tsx`, `panel-tile-votaciones.tsx`, `panel-tile-ingresos.tsx`, `panel-item-proyecto.tsx`. `components/panel-actualidad.tsx` YA está declarado — no duplicar (Pitfall 4 DEDUPE).
- **D-07:** Assert anti-drift NUEVO en el guard: todo archivo REAL del filesystem que matchee `app/components/panel-*.tsx` debe estar declarado en `SUPERFICIES_PANEL` (glob del fs comparado contra el array). Cierra el hueco "archivo nuevo con nombre imprevisto se salta el scan". Si 128 crea un archivo fuera de la lista D-06 pero con prefijo `panel-`, el guard muerde y obliga el alta en el mismo commit.
- **D-08:** El helper central de links internos (Phase 128, PANEL-02) NO entra a SUPERFICIES_PANEL: emite hrefs, no copy renderizado. Si termina emitiendo labels visibles, 128 lo suma (el anti-drift D-07 no lo cubre — vive en `lib/`; regla anotada para el plan de 128).

**NEGACIONES_LOCKED + idioms aprobados (PANEL-08)**
- **D-09:** Doble registro: (a) los stems FIJOS de los 4 idioms (`Citado el`, `vigente desde`, `En tabla de sala de la Cámara del`, `según fuente al`) entran a `NEGACIONES_LOCKED` con comentario "idiom aprobado v13.0 — no niega término prohibido; registrado por mandato PANEL-08" (satisface el criterio verbatim; la resta es inocua porque ningún stem contiene término prohibido); (b) export single-source `IDIOMS_APROBADOS` en el mismo guard para que 128 los importe verbatim.
- **D-10:** Self-check de no-hueco (criterio 2): (i) assert de que NINGÚN idiom/stem contiene término de `TERMINOS_PROHIBIDOS` (si un idiom futuro lo contuviera, el registro exige decisión explícita); (ii) mutation: fixture que contiene un idiom + término prohibido inyectado adyacente → `detectarInsinuaciones` SIGUE reportando (la resta del stem no enmascara). Cubre el riesgo real de toda entrada nueva a NEGACIONES_LOCKED: resta amplia que rompa una frase prohibida multi-palabra.
- **D-11:** Los stems se registran SIN las partes variables (fechas/grados) — literales fijos exactos. El detector normaliza whitespace antes de restar (mecánica existente IN-03), así que JSX line-wrapped calza.

**Mutation self-check carril PANEL (criterio 1)**
- **D-12:** Extender el mutation self-check existente (Test 2 del guard) con el trío explícito del criterio: `señal`, `exprés`, `los más` inyectados en fixture representativo de superficie panel → cada uno produce FAIL del detector. Los tres YA están en TERMINOS_PROHIBIDOS (carriles VSIM/PANEL) — el self-check prueba que MUERDEN, no los re-agrega.

**Runner por nombre explícito (criterio 4)**
- **D-13:** Script `pnpm guards` en `app/package.json` con la lista EXPLÍCITA de archivos guard (`vitest run lib/anti-insinuacion-guard.test.ts lib/lockdown-guard.test.ts lib/create-view-guard.test.ts …` — los 14+ por nombre). Mata el glob-trap (`vitest run lib/*guard*.test.ts` sale 0 sin correr nada — gotcha v12 §9 pagado). La verificación de la fase usa ese script + `pnpm test` completo.
- **D-14:** El plan debe contar los guards de régimen existentes (14+ según v12) y listar cada nombre en el script; si el conteo real difiere del esperado, documentarlo — jamás "los que matchee el glob".

### Claude's Discretion
- Forma exacta del detector B-03 (regex vs statement-split) — decisión del executor mientras el control positivo apareado pase y no haya falsos positivos sobre comentarios SQL (strip de `--` y `/* */` antes de matchear, precedente stripTsComments).
- Ubicación del assert anti-drift D-07 (dentro de anti-insinuacion-guard.test.ts junto a SUPERFICIES_PANEL, recomendado) vs archivo aparte.

### Deferred Ideas (OUT OF SCOPE)
- Guard equivalente B-03 contra la DB viva (pg_views de PROD) — valor marginal mientras las views solo puedan nacer por migración; si algún día se crea una view fuera del ledger, eso es deuda de operador, no de guard estático.
- Sumar `lib/links-internos.ts` (helper 128) al scan si emite labels visibles — decisión anotada para el plan de 128 (D-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-08 | (Wave-0): guards ANTES del copy — todo archivo nuevo del rediseño alta en `SUPERFICIES_PANEL` antes de escribir copy; `NEGACIONES_LOCKED` extendido con los idioms nuevos; carril PANEL del linter verde (prohibidos `señal`, `exprés`, `los más`, …). | §Mapa exacto de `anti-insinuacion-guard.test.ts` (líneas y excerpts), §Verificación de idioms vs TERMINOS_PROHIBIDOS, §Patrón loader-tolera-faltantes, §Anti-drift D-07 (baseline real de `components/panel*`) |
| DEBT-02 | (**B-03**): Aserción de guard para `create view` en `public` sin `security_invoker` existe ANTES de la primera vista del milestone (hoy cero vacuo), con control positivo apareado que demuestre que mordería. | §Cero verificado en migrations, §Patrón de escaneo de migraciones (lockdown Bloque A: `MIGRATIONS_DIR`, `stripSqlComments`, `migrationNumber`), §Molde de guard dedicado (`vsim-antiflip-guard.test.ts`) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Linter anti-insinuación (copy renderizado) | Test estático en `app/lib/` (vitest, node fs) | — | Lee `.tsx` del filesystem; jamás importa componentes ni toca red/DB |
| Anti-drift de superficies panel | Test estático en `app/lib/` (readdir sobre `app/components/`) | — | Comparación fs-glob vs array declarado; puro filesystem |
| Guard `create view` sin `security_invoker` | Test estático en `app/lib/` que lee `../supabase/migrations/*.sql` | — | Molde `lockdown-guard.test.ts` Bloque A: `app/` es el único workspace con runner de guards en CI |
| Runner por nombre explícito | `app/package.json` script | CI (`.github/workflows/ci.yml` corre `pnpm --filter ./app test -- --run`) | El guard nuevo entra a CI gratis vía la suite completa; el script `guards` es la herramienta de verificación local/fase |

## Standard Stack

Sin dependencias nuevas. Todo el trabajo usa lo ya instalado.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.6 (devDep de `app/`) | Runner de todos los guards | [VERIFIED: app/package.json + corrida real 2026-07-30] Ya es el runner de los 107 archivos de test de `app/` |
| node:fs (`readFileSync`, `readdirSync`, `statSync`) | built-in Node 22 | Lectura de superficies y migraciones | [VERIFIED: código] Patrón idéntico en los 10 guards existentes |
| node:path | built-in | Resolución de rutas | [VERIFIED: código] |

**Installation:** ninguna. `pnpm install` no cambia; `pnpm-lock.yaml` no se toca.

## Package Legitimacy Audit

**No aplica** — esta fase NO instala ningún paquete externo. Cero altas en `app/package.json` `dependencies`/`devDependencies`; el único cambio a ese archivo es un script nuevo (`guards`).

## Architecture Patterns

### Diagrama de flujo (los tres guards de la fase)

```
                         ┌──────────────────────────────────────────┐
  app/components/*.tsx ──▶│ TODAS_LAS_SUPERFICIES (union DEDUPE)     │
  (copy renderizado)      │  ← SUPERFICIES_PANEL (+7 rutas D-06)     │
                          └───────────────┬──────────────────────────┘
                                          │ readFileSync (try/catch continue)
                                          ▼
                          ┌──────────────────────────────────────────┐
                          │ detectarInsinuaciones(raw)               │
                          │  1. stripTsComments                      │
                          │  2. .replace(/\s+/g," ")  (IN-03)        │
                          │  3. resta NEGACIONES_LOCKED (+4 idioms)  │
                          │  4. buildTermRegex por TERMINOS_PROHIBIDOS│
                          └───────────────┬──────────────────────────┘
                                          ▼  offenders[]  → expect(...).toHaveLength(0)

  fixture STRING en memoria ─▶ detectarInsinuaciones ─▶ DEBE contener
     (señal / exprés / los más)                          → prueba que MUERDE (D-12)

  readdirSync(app/components) ─▶ filtro /^panel-.*\.tsx$/ ─▶ ⊆ SUPERFICIES_PANEL  (anti-drift D-07)

  ../supabase/migrations/*.sql ─▶ stripSqlComments ─▶ detectarViewsSinInvoker()
                                                          │
     fixture STRING sin security_invoker ─────────────────┤─▶ [violación]  (control positivo)
     fixture STRING con security_invoker = true ──────────┘─▶ []           (control negativo)
```

### Pattern 1: Guard estático con detector PURO + mutation self-check
**What:** Toda la lógica de detección vive en una función pura `string → string[]`; los tests del filesystem la aplican al árbol real y los tests de mutación la aplican a fixtures inline en memoria.
**When to use:** Siempre en este repo — es el molde de los 10 guards existentes. Sin el mutation self-check, un guard verde es indistinguible de un no-op.
**Example (molde real, `vsim-antiflip-guard.test.ts` L18-26):**
```
 * La lógica de detección vive en helpers PUROS (`detectarRelajacionGate`,
 * `detectarRawEnvEnRuta`) para poder ejercerlos EN MEMORIA en el mutation
 * self-check (§4) — así el guard prueba que MUERDE y no es un no-op verde.
```
Estructura de `describe` del molde (`vsim-antiflip-guard.test.ts`): `(1) Vector 1 …` L240, `(2) Vector 2 …` L260, `(3) Vector 3 …` L271, `(4) Mutation self-check — el guard MUERDE ante cada relajación` L337. `create-view-guard.test.ts` debe copiar esa forma: bloque(s) de escaneo real + bloque final de mutación.

### Pattern 2: Resolución de rutas — `import.meta.dirname`, NO `process.cwd()`
**What:** `anti-insinuacion-guard.test.ts` L64-67:
```ts
// WR-06: anclar a import.meta.dirname (este archivo vive en app/lib/) en lugar de
// process.cwd() para evitar el bug conocido donde pnpm --filter exec cambia cwd
// y el guard escanea cero archivos silenciosamente (memory: v8.1 bug process.cwd).
const APP_ROOT = path.resolve(import.meta.dirname, "..");
```
**Ojo:** `lockdown-guard.test.ts` L43 usa el patrón VIEJO (`const APP_ROOT = process.cwd();`) y de ahí deriva `REPO_ROOT`/`MIGRATIONS_DIR` (L44-46). **`create-view-guard.test.ts` debe usar `import.meta.dirname`**, no copiar el `process.cwd()` de lockdown:
```ts
const APP_ROOT = path.resolve(import.meta.dirname, "..");   // app/
const REPO_ROOT = path.resolve(APP_ROOT, "..");             // monorepo root
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
```
[VERIFIED: código leído, ambos archivos]

### Pattern 3: Sanity assert anti-cero-vacuo del escaneo
**What:** Todo guard de escaneo lleva un assert de que el conjunto escaneado NO está vacío. Precedentes:
- `anti-insinuacion-guard.test.ts` L883-897: dos `it("sanity: …")` que leen un archivo concreto y exigen `length > 100`.
- `lockdown-guard.test.ts` L368: `expect(futureMigrations.length).toBeGreaterThan(0);` y L623: `expect(definedRpcNames(MIGRATIONS_DIR).size).toBeGreaterThan(20);`

**Aplicación a B-03:** el guard debe afirmar que leyó ≥ N archivos `.sql` (hoy 77) antes de afirmar cero violaciones. Sin ese assert, un `MIGRATIONS_DIR` mal resuelto daría verde escaneando cero archivos.

### Pattern 4: Strip de comentarios SQL antes de matchear
`lockdown-guard.test.ts` L64-70:
```ts
/** Eliminar lineas que son comentarios SQL (comienzan con --) para no contar prosa */
function stripSqlComments(content: string): string {
  return content
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}
```
**Limitación conocida:** NO strippea bloques `/* … */` ni comentarios `--` a mitad de línea. El CONTEXT (Claude's Discretion) pide strip de `--` **y** `/* */` para B-03 ⇒ el detector nuevo necesita su propia versión (module-local, NO importar de lockdown — los guards no se importan entre sí; `vsim-antiflip-guard` documenta explícitamente "Reproduce `walkSourceFiles`/`SKIP_DIRS` (no los importa; son módulo-local)").

### Anti-patterns to avoid
- **Glob en el runner:** `vitest run lib/*guard*.test.ts` — la shell de PowerShell/Windows no expande el glob, vitest lo trata como filtro literal, y con `passWithNoTests: true` (verificado en `app/vitest.config.ts`) sale **0 sin correr nada**. Gotcha v12 §9 pagado. Nombres explícitos siempre.
- **Fixture .sql dentro de `supabase/migrations/`** (prohibido por D-03): contaminaría el ledger y la numeración (0080 está reservada para 127).
- **Importar el componente en el guard:** los guards LEEN el archivo con `readFileSync`, jamás lo importan (evita el runtime de Next/server-only).
- **Re-agregar términos ya presentes** (Pitfall 4 DEDUPE, documentado en el propio archivo L710-718 y L575-577).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Matchear términos con tilde y límite de palabra | Regex `\b` propio | `buildTermRegex` (L804-809) | `\b` de JS trata los acentos como no-palabra; el helper usa lookarounds sobre `WORD = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_"` (L802) |
| Restar leyendas que niegan términos | Lógica nueva | `detectarInsinuaciones` (L861-876) | Ya normaliza whitespace (fix IN-03) antes de restar `NEGACIONES_LOCKED` |
| Escanear un subconjunto de términos | Copia del detector | `detectarTerminos(raw, terminos)` (L853-859) | Mismo strip + misma resta, lista restringida |
| Strip de comentarios TS/JSX | `replace` ad-hoc | `stripTsComments` (L79-91) | Ya cubre el edge `://` de URLs (falso negativo WR-05) |
| Tolerancia a archivos aún inexistentes | `existsSync` previo | `try { readFileSync } catch { continue }` (L907-913) | Patrón Wave-0 LOCKED — la ausencia es legítima hasta que 128 cree el archivo |

**Key insight:** el carril PANEL no necesita UNA sola línea de detector nuevo. Todo el trabajo de PANEL-08 es *datos* (2 arrays extendidos) + *asserts* (mutación, no-hueco, anti-drift).

## Mapa exacto de `app/lib/anti-insinuacion-guard.test.ts` (1.586 líneas, 42 tests)

| Símbolo | Línea | Nota para el planner |
|---------|-------|----------------------|
| `APP_ROOT` (`import.meta.dirname`) | 67 | Patrón WR-06 |
| `stripTsComments` | 79-91 | Skips `://` |
| `SUPERFICIES_VOTO` … `SUPERFICIES_DEEPLINK` | 103, 127, 148, 163, 187, 220, 264, 282 | Carriles previos |
| **`SUPERFICIES_PANEL`** | **308-311** | JSDoc L287-307 documenta explícitamente el tripwire y dice *"Si el panel se divide en sub-tiles (p.ej. `panel-tile-senal.tsx`), esos archivos se SUMAN a este array"* — D-06 es exactamente lo previsto |
| `SUPERFICIES_RELACIONES` / `_VSIM` / `_NOTIF` / `_LINK_EXT` / `_FECHA` | 342, 370, 403, 450, 492 | — |
| `TERMINOS_LINK_EXT` | 547-556 | 8 términos, spread en la lista global |
| `TERMINOS_COBERTURA` | 583-590 | 6 términos, spread |
| **`TERMINOS_PROHIBIDOS`** | **601-735** | Carril PANEL en **L678-708**; `señal` en **L725** (carril VSIM); `exprés` **L701**; `los más` **L708** |
| **`NEGACIONES_LOCKED`** | **743-790** | Mezcla de literales string y constantes importadas (`LEYENDA_*`); último elemento es un literal (L789) |
| `WORD` / `buildTermRegex` / `escapeRegex` | 802 / 804-809 / 811-813 | — |
| `TODAS_LAS_SUPERFICIES` | 829-846 | Union `Set` de los 14 arrays de carril |
| `detectarTerminos` | 853-859 | — |
| `detectarInsinuaciones` | 861-876 | — |
| describe `(1)` escaneo real | 882-1107 | Incluye `(1b)` L928, `(1c)` cobertura de carriles L957, `(1d)` idioms FECHA L999, `(1e)` cobertura lobby L1066 |
| **describe `(2)` Mutation self-check — el guard SÍ muerde** | **1110-1455** | it PANEL existente en **L1273-1299** (caza `exprés`/`de madrugada`/`reactivado`/`la cámara más activa`) |
| describe `(3)` Sin falsos positivos | 1456-fin | Molde para el assert de no-hueco de idioms |

**Excerpt clave — el bucle tolerante (L905-917)** que hace posible la alta preventiva D-06:
```ts
for (const rel of TODAS_LAS_SUPERFICIES) {
  const full = path.join(APP_ROOT, rel);
  let raw: string;
  try { raw = readFileSync(full, "utf-8"); }
  catch { continue; }                    // ausencia legítima
  for (const term of detectarInsinuaciones(raw)) offenders.push(`${rel} → "${term}"`);
}
```

**Excerpt clave — el it PANEL de mutación a extender (L1273-1298)**, `it("PANEL (100): caza timing insinuante inyectado (exprés / de madrugada) sobre lo NUEVO", …)`: fixture string inline + `expect(hits, "…sería un no-op").toEqual(expect.arrayContaining([...]))`. D-12 se implementa como un `it` HERMANO nuevo (p. ej. `it("PANEL (126): caza el trío del criterio 1 — señal / exprés / los más …")`) con la misma forma, dentro del mismo `describe (2)`.

**Nota `(1c)` (L957-…):** el test verifica que `TODAS_LAS_SUPERFICIES` incluye cada carril. Extender `SUPERFICIES_PANEL` no lo rompe (PANEL ya está en la union, L839). No hace falta tocar la union.

## Inventario de guards de régimen (D-14 — CONTEO REAL)

### `app/` — 10 archivos, 304 tests, TODOS VERDES [VERIFIED: corrida `npx vitest run <10 nombres>` 2026-07-30, 5,30 s]

| # | Archivo | Tests | Qué guarda | describes |
|---|---------|-------|-----------|-----------|
| 1 | `lib/anti-insinuacion-guard.test.ts` | 42 | Vocabulario de insinuación en copy renderizado (14 carriles) | 3 |
| 2 | `lib/lockdown-guard.test.ts` | 35 | Bloque A migraciones (anon/grants/policies), B árbol PII, D/E `authenticated`, A2/A3 allowlist RPC | 10 |
| 3 | `lib/bento-guards.test.ts` | 114 | cero-hex, tipografía, cero-bare-var-shorthand | 6 |
| 4 | `lib/vsim-antiflip-guard.test.ts` | 20 | Anti-flip gate `VSIM_PUBLIC_ENABLED` | 4 |
| 5 | `lib/money-antiflip-guard.test.ts` | 20 | Anti-flip gate MONEY | 4 |
| 6 | `lib/notif-antiflip-guard.test.ts` | 20 | Anti-flip gate NOTIF | 4 |
| 7 | `lib/env-example-guard.test.ts` | 16 | `.env.example` coherente / sin secretos | 2 |
| 8 | `lib/name-match-rut-guard.test.ts` | 15 | Match nombre↔RUT (PII) | 5 |
| 9 | `lib/bento-coherencia-guard.test.ts` | 8 | Coherencia de tokens bento | 2 |
| 10 | `components/co-votacion-red-guard.test.ts` | 14 | `co_votacion` ∉ superficie `/red` | 2 |

### `packages/` — 6 archivos más (fuera del runner de `app/`)
`packages/dinero/src/name-match-rut-guard.behavior.test.ts`, `packages/dinero/src/reconciler-frozen-guard.test.ts`, `packages/dinero/src/servel-frozen-guard.test.ts`, `packages/llm/src/integ-scope-guard.test.ts`, `packages/llm/src/provider-guard.test.ts`, `packages/llm/src/tiered-scope-guard.test.ts`.

**Resolución para D-14/criterio 4:** "14+" NO calza con `app/` solo (10). Calza como **16 archivos guard en el monorepo** (10 app + 6 packages) o como **42 `describe` de guard en `app/`**. Recomendación: el script `pnpm guards` de `app/package.json` lista los **11** nombres de `app/` (los 10 + `lib/create-view-guard.test.ts`), y el plan **documenta explícitamente** la discrepancia y los 6 de `packages/` (que CI ya corre por separado: ci.yml corre `pnpm --filter @obs/llm exec vitest run`). Jamás afirmar "14" sin decir qué se contó.

## Runner y CI [VERIFIED: archivos leídos + corridas]

- `app/package.json` scripts hoy: `dev, build, start, lint, test ("vitest run"), typecheck, preview, deploy, upload, cf-build, cf-typegen`. **NO existe script `guards`** → D-13 es un alta limpia.
- `package.json` raíz: `"test": "pnpm -r --filter \"./packages/*\" test && pnpm --filter ./app test"`.
- `app/vitest.config.ts`: `environment: "jsdom"`, `globals: true`, `include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"]`, `setupFiles: ["./vitest.setup.ts"]`, **`passWithNoTests: true`**.
  - ⇒ **`app/lib/create-view-guard.test.ts` es recogido automáticamente por `pnpm test`.** Cero cambios de config necesarios.
  - ⇒ `passWithNoTests: true` es la razón mecánica del glob-trap: un patrón que no matchea nada sale 0. Confirma D-13.
- `.github/workflows/ci.yml` L44-48: `run: pnpm --filter ./app test -- --run` ⇒ el guard nuevo entra a CI gratis, sin secrets (los guards son estáticos).

### Baseline medido (pre-cambio, 2026-07-30)
| Corrida | Resultado |
|---------|-----------|
| `npx vitest run` en `app/` (suite completa) | **107 archivos / 1.590 tests / VERDE / 58,3 s** |
| `npx vitest run <10 guards por nombre>` | **10 archivos / 304 tests / VERDE / 5,3 s** |

Coincide con la memoria v12 ("suite 1590, lockdown 22→35"): `lockdown-guard` = 35 tests hoy.

## Guard B-03 — evidencia y patrón

### Estado del árbol de migraciones [VERIFIED: grep 2026-07-30]
| Hecho | Valor |
|-------|-------|
| Archivos `supabase/migrations/*.sql` | **77** |
| Última migración | `0079_limit_explicito_rpcs.sql` (0080 reservada para Phase 127) |
| `grep -rniE "create +(or +replace +)?(materialized +)?view"` | **0 hits** |
| `grep -rniE "security_invoker\|matview\|materialized"` | **0 hits** |

⇒ D-04 confirmado: cero real, cero vacuo. El control positivo apareado es lo único que lo convierte en cero fuerte.

### Patrón de escaneo de migraciones (de `lockdown-guard.test.ts`, a REPRODUCIR no importar)
- `MIGRATIONS_DIR` L46; `migrationNumber` L58-62 (parse de prefijo `^(\d+)_`); `stripSqlComments` L64-70.
- Bloque A L322-361: `readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).filter(numero > cutoff).sort()`, luego por archivo `readFileSync` → `stripSqlComments(raw).toLowerCase()` → regex → `offenders.push(filename)` → `expect(offenders, "<mensaje accionable>").toHaveLength(0)`.
- **Decisión pendiente para el planner:** ¿cutoff numérico (como el `LOCKDOWN_CUTOFF = 44` de lockdown) o TODAS las migraciones? Con 0 views hoy en las 77, escanear **todas** es gratis y estrictamente más fuerte — recomendado, sin cutoff.
- Mensaje de `expect` con instrucción accionable (todos los guards lo hacen): el fallo debe decir "añade `with (security_invoker = true)` o justifica la matview en el allowlist vacío".

### Forma sugerida del detector (Claude's Discretion — no locked)
```
detectarViewsSinInvoker(sql: string): string[]
  1. strip comentarios `--` (línea, incluso a mitad de línea) y bloques /* */
  2. split por `;` en sentencias
  3. por sentencia: /^\s*create\s+(or\s+replace\s+)?(materialized\s+)?view\s+(public\.)?[\w"]+/i
  4. si es matview → violación siempre (no soporta security_invoker)
  5. si es view → verde solo si la MISMA sentencia contiene
     /with\s*\(\s*[^)]*security_invoker\s*=\s*(true|on)/i
  6. schema: solo no-calificado o `public.` (ignorar otros schemas)
```
Ojo con `$$ … $$` (cuerpos de función) al split por `;` — los 77 archivos tienen funciones `plpgsql`; un split ingenuo por `;` parte cuerpos de función pero eso NO genera falsos positivos aquí (ningún fragmento empieza por `create view`). Aceptable; el control positivo lo prueba.

## Verificación de los idioms D-09 vs `TERMINOS_PROHIBIDOS` [VERIFIED: cotejo manual contra la lista completa L601-735 + los 2 spreads]

| Stem del idiom | ¿Contiene término prohibido? | Análisis |
|----------------|------------------------------|----------|
| `Citado el` | **NO** | Ningún término empieza por "citad" |
| `vigente desde` | **NO** | "vigente"/"desde" ausentes de la lista |
| `En tabla de sala de la Cámara del` | **NO** | Los únicos términos con "cámara" son `mediana de su cámara` y `la cámara más activa` — ambos multi-palabra contiguos que NO calzan en este stem (`de la Cámara del` ≠ `la cámara más activa`) |
| `según fuente al` | **NO** | Ningún término de las 3 listas |

⇒ El assert D-10(i) pasará hoy. **Debe implementarse igual** (es el tripwire para el 5º idiom del futuro).

**Riesgo real de toda entrada nueva a NEGACIONES_LOCKED** (lo que D-10(ii) cubre): la resta es `texto.split(negNorm).join(" ")` (L869) — sustituye por un espacio, así que NO puede *fabricar* un match; pero SÍ podría *borrar* una porción de una frase prohibida multi-palabra si el stem la solapara. Ninguno de los 4 stems solapa. El test de mutación (idiom + término prohibido adyacente → sigue reportando) es la prueba viva.

## Baseline anti-drift D-07 [VERIFIED: `ls app/components/panel*` 2026-07-30]

Archivos REALES hoy:
- `app/components/panel-actualidad.tsx` ✅ ya declarado en `SUPERFICIES_PANEL` L309
- `app/components/panel-actualidad.test.tsx` ⚠️ **archivo de TEST con prefijo `panel-`**

⇒ **El filtro del anti-drift DEBE excluir `*.test.tsx` / `*.test.ts`**, o el guard fallará en el commit mismo que lo introduce (falso positivo inmediato). Regex sugerida: `/^panel-.*\.tsx$/` **y** `!/\.test\.tsx?$/`. Este es el pitfall #1 de la fase.

## Common Pitfalls

### Pitfall 1: el anti-drift caza `panel-actualidad.test.tsx`
**Qué falla:** `readdirSync` + filtro `panel-*.tsx` incluye el archivo de test existente → guard rojo al nacer.
**Cómo evitar:** excluir `.test.ts(x)` en el filtro. **Señal temprana:** el guard falla en su primera corrida con un solo offender terminado en `.test.tsx`.

### Pitfall 2: glob-trap del runner
**Qué falla:** `vitest run lib/*guard*.test.ts` sale 0 sin correr nada (`passWithNoTests: true` verificado en la config).
**Cómo evitar:** D-13 — nombres explícitos. **Verificación:** el output del script debe imprimir `Test Files 11 passed (11)`; si dice `(0)` o `no test files found`, es el trap.

### Pitfall 3: cero vacuo en B-03
**Qué falla:** el escaneo de 77 .sql da 0 violaciones y parece cumplido — pero también daría 0 con `MIGRATIONS_DIR` mal resuelto o con un regex roto.
**Cómo evitar:** (a) control positivo apareado con fixtures inline (D-03), (b) assert de que se leyeron ≥ 70 archivos `.sql` (precedente L368/L623).

### Pitfall 4: DEDUPE
**Qué falla:** re-agregar `señal`/`exprés`/`los más` a `TERMINOS_PROHIBIDOS` (ya están: L725/L701/L708) o re-declarar `components/panel-actualidad.tsx` en `SUPERFICIES_PANEL` (ya está: L309).
**Cómo evitar:** D-06/D-12 lo dicen explícitamente; el `Set` de `TODAS_LAS_SUPERFICIES` absorbe duplicados de rutas silenciosamente (no falla, pero ensucia).

### Pitfall 5: tildes exactas
`buildTermRegex` NO es accent-insensitive (documentado L680-681). `exprés`, `señal`, `según`, `Cámara` deben tipearse con tilde exacta en fixtures y stems.

### Pitfall 6: `process.cwd()` heredado
Copiar el header de `lockdown-guard.test.ts` arrastra `APP_ROOT = process.cwd()` (L43), que bajo `pnpm --filter exec` escanea cero archivos en silencio (bug v8.1). Usar `import.meta.dirname` (patrón WR-06, L64-67 de anti-insinuacion).

### Pitfall 7: `grep -c` en verificación
Gotcha v12: `grep -c` topa en 1 sobre archivos de una línea. Para verificar la fase, usar `grep -o … | wc -l` o los asserts del propio guard, no conteos de grep.

## Code Examples

### Alta preventiva en `SUPERFICIES_PANEL` (extensión de L308-311)
```ts
const SUPERFICIES_PANEL: string[] = [
  "components/panel-actualidad.tsx",
  // v13.0 (126, PANEL-08) — alta PREVENTIVA de los 6 tiles + el item de proyecto
  // del rediseño (Phase 128). El loader TOLERA archivos faltantes (try/catch
  // continue, L907-913) → verde hoy, MUERDE en cuanto 128 cree cada archivo.
  "components/panel-tile-sala.tsx",
  "components/panel-tile-comisiones.tsx",
  "components/panel-tile-urgencias.tsx",
  "components/panel-tile-movimiento.tsx",
  "components/panel-tile-votaciones.tsx",
  "components/panel-tile-ingresos.tsx",
  "components/panel-item-proyecto.tsx",
];
```

### Assert anti-drift D-07
```ts
it("(1f) PANEL-08 anti-drift: todo `components/panel-*.tsx` REAL está declarado en SUPERFICIES_PANEL", () => {
  const reales = readdirSync(path.join(APP_ROOT, "components"))
    .filter((f) => /^panel-.+\.tsx$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => `components/${f}`);
  const declaradas = new Set(SUPERFICIES_PANEL);
  const huerfanos = reales.filter((r) => !declaradas.has(r));
  expect(huerfanos, `Componentes panel-* fuera de SUPERFICIES_PANEL …`).toHaveLength(0);
});
```

### Mutation self-check D-12 (hermano del it PANEL de L1273)
```ts
it("PANEL (126): caza el trío del criterio 1 (señal / exprés / los más) sobre superficie panel", () => {
  const fixtureMutado = `
    export function PanelTileSala() {
      return <p>Trámite exprés — una señal clara: los más votados de la semana.</p>;
    }
  `;
  expect(detectarInsinuaciones(fixtureMutado)).toEqual(
    expect.arrayContaining(["exprés", "señal", "los más"]),
  );
});
```

## Runtime State Inventory

No aplica en el sentido clásico (no hay rename), pero se verificó lo equivalente:

| Categoría | Encontrado | Acción |
|-----------|-----------|--------|
| Stored data | Ninguno — la fase no toca datos | Ninguna |
| Live service config | Ninguno — guards estáticos, sin red/DB | Ninguna |
| OS-registered state | Ninguno | Ninguna |
| Secrets/env vars | Ninguno — CI corre los guards sin secrets (ci.yml L48) | Ninguna |
| Build artifacts | Ninguno — sin cambios de dependencias, `pnpm-lock.yaml` intacto | Ninguna |

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|-------------|--------------|-----------|---------|----------|
| pnpm | scripts | ✓ | 11.3.0 (packageManager) | — |
| Node | vitest | ✓ | ≥22 (engines) | — |
| vitest | guards | ✓ | 3.2.6 | — |
| Acceso a DB / secrets | — | no requerido | — | — |

**Sin dependencias faltantes.**

## Validation Architecture

### Test Framework
| Propiedad | Valor |
|-----------|-------|
| Framework | vitest 3.2.6 (jsdom, globals) |
| Config | `app/vitest.config.ts` |
| Quick run | `cd app && npx vitest run lib/anti-insinuacion-guard.test.ts lib/create-view-guard.test.ts` |
| Full suite | `pnpm --filter ./app test` (107 archivos / 1.590 tests / ~58 s) |
| Runner de guards (nuevo) | `pnpm --filter ./app guards` (11 archivos por nombre explícito) |

### Phase Requirements → Test Map
| Req | Comportamiento | Tipo | Comando | ¿Existe? |
|-----|---------------|------|---------|----------|
| PANEL-08 c1 | SUPERFICIES_PANEL extendida + carril verde | unit | `npx vitest run lib/anti-insinuacion-guard.test.ts` | ✅ archivo existe, tests nuevos |
| PANEL-08 c1 | mutación señal/exprés/los más muerde | unit | idem (`describe (2)`) | ✅ describe existe |
| PANEL-08 c1 | anti-drift `panel-*.tsx` | unit | idem | ❌ nuevo |
| PANEL-08 c2 | NEGACIONES_LOCKED + IDIOMS_APROBADOS + no-hueco | unit | idem | ❌ nuevo |
| DEBT-02 c3 | detector views: control positivo + negativo + escaneo real | unit | `npx vitest run lib/create-view-guard.test.ts` | ❌ archivo nuevo |
| c4 | suite completa + guards por nombre | suite | `pnpm --filter ./app test` + `pnpm --filter ./app guards` | ✅ baseline verde medido |

### Sampling Rate
- Por commit de task: el/los guard(s) tocados por nombre (≈5 s).
- Por merge de wave: `pnpm --filter ./app guards`.
- Phase gate: `pnpm --filter ./app test` completo VERDE en 1.590+ tests (no menos que el baseline).

### Wave 0 Gaps
- Ninguno de infraestructura: framework, config e include-globs ya cubren el archivo nuevo. Los "gaps" son exactamente los entregables de la fase.

## Security Domain

### Categorías ASVS aplicables
| Categoría | Aplica | Control estándar |
|-----------|--------|-----------------|
| V2 Authentication | no | La fase no toca auth |
| V3 Session Management | no | — |
| V4 Access Control | **sí** | B-03 es exactamente un control de access-control preventivo: una view en `public` sin `security_invoker` corre con los privilegios del OWNER (bypass de RLS del caller). El guard estático es la mitigación |
| V5 Input Validation | no | Guards leen archivos del repo, no input de usuario |
| V6 Cryptography | no | — |

### Patrones de amenaza para el stack
| Patrón | STRIDE | Mitigación estándar |
|--------|--------|---------------------|
| View en `public` sin `security_invoker` = escalada de privilegios / bypass RLS | Elevation of Privilege | Guard estático B-03 sobre `supabase/migrations/*.sql` (esta fase); `with (security_invoker = true)` obligatorio en toda view futura |
| Guard verde que no ejerce nada (falso control) | Repudiation / control ficticio | Mutation self-check + control positivo apareado + assert de conjunto-no-vacío |
| Copy que insinúa intención/causalidad sobre un parlamentario | Reputational / legal | Linter anti-insinuación (carril PANEL), declarado ANTES del copy |

## Project Constraints (from CLAUDE.md)

- Trazabilidad a la fuente como principio rector; **jamás afirmar intención ni causalidad** — es la razón de existir del linter anti-insinuación que esta fase extiende.
- Reglas de ingesta/migraciones **LOCKED** (2 etapas, hash-check, R2 primero). Esta fase NO toca ingesta; sí respeta el ledger de migraciones: **prohibido crear archivos .sql fixture en `supabase/migrations/`** (coherente con D-03) y 0080 está reservada.
- Enforcement GSD: los cambios de archivo deben ocurrir dentro de un workflow GSD (`/gsd:execute-phase`).
- `app/AGENTS.md`: "This is NOT the Next.js you know" — irrelevante aquí (la fase no escribe código de Next), pero aplica a 128.

## State of the Art

| Enfoque viejo | Enfoque actual | Cuándo cambió | Impacto |
|---------------|----------------|---------------|---------|
| `APP_ROOT = process.cwd()` (lockdown, money/vsim/notif-antiflip) | `path.resolve(import.meta.dirname, "..")` (anti-insinuacion, WR-06) | v8.1 (bug `process.cwd` bajo `pnpm --filter exec`) | El archivo NUEVO debe usar `import.meta.dirname` |
| Guard sin mutation self-check | Guard con detector puro + `describe` de mutación | desde v11/v12 (lección "cero vacuo") | Obligatorio en B-03 |
| Verificar por grep manual sobre N archivos | Verificar POR CÓDIGO sobre el conjunto completo (test `(1b)` WR-03) | 115-03 | El assert D-10(i) debe ser código, no grep del plan |

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|-------|---------|--------------------|
| A1 | "14+" del criterio 4 se refiere a 16 archivos guard del monorepo (10 app + 6 packages) | Inventario | Bajo — D-14 obliga a documentar el conteo real de todas formas; el plan expone ambos números |
| A2 | Split ingenuo por `;` sobre cuerpos `$$…$$` no produce falsos positivos para `create view` | Guard B-03 | Bajo — el control positivo/negativo apareado detecta cualquier desvío; además hoy hay 0 views |
| A3 | La lista de 7 archivos D-06 coincide con los tiles que 128 creará | SUPERFICIES_PANEL | Bajo — el anti-drift D-07 muerde si 128 desvía; el loader tolera rutas que nunca lleguen a existir |

## Open Questions

1. **Conteo canónico de "14+ guards"** — Sabemos: 10 en `app/`, 6 en `packages/`, 42 describes en app. No está claro qué contó v12. **Recomendación:** el plan escribe el conteo real (11 tras esta fase en `app/`; 17 en el monorepo) y deja constancia de la discrepancia con el criterio; no bloquea.
2. **¿El script `guards` debe incluir los 6 de `packages/`?** — Recomendación: NO (viven en otro workspace con su propio runner y CI ya los corre); el script vive en `app/package.json` con los 11 de `app/`. El plan puede añadir un script raíz opcional si se quiere el barrido completo.

## Sources

### Primary (HIGH confidence — inspección directa del código y corridas reales, 2026-07-30)
- `app/lib/anti-insinuacion-guard.test.ts` (1.586 L) — todas las líneas citadas
- `app/lib/lockdown-guard.test.ts` (1.509 L) — L33-70, L320-375, L608-631
- `app/lib/vsim-antiflip-guard.test.ts` (434 L) — header + describes
- `app/vitest.config.ts`, `app/package.json`, `package.json` raíz, `pnpm-workspace.yaml`
- `.github/workflows/ci.yml` L35-60
- Corridas: `npx vitest run` (107/1590 verde) y `npx vitest run <10 guards>` (304 verde)
- greps sobre `supabase/migrations/*.sql` (77 archivos; 0 views, 0 `security_invoker`)
- `.planning/ROADMAP.md` §Phase 126, `.planning/REQUIREMENTS.md` PANEL-08/DEBT-02, `126-CONTEXT.md`

### Secondary / Tertiary
- Ninguna — fase codebase-internal; cero investigación web.

## Metadata

**Confidence breakdown:**
- Stack: HIGH — cero dependencias nuevas, verificado en package.json y corrida
- Arquitectura/patrones: HIGH — leídos verbatim de los guards existentes
- Pitfalls: HIGH — 3 de 7 verificados empíricamente hoy (test file `panel-actualidad.test.tsx`, `passWithNoTests`, cero views)
- Conteo de guards: MEDIUM — número real medido con certeza; la interpretación de "14+" es inferencia (A1)

**Research date:** 2026-07-30
**Valid until:** ~2026-08-30 (codebase interno; invalidado por cualquier commit que toque los guards)
