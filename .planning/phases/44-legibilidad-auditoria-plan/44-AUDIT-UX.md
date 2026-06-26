# Phase 44 — Auditoría UX de la ficha de parlamentario

**Fecha:** 2026-06-26 · **Sitio:** `observatorio-congreso.thevalis.workers.dev` (PROD, gov-map.com) · **Método:** browseros sobre el sitio en vivo + lectura del fuente render (`app/app/parlamentario/[id]/page.tsx`).

## Evidencia de peso (el problema, medido)

- **browseros NO pudo capturar la ficha `/parlamentario/D1009`**: `screenshot` (full-page y viewport reducido a 800×600/q40) **timeout** repetido; la pestaña carga (título OK) pero el render es demasiado pesado para una captura. La página pesa **~900 KB de HTML** (dato del milestone). *La herramienta de auditoría se ahogó en la misma página que el ciudadano tiene que leer* — es la demostración más directa del problema.
- El layout es una **única columna `max-w-3xl`** con secciones **apiladas verticalmente**, separadas por `mt-12`, **sin colapsar, sin resumen superior, sin navegación interna**.

## Estructura real (orden de scroll, de arriba a abajo)

Del fuente `page.tsx` — el orden es fijo y todo se renderiza apilado:

| # | Carril (`<section>`) | `<h2>` | Estado en PROD |
|---|---|---|---|
| 0 | `HeaderSection` | cabecera (nombre, partido, periodo) | siempre |
| 1 | `#votos` | "Votaciones" | poblado pero ralo (≤9) |
| 2 | `#lobby` | "Reuniones de lobby" | poblado (confirmadas) |
| 3 | `#patrimonio` | "Declaraciones de patrimonio e intereses" | la más densa (hasta 11 años × 6 tipos de bien) |
| 4 | `#cruces` | "Cruces con sectores" | LIVE (Candado B ON) |
| 5 | `#financiamiento-pendiente` | "Financiamiento y contratos del Estado" | placeholder legal (MONEY OFF) |

*(Con MONEY ON aparecerían además `#dinero` y `#financiamiento` — más carga aún.)*

## Hallazgos priorizados

| Sev | Hallazgo | Evidencia | Implicación de diseño |
|---|---|---|---|
| **ALTA** | **Sin "arriba del pliegue".** El ciudadano abre la ficha y ve la cabecera + el principio de Votaciones; para saber "qué hay" debe scrollear ~900 KB. No hay resumen ni índice. | layout 1-columna, 0 nav | **Resumen + índice de secciones** (chips de salto) arriba, con conteos por carril ("12 reuniones · 6 declaraciones · …"). |
| **ALTA** | **Todo expandido siempre.** Las 5-7 secciones renderizan su contenido completo de una; la más densa (patrimonio: años × 6 tipos de bien jsonb) empuja todo lo de abajo fuera de vista. | `page.tsx` apila `<Suspense>` con el view completo | **Acordeones por carril**: header siempre visible (preserva la frontera de carril §8), cuerpo colapsable; abrir bajo demanda. |
| **ALTA** | **Tablas donde un gráfico comunica mejor.** Patrimonio se lee hoy como filas de versiones; "¿creció o bajó el nº de bienes?" exige leer y comparar a mano. Votos = lista cronológica sin forma agregada. | `patrimonio-de-parlamentario.tsx`, `votos-por-parlamentario.tsx` | **Gráficos descriptivos** (conteo de ítems por año; distribución de votos) — *donde la data alcanza* (ver inventario: hoy solo patrimonio-conteo es denso). |
| **MEDIA** | **Jerarquía visual plana entre carriles.** Todos los `<h2>` pesan igual; ningún carril señala "esto es lo más sustantivo de este diputado". Lobby (vacío/ralo) ocupa el mismo espacio que patrimonio (denso). | `text-xl font-semibold` idéntico en todos | El acordeón debe mostrar **estado/conteo en el header** para que el lector decida qué abrir sin abrirlo. |
| **MEDIA** | **El peso de página es un costo real**, no solo estético: ahoga herramientas (browseros) y penaliza móvil/conexiones lentas — la audiencia es prensa y público general. | timeout de screenshot | Colapsar contenido **reduce el DOM inicial**; cargar el cuerpo del acordeón bajo demanda (o al expandir) baja el HTML inicial. |
| **BAJA** | **Placeholder legal mezclado con data real** sin separación de jerarquía ("Financiamiento pendiente" se lee como una sección más). | `#financiamiento-pendiente` | Agruparlo como estado honesto al pie, visualmente distinto de carriles con datos. |

## Invariante que el rediseño NO puede romper (DESIGN-SYSTEM §3/§8, LOCKED)

- **Frontera de carril `mt-12` nunca se colapsa**, ni con un carril vacío. Dos dominios (voto, lobby, patrimonio, dinero, cruces) **JAMÁS comparten** un `<article>/<Card>/<li>/<tr>` (anti-insinuación §8.2). → **Los acordeones son uno-por-carril**; está prohibido un acordeón que agrupe dos dominios en una unidad. El header del acordeón **siempre visible** mantiene la jerarquía `h1→h2→h3` y la identidad de carril aunque el cuerpo se colapse.
- Cada dato/gráfico conserva **fuente + fecha + enlace**; los gráficos son **descriptivos, nunca causales** (etiquetas neutras: "cómo votó", "cómo evolucionó el nº de bienes"; nunca "a favor de"/"por qué").

## Otras superficies (revisión rápida)

No son el foco del milestone (la ficha de parlamentario es el muro). `/parlamentarios`, `/agenda`, `/buscar`, `/proyecto/<boletin>` no presentan el mismo apilamiento extremo (son listados/fichas más acotadas). El rediseño de navegación+acordeones puede **reutilizar el patrón** en `/proyecto/<boletin>` si crece, pero v5 prioriza `/parlamentario/[id]`.
