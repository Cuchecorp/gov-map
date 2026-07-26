# 104-DEPLOY-RUNBOOK — Deploy v10.0 completo (arrastra 101+102+103) + flip VSIM

**Escrito:** 2026-07-26 (Plan 104-02; cerrado manualmente por el orquestador tras corte de sesión)
**Worker:** observatorio-congreso · https://observatorio-congreso.thevalis.workers.dev

---

## Secuencia ejecutada

1. **Gate pre-deploy (104-01):** suite app 1418 + packages ~1310 + 9 guards + tsc verdes; dossier VSIM firmado (`signoff: approved`, autorización operador verbatim 2026-07-26).
2. **Deploy #1 (por el executor, antes del corte):** build OpenNext en Docker `node:22-slim` (mirror C:\Temp\obs-build, .pnpm-store purgado) + `pnpm run deploy` en el mismo contenedor con OAuth del host → **versión `027efdf6`** (2026-07-26T16:50:19Z).
   - Fix de build en el camino: `382b274` — `CONSENT_VERSION` movido fuera del módulo `"use server"` de /cuenta (OpenNext rechaza exports no-async en módulos use-server).
3. **Flip VSIM:** `wrangler secret put VSIM_PUBLIC_ENABLED` (valor `true`) → versión `b8449d8c` (Secret Change, 16:50:44Z). Confirmado en `wrangler secret list`. `.env.example` intacto (anti-flip guard verde).
4. **Verificación post-deploy #1:**
   - `/` 200; CSP enforced (`default-src 'self'`…) + HSTS presentes.
   - `/comparar?a=D1170&b=D1165` 200 — eje VSIM VIVO: "Coinciden en 3655 de 3672 votaciones compartidas" + caveat base-alta ("La coincidencia alta es la norma, no una señal…") + cobertura declarada + fuente/fecha.
   - "Seguir" AUSENTE del DOM (flag NOTIF OFF) ✓; MONEY ausente ✓.
   - **DEFECTO detectado:** `/cuenta` devolvía **500** — la página instanciaba `createUserClient` (fail-loud sin `SUPABASE_PUBLISHABLE_KEY`, provisión operador pendiente) ANTES del gate NOTIF.
5. **Fix `e7d588a`:** gate-primero en `app/app/cuenta/page.tsx` — con flag OFF renderiza "Las suscripciones no están disponibles en este momento" sin tocar el cliente user. Tests cuenta 9/9, suite 1418/1418, tsc limpio.
6. **Deploy #2 (redeploy con el fix):** misma secuencia Docker → versión registrada al final de este archivo.

## Flags en el Worker (post-deploy)

| Flag | Estado | Mecanismo |
|------|--------|-----------|
| VSIM_PUBLIC_ENABLED | **true** (flip autorizado + dossier firmado) | wrangler secret |
| NOTIF_PUBLIC_ENABLED | ausente = OFF (Flag-OFF closure 103 §f; provisión operador pendiente) | — |
| MONEY / CRUCES / NET | sin cambio (CRUCES/NET true desde v4/v5; MONEY gated) | wrangler secret |

## Gotchas re-confirmados
- Robocopy /MIR borra los helper scripts del build dir (no están en el repo) → re-escribirlos tras cada espejo.
- `wrangler` del host sombreado por shim Python de miniconda → usar `wrangler.cmd` (npm global) o el contenedor.
- Propagación edge ~10-30 s antes de los curl.

## Verificación post-deploy #2 (final)

**Versión desplegada: `3cd2511d-3636-48df-89e1-89e3ae342fa6`** (2026-07-26, deploy #2 con fix `e7d588a`).

| Check | Resultado |
|-------|-----------|
| `/cuenta` | 200 con copy gated "Las suscripciones no están disponibles en este momento" (era 500) ✓ |
| Camino A: `/`, `/parlamentarios`, `/agenda`, `/buscar`, `/metodologia` | 200 × 5 ✓ |
| `/spike-auth` | 404 (borrado en 103) ✓ |
| Eje VSIM en `/comparar?a=D1170&b=D1165` | vivo, caveat base-alta presente ✓ |
| "Seguir" en home | 0 ocurrencias (NOTIF OFF, DOM-ausente) ✓ |
| CSP en `/cuenta` | header presente (enforced) ✓ |

Inventario E2E completo × dato real × BrowserOS = Plan 104-03 (evidencia en 104-E2E-EVIDENCIA.md).

## Redeploys del E2E (Plan 104-03) — fix URI-como-partido

Durante el inventario E2E se detectó que `/parlamentario/S1344` (Matías Walker, senador) y `/parlamentarios` renderizaban el recurso RDF crudo de BCN (`http://datos.bcn.cl/.../partido-democratas-chile`) **como valor de partido** (1 fila de militancia con URI en vez de etiqueta; gap del parser BCN de senadores, Phase 90). Defecto Rule 1 (rompe superficie ciudadana; viola "cero URI-como-partido"). Fix display-only `partidoLegible()` + 3 redeploys (un sitio de render por vez):

| # | Commit | Versión | Sitio saneado |
|---|--------|---------|---------------|
| 1 | `a6f4057` | `600de567` | `PartidoChip` (ficha header + fila directorio) |
| 2 | `34e4df2` | `95a9c858` | `MilitanciasDeParlamentario` (vigente + histórico) |
| 3 | `2b86707` | **`b467d41a`** (final) | `ParlamentariosFiltro` (label de la faceta; clave de filtro RAW) |

Misma secuencia Docker que deploy #1/#2 (mirror C:\Temp\obs-build → docker-build.sh + docker-deploy.sh en node:22-slim con OAuth montado en /root/.config/.wrangler). Copia targeted de los archivos cambiados al mirror (evita robocopy /MIR y su re-escritura de helper scripts). Versión tras el E2E: `b467d41a`. Cero URI-como-partido *visible*; la única ocurrencia residual de `datos.bcn.cl` en `/parlamentarios` es la clave de filtro serializada en el payload RSC del island (no-visible, RAW por diseño). Ver 104-E2E-EVIDENCIA.md §6.

## Redeploy post-review (fixes WR-01/02/04 del 104-REVIEW)

Fixes del code review de fase (partidoLegible case-insensitive + slug degenerado → null, SesionBlock sin interpolación de errores Postgres) + dossier VSIM reconciliado (WR-03, doc-only). Suite 1428/1428 + tsc limpio. Redeploy targeted → **VERSIÓN FINAL EN PRODUCCIÓN: `e89b79af-3741-4d72-8056-123858b56ba6`** (2026-07-26). Smoke re-verificado: `/cuenta` gated 200, VSIM caveat vivo, home 200. PROD == master (`cac1ffa` + review docs).
