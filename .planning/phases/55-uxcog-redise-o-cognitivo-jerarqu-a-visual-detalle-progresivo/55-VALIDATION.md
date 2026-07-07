---
phase: 55
slug: uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library (jsdom), app/ workspace (pgTAP n/a esta fase) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `cd app && pnpm vitest run <archivo>` |
| **Full suite command** | `cd app && pnpm test` (594 baseline) `&& pnpm typecheck` (root) |
| **Estimated runtime** | ~55 seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}` sobre los archivos tocados
- **After every plan wave:** Run `{full suite command}` + `lib/lockdown-guard.test.ts` + banned-vocab negative-match
- **Before `/gsd:verify-work`:** Full suite must be green (≥594) + tsc limpio + lockdown-guard 7/7
- **Max feedback latency:** 55 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | UX-03 | T-55-02 | Token sin doble-hsl; hook zero-dep | unit | `cd app && pnpm vitest run lib/use-scrollspy.test.ts` | ❌ W0 (co-created) | ⬜ pending |
| 55-01-02 | 01 | 1 | UX-03 | T-55-01 | Isla no importa *Section/@/lib/supabase (source-scan) | unit (tdd) | `cd app && pnpm vitest run components/detalle-colapsable.test.tsx` | ❌ W0 (co-created) | ⬜ pending |
| 55-01-03 | 01 | 1 | UX-03 | T-55-01 / T-55-02 | Rail no importa *Section/supabase; caveat 1×; conteo no fabricado | unit (tdd) | `cd app && pnpm vitest run components/ficha-rail.test.tsx` | ❌ W0 (co-created) | ⬜ pending |
| 55-02-01 | 02 | 2 | UX-03 | T-55-03 | Sin RPC nueva/`.from(PII)`; server-only; sin montos ni bienes RPC | unit (tdd) | `cd app && pnpm vitest run lib/parlamentario-resumen-conteos.test.ts` | ⚠️ exists — EXTEND | ⬜ pending |
| 55-02-02 | 02 | 2 | UX-03 | T-55-05 | Vistas puras; colores solo semánticos; lobby sin causal | unit (tdd) | `cd app && pnpm vitest run components/capa1/votos-capa1.test.tsx components/capa1/lobby-capa1.test.tsx` | ❌ W0 (co-created) | ⬜ pending |
| 55-02-03 | 02 | 2 | UX-03 | T-55-04 / T-55-05 | Patrimonio sin montos; cruces petróleo-framed; caveat 1×; sin composición reunión-voto | unit (tdd) | `cd app && pnpm vitest run components/capa1/patrimonio-capa1.test.tsx components/capa1/cruces-capa1.test.tsx` | ❌ W0 (co-created) | ⬜ pending |
| 55-03-01 | 03 | 3 | UX-03 | T-55-06 / T-55-07 | *Section como children (no-leak); gate-first + force-dynamic intactos | typecheck | `cd app && pnpm typecheck` | n/a (tsc gate) | ⬜ pending |
| 55-03-02 | 03 | 3 | UX-03 | T-55-06 / T-55-08 | capa-1 visible fuera del disclosure; detalle default-cerrado; gate OFF ⇒ ausente | unit | `cd app && pnpm vitest run "app/parlamentario/[id]/page.test.tsx"` | ⚠️ exists — UPDATE | ⬜ pending |
| 55-04-01 | 04 | 2 | UX-03 | T-55-10 / T-55-11 | Reusa agrupación urgencia; copy LOCKED neutro; fechaValida | unit (tdd) | `cd app && pnpm vitest run components/capa1/tramitacion-stepper.test.tsx components/timeline-view.test.tsx components/estado-actual-block.test.tsx` | ❌ W0 stepper (co-created); timeline/estado EXTEND | ⬜ pending |
| 55-04-02 | 04 | 2 | UX-03 | T-55-09 / T-55-10 | Secciones server como children; nombre lobby plano 52-03; mt-12 hermanos | unit + typecheck | `cd app && pnpm vitest run "app/proyecto/[boletin]/page.test.tsx" && cd .. && pnpm typecheck` | ⚠️ exists — UPDATE | ⬜ pending |
| 55-05-01 | 05 | 1 | UX-03 | T-55-14 | Agrupación presentacional; cero query/`.from` nueva; cross-links intactos | unit | `cd app && pnpm vitest run "app/agenda/page.test.tsx"` | ⚠️ exists — EXTEND | ⬜ pending |
| 55-05-02 | 05 | 1 | UX-03 | T-55-12 / T-55-13 | Gate + force-dynamic intactos; layout grid (no física); seed sobrio no-ranking | unit | `cd app && pnpm vitest run "components/red/red-graph.test.tsx" "app/red/page.test.tsx"` | ⚠️ exists — EXTEND | ⬜ pending |
| 55-06-01 | 06 | 4 | UX-03 | T-55-15 / T-55-16 | Gate completo verde ANTES del deploy; cero flip flag/DDL | suite + typecheck | `cd app && pnpm test && cd .. && pnpm typecheck` | ✅ full suite | ⬜ pending |
| 55-06-02 | 06 | 4 | UX-03 | T-55-16 | Recaptura same-origin cap 12.800px | smoke | `ls docs/demo/ | head` | n/a (artefacto) | ⬜ pending |
| 55-06-03 | 06 | 4 | UX-03 | — | Checkpoint dirección visual (operador) | manual | — (ver Manual-Only) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Los tests co-creados dentro de las tareas TDD (mitad RED del ciclo) — no hay archivos de test pre-fabricados aparte; cada tarea TDD crea su test junto al código:

- [ ] `app/lib/use-scrollspy.test.ts` — co-creado en 55-01-01 (IntersectionObserver mock → id activo)
- [ ] `app/components/detalle-colapsable.test.tsx` — co-creado en 55-01-02 (default-cerrado, toggle, forceMount SSR-in-DOM, source-scan no-leak)
- [ ] `app/components/ficha-rail.test.tsx` — co-creado en 55-01-03 (nav por carril, conteo 3-estado, ◆ cruces, caveat 1×, scrollspy-active, source-scan no-leak)
- [ ] `app/lib/parlamentario-resumen-conteos.test.ts` — EXTENDIDO en 55-02-01 (votosBreakdown/lobbyTopMaterias/crucesSectores/patrimonioPorDeclaracion/rangoAnios + throw + fallback vacío)
- [ ] `app/components/capa1/votos-capa1.test.tsx` — co-creado en 55-02-02 (5 cifras Mono, omisión asistencia null, sin petróleo)
- [ ] `app/components/capa1/lobby-capa1.test.tsx` — co-creado en 55-02-02 (barras por materia, conteo neutro, degradación honesta, sin causal/petróleo)
- [ ] `app/components/capa1/patrimonio-capa1.test.tsx` — co-creado en 55-02-03 (mini-columnas por año, CERO monto, degradación <2)
- [ ] `app/components/capa1/cruces-capa1.test.tsx` — co-creado en 55-02-03 (marco/h2/CTA petróleo, chips neutros, "· M votos" solo M>0, caveat 1×)
- [ ] `app/components/capa1/tramitacion-stepper.test.tsx` — co-creado en 55-04-01 (hitos clave, urgencia agrupada copy LOCKED, omisión honesta, sin causal)
- [ ] EXTEND `app/components/timeline-view.test.tsx`, `app/components/estado-actual-block.test.tsx` (55-04-01, verdes tras cualquier export)
- [ ] UPDATE `app/app/parlamentario/[id]/page.test.tsx` (55-03-02; aserciones viejas de auto-open fallan con el default invertido)
- [ ] UPDATE `app/app/proyecto/[boletin]/page.test.tsx` (55-04-02; rail + stepper + detalle colapsado)
- [ ] EXTEND `app/app/agenda/page.test.tsx` (55-05-01), `app/components/red/red-graph.test.tsx` + `app/app/red/page.test.tsx` (55-05-02)
- [ ] Reformar Suspense skeletons a la forma rail+capa-1 (anti-CLS, 55-03-02)

*Framework ya configurado — sin instalación (vitest/RTL presentes). CERO instalación de paquetes en la fase (LOCKED).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dirección visual/cognitiva del rediseño (variante B "Informe con rail") aprobada | UX-03 | Percepción visual: la corrección de F54/F55 es de dirección de diseño; ninguna aserción automatizada juzga "escaneable en <5s" ni "cognitivamente claro" | 55-06-03: abrir `docs/demo/` (o el sitio en vivo); confirmar (1) ficha parlamentario comunica su resumen en el primer viewport sin scroll y listas colapsadas por defecto, (2) cruces elevados en petróleo como destino del drill-down, (3) /red abre legible centrado en el seed. Escribir "approved" o describir ajustes. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (55-06-03 es checkpoint humano de percepción, sin equivalente automatizado)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests co-creados listados arriba)
- [x] No watch-mode flags
- [x] Feedback latency < 55s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
