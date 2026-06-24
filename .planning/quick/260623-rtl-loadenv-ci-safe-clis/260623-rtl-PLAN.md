---
phase: quick-260623-rtl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/lobby/src/run-camara-lobby-cli.ts
  - packages/probidad/src/run-probidad-todos-cli.ts
autonomous: true
requirements: [FASE0-1]
must_haves:
  truths:
    - "Both CLIs run in an environment without a .env file when the secrets are present in process.env"
    - "Local operator runs are unchanged: .env is still read and parsed BOM-safe"
    - "process.env values take precedence over .env values (CI overlay)"
  artifacts:
    - path: "packages/lobby/src/run-camara-lobby-cli.ts"
      provides: "CI-safe loadEnv with try/catch + process.env overlay"
      contains: "process.env[k]"
    - path: "packages/probidad/src/run-probidad-todos-cli.ts"
      provides: "CI-safe loadEnv with try/catch + process.env overlay"
      contains: "process.env[k]"
  key_links:
    - from: "packages/lobby/src/run-camara-lobby-cli.ts"
      to: "process.env"
      via: "overlay loop after try/catch"
      pattern: "if \\(process\\.env\\[k\\]\\)"
    - from: "packages/probidad/src/run-probidad-todos-cli.ts"
      to: "process.env"
      via: "overlay loop after try/catch"
      pattern: "if \\(process\\.env\\[k\\]\\)"
---

<objective>
Make `loadEnv` CI-safe in the two flagship operator CLIs so they survive GitHub Actions runs where no `.env` file exists and secrets are injected via `process.env`.

Purpose: Unblock Fase 1 of the v4 milestone (scheduled lobby/probidad workflows). Today `run-camara-lobby-cli.ts:38` and `run-probidad-todos-cli.ts:33` call `readFileSync(join(root, ".env"), "utf8")` with no try/catch — in CI this throws ENOENT and kills the CLI before the first fetch.

Output: Both CLIs patched to mirror the already-correct pattern in `packages/agenda/src/run-agenda-prod-cli.ts` (lines 48-72): try/catch around the `.env` read + a `process.env` overlay loop with precedence.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONE-v4-cruces.md

<interfaces>
<!-- Reference pattern — already correct in agenda CLI. Copy this shape. -->

From packages/agenda/src/run-agenda-prod-cli.ts (loadEnv, lines 48-72):
```typescript
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env (abajo).
  }
  for (const k of [
    "SUPABASE_API_URL",
    "SUPABASE_SECRET_KEY",
    // ...keys per file...
  ]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}
```

Current BROKEN shape (identical in both targets):
```typescript
function loadEnv(root: string): Record<string, string> {
  const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Patch loadEnv in run-camara-lobby-cli.ts (CI-safe)</name>
  <files>packages/lobby/src/run-camara-lobby-cli.ts</files>
  <action>
Rewrite the `loadEnv` function (lines 37-45) to mirror the agenda reference pattern. Move the `out` declaration to the top. Wrap the `readFileSync(join(root, ".env"), "utf8")` read + BOM strip + line-parse loop in a try block. Add an empty catch with the comment `// Sin \`.env\` (CI): los secrets vienen de process.env (abajo).`. After the try/catch, add an overlay loop iterating exactly these keys and applying `if (process.env[k]) out[k] = process.env[k]!;` so process.env has PRECEDENCE: SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET. Update the JSDoc on `loadEnv` (currently "Lee `.env` (BOM-safe) desde la raíz del workspace (cwd) → mapa de variables.") to note the process.env fallback for CI, matching the agenda doc tone. Do NOT change the file header comment beyond an optional light touch; the header line about "Credenciales SOLO de `.env`" may stay as-is or gain a brief CI note at your discretion — keep it minimal. Do not touch `cargarMaestra` or `main`.
  </action>
  <verify>
    <automated>pnpm test</automated>
  </verify>
  <done>loadEnv has try/catch around the .env read and an overlay loop over the 6 keys with `if (process.env[k]) out[k] = process.env[k]!;`; pnpm test green.</done>
</task>

<task type="auto">
  <name>Task 2: Patch loadEnv in run-probidad-todos-cli.ts (CI-safe)</name>
  <files>packages/probidad/src/run-probidad-todos-cli.ts</files>
  <action>
Apply the identical CI-safe pattern to the `loadEnv` function (lines 32-40). Move `out` to the top, wrap the read + parse loop in try with the same empty catch + comment `// Sin \`.env\` (CI): los secrets vienen de process.env (abajo).`. After the try/catch, add an overlay loop applying `if (process.env[k]) out[k] = process.env[k]!;` over exactly these keys (probidad only writes to Supabase, no R2): SUPABASE_API_URL, SUPABASE_SECRET_KEY. Update the `loadEnv` JSDoc to note the process.env CI fallback. Optional light touch on the header "Credenciales SOLO de `.env`" note; keep minimal. Do not touch `cargarMaestra` or `main`.
  </action>
  <verify>
    <automated>pnpm test</automated>
  </verify>
  <done>loadEnv has try/catch around the .env read and an overlay loop over the 2 keys with `if (process.env[k]) out[k] = process.env[k]!;`; pnpm test green.</done>
</task>

</tasks>

<verification>
- Both `loadEnv` functions no longer throw when `.env` is absent (try/catch swallows ENOENT).
- `process.env` overlay runs after the catch and overrides parsed values.
- `pnpm test` passes (no behavior regression for local `.env`-based runs).
- Backwards compatible: local operator runs still read and parse `.env` exactly as before.
</verification>

<success_criteria>
- run-camara-lobby-cli.ts and run-probidad-todos-cli.ts run in an environment without `.env` when SUPABASE_API_URL / SUPABASE_SECRET_KEY (and for lobby, the R2 keys) are present in process.env.
- `pnpm test` green.
- No unrelated changes (cargarMaestra, main, imports untouched).
</success_criteria>

<output>
Create `.planning/quick/260623-rtl-loadenv-ci-safe-clis/260623-rtl-SUMMARY.md` when done.
</output>
