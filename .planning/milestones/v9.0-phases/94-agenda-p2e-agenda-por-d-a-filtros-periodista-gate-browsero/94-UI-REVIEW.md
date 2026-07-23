# Phase 94 — UI Review

**Audited:** 2026-07-22
**Baseline:** 94-UI-SPEC.md (approved design contract)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Todas las leyendas LOCKED verbatim; NEGACIONES_LOCKED registrado antes del scan (lección BLOCKER 91 respetada); honestidad "ausente ≠ vigente" codificada |
| 2. Visuals | 3/4 | Jerarquía sólida (h1→h2→h3/h4), skeletons por sección, estados vacíos distinguidos; el link de tabla-sala usa texto genérico "ver en la agenda" en vez del destino LOCKED |
| 3. Color | 3/4 | Componentes NUEVOS impecables (accent-product vía utilidad, cero hex, cancelación en muted sin alarma); pero el link de boletín y nav semanal usan `text-primary` (azul) donde el contrato reserva `accent-product` (petróleo) |
| 4. Typography | 4/4 | Geist Mono en todas las fechas/rangos/conteos/boletines; Sans en materia/comisión; sin tamaños nuevos |
| 5. Spacing | 4/4 | Escala Tailwind heredada respetada (mt-4/6/8/12, space-y-4/6, gap-2); banda banner `bg-muted/40 px-6 py-4` verbatim |
| 6. Experience Design | 3/4 | Filtros island completos, counts honestos, error≠vacío, tz correcta; pero `min-h-11` y focus-visible FALTAN en los links de tabla-sala nuevos (ficha) y de boletín (card) |

**Overall: 21/24**

---

## Nota rectora sobre la divergencia tz (spec vs. implementación)

El UI-SPEC declara como "BUG A CORREGIR (núcleo)" convertir la agrupación por día a
`timeZone: "America/Santiago"`. **La implementación hizo lo OPUESTO** y es CORRECTA:
descubrió en vivo (commits `ec77469`/`5de3230`, "regresión live Phase 94") que
`citacion.fecha`/`sesion_sala.fecha` son date-only a **medianoche UTC** (verificado
278/278 en PROD, `@/lib/dia-calendario`), no timestamps reales con hora. Convertir esa
medianoche a Chile FABRICA el día anterior (`2026-07-20T00:00Z` → "19-jul"). El código
codifica el contrato `date-only-midnight-UTC` (`diaCalendarioCitacion`) y lo documenta
exhaustivamente. **Esto NO es un incumplimiento**: es la corrección honesta de una
premisa errónea del spec, con la meta LOCKED ("una citación de las 21:00 no cae al día
siguiente") satisfecha por otra vía. Se acepta como PASS. La regla de honestidad no se
degrada.

---

## Top 3 Priority Fixes

1. **Links interactivos sin `min-h-11` ni focus-visible (WARNING → a11y contract §7)** —
   Los links de tabla de sala nuevos de la ficha (`estado-actual-block.tsx:476,490`) y el
   link de boletín + `<summary>` "ver más" de la card (`citacion-card.tsx:101,129`) no
   tienen el touch-target de 44px ni el `focus-visible` que el UI-SPEC §7 exige VERBATIM
   para "links de boletín/tabla-sala/navegación". Impacto: target táctil sub-mínimo en
   390px y foco de teclado invisible en superficies nuevas. **Fix:** envolver el link en
   `inline-flex min-h-11 items-center` + `focus-visible:ring-2 focus-visible:ring-ring`
   (idiom ya usado en el empty-state de `CitacionesSection`, `page.tsx:415`).

2. **Accent contract: boletín/nav en `text-primary` (azul) en vez de `accent-product`
   (petróleo) (WARNING → Color §Accent lista cerrada)** — El UI-SPEC reserva el petróleo
   para "link de boletín" (#1) y "navegación semanal / volver" (#3). La `CitacionCard`
   (`:131`) y el link "← Volver a la vista semanal" (`page.tsx:121`) usan `text-primary`,
   que en `globals.css:16` es azul (`221 83% 53%`), NO el petróleo `--accent-product`
   (`:24`). Los componentes NUEVOS de la fase (agenda-filtros, estado-actual gap fixes,
   empty-state) sí usan `accent-product` correctamente — la inconsistencia es que el
   boletín-link heredado no se migró. Impacto: dos acentos compitiendo (azul + petróleo)
   rompe el 60/30/10. **Fix:** cambiar `text-primary` → `text-accent-product` en el link de
   boletín de la card y en el link "Volver".

3. **Link de tabla-sala usa texto genérico "ver en la agenda" en vez del destino LOCKED
   (WARNING → Copy §Contract + a11y §7 "texto de destino claro")** — El SPEC (Copywriting)
   fija `En tabla de sala de la {Cámara|Senado} del {fecha}` COMO el link a
   `/agenda?semana=`. La implementación (`estado-actual-block.tsx:476-482`) pone esa frase
   como texto plano y enlaza solo las palabras "ver en la agenda" — que §7 desaconseja
   explícitamente ("texto de destino claro, no 'click aquí'"). Impacto: menor, pero el
   ancla no describe el destino. **Fix:** enlazar la frase completa (o añadir un
   `aria-label` con el destino), como hace el link de boletín (`aria-label="Ver proyecto
   Boletín N°{N}"`).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Intro del banner, leyenda de estado, las 4 celdas de cobertura y los empties de filtro
  aparecen VERBATIM del SPEC (`agenda-cobertura.tsx:49-85`, `agenda-filtros.tsx:40-43`).
- **Honestidad LOCKED cumplida:** `citacion-card.tsx:82-84` renderiza `estado` solo si
  existe; NUNCA fabrica "Vigente"/"Confirmada". `estado-actual-block.tsx` omite cada línea
  no derivable (omit-when-not-derivable) — pasadas y tabla-sala se omiten si 0.
- **BLOCKER-91 evitado:** `anti-insinuacion-guard.test.ts:263-265` añade
  `agenda-cobertura.tsx` y `citacion-card.tsx` al glob del scan, y las frases que niegan
  "confirma"/"calendario completo" están en `NEGACIONES_LOCKED` (verificado 94-01/94-02).
  26 tests del guard verdes.
- Counts "de estas N" honestos: `leyendaCounts` sobre `slice.length` (slice completo, no el
  filtrado) — `agenda-filtros.tsx:40,241`.

### Pillar 2: Visuals (3/4)
- Focal point claro: h1 → banner de cobertura (contexto) → WeekNav → secciones. Jerarquía
  h1(3xl)→h2(xl)→h3(base, día)→h4 intacta.
- Skeletons dedicados por Suspense (`CoberturaSkeleton`, `CitacionesSkeleton`,
  `SalaTableSkeleton`) con `aria-hidden`.
- Estados vacíos DISTINGUIDOS: empty de datos (`No hay citaciones… esta semana`) ≠ empty de
  filtro (`Sin citaciones para este filtro` + `Ajusta o quita…`) — `agenda-filtros.tsx:42-43`.
- **Deducción:** el link de tabla-sala genérico "ver en la agenda" (finding #3) resta
  claridad de destino; el resto de la superficie es limpio.

### Pillar 3: Color (3/4)
- Componentes NUEVOS impecables: `agenda-filtros.tsx` FacetChip engaged usa
  `border-accent-product bg-accent-product-soft text-accent-product` (idiom FacetChip
  verbatim); cero hex (grep limpio); focus-visible con `outline-accent-product`.
- Cancelación SOBRIA: `citacion-card.tsx:83` = `text-muted-foreground`, sin `--destructive`,
  sin rojo/ámbar. Banner en `bg-muted/40`, cero color de alarma (grep en agenda-cobertura
  solo halla la palabra "PROHIBIDO --destructive" en el JSDoc). "(sesión pasada)" en muted.
- **Deducción (finding #2):** `text-primary` (azul, `globals.css:16`) en el link de boletín
  de la card y en "Volver" contradice la lista CERRADA de accent del SPEC, que exige
  petróleo (`--accent-product`). Dos acentos conviven → 60/30/10 diluido.
- Nota: la rama de búsqueda (`CamaraFiltro`, `ResultadosBusqueda`) usa `bg-primary` y
  `min-h-9` — es código heredado de Phase 06 fuera del scope de agrupación-por-día de esta
  fase; se señala como deuda pero no se puntúa como fallo NUEVO.

### Pillar 4: Typography (4/4)
- Mono LOCKED en todo lo numérico/temporal: `agenda-cobertura.tsx:59-62` (N, semanas,
  rango); `carril-accordion.tsx:55` (conteo del día); `citacion-card.tsx:75` (fecha·horario);
  `estado-actual-block.tsx` (fechaCorta siempre en `font-mono`). Inputs date en
  `agenda-filtros.tsx:293,304` con `font-mono`.
- Sans en materia/comisión/nombres/legendas. Sin tamaños nuevos: text-3xl/xl/base/sm/xs
  heredados.

### Pillar 5: Spacing (4/4)
- Banda del banner `rounded-lg border border-border bg-muted/40 px-6 py-4` VERBATIM del SPEC
  (`agenda-cobertura.tsx:44`), ubicada bajo h1 y antes del WeekNav (`page.tsx:131-137`).
- Escala respetada: secciones `mt-8`/`mt-12` (`page.tsx:139,146`); island `space-y-6`,
  fieldsets `space-y-4`, chips `flex flex-wrap gap-2` (390px wrap natural).
- Inputs date apilados (`flex flex-wrap gap-4`), `min-w-0` implícito por el flujo vertical.

### Pillar 6: Experience Design (3/4)
- **tz correcta** (ver Nota rectora): dayKey por día publicado, cero corrimiento.
- Error ≠ vacío en TODAS las lecturas (`#34`): `CitacionesSection:399`, `derivarMetricaCamara`,
  `SalaTableServer`, `EstadoActualBlock` lanzan ante fallo real de DB; la ausencia de filas
  es omisión honesta. Senado forward-only distingue "fuera de ventana" de "sin sesión"
  (`page.tsx:564-582`).
- Filtros island: 4 facetas componibles, facetas count=0 `disabled`+`aria-disabled`+
  `opacity-40`, bucket "Sin dato" visible, reset "Esta semana". `aria-pressed` en chips,
  `<fieldset><legend>` por faceta, inputs date con `<label>` y `min`/`max` acotados. Contrato
  FichaRail respetado: island NO importa `@/lib/supabase` (verificado — solo props).
- **Deducción (finding #1):** los links nuevos de tabla-sala (ficha) y el link de boletín /
  `<summary>` de la card carecen de `min-h-11` y focus-visible que §7 exige — brecha táctil
  y de foco de teclado en móvil 390px.

---

## Evidencia de build real
- Suite phase-94 EJECUTADA y verde: `agenda-cobertura` (6), `agenda-filtros` (16),
  `citacion-card` (16), `estado-actual-block` (51), `anti-insinuacion-guard` (26) =
  **115/115 passed**. La UI está construida y testeada, no es andamiaje.

## Gate BrowserOS (pendiente — no bloqueante de este audit)
El SPEC §Mobile 390px pide verificación por iframe same-origin / BrowserOS con sujetos
`/agenda?semana=2026-W26`, semana vigente, ficha `18193-06`, ficha `13665-07`. No hay dev
server activo → gate visual DIFERIDO al operador. Los findings #1–#3 deben resolverse antes
de ese gate (touch-target y accent afectan el cold-read móvil).

## Files Audited
- `app/app/agenda/page.tsx`
- `app/components/agenda-filtros.tsx`
- `app/components/agenda-cobertura.tsx`
- `app/components/citacion-card.tsx`
- `app/components/estado-actual-block.tsx`
- `app/lib/dia-calendario.ts` (contrato tz)
- `app/components/camara-chip.tsx`, `app/components/carril-accordion.tsx` (idioms reutilizados)
- `app/app/globals.css` (tokens --primary vs --accent-product)
- `app/lib/anti-insinuacion-guard.test.ts` (NEGACIONES_LOCKED)
