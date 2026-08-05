---
phase: 132
slug: news-rss-conector-rss-dos-etapas-locked
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
revised: 2026-08-05
---

# Phase 132 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace pnpm existente) |
| **Config file** | `packages/news/vitest.config.ts` (propio, analog literal de `packages/tramitacion`) |
| **Quick run command** | `pnpm --filter @obs/news test` (package nuevo) |
| **Full suite command** | `pnpm test` + `pnpm guards` |
| **Estimated runtime** | ~120 s suite completa |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @obs/news test`
- **After every plan wave:** Run `pnpm test` + `pnpm guards`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> El planner completa esta tabla con los task IDs reales. Regla del milestone:
> para cada test nuevo, MUTAR el código y comprobar que el test cae (anti-vacuo).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner) | — | — | NEWS-01/NEWS-02 | — | — | unit/integration | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/news/` scaffold con vitest wired al workspace. El paquete **SÍ lleva su propio
      `packages/news/vitest.config.ts`** (los 18 paquetes del workspace lo tienen; es el analog
      literal de `packages/tramitacion`). El gotcha de la Phase 43 **no** es "tener config propio":
      es que el paquete no sea recorrido por el `pnpm -r --filter "./packages/*" test` de la raíz,
      lo que lo vuelve CI-DARK. Eso se prueba con la falla inducida de abajo, no con el config.
- [ ] Verificar que `pnpm test` desde root RECORRE el package nuevo (correr con un test
      trivial que falla a propósito y ver que la suite raíz cae con exit ≠ 0, luego borrarlo y
      ver que vuelve a 0; registrar ambos exit codes)

---

## Manual-Only Verifications

> Revisión de premortem (2026-08-05): la corrida LIVE dejó de ser un checkpoint humano bloqueante.
> La ejecuta el agente (una sola pasada, serial, rate-limited, robots antes de cada fetch) y el
> resultado va al operador como **artefacto de handoff** `132-REPORTE-OPERADOR.md`, nunca como gate
> dentro de la fase (precedente Phase 129 `AUSENTE-HANDOFF`).

| Behavior | Requirement | Ejecuta | Test Instructions |
|----------|-------------|---------|-------------------|
| Corrida real contra los 5 feeds vivos (una sola vez, rate-limited) | NEWS-01/NEWS-02 | Agente (132-07 Task 2, `auto`) | CLI local; **sin `--dry-run` previo** (envenena la caché diaria); registrar conteos y la re-corrida `[skip]` |
| Verificación WAF: `Fetcher` Node vs curl (riesgo A4 del research) | NEWS-01 | Agente (132-01 Task 3, `auto`) | Si un host bloquea Node fetch: retirarlo de `FEEDS`, documentar, seguir con N-1; piso duro 3 feeds, bajo eso PARAR |
| Decisión de alcance D-132-A (Google News descartado) | NEWS-02 | Operador, **asíncrono** | Lee `132-REPORTE-OPERADOR.md` cuando esté; la fase no espera su respuesta |

---

## Presupuesto de red de la fase

| Origen | Requests | Nota |
|--------|----------|------|
| `probe-feeds.ts` (132-01 T3) | 5 | 1 por host, ≥3 s de separación; NO escribe `source_snapshot` |
| Corrida LIVE (132-07 T2 paso 1) | 5 | 1 por host, ≥2 s de separación; escribe R2 + `source_snapshot` |
| Re-corrida `[skip]`, replay `--from-r2`, idempotencia | 0 | caché diaria / lectura de R2 |
| Re-verificación `news.google.com/robots.txt` (132-07 T3) | 1 | request de infraestructura, contabilizado aparte |
| **Total** | **10 (+1)** | Cualquier request adicional se justifica por escrito en el SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] Ningún criterio de aceptación puede cortocircuitar (comandos encadenados con `&&` cuyo exit
      code se reusa, `git diff` sin commit base, greps sin umbral numérico) — premortem F-5
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
