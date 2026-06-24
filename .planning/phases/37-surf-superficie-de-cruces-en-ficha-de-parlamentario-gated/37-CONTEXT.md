# Phase 37: SURF — Superficie de cruces en ficha de parlamentario (gated) - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** Locked design transcription (`.planning/MILESTONE-v4-cruces.md` §3.1 + ROADMAP Phase 37). The design is LOCKED and validated by Opus — this CONTEXT does NOT re-design; it pins the decisions and the exact repo state so the planner does not re-derive or drift. No discuss-phase: there are no open human design questions for a locked, build-only, gated-OFF UI surface.

<domain>
## Phase Boundary

Construir (NO encender) la `CrucesSection` de la ficha del parlamentario: un **Server Component** (Next.js 16 App Router) que llama al RPC `cruces_de_parlamentario` y renderiza las señales factuales de cruce parlamentario↔sector con **provenance inline** (fuente/fecha/enlace por evidencia), como **carril propio hermano** de `#lobby`/`#patrimonio` (NUNCA anidado — frontera anti-insinuación §9.1), detrás del gate `crucesPublicEnabled()` con **default OFF**.

**EN ALCANCE (build-only):**
- Nuevo gate de presentación `app/lib/cruces-gate.ts` → `crucesPublicEnabled()`, server-only, fail-closed (espejo byte-a-byte de `app/lib/money-gate.ts` / `app/lib/net-gate.ts`).
- Nuevo componente `app/components/cruces-de-parlamentario.tsx`: `CrucesView` PURO (props, testeable con RTL) + `CrucesSection` Server Component (lee el RPC).
- Modificar `app/app/parlamentario/[id]/page.tsx`: añadir `<section id="cruces" className="mt-12">` hermana, envuelta ENTERA (heading incluido) en `crucesPublicEnabled(process.env)` — con OFF (default) el nodo entero está AUSENTE del HTML (no oculto-con-CSS).
- Tipos nuevos en `app/lib/types.ts` para la fila del RPC (espejo de `LobbyAudienciaRpcRow`).
- Tests RTL del `CrucesView` puro + test de que con gate OFF la sección no monta + gate unit test (espejo de los tests de money/net gate).

**FUERA DE ALCANCE (gates LOCKED — un agente jamás los cruza):**
- **CERO DDL.** Las migraciones 0038/0039/0040 YA están aplicadas a PROD (Phase 36). Phase 37 NO toca `supabase/migrations/`.
- **CERO grant del RPC a anon.** `cruces_de_parlamentario` queda deny-by-default hasta la firma legal (Phase 39). No se añade ningún `grant execute ... to anon`.
- **CERO flip de flag.** No se enciende `crucesPublicEnabled` / `CRUCES_PUBLIC_ENABLED`. Encender = Phase 39 (firma humana exclusiva).
- Superficie de ficha de PROYECTO (Phase 38) y señales de voto: DIFERIDAS.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Gate de presentación (`app/lib/cruces-gate.ts`)
- Función `crucesPublicEnabled(env = process.env): boolean` que retorna `env.CRUCES_PUBLIC_ENABLED === "true"` — SOLO el literal `"true"` enciende; `undefined`/`""`/`"false"`/`"1"`/`"TRUE"` → `false`. NO truthiness laxa.
- `import "server-only";` en la línea 1 (espejo de money-gate/net-gate/`app/lib/supabase.ts`). La var NO lleva prefijo `NEXT_PUBLIC_`.
- `env` inyectable (default `process.env`) para testear sin tocar el global.
- La ausencia ES el default seguro (OFF), NO un error que se lance.
- Docstring: deja explícito que ENCENDER requiere `signoff: approved` (Phase 39) y que un agente NUNCA flipea este flag; doble candado = Candado A (RPC sin grant a anon + RLS deny-by-default sobre `cruce_senal`, migración 0039) + Candado B (este gate).

### RPC y forma de datos (ya en PROD — NO modificar)
- `cruces_de_parlamentario(p_id text)` (migración 0040, security definer, `search_path=''`) devuelve filas con columnas NOMBRADAS: `sector_id` (text), `sector_etiqueta` (text), `tipo_senal` (text), `conteo` (int), `evidencia` (jsonb).
- `evidencia` jsonb (PII-safe, nace así en el materializador 0039) = `{ "conteo": N, "items": [ { "tipo": "reunion", "fecha": <date>, "contraparte_nombre_crudo": <string>, "audiencia_id": <string>, "enlace_fuente": <url> } ] }`. El nombre de la contraparte es CRUDO (D-10), nunca normalizado/inferido; SIN rut, SIN donante_id, SIN partido.
- `tipo_senal` hoy SOLO toma el valor `'lobby_sector'` (lobby-puro; las señales de voto/aporte están OFF). El componente debe manejar `'lobby_sector'` y degradar honesto ante cualquier otro valor futuro sin fabricar copy.
- El RPC ordena por `conteo desc, sector_id asc`.

### Componente (`app/components/cruces-de-parlamentario.tsx`) — espejo de `lobby-de-parlamentario.tsx`
- `CrucesView` PURO (recibe `data`, sin Supabase/Next runtime) + `CrucesSection` async Server Component que crea `createServerSupabase()`, llama `sb.rpc("cruces_de_parlamentario", { p_id: id })`, y construye la vista. NO `"use client"`.
- Manejo de error #34: `if (rpcError) throw` — un error real de DB/red NUNCA se degrada a "sin cruces". (Nota: con gate OFF la sección no monta, así que este path solo corre cuando el gate esté ON + grant exista, ambos en Phase 39 — ver KEY NOTE de doble candado.)
- **Empty honesto** si cero cruces: copy factual que NO afirma ausencia de conducta (espejo del estado (b) de lobby), p. ej. "No se registran cruces de sector para este parlamentario con los datos actuales."
- Por cada señal (fila del RPC): encabezado factual con conteo + etiqueta del sector. Wording LOCKED factual: "**N reuniones con gestores del sector {etiqueta}**" (sin verbo causal, sin score, sin afinidad). Conteo neutro es el único agregado.
- Por cada item de evidencia: nombre crudo de la contraparte + `IdentityMarker` (nunca enlazado, nunca confirmado — espejo de `ContraparteCruda`) + `ProvenanceBadge` con `sourceUrl = item.enlace_fuente`, fecha del item. CADA evidencia trazable al enlace original (FND-08).
- Reusar `ProvenanceBadge`, `IdentityMarker`, `sourceLabel`, `fechaCorta` ya existentes (espejo lobby).

### Anti-insinuación (release gate, §9.1 — copiar el bloque de gate de contenido de `lobby-de-parlamentario.tsx`)
- Carril AISLADO: `<section id="cruces" className="mt-12">`, hermano, NUNCA comparte `<article>/<Card>/<li>/<tr>` con un voto / reunión / boletín / declaración. El `mt-12` es la frontera.
- CERO causalidad ("se reunió para", "a cambio de", "antes de votar"), CERO afinidad/relación ("cercano a", "vinculado a"), CERO score/índice/ranking/flag/"conflicto de interés", CERO adjetivo de juicio. Conteo neutro es el único agregado.
- Incertidumbre de identidad = exactamente "identidad no verificada" (vía `IdentityMarker`).
- Provenance obligatoria por evidencia; vacío es un HECHO, no una virtud.
- El copy debe pasar el negative-match de vocabulario prohibido (DESIGN-SYSTEM §6/§9.1, valla `BANNED-VOCAB`). Si existe un test/linter de vocabulario, extenderlo a este componente.

### Página (`app/app/parlamentario/[id]/page.tsx`)
- Insertar la `<section id="cruces" className="mt-12">` como carril hermano, envuelta ENTERA en `{crucesPublicEnabled(process.env) && ( ... )}` (espejo del patrón MONEY: gate envuelve la `<section>` incluido el `<h2>`; OFF ⇒ nodo ausente, NO se depende de que el componente retorne null).
- `<h2>` LOCKED factual: "Cruces con sectores" (sin posesivo, sin juicio). Heading exacto a fijar en el plan.
- Suspense + skeleton shape-matched (espejo de `LobbySkeleton`).
- **Ubicación (discreción, no load-bearing):** colocar `#cruces` como hermano DESPUÉS de `#patrimonio` y ANTES de las secciones MONEY gated, para no leerse como un "score de lobby" pegado a `#lobby`. El planner fija la posición exacta; mantener el orden de carriles coherente y SIEMPRE hermano.
- Importar `crucesPublicEnabled` de `@/lib/cruces-gate` (NUNCA leer `CRUCES_PUBLIC_ENABLED` crudo — chokepoint, espejo WR-02).

### Claude's Discretion
- Texto exacto del empty-state y del encabezado de cada señal (dentro de las reglas factuales/anti-insinuación de arriba).
- Forma del skeleton y paginación (probablemente NO se necesita paginación: pocas señales por parlamentario; renderizar todas).
- Nombres de los tipos TS nuevos (`CruceSenalRpcRow`, `CruceEvidenciaItem`, etc.).
- Posición exacta del carril `#cruces` en la página.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diseño LOCKED (fuente de verdad — NO re-diseñar)
- `.planning/MILESTONE-v4-cruces.md` (§3.1 — WHAT/REPO TARGETS/KEY NOTES/DEPENDS-ON/AUTONOMY/ACCEPTANCE)
- `.planning/ROADMAP.md` (Phase 37 Details + Gates LOCKED transversales, ~líneas 696–846)

### Espejos de gate (copiar el patrón exacto)
- `app/lib/money-gate.ts` — `moneyPublicEnabled()` fail-closed server-only (espejo directo)
- `app/lib/net-gate.ts` — `netPublicEnabled()` (espejo directo, mismo patrón doble-candado)

### Espejos de sección de ficha (copiar la estructura PURE-view + Server Component + anti-insinuación)
- `app/components/lobby-de-parlamentario.tsx` — `LobbyView` puro + `LobbySection` + `ContraparteCruda` + bloque de gate de contenido §9.1 (el patrón más cercano: mismo dato crudo de contraparte + IdentityMarker + ProvenanceBadge)
- `app/components/patrimonio-de-parlamentario.tsx` — segundo espejo (carril propio, atribución, fecha prominente)
- `app/app/parlamentario/[id]/page.tsx` — shell de carriles apilables; patrón de gate MONEY que envuelve la `<section>` entera
- `app/components/provenance-badge.tsx`, `app/components/identity-marker.tsx` — primitivos reusados
- `app/lib/types.ts` (`LobbyAudienciaRpcRow`, `sourceLabel`), `app/lib/format.ts` (`fechaCorta`) — tipos/helpers a espejar

### Contrato de datos (NO modificar — ya en PROD)
- `supabase/migrations/0040_cruces_rpc.sql` — firma y proyección del RPC `cruces_de_parlamentario`
- `supabase/migrations/0039_cruce_senal.sql` — forma del jsonb `evidencia` (items[] con enlace_fuente)

### Sistema de diseño
- `.planning/phases/19-*/19-DESIGN-SYSTEM.md` — tokens, escala 8-pt, `mt-12` como frontera anti-insinuación, voz editorial ES, vocabulario prohibido VALLADO (negative-match)
</canonical_refs>

<specifics>
## Specific Ideas
- El componente es un **espejo directo** de `lobby-de-parlamentario.tsx` adaptado a la forma del RPC de cruces (filas agregadas con `evidencia.items[]` en vez de audiencias paginadas). Reusar verbatim: `ContraparteCruda` → render del `contraparte_nombre_crudo`, `ProvenanceBadge`, `IdentityMarker`, intro factual, estados honestos.
- El gate es un **espejo byte-a-byte** de `money-gate.ts`/`net-gate.ts` cambiando solo el nombre de la función, la var de entorno (`CRUCES_PUBLIC_ENABLED`) y el docstring (referencia a cruces / Phase 39 / 0039–0040).
- Verificación clave: test que con `crucesPublicEnabled` falso (default) la `<section id="cruces">` NO está en el HTML renderizado (nodo ausente), espejando cómo se testea el gate MONEY en la página.
</specifics>

<deferred>
## Deferred Ideas
- Encender `crucesPublicEnabled` + grant del RPC a anon → Phase 39 (firma legal humana, exclusiva).
- Señales de voto (`lobby_sector_voto`/`aporte_sector_voto`) en la sección → diferidas hasta sign-off (17-LEGAL-DOSSIER §2).
- Superficie de cruces en ficha de PROYECTO (`cruces_de_proyecto`) → Phase 38.
</deferred>

---

*Phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated*
*Context gathered: 2026-06-24 from locked design (`.planning/MILESTONE-v4-cruces.md` §3.1)*
