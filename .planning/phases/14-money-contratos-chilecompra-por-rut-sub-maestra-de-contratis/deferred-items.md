# Deferred Items — Phase 14

Out-of-scope discoveries logged during execution. Do NOT fix within the current plan.

## Pre-existing tsc errors (Plan 14-03, Task 1)

`app/lib/buscar.test.ts` has two pre-existing TypeScript errors, unrelated to Plan 14-03 changes:

```
lib/buscar.test.ts(156,17): error TS2532: Object is possibly 'undefined'.
lib/buscar.test.ts(156,41): error TS2493: Tuple type '[]' of length '0' has no element at index '0'.
```

- The file was last modified in Phase 07 (`86073bf` / `a3da24d`), long before Plan 14-03.
- None of the files touched by this plan (`contratos-de-parlamentario.tsx`, `types.ts`, `page.tsx`, `contratos-de-parlamentario.test.tsx`) produce tsc errors.
- Scope boundary: only auto-fix issues directly caused by the current task. Logged, not fixed.
