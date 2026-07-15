# Milestone v8.0 — Rediseño Bento (frontend compatible con "Home Bento")

**Preparado:** 2026-07-15
**Referencia de diseño:** `C:\Users\Carlo\Downloads\Rediseño página estilo bento\Home Bento.dc.html` (mockup DesignCanvas, preview 1200px)
**Estado:** SCAFFOLDING LISTO 2026-07-15 — fases 76-81 en ROADMAP.md, reqs BENTO-01..07 en REQUIREMENTS.md §v8, mockup copiado a `.planning/design/bento/home-bento.dc.html`, prompt de corrida en `PROMPT-v8.0-build-autonomo.md`. **D1-D4 RESUELTAS por delegación del operador** ("corra entero de modo autónomo"): D1 = copy LOCKED se conserva (+kicker mono), D2 = diamante, D3 = propagación acotada, D4 = token nuevo `--radius-tile`. Arranque: `/clear` + `/gsd-autonomous --from 76 --to 81`. (v7.0 queda code-complete con gates de operador abiertos — ortogonal.)
**Alcance de una frase:** llevar la home (y por coherencia, el chrome de todo el sitio) al estilo bento del mockup — grid de tiles con spans variados, radio 16px, contenedor 1120px, header sticky — sin romper copy LOCKED, gates fail-closed, linter anti-insinuación, ni la geometría del island `/red`.

---

## 0. Hallazgo rector (baja el riesgo del milestone completo)

**El mockup está dibujado SOBRE la paleta actual del sitio.** Verificado por conversión HSL:

| Mockup (hex) | Token actual | Equivalencia |
|---|---|---|
| `#F9F6F0` fondo | `--background: 40 33% 97%` | ≈ idéntico (crema) |
| `#FDFBF7` tiles | `--card: 40 30% 99%` | ≈ idéntico |
| `#E3DDD3` bordes | `--border: 40 16% 86%` | ≈ idéntico |
| `#0F1729` texto | `--foreground: 222 47% 11%` | ≈ idéntico |
| `#2A5859` acento | `--accent-product: 183 38% 26%` (petróleo) | idéntico (el mockup usa el hex del BrandIcon actual) |
| `#2D6299` Cámara | `--camara: 213 94% 38%` | misma familia de hue (211 vs 213) |
| `#A0343E` Senado | `--senado: 355 65% 38%` | mismo hue (355) |
| `#5C6373` secundario | `--muted-foreground: 222 14% 42%` | ≈ idéntico |
| Geist / Geist Mono | ya cargadas vía `next/font` en `app/app/layout.tsx` | idéntico |

**Consecuencia:** v8 NO es una migración de tokens de color ni de tipografía. Es (a) layout bento en home, (b) nuevas primitivas de tile (radio 16px, spans), (c) contenedor y header, (d) restyle de módulos existentes dentro de tiles, (e) propagación de coherencia. Los colores del mockup se implementan **referenciando los tokens existentes, nunca hex hardcodeado** (regla: cero hex nuevos en componentes; el linter de fase 80 lo verifica).

**Deltas reales mockup ↔ sitio actual:**

| Dimensión | Hoy | Mockup |
|---|---|---|
| Layout home | Lineal centrado `max-w-3xl` | Grid bento 6 columnas, `max-w-[1120px]`, gap 14px, spans 4/2/2/2/2/4/2/6 |
| Radio de tarjeta | `--radius: 0.5rem` (8px, shadcn) | 16px tiles, 11px inputs/botones, 999px pills |
| Header | Persistente, `px-4 md:px-8` full-width | **Sticky** (`position:sticky; top:0; z-5`), contenedor 1120px |
| ActualidadModule | 3 paneles apilados bajo el hero | Tiles del grid: "Votado" span-4, "Urgencias" span-2, "Frescura" strip span-6 |
| Hero | h1 LOCKED + cursiva LOCKED + SearchBox + trust line | Kicker mono uppercase + h1 distinto + SearchBox inline + pills |
| Tile "¿Cómo leer esto?" | Link de texto bajo el hero | Tile acento teal invertido span-2 con BrandIcon + CTA "Ver metodología →" |
| Tarjetas de entrada | 3 columnas uniformes | 3 tiles span-2 con marcador (diamante o número `01`) + flecha → |
| Votado esta semana | Panel con lista | Tile con barra de color por cámara (3px), tally en mono, "Fuente ↗" por ítem |
| Urgencias | Panel con lista | Tile con chip pill (`suma`/`simple`) fondo `#E3F0EF`-equivalente + "desde {fecha}" en mono |
| Frescura | Panel | Strip horizontal span-6: dot teal + fuente + fecha mono, wrap |
| Footer | `bg-muted/40`, `max-w-3xl` | Sin fondo, border-top, contenedor 1120px, mismo contenido CC BY |

---

## 1. Invariantes (NO se negocian; cada fase los verifica)

1. **Copy LOCKED se conserva salvo decisión explícita del operador** (gate de decisión D1, abajo): h1 actual "Qué pasó con cada proyecto de ley y cada parlamentario.", cursiva "Con la fuente a la vista.", trust line "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad.", las 4 pills LOCKED. El mockup trae copy distinto — es placeholder de diseño, NO manda sobre copy firmado.
2. **Anti-insinuación:** el linter (`app/lib/anti-insinuacion-guard.test.ts`, 201 términos, 13 superficies) sigue verde. Todo copy NUEVO que roce votos/dinero pasa por él. OJO: el texto del tile "¿Cómo leer esto?" del mockup ("Las correlaciones no son indicativas de irregularidades…") debe redactarse con cuidado o adoptar la fórmula LOCKED existente de `/sobre`.
3. **Gates fail-closed intactos:** `NET_PUBLIC_ENABLED`, `MONEY_PUBLIC_ENABLED`, `CRUCES_PUBLIC_ENABLED`, `PUBLIC_INDEXABLE` — el rediseño no añade ninguna superficie que los eluda. "Red" en nav sigue condicionada.
4. **Island `/red` pixel-intocable:** fase 75 dejó `.net-*` con swap tipográfico pixel-idéntico y gate visual pendiente. v8 NO toca `.net-*` (incl. `.net-chip` 11px DEBT-05). Si el contenedor global cambia el ancho disponible de `/red`, eso es un cambio CONSCIENTE con verificación visual propia (fase 79).
5. **Empty states honestos:** "Votado esta semana" depende del backfill de votos (gates operador v7 fases 66/67). El tile renderiza vacío-honesto ("Sin votaciones registradas esta semana") — nunca datos de ejemplo del mockup.
6. **Server-only intacto:** los datos siguen viniendo de RPCs server-side; ninguna llamada nueva desde el cliente. `force-dynamic` en home se conserva (frescura por request).
7. **Accesibilidad:** touch targets `min-h-11` (44px) se conservan (el mockup usa 38px en pills — se sube a 44px), focus visible en todos los tiles-link, contraste WCAG AA en el tile teal invertido (texto `rgba(234,242,241,.85)` sobre `#2A5859` — verificar ratio ≥4.5:1 para body).
8. **Dark theme no regresa:** el mockup es light-only; cada primitiva nueva define su par dark derivado de los tokens dark existentes (o el tile degrada con gracia). Verificación explícita en fase 80.

---

## 2. Gates de decisión del operador (resolver ANTES o DURANTE discuss de cada fase)

- **D1 — Copy del hero (fase 77):** ¿conservar h1+cursiva LOCKED con el layout nuevo (recomendado: el copy está firmado y el kicker mono "OBSERVATORIO DEL CONGRESO" convive bien), o adoptar el h1 del mockup ("Busca cualquier proyecto de ley…")? Cambiar copy LOCKED requiere decisión explícita registrada.
- **D2 — Marcador de tarjetas de entrada (fase 77):** diamante (default del mockup) vs número mono `01/02/03`. Trivial, pero es prop de diseño del mockup — elegir una y fijarla.
- **D3 — Alcance de propagación (fase 79):** ¿bento solo en home + chrome global (header/footer/contenedor), o también restyle de tiles interiores (buscar/parlamentarios/agenda)? Recomendado: chrome global + radio/contenedor en todas las rutas, SIN re-layoutear las páginas interiores (eso sería v9).
- **D4 — Radio global vs radio local (fase 76):** ¿subir `--radius` global a algo que produzca 16px en tarjetas (afecta TODOS los shadcn: botones, inputs, badges en todas las rutas), o introducir token nuevo `--radius-tile: 16px` solo para tiles bento? Recomendado: token nuevo `--radius-tile` — cambio quirúrgico, cero regresión en rutas interiores.

---

## 3. Fases

### Fase 76 — BENTO-BASE: primitivas y chrome global
**Goal:** existir las piezas con las que se arma cualquier bento, y el chrome (header/footer/contenedor) del mockup, sin cambiar aún la home.
**Trabajo:**
- Token `--radius-tile` (16px) + `--radius-control` (11px) en `globals.css` (per D4); documentar en el comentario del token que el hex de referencia del mockup mapea a tokens existentes.
- Componente `BentoGrid` (grid 6 col, gap 14px, `grid-auto-rows:minmax(0,auto)`) + `BentoTile` (variants: `default` = card+border+radius-tile; `accent` = teal invertido; spans por prop `span={2|4|6}`) con colapso responsive (≤`md`: todo span completo, orden DOM = orden visual).
- Header sticky: `GlobalHeader` a `position:sticky top-0 z-*` + contenedor `max-w-[1120px]`; verificar que el sticky no tape anchors ni el skip-link; nav actual (5 ítems, Red gated) se conserva tal cual.
- Footer: quitar `bg-muted/40`, border-top, contenedor 1120px, contenido idéntico (CC BY LOCKED).
- Contenedor global de `main` a `max-w-[1120px] px-6` (hoy varía por página) — solo donde no rompa layouts internos (ver invariante 4 para `/red`).
**Success criteria:** suite verde; snapshot/estructura de header y footer testeada; ninguna página cambia de layout interno todavía (diff visual solo: ancho de contenedor + footer + sticky).
**Riesgo:** el cambio de contenedor puede mover `/red` — si pasa, excluir `/red` del contenedor nuevo en esta fase y diferir a fase 79.

### Fase 77 — BENTO-HOME-SUPERIOR: hero + tile acento + tarjetas de entrada
**Goal:** la mitad superior del bento de la home (filas 1-2 del mockup).
**Trabajo:**
- Hero como tile span-4: kicker Geist Mono uppercase ("OBSERVATORIO DEL CONGRESO"), h1 según D1, `SearchBox` (variante existente `hero`) reestilada dentro del tile (input 52px, radio `--radius-control`, botón petróleo), pills LOCKED (44px touch target, radio 999px, hover borde petróleo).
- Tile acento "¿Cómo leer esto?" span-2: variante `accent` de `BentoTile`, BrandIcon en claro, copy alineado con `/sobre` (invariante 2), CTA "Ver metodología →" a `/sobre` (o `/metodologia` — decidir en discuss; hoy el link del hero va a `/sobre`).
- 3 tarjetas de entrada como tiles span-2: marcador según D2, flecha →, títulos/descripciones y destinos actuales (Buscar/Parlamentarios/Agenda) sin cambio de copy.
**Success criteria:** suite verde incl. tests de home actualizados (estructura, hrefs, pills LOCKED verbatim); anti-insinuación verde; hero sigue siendo server component con `SearchBox` como único island.

### Fase 78 — BENTO-HOME-ACTUALIDAD: votado / urgencias / frescura como tiles
**Goal:** la mitad inferior del bento con los datos reales de `ActualidadModule`.
**Trabajo:**
- "Votado esta semana" tile span-4: lista con barra 3px por cámara usando `--camara`/`--senado` (NO los hex del mockup), título, desenlace + tally en Geist Mono con en-dash (formato existente), fecha+cámara en mono 12px, link "Fuente ↗" por ítem (`safeExternalHref`), "Ver todo →" al destino existente. Empty state honesto (invariante 5).
- "Urgencias vigentes" tile span-2: chip pill del tipo (`suma`/`simple`) con fondo derivado de `--accent-product-soft` (equivalente del `#E3F0EF` del mockup), título, "desde {fecha}" mono; fuente de datos = `urgenciaVigente()` existente.
- "Última actualización de datos" strip span-6: dot 6px petróleo + fuente + fecha mono, `flex-wrap`, mismas fuentes que hoy (solo tablas no-PII), condicional si no hay datos.
- Retirar el `ActualidadModule` lineal viejo (los bloques MIGRAN al grid, no se duplican).
**Success criteria:** suite verde; tests de `actualidad-module` migrados a los tiles; cero cambios en las queries/RPCs (solo presentación); empty states testeados.

### Fase 79 — BENTO-COHERENCIA: propagación acotada a rutas interiores (según D3)
**Goal:** que salir de la home no se sienta como cambiar de sitio.
**Trabajo (alcance recomendado D3):**
- Contenedor 1120px + `--radius-tile` en las tarjetas de primer nivel de `/buscar`, `/parlamentarios`, `/agenda`, `/sobre`, `/metodologia` (swap de clase de radio, sin re-layout).
- `/parlamentario/[id]`, `/proyecto/[boletin]`, `/contraparte/[id]`: solo contenedor + radios de paneles exteriores; acordeones, charts y tablas internas intactos.
- `/red`: decisión consciente — si el contenedor nuevo altera el ancho, ajustar y correr la verificación visual propia (getComputedStyle en deploy real, mismo método del gate de fase 75); si no, dejarlo excluido y documentarlo.
**Success criteria:** suite verde; guard tipográfico y `red-graph.test.tsx` (`.net-chip` 11px) verdes; captura BrowserOS por ruta comparando antes/después (solo debe cambiar radio/contenedor).

### Fase 80 — BENTO-GUARDS: responsive, a11y, dark, y candados de régimen
**Goal:** que el bento no se degrade con el tiempo ni en móvil.
**Trabajo:**
- Responsive: ≤`md` el grid colapsa a 1 columna (orden: hero → cómo-leer → entradas → votado → urgencias → frescura); `sm`-`lg` intermedio 2 col si el diseño lo aguanta; verificar sticky header en móvil.
- A11y: focus-visible en tiles-link, contraste del tile acento (AA), `aria-label` del form de búsqueda, landmarks (un solo `main`, secciones con heading).
- Dark theme: derivar variantes dark de `BentoTile` (default y accent) de los tokens dark existentes; verificación manual + test de estructura.
- Candados: test-fuente "cero hex hardcodeado en componentes bento" (regex sobre `components/bento/`), extensión del guard tipográfico a los tiles (solo tokens/escala TW), y evaluar añadir `app/page.tsx` + tile cómo-leer al scope del linter anti-insinuación si el copy final roza votos/dinero.
**Success criteria:** suite completa verde (~840+ tests esperados); los 3 guards nuevos fallan en rojo si se violan (mutation self-check como en el linter existente).

### Fase 81 — BENTO-SHIP: deploy + gate visual humano
**Goal:** bento EN VIVO y aprobado en lectura fría.
**Trabajo:**
- Build OpenNext en Docker Linux + deploy wrangler (runbook existente; gotchas conocidas: `MSYS_NO_PATHCONV`, `docker cp` ruta explícita, pnpm11 `dangerouslyAllowAllBuilds`).
- Verificación visual BrowserOS en deploy real: home desktop 1200px vs mockup (side-by-side), home móvil, 1 ruta interior por tipo, `/red` no-regresión (cierra también el gate visual pendiente de fase 75 si quedó abierto).
- **Gate humano (BLOCKING):** lectura fría del operador — "¿se entiende, se ve como el mockup, nada se siente roto?" — mismo formato del gate "comprensible" de v6.1/v7.
**Success criteria:** deploy verde; capturas archivadas en la fase; sign-off del operador registrado.

---

## 4. Secuencia y dependencias

```
76 (primitivas+chrome) ──> 77 (home superior) ──> 78 (home actualidad) ──> 79 (coherencia) ──> 80 (guards) ──> 81 (ship)
```
Lineal a propósito: cada fase deja el sitio deployable (76 y 79 son las únicas que tocan rutas interiores, y de forma acotada). 77 y 78 podrían fusionarse si el planner las ve chicas — separadas aquí porque 78 arrastra la migración de tests de `ActualidadModule`.

**Relación con v7.0 (abierto):** ninguna dependencia dura. "Votado esta semana" se ve MEJOR con los backfills de votos (gates operador 66/67) pero funciona vacío-honesto sin ellos. El gate visual `/red` de fase 75 puede cerrarse dentro de la fase 81 (un solo deploy+sesión BrowserOS para ambos).

## 5. Fuera de alcance (v9+ o nunca)

- Re-layout interno de `/buscar`, `/parlamentarios`, `/agenda`, fichas (solo reciben chrome+radios).
- Rediseño del grafo `/red` (layout B recién aprobado 2026-07-13; deuda P3 de curvas es aparte).
- Animaciones/transiciones del grid (el mockup no las define).
- Cambios de datos, RPCs o schema — v8 es 100% presentación.
- El buscador con estado del mockup (`{{ query }}`/`onQuery`) — ya existe como island; no se reescribe.

## 6. Riesgos principales

1. **Radio global (D4):** si se elige subir `--radius` global en vez del token nuevo, TODO shadcn cambia de forma en todas las rutas → diff visual gigante. Mitigación: recomendación D4 (token nuevo).
2. **Sticky header + anchors:** offsets de scroll en fichas largas (acordeones con anchors). Mitigación: `scroll-margin-top` global en headings ancla.
3. **`/red` movido por el contenedor:** mitigación explícita en 76 y 79 (excluir primero, mover consciente después con gate visual).
4. **Copy drift:** el mockup trae copy placeholder que NO debe filtrarse a producción por copy-paste (especialmente los datos de ejemplo de votaciones con nombres de proyectos reales y tallies inventados). Regla: ningún string del mockup entra al repo sin pasar por D1/invariante 2.
5. **jsdom no ve layout:** los tests estructurales no capturan regresiones de grid — por eso 81 tiene gate visual humano en deploy real (lección v6.1: cascada CSS solo cazable con getComputedStyle en deploy).

## 7. Arranque

```
/clear
/gsd:new-milestone   # registrar v8.0 con este documento como insumo
# luego el ciclo estándar por fase: discuss (resolver D1-D4) → plan → execute
# o corrida autónoma: /gsd-autonomous --from 76 --to 81 (con checkpoints humanos en D1-D4 y el gate de 81)
```
