# VEREDICTO — Task 3 (deploy + lectura fría) — 260713-izo layout B /red

**Fecha:** 2026-07-13
**Deploy:** ✅ EJECUTADO por Claude
**URL:** https://observatorio-congreso.thevalis.workers.dev/red?seed=D1009
**Version ID:** 6534fe9f-52bf-4a5b-a527-e788f1b75250

## Lo que Claude automatizó y verificó (deploy)

1. **Build OpenNext en Docker (node:22-slim):** source pre-copiado a `C:/Temp/obs-build`
   vía robocopy (evita el cuello OneDrive), build en contenedor. **`.open-next/worker.js`
   generado, build complete.**
   - GOTCHA nuevo resuelto: pnpm 11 convirtió el warning `ERR_PNPM_IGNORED_BUILDS` en
     error duro dentro del `runDepsStatusCheck` de OpenNext → build fallaba. Fix:
     `pnpm config set dangerouslyAllowAllBuilds true` antes del `pnpm install` en el
     contenedor. (Documentar para el próximo deploy.)
   - GOTCHA conocido reconfirmado: `docker run -w /app` DEBE correr vía PowerShell, no
     git-bash (MSYS convierte `/app` → `C:/Program Files/Git/app`).
2. **Deploy wrangler (OAuth local):** `wrangler deploy --config wrangler.jsonc` desde
   `C:/Temp/obs-build`. **Deployed `observatorio-congreso`, HTTP 200 en `/red?seed=D1009`.**
   - GOTCHA: invocar wrangler con el operador de llamada `& node.exe '...wrangler.js'`
     (no `node ... | Select-Object`, que PS interpreta como documento en pipeline).
3. **Verificación HTTP del layout B en el HTML servido** (ver `http-verificacion-deploy.txt`):
   - PRESENTES: `net-b-layout`, `net-b-seedcol`, `net-b-seed`, `net-b-list`, `net-b-row`,
     `net-b-conn`, `net-b-pager`, `net-leyenda`, `net-chip`.
   - AUSENTES (correcto): `net-lienzo`, `net-nodo`, `net-arista`, `net-vecinos` (todas las
     clases del anillo xyflow eliminadas).
   - `net-microcopy` no aparece en el SSR porque el detalle inline se renderiza al
     seleccionar una fila (client-side) — comportamiento esperado.

## Lectura fría BrowserOS — EJECUTADA por Claude (orquestador, vía MCP 127.0.0.1:9200)

Corrección al bloque original del ejecutor: el MCP de BrowserOS SÍ estaba disponible
(`scripts/bros-cli.mjs`, patrón 62-03). Loop completo sobre el deploy live
(Version `6534fe9f`), páginas ocultas, capturas archivadas en esta carpeta.

**Veredicto de la lectura fría: COMPRENSIBLE / YA NO APIÑADO** en las combinaciones probadas:

| Vista | Captura | Lectura |
|-------|---------|---------|
| Desktop `?seed=D1009` (cabecera) | `red-seed-desktop.png` | Título + subtítulo + "Centrado en Jorge Alessandri Vergara" + leyenda "Cómo leer este diagrama" paso a paso ABIERTA + filtros. Legible. |
| Desktop diagrama | `red-seed-desktop-diagrama.png` | Seed-card izquierda ("92 vecinos · 300 hechos documentados" + nota "orden alfabético; la posición no implica afinidad") + columna de 10 filas con chip cámara y "N hechos →" + conectores curvos fan-out repartidos + pager honesto "Vecinos 1–10 de 92 · página 1 de 10 · orden alfabético". CERO telaraña: ninguna arista con etiqueta encima, ninguna convergencia a un punto. |
| Desktop detalle (clic Benjamín Moreno Bascur) | `red-seed-desktop-detalle.png` | Fila seleccionada con outline petróleo, SU conector destacado (oscuro) y los demás atenuados; detalle inline con hechos reales ("Ambos recibieron audiencia de Generadoras de Chile"), ventana mono, Fuente/Periodo/Registro y "Ver fuente oficial ↗". Procedencia completa en DOM. |
| 390px (forzado vía CSS inyectado, gotcha 62-03: BrowserOS no expone resize de viewport) | `red-seed-390-besteffort.png`, `red-seed-390-filas.png` | Leyenda envuelve bien; nota móvil "En pantallas angostas las líneas se omiten…" visible; seed-card arriba full-width; filas full-width legibles SIN conectores; pager apilado. |
| Sin seed | `red-noseed-desktop.png` | Selector honesto "Elige un parlamentario…" + botón "Ver relaciones". Sin grafo huérfano. |

**Verificación programática sobre el live** (evaluate_script):
- 10 filas/página, SVG `net-b-conn` presente, **0** clases `react-flow`.
- Microcopy "No indica afinidad, acuerdo ni motivo" ✓; leyenda "no significan nada" ✓.
- 7 links "Ver fuente oficial ↗" en la fila expandida (= sus 7 hechos) ✓.
- Paginación real: clic "Siguientes →" → "Vecinos 11–20 de 92 · página 2 de 10" ✓.
- Contrato móvil en código: `drawConn` sale temprano bajo 48rem (`MD_BREAKPOINT_PX`),
  `.net-b-nota-movil` default visible y oculta a ≥48rem, layout 2-col solo ≥48rem.

**Hallazgo menor (P3, no bloqueante):** los conectores salen repartidos por el borde
derecho de la seed-card, pero como la tarjeta (~210px de alto) es mucho más corta que la
columna (~900px), las curvas se juntan visualmente cerca de la esquina superior antes de
abrirse. Legible y sin convergencia a un punto; si el operador lo reporta, el ajuste
acotado es repartir los puntos de salida sobre TODO el alto del contenedor o aumentar la
separación vertical inicial.

**Gotcha nuevo de BrowserOS:** `save_screenshot` puede tumbar el MCP con
"CDP request timeout" en ráfaga; la página oculta puede morir → reabrir con `open` y
re-aplicar estado. Reintentos con sleep 8-10s funcionan.

## Gate humano (checkpoint:human-verify, gate="blocking") — aprobación final

La lectura fría de Claude dictamina COMPRENSIBLE; el cierre del checkpoint sigue siendo
del operador (patrón 62-03: gate cerrado solo con señal "aprobado"). Pasos para el operador:

1. Abre https://observatorio-congreso.thevalis.workers.dev/red?seed=D1009 en desktop.
2. ¿Se lee como un diagrama izquierda→derecha legible (seed a la izquierda, columna de
   vecinos, líneas curvas repartidas) y YA NO como un anillo/telaraña apiñado?
3. Pulsa un vecino: ¿se destaca su línea, se atenúan las demás, y se abre el detalle con
   el/los hecho(s), su fecha, y el enlace "Ver fuente oficial"?
4. Revisa la leyenda "Cómo leer este diagrama": ¿está el paso a paso completo y declara
   "orden alfabético / no cercanía"?
5. Estrecha a ~390px (o abre en móvil): ¿la misma columna se ve bien SIN líneas, con la
   nota de que las líneas se omiten?
6. Abre /red sin seed (selector) y con un seed de senador: ¿todo coherente?
7. (Opcional) Archiva capturas junto a este VEREDICTO.md.

**Responde "approved"** si la lectura fría confirma (a) ya no apiñado + (b) explicaciones
detalladas legibles + (c) invariantes visibles (leyenda "orden alfabético, no cercanía";
procedencia fuente+fecha+enlace en el detalle; chips borde civic sin relleno; petróleo
solo en conectores/links/focus); **o describe qué sigue apiñado / qué explicación falta**
para re-fix + re-captura.

## Estado

- Deploy: ✅ LIVE (verificado por HTTP 200 + marcadores del layout B en el HTML).
- Lectura fría BrowserOS (Claude): ✅ EJECUTADA — veredicto COMPRENSIBLE / YA NO APIÑADO,
  6 capturas + verificación programática archivadas (2026-07-13).
- Aprobación humana final: ✅ **APROBADO por el operador (2026-07-13)** — gate
  checkpoint:human-verify CERRADO. /red layout B queda validado en producción.
