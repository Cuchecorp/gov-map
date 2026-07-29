# Phase 125: E2E — Pasada final producto-a-producto sobre el deploy real - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** Smart discuss autónomo — decisiones del operador YA RESUELTAS en `.planning/PROMPT-v12.0-build-autonomo.md` (pasada 3). No se re-preguntó.

<domain>
## Phase Boundary

Cierre del milestone v12.0. Tres actos, en este orden:

1. **Deploy agrupado a Cloudflare** de los fixes de UI acumulados en 114 (links internos), 117 (fechas) y 122 (cruces/lobby) — precedente v10.0: un deploy agrupa fixes de varias fases.
2. **Pasada BrowserOS por CADA superficie del inventario 113**, con evidencia DOM por superficie.
3. **Re-verificación sobre el deploy final**: links internos + muestra estratificada de links externos (rate-limit) + fechas + cruces contra SQL.

**Fuera de alcance:** funcionalidad nueva, flips de flags no autorizados, fixes que no vengan de una fase ya cerrada de este milestone.
</domain>

<decisions>
## Implementation Decisions

### Deploy
- Build **OpenNext en Docker `node:22-slim`** (en Windows el worker sale roto — gotcha pagado v4.0).
- **robocopy a `C:/Temp/obs-build`** purgando `.pnpm-store` del mirror, y **re-escribir los helper scripts tras el mirror** (`/MIR` los borra: no están en el repo).
- **wrangler GLOBAL de AppData con OAuth** — ojo: el `wrangler` real está **sombreado por un paquete Python**; usar `AppData/Roaming/npm/wrangler.cmd` o correr dentro del contenedor montando el OAuth del host.
- `MSYS_NO_PATHCONV=1`. Propagación de Cloudflare **10–30 s** (500 intermitentes durante el lapso: no es un fallo, es la ventana).
- El deploy agrupa **solo** fixes ya commiteados de 114/117/122. Nada nuevo entra en el bundle.

### Pasada BrowserOS
- MCP en `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`.
- **Screenshots en ráfaga tumban el MCP** → `sleep` 8-10 s entre capturas. CDP timeout → reabrir la página.
- **Gates interactivos que el subagente no pueda cerrar los cierra el ORQUESTADOR**, no se saltan.
- Evidencia **DOM**, no impresión: cada superficie deja su fragmento verificable.
- El DOM de React intercala `<!-- -->` entre texto y dígitos (gotcha pagado en 122) → patrones tolerantes, jamás grep del literal pelado.

### Re-verificación
- **Links internos**: cero 404, anclas `#id` contra el DOM destino. Contra el Worker propio (sin WAF) pero con mesura.
- **Links externos**: muestra estratificada ≥1 caso por patrón×host, con **rate-limit 2-3 s/host, UA identificatorio, robots.txt**. **JAMÁS ráfagas ni crawl exhaustivo** (decisión operador 2026-07-27). "Patrón malo" se arregla; "fuente caída/WAF" se declara, jamás se evade. curl-first ante WAF de camara.cl.
- **Fechas**: siguen correctamente etiquetadas; `fecha_captura` jamás como el hecho; "captura" pelado PROHIBIDO.
- **Cruces**: siguen cuadrando contra SQL en el deploy final.

### Ítems humanos heredados de 122 (deuda explícita a cerrar aquí)
La verificación de 122 quedó `human_needed` con 4 ítems; **dos son post-deploy y son de esta fase**:
- `/parlamentario/S1338` debe mostrar **dos ausencias**: ningún dígito de conteo **y** ninguna frase «en las fuentes consultadas» (cierre de CR-01).
- La línea de cobertura lobby↔PL (`3,82 %`, observada al 2026-07-29) debe aparecer en el DOM tras la leyenda y antes del conteo.
Los otros dos (lectura fría del artefacto, juicio de copy) son gate humano; si el operador no responde, se cierran como handoff documentado.

### Flags
- **MONEY y NOTIF siguen OFF y AUSENTES del DOM** — se verifica, no se asume. NET/CRUCES/VSIM como estén.
- Ningún `*_PUBLIC_ENABLED` se toca en esta fase.

### Cierre del milestone (tras la pasada)
`/gsd:audit-milestone` → `/gsd:complete-milestone v12.0` → cleanup → tag `v12.0` → push a `Cuchecorp/gov-map`.
**merge-no-rebase** para preservar el tag. `complete-milestone` archiva SOLO el milestone en curso.

### Claude's Discretion
- Orden de recorrido de las superficies y granularidad de los planes.
- Formato del artefacto de evidencia, mientras cada superficie tenga su fragmento DOM verificable.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `113-INVENTARIO.md` — el universo de superficies a recorrer (60 emisores `E-001…E-060`, rutas, sujetos deterministas `D1165`/`S1338`/`14309-04`).
- `122-CRUCES-SQL.md` — 82 filas con query verbatim; las de veredicto `cuadra` son el set de regresión de cruces.
- `scripts/bros-cli.mjs` — wrapper BrowserOS.
- Runbooks de deploy de fases anteriores (97-DEPLOY-RUNBOOK.md y sucesores).

### Established Patterns
- Gate BrowserOS con evidencia DOM del deploy real (v8.0/v9.0/v10.0).
- Deploy agrupado al cierre del milestone (v10.0).
- Suite `app/` **1577** + `tsc` 0 + 11/11 guards de régimen como línea base.

### Integration Points
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev
- Supabase ref `bctyygbmqcvizyplktuw`. Última migración `0072` (más lo que aplique 124).
- Gates observados en el deploy anterior: NET/CRUCES/VSIM ON, MONEY OFF (404), NOTIF OFF (200 inerte).
</code_context>

<specifics>
## Specific Ideas

- Los emisores **huérfanos** confirmados en 122 (`E-029 ResumenView`, `E-003`, `E-008 actualidad-module.tsx`, empty-state de `E-053`) no tienen call-site: no se "verifican en el DOM", se registran como tales. No los busques en la pasada.
- Las 8 filas `discrepancia-declarada` de 122 siguen declaradas tras el deploy: **no deben haberse cerrado solas**; si alguna cambió, es hallazgo.
- Re-correr `Q-L07` obliga a actualizar `COBERTURA_MENCIONES_LOBBY` **y** `COBERTURA_OBSERVADA_EL` juntas — el test lo fuerza.
</specifics>

<deferred>
## Deferred Ideas

- Deuda de operador VIVA, fuera de alcance salvo que un checkpoint la cruce: RUT-01 + backfills, flip MONEY, provisión NOTIF, rotación B26 + CF secrets.
- Ampliar cobertura de datos (lobby↔PL más allá de lo ingerido) — deuda de datos, no de este milestone.
</deferred>
