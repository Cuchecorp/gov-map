# Phase 73: DINERO P5e — Superficies MONEY gated OFF + linter + GATE LEGAL humano - Research

**Researched:** 2026-07-14
**Domain:** Next.js Server Components (Next 16), vitest guard-as-test, anti-defamación copy, dossier legal
**Confidence:** HIGH (todo el sustrato ya existe en el repo y fue leído directamente)

## Summary

Phase 73 es una fase **ADITIVA sobre código que ya existe y ya está cableado**. El gate deny-by-default (`moneyPublicEnabled`), las cuatro superficies MONEY, sus RPCs PII-safe, el carril "pendiente" (gate OFF), la distinción RUT-vs-nombre en el copy, la procedencia inline (`ProvenanceBadge`), la frescura por dato (corte + captura + elección) y el dossier legal 13 (`docs/legal/13-LEGAL-DOSSIER.md`, `signoff: pending`) **ya están en el repo, verificados por lectura directa**. Ningún net-new toca el gate, la RLS, ni convierte un no-monto en monto. Los deltas de esta fase son cuatro, todos offline-testables:

1. **Leyenda anti-insinuación MONEY** (constante verbatim de single-source, espejo de `LEYENDA_ANTI_INSINUACION`) montada 1× al tope de cada una de las cuatro superficies.
2. **Extensión del linter** `app/lib/anti-insinuacion-guard.test.ts` para escanear las cuatro superficies MONEY + página `/contraparte`, con la blocklist causal de dinero y la leyenda MONEY restada de `NEGACIONES_LOCKED`.
3. **Guard CI anti-flip** (un `*.test.ts` nuevo que la suite recoge) que FALLA si un commit de agente relaja el `=== "true"`, mete `MONEY_PUBLIC_ENABLED=true` en el repo, o lee la env cruda en una ruta. **El molde exacto ya existe** en `packages/dinero/src/servel-frozen-guard.test.ts §(5)`.
4. **Actualización del dossier 13** (ya escrito; el delta es reafirmar/completar para revisión humana) — el agente NO firma ni flipea.

**Primary recommendation:** Reusar los moldes existentes verbatim. La leyenda va como constante `LEYENDA_ANTI_INSINUACION_MONEY` en `app/lib/` (single-source, importada por las 4 superficies Y por el guard como negación). El guard anti-flip clona el patrón `servel-frozen-guard.test.ts §(5)` (comparación estricta `=== "true"`, `.env.example=false`, no-raw-env). El linter extiende `SUPERFICIES` + `TERMINOS_PROHIBIDOS` + `NEGACIONES_LOCKED` sin reescribir helpers.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gate deny-by-default MONEY | Frontend Server (SSR, `import "server-only"`) | Database (RLS deny-by-default = doble candado) | `moneyPublicEnabled()` decide el render server-side; nunca llega al bundle del cliente (sin `NEXT_PUBLIC_`). |
| Leyenda anti-insinuación render | Frontend Server (Server Components) | — | Texto estático renderizado en las Views puras; sin cómputo, sin DB. |
| Linter anti-vocabulario | Test/CI (vitest, escaneo estático de fuentes) | — | `*.test.ts` que lee archivos con `readFileSync`; corre en `pnpm test`. No es runtime. |
| Guard CI anti-flip | Test/CI (vitest, escaneo estático) | — | Igual: lee `money-gate.ts`, `.env.example`, y el árbol de rutas; falla en la suite. |
| Dossier legal 13 (sign-off) | Documentación (markdown + YAML front-matter) | Operador (humano firma) | Estado verificable por inspección del YAML `signoff`. El flip depende de `signoff: approved`. |
| Flip `MONEY_PUBLIC_ENABLED=true` | **Operador (humano exclusivo)** | — | Acto humano post-sign-off; FUERA de esta corrida (deferred). |
| BrowserOS cold-read gated-preview | Operador (preview local) | — | Flag ON solo en preview local/operador; requiere deploy/datos; operador-gated. |

## Standard Stack

Sin paquetes nuevos. Toda la fase usa lo ya instalado. **No hay `## Package Legitimacy Audit`** porque no se instala nada.

### Core (ya presente, verificado por lectura)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ya instalado (raíz + app) | Guard-as-test + linter + RTL de leyenda | `pnpm test` = `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test` `[VERIFIED: package.json]` |
| @testing-library/react (RTL) | ya instalado | Tests de render de la leyenda MONEY en las 4 Views puras | Los 4 `*.test.tsx` de superficie ya existen `[VERIFIED: ls app/components]` |
| Next.js | 16 (App Router) | Server Components; `notFound()`; params Promise | `[VERIFIED: app/AGENTS.md, page.tsx leídas]` |

**Instalación:** ninguna.

## Project Constraints (from CLAUDE.md)

- **Ingesta dos etapas / R2 primero** — NO aplica a esta fase (es UI + guards + doc, sin ingesta).
- **`app/AGENTS.md` LOCKED:** "This is NOT the Next.js you know… Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." Cualquier tarea que toque un Server Component (montaje de leyenda) debe respetar Next 16 (params/searchParams son `Promise`, `import "server-only"`).
- **GSD Workflow Enforcement:** todo cambio via comando GSD (esta fase corre via `/gsd:execute-phase`).
- **Secrets en `.env`:** `MONEY_PUBLIC_ENABLED` vive en `.env` (no committeado); `.env.example` trae `=false` `[VERIFIED: .env.example:64]`.
- **Core Value anti-causalidad:** "el sistema NUNCA afirma intención ni causalidad" — es LITERALMENTE lo que el linter enforza.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Gate deny-by-default (rector):** TODA superficie MONEY se renderiza SOLO vía `moneyPublicEnabled(process.env)` (fail-closed, `=== "true"`). OFF por defecto. NINGUNA ruta lee la env cruda. Guard CI anti-flip: un commit de AGENTE no puede cambiar el flag/default a `"true"` ni relajar el gate. El flip requiere `signoff: approved` en el dossier legal 13 — acto humano exclusivo del operador.
- **Anti-insinuación MONEY (defamación):** "empresa ligada" se afirma SOLO con base RUT-EXACTA (ChileCompra por RUT, Phase 70). NUNCA name-match/LLM. SERVEL (por nombre) NO afirma "empresa ligada por RUT". Conteos FACTUALES con procedencia inline (fuente/fecha/enlace + monto VERBATIM). NUNCA "empresa ligada a" como insinuación, ni causalidad ("financió", "a cambio de"). El linter anti-insinuación (Phase 68) se EXTIENDE a las superficies MONEY (mismo patrón `stripTsComments` + blocklist). Frescura declarada por dato — nunca dato viejo como actual.
- **Legal gate (acto humano):** El dossier legal 13 (sign-off 21.719) es requisito del flip. El agente ESCRIBE el dossier para revisión; NO lo firma ni flipea. `signoff: approved` lo provee el humano.
- **BrowserOS gated-preview:** Veredicto "comprensible" sobre las superficies MONEY en modo gated-preview (flag ON solo en preview local/operador, nunca en prod hasta el flip humano). Operador-gated.

### Claude's Discretion
Layout/densidad de las superficies MONEY dentro de las reglas anti-insinuación y el sistema de diseño (ficha ya montada). Reusar componentes existentes.

### Deferred Ideas (OUT OF SCOPE)
- El FLIP real (encendido MONEY) = acto humano exclusivo con sign-off legal — NO esta corrida.
- Cruce dinero × voto × timeline (MONEYX-01) → v2 (máquina de sospechas).
- El BrowserOS cold-read real requiere deploy/preview + datos (backfills operador) — operador-gated.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MONEY-04 | Toda superficie de dinero lleva procedencia inline + leyenda anti-insinuación; el vínculo "empresa ligada" se afirma solo con base RUT-exacta, nunca por name-match ni LLM. | Procedencia inline YA presente (`ProvenanceBadge` por fila, `[VERIFIED]`). DELTA: leyenda MONEY constante single-source + linter extendido a las 4 superficies con blocklist causal. La distinción RUT-vs-nombre YA está en el copy (`[VERIFIED: financiamiento-de-parlamentario.tsx:187]`). |
| MONEY-05 | `MONEY_PUBLIC_ENABLED` permanece OFF hasta el sign-off legal humano; el agente construye TODO hasta el gate, el encendido es acto humano. | Gate YA fail-closed `=== "true"` (`[VERIFIED: money-gate.ts:33]`). `.env.example=false` (`[VERIFIED]`). DELTA: guard CI anti-flip (molde en `servel-frozen-guard.test.ts §5`) + dossier 13 completado para sign-off. |
</phase_requirements>

## Architecture Patterns

### System Architecture Diagram (flujo de render + guards)

```
                    ┌─────────────────────────────────────────────┐
   HTTP request     │  Ruta (Server Component, Next 16)            │
   /parlamentario   │                                             │
   /contraparte ───►│  moneyPublicEnabled(process.env) === "true"?│
                    └──────────────┬───────────────┬──────────────┘
                                   │ OFF (default) │ ON (preview local)
                                   ▼               ▼
              ┌───────────────────────────┐  ┌──────────────────────────────┐
              │ ficha: <section pendiente> │  │ 4 superficies MONEY montadas  │
              │ (opacity-60, texto legal)  │  │ cada una:                     │
              │ contraparte: notFound()    │  │  [Leyenda MONEY 1×]  ◄─ DELTA │
              │  → 404 ruta entera         │  │  [Intro() RUT/nombre]         │
              └───────────────────────────┘  │  [filas + ProvenanceBadge]    │
                                             │  ↑ doble candado: + RLS DB     │
                                             └──────────────────────────────┘

   ── SUITE (vitest, escaneo estático, offline) ─────────────────────────────
   anti-insinuacion-guard.test.ts (EXTENDIDO) ──► lee 4 superficies + /contraparte
        stripTsComments → resta NEGACIONES (incl. leyenda MONEY) → blocklist causal
        → FALLA si aparece "financió"/"a cambio de"/"empresa ligada a"/…

   money-antiflip-guard.test.ts (NUEVO, molde servel-frozen §5) ──►
        lee money-gate.ts  → exige `=== "true"`, prohíbe Boolean(...) laxo
        lee .env.example    → exige `=false`, prohíbe `=true`
        walk(app/)          → prohíbe `process.env.MONEY_PUBLIC_ENABLED` fuera de money-gate.ts
        + mutation self-check EN MEMORIA (no es no-op)

   ── OPERADOR (fuera de la suite) ──────────────────────────────────────────
   docs/legal/13-LEGAL-DOSSIER.md  signoff: pending → approved (humano)
   BrowserOS cold-read con flag ON en preview local  → veredicto "comprensible"
   flip MONEY_PUBLIC_ENABLED=true en .env de prod     → acto humano post-sign-off
```

### Pattern 1: Leyenda como constante single-source (reuso del patrón Phase 68)
**What:** La leyenda de voto vive como `export const LEYENDA_ANTI_INSINUACION` en `app/lib/voto-presentacion.ts` y se importa donde se renderiza. La misma constante se referencia (verbatim) en `NEGACIONES_LOCKED` del guard para que no se auto-cace.
**When to use:** Idéntico para MONEY. Crear `LEYENDA_ANTI_INSINUACION_MONEY` (nueva constante, texto LOCKED §Leyenda del UI-SPEC) en `app/lib/` e importarla desde las 4 superficies + el guard.
**Example:**
```typescript
// Source: [VERIFIED: app/lib/voto-presentacion.ts:58-59]
export const LEYENDA_ANTI_INSINUACION =
  "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.";
```
```tsx
// Source: [VERIFIED: app/components/votos-por-parlamentario.tsx:637-640]
<p className="text-sm text-muted-foreground border-l-[3px] border-[--accent-product] pl-2.5">
  {LEYENDA_ANTI_INSINUACION}
</p>
```
Nota de color: el voto usa `border-[--accent-product]`; el UI-SPEC §Leyenda de MONEY pide `border-[--primary]` (petróleo). Ambos tokens resuelven al mismo petróleo; seguir el UI-SPEC literal (`border-l-[3px] border-[--primary] pl-2.5 mb-4`).

### Pattern 2: Guard anti-flip = escaneo estático + mutation self-check (molde Phase 71)
**What:** Un `*.test.ts` que lee archivos (no runtime), afirma invariantes por regex, y añade un self-check en memoria para no ser un no-op verde.
**When to use:** El guard anti-flip MONEY. El §(5) de `servel-frozen-guard.test.ts` YA tiene las dos aserciones núcleo — copiarlas y ampliar con el escaneo no-raw-env.
**Example:**
```typescript
// Source: [VERIFIED: packages/dinero/src/servel-frozen-guard.test.ts:404-418]
it('money-gate.ts enciende SOLO con el literal "true" (fail-closed, sin truthiness laxa)', () => {
  const gate = readFileSync(MONEY_GATE, "utf-8");
  expect(/MONEY_PUBLIC_ENABLED\s*===\s*["']true["']/.test(gate)).toBe(true);
  expect(/Boolean\s*\(\s*[^)]*MONEY_PUBLIC_ENABLED/.test(gate)).toBe(false);
});
it(".env.example trae MONEY_PUBLIC_ENABLED=false (OFF por defecto)", () => {
  const env = readFileSync(ENV_EXAMPLE, "utf-8");
  expect(/^MONEY_PUBLIC_ENABLED\s*=\s*false\s*$/m.test(env)).toBe(true);
  expect(/^MONEY_PUBLIC_ENABLED\s*=\s*true\s*$/m.test(env)).toBe(false);
});
```
**Delta a añadir:** un tercer bloque que camine `app/` (reusar `walkSourceFiles` + `SKIP_DIRS` del lockdown-guard) y FALLE si `process.env.MONEY_PUBLIC_ENABLED` (o `env.MONEY_PUBLIC_ENABLED`) aparece FUERA de `app/lib/money-gate.ts` — el chokepoint único. Más un escaneo de workflows/config committeada (`.github/`, `wrangler.*`, `.env.example`) por `MONEY_PUBLIC_ENABLED=true`.

### Pattern 3: Linter extendido = reusar helpers, ampliar constantes (Phase 68)
**What:** El guard de voto expone `stripTsComments`, `buildTermRegex`, `detectarInsinuaciones`, y tres listas: `SUPERFICIES_VOTO`, `TERMINOS_PROHIBIDOS`, `NEGACIONES_LOCKED`. La ausencia de un archivo se SALTA sin fallar.
**When to use:** Extender el MISMO archivo. Añadir un `SUPERFICIES_MONEY` (4 componentes + `app/contraparte/[id]/page.tsx`); la sección MONEY de `app/parlamentario/[id]/page.tsx` ya está en `SUPERFICIES_VOTO`. Añadir los términos causales MONEY a `TERMINOS_PROHIBIDOS`. Añadir la leyenda MONEY verbatim a `NEGACIONES_LOCKED`.
**Decisión de diseño (Claude's discretion):** el UI-SPEC §Linter dice "extender `SUPERFICIES`". Dos rutas válidas: (a) un solo array `SUPERFICIES` combinado, o (b) `SUPERFICIES_VOTO` + `SUPERFICIES_MONEY` concatenados. Preferir (b) por legibilidad del corte (voto vs dinero) y para mantener el diff mínimo sobre el array existente.

### Anti-Patterns to Avoid
- **Regenerar la constante de leyenda inline en cada superficie:** rompe el single-source; el guard entonces tendría que restar 4 strings. Una constante, importada.
- **Guard que solo lee `money-gate.ts`:** insuficiente. El UI-SPEC §Guard exige 3 vectores (relajar `===`, meter `=true` en repo, leer raw env en ruta). Los tres deben tener assertion + mutation self-check.
- **Añadir `financió`/`a cambio de` a la blocklist SIN restar la leyenda MONEY:** falso positivo garantizado — la leyenda NIEGA "influencia"/"intención"/"irregularidad". Restar la leyenda ANTES del match (ya es el patrón de voto con "disciplina").
- **Firmar o flipear desde el agente:** PROHIBIDO. El agente escribe el dossier con `signoff: pending`; jamás edita a `approved` ni pone `=true`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Strip de comentarios TS antes de regex | Un parser propio | `stripTsComments` (existe verbatim en 3 guards) | Ya maneja el edge `://` en URLs (falso negativo si se corta). `[VERIFIED]` |
| Límite de palabra tolerante a acentos | `\b` de JS | `buildTermRegex` + `WORD` de Phase 68 | `\b` trata `á` como no-palabra → falsos positivos/negativos. `[VERIFIED]` |
| Walk recursivo de `app/` saltando build dirs | `readdirSync` a mano | `walkSourceFiles` + `SKIP_DIRS` del lockdown-guard | Ya salta `.next`, `.open-next`, `node_modules`, etc. `[VERIFIED]` |
| Aserción fail-closed del gate | Regex nuevo | `servel-frozen-guard.test.ts §5` verbatim | Ya prueba `=== "true"` + no-Boolean-laxo + `.env.example`. `[VERIFIED]` |
| Leyenda + border petróleo | CSS nuevo | Clases del rail de voto (`border-l-[3px] border-[--primary] pl-2.5`) | Patrón visual ya aprobado por ui-checker en Phase 68. |

**Key insight:** Esta fase NO tiene lógica nueva que inventar — es composición y extensión de moldes ya validados por verifiers Opus en Phases 68/70/71. El riesgo no es técnico sino de FIDELIDAD verbatim (leyenda LOCKED, blocklist completa, dossier honesto).

## Runtime State Inventory

> Fase aditiva de UI + tests + doc. No es rename/refactor/migración de datos, pero por rigor:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguno — no se toca DB, ni RPC, ni migración. Verificado: los datos MONEY (contratos/aportes/cruce_senal) los produjeron Phases 70/71/72. | Ninguna |
| Live service config | `MONEY_PUBLIC_ENABLED` vive en `.env` (no committeado) y en el entorno de prod. **PERMANECE OFF.** El flip es acto operador post-sign-off, FUERA de esta corrida. | Ninguna (agente); flip = operador |
| OS-registered state | Ninguno. | Ninguna |
| Secrets/env vars | `MONEY_PUBLIC_ENABLED` — solo se LEE via `moneyPublicEnabled()`; ninguna ruta la lee cruda (`[VERIFIED]`: los 3 consumidores importan la función). El guard nuevo congela esa invariante. | Ninguna |
| Build artifacts | Ninguno. Los `*.test.ts` corren desde fuente; sin artefactos generados. | Ninguna |

## Common Pitfalls

### Pitfall 1: Leyenda MONEY no restada del linter → falso positivo permanente
**What goes wrong:** Se añade `empresa ligada a`, `influencia`, `conflicto de interés` a la blocklist, pero la leyenda MONEY (que dice "…no es una afirmación de irregularidad. No medimos influencia ni intención…") queda en el render → el guard falla sobre la propia leyenda.
**Why it happens:** La leyenda enfuerza la regla usando las palabras que niega.
**How to avoid:** Añadir la constante `LEYENDA_ANTI_INSINUACION_MONEY` verbatim a `NEGACIONES_LOCKED`. Es EXACTAMENTE el patrón de "disciplina" en voto (`[VERIFIED: guard línea 135-137]`). Añadir un test de no-falso-positivo que monte la leyenda y espere `[]`.
**Warning signs:** El linter falla apuntando a la superficie que SÍ tiene la leyenda correcta.

### Pitfall 2: Blocklist con acentos mal escritos
**What goes wrong:** `financio` (sin tilde) no caza `financió` (con tilde); `buildTermRegex` es case-insensitive pero NO accent-insensitive.
**Why it happens:** El comentario del guard lo advierte: "Los acentos importan: los términos con tilde se buscan CON la tilde."
**How to avoid:** Escribir los términos MONEY con su tilde exacta: `financió`, `favoreció`, `corrupción`, `soborno` (sin tilde), `coima`, `conflicto de interés`. Multi-palabra usa `\s+` automático.
**Warning signs:** El mutation self-check `<p>…financió su voto a cambio de un contrato</p>` no caza `financió`.

### Pitfall 3: `empresa ligada a` como término bloqueado vs. el hecho permitido "ligada por RUT"
**What goes wrong:** Bloquear "empresa ligada a" cazaría también el idiom factual permitido.
**Why it happens:** La regla es sutil: "ligada por RUT" (hecho) SÍ; "ligada a [irregularidad]" (insinuación) NO.
**How to avoid:** El copy renderizado hoy NO usa "empresa ligada" (usa "Enlazado por RUT al parlamentario." / "Asociado por nombre confirmado…" `[VERIFIED]`). El término bloqueado debe ser la frase insinuante `empresa ligada a` (con la preposición `a`), no `ligada por RUT`. Añadir test de no-falso-positivo con `empresa_ligada_por_rut` (snake_case, no dispara por límite de palabra) y con la frase factual real.
**Warning signs:** El guard falla sobre un componente que solo dice "Enlazado por RUT".

### Pitfall 4: Guard anti-flip que no muerde el vector "raw env en ruta"
**What goes wrong:** El guard solo verifica `money-gate.ts` y `.env.example`, pero un agente añade `if (process.env.MONEY_PUBLIC_ENABLED === "true")` directo en una nueva ruta MONEY, bypasseando el chokepoint.
**Why it happens:** El UI-SPEC §Guard lista tres vectores; es fácil implementar solo dos.
**How to avoid:** Walk de `app/` (reusar `walkSourceFiles`), FALLA si `MONEY_PUBLIC_ENABLED` aparece en cualquier `.ts/.tsx` que NO sea `app/lib/money-gate.ts`. Mutation self-check con un fixture que simule una ruta leyendo raw env.
**Warning signs:** El guard pasa aunque una ruta lea la env cruda.

### Pitfall 5: Editar el gate OFF por "conveniencia de testing"
**What goes wrong:** Para probar el render ON, alguien cambia `.env.example` a `=true` o relaja el gate.
**Why it happens:** El render ON solo se ve con el flag encendido.
**How to avoid:** Los tests de render (RTL) montan las **Views puras** (`ContratosView`, `FinanciamientoView`) con fixtures — NO pasan por el gate (`[VERIFIED]`: las Views son `export function …View({data})` sin gate). El gate se testea por separado en `money-gate.test.ts`. La leyenda se prueba montando la View, no la Section.
**Warning signs:** El guard anti-flip falla sobre `.env.example` o `money-gate.ts`.

## Code Examples

### Constante de leyenda MONEY (nueva, single-source)
```typescript
// Nuevo: app/lib/money-presentacion.ts (o añadir a un lib MONEY existente)
// Texto LOCKED verbatim de 73-UI-SPEC §Leyenda / §Copywriting.
export const LEYENDA_ANTI_INSINUACION_MONEY =
  "Un contrato o un aporte registrado es un hecho público observable. Un vínculo por RUT es una coincidencia exacta de identificador, no una afirmación de irregularidad. No medimos influencia ni intención, ni afirmamos que un aporte compre una decisión.";
```

### Leyenda montada al tope de una superficie (encima del Intro)
```tsx
// Patrón: primer hijo de la View, ANTES de <Intro/>. UI-SPEC §Leyenda:
// border-l-[3px] border-[--primary] pl-2.5 mb-4
<p className="text-sm text-muted-foreground border-l-[3px] border-[--primary] pl-2.5 mb-4">
  {LEYENDA_ANTI_INSINUACION_MONEY}
</p>
```

### Extensión del linter (fragmentos a añadir en anti-insinuacion-guard.test.ts)
```typescript
// Source: [VERIFIED: patrón de app/lib/anti-insinuacion-guard.test.ts]
const SUPERFICIES_MONEY: string[] = [
  "components/contratos-de-parlamentario.tsx",
  "components/financiamiento-de-parlamentario.tsx",
  "components/contratos-por-contraparte.tsx",
  "components/aportes-por-contraparte.tsx",
  "app/contraparte/[id]/page.tsx",
  // app/parlamentario/[id]/page.tsx YA está en SUPERFICIES_VOTO.
];

const TERMINOS_PROHIBIDOS_MONEY: string[] = [
  "financió", "financió su voto", "a cambio de", "a cambio del voto",
  "compró", "compró su voto", "pagó por", "soborno", "coima",
  "corrupción", "favoreció", "empresa ligada a", "conflicto de interés",
  "influencia", "captura", "lobby a cambio", "contrato a dedo", "direccionado",
];

// Restar la leyenda MONEY (contiene "influencia"/"intención"/"irregularidad" NEGADAS):
// NEGACIONES_LOCKED.push(LEYENDA_ANTI_INSINUACION_MONEY)  ← verbatim
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Leyenda inline por componente | Constante single-source importada + restada del guard | Phase 68 | Una edición del copy = un solo lugar; el guard no se auto-caza. |
| Gate por truthiness (`Boolean(env)`) | Estricto `=== "true"` fail-closed | Phase 13 | `"false"`/`"1"`/`"TRUE"` no encienden. Congelado por guard. |
| Guard como CLI `node`/`tsx` separado | Guard-as-test (`*.test.ts` en la suite) | Phases 42/68/71 | No hay CI dedicado; la suite `pnpm test` lo recoge y el gate GSD verify-work lo corre. |

**Deprecated/outdated:** Nada que deprecar en esta fase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La leyenda MONEY va en un lib nuevo `app/lib/money-presentacion.ts` | Code Examples | Bajo — el planner puede elegir otro lib MONEY existente; es discreción de ubicación, no de contenido. El texto es LOCKED. |
| A2 | `border-[--primary]` y `border-[--accent-product]` resuelven al mismo petróleo | Pattern 1 | Bajo — verificable en el design-system; el UI-SPEC manda `--primary` explícito. Seguir el UI-SPEC. |
| A3 | El dossier 13 solo necesita completarse/reafirmarse (ya existe con estructura completa) | Legal dossier | Bajo — el dossier ya cubre las 9 secciones + checklist + supuestos A1-A8. El delta es confirmar que el YAML `signoff: pending` y la dependencia del flip siguen presentes; posiblemente añadir referencia a las Phases 70-72 ya ejecutadas. |

**Nota:** El texto de la leyenda MONEY y la blocklist provienen del UI-SPEC LOCKED (`[CITED: 73-UI-SPEC.md §Leyenda / §Linter]`), no de conocimiento del modelo — no requieren confirmación de usuario más allá de lo ya lockeado en CONTEXT.

## Open Questions

1. **¿La leyenda MONEY se monta en la View pura o en la Section?**
   - What we know: la leyenda debe preceder a `<Intro/>`; las Views (`ContratosView`, etc.) son las que renderizan `<Intro/>`.
   - What's unclear: si va dentro de la View (se ve en TODOS los estados: no_consultado/consultado/enlazado) o solo en el estado enlazado.
   - Recommendation: DENTRO de la View, como primer hijo de CADA rama de estado (el UI-SPEC §Leyenda dice "primer hijo de cada Section, encima del Intro" — y el marco honesto debe preceder incluso al empty-state). Los 4 componentes tienen 3/2 ramas de retorno; la leyenda va en todas. Los tests RTL ya cubren cada estado → añadir aserción de leyenda por estado.

2. **¿El guard anti-flip vive en `app/lib/` o en `packages/dinero/src/`?**
   - What we know: `servel-frozen-guard` vive en `packages/dinero/src`; `anti-insinuacion-guard`/`lockdown-guard` viven en `app/lib`. El guard nuevo debe leer `money-gate.ts` (en `app/`), `.env.example` (raíz) y caminar `app/`.
   - What's unclear: qué proyecto vitest.
   - Recommendation: `app/lib/money-antiflip-guard.test.ts` — corre en el proyecto `app` (que tiene acceso a `walkSourceFiles`/`SKIP_DIRS` del lockdown-guard vecino y a `app/` sin cruzar proyectos). `.env.example` se lee vía `path.resolve(APP_ROOT, "..", ".env.example")` (el lockdown-guard ya sube un nivel a `REPO_ROOT`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm + vitest | suite (guards, linter, RTL) | ✓ (usado en Phases 68-72) | ya instalado | — |
| Next 16 typegen (`node_modules/next/dist/docs`) | montaje de leyenda en Server Component | ✓ (repo activo) | 16 | — |
| BrowserOS + deploy/preview | cold-read gated-preview | ✗ en la suite (operador) | — | Operador-gated; NO bloquea la fase offline |

**Missing dependencies with no fallback:** ninguna para el trabajo del agente.
**Missing dependencies with fallback:** BrowserOS cold-read → operador (preview local con flag ON); no es parte de la corrida autónoma.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (raíz orquesta `packages/*` + `app`) `[VERIFIED: package.json:9]` |
| Config file | `app/vitest.config.ts` (app corre desde `app/`); `packages/dinero/vitest.config.ts` |
| Quick run command | `pnpm --filter ./app test` (para leyenda + linter + anti-flip guard) |
| Full suite command | `pnpm test` (= `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONEY-04 | Leyenda MONEY verbatim 1× en cada superficie (4), en cada estado | unit (RTL) | `pnpm --filter ./app test contratos-de-parlamentario` (y 3 más) | ✅ extender (los 4 `.test.tsx` existen) |
| MONEY-04 | Linter: cero términos causales en el render de las 4 superficies + `/contraparte` | guard (vitest) | `pnpm --filter ./app test anti-insinuacion-guard` | ✅ extender |
| MONEY-04 | Linter muerde ante `financió su voto a cambio de` (mutation self-check MONEY) | guard (vitest) | idem | ✅ extender |
| MONEY-04 | No-falso-positivo: leyenda MONEY + "Enlazado por RUT" + `empresa_ligada_por_rut` no disparan | guard (vitest) | idem | ✅ extender |
| MONEY-05 | Gate fail-closed `=== "true"`, `.env.example=false`, no-raw-env en rutas | guard (vitest) | `pnpm --filter ./app test money-antiflip-guard` | ❌ Wave 0 (nuevo, molde servel-frozen §5) |
| MONEY-05 | Anti-flip muerde ante `Boolean(env)` laxo / `=true` / raw-env-en-ruta | guard (vitest) | idem | ❌ Wave 0 |
| MONEY-05 | Dossier 13 conserva `signoff: pending` y la dependencia del flip | doc (inspección) + opcional test | `pnpm --filter ./app test money-antiflip-guard` (puede afirmar el YAML) | ⚠️ opcional |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test <archivo tocado>` (leyenda RTL, linter, o anti-flip guard).
- **Per wave merge:** `pnpm --filter ./app test` (todo app: RTL + guards).
- **Phase gate:** `pnpm test` verde (raíz, incluye `packages/dinero` servel-frozen §5 que también re-verifica el gate OFF) antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `app/lib/money-antiflip-guard.test.ts` — cubre MONEY-05 (nuevo; molde `packages/dinero/src/servel-frozen-guard.test.ts §5` + walk `app/` no-raw-env + mutation self-check).
- [ ] `app/lib/money-presentacion.ts` (o lib MONEY) con `LEYENDA_ANTI_INSINUACION_MONEY` — fuente de la leyenda + negación del linter.
- [ ] Framework: ninguna instalación; vitest/RTL ya presentes.

*(Los 4 `*.test.tsx` de superficie y `anti-insinuacion-guard.test.ts` YA existen → se extienden, no se crean.)*

## Security Domain

> `security_enforcement` no está explícitamente `false` en config → incluido.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | **yes** | Doble candado: gate presentación `moneyPublicEnabled()` (deny-by-default, `=== "true"`) + RLS DB deny-by-default. `/contraparte` = `notFound()` primera sentencia (404 ruta entera). `[VERIFIED]` |
| V5 Input Validation | yes | `CONTRAPARTE_ID_RE.test(id)` antes de tocar DB; id validado como `c:<rut>`/`d:<nombre>`. `[VERIFIED: page.tsx:59]` |
| V6 Cryptography | no | — |
| V7 Data Protection / PII | **yes** | RUT de terceros NUNCA renderizado (Ley 21.719); el RPC no lo proyecta; `import "server-only"` mantiene el flag fuera del bundle. Guard lockdown ya escanea `.from()` PII. `[VERIFIED]` |
| V14 Configuration | **yes** | Flag sin prefijo `NEXT_PUBLIC_`; `.env.example=false`; guard anti-flip congela el default. `[VERIFIED]` |

### Known Threat Patterns for esta fase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Agente flipea el flag por error/deriva | Tampering / Elevation | Guard anti-flip (3 vectores) + mutation self-check; flip requiere `signoff: approved` humano. |
| Ruta nueva lee raw env, bypassa chokepoint | Tampering | Guard walk `app/`: `MONEY_PUBLIC_ENABLED` solo en `money-gate.ts`. |
| Copy insinúa causalidad dinero→voto (defamación) | Repudiation / reputación | Linter blocklist causal + mutation self-check; leyenda anti-insinuación 1× por superficie. |
| Filtración de existencia de contraparte con gate OFF | Information Disclosure | `notFound()` es la PRIMERA sentencia (antes de params/RPC/heading). `[VERIFIED: page.tsx:50]` |
| RUT de tercero al cliente | Information Disclosure | RPC no proyecta RUT; server-only flag; guard PII. `[VERIFIED]` |

## Sources

### Primary (HIGH confidence)
- `app/lib/money-gate.ts` — gate fail-closed `=== "true"`, server-only, sin `NEXT_PUBLIC_`.
- `app/lib/money-gate.test.ts` — los 5 casos del gate (ausente/false/1/TRUE/true).
- `app/lib/anti-insinuacion-guard.test.ts` — molde del linter (Phase 68): `stripTsComments`, `buildTermRegex`, `SUPERFICIES_VOTO`, `TERMINOS_PROHIBIDOS`, `NEGACIONES_LOCKED`, mutation self-check, no-falsos-positivos.
- `packages/dinero/src/servel-frozen-guard.test.ts §5` — aserciones anti-flip del gate MONEY ya escritas.
- `app/lib/lockdown-guard.test.ts` — `walkSourceFiles`, `SKIP_DIRS`, escaneo estático de `app/`, allowlists.
- `app/components/contratos-de-parlamentario.tsx` / `financiamiento-de-parlamentario.tsx` — superficies ficha: gate, Views puras, "Enlazado por RUT" / "Asociado por nombre confirmado", ProvenanceBadge, cero cómputo.
- `app/app/contraparte/[id]/page.tsx` — `notFound()` primera sentencia, dos carriles `mt-12`, validación de id.
- `app/app/parlamentario/[id]/page.tsx` — montaje gated de #dinero/#financiamiento + carril `#financiamiento-pendiente` (gate OFF).
- `app/lib/voto-presentacion.ts` — `LEYENDA_ANTI_INSINUACION` (patrón single-source de leyenda).
- `docs/legal/13-LEGAL-DOSSIER.md` — dossier existente, `signoff: pending`, 9 secciones + checklist + supuestos.
- `.env.example:64` — `MONEY_PUBLIC_ENABLED=false`.
- `.planning/REQUIREMENTS.md` — MONEY-04, MONEY-05 (Pending, Phase 73).
- `package.json` — comando de suite.
- `73-UI-SPEC.md` / `73-CONTEXT.md` — contrato visual + decisiones LOCKED (leyenda verbatim, blocklist, RUT-vs-nombre, guard, dossier).

### Secondary (MEDIUM confidence)
- Ninguna — todo verificado por lectura directa del repo.

### Tertiary (LOW confidence)
- Ninguna.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero paquetes nuevos; todo instalado y usado en Phases 68-72.
- Architecture: HIGH — los tres deltas (leyenda, linter, guard) tienen molde verbatim en el repo.
- Pitfalls: HIGH — derivados de los comentarios LOCKED de los guards existentes.
- Legal/dossier: HIGH (mecánica) / N-A (contenido legal es preparación, no dictamen — el sign-off es humano).

**Research date:** 2026-07-14
**Valid until:** 2026-08-14 (estable; el repo es la fuente y no cambia bajo el agente en esta fase)

---

**Offline-testable (agente, corrida autónoma):**
1. Leyenda MONEY single-source + montaje 1× por superficie → RTL sobre las 4 Views.
2. Linter extendido (SUPERFICIES_MONEY + blocklist causal + negación de leyenda) → guard vitest + mutation self-check + no-falsos-positivos.
3. Guard anti-flip (3 vectores: relajar `===`, `=true` en repo, raw-env-en-ruta) → guard vitest nuevo + mutation self-check.
4. Dossier 13 completado/reafirmado para sign-off humano (`signoff: pending` conservado).

**Operador (fuera de la corrida):**
- BrowserOS cold-read "comprensible" con flag ON en preview local (nunca prod).
- Sign-off legal humano 21.719 → `signoff: approved`.
- Flip `MONEY_PUBLIC_ENABLED=true` en `.env` de prod (acto humano post-sign-off).

## RESEARCH COMPLETE

**Phase:** 73 - DINERO P5e — Superficies MONEY gated OFF + linter + GATE LEGAL humano
**Confidence:** HIGH

### Key Findings
- **Todo el sustrato ya existe y está cableado:** gate `moneyPublicEnabled` (fail-closed `=== "true"`), las 4 superficies MONEY, sus RPCs, el carril "pendiente" (gate OFF), la distinción RUT-vs-nombre en el copy, ProvenanceBadge por fila, y el dossier 13 (`signoff: pending`). La fase es ADITIVA, no crea.
- **El guard anti-flip tiene molde verbatim** en `packages/dinero/src/servel-frozen-guard.test.ts §5` (aserciones `=== "true"` + no-Boolean-laxo + `.env.example=false`); el delta es añadir el vector "no raw env en ruta" (walk `app/`) + mutation self-check.
- **La leyenda es single-source** (patrón `LEYENDA_ANTI_INSINUACION` de Phase 68 en `app/lib/voto-presentacion.ts`); crear `LEYENDA_ANTI_INSINUACION_MONEY` (texto LOCKED del UI-SPEC), importarla en las 4 superficies Y restarla en `NEGACIONES_LOCKED` del linter.
- **El linter extiende (no reescribe):** reusar `stripTsComments`/`buildTermRegex`/`detectarInsinuaciones`; añadir `SUPERFICIES_MONEY`, blocklist causal MONEY (con tildes exactas), y la leyenda a las negaciones.
- **El corte offline/operador es nítido:** guard + linter + leyenda + dossier = agente; BrowserOS cold-read + sign-off + flip = operador. Ningún cambio del agente toca el gate, la RLS, ni el sign-off.

### File Created
`.planning/phases/73-dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano/73-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Cero paquetes nuevos; todo instalado y usado en 68-72. |
| Architecture | HIGH | Tres deltas con molde verbatim en el repo. |
| Pitfalls | HIGH | Derivados de comentarios LOCKED de guards existentes. |

### Open Questions
1. Leyenda en la View pura (todos los estados) vs. solo enlazado → recomendado: en todas las ramas de estado.
2. Ubicación del guard anti-flip (`app/lib/` vs `packages/dinero/`) → recomendado: `app/lib/money-antiflip-guard.test.ts`.

### Ready for Planning
Research completo. El planner puede crear PLAN.md: (Wave 0) `money-presentacion.ts` + `money-antiflip-guard.test.ts`; (Wave 1) montaje de leyenda en las 4 superficies + RTL; (Wave 2) extensión del linter + mutation self-check; (Wave 3) dossier 13 completado. Todo offline; BrowserOS/sign-off/flip quedan como deuda de operador.
