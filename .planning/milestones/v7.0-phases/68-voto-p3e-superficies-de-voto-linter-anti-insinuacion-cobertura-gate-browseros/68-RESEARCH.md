# Phase 68: VOTO P3e — Superficies de voto + linter anti-insinuación + cobertura + gate BrowserOS - Research

**Researched:** 2026-07-14
**Domain:** Frontend (Next.js 16 App Router / React 19 Server Components) + CI source-scan guards (vitest) + freshness CLI (tsx) + BrowserOS comprehension gate
**Confidence:** HIGH (todo verificado leyendo el código real del repo)

## Summary

Esta es una fase de **MODIFICAR/podar/gatear**, no de crear. Los tres executables net-new son (1) un **linter anti-insinuación** que es un espejo del guard existente `app/lib/lockdown-guard.test.ts` — un **test de vitest que escanea el árbol de fuentes**, NO un CLI `node` separado; (2) una **señal de cobertura del voto individual** añadida al array `COBERTURA_SENALES` de `packages/freshness/src/catalog.ts` (patrón declarativo N/M idéntico al del corpus de búsqueda); y (3) la **poda** de dos superficies que HOY renderiza `votos-por-parlamentario.tsx` y que CONTEXT.md prohíbe: el bloque "Votó distinto a su bancada" (RPC `rebeldias_de_parlamentario`, líneas 829-886) y el sub-bloque `AusenciasContexto` (RPC `tasa_ausencia_comparada`, comparativo con la mediana de la cámara).

El hallazgo rector para el planner: **no existe ninguna CI que corra `pnpm test`** (verificado: los 9 workflows en `.github/workflows/` son crons de ingesta + deploy; ninguno ejecuta la suite). El guard lockdown vive como test de vitest que corre **localmente y en el gate GSD verify-work** vía `pnpm test` (monorepo root → `pnpm --filter ./app test`). El linter anti-insinuación debe correr **en el mismo lugar** — es decir, como un `.test.ts` bajo `app/` que la suite recoge. "Correr en el mismo lugar que el guard existente" = ser otro archivo `*.test.ts` en `app/`, no un step de CI nuevo.

**Primary recommendation:** Crear `app/lib/anti-insinuacion-guard.test.ts` espejando la estructura de `lockdown-guard.test.ts` (walker de fuentes + `stripTsComments` + regex por término prohibido, scan sobre las superficies de voto). Podar los dos bloques de `votos-por-parlamentario.tsx` + eliminar el import y render de `ausencias-contexto.tsx` (dejar RPCs inertes en DB). Añadir una `CoberturaSenalConfig` de voto individual a `COBERTURA_SENALES`. Cerrar con el gate BrowserOS (operador). Todo offline-testable salvo el veredicto de lectura fría.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Linter anti-insinuación (term-blocklist) | CI/build-time guard (vitest source-scan) | — | Espejo de lockdown-guard: escanea archivos del repo, no runtime; corre en `pnpm test` |
| Señal cobertura N/M en `pnpm freshness` | Backend tooling (tsx CLI, read-only SQL) | Database (count queries) | El operador la ve; no es UI ciudadana; corre read-only vía psql |
| Poda superficies (rebeldía / mediana) | Frontend Server Component render | — | Es supresión de render JSX + fetch; las RPC quedan inertes en DB |
| Superficies de voto (montaje) | Frontend Server Component (`VotosSection`) | Database (RPC `votos_de_parlamentario`) | Ya montadas; esta fase compone + poda dentro de ellas |
| Gate comprensión BrowserOS | Operator/manual validation | — | Lectura fría ciudadana vía MCP; no automatizable |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Anti-insinuación (rector):** un voto es un HECHO OBSERVABLE. Cada superficie lleva la leyenda anti-insinuación verbatim: "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo."
- `pareo` y `ausente` en **slate neutro**, NUNCA fundidos con "en contra".
- Provenance inline (fuente/fecha/enlace) en cada superficie.
- **Prohibido:** vista "parlamentarios que votan como X", matriz de similitud, comparativo con mayoría de bancada, "rebeldía"/"disciplina"/"alineamiento".
- **RPC `rebeldias_de_parlamentario` — NO SURFACEAR.** Es el ítem diferido VOTOX (v2, alto riesgo). Aunque el RPC exista en DB, esta fase NO lo monta en ninguna superficie ciudadana. Dejarlo inerte/no-referenciado; el linter debe cazar cualquier uso del término.
- **Cobertura honesta:** N/M sesiones + techo por causa (RUT-bloqueado, PDF escaneado, sin dato) declarado en UI Y en `pnpm freshness`. Cobertura confirmado/no_confirmado visible; nunca presentar `probable/no_confirmado` como voto atribuido.

### Claude's Discretion
Layout/densidad de las superficies dentro de las reglas anti-insinuación y del sistema de diseño existente. Reusar componentes existentes; no re-inventar. **Forma exacta del gate linter** (el contrato es el comportamiento; ver UI-SPEC §Linter).

### Deferred Ideas (OUT OF SCOPE)
- VOTOX-01 (comparativo voto vs mayoría bancada), VOTOX-02 (votos cruzados), matriz de similitud, "rebeldía" → v2, tras sign-off legal. NO en esta fase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTO-02 | Ver historial de votos individuales por sesión/proyecto — descriptivo, nunca "alineamiento"/"disciplina"/"rebeldía" | Las superficies ya existen (`VotosView` en `votos-por-parlamentario.tsx`, bloque 5 "arco por proyecto"); esta fase PODA los bloques prohibidos (829-886 rebeldía, `AusenciasContexto` mediana) y monta la leyenda |
| VOTO-04 | Leyenda anti-insinuación verbatim + provenance inline; linter anti-vocabulario cubre estas superficies | Leyenda: nuevo bloque 0 al tope del detalle. Linter: nuevo `*.test.ts` espejo de lockdown-guard. Provenance: `ProvenanceBadge` ya presente por voto/arco (`votos-por-parlamentario.tsx:538`) |
| VOTO-05 | Cobertura del voto individual declarada honestamente en UI (N/M sesiones, techo por causa) + en `pnpm freshness` | UI: nota `COBERTURA_BAJA_UMBRAL` ya presente (líneas 782-789) + nueva línea de techo por causa. Freshness: nueva `CoberturaSenalConfig` en `COBERTURA_SENALES` |

## Standard Stack

No se instala ninguna dependencia nueva. Todo el trabajo usa el stack ya presente.

### Core (ya en el repo — verificado en package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.2.6 (app) / ^3.0.0 (root) | Runner del guard-como-test (linter) + tests de componente | El guard lockdown existente ES un test de vitest; el linter lo espeja |
| tsx | (root, invocado por `pnpm freshness`) | Ejecuta `packages/freshness/src/cli.ts` | La señal de cobertura corre por este CLI |
| next | 16.2.9 | App Router Server Components (ficha del parlamentario) | La superficie de voto ya vive aquí; la poda es supresión de render |
| react / react-dom | 19.2.4 | UI | Componentes de presentación puros testeables con RTL |
| @testing-library/react | ^16.3.2 | Tests de render de la poda (verificar ausencia de bloques) | Ya usado en `votos-por-parlamentario.test.tsx` |

**Installation:** ninguna. `pnpm install --frozen-lockfile` cubre todo.

## Package Legitimacy Audit

**No aplica** — esta fase no instala ningún paquete externo. Todo el trabajo usa dependencias ya en el `pnpm-lock.yaml`. Sin superficie de slopsquatting.

## Architecture Patterns

### Sistema — flujo de las 3 piezas net-new

```
LINTER (build-time guard, espejo lockdown):
  pnpm test (root) ─► pnpm --filter ./app test ─► vitest run
       │                                              │
       │                          app/lib/anti-insinuacion-guard.test.ts (NUEVO)
       │                                              │
       │                       walkSourceFiles(superficies de voto)
       │                                              │
       │                       stripTsComments(archivo)  ← reusa la técnica del lockdown-guard
       │                                              │
       │                       por cada término prohibido: regex.test(strippedJSXtext)
       │                                              │
       └──────────────────────► FALLA si aparece un término en JSX/label renderizado

COBERTURA (operator tooling):
  pnpm freshness ─► tsx packages/freshness/src/cli.ts
       │                    │
       │           COBERTURA_SENALES (catalog.ts) + nueva señal voto individual (NUEVO)
       │                    │
       │           queryCobertura(dbUrl) ─► psql read-only ─► evaluateCobertura ─► renderCobertura
       │                    │
       └──────────► tabla N/M en stdout (operador ve cobertura del voto sin bucear SQL)

PODA (frontend render):
  /parlamentario/[id]/page.tsx ─► <VotosSection> ─► VotosView
       │                                                  │
       │                                      ELIMINAR: bloque "Votó distinto a su bancada" (829-886)
       │                                      ELIMINAR: <AusenciasContexto data=…/> (709)
       │                                      ELIMINAR: fetch rebeldias_de_parlamentario (1074-1083)
       │                                      ELIMINAR: fetch tasa_ausencia_comparada (1090-1104)
       │                                                  │
       └────────► carril termina en el arco por proyecto (bloque 5) + notas de cobertura
```

### Pattern 1: Guard-como-test de vitest (NO CLI separado)
**What:** El "linter" es un archivo `*.test.ts` bajo `app/` que la suite de vitest recoge automáticamente. Camina los archivos de fuente, strippea comentarios, y hace `expect(offenders).toHaveLength(0)`.
**When to use:** Siempre en este repo — es el patrón LOCKED del guard de seguridad (`lockdown-guard.test.ts`).
**Example (estructura a espejar — de `app/lib/lockdown-guard.test.ts`):**
```typescript
// Source: app/lib/lockdown-guard.test.ts (verbatim del repo, líneas 33-128)
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd(); // vitest corre desde app/

// stripTsComments (líneas 75-87): quita /* */ y // …, SALTA `://` de URLs
// para no crear falsos negativos. REUSAR esta técnica en el linter.
function stripTsComments(content: string): string { /* … */ }

// walkSourceFiles (104-128): recorre .ts/.tsx, salta node_modules/.next/etc y *.test.*
function walkSourceFiles(dir: string): string[] { /* … */ }

describe("(B) Guard — el arbol publico no toca tablas PII", () => {
  const sourceFiles = walkSourceFiles(APP_ROOT);
  it("ningun archivo … hace `.from('<tabla_pii>')`", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const stripped = stripTsComments(readFileSync(file, "utf-8"));
      for (const table of PII_TABLES) {
        const pattern = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, "i");
        if (pattern.test(stripped)) offenders.push(`${rel} -> ${table}`);
      }
    }
    expect(offenders, `…mensaje accionable…`).toHaveLength(0);
  });
});
```

**Adaptación para el linter anti-insinuación:**
- Scope de archivos (UI-SPEC §Linter): `app/components/voto*` (`votos-por-parlamentario`, `votos-chart`, `voto-detalle`, `voto-row`/`voto-ficha-row`), `app/components/ausencias-contexto*` (post-poda debería estar borrado — el linter confirma su ausencia o su vacío), `app/lib/voto-presentacion*`, y la sección VOTE de `app/app/parlamentario/[id]/page.tsx`.
- Regex por término prohibido (UI-SPEC §Linter, lista dura): `rebeldía`, `rebelde`, `disciplina`, `indisciplina`, `alineamiento`, `alineado`, `afinidad`, `cercanía política`, `lealtad`, `traición`, `díscolo`, `score`, `puntaje`, `índice`, `ranking`, `nivel de acuerdo`, `vota como`, `similar a`, verbos causales dinero/lobby→voto.
- **CRÍTICO — usar `stripTsComments`:** el grep de esta investigación confirma que hay usos LEGÍTIMOS de estos términos en comentarios y en `voto-presentacion`-adjacent prose (p.ej. `ausencias-contexto.tsx:46` "disciplina anti-fabricación", `page.tsx:167` un comentario que LISTA los términos prohibidos). Sin strippear comentarios, el linter tendría falsos positivos masivos. El lockdown-guard ya resolvió esto exactamente.
- **Matiz de acento:** los términos llevan tildes (`rebeldía`, `índice`). Considerar normalizar NFD o incluir ambas formas, porque `rebeldias_de_parlamentario` (identificador de RPC, sin tilde) NO debe cazarse como falso positivo si sobrevive inerte — pero SÍ debe cazarse cualquier `rebeldía`/`rebeldias` en un STRING renderizado. La UI-SPEC dice: "el linter caza usos en UI, no la existencia en la DB". El planner debe decidir: cazar en JSX text nodes/labels, permitir identificadores de RPC en `.rpc("…")` sólo si el bloque no se renderiza. Lo más limpio post-poda: el término desaparece por completo del árbol de voto excepto en comentarios (que se strippean).

### Pattern 2: Señal de cobertura declarativa (freshness)
**What:** Añadir un objeto `CoberturaSenalConfig` al array `COBERTURA_SENALES`. El runner (`queryCobertura`) y el evaluador (`evaluateCobertura`) lo consumen sin más cambios — es puramente declarativo.
**When to use:** Cualquier señal N/M nueva que el operador deba ver.
**Example (el patrón existente — de `packages/freshness/src/catalog.ts:58-83`):**
```typescript
// Source: packages/freshness/src/catalog.ts (verbatim)
export const COBERTURA_SENALES: CoberturaSenalConfig[] = [
  { senal: "proyecto", etiqueta: "proyectos (universo)",
    sql: "SELECT count(*) FROM proyecto;", esDenominador: true },
  { senal: "embedding", etiqueta: "indexados (/buscar)",
    sql: "SELECT count(*) FROM proyecto_embedding;", esDenominador: false },
  // … añadir aquí la(s) señal(es) de voto individual …
];
```
**Nota de diseño para el planner:** el `COBERTURA_SENALES` actual tiene UN solo denominador (`proyecto`) y todas las señales se dividen por él. La cobertura del voto individual tiene un denominador DISTINTO (sesiones de sala conocidas, no proyectos). Dos opciones:
1. **Añadir la señal de voto con su propio par N/M** — requiere que `evaluateCobertura` soporte más de un denominador (hoy asume uno global, `catalog.ts` marca `esDenominador: true` una sola vez). Esto es un cambio de lógica en `evaluate.ts:98-116`.
2. **Superficie separada** — un nuevo array `COBERTURA_VOTO_SENALES` + una función render aparte en `cli.ts` (espejo de `renderCobertura`). Más limpio conceptualmente (numerador = sesiones con voto individual confirmado; denominador = sesiones de sala conocidas en el período; Cámara determinista vs Senado por nombre son dos números distintos).
El planner debe elegir. La opción 2 evita romper la semántica "un denominador = proyecto" del array actual y modela mejor "N/M sesiones por cámara + techo por causa". **Recomendación:** opción 2 (array + renderer separados) — menos acoplamiento, no toca la lógica del corpus de búsqueda.

### Anti-Patterns to Avoid
- **Crear un CLI `node`/`tsx` separado para el linter.** El repo NO tiene CI que lo invoque; quedaría muerto. El guard debe ser un `*.test.ts` que `pnpm test` recoge (mismo lugar que lockdown-guard).
- **Añadir un step de CI que corra `pnpm test`.** No es el objetivo de esta fase y no hay ninguno hoy; el gate real es GSD verify-work + la corrida local. "Correr en el mismo lugar" = ser un test de vitest.
- **Linter sin strip de comentarios.** Falsos positivos garantizados (hay ~15 usos legítimos de términos prohibidos en comentarios/prose, verificado por grep).
- **Borrar las RPCs `rebeldias_de_parlamentario` / `tasa_ausencia_comparada` de la DB.** CONTEXT dice "dejarlas inertes". Borrarlas es DDL destructivo (gate). Solo se elimina el render + el fetch + los imports.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Escanear fuentes por términos prohibidos | Un CLI custom con glob + parser propio | El patrón `walkSourceFiles` + `stripTsComments` de `lockdown-guard.test.ts` | Ya resuelto (URLs, comentarios, skip dirs, mensajes accionables) |
| Ejecutar N/M read-only contra Supabase | Un script psql nuevo | Añadir a `COBERTURA_SENALES` (o array paralelo) + reusar `queryCobertura`/`psql` | El runner ya degrada honesto, loguea la clase de error, y usa `PGCLIENTENCODING=UTF8` |
| Verificar la poda | Inspección manual del deploy | `git grep` + un test RTL que renderiza `VotosView` y asserta ausencia del `<h3>Votó distinto…` | Determinista, offline, regresión-proof |
| Provenance inline por voto | Un badge nuevo | `ProvenanceBadge` ya montado (`votos-por-parlamentario.tsx:538`) | Contrato conservado |

**Key insight:** las tres piezas ya tienen un molde exacto en el repo. El riesgo es re-inventar en vez de espejar.

## Runtime State Inventory (rename/prune/refactor — aplica)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguno. Las RPCs `rebeldias_de_parlamentario` (`supabase/migrations/0047`) y `tasa_ausencia_comparada` (`0050`) quedan INERTES en la DB — no se tocan. No hay datos que migrar; la poda es solo de render. | none (dejar RPC inertes por decisión LOCKED) |
| Live service config | Ninguno — no hay flag/config externa asociada a estos bloques. Las RPCs no están gated por env var. | none |
| OS-registered state | Ninguno. | none |
| Secrets/env vars | Ninguno. La señal de cobertura reusa `SUPABASE_DB_URL` (ya en `.env`, verificado en `cli.ts:38`). Sin nuevas env vars. | none |
| Build artifacts / imports | **`PUBLIC_RPC_ALLOWLIST` en `lockdown-guard.test.ts:165-184`** lista `rebeldias_de_parlamentario` y `tasa_ausencia_comparada`. Tras la poda, el árbol público YA NO invoca esas RPCs. El allowlist las PERMITE pero no las EXIGE, así que dejarlas no rompe. **Decisión del planner:** quitarlas del allowlist endurece el guard (si un futuro re-monta la RPC, el guard lo caza). Recomendado quitarlas. Además: eliminar el import `AusenciasContexto` de `votos-por-parlamentario.tsx:7`, los imports de tipos `RebeldiaRow`/`AusenciaContextoRow` (líneas 19-20), y los campos `rebeldias`/`ausenciaContexto` de `VotosViewData`. | edit: quitar renders/fetch/imports; opcional: podar allowlist |

**Nada encontrado en Stored/Live/OS/Secrets:** verificado — la poda no deja estado runtime huérfano; las RPCs son inertes por diseño LOCKED.

## Common Pitfalls

### Pitfall 1: El linter como CI step muerto
**What goes wrong:** Se crea un CLI y se asume que "algún workflow lo corre". No hay ninguno.
**Why it happens:** Intuición de "linter = comando en CI". En este repo la CI son crons + deploy, y la suite corre local/GSD.
**How to avoid:** Hacer el linter un `app/lib/anti-insinuacion-guard.test.ts`. La suite lo recoge; `pnpm test` (root) lo corre; verify-work lo gatea.
**Warning signs:** el archivo no es `*.test.ts`, o exporta un `main()` con `process.exit`.

### Pitfall 2: Falsos positivos por comentarios y prosa
**What goes wrong:** El linter falla por "disciplina anti-fabricación" en un comentario, o por el comentario en `page.tsx:167` que LISTA los términos prohibidos.
**Why it happens:** Los términos prohibidos aparecen legítimamente al DOCUMENTAR la regla.
**How to avoid:** Strippear comentarios TS con la función `stripTsComments` del lockdown-guard antes de aplicar los regex. Escanear solo texto JSX / labels.
**Warning signs:** offenders que apuntan a líneas dentro de `/* */` o `//`.

### Pitfall 3: Denominador único en COBERTURA_SENALES
**What goes wrong:** Se añade la señal de voto al array existente y su N/M sale mal porque `evaluateCobertura` divide TODO por `count(proyecto)`.
**Why it happens:** El array asume un solo `esDenominador` global (`evaluate.ts:102-104`).
**How to avoid:** Usar un array/renderer separado para la cobertura de voto (denominador = sesiones de sala conocidas), o extender `evaluateCobertura` para agrupar por denominador. Recomendado: array separado.
**Warning signs:** el % de la señal de voto se calcula contra el total de proyectos.

### Pitfall 4: Poda parcial deja el fetch huérfano (o rompe tipos)
**What goes wrong:** Se borra el JSX del bloque rebeldía pero queda el `sb.rpc("rebeldias_de_parlamentario", …)` (429/latencia inútil), o se borra el fetch pero `VotosViewData` sigue exigiendo `rebeldias` → error de tipo.
**Why it happens:** El dato fluye por 4 puntos: fetch (`VotosSection` 1074-1083), tipo (`VotosViewData.rebeldias` 121-122), derivador (`derivarVotosViewData` 911-997), y render (829-886). Igual para ausencias (fetch 1090-1104, campo `ausenciaContexto` 160, render 709).
**How to avoid:** Podar los 4 puntos coherentemente + actualizar las fixtures de `votos-por-parlamentario.test.tsx` que setean `rebeldias`. `tsc -b` limpio es la señal.
**Warning signs:** `tsc --noEmit` rojo, o un `.rpc()` sin consumidor.

### Pitfall 5: BrowserOS CDP timeout mata la página
**What goes wrong:** `save_screenshot` en ráfaga tumba el MCP con "CDP request timeout" y mata la página oculta.
**Why it happens:** Documentado en project memory (v6.0/red layout B).
**How to avoid:** Reintentar con sleep 8-10s, reabrir con `open`, re-aplicar estado. `evaluate_script` usa arg `expression` (no `code`); `click` usa `element`. 390px se fuerza con CSS inyectado.
**Warning signs:** capturas vacías / MCP no responde.

## Code Examples

### Puntos exactos de la PODA en `app/components/votos-por-parlamentario.tsx`

| Qué eliminar | Líneas (aprox., snapshot 2026-07-14) | Detalle |
|--------------|--------------------------------------|---------|
| Import `AusenciasContexto` | 7 | `import { AusenciasContexto } from "@/components/ausencias-contexto";` |
| Import tipos `RebeldiaRow, AusenciaContextoRow` | 19-20 (dentro del bloque `import type … from "@/lib/types"`) | quitar los dos identificadores |
| Campo `rebeldias: RebeldiaRow[]` en `VotosViewData` | 121-122 | |
| Campo `ausenciaContexto?` en `VotosViewData` | 154-160 | |
| Render `<AusenciasContexto data={…}/>` (bloque 3) | 705-709 | sub-bloque "¿Falta más o menos que la mediana…?" |
| Bloque completo "Votó distinto a su bancada" (bloque 6) | 829-886 | el `<div>…<h3>Votó distinto a su bancada</h3>…</div>` entero |
| Param `rebeldias` en `derivarVotosViewData` + su paso al return | 915-921, 987 | |
| Fetch `rebeldias_de_parlamentario` en `VotosSection` | 1073-1083 | |
| Fetch `tasa_ausencia_comparada` + spread `ausenciaContexto` | 1085-1104, 1116-1117 | dejar `<VotosView id={id} data={data} />` limpio |
| Comentario del cabecero que menciona "votó distinto a su bancada" / "rebeldías" | 26-37 | actualizar la prosa del docblock para reflejar el nuevo orden |

Tras la poda, `derivarVotosViewData` ya no recibe `rebeldias`; el carril termina en el arco por proyecto (bloque 5) + las notas de cobertura (782-789 + la nueva línea de techo por causa).

### `app/components/ausencias-contexto.tsx` — eliminación completa
Verificado que **NADIE más lo importa** (solo `votos-por-parlamentario.tsx` y su test). Acción: borrar `ausencias-contexto.tsx` + `ausencias-contexto.test.tsx`. El linter (Pattern 1) puede además asertar que el archivo no existe / no aparece en el árbol de voto. `AusenciaContextoRow` en `lib/types.ts` puede quedar (tipo inerte) o borrarse; borrar es más limpio pero verificar que la migración 0050 test SQL no lo referencie desde TS (no lo hace — es `.sql`).

### Punto de montaje en la ficha (NO cambia)
`app/app/parlamentario/[id]/page.tsx:271-289` monta `<VotosSection id searchParams/>` dentro de `<section id="votos" className="mt-12 scroll-mt-6">`. La poda vive DENTRO de `VotosSection`/`VotosView` — el page.tsx no se toca salvo que el linter escanee su sección VOTE (que hoy solo tiene el heading "Votaciones" + la mención en el comentario 167, que se strippea).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regla anti-insinuación por comentarios + code-review + asserts RTL inline | Guard formalizado como `*.test.ts` de vitest (espejo lockdown) | Esta fase (68) | Un solo artefacto ejecutable caza el vocabulario; no depende de que un reviewer lo note |
| "Votó distinto a su bancada" + "mediana de cámara" en la ficha | Podados (diferidos a VOTOX v2) | Esta fase (68) | El carril de voto queda puramente descriptivo; cierra el riesgo legal 17-LEGAL-DOSSIER |

**Deprecated/outdated en esta fase:**
- Bloque rebeldía (RPC `rebeldias_de_parlamentario`) — inerte en DB, fuera de la UI.
- `AusenciasContexto` / `tasa_ausencia_comparada` en la ficha — borrado el componente, RPC inerte.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La opción "array/renderer separado" para la cobertura de voto es preferible a extender `evaluateCobertura` | Architecture §Pattern 2 | Bajo — ambas funcionan; es una decisión de diseño que el planner cierra |
| A2 | Quitar `rebeldias_de_parlamentario`/`tasa_ausencia_comparada` del `PUBLIC_RPC_ALLOWLIST` es seguro tras la poda | Runtime State Inventory | Bajo — el allowlist permite pero no exige; si otro código público las llamara, el guard lo cazaría (que es lo deseado). Verificar que ningún otro archivo público las invoque (grep confirmó solo `votos-por-parlamentario.tsx`) |
| A3 | `AusenciaContextoRow` en `lib/types.ts` puede borrarse sin romper el test SQL de 0050 | Code Examples | Bajo — el test de 0050 es `.sql`, no importa el tipo TS |

## Open Questions

1. **¿Un array de cobertura separado o extender `evaluateCobertura`?**
   - What we know: el array actual asume un denominador único (`proyecto`); la cobertura de voto tiene otro denominador (sesiones de sala) y dos cámaras (Cámara determinista, Senado por nombre).
   - What's unclear: si el operador quiere ver Cámara y Senado como dos filas N/M distintas o una combinada.
   - Recommendation: array `COBERTURA_VOTO_SENALES` separado + `renderCoberturaVoto` en `cli.ts`; dos filas (Cámara confirmado, Senado por nombre) con su propio M. Cerrar en el plan.

2. **¿El linter caza `rebeldias_de_parlamentario` como identificador si sobrevive inerte en algún comentario/tipo?**
   - What we know: tras la poda el término desaparece del render; solo podría quedar en comentarios (strippeados) o en `lib/types.ts`/allowlist como identificador.
   - What's unclear: si el linter debe permitir el identificador `rebeldias_de_parlamentario` en un `.rpc()` no montado.
   - Recommendation: el linter escanea JSX text/labels (post-strip); un identificador en `.rpc("…")` no renderizado no es texto ciudadano. Como la poda elimina el fetch, el punto es moot — pero documentar la regla: "caza texto renderizado, no identificadores".

3. **¿Dónde vive la "cobertura confirmado/no_confirmado" y el "techo por causa" en la UI?**
   - What we know: `VotosView` ya tiene la nota de cobertura `COBERTURA_BAJA_UMBRAL` (782-789). El copy del techo por causa está LOCKED en UI-SPEC §Cobertura.
   - What's unclear: si el techo por causa se computa (hay causa conocida) o es texto incondicional sobrio.
   - Recommendation: línea condicional — solo cuando hay techo conocido (RUT-bloqueado / PDF escaneado / sin desglose nominal); copy verbatim de UI-SPEC. Sin fabricar el techo.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | linter guard + tests de poda | ✓ | ^3.2.6 (app) | — |
| tsx | `pnpm freshness` (señal cobertura) | ✓ | via pnpm | — |
| psql | señal cobertura N/M (read-only) | operador (local) | — | degrada a "n/d" honesto (`query-runner.ts:62-77`) |
| SUPABASE_DB_URL | señal cobertura | ✓ (.env) | — | CLI sale con exit 2 si falta |
| BrowserOS MCP (`http://127.0.0.1:9200/mcp`) | gate comprensión | operador debe levantarlo | — | **NO fingir capturas** — pedir al operador levantar el MCP (PROMPT §BrowserOS) |

**Missing dependencies with no fallback:**
- BrowserOS MCP para el veredicto de lectura fría: si está caído, el gate se pausa y se pide al operador levantarlo. Es un gate OPERADOR, no automatizable.

**Missing dependencies with fallback:**
- psql/DB para la cobertura: degrada a "n/d" sin romper (la señal es informativa).

## Validation Architecture

`.planning/config.json` — nyquist_validation: tratar como habilitado (no verificado como `false`; incluir esta sección).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.6 (app) / ^3.0.0 (root) |
| Config file | `app/vitest.config.ts` (vitest corre desde `app/`; root delega vía `pnpm --filter ./app test`) |
| Quick run command | `pnpm --filter ./app test` (o `cd app && pnpm test`) |
| Full suite command | `pnpm test` (root: `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOTO-04 (linter) | Ningún término prohibido en JSX/label de las superficies de voto | guard (source-scan) | `pnpm --filter ./app test anti-insinuacion-guard` | ❌ Wave 0 (`app/lib/anti-insinuacion-guard.test.ts`) |
| VOTO-02 (poda) | `VotosView` NO renderiza `<h3>Votó distinto a su bancada</h3>` | unit/RTL | `pnpm --filter ./app test votos-por-parlamentario` | ✅ (extender fixtures: quitar `rebeldias`) |
| VOTO-02 (poda) | `AusenciasContexto` no existe / no se monta | unit/RTL | `pnpm --filter ./app test votos-por-parlamentario` | ✅ (`ausencias-contexto.test.tsx` se BORRA) |
| VOTO-04 (leyenda) | Leyenda anti-insinuación verbatim presente 1× al tope del detalle | RTL | `pnpm --filter ./app test votos-por-parlamentario` | ✅ (añadir assert) |
| VOTO-05 (freshness) | La señal de voto individual aparece en la salida de cobertura | unit | `pnpm --filter "./packages/*" test evaluate` | ✅ (extender `evaluate.test.ts`) |
| VOTO-05 (UI) | Nota de cobertura N/M + techo por causa cuando aplica | RTL | `pnpm --filter ./app test votos-por-parlamentario` | ✅ (añadir assert) |
| todos | `tsc -b` limpio tras la poda | typecheck | `pnpm typecheck` (root) | ✅ |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test <archivo-tocado>` + `pnpm typecheck`
- **Per wave merge:** `pnpm test` (suite completa) — baseline 751 verde (PROMPT §Suite), debe quedar verde
- **Phase gate:** suite completa verde + `tsc --noEmit` limpio ANTES de `/gsd:verify-work`; luego gate BrowserOS (operador)

### Wave 0 Gaps
- [ ] `app/lib/anti-insinuacion-guard.test.ts` — NUEVO guard-como-test (linter), espejo de `lockdown-guard.test.ts`. Cubre VOTO-04.
- [ ] Extender `app/components/votos-por-parlamentario.test.tsx` — quitar `rebeldias` de las fixtures; añadir asserts de ausencia del bloque rebeldía y presencia de la leyenda. Cubre VOTO-02/04.
- [ ] Borrar `app/components/ausencias-contexto.test.tsx` (junto con el componente). Cubre VOTO-02.
- [ ] Extender `packages/freshness/src/evaluate.test.ts` — casos de la señal de cobertura de voto (N/M, degrade null). Cubre VOTO-05.
- [ ] (opcional) test que asserta que `rebeldias_de_parlamentario`/`tasa_ausencia_comparada` ya NO están en `PUBLIC_RPC_ALLOWLIST` (si se decide podar el allowlist).

**Offline-testable (todo lo de arriba):** linter corre en vitest; poda verificada por RTL + `git grep`; freshness build verificable con `evaluate.test.ts` (lógica pura, sin DB). **Operador-only:** el veredicto BrowserOS de lectura fría ciudadana ("comprensible") — no automatizable, se pausa si el MCP está caído.

## Security Domain

`security_enforcement`: no marcado `false` → incluir. Esta fase es frontend render + guard + tooling read-only; superficie de seguridad acotada.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | ruta pública read-only; sin auth nueva |
| V3 Session Management | no | — |
| V4 Access Control | sí (indirecto) | La poda NO debe re-exponer PII. El guard `lockdown-guard.test.ts` (B) sigue vigente: el árbol público lee con service_role → nada de `.from('<tabla_pii>')`. La señal de cobertura corre read-only via psql (operador), fuera del árbol público |
| V5 Input Validation | sí | El `[id]` ya se valida con `PARLAMENTARIO_ID_RE` antes de tocar DB (page.tsx:136); la señal de cobertura usa SQL estático (sin interpolación de input) |
| V6 Cryptography | no | — |

### Known Threat Patterns for {Next.js SSR + CI guard + psql tooling}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insinuación/difamación por vocabulario (riesgo rector del proyecto) | Repudiation/Info-disclosure | El linter guard caza términos prohibidos en render; poda elimina las superficies de juicio (rebeldía/mediana) |
| Fuga de PII al podar/mover render | Info disclosure | Guard lockdown (B) sigue escaneando `.from('<pii>')`; la poda no toca lecturas de datos, solo suprime render de RPCs ya PII-safe |
| SQL injection en la señal de cobertura | Tampering | SQL 100% estático en `COBERTURA_SENALES` (sin input de usuario); `execFileSync` sin shell (`query-runner.ts:56`) |
| Secret leak en freshness | Info disclosure | `query-runner.ts` nunca imprime `dbUrl`/password (WR-06, líneas 48-77); reusar tal cual |

## Sources

### Primary (HIGH confidence) — código real del repo, leído esta sesión
- `app/lib/lockdown-guard.test.ts` — patrón guard-como-test (walker, stripTsComments, allowlist RPC, mensajes accionables). El molde del linter.
- `app/components/votos-por-parlamentario.tsx` — puntos exactos de la poda (imports 7/19-20, `VotosViewData` 121-160, render 705-709 y 829-886, fetch 1073-1104).
- `app/components/ausencias-contexto.tsx` — componente a borrar (comparativo mediana de cámara).
- `app/app/parlamentario/[id]/page.tsx` — punto de montaje de `VotosSection` (271-289); no se toca.
- `packages/freshness/src/catalog.ts` — `COBERTURA_SENALES` (58-83) + `CoberturaSenalConfig` (47-56).
- `packages/freshness/src/evaluate.ts` — `evaluateCobertura` (98-116, denominador único).
- `packages/freshness/src/query-runner.ts` — `queryCobertura` + `psql` read-only sin shell (48-155).
- `packages/freshness/src/cli.ts` — `renderCobertura` + wiring (22, 115-145, 207-209).
- `package.json` (root) — scripts `test`/`typecheck`/`freshness` (8-13); `app/package.json` — `test: vitest run`.
- `.github/workflows/*` (9 archivos) — verificado: NINGUNO corre `pnpm test`; solo crons + deploy.
- `.planning/REQUIREMENTS.md` — VOTO-02/04/05 (líneas 15-18, 73-79).
- `.planning/phases/68-…/68-UI-SPEC.md` + `68-CONTEXT.md` — contrato de poda, leyenda verbatim, lista de términos prohibidos.
- `.planning/PROMPT-v7.0-build-autonomo.md` — gates, BrowserOS gotchas, suite baseline 751.
- `.planning/milestones/v6.0-phases/61-…/61-01-SUMMARY.md` — patrón BrowserOS comprehension gate + always-visible-legend.
- `git grep` de vocabulario prohibido en superficies de voto — confirmó usos legítimos en comentarios (necesidad de stripTsComments).

### Secondary (MEDIUM confidence)
- Project memory (MEMORY.md) — BrowserOS CDP loop, reabrir página en timeout; suite 751; pnpm11 gotcha.

### Tertiary (LOW confidence)
- Ninguna — todo verificado contra el código del repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — leído de package.json; sin deps nuevas.
- Architecture (linter/cobertura/poda): HIGH — molde exacto en el repo, líneas citadas.
- Pitfalls: HIGH — el falso-positivo de comentarios está probado por grep; el denominador único está en el código.
- BrowserOS gate: MEDIUM — depende de que el MCP esté levantado (operador).

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 días; código estable, sin deps volátiles). Las referencias de línea son de un snapshot 2026-07-14 — reconfirmar con `git grep` antes de editar si el archivo cambió.

## RESEARCH COMPLETE

**Phase:** 68 - VOTO P3e — Superficies de voto + linter anti-insinuación + cobertura + gate BrowserOS
**Confidence:** HIGH

### Key Findings
- El "lockdown-guard" es un **test de vitest** (`app/lib/lockdown-guard.test.ts`), NO un CLI. Ninguna CI corre `pnpm test` — el guard corre local + GSD verify-work. El linter anti-insinuación debe ser otro `*.test.ts` bajo `app/` (mismo lugar), espejando `walkSourceFiles` + `stripTsComments` (obligatorio: hay ~15 usos legítimos de términos prohibidos en comentarios).
- La poda toca 4 puntos coherentes por bloque en `votos-por-parlamentario.tsx` (import, tipo, fetch, render): rebeldía (829-886 + fetch 1073-1083) y ausencias/mediana (render 709 + fetch 1090-1104). `ausencias-contexto.tsx` se borra entero (nadie más lo importa). Las RPCs quedan INERTES en DB (borrarlas = DDL destructivo gated). `PUBLIC_RPC_ALLOWLIST` las lista pero no las exige — quitarlas endurece el guard (recomendado).
- La cobertura N/M va como `CoberturaSenalConfig` declarativa en freshness, PERO el array actual asume un denominador único (`proyecto`); la cobertura de voto tiene otro (sesiones de sala) + dos cámaras → usar array/renderer separado (recomendado) para no romper la semántica del corpus.
- Todo offline-testable (linter vitest, poda RTL+grep, freshness lógica pura) salvo el veredicto BrowserOS de lectura fría ciudadana (operador; no fingir capturas si el MCP está caído).

### File Created
`.planning/phases/68-voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros/68-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | package.json leído; cero deps nuevas |
| Architecture | HIGH | molde exacto (lockdown-guard, catalog, VotosView) con líneas citadas |
| Pitfalls | HIGH | falso-positivo de comentarios y denominador único probados por lectura de código |

### Open Questions
- Array de cobertura separado vs extender `evaluateCobertura` (recomendado: separado).
- Regla exacta del linter para el identificador `rebeldias_de_parlamentario` inerte (recomendado: caza texto renderizado, no identificadores).
- Techo por causa: condicional (solo si hay causa conocida) vs incondicional (recomendado: condicional, copy verbatim UI-SPEC).

### Ready for Planning
Research complete. El planner puede crear PLAN.md con: (1) linter guard-como-test, (2) poda de 4 puntos × 2 bloques + borrado de `ausencias-contexto.*`, (3) señal de cobertura freshness (array separado), (4) leyenda + techo por causa en la UI, (5) gate BrowserOS operador.
