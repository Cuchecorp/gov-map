---
phase: 91
slug: personas-p2b-ficha-bio-partido-directo-cross-links-factuale
status: draft
shadcn_initialized: true
preset: none
created: 2026-07-22
---

# Phase 91 — UI Design Contract

> Ficha del parlamentario 360: header ampliado con bio oficial + PARTIDO DIRECTO
> (chip reutilizable "según fuente al [fecha]"), militancias históricas, bloques
> cross-links factuales anti-causales, y filtro por partido en /parlamentarios.
> Autonomous run — todo derivado del design system existente (Tailwind 4 + tokens
> cívicos hsl-horneados) y del 91-CONTEXT (decisiones LOCKED del operador). CERO
> preguntas al usuario.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (base preexistente, `components.json` en `app/`) — NO se inicializa ni se añaden bloques nuevos |
| Preset | not applicable (design system ya establecido en v5–v9; esta fase reutiliza) |
| Component library | Radix (`@radix-ui/react-accordion`, `@radix-ui/react-tooltip`) vía wrappers `app/components/ui/*` |
| Icon library | ninguna nueva — glifos unicode inline (▾, ↗, →, · —) como en el repo; NO añadir lucide en esta fase |
| Font | Geist Sans (texto) + Geist Mono (fechas/IDs/períodos — LOCKED en repo) |

**Tokens LOCKED (guard cero-hex muerde):** todo color vía `var(--...)` o utilidad
Tailwind registrada. `--accent-product` (petróleo, único acento 10%), `--camara-*`
/`--senado-*` (cívicos hsl-horneados en `civic-tokens.css`, uso `var()` directo SIN
envolver en `hsl()`), `--identity-warn-*`, `--provenance-*`. **PROHIBIDO hex crudo.**

**Contrato FichaRail (LOCKED):** todo island client (`"use client"`) filtra/deriva
EN MEMORIA sobre datos serializados por el server; JAMÁS importa `@/lib/supabase`
ni `.rpc`/`.from` (guard PII lockdown escanea `app/`). El filtro por partido de
/parlamentarios cae bajo este contrato.

---

## Spacing Scale

Escala Tailwind 4 existente (múltiplos de 4). Esta fase NO introduce spacing nuevo.

| Token | Value | Usage en esta fase |
|-------|-------|--------------------|
| gap-1 / gap-1.5 | 4–6px | Chips inline (nombre + subtexto fuente, gap dentro de un chip) |
| gap-2 | 8px | Fila de chips (cámara + partido) en `flex flex-wrap gap-2` |
| mt-1 / mt-2 | 4–8px | Cargo bajo el h1; subtexto "según fuente al [fecha]" bajo el chip |
| mt-4 | 16px | ProvenanceBadge; bloque de comisiones; trigger de acordeón |
| space-y-3 / space-y-4 | 12–16px | Listas de cross-links, militancias, filas de directorio |
| **mt-12** | **48px** | **Frontera anti-insinuación LOCKED entre carriles `<section>` hermanos — NUNCA se mueve ni colapsa.** Cada bloque cross-link nuevo es su propia `<section className="mt-12">`. |
| py-8 md:py-16 | 32–64px | Padding de página (heredado) |

Exceptions: `min-h-11` (44px) obligatorio en TODO control interactivo (chips de
filtro, triggers de acordeón, links de "ver todos") — touch target táctil, LOCKED
en el repo. No es spacing de layout sino de affordance.

---

## Typography

Roles del repo (Geist). Esta fase reutiliza; NO añade tamaños.

| Role | Size | Weight | Line Height | Uso en esta fase |
|------|------|--------|-------------|------------------|
| Display (h1) | text-3xl (30px) | font-semibold (600) | leading-tight (1.25) | Nombre del parlamentario (ya existe) |
| Heading (h2) | text-xl (20px) | font-semibold (600) | 1.3 | "Militancias históricas", "En la misma comisión", etc. (headers de carril) |
| Subhead (h3) | text-base (16px) | font-semibold (600) | 1.4 | Nombre de partido en fila de militancia; nombre de parlamentario en cross-link |
| Body | text-sm (14px) | font-normal (400) | ~1.5 | Cargo, leyendas anti-causal, subtextos |
| Mono | text-xs / text-sm | font-normal (400) | 1.4 | Fechas ("según fuente al 21/07/2026"), período, rangos desde/hasta militancia — **Geist Mono LOCKED para fechas/IDs** |

Regla LOCKED: fechas, períodos y rangos temporales SIEMPRE en `font-mono`. Etiquetas
y nombres en Sans.

---

## Color

Split 60/30/10 existente. Esta fase NO altera la paleta.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` / `var(--foreground)` | Superficie de ficha y directorio |
| Secondary (30%) | `var(--card)` / `var(--muted)` / `var(--border)` | Filas de directorio, tiles de cross-link, chip de partido (fondo neutro) |
| Accent (10%) | `hsl(var(--accent-product))` (petróleo) | ver reserved-for |
| Cívico (institucional, NO acento) | `var(--camara-muted-foreground)` / `var(--senado-muted-foreground)` | SOLO el `CamaraChip` (cámara/senado). NUNCA para partido. |
| Identity-warn | `--identity-warn-*` (ámbar) | NO aplica a partido (el dato de partido SÍ está confirmado por fuente oficial). Reservado a contrapartes no verificadas. |

**Accent (petróleo) reserved for — LISTA CERRADA en esta fase:**
1. Enlaces/conectores (link a ficha de otro parlamentario en cross-links; link "ver todos").
2. Estado `engaged` del chip de filtro por partido (`border-accent-product bg-accent-product-soft text-accent-product`, idiom de `buscar-filtros.tsx`).
3. Trigger del acordeón de militancias históricas (`text-accent-product`, idiom `DetalleColapsable`).
4. `focus-visible` outline (`outline-2 outline-offset-2 outline-accent-product`).

**PROHIBIDO — el chip de partido NO lleva color de partido.** No existe paleta
partidista (evita señalizar bloque/afinidad por color; principio anti-insinuación).
El chip de partido usa fondo neutro `bg-muted` + `border-border` + texto
`text-foreground`, IDÉNTICO para todos los partidos. El color NUNCA codifica
identidad política.

Destructive: no aplica — esta fase no tiene acciones destructivas (solo lectura pública).

---

## Copywriting Contract

Voz sobria, factual, anti-causal. Prohibidos en TODA superficie nueva (linter
`anti-insinuacion-guard.test.ts` extendido + mutation self-check): "aliado",
"cercano a", "bloque de", "afín", "vinculado a", ranking/score/índice de relación,
"coordina con", "alineado".

| Element | Copy |
|---------|------|
| Chip de partido (con dato) | `{Partido}` + subtexto mono `según {fuente} al {fecha}` (p.ej. "según registro de militancia al 21/07/2026"). El chip NUNCA dice "actual" sin la fecha de fuente. |
| Chip de partido (sin dato) | El chip se OMITE por completo (no se renderiza "Sin partido" ni placeholder). El dato ausente es honesto por ausencia, espejo de `CamaraChip` desconocida. |
| Rótulo partido≠comité (Senado) | Cuando aplique comité: leyenda `El comité parlamentario es una agrupación de trabajo legislativo, distinta de la militancia partidaria.` |
| Militancias — heading | "Militancias registradas" (h2) |
| Militancias — leyenda | `Afiliaciones partidarias según registro oficial, con la fecha de cada tramo. La militancia vigente aparece primero.` |
| Militancia vigente — marca | Etiqueta textual sobria `Vigente` (NO color/badge de alarma); tramos históricos con rango mono `{desde} – {hasta}`. |
| Cross-link "misma comisión" — heading | "En la misma comisión" (h2) |
| Cross-link "mismo partido" — heading | "Del mismo partido" (h2) |
| Cross-link "misma región/distrito" — heading | "De la misma zona" (h2) — usa distrito (Cámara) o circunscripción/región (Senado) |
| Cross-link co-autoría — heading | "Han co-firmado proyectos" (h2) |
| Cross-link — leyenda anti-causal (por bloque, LOCKED) | `Relación DECLARADA por una fuente oficial (militancia, comisión o autoría de proyecto). No implica afinidad, coordinación ni causalidad.` |
| Cross-link — conteo honesto | `{N} parlamentarios comparten {la Comisión de Hacienda / el Partido X / la Circunscripción Y}.` (conteo neutro, nunca ranking) |
| Cross-link — "ver todos" (>límite) | `Ver los {N}` → navega a directorio pre-filtrado (no expande una lista infinita en la ficha) |
| Filtro por partido — control | Label `Partido` (fieldset/legend, espejo de facetas `buscar-filtros`) |
| Filtro — leyenda counts honestos | `Conteos sobre estos {N} parlamentarios cargados, no sobre todo el Congreso.` |
| Filtro — chip por partido | `{Partido} · {count}` (count de "estos N") |
| Empty — sin comisiones | `Sin comisiones registradas para este parlamentario en la fuente.` (NO "no participa en comisiones") |
| Empty — sin militancia histórica | `Sólo se registra la militancia vigente; no hay tramos anteriores en la fuente.` |
| Empty — sin cross-links de un bloque | El bloque entero se OMITE (0 → no se pinta una `<section>` vacía) |
| Empty — filtro partido sin resultados | Heading `Sin parlamentarios para este partido` + body `Ajusta o quita filtros para ver más.` (espejo directorio existente) |
| Error state (RPC falla) | Se LANZA (banner de error honesto, `#34`) — NUNCA se degrada a "sin datos". Espejo de `parlamentario_publico falló para {id}`. |
| Profesión (bio 0 filas) | NO se renderiza etiqueta ni "sin profesión" — null honesto, se omite el campo entero. |

Destructive confirmation: no aplica (sin acciones destructivas).

---

## Component Contract (phase-specific)

### 1. Header ampliado (`ParlamentarioHeader`)

Se REVIERTE la omisión LEGAL-03 del chip de partido (decisión operador 2026-07-21).
El header consume una fila ampliada (RPC nuevo/ampliado de 0060 que emite
`partido`, `partido_fecha_captura`, `partido_origen`).

Jerarquía y orden vertical (mobile-first, todo en `flex flex-wrap` donde hay chips):

```
Breadcrumbs                              (nav, primer elemento — ya existe)
[CamaraChip]  [PartidoChip]              (flex flex-wrap gap-2 — cámara PRIMERO, partido DESPUÉS)
h1  Nombre                               (text-3xl, ya existe)
p   Cargo: Distrito/Circunscripción · Región · Período{mono}   (text-sm muted, ya existe)
── (mt-4) Comisiones                     (bloque nuevo: lista compacta, tipo + cargo si existe)
── (mt-4) ProvenanceBadge                (ya existe)
```

- **PartidoChip** va en la MISMA fila `flex flex-wrap gap-2` que CamaraChip. En
  móvil 390px, si no cabe, hace wrap a la línea siguiente (flex-wrap ya lo maneja).
  El subtexto "según fuente al [fecha]" NO va inline en la fila de chips (rompería
  el wrap): va como `<p className="mt-1 text-xs font-mono text-muted-foreground">`
  bajo la fila de chips, o dentro del tooltip del chip (ver componente 2).
- **Comisiones** = bloque propio bajo el cargo, ANTES del ProvenanceBadge. Lista
  compacta `<ul>`: cada `<li>` = `{nombre comisión}` + `{tipo}` (permanente/especial)
  + `{cargo}` si la fuente lo trae (presidente/integrante). Formato:
  `Comisión de Hacienda · permanente · integrante`. Máximo visible antes de
  colapsar: 5 comisiones; si >5, envolver el excedente en `DetalleColapsable`
  ("Ver las N comisiones"). Vacío → leyenda empty honesta (§Copywriting).
- **Profesión**: SOLO si `parlamentario_bio` la trae (hoy 0 filas → se omite el
  campo, nunca "sin profesión").
- El header sigue SIN foto (LOCKED — nunca silueta placeholder).

### 2. PartidoChip (componente reutilizable NUEVO)

Un solo componente usado en: header de ficha, filas de directorio (opcional, ver
componente 5), y superficies de cruces. Mismo contrato que `CamaraChip`.

- **Con dato:** `<Badge variant="outline">` con `bg-muted border-border text-foreground`
  (NEUTRO — jamás color partidista). Contenido: `{partido}`. El "según {origen} al
  {fecha}" vive en un **Tooltip** (Radix, idiom `ProvenanceBadge`) para no saturar
  la fila de chips; el `fecha` en `font-mono` (`fechaCorta`). Alternativa aceptable:
  subtexto `<p>` bajo la fila (ver header). Elegir tooltip en fila de chips densa.
- **Sin dato (partido null/vacío):** retorna `null` (se OMITE). Espejo EXACTO de
  `CamaraChip` desconocida — el dato ausente no se comunica como defecto.
- **Militancia vigente vs histórica:** el chip del header muestra SOLO la vigente
  (`es_actual = true`). Las históricas viven en el acordeón (componente 3), NUNCA
  como chips múltiples en el header (evita sugerir "trayectoria" editorializada).
- Accesibilidad: el Tooltip expone el texto de fuente+fecha a lectores; el chip
  tiene `aria-label` "Partido: {partido}, según {origen} al {fecha}".

### 3. Militancias históricas (acordeón)

Reutiliza `DetalleColapsable` (Radix Accordion, patrón F45/UXCOG 55-01) — NO se
crea un acordeón nuevo. Consistencia con los carriles de la ficha.

- Es su propia `<section className="mt-12">` (carril hermano — frontera anti-insinuación).
- Capa-1 FUERA del disclosure: h2 "Militancias registradas" + leyenda + la
  militancia **vigente** (partido + rango `desde – vigente` en mono + etiqueta
  sobria "Vigente").
- Detalle DENTRO del `DetalleColapsable` (cerrado por defecto): `<ul>` de tramos
  históricos, orden cronológico DESC, cada `<li>`: `{partido}` (h3/base-semibold)
  + rango mono `{desde} – {hasta}`. Trigger "Ver militancias anteriores (N)".
- Si SOLO hay vigente (sin históricos): NO se renderiza el trigger del acordeón;
  se muestra la leyenda empty honesta.
- Rótulo partido≠comité: si la fila es del Senado y el dato incluye comité,
  renderizar la leyenda de distinción (§Copywriting) UNA vez en la sección.

### 4. Bloques cross-links factuales

Cada bloque = su propia `<section className="mt-12">` (carril hermano). Un
parlamentario de un bloque y un dato de otro dominio JAMÁS comparten un
`<article>/<Card>/<li>`. Orden alfabético o por cámara — **NUNCA ranking por afinidad**.

Estructura por bloque (idéntica en los 4):
```
<section className="mt-12">
  <h2>  {heading del bloque}
  <p>   {leyenda anti-causal LOCKED}        ← obligatoria, 1× por bloque
  <p>   {conteo honesto: "N parlamentarios comparten X"}
  <ul>  filas (máx LÍMITE VISUAL)
    <li> [CamaraChip] <Link>Nombre</Link> [PartidoChip opcional]   ← link petróleo a /parlamentario/{id}
  <a>   "Ver los N"  (solo si N > límite)   ← navega a directorio pre-filtrado
</section>
```

- **Bloques:** (a) misma comisión, (b) mismo partido, (c) misma región/distrito,
  (d) co-autoría (reusa dato F48 `proyecto_autor`/cruces existente).
- **Límite visual:** mostrar máx **8** parlamentarios por bloque en la ficha; si
  N>8, mostrar 8 + link "Ver los N" → `/parlamentarios?partido=X` (o
  `?comision=`/`?region=` según el eje), NO expandir en la ficha. RPCs bounded con
  LIMIT (LOCKED en canal de datos).
- **Auto-exclusión:** el propio parlamentario nunca aparece en sus propios bloques.
- **Bloque vacío (N=0):** la `<section>` entera se OMITE (no se pinta vacía).
- Cada fila enlaza a la ficha por `id` (D####/S####), link petróleo (regla color #1).
- El PartidoChip por fila es OPCIONAL (útil en "misma comisión"/"misma región"
  donde el partido añade contexto; redundante en "mismo partido" → omitir ahí).

### 5. Filtro por partido en `/parlamentarios` (island client)

Cae bajo contrato FichaRail: island `"use client"` que filtra EN MEMORIA el slice
ya obtenido por el server (la RPC de listado se amplía en 0060 para emitir
`partido`). Espejo del patrón `buscar-filtros.tsx` (facetas + counts honestos).

- **Control:** faceta `Partido` (chips toggleables, patrón `FacetChip`), NO un
  `<select>` — coherente con las demás facetas island. Cada chip:
  `{Partido} · {count}`. `engaged` → petróleo (`accent-product`). count=0 →
  `disabled` (`opacity-40`). Orden por frecuencia DESC, luego alfabético.
- **Convivencia con el filtro SSR existente:** el directorio HOY usa un form GET
  SSR (cámara + nombre). Decisión: el filtro por partido es una faceta CLIENT
  ADICIONAL sobre las filas ya renderizadas por el server (que ya aplicó cámara/q).
  El island recibe el slice serializado y filtra por partido sin re-query. Los
  filtros SSR (cámara/nombre) y el filtro client (partido) son ortogonales y
  componibles (server filtra grueso, client afina por partido).
- **Counts honestos "de estos N":** sobre el slice cargado (`Conteos sobre estos N
  parlamentarios cargados, no sobre todo el Congreso.`).
- **Sin partido:** las filas con `partido` null se agrupan bajo chip `Sin dato ·
  {count}` (nunca se ocultan; espejo de `ANIO_SIN_DATO` en buscar-filtros).
- **Empty tras filtro:** heading/body honestos (§Copywriting), distinto del banner
  de error (que se lanza).
- **/buscar (alcance mínimo):** SOLO chip de partido en autores mostrados SI el
  dato ya viaja server-side; NO se crea pipeline nuevo (deferred). Sin filtro por
  partido en /buscar en esta fase.

### 6. Estados vacíos honestos (resumen)

| Bloque | Vacío (N=0 / null) | Renderizado |
|--------|--------------------|-------------|
| PartidoChip | partido null | se OMITE (null), sin placeholder |
| Comisiones | 0 comisiones | leyenda "Sin comisiones registradas…" |
| Militancias históricas | solo vigente | leyenda "Sólo se registra la militancia vigente…" (sin acordeón) |
| Cross-link (cualquiera) | 0 pares | `<section>` OMITIDA por completo |
| Filtro partido | 0 tras filtro | empty-state honesto (≠ error) |
| Profesión | bio 0 filas | campo OMITIDO (null honesto) |

Regla rectora (LOCKED): un vacío es un HECHO, no una virtud. "No ingerido" ≠
"ingerido, cero". Nunca leer un vacío como limpieza o ausencia de actividad.

### 7. Accesibilidad

Patrones ya en repo (post UI-REVIEW 89), reutilizar VERBATIM:

- **focus-visible:** todo control `focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-accent-product` (chips de filtro) o `focus-visible:ring-2
  focus-visible:ring-ring` (links de directorio). Nunca `outline-none` sin reemplazo.
- **Touch target:** `min-h-11` (44px) en todo chip de filtro, trigger de acordeón y
  link "ver todos".
- **Acordeón (militancias/comisiones):** Radix Accordion ya expone
  `aria-expanded`/`aria-controls`/estado `data-state`; el trigger tiene texto visible
  ("Ver militancias anteriores (N)"), no solo un ícono.
- **Filtro (chips):** `aria-pressed` en cada chip toggle; `aria-disabled="true"` +
  `disabled` cuando count=0; el grupo en `<fieldset><legend>Partido</legend>` (espejo
  buscar-filtros). Leyenda de counts como `<p>` visible, no solo tooltip.
- **PartidoChip:** `aria-label` con partido+fuente+fecha; el Tooltip Radix expone el
  contenido a AT.
- **Cross-links:** cada `<section>` con `<h2>`; links con texto de destino claro
  ("Nombre" enlaza a su ficha, no "click aquí"); la leyenda anti-causal es `<p>`
  visible (parte del contenido accesible, no decorativa).
- **Contraste:** tokens cívicos/petróleo ya verificados (v8.1/89); el chip de
  partido usa `text-foreground` sobre `bg-muted` (contraste base del sistema).

### Mobile 390px

- Fila de chips (cámara + partido) hace wrap vía `flex flex-wrap gap-2`.
- Comisiones y cross-links: listas verticales `space-y`, sin tablas horizontales.
- Chips de filtro por partido: `flex flex-wrap gap-2`, cada uno `min-h-11`.
- Verificar por iframe same-origin (patrón de gates previos v8.0/v8.1).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Ninguno nuevo (reutiliza `ui/badge`, `ui/tooltip`, `ui/skeleton`, Radix Accordion ya instalados) | not required |
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
