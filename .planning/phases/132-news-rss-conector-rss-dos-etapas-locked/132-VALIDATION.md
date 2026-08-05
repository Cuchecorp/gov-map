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
| Corrida real contra los N feeds vivos (una sola vez, rate-limited) | NEWS-01/NEWS-02 | Agente (132-07 Task 2, `auto`) | CLI local; **sin `--dry-run` previo** (envenena la caché diaria); volcar a `/tmp/132-run1.log` y `/tmp/132-run2.log`; registrar conteos y la re-corrida `[skip]` |
| Verificación WAF: `Fetcher` Node vs curl (riesgo A4 del research) | NEWS-01 | Agente (132-01 Task 3, `auto`) | Si un host bloquea Node fetch: retirarlo de `FEEDS`, documentar, seguir con N-1; piso duro 3 feeds, bajo eso PARAR |
| Decisión de alcance D-132-A (Google News descartado) | NEWS-02 | Operador, **asíncrono** | Lee `132-REPORTE-OPERADOR.md` cuando esté; la fase no espera su respuesta |

---

## N = feeds vivos (parámetro de la fase, NO la constante 5)

> Corregido en la revisión de plan-checker (ronda 1). El plan 132-01 autoriza degradar a **N ≥ 3**
> si el riesgo A4 se materializa. Todo criterio de cierre de la fase se expresa en función de **N**;
> **ningún criterio queda cableado a 5**, porque un criterio inalcanzable por construcción es
> exactamente la presión que produce evidencia maquillada.

| Dónde | Cómo se obtiene N |
|-------|-------------------|
| Fuente de verdad | `FEEDS.length` en `packages/news/src/feeds.ts`, congelado por `feeds.test.ts` |
| Observable en el repo | `ls packages/news/src/__fixtures__/*.xml \| wc -l` |
| Declarado | SUMMARY de 132-01 ("número final de feeds vivos") y SUMMARY de 132-07 |
| Piso duro | `N < 3` ⇒ PARAR la fase (132-01 Task 3) |

---

## Presupuesto de red de la fase

> El probe de 132-01 corre **una sola vez**, dentro del `<action>`. Su `<verify><automated>` NO
> re-ejecuta red: comprueba los artefactos (fixtures: existencia, `<rss`, `<item`, tamaño, ausencia
> de `<!DOCTYPE html`). Re-correr el probe en cada re-verificación rompería este presupuesto y
> sobrescribiría los fixtures congelados de los que dependen los planes 02/04/05/06.

| Origen | Requests | Nota |
|--------|----------|------|
| `probe-feeds.ts` (132-01 T3) | N | 1 por host, ≥3 s de separación; NO escribe `source_snapshot`; corre UNA vez |
| Corrida LIVE (132-07 T2 paso 1) | N | 1 por host, ≥2 s de separación; escribe R2 + `source_snapshot` |
| Re-corrida `[skip]`, replay `--from-r2`, idempotencia | 0 | caché diaria / lectura de R2 |
| Re-verificación `news.google.com/robots.txt` (132-07 T3) | 1 | request de infraestructura, contabilizado aparte |
| **Total** | **2N (+1)** | 10 (+1) en el caso nominal N=5. Cualquier request adicional se justifica por escrito en el SUMMARY |

---

## Falsos rojos / falsos verdes cerrados en la revisión (ronda 1)

> Los dos blockers de esta ronda fueron el mismo patrón ya pagado dos veces: **el fix que es él mismo
> un falso verde o un falso rojo**. Para cada `<automated>` nuevo se aplicó la doble pregunta:
> *¿puede salir 0 sin probar nada?* y *¿puede NO salir 0 nunca?*

| Patrón | Dónde estaba | Cómo quedó |
|--------|--------------|------------|
| `set -e` + comando que DEBE fallar ⇒ verify **inalcanzable** (falso rojo) | 132-06 T1 | Captura dentro de `if …; then rc=0; else rc=$?; fi` + `test "$rc" -eq 2` (código exacto, no "≠ 0") |
| `env -u R2_*` revertido por la carga de `.env` ⇒ criterio inalcanzable, y "arreglarlo" degradaría el fallo duro | 132-06 T1 | Se prueba por el **tri-estado** (`r2Store: null`) en `run-news-cli.test.ts`, con mutación obligatoria + control positivo apareado. El `env -u` baja a auxiliar informativo |
| Criterio cableado a 5 feeds vs. degradación autorizada a N≥3 | 132-07 T2 | Todo parametrizado por **N**, con N observable en el repo y piso duro 3 |
| Verify que asserta estado de DB, no la **corrida** (pasa días después sin correr nada) | 132-07 T2 | Los pasos 1 y 2 vuelcan a log; el verify asserta `descargados=N skips=0` en run1 y N líneas `^[skip] rss-` + `descargados=0 skips=N` en run2, **además** del estado de DB |
| `<automated>` que re-ejecuta red y rompe el presupuesto / pisa fixtures | 132-01 T3 | El probe corre una vez en `<action>`; el verify comprueba artefactos sin red |
| Criterios con cláusula de juicio no medible | 132-04 T2, 132-05 T1 | Umbral numérico duro sobre el **archivo completo** (`.includes(` == 0; interpolación de credenciales en template strings == 0), con la garantía de fondo delegada a las mutaciones ya existentes |
| §Open Questions sin marca de resuelto (pedía "adjudicación antes de planificar", decía "4 fuentes") | `132-RESEARCH.md` | Renombrada `## Open Questions (RESOLVED)` con resolución inline por pregunta apuntando a D-132-A..D; el texto original se conserva y la cifra "4 fuentes" queda anotada como obsoleta (son **5**) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] Ningún criterio de aceptación puede cortocircuitar (comandos encadenados con `&&` cuyo exit
      code se reusa, `git diff` sin commit base, greps sin umbral numérico) — premortem F-5
- [ ] Ningún `<automated>` es **inalcanzable** (comando que debe fallar bajo `set -e`, condición de
      entorno que el propio proceso revierte, constante cableada que la degradación autorizada
      vuelve imposible) — revisión ronda 1
- [ ] Ningún `<automated>` de una corrida asserta **solo** estado de DB: debe asertar también la
      evidencia de la corrida (log) — revisión ronda 1
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
