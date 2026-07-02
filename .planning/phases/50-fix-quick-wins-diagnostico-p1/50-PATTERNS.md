# Phase 50: FIX — Quick wins de bugs del diagnóstico 2026-07-02 (P1) - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 16 (12 modificados + 4 error.tsx nuevos) + tests
**Analogs found:** 16 / 16 (todos los patrones existen ya en el codebase; cero incógnita)

> Nota clave: esta fase NO crea patrones nuevos. Cada fix COPIA un patrón ya vivo en
> el mismo archivo o en un hermano. Los excerpts abajo son el código exacto a espejar,
> con file:line. El planner debe apuntar cada acción a su analog literal.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/app/page.tsx` (B1) | page (RSC shell) | static-copy | (self — cambio de valor en array) | self |
| `app/app/page.test.tsx` (B1) | test (RTL) | — | (self, actualizar assertions) | self |
| `app/lib/format.ts` (B6, B12, B17 helpers) | utility (lib puro) | transform | (self — `esStale`, `fechaCorta`) | self |
| `app/lib/format.test.ts` (B6, B12, B17) | test (unit) | — | (self, patrón de `esStale` describe) | self |
| `app/components/provenance-badge.tsx` (B6) | component (client) | request-response | (self — único consumidor de `esStale`) | self |
| `app/components/provenance-badge.test.tsx` (B6) | test (RTL) | — | (self, fixture 72h→15d) | self |
| `app/app/agenda/page.tsx` (B7, B12) | page (RSC async) | request-response | `LobbySection`/`VotosSection` throw-on-error | exact (patrón #34) |
| `app/components/camara-chip.tsx` (B8) | component (puro) | transform | (self — `classify`/`STYLES`) | self |
| `app/components/camara-chip.test.tsx` (B8, NUEVO) | test (RTL) | — | `votacion-card.test.tsx` (RTL colocalizado) | role-match |
| `app/app/proyecto/[boletin]/error.tsx` (B9, NUEVO) | error boundary (client) | error-recovery | `app/app/parlamentario/[id]/error.tsx` | exact (espejo) |
| `app/app/parlamentarios/error.tsx` (B9, NUEVO) | error boundary (client) | error-recovery | `app/app/parlamentario/[id]/error.tsx` | exact (espejo) |
| `app/app/buscar/error.tsx` (B9, NUEVO) | error boundary (client) | error-recovery | `app/app/parlamentario/[id]/error.tsx` | exact (espejo) |
| `app/app/agenda/error.tsx` (B9, NUEVO) | error boundary (client) | error-recovery | `app/app/parlamentario/[id]/error.tsx` | exact (espejo) |
| `app/components/lobby-de-parlamentario.tsx` (B10) | component (puro + RSC) | transform | (self — `LobbyView`/`LobbySection`) | self |
| `app/components/lobby-de-parlamentario.test.tsx` (B10) | test (RTL) | — | (self, fixtures `makeData`) | self |
| `app/components/votacion-card.tsx` (B14) | component (puro) | transform | (self — bloque `{resultado && …}`) | self |
| `app/components/votacion-card.test.tsx` (B14) | test (RTL) | — | (self, reescribir línea 62) | self |
| `app/components/autores-list.tsx` (B15) | component (client puro) | transform | (self — rama `autores.length === 0`) | self |
| `app/components/autores-list.test.tsx` (B15, NUEVO) | test (RTL) | — | `votacion-card.test.tsx` (RTL colocalizado) | role-match |
| `app/components/ficha-header.tsx` (B15 — pasa prop) | component (puro) | transform | (self — ya usa `proyecto.iniciativa`) | self |
| `app/components/patrimonio-de-parlamentario.tsx` (B17) | component (puro + RSC) | transform | (self — guard `seriePatrimonio:130-137`) | exact (WR-03) |
| `app/components/votos-por-parlamentario.tsx` (honest-state) | component (puro) | transform | (self — `ProyectoGrupo`/`VotosView`) | self |
| `app/components/votos-por-parlamentario.test.tsx` (honest-state) | test (RTL) | — | (self, migrar línea 210 a VotosView) | self |

**NO tocar (confirmado):** `app/components/voto-ficha-row.tsx` (dead code — Open Question #1, recomendación (b)); `app/components/search-result-card.test.tsx` (fixture arbitrario, no el pill).

---

## Pattern Assignments

### B1 — `app/app/page.tsx` (page, static-copy)

**Analog:** self. Es cambio de VALOR, no de arquitectura (pills LOCKED UI-SPEC §6).

**Sitio exacto** (`app/app/page.tsx:23-28`, array `EXAMPLE_CHIPS`):
```typescript
const EXAMPLE_CHIPS: readonly ExampleChip[] = [
  { query: "protección de datos personales" },
  { query: "delitos económicos y medio ambiente" },
  { query: "40 horas / jornada laboral" },
  { query: "15234-07", mono: true },   // ← cambiar a "14309-04"
];
```
**Fix:** `"15234-07"` → `"14309-04"`. Nada más.

**Tests a actualizar** (`app/app/page.test.tsx`): línea 86 `getByRole("button", { name: "15234-07" })` → `"14309-04"`; líneas 111-112 push esperado `"/buscar?q=15234-07"` → `"/buscar?q=14309-04"`.

---

### B6 — `app/lib/format.ts` `esStale` (utility, transform)

**Analog:** self. La función y su docstring viven en `format.ts:52-58`.

**Estado actual** (`app/lib/format.ts:6, 52-58`):
```typescript
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 horas (UI-SPEC §4)
// ...
export function esStale(capturedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - capturedAt.getTime() > STALE_THRESHOLD_MS;
}
```
**Fix (firma retro-compatible):** default 14 días con 3er parámetro opcional, p.ej.
`esStale(capturedAt, now = new Date(), staleAfterMs = 14*24*60*60*1000)`. El único
call-site (`provenance-badge.tsx:33` — `esStale(capturedAt)`) sigue compilando; el
nuevo umbral propaga a los ~12 componentes que usan `ProvenanceBadge` sin tocar ninguno.
Actualizar los docstrings `:6` y `:53-55` (48h → "cadence de ingesta, ~14 días").

**Único consumidor** (`app/components/provenance-badge.tsx:33`):
```typescript
const stale = capturedAt !== null && esStale(capturedAt);
```

**Tests que rompen (2):**
- `app/lib/format.test.ts:63-66` — caso `">48h → true"` usa 49h; con 14d será false. Reescribir a `≤14d → false` (13d) y `>14d → true` (15d).
- `app/components/provenance-badge.test.tsx:29-42` — fixture 72h (línea 30) ya no es stale. Cambiar a `15 * 24 * 60 * 60 * 1000`.

---

### B12 — `app/lib/format.ts` `capitalizarPrimera` + `app/app/agenda/page.tsx` (utility + page)

**Analog para el helper:** las funciones puras de `format.ts` (`extractoIdea:68`, `conteoVotacion:83`) — misma forma: exportada, docstring es-CL, sin efectos.

**Causa raíz** (`app/app/agenda/page.tsx`): `className="capitalize"` (CSS `text-transform`) capitaliza CADA palabra → "2 De Julio". Dos sitios:
```typescript
// :242  (ResultadosBusqueda)
{c.fecha && (
  <span className="capitalize">{diaFmt.format(new Date(c.fecha))}</span>
)}
// :315  (CitacionesSection)
<h3 className="text-base font-semibold capitalize">
  {dayKey === "sin-fecha" ? "Sin fecha asignada"
    : diaFmt.format(new Date(`${dayKey}T00:00:00Z`))}
</h3>
```
Los formatters (`:215`, `:303`) ya producen minúscula correcta ("jueves, 2 de julio").

**Fix:** helper puro en `format.ts` espejando `extractoIdea`:
```typescript
export function capitalizarPrimera(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```
Quitar `className="capitalize"` de ambos sitios; envolver el output del formatter con
`capitalizarPrimera(...)`. Conservar la coma del locale es-CL (research Open Question #3;
fix mínimo = solo capitalización).

**Test:** añadir unit de `capitalizarPrimera` en `format.test.ts` (Wave 0).

---

### B7 — `app/app/agenda/page.tsx` (page, request-response — throw-on-error #34)

**Analog:** `LobbySection` (`lobby-de-parlamentario.tsx:303-312`) y `VotosSection`
(`votos-por-parlamentario.tsx:651`) — patrón #34 idéntico. En el MISMO archivo agenda
`ResultadosBusqueda:184-193` ya lo hace vía try/catch → UI de error.

**Patrón a copiar** (`app/components/lobby-de-parlamentario.tsx:303-312`):
```typescript
const { data: rpcData, error: rpcError } = await sb.rpc(
  "lobby_de_parlamentario",
  { p_id: id },
);
// #34: error real de DB/red ≠ "sin reuniones". Se lanza para la UI de error honesta.
if (rpcError) {
  throw new Error(
    `lobby_de_parlamentario falló para ${id}: ${rpcError.message}`,
  );
}
const filas = (rpcData as LobbyAudienciaRpcRow[] | null) ?? [];
```

**Sitio 1 — `CitacionesSection`** (`app/app/agenda/page.tsx:276-284`) — hoy NO desestructura `error`:
```typescript
const { data } = await sb
  .from("citacion")
  .select("*, citacion_invitado(*), citacion_punto(*)")
  .eq("semana_iso", key)
  .order("fecha", { ascending: true })
  // ...
const citaciones = (data as CitacionRow[]) ?? [];   // ← "No hay citaciones" traga el error
```
Fix: `const { data, error } = await ...` + `if (error) throw new Error(\`citacion falló para semana ${key}: ${error.message}\`);` antes del `?? []`.

**Sitio 2 — `SalaTableServer`** (`app/app/agenda/page.tsx:404-439`) — TRES queries sin `.error`:
```typescript
const [senadoRes, camaraRes] = await Promise.all([ /* :404-419 */ ]);
const sesionesSenado = (senadoRes.data as SesionSalaRow[]) ?? [];
const sesionesCamara = (camaraRes.data as SesionSalaRow[]) ?? [];
// ... y el probe forward-only :429-435 (const { data: primera } = ...)
```
Fix: chequear `senadoRes.error`, `camaraRes.error`, y el `.error` del probe forward-only
(`:429`); cada uno `throw`. Un fallo del probe NO debe fabricar `fueraDeVentanaSenado`.

El throw lo captura el nuevo `app/app/agenda/error.tsx` (B9).

---

### B8 — `app/components/camara-chip.tsx` (component, transform)

**Analog:** self. `camaraDotColor` (mismo archivo `:48-53`) YA degrada `desconocida` a
neutro correctamente — modelo del fix.

**Sitio del bug** (`app/components/camara-chip.tsx:31-45`):
```typescript
const STYLES: Record<CamaraKind, { label: string; className: string }> = {
  // ...
  desconocida: {
    label: "Cámara origen desconocida",   // ← chip-alarma fabricado
    className: "bg-muted text-muted-foreground",
  },
};

export function CamaraChip({ camara }: { camara: string | null }) {
  const kind = classify(camara);
  const { label, className } = STYLES[kind];
  return (
    <Badge variant="outline" className={cn("border-transparent", className)}>
      {label}
    </Badge>
  );
}
```
**Fix recomendado (omitir):** `if (kind === "desconocida") return null;` antes del render.
Seguro en los 4 call-sites (`timeline-event.tsx:30`, `ficha-header.tsx:23`,
`votacion-card.tsx:35`, `parlamentario-header.tsx:42`) — todos dentro de `flex flex-wrap gap-2`.
NO tocar `camaraDotColor` (el dot neutro es aceptable). Decisión omitir-vs-neutro a discreción.

**Test NUEVO** (`camara-chip.test.tsx`, Wave 0): senado→"Senado", diputados→"Cámara",
desconocida→null. Colocar junto al componente (patrón RTL colocalizado — ver
`votacion-card.test.tsx`). Negative-match: cero "desconocida" en el DOM.

---

### B9 — `error.tsx` ×4 (error boundary, client)

**Analog:** `app/app/parlamentario/[id]/error.tsx` (LEÍDO COMPLETO — espejar verbatim).
Confirmado por Glob: solo `parlamentario/[id]` y `contraparte/[id]` tienen `error.tsx` hoy;
las 4 rutas destino existen (`proyecto/[boletin]/page.tsx`, `parlamentarios/page.tsx`,
`buscar/page.tsx`, `agenda/page.tsx`).

**Patrón a espejar COMPLETO** (`app/app/parlamentario/[id]/error.tsx`):
```tsx
"use client"; // Los error boundaries deben ser Client Components.

import { useEffect } from "react";

export default function ParlamentarioError({
  error,
  unstable_retry,      // ⚠️ ESTE Next usa unstable_retry, NO reset (AGENTS.md)
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
      <h1 className="text-xl font-semibold">No pudimos cargar esta ficha</h1>
      <p className="text-base leading-relaxed text-muted-foreground mt-4">
        Ocurrió un error al consultar los datos. Esto es una falla técnica, no una
        ausencia de información: no asumas que no hay registros.
      </p>
      <p className="mt-8 text-sm">
        <button
          onClick={() => unstable_retry()}
          className="text-primary underline underline-offset-2"
        >
          Reintentar
        </button>
      </p>
    </main>
  );
}
```
**Fix:** copiar verbatim a las 4 rutas, ajustando SOLO el `<h1>` al contexto (ficha proyecto /
listado de parlamentarios / búsqueda / agenda) y el nombre del componente default export. Copy
es-CL, cero inglés, botón "Reintentar" → `unstable_retry()`. **NO usar `reset`** (rompe el boundary
en este Next; leer `node_modules/next/dist/docs/` si hay duda).

---

### B10 — `app/components/lobby-de-parlamentario.tsx` (component, transform)

**Analog:** self. `LobbyView` es puro; `LobbySection` es el RSC (`:288`).

**Copy hardcodeado "la Cámara"** (aparece 3×): intro (`:102-108`), empty-state (b) (`:129-132`):
```tsx
// :102-108 — intro (frame antes de cualquier fila)
const intro = (
  <p className="text-sm text-muted-foreground mb-4">
    Audiencias registradas bajo la Ley del Lobby (Ley 20.730). Cada reunión se
    muestra tal como la publica el registro oficial de la Cámara
    (camara.cl/transparencia); el enlace de cada fila apunta a la fuente.
  </p>
);
// :129-132 — empty-state (b)
No se registran reuniones de lobby confirmadas para este parlamentario en
el periodo consultado, según el registro de la Cámara (camara.cl/transparencia).
```

**Threading de `camara` (research A1 / Open Question #2):** HOY no llega. `LobbySection` (`:288`)
recibe `{ id, searchParams }`; `LobbyView` recibe `{ data: LobbyViewData }`. La cámara vive en
`parlamentario.camara` (usado en `parlamentario-header.tsx:42`). `CarrilesSection` (`page.tsx:135`)
renderiza `<LobbySection id={id} searchParams={sp} />` (`:177`) sin camara.
- **Opción 1 (recomendada si existe getter cacheado):** `LobbySection` lee `parlamentario.camara`
  vía getter `React.cache` (verificar `HeaderSection`/`lib/supabase`, análogo a `contarCarrilesSeguro`),
  añade `camara` a `LobbyViewData`, parametriza el copy.
- **Opción 2:** `CarrilesSection` obtiene camara una vez y la pasa como prop.

**Fix del copy:** senado → "el Senado / el registro de la Ley del Lobby del Senado";
diputados → Cámara. **Trazabilidad LOCKED:** el `enlace` por fila (`:199` `sourceUrl={a.enlace}`)
NO se toca — solo cambia el texto del frame/intro. Para senadores no hay filas (lobby solo diputados)
→ caen en estado (a) noIngestado; aun así el intro debe reflejar la cámara real.

**Test** (`lobby-de-parlamentario.test.tsx`): si `LobbyViewData` gana `camara`, actualizar
fixtures/`makeData`. Verificar assertions del literal "Cámara (camara.cl/transparencia)".

---

### B14 — `app/components/votacion-card.tsx` (component, transform)

**Analog:** self. Revierte decisión Phase 22 (omisión).

**Sitio** (`app/components/votacion-card.tsx:65-82`) — hoy OMITE toda la sección si `resultado` null:
```tsx
{votacion.resultado && (
  <div className="mt-3 space-y-2">
    <p className="text-sm text-muted-foreground">
      El proyecto fue {votacion.resultado}{" "}
      <span className="font-mono">
        {conteoVotacion(votacion.total_si, votacion.total_no)}
      </span>
    </p>
    <div>
      <span className="sr-only">Resultado: </span>
      <EtapaBadge estado={votacion.resultado} />
    </div>
  </div>
)}
```
**Fix:** cambiar `{resultado && (...)}` por ternario. Rama null → línea honest-state
`<p className="text-sm text-muted-foreground">Desenlace no informado por la fuente.</p>`.
Totales/barra (`:52-63`) intactos. `EtapaBadge` solo con resultado.

**Test que rompe** (`votacion-card.test.tsx:51-66`): línea 62 `expect(queryByText(/El proyecto fue/)).not.toBeInTheDocument()`.
Reescribir `it` a "muestra 'Desenlace no informado por la fuente.'" + `getByText("Desenlace no informado por la fuente.")`.
Conservar assertions de barra (`getByLabelText(/Resultado de votación/i)`) y totales.

---

### B15 — `app/components/autores-list.tsx` (component, transform)

**Analog:** self. Campo distintivo = `ProyectoRow.iniciativa` (valores canónicos
`"Mensaje"` / `"Moción"` — `packages/tramitacion/src/model.ts:12`). `origen` NO sirve.

**Sitio** (`app/components/autores-list.tsx:11, 14-20`):
```tsx
export function AutoresList({ autores }: { autores: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (autores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mt-2">
        Autores no informados.
      </p>
    );
  }
  // ...
```
**Fix:** `AutoresList({ autores, iniciativa })`. Si `autores.length === 0`:
- `iniciativa === "Mensaje"` → **"Iniciativa del Ejecutivo (Mensaje)."**
- else → "Autores no informados." (Moción sin autores, o `iniciativa` null).

**Pasar la prop desde `FichaHeader`** (`ficha-header.tsx:55` `<AutoresList autores={proyecto.autores ?? []} />`
→ añadir `iniciativa={proyecto.iniciativa}`; `proyecto.iniciativa` ya está disponible ahí, usado en `:35`).

**Caveat de datos (Pitfall 4):** ruta Cámara puebla `iniciativa: null` (`ingest-run.ts:230`) → esos
Mensaje siguen en "Autores no informados." (honesto). No fabricar.

**Test NUEVO** (`autores-list.test.tsx`, Wave 0): 3 casos (Mensaje sin autores, Moción sin autores,
con autores). Colocalizado RTL (ver `votacion-card.test.tsx`).

---

### B17 — `app/components/patrimonio-de-parlamentario.tsx` (component, transform — WR-03)

**Analog:** el guard WR-03 YA en el mismo archivo, `seriePatrimonio:130-137`.

**Guard existente a espejar** (`app/components/patrimonio-de-parlamentario.tsx:130-137`):
```typescript
// Guarda anti-500 (WR-03): `fecha_presentacion` puede venir null/vacía/no-ISO
const raw = v.fecha_presentacion ?? "";
const yyyy = raw.slice(0, 4);
const anio = Number(yyyy);
if (!/^\d{4}$/.test(yyyy) || !Number.isFinite(anio)) return []; // excluye basura
```

**Sitios sin guard:**
```typescript
// :383  (VersionRow) — new Date(null) → "Invalid Date" renderizado
const fechaTexto = fechaCorta(new Date(version.fecha_presentacion));
// (fechaTexto reusado en :391 "Presentada el ..." y :408 es_historica)
// :607  (vista ?ver= detalle)
Presentada el {fechaCorta(new Date(c.fecha_presentacion))}
```
**Fix (helper compartido en `format.ts`):** para VersionRow el guard debe DEGRADAR a copy honesto
(no excluir como el chart). P.ej.:
```typescript
export function fechaCortaSegura(raw: string | null, fallback = "fecha no informada"): string {
  const iso = (raw ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : fechaCorta(d);
}
```
Reemplazar `:383` por `fechaCortaSegura(version.fecha_presentacion)` y `:607` por
`fechaCortaSegura(c.fecha_presentacion)`. La rama `es_historica` (`:408`) hereda el fallback (aceptable).

**Tests:** unit de `fechaCortaSegura` en `format.test.ts` (null/vacío/no-ISO → fallback); caso en
`patrimonio-de-parlamentario.test.tsx` (fecha_presentacion null → "fecha no informada").

---

### Honest-state repetido — `app/components/votos-por-parlamentario.tsx` (component, transform)

**Analog:** self. Sitio LIVE = `ProyectoGrupo` (`:206`) renderizado por `VotosView` (`:424-426`).
**NO tocar** `voto-ficha-row.tsx:89` (dead code — research A2, grep 0 imports live; Open Question #1 → (b)).

**Sitio LIVE — línea per-arco** (`app/components/votos-por-parlamentario.tsx:225-229`):
```tsx
<p className="text-sm text-muted-foreground mt-1">
  {grupo.idea_matriz
    ? `De qué trata: ${extractoIdea(grupo.idea_matriz)}`
    : "De qué trata: no disponible aún"}   // ← se repite 1×/arco = ruido
</p>
```
**Render de VotosView** (`app/components/votos-por-parlamentario.tsx:422-428`):
```tsx
<ul className="mt-4 space-y-6">
  {agruparPorProyecto(votos).map((grupo) => (
    <ProyectoGrupo key={grupo.boletin} grupo={grupo} />
  ))}
</ul>
```
Nótese el patrón de nota-de-sección honesta que YA existe justo debajo (`:430-437`,
"cobertura baja") — modelo exacto para la nota una-vez-por-sección:
```tsx
{votos.length > 0 && totalProyectos <= COBERTURA_BAJA_UMBRAL && (
  <p className="text-sm text-muted-foreground mt-4">
    Se registran votaciones de {totalProyectos} ... la cobertura se está ampliando.
  </p>
)}
```
**Fix:** en `ProyectoGrupo`, cuando `grupo.idea_matriz` es null → OMITIR la línea per-arco
(no renderizar "De qué trata: no disponible aún"; con idea SÍ, seguir mostrando "De qué trata: {extracto}").
En `VotosView`, computar `hayArcoSinIdea = agruparPorProyecto(votos).some(g => !g.idea_matriz)` y
renderizar UNA nota de sección (espejando el bloque de cobertura `:430-437`).

**Test que rompe** (`votos-por-parlamentario.test.tsx:210-219`): hoy testea `VotoFichaRow` (muerto).
Migrar la assertion del honest-state a `VotosView` (nota una-vez-por-sección), no per-arco.

---

## Shared Patterns

### Patrón #34 — throw-on-`.error` (aplicar a B7)
**Source:** `app/components/lobby-de-parlamentario.tsx:307-312`, `app/components/votos-por-parlamentario.tsx:651`
**Apply to:** `CitacionesSection` y `SalaTableServer` en `app/app/agenda/page.tsx` (las únicas secciones del sitio que hoy violan #34).
```typescript
if (error) throw new Error(`<recurso> falló para <ctx>: ${error.message}`);
```
Un fallo de DB/red NUNCA se degrada a estado vacío legible como "limpio". Lo captura el `error.tsx` de la ruta.

### Patrón error boundary (aplicar a B9)
**Source:** `app/app/parlamentario/[id]/error.tsx` (excerpt completo arriba)
**Apply to:** las 4 nuevas `error.tsx`. Firma `{ error, unstable_retry }` — **NO `reset`**. `"use client"`, `useEffect(console.error)`, copy es-CL, botón Reintentar.

### Patrón guard de fecha WR-03 (aplicar a B17)
**Source:** `app/components/patrimonio-de-parlamentario.tsx:130-137`
**Apply to:** `fechaCortaSegura` en `format.ts`, consumido en patrimonio `:383` y `:607`. Validar ISO antes de `new Date` → fallback honesto, nunca "Invalid Date".

### Patrón honest-state sobrio (aplicar a B8, B14, B15, honest-state repetido)
**Source:** líneas honestas existentes — `votacion-card.tsx:71`, `lobby-de-parlamentario.tsx:182` ("Contraparte no publicada por la fuente."), `autores-list.tsx:16` ("Autores no informados.")
**Estilo:** `className="text-sm text-muted-foreground"`, es-CL sobrio, "…por la fuente" cuando aplica. Vocabulario prohibido negative-match (DESIGN-SYSTEM §6/§9.1): sin causalidad, score, ranking, juicio. **El honest-state va UNA vez; repetirlo es ruido, no honestidad.**

### Patrón test RTL colocalizado (aplicar a tests NUEVOS: camara-chip, autores-list)
**Source:** `app/components/votacion-card.test.tsx`, `app/components/lobby-de-parlamentario.test.tsx`
**Convención:** `*.test.tsx` junto al componente; Vitest + @testing-library/react (jsdom); negative-match de vocabulario prohibido en copy nuevo. Run: `pnpm --filter app test <archivo>`.

---

## No Analog Found

Ninguno. Los 16 archivos tienen analog exacto (self o hermano). Esta es una fase de fixes
sobre superficie existente: cero patrón nuevo, cero librería nueva, cero RPC/DDL.

| File | Nota |
|------|------|
| — | Todos los fixes copian un patrón ya vivo en el codebase. |

---

## Metadata

**Analog search scope:** `app/app/**`, `app/components/**`, `app/lib/**` (+ `packages/tramitacion/src` para el campo `iniciativa`).
**Files scanned:** 13 (format.ts, page.tsx, camara-chip.tsx, votacion-card.tsx, autores-list.tsx, provenance-badge.tsx, agenda/page.tsx ×2 secciones, lobby-de-parlamentario.tsx ×2, patrimonio-de-parlamentario.tsx ×2, votos-por-parlamentario.tsx ×3, parlamentario/[id]/error.tsx) + Glob de rutas.
**Route verification (Glob):** las 4 rutas destino de B9 existen; solo `parlamentario/[id]` y `contraparte/[id]` tienen `error.tsx` hoy → las 4 nuevas confirmadas.
**Pattern extraction date:** 2026-07-02
