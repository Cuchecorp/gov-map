# Deferred items — Phase 128

## 128-01: `pnpm guards` timeout flake (out of scope)

`lib/money-antiflip-guard.test.ts`, `lib/notif-antiflip-guard.test.ts`,
`lib/vsim-antiflip-guard.test.ts` — the `WR-03` test in each ("ningún archivo
fuente de packages/ nombra {MONEY,NOTIF,VSIM}_PUBLIC_ENABLED crudo") timed out
(5000ms) when run as part of the full `pnpm guards` suite (parallel test-file
execution under load). All three pass in isolation with the default timeout
(20/17/? tests green, no relation to files touched by this plan). Not caused by
128-01 changes (`lib/idioms-panel.ts`, `lib/links-internos.ts`,
`components/panel-item-proyecto.tsx`, and their tests/guard-test edits) — none
of those touch `packages/` or the MONEY/NOTIF/VSIM gate chokepoints. Logged per
scope-boundary rule; not fixed here.
