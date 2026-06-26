---
phase: 45
slug: leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `45-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 + @testing-library/react 16 (jsdom) |
| **Config file** | `app/vitest.config.ts` (alias `@`→`app/`, `server-only`→empty; jsdom; globals; setup `app/vitest.setup.ts`) |
| **Quick run command** | `cd app && pnpm test <file>` |
| **Full suite command** | `cd app && pnpm test && pnpm typecheck` |
| **Estimated runtime** | ~30–60 s |

> GOTCHA (memoria): el `pnpm test` de la RAÍZ no corre `app/` — ejecutar dentro de `app/`. Para `tsc -b` usar `references`, no `paths`.

---

## Sampling Rate

- **After every task commit:** `cd app && pnpm test <archivo afectado>`
- **After every plan wave:** `cd app && pnpm test && pnpm typecheck`
- **Before `/gsd:verify-work`:** suite `app/` completa verde + guard verde + `tsc` limpio; build OpenNext validado en Docker Linux (checkpoint operador para deploy).
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| LEG-01 | `CarrilAccordion`: `<h2>` visible abierto o cerrado; conteo en el header; trigger toggla `aria-expanded`/`data-state`; cuerpo (children) en el DOM (forceMount) | unit (RTL) | `cd app && pnpm test components/carril-accordion.test.tsx` | ❌ W0 |
| LEG-01 | Frontera `mt-12`: cada carril es su propia `<section className="…mt-12…">`; un acordeón por dominio (no dos dominios en un Root) | unit (estructural) | `cd app && pnpm test` | ❌ W0 |
| LEG-02 | `ParlamentarioResumen`: un chip por carril presente; cada chip `href="#<carril>"`; 3-estado distinto (dato/vacío-honesto/no-ingerido); MONEY OFF → honest-state, nunca número | unit (RTL, vista pura + fixtures) | `cd app && pnpm test components/parlamentario-resumen.test.tsx` | ❌ W0 |
| LEG-02 | El chip nunca renderiza densidad falsa para un vacío | unit (RTL, negative-assert) | idem | ❌ W0 |
| LEG-03 | Guard de lockdown verde: árbol público sin RPC fuera del allowlist ni `.from('<pii>')` (incl. módulos nuevos) | guard (existente) | `cd app && pnpm test lib/lockdown-guard.test.ts` | ✅ |
| LEG-03 | `carril-accordion.tsx` no importa secciones ni `@/lib/supabase` (no-leak SSR) | unit (grep/negative) | `cd app && pnpm test` | ❌ W0 |
| LEG-03 | Tipos limpios | typecheck | `cd app && pnpm typecheck` | ✅ infra |
| LEG-03 | Suite completa verde | regression | `cd app && pnpm test` | ✅ infra |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `components/carril-accordion.test.tsx` — LEG-01 (header visible, conteo, toggle, forceMount). Usar `@testing-library/user-event`; asertar sobre `aria-expanded`/`data-state` (robusto en jsdom).
- [ ] `components/parlamentario-resumen.test.tsx` — LEG-02 (extraer vista pura `ResumenView({chips})` para testear con fixtures sin runtime Supabase, igual que `LobbyView`/`VotosView`).
- [ ] Test estructural de frontera `mt-12` + "un acordeón por dominio" — LEG-01/03.
- [ ] (Opcional) `lib/parlamentario-resumen-conteos.test.ts` — mapeo puro conteo→3-estado.
- [ ] Framework install: ninguno (vitest+RTL ya presentes). Solo `pnpm add @radix-ui/react-accordion@1.2.14`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Build OpenNext/Cloudflare no se rompe con la isla cliente | LEG-03 | Build requiere Docker Linux (Windows rompe el worker) | Operador: build OpenNext en Docker Linux; deploy wrangler local (checkpoint) |
| Animación respeta `prefers-reduced-motion` | LEG-01 | Preferencia de SO no observable en jsdom | Revisión visual con reduce-motion activo |
