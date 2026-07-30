---
phase: 131
slug: debt-ficha-regla-del-timeline-co-autoria-sin-truncamiento
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 131 — Validation Strategy

> Derivada de `131-RESEARCH.md` §Validation Architecture (fix B-2 del plan-checker). Checks 8a-8d
> corridos a mano por el checker: PASAN (9/9 tasks con automated; sin watchAll; sin 3 tasks
> seguidas sin verificación; Wave-0 gaps se crean dentro de las tareas que los consumen).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.6 (`app/package.json`) + pgTAP contra schema aplicado |
| **Config file** | `app/vitest.config.*` |
| **Quick run command** | `pnpm --filter ./app exec vitest run components/timeline-view.test.tsx "app/comparar/page.test.tsx"` |
| **Full suite command** | `pnpm test` (raíz) — SOLO en 131-03 T3 (W-7: no en wave 1, paralela por worktrees) |
| **Guards runner** | `pnpm guards` (raíz — 17 guards por NOMBRE, jamás glob) |
| **pgTAP** | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f <test> \| tr -d '\r'` |

---

## Sampling Rate

- **Per task commit:** vitest run de los archivos tocados POR NOMBRE
- **Per wave merge:** `pnpm --filter ./app test && pnpm guards`
- **Phase gate (131-03 T3):** `pnpm test` + `pnpm guards` verdes + pgTAP contra schema APLICADO
- **Max feedback latency:** 120 s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? | Status |
|---|---|---|---|---|---|
| DEBT-03 | `construirItems` absorbe exactamente K eventos en P períodos sobre el fixture del testigo | unit | vitest run components/timeline-view.test.tsx | ✅ añadir caso paridad | ⬜ |
| DEBT-03 | la query `.sql` da el MISMO K contra PROD (con protocolo W-6 si el boletín creció) | psql | `psql -tA -f supabase/queries/timeline-regla-de-seleccion.sql \| tr -d '\r'` | ❌ Wave 0 | ⬜ |
| DEBT-03/D-03 | orden de lectura TOTAL (dos `.order(`) en page.tsx | source-scan | assert en unit | ❌ Wave 0 | ⬜ |
| DEBT-04 | v2 secdef + search_path='' + timeout + limit 1000 + doble-revoke | pgTAP | `psql -tA -f supabase/tests/0083_coautoria_v2.test.sql` (número re-resuelto al crear) | ❌ Wave 0 | ⬜ |
| DEBT-04 | `/comparar` muestra `Comparten 92 …` para D1178×D1099 (mock) | unit | vitest run "app/comparar/page.test.tsx" | ✅ añadir caso | ⬜ |
| DEBT-04 | v2 en PUBLIC_RPC_ALLOWLIST + call-site allowlisted | guard | vitest run lib/lockdown-guard.test.ts | ✅ | ⬜ |
| DEBT-04 | copy sin vocabulario de afinidad | guard | vitest run lib/anti-insinuacion-guard.test.ts | ✅ (SUPERFICIES_RELACIONES cubre comparar) | ⬜ |
| D-09 | régimen completo verde | guard | `pnpm guards` | ✅ | ⬜ |

---

## Wave 0 Requirements

- [ ] `supabase/queries/timeline-regla-de-seleccion.sql` — regla escrita con criterio declarado + reconciliación "85 = orden viejo (fecha sola); H = orden total (fecha,id)" (W-2)
- [ ] pgTAP de la v2 (patrón 0060/0061/0067/0068.test.sql)
- [ ] Caso de paridad en timeline-view.test.tsx + caso D1178×D1099 en comparar
- [ ] Assert de orden total en la lectura de `tramitacion_evento`

## Security Domain (ASVS aplicable)

- **V4 Access Control — SÍ:** la v2 es RPC pública nueva ⇒ aguja completa (cero-grant, secdef
  `search_path=''`, timeout, LIMIT 1000, doble-revoke, allowlist A2/A5). La viva (0064) intacta
  (42P13). Cero PII: la co-autoría emite ids/boletines públicos del carril sancionado.
