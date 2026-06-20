---
phase: 21-producto-en-vivo-diseno-phase19-directorio-ideas-matrices
plan: 04
subsystem: deploy
tags: [deploy, cloudflare, opennext, docker, browseros, e2e, SC1, SC4, SC5]
status: complete
---

# 21-04 — Redeploy Linux + verificación e2e (SC5, cierre SC1)

Plan de integración: reconstruir el bundle con los cambios de 21-01/02/03 (+ cierre de diseño del landing), desplegar, y verificar end-to-end en producción.

## Build + deploy (orquestador)

- **Build SOLO en Linux** vía `docker-cf-build.sh` (node:22, container `obsbuild`): el build de OpenNext en Windows 500ea en runtime (`Dynamic require of middleware-manifest.json`). Mount del repo como `/host`, build a `/build/app/.open-next` → `docker cp` al host → `npx wrangler deploy` (OAuth `sanchez.rossi@gmail.com`).
- **Dos despliegues:** v1 `35d07e3a` (21-01/02/03), v2 `1b08d539` (tras el cierre SC1 del landing). Reuso de `obsbuild` (`docker start -a`) para el rebuild — node_modules cacheado.
- URL: `https://observatorio-congreso.thevalis.workers.dev` (HTTP 200).

## Cierre SC1 — landing a paridad con el mockup (commit 399e49e)

La e2e (browseros) detectó que el landing solo estaba re-coloreado, no reconstruido al mockup CERRADO de Phase 19. Se reconstruyó `app/app/page.tsx`:
- Hero editorial: "Qué pasó con cada proyecto de ley y cada parlamentario." + clausula italic PETRÓLEO "Con la fuente a la vista." (`text-accent-product`).
- CTA PETRÓLEO "Buscar proyectos" (`variant="hero"` en `search-box.tsx`, antes era el `--primary` azul) + 4 chips de ejemplo (3 ideas + boletín `15234-07` Mono) que prefijan y envían vía el `navigate()` existente del SearchBox.
- Trust line "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad." + link "¿Cómo leer esto?" → `/sobre`. Sin stats fabricadas.
- `app/app/page.test.tsx` +7 casos. `pnpm --filter app test` → 191 passed; `typecheck` clean; `civic-tokens.css` intacto. (Fix colateral: error de tipos pre-existente en `buscar.test.ts:156` que bloqueaba el gate de typecheck.)

## Verificación e2e en producción (browseros + HTTP), screenshots en `shots/`

| SC | Verificación | Resultado |
|----|--------------|-----------|
| SC1 diseño | `prod_home_v2.jpg` vs `mockup_landing.jpg`: hero editorial + italic petróleo + CTA petróleo + 4 chips + trust line; fondo crema; GlobalHeader con underline petróleo activo. Directorio (`prod_parlamentarios.jpg`) y ficha (`prod_proyecto_18296-05.jpg`) on-system. | ✅ paridad |
| SC2 directorio | `/parlamentarios` 200, **186** enlaces a fichas, filtro cámara/nombre, sin partido/rut/email (grep + pgTAP 0027 7/7). RPC `parlamentarios_publico()` aplicado al remoto. | ✅ |
| SC3 ideas matrices | Ficha renderiza secciones "Idea matriz" + "Cuerpos legales" con texto real ("otorgar una autorización legal adicional al Presidente…"). DB: idea_matriz 57/74 (de 0/74). | ✅ |
| SC4 honest-states | "Autores no informados", "fuente oficial ↗" con provenance; nulls honestos (no vacío silencioso, no fabricación). | ✅ |
| SC5 redeploy | Bundle Linux desplegado, HTTP 200, `noindex` presente en `/`, MONEY/NET off (contrato=0, aporte=0; sin items MONEY/NET en nav), sin foto/partido en ninguna ruta. | ✅ |

## Deuda registrada (no bloqueante)
- OCR fallback para PDFs escaneados viejos (idea_matriz null honesto hoy).
- Redacción de RUT antes del LLM para recuperar los 8 proyectos bloqueados por la guarda PII.
- Textura de fondo punteado del mockup (decorativo) no portada — paridad estructural/cromática lograda.

## Self-Check: PASSED
- `app/app/page.tsx`, `app/components/search-box.tsx`, `app/app/page.test.tsx` — FOUND (commit 399e49e)
- Deploy versions `35d07e3a` + `1b08d539` — wrangler Success
- 5/5 SCs verificados e2e en producción — screenshots en `shots/`
