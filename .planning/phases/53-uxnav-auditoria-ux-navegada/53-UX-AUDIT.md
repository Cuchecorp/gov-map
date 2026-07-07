# 53-UX-AUDIT — Auditoría UX navegada (PROD, 2026-07-06)

**Sitio:** https://observatorio-congreso.thevalis.workers.dev (versión desplegada: **ee6b7544**)
**Mecánica:** BrowserOS MCP (`scripts/bros-cli.mjs`), páginas OCULTAS, **2 pistas**:
- **Pista A — funcional directa** (viewport nativo ~772px): console logs por ruta, inventario de links (`get_page_links` + `search_dom`), snapshots a11y, headings, interacción real puntual. Log crudo → `ux-evidence/pista-a-log.md`.
- **Pista B — visual harness iframe** (390×844 móvil / 1280×800 desktop, anchos exactos): screenshots `fullPage` jpeg q70 → `ux-evidence/j{n}-*.jpg`.

**Límite conocido:** los console logs salen SOLO de la Pista A (el harness iframe cross-origin no captura la consola del sitio). Errores de consola móvil-only serían rarísimos (mismo bundle JS que desktop) — no auditables por Pista B; asumido bajo riesgo (research A3).

**Alcance de clasificación (CONTEXT LOCKED):** P0 = SOLO orientación / navegación / bloqueo (no-sé-dónde-estoy · no-puedo-llegar-a-X · callejón-sin-salida · affordance-rota · error-consola-grave). Rediseño visual / jerarquía = P1/P2 → F54. Ante la duda P0/P1 → P1. Todo P0 mapea a UN remedio contratado del `53-UI-SPEC` (ítem de nav · breadcrumb · línea de continuación · cross-link ya-legal); si el remedio natural excede eso → P1.

---

## Resumen ejecutivo

- **Hallazgos: 3 P0 · 2 P1 · 1 P2 · 1 GATED** | P0 a corregir en esta fase: **3/3** (todos mapean a contrato UI-SPEC).
- **Veredicto por journey:**
  - **J1 (landing `/`):** Sólido. Afordancias claras (buscador + chips + actualidad), no dead-end. Único gap: el header nav no incluye `/red`.
  - **J2 (proyecto por idea → ficha):** Búsqueda semántica y por boletín **funcionan**; ficha rica con trazabilidad ("qué pasó, cuándo, según qué fuente"). Gap: la ficha no anuncia en qué sección estás (sin breadcrumb, sin nav activo).
  - **J3 (parlamentario 360):** Directorio (186) → ficha (votos/lobby/patrimonio/cruces) → red, todo conectado. Gaps: sin breadcrumb en la ficha; `/red` inalcanzable desde el nav; grafo ilegible en móvil (P1→F54).
  - **J4 (transversal):** El header nav está en TODA superficie → home en 1 click. `/contraparte/[id]` da 404 por diseño (MONEY gate OFF) con recuperación honesta ("Volver al inicio") → GATED, no P0.

---

## Journey 1 — Visitante aterriza en `/`

| Paso | Ruta | Desktop | Móvil | Console (Pista A) | Hallazgos |
|------|------|---------|-------|-------------------|-----------|
| 1.1 | `/` | `j1-01-home-1280.jpg` | `j1-01-home-390.jpg` | limpio (solo baseline woff2) | F-01 (nav sin Red), F-05 (woff2) |

**Observado:** h1 "Qué pasó con cada proyecto de ley y cada parlamentario. Con la fuente a la vista." + buscador (`searchbox` + botón "Buscar proyectos") + 4 chips de ejemplo (protección de datos personales · delitos económicos · 40 horas · 14309-04) + link "¿Cómo leer esto?" + módulo Actualidad ("Votado esta semana" honesto-vacío; "Urgencias vigentes" con tarjetas → `/proyecto/*`). **No es dead-end.** En móvil el nav envuelve a 2 filas (Buscar·Parlamentarios·Agenda / Sobre·Metodología).

## Journey 2 — Proyecto por idea → ficha ("qué pasó, cuándo, según qué fuente")

| Paso | Ruta | Desktop | Móvil | Console | Hallazgos |
|------|------|---------|-------|---------|-----------|
| 2.1 | `/buscar` | — | — | baseline | orientación OK (h1 visible, nav activo) |
| 2.2 | `/buscar?q=protección de datos personales` | `j2-02-buscar-1280.jpg` | `j2-02-buscar-390.jpg` | baseline | búsqueda semántica OK (~20 resultados) |
| 2.3 | `/proyecto/14309-04` | `j2-03-proyecto-1280.jpg` | `j2-03-proyecto-390.jpg` | baseline | **F-02** (sin breadcrumb / sin nav activo) |

**Observado:** el atajo de boletín (`BOLETIN_RE` → `redirect`) y la búsqueda semántica (embed Gemini server-side, Suspense streaming 6–9 s con skeleton) funcionan. La ficha `/proyecto/14309-04` ("Establece un sistema de subvenciones para la modalidad educativa de reingreso") trae ¿Dónde está hoy? · Tramitación · Votaciones · Idea matriz · Cuerpos legales · Proyectos similares, con múltiples "Ver fuente oficial ↗" (provenance) y cross-links a proyectos similares. **Gap:** ningún ítem del nav queda activo (no existe ítem "Proyectos"; `/proyecto/*` no matchea prefijo) y no hay breadcrumb → el visitante no sabe en qué sección está.

**Empty-state /buscar:** para una query sin coincidencias, `buscar/page.tsx:80-90` renderiza "Sin resultados · No se encontraron proyectos para «{q}». Prueba con otras palabras, o ingresa un número de boletín." — párrafo honesto SIN navegación de salida dentro del contenido (F-03).

## Journey 3 — Parlamentario 360 (votos → lobby → patrimonio → red)

| Paso | Ruta | Desktop | Móvil | Console | Hallazgos |
|------|------|---------|-------|---------|-----------|
| 3.1 | `/parlamentarios` | `j3-01-parlamentarios-1280.jpg` | `j3-01-parlamentarios-390.jpg` | baseline | orientación OK (h1 "Parlamentarios", nav activo); 186 links |
| 3.2 | `/parlamentario/D1012` | `j3-02-parlamentario-1280.jpg` | `j3-02-parlamentario-390.jpg` | **limpio (0)** | **F-02** (sin breadcrumb / sin nav activo) |
| 3.3 | `/red?seed=D1012` | `j3-03-red-1280.jpg` | `j3-03-red-390.jpg` | baseline | **F-01** (fuera del nav), **F-04** (grafo ilegible en móvil) |

**Observado:** ficha D1012 = "Boris Barrera Moreno" con Votaciones (141) · Reuniones de lobby (107) · Declaraciones de patrimonio e intereses (10) · Cruces con sectores (12) · Financiamiento (pendiente). Votos con cross-links `Ver detalle` → `/proyecto/*` y link "Ver relaciones con otros parlamentarios" → `/red?seed=D1012`. `/red` = h1 "Relaciones entre parlamentarios" + subtítulo anti-insinuación ("…no afirma intención ni causa") + grafo poblado. **Gaps:** sin breadcrumb ni nav activo en la ficha (F-02); `/red` no está en el header, solo se alcanza vía la ficha (F-01); en móvil 390 el grafo node-link tiene labels superpuestos/ilegibles (F-04, rediseño → F54).

## Journey 4 — Navegación transversal (proyecto ↔ parlamentario ↔ agenda ↔ contraparte ↔ home)

| Paso | Ruta | Desktop | Móvil | Console | Hallazgos |
|------|------|---------|-------|---------|-----------|
| 4.1 | `/agenda` | `j4-01-agenda-1280.jpg` | `j4-01-agenda-390.jpg` | baseline (+1 inocuo) | orientación OK (h1 "Agenda legislativa", nav activo); 36 cross-links boletín→ficha |
| 4.2 | `/contraparte/1` | — | `j4-02-contraparte404-390.jpg` | — (HTTP 404) | **F-06 GATED** (no P0) |
| 4.3 | transversal (header en toda superficie) | (todas) | (todas) | — | criterio ≤2 clicks: **CUMPLE** (home en 1 click desde cualquier página) |

**Observado:** `/agenda` con Citaciones de comisiones + Tabla de sala + 36 boletines enlazados. `/contraparte/1` → **HTTP 404** (curl confirmado; MONEY gate OFF → `notFound()`), con página not-found personalizada ("Contraparte no encontrada · No encontramos esta página. Es posible que el identificador sea incorrecto." + "Volver al inicio" + header nav completo). **Ningún link ciudadano apunta a `/contraparte`** (verificado: 0 en fichas) → no hay P0 de "link que renderiza 404". **Transversalidad:** el header nav (wordmark→home + ítems) está presente en home, buscar, fichas, parlamentarios, red, agenda y hasta en el 404 → desde cualquier superficie se vuelve a home / se salta a otra sección en 1 click. Único punto sin acceso directo desde el nav: `/red` (→ F-01).

---

## Hallazgos

### F-01 · P0 · `/red` inalcanzable desde el header + nav no cabe limpio en móvil
- **Dónde:** header global, TODAS las rutas (desktop + móvil 390). | **Evidencia:** `j1-01-home-390.jpg` (nav envuelve a 2 filas), `j3-03-red-390.jpg` (en `/red` el nav no lista "Red"), `ux-evidence/pista-a-log.md` (inventario nav = 4 ítems).
- **Qué pasa / por qué desorienta:** el nav tiene 4 ítems (Buscar · Parlamentarios · Agenda · Sobre / Metodología) y **no incluye `/red`**, que está LIVE desde 2026-07-02. Para llegar a la red hay que entrar primero a una ficha de parlamentario y usar "Ver relaciones" (≥2 clicks, ruta no evidente). Además el label largo "Sobre / Metodología" empuja el nav a una 2ª fila en 390px.
- **Criterio:** `no-puedo-llegar-a-X`.
- **Fix (contrato UI-SPEC §a):** extender `NAV_ITEMS` con `{ href: "/red", label: "Red" }` en posición 4 y acortar el ítem 5 a `"Sobre"` (Metodología sigue en footer + `/sobre`). Active-state (`esActivo` prefix-match) y `min-h-11` intactos. → **`app/components/header-nav.tsx:27-32`** (actualizar también el comentario `// LOCKED (UI-SPEC §11.0)` a la referencia 53-UI-SPEC, re-open autorizado).
- **Verificación (Wave 3):** `ux-evidence/fix-F01-before.jpg` (este `j1-01-home-390.jpg`) → `fix-F01-after.jpg` (nav de 5 ítems cortos, "Red" presente, cabe en 1 fila de ítems).

### F-02 · P0 · Las fichas no anuncian en qué sección estás (sin breadcrumb, sin nav activo)
- **Dónde:** `/proyecto/[boletin]` y `/parlamentario/[id]` (desktop + móvil); `/contraparte/[id]` (gated, future-proof). | **Evidencia:** `j2-03-proyecto-1280.jpg`, `j2-03-proyecto-390.jpg`, `j3-02-parlamentario-390.jpg`, `j3-02-parlamentario-1280.jpg`.
- **Qué pasa / por qué desorienta:** en las fichas ningún ítem del nav queda subrayado (no existe ítem "Proyectos"; `/parlamentario/D1012` no matchea el prefijo `/parlamentarios`) y no hay breadcrumb. El h1 dice QUÉ es (título del proyecto / nombre del parlamentario) pero no DÓNDE estás dentro del sitio ni cómo volver a la superficie de listado.
- **Criterio:** `no-sé-dónde-estoy`.
- **Fix (contrato UI-SPEC §b):** componente server puro `Breadcrumbs` (props literales, cero JS) renderizado sobre el h1, dentro del container existente:
  - `/proyecto/[boletin]`: `Inicio / Proyectos(→/buscar) / Boletín {boletin}(mono)` → **`app/app/proyecto/[boletin]/page.tsx:50`** + **NUEVO `app/components/breadcrumbs.tsx`**.
  - `/parlamentario/[id]`: `Inicio / Parlamentarios(→/parlamentarios) / {nombre_normalizado}` (dentro del server component cacheado que ya tiene el nombre) → **`app/app/parlamentario/[id]/page.tsx:116`**.
  - `/contraparte/[id]`: `Inicio / {nombre}` DESPUÉS del `notFound()` (invisible en PROD de esta fase, future-proof) → **`app/app/contraparte/[id]/page.tsx:62`**.
- **Verificación (Wave 3):** `fix-F02-before.jpg` (`j2-03-proyecto-1280.jpg`) → `fix-F02-after.jpg` (breadcrumb "Inicio / Proyectos / Boletín 14309-04" sobre el h1).

### F-03 · P0 · Estados vacíos honestos sin salida de navegación (callejón sin salida dentro del contenido)
- **Dónde:** `/buscar` sin resultados (reproducible); y —cuando ocurran— ficha parlamentario (votos / lobby sin registros), `/agenda` sin citaciones, `/red` grafo vacío. | **Evidencia:** `ux-evidence/pista-a-log.md` (verificado en fuente `buscar/page.tsx:80-90`; en vivo el estado bare aparece durante el streaming). Los sujetos de prueba con datos ricos (D1012, agenda semana poblada) no reprodujeron los otros vacíos en vivo — se documentan por su patrón shipped.
- **Qué pasa / por qué desorienta:** el estado vacío honesto (p. ej. "Sin resultados… Prueba con otras palabras") es un párrafo sin ningún enlace de continuación dentro del contenido; el usuario que aterriza en una sección vacía queda sin siguiente paso salvo re-descubrir el header. El SPEC contrata exactamente 1 línea de continuación orientadora para estas superficies.
- **Criterio:** `callejón-sin-salida` (suave — el header nav mitiga; por eso NO se degrada a P1: el CONTEXT contrata la línea explícitamente como remedio de orientación).
- **Fix (contrato UI-SPEC §c):** párrafo hermano `<p class="text-sm mt-2">` con 1 solo link petróleo, string honesto shipped byte-idéntico arriba. Aplicar SOLO a la superficie marcada; copy de la tabla del SPEC:
  - `/buscar` sin resultados → "…o revisa la agenda legislativa de la semana →(/agenda)." → **`app/app/buscar/page.tsx:80-90`**.
  - Ficha parl. votos sin registros → "…otros parlamentarios en el directorio →(/parlamentarios)." → **`app/components/votos-por-parlamentario.tsx:462-466`**.
  - Ficha parl. lobby no ingestado / cero confirmadas → "…buscar un proyecto de ley por su idea →(/buscar)." → **`app/components/lobby-de-parlamentario.tsx:296-300` y `:310-314`**.
  - `/agenda` sin citaciones → "…buscar un proyecto de ley por su idea →(/buscar)." → **`app/app/agenda/page.tsx:294-297`** (y `:199-202`, `:486-489` según corresponda).
  - `/red` grafo vacío → "Vuelve al directorio de parlamentarios →(/parlamentarios)." → **`app/components/red/red-graph.tsx:158-165`** (isla cliente existente; permitido por SPEC).
- **Nota (semantic guard LOCKED):** la línea SOLO agrega una ruta; NUNCA reencuadra el hecho ni fabrica virtud ("limpio/transparente" prohibido). Home actualidad NO se toca (no es dead-end).
- **Verificación (Wave 3):** capturar un sujeto data-vacío (p. ej. `/buscar?q=<sin-match>`) before/after → `fix-F03-before.jpg` / `fix-F03-after.jpg`.

### F-04 · P1 · Grafo `/red` ilegible en móvil 390 (→ Phase 54, sin fix aquí)
- **Dónde:** `/red?seed=D1012`, viewport 390. | **Evidencia:** `j3-03-red-390.jpg`.
- **Qué pasa:** el diagrama node-link renderiza con labels superpuestos/cramped a 390px; se lee mal en móvil. El grafo funciona (zoom +/−), no bloquea, no desorienta la navegación global.
- **Criterio:** legibilidad / rediseño visual → **excede el contrato** (no es nav / breadcrumb / continuation / cross-link) → **P1 → F54**.

### F-05 · P2 · Warnings de preload de fuentes en consola (→ backlog)
- **Dónde:** TODAS las rutas. | **Evidencia:** `ux-evidence/pista-a-log.md`.
- **Qué pasa:** cada ruta emite exactamente 2 warnings idénticos "…woff2 was preloaded using link preload but not used within a few seconds…". Cero errores de app, cero excepciones. Ruido de performance de preload de fuentes.
- **Criterio:** `error-consola` nivel ruido (no rompe función) → **P2 → F54/backlog**.

### F-06 · GATED · `/contraparte/[id]` → 404 (MONEY gate OFF) + cross-link contraparte no-enlazable
- **Dónde:** `/contraparte/1` (curl 404); sección lobby de la ficha de parlamentario. | **Evidencia:** `j4-02-contraparte404-390.jpg`.
- **Qué pasa:** la ruta `/contraparte/[id]` está MONEY-gated → `notFound()` con el gate OFF (default en PROD) → 404 con not-found honesto ("Contraparte no encontrada" + "Volver al inicio" + nav). **NO es P0** (por diseño, fail-closed; hay recuperación; ningún link ciudadano la referencia).
- **Cross-link contraparte-en-lobby = NOT SHIPPABLE esta fase** (3 candados LOCKED): (1) el RPC `lobby_de_parlamentario` no emite `contraparte_id` (privacidad §3.7); (2) doctrina B11/§3.2 "contraparte texto crudo, NUNCA enlazada" (identidad no verificada); (3) la ruta está gated → el link sería un 404 garantizado. **Se desbloquea con:** `contraparte_id` confirmado en el RPC + sign-off del MONEY gate. Registrado como gated finding, no como fix.
- **NO se propone:** tocar el carril lobby×tramitación (nombre en TEXTO PLANO, LOCKED 52-03) ni la contraparte cruda; ni re-proponer los cross-links ya shipped (voto→ficha, similar→ficha, agenda-boletín→ficha, directorio→ficha, ficha→red).

---

## Matriz de cobertura de journeys

| Journey | Desktop 1280 | Móvil 390 | Console (Pista A) | Screenshots | Veredicto |
|---------|--------------|-----------|-------------------|-------------|-----------|
| J1 landing `/` | ✓ | ✓ | limpio | `j1-01-home-{1280,390}.jpg` | OK · gap F-01 |
| J2 buscar → ficha | ✓ | ✓ | baseline | `j2-02-buscar-{1280,390}.jpg`, `j2-03-proyecto-{1280,390}.jpg` | OK · gap F-02, F-03 |
| J3 parlamentario 360 | ✓ | ✓ | limpio (ficha) / baseline | `j3-01-parlamentarios-{1280,390}.jpg`, `j3-02-parlamentario-{1280,390}.jpg`, `j3-03-red-{1280,390}.jpg` | OK · gap F-01, F-02, F-04 |
| J4 transversal | ✓ (agenda) | ✓ (agenda, contraparte404) | baseline | `j4-01-agenda-{1280,390}.jpg`, `j4-02-contraparte404-390.jpg` | OK · GATED F-06; ≤2 clicks CUMPLE |

**Cobertura:** 4/4 journeys navegados en vivo, desktop + móvil, con evidencia archivada (15 screenshots + log crudo Pista A). Ninguna página oculta de BrowserOS quedó huérfana.

## P0 → remedio contratado (insumo directo de la Wave 2)

| P0 | Superficie | Remedio contratado (UI-SPEC) | Archivo(s) del fix |
|----|-----------|------------------------------|--------------------|
| F-01 | Header nav | §a Ítem de nav "Red" (pos 4) + acortar "Sobre" | `app/components/header-nav.tsx:27-32` |
| F-02 | Fichas proyecto/parlamentario/contraparte | §b Breadcrumbs (server, props literales) | NUEVO `app/components/breadcrumbs.tsx` + `proyecto/[boletin]/page.tsx:50`, `parlamentario/[id]/page.tsx:116`, `contraparte/[id]/page.tsx:62` |
| F-03 | Empty states (buscar, votos, lobby, agenda, red) | §c Línea de continuación (1 link petróleo) | `buscar/page.tsx:80-90`, `votos-por-parlamentario.tsx:462-466`, `lobby-de-parlamentario.tsx:296-300/310-314`, `agenda/page.tsx:294-297/…`, `red/red-graph.tsx:158-165` |

---

## Re-walkthrough (post-redeploy `<nueva versión>`)

_Vacío — lo llena la Wave 3 tras el redeploy. Por cada P0: before (el screenshot de auditoría citado arriba) → after (mismo viewport/ruta contra el PROD re-desplegado)._

| Fix | Ruta | Viewport | Before | After | Estado |
|-----|------|----------|--------|-------|--------|
| F-01 nav Red + Sobre | `/` , `/red` | 390 / 1280 | `j1-01-home-390.jpg` | `fix-F01-after.jpg` | pendiente |
| F-02 breadcrumbs | `/proyecto/14309-04`, `/parlamentario/D1012` | 390 / 1280 | `j2-03-proyecto-1280.jpg`, `j3-02-parlamentario-390.jpg` | `fix-F02-after.jpg` | pendiente |
| F-03 continuation | `/buscar?q=<sin-match>` (+ superficies marcadas) | 390 / 1280 | `fix-F03-before.jpg` | `fix-F03-after.jpg` | pendiente |
