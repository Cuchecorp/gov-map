---
phase: 21
slug: producto-en-vivo-diseno-phase19-directorio-ideas-matrices
status: passed
verified: 2026-06-20
method: live e2e (browseros + HTTP + psql) on production
---

# Phase 21 — Verification

**Goal:** Elevar el sitio EN VIVO (frontend v1.0 plano) al producto de Phase 19 (diseño cerrado) y cerrar las brechas de ideas matrices vacías y descubrimiento de parlamentarios.

**Site:** https://observatorio-congreso.thevalis.workers.dev — version `1b08d539` — HTTP 200, `noindex` activo.

## Success Criteria — goal-backward

| # | Criterio | Evidencia | Veredicto |
|---|----------|-----------|-----------|
| SC1 | Diseño Phase 19 en todas las rutas (crema + petróleo 60/30/10, header global, tipografía/espaciado); benchmark vs mockup; extiende globals.css, no toca civic-tokens.css | Tokens extendidos + GlobalHeader (21-01); landing reconstruido a paridad con el mockup (21-04/399e49e): hero editorial + italic petróleo + CTA petróleo + chips + trust line. Directorio y ficha on-system. `civic-tokens.css` git-diff vacío. Screenshots `shots/`. | ✅ PASSED |
| SC2 | Directorio navegable `/parlamentarios`: 186, filtro cámara/nombre, enlaza a fichas, sin conocer el id | RPC `parlamentarios_publico()` aplicado al remoto; `/parlamentarios` 200 con 186 enlaces `/parlamentario/[id]`, filtros, sin partido/rut/email (pgTAP 0027 7/7 + grep HTTP). | ✅ PASSED |
| SC3 | Ideas matrices + cuerpos legales visibles; ingerir texto fuente → poblar idea_matriz; psql count > 0 | Causa raíz (writer hardcodeaba link null) + deviation (link→PDF: http→https + extracción unpdf, degrade honesto de escaneos). Backfill LIVE: **idea_matriz 57/74** (de 0/74), cuerpos_legales 58/74. Ficha renderiza ambas secciones con texto real. | ✅ PASSED (gate count>0) |
| SC4 | Honest-states correctos donde no hay enlace/dato; nunca vacío silencioso ni fabricado | "Autores no informados", "fuente oficial ↗", nulls honestos (17 idea_matriz null: 8 RUT-guard PII, 1 schema-fail, ~8 escaneados). Sin fabricación verificada en muestras. | ✅ PASSED |
| SC5 | Redeploy Linux (Docker) + wrangler; e2e browseros; noindex activo; MONEY/NET off; sin foto/partido | Build `docker-cf-build.sh` (node:22) → docker cp → wrangler deploy. e2e browseros en producción. noindex presente; contrato=0/aporte=0 (MONEY off); sin foto/partido en ninguna ruta. | ✅ PASSED |

## must_haves
- [x] idea_matriz poblada (count > 0): **57/74**
- [x] directorio lista 186 sin PII (LEGAL-03): pgTAP 7/7 + grep limpio
- [x] diseño cerrado implementado verbatim (civic-tokens intacto)
- [x] sitio desplegado, noindex activo, MONEY/NET off
- [x] honest-states sin fabricación

## Deuda (no bloqueante)
OCR fallback para PDFs escaneados; redacción de RUT pre-LLM (8 proyectos); textura punteada decorativa del mockup.

**Verdict: PASSED** — los 5 criterios verificados en vivo contra producción.
