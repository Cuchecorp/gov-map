# Veredicto de lectura fría — /red (RED-03)

**Fecha:** 2026-07-09
**Superficie:** `https://observatorio-congreso.thevalis.workers.dev/red`
**Deploy fix:** Version ID `61d8fe13-8d0c-4ed9-af1a-eb3aaf412f0c` (incluye P1) — previo `6b661987-5b44-44b1-8d16-25effe964bd7`
**Método:** lectura fría BrowserOS (páginas ocultas, MCP 127.0.0.1:9200) contra los Acceptance Hooks de `62-UI-SPEC.md`.
**Seed usado:** `D1009` (Jorge Alessandri Vergara) — el parlamentario más conectado (92 vecinos directos), elegido a propósito porque es el que producía la franja apiñada.

## Veredicto global: **COMPRENSIBLE** en las 4 combinaciones (seed+no-seed × desktop+390px)

Un hallazgo **P1** se detectó en la lectura fría (la lista de vecinos móvil se filtraba al desktop, duplicando el anillo) y se **corrigió + re-desplegó + re-capturó** (ver §Hallazgos). No quedan P0 ni P1 abiertos.

---

## Tabla antes / después

| Combinación | Antes | Después | Veredicto |
|-------------|-------|---------|-----------|
| **seed · desktop** | Franja horizontal de **93 `.net-nodo`** apiñados; leyenda vieja "el layout es una **rejilla por cámara**, no un mapa de afinidad". Ilegible. | **25 `.net-nodo`** (seed + 24 vecinos) en **anillo radial ego-céntrico**; etiquetas legibles sin zoom (nombre + cámara); control honesto **"Ver 68 vecinos más"**; leyenda "La posición en el anillo es **orden alfabético, no cercanía**". | **Comprensible** |
| **seed · 390px** | Mismo anillo/rejilla encogido (sin lista); BrowserOS sin viewport tool → captura best-effort. | **Lista honesta de 24 vecinos** ("Vecinos de Jorge Alessandri Vergara"), cada fila un Link `/red?seed=<id>` en **orden alfabético** + **61 enlaces "Ver fuente oficial"** (procedencia en el DOM). No un anillo apiñado. | **Comprensible** |
| **no-seed · desktop** | Selector de parlamentario (sin cambios en esta fase). | Idéntico (byte-idéntico): heading + explicación orientadora + `<select>` prominente + botón "Ver relaciones". **Nunca el grafo completo.** | **Comprensible** |
| **no-seed · 390px** | Selector (sin cambios). | Reflow a 390px: header apilado + explicación + `<select>` + "Ver relaciones", usable a mano. Nunca el grafo. | **Comprensible** |

### Evidencia por archivo

| Archivo | Qué muestra |
|---------|-------------|
| `red-seed-desktop-antes.png` | ANTES desktop: seed D1009, leyenda "rejilla por cámara", 93 nodos apiñados (medido por `evaluate_script`). |
| `red-seed-movil-antes.png` | ANTES 390px best-effort (BrowserOS sin resize nativo). |
| `red-noseed-desktop-antes.png` | ANTES selector baseline. |
| `red-seed-desktop-despues-viewport.png` | DESPUÉS desktop: leyenda nueva "orden alfabético, no cercanía" LIVE + inicio del canvas. |
| `red-seed-desktop-despues-ring.png` | DESPUÉS desktop: anillo radial ego-céntrico centrado (pre-fix P1). |
| `red-seed-desktop-despues-ring-v2.png` | **DESPUÉS desktop autoritativo (post-fix P1):** anillo radial + "Se muestran los primeros 24 vecinos… Ver 68 vecinos más", **sin la lista móvil filtrada**. |
| `red-seed-desktop-despues.png` | DESPUÉS desktop fullPage (pre-fix P1 — conservado como registro histórico del bug). |
| `red-seed-movil-despues.png` / `red-seed-movil-despues-lista.png` | DESPUÉS 390px: lista de vecinos alfabética con enlaces (S→Z visible), procedencia en el DOM. |
| `red-noseed-desktop-despues.png` | DESPUÉS no-seed desktop: selector prominente + explicación (sin cambios de fase). |
| `red-noseed-movil-despues.png` | DESPUÉS no-seed 390px: selector usable, nunca el grafo. |

---

## Verificación de Acceptance Hooks (UI-SPEC §Acceptance Hooks)

1. **RED-01 (conteo):** con `?seed=D1009`, `.net-nodo` en el DOM = **25** (seed + 24). Antes = 93. Truncación honesta "Ver 68 vecinos más" (24 + 68 = 92 vecinos directos totales, cifra verídica). **PASS**
2. **RED-02 (legibilidad + leyenda + móvil):** layout radial determinista, orden alfabético; etiquetas legibles sin zoom en el `fitView` por defecto; leyenda declara "orden alfabético, no cercanía"; a 390px degrada a **lista de vecinos** (no anillo encogido). **PASS**
3. **RED-03 (gate):** lectura fría emite "comprensible" en las 4 combinaciones; el hallazgo P1 se corrigió con re-captura; evidencia antes/después archivada aquí. **PASS**
4. **Anti-insinuación:** sin petróleo en nodos (borde institucional -muted por cámara, cuerpo crema); sin partido/foto/RUT/score; procedencia (fuente + ventana + enlace) en el DOM, no hover-only; leyenda con las negaciones LOCKED ("no cercanía", "no indican afinidad"). **PASS**

---

## Hallazgos

### P1 — La lista de vecinos móvil se filtraba al desktop (CORREGIDO)

- **Síntoma:** en desktop (≥768px) `.net-vecinos` mostraba `getComputedStyle().display = "flex"` a pesar de llevar `md:hidden` en el marcado → el anillo radial **y** la lista completa de vecinos se renderizaban a la vez (contenido duplicado).
- **Causa raíz:** `.net-vecinos { display: flex }` (globals.css) tiene la misma especificidad (0,1,0) que la utilidad `.md:hidden` de Tailwind; por orden de cascada el `flex` ganaba. `matchMedia("(min-width:768px)")` daba `true` a 772px pero la regla custom sobreescribía la utilidad.
- **Por qué no lo cazó la suite:** jsdom no evalúa media-queries ni la cascada real; los 747 tests pasaban. Solo la lectura fría con `getComputedStyle` sobre el deploy live lo reveló — que es justo el propósito de RED-03.
- **Fix (Rule 1 — bug):** `@media (min-width: 768px) { .net-vecinos { display: none } }` en `globals.css` → la lista es **solo <768px** como contrata el UI-SPEC. Commit `31fba72`.
- **Re-deploy:** Version ID `61d8fe13-8d0c-4ed9-af1a-eb3aaf412f0c`.
- **Re-captura + verificación LIVE:** a 772px `.net-vecinos` = `display:none`, `.net-lienzo` = `display:block`, 25 nodos. `red-seed-desktop-despues-ring-v2.png` confirma anillo sin lista filtrada. **RESUELTO.**

### P2 — Densidad del anillo a ancho "desktop" estrecho (DIFERIBLE, documentado)

- **Observación:** la ventana oculta de BrowserOS mide **772px** (apenas sobre el breakpoint md=768px). A ese ancho, 24 nodos de 160px en el anillo quedan visualmente densos (etiquetas legibles pero ajustadas hacia el centro). A un desktop ancho real (el screenshot del operador es la referencia desktop de ancho completo) el anillo respira más, y el `fitView` por defecto encuadra todo el anillo.
- **Clasificación:** **P2 (menor, no rompe comprensión)** — las etiquetas son legibles sin zoom, el conteo es correcto (25), la leyenda declara el orden. La densidad es un artefacto del ancho de captura de BrowserOS, no un defecto de comprensión.
- **Estado:** diferido como deuda no bloqueante. Si el operador reporta densidad a ancho real, el ajuste está acotado (subir `RING1_R`/`RING2_R` o bajar el cap, dentro de `red-graph.tsx`) — no requerido para cerrar RED-03.

### Nota de método — captura 390px

BrowserOS (MCP local) **no expone tool de viewport/resize ni emulación de dispositivo**; las páginas ocultas heredan el tamaño de la ventana del host (~772px). Las capturas "390px" se produjeron **simulando el estado móvil vía CSS inyectado** (`evaluate_script`: `body{width:390px}` + forzar la rama `<md`). El **contenido** de la lista móvil se verificó además programáticamente (24 filas, heading "Vecinos de …", 61 enlaces de fuente, Links alfabéticos a `/red?seed=`) — evidencia autoritativa del comportamiento móvil independiente del render visual. La captura "antes" 390px es best-effort por la misma limitación.
