---
phase: 92
slug: personas-p2c-lobby-legible-audiencia-pl-fail-closed
status: draft
shadcn_initialized: true
preset: none
created: 2026-07-22
---

# Phase 92 — UI Design Contract

> Lobby LEGIBLE (materia completa verbatim en ambas vistas de la ficha del
> parlamentario, sin line-clamp) + enlace audiencia→PL FAIL-CLOSED por mención
> EXPLÍCITA de número de boletín (chip "Menciona boletín N"), y sección nueva en la
> ficha proyecto "Audiencias de lobby que mencionan este boletín" — SEPARADA y
> rotulada distinto del cruce TEMPORAL 0048 ("Lobby del período"), que NO se toca.
> Autonomous run — todo derivado del design system existente (Tailwind 4 + tokens
> cívicos hsl-horneados) y del 92-CONTEXT (decisiones LOCKED). CERO preguntas.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (base preexistente, `components.json` en `app/`) — NO se inicializa ni se añaden bloques nuevos |
| Preset | not applicable (design system establecido v5–v9; esta fase reutiliza) |
| Component library | Radix (`ui/badge`, `ui/tooltip` ya instalados) vía wrappers `app/components/ui/*`. NO se instalan bloques nuevos. |
| Icon library | ninguna nueva — glifos unicode inline (↗, →, ·, —) como en el repo; NO añadir lucide |
| Font | Geist Sans (texto/materia) + Geist Mono (fechas/IDs/boletines/semana ISO — LOCKED en repo) |

**Tokens LOCKED (guard cero-hex muerde):** todo color vía `var(--...)` o utilidad
Tailwind registrada. `--accent-product` (petróleo, único acento 10% — usar vía la
utilidad `text-accent-product`/`accent-product` registrada, NO envolver a mano en
`hsl()`), `--muted`/`--border`/`--foreground`, `--identity-warn-*` (contrapartes no
verificadas), `--provenance-*`. **PROHIBIDO hex crudo.**

**Contrato de árbol público (Block-B, LOCKED):** el árbol `app/` NO puede `.from()`
una tabla PII. `proyecto` NO es PII y ya se lee server-side (patrón `leerProyecto`).
La validación de existencia de boletín para el chip se resuelve SERVER-SIDE en el
Server Component (una query batched a `proyecto` o vía la RPC nueva), NUNCA client.
El componente `LobbyView` sigue siendo PURO (props) — el chip llega ya calculado en
los datos serializados; ningún island importa `@/lib/supabase` ni `.rpc`/`.from`.

---

## Spacing Scale

Escala Tailwind 4 existente (múltiplos de 4). Esta fase NO introduce spacing nuevo.

| Token | Value | Usage en esta fase |
|-------|-------|--------------------|
| gap-1 / gap-1.5 | 4–6px | Chips inline "Menciona boletín N" agrupados; label+valor dentro de una fila |
| gap-2 | 8px | Fila de chips de mención en `flex flex-wrap gap-2` (varios boletines) |
| mt-1 / mt-2 | 4–8px | Chips de mención bajo la materia; subtextos meta |
| py-3 | 12px | Fila de audiencia (idiom `border-t first:border-t-0` ya en ambos componentes) |
| mb-4 | 16px | Caveat/leyenda; intro; conteo neutro |
| space-y-4 / space-y-6 | 16–24px | Listas de audiencias; grupos |
| **mt-12** | **48px** | **Frontera anti-insinuación LOCKED entre `<section>` hermanos — NUNCA colapsa.** La sección NUEVA de la ficha proyecto es su propia `<section id="lobby-menciones" class="mt-12">`, hermana e independiente de `#lobby-tramitacion` (0048). |
| py-8 md:py-16 | 32–64px | Padding de página (heredado) |

**Exception LOCKED:** `min-h-11` (44px) obligatorio en TODO control interactivo —
chip-link "Menciona boletín N", link al parlamentario, "Ver fuente oficial ↗". El
chip de mención ES un link → cuenta como control táctil.

**Materia legible — regla de whitespace (núcleo de la fase):** la materia se
renderiza con `whitespace-pre-line` (respeta saltos de línea de la fuente y colapsa
el resto) SIN `line-clamp-*` ni `truncate` ni `max-h-*` con overflow oculto. El
contenedor de la materia usa `min-w-0` para permitir el wrap dentro de flex sin
desbordar; NO `overflow-hidden`.

---

## Typography

Roles del repo (Geist). Esta fase reutiliza; NO añade tamaños.

| Role | Size | Weight | Line Height | Uso en esta fase |
|------|------|--------|-------------|------------------|
| Heading (h2) | text-xl (20px) | font-semibold (600) | ~1.3 | "Audiencias de lobby que mencionan este boletín" (sección nueva ficha proyecto) |
| Subhead (h3) | text-base (16px) | font-semibold (600) | ~1.4 | Contraparte cruda / nombre de parlamentario (link) en la fila |
| **Materia (body legible)** | **text-sm (14px)** | **font-normal (400)** | **leading-relaxed (~1.625)** | **Texto COMPLETO de la materia, multilínea, `whitespace-pre-line`. Es el núcleo de la fase — NUNCA clamp/truncate.** |
| Label meta | text-sm (14px) | font-normal (400) | ~1.5 | "Asunto:", "Contraparte:", leyendas anti-causal, conteo |
| Mono | text-xs / text-sm | font-normal (400) | ~1.4 | Fechas, número de boletín en el chip, conteo `{N}` — **Geist Mono LOCKED** |

Regla LOCKED: fechas, números de boletín y conteos SIEMPRE `font-mono`; etiquetas,
materia y nombres en Sans. La materia usa `leading-relaxed` (más aire que el body
normal `~1.5`) porque son párrafos largos verbatim que deben poder leerse enteros.

---

## Color

Split 60/30/10 existente. Esta fase NO altera la paleta.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` / `var(--foreground)` | Superficie de fichas; texto de materia |
| Secondary (30%) | `var(--card)` / `var(--muted)` / `var(--border)` | Filas (`border-t`), banda de caveat (`bg-muted`), fondo del chip de mención |
| Accent (10%) | `accent-product` (petróleo, utilidad registrada) | ver reserved-for |
| Identity-warn | `--identity-warn-*` (ámbar) | Caveat de identidad de contraparte (idiom `CaveatIdentidad` ya existente) — NO se toca |

**Accent (petróleo) reserved for — LISTA CERRADA en esta fase:**
1. El chip-link **"Menciona boletín N"** — borde/texto petróleo (es un enlace a
   `/proyecto/N`; el color codifica "esto navega", coherente con todos los links).
2. Link al nombre del parlamentario en la sección de la ficha proyecto (regla de
   enlace navegable, idiom del carril de cruces que SÍ enlaza al parlamentario público).
3. Link "Ver fuente oficial ↗" por fila (idiom verbatim de `lobby-en-tramitacion.tsx`).
4. Toggle activo agrupada↔cronológica (ya existente, NO se toca).
5. `focus-visible` outline (`focus-visible:outline-2 focus-visible:outline-offset-2
   focus-visible:outline-accent-product`).

**PROHIBIDO:** el chip de mención NO usa color-por-tema ni color-por-boletín; el
petróleo es idéntico para todo chip de mención (codifica "enlace", jamás relevancia,
riesgo ni afinidad). Sin color semántico de "alerta" sobre una mención — una mención
es un hecho neutro del registro público, no una señal.

Destructive: no aplica — solo lectura pública, sin acciones destructivas.

---

## Copywriting Contract

Voz sobria, factual, anti-causal. El linter anti-insinuación (`anti-insinuacion-guard.test.ts`)
se EXTIENDE a las superficies nuevas (chip + sección ficha proyecto) con mutation
self-check. Prohibidos en TODA superficie nueva: "influyó", "gestionó", "presionó",
"a cambio de", "para que se votara", "lobby de", "su lobista", "cercano a",
"vinculado a", "afín", "coordina con", ranking/score/índice de relación, y todo
adjetivo de juicio ("polémico", "influyente", "sospechoso").

### Leyendas LOCKED (texto exacto)

| Element | Copy (LOCKED) |
|---------|---------------|
| Chip de mención (label) | `Menciona boletín {N}` (N = boletín en `font-mono`, p.ej. "Menciona boletín 14309-04") |
| Chip — aria-label | `Esta materia menciona el boletín {N}; abre el proyecto.` |
| Sección ficha proyecto — heading (h2) | `Audiencias de lobby que mencionan este boletín` |
| Sección — leyenda anti-causal (1×, LOCKED) | `La materia de estas audiencias menciona el número de este boletín en el registro público de la Ley del Lobby (Ley 20.730). La mención es un dato del registro; no implica influencia en la tramitación ni relación causal con el proyecto.` |
| Sección — conteo honesto (neutro) | `{N} audiencia registrada menciona este boletín.` / `{N} audiencias registradas mencionan este boletín.` (N en `font-mono`) |
| Sección — conteo truncado (si LIMIT alcanzado) | `Se muestran las {mostradas} audiencias más recientes de {total} que mencionan este boletín.` (idiom `total_n` de 0061; ambos en `font-mono`) |
| Fila — label contraparte | `Contraparte: {nombre crudo}` (verbatim, NUNCA enlazada, sin RUT) |
| Fila — label materia | `Asunto: {materia completa}` (verbatim, `whitespace-pre-line`, sin clamp) |
| Fila — link parlamentario | `{Nombre}` → `/parlamentario/{id}` (nombre vía `formatNombre`) |
| Fila — link fuente | `Ver fuente oficial ↗` (idiom verbatim) |
| Empty — sección ficha proyecto (0 menciones) | `Ninguna audiencia de lobby registrada menciona el número de este boletín en su materia, según las fuentes consultadas. Esto no describe la actividad de lobby en torno al proyecto; solo cuenta las materias que citan explícitamente este número de boletín.` |

### Copy de la materia legible (ficha parlamentario)

| Vista | Cambio de copy |
|-------|----------------|
| Cronológica (existente `VistaCronologica`) | El fragmento `Asunto: {a.materia}` ya existe (línea ~445–450) — se mantiene el rótulo; SOLO cambia el tratamiento tipográfico (whitespace + sin clamp, ver §Component Contract). No hay copy nuevo. |
| Agrupada (existente `VistaAgrupada`) | HOY la vista agrupada NO muestra materia (solo contraparte + conteo + fechas). Se AÑADE la materia legible por reunión dentro del grupo (ver §Component Contract 1). Sin copy editorial nuevo — la materia es verbatim; su rótulo es `Asunto:` idéntico a la cronológica. |

### NEGACIONES_LOCKED (declaración obligatoria para el linter — lección BLOCKER 91)

Las leyendas anti-causal NIEGAN términos que el linter prohíbe. Antes de extender el
scan a las superficies nuevas, estos pares término↔negación deben registrarse como
excepciones permitidas (allowlist de negación), o el linter dará falso-positivo y
BLOQUEARÁ (como en 91):

| Término prohibido | Frase LOCKED que lo NIEGA | Superficie |
|-------------------|---------------------------|------------|
| `influencia` / `influ*` | "…no implica **influencia** en la tramitación…" | Leyenda sección + (paridad de intención) chip context |
| `causal` / `relación causal` | "…ni **relación causal** con el proyecto." | Leyenda sección |
| `actividad de lobby` | "…no describe la **actividad de lobby** en torno al proyecto…" | Empty state sección |

Regla: registrar estos negados en `NEGACIONES_LOCKED` **antes** de añadir las
superficies (`lobby-de-parlamentario.tsx`, la nueva sección de ficha proyecto, el
chip) al glob del scan. Cualquier otra ocurrencia de estos términos SIN la negación
LOCKED sigue siendo violación.

Destructive confirmation: no aplica.

---

## Component Contract (phase-specific)

### 1. Materia legible en la ficha del parlamentario (ambas vistas)

**Problema (LOCKED):** la materia YA está completa en DB (`lobby_audiencia.materia`
verbatim). La falla es PRESENTACIONAL. El dato NO se re-ingiere ni transforma.

**Vista cronológica (`VistaCronologica`, existente):**
- El fragmento actual (líneas ~444–450):
  ```
  {a.materia && (
    <span className="text-sm">
      <span className="text-muted-foreground">Asunto: </span>
      {a.materia}
    </span>
  )}
  ```
  El `<span>` inline NO clampa hoy, pero un `<span>` no honra `\n` de la fuente.
  **Cambio exacto:** el contenedor de la materia pasa a `whitespace-pre-line`,
  `leading-relaxed`, y vive en un bloque (`<div>`/`<p>`), NO en un `<span>` inline,
  para que el texto multilínea se lea entero. `min-w-0` en el contenedor flex padre
  (ya existe en la línea ~425) permite el wrap sin desbordar. PROHIBIDO añadir
  `line-clamp-*`, `truncate`, ni `max-h` con `overflow-hidden`.

**Vista agrupada (`VistaAgrupada`, existente):**
- HOY el grupo por contraparte muestra `{contraparte}` (h3) + `{N} reuniones: {fechas}`.
  NO muestra la materia → el usuario no puede leer de qué trató cada reunión sin
  cambiar a cronológica.
- **Cambio:** dentro de cada grupo, listar por reunión su `{fecha mono}` + la
  `{materia completa}` legible (`whitespace-pre-line leading-relaxed text-sm`), y —
  si aplica — sus chips de mención (Component 2). El conteo neutro `{N} reuniones`
  se mantiene. La materia es verbatim, rótulo `Asunto:`, sin clamp.
- Restricción de carril (LOCKED, GATE de contenido del componente): la materia y sus
  chips de mención viven en la MISMA fila/`<li>` de la reunión (la mención de boletín
  proviene de ESA materia — es el mismo hecho, no la composición de dos dominios). El
  chip de mención NO es un voto ni una declaración → no viola la regla de carril
  aislado; es metadata de la propia audiencia.

**Ambas vistas:** el texto de la materia es SELECCIONABLE (sin `user-select-none`) y
no queda tras un "ver más" (no hay disclosure sobre la materia — se muestra entera).

### 2. Chip "Menciona boletín N" (nuevo, reutilizable)

Espejo estructural de `PartidoChip` (Badge outline), pero es un **link** (navega),
no un chip informativo. Un solo componente usado en ambas vistas de la ficha
parlamentario.

**Anatomía:**
- Envoltura: `<Link href="/proyecto/{N}">` con `<Badge variant="outline">` dentro
  (o Badge con `asChild`), fondo neutro/petróleo-soft, borde/texto petróleo
  (`accent-product`), `min-h-11` táctil, `focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-accent-product`.
- Contenido: texto `Menciona boletín ` (Sans) + `{N}` en `font-mono`.
- `aria-label`: `Esta materia menciona el boletín {N}; abre el proyecto.`
- NO lleva tooltip Radix anidado (el chip YA es interactivo — un TooltipTrigger
  dentro de un Link es HTML hostil; lección WR-04 de `PartidoChip`).

**Ubicación en la card de audiencia:** los chips de mención van BAJO la materia,
en una fila propia `flex flex-wrap gap-2 mt-1` (no inline con el texto — rompería el
wrap de la materia larga). Orden: por número de boletín ascendente (determinista,
NUNCA por "relevancia").

**Múltiples chips:** una materia puede mencionar varios boletines → un chip por
boletín VÁLIDO, en `flex flex-wrap gap-2`. Se deduplican boletines repetidos en la
misma materia (un solo chip por boletín distinto).

**Estados (fail-closed doble, LOCKED):**
| Condición | Render |
|-----------|--------|
| Materia menciona boletín que MATCHEA el patrón determinista **Y** existe en `proyecto` | Chip-link "Menciona boletín N" → `/proyecto/N` |
| Patrón matchea pero el boletín NO existe en `proyecto` | **NO chip** (mención ignorada, jamás se fabrica el link ni un chip muerto) |
| Materia sin ningún boletín | **NO chip** (fila de audiencia normal, solo materia) |
| Materia vacía/null | Sin materia y sin chip (idiom existente `a.materia &&`) |

El patrón de detección espeja `app/lib/boletin-detector.ts` (formatos `14309-04`,
`14309`, `14.309-04`, `14.309`; separador de miles válido vs decimal excluido). La
validación de existencia es SERVER-SIDE (Block-B: `proyecto` no es PII, se lee
server) → el chip llega ya resuelto en los datos serializados a `LobbyView`.

### 3. Sección nueva en la ficha proyecto — "Audiencias que mencionan este boletín"

Carril HERMANO, su propia `<section id="lobby-menciones" className="mt-12">`,
SEPARADA de `#lobby-tramitacion` (0048, cruce TEMPORAL — NO se toca). Consume una RPC
nueva bounded (`lobby_menciones_de_boletin(p_boletin)`, security-definer PII-safe).

**Distinción visual y de rótulo vs "Lobby del período" (0048) — LOCKED:**
| Eje | `#lobby-tramitacion` (0048, EXISTENTE) | `#lobby-menciones` (NUEVA) |
|-----|----------------------------------------|----------------------------|
| Heading | "Reuniones de lobby registradas en el mismo período" | "Audiencias de lobby que mencionan este boletín" |
| Criterio | Coincidencia TEMPORAL (misma semana ISO en que una comisión vio el boletín) | Mención EXPLÍCITA del número de boletín en la materia |
| Parlamentario | TEXTO PLANO no-enlazado (52-03) | **ENLAZADO** a `/parlamentario/{id}` (hay evidencia dura de mención → navegación bidireccional justificada) |
| Rail label | "Lobby del período" (existente) | "Menciones en lobby" (entrada nueva) |
| Caveat | coincidencia temporal ≠ relación | mención en registro ≠ influencia/causa |

Las dos secciones NUNCA se fusionan y su cercanía visual no debe sugerir que son la
misma cosa: heading distinto + leyenda distinta + el rail las lista por separado.

**Layout de fila (una audiencia):** patrón `border-t first:border-t-0 py-3`, idiom
`lobby-en-tramitacion.tsx`:
```
<li> (py-3, border-t)
  <div min-w-0 flex-1>
    <p>  fecha {mono} · <Link petróleo>{Nombre parlamentario}</Link>
    <p>  Contraparte: {nombre crudo verbatim}  (si la fuente la publica; sin RUT)
    <div whitespace-pre-line leading-relaxed>  Asunto: {materia completa}
  <a>  Ver fuente oficial ↗   (petróleo, ml-auto, min-h-11)  → enlace_detalle
</li>
```
- **Orden:** cronológico DESC (más reciente primero) — LOCKED.
- **Count honesto:** conteo neutro arriba (`{N} audiencias… mencionan este boletín.`);
  si la RPC bounded truncó (LIMIT alcanzado), usar la variante `total_n` (0061).
- **Identidad fail-closed:** solo audiencias `estado_vinculo='confirmado'` con
  `parlamentario_id` (espejo 0048). Contraparte SIEMPRE texto crudo, jamás enlazada,
  jamás RUT (el RPC no emite `contraparte_id`).
- **Provenance:** `Ver fuente oficial ↗` por fila (obligatorio); sin enlace → se
  omite el link, nunca se fabrica.

**Colocación en la página:** insertar la `<section id="lobby-menciones" className="mt-12">`
en `app/app/proyecto/[boletin]/page.tsx` como carril hermano, después de
`#lobby-tramitacion` (ambas del dominio lobby, contiguas pero distintas) y antes de
`#cruces`. Añadir su entrada al rail (`ProyectoRail.navEntries`) con label
"Menciones en lobby". El h2 y la leyenda viven DENTRO del componente (degrade
honesto: RPC ausente pre-apply → `PGRST202` → `return null` sin heading huérfano;
el `mt-12` del wrapper preserva la frontera — idiom verbatim de 0048/cruces).

### 4. Estados vacíos honestos (resumen)

| Superficie | Vacío | Renderizado |
|------------|-------|-------------|
| Chip de mención | materia sin boletín válido | NO se pinta chip; la fila muestra solo la materia |
| Materia | `materia` null/vacía | se omite el bloque de materia (idiom `a.materia &&`) — nunca "sin asunto" fabricado |
| Sección ficha proyecto | 0 audiencias mencionan el boletín | heading + leyenda + empty honesto LOCKED (§Copywriting) — NUNCA se lee como "sin lobby" ni "limpio" |
| Sección ficha proyecto | RPC ausente (pre-apply 0062) | `return null` (degrade honesto path-1, `PGRST202`); sin heading huérfano; `mt-12` preserva frontera |
| Sección ficha proyecto | error real DB/red | se LANZA (#34) — nunca degrada a empty (falsa exoneración) |

Regla rectora LOCKED: un vacío es un HECHO, no una virtud. "No hay mención explícita
del número" ≠ "no hubo lobby". El empty state lo declara explícitamente para no leerse
como exoneración.

### 5. Accesibilidad

Patrones ya en repo (post UI-REVIEW 89), reutilizar VERBATIM:

- **focus-visible:** chip-link de mención, link al parlamentario y "Ver fuente
  oficial ↗" → `focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-accent-product`. Nunca `outline-none` sin reemplazo.
- **Touch target:** `min-h-11` (44px) en el chip-link de mención, link parlamentario
  y link de fuente.
- **Chip de mención:** `aria-label` completo ("Esta materia menciona el boletín N;
  abre el proyecto."); el número de boletín en `font-mono` es visible, no solo en
  aria. El chip NO anida TooltipTrigger dentro del Link (WR-04).
- **Materia legible:** texto seleccionable, sin `aria-hidden`, es contenido real
  accesible (no decorativo); multilínea legible por AT sin recorte.
- **Sección ficha proyecto:** `<section>` con `<h2>`; la leyenda anti-causal es `<p>`
  visible (contenido accesible, no tooltip); links con texto de destino claro (nombre
  del parlamentario, no "click aquí").
- **Caveat de identidad de contraparte:** se mantiene el idiom `identity-warn`
  existente donde haya contraparte cruda (ficha parlamentario ya lo tiene 1×/sección).

### Mobile 390px

- Materia: `whitespace-pre-line` + wrap natural; sin scroll horizontal (contenedor
  `min-w-0`, sin `overflow-x`). El texto largo fluye vertical.
- Chips de mención: `flex flex-wrap gap-2` — varios chips hacen wrap a líneas nuevas,
  cada uno `min-h-11`.
- Sección ficha proyecto: filas verticales `space-y`, sin tablas horizontales; el
  link de fuente cae bajo el contenido en móvil (flex-wrap del `<li>`).
- Verificar por iframe same-origin / BrowserOS (patrón de gates previos v8.0/v8.1):
  materia completa visible, chips operando, sección con leyenda.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Ninguno nuevo (reutiliza `ui/badge`, `ui/tooltip` ya instalados) | not required |
| Third-party | ninguno | not applicable |

No se declaran registries de terceros. Vetting gate no aplica.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
