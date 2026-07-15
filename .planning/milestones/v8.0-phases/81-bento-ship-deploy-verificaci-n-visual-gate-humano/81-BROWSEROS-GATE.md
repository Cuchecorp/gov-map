---
phase: 81-bento-ship-deploy-verificaci-n-visual-gate-humano
plan: 02
doc: BROWSEROS-GATE
type: operator-runbook
requirement: BENTO-07 (gate humano lectura fría del bento)
gate: checkpoint:human-verify (autonomous:false) — OPERADOR
status: PENDING-HANDOFF (evidencia lista; corrida cerrada según patrón v7 — el sign-off queda como deuda de operador)
created: 2026-07-15
---

# Phase 81 — Gate de lectura fría del rediseño Bento

> Runbook para el veredicto humano final del milestone v8.0: **"¿se entiende, se ve como
> el mockup, nada se siente roto?"** El agente YA corrió la verificación técnica y visual
> (abajo, §2) — lo único pendiente es la lectura fría del operador.

---

## 0. Estado del deploy

| Campo | Valor |
|-------|-------|
| URL | https://observatorio-congreso.thevalis.workers.dev |
| Version ID final | `fb88c8a4-dd05-4b9a-a017-0c373d0f185f` (redeploy con fix de anchors) |
| Version anterior (bento inicial) | `8ad839b3-497d-4824-913c-ac4b710a0e08` |
| Commits | fases 76-81 en master, pusheados a Cuchecorp/gov-map (HEAD 2abb0d1+) |
| Suite | app 918 + packages 1103 verde; tsc limpio |

## 1. Verificación técnica del agente (TODO VERDE — pre-flight cumplido)

| Check | Método | Resultado |
|-------|--------|-----------|
| Home desktop = mockup | Captura deploy vs `.planning/design/bento/home-bento.dc.html` (lado a lado en `captures/`) | ✅ Estructura idéntica (hero span-4 + accent span-2 + 3 entradas span-2 + votado/urgencias/frescura). Divergencias = las mandadas: h1 LOCKED (D1), copy accent fórmula /sobre (invariante 2) |
| Home móvil 390px | iframe same-origin 390px (patrón F55) sobre deploy | ✅ Colapso 1 col, orden hero→cómo-leer→entradas→votado→urgencias→frescura; sin overflow-x (scrollWidth 367 = clientWidth); header no rompe |
| Copy LOCKED intacto | HTTP + captura | ✅ kicker mono + h1 + cursiva + trust line + pills verbatim |
| Empty state honesto | Captura fullpage | ✅ "Votado esta semana" vacío-honesto (backfills v7 pendientes — correcto); urgencias con datos reales y chips suma/simple |
| Ruta interior lista | `captures/parlamentarios-deploy.png` | ✅ 1120px + radius tiles, 186 parlamentarios |
| Ruta interior ficha | `captures/ficha-deploy-S1110.png` | ✅ 1120px, interiores intactos |
| Ruta interior prosa | `captures/sobre-deploy.png` | ✅ container-only |
| Anchors vs sticky | getComputedStyle en deploy | ✅ section[id] → scroll-margin-top 80px (FIX aplicado en esta fase: el global de 76 solo cubría headings — hallazgo REAL del gate; redeploy fb88c8a4) |
| **/red no-regresión (CIERRA gate visual fase 75)** | getComputedStyle en deploy real (`/red?seed=D1009`) | ✅ main max-width 768px (max-w-3xl intocado); `.net-chip` font-size **11px exacto** (DEBT-05); 78 elementos `.net-*`, 13 chips; captura `captures/red-deploy-seed-D1009.png` |

## 2. Veredicto del agente (lectura fría propia)

**COMPRENSIBLE y FIEL AL MOCKUP.** La home se lee como el mockup bento (misma retícula,
mismos radios, misma paleta por tokens); el copy firmado está intacto; los estados vacíos
dicen la verdad; las rutas interiores se sienten del mismo sitio; /red quedó
pixel-idéntico. El único hallazgo del gate (anchors de sections tapadas por el sticky)
se corrigió y re-deployó en la misma sesión.

## 3. Checklist del OPERADOR (lectura fría — 5 minutos)

Abrir https://observatorio-congreso.thevalis.workers.dev en frío y responder:

- [ ] **Home desktop:** ¿se ve como el mockup (`captures/mockup-1200.png` vs `captures/home-deploy-desktop.png` + `home-deploy-fullpage.png`)? ¿Nada se siente roto o apiñado?
- [ ] **Home móvil** (celular real o DevTools 390px): ¿una columna limpia, sin scroll lateral, header usable?
- [ ] **Tile "¿Cómo leer esto?"**: ¿el texto se lee como principio del sitio (no como advertencia rara)?
- [ ] **"Votado esta semana" vacío**: ¿el mensaje se entiende como "aún no hay datos" y no como error?
- [ ] **Click en una entrada** (Proyectos/Parlamentarios/Agenda): ¿la ruta interior se siente del mismo sitio?
- [ ] **Ficha de parlamentario** → click en un ancla del rail (Votaciones/Lobby/Patrimonio): ¿la sección aterriza VISIBLE bajo el header (no tapada)?
- [ ] **/red** → elegir un parlamentario: ¿el grafo se ve igual que antes del rediseño?

**Registrar veredicto:** responder "aprobado" (o describir problemas) en la sesión de
Claude, o editar este doc: `status: APPROVED (fecha)` / lista de issues.

## 4. Si hay problemas

Reportarlos tal cual — vuelven como quick/gap sobre v8.0. Nada de esta fase tocó datos,
gates `*_PUBLIC_ENABLED`, ni el island `/red`.
