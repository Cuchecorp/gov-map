# Phase 21 — Deferred Items (out-of-scope discoveries)

Items found during execution that are NOT caused by the current plan's changes.
Logged per the executor SCOPE BOUNDARY rule; NOT fixed here.

| Found During | File | Issue | Reason out-of-scope |
|--------------|------|-------|---------------------|
| 21-01 Task 2 (`tsc --noEmit`) | `app/lib/buscar.test.ts:156` | `TS2532 Object is possibly 'undefined'` + `TS2493 Tuple type '[]' of length '0' has no element at index '0'` (2 errors) | Pre-existing test file, last touched in Phase 16 (commit `8a6d028`). Untouched by Phase 21-01 (which only edits `globals.css`, `tailwind.config.ts`, `layout.tsx` and adds `global-header.tsx`/`header-nav.tsx`). No new type error in any plan file. |
| 21-02 Task 2 (`tsc --noEmit`) | `app/lib/buscar.test.ts:156` | Same 2 errors persist (`TS2532`/`TS2493` on `emb.embed.mock.calls[0][0][0]`). | Still pre-existing/unrelated. Phase 21-02 only adds `parlamentarios/page.tsx`, `parlamentario-directory-row.tsx`, `parlamentarios/page.test.tsx` and the `ParlamentarioListadoRow` interface in `types.ts` — none referenced by `buscar.test.ts`. All 21-02 source files are type-clean. |
