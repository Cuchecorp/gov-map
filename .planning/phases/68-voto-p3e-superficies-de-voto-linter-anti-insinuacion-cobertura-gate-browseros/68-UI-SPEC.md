---
phase: 68
slug: voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros
status: draft
shadcn_initialized: true
preset: shadcn Default / Slate (crema + petróleo overrides, LOCKED desde Phase 19/21)
created: 2026-07-14
---

# Phase 68 — UI Design Contract

> Contrato visual y de interacción para MONTAR las superficies de voto individual en la ficha del parlamentario, honrando las reglas anti-insinuación LOCKED. Componentes YA EXISTEN — esta fase compone + poda + gate. Generado por gsd-ui-researcher; verificado por gsd-ui-checker.

---

## Contexto de fase (leer primero)

Esta es una fase de **MODIFICAR/montar**, no de crear. Los tres componentes de voto
(`votos-chart.tsx`, `voto-detalle.tsx`, `votos-por-parlamentario.tsx`), la RPC
`votos_de_parlamentario`, el mapa único `lib/voto-presentacion.ts`, `voto-row.tsx`,
`provenance-badge.tsx` y la ficha `/parlamentario/[id]` **ya están en el repo y en
producción** desde milestones previos. El contrato de esta fase es cómo COMPONEN en la
ficha bajo las reglas anti-insinuación de v7.0, qué se PODA por ser diferido, y el gate
de comprensión BrowserOS.

### HALLAZGO RECTOR (bloqueante — divergencia código vs. CONTEXT LOCKED)

`votos-por-parlamentario.tsx` HOY renderiza dos superficies que CONTEXT.md §decisions
prohíbe explícitamente en esta fase:

1. **"Votó distinto a su bancada"** (sub-bloque `<h3>`, alimentado por la RPC
   `rebeldias_de_parlamentario`, líneas ~829-886). Esto ES el concepto "rebeldía"
   diferido a VOTOX v2 (17-LEGAL-DOSSIER; STATE Deferred Items). CONTEXT: "NO montar
   en ninguna superficie ciudadana".
2. **"¿Falta más o menos que la mediana de su cámara?"** (`AusenciasContexto`, RPC
   `tasa_ausencia_comparada`). Es un comparativo contra la mayoría/mediana de la cámara
   — CONTEXT prohíbe "comparativo con mayoría de bancada".

**El contrato de esta fase INCLUYE la poda de ambas superficies del render ciudadano.**
Ver §Composición y §Anti-insinuación. Las RPC pueden quedar inertes en la DB; lo que
NO puede sobrevivir es su presentación en la ficha ni el término "rebeldía" en el árbol.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (components.json presente; preset Default/Slate con overrides crema/petróleo LOCKED) |
| Preset | shadcn Default / Slate + tokens Phase 19 (`--background` crema `40 33% 97%`, `--accent-product` petróleo `183 38% 26%`) |
| Component library | Radix (shadcn primitives: Badge, Tooltip, Skeleton, Accordion) |
| Icon library | ninguna dependencia nueva; flechas por carácter (`→`, `↗`) como en el resto de la ficha |
| Font | Geist Sans (`--font-geist-sans`), `font-mono` (Geist Mono) para cifras/fechas/boletines |

Sin registries de terceros. Sin bloques nuevos. Registry safety: no aplica.

---

## Composición en la ficha

Punto de montaje: `<section id="votos" className="mt-12 scroll-mt-6">` en
`app/app/parlamentario/[id]/page.tsx` (ya existe). El `mt-12` es la **frontera
anti-insinuación LOCKED** (DESIGN-SYSTEM §3/§8): un voto y cualquier otro dominio
(lobby, patrimonio, dinero) JAMÁS comparten `<article>`/`<Card>`/`<li>`/`<tr>`. NO se
mueve ni se colapsa esa frontera.

Estructura del carril de Votaciones (orden LOCKED, top→bottom), dentro de
`VotosView` (`votos-por-parlamentario.tsx`):

| # | Sub-bloque | `<h3>` | Estado |
|---|-----------|--------|--------|
| 0 | **Leyenda anti-insinuación de la sección** (NUEVO — §Leyenda) | — | añadir 1× al tope del carril |
| 1 | ¿Cuándo votó? — stacked BarChart discreto por trimestre (`VotosChart`) | "¿Cuándo votó?" | conservar |
| 2 | Cómo votó — barra de proporción del sentido + asistencia real | "Cómo votó" | conservar |
| 3 | ~~¿Falta más o menos que la mediana de su cámara?~~ (`AusenciasContexto`) | — | **PODAR (comparativo de cámara, diferido)** |
| 4 | Por tema — faceta cruda (chips), sin score | "Por tema" | conservar |
| 5 | Votaciones agrupadas por proyecto — el arco, con enlace a proyecto + votación + provenance | — | conservar (núcleo VOTO-02) |
| 6 | ~~Votó distinto a su bancada~~ (`rebeldias_de_parlamentario`) | — | **PODAR (rebeldía, diferido VOTOX)** |

Tras la poda, el carril termina en el bloque 5 (arco por proyecto + notas de cobertura).

- **Capa-1** (`VotosCapa1`, resumen preatentivo con `breakdown`/`asistencia`) vive
  FUERA del `DetalleColapsable`, siempre visible. Los sub-bloques 0–5 viven DENTRO del
  disclosure (default cerrado). No se toca esa relación.
- La leyenda anti-insinuación (§Leyenda) va como **primer hijo del detalle** (bloque 0),
  encima de "¿Cuándo votó?", para que el marco honesto preceda a cualquier dato.
- Cada voto individual del arco (bloque 5, detalle expandido) ya lleva enlace al
  **proyecto** (`/proyecto/{boletin}`) y al registro oficial de la **votación** vía
  `ProvenanceBadge` (`e.enlace`). Contrato conservado, no se re-inventa.
- El componente `voto-detalle.tsx` (lista voto-a-voto por votación, usado en la ficha
  del PROYECTO / Senado) hereda las mismas reglas de estado y leyenda; su leyenda vive
  a nivel de la votación.

---

## Spacing Scale

Escala 8-point ya vigente (Tailwind default). Sin tokens nuevos.

| Token | Value | Usage en este carril |
|-------|-------|----------------------|
| xs | 4px | gap de badges/chips (`gap-1`), `mt-1` entre líneas de nota |
| sm | 8px | `gap-2` filas de voto, `mt-2` bajo headings |
| md | 16px | `mt-4` bajo bloques, `space-y-4` |
| lg | 24px | `space-y-6` entre arcos de proyecto |
| xl | 40px | `space-y-10` entre sub-bloques del carril (`¿Cuándo votó?` → `Cómo votó` → …) |
| 2xl | 48px | `mt-12` frontera de carril anti-insinuación (LOCKED, no se toca) |

Exceptions: touch targets a **44px** (`min-h-11` / `min-h-[44px]`) en todo control
interactivo (toggles, paginación, faceta de tema, enlaces de detalle) — ya presente,
se conserva. La leyenda de sentido usa `h-4` (16px) para la barra de proporción.

---

## Typography

Sin roles nuevos; se reusan los de la ficha.

| Role | Size | Weight | Line Height | Uso |
|------|------|--------|-------------|-----|
| Heading carril (`<h2>`) | 20px (`text-xl`) | 600 (`font-semibold`) | 1.2 | "Votaciones" |
| Sub-heading (`<h3>`) | 14px (`text-sm`) | 600 (`font-semibold`) | ~1.4 | "¿Cuándo votó?", "Cómo votó", "Por tema" |
| Body / nota | 14px (`text-sm`) | 400 | 1.5 | leyenda, notas de cobertura, líneas-resumen |
| Cifras / fechas / boletín | 14px (`text-sm` / `font-mono`) | 400 | 1.5 | conteos, `N de M`, fechas, `Boletín N°`, `tabular-nums` |
| Micro-nota fuente | 12px (`text-xs`) | 400 | 1.4 | atribución "Fuente: Cámara … / Senado …" |

**Regla dura de a11y**: toda cifra que también se codifica por color (los 5 sentidos)
DEBE repetirse como texto (`OPCION_LABEL[k] + conteo`), nunca solo color. Ya cumplido
en la barra "Cómo votó" (`aria-label` + línea `font-mono`); se conserva.

---

## Color

60/30/10 heredado (LOCKED Phase 19/21). Ningún color nuevo.

| Role | Value | Usage |
|------|-------|-------|
| Dominante (60%) | crema `hsl(40 33% 97%)` (`--background`) | fondo de página/carril |
| Secundario (30%) | `hsl(40 30% 99%)` (`--card`), `--muted` | tarjetas de arco, notas atenuadas (`text-muted-foreground`) |
| Acento producto (10%) | petróleo `hsl(183 38% 26%)` (`--accent-product`) | enlaces a proyecto/votación, faceta activa, paginación, focus-visible |
| Destructive | `hsl(0 72% 42%)` | NO se usa como color de UI en este carril (ver regla de sentido abajo) |

Acento petróleo reservado para: **enlaces (a `/proyecto`, a fuente oficial), estado
activo de la faceta de tema, controles de paginación, y outline de focus**. PROHIBIDO
como color de un sentido de voto (el petróleo es color de PRODUCTO/navegación, no de
dato — regla LOCKED en `voto-presentacion.ts`).

### Colores semánticos del sentido de voto (regla dura — los 5 estados)

Fuente única de verdad: `app/lib/voto-presentacion.ts` (`VOTO_PRESENTACION`) +
`voto-row.tsx` (`SELECCION_STYLE` para badges). El `fill` hsl (Recharts) y la clase
`bg-*` (barra/badge) viven juntos — imposible desincronizar. **No se duplican literales
de color en ningún componente de voto.**

| Estado | Label NOUN | Barra/chart (`bgClass` / `fill`) | Badge (`SELECCION_STYLE`) | Regla |
|--------|-----------|----------------------------------|---------------------------|-------|
| `si` | "A favor" | `bg-green-500` / `hsl(142 71% 45%)` | `bg-green-100 text-green-800` | positivo |
| `no` | "En contra" | `bg-red-500` / `hsl(0 84% 60%)` | `bg-red-100 text-red-800` | negativo del SENTIDO (aprobar/rechazar el proyecto) — NO juicio de la persona |
| `abstencion` | "Abstención" | `bg-amber-400` / `hsl(43 96% 56%)` | `bg-amber-100 text-amber-800` | ámbar propio, ni positivo ni negativo |
| `pareo` | "Pareo" | **`bg-slate-400`** / `hsl(215 20% 65%)` | **`bg-slate-100 text-slate-600`** | **SLATE NEUTRO — JAMÁS fundido con "en contra"** |
| `ausente` | "Ausente" | **`bg-slate-300`** / `hsl(213 27% 84%)` | **`bg-slate-100 text-slate-500`** | **SLATE NEUTRO — JAMÁS fundido con "en contra"; nunca colapsa a "no votó"** |

**Regla neutral-slate (LOCKED, hard-fail del checker):** `pareo` y `ausente` viven en
la familia **slate**, visualmente separados del rojo de `no`. Un ausente/pareo pintado
de rojo (o en el mismo bucket que "en contra") es una **insinuación de postura** y
falla la revisión. El orden de apilado LOCKED (`si → no → abstencion → pareo → ausente`)
mantiene los dos slates juntos y AL FINAL, nunca adyacentes al verde de forma que
sugiera gradiente positivo→negativo.

Chart discreto obligatorio (`BarChart` apilado por trimestre, NUNCA línea/área): una
serie continua insinuaría "trayectoria/tendencia" de comportamiento. `YAxis
allowDecimals={false}` — solo conteos, jamás fracción fabricada. Ya cumplido en
`votos-chart.tsx`; se conserva.

---

## Leyenda anti-insinuación (copy EXACTO — VOTO-04)

Toda superficie de voto lleva la leyenda. Texto **verbatim LOCKED** (CONTEXT §decisions,
REQUIREMENTS VOTO-04):

> **Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.**

Colocación:
- **Ficha del parlamentario:** 1× al tope del detalle del carril "Votaciones"
  (bloque 0, encima de "¿Cuándo votó?"). No se repite por arco ni por fila (sería ruido).
- **Ficha del proyecto / `voto-detalle`:** 1× a nivel de la votación, sobre la lista
  voto-a-voto.

Tratamiento visual (reusa el patrón existente `net-microcopy` / caveat del rail): texto
`text-sm text-muted-foreground`, borde-izquierdo petróleo `border-l-[3px]
border-[--accent-product] pl-2.5`, `mt-*` de sección. Nunca un banner alarmista; es una
nota sobria, no un disclaimer legal grande.

Provenance INLINE acompaña la leyenda a nivel de dato (no reemplaza la leyenda):
`ProvenanceBadge` con **fuente + fecha de captura + enlace a la fuente oficial** en cada
voto/arco (ya presente vía `e.enlace` / `e.fecha_captura` / `sourceLabel(e.origen)`).
La atribución de sección "Fuente: Cámara de Diputadas y Diputados / Senado de Chile ·
datos ingestados por este observatorio" (`text-xs`) se conserva bajo el chart.

---

## Cobertura declarada honestamente (VOTO-05)

Dos superficies, ambas obligatorias:

### En la UI (ficha)
- **N/M por proyecto** en el pie del carril: "Se registran votaciones de {N} proyecto(s)
  en las fuentes consultadas; la cobertura se está ampliando." (ya presente bajo el
  umbral `COBERTURA_BAJA_UMBRAL`). Se conserva y se hace **incondicional cuando la
  cobertura no es exhaustiva** — nunca se finge completitud.
- **Techo por causa** (NUEVO, requerido por CONTEXT §Cobertura honesta): cuando la
  cobertura tiene un techo conocido (RUT-bloqueado, PDF escaneado, sin dato en la
  fuente), decirlo 1× por sección en texto sobrio, p. ej.: "Algunas votaciones no se
  pueden atribuir individualmente porque la fuente publica el registro sin desglose
  nominal; se declara lo disponible." Sin fabricar el techo; si no hay causa conocida,
  se omite la línea.
- **Confirmado vs. no confirmado (regla dura):** SOLO se muestran votos `confirmado`
  atribuidos a la persona (la RPC `votos_de_parlamentario` ya devuelve solo confirmadas;
  `voto-row.tsx` degrada a nombre crudo + `IdentityMarker` cuando `estado_vinculo !==
  'confirmado'`). Un voto `probable/no_confirmado` (Senado por nombre) **NUNCA** se
  presenta como voto atribuido a la persona ni entra en los conteos agregados.
- **Asistencia con fidelidad:** "Presente en {N} de {M} · Ausente en {K}", derivada de
  `ausente`, NUNCA del sentido del voto. Se conserva.

### En `pnpm freshness`
Añadir una **señal de cobertura del voto individual** al `COBERTURA_SENALES` de
`packages/freshness/src/catalog.ts` (mismo patrón N/M que el corpus de búsqueda):
numerador = votaciones/sesiones con voto individual `confirmado` ingerido; denominador
= sesiones de sala conocidas en el período. El operador ve N/M sin bucear SQL. No es
una superficie de UI ciudadana, pero es parte del contrato de honestidad de esta fase.

---

## Linter anti-vocabulario-insinuante (VOTO-04)

Hoy no existe un linter dedicado como artefacto único — la regla se enforcea por
comentarios por-componente, code-review y asserts RTL. Esta fase **formaliza el gate**
y lo extiende a los componentes de voto nuevos/montados.

**Términos prohibidos (lista dura, hard-fail):** en el código Y en el copy renderizado
de cualquier superficie de voto:
`rebeldía`, `rebelde`, `disciplina`, `indisciplina`, `alineamiento`, `alineado`,
`afinidad`, `cercanía política`, `lealtad`, `traición`, `díscolo`, `score`, `puntaje`,
`índice`, `ranking`, `nivel de acuerdo`, `vota como`, `similar a`, y cualquier verbo
causal dinero/lobby→voto ("financió su voto", "a cambio de").

Forma del gate (a definir por el planner; el contrato es el comportamiento):
- Un guard ejecutable en CI (script `node`/`tsx` que escanea `app/components/voto*`,
  `app/components/ausencias-contexto*`, `app/lib/voto-presentacion*`, la sección VOTE
  de `page.tsx`, y `voto-detalle`/`voto-row`) que falla si aparece un término prohibido
  en JSX de texto o en labels. Espejo del guard PII/lockdown existente
  (`app/lib/lockdown-guard`).
- La palabra `rebeldía`/`rebeldias` (incluido el nombre de la RPC en JSX/labels) debe
  quedar cazada: tras la poda no debe aparecer en ningún string renderizado. La
  referencia interna a la RPC solo puede sobrevivir, si acaso, como identificador inerte
  no montado — el linter caza usos en UI, no la existencia en la DB.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Leyenda anti-insinuación (LOCKED) | "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo." |
| Nota de significado a/en-contra (LOCKED) | "A favor / En contra se refiere a aprobar o rechazar el proyecto en esa etapa de su tramitación." |
| Nota del chart (no-tendencia) | "Cada barra agrupa las votaciones de un trimestre por sentido del voto. No representa una tendencia." |
| Enlace primario (a proyecto) | "Boletín N°{boletin}" o el título del proyecto (enlace petróleo) → `/proyecto/{boletin}` |
| Enlace a fuente oficial | "fuente oficial ↗" (en `ProvenanceBadge`) |
| Toggle detalle de arco | "Ver detalle" / "Ocultar detalle" |
| Empty — no ingestado (estado c) | "Aún no hemos ingerido las votaciones de este parlamentario. Esto no significa que no haya votado — los datos se están incorporando." |
| Empty — ingestado, 0 confirmados | "No hay votaciones confirmadas para este parlamentario en la legislatura vigente." |
| Cobertura (techo por causa) | "Algunas votaciones no se pueden atribuir individualmente porque la fuente publica el registro sin desglose nominal; se declara lo disponible." |
| Cobertura (N proyectos) | "Se registran votaciones de {N} proyecto(s) en las fuentes consultadas; la cobertura se está ampliando." |
| Error state | Se LANZA (no se degrada a "sin votos"): un fallo real de `votos_de_parlamentario` sube a la UI de error honesta de la ruta (`error.tsx`), nunca se disfraza de "0 votos". |
| Destructive | Ninguna acción destructiva en este carril (solo lectura). |

Ninguna acción destructiva; el carril es read-only.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Badge, Tooltip, Skeleton, Accordion (ya instalados) | not required |
| terceros | ninguno | no aplica |

---

## Gate de comprensión BrowserOS ("comprensible")

Esta fase cierra con un veredicto de lectura fría ciudadana. La superficie de voto DEBE
pasar como **legible + honesta** ante un lector no experto:

- El lector entiende, sin ayuda, que **A favor/En contra** se refiere a aprobar/rechazar
  el proyecto en esa etapa — no a una postura ideológica de la persona.
- El lector percibe **ausente/pareo como neutros** (slate), no como "voto en contra".
- El lector ve la **leyenda anti-insinuación** antes que cualquier dato.
- El lector puede **llegar a la fuente** (proyecto + votación oficial) desde cualquier voto.
- El lector no encuentra ningún juicio, score, ni comparación con la bancada.
- La cobertura se lee como **declarada honestamente** (N/M + techo), no como completitud.

---

## Acceptance — 6 pilares que valida ui-checker / ui-review

1. **Copywriting honesto (VOTO-04):** leyenda anti-insinuación verbatim presente 1× por
   superficie; nota de significado a/en-contra presente; CERO términos de la lista
   prohibida en copy renderizado; empty/error states honestos (error se lanza, no se
   disfraza de 0).
2. **Visuals sin insinuación:** chart discreto stacked (nunca línea/área); orden de
   sentidos LOCKED; la leyenda precede a los datos; ningún adjetivo/veredicto/color de
   juicio sobre un voto. **Superficies "Votó distinto a su bancada" y "mediana de su
   cámara" AUSENTES del render.**
3. **Color (regla neutral-slate, hard-fail):** los 5 sentidos con sus tokens únicos de
   `voto-presentacion.ts`; **pareo y ausente en slate, jamás fundidos con el rojo de
   "en contra"**; petróleo reservado a enlaces/navegación, nunca como sentido.
4. **Typography + a11y:** cifras codificadas por color repetidas como texto
   (`aria-label` + línea `font-mono`); jerarquía `h2`→`h3` sin re-nivelar; touch targets
   44px en todo control.
5. **Spacing:** frontera de carril `mt-12` intacta (un voto nunca comparte contenedor
   con otro dominio); escala 8-point; disclosure default cerrado con capa-1 fuera.
6. **Procedencia + cobertura + identidad (VOTO-05):** `ProvenanceBadge` (fuente/fecha/
   enlace) en cada voto; enlace a proyecto y a votación; SOLO votos `confirmado`
   atribuidos; N/M + techo por causa declarados en UI y en `pnpm freshness`;
   `probable/no_confirmado` nunca atribuido a la persona.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
