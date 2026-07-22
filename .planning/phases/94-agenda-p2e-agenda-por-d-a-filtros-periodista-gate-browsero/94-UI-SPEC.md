---
phase: 94
slug: agenda-p2e-agenda-por-d-a-filtros-periodista-gate-browsero
status: draft
shadcn_initialized: true
preset: none
created: 2026-07-22
---

# Phase 94 — UI Design Contract

> /agenda navegable POR DÍA (tz America/Santiago) con filtros de periodista
> (island client), estados de cancelación honestos ("Suspendida"/"Sin efecto"
> sobrios), banner de cobertura DECLARADA (insumo §7+§8 de 93), y los 2 fixes de
> wiring de la ficha proyecto (citaciones PASADAS visibles + "En tabla de sala").
> Autonomous run — todo derivado del design system existente (Tailwind 4 + tokens
> cívicos hsl-horneados) y del 94-CONTEXT (decisiones LOCKED). CERO preguntas.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (base preexistente, `components.json` en `app/`) — NO se inicializa ni se añaden bloques nuevos |
| Preset | not applicable (design system establecido v5–v9; esta fase reutiliza) |
| Component library | Radix (`@radix-ui/react-accordion` vía `CarrilAccordion`, `ui/card`, `ui/separator`, `ui/skeleton` ya instalados) vía wrappers `app/components/ui/*`. NO se instalan bloques nuevos. |
| Icon library | ninguna nueva — glifos unicode inline (▾, ↗, →, ·, —, ←) como en el repo; NO añadir lucide |
| Font | Geist Sans (texto/materia) + Geist Mono (fechas/horarios/boletines/semana ISO/rangos — LOCKED en repo) |

**Tokens LOCKED (guard cero-hex muerde):** todo color vía `var(--...)` o utilidad
Tailwind registrada. `--accent-product` (petróleo, único acento 10% — usar vía la
utilidad `text-accent-product`/`accent-product` registrada, NUNCA envolver a mano en
`hsl()` — lección UI-REVIEW 89), `--camara-*`/`--senado-*` (cívicos hsl-horneados en
`civic-tokens.css`, `var()` directo SIN envolver en `hsl()`), `--muted`/`--border`/
`--foreground`, `--provenance-*`. **PROHIBIDO hex crudo.** El estado de cancelación
NO estrena token nuevo: usa `--muted-foreground` (sobrio), NUNCA `--destructive`.

**Contrato FichaRail / árbol público (LOCKED):** el island de filtros
(`"use client"`) filtra/deriva EN MEMORIA sobre el slice serializado por el server
(que ya aplicó el filtro grueso SSR por semana). JAMÁS importa `@/lib/supabase` ni
`.rpc`/`.from` (guard PII lockdown escanea `app/`). Las lecturas de `citacion`,
`sesion_sala`, `sesion_tabla_item` (tablas no-PII, public-read 0010) viven en el
Server Component; el island recibe las filas ya serializadas. Los fixes de la ficha
(estado-actual-block) leen `sesion_tabla_item` server-side (tabla no-PII).

**tz America/Santiago (REGLA LOCKED — núcleo de la fase):** la agrupación por DÍA
JAMÁS usa UTC. Una citación de las 21:00 de Chile NO puede caer en el día siguiente.
Reutilizar el idiom `DIA_CALENDARIO_CHILE` de `estado-actual-block.tsx:92-98`
(`Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" })` → emite ISO
`YYYY-MM-DD` DST-safe). **BUG A CORREGIR:** hoy `page.tsx:326-331` y `:344` usan
`timeZone: "UTC"` para agrupar y rotular el día — eso es el pitfall exacto que el
CONTEXT prohíbe. El `dayKey` debe derivarse por día-calendario-Chile, no por
`c.fecha.slice(0,10)` (que es el día UTC almacenado).

---

## Spacing Scale

Escala Tailwind 4 existente (múltiplos de 4). Esta fase NO introduce spacing nuevo.

| Token | Value | Usage en esta fase |
|-------|-------|--------------------|
| gap-1 / gap-1.5 | 4–6px | Chips inline dentro del header de una card (cámara + hora); label+valor |
| gap-2 | 8px | Fila de chips de filtro (`flex flex-wrap gap-2`); chips cámara/comisión |
| mt-1 / mt-2 | 4–8px | Subtexto meta; leyenda de counts bajo el fieldset; marca "pasada" |
| mt-4 | 16px | Bloque de día; separadores de sub-agrupación por comisión; ProvenanceBadge |
| space-y-4 / space-y-6 | 16–24px | Listas de citaciones dentro del día; grupos por comisión |
| mt-8 / mt-12 | 32–48px | Separación entre `<section>` (`#citaciones` mt-8, `#tabla-sala` mt-12) — heredado |
| py-8 md:py-16 | 32–64px | Padding de página (heredado) |

**Exception LOCKED:** `min-h-11` (44px) obligatorio en TODO control interactivo —
chip de filtro (cámara/comisión), trigger de acordeón de día (`CarrilAccordion` ya
lo trae), `<summary>` "ver más" de materia, links de navegación semanal, botón
"esta semana", link de boletín. Touch target táctil.

**Banner de cobertura:** su propia banda `rounded-lg border border-border bg-muted/40
px-6 py-4` (idiom del `CamaraDegradedState` / empty-states existentes), ANTES del
`WeekNav` o inmediatamente bajo el `<h1>`. Tono neutro, NUNCA `bg-destructive`.

---

## Typography

Roles del repo (Geist). Esta fase reutiliza; NO añade tamaños.

| Role | Size | Weight | Line Height | Uso en esta fase |
|------|------|--------|-------------|------------------|
| Display (h1) | text-3xl (30px) | font-semibold (600) | leading-tight (1.25) | "Agenda legislativa" (ya existe) |
| Heading (h2) | text-xl (20px) | font-semibold (600) | ~1.3 | "Citaciones de comisiones", "Tabla de sala" (ya existen) |
| Día-header (h3, trigger acordeón) | text-base (16px) | font-semibold (600) | ~1.4 | "Lunes 22 de julio" + conteo mono (idiom `CarrilAccordion headingLevel="h3"`, ya en page.tsx) |
| Comisión / cámara sub-header (h4) | text-sm (14px) | font-semibold (600) | ~1.4 | Sub-agrupación por comisión dentro del día (ya en page.tsx:371) |
| Body | text-base (16px) | font-normal (400) | leading-relaxed (~1.625) | Materia de la citación (idiom `CitacionCard`) |
| Label meta / leyenda | text-sm (14px) | font-normal (400) | ~1.5 | Leyendas de cobertura, counts honestos, empty-states, marca "pasada" |
| Mono | text-xs / text-sm | font-normal (400) | ~1.4 | Fechas, horarios, semana ISO, boletines, rangos de cobertura, conteos `{N}` — **Geist Mono LOCKED** |

Regla LOCKED: fechas, horarios, semana ISO, números de boletín y conteos SIEMPRE
`font-mono`; etiquetas, materia, comisiones y nombres en Sans.

---

## Color

Split 60/30/10 existente. Esta fase NO altera la paleta.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` / `var(--foreground)` | Superficie de /agenda y ficha; texto de materia |
| Secondary (30%) | `var(--card)` / `var(--muted)` / `var(--border)` | Cards de citación, banda del banner de cobertura, chips de filtro base, filas de tabla de sala |
| Accent (10%) | `accent-product` (petróleo, utilidad registrada) | ver reserved-for |
| Cívico (institucional, NO acento) | `var(--camara-*)` / `var(--senado-*)` | SOLO `CamaraChip` (cámara vs senado) — distingue cámara SIN tratar la cámara como "acento". NUNCA para estado ni cobertura. |

**Accent (petróleo) reserved for — LISTA CERRADA en esta fase:**
1. Link de boletín a la ficha (`Boletín N°{N} →`, idiom `CitacionCard`).
2. Link "En tabla de sala ({cámara}) del {fecha}" → /agenda de esa semana (fix ficha gap #2).
3. Link de navegación semanal / "Volver a la vista semanal" / "esta semana" activo.
4. Estado `engaged` del chip de filtro (`border-accent-product bg-accent-product-soft text-accent-product`, idiom `FacetChip` de `parlamentarios-filtro.tsx`).
5. `focus-visible` outline (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product`).

**PROHIBIDO — el estado de cancelación NO lleva color de alarma.** "Suspendida" /
"Sin efecto" se renderizan en `text-muted-foreground` (sobrio) con una marca textual,
NUNCA `--destructive`, NUNCA rojo, NUNCA un badge de peligro. Una suspensión es un
hecho neutro del registro, no un error ni una señal de riesgo (T-06-09: la
degradación honesta jamás usa estilo destructive). Igual para la marca "pasada" de la
ficha: es contexto temporal neutro, `text-muted-foreground`, jamás alarma.

**PROHIBIDO — el banner de cobertura NO usa color semántico de advertencia.** THIN /
"al día en su ventana" se comunican por TEXTO (rango de semanas mono), sobre
`bg-muted/40` neutro. No hay ámbar/rojo de "cobertura incompleta" — la parcialidad es
un hecho declarado, no una alerta.

Destructive: no aplica — solo lectura pública, sin acciones destructivas.

---

## Copywriting Contract

Voz sobria, factual, anti-causal. El linter anti-insinuación
(`anti-insinuacion-guard.test.ts`) se EXTIENDE a las superficies nuevas con
mutation self-check si aparece copy nuevo. Prohibidos en TODA superficie nueva los
términos de insinuación de relación/afinidad/causalidad y todo adjetivo de juicio
("polémico", "influyente"). Regla de honestidad LOCKED de la auditoría 93:
**"estado ausente ≠ vigente confirmado"** — NUNCA fabricar vigencia a partir de la
ausencia de marca de cancelación.

### Leyendas LOCKED (texto exacto)

| Element | Copy (LOCKED) |
|---------|---------------|
| Día-header (con actividad) | `{Día} {DD} de {mes}` (p.ej. "Lunes 22 de julio", `capitalizarPrimera`) + conteo mono `{N} {citación\|citaciones}` (idiom `CarrilAccordion`) |
| Día sin actividad (semana cubierta) | `Sin actividad registrada este día.` (hecho — la semana está ingerida, ese día no tuvo citaciones) |
| Estado citación — suspendida | Marca textual `Suspendida` (mono no; Sans muted), tomada verbatim de `citacion.estado`; NUNCA reinterpretada |
| Estado citación — sin efecto | Marca textual `Sin efecto` verbatim de `citacion.estado` |
| Estado citación — sin `estado` poblado | NO se renderiza marca alguna; la citación se muestra normal. NUNCA se añade "Vigente" ni "Confirmada" (§Honestidad: ausencia de estado ≠ vigencia) |
| Leyenda de estado (1×, en la sección o el banner) | `Cuando una citación fue suspendida o dejada sin efecto, se muestra su estado según la fuente. La ausencia de esa marca significa que la fuente no registró una cancelación — no confirma que la sesión se realizará.` |
| Banner cobertura — heading | `Cobertura de la agenda` (h2 o rótulo sobrio; NO alarma) |
| Banner cobertura — intro (1×, LOCKED) | `Esta agenda muestra lo que se ha ingerido de las fuentes oficiales. La cobertura es parcial y se declara por origen; no es un calendario completo del Congreso.` |
| Banner — celda comisiones Cámara | `Comisiones de la Cámara: {N} citaciones ingeridas en {S} semanas ({rango min→max}); el histórico completo del período está pendiente de carga.` (N, S y rango DERIVADOS dinámicamente de la DB — NO hardcodeados) |
| Banner — celda comisiones Senado | `Comisiones del Senado: al día en su ventana (próximas semanas); la fuente es forward-only, sin histórico disponible.` (estructural — declarado, no derivado) |
| Banner — celda sala Cámara | `Tabla de sala de la Cámara: solo la sesión vigente (PDF semanal procesado); sin histórico estructurado.` (estructural) |
| Banner — celda sala Senado | `Tabla de sala del Senado: al día en su ventana; la fuente es forward-only, sin histórico.` (estructural) |
| Empty — sin citaciones esta semana | `No hay citaciones de comisiones registradas para esta semana.` (existente, se mantiene) + link a /buscar |
| Empty — sin resultados de búsqueda | `Sin resultados` + cuerpo existente (se mantiene) |
| Ficha proyecto — citación PASADA (fix #1) | `Citado el {fecha} en {comisión}` con marca `(sesión pasada)` sobria en `text-muted-foreground` |
| Ficha proyecto — citación vigente/futura (existente) | `Citado en {comisión} el {fecha}.` (idiom `EstadoActualView`, se mantiene) |
| Ficha proyecto — en tabla de sala (fix #2) | `En tabla de sala de la {Cámara\|Senado} del {fecha}` → link a /agenda?semana={Www} |
| Ficha proyecto — en varias tablas de sala | `En tabla de sala {N} veces` (conteo honesto; enlaza a la más reciente o lista cada una con su semana) |

### NEGACIONES_LOCKED (declaración obligatoria para el linter — lección BLOCKER 91)

La leyenda de estado y la intro del banner NIEGAN términos que el linter puede
prohibir. Antes de extender el scan a las superficies nuevas, estos pares
término↔negación deben registrarse en `NEGACIONES_LOCKED` (allowlist), o el linter
dará falso-positivo y BLOQUEARÁ (como en 91):

| Término potencialmente prohibido | Frase LOCKED que lo NIEGA | Superficie |
|----------------------------------|---------------------------|------------|
| `confirma` / `confirmad*` | "…no **confirma** que la sesión se realizará." | Leyenda de estado |
| `completo` / `calendario completo` | "…no es un **calendario completo** del Congreso." | Intro del banner de cobertura |

Regla: registrar estos negados en `NEGACIONES_LOCKED` **antes** de añadir las
superficies al glob del scan. Cualquier otra ocurrencia SIN la negación LOCKED sigue
siendo violación. (Los términos de cobertura "parcial"/"forward-only"/"pendiente" son
descriptivos honestos, no insinuación — no requieren negación.)

Destructive confirmation: no aplica.

---

## Component Contract (phase-specific)

### 1. Agrupación por DÍA (tz America/Santiago) — `CitacionesSection`

**BUG A CORREGIR (núcleo):** hoy `page.tsx` agrupa por `c.fecha.slice(0,10)` (día
UTC) y formatea con `timeZone: "UTC"`. Ambos violan la regla LOCKED. Cambio exacto:

- **dayKey por día-calendario-Chile:** derivar la clave de agrupación con el idiom
  `DIA_CALENDARIO_CHILE` (`Intl.DateTimeFormat("en-CA",{ timeZone:"America/Santiago" })`)
  sobre `new Date(c.fecha)`. Una citación almacenada a medianoche UTC que corresponde
  a las 21:00 CL del día anterior cae en el día-Chile correcto.
- **Día-header en tz Chile:** el `diaFmt` de rotulación pasa a `timeZone:
  "America/Santiago"` (weekday/day/month, es-CL, `capitalizarPrimera`).
- Estructura visual heredada (se conserva): cada día es un `CarrilAccordion`
  (`headingLevel="h3"`, primer día `defaultOpen`); dentro, sub-agrupación
  PRESENTACIONAL por comisión (h4 muted + `Separator`), cada citación = `CitacionCard`.

**Distinción Cámara vs Senado dentro del día (CIT-02):** la `CitacionCard` YA porta
`CamaraChip` (cívico) por card. Decisión de esta fase: dentro de cada día, ordenar y
sub-agrupar por **cámara primero, luego comisión** (la query ya hace
`.order("camara").order("comision")`). El sub-header de comisión (h4) puede prefijar
la cámara cuando el día mezcla ambas, o basta el `CamaraChip` por card (evita
duplicar). Regla: la distinción sala vs comisiones es POR SECCIÓN (`#citaciones` =
comisiones; `#tabla-sala` = sala) — NO se mezclan en el mismo bloque de día.

**Días vacíos honestos:** dentro de una semana ingerida, un día sin citaciones NO se
pinta como acordeón vacío ni se omite silenciosamente si el resto de la semana tiene
actividad — el conjunto de días mostrados son los que tienen filas (idiom Map
existente). El mensaje "Sin actividad registrada este día" aplica SOLO si se decide
renderizar días-esqueleto de la semana; si no, la ausencia de un día del `Map` es
honesta por el banner de cobertura (que declara qué semanas/celdas están cubiertas).
NUNCA leer un día sin filas como "no hubo sesiones" — el banner cubre esa honestidad.

**Sin-fecha:** las citaciones sin `fecha` van a un grupo "Sin fecha asignada"
(idiom existente, se mantiene) — NUNCA se fabrica un día.

### 2. Island de filtros de periodista — `agenda-filtros` (nuevo, FichaRail)

Cae bajo contrato FichaRail: island `"use client"` que filtra EN MEMORIA el slice de
citaciones YA serializado por el server (la semana cargada). Espejo estructural de
`parlamentarios-filtro.tsx` (facetas + counts honestos "de estos N"). NUNCA
re-consulta; el `buscar_citaciones` FTS SSR existente NO se reemplaza (coexisten: FTS
para búsqueda global por texto; island para afinar la semana cargada).

**Anatomía (orden vertical, mobile-first):**
```
<section aria-label="Filtrar la agenda de esta semana">
  <p>   leyenda counts honestos "de estas N citaciones"     ← text-xs muted, 1×
  <fieldset> Cámara       [Ambas] [Cámara · n] [Senado · n]  ← FacetChip toggle
  <fieldset> Comisión     [Comisión A · n] [Comisión B · n] … [Sin dato · n]
  <fieldset> Rango de fechas   [inputs date desde/hasta DENTRO de lo cargado]
  <fieldset> Boletín      [input text + detector boletin-detector]
  [Esta semana]           ← reset/atajo (link o botón que limpia filtros)
```

- **Faceta cámara:** chips `Cámara · {n}` / `Senado · {n}` (counts de estas N);
  toggle. Espejo `FacetChip`.
- **Faceta comisión:** chips por comisión presente en la semana cargada, count de
  estas N, orden por frecuencia DESC luego alfabético; `Sin dato · {n}` al final para
  citaciones sin comisión (nunca las oculta — idiom `PARTIDO_SIN_DATO`). Facetas con
  count=0 `disabled` (`opacity-40`, `aria-disabled`).
- **Rango de fechas (Claude's Discretion → decisión):** **inputs `<input type="date">`
  desde/hasta**, NO slider (más accesible, teclado-friendly, sin dependencia nueva).
  El rango está ACOTADO a `min`/`max` = fechas presentes en el slice cargado (no
  permite pedir fechas fuera de lo ingerido → coherente con "de estos N"). Vacío =
  sin filtro de fecha.
- **Boletín (input):** reutiliza `app/lib/boletin-detector.ts` (formatos `14309-04`,
  `14309`, `14.309-04`); filtra las citaciones cuyo `citacion_punto.boletin` matchea.
  Si el input es un boletín completo y el usuario lo confirma, el atajo SSR existente
  (`BOLETIN_RE.test(q)` → `redirect(/proyecto/N)`) se mantiene para la barra de
  búsqueda global; el filtro island es afinado local, no navega.
- **"Esta semana":** atajo que resetea todos los filtros island (vuelve al slice
  completo de la semana). Petróleo cuando no hay filtros activos NO — es un reset
  neutro; el estado activo lo llevan los chips.
- **Counts honestos "de estas N" (LOCKED):** leyenda
  `Conteos sobre estas {N} citaciones cargadas de esta semana, no sobre toda la
  agenda.` (espejo `leggendaCounts` de parlamentarios-filtro). Cada faceta muestra su
  count sobre el slice completo, no sobre el resultado ya filtrado.
- **Empty tras filtro:** heading `Sin citaciones para este filtro` + body `Ajusta o
  quita filtros para ver más.` (espejo directorio) — distinto del empty "sin
  citaciones esta semana" (que es dato, no filtro).
- **Convivencia con acordeones por día:** el island envuelve/recibe el conjunto de
  días; al filtrar, re-computa los días visibles en memoria (los días que quedan sin
  citaciones tras el filtro se ocultan). El server serializa las filas planas; el
  island reagrupa por día-Chile con el mismo idiom (o el server pasa los grupos ya
  formados y el island filtra dentro). Decisión: **el server pasa las filas planas +
  el dayKey ya calculado (Chile)**; el island filtra y reagrupa — mantiene el cómputo
  de tz en el server (no duplica tzdb en cliente) pero permite el filtrado en memoria.

### 3. Banner de cobertura DECLARADA (nuevo)

Consume §7+§8 de `93-AUDITORIA-CITACIONES.md`. Su propia banda sobria
`rounded-lg border border-border bg-muted/40 px-6 py-4`, ubicada bajo el `<h1>` y
ANTES del `WeekNav` (contexto antes de navegar). Colapsable opcional
(`DetalleColapsable`) si ocupa mucho en móvil — pero la intro LOCKED siempre visible.

- **Derivable dinámico vs estructural declarado (LOCKED — §7):**
  - **DERIVAR de la DB** (no hardcodear): para comisiones×Cámara, el `{N}` citaciones,
    `{S}` semanas ISO distintas y `{rango min→max de fecha}` se computan server-side
    (`count`, `count(distinct semana_iso)`, `min/max(fecha)`), NO se escriben como
    verdades eternas. Reflejan el estado real al render.
  - **DECLARAR estructural** (texto fijo): forward-only del Senado (comisiones y sala)
    y "solo sesión vigente" de sala Cámara son límites de FUENTE — copy fijo LOCKED
    (§Copywriting), no derivado.
- **Cuatro celdas** (§7): comisiones×Cámara (THIN recuperable, derivada), comisiones×
  Senado (forward-only, estructural), sala×Cámara (solo vigente, estructural), sala×
  Senado (forward-only, estructural). Presentadas como lista `<ul>` sobria, cada
  `<li>` una celda; rangos y N en `font-mono`.
- **Regla rectora:** NINGUNA celda dice "cobertura completa". La intro LOCKED lo
  declara 1×. Tono neutro, sin color de alarma (§Color).
- **Leyenda "estado ausente ≠ vigente" (§4):** vive aquí (o en la sección de
  citaciones, 1× por página) — copy LOCKED.

### 4. Estados de citación honestos (CIT-05)

`citacion.estado` (verbatim de fuente: "Suspendida"/"Sin efecto", poblado en ~6-9%)
SIEMPRE visible cuando existe. Reutiliza el patrón `c.estado &&` ya en
`ResultadosBusqueda` (`page.tsx:248`), llevado a la `CitacionCard`:

- **Ubicación:** marca en el header de la card, junto a la fecha/horario mono, como
  `<span className="text-sm text-muted-foreground">· {estado}</span>` (idiom
  existente). Sobria, sin badge de alarma, sin `--destructive` (§Color).
- **Estado ausente:** NO se renderiza marca; la citación es normal. **PROHIBIDO
  añadir "Vigente"/"Confirmada"** — la ausencia de cancelación no es confirmación
  (regla LOCKED). La leyenda de estado (1×) lo declara explícitamente.
- **`CitacionCardProps` gana `estado?: string | null`** (opcional, backward-compatible);
  el server lo pasa desde `c.estado`.

### 5. Fixes de wiring de la ficha proyecto — `estado-actual-block.tsx` (CIT-04)

La data existe en DB; el defecto es de wiring del derivador (93 §6). Se arreglan SIN
re-ingesta. **Cuidar los tests existentes** de `estado-actual-block` (compartido con
88-89): las firmas actuales (`derivarEstadoActual` con args opcionales) deben seguir
compilando; los nuevos campos son opcionales (omit-when-not-derivable).

**Gap #1 — citaciones PASADAS visibles (mantener vigente/próxima como principal):**
- Hoy `citacionVigente` filtra `fecha >= hoyChile` → oculta las pasadas
  (`estado-actual-block.tsx:122-129`). La query (`:311-315`) YA trae TODAS las
  citaciones sin filtro — el sesgo vive solo en el derivador.
- **Cambio:** derivar DOS cosas de las mismas citaciones crudas:
  1. `citacionVigente` (existente, se mantiene) = la más próxima con `fecha >= hoy-Chile`
     → línea principal `Citado en {comisión} el {fecha}.`
  2. `citacionesPasadas` (nuevo, opcional) = las citaciones con `fecha < hoy-Chile`,
     orden DESC (más reciente primero), acotadas (máx ~5 visibles + "ver N más" o
     conteo). Cada una: `Citado el {fecha} en {comisión}` con marca sobria
     `(sesión pasada)` en `text-muted-foreground`.
- La marca "pasada" es contexto temporal NEUTRO, jamás alarma. NUNCA fabrica vigencia
  para una pasada. Si no hay pasadas → el sub-bloque se OMITE (omit-when-not-derivable).
- **Nuevo campo en `EstadoActual`:** `citacionesPasadas?: { comision: string; fecha:
  Date }[]` — el `derivarEstadoActual` lo computa; `EstadoActualView` lo renderiza si
  presente (línea propia bajo la citación vigente, dentro del mismo bloque
  estado-actual — es el mismo dominio de tramitación, no compone con otro carril).

**Gap #2 — "En tabla de sala" (la ficha lee `sesion_tabla_item`):**
- Hoy `EstadoActualBlock` NO consulta `sesion_tabla_item`; el interface no tiene campo
  de sala (93 §6). Solo `/agenda` lee esa tabla.
- **Cambio:** añadir una lectura server-side (batched en el `Promise.all` existente,
  `:293-315`) a `sesion_tabla_item` filtrada por `boletin`, embebiendo
  `sesion_sala(camara, fecha, semana_iso)` (todas tablas no-PII, public-read 0010).
- **Render:** línea `En tabla de sala de la {Cámara|Senado} del {fecha}` → **link
  petróleo** a `/agenda?semana={semana_iso}` (regla accent #2). Si el boletín aparece
  en varias sesiones de sala → conteo honesto `En tabla de sala {N} veces` con enlace
  a cada semana (o a la más reciente + "ver todas"). Si no aparece → se OMITE (nunca
  "no está en tabla" fabricado).
- **Nuevo campo:** `enTablaSala?: { camara: "camara"|"senado"; fecha: Date; semanaIso:
  string }[]` — omit-when-empty. La línea vive en el bloque estado-actual (mismo
  dominio tramitación).

**Cross-link comisión→membresía (CIT-04, barato o diferido):** donde una citación
muestra una comisión con página de membresía propia (datos de 90), enlazar de forma
factual SI es barato (comisión→/comision/{slug} o similar). Si el mapeo comisión→id de
membresía no es trivial en esta fase, **DIFERIR declarándolo** (no bloquea). Sin
enlace inventado.

### 6. Estados vacíos honestos (resumen)

| Superficie | Vacío | Renderizado |
|------------|-------|-------------|
| Día sin citaciones (semana cubierta) | 0 filas ese día | día no se pinta como acordeón; el banner cubre la honestidad de cobertura |
| Semana sin citaciones | 0 filas la semana | empty existente + link /buscar (se mantiene) |
| Filtro island sin resultados | 0 tras filtro | `Sin citaciones para este filtro` + `Ajusta o quita filtros…` (≠ empty de datos) |
| Estado citación ausente | `estado` null | NO marca; citación normal; NUNCA "Vigente" fabricado |
| Ficha — sin citaciones pasadas | 0 pasadas | sub-bloque omitido (omit-when-not-derivable) |
| Ficha — no en tabla de sala | 0 filas sala | línea omitida; nunca "no está en tabla" |
| Banner cobertura | siempre presente | derivadas dinámicas + estructurales fijas; nunca "completo" |

Regla rectora LOCKED: un vacío es un HECHO, no una virtud. "No ingerido" ≠ "ingerido,
cero". "Estado ausente" ≠ "vigencia confirmada". Nunca leer un día/semana/estado
vacío como "no hubo actividad" ni como exoneración.

### 7. Accesibilidad

Patrones ya en repo (post UI-REVIEW 89), reutilizar VERBATIM:

- **focus-visible:** chips de filtro, inputs date, trigger de acordeón de día, links
  de boletín/tabla-sala/navegación → `focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-accent-product` (chips) o
  `focus-visible:ring-2 focus-visible:ring-ring` (inputs/links). Nunca `outline-none`
  sin reemplazo.
- **Touch target:** `min-h-11` (44px) en todo chip de filtro, trigger de día,
  `<summary>` de materia, inputs date, links.
- **Acordeón de día:** `CarrilAccordion` ya expone `aria-expanded`/`data-state` y
  trigger con texto visible (día + conteo), no solo ícono ▾.
- **Filtros (chips):** `aria-pressed` en cada chip toggle; `aria-disabled="true"` +
  `disabled` cuando count=0; cada faceta en `<fieldset><legend>` (Cámara / Comisión /
  Rango de fechas / Boletín); leyenda de counts como `<p>` visible.
- **Inputs date:** `<label>` asociado (desde/hasta); `min`/`max` acotan sin ocultar.
- **Estado de citación:** la marca "Suspendida"/"Sin efecto" es texto visible (no solo
  color), legible por AT; la leyenda de estado es `<p>` visible.
- **Banner cobertura:** `<section>` con heading; celdas en `<ul>`; rangos mono con
  texto (no solo visual). Si es colapsable, la intro LOCKED queda fuera del disclosure.
- **Ficha (fixes):** líneas de citación pasada / tabla de sala son `<p>` visibles;
  links con texto de destino claro ("En tabla de sala del {fecha}", no "click aquí").
- **Tabla de sala:** `<table>` con `<caption class="sr-only">` y `<th scope>` (idiom
  `SalaTableSection`, se mantiene).

### Mobile 390px

- **Día-headers y cards:** listas verticales `space-y`, sin tablas horizontales para
  citaciones; el acordeón de día colapsa para acortar el scroll.
- **Filtros:** `flex flex-wrap gap-2` — chips de cámara/comisión hacen wrap a líneas
  nuevas, cada uno `min-h-11`; inputs date apilados; el fieldset de comisión (muchos
  chips) puede envolverse en `DetalleColapsable` si desborda.
- **Banner cobertura:** 4 celdas apiladas verticalmente; rangos mono no fuerzan
  scroll horizontal (wrap natural, contenedor `min-w-0`).
- **Tabla de sala:** `overflow-x-auto` (idiom existente) para la tabla estructurada;
  las citaciones NO usan tabla.
- **Ficha (fixes):** líneas de citación pasada / tabla de sala fluyen vertical; links
  táctiles `min-h-11`.
- Verificar por iframe same-origin / BrowserOS (patrón de gates v8.0/v8.1) — sujetos
  del gate: `/agenda?semana=2026-W26` (histórico, 53 citaciones pasadas), semana
  vigente, ficha `18193-06` (citación pasada visible), ficha `13665-07` (tabla de sala
  visible). Gate "comprensible" LOCKED: cold-read — ¿se entiende qué pasa esta semana,
  qué está cancelado, qué cobertura falta? Evidencia DOM (precedente CDP-timeout).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Ninguno nuevo (reutiliza `ui/card`, `ui/separator`, `ui/skeleton`, `CarrilAccordion`/Radix Accordion ya instalados) | not required |
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
