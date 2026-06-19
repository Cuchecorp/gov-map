# Deferred items — Phase 10

Out-of-scope discoveries logged during execution (NOT fixed; not caused by this phase's tasks).

| Found during | File | Issue | Why deferred |
|--------------|------|-------|--------------|
| 10-01 Task 1 (typecheck app) | `app/lib/buscar.test.ts:156` | `tsc --noEmit` errors TS2532/TS2493: `emb.embed.mock.calls[0][0][0]` tuple access on possibly-undefined / empty-tuple under strict config. Pre-existing (file untouched by Phase 10; `git status` clean for it). | Unrelated to `Seleccion`/votos changes. Pre-existing strictness issue in a search test. Touched files (`voto-row.tsx`, `app/lib/types.ts`) compile clean; the only errors are in this unrelated test file. |
