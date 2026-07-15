# Phase 78: BENTO-HOME-ACTUALIDAD — Votado/urgencias/frescura como tiles - Research

**Researched:** 2026-07-15
**Domain:** Next.js 16 RSC presentation migration — restyle 3 existing server components (`ActualidadModule` blocks) into `BentoTile` children. 100% presentation; one sanctioned single-column data addition.
**Confidence:** HIGH (codebase-verified; all facts read from source files this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tile "Votado esta semana" (span-4):** barra 3px por cámara usando `--camara`/`--senado` (civic tokens) — NUNCA hex del mockup. Desenlace + tally en Geist Mono con en-dash (formato EXISTENTE — no inventar). Fecha + cámara en mono 12px. Link "Fuente ↗" por ítem vía `safeExternalHref`. "Ver todo →" al destino existente. Empty state honesto: "Sin votaciones registradas esta semana" — nunca datos de ejemplo del mockup.
- **Tile "Urgencias vigentes" (span-2):** chip pill del tipo (`suma`/`simple`) con fondo derivado de `--accent-product-soft` (por token). "desde {fecha}" en mono. Fuente de datos = `urgenciaVigente()` existente. Empty state honesto.
- **Strip "Última actualización de datos" (span-6):** dot 6px petróleo (token) + fuente + fecha mono, `flex-wrap`. Mismas fuentes que hoy (solo tablas NO-PII). Condicional si no hay datos.
- **Migración:** `ActualidadModule` lineal RETIRADO del render y sus tests MIGRADOS a los tiles (incluyendo empty states). Datos/fetchers/RPCs idénticos — solo cambia la capa de presentación. Tiles integrados al `BentoGrid` existente. Orden colapso ≤md: hero → cómo-leer → entradas → votado → urgencias → frescura.

### Claude's Discretion
- Si los fetchers viven en `ActualidadModule` o se extraen: preferir mover la lógica de datos tal cual a los nuevos componentes tile o mantener un módulo contenedor — lo que minimice el diff de la capa de datos (cero cambios de queries).
- Tailwind: `[var(--token)]` siempre; cero hex.

### Deferred Ideas (OUT OF SCOPE)
- Responsive/a11y/dark formales + candados → Phase 80.
- Verificación visual → Phase 79/81.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENTO-03 | Migrar los 3 bloques de `ActualidadModule` (Votado span-4, Urgencias span-2, Frescura strip span-6) a tiles del `BentoGrid` de la home; retirar el módulo lineal; cero cambios de query salvo el `camara` sancionado; empty states honestos preservados. | `actualidad-module.tsx` (fetchers + `*View` + helpers verbatim), `bento-tile.tsx` (`variant`/`span`/`asChild`), `page.tsx` (montaje + retiro `<ActualidadModule/>`), civic-tokens + globals theme wiring (bar/chip por token), `actualidad-module.test.tsx` + `page.test.tsx` (migración test-por-test). |
</phase_requirements>

## Summary

Phase 78 es una **migración de presentación pura sobre server components que ya existen y funcionan**. Los tres fetchers async (`VotadoEstaSemana`, `UrgenciasVigentes`, `UltimaActualizacion`), sus `*View` presentacionales, los helpers (`inicioSemanaIso`, `fechaValida`, `leerTitulos`, `FUENTES_FRESCURA`), la disciplina `#34` (throw-on-read-error), los tres empty-states honestos distintos, y el reuso de `urgenciaVigente()` viven todos en `app/components/actualidad-module.tsx` (447 líneas, un solo archivo) y **se conservan verbatim**. Lo único que cambia es la cáscara: el helper `Panel` (`rounded-lg border border-border bg-card p-6`) y el wrapper `ActualidadModule` (`<section aria-label="Actualidad" class="mx-auto max-w-5xl …">` + `md:grid-cols-3`) se retiran; cada `*View` se re-monta dentro de un `<BentoTile>` con el span correcto, dentro del **mismo `<BentoGrid>`** que ya usa el hero (Phase 77).

Hay **exactamente un toque de datos sancionado**: la query de `VotadoEstaSemana` (línea 158) hoy selecciona `boletin, resultado, total_si, total_no, fecha, enlace` — NO trae `camara`. Para dibujar la barra 3px de cámara de forma honesta hay que añadir `camara` a ese **mismo `.select()` sobre la misma tabla NO-PII `votacion`** (columna real: `VotacionRow.camara: "diputados" | "senado"`, types.ts:61) y enhebrarla como campo opcional de `VotadoItem`. No es query nueva, RPC, join ni superficie PII. Si el planner lo juzga fuera de alcance, el fallback es no dibujar barra ni label de cámara (el tile sigue funcionando).

**Hallazgo bloqueante para "Ver todo →":** NO existe ruta `/votaciones` ni equivalente (lista de rutas verificada: `buscar`, `parlamentarios`, `parlamentario/[id]`, `proyecto/[boletin]`, `agenda`, `sobre`, `metodologia`, `contraparte/[id]`, `red`, `admin/revisar-entidades`). El UI-SPEC autoriza OMITIR el link antes que enlazar a un 404. **Recomendación: OMITIR "Ver todo →" este fase** (no inventar destino).

**Primary recommendation:** Restilar los 3 `*View` in-place (drop `Panel`, envolver cada fetcher en `<BentoTile variant="default" span={N} asChild>` con `<section>`), montarlos directamente en el `<BentoGrid>` de `page.tsx` bajo las entry tiles en orden votado→urgencias→frescura, borrar el wrapper `ActualidadModule` + `Panel`, añadir `camara` al select de Votado, y migrar los tests 1:1. Cero query nueva, cero hex, cero JS cliente.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lectura de votaciones/urgencias/frescura | API / Backend (Supabase, server-side) | — | `createServerSupabase()` en RSC; `force-dynamic` por request. Ya montado, no cambia. |
| Derivación de urgencia vigente | Frontend Server (RSC) | — | `urgenciaVigente()` puro corre server-side sobre filas leídas. Reuso verbatim. |
| Presentación (tiles, barra cámara, chip, dot) | Frontend Server (RSC, SSR) | — | Server Components, cero client JS. `SearchBox` sigue siendo el único island. |
| Ruteo/colapso responsive del grid | Frontend Server + CSS | Browser (media query) | `BentoTile` mapea `span` a `md:col-span-N`; base full-width. Colapso lo resuelve CSS grid, sin JS. |
| Guard de href externo | Frontend Server | — | `safeExternalHref()` neutraliza `javascript:`/`data:` antes de render. Verbatim. |

**Nota:** ninguna capacidad se mueve de tier este fase. Es restyle dentro del mismo tier (RSC). El único delta de datos (`camara` en el select) permanece en el tier API/backend, sobre una tabla ya leída.

## Standard Stack

Sin paquetes nuevos. El stack de este fase es 100% código existente del repo.

### Core (existente, reusado verbatim)
| Módulo | Ubicación | Rol este fase |
|--------|-----------|---------------|
| `BentoTile` | `app/components/bento/bento-tile.tsx` | Cáscara de cada tile: `variant="default"` (bg-card + border + `rounded-[var(--radius-tile)]` + `hover:border-accent-product` + `focus-visible:ring`), `span={4\|2\|6}`, `asChild` (Slot → envuelve `<section>`). |
| `BentoGrid` | `app/components/bento/bento-grid.tsx` | Grid 6-col gap-14px ya montado en `page.tsx`; los 3 tiles se APPEND como hijos. |
| `safeExternalHref` | `app/lib/utils.ts:15` | Guard http/https del `enlace` de votación. Verbatim. |
| `fechaCorta`, `conteoVotacion` | `app/lib/format.ts:21,96` | Fecha corta es-CL y tally `58–81` (en-dash U+2013). Verbatim — NUNCA re-implementar el formato. |
| `urgenciaVigente` | `app/components/estado-actual-block.tsx:51` | Deriva urgencia vigente por boletín (import existente). Verbatim. |
| `createServerSupabase` | `app/lib/supabase` | Cliente server-side (service_role, RLS-bypass tras guard CI). Sin cambios. |
| `VotacionRow`, `TramitacionEventoRow`, `ProyectoRow` | `app/lib/types.ts` | Tipos de fila. `VotacionRow.camara` (línea 61) es el campo a proyectar. |

**Installation:** ninguna. `pnpm` install intacto; cero deps nuevas.

**Version verification:** N/A — no se instala nada. `## Package Legitimacy Audit` omitido (este fase no instala paquetes externos).

## Architecture Patterns

### System Architecture Diagram

```
                     ┌───────────────────────────────────────────────┐
  request /  ───────>│  app/app/page.tsx  (export dynamic="force-dyn")│
                     │  <main><div max-w-1120px><BentoGrid>            │
                     │    ├─ Hero tile (span-4)      [Phase 77]        │
                     │    ├─ Accent tile (span-2)    [Phase 77]        │
                     │    ├─ 3 Entry tiles (span-2)  [Phase 77]        │
                     │    ├─ <Suspense> VotadoEstaSemana  (span-4) ◄── NEW mount
                     │    ├─ <Suspense> UrgenciasVigentes (span-2) ◄── NEW mount
                     │    └─ <Suspense> UltimaActualizacion(span-6) ◄── NEW mount
                     │  </BentoGrid></div></main>                      │
                     │  ✗ <ActualidadModule/> RETIRADO                 │
                     └───────────────┬───────────────────────────────┘
                                     │ (each fetcher, server-side)
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
   VotadoEstaSemana()      UrgenciasVigentes()     UltimaActualizacion()
   sb.from("votacion")     sb.from("tramitacion_   FUENTES_FRESCURA.map →
   .select(...,camara◄NEW)   evento").ilike(         sb.from(tabla)
   .gte(inicioSemanaIso)     "%urgencia%")            .select("fecha_captura")
   .order.limit(6)         → urgenciaVigente()        .order.limit(1)
      │                       (derive por boletín)       │  (6 tablas NO-PII)
      ▼                          │                        ▼
   leerTitulos(sb,…)             ▼                     [FrescuraItem]
   sb.from("proyecto")        leerTitulos(sb,…)           │
      │                          │                        │
      ▼ throw on error(#34)      ▼ throw(#34)             ▼ throw(#34)
   <VotadoEstaSemanaView>    <UrgenciasVigentesView>  <UltimaActualizacionView>
   restilado → <BentoTile span=4>  → <BentoTile span=2>  → <BentoTile span=6>
```

Trazar el caso primario: `/` → `page.tsx` monta 3 `<Suspense>` → cada fetcher lee su(s) tabla(s) NO-PII server-side → deriva items (o empty honesto en 0 filas / throw en error real) → `*View` renderiza dentro de `BentoTile`. La barra de cámara del tile Votado se colorea por `it.camara` (`diputados→--camara`, `senado→--senado`); ausente → sin barra.

### Recommended Project Structure
```
app/
├── app/
│   ├── page.tsx                    # + montar 3 fetchers en <BentoGrid>; − <ActualidadModule/>; − import; force-dynamic STAYS
│   └── page.test.tsx               # migrar assertion de retiro (ya mockea ActualidadModule → ajustar)
├── components/
│   ├── actualidad-module.tsx       # − Panel; − ActualidadModule wrapper; restilar 3 *View a BentoTile; + camara en VotadoItem/select
│   ├── actualidad-module.test.tsx  # migrar *View tests a la forma tile + nuevos asserts de barra cámara
│   └── bento/{bento-tile,bento-grid}.tsx  # sin cambios (consumidos)
```
**Discretion (recomendado):** mantener los fetchers + `*View` en `actualidad-module.tsx` (minimiza diff de datos: cero cambio de query salvo `camara`). NO crear archivos nuevos por tile a menos que el planner prefiera; el patrón "restilar in-place + montar en page.tsx" es el de menor superficie.

### Pattern 1: Envolver un `*View` en `BentoTile` con `asChild`
**What:** El `BentoTile` polimórfico (`asChild` → Radix `Slot`) fusiona sus clases sobre el `<section>` hijo, heredando `rounded-[var(--radius-tile)]`, `bg-card`, `border`, `focus-visible:ring`, `hover:border-accent-product` sin duplicar.
**When to use:** cada uno de los 3 tiles.
**Example:**
```tsx
// Source: patrón verificado en app/app/page.tsx:72 (Hero) y :134 (entry tiles)
<BentoTile variant="default" span={4} asChild>
  <section className="p-6">
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-lg font-semibold text-foreground">Votado esta semana</h2>
      {/* "Ver todo →" OMITIDO: no existe /votaciones (ver Open Questions) */}
    </div>
    <ul>{/* items */}</ul>
  </section>
</BentoTile>
```

### Pattern 2: Barra de cámara 3px por token (civic, data-bearing honesto)
**What:** span decorativo `aria-hidden` de 3px cuyo color lo elige SOLO `it.camara`. `--camara`/`--senado` en civic-tokens.css son **strings `hsl()` completos** → se consumen con `bg-[var(--camara)]` (NO `hsl(var(--camara))` = doble-hsl inválido; NO `bg-camara` = util inexistente).
**When to use:** cada `<li>` de Votado cuando `camara` es conocida; se OMITE si ausente.
**Example:**
```tsx
// Source: civic-tokens.css:10,16 (tokens hsl() completos) + globals.css:80 wiring caveat
const camaraLabel = (c: "diputados" | "senado") => (c === "diputados" ? "Cámara" : "Senado");
// ...
<li className="flex gap-[14px] items-start border-t border-border pt-4 first:border-t-0 first:pt-0">
  {it.camara && (
    <span
      aria-hidden="true"
      className={`w-[3px] self-stretch rounded-[2px] ${
        it.camara === "diputados" ? "bg-[var(--camara)]" : "bg-[var(--senado)]"
      }`}
    />
  )}
  <div className="flex-1">{/* title / desenlace+tally / meta */}</div>
</li>
```

### Pattern 3: Chip de urgencia por token (`--accent-product-soft` YA cableado)
**What:** `--accent-product-soft` (civic-tokens.css:32) YA genera `bg-accent-product-soft` vía `@theme inline` (globals.css:87). El chip usa esa util directa + `text-accent-product` — cero cableado nuevo.
**Example:**
```tsx
// Source: globals.css:87 (bg-accent-product-soft ya existe) — mockup #E3F0EF → token
<span className="inline-flex items-center px-[9px] py-0.5 font-mono text-[11px] font-medium text-accent-product bg-accent-product-soft rounded-full">
  {it.tipo}
</span>
```

### Anti-Patterns to Avoid
- **`bg-camara` / `bg-senado`:** no existen como utilities → clase muerta, barra invisible. Usar `bg-[var(--camara)]`.
- **`hsl(var(--camara))`:** doble-hsl (el token ya ES `hsl()`), color inválido (gotcha 54-04). Usar `var(--camara)` bare.
- **`[--token]` (Tailwind 4):** compila a CSS inválido (CR-01). SIEMPRE `[var(--token)]`.
- **Enlazar "Ver todo →" a `/buscar` o inventar `/votaciones`:** el destino honesto no existe → 404 o link engañoso. OMITIR.
- **Copiar datos de ejemplo del mockup** (`Protección de datos personales / 98–12`, urgencias/fechas de ejemplo): FABRICACIÓN prohibida (MILESTONE §6 riesgo 4, invariante 5). Solo empty-states honestos + datos reales de la query.
- **`?? []` que fabrique "sin datos" ante error real:** rompe `#34`. Un error de lectura → `throw` (ya está; conservar los ≥4 throws — el source-scan test lo verifica).
- **Convertir un `*View` en client component:** cero JS cliente nuevo (invariante 6). Siguen siendo RSC.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cáscara de tarjeta (radio 16px, borde, hover, focus ring) | `Panel` a mano con `rounded-lg` | `BentoTile variant="default"` | Ya define radio-tile, focus-visible ring, hover petróleo, min-h-11. `Panel` (rounded-lg 8px) se BORRA. |
| Formato de tally votación | `${si}-${no}` inline | `conteoVotacion(si, no)` | En-dash U+2013 exacto (`58–81`); el test asserta el mono en-dash. |
| Fecha corta es-CL | `Intl.DateTimeFormat` nuevo | `fechaCorta(date)` | Formato "14 may 2026" ya locked; reuso evita drift. |
| Derivar urgencia vigente | re-parsear presenta/retira | `urgenciaVigente(eventos)` | El test source-scan FALLA si se re-declara la función localmente. |
| Guard de href externo | check de protocolo inline | `safeExternalHref(enlace)` | Neutraliza `javascript:`/`data:`; centro de seguridad de todo href derivado de fuente. |
| Label de cámara | map ad-hoc | patrón `camaraLabel` (agenda/page.tsx:223) | `diputados→"Cámara"`, `senado→"Senado"` — idiom existente. OJO: `votacion.camara` usa `"diputados"` (NO `"camara"` como el filtro de agenda). |

**Key insight:** todo el "trabajo difícil" (queries acotadas, disciplina #34, empty-states honestos, derivación de urgencia, guard de href, formato de tally/fecha) ya está resuelto y testeado. Este fase es cirugía de cáscara CSS + un `select` de una columna. Cualquier re-implementación es regresión.

## Runtime State Inventory

> Este fase NO es rename/refactor/migración de datos — es restyle de presentación. La sección aplica marginalmente; se completa por disciplina.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no se toca ningún dato almacenado; las queries leen lo mismo (salvo proyectar `camara`, columna ya existente en `votacion`). | Ninguna. |
| Live service config | None — sin servicios externos, cron, ni webhooks tocados. | Ninguna. |
| OS-registered state | None — sin tareas OS ni procesos registrados. | Ninguna. |
| Secrets/env vars | None nuevos. `force-dynamic` y gates (`*_PUBLIC_ENABLED`) intactos; no se lee env nuevo. | Ninguna. |
| Build artifacts | None — sin cambios de `pyproject`/`package.json`/binarios; solo `.tsx` editados. El build OpenNext (Phase 81) recogerá el diff normal. | Ninguna (deploy es Phase 81). |

**Verificado:** el único delta de datos es una columna proyectada (`camara`) sobre una tabla ya leída; no crea estado runtime nuevo.

## Common Pitfalls

### Pitfall 1: `votacion.camara` usa `"diputados"`, no `"camara"`
**What goes wrong:** copiar el `camaraLabel` de agenda (`c === "camara" ? …`) daría siempre "Senado" para diputados (el valor real es `"diputados"`).
**Why it happens:** `agenda/page.tsx:223` mapea `"camara"|"senado"` (filtro de búsqueda), pero `VotacionRow.camara` es `"diputados" | "senado"` (types.ts:61). Distinto vocabulario.
**How to avoid:** `const camaraLabel = (c) => c === "diputados" ? "Cámara" : "Senado"`. Y la barra: `it.camara === "diputados" ? "bg-[var(--camara)]" : "bg-[var(--senado)]"`.
**Warning signs:** todas las barras salen burdeos (senado) en el test con fixture `diputados`.

### Pitfall 2: doble-`hsl()` en la barra de cámara
**What goes wrong:** `bg-[hsl(var(--camara))]` produce `hsl(hsl(213 94% 38%))` = color inválido → barra transparente.
**Why it happens:** civic-tokens define `--camara: hsl(213 94% 38%)` como string COMPLETO (a diferencia de `--background: 40 33% 97%` que es triple bare). El instinto de envolver en `hsl()` es correcto para los tokens bare, incorrecto para los civic.
**How to avoid:** `bg-[var(--camara)]` — sin wrapper. (globals.css:86 lo documenta para `--accent-product-soft`.)
**Warning signs:** barra invisible en deploy pese a clase presente.

### Pitfall 3: `Ver todo →` a destino inexistente
**What goes wrong:** enlazar a `/votaciones` (404) o `/buscar` (destino no relacionado) engaña al ciudadano.
**Why it happens:** el mockup dibuja el link (`<a href="#">Ver todo →</a>`) como placeholder de diseño.
**How to avoid:** OMITIR el link (no existe lista de votaciones en el repo; UI-SPEC autoriza el omit). Si en el futuro se crea `/votaciones`, se añade entonces.
**Warning signs:** el header del tile Votado apunta a `#` o a una ruta sin `page.tsx`.

### Pitfall 4: jsdom no puede montar los fetchers async (Supabase)
**What goes wrong:** renderizar `VotadoEstaSemana` (async, `createServerSupabase`) en jsdom explota.
**Why it happens:** los fetchers leen Supabase server-side; jsdom no tiene runtime RSC/Supabase.
**How to avoid:** los tests montan los `*View` puros con fixtures (patrón EXISTENTE: `makeVotado`/`makeUrgencia`/`makeFrescura`). `page.test.tsx` ya mockea `ActualidadModule` a `null`; al retirar el módulo, ajustar ese mock (posiblemente mockear los 3 fetchers a `null`, o el `page.test.tsx` deja de importar el módulo). Gotcha conocido: `new URL(import.meta.url)` rompe en jsdom → el test usa `readFileSync` + `process.cwd()` (mantener idiom).
**Warning signs:** `page.test.tsx` intenta ejecutar una query real y falla con error de Supabase.

### Pitfall 5: retirar `Panel` sin migrar su padding/hairline
**What goes wrong:** al borrar `Panel` (`p-6`) los `*View` pierden padding y las listas pierden el `space-y`/hairline.
**Why it happens:** `Panel` proveía el shell; los `*View` asumían estar dentro de él.
**How to avoid:** mover el `p-6` (Votado/Urgencias) / `py-[18px] px-6` (frescura strip) al `<section>` dentro del `BentoTile`; conservar los idiom de hairline (`border-t border-border pt-4 first:border-t-0 first:pt-0`).
**Warning signs:** tiles sin aire interno; ítems pegados al borde.

## Code Examples

### Query de Votado con `camara` (el único toque de datos)
```tsx
// Source: actualidad-module.tsx:156 (query actual) + types.ts:61 (columna camara real)
const { data, error } = await sb
  .from("votacion")
  .select("boletin, resultado, total_si, total_no, fecha, enlace, camara") // + camara
  .gte("fecha", inicioSemanaIso().toISOString())
  .order("fecha", { ascending: false })
  .limit(6);
if (error) throw new Error(`VotadoEstaSemana: no se pudo leer votacion: ${error.message}`);
// VotadoItem gana: camara?: "diputados" | "senado" | null;
```

### Strip de frescura (span-6, flex-wrap)
```tsx
// Source: mockup home-bento.dc.html:145-148 → tokens; FUENTES_FRESCURA verbatim
<BentoTile variant="default" span={6} asChild>
  <section className="py-[18px] px-6 flex items-center flex-wrap gap-y-2.5 gap-x-[22px]">
    <span className="text-[13px] font-semibold text-foreground mr-1.5">
      Última actualización de datos
    </span>
    {items.map((it) => (
      <span key={it.fuente} className="inline-flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-product" aria-hidden="true" />
        <span className="text-[13px] text-muted-foreground">{it.fuente}</span>
        <span className="font-mono text-[13px] text-foreground">{fechaCorta(it.fecha)}</span>
      </span>
    ))}
  </section>
</BentoTile>
// Frescura CONDICIONAL: preferido = omitir el tile entero cuando items.length === 0
// (mockup sc-if showFrescura). Alternativa = conservar copy "Aún no hay registros…".
// Fix one in plan.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Panel` (`rounded-lg` 8px) apilado en `md:grid-cols-3` bajo el hero | `BentoTile` (`rounded-[var(--radius-tile)]` 16px, spans) dentro de `<BentoGrid>` | Phase 76-78 (v8 bento) | Radio 16px + layout bento; los 3 bloques ascienden al grid principal. |
| Copy Votado meta `Votación del {fecha}` (sin cámara) | `{fecha} · {Cámara\|Senado}` cuando `camara` conocida; fallback al string viejo si no | Phase 78 | Añade provenance de cámara + barra civic; degrada honesto. |
| Urgencia como prosa `{titulo} — urgencia {tipo} vigente desde el {fecha}.` | chip `{tipo}` + título + `desde {fecha}` mono | Phase 78 | Presentación más limpia en span-2; mismos hechos, sin re-derivar datos. |

**Deprecated/outdated:**
- `ActualidadModule` wrapper + `Panel` helper: se BORRAN (migran a tiles).
- El wrapper `<section aria-label="Actualidad" class="mx-auto max-w-5xl px-4 pb-16 md:px-8 md:pb-24">`: eliminado (los tiles heredan el contenedor 1120px del grid de Phase 77).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No existe ruta `/votaciones` ni lista de votaciones equivalente → OMITIR "Ver todo →". | Summary / Pitfall 3 | Bajo. Verificado por Glob de `app/app/**/page.tsx` (11 rutas, ninguna de votaciones). Si el planner conoce una ruta futura, se enlaza; el fallback (omitir) nunca daña. |
| A2 | Añadir `camara` al select de `votacion` no viola el guard PII CI. | Code Examples | Bajo. `votacion` es tabla NO-PII (está en `FUENTES_FRESCURA` y el test `Bloque 3 lee … SOLO tablas NO-PII` la lista). `camara` es enum de cámara, no PII. Fallback: no dibujar barra. |
| A3 | El baseline de suite "app ~863" es aproximado; el número exacto se confirma al correr. | Testing | Bajo. La cifra viene de MEMORY/CONTEXT (863 base). El plan debe correr `pnpm test` para el número real; el target es "verde + ajustes de migración". |

**Nota:** todos los facts de código (líneas, firmas, valores de token, columnas) fueron leídos de los archivos fuente esta sesión → VERIFIED, no ASSUMED. Solo las 3 filas arriba tienen incertidumbre residual.

## Open Questions

1. **Destino de "Ver todo →"**
   - Qué sabemos: el mockup lo dibuja; no existe `/votaciones` ni lista de votaciones (11 rutas verificadas).
   - Qué falta: si el planner quiere crear una ruta de lista (fuera de alcance v8) o dejar el omit.
   - Recomendación: **OMITIR el link** este fase (UI-SPEC lo autoriza). No inventar destino.

2. **Frescura vacía: omitir tile vs. copy fallback**
   - Qué sabemos: mockup usa `sc-if showFrescura` (omite el strip); el `*View` actual tiene copy "Aún no hay registros de actualización disponibles."
   - Qué falta: elegir uno.
   - Recomendación: **omitir el tile span-6 cuando 0 items** (mockup-fiel; un strip con solo el label lee como roto). El test asserta lo que el plan fije.

3. **Etiqueta del link de fuente: `Fuente ↗` (mockup) vs `Ver fuente oficial ↗` (existente)**
   - Qué sabemos: el mockup usa `Fuente ↗` terso; el módulo usa `Ver fuente oficial ↗` (más claro, ya `safeExternalHref`-guarded).
   - Recomendación: **mantener `Ver fuente oficial ↗`** (UI-SPEC default). El mockup terse es placeholder visual. El test asserta el label elegido.

## Environment Availability

> Este fase es cambio de código/presentación puro (sin dependencias externas nuevas). Deploy es Phase 81.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm / vitest / tsc | build + test local | ✓ (suite ~863 corre hoy) | — | — |
| Supabase (runtime) | fetchers en dev/deploy | ✓ (ya en producción) | — | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** ninguna.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + jsdom + @testing-library/react |
| Config file | `app/vitest.config.*` (existente; los tests de actualidad ya corren) |
| Quick run command | `pnpm --dir app test actualidad-module` (o `vitest run components/actualidad-module.test.tsx`) |
| Full suite command | `pnpm --dir app test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BENTO-03 | Votado tile heading + item + tally mono en-dash + fuente `safeExternalHref` | unit (RTL) | `pnpm --dir app test actualidad-module` | ✅ (migrar `VotadoEstaSemanaView` tests) |
| BENTO-03 | Barra cámara: `diputados`→`bg-[var(--camara)]` + `· Cámara`; `senado`→`bg-[var(--senado)]` + `· Senado`; ausente→sin barra ni suffix | unit (RTL) | idem | ❌ Wave 0 (nuevos asserts + fixture `camara`) |
| BENTO-03 | Votado empty state string exacto | unit | idem | ✅ (existente) |
| BENTO-03 | Urgencias chip `{tipo}` + `bg-accent-product-soft` + font-mono; `desde {fecha}` mono; empty state | unit | idem | ✅ / ❌ (chip es nuevo — assert de clase) |
| BENTO-03 | Frescura strip label + dot + fuente + fecha mono; 0 items → tile no renderiza (o fallback) | unit | idem | ✅ / ❌ (nueva forma strip) |
| BENTO-03 | Retiro: `<ActualidadModule/>` lineal `max-w-5xl` ya no se renderiza; 3 tiles hijos del `BentoGrid`; `dynamic="force-dynamic"` exportado | unit (RTL) | `pnpm --dir app test page` | ❌ Wave 0 (ajustar mock + assert retiro) |
| BENTO-03 | Zero-hex en componentes migrados (soft; candado formal Phase 80) | source-scan | idem | ❌ Wave 0 (regex `#[0-9a-fA-F]{3,6}` opcional) |
| Invariante 2 | anti-insinuación verde | suite | `pnpm --dir app test anti-insinuacion` | ✅ (verde por construcción — el guard NO escanea `page.tsx`/`actualidad-module.tsx`; ver nota) |

**Nota anti-insinuación:** `app/lib/anti-insinuacion-guard.test.ts` escanea `SUPERFICIES_VOTO` + `SUPERFICIES_MONEY` (verificado líneas 93-124) — NO incluye `app/page.tsx` ni `actualidad-module.tsx`. El copy de este fase (reporte factual votación/urgencia/frescura, sin ranking/afinidad/causal) pasa por construcción. El test in-file `GATE §9.1` (actualidad-module.test.tsx:190) sí ejerce negative-match sobre el copy poblado — mantenerlo verde.

### Sampling Rate
- **Per task commit:** `pnpm --dir app test actualidad-module page`
- **Per wave merge:** `pnpm --dir app test`
- **Phase gate:** suite completa verde + `pnpm --dir app exec tsc --noEmit` limpio + anti-insinuación verde antes de cerrar.

### Wave 0 Gaps
- [ ] `components/actualidad-module.test.tsx` — añadir fixture `camara` a `makeVotado` + asserts de barra cámara (3 casos: diputados/senado/ausente) + assert chip urgencia (`bg-accent-product-soft` + font-mono) + nueva forma strip frescura + assert `BentoTile span={N}` presente.
- [ ] `app/app/page.test.tsx` — ajustar el mock de `ActualidadModule` (retirado): mockear los 3 fetchers a `null` o quitar el import; assert de retiro (`aria-label="Actualidad"` `max-w-5xl` ausente) + 3 tiles en el `BentoGrid` + `force-dynamic` conservado.
- [ ] (opcional) source-scan zero-hex sobre los componentes migrados (candado formal es Phase 80; un smoke aquí es barato).
- Framework install: ninguno (vitest ya corre).

*(Los `*View` tests existentes migran 1:1 cambiando el shell de `Panel` a `BentoTile`; las fixtures `makeVotado/makeUrgencia/makeFrescura` y los exports de tipos/`inicioSemanaIso` se conservan.)*

## Security Domain

> `security_enforcement` no explícitamente `false` → sección incluida. Este fase es presentación; superficie de seguridad mínima.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth nuevo; RSC server-side, RLS/service_role intacto. |
| V3 Session Management | no | Sin sesión nueva. |
| V4 Access Control | yes (heredado) | Lecturas SOLO tablas NO-PII (`votacion`/`tramitacion_evento`/`proyecto`/`citacion`/`lobby_audiencia`/`proyecto_ficha`). El guard CI (source-scan `.from` PII) sigue verde; `camara` no es PII. |
| V5 Input Validation | yes | `safeExternalHref(enlace)` neutraliza `javascript:`/`data:`/malformadas antes de render (el `enlace` viene de fuente XML externa). Verbatim. |
| V6 Cryptography | no | Sin cripto. |

### Known Threat Patterns for {Next.js RSC + Supabase}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Inyección vía `href` de fuente (`javascript:` en `enlace` de votación) | Tampering / Elevation | `safeExternalHref` (utils.ts:15) — solo http/https; conservar verbatim + `rel="noopener noreferrer" target="_blank"`. |
| Fuga PII vía `.from()` a tabla protegida | Information Disclosure | Guard CI existente escanea `.from(PII)`; el test `Bloque 3 … SOLO tablas NO-PII` falla si se añade una tabla PII. Añadir `camara` NO toca esto. |
| Datos fabricados presentados como fuente (mockup example data) | Repudiation (integridad de la fuente) | Prohibición de strings del mockup; empty-states honestos + `#34` throw; el test negative-match `GATE §9.1` verde. |

## Sources

### Primary (HIGH confidence — leído de source esta sesión)
- `app/components/actualidad-module.tsx` — fetchers, `*View`, helpers, `Panel`, `ActualidadModule` wrapper, query de Votado (línea 156-161, sin `camara`), empty-states, `FUENTES_FRESCURA`, disciplina `#34`.
- `app/components/actualidad-module.test.tsx` — fixtures `makeVotado/makeUrgencia/makeFrescura`, exports de tipos, source-scan invariantes, GATE §9.1.
- `app/app/page.tsx` — `BentoGrid` montado (hero span-4, accent span-2, 3 entry span-2), `<ActualidadModule/>` (línea 175), `export dynamic="force-dynamic"`, contenedor `max-w-[1120px]`.
- `app/app/page.test.tsx` — mock de `ActualidadModule` a `null`, assert `force-dynamic`, patrón de assert de tiles.
- `app/components/bento/bento-tile.tsx` — `cva` variants default/accent, spans 2/4/6 → `md:col-span-N`, `asChild`/Slot, `rounded-[var(--radius-tile)]`, focus ring, `min-h-11`.
- `app/lib/types.ts` — `VotacionRow.camara: "diputados" | "senado"` (línea 61); `TramitacionEventoRow`; `sourceLabel` (label de cámara idiom).
- `app/lib/utils.ts` — `safeExternalHref` (línea 15).
- `app/lib/format.ts` — `fechaCorta` (21), `conteoVotacion` (96, en-dash U+2013).
- `app/components/estado-actual-block.tsx` — `urgenciaVigente` (línea 51), `EstadoActual` interface.
- `app/app/styles/civic-tokens.css` — `--camara`/`--senado` como `hsl()` completos (10,16); `--accent-product-soft` (32).
- `app/app/globals.css` — theme wiring: `--radius-tile: 16px` (34), `--color-accent-product-soft` (87, genera `bg-accent-product-soft`), caveat de doble-hsl (74-88).
- `app/lib/anti-insinuacion-guard.test.ts` — `SUPERFICIES_VOTO` (93) + `SUPERFICIES_MONEY` (117); NO incluyen `page.tsx`/`actualidad-module.tsx`.
- `app/app/agenda/page.tsx` — `camaraLabel` idiom (223, usa `"camara"` — distinto de votacion).
- `.planning/design/bento/home-bento.dc.html` — rows 3-4 (109-148): spans, paddings, chip `#E3F0EF`, dot, `Fuente ↗`/`Ver todo →` placeholders.
- `Glob app/app/**/page.tsx` — 11 rutas; NO existe `/votaciones`.

### Secondary (MEDIUM)
- `.planning/phases/78-.../78-UI-SPEC.md` (APPROVED) — contrato visual, mapa hex→token, testing contract.
- `.planning/phases/78-.../78-CONTEXT.md` — decisiones locked.
- `.planning/MILESTONE-v8-bento.md` — §fase 78, invariantes, riesgos.

### Tertiary (LOW)
- Ninguna. Todo lo relevante se verificó contra source o docs de fase aprobadas.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo es código existente leído esta sesión; cero deps nuevas.
- Architecture: HIGH — patrón `BentoTile asChild` ya en uso (page.tsx hero/entry tiles); query/fetchers verbatim.
- Pitfalls: HIGH — doble-hsl, `"diputados"` vs `"camara"`, y `/votaciones` inexistente verificados directamente.

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (30 días — código estable; solo cambiaría si Phase 77 re-toca `page.tsx`/`BentoGrid` antes de ejecutar).
