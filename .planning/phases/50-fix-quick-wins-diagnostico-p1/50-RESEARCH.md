# Phase 50: FIX — Quick wins de bugs del diagnóstico 2026-07-02 (P1) - Research

**Researched:** 2026-07-02
**Domain:** Frontend Next.js 16 / React 19 (`app/`) — corrección acotada de 11 bugs de presentación/honestidad ya localizados a file:line
**Confidence:** HIGH (todo verificado leyendo el código en vivo; cero dependencia de conocimiento de entrenamiento)

## Summary

Esta fase NO tiene incógnita técnica: el diagnóstico (`.planning/DIAGNOSTICO-govmap-2026-07-02.md` §1) y el CONTEXT ya traen cada bug con `file:line` y un fix prescrito, y el scout de código de esta investigación confirmó cada sitio. El trabajo de la investigación fue verificar (a) los call-sites reales de las funciones tocadas, (b) qué campos del modelo alimentan cada fix, (c) exactamente qué tests se rompen y cómo, y (d) un caso de dead-code que cambia el alcance de un fix.

Los 11 fixes son de tres clases: **cambio de copy/valor estático** (B1, B10, B12, B8, B15, B14), **umbral de lógica pura** (B6), **guardas anti-crash/anti-fabricación** (B7, B17), y **archivos nuevos espejo** (B9 ×4 error boundaries). Ninguno agrega RPC, DDL, flag ni package. El riesgo real no es implementar los fixes sino **no actualizar los tests que hoy afirman el comportamiento viejo** — hay 5 archivos de test que se rompen deterministamente (format, provenance-badge, page/home, votacion-card, votos-por-parlamentario). Cada uno está inventariado abajo con línea exacta.

**Primary recommendation:** Un commit atómico por bug (`fix(50): …`), cada uno cerrando en verde su(s) test(s). Empezar por los de lógica pura con test unitario (B6, B17) porque su blast-radius de tests es el mayor, y terminar por los archivos nuevos (B9) que no rompen nada existente. Confirmar el dead-code de `voto-ficha-row.tsx` antes de tocarlo (ver Open Questions #1).

## Project Constraints (from CLAUDE.md + CONTEXT.md)

- **GSD workflow**: todo cambio de archivo pasa por un comando GSD; esta fase es `/gsd:execute-phase`.
- **Stack LOCKED**: Next.js 16 App Router + React 19.2 + TypeScript 5. `app/AGENTS.md` ADVIERTE: *"This is NOT the Next.js you know"* — APIs y convenciones difieren del training; leer `node_modules/next/dist/docs/` antes de escribir código nuevo (relevante para B9: firma de `error.tsx`).
- **LOCKED de la fase** (CONTEXT): suite `app/` 377 verde no se rompe; `tsc -b` limpio; `lockdown-guard.test.ts` verde (Camino A — **esta fase NO agrega RPCs**); doctrina anti-insinuación (nunca causalidad/intención) + honest-states (DESIGN-SYSTEM §6/§7); vocabulario prohibido negative-match; **cero DDL, cero flag flipeado, cero deploy**.
- **Doctrina #34** (throw-on-`.error`): un fallo de DB/red NUNCA se degrada a un estado vacío legible como "limpio".
- **Copy es-CL**: cero inglés en UI; tono sobrio; sin adjetivo de juicio, score, ranking, causalidad.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Copy/valor estático de pills, chips, líneas honestas | Frontend Server (RSC) / componentes puros | — | Todo es render server-side de datos ya en Supabase; sin lógica de cliente |
| Umbral de frescura `esStale` | Lib pura (`lib/format.ts`) | Consumido por `ProvenanceBadge` (client) | Función pura testeable; el badge sólo la invoca |
| Guarda de error DB (B7) | Frontend Server (RSC async) | `error.tsx` boundary (client) | El `.error` se chequea server-side y se relanza; el boundary lo captura |
| Error boundaries (B9) | Client Component (`error.tsx`) | — | Next exige que los error boundaries sean Client Components |
| Guarda de fecha (B17) | Componente puro/RSC | — | `new Date(null)`→Invalid Date es render-time; se ataja antes de formatear |
| Distinción Mensaje/Moción (B15) | Frontend Server (lee `proyecto.iniciativa`) | Componente puro `AutoresList` | El dato ya viene en `ProyectoRow.iniciativa`; sólo hay que pasarlo como prop |

**Ningún fix cruza al tier de datos** (sin RPC/DDL). Todo vive en `app/`.

## Standard Stack

Sin cambios de stack. Se usan exclusivamente librerías ya presentes: React 19.2, Next 16, Vitest + Testing Library (RTL), Tailwind. **Cero instalación de packages.**

## Package Legitimacy Audit

**N/A** — esta fase no instala ni actualiza ningún package externo. No hay superficie de slopcheck/registry. (Verificado: todos los fixes son ediciones de archivos `.tsx`/`.ts` existentes + 4 archivos `error.tsx` nuevos que sólo importan `react`.)

## Runtime State Inventory

**N/A** — no es una fase de rename/refactor/migración. B1 (pill `15234-07`→`14309-04`) es un cambio de copy estático en un array TS, no un string persistido en ningún datastore, servicio, tarea OS, secreto ni artefacto de build. Verificado: el pill vive sólo en `app/app/page.tsx:23-28` (`EXAMPLE_CHIPS`) y como fixture en tests; no hay tabla ni config que lo referencie.

## Findings por bug (verificado en código)

### B1 — Pill del home roto → `14309-04`
- **Sitio**: `app/app/page.tsx:27` — `{ query: "15234-07", mono: true }`.
- **Fix**: cambiar el string a `"14309-04"`. Arquitectura intacta (pills LOCKED, array estático).
- **Tests que rompen**: `app/app/page.test.tsx` — línea **86** (`getByRole("button", { name: "15234-07" })`) y líneas **111-112** (clic → `push("/buscar?q=15234-07")`). Actualizar ambas al nuevo boletín (`"14309-04"`, y el push esperado `"/buscar?q=14309-04"` — sin caracteres a escapar).
- **NO tocar**: `app/components/search-result-card.test.tsx` usa `15234-07` como fixture arbitrario de una card de resultado, no como el pill (CONTEXT lo confirma; discreción del executor).

### B6 — Umbral ámbar 48h → cadence (14 días default)
- **Sitio**: `app/lib/format.ts:6` (`STALE_THRESHOLD_MS = 48h`) y `:56-58` (`esStale`).
- **Fix**: firma retro-compatible. Recomendado: `esStale(capturedAt, now = new Date(), thresholdDays = 14)` o un parámetro `staleAfterMs` con default `14*24*60*60*1000`. Todos los call-sites siguen compilando (el único consumidor pasa sólo `capturedAt`).
- **Call-sites de `esStale`**: UN solo consumidor real → `app/components/provenance-badge.tsx:33` (`esStale(capturedAt)`, sin `now`). Ningún otro componente lo llama. `ProvenanceBadge` a su vez es usado en ~12 componentes (votacion-card, timeline-event, lobby, patrimonio, voto-ficha-row, citacion-card, sala-table, etc.), todos vía el mismo badge → **cambiar el default en `esStale` propaga a todo el sitio sin tocar un solo call-site.** No hay hoy ninguna fuente que pase un `now` o un cadence propio; el parámetro opcional queda disponible para futuro (ninguna fuente lo necesita en esta fase).
- **Tests que rompen (2 archivos)**:
  - `app/lib/format.test.ts:63-66` — `"> 48h → true"` usa 49h; con 14d será **false**. Reescribir: `≤14d → false` (p.ej. 13 días) y `>14d → true` (p.ej. 15 días). El caso `≤48h → false` (47h, línea 58-61) sigue pasando pero conviene renombrar el `describe`/`it`.
  - `app/components/provenance-badge.test.tsx:29-42` — `"dato stale (>48h)"` usa `72h` (línea 30); con 14d **ya no es stale** → el override amber no aplica → test FALLA. Cambiar el fixture a >14 días (p.ej. `15 * 24 * 60 * 60 * 1000`). El caso fresco (<48h, 3h, línea 9-27) sigue verde.
- **Docstring**: actualizar comentarios `lib/format.ts:6,53-55` y la referencia UI-SPEC §4 (48h → "cadence de ingesta, ~14 días").

### B7 — `/agenda` traga errores de DB (doctrina #34)
- **Sitios**: `app/app/agenda/page.tsx`:
  - `CitacionesSection` (líneas **276-284**): `const { data } = await sb.from("citacion").select(...)` — **NO** desestructura `error`.
  - `SalaTableServer` (líneas **404-419**): `const [senadoRes, camaraRes] = await Promise.all([...])` — usa `senadoRes.data`/`camaraRes.data` sin chequear `.error`. Además el fallback de ventana (líneas 429-435) tampoco chequea `.error`.
- **Patrón a copiar** (ya en el mismo archivo y en todo el sitio): `ResultadosBusqueda` (líneas 184-193) hace `try/catch`→UI de error; y las secciones de la ficha (`VotosSection`, `LobbySection` — `votos-por-parlamentario.tsx:651`, `lobby-de-parlamentario.tsx:308`) hacen `if (error) throw new Error(...)`. **Usar el patrón `if (error) throw new Error(\`... falló: ${error.message}\`)`** en ambas secciones de agenda. El throw lo captura el nuevo `app/app/agenda/error.tsx` (B9).
- **Cuidado**: `SalaTableServer` hace 3 queries (senado, cámara, y el probe forward-only). Chequear `.error` de las tres. Un fallo del probe forward-only también debe relanzar (no fabricar `fueraDeVentanaSenado`).
- **Tests**: no hay test unitario de estas dos secciones server hoy (son async RSC con Supabase runtime). Verificación = manual/build. Nyquist: considerar un test de que el throw propaga (Wave 0, opcional — ver Validation Architecture).

### B8 — Chip "Cámara origen desconocida"
- **Sitio**: `app/components/camara-chip.tsx:31-33` — el fallback `desconocida` fabrica el label alarma `"Cámara origen desconocida"`.
- **Call-sites de `CamaraChip`** (4 en app):
  1. `timeline-event.tsx:30` — `camara={evento.camara}` (eventos tipo `informe` sin cámara → aquí aparece el bug en vivo).
  2. `ficha-header.tsx:23` — `camara={proyecto.camara_origen}`.
  3. `votacion-card.tsx:35` — `camara={votacion.camara}`.
  4. `parlamentario-header.tsx:42` — `camara={parlamentario.camara}`.
  - También `camaraDotColor` (mismo archivo) lo usa `timeline-event.tsx:24` para el color del dot (ya degrada a `bg-muted-foreground`, correcto — no tocar).
- **Fix recomendado**: hacer que `CamaraChip` **retorne `null`** cuando `classify()` da `desconocida` (omitir el chip). Es seguro en los 4 call-sites: todos lo renderizan dentro de un `flex flex-wrap gap-2` junto a otros elementos (fecha, etapa), así que omitirlo no deja hueco visual. Alternativa (si el diseño exige placeholder): copy neutro SIN "desconocida" (p.ej. no renderizar label). La decisión omitir-vs-neutro es discreción del executor; **omitir es lo más limpio** porque en `informe` la cámara genuinamente no aplica.
- **Verificar**: el dot del timeline (`camaraDotColor`) queda visible aunque el chip se omita — coherente (el dot neutro es aceptable, el label alarma no).
- **Tests**: no hay `camara-chip.test.tsx` dedicado. Buscar assertions de `"desconocida"` en otros tests antes de cambiar (grep confirmó: 0 usos del literal en tests).

### B9 — `error.tsx` faltantes ×4
- **Patrón a espejar**: `app/app/parlamentario/[id]/error.tsx` (leído completo). Puntos clave del patrón:
  - `"use client";` obligatorio (Next exige Client Component para error boundaries).
  - Firma: `({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void })`. **⚠️ Este Next usa `unstable_retry`, NO el `reset` del Next estándar** — confirmar en `node_modules/next/dist/docs/` (AGENTS.md lo advierte). Copiar la firma exacta del archivo existente.
  - `useEffect(() => console.error(error), [error])`.
  - Copy es-CL sobrio: h1 "No pudimos cargar esta ficha/página", párrafo "Esto es una falla técnica, no una ausencia de información…", botón "Reintentar" → `unstable_retry()`.
- **Crear 4 archivos** (ajustar el h1 al contexto de cada ruta):
  - `app/app/proyecto/[boletin]/error.tsx`
  - `app/app/parlamentarios/error.tsx`
  - `app/app/buscar/error.tsx`
  - `app/app/agenda/error.tsx` (captura el throw de B7)
- **Verificar rutas existen**: confirmar los directorios `app/app/proyecto/[boletin]`, `app/app/parlamentarios`, `app/app/buscar`, `app/app/agenda` (el de agenda existe; validar los otros con Glob antes de escribir).
- **Tests**: los error boundaries no suelen tener test unitario (el existente de parlamentario no lo tiene). No rompen nada. Nyquist: opcional smoke render.

### B10 — Copy lobby hardcodeado a la Cámara
- **Sitio**: `app/components/lobby-de-parlamentario.tsx` — el string `"el registro oficial de la Cámara (camara.cl/transparencia)"` aparece **3 veces**: intro (líneas 103-108), empty-state (b) (línea 131), y está implícito en el (a) noIngestado. `LobbyView` es puro (recibe `data: LobbyViewData`).
- **Cómo llega la cámara**: **HOY NO llega.** `LobbySection` (línea 288) recibe sólo `{ id, searchParams }`; `LobbyView` recibe sólo `data`. La cámara del parlamentario vive en `parlamentario.camara` (usado en `parlamentario-header.tsx:42`), pero `CarrilesSection` (`page.tsx:135`) que renderiza `<LobbySection id={id} searchParams={sp} />` (línea 177) sólo tiene `id` — NO camara.
- **Opciones para threading la camara** (decisión del planner):
  1. `LobbySection` hace su propia lectura de `parlamentario.camara` (hay un getter cacheado con `React.cache` para `contarCarrilesSeguro`; probablemente exista uno análogo para el parlamentario — verificar `HeaderSection`/`lib/supabase` getters). Añadir `camara` a `LobbyViewData` y parametrizar el copy.
  2. `CarrilesSection` obtiene la camara una vez y la pasa como prop a `LobbySection`.
  - Opción 1 es más aislada (no cambia la firma de CarrilesSection) pero añade una lectura; con `React.cache` se deduplica. **Recomendado: opción 1** si existe getter cacheado del parlamentario; si no, opción 2.
- **Fuente REAL para senadores**: el diagnóstico dice lobby es **solo diputados** (5.106 confirmadas, 0 de senadores). Por eso las fichas de senador caen en el estado **(a) noIngestado** → sólo se muestra el intro + el copy honesto, sin filas. Aun así el intro dice "la Cámara" — incorrecto para un senador. Parametrizar: senado → "el Senado / el registro de la Ley del Lobby del Senado" (la Ley 20.730 cubre ambas cámaras; el portal del Senado es la fuente que correspondería). **Trazabilidad**: el `enlace` por fila (`a.enlace`, línea 199) apunta a la fuente REAL de cada audiencia y NO se toca — sólo cambia el texto del frame/intro. Para senadores no hay filas, así que el enlace no aplica; el copy del intro/empty debe reflejar la cámara del parlamentario, no un supuesto.
- **Tests**: `app/components/lobby-de-parlamentario.test.tsx` existe y testea `LobbyView` con fixtures. Si `LobbyViewData` gana un campo `camara`, los fixtures del test deben incluirlo → actualizar el `makeData`/fixtures. Verificar assertions del literal "Cámara (camara.cl/transparencia)".

### B12 — Locale mal capitalizado ("2 De Julio")
- **Causa raíz**: `capitalize` de Tailwind sobre TODO el string capitaliza cada palabra ("2 De Julio"). Sitios en `app/app/agenda/page.tsx`:
  - Línea **242**: `<span className="capitalize">{diaFmt.format(new Date(c.fecha))}</span>` (resultados de búsqueda).
  - Línea **315**: `<h3 className="text-base font-semibold capitalize">` (headers de día en CitacionesSection).
  - Las líneas 216 y 304 son los `new Intl.DateTimeFormat("es-CL", { weekday, day, month })` que producen "jueves, 2 de julio" (correcto en minúscula).
- **Fix**: quitar `className="capitalize"` y capitalizar SOLO la primera letra. Recomendado un helper puro en `lib/format.ts`: `capitalizarPrimera(s: string): string` (`s.charAt(0).toUpperCase() + s.slice(1)`), aplicado al output del formatter → "Jueves, 2 de julio". OJO: `es-CL` con `weekday:"long"` produce coma ("jueves, 2 de julio"); si el diagnóstico pide "Jueves 2 de julio" (sin coma) eso es un cambio adicional de formato — el CONTEXT dice resultado "Jueves 2 de julio" pero el fix mínimo es sólo la capitalización; **mantener la coma que produce el locale** salvo que el planner decida quitarla (discreción; no fabricar formato).
- **Tests**: no hay test de estas líneas. Si se agrega `capitalizarPrimera` a `format.ts`, agregar test unitario (Nyquist Wave 0).

### B14 — Votación sin desenlace → línea honest-state
- **Sitio**: `app/components/votacion-card.tsx:65-82` — hoy `{votacion.resultado && (…)}` OMITE toda la sección cuando `resultado` es null.
- **Fix**: cuando `resultado` es null, renderizar una línea honest-state en lugar de omitir: **"Desenlace no informado por la fuente."** (mismo estilo `text-sm text-muted-foreground`). Los totales/barra (líneas 52-63) ya se muestran siempre — intactos. El `EtapaBadge` (líneas 77-80) sí depende de `resultado` → sólo se muestra con resultado. Estructura sugerida: cambiar `{resultado && (...)}` por un ternario que en la rama null muestre la línea honest.
- **Reversión deliberada**: B14 revierte la decisión de Phase 22 ("resultado null omite la frase"). El diagnóstico en vivo mostró que la omisión se lee como inconsistencia entre cards de Cámara (con desenlace) y Senado (sin).
- **Test que rompe**: `app/components/votacion-card.test.tsx:51-66` — `"resultado null → omite la frase de desenlace…"` afirma en **línea 62** `expect(screen.queryByText(/El proyecto fue/)).not.toBeInTheDocument()`. Reescribir el test: renombrar el `it` a "resultado null → muestra 'Desenlace no informado por la fuente.'" y assertion `getByText("Desenlace no informado por la fuente.")`. Conservar las assertions de que la barra (`getByLabelText(/Resultado de votación/i)`, línea 65) y totales (línea 64) persisten.

### B15 — Copy "Autores no informados" en proyectos Mensaje
- **Campo distintivo**: `ProyectoRow.iniciativa: string | null` (`lib/types.ts:17`). Valores CANÓNICOS: **`"Mensaje"` o `"Moción"`** (verificado: `packages/tramitacion/src/model.ts:12` `type Iniciativa = "Mensaje" | "Moción"`; `parse-senado-tramitacion.ts:50-53` `iniciativaDe` mapea `/mensaje/i`→"Mensaje", `/moci/i`→"Moción"). **`origen` NO sirve** (es la fuente de datos: "diputados"/"senado"/etc.), el campo correcto es `iniciativa`.
- **⚠️ Caveat de datos**: para proyectos ingestados por la ruta Cámara, `iniciativa` viene **null** (`packages/tramitacion/src/ingest-run.ts:230` `iniciativa: null`); sólo la ruta Senado la puebla. Y `autores` = 0/136 en toda la base. Por eso HOY todo dice "Autores no informados". El fix del copy sólo cambia el caso `iniciativa === "Mensaje"`; cuando `iniciativa` es null y `autores` vacío, sigue "Autores no informados." (honesto).
- **Cómo llega**: `AutoresList` (`autores-list.tsx:11`) recibe SOLO `autores: string[]`. Hay que **pasarle `iniciativa`** (o un booleano `esMensaje`) como prop desde `FichaHeader` (`ficha-header.tsx:55` `<AutoresList autores={proyecto.autores ?? []} />` — `proyecto.iniciativa` está disponible ahí, ya se usa en línea 35).
- **Fix**: `AutoresList({ autores, iniciativa })`. Si `autores.length === 0`:
  - `iniciativa === "Mensaje"` → **"Iniciativa del Ejecutivo (Mensaje)."**
  - else → "Autores no informados." (Moción sin autores, o iniciativa null).
- **Tests**: no hay `autores-list.test.tsx` hoy (grep: 0). Nyquist Wave 0: crear uno cubriendo los 3 casos (Mensaje sin autores, Moción sin autores, con autores). Si `AutoresList` gana un prop requerido, verificar que no rompe `ficha-header` (le pasamos `proyecto.iniciativa`).

### B17 — `fecha_presentacion` sin guard (VersionRow)
- **Sitios en `app/components/patrimonio-de-parlamentario.tsx`**:
  - Línea **383**: `const fechaTexto = fechaCorta(new Date(version.fecha_presentacion));` — sin guard; también usado en la línea 391 y 408.
  - Línea **607**: `Presentada el {fechaCorta(new Date(c.fecha_presentacion))}` (dentro de la vista `?ver=` detalle server-driven).
- **Guard existente a reutilizar**: `seriePatrimonio` líneas **130-137** ya tiene el patrón WR-03: `const raw = v.fecha_presentacion ?? ""; const yyyy = raw.slice(0,4); if (!/^\d{4}$/.test(yyyy)…) return [];`. Para VersionRow el guard debe **degradar a copy honesto** en vez de excluir: "fecha no informada" cuando `fecha_presentacion` es null/vacía/no-ISO.
- **Fix recomendado**: helper compartido en `lib/format.ts`, p.ej. `fechaCortaSegura(raw: string | null, fallback = "fecha no informada"): string` que valide ISO (slice 0,10 o regex) antes de `new Date`, retornando el fallback si no parsea. Reemplazar `fechaCorta(new Date(version.fecha_presentacion))` (383) y (607) por `fechaCortaSegura(version.fecha_presentacion)` / `fechaCortaSegura(c.fecha_presentacion)`. Cuidado: la línea 408 (`es_historica`) también usa `fechaTexto` — al centralizar, esa rama hereda el fallback (aceptable).
- **Riesgo**: `new Date(null)` → `Invalid Date` → `Intl.format(Invalid Date)` → "Invalid Date" renderizado (no un 500, pero visualmente roto). El guard evita el string basura.
- **Tests**: `patrimonio-de-parlamentario.test.tsx` existe; verificar si algún fixture pasa `fecha_presentacion` válida (sí, para el chart). Añadir caso con `fecha_presentacion` null → "fecha no informada" (Nyquist Wave 0). Si se agrega `fechaCortaSegura`, test unitario en `format.test.ts`.

### Honest-state repetido ("De qué trata: no disponible aún")
- **⚠️ HALLAZGO DE ALCANCE (dead code)**: los dos sitios que el CONTEXT lista NO son equivalentes:
  - `app/components/votos-por-parlamentario.tsx:225-229` (`ProyectoGrupo`) — **LIVE**: es lo que renderiza `VotosView` (línea 424-426) en la ficha real. Aquí "De qué trata: no disponible aún" aparece **una vez por arco de proyecto**; con muchos arcos sin idea_matriz, se repite = ruido.
  - `app/components/voto-ficha-row.tsx:89` (`SustanciaYDesenlace` de `VotoFichaRow`) — **DEAD CODE en el render path**: grep confirma que `VotoFichaRow`/`VotoFichaMencionRow` sólo se importan desde `votos-por-parlamentario.test.tsx`, **ningún page/componente live los renderiza**. La sección de votos usa `ProyectoGrupo`, no `VotoFichaRow`. (Concuerda con B24 del diagnóstico: "componente muerto voto-ficha-row.tsx".)
- **Fix del sitio LIVE**: en `ProyectoGrupo`/`VotosView`, mostrar la nota honesta **una vez por sección** cuando ≥1 arco no tiene idea_matriz, y **omitir** la línea per-arco "De qué trata: no disponible aún". Cuando el arco SÍ tiene idea, seguir mostrando "De qué trata: {extracto}". Implementación sugerida: en `VotosView`, computar `hayArcoSinIdea = arcos.some(a => !a.idea_matriz)` y renderizar una nota de sección (p.ej. bajo el `<h3>` o al pie de la lista de arcos); en `ProyectoGrupo`, la línea `grupo.idea_matriz ? "De qué trata:…" : (omitir)`.
- **Decisión requerida (Open Question #1)**: ¿tocar también `voto-ficha-row.tsx:89` aunque sea dead code? Opciones: (a) fixear por consistencia + actualizar su test, (b) dejarlo (no se renderiza; B24/Phase 51 lo eliminará), (c) eliminarlo ahora (fuera de alcance — es B24). **Recomendado: (b)** — no gastar blast-radius en código muerto; documentar. El planner decide.
- **Tests que rompen**: `app/components/votos-por-parlamentario.test.tsx:210-219` — `"idea_matriz null → honest-state 'no disponible aún'"` testea `VotoFichaRow` (el componente muerto). Si se elige (b), ese test sigue verde (VotoFichaRow sin cambios) pero afirma un comportamiento que ya no ocurre en vivo → considerar migrarlo a testear `ProyectoGrupo`/`VotosView` (la nota una-vez-por-sección). Si el ProyectoGrupo pierde la línea per-arco, cualquier test futuro sobre `VotosView` debe afirmar la nota de sección, no la repetición. Verificar además tests existentes de `VotosView` que pudieran afirmar "no disponible aún" per-arco.

## Architecture Patterns

### Patrón 1: Componente puro + Server wrapper (LOCKED en este código)
La mayoría de secciones separan `XView` (puro, RTL-testeable con fixtures) de `XSection` (async RSC que lee Supabase). B10, honest-state, B15 caen aquí → **modificar el componente puro y sus fixtures de test**, no el wrapper.

### Patrón 2: Honest-state vs error (doctrina #34)
- **Dato ausente** = HECHO honesto (copy sobrio, sin alarma).
- **Error de DB/red** = `throw` → `error.tsx` boundary. NUNCA degradar error a vacío.
- B7 corrige la única página que viola esto; B9 provee los boundaries que capturan el throw.

### Patrón 3: Guarda anti-fabricación de fecha (WR-03)
Nunca `new Date(campoPosiblementeNull)` directo en render. Validar ISO antes. B17 extiende el patrón ya presente en `seriePatrimonio`.

### Anti-patterns a evitar
- **Fabricar contenido**: el honest-state va UNA vez; repetirlo es ruido, no honestidad (regla del CONTEXT).
- **Cambiar arquitectura por un copy fix** (B1: cambiar el valor, no construir validación dinámica contra DB).
- **Introducir inglés** en cualquier copy/boundary nuevo.
- **Vocabulario prohibido** (DESIGN-SYSTEM §6/§9.1): causalidad, score, ranking, "cercano a", adjetivo de juicio. Negative-match en tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary de ruta | UI de error ad-hoc por sección | Espejar `parlamentario/[id]/error.tsx` (firma `unstable_retry`) | Next exige convención `error.tsx`; el patrón ya está probado |
| Guarda de fecha | `try/catch` inline por sitio | Helper `fechaCortaSegura` en `format.ts` (patrón WR-03 existente) | DRY; ya hay validación ISO en `seriePatrimonio` |
| Capitalización | `capitalize` de Tailwind (capitaliza cada palabra) | Helper `capitalizarPrimera` sobre el output del formatter | Tailwind `capitalize` es CSS `text-transform` → toca todas las palabras |
| Throw-on-error | Chequeo custom de red | `if (error) throw new Error(...)` (patrón de VotosSection/LobbySection) | Doctrina #34 uniforme; lo captura `error.tsx` |

## Common Pitfalls

### Pitfall 1: Olvidar actualizar tests que afirman el comportamiento viejo
**Qué sale mal**: la suite 377 cae. **5 archivos rompen deterministamente**: `format.test.ts` (B6), `provenance-badge.test.tsx` (B6, fixture 72h), `page.test.tsx` (B1, pill), `votacion-card.test.tsx` (B14, línea 62), `votos-por-parlamentario.test.tsx` (honest-state, línea 210). **Cómo evitar**: cada commit incluye su test actualizado; correr `pnpm --filter app test` por fix.

### Pitfall 2: Tocar el componente muerto `voto-ficha-row.tsx` creyéndolo live
**Qué sale mal**: se gasta esfuerzo (y se arriesga romper su test) en código que no se renderiza. **Cómo evitar**: confirmar con grep que ningún page importa `VotoFichaRow`; el sitio live es `ProyectoGrupo`.

### Pitfall 3: `esStale` — un cambio de default, un blast-radius global silencioso
**Qué sale mal**: es fácil creer que hay que tocar cada `ProvenanceBadge`. **Cómo evitar**: hay UN call-site de `esStale`; cambiar el default propaga solo. Pero DOS tests dependen del umbral 48h — actualizarlos.

### Pitfall 4: `iniciativa` null en la ruta Cámara
**Qué sale mal**: asumir que `iniciativa === "Mensaje"` cubre todos los Mensaje. En datos reales muchos vienen null (ruta Cámara) → seguirán en "Autores no informados". **Cómo evitar**: es correcto (honesto); documentar que el copy Mensaje sólo aplica cuando `iniciativa` está poblada. No fabricar.

### Pitfall 5: Firma de `error.tsx` (`unstable_retry`, no `reset`)
**Qué sale mal**: copiar la firma del Next estándar (`reset`) rompe el boundary. **Cómo evitar**: copiar verbatim `parlamentario/[id]/error.tsx`; consultar `node_modules/next/dist/docs/` (AGENTS.md).

## Code Examples (del propio código, verificados)

### Guard WR-03 existente (patrón para B17) — `patrimonio-de-parlamentario.tsx:130-137`
```typescript
const raw = v.fecha_presentacion ?? "";
const yyyy = raw.slice(0, 4);
const anio = Number(yyyy);
if (!/^\d{4}$/.test(yyyy) || !Number.isFinite(anio)) return []; // excluye basura
```

### Throw-on-error (patrón para B7) — `votos-por-parlamentario.tsx:651`
```typescript
if (todasError) {
  throw new Error(`votos_de_parlamentario falló para ${id}: ${todasError.message}`);
}
```

### error.tsx (patrón para B9) — `parlamentario/[id]/error.tsx`
```typescript
"use client";
import { useEffect } from "react";
export default function XError({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (/* h1 + párrafo es-CL + botón Reintentar → unstable_retry() */);
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (jsdom) |
| Config file | `app/vitest.config.*` (existe; suite corre 377) |
| Quick run command | `pnpm --filter app test` |
| Full suite command | `pnpm --filter app test` (377 tests) |
| Typecheck | `pnpm --filter app exec tsc -b` |
| Guard PII | `lockdown-guard.test.ts` (parte de la suite; verde = OK) |

### Phase Requirements → Test Map
| Bug | Behavior a validar | Test Type | Comando | Archivo (¿existe?) |
|-----|--------------------|-----------|---------|--------------------|
| B1 | pill = 14309-04, navega correcto | RTL | `pnpm --filter app test page.test` | ✅ actualizar `app/app/page.test.tsx:86,111` |
| B6 | esStale false ≤14d, true >14d | unit | `pnpm --filter app test format.test` | ✅ reescribir `format.test.ts:63-66` |
| B6 | badge amber solo >14d | RTL | `pnpm --filter app test provenance-badge` | ✅ fixture `provenance-badge.test.tsx:30` → 15d |
| B7 | error DB → throw (no vacío) | RTL/integration | (async RSC; smoke opcional) | ❌ Wave 0 opcional |
| B8 | chip omitido en `desconocida` | RTL | `pnpm --filter app test` | ❌ Wave 0: `camara-chip.test.tsx` |
| B9 | 4 boundaries renderizan es-CL + Reintentar | RTL smoke | `pnpm --filter app test` | ❌ Wave 0 opcional (patrón sin test hoy) |
| B10 | copy por cámara (Senado≠Cámara) | RTL | `pnpm --filter app test lobby` | ✅ actualizar `lobby-de-parlamentario.test.tsx` fixtures |
| B12 | "Jueves, 2 de julio" (1ª mayúscula) | unit | `pnpm --filter app test format.test` | ❌ Wave 0: test de `capitalizarPrimera` |
| B14 | resultado null → "Desenlace no informado por la fuente." | RTL | `pnpm --filter app test votacion-card` | ✅ reescribir `votacion-card.test.tsx:51-66` |
| B15 | Mensaje sin autores → "Iniciativa del Ejecutivo (Mensaje)." | RTL | `pnpm --filter app test` | ❌ Wave 0: `autores-list.test.tsx` (3 casos) |
| B17 | fecha null → "fecha no informada" (no "Invalid Date") | unit+RTL | `pnpm --filter app test format.test patrimonio` | ✅/❌ test de `fechaCortaSegura` + caso en patrimonio.test |
| honest-state | nota una-vez-por-sección; sin repetición per-arco | RTL | `pnpm --filter app test votos-por-parlamentario` | ✅ migrar `votos-por-parlamentario.test.tsx:210` a VotosView |

### Sampling Rate
- **Per task commit**: `pnpm --filter app test <archivo>` del fix + `pnpm --filter app exec tsc -b`.
- **Per wave merge**: `pnpm --filter app test` (suite completa).
- **Phase gate**: suite completa verde (≥377, subirá con los tests nuevos) + `tsc -b` limpio + `lockdown-guard` verde antes de `/gsd:verify-work`.

### Wave 0 Gaps (tests a crear antes/junto al fix)
- [ ] `app/components/autores-list.test.tsx` — B15 (Mensaje / Moción / con autores).
- [ ] `app/components/camara-chip.test.tsx` — B8 (senado, diputados, desconocida→null).
- [ ] Test de `fechaCortaSegura` en `format.test.ts` — B17 (null/vacío/no-ISO → fallback).
- [ ] Test de `capitalizarPrimera` en `format.test.ts` — B12.
- [ ] (Opcional) smoke render de los 4 `error.tsx` — B9.
- [ ] (Opcional) test de que `CitacionesSection`/`SalaTableServer` relanzan en `.error` — B7.
- [ ] Migrar/ampliar test del honest-state a `VotosView` (nota de sección).

## Security Domain

`security_enforcement` no está en config → tratado como enabled, pero esta fase **no abre superficie de seguridad nueva**: cero RPC, cero DDL, cero input handling nuevo, cero flag. Camino A (guard PII vía `lockdown-guard.test.ts`) permanece intacto — ningún fix agrega `.from(<tabla PII>)` ni `.rpc(<no-allowlisted>)`.

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V5 Input Validation | marginal | B7 mejora el manejo de fallo de datos (throw, no degradar); inputs (searchParams) ya validados aguas arriba |
| V5 Output Encoding | sí (existente) | `safeExternalHref` en ProvenanceBadge ya sanea `javascript:`/`data:` (no tocado) |
| V6 Cryptography | no | — |
| V2/V3/V4 auth/session/access | no | esta fase es render de datos public-read |

**Threat pattern relevante**: ninguno nuevo. El único cuidado es no romper el guard PII — verificado que ningún fix toca lecturas de datos sensibles.

## State of the Art

N/A — sin cambio de librerías/versiones. Nota vigente del stack: `app/AGENTS.md` advierte que este Next.js tiene breaking changes vs training (p.ej. `error.tsx` usa `unstable_retry`, no `reset`); consultar `node_modules/next/dist/docs/`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LobbySection` puede obtener `parlamentario.camara` vía un getter cacheado (React.cache) sin doble fetch | B10 | Si no existe getter, hay que threadear camara desde CarrilesSection (cambio de firma) — bajo riesgo, sólo más verboso |
| A2 | `voto-ficha-row.tsx` es dead code en el render live (sólo importado por su test) | honest-state | Si algún page lo importa dinámicamente, el fix quedaría incompleto. Mitigado: grep exhaustivo sobre `app/**` dio 0 imports en pages/components |
| A3 | `14309-04` sigue existiendo en PROD con ficha (verificado por el operador vía psql el 2026-07-02) | B1 | Si se despobló, el pill vuelve a dead-end. Bajo riesgo (es el proyecto-evidencia del diagnóstico) |
| A4 | El fallback amber >14d es el umbral honesto acordado (ingesta semanal ⇒ 2× cadence) | B6 | Si la cadence real difiere, el número cambia; es un parámetro, trivial de ajustar |
| A5 | Los directorios de ruta `proyecto/[boletin]`, `parlamentarios`, `buscar` existen para colocar `error.tsx` | B9 | Verificar con Glob antes de escribir; si el nombre difiere, ajustar ruta |

## Open Questions

1. **¿Tocar `voto-ficha-row.tsx` (dead code) en el fix del honest-state?**
   - Qué sabemos: sólo lo importa su test; el sitio live es `ProyectoGrupo`.
   - Recomendación: NO editarlo (dejarlo para B24/Phase 51); fixear sólo `VotosView`/`ProyectoGrupo` y migrar el test. El planner confirma.
2. **B10: ¿fetch propio de camara en LobbySection o prop desde CarrilesSection?**
   - Recomendación: opción 1 (getter cacheado) si existe; verificar en Wave 0.
3. **B12: ¿quitar la coma del locale ("Jueves 2 de julio") o conservarla ("Jueves, 2 de julio")?**
   - Recomendación: fix mínimo = sólo capitalización; conservar la coma que produce `es-CL`. El planner decide si además normaliza el formato.

## Environment Availability

N/A — fase de código puro sobre `app/`; sin dependencias externas nuevas. Toolchain requerido ya presente: Node/pnpm, Vitest, tsc (la suite corre hoy en 377).

## Sources

### Primary (HIGH — código leído en esta sesión)
- `app/lib/format.ts`, `app/lib/format.test.ts` — esStale/umbral, call-sites (B6, B12, B17).
- `app/app/page.tsx`, `app/app/page.test.tsx` — pill home (B1).
- `app/components/camara-chip.tsx` + call-sites (timeline-event, ficha-header, votacion-card, parlamentario-header) — B8.
- `app/components/votacion-card.tsx`, `votacion-card.test.tsx` — B14.
- `app/components/autores-list.tsx`, `ficha-header.tsx`, `lib/types.ts` (`ProyectoRow.iniciativa`), `packages/tramitacion/src/model.ts`/`parse-senado-tramitacion.ts` — B15.
- `app/components/lobby-de-parlamentario.tsx`, `app/app/parlamentario/[id]/page.tsx` — B10.
- `app/components/patrimonio-de-parlamentario.tsx` — guard WR-03 + B17 (líneas 383, 607).
- `app/components/votos-por-parlamentario.tsx`, `voto-ficha-row.tsx`, `votos-por-parlamentario.test.tsx` — honest-state + dead-code.
- `app/components/provenance-badge.tsx`, `provenance-badge.test.tsx` — B6 blast-radius + fixture 72h.
- `app/app/agenda/page.tsx` — B7, B12.
- `app/app/parlamentario/[id]/error.tsx` — patrón B9.
- `app/AGENTS.md`, `.planning/config.json` — constraints, nyquist habilitado.
- `.planning/DIAGNOSTICO-govmap-2026-07-02.md`, `50-CONTEXT.md` — decisiones LOCKED.

## Metadata

**Confidence breakdown:**
- Localización de bugs y fixes: HIGH — cada file:line verificado leyendo el archivo.
- Impacto en tests: HIGH — líneas exactas de assertion leídas (5 archivos que rompen).
- B10 threading de camara: MEDIUM — hay que confirmar existencia de getter cacheado (A1).
- Dead-code de voto-ficha-row: HIGH — grep confirmó 0 imports live.

**Research date:** 2026-07-02
**Valid until:** ~2026-08-01 (código estable; re-verificar si PROD despuebla `14309-04` o si Phase 51 elimina `voto-ficha-row.tsx`).
