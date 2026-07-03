# Phase 51: LEG2 — Legibilidad profunda (P2) - Research

**Researched:** 2026-07-02
**Domain:** Legibilidad / re-presentación server-driven de fichas (Next.js 16 App Router + Supabase RPCs), sin nuevas dependencias
**Confidence:** HIGH (codebase-grounded; toda afirmación verificada por lectura directa de los archivos a tocar)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Votos agregados + rebeldías (SC1, SC5)**
- "Ver detalle" por arco = server-driven vía searchParam `?votosVer=<boletin>` (patrón `?ver=` de patrimonio). Colapsado por defecto: UNA línea-resumen por arco.
- Línea-resumen (conteos por sentido + rango de fechas) se computa en el Server Component desde las filas ya traídas — `votos_de_parlamentario` ya agrupa por arco ANTES de paginar (WR-02), todas las líneas del arco están presentes → **cero RPC nueva** para SC1.
- Dead code B24: eliminar los paths muertos de `voto-ficha-row.tsx` que renderizan "De qué trata: no disponible aún" por fila; refactorizar el camino de menciones si aún consume `VotoFichaMencionRow`.
- Rebeldías B5: ajustar el RPC `rebeldias_de_parlamentario` (nueva migración, drop+recreate por cambio de returns table → 42P13): excluir ausencias del cálculo/salida (o separarlas), join para hidratar título del proyecto, dedupe por votación. Ya está en `PUBLIC_RPC_ALLOWLIST` — sin cambio de allowlist. Re-emitir doble revoke + grant (gotcha DEFAULT PRIVILEGES). Sigue SECURITY DEFINER set search_path=''. Apply remoto por psql --db-url = checkpoint operador; pgTAP acompaña.

**Ficha de proyecto — estado actual + timeline (SC2, SC7)**
- Bloque "¿dónde está hoy?" = Server Component, primer elemento tras el header: etapa/estado + último hito (fecha + descripción) + urgencia vigente derivada de los eventos de urgencia (último "hace presente" sin "retira" posterior) + "hace N días" con fecha absoluta. Si un dato no es derivable, la línea se omite.
- Colapso conservador (B19): SOLO pares de urgencia colapsados en una línea por período ("Urgencia Suma renovada N veces entre X e Y — ver todas", expandible server-driven). Todo lo demás = hito estructural siempre visible, sin paginación.
- Provenance por sección (SC7): UN `ProvenanceBadge` en el heading de la sección timeline; se conserva el link "Ver fuente oficial ↗" por evento.
- Fuera de alcance (deferred): votaciones por jornada, roll-call jerarquizado, umbral de similares (B18).

**Patrimonio + comparador (SC3, SC4)**
- Tarjeta-resumen por versión: fecha + tipo + conteos por categoría de bien, **reusando `seriePatrimonio`** (misma fuente de verdad que el chart F46). "Ver detalle" mantiene `?ver=<versionId>`. Jamás el `<dl>` completo inline.
- Campos cuyo valor es URI de CPLT: excluidos de TODO render (tarjeta Y detalle).
- Comparador (B4): form GET nativo con dos `<select>` de fechas de versión + botón "Comparar" que construye `?comparar=A,B`; cero JS, SSR.
- Copy: "Elige dos fechas para comparar"; con <2 versiones el form se OMITE y queda el hecho neutro existente.

**Lobby + footer + resumen (SC6, SC8)**
- Lobby: vista agrupada por contraparte = DEFAULT (orden por frecuencia DESC: "contraparte + conteo + rango de fechas"); toggle server-driven `?vista=cronologica` conserva la vista actual paginada. Agregación computada en server desde el RPC existente (bounded: cientos) → cero RPC nueva.
- Caveat de identidad (B11): nota única al tope de la sección + quitar `IdentityMarker` por fila. Contraparte sigue texto crudo, NUNCA enlazada.
- Footer global en `app/layout.tsx`: atribución de datos + CC BY 4.0 con scope cuidado (NO contradecir ChileCompra/SERVEL por-sección), links a `/metodologia` y `/sobre` (crear páginas mínimas si no existen) + contacto.
- Cabecera/resumen parlamentario: región/distrito/circunscripción + período en el header (`parlamentario_publico` ya los emite) y asistencia ("Presente en N de M") como chip del resumen above-fold.

### Claude's Discretion
- Microcopy exacto de líneas-resumen, tarjetas y footer (respetando banned-vocab + doctrina anti-insinuación).
- Detalles de layout/espaciado dentro del marco F45 (CarrilAccordion, mt-12 LOCKED).
- Estructura interna de helpers puros y ubicación de tests (vistas puras RTL + source-scan estructural).
- Si el fetch "todas las filas" de lobby requiere paginar el RPC en lotes, resolverlo server-side sin cambiar contrato público.

### Deferred Ideas (OUT OF SCOPE)
- Votaciones de proyecto agrupadas por jornada/trámite (§2.2.4).
- Roll-call jerarquizado "¿Cómo votó cada diputado?" (§2.2.5).
- Umbral honesto en similares kNN (B18, §2.2.6).
- Directorio con territorio + micro-conteos + orden por región (§2.3).
- Agenda: próximos eventos + truncado de materia (§2.4); cruce inverso proyecto→agenda es Phase 52.
- Buscador global unificado + módulo de actualidad en home (§2.5) — Phase 52.
- Sitemap/indexabilidad (`PUBLIC_INDEXABLE`) — pendiente sign-off.
</user_constraints>

<phase_requirements>
## Phase Requirements

Requirement IDs: **extiende LEG-01..03 de F45** (no hay IDs nuevos; los criterios de éxito SC1–SC9 son el contrato). Mapa SC → soporte de research:

| SC | Behavior | Research Support |
|----|----------|------------------|
| SC1 | Votos agregados por proyecto: línea-resumen + ver detalle | `derivarVotosViewData`/`agruparPorProyecto` ya agrupan por arco pre-paginación; RPC trae `seleccion`+`fecha` por fila → conteos y rango se derivan sin RPC nueva (§Code Examples 1) |
| SC2 | Timeline 2 niveles + bloque "¿dónde está hoy?" (B19) | `tramitacion_evento(tipo,descripcion,fecha)` + parser Senado: pares urgencia = `tipo:'tramite'` "hace presente/retira la urgencia {tipo}" + `tipo:'urgencia'` misma fecha (§Code Examples 3) |
| SC3 | Patrimonio tarjeta-resumen (B3) | `seriePatrimonio` ya emite conteos por `TipoBien`; URIs CPLT viven en `contenido`/`campos` → excluir por heurística URI (§Code Examples 2, §Pitfall 4) |
| SC4 | Comparador cableado (B4) | `PatrimonioSection` ya lee `?comparar=A,B` y `comparar_declaraciones`; solo falta el `<form method="get">` con selects de fechas (§Code Examples 2) |
| SC5 | Rebeldías honestas (B5, ajuste RPC) | 0019 `rebeldias_de_parlamentario` cuenta `seleccion <> mayoria` incluyendo `ausente`; migración drop+recreate excluye ausencias + join `proyecto.titulo` + dedupe (§Code Examples 4, §Runtime State) |
| SC6 | Lobby agrupado por contraparte (B11) | `lobby_de_parlamentario` devuelve TODAS las filas confirmadas (sin limit) → agrupar por `contraparte_nombre` en server; quitar `IdentityMarker` por fila (§Code Examples 5) |
| SC7 | Provenance por sección | `ProvenanceBadge` reusable; consolidar a 1 en heading timeline, conservar link por evento |
| SC8 | Footer global | `app/layout.tsx` sin footer; `/sobre` existe, `/metodologia` NO existe (§Environment) |
| SC9 | Suite verde + tsc + lockdown-guard + anti-insinuación | `pnpm test` (vitest), `tsc --noEmit`, `lockdown-guard.test.ts`, `page-estructura.test.ts` |
</phase_requirements>

## Summary

Esta es una fase de **producto/legibilidad puramente sobre el codebase existente**: cero dependencias nuevas, cero infraestructura nueva. El 95% del trabajo es re-presentar datos que las RPCs ya devuelven, extendiendo el patrón server-driven `searchParams` que el repo ya usa (`?ver=`, `?votosPage`, `?lobbyPage`, `?materia`). La única pieza de base de datos es un **ajuste de un RPC** (`rebeldias_de_parlamentario`, SC5) que sigue el runbook de migración ya establecido (drop+recreate por 42P13, doble revoke+grant, SECURITY DEFINER, pgTAP, apply remoto = checkpoint operador).

Los ocho SC de UI se descomponen en tres patrones repetidos: (1) **agregación en el Server Component** desde las filas ya traídas por una RPC que NO pagina en origen (votos trae hasta 1000, lobby y rebeldías traen TODO) → línea-resumen + detalle bajo `searchParam`; (2) **derivación honesta con omisión** (bloque "¿dónde está hoy?", urgencia vigente) donde un dato no derivable omite la línea en vez de fabricar; (3) **colapso conservador por patrón** (pares de urgencia en timeline) que sólo agrupa lo que casa un patrón textual explícito y deja todo lo demás visible.

El mayor riesgo no es técnico sino **doctrinal**: cada agregado/conteo/colapso nuevo debe pasar el negative-match de banned-vocab y no cruzar la frontera anti-insinuación (`mt-12` entre carriles hermanos, cero composición dinero/lobby+voto, honest-state 1× por sección). La suite ya codifica estos invariantes (`page-estructura.test.ts` source-scan + tests RTL por componente con asserts de vocabulario) y debe seguir verde.

**Primary recommendation:** Extender los componentes existentes en su lugar con helpers puros nuevos (testeables por RTL con fixtures) + un solo `EstadoActualBlock` server nuevo + una migración de RPC + un `<footer>` en el layout + una página `/metodologia` mínima. NO crear nuevas RPCs para SC1/SC3/SC6; computar en el Server Component. Tratar la migración de rebeldías como el único artefacto que requiere checkpoint de operador.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Línea-resumen de votos por arco (SC1) | Frontend Server (RSC) | — | Los datos ya vienen del RPC; el conteo+rango es derivación pura en el Server Component (`derivarVotosViewData`). Cero cliente, cero RPC nueva. |
| Detalle de arco / toggle (SC1) | Frontend Server (RSC) | Browser (navegación) | `searchParams` round-trip; el "cliente" sólo navega vía `<Link>`, sin estado JS. |
| Bloque "¿dónde está hoy?" (SC2) | Frontend Server (RSC) | — | Derivación de etapa/estado (tabla `proyecto`) + último hito + urgencia vigente (eventos) en un Server Component nuevo. |
| Colapso de urgencias timeline (SC2/B19) | Frontend Server (RSC) | — | Heurística de emparejamiento sobre `tramitacion_evento` ya leídos; presentación, no ingesta. |
| Patrimonio tarjeta + comparador (SC3/SC4) | Frontend Server (RSC) | Browser (form GET) | Reusa `seriePatrimonio`; el comparador es `<form method="get">` nativo (cero JS). |
| Rebeldías honestas (SC5) | Database (RPC) | Frontend Server (RSC) | El cómputo cruza `parlamentario.partido` (PII) → DEBE vivir en `security definer`. La exclusión de ausencias/dedupe/join título es SQL. |
| Lobby agrupado por contraparte (SC6) | Frontend Server (RSC) | — | El RPC ya trae todas las filas; la agrupación por frecuencia es derivación server-side. |
| Footer global + páginas /metodologia (SC8) | Frontend Server (RSC) | — | `app/layout.tsx` + páginas estáticas Server Component. |

**Nota de tier (anti-error de asignación):** ninguna capacidad de esta fase pertenece al navegador (Client Component). El único island cliente del repo es `CarrilAccordion` (Radix) + `HeaderNav` (usePathname) + `PatrimonioChart` (Recharts), y NINGUNO se toca en esta fase. Cualquier plan que proponga `"use client"` para votos/lobby/patrimonio/timeline/footer está mal-asignado: todo es server-driven por `searchParams`.

## Standard Stack

**Zero new dependencies.** Todo está ya instalado y en uso en `app/`. Versiones verificadas por lectura de `app/package.json`:

### Core (ya presente, no se instala nada)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.9 | App Router, Server Components, searchParams (Promise) | Runtime de todas las fichas [VERIFIED: app/package.json] |
| react | 19.2.4 | UI | Viene con Next 16 [VERIFIED: app/package.json] |
| @radix-ui/react-accordion | 1.2.x | CarrilAccordion (reuse, sin tocar) | Ya instalado F45 [CITED: 51-UI-SPEC.md] |
| recharts | 3.9.0 | PatrimonioChart (reuse, sin nuevo chart) | Ya instalado F46 [CITED: 51-UI-SPEC.md] |
| @supabase/supabase-js | v2 | Cliente RPC/DB (service_role, Camino A) | Chokepoint `lib/supabase.ts` [VERIFIED: codebase] |
| vitest | ^3.2.6 | Test runner (RTL + source-scan) | `pnpm test` = `vitest run` [VERIFIED: app/package.json] |
| @testing-library/react | (instalado) | Vistas puras RTL con fixtures | Convención del repo [VERIFIED: *.test.tsx] |

### Alternatives Considered
Ninguna. La decisión LOCKED del UI-SPEC es "zero new dependency"; cualquier alternativa (nuevo chart lib, client-state lib, nueva RPC para SC1/3/6) contradice el CONTEXT. No investigar alternativas.

**Installation:** N/A — nada que instalar.

## Package Legitimacy Audit

**No aplica.** Esta fase no instala ningún paquete externo (nuevo). Todas las librerías usadas ya están en `app/package.json` y en uso productivo. No se ejecutó slopcheck porque no hay superficie de instalación. Si el planner introdujera un paquete (no debería), gatearlo con `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram (flujo de datos de la fase)

```
                         /parlamentario/[id]  (Server Component, params+searchParams = Promise)
                                   │
        ┌──────────────────────────┼───────────────────────────────────┐
        │                          │                                    │
   HeaderSection            ParlamentarioResumen                  CarrilesSection
   parlamentario_publico    (chips 3-estado + NUEVO                (conteos 3-estado)
   → región/distrito/       chip "Presente en N de M")                  │
     circunscripción/       ← contarCarrilesSeguro                      │
     período (header        (React.cache, dedup)          ┌────────────┼────────────┬─────────────┐
     enriquecido SC1§2.1)                                 │            │            │             │
                                                     VotosSection  LobbySection  Patrimonio   (cruces/money
                                                          │            │          Section       gated: sin tocar)
                                          votos_de_parlamentario  lobby_de_    declaraciones_/
                                          (p_limit 1000, TODAS)   parlamentario bienes_/comparar_
                                                          │       (TODAS, sin   de_parlamentario
                                                          │        limit)            │
                                         derivarVotosViewData  agruparPorContraparte  seriePatrimonio
                                         + línea-resumen/arco  (freq DESC) +          → tarjeta-resumen
                                         (?votosVer)           caveat 1×/sección      (?ver) + <form GET>
                                         + rebeldias RPC       (?vista=cronologica)   comparador (?comparar)
                                         (ajustado SC5)

                         /proyecto/[boletin]  (Server Component)
                                   │
        ┌──────────────────────────┼───────────────────────┐
   FichaSection          NUEVO EstadoActualBlock       TimelineSection
   (header proyecto)     "¿Dónde está hoy?"            tramitacion_evento (ASC)
                         etapa/estado (tabla proyecto) → 2 niveles: hitos visibles +
                         + último hito (evento)          pares urgencia colapsados
                         + urgencia vigente (eventos)    (?urgencias=<periodo>)
                         omite línea no-derivable        + 1 ProvenanceBadge en heading

                         app/layout.tsx  →  GlobalHeader + {children} + NUEVO <footer>
                                            (CC BY 4.0 scope-caveat + /metodologia + /sobre + contacto)
```

### Pattern 1: Agregación en el Server Component (NO nueva RPC) — SC1, SC3, SC6
**What:** Las tres RPCs de la ficha del parlamentario NO paginan en origen: `votos_de_parlamentario(p_id, 1000, 0)` trae hasta 1000 filas; `lobby_de_parlamentario(p_id)` y `rebeldias_de_parlamentario(p_id)` traen TODAS. La paginación/agrupación se hace hoy en el Server Component (`derivarVotosViewData`, `agruparAudiencias`). El agregado nuevo (línea-resumen, grupo por contraparte, conteos por categoría) se computa ahí mismo.
**When to use:** SC1 (conteos por sentido + rango de fechas por arco), SC3 (conteos por categoría vía `seriePatrimonio`), SC6 (grupos por contraparte ordenados por frecuencia).
**Why not new RPC:** CONTEXT lo prohíbe explícitamente ("cero RPC nueva"). Todas las filas ya están en memoria del server; agregar una RPC añadiría un round-trip y una entrada al allowlist sin ganancia.

### Pattern 2: Server-driven detail toggle vía searchParams
**What:** Cada "Ver detalle"/toggle es un `<Link>` que muta `searchParams` y re-renderiza en el server. Cero estado cliente, cero island nuevo. El patrón ya existe: `buildVerHref` (patrimonio), `buildHref` (votos/lobby con paginación).
**New params esta fase:** `?votosVer=<boletin>` (detalle de arco de votos), `?urgencias=<periodo>` (expandir pares de urgencia), `?vista=cronologica` (toggle de lobby), `?comparar=A,B` (ya existe, ahora cableado por `<form method="get">`).
**Example (href builder, patrón exacto del repo):**
```tsx
// Source: app/components/patrimonio-de-parlamentario.tsx:198-203 (patrón a replicar)
function buildVotosVerHref(id: string, boletin: string | null): string {
  const qs = new URLSearchParams();
  if (boletin) qs.set("votosVer", boletin);
  const q = qs.toString();
  return `/parlamentario/${id}${q ? `?${q}` : ""}#votos`;
}
```

### Pattern 3: Native GET form (comparador, cero JS) — SC4
**What:** Comparador de patrimonio = `<form method="get">` con dos `<select name="...">` de fechas de versión; el submit construye la query nativamente. `PatrimonioSection` ya lee `?comparar=A,B` y llama `comparar_declaraciones` — sólo falta la UI del form. Un `<form method="get">` con selects `name="a"`/`name="b"` produce `?a=...&b=...`; para producir `?comparar=A,B` exacto, usar un solo `<select name="comparar" multiple>` NO es fiable → preferir dos selects y **reconstruir en el Server Component** (leer `a`+`b`, componer `comparar`), o un hidden más JS (evitar; debe ser cero JS). Recomendación: leer `?a`/`?b` en `PatrimonioSection` y tratarlos como las dos fechas, manteniendo compat con `?comparar=A,B` para deep-links existentes.
**Why:** DESIGN-SYSTEM exige SSR sin client JS; `<form method="get">` es la única forma nativa.

### Pattern 4: Derivación honesta con omisión (¿dónde está hoy?, urgencia vigente) — SC2
**What:** El bloque de estado actual deriva 3 líneas; si un dato no es derivable, **omite la línea** en vez de renderizar "—" o fabricar. Espejo del principio ya codificado en `seriePatrimonio` (año no parseable → excluye el punto) y `fechaCortaSegura` (fecha inválida → "fecha no informada").
**Urgencia vigente:** derivada de los eventos, "último `hace presente la urgencia {tipo}` sin un `retira ... urgencia` posterior". No hay campo directo en la tabla `proyecto` (el parser NO persiste `urgencia_actual`); debe computarse de `tramitacion_evento`.

### Recommended file changes (extend-in-place; no new domain components salvo EstadoActualBlock)
```
app/components/
├── votos-por-parlamentario.tsx      # EXTEND: línea-resumen/arco + ?votosVer; helper puro resumenDeArco()
├── voto-ficha-row.tsx               # DELETE dead code B24 (SustanciaYDesenlace "no disponible aún")
├── timeline-view.tsx / timeline-event.tsx  # EXTEND: 2 niveles + colapso urgencias + 1 badge/heading
├── estado-actual-block.tsx          # NEW server component "¿Dónde está hoy?"
├── patrimonio-de-parlamentario.tsx  # EXTEND: VersionRow → tarjeta-resumen + <form GET> comparador + filtro URI
├── lobby-de-parlamentario.tsx       # EXTEND: agrupar por contraparte + ?vista + caveat 1×; quitar IdentityMarker/fila
├── parlamentario-header.tsx         # EXTEND: período + chip "Presente en N de M" (resumen)
app/app/
├── layout.tsx                       # EXTEND: <footer> global
├── proyecto/[boletin]/page.tsx      # EXTEND: insertar EstadoActualBlock tras header, antes de #idea-matriz; timeline 2 niveles
├── metodologia/page.tsx             # NEW página mínima honesta
supabase/migrations/
└── 00XX_rebeldias_sin_ausencias.sql # NEW drop+recreate RPC (SC5) + doble revoke+grant + pgTAP
```

### Anti-Patterns to Avoid
- **`"use client"` en cualquier componente de dominio de esta fase.** Todo es server-driven; el único cliente permitido ya existe (CarrilAccordion/HeaderNav/PatrimonioChart) y no se toca.
- **Nueva RPC para SC1/SC3/SC6.** Prohibido por CONTEXT; computar en el Server Component.
- **`create or replace` para el RPC de rebeldías.** Cambiar el `returns table` (añadir `titulo`, quizás separar ausencias) exige `drop function` previo → 42P13 si no.
- **Mover `mt-12` al wrapper o colapsar el gap entre carriles.** Frontera anti-insinuación LOCKED; `page-estructura.test.ts` Test 1 falla.
- **Componer un voto con una reunión/declaración en un mismo `<li>/<article>/<Card>/<tr>`.** Cero composición cross-dominio.
- **Repetir honest-state por fila.** Se dice 1× por sección (todo el punto de borrar B24).
- **Colapsar cualquier evento de timeline que NO sea un par de urgencia.** Hitos estructurales siempre visibles, sin paginación.
- **Enlazar la contraparte de lobby.** El RPC no emite `contraparte_id`; siempre texto crudo.
- **Renderizar un valor que es URI de CPLT** (empieza con `http://datos.cplt.cl/`) en patrimonio, en tarjeta O detalle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Formateo de fecha corta es-CL | Nuevo formatter | `fechaCorta` / `fechaCortaSegura` (`lib/format.ts`) | Ya maneja guard ISO anti-"Invalid Date" (B17) |
| Truncado literal de idea matriz | Nuevo truncador | `extractoIdea` (`lib/format.ts`) | Corta en límite de palabra, siempre prefijo de la fuente |
| Conteo de votación con en-dash | Concatenación manual | `conteoVotacion(si,no)` → "58–81" | En-dash U+2013 correcto (mono) |
| "hace N días" | Cálculo inline | `relativeTimeEs` (`lib/format.ts`) | Ya pluraliza y cae a fecha absoluta ≥7d |
| Umbral de frescura ámbar | Constante nueva | `esStale` / `STALE_THRESHOLD_MS` (14d) | B6 ya resuelto en F50/format.ts |
| Provenance UI | Nuevo badge | `ProvenanceBadge` | Trazabilidad canónica; ámbar por frescura |
| Conteos de patrimonio por categoría | Nuevo transform | `seriePatrimonio` (misma fuente que chart F46) | CONTEXT lo exige explícitamente |
| Agrupación de audiencias por audiencia | Nuevo agrupador | `agruparAudiencias` (ya existe; extender a por-contraparte) | Left-join → N filas/audiencia ya normalizado |
| Agrupación de votos por proyecto | Nuevo agrupador | `agruparPorProyecto` (ya existe) | Preserva orden por fecha DESC del RPC |
| Cabecera del parlamentario | Nueva cabecera | `ParlamentarioHeader` (extender) | Ya lee región/distrito/circunscripción; sólo falta período + chip |
| Lectura dedup de `parlamentario_publico` | Nuevo fetch | `getParlamentarioPublico` (React.cache) | Ya deduplicado por request |

**Key insight:** Esta fase es 90% re-uso. El helper nuevo correcto es SIEMPRE una función pura (`resumenDeArco`, `agruparPorContraparte`, `paresDeUrgencia`, `derivarEstadoActual`, `esUriCplt`) testeable por RTL/unit con fixtures, NO un componente cliente ni una RPC.

## Runtime State Inventory

> Esta fase es mayormente UI (code-only), PERO SC5 toca la base de datos viva (un RPC). El resto no tiene estado runtime.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguno. No se renombra ni migra ninguna fila/columna/clave. El ajuste de rebeldías cambia el **cómputo** del RPC, no datos almacenados. | none |
| Live service config | **RPC `rebeldias_de_parlamentario` vive en Postgres PROD** (definido por 0019, aplicado). El código nuevo de la migración NO surte efecto hasta que un operador lo aplica con `psql --db-url`. | **checkpoint operador**: apply remoto de la migración + corrida pgTAP. El `tsc`/`build` NO prueban que Postgres ejecutó el DDL (falso positivo). |
| OS-registered state | Ninguno. | none |
| Secrets/env vars | Ninguno nuevo. Se leen los gates existentes (`PUBLIC_INDEXABLE`, `MONEY_PUBLIC_ENABLED`, etc.) sin tocarlos. | none |
| Build artifacts | Deploy Cloudflare (OpenNext, Docker Linux) es checkpoint operador fuera de la fase (CONTEXT: "Deploy = checkpoint operador"). | none dentro de la fase |

**Punto crítico de doble tarea (SC5):** El ajuste de rebeldías es SOLO un cambio de cómputo del RPC — NO hay datos que migrar. Un solo artefacto (la migración) + un solo checkpoint (apply + pgTAP). No confundir con una migración de datos.

**Orden de dependencia de migraciones:** La última migración numerada en `supabase/migrations/` es **0045**. El guard `lockdown-guard.test.ts` bloquea cualquier `GRANT ... TO anon` o `CREATE POLICY ... TO anon` en migraciones **> 0044**. La nueva migración (≥0046) re-emite `grant execute ... to anon` sobre la firma del RPC → **el guard A la marcaría como regresión**. Ver §Pitfall 5 para la resolución (el guard usa el patrón `grant\s+...\bto\s+...anon` que casa `grant execute ... to anon`).

## Common Pitfalls

### Pitfall 1: El guard de lockdown bloquea el `grant execute ... to anon` de la migración de rebeldías
**What goes wrong:** `lockdown-guard.test.ts` bloque (A) FALLA la suite si una migración > 0044 contiene `grant ... to anon`. La migración de SC5 DEBE re-emitir `grant execute on function rebeldias_de_parlamentario(text) to anon;` (gotcha DEFAULT PRIVILEGES: al `drop`+recrear la función, el grant se pierde y Postgres re-concede por default-ACL — hay que ser explícito).
**Why it happens:** El regex del guard `/grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\banon\b/` casa `grant execute ... to anon` en cualquier migración numerada > 44.
**How to avoid:** El planner DEBE decidir con el operador cómo reconciliar: (a) actualizar el guard para permitir `grant execute on function` (no `grant select`/`grant all` sobre tablas) sobre RPCs ya-allowlisted; o (b) mover el grant a una sección/archivo post-0044 exento. **Esto es una Open Question real — no asumir la resolución.** El RPC ya está en `PUBLIC_RPC_ALLOWLIST` (línea 170), así que la intención es que anon lo ejecute; el guard sólo protege contra re-exposición de TABLAS, no de RPCs security-definer PII-safe. La opción más limpia: refinar el regex del guard para no marcar `grant execute on function` (que no expone filas), documentándolo.
**Warning signs:** Suite roja en `(A) Guard — ninguna migracion nueva re-expone anon` tras añadir la migración.

### Pitfall 2: `create or replace` en vez de `drop`+recreate para rebeldías (42P13)
**What goes wrong:** Cambiar el `returns table` (añadir `titulo`, o separar ausencias en columnas) con `create or replace` lanza `42P13 cannot change return type of existing function`.
**Why it happens:** Postgres no permite mutar la firma de retorno de una función existente.
**How to avoid:** `drop function if exists rebeldias_de_parlamentario(text);` ANTES del `create`. Espejo exacto de 0028 (que lo hizo para `votos_de_parlamentario`). Tras el drop+create, re-emitir el grant (Pitfall 1) y confirmar `set search_path = ''` + `security definer`.
**Warning signs:** pgTAP falla con 42P13 al aplicar.

### Pitfall 3: Colapso de urgencias que traga hitos estructurales
**What goes wrong:** Un colapso demasiado agresivo esconde eventos que NO son pares de urgencia (informes, oficios, cambios de trámite, votaciones) → se pierde señal, se viola SC2 ("todo lo demás siempre visible").
**Why it happens:** Los eventos de urgencia vienen de DOS fuentes que hay que emparejar con cuidado: (1) `tipo:'tramite'` con `descripcion` conteniendo "hace presente la urgencia {tipo}" / "retira ... urgencia"; (2) `tipo:'urgencia'` con `descripcion` = el tipo crudo ("Suma", "Simple", "Discusión inmediata") en la misma fecha. El par duplicado de B19 es exactamente {tramite "hace presente la urgencia Suma"} + {urgencia "Suma"} misma fecha.
**How to avoid:** Heurística CONSERVADORA: sólo colapsar eventos cuyo `tipo === 'urgencia'` O cuyo `tipo === 'tramite'` y `descripcion` casa `/urgencia/i` con verbo hace-presente/retira. Cualquier evento fuera de ese patrón = hito estructural, render normal. Agrupar por período (rango de fechas contiguas del mismo tipo de urgencia). Contar los pares; mostrar "Urgencia {tipo} renovada N veces entre {mesX} y {mesY} — ver todas" con expand server-driven.
**Warning signs:** Un test de timeline con fixture mixto (urgencia + informe + votación) donde el informe/votación desaparece.

### Pitfall 4: Renderizar URIs de CPLT como valores de patrimonio (B3)
**What goes wrong:** Campos como `Monto de la deuda: http://datos.cplt.cl/datos/infoprobidad/moneda_6b2366...`, `Acreedor: http://datos.cplt.cl/.../entidad_847` se vuelcan crudos. F46 lo resolvió para el chart (conteos), pero `VersionRow`/`BienesDeVersion`/`paresDeContenido` siguen mostrando el valor literal.
**Why it happens:** `paresDeContenido` hace `String(valor)` sin filtrar; el valor de varios campos del `contenido` jsonb es una URI de dereferencia CPLT, no una cifra.
**How to avoid:** Helper puro `esUriCplt(valor: string): boolean` (p.ej. `/^https?:\/\/datos\.cplt\.cl\//.test(valor)` — VERIFICAR el prefijo exacto contra datos reales antes de anclar el patrón; conservador si dudás). Excluir el par de la tarjeta Y del detalle (`?ver`). La trazabilidad queda por `ProvenanceBadge`/fuente. Aplica a `campos` (VersionRow) y a `paresDeContenido` (BienesDeVersion). El tipo `TipoBien` "pasivo"/"valor"/"accion_derecho" son los que más contienen URIs.
**Warning signs:** Un test con un `contenido` que incluye una URI CPLT y aparece en el DOM.

### Pitfall 5: Next 16 — `searchParams` es una Promise
**What goes wrong:** Leer `searchParams.foo` directo sin `await` en la page da undefined/tipo Promise.
**Why it happens:** En Next 15+/16 `params` y `searchParams` de una page son Promises. El repo ya lo maneja: `const sp = await searchParams;` en `parlamentario/[id]/page.tsx:109` y `const { boletin } = await params;` en `proyecto/[boletin]/page.tsx:29`.
**How to avoid:** Los Server Components internos (`VotosSection`, `LobbySection`, `PatrimonioSection`, y el nuevo `EstadoActualBlock`) reciben `searchParams` YA RESUELTO como objeto plano (`{ [k]: string|string[]|undefined }`) — ese es el contrato actual. NO re-await dentro de los sections. Para nuevos params seguir el helper `single(k)` de `PatrimonioSection:779-782` (maneja `string[]`).
**Warning signs:** `tsc` error de tipo Promise; valores undefined en runtime.
**IMPORTANTE (AGENTS.md):** `app/AGENTS.md` advierte "This is NOT the Next.js you know" y ordena leer `node_modules/next/dist/docs/` antes de escribir código. El planner debe instruir a los ejecutores a verificar cualquier API de Next 16 dudosa contra esos docs locales, no contra memoria.

### Pitfall 6: `/metodologia` no existe; el nav apunta a `/sobre`
**What goes wrong:** El footer del CONTEXT enlaza a `/metodologia` y `/sobre`. `/sobre` existe (`app/app/sobre/page.tsx`); `/metodologia` NO existe → link roto (404 honesto pero indeseable).
**Why it happens:** El nav global (`header-nav.tsx`) usa un solo item "Sobre / Metodología" → `/sobre`. No hay ruta `/metodologia`.
**How to avoid:** Crear `app/app/metodologia/page.tsx` como página mínima honesta (Server Component estático, mismo molde que `/sobre`). NO prometer un diccionario de datos completo (eso es un milestone futuro; `/sobre` ya lo dice: "El diccionario de datos por sección... es trabajo del milestone de Metodología"). El footer puede enlazar ambas; el contenido de `/metodologia` debe ser honesto sobre su alcance actual.
**Warning signs:** Link 404 en footer.

### Pitfall 7: Header enrichment que filtra PII (LEGAL-03)
**What goes wrong:** Añadir partido/foto al header enriquecido viola LEGAL-03.
**Why it happens:** El CONTEXT pide "región/distrito/circunscripción + período" — todos campos públicos que `parlamentario_publico` YA emite (`0020`, verificado). Partido NO se emite (deny-by-default).
**How to avoid:** Sólo usar campos de `ParlamentarioPublicoRow`: `region`, `distrito`, `circunscripcion`, `periodo`. NUNCA `partido`/`rut`/`email` (el RPC ni siquiera los devuelve). El chip "Presente en N de M" se deriva de `contarCarriles`/datos de votos (ya computado en `VotosView`: `presentes = totalConteos - ausentes`).
**Warning signs:** `lockdown-guard.test.ts` bloque B (no debería dispararse porque no se toca `.from('parlamentario')`), o cualquier referencia a `partido` en el header.

### Pitfall 8: OneDrive + `import.meta.url` en tests
**What goes wrong:** Los tests source-scan que resuelven rutas por `import.meta.url` fallan porque el repo vive en OneDrive (no resuelve a `file://`).
**Why it happens:** Lección documentada (45-01, MEMORY): jsdom/vitest sobre OneDrive rompe `new URL(import.meta.url)`.
**How to avoid:** Los tests estructurales nuevos deben resolver rutas por `process.cwd()` + `path.join` (patrón de `page-estructura.test.ts:23` y `lockdown-guard.test.ts:41`), NUNCA `import.meta.url`/`import.meta.dirname` en contexto de lectura de archivos.
**Warning signs:** Test que no encuentra el archivo fuente en CI/local.

## Code Examples

Formas verificadas por lectura directa del codebase (2026-07-02).

### 1. Votos: RPC devuelve todo por arco; línea-resumen se deriva en server (SC1)
```sql
-- Source: supabase/migrations/0028_votos_instructivos.sql:38-69 (RPC vigente en PROD)
-- votos_de_parlamentario(text, int, int) devuelve por fila:
--   votacion_id, boletin, fecha, seleccion, etapa, camara, origen, fecha_captura, enlace,
--   titulo, idea_matriz, resultado, total_si, total_no, total_abstencion, total_pareo, quorum
-- Orden: fecha DESC. Solo confirmadas. LEFT JOIN proyecto/proyecto_ficha (idea null honesto).
```
```tsx
// Source: app/components/votos-por-parlamentario.tsx:662-668 — el server pide 1000 (TODAS):
const { data: todasData } = await sb.rpc("votos_de_parlamentario",
  { p_id: id, p_limit: 1000, p_offset: 0 });
// agruparPorProyecto (:180) ya arma ProyectoArco[] con .etapas por boletín.
// NUEVO helper puro: resumenDeArco(arco) → { n, si, no, ausente, abstencion, pareo, mesInicio, mesFin }
//   n = arco.etapas.length; conteos por e.seleccion; rango = min/max de e.fecha.
//   Render: "Votó en {n} ocasiones sobre este proyecto: {si} a favor · {no} en contra
//            · {c} ausente, entre {mesInicio} y {mesFin}." (omitir sentidos en 0; Mono para n/tallies/rango)
// Detalle bajo ?votosVer=<boletin> renderiza las etapas individuales (el ProyectoGrupo actual).
```

### 2. Patrimonio: seriePatrimonio ya da conteos; comparador ya leído en server (SC3/SC4)
```tsx
// Source: app/components/patrimonio-de-parlamentario.tsx:126-159 — conteos por categoría YA existen:
seriePatrimonio(versiones) // → SeriePunto[] con { anio, tipo_declaracion, version_id,
                           //   inmueble, mueble, actividad, pasivo, accion_derecho, valor }
// Tarjeta-resumen = "Declaración de {tipo}" + "Presentada el {fecha}" (fechaCortaSegura)
//   + "{n} inmuebles · {n} vehículos · ..." desde el SeriePunto de esa versión.
// Comparador: PatrimonioSection:786-857 YA lee ?comparar y llama comparar_declaraciones.
//   Falta SOLO el <form method="get"> con dos <select> de version.fecha_presentacion.
//   Con <2 versiones: omitir el form, conservar DeclaracionComparacion:576-586 (hecho neutro).
```

### 3. Timeline: pares de urgencia a colapsar (SC2/B19)
```ts
// Source: packages/tramitacion/src/parse-senado-tramitacion.ts:156-168 + fixture verificado:
//   tipo:'urgencia'  → descripcion = el TIPO crudo: "Suma" | "Simple" | "Discusión inmediata"
//   tipo:'tramite'   → descripcion incluye "hace presente la urgencia Suma" / "retira ... urgencia"
// TramitacionEventoRow: { boletin, fecha, camara, tipo, descripcion, enlace, origen, fecha_captura }
// Heurística CONSERVADORA de colapso:
function esEventoUrgencia(e: TramitacionEventoRow): boolean {
  return e.tipo === "urgencia" ||
    (e.tipo === "tramite" && /urgencia/i.test(e.descripcion));
}
// Agrupar los urgencia-events contiguos del mismo tipo en un período; TODO lo demás = hito visible.
// urgencia vigente (¿dónde está hoy?): último "hace presente ... urgencia {tipo}" (por fecha)
//   sin un "retira ... urgencia" posterior. Si no derivable → omitir la línea.
```

### 4. Rebeldías: cómputo actual incluye ausencias; el fix (SC5)
```sql
-- Source: supabase/migrations/0019_voto_asistencia_y_ficha.sql:73-98 (RPC vigente en PROD)
-- PROBLEMA (B5): cuenta v.seleccion <> m.mayoria SIN excluir 'ausente' → una AUSENCIA
--   (seleccion='ausente') cuenta como "votó distinto"; además duplica por votación y no trae título.
-- El fix (nueva migración ≥0046):
DROP FUNCTION IF EXISTS rebeldias_de_parlamentario(text);   -- 42P13: returns table cambia (añade titulo)
CREATE FUNCTION rebeldias_de_parlamentario(p_id text)
RETURNS TABLE (votacion_id text, boletin text, titulo text, fecha timestamptz,
               seleccion_propia text, mayoria_bancada text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH yo AS (SELECT partido FROM public.parlamentario WHERE id = p_id),
  mayoria AS (
    SELECT v.votacion_id, mode() WITHIN GROUP (ORDER BY v.seleccion) AS mayoria
    FROM public.voto v JOIN public.parlamentario p ON p.id = v.parlamentario_id
    WHERE p.partido = (SELECT partido FROM yo)
      AND v.estado_vinculo = 'confirmado'
      AND v.seleccion <> 'ausente'          -- NUEVO: la mayoría se computa sin ausencias
    GROUP BY v.votacion_id)
  SELECT DISTINCT ON (v.votacion_id)          -- NUEVO: dedupe por votación
         v.votacion_id, vo.boletin, pr.titulo, vo.fecha, v.seleccion, m.mayoria
  FROM public.voto v
  JOIN mayoria m ON m.votacion_id = v.votacion_id
  JOIN public.votacion vo ON vo.id = v.votacion_id
  LEFT JOIN public.proyecto pr ON pr.boletin = vo.boletin   -- NUEVO: hidratar título (null honesto)
  WHERE v.parlamentario_id = p_id
    AND v.estado_vinculo = 'confirmado'
    AND v.seleccion <> 'ausente'              -- NUEVO: una ausencia propia NO es "votó distinto"
    AND v.seleccion <> m.mayoria;
$$;
REVOKE ALL ON FUNCTION rebeldias_de_parlamentario(text) FROM public;   -- doble revoke
GRANT EXECUTE ON FUNCTION rebeldias_de_parlamentario(text) TO anon;     -- re-grant (DEFAULT PRIVILEGES gotcha)
```
**Nota:** El SQL de arriba es un ESBOZO [ASSUMED] de la forma; el planner/ejecutor debe validar semántica de `mode()`/`DISTINCT ON` y la decisión "excluir vs separar ausencias" (CONTEXT permite ambas). El tipo `RebeldiaRow` (types.ts:218) DEBE crecer con `titulo: string | null` — actualizar el consumidor en `VotosView:496-537` (hoy muestra "Boletín N°{boletin}"; pasará a título + etapa).

### 5. Lobby: RPC trae TODO; agrupar por contraparte en server (SC6)
```tsx
// Source: app/components/lobby-de-parlamentario.tsx:341-352 — el RPC NO pagina, trae todo:
const { data: rpcData } = await sb.rpc("lobby_de_parlamentario", { p_id: id });
// LobbyAudienciaRpcRow: 1 fila por contraparte (left join). agruparAudiencias (:278) → audiencias.
// NUEVO helper puro agruparPorContraparte(audiencias) → Grupo[] { contraparte, n, fechas[] }
//   ordenado por n DESC. Render: "{contraparte} — {n} reuniones: {fechas}" (h3, Mono para n/fechas).
// Caveat 1×/sección (arriba, no por fila): "Las contrapartes se muestran tal como las registra
//   la fuente; su identidad no está verificada." → QUITAR <IdentityMarker/> de ContraparteCruda (:118).
// Toggle: ?vista=cronologica preserva la LobbyView paginada actual (?lobbyPage).
```

### 6. Header enrichment + footer (SC1§2.1, SC8)
```tsx
// Source: supabase/migrations/0020_parlamentario_publico.sql:28-33 — campos disponibles:
//   id, nombre, camara, region, distrito, circunscripcion, periodo, origen, fecha_captura, enlace
// ParlamentarioHeader (parlamentario-header.tsx:31-37) YA arma cargoPartes con distrito/circunscripcion/region.
//   AÑADIR: "Período {periodo}" (Mono). Chip "Presente en {presentes} de {totalConteos}" → resumen above-fold.
// Footer: app/app/layout.tsx:36-43 (hoy body = <GlobalHeader/> + {children}, SIN footer).
//   Añadir <footer> tras {children}: atribución + CC BY 4.0 (scope-caveat) + /metodologia + /sobre + contacto.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Umbral ámbar 48h fijo (B6) | 14 días (2× cadence de ingesta) `esStale` | F50 | El footer/provenance de esta fase heredan el umbral correcto; no re-introducir 48h |
| Rebeldías incluyen ausencias (B5) | Excluir/separar ausencias en el RPC | Esta fase (SC5) | El único cambio de DB |
| Lista plana de votos (90 líneas idénticas) | Arco por proyecto + línea-resumen | Esta fase (SC1) | Mata el 90% del volumen sin perder dato |
| Comparador solo por deep-link (B4) | `<form method="get">` cableado | Esta fase (SC4) | Feature alcanzable por UI |
| IdentityMarker por fila de lobby (B11) | Caveat 1×/sección | Esta fase (SC6) | Ruido reducido; confianza no erosionada |

**Deprecated/outdated:**
- Pages Router: no aplica (el repo es App Router).
- `voto-ficha-row.tsx` `VotoFichaRow`/`VotoFichaMencionRow` con "De qué trata: no disponible aún": dead code B24 → eliminar los paths muertos (231 líneas; verificar qué sigue consumiéndose antes de borrar el archivo entero — `VotoFichaMencionRow` puede tener consumidores en tests/fixtures).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El prefijo de URI CPLT a filtrar es `http(s)://datos.cplt.cl/` | Pitfall 4 | Si el host difiere, el filtro no captura todas las URIs → siguen apareciendo valores basura. **Validar contra datos PROD reales antes de anclar el regex.** |
| A2 | El SQL esbozado de rebeldías (`mode()`, `DISTINCT ON`, exclusión de ausencias) es semánticamente correcto | Code Ex. 4 | Un `mode()` sobre un set sin ausencias podría cambiar la mayoría; validar con pgTAP + datos reales de Alessandri (7 filas hoy, todas ausencias → debe quedar 0 tras el fix) |
| A3 | El guard de lockdown puede refinarse para permitir `grant execute on function` sobre RPCs allowlisted | Pitfall 1 | Es una decisión de operador/seguridad; si NO se permite, la migración necesita otra estrategia (archivo exento). Open Question. |
| A4 | Bastan dos `<select>` + lectura de `?a`/`?b` (o reconstrucción a `?comparar`) para el comparador sin JS | Pattern 3 | Si se exige el param exacto `?comparar=A,B` sin leer `a`/`b`, hace falta más plumbing server-side |
| A5 | El colapso de urgencias se basa en `/urgencia/i` en descripcion + `tipo` | Pitfall 3 | Si hay eventos de urgencia con descripcion que no menciona "urgencia" (p.ej. sólo el TIPO crudo), la heurística `tipo==='urgencia'` los captura igual; validar con fixture real |
| A6 | `VotoFichaMencionRow` es dead code seguro de eliminar | State of the Art | Puede tener consumidores en tests/fixtures RTL; grep antes de borrar el archivo completo |

## Open Questions

1. **Reconciliación guard-lockdown vs `grant execute ... to anon` de la migración de rebeldías**
   - What we know: el RPC ya está en `PUBLIC_RPC_ALLOWLIST`; el intent es que anon lo ejecute. El guard bloquea `grant ... to anon` en migraciones > 0044.
   - What's unclear: si el equipo prefiere refinar el regex del guard (excluir `grant execute on function`) o exentar el archivo.
   - Recommendation: refinar el guard para no marcar `grant execute on function` (que no expone filas, sólo ejecuta security-definer PII-safe), con un test que lo documente. Decisión de seguridad → confirmar con operador en el plan.

2. **Excluir vs separar ausencias en rebeldías (SC5)**
   - What we know: CONTEXT permite ambas ("excluir ausencias del cálculo/salida (o separarlas explícitamente)"). UI-SPEC copy prevé ambas (línea separada "Ausente en {M} votaciones" si se separan).
   - What's unclear: cuál se implementa.
   - Recommendation: EXCLUIR del cómputo de "votó distinto" (más simple, cierra B5); si el equipo quiere mostrar ausencias, hacerlo como línea neutra separada, NUNCA mezclada. El esbozo SQL excluye.

3. **Prefijo exacto de URI CPLT (A1)** — validar contra un `contenido` real antes de anclar el regex del filtro.

4. **Alcance de `/metodologia`** — página mínima honesta ahora; el diccionario de datos completo es un milestone futuro (`/sobre` ya lo declara). Confirmar que el footer no promete más de lo que la página entrega.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/Next toolchain | build/test | ✓ | Next 16.2.9 / React 19.2.4 | — |
| vitest | suite (SC9) | ✓ | ^3.2.6 | — |
| Ruta `/sobre` | footer link | ✓ | `app/app/sobre/page.tsx` existe | — |
| Ruta `/metodologia` | footer link | ✗ | — | **Crear página mínima esta fase** |
| Postgres PROD (apply migración SC5) | rebeldías fix | vía operador | psql `--db-url` | apply = checkpoint operador (no en la fase) |
| Deploy Cloudflare (OpenNext/Docker) | ver cambios en vivo | vía operador | — | Deploy = checkpoint operador (fuera de la fase) |

**Missing dependencies with no fallback:** ninguno bloqueante dentro de la fase.
**Missing dependencies with fallback:** `/metodologia` (crear); apply de migración + deploy son checkpoints de operador conocidos, no bloquean el trabajo de código.

## Validation Architecture

> `workflow.nyquist_validation = true` → sección incluida.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.6 + @testing-library/react (RTL) |
| Config file | `app/vitest.config.ts` (corre desde `app/`) |
| Quick run command | `cd app && pnpm test` (= `vitest run`) — o filtrar por archivo: `pnpm test votos-por-parlamentario` |
| Full suite command | `cd app && pnpm test && pnpm typecheck` |

### Phase Requirements → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | Línea-resumen por arco + ?votosVer + delete B24 | unit RTL | `pnpm test votos-por-parlamentario` | ✅ extender `components/votos-por-parlamentario.test.tsx` |
| SC2 | Timeline 2 niveles + colapso urgencias + EstadoActualBlock | unit RTL | `pnpm test timeline` / nuevo `estado-actual-block.test.tsx` | ❌ Wave 0 (crear tests) |
| SC3 | Patrimonio tarjeta + filtro URI | unit RTL | `pnpm test patrimonio-de-parlamentario` | ✅ extender `components/patrimonio-de-parlamentario.test.tsx` |
| SC4 | Comparador form GET | unit RTL | `pnpm test patrimonio-de-parlamentario` | ✅ mismo archivo |
| SC5 | Rebeldías sin ausencias + título + dedupe | pgTAP (DB) | `psql --db-url ... -f supabase/tests/00XX_rebeldias.test.sql` | ❌ Wave 0 (crear pgTAP) |
| SC6 | Lobby por contraparte + ?vista + sin IdentityMarker/fila | unit RTL | `pnpm test lobby-de-parlamentario` | ✅ extender `components/lobby-de-parlamentario.test.tsx` |
| SC7 | 1 ProvenanceBadge/sección timeline | unit RTL | `pnpm test timeline` | ❌ Wave 0 |
| SC8 | Footer + /metodologia + header período/chip | source-scan + RTL | `pnpm test page-estructura` / nuevo test de layout | parcial |
| SC9 | Suite + tsc + lockdown-guard + anti-insinuación | suite completa | `pnpm test && pnpm typecheck` | ✅ `lockdown-guard.test.ts`, `page-estructura.test.ts` |

### Sampling Rate
- **Per task commit:** `pnpm test <archivo-tocado>` (rápido, <10s por componente).
- **Per wave merge:** `cd app && pnpm test` (suite completa RTL + source-scan) + `pnpm typecheck`.
- **Phase gate:** suite verde (406+ actual, crecerá) + `tsc --noEmit` limpio + `lockdown-guard.test.ts` 7/7 + pgTAP de rebeldías verde (checkpoint operador) antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `components/estado-actual-block.test.tsx` — cubre SC2 (¿dónde está hoy?): derivación honesta + omisión de línea no-derivable.
- [ ] Tests de timeline 2 niveles + colapso urgencias (extender/ crear junto a `timeline-view`/`timeline-event`) con fixture mixto (urgencia + informe + votación) que verifique que NADA salvo pares de urgencia se colapsa.
- [ ] `supabase/tests/00XX_rebeldias_sin_ausencias.test.sql` (pgTAP) — verifica: firma exacta, `security definer`, `search_path=''`, grant a anon, exclusión de ausencias, dedupe, título hidratado.
- [ ] Test de `page-estructura`/layout para el footer global + orden (footer tras `{children}`) y para el header enrichment (período sin partido).
- [ ] Convención de banned-vocab: cada test RTL nuevo debe incluir asserts de vocabulario prohibido (espejo de los tests existentes) sobre el copy nuevo (líneas-resumen, grupos de lobby, colapso de urgencia).
- [ ] Guard de lockdown: si se refina el regex (Open Question 1), añadir un test que documente que `grant execute on function` sobre RPC allowlisted es permitido y `grant select ... to anon` sobre tabla sigue bloqueado.

## Security Domain

> `security_enforcement = true`, `security_asvs_level = 1` → sección incluida.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sitio público read-only; sin login en las superficies tocadas |
| V3 Session Management | no | Sin sesión de usuario en las fichas públicas |
| V4 Access Control | **yes** | Camino A: sitio lee con `service_role` (bypassa RLS) → la protección PII es el `lockdown-guard.test.ts` (estático). El RPC de rebeldías es `security definer` que lee `partido` internamente y emite SOLO derivado público. NUNCA `.from('parlamentario')` en árbol público. |
| V5 Input Validation | **yes** | `searchParams` no confiables: `?votosVer`/`?vista`/`?comparar`/`?urgencias`. El path ya se valida (`BOLETIN_RE`, `PARLAMENTARIO_ID_RE`). Los searchParams se usan como filtros/flags server-side (no interpolados en SQL crudo; supabase-js parametriza). Validar/normalizar (patrón `normalizarPagina`, `single()`). |
| V6 Cryptography | no | Sin operación cripto nueva |
| V7 Error Handling | **yes** | Doctrina #34: un error real de DB/red se LANZA (UI de error honesta), NUNCA se degrada a "sin datos" (fabricaría un hecho). Todo Server Component nuevo (EstadoActualBlock) sigue el patrón: error → throw, ausencia → honest-state. |

### Known Threat Patterns for {Next.js RSC + Supabase RPC, Camino A}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuga de PII (partido/rut/email) por header enrichment o nueva query | Information Disclosure | Usar SOLO campos de `parlamentario_publico`; NUNCA `.from('parlamentario')`; `lockdown-guard.test.ts` bloque B lo verifica |
| Re-exposición de anon por la migración de rebeldías | Elevation of Privilege | Doble `revoke`/`grant execute` explícito; `lockdown-guard.test.ts` bloque A (ver Pitfall 1) |
| RPC no-allowlisted invocado desde árbol público (service_role puede ejecutar admin/write) | Elevation of Privilege | `rebeldias_de_parlamentario` ya en `PUBLIC_RPC_ALLOWLIST`; NO invocar RPCs fuera de la lista; el guard lo verifica |
| searchParam malicioso interpolado | Tampering/Injection | supabase-js parametriza `.rpc()`/`.eq()`; los searchParams son flags/filtros, nunca SQL crudo; normalizar entrada (`single`, regex de página) |
| Error de DB fabricando "sin datos" | Repudiation (dato falso) | Doctrina #34: throw en error, honest-state en ausencia |
| URI CPLT o dato interno filtrado en patrimonio | Information Disclosure | Filtro `esUriCplt` excluye de tarjeta Y detalle (B3) |

**Nota LEGAL-03 (piso duro):** El header enriquecido añade región/distrito/circunscripción/período — todos públicos. Partido/foto quedan OMITIDOS (deny-by-default; el RPC no los emite). Cualquier plan que proponga mostrar partido/afiliación viola el piso de PII y debe rechazarse.

## Sources

### Primary (HIGH confidence — lectura directa del codebase, 2026-07-02)
- `app/components/votos-por-parlamentario.tsx` — VotosView/agruparPorProyecto/ProyectoGrupo/VotosSection/derivarVotosViewData
- `app/components/voto-ficha-row.tsx` — dead code B24 (SustanciaYDesenlace)
- `app/components/patrimonio-de-parlamentario.tsx` — seriePatrimonio/VersionRow/PatrimonioSection/DeclaracionComparacion
- `app/components/lobby-de-parlamentario.tsx` — LobbyView/agruparAudiencias/LobbySection/ContraparteCruda/IdentityMarker
- `app/components/timeline-view.tsx` + `timeline-event.tsx` — lista plana + badge/evento + link fuente
- `app/app/proyecto/[boletin]/page.tsx` — TimelineSection/VotacionesSection/orden (dónde insertar EstadoActualBlock)
- `app/app/parlamentario/[id]/page.tsx` — CarrilesSection/getParlamentarioPublico/mt-12/gates
- `app/app/layout.tsx` — sin footer (body = GlobalHeader + children)
- `app/components/parlamentario-header.tsx` / `parlamentario-resumen.tsx` — cargoPartes/chips 3-estado
- `app/components/global-header.tsx` / `header-nav.tsx` — nav (/sobre, no /metodologia)
- `app/app/sobre/page.tsx` — molde de página estática honesta
- `app/lib/format.ts` — fechaCorta/fechaCortaSegura/extractoIdea/conteoVotacion/relativeTimeEs/esStale/STALE 14d
- `app/lib/types.ts` — TramitacionEventoRow/RebeldiaRow/ParlamentarioPublicoRow/LobbyAudienciaRpcRow/ProyectoRow
- `app/lib/lockdown-guard.test.ts` — PUBLIC_RPC_ALLOWLIST + guard migraciones >0044 + guard PII `.from()`
- `app/app/parlamentario/[id]/page-estructura.test.ts` — convención source-scan + invariantes mt-12/1×dominio
- `app/components/votos-por-parlamentario.test.tsx` — convención RTL + fixtures + banned-vocab
- `supabase/migrations/0019_voto_asistencia_y_ficha.sql` — rebeldias_de_parlamentario vigente (B5)
- `supabase/migrations/0028_votos_instructivos.sql` — votos_de_parlamentario extendido (drop+recreate 42P13)
- `supabase/migrations/0020_parlamentario_publico.sql` — campos del header (region/distrito/circunscripcion/periodo)
- `supabase/migrations/0021_lobby.sql` — lobby_de_parlamentario (sin limit, todas las filas)
- `packages/tramitacion/src/parse-senado-tramitacion.ts` + `timeline.ts` + `model.ts` — tipos y descripciones de urgencia
- `packages/tramitacion/test/fixtures/senado-tramitacion.xml` — strings reales ("hace presente la urgencia Suma", TIPO="Suma")
- `.planning/phases/51-leg2-legibilidad-profunda/51-CONTEXT.md` + `51-UI-SPEC.md` — decisiones LOCKED
- `.planning/DIAGNOSTICO-govmap-2026-07-02.md §2` — diseño de referencia
- `app/AGENTS.md` — "This is NOT the Next.js you know" (leer node_modules/next/dist/docs/)
- `.planning/config.json` — nyquist_validation/security_enforcement flags
- `app/package.json` — Next 16.2.9, React 19.2.4, vitest ^3.2.6

### Secondary (MEDIUM)
- CLAUDE.md — stack constraints, doctrina anti-insinuación, runbook de migraciones
- MEMORY.md — lecciones (OneDrive + import.meta.url, docker deploy, service_role Camino A)

### Tertiary (LOW)
- Ninguna. Fase 100% codebase-grounded; no se necesitó web research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo verificado en `app/package.json`; cero deps nuevas.
- Architecture / data shapes: HIGH — leído directamente de los archivos y migraciones a tocar.
- Rebeldías SQL fix: MEDIUM — la forma del fix es clara (drop+recreate, exclusión ausencias, título, dedupe) pero la semántica exacta (`mode()`/`DISTINCT ON`, excluir vs separar) requiere validación pgTAP con datos reales (A2).
- URI CPLT filter: MEDIUM — el patrón host es asumido (A1); validar contra datos PROD.
- Guard-lockdown reconciliation: MEDIUM — es una decisión de operador/seguridad no resuelta (Open Question 1).
- Pitfalls / anti-insinuación: HIGH — invariantes codificados en tests existentes.

**Research date:** 2026-07-02
**Valid until:** 2026-08-01 (código estable; re-validar si se aplica una migración nueva o cambia el guard antes de planificar)
