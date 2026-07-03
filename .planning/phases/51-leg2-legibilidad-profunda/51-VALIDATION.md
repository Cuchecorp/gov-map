---
phase: 51
slug: leg2-legibilidad-profunda
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2.6 (RTL + jsdom para vistas puras; source-scan estructural) |
| **Config file** | `app/vitest.config.ts` (glob `.test.{ts,tsx}` bajo lib/components/app) |
| **Quick run command** | `pnpm --dir app test -- --run <archivo>` |
| **Full suite command** | `pnpm --dir app test -- --run` + `pnpm --dir app exec tsc -b` |
| **Estimated runtime** | ~60-90 s suite completa |

---

## Sampling Rate

- **After every task commit:** Run quick command sobre los tests del componente tocado
- **After every plan wave:** Run full suite + tsc -b
- **Before `/gsd:verify-work`:** Full suite green + lockdown-guard 7/7 + negative-match banned-vocab
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Baseline: suite app/ 406 verde pre-fase. Cada task corre su test por archivo + `tsc -b`; la wave cierra con suite completa + lockdown-guard.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | SC5 | LEGAL-03 | pgTAP: RPC sin ausencias, SECURITY DEFINER, sin PII en salida | pgTAP (W0, test-first) | operador/local: `psql -tA -f supabase/tests/0047_*.test.sql` | ❌ W0 | ⬜ pending |
| 51-01-02 | 01 | 1 | SC5 | anon re-exposición | 0047 doble revoke + grant solo del RPC allowlisted | source (migración) | `pnpm --dir app test -- --run lib/lockdown-guard` | ❌ | ⬜ pending |
| 51-01-03 | 01 | 1 | SC9 | guard Camino A | guard exime SOLO `grant execute on function` allowlisted; `grant select` sintético sigue BLOQUEADO | unit (source-scan) | `pnpm --dir app test -- --run lib/lockdown-guard` | ✅ | ⬜ pending |
| 51-01-04 | 01 | 1 | SC5 | — | apply remoto + pgTAP PROD (checkpoint humano, agente NO aplica) | manual | — | — | ⬜ pending |
| 51-02-01 | 02 | 1 | SC1 | searchParams injection | `?votosVer` validado; resumen sin RPC nueva | tdd (RTL) | `pnpm --dir app test -- --run components/votos-por-parlamentario` | ✅ | ⬜ pending |
| 51-02-02 | 02 | 1 | SC5 | — | titulo null → fallback boletín (degrade pre-apply honesto); B24 borrado | unit (RTL) | `pnpm --dir app test -- --run components/votos-por-parlamentario` | ✅ | ⬜ pending |
| 51-03-01 | 03 | 1 | SC3 | URI-como-valor | ningún valor `^https?://` renderizado; tarjeta reusa seriePatrimonio; banned-vocab | tdd (RTL) | `pnpm --dir app test -- --run components/patrimonio-de-parlamentario` | ✅ | ⬜ pending |
| 51-03-02 | 03 | 1 | SC4 | searchParams injection | form GET nativo; `?comparar=A,B` deep-link compat; degrade <2 versiones | unit (RTL) | `pnpm --dir app test -- --run components/patrimonio-de-parlamentario` | ✅ | ⬜ pending |
| 51-04-01 | 04 | 1 | SC6 | identidad no-confirmada | agrupado texto crudo NUNCA enlazado; caveat 1×/sección | tdd (RTL) | `pnpm --dir app test -- --run components/lobby-de-parlamentario` | ✅ | ⬜ pending |
| 51-04-02 | 04 | 1 | SC6 | searchParams injection | `?vista` whitelisted; cronológica paginada intacta | unit (RTL) | `pnpm --dir app test -- --run components/lobby-de-parlamentario` | ✅ | ⬜ pending |
| 51-05-01 | 05 | 1 | SC2 | fabricación de estado | EstadoActualBlock omite líneas no derivables, nunca fabrica | tdd (RTL, W0 nuevo) | `pnpm --dir app test -- --run components/estado-actual-block` | ❌ W0 | ⬜ pending |
| 51-05-02 | 05 | 1 | SC2/SC7 | pérdida de trazabilidad | solo pares de urgencia colapsan; badge 1×/heading + link fuente por evento | tdd (RTL, W0 nuevo) | `pnpm --dir app test -- --run components/timeline-view` | ❌ W0 | ⬜ pending |
| 51-06-01 | 06 | 1 | SC8 | promesa excesiva | /metodologia honesta (no promete diccionario completo) | unit (RTL) | `pnpm --dir app test -- --run app/metodologia` | ❌ | ⬜ pending |
| 51-06-02 | 06 | 1 | SC8 | scope CC BY | footer no contradice atribuciones no-CC-BY por dataset | source-scan + RTL | `pnpm --dir app test -- --run app/layout` | ❌ | ⬜ pending |
| 51-07-01 | 07 | 1 | SC1 | PII (LEGAL-03) | header sin partido/rut/email; solo campos del RPC público | unit (RTL) | `pnpm --dir app test -- --run components/parlamentario-header` | ✅ | ⬜ pending |
| 51-07-02 | 07 | 1 | SC1 | — | chip "Presente en N de M" derivado de datos reales, degrade honesto | unit (RTL) | `pnpm --dir app test -- --run lib/parlamentario-resumen-conteos` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all phase requirements (vitest + RTL + source-scan ya instalados; fixtures existentes por componente).
- [ ] pgTAP nuevo para la migración de rebeldías (`supabase/tests/`) — se corre por psql local/operador, FUERA del glob vitest (convención del proyecto).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apply remoto de la migración rebeldías + pgTAP contra PROD | SC5 | psql --db-url = checkpoint operador (convención LOCKED) | operador: `psql "$SUPABASE_DB_URL" -f supabase/migrations/00XX_*.sql` + pgTAP; luego verificación en ficha |
| Deploy Cloudflare (build Docker Linux + wrangler) | SC1-SC8 visibles en vivo | deploy = checkpoint operador | `docker-cf-build.sh` → `wrangler deploy` |
